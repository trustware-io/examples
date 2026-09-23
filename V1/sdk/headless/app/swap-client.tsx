"use client";
import { useEffect, useRef, useState } from 'react';
import { Trustware, type EIP1193 } from '@trustware/sdk';
import { CHAINS, Flow, guardedWallet, NATIVE, RECOVERY_KEY, validateInput, type State } from './flow';

const apiKey=process.env.NEXT_PUBLIC_TRUSTWARE_API_KEY||'';
const executionEnabled=process.env.NEXT_PUBLIC_ENABLE_EXECUTION==='true';
const defaults={
  fromChain:process.env.NEXT_PUBLIC_TRUSTWARE_FROM_CHAIN||'8453',
  toChain:process.env.NEXT_PUBLIC_TRUSTWARE_TO_CHAIN||'8453',
  fromToken:process.env.NEXT_PUBLIC_TRUSTWARE_FROM_TOKEN||NATIVE,
  toToken:process.env.NEXT_PUBLIC_TRUSTWARE_TO_TOKEN||'0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  fromAmount:process.env.NEXT_PUBLIC_TRUSTWARE_FROM_AMOUNT||'1000000000000000',
  toAddress:process.env.NEXT_PUBLIC_TRUSTWARE_TO_ADDRESS||'',
};
type Provider=EIP1193 & {on?:(name:string,fn:()=>void)=>void;removeListener?:(name:string,fn:()=>void)=>void};

