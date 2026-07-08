"use client";

/**
 * Trustware SDK + Privy embedded wallet swap demo
 * ============================================
 * This example shows how to run <TrustwareWidget /> in swap mode against a
 * Privy embedded wallet instead of a browser-injected EOA:
 *
 *   1. Log the user into Privy to create/connect their embedded wallet.
 *   2. Resolve that embedded wallet and wrap it in the EIP-1193 adapter
 *      Trustware expects for signing transactions.
 *   3. Hand the wallet to <TrustwareProvider /> with swap mode enabled via
 *      `features.swapMode` + `features.swapDefaultDestToken`.
 *
 * Read top to bottom — each section is a self-contained step you can copy
 * into your own app.
 */

import { useMemo } from "react";
import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
import {
  TrustwareProvider,
  TrustwareWidget,
  type TrustwareConfigOptions,
} from "@trustware/sdk";
import CopyAddressButton from "../components/CopyAddressButton";
import { useEmbeddedWallet } from "../lib/useEmbeddedWallet";
import { shortenAddress } from "../lib/format";
import styles from "./page.module.css";

// ---------------------------------------------------------------------------
// Setup — env vars you'll need in `.env.local`
// ---------------------------------------------------------------------------
// NEXT_PUBLIC_PRIVY_APP_ID          Your Privy app ID
// NEXT_PUBLIC_TRUSTWARE_API_KEY     Your Trustware API key
// NEXT_PUBLIC_TRUSTWARE_TO_CHAIN    Chain ID funds should land on (default: Base, 8453)
// NEXT_PUBLIC_TRUSTWARE_TO_TOKEN    Token address funds should land as (default: USDC on Base)
// ---------------------------------------------------------------------------
const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "";
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
  autoDetectProvider: false,
  features: {
    swapMode: true,
    swapDefaultDestToken: {
      chainId: Number(toChain),
      address: toToken,
    },
  },
  messages: {
    title: "Embedded wallet swap",
    description: "Privy owns the wallet session; Trustware owns swap routing.",
  },
} satisfies TrustwareConfigOptions;

// ---------------------------------------------------------------------------
// Page shell — wires up Privy auth, the embedded wallet, and the widget.
// ---------------------------------------------------------------------------
function Demo() {
  const { ready, authenticated, login, logout } = usePrivy();
  const { address, wallet } = useEmbeddedWallet();

  // Show one clear message at a time instead of the widget below it.
  const content = useMemo(() => {
    if (!privyAppId) return "Set NEXT_PUBLIC_PRIVY_APP_ID first.";
    if (!ready) return "Loading Privy...";
    if (!authenticated) return "Log in to create or connect an embedded wallet.";
    if (!wallet) return "Preparing embedded wallet...";
    return null;
  }, [authenticated, ready, wallet]);

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <div className={styles.intro}>
          <p className={styles.eyebrow}>Embedded wallet</p>
          <h1>Swap with Privy + Trustware</h1>
          <p>
            The embedded wallet is passed to Trustware, and swap mode is
            enabled in SDK feature flags.
          </p>
        </div>
        <div className={styles.actions}>
          {!authenticated ? (
            <button onClick={login}>Log in</button>
          ) : (
            <button onClick={logout}>Log out</button>
          )}
        </div>
        {address ? (
          <div className={styles.walletRow}>
            <span>
              Embedded wallet <code>{shortenAddress(address)}</code>
            </span>
            <CopyAddressButton address={address} className={styles.btnSecondary} />
          </div>
        ) : null}
        {content ? (
          <p className={styles.notice}>{content}</p>
        ) : (
          <TrustwareProvider config={config} wallet={wallet} autoDetect={false}>
            <TrustwareWidget initialStep="home" />
          </TrustwareProvider>
        )}
      </section>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Entry point — wrap everything in PrivyProvider so hooks like usePrivy()
// and useWallets() work throughout the tree.
// ---------------------------------------------------------------------------
export default function Page() {
  if (!privyAppId) {
    return (
      <main className={styles.page}>
        <section className={styles.shell}>
          <div className={styles.intro}>
            <p className={styles.eyebrow}>Embedded wallet</p>
            <h1>Swap with Privy + Trustware</h1>
          </div>
          <p className={styles.notice}>
            Set NEXT_PUBLIC_PRIVY_APP_ID in .env.local to run this example.
          </p>
        </section>
      </main>
    );
  }

  return (
    <PrivyProvider appId={privyAppId}>
      <Demo />
    </PrivyProvider>
  );
}
