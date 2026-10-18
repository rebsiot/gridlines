import test from 'node:test';
import assert from 'node:assert/strict';
import {GridlinesPanel} from '../scripts/panel.js';
import {GridlinesOverlay} from '../scripts/overlay.js';
import {SceneService} from '../scripts/service.js';
import {geometrySnapshot, addFill, normalizeAxes, overlayGeometryChanged} from '../scripts/model.js';
import {parseRange, parseMajorRange, formatMajorRange, parseAnchoredFineRange, overlayResolver} from '../scripts/coordinates.js';

class El {
  constructor(tag){this.tag=tag;this.tagName=tag.toUpperCase();this.children=[];this.events={};this.style={position:''};this.parentElement=null;
    this.value='';this.checked=false;this.textContent='';this.type='';this.dataset={};this.attributes={};this.scrollLeft=0;this.scrollTop=0;
    this.classSet=new Set();this.classList={toggle:(k,on)=>on?this.classSet.add(k):this.classSet.delete(k)};
    this.rect={left:0,top:0,width:1800,height:1600,right:1800,bottom:1600};this.isConnected=true;}
  append(...nodes){for(const n of nodes){n.parentElement=this;this.children.push(n);}}
  replaceChildren(...nodes){this.children=[];this.append(...nodes);}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(x=>x!==this);this.parentElement=null;}
  addEventListener(k,fn){this.events[k]=fn;}
  removeEventListener(k){delete this.events[k];}
  setAttribute(k,v){this.attributes[k]=v;}
  getBoundingClientRect(){return this.rect;}
  setPointerCapture(){}
  releasePointerCapture(){}
  async act(k){return this.events[k]?.({preventDefault(){},stopPropagation(){},target:this,button:0});}
}
function locate(root,predicate){if(predicate(root))return root;for(const c of root.children){const found=locate(c,predicate);if(found)return found;}return null;}
async function press(root,label){const b=locate(root,x=>x.tag==='button'&&x.textContent===label);assert.ok(b,`Missing ${label}`);return b.act('click');}
function input(root,label){const wrap=locate(root,x=>x.tag==='label'&&x.children.some(c=>c.tag==='span'&&c.textContent===label));assert.ok(wrap,`Missing input ${label}`);return locate(wrap,x=>x.tag==='input');}
function sceneFixture(){
  let value=null,writes=0;
  const scene={id:'placement-test',width:3000,height:3000,padding:0,_source:{grid:{type:1,size:100}},
    getDimensions:()=>({sceneRect:{x:0,y:0,width:3000,height:3000}}),
    getFlag:()=>value?structuredClone(value):null,
    async setFlag(_m,_k,x){writes++;value=structuredClone(x);return x;},get writes(){return writes;}};
  scene.grid={isSquare:true,size:100,sizeX:100,sizeY:100,
    getOffset:({x,y})=>({i:Math.floor(y/100),j:Math.floor(x/100)}),
    getVertices:({i,j})=>[{x:j*100,y:i*100},{x:(j+1)*100,y:i*100},{x:(j+1)*100,y:(i+1)*100},{x:j*100,y:(i+1)*100}],
    getCenterPoint:({i,j})=>({x:(j+.5)*100,y:(i+.5)*100})};
  return scene;
}
function point(x,y){return {button:0,pointerId:3,clientX:x,clientY:y,preventDefault(){},stopPropagation(){}};}

