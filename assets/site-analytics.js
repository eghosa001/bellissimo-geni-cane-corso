// Public Cloudflare beacon token identifies this site; it grants no API access.
(() => {
  if (location.hostname !== 'bellissimogeni.com' || location.pathname.startsWith('/admin')) return;
  if (document.querySelector('script[data-cf-beacon]')) return;
  const script = document.createElement('script');
  script.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  script.defer = true;
  script.setAttribute('data-cf-beacon', JSON.stringify({ token: '3235003177f948ee83599e5e1761c649' }));
  document.head.appendChild(script);
})();
