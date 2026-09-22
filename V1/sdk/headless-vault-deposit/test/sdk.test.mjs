import test from 'node:test';
import assert from 'node:assert/strict';
import {Trustware} from '@trustware/sdk/core';
import {transport} from '../lib/transport.mjs';
test('published 1.1.16 headless surface exists and server adapter calls exact methods',async()=>{
  for(const name of ['init','useWallet','buildRoute','sendRouteTransaction','submitReceipt','pollStatus','getBalancesByAddress']) assert.equal(typeof Trustware[name],'function',name);
  const methods=['init','buildRoute','submitReceipt','pollStatus','getBalancesByAddress'];
  const original=Object.fromEntries(methods.map(k=>[k,Trustware[k]]));
  const calls=[];
  // Synthetic credential is confined to this process; no request can leave it.
  const prior=process.env.TRUSTWARE_API_KEY, fetchBefore=globalThis.fetch;
  process.env.TRUSTWARE_API_KEY='offline-fixture-not-a-credential';
  globalThis.fetch=async()=>{throw Error('Network forbidden in offline test');};
  for(const name of methods)Trustware[name]=async(...args)=>{calls.push([name,...args]);return name==='getBalancesByAddress'?[]:name==='pollStatus'?{status:'pending'}:{intentId:'fixture'};};
  try {
    assert.deepEqual(await transport.balances('fixture-owner'),{results:[]});
    await transport.build({fromAmount:'50'});await transport.receipt('fixture','fixture-hash');await transport.status('fixture');
    assert.deepEqual(calls.map(c=>c[0]),methods.filter(k=>k==='init').concat(['getBalancesByAddress','buildRoute','submitReceipt','pollStatus']));
    assert.deepEqual(calls.at(-1),['pollStatus','fixture',{intervalMs:2000,timeoutMs:5000}]);
  } finally {Object.assign(Trustware,original);globalThis.fetch=fetchBefore;if(prior===undefined)delete process.env.TRUSTWARE_API_KEY;else process.env.TRUSTWARE_API_KEY=prior;}
});
