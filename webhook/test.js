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
  lockDecision,
  r2MediaKeyFromUrl
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

  const badForm = new FormData();
  badForm.append('file', new File(['<html>bad</html>'], 'fake.jpg', { type: 'text/html' }));
  const rejected = await worker.fetch(new Request('https://worker.example/admin/api/upload', {
    method: 'POST',
    headers: { Authorization: 'Bearer secret' },
    body: badForm
  }), env);
  assert.equal(rejected.status, 400);

  const media = await worker.fetch(new Request(uploaded.publicUrl), env);
  assert.equal(media.status, 200);
  assert.equal(media.headers.get('content-type'), 'image/webp');
  assert.equal(await media.text(), 'image-bytes');
});


test('public API edge cache avoids repeat KV reads', async () => {
  const oldCaches = globalThis.caches;
  let getCalls = 0;
  const cacheStore = new Map();
  globalThis.caches = {
    default: {
      async match(req) { return cacheStore.get(req.url)?.clone() || undefined; },
      async put(req, res) { cacheStore.set(req.url, res.clone()); }
    }
  };
  const env = {
    ADMIN: {
      async get(key) {
        getCalls++;
        if (key === 'admin:snapshot:admin-dogs') {
          return JSON.stringify([{ id: 'dog-1', name: 'Dog One', publishStatus: 'published' }]);
        }
        return null;
      },
      async put() {},
      async delete() {}
    }
  };
  try {
    const first = await worker.fetch(new Request('https://worker.example/api/dogs'), env);
    const second = await worker.fetch(new Request('https://worker.example/api/dogs'), env);
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(getCalls, 1);
  } finally {
    globalThis.caches = oldCaches;
  }
});

test('public APIs are cacheable and cache-busting query strings do not touch KV', async () => {
  let getCalls = 0;
  const env = {
    ADMIN: {
      async get(key) {
        getCalls++;
        if (key === 'admin:snapshot:admin-dogs') {
          return JSON.stringify([{ id: 'dog-1', name: 'Dog One', publishStatus: 'published' }]);
        }
        return null;
      },
      async put() {},
      async delete() {}
    }
  };

  const clean = await worker.fetch(new Request('https://worker.example/api/dogs'), env);
  assert.equal(clean.status, 200);
  assert.equal(clean.headers.get('Cache-Control'), 'public, max-age=300, stale-if-error=86400');
  assert.equal(getCalls, 1);

  const beforeRedirect = getCalls;
  const redirected = await worker.fetch(new Request('https://worker.example/api/dogs?cachebust=123'), env);
  assert.equal(redirected.status, 308);
  assert.equal(redirected.headers.get('Location'), 'https://worker.example/api/dogs');
  assert.equal(getCalls, beforeRedirect);
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


test('admin login throttles failures and logout revokes the session', async () => {
  const store = new Map();
  const env = {
    ADMIN_PASSWORD: 'correct-password',
    ADMIN: {
      async get(key) { return store.has(key) ? store.get(key) : null; },
      async put(key, value) { store.set(key, String(value)); },
      async delete(key) { store.delete(key); },
      async list({ prefix = '' } = {}) {
        return { keys: [...store.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), cursor: null };
      }
    }
  };

  for (let i = 0; i < 5; i++) {
    const bad = await worker.fetch(new Request('https://worker.example/admin/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.5' },
      body: JSON.stringify({ password: 'wrong' })
    }), env);
    assert.equal(bad.status, 401);
  }

  const blocked = await worker.fetch(new Request('https://worker.example/admin/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.5' },
    body: JSON.stringify({ password: 'correct-password' })
  }), env);
  assert.equal(blocked.status, 429);

  const login = await worker.fetch(new Request('https://worker.example/admin/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.6' },
    body: JSON.stringify({ password: 'correct-password' })
  }), env);
  assert.equal(login.status, 200);
  const { token } = await login.json();
  assert.match(token, /^session-[0-9a-f]{48}$/);

  const logout = await worker.fetch(new Request('https://worker.example/admin/api/logout', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token }
  }), env);
  assert.equal(logout.status, 200);
  assert.equal(store.has('admin:session:' + token), false);
});

test('KV collections use bulk reads in chunks of at most 100 keys', async () => {
  const ids = Array.from({ length: 101 }, (_, i) => 'dog-' + i);
  const store = new Map([
    ['admin:index:admin:dogs', JSON.stringify(ids)],
    ...ids.map(id => ['admin:dogs:' + id, JSON.stringify({ id, name: id, publishStatus: 'published' })])
  ]);
  const bulkCalls = [];
  const env = {
    ADMIN: {
      async get(key) {
        if (Array.isArray(key)) {
          bulkCalls.push(key.slice());
          return new Map(key.map(k => [k, store.get(k) || null]));
        }
        return store.get(key) || null;
      }
    }
  };

  const res = await worker.fetch(new Request('https://worker.example/api/dogs'), env);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.dogs.length, 101);
  assert.deepEqual(bulkCalls.map(keys => keys.length), [100, 1]);
});

