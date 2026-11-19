import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawSeats, seedInput, sha256Hex } from '../src/seats.ts';

const names = ['Kit', 'Brian', 'Ryan', 'Natalie', 'Kevin', 'Angie'];

test('same seed gives the same result; input order does not matter', async () => {
  const seed = await sha256Hex(seedInput('2026-11-18', 91, names, 'abcd'));
  assert.deepEqual(drawSeats(seed, names, 9), drawSeats(seed, [...names].reverse(), 9));
  const seed2 = await sha256Hex(seedInput('2026-11-18', 91, names, 'abce'));
  assert.notDeepEqual(drawSeats(seed, names, 9), drawSeats(seed2, names, 9));
});

test('every player is seated exactly once and the button is on an occupied seat', async () => {
  for (let k = 0; k < 200; k++) {
    const seed = await sha256Hex(String(k));
    const { result, button } = drawSeats(seed, names, 8);
    assert.equal(result.length, 8);
    assert.deepEqual(result.filter((x) => x !== null).sort(), [...names].sort());
    assert.notEqual(result[button - 1], null);
  }
});

test('seat positions are uniform (chi-square, 6 players x 6 seats)', async () => {
  const N = 6000;
  const counts = names.map(() => Array(6).fill(0));
  const sorted = [...names].sort();
  for (let k = 0; k < N; k++) {
    const { result } = drawSeats(await sha256Hex('u' + k), names, 6);
    result.forEach((n, seat) => counts[sorted.indexOf(n!)][seat]++);
  }
  const exp = N / 6;
  let chi = 0;
  for (const row of counts) for (const o of row) chi += (o - exp) ** 2 / exp;
  // 25 degrees of freedom (Latin-square margins); p = 0.001 critical value is 52.6
  assert.ok(chi < 52.6, `chi-square too large: ${chi.toFixed(1)}`);
});
