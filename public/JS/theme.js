/**
 * مدیریت متمرکز تم روشن/تیره و رنگ تأکیدی (accent)
 * تمام مقادیر متغیرهای CSS مستقیماً با جاوااسکریپت تنظیم می‌شوند.
 * دیگر نیازی به قانون‌های html.dark-theme یا [data-accent] در CSS نیست.
 */
(function () {
  'use strict';

  const THEME_KEY = 'hesabino:theme';
  const ACCENT_KEY = 'hesabino:accent';
  const VALID_THEMES = ['light', 'dark'];
  const VALID_ACCENTS = ['blue', 'green', 'purple', 'orange'];
  const root = document.documentElement;

  /* ================================================================
     مقادیر رنگ‌ها برای هر بخش
     ================================================================ */

  // رنگ‌های پایه در حالت روشن (اختیاری – فقط برای پاک‌سازی کامل می‌توانید
  // از همین شیء استفاده کنید، ولی ما از removeProperty استفاده می‌کنیم
  // تا مقادیر @theme دوباره فعال شوند.)
  const LIGHT_BASE = {
    // می‌توانید خالی بگذارید، چون @theme آن‌ها را تأمین می‌کند.
  };

  // رنگ‌های پایه در حالت تاریک
  const DARK_BASE = {
    '--color-back-color': '#303030',
    '--color-main-color': '#262728',
    '--color-main-color-hover': '#4FA8E6',
    '--color-main-color-25': '#2e8fd640',
    '--color-green-color': '#22C55E',
    '--color-green-color-25': '#22C55E40',
    '--color-red-color': '#F87171',
    '--color-red-color-25': '#F8717140',
    '--color-orange-color': '#FB923C',
    '--color-orange-color-25': '#FB923C40',
    '--color-purple-color': '#A78BFA',
    '--color-purple-color-25': '#A78BFA40',
    '--color-green2-color': '#5EEAD4',
    '--color-green2-color-25': '#5EEAD440',
    '--color-yellow-color-20': 'rgba(250, 204, 21, 0.18)',
    '--color-surface-color': '#3a3c3d',
    '--color-surface2-color': '#303640',
    '--color-border-color': '#33415A',
    '--color-text-color': '#E5E7EB',
    '--color-text2-color': '#94A3B8',
    // بازنویسی پالت خنثی تیلویند (white/gray/zinc)
    '--color-white': '#3a3c3d',
    '--color-gray-50': '#1A2332',
    '--color-gray-100': '#212D3F',
    '--color-gray-200': '#2D3B50',
    '--color-gray-300': '#45566E',
    '--color-gray-400': '#93A4BA',
    '--color-gray-500': '#9FB0C3',
    '--color-gray-600': '#B7C4D6',
    '--color-gray-700': '#E2E8F0',
    '--color-gray-800': '#F1F5F9',
    '--color-gray-900': '#FFFFFF',
    '--color-gray-950': '#FFFFFF',
    '--color-zinc-50': '#1A2332',
    '--color-zinc-100': '#212D3F',
    '--color-zinc-200': '#2D3B50',
    '--color-zinc-300': '#45566E',
    '--color-zinc-400': '#93A4BA',
    '--color-zinc-500': '#9FB0C3',
    '--color-zinc-600': '#B7C4D6',
    '--color-zinc-700': '#E2E8F0',
    '--color-zinc-800': '#F1F5F9',
    '--color-zinc-900': '#FFFFFF',
    '--color-zinc-950': '#FFFFFF',
  };

  // رنگ‌های تأکیدی (accent) در حالت روشن
  const ACCENT_LIGHT = {
    green: {
      '--color-main-color': '#0E9F6E',
      '--color-main-color-hover': '#12B981',
      '--color-main-color-25': '#0E9F6E40',
    },
    purple: {
      '--color-main-color': '#7C3AED',
      '--color-main-color-hover': '#9061F9',
      '--color-main-color-25': '#7C3AED40',
    },
    orange: {
      '--color-main-color': '#EA580C',
      '--color-main-color-hover': '#F97316',
      '--color-main-color-25': '#EA580C40',
    },
    blue: {
      // آبی همان رنگ برند پیش‌فرض است، نیاز به override ندارد
    },
  };

  // رنگ‌های تأکیدی در حالت تاریک
  const ACCENT_DARK = {
    green: {
      '--color-main-color': '#34D399',
      '--color-main-color-hover': '#6EE7B7',
      '--color-main-color-25': '#34D39940',
    },
    purple: {
      '--color-main-color': '#A78BFA',
      '--color-main-color-hover': '#C4B5FD',
      '--color-main-color-25': '#A78BFA40',
    },
    orange: {
      '--color-main-color': '#FB923C',
      '--color-main-color-hover': '#FDBA74',
      '--color-main-color-25': '#FB923C40',
    },
    blue: {
      // در تم تاریک، خود DARK_BASE رنگ آبی را override کرده
    },
  };

  /* ================================================================
     توابع کمکی برای اعمال / حذف متغیرها
     ================================================================ */

  function applyProperties(properties) {
    Object.entries(properties).forEach(([prop, value]) => {
      root.style.setProperty(prop, value);
    });
  }

  function removeProperties(properties) {
    Object.keys(properties).forEach((prop) => {
      root.style.removeProperty(prop);
    });
  }

  /* ================================================================
     اعمال نهایی رنگ‌ها با توجه به تم و accent
     ================================================================ */
  function applyColors(theme, accent) {
    // 1. ابتدا همه‌ی متغیرهایی که ممکن است قبلاً توسط ما تنظیم شده باشند را پاک می‌کنیم.
    //    (مجموعه‌ی تمام کلیدهایی که در حالت تاریک یا اکسنت‌ها دستکاری می‌کنیم)
    const allKeys = new Set([
      ...Object.keys(DARK_BASE),
      ...Object.keys(ACCENT_LIGHT.green || {}),
      ...Object.keys(ACCENT_LIGHT.purple || {}),
      ...Object.keys(ACCENT_LIGHT.orange || {}),
      ...Object.keys(ACCENT_LIGHT.blue || {}),
      ...Object.keys(ACCENT_DARK.green || {}),
      ...Object.keys(ACCENT_DARK.purple || {}),
      ...Object.keys(ACCENT_DARK.orange || {}),
      ...Object.keys(ACCENT_DARK.blue || {}),
    ]);
    removeProperties(Object.fromEntries([...allKeys].map(k => [k, ''])));

    // 2. اگر تم تاریک است، مقادیر پایه تاریک را اعمال کن
    if (theme === 'dark') {
      applyProperties(DARK_BASE);
    }

    // 3. اعمال رنگ تأکیدی (همیشه، چون حتی در حالت روشن ممکن است main-color عوض شود)
    const accentColors =
      theme === 'dark'
        ? ACCENT_DARK[accent] || {}
        : ACCENT_LIGHT[accent] || {};
    applyProperties(accentColors);
  }

  /* ================================================================
     توابع عمومی setTheme / setAccent
     ================================================================ */
  function setTheme(theme) {
    if (!VALID_THEMES.includes(theme)) return;

    // به‌روزرسانی کلاس dark-theme روی html (برای color-scheme و ...)
    root.classList.toggle('dark-theme', theme === 'dark');

    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (e) { /* localStorage در دسترس نیست */ }

    const accent = getStoredAccent();
    applyColors(theme, accent);

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

    try {
      localStorage.setItem(ACCENT_KEY, accent);
    } catch (e) { /* localStorage در دسترس نیست */ }

    const theme = root.classList.contains('dark-theme') ? 'dark' : 'light';
    applyColors(theme, accent);

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
    const currentAccent = getStoredAccent();
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
    // اگر main.ejs از قبل کلاس dark-theme را تنظیم کرده، آن را می‌خوانیم
    const currentTheme = root.classList.contains('dark-theme') ? 'dark' : getStoredTheme();
    const currentAccent = root.getAttribute('data-accent') || getStoredAccent();

    // اعمال اولیه (کلاس و متغیرها)
    root.classList.toggle('dark-theme', currentTheme === 'dark');
    root.setAttribute('data-accent', currentAccent);
    applyColors(currentTheme, currentAccent);

    syncThemeToggles(currentTheme);
    syncAccentSwatches();
    bindEvents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // API عمومی
  window.HesabinoTheme = {
    setTheme,
    toggleTheme,
    setAccent,
    getTheme: () => (root.classList.contains('dark-theme') ? 'dark' : 'light'),
    getAccent: () => root.getAttribute('data-accent') || 'blue',
  };
})();