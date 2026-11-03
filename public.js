/* Public navigation and illustrative demo; no account, tracking or payment calls. */
(() => {
  'use strict';
  document.documentElement.classList.add('marketing-ready');
  const toggle = document.querySelector('[data-menu-toggle]');
  const nav = document.querySelector('#site-navigation');
  if (toggle && nav) {
    const close = () => { toggle.setAttribute('aria-expanded', 'false'); nav.removeAttribute('data-open'); };
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      nav.toggleAttribute('data-open', open);
    });
    nav.addEventListener('click', event => { if (event.target.closest('a')) close(); });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { close(); toggle.focus(); }
    });
    window.matchMedia('(min-width:821px)').addEventListener('change', close);
  }
  const demo = document.querySelector('[data-product-demo]');
  if (!demo) return;
  const tabs = [...demo.querySelectorAll('[data-demo-tab]')];
  function show(tab, focus = false) {
    tabs.forEach(item => {
      const active = item === tab;
      item.setAttribute('aria-selected', String(active));
      item.tabIndex = active ? 0 : -1;
      const panel = document.getElementById(item.getAttribute('aria-controls'));
      if (panel) panel.hidden = !active;
    });
    if (focus) tab.focus();
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => show(tab));
    tab.addEventListener('keydown', event => {
      const target = event.key === 'ArrowRight' ? tabs[(index + 1) % tabs.length]
        : event.key === 'ArrowLeft' ? tabs[(index - 1 + tabs.length) % tabs.length]
        : event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs.at(-1) : null;
      if (target) { event.preventDefault(); show(target, true); }
    });
  });
  const tablist = demo.querySelector('[data-demo-tabs]');
  if (tablist) { tablist.setAttribute('role', 'tablist'); tablist.hidden = false; }
  tabs.forEach(tab => tab.setAttribute('role', 'tab'));
  demo.querySelectorAll('[data-demo-pane]').forEach(panel => panel.setAttribute('role', 'tabpanel'));
  if (tabs[0]) show(tabs[0]);
})();
