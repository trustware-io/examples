"use client";

/**
 * Trustware SDK + Privy embedded wallet demo
 * ============================================
 * This example shows the two flows most apps need when pairing Trustware
 * with a Privy embedded wallet:
 *
 *   1. DEPOSIT  — move funds from any connected EOA into the user's
 *      embedded (Privy) wallet, using <TrustwareWidget />.
 *   2. WITHDRAW — move funds back out of the embedded wallet headlessly,
 *      using the lower-level Trustware.* functions directly (no widget UI).
 *
 * Read top to bottom — each section is a self-contained step you can copy
 * into your own app.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
import {
  Trustware,
  TrustwareProvider,
  TrustwareWidget,
  useTrustware,
  type BalanceRow,
  type BuildRouteResult,
  type TrustwareConfigOptions,
  type WalletInterFaceAPI,
} from "@trustware/sdk";
import CopyAddressButton from "../components/CopyAddressButton";
import { useEmbeddedWallet } from "../lib/useEmbeddedWallet";
import { ensureErc20Allowance } from "../lib/erc20Approval";
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
const apiKey = process.env.NEXT_PUBLIC_TRUSTWARE_API_KEY || "";
const defaultChain = process.env.NEXT_PUBLIC_TRUSTWARE_TO_CHAIN || "8453";
const defaultToken =
  process.env.NEXT_PUBLIC_TRUSTWARE_TO_TOKEN ||
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

type TokenOption = ReturnType<typeof Trustware.useTokens>["tokens"][number];

// ---------------------------------------------------------------------------
// STEP 1: DEPOSIT
// ---------------------------------------------------------------------------
// <TrustwareWidget /> handles the entire deposit UI (source chain/token
// selection, quote, and signing) for you. All you need to do is:
//   a) wrap it in <TrustwareProvider config={...}>
//   b) tell Trustware where funds should end up — the embedded wallet address
// ---------------------------------------------------------------------------

/** Points the widget's destination at the connected embedded wallet. */
function SyncDestinationAddress({ address }: { address: string }) {
  const { status } = useTrustware();

  useEffect(() => {
    if (status === "ready" && address) {
      Trustware.setDestinationAddress(address);
    }
  }, [address, status]);

  return null;
}

function DepositStep({
  config,
  address,
}: {
  config: TrustwareConfigOptions;
  address: string;
}) {
  return (
    <section className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.stepBadge}>1</span>
        <div>
          <p className={styles.eyebrow}>Deposit</p>
          <h2>Fund the embedded wallet</h2>
        </div>
      </div>
      <p className={styles.cardIntro}>
        The widget below lets the user pick a source chain and token from any
        connected wallet. Funds land in the Privy embedded wallet automatically.
      </p>
      <TrustwareProvider config={config} autoDetect>
        <SyncDestinationAddress address={address} />
        <TrustwareWidget />
      </TrustwareProvider>
    </section>
  );
}

