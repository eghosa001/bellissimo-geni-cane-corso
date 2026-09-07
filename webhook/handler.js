export const STATUS = Object.freeze({
  REQUESTED: 'REQUESTED',
  PAYMENT_PENDING: 'PAYMENT_PENDING',
  RESERVED: 'RESERVED',
  SOLD: 'SOLD',
  CANCELLED: 'CANCELLED'
});

export const REF_PATTERN = /^BG-\d{4}-[A-Z0-9]{4}$/;
const ZW_RE = /[\u200B-\u200D\uFEFF]/g;
const RATE_IP_MAX = 10;
const RATE_IP_WINDOW = 60 * 60 * 1000;
const RATE_PHONE_MAX = 5;
const RATE_PHONE_WINDOW = 24 * 60 * 60 * 1000;

// ─── Admin KV namespace keys ────────────────────────────────────────────────
const ADMIN_KEYS = {
  dogs:        'admin:dogs',
  puppies:     'admin:puppies',
  litters:     'admin:litters',
  testimonials:'admin:testimonials',
  settings:    'admin:settings',
  gallery:     'admin:gallery',
};
const AUDIT_LOG_KEY = 'admin:audit:log';
const CONTENT_PREFIX = 'admin:content:';
const MAX_AUDIT_LOGS = 500;

// ─── Helpers ─────────────────────────────────────────────────────────────────
export function strip(zero) {
  return String(zero == null ? '' : zero).replace(ZW_RE, '');
}

export function normalizePhone(raw) {
  let s = strip(raw).replace(/[^\d+]/g, '');
  if (s.startsWith('+')) s = s.slice(1);
  if (s.startsWith('234') && s.length === 13) s = '0' + s.slice(3);
  return /^\d{7,15}$/.test(s) ? s : '';
}

export function validPhone(raw) {
  return normalizePhone(raw).length > 0;
}

export function validEmail(raw) {
  const s = strip(raw).trim();
  return s === '' || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}

export function validRef(ref) {
  const r = strip(ref).trim().toUpperCase();
  return REF_PATTERN.test(r) ? r : '';
}

export function makeRef(now) {
  const d = now || new Date();
  const set = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'.split('');
  let tail = '';
  const rng = new Uint32Array(4);
  crypto.getRandomValues(rng);
  for (let i = 0; i < 4; i++) tail += set[rng[i] % set.length];
  return 'BG-' + d.getFullYear() + '-' + tail;
}

export function sanitizeText(raw, max) {
  const s = strip(raw).replace(/[<>]/g, '').trim();
  return s.slice(0, max || 500);
}

export function validateReservation(input) {
  const errors = [];
  const name = sanitizeText(input && input.name, 120);
  if (name.length < 2) errors.push('name');
  const phone = normalizePhone(input && input.phone);
  if (!phone) errors.push('phone');
  const email = validEmail(input && input.email) ? strip(input.email).trim() : '';
  if (!validEmail(input && input.email)) errors.push('email');
  const puppy = sanitizeText(input && input.puppy, 60);
  if (!puppy) errors.push('puppy');
  const message = sanitizeText(input && input.message, 500);
  return { name, phone, email, puppy, message, errors };
}

export function verifyRefTimestamp(timestamp, skewMs) {
  const t = Date.parse(String(timestamp == null ? '' : timestamp));
  if (Number.isNaN(t)) return false;
  return Math.abs(Date.now() - t) <= (skewMs || 10 * 60 * 1000);
}

export function nextStatus(current, event) {
  switch (current) {
    case STATUS.REQUESTED:
      return event.payment_initiated ? STATUS.PAYMENT_PENDING : STATUS.REQUESTED;
    case STATUS.PAYMENT_PENDING:
      return event.payment_confirmed ? STATUS.RESERVED : STATUS.PAYMENT_PENDING;
    case STATUS.RESERVED:
      if (event.cancelled) return STATUS.CANCELLED;
      if (event.balance_paid) return STATUS.SOLD;
      return STATUS.RESERVED;
    default:
      return current;
  }
}

export function lockDecision(current, now) {
  if (!current) return { granted: true };
  if (current.status === STATUS.SOLD) return { granted: false, reason: 'sold', holder: current.ref };
  if (current.status === STATUS.RESERVED) return { granted: false, reason: 'reserved', holder: current.ref };
  if (current.status === STATUS.CANCELLED) return { granted: true, previous: current.ref };
  if (Number(current.until) && Number(current.until) > now) return { granted: false, reason: 'held', holder: current.ref };
  return { granted: true, expired: true, previous: current.ref };
}

export async function verifyRecaptcha(secret, token, action) {
  if (!secret) return { passed: true, skipped: true };
  const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret, response: String(token || '') })
  });
  const j = await res.json();
  const ok = j && j.success === true && j.score != null && j.score >= 0.5 && (!action || j.action === action);
  return { passed: ok, skipped: false, score: j.score, hostname: j.hostname };
}

