// Bellissimo Geni shared site helpers (no dependencies).
(function () {
  // Mobile menu (progressive enhancement; works on all pages with .mobile-nav-toggle).
  document.addEventListener('DOMContentLoaded', function () {
    if (!document.querySelector('.skip-link')) {
      var a = document.createElement('a');
      a.href = '#main';
      a.className = 'skip-link';
      a.textContent = 'Skip to content';
      document.body.insertBefore(a, document.body.firstChild);
    }
    var main = document.querySelector('main');
    if (main && !main.id) main.id = 'main';
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
    initReveal();
  });

  function initReveal() {
    var selectors = '.section-heading,.feature-strip,.grid-3,.grid-2,.feature-grid,.gallery-grid,.steps,.pedigree-feature,.profile,.testi,.quote';
    var els = document.querySelectorAll(selectors);
    if (!els.length) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add('js-reveal', 'is-in');
          io.unobserve(en.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    els.forEach(function (el) { io.observe(el); });
  }

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

  function validPhone(s) {
    var digits = String(s || '').replace(/\D/g, '');
    return digits.length >= 7 && digits.length <= 15;
  }

  function track(type, label) {
    try {
      var key = 'bg_analytics';
      var arr = JSON.parse(localStorage.getItem(key) || '[]');
      arr.push({ t: type, l: String(label || '').slice(0, 80), at: new Date().toISOString() });
      localStorage.setItem(key, JSON.stringify(arr.slice(-200)));
    } catch (_) {}
  }

  // Admin API data loader — falls back to local JSON if API unavailable
  function loadAdminJSON(path, fallbackPath) {
    var apiBase = window.BG_WEBHOOK_URL || '';
    if (apiBase) {
      return fetch(apiBase + '/admin/api/' + path, { headers: { 'Accept': 'application/json' } })
        .then(function(r) { if (r.ok) return r.json(); throw new Error('api_fail'); })
        .catch(function() { if (fallbackPath) return fetch(fallbackPath).then(function(r) { return r.json(); }); throw new Error('no_data'); });
    }
    if (fallbackPath) return fetch(fallbackPath).then(function(r) { return r.json(); });
    throw new Error('no_data');
  }

  window.BG = { esc: esc, loadJSON: loadJSON, loadAdminJSON: loadAdminJSON, dogById: dogById, validPhone: validPhone, track: track };
})();
