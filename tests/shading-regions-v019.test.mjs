import test from 'node:test';
import assert from 'node:assert/strict';
import {planShadingRegions,createShadingRegions,existingShadeRegionIds,MAX_REGION_BATCH} from '../scripts/region-bridge.js';
import {addFill,addNamedRange,newState,updateShadingLayer,geometrySnapshot} from '../scripts/model.js';
import {parseRange} from '../scripts/coordinates.js';
import {GridlinesOverlay} from '../scripts/overlay.js';
import {GridlinesPanel} from '../scripts/panel.js';
import {SceneService} from '../scripts/service.js';

const sceneRect={x:100,y:50,width:1000,height:800};
const baseline={type:1,size:100,width:1000,height:800,padding:0,sceneX:100,sceneY:50,gridOriginX:0,gridOriginY:0};
function sample(){
  const state=newState(baseline);
  addFill(state,parseRange('B2:C3'),'#123456',.35,'shade-a');
  return state;
}
function resolver(bounds={x:139.375,y:82.625,right:274.125,bottom:225.5}){
  return {rangeBounds:()=>({...bounds})};
}
function sceneFixture(){
  const s={id:'scene-1',regions:{contents:[]},created:[],async createEmbeddedDocuments(type,records){
    assert.equal(type,'Region');this.created.push(...structuredClone(records));
    const documents=records.map((d,i)=>({...structuredClone(d),id:`region-${this.regions.contents.length+i}`}));
    this.regions.contents.push(...documents);
    return documents;
  }};
  return s;
}
const planFor=(scene,state,ids=['shade-a'],geo=resolver())=>planShadingRegions({scene,state,ids,resolver:geo,sceneRect,displayName:()=>"G14"});

test('Region preview preserves offset rectangular pixel bounds without snapping to Foundry grid',async()=>{
  const scene=sceneFixture(),state=sample(),plan=planFor(scene,state);
  assert.equal(scene.created.length,0);
  assert.deepEqual(plan.items[0].shape,{type:'rectangle',x:139.375,y:82.625,width:134.75,height:142.875});
  assert.equal(plan.items[0].name,'Gridlines+ G14');
  assert.equal(plan.items[0].clipped,false);
  assert.equal(plan.items[0].fill,'#123456');
  const original=structuredClone(state);
  const created=await createShadingRegions({scene,state,plan,resolver:resolver(),sceneRect,displayName:()=>"G14"});
  assert.equal(created.length,1);
  assert.deepEqual(scene.created[0].shapes,[plan.items[0].shape]);
  assert.deepEqual(scene.created[0].behaviors,[]);
  assert.equal(scene.created[0].flags.gridlines.shadeLayerId,'shade-a');
  assert.deepEqual(state,original,'existing shading and named ranges unchanged');
  assert.deepEqual(Array.from(existingShadeRegionIds(scene)),['shade-a']);
  assert.throws(()=>planFor(scene,state),/already exists/,'repeated create is blocked');
});

test('Region plans clip rectangles to Scene dimensions but never snap to native grid',()=>{
  const scene=sceneFixture(),state=sample();
  const plan=planFor(scene,state,['shade-a'],resolver({x:84.375,y:70.25,right:1115,bottom:965}));
  assert.deepEqual(plan.items[0].shape,{type:'rectangle',x:100,y:70.25,width:1000,height:779.75});
  assert.equal(plan.items[0].clipped,true);
  assert.throws(()=>planFor(scene,state,['shade-a'],resolver({x:10,y:10,right:20,bottom:20})),/outside/);
});

