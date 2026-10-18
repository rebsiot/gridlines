import test from 'node:test';
import assert from 'node:assert/strict';
import {buildMapAreas} from '../scripts/areas.js';
import {newState,addFill,addNamedRange,renameNamedRange,removeNamedRange,projectPlayerView,
  setShadingPlayerVisible,validateState} from '../scripts/model.js';
import {parseRange} from '../scripts/coordinates.js';
import {GridlinesOverlay} from '../scripts/overlay.js';

const baseline={type:1,size:100,width:2400,height:1800,padding:0,sceneX:0,sceneY:0,gridOriginX:0,gridOriginY:0};
const setup=()=>newState(baseline);
const rng=(name)=>parseRange(name);

test('Map Areas groups exact matching saved footprints without changing either source array',()=>{
  const s=setup();
  addNamedRange(s,'Harbor',rng('B2:C3'),'named-harbor');
  addFill(s,rng('B2:C3'),'#123456',.4,'shade-1');
  addNamedRange(s,'Loading Dock',rng('C3:D4'),'named-dock');
  addFill(s,rng('B2:C3'),'#abcdef',.5,'shade-2');
  addFill(s,rng('J6:K7'),'#ff00ff',.2,'shade-3');
  const before=structuredClone(s);
  const areas=buildMapAreas(s);
  assert.equal(areas.length,3,'exactly matching footprints group; partially overlapping remain separate');
  assert.deepEqual(areas[0].names.map(n=>n.id),['named-harbor']);
  assert.deepEqual(areas[0].shadings.map(n=>n.id),['shade-1','shade-2']);
  assert.deepEqual(areas[1].names.map(n=>n.id),['named-dock']);
  assert.deepEqual(areas[1].shadings,[]);
  assert.deepEqual(areas[2].shadings.map(n=>n.id),['shade-3']);
  assert.deepEqual(s,before,'grouping is a read-only view and never migrates flags');
});

test('renaming preserves range ID and geometry without touching matched shades',()=>{
  const s=setup();addNamedRange(s,'Harbor',rng('A1:E5'),'named-1');
  addFill(s,rng('A1:E5'),'#334455',.6,'shade-1');
  setShadingPlayerVisible(s,'shade-1',true);
  const stored=structuredClone(s.formats);
  renameNamedRange(s,'named-1','Marina');
  assert.deepEqual(s.namedRanges,[{id:'named-1',name:'Marina',range:rng('A1:E5')}]);
  assert.deepEqual(s.formats,stored);
  assert.equal(buildMapAreas(s).length,1);
  assert.equal(projectPlayerView(s).namedRanges.length,0,'player projection never publishes saved names');
  validateState(s);
});

test('duplicate and invalid names fail without modifying existing names or shades',()=>{
  const s=setup();addNamedRange(s,'Harbor',rng('B2:C3'),'named-1');
  addNamedRange(s,'Depot',rng('D4:E5'),'named-2');
  addFill(s,rng('B2:C3'),'#112233',.5,'shade-1');
  const snapshot=structuredClone(s);
  assert.throws(()=>renameNamedRange(s,'named-1',' depot '),/already exists/);
  assert.throws(()=>renameNamedRange(s,'named-1',''),/1–64/);
  assert.throws(()=>renameNamedRange(s,'named-1','x'.repeat(65)),/1–64/);
  assert.throws(()=>renameNamedRange(s,'not-exist','Warehouse'),/no longer exists/);
  assert.deepEqual(s,snapshot);
});

test('removing a name only does not remove shading, Regions, other names or change sharing',()=>{
  const s=setup();addNamedRange(s,'Harbor',rng('B2:C3'),'named-1');
  addNamedRange(s,'Alias',rng('B2:C3'),'named-2');
  addFill(s,rng('B2:C3'),'#123456',.4,'shade-1');
  setShadingPlayerVisible(s,'shade-1',true);
  const priorShade=structuredClone(s.formats);
  removeNamedRange(s,'named-1');
  assert.deepEqual(s.formats,priorShade);
  assert.deepEqual(s.namedRanges.map(x=>x.id),['named-2']);
  assert.equal(buildMapAreas(s).length,1);
  removeNamedRange(s,'named-2');
  assert.equal(buildMapAreas(s).length,1,'remaining shade is still managed as a map area');
  assert.deepEqual(s.formats,priorShade);
  assert.throws(()=>removeNamedRange(s,'missing'),/no longer exists/);
});

test('stop-selecting clears blue cell highlight and panel callback, without writing Scene data',()=>{
  const originalGame=globalThis.game;
  try {
    globalThis.game={user:{isGM:true}};
    let current=undefined,notifications=0;
    const o=new GridlinesOverlay({onSelection:r=>{current=r;notifications++;}});
    o.selecting=true;
    o.setSelection(rng('B2:C3'));
    assert.ok(o.selection);
    o.setSelecting(false);
    assert.equal(o.selection,null);
    assert.equal(current,null);
    assert.ok(notifications>=2);
    o.setSelecting(false);
    assert.equal(o.selection,null,'repeated close does not reselect');
  } finally {
    if (originalGame===undefined) delete globalThis.game;
    else globalThis.game=originalGame;
  }
});

test('temporary locate flash can be cleared without clearing Region preview or saved data',()=>{
  const o=new GridlinesOverlay();
  o.setSelection(rng('B2:C3'));
  o.flashRange(rng('D4:E5'),5000);
  assert.ok(o.locatedRange);assert.ok(o.locateTimer);
  o.clearTemporaryHighlights();
  assert.equal(o.selection,null);
  assert.equal(o.locatedRange,null);
  assert.equal(o.locateTimer,null);
});
