import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseRange,formatRange,parseDisplayedRange,formatDisplayedRange,
  majorBlockAt,selectionRange,parseMajorRange,columnName
} from '../scripts/coordinates.js';
import {
  newState,validateAxes,normalizeAxes,addNamedRange,addFill,previewClearShading,
  subtractRange,clearShadingInSelection,clearShadingLayer,clearAllShading
} from '../scripts/model.js';

const interval={col:10,row:10}, origin={col:0,row:0};

test('G14 references all 100 fine cells and its displayed name is G14',()=>{
  const big=parseDisplayedRange('G14',interval,origin);
  assert.deepEqual(big,parseRange('BI131:BR140'));
  assert.equal(formatDisplayedRange(big,interval,origin),'G14');
  assert.deepEqual(majorBlockAt({col:63,row:134},interval,origin),big);
  assert.deepEqual(selectionRange({col:63,row:134},{col:64,row:135},interval,origin),big);
  assert.deepEqual(selectionRange({col:63,row:134},{col:64,row:135},interval,origin,'fine'),parseRange('BL135:BM136'));
});

test('fine cells use relative, two-dimensional subcoordinates and survive round-trips',()=>{
  for (const s of ['G14.C4','G14.J10','A1.A1','B2.H7']) {
    const range=parseDisplayedRange(s,interval,origin);
    assert.equal(formatDisplayedRange(range,interval,origin),s);
  }
  assert.deepEqual(parseDisplayedRange('G14.3,4',interval,origin),parseDisplayedRange('G14.C4',interval,origin));
  assert.equal(formatDisplayedRange(parseDisplayedRange('G14.C4',interval,origin),interval,origin,'numbers'),'G14.3,4');
  assert.deepEqual(parseDisplayedRange('G14.C4:G14.E6',interval,origin),parseRange('BK134:BM136'));
  assert.throws(()=>parseDisplayedRange('G14.4',interval,origin),/G14.C4/);
  assert.throws(()=>parseDisplayedRange('G14.K4',interval,origin),/outside/);
  assert.throws(()=>parseDisplayedRange('G14.C11',interval,origin),/outside/);
  assert.equal(formatDisplayedRange(parseDisplayedRange('A1:B2',interval,origin),interval,origin),'A1:B2');
  assert.deepEqual(parseMajorRange('G14',interval,origin),parseDisplayedRange('G14',interval,origin));
});

test('major columns and rows can differ; relative labels honor nonzero A1 anchor',()=>{
  const a1={col:4,row:5},rect={col:5,row:3};
  const major=parseDisplayedRange('B3',rect,a1);
  assert.deepEqual(major,parseRange('J12:N14'));
  assert.equal(formatDisplayedRange(major,rect,a1),'B3');
  assert.deepEqual(parseDisplayedRange('B3.D2',rect,a1),parseRange('M13'));
  assert.equal(formatDisplayedRange(parseRange('M13'),rect,a1),'B3.D2');
  assert.equal(formatDisplayedRange(parseRange('A1'),rect,a1),'cell:A1');
  assert.equal(columnName(10),'K');
});

test('clearing overlapped shading splits only intersecting rectangles and keeps named ranges',()=>{
  const state=newState({type:1,size:100,width:4000,height:4000,padding:0,sceneX:0,sceneY:0,gridOriginX:0,gridOriginY:0});
  addFill(state,parseRange('A1:E5'),'#112233',.5,'fill-first');
  addFill(state,parseRange('C3:G7'),'#778899',.3,'fill-second');
  addNamedRange(state,'Warehouse',parseRange('C3:G7'),'named-warehouse');
  const snapshot=structuredClone(state);
  const cut=parseRange('D4');
  assert.deepEqual(previewClearShading(state,cut),{affected:2,previous:2,resulting:8});
  assert.deepEqual(state,snapshot,'preview cannot change stored data');
  let nextId=0;
  clearShadingInSelection(state,cut,()=>`new-${++nextId}`);
  assert.equal(state.formats.length,8,'two overlapping rectangles each split into four pieces');
  assert.ok(state.formats.some(f=>f.id==='fill-first'));
  assert.ok(state.formats.some(f=>f.id==='fill-second'));
  assert.ok(state.formats.every(f=>subtractRange(f.range,cut).length===1 &&
    JSON.stringify(subtractRange(f.range,cut)[0])===JSON.stringify(f.range)),'deleted cells are absent from every layer');
  assert.deepEqual(state.namedRanges,snapshot.namedRanges,'shading removal never touches named places');
  clearShadingLayer(state,'fill-first');
  assert.equal(state.formats.length,7);
  assert.throws(()=>clearShadingLayer(state,'does-not-exist'),/no longer exists/);
  const deleted=clearAllShading(state);
  assert.equal(deleted,7);
  assert.equal(state.formats.length,0);
  assert.deepEqual(state.namedRanges,snapshot.namedRanges);
});

test('label font colors and sizes have safe defaults and reject invalid settings',()=>{
  const defaults=normalizeAxes({});
  assert.deepEqual([defaults.colLabelSize,defaults.rowLabelSize,defaults.subLabelSize],[11,11,10]);
  assert.deepEqual([defaults.colLabelColor,defaults.rowLabelColor,defaults.subLabelColor],['#ffffff','#ffffff','#fef3c7']);
  assert.equal(validateAxes({...defaults,colLabelSize:26,rowLabelSize:17,subLabelSize:9,
    colLabelColor:'#000000',rowLabelColor:'#ed0c3f',subLabelColor:'#abcdef'}).rowLabelSize,17);
  assert.throws(()=>validateAxes({...defaults,colLabelColor:'red'}),/font color/);
  assert.throws(()=>validateAxes({...defaults,subLabelSize:99}),/sizes/);
  assert.throws(()=>validateAxes({...defaults,rowLabelSize:0}),/sizes/);
});
