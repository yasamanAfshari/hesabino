(function () {
  'use strict';

  // ===== ۱. لودر صفحه =====
  function setupLoader() {
    window.addEventListener('load', () => {
      const loader = document.getElementById('page-loader');
      if (!loader) return;
      const visibleDelay = 800;
      const fadeDuration = 600;

      setTimeout(() => {
        loader.classList.add('hidden');
        setTimeout(() => loader.remove(), fadeDuration);
      }, visibleDelay);
    });
  }

  // ===== خواندن مقدار زنده‌ی متغیرهای CSS، برای هماهنگی نمودارها با تم روشن/تیره =====
  function cssVar(name, fallback) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  }

  // نگه‌داری نمونه‌ی نمودارها و ویجت گیج، تا موقع عوض شدن تم بتونیم رنگ‌هاشون رو به‌روز کنیم
  const chartInstances = {};

  // ===== ۳. نمودارها (دونات و میله‌ای) =====
  function initCharts() {
    const donutEl = document.getElementById('donutChart');
    if (donutEl && typeof Chart !== 'undefined') {
      try {
        const donutCtx = donutEl.getContext('2d');
        const donutData = {
          labels: ['خوراک', 'خرید و پوشاک', 'حمل و نقل', 'تفریح و سرگرمی', 'سلامت', 'آموزش', 'سرمایه', 'بدهی', 'مسکن', 'سایر'],
          datasets: [{
            data: [30, 15, 10, 25, 12, 8, 5, 6, 7, 2],
            // این‌ها رنگ‌های دسته‌بندی (categorical) هستن؛ چون هر رنگ نماینده‌ی یک دسته‌ی
            // ثابته و ربطی به روشن/تیره بودن پس‌زمینه نداره، عمداً دست‌نخورده باقی می‌مونن.
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

  // موقع تغییر تم، رنگ نمودار میله‌ای (که رنگ‌هاش برای تم مهمن) رو به‌روز می‌کنیم
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

  // ===== ۴. نمودار نسبت هزینه به درآمد =====
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

  // ===== ۵. نوار پیشرفت =====
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
            // پلاگین موقع انتخاب تاریخ فقط .val() رو ست می‌کنه و رویداد change رو
            // dispatch نمی‌کنه؛ بدون این، لیسنرهای change (مثلاً فیلترهای تاریخ)
            // هیچ‌وقت اجرا نمی‌شدن. پس خودمون بعد از هر انتخاب change رو شبیه‌سازی می‌کنیم.
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

  // ===== ۸. سلکت باکس سفارشی =====
  // دراپ‌داون هر سلکت موقع باز شدن از داخل کانتینرش به انتهای body منتقل می‌شه
  // و با position:fixed نسبت به دکمه‌ی سلکت جای‌گذاری می‌شه. این‌طوری دراپ‌داون
  // کاملاً از جریان صفحه (و مهم‌تر از همه از overflow-y مودال‌ها) خارج می‌مونه
  // و باز شدنش باعث اسکرول خوردن مودال نمی‌شه؛ دقیقاً شبیه سلکت‌باکس معمولی.

  // select => { close, reposition, dropdown, openedAt } — برای بستن/ری‌پوزیشن کردن از
  // بیرون (کلیک بیرون، اسکرول، resize). بیرون از تابع نگه داشته می‌شه چون initCustomSelects
  // ممکنه چند بار صدا زده بشه (مثلاً وقتی مودالی به‌صورت داینامیک بعد از لود اولیه‌ی صفحه ساخته می‌شه)
  const openSelects = new Map();
  let customSelectGlobalListenersBound = false;

  // تشخیص دستگاه‌های لمسی (موبایل/تبلت)؛ برای جلوگیری از فوکوس خودکار روی اینپوت جستجو
  // که باعث باز شدن کیبورد و بسته‌شدن ناخواسته‌ی دراپ‌داون می‌شه (توضیح کامل پایین‌تر)
  function isCoarsePointerDevice() {
    return !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  }

  // بعد از باز شدن دراپ‌داون، تا این مدت (میلی‌ثانیه) رویداد scroll نادیده گرفته می‌شه.
  // روی موبایل، حتی وقتی فوکوس خودکار غیرفعاله، ممکنه خودِ باز شدن دراپ‌داون (تغییر
  // چیدمان صفحه، یا اسکرول خودکار مرورگر برای نگه داشتن دکمه در دید) یه رویداد scroll
  // فوری صادر کنه؛ بدون این فرصت، همون رویداد بلافاصله دراپ‌داونی رو که تازه باز شده می‌بست.
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

      // نکته‌ی مهم: بعد از این‌که dropdown به body منتقل می‌شه، دیگه داخل select
      // نیست؛ پس همه‌جا از همین رفرنس‌های بسته‌شده (closure) استفاده می‌کنیم، نه
      // select.querySelector('.dropdown') که بعد از جابه‌جایی چیزی پیدا نمی‌کنه.
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

        // یه کامنت جای خالیِ دراپ‌داون رو نگه می‌داره تا موقع بسته شدن سرجاش برگرده
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

        // روی موبایل، فوکوس خودکار اینپوت جستجو باعث باز شدن کیبورد می‌شه و مرورگر برای
        // نگه‌داشتن اینپوت بالای کیبورد، صفحه رو اسکرول می‌کنه؛ همین اسکرول قبلاً به‌عنوان
        // «اسکرول بیرون از دراپ‌داون» تشخیص داده می‌شد و دراپ‌داون رو همون لحظه‌ی باز شدن
        // می‌بست. برای همین روی دستگاه‌های لمسی فوکوس خودکار رو غیرفعال می‌کنیم؛ کاربر
        // در صورت نیاز خودش روی اینپوت جستجو ضربه می‌زنه.
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

      // وایر کردن کلیک روی آپشن‌ها و جستجو، به‌صورت تابعی جدا که بعد از بازسازی داینامیک
      // آپشن‌ها (مثلاً وقتی این کامپوننت دور یک <select> اصلی ساخته شده و آپشن‌هاش عوض
      // می‌شن) دوباره صدا زده می‌شه؛ برای همین رفرنس آپشن‌ها هر بار تازه خونده می‌شه
      // و نه فقط یک بار موقع ست‌آپ اولیه.
      function wireOptions() {
        const options = select.querySelectorAll('.option');

        options.forEach(item => {
          item.addEventListener('click', () => {
            if (item.getAttribute('aria-disabled') === 'true') return;

            const text = item.textContent.trim();
            const optValue = 'value' in item.dataset ? item.dataset.value : text;

            value.textContent = text;
            // سازگار با کدهای هر صفحه (مثل debts.js/cheques.js) که مقدار انتخاب‌شده‌ی
            // فیلترها رو از dataset.value خودِ کانتینر می‌خونن
            select.dataset.value = optValue;

            options.forEach(opt => opt.classList.remove('bg-gray-100'));
            item.classList.add('bg-gray-100');

            // اگه این سلکت سفارشی دور یک <select> اصلی ساخته شده (نگاه کنید به
            // enhanceNativeSelects)، مقدارش رو هم‌گام می‌کنیم تا هر جای دیگه‌ی برنامه
            // که با .value یا رویداد change با همون سلکت اصلی کار می‌کنه، بدون تغییر کار کنه
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
          // به‌جای addEventListener، از oninput استفاده می‌شه تا هر بار wireOptions
          // دوباره صدا زده می‌شه (بعد از بازسازی آپشن‌ها)، لیسنر قبلی خودش جایگزین بشه
          // و لیسنرهای تکراری روی هم انباشته نشن
          search.oninput = () => {
            const text = search.value.toLowerCase();
            options.forEach(item => {
              item.style.display = item.textContent.toLowerCase().includes(text) ? 'block' : 'none';
            });
          };
        }
      }

      // در دسترس گذاشتنش برای enhanceNativeSelects، تا بعد از بازسازی آپشن‌های یک
      // سلکت اصلیِ داینامیک (پر شدن دوباره‌ی گزینه‌ها با AJAX)، دوباره وایر بشه
      select.__hbWireOptions = wireOptions;
      wireOptions();
    });

    if (customSelectGlobalListenersBound) return;
    customSelectGlobalListenersBound = true;

    document.addEventListener('click', () => {
      openSelects.forEach((entry) => entry.close());
    });

    // اسکرول شدن صفحه یا هر کانتینر داخلی (مثل بدنه‌ی مودال) => دراپ‌داون‌های باز بسته بشن،
    // مگر این‌که خودِ اسکرول داخل لیست آپشن‌های همون دراپ‌داون اتفاق افتاده باشه، یا
    // دراپ‌داون همین چند لحظه پیش باز شده باشه (نگاه کنید به SCROLL_CLOSE_GRACE_MS)
    // (چون از capture:true استفاده شده، اسکرول هر عنصر داخلی هم که رویدادش bubble نمی‌شه گرفته می‌شه)
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

  // ===== ۸-۱. تبدیل خودکار <select>های معمولی به همین سلکت‌باکس سفارشی =====
  // به‌جای این‌که مارک‌آپ هر select رو دستی توی هر view عوض کنیم، همه‌ی select های
  // معمولی صفحه رو دور یک select اصلیِ (مخفی‌شده ولی هنوز در DOM و فرم حاضر) می‌پیچیم.
  // این‌طوری همه‌ی select ها دقیقاً از یک نوع کامپوننت (دکمه + جستجو) و ظاهر یکسان
  // استفاده می‌کنن، و از طرفی چون خودِ select اصلی دست‌نخورده باقی می‌مونه، کدهای
  // موجود صفحه که با select.value / select.selectedIndex / addEventListener('change')
  // و FormData کار می‌کنن، بدون هیچ تغییری همچنان درست کار می‌کنن.
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
      // اگه از قبل داخل یک .custom-select قرار داره (مثلاً کد صفحه خودش این کارو کرده)، دست نمی‌زنیم
      if (nativeSelect.closest('.custom-select')) return;

      nativeSelect.setAttribute('data-hb-enhanced', '1');

      const wrapper = document.createElement('div');
      wrapper.className = 'custom-select relative';

      // کلاس‌های اندازه/چیدمان select اصلی (مثل w-full h-10 یا اندازه‌های فشرده‌ی
      // سلکت‌های داخل هدر) روی دکمه هم اعمال می‌شه تا فضای صفحه به‌هم نریزه؛
      // کلاس‌های لازم برای رفتار دکمه هم به‌شون اضافه می‌شه
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

      // select اصلی همون‌جا کنار می‌مونه (نه با display:none حذف‌شده از فرم و نه با
      // aria-hidden از دسترس خارج‌شده)، فقط با یک استایل inline از دید مخفی می‌شه؛
      // این‌طوری هم فرم/FormData/کوئری‌های موجود صفحه بدون تغییر کار می‌کنن، هم
      // کاربرهای صفحه‌خوان از طریق تب هنوز بهش دسترسی دارن
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
        // آپشن‌های تازه ساخته‌شده باید دوباره وایر بشن (initCustomSelects فقط یک بار،
        // موقع ست‌آپ اولیه‌ی این wrapper، این کارو می‌کنه)
        if (typeof wrapper.__hbWireOptions === 'function') wrapper.__hbWireOptions();
      }

      wrapper.__hbNativeSelect = nativeSelect;

      // بقیه‌ی کد صفحه معمولاً با select.value = x یا select.selectedIndex = i مقدار
      // رو تغییر می‌ده (بدون dispatch کردن رویداد change)؛ برای این‌که ظاهر دکمه هم با
      // این تغییرات هم‌گام بمونه، getter/setter اصلی رو override می‌کنیم. علاوه بر این،
      // یه لیسنر change/input هم روی خودِ select می‌ذاریم تا اگه یک کاربر صفحه‌خوان با
      // کیبورد مستقیماً select اصلی رو تغییر بده (که از مسیر همین setter رد نمی‌شه)، باز
      // هم دکمه‌ی سفارشی به‌روز بشه.
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

      // اگه بعداً کدی innerHTML سلکت رو عوض کنه (پر کردن داینامیک گزینه‌ها با AJAX،
      // مثل حساب‌های مقصد/مبدأ انتقال یا ماه‌های درآمد)، آپشن‌های سفارشی هم دوباره ساخته بشن
      const observer = new MutationObserver(rebuildOptions);
      observer.observe(nativeSelect, { childList: true, subtree: true });

      rebuildOptions();
    });

    initCustomSelects(scope);
  }

  // امکان صدا زدن دوباره‌ی این توابع برای مودال‌هایی که بعد از لود اولیه‌ی صفحه
  // به‌صورت داینامیک با جاوااسکریپت ساخته می‌شن (مثل مودال «افزودن اولین حساب»)
  window.HesabinoUI = window.HesabinoUI || {};
  window.HesabinoUI.initCustomSelects = initCustomSelects;
  window.HesabinoUI.enhanceNativeSelects = enhanceNativeSelects;

  // ===== ۹. مودال تأیید یکپارچه (به‌جای confirm()/alert() مرورگر) =====
  // این مودال فقط یک‌بار (اولین باری که لازم بشه) ساخته و به body اضافه می‌شه؛ چون
  // توی public.js تعریف شده، توی همه‌ی صفحات اپ در دسترسه، بدون این‌که لازم باشه
  // مارک‌آپش رو توی تک‌تک view ها تکرار کنیم.
  // نکته‌ی مهم: عمداً به‌جای closeModal سراسری هر صفحه (که هر مودال بازی رو می‌بنده)،
  // خودش open/close مستقل داره؛ این‌طوری اگه از داخل یک مودال دیگه (مثلاً فرم ویرایش)
  // صدا زده بشه، با انصراف از حذف، اون مودال زیرین باز می‌مونه.
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

  // options: { title, confirmText, cancelText, danger } — همه اختیاری
  // خروجی یک Promise<boolean> هست: true اگه کاربر تأیید کرد، false اگه انصراف داد
  // (با کلیک بیرون از کارت، دکمه‌ی ضربدر، یا کلید Escape هم انصراف حساب می‌شه)
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
    // برای عملیات حذف (خطرناک) دکمه‌ی تأیید قرمزه؛ فقط اگه صریحاً danger:false داده بشه، رنگ اصلی اپ می‌شه
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

  // ===== ۱۰. اجرای همه توابع بعد از آماده شدن DOM =====
  function onReady() {
    setupLoader();
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

  // وقتی کاربر تم رو عوض می‌کنه (از هدر یا تنظیمات)، رنگ نمودارها هم آپدیت بشه
  document.addEventListener('hesabino:theme-changed', updateChartsTheme);
  document.addEventListener('hesabino:accent-changed', updateChartsTheme);

})();