(function () {
  'use strict';

  const API_BASE = '/api';
  function formatAmount(amount) {
    const n = Math.round(Number(amount || 0));
    const grouped = Math.abs(n).toLocaleString('en-US');
    return (n < 0 ? '-' : '') + toPersianDigits(grouped) + ' تومان';
  }

  function formatNumber(n) {
    return toPersianDigits(Math.round(Number(n || 0)).toLocaleString('en-US'));
  }

  function ensureToastContainer() {
    let el = document.getElementById('hesabinoToastContainer');
    if (!el) {
      el = document.createElement('div');
      el.id = 'hesabinoToastContainer';
      el.style.cssText = 'position:fixed;bottom:20px;left:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;';
      document.body.appendChild(el);
    }
    return el;
  }

  function showToast(message, type) {
    const container = ensureToastContainer();
    const toast = document.createElement('div');
    const bg = type === 'error' ? '#ef4444' : '#22c55e';
    toast.style.cssText = `background:${bg};color:#fff;padding:10px 16px;border-radius:10px;font-size:13px;box-shadow:0 4px 12px rgba(0,0,0,.15);`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function setWidth(id, percent) {
    const el = document.getElementById(id);
    if (el) el.style.width = Math.max(0, Math.min(100, percent)) + '%';
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

  const PERSIAN_MONTH_NAMES = {
    1: 'فروردین', 2: 'اردیبهشت', 3: 'خرداد', 4: 'تیر', 5: 'مرداد', 6: 'شهریور',
    7: 'مهر', 8: 'آبان', 9: 'آذر', 10: 'دی', 11: 'بهمن', 12: 'اسفند',
  };

  let donutChartInstance = null;
  let lineChartInstance = null;
  let latestData = null;
  let hasAccounts = false;

  // (این حالت وقتی پیش می‌آید که مثلاً صفحه بدون رفرش کامل دوباره اسکریپت را اجرا کند، یا رندر دو بار صدا زده شود)
  function destroyExistingChart(canvas) {
    if (!canvas || !window.Chart) return;
    const existing = typeof Chart.getChart === 'function' ? Chart.getChart(canvas) : null;
    if (existing) existing.destroy();
  }

  // ===== بنر هوشمند بالای صفحه =====
  function renderHero(data) {
    const behaviorEl = document.getElementById('hero-insight-behavior');
    if (behaviorEl) {
      if (data.topCategory && data.topCategory.amount > 0) {
        const changeText = data.topCategory.changePercent > 0
          ? `نسبت به ماه قبل ${toPersianDigits(data.topCategory.changePercent)}٪ افزایش داشته`
          : data.topCategory.changePercent < 0
            ? `نسبت به ماه قبل ${toPersianDigits(Math.abs(data.topCategory.changePercent))}٪ کاهش داشته`
            : 'نسبت به ماه قبل تغییر محسوسی نداشته';
        const weekdayText = data.topWeekday ? ` و ${data.topWeekday}‌ها بیشترین هزینه ثبت شده است` : '';
        behaviorEl.innerHTML = `تحلیل رفتار خرج: هزینه‌ی <strong class="text-orange-color">«${escapeHtml(data.topCategory.category)}»</strong> ${changeText}${weekdayText}.`;
      } else {
        behaviorEl.textContent = 'هنوز تراکنشی برای تحلیل رفتار خرج این ماه ثبت نشده است.';
      }
    }

    const predictionEl = document.getElementById('hero-insight-prediction');
    if (predictionEl) {
      const p = data.prediction;
      if (p.budgetTotal > 0) {
        const diff = p.projectedOverBudget;
        const diffText = diff > 0
          ? `یعنی <strong class="text-red-color">${formatAmount(diff)}</strong> بیشتر از بودجه تعیین‌شده`
          : `که در محدوده‌ی بودجه‌ی تعیین‌شده است`;
        predictionEl.innerHTML = `پیش‌بینی پایان ماه: با روند فعلی، هزینه‌ها به حدود <strong class="text-main-color">${formatAmount(p.projectedExpense)}</strong> می‌رسد؛ ${diffText}.`;
      } else {
        predictionEl.innerHTML = `پیش‌بینی پایان ماه: با روند فعلی، هزینه‌ها تا پایان ماه به حدود <strong class="text-main-color">${formatAmount(p.projectedExpense)}</strong> می‌رسد.`;
      }
    }
  }

  function capPercentChange(change) {
    return Math.max(-999, Math.min(999, change));
  }

  // ===== برچسب «نسبت به ...» بر اساس بازه‌ی انتخابی فیلتر سراسری هدر =====
  const PREV_PERIOD_LABELS = {
    today: 'دیروز',
    week: 'هفته قبل',
    month: 'ماه قبل',
    year: 'سال قبل',
  };

  // ===== ردیف کارت‌های آماری بالا =====
  function renderStatCards(data) {
    const period = data.period || 'month';
    const periodLabel = (window.HesabinoPeriod && window.HesabinoPeriod.LABELS[period]) || 'این ماه';
    const prevLabel = PREV_PERIOD_LABELS[period] || 'دوره قبل';
    setText('stat-income-label', `درآمد ${periodLabel}`);
    setText('stat-expense-label', `هزینه‌های ${periodLabel}`);

    setText('stat-accounts-count', `${toPersianDigits(data.accounts.accountsCount)} حساب`);
    setText('stat-balance', formatAmount(data.totals.balance));

    // مقایسه با بازه‌ی «درست قبل از» بازه‌ی انتخابی؛ برای هر چهار فیلتر (روز/هفته/ماه/سال) کار می‌کند
    const previousPeriod = data.previousPeriod || { income: 0, expense: 0 };

    setText('stat-income', formatAmount(data.totals.income));
    const incomeTrendEl = document.getElementById('stat-income-trend');
    if (previousPeriod.income > 0 || data.totals.income > 0) {
      const incomeChange = capPercentChange(
        previousPeriod.income > 0
          ? Math.round(((data.totals.income - previousPeriod.income) / previousPeriod.income) * 100)
          : (data.totals.income > 0 ? 100 : 0),
      );
      if (incomeTrendEl) {
        incomeTrendEl.className = incomeChange >= 0 ? 'trend-p flex justify-center items-center px-1.5' : 'trend-m flex justify-center items-center px-1.5';
        const incomeChangeText = Math.abs(incomeChange) >= 999 ? '+۹۹۹' : toPersianDigits(Math.abs(incomeChange));
        incomeTrendEl.innerHTML = `<span>${incomeChangeText}٪</span>`;
      }
      setText('stat-income-subtitle', incomeChange >= 0 ? `نسبت به ${prevLabel} بهتر` : `نسبت به ${prevLabel} کمتر`);
    } else {
      if (incomeTrendEl) {
        incomeTrendEl.className = 'trend flex justify-center items-center px-1.5';
        incomeTrendEl.innerHTML = '<span>—</span>';
      }
      setText('stat-income-subtitle', `مجموع درآمد ${periodLabel}`);
    }

    setText('stat-expense', formatAmount(data.totals.expense));
    const expenseTrendEl = document.getElementById('stat-expense-trend');
    if (previousPeriod.expense > 0 || data.totals.expense > 0) {
      const expenseChange = capPercentChange(
        previousPeriod.expense > 0
          ? Math.round(((data.totals.expense - previousPeriod.expense) / previousPeriod.expense) * 100)
          : (data.totals.expense > 0 ? 100 : 0),
      );
      if (expenseTrendEl) {
        expenseTrendEl.className = expenseChange <= 0 ? 'trend-p flex justify-center items-center px-1.5' : 'trend-m flex justify-center items-center px-1.5';
        const expenseChangeText = Math.abs(expenseChange) >= 999 ? '+۹۹۹' : toPersianDigits(Math.abs(expenseChange));
        expenseTrendEl.innerHTML = `<span>${expenseChangeText}٪</span>`;
      }
    } else {
      if (expenseTrendEl) {
        expenseTrendEl.className = 'trend flex justify-center items-center px-1.5';
        expenseTrendEl.innerHTML = '<span>—</span>';
      }
    }
    if (period === 'month') {
      const budgetPercent = data.budget.totalBudget > 0
        ? Math.round((data.totals.expense / data.budget.totalBudget) * 100)
        : null;
      setText('stat-expense-subtitle', budgetPercent !== null ? `${toPersianDigits(budgetPercent)}٪ از بودجه مصرف شد` : 'بدون بودجه تعیین‌شده');
    } else {
      setText('stat-expense-subtitle', `مجموع هزینه‌های ${periodLabel}`);
    }

    const cs = data.chequesSummary;
    setText('stat-cheques-count', `${toPersianDigits(cs.pendingCount)} عدد`);
    setText('stat-cheques-amount', formatAmount(cs.pendingTotal));
    setText('stat-cheques-subtitle', cs.nearestDays !== null ? `نزدیک‌ترین: ${toPersianDigits(cs.nearestDays)} روز دیگر` : 'چک در انتظاری وجود ندارد');

    setText('stat-savings-rate', data.totals.hasIncomeData ? `${toPersianDigits(data.totals.savingsRatePercent)}٪` : '—');
    const savingsTrendEl = document.getElementById('stat-savings-trend');
    if (savingsTrendEl) {
      if (data.totals.hasIncomeData && previousPeriod.income > 0) {
        const prevBalance = previousPeriod.income - previousPeriod.expense;
        const prevSavingsRatePercent = Math.round((prevBalance / previousPeriod.income) * 100);
        const savingsPointsChange = data.totals.savingsRatePercent - prevSavingsRatePercent;
        savingsTrendEl.className = savingsPointsChange >= 0 ? 'trend-p flex justify-center items-center px-1.5' : 'trend-m flex justify-center items-center px-1.5';
        savingsTrendEl.innerHTML = `<span>${toPersianDigits(Math.abs(savingsPointsChange))}٪</span>`;
      } else {
        savingsTrendEl.className = 'trend flex justify-center items-center px-1.5';
        savingsTrendEl.innerHTML = '<span>—</span>';
      }
    }

    setText('stat-health-score', data.health.score !== null ? `${toPersianDigits(data.health.score)}/۱۰۰` : '—');
    setText('stat-health-label', data.health.label);
  }

  function renderCategoryChart(data, periodLabel) {
    const label = periodLabel || (window.HesabinoPeriod && window.HesabinoPeriod.LABELS[data.period || 'month']) || 'این ماه';
    setText('category-chart-title', `هزینه به تفکیک دسته (${label})`);
    const legendEl = document.getElementById('category-legend-list');
    if (legendEl) {
      if (!data.categoryBreakdown.length) {
        legendEl.innerHTML = `<p class="text-zinc-400 !text-sm col-span-2">هنوز هزینه‌ای برای ${label} ثبت نشده است</p>`;
      } else {
        legendEl.innerHTML = data.categoryBreakdown.map((c) => `
          <div class="flex items-center justify-between">
            <span class="flex items-center gap-2">
              <span class="w-3 h-3 rounded-full" style="background:${colorFor(c.category)}"></span> ${escapeHtml(c.category)}
            </span>
            <span class="text-zinc-400 !text-xs">${toPersianDigits(c.percent)}٪</span>
          </div>
        `).join('');
      }
    }

    const canvas = document.getElementById('donutChart');
    if (canvas && window.Chart) {
      if (donutChartInstance) donutChartInstance.destroy();
      destroyExistingChart(canvas);
      donutChartInstance = null;

      if (!data.categoryBreakdown.length) return;

      const labels = data.categoryBreakdown.map((c) => c.category);
      const values = data.categoryBreakdown.map((c) => c.amount);
      const colors = data.categoryBreakdown.map((c) => colorFor(c.category));
      donutChartInstance = new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 0 }] },
        options: { plugins: { legend: { display: false } }, cutout: '65%' },
      });
    }
  }

  // ===== نمودار جریان مالی (خطی، فقط ماه‌هایی که واقعاً تراکنش دارند) =====
  function renderCashFlowChart(data) {
    const canvas = document.getElementById('myChart');
    if (!canvas || !window.Chart) return;
    if (lineChartInstance) lineChartInstance.destroy();
    destroyExistingChart(canvas);
    lineChartInstance = null;

    const wrapper = canvas.parentElement;
    let emptyEl = wrapper ? wrapper.querySelector('.cashflow-empty-state') : null;

    const monthsWithData = data.cashFlow.filter((m) => m.hasData);

    if (!monthsWithData.length) {
      canvas.classList.add('hidden');
      if (wrapper && !emptyEl) {
        emptyEl = document.createElement('p');
        emptyEl.className = 'cashflow-empty-state text-zinc-400 !text-sm text-center py-10';
        emptyEl.textContent = 'هنوز تراکنشی برای رسم نمودار جریان مالی ثبت نشده است.';
        wrapper.appendChild(emptyEl);
      }
      return;
    }

    canvas.classList.remove('hidden');
    if (emptyEl) emptyEl.remove();

    const labels = monthsWithData.map((m) => toPersianDigits(m.month));
    lineChartInstance = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'درآمد', data: monthsWithData.map((m) => m.income), borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,.1)', tension: 0.35, fill: true },
          { label: 'هزینه', data: monthsWithData.map((m) => m.expense), borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,.1)', tension: 0.35, fill: true },
        ],
      },
      options: { plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true } } },
    });
  }

  // ===== نسبت هزینه به درآمد (دایره‌ی conic-gradient، فقط برای ماه‌هایی که واقعاً تراکنش دارند) =====
  function renderExpenseRatio(data) {
    const container = document.getElementById('expenseChart');
    if (!container) return;
    container.innerHTML = '';

    const monthsWithData = data.cashFlow.filter((m) => m.hasData);

    if (!monthsWithData.length) {
      container.innerHTML = '<p class="text-zinc-400 !text-sm w-full text-center py-6">هنوز داده‌ای برای محاسبه‌ی نسبت هزینه به درآمد ثبت نشده است.</p>';
      return;
    }

    monthsWithData.forEach((m) => {
      const hasIncome = m.income > 0;
      const ratio = hasIncome ? Math.round((m.expense / m.income) * 100) : (m.expense > 0 ? Infinity : 0);
      const displayRatio = Number.isFinite(ratio) ? `${toPersianDigits(ratio)}٪` : '+۱۰۰٪';
      const clamped = Number.isFinite(ratio) ? Math.max(0, Math.min(100, ratio)) : 100;
      const trackColor = !Number.isFinite(ratio) || ratio > 100 ? '#fca5a5' : ratio > 80 ? '#fdba74' : cssVar('--color-chart-track', '#D7E4EF');
      const fillColor = !Number.isFinite(ratio) || ratio > 100 ? '#ef4444' : ratio > 80 ? '#f97316' : cssVar('--color-chart-income', '#0062AE');
      const monthLabel = m.month.split('/')[1];
      const monthName = PERSIAN_MONTH_NAMES[Number(monthLabel)] || toPersianDigits(monthLabel);

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
      label.textContent = monthName;

      wrapper.appendChild(circle);
      wrapper.appendChild(label);
      container.appendChild(wrapper);
    });
  }

  // ===== تراز ماه جاری =====
  function renderMonthlyBalance(data) {
    const el = document.getElementById('stat-monthly-balance');
    if (!el) return;
    const positive = data.totals.monthlyBalance >= 0;
    el.className = `flex-1 flex items-center justify-center font-bold ${positive ? 'text-green-color' : 'text-red-color'}`;
    el.innerHTML = `<span class="!text-2xl">${formatAmount(data.totals.monthlyBalance)}</span>`;
  }

  // ===== نزدیک‌ترین هدف پس‌انداز =====
  function renderClosestGoal(data) {
    const goal = data.closestGoal;
    const wrapper = document.getElementById('closest-goal-wrapper');
    if (!wrapper) return;
    if (!goal) {
      wrapper.innerHTML = '<p class="text-zinc-400 !text-sm">برای ثبت هدف مالی به بخش پس‌انداز مراجعه کنید.</p>';
      return;
    }
    setText('closest-goal-name', goal.title || '');
    setText('closest-goal-percent', `${toPersianDigits(goal.progressPercent)}٪`);
    setWidth('closest-goal-bar', goal.progressPercent);
    setText('closest-goal-saved', formatAmount(goal.currentAmount));
    setText('closest-goal-target', formatAmount(goal.targetAmount));
  }

  // ===== هشدارهای مالی (بودجه/سقف روزانه) =====
  function renderBudgetAlerts(data) {
    const container = document.getElementById('budget-alerts-container');
    if (!container) return;
    const cards = [];

    for (const cat of data.budgetAlerts.overBudgetCategories) {
      cards.push(`
        <div class="flex-shrink-0 w-full md:w-1/2 xl:w-1/3">
          <div class="bg-white rounded-2xl shadow-md border-r-4 border-rose-500 overflow-hidden card-hover transition-all h-full">
            <div class="p-5">
              <div class="flex justify-between items-start mb-3">
                <h3 class="font-bold text-gray-800 text-lg">دسته «${escapeHtml(cat.category)}»</h3>
                <span class="bg-rose-100 text-rose-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-rose-200">اتمام موجودی</span>
              </div>
              <div class="flex justify-between items-center mb-1">
                <span class="text-gray-700 font-semibold">بودجه تخصیص‌یافته</span>
                <span class="text-rose-600 font-bold text-xl">${formatAmount(cat.amount)}</span>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-3 mt-1"><div class="bg-rose-500 h-3 rounded-full" style="width:100%"></div></div>
              <div class="flex justify-between text-xs text-gray-500 mt-1">
                <span>هزینه شده: ${formatAmount(cat.spent)}</span>
                <span>باقیمانده: ۰ تومان</span>
              </div>
            </div>
          </div>
        </div>
      `);
    }

    for (const cat of data.budgetAlerts.nearLimitCategories) {
      cards.push(`
        <div class="flex-shrink-0 w-full md:w-1/2 xl:w-1/3">
          <div class="bg-white rounded-2xl shadow-md border-r-4 border-orange-color overflow-hidden card-hover transition-all h-full">
            <div class="p-5">
              <div class="flex justify-between items-start mb-3">
                <h3 class="font-bold text-gray-800 text-lg">دسته «${escapeHtml(cat.category)}»</h3>
                <span class="bg-amber-50 text-amber-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-amber-200">هشدار مصرف</span>
              </div>
              <p class="text-gray-700 mt-2 leading-relaxed text-base">
                تاکنون <strong class="text-amber-700 text-lg">${toPersianDigits(cat.progressPercent)}٪</strong> از بودجه‌ی این دسته را خرج کرده‌اید.
              </p>
              <div class="w-full bg-gray-200 rounded-full h-2.5 mt-3"><div class="bg-orange-color h-2.5 rounded-full" style="width:${cat.progressPercent}%"></div></div>
            </div>
          </div>
        </div>
      `);
    }

    const p = data.prediction;
    if (p.dailyAllowance !== null && p.todayExpense > p.dailyAllowance) {
      cards.push(`
        <div class="flex-shrink-0 w-full md:w-1/2 xl:w-1/3">
          <div class="bg-white rounded-2xl shadow-md border-r-4 border-red-color overflow-hidden card-hover transition-all h-full">
            <div class="p-5">
              <div class="flex justify-between items-start mb-3">
                <h3 class="font-bold text-gray-800 text-lg">حد مجاز روزانه</h3>
                <span class="bg-red-100 text-red-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-red-300">اضطراری</span>
              </div>
              <div class="bg-red-50 p-3 rounded-xl my-2 border border-red-100">
                <p class="text-red-800 font-medium leading-relaxed">
                  امروز بیشتر از سقف روزانه (<strong class="text-red-700">${formatAmount(p.dailyAllowance)}</strong>) خرج کرده‌اید.
                </p>
              </div>
            </div>
          </div>
        </div>
      `);
    }

    if (data.closestGoal) {
      cards.push(`
        <div class="flex-shrink-0 w-full md:w-1/2 xl:w-1/3">
          <div class="bg-white rounded-2xl shadow-md border-r-4 border-blue-500 overflow-hidden card-hover transition-all h-full">
            <div class="p-5">
              <div class="flex justify-between items-start mb-3">
                <h3 class="font-bold text-gray-800 text-lg">هدف «${escapeHtml(data.closestGoal.title)}»</h3>
                <span class="bg-blue-50 text-blue-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-blue-200">در حال پیشرفت</span>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-2.5 mt-3"><div class="bg-blue-500 h-2.5 rounded-full" style="width:${data.closestGoal.progressPercent}%"></div></div>
              <div class="mt-3 text-xs text-blue-600 bg-blue-50/60 p-2 rounded-lg">
                ${toPersianDigits(100 - data.closestGoal.progressPercent)}٪ دیگر باقی مانده تا رسیدن به این هدف
              </div>
            </div>
          </div>
        </div>
      `);
    }

    container.innerHTML = cards.length
      ? cards.join('')
      : '<p class="text-zinc-400 !text-sm p-2">در حال حاضر هشدار مالی‌ای وجود ندارد. وضعیت شما خوب است!</p>';
  }

  // ===== دارایی‌ها =====
  let assetsById = {};

  async function deleteAsset(id) {
    if (!(await window.HesabinoUI.confirmDialog('این دارایی حذف شود؟'))) return;
    try {
      const res = await fetch(`${API_BASE}/assets/${id}`, { method: 'DELETE', headers: authHeaders() });
      if (!res.ok) throw new Error('خطا در حذف دارایی');
      showToast('دارایی حذف شد', 'success');
      loadDashboard();
    } catch (err) {
      showToast(err.message || 'خطا در حذف دارایی', 'error');
    }
  }
  window.deleteAsset = deleteAsset;

  // ===== باز کردن مودال دارایی در حالت ویرایش، با پرکردن مقادیر فعلی =====
  function editAsset(id) {
    const asset = assetsById[id];
    if (!asset) return;
    const form = document.getElementById('assetForm');
    if (!form) return;
    form.reset();
    form.elements['id'].value = asset.id;
    form.elements['title'].value = asset.title;
    form.elements['type'].value = asset.type;
    if (asset.isQuantityBased && asset.type === 'gold') {
      form.elements['quantityGold'].value = asset.quantity ?? '';
      form.elements['unitPriceGold'].value = asset.unitPrice ?? '';
    } else if (asset.isQuantityBased && asset.type === 'currency') {
      form.elements['quantityCurrency'].value = asset.quantity ?? '';
      form.elements['unitPriceCurrency'].value = asset.unitPrice ?? '';
    } else {
      form.elements['value'].value = asset.value;
    }
    updateAssetFormFields();
    window.AmountInput.refreshForm(form);
    setText('assetModalTitle', 'ویرایش دارایی');
    setText('assetFormSubmit', 'ذخیره تغییرات');
    openModal('assetModal');
  }
  window.editAsset = editAsset;

  // ===== نمایش/پنهان‌سازی فیلدهای متناسب با نوع دارایی انتخاب‌شده =====
  function updateAssetFormFields() {
    const typeSelect = document.getElementById('assetTypeSelect');
    const valueField = document.getElementById('assetValueField');
    const goldFields = document.getElementById('assetQuantityFields-gold');
    const currencyFields = document.getElementById('assetQuantityFields-currency');
    if (!typeSelect || !valueField || !goldFields || !currencyFields) return;
    const type = typeSelect.value;

    goldFields.classList.toggle('hidden', type !== 'gold');
    currencyFields.classList.toggle('hidden', type !== 'currency');
    valueField.classList.toggle('hidden', type === 'gold' || type === 'currency');
    valueField.required = type !== 'gold' && type !== 'currency';
  }

  function renderAssets(data) {
    setText('assets-total', formatAmount(data.assets.totalValue));
    const list = document.getElementById('assets-list');
    if (!list) return;
    assetsById = {};
    data.assets.assets.forEach((a) => { assetsById[a.id] = a; });
    if (!data.assets.assets.length) {
      list.innerHTML = '<p class="text-zinc-400 !text-sm">هنوز دارایی‌ای ثبت نشده است.</p>';
      return;
    }
    list.innerHTML = data.assets.assets.map((a) => `
      <div class="flex items-center justify-between group">
        <span class="flex items-center gap-2 !text-sm text-zinc-700">
          <span class="!text-xs bg-purple-color-25 text-purple-color px-2 py-1 rounded-lg whitespace-nowrap">${escapeHtml(a.typeLabel)}</span>
          ${escapeHtml(a.title)}
        </span>
        <span class="flex items-center gap-2">
          <span class="!text-sm font-medium text-zinc-800">${formatAmount(a.value)}</span>
          <button onclick="editAsset(${a.id})" title="ویرایش" class="text-zinc-300 hover:text-main-color !text-xs">✎</button>
          <button onclick="deleteAsset(${a.id})" title="حذف" class="text-zinc-300 hover:text-red-color !text-xs">✕</button>
        </span>
      </div>
    `).join('');
  }

  // ===== اشتراک‌ها =====
  let subscriptionsById = {};

  async function deleteSubscription(id) {
    if (!(await window.HesabinoUI.confirmDialog('این اشتراک حذف شود؟'))) return;
    try {
      const res = await fetch(`${API_BASE}/subscriptions/${id}`, { method: 'DELETE', headers: authHeaders() });
      if (!res.ok) throw new Error('خطا در حذف اشتراک');
      showToast('اشتراک حذف شد', 'success');
      loadDashboard();
    } catch (err) {
      showToast(err.message || 'خطا در حذف اشتراک', 'error');
    }
  }
  window.deleteSubscription = deleteSubscription;

  function editSubscription(id) {
    const sub = subscriptionsById[id];
    if (!sub) return;
    const form = document.getElementById('subscriptionForm');
    if (!form) return;
    form.reset();
    form.elements['id'].value = sub.id;
    form.elements['title'].value = sub.title;
    form.elements['amount'].value = sub.amount;
    form.elements['billingDay'].value = sub.billingDay;
    window.AmountInput.refreshForm(form);
    setText('subscriptionModalTitle', 'ویرایش اشتراک');
    setText('subscriptionFormSubmit', 'ذخیره تغییرات');
    openModal('subscriptionModal');
  }
  window.editSubscription = editSubscription;

  function renderSubscriptions(data) {
    const list = document.getElementById('subscriptions-list');
    if (!list) return;
    subscriptionsById = {};
    data.subscriptions.subscriptions.forEach((s) => { subscriptionsById[s.id] = s; });

    const active = data.subscriptions.subscriptions
      .filter((s) => s.isActive)
      .sort((a, b) => a.daysLeft - b.daysLeft);

    if (!active.length) {
      list.innerHTML = '<p class="text-zinc-400 !text-sm">هنوز اشتراک فعالی ثبت نشده است.</p>';
      return;
    }
    list.innerHTML = active.map((s) => `
      <div class="flex items-center justify-between ${s.isUrgent ? 'bg-yellow-color-20' : ''} rounded-lg p-2.5">
        <span class="!text-sm font-medium text-zinc-800">${escapeHtml(s.title)}</span>
        <div class="flex items-center gap-2">
          <div class="text-left">
            <p class="!text-sm font-medium text-zinc-800">${formatAmount(s.amount)}</p>
            <p class="!text-xs ${s.isUrgent ? 'text-amber-600' : 'text-zinc-400'}">${s.daysLeft >= 0 ? toPersianDigits(s.daysLeft) + ' روز دیگر · ' + toPersianDigits(s.nextChargeDate) : 'سررسید گذشته · ' + toPersianDigits(s.nextChargeDate)}</p>
          </div>
          <button onclick="editSubscription(${s.id})" title="ویرایش" class="text-zinc-300 hover:text-main-color !text-xs">✎</button>
          <button onclick="deleteSubscription(${s.id})" title="حذف" class="text-zinc-300 hover:text-red-color !text-xs">✕</button>
        </div>
      </div>
    `).join('');
  }

  // ===== اقساط =====
  async function payLoan(id) {
    try {
      const res = await fetch(`${API_BASE}/installments/${id}/pay`, { method: 'POST', headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'خطا در ثبت پرداخت قسط');
      showToast('قسط با موفقیت پرداخت شد', 'success');
      loadDashboard();
    } catch (err) {
      showToast(err.message || 'خطا در ثبت پرداخت قسط', 'error');
    }
  }
  window.payLoan = payLoan;

  async function deleteLoan(id) {
    if (!(await window.HesabinoUI.confirmDialog('این وام/قسط حذف شود؟'))) return;
    try {
      const res = await fetch(`${API_BASE}/installments/${id}`, { method: 'DELETE', headers: authHeaders() });
      if (!res.ok) throw new Error('خطا در حذف قسط');
      showToast('وام/قسط حذف شد', 'success');
      loadDashboard();
    } catch (err) {
      showToast(err.message || 'خطا در حذف قسط', 'error');
    }
  }
  window.deleteLoan = deleteLoan;

  function renderInstallments(data) {
    const el = document.getElementById('installments-container');
    if (!el) return;
    const loans = data.installments.loans.filter((l) => !l.isCompleted);
    if (!loans.length) {
      el.innerHTML = '<p class="text-zinc-400 !text-sm">وام یا قسط فعالی ثبت نشده است.</p>';
      return;
    }
    el.innerHTML = loans.map((l, index) => `
      <div class="${index > 0 ? 'border-t border-gray-100 pt-3 mt-3' : ''}">
        <p class="!text-sm text-zinc-700 mb-1">${escapeHtml(l.title)}</p>
        <div class="w-full bg-gray-200 rounded-full h-2.5 mb-3">
          <div class="bg-orange-color h-2.5 rounded-full" style="width:${l.progressPercent}%"></div>
        </div>
        <div class="flex items-center justify-between ${l.isOverdue ? 'bg-red-color-25' : 'bg-orange-color-25'} rounded-lg p-2.5">
          <div>
            <p class="!text-xs ${l.isOverdue ? 'text-red-color font-medium' : 'text-zinc-500'}">${l.isOverdue ? 'سررسید گذشته' : 'قسط بعدی'} · ${l.nextDueDate ? toPersianDigits(l.nextDueDate) : '—'}</p>
            <p class="!text-sm font-bold text-zinc-800">${formatAmount(l.installmentAmount)}</p>
          </div>
          <div class="flex items-center gap-2">
            <button onclick="payLoan(${l.id})" class="bg-main-color text-white !text-xs px-3 py-1.5 rounded-lg">پرداخت شد</button>
            <button onclick="deleteLoan(${l.id})" title="حذف" class="text-zinc-400 hover:text-red-color !text-xs">✕</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  // ===== سلامت مالی تفصیلی =====
  function renderHealth(data) {
    const f = data.health.factors;
    setText(
      'health-score-badge',
      data.health.score !== null
        ? `امتیاز کل: ${toPersianDigits(data.health.score)} از ۱۰۰ · ${data.health.label}`
        : 'داده کافی برای محاسبه‌ی امتیاز کل وجود ندارد',
    );

    function setFactor(valueId, barId, value) {
      if (value === null || value === undefined) {
        setText(valueId, '— بدون داده');
        setWidth(barId, 0);
      } else {
        setText(valueId, `${toPersianDigits(value)}٪`);
        setWidth(barId, value);
      }
    }

    setFactor('factor-savings-value', 'factor-savings-bar', f.savingsRatio);
    setFactor('factor-expense-value', 'factor-expense-bar', f.expenseToIncome);
    setFactor('factor-debt-value', 'factor-debt-bar', f.debtManagement);
    setFactor('factor-budget-value', 'factor-budget-bar', f.budgetAdherence);
    setFactor('factor-installment-value', 'factor-installment-bar', f.installmentPunctuality);
    setFactor('factor-goals-value', 'factor-goals-bar', f.goalsProgress);
  }

  // ===== چالش هفتگی (گیمیفیکیشن) =====
  let currentChallenge = null;

  function renderChallenge(data) {
    setText('challenge-points-total', toPersianDigits(data.challenges.totalPoints));
    const active = document.getElementById('challenge-active');
    const empty = document.getElementById('challenge-empty');
    const current = data.challenges.current;
    currentChallenge = current;
    if (!current) {
      active.classList.add('hidden');
      empty.classList.remove('hidden');
      empty.classList.add('flex');
      return;
    }
    empty.classList.add('hidden');
    empty.classList.remove('flex');
    active.classList.remove('hidden');
    active.classList.add('flex');
    setText('challenge-title', current.title);
    setText('challenge-description', `پرهیز از خرج در دسته «${current.avoidCategory}»`);
    setText('challenge-progress-text', `${toPersianDigits(current.daysCompleted)} از ${toPersianDigits(current.targetDays)} روز`);
    setWidth('challenge-progress-bar', current.progressPercent);
    setText('challenge-reward', `${toPersianDigits(current.rewardPoints)}+ امتیاز`);
  }

  function openChallengeAddModal() {
    if (!requireAccount()) return;
    const form = document.getElementById('challengeForm');
    if (form) {
      form.reset();
      form.elements['id'].value = '';
      window.AmountInput.refreshForm(form);
    }
    setText('challengeModalTitle', 'شروع چالش جدید');
    setText('challengeFormSubmit', 'شروع چالش');
    openModal('challengeModal');
  }
  window.openChallengeAddModal = openChallengeAddModal;

  function editChallenge() {
    if (!currentChallenge) return;
    const form = document.getElementById('challengeForm');
    if (!form) return;
    form.reset();
    form.elements['id'].value = currentChallenge.id;
    form.elements['title'].value = currentChallenge.title;
    form.elements['avoidCategory'].value = currentChallenge.avoidCategory;
    form.elements['targetDays'].value = currentChallenge.targetDays;
    form.elements['rewardPoints'].value = currentChallenge.rewardPoints;
    window.AmountInput.refreshForm(form);
    setText('challengeModalTitle', 'ویرایش چالش');
    setText('challengeFormSubmit', 'ذخیره تغییرات');
    openModal('challengeModal');
  }
  window.editChallenge = editChallenge;

  async function deleteChallenge() {
    if (!currentChallenge) return;
    if (!(await window.HesabinoUI.confirmDialog('این چالش حذف شود؟'))) return;
    try {
      const res = await fetch(`${API_BASE}/challenges/${currentChallenge.id}`, { method: 'DELETE', headers: authHeaders() });
      if (!res.ok) throw new Error('خطا در حذف چالش');
      showToast('چالش حذف شد', 'success');
      loadDashboard();
    } catch (err) {
      showToast(err.message || 'خطا در حذف چالش', 'error');
    }
  }
  window.deleteChallenge = deleteChallenge;

  // ===== یادآورهای نزدیک =====
  function renderReminders(data) {
    const el = document.getElementById('reminders-list');
    if (!el) return;
    if (!data.reminders.length) {
      el.innerHTML = '<p class="text-zinc-400 !text-sm">یادآور نزدیکی وجود ندارد.</p>';
      return;
    }
    const priorityMeta = {
      today: { bg: 'bg-yellow-color-20', badge: 'text-amber-600 bg-amber-50', label: 'اولویت: امروز' },
      soon: { bg: 'bg-yellow-color-20', badge: 'text-red-600', label: 'به‌زودی' },
      scheduled: { bg: 'bg-zinc-50', badge: 'text-indigo-600', label: 'برنامه‌ریزی‌شده' },
    };
    el.innerHTML = data.reminders.map((r) => {
      const meta = priorityMeta[r.priority] || priorityMeta.scheduled;
      return `
        <div class="reminder-row ${meta.bg} rounded-lg p-2 transition-all">
          <div class="flex items-start gap-3">
            <div class="flex flex-1 justify-between flex-wrap">
              <p class="text-gray-800 text-base md:text-lg font-medium leading-relaxed">${escapeHtml(r.text)}</p>
              <div class="flex justify-end mt-1">
                <span class="text-xs font-semibold ${meta.badge} px-2 py-0.5 rounded-full inline-block">${meta.label}${r.date ? ' · ' + toPersianDigits(r.date) : ''}</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // ===== خلاصه‌ی طلب و بدهی =====
  function renderDebtSummary(data) {
    const s = data.debts.summary;
    setText('debt-mydebt', formatAmount(s.myDebt));
    setText('debt-receivable', formatAmount(s.receivable));
    setText('debt-net', formatAmount(s.net));
  }

  // ===== آیکون دکمه‌های عملیات هر سطر جدول «آخرین تراکنش‌ها» (مشابه صفحه‌ی تراکنش‌ها) =====
  const TX_EYE_ICON = `<svg width="16" height="16" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M11.6849 9C11.6849 10.485 10.4849 11.685 8.99994 11.685C7.51494 11.685 6.31494 10.485 6.31494 9C6.31494 7.515 7.51494 6.315 8.99994 6.315C10.4849 6.315 11.6849 7.515 11.6849 9Z" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
      <path d="M8.99988 15.2025C11.6474 15.2025 14.1149 13.6425 15.8324 10.9425C16.5074 9.88501 16.5074 8.10751 15.8324 7.05001C14.1149 4.35001 11.6474 2.79001 8.99988 2.79001C6.35238 2.79001 3.88488 4.35001 2.16738 7.05001C1.49238 8.10751 1.49238 9.88501 2.16738 10.9425C3.88488 13.6425 6.35238 15.2025 8.99988 15.2025Z" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
    </svg>`;

  const TX_PENCIL_ICON = `<svg width="16" height="16" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12.6142 2.46067L13.9984 1.07566C14.2869 0.787107 14.6783 0.625 15.0864 0.625C15.4944 0.625 15.8858 0.787107 16.1743 1.07566C16.4629 1.36421 16.625 1.75557 16.625 2.16364C16.625 2.57172 16.4629 2.96308 16.1743 3.25163L4.38454 15.0414C3.95076 15.475 3.41583 15.7936 2.82805 15.9686L0.625 16.625L1.2814 14.422C1.4564 13.8342 1.77504 13.2992 2.20857 12.8655L12.615 2.46067H12.6142ZM12.6142 2.46067L14.7787 4.62515" stroke="white" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" />
    </svg>`;

  const TX_TRASH_ICON = `<svg width="16" height="16" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M15.75 4.48499C13.2525 4.23749 10.74 4.10999 8.235 4.10999C6.75 4.10999 5.265 4.18499 3.78 4.33499L2.25 4.48499" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
      <path d="M6.375 3.7275L6.54 2.745C6.66 2.0325 6.75 1.5 8.0175 1.5H9.9825C11.25 1.5 11.3475 2.0625 11.46 2.7525L11.625 3.7275" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
      <path d="M14.1376 6.85498L13.6501 14.4075C13.5676 15.585 13.5 16.5 11.4075 16.5H6.59255C4.50005 16.5 4.43255 15.585 4.35005 14.4075L3.86255 6.85498" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
      <path d="M7.74756 12.375H10.2451" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
      <path d="M7.125 9.375H10.875" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
    </svg>`;

  // ===== جدول آخرین تراکنش‌ها =====
  function renderTransactionsTable(data) {
    const tbody = document.getElementById('transactions-tbody');
    if (!tbody) return;
    if (!data.recentTransactions.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="px-5 py-6 text-center text-zinc-400">هنوز تراکنشی ثبت نشده است.</td></tr>';
      return;
    }
    tbody.innerHTML = data.recentTransactions.map((t) => {
      const badgeClass = t.type === 'income'
        ? 'text-emerald-600 bg-emerald-50'
        : t.type === 'transfer'
          ? 'text-blue-600 bg-blue-50'
          : 'text-rose-600 bg-rose-50';
      const badgeText = t.type === 'income' ? 'درآمد' : t.type === 'transfer' ? 'انتقال' : 'هزینه';
      return `
        <tr class="transition-all duration-150">
          <td class="px-5 py-3.5 text-gray-800 whitespace-nowrap">${toPersianDigits(t.date || '')}</td>
          <td class="px-5 py-3.5 text-gray-700">${escapeHtml(t.title || '')}</td>
          <td class="px-5 py-3.5"><span class="bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full text-xs font-medium">${escapeHtml(t.category || 'سایر')}</span></td>
          <td class="px-5 py-3.5"><span class="${badgeClass} px-2.5 py-1 rounded-full text-xs font-medium">${badgeText}</span></td>
          <td class="px-5 py-3.5 font-mono font-medium text-gray-800 whitespace-nowrap">${formatNumber(t.amount)}</td>
          <td>
            <div class="flex justify-center gap-2">
              <button type="button" class="bg-main-color p-1 rounded-md" title="جزئیات" onclick="location.href='/transactions?view=${t.id}'">${TX_EYE_ICON}</button>
              ${t.type === 'transfer' ? '' : `<button type="button" class="bg-main-color p-1 rounded-md" title="ویرایش" onclick="location.href='/transactions?edit=${t.id}'">${TX_PENCIL_ICON}</button>`}
              <button type="button" class="bg-main-color p-1 rounded-md" title="${t.type === 'transfer' ? 'حذف انتقال' : 'حذف'}" onclick="location.href='/transactions?delete=${t.id}'">${TX_TRASH_ICON}</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // ===== تحلیل هوشمند AI (اگر کلید API/مدل تنظیم شده باشد، جای تحلیل مبتنی بر قانون ثابت را می‌گیرد) =====
  // این تحلیل دیگه خودکار (روی هر بار لود شدن داشبورد) گرفته نمی‌شه، چون پشتش یک مدل
  // زبانی محلیه که چند ثانیه طول می‌کشه؛ به‌جاش آخرین نتیجه در localStorage کش می‌شه و
  // فقط با کلیک روی آیکون به‌روزرسانی، دوباره گرفته می‌شه.
  const AI_INSIGHT_CACHE_KEY = 'hb_ai_insight_cache_v1';

  function readAiInsightCache() {
    try {
      const raw = localStorage.getItem(AI_INSIGHT_CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function writeAiInsightCache(cache) {
    try {
      localStorage.setItem(AI_INSIGHT_CACHE_KEY, JSON.stringify(cache));
    } catch (err) {
    }
  }

  function formatAiInsightTimestamp(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return 'به‌روزرسانی: —';
    const datePart = toPersianDigits(date.toLocaleDateString('fa-IR'));
    const timePart = toPersianDigits(date.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }));
    return `به‌روزرسانی: ${datePart} - ${timePart}`;
  }

  function setAiInsightBadgeText(text) {
    const badgeText = document.getElementById('ai-insight-updated-text');
    if (badgeText) badgeText.textContent = text;
  }

  function setAiInsightRefreshSpinning(spinning) {
    const icon = document.getElementById('ai-insight-refresh-icon');
    const btn = document.getElementById('ai-insight-refresh-btn');
    if (icon) icon.classList.toggle('animate-spin', spinning);
    if (btn) btn.disabled = spinning;
  }

  // آخرین تحلیل ذخیره‌شده (اگه وجود داشته باشه) رو بدون هیچ درخواست شبکه‌ای نشون می‌ده
  function restoreCachedAiInsight() {
    const cache = readAiInsightCache();
    if (!cache) {
      setAiInsightBadgeText('هنوز به‌روزرسانی نشده');
      return;
    }

    const behaviorEl = document.getElementById('hero-insight-behavior');
    const predictionEl = document.getElementById('hero-insight-prediction');
    if (behaviorEl && cache.behavior) behaviorEl.textContent = cache.behavior;
    if (predictionEl && cache.prediction) predictionEl.textContent = cache.prediction;
    setAiInsightBadgeText(formatAiInsightTimestamp(cache.generatedAt));
  }

  // با کلیک کاربر روی آیکون به‌روزرسانی صدا زده می‌شه؛ یک درخواست تازه به دستیار هوشمند می‌زنه
  async function refreshAiInsight() {
    setAiInsightRefreshSpinning(true);
    try {
      const res = await fetch(`${API_BASE}/ai/insight`, { headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'خطا در دریافت تحلیل هوشمند');

      if (!data.usedAi) {
        showToast('دستیار هوشمند در دسترس نیست؛ تحلیل بر پایه‌ی قانون ثابت همچنان نمایش داده می‌شود', 'error');
        return;
      }

      const behaviorEl = document.getElementById('hero-insight-behavior');
      const predictionEl = document.getElementById('hero-insight-prediction');
      if (behaviorEl && data.analysis) behaviorEl.textContent = data.analysis;
      if (predictionEl && data.suggestion) predictionEl.textContent = data.suggestion;

      const generatedAt = new Date().toISOString();
      writeAiInsightCache({ behavior: data.analysis, prediction: data.suggestion, generatedAt });
      setAiInsightBadgeText(formatAiInsightTimestamp(generatedAt));
    } catch (err) {
      showToast(err.message || 'ارتباط با دستیار هوشمند برقرار نشد', 'error');
    } finally {
      setAiInsightRefreshSpinning(false);
    }
  }

  function bindAiInsightRefreshButton() {
    const btn = document.getElementById('ai-insight-refresh-btn');
    if (btn) btn.addEventListener('click', refreshAiInsight);
  }

  // ===== چت با دستیار هوشمند مالی =====
  function bindAiChat() {
    const form = document.getElementById('aiAskForm');
    const input = document.getElementById('aiAskInput');
    const answerBox = document.getElementById('aiAskAnswer');
    const button = document.getElementById('aiAskButton');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const question = (input.value || '').trim();
      if (!question) return;

      button.disabled = true;
      button.textContent = 'در حال پاسخ...';
      answerBox.classList.remove('hidden');
      answerBox.textContent = 'در حال فکر کردن...';

      try {
        const res = await fetch(`${API_BASE}/ai/ask`, {
          method: 'POST',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ question }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'خطا در دریافت پاسخ');
        answerBox.textContent = data.answer;
      } catch (err) {
        answerBox.textContent = err.message || 'خطا در دریافت پاسخ از دستیار هوشمند';
      } finally {
        button.disabled = false;
        button.textContent = 'بپرس';
      }
    });
  }

  // ===== بارگذاری کامل داشبورد =====
  async function loadDashboard() {
    try {
      const period = window.HesabinoPeriod ? window.HesabinoPeriod.get() : 'month';
      const res = await fetch(`${API_BASE}/dashboard?period=${period}`, { headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'خطا در دریافت اطلاعات داشبورد');

      latestData = data;
      hasAccounts = Boolean(data.accounts && data.accounts.accountsCount > 0);
      renderHero(data);
      renderStatCards(data);
      renderCategoryChart(data);
      renderCashFlowChart(data);
      renderExpenseRatio(data);
      renderMonthlyBalance(data);
      renderClosestGoal(data);
      renderBudgetAlerts(data);
      renderAssets(data);
      renderSubscriptions(data);
      renderInstallments(data);
      renderHealth(data);
      renderChallenge(data);
      renderReminders(data);
      renderDebtSummary(data);
      renderTransactionsTable(data);


      restoreCachedAiInsight();
    } catch (err) {
      showToast(err.message || 'خطا در بارگذاری داشبورد', 'error');
    }
  }

  // ===== فرم‌های افزودن سریع (بدون قابلیت ویرایش) =====
  function bindQuickForm(formId, endpoint, buildBody) {
    const form = document.getElementById(formId);
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const body = buildBody(formData);
      try {
        const res = await fetch(`${API_BASE}/${endpoint}`, {
          method: 'POST',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'خطا در ثبت اطلاعات');
        showToast('با موفقیت ثبت شد', 'success');
        form.reset();
        if (typeof window.closeModal === 'function') window.closeModal();
        loadDashboard();
      } catch (err) {
        showToast(err.message || 'خطا در ثبت اطلاعات', 'error');
      }
    });
  }

  function bindEditableForm(formId, endpoint, buildBody) {
    const form = document.getElementById(formId);
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const id = formData.get('id');
      const body = buildBody(formData);
      const url = id ? `${API_BASE}/${endpoint}/${id}` : `${API_BASE}/${endpoint}`;
      const method = id ? 'PATCH' : 'POST';
      try {
        const res = await fetch(url, {
          method,
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'خطا در ثبت اطلاعات');
        showToast(id ? 'با موفقیت ویرایش شد' : 'با موفقیت ثبت شد', 'success');
        form.reset();
        if (typeof window.closeModal === 'function') window.closeModal();
        loadDashboard();
      } catch (err) {
        showToast(err.message || 'خطا در ثبت اطلاعات', 'error');
      }
    });
  }

  // ===== قبل از افزودن دارایی/اشتراک/وام/چالش، مطمئن می‌شویم کاربر حداقل یک حساب مالی دارد =====
  function requireAccount() {
    if (hasAccounts) return true;
    showToast('اول باید یک حساب مالی اضافه کنی', 'error');
    if (window.HesabinoOnboarding && typeof window.HesabinoOnboarding.show === 'function') {
      window.HesabinoOnboarding.show();
    }
    return false;
  }

  function openAssetAddModal() {
    if (!requireAccount()) return;
    const form = document.getElementById('assetForm');
    if (form) {
      form.reset();
      form.elements['id'].value = '';
      window.AmountInput.refreshForm(form);
    }
    setText('assetModalTitle', 'افزودن دارایی');
    setText('assetFormSubmit', 'افزودن');
    updateAssetFormFields();
    openModal('assetModal');
  }
  window.openAssetAddModal = openAssetAddModal;

  function openSubscriptionAddModal() {
    if (!requireAccount()) return;
    const form = document.getElementById('subscriptionForm');
    if (form) {
      form.reset();
      form.elements['id'].value = '';
      window.AmountInput.refreshForm(form);
    }
    setText('subscriptionModalTitle', 'افزودن اشتراک');
    setText('subscriptionFormSubmit', 'افزودن');
    openModal('subscriptionModal');
  }
  window.openSubscriptionAddModal = openSubscriptionAddModal;

  function openLoanAddModal() {
    if (!requireAccount()) return;
    const form = document.getElementById('loanForm');
    if (form) {
      form.reset();
      window.AmountInput.refreshForm(form);
    }
    openModal('loanModal');
  }
  window.openLoanAddModal = openLoanAddModal;

  function onReady() {
    loadDashboard().finally(() => window.HesabinoUI && window.HesabinoUI.hidePageLoader && window.HesabinoUI.hidePageLoader());
    bindAiChat();
    bindAiInsightRefreshButton();

    document.addEventListener(window.HesabinoPeriod ? window.HesabinoPeriod.EVENT_NAME : 'hesabino:period-change', loadDashboard);

    const typeSelect = document.getElementById('assetTypeSelect');
    if (typeSelect) typeSelect.addEventListener('change', updateAssetFormFields);

    bindEditableForm('assetForm', 'assets', (fd) => {
      const type = fd.get('type');
      const body = { title: fd.get('title'), type };
      if (type === 'gold') {
        body.quantity = Number(window.AmountInput.parse(fd.get('quantityGold')));
        body.unitPrice = Number(window.AmountInput.parse(fd.get('unitPriceGold')));
      } else if (type === 'currency') {
        body.quantity = Number(window.AmountInput.parse(fd.get('quantityCurrency')));
        body.unitPrice = Number(window.AmountInput.parse(fd.get('unitPriceCurrency')));
      } else {
        body.value = Number(window.AmountInput.parse(fd.get('value')));
      }
      return body;
    });

    bindEditableForm('subscriptionForm', 'subscriptions', (fd) => ({
      title: fd.get('title'),
      amount: Number(window.AmountInput.parse(fd.get('amount'))),
      billingDay: Number(window.AmountInput.parse(fd.get('billingDay'))),
    }));

    bindQuickForm('loanForm', 'installments', (fd) => ({
      title: fd.get('title'),
      totalAmount: Number(window.AmountInput.parse(fd.get('totalAmount'))),
      installmentsCount: Number(window.AmountInput.parse(fd.get('installmentsCount'))),
      alreadyPaidCount: Number(window.AmountInput.parse(fd.get('alreadyPaidCount'))) || 0,
    }));

    bindEditableForm('challengeForm', 'challenges', (fd) => ({
      title: fd.get('title'),
      avoidCategory: fd.get('avoidCategory'),
      targetDays: Number(window.AmountInput.parse(fd.get('targetDays'))),
      rewardPoints: Number(window.AmountInput.parse(fd.get('rewardPoints'))),
    }));

  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }
})();