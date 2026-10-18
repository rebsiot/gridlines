import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAxes, validateAxes, overlayGeometryChanged, geometrySnapshot, addNamedRange} from '../scripts/model.js';
import {overlayResolver, parseRange} from '../scripts/coordinates.js';
import {SceneService} from '../scripts/service.js';
import {GridlinesPanel} from '../scripts/panel.js';
import {GridlinesOverlay} from '../scripts/overlay.js';
import {calibrateGuide} from '../scripts/calibration.js';

const native = {
  isSquare:true, size:100,sizeX:100,sizeY:100,
  getOffset:({x,y})=>({i:Math.floor(y/100),j:Math.floor(x/100)}),
  getVertices:({i,j})=>[{x:j*100,y:i*100},{x:(j+1)*100,y:i*100},{x:(j+1)*100,y:(i+1)*100},{x:j*100,y:(i+1)*100}],
  getCenterPoint:({i,j})=>({x:(j+.5)*100,y:(i+.5)*100})
};
const rect={x:0,y:0,width:3000,height:2000};

function sceneFixture(){
  let state=null, writes=0;
  const scene={id:'rect-cells',width:3000,height:2000,padding:0,_source:{grid:{type:1,size:100}},grid:native,
    getDimensions:()=>({sceneRect:rect}),getFlag:()=>state?structuredClone(state):null,
    async setFlag(_m,_k,data){writes++;state=structuredClone(data);return data;},
    get writes(){return writes;}};
  return scene;
}

test('v0.1.5 square cellSize flags continue to resolve identically without migration on load',async()=>{
  const original={cellSize:86,offsetX:17,offsetY:23,majorEvery:10,minorDivisions:5,coordinateScope:'major'};
  const axes=validateAxes(original);
  assert.equal(axes.cellWidth,86);
  assert.equal(axes.cellHeight,86);
  assert.equal(axes.linkCellDimensions,true);
  const resolver=overlayResolver(native,rect,original);
  assert.deepEqual(resolver.bounds({col:3,row:4}),{x:275,y:367,right:361,bottom:453});
  const scene=sceneFixture(),svc=new SceneService({isGM:()=>true});
  await svc.enable(scene);
  await svc.edit(scene,1,record=>{record.axes={...record.axes,cellSize:86};delete record.axes.cellWidth;delete record.axes.cellHeight;delete record.axes.linkCellDimensions;});
  const before=scene.writes;
  const stored=svc.read(scene);
  assert.equal(scene.writes,before,'read must not silently write or migrate old Scene flags');
  assert.equal(normalizeAxes(stored.axes).cellWidth,86);
  assert.equal(normalizeAxes(stored.axes).cellHeight,86);
});

test('independent width/height drive row/column resolution, fills and coordinate center',()=>{
  const axes=validateAxes({cellSize:null,cellWidth:120,cellHeight:75,linkCellDimensions:false,offsetX:15,offsetY:25});
  const r=overlayResolver(native,rect,axes);
  assert.equal(r.sizeX,120);
  assert.equal(r.sizeY,75);
  assert.deepEqual(r.bounds({row:2,col:3}),{x:375,y:175,right:495,bottom:250});
  assert.deepEqual(r.locate({x:494.9,y:249.9}),{row:2,col:3});
  assert.deepEqual(r.locate({x:495,y:250}),{row:3,col:4});
  assert.deepEqual(r.rangeBounds(parseRange('D3:E4')),{x:375,y:175,right:615,bottom:325});
  assert.deepEqual(r.centerOfRange(parseRange('D3:E4')),{x:495,y:250});
  assert.deepEqual(r.vertices({row:0,col:0}),[{x:15,y:25},{x:135,y:25},{x:135,y:100},{x:15,y:100}]);
  assert.equal(native.sizeX,100);
  assert.equal(native.sizeY,100);
});

test('only actual geometry changes trigger location review; width and height validated separately',()=>{
  const initial=validateAxes({cellWidth:120,cellHeight:80,linkCellDimensions:false});
  assert.equal(overlayGeometryChanged(initial,{...initial,color:'#ff0000'},100,100),false);
  assert.equal(overlayGeometryChanged(initial,{...initial,cellWidth:125},100,100),true);
  assert.equal(overlayGeometryChanged(initial,{...initial,cellHeight:85},100,100),true);
  assert.equal(overlayGeometryChanged(initial,{...initial,linkCellDimensions:true},100,100),false);
  for(const a of [{cellWidth:0,cellHeight:80,linkCellDimensions:false},
    {cellWidth:80,cellHeight:2001,linkCellDimensions:false},
    {cellWidth:80,cellHeight:90,linkCellDimensions:true},
    {cellWidth:80,cellHeight:80,linkCellDimensions:'maybe'}]) assert.throws(()=>validateAxes(a));
  assert.deepEqual([normalizeAxes({cellWidth:null,cellHeight:95,linkCellDimensions:false}).cellWidth,
    normalizeAxes({cellWidth:null,cellHeight:95,linkCellDimensions:false}).cellHeight],[null,95]);
});