test('a stale preview cannot create Regions, and batch conversion is guarded',async()=>{
  const scene=sceneFixture(),state=sample(),plan=planFor(scene,state);
  state.revision+=1;
  await assert.rejects(()=>createShadingRegions({scene,state,plan,resolver:resolver(),sceneRect,displayName:()=>"G14"}),/preview Regions again/);
  assert.equal(scene.created.length,0);
  const fresh=planFor(scene,state);
  await assert.rejects(()=>createShadingRegions({scene,state,plan:fresh,resolver:resolver({x:170,y:82,right:274,bottom:225}),sceneRect,displayName:()=>"G14"}),/preview Regions again/);
  assert.equal(scene.created.length,0);
  assert.throws(()=>planFor(scene,state,Array.from({length:MAX_REGION_BATCH+1},(_,i)=>String(i))),/at most/);
  assert.throws(()=>planFor(scene,state,['shade-a','shade-a']),/Duplicate/);
});

test('Region preview accepts optional shade name and update retains identity, geometry and other records',()=>{
  const scene=sceneFixture(),state=sample();
  addNamedRange(state,'Downtown',parseRange('B2:C3'),'range-1');
  const prior=structuredClone(state.namedRanges),range=structuredClone(state.formats[0].range);
  updateShadingLayer(state,'shade-a',{label:'City Hall',fill:'#abcdef',opacity:.8});
  assert.equal(state.formats[0].label,'City Hall');
  assert.deepEqual(state.formats[0].range,range);
  assert.deepEqual(state.namedRanges,prior);
  assert.equal(planFor(scene,state).items[0].name,'City Hall');
  assert.throws(()=>updateShadingLayer(state,'shade-a',{label:'X',fill:'red',opacity:0.5}),/Invalid shading/);
  assert.throws(()=>updateShadingLayer(state,'shade-a',{label:'x'.repeat(65),fill:'#ffffff',opacity:1}),/at most/);
  updateShadingLayer(state,'shade-a',{label:'',fill:'#abcdef',opacity:.4});
  assert.ok(!('label' in state.formats[0]));
});

class El {
  constructor(tag){this.tag=tag;this.tagName=tag.toUpperCase();this.children=[];this.events={};this.style={position:''};this.parentElement=null;
    this.type='';this.value='';this.checked=false;this.textContent='';this.attributes={};this.scrollLeft=0;this.scrollTop=0;
    this.open=false;this.classSet=new Set();this.classList={toggle:(k,v)=>v?this.classSet.add(k):this.classSet.delete(k)};
    this.rect={left:0,top:0,width:2400,height:1800,right:2400,bottom:1800};this.isConnected=true;}
  append(...items){for(const e of items){e.parentElement=this;this.children.push(e);}}
  replaceChildren(...items){this.children=[];this.append(...items);}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(x=>x!==this);this.parentElement=null;}
  addEventListener(k,fn){this.events[k]=fn;}removeEventListener(k){delete this.events[k];}
  setAttribute(k,v){this.attributes[k]=v;}getBoundingClientRect(){return this.rect;}
  setPointerCapture(){}releasePointerCapture(){}
  async act(k){return this.events[k]?.({button:0,preventDefault(){},stopPropagation(){},target:this});}
}
const all=(root,pred)=>[...(pred(root)?[root]:[]),...root.children.flatMap(c=>all(c,pred))];
const find=(root,pred)=>all(root,pred)[0];
// Unlike browser disabled buttons, our tiny Element mock needs an explicit test
// helper to preserve disabled state when locating a button under test.
async function click(root,label){const b=find(root,x=>x.tag==='button'&&x.textContent===label);assert.ok(b,`Missing ${label}`);assert.notEqual(b.disabled,true,`${label} disabled`);return b.act('click');}
function input(root,label){const wrap=find(root,e=>e.tag==='label'&&e.children.some(c=>c.tag==='span'&&c.textContent===label));assert.ok(wrap,`Missing ${label}`);return find(wrap,e=>e.tag==='input'||e.tag==='select');}
function shadingDetails(root){return find(root,e=>e.tag==='details'&&e.children.some(c=>c.tag==='summary'&&c.textContent.startsWith('Shading layers')));}

