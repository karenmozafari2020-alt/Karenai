const express = require('express');
const cors = require('cors');
const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*' }));
app.use(express.json({ limit: '32kb' }));
const PORT = process.env.PORT || 10000;
const ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const API_TOKEN = process.env.CF_API_TOKEN;
const MODEL = process.env.CF_AI_MODEL || '@cf/meta/llama-3.1-8b-instruct';
const SYSTEM_PROMPT = 'تو Karen AI هستی، یک دستیار هوش مصنوعی فارسی‌زبان و دوستانه. به زبان کاربر پاسخ بده. پاسخ‌ها مفید و روشن باشند. اگر مطمئن نیستی، صادقانه بگو. برای مسائل ریاضی مراحل را توضیح بده.';
app.use(express.static('public'));

app.get('/', (_req, res) => {
  res.sendFile(require('path').join(__dirname, 'public', 'index.html'));
});
app.get('/health', (_req, res) => res.json({ ok: true, configured: Boolean(ACCOUNT_ID && API_TOKEN), model: MODEL }));
app.post('/api/chat', async (req, res) => {
  if (!ACCOUNT_ID || !API_TOKEN) return res.status(503).json({ error: 'سرور هنوز تنظیم نشده است؛ متغیرهای Cloudflare را در Render اضافه کن.' });
  const message = typeof req.body?.message === 'string' ? req.body.message.trim().slice(0, 6000) : '';
  const history = Array.isArray(req.body?.history) ? req.body.history.slice(-8).filter(m => ['user','assistant'].includes(m?.role) && typeof m?.content === 'string').map(m => ({ role: m.role, content: m.content.slice(0, 3000) })) : [];
  if (!message) return res.status(400).json({ error: 'پیام خالی است.' });
  try {
    const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/${MODEL}`;
    const upstream = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${API_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history, { role: 'user', content: message }], max_tokens: 700 }) });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok || data.success === false) {
      console.error('Cloudflare AI error:', upstream.status, JSON.stringify(data.errors || data));
      return res.status(upstream.status === 429 ? 429 : 502).json({ error: upstream.status === 429 ? 'سهمیه یا محدودیت درخواست تمام شده؛ بعداً دوباره امتحان کن.' : 'Cloudflare AI پاسخ نداد. توکن، مدل و تنظیمات حساب را بررسی کن.' });
    }
    const answer = data.result?.response || data.result?.choices?.[0]?.message?.content;
    if (!answer) return res.status(502).json({ error: 'مدل پاسخ متنی برنگرداند.' });
    res.json({ answer, model: MODEL });
  } catch (e) { console.error('AI request failed:', e.message); res.status(502).json({ error: 'اتصال به سرویس هوش مصنوعی ناموفق بود.' }); }
});

async function makeImagePrompt(originalPrompt) {
  // Translate Persian to precise English for image models, without changing the requested subject.
  if (!ACCOUNT_ID || !API_TOKEN) return originalPrompt;
  try {
    const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/${MODEL}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${API_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: 'Translate the user image request into one concise, detailed English image-generation prompt. Preserve the exact main subject, colors, background, setting, and requested style. Do not invent, replace, or add objects. If the user requests a red rose on a black background, the prompt must explicitly say a red rose on a pure black background. Return only the prompt, no explanation.' },
          { role: 'user', content: originalPrompt }
        ],
        max_tokens: 220
      }),
      signal: AbortSignal.timeout(15000)
    });
    const data = await response.json().catch(() => ({}));
    const translated = data.result?.response || data.result?.choices?.[0]?.message?.content;
    if (response.ok && typeof translated === 'string' && translated.trim().length > 3) {
      return translated.trim().slice(0, 1800);
    }
  } catch (e) {
    console.error('Image prompt translation failed; using original prompt:', e.message);
  }
  return originalPrompt;
}

app.post('/api/image', async (req, res) => {
  const originalPrompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim().slice(0, 1500) : '';
  if (!originalPrompt) return res.status(400).json({ error: 'توضیح تصویر خالی است.' });

  const prompt = await makeImagePrompt(originalPrompt);
  console.log('Image request received:', originalPrompt.slice(0, 300));
  console.log('Image prompt prepared:', prompt.slice(0, 500));

  // 1) Try Cloudflare first.
  if (ACCOUNT_ID && API_TOKEN) {
    try {
      const imageModel = process.env.CF_IMAGE_MODEL || '@cf/black-forest-labs/flux-1-schnell';
      const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/${imageModel}`;
      const upstream = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${API_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
        signal: AbortSignal.timeout(90000)
      });
      const contentType = upstream.headers.get('content-type') || '';
      if (upstream.ok && contentType.includes('application/json')) {
        const data = await upstream.json().catch(() => ({}));
        const image = data.result?.image;
        if (data.success !== false && image) {
          return res.json({ image, mimeType: 'image/png', model: imageModel, provider: 'cloudflare' });
        }
        console.error('Cloudflare image error: no image in response', JSON.stringify(data.errors || data));
      } else {
        const details = await upstream.text().catch(() => '');
        console.error('Cloudflare image error:', upstream.status, details.slice(0, 1200));
      }
    } catch (e) {
      console.error('Cloudflare image request failed:', e.message);
    }
  } else {
    console.log('Cloudflare image skipped: CF_ACCOUNT_ID or CF_API_TOKEN is missing.');
  }

  // 2) Automatic fallback to Pollinations.
  const pollinationsKey = process.env.POLLINATIONS_API_KEY;
  if (pollinationsKey) {
    try {
      const imageUrl = new URL(`https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}`);
      imageUrl.searchParams.set('model', process.env.POLLINATIONS_IMAGE_MODEL || 'flux');
      imageUrl.searchParams.set('key', pollinationsKey);
      const upstream = await fetch(imageUrl, {
        headers: { Accept: 'image/*' },
        signal: AbortSignal.timeout(120000)
      });
      const contentType = upstream.headers.get('content-type') || '';
      if (!upstream.ok || !contentType.startsWith('image/')) {
        const details = await upstream.text().catch(() => '');
        console.error('Pollinations image error:', upstream.status, contentType, details.slice(0, 1200));
        return res.status(502).json({
          error: upstream.status === 429
            ? 'محدودیت درخواست Pollinations موقتاً پر شده است؛ کمی بعد دوباره امتحان کن.'
            : 'Cloudflare ناموفق بود و Pollinations هم تصویر نساخت. کلید و اعتبار Pollinations را بررسی کن.'
        });
      }
      const bytes = Buffer.from(await upstream.arrayBuffer());
      if (!bytes.length || bytes.length > 12 * 1024 * 1024) {
        console.error('Pollinations returned an empty or oversized image:', bytes.length);
        return res.status(502).json({ error: 'اندازه تصویر دریافتی نامعتبر است.' });
      }
      return res.json({
        image: bytes.toString('base64'),
        mimeType: contentType.split(';')[0] || 'image/png',
        model: process.env.POLLINATIONS_IMAGE_MODEL || 'flux',
        provider: 'pollinations'
      });
    } catch (e) {
      console.error('Pollinations image request failed:', e.message);
      return res.status(502).json({ error: 'هر دو سرویس ساخت تصویر ناموفق بودند؛ لاگ‌های Render را بررسی کن.' });
    }
  }

  return res.status(503).json({
    error: 'Cloudflare تصویر نساخت و کلید Pollinations هم در Render تنظیم نشده است.'
  });
});

app.listen(PORT, '0.0.0.0', () => console.log(`Karen AI API listening on ${PORT}`));
