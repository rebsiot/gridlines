import test from 'node:test';
import assert from 'node:assert/strict';
import {calibrateGuide, guideBounds, CALIBRATION_PRESETS} from '../scripts/calibration.js';

const base = {nativeOrigin:{x:0,y:0},nativeSize:100,axes:{offsetX:0,offsetY:0}};

test('Calibration presets are 10x10, 5x5 and 1x1',()=>{
  assert.deepEqual([...CALIBRATION_PRESETS],[10,5,1]);
  for(const cells of CALIBRATION_PRESETS){
    const measured=calibrateGuide({...base,cells,from:{x:25,y:40},to:{x:25+cells*100,y:40+cells*100}});
    assert.equal(measured.mode,'square');
    assert.equal(measured.recommended.cellSize,100);
    assert.equal(measured.recommended.offsetX,25);
    assert.equal(measured.recommended.offsetY,40);
  }
});

test('Square corner drag direction does not affect calibration',()=>{
  const forward=calibrateGuide({...base,cells:10,from:{x:230,y:160},to:{x:1230,y:1160}});
  const reversed=calibrateGuide({...base,cells:10,from:{x:1230,y:1160},to:{x:230,y:160}});
  assert.deepEqual(forward,reversed);
  assert.deepEqual(forward.recommended,{cellSize:100,offsetX:30,offsetY:-40});
});

test('Straight horizontal guide calibrates cell size and X, preserves Y offset',()=>{
  const fit=calibrateGuide({...base,axes:{offsetX:0,offsetY:13},cells:10,
    from:{x:217,y:300},to:{x:1217,y:305}});
  assert.equal(fit.mode,'horizontal');
  assert.deepEqual(fit.recommended,{cellSize:100,offsetX:17});
  assert.equal(fit.measuredX,100);
});

test('Straight vertical guide calibrates cell size and Y, preserves X offset',()=>{
  const fit=calibrateGuide({...base,axes:{offsetX:-21,offsetY:0},cells:5,
    from:{x:150,y:130},to:{x:152,y:630}});
  assert.equal(fit.mode,'vertical');
  assert.deepEqual(fit.recommended,{cellSize:100,offsetY:30});
});

test('Start point far from map origin chooses the nearest congruent grid origin',()=>{
  const fit=calibrateGuide({...base,axes:{offsetX:80,offsetY:0},cells:5,
    from:{x:521,y:200},to:{x:1021,y:200}});
  assert.equal(fit.recommended.offsetX,121); // nearest origin to prior +80 is +121 (four cells before 521)
  assert.equal((521-fit.recommended.offsetX)%100,0);
});

test('Near-square calibration accepts small imprecision but rejects distortion',()=>{
  const fit=calibrateGuide({...base,cells:10,from:{x:0,y:0},to:{x:1020,y:980}});
  assert.equal(fit.mode,'square');
  assert.equal(fit.recommended.cellSize,100);
  assert.ok(fit.discrepancyPercent<5);
  assert.throws(()=>calibrateGuide({...base,cells:5,from:{x:0,y:0},to:{x:550,y:300}}),/straight|square/);
});

test('Too-short, malformed and unsupported calibration inputs fail without mutation',()=>{
  assert.throws(()=>calibrateGuide({...base,cells:10,from:{x:0,y:0},to:{x:80,y:80}}),/complete printed/);
  assert.throws(()=>calibrateGuide({...base,cells:3,from:{x:0,y:0},to:{x:300,y:300}}),/10x10/);
  assert.throws(()=>guideBounds({x:NaN,y:0},{x:1,y:1}),/valid map coordinates/);
  assert.throws(()=>calibrateGuide({...base,cells:1,from:{x:0,y:0},to:{x:3000,y:3000}}),/10–2000/);
});
