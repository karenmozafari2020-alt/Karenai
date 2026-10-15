# Karen AI API — راه‌اندازی با گوشی

## ۱) فایل‌ها را در GitHub بگذار
محتویات ZIP را در ریشهٔ یک مخزن GitHub قرار بده: `server.js` و `package.json`.

## ۲) روی Render بساز
Render Dashboard → New → Web Service → مخزن را انتخاب کن.
- Build Command: `npm install`
- Start Command: `npm start`
- پلن: Free (اگر در حساب تو موجود است)

## ۳) متغیرهای محرمانه در Render
در سرویس → Environment → Add Environment Variable:
- `CF_ACCOUNT_ID` = Account ID از Cloudflare
- `CF_API_TOKEN` = توکن Cloudflare با مجوز اجرای Workers AI (نگهش دار؛ در HTML یا GitHub نگذار)
- `CF_AI_MODEL` = `@cf/meta/llama-3.1-8b-instruct` (در صورت عدم دسترسی، شناسهٔ مدل فعال در کاتالوگ Cloudflare را جایگزین کن)
- `ALLOWED_ORIGIN` = دامنهٔ سایت Karen، مثلاً `https://YOUR-USERNAME.github.io`؛ برای آزمایش می‌توانی موقتاً حذفش کنی.
بعد Save and deploy را بزن.

## ۴) آزمایش
باز کن: `https://YOUR-SERVICE.onrender.com/health`
باید JSON با `ok:true` و `configured:true` ببینی.
برای چت، درخواست POST به `/api/chat` با JSON مثل `{"message":"سلام، چرا آسمان آبی است؟"}` بفرست.

## ۵) اتصال به HTML
در فایل HTML، آدرس API باید شبیه این باشد:
`https://YOUR-SERVICE.onrender.com/api/chat`
در مرورگر باید `fetch(API_URL, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({message:q, history:[]})})` اجرا شود.

## مهم
- سهمیهٔ رایگان و مدل‌های در دسترس ممکن است تغییر کنند؛ استفادهٔ رایگان نامحدود نیست.
- دسترسی از ایران تضمین‌شده نیست؛ پس از Deploy، `/health` و سپس یک پیام واقعی را آزمایش کن.
- سرویس رایگان Render ممکن است پس از بی‌فعالیتی به خواب برود.
