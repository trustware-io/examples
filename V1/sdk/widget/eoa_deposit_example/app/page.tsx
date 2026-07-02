"use client";

/**
 * Trustware SDK EOA deposit demo
 * ============================================
 * This example shows the simplest way to run <TrustwareWidget /> against a
 * browser-injected EOA wallet (MetaMask, Coinbase Wallet, Rabby, etc.):
 *
 *   1. Wrap the widget in <TrustwareProvider config={...} autoDetect />.
 *   2. The SDK handles wallet detection, connection, and signing itself —
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
// NEXT_PUBLIC_TRUSTWARE_TO_ADDRESS  Destination wallet address for the deposit
// ---------------------------------------------------------------------------
const config = {
  apiKey: process.env.NEXT_PUBLIC_TRUSTWARE_API_KEY || "",
  routes: {
    toChain: process.env.NEXT_PUBLIC_TRUSTWARE_TO_CHAIN || "8453",
    toToken:
      process.env.NEXT_PUBLIC_TRUSTWARE_TO_TOKEN ||
      "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    toAddress: process.env.NEXT_PUBLIC_TRUSTWARE_TO_ADDRESS,
    defaultSlippage: 1,
    options: {
      routeRefreshMs: 15000,
      minAmountOut: "1",
    },
  },
  autoDetectProvider: true,
  messages: {
    title: "Deposit",
    description:
      "Connect an injected wallet and deposit into the configured destination.",
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
          <h1>Deposit with Trustware</h1>
          <p>
            Uses the widget&apos;s built-in browser wallet detection for
            MetaMask, Coinbase Wallet, Rabby, and other injected EOA wallets.
          </p>
        </div>
        <TrustwareProvider config={config} autoDetect>
          <TrustwareWidget />
        </TrustwareProvider>
      </section>
    </main>
  );
}
