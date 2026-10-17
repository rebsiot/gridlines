import test from 'node:test';
import assert from 'node:assert/strict';

test('module hooks register v14 Scene Controls GM-only; no automatic writes on ready', async () => {
  const previous={Hooks:globalThis.Hooks,game:globalThis.game,canvas:globalThis.canvas};
  try {
    const listeners=new Map();
    globalThis.Hooks={on:(name,fn)=>listeners.set(name,fn),once:(name,fn)=>listeners.set(name,fn)};
    const module={api:null};
    globalThis.game={user:{isGM:true},modules:new Map([['gridlines',module]])};
    globalThis.canvas={ready:false,scene:null};
    await import('../scripts/main.js');
    for(const h of ['getSceneControlButtons','canvasReady','canvasPan','canvasTearDown','updateScene','ready']) assert.ok(listeners.has(h));
    const gmControls={};
    listeners.get('getSceneControlButtons')(gmControls);
    assert.equal(gmControls.gridlines.name,'gridlines');
    assert.equal(gmControls.gridlines.tools.select.name,'select');
    assert.equal(gmControls.gridlines.tools.manage.button,true);
    globalThis.game.user.isGM=false;
    const playerControls={};
    listeners.get('getSceneControlButtons')(playerControls);
    assert.equal(Object.hasOwn(playerControls,'gridlines'),false);
    listeners.get('ready')();
    assert.equal(module.api.parseAddress('AA7').col,26);
    assert.equal(module.api.getState(),null);
  } finally {for(const [key,val] of Object.entries(previous)){if(val===undefined)delete globalThis[key];else globalThis[key]=val;}}
});