test('10x10 drag across printed rectangular map cells calibrates both dimensions independently',()=>{
  const fit=calibrateGuide({cells:10,from:{x:135,y:70},to:{x:1335,y:820},nativeOrigin:{x:0,y:0},nativeSize:100,
    axes:{linkCellDimensions:true,offsetX:0,offsetY:0}});
  assert.equal(fit.mode,'rectangle');
  assert.equal(fit.recommended.cellWidth,120);
  assert.equal(fit.recommended.cellHeight,75);
  assert.equal(fit.recommended.linkCellDimensions,false);
  assert.equal((135-fit.recommended.offsetX)/120 % 1,0);
  assert.equal((70-fit.recommended.offsetY)/75 % 1,0);
});

class El {
  constructor(tag){this.tag=tag;this.tagName=tag.toUpperCase();this.children=[];this.events={};this.style={position:''};this.parentElement=null;
    this.value='';this.checked=false;this.textContent='';this.type='';this.dataset={};this.attributes={};this.scrollLeft=0;this.scrollTop=0;
    this.classSet=new Set();this.classList={toggle:(key,on)=>on?this.classSet.add(key):this.classSet.delete(key)};
    this.rect={left:0,top:0,width:3000,height:2000,right:3000,bottom:2000};this.isConnected=true;}
  append(...children){for(const child of children){child.parentElement=this;this.children.push(child);}}
  replaceChildren(...children){this.children=[];this.append(...children);}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(x=>x!==this);}
  addEventListener(key,cb){this.events[key]=cb;}
  removeEventListener(key){delete this.events[key];}
  setAttribute(key,value){this.attributes[key]=String(value);}
  getBoundingClientRect(){return this.rect;}
  setPointerCapture(){} releasePointerCapture(){}
  act(event){return this.events[event]?.({button:0,preventDefault(){},stopPropagation(){},target:this});}
}
function find(root,predicate){if(predicate(root))return root;for(const child of root.children){const item=find(child,predicate);if(item)return item;}return null;}
function control(root,label){const wrap=find(root,e=>e.tag==='label'&&e.children.some(x=>x.tag==='span'&&x.textContent===label));assert.ok(wrap,`Missing ${label}`);return find(wrap,e=>e.tag==='input');}
async function press(root,label){const button=find(root,e=>e.tag==='button'&&e.textContent===label);assert.ok(button,`Missing ${label}`);return button.act('click');}

