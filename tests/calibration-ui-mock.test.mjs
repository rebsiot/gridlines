import test from 'node:test';
import assert from 'node:assert/strict';
import {GridlinesPanel} from '../scripts/panel.js';
import {GridlinesOverlay} from '../scripts/overlay.js';
import {SceneService} from '../scripts/service.js';
import {geometrySnapshot, addFill} from '../scripts/model.js';
import {parseRange, overlayResolver} from '../scripts/coordinates.js';

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
function locate(root, predicate){if(predicate(root))return root;for(const c of root.children){const found=locate(c,predicate);if(found)return found;}return null;}
function input(root,label){const wrap=locate(root,x=>x.tag==='label'&&x.children.some(c=>c.tag==='span'&&c.textContent===label));assert.ok(wrap,`Missing input ${label}`);return locate(wrap,x=>x.tag==='input');}
async function press(root,label){const b=locate(root,x=>x.tag==='button'&&x.textContent===label);assert.ok(b,`Missing ${label}`);return b.act('click');}
function fakeScene(){
  let value=null,writes=0;
  const scene={id:'guide-scene',width:2400,height:2000,padding:0,_source:{grid:{type:1,size:100}},
    getDimensions:()=>({sceneRect:{x:0,y:0,width:2400,height:2000}}),
    getFlag:()=>value?structuredClone(value):null,
    async setFlag(_m,_k,x){writes++;value=structuredClone(x);return x;},get writes(){return writes;}};
  scene.grid={isSquare:true,size:100,sizeX:100,sizeY:100,
    getOffset:({x,y})=>({i:Math.floor(y/100),j:Math.floor(x/100)}),
    getVertices:({i,j})=>[{x:j*100,y:i*100},{x:(j+1)*100,y:i*100},{x:(j+1)*100,y:(i+1)*100},{x:j*100,y:(i+1)*100}],
    getCenterPoint:({i,j})=>({x:(j+.5)*100,y:(i+.5)*100})};
  return scene;
}

