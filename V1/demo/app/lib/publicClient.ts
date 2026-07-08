import { createPublicClient, http, type Chain, type PublicClient } from "viem";
import * as viemChains from "viem/chains";

const chainsById = new Map<number, Chain>();
for (const value of Object.values(viemChains)) {
  if (value && typeof value === "object" && "id" in value) {
    chainsById.set((value as Chain).id, value as Chain);
  }
}

const clientCache = new Map<number, PublicClient>();

/**
 * Privy's embedded wallet provider only implements write/signing RPC
 * methods (eth_sendTransaction, eth_requestAccounts, ...) — read methods
 * like eth_call resolve to "0x" instead of real data or an error. Anything
 * that just reads chain state (allowance checks, receipt polling, gas
 * estimation) needs to go through a real public RPC client instead of the
 * wallet's `.request()`.
 */
export function getPublicClient(chainId: number | string): PublicClient {
  const id = Number(chainId);
  const cached = clientCache.get(id);
  if (cached) return cached;

  const chain = chainsById.get(id);
  if (!chain) {
    throw new Error(`No known public RPC for chain ${chainId}`);
  }
  const client = createPublicClient({ chain, transport: http() });
  clientCache.set(id, client);
  return client;
}
