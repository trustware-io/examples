"use client";

/**
 * Trustware SDK EOA swap demo
 * ============================================
 * This example shows the simplest way to run <TrustwareWidget /> in swap
 * mode against a browser-injected EOA wallet:
 *
 *   1. Wrap the widget in <TrustwareProvider config={...} autoDetect />.
 *   2. Enable swap mode via `features.swapMode` + `features.swapDefaultDestToken`.
 *   3. The SDK handles wallet detection, connection, and signing itself —
 *      there's no custom wallet-resolution code to write.
 *
 * Read top to bottom — each section is a self-contained step you can copy
 * into your own app.
 */

import {
  TrustwareProvider,
  TrustwareWidget,
  type TrustwareConfigOptions,
} from "@trustware/sdk";

// ---------------------------------------------------------------------------
// Setup — env vars you'll need in `.env.local`
// ---------------------------------------------------------------------------
// NEXT_PUBLIC_TRUSTWARE_API_KEY     Your Trustware API key
// NEXT_PUBLIC_TRUSTWARE_TO_CHAIN    Chain ID funds should land on (default: Base, 8453)
// NEXT_PUBLIC_TRUSTWARE_TO_TOKEN    Token address funds should land as (default: USDC on Base)
// ---------------------------------------------------------------------------
const toChain = process.env.NEXT_PUBLIC_TRUSTWARE_TO_CHAIN || "8453";
const toToken =
  process.env.NEXT_PUBLIC_TRUSTWARE_TO_TOKEN ||
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const config = {
  apiKey: process.env.NEXT_PUBLIC_TRUSTWARE_API_KEY || "",
  routes: {
    toChain,
    toToken,
    defaultSlippage: 1,
  },
  autoDetectProvider: true,
  features: {
    swapMode: true,
    swapDefaultDestToken: {
      chainId: Number(toChain),
      address: toToken,
    },
  },
  messages: {
    title: "Swap",
    description:
      "Connect an injected wallet and swap into the configured token.",
  },
} satisfies TrustwareConfigOptions;

// ---------------------------------------------------------------------------
// Entry point — the widget owns wallet connection, quoting, and signing.
// ---------------------------------------------------------------------------
export default function Page() {
  return (
    <main className="page">
      <section className="shell">
        <div className="intro">
          <p className="eyebrow">EOA wallet</p>
          <h1>Swap with Trustware</h1>
          <p>
            Uses Trustware swap mode with an injected browser wallet as the
            source wallet.
          </p>
        </div>
        <TrustwareProvider config={config} autoDetect>
          <TrustwareWidget />
        </TrustwareProvider>
      </section>
    </main>
  );
}
