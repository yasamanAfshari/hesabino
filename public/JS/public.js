// هدر Authorization رو از روی توکن ذخیره‌شده توی localStorage می‌سازه
function authHeaders(extra) {
  const token = localStorage.getItem('access_token');
  return Object.assign({ Authorization: `Bearer ${token}` }, extra || {});
}

// جلوگیری از XSS موقع تزریق متن کاربر توی innerHTML
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

// تبدیل ارقام انگلیسی به فارسی
function toPersianDigits(str) {
  const digits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(str).replace(/[0-9]/g, (d) => digits[+d]);
}

// تبدیل ارقام فارسی به انگلیسی
function toEnglishDigits(str) {
  const persian = '۰۱۲۳۴۵۶۷۸۹';
  return String(str || '').replace(/[۰-۹]/g, (d) => String(persian.indexOf(d)));
}

// ===== توست ساده برای پیام موفقیت/خطا =====
function ensureToastContainer() {
  let el = document.getElementById('hesabinoToastContainer');
  if (!el) {
    el = document.createElement('div');
    el.id = 'hesabinoToastContainer';
    el.style.position = 'fixed';
    el.style.bottom = '20px';
    el.style.left = '20px';
    el.style.zIndex = '9999';
    el.style.display = 'flex';
    el.style.flexDirection = 'column';
    el.style.gap = '10px';
    el.style.maxWidth = '320px';
    document.body.appendChild(el);
  }
  return el;
}

function showToast(message, type) {
  const container = ensureToastContainer();
  const isSuccess = type !== 'error';
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.className =
    'px-4 py-3 rounded-lg shadow-lg text-sm font-medium border ' +
    (isSuccess
      ? 'bg-green-color-25 text-green-color border-green-color'
      : 'bg-red-color-25 text-red-color border-red-color');
  toast.style.opacity = '0';
  toast.style.transform = 'translateY(10px)';
  toast.style.transition = 'opacity .25s ease, transform .25s ease';
  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}

