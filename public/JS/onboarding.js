/**
 * مودال «افزودن اولین حساب»
 * -------------------------------------------------------------------------
 * تا وقتی کاربر حداقل یک حساب نساخته، این مودال روی هر صفحه‌ای (فارغ از
 * اینکه داشبورد باشه یا هر صفحه‌ی دیگه) نمایش داده می‌شه و راهی برای
 * بستنش بدون تکمیل فرم وجود نداره.
 *
 * بررسیِ «آیا کاربر حساب داره یا نه» خیلی زودتر (داخل main.ejs، هم‌زمان با
 * لود شدن صفحه) شروع می‌شه تا وقتی page-loader محو می‌شه، جواب آماده باشه؛
 * این‌طوری محتوای داشبورد هیچ‌وقت قبل از این مودال به کاربر دیده نمی‌شه.
 */
(function () {
  'use strict';

  var HB = (window.HesabinoOnboarding = window.HesabinoOnboarding || {});
  var API_BASE = '/api';
  var overlayEl = null;
  var currentStep = 1;
  var TOTAL_STEPS = 3;

  var state = {
    type: 'bank',
    currency: 'IRR',
  };

  function authHeaders(extra) {
    var token = localStorage.getItem('access_token');
    return Object.assign({ Authorization: 'Bearer ' + token }, extra || {});
  }

  /* ---------------------------------------------------------------------
   * آیکون‌ها
   * ------------------------------------------------------------------- */
  var ICONS = {
    walletPlus:
      '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h11A2.5 2.5 0 0 1 19 7.5V8H5.5A2.5 2.5 0 0 1 3 5.5"/><path d="M3 7.5v10A2.5 2.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 18.5 8H5.5A2.5 2.5 0 0 1 3 5.5"/><path d="M15.2 13v-1.6M14.4 12.2h1.6"/></svg>',
    clipboard:
      '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="4.5" width="14" height="16" rx="2.3"/><path d="M9 4.5V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v.5"/><path d="M8.5 11h7M8.5 15h5"/></svg>',
    bank:
      '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10l9-6 9 6"/><path d="M4 10v9h16v-9"/><path d="M9 21v-6h6v6"/></svg>',
    cash:
      '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6.5" width="19" height="11" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9v0M18 15v0"/></svg>',
    card:
      '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 9.5h19"/><path d="M6 15h4"/></svg>',
    digitalWallet:
      '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h11A2.5 2.5 0 0 1 19 7.5V8H5.5A2.5 2.5 0 0 1 3 5.5"/><path d="M3 7.5v10A2.5 2.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 18.5 8H5.5A2.5 2.5 0 0 1 3 5.5"/><circle cx="16" cy="13" r="1.3"/></svg>',
    crypto:
      '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 8.2h3.4a2 2 0 0 1 0 4H9.5m0 0h3.9a2 2 0 0 1 0 4H9.5m0-8v9M12 7v1.2M12 15.8V17"/></svg>',
    other:
      '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>',
    chevron:
      '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
    check:
      '<svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.4"><path d="M5 12l5 5L19 7"/></svg>',
    close:
      '<svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  };

  var TYPE_OPTIONS = [
    { value: 'bank', label: 'بانک', desc: 'حساب بانکی برای واریز و برداشت روزمره', icon: ICONS.bank },
    { value: 'cash', label: 'نقدی', desc: 'پول نقد و هزینه‌های روزمره', icon: ICONS.cash },
    { value: 'digital_wallet', label: 'کیف پول دیجیتال', desc: 'کیف‌پول‌های آنلاین و اپلیکیشنی', icon: ICONS.digitalWallet },
    { value: 'crypto', label: 'ارز دیجیتال', desc: 'دارایی‌های کریپتو و صرافی‌ها', icon: ICONS.crypto },
    { value: 'other', label: 'سایر', desc: 'هر نوع حساب دیگه‌ای که مدنظرته', icon: ICONS.other },
  ];

  var CURRENCY_OPTIONS = [
    { value: 'IRR', label: 'تومان', desc: 'واحد پول ایران', symbol: 'ت' },
    { value: 'USD', label: 'دلار آمریکا', desc: 'US Dollar', symbol: '$' },
    { value: 'EUR', label: 'یورو', desc: 'Euro', symbol: '€' },
    { value: 'TRY', label: 'لیر ترکیه', desc: 'Turkish Lira', symbol: '₺' },
    { value: 'AED', label: 'درهم امارات', desc: 'UAE Dirham', symbol: 'د.إ' },
  ];

  var STEP_META = [
    { icon: ICONS.walletPlus, label: 'نوع حساب' },
    { icon: ICONS.clipboard, label: 'اطلاعات پایه' },
    { icon: ICONS.bank, label: 'موجودی اولیه' },
  ];

  function findOption(list, value) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].value === value) return list[i];
    }
    return null;
  }

  function q(root, sel) {
    return root.querySelector(sel);
  }

  function qa(root, sel) {
    return Array.prototype.slice.call(root.querySelectorAll(sel));
  }

  function toPersianDigits(str) {
    var digits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return String(str).replace(/[0-9]/g, function (d) {
      return digits[+d];
    });
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  /* ---------------------------------------------------------------------
   * تابع تبدیل عدد به حروف فارسی
   * ------------------------------------------------------------------- */
  function persianNumberToWords(num) {
    if (num === 0) return 'صفر';
    var units = ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه'];
    var teens = ['ده', 'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده', 'هفده', 'هجده', 'نوزده'];
    var tens = ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'];
    var hundreds = ['', 'صد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد'];
    var scales = ['', 'هزار', 'میلیون', 'میلیارد'];

    function convertChunk(n) {
      var result = '';
      var h = Math.floor(n / 100);
      if (h > 0) result += hundreds[h] + ' ';
      var t = n % 100;
      if (t >= 10 && t <= 19) {
        result += teens[t - 10];
      } else {
        var d = Math.floor(t / 10);
        var u = t % 10;
        if (d > 0) result += tens[d] + (u > 0 ? ' و ' : '');
        if (u > 0) result += units[u];
      }
      return result.trim();
    }

    var parts = [];
    var scaleIndex = 0;
    while (num > 0) {
      var chunk = num % 1000;
      if (chunk > 0) {
        var chunkStr = convertChunk(chunk);
        if (scaleIndex > 0) chunkStr += ' ' + scales[scaleIndex];
        parts.unshift(chunkStr);
      }
      num = Math.floor(num / 1000);
      scaleIndex++;
    }
    return parts.join(' و ');
  }

  /* ---------------------------------------------------------------------
   * به‌روزرسانی متن راهنما (حروف + نام ارز)
   * ------------------------------------------------------------------- */
  function updateAmountHint(root) {
    var input = q(root, '#hbObBalance');
    var hint = q(root, '#hbObAmountHint');
    if (!input || !hint) return;
    var raw = input.value.replace(/[^0-9]/g, '');
    var num = raw ? Number(raw) : 0;
    var currencyLabel = findOption(CURRENCY_OPTIONS, state.currency).label;
    hint.textContent = persianNumberToWords(num) + ' ' + currencyLabel;
  }

  /* ---------------------------------------------------------------------
   * سلکت‌باکس سفارشی
   * ------------------------------------------------------------------- */
  function standardSelectMarkup(cfg) {
    var selected = findOption(cfg.options, cfg.value);
    return (
      '<div class="mb-4">' +
      '  <label class="block text-sm font-bold text-[var(--color-text-color)] mb-2">' + cfg.label + '</label>' +
      '  <div id="' + cfg.id + '" class="custom-select relative">' +
      '    <button type="button" class="select-btn w-full h-12 border border-[var(--color-border-color)] rounded-xl flex items-center justify-between px-4 bg-[var(--color-surface2-color)] text-sm">' +
      '      <span class="selected-value text-[var(--color-text-color)]" data-placeholder="' + cfg.placeholder + '">' + (selected ? selected.label : cfg.placeholder) + '</span>' +
      '      <svg class="w-5 h-5 transition text-[var(--color-text2-color)]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"></path></svg>' +
      '    </button>' +
      '    <div class="dropdown hidden absolute left-0 w-full border border-gray-300 bg-white rounded-xl shadow-lg z-50 mt-1">' +
      '      <div class="p-2 border-b border-gray-100">' +
      '        <input type="text" class="search-input w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none" placeholder="جستجو...">' +
      '      </div>' +
      '      <div class="options max-h-52 overflow-y-auto">' +
      cfg.options
        .map(function (opt) {
          return '<div class="option px-4 py-3 cursor-pointer hover:bg-gray-50 text-sm" data-value="' + opt.value + '">' + opt.label + '</div>';
        })
        .join('') +
      '      </div>' +
      '    </div>' +
      '  </div>' +
      '</div>'
    );
  }

  function wireStandardSelect(root, cfg) {
    var container = q(root, '#' + cfg.id);
    if (!container) return;
    qa(container, '.option').forEach(function (optionEl) {
      optionEl.addEventListener('click', function () {
        cfg.onChange(optionEl.getAttribute('data-value'));
      });
    });
  }

  /* ---------------------------------------------------------------------
   * ساخت مارک‌آپ کلی مودال
   * ------------------------------------------------------------------- */
  function stepsIndicatorMarkup() {
    var out = '';
    STEP_META.forEach(function (meta, idx) {
      var n = idx + 1;
      out +=
        '<div class="hb-ob-step-col" data-step-col="' + n + '">' +
        '  <div class="hb-ob-step-circle">' +
        '    <span class="hb-ob-step-icon">' + meta.icon + '</span>' +
        '    <span class="hb-ob-step-check">' + ICONS.check + '</span>' +
        '  </div>' +
        '  <span class="hb-ob-step-label">' + meta.label + '</span>' +
        '</div>';
      if (n < TOTAL_STEPS) {
        out += '<div class="hb-ob-step-line" data-line="' + n + '"></div>';
      }
    });
    return out;
  }

  function cardMarkup() {
    return (
      '' +
      // کارت اصلی
      '<div class="hb-ob-card" role="dialog" aria-modal="true" aria-labelledby="hbObTitle">' +
      // glow تزئینی
      '  <div class="hb-ob-glow"></div>' +

      // هدر
      '  <div class="hb-ob-header">' +
      '    <div>' +
      '      <h2 class="text-lg font-extrabold text-[var(--color-text-color)]" id="hbObTitle">افزودن اولین حساب</h2>' +
      '      <p class="text-xs text-[var(--color-text2-color)] mt-1 leading-relaxed">برای پیگیری تراکنش‌ها، بودجه و گزارش‌هات، اول باید یک حساب بسازی.</p>' +
      '    </div>' +
      '    <button type="button" class="hb-ob-close" id="hbObClose" aria-label="بستن">' + ICONS.close + '</button>' +
      '  </div>' +

      // استپ‌ایندیکیتور (بیرون از کانتینر اصلی چون طراحی متفاوتی داره)
      '  <div class="hb-ob-steps" id="hbObSteps">' + stepsIndicatorMarkup() + '</div>' +

      // کانتینر داخلی مشترک برای محتوای پنل‌ها و فوتر
      '  <div class="hb-ob-inner">' +

      // بدنه
      '    <div class="hb-ob-body">' +
      '      <div class="hb-ob-panel is-active" data-panel="1">' +
      '        <div id="hbObTypeSelectSlot">' + standardSelectMarkup(typeSelectCfg()) + '</div>' +
      '      </div>' +
      '      <div class="hb-ob-panel" data-panel="2">' +
      '        <div class="hb-ob-error" id="hbObErrorName"></div>' +
      '        <div class="mb-4">' +
      '          <div class="relative">' +
      '            <label class="block text-sm font-bold text-[var(--color-text-color)] mb-2">نام حساب </label>' +
      '            <input type="text" id="hbObName" placeholder="مثلاً بانک ملت، کیف پول نقدی..." class="w-full h-10 border border-main-color rounded-lg pr-4 pl-4 outline-none">' +
      '          </div>' +
      '        </div>' +
      '        <div id="hbObCurrencySelectSlot">' + standardSelectMarkup(currencySelectCfg()) + '</div>' +
      '        <p class="text-xs text-[var(--color-text2-color)] mt-2 leading-relaxed">این اطلاعات رو هر زمان بخوای می‌تونی از تنظیمات حساب‌ها ویرایش کنی.</p>' +
      '      </div>' +
      // *********** پنل ۳ با فیلد متنی و نمایش حروف ***********
      '      <div class="hb-ob-panel" data-panel="3">' +
      '        <div class="hb-ob-error" id="hbObErrorBalance"></div>' +
      '        <div class="mb-4">' +
      '          <label class="flex items-center justify-between text-sm font-bold text-[var(--color-text-color)] mb-2">موجودی اولیه <span class="text-xs font-medium text-[var(--color-text2-color)]">اختیاری</span></label>' +
      '          <div class="relative">' +
      '            <input type="text" min="0" step="1" id="hbObBalance" placeholder="0" ' +
      '                   class="w-full h-10 border border-main-color rounded-lg pr-4 pl-4 outline-none" ' +
      '                   inputmode="numeric" autocomplete="off">' +
      '            <div class="amount-words-hint text-xs text-gray-400 mt-1 min-h-[1em]" id="hbObAmountHint">صفر تومان</div>' +
      '          </div>' +
      '          <p class="text-xs text-[var(--color-text2-color)] mt-2 leading-relaxed">موجودی اولیه، نقطه‌ی شروع محاسبه‌ی موجودی حسابته و به‌عنوان درآمد ثبت نمی‌شه.</p>' +
      '        </div>' +
      '        <div class="mb-4">' +
      '          <label class="flex items-center justify-between text-sm font-bold text-[var(--color-text-color)] mb-2">یادداشت سریع <span class="text-xs font-medium text-[var(--color-text2-color)]">اختیاری · <span id="hbObNoteCount">۰</span>/۲۰۰</span></label>' +
      '          <textarea id="hbObNote" maxlength="200" class="hb-ob-textarea" placeholder="مثلاً این حساب برای هزینه‌های مشترک با خانواده‌ست..."></textarea>' +
      '        </div>' +
      '      </div>' +
      '      <div class="hb-ob-panel" data-panel="success">' +
      '        <div class="hb-ob-success">' +
      '          <div class="hb-ob-success-icon">' +
      '            <svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15"/><path d="M11 18.5l4.5 4.5L26 12"/></svg>' +
      '          </div>' +
      '          <p class="text-lg font-extrabold text-[var(--color-text-color)] mt-5">حساب با موفقیت ساخته شد</p>' +
      '          <p class="text-sm text-[var(--color-text2-color)] mt-2 leading-relaxed">حالا می‌تونی تراکنش‌هاتو ثبت کنی و از همه‌ی امکانات حسابینو استفاده کنی.</p>' +
      '          <div class="hb-ob-summary" id="hbObSummary"></div>' +
      '        </div>' +
      '      </div>' +
      '    </div>' +

      // فوتر
      '    <div class="hb-ob-footer" id="hbObFooter"></div>' +

      '  </div>' +
      '</div>'
    );
  }

  /* ---------------------------------------------------------------------
   * منطق مراحل
   * ------------------------------------------------------------------- */
  function updateStepIndicator(root) {
    qa(root, '.hb-ob-step-col').forEach(function (el) {
      var n = Number(el.getAttribute('data-step-col'));
      el.classList.toggle('is-active', n === currentStep);
      el.classList.toggle('is-done', currentStep !== 'success' && n < currentStep || currentStep === 'success');
    });
    qa(root, '.hb-ob-step-line').forEach(function (el) {
      var n = Number(el.getAttribute('data-line'));
      el.classList.toggle('is-done', currentStep === 'success' || n < currentStep);
    });
  }

  function showPanel(root, step) {
    currentStep = step;
    qa(root, '.hb-ob-panel').forEach(function (el) {
      el.classList.toggle('is-active', el.getAttribute('data-panel') === String(step));
    });
    updateStepIndicator(root);
    renderFooter(root);
    var body = q(root, '.hb-ob-body');
    if (body) body.scrollTop = 0;

    // وقتی پنل ۳ فعال می‌شه، نمایش حروف را به‌روز کن
    if (step === 3 && overlayEl) {
      updateAmountHint(overlayEl);
    }
  }

  function renderFooter(root) {
    var footer = q(root, '#hbObFooter');
    footer.innerHTML = '';

    if (currentStep === 1) {
      footer.appendChild(makeButton('primary', 'مرحله بعد', function () {
        showPanel(root, 2);
      }));
    } else if (currentStep === 2) {
      footer.appendChild(makeButton('secondary', 'بازگشت', function () {
        showPanel(root, 1);
      }));
      footer.appendChild(makeButton('primary', 'مرحله بعد', function () {
        if (!validateStep2(root)) return;
        showPanel(root, 3);
      }));
    } else if (currentStep === 3) {
      footer.appendChild(makeButton('secondary', 'بازگشت', function () {
        showPanel(root, 2);
      }));
      var submitBtn = makeButton('primary', 'ساخت حساب', function () {
        submitAccount(root, submitBtn);
      });
      footer.appendChild(submitBtn);
    } else {
      footer.appendChild(makeButton('primary', 'بریم به داشبورد', function () {
        window.location.reload();
      }));
    }
  }

  function makeButton(kind, text, onClick) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hb-ob-btn hb-ob-btn-' + kind;
    if (kind === 'primary') {
      btn.innerHTML = '<span class="hb-ob-spinner"></span><span class="hb-ob-btn-text">' + text + '</span>';
    } else {
      btn.textContent = text;
    }
    btn.addEventListener('click', onClick);
    return btn;
  }

  function setLoading(btn, loading) {
    if (!btn) return;
    btn.classList.toggle('is-loading', loading);
    btn.disabled = loading;
  }

  function showError(root, targetId, message) {
    var box = q(root, '#' + targetId);
    box.textContent = message;
    box.classList.add('is-visible');
  }

  function clearError(root, targetId) {
    var box = q(root, '#' + targetId);
    box.textContent = '';
    box.classList.remove('is-visible');
  }

  function validateStep2(root) {
    clearError(root, 'hbObErrorName');
    var name = q(root, '#hbObName').value.trim();
    if (!name) {
      showError(root, 'hbObErrorName', 'نام حساب الزامی است');
      q(root, '#hbObName').focus();
      return false;
    }
    return true;
  }

  function formatAmount(amount, currency) {
    var grouped = Math.round(Number(amount || 0)).toLocaleString('en-US');
    var opt = findOption(CURRENCY_OPTIONS, currency);
    return toPersianDigits(grouped) + ' ' + (opt ? opt.label : '');
  }

  function submitAccount(root, submitBtn) {
    clearError(root, 'hbObErrorBalance');
    var name = q(root, '#hbObName').value.trim();
    // خواندن عدد از ورودی متنی (حذف کاراکترهای غیرعددی)
    var balanceRaw = q(root, '#hbObBalance').value.replace(/[^0-9]/g, '');
    var note = q(root, '#hbObNote').value.trim();
    var openingBalance = balanceRaw ? Number(balanceRaw) : 0;

    if (balanceRaw && (isNaN(openingBalance) || openingBalance < 0)) {
      showError(root, 'hbObErrorBalance', 'موجودی اولیه باید یک عدد معتبر باشد');
      return;
    }

    setLoading(submitBtn, true);

    var payload = {
      name: name,
      type: state.type,
      currency: state.currency,
      openingBalance: openingBalance,
    };
    if (note) payload.note = note;

    fetch(API_BASE + '/accounts', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.message || 'ثبت حساب با خطا مواجه شد');
          return data;
        });
      })
      .then(function () {
        var typeOpt = findOption(TYPE_OPTIONS, state.type);
        var summary = q(root, '#hbObSummary');
        summary.innerHTML =
          '<div class="flex items-center gap-3">' +
          '<span class="hb-ob-option-icon-sm">' + typeOpt.icon + '</span>' +
          '<span>' +
          '<div class="text-sm font-bold text-[var(--color-text-color)]">' + escapeHtml(name) + '</div>' +
          '<div class="text-xs text-[var(--color-text2-color)]">' + typeOpt.label + '</div>' +
          '</span></div>' +
          '<div class="text-base font-extrabold text-[var(--color-green-color)]">' + formatAmount(openingBalance, state.currency) + '</div>';
        showPanel(root, 'success');
      })
      .catch(function (err) {
        showError(root, 'hbObErrorBalance', err.message || 'ثبت حساب با خطا مواجه شد');
      })
      .finally(function () {
        setLoading(submitBtn, false);
      });
  }

  /* ---------------------------------------------------------------------
   * ساخت و اتصال مودال
   * ------------------------------------------------------------------- */
  function typeSelectCfg() {
    return {
      id: 'hbObTypeSelect',
      label: 'نوع حساب',
      placeholder: 'نوع حساب رو انتخاب کن',
      options: TYPE_OPTIONS,
      value: state.type,
      onChange: function (value) {
        state.type = value;
        setSelectedLabel(overlayEl, 'hbObTypeSelect', TYPE_OPTIONS, value);
      },
    };
  }

  function currencySelectCfg() {
    return {
      id: 'hbObCurrencySelect',
      label: 'واحد پول',
      placeholder: 'واحد پول رو انتخاب کن',
      options: CURRENCY_OPTIONS,
      value: state.currency,
      onChange: function (value) {
        state.currency = value;
        setSelectedLabel(overlayEl, 'hbObCurrencySelect', CURRENCY_OPTIONS, value);
        // به‌روزرسانی نمایش حروف با ارز جدید
        if (overlayEl) updateAmountHint(overlayEl);
      },
    };
  }

  function setSelectedLabel(root, containerId, options, value) {
    var container = q(root, '#' + containerId);
    if (!container) return;
    var opt = findOption(options, value);
    var valueEl = q(container, '.selected-value');
    if (opt && valueEl) valueEl.textContent = opt.label;
    container.dataset.value = value;
  }

  function wireNoteCounter(root) {
    var textarea = q(root, '#hbObNote');
    var counter = q(root, '#hbObNoteCount');
    textarea.addEventListener('input', function () {
      counter.textContent = toPersianDigits(textarea.value.length);
    });
  }

  function wireClose(root) {
    var closeBtn = q(root, '#hbObClose');
    var card = q(root, '.hb-ob-card');
    closeBtn.addEventListener('click', function () {
      card.classList.remove('is-shake');
      void card.offsetWidth;
      card.classList.add('is-shake');
    });
  }

  function buildModal() {
    var overlay = document.createElement('div');
    overlay.className = 'hb-ob-overlay';
    overlay.id = 'hbOnboardingOverlay';
    overlay.innerHTML = cardMarkup();

    // دیگر نیازی به تنظیم span قدیمی نیست (hbObAmountCurrency حذف شده)
    setSelectedLabel(overlay, 'hbObTypeSelect', TYPE_OPTIONS, state.type);
    setSelectedLabel(overlay, 'hbObCurrencySelect', CURRENCY_OPTIONS, state.currency);

    if (window.HesabinoUI && typeof window.HesabinoUI.initCustomSelects === 'function') {
      window.HesabinoUI.initCustomSelects(overlay);
    }
    wireStandardSelect(overlay, typeSelectCfg());
    wireStandardSelect(overlay, currencySelectCfg());
    wireNoteCounter(overlay);
    wireClose(overlay);

    // اتصال رویداد ورودی برای به‌روزرسانی حین تایپ + فیلتر کردن غیر اعداد
    var balanceInput = q(overlay, '#hbObBalance');
    if (balanceInput) {
      balanceInput.addEventListener('input', function () {
        // حذف هر کاراکتر غیرعددی
        var raw = this.value.replace(/[^0-9]/g, '');
        if (this.value !== raw) {
          this.value = raw;
        }
        updateAmountHint(overlay);
      });
      // مقدار اولیه
      updateAmountHint(overlay);
    }

    showPanel(overlay, 1);
    return overlay;
  }

  HB.show = function () {
    if (overlayEl) return;
    overlayEl = buildModal();
    document.documentElement.classList.add('hb-ob-lock-scroll');
    document.body.appendChild(overlayEl);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        overlayEl.classList.add('is-open');
      });
    });
  };

  if (HB.ready && typeof HB.ready.then === 'function') {
    HB.ready.then(function (shouldShow) {
      if (shouldShow) HB.show();
    });
  }
})();