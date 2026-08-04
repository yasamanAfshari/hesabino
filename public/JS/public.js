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

  // select => { close } — برای بستن/ری‌پوزیشن کردن از بیرون (کلیک بیرون، اسکرول، resize)
  // بیرون از تابع نگه داشته می‌شه چون initCustomSelects ممکنه چند بار صدا زده بشه
  // (مثلاً وقتی مودالی به‌صورت داینامیک بعد از لود اولیه‌ی صفحه ساخته می‌شه)
  const openSelects = new Map();
  let customSelectGlobalListenersBound = false;

  function initCustomSelects(root) {
    const scope = root || document;

    scope.querySelectorAll('.custom-select:not([data-hb-select-wired])').forEach((select) => {
      select.setAttribute('data-hb-select-wired', '1');

      const btn = select.querySelector('.select-btn');
      const dropdown = select.querySelector('.dropdown');
      const search = select.querySelector('.search-input');
      const options = select.querySelectorAll('.option');
      const value = select.querySelector('.selected-value');
      const icon = btn.querySelector('svg');
      const dropdownHeight = 260;

      // نکته‌ی مهم: بعد از این‌که dropdown به body منتقل می‌شه، دیگه داخل select
      // نیست؛ پس همه‌جا از همین رفرنس‌های بسته‌شده (closure) استفاده می‌کنیم، نه
      // select.querySelector('.dropdown') که بعد از جابه‌جایی چیزی پیدا نمی‌کنه.
      let placeholder = null;

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

        if (search) search.focus();
        if (icon) icon.classList.add('rotate-180');
        openSelects.set(select, { close: closeDropdown, reposition: positionDropdown, dropdown });
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
        if (dropdown.classList.contains('hidden')) {
          openDropdown();
        } else {
          closeDropdown();
        }
      });

      options.forEach(item => {
        item.addEventListener('click', () => {
          value.innerText = item.innerText;
          closeDropdown();
          if (search) search.value = '';
          options.forEach(opt => opt.style.display = 'block');
        });
      });

      if (search) {
        search.addEventListener('input', () => {
          const text = search.value.toLowerCase();
          options.forEach(item => {
            item.style.display = item.innerText.toLowerCase().includes(text) ? 'block' : 'none';
          });
        });
      }
    });

    if (customSelectGlobalListenersBound) return;
    customSelectGlobalListenersBound = true;

    document.addEventListener('click', () => {
      openSelects.forEach((entry) => entry.close());
    });

    // اسکرول شدن صفحه یا هر کانتینر داخلی (مثل بدنه‌ی مودال) => دراپ‌داون‌های باز بسته بشن،
    // مگر این‌که خودِ اسکرول داخل لیست آپشن‌های همون دراپ‌داون اتفاق افتاده باشه
    // (چون از capture:true استفاده شده، اسکرول هر عنصر داخلی هم که رویدادش bubble نمی‌شه گرفته می‌شه)
    document.addEventListener('scroll', (e) => {
      openSelects.forEach((entry) => {
        if (entry.dropdown.contains(e.target)) return;
        entry.close();
      });
    }, true);

    window.addEventListener('resize', () => {
      openSelects.forEach((entry) => entry.reposition());
    });
  }

  // امکان صدا زدن دوباره‌ی این تابع برای مودال‌هایی که بعد از لود اولیه‌ی صفحه
  // به‌صورت داینامیک با جاوااسکریپت ساخته می‌شن (مثل مودال «افزودن اولین حساب»)
  window.HesabinoUI = window.HesabinoUI || {};
  window.HesabinoUI.initCustomSelects = initCustomSelects;

  // ===== ۹. اجرای همه توابع بعد از آماده شدن DOM =====
  function onReady() {
    setupLoader();
    initCharts();
    initExpenseRatioChart();
    initProgressBar();
    initDatepickerFallback();
    initTimePickers();
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
