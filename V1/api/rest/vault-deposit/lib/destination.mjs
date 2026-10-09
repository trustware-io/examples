import {decodeEventLog, parseAbi} from 'viem';
import {assert, same, units, deadline} from './core.mjs';
import {clientFor} from './wallet.mjs';
import {metadataAbi, decimalsAt, blockEvidence} from './receipt.mjs';
export const depositEvent = parseAbi(['event Deposit(address indexed sender,address indexed owner,uint256 assets,uint256 shares)']);
export function depositProof(receipt, record, hash) {
  assert(receipt.status === 'success', 'Destination reverted or receipt status unknown');
  assert(same(receipt.transactionHash, hash), 'Receipt transaction mismatch');
  const matches = [];
  for (const log of receipt.logs ?? []) {
    if (!same(log.address, record.vault)) continue;
    try {
      const event = decodeEventLog({abi:depositEvent,data:log.data,topics:log.topics,strict:true});
      if (same(event.args.owner,record.account) && event.args.assets === units(record.fundAmount) && event.args.shares > 0n) matches.push(event.args);
    } catch { /* Unrelated/malformed events do not establish credit. */ }
  }
  assert(matches.length === 1, 'No unique matching vault Deposit event; credit UNVERIFIED');
  return {hash,receiver:matches[0].owner,assets:matches[0].assets.toString(),shares:matches[0].shares.toString(),message:`Vault Deposit event verified: ${matches[0].assets} assets, ${matches[0].shares} shares. Source-intent attribution UNVERIFIED (provided hash).`};
}
export async function verifyDestination(config, record, hash, client = clientFor(config.vault)) {
  assert(/^0x[0-9a-fA-F]{64}$/.test(hash), 'Invalid destination hash');
  assert(same(record.vault,config.vault.address) && record.destinationChain === config.vault.chainId, 'Recovery destination differs from configuration');
  assert(String(await deadline(client.getChainId())) === record.destinationChain, 'Destination RPC chain mismatch');
  const receipt = await deadline(client.getTransactionReceipt({hash}));
  const block = await deadline(client.getBlock({blockNumber:receipt.blockNumber}));
  assert(same(block.hash,receipt.blockHash), 'Destination receipt no longer canonical');
  const proof = depositProof(receipt,record,hash);
  const asset = await deadline(client.readContract({address:record.vault,abi:metadataAbi,functionName:'asset',blockNumber:receipt.blockNumber}));
  assert(same(asset,config.vault.asset), 'Vault underlying changed');
  const [assetDecimals,shareDecimals] = await Promise.all([decimalsAt(client,asset,receipt.blockNumber),decimalsAt(client,record.vault,receipt.blockNumber)]);
  assert(assetDecimals === config.vault.decimals, 'Underlying decimals differ from configured metadata');
  return {...proof,...blockEvidence(receipt,block),asset,assetDecimals,shareDecimals,vault:record.vault};
}
