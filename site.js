// Bellissimo Geni shared site helpers (no dependencies).
(function () {
  // Mobile menu (progressive enhancement; works on all pages with .mobile-nav-toggle).
  document.addEventListener('DOMContentLoaded', function () {
    var toggle = document.querySelector('.mobile-nav-toggle');
    var menu = document.querySelector('.mobile-menu');
    if (toggle && menu) {
      toggle.addEventListener('click', function () {
        var open = menu.classList.toggle('open');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    }
    var year = document.querySelector('[data-year]');
    if (year) year.textContent = new Date().getFullYear();
  });

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  async function loadJSON(path) {
    var res = await fetch(path, { cache: 'no-store' });
    if (!res.ok) throw new Error('Could not load ' + path);
    return res.json();
  }

  function dogById(dogs, id) {
    if (!id) return null;
    var q = String(id).toLowerCase();
    return (dogs || []).find(function (d) { return String(d.id).toLowerCase() === q; }) || null;
  }

  window.BG = { esc: esc, loadJSON: loadJSON, dogById: dogById };
})();