function json(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

async function readJson(request) {
  try { return await request.json(); } catch (e) { return null; }
}

async function kvGet(env, key) {
  try {
    const raw = await env.ADMIN.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

async function kvPut(env, key, value) {
  try {
    await env.ADMIN.put(key, JSON.stringify(value));
    return true;
  } catch (e) { return false; }
}

async function kvList(env, prefix) {
  const results = [];
  let cursor;
  do {
    const page = await env.ADMIN.list({ prefix, limit: 100, cursor });
    for (const item of page.keys) {
      const raw = await env.ADMIN.get(item.name);
      if (raw) results.push(JSON.parse(raw));
    }
    cursor = page.cursor;
  } while (cursor);
  return results;
}

async function notify(env, record) {
  if (!env.NOTIFY_URL) return;
  fetch(env.NOTIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: record.last_event, ref: record.ref, status: record.status, puppy: record.puppy })
  }).catch(() => {});
}

async function checkRate(env, rawKey, max, windowMs) {
  if (!env.ADMIN) return { ok: true };
  const key = 'rate:' + strip('' + rawKey);
  const now = Date.now();
  let rec = null;
  try {
    const raw = await env.ADMIN.get(key);
    if (raw) rec = JSON.parse(raw);
  } catch (e) {}
  const cur = rec && Number(rec.until) > now ? rec : { count: 0, until: now + windowMs };
  if (cur.count >= max) return { ok: false, retryAfter: Math.max(1, Math.ceil((Number(cur.until) - now) / 1000)) };
  await env.ADMIN.put(key, JSON.stringify({ count: cur.count + 1, until: cur.until }), { expirationTtl: Math.ceil((cur.until - now) / 1000) + 60 });
  return { ok: true };
}

function holdMs(env) {
  const h = Number(env.RESERVATION_HOLD_HOURS || 72);
  return (Number.isFinite(h) && h > 0 ? h : 72) * 60 * 60 * 1000;
}

// ─── Admin auth middleware ───────────────────────────────────────────────────
function isAdminRequest(request) {
  const url = new URL(request.url);
  return url.pathname.startsWith('/admin/api/');
}

function adminAuth(request, env) {
  const pw = env.ADMIN_PASSWORD;
  if (!pw) return { ok: false, reason: 'unconfigured' };
  const auth = request.headers.get('Authorization') || '';
  if (auth === 'Bearer ' + pw) return { ok: true };
  return { ok: false, reason: 'unauthorized' };
}

// ─── Audit logging ───────────────────────────────────────────────────────────
async function auditLog(env, action, entity, entityId, details) {
  try {
    const raw = await env.ADMIN.get(AUDIT_LOG_KEY);
    const logs = raw ? JSON.parse(raw) : [];
    logs.unshift({ id: 'log-' + Date.now(), action, entity, entityId, details: details || {}, at: new Date().toISOString() });
    if (logs.length > MAX_AUDIT_LOGS) logs.length = MAX_AUDIT_LOGS;
    await env.ADMIN.put(AUDIT_LOG_KEY, JSON.stringify(logs));
  } catch (_) {}
}

// ─── Draft / publish filtering ────────────────────────────────────────────────
function filterPublished(items, params) {
  const showAll = params && params.get('status') === 'all';
  if (showAll) return items;
  return items.filter(i => i.publishStatus !== 'draft');
}

function ensurePublishStatus(record) {
  if (record.publishStatus === undefined) record.publishStatus = 'published';
  return record;
}

// ─── Puppy Lock DO ───────────────────────────────────────────────────────────
export class PuppyLock {
  constructor(state) { this.state = state; }
  async fetch(request) {
    let body = null;
    try { body = await request.json(); } catch (e) {}
    const op = body && body.op;
    const ref = String(body && body.ref || '').toUpperCase();
    if (request.method === 'GET') {
      const s = await this.state.storage.get('state');
      return json(200, { ok: true, held: !!(s && s.holder && s.until > Date.now()), holder: s && s.holder || null });
    }
    if (op === 'claim') {
      const now = Date.now();
      const holdMs = Number(body && body.holdMs) || 72 * 60 * 60 * 1000;
      const s = await this.state.storage.get('state');
      const d = lockDecision(s, now);
      if (!d.granted) return json(409, { ok: false, reason: d.reason, holder: d.holder });
      await this.state.storage.put('state', { holder: ref, status: STATUS.PAYMENT_PENDING, until: now + holdMs });
      return json(200, { ok: true });
    }
    if (op === 'mark') {
      const s = await this.state.storage.get('state');
      if (!s || s.holder !== ref) return json(409, { ok: false });
      const status = String(body && body.status || '').toUpperCase();
      const next = status === STATUS.RESERVED ? { ...s, status: STATUS.RESERVED, until: 0 }
                 : status === STATUS.SOLD   ? { ...s, status: STATUS.SOLD,   until: 0 }
                 : s;
      await this.state.storage.put('state', next);
      return json(200, { ok: true });
    }
    if (op === 'check') {
      const s = await this.state.storage.get('state');
      const current = !!(s && s.holder === ref && {
        [STATUS.RESERVED]: true, [STATUS.SOLD]: true,
        [STATUS.PAYMENT_PENDING]: s.until > Date.now(), [STATUS.REQUESTED]: s.until > Date.now()
      }[s.status]);
      return json(200, { ok: true, current });
    }
    if (op === 'release') {
      const s = await this.state.storage.get('state');
      if (s && s.holder === ref) {
        await this.state.storage.put('state', { ...s, status: STATUS.CANCELLED, until: 0 });
        return json(200, { ok: true });
      }
      return json(200, { ok: false });
    }
    return json(400, { ok: false, error: 'bad_op' });
  }
}

