// ابزارهای کوچک برای کار با تاریخ شمسی و ارقام فارسی/عربی، بدون نیاز به پکیج خارجی.

// ارقام فارسی/عربی داخل رشته رو به ارقام انگلیسی تبدیل می‌کنه، تا بشه تاریخ‌های
// ذخیره‌شده (که ممکنه با ارقام فارسی وارد شده باشن) رو با هم مقایسه کرد.
export function toEnglishDigits(input: string): string {
  const persian = '۰۱۲۳۴۵۶۷۸۹';
  const arabic = '٠١٢٣٤٥٦٧٨٩';
  return String(input || '')
    .replace(/[۰-۹]/g, (d) => String(persian.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(arabic.indexOf(d)));
}

// عکس عملیات بالا: ارقام انگلیسی داخل رشته رو به ارقام فارسی تبدیل می‌کنه.
// برای این لازمه که در کوئری‌های دیتابیس بتونیم هر دو حالت ممکن ذخیره‌شده
// (ارقام انگلیسی یا فارسی) رو با یک پیشوند ماه فیلتر کنیم.
export function toPersianDigits(input: string): string {
  const persian = '۰۱۲۳۴۵۶۷۸۹';
  return String(input || '').replace(/[0-9]/g, (d) => persian[Number(d)]);
}

// تبدیل تاریخ میلادی به سال/ماه شمسی (الگوریتم استاندارد تبدیل جلالی، بدون کتابخانه‌ی خارجی)
function gregorianToJalali(gy: number, gm: number, gd: number): [number, number, number] {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = gy <= 1600 ? 0 : 979;
  gy -= gy <= 1600 ? 621 : 1600;
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days =
    365 * gy +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) -
    80 +
    gd +
    g_d_m[gm - 1];
  jy += 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = days < 186 ? 1 + (days % 31) : 1 + ((days - 186) % 30);
  return [jy, jm, jd];
}

// کلید ماه جاری شمسی به فرمت «YYYY/MM» (با ارقام انگلیسی)، مثلاً «1403/02»
export function currentJalaliMonthKey(date: Date = new Date()): string {
  const [jy, jm] = gregorianToJalali(date.getFullYear(), date.getMonth() + 1, date.getDate());
  return `${jy}/${String(jm).padStart(2, '0')}`;
}

// تاریخ شمسی جاری به صورت اجزای عددی { y, m, d }
export function currentJalaliDate(date: Date = new Date()): { y: number; m: number; d: number } {
  const [jy, jm, jd] = gregorianToJalali(date.getFullYear(), date.getMonth() + 1, date.getDate());
  return { y: jy, m: jm, d: jd };
}

// تجزیه‌ی یک رشته‌ی تاریخ شمسی (با هر ترکیبی از ارقام فارسی/انگلیسی و جداکننده‌ی «/» یا «-»)
// به اجزای عددی. اگر فرمت نامعتبر باشه null برمی‌گردونه.
export function parseJalaliDate(input: string): { y: number; m: number; d: number } | null {
  if (!input) return null;
  const normalized = toEnglishDigits(input).trim();
  const match = normalized.match(/^(\d{3,4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (!match) return null;
  const [, y, m, d] = match;
  return { y: Number(y), m: Number(m), d: Number(d) };
}

// تعداد ماه‌های فاصله بین دو تاریخ شمسی (to منهای from)، فقط بر اساس سال/ماه
export function monthsBetween(
  from: { y: number; m: number },
  to: { y: number; m: number },
): number {
  return (to.y - from.y) * 12 + (to.m - from.m);
}
