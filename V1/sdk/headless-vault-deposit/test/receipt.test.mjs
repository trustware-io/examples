import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {encodeEventTopics,encodeAbiParameters} from 'viem';
import {destinationReceipt,rememberStatus,bindDestination,normalizeTracking,explorer} from '../lib/receipt.mjs';
import {depositEvent} from '../lib/destination.mjs';
import {ReceiptView} from '../lib/receipt-view.mjs';
import {recover} from '../lib/core.mjs';
import {boundedJson} from '../lib/request.mjs';
const a=n=>'0x'+n.repeat(40),hash='0x'+'a'.repeat(64),dest='0x'+'b'.repeat(64),blockHash='0x'+'c'.repeat(64);
const record={intentId:'offline-intent',hash,account:a('1'),sourceToken:a('2'),requestedSourceAmount:'5200000000',chainId:'42161',destinationChain:'1',vault:a('3'),fundAmount:'50000000',created:1};
const config={sources:[{chainId:'42161',tokens:[{address:a('2'),decimals:8,symbol:'TEST'}]}],vault:{address:a('3'),asset:a('4'),chainId:'1',decimals:6,symbol:'USDC'}};
const deposit={address:a('3'),topics:encodeEventTopics({abi:depositEvent,eventName:'Deposit',args:{sender:a('5'),owner:a('1')}}),data:encodeAbiParameters([{type:'uint256'},{type:'uint256'}],[50000000n,45000000000000000000n])};
const rpc=()=>({getChainId:async()=>1,getTransactionReceipt:async()=>({transactionHash:dest,status:'success',blockNumber:9n,blockHash,logs:[deposit]}),getBlock:async()=>({hash:blockHash,timestamp:1700000000n}),readContract:async({address,functionName})=>functionName==='asset'?a('4'):address===a('3')?18:6});
const storage=()=>{let saved;return {setItem:(_k,v)=>saved=v,getItem:()=>saved};};
const render=record=>renderToStaticMarkup(createElement(ReceiptView,{record,config}));
const wire={intent_id:record.intentId,from_chain_id:'42161',to_chain_id:'1',source_tx_hash:hash,dest_tx_hash:dest,from_chain_tx_url:`https://arbiscan.io/tx/${hash}`,to_chain_tx_url:`https://etherscan.io/tx/${dest}`,from_chain_block:'8',to_chain_block:'9',status:'success',create_date:'2026-01-01T00:00:00Z',update_date:'2026-01-01T00:01:00Z',time_spent_ms:60000,to_amount_wei:'50000000',landed_amount_verified:true};
test('raw REST and camel SDK status yield identical durable receipt; lifecycle dates are not block time',async()=>{
 for(const payload of [wire,normalizeTracking(wire)]) {
  const store=storage(),calls=[];
  const result=await recover(record,async action=>{calls.push(action);return action==='status'?payload:{};},{attempts:1});
  let next=rememberStatus(record,result.status,store);
  let html=render(next);
  for(const text of ['arbiscan.io/tx/'+hash,'etherscan.io/tx/'+dest,'52 TEST','50 USDC','Lifecycle created (API; not block confirmation)','2026-01-01T00:01:00Z','credit UNVERIFIED','no API block timestamp field'])assert.ok(html.includes(text),text);
  assert.ok(!html.includes('Vault credit verified'));
  next.destinationProof=await destinationReceipt(config,next,dest,rpc());
  store.setItem('',JSON.stringify(next));next=JSON.parse(store.getItem());html=render(next);
  for(const text of ['2023-11-14T22:13:20.000Z','50 underlying','45 vault shares','provider-associated'])assert.ok(html.includes(text),text);
  assert.deepEqual(calls,['receipt','status']);
  assert.equal((await destinationReceipt(config,next,dest,rpc(),true)).routeAssociated,false);
 }
});
test('missing fields, false or nonboolean verification, and success alone never confirm landed amount or shares',()=>{
 for(const status of [{status:'pending'},{status:'success'}, {...wire,landed_amount_verified:false},{...wire,landed_amount_verified:'true'}, {...wire,to_amount_wei:'bad'}]) {
  const next=rememberStatus(record,status,storage()),html=render(next);
  assert.match(html,/credit UNVERIFIED/);assert.ok(!html.includes('50 USDC'));assert.ok(!html.includes('45 vault shares'));
 }
 assert.equal(bindDestination(record,{...wire,intent_id:'other'}),null);
 assert.throws(()=>rememberStatus(record,{...wire,source_tx_hash:dest},storage()),/hash mismatch/);
 assert.throws(()=>rememberStatus(record,{...wire,to_chain_id:'10'},storage()),/chain mismatch/);
 assert.equal(explorer('1',dest,'javascript:alert(1)'),`https://etherscan.io/tx/${dest}`);
});
test('pending and never-settling status timeout retain intent/hash and never resend',async()=>{
 for(const status of [async()=>({status:'pending'}),()=>new Promise(()=>{})]) {
  const calls=[];const result=await recover(record,async action=>{calls.push(action);return action==='status'?status():{};},{attempts:1,timeout:5});
  const next=rememberStatus(record,result.status,storage());assert.equal(next.hash,hash);assert.equal(next.intentId,record.intentId);
  assert.match(result.message,/Tracking paused/);assert.deepEqual(calls,['receipt','status']);assert.match(render(next),/credit UNVERIFIED/);
 }
});
test('destination check independently reads share decimals and rejects metadata mismatch or absent deposit',async()=>{
 const c=rpc();c.readContract=async({functionName})=>functionName==='asset'?a('4'):8;await assert.rejects(destinationReceipt(config,record,dest,c),/decimals/);
 const empty=rpc(),get=empty.getTransactionReceipt;empty.getTransactionReceipt=async()=>({...await get(),logs:[]});await assert.rejects(destinationReceipt(config,record,dest,empty),/UNVERIFIED/);
 const noTime=rpc();noTime.getBlock=async()=>({hash:blockHash});assert.equal((await destinationReceipt(config,record,dest,noTime)).timestamp,null);
});
test('streaming request limit rejects oversized payload before JSON parsing and accepts chunked JSON',async()=>{
 await assert.rejects(boundedJson(new Request('http://localhost',{method:'POST',body:'x'.repeat(4097)})),/too large/);
 const encoder=new TextEncoder();const body=new ReadableStream({start(c){c.enqueue(encoder.encode('{"action":'));c.enqueue(encoder.encode('"status"}'));c.close();}});
 assert.deepEqual(await boundedJson(new Request('http://localhost',{method:'POST',body,duplex:'half'})),{action:'status'});
});
