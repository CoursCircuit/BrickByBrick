'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  WORKSPACE_KEY, defaultWorkspace, backupContents, readBackup,
  mergeBackup, readWorkspace, selectedGroups
} = require('../data');

test('saved workspace retains a draft, class and group pairing', () => {
  const original = defaultWorkspace();
  const classroom = {
    id: '11vg', name: '11VG', selected: ['beta', 'alpha'],
    groups: [{ id: 'alpha', name: 'A', members: 'Élève A' }, { id: 'beta', name: 'B', members: '' }]
  };
  original.classes.push(classroom);
  original.settings.classId = classroom.id;
  original.settings.clickToBuild = true;
  original.draft.text = 'Mein Beispiel; Mon exemple';
  const read = readWorkspace(new MapStorage({ [WORKSPACE_KEY]: JSON.stringify(original) }));
  assert.deepEqual(read, original);
  assert.deepEqual(selectedGroups({ ...classroom, selected: ['beta', 'removed'] }), ['beta', 'alpha']);
});

test('backup import is additive and retry does not duplicate imported versions', () => {
  const workspace = defaultWorkspace();
  const incoming = defaultWorkspace();
  incoming.folders[0] = { id: 'demo-de', name: 'Langues' };
  incoming.lists[0].pairs = [{ answer: 'Er spielt Eishockey.', cue: 'Il joue au hockey sur glace.' }];
  const backup = readBackup(JSON.stringify(backupContents(incoming)));
  let sequence = 0;
  const merged = mergeBackup(workspace, backup, () => 'imported-' + (++sequence));
  assert.equal(merged.folders.length, workspace.folders.length + 1);
  assert.equal(merged.lists.length, workspace.lists.length + 1);
  assert.equal(merged.lists.at(-1).folderId, merged.folders.at(-1).id);
  assert.deepEqual(mergeBackup(merged, backup), merged);
  assert.deepEqual(merged.draft, workspace.draft);
});

test('rejects unsupported and structurally invalid backups', () => {
  assert.throws(() => readBackup('{'));
  assert.throws(() => readBackup('{"format":"some-other-app"}'));
  const invalid = backupContents(defaultWorkspace());
  invalid.lists[0].folderId = 'missing';
  assert.throws(() => readBackup(JSON.stringify(invalid)));
});

class MapStorage {
  constructor(values) { this.values = values; }
  getItem(key) { return this.values[key] ?? null; }
}
