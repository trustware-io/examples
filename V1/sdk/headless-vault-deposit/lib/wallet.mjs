import { createPublicClient, http, encodeFunctionData, toHex } from 'viem';
import { assert, address, same, units, fresh, eligible, vaultAbi, tokenAbi, save, deadline, selection, buildBody, validateRoute } from './core.mjs';
export const clientFor = chain => createPublicClient({transport: http(chain.rpc, {timeout: 10000, retryCount: 0})});
export async function vaultReads(config, account, client = clientFor(config.vault)) {
  const v = config.vault;
  const [asset, maxDeposit, preview, shares] = await Promise.all([
    client.readContract({address: v.address, abi: vaultAbi, functionName: 'asset'}),
    client.readContract({address: v.address, abi: vaultAbi, functionName: 'maxDeposit', args: [account]}),
    client.readContract({address: v.address, abi: vaultAbi, functionName: 'previewDeposit', args: [units(v.fundAmount)]}),
    client.readContract({address: v.address, abi: vaultAbi, functionName: 'balanceOf', args: [account]}),
  ]);
  const reads = {asset, maxDeposit, preview, shares}; eligible(v, reads); return reads;
}
export async function identity(provider, account, chainId) {
  const accounts = await deadline(provider.request({method: 'eth_accounts'}));
  assert(Array.isArray(accounts) && same(accounts[0], account), 'Wallet account changed');
  const chain = await deadline(provider.request({method: 'eth_chainId'}));
  assert(BigInt(chain) === BigInt(chainId), 'Wallet chain changed');
}
// App owns approvals/broadcast for both transports. This keeps persistence at the
// actual injected-provider boundary rather than behind SDK automatic approvals.
export async function execute(args, locks = globalThis.navigator?.locks) {
  assert(locks?.request, 'Web Locks unavailable; execution disabled');
  return locks.request('trustware-vault-send', {mode:'exclusive', ifAvailable:true}, async lock => {
    assert(lock, 'Another tab is executing; do not send');
    return executeLocked(args);
  });
}
async function executeLocked({config, envelope, provider, store, api, rpc = undefined, readVault = vaultReads, onRecord = (_record) => {}}) {
  assert(!store.getItem('trustware-vault-pending'), 'Unresolved transaction exists; use tracking');
  const e = structuredClone(envelope); const {chain, token} = selection(config, e.input.chainId, e.input.token);
  buildBody(config, e.input);
  assert(e.route.tx.value === '0x0', 'Unexpected native spend');
  validateRoute(config, e.input, {intentId:e.route.intentId,route:{estimate:{fromAmount:e.input.amount,toAmountMin:e.route.minimum},execution:{transaction:{...e.route.tx,value:'0'},approvals:e.route.approvals}}});
  const source = rpc ?? clientFor(chain); const account = address(e.input.account);
  fresh(e, account);
  const chainNow = await deadline(provider.request({method: 'eth_chainId'}));
  if (BigInt(chainNow) !== BigInt(chain.chainId)) await deadline(provider.request({method:'wallet_switchEthereumChain', params:[{chainId:toHex(BigInt(chain.chainId))}]}));
  await identity(provider, account, chain.chainId);
  const check = async () => {
    fresh(e, account); await identity(provider, account, chain.chainId);
    await readVault(config, account);
    const balance = await source.readContract({address: token.address, abi: tokenAbi, functionName:'balanceOf', args:[account]});
    assert(balance >= units(e.input.amount), 'Source balance changed');
    fresh(e, account); await identity(provider, account, chain.chainId);
  };
  let record = {version:1, sourceToken:token.address, requestedSourceAmount:e.input.amount, intentId:e.route.intentId, account, chainId:chain.chainId, vault:config.vault.address, destinationChain:config.vault.chainId, fundAmount:config.vault.fundAmount, sharesBefore:e.sharesBefore, phase:'prepared', created:Date.now()};
  const persist = r => { record = {...record,...r}; save(store, record); onRecord(record); };
  const send = async (tx, phase) => {
    await check();
    persist({phase, hash:undefined}); // Unknown outcome stays locked, including approval rejection.
    // No automatic retry of eth_sendTransaction, even on a timeout/provider error.
    const hash = await deadline(provider.request({method:'eth_sendTransaction', params:[{...tx, from:account, chainId:toHex(BigInt(chain.chainId))}]}), 120000);
    assert(/^0x[a-fA-F0-9]{64}$/.test(hash), 'Unknown broadcast result; inspect wallet');
    persist(phase === 'route-signing' ? {phase:'broadcast', hash} : {phase:'approval-broadcast', approvalHash:hash});
    return hash;
  };
  for (const a of e.route.approvals) {
    const current = await source.readContract({address:a.tokenAddress, abi:tokenAbi, functionName:'allowance', args:[account,a.spender]});
    if (current >= units(a.amount)) continue;
    // Refuse non-zero allowance transitions rather than silently changing token-specific semantics.
    assert(current === 0n, 'Existing allowance too small: revoke separately, then rebuild');
    const hash = await send({to:a.tokenAddress, data:encodeFunctionData({abi:tokenAbi,functionName:'approve',args:[a.spender,units(a.amount)]}), value:'0x0'}, 'approval-signing');
    const receipt = await deadline(source.waitForTransactionReceipt({hash, timeout:60000, confirmations:1}),65000);
    assert(receipt.status === 'success', 'Approval did not confirm successfully');
    const after = await source.readContract({address:a.tokenAddress,abi:tokenAbi,functionName:'allowance',args:[account,a.spender]});
    assert(after >= units(a.amount), 'Approval not effective');
    persist({phase:'approval-confirmed'});
  }
  const hash = await send(e.route.tx, 'route-signing');
  // Persisted before receipt network I/O. Caller can always recover without a send.
  try {await deadline(api('receipt', {intentId:e.route.intentId,hash})); persist({receiptSubmitted:true});} catch {persist({receiptSubmitted:false});}
  return record;
}
