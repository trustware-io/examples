import {parseAbi, formatUnits} from 'viem';
import {assert, same, deadline, save} from './core.mjs';
import {clientFor} from './wallet.mjs';
import {verifyDestination} from './destination.mjs';
// Only the optional vault-event check reads RPC receipts; general tracking is SDK/API-owned.
export const metadataAbi = parseAbi(['function decimals() view returns (uint8)', 'function asset() view returns (address)']);
export async function decimalsAt(client, address, blockNumber) {
  const n = Number(await deadline(client.readContract({address,abi:metadataAbi,functionName:'decimals',blockNumber})));
  assert(Number.isInteger(n) && n >= 0 && n <= 255, 'Invalid token decimals'); return n;
}
export function blockEvidence(receipt, block) {
  assert(same(block.hash,receipt.blockHash), 'Receipt no longer canonical');
  const timestamp = typeof block.timestamp === 'bigint' && block.timestamp >= 0n && block.timestamp <= 8640000000000n ? new Date(Number(block.timestamp)*1000).toISOString() : null;
  return {blockNumber:receipt.blockNumber.toString(),timestamp};
}
export function normalizeTracking(payload) {
  const s=payload?.data ?? payload ?? {};
  const fields={intentId:'intent_id',fromChainId:'from_chain_id',toChainId:'to_chain_id',sourceTxHash:'source_tx_hash',destTxHash:'dest_tx_hash',fromChainTxUrl:'from_chain_tx_url',toChainTxUrl:'to_chain_tx_url',fromChainBlock:'from_chain_block',toChainBlock:'to_chain_block',createdDate:'create_date',updatedDate:'update_date',timeSpentMs:'time_spent_ms',toAmountWei:'to_amount_wei',status:'status'};
  return {...Object.fromEntries(Object.entries(fields).map(([camel,wire])=>[camel,s[camel] ?? s[wire]])),landed_amount_verified:s.landed_amount_verified===true};
}
export function bindDestination(record, payload) {
  const status=normalizeTracking(payload);
  if(!/^0x[0-9a-fA-F]{64}$/.test(status.destTxHash ?? ''))return null;
  if(status.intentId !== undefined && status.intentId !== record.intentId)return null;
  if(status.sourceTxHash && !same(status.sourceTxHash,record.hash))return null;
  if(status.toChainId != null && String(status.toChainId)!==record.destinationChain)return null;
  return {intentId:record.intentId,sourceHash:record.hash,hash:status.destTxHash,observedAt:new Date().toISOString(),kind:'provider-status'};
}
export function attributed(record,hash) {
  const b=record.destinationBinding;
  return b?.kind==='provider-status' && b.intentId===record.intentId && same(b.sourceHash,record.hash) && same(b.hash,hash);
}
export async function destinationReceipt(config,record,hash,client=undefined,manual=false) {
  const proof=await verifyDestination(config,record,hash,client ?? clientFor(config.vault));
  return {...proof,chainId:record.destinationChain,attribution:!manual&&attributed(record,hash)?'Provider status associates this transaction with the saved intent/source hash. Not independent onchain route proof.':'UNVERIFIED — supplied hash is not attributed to this route',routeAssociated:!manual&&attributed(record,hash)};
}
export function rememberStatus(record,payload,store) {
  const tracking=normalizeTracking(payload);
  assert(tracking.intentId===undefined || tracking.intentId===record.intentId,'Status intent mismatch');
  assert(!tracking.sourceTxHash || same(tracking.sourceTxHash,record.hash),'Status source hash mismatch');
  assert(tracking.fromChainId==null || String(tracking.fromChainId)===record.chainId,'Status source chain mismatch');
  assert(tracking.toChainId==null || String(tracking.toChainId)===record.destinationChain,'Status destination chain mismatch');
  const next={...record,tracking,routeStatus:tracking.status ?? 'unknown',trackingObservedAt:new Date().toISOString(),destinationBinding:bindDestination(record,tracking)};
  delete next.sourceProof; delete next.sourceError;
  save(store,next); return next;
}
export const displayAmount=(raw,decimals,symbol='')=> !/^\d+$/.test(String(raw ?? '')) || !Number.isInteger(decimals) ? 'Unavailable / unverified' : `${formatUnits(BigInt(raw),decimals)} ${symbol}`.trim();
export function explorer(chainId,hash,reportedUrl) {
  const hosts={'1':'https://etherscan.io','10':'https://optimistic.etherscan.io','42161':'https://arbiscan.io'};
  if(!/^0x[0-9a-fA-F]{64}$/.test(hash ?? ''))return null;
  const fallback=hosts[chainId]?`${hosts[chainId]}/tx/${hash}`:null;
  try {const url=new URL(reportedUrl);if(url.origin===hosts[chainId] && url.pathname.toLowerCase()===`/tx/${hash}`.toLowerCase() && !url.username && !url.password)return url.href;} catch { /* Missing/unsafe upstream link: use known explorer or plain hash. */ }
  return fallback;
}