(function () {
  'use strict';

  // ===== لودر صفحه =====
  function setupLoader() {
    const loader = document.getElementById('page-loader');
    window.HesabinoUI = window.HesabinoUI || {};

    if (!loader) {
      window.HesabinoUI.hidePageLoader = function () {};
      return;
    }

    const minVisible = 400;   // حداقل زمان نمایش، برای جلوگیری از چشمک خیلی سریع
    const safetyNet = 8000;  
    const fadeDuration = 600;
    const startedAt = Date.now();
    let hidden = false;

    function reallyHide() {
      if (hidden) return;
      hidden = true;
      loader.classList.add('hidden');
      setTimeout(() => loader.remove(), fadeDuration);
    }

    function hidePageLoader() {
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, minVisible - elapsed);
      setTimeout(reallyHide, remaining);
    }

    setTimeout(reallyHide, safetyNet);

    window.HesabinoUI.hidePageLoader = hidePageLoader;
  }

  // ===== خواندن مقدار زنده‌ی متغیرهای CSS، برای هماهنگی نمودارها با تم روشن/تیره =====
  function cssVar(name, fallback) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  }

  const chartInstances = {};

  // =====  نمودارها (دونات و میله‌ای) =====
  function initCharts() {
    const donutEl = document.getElementById('donutChart');
    if (donutEl && typeof Chart !== 'undefined') {
      try {
        const donutCtx = donutEl.getContext('2d');
        const donutData = {
          labels: ['خوراک', 'خرید و پوشاک', 'حمل و نقل', 'تفریح و سرگرمی', 'سلامت', 'آموزش', 'سرمایه', 'بدهی', 'مسکن', 'سایر'],
          datasets: [{
            data: [30, 15, 10, 25, 12, 8, 5, 6, 7, 2],
            backgroundColor: ['#FF9B44', '#FF9EE7', '#C8AC4E', '#55B5B1', '#9DE18B', '#9D5C8F', '#E5DC44', '#B9403C', '#745C52', '#DADADA'],
            borderWidth: 0,
            cutout: '70%'
          }]
        };
        chartInstances.donut = new Chart(donutCtx, { type: 'doughnut', data: donutData, options: { plugins: { legend: { display: false } } } });
      } catch (err) {
        console.warn('donut chart init failed', err);
      }
    }

    const myChartEl = document.getElementById('myChart');
    if (myChartEl && typeof Chart !== 'undefined') {
      try {
        const myCtx = myChartEl.getContext('2d');
        const labels = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
        const incomeValues = [12000000, 18000000, 22000000, 15000000, 28000000, 31000000, 25000000, 20000000, 17000000, 35000000, 29000000, 24000000];
        const costValues = [9000000, 14000000, 18000000, 12000000, 22000000, 26000000, 20000000, 16000000, 13000000, 28000000, 23000000, 19000000];
        chartInstances.bar = new Chart(myCtx, {
          type: 'bar',
          data: {
            labels,
            datasets: [
              { label: 'درآمد', data: incomeValues, backgroundColor: cssVar('--color-chart-income', '#0062AE'), borderRadius: 6 },
              { label: 'هزینه', data: costValues, backgroundColor: cssVar('--color-chart-expense', '#BDD7EA'), borderRadius: 6 }
            ]
          },
          options: {
            responsive: true,
            plugins: { legend: { position: 'top', labels: { color: cssVar('--color-text-color', '#1F2937') } } },
            scales: {
              x: { ticks: { color: cssVar('--color-text2-color', '#6B7280') }, grid: { color: cssVar('--color-chart-grid', '#E4E4E4') } },
              y: { ticks: { color: cssVar('--color-text2-color', '#6B7280') }, grid: { color: cssVar('--color-chart-grid', '#E4E4E4') } }
            }
          }
        });
      } catch (err) {
        console.warn('myChart init failed', err);
      }
    }
  }

  function updateChartsTheme() {
    const bar = chartInstances.bar;
    if (bar) {
      bar.data.datasets[0].backgroundColor = cssVar('--color-chart-income', '#0062AE');
      bar.data.datasets[1].backgroundColor = cssVar('--color-chart-expense', '#BDD7EA');
      bar.options.plugins.legend.labels.color = cssVar('--color-text-color', '#1F2937');
      bar.options.scales.x.ticks.color = cssVar('--color-text2-color', '#6B7280');
      bar.options.scales.y.ticks.color = cssVar('--color-text2-color', '#6B7280');
      bar.options.scales.x.grid.color = cssVar('--color-chart-grid', '#E4E4E4');
      bar.options.scales.y.grid.color = cssVar('--color-chart-grid', '#E4E4E4');
      bar.update();
    }
    initExpenseRatioChart();
  }

  // =====  نمودار نسبت هزینه به درآمد =====
  function initExpenseRatioChart() {
    const container = document.getElementById('expenseChart');
    if (!container) return;

    container.innerHTML = '';

    const cost_income_data = [
      { month: "فروردین", value: 78 },
      { month: "اردیبهشت", value: 65 },
      { month: "خرداد", value: 82 },
      { month: "تیر", value: 55 },
      { month: "مرداد", value: 71 },
      { month: "شهریور", value: 90 },
      { month: "مهر", value: 85 },
      { month: "آبان", value: 73 },
      { month: "آذر", value: 68 },
      { month: "دی", value: 80 },
      { month: "بهمن", value: 77 },
      { month: "اسفند", value: 88 }
    ];

    cost_income_data.forEach(item => {
      const wrapper = document.createElement("div");
      wrapper.className = "flex flex-col items-center gap-1";

      const circle = document.createElement("div");
      circle.className = "relative w-16 h-16 rounded-full flex items-center justify-center";
      circle.style.background = `conic-gradient(${cssVar('--color-chart-income', '#0062AE')} ${item.value * 3.6}deg, ${cssVar('--color-chart-track', '#D7E4EF')} ${item.value * 3.6}deg)`;

      const inner = document.createElement("div");
      inner.className = "w-12 h-12 rounded-full flex items-center justify-center";
      inner.style.background = cssVar('--color-surface2-color', '#F5F7FA');
      inner.innerHTML = `<span class="text-sm font-bold text-gray-700">${item.value}٪</span>`;

      circle.appendChild(inner);

      const label = document.createElement("span");
      label.className = "mt-1 text-sm text-gray-700";
      label.textContent = item.month;

      wrapper.appendChild(circle);
      wrapper.appendChild(label);
      container.appendChild(wrapper);
    });
  }

  // =====  نوار پیشرفت =====
  function initProgressBar() {
    const fill = document.getElementById('barFill');
    const text = document.getElementById('percentText');
    if (!fill || !text) return;
    let progress = 0;
    const timer = setInterval(() => {
      progress++;
      fill.style.width = progress + '%';
      text.textContent = progress + '%';
      if (progress >= 80) clearInterval(timer);
    }, 30);
  }

  function initDatepickerFallback() {
    const inputs = document.querySelectorAll('.wt-datepicker-input-element');
    if (!inputs.length) return;

    if (window.jQuery && (typeof jQuery.fn.pDatepicker !== 'undefined' || typeof jQuery.fn.persianDatepicker !== 'undefined')) {
      inputs.forEach((input) => {
        try {
          $(input).pDatepicker?.({
            format: 'YYYY/MM/DD',
            initialValue: false,
            onSelect: function () {
              input.dispatchEvent(new Event('change', { bubbles: true }));
            },
          });
        } catch (e) {
          console.warn('datepicker init error for', input, e);
        }
      });
    } else {
      console.log('datepicker plugin not found');
    }
  }

