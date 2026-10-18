import test from 'node:test';
import assert from 'node:assert/strict';
import {newState,addFill,addNamedRange,normalizeAxes,validateAxes,validateState,setPlayerGridVisible,
  setShadingPlayerVisible,projectPlayerView,clearShadingInSelection,updateShadingLayer} from '../scripts/model.js';
import {parseRange} from '../scripts/coordinates.js';
import {SceneService} from '../scripts/service.js';
import {GridlinesOverlay} from '../scripts/overlay.js';
import {GridlinesPanel} from '../scripts/panel.js';
const baseline={type:1,size:100,width:2000,height:1600,padding:0,sceneX:0,sceneY:0,gridOriginX:0,gridOriginY:0};
function fixture(){
  const s=newState(baseline);
  addFill(s,parseRange('B2:C3'),'#ff0000',.3,'public-1');
  addFill(s,parseRange('E3:F4'),'#0000ff',.6,'gm-only-2');
  addNamedRange(s,'SECRET GM LAYER NAME',parseRange('E3:F4'),'hidden-range');
  return s;
}
test('existing records without visibility fields remain GM-only; no automatic migration',()=>{
  const s=fixture();delete s.playerGridVisible;delete s.formats[0].playerVisible;delete s.formats[1].playerVisible;
  validateState(s);
  assert.equal(projectPlayerView(s),null);
  assert.ok(!('playerGridVisible' in s),'projection must not rewrite old flags');
  assert.ok(!('playerVisible' in s.formats[0]));
});
test('independent publication: sharing the grid never publishes private shading or named ranges',()=>{
  const s=fixture();setPlayerGridVisible(s,true);
  const before=structuredClone(s);const publicView=projectPlayerView(s);
  assert.ok(publicView);assert.equal(publicView.axes.enabled,true);assert.equal(publicView.formats.length,0);
  assert.deepEqual(publicView.namedRanges,[]);
  assert.doesNotMatch(JSON.stringify(publicView),/SECRET GM LAYER NAME|hidden-range|gm-only-2|public-1/);
  assert.deepEqual(s,before,'no Scene edits from projection');
  setPlayerGridVisible(s,false);assert.equal(projectPlayerView(s),null);
});
test('a published shade stays visible without the coordinate grid, while private layers never render',()=>{
  const s=fixture();setShadingPlayerVisible(s,'public-1',true);
  const pub=projectPlayerView(s);
  assert.equal(pub.axes.enabled,false);assert.equal(pub.axes.labels,false);
  assert.equal(pub.formats.length,1);assert.equal(pub.formats[0].fill,'#ff0000');
  assert.equal(Object.hasOwn(pub.formats[0],'id'),false);
  assert.equal(Object.hasOwn(pub.formats[0],'label'),false);
  assert.equal(pub.namedRanges.length,0);
  setPlayerGridVisible(s,true);
  const both=projectPlayerView(s);assert.equal(both.axes.enabled,true);assert.equal(both.formats.length,1);
  setShadingPlayerVisible(s,'public-1',false);assert.equal(projectPlayerView(s).formats.length,0);
  assert.equal(projectPlayerView(s).axes.enabled,true);
});
test('publication retains shading styles across configuration and split removal',()=>{
  const s=fixture();setShadingPlayerVisible(s,'public-1',true);
  updateShadingLayer(s,'public-1',{label:'Public staging',fill:'#ffff00',opacity:.4});
  assert.equal(s.formats[0].playerVisible,true);
  const cut=parseRange('B2');
  clearShadingInSelection(s,cut,()=>`new-${Math.random()}`);
  assert.ok(s.formats.filter(f=>f.fill==='#ffff00').every(f=>f.playerVisible===true));
  assert.equal(s.formats.find(f=>f.id==='gm-only-2').playerVisible,false);
});
test('invalid sharing settings and placements fail validation before Scene writes',()=>{
  const s=fixture();
  assert.throws(()=>setPlayerGridVisible(s,'yes'),/on or off/);
  assert.throws(()=>setShadingPlayerVisible(s,'public-1',1),/on or off/);
  assert.throws(()=>setShadingPlayerVisible(s,'no-such-shade',true),/no longer exists/);
  s.formats[0].playerVisible='true';assert.throws(()=>validateState(s),/shading player visibility/);
  s.formats[0].playerVisible=false;s.playerGridVisible=1;assert.throws(()=>validateState(s),/grid visibility/);
  assert.equal(normalizeAxes({}).colLabelPosition,'top');assert.equal(normalizeAxes({}).rowLabelPosition,'left');
  assert.throws(()=>validateAxes({...normalizeAxes({}),colLabelPosition:'middle'}),/label placement/);
  assert.throws(()=>validateAxes({...normalizeAxes({}),rowLabelPosition:'center'}),/label placement/);
  for (const choice of ['top','bottom','both','off']) assert.equal(validateAxes({...normalizeAxes({}),colLabelPosition:choice}).colLabelPosition,choice);
  for (const choice of ['left','right','both','off']) assert.equal(validateAxes({...normalizeAxes({}),rowLabelPosition:choice}).rowLabelPosition,choice);
});
class El {
  constructor(tag){this.tag=tag;this.tagName=tag.toUpperCase();this.children=[];this.style={position:''};this.attributes={};this.events={};this.parentElement=null;
    this.type='';this.value='';this.checked=false;this.textContent='';this.isConnected=true;this.open=false;this.scrollTop=0;this.scrollLeft=0;
    this.classList={toggle:()=>{}};this.rect={left:0,top:0,right:2000,bottom:1600,width:2000,height:1600};}
  append(...xs){for(const x of xs){x.parentElement=this;this.children.push(x);}}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(x=>x!==this);this.parentElement=null;}
  replaceChildren(...xs){this.children=[];this.append(...xs);}
  addEventListener(k,f){this.events[k]=f;}
  removeEventListener(k){delete this.events[k];}
  setAttribute(k,v){this.attributes[k]=String(v);}
  getBoundingClientRect(){return this.rect;}
  async act(k){return this.events[k]?.({button:0,preventDefault(){},stopPropagation(){},target:this});}
}
const find=(root,fn)=>fn(root)?root:root.children.map(c=>find(c,fn)).find(Boolean);
const all=(root,fn)=>(fn(root)?[root]:[]).concat(root.children.flatMap(c=>all(c,fn)));
const button=(root,txt)=>{const b=find(root,x=>x.tag==='button'&&x.textContent===txt);assert.ok(b,`Button missing: ${txt}`);return b;};
const inputFor=(root,txt)=>{const wrap=find(root,x=>x.tag==='label'&&x.children.some(c=>c.tag==='span'&&c.textContent===txt));assert.ok(wrap,`Missing label ${txt}`);const ctl=find(wrap,x=>x.tag==='select'||x.tag==='input');assert.ok(ctl);return ctl;};
async function withFoundry(isGM,fn) {
  const saved={document:globalThis.document,game:globalThis.game,canvas:globalThis.canvas,ui:globalThis.ui,
    requestAnimationFrame:globalThis.requestAnimationFrame,cancelAnimationFrame:globalThis.cancelAnimationFrame,
    ResizeObserver:globalThis.ResizeObserver,getComputedStyle:globalThis.getComputedStyle};
  let overlay,panel;
  try{
    const body=new El('body'),parent=new El('div'),view=new El('canvas');body.append(parent);parent.append(view);
    let documentEvents=0,viewEvents=0;
    view.addEventListener=(k,cb)=>{viewEvents++;view.events[k]=cb;};
    globalThis.document={body,createElement:t=>new El(t),createElementNS:(_,t)=>new El(t),querySelector:()=>null,
      addEventListener(){documentEvents++;},removeEventListener(){}};
    globalThis.getComputedStyle=()=>({position:'relative'});
    globalThis.ResizeObserver=class{observe(){}disconnect(){}};
    globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=()=>{};
    globalThis.game={user:{isGM}};
    let data=null,writes=0;
    const scene={id:'scene-public',width:2000,height:1600,padding:0,_source:{grid:{size:100,type:1}},
      getDimensions:()=>({sceneRect:{x:0,y:0,width:2000,height:1600}}),getFlag:()=>structuredClone(data),
      async setFlag(a,b,v){data=structuredClone(v);writes++;},get writes(){return writes;}};
    scene.grid={size:100,sizeX:100,sizeY:100,isSquare:true,
      getOffset:({x,y})=>({i:Math.floor(y/100),j:Math.floor(x/100)}),
      getVertices:({i,j})=>[{x:j*100,y:i*100},{x:(j+1)*100,y:i*100},{x:(j+1)*100,y:(i+1)*100},{x:j*100,y:(i+1)*100}],
      getCenterPoint:({i,j})=>({x:(j+.5)*100,y:(i+.5)*100})};
    globalThis.canvas={ready:true,scene,grid:scene.grid,dimensions:scene.getDimensions(),app:{canvas:view},
      canvasCoordinatesFromClient:x=>x,clientCoordinatesFromCanvas:x=>x};
    globalThis.ui={notifications:{info(){},warn(){},error(){}}};
    data=fixture();
    overlay=new GridlinesOverlay();overlay.snapshotProvider=()=>baseline;
    overlay.attach();overlay.setSceneState(isGM ? data : projectPlayerView(data));
    panel=new GridlinesPanel(new SceneService({isGM:()=>isGM}),overlay);
    await fn({overlay,panel,scene,view,body,data:()=>structuredClone(data),viewEvents:()=>viewEvents,documentEvents:()=>documentEvents});
  } finally {
    overlay?.dispose();panel?.close();
    for(const [key,val] of Object.entries(saved)){if(val===undefined)delete globalThis[key];else globalThis[key]=val;}
  }
}
test('player canvas is read-only: visible SVG does not intercept clicks or expose GM controls',async()=>{
  await withFoundry(false,async({overlay,panel,viewEvents,documentEvents})=>{
    assert.equal(viewEvents(),0);assert.equal(documentEvents(),0);
    assert.equal(overlay.selecting,false);
    overlay.setSelecting(true);assert.equal(overlay.selecting,false);
    assert.throws(()=>overlay.startPlacement('drag'),/GMs/);
    assert.throws(()=>overlay.startCalibration(5),/GMs/);
    assert.throws(()=>overlay.setSelectionMode('fine'),/GMs/);
    panel.open();assert.equal(panel.root,undefined,'the player cannot open the GM manager');
    overlay.onDown({button:0});assert.equal(overlay.dragStart,null);
  });
});
test('player renderer draws published shade only and no hidden formats, names, or interactive selection',async()=>{
  await withFoundry(false,async({overlay})=>{
    const s=fixture();setShadingPlayerVisible(s,'public-1',true);overlay.sceneState=projectPlayerView(s);
    overlay.render();const rects=all(overlay.svg,x=>x.tag==='rect');
    assert.ok(rects.some(x=>x.attributes.fill==='#ff0000'));
    assert.ok(!rects.some(x=>x.attributes.fill==='#0000ff'));
    assert.ok(!rects.some(x=>x.attributes.stroke==='#eab75e'));
    assert.equal(all(overlay.svg,x=>x.tag==='path'&&x.attributes.class==='gridlines-major-axes').length,0);
    setPlayerGridVisible(s,true);overlay.sceneState=projectPlayerView(s);
    overlay.render();assert.ok(all(overlay.svg,x=>x.tag==='path'&&x.attributes.class==='gridlines-major-axes').length);
    assert.ok(all(overlay.svg,x=>x.tag==='text'&&x.attributes.class==='gridlines-axis-label').length);
  });
});
test('column and row labels support top/bottom and left/right/both, with independent off values',async()=>{
  await withFoundry(false,async({overlay})=>{
    const s=fixture();setPlayerGridVisible(s,true);
    s.axes={...s.axes,colLabelPosition:'both',rowLabelPosition:'both'};
    overlay.sceneState=projectPlayerView(s);overlay.render();
    let labels=all(overlay.svg,x=>x.tag==='text'&&x.attributes.class==='gridlines-axis-label');
    const byEdge=edge=>labels.filter(x=>x.attributes['data-edge']===edge);
    for(const edge of ['top','bottom','left','right']) assert.ok(byEdge(edge).length,`Missing ${edge} labels`);
    assert.ok(byEdge('bottom').every(x=>Number(x.attributes.y)>1500));
    assert.ok(byEdge('right').every(x=>Number(x.attributes.x)>1900));
    assert.ok(byEdge('right').every(x=>x.attributes['text-anchor']==='end'));
    s.axes.colLabelPosition='off';s.axes.rowLabelPosition='right';
    overlay.sceneState=projectPlayerView(s);overlay.render();
    labels=all(overlay.svg,x=>x.tag==='text'&&x.attributes.class==='gridlines-axis-label');
    assert.ok(labels.every(x=>x.attributes['data-edge']==='right'));
  });
});
test('GM publishing the grid and one shade writes only consented fields; changing labels is preview-only until saved',async()=>{
  await withFoundry(true,async({panel,overlay,scene,data})=>{
    panel.open();
    assert.ok(button(panel.root,'Show Coordinate Grid to Players'));
    await button(panel.root,'Show Coordinate Grid to Players').act('click');
    assert.equal(data().playerGridVisible,true);
    assert.equal(data().formats.filter(x=>x.playerVisible===true).length,0);
    assert.ok(button(panel.root,'Hide Coordinate Grid from Players'));
    assert.equal(button(panel.root,'Player Visible: Off').tag,'button');
    await button(panel.root,'Player Visible: Off').act('click');
    const layers=find(panel.root,x=>x.tag==='details'&&x.children.some(c=>c.tag==='summary'&&c.textContent.startsWith('Shading layers')));
    assert.ok(layers && layers.open,'visibility toggle does not collapse shading layers');
    assert.equal(data().formats.filter(x=>x.playerVisible===true).length,1);
    assert.equal(data().formats.filter(x=>x.playerVisible===false).length,1);
    const initialWrites=scene.writes;
    const col=inputFor(panel.root,'Column letters placement'),row=inputFor(panel.root,'Row numbers placement');
    col.value='both';await col.act('change');row.value='both';await row.act('change');
    assert.equal(overlay.previewAxes.colLabelPosition,'both');
    assert.equal(overlay.previewAxes.rowLabelPosition,'both');
    assert.equal(scene.writes,initialWrites);
    await button(panel.root,'Save Grid Setup').act('click');
    assert.equal(data().axes.colLabelPosition,'both');
    assert.equal(data().axes.rowLabelPosition,'both');
    assert.equal(data().namedRanges[0].id,'hidden-range');
    await button(panel.root,'Hide Coordinate Grid from Players').act('click');
    assert.equal(data().playerGridVisible,false);
    assert.equal(projectPlayerView(data()).formats.length,1,'sharing grid is independent of sharing shade');
    assert.equal(data().formats.find(x=>x.id==='gm-only-2').playerVisible,false,'other shade remains hidden');
  });
});
test('players are refused Scene writes by service, regardless of flags',async()=>{
  const svc=new SceneService({isGM:()=>false});const scene={getFlag:()=>fixture()};
  await assert.rejects(()=>svc.edit(scene,1,()=>{}),/GM access required/);
  await assert.rejects(()=>svc.enable(scene),/GM access required/);
});
