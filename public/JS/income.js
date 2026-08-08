(function () {
  'use strict';

  const API_BASE = '/api';

  let latestData = null;
  let selectedMonth = null; // اگه null باشه یعنی «ماه جاری»

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
    const grouped = Math.round(Number(amount || 0)).toLocaleString('en-US');
    return toPersianDigits(grouped) + ' تومان';
  }

  // رنگ هر منبع درآمد؛ عمداً پالت جدا از دسته‌های هزینه (budget.js) تا با نگاه اول
  // قابل تشخیص باشه این نمودار مربوط به درآمده، نه هزینه
  const CATEGORY_COLORS = {
    'حقوق و دستمزد': '#2E9E63',
    'پاداش و هدیه': '#55B5B1',
    'فروش': '#9DE18B',
    'سرمایه‌گذاری': '#E5DC44',
    'بازگشت وجه': '#4EA1D3',
    'سایر': '#DADADA',
  };
  function colorFor(category) {
    return CATEGORY_COLORS[category] || '#94A3B8';
  }

  const PERSIAN_MONTH_NAMES = {
    1: 'فروردین', 2: 'اردیبهشت', 3: 'خرداد', 4: 'تیر', 5: 'مرداد', 6: 'شهریور',
    7: 'مهر', 8: 'آبان', 9: 'آذر', 10: 'دی', 11: 'بهمن', 12: 'اسفند',
  };

  function monthLabel(monthKey) {
    const [y, m] = String(monthKey).split('/');
    const name = PERSIAN_MONTH_NAMES[Number(m)] || m;
    return `${name} ${toPersianDigits(y)}`;
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

  // ===== سلکت انتخاب ماه: از availableMonths پر می‌شه، بدون بازسازی هر بار مقدار انتخابی رو گم نکنه =====
  function populateMonthSelect(availableMonths, currentMonth) {
    const select = document.getElementById('incomeMonthSelect');
    if (!select) return;
    select.innerHTML = availableMonths
      .map((m) => `<option value="${m}">${monthLabel(m)}</option>`)
      .join('');
    select.value = currentMonth;
  }

  function renderStatCards(data) {
    document.getElementById('incomeMonthLabel').textContent = `درآمد ${monthLabel(data.month)}`;
    document.getElementById('incomeTotalAmount').textContent = formatAmount(data.total);
    document.getElementById('incomeTxCount').textContent = toPersianDigits(data.transactions.length);

    const changeEl = document.getElementById('incomeChangePercent');
    const change = data.previousMonth.changePercent;
    changeEl.textContent = `${change >= 0 ? '+' : ''}${toPersianDigits(change)}٪`;
    changeEl.className = change >= 0
      ? 'text-green-color !text-md text-center my-2.5 font-bold'
      : 'text-red-color !text-md text-center my-2.5 font-bold';
  }

  function renderCategoryList(data) {
    const container = document.getElementById('incomeCategoryList');
    if (!container) return;

    if (!data.categoryBreakdown.length) {
      container.innerHTML = '<p class="text-center text-gray-400 mt-6">برای این ماه هنوز درآمدی ثبت نشده</p>';
      return;
    }

    container.innerHTML = data.categoryBreakdown.map((c) => `
      <div class="mt-3">
        <div class="flex justify-between text-sm mb-1">
          <span class="flex items-center gap-2">
            <span class="inline-block w-2.5 h-2.5 rounded-full" style="background-color: ${colorFor(c.category)}"></span>
            ${escapeHtml(c.category)}
          </span>
          <span>${toPersianDigits(c.percent)}٪</span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-2.5">
          <div class="h-2.5 rounded-full progress-bar" style="width: ${c.percent}%; background-color: ${colorFor(c.category)}"></div>
        </div>
        <div class="flex justify-between text-sm mt-1">
          <span class="text-gray-500">${formatAmount(c.amount)}</span>
        </div>
      </div>`).join('');
  }

  function renderTransactionList(data) {
    const container = document.getElementById('incomeTransactionList');
    if (!container) return;

    if (!data.transactions.length) {
      container.innerHTML = '<p class="text-center text-gray-400 mt-6">برای این ماه هنوز تراکنش درآمدی ثبت نشده</p>';
      return;
    }

    container.innerHTML = data.transactions.map((tx) => `
      <div class="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
        <div>
          <div class="text-sm font-medium text-zinc-800">${escapeHtml(tx.title || tx.category || 'درآمد')}</div>
          <div class="text-xs text-gray-500">${escapeHtml(tx.category || 'سایر')} · ${toPersianDigits(tx.date || '')}</div>
        </div>
        <div class="text-sm font-bold text-green-color">+${formatAmount(tx.amount)}</div>
      </div>`).join('');
  }

  async function loadIncome(month) {
    try {
      const query = month ? `?month=${encodeURIComponent(month)}` : '';
      const res = await fetch(`${API_BASE}/income${query}`, { headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data.message || `خطا در دریافت اطلاعات درآمد (کد ${res.status})`;
        showToast(Array.isArray(msg) ? msg[0] : msg, 'error');
        return;
      }

      latestData = data;
      selectedMonth = data.month;
      populateMonthSelect(data.availableMonths, data.month);
      renderStatCards(data);
      renderCategoryList(data);
      renderTransactionList(data);
    } catch (err) {
      console.error('Income load network error:', err);
      showToast('ارتباط با سرور برقرار نشد', 'error');
    }
  }

  // ===== مودال افزودن دستی درآمد =====
  function openAddModal() {
    document.getElementById('addIncomeModal') && document.getElementById('addIncomeError').classList.add('hidden');
    document.getElementById('incomeTitleInput').value = '';
    document.getElementById('incomeAmountInput').value = '';
    document.getElementById('incomeDescriptionInput').value = '';
    document.getElementById('incomeCategorySelect').selectedIndex = 0;

    const dateInput = document.getElementById('incomeDatePicker');
    if (dateInput) {
      try {
        dateInput.value = typeof persianDate === 'function' ? new persianDate().format('YYYY/MM/DD') : '';
      } catch (e) {
        dateInput.value = '';
      }
    }

    window.AmountInput.refreshForm(document.getElementById('addIncomeModal'));
    window.openModal('addIncomeModal');
  }

  async function submitAdd() {
    const errorBox = document.getElementById('addIncomeError');
    errorBox.classList.add('hidden');

    const title = document.getElementById('incomeTitleInput').value.trim();
    const category = document.getElementById('incomeCategorySelect').value;
    const amount = window.AmountInput.parse(document.getElementById('incomeAmountInput').value);
    const date = document.getElementById('incomeDatePicker').value.trim();
    const description = document.getElementById('incomeDescriptionInput').value.trim();

    if (!date) {
      errorBox.textContent = 'لطفاً تاریخ را انتخاب کنید';
      errorBox.classList.remove('hidden');
      return;
    }
    if (!amount || Number(amount) <= 0) {
      errorBox.textContent = 'لطفاً مبلغ را وارد کنید';
      errorBox.classList.remove('hidden');
      return;
    }

    const btn = document.getElementById('addIncomeSubmitBtn');
    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = 'در حال ثبت...';

    try {
      const res = await fetch(`${API_BASE}/income`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ title, category, amount: Number(amount), date, description }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data.message || 'خطا در ثبت درآمد';
        errorBox.textContent = Array.isArray(msg) ? msg[0] : msg;
        errorBox.classList.remove('hidden');
        return;
      }

      showToast('درآمد با موفقیت ثبت شد', 'success');
      closeModal();
      // اگه تاریخ ثبت‌شده توی همون ماهی هست که الان نمایش داده می‌شه، دوباره‌ی همون ماه لود می‌شه؛
      // وگرنه ماه مربوط به تاریخ ثبت‌شده رو نشون می‌ده (تا کاربر بلافاصله نتیجه رو ببینه)
      const newMonth = (date.match(/^(\d{3,4}\/\d{1,2})/) || [])[1];
      await loadIncome(newMonth ? newMonth.replace(/\/(\d)$/, '/0$1') : selectedMonth);
    } catch (err) {
      console.error('Add income network error:', err);
      errorBox.textContent = 'ارتباط با سرور برقرار نشد';
      errorBox.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }

  function onReady() {
    if (!localStorage.getItem('access_token')) {
      window.HesabinoUI && window.HesabinoUI.hidePageLoader && window.HesabinoUI.hidePageLoader();
      return;
    }

    loadIncome().finally(() => window.HesabinoUI && window.HesabinoUI.hidePageLoader && window.HesabinoUI.hidePageLoader());

    const monthSelect = document.getElementById('incomeMonthSelect');
    if (monthSelect) {
      monthSelect.addEventListener('change', () => loadIncome(monthSelect.value));
    }
  }

  window.IncomeApp = { openAddModal, submitAdd };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }
})();