async function lockClient(env, puppyKey, ref, holdMs, op, status) {
  if (!env.PUPPY_LOCK) return { ok: true, disabled: true };
  try {
    const id = env.PUPPY_LOCK.idFromName('puppy:' + String(puppyKey).toLowerCase());
    const stub = env.PUPPY_LOCK.get(id);
    const res = await stub.fetch('http://puppy/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op, ref, holdMs, status: status || null })
    });
    return await res.json();
  } catch (e) { return { ok: false, error: 'lock_unavailable' }; }
}

// ─── Payment helpers (unchanged from original) ────────────────────────────────
async function initiatePayment(env, data) {
  const provider = String(env.PAYMENT_PROVIDER || 'none').trim().toLowerCase();
  const amount = Number(env.RESERVATION_AMOUNT || 0);
  const currency = String(env.PAYMENT_CURRENCY || 'NGN').trim().toUpperCase();
  if (!data.ref || !amount) return { provider: 'none', payment_url: null, provider_ref: null };
  if (provider === 'paystack') {
    if (!env.PAYSTACK_SECRET) return { provider, payment_url: null, provider_ref: null, error: 'unconfigured' };
    const body = {
      email: data.email || 'reserve@bellissimogeni.example',
      amount: Math.round(amount * 100),
      currency,
      reference: data.ref,
      callback_url: env.PAYMENT_RETURN_URL || '',
      metadata: { ref: data.ref, puppy: data.puppy }
    };
    const res = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + env.PAYSTACK_SECRET, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const j = await res.json();
    return j && j.status ? { provider, payment_url: j.data.authorization_url, provider_ref: data.ref }
                        : { provider, payment_url: null, provider_ref: null, error: 'provider_rejected' };
  }
  return { provider: 'none', payment_url: null, provider_ref: null };
}

async function hmacVerify(secret, body, expected) {
  if (!secret || !expected) return false;
  try {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
    const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
    const got = btoa(String.fromCharCode.apply(null, new Uint8Array(mac)));
    return got === expected;
  } catch (e) { return false; }
}

async function verifyPaystack(env, raw, headers) {
  const sig = headers.get('x-paystack-signature') || '';
  const ok = await hmacVerify(env.PAYSTACK_SECRET, raw, sig);
  if (!ok) return { verified: false };
  const j = JSON.parse(raw);
  if (j.event !== 'charge.success') return { verified: true, handled: false, ref: j.data && (j.data.reference || j.data.reference_code) };
  return { verified: true, handled: true, ref: j.data && j.data.reference, amount: Number(j.data.amount) / 100, currency: j.data.currency };
}

async function verifyFlutterwave(env, raw) {
  if (!env.FLUTTERWAVE_SECRET) return { verified: false };
  const j = JSON.parse(raw);
  const txId = j && (j.data && j.data.id || j.id);
  if (!txId) return { verified: false };
  const res = await fetch('https://api.flutterwave.com/v3/transactions/' + encodeURIComponent(txId) + '/verify', {
    headers: { Authorization: 'Bearer ' + env.FLUTTERWAVE_SECRET }
  });
  const t = await res.json();
  const d = t && t.data;
  if (!d || d.status !== 'successful') return { verified: false };
  return { verified: true, handled: true, ref: d.tx_ref, amount: Number(d.amount), currency: d.currency };
}

function parseCatalog(env) {
  if (!env.PUPPY_CATALOG) return null;
  try {
    const list = JSON.parse(env.PUPPY_CATALOG);
    if (Array.isArray(list)) return list.map(x => String(x).toLowerCase());
  } catch (e) {}
  return null;
}

