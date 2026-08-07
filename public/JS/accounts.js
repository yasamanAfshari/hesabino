(function () {
  'use strict';

  const API_BASE = '/api';

  // آخرین لیست حساب‌ها که از سرور خونده شده (برای پر کردن مودال ویرایش)
  let latestAccounts = [];
  let showArchived = false;

  // آخرین لیست انتقال‌های بین حساب‌ها که از سرور خونده شده
  let latestTransfers = [];

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

  const CURRENCY_LABELS = {
    IRR: 'تومان',
    USD: 'دلار',
    EUR: 'یورو',
    TRY: 'لیر ترکیه',
    AED: 'درهم امارات',
  };

  // واحد پول رو از روی کد ارز حساب می‌ذاره (مثلاً «۲۰ دلار» به‌جای «۲۰ تومان» برای حساب دلاری)
  function formatAmount(amount, currency) {
    const grouped = Math.round(Number(amount || 0)).toLocaleString('en-US');
    const unitLabel = CURRENCY_LABELS[currency] || CURRENCY_LABELS.IRR;
    return toPersianDigits(grouped) + ' ' + unitLabel;
  }

  function formatCount(n) {
    return toPersianDigits(Math.round(Number(n || 0))) + ' عدد';
  }

  const ACCOUNT_TYPE_LABELS = {
    cash: 'نقدی',
    bank: 'بانک',
    card: 'کارت',
    digital_wallet: 'کیف پول دیجیتال',
    crypto: 'ارز دیجیتال',
    other: 'سایر',
  };

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

  // ===== کارت‌های خلاصه‌ی بالای صفحه =====
  function renderSummary(accounts) {
    const active = accounts.filter((a) => !a.isArchived);
    const archived = accounts.filter((a) => a.isArchived);
    const totalIRR = active
      .filter((a) => a.currency === 'IRR')
      .reduce((sum, a) => sum + Number(a.balance || 0), 0);

    document.getElementById('accountsCount').textContent = formatCount(active.length);
    document.getElementById('accountsTotalBalance').textContent = formatAmount(totalIRR);
    document.getElementById('accountsArchivedCount').textContent = formatCount(archived.length);
  }

  // ===== کارت هر حساب =====
  function accountCard(account) {
    const balance = Number(account.balance || 0);
    const balanceClass = balance < 0 ? 'text-red-color' : 'text-green-color';
    const typeLabel = ACCOUNT_TYPE_LABELS[account.type] || account.type;
    const currencyLabel = CURRENCY_LABELS[account.currency] || account.currency;
    const archivedBadge = account.isArchived
      ? '<span class="text-xs px-2 py-1 rounded-full bg-orange-color-25 text-orange-color">آرشیوشده</span>'
      : '';

    return `
      <div class="main-box-small mb-0 border border-gray-100 rounded-xl p-4 flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <div class="font-bold text-zinc-800">${escapeHtml(account.name)}</div>
          ${archivedBadge}
        </div>
        <div class="text-xs text-zinc-500">${escapeHtml(typeLabel)} · ${escapeHtml(currencyLabel)}</div>
        <div class="mt-2">
          <div class="text-xs text-zinc-500 mb-1">موجودی لحظه‌ای</div>
          <div class="font-bold text-lg ${balanceClass}">${formatAmount(balance, account.currency)}</div>
        </div>
        <div class="flex justify-end mt-2">
          <button class="text-sm px-3 py-1.5 rounded-lg border border-main-color text-main-color" onclick="AccountsApp.openEditModal(${account.id})">ویرایش</button>
        </div>
      </div>
    `;
  }

  function renderAccountsList() {
    const container = document.getElementById('accountsList');
    const visible = showArchived
      ? latestAccounts
      : latestAccounts.filter((a) => !a.isArchived);

    if (!visible.length) {
      container.innerHTML = '<p class="text-center text-gray-400 mt-6 col-span-full">هنوز حسابی ثبت نشده است.</p>';
      return;
    }

    container.innerHTML = visible.map(accountCard).join('');
  }

  // ===== بارگذاری لیست حساب‌ها از سرور =====
  async function loadAccounts() {
    try {
      const res = await fetch(`${API_BASE}/accounts?includeArchived=true`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('خطا در دریافت حساب‌ها');
      latestAccounts = await res.json();
      renderSummary(latestAccounts);
      renderAccountsList();
    } catch (err) {
      console.error(err);
      showToast('دریافت اطلاعات حساب‌ها با خطا مواجه شد', 'error');
    }
  }

  // ===== مودال افزودن =====
  function openAddModal() {
    document.getElementById('addAccountError').classList.add('hidden');
    document.getElementById('addAccountName').value = '';
    document.getElementById('addAccountType').value = 'bank';
    document.getElementById('addAccountCurrency').value = 'IRR';
    document.getElementById('addAccountOpeningBalance').value = '';
    window.AmountInput.refreshForm(document.getElementById('addAccount'));
    openModal('addAccount');
  }

  async function submitCreate() {
    const name = document.getElementById('addAccountName').value.trim();
    const type = document.getElementById('addAccountType').value;
    const currency = document.getElementById('addAccountCurrency').value;
    const openingBalance = window.AmountInput.parse(document.getElementById('addAccountOpeningBalance').value);
    const errorBox = document.getElementById('addAccountError');
    errorBox.classList.add('hidden');

    if (!name) {
      errorBox.textContent = 'نام حساب الزامی است';
      errorBox.classList.remove('hidden');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/accounts`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          name,
          type,
          currency,
          openingBalance: openingBalance ? Number(openingBalance) : 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'ثبت حساب با خطا مواجه شد');

      closeModal();
      showToast('حساب با موفقیت ثبت شد', 'success');
      await loadAccounts();
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.classList.remove('hidden');
    }
  }

  // ===== مودال ویرایش =====
  function openEditModal(id) {
    const account = latestAccounts.find((a) => a.id === id);
    if (!account) return;

    document.getElementById('editAccountError').classList.add('hidden');
    document.getElementById('editAccountId').value = account.id;
    document.getElementById('editAccountName').value = account.name;
    document.getElementById('editAccountType').value = account.type;
    document.getElementById('editAccountCurrency').value = account.currency;
    document.getElementById('editAccountOpeningBalance').value = account.openingBalance;
    window.AmountInput.refresh(document.getElementById('editAccountOpeningBalance'));

    const archiveBtn = document.getElementById('editAccountArchiveBtn');
    archiveBtn.textContent = account.isArchived ? 'بازگرداندن حساب' : 'آرشیو حساب';

    openModal('editAccount');
  }

  async function submitUpdate() {
    const id = document.getElementById('editAccountId').value;
    const name = document.getElementById('editAccountName').value.trim();
    const type = document.getElementById('editAccountType').value;
    const currency = document.getElementById('editAccountCurrency').value;
    const openingBalance = window.AmountInput.parse(document.getElementById('editAccountOpeningBalance').value);
    const errorBox = document.getElementById('editAccountError');
    errorBox.classList.add('hidden');

    if (!name) {
      errorBox.textContent = 'نام حساب نمی‌تواند خالی باشد';
      errorBox.classList.remove('hidden');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/accounts/${id}`, {
        method: 'PATCH',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          name,
          type,
          currency,
          openingBalance: openingBalance ? Number(openingBalance) : 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'ویرایش حساب با خطا مواجه شد');

      closeModal();
      showToast('حساب با موفقیت ویرایش شد', 'success');
      await loadAccounts();
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.classList.remove('hidden');
    }
  }

  // ===== آرشیو / بازگرداندن حساب (حذف امن) =====
  async function submitArchiveToggle() {
    const id = document.getElementById('editAccountId').value;
    const account = latestAccounts.find((a) => a.id === Number(id));
    if (!account) return;

    try {
      const url = account.isArchived
        ? `${API_BASE}/accounts/${id}/restore`
        : `${API_BASE}/accounts/${id}`;
      const method = account.isArchived ? 'PATCH' : 'DELETE';

      const res = await fetch(url, { method, headers: authHeaders() });
      if (!res.ok) throw new Error('عملیات با خطا مواجه شد');

      closeModal();
      showToast(account.isArchived ? 'حساب بازگردانده شد' : 'حساب آرشیو شد', 'success');
      await loadAccounts();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function toggleShowArchived() {
    showArchived = document.getElementById('showArchivedToggle').checked;
    renderAccountsList();
  }

  // ===== انتقال بین حساب‌ها =====

  // پر کردن سلکت‌باکس‌های «از حساب» و «به حساب» با حساب‌های فعال کاربر
  function populateTransferAccountSelects() {
    const active = latestAccounts.filter((a) => !a.isArchived);
    const optionsHtml = active
      .map((a) => `<option value="${a.id}">${escapeHtml(a.name)} (${escapeHtml(CURRENCY_LABELS[a.currency] || a.currency)})</option>`)
      .join('');

    const fromSelect = document.getElementById('transferFromAccount');
    const toSelect = document.getElementById('transferToAccount');
    if (fromSelect) fromSelect.innerHTML = optionsHtml;
    if (toSelect) toSelect.innerHTML = optionsHtml;

    // به‌صورت پیش‌فرض دو حساب متفاوت انتخاب بشن (اگر حداقل دو حساب فعال وجود داشته باشه)
    if (toSelect && active.length > 1) {
      toSelect.value = String(active[1].id);
    }
  }

  function openTransferModal() {
    document.getElementById('transferError').classList.add('hidden');
    document.getElementById('transferTitle').value = '';
    document.getElementById('transferAmount').value = '';
    document.getElementById('transferDate').value = '';
    document.getElementById('transferDescription').value = '';
    window.AmountInput.refreshForm(document.getElementById('transferAccount'));

    const active = latestAccounts.filter((a) => !a.isArchived);
    if (active.length < 2) {
      showToast('برای انتقال، حداقل به دو حساب فعال نیاز است', 'error');
      return;
    }

    populateTransferAccountSelects();
    openModal('transferAccount');
  }

  async function submitTransfer() {
    const title = (document.getElementById('transferTitle').value || '').trim();
    const fromAccountId = document.getElementById('transferFromAccount').value;
    const toAccountId = document.getElementById('transferToAccount').value;
    const amount = window.AmountInput.parse(document.getElementById('transferAmount').value);
    const date = (document.getElementById('transferDate').value || '').trim();
    const description = (document.getElementById('transferDescription').value || '').trim();
    const errorBox = document.getElementById('transferError');
    errorBox.classList.add('hidden');

    if (!fromAccountId || !toAccountId) {
      errorBox.textContent = 'لطفاً حساب مبدأ و مقصد را انتخاب کنید';
      errorBox.classList.remove('hidden');
      return;
    }
    if (fromAccountId === toAccountId) {
      errorBox.textContent = 'حساب مبدأ و مقصد نمی‌توانند یکسان باشند';
      errorBox.classList.remove('hidden');
      return;
    }
    if (!amount || Number(amount) <= 0) {
      errorBox.textContent = 'لطفاً مبلغ معتبری وارد کنید';
      errorBox.classList.remove('hidden');
      return;
    }
    if (!date) {
      errorBox.textContent = 'لطفاً تاریخ انتقال را وارد کنید';
      errorBox.classList.remove('hidden');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/transfers`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          title: title || undefined,
          fromAccountId: Number(fromAccountId),
          toAccountId: Number(toAccountId),
          amount: Number(amount),
          date,
          description: description || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'ثبت انتقال با خطا مواجه شد');

      closeModal();
      showToast('انتقال با موفقیت ثبت شد', 'success');
      await Promise.all([loadAccounts(), loadTransfers()]);
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.classList.remove('hidden');
    }
  }

  // ===== کارت هر انتقال در لیست تاریخچه =====
  function transferRow(transfer) {
    const fromAccount = latestAccounts.find((a) => a.id === transfer.fromAccountId);
    const currency = fromAccount ? fromAccount.currency : 'IRR';
    return `
      <div class="flex items-center justify-between border border-gray-100 rounded-xl p-3 gap-2 flex-wrap">
        <div class="text-sm text-zinc-700">
          ${transfer.title ? `<div class="font-bold mb-0.5">${escapeHtml(transfer.title)}</div>` : ''}
          <div class="flex items-center gap-2">
            <span class="${transfer.title ? '' : 'font-bold'}">${escapeHtml(transfer.fromAccountName || 'حساب حذف‌شده')}</span>
            <span class="text-zinc-400 inline-block" style="transform: scaleX(-1);">➜</span>
            <span class="${transfer.title ? '' : 'font-bold'}">${escapeHtml(transfer.toAccountName || 'حساب حذف‌شده')}</span>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-xs text-zinc-500">${escapeHtml(toPersianDigits(transfer.date))}</span>
          <span class="font-bold text-main-color">${formatAmount(transfer.amount, currency)}</span>
          <button class="text-xs text-red-color" onclick="AccountsApp.deleteTransfer(${transfer.id})" title="حذف انتقال">حذف</button>
        </div>
      </div>
    `;
  }

  async function loadTransfers() {
    const container = document.getElementById('transfersList');
    try {
      const res = await fetch(`${API_BASE}/transfers`, { headers: authHeaders() });
      if (!res.ok) throw new Error('خطا در دریافت انتقال‌ها');
      latestTransfers = await res.json();

      if (!container) return;
      if (!latestTransfers.length) {
        container.innerHTML = '<p class="text-center text-gray-400 mt-6">هنوز انتقالی ثبت نشده است.</p>';
        return;
      }
      container.innerHTML = latestTransfers.slice(0, 10).map(transferRow).join('');
    } catch (err) {
      console.error(err);
      if (container) {
        container.innerHTML = '<p class="text-center text-gray-400 mt-6">دریافت انتقال‌ها با خطا مواجه شد</p>';
      }
    }
  }

  async function deleteTransfer(id) {
    if (!(await window.HesabinoUI.confirmDialog('آیا از حذف این انتقال مطمئن هستید؟'))) return;

    try {
      const res = await fetch(`${API_BASE}/transfers/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('حذف انتقال با خطا مواجه شد');

      showToast('انتقال حذف شد', 'success');
      await Promise.all([loadAccounts(), loadTransfers()]);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  window.AccountsApp = {
    openAddModal,
    submitCreate,
    openEditModal,
    submitUpdate,
    submitArchiveToggle,
    toggleShowArchived,
    openTransferModal,
    submitTransfer,
    deleteTransfer,
  };

  document.addEventListener('DOMContentLoaded', async () => {
    await loadAccounts();
    loadTransfers();
  });
})();