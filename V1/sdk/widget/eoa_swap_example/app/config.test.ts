import test from 'node:test';
import assert from 'node:assert/strict';
import { widgetSetup } from './config.ts';
const token='0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
test('widget requires a key and explicit execution opt-in before mounting',()=>{
  assert.equal(widgetSetup('', '8453',token,'true').ready,false);
  assert.equal(widgetSetup('public-browser-key','8453',token,'false').ready,false);
  const setup=widgetSetup('public-browser-key','8453',token,'true');
  assert.equal(setup.ready,true); assert.equal(setup.config.features.swapMode,true);
  assert.equal(setup.config.features.swapDefaultDestToken.chainId,8453);
});
test('widget rejects unsupported destination and malformed token',()=>{
  assert.equal(widgetSetup('key','solana',token,'true').ready,false);
  assert.equal(widgetSetup('key','8453','invalid','true').ready,false);
});
