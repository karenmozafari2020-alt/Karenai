# Karen AI API (رایگان برای شروع)

## 1) ساخت کلید
در OpenRouter حساب بساز و یک API key ایجاد کن. کلید را فقط در تنظیمات سرور Render ذخیره کن؛ هرگز داخل HTML یا پیام عمومی قرار نده. مدل `openrouter/free` از مدل‌های رایگانِ موجود انتخاب می‌کند. سهمیه و دسترسی مدل‌ها ممکن است تغییر کند؛ پلن رایگان ممکن است محدودیت روزانه داشته باشد.

## 2) انتشار روی Render
1. این پوشه را در یک مخزن GitHub آپلود کن.
2. در Render یک Web Service از همان مخزن بساز.
3. Build Command: `npm install` و Start Command: `npm start`
4. در Environment Variables مقدار `OPENROUTER_API_KEY` را کلید خودت بگذار. `OPENROUTER_MODEL` را روی `openrouter/free` بگذار.
5. پس از Deploy، آدرس `https://نام-سرویس.onrender.com/health` باید JSON با `ok: true` نشان دهد.

## 3) اتصال HTML
در فایل `Karen_AI_2.1_API.html` عبارت `https://YOUR-KAREN-AI-API.onrender.com/api/chat` را با آدرس سرویس خودت + `/api/chat` جایگزین کن. بعد فایل را باز کن.

## نکته‌ها
- سرور کلید را در مرورگر فاش نمی‌کند.
- سرویس‌های رایگان محدودیت دارند و ممکن است گاهی کند یا در دسترس نباشند.
- تاریخچهٔ مکالمه از مرورگر ارسال می‌شود؛ پیام‌های خصوصی یا اطلاعات حساس وارد نکن.
