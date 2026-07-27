(function () {
  'use strict';

  const API_BASE = '/api';

  // لیست کامل چک‌های کاربر که از سرور خونده شده (فیلترها روی همین آرایه اعمال می‌شن)
  let allCheques = [];

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

  function formatCount(n) {
    return `${toPersianDigits(n || 0)} عدد`;
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
    return type === 'received' ? 'دریافتی' : 'پرداختی';
  }

  function typeBadgeClasses(type) {
    return type === 'received' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700';
  }

  function statusLabel(status) {
    if (status === 'cashed') return 'وصول شده';
    if (status === 'bounced') return 'برگشت خورده';
    return 'در انتظار';
  }

  function statusBadgeClasses(status) {
    if (status === 'cashed') return 'bg-green-50 text-green-700';
    if (status === 'bounced') return 'bg-red-50 text-red-600';
    return 'bg-orange-50 text-orange-600';
  }

  // ===== ساخت یک سطر جدول برای یک چک (داینامیک) =====
  function renderRow(c) {
    return `
      <tr class="transition-all duration-150 hover:bg-gray-50" data-id="${c.id}">
        <td class="px-5 py-3.5 text-gray-800 whitespace-nowrap font-mono">${escapeHtml(toPersianDigits(c.number))}</td>
        <td class="px-5 py-3.5"><span class="${typeBadgeClasses(c.type)} px-2.5 py-1 rounded-full text-xs font-medium">${typeLabel(c.type)}</span></td>
        <td class="px-5 py-3.5 font-mono font-medium text-gray-800 whitespace-nowrap">${formatAmount(c.amount)} ریال</td>
        <td class="px-5 py-3.5 text-gray-700">${escapeHtml(c.counterparty || '-')}</td>
        <td class="px-5 py-3.5 text-gray-700 whitespace-nowrap">${escapeHtml(toPersianDigits(c.date))}</td>
        <td class="px-5 py-3.5 text-gray-700">${escapeHtml(c.bank || '-')}</td>
        <td class="px-5 py-3.5"><span class="${statusBadgeClasses(c.status)} px-2.5 py-1 rounded-full text-xs font-medium">${statusLabel(c.status)}</span></td>
        <td>
          <div class="flex justify-center gap-2.5">
            <button type="button" class="bg-main-color p-1 rounded-md" title="ویرایش" onclick="ChequesApp.openEdit(${c.id})">${PENCIL_ICON}</button>
            <button type="button" class="bg-main-color p-1 rounded-md" title="حذف" onclick="ChequesApp.deleteCheque(${c.id})">${TRASH_ICON}</button>
          </div>
        </td>
      </tr>`;
  }

  function renderTable(list) {
    const tbody = document.getElementById('chequesTableBody');
    if (!tbody) return;
    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="px-5 py-6 text-center text-gray-400">چکی برای نمایش وجود ندارد</td></tr>`;
      return;
    }
    tbody.innerHTML = list.map(renderRow).join('');
  }

  function renderSummary(summary) {
    document.getElementById('chequesTotalCount').textContent = formatCount(summary.total);
    document.getElementById('chequesCashedCount').textContent = formatCount(summary.cashed);
    document.getElementById('chequesBouncedCount').textContent = formatCount(summary.bounced);
    document.getElementById('chequesPendingCount').textContent = formatCount(summary.pending);
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
      valueEl.textContent = value;
      container.dataset.value = value;
    }
  }

  function resetCustomSelect(containerId) {
    setCustomSelectValue(containerId, '');
  }

  // هر بار که یک گزینه از سلکت‌باکس سفارشی کلیک می‌شه، مقدارش رو روی خودِ کانتینر ذخیره می‌کنیم
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
    const el = document.getElementById('chequeFormError');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  function hideFormError() {
    const el = document.getElementById('chequeFormError');
    if (el) el.classList.add('hidden');
  }

  function resetChequeForm() {
    const form = document.getElementById('chequeForm');
    if (form) form.reset();
    document.getElementById('chequeId').value = '';
    resetCustomSelect('modalTypeSelect');
    resetCustomSelect('modalStatusSelect');
    hideFormError();
  }

  function openAddModal() {
    resetChequeForm();
    document.getElementById('chequeModalTitle').textContent = 'ثبت چک جدید';
    document.getElementById('chequeSubmitBtn').textContent = 'ثبت';
    window.openModal('chequeModal');
  }

  // ===== پیدا کردن یک چک: اول از کش محلی، اگه نبود از سرور =====
  async function getChequeById(id) {
    const cached = allCheques.find((c) => c.id === id);
    if (cached) return cached;

    try {
      const res = await fetch(`${API_BASE}/cheques/${id}`, { headers: authHeaders() });
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.error('خطا در دریافت چک:', err);
      return null;
    }
  }

  async function openEditModal(id) {
    const cheque = await getChequeById(id);
    if (!cheque) {
      showToast('چک مورد نظر پیدا نشد', 'error');
      return;
    }

    resetChequeForm();
    document.getElementById('chequeId').value = cheque.id;
    document.getElementById('chequeModalTitle').textContent = 'ویرایش چک';
    document.getElementById('chequeSubmitBtn').textContent = 'ذخیره تغییرات';

    document.getElementById('chequeNumberInput').value = cheque.number || '';
    document.getElementById('chequeAmountInput').value = cheque.amount != null ? cheque.amount : '';
    document.getElementById('chequeCounterpartyInput').value = cheque.counterparty || '';
    document.getElementById('chequeBankInput').value = cheque.bank || '';

    const dateInput = document.getElementById('chequeDatePicker');
    if (dateInput) dateInput.value = cheque.date || '';

    setCustomSelectValue('modalTypeSelect', cheque.type || '');
    setCustomSelectValue('modalStatusSelect', cheque.status || '');

    const reminderInput = document.getElementById('chequeReminderInput');
    if (reminderInput) reminderInput.checked = !!cheque.reminder;

    window.openModal('chequeModal');
  }

  async function handleFormSubmit(e) {
    e.preventDefault();
    hideFormError();

    const number = (document.getElementById('chequeNumberInput').value || '').trim();
    const type = getCustomSelectValue('modalTypeSelect');
    const amountRaw = document.getElementById('chequeAmountInput').value;
    const counterparty = (document.getElementById('chequeCounterpartyInput').value || '').trim();
    const bank = (document.getElementById('chequeBankInput').value || '').trim();
    const date = (document.getElementById('chequeDatePicker').value || '').trim();
    const status = getCustomSelectValue('modalStatusSelect') || 'pending';
    const reminder = !!document.getElementById('chequeReminderInput').checked;

    if (!number) {
      showFormError('لطفاً شماره چک را وارد کنید');
      return;
    }
    if (!type) {
      showFormError('لطفاً نوع چک (دریافتی/پرداختی) را انتخاب کنید');
      return;
    }
    if (amountRaw === '' || Number(amountRaw) <= 0 || Number.isNaN(Number(amountRaw))) {
      showFormError('لطفاً مبلغ معتبری وارد کنید');
      return;
    }
    if (!date) {
      showFormError('لطفاً تاریخ چک را وارد کنید');
      return;
    }

    const payload = {
      number,
      type,
      amount: Number(amountRaw),
      counterparty: counterparty || undefined,
      bank: bank || undefined,
      date,
      status,
      reminder,
    };

    const id = document.getElementById('chequeId').value;
    const btn = document.getElementById('chequeSubmitBtn');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'در حال ذخیره...';

    try {
      const url = id ? `${API_BASE}/cheques/${id}` : `${API_BASE}/cheques`;
      const method = id ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data.message || `خطا در ذخیره‌سازی چک (کد ${res.status})`;
        showFormError(msg);
        showToast(msg, 'error');
        console.error('Cheque save failed:', res.status, data);
        return;
      }

      window.closeModal();
      showToast(id ? 'چک با موفقیت ویرایش شد' : 'چک با موفقیت ثبت شد', 'success');
      applyOverview(data);
    } catch (err) {
      console.error('Cheque save network error:', err);
      showFormError('ارتباط با سرور برقرار نشد');
      showToast('ارتباط با سرور برقرار نشد', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }

  // ===== حذف چک =====
  async function deleteCheque(id) {
    if (!window.confirm('آیا از حذف این چک مطمئن هستید؟')) return;

    try {
      const res = await fetch(`${API_BASE}/cheques/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data.message || `خطا در حذف چک (کد ${res.status})`;
        showToast(msg, 'error');
        console.error('Cheque delete failed:', res.status, data);
        return;
      }

      showToast('چک با موفقیت حذف شد', 'success');
      applyOverview(data);
    } catch (err) {
      console.error('Cheque delete network error:', err);
      showToast('ارتباط با سرور برقرار نشد', 'error');
    }
  }

  // ===== فیلترها (روی داده‌ی از قبل خونده‌شده، سمت کلاینت اعمال می‌شن) =====
  function applyFilters() {
    const search = (document.getElementById('filterSearchInput')?.value || '').trim().toLowerCase();
    const type = getCustomSelectValue('filterTypeSelect');
    const status = getCustomSelectValue('filterStatusSelect');
    const date = (document.getElementById('filterDatePicker')?.value || '').trim();

    let list = allCheques;

    if (search) {
      list = list.filter((c) =>
        [c.number, c.counterparty, c.bank].some((v) => (v || '').toLowerCase().includes(search)),
      );
    }
    if (type) list = list.filter((c) => c.type === type);
    if (status) list = list.filter((c) => c.status === status);
    if (date) list = list.filter((c) => c.date === date);

    renderTable(list);
  }

  function resetFilter() {
    const searchInput = document.getElementById('filterSearchInput');
    if (searchInput) searchInput.value = '';
    resetCustomSelect('filterTypeSelect');
    resetCustomSelect('filterStatusSelect');
    const dateInput = document.getElementById('filterDatePicker');
    if (dateInput) dateInput.value = '';
    applyFilters();
  }

  // ===== اعمال نتیجه‌ی سرور (summary + cheques) روی صفحه =====
  function applyOverview(data) {
    const summary = data.summary || { total: 0, cashed: 0, bounced: 0, pending: 0 };
    allCheques = Array.isArray(data.cheques) ? data.cheques : [];
    renderSummary(summary);
    applyFilters();
  }

  // ===== بارگذاری چک‌ها از سرور =====
  async function loadCheques() {
    const tbody = document.getElementById('chequesTableBody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="8" class="px-5 py-6 text-center text-gray-400">در حال بارگذاری چک‌ها...</td></tr>`;
    }

    const token = localStorage.getItem('access_token');
    if (!token) {
      console.warn('توکن ورود پیدا نشد؛ کاربر لاگین نیست.');
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="8" class="px-5 py-6 text-center text-red-color">برای مشاهده‌ی چک‌ها باید وارد حساب کاربری شوید</td></tr>`;
      }
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/cheques`, { headers: authHeaders() });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error('خطا در دریافت چک‌ها:', res.status, data);
        if (tbody) {
          tbody.innerHTML = `<tr><td colspan="8" class="px-5 py-6 text-center text-red-color">${escapeHtml(data.message || `خطا در دریافت چک‌ها (کد ${res.status})`)}</td></tr>`;
        }
        return;
      }

      const data = await res.json();
      applyOverview(data);
    } catch (err) {
      console.error('ارتباط با سرور برای دریافت چک‌ها برقرار نشد:', err);
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="8" class="px-5 py-6 text-center text-red-color">ارتباط با سرور برقرار نشد (کنسول مرورگر را بررسی کنید)</td></tr>`;
      }
    }
  }

  function onReady() {
    setupSelectValueTracking();

    const form = document.getElementById('chequeForm');
    if (form) form.addEventListener('submit', handleFormSubmit);

    const searchInput = document.getElementById('filterSearchInput');
    if (searchInput) searchInput.addEventListener('input', debounce(applyFilters, 250));

    document.querySelectorAll('#filterTypeSelect .option, #filterStatusSelect .option').forEach((opt) => {
      opt.addEventListener('click', applyFilters);
    });

    const dateInput = document.getElementById('filterDatePicker');
    if (dateInput) dateInput.addEventListener('change', applyFilters);

    loadCheques();
  }

  window.ChequesApp = {
    openAddModal,
    openEdit: openEditModal,
    deleteCheque,
    resetFilter,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }
})();