async function harness(fn){
  const original={document:globalThis.document,game:globalThis.game,canvas:globalThis.canvas,ui:globalThis.ui,
    ResizeObserver:globalThis.ResizeObserver,requestAnimationFrame:globalThis.requestAnimationFrame,
    cancelAnimationFrame:globalThis.cancelAnimationFrame,getComputedStyle:globalThis.getComputedStyle,foundry:globalThis.foundry};
  let overlay,panel;
  try{
    const body=new El('body'),parent=new El('div'),view=new El('canvas');body.append(parent);parent.append(view);
    globalThis.document={body,createElement:t=>new El(t),createElementNS:(_ns,t)=>new El(t),querySelector:()=>null,
      addEventListener(){},removeEventListener(){}};
    globalThis.getComputedStyle=()=>({position:'relative'});
    globalThis.ResizeObserver=class{observe(){}disconnect(){}};
    let queue=[];globalThis.requestAnimationFrame=f=>{queue.push(f);return queue.length;};globalThis.cancelAnimationFrame=()=>{};
    const flush=()=>{const q=queue;queue=[];for(const f of q)f();};
    const s=sceneFixture(),pans=[],messages=[],dialogs=[];
    let data=null,flagWrites=0;
    Object.assign(s,{width:2400,height:1800,padding:0,_source:{grid:{type:1,size:100}},
      grid:{size:100,sizeX:100,sizeY:100,isSquare:true,
        getOffset:({x,y})=>({i:Math.floor(y/100),j:Math.floor(x/100)}),
        getVertices:({i,j})=>[{x:j*100,y:i*100},{x:(j+1)*100,y:i*100},{x:(j+1)*100,y:(i+1)*100},{x:j*100,y:(i+1)*100}],
        getCenterPoint:({i,j})=>({x:(j+.5)*100,y:(i+.5)*100})},
      getDimensions:()=>({sceneRect:{x:0,y:0,width:2400,height:1800}}),getFlag:()=>data?structuredClone(data):null,
      async setFlag(_scope,_key,x){data=structuredClone(x);flagWrites++;},get writes(){return flagWrites;}});
    globalThis.game={user:{isGM:true}};
    globalThis.canvas={ready:true,scene:s,grid:s.grid,dimensions:s.getDimensions(),app:{canvas:view},
      canvasCoordinatesFromClient:p=>p,clientCoordinatesFromCanvas:p=>p,animatePan:async args=>{pans.push(args);}};
    globalThis.ui={notifications:{info:m=>messages.push(m),warn:m=>messages.push(m),error:m=>messages.push(m)}};
    globalThis.foundry={applications:{api:{DialogV2:{confirm:async opts=>{dialogs.push(opts);return true;}}}}};
    const service=new SceneService({isGM:()=>true});await service.enable(s);
    const a=service.read(s);await service.edit(s,a.revision,st=>{
      addFill(st,parseRange('B2:C3'),'#123456',.35,'layer-one');
      addFill(st,parseRange('F4:G5'),'#334455',.6,'layer-two');
      addNamedRange(st,'Harbor',parseRange('B2:C3'),'range-1');
    });
    overlay=new GridlinesOverlay();overlay.snapshotProvider=geometrySnapshot;
    panel=new GridlinesPanel(service,overlay);overlay.onSelection=range=>panel.setSelection(range);
    overlay.attach();overlay.setSceneState(service.read(s));panel.open();flush();
    await fn({panel,overlay,service,scene:s,flush,pans,messages,dialogs});
  } finally {
    try{panel?.close();overlay?.dispose();}catch{}
    for(const [name,value] of Object.entries(original)){if(value===undefined)delete globalThis[name];else globalThis[name]=value;}
  }
}

