(function () {
  'use strict';

  const API_BASE = '/api';

  // آخرین داده‌ی بودجه که از سرور خونده شده (برای دوباره‌سازی مودال و جمع‌ها استفاده می‌شه)
  let latestBudget = null;

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

  function formatPercent(value) {
    return toPersianDigits(Math.round(Number(value || 0) * 100) / 100) + '٪';
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

  // ===== کارت‌های بالای صفحه =====
  function renderSummary(data) {
    document.getElementById('budgetTotalAmount').textContent = formatAmount(data.totalBudget);
    document.getElementById('budgetSpentAmount').textContent = formatAmount(data.spent);
    const remainingEl = document.getElementById('budgetRemainingAmount');
    remainingEl.textContent = formatAmount(data.remaining);
    remainingEl.classList.toggle('text-red-color', data.remaining < 0);

    const incomeInput = document.getElementById('pageIncomeInput');
    if (incomeInput && document.activeElement !== incomeInput) {
      incomeInput.value = data.income ? data.income : '';
    }
  }

  // ===== لیست وضعیت هر دسته (پروگرس‌بارها) =====
  function renderStatusList(categories) {
    const container = document.getElementById('budgetStatusList');
    if (!container) return;

    if (!categories || !categories.length) {
      container.innerHTML = '<p class="text-center text-gray-400 mt-6">هنوز بودجه‌ای ثبت نشده است</p>';
      return;
    }

    container.innerHTML = categories.map((c) => {
      const percentDisplay = Math.max(0, Math.min(100, c.progressPercent));
      const barColor = c.isOverBudget ? 'bg-red-color' : 'bg-orange-color';
      const spentColor = c.isOverBudget ? 'text-red-color' : 'text-orange-color';
      return `
        <div class="budgetStatItem">
          <div class="border-b-zinc-200">
            <div class="mt-3">
              <div class="flex justify-between text-sm mb-1">
                <span>${escapeHtml(c.category)}</span>
                <span>${toPersianDigits(Math.round(c.progressPercent))}٪</span>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-2.5">
                <div class="${barColor} h-2.5 rounded-full progress-bar" style="width: ${percentDisplay}%"></div>
              </div>
              <div class="flex justify-between text-sm mt-1">
                <span class="${spentColor}">مصرف شده: ${formatAmount(c.spent)}</span>
                <span class="text-gray-500">${formatAmount(c.amount)}</span>
              </div>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  // ===== مودال ویرایش دستی: ساخت ردیف‌های دسته‌بندی =====
  function buildManualRows(categories) {
    const container = document.getElementById('manualCategoryRows');
    if (!container) return;

    container.innerHTML = categories.map((c) => `
      <div class="grid grid-cols-3 gap-3 items-center mb-3 border-b pb-3 border-b-zinc-200" data-category-row="${escapeHtml(c.category)}">
        <span class="font-medium text-zinc-800 text-sm">${escapeHtml(c.category)}</span>
        <div class="relative">
          <input type="text" inputmode="decimal" class="manual-percentage-input w-full h-10 border border-main-color rounded-lg pr-7 pl-3 outline-none text-sm text-center" value="${c.percentage || ''}" />
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">٪</span>
        </div>
        <div class="relative">
          <input type="text" inputmode="numeric" class="manual-amount-input w-full h-10 border border-main-color rounded-lg pr-7 pl-3 outline-none text-sm text-center" value="${c.amount || ''}" />
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">تومان</span>
        </div>
      </div>`).join('');

    container.querySelectorAll('.manual-percentage-input').forEach((input) => {
      input.addEventListener('input', () => onManualPercentageChange(input));
    });
    container.querySelectorAll('.manual-amount-input').forEach((input) => {
      input.addEventListener('input', () => onManualAmountChange(input));
    });
  }

  function currentManualIncome() {
    return Number(document.getElementById('manualIncomeInput').value) || 0;
  }

  function onManualPercentageChange(input) {
    const income = currentManualIncome();
    const percentage = Number(input.value) || 0;
    const row = input.closest('[data-category-row]');
    const amountInput = row.querySelector('.manual-amount-input');
    amountInput.value = income > 0 ? Math.round((income * percentage) / 100) : 0;
    recalcManualTotals();
  }

  function onManualAmountChange(input) {
    const income = currentManualIncome();
    const amount = Number(input.value) || 0;
    const row = input.closest('[data-category-row]');
    const percentageInput = row.querySelector('.manual-percentage-input');
    percentageInput.value = income > 0 ? Math.round(((amount / income) * 100 + Number.EPSILON) * 100) / 100 : 0;
    recalcManualTotals();
  }

  function recalcManualTotals() {
    const income = currentManualIncome();
    let totalPercent = 0;
    let totalAmount = 0;
    document.querySelectorAll('#manualCategoryRows [data-category-row]').forEach((row) => {
      totalPercent += Number(row.querySelector('.manual-percentage-input').value) || 0;
      totalAmount += Number(row.querySelector('.manual-amount-input').value) || 0;
    });

    document.getElementById('manualTotalPercent').textContent = formatPercent(totalPercent);
    document.getElementById('manualTotalAmount').textContent = formatAmount(totalAmount);

    const remaining = income - totalAmount;
    const remainingEl = document.getElementById('manualRemaining');
    remainingEl.textContent = formatAmount(remaining);
    remainingEl.classList.toggle('text-green-600', remaining >= 0);
    remainingEl.classList.toggle('text-red-color', remaining < 0);

    const incomePercent = income > 0 ? Math.round(((totalAmount / income) * 100 + Number.EPSILON) * 10) / 10 : 0;
    document.getElementById('manualIncomeSummary').textContent =
      `مجموع بودجه: ${formatAmount(totalAmount)} (${toPersianDigits(incomePercent)}٪ از درآمد)`;
  }

  // ===== باز کردن مودال ویرایش دستی =====
  function openManualModal() {
    if (!latestBudget) {
      showToast('داده‌ی بودجه هنوز بارگذاری نشده، کمی صبر کنید', 'error');
      return;
    }

    hideManualFormError();
    const pageIncome = Number(document.getElementById('pageIncomeInput').value) || latestBudget.income || 0;
    document.getElementById('manualIncomeInput').value = pageIncome || '';
    buildManualRows(latestBudget.categories);
    recalcManualTotals();
    window.openModal('editBudgetManual');
  }

  function showManualFormError(msg) {
    const el = document.getElementById('manualFormError');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  function hideManualFormError() {
    const el = document.getElementById('manualFormError');
    if (el) el.classList.add('hidden');
  }

  // ===== ثبت محاسبه‌ی خودکار =====
  async function autoCalculate() {
    const incomeRaw = document.getElementById('pageIncomeInput').value;
    const income = Number(incomeRaw);

    if (!incomeRaw || Number.isNaN(income) || income <= 0) {
      showToast('لطفاً درآمد این ماه را به‌درستی وارد کنید', 'error');
      return;
    }

    const btn = document.getElementById('autoCalculateBtn');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'در حال محاسبه...';

    try {
      const res = await fetch(`${API_BASE}/budget/calculate`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ income }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data.message || `خطا در محاسبه‌ی خودکار بودجه (کد ${res.status})`;
        showToast(Array.isArray(msg) ? msg[0] : msg, 'error');
        return;
      }

      applyBudgetData(data);
      showToast('بودجه به‌صورت خودکار محاسبه و ذخیره شد', 'success');
    } catch (err) {
      console.error('Auto-calculate network error:', err);
      showToast('ارتباط با سرور برقرار نشد', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }

  // ===== ثبت ویرایش دستی =====
  async function submitManual() {
    hideManualFormError();
    const income = currentManualIncome();

    if (!income || income <= 0) {
      showManualFormError('لطفاً درآمد این ماه را به‌درستی وارد کنید');
      return;
    }

    const categories = Array.from(document.querySelectorAll('#manualCategoryRows [data-category-row]')).map((row) => ({
      category: row.getAttribute('data-category-row'),
      percentage: Number(row.querySelector('.manual-percentage-input').value) || 0,
      amount: Number(row.querySelector('.manual-amount-input').value) || 0,
    }));

    const btn = document.getElementById('manualSubmitBtn');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'در حال ذخیره...';

    try {
      const res = await fetch(`${API_BASE}/budget`, {
        method: 'PUT',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ income, categories }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data.message || `خطا در ذخیره‌ی بودجه (کد ${res.status})`;
        showManualFormError(Array.isArray(msg) ? msg[0] : msg);
        showToast(Array.isArray(msg) ? msg[0] : msg, 'error');
        return;
      }

      applyBudgetData(data);
      window.closeModal();
      showToast('بودجه با موفقیت ذخیره شد', 'success');
    } catch (err) {
      console.error('Manual budget save network error:', err);
      showManualFormError('ارتباط با سرور برقرار نشد');
      showToast('ارتباط با سرور برقرار نشد', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }

  function applyBudgetData(data) {
    latestBudget = data;
    renderSummary(data);
    renderStatusList(data.categories);
  }

  // ===== بارگذاری اولیه‌ی وضعیت بودجه از سرور =====
  async function loadBudget() {
    const token = localStorage.getItem('access_token');
    if (!token) {
      const container = document.getElementById('budgetStatusList');
      if (container) {
        container.innerHTML = '<p class="text-center text-red-color mt-6">برای مشاهده‌ی بودجه باید وارد حساب کاربری شوید</p>';
      }
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/budget`, { headers: authHeaders() });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data.message || `خطا در دریافت بودجه (کد ${res.status})`;
        showToast(Array.isArray(msg) ? msg[0] : msg, 'error');
        return;
      }

      applyBudgetData(data);
    } catch (err) {
      console.error('Budget load network error:', err);
      showToast('ارتباط با سرور برقرار نشد', 'error');
    }
  }

  window.BudgetApp = {
    autoCalculate,
    openManualModal,
    submitManual,
  };

  function onReady() {
    loadBudget();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }
})();