// ─── Reservation handlers (webhook) ──────────────────────────────────────────
async function handleReserve(req, env) {
  const input = await readJson(req);
  if (!input) return json(400, { ok: false, error: 'bad_json' });
  if (String(input.action) !== 'reserve') return json(400, { ok: false, error: 'bad_action' });
  const data = input.data && input.data;
  if (!data) return json(400, { ok: false, error: 'missing_data' });
  const norm = validateReservation(data);
  if (norm.errors.length) return json(422, { ok: false, error: 'validation', fields: norm.errors });
  const catalog = parseCatalog(env);
  if (catalog && !catalog.includes(String(norm.puppy).toLowerCase())) return json(422, { ok: false, error: 'puppy_unknown' });
  if (!verifyRefTimestamp(input.timestamp)) return json(400, { ok: false, error: 'stale_timestamp' });
  const ip = req.headers.get('CF-Connecting-IP') || req.headers.get('x-forwarded-for') || '';
  const ipRate = await checkRate(env, 'ip:' + ip, RATE_IP_MAX, RATE_IP_WINDOW);
  if (!ipRate.ok) return json(429, { ok: false, error: 'rate_limited', retryAfter: ipRate.retryAfter });
  const phoneRate = await checkRate(env, 'phone:' + norm.phone, RATE_PHONE_MAX, RATE_PHONE_WINDOW);
  if (!phoneRate.ok) return json(429, { ok: false, error: 'rate_limited', retryAfter: phoneRate.retryAfter });
  const ref = validRef(data.ref) || makeRef();
  const existing = await kvGet(env, 'reservation:' + ref);
  if (existing) {
    if (existing.status === STATUS.CANCELLED) return json(409, { ok: false, error: 'ref_cancelled' });
    return json(200, { ok: true, ref, status: existing.status, payment_url: existing.payment_url || null });
  }
  const lock = await lockClient(env, norm.puppy, ref, holdMs(env), 'claim');
  if (!lock.ok) return json(409, { ok: false, error: 'puppy_unavailable', reason: lock.reason || null });
  const cap = await verifyRecaptcha(env.RECAPTCHA_SECRET, input.token, 'reserve');
  if (!cap.passed && !cap.skipped) return json(403, { ok: false, error: 'captcha_failed', score: cap.score });
  const payment = await initiatePayment(env, Object.assign({}, norm, { ref }));
  const status = payment.payment_url ? STATUS.PAYMENT_PENDING : STATUS.REQUESTED;
  const record = {
    ref, puppy: norm.puppy, name: norm.name, phone: norm.phone,
    email: norm.email, message: norm.message, ip: ip || null,
    status, payment_url: payment.payment_url || null,
    provider: payment.provider || 'none', provider_ref: payment.provider_ref || null,
    created_at: new Date().toISOString(),
    hold_until: new Date(Date.now() + holdMs(env)).toISOString()
  };
  const stored = await kvPut(env, 'reservation:' + ref, record);
  if (!stored) {
    await lockClient(env, norm.puppy, ref, 0, 'release');
    return json(500, { ok: false, error: 'storage_error' });
  }
  await notify(env, Object.assign({}, record, { last_event: 'reservation_requested' }));
  return json(211, { ok: true, ref, status, payment_url: payment.payment_url || null, provider: record.provider });
}

async function handlePayment(req, env) {
  const provider = String(env.PAYMENT_PROVIDER || 'none').trim().toLowerCase();
  const raw = await req.text();
  let verified = { verified: false };
  try {
    if (provider === 'paystack') verified = await verifyPaystack(env, raw, req.headers);
    else if (provider === 'flutterwave') verified = await verifyFlutterwave(env, raw);
  } catch (e) { verified = { verified: false }; }
  if (!verified.verified) return json(401, { ok: false, error: 'bad_signature' });
  if (!verified.handled) return json(200, { ok: true, handled: false });
  const ref = validRef(verified.ref);
  if (!ref) return json(400, { ok: false, error: 'unknown_ref' });
  const record = await kvGet(env, 'reservation:' + ref);
  if (!record) return json(404, { ok: false, error: 'not_found' });
  if (record.status !== STATUS.PAYMENT_PENDING) return json(200, { ok: true, ref, status: record.status, ignored: true });
  const expected = Number(env.RESERVATION_AMOUNT || 0);
  const paidAmount = Number(verified.amount);
  if (expected && (!Number.isFinite(paidAmount) || Math.abs(paidAmount - expected) > 0.01)) {
    return json(402, { ok: false, error: 'amount_mismatch', received: paidAmount });
  }
  const expectedCurrency = String(env.PAYMENT_CURRENCY || 'NGN').trim().toUpperCase();
  if (verified.currency && String(verified.currency).toUpperCase() !== expectedCurrency) {
    return json(402, { ok: false, error: 'currency_mismatch', received: verified.currency });
  }
  const ownerCheck = await lockClient(env, record.puppy, ref, 0, 'check');
  if (ownerCheck.ok === false) return json(409, { ok: false, error: 'lock_unavailable' });
  if (ownerCheck.current === false) return json(409, { ok: false, error: 'puppy_lock_lost' });
  const status = nextStatus(record.status, { payment_confirmed: true });
  const updated = Object.assign({}, record, { status, paid_amount: paidAmount, paid_currency: verified.currency, paid_at: new Date().toISOString() });
  const stored = await kvPut(env, 'reservation:' + ref, updated);
  if (!stored) return json(500, { ok: false, error: 'storage_error' });
  await lockClient(env, record.puppy, ref, 0, 'mark', status);
  await notify(env, Object.assign({}, updated, { last_event: 'payment_confirmed' }));
  return json(200, { ok: true, ref, status });
}

