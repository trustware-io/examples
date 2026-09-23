# Swap / bridge widget (EOA)

The smallest standalone Next.js integration for **@trustware/sdk 1.1.16** swap mode. Reuses the existing EOA widget example; it is not a demo catalogue or a headless implementation.

## Run

Use Node 24.x. From this directory:

```sh
npm install --ignore-scripts
cp .env.example .env.local
npm test
npm run typecheck
npm run dev
```

Set `NEXT_PUBLIC_TRUSTWARE_API_KEY` to a **browser-safe, origin-restricted** key. Never expose a privileged server key. All `NEXT_PUBLIC_*` configuration is public. Restart Next after changes.

By default the page renders setup guidance without mounting the provider/widget. After reviewing the configuration and funding limits, set `NEXT_PUBLIC_ENABLE_EXECUTION=true` to mount the live SDK widget. This opt-in is not authentication, independent approval, or a guarantee of routing availability. No wallet operation is needed for the automated tests.

No lockfile is committed for this example yet. Validate clean dependency resolution and a production build before publication. Test success does not establish a working funded corridor.

## Same-chain versus cross-chain

Destination defaults to Base (`8453`) USDC at `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`.

- Select Base as the source for a same-chain swap.
- Select another currently supported source chain for a bridge into Base USDC.
- To change the destination, update `NEXT_PUBLIC_TRUSTWARE_TO_CHAIN` and `NEXT_PUBLIC_TRUSTWARE_TO_TOKEN` together. Destination configuration is restricted to Ethereum, Base, Arbitrum, Optimism and Polygon EVM chains. The SDK owns its source selector and actual supported corridors.

A token address is chain-specific; a configured preset is not a current route quote. The widget may refuse a route because of minimums, liquidity or provider support.

## Source walkthrough

1. `app/page.tsx`: client-only loading, avoiding server-side wallet SDK rendering.
2. `app/config.ts`: validates the EVM destination and browser-key/explicit-opt-in prerequisites; sets `features.swapMode` and `features.swapDefaultDestToken`.
3. `app/widget-client.tsx`: mounts `TrustwareProvider` with `autoDetect`, then `TrustwareWidget`.

The SDK owns wallet discovery/connection, quote, review, allowances, approvals, signing and status. ERC-20 sources may show an approval prompt followed by a swap prompt. Do not layer a second approval flow around the widget. This example does not implement a separate receipt tracker or claim smart-account sponsorship support.

## Verify

```sh
npm test
npm run typecheck
npm run build
```

Configuration tests cover missing key, disabled execution, valid swap configuration and invalid chain/token input. They **do not** mount the actual SDK widget, exercise a browser wallet, or verify its transaction lifecycle. Production build, browser checks, native/ERC-20 runtime paths and independent review remain necessary before publication. Funded tests require separate explicit authorization.

SDK contract reference: https://docs.trustware.io/integration/drop-in-widget