async function harness(fn){
  const prev={document:globalThis.document,game:globalThis.game,canvas:globalThis.canvas,ui:globalThis.ui,
    ResizeObserver:globalThis.ResizeObserver,requestAnimationFrame:globalThis.requestAnimationFrame,
    cancelAnimationFrame:globalThis.cancelAnimationFrame,getComputedStyle:globalThis.getComputedStyle};
  try {
    const body=new El('body'),parent=new El('div'),view=new El('canvas');body.append(parent);parent.append(view);
    const handlers={},messages=[],scene=sceneFixture(),pans=[];
    globalThis.document={body,createElement:t=>new El(t),createElementNS:(_ns,t)=>new El(t),querySelector:()=>null,
      addEventListener:(k,f)=>{handlers[k]=f;},removeEventListener:k=>{delete handlers[k];}};
    globalThis.getComputedStyle=()=>({position:'relative'});
    globalThis.ResizeObserver=class {observe(){}disconnect(){}};
    let frame=0,queue=[];globalThis.requestAnimationFrame=f=>{queue.push(f);return ++frame;};
    globalThis.cancelAnimationFrame=()=>{};
    const flush=()=>{const current=queue;queue=[];for(const f of current)f();};
    globalThis.game={user:{isGM:true}};
    globalThis.canvas={ready:true,scene,grid:scene.grid,dimensions:scene.getDimensions(),app:{canvas:view},
      canvasCoordinatesFromClient:p=>p,clientCoordinatesFromCanvas:p=>p,animatePan:async p=>{pans.push(p);}};
    globalThis.ui={notifications:{info:m=>messages.push(m),warn:m=>messages.push(m),error:m=>messages.push(m)}};
    const service=new SceneService({isGM:()=>true});await service.enable(scene);
    const overlay=new GridlinesOverlay();overlay.snapshotProvider=geometrySnapshot;
    const panel=new GridlinesPanel(service,overlay);
    overlay.onSelection=range=>panel.setSelection(range);
    overlay.onPlacementPreview=axes=>panel.applyDragPreview(axes);
    overlay.onPlacementDone=()=>panel.refresh();
    overlay.onPickA1=cell=>panel.applyA1(cell);
    overlay.onCalibration=guide=>panel.applyCalibration(guide);
    overlay.onCalibrationCancelled=()=>panel.refresh();
    overlay.attach();overlay.setSceneState(service.read(scene));panel.open();flush();
    await fn({overlay,panel,service,scene,flush,messages,handlers,pans,parent});
    panel.close();overlay.dispose();
    assert.equal(parent.children.length,1,'no permanent Drawing/Tile/Region DOM objects');
  }finally{for(const [name,value] of Object.entries(prev)){if(value===undefined)delete globalThis[name];else globalThis[name]=value;}}
}

test('dragging repositions the whole overlay live, with A1 preview, without a Scene write',async()=>harness(async ({overlay,panel,scene,flush,pans})=>{
  assert.equal(scene.writes,1);
  await press(panel.root,'Drag Grid');
  assert.equal(overlay.placementMode,'drag');
  assert.equal(overlay.root.classSet.has('gridlines-dragging'),true);
  overlay.onDown(point(100,150));
  overlay.onMove(point(145,193));flush();
  assert.equal(overlay.previewAxes.offsetX,45);
  assert.equal(overlay.previewAxes.offsetY,43);
  assert.ok(overlay.svg.children.some(x=>x.attributes.class==='gridlines-a1-label'&&x.textContent==='A1'));
  assert.equal(scene.writes,1);
  overlay.onUp(point(155,185));flush();
  assert.equal(overlay.placementMode,null);
  assert.equal(panel.axesDraft.offsetX,55);
  assert.equal(panel.axesDraft.offsetY,35);
  assert.equal(input(panel.root,'Offset X (px)').value,'55');
  assert.equal(input(panel.root,'Offset Y (px)').value,'35');
  await assert.rejects(()=>panel.go('A1'),/Save or discard/);
  await press(panel.root,'Discard Preview');flush();
  assert.equal(scene.writes,1);
  assert.equal(overlay.previewAxes,null);
  assert.equal(scene.grid.size,100);
  assert.equal(pans.length,0);
}));

