(function () {
  'use strict';

  const API_BASE = '/api';

  let latestData = null;
  let selectedMonth = null; // اگه null باشه یعنی «ماه جاری»
  let userAccounts = []; // حساب‌های فعال کاربر؛ برای پر کردن سلکت «حساب مقصد»
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

  // رنگ هر حساب؛ چون اسم حساب‌ها دلخواه و پویاست (برخلاف دسته‌های درآمد)، از یک پالت
  // ثابت به‌ترتیب استفاده می‌شه تا هر حساب رنگ ثابتی داشته باشه
  const ACCOUNT_COLOR_PALETTE = ['#2E9E63', '#4EA1D3', '#E5A83B', '#9D6BD8', '#DB5E6B', '#55B5B1', '#8AAE3E'];
  function colorForAccount(accountKey) {
    let hash = 0;
    const str = String(accountKey);
    for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
    return ACCOUNT_COLOR_PALETTE[hash % ACCOUNT_COLOR_PALETTE.length];
  }

  // ===== آیکون دکمه‌های عملیات هر سطر (ویرایش/حذف) =====
  const PENCIL_ICON = `<svg width="15" height="15" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12.6142 2.46067L13.9984 1.07566C14.2869 0.787107 14.6783 0.625 15.0864 0.625C15.4944 0.625 15.8858 0.787107 16.1743 1.07566C16.4629 1.36421 16.625 1.75557 16.625 2.16364C16.625 2.57172 16.4629 2.96308 16.1743 3.25163L4.38454 15.0414C3.95076 15.475 3.41583 15.7936 2.82805 15.9686L0.625 16.625L1.2814 14.422C1.4564 13.8342 1.77504 13.2992 2.20857 12.8655L12.615 2.46067H12.6142ZM12.6142 2.46067L14.7787 4.62515" stroke="white" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" />
    </svg>`;
  const TRASH_ICON = `<svg width="15" height="15" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M15.75 4.48499C13.2525 4.23749 10.74 4.10999 8.235 4.10999C6.75 4.10999 5.265 4.18499 3.78 4.33499L2.25 4.48499" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
      <path d="M6.375 3.7275L6.54 2.745C6.66 2.0325 6.75 1.5 8.0175 1.5H9.9825C11.25 1.5 11.3475 2.0625 11.46 2.7525L11.625 3.7275" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
      <path d="M14.1376 6.85498L13.6501 14.4075C13.5676 15.585 13.5 16.5 11.4075 16.5H6.59255C4.50005 16.5 4.43255 15.585 4.35005 14.4075L3.86255 6.85498" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
      <path d="M7.74756 12.375H10.2451" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
      <path d="M7.125 9.375H10.875" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
    </svg>`;

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

  function renderAccountList(data) {
    const container = document.getElementById('incomeAccountList');
    if (!container) return;

    if (!data.accountBreakdown.length) {
      container.innerHTML = '<p class="text-center text-gray-400 mt-6">برای این ماه هنوز درآمدی ثبت نشده</p>';
      return;
    }

    container.innerHTML = data.accountBreakdown.map((a) => `
      <div class="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
        <span class="flex items-center gap-2 text-sm text-zinc-800">
          <span class="inline-block w-2.5 h-2.5 rounded-full" style="background-color: ${colorForAccount(a.accountId ?? 'none')}"></span>
          ${escapeHtml(a.accountName)}
        </span>
        <span class="text-sm font-medium text-zinc-800">${formatAmount(a.amount)}</span>
      </div>`).join('');
  }

  // ===== وضعیت کلی هر حساب: مجموع کل برداشت (هزینه) ازش و موجودی فعلی‌اش =====
  function renderAccountWithdrawalsList(data) {
    const container = document.getElementById('incomeAccountWithdrawalsList');
    if (!container) return;

    if (!data.accountWithdrawals || !data.accountWithdrawals.length) {
      container.innerHTML = '<p class="text-center text-gray-400 mt-6">حسابی ثبت نشده</p>';
      return;
    }

    container.innerHTML = data.accountWithdrawals.map((a) => `
      <div class="py-2.5 border-b border-gray-100 last:border-0">
        <div class="text-sm text-zinc-800 mb-1">${escapeHtml(a.accountName)}</div>
        <div class="flex items-center justify-between text-xs">
          <span class="text-gray-500">کل برداشت: <span class="text-red-color font-medium">${formatAmount(a.withdrawn)}</span></span>
          <span class="text-gray-500">باقی‌مونده: <span class="${a.remaining < 0 ? 'text-red-color' : 'text-green-color'} font-medium">${formatAmount(a.remaining)}</span></span>
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
      <div class="flex items-center justify-between gap-2 py-2.5 border-b border-gray-100 last:border-0">
        <div class="min-w-0">
          <div class="text-sm font-medium text-zinc-800">${escapeHtml(tx.title || tx.category || 'درآمد')}</div>
          <div class="text-xs text-gray-500">
            ${escapeHtml(tx.category || 'سایر')} · ${toPersianDigits(tx.date || '')}${tx.accountName ? ` · ${escapeHtml(tx.accountName)}` : ''}
          </div>
          ${tx.description ? `<div class="!text-[11px] text-gray-400 italic mt-0.5">${escapeHtml(tx.description)}</div>` : ''}
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <div class="text-sm font-bold text-green-color whitespace-nowrap">+${formatAmount(tx.amount)}</div>
          <button type="button" class="bg-main-color p-1 rounded-md" title="ویرایش" onclick="IncomeApp.openEditModal(${tx.id})">${PENCIL_ICON}</button>
          <button type="button" class="bg-main-color p-1 rounded-md" title="حذف" onclick="IncomeApp.openDeleteModal(${tx.id})">${TRASH_ICON}</button>
        </div>
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
      renderAccountList(data);
      renderAccountWithdrawalsList(data);
      renderTransactionList(data);
    } catch (err) {
      console.error('Income load network error:', err);
      showToast('ارتباط با سرور برقرار نشد', 'error');
    }
  }

  // ===== بارگذاری حساب‌های فعال کاربر و پر کردن سلکت «حساب مقصد» =====
  async function loadAccounts() {
    try {
      const res = await fetch(`${API_BASE}/accounts`, { headers: authHeaders() });
      if (!res.ok) throw new Error('خطا در دریافت حساب‌ها');
      userAccounts = await res.json();
    } catch (err) {
      console.error('خطا در دریافت حساب‌ها:', err);
      userAccounts = [];
    }

    const select = document.getElementById('incomeAccountSelect');
    if (!select) return;
    const prev = select.value;
    select.innerHTML = '<option value="">بدون حساب</option>' +
      userAccounts.map((a) => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('');
    if (prev) select.value = prev;
  }

  // ===== مودال افزودن دستی درآمد =====
  function openAddModal() {
    const errorBox = document.getElementById('addIncomeError');
    if (errorBox) errorBox.classList.add('hidden');
    document.getElementById('incomeModalTitle').textContent = 'افزودن درآمد';
    document.getElementById('addIncomeSubmitBtn').textContent = 'ثبت درآمد';
    document.getElementById('incomeEditId').value = '';
    document.getElementById('incomeTitleInput').value = '';
    document.getElementById('incomeAmountInput').value = '';
    document.getElementById('incomeDescriptionInput').value = '';
    document.getElementById('incomeCategorySelect').selectedIndex = 0;
    document.getElementById('incomeAccountSelect').value = '';

    const dateInput = document.getElementById('incomeDatePicker');
    if (dateInput) {
      try {
        dateInput.value = typeof persianDate === 'function' ? new persianDate().format('YYYY/MM/DD') : '';
      } catch (e) {
        dateInput.value = '';
      }
    }

    loadAccounts();
    window.AmountInput.refreshForm(document.getElementById('addIncomeModal'));
    window.openModal('addIncomeModal');
  }

  // ===== مودال ویرایش درآمد =====
  async function openEditModal(id) {
    const tx = latestData && latestData.transactions.find((t) => t.id === id);
    if (!tx) {
      showToast('تراکنش مورد نظر پیدا نشد', 'error');
      return;
    }

    const errorBox = document.getElementById('addIncomeError');
    if (errorBox) errorBox.classList.add('hidden');
    document.getElementById('incomeModalTitle').textContent = 'ویرایش درآمد';
    document.getElementById('addIncomeSubmitBtn').textContent = 'ذخیره تغییرات';
    document.getElementById('incomeEditId').value = tx.id;
    document.getElementById('incomeTitleInput').value = tx.title || '';
    document.getElementById('incomeAmountInput').value = tx.amount != null ? tx.amount : '';
    document.getElementById('incomeDescriptionInput').value = tx.description || '';
    document.getElementById('incomeCategorySelect').value = tx.category || '';
    document.getElementById('incomeDatePicker').value = tx.date || '';

    await loadAccounts();
    document.getElementById('incomeAccountSelect').value = tx.accountId != null ? String(tx.accountId) : '';

    window.AmountInput.refreshForm(document.getElementById('addIncomeModal'));
    window.openModal('addIncomeModal');
  }

  async function submitForm() {
    const errorBox = document.getElementById('addIncomeError');
    errorBox.classList.add('hidden');

    const editId = document.getElementById('incomeEditId').value;
    const title = document.getElementById('incomeTitleInput').value.trim();
    const category = document.getElementById('incomeCategorySelect').value;
    const accountIdRaw = document.getElementById('incomeAccountSelect').value;
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

    const payload = {
      title,
      category,
      accountId: accountIdRaw ? Number(accountIdRaw) : null,
      amount: Number(amount),
      date,
      description,
    };

    try {
      const url = editId ? `${API_BASE}/transactions/${editId}` : `${API_BASE}/income`;
      const method = editId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data.message || 'خطا در ثبت درآمد';
        errorBox.textContent = Array.isArray(msg) ? msg[0] : msg;
        errorBox.classList.remove('hidden');
        return;
      }

      showToast(editId ? 'درآمد با موفقیت ویرایش شد' : 'درآمد با موفقیت ثبت شد', 'success');
      closeModal();
      // اگه تاریخ ثبت‌شده توی همون ماهی هست که الان نمایش داده می‌شه، دوباره‌ی همون ماه لود می‌شه؛
      // وگرنه ماه مربوط به تاریخ ثبت‌شده رو نشون می‌ده (تا کاربر بلافاصله نتیجه رو ببینه)
      const newMonth = (date.match(/^(\d{3,4}\/\d{1,2})/) || [])[1];
      await loadIncome(newMonth ? newMonth.replace(/\/(\d)$/, '/0$1') : selectedMonth);
    } catch (err) {
      console.error('Save income network error:', err);
      errorBox.textContent = 'ارتباط با سرور برقرار نشد';
      errorBox.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }

  // ===== مودال حذف درآمد =====
  function openDeleteModal(id) {
    document.getElementById('incomeDeleteId').value = id;
    const errEl = document.getElementById('deleteIncomeError');
    if (errEl) errEl.classList.add('hidden');
    window.openModal('deleteIncomeModal');
  }

  async function confirmDelete() {
    const id = document.getElementById('incomeDeleteId').value;
    if (!id) return;

    const btn = document.getElementById('confirmDeleteIncomeBtn');
    const errEl = document.getElementById('deleteIncomeError');
    btn.disabled = true;

    try {
      const res = await fetch(`${API_BASE}/transactions/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data.message || `خطا در حذف درآمد (کد ${res.status})`;
        errEl.textContent = msg;
        errEl.classList.remove('hidden');
        showToast(msg, 'error');
        return;
      }

      closeModal();
      showToast('درآمد با موفقیت حذف شد', 'success');
      await loadIncome(selectedMonth);
    } catch (err) {
      console.error('Delete income network error:', err);
      errEl.textContent = 'ارتباط با سرور برقرار نشد';
      errEl.classList.remove('hidden');
      showToast('ارتباط با سرور برقرار نشد', 'error');
    } finally {
      btn.disabled = false;
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

  window.IncomeApp = { openAddModal, openEditModal, submitForm, openDeleteModal, confirmDelete };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }
})();