// ─── Admin CRUD handlers ─────────────────────────────────────────────────────
async function handleAdminDogs(req, env) {
  const auth = adminAuth(req, env);
  if (!auth.ok) return json(401, { ok: false, error: auth.reason });
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  const showAll = url.searchParams.get('status') === 'all';

  if (req.method === 'GET') {
    if (id) {
      const dogs = await kvList(env, ADMIN_KEYS.dogs + ':');
      const dog = dogs.find(d => d.id === id);
      return json(200, dog ? { ok: true, data: ensurePublishStatus(dog) } : { ok: false, error: 'not_found' });
    }
    const dogs = await kvList(env, ADMIN_KEYS.dogs + ':');
    const published = filterPublished(dogs, { get: () => showAll ? 'all' : null });
    return json(200, { ok: true, data: published.sort((a, b) => a.name.localeCompare(b.name)) });
  }

  if (req.method === 'POST') {
    const body = await readJson(req);
    if (!body) return json(400, { ok: false, error: 'bad_json' });
    const dogs = await kvList(env, ADMIN_KEYS.dogs + ':');
    if (id) {
      const idx = dogs.findIndex(d => d.id === id);
      if (idx === -1) return json(404, { ok: false, error: 'not_found' });
      const updated = { ...dogs[idx], ...body, id };
      ensurePublishStatus(updated);
      await kvPut(env, ADMIN_KEYS.dogs + ':' + id, updated);
      await auditLog(env, 'update', 'dog', id, { name: updated.name, publishStatus: updated.publishStatus });
      return json(200, { ok: true, data: updated });
    }
    const newId = 'dog-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    const dog = { id: newId, sireId: body.sireId || null, damId: body.damId || null, ...body };
    ensurePublishStatus(dog);
    await kvPut(env, ADMIN_KEYS.dogs + ':' + newId, dog);
    await auditLog(env, 'create', 'dog', newId, { name: dog.name, publishStatus: dog.publishStatus });
    return json(201, { ok: true, data: dog });
  }

  if (req.method === 'DELETE' && id) {
    const dogs = await kvList(env, ADMIN_KEYS.dogs + ':');
    const dog = dogs.find(d => d.id === id);
    await env.ADMIN.delete(ADMIN_KEYS.dogs + ':' + id);
    if (dog) await auditLog(env, 'delete', 'dog', id, { name: dog.name });
    return json(200, { ok: true });
  }

  return json(405, { ok: false, error: 'method_not_allowed' });
}

async function handleAdminPuppies(req, env) {
  const auth = adminAuth(req, env);
  if (!auth.ok) return json(401, { ok: false, error: auth.reason });
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  const showAll = url.searchParams.get('status') === 'all';

  if (req.method === 'GET') {
    if (id) {
      const pups = await kvList(env, ADMIN_KEYS.puppies + ':');
      const pup = pups.find(p => p.id === id);
      return json(200, pup ? { ok: true, data: ensurePublishStatus(pup) } : { ok: false, error: 'not_found' });
    }
    const pups = await kvList(env, ADMIN_KEYS.puppies + ':');
    const litters = await kvList(env, ADMIN_KEYS.litters + ':');
    const dogs = await kvList(env, ADMIN_KEYS.dogs + ':');
    return json(200, { ok: true, data: filterPublished(pups, { get: () => showAll ? 'all' : null }), litters, dogs });
  }

  if (req.method === 'POST') {
    const body = await readJson(req);
    if (!body) return json(400, { ok: false, error: 'bad_json' });
    if (id) {
      const pups = await kvList(env, ADMIN_KEYS.puppies + ':');
      const idx = pups.findIndex(p => p.id === id);
      if (idx === -1) return json(404, { ok: false, error: 'not_found' });
      const updated = { ...pups[idx], ...body, id };
      ensurePublishStatus(updated);
      await kvPut(env, ADMIN_KEYS.puppies + ':' + id, updated);
      await auditLog(env, 'update', 'puppy', id, { name: updated.name, status: updated.status, publishStatus: updated.publishStatus });
      return json(200, { ok: true, data: updated });
    }
    const newId = 'puppy-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    const puppy = { id: newId, sireId: body.sireId || null, damId: body.damId || null, litterId: body.litterId || '', ...body };
    ensurePublishStatus(puppy);
    await kvPut(env, ADMIN_KEYS.puppies + ':' + newId, puppy);
    await auditLog(env, 'create', 'puppy', newId, { name: puppy.name, status: puppy.status });
    return json(201, { ok: true, data: puppy });
  }

  if (req.method === 'DELETE' && id) {
    const pups = await kvList(env, ADMIN_KEYS.puppies + ':');
    const pup = pups.find(p => p.id === id);
    await env.ADMIN.delete(ADMIN_KEYS.puppies + ':' + id);
    if (pup) await auditLog(env, 'delete', 'puppy', id, { name: pup.name });
    return json(200, { ok: true });
  }

  return json(405, { ok: false, error: 'method_not_allowed' });
}