test('owner admin sees drafts while public APIs keep them hidden', async () => {
  const store = new Map([
    ['admin:dogs:draft-dog', JSON.stringify({ id: 'draft-dog', name: 'Draft Dog', publishStatus: 'draft' })],
    ['admin:index:admin:dogs', JSON.stringify(['draft-dog'])]
  ]);
  const env = {
    ADMIN_PASSWORD: 'secret',
    ADMIN: {
      async get(key) { return store.has(key) ? store.get(key) : null; },
      async put(key, value) { store.set(key, String(value)); },
      async delete(key) { store.delete(key); },
      async list({ prefix = '' } = {}) {
        return { keys: [...store.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), cursor: null };
      }
    }
  };

  const admin = await worker.fetch(new Request('https://worker.example/admin/api/dogs', {
    headers: { Authorization: 'Bearer secret' }
  }), env);
  assert.equal(admin.status, 200);
  assert.equal((await admin.json()).data.length, 1);

  const publicRes = await worker.fetch(new Request('https://worker.example/api/dogs'), env);
  assert.equal(publicRes.status, 200);
  assert.equal((await publicRes.json()).dogs.length, 0);
});


test('R2 media key parsing only accepts managed upload paths', () => {
  assert.equal(r2MediaKeyFromUrl('https://worker.example/uploads/media/dog.webp'), 'media/dog.webp');
  assert.equal(r2MediaKeyFromUrl('media/dog.webp'), 'media/dog.webp');
  assert.equal(r2MediaKeyFromUrl('assets/dogs/legacy.webp'), '');
  assert.equal(r2MediaKeyFromUrl('https://example.test/photo.webp'), '');
});

test('permanent dog photo delete removes unused Cloudflare upload from R2', async () => {
  const store = new Map([
    ['admin:dogs:dog-1', JSON.stringify({
      id: 'dog-1',
      name: 'Dog One',
      photo: 'https://worker.example/uploads/media/old.webp',
      gallery: ['https://worker.example/uploads/media/extra.webp'],
      photoHistory: ['https://worker.example/uploads/media/old.webp']
    })],
    ['admin:index:admin:dogs', JSON.stringify(['dog-1'])],
    ['admin:index:admin:puppies', JSON.stringify([])],
    ['admin:index:admin:gallery', JSON.stringify([])]
  ]);
  let deletedKey = '';
  const env = {
    ADMIN_PASSWORD: 'secret',
    ADMIN: {
      async get(key) { return store.has(key) ? store.get(key) : null; },
      async put(key, value) { store.set(key, String(value)); },
      async delete(key) { store.delete(key); }
    },
    UPLOADS: {
      async delete(key) { deletedKey = key; }
    }
  };

  const res = await worker.fetch(new Request('https://worker.example/admin/api/media-delete', {
    method: 'DELETE',
    headers: { Authorization: 'Bearer secret', 'Content-Type': 'application/json' },
    body: JSON.stringify({ dogId: 'dog-1', url: 'https://worker.example/uploads/media/old.webp' })
  }), env);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.deleted, true);
  assert.equal(deletedKey, 'media/old.webp');

  const dog = JSON.parse(store.get('admin:dogs:dog-1'));
  assert.equal(dog.photo, '');
  assert.deepEqual(dog.photoHistory, []);
  assert.deepEqual(dog.gallery, ['https://worker.example/uploads/media/extra.webp']);
});

test('permanent delete detaches legacy dog photo without claiming repo deletion', async () => {
  const store = new Map([
    ['admin:dogs:dog-1', JSON.stringify({
      id: 'dog-1',
      name: 'Dog One',
      photo: 'assets/dogs/legacy.webp',
      gallery: [],
      photoHistory: ['assets/dogs/legacy.webp']
    })],
    ['admin:index:admin:dogs', JSON.stringify(['dog-1'])],
    ['admin:index:admin:puppies', JSON.stringify([])],
    ['admin:index:admin:gallery', JSON.stringify([])]
  ]);
  const env = {
    ADMIN_PASSWORD: 'secret',
    ADMIN: {
      async get(key) { return store.has(key) ? store.get(key) : null; },
      async put(key, value) { store.set(key, String(value)); },
      async delete(key) { store.delete(key); }
    }
  };

  const res = await worker.fetch(new Request('https://worker.example/admin/api/media-delete', {
    method: 'DELETE',
    headers: { Authorization: 'Bearer secret', 'Content-Type': 'application/json' },
    body: JSON.stringify({ dogId: 'dog-1', url: 'assets/dogs/legacy.webp' })
  }), env);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.deleted, false);
  assert.equal(body.reason, 'repository_asset');
  const dog = JSON.parse(store.get('admin:dogs:dog-1'));
  assert.equal(dog.photo, '');
  assert.deepEqual(dog.photoHistory, []);
});


