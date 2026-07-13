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
          $(input).pDatepicker?.({ format: 'YYYY/MM/DD', initialValue: false });
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
      onReady: function (selectedDates, dateStr, instance) {
        instance.calendarContainer.classList.add('rtl-timepicker');
      }
    });
  }

  // ===== ۸. سلکت باکس سفارشی =====
  function initCustomSelects() {
    const selects = document.querySelectorAll('.custom-select');
    selects.forEach((select) => {
      const btn = select.querySelector('.select-btn');
      const dropdown = select.querySelector('.dropdown');
      const search = select.querySelector('.search-input');
      const options = select.querySelectorAll('.option');
      const value = select.querySelector('.selected-value');
      const icon = btn.querySelector('svg');

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.dropdown').forEach(d => {
          if (d !== dropdown) d.classList.add('hidden');
        });
        dropdown.classList.toggle('hidden');
        if (!dropdown.classList.contains('hidden')) {
          setPosition();
          search.focus();
        }
        icon.classList.toggle('rotate-180');
      });

      options.forEach(item => {
        item.addEventListener('click', () => {
          value.innerText = item.innerText;
          dropdown.classList.add('hidden');
          search.value = '';
          options.forEach(opt => opt.style.display = 'block');
        });
      });

      search.addEventListener('input', () => {
        const text = search.value.toLowerCase();
        options.forEach(item => {
          item.style.display = item.innerText.toLowerCase().includes(text) ? 'block' : 'none';
        });
      });

      function setPosition() {
        dropdown.style.top = '';
        dropdown.style.bottom = '';
        const rect = btn.getBoundingClientRect();
        const dropdownHeight = 260;
        if ((window.innerHeight - rect.bottom) < dropdownHeight && rect.top > dropdownHeight) {
          dropdown.style.bottom = 'calc(100% + 8px)';
        } else {
          dropdown.style.top = 'calc(100% + 8px)';
        }
      }
    });

    document.addEventListener('click', () => {
      document.querySelectorAll('.dropdown').forEach(d => d.classList.add('hidden'));
    });

    window.addEventListener('resize', () => {
      document.querySelectorAll('.custom-select').forEach(select => {
        const dropdown = select.querySelector('.dropdown');
        if (!dropdown.classList.contains('hidden')) {
          const btn = select.querySelector('.select-btn');
          dropdown.style.top = '';
          dropdown.style.bottom = '';
          const rect = btn.getBoundingClientRect();
          if (window.innerHeight - rect.bottom < 260 && rect.top > 260) {
            dropdown.style.bottom = 'calc(100% + 8px)';
          } else {
            dropdown.style.top = 'calc(100% + 8px)';
          }
        }
      });
    });
  }

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
