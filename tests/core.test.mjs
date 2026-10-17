import test from 'node:test';
import assert from 'node:assert/strict';
import {
  columnName, columnIndex, parseAddress, formatAddress, parseRange, formatRange,
  normalizeRange, squareResolver
} from '../scripts/coordinates.js';
import {
  newState, geometrySnapshot, alignmentStatus, addNamedRange, addFill,
  previewPixelRemap, remapRangeByPixels
} from '../scripts/model.js';
import {SceneService} from '../scripts/service.js';

function fakeScene({x=200,y=300,width=700,height=500,size=100,gridType=1}={}) {
  let state = null;
  let writes = 0;
  const scene = {
    id: 'scene-a', width, height, padding: 0,
    _source: {grid: {type: gridType, size}},
    grid: null,
    getDimensions() { return {sceneRect: {x,y,width: this.width,height:this.height},sceneWidth:this.width,sceneHeight:this.height}; },
    getFlag() { return state ? structuredClone(state) : null; },
    async setFlag(_module,_key,value) {writes++; state=structuredClone(value); return structuredClone(value);},
    get writes() {return writes;},
    setGridSize(next) { this._source.grid.size=next; this.grid=createGrid(next, x, y); },
    nativeResize(newSize) {this.setGridSize(newSize); }
  };
  function createGrid(sz) {
    return {
      isSquare: true, type:gridType,size:sz,sizeX:sz,sizeY:sz,
      getOffset({x: px,y: py}) {return {i: Math.floor((py-y)/sz),j:Math.floor((px-x)/sz)};},
      getCenterPoint({i,j}) {return {x:x+(j+.5)*sz,y:y+(i+.5)*sz};},
      getVertices({i,j}) {const lx=x+j*sz,ly=y+i*sz;return [{x:lx,y:ly},{x:lx+sz,y:ly},{x:lx+sz,y:ly+sz},{x:lx,y:ly+sz}];}
    };
  }
  scene.setGridSize(size);
  return scene;
}

test('Excel column address boundaries, parsing and rejection', () => {
  for (const [col, label] of [[0,'A'],[25,'Z'],[26,'AA'],[27,'AB'],[701,'ZZ'],[702,'AAA']]) {
    assert.equal(columnName(col),label);
    assert.equal(columnIndex(label),col);
  }
  assert.deepEqual(parseAddress(' d7 '),{row:6,col:3});
  assert.equal(formatAddress({row:9,col:27}),'AB10');
  for (const bad of ['A0','0A','G-1','AA','G1:K4','A100001','A1<script>']) assert.throws(()=>parseAddress(bad));
});

test('inclusive rectangular range normalize and formatting', () => {
  assert.deepEqual(parseRange('F5:D3'), {from:{row:2,col:3},to:{row:4,col:5}});
  assert.equal(formatRange(parseRange('D3:F5')),'D3:F5');
  assert.equal(formatRange(parseRange('g14')),'G14');
  assert.deepEqual(normalizeRange({row:4,col:5},{row:2,col:3}),parseRange('D3:F5'));
});

test('native Foundry geometry resolver uses scene rect and i/j correctly', () => {
  const scene=fakeScene();
  const resolver=squareResolver(scene.grid,scene.getDimensions().sceneRect);
  assert.deepEqual(resolver.locate({x:550,y:950}),null);
  assert.deepEqual(resolver.locate({x:552,y:951}),null);
  assert.deepEqual(resolver.locate({x:552,y:652}),{row:3,col:3});
  assert.deepEqual(resolver.center({row:2,col:3}),{x:550,y:550});
  assert.deepEqual(resolver.rangeBounds(parseRange('D3:F5')),{x:500,y:500,right:800,bottom:800});
  assert.deepEqual(resolver.locate({x:899,y:799}),{row:4,col:6});
  assert.equal(resolver.locate({x:900,y:799}),null);
});

