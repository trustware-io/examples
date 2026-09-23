# Headless swap / bridge (EOA)

A standalone Next.js page using **@trustware/sdk 1.1.16**. The application owns inputs and review; the SDK owns route construction, allowance checks, approval confirmation and the source transaction send. It does not render the widget.

## Quick start

Use Node 24.x. From this directory:

```sh
npm install --ignore-scripts
cp .env.example .env.local
npm run test
npm run typecheck
npm run dev
```

Open the localhost URL printed by Next. Configure a **browser-safe, origin-restricted** Trustware API key in `.env.local`; `NEXT_PUBLIC_*` values are public. Never use a privileged server key. Restart Next after changing environment variables.

The default is **preview only**. Connect an injected EVM wallet and build a route; building does not sign or send. Enabling `NEXT_PUBLIC_ENABLE_EXECUTION=true` exposes execution after review. This is an operator opt-in, **not authentication** or certification of a supported corridor. Review the integration and funding limits before enabling. Do not enable it merely to run tests.

The source example has no committed lockfile yet. A fresh dependency resolution and production build must be validated before publication. The automated tests use synthetic SDK/provider responses; they do not prove a funded swap or a live supported corridor.

## Presets and input units

- Same-chain reference: Base (`8453`) native ETH → Base USDC. Default `1000000000000000` base units is **0.001 ETH**. It may be below current provider minimums.
- Cross-chain reference: set source chain to Ethereum (`1`), source token to the native sentinel, and keep destination Base USDC. This illustrates a bridge request; it is not a promise of present routing support.
- Native sentinel: `0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE`.
- Base USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`.
- ERC-20 example: **1 USDC = 1000000 base units** on a chain where that address is USDC. The app does not guess decimals or automatically change token addresses when switching chains.
- Blank recipient means the connected EOA. Source address is always read from the wallet, not environment configuration.
- Explicit scope: Ethereum, Base, Arbitrum, Optimism and Polygon EVM EOAs. No Solana, sponsored/smart-account execution, hooks or vault deposits.

## Source walkthrough

1. `app/page.tsx` loads the client-only page; wallet SDK code is not server-rendered.
2. `app/swap-client.tsx`: connect the injected provider, initialize Trustware, attach `Trustware.useWallet(guardedWallet(...))`, build, review, confirm, and resume tracking.
3. `app/flow.ts`: `build()` validates integer base units and copies/freezes the route. Editing inputs invalidates it; review expires after 60 seconds.
4. `execute()` persists the intent **before** `Trustware.sendRouteTransaction`. The SDK handles approvals; this app neither sends a second approval nor sets `approvalsEnsured`. Sponsored routes are refused.
5. Persist the returned source hash, call `Trustware.submitReceipt(intentId, hash)`, then call `Trustware.getStatus` with bounded requests and a 90-second tracking deadline. `success` and `failed` are terminal; unknown statuses never become success.
6. `resume()` only resubmits the existing receipt, when its hash is known, and tracks the existing intent. **It never resends the transaction.**

The final injected-provider adapter checks the reviewed account and source chain before forwarding a send, including approval sends. Network switching is limited to the reviewed source chain. Wallet rejection, disconnect or an ambiguous provider error can follow an approval or broadcast, so every started execution remains locked rather than offering a blind retry. The reviewed plan and calldata still rely on the SDK/provider's correctness; this example is not an independent transaction simulator or contract allowlist.

## Recovery and browser requirements

Execution requires browser storage and Web Locks on localhost/HTTPS. A same-origin lock plus a saved execution marker prevents a second tab from starting another execution. Intent/hash are stored in localStorage under `trustware-swap-example-v1`; no keys, route payloads or wallet state are persisted.

After reload, use **Resume receipt/status only**. If a send failed before returning a hash, use the saved intent and wallet history to reconcile manually. Do not clear the marker until all approval/source effects have been checked. There is deliberately no automatic reset/new-send button after an uncertain result. Clearing site storage defeats this browser-local protection; it is not server-side idempotency or cross-device coordination.

A terminal API success is not the same as a verified amount: the page labels `toAmountWei` as confirmed only when `landed_amount_verified === true`; otherwise it remains an estimate. No parallel RPC receipt tracker or inferred block timestamps are added.

## Verification

```sh
npm test
npm run typecheck
npm run build
```

`app/flow.test.ts` covers synthetic same/cross-chain inputs, invalid amounts/addresses, unsupported sponsorship, malformed plans, review mutation/invalidation, signer drift, duplicate confirmation, persistence failures, post-send recovery, terminal/nonterminal/unknown statuses, and a never-resolving status request. These tests exercise the application's real controller and guarded wallet adapter with mocked SDK/provider boundaries. They do **not** exercise real SDK ERC-20 approval execution or a funded browser flow.

Before publication: clean dependency resolution/lockfile, production build, browser rendering, actual SDK-native/ERC-20 approval paths and independent review. A separately authorized funded corridor check remains separate from all offline gates.

SDK contract reference: https://docs.trustware.io/integration/headless-core
