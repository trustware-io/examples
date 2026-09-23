import type { BuildRouteBody, BuildRouteResult, EIP1193, EvmWalletInterface, Transaction, TrustwareCore } from '@trustware/sdk';

// Explicit EVM-only teaching scope, not an inference from arbitrary numeric IDs.
export const CHAINS = { '1':'Ethereum', '8453':'Base', '42161':'Arbitrum', '10':'Optimism', '137':'Polygon' };
export const NATIVE = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
export const RECOVERY_KEY = 'trustware-swap-example-v1';
export type Input = Pick<BuildRouteBody, 'fromChain'|'toChain'|'fromToken'|'toToken'|'fromAmount'|'fromAddress'|'toAddress'>;
type Store = Pick<Storage,'getItem'|'setItem'>;
type Recovery = { intentId:string; hash?:string };
export type State = { phase:'idle'|'building'|'review'|'sending'|'tracking'|'success'|'failed'|'reconcile'; message?:string; intentId?:string; hash?:string; transaction?:Transaction };
const address = (s:string) => /^0x[0-9a-fA-F]{40}$/.test(s) && !/^0x0{40}$/.test(s);
const hash = (s:string) => /^0x[0-9a-fA-F]{64}$/.test(s);
const equal = (a:string,b:string) => a.toLowerCase()===b.toLowerCase();

export function validateInput(input:Input): Input {
  if (!Object.hasOwn(CHAINS,input.fromChain) || !Object.hasOwn(CHAINS,input.toChain)) throw Error('Select a supported EVM chain.');
  for (const key of ['fromToken','toToken','fromAddress','toAddress'] as const) {
    if (!address(input[key])) throw Error(`Invalid ${key}.`);
  }
  if (!/^[1-9][0-9]*$/.test(input.fromAmount) || input.fromAmount.length>78 || BigInt(input.fromAmount)>2n**256n-1n) throw Error('Use a positive integer amount in base units.');
  return {...input};
}

export function validateRoute(result:BuildRouteResult,input:Input) {
  if (!result.intentId || result.intentId.length>200 || result.sponsorship) throw Error('Missing intent or unsupported sponsored route.');
  const tx=result.txReq;
  if (!tx || !address(tx.to??tx.target??'') || !/^0x(?:[0-9a-fA-F]{2})*$/.test(tx.data) || Number(tx.chainId)!==Number(input.fromChain)) throw Error('Invalid EVM transaction or source-chain mismatch.');
  if (tx.value!==undefined && !/^(?:[0-9]+|0x[0-9a-fA-F]+)$/.test(tx.value)) throw Error('Invalid transaction value.');
  if (result.route?.estimate?.fromAmount!==input.fromAmount) throw Error('Route amount differs from request.');
  for (const approval of result.route?.execution?.approvals??[]) {
    if (equal(input.fromToken,NATIVE) || !equal(approval.tokenAddress??'',input.fromToken) || !address(approval.spender??'') || approval.amount!==input.fromAmount || (approval.chainId!==undefined && Number(approval.chainId)!==Number(input.fromChain))) throw Error('Unsupported approval plan.');
  }
}

// The SDK still owns allowance checks, exact approval sends and confirmation.
// This adapter binds every wallet send (including approvals) to the reviewed EOA.
export function guardedWallet(provider:EIP1193, expected:string, chain:string, current:()=>boolean): Extract<EvmWalletInterface,{type:'eip1193'}> {
  async function getAddress() {
    const accounts=await provider.request({method:'eth_accounts'});
    if (!Array.isArray(accounts) || typeof accounts[0]!=='string' || !equal(accounts[0],expected)) throw Error('Wallet account changed. Rebuild the route.');
    return accounts[0] as string;
  }
  async function getChainId() {
    const id=Number(await provider.request({method:'eth_chainId'}));
    if (!Number.isSafeInteger(id) || id<=0) throw Error('Invalid wallet chain.');
    return id;
  }
  return {
    ecosystem:'evm',type:'eip1193',getAddress,getChainId,
    async switchChain(id) {
      if (id!==Number(chain) || !current()) throw Error('Route context changed.');
      await getAddress();
      await provider.request({method:'wallet_switchEthereumChain',params:[{chainId:`0x${id.toString(16)}`}]});
      if (await getChainId()!==id) throw Error('Wallet did not switch chains.');
    },
    async request(args) {
      if (args.method==='eth_sendTransaction') {
        await getAddress();
        if (await getChainId()!==Number(chain)) throw Error('Wallet network changed.');
        // Re-read the account after the awaited chain check.
        await getAddress();
        const tx=Array.isArray(args.params)?args.params[0] as {from?:string}:undefined;
        if (!current() || !tx?.from || !equal(tx.from,expected)) throw Error('Stale route or signer mismatch.');
      }
      return provider.request(args);
    },
  };
}

function freeze<T>(value:T):T {
  if (value && typeof value==='object') { Object.freeze(value); for(const item of Object.values(value)) freeze(item); }
  return value;
}
async function bounded<T>(promise:Promise<T>,ms:number):Promise<T> {
  let timer:ReturnType<typeof setTimeout>;
  try { return await Promise.race([promise,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('Request timed out.')),ms);})]); }
  finally { clearTimeout(timer!); }
}

