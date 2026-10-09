# Deposit USDC into Spice · headless SDK

A standalone Next.js example: select wallet-held USDC, review a Trustware route, then deposit a fixed **50 USDC** into the Spice Ethereum vault with your connected wallet as share beneficiary. It demonstrates synchronous `deposit(uint256 assets, address receiver)`, with no widget.

**Runnable locally, not funded-ready:** the page works without a key. Balances require a server API key; routing and signing also require the verified corridor configuration below. The preset deliberately does not authorize a live deposit.

## Run

Use Node 22 LTS. From this directory:

```sh
npm ci --ignore-scripts
npm run dev
```

Open http://127.0.0.1:3000. To load balances, copy `.env.example` to `.env.local`, supply your Trustware API key, and restart. Keep the key server-only; never use `NEXT_PUBLIC_`. This server is localhost-only, not a public deployment template.

## Enable a deposit

Edit [`lib/config.mjs`](lib/config.mjs) using the short [configuration guide](CONFIGURATION.md): verify the current vault and receiver eligibility, provision one supported source's router/spender allowlists, then set `verifiedSynchronousPullDeposit: true`. Do not simply flip the flag or trust addresses supplied by an unverified route.

Connect an injected EVM wallet, choose supported USDC holdings, enter a source amount covering the fixed destination budget **plus fees/slippage**, then **Review deposit → Approve & deposit → Retry receipt & check status**. Native gas is required. The guaranteed route output must cover the destination budget; the source amount is not the deposit amount.

## Follow the code

1. [`app/page.tsx`](app/page.tsx): wallet/asset selection and review UI.
2. [`lib/core.mjs`](lib/core.mjs), `buildBody`: encode the vault post-hook with an explicit beneficiary and fixed funding; validate the returned route.
3. [`app/api/deposit/route.ts`](app/api/deposit/route.ts) → [`lib/transport.mjs`](lib/transport.mjs): server-only `@trustware/sdk/core` 1.1.16 calls to `init`, `getBalancesByAddress`, `buildRoute`, `submitReceipt` and `pollStatus`.
4. [`lib/wallet.mjs`](lib/wallet.mjs): app-owned injected-wallet approvals, broadcast and persistence. This is **server-side headless routing**, not browser SDK `useWallet`/`sendRouteTransaction` orchestration. No wallet is attached to the server singleton.
5. [`lib/receipt.mjs`](lib/receipt.mjs): use SDK/API tracking fields; optionally verify the destination vault's `Deposit` event. There is no parallel general-purpose RPC transaction tracker.

## Recovery and evidence

Pending sends are locked and saved before broadcast; known hashes are saved before receipt submission. Tracking retries **never resend**. Do not clear an unresolved record or run both examples on different ports with the same wallet. A rejected/ambiguous approval also requires wallet/explorer reconciliation; there is no automatic unlock.

API route success is not proof of vault shares. Confirmed landed underlying requires `landed_amount_verified === true`; vault credit additionally requires a matching `Deposit` event with the correct receiver, exact assets and positive shares. Manual destination hashes do not prove source-intent attribution. API lifecycle dates are not block timestamps; unavailable actual source spend stays unavailable.

## Checks and remaining gates

```sh
npm test
npm run typecheck
npm run build
```

Tests use synthetic fixtures and mocked wallet/RPC/API calls. No funded deposit or browser-wallet end-to-end test is claimed. Before live use, verify current minimum/eligibility, executor hook support, source router/spender identities, gas and surplus/refund behavior. Public deployment additionally needs authentication, quotas and durable recovery; local storage and same-origin locks do not coordinate devices or separate origins.

Dependency review reports **5 moderate production findings** in the SDK's Solana dependency chain (`web3.js`, `jayson`, `stream-json`/`uuid`), with no high/critical findings. The suggested SDK downgrade to 1.0.7 was not applied; review the current audit before adoption.
