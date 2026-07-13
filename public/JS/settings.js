(function () {
  'use strict';

  const API_BASE = '';

  // فایل عکسی که انتخاب شده ولی هنوز با دکمه‌ی «ذخیره تغییرات» ارسال نشده
  let pendingAvatarFile = null;
  let pendingPreviewUrl = null;

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

  // ===== قرار دادن مستقیم عکس توی آواتار هدر (div#user-avatar > img#user-avatar-img) =====
  function setHeaderAvatar(url) {
    const headerAvatar = document.getElementById('user-avatar');
    if (!headerAvatar) return;
    const headerImg = headerAvatar.querySelector('#user-avatar-img') || document.getElementById('user-avatar-img');
    if (!headerImg) return;
    setAvatarPreview(headerImg, headerAvatar, url);
  }

  // ===== بارگذاری اطلاعات فعلی کاربر =====
  async function loadProfile() {
    try {
      const res = await fetch(`${API_BASE}/users/profile`, { headers: authHeaders() });
      if (!res.ok) return;
      const user = await res.json();

      document.getElementById('profileFullname').value = user.fullname || '';
      document.getElementById('profileEmail').value = user.email || '';
      setAvatarPreview(
        document.getElementById('settings-avatar-img'),
        document.getElementById('settings-avatar'),
        user.avatarUrl,
      );
    } catch (err) {
      console.warn('خطا در دریافت پروفایل:', err);
    }
  }

  // ===== ذخیره‌ی نام/ایمیل =====
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

        // اگه عکس جدیدی انتخاب شده بود ولی هنوز آپلود نشده، همین الان (موقع ذخیره) آپلودش می‌کنیم
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

  // ===== آپلود واقعی عکسِ در انتظار، روی سرور (فقط موقع زدن دکمه‌ی ذخیره صدا زده می‌شه) =====
  async function uploadPendingAvatar() {
    const errorEl = document.getElementById('avatarError');
    const imgEl = document.getElementById('settings-avatar-img');
    const containerEl = document.getElementById('settings-avatar');
    const noteEl = document.getElementById('avatarPendingNote');

    const formData = new FormData();
    formData.append('avatar', pendingAvatarFile);

    try {
      const res = await fetch(`${API_BASE}/users/avatar`, {
        method: 'POST',
        headers: authHeaders(), // توجه: Content-Type رو دستی ست نمی‌کنیم تا مرورگر boundary مالتی‌پارت رو خودش بسازه
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        errorEl.textContent = data.message || 'خطا در آپلود عکس';
        errorEl.classList.remove('hidden');
        return { ok: false };
      }

      // آدرس نهایی و دائمی سرور رو جایگزین پیش‌نمایش موقت می‌کنیم
      setAvatarPreview(imgEl, containerEl, data.avatarUrl);
      setHeaderAvatar(data.avatarUrl);
      if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
      pendingAvatarFile = null;
      pendingPreviewUrl = null;
      if (noteEl) noteEl.classList.add('hidden');

      return { ok: true, user: data };
    } catch (err) {
      errorEl.textContent = 'ارتباط با سرور برقرار نشد';
      errorEl.classList.remove('hidden');
      return { ok: false };
    }
  }

  // ===== انتخاب عکس پروفایل (فقط پیش‌نمایش؛ آپلود واقعی موقع زدن دکمه‌ی ذخیره انجام می‌شه) =====
  function setupAvatarUpload() {
    const input = document.getElementById('avatarInput');
    if (!input) return;

    const errorEl = document.getElementById('avatarError');
    const imgEl = document.getElementById('settings-avatar-img');
    const containerEl = document.getElementById('settings-avatar');
    const noteEl = document.getElementById('avatarPendingNote');

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

      // پیش‌نمایش فوری و محلی، هم توی خود صفحه‌ی تنظیمات هم توی هدر؛ ولی هنوز چیزی به سرور فرستاده نمی‌شه
      if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
      pendingAvatarFile = file;
      pendingPreviewUrl = URL.createObjectURL(file);

      setAvatarPreview(imgEl, containerEl, pendingPreviewUrl);
      setHeaderAvatar(pendingPreviewUrl);
      if (noteEl) noteEl.classList.remove('hidden');

      input.value = '';
    });
  }

  // ===== تغییر رمز عبور =====
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

  // ===== حذف حساب کاربری =====
  function setupDeleteAccount() {
    const btn = document.getElementById('deleteAccountBtn');
    if (!btn) return;

    const messageEl = document.getElementById('deleteAccountMessage');

    btn.addEventListener('click', async () => {
      const confirmed = window.confirm('آیا از حذف حساب کاربری خود مطمئن هستید؟ این عمل غیرقابل بازگشت است.');
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
    loadProfile();
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