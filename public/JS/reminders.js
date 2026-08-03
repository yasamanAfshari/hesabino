(function () {
  'use strict';

  const API_BASE = '/api';

  function authHeaders(extra) {
    const token = localStorage.getItem('access_token');
    return Object.assign({ Authorization: `Bearer ${token}` }, extra || {});
  }

  function toPersianDigits(str) {
    const digits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return String(str).replace(/[0-9]/g, (d) => digits[+d]);
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[ch]));
  }

  function formatAmount(amount) {
    if (amount === null || amount === undefined) return null;
    return toPersianDigits(Math.round(amount).toLocaleString('en-US')) + ' تومان';
  }

  const PRIORITY_STYLE = {
    overdue: { badge: 'bg-red-100 text-red-700', label: 'سررسید گذشته', border: 'border-red-color' },
    today: { badge: 'bg-orange-100 text-orange-700', label: 'امروز', border: 'border-orange-color' },
    soon: { badge: 'bg-blue-100 text-blue-700', label: 'به‌زودی', border: 'border-main-color' },
    scheduled: { badge: 'bg-gray-100 text-gray-600', label: 'برنامه‌ریزی‌شده', border: 'border-gray-300' },
  };

  const SOURCE_ICON_BG = {
    cheque: 'bg-orange-color-25 border-orange-color',
    debt: 'bg-red-color-25 border-red-color',
    saving: 'bg-main-color-25 border-main-color',
    subscription: 'bg-purple-color-25 border-purple-color',
    installment: 'bg-green2-color-25 border-green2-color',
  };

  function daysLabel(days) {
    if (days === null || days === undefined) return '';
    if (days < 0) return `${toPersianDigits(Math.abs(days))} روز گذشته`;
    if (days === 0) return 'امروز';
    return `${toPersianDigits(days)} روز مانده`;
  }

  function renderList(elId, items, emptyText) {
    const el = document.getElementById(elId);
    if (!items.length) {
      el.innerHTML = `<p class="text-zinc-400 !text-sm text-center py-6">${emptyText}</p>`;
      return;
    }

    el.innerHTML = items.map((r) => {
      const style = PRIORITY_STYLE[r.priority] || PRIORITY_STYLE.scheduled;
      const iconBg = SOURCE_ICON_BG[r.sourceType] || 'bg-gray-100 border-gray-300';
      const amountText = formatAmount(r.amount);

      return `
        <a href="${r.link}" class="flex items-center justify-between gap-3 p-3 rounded-xl border ${style.border} hover:bg-gray-50 transition-colors">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-2.5 h-2.5 rounded-full shrink-0 ${iconBg}"></div>
            <div class="min-w-0">
              <p class="text-zinc-700 !text-sm font-semibold truncate">${escapeHtml(r.title)}</p>
              ${r.subtitle ? `<p class="text-zinc-400 !text-xs truncate">${escapeHtml(r.subtitle)}</p>` : ''}
            </div>
          </div>
          <div class="text-left shrink-0">
            ${amountText ? `<p class="text-zinc-700 !text-sm font-bold">${amountText}</p>` : ''}
            <span class="inline-block !text-[11px] font-semibold px-2 py-0.5 rounded-full ${style.badge}">${daysLabel(r.daysLeft) || style.label}</span>
          </div>
        </a>
      `;
    }).join('');
  }

  async function loadReminders() {
    try {
      const res = await fetch(`${API_BASE}/reminders`, { headers: authHeaders() });
      if (!res.ok) throw new Error('خطا در دریافت یادآورها');
      const data = await res.json();

      document.getElementById('reminderCountOverdue').textContent = toPersianDigits(data.counts.overdue);
      document.getElementById('reminderCountToday').textContent = toPersianDigits(data.counts.today);
      document.getElementById('reminderCountSoon').textContent = toPersianDigits(data.counts.soon);
      document.getElementById('reminderCountTotal').textContent = toPersianDigits(data.counts.total);

      renderList('manualRemindersList', data.manual, 'هنوز هیچ یادآوری فعال نکرده‌اید. از صفحه‌ی چک‌ها، بدهی‌ها یا پس‌انداز، تیک «یادآور» را روشن کنید.');
      renderList('automaticRemindersList', data.automatic, 'در حال حاضر اشتراک یا قسطی نزدیک به سررسید ندارید.');
    } catch (err) {
      console.error(err);
      document.getElementById('manualRemindersList').innerHTML =
        '<p class="text-red-500 !text-sm text-center py-6">خطا در دریافت یادآورها. لطفاً صفحه را رفرش کنید.</p>';
      document.getElementById('automaticRemindersList').innerHTML = '';
    }
  }

  document.addEventListener('DOMContentLoaded', loadReminders);
})();
