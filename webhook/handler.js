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
  try {
    return await request.json();
  } catch (e) {
    return null;
  }
}

async function kvGet(env, ref) {
  try {
    const raw = await env.RESERVATIONS.get(ref);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

async function kvPut(env, ref, record) {
  try {
    await env.RESERVATIONS.put(ref, JSON.stringify(record), { expirationTtl: 60 * 60 * 24 * 180 });
    return true;
  } catch (e) {
    return false;
  }
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
  if (!env.RESERVATIONS) return { ok: true };
  const key = 'rate:' + strip('' + rawKey);
  const now = Date.now();
  let rec = null;
  try {
    const raw = await env.RESERVATIONS.get(key);
    if (raw) rec = JSON.parse(raw);
  } catch (e) {}
  const cur = rec && Number(rec.until) > now ? rec : { count: 0, until: now + windowMs };
  if (cur.count >= max) return { ok: false, retryAfter: Math.max(1, Math.ceil((Number(cur.until) - now) / 1000)) };
  await env.RESERVATIONS.put(key, JSON.stringify({ count: cur.count + 1, until: cur.until }), { expirationTtl: Math.ceil((cur.until - now) / 1000) + 60 });
  return { ok: true };
}

function holdMs(env) {
  const h = Number(env.RESERVATION_HOLD_HOURS || 72);
  return (Number.isFinite(h) && h > 0 ? h : 72) * 60 * 60 * 1000;
}

export class PuppyLock {
  constructor(state) {
    this.state = state;
  }

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
      const next = status === STATUS.RESERVED ? { ...s, status: STATUS.RESERVED, until: 0 } : status === STATUS.SOLD ? { ...s, status: STATUS.SOLD, until: 0 } : s;
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
  } catch (e) {
    return { ok: false, error: 'lock_unavailable' };
  }
}

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
    return j && j.status ? { provider, payment_url: j.data.authorization_url, provider_ref: data.ref } : { provider, payment_url: null, provider_ref: null, error: 'provider_rejected' };
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
  } catch (e) {
    return false;
  }
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
  const existing = await kvGet(env, ref);
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
    ref,
    puppy: norm.puppy,
    name: norm.name,
    phone: norm.phone,
    email: norm.email,
    message: norm.message,
    ip: ip || null,
    status,
    payment_url: payment.payment_url || null,
    provider: payment.provider || 'none',
    provider_ref: payment.provider_ref || null,
    created_at: new Date().toISOString(),
    hold_until: new Date(Date.now() + holdMs(env)).toISOString()
  };
  const stored = await kvPut(env, ref, record);
  if (!stored) {
    await lockClient(env, norm.puppy, ref, 0, 'release');
    return json(500, { ok: false, error: 'storage_error' });
  }
  await notify(env, Object.assign({}, record, { last_event: 'reservation_requested' }));
  return json(201, { ok: true, ref, status, payment_url: payment.payment_url || null, provider: record.provider });
}

async function handlePayment(req, env) {
  const provider = String(env.PAYMENT_PROVIDER || 'none').trim().toLowerCase();
  const raw = await req.text();
  let verified = { verified: false };
  try {
    if (provider === 'paystack') verified = await verifyPaystack(env, raw, req.headers);
    else if (provider === 'flutterwave') verified = await verifyFlutterwave(env, raw);
  } catch (e) {
    verified = { verified: false };
  }
  if (!verified.verified) return json(401, { ok: false, error: 'bad_signature' });
  if (!verified.handled) return json(200, { ok: true, handled: false });
  const ref = validRef(verified.ref);
  if (!ref) return json(400, { ok: false, error: 'unknown_ref' });
  const record = await kvGet(env, ref);
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
  const stored = await kvPut(env, ref, updated);
  if (!stored) return json(500, { ok: false, error: 'storage_error' });
  await lockClient(env, record.puppy, ref, 0, 'mark', status);
  await notify(env, Object.assign({}, updated, { last_event: 'payment_confirmed' }));
  return json(200, { ok: true, ref, status });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') {
      return new Response('', {
        status: 204,
        headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Access-Control-Max-Age': '86400' }
      });
    }
    if (request.method === 'GET' && url.pathname === '/webhook/health') {
      return json(200, { ok: true, ts: Date.now() });
    }
    if (request.method !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' });
    if (url.pathname === '/webhook' || url.pathname === '/webhook/reserve') return handleReserve(request, env);
    if (url.pathname === '/webhook/payment') return handlePayment(request, env);
    return json(404, { ok: false, error: 'not_found' });
  }
};