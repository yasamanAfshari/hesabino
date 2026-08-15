
(function () {
  'use strict';

  const THEME_KEY = 'hesabino:theme';
  const ACCENT_KEY = 'hesabino:accent';
  const VALID_THEMES = ['light', 'dark'];
  const VALID_ACCENTS = ['blue', 'green', 'purple', 'orange'];
  const root = document.documentElement;

  /* ================================================================
     منبع واحد رنگ‌ها: CSS
     ================================================================
     همه‌ی مقادیر رنگی (تم روشن/تیره + رنگ تاکیدی) فقط و فقط داخل
     public/css/global.css تعریف می‌شن (بلوک‌های html.dark-theme و
     html[data-accent="..."]). این فایل هیچ رنگی را مستقیم روی style
     المان تنظیم نمی‌کنه؛ فقط کلاس dark-theme و اتریبیوت data-accent
     را روی <html> عوض می‌کنه تا سلکتورهای CSS فعال/غیرفعال بشن.

     دلیل مهم: استایل inline (root.style.setProperty) همیشه روی هر
     قانون CSS مبتنی بر سلکتور اولویت داره، حتی اگر بعداً در CSS مقدار
     درستی برای یک حالت خاص (مثلاً تم تیره + اکسنت نارنجی) تعریف بشه.
     نگه‌داشتن دو منبع مجزا (یکی در جاوااسکریپت، یکی در CSS) باعث
     ناهماهنگی و باگ‌های عجیب موقع تغییر تم/رنگ می‌شد؛ برای همینه که
     همه‌چیز اینجا حذف و به CSS منتقل شده.
     ================================================================ */

  function setTheme(theme) {
    if (!VALID_THEMES.includes(theme)) return;

    root.classList.toggle('dark-theme', theme === 'dark');

    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (e) { /* localStorage در دسترس نیست */ }

    syncThemeToggles(theme);
    syncAccentSwatches();
    document.dispatchEvent(new CustomEvent('hesabino:theme-changed', { detail: { theme } }));
  }

  function toggleTheme() {
    const current = root.classList.contains('dark-theme') ? 'dark' : 'light';
    setTheme(current === 'dark' ? 'light' : 'dark');
  }

  function setAccent(accent) {
    if (!VALID_ACCENTS.includes(accent)) return;

    root.setAttribute('data-accent', accent);

    try {
      localStorage.setItem(ACCENT_KEY, accent);
    } catch (e) { /* localStorage در دسترس نیست */ }

    syncAccentSwatches();
    document.dispatchEvent(new CustomEvent('hesabino:accent-changed', { detail: { accent } }));
  }

  /* ================================================================
     هماهنگ‌سازی دکمه‌ها و سواچ‌ها
     ================================================================ */
  function syncThemeToggles(theme) {
    document.querySelectorAll('.theme-toggle').forEach((btn) => {
      btn.classList.toggle('dark', theme === 'dark');
      btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
    });
  }

  function syncAccentSwatches() {
    const currentAccent = root.getAttribute('data-accent') || getStoredAccent();
    document.querySelectorAll('[data-accent-option]').forEach((el) => {
      const isActive = el.getAttribute('data-accent-option') === currentAccent;
      el.classList.toggle('accent-swatch-active', isActive);
      el.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  /* ================================================================
     مقدارخوانی از localStorage
     ================================================================ */
  function getStoredTheme() {
    try {
      const value = localStorage.getItem(THEME_KEY);
      return VALID_THEMES.includes(value) ? value : 'light';
    } catch (e) {
      return 'light';
    }
  }

  function getStoredAccent() {
    try {
      const value = localStorage.getItem(ACCENT_KEY);
      return VALID_ACCENTS.includes(value) ? value : 'blue';
    } catch (e) {
      return 'blue';
    }
  }

  /* ================================================================
     رویدادها و راه‌اندازی اولیه
     ================================================================ */
  function bindEvents() {
    document.addEventListener('click', (e) => {
      const toggleBtn = e.target.closest('.theme-toggle');
      if (toggleBtn) {
        toggleTheme();
        return;
      }
      const swatch = e.target.closest('[data-accent-option]');
      if (swatch) {
        setAccent(swatch.getAttribute('data-accent-option'));
      }
    });
  }

  function init() {
    // اگر main.ejs از قبل کلاس dark-theme و data-accent را تنظیم کرده
    // (اسکریپت ضد چشمک‌زدن در <head>)، همون‌ها رو معتبر می‌دونیم؛ در غیر
    // این صورت از localStorage می‌خونیم.
    const currentTheme = root.classList.contains('dark-theme') ? 'dark' : getStoredTheme();
    const currentAccent = root.getAttribute('data-accent') || getStoredAccent();

    root.classList.toggle('dark-theme', currentTheme === 'dark');
    root.setAttribute('data-accent', currentAccent);

    syncThemeToggles(currentTheme);
    syncAccentSwatches();
    bindEvents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.HesabinoTheme = {
    setTheme,
    toggleTheme,
    setAccent,
    getTheme: () => (root.classList.contains('dark-theme') ? 'dark' : 'light'),
    getAccent: () => root.getAttribute('data-accent') || 'blue',
  };
})();