async function harness(callback){
  const prior={document:globalThis.document,game:globalThis.game,canvas:globalThis.canvas,ui:globalThis.ui,
    ResizeObserver:globalThis.ResizeObserver,requestAnimationFrame:globalThis.requestAnimationFrame,
    cancelAnimationFrame:globalThis.cancelAnimationFrame,getComputedStyle:globalThis.getComputedStyle};
  try {
    const body=new El('body'),parent=new El('div'),view=new El('canvas');body.append(parent);parent.append(view);
    let frames=[];const flush=()=>{const current=frames;frames=[];for(const fn of current)fn();};
    globalThis.document={body,createElement:tag=>new El(tag),createElementNS:(_ns,tag)=>new El(tag),querySelector:()=>null,
      addEventListener(){},removeEventListener(){}};
    globalThis.getComputedStyle=()=>({position:'relative'});
    globalThis.ResizeObserver=class {observe(){}disconnect(){}};
    globalThis.requestAnimationFrame=fn=>{frames.push(fn);return frames.length;};
    globalThis.cancelAnimationFrame=()=>{};
    globalThis.game={user:{isGM:true}};
    const scene=sceneFixture(),pans=[],messages=[];
    globalThis.canvas={ready:true,scene,grid:native,dimensions:scene.getDimensions(),app:{canvas:view},
      canvasCoordinatesFromClient:p=>p,clientCoordinatesFromCanvas:p=>p,animatePan:async p=>{pans.push(p);}};
    globalThis.ui={notifications:{info:m=>messages.push(m),warn:m=>messages.push(m),error:m=>messages.push(m)}};
    const service=new SceneService({isGM:()=>true});await service.enable(scene);
    const overlay=new GridlinesOverlay();overlay.snapshotProvider=geometrySnapshot;
    const panel=new GridlinesPanel(service,overlay);overlay.onSelection=r=>panel.setSelection(r);
    overlay.onCalibration=g=>panel.applyCalibration(g);overlay.onCalibrationCancelled=()=>panel.refresh();
    overlay.attach();overlay.setSceneState(service.read(scene));panel.open();flush();
    await callback({scene,service,panel,overlay,flush,pans,messages});
    panel.close();overlay.dispose();
    assert.equal(parent.children.length,1,'no Foundry documents or extra canvas objects created');
  }finally{for(const [key,value] of Object.entries(prior)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
}

test('manager unlinks height and width, preview redraws rectangular major and minor axes, persists only on save',()=>harness(async({scene,service,panel,overlay,flush,pans})=>{
  assert.equal(scene.writes,1);
  const linked=control(panel.root,'Link width and height (square cells)');
  assert.equal(linked.checked,true);
  const width=control(panel.root,'Cell width (px; blank = Foundry)');
  const height=control(panel.root,'Cell height (px; blank = Foundry)');
  width.value='120';width.act('input');
  assert.equal(height.value,'120','linked dimensions track edits');
  assert.equal(overlay.previewAxes.cellWidth,120);
  assert.equal(overlay.previewAxes.cellHeight,120);
  height.value='95';height.act('input');
  assert.equal(width.value,'95','linked height drives width');
  linked.checked=false;linked.act('change');
  width.value='120';width.act('input');
  height.value='75';height.act('input');flush();
  assert.equal(scene.writes,1,'preview must never write Scene flags');
  assert.equal(overlay.previewAxes.cellWidth,120);
  assert.equal(overlay.previewAxes.cellHeight,75);
  assert.equal(overlay.previewAxes.linkCellDimensions,false);
  const paths=overlay.svg.children.filter(el=>el.tag==='path');
  const minor=paths.find(el=>el.attributes.class==='gridlines-minor-axes');
  assert.ok(minor?.attributes.d.includes('M240.00 0.00V2000.00'),'vertical grid lines use width');
  assert.ok(minor?.attributes.d.includes('M0.00 150.00H3000.00'),'horizontal grid lines use height');
  await assert.rejects(()=>panel.go('B2'),/Save or discard/);
  await press(panel.root,'Save Grid Setup');flush();
  assert.equal(scene.writes,2);
  assert.equal(service.read(scene).axes.cellWidth,120);
  assert.equal(service.read(scene).axes.cellHeight,75);
  assert.equal(service.read(scene).axes.cellSize,null);
  assert.equal(service.read(scene).axes.linkCellDimensions,false);
  await panel.go('cell:F6');
  assert.deepEqual(pans.at(-1),{x:660,y:412.5,duration:350});
  const linkedAgain=control(panel.root,'Link width and height (square cells)');
  assert.equal(linkedAgain.checked,false);
  linkedAgain.checked=true;linkedAgain.act('change');flush();
  assert.equal(overlay.previewAxes.cellWidth,120);
  assert.equal(overlay.previewAxes.cellHeight,120,'relinking adopts width');
  assert.equal(overlay.previewAxes.linkCellDimensions,true);
  await press(panel.root,'Discard Preview');
  assert.equal(service.read(scene).axes.cellHeight,75,'discard restores rectangular saved geometry');
  assert.equal(scene.writes,2);
  assert.equal(native.size,100,'native movement grid untouched');
}));

test('height-only change protects existing ranges, and Discard Preview writes nothing',()=>harness(async({scene,service,panel,overlay,flush,messages})=>{
  await service.edit(scene,1,state=>addNamedRange(state,'Archive',parseRange('D3:F5'),'range-constant'));
  overlay.setSceneState(service.read(scene));panel.refresh();
  const backupName='I have a recoverable backup and approve moving existing overlay locations if geometry changes';
  const link=control(panel.root,'Link width and height (square cells)');link.checked=false;link.act('change');
  const height=control(panel.root,'Cell height (px; blank = Foundry)');height.value='77';height.act('input');flush();
  const writes=scene.writes;
  await press(panel.root,'Save Grid Setup');
  assert.equal(scene.writes,writes,'requires backup to move an existing named range');
  assert.ok(messages.some(m=>m.includes('Back up')));
  await press(panel.root,'Discard Preview');
  assert.equal(scene.writes,writes,'discard is non-persistent');
  const link2=control(panel.root,'Link width and height (square cells)');link2.checked=false;link2.act('change');
  const height2=control(panel.root,'Cell height (px; blank = Foundry)');height2.value='77';height2.act('input');
  control(panel.root,backupName).checked=true;
  await press(panel.root,'Save Grid Setup');
  assert.equal(service.read(scene).axes.cellHeight,77);
  assert.equal(service.read(scene).axes.cellWidth,null,'width still native');
  assert.equal(service.read(scene).namedRanges[0].id,'range-constant');
  assert.deepEqual(service.read(scene).namedRanges[0].range,parseRange('D3:F5'));
  assert.equal(service.read(scene).geometryRevision,1);
}));
