(function () {
  'use strict';

  const API_BASE = '/api';

  function authHeaders(extra) {
    const token = localStorage.getItem('access_token');
    return Object.assign({ Authorization: `Bearer ${token}` }, extra || {});
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[ch]));
  }

  function toPersianDigits(str) {
    const digits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return String(str).replace(/[0-9]/g, (d) => digits[+d]);
  }

  function formatAmount(amount) {
    const n = Math.round(Number(amount || 0));
    const grouped = Math.abs(n).toLocaleString('en-US');
    return (n < 0 ? '-' : '') + toPersianDigits(grouped) + ' تومان';
  }

  const CATEGORY_COLORS = {
    'خوراک': '#FF9B44',
    'خرید و پوشاک': '#FF9EE7',
    'حمل و نقل': '#C8AC4E',
    'تفریح و سرگرمی': '#55B5B1',
    'سلامت و تناسب اندام': '#9DE18B',
    'آموزش و توسعه': '#9D5C8F',
    'سرمایه‌گذاری': '#E5DC44',
    'بدهی': '#B9403C',
    'مسکن و خدمات': '#745C52',
    'سایر': '#DADADA',
  };
  function colorFor(category) {
    return CATEGORY_COLORS[category] || '#94A3B8';
  }

  function cssVar(name, fallback) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  }

  let cashFlowChart = null;
  let donutChart = null;
  let top5Chart = null;
  let trendChart = null;

  function destroyExistingChart(canvas) {
    if (window.Chart && Chart.getChart) {
      const existing = Chart.getChart(canvas);
      if (existing) existing.destroy();
    }
  }

  // ===== کارت‌های خلاصه‌ی کل بازه =====
  function renderTotals(data) {
    document.getElementById('report-total-savings').textContent = formatAmount(data.totals.savings);
    document.getElementById('report-total-expense').textContent = formatAmount(data.totals.expense);
    document.getElementById('report-total-income').textContent = formatAmount(data.totals.income);
  }

  // ===== جریان مالی میله‌ای؛ فقط ماه‌هایی که واقعاً تراکنش دارند =====
  function renderCashFlowChart(data) {
    const canvas = document.getElementById('reportCashFlowChart');
    if (!canvas || !window.Chart) return;
    if (cashFlowChart) cashFlowChart.destroy();
    destroyExistingChart(canvas);
    cashFlowChart = null;

    const months = data.cashFlow.filter((m) => m.hasData);
    const wrapper = canvas.parentElement;
    let emptyEl = wrapper ? wrapper.querySelector('.report-cashflow-empty') : null;

    if (!months.length) {
      canvas.classList.add('hidden');
      if (wrapper && !emptyEl) {
        emptyEl = document.createElement('p');
        emptyEl.className = 'report-cashflow-empty text-zinc-400 !text-sm text-center py-10';
        emptyEl.textContent = 'هنوز تراکنشی در این بازه ثبت نشده است.';
        wrapper.appendChild(emptyEl);
      }
      return;
    }
    canvas.classList.remove('hidden');
    if (emptyEl) emptyEl.remove();

    cashFlowChart = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: months.map((m) => m.monthLabel),
        datasets: [
          { label: 'درآمد', data: months.map((m) => m.income), backgroundColor: '#1751D0' },
          { label: 'هزینه', data: months.map((m) => m.expense), backgroundColor: '#A9C6FB' },
        ],
      },
      options: { plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true } } },
    });
  }

  // ===== دونات هزینه به تفکیک دسته؛ بدون داده = دایره‌ی رسم نشده (نه یک دایره‌ی الکی پر) =====
  function renderCategoryDonut(data) {
    const legendEl = document.getElementById('report-category-legend');
    const canvas = document.getElementById('reportDonutChart');
    if (donutChart) donutChart.destroy();
    if (canvas) destroyExistingChart(canvas);
    donutChart = null;

    if (!data.categoryBreakdown.length) {
      legendEl.innerHTML = '<p class="text-zinc-400 !text-sm">در این بازه هزینه‌ای ثبت نشده است.</p>';
      return;
    }

    legendEl.innerHTML = data.categoryBreakdown.map((c) => `
      <div class="flex items-center gap-2 !text-xs">
        <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background:${colorFor(c.category)}"></span>
        <span class="text-zinc-600 truncate">${escapeHtml(c.category)}</span>
        <span class="text-zinc-400 mr-auto">${toPersianDigits(c.percent)}٪</span>
      </div>
    `).join('');

    if (!canvas || !window.Chart) return;
    donutChart = new Chart(canvas.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: data.categoryBreakdown.map((c) => c.category),
        datasets: [{ data: data.categoryBreakdown.map((c) => c.amount), backgroundColor: data.categoryBreakdown.map((c) => colorFor(c.category)) }],
      },
      options: { plugins: { legend: { display: false } }, cutout: '65%' },
    });
  }

  // ===== ۵ دسته پرهزینه =====
  function renderTop5Chart(data) {
    const canvas = document.getElementById('reportTop5Chart');
    if (!canvas || !window.Chart) return;
    if (top5Chart) top5Chart.destroy();
    destroyExistingChart(canvas);
    top5Chart = null;

    const wrapper = canvas.parentElement;
    let emptyEl = wrapper ? wrapper.querySelector('.report-top5-empty') : null;

    if (!data.top5Categories.length) {
      canvas.classList.add('hidden');
      if (wrapper && !emptyEl) {
        emptyEl = document.createElement('p');
        emptyEl.className = 'report-top5-empty text-zinc-400 !text-sm text-center py-10';
        emptyEl.textContent = 'در این بازه هزینه‌ای ثبت نشده است.';
        wrapper.appendChild(emptyEl);
      }
      return;
    }
    canvas.classList.remove('hidden');
    if (emptyEl) emptyEl.remove();

    top5Chart = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: data.top5Categories.map((c) => c.category),
        datasets: [{ data: data.top5Categories.map((c) => c.amount), backgroundColor: data.top5Categories.map((c) => colorFor(c.category)) }],
      },
      options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
    });
  }

  // ===== نسبت هزینه به درآمد (حلقه‌ای)؛ فقط ماه‌های دارای تراکنش واقعی =====
  function renderRatioRings(data) {
    const container = document.getElementById('report-ratio-rings');
    const months = data.cashFlow.filter((m) => m.hasData);

    if (!months.length) {
      container.innerHTML = '<p class="text-zinc-400 !text-sm w-full text-center py-6">داده‌ای برای محاسبه‌ی این نسبت در این بازه وجود ندارد.</p>';
      return;
    }

    container.innerHTML = '';

    months.forEach((m) => {
      const hasIncome = m.income > 0;
      const ratio = hasIncome ? Math.round((m.expense / m.income) * 100) : (m.expense > 0 ? Infinity : 0);
      const displayRatio = Number.isFinite(ratio) ? `${toPersianDigits(ratio)}٪` : '+۱۰۰٪';
      const clamped = Number.isFinite(ratio) ? Math.max(0, Math.min(100, ratio)) : 100;
      const trackColor = !Number.isFinite(ratio) || ratio > 100 ? '#fca5a5' : ratio > 80 ? '#fdba74' : cssVar('--color-chart-track', '#D7E4EF');
      const fillColor = !Number.isFinite(ratio) || ratio > 100 ? '#ef4444' : ratio > 80 ? '#f97316' : cssVar('--color-chart-income', '#0062AE');

      const wrapper = document.createElement('div');
      wrapper.className = 'flex flex-col items-center gap-1 shrink-0';

      const circle = document.createElement('div');
      circle.className = 'relative w-16 h-16 rounded-full flex items-center justify-center';
      circle.style.background = `conic-gradient(${fillColor} ${clamped * 3.6}deg, ${trackColor} ${clamped * 3.6}deg)`;

      const inner = document.createElement('div');
      inner.className = 'w-12 h-12 rounded-full flex items-center justify-center';
      inner.style.background = cssVar('--color-surface2-color', '#F5F7FA');
      inner.innerHTML = `<span class="text-sm font-bold" style="color:${fillColor}">${displayRatio}</span>`;

      circle.appendChild(inner);

      const label = document.createElement('span');
      label.className = 'mt-1 text-sm text-gray-700';
      label.textContent = m.monthLabel;

      wrapper.appendChild(circle);
      wrapper.appendChild(label);
      container.appendChild(wrapper);
    });
  }

  // ===== روند تجمعی تراز (خطی)؛ همه‌ی ماه‌های بازه، چون «بدون تغییر» خودش یک واقعیت معتبر است =====
  function renderTrendChart(data) {
    const canvas = document.getElementById('reportTrendChart');
    if (!canvas || !window.Chart) return;
    if (trendChart) trendChart.destroy();
    destroyExistingChart(canvas);

    trendChart = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: data.cumulativeTrend.map((m) => m.monthLabel),
        datasets: [{
          label: 'تراز تجمعی',
          data: data.cumulativeTrend.map((m) => m.cumulativeBalance),
          borderColor: '#1751D0',
          backgroundColor: 'rgba(23,81,208,.08)',
          tension: 0.3,
          fill: true,
        }],
      },
      options: { plugins: { legend: { display: false } } },
    });
  }

  // ===== تحلیل هوشمند و پیشنهادات =====
  function renderInsights(data) {
    const el = document.getElementById('report-insights');
    document.getElementById('report-ai-badge').textContent = data.insightsUsedAi ? 'تولیدشده با هوش مصنوعی' : 'تحلیل مبتنی بر قوانین';

    if (!data.insights.length) {
      el.innerHTML = '<p class="text-zinc-400 !text-sm">تحلیلی برای نمایش وجود ندارد.</p>';
      return;
    }

    el.innerHTML = data.insights.map((i) => {
      const isWarning = i.tone === 'warning';
      const bg = isWarning ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700';
      return `<div class="rounded-lg px-4 py-2.5 !text-sm ${bg}">${escapeHtml(i.text)}</div>`;
    }).join('');
  }

  // ===== کارت‌های وضعیت لحظه‌ای =====
  function renderStatusCards(data) {
    document.getElementById('report-pending-cheques').textContent = `${toPersianDigits(data.pendingChequesCount)} عدد`;
    document.getElementById('report-overdue-debts').textContent = `${toPersianDigits(data.overdueDebtsCount)} عدد`;
    document.getElementById('report-receivable').textContent = formatAmount(data.debtsSummary.receivable);
    document.getElementById('report-my-debt').textContent = formatAmount(data.debtsSummary.myDebt);
  }

  // ===== جدول میانگین هزینه‌ها =====
  function renderCategoryTable(data) {
    const el = document.getElementById('report-category-table');
    if (!data.categoryAverages.length) {
      el.innerHTML = '<tr><td colspan="4" class="text-zinc-400 !text-sm text-center py-6">داده‌ای برای نمایش وجود ندارد.</td></tr>';
      return;
    }

    el.innerHTML = data.categoryAverages.map((row) => {
      let comparisonHtml = '<span class="text-zinc-400">داده کافی نیست</span>';
      if (row.comparisonPercent !== null) {
        if (row.comparisonPercent > 5) {
          comparisonHtml = `<span class="text-red-600 font-semibold">بیشتر از میانگین (${toPersianDigits(row.comparisonPercent)}٪)</span>`;
        } else if (row.comparisonPercent < -5) {
          comparisonHtml = `<span class="text-green-600 font-semibold">کمتر از میانگین (${toPersianDigits(Math.abs(row.comparisonPercent))}٪)</span>`;
        } else {
          comparisonHtml = '<span class="text-zinc-500">برابر با میانگین</span>';
        }
      }

      return `
        <tr class="border-b border-gray-50">
          <td class="py-2.5 px-2 font-medium text-zinc-700">${escapeHtml(row.category)}</td>
          <td class="py-2.5 px-2 text-zinc-600">${formatAmount(row.monthlyAverage)}</td>
          <td class="py-2.5 px-2 text-zinc-600">${formatAmount(row.rangeExpense)}</td>
          <td class="py-2.5 px-2">${comparisonHtml}</td>
        </tr>
      `;
    }).join('');
  }

  async function loadReport(range) {
    try {
      const res = await fetch(`${API_BASE}/reports?range=${encodeURIComponent(range)}`, { headers: authHeaders() });
      if (!res.ok) throw new Error('خطا در دریافت گزارش');
      const data = await res.json();

      renderTotals(data);
      renderCashFlowChart(data);
      renderCategoryDonut(data);
      renderTop5Chart(data);
      renderRatioRings(data);
      renderTrendChart(data);
      renderInsights(data);
      renderStatusCards(data);
      renderCategoryTable(data);
    } catch (err) {
      console.error(err);
    }
  }

  // ===== نگاشت فیلتر سراسری هدر (امروز/هفته/ماه/سال) روی بازه‌های خودِ گزارش =====
  // گزارش‌ها دقت روزانه/هفتگی ندارن، پس «امروز» و «این هفته» به نزدیک‌ترین بازه‌ی
  // معنادار یعنی «این ماه» نگاشت می‌شن؛ «امسال» هم مستقیم به «سال جاری»
  function mapGlobalPeriodToRange(period) {
    return period === 'year' ? 'year' : 'month';
  }

  document.addEventListener('DOMContentLoaded', () => {
    const select = document.getElementById('reportRangeSelect');

    if (window.HesabinoPeriod) {
      select.value = mapGlobalPeriodToRange(window.HesabinoPeriod.get());
    }
    loadReport(select.value);

    select.addEventListener('change', () => loadReport(select.value));

    // ===== با تغییر فیلتر سراسری هدر، بازه‌ی گزارش هم همگام می‌شه =====
    document.addEventListener(window.HesabinoPeriod ? window.HesabinoPeriod.EVENT_NAME : 'hesabino:period-change', (e) => {
      const mapped = mapGlobalPeriodToRange(e.detail.period);
      select.value = mapped;
      loadReport(mapped);
    });
  });
})();
