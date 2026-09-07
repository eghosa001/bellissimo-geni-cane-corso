export const STATUS = Object.freeze({
  REQUESTED: 'REQUESTED',
  PAYMENT_PENDING: 'PAYMENT_PENDING',
  RESERVED: 'RESERVED',
  SOLD: 'SOLD',
  CANCELLED: 'CANCELLED'
});

export const REF_PATTERN = /^BG-\d{4}-[A-Z0-9]{4}$/;
const ZW_RE = /[\u200B-\u200D\uFEFF]/g;

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

async function json(res, status, payload) {
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

async function verifyPaystack(env, body) {
  const sig = body.get('x-paystack-signature') || '';
  const ok = await hmacVerify(env.PAYSTACK_SECRET, body.get('text'), sig);
  if (!ok) return { verified: false };
  const j = JSON.parse(body.get('text'));
  if (j.event !== 'charge.success') return { verified: true, handled: false, ref: j.data && (j.data.reference || j.data.reference_code) };
  return { verified: true, handled: true, ref: j.data && j.data.reference, amount: Number(j.data.amount) / 100, currency: j.data.currency };
}

async function verifyFlutterwave(env, body) {
  if (!env.FLUTTERWAVE_SECRET) return { verified: false };
  const j = await readJson(body.get('parsed'));
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

async function handleReserve(req, env) {
  const input = await readJson(req);
  if (!input) return json(null, 400, { ok: false, error: 'bad_json' });
  if (String(input.action) !== 'reserve') return json(null, 400, { ok: false, error: 'bad_action' });
  const data = input.data && input.data;
  if (!data) return json(null, 400, { ok: false, error: 'missing_data' });
  const norm = validateReservation(data);
  if (norm.errors.length) return json(null, 422, { ok: false, error: 'validation', fields: norm.errors });
  if (!verifyRefTimestamp(input.timestamp)) return json(null, 400, { ok: false, error: 'stale_timestamp' });
  const ref = validRef(data.ref) || makeRef();
  let existing = await kvGet(env, ref);
  if (existing) {
    if (existing.status === STATUS.CANCELLED) return json(null, 409, { ok: false, error: 'ref_cancelled' });
    return json(null, 200, { ok: true, ref, status: existing.status, payment_url: existing.payment_url || null });
  }
  const cap = await verifyRecaptcha(env.RECAPTCHA_SECRET, input.token, 'reserve');
  if (!cap.passed && !cap.skipped) return json(null, 403, { ok: false, error: 'captcha_failed', score: cap.score });
  const payment = await initiatePayment(env, Object.assign({}, norm, { ref }));
  const status = payment.payment_url ? STATUS.PAYMENT_PENDING : STATUS.REQUESTED;
  const record = {
    ref,
    puppy: norm.puppy,
    name: norm.name,
    phone: norm.phone,
    email: norm.email,
    message: norm.message,
    ip: req.headers.get('CF-Connecting-IP') || null,
    status,
    payment_url: payment.payment_url || null,
    provider: payment.provider || 'none',
    provider_ref: payment.provider_ref || null,
    created_at: new Date().toISOString()
  };
  await kvPut(env, ref, record);
  await notify(env, Object.assign({}, record, { last_event: 'reservation_requested' }));
  return json(null, payment.payment_url || payment.error ? 201 : 201, { ok: true, ref, status, payment_url: payment.payment_url || null, provider: record.provider });
}

async function handlePayment(req, env) {
  const provider = String(env.PAYMENT_PROVIDER || 'none').trim().toLowerCase();
  const raw = await req.text();
  const headers = new Headers();
  req.headers.forEach((v, k) => headers.set(k, v));
  const bag = { text: raw, parsed: null, get: (n) => req.headers.get(n) };
  let verified = { verified: false };
  if (provider === 'paystack') verified = await verifyPaystack(env, bag);
  else if (provider === 'flutterwave') {
    try { bag.parsed = JSON.parse(raw); } catch (e) {}
    verified = await verifyFlutterwave(env, bag);
  }
  if (!verified.verified) return json(null, 401, { ok: false, error: 'bad_signature' });
  if (!verified.handled) return json(null, 200, { ok: true, handled: false });
  const ref = validRef(verified.ref);
  if (!ref) return json(null, 400, { ok: false, error: 'unknown_ref' });
  const record = await kvGet(env, ref);
  if (!record) return json(null, 404, { ok: false, error: 'not_found' });
  const expected = Number(env.RESERVATION_AMOUNT || 0);
  if (expected && Number(verified.amount) && Math.abs(Number(verified.amount) - expected) > 0.01) {
    return json(null, 402, { ok: false, error: 'amount_mismatch', received: verified.amount });
  }
  const status = nextStatus(record.status, { payment_confirmed: true });
  await kvPut(env, ref, Object.assign({}, record, { status, paid_amount: verified.amount, paid_currency: verified.currency, paid_at: new Date().toISOString() }));
  await notify(env, Object.assign({}, record, { status, last_event: 'payment_confirmed' }));
  return json(null, 200, { ok: true, ref, status });
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
      return json(null, 200, { ok: true, ts: Date.now() });
    }
    if (request.method !== 'POST') return json(null, 405, { ok: false, error: 'method_not_allowed' });
    if (url.pathname === '/webhook' || url.pathname === '/webhook/reserve') return handleReserve(request, env);
    if (url.pathname === '/webhook/payment') return handlePayment(request, env);
    return json(null, 404, { ok: false, error: 'not_found' });
  }
};