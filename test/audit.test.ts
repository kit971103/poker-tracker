import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changes } from '../src/lib.ts';

test('changes lists only differing fields', () => {
  assert.deepEqual(changes({ name: 'A', cash: 20, memo: null }, { name: 'A', cash: 40, memo: undefined }), {
    cash: { before: 20, after: 40 },
  });
  assert.deepEqual(changes({ nickname: null }, { nickname: 'x' }), { nickname: { before: null, after: 'x' } });
  assert.deepEqual(changes({ a: 1 }, {}), {});
});
