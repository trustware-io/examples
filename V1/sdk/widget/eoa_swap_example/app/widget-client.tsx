"use client";
import { TrustwareProvider, TrustwareWidget } from '@trustware/sdk';
import { widgetSetup } from './config';
const setup=widgetSetup(
  process.env.NEXT_PUBLIC_TRUSTWARE_API_KEY||'',
  process.env.NEXT_PUBLIC_TRUSTWARE_TO_CHAIN||'8453',
  process.env.NEXT_PUBLIC_TRUSTWARE_TO_TOKEN||'0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  process.env.NEXT_PUBLIC_ENABLE_EXECUTION||'false',
);
export default function WidgetClient(){
  return <main className="page"><section className="shell">
    <div className="intro"><p className="eyebrow">EOA wallet · SDK widget</p>
      <h1>Swap or bridge with Trustware</h1>
      <p>Choose the destination chain as your source for a same-chain swap, or a different supported source chain for a bridge. Availability depends on the current route.</p>
      <p>The SDK owns wallet connection, quoting, approvals, signing and tracking. An ERC-20 source can require an approval followed by a swap signature.</p>
    </div>
    {setup.ready ? <TrustwareProvider config={setup.config} autoDetect><TrustwareWidget/></TrustwareProvider> : <p role="status">{setup.message}</p>}
  </section></main>;
}
