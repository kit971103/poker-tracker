import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { ENGINE_JS } from '../src/engine.ts';
import { RANGE_ENGINE_JS, RANGE_JS } from '../src/range-engine.ts';

const ctx: any = { setTimeout };
vm.createContext(ctx);
vm.runInContext(ENGINE_JS + RANGE_JS + RANGE_ENGINE_JS, ctx);

const labels = (t: string) => Object.keys(ctx.parseRange(t).labels).sort();
const combos = (t: string) => ctx.rangeCombos(ctx.parseRange(t)).length;
const run = (texts: string[], board = '', iterations = 200000, maxExact?: number) =>
  new Promise<any>((res) =>
    ctx.rangeEquity(
      texts.map((t) => ctx.rangeCombos(ctx.parseRange(t))),
      ctx.parseCards(board),
      [],
      { iterations, maxExact },
      null,
      res,
    ),
  );

test('notation', () => {
  assert.deepEqual(labels('TT+'), ['AA', 'JJ', 'KK', 'QQ', 'TT']);
  assert.deepEqual(labels('AJs+'), ['AJs', 'AKs', 'AQs']);
  assert.deepEqual(labels('KQo'), ['KQo']);
  assert.deepEqual(labels('A5s-A2s'), ['A2s', 'A3s', 'A4s', 'A5s']);
  assert.deepEqual(labels('22-66'), ['22', '33', '44', '55', '66']);
  assert.deepEqual(labels('66-22'), labels('22-66'));
  assert.deepEqual(labels('AK'), ['AKo', 'AKs']);
  assert.deepEqual(labels('kqs, jto'), ['JTo', 'KQs']);
  assert.deepEqual([...ctx.parseRange('AA, foo, 7').errors], ['foo', '7']);
  assert.equal(combos('AA'), 6);
  assert.equal(combos('AKs'), 4);
  assert.equal(combos('AKo'), 12);
  assert.equal(combos('AsKd, AKo'), 12); // explicit combo already inside AKo
  assert.equal(combos('22+, A2+, K2+, Q2+, J2+, T2+, 92+, 82+, 72+, 62+, 52+, 42+, 32'), 1326);
});

test('grid has 169 distinct classes covering 1326 combos', () => {
  const seen = new Set<string>();
  let n = 0;
  for (let r = 0; r < 13; r++)
    for (let c = 0; c < 13; c++) {
      const l = ctx.cellLabel(r, c);
      seen.add(l);
      n += ctx.labelSize(l);
      assert.equal(ctx.labelCombos(l).length, ctx.labelSize(l));
    }
  assert.equal(seen.size, 169);
  assert.equal(n, 1326);
});

test('format and parse round-trip (grid <-> text)', () => {
  let s = 7;
  const rnd = () => ((s = (s * 48271) % 2147483647) / 2147483647);
  const all: string[] = [];
  for (let r = 0; r < 13; r++) for (let c = 0; c < 13; c++) all.push(ctx.cellLabel(r, c));
  for (let k = 0; k < 500; k++) {
    const p = rnd();
    const set: Record<string, boolean> = {};
    for (const l of all) if (rnd() < p) set[l] = true;
    const text = ctx.formatRange(set, []);
    assert.deepEqual(labels(text), Object.keys(set).sort(), text);
  }
  assert.equal(ctx.formatRange(ctx.parseRange('TT+, AJs+, A5s-A2s, KQo, 22-66').labels, []), 'AA-TT, 66-22, AJs+, A5s-A2s, KQo'.replace('AA-TT', 'TT+'));
  assert.equal(ctx.formatRange(ctx.parseRange('AQ+').labels, []), 'AQ+');
});

test('AA vs KK preflop ~ 81.9% (Monte Carlo)', async () => {
  const r = await run(['AA', 'KK']);
  assert.equal(r.exact, false);
  assert.ok(Math.abs(r.eq[0] - 81.9) < 0.5, `AA equity ${r.eq[0]}`);
  assert.ok(Math.abs(r.eq[0] + r.eq[1] - 100) < 1e-9);
  assert.ok(r.ci[0] > 0 && r.ci[0] < 0.5);
});

test('exhaustive on the turn matches Monte Carlo and removes board cards', async () => {
  const ex = await run(['AA', 'KK, QQ'], 'Ks 7d 2c 3h');
  assert.equal(ex.exact, true);
  assert.deepEqual([...ex.combos], [6, 9]);
  const mc = await run(['AA', 'KK, QQ'], 'Ks 7d 2c 3h', 200000, 1);
  assert.equal(mc.exact, false);
  assert.ok(Math.abs(ex.eq[0] - mc.eq[0]) < 0.6, `${ex.eq[0]} vs ${mc.eq[0]}`);
});

test('three players', async () => {
  const r = await run(['AA', 'KK', 'QQ'], '', 100000);
  assert.equal(r.eq.length, 3);
  assert.ok(Math.abs(r.eq.reduce((a: number, b: number) => a + b, 0) - 100) < 1e-6);
  assert.ok(r.eq[0] > r.eq[1] && r.eq[1] > r.eq[2]);
});

test('conflicting ranges report an error', async () => {
  const r = await run(['AsAh', 'AsAd']);
  assert.ok(r.error);
  const e = await run(['AA'], 'As Ah Ad');
  assert.ok(e.error);
});