async function handleAdminLitters(req, env) {
  const auth = adminAuth(req, env);
  if (!auth.ok) return json(401, { ok: false, error: auth.reason });
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  const showAll = url.searchParams.get('status') === 'all';

  if (req.method === 'GET') {
    const list = await kvList(env, ADMIN_KEYS.litters + ':');
    return json(200, { ok: true, data: filterPublished(list, { get: () => showAll ? 'all' : null }) });
  }

  if (req.method === 'POST') {
    const body = await readJson(req);
    if (!body) return json(400, { ok: false, error: 'bad_json' });
    if (id) {
      const list = await kvList(env, ADMIN_KEYS.litters + ':');
      const idx = list.findIndex(l => l.id === id);
      if (idx === -1) return json(404, { ok: false, error: 'not_found' });
      const updated = { ...list[idx], ...body, id };
      ensurePublishStatus(updated);
      await kvPut(env, ADMIN_KEYS.litters + ':' + id, updated);
      await auditLog(env, 'update', 'litter', id, { name: updated.name });
      return json(200, { ok: true, data: updated });
    }
    const newId = 'litter-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    const litter = { id: newId, sireId: body.sireId || null, damId: body.damId || null, ...body };
    ensurePublishStatus(litter);
    await kvPut(env, ADMIN_KEYS.litters + ':' + newId, litter);
    await auditLog(env, 'create', 'litter', newId, { name: litter.name });
    return json(201, { ok: true, data: litter });
  }

  if (req.method === 'DELETE' && id) {
    const list = await kvList(env, ADMIN_KEYS.litters + ':');
    const litter = list.find(l => l.id === id);
    await env.ADMIN.delete(ADMIN_KEYS.litters + ':' + id);
    if (litter) await auditLog(env, 'delete', 'litter', id, { name: litter.name });
    return json(200, { ok: true });
  }

  return json(405, { ok: false, error: 'method_not_allowed' });
}

async function handleAdminReservations(req, env) {
  const auth = adminAuth(req, env);
  if (!auth.ok) return json(401, { ok: false, error: auth.reason });
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  const action = url.searchParams.get('action');

  if (req.method === 'GET') {
    if (id) {
      const rec = await kvGet(env, 'reservation:' + id);
      return json(200, rec ? { ok: true, data: rec } : { ok: false, error: 'not_found' });
    }
    const all = await kvList(env, 'reservation:');
    return json(200, { ok: true, data: all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) });
  }

  if (req.method === 'POST' && id && action) {
    const rec = await kvGet(env, 'reservation:' + id);
    if (!rec) return json(404, { ok: false, error: 'not_found' });
    const body = await readJson(req) || {};

    if (action === 'update-status') {
      const status = String(body.status || '').toUpperCase();
      if (![STATUS.REQUESTED, STATUS.PAYMENT_PENDING, STATUS.RESERVED, STATUS.SOLD, STATUS.CANCELLED].includes(status)) {
        return json(400, { ok: false, error: 'invalid_status' });
      }
      const updated = Object.assign({}, rec, { status, updated_at: new Date().toISOString() });
      await kvPut(env, 'reservation:' + id, updated);
      if ([STATUS.RESERVED, STATUS.SOLD].includes(status)) {
        await lockClient(env, rec.puppy, id, 0, 'mark', status);
      }
      return json(200, { ok: true, data: updated });
    }

    if (action === 'add-note') {
      const notes = Array.isArray(rec.notes) ? rec.notes : [];
      notes.push({ text: sanitizeText(body.note, 500), at: new Date().toISOString(), by: 'admin' });
      const updated = Object.assign({}, rec, { notes });
      await kvPut(env, 'reservation:' + id, updated);
      return json(200, { ok: true, data: updated });
    }

    if (action === 'delete') {
      await env.ADMIN.delete('reservation:' + id);
      return json(200, { ok: true });
    }

    return json(400, { ok: false, error: 'unknown_action' });
  }

  return json(405, { ok: false, error: 'method_not_allowed' });
}

async function handleAdminTestimonials(req, env) {
  const auth = adminAuth(req, env);
  if (!auth.ok) return json(401, { ok: false, error: auth.reason });
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  const showAll = url.searchParams.get('status') === 'all';

  if (req.method === 'GET') {
    const items = await kvList(env, ADMIN_KEYS.testimonials + ':');
    const published = filterPublished(items, { get: () => showAll ? 'all' : null });
    return json(200, { ok: true, data: published.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0)) });
  }

  if (req.method === 'POST') {
    const body = await readJson(req);
    if (!body) return json(400, { ok: false, error: 'bad_json' });
    if (id) {
      const items = await kvList(env, ADMIN_KEYS.testimonials + ':');
      const idx = items.findIndex(t => t.id === id);
      if (idx === -1) return json(404, { ok: false, error: 'not_found' });
      const updated = { ...items[idx], ...body, id };
      ensurePublishStatus(updated);
      await kvPut(env, ADMIN_KEYS.testimonials + ':' + id, updated);
      await auditLog(env, 'update', 'testimonial', id, { name: updated.name, publishStatus: updated.publishStatus });
      return json(200, { ok: true, data: updated });
    }
    const newId = 'testi-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    const item = { id: newId, featured: false, approved: true, publishStatus: 'published', ...body };
    await kvPut(env, ADMIN_KEYS.testimonials + ':' + newId, item);
    await auditLog(env, 'create', 'testimonial', newId, { name: item.name });
    return json(201, { ok: true, data: item });
  }

  if (req.method === 'DELETE' && id) {
    const items = await kvList(env, ADMIN_KEYS.testimonials + ':');
    const item = items.find(t => t.id === id);
    await env.ADMIN.delete(ADMIN_KEYS.testimonials + ':' + id);
    if (item) await auditLog(env, 'delete', 'testimonial', id, { name: item.name });
    return json(200, { ok: true });
  }

  return json(405, { ok: false, error: 'method_not_allowed' });
}