export class Flow {
  state:State={phase:'idle'};
  review?:{input:Input;result:BuildRouteResult;created:number};
  private sdk:TrustwareCore;
  private store:Store;
  private notify:(state:State)=>void;
  private now:()=>number;
  private timeout:number;
  private busy=false;
  private locked=false;
  private generation=0;
  private recovery?:Recovery;
  constructor(sdk:TrustwareCore,store:Store,notify:(state:State)=>void,now=Date.now,timeout=90000) {
    this.sdk=sdk; this.store=store; this.notify=notify; this.now=now; this.timeout=timeout;
  }
  private publish(state:State) { this.state=state;this.notify(state); }
  restore() {
    const raw=this.store.getItem(RECOVERY_KEY);
    if (!raw) return;
    this.locked=true;
    try {
      const r=JSON.parse(raw) as Recovery;
      if (typeof r.intentId!=='string' || !r.intentId || r.intentId.length>200 || (r.hash!==undefined && !hash(r.hash))) throw Error();
      this.recovery={intentId:r.intentId,hash:r.hash};
      this.publish({phase:'reconcile',...this.recovery,message:'Saved execution found. Track it; do not send again.'});
    } catch { this.publish({phase:'reconcile',message:'Invalid saved execution. Reconcile manually before clearing browser storage.'}); }
  }
  invalidate() {
    this.generation++;
    if (!this.locked) {this.review=undefined;this.publish({phase:'idle'});}
  }
  dispose() { this.generation++;this.review=undefined;this.notify=()=>{}; }
  isCurrent() {return !!this.review && this.now()-this.review.created<60000 && this.state.phase==='sending';}
  async build(value:Input) {
    if (this.busy || this.locked || this.store.getItem(RECOVERY_KEY)) throw Error('Another operation or saved execution exists.');
    const input=validateInput(value); const gen=++this.generation;
    this.busy=true; this.review=undefined; this.publish({phase:'building'});
    try {
      const result=await bounded(this.sdk.buildRoute({...input,slippageBps:100}),15000);
      if (gen!==this.generation) return;
      validateRoute(result,input);
      // Private copy: callers cannot mutate the SDK response beneath the review.
      this.review=freeze({input:{...input},result:structuredClone(result),created:this.now()});
      this.publish({phase:'review',intentId:result.intentId});
    } catch { if(gen===this.generation)this.publish({phase:'idle',message:'Route unavailable or invalid. Check inputs and try again.'}); }
    finally {this.busy=false;}
  }
  async execute() {
    if (this.busy || this.locked || this.store.getItem(RECOVERY_KEY) || !this.review) throw Error('No executable review, or an execution already exists.');
    this.busy=true;
    try {
      const reviewed=this.review;
      const gen=this.generation;
      const {input,result,created}=reviewed;
      if (this.now()-created>=60000 || !equal(await bounded(this.sdk.getAddress(),5000),input.fromAddress)) throw Error('Stale review or changed account. Rebuild.');
      if (gen!==this.generation || this.review!==reviewed || this.now()-created>=60000) throw Error('Review invalidated. Rebuild.');
      validateRoute(result,input);
      this.recovery={intentId:result.intentId};
      // Persistence is mandatory BEFORE any possible approval or source send.
      this.store.setItem(RECOVERY_KEY,JSON.stringify(this.recovery));
      this.locked=true;
      this.publish({phase:'sending',...this.recovery});
      try {
        // No caller-owned approvals and no approvalsEnsured bypass.
        const txHash=await this.sdk.sendRouteTransaction(result,input.fromChain);
        if (!hash(txHash)) throw Error('Invalid source hash.');
        this.recovery.hash=txHash;
        this.store.setItem(RECOVERY_KEY,JSON.stringify(this.recovery));
        await this.track();
      } catch { this.publish({phase:'reconcile',...this.recovery,message:'Execution may have occurred. Preserve these identifiers; do not resend.'}); }
    } finally {this.busy=false;}
  }
  private async track() {
    if (!this.recovery) throw Error('No saved intent.');
    const gen=this.generation;
    const deadline=Date.now()+this.timeout;
    this.publish({phase:'tracking',...this.recovery});
    if(this.recovery.hash) await bounded(this.sdk.submitReceipt(this.recovery.intentId,this.recovery.hash),Math.max(1,deadline-Date.now()));
    while (gen===this.generation) {
      const tx=await bounded(this.sdk.getStatus(this.recovery.intentId),Math.max(1,deadline-Date.now()));
      if(gen!==this.generation)return;
      if(tx.intentId && tx.intentId!==this.recovery.intentId) throw Error('Status intent mismatch.');
      if(tx.status==='success' || tx.status==='failed') {
        this.publish({phase:tx.status,...this.recovery,transaction:tx}); return;
      }
      if(!['pending','submitted','bridging'].includes(tx.status) || Date.now()>=deadline) throw Error('Status unresolved.');
      this.publish({phase:'tracking',...this.recovery,transaction:tx});
      await new Promise(resolve=>setTimeout(resolve,Math.min(2000,Math.max(1,deadline-Date.now()))));
    }
  }
  async resume() {
    if(this.busy || !this.recovery) throw Error('No recoverable intent, or busy.');
    this.busy=true;
    try {await this.track();}
    catch {this.publish({phase:'reconcile',...this.recovery,message:'Status unresolved. Retry tracking later; do not send again.'});}
    finally {this.busy=false;}
  }
}