test('shading accordion stays open after Locate, Select, Configure and Remove, then closes on last deletion',()=>harness(async({panel,overlay,scene,pans,service,flush})=>{
  assert.equal(shadingDetails(panel.root).open,true);
  panel.root.scrollTop=240;
  await click(panel.root,'Locate');flush();
  assert.equal(pans.length,1);assert.deepEqual([pans[0].x,pans[0].y],[200,200]);
  assert.equal(overlay.locatedRange.from.row,1);
  assert.ok(overlay.svg.children.some(x=>x.attributes.class==='gridlines-locate-highlight'));
  assert.equal(overlay.selection,null,'Locate should not replace a selection');
  assert.equal(shadingDetails(panel.root).open,true);
  assert.equal(panel.root.scrollTop,240,'scroll position persists');
  await click(panel.root,'Select');
  assert.deepEqual(overlay.selection,parseRange('B2:C3'));
  assert.equal(shadingDetails(panel.root).open,true);
  await click(panel.root,'Configure');
  assert.equal(shadingDetails(panel.root).open,true);
  const label=input(panel.root,'Shading label (optional)');label.value='City Hall';await label.act('input');
  const color=input(panel.root,'Shading fill');color.value='#aabbcc';await color.act('input');
  const opacity=input(panel.root,'Shading opacity %');opacity.value='72';await opacity.act('input');
  await click(panel.root,'Save Shading');
  assert.equal(service.read(scene).formats[0].label,'City Hall');
  assert.equal(service.read(scene).formats[0].fill,'#aabbcc');
  assert.equal(service.read(scene).formats[0].opacity,.72);
  assert.equal(shadingDetails(panel.root).open,true);
  await click(panel.root,'Remove');assert.equal(service.read(scene).formats.length,1);
  assert.equal(shadingDetails(panel.root).open,true);
  await click(panel.root,'Remove');assert.equal(service.read(scene).formats.length,0);
  assert.equal(shadingDetails(panel.root).open,false);
  assert.equal(service.read(scene).namedRanges.length,1);
}));

test('manual shading collapse survives rerender and reopens only if user requests it',()=>harness(async({panel,scene,service})=>{
  const d=shadingDetails(panel.root);d.open=false;await d.act('toggle');
  assert.equal(panel.shadingExpanded,false);
  panel.refresh();assert.equal(shadingDetails(panel.root).open,false);
  const d2=shadingDetails(panel.root);d2.open=true;await d2.act('toggle');
  panel.refresh();assert.equal(shadingDetails(panel.root).open,true);
}));

test('Region button previews with no writes, then requires backup and confirmation before creating native Region',()=>harness(async({panel,overlay,service,scene,dialogs,flush,messages})=>{
  const baselineWrites=scene.writes;
  await click(panel.root,'To Region');flush();
  assert.equal(scene.created.length,0);
  assert.equal(scene.writes,baselineWrites);
  assert.equal(panel.regionPreview.items.length,1);
  assert.ok(overlay.svg.children.some(x=>x.attributes.class==='gridlines-region-preview'));
  await click(panel.root,'Create 1 Region');assert.equal(scene.created.length,0,'without backup acknowledgment no create');
  const ack=input(panel.root,'I have a recoverable Scene backup and approve creating these native Regions');
  ack.checked=true;await ack.act('change');
  await click(panel.root,'Create 1 Region');
  assert.equal(dialogs.length,1);assert.equal(scene.created.length,1);
  assert.equal(scene.created[0].shapes[0].x,100);
  assert.equal(scene.created[0].shapes[0].y,100);
  assert.equal(scene.created[0].shapes[0].width,200);
  assert.equal(scene.created[0].shapes[0].height,200);
  assert.equal(scene.created[0].flags.gridlines.shadeLayerId,'layer-one');
  assert.equal(service.read(scene).formats.length,2);
  assert.equal(service.read(scene).namedRanges.length,1);
  assert.equal(scene.writes,baselineWrites,'Region creation should not update shading flags');
  assert.equal(shadingDetails(panel.root).open,true);
  const existing=find(panel.root,x=>x.tag==='button'&&x.textContent==='Region exists');
  assert.ok(existing);assert.equal(existing.disabled,true);
  await click(panel.root,'To Region');
  assert.equal(panel.regionPreview.items[0].id,'layer-two');
}));