async function handleAdminGallery(req, env) {
  const auth = adminAuth(req, env);
  if (!auth.ok) return json(401, { ok: false, error: auth.reason });
  const url = new URL(req.url);
  const id = url.searchParams.get('id');

  if (req.method === 'GET') {
    const items = await kvList(env, ADMIN_KEYS.gallery + ':');
    return json(200, { ok: true, data: items });
  }

  if (req.method === 'POST') {
    const body = await readJson(req);
    if (!body) return json(400, { ok: false, error: 'bad_json' });
    if (id) {
      const items = await kvList(env, ADMIN_KEYS.gallery + ':');
      const idx = items.findIndex(g => g.id === id);
      if (idx === -1) return json(404, { ok: false, error: 'not_found' });
      const updated = { ...items[idx], ...body, id };
      await kvPut(env, ADMIN_KEYS.gallery + ':' + id, updated);
      await auditLog(env, 'update', 'gallery', id, { caption: updated.caption });
      return json(200, { ok: true, data: updated });
    }
    const newId = 'gal-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    const item = { id: newId, caption: '', alt: '', category: 'general', order: 0, ...body };
    await kvPut(env, ADMIN_KEYS.gallery + ':' + newId, item);
    await auditLog(env, 'create', 'gallery', newId, { caption: item.caption });
    return json(201, { ok: true, data: item });
  }

  if (req.method === 'DELETE' && id) {
    await env.ADMIN.delete(ADMIN_KEYS.gallery + ':' + id);
    return json(200, { ok: true });
  }

  return json(405, { ok: false, error: 'method_not_allowed' });
}

async function handleAdminSettings(req, env) {
  const auth = adminAuth(req, env);
  if (!auth.ok) return json(401, { ok: false, error: auth.reason });

  if (req.method === 'GET') {
    const settings = await kvGet(env, ADMIN_KEYS.settings);
    return json(200, { ok: true, data: settings || {} });
  }

  if (req.method === 'POST') {
    const body = await readJson(req);
    if (!body) return json(400, { ok: false, error: 'bad_json' });
    const settings = await kvGet(env, ADMIN_KEYS.settings) || {};
    const updated = Object.assign(settings, body);
    await kvPut(env, ADMIN_KEYS.settings, updated);
    return json(200, { ok: true, data: updated });
  }

  return json(405, { ok: false, error: 'method_not_allowed' });
}

async function handleAdminStats(req, env) {
  const auth = adminAuth(req, env);
  if (!auth.ok) return json(401, { ok: false, error: auth.reason });

  const dogs         = await kvList(env, ADMIN_KEYS.dogs + ':');
  const puppies      = await kvList(env, ADMIN_KEYS.puppies + ':');
  const litters      = await kvList(env, ADMIN_KEYS.litters + ':');
  const reservations = await kvList(env, 'reservation:');
  const testimonials = await kvList(env, ADMIN_KEYS.testimonials + ':');
  const gallery      = await kvList(env, ADMIN_KEYS.gallery + ':');
  const auditRaw     = await env.ADMIN.get(AUDIT_LOG_KEY);
  const auditLogs    = auditRaw ? JSON.parse(auditRaw) : [];

  const statusCounts = {};
  puppies.forEach(p => { statusCounts[p.status] = (statusCounts[p.status] || 0) + 1; });
  const draftDogs     = dogs.filter(d => d.publishStatus === 'draft').length;
  const draftPuppies  = puppies.filter(p => p.publishStatus === 'draft').length;
  const draftTestis   = testimonials.filter(t => t.publishStatus === 'draft').length;

  const recentReservations = reservations
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 10);

  return json(200, {
    ok: true,
    stats: {
      totalDogs: dogs.length, draftDogs,
      totalPuppies: puppies.length, draftPuppies,
      totalLitters: litters.length,
      totalReservations: reservations.length,
      totalTestimonials: testimonials.length, draftTestis,
      totalGallery: gallery.length,
      puppyStatuses: statusCounts,
      recentReservations,
      recentAuditLogs: auditLogs.slice(0, 20)
    }
  });
}

// ─── New endpoints: upload, content, audit log ───────────────────────────────
async function handleAdminUpload(req, env) {
  const auth = adminAuth(req, env);
  if (!auth.ok) return json(401, { ok: false, error: auth.reason });
  if (req.method !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' });
  if (!env.UPLOADS) return json(500, { ok: false, error: 'r2_not_configured' });
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    if (!file || !(file instanceof File)) return json(400, { ok: false, error: 'no_file' });
    const ext = file.name.split('.').pop().toLowerCase() || 'jpg';
    const allowed = ['jpg','jpeg','png','webp','avif','gif'];
    if (!allowed.includes(ext)) return json(400, { ok: false, error: 'invalid_type' });
    if (file.size > 10 * 1024 * 1024) return json(400, { ok: false, error: 'too_large' });
    const key = 'media/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
    await env.UPLOADS.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
    const bucketName = env.UPLOADS_BUCKET_NAME || '';
    const url = bucketName ? `https://${bucketName}.r2.cloudflarestorage.com/${key}` : `/uploads/${key}`;
    await auditLog(env, 'upload', 'image', key, { size: file.size, type: file.type });
    return json(200, { ok: true, url: key, publicUrl: url });
  } catch (e) {
    return json(500, { ok: false, error: 'upload_failed', message: e.message });
  }
}

