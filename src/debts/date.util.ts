// ابزار تبدیل تاریخ شمسی، مخصوص محاسبه‌ی «روزهای باقی‌مانده» و تشخیص سررسید گذشته.

// ارقام فارسی/عربی داخل رشته رو به ارقام انگلیسی تبدیل می‌کنه.
export function toEnglishDigits(input: string): string {
  const persian = '۰۱۲۳۴۵۶۷۸۹';
  const arabic = '٠١٢٣٤٥٦٧٨٩';
  return String(input || '')
    .replace(/[۰-۹]/g, (d) => String(persian.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(arabic.indexOf(d)));
}

// تجزیه‌ی یک رشته‌ی تاریخ شمسی (هر ترکیبی از ارقام فارسی/انگلیسی، جداکننده‌ی «/» یا «-»)
export function parseJalaliDate(input: string): { y: number; m: number; d: number } | null {
  if (!input) return null;
  const normalized = toEnglishDigits(input).trim();
  const match = normalized.match(/^(\d{3,4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (!match) return null;
  const [, y, m, d] = match;
  return { y: Number(y), m: Number(m), d: Number(d) };
}

// نرمال‌سازی تاریخ شمسی به فرمت یکسان «YYYY/MM/DD» با ارقام انگلیسی، برای مرتب‌سازی/مقایسه‌ی متنی صحیح.
export function normalizeJalaliDate(input: string): string | null {
  const parsed = parseJalaliDate(input);
  if (!parsed) return null;
  return `${parsed.y}/${String(parsed.m).padStart(2, '0')}/${String(parsed.d).padStart(2, '0')}`;
}

// تبدیل تاریخ شمسی به میلادی (الگوریتم استاندارد تبدیل جلالی، بدون کتابخانه‌ی خارجی)
function jalaliToGregorian(jy: number, jm: number, jd: number): Date {
  jy += 1595;
  let days =
    -355668 +
    365 * jy +
    Math.floor(jy / 33) * 8 +
    Math.floor(((jy % 33) + 3) / 4) +
    jd +
    (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);

  let gy = 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let gd = days + 1;
  const isLeap = (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0;
  const monthDays = [0, 31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 0;
  for (gm = 1; gm < 13; gm++) {
    if (gd <= monthDays[gm]) break;
    gd -= monthDays[gm];
  }
  return new Date(gy, gm - 1, gd);
}

// تعداد روزهای باقی‌مانده تا تاریخ سررسید (منفی یعنی سررسید گذشته)؛ اگر تاریخ نامعتبر باشه null برمی‌گردونه.
export function remainingDaysUntil(dueDateStr: string, from: Date = new Date()): number | null {
  const parsed = parseJalaliDate(dueDateStr);
  if (!parsed) return null;

  const due = jalaliToGregorian(parsed.y, parsed.m, parsed.d);
  due.setHours(0, 0, 0, 0);

  const today = new Date(from);
  today.setHours(0, 0, 0, 0);

  return Math.round((due.getTime() - today.getTime()) / 86400000);
}
