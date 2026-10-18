import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAxes,validateAxes,geometrySnapshot,addNamedRange} from '../scripts/model.js';
import {parseMajorRange,formatMajorRange,parseRange} from '../scripts/coordinates.js';
import {NativeGridDisplay,copyFoundryGrid,planNativeGridMatch} from '../scripts/native-grid.js';
import {SceneService} from '../scripts/service.js';
import {GridlinesPanel} from '../scripts/panel.js';
import {GridlinesOverlay} from '../scripts/overlay.js';

function fixture() {
  let value=null, writes=0, nativeWrites=0;
  const scene={id:'new-axes',width:2400,height:1800,padding:0,shiftX:0,shiftY:0,
    _source:{grid:{type:1,size:100}}, getDimensions:()=>({sceneRect:{x:0,y:0,width:2400,height:1800}}),
    getFlag:()=>value?structuredClone(value):null,
    async setFlag(_m,_k,x){value=structuredClone(x);writes++;return x;},
    async update(data){nativeWrites++;assert.equal(Object.keys(data).join(','),'grid.size');
      scene._source.grid.size=data['grid.size'];scene.grid.size=data['grid.size'];scene.grid.sizeX=data['grid.size'];scene.grid.sizeY=data['grid.size'];},
    get writes(){return writes;},get nativeWrites(){return nativeWrites;}};
  scene.grid={isSquare:true,size:100,sizeX:100,sizeY:100,
    getOffset:({x,y})=>({i:Math.floor(y/scene.grid.size),j:Math.floor(x/scene.grid.size)}),
    getVertices:({i,j})=>{const n=scene.grid.size;return [{x:j*n,y:i*n},{x:(j+1)*n,y:i*n},
      {x:(j+1)*n,y:(i+1)*n},{x:j*n,y:(i+1)*n}];},
    getCenterPoint:({i,j})=>({x:(j+.5)*scene.grid.size,y:(i+.5)*scene.grid.size})};
  return scene;
}
class El {
  constructor(tag) {this.tag=tag;this.tagName=tag.toUpperCase();this.children=[];this.events={};this.style={position:''};this.parentElement=null;
    this.classSet=new Set();this.classList={toggle:(k,v)=>v?this.classSet.add(k):this.classSet.delete(k)};
    this.type='';this.value='';this.checked=false;this.textContent='';this.attributes={};this.scrollLeft=0;this.scrollTop=0;
    this.rect={left:0,top:0,right:2400,bottom:1800,width:2400,height:1800};this.isConnected=true;}
  append(...items){for(const el of items){el.parentElement=this;this.children.push(el);}}
  replaceChildren(...items){this.children=[];this.append(...items);}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(x=>x!==this);this.parentElement=null;}
  addEventListener(k,f){this.events[k]=f;} removeEventListener(k){delete this.events[k];}
  setAttribute(k,v){this.attributes[k]=v;} getBoundingClientRect(){return this.rect;}
  setPointerCapture(){} releasePointerCapture(){}
  act(k){return this.events[k]?.({button:0,pointerId:1,clientX:0,clientY:0,preventDefault(){},stopPropagation(){},target:this});}
}
function find(root,predicate){if(predicate(root))return root;for(const c of root.children){const e=find(c,predicate);if(e)return e;}return null;}
function all(root,predicate,out=[]){if(predicate(root))out.push(root);for(const c of root.children)all(c,predicate,out);return out;}
function input(root,label){const wrap=find(root,e=>e.tag==='label'&&e.children.some(x=>x.tag==='span'&&x.textContent===label));
  assert.ok(wrap,`missing ${label}`);return find(wrap,e=>e.tag==='input'||e.tag==='select');}
