import test from 'node:test';
import assert from 'node:assert/strict';
import {GridlinesPanel} from '../scripts/panel.js';
import {SceneService} from '../scripts/service.js';
import {parseRange} from '../scripts/coordinates.js';
import {addFill} from '../scripts/model.js';

class MockEl {
  constructor(tag) {
    this.tag=tag;this.tagName=tag.toUpperCase();this.children=[];this.listeners={};
    this.value='';this.checked=false;this.textContent='';this.style={};this.type='';this.dataset={};
  }
  append(...nodes){this.children.push(...nodes);}
  remove(){}
  replaceChildren(...nodes){this.children=[...nodes];}
  setAttribute(name,value){this[name]=value;}
  addEventListener(name,fn){this.listeners[name]=fn;}
  async act(name){return await this.listeners[name]?.({preventDefault(){},target:this});}
}
function locate(root,predicate){
  if(predicate(root))return root;
  for(const child of root.children){const found=locate(child,predicate);if(found)return found;}
  return null;
}
function inputFor(root,label){
  const wrap=locate(root,e=>e.tag==='label' && e.children.some(c=>c.tag==='span'&&c.textContent===label));
  assert.ok(wrap,`Expected setting ${label}`);
  return locate(wrap,e=>e.tag==='input');
}
function press(root,label){const btn=locate(root,e=>e.tag==='button'&&e.textContent===label);assert.ok(btn,`Expected button ${label}`);return btn.act('click');}
function fakeScene(){
  let state=null, writes=0;
  const scene={id:'mock-scene',width:2000,height:2000,padding:0,_source:{grid:{type:1,size:100}},
    getDimensions:()=>({sceneRect:{x:0,y:0,width:2000,height:2000}}),
    getFlag:()=>state?structuredClone(state):null,
    async setFlag(_id,_key,data){writes++;state=structuredClone(data);return data;},
    get writes(){return writes;}
  };
  scene.grid={isSquare:true,size:100,sizeX:100,sizeY:100,
    getOffset:({x,y})=>({i:Math.floor(y/100),j:Math.floor(x/100)}),
    getVertices:({i,j})=>[{x:j*100,y:i*100},{x:(j+1)*100,y:i*100},{x:(j+1)*100,y:(i+1)*100},{x:j*100,y:(i+1)*100}],
    getCenterPoint:({i,j})=>({x:(j+.5)*100,y:(i+.5)*100})};
  return scene;
}

test('Grid Setup inputs preview immediately but save only when approved; existing named content guarded',async()=>{
  const old={document:globalThis.document,game:globalThis.game,canvas:globalThis.canvas,ui:globalThis.ui};
  try {
    globalThis.document={body:new MockEl('body'),createElement:t=>new MockEl(t)};
    globalThis.game={user:{isGM:true}};
    const scene=fakeScene();
    const pans=[];
    globalThis.canvas={ready:true,scene,grid:scene.grid,dimensions:scene.getDimensions(),animatePan:async(p)=>{pans.push(p);return true;}};
    const messages=[];
    globalThis.ui={notifications:{info:m=>messages.push(m),error:m=>messages.push(m)}};
    const service=new SceneService({isGM:()=>true});
    await service.enable(scene);
    const overlay={selecting:false,root:{},previewAxes:null,localVisible:true,
      setSelecting(x){this.selecting=x;},setSelection(x){this.selection=x;},setSceneState(){},setPreviewAxes(value){this.previewAxes=value;},
      get geometryPreviewPending(){return Boolean(this.previewAxes && this.previewAxes.offsetX!==0);}};
    const panel=new GridlinesPanel(service,overlay);
    panel.open();
    await panel.go('B2');
    assert.equal(pans.at(-1).x,1500);
    assert.equal(pans.at(-1).y,1500);
    await panel.go('cell:B2');
    assert.equal(pans.at(-1).x,150);
    assert.equal(pans.at(-1).y,150);
    const color=inputFor(panel.root,'Gridline color');
    color.value='#ff0033';await color.act('input');
    assert.equal(overlay.previewAxes.color,'#ff0033');
    const opacity=inputFor(panel.root,'Gridline opacity %');
    opacity.value='30';await opacity.act('input');
    const thick=inputFor(panel.root,'Major line width (px)');
    thick.value='7';await thick.act('input');
    assert.equal(overlay.previewAxes.alpha,.3);
    assert.equal(overlay.previewAxes.majorWidth,7);
    assert.equal(scene.writes,1,'preview must not write flags');
    await press(panel.root,'Save Grid Setup');
    assert.equal(scene.writes,2);
    assert.equal(service.read(scene).axes.color,'#ff0033');
    assert.equal(service.read(scene).axes.alpha,.3);
    assert.equal(service.read(scene).axes.majorWidth,7);
    assert.equal(overlay.previewAxes,null);
    assert.equal(scene._source.grid.size,100,'native grid unchanged');

    await service.edit(scene,2,state=>addFill(state,parseRange('D3:F5'),'#123456',.5,'f1'));
    panel.refresh();
    const ox=inputFor(panel.root,'Offset X (px)');
    ox.value='22';await ox.act('input');
    assert.equal(overlay.previewAxes.offsetX,22);
    assert.equal(scene.writes,3,'moving overlay preview must not write flags');
    await press(panel.root,'Save Grid Setup');
    assert.equal(scene.writes,3,'cannot commit geometry shift without confirmation');
    assert.ok(messages.some(m=>m.includes('Back up')));
    const label=locate(panel.root,e=>e.tag==='label'&&e.children.some(c=>c.tag==='span'&&c.textContent.startsWith('I have a recoverable backup')));
    assert.ok(label);
    const check=locate(label,e=>e.tag==='input');check.checked=true;
    await press(panel.root,'Save Grid Setup');
    assert.equal(scene.writes,4);
    assert.equal(service.read(scene).axes.offsetX,22);
    assert.equal(service.read(scene).formats[0].range.from.col,3,'existing cells retain indices');
    panel.close();
  } finally {for(const [key,val] of Object.entries(old)){if(val===undefined)delete globalThis[key];else globalThis[key]=val;}}
});