test('GM draws calibration guide on canvas; only Save updates Scene flag, Drawings never created',async()=>{
  const prev={document:globalThis.document,game:globalThis.game,canvas:globalThis.canvas,ui:globalThis.ui,
    ResizeObserver:globalThis.ResizeObserver,requestAnimationFrame:globalThis.requestAnimationFrame,
    cancelAnimationFrame:globalThis.cancelAnimationFrame,getComputedStyle:globalThis.getComputedStyle};
  try {
    const body=new El('body'),parent=new El('div'),view=new El('canvas');body.append(parent);parent.append(view);
    const handlers={};const scene=fakeScene(),messages=[];
    globalThis.document={body,createElement:t=>new El(t),createElementNS:(_ns,t)=>new El(t),querySelector:()=>null,
      addEventListener:(k,fn)=>{handlers[k]=fn;},removeEventListener:k=>{delete handlers[k];}};
    globalThis.getComputedStyle=()=>({position:'relative'});
    globalThis.ResizeObserver=class {observe(){} disconnect(){}};
    let nextFrame=0,queue=[];globalThis.requestAnimationFrame=fn=>{queue.push(fn);return ++nextFrame;};
    globalThis.cancelAnimationFrame=()=>{};
    const flush=()=>{const current=queue;queue=[];for(const fn of current)fn();};
    globalThis.game={user:{isGM:true}};
    globalThis.canvas={ready:true,scene,grid:scene.grid,dimensions:scene.getDimensions(),app:{canvas:view},
      canvasCoordinatesFromClient:p=>p,clientCoordinatesFromCanvas:p=>p};
    globalThis.ui={notifications:{info:m=>messages.push(m),warn:m=>messages.push(m),error:m=>messages.push(m)}};
    const service=new SceneService({isGM:()=>true});await service.enable(scene);
    const overlay=new GridlinesOverlay();overlay.snapshotProvider=geometrySnapshot;
    const panel=new GridlinesPanel(service,overlay);overlay.onCalibration=guide=>panel.applyCalibration(guide);
    overlay.onCalibrationCancelled=()=>panel.refresh();
    overlay.attach();overlay.setSceneState(service.read(scene));panel.open();flush();
    assert.equal(scene.writes,1);
    await press(panel.root,'Draw 10x10 Guide');flush();
    assert.equal(overlay.calibrating,10);
    assert.equal(overlay.root.classSet.has('gridlines-calibrating'),true);
    overlay.onDown({button:0,pointerId:1,clientX:230,clientY:160,preventDefault(){},stopPropagation(){}});
    overlay.onMove({clientX:1230,clientY:1160});flush();
    assert.ok(overlay.svg.children.some(e=>e.tag==='rect'&&e.attributes.class==='gridlines-calibration-guide'));
    overlay.onUp({pointerId:1,clientX:1230,clientY:1160});flush();
    assert.equal(overlay.calibrating,null);
    assert.equal(scene.writes,1,'drag preview cannot persist Scene data');
    assert.equal(panel.axesDraft.cellWidth,100);
    assert.equal(panel.axesDraft.cellHeight,100);
    assert.equal(panel.axesDraft.offsetX,30);
    assert.equal(panel.axesDraft.offsetY,-40);
    assert.equal(overlay.previewAxes.cellWidth,100);
    assert.equal(overlay.previewAxes.cellHeight,100);
    await assert.rejects(()=>panel.go('A1'),/Save or discard/,'navigation cannot use draft map geometry');
    const overlayGrid=overlayResolver(scene.grid,scene.getDimensions().sceneRect,overlay.previewAxes);
    assert.equal((230-overlayGrid.origin.x)%100,0);
    assert.equal((160-overlayGrid.origin.y)%100,0);
    assert.equal(input(panel.root,'Cell width (px; blank = Foundry)').value,'100');
    assert.equal(input(panel.root,'Cell height (px; blank = Foundry)').value,'100');
    await service.edit(scene,1,state=>addFill(state,parseRange('B2:C3'),'#123456',.4,'old-style'));
    panel.refresh();
    await press(panel.root,'Save Grid Setup');
    assert.equal(scene.writes,2,'requires explicit backup when stored locations would move');
    const ack=locate(panel.root,e=>e.tag==='label'&&e.children.some(c=>c.tag==='span'&&c.textContent.startsWith('I have a recoverable backup')));
    assert.ok(ack);locate(ack,e=>e.tag==='input').checked=true;
    await press(panel.root,'Save Grid Setup');
    assert.equal(scene.writes,3);
    assert.deepEqual(service.read(scene).axes.offsetX,30);
    assert.deepEqual(service.read(scene).axes.offsetY,-40);
    assert.equal(service.read(scene).formats[0].id,'old-style');
    assert.equal(scene.grid.size,100,'native Foundry movement grid left untouched');
    assert.equal(overlay.calibrationGuide,null,'temporary guide removed after save');

    await press(panel.root,'Draw 5x5 Guide');
    overlay.onDown({button:0,pointerId:2,clientX:100,clientY:200,preventDefault(){},stopPropagation(){}});
    overlay.onUp({pointerId:2,clientX:650,clientY:500});
    assert.equal(overlay.calibrating,null,'rectangular guides now calibrate both dimensions');
    assert.equal(panel.axesDraft.cellWidth,110);
    assert.equal(panel.axesDraft.cellHeight,60);
    assert.equal(panel.axesDraft.linkCellDimensions,false);
    const beforeCancel=scene.writes;
    handlers.keydown({key:'Escape',target:{matches:()=>false}});
    assert.equal(overlay.calibrating,null);
    assert.equal(scene.writes,beforeCancel);
    panel.close();overlay.dispose();
    assert.equal(parent.children.length,1,'calibration never added a Foundry Drawing');
  } finally {for(const [key,v] of Object.entries(prev)){if(v===undefined)delete globalThis[key];else globalThis[key]=v;}}
});