async function press(root,label){const el=find(root,e=>e.tag==='button'&&e.textContent===label);assert.ok(el,`missing button ${label}`);return el.act('click');}
function eventAt(x,y){return {button:0,pointerId:1,clientX:x,clientY:y,preventDefault(){},stopPropagation(){}};}
async function harness(fn){
 const originals={document:globalThis.document,game:globalThis.game,canvas:globalThis.canvas,ui:globalThis.ui,foundry:globalThis.foundry,
  getComputedStyle:globalThis.getComputedStyle,requestAnimationFrame:globalThis.requestAnimationFrame,
  cancelAnimationFrame:globalThis.cancelAnimationFrame,ResizeObserver:globalThis.ResizeObserver};
 let panel,overlay;
 try {
  const body=new El('body'),parent=new El('div'),view=new El('canvas');body.append(parent);parent.append(view);
  globalThis.document={body,createElement:t=>new El(t),createElementNS:(_,t)=>new El(t),querySelector:()=>null,addEventListener(){},removeEventListener(){}};
  globalThis.getComputedStyle=()=>({position:'relative'});
  globalThis.ResizeObserver=class {observe(){}disconnect(){}};
  let frames=[];globalThis.requestAnimationFrame=cb=>{frames.push(cb);return frames.length;};globalThis.cancelAnimationFrame=()=>{};
  const flush=()=>{const work=frames;frames=[];for(const cb of work)cb();};
  globalThis.game={user:{isGM:true}};
  const scene=fixture(),messages=[],dialog=[];
  const mesh={visible:true};globalThis.canvas={ready:true,scene,grid:scene.grid,dimensions:scene.getDimensions(),app:{canvas:view},
    layers:[{constructor:{name:'GridLayer'},mesh}],canvasCoordinatesFromClient:p=>p,clientCoordinatesFromCanvas:p=>p,
    animatePan:async()=>{}};
  globalThis.ui={notifications:{info:m=>messages.push(m),warn:m=>messages.push(m),error:m=>messages.push(m)}};
  globalThis.foundry={applications:{api:{DialogV2:{confirm:async request=>{dialog.push(request);return true;}}}}};
  const service=new SceneService({isGM:()=>true});await service.enable(scene);
  overlay=new GridlinesOverlay();overlay.snapshotProvider=geometrySnapshot;
  panel=new GridlinesPanel(service,overlay);
  overlay.onSelection=r=>panel.setSelection(r);
  overlay.onPickA1=cell=>panel.applyA1(cell);
  overlay.onPickMajorAxis=(axis,cell)=>panel.applyMajorAnchor(axis,cell);
  overlay.attach();overlay.setSceneState(service.read(scene));panel.open();flush();
  await fn({panel,overlay,scene,service,flush,mesh,messages,dialog});
 }finally{
   try{panel?.close();overlay?.dispose();}catch{}
   for(const [name,value] of Object.entries(originals)){if(value===undefined)delete globalThis[name];else globalThis[name]=value;}
 }
}

test('new axes use A/B/C, independent intervals, and preserve raw cell selection data',()=>{
 const axes=normalizeAxes({});assert.deepEqual([axes.majorEveryX,axes.majorEveryY,axes.minorDivisionsX,axes.minorDivisionsY],[10,10,5,5]);
 assert.equal(axes.rulerMode,'auto');
 const range=parseMajorRange('B2',{col:10,row:7},{col:3,row:5});
 assert.deepEqual(range,{from:{row:12,col:13},to:{row:18,col:22}});
 assert.equal(formatMajorRange(range,{col:10,row:7},{row:5,col:3}),'B2');
 assert.deepEqual(parseMajorRange('B2',10),parseRange('K11:T20'));
 const saved=normalizeAxes({majorEvery:6,minorDivisions:3,coordinateScope:'cell'});
 assert.deepEqual([saved.majorEveryX,saved.majorEveryY,saved.minorDivisionsX,saved.minorDivisionsY],[6,6,3,3]);
 assert.equal(saved.coordinateScope,'cell');
 assert.throws(()=>validateAxes({...axes,majorEveryX:0}),/intervals/);
});

test('native grid visibility is client-local and restored on close or a mesh replacement',()=>harness(async({panel,scene,mesh})=>{
 assert.equal(scene.writes,1);
 await press(panel.root,'Hide Foundry Grid');assert.equal(mesh.visible,false);
 assert.equal(scene.writes,1,'hiding grid cannot persist Scene state');
 const second={visible:true};globalThis.canvas.layers[0].mesh=second;
 panel.refresh();assert.equal(second.visible,false,'temporary hide follows native redraw');
 assert.equal(mesh.visible,true,'old mesh is restored');
 await press(panel.root,'Show Foundry Grid');assert.equal(second.visible,true);
 assert.equal(scene.writes,1);
 await press(panel.root,'Hide Foundry Grid');panel.close();assert.equal(second.visible,true,'closing restores native mesh');
}));

test('panel can display major A/B/C and a fine-cell ruler without writing flags',()=>harness(async({panel,overlay,scene,flush})=>{
 const major=input(panel.root,'Major columns: every N fine cells');major.value='8';major.act('input');
 const rows=input(panel.root,'Major rows: every N fine cells');rows.value='6';rows.act('input');
 const divisions=input(panel.root,'Minor divisions between columns');divisions.value='4';divisions.act('input');
 const divisionsY=input(panel.root,'Minor divisions between rows');divisionsY.value='3';divisionsY.act('input');flush();
 assert.equal(scene.writes,1);
 assert.deepEqual([overlay.previewAxes.majorEveryX,overlay.previewAxes.majorEveryY,
  overlay.previewAxes.minorDivisionsX,overlay.previewAxes.minorDivisionsY],[8,6,4,3]);
 assert.ok(all(overlay.svg,e=>e.attributes.class==='gridlines-axis-label'&&e.textContent==='B').length,'should label second major block B');
 assert.ok(all(overlay.svg,e=>e.attributes.class==='gridlines-ruler-column'&&e.textContent==='A').length,'fine-cell ruler letters in first block');
 assert.ok(all(overlay.svg,e=>e.attributes.class==='gridlines-ruler-row'&&e.textContent==='1').length,'fine-cell ruler rows in first block');
 await press(panel.root,'Save Grid Setup');assert.equal(scene.writes,2);
 await panel.go('B2');const range=overlay.selection;
 assert.deepEqual(range,parseMajorRange('B2',{col:8,row:6}));
 assert.equal(scene.getFlag().axes.majorEveryX,8);
 assert.equal(scene.getFlag().axes.majorEveryY,6);
}));