test('opt-in Scene flag storage and writing only after enable', async () => {
  const scene=fakeScene(), service=new SceneService({isGM:()=>true});
  assert.equal(service.read(scene),null);
  assert.equal(scene.writes,0);
  const state=await service.enable(scene);
  assert.equal(state.revision,1);
  assert.equal(scene.writes,1);
  await assert.rejects(()=>service.enable(scene));
  await service.edit(scene,1,next=>{
    addNamedRange(next,'Warehouse',parseRange('D3:F5'),'id-1');
    addFill(next,parseRange('D3:F5'),'#2563eb',.25,'id-2');
  });
  assert.equal(scene.writes,2);
  assert.equal(service.read(scene).namedRanges[0].id,'id-1');
  assert.equal(service.read(scene).formats[0].opacity,.25);
  assert.equal(service.read(scene).revision,2);
  await assert.rejects(()=>service.edit(scene,1,()=>{}), /edited elsewhere/);
  assert.equal(scene.writes,2);
});

test('named ranges reject duplicate and invalid labels; fill validates styles', () => {
  const state=newState(geometrySnapshot(fakeScene()));
  addNamedRange(state,'Warehouse',parseRange('D3:F5'),'id');
  assert.throws(()=>addNamedRange(state,'warehouse',parseRange('A1'),'id2'),/already exists/);
  assert.throws(()=>addNamedRange(state,'',parseRange('A1'),'id3'));
  assert.throws(()=>addFill(state,parseRange('D3:F5'),'red',.2,'id4'));
  assert.throws(()=>addFill(state,parseRange('D3:F5'),'#ff0000',2,'id4'));
});

test('native grid resize without Gridlines data writes still raises persistent pending review', async () => {
  const scene=fakeScene(), service=new SceneService({isGM:()=>true});
  await service.enable(scene);
  const first=service.read(scene);
  scene.nativeResize(70);
  assert.equal(scene.writes,1);
  assert.equal(service.getStatus(scene).pending,true);
  await assert.rejects(()=>service.edit(scene,1,()=>{}),/Review the changed/);
  assert.equal(service.read(scene).revision,first.revision);
  await service.acceptCurrentGeometry(scene,1);
  assert.equal(service.getStatus(scene).pending,false);
  assert.equal(service.read(scene).geometryRevision,2);
});

test('pixel-preserving preview is nonmutating and remaps exact current cells', async () => {
  const scene=fakeScene(), service=new SceneService({isGM:()=>true});
  await service.enable(scene);
  await service.edit(scene,1,state => {
    addNamedRange(state,'Warehouse',parseRange('D3:F5'),'stable-id');
    addFill(state,parseRange('D3:F5'),'#123456',.2,'style-1');
  });
  scene.nativeResize(50);
  const before=service.read(scene);
  const preview=service.previewPreserveMap(scene);
  assert.equal(preview.changes[0].before,'D3:F5');
  assert.equal(preview.changes[0].after,'G5:L10');
  assert.equal(scene.writes,2);
  assert.deepEqual(service.read(scene),before);
  const applied=await service.preserveMap(scene,2);
  assert.equal(applied.namedRanges[0].id,'stable-id');
  assert.equal(formatRange(applied.namedRanges[0].range),'G5:L10');
  assert.equal(service.getStatus(scene).pending,false);
});

test('map preservation refuses non-equivalent Scene sizes and unsupported changes', () => {
  const before={type:1,size:100,width:700,height:500,gridOriginX:0,gridOriginY:0};
  assert.throws(()=>remapRangeByPixels(parseRange('A1'),before,{...before,width:500}),/Scene dimensions changed/);
  assert.throws(()=>remapRangeByPixels(parseRange('A1'),before,{...before,type:2}),/Different grid types/);
});

test('non-GM writes are rejected, data stays unchanged', async () => {
  const scene=fakeScene(), gm=new SceneService({isGM:()=>true});
  const player=new SceneService({isGM:()=>false});
  await assert.rejects(()=>player.enable(scene),/GM/);
  await gm.enable(scene);
  await assert.rejects(()=>player.edit(scene,1,()=>{}),/GM/);
  assert.equal(scene.writes,1);
});
