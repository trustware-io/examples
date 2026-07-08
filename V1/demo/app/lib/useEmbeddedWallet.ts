"use client";

import { useEffect, useState } from "react";
import { useWallets, getEmbeddedConnectedWallet } from "@privy-io/react-auth";
import { type WalletInterFaceAPI } from "@trustware/sdk";
import { useEIP1193 } from "@trustware/sdk/wallet";
import { getPublicClient } from "./publicClient";

type RawEip1193 = {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
};

type EmbeddedWallet = {
  walletClientType?: string;
  address?: string;
  getEthereumProvider?: () => Promise<RawEip1193>;
};

/**
 * Privy's embedded wallet forwards eth_sendTransaction to the RPC without
 * estimating gas itself, so large-calldata contract calls (e.g. an ERC-20
 * route through an aggregator) get sent with no `gas` field and are
 * rejected as "intrinsic gas too low" — the node's minimum for that much
 * calldata is higher than whatever default the RPC falls back to. Native
 * ETH sends are small enough to slip under that default, which is why only
 * token withdrawals hit this.
 *
 * The provider itself can't help here either: it only implements
 * write/signing methods, and silently returns "0x" for eth_estimateGas
 * instead of a real value or an error. So we estimate through a real public
 * RPC client and inject a 30% buffer before the transaction ever reaches
 * Privy's provider.
 */
function withGasEstimate(provider: RawEip1193): RawEip1193 {
  return {
    async request(args) {
      if (args.method !== "eth_sendTransaction") {
        return provider.request(args);
      }

      const params = args.params as [Record<string, unknown>] | undefined;
      const tx = params?.[0];
      if (!tx || tx.gas != null) {
        return provider.request(args);
      }

      const chainIdHex = (tx.chainId as string | undefined) ?? ((await provider.request({
        method: "eth_chainId",
      })) as string);
      const client = getPublicClient(BigInt(chainIdHex).toString());

      // Do NOT fall back to sending on estimation failure: that used to
      // silently swallow the real revert reason and submit a guaranteed-to-
      // fail zero-gas transaction, which only ever surfaced as a misleading
      // "intrinsic gas too low" error instead of the actual problem. Let it
      // throw here so the real cause reaches the caller.
      const estimated = await client.estimateGas({
        account: tx.from as `0x${string}`,
        to: tx.to as `0x${string}`,
        data: tx.data as `0x${string}` | undefined,
        value: tx.value != null ? BigInt(tx.value as string) : undefined,
      });
      const withBuffer = (estimated * 130n) / 100n;
      return provider.request({
        method: "eth_sendTransaction",
        params: [{ ...tx, gas: `0x${withBuffer.toString(16)}` }],
      });
    },
  };
}

/**
 * Finds the user's Privy embedded wallet and wraps it in the EIP-1193
 * adapter Trustware expects for signing transactions.
 */
export function useEmbeddedWallet() {
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
          wallet: provider ? useEIP1193(withGasEstimate(provider)) : undefined,
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