test('pick A1 after drag updates major-axis lettering and Go To without moving saved fine indices',async()=>harness(async ({overlay,panel,service,scene,flush,pans})=>{
  await press(panel.root,'Drag Grid');
  overlay.onDown(point(100,100));overlay.onMove(point(130,115));overlay.onUp(point(130,115));flush();
  assert.equal(panel.axesDraft.offsetX,30);
  assert.equal(panel.axesDraft.offsetY,15);
  await press(panel.root,'Pick A1 Cell');
  assert.equal(overlay.placementMode,'pick-a1');
  assert.equal(overlay.root.classSet.has('gridlines-picking-a1'),true);
  overlay.onDown(point(500,550));flush();
  assert.equal(overlay.placementMode,null);
  assert.deepEqual([panel.axesDraft.a1Row,panel.axesDraft.a1Col],[5,4]);
  assert.deepEqual(parseMajorRange('A1',10,{row:5,col:4}),parseRange('E6:N15'));
  assert.equal(formatMajorRange(parseRange('E6:N15'),10,{row:5,col:4}),'A1');
  assert.equal(formatMajorRange(parseRange('A1:B2'),10,{row:5,col:4}),'Before A1');
  assert.deepEqual(parseAnchoredFineRange('A1',{row:5,col:4}),parseRange('E6'));
  assert.equal(scene.writes,1,'choosing A1 does not write a Scene document');
  assert.ok(overlay.svg.children.some(x=>x.attributes.class==='gridlines-a1-label'&&x.textContent==='A1'));
  assert.ok(overlay.svg.children.some(x=>x.attributes.class==='gridlines-axis-label'&&x.textContent==='A'));
  await assert.rejects(()=>panel.go('A1'),/Save or discard/);
  await press(panel.root,'Save Grid Setup');flush();
  assert.equal(scene.writes,2);
  assert.equal(service.read(scene).axes.a1Col,4);
  assert.equal(service.read(scene).axes.a1Row,5);
  await panel.go('A1');
  assert.equal(pans.at(-1).x,930);
  assert.equal(pans.at(-1).y,1015);
  await panel.go('cell:A1');
  assert.equal(pans.at(-1).x,80,'absolute fine-cell reference is unchanged');
  assert.equal(pans.at(-1).y,65);
  assert.equal(scene.grid.size,100,'Foundry native grid unchanged');
}));

test('an A1 change with saved formatting requires backup acknowledgement and preserves IDs and fine-cell indices',async()=>harness(async ({overlay,panel,service,scene,handlers,messages,flush})=>{
  await service.edit(scene,1,state=>addFill(state,parseRange('B2:C3'),'#abcdef',.4,'existing-format'));
  panel.refresh();
  await press(panel.root,'Pick A1 Cell');
  overlay.onDown(point(330,420));flush();
  assert.deepEqual([panel.axesDraft.a1Row,panel.axesDraft.a1Col],[4,3]);
  assert.equal(overlayGeometryChanged(normalizeAxes(service.read(scene).axes),panel.axesDraft,100),true);
  await press(panel.root,'Save Grid Setup');
  assert.equal(scene.writes,2);
  assert.ok(messages.some(x=>x.includes('Back up')));
  const ack=locate(panel.root,x=>x.tag==='label'&&x.children.some(c=>c.tag==='span'&&c.textContent.startsWith('I have a recoverable backup')));
  assert.ok(ack);locate(ack,x=>x.tag==='input').checked=true;
  await press(panel.root,'Save Grid Setup');
  assert.equal(scene.writes,3);
  assert.deepEqual(service.read(scene).formats[0].range,parseRange('B2:C3'));
  assert.equal(service.read(scene).formats[0].id,'existing-format');
  assert.equal(service.read(scene).axes.a1Col,3);
  await press(panel.root,'Drag Grid');
  overlay.onDown(point(100,100));overlay.onMove(point(170,140));
  handlers.keydown({key:'Escape',target:{matches:()=>false}});flush();
  assert.equal(overlay.placementMode,null);
  assert.equal(panel.axesDraft.offsetX,0);
  assert.equal(panel.axesDraft.offsetY,0);
  assert.equal(scene.writes,3,'Escape cancels the current unsaved drag');
}));

test('v0.1.3 flags without A1 fields default to zero and keep legacy addressing',()=>{
  const old={coordinateScope:'cell',majorEvery:5,offsetX:10,offsetY:20};
  const axes=normalizeAxes(old);
  assert.equal(axes.a1Row,0);assert.equal(axes.a1Col,0);
  assert.deepEqual(parseAnchoredFineRange('D3',{row:0,col:0}),parseRange('D3'));
});
