/**
 * توجه: این پروژه از Tailwind CSS v4 استفاده می‌کنه که رنگ‌ها و توکن‌های
 * تم رو از بلوک @theme داخل public/css/input.css می‌خونه (نگاه کنید به
 * public/css/global.css برای override های تم تیره و رنگ‌های تاکیدی).
 *
 * این فایل توسط ابزار build فعلی (`tailwindcss -i input.css -o output.css`)
 * خونده نمی‌شه مگر با دایرکتیو @config در input.css که استفاده نشده؛ فقط
 * برای content globs (اگر در آینده به @config وصل بشه) نگه داشته شده تا
 * رنگ‌های قدیمی و ناهماهنگ حذف بشن و به‌جاش به منبع واحد رنگ ارجاع بدیم.
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./views/**/*.ejs",
    "./public/**/*.html",
    "./src/**/*.ts",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