test('pick major X/Y independently changes A1 anchor only for selected axis',()=>harness(async({panel,overlay,scene})=>{
 await press(panel.root,'Pick First Major Column');assert.equal(overlay.placementMode,'pick-major-col');
 overlay.onDown(eventAt(450,650));assert.equal(overlay.placementMode,null);
 assert.deepEqual([panel.axesDraft.a1Col,panel.axesDraft.a1Row],[4,0]);
 await press(panel.root,'Pick First Major Row');overlay.onDown(eventAt(450,650));
 assert.deepEqual([panel.axesDraft.a1Col,panel.axesDraft.a1Row],[4,6]);
 assert.equal(scene.writes,1);
 await press(panel.root,'Discard Preview');assert.deepEqual([scene.getFlag().axes.a1Col,scene.getFlag().axes.a1Row],[0,0]);
}));

test('copy native to overlay previews first and protects saved named ranges',()=>harness(async({panel,scene,service,overlay,messages})=>{
 await service.edit(scene,1,current=>addNamedRange(current,'Dock',parseRange('B2:C3'),'same-id'));
 overlay.setSceneState(service.read(scene));panel.refresh();
 const offset=input(panel.root,'Offset X (px)');offset.value='35';offset.act('input');
 await press(panel.root,'Save Grid Setup');assert.equal(scene.writes,2,'backup confirmation needed');
 await press(panel.root,'Match Gridlines+ to Foundry');
 assert.equal(overlay.previewAxes.offsetX,0);
 assert.equal(overlay.previewAxes.cellWidth,null);
 assert.equal(scene.writes,2);
 const backup=input(panel.root,'I have a recoverable backup and approve moving existing overlay locations if geometry changes');
 assert.equal(backup.checked,false);
 await press(panel.root,'Discard Preview');
 assert.equal(scene.getFlag().namedRanges[0].id,'same-id');
}));

test('reverse match previews then needs backup and explicit dialog; rejects rectangles or offsets',()=>harness(async({panel,scene,service,messages,dialog,overlay})=>{
 const native=planNativeGridMatch(scene,scene.grid,{...normalizeAxes({}),cellWidth:120,cellHeight:120,offsetX:0,offsetY:0});
 assert.deepEqual([native.from,native.to,native.changes],[100,120,true]);
 assert.throws(()=>planNativeGridMatch(scene,scene.grid,{...normalizeAxes({}),cellWidth:100,cellHeight:60}),/must be square/);
 assert.throws(()=>planNativeGridMatch(scene,scene.grid,{...normalizeAxes({}),offsetX:8}),/cannot copy independent X\/Y/);
 assert.deepEqual([copyFoundryGrid({...normalizeAxes({}),cellWidth:120,cellHeight:90,offsetX:10}).cellWidth,
   copyFoundryGrid({...normalizeAxes({}),cellWidth:120,cellHeight:90,offsetX:10}).offsetX],[null,0]);
 const w=input(panel.root,'Cell width (px; blank = Foundry)');w.value='120';w.act('input');
 await press(panel.root,'Match Foundry to Gridlines+');assert.ok(messages.some(m=>m.includes('Save or discard')));
 await press(panel.root,'Save Grid Setup');assert.equal(scene.writes,2);
 await press(panel.root,'Match Foundry to Gridlines+');
 assert.equal(panel.nativePreview.to,120);
 assert.equal(scene.nativeWrites,0,'preview must never update native Scene');
 await press(panel.root,'Confirm & Apply Foundry Grid');assert.equal(scene.nativeWrites,0,'must demand backup');
 input(panel.root,"I have a recoverable backup and approve changing Foundry's native grid size").checked=true;
 await press(panel.root,'Confirm & Apply Foundry Grid');assert.equal(dialog.length,1);
 assert.equal(scene.nativeWrites,1);assert.equal(scene._source.grid.size,120);
 assert.equal(service.read(scene).baseline.size,100,'baseline stays stale for mandatory GM alignment review');
 assert.equal(service.getStatus(scene).pending,true);
 assert.equal(scene.writes,2,'native update must not overwrite Gridlines flags');
}));
