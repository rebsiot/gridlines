import test from 'node:test';
import assert from 'node:assert/strict';
import {GridlinesOverlay} from '../scripts/overlay.js';
import {newState, geometrySnapshot, addFill, addNamedRange} from '../scripts/model.js';
import {parseRange, formatRange} from '../scripts/coordinates.js';

class FakeElement {
  constructor(tag='div') {
    this.tag=tag;this.children=[];this.attributes={};this.style={position:''};this.events={};this.parentElement=null;
    this.scrollLeft=0;this.scrollTop=0;this.offsetLeft=0;this.offsetTop=0;this.clientWidth=500;this.clientHeight=400;
    this.classSet=new Set();
    this.classList={toggle:(key,on)=>on?this.classSet.add(key):this.classSet.delete(key)};
    this.rect={left:0,top:0,right:500,bottom:400,width:500,height:400};
  }
  append(...els) {for(const el of els){el.parentElement=this;this.children.push(el);}}
  replaceChildren(...els) {this.children=[];this.append(...els);}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(child=>child!==this);this.parentElement=null;}
  addEventListener(type,fn){this.events[type]=fn;}
  removeEventListener(type){delete this.events[type];}
  setAttribute(key,value){this.attributes[key]=String(value);}
  getBoundingClientRect(){return this.rect;}
  setPointerCapture(){}
  releasePointerCapture(){}
}

function createMockScene() {
  const size=100;
  const scene={id:'mock-scene',width:500,height:400,padding:0,_source:{grid:{type:1,size}},getDimensions:()=>({sceneRect:{x:0,y:0,width:500,height:400}})};
  const grid={isSquare:true,type:1,size,sizeX:size,sizeY:size,
    getOffset:({x,y})=>({i:Math.floor(y/size),j:Math.floor(x/size)}),
    getCenterPoint:({i,j})=>({x:(j+.5)*size,y:(i+.5)*size}),
    getVertices:({i,j})=>{const x=j*size,y=i*size;return [{x,y},{x:x+size,y},{x:x+size,y:y+size},{x,y:y+size}];}
  };
  scene.grid=grid;
  return scene;
}

test('DOM/SVG overlay mock renders and cell selection remains non-document based',()=>{
  const previous={document:globalThis.document,canvas:globalThis.canvas,game:globalThis.game,requestAnimationFrame:globalThis.requestAnimationFrame,
    cancelAnimationFrame:globalThis.cancelAnimationFrame,ResizeObserver:globalThis.ResizeObserver,getComputedStyle:globalThis.getComputedStyle};
  try {
    const doc=new FakeElement('body'),parent=new FakeElement('div'),view=new FakeElement('canvas');
    doc.append(parent);parent.append(view);
    const handlers={};
    globalThis.document={createElement: tag=>new FakeElement(tag),createElementNS:(_ns,tag)=>new FakeElement(tag),
      querySelector:()=>null,addEventListener:(key,fn)=>{handlers[key]=fn},removeEventListener:key=>{delete handlers[key]}};
    globalThis.getComputedStyle=()=>({position:'relative'});
    globalThis.ResizeObserver=class {observe(){} disconnect(){}};
    let scheduled=[];globalThis.requestAnimationFrame=callback=>{scheduled.push(callback);return scheduled.length;};
    globalThis.cancelAnimationFrame=()=>{};
    const flush=()=>{const current=scheduled;scheduled=[];for(const fn of current)fn();};
    const scene=createMockScene(),grid=scene.grid;
    globalThis.game={user:{isGM:true}};
    globalThis.canvas={ready:true,scene,grid,dimensions:scene.getDimensions(),app:{view},
      canvasCoordinatesFromClient:p=>p,clientCoordinatesFromCanvas:p=>p};
    let selected=null;
    const overlay=new GridlinesOverlay({onSelection:s=>{selected=s;}});
    overlay.snapshotProvider=geometrySnapshot;
    const state=newState(geometrySnapshot(scene));
    addFill(state,parseRange('B2:C3'),'#2563eb',.25,'style-id');
    addNamedRange(state,'Warehouse',parseRange('B2:C3'),'range-id');
    overlay.attach();
    overlay.setSceneState(state);
    flush();
    const paths=overlay.svg.children.filter(n=>n.tag==='path');
    assert.ok(paths.length>=1,'grid paths are rendered');
    assert.ok(overlay.svg.children.some(n=>n.tag==='rect'&&n.attributes.fill==='#2563eb'),'saved cell fill is rendered');
    const initialAxis=overlay.svg.children.find(n=>n.tag==='path' && n.attributes.class==='gridlines-major-axes');
    assert.equal(initialAxis.attributes.stroke,'#65baff');
    assert.equal(initialAxis.attributes['stroke-width'],'2');
    const oldChildCount=overlay.svg.children.length;
    overlay.setPreviewAxes({...state.axes,cellSize:50,offsetX:25,offsetY:15,color:'#fa5511',alpha:.3,majorWidth:6,minorWidth:2});
    flush();
    const major=overlay.svg.children.find(n=>n.tag==='path' && n.attributes.class==='gridlines-major-axes');
    const minor=overlay.svg.children.find(n=>n.tag==='path' && n.attributes.class==='gridlines-minor-axes');
    assert.equal(major.attributes.stroke,'#fa5511');
    assert.equal(major.attributes['stroke-opacity'],'0.3');
    assert.equal(major.attributes['stroke-width'],'6');
    assert.ok(major.attributes.d.includes('M25.00 0.00'));
    assert.equal(minor.attributes['stroke-width'],'2');
    assert.equal(minor.attributes['stroke-opacity'],String(.3*.55));
    assert.equal(scene.grid.size,100,'native grid must remain unchanged after preview');
    assert.equal(overlay.geometryPreviewPending,true);
    overlay.setPreviewAxes(null);
    flush();
    assert.equal(overlay.svg.children.find(n=>n.tag==='path' && n.attributes.class==='gridlines-major-axes').attributes.stroke,'#65baff');
    assert.ok(oldChildCount>=1);
    overlay.setSceneState({...state, axes:{...state.axes,majorEvery:2,minorDivisions:2,coordinateScope:'major'}});
    flush();
    const labels=overlay.svg.children.filter(n=>n.tag==='text').map(n=>n.textContent);
    assert.ok(labels.includes('A') && labels.includes('B') && labels.includes('C'),'letters label major axes');
    assert.ok(labels.includes('1') && labels.includes('2'),'numbers label major axes');
    assert.ok(!labels.includes('A1'),'labels are not shown inside every small cell');
    overlay.setSceneState(state);
    flush();
    overlay.setSelecting(true);flush();
    overlay.onDown({button:0,pointerId:1,clientX:105,clientY:105,preventDefault(){},stopPropagation(){}});
    overlay.onMove({clientX:295,clientY:295});
    overlay.onUp({pointerId:1,clientX:295,clientY:295});
    assert.equal(formatRange(selected),'B2:C3');
    overlay.setSelecting(false);
    flush();
    assert.equal(overlay.root.classSet.has('gridlines-selecting'),false);
    overlay.dispose();
    assert.equal(parent.children.includes(view),true);
    assert.equal(parent.children.length,1,'overlay was removed without changing canvas');
  } finally {for(const [key,val] of Object.entries(previous)){if(val===undefined)delete globalThis[key];else globalThis[key]=val;}}
});
