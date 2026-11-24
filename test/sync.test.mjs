// run: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

vm.runInThisContext(readFileSync(new URL('../sync.js', import.meta.url), 'utf8'));
const { newSyncCode, normalizeSyncCode, syncKeys, encryptState, decryptState, mergeState } = globalThis;

test('sync code: format, normalize, typo-tolerant', () => {
  const c = newSyncCode();
  assert.match(c, /^[0-9a-hjkmnp-tv-z]{5}(-[0-9a-hjkmnp-tv-z]{5}){3}$/);
  assert.equal(normalizeSyncCode(c.toUpperCase().replace(/-/g, ' ')), c);
  assert.equal(normalizeSyncCode('https://x.dev/#sync=' + c), c);
  assert.equal(normalizeSyncCode('abcde-fghjk-mnpqr-stvwO'), 'abcde-fghjk-mnpqr-stvw0');
  assert.equal(normalizeSyncCode('too-short'), '');
});

test('encrypt/decrypt roundtrip; wrong code cannot read', async () => {
  const code = newSyncCode();
  const { id, key } = await syncKeys(code);
  assert.match(id, /^[0-9a-f]{64}$/);
  const data = { todos: [{ id: 'a', title: 'ลับมาก' }], tx: [], deleted: {} };
  const blob = await encryptState(key, data);
  assert.ok(!blob.includes('ลับ') && !blob.includes('"a"'), 'ciphertext only');
  assert.deepEqual(await decryptState(key, blob), data);
  const other = await syncKeys(newSyncCode());
  assert.notEqual(other.id, id);
  await assert.rejects(decryptState(other.key, blob));
});

test('merge: newest wins, union, tombstones, undo beats delete, prune', () => {
  const now = 1_000_000_000_000;
  const day = 86400000;
  const at = (n) => now - 1000 + n; // recent timestamps
  const local = {
    todos: [
      { id: 'same', title: 'old', updatedAt: at(10) },
      { id: 'onlyLocal', updatedAt: at(5) },
      { id: 'undone', updatedAt: at(300) }, // restored after the other device deleted it
    ],
    tx: [{ id: 'delRemote', updatedAt: at(50) }],
    deleted: { gone: at(200), ancient: now - 200 * day },
  };
  const remote = {
    todos: [
      { id: 'same', title: 'new', updatedAt: at(20) },
      { id: 'onlyRemote', updatedAt: at(7) },
      { id: 'gone', updatedAt: at(100) },
    ],
    tx: [],
    deleted: { delRemote: at(60), undone: at(250) },
  };
  const m = mergeState(local, remote, now);
  const byId = (xs) => Object.fromEntries(xs.map((x) => [x.id, x]));
  const t = byId(m.todos);
  assert.equal(t.same.title, 'new');
  assert.ok(t.onlyLocal && t.onlyRemote && t.undone);
  assert.ok(!t.gone, 'deleted on this device stays deleted');
  assert.deepEqual(m.tx, [], 'deleted on the other device is removed here');
  assert.ok(!('ancient' in m.deleted), 'old tombstones pruned');
  // symmetric: the other device ends with the same items
  const m2 = mergeState(remote, local, now);
  assert.deepEqual(Object.keys(byId(m2.todos)).sort(), Object.keys(t).sort());
  // missing fields (old data) are fine
  assert.deepEqual(mergeState({ todos: [], tx: [] }, {}, now), { todos: [], tx: [], deleted: {} });
});
