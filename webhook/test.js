import test from 'node:test';
import assert from 'node:assert/strict';
import worker, {
  STATUS,
  strip,
  normalizePhone,
  validPhone,
  validEmail,
  validRef,
  validateReservation,
  verifyRefTimestamp,
  nextStatus,
  lockDecision
} from './handler.js';

test('strip removes zero-width chars', () => {
  assert.equal(strip('a\u200Bb\u200Cc'), 'abc');
  assert.equal(strip(undefined), '');
});

test('phone normalization', () => {
  assert.equal(normalizePhone('0800 000 0000'), '08000000000');
  assert.equal(normalizePhone('+2348000000000'), '08000000000');
  assert.equal(validPhone('2348000000000'), true);
  assert.equal(validPhone('123'), false);
});

test('email validation', () => {
  assert.equal(validEmail(''), true);
  assert.equal(validEmail('foo@bar.com'), true);
  assert.equal(validEmail('foo@bar'), false);
});

test('ref validation', () => {
  assert.equal(validRef('bg-2026-abcd'), 'BG-2026-ABCD');
  assert.equal(validRef('whatever'), '');
});

test('reservation validation', () => {
  const ok = validateReservation({ name: 'A <script>Name</script>', phone: '2348030000000', email: '', puppy: 'tornado-male', message: 'hello'.repeat(200) });
  assert.deepEqual(ok.errors, []);
  assert.ok(!ok.name.includes('<') && !ok.name.includes('>'));
  assert.equal(ok.message.length, 500);
  const bad = validateReservation({ name: 'x', phone: '12', email: 'nope', puppy: '' });
  assert.deepEqual(bad.errors.sort(), ['email', 'name', 'phone', 'puppy']);
});

test('timestamp skew', () => {
  assert.equal(verifyRefTimestamp(new Date().toISOString(), 600000), true);
  assert.equal(verifyRefTimestamp('2020-01-01T00:00:00Z', 600000), false);
  assert.equal(verifyRefTimestamp('garbage', 600000), false);
});

test('status transitions', () => {
  assert.equal(nextStatus(STATUS.REQUESTED, { payment_initiated: true }), STATUS.PAYMENT_PENDING);
  assert.equal(nextStatus(STATUS.REQUESTED, {}), STATUS.REQUESTED);
  assert.equal(nextStatus(STATUS.PAYMENT_PENDING, { payment_confirmed: true }), STATUS.RESERVED);
  assert.equal(nextStatus(STATUS.RESERVED, { cancelled: true }), STATUS.CANCELLED);
  assert.equal(nextStatus(STATUS.RESERVED, { balance_paid: true }), STATUS.SOLD);
  assert.equal(nextStatus(STATUS.SOLD, {}), STATUS.SOLD);
});

test('puppy lock decisions', () => {
  const now = Date.now();
  assert.deepEqual(lockDecision(null, now).granted, true);
  assert.deepEqual(lockDecision({ status: STATUS.SOLD, ref: 'BG-2026-X1', until: 0 }, now), { granted: false, reason: 'sold', holder: 'BG-2026-X1' });
  assert.deepEqual(lockDecision({ status: STATUS.RESERVED, ref: 'BG-2026-X2', until: 0 }, now).granted, false);
  assert.deepEqual(lockDecision({ status: STATUS.CANCELLED, ref: 'BG-2026-X3', until: 0 }, now).granted, true);
  assert.deepEqual(lockDecision({ status: STATUS.PAYMENT_PENDING, ref: 'BG-2026-X4', until: now + 60000 }, now).granted, false);
  assert.deepEqual(lockDecision({ status: STATUS.PAYMENT_PENDING, ref: 'BG-2026-X5', until: now - 1000 }, now).granted, true);
});

test('remote admin CORS is present on preflight and JSON responses', async () => {
  const preflight = await worker.fetch(new Request('https://worker.example/admin/api/login', {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://eghosa001.github.io',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'authorization,content-type'
    }
  }), {});
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), '*');
  assert.match(preflight.headers.get('Access-Control-Allow-Headers') || '', /authorization/i);
  assert.match(preflight.headers.get('Access-Control-Allow-Headers') || '', /content-type/i);

  const health = await worker.fetch(new Request('https://worker.example/webhook/health'), {});
  assert.equal(health.status, 200);
  assert.equal(health.headers.get('Access-Control-Allow-Origin'), '*');
});


