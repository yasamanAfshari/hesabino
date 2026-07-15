(function () {
  'use strict';

  const API_BASE = '/api';

  // لیست کامل تراکنش‌های کاربر که از سرور خونده شده (فیلترها روی همین آرایه اعمال می‌شن)
  let allTransactions = [];

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
    const grouped = Number(amount || 0).toLocaleString('en-US');
    return toPersianDigits(grouped);
  }

  function debounce(fn, wait) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  // ===== پیام گوشه‌ی صفحه (toast) برای موفقیت/خطا =====
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

  // ===== آیکون دکمه‌های عملیات هر سطر =====
  const EYE_ICON = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M11.6849 9C11.6849 10.485 10.4849 11.685 8.99994 11.685C7.51494 11.685 6.31494 10.485 6.31494 9C6.31494 7.515 7.51494 6.315 8.99994 6.315C10.4849 6.315 11.6849 7.515 11.6849 9Z" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
      <path d="M8.99988 15.2025C11.6474 15.2025 14.1149 13.6425 15.8324 10.9425C16.5074 9.88501 16.5074 8.10751 15.8324 7.05001C14.1149 4.35001 11.6474 2.79001 8.99988 2.79001C6.35238 2.79001 3.88488 4.35001 2.16738 7.05001C1.49238 8.10751 1.49238 9.88501 2.16738 10.9425C3.88488 13.6425 6.35238 15.2025 8.99988 15.2025Z" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
    </svg>`;

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

  function typeLabel(type) {
    return type === 'income' ? 'درآمد' : 'هزینه';
  }

  function typeBadgeClasses(type) {
    return type === 'income' ? 'text-emerald-700 bg-emerald-50' : 'text-rose-600 bg-rose-50';
  }

  // ===== ساخت یک سطر جدول برای یک تراکنش (داینامیک) =====
  function renderRow(tx) {
    const dateTime = tx.time ? `${tx.date} - ${tx.time}` : tx.date;
    return `
      <tr class="transition-all duration-150" data-id="${tx.id}">
        <td class="px-5 py-3.5 text-gray-800 whitespace-nowrap">${escapeHtml(dateTime)}</td>
        <td class="px-5 py-3.5 text-gray-700">${escapeHtml(tx.description || '-')}</td>
        <td class="px-5 py-3.5"><span class="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full text-xs font-medium">${escapeHtml(tx.category || '-')}</span></td>
        <td class="px-5 py-3.5"><span class="${typeBadgeClasses(tx.type)} px-2.5 py-1 rounded-full text-xs font-medium">${typeLabel(tx.type)}</span></td>
        <td class="px-5 py-3.5 font-mono font-medium text-gray-800 whitespace-nowrap">${formatAmount(tx.amount)}</td>
        <td>
          <div class="flex justify-center gap-2.5">
            <button type="button" class="bg-main-color p-1 rounded-md" title="جزئیات" onclick="TransactionsApp.openView(${tx.id})">${EYE_ICON}</button>
            <button type="button" class="bg-main-color p-1 rounded-md" title="ویرایش" onclick="TransactionsApp.openEdit(${tx.id})">${PENCIL_ICON}</button>
            <button type="button" class="bg-main-color p-1 rounded-md" title="حذف" onclick="TransactionsApp.openDelete(${tx.id})">${TRASH_ICON}</button>
          </div>
        </td>
      </tr>`;
  }

  function renderTable(list) {
    const tbody = document.getElementById('transactionsTableBody');
    if (!tbody) return;
    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="px-5 py-6 text-center text-gray-400">تراکنشی برای نمایش وجود ندارد</td></tr>`;
      return;
    }
    tbody.innerHTML = list.map(renderRow).join('');
  }

  // ===== خواندن/نوشتن مقدار سلکت‌باکس‌های سفارشی (که input واقعی نیستن) =====
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
      // مقداری که در لیست گزینه‌ها نیست (مثلاً دسته‌ی دلخواه)؛ به همون شکل نمایش داده می‌شه
      valueEl.textContent = value;
      container.dataset.value = value;
    }
  }

  function resetCustomSelect(containerId) {
    setCustomSelectValue(containerId, '');
  }

  // هر بار که یک گزینه از سلکت‌باکس سفارشی کلیک می‌شه، مقدارش رو روی خودِ کانتینر ذخیره می‌کنیم
  // (این جدا از منطق باز/بسته کردن دراپ‌داون در public.js هست)
  function setupSelectValueTracking() {
    document.querySelectorAll('.custom-select').forEach((select) => {
      select.querySelectorAll('.option').forEach((opt) => {
        opt.addEventListener('click', () => {
          select.dataset.value = opt.dataset.value || opt.textContent.trim();
        });
      });
    });
  }

  // ===== فرم ثبت/ویرایش =====
  function showFormError(msg) {
    const el = document.getElementById('transactionFormError');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  function hideFormError() {
    const el = document.getElementById('transactionFormError');
    if (el) el.classList.add('hidden');
  }

  function resetTransactionForm() {
    const form = document.getElementById('transactionForm');
    if (form) form.reset();
    document.getElementById('transactionId').value = '';
    resetCustomSelect('modalSubtypeSelect');
    resetCustomSelect('modalFinancialTypeSelect');
    resetCustomSelect('modalCategorySelect');
    hideFormError();
  }

  function openAddTransactionModal() {
    resetTransactionForm();
    document.getElementById('transactionModalTitle').textContent = 'ثبت تراکنش جدید';
    document.getElementById('transactionSubmitBtn').textContent = 'ثبت';
    window.openModal('addTransactionModal');
  }

  // ===== پیدا کردن یک تراکنش: اول از کش محلی، اگه نبود از سرور =====
  async function getTransactionById(id) {
    const cached = allTransactions.find((t) => t.id === id);
    if (cached) return cached;

    try {
      const res = await fetch(`${API_BASE}/transactions/${id}`, { headers: authHeaders() });
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.error('خطا در دریافت تراکنش:', err);
      return null;
    }
  }

  async function openEditModal(id) {
    const tx = await getTransactionById(id);
    if (!tx) {
      showToast('تراکنش مورد نظر پیدا نشد', 'error');
      return;
    }

    resetTransactionForm();
    document.getElementById('transactionId').value = tx.id;
    document.getElementById('transactionModalTitle').textContent = 'ویرایش تراکنش';
    document.getElementById('transactionSubmitBtn').textContent = 'ذخیره تغییرات';

    const dateInput = document.getElementById('modalDatePicker');
    const timeInput = document.getElementById('modalTimePicker');
    if (dateInput) dateInput.value = tx.date || '';
    if (timeInput) timeInput.value = tx.time || '';

    setCustomSelectValue('modalSubtypeSelect', tx.subtype || '');
    setCustomSelectValue('modalFinancialTypeSelect', tx.type || '');
    setCustomSelectValue('modalCategorySelect', tx.category || '');

    document.getElementById('modalAmountInput').value = tx.amount != null ? tx.amount : '';
    document.getElementById('modalAccountInput').value = tx.account || '';
    document.getElementById('modalDescriptionInput').value = tx.description || '';

    window.openModal('addTransactionModal');
  }

  async function handleFormSubmit(e) {
    e.preventDefault();
    hideFormError();

    const date = (document.getElementById('modalDatePicker').value || '').trim();
    const time = (document.getElementById('modalTimePicker').value || '').trim();
    const type = getCustomSelectValue('modalFinancialTypeSelect');
    const subtype = getCustomSelectValue('modalSubtypeSelect');
    const category = getCustomSelectValue('modalCategorySelect');
    const amountRaw = document.getElementById('modalAmountInput').value;
    const account = (document.getElementById('modalAccountInput').value || '').trim();
    const description = (document.getElementById('modalDescriptionInput').value || '').trim();

    if (!date) {
      showFormError('لطفاً تاریخ تراکنش را وارد کنید');
      return;
    }
    if (!type) {
      showFormError('لطفاً نوع مالی (واریز/برداشت) را انتخاب کنید');
      return;
    }
    if (amountRaw === '' || Number(amountRaw) <= 0 || Number.isNaN(Number(amountRaw))) {
      showFormError('لطفاً مبلغ معتبری وارد کنید');
      return;
    }

    const payload = {
      date,
      time: time || undefined,
      type,
      subtype: subtype || undefined,
      category: category || undefined,
      account: account || undefined,
      description: description || undefined,
      amount: Number(amountRaw),
    };

    const id = document.getElementById('transactionId').value;
    const btn = document.getElementById('transactionSubmitBtn');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'در حال ذخیره...';

    try {
      const url = id ? `${API_BASE}/transactions/${id}` : `${API_BASE}/transactions`;
      const method = id ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data.message || `خطا در ذخیره‌سازی تراکنش (کد ${res.status})`;
        showFormError(msg);
        showToast(msg, 'error');
        console.error('Transaction save failed:', res.status, data);
        return;
      }

      window.closeModal();
      showToast(id ? 'تراکنش با موفقیت ویرایش شد' : 'تراکنش با موفقیت ثبت شد', 'success');
      await loadTransactions();
    } catch (err) {
      console.error('Transaction save network error:', err);
      showFormError('ارتباط با سرور برقرار نشد');
      showToast('ارتباط با سرور برقرار نشد', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }

  // ===== مودال حذف =====
  function openDeleteModal(id) {
    document.getElementById('deleteTransactionId').value = id;
    const errEl = document.getElementById('deleteTransactionError');
    if (errEl) errEl.classList.add('hidden');
    window.openModal('deleteTransactionModal');
  }

  async function confirmDelete() {
    const id = document.getElementById('deleteTransactionId').value;
    if (!id) return;

    const btn = document.getElementById('confirmDeleteTransactionBtn');
    const errEl = document.getElementById('deleteTransactionError');
    btn.disabled = true;

    try {
      const res = await fetch(`${API_BASE}/transactions/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data.message || `خطا در حذف تراکنش (کد ${res.status})`;
        errEl.textContent = msg;
        errEl.classList.remove('hidden');
        showToast(msg, 'error');
        console.error('Transaction delete failed:', res.status, data);
        return;
      }

      window.closeModal();
      showToast('تراکنش با موفقیت حذف شد', 'success');
      await loadTransactions();
    } catch (err) {
      console.error('Transaction delete network error:', err);
      errEl.textContent = 'ارتباط با سرور برقرار نشد';
      errEl.classList.remove('hidden');
      showToast('ارتباط با سرور برقرار نشد', 'error');
    } finally {
      btn.disabled = false;
    }
  }

  // ===== مودال جزئیات =====
  async function openViewModal(id) {
    const tx = await getTransactionById(id);
    if (!tx) {
      showToast('تراکنش مورد نظر پیدا نشد', 'error');
      return;
    }

    const badge = document.getElementById('viewTypeBadge');
    badge.textContent = tx.type === 'income' ? 'واریز' : 'برداشت';
    badge.className = 'transaction-type-badge inline-block font-bold px-6 py-2 rounded-full text-sm ' +
      (tx.type === 'income' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600');

    document.getElementById('viewDate').textContent = tx.time ? `${tx.date} - ${tx.time}` : tx.date;

    const amountEl = document.getElementById('viewAmount');
    amountEl.textContent = (tx.type === 'income' ? '+' : '-') + formatAmount(tx.amount);
    amountEl.className = 'transaction-amount-value font-extrabold text-3xl mb-3 ' +
      (tx.type === 'income' ? 'text-emerald-600' : 'text-rose-600');

    document.getElementById('viewCategory').textContent = tx.category || '-';
    document.getElementById('viewSubtype').textContent = tx.subtype || '-';
    document.getElementById('viewDescription').textContent = tx.description || '-';
    document.getElementById('viewAccount').textContent = tx.account || '-';

    window.openModal('viewTransactionModal');
  }

  // ===== فیلترها (روی داده‌ی از قبل خونده‌شده، سمت کلاینت اعمال می‌شن) =====
  function applyFilters() {
    const search = (document.getElementById('filterSearchInput')?.value || '').trim().toLowerCase();
    const type = getCustomSelectValue('filterTypeSelect');
    const category = getCustomSelectValue('filterCategorySelect');
    const date = (document.getElementById('filterDatePicker')?.value || '').trim();

    let list = allTransactions;

    if (search) {
      list = list.filter((t) =>
        [t.description, t.category, t.subtype, t.account].some((v) => (v || '').toLowerCase().includes(search)),
      );
    }
    if (type) list = list.filter((t) => t.type === type);
    if (category) list = list.filter((t) => t.category === category);
    if (date) list = list.filter((t) => t.date === date);

    renderTable(list);
  }

  function resetFilter() {
    const searchInput = document.getElementById('filterSearchInput');
    if (searchInput) searchInput.value = '';
    resetCustomSelect('filterTypeSelect');
    resetCustomSelect('filterCategorySelect');
    const dateInput = document.getElementById('filterDatePicker');
    if (dateInput) dateInput.value = '';
    applyFilters();
  }

  // ===== بارگذاری تراکنش‌ها از سرور =====
  async function loadTransactions() {
    const tbody = document.getElementById('transactionsTableBody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="6" class="px-5 py-6 text-center text-gray-400">در حال بارگذاری تراکنش‌ها...</td></tr>`;
    }

    const token = localStorage.getItem('access_token');
    if (!token) {
      console.warn('توکن ورود پیدا نشد؛ کاربر لاگین نیست.');
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="6" class="px-5 py-6 text-center text-red-color">برای مشاهده‌ی تراکنش‌ها باید وارد حساب کاربری شوید</td></tr>`;
      }
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/transactions`, { headers: authHeaders() });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error('خطا در دریافت تراکنش‌ها:', res.status, data);
        if (tbody) {
          tbody.innerHTML = `<tr><td colspan="6" class="px-5 py-6 text-center text-red-color">${escapeHtml(data.message || `خطا در دریافت تراکنش‌ها (کد ${res.status})`)}</td></tr>`;
        }
        return;
      }

      const data = await res.json();
      // اگه به هر دلیلی خروجی سرور یک آرایه‌ی خام نبود (مثلاً بسته‌بندی شده در یک آبجکت)، بازم مقاوم عمل کن
      allTransactions = Array.isArray(data) ? data : (data.data || data.transactions || []);
      console.debug('تراکنش‌های دریافت‌شده از سرور:', allTransactions);
      applyFilters();
    } catch (err) {
      console.error('ارتباط با سرور برای دریافت تراکنش‌ها برقرار نشد:', err);
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="6" class="px-5 py-6 text-center text-red-color">ارتباط با سرور برقرار نشد (کنسول مرورگر را بررسی کنید)</td></tr>`;
      }
    }
  }

  function onReady() {
    setupSelectValueTracking();

    const form = document.getElementById('transactionForm');
    if (form) form.addEventListener('submit', handleFormSubmit);

    const confirmBtn = document.getElementById('confirmDeleteTransactionBtn');
    if (confirmBtn) confirmBtn.addEventListener('click', confirmDelete);

    const searchInput = document.getElementById('filterSearchInput');
    if (searchInput) searchInput.addEventListener('input', debounce(applyFilters, 250));

    document.querySelectorAll('#filterTypeSelect .option, #filterCategorySelect .option').forEach((opt) => {
      opt.addEventListener('click', applyFilters);
    });

    const dateInput = document.getElementById('filterDatePicker');
    if (dateInput) dateInput.addEventListener('change', applyFilters);

    loadTransactions();
  }

  // توابعی که از HTML (onclick های داخل سطرهای داینامیک و دکمه‌ی بازنشانی) صدا زده می‌شن
  window.openAddTransactionModal = openAddTransactionModal;
  window.resetFilter = resetFilter;
  window.TransactionsApp = {
    openView: openViewModal,
    openEdit: openEditModal,
    openDelete: openDeleteModal,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }
})();
