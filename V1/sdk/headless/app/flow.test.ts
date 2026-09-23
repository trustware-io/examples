import test from 'node:test';
import assert from 'node:assert/strict';
import { Flow, validateInput, validateRoute, guardedWallet, type Input } from './flow.ts';
import type { BuildRouteResult, TrustwareCore } from '@trustware/sdk';

test('input invalidation during final account read blocks execution',async()=>{
  let resolve!:(v:string)=>void;
  const s=setup({getAddress:()=>new Promise(r=>{resolve=r;})});
  await s.flow.build(input); const pending=s.flow.execute();
  s.flow.invalidate(); resolve(A);
  await assert.rejects(()=>pending); assert.ok(!s.calls.includes('send'));
});
test('cancelled build cannot restore an obsolete review',async()=>{
  let resolve!:(r:BuildRouteResult)=>void;
  const s=setup({buildRoute:()=>new Promise(r=>{resolve=r;})});
  const pending=s.flow.build(input); s.flow.invalidate(); resolve(route()); await pending;
  assert.equal(s.flow.state.phase,'idle'); assert.equal(s.flow.review,undefined);
});
test('the displayed review cannot mutate the executable route',async()=>{
  const s=setup(); await s.flow.build(input);
  assert.throws(()=>{s.flow.review!.result.txReq.to=A;});
});
test('failed status is failure and nonterminal status times out without success',async()=>{
  const s=setup({getStatus:async()=>({status:'failed'}) as never});
  await s.flow.build(input); await s.flow.execute(); assert.equal(s.flow.state.phase,'failed');
  const p=setup({getStatus:async()=>({status:'bridging'}) as never});
  await p.flow.build(input); await p.flow.execute(); assert.equal(p.flow.state.phase,'reconcile');
});
const A = '0x1111111111111111111111111111111111111111';
const B = '0x2222222222222222222222222222222222222222';
const H = `0x${'a'.repeat(64)}`;
const input: Input = { fromChain:'8453', toChain:'8453', fromToken:A, toToken:B, fromAmount:'1000000', fromAddress:A, toAddress:A };
const route = (): BuildRouteResult => ({ intentId:'intent-example', txReq:{to:B,data:'0xabcd',value:'0',chainId:8453}, actions:[],finalExchangeRate:{}, route:{estimate:{fromAmount:'1000000',toAmountMin:'950000'}, execution:{approvals:[{tokenAddress:A,spender:B,amount:'1000000',chainId:'8453'}]}} });
function setup(overrides: Partial<TrustwareCore> = {}) {
  const calls:string[]=[]; let saved=''; let now=0;
  const sdk = {
    buildRoute:async()=>{calls.push('build');return route();},
    getAddress:async()=>A,
    sendRouteTransaction:async()=>{calls.push('send'); return H;},
    submitReceipt:async()=>{calls.push('receipt');},
    getStatus:async()=>{calls.push('status'); return {status:'success',intentId:'intent-example'};},
    ...overrides,
  } as unknown as TrustwareCore;
  const store={getItem:()=>saved||null,setItem:(_k:string,v:string)=>{saved=v;}};
  const flow=new Flow(sdk,store,()=>{},()=>now,10);
  return {flow,calls,store,advance:()=>{now=60000;},saved:()=>saved};
}
test('input accepts same-chain and cross-chain routes without changing base units',()=>{
  assert.equal(validateInput(input).fromAmount,'1000000');
  assert.equal(validateInput({...input,toChain:'1'}).toChain,'1');
});
test('rejects fractional, exponent, zero amounts and unsupported chains or addresses',()=>{
  for(const fromAmount of ['0','1.2','1e6','-1',' 1']) assert.throws(()=>validateInput({...input,fromAmount}));
  assert.throws(()=>validateInput({...input,toChain:'solana'}));
  assert.throws(()=>validateInput({...input,toAddress:'0x0'}));
});
test('rejects sponsored, wrong-chain and malformed route execution',()=>{
  validateRoute(route(),input);
  for(const r of [{...route(),sponsorship:{}},{...route(),txReq:{...route().txReq,chainId:1}},{...route(),txReq:{...route().txReq,data:'invalid'}}]) assert.throws(()=>validateRoute(r as BuildRouteResult,input));
});
test('build never sends; confirmation sends once then submits receipt and tracks',async()=>{
  const {flow,calls,saved}=setup(); await flow.build(input);
  assert.deepEqual(calls,['build']); await flow.execute();
  assert.deepEqual(calls,['build','send','receipt','status']);
  assert.equal(flow.state.phase,'success'); assert.equal(JSON.parse(saved()).hash,H);
  await assert.rejects(()=>flow.execute()); assert.equal(calls.filter(x=>x==='send').length,1);
});
test('source drift and expired review prevent sending',async()=>{
  const d=setup({getAddress:async()=>B}); await d.flow.build(input);
  await assert.rejects(()=>d.flow.execute()); assert.ok(!d.calls.includes('send'));
  const e=setup(); await e.flow.build(input); e.advance();
  await assert.rejects(()=>e.flow.execute()); assert.ok(!e.calls.includes('send'));
});
test('receipt failure preserves hash and recovery never rebroadcasts',async()=>{
  const {flow,calls,saved}=setup({submitReceipt:async()=>{throw Error('offline');}});
  await flow.build(input); await flow.execute();
  assert.equal(flow.state.phase,'reconcile'); assert.equal(JSON.parse(saved()).hash,H);
  await flow.resume(); assert.equal(calls.filter(x=>x==='send').length,1);
});
test('ambiguous send persists intent before send and blocks retries after reload',async()=>{
  const s=setup({sendRouteTransaction:async()=>{assert.equal(JSON.parse(s.saved()).intentId,'intent-example');throw Error('disconnected');}});
  await s.flow.build(input); await s.flow.execute(); assert.equal(s.flow.state.phase,'reconcile');
  const recovered=new Flow({} as TrustwareCore,s.store,()=>{}); recovered.restore();
  await assert.rejects(()=>recovered.build(input)); await assert.rejects(()=>recovered.execute());
});
test('duplicate in-flight confirmation cannot call send twice',async()=>{
  let finish!:(hash:string)=>void;
  const s=setup({sendRouteTransaction:()=>new Promise(resolve=>{finish=resolve;})});
  await s.flow.build(input); const first=s.flow.execute();
  await assert.rejects(()=>s.flow.execute()); await new Promise(r=>setImmediate(r));
  finish(H); await first;
});
test('never-resolving status is bounded and unknown status is not success',async()=>{
  const s=setup({getStatus:()=>new Promise(()=>{})}); await s.flow.build(input); await s.flow.execute();
  assert.equal(s.flow.state.phase,'reconcile');
  const u=setup({getStatus:async()=>({status:'mystery'}) as never}); await u.flow.build(input); await u.flow.execute();
  assert.equal(u.flow.state.phase,'reconcile');
});
test('storage failure prevents wallet execution',async()=>{
  const s=setup(); s.store.setItem=()=>{throw Error('disabled');};
  await s.flow.build(input); await assert.rejects(()=>s.flow.execute()); assert.ok(!s.calls.includes('send'));
});
test('final wallet boundary refuses account drift and binds the submitted from address',async()=>{
  let account=A; const calls:string[]=[];
  const provider={request:async({method}:{method:string})=>{calls.push(method);if(method==='eth_accounts')return[account];if(method==='eth_chainId')return'0x2105';return H;}};
  const wallet=guardedWallet(provider,A,'8453',()=>true);
  assert.equal(await wallet.getAddress(),A);
  account=B; await assert.rejects(()=>wallet.request({method:'eth_sendTransaction',params:[{from:A}]}));
  assert.ok(!calls.includes('eth_sendTransaction'));
  account=A; await assert.rejects(()=>wallet.request({method:'eth_sendTransaction',params:[{from:B}]}));
  assert.equal(await wallet.request({method:'eth_sendTransaction',params:[{from:A}]}),H);
});
