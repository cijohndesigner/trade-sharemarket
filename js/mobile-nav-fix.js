/* Stable mobile navigation override.
   The main app contains legacy sidebar listeners; use one delegated capture handler
   so duplicate listeners cannot immediately re-open/close the drawer. */
(function () {
  'use strict';
  const MOBILE_QUERY = '(max-width: 991.98px)';
  const isMobile = () => window.matchMedia(MOBILE_QUERY).matches;

  function syncButton(open) {
    document.querySelectorAll('#menuToggle').forEach(function (button) {
      button.setAttribute('aria-expanded', String(open));
      button.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
      const icon = button.querySelector('span');
      if (icon) icon.textContent = open ? '\u2715' : '\u2630';
    });
  }

  function setOpen(open) {
    const body = document.body;
    if (!body || !isMobile()) return;
    body.classList.toggle('sidebar-open', !!open);
    body.classList.remove('sidebar-collapsed');
    syncButton(!!open);
  }

  function closeOnStartup() {
    if (isMobile()) setOpen(false);
    else {
      document.body.classList.remove('sidebar-open');
      syncButton(false);
    }
  }

  function init() {
    closeOnStartup();
    // Some legacy scripts modify the sidebar classes after DOMContentLoaded.
    // Reassert the closed initial state briefly, without interfering with user clicks.
    [50, 180, 450].forEach(function (delay) {
      window.setTimeout(function () {
        if (isMobile() && !document.body.dataset.mobileMenuUserActed) setOpen(false);
      }, delay);
    });

    document.addEventListener('click', function (event) {
      const target = event.target instanceof Element ? event.target : null;
      if (!target || !isMobile()) return;

      const toggle = target.closest('#menuToggle');
      if (toggle) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        document.body.dataset.mobileMenuUserActed = '1';
        setOpen(!document.body.classList.contains('sidebar-open'));
        return;
      }

      if (target.closest('#mobileSidebarClose')) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        document.body.dataset.mobileMenuUserActed = '1';
        setOpen(false);
        return;
      }

      if (target.closest('.sidebar-backdrop')) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        document.body.dataset.mobileMenuUserActed = '1';
        setOpen(false);
        return;
      }

      if (target.closest('.glass-sidebar .nav-link')) {
        setOpen(false);
      }
    }, true);

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && isMobile()) {
        document.body.dataset.mobileMenuUserActed = '1';
        setOpen(false);
      }
    }, true);

    window.addEventListener('resize', function () {
      if (!isMobile()) {
        document.body.classList.remove('sidebar-open');
        document.body.dataset.mobileMenuUserActed = '';
        syncButton(false);
      } else {
        setOpen(false);
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
