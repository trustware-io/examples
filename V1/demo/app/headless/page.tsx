"use client";

/**
 * Trustware SDK headless route builder demo
 * ============================================
 * This example calls the SDK's core functions directly instead of rendering
 * <TrustwareWidget />:
 *
 *   1. Trustware.init(config)     -> validate the API key and load config.
 *   2. Trustware.buildRoute({...}) -> get a signable route (quote + calldata).
 *
 * Use this pattern when your app owns the UI and wallet connection, and
 * only needs Trustware for route building and status APIs.
 *
 * Read top to bottom — each section is a self-contained step you can copy
 * into your own app.
 */

import { useMemo, useState } from "react";
import { Trustware, type TrustwareConfigOptions } from "@trustware/sdk";
import styles from "./page.module.css";

// ---------------------------------------------------------------------------
// Setup — env vars you'll need in `.env.local`
// ---------------------------------------------------------------------------
// NEXT_PUBLIC_TRUSTWARE_API_KEY       Your Trustware API key
// NEXT_PUBLIC_TRUSTWARE_FROM_CHAIN    Chain ID funds are sent from (default: Base, 8453)
// NEXT_PUBLIC_TRUSTWARE_TO_CHAIN      Chain ID funds should land on (default: Base, 8453)
// NEXT_PUBLIC_TRUSTWARE_FROM_TOKEN    Token address funds are sent from (default: native token)
// NEXT_PUBLIC_TRUSTWARE_TO_TOKEN      Token address funds should land as (default: USDC on Base)
// NEXT_PUBLIC_TRUSTWARE_FROM_AMOUNT   Amount to send, in base units
// NEXT_PUBLIC_TRUSTWARE_FROM_ADDRESS  Source wallet address
// NEXT_PUBLIC_TRUSTWARE_TO_ADDRESS    Destination wallet address
// ---------------------------------------------------------------------------
const env = {
  apiKey: process.env.NEXT_PUBLIC_TRUSTWARE_API_KEY || "",
  fromChain: process.env.NEXT_PUBLIC_TRUSTWARE_FROM_CHAIN || "8453",
  toChain: process.env.NEXT_PUBLIC_TRUSTWARE_TO_CHAIN || "8453",
  fromToken: process.env.NEXT_PUBLIC_TRUSTWARE_FROM_TOKEN || "",
  toToken: process.env.NEXT_PUBLIC_TRUSTWARE_TO_TOKEN || "",
  fromAmount: process.env.NEXT_PUBLIC_TRUSTWARE_FROM_AMOUNT || "0",
  fromAddress: process.env.NEXT_PUBLIC_TRUSTWARE_FROM_ADDRESS || "",
  toAddress: process.env.NEXT_PUBLIC_TRUSTWARE_TO_ADDRESS || "",
};

// ---------------------------------------------------------------------------
// Entry point — build a route with the SDK core APIs, no widget UI.
// ---------------------------------------------------------------------------
export default function Page() {
  const [result, setResult] = useState("Click Build route to call Trustware.");
  const [loading, setLoading] = useState(false);

  const config = useMemo(
    () =>
      ({
        apiKey: env.apiKey,
        routes: {
          toChain: env.toChain,
          toToken: env.toToken,
          toAddress: env.toAddress,
          defaultSlippage: 1,
        },
      }) satisfies TrustwareConfigOptions,
    [],
  );

  async function buildRoute() {
    setLoading(true);
    try {
      await Trustware.init(config);
      const route = await Trustware.buildRoute({
        fromChain: env.fromChain,
        toChain: env.toChain,
        fromToken: env.fromToken,
        toToken: env.toToken,
        fromAmount: env.fromAmount,
        fromAddress: env.fromAddress,
        toAddress: env.toAddress,
        slippageBps: 100,
      });
      setResult(JSON.stringify(route, null, 2));
    } catch (error) {
      setResult(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <p className={styles.eyebrow}>SDK core</p>
        <h1>Headless route builder</h1>
        <p className={styles.copy}>
          This Next.js example uses `Trustware.init` and `Trustware.buildRoute`
          directly. Use it when you want your own UI and transaction flow.
        </p>
        <button onClick={buildRoute} disabled={loading || !env.apiKey}>
          {loading ? "Building..." : "Build route"}
        </button>
        {!env.apiKey && (
          <p className={styles.warning}>
            Set NEXT_PUBLIC_TRUSTWARE_API_KEY first.
          </p>
        )}
        <pre>{result}</pre>
      </section>
    </main>
  );
}