test('uploaded R2 media is served through the Worker', async () => {
  const stored = new Map();
  const env = {
    UPLOADS: {
      async put(key, body, options) {
        stored.set(key, { bytes: await new Response(body).arrayBuffer(), options });
      },
      async get(key) {
        const item = stored.get(key);
        if (!item) return null;
        return {
          body: item.bytes,
          httpMetadata: item.options && item.options.httpMetadata || {},
          writeHttpMetadata(headers) {
            const type = this.httpMetadata && this.httpMetadata.contentType;
            if (type) headers.set('content-type', type);
          }
        };
      }
    },
    ADMIN: {
      async get() { return null; },
      async put() {},
      async delete() {},
      async list() { return { keys: [], list_complete: true }; }
    },
    ADMIN_PASSWORD: 'secret'
  };

  const form = new FormData();
  form.append('file', new File(['image-bytes'], 'dog.webp', { type: 'image/webp' }));
  const upload = await worker.fetch(new Request('https://worker.example/admin/api/upload', {
    method: 'POST',
    headers: { Authorization: 'Bearer secret' },
    body: form
  }), env);
  assert.equal(upload.status, 200);
  const uploaded = await upload.json();
  assert.match(uploaded.publicUrl || '', /^https:\/\/worker\.example\/uploads\/media\//);

  const media = await worker.fetch(new Request(uploaded.publicUrl), env);
  assert.equal(media.status, 200);
  assert.equal(media.headers.get('content-type'), 'image/webp');
  assert.equal(await media.text(), 'image-bytes');
});


test('admin content query route reaches the content handler', async () => {
  const env = {
    ADMIN_PASSWORD: 'test-password',
    ADMIN: {
      get: async () => null,
      put: async () => {},
      delete: async () => {},
      list: async () => ({ keys: [], cursor: null })
    }
  };
  const res = await worker.fetch(new Request('https://worker.example/admin/api/content?page=about', {
    headers: { Authorization: 'Bearer test-password' }
  }), env);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.data.publishStatus, 'published');
});


test('bootstrap preserves verified record IDs and makes them public', async () => {
  const store = new Map();
  const env = {
    ADMIN_PASSWORD: 'secret',
    ADMIN: {
      async get(key) { return store.has(key) ? store.get(key) : null; },
      async put(key, value) { store.set(key, String(value)); },
      async delete(key) { store.delete(key); },
      async list({ prefix = '' } = {}) {
        return {
          keys: [...store.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })),
          cursor: null,
          list_complete: true
        };
      }
    }
  };
  const payload = {
    dogs: [{ id: 'verified-dog', name: 'Verified Dog', publishStatus: 'published' }],
    puppies: [{ id: 'verified-pup', name: 'Verified Pup', status: 'AVAILABLE', publishStatus: 'published' }],
    litters: [],
    gallery: [{ id: 'verified-photo', url: 'https://example.test/photo.webp', publishStatus: 'published' }]
  };
  const boot = await worker.fetch(new Request('https://worker.example/admin/api/bootstrap', {
    method: 'POST',
    headers: { Authorization: 'Bearer secret', 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }), env);
  assert.equal(boot.status, 200);
  const bootBody = await boot.json();
  assert.equal(bootBody.ok, true);

  const dogs = await worker.fetch(new Request('https://worker.example/api/dogs'), env);
  assert.equal(dogs.status, 200);
  const dogBody = await dogs.json();
  assert.equal(dogBody.dogs[0].id, 'verified-dog');

  const pups = await worker.fetch(new Request('https://worker.example/api/puppies'), env);
  assert.equal(pups.status, 200);
  const pupBody = await pups.json();
  assert.equal(pupBody.puppies[0].id, 'verified-pup');
  assert.equal(pupBody.gallery[0].id, 'verified-photo');
});


test('bootstrap runs only once even if an owner later empties a collection', async () => {
  const store = new Map();
  const env = {
    ADMIN_PASSWORD: 'secret',
    ADMIN: {
      async get(key) { return store.has(key) ? store.get(key) : null; },
      async put(key, value) { store.set(key, String(value)); },
      async delete(key) { store.delete(key); },
      async list({ prefix = '' } = {}) {
        return {
          keys: [...store.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })),
          cursor: null,
          list_complete: true
        };
      }
    }
  };

  const callBootstrap = dogs => worker.fetch(new Request('https://worker.example/admin/api/bootstrap', {
    method: 'POST',
    headers: { Authorization: 'Bearer secret', 'Content-Type': 'application/json' },
    body: JSON.stringify({ dogs, puppies: [], litters: [], gallery: [] })
  }), env);

  const first = await callBootstrap([{ id: 'original-dog', name: 'Original Dog' }]);
  assert.equal(first.status, 200);
  assert.equal(store.has('admin:dogs:original-dog'), true);

  store.delete('admin:dogs:original-dog');

  const second = await callBootstrap([{ id: 'replacement-dog', name: 'Replacement Dog' }]);
  assert.equal(second.status, 200);
  const secondBody = await second.json();
  assert.equal(secondBody.alreadySeeded, true);
  assert.equal(store.has('admin:dogs:replacement-dog'), false);
});
