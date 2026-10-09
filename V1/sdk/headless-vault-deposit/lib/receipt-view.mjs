import {createElement as h} from 'react';
import {displayAmount,explorer} from './receipt.mjs';
const row=(label,value)=>h('div',{key:label},h('dt',null,label),h('dd',null,value ?? 'Unavailable / unverified'));
const tx=(chain,hash,url)=>{const safe=explorer(chain,hash,url);return safe?h('a',{href:safe,target:'_blank',rel:'noopener noreferrer'},hash):hash || 'Pending / unavailable';};
export function ReceiptView({record,config}) {
  const t=record.tracking ?? {},d=record.destinationProof;
  const token=config?.sources?.find(c=>c.chainId===record.chainId)?.tokens.find(a=>a.address.toLowerCase()===record.sourceToken?.toLowerCase());
  const destination=config?.vault;
  return h('section',{className:'completion-receipt','aria-label':'Transaction receipt'},
    h('h3',null,d?.routeAssociated?'Vault credit verified · provider-associated route':d?'Vault event verified · route attribution UNVERIFIED':'Deposit receipt · credit UNVERIFIED'),
    h('p',{className:'muted'},'SDK/API status is route evidence, not proof of vault shares. Optional vault-event checks are one canonical observation, not finality; saved observations may be stale. Retry never rebroadcasts.'),
    h('dl',{className:'receipt-facts'},
      row('Intent',record.intentId),row('Record created (local)',typeof record.created==='number'?new Date(record.created).toISOString():null),
      row('Tracking observed (local)',record.trackingObservedAt),row('Provider route status',t.status ?? record.routeStatus ?? 'Unknown'),
      row('Lifecycle created (API; not block confirmation)',t.createdDate),row('Lifecycle updated (API; not block confirmation)',t.updatedDate),row('Route time spent (API milliseconds)',t.timeSpentMs),
      row('Source chain',t.fromChainId ?? record.chainId),row('Source transaction',tx(t.fromChainId ?? record.chainId,t.sourceTxHash ?? record.hash,t.fromChainTxUrl)),
      row('Source block (API)',t.fromChainBlock),row('Source block time','Unavailable — no API block timestamp field'),
      row('Requested source amount (not actual spend)',token?displayAmount(record.requestedSourceAmount,token.decimals,token.symbol):record.requestedSourceAmount?`${record.requestedSourceAmount} base units`:null),
      row('Actual source spent','Unavailable — not provided by tracking contract'),
      row('Destination chain',t.toChainId ?? record.destinationChain),row('Destination execution transaction',tx(t.toChainId ?? record.destinationChain,t.destTxHash ?? d?.hash,t.toChainTxUrl)),
      row('Destination block (API)',t.toChainBlock),row('Destination block time (optional vault receipt, UTC)',d?.timestamp ?? 'Unavailable — no API block timestamp field'),
      row('Landed amount verified (API)',String(t.landed_amount_verified===true)),
      row('Confirmed landed underlying (not vault shares)',t.landed_amount_verified===true?displayAmount(t.toAmountWei,destination?.decimals,destination?.symbol ?? 'underlying'):null),
      row('Reported destination amount (base units; not confirmation)',t.toAmountWei),
      row('Actual vault assets deposited (Deposit event)',d?displayAmount(d.assets,d.assetDecimals,'underlying'):null),
      row('Actual shares minted (Deposit event)',d?displayAmount(d.shares,d.shareDecimals,'vault shares'):null),
      row('Underlying token',d?.asset ?? destination?.asset),row('Vault',record.vault),row('Beneficiary',d?.receiver ?? record.account),
      row('Route attribution',d?.attribution ?? record.destinationError ?? 'UNVERIFIED')));
}
