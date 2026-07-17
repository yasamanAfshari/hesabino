(function () {
  'use strict';

  const API_BASE = '/api';

  // آخرین لیست اهداف که از سرور خونده شده (برای پر کردن مودال ویرایش/افزودن مبلغ)
  let latestGoals = [];

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

  function formatCount(n) {
    return toPersianDigits(Math.round(Number(n || 0))) + ' عدد';
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

  function statusClasses(status) {
    if (status === 'green') return { bar: 'bg-green-color', text: 'text-green-color' };
    if (status === 'orange') return { bar: 'bg-orange-color', text: 'text-orange-color' };
    return { bar: 'bg-red-color', text: 'text-red-color' };
  }

  // ===== کارت‌های خلاصه‌ی بالای صفحه =====
  function renderSummary(summary) {
    document.getElementById('savingsTotalGoals').textContent = formatCount(summary.totalGoals);
    document.getElementById('savingsAchievedGoals').textContent = formatCount(summary.achievedGoals);
    document.getElementById('savingsTotalGoalAmount').textContent = formatAmount(summary.totalGoalAmount);
    document.getElementById('savingsTotalSaved').textContent = formatAmount(summary.totalSaved);
  }

  // ===== لیست کارت‌های اهداف پس‌انداز =====
  function renderGoalsList(goals) {
    const container = document.getElementById('savingsGoalsList');
    if (!container) return;

    if (!goals.length) {
      container.innerHTML = '<p class="text-center text-gray-400 mt-6 col-span-full">هنوز هدفی ثبت نشده است</p>';
      return;
    }

    container.innerHTML = goals.map((g) => {
      const cls = statusClasses(g.status);
      const monthlyNeedText = g.isAchieved
        ? 'محقق شده'
        : g.isExpired
          ? 'مهلت تمام شده'
          : g.monthlyNeed !== null
            ? formatAmount(g.monthlyNeed)
            : '—';

      return `
        <div class="bg-white rounded-2xl shadow-sm border border-gray-200/80 p-4 transition-all hover:shadow-md" data-goal-id="${g.id}">
          <div class="cursor-pointer" onclick="SavingsApp.openEditModal(${g.id})" title="ویرایش">
            <!-- Title & Date -->
            <div class="flex justify-between items-center mb-2">
              <span class="font-bold text-zinc-800 text-base">${escapeHtml(g.title)}</span>
              <span class="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-md">${escapeHtml(g.deadline ? toPersianDigits(g.deadline) : '—')}</span>
            </div>

            <div class="mt-3">
              <div class="flex justify-between text-sm mb-1">
                <span>${toPersianDigits(g.progressPercent)}٪</span>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-2.5">
                <div class="${cls.bar} h-2.5 rounded-full progress-bar" style="width: ${g.progressBarPercent}%"></div>
              </div>
              <div class="flex justify-between text-sm mt-1">
                <span class="${cls.text}">ذخیره شده: ${formatAmount(g.currentAmount)}</span>
                <span class="text-gray-500">${formatAmount(g.targetAmount)}</span>
              </div>
            </div>

            <!-- Monthly Need -->
            <div class="flex items-center justify-between gap-1 text-sm bg-zinc-100 rounded-xl m-3 p-2 border border-zinc-300">
              <div>نیاز ماهانه</div>
              <div class="font-bold text-main-color">${monthlyNeedText}</div>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex justify-end items-center pt-2 border-t border-gray-200 gap-3">
            <button class="text-sm main-btn transition-colors font-medium flex items-center gap-1 bg-main-color/5 px-3 py-1 rounded-full" onclick="SavingsApp.openDepositModal(${g.id})">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
              افزودن مبلغ
            </button>
            <button class="bg-red-400 p-1 rounded-md w-10 flex justify-center" onclick="SavingsApp.deleteGoal(${g.id})" title="حذف هدف">
              <svg width="26" height="26" viewBox="0 0 26 26" fill="none" stroke="white" stroke-width="2">
                <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
              </svg>
            </button>
          </div>
        </div>`;
    }).join('');
  }

  function applyOverview(data) {
    latestGoals = data.goals || [];
    renderSummary(data.summary);
    renderGoalsList(latestGoals);
  }

  // ===== بارگذاری اولیه از سرور =====
  async function loadSavings() {
    const token = localStorage.getItem('access_token');
    if (!token) {
      const container = document.getElementById('savingsGoalsList');
      if (container) {
        container.innerHTML = '<p class="text-center text-red-color mt-6 col-span-full">برای مشاهده‌ی اهداف باید وارد حساب کاربری شوید</p>';
      }
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/savings`, { headers: authHeaders() });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data.message || `خطا در دریافت اهداف پس‌انداز (کد ${res.status})`;
        showToast(Array.isArray(msg) ? msg[0] : msg, 'error');
        return;
      }

      applyOverview(data);
    } catch (err) {
      console.error('Savings load network error:', err);
      showToast('ارتباط با سرور برقرار نشد', 'error');
    }
  }

  // ===== مودال افزودن هدف جدید =====
  function openAddModal() {
    document.getElementById('addSavingTitle').value = '';
    document.getElementById('addSavingTarget').value = '';
    document.getElementById('addSavingCurrent').value = '';
    document.getElementById('addSavingDeadline').value = '';
    document.getElementById('addSavingReminder').checked = false;
    hideError('addSavingError');
    window.openModal('addSaving');
  }

  async function submitCreate() {
    hideError('addSavingError');
    const title = document.getElementById('addSavingTitle').value.trim();
    const targetAmount = Number(document.getElementById('addSavingTarget').value);
    const currentAmount = Number(document.getElementById('addSavingCurrent').value) || 0;
    const deadline = document.getElementById('addSavingDeadline').value.trim();
    const reminder = document.getElementById('addSavingReminder').checked;

    if (!title) return showError('addSavingError', 'نام هدف را وارد کنید');
    if (!targetAmount || targetAmount <= 0) return showError('addSavingError', 'مبلغ هدف را به‌درستی وارد کنید');

    const btn = document.getElementById('addSavingSubmitBtn');
    await withButtonLoading(btn, 'در حال ثبت...', async () => {
      const res = await fetch(`${API_BASE}/savings`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ title, targetAmount, currentAmount, deadline: deadline || undefined, reminder }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data.message || `خطا در ثبت هدف (کد ${res.status})`;
        showError('addSavingError', Array.isArray(msg) ? msg[0] : msg);
        return;
      }

      applyOverview(data);
      window.closeModal();
      showToast('هدف پس‌انداز با موفقیت ثبت شد', 'success');
    });
  }

  // ===== مودال ویرایش هدف =====
  function openEditModal(id) {
    const goal = latestGoals.find((g) => g.id === id);
    if (!goal) return;

    document.getElementById('editSavingId').value = goal.id;
    document.getElementById('editSavingTitle').value = goal.title;
    document.getElementById('editSavingTarget').value = goal.targetAmount;
    document.getElementById('editSavingCurrent').value = goal.currentAmount;
    document.getElementById('editSavingDeadline').value = goal.deadline || '';
    document.getElementById('editSavingReminder').checked = !!goal.reminder;
    hideError('editSavingError');
    window.openModal('editSaving');
  }

  async function submitUpdate() {
    hideError('editSavingError');
    const id = Number(document.getElementById('editSavingId').value);
    const title = document.getElementById('editSavingTitle').value.trim();
    const targetAmount = Number(document.getElementById('editSavingTarget').value);
    const currentAmount = Number(document.getElementById('editSavingCurrent').value) || 0;
    const deadline = document.getElementById('editSavingDeadline').value.trim();
    const reminder = document.getElementById('editSavingReminder').checked;

    if (!title) return showError('editSavingError', 'نام هدف را وارد کنید');
    if (!targetAmount || targetAmount <= 0) return showError('editSavingError', 'مبلغ هدف را به‌درستی وارد کنید');

    const btn = document.getElementById('editSavingSubmitBtn');
    await withButtonLoading(btn, 'در حال ذخیره...', async () => {
      const res = await fetch(`${API_BASE}/savings/${id}`, {
        method: 'PUT',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ title, targetAmount, currentAmount, deadline: deadline || null, reminder }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data.message || `خطا در ذخیره‌ی هدف (کد ${res.status})`;
        showError('editSavingError', Array.isArray(msg) ? msg[0] : msg);
        return;
      }

      applyOverview(data);
      window.closeModal();
      showToast('هدف پس‌انداز به‌روزرسانی شد', 'success');
    });
  }

  async function submitDelete() {
    const id = Number(document.getElementById('editSavingId').value);
    await deleteGoal(id, true);
  }

  async function deleteGoal(id, skipConfirm) {
    if (!skipConfirm && !window.confirm('آیا از حذف این هدف پس‌انداز مطمئن هستید؟')) return;

    try {
      const res = await fetch(`${API_BASE}/savings/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data.message || `خطا در حذف هدف (کد ${res.status})`;
        showToast(Array.isArray(msg) ? msg[0] : msg, 'error');
        return;
      }

      applyOverview(data);
      window.closeModal();
      showToast('هدف پس‌انداز حذف شد', 'success');
    } catch (err) {
      console.error('Delete saving goal network error:', err);
      showToast('ارتباط با سرور برقرار نشد', 'error');
    }
  }

  // ===== مودال افزودن مبلغ =====
  function openDepositModal(id) {
    document.getElementById('addPriceGoalId').value = id;
    document.getElementById('addPriceAmount').value = '';
    hideError('addPriceError');
    window.openModal('addPriceToSaving');
  }

  async function submitDeposit() {
    hideError('addPriceError');
    const id = Number(document.getElementById('addPriceGoalId').value);
    const amount = Number(document.getElementById('addPriceAmount').value);

    if (!amount || amount <= 0) return showError('addPriceError', 'مبلغ را به‌درستی وارد کنید');

    const btn = document.getElementById('addPriceSubmitBtn');
    await withButtonLoading(btn, 'در حال ثبت...', async () => {
      const res = await fetch(`${API_BASE}/savings/${id}/deposit`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ amount }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data.message || `خطا در افزودن مبلغ (کد ${res.status})`;
        showError('addPriceError', Array.isArray(msg) ? msg[0] : msg);
        return;
      }

      applyOverview(data);
      window.closeModal();
      showToast('مبلغ با موفقیت به هدف اضافه شد', 'success');
    });
  }

  // ===== کمک‌کننده‌های فرم =====
  function showError(id, msg) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  function hideError(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  }

  async function withButtonLoading(btn, loadingText, fn) {
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = loadingText;
    try {
      await fn();
    } catch (err) {
      console.error('Savings action network error:', err);
      showToast('ارتباط با سرور برقرار نشد', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  }

  window.SavingsApp = {
    openAddModal,
    submitCreate,
    openEditModal,
    submitUpdate,
    submitDelete,
    deleteGoal,
    openDepositModal,
    submitDeposit,
  };

  function onReady() {
    loadSavings();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }
})();
