import { test } from 'node:test';
import assert from 'node:assert/strict';
import { headToHead } from '../src/lib.ts';

test('matrix is antisymmetric and only counts co-attended games', () => {
  const rows = [
    { game_id: 1, player_id: 1, v: 100 },
    { game_id: 1, player_id: 2, v: -60 },
    { game_id: 1, player_id: 3, v: -40 },
    { game_id: 2, player_id: 1, v: -30 },
    { game_id: 2, player_id: 2, v: 30 },
    { game_id: 3, player_id: 1, v: 10 },
    { game_id: 3, player_id: 3, v: -10 },
    { game_id: 4, player_id: 2, v: 5 },
    { game_id: 4, player_id: 4, v: -5 },
  ];
  const m = headToHead(rows);
  for (const [k, c] of m) {
    const [a, b] = k.split(':');
    const r = m.get(`${b}:${a}`)!;
    assert.equal(c.diff, -r.diff);
    assert.equal(c.n, r.n);
    assert.equal(c.wins, r.losses);
  }
  const ab = m.get('1:2')!;
  assert.equal(ab.n, 2);
  assert.equal(ab.diff, (160 - 60) / 2);
  assert.equal(ab.wins, 1);
  assert.equal(m.get('1:4'), undefined);
  // heads-up game: diff equals A's own result
  assert.equal(m.get('2:4')!.diff, 5);
});