test('bootstrap reuses manually created pedigree ancestors by name', async () => {
  const store = new Map([
    ['admin:dogs:dog-manual-terror', JSON.stringify({
      id: 'dog-manual-terror',
      name: 'Terror Levan En Una Palabra',
      sex: 'Male',
      group: 'current',
      status: 'Bellissimo Geni dog',
      sireId: null,
      damId: null
    })],
    ['admin:index:admin:dogs', JSON.stringify(['dog-manual-terror'])]
  ]);
  const env = {
    ADMIN_PASSWORD: 'secret',
    ADMIN: {
      async get(key) { return store.has(key) ? store.get(key) : null; },
      async put(key, value) { store.set(key, String(value)); },
      async delete(key) { store.delete(key); }
    }
  };

  const payload = {
    dogs: [
      {
        id: 'terror-levan-en-una-palabra',
        name: 'Terror Levan En Una Palabra',
        sex: 'Male',
        registration: 'JR 700881 Cc',
        group: 'ancestor',
        status: 'Pedigree ancestor',
        sireId: 'hermes',
        damId: 'dafne'
      },
      {
        id: 'hermes',
        name: 'Hermes',
        sex: 'Male',
        group: 'ancestor',
        status: 'Pedigree ancestor'
      },
      {
        id: 'dafne',
        name: 'Dafne',
        sex: 'Female',
        group: 'ancestor',
        status: 'Pedigree ancestor'
      },
      {
        id: 'explosion-custodi-nos',
        name: 'Explosion Custodi Nos',
        sex: 'Male',
        group: 'ancestor',
        status: 'Pedigree ancestor',
        sireId: 'terror-levan-en-una-palabra',
        damId: null
      }
    ],
    puppies: [],
    litters: [],
    gallery: []
  };

  const boot = await worker.fetch(new Request('https://worker.example/admin/api/bootstrap', {
    method: 'POST',
    headers: { Authorization: 'Bearer secret', 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }), env);
  assert.equal(boot.status, 200);

  assert.equal(store.has('admin:dogs:terror-levan-en-una-palabra'), false);
  const terror = JSON.parse(store.get('admin:dogs:dog-manual-terror'));
  assert.equal(terror.group, 'ancestor');
  assert.equal(terror.status, 'Pedigree ancestor');
  assert.equal(terror.registration, 'JR 700881 Cc');
  assert.equal(terror.sireId, 'hermes');
  assert.equal(terror.damId, 'dafne');

  const explosion = JSON.parse(store.get('admin:dogs:explosion-custodi-nos'));
  assert.equal(explosion.sireId, 'dog-manual-terror');
});


test('bootstrap reuses pedigree ancestors by registration despite name variation', async () => {
  const store = new Map([
    ['admin:dogs:manual-uno', JSON.stringify({
      id: 'manual-uno',
      name: 'UNO DE NOBIL ROSE COR A',
      registration: 'CORA6336-18/343',
      group: 'ancestor',
      status: 'Pedigree ancestor',
      sireId: null,
      damId: null
    })],
    ['admin:index:admin:dogs', JSON.stringify(['manual-uno'])]
  ]);
  const env = {
    ADMIN_PASSWORD: 'secret',
    ADMIN: {
      async get(key) { return store.has(key) ? store.get(key) : null; },
      async put(key, value) { store.set(key, String(value)); },
      async delete(key) { store.delete(key); }
    }
  };

  const payload = {
    dogs: [
      {
        id: 'uno-de-nobil-rose-cor-a',
        name: 'Uno De Nobil Rose',
        registration: 'CORA 6336-18/343',
        group: 'ancestor',
        status: 'Pedigree ancestor',
        sireId: 'gylan-rayla-di-cors',
        damId: 'vincitore-nero-nyssa'
      },
      { id:'gylan-rayla-di-cors', name:'Gylan Rayla Di Cors', group:'ancestor', status:'Pedigree ancestor' },
      { id:'vincitore-nero-nyssa', name:'Vincitore Nero Nyssa', group:'ancestor', status:'Pedigree ancestor' },
      {
        id: 'roman-custodi-nos',
        name: 'Roman Custodi Nos',
        registration: 'JR 708956 Cc',
        group: 'ancestor',
        status: 'Pedigree ancestor',
        sireId: 'uno-de-nobil-rose-cor-a',
        damId: null
      }
    ],
    puppies: [], litters: [], gallery: []
  };

  const boot = await worker.fetch(new Request('https://worker.example/admin/api/bootstrap', {
    method:'POST',
    headers:{ Authorization:'Bearer secret', 'Content-Type':'application/json' },
    body:JSON.stringify(payload)
  }), env);
  assert.equal(boot.status, 200);

  assert.equal(store.has('admin:dogs:uno-de-nobil-rose-cor-a'), false);
  const uno = JSON.parse(store.get('admin:dogs:manual-uno'));
  assert.equal(uno.sireId, 'gylan-rayla-di-cors');
  assert.equal(uno.damId, 'vincitore-nero-nyssa');

  const roman = JSON.parse(store.get('admin:dogs:roman-custodi-nos'));
  assert.equal(roman.sireId, 'manual-uno');
});