// ---------------------------------------------------------------------------
// STEP 2: WITHDRAW
// ---------------------------------------------------------------------------
// There's no pre-built widget for withdrawals, so this section calls the
// Trustware SDK directly. The flow is always the same four calls:
//   1. Trustware.getBalances(chain, address)      -> what can I send?
//   2. Trustware.buildRoute({...})                -> get a signable route
//   3. Trustware.sendRouteTransaction(route, ...)  -> sign & broadcast
//   4. Trustware.submitReceipt(intentId, txHash)   -> confirm with Trustware
// ---------------------------------------------------------------------------
function WithdrawStep({
  config,
  address,
  wallet,
  balanceRefreshKey,
}: {
  config: TrustwareConfigOptions;
  address: string;
  wallet?: WalletInterFaceAPI;
  balanceRefreshKey: number;
  setBalanceRefreshKey: React.Dispatch<React.SetStateAction<number>>;
}) {
  const { chains } = Trustware.useChains();

  const [fromChain, setFromChain] = useState(defaultChain);
  const [toChain, setToChain] = useState(defaultChain);
  const toTokenState = Trustware.useTokens(toChain);

  const [balances, setBalances] = useState<BalanceRow[]>([]);
  const [fromToken, setFromToken] = useState("");
  const [toToken, setToToken] = useState(defaultToken);
  const [amount, setAmount] = useState("");
  const [toAddress, setToAddress] = useState("");
  const [route, setRoute] = useState<BuildRouteResult>();
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);
  const [lastBalanceRefresh, setLastBalanceRefresh] = useState("");
  const [log, setLog] = useState(
    "Deposit first, then build a withdrawal route.",
  );

  // 1. Load spendable balances whenever the source chain, address, or
  // balanceRefreshKey (bumped after a deposit) changes.
  useEffect(() => {
    let cancelled = false;

    async function loadBalances() {
      setIsLoadingBalances(true);
      await Trustware.init(config);
      const rows = (await Trustware.getBalances(fromChain, address)).filter(
        (row) => {
          try {
            return BigInt(row.balance || "0") > 0n;
          } catch {
            return false;
          }
        },
      );
      if (cancelled) return;

      setBalances(rows);
      setFromToken((current) =>
        rows.some((row) => tokenId(row) === current)
          ? current
          : tokenId(rows[0]),
      );
      setLastBalanceRefresh(new Date().toLocaleTimeString());
      setLog(
        `Loaded ${rows.length} funded token${rows.length === 1 ? "" : "s"} from the embedded wallet.`,
      );
    }

    if (address && fromChain) {
      void loadBalances()
        .catch((error) => setLog(String(error)))
        .finally(() => {
          if (!cancelled) setIsLoadingBalances(false);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [address, balanceRefreshKey, config, fromChain]);

  useEffect(() => {
    const tokens = toTokenState.tokens;
    if (!tokens.length) return;

    setToToken((current) => {
      if (tokens.some((token) => sameToken(tokenId(token), current))) {
        return current;
      }
      return (
        tokenId(
          tokens.find((token) => sameToken(tokenId(token), defaultToken)),
        ) || tokenId(tokens[0])
      );
    });
  }, [toTokenState.tokens]);

  const refreshBalances = useCallback(() => {
    setLastBalanceRefresh(
      () => `Refreshing… (${new Date().toLocaleTimeString()})`,
    );
  }, [setLastBalanceRefresh]);

  const selectedToken = balances.find(
    (row) => tokenId(row).toLowerCase() === fromToken.toLowerCase(),
  );
  const availableBalanceLabel = selectedToken
    ? `${formatUnits(selectedToken.balance, selectedToken.decimals)} ${
        selectedToken.symbol || shortenAddress(tokenId(selectedToken))
      }`
    : "No balance on this chain";
  const amountInBaseUnits = selectedToken
    ? parseUnits(amount || "0", selectedToken.decimals)
    : "";
  const maxSpendableBaseUnits = selectedToken
    ? maxSpendableBalance(selectedToken)
    : "";
  const amountExceedsBalance =
    amountInBaseUnits &&
    maxSpendableBaseUnits &&
    baseUnitsGreaterThan(amountInBaseUnits, maxSpendableBaseUnits);

  // Gas is always paid in the chain's native token, never in the token
  // being withdrawn — and the first withdrawal of a given ERC-20 usually
  // needs an extra approval transaction. A wallet holding only an ERC-20
  // balance (no native gas) will fail here, so flag it before the user hits
  // a confusing on-chain revert.
  const hasNativeGas = balances.some(
    (row) => row.category === "native" && BigInt(row.balance || "0") > 0n,
  );
  const needsGasWarning = Boolean(
    selectedToken && selectedToken.category !== "native" && !hasNativeGas,
  );

  // 2. Ask Trustware for a route (quote + calldata) for this withdrawal.
  async function buildRoute() {
    if (amountExceedsBalance) {
      setLog("Amount is higher than the spendable balance.");
      return;
    }
    await Trustware.init(config);
    const nextRoute = await Trustware.buildRoute({
      fromChain,
      toChain,
      fromToken,
      toToken,
      fromAmount: amountInBaseUnits,
      fromAddress: address,
      toAddress,
      slippageBps: 100, // 1% slippage tolerance
    });
    setRoute(nextRoute);
    setLog(JSON.stringify(nextRoute, null, 2));
  }

  // 3 & 4. Sign the route with the embedded wallet, broadcast it, then tell
  // Trustware about the resulting tx hash so it can track completion.
  async function sendRoute() {
    if (!route || !wallet) return;
    Trustware.useWallet(wallet);

    try {
      // Cross-chain routes (this one bridges through Mayan) carry a
      // short-lived quote, so rebuild fresh right before sending instead of
      // executing whatever "Build route" quoted earlier. This must happen
      // BEFORE the approval check below: different quotes can route through
      // different contracts, so approving the old route's spender and then
      // sending a newly-rebuilt route can leave the wrong contract approved.
      setLog("Refreshing route before sending...");
      const freshRoute = await Trustware.buildRoute({
        fromChain,
        toChain,
        fromToken,
        toToken,
        fromAmount: amountInBaseUnits,
        fromAddress: address,
        toAddress,
        slippageBps: 100,
      });
      setRoute(freshRoute);

      // buildRoute() doesn't accept a permit input, so whichever contract
      // THIS route calls (LI.FI's Diamond) still expects a standing
      // allowance — it pulls funds with a direct ERC20 transferFrom, not
      // Permit2. For non-native tokens, approve it directly if needed.
      const spender = freshRoute.txReq?.to || freshRoute.txReq?.target;
      if (selectedToken && selectedToken.category !== "native" && spender) {
        await ensureErc20Allowance({
          chainId: fromChain,
          wallet,
          owner: address as `0x${string}`,
          token: fromToken as `0x${string}`,
          spender: spender as `0x${string}`,
          amount: BigInt(amountInBaseUnits || "0"),
          onStep: setLog,
        });
      }

      const txHash = await Trustware.sendRouteTransaction(
        freshRoute,
        fromChain,
      );
      const receipt = await Trustware.submitReceipt(
        freshRoute.intentId,
        txHash,
      );
      setLog(JSON.stringify({ txHash, receipt }, null, 2));
    } catch (error) {
      setLog(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <section className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.stepBadge}>2</span>
        <div>
          <p className={styles.eyebrow}>Withdraw</p>
          <h2>Send from the embedded wallet</h2>
        </div>
      </div>

      <div className={styles.balancePanel}>
        <div>
          <span className={styles.balanceLabel}>
            {isLoadingBalances
              ? "Refreshing..."
              : lastBalanceRefresh
                ? `Updated ${lastBalanceRefresh}`
                : "Available"}
          </span>
          <strong className={styles.balanceValue}>
            {availableBalanceLabel}
          </strong>
        </div>
        <button
          type="button"
          className={styles.btnSecondary}
          disabled={!selectedToken || maxSpendableBaseUnits === "0"}
          onClick={() =>
            selectedToken &&
            setAmount(
              formatUnits(maxSpendableBaseUnits, selectedToken.decimals),
            )
          }
        >
          Use max
        </button>
        <button
          type="button"
          className={styles.btnSecondary}
          disabled={isLoadingBalances}
          onClick={refreshBalances}
        >
          Refresh balances
        </button>
      </div>
      {selectedToken?.category === "native" ? (
        <p className={styles.helperText}>Max leaves a small gas reserve.</p>
      ) : null}

      <div className={styles.fieldGrid}>
        <label>
          From chain
          <select
            value={fromChain}
            onChange={(e) => setFromChain(e.target.value)}
          >
            {chainOptions(chains, defaultChain)}
          </select>
        </label>
        <label>
          To chain
          <select value={toChain} onChange={(e) => setToChain(e.target.value)}>
            {chainOptions(chains, defaultChain)}
          </select>
        </label>
        <label>
          Send token
          <select
            value={fromToken}
            onChange={(e) => setFromToken(e.target.value)}
          >
            {balances.map((row) => (
              <option key={tokenId(row)} value={tokenId(row)}>
                {row.symbol || shortenAddress(tokenId(row))} —{" "}
                {formatUnits(row.balance, row.decimals)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Receive token
          <select value={toToken} onChange={(e) => setToToken(e.target.value)}>
            {toTokenState.tokens.map((token) => (
              <option key={tokenId(token)} value={tokenId(token)}>
                {token.symbol || shortenAddress(tokenId(token))}
              </option>
            ))}
          </select>
        </label>
      </div>

      {toTokenState.error ? (
        <p className={styles.notice}>Could not load destination tokens.</p>
      ) : null}

      <label>
        Amount {selectedToken?.symbol ? `(${selectedToken.symbol})` : ""}
        <input
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </label>
      {amountExceedsBalance ? (
        <p className={styles.notice}>
          Amount is higher than the spendable balance.
        </p>
      ) : null}
      {needsGasWarning ? (
        <p className={styles.notice}>
          This wallet has no ETH to pay gas. Withdrawing{" "}
          {selectedToken?.symbol || "a token"} still costs gas in ETH, and the
          first withdrawal of a token may also need a one-time approval
          transaction. Fund the embedded wallet with a small amount of ETH
          first.
        </p>
      ) : null}

      <label>
        Destination wallet
        <input
          placeholder="0x..."
          value={toAddress}
          onChange={(e) => setToAddress(e.target.value)}
        />
      </label>

      <div className={styles.actions}>
        <button
          className={styles.btnPrimary}
          disabled={
            !fromToken ||
            !toToken ||
            !toAddress ||
            !amountInBaseUnits ||
            !!amountExceedsBalance ||
            needsGasWarning
          }
          onClick={() => void buildRoute()}
        >
          Build route
        </button>
        <button
          className={styles.btnSecondary}
          disabled={!route || !wallet}
          onClick={() => void sendRoute()}
        >
          Send
        </button>
      </div>

      <pre className={styles.console}>{log}</pre>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page shell — wires up Privy auth, the embedded wallet, and both steps.
// ---------------------------------------------------------------------------
function Demo() {
  const { ready, authenticated, login, logout } = usePrivy();
  const { address, wallet } = useEmbeddedWallet();
  const [balanceRefreshKey, setBalanceRefreshKey] = useState(0);
  const refreshQueuedRef = useRef(false);

  const refreshEmbeddedBalances = useCallback(() => {
    if (refreshQueuedRef.current) return;
    refreshQueuedRef.current = true;
    setBalanceRefreshKey((key) => key + 1);
    window.setTimeout(() => {
      refreshQueuedRef.current = false;
    }, 0);
  }, []);

  const config = useMemo(
    () =>
      ({
        apiKey,
        routes: {
          toChain: defaultChain,
          toToken: defaultToken,
          toAddress: address || undefined,
          defaultSlippage: 1,
        },
        autoDetectProvider: true,
        messages: {
          title: "Deposit",
          description: "Deposit into your app wallet.",
        },
        onSuccess: (result) => {
          console.log("Deposit successful:", result);
          refreshEmbeddedBalances();
        },
        onEvent: (event) => {
          if (event.type === "transaction_success") {
            refreshEmbeddedBalances();
          }
        },
      }) satisfies TrustwareConfigOptions,
    [address, refreshEmbeddedBalances],
  );

  // Show one clear message at a time instead of the two steps below it.
  const blockingMessage = !apiKey
    ? "Set NEXT_PUBLIC_TRUSTWARE_API_KEY first."
    : !ready
      ? "Loading Privy…"
      : !authenticated
        ? "Log in to create an embedded wallet."
        : !address
          ? "Preparing embedded wallet…"
          : "";

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.intro}>
          <p className={styles.eyebrow}>Trustware × Privy</p>
          <h1>Deposit, then withdraw</h1>
          <p>
            Fund a Privy embedded wallet from any connected wallet, then move
            funds back out headlessly — no widget required for the withdrawal.
          </p>
        </header>

        <div className={styles.walletBar}>
          <span>
            {address ? (
              <>
                Embedded wallet <code>{shortenAddress(address)}</code>
              </>
            ) : (
              "No embedded wallet yet"
            )}
          </span>
          <div className={styles.walletActions}>
            {address ? (
              <CopyAddressButton
                address={address}
                className={styles.btnSecondary}
              />
            ) : null}
            <button
              className={styles.btnSecondary}
              onClick={authenticated ? logout : login}
            >
              {authenticated ? "Log out" : "Log in"}
            </button>
          </div>
        </div>

        {blockingMessage ? (
          <p className={styles.notice}>{blockingMessage}</p>
        ) : (
          <div className={styles.stepsRow}>
            <DepositStep config={config} address={address} />
            <WithdrawStep
              config={config}
              address={address}
              wallet={wallet}
              balanceRefreshKey={balanceRefreshKey}
              setBalanceRefreshKey={setBalanceRefreshKey}
            />
          </div>
        )}
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Small formatting helpers — not part of the SDK, just UI plumbing.
// ---------------------------------------------------------------------------
function chainOptions(
  chains: Array<{
    chainId: string | number;
    networkName?: string;
    networkIdentifier?: string;
  }>,
  fallbackChainId: string,
) {
  const list = chains.length ? chains : [{ chainId: fallbackChainId }];
  return list.map((c) => (
    <option key={String(c.chainId)} value={String(c.chainId)}>
      {c.networkName || c.networkIdentifier || c.chainId}
    </option>
  ));
}

function tokenId(row?: BalanceRow | TokenOption) {
  return row?.address || (row && "contract" in row ? row.contract || "" : "");
}

function sameToken(a: string, b: string) {
  return a.toLowerCase() === b.toLowerCase();
}

function maxSpendableBalance(row: BalanceRow) {
  try {
    const balance = BigInt(row.balance || "0");
    if (row.category !== "native") return balance.toString();

    // Reserve 0.00001 of the native token for gas — enough to cover a simple
    // transfer on L2s like this example's default chain (Base). The previous
    // 0.0001 reserve was bigger than a typical L2 wallet balance and zeroed
    // out "Use max" entirely. This is still a flat heuristic, not a live gas
    // estimate — if you target L1 mainnet, size the reserve for its higher
    // (and more volatile) gas costs instead.
    const unit = 10n ** BigInt(row.decimals);
    const suggestedReserve = unit / 100000n;
    const reserve = suggestedReserve > 0n ? suggestedReserve : 1n;
    return balance > reserve ? (balance - reserve).toString() : "0";
  } catch {
    return row.balance || "0";
  }
}

function baseUnitsGreaterThan(a: string, b: string) {
  try {
    return BigInt(a || "0") > BigInt(b || "0");
  } catch {
    return false;
  }
}

/** Converts a base-unit balance (e.g. wei) into a human-readable string. */
function formatUnits(raw: string, decimals = 18) {
  try {
    const value = BigInt(raw || "0");
    const divisor = 10n ** BigInt(decimals);
    const whole = value / divisor;
    const fraction = (value % divisor)
      .toString()
      .padStart(decimals, "0")
      .slice(0, 6)
      .replace(/0+$/, "");
    return fraction ? `${whole}.${fraction}` : whole.toString();
  } catch {
    return raw;
  }
}

/** Converts a human-entered amount (e.g. "1.5") into base units. */
function parseUnits(value: string, decimals = 18) {
  const [whole, fraction = ""] = value.trim().replace(",", ".").split(".");
  if (!/^\d+$/.test(whole || "0") || !/^\d*$/.test(fraction)) return "";
  return (
    BigInt(whole || "0") * 10n ** BigInt(decimals) +
    BigInt(fraction.padEnd(decimals, "0").slice(0, decimals) || "0")
  ).toString();
}

// ---------------------------------------------------------------------------
// Entry point — wrap everything in PrivyProvider so hooks like usePrivy()
// and useWallets() work throughout the tree.
// ---------------------------------------------------------------------------
export default function Page() {
  if (!privyAppId) {
    return (
      <main className={styles.page}>
        <p className={styles.notice}>
          Set NEXT_PUBLIC_PRIVY_APP_ID in .env.local.
        </p>
      </main>
    );
  }

  return (
    <PrivyProvider appId={privyAppId}>
      <Demo />
    </PrivyProvider>
  );
}
