// ALLEVAMENTO BELLISSIMO GENI shared site helpers (no dependencies).
(function () {
  var CONTACT = {
    phoneDisplay: '+234 913 780 6866',
    phoneDigits: '2349137806866',
    email: 'Bellissimogenicanecorso@gmail.com',
    whatsappDirect: 'https://wa.me/message/YSFP25LSDD7AP1'
  };

  // Mobile menu (progressive enhancement; works on all pages with .mobile-nav-toggle).
  document.addEventListener('DOMContentLoaded', function () {
    var siteName = 'ALLEVAMENTO BELLISSIMO GENI';
    document.querySelectorAll('.brand b,.footer-brand b,.legacy-brand-copy b,.legacy-footer strong').forEach(function (el) {
      el.textContent = siteName;
    });
    document.title = document.title
      .replace(/Bellissimo Geni Cane Corso/gi, siteName)
      .replace(/^Bellissimo Geni\s*\|/i, siteName + ' |');

    if (!document.querySelector('.skip-link')) {
      var a = document.createElement('a');
      a.href = '#main';
      a.className = 'skip-link';
      a.textContent = 'Skip to content';
      document.body.insertBefore(a, document.body.firstChild);
    }
    var main = document.querySelector('main');
    if (main && !main.id) main.id = 'main';
    var header = document.querySelector('.site-header');
    if (header && !header.querySelector('.mobile-quick-links')) {
      var quick = document.createElement('nav');
      quick.className = 'mobile-quick-links';
      quick.setAttribute('aria-label', 'Quick links');
      quick.innerHTML = '<a href="dogs.html">Our Dogs</a><a href="puppies.html">Puppies</a>';
      var reserve = header.querySelector('.nav-cta');
      header.insertBefore(quick, reserve || null);
    }

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

    document.querySelectorAll('[data-bg-phone]').forEach(function (el) {
      el.textContent = CONTACT.phoneDisplay;
      if (el.tagName === 'A') el.href = 'tel:+' + CONTACT.phoneDigits;
    });
    document.querySelectorAll('[data-bg-email]').forEach(function (el) {
      el.textContent = CONTACT.email;
      if (el.tagName === 'A') el.href = 'mailto:' + CONTACT.email;
    });
    document.querySelectorAll('[data-bg-whatsapp]').forEach(function (el) {
      if (el.tagName === 'A') el.href = CONTACT.whatsappDirect;
    });
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
      .replace(/>/g, '&gt;').replace(/\"/g, '&quot;');
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

  // Data loader — tries public API first (no auth), then admin API with stored token, then local JSON
  function loadAdminJSON(path, fallbackPath) {
    var apiBase = window.BG_WEBHOOK_URL || '';
    if (apiBase) {
      // Step 1: Try unauthenticated public endpoint (/api/dogs, /api/puppies, etc.)
      return fetch(apiBase + '/api/' + path, { headers: { 'Accept': 'application/json' } })
        .then(function(r) { if (r.ok) return r.json(); throw new Error('public_fail'); })
        .catch(function() {
          // Step 2: Try authenticated admin endpoint if token exists
          var token = window._bgAdminToken || '';
          if (token) {
            return fetch(apiBase + '/admin/api/' + path, {
              headers: Object.assign({ 'Accept': 'application/json' }, token ? { 'Authorization': 'Bearer ' + token } : {})
            }).then(function(r) { if (r.ok) return r.json(); throw new Error('admin_fail'); });
          }
          // Step 3: Fall back to local JSON file
          if (fallbackPath) return fetch(fallbackPath).then(function(r) { return r.json(); });
          throw new Error('no_data');
        });
    }
    if (fallbackPath) return fetch(fallbackPath).then(function(r) { return r.json(); });
    throw new Error('no_data');
  }

  function whatsappMessage(text) {
    return 'https://wa.me/' + CONTACT.phoneDigits + '?text=' + encodeURIComponent(String(text || ''));
  }

  window.BG = {
    esc: esc,
    loadJSON: loadJSON,
    loadAdminJSON: loadAdminJSON,
    dogById: dogById,
    validPhone: validPhone,
    track: track,
    contact: CONTACT,
    whatsappMessage: whatsappMessage
  };
})();
