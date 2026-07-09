document.addEventListener('DOMContentLoaded', () => {
  const sidebar = document.getElementById('sidebar');
  const gridContainer = document.getElementById('app-grid');
  const toggleBtn = document.getElementById('sidebar-toggle');
  const toggleIcon = document.getElementById('toggle-icon');
  const menuTexts = document.querySelectorAll('.menu-text');
  const menuItems = document.querySelectorAll('.menu-item');
  const mobileHamburger = document.getElementById('mobile-hamburger');
  const sidebarClose = document.getElementById('sidebar-close');
  const overlay = document.getElementById('sidebar-overlay');

  if (!sidebar || !gridContainer) return;

  const gridExpanded = 'grid-cols-[14rem_1fr]';
  const gridCollapsed = 'grid-cols-[6rem_1fr]';

  // خواندن وضعیت ذخیره شده
  let isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';

  function collapseSidebar() {
    gridContainer.classList.replace(gridExpanded, gridCollapsed);

    menuTexts.forEach(t => t.classList.add('hidden'));

    menuItems.forEach(item => {
      item.classList.replace('justify-start', 'justify-center');
      item.classList.replace('px-6', 'px-0');
    });

    toggleIcon?.classList.add('rotate-180');

    toggleBtn?.classList.remove('right-[14rem]');
    toggleBtn?.classList.add('right-[6rem]');
  }

  function expandSidebar() {
    gridContainer.classList.replace(gridCollapsed, gridExpanded);

    menuTexts.forEach(t => t.classList.remove('hidden'));

    menuItems.forEach(item => {
      item.classList.replace('justify-center', 'justify-start');
      item.classList.replace('px-0', 'px-6');
    });

    toggleIcon?.classList.remove('rotate-180');

    toggleBtn?.classList.remove('right-[6rem]');
    toggleBtn?.classList.add('right-[14rem]');
  }

  // ===== Toggle دسکتاپ =====
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      isCollapsed = !isCollapsed;

      if (isCollapsed) {
        collapseSidebar();
      } else {
        expandSidebar();
      }

      // ذخیره وضعیت
      localStorage.setItem('sidebarCollapsed', isCollapsed);
    });
  }

  // ===== Active link =====
  const currentPath = window.location.pathname;
  menuItems.forEach(item => {
    const link = item.querySelector('a');
    if (link && new URL(link.href).pathname === currentPath) {
      item.classList.add('active');
    }
  });

  // ===== موبایل =====
  function openMobile() {
    sidebar.classList.remove('hidden', 'translate-x-full');
    sidebar.classList.add('translate-x-0');
    overlay.classList.remove('hidden');
    document.documentElement.classList.add('overflow-hidden');
    document.body.classList.add('overflow-hidden');
  }

  function closeMobile() {
    sidebar.classList.add('translate-x-full');
    sidebar.classList.remove('translate-x-0');
    overlay.classList.add('hidden');
    document.documentElement.classList.remove('overflow-hidden');
    document.body.classList.remove('overflow-hidden');

    setTimeout(() => {
      if (!sidebar.classList.contains('translate-x-0')) {
        sidebar.classList.add('hidden');
      }
    }, 300);
  }

  mobileHamburger?.addEventListener('click', (e) => {
    e.stopPropagation();
    openMobile();
  });

  sidebarClose?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeMobile();
  });

  overlay?.addEventListener('click', closeMobile);

  document.addEventListener('click', (e) => {
    if (!sidebar.contains(e.target) && !mobileHamburger?.contains(e.target)) {
      if (!overlay.classList.contains('hidden')) {
        closeMobile();
      }
    }
  });

  // ===== مدیریت تغییر اندازه =====
  function handleResize() {
    const isMobile = window.innerWidth < 768;

    if (!isMobile) {
      overlay.classList.add('hidden');

      gridContainer.classList.remove('grid-cols-1');

      if (isCollapsed) {
        gridContainer.classList.add(gridCollapsed);
        gridContainer.classList.remove(gridExpanded);
        collapseSidebar();
      } else {
        gridContainer.classList.add(gridExpanded);
        gridContainer.classList.remove(gridCollapsed);
        expandSidebar();
      }

      sidebar.classList.remove(
        'translate-x-full',
        'translate-x-0',
        'hidden'
      );

      document.documentElement.classList.remove('overflow-hidden');
      document.body.classList.remove('overflow-hidden');

    } else {
      gridContainer.classList.remove(gridExpanded, gridCollapsed);
      gridContainer.classList.add('grid-cols-1');

      if (overlay.classList.contains('hidden')) {
        sidebar.classList.add('translate-x-full', 'hidden');
        sidebar.classList.remove('translate-x-0');
      }
    }
  }

  window.addEventListener('resize', handleResize);

  // اعمال وضعیت ذخیره شده در اولین بار
  handleResize();
});