test('bulk Region preview can be cancelled, then created while preserving earlier Regions',()=>harness(async({panel,scene,flush,service})=>{
  await click(panel.root,'Preview All as Regions (2)');flush();
  assert.equal(panel.regionPreview.items.length,2);
  assert.equal(scene.created.length,0);
  await click(panel.root,'Cancel Region Preview');
  assert.equal(panel.regionPreview,null);assert.equal(scene.created.length,0);
  await click(panel.root,'Preview All as Regions (2)');
  const ack=input(panel.root,'I have a recoverable Scene backup and approve creating these native Regions');ack.checked=true;await ack.act('change');
  await click(panel.root,'Create 2 Regions');
  assert.equal(scene.created.length,2);
  assert.ok(scene.created.every(d=>d.behaviors.length===0));
  assert.equal(service.read(scene).formats.length,2);
  assert.equal(shadingDetails(panel.root).open,true);
}));

test('actual overlay resolver creates un-snapped rectangular Region despite incompatible native grid', async()=>{
  const {overlayResolver}=await import('../scripts/coordinates.js');
  const native={isSquare:true,sizeX:100,sizeY:100,
    getOffset:({x,y})=>({i:Math.floor((y-50)/100),j:Math.floor((x-100)/100)}),
    getVertices:({i,j})=>[{x:100+j*100,y:50+i*100},{x:200+j*100,y:50+i*100},
      {x:200+j*100,y:150+i*100},{x:100+j*100,y:150+i*100}],
    getCenterPoint:({i,j})=>({x:150+j*100,y:100+i*100})};
  const state=sample();
  // Actual AFT overlay is 87x62, offset 12.5px right, 7.25px down.
  state.axes={...state.axes,cellWidth:87,cellHeight:62,linkCellDimensions:false,offsetX:12.5,offsetY:7.25};
  const scene=sceneFixture();
  const res=overlayResolver(native,sceneRect,state.axes);
  const p=planFor(scene,state,['shade-a'],res);
  assert.deepEqual(p.items[0].shape,{type:'rectangle',x:199.5,y:119.25,width:174,height:124});
  const docs=await createShadingRegions({scene,state,plan:p,resolver:res,sceneRect,displayName:()=>"G14"});
  assert.deepEqual(docs[0].shapes[0],p.items[0].shape);
  assert.equal(docs[0].shapes[0].x%100,99.5,'Region is NOT snapped to native grid');
});

test('existing native Regions not associated with a shade are never replaced, edited or removed',async()=>{
  const scene=sceneFixture(),state=sample();
  const native={name:'Existing Foundry region',id:'existing',shapes:[{type:'rectangle',x:1,y:2,width:3,height:4}],flags:{other:{keep:true}}};
  scene.regions.contents.push(structuredClone(native));
  const plan=planFor(scene,state);
  await createShadingRegions({scene,state,plan,resolver:resolver(),sceneRect,displayName:()=>"G14"});
  assert.deepEqual(scene.regions.contents[0],native);
  assert.equal(scene.regions.contents.length,2);
  assert.equal(state.formats.length,1);
});

test('GM closing Region preview and cancelling a shading edit writes nothing',()=>harness(async({panel,scene,service})=>{
  const baselineWrites=scene.writes;
  await click(panel.root,'Configure');
  let label=input(panel.root,'Shading label (optional)');label.value='Uncommitted';await label.act('input');
  await click(panel.root,'Cancel Shading Edit');
  assert.equal(service.read(scene).formats[0].label,undefined);
  await click(panel.root,'Preview All as Regions (2)');
  await click(panel.root,'Cancel Region Preview');
  assert.equal(scene.writes,baselineWrites);
  assert.equal(scene.created.length,0);
  assert.equal(shadingDetails(panel.root).open,true);
}));
