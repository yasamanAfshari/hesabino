(function () {
  'use strict';

  const API_BASE = '/api';

  // همه‌ی رکوردهای کاربر (بدهی + طلب) که از سرور خونده شده
  let allItems = [];

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

  function toEnglishDigits(str) {
    const persian = '۰۱۲۳۴۵۶۷۸۹';
    return String(str || '').replace(/[۰-۹]/g, (d) => String(persian.indexOf(d)));
  }

  // نرمال‌سازی تاریخ شمسی به «YYYY/MM/DD» با ارقام انگلیسی، برای مقایسه‌ی صحیح متنی
  function normalizeDate(str) {
    const normalized = toEnglishDigits(str).trim();
    const match = normalized.match(/^(\d{3,4})[/-](\d{1,2})[/-](\d{1,2})$/);
    if (!match) return null;
    const [, y, m, d] = match;
    return `${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
  }

  function formatAmount(amount) {
    const grouped = Number(amount || 0).toLocaleString('en-US');
    return toPersianDigits(grouped);
  }

  // نمایش مبلغ به تومان با علامت منفی در انتها (رسم رایج فارسی)، مثلاً «۸,۰۰۰,۰۰۰- تومان»
  function formatSignedToman(amount) {
    const abs = Math.abs(Number(amount || 0));
    const sign = Number(amount || 0) < 0 ? '-' : '';
    return `${formatAmount(abs)}${sign} تومان`;
  }

  function debounce(fn, wait) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  // ===== toast =====
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

  const PENCIL_ICON = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12.6142 2.46067L13.9984 1.07566C14.2869 0.787107 14.6783 0.625 15.0864 0.625C15.4944 0.625 15.8858 0.787107 16.1743 1.07566C16.4629 1.36421 16.625 1.75557 16.625 2.16364C16.625 2.57172 16.4629 2.96308 16.1743 3.25163L4.38454 15.0414C3.95076 15.475 3.41583 15.7936 2.82805 15.9686L0.625 16.625L1.2814 14.422C1.4564 13.8342 1.77504 13.2992 2.20857 12.8655L12.615 2.46067H12.6142ZM12.6142 2.46067L14.7787 4.62515" stroke="white" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" />
    </svg>`;

  const TRASH_ICON = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M15.75 4.48499C13.2525 4.23749 10.74 4.10999 8.235 4.10999C6.75 4.10999 5.265 4.18499 3.78 4.33499L2.25 4.48499" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
      <path d="M6.375 3.7275L6.54 2.745C6.66 2.0325 6.75 1.5 8.0175 1.5H9.9825C11.25 1.5 11.3475 2.0625 11.46 2.7525L11.625 3.7275" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
      <path d="M14.1376 6.85498L13.6501 14.4075C13.5676 15.585 13.5 16.5 11.4075 16.5H6.59255C4.50005 16.5 4.43255 15.585 4.35005 14.4075L3.86255 6.85498" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
      <path d="M7.74756 12.375H10.2451" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
      <path d="M7.125 9.375H10.875" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
    </svg>`;

  function statusLabel(status, type) {
    if (status === 'paid') return 'پرداخت شده';
    if (status === 'overdue') return 'سررسید گذشته';
    return type === 'receivable' ? 'وصول نشده' : 'پرداخت نشده';
  }

  function statusBadgeClasses(status) {
    if (status === 'paid') return 'bg-green-50 text-green-700';
    if (status === 'overdue') return 'bg-red-50 text-red-700';
    return 'bg-orange-50 text-orange-600';
  }

  function remainingDaysLabel(remainingDays) {
    if (remainingDays === null || remainingDays === undefined) return '-';
    if (remainingDays < 0) return `${toPersianDigits(remainingDays)} روز`;
    return `${toPersianDigits(remainingDays)} روز`;
  }

  function remainingDaysClasses(remainingDays) {
    if (remainingDays === null || remainingDays === undefined) return 'text-gray-500 bg-gray-50';
    if (remainingDays < 0) return 'text-red-600 bg-red-50';
    if (remainingDays <= 3) return 'text-orange-600 bg-orange-50';
    return 'text-green-600 bg-green-50';
  }

  // ===== ساخت یک سطر جدول =====
  function renderRow(item) {
    return `
      <tr class="transition-all duration-150 hover:bg-gray-50" data-id="${item.id}">
        <td class="px-5 py-3.5 text-gray-800 font-medium">${escapeHtml(item.counterparty)}</td>
        <td class="px-5 py-3.5 font-mono font-medium text-gray-800 whitespace-nowrap">${formatAmount(item.amount)} تومان</td>
        <td class="px-5 py-3.5 text-gray-700 whitespace-nowrap">${escapeHtml(toPersianDigits(item.dueDate))}</td>
        <td class="px-5 py-3.5 whitespace-nowrap">
          <span class="${remainingDaysClasses(item.remainingDays)} px-2.5 py-1 rounded-full text-xs font-medium">${remainingDaysLabel(item.remainingDays)}</span>
        </td>
        <td class="px-5 py-3.5">
          <span class="${statusBadgeClasses(item.status)} px-2.5 py-1 rounded-full text-xs font-medium">${statusLabel(item.status, item.type)}</span>
        </td>
        <td class="px-5 py-3.5">
          <div class="flex justify-center gap-2.5">
            <button type="button" class="bg-main-color p-1 rounded-md" title="ویرایش" onclick="DebtsApp.openEdit('${item.type}', ${item.id})">${PENCIL_ICON}</button>
            <button type="button" class="bg-main-color p-1 rounded-md" title="حذف" onclick="DebtsApp.deleteItem(${item.id})">${TRASH_ICON}</button>
          </div>
        </td>
      </tr>`;
  }

  function renderTable(tbodyId, list, emptyText) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="px-5 py-6 text-center text-gray-400">${emptyText}</td></tr>`;
      return;
    }
    tbody.innerHTML = list.map(renderRow).join('');
  }

  function renderSummary(summary) {
    document.getElementById('debtsMyDebtAmount').textContent = `${formatAmount(summary.myDebt)} تومان`;
    document.getElementById('debtsReceivableAmount').textContent = `${formatAmount(summary.receivable)} تومان`;
    document.getElementById('debtsNetAmount').textContent = formatSignedToman(summary.net);
  }

  // ===== سلکت‌باکس سفارشی =====
  function getCustomSelectValue(containerId) {
    const container = document.getElementById(containerId);
    return container ? (container.dataset.value || '') : '';
  }

  function setCustomSelectValue(containerId, value) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const valueEl = container.querySelector('.selected-value');
    const placeholder = valueEl.dataset.placeholder || valueEl.textContent;

    if (!value) {
      valueEl.textContent = placeholder;
      delete container.dataset.value;
      return;
    }

    let matched = null;
    container.querySelectorAll('.option').forEach((opt) => {
      const optValue = opt.dataset.value || opt.textContent.trim();
      if (optValue === value) matched = opt;
    });

    if (matched) {
      valueEl.textContent = matched.textContent.trim();
      container.dataset.value = matched.dataset.value || matched.textContent.trim();
    } else {
      valueEl.textContent = value;
      container.dataset.value = value;
    }
  }

  function resetCustomSelect(containerId) {
    setCustomSelectValue(containerId, '');
  }

  function setupSelectValueTracking() {
    document.querySelectorAll('.custom-select').forEach((select) => {
      select.querySelectorAll('.option').forEach((opt) => {
        opt.addEventListener('click', () => {
          select.dataset.value = opt.dataset.value || opt.textContent.trim();
        });
      });
    });
  }

  // ===== فرم‌های ثبت/ویرایش =====
  function showFormError(elId, msg) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  function hideFormError(elId) {
    const el = document.getElementById(elId);
    if (el) el.classList.add('hidden');
  }

  function resetForm(kind) {
    const isDebt = kind === 'debt';
    const formId = isDebt ? 'debtForm' : 'demandForm';
    const idFieldId = isDebt ? 'debtId' : 'demandId';
    const statusSelectId = isDebt ? 'debtStatusSelect' : 'demandStatusSelect';
    const errorId = isDebt ? 'debtModalFormError' : 'demandModalFormError';

    const form = document.getElementById(formId);
    if (form) form.reset();
    document.getElementById(idFieldId).value = '';
    resetCustomSelect(statusSelectId);
    hideFormError(errorId);
  }

  function openAddModal(kind) {
    resetForm(kind);
    if (kind === 'debt') {
      document.getElementById('debtModalTitle').textContent = 'ثبت بدهی جدید';
      document.getElementById('debtSubmitBtn').textContent = 'ثبت';
      window.openModal('debtModal');
    } else {
      document.getElementById('demandModalTitle').textContent = 'ثبت طلب جدید';
      document.getElementById('demandSubmitBtn').textContent = 'ثبت';
      window.openModal('demandModal');
    }
  }

  async function getItemById(id) {
    const cached = allItems.find((it) => it.id === id);
    if (cached) return cached;
    try {
      const res = await fetch(`${API_BASE}/debts/${id}`, { headers: authHeaders() });
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.error('خطا در دریافت رکورد:', err);
      return null;
    }
  }

  async function openEditModal(kind, id) {
    const item = await getItemById(id);
    if (!item) {
      showToast('رکورد مورد نظر پیدا نشد', 'error');
      return;
    }

    resetForm(kind);
    const isDebt = kind === 'debt';

    document.getElementById(isDebt ? 'debtId' : 'demandId').value = item.id;
    document.getElementById(isDebt ? 'debtModalTitle' : 'demandModalTitle').textContent = isDebt ? 'ویرایش بدهی' : 'ویرایش طلب';
    document.getElementById(isDebt ? 'debtSubmitBtn' : 'demandSubmitBtn').textContent = 'ذخیره تغییرات';

    document.getElementById(isDebt ? 'debtCounterpartyInput' : 'demandCounterpartyInput').value = item.counterparty || '';
    document.getElementById(isDebt ? 'debtAmountInput' : 'demandAmountInput').value = item.amount != null ? item.amount : '';
    document.getElementById(isDebt ? 'debtDueDatePicker' : 'demandDueDatePicker').value = item.dueDate || '';
    document.getElementById(isDebt ? 'debtReminderInput' : 'demandReminderInput').checked = !!item.reminder;

    setCustomSelectValue(isDebt ? 'debtStatusSelect' : 'demandStatusSelect', item.isPaid ? 'paid' : 'unpaid');

    window.openModal(isDebt ? 'debtModal' : 'demandModal');
  }

  async function handleFormSubmit(kind, e) {
    e.preventDefault();
    const isDebt = kind === 'debt';
    const errorId = isDebt ? 'debtModalFormError' : 'demandModalFormError';
    hideFormError(errorId);

    const counterparty = (document.getElementById(isDebt ? 'debtCounterpartyInput' : 'demandCounterpartyInput').value || '').trim();
    const amountRaw = document.getElementById(isDebt ? 'debtAmountInput' : 'demandAmountInput').value;
    const dueDate = (document.getElementById(isDebt ? 'debtDueDatePicker' : 'demandDueDatePicker').value || '').trim();
    const statusValue = getCustomSelectValue(isDebt ? 'debtStatusSelect' : 'demandStatusSelect');
    const reminder = !!document.getElementById(isDebt ? 'debtReminderInput' : 'demandReminderInput').checked;

    if (!counterparty) {
      showFormError(errorId, 'لطفاً طرف حساب را وارد کنید');
      return;
    }
    if (amountRaw === '' || Number(amountRaw) <= 0 || Number.isNaN(Number(amountRaw))) {
      showFormError(errorId, 'لطفاً مبلغ معتبری وارد کنید');
      return;
    }
    if (!dueDate) {
      showFormError(errorId, 'لطفاً تاریخ سررسید را وارد کنید');
      return;
    }

    const payload = {
      type: kind,
      counterparty,
      amount: Number(amountRaw),
      dueDate,
      isPaid: statusValue === 'paid',
      reminder,
    };

    const idFieldId = isDebt ? 'debtId' : 'demandId';
    const id = document.getElementById(idFieldId).value;
    const btnId = isDebt ? 'debtSubmitBtn' : 'demandSubmitBtn';
    const btn = document.getElementById(btnId);
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'در حال ذخیره...';

    try {
      const url = id ? `${API_BASE}/debts/${id}` : `${API_BASE}/debts`;
      const method = id ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data.message || `خطا در ذخیره‌سازی (کد ${res.status})`;
        showFormError(errorId, msg);
        showToast(msg, 'error');
        console.error('Debt/receivable save failed:', res.status, data);
        return;
      }

      window.closeModal();
      showToast(id ? 'با موفقیت ویرایش شد' : 'با موفقیت ثبت شد', 'success');
      applyOverview(data);
    } catch (err) {
      console.error('Debt/receivable save network error:', err);
      showFormError(errorId, 'ارتباط با سرور برقرار نشد');
      showToast('ارتباط با سرور برقرار نشد', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }

  async function deleteItem(id) {
    if (!window.confirm('آیا از حذف این رکورد مطمئن هستید؟')) return;

    try {
      const res = await fetch(`${API_BASE}/debts/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data.message || `خطا در حذف (کد ${res.status})`;
        showToast(msg, 'error');
        console.error('Delete failed:', res.status, data);
        return;
      }

      showToast('با موفقیت حذف شد', 'success');
      applyOverview(data);
    } catch (err) {
      console.error('Delete network error:', err);
      showToast('ارتباط با سرور برقرار نشد', 'error');
    }
  }

  // ===== فیلترها (سمت کلاینت) =====
  function filterList(list, opts) {
    let filtered = list;

    if (opts.search) {
      const search = opts.search.toLowerCase();
      filtered = filtered.filter((it) => (it.counterparty || '').toLowerCase().includes(search));
    }
    if (opts.status) {
      filtered = filtered.filter((it) => it.status === opts.status);
    }
    if (opts.dateFrom) {
      const from = normalizeDate(opts.dateFrom);
      if (from) filtered = filtered.filter((it) => (normalizeDate(it.dueDate) || '') >= from);
    }
    if (opts.dateTo) {
      const to = normalizeDate(opts.dateTo);
      if (to) filtered = filtered.filter((it) => (normalizeDate(it.dueDate) || '') <= to);
    }

    return filtered;
  }

  function applyDebtFilter() {
    const list = allItems.filter((it) => it.type === 'debt');
    const filtered = filterList(list, {
      search: (document.getElementById('debtSearchInput')?.value || '').trim(),
      status: getCustomSelectValue('debtStatusFilter'),
      dateFrom: document.getElementById('debtDateFromPicker')?.value || '',
      dateTo: document.getElementById('debtDateToPicker')?.value || '',
    });
    renderTable('debtsTableBody', filtered, 'بدهی‌ای برای نمایش وجود ندارد');
  }

  function applyDemandFilter() {
    const list = allItems.filter((it) => it.type === 'receivable');
    const filtered = filterList(list, {
      search: (document.getElementById('demandSearchInput')?.value || '').trim(),
      status: getCustomSelectValue('demandStatusFilter'),
      dateFrom: document.getElementById('demandDateFromPicker')?.value || '',
      dateTo: document.getElementById('demandDateToPicker')?.value || '',
    });
    renderTable('demandsTableBody', filtered, 'طلبی برای نمایش وجود ندارد');
  }

  function resetFilter(kind) {
    if (kind === 'debt') {
      const searchInput = document.getElementById('debtSearchInput');
      if (searchInput) searchInput.value = '';
      resetCustomSelect('debtStatusFilter');
      document.getElementById('debtDateFromPicker').value = '';
      document.getElementById('debtDateToPicker').value = '';
      applyDebtFilter();
    } else {
      const searchInput = document.getElementById('demandSearchInput');
      if (searchInput) searchInput.value = '';
      resetCustomSelect('demandStatusFilter');
      document.getElementById('demandDateFromPicker').value = '';
      document.getElementById('demandDateToPicker').value = '';
      applyDemandFilter();
    }
  }

  // ===== اعمال نتیجه‌ی سرور روی صفحه =====
  function applyOverview(data) {
    const summary = data.summary || { myDebt: 0, receivable: 0, net: 0 };
    allItems = Array.isArray(data.items) ? data.items : [];
    renderSummary(summary);
    applyDebtFilter();
    applyDemandFilter();
  }

  async function loadDebts() {
    const debtsBody = document.getElementById('debtsTableBody');
    const demandsBody = document.getElementById('demandsTableBody');
    if (debtsBody) debtsBody.innerHTML = `<tr><td colspan="6" class="px-5 py-6 text-center text-gray-400">در حال بارگذاری بدهی‌ها...</td></tr>`;
    if (demandsBody) demandsBody.innerHTML = `<tr><td colspan="6" class="px-5 py-6 text-center text-gray-400">در حال بارگذاری طلب‌ها...</td></tr>`;

    const token = localStorage.getItem('access_token');
    if (!token) {
      console.warn('توکن ورود پیدا نشد؛ کاربر لاگین نیست.');
      const msg = `<tr><td colspan="6" class="px-5 py-6 text-center text-red-color">برای مشاهده باید وارد حساب کاربری شوید</td></tr>`;
      if (debtsBody) debtsBody.innerHTML = msg;
      if (demandsBody) demandsBody.innerHTML = msg;
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/debts`, { headers: authHeaders() });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error('خطا در دریافت بدهی/طلب:', res.status, data);
        const msg = `<tr><td colspan="6" class="px-5 py-6 text-center text-red-color">${escapeHtml(data.message || `خطا در دریافت اطلاعات (کد ${res.status})`)}</td></tr>`;
        if (debtsBody) debtsBody.innerHTML = msg;
        if (demandsBody) demandsBody.innerHTML = msg;
        return;
      }

      const data = await res.json();
      applyOverview(data);
    } catch (err) {
      console.error('ارتباط با سرور برای دریافت بدهی/طلب برقرار نشد:', err);
      const msg = `<tr><td colspan="6" class="px-5 py-6 text-center text-red-color">ارتباط با سرور برقرار نشد (کنسول مرورگر را بررسی کنید)</td></tr>`;
      if (debtsBody) debtsBody.innerHTML = msg;
      if (demandsBody) demandsBody.innerHTML = msg;
    }
  }

  function onReady() {
    setupSelectValueTracking();

    document.getElementById('debtForm')?.addEventListener('submit', (e) => handleFormSubmit('debt', e));
    document.getElementById('demandForm')?.addEventListener('submit', (e) => handleFormSubmit('receivable', e));

    document.getElementById('debtSearchInput')?.addEventListener('input', debounce(applyDebtFilter, 250));
    document.getElementById('demandSearchInput')?.addEventListener('input', debounce(applyDemandFilter, 250));

    document.querySelectorAll('#debtStatusFilter .option').forEach((opt) => opt.addEventListener('click', applyDebtFilter));
    document.querySelectorAll('#demandStatusFilter .option').forEach((opt) => opt.addEventListener('click', applyDemandFilter));

    document.getElementById('debtDateFromPicker')?.addEventListener('change', applyDebtFilter);
    document.getElementById('debtDateToPicker')?.addEventListener('change', applyDebtFilter);
    document.getElementById('demandDateFromPicker')?.addEventListener('change', applyDemandFilter);
    document.getElementById('demandDateToPicker')?.addEventListener('change', applyDemandFilter);

    loadDebts();
  }

  window.DebtsApp = {
    openAddModal,
    openEdit: openEditModal,
    deleteItem,
    resetFilter,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }
})();