async function handleAdminContent(req, env) {
  const auth = adminAuth(req, env);
  if (!auth.ok) return json(401, { ok: false, error: auth.reason });
  const url = new URL(req.url);
  const page = url.searchParams.get('page') || '';
  const ALLOWED_PAGES = ['about', 'breeding', 'standards', 'socialization', 'social', 'contact'];

  if (!ALLOWED_PAGES.includes(page)) return json(400, { ok: false, error: 'unknown_page' });
  const key = CONTENT_PREFIX + page;

  if (req.method === 'GET') {
    const raw = await kvGet(env, key);
    return json(200, { ok: true, data: raw || { html: '', lastEdited: null } });
  }

  if (req.method === 'POST') {
    const body = await readJson(req);
    if (!body) return json(400, { ok: false, error: 'bad_json' });
    const record = { html: String(body.html || '').slice(0, 50000), lastEdited: new Date().toISOString(), editedBy: 'admin' };
    await kvPut(env, key, record);
    await auditLog(env, 'update', 'content', page, {});
    return json(200, { ok: true, data: record });
  }

  return json(405, { ok: false, error: 'method_not_allowed' });
}

async function handleAdminAudit(req, env) {
  const auth = adminAuth(req, env);
  if (!auth.ok) return json(401, { ok: false, error: auth.reason });
  if (req.method !== 'GET') return json(405, { ok: false, error: 'method_not_allowed' });
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit')) || 100, 500);
  const entity = url.searchParams.get('entity');
  const raw = await env.ADMIN.get(AUDIT_LOG_KEY);
  const allLogs = raw ? JSON.parse(raw) : [];
  const filtered = entity ? allLogs.filter(l => l.entity === entity) : allLogs;
  return json(200, { ok: true, data: filtered.slice(0, limit) });
}

async function handleAdminPublishToggle(req, env) {
  const auth = adminAuth(req, env);
  if (!auth.ok) return json(401, { ok: false, error: auth.reason });
  if (req.method !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' });
  const body = await readJson(req);
  if (!body || !body.entity || !body.id) return json(400, { ok: false, error: 'missing_fields' });
  const { entity, id, publishStatus } = body;
  const prefixMap = { dog: ADMIN_KEYS.dogs, puppy: ADMIN_KEYS.puppies, litter: ADMIN_KEYS.litters, testimonial: ADMIN_KEYS.testimonials };
  const prefix = prefixMap[entity];
  if (!prefix) return json(400, { ok: false, error: 'invalid_entity' });
  const key = prefix + ':' + id;
  const current = await kvGet(env, key);
  if (!current) return json(404, { ok: false, error: 'not_found' });
  const updated = Object.assign({}, current, { publishStatus: publishStatus || 'published' });
  await kvPut(env, key, updated);
  await auditLog(env, 'publish_toggle', entity, id, { publishStatus: updated.publishStatus });
  return json(200, { ok: true, data: updated });
}

// ─── Main fetch ──────────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response('', {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Max-Age': '86400'
        }
      });
    }

    // ── Public health endpoint ──
    if (request.method === 'GET' && url.pathname === '/webhook/health') {
      return json(200, { ok: true, ts: Date.now() });
    }

    // ── Admin API routes ──
    if (url.pathname.startsWith('/admin/api/')) {
      const rest = url.pathname.replace('/admin/api/', '');
      const parts = rest.split('/');
      const segment = parts[0];
      const subPath = parts.slice(1).join('/');
      switch (segment) {
        case 'dogs':         return handleAdminDogs(request, env);
        case 'puppies':      return handleAdminPuppies(request, env);
        case 'litters':      return handleAdminLitters(request, env);
        case 'reservations': return handleAdminReservations(request, env);
        case 'testimonials': return handleAdminTestimonials(request, env);
        case 'gallery':      return handleAdminGallery(request, env);
        case 'settings':     return handleAdminSettings(request, env);
        case 'stats':        return handleAdminStats(request, env);
        case 'upload':       return handleAdminUpload(request, env);
        case 'content':
          if (subPath) return handleAdminContent(request, env);
          return json(400, { ok: false, error: 'missing_page' });
        case 'audit':        return handleAdminAudit(request, env);
        case 'publish':      return handleAdminPublishToggle(request, env);
        default:             return json(404, { ok: false, error: 'not_found' });
      }
    }

    // ── Admin panel (serve admin.html) ──
    if (url.pathname === '/admin' || url.pathname === '/admin/') {
      return new Response('', { status: 404 }); // served as static asset from GitHub Pages
    }

    // ── Webhook endpoints ──
    if (request.method !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' });
    if (url.pathname === '/webhook' || url.pathname === '/webhook/reserve') return handleReserve(request, env);
    if (url.pathname === '/webhook/payment') return handlePayment(request, env);

    return json(404, { ok: false, error: 'not_found' });
  }
};
