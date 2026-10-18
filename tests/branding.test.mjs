import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const text = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('AFT Gridlines+ is the Foundry package title but stable module ID and URLs remain unchanged', () => {
  const manifest=JSON.parse(text('module.json'));
  const pkg=JSON.parse(text('package.json'));
  assert.equal(manifest.title, 'AFT Gridlines+');
  assert.equal(manifest.id, 'gridlines');
  assert.equal(manifest.version, '0.1.12');
  assert.equal(pkg.version, '0.1.12');
  assert.equal(manifest.manifest, 'https://raw.githubusercontent.com/rebsiot/gridlines/main/module.json');
  assert.equal(manifest.download, 'https://raw.githubusercontent.com/rebsiot/gridlines/main/dist/gridlines-0.1.12-alpha.zip');
  assert.deepEqual(manifest.esmodules, ['scripts/main.js']);
  assert.deepEqual(manifest.styles, ['styles/gridlines.css']);
});

test('all important user-facing launcher and panel headers have branded names without changing internal control keys', () => {
  const main=text('scripts/main.js');
  const panel=text('scripts/panel.js');
  assert.match(main, /title: "AFT Gridlines\+: Open Manager"/);
  assert.match(main, /title: "AFT Gridlines\+"/);
  assert.match(main, /title: "AFT Gridlines\+ Manager"/);
  assert.match(main, /controls\.tokens\.tools\.gridlinesManager/);
  assert.match(main, /controls\.gridlines =/);
  assert.match(panel, /node\("strong", dragArea, "AFT Gridlines\+"\)/);
});