export default function SwapClient(){
  const [form,setForm]=useState(defaults);
  const [account,setAccount]=useState('');
  const [state,setState]=useState<State>({phase:'idle'});
  const [error,setError]=useState('');
  const [connecting,setConnecting]=useState(false);
  const [ready,setReady]=useState(false);
  const [locks,setLocks]=useState(false);
  const flow=useRef<Flow|null>(null);
  const provider=useRef<Provider|null>(null);
  const connectionBusy=useRef(false);
  const contextVersion=useRef(0);
  useEffect(()=>{
    try {
      const controller=new Flow(Trustware,window.localStorage,setState);
      flow.current=controller; controller.restore(); setReady(true); setLocks(Boolean(navigator.locks));
      return ()=>{controller.dispose();flow.current=null;};
    } catch {setError('Browser storage is unavailable. Execution is blocked.');}
  },[]);
  useEffect(()=>{
    const p=(window as Window & {ethereum?:Provider}).ethereum;
    provider.current=p??null;
    const changed=()=>{
      const phase=flow.current?.state.phase;
      if(phase==='review'||phase==='building'||phase==='idle') {contextVersion.current++;flow.current?.invalidate();setAccount('');}
    };
    p?.on?.('accountsChanged',changed);p?.on?.('chainChanged',changed);
    return ()=>{p?.removeListener?.('accountsChanged',changed);p?.removeListener?.('chainChanged',changed);};
  },[]);
  const busy=connecting||['building','sending','tracking'].includes(state.phase);
  const locked=['sending','tracking','success','failed','reconcile'].includes(state.phase);
  async function initialize(){
    if(!apiKey.trim())throw Error('Missing browser-safe API key.');
    await Trustware.init({apiKey,routes:{toChain:form.toChain,toToken:form.toToken,defaultSlippage:1},autoDetectProvider:false});
  }
  async function connect(){
    if(connectionBusy.current)return;
    connectionBusy.current=true;setConnecting(true);setError('');
    try {
      if(!provider.current)throw Error('No wallet');
      const accounts=await provider.current.request({method:'eth_requestAccounts'});
      if(!Array.isArray(accounts)||typeof accounts[0]!=='string')throw Error('No account');
      setAccount(accounts[0]);flow.current?.invalidate();
    } catch {setError('Connection unavailable or rejected. Use an injected EVM wallet.');}
    finally {connectionBusy.current=false;setConnecting(false);}
  }
  function edit(key:keyof typeof defaults,value:string){
    contextVersion.current++;
    flow.current?.invalidate();setError('');setForm(current=>({...current,[key]:value}));
  }
  async function build(){
    if(connectionBusy.current||!flow.current||!provider.current)return;
    connectionBusy.current=true;setConnecting(true);setError('');
    const controller=flow.current;
    const version=contextVersion.current;
    try {
      const request=validateInput({...form,fromAddress:account,toAddress:form.toAddress||account});
      await initialize();
      if(flow.current!==controller||contextVersion.current!==version)return;
      Trustware.useWallet(guardedWallet(provider.current,account,form.fromChain,()=>controller.isCurrent()));
      await controller.build(request);
    } catch {setError('Cannot build. Check the key, wallet, inputs and any saved execution.');}
    finally {connectionBusy.current=false;setConnecting(false);}
  }
  async function execute(){
    if(!executionEnabled||!navigator.locks||!flow.current)return;
    setError('');
    try {
      // Serializes the persistence check + send across tabs on this origin.
      await navigator.locks.request(RECOVERY_KEY,{ifAvailable:true},async lock=>{
        if(!lock)throw Error('Another tab is executing.');
        await flow.current?.execute();
      });
    } catch {setError('Execution refused. Rebuild an expired review, reconnect the wallet, or reconcile a saved execution.');}
  }
  async function resume(){
    if(connectionBusy.current)return;
    connectionBusy.current=true;setConnecting(true);setError('');
    try {await initialize();await flow.current?.resume();}
    catch {setError('Tracking unavailable. Preserve the intent/hash and retry later.');}
    finally {connectionBusy.current=false;setConnecting(false);}
  }
  const review=flow.current?.review;
  const tx=state.transaction;
  return <main className="page"><section className="panel">
    <p className="eyebrow">Headless SDK · EVM wallet</p><h1>Swap or bridge</h1>
    <p className="copy">Same source and destination chain = swap. Different chains = bridge. Current route availability is not guaranteed. Amounts are integer base units, not human token units.</p>
    {!apiKey&&<p className="warning">Set NEXT_PUBLIC_TRUSTWARE_API_KEY to a browser-safe key.</p>}
    {!executionEnabled&&<p>Preview only: execution requires NEXT_PUBLIC_ENABLE_EXECUTION=true after review.</p>}
    <button onClick={connect} disabled={!ready||busy||locked}>{account?'Reconnect wallet':'Connect injected wallet'}</button>
    <p>Source EOA: {account||'not connected'}</p>
    <fieldset disabled={busy||locked}><legend>Route inputs</legend>
      {(['fromChain','toChain'] as const).map(key=><label key={key}>{key==='fromChain'?'Source chain':'Destination chain'}<select value={form[key]} onChange={e=>edit(key,e.target.value)}>{Object.entries(CHAINS).map(([id,name])=><option key={id} value={id}>{name} ({id})</option>)}</select></label>)}
      {(['fromToken','toToken','fromAmount','toAddress'] as const).map(key=><label key={key}>{({fromToken:'Source token address',toToken:'Destination token address',fromAmount:'Source amount (base units)',toAddress:'Recipient (blank = connected EOA)'})[key]}<input value={form[key]} onChange={e=>edit(key,e.target.value)} autoComplete="off" spellCheck={false}/></label>)}
    </fieldset>
    <p className="copy">Native-token sentinel: <code>{NATIVE}</code>. The default input is 0.001 ETH on Base to Base USDC. Changing chains does not automatically change token addresses.</p>
    <button onClick={build} disabled={!ready||!apiKey||!account||busy||locked}>Build and review route</button>
    {state.phase==='review'&&review&&<section aria-label="Route review">
      <h2>Review before signing</h2>
      <p>{review.input.fromChain} → {review.input.toChain}; {review.input.fromAmount} source base units to {review.input.toAddress}.</p>
      <p>Quoted minimum output: {review.result.route?.estimate?.toAmountMin??'unavailable'} destination base units (estimate, not settlement).</p>
      <p>SDK-managed approvals: {review.result.route?.execution?.approvals?.length??0}. Review expires after 60 seconds. Wallet prompts may include approval and swap.</p>
      <pre>{JSON.stringify({sourceToken:review.input.fromToken,destinationToken:review.input.toToken,transaction:review.result.txReq,approvals:review.result.route?.execution?.approvals??[]},null,2)}</pre>
      <button onClick={execute} disabled={!executionEnabled||!locks||busy}>Confirm and send with SDK</button>
      {!locks&&<p className="warning">Web Locks is required for execution. Use a supported browser on localhost or HTTPS.</p>}
    </section>}
    <section aria-live="polite"><h2>Status: {state.phase}</h2>
      {state.message&&<p>{state.message}</p>}{error&&<p role="alert" className="warning">{error}</p>}
      {state.intentId&&<p>Intent: <code>{state.intentId}</code></p>}
      {state.hash&&<p>Source transaction: <code>{state.hash}</code></p>}
      {tx?.destTxHash&&<p>Destination transaction: <code>{tx.destTxHash}</code></p>}
      {tx?.toAmountWei!==undefined&&<p>{tx.landed_amount_verified===true?'API-confirmed landed amount':'Estimated output'}: {String(tx.toAmountWei)} base units</p>}
      {state.intentId&&locked&&<button onClick={resume} disabled={busy||!apiKey}>Resume receipt/status only — no send</button>}
      {locked&&<p>Saved intent stays locked across reloads. Do not clear browser storage until you have reconciled this execution. A send error can follow an approval or broadcast; it is not proof that nothing happened.</p>}
    </section>
  </section></main>;
}
