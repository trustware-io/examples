'use client';
import {useEffect, useRef, useState} from 'react';
import {formatUnits} from 'viem';
import {config as rawConfig} from '../lib/config.mjs';
import {amount, buildBody, holdings, recover, enabled} from '../lib/core.mjs';
import {execute, vaultReads} from '../lib/wallet.mjs';
import {destinationReceipt, rememberStatus} from '../lib/receipt.mjs';
import {save} from '../lib/core.mjs';
import {ReceiptView} from '../lib/receipt-view.mjs';

type Vault = {chainId:string;address:string;asset:string;symbol:string;decimals:number;fundAmount:string;rpc:string};
type Asset = {address:string;symbol:string;decimals:number;chainId:string;chainName:string;balance:string};
type Provider = {request: (arg:{method:string;params?:unknown[]}) => Promise<unknown>;on?:(event:string,fn:()=>void)=>void;removeListener?:(event:string,fn:()=>void)=>void};
type Route = {intentId:string;provider:string;minimum:string;tx:{to:string;data:string;value:string};approvals:{chainId:string;tokenAddress:string;spender:string;amount:string}[]};
type Review = {input:{account:string;chainId:string;token:string;amount:string;slippageBps:number};route:Route;created:number;sharesBefore:string};
const config = rawConfig as unknown as {transport:string;name:string;description:string;vault:Vault|null;sources:unknown[]};
async function api(action:string,input:unknown):Promise<unknown> {
  const res = await fetch('/api/deposit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,input}),signal:AbortSignal.timeout(20000)});
  const data = await res.json(); if(!res.ok) {const e = new Error(data.error ?? 'Request failed') as Error & {status:number};e.status=res.status;throw e;} return data;
}
export default function Page() {
  const [account,setAccount]=useState(''); const [assets,setAssets]=useState<Asset[]>([]); const [selected,setSelected]=useState('');
  const [text,setText]=useState(''); const [slippage,setSlippage]=useState(50); const [review,setReview]=useState<Review|null>(null);
  const [busy,setBusy]=useState(false); const [message,setMessage]=useState('Connect a wallet to see eligible assets. No wallet is preselected.');
  const [pending,setPending]=useState<Record<string,unknown>|null>(null); const lock=useRef(false); const generation=useRef(0);
  const [destinationHash,setDestinationHash]=useState('');
  const provider=useRef<Provider|null>(null); const v=config.vault;
  const asset=assets.find(a=>`${a.chainId}:${a.address}`===selected);
  useEffect(()=>{
    try {const saved=localStorage.getItem('trustware-vault-pending'); if(saved) {setPending(JSON.parse(saved));setMessage('Unresolved transaction restored. Tracking never rebroadcasts.');}} catch {setMessage('Recovery storage unavailable or corrupt; do not transact.');lock.current=true;}
    return ()=>{generation.current++;};
  },[]);
  useEffect(()=>{
    const p=provider.current; const changed=()=>{generation.current++;setReview(null);setAssets([]);setAccount('');setMessage('Wallet changed. Reconnect and refresh holdings.');};
    p?.on?.('accountsChanged',changed);p?.on?.('chainChanged',changed);
    return ()=>{p?.removeListener?.('accountsChanged',changed);p?.removeListener?.('chainChanged',changed);};
  },[account]);
  async function run(fn:()=>Promise<void>) {
    if(lock.current)return;lock.current=true;setBusy(true);
    try {await fn();} catch(e) {setMessage(e instanceof Error?e.message:'Operation failed');} finally {lock.current=false;setBusy(false);}
  }
  const invalidate=()=>{generation.current++;setReview(null);};
  async function connect() {
    invalidate();const g=generation.current;
    const p=(window as Window & {ethereum?:Provider}).ethereum;if(!p)throw new Error('Install an EVM injected wallet.');provider.current=p;
    const accounts=await p.request({method:'eth_requestAccounts'});if(!Array.isArray(accounts)||typeof accounts[0]!=='string')throw new Error('No account available');
    const owner=accounts[0];const result=await api('balances',{account:owner});
    if(g!==generation.current)return;
    const found=holdings(rawConfig,result) as Asset[];setAccount(owner);setAssets(found);setSelected(found[0]?`${found[0].chainId}:${found[0].address}`:'');
    setMessage(`${found.length} eligible positive-balance assets. ${typeof result==='object'&&result&&'partial' in result&&result.partial?'Holdings are partial; unavailable chains are omitted.':''}`);
  }
  async function build() {
    enabled(rawConfig);if(!asset||!provider.current)throw new Error('Choose a funded supported asset');
    const g=generation.current;const created=Date.now();const input={account,chainId:asset.chainId,token:asset.address,amount:amount(text,asset.decimals),slippageBps:slippage};
    if(BigInt(input.amount)>BigInt(asset.balance))throw new Error('Insufficient displayed balance');
    buildBody(rawConfig,input);const reads=await vaultReads(rawConfig,account);
    const route=await api('route',input) as Route;
    if(g!==generation.current)return;
    setReview({input,route,created,sharesBefore:reads.shares.toString()});setMessage('Review the hook-aware route below. Quote expires after 60 seconds.');
  }
  async function send() {
    if(!review||!provider.current)throw new Error('Build and review a route first');
    const result=await execute({config:rawConfig,envelope:review,provider:provider.current,store:localStorage,api,onRecord:(r:Record<string,unknown>)=>setPending(r)});
    setPending(result);setReview(null);setMessage('Source transaction broadcast. Use tracking; do not send again.');
  }
  function persistReceipt(record:Record<string,unknown>) { save(localStorage,record);setPending(record); }
  async function verifyManual() {
    if(!pending)return;
    const next={...pending,destinationProof:undefined,destinationError:undefined};
    try {Object.assign(next,{destinationProof:await destinationReceipt(rawConfig,pending,destinationHash,undefined,true)});} catch(e) {Object.assign(next,{destinationError:e instanceof Error?e.message:'Destination UNVERIFIED'});}
    persistReceipt(next);
  }
  async function track() {
    if(!pending)return;
    // Revalidate rather than retain stale chain proof after a failed retry/reorg.
    let next:Record<string,unknown>={...pending,destinationProof:undefined,destinationError:undefined};
    persistReceipt(next);
    const result=await recover(pending,api);setMessage(result.message);
    next=rememberStatus(next,result.status,localStorage);
    const binding=next.destinationBinding as {hash?:string}|undefined;
    if(binding?.hash) {
      setDestinationHash(binding.hash);
      try {next.destinationProof=await destinationReceipt(rawConfig,next,binding.hash);} catch(e) {next.destinationError=e instanceof Error?e.message:'Destination credit UNVERIFIED';}
    }
    persistReceipt(next);
  }
  return <main>
    <header><a href="/" aria-label="Trustware home">◈ <strong>trustware</strong></a><span className="mode">{config.transport==='rest'?'DIRECT REST':'HEADLESS SDK'} · LOCAL EXAMPLE</span></header>
    <section className="hero"><div className="eyebrow">CURATED VAULT DEPOSITS</div><h1>Your assets.<br/><em>One destination.</em></h1><p>{config.description}</p></section>
    <div className="grid"><section className="overview"><div className="vault-icon">↗</div><div className="eyebrow">SYNCHRONOUS DEPOSIT</div><h2>{config.name}</h2><p>Route from a supported source chain. A destination executor deposits underlying assets and mints shares to your connected wallet.</p><div className="facts"><div><span>Deposit asset</span><strong>{v?.symbol??'Not configured'}</strong></div><div><span>Destination chain</span><strong>{v?.chainId??'—'}</strong></div><div><span>Fixed deposit budget</span><strong>{v?formatUnits(BigInt(v.fundAmount),v.decimals):'—'}</strong></div><div><span>Vault address</span><code>{v?.address??'Deployment approval required'}</code></div></div><aside>Source fees and slippage require a buffer above the fixed destination budget. The minimum routed output must cover it. Extra output and failed-hook recovery depend on the provider; no fallback is promised.</aside><p className="muted">No APY, TVL or mainnet-verification claims. Inspired by focused vault interfaces, not affiliated with Spice.</p></section>
    <section className="deposit"><div className="panel-heading"><h2>Deposit</h2><span className="badge">EVM · ERC-20</span></div>
      {!rawConfig.vault.verifiedSynchronousPullDeposit&&<aside className="warning">Spice reference loaded; execution disabled until current vault review and router/spender corridor allowlists are provisioned. See CONFIGURATION.md.</aside>}
      <button className="secondary" disabled={busy||!!pending} onClick={()=>run(connect)}>{account?`${account.slice(0,6)}…${account.slice(-4)} · Refresh`:'Connect wallet'}</button>
      <label>Pay with · asset and source chain<select disabled={busy||!!pending} value={selected} onChange={e=>{invalidate();setSelected(e.target.value);}}><option value="">Choose a wallet-held asset</option>{assets.map(a=><option key={`${a.chainId}:${a.address}`} value={`${a.chainId}:${a.address}`}>{a.symbol} · {a.chainName} · {formatUnits(BigInt(a.balance),a.decimals)}</option>)}</select></label>
      <label>Source amount<input inputMode="decimal" placeholder="0.00" value={text} disabled={busy||!!pending} onChange={e=>{invalidate();setText(e.target.value);}}/></label>
      <label>Route slippage<select value={slippage} disabled={busy||!!pending} onChange={e=>{invalidate();setSlippage(Number(e.target.value));}}><option value={10}>0.1%</option><option value={50}>0.5%</option><option value={100}>1.0%</option></select></label>
      <div className="receiver"><span>Share beneficiary</span><code>{account||'Your connected wallet'}</code></div>
      {review&&<section className="review"><h3>Confirm destination call</h3><dl><dt>Provider</dt><dd>{review.route.provider}</dd><dt>Minimum underlying delivered</dt><dd>{v?formatUnits(BigInt(review.route.minimum),v.decimals):'—'} {v?.symbol}</dd><dt>Method</dt><dd>deposit(assets, receiver)</dd><dt>Exact funding</dt><dd>{v?.fundAmount} base units</dd><dt>Source approvals</dt><dd>{review.route.approvals.length}</dd></dl>{review.route.approvals.map((a,i)=><p key={i}><code>{a.spender}</code> · {a.amount} units</p>)}<p className="muted">Vault target and pull spender: {v?.address}. Receiver: {review.input.account}. Signing may require approval then a route transaction.</p><details><summary>Inspect exact hook and source transaction</summary><pre>{JSON.stringify({hook:buildBody(rawConfig,review.input).hooks,source:review.route.tx},null,2)}</pre></details></section>}
      {!pending&&<button disabled={busy||!account||!asset||!v} onClick={()=>run(review?send:build)}>{busy?'Working…':review?'Approve & deposit':'Review deposit'}</button>}
      {pending&&<section className="recovery"><h3>Transaction recovery</h3><p>Saved locally before broadcast. Do not clear this record while funds may be in flight.</p><ReceiptView record={pending} config={rawConfig}/><button disabled={busy||!pending.hash} onClick={()=>run(track)}>{busy?'Tracking…':'Retry receipt & check status'}</button>{!pending.hash&&<p>Broadcast outcome unknown or approval-only. Inspect the wallet and source explorer before any new attempt. Automatic resending is disabled.</p>}</section>}
      {pending&&<section><label>Destination transaction hash (from authoritative route/explorer evidence)<input value={destinationHash} onChange={e=>setDestinationHash(e.target.value)} placeholder="0x…"/></label><button disabled={busy||!destinationHash} onClick={()=>run(verifyManual)}>Verify vault Deposit event</button><p className="muted">A manually supplied hash proves this deposit event, not its association with the source intent.</p></section>}
      <p role="status" aria-live="polite" className="status">{message}</p>
    </section></div><footer>Trustware routes. Your wallet signs. Destination credit must be independently verified.</footer>
  </main>;
}