function initTimePickers() {
    if (typeof flatpickr === 'undefined') {
        console.warn('flatpickr بارگذاری نشده است');
        return;
    }

    if (flatpickr.l10ns && flatpickr.l10ns.fa) {
        flatpickr.localize(flatpickr.l10ns.fa);
    }

    flatpickr('.time-picker', {
        enableTime: true,
        noCalendar: true,
        dateFormat: 'H:i',
        time_24hr: true,
        allowInput: true,
        minuteIncrement: 1, 
        onReady: function (selectedDates, dateStr, instance) {
            instance.calendarContainer.classList.add('rtl-timepicker');

            const input = instance.input;
            let ignore = false;

            input.addEventListener('input', function () {
                if (ignore) return;
                ignore = true;

                let val = input.value.replace(/[^0-9]/g, '');
                if (val.length > 4) val = val.slice(0, 4);

                let formatted = val;
                if (val.length >= 2) {
                    formatted = val.substring(0, 2) + ':' + val.substring(2);
                }

                input.value = formatted;

                if (val.length === 2) {
                    input.setSelectionRange(3, 3);
                } else if (val.length > 2) {
                    input.setSelectionRange(formatted.length, formatted.length); 
                } else {
                    input.setSelectionRange(val.length, val.length);
                }

                ignore = false;
            });
        }
    });
}

  // ===== سلکت باکس سفارشی =====
  const openSelects = new Map();
  let customSelectGlobalListenersBound = false;

  // تشخیص دستگاه‌های لمسی (موبایل/تبلت)؛ برای جلوگیری از فوکوس خودکار روی اینپوت جستجو
  function isCoarsePointerDevice() {
    return !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  }
  const SCROLL_CLOSE_GRACE_MS = 350;

  function initCustomSelects(root) {
    const scope = root || document;

    scope.querySelectorAll('.custom-select:not([data-hb-select-wired])').forEach((select) => {
      select.setAttribute('data-hb-select-wired', '1');

      const btn = select.querySelector('.select-btn');
      const dropdown = select.querySelector('.dropdown');
      const search = select.querySelector('.search-input');
      const value = select.querySelector('.selected-value');
      const icon = btn.querySelector('svg');
      const dropdownHeight = 260;

      let placeholder = null;
      let openedAt = 0;

      function positionDropdown() {
        const rect = btn.getBoundingClientRect();
        const estimatedHeight = dropdown.offsetHeight || dropdownHeight;

        dropdown.style.left = rect.left + 'px';
        dropdown.style.width = rect.width + 'px';
        dropdown.style.top = '';
        dropdown.style.bottom = '';

        if ((window.innerHeight - rect.bottom) < estimatedHeight && rect.top > estimatedHeight) {
          dropdown.style.bottom = (window.innerHeight - rect.top + 8) + 'px';
        } else {
          dropdown.style.top = (rect.bottom + 8) + 'px';
        }
      }

      function openDropdown() {
        openSelects.forEach((entry, s) => {
          if (s !== select) entry.close();
        });

        if (!placeholder) {
          placeholder = document.createComment('dropdown-placeholder');
          dropdown.after(placeholder);
        }

        dropdown.style.position = 'fixed';
        dropdown.style.zIndex = '9999';
        document.body.appendChild(dropdown);
        dropdown.classList.remove('hidden');
        positionDropdown();

        openedAt = Date.now();

        if (search && !isCoarsePointerDevice()) search.focus();
        if (icon) icon.classList.add('rotate-180');
        openSelects.set(select, { close: closeDropdown, reposition: positionDropdown, dropdown, get openedAt() { return openedAt; } });
      }

      function closeDropdown() {
        dropdown.classList.add('hidden');
        dropdown.style.position = '';
        dropdown.style.top = '';
        dropdown.style.bottom = '';
        dropdown.style.left = '';
        dropdown.style.width = '';
        dropdown.style.zIndex = '';

        if (placeholder && placeholder.parentNode) {
          placeholder.parentNode.insertBefore(dropdown, placeholder);
        }

        if (icon) icon.classList.remove('rotate-180');
        openSelects.delete(select);
      }

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (btn.disabled) return;
        if (dropdown.classList.contains('hidden')) {
          openDropdown();
        } else {
          closeDropdown();
        }
      });


      function wireOptions() {
        const options = select.querySelectorAll('.option');

        options.forEach(item => {
          item.addEventListener('click', () => {
            if (item.getAttribute('aria-disabled') === 'true') return;

            const text = item.textContent.trim();
            const optValue = 'value' in item.dataset ? item.dataset.value : text;

            value.textContent = text;

            select.dataset.value = optValue;

            options.forEach(opt => opt.classList.remove('bg-gray-100'));
            item.classList.add('bg-gray-100');

            const nativeSelect = select.__hbNativeSelect;
            if (nativeSelect) {
              nativeSelect.value = optValue;
              nativeSelect.dispatchEvent(new Event('change', { bubbles: true }));
              nativeSelect.dispatchEvent(new Event('input', { bubbles: true }));
            }

            closeDropdown();
            if (search) search.value = '';
            options.forEach(opt => opt.style.display = 'block');
          });
        });

        if (search) {
          search.oninput = () => {
            const text = search.value.toLowerCase();
            options.forEach(item => {
              item.style.display = item.textContent.toLowerCase().includes(text) ? 'block' : 'none';
            });
          };
        }
      }

      select.__hbWireOptions = wireOptions;
      wireOptions();
    });

    if (customSelectGlobalListenersBound) return;
    customSelectGlobalListenersBound = true;

    document.addEventListener('click', () => {
      openSelects.forEach((entry) => entry.close());
    });

    // اسکرول شدن صفحه یا هر کانتینر داخلی (مثل بدنه‌ی مودال) => دراپ‌داون‌های باز بسته بشن،
  
    document.addEventListener('scroll', (e) => {
      const now = Date.now();
      openSelects.forEach((entry) => {
        if (entry.dropdown.contains(e.target)) return;
        if (now - entry.openedAt < SCROLL_CLOSE_GRACE_MS) return;
        entry.close();
      });
    }, true);

    window.addEventListener('resize', () => {
      openSelects.forEach((entry) => entry.reposition());
    });
  }

  // =====  تبدیل خودکار <select>های معمولی به همین سلکت‌باکس سفارشی =====
  function buildOptionRow(optionEl) {
    const item = document.createElement('div');
    item.className = 'option px-4 py-3 cursor-pointer hover:bg-gray-100';
    item.textContent = optionEl.textContent.trim();
    item.dataset.value = optionEl.value;
    if (optionEl.disabled) {
      item.classList.add('opacity-50', 'pointer-events-none');
      item.setAttribute('aria-disabled', 'true');
    }
    return item;
  }

  function enhanceNativeSelects(root) {
    const scope = root || document;

    scope.querySelectorAll('select:not([data-hb-enhanced]):not([data-no-enhance]):not([multiple])').forEach((nativeSelect) => {
      if (nativeSelect.closest('.custom-select')) return;

      nativeSelect.setAttribute('data-hb-enhanced', '1');

      const wrapper = document.createElement('div');
      wrapper.className = 'custom-select relative';

      const originalClasses = (nativeSelect.getAttribute('class') || '').split(/\s+/).filter(Boolean);
      const btnClasses = new Set(['select-btn', 'flex', 'items-center', 'justify-between', 'gap-2', 'cursor-pointer', ...originalClasses]);
      if (!originalClasses.includes('bg-white')) btnClasses.add('bg-white');

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = Array.from(btnClasses).join(' ');
      if (nativeSelect.disabled) btn.disabled = true;

      const valueSpan = document.createElement('span');
      valueSpan.className = 'selected-value truncate';
      const placeholderText = nativeSelect.dataset.placeholder
        || nativeSelect.getAttribute('title')
        || (nativeSelect.options.length ? nativeSelect.options[0].textContent.trim() : '');
      valueSpan.dataset.placeholder = placeholderText;

      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.setAttribute('class', 'w-5 h-5 transition shrink-0');
      icon.setAttribute('fill', 'none');
      icon.setAttribute('stroke', 'currentColor');
      icon.setAttribute('stroke-width', '2');
      icon.setAttribute('viewBox', '0 0 24 24');
      const iconPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      iconPath.setAttribute('d', 'm6 9 6 6 6-6');
      icon.appendChild(iconPath);

      btn.appendChild(valueSpan);
      btn.appendChild(icon);

      const dropdown = document.createElement('div');
      dropdown.className = 'dropdown hidden absolute left-0 w-full border border-gray-400 bg-white rounded-lg shadow-lg z-50';

      const searchWrap = document.createElement('div');
      searchWrap.className = 'p-2 border-b border-main-color-25';
      const searchInput = document.createElement('input');
      searchInput.type = 'text';
      searchInput.className = 'search-input w-full border border-main-color-25 rounded-md px-3 py-2 outline-none';
      searchInput.placeholder = 'جستجو...';
      searchWrap.appendChild(searchInput);

      const optionsContainer = document.createElement('div');
      optionsContainer.className = 'options max-h-52 overflow-y-auto';

      dropdown.appendChild(searchWrap);
      dropdown.appendChild(optionsContainer);

      wrapper.appendChild(btn);
      wrapper.appendChild(dropdown);


      nativeSelect.parentNode.insertBefore(wrapper, nativeSelect);
      nativeSelect.style.position = 'absolute';
      nativeSelect.style.width = '1px';
      nativeSelect.style.height = '1px';
      nativeSelect.style.overflow = 'hidden';
      nativeSelect.style.opacity = '0';
      nativeSelect.style.pointerEvents = 'none';
      wrapper.appendChild(nativeSelect);

      function syncFromSelect() {
        const opt = nativeSelect.options[nativeSelect.selectedIndex];
        const text = opt ? opt.textContent.trim() : '';
        valueSpan.textContent = text || placeholderText;

        optionsContainer.querySelectorAll('.option').forEach((row) => {
          row.classList.toggle('bg-gray-100', row.dataset.value === nativeSelect.value);
        });
      }

      function rebuildOptions() {
        optionsContainer.innerHTML = '';
        Array.from(nativeSelect.options).forEach((optionEl) => {
          optionsContainer.appendChild(buildOptionRow(optionEl));
        });
        syncFromSelect();

        if (typeof wrapper.__hbWireOptions === 'function') wrapper.__hbWireOptions();
      }

      wrapper.__hbNativeSelect = nativeSelect;

      ['value', 'selectedIndex'].forEach((propName) => {
        const descriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, propName);
        if (!descriptor || !descriptor.set || !descriptor.get) return;
        try {
          Object.defineProperty(nativeSelect, propName, {
            configurable: true,
            enumerable: descriptor.enumerable,
            get() { return descriptor.get.call(nativeSelect); },
            set(v) {
              descriptor.set.call(nativeSelect, v);
              syncFromSelect();
            }
          });
        } catch (err) {
          console.warn('override ' + propName + ' برای این select ممکن نشد', nativeSelect, err);
        }
      });

      nativeSelect.addEventListener('change', syncFromSelect);
      nativeSelect.addEventListener('input', syncFromSelect);

      const observer = new MutationObserver(rebuildOptions);
      observer.observe(nativeSelect, { childList: true, subtree: true });

      rebuildOptions();
    });

    initCustomSelects(scope);
  }

  window.HesabinoUI = window.HesabinoUI || {};
  window.HesabinoUI.initCustomSelects = initCustomSelects;
  window.HesabinoUI.enhanceNativeSelects = enhanceNativeSelects;

  // ===== مودال تأیید یکپارچه (به‌جای confirm()/alert() مرورگر) =====
  function ensureConfirmModal() {
    let modal = document.getElementById('hbConfirmModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'hbConfirmModal';
    modal.className = 'modal hidden fixed inset-0 z-50 flex items-center justify-center p-4';
    modal.innerHTML =
      '<div class="bg-white rounded-xl w-full max-w-md flex flex-col relative">' +
      '<div class="flex items-center justify-between px-6 pt-6 pb-3 border-b border-gray-200">' +
      '<h3 class="font-bold text-lg text-zinc-800" data-role="title">حذف</h3>' +
      '<button type="button" data-role="close" class="text-gray-500 hover:text-gray-700">' +
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12" /></svg>' +
      '</button>' +
      '</div>' +
      '<div class="px-6 py-5">' +
      '<p class="text-gray-700" data-role="message">آیا مطمئن هستید؟</p>' +
      '</div>' +
      '<div class="flex justify-end gap-2 px-6 pb-6 pt-2">' +
      '<button type="button" data-role="cancel" class="px-4 py-2 rounded-lg border border-gray-300 text-gray-700">انصراف</button>' +
      '<button type="button" data-role="confirm" class="bg-red-color text-white px-4 py-2 rounded-lg">حذف</button>' +
      '</div>' +
      '</div>';
    document.body.appendChild(modal);
    return modal;
  }

  function confirmDialog(message, options) {
    const opts = options || {};
    const modal = ensureConfirmModal();
    const titleEl = modal.querySelector('[data-role="title"]');
    const messageEl = modal.querySelector('[data-role="message"]');
    const confirmBtn = modal.querySelector('[data-role="confirm"]');
    const cancelBtn = modal.querySelector('[data-role="cancel"]');
    const closeBtn = modal.querySelector('[data-role="close"]');

    titleEl.textContent = opts.title || 'حذف';
    messageEl.textContent = message || 'آیا از این عملیات مطمئن هستید؟';
    confirmBtn.textContent = opts.confirmText || 'حذف';
    cancelBtn.textContent = opts.cancelText || 'انصراف';
    confirmBtn.className = opts.danger === false
      ? 'main-btn px-4 py-2 rounded-lg'
      : 'bg-red-color text-white px-4 py-2 rounded-lg';

    function open() {
      modal.classList.remove('hidden');
      requestAnimationFrame(() => requestAnimationFrame(() => modal.classList.add('is-open')));
      document.body.classList.add('overflow-hidden');
    }

    function close() {
      modal.classList.remove('is-open');
      setTimeout(() => modal.classList.add('hidden'), 250);
      document.body.classList.remove('overflow-hidden');
    }

    return new Promise((resolve) => {
      function settle(result) {
        confirmBtn.removeEventListener('click', onConfirm);
        cancelBtn.removeEventListener('click', onCancel);
        closeBtn.removeEventListener('click', onCancel);
        modal.removeEventListener('click', onBackdrop);
        document.removeEventListener('keydown', onKeydown);
        close();
        resolve(result);
      }
      function onConfirm() { settle(true); }
      function onCancel() { settle(false); }
      function onBackdrop(e) { if (e.target === modal) settle(false); }
      function onKeydown(e) { if (e.key === 'Escape') settle(false); }

      confirmBtn.addEventListener('click', onConfirm);
      cancelBtn.addEventListener('click', onCancel);
      closeBtn.addEventListener('click', onCancel);
      modal.addEventListener('click', onBackdrop);
      document.addEventListener('keydown', onKeydown);

      open();
    });
  }

  window.HesabinoUI = window.HesabinoUI || {};
  window.HesabinoUI.confirmDialog = confirmDialog;

  setupLoader();

  function onReady() {
    initCharts();
    initExpenseRatioChart();
    initProgressBar();
    initDatepickerFallback();
    initTimePickers();
    enhanceNativeSelects();
    initCustomSelects();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }

  document.addEventListener('hesabino:theme-changed', updateChartsTheme);
  document.addEventListener('hesabino:accent-changed', updateChartsTheme);

})();