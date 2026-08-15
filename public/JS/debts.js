(function () {
  'use strict';

  const API_BASE = '/api';

  // همه‌ی رکوردهای کاربر (بدهی + طلب) که از سرور خونده شده
  let allItems = [];
  // لیست وام/اقساط که از همون API داشبورد (/api/installments) خونده می‌شه
  let allLoans = [];

  // خلاصه‌ی رکوردهای معمولِ بدهی/طلب + خلاصه‌ی حساب‌کتاب اشخاص (تب جدا)؛ کارت‌های
  // بالای صفحه مجموعِ این دوتاست چون شخص هم می‌تونه توی «بدهی من»/«طلب از دیگران» سهم داشته باشه.
  let lastDebtsSummary = { myDebt: 0, receivable: 0, net: 0 };
  let lastPersonsSummary = { debt: 0, receivable: 0, net: 0 };
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

  // وضعیت همیشه فقط «پرداخت شده» یا «پرداخت نشده/وصول نشده»ست؛ سررسید گذشته یک
  // برچسب جداست (isOverdue) که فقط رنگ بج رو قرمز می‌کنه، نه متنش رو.
  function statusLabel(status, type) {
    if (status === 'paid') return 'پرداخت شده';
    return type === 'receivable' ? 'وصول نشده' : 'پرداخت نشده';
  }

  function statusBadgeClasses(status, isOverdue) {
    if (status === 'paid') return 'bg-green-50 text-green-700';
    if (isOverdue) return 'bg-red-50 text-red-700';
    return 'bg-orange-50 text-orange-600';
  }

  // برای رکوردهای سررسید گذشته، به‌جای عدد منفیِ گیج‌کننده («-۵ روز»)، واضح می‌گیم
  // «۵ روز گذشته» (رسم رایج فارسی، مثل formatSignedToman که همین‌جوری کار می‌کنه)
  function remainingDaysLabel(remainingDays) {
    if (remainingDays === null || remainingDays === undefined) return '-';
    if (remainingDays < 0) return `${toPersianDigits(Math.abs(remainingDays))} روز گذشته`;
    if (remainingDays === 0) return 'امروز';
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
          <span class="${statusBadgeClasses(item.status, item.isOverdue)} px-2.5 py-1 rounded-full text-xs font-medium">${statusLabel(item.status, item.type)}</span>
        </td>
        <td class="px-5 py-3.5">
          <div class="flex justify-center items-center gap-2.5">
            <input
              type="checkbox"
              class="w-4 h-4 accent-green-600 cursor-pointer"
              title="پرداخت شده"
              ${item.status === 'paid' ? 'checked' : ''}
              onchange="DebtsApp.togglePaid(${item.id}, this.checked)"
            />
            <button type="button" class="bg-main-color p-1 rounded-md" title="ویرایش" onclick="DebtsApp.openEdit('${item.type}', ${item.id})">${PENCIL_ICON}</button>
            <button type="button" class="bg-main-color p-1 rounded-md" title="حذف" onclick="DebtsApp.deleteItem(${item.id})">${TRASH_ICON}</button>
          </div>
        </td>
      </tr>`;
  }

  // ===== تیک زدن/برداشتن تیک «پرداخت شده» مستقیم از جدول =====
  async function togglePaid(id, isPaid) {
    try {
      const res = await fetch(`${API_BASE}/debts/${id}`, {
        method: 'PATCH',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ isPaid }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data.message || 'خطا در به‌روزرسانی وضعیت';
        showToast(Array.isArray(msg) ? msg[0] : msg, 'error');
        loadDebts();
        return;
      }

      applyOverview(data);
      showToast(isPaid ? 'وضعیت به «پرداخت شده» تغییر کرد' : 'وضعیت به «پرداخت نشده» تغییر کرد', 'success');
    } catch (err) {
      console.error('Toggle paid network error:', err);
      showToast('ارتباط با سرور برقرار نشد', 'error');
      loadDebts();
    }
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

  // ===== ترکیب خلاصه‌ی رکوردهای بدهی/طلب معمولی با خلاصه‌ی حساب‌کتاب اشخاص =====
  function renderCombinedSummary() {
    renderSummary({
      myDebt: lastDebtsSummary.myDebt + lastPersonsSummary.debt,
      receivable: lastDebtsSummary.receivable + lastPersonsSummary.receivable,
      net: lastDebtsSummary.net + lastPersonsSummary.net,
    });
  }

  // صدا زده می‌شه از persons.js، هر بار خلاصه‌ی حساب‌کتاب اشخاص تغییر کنه
  function setPersonsSummary(summary) {
    lastPersonsSummary = summary || { debt: 0, receivable: 0, net: 0 };
    renderCombinedSummary();
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
      const optValue = 'value' in opt.dataset ? opt.dataset.value : opt.textContent.trim();
      if (optValue === value) matched = opt;
    });

    if (matched) {
      valueEl.textContent = matched.textContent.trim();
      container.dataset.value = 'value' in matched.dataset ? matched.dataset.value : matched.textContent.trim();
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
          // نکته‌ی مهم: نباید از || استفاده کرد، چون گزینه‌ی «همه» عمداً data-value=""
          // داره؛ رشته‌ی خالی falsy هست و || اونو با متن نمایشی («همه») جایگزین می‌کرد
          // و در نتیجه فیلتر «همه» هیچ‌وقت با هیچ رکوردی مچ نمی‌شد.
          select.dataset.value = 'value' in opt.dataset ? opt.dataset.value : opt.textContent.trim();
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

  // ===== نگاشتِ نوع رکورد (debt/receivable) به پیشوند شناسه‌های فرم =====
  // فرم بدهی همیشه با «debt» و فرم طلب همیشه با «demand» شروع می‌شه؛ با این helper
  // به‌جای تکرار «isDebt ? 'debtX' : 'demandX'» در هر خط، فقط اسم فیلد رو می‌دیم.
  const FORM_PREFIX = { debt: 'debt', receivable: 'demand' };
  function fid(kind, suffix) {
    return `${FORM_PREFIX[kind]}${suffix}`;
  }

  function resetForm(kind) {
    document.getElementById(fid(kind, 'Form'))?.reset();
    document.getElementById(fid(kind, 'Id')).value = '';
    resetCustomSelect(fid(kind, 'StatusSelect'));
    hideFormError(fid(kind, 'ModalFormError'));
    window.AmountInput.refreshForm(document.getElementById(fid(kind, 'Modal')));
  }

  function openAddModal(kind) {
    resetForm(kind);
    document.getElementById(fid(kind, 'ModalTitle')).textContent = kind === 'debt' ? 'ثبت بدهی جدید' : 'ثبت طلب جدید';
    document.getElementById(fid(kind, 'SubmitBtn')).textContent = 'ثبت';
    window.openModal(fid(kind, 'Modal'));
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

    document.getElementById(fid(kind, 'Id')).value = item.id;
    document.getElementById(fid(kind, 'ModalTitle')).textContent = isDebt ? 'ویرایش بدهی' : 'ویرایش طلب';
    document.getElementById(fid(kind, 'SubmitBtn')).textContent = 'ذخیره تغییرات';

    document.getElementById(fid(kind, 'CounterpartyInput')).value = item.counterparty || '';
    document.getElementById(fid(kind, 'AmountInput')).value = item.amount != null ? item.amount : '';
    window.AmountInput.refresh(document.getElementById(fid(kind, 'AmountInput')));
    document.getElementById(fid(kind, 'DueDatePicker')).value = item.dueDate || '';
    document.getElementById(fid(kind, 'ReminderInput')).checked = !!item.reminder;

    setCustomSelectValue(fid(kind, 'StatusSelect'), item.isPaid ? 'paid' : 'unpaid');

    window.openModal(fid(kind, 'Modal'));
  }

  async function handleFormSubmit(kind, e) {
    e.preventDefault();
    const errorId = fid(kind, 'ModalFormError');
    hideFormError(errorId);

    const counterparty = (document.getElementById(fid(kind, 'CounterpartyInput')).value || '').trim();
    const amountRaw = window.AmountInput.parse(document.getElementById(fid(kind, 'AmountInput')).value);
    const dueDate = (document.getElementById(fid(kind, 'DueDatePicker')).value || '').trim();
    const statusValue = getCustomSelectValue(fid(kind, 'StatusSelect'));
    const reminder = !!document.getElementById(fid(kind, 'ReminderInput')).checked;

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

    const id = document.getElementById(fid(kind, 'Id')).value;
    const btn = document.getElementById(fid(kind, 'SubmitBtn'));
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
    if (!(await window.HesabinoUI.confirmDialog('آیا از حذف این رکورد مطمئن هستید؟'))) return;

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
      // «سررسید گذشته» دیگه یک status نیست (status فقط paid/unpaid هست)؛
      // پس این گزینه رو از روی فیلد isOverdue فیلتر می‌کنیم.
      if (opts.status === 'overdue') {
        filtered = filtered.filter((it) => it.isOverdue);
      } else {
        filtered = filtered.filter((it) => it.status === opts.status);
      }
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
    const filterPrefix = kind === 'debt' ? 'debt' : 'demand';
    const searchInput = document.getElementById(`${filterPrefix}SearchInput`);
    if (searchInput) searchInput.value = '';
    resetCustomSelect(`${filterPrefix}StatusFilter`);
    document.getElementById(`${filterPrefix}DateFromPicker`).value = '';
    document.getElementById(`${filterPrefix}DateToPicker`).value = '';
    kind === 'debt' ? applyDebtFilter() : applyDemandFilter();
  }

  // ===== اعمال نتیجه‌ی سرور روی صفحه =====
  function applyOverview(data) {
    lastDebtsSummary = data.summary || { myDebt: 0, receivable: 0, net: 0 };
    allItems = Array.isArray(data.items) ? data.items : [];
    renderCombinedSummary();
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

  // ===== اقساط و وام‌ها (همون API که ویجت داشبورد ازش استفاده می‌کنه) =====
  function loanStatusBarClass(l) {
    if (l.isCompleted) return 'bg-green-color';
    if (l.isOverdue) return 'bg-red-color';
    return 'bg-orange-color';
  }

  function renderLoanCard(l) {
    return `
        <div class="bg-white mb-0 rounded-2xl shadow-sm border border-gray-200/80 p-4 transition-all hover:shadow-md" data-loan-id="${l.id}">
          <div class="cursor-pointer" onclick="DebtsApp.openLoanEditModal(${l.id})" title="ویرایش">
            <!-- Title & Date -->
            <div class="flex justify-between items-center mb-2">
              <span class="font-bold text-zinc-800 text-base">${escapeHtml(l.title)}</span>
              <span class="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-md">${l.isCompleted ? 'تکمیل شده' : `${toPersianDigits(l.paidCount)} از ${toPersianDigits(l.installmentsCount)} قسط`}</span>
            </div>

            <div class="mt-3">
              <div class="flex justify-between text-sm mb-1">
                <span>${toPersianDigits(l.progressPercent)}٪</span>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-2.5">
                <div class="${loanStatusBarClass(l)} h-2.5 rounded-full progress-bar" style="width: ${l.progressPercent}%"></div>
              </div>
              <div class="flex justify-between text-sm mt-1">
                <span class="text-gray-500">باقی‌مانده: ${formatAmount(l.remainingAmount)} تومان</span>
                <span class="text-gray-500">کل: ${formatAmount(l.totalAmount)} تومان</span>
              </div>
            </div>

            <!-- قسط بعدی -->
            ${l.isCompleted ? '' : `
            <div class="flex items-center justify-between gap-1 text-sm bg-zinc-100 rounded-xl m-3 p-2 border border-zinc-300">
              <div>
                <div>قسط بعدی</div>
                <div class="text-xs text-gray-500">${l.nextDueDate ? escapeHtml(toPersianDigits(l.nextDueDate)) : '—'}</div>
              </div>
              <div class="font-bold text-main-color">${formatAmount(l.installmentAmount)} تومان</div>
            </div>`}
          </div>

          <!-- Actions -->
          <div class="flex justify-end items-center pt-2 border-t border-gray-200 gap-3">
            ${l.isCompleted ? '' : `
            <button class="text-sm main-btn transition-colors font-medium flex items-center gap-1 bg-main-color/5 px-3 py-1 rounded-full" onclick="DebtsApp.payLoan(${l.id})">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="m5 13 4 4L19 7" />
              </svg>
              پرداخت قسط
            </button>`}
            <button class="bg-red-400 p-1 rounded-md w-10 flex justify-center" onclick="DebtsApp.deleteLoan(${l.id})" title="حذف">
              <svg width="26" height="26" viewBox="0 0 26 26" fill="none" stroke="white" stroke-width="2">
                <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
              </svg>
            </button>
          </div>
        </div>`;
  }

  function renderLoansList(loans) {
    const container = document.getElementById('loansList');
    if (!container) return;
    if (!loans.length) {
      container.innerHTML = '<p class="text-center text-gray-400 mt-6 col-span-full">هنوز وام یا قسطی ثبت نشده است</p>';
      return;
    }
    // اقساط فعال قبل از اقساط تکمیل‌شده نمایش داده می‌شن
    const sorted = [...loans].sort((a, b) => Number(a.isCompleted) - Number(b.isCompleted));
    container.innerHTML = sorted.map(renderLoanCard).join('');
  }

  function applyLoansOverview(data) {
    allLoans = Array.isArray(data.loans) ? data.loans : [];
    renderLoansList(allLoans);
  }

  async function loadLoans() {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/installments`, { headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error('خطا در دریافت اقساط:', res.status, data);
        return;
      }
      applyLoansOverview(data);
    } catch (err) {
      console.error('ارتباط با سرور برای دریافت اقساط برقرار نشد:', err);
    }
  }

  // شناسه‌ی وامی که در حال ویرایشه؛ null یعنی مودال در حالت «ثبت وام جدید»ه.
  // بعد از ساخته‌شدنِ اقساط فقط عنوان قابل ویرایشه (مبلغ/تعداد/سررسید ثابت می‌مونن)
  let editingLoanId = null;

  function openLoanAddModal() {
    editingLoanId = null;
    const form = document.getElementById('loanForm');
    if (form) form.reset();
    document.getElementById('loanAlreadyPaidInput').value = '0';
    window.AmountInput.refreshForm(document.getElementById('loanModal'));
    document.getElementById('loanModalTitle').textContent = 'ثبت قسط/وام جدید';
    document.getElementById('loanSubmitBtn').textContent = 'ثبت';
    document.getElementById('loanExtraFieldsGrid').classList.remove('hidden');
    hideFormError('loanModalFormError');
    window.openModal('loanModal');
  }

  function openLoanEditModal(id) {
    const loan = allLoans.find((l) => l.id === id);
    if (!loan) return;

    editingLoanId = id;
    const form = document.getElementById('loanForm');
    if (form) form.reset();
    document.getElementById('loanTitleInput').value = loan.title || '';
    window.AmountInput.refreshForm(document.getElementById('loanModal'));
    document.getElementById('loanModalTitle').textContent = 'ویرایش عنوان وام';
    document.getElementById('loanSubmitBtn').textContent = 'ذخیره تغییرات';
    // مبلغ/تعداد اقساط/سررسید بعد از ساخته‌شدنِ اقساط قابل تغییر نیستن
    document.getElementById('loanExtraFieldsGrid').classList.add('hidden');
    hideFormError('loanModalFormError');
    window.openModal('loanModal');
  }

  async function submitLoan(e) {
    e.preventDefault();
    hideFormError('loanModalFormError');

    const title = (document.getElementById('loanTitleInput').value || '').trim();
    if (!title) return showFormError('loanModalFormError', 'لطفاً عنوان وام را وارد کنید');

    const btn = document.getElementById('loanSubmitBtn');
    const originalText = btn.textContent;
    btn.disabled = true;

    // ===== حالت ویرایش: فقط عنوان =====
    if (editingLoanId) {
      btn.textContent = 'در حال ذخیره...';
      try {
        const res = await fetch(`${API_BASE}/installments/${editingLoanId}`, {
          method: 'PATCH',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ title }),
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          const msg = data.message || `خطا در ویرایش وام (کد ${res.status})`;
          showFormError('loanModalFormError', Array.isArray(msg) ? msg[0] : msg);
          return;
        }

        applyLoansOverview(data);
        window.closeModal();
        showToast('عنوان وام ویرایش شد', 'success');
      } catch (err) {
        console.error('Loan edit network error:', err);
        showFormError('loanModalFormError', 'ارتباط با سرور برقرار نشد');
      } finally {
        btn.disabled = false;
        btn.textContent = originalText;
      }
      return;
    }

    // ===== حالت ثبت جدید =====
    const totalAmount = Number(window.AmountInput.parse(document.getElementById('loanTotalAmountInput').value));
    const installmentsCount = Number(window.AmountInput.parse(document.getElementById('loanInstallmentsCountInput').value));
    const alreadyPaidCount = Number(window.AmountInput.parse(document.getElementById('loanAlreadyPaidInput').value)) || 0;
    const firstDueDateRaw = (document.getElementById('loanFirstDueDatePicker').value || '').trim();

    if (!totalAmount || totalAmount <= 0) {
      btn.disabled = false;
      return showFormError('loanModalFormError', 'لطفاً مبلغ کل وام را به‌درستی وارد کنید');
    }
    if (!installmentsCount || installmentsCount <= 0) {
      btn.disabled = false;
      return showFormError('loanModalFormError', 'لطفاً تعداد کل اقساط را به‌درستی وارد کنید');
    }

    btn.textContent = 'در حال ثبت...';

    try {
      const res = await fetch(`${API_BASE}/installments`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          title,
          totalAmount,
          installmentsCount,
          alreadyPaidCount,
          firstDueDate: firstDueDateRaw || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data.message || `خطا در ثبت قسط (کد ${res.status})`;
        showFormError('loanModalFormError', Array.isArray(msg) ? msg[0] : msg);
        return;
      }

      applyLoansOverview(data);
      window.closeModal();
      showToast('وام/قسط با موفقیت ثبت شد', 'success');
    } catch (err) {
      console.error('Loan save network error:', err);
      showFormError('loanModalFormError', 'ارتباط با سرور برقرار نشد');
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }

  // جلوگیری از ارسال چندباره‌ی درخواست پرداخت قسط با کلیک‌های پشت‌سرهم روی دکمه
  // (باعث ۴۲۹/Too Many Requests و پرداخت تکراری می‌شد)
  const payingLoanIds = new Set();

  async function payLoan(id) {
    if (payingLoanIds.has(id)) return;
    payingLoanIds.add(id);
    try {
      const res = await fetch(`${API_BASE}/installments/${id}/pay`, { method: 'POST', headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data.message || (res.status === 429 ? 'درخواست‌های زیاد؛ چند لحظه صبر کن و دوباره امتحان کن' : 'خطا در ثبت پرداخت قسط');
        showToast(Array.isArray(msg) ? msg[0] : msg, 'error');
        return;
      }
      applyLoansOverview(data);
      showToast('قسط با موفقیت پرداخت شد', 'success');
    } catch (err) {
      console.error('Pay loan network error:', err);
      showToast('ارتباط با سرور برقرار نشد', 'error');
    } finally {
      payingLoanIds.delete(id);
    }
  }

  async function deleteLoan(id) {
    if (!(await window.HesabinoUI.confirmDialog('این وام/قسط حذف شود؟'))) return;
    try {
      const res = await fetch(`${API_BASE}/installments/${id}`, { method: 'DELETE', headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data.message || 'خطا در حذف وام/قسط';
        showToast(Array.isArray(msg) ? msg[0] : msg, 'error');
        return;
      }
      applyLoansOverview(data);
      showToast('وام/قسط حذف شد', 'success');
    } catch (err) {
      console.error('Delete loan network error:', err);
      showToast('ارتباط با سرور برقرار نشد', 'error');
    }
  }

  // ===== مودال یادآوری‌ها، هشدارها و تحلیل بدهی/طلب/اقساط =====
  const ALERT_STYLES = {
    danger: { bg: 'bg-red-color-25', border: 'border-red-color', text: 'text-red-color', icon: '⚠️' },
    warning: { bg: 'bg-orange-color-25', border: 'border-orange-color', text: 'text-orange-color', icon: '⚠️' },
    info: { bg: 'bg-main-color-25', border: 'border-main-color', text: 'text-main-color', icon: 'ℹ️' },
    success: { bg: 'bg-green-color-25', border: 'border-green-color', text: 'text-green-color', icon: '✅' },
  };

  const ALERT_MODAL_TITLES = {
    debt: 'یادآوری‌ها و تحلیل بدهی‌ها',
    receivable: 'یادآوری‌ها و تحلیل طلب‌ها',
    loan: 'یادآوری‌ها و تحلیل اقساط و وام‌ها',
  };

  // ===== متن‌های اختصاصیِ هشدار برای بدهی در برابر طلب (بقیه‌ی منطق مشترکه) =====
  const RECORD_ALERT_COPY = {
    debt: {
      empty: { title: 'هنوز بدهی‌ای ثبت نکردی', message: 'با دکمه‌ی «ثبت بدهی جدید» می‌تونی بدهی‌هات رو با سررسید ثبت کنی.' },
      overdueTitle: (cp) => `بدهی به «${cp}» سررسیدش گذشته`,
      overdueMessage: (amount, dueDate) => `مبلغ ${formatAmount(amount)} تومان، سررسید ${toPersianDigits(dueDate)}.`,
      soonTitle: (cp) => `بدهی به «${cp}» به‌زودی سررسید می‌شه`,
      soonMessage: (amount, dueDate) => `مبلغ ${formatAmount(amount)} تومان، سررسید ${toPersianDigits(dueDate)}.`,
      soonLevel: 'warning',
      totalTitle: 'مجموع بدهی پرداخت‌نشده',
      totalMessage: (total) => `در حال حاضر ${formatAmount(total)} تومان بدهی پرداخت‌نشده داری.`,
      okTitle: 'وضعیت بدهی‌هات مرتبه',
      okMessage: 'هیچ بدهی‌ای سررسید گذشته یا نزدیکی نداره.',
    },
    receivable: {
      empty: { title: 'هنوز طلبی ثبت نکردی', message: 'با دکمه‌ی «ثبت طلب جدید» می‌تونی طلب‌هات از دیگران رو با سررسید ثبت کنی.' },
      overdueTitle: (cp) => `طلب از «${cp}» سررسیدش گذشته`,
      overdueMessage: (amount) => `مبلغ ${formatAmount(amount)} تومان هنوز وصول نشده؛ بهتره پیگیری کنی.`,
      soonTitle: (cp) => `طلب از «${cp}» به‌زودی سررسید می‌شه`,
      soonMessage: (amount, dueDate) => `مبلغ ${formatAmount(amount)} تومان، سررسید ${toPersianDigits(dueDate)}.`,
      soonLevel: 'info',
      totalTitle: 'مجموع طلب وصول‌نشده',
      totalMessage: (total) => `در حال حاضر ${formatAmount(total)} تومان طلب وصول‌نشده داری.`,
      okTitle: 'وضعیت طلب‌هات مرتبه',
      okMessage: 'هیچ طلبی سررسید گذشته یا نزدیکی نداره.',
    },
  };

  // ===== ساخت لیست هشدار/تحلیل برای یک لیست بدهی یا طلب (kind: 'debt' | 'receivable') =====
  function buildRecordAlerts(items, kind) {
    const copy = RECORD_ALERT_COPY[kind];
    const alerts = [];

    if (!items.length) {
      alerts.push({ level: 'info', ...copy.empty });
      return alerts;
    }

    const overdue = items.filter((it) => it.isOverdue);
    const soon = items.filter((it) => it.status !== 'paid' && !it.isOverdue && it.remainingDays !== null && it.remainingDays <= 3);

    overdue.forEach((it) => {
      alerts.push({
        level: 'danger',
        title: copy.overdueTitle(it.counterparty),
        message: copy.overdueMessage(it.amount, it.dueDate),
      });
    });

    soon.forEach((it) => {
      alerts.push({
        level: copy.soonLevel,
        title: copy.soonTitle(it.counterparty),
        message: copy.soonMessage(it.amount, it.dueDate),
      });
    });

    const total = items.filter((it) => it.status !== 'paid').reduce((sum, it) => sum + Number(it.amount || 0), 0);
    if (total > 0) {
      alerts.push({ level: 'info', title: copy.totalTitle, message: copy.totalMessage(total) });
    }

    if (!overdue.length && !soon.length) {
      alerts.push({ level: 'success', title: copy.okTitle, message: copy.okMessage });
    }

    return alerts;
  }

  function buildLoanAlerts(loans) {
    const alerts = [];
    if (!loans.length) {
      alerts.push({
        level: 'info',
        title: 'هنوز وام یا قسطی ثبت نکردی',
        message: 'با دکمه‌ی «ثبت قسط جدید» می‌تونی وام‌ها و اقساطت رو ثبت کنی.',
      });
      return alerts;
    }

    const active = loans.filter((l) => !l.isCompleted);
    const overdue = active.filter((l) => l.isOverdue);
    const soon = active.filter((l) => !l.isOverdue && l.daysUntilNext !== null && l.daysUntilNext <= 3);
    const completed = loans.filter((l) => l.isCompleted);

    overdue.forEach((l) => {
      alerts.push({
        level: 'danger',
        title: `قسط «${l.title}» سررسیدش گذشته`,
        message: `مبلغ هر قسط ${formatAmount(l.installmentAmount)} تومان، سررسید ${l.nextDueDate ? toPersianDigits(l.nextDueDate) : '—'}.`,
      });
    });

    soon.forEach((l) => {
      alerts.push({
        level: 'warning',
        title: `قسط «${l.title}» به‌زودی سررسید می‌شه`,
        message: `مبلغ ${formatAmount(l.installmentAmount)} تومان، سررسید ${l.nextDueDate ? toPersianDigits(l.nextDueDate) : '—'}.`,
      });
    });

    const totalRemaining = active.reduce((sum, l) => sum + Number(l.remainingAmount || 0), 0);
    if (totalRemaining > 0) {
      alerts.push({
        level: 'info',
        title: 'مجموع باقی‌مانده‌ی اقساط فعال',
        message: `${formatAmount(totalRemaining)} تومان از وام‌های فعالت باقی مونده.`,
      });
    }

    if (completed.length) {
      alerts.push({
        level: 'success',
        title: `${toPersianDigits(completed.length)} وام تسویه شده`,
        message: 'این وام‌ها به‌طور کامل پرداخت شدن.',
      });
    }

    if (!overdue.length && !soon.length && active.length) {
      alerts.push({
        level: 'success',
        title: 'وضعیت اقساطت مرتبه',
        message: 'هیچ قسطی سررسید گذشته یا نزدیکی نداره.',
      });
    }

    return alerts;
  }

  function renderAlertsList(scope) {
    const container = document.getElementById('debtsAlertsList');
    if (!container) return;

    let alerts;
    if (scope === 'debt' || scope === 'receivable') {
      alerts = buildRecordAlerts(allItems.filter((it) => it.type === scope), scope);
    } else {
      alerts = buildLoanAlerts(allLoans);
    }

    container.innerHTML = alerts.map((a) => {
      const style = ALERT_STYLES[a.level] || ALERT_STYLES.info;
      return `
        <div class="flex items-start gap-3 ${style.bg} border ${style.border} rounded-lg px-4 py-3 mb-3">
          <span class="text-lg leading-none mt-0.5">${style.icon}</span>
          <div class="flex-1">
            <div class="font-bold text-sm ${style.text}">${escapeHtml(a.title)}</div>
            <div class="text-xs text-zinc-600 mt-1">${escapeHtml(a.message)}</div>
          </div>
        </div>`;
    }).join('');
  }

  function openAlertsModal(scope) {
    const titleEl = document.getElementById('debtsAlertsModalTitle');
    if (titleEl) titleEl.textContent = ALERT_MODAL_TITLES[scope] || 'یادآوری‌ها و تحلیل';
    renderAlertsList(scope);
    window.openModal('debtsAlertsModal');
  }

  function onReady() {
    setupSelectValueTracking();

    document.getElementById('debtForm')?.addEventListener('submit', (e) => handleFormSubmit('debt', e));
    document.getElementById('demandForm')?.addEventListener('submit', (e) => handleFormSubmit('receivable', e));
    document.getElementById('loanForm')?.addEventListener('submit', submitLoan);

    document.getElementById('debtSearchInput')?.addEventListener('input', debounce(applyDebtFilter, 250));
    document.getElementById('demandSearchInput')?.addEventListener('input', debounce(applyDemandFilter, 250));

    document.querySelectorAll('#debtStatusFilter .option').forEach((opt) => opt.addEventListener('click', applyDebtFilter));
    document.querySelectorAll('#demandStatusFilter .option').forEach((opt) => opt.addEventListener('click', applyDemandFilter));

    document.getElementById('debtDateFromPicker')?.addEventListener('change', applyDebtFilter);
    document.getElementById('debtDateToPicker')?.addEventListener('change', applyDebtFilter);
    document.getElementById('demandDateFromPicker')?.addEventListener('change', applyDemandFilter);
    document.getElementById('demandDateToPicker')?.addEventListener('change', applyDemandFilter);

    Promise.all([loadDebts(), loadLoans()]).finally(() => window.HesabinoUI && window.HesabinoUI.hidePageLoader && window.HesabinoUI.hidePageLoader());
  }

  window.DebtsApp = {
    openAddModal,
    openEdit: openEditModal,
    deleteItem,
    togglePaid,
    resetFilter,
    openLoanAddModal,
    openLoanEditModal,
    payLoan,
    deleteLoan,
    openAlertsModal,
    setPersonsSummary,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }
})();