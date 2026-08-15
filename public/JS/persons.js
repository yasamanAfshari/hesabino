(function () {
  'use strict';

  const API_BASE = '/api';

  // لیست همه‌ی اشخاص کاربر (از /api/persons)
  let allPeople = [];
  // شناسه‌ی شخصی که مودال «حساب‌کتاب» الان روش بازه
  let currentPersonId = null;
  // آیتم‌های ریز حساب‌کتاب شخصِ باز شده
  let currentEntries = [];
  let editingEntryId = null;
  let selectedExistingPersonId = null;
  function formatAmount(amount) {
    const grouped = Number(amount || 0).toLocaleString('en-US');
    return toPersianDigits(grouped);
  }

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

  // ===== سلکت‌باکس سفارشی (هم‌شکل با debts.js) =====
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

  function directionLabel(direction) {
    return direction === 'they_owe' ? 'طلب من' : 'بدهی من';
  }

  function directionBadgeClasses(direction) {
    return direction === 'they_owe' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700';
  }

  function netBadgeInfo(net) {
    if (net > 0) return { text: `بستانکار ${formatAmount(net)} تومان`, cls: 'bg-green-color-25 text-green-color' };
    if (net < 0) return { text: `بدهکار ${formatAmount(Math.abs(net))} تومان`, cls: 'bg-red-color-25 text-red-color' };
    return { text: 'تسویه', cls: 'bg-gray-100 text-gray-600' };
  }

  // ===== کارتِ هر شخص =====
  function renderPersonCard(p) {
    const badge = netBadgeInfo(p.net);
    return `
      <div class="bg-white mb-0 rounded-2xl shadow-sm border border-gray-200/80 p-4 transition-all hover:shadow-md" data-person-id="${p.id}">
        <div class="cursor-pointer" onclick="PersonsApp.openLedger(${p.id})" title="افزودن/مشاهده‌ی بدهی و طلب">
          <div class="flex justify-between items-start mb-2 gap-2">
            <div class="min-w-0">
              <span class="font-bold text-zinc-800 text-base block truncate">${escapeHtml(p.name)}</span>
              ${p.note ? `<span class="text-xs text-gray-400 truncate block">${escapeHtml(p.note)}</span>` : ''}
            </div>
            <span class="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-md whitespace-nowrap">${toPersianDigits(p.entriesCount)} رکورد</span>
          </div>

          <div class="flex items-center justify-between text-sm mt-3 bg-zinc-50 rounded-xl p-2.5 border border-zinc-100">
            <div class="text-center flex-1">
              <div class="text-gray-400 text-xs mb-0.5">طلب من</div>
              <div class="text-green-color font-bold">${formatAmount(p.theyOwe)}</div>
            </div>
            <div class="w-px h-8 bg-zinc-200"></div>
            <div class="text-center flex-1">
              <div class="text-gray-400 text-xs mb-0.5">بدهی من</div>
              <div class="text-red-color font-bold">${formatAmount(p.iOwe)}</div>
            </div>
          </div>

          <div class="mt-3 text-center">
            <span class="${badge.cls} px-3 py-1 rounded-full text-xs font-medium">${badge.text}</span>
          </div>
        </div>

        <div class="flex justify-end items-center pt-2 mt-2 border-t border-gray-200">
          <button type="button" class="bg-red-color p-1 rounded-md w-9 flex justify-center" title="حذف شخص" onclick="event.stopPropagation(); PersonsApp.deletePersonFromList(${p.id})">
            ${TRASH_ICON}
          </button>
        </div>
      </div>`;
  }

  function renderPersonsList(list) {
    const container = document.getElementById('personsList');
    if (!container) return;
    if (!list.length) {
      container.innerHTML = `<p class="text-center text-gray-400 mt-6 col-span-full">هنوز شخصی ثبت نکرده‌ای</p>`;
      return;
    }
    container.innerHTML = list.map(renderPersonCard).join('');
  }

  function applyPersonsFilter() {
    const search = (document.getElementById('personSearchInput')?.value || '').trim().toLowerCase();
    const filtered = search
      ? allPeople.filter((p) => (p.name || '').toLowerCase().includes(search))
      : allPeople;
    renderPersonsList(filtered);
  }

  function resetFilter() {
    const input = document.getElementById('personSearchInput');
    if (input) input.value = '';
    applyPersonsFilter();
  }

  // ===== بارگذاری لیست اشخاص =====
  async function loadPersons() {
    const container = document.getElementById('personsList');
    const token = localStorage.getItem('access_token');
    if (!token) {
      if (container) container.innerHTML = `<p class="text-center text-red-color mt-6 col-span-full">برای مشاهده باید وارد حساب کاربری شوید</p>`;
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/persons`, { headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data.message || `خطا در دریافت اطلاعات (کد ${res.status})`;
        if (container) container.innerHTML = `<p class="text-center text-red-color mt-6 col-span-full">${escapeHtml(msg)}</p>`;
        return;
      }
      allPeople = Array.isArray(data.people) ? data.people : [];
      applyPersonsFilter();
      if (window.DebtsApp && window.DebtsApp.setPersonsSummary) {
        window.DebtsApp.setPersonsSummary(data.summary || { debt: 0, receivable: 0, net: 0 });
      }
    } catch (err) {
      console.error('خطا در دریافت اشخاص:', err);
      if (container) container.innerHTML = `<p class="text-center text-red-color mt-6 col-span-full">ارتباط با سرور برقرار نشد</p>`;
    }
  }

  function renderNameSuggestions(list) {
    const box = document.getElementById('personNameSuggestions');
    if (!list.length) {
      box.classList.add('hidden');
      box.innerHTML = '';
      return;
    }
    box.innerHTML = list.map((p) => `
      <div class="px-4 py-2.5 cursor-pointer hover:bg-gray-100 text-sm" data-id="${p.id}">
        ${escapeHtml(p.name)}
        <span class="text-xs text-gray-400">(حساب‌کتاب قبلی)</span>
      </div>`).join('');
    box.classList.remove('hidden');
    box.querySelectorAll('[data-id]').forEach((row) => {
      row.addEventListener('click', () => {
        const id = Number(row.dataset.id);
        const person = allPeople.find((p) => p.id === id);
        if (!person) return;
        selectedExistingPersonId = id;
        document.getElementById('personNameInput').value = person.name;
        document.getElementById('personNoteInput').value = person.note || '';
        box.classList.add('hidden');
      });
    });
  }

  function onPersonNameInput() {
    selectedExistingPersonId = null;
    const value = (document.getElementById('personNameInput').value || '').trim().toLowerCase();
    if (!value) {
      renderNameSuggestions([]);
      return;
    }
    const matches = allPeople.filter((p) => (p.name || '').toLowerCase().includes(value)).slice(0, 6);
    renderNameSuggestions(matches);
  }

  function resetPersonForm() {
    document.getElementById('personForm')?.reset();
    hideFormError('personModalFormError');
    resetCustomSelect('personDirectionSelect');
    renderNameSuggestions([]);
    selectedExistingPersonId = null;
    window.AmountInput?.refreshForm(document.getElementById('personModal'));
  }

  function openAddModal() {
    resetPersonForm();
    window.openModal('personModal');
  }

  async function handlePersonFormSubmit(e) {
    e.preventDefault();
    const errorId = 'personModalFormError';
    hideFormError(errorId);

    const name = (document.getElementById('personNameInput').value || '').trim();
    const note = (document.getElementById('personNoteInput').value || '').trim();
    const direction = getCustomSelectValue('personDirectionSelect');
    const amountRaw = window.AmountInput.parse(document.getElementById('personAmountInput').value);
    const description = (document.getElementById('personDescriptionInput').value || '').trim();

    if (!name) {
      showFormError(errorId, 'لطفاً نام شخص را وارد کنید');
      return;
    }
    if (!direction) {
      showFormError(errorId, 'لطفاً نوع رکورد را انتخاب کنید');
      return;
    }
    if (amountRaw === '' || Number(amountRaw) <= 0 || Number.isNaN(Number(amountRaw))) {
      showFormError(errorId, 'لطفاً مبلغ معتبری وارد کنید');
      return;
    }

    const btn = document.getElementById('personSubmitBtn');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'در حال ذخیره...';

    try {
      let personId = selectedExistingPersonId;

      if (!personId) {
        const createRes = await fetch(`${API_BASE}/persons`, {
          method: 'POST',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ name, note: note || undefined }),
        });
        const createData = await createRes.json().catch(() => ({}));
        if (!createRes.ok) {
          const msg = createData.message || `خطا در ساخت شخص (کد ${createRes.status})`;
          showFormError(errorId, Array.isArray(msg) ? msg[0] : msg);
          return;
        }
        personId = createData.personId;
      }

      const entryRes = await fetch(`${API_BASE}/persons/${personId}/entries`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ direction, amount: Number(amountRaw), description: description || undefined }),
      });
      const entryData = await entryRes.json().catch(() => ({}));
      if (!entryRes.ok) {
        const msg = entryData.message || `خطا در ثبت رکورد (کد ${entryRes.status})`;
        showFormError(errorId, Array.isArray(msg) ? msg[0] : msg);
        return;
      }

      window.closeModal();
      showToast('حساب‌کتاب با موفقیت ثبت شد', 'success');
      await loadPersons();
    } catch (err) {
      console.error('خطا در ثبت شخص/رکورد:', err);
      showFormError(errorId, 'ارتباط با سرور برقرار نشد');
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }

  function renderLedgerBox(entry) {
    return `
      <div class="flex items-center justify-between gap-3 p-3 rounded-xl border ${entry.direction === 'they_owe' ? 'border-green-color' : 'border-red-color'}" data-id="${entry.id}">
        <div class="flex items-center gap-3 min-w-0">
          <span class="${directionBadgeClasses(entry.direction)} px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap">${directionLabel(entry.direction)}</span>
          <div class="min-w-0">
            <p class="text-zinc-700 text-sm font-bold">${formatAmount(entry.amount)} تومان</p>
            ${entry.description ? `<p class="text-zinc-400 text-xs truncate">${escapeHtml(entry.description)}</p>` : ''}
          </div>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <button type="button" class="bg-main-color p-1 rounded-md" title="ویرایش" onclick="PersonsApp.editEntry(${entry.id})">${PENCIL_ICON}</button>
          <button type="button" class="bg-red-color p-1 rounded-md" title="حذف" onclick="PersonsApp.deleteEntry(${entry.id})">${TRASH_ICON}</button>
        </div>
      </div>`;
  }

  function renderLedgerModal(data) {
    document.getElementById('personLedgerName').textContent = data.person.name;
    document.getElementById('personLedgerNameInput').value = data.person.name;
    document.getElementById('personLedgerNoteInput').value = data.person.note || '';

    const badge = netBadgeInfo(data.summary.net);
    const netEl = document.getElementById('personLedgerNet');
    netEl.textContent = badge.text;
    netEl.className = `text-sm font-bold px-3 py-2 rounded-lg inline-block ${badge.cls}`;

    currentEntries = data.entries || [];
    const list = document.getElementById('personLedgerList');
    list.innerHTML = currentEntries.length
      ? currentEntries.map(renderLedgerBox).join('')
      : `<p class="text-center text-gray-400 py-6">هنوز رکوردی ثبت نشده</p>`;
  }

  async function openLedger(personId) {
    currentPersonId = personId;
    cancelEntryEdit();
    document.getElementById('personNameEditRow')?.classList.add('hidden');
    window.openModal('personLedgerModal');

    try {
      const res = await fetch(`${API_BASE}/persons/${personId}`, { headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.message || 'خطا در دریافت حساب‌کتاب', 'error');
        return;
      }
      renderLedgerModal(data);
    } catch (err) {
      console.error('خطا در دریافت حساب‌کتاب شخص:', err);
      showToast('ارتباط با سرور برقرار نشد', 'error');
    }
  }

  // ===== افزودن/ویرایش یک رکورد از داخل مودال حساب‌کتاب =====
  function cancelEntryEdit() {
    editingEntryId = null;
    document.getElementById('personEntryForm')?.reset();
    document.getElementById('personEntryId').value = '';
    resetCustomSelect('personEntryDirectionSelect');
    hideFormError('personEntryFormError');
    document.getElementById('personEntrySubmitBtn').textContent = 'افزودن';
    document.getElementById('personEntryCancelBtn')?.classList.add('hidden');
    window.AmountInput?.refresh(document.getElementById('personEntryAmountInput'));
  }

  function editEntry(entryId) {
    const entry = currentEntries.find((e) => e.id === entryId);
    if (!entry) return;
    editingEntryId = entryId;
    document.getElementById('personEntryId').value = entryId;
    setCustomSelectValue('personEntryDirectionSelect', entry.direction);
    document.getElementById('personEntryAmountInput').value = entry.amount;
    window.AmountInput?.refresh(document.getElementById('personEntryAmountInput'));
    document.getElementById('personEntryDescriptionInput').value = entry.description || '';
    document.getElementById('personEntrySubmitBtn').textContent = 'ذخیره تغییرات';
    document.getElementById('personEntryCancelBtn')?.classList.remove('hidden');
    document.getElementById('personEntryForm')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  async function handleEntryFormSubmit(e) {
    e.preventDefault();
    if (!currentPersonId) return;
    const errorId = 'personEntryFormError';
    hideFormError(errorId);

    const direction = getCustomSelectValue('personEntryDirectionSelect');
    const amountRaw = window.AmountInput.parse(document.getElementById('personEntryAmountInput').value);
    const description = (document.getElementById('personEntryDescriptionInput').value || '').trim();

    if (!direction) { showFormError(errorId, 'نوع رکورد را انتخاب کنید'); return; }
    if (amountRaw === '' || Number(amountRaw) <= 0 || Number.isNaN(Number(amountRaw))) { showFormError(errorId, 'مبلغ معتبری وارد کنید'); return; }

    const payload = { direction, amount: Number(amountRaw), description: description || undefined };
    const btn = document.getElementById('personEntrySubmitBtn');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'در حال ذخیره...';

    try {
      const url = editingEntryId
        ? `${API_BASE}/persons/${currentPersonId}/entries/${editingEntryId}`
        : `${API_BASE}/persons/${currentPersonId}/entries`;
      const method = editingEntryId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data.message || `خطا در ذخیره (کد ${res.status})`;
        showFormError(errorId, Array.isArray(msg) ? msg[0] : msg);
        return;
      }
      renderLedgerModal(data);
      cancelEntryEdit();
      showToast(editingEntryId ? 'با موفقیت ویرایش شد' : 'با موفقیت ثبت شد', 'success');
      await loadPersons();
    } catch (err) {
      console.error('خطا در ثبت/ویرایش رکورد:', err);
      showFormError(errorId, 'ارتباط با سرور برقرار نشد');
    } finally {
      btn.disabled = false;
      btn.textContent = editingEntryId ? 'ذخیره تغییرات' : 'افزودن';
    }
  }

  async function deleteEntry(entryId) {
    if (!currentPersonId) return;
    if (!(await window.HesabinoUI.confirmDialog('آیا از حذف این تراکنش مطمئن هستید؟'))) return;
    try {
      const res = await fetch(`${API_BASE}/persons/${currentPersonId}/entries/${entryId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.message || 'خطا در حذف تراکنش', 'error');
        return;
      }
      renderLedgerModal(data);
      showToast('تراکنش حذف شد', 'success');
      await loadPersons();
    } catch (err) {
      console.error('خطا در حذف تراکنش:', err);
      showToast('ارتباط با سرور برقرار نشد', 'error');
    }
  }

  // ===== ویرایش نام/توضیح شخص از داخل مودال حساب‌کتاب =====
  function togglePersonNameEdit() {
    document.getElementById('personNameEditRow')?.classList.toggle('hidden');
  }

  async function savePersonName() {
    if (!currentPersonId) return;
    const name = (document.getElementById('personLedgerNameInput').value || '').trim();
    const note = (document.getElementById('personLedgerNoteInput').value || '').trim();
    if (!name) {
      showToast('نام نمی‌تواند خالی باشد', 'error');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/persons/${currentPersonId}`, {
        method: 'PATCH',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ name, note: note || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.message || 'خطا در ذخیره‌ی نام', 'error');
        return;
      }
      document.getElementById('personLedgerName').textContent = name;
      document.getElementById('personNameEditRow')?.classList.add('hidden');
      allPeople = Array.isArray(data.people) ? data.people : allPeople;
      applyPersonsFilter();
      if (window.DebtsApp && window.DebtsApp.setPersonsSummary) {
        window.DebtsApp.setPersonsSummary(data.summary);
      }
      showToast('نام با موفقیت ذخیره شد', 'success');
    } catch (err) {
      console.error('خطا در ذخیره‌ی نام شخص:', err);
      showToast('ارتباط با سرور برقرار نشد', 'error');
    }
  }

  // ===== حذف شخص =====
  async function removePersonById(personId) {
    try {
      const res = await fetch(`${API_BASE}/persons/${personId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.message || 'خطا در حذف شخص', 'error');
        return false;
      }
      allPeople = Array.isArray(data.people) ? data.people : [];
      applyPersonsFilter();
      if (window.DebtsApp && window.DebtsApp.setPersonsSummary) {
        window.DebtsApp.setPersonsSummary(data.summary);
      }
      showToast('شخص و حساب‌کتابش حذف شد', 'success');
      return true;
    } catch (err) {
      console.error('خطا در حذف شخص:', err);
      showToast('ارتباط با سرور برقرار نشد', 'error');
      return false;
    }
  }

  async function deletePerson() {
    if (!currentPersonId) return;
    if (!(await window.HesabinoUI.confirmDialog('آیا از حذف این شخص و همه‌ی تراکنش‌های خردش مطمئن هستید؟'))) return;
    const ok = await removePersonById(currentPersonId);
    if (ok) window.closeModal();
  }

  async function deletePersonFromList(personId) {
    if (!(await window.HesabinoUI.confirmDialog('آیا از حذف این شخص و همه‌ی تراکنش‌های خردش مطمئن هستید؟'))) return;
    await removePersonById(personId);
  }

  function onReady() {
    document.getElementById('personForm')?.addEventListener('submit', handlePersonFormSubmit);
    document.getElementById('personEntryForm')?.addEventListener('submit', handleEntryFormSubmit);
    document.getElementById('personNameInput')?.addEventListener('input', debounce(onPersonNameInput, 150));
    document.getElementById('personSearchInput')?.addEventListener('input', debounce(applyPersonsFilter, 250));

    loadPersons().finally(() => window.HesabinoUI && window.HesabinoUI.hidePageLoader && window.HesabinoUI.hidePageLoader());
  }

  window.PersonsApp = {
    openAddModal,
    openLedger,
    editEntry,
    deleteEntry,
    cancelEntryEdit,
    togglePersonNameEdit,
    savePersonName,
    deletePerson,
    deletePersonFromList,
    resetFilter,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }
})();