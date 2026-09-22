import { encodeFunctionData, parseAbi, isAddress, parseUnits } from 'viem';
export const vaultAbi = parseAbi(['function asset() view returns (address)', 'function maxDeposit(address) view returns (uint256)', 'function previewDeposit(uint256) view returns (uint256)', 'function balanceOf(address) view returns (uint256)', 'function deposit(uint256 assets,address receiver) returns (uint256)']);
export const tokenAbi = parseAbi(['function balanceOf(address) view returns (uint256)', 'function allowance(address,address) view returns (uint256)', 'function approve(address,uint256) returns (bool)']);
export function assert(ok, message) { if (!ok) throw new Error(message); }
export const same = (a,b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
export function units(value) { assert(typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value), 'Invalid base-unit amount'); return BigInt(value); }
export function address(value) { assert(typeof value === 'string' && isAddress(value) && !/^0x0{40}$/i.test(value), 'Invalid address'); return value; }
export function amount(text, decimals) {
  assert(typeof text === 'string' && /^(0|[1-9]\d*)(\.\d+)?$/.test(text), 'Enter a decimal amount');
  assert((text.split('.')[1]?.length ?? 0) <= decimals, 'Too many decimal places');
  const n = parseUnits(text, decimals); assert(n > 0n, 'Amount must be positive'); return n.toString();
}
export function selection(config, chainId, tokenAddress) {
  const chain = config.sources.find(c => c.chainId === chainId);
  const token = chain?.tokens.find(t => same(t.address, tokenAddress));
  assert(chain && token, 'Unsupported source asset'); return {chain, token};
}
export function enabled(config) {
  const v = config.vault; assert(v?.verifiedSynchronousPullDeposit === true, 'Configure a verified vault before routing');
  address(v.address); address(v.asset); assert(units(v.fundAmount) > 0n && units(v.fundAmount) >= units(v.minAssets), 'Invalid fixed destination budget');
  assert(/^\d+$/.test(v.chainId) && /^\d+$/.test(v.estimatedGas), 'Invalid destination configuration'); return v;
}
export function buildBody(config, input) {
  const v = enabled(config); const {chain, token} = selection(config, input.chainId, input.token);
  address(input.account); assert(units(input.amount) > 0n, 'Amount must be positive');
  assert(Number.isInteger(input.slippageBps) && input.slippageBps >= 1 && input.slippageBps <= 100, 'Slippage must be 1–100 bps');
  return {fromChain: chain.chainId, toChain: v.chainId, fromToken: token.address, toToken: v.asset,
    fromAmount: input.amount, fromAddress: input.account, toAddress: input.account, refundAddress: input.account,
    slippageBps: input.slippageBps,
    hooks: {postHook: {target: v.address, callData: encodeFunctionData({abi: vaultAbi, functionName: 'deposit', args: [units(v.fundAmount), input.account]}), fundToken: v.asset, fundAmount: v.fundAmount, estimatedGas: v.estimatedGas, toApprovalAddress: v.address}}};
}
// Intersect configured assets with successful wallet holdings; metadata cannot add assets.
export function holdings(config, payload) {
  const out = [];
  for (const row of payload.results ?? []) {
    if (row.error || typeof row.chain_id !== 'string') continue;
    for (const b of row.balances ?? []) {
      if (b.category !== 'erc20' || !/^[0-9]+$/.test(b.balance ?? '') || BigInt(b.balance) <= 0n) continue;
      try { const {chain, token} = selection(config, row.chain_id, b.contract);
        if (b.decimals !== token.decimals || b.chain_key !== chain.chainId) continue;
        out.push({...token, chainId: chain.chainId, chainName: chain.name, balance: b.balance});
      } catch { /* Unsupported assets are not selectable. */ }
    }
  }
  return out;
}
export function validateRoute(config, input, raw) {
  const v = enabled(config); const {chain, token} = selection(config, input.chainId, input.token);
  const r = raw.data ?? raw; const plan = r.route; const tx = r.txReq ?? plan?.execution?.transaction;
  assert(typeof r.intentId === 'string' && /^[a-zA-Z0-9-]{1,128}$/.test(r.intentId), 'Missing intent ID');
  assert(plan?.estimate && units(plan.estimate.fromAmount) === units(input.amount), 'Source amount mismatch');
  assert(units(plan.estimate.toAmountMin) >= units(v.fundAmount), 'Guaranteed output does not cover fixed vault funding');
  address(tx?.to); assert(chain.routers.some(a => same(a, tx.to)), 'Unapproved route target');
  assert(typeof tx.data === 'string' && /^0x([a-fA-F0-9]{2})+$/.test(tx.data), 'Malformed route calldata');
  assert(tx.chainId === undefined || String(tx.chainId) === chain.chainId, 'Transaction chain mismatch');
  assert(units(tx.value ?? '0') === 0n, 'ERC-20 example refuses additional native spend');
  const approvals = plan.execution?.approvals;
  assert(Array.isArray(approvals), 'Explicit approval plan required');
  for (const a of approvals) {
    assert(String(a.chainId) === chain.chainId && same(a.tokenAddress, token.address), 'Approval asset/chain mismatch');
    address(a.spender); assert(chain.spenders.some(s => same(s,a.spender)), 'Unapproved spender');
    assert(units(a.amount) > 0n && units(a.amount) <= units(input.amount), 'Excessive approval');
  }
  return {intentId: r.intentId, provider: String(plan.provider ?? 'Unknown'), minimum: plan.estimate.toAmountMin,
    tx: {to: tx.to, data: tx.data, value: '0x0'}, approvals: structuredClone(approvals)};
}
export function eligible(v, reads) {
  assert(same(reads.asset, v.asset), 'Vault underlying changed');
  assert(BigInt(reads.maxDeposit) >= units(v.fundAmount), 'Vault deposit limit or eligibility blocks receiver');
  assert(BigInt(reads.preview) > 0n, 'Vault would mint zero shares');
}
export function fresh(envelope, account, now = Date.now()) {
  assert(same(envelope.input.account, account), 'Wallet account changed');
  assert(now >= envelope.created && now - envelope.created < 60000, 'Route expired; rebuild and review');
}
export async function deadline(promise, ms = 15000) {
  let timer; try { return await Promise.race([promise, new Promise((_, reject) => {timer = setTimeout(() => reject(new Error('Request timed out; outcome may be unknown')), ms);})]); }
  finally {clearTimeout(timer);}
}
export function save(store, record) {
  store.setItem('trustware-vault-pending', JSON.stringify(record));
  assert(store.getItem('trustware-vault-pending') === JSON.stringify(record), 'Durable storage unavailable; do not send');
}
export async function recover(record, api, {attempts = 12, pause = ms => new Promise(r => setTimeout(r, ms)), timeout = 15000} = {}) {
  assert(/^0x[a-fA-F0-9]{64}$/.test(record.hash ?? ''), 'No known route hash; reconcile in wallet, never rebroadcast');
  // A receipt retry is NOT a transaction retry. Poll even if acknowledgement fails.
  let receiptSubmitted = false;
  try {await deadline(api('receipt', {intentId: record.intentId, hash: record.hash}), timeout); receiptSubmitted = true;} catch { /* Retained for retry. */ }
  let lastStatus;
  for (let i=0; i<attempts; i++) {
    try {
      const s = await deadline(api('status', {intentId: record.intentId}), timeout);
      lastStatus = s;
      if (s.status === 'success') return {receiptSubmitted, message: 'Route settled · vault share credit UNVERIFIED', status: s};
      if (s.status === 'failed') return {receiptSubmitted, message: 'Route failed · inspect destination/refund; funds are not assumed recovered', status: s};
      if (i+1<attempts) await pause(Math.min(10000, Math.max(2000, Date.parse(s.next_poll_at ?? '') - Date.now() || 3000)));
    } catch (e) { if (e?.status === 404) return {receiptSubmitted, message: 'Unknown intent (404) · stop and contact support'}; if(i+1<attempts) await pause(3000); }
  }
  return {receiptSubmitted, status:lastStatus, message: 'Tracking paused · pending or unavailable. Retry tracking, never resend.'};
}
