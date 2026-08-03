(function () {
  'use strict';

  const API_BASE = '/api';

  // لیست کامل تراکنش‌های کاربر که از سرور خونده شده (فیلترها روی همین آرایه اعمال می‌شن)
  let allTransactions = [];

  // لیست حساب‌های فعال کاربر؛ برای پر کردن سلکت‌باکس «حساب» در فرم ثبت/ویرایش تراکنش
  let userAccounts = [];

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
    if (type === 'income') return 'درآمد';
    if (type === 'transfer') return 'انتقال';
    return 'هزینه';
  }

  function typeBadgeClasses(type) {
    if (type === 'income') return 'text-emerald-700 bg-emerald-50';
    if (type === 'transfer') return 'text-blue-700 bg-blue-50';
    return 'text-rose-600 bg-rose-50';
  }

  // ===== ساخت یک سطر جدول برای یک تراکنش (داینامیک) =====
  function renderRow(tx) {
    // const dateTime = tx.time ? `${tx.date} - ${tx.time}` : tx.date;
     const dateTime = tx.time 
    ? `${toPersianDigits(tx.date)} - ${toPersianDigits(tx.time)}` 
    : toPersianDigits(tx.date);
    return `
      <tr class="transition-all duration-150" data-id="${tx.id}">
        <td class="px-5 py-3.5 text-gray-800 whitespace-nowrap">${escapeHtml(dateTime)}</td>
        <td class="px-5 py-3.5 text-gray-700">
          <div class="font-medium text-gray-800">${escapeHtml(tx.title || tx.description || '-')}</div>
          ${tx.title && tx.description ? `<div class="text-xs text-gray-400 italic">${escapeHtml(tx.description)}</div>` : ''}
        </td>
        <td class="px-5 py-3.5"><span class="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full text-xs font-medium">${escapeHtml(tx.category || '-')}</span></td>
        <td class="px-5 py-3.5"><span class="${typeBadgeClasses(tx.type)} px-2.5 py-1 rounded-full text-xs font-medium">${typeLabel(tx.type)}</span></td>
        <td class="px-5 py-3.5 font-mono font-medium text-gray-800 whitespace-nowrap">${formatAmount(tx.amount)}</td>
        <td>
          <div class="flex justify-center gap-2.5">
            <button type="button" class="bg-main-color p-1 rounded-md" title="جزئیات" onclick="TransactionsApp.openView(${tx.id})">${EYE_ICON}</button>
            ${tx.type === 'transfer' ? '' : `<button type="button" class="bg-main-color p-1 rounded-md" title="ویرایش" onclick="TransactionsApp.openEdit(${tx.id})">${PENCIL_ICON}</button>`}
            <button type="button" class="bg-main-color p-1 rounded-md" title="${tx.type === 'transfer' ? 'حذف انتقال' : 'حذف'}" onclick="TransactionsApp.openDelete(${tx.id})">${TRASH_ICON}</button>
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

  // ===== واکنش فرم به انتخاب «نوع مالی» (واریز / برداشت / انتقال بین حساب‌ها) =====
  // ۱) گزینه‌های «نوع تراکنش» و «دسته» فقط گزینه‌های مرتبط با نوع انتخاب‌شده رو نشون می‌دن
  //    (مثلاً وقتی «واریز» انتخاب شده، «خرید فروشگاه» که مخصوص هزینه‌هاست نشون داده نمی‌شه)
  // ۲) برای «انتقال بین حساب‌ها» اصلاً نوع تراکنش/دسته/حساب تکی معنی نداره؛ به‌جاش
  //    دو فیلد «از حساب» و «به حساب» نشون داده می‌شه (چون این حرکت نه درآمده نه هزینه)
  const TITLE_PLACEHOLDERS = {
    income: 'عنوان (مثلاً حقوق تیر)',
    expense: 'عنوان (مثلاً بنزین ماشین)',
    transfer: 'عنوان انتقال (مثلاً شارژ کیف پول)',
    '': 'عنوان (مثلاً بنزین ماشین)',
  };

  function applyFinancialTypeUI(finType) {
    const subtypeWrapper = document.getElementById('modalSubtypeWrapper');
    const categoryWrapper = document.getElementById('modalCategoryWrapper');
    const accountWrapper = document.getElementById('modalAccountWrapper');
    const transferFromWrapper = document.getElementById('modalTransferFromWrapper');
    const transferToWrapper = document.getElementById('modalTransferToWrapper');
    const currentSubtype = getCustomSelectValue('modalSubtypeSelect');
    const currentCategory = getCustomSelectValue('modalCategorySelect');
    const isTransfer = finType === 'transfer';

    // فیلتر گزینه‌های «نوع تراکنش» بر اساس واریز/برداشت بودن
    const subtypeContainer = document.getElementById('modalSubtypeSelect');
    if (subtypeContainer) {
      let selectedStillVisible = !currentSubtype;
      subtypeContainer.querySelectorAll('.option').forEach((opt) => {
        const optFinType = opt.dataset.fintype;
        const visible = !optFinType || !finType || optFinType === finType;
        opt.classList.toggle('fintype-hidden', !visible);
        if (visible && currentSubtype && opt.textContent.trim() === currentSubtype) {
          selectedStillVisible = true;
        }
      });
      if (!selectedStillVisible) resetCustomSelect('modalSubtypeSelect');
    }

    // فیلتر گزینه‌های «دسته» بر اساس واریز/برداشت بودن (برای انتقال کلاً مخفی می‌شه)
    const categoryContainer = document.getElementById('modalCategorySelect');
    if (categoryContainer) {
      let selectedStillVisible = !currentCategory;
      categoryContainer.querySelectorAll('.option').forEach((opt) => {
        const optFinType = opt.dataset.fintype;
        const visible = !optFinType || !finType || optFinType === finType;
        opt.classList.toggle('fintype-hidden', !visible);
        if (visible && currentCategory && opt.textContent.trim() === currentCategory) {
          selectedStillVisible = true;
        }
      });
      if (!selectedStillVisible) resetCustomSelect('modalCategorySelect');
    }

    if (subtypeWrapper) subtypeWrapper.classList.toggle('hidden', isTransfer);
    if (categoryWrapper) categoryWrapper.classList.toggle('hidden', isTransfer);
    if (accountWrapper) accountWrapper.classList.toggle('hidden', isTransfer);
    if (transferFromWrapper) transferFromWrapper.classList.toggle('hidden', !isTransfer);
    if (transferToWrapper) transferToWrapper.classList.toggle('hidden', !isTransfer);

    if (isTransfer) {
      refreshTransferAccountSelects();
    }

    const titleInput = document.getElementById('modalTitleInput');
    if (titleInput) {
      titleInput.placeholder = TITLE_PLACEHOLDERS[finType] || TITLE_PLACEHOLDERS[''];
    }
  }

  // پر کردن سلکت‌باکس‌های «از حساب»/«به حساب» با حساب‌های فعال کاربر (برای حالت انتقال)
  function populateTransferAccountSelects() {
    const active = userAccounts.filter((a) => !a.isArchived);
    const optionsHtml = active
      .map((a) => `<option value="${a.id}">${escapeHtml(a.name)}</option>`)
      .join('');
    const fromSelect = document.getElementById('modalTransferFromAccount');
    const toSelect = document.getElementById('modalTransferToAccount');
    if (fromSelect) {
      const prev = fromSelect.value;
      fromSelect.innerHTML = optionsHtml;
      if (prev) fromSelect.value = prev;
    }
    if (toSelect) {
      const prev = toSelect.value;
      toSelect.innerHTML = optionsHtml;
      if (prev) toSelect.value = prev;
      else if (active.length > 1 && !prev) toSelect.value = String(active[1].id);
    }
  }

  // اگه حساب‌ها هنوز لود نشده باشن (مثلاً چون کاربر سریع «انتقال» رو زده و
  // fetch مربوط به لود اولیه‌ی حساب‌ها هنوز تموم نشده)، اول حساب‌ها رو می‌گیریم
  // و بعد سلکت‌های «از حساب»/«به حساب» رو پر می‌کنیم؛ این‌طوری هیچ‌وقت این دوتا
  // خالی نمی‌مونن و انتقال بی‌دلیل رد نمی‌شه
  async function refreshTransferAccountSelects() {
    if (!userAccounts.length) {
      await loadUserAccounts();
    }
    populateTransferAccountSelects();
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

    // انتخاب نوع مالی (واریز/برداشت) روی گزینه‌های «نوع تراکنش» و فیلد «دسته» اثر می‌ذاره
    document.querySelectorAll('#modalFinancialTypeSelect .option').forEach((opt) => {
      opt.addEventListener('click', () => applyFinancialTypeUI(opt.dataset.value));
    });

    setupSmartCategorize();
  }

  // ===== دسته‌بندی خودکار با هوش مصنوعی: با تایپ عنوان تراکنش، دسته‌ی مناسب پیشنهاد می‌شه =====
  function setupSmartCategorize() {
    const titleInput = document.getElementById('modalTitleInput');
    if (!titleInput) return;

    const suggestCategory = debounce(async () => {
      const title = titleInput.value.trim();
      const finType = getCustomSelectValue('modalFinancialTypeSelect');
      const alreadyChosen = getCustomSelectValue('modalCategorySelect');

      if (title.length < 2 || finType === 'transfer' || alreadyChosen) return;

      try {
        const res = await fetch(`${API_BASE}/ai/categorize`, {
          method: 'POST',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ title, type: finType === 'income' ? 'income' : 'expense' }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.category && !getCustomSelectValue('modalCategorySelect')) {
          setCustomSelectValue('modalCategorySelect', data.category);
        }
      } catch (err) {
        // شکست خاموش: پیشنهاد خودکار دسته صرفاً یک کمک است، نیازی به نمایش خطا به کاربر نیست
      }
    }, 600);

    titleInput.addEventListener('input', suggestCategory);
  }

  // ===== بارگذاری حساب‌های کاربر و پر کردن سلکت‌باکس «حساب» در فرم تراکنش =====
  async function loadUserAccounts() {
    const select = document.getElementById('modalAccountInput');
    if (!select) return;

    try {
      const res = await fetch(`${API_BASE}/accounts`, { headers: authHeaders() });
      if (!res.ok) throw new Error('خطا در دریافت حساب‌ها');
      userAccounts = await res.json();

      const previousValue = select.value;
      select.innerHTML = '<option value="">بدون حساب</option>' +
        userAccounts.map((a) => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('');
      if (previousValue) select.value = previousValue;
    } catch (err) {
      console.error('خطا در دریافت حساب‌ها برای فرم تراکنش:', err);
    }
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
    applyFinancialTypeUI('');
    const accountSelect = document.getElementById('modalAccountInput');
    if (accountSelect) accountSelect.value = '';
    const titleInput = document.getElementById('modalTitleInput');
    if (titleInput) titleInput.value = '';
    hideFormError();
  }

  function openAddTransactionModal() {
    resetTransactionForm();
    document.getElementById('transactionModalTitle').textContent = 'ثبت تراکنش جدید';
    document.getElementById('transactionSubmitBtn').textContent = 'ثبت';
    // ثبت جدید یعنی می‌تونه واریز/برداشت/انتقال باشه؛ پس گزینه‌ی انتقال فعاله
    const transferOption = document.getElementById('modalTransferOption');
    if (transferOption) transferOption.classList.remove('hidden');
    loadUserAccounts();
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

    // یک تراکنش ثبت‌شده نمی‌تونه به انتقال بین حساب‌ها تبدیل بشه (این دو تا جدول جدا هستن)
    const transferOption = document.getElementById('modalTransferOption');
    if (transferOption) transferOption.classList.add('hidden');

    const dateInput = document.getElementById('modalDatePicker');
    const timeInput = document.getElementById('modalTimePicker');
    if (dateInput) dateInput.value = tx.date || '';
    if (timeInput) timeInput.value = tx.time || '';

    const titleInput = document.getElementById('modalTitleInput');
    if (titleInput) titleInput.value = tx.title || '';

    setCustomSelectValue('modalSubtypeSelect', tx.subtype || '');
    setCustomSelectValue('modalFinancialTypeSelect', tx.type || '');
    setCustomSelectValue('modalCategorySelect', tx.category || '');
    applyFinancialTypeUI(tx.type || '');

    document.getElementById('modalAmountInput').value = tx.amount != null ? tx.amount : '';
    document.getElementById('modalDescriptionInput').value = tx.description || '';

    await loadUserAccounts();
    const accountSelect = document.getElementById('modalAccountInput');
    if (accountSelect) accountSelect.value = tx.accountId != null ? String(tx.accountId) : '';

    window.openModal('addTransactionModal');
  }

  async function handleFormSubmit(e) {
    e.preventDefault();
    hideFormError();

    const type = getCustomSelectValue('modalFinancialTypeSelect');

    if (!type) {
      showFormError('لطفاً نوع مالی (واریز/برداشت/انتقال) را انتخاب کنید');
      return;
    }

    if (type === 'transfer') {
      await submitTransferFromModal();
      return;
    }

    const date = (document.getElementById('modalDatePicker').value || '').trim();
    const time = (document.getElementById('modalTimePicker').value || '').trim();
    const title = (document.getElementById('modalTitleInput').value || '').trim();
    const subtype = getCustomSelectValue('modalSubtypeSelect');
    const category = getCustomSelectValue('modalCategorySelect');
    const amountRaw = document.getElementById('modalAmountInput').value;
    const accountIdRaw = document.getElementById('modalAccountInput').value;
    const description = (document.getElementById('modalDescriptionInput').value || '').trim();

    if (!date) {
      showFormError('لطفاً تاریخ تراکنش را وارد کنید');
      return;
    }
    if (amountRaw === '' || Number(amountRaw) <= 0 || Number.isNaN(Number(amountRaw))) {
      showFormError('لطفاً مبلغ معتبری وارد کنید');
      return;
    }

    const payload = {
      date,
      time: time || undefined,
      title: title || undefined,
      type,
      subtype: subtype || null,
      category: category || null,
      accountId: accountIdRaw ? Number(accountIdRaw) : null,
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

  // ===== ثبت انتقال بین حساب‌ها از همین مودال (وقتی نوع مالی «انتقال» انتخاب بشه) =====
  async function submitTransferFromModal() {
    const date = (document.getElementById('modalDatePicker').value || '').trim();
    const title = (document.getElementById('modalTitleInput').value || '').trim();
    const amountRaw = document.getElementById('modalAmountInput').value;
    const description = (document.getElementById('modalDescriptionInput').value || '').trim();
    const fromAccountId = document.getElementById('modalTransferFromAccount').value;
    const toAccountId = document.getElementById('modalTransferToAccount').value;

    if (!date) {
      showFormError('لطفاً تاریخ انتقال را وارد کنید');
      return;
    }
    if (!fromAccountId || !toAccountId) {
      showFormError('لطفاً حساب مبدأ و مقصد را انتخاب کنید');
      return;
    }
    if (fromAccountId === toAccountId) {
      showFormError('حساب مبدأ و مقصد نمی‌توانند یکسان باشند');
      return;
    }
    if (amountRaw === '' || Number(amountRaw) <= 0 || Number.isNaN(Number(amountRaw))) {
      showFormError('لطفاً مبلغ معتبری وارد کنید');
      return;
    }

    const btn = document.getElementById('transactionSubmitBtn');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'در حال ذخیره...';

    try {
      const res = await fetch(`${API_BASE}/transfers`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          title: title || undefined,
          fromAccountId: Number(fromAccountId),
          toAccountId: Number(toAccountId),
          amount: Number(amountRaw),
          date,
          description: description || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data.message || `خطا در ثبت انتقال (کد ${res.status})`;
        showFormError(msg);
        showToast(msg, 'error');
        console.error('Transfer save failed:', res.status, data);
        return;
      }

      window.closeModal();
      showToast('انتقال با موفقیت ثبت شد', 'success');
      await loadTransactions();
    } catch (err) {
      console.error('Transfer save network error:', err);
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
    const typeText = tx.type === 'income' ? 'واریز' : tx.type === 'transfer' ? 'انتقال' : 'برداشت';
    const typeBadgeClass = tx.type === 'income'
      ? 'bg-emerald-100 text-emerald-600'
      : tx.type === 'transfer'
        ? 'bg-blue-100 text-blue-600'
        : 'bg-rose-100 text-rose-600';
    badge.textContent = typeText;
    badge.className = 'transaction-type-badge inline-block font-bold px-6 py-2 rounded-full text-sm ' + typeBadgeClass;

    // document.getElementById('viewDate').textContent = tx.time ? `${tx.date} - ${tx.time}` : tx.date;
     document.getElementById('viewDate').textContent = tx.time 
    ? `${toPersianDigits(tx.date)} - ${toPersianDigits(tx.time)}` 
    : toPersianDigits(tx.date);

    const amountEl = document.getElementById('viewAmount');
    const amountSign = tx.type === 'income' ? '+' : tx.type === 'transfer' ? '' : '-';
    const amountColorClass = tx.type === 'income'
      ? 'text-emerald-600'
      : tx.type === 'transfer'
        ? 'text-blue-600'
        : 'text-rose-600';
    amountEl.textContent = amountSign + formatAmount(tx.amount);
    amountEl.className = 'transaction-amount-value font-extrabold text-3xl mb-3 ' + amountColorClass;

    document.getElementById('viewTitle').textContent = tx.title || '-';
    document.getElementById('viewCategory').textContent = tx.category || '-';
    document.getElementById('viewSubtype').textContent = tx.subtype || '-';
    document.getElementById('viewDescription').textContent = tx.description || '-';
    document.getElementById('viewAccount').textContent = tx.accountName || '-';

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
        [t.title, t.description, t.category, t.subtype, t.accountName].some((v) => (v || '').toLowerCase().includes(search)),
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
