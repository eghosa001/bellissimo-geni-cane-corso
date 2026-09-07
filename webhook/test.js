import test from 'node:test';
import assert from 'node:assert/strict';
import {
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