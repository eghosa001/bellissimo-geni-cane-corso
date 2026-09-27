import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './handler.js';

const env = { ADMIN_PASSWORD: 'test-password', CLOUDFLARE_ANALYTICS_TOKEN: 'private-test-token' };
const request = (suffix = '', token = 'test-password') => new Request('https://worker.example/admin/api/analytics' + suffix, {
  headers: token ? { Authorization: 'Bearer ' + token } : {}
});

test('analytics rejects unauthenticated and invalid credentials', async () => {
  for (const token of ['', 'wrong-password']) {
    const response = await worker.fetch(request('', token), env);
    assert.equal(response.status, 401);
  }
});

test('analytics reports missing configuration without pretending traffic is zero', async () => {
  const response = await worker.fetch(request(), { ADMIN_PASSWORD: env.ADMIN_PASSWORD });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, 'analytics_not_configured');
});

test('analytics rejects unsupported ranges', async () => {
  assert.equal((await worker.fetch(request('?days=365'), env)).status, 400);
});

test('analytics returns totals, complete daily buckets and ranked breakdowns', async t => {
  const today = new Date().toISOString().slice(0, 10);
  let queryBody;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://api.cloudflare.com/client/v4/graphql');
    queryBody = JSON.parse(options.body);
    return Response.json({ data: { viewer: { accounts: [{
      totals: [{ count: 12, sum: { visits: 4 } }],
      daily: [{ dimensions: { date: today }, count: 12, sum: { visits: 4 } }],
      pages: [{ dimensions: { requestPath: '/dogs.html' }, count: 8 }],
      countries: [{ dimensions: { countryName: 'NG' }, count: 10 }]
    }] } } });
  });
  const response = await worker.fetch(request('?days=7'), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  const data = await response.json();
  assert.deepEqual(data.totals, { pageViews: 12, visits: 4 });
  assert.equal(data.daily.length, 7);
  assert.equal(data.daily[0].pageViews, 0);
  assert.equal(data.daily[6].visits, 4);
  assert.deepEqual(data.pages, [{ path: '/dogs.html', pageViews: 8 }]);
  assert.deepEqual(data.countries, [{ country: 'NG', pageViews: 10 }]);
  assert.equal(queryBody.variables.filter.requestHost, 'bellissimogeni.com');
  assert.equal(queryBody.variables.filter.requestPath_notlike, '/admin%');
  assert.equal(queryBody.variables.filter.bot, 0);
  assert.ok(!JSON.stringify(data).includes(env.CLOUDFLARE_ANALYTICS_TOKEN));
});

test('analytics handles an empty report as zero traffic for all 30 days', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ data: { viewer: { accounts: [{ totals: [], daily: [], pages: [], countries: [] }] } } }));
  const response = await worker.fetch(request('?days=30'), env);
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.daily.length, 30);
  assert.deepEqual(data.totals, { pageViews: 0, visits: 0 });
});

test('analytics upstream failures never become successful empty reports or leak errors', async t => {
  for (const body of [{ errors: [{ message: 'sensitive provider failure' }] }, { data: { viewer: { accounts: [] } } }]) {
    const mock = t.mock.method(globalThis, 'fetch', async () => Response.json(body));
    const response = await worker.fetch(request(), env);
    assert.equal(response.status, 502);
    assert.equal((await response.json()).error, 'analytics_unavailable');
    mock.mock.restore();
  }
});
