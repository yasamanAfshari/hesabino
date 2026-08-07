// ===== فرمت‌دهی خودکار اینپوت‌های عددی (type="number") توی کل اپ =====
// هر اینپوتی که type="number" داره، در لحظه‌ی لود صفحه به یه اینپوت متنی تبدیل می‌شه که:
//   ۱) مقدار اولیه نداره (فقط placeholder)
//   ۲) موقع تایپ، هر سه رقم با کاما جدا می‌شه (مثلاً ۳,۰۰۰,۰۰۰)
//   ۳) زیرش عدد رو به حروف فارسی می‌نویسه (مثلاً «سه میلیون تومان»)
//
// واحدِ زیرنویس پیش‌فرض «تومان»‌ه؛ برای اینپوت‌هایی که مبلغ پول نیستن (مثل تعداد قسط یا روز)
// با data-unit="واحد دلخواه" رو input ست می‌شه (data-unit="" یعنی بدون واحد، فقط عدد به حروف).
//
// نکته‌ی مهم برای بقیه‌ی فایل‌های جاوااسکریپت پروژه: چون اینپوت الان type="text" هست و مقدارش
// با کاما نمایش داده می‌شه، هر جای دیگه‌ای که می‌خواد این مقدار رو به عدد تبدیل کنه (Number(...))
// باید اول از AmountInput.parse() رد بشه تا کاماها حذف بشن.
(function () {
  'use strict';

  const WIRED_ATTR = 'data-amount-wired';

  // ===== تبدیل ارقام فارسی/عربی به انگلیسی =====
  function toEnglishDigits(str) {
    const persian = '۰۱۲۳۴۵۶۷۸۹';
    const arabic = '٠١٢٣٤٥٦٧٨٩';
    return String(str || '')
      .replace(/[۰-۹]/g, (d) => String(persian.indexOf(d)))
      .replace(/[٠-٩]/g, (d) => String(arabic.indexOf(d)));
  }

  function toPersianDigits(str) {
    const digits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return String(str).replace(/[0-9]/g, (d) => digits[+d]);
  }

  // ===== حذف هرچیزی جز رقم؛ خروجی یه رشته‌ی رقمیِ خالص (بدون کاما) برای Number(...) =====
  function parse(value) {
    return toEnglishDigits(value).replace(/[^\d]/g, '');
  }

  function group(digitsOnly) {
    if (!digitsOnly) return '';
    return Number(digitsOnly).toLocaleString('en-US');
  }

  // ===== عدد به حروف فارسی (تا کوادریلیون، برای مبالغ تومانی به‌مراتب کافیه) =====
  const ONES = ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه'];
  const TEENS = ['ده', 'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده', 'هفده', 'هجده', 'نوزده'];
  const TENS = ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'];
  const HUNDREDS = ['', 'صد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد'];
  const SCALES = ['', 'هزار', 'میلیون', 'میلیارد', 'تریلیون', 'کوادریلیون'];

  function threeDigitsToWords(num) {
    const parts = [];
    const h = Math.floor(num / 100);
    const rem = num % 100;
    if (h) parts.push(HUNDREDS[h]);
    if (rem >= 10 && rem < 20) {
      parts.push(TEENS[rem - 10]);
    } else {
      const t = Math.floor(rem / 10);
      const o = rem % 10;
      if (t) parts.push(TENS[t]);
      if (o) parts.push(ONES[o]);
    }
    return parts.join(' و ');
  }

  function numberToPersianWords(input) {
    const num = Math.floor(Math.abs(Number(input) || 0));
    if (num === 0) return 'صفر';
    if (num > 999999999999999) return toPersianDigits(String(num)); // خارج از بازه‌ی پشتیبانی‌شده

    const groups = [];
    let n = num;
    while (n > 0) {
      groups.unshift(n % 1000);
      n = Math.floor(n / 1000);
    }

    const offset = groups.length - 1;
    const parts = [];
    groups.forEach((g, i) => {
      if (!g) return;
      const scaleIdx = offset - i;
      if (scaleIdx === 1 && g === 1) {
        parts.push(SCALES[1]); // «هزار» به‌جای «یک هزار»
        return;
      }
      const words = threeDigitsToWords(g);
      parts.push(scaleIdx > 0 ? `${words} ${SCALES[scaleIdx]}` : words);
    });

    return parts.join(' و ');
  }

  function hintText(input, digitsOnly) {
    const unit = input.hasAttribute('data-unit') ? input.getAttribute('data-unit') : 'تومان';
    const words = numberToPersianWords(digitsOnly || 0);
    return unit ? `${words} ${unit}` : words;
  }

  function ensureHintEl(input) {
    let hint = input.nextElementSibling;
    if (!hint || !hint.classList || !hint.classList.contains('amount-words-hint')) {
      hint = document.createElement('div');
      hint.className = 'amount-words-hint text-xs text-gray-400 mt-1 min-h-[1em]';
      input.insertAdjacentElement('afterend', hint);
    }
    return hint;
  }

  // ===== یک اینپوت رو با مقدار فعلیِ خودش (که ممکنه از بیرون ست شده باشه) دوباره فرمت می‌کنه =====
  function refresh(input) {
    if (!input) return;
    const digitsOnly = parse(input.value);
    input.value = group(digitsOnly);
    const hint = ensureHintEl(input);
    hint.textContent = hintText(input, digitsOnly);
  }

  // ===== همه‌ی اینپوت‌های عددیِ فرمت‌شده‌ی داخل یه ظرف (مودال/فرم/کل صفحه) رو رفرش می‌کنه =====
  // بعد از form.reset() یا پرکردن دستیِ مقادیر (حالت ویرایش) صدا زده می‌شه
  function refreshForm(container) {
    const scope = container || document;
    scope.querySelectorAll(`[${WIRED_ATTR}]`).forEach(refresh);
  }

  function wire(input) {
    if (input.hasAttribute(WIRED_ATTR)) return;
    input.setAttribute(WIRED_ATTR, '1');
    input.setAttribute('type', 'text');
    input.setAttribute('inputmode', 'numeric');
    input.setAttribute('autocomplete', 'off');
    input.value = ''; // بدون مقدار اولیه؛ فقط placeholder

    const hint = ensureHintEl(input);
    hint.textContent = hintText(input, '');

    input.addEventListener('input', () => {
      const cursorFromEnd = input.value.length - (input.selectionEnd || input.value.length);
      const digitsOnly = parse(input.value);
      const grouped = group(digitsOnly);
      input.value = grouped;
      const pos = Math.max(0, grouped.length - cursorFromEnd);
      try { input.setSelectionRange(pos, pos); } catch (e) { /* برای برخی مرورگرها لازم نیست */ }
      ensureHintEl(input).textContent = hintText(input, digitsOnly);
    });
  }

  function init() {
    document.querySelectorAll('input[type="number"]').forEach(wire);
  }

  window.AmountInput = { parse, refresh, refreshForm, toWords: numberToPersianWords };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
