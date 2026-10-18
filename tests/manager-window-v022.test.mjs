import test from 'node:test';
import assert from 'node:assert/strict';
import {GridlinesWindowLayout,WINDOW_LAYOUT_KEY,fitManagerLayout,moveManagerLayout,resizeManagerLayout} from '../scripts/window-layout.js';
import {GridlinesPanel} from '../scripts/panel.js';
import {newState,addNamedRange,geometrySnapshot} from '../scripts/model.js';
import {parseRange} from '../scripts/coordinates.js';

const viewport={width:1200,height:800};
const pointer=(x,y,id=1)=>({button:0,pointerId:id,clientX:x,clientY:y,preventDefault(){},stopPropagation(){}});
function mockWindow(width=1200,height=800){
  const listeners=new Map(),storage=new Map();
  const win={innerWidth:width,innerHeight:height,localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},
    addEventListener(k,f){let set=listeners.get(k);if(!set){set=new Set();listeners.set(k,set);}set.add(f);},
    removeEventListener(k,f){listeners.get(k)?.delete(f);},
    dispatch(k,e){for(const fn of listeners.get(k)??[])fn(e);},
    listeners};
  return win;
}
function withGlobals(modify,fn){
  const prev={};for(const [k,v] of Object.entries(modify)){prev[k]=globalThis[k];globalThis[k]=v;}
  try{return fn();}finally{for(const [k,v] of Object.entries(prev)){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}
}

test('window bounds clamp position and size to the viewport, even from stale preferences',()=>{
 const bad=fitManagerLayout({left:50000,top:-10,width:7000,height:0},viewport);
 assert.deepEqual(bad,{left:8,top:8,width:1184,height:280});
 const start={left:40,top:50,width:450,height:500};
 assert.deepEqual(moveManagerLayout(start,40,20,viewport),{left:80,top:70,width:450,height:500});
 assert.deepEqual(resizeManagerLayout(start,40,20,viewport),{left:40,top:50,width:490,height:520});
 const edge=resizeManagerLayout({...start,left:700},900,800,viewport);
 assert.equal(edge.width,492);
 assert.equal(edge.height,742);
 const small=fitManagerLayout(start,{width:360,height:310});
 assert.ok(small.width<=344&&small.height<=294&&small.left+small.width<=352);
});

test('drag and resize use left-pointer gesture only; placement persists locally and never writes Scene',()=>{
 const win=mockWindow();
 withGlobals({window:win},()=>{
  const root={style:{}};
  const manager=new GridlinesWindowLayout();
  manager.mount(root);
  const origin={...manager.layout};
  manager.begin({...pointer(100,100),button:2},'move');
  assert.equal(win.listeners.has('pointermove'),false,'right-click must not drag panel');
  manager.begin(pointer(100,100),'move');
  win.dispatch('pointermove',pointer(140,130));
  assert.equal(manager.layout.left,origin.left+40);
  assert.equal(manager.layout.top,origin.top+30);
  win.dispatch('pointerup',pointer(140,130));
  assert.equal(win.listeners.get('pointermove')?.size,0,'gesture listeners removed after release');
  assert.equal(JSON.parse(win.localStorage.getItem(WINDOW_LAYOUT_KEY)).left,manager.layout.left);
  const before={...manager.layout};
  manager.begin(pointer(12,12),'resize');
  win.dispatch('pointermove',pointer(62,32));
  win.dispatch('pointerup',pointer(62,32));
  assert.equal(manager.layout.width,before.width+50);
  assert.equal(manager.layout.height,Math.min(before.height+20, win.innerHeight-before.top-8));
  const recovered=new GridlinesWindowLayout();
  assert.deepEqual(recovered.layout,manager.layout);
  manager.reset();
  assert.notDeepEqual(manager.layout,before);
  manager.begin(pointer(0,0),'move');
  manager.unmount();
  assert.equal(win.listeners.get('pointermove')?.size,0,'closing cancels unfinished pointer gesture');
  assert.equal(win.listeners.get('resize')?.size,0);
 });
});

class El {
 constructor(tag){this.tag=tag;this.tagName=tag.toUpperCase();this.children=[];this.events={};this.style={};
  this.parentElement=null;this.textContent='';this.type='';this.value='';this.checked=false;this.open=false;
  this.scrollTop=0;this.attributes={};this.isConnected=true;this.classList={toggle(){}};}
 append(...children){for(const c of children){c.parentElement=this;this.children.push(c);}}
 replaceChildren(...children){this.children=[];this.append(...children);}
 remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(c=>c!==this);this.parentElement=null;}
 setAttribute(name,value){this.attributes[name]=value;}
 addEventListener(event,cb){this.events[event]=cb;}
 removeEventListener(event){delete this.events[event];}
 act(event){return this.events[event]?.(pointer(100,100));}
}
const find=(element,fn)=>fn(element)?element:element.children.map(child=>find(child,fn)).find(Boolean);
const tagText=(root,tag,text)=>find(root,x=>x.tag===tag&&x.textContent===text);

