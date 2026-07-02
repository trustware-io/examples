# Embedded Wallet Deposit + Withdraw Example

Next.js demo for funding and withdrawing from an app-owned Privy embedded wallet.

The important boundary:

- Deposit: Privy embedded wallet address is only the Trustware destination address. The payer/source wallet is an EOA connected inside the Trustware widget.
- Withdraw: the headless SDK route flow uses the Privy embedded wallet as the source wallet, then routes to a user-provided destination wallet.

```bash
cp .env.example .env.local
npm install
npm run dev
```

The deposit side sets the embedded wallet destination in two ways:

1. `routes.toAddress` in the Trustware config.
2. `Trustware.setDestinationAddress(embeddedAddress)` after `TrustwareProvider` is ready.

The withdraw side demonstrates:

- `Trustware.useChains()` for chain discovery
- `Trustware.getBalances(chainId, embeddedAddress, { forceRefresh })` for showing only funded
  source tokens, forcing a fresh on-chain scan after a deposit instead of reusing the SDK's cache
- `Trustware.buildRoute(...)` from the embedded wallet address
- optional `Trustware.sendRouteTransaction(...)` and `Trustware.submitReceipt(...)`

Amounts are entered in human-readable units (e.g. `1.5`), then converted to base units before
being sent to the SDK. "Use max" fills in the full spendable balance, minus a small reserve for
gas when the selected asset is the chain's native token.
