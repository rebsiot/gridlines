import test from 'node:test';
import assert from 'node:assert/strict';
import {GridlinesPanel} from '../scripts/panel.js';

test('closing the Gridlines manager immediately releases selection interception', () => {
  let selecting = true;
  let removed = 0;
  const overlay = {setSelecting: active => { selecting = active; }};
  const panel = new GridlinesPanel({}, overlay);
  panel.visible = true;
  panel.root = {remove: () => removed++};
  panel.close();
  assert.equal(selecting, false);
  assert.equal(panel.visible, false);
  assert.equal(panel.root, null);
  assert.equal(removed, 1);
});