test('manager tabs expose daily Map actions first and preserve Areas and Setup workflows across redraws',async()=>{
 const win=mockWindow();const doc={body:new El('body'),createElement:t=>new El(t)};
 const scene={id:'scene-1',width:2400,height:1800,padding:0,_source:{grid:{type:1,size:100}},
  getDimensions:()=>({sceneRect:{x:0,y:0,width:2400,height:1800}}),regions:{contents:[]}};
 const grid={size:100,sizeX:100,sizeY:100,isSquare:true};
 scene.grid=grid;
 const state=newState(geometrySnapshot(scene));addNamedRange(state,'Warehouse',parseRange('A1:B2'),'name-1');
 let writes=0;scene.getFlag=()=>structuredClone(state);scene.setFlag=async()=>{writes++;};
 const globals={window:win,document:doc,game:{user:{isGM:true}},canvas:{ready:true,scene,grid,dimensions:scene.getDimensions(),layers:[]},
  ui:{notifications:{info(){},warn(){},error(){}}}};
 const old={};for(const [k,v]of Object.entries(globals)){old[k]=globalThis[k];globalThis[k]=v;}
 let panel;
 try{
  const overlay={selecting:false,localVisible:true,geometryPreviewPending:false,
   setSelecting(v){this.selecting=v;},setSelection(){},clearTemporaryHighlights(){},stopPlacement(){},stopCalibration(){},setPreviewAxes(){},
   setVisible(v){this.localVisible=v;}};
  panel=new GridlinesPanel({read:()=>structuredClone(state)},overlay);
  panel.open();
  assert.equal(panel.activeTab,'map');
  assert.equal(panel.root.style.width.endsWith('px'),true,'floating manager gets sized');
  assert.equal(panel.tabPanels.map.hidden,false);
  assert.equal(panel.tabPanels.areas.hidden,true);
  assert.equal(panel.tabPanels.setup.hidden,true);
  assert.ok(tagText(panel.tabPanels.map,'strong','Go to a map coordinate or named area'));
  assert.ok(tagText(panel.tabPanels.map,'strong','Grid visibility · this screen'));
  assert.ok(tagText(panel.tabPanels.areas,'h3','Create and manage map areas'));
  assert.ok(tagText(panel.tabPanels.setup,'h3','Grid Setup · live preview'));
  assert.ok(tagText(panel.root,'button','Save Grid Setup'));
  const tab=tagText(panel.root,'button','Map Areas (1)');
  assert.ok(tab);tab.act('click');
  assert.equal(panel.activeTab,'areas');
  assert.equal(panel.tabPanels.areas.hidden,false);
  assert.equal(panel.tabPanels.map.hidden,true);
  panel.contentRoot.scrollTop=125;
  panel.refresh();
  assert.equal(panel.activeTab,'areas');
  assert.equal(panel.contentRoot.scrollTop,125,'scroll persists through rerender');
  assert.equal(panel.tabPanels.setup.hidden,true);
  tagText(panel.root,'button','Grid Setup').act('click');
  assert.equal(panel.tabPanels.setup.hidden,false);
  const group=find(panel.tabPanels.setup,x=>x.tag==='details'&&x.children.some(c=>c.tag==='summary'&&c.textContent==='Coordinate label fonts and placement'));
  assert.ok(group);assert.equal(group.open,false,'advanced labels collapsed by default');
  group.open=true;group.act('toggle');
  panel.refresh();
  const newGroup=find(panel.tabPanels.setup,x=>x.tag==='details'&&x.children.some(c=>c.tag==='summary'&&c.textContent==='Coordinate label fonts and placement'));
  assert.equal(newGroup.open,true,'user-opened group survives updates');
  assert.equal(writes,0,'UI work never writes Scene flags');
  assert.ok(find(panel.root,x=>x.tag==='header'&&x.children.some(c=>c.attributes?.['aria-label']==='Drag Gridlines+ window')));
  assert.ok(find(panel.root,x=>x.attributes?.['aria-label']==='Resize Gridlines+ window'));
 }finally{
  try{panel?.close();}catch{}
  for(const [k,v]of Object.entries(old)){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}
 }
});
