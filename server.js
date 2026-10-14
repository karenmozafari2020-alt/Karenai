const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json({ limit: '32kb' }));

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = process.env.OPENROUTER_MODEL || 'openrouter/free';

app.get('/', (_req, res) => res.type('text').send('Karen AI API is running.'));
app.get('/health', (_req, res) => res.json({ ok: true, service: 'Karen AI API' }));
app.post('/api/chat', async (req, res) => {
  try {
    if (!API_KEY) return res.status(503).json({ error: 'کلید API در تنظیمات سرور ثبت نشده است.' });
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (!message) return res.status(400).json({ error: 'پیام خالی است.' });
    if (message.length > 8000) return res.status(413).json({ error: 'پیام خیلی طولانی است.' });
    const history = Array.isArray(req.body.history) ? req.body.history.slice(-14) : [];
    const messages = [
      { role: 'system', content: 'تو Karen AI هستی، یک دستیار مفید و دوستانه. به فارسی روان پاسخ بده مگر کاربر زبان دیگری بخواهد. سؤال را مستقیم و با جزئیات کافی پاسخ بده؛ اگر اطلاعات کافی نداری صادقانه بگو. برای ریاضی مراحل را روشن توضیح بده. پاسخ‌ها را بی‌دلیل کوتاه نکن و ادعای دسترسی به اینترنت یا اطلاعات زنده نداشته باش مگر ابزارش فراهم باشد. از محتوای خطرناک یا نامناسب برای نوجوانان خودداری کن.' },
      ...history.filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .map(m => ({ role: m.role, content: m.content.slice(0, 5000) })),
    ];
    if (!messages.some(m => m.role === 'user' && m.content === message)) messages.push({ role: 'user', content: message });
    const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json', 'X-Title': 'Karen AI' },
      body: JSON.stringify({ model: MODEL, messages, temperature: 0.7, max_tokens: 900 })
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error('Provider error:', upstream.status, data?.error?.message || 'unknown');
      return res.status(502).json({ error: 'سرویس هوش مصنوعی فعلاً پاسخ نداد. ممکن است سهمیهٔ رایگان تمام شده باشد یا مدل در دسترس نباشد.' });
    }
    const reply = data?.choices?.[0]?.message?.content;
    if (!reply) return res.status(502).json({ error: 'پاسخ خالی از سرویس دریافت شد.' });
    res.json({ reply: typeof reply === 'string' ? reply : JSON.stringify(reply) });
  } catch (e) {
    console.error('API error:', e.message);
    res.status(500).json({ error: 'خطای داخلی سرور.' });
  }
});
app.listen(PORT, () => console.log(`Karen AI API listening on ${PORT}`));
