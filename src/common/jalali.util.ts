// ابزارهای مشترک تاریخ شمسی/ارقام فارسی، برای ماژول‌های جدید (دارایی‌ها، اشتراک‌ها،
// اقساط، چالش‌ها و داشبورد). عمداً مستقل از budget/date.util.ts و debts/date.util.ts
// نگه داشته شده تا فایل‌های موجود دست‌نخورده بمانند.

export function toEnglishDigits(input: string): string {
  const persian = '۰۱۲۳۴۵۶۷۸۹';
  const arabic = '٠١٢٣٤٥٦٧٨٩';
  return String(input || '')
    .replace(/[۰-۹]/g, (d) => String(persian.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(arabic.indexOf(d)));
}

export function toPersianDigits(input: string | number): string {
  const persian = '۰۱۲۳۴۵۶۷۸۹';
  return String(input ?? '').replace(/[0-9]/g, (d) => persian[Number(d)]);
}

// تبدیل میلادی به جلالی (الگوریتم استاندارد)
export function gregorianToJalali(gy: number, gm: number, gd: number): [number, number, number] {
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

// تبدیل جلالی به میلادی (الگوریتم استاندارد)
export function jalaliToGregorian(jy: number, jm: number, jd: number): Date {
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

export function currentJalaliDate(date: Date = new Date()): { y: number; m: number; d: number } {
  const [jy, jm, jd] = gregorianToJalali(date.getFullYear(), date.getMonth() + 1, date.getDate());
  return { y: jy, m: jm, d: jd };
}

export function currentJalaliMonthKey(date: Date = new Date()): string {
  const { y, m } = currentJalaliDate(date);
  return `${y}/${String(m).padStart(2, '0')}`;
}

export function todayJalaliString(date: Date = new Date()): string {
  const { y, m, d } = currentJalaliDate(date);
  return `${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
}

export function parseJalaliDate(input: string): { y: number; m: number; d: number } | null {
  if (!input) return null;
  const normalized = toEnglishDigits(input).trim();
  const match = normalized.match(/^(\d{3,4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (!match) return null;
  const [, y, m, d] = match;
  return { y: Number(y), m: Number(m), d: Number(d) };
}

// نرمال‌سازی به «YYYY/MM/DD» با صفرهای پیشین، برای مقایسه/مرتب‌سازی متنی صحیح
export function normalizeJalaliDate(input: string): string | null {
  const parsed = parseJalaliDate(input);
  if (!parsed) return null;
  return `${parsed.y}/${String(parsed.m).padStart(2, '0')}/${String(parsed.d).padStart(2, '0')}`;
}

export function monthsBetween(
  from: { y: number; m: number },
  to: { y: number; m: number },
): number {
  return (to.y - from.y) * 12 + (to.m - from.m);
}

// تعداد روزهای باقی‌مانده تا یک تاریخ شمسی (منفی یعنی گذشته)
export function remainingDaysUntil(dueDateStr: string, from: Date = new Date()): number | null {
  const parsed = parseJalaliDate(dueDateStr);
  if (!parsed) return null;

  const due = jalaliToGregorian(parsed.y, parsed.m, parsed.d);
  due.setHours(0, 0, 0, 0);

  const today = new Date(from);
  today.setHours(0, 0, 0, 0);

  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

// تعداد روزهای بین دو تاریخ شمسی (to منهای from)، مثبت یعنی to بعد از from است
export function daysBetweenJalali(from: string, to: string): number | null {
  const f = parseJalaliDate(from);
  const t = parseJalaliDate(to);
  if (!f || !t) return null;
  const fromDate = jalaliToGregorian(f.y, f.m, f.d);
  const toDate = jalaliToGregorian(t.y, t.m, t.d);
  fromDate.setHours(0, 0, 0, 0);
  toDate.setHours(0, 0, 0, 0);
  return Math.round((toDate.getTime() - fromDate.getTime()) / 86400000);
}

// تعداد روزهای ماه شمسی مشخص (با تبدیل به میلادی برای دقت در سال کبیسه)
export function daysInJalaliMonth(y: number, m: number): number {
  const start = jalaliToGregorian(y, m, 1);
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const end = jalaliToGregorian(nextY, nextM, 1);
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

// یک ماه شمسی جلو می‌برد (برای محاسبه‌ی سررسید بعدی اقساط/اشتراک‌ها)
export function addOneJalaliMonth(y: number, m: number, d: number): { y: number; m: number; d: number } {
  let ny = y;
  let nm = m + 1;
  if (nm > 12) {
    nm = 1;
    ny += 1;
  }
  const nextDim = daysInJalaliMonth(ny, nm);
  return { y: ny, m: nm, d: Math.min(d, nextDim) };
}

export function formatJalali(y: number, m: number, d: number): string {
  return `${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
}

// نام فارسی روز هفته برای یک تاریخ میلادی (برای «پرخرج‌ترین روز هفته» در تحلیل رفتار خرج)
const WEEKDAY_NAMES_FA = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];
export function weekdayNameFromJalali(dateStr: string): string | null {
  const parsed = parseJalaliDate(dateStr);
  if (!parsed) return null;
  const g = jalaliToGregorian(parsed.y, parsed.m, parsed.d);
  return WEEKDAY_NAMES_FA[g.getDay()];
}
