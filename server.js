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
    const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(ACCOUNT_ID)}/ai/run/${encodeURIComponent(MODEL)}`;
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
app.listen(PORT, '0.0.0.0', () => console.log(`Karen AI API listening on ${PORT}`));
