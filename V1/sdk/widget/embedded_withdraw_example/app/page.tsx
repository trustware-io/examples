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
import {
  PrivyProvider,
  usePrivy,
  useWallets,
  getEmbeddedConnectedWallet,
} from "@privy-io/react-auth";
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
import { useEIP1193 } from "@trustware/sdk/wallet";

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

type EmbeddedWallet = {
  walletClientType?: string;
  address?: string;
  getEthereumProvider?: () => Promise<{
    request(args: {
      method: string;
      params?: unknown[] | object;
    }): Promise<unknown>;
  }>;
};
type TokenOption = ReturnType<typeof Trustware.useTokens>["tokens"][number];

// ---------------------------------------------------------------------------
// Helper hook: find the user's Privy embedded wallet and wrap it in the
// EIP-1193 adapter Trustware expects for signing transactions.
// ---------------------------------------------------------------------------
function useEmbeddedWallet() {
  const { wallets } = useWallets();
  const [state, setState] = useState<{
    address: string;
    wallet?: WalletInterFaceAPI;
  }>({
    address: "",
  });

  useEffect(() => {
    let cancelled = false;

    // Only ever resolve the user's actual Privy embedded wallet — never
    // fall back to whatever wallet happens to be first (e.g. a connected
    // EOA), which would silently treat the EOA as the embedded wallet.
    const embedded = getEmbeddedConnectedWallet(
      wallets,
    ) as EmbeddedWallet | null;

    async function load() {
      if (!embedded?.address) {
        setState({ address: "" });
        return;
      }
      const provider = await embedded.getEthereumProvider?.();
      if (!cancelled) {
        setState({
          address: embedded.address!,
          wallet: provider ? useEIP1193(provider) : undefined,
        });
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [wallets]);

  return state;
}

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
    <section className="card">
      <div className="cardHeader">
        <span className="stepBadge">1</span>
        <div>
          <p className="eyebrow">Deposit</p>
          <h2>Fund the embedded wallet</h2>
        </div>
      </div>
      <p className="cardIntro">
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

  // 1. Load spendable balances whenever the source chain or address changes.
  const lastRefreshKeyRef = useRef(balanceRefreshKey);
  useEffect(() => {
    let cancelled = false;

    // Only force a fresh on-chain scan when this run was triggered by a
    // deposit/event refresh — the SDK caches getBalances() results, so a
    // plain chain/address switch can still reuse that cache.
    const forceRefresh = balanceRefreshKey !== lastRefreshKeyRef.current;
    lastRefreshKeyRef.current = balanceRefreshKey;

    async function loadBalances() {
      setIsLoadingBalances(true);
      await Trustware.init(config);
      const rows = (
        await Trustware.getBalances(fromChain, address, { forceRefresh })
      ).filter((row) => {
        try {
          return BigInt(row.balance || "0") > 0n;
        } catch {
          return false;
        }
      });
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
    const txHash = await Trustware.sendRouteTransaction(route, fromChain);
    const receipt = await Trustware.submitReceipt(route.intentId, txHash);
    setLog(JSON.stringify({ txHash, receipt }, null, 2));
  }

  return (
    <section className="card">
      <div className="cardHeader">
        <span className="stepBadge">2</span>
        <div>
          <p className="eyebrow">Withdraw</p>
          <h2>Send from the embedded wallet</h2>
        </div>
      </div>

      <div className="balancePanel">
        <div>
          <span className="balanceLabel">
            {isLoadingBalances
              ? "Refreshing..."
              : lastBalanceRefresh
                ? `Updated ${lastBalanceRefresh}`
                : "Available"}
          </span>
          <strong className="balanceValue">{availableBalanceLabel}</strong>
        </div>
        <button
          type="button"
          className="btnSecondary"
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
      </div>
      {selectedToken?.category === "native" ? (
        <p className="helperText">Max leaves a small gas reserve.</p>
      ) : null}

      <div className="fieldGrid">
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
        <p className="notice">Could not load destination tokens.</p>
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
        <p className="notice">Amount is higher than the spendable balance.</p>
      ) : null}

      <label>
        Destination wallet
        <input
          placeholder="0x..."
          value={toAddress}
          onChange={(e) => setToAddress(e.target.value)}
        />
      </label>

      <div className="actions">
        <button
          className="btnPrimary"
          disabled={
            !fromToken ||
            !toToken ||
            !toAddress ||
            !amountInBaseUnits ||
            !!amountExceedsBalance
          }
          onClick={() => void buildRoute()}
        >
          Build route
        </button>
        <button
          className="btnSecondary"
          disabled={!route || !wallet}
          onClick={() => void sendRoute()}
        >
          Send
        </button>
      </div>

      <pre className="console">{log}</pre>
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
    <main className="page">
      <div className="shell">
        <header className="intro">
          <p className="eyebrow">Trustware × Privy</p>
          <h1>Deposit, then withdraw</h1>
          <p>
            Fund a Privy embedded wallet from any connected wallet, then move
            funds back out headlessly — no widget required for the withdrawal.
          </p>
        </header>

        <div className="walletBar">
          <span>
            {address ? (
              <>
                Embedded wallet <code>{shortenAddress(address)}</code>
              </>
            ) : (
              "No embedded wallet yet"
            )}
          </span>
          <button
            className="btnSecondary"
            onClick={authenticated ? logout : login}
          >
            {authenticated ? "Log out" : "Log in"}
          </button>
        </div>

        {blockingMessage ? (
          <p className="notice">{blockingMessage}</p>
        ) : (
          <div className="stepsRow">
            <DepositStep config={config} address={address} />
            <WithdrawStep
              config={config}
              address={address}
              wallet={wallet}
              balanceRefreshKey={balanceRefreshKey}
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

function shortenAddress(value: string) {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
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
      <main className="page">
        <p className="notice">Set NEXT_PUBLIC_PRIVY_APP_ID in .env.local.</p>
      </main>
    );
  }

  return (
    <PrivyProvider appId={privyAppId}>
      <Demo />
    </PrivyProvider>
  );
}
