(function () {
  'use strict';

  const API_BASE = '';

  // ===== گرفتن اطلاعات کاربر لاگین‌کرده و نمایش اسمش/عکسش در هدر =====
  async function loadUserProfile() {
    const nameEl = document.getElementById('user-fullname');
    if (!nameEl) return;

    const token = localStorage.getItem('access_token');
    if (!token) return; 

    try {
      const response = await fetch(`${API_BASE}/users/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('access_token');
          window.location.replace('/login');
        }
        return;
      }

      const user = await response.json();
      applyUserToHeader(user);
    } catch (err) {
      console.warn('خطا در دریافت اطلاعات کاربر:', err);
      nameEl.textContent = 'کاربر';
    }
  }

  function applyUserToHeader(user) {
    const nameEl = document.getElementById('user-fullname');
    const imgEl = document.getElementById('user-avatar-img');
    if (nameEl) {
      nameEl.textContent = user.fullname || 'کاربر';
      nameEl.setAttribute('title', user.fullname || 'کاربر'); // ← اضافه شود
    }

    if (imgEl) {
      if (user.avatarUrl) {
        imgEl.src = user.avatarUrl;
        imgEl.alt = user.fullname || 'کاربر';
        imgEl.classList.remove('hidden');
      } else {
        imgEl.removeAttribute('src');
        imgEl.classList.add('hidden');
      }
    }
  }

  window.HesabinoHeader = { refresh: loadUserProfile, apply: applyUserToHeader };

  // ===== باز و بسته شدن دراپ‌داون پروفایل =====
  function setupUserMenu() {
    const button = document.getElementById('user-menu-button');
    const dropdown = document.getElementById('user-menu-dropdown');
    const chevron = document.getElementById('user-menu-chevron');
    if (!button || !dropdown) return;

    function isOpen() {
      return !dropdown.classList.contains('hidden');
    }

    function openMenu() {
      dropdown.classList.remove('hidden');
      chevron?.classList.add('rotate-180');
      button.setAttribute('aria-expanded', 'true');
    }

    function closeMenu() {
      dropdown.classList.add('hidden');
      chevron?.classList.remove('rotate-180');
      button.setAttribute('aria-expanded', 'false');
    }

    button.addEventListener('click', (e) => {
      e.stopPropagation();
      isOpen() ? closeMenu() : openMenu();
    });

    // بستن با کلیک بیرون از منو
    document.addEventListener('click', (e) => {
      if (isOpen() && !dropdown.contains(e.target) && !button.contains(e.target)) {
        closeMenu();
      }
    });

    // بستن با کلید Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen()) closeMenu();
    });
  }

  function onReady() {
    loadUserProfile();
    setupUserMenu();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }
})();
