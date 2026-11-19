import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { ENGINE_JS } from '../src/engine.ts';
import { RANGE_JS } from '../src/range-engine.ts';
import { TEXTURE_JS } from '../src/texture-engine.ts';

const ctx: any = {};
vm.createContext(ctx);
vm.runInContext(ENGINE_JS + RANGE_JS + TEXTURE_JS, ctx);
const C = (s: string) => [...ctx.parseCards(s)];
const cls = (hole: string, board: string) => ctx.classify(C(hole), C(board));
const range = (t: string) => ctx.rangeCombos(ctx.parseRange(t));

test('made hands', () => {
  assert.equal(cls('7s7h', 'Kd 7c 2s'), 'set');
  assert.equal(cls('Ks7h', 'Kd 7c 2s'), 'twopair');
  assert.equal(cls('AhAd', 'Kd 7c 2s'), 'overpair');
  assert.equal(cls('AhQd', 'Kd 7c 2s'), 'air');
  assert.equal(cls('KhQd', 'Kd 7c 2s'), 'toppair');
  assert.equal(cls('8h7d', 'Kd 7c 2s'), 'midpair');
  assert.equal(cls('9h2d', 'Kd 7c 2s'), 'weakpair');
  assert.equal(cls('9h9d', 'Kd 7c 2s'), 'midpair');
  assert.equal(cls('5h5d', 'Kd 7c 2s'), 'weakpair');
  assert.equal(cls('Th9h', 'Jh 8c 7d'), 'straight');
  assert.equal(cls('Ah2h', 'Kh 7h 3h'), 'flush');
  assert.equal(cls('8h8d', '8s 7c 7d'), 'fh');
});

test('paired boards: board pair is not the player\'s hand', () => {
  assert.equal(cls('7h6s', 'Kd 7c 7s'), 'trips');
  assert.equal(cls('AhQd', 'Kd 7c 7s'), 'air');
  assert.equal(cls('KhQd', 'Kd 7c 7s'), 'toppair');
  assert.equal(cls('9h9d', 'Kd 7c 7s'), 'midpair');
  assert.equal(cls('AhAd', 'Kd Kc 7s'), 'overpair');
  assert.equal(cls('AhQd', 'Kd Kc Ks'), 'air');
});

test('draws, including three-flush boards', () => {
  assert.equal(cls('Ah5h', 'Kh 7h 2c'), 'fd');
  assert.equal(cls('Ah5d', 'Kh 7h 2h'), 'fd'); // one card to a monotone flop
  assert.equal(cls('9d8c', 'Ts 7h 2c'), 'oesd');
  assert.equal(cls('Jd9c', 'Ks Th 7c'), 'oesd'); // double gutter: Q or 8 -> counted with OESD (8 outs)
  assert.equal(cls('9d5c', 'Ts 7h 6c'), 'gutshot'); // only an 8
  assert.equal(cls('Jd9c', 'Ts 7h 2c'), 'gutshot'); // only an 8
  assert.equal(cls('Qd9c', 'Ts 7h 2c'), 'air'); // needs J and 8: backdoor only
  assert.equal(cls('9h8h', 'Th 7c 2h'), 'combo');
  assert.equal(cls('Kh8h', 'Th 7c 2h'), 'fd');
  assert.equal(cls('Th8h', 'Td 7c 2h'), 'toppair'); // pair beats draw
  assert.equal(cls('5d4c', 'As 3h 9c'), 'gutshot'); // wheel draw needs a 2
});

test('class distribution sums to 100% and every combo is counted once', () => {
  for (const board of ['Kd 7c 2s', 'Ah Kh 7h', '8s 8d 3c', 'Js Ts 9d 2c']) {
    const r = range('22+, A2+, K2+, Q2+, J2+, T2+, 92+, 82+, 72+, 62+, 52+, 42+, 32');
    const b = C(board);
    const live = r.filter((c: number[]) => !b.includes(c[0]) && !b.includes(c[1]));
    const d = ctx.classDist(live, b);
    const sum = Object.values(d.counts as Record<string, number>).reduce((a, x) => a + x, 0);
    assert.equal(sum, live.length);
    assert.equal(d.total, live.length);
  }
});

test('equity distribution summary', () => {
  const s = ctx.eqSummary([0.05, 0.15, 0.85, 0.95, NaN], 10);
  assert.equal(s.n, 4);
  assert.ok(Math.abs(s.mean - 0.5) < 1e-12);
  assert.equal(s.nut, 0.5);
  assert.deepEqual([...s.hist], [0.25, 0.25, 0, 0, 0, 0, 0, 0, 0.25, 0.25]);
  const s20 = ctx.eqSummary([1, 0], 20);
  assert.equal(s20.hist.length, 20);
  assert.equal(s20.hist[19], 0.5);
});

test('set vs overpair: per-combo equities make sense', () => {
  const b = C('Kd 7c 2s');
  const e = ctx.comboEquities([C('7s7h')], [C('AhAd')], b, 3000);
  assert.ok(e[0] > 0.85 && e[0] < 0.97, String(e[0]));
});
