import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function render(data) {
  const context = { window: {}, Intl, apiFetch: async () => data };
  vm.createContext(context);
  const path = new URL('../assets/admin-visits.js', import.meta.url);
  if (fs.existsSync(path)) vm.runInContext(fs.readFileSync(path, 'utf8'), context);
  assert.equal(typeof context.window.renderVisits, 'function', 'Visits renderer must be available');
  return context.window.renderVisits(7);
}

test('Visits displays empty traffic separately from provider errors', async () => {
  const empty = await render({ ok: true, totals: { visits: 0, pageViews: 0 }, daily: [], pages: [], countries: [] });
  assert.match(empty, /No visits recorded/);
  const error = await render({ ok: false, error: 'analytics_unavailable' });
  assert.match(error, /temporarily unavailable/);
  assert.doesNotMatch(error, /No visits recorded/);
});

test('Visits escapes untrusted page paths and includes accessible daily values', async () => {
  const html = await render({ ok: true, totals: { visits: 4, pageViews: 12 },
    daily: [{ date: '2026-09-27', visits: 4, pageViews: 12 }],
    pages: [{ path: '/<img src=x onerror=alert(1)>', pageViews: 12 }],
    countries: [{ country: 'NG', pageViews: 12 }] });
  assert.ok(!html.includes('<img src=x'));
  assert.match(html, /&lt;img/);
  assert.match(html, /4 visits, 12 page views/);
  assert.match(html, /Nigeria/);
  assert.match(html, /value="30"/);
});

test('tracking loads once on production public pages and excludes admin and previews', () => {
  const path = new URL('../assets/site-analytics.js', import.meta.url);
  const source = fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';
  for (const [hostname, pathname, expected] of [
    ['bellissimogeni.com', '/', 1], ['bellissimogeni.com', '/dogs.html', 1],
    ['bellissimogeni.com', '/admin.html', 0], ['localhost', '/', 0], ['eghosa001.github.io', '/', 0]
  ]) {
    const loaded = [];
    const context = { location: { hostname, pathname }, document: {
      querySelector: () => loaded[0],
      createElement: () => ({ setAttribute() {} }),
      head: { appendChild: el => loaded.push(el) }
    } };
    vm.createContext(context);
    vm.runInContext(source, context);
    vm.runInContext(source, context);
    assert.equal(loaded.length, expected, hostname + pathname);
    if (expected) assert.equal(loaded[0].src, 'https://static.cloudflareinsights.com/beacon.min.js');
  }
});
