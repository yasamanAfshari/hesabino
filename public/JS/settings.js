(function () {
  'use strict';

  const API_BASE = '';

  let pendingAvatarFile = null;
  let originalAvatarUrl = '';  // آدرس عکس فعلی، برای برگرداندن در صورت خطا

  function authHeaders(extra) {
    const token = localStorage.getItem('access_token');
    return Object.assign({ Authorization: `Bearer ${token}` }, extra || {});
  }

  function showMessage(el, text, type) {
    el.textContent = text;
    el.classList.remove('hidden', 'bg-green-color-25', 'text-green-color', 'bg-red-color-25', 'text-red-color');
    if (type === 'success') {
      el.classList.add('bg-green-color-25', 'text-green-color');
    } else {
      el.classList.add('bg-red-color-25', 'text-red-color');
    }
  }

  function hideMessage(el) {
    el.classList.add('hidden');
  }

  function setLoading(button, isLoading) {
    const spinner = button.querySelector('.spinner');
    if (spinner) spinner.classList.toggle('hidden', !isLoading);
    button.disabled = isLoading;
  }

  function setAvatarPreview(imgEl, containerEl, url) {
    if (url) {
      imgEl.src = url;
      imgEl.classList.remove('hidden');
    } else {
      imgEl.removeAttribute('src');
      imgEl.classList.add('hidden');
    }
  }

  function setHeaderAvatar(url) {
    const headerAvatar = document.getElementById('user-avatar');
    if (!headerAvatar) return;
    const headerImg = headerAvatar.querySelector('#user-avatar-img') || document.getElementById('user-avatar-img');
    if (!headerImg) return;
    setAvatarPreview(headerImg, headerAvatar, url);
  }

  // ===== بارگذاری پروفایل =====
  async function loadProfile() {
    try {
      const res = await fetch(`${API_BASE}/users/profile`, { headers: authHeaders() });
      if (!res.ok) return;
      const user = await res.json();

      document.getElementById('profileFullname').value = user.fullname || '';
      document.getElementById('profileEmail').value = user.email || '';

      const imgEl = document.getElementById('settings-avatar-img');
      const containerEl = document.getElementById('settings-avatar');
      setAvatarPreview(imgEl, containerEl, user.avatarUrl);
      originalAvatarUrl = user.avatarUrl || '';   // برای بازگشت در صورت خطای آپلود
    } catch (err) {
      console.warn('خطا در دریافت پروفایل:', err);
    }
  }

  // ===== ذخیره‌ی نام/ایمیل و سپس آپلود عکس =====
  function setupProfileForm() {
    const form = document.getElementById('profileForm');
    if (!form) return;

    const fullnameInput = document.getElementById('profileFullname');
    const emailInput = document.getElementById('profileEmail');
    const fullnameError = document.getElementById('profileFullnameError');
    const emailError = document.getElementById('profileEmailError');
    const messageEl = document.getElementById('profileMessage');
    const btn = document.getElementById('profileBtn');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideMessage(messageEl);
      fullnameError.classList.add('hidden');
      emailError.classList.add('hidden');

      const fullname = fullnameInput.value.trim();
      const email = emailInput.value.trim();

      let hasError = false;
      if (!fullname) {
        fullnameError.classList.remove('hidden');
        hasError = true;
      }
      if (!email || !email.includes('@')) {
        emailError.classList.remove('hidden');
        hasError = true;
      }
      if (hasError) return;

      setLoading(btn, true);
      try {
        const res = await fetch(`${API_BASE}/users/profile`, {
          method: 'PATCH',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ fullname, email }),
        });
        const data = await res.json();

        if (!res.ok) {
          showMessage(messageEl, data.message || 'خطا در ذخیره‌ی تغییرات', 'error');
          return;
        }

        let latestUser = data;
        if (pendingAvatarFile) {
          const avatarResult = await uploadPendingAvatar();
          if (avatarResult.ok) {
            latestUser = avatarResult.user;
          } else {
            showMessage(messageEl, 'نام و ایمیل ذخیره شد، ولی آپلود عکس با خطا مواجه شد', 'error');
            if (window.HesabinoHeader) window.HesabinoHeader.apply(latestUser);
            return;
          }
        }

        showMessage(messageEl, 'تغییرات با موفقیت ذخیره شد', 'success');
        if (window.HesabinoHeader) window.HesabinoHeader.apply(latestUser);
      } catch (err) {
        showMessage(messageEl, 'ارتباط با سرور برقرار نشد', 'error');
      } finally {
        setLoading(btn, false);
      }
    });
  }

  // ===== آپلود عکس و به‌روزرسانی آواتارها =====
  async function uploadPendingAvatar() {
    const errorEl = document.getElementById('avatarError');
    const imgEl = document.getElementById('settings-avatar-img');
    const containerEl = document.getElementById('settings-avatar');
    const noteEl = document.getElementById('avatarPendingNote');

    const formData = new FormData();
    formData.append('avatar', pendingAvatarFile);

    // آزاد کردن URL.createObjectURL قبلی (که برای پیش‌نمایش ساخته بودیم)
    if (imgEl.src.startsWith('blob:')) {
      URL.revokeObjectURL(imgEl.src);
    }

    try {
      const res = await fetch(`${API_BASE}/users/avatar`, {
        method: 'POST',
        headers: authHeaders(),
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        // بازگشت به عکس اصلی
        setAvatarPreview(imgEl, containerEl, originalAvatarUrl);
        pendingAvatarFile = null;
        if (noteEl) noteEl.classList.add('hidden');
        errorEl.textContent = data.message || 'خطا در آپلود عکس';
        errorEl.classList.remove('hidden');
        return { ok: false };
      }

      // آپلود موفق: جایگزینی عکس دائمی در تنظیمات و هدر
      setAvatarPreview(imgEl, containerEl, data.avatarUrl);
      setHeaderAvatar(data.avatarUrl);
      pendingAvatarFile = null;
      if (noteEl) noteEl.classList.add('hidden');
      // به‌روزرسانی آدرس اصلی برای دفعات بعد
      originalAvatarUrl = data.avatarUrl;

      return { ok: true, user: data };
    } catch (err) {
      // برگرداندن پیش‌نمایش در صورت خطای شبکه
      setAvatarPreview(imgEl, containerEl, originalAvatarUrl);
      pendingAvatarFile = null;
      if (noteEl) noteEl.classList.add('hidden');
      errorEl.textContent = 'ارتباط با سرور برقرار نشد';
      errorEl.classList.remove('hidden');
      return { ok: false };
    }
  }

  // ===== انتخاب عکس و نمایش پیش‌نمایش فقط در تنظیمات =====
  function setupAvatarUpload() {
    let input = document.getElementById('avatarInput');
    if (!input) return;

    // حذف هرگونه event listener قبلی (مثلاً در هدر) که ممکن است هدر را تغییر دهد
    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);
    input = newInput;

    const errorEl = document.getElementById('avatarError');
    const noteEl = document.getElementById('avatarPendingNote');
    const imgEl = document.getElementById('settings-avatar-img');
    const containerEl = document.getElementById('settings-avatar');

    input.addEventListener('change', () => {
      errorEl.classList.add('hidden');
      const file = input.files[0];
      if (!file) return;

      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        errorEl.textContent = 'فرمت عکس باید JPG، PNG یا WebP باشد';
        errorEl.classList.remove('hidden');
        input.value = '';
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        errorEl.textContent = 'حجم عکس نباید بیشتر از ۲ مگابایت باشد';
        errorEl.classList.remove('hidden');
        input.value = '';
        return;
      }

      // ذخیره فایل و نمایش پیش‌نمایش در تنظیمات
      pendingAvatarFile = file;
      if (noteEl) noteEl.classList.remove('hidden');

      // نمایش پیش‌نمایش محلی (فقط در settings-avatar-img)
      const localUrl = URL.createObjectURL(file);
      setAvatarPreview(imgEl, containerEl, localUrl);

      // پاک کردن مقدار input تا بتوان دوباره همان فایل را انتخاب کرد
      input.value = '';
    });
  }

  // ===== بقیه توابع (رمز عبور، حذف حساب) بدون تغییر =====
  function setupPasswordForm() {
    const form = document.getElementById('passwordForm');
    if (!form) return;

    const currentInput = document.getElementById('currentPassword');
    const newInput = document.getElementById('newPassword');
    const confirmInput = document.getElementById('confirmPassword');
    const currentError = document.getElementById('currentPasswordError');
    const newError = document.getElementById('newPasswordError');
    const confirmError = document.getElementById('confirmPasswordError');
    const messageEl = document.getElementById('passwordMessage');
    const btn = document.getElementById('passwordBtn');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideMessage(messageEl);
      [currentError, newError, confirmError].forEach((el) => el.classList.add('hidden'));

      const currentPassword = currentInput.value;
      const newPassword = newInput.value;
      const confirmPassword = confirmInput.value;

      let hasError = false;
      if (!currentPassword) {
        currentError.classList.remove('hidden');
        hasError = true;
      }
      if (!newPassword || newPassword.length < 6) {
        newError.classList.remove('hidden');
        hasError = true;
      }
      if (confirmPassword !== newPassword) {
        confirmError.classList.remove('hidden');
        hasError = true;
      }
      if (hasError) return;

      setLoading(btn, true);
      try {
        const res = await fetch(`${API_BASE}/users/password`, {
          method: 'PATCH',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ currentPassword, newPassword }),
        });
        const data = await res.json();

        if (!res.ok) {
          showMessage(messageEl, data.message || 'خطا در تغییر رمز عبور', 'error');
          return;
        }

        showMessage(messageEl, 'رمز عبور با موفقیت تغییر کرد', 'success');
        form.reset();
      } catch (err) {
        showMessage(messageEl, 'ارتباط با سرور برقرار نشد', 'error');
      } finally {
        setLoading(btn, false);
      }
    });
  }

  function setupDeleteAccount() {
    const btn = document.getElementById('deleteAccountBtn');
    if (!btn) return;

    const messageEl = document.getElementById('deleteAccountMessage');

    btn.addEventListener('click', async () => {
      const confirmed = await window.HesabinoUI.confirmDialog(
        'آیا از حذف حساب کاربری خود مطمئن هستید؟ این عمل غیرقابل بازگشت است.',
        { title: 'حذف حساب کاربری' },
      );
      if (!confirmed) return;

      btn.disabled = true;
      try {
        const res = await fetch(`${API_BASE}/users/me`, {
          method: 'DELETE',
          headers: authHeaders(),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          showMessage(messageEl, data.message || 'خطا در حذف حساب کاربری', 'error');
          btn.disabled = false;
          return;
        }

        localStorage.removeItem('access_token');
        window.location.href = '/login';
      } catch (err) {
        showMessage(messageEl, 'ارتباط با سرور برقرار نشد', 'error');
        btn.disabled = false;
      }
    });
  }

  function onReady() {
    loadProfile().finally(() => window.HesabinoUI && window.HesabinoUI.hidePageLoader && window.HesabinoUI.hidePageLoader());
    setupProfileForm();
    setupAvatarUpload();
    setupPasswordForm();
    setupDeleteAccount();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }
})();