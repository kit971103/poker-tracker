import { test } from 'node:test';
import assert from 'node:assert/strict';
import { settle, toCents } from '../src/lib.ts';

function check(cents: number[]) {
  const { transfers, unsettled } = settle(cents.map((c, id) => ({ id, cents: c })));
  const nonZero = cents.filter((c) => c !== 0).length;
  assert.ok(transfers.length <= Math.max(0, nonZero - 1), `too many transfers: ${transfers.length}`);
  const bal = cents.map(() => 0);
  for (const t of transfers) {
    assert.ok(t.cents > 0);
    bal[t.from] -= t.cents;
    bal[t.to] += t.cents;
  }
  if (unsettled === 0) assert.deepEqual(bal, cents);
  return transfers;
}

test('simple game', () => {
  const t = check([4000, -2000, -2000]);
  assert.equal(t.length, 2);
});

test('already even', () => {
  assert.equal(check([0, 0, 0]).length, 0);
});

test('random zero-sum games keep balances and use at most n-1 transfers', () => {
  let s = 12345;
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  for (let k = 0; k < 2000; k++) {
    const n = 2 + Math.floor(rnd() * 10);
    const v = Array.from({ length: n - 1 }, () => Math.round((rnd() - 0.5) * 20000));
    v.push(-v.reduce((a, b) => a + b, 0));
    check(v);
  }
});

test('non-zero sum is reported', () => {
  const r = settle([{ id: 0, cents: 500 }, { id: 1, cents: -300 }]);
  assert.equal(r.unsettled, 200);
  assert.deepEqual(r.transfers, [{ from: 1, to: 0, cents: 300 }]);
});

test('toCents keeps a zero sum exact', () => {
  const dpc = 20 / 1000;
  const chips = [337, -113, -224, 1001, -1001];
  const c = toCents(chips.map((x) => x * dpc));
  assert.equal(c.reduce((a, b) => a + b, 0), 0);
  c.forEach((x, i) => assert.ok(Math.abs(x - chips[i] * dpc * 100) < 1));
  const thirds = toCents([1 / 3, 1 / 3, -2 / 3]);
  assert.equal(thirds.reduce((a, b) => a + b, 0), 0);
});
