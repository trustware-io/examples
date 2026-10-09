# Configure the Spice deposit

Edit [`lib/config.mjs`](lib/config.mjs). Everything in this file is public/browser-visible; keep credentials out of it.

## Preset and units

The reference destination is Spice spcUSDC on Ethereum, vault `0xb37cC5e891d87c5a3eF750e1bdf59C960575593c`, funded with canonical Ethereum USDC. It must support synchronous pull-funded `deposit(uint256 assets,address receiver)`, plus `asset`, `maxDeposit`, `previewDeposit` and `balanceOf` views. The receiver is always the connected wallet, never the executor.

| Configuration | Meaning |
|---|---|
| `transport`, `name`, `description` | Presentation only; `lib/transport.mjs` selects the actual transport. |
| `vault.chainId`, `address`, `asset` | Destination decimal chain ID, deposit contract and underlying ERC-20. |
| `vault.symbol`, `decimals`, `rpc` | Underlying display metadata (USDC: 6 decimals) and matching public HTTPS RPC without secrets. |
| `vault.fundAmount`, `minAssets` | Integer underlying base-unit strings. Preset `50000000` = 50 USDC. `fundAmount` is fixed, not all bridge output. The historical 50-USDC minimum is **not verified as the current minimum**. |
| `vault.estimatedGas` | Destination hook gas budget, integer string; verify for the corridor. |
| `vault.verifiedSynchronousPullDeposit` | Operator attestation; defaults to `false`, blocking routes. |
| `sources[].chainId`, `name`, `rpc` | Source decimal chain ID, label and matching public RPC. |
| `sources[].tokens` | Allowlisted ERC-20 `address`, `symbol`, `decimals`; only positive wallet-held matches appear. |
| `sources[].routers`, `spenders` | Verified source transaction targets and approval spenders. Empty arrays reject execution. These are **not** the destination vault address by default. |

## Enable one corridor

1. Independently verify the current vault implementation, asset/decimals, minimum, connected receiver eligibility and synchronous pull/beneficiary semantics.
2. Confirm Trustware/provider support for that source and destination hook, including gas, extra-output and failed-hook/refund behavior. Obtain verified source router/spender addresses from the provider/integration review—not automatically from an untrusted quote.
3. Populate only that source's `routers` and `spenders`; remove unused sources if desired. Adjust the fixed funding/minimum/gas values to the reviewed configuration.
4. Set `verifiedSynchronousPullDeposit: true` after those checks, then restart. This flag records your review; it does not perform or replace it.
5. Supply server-only `TRUSTWARE_API_KEY` via `.env.local` or the server environment. Connect a wallet with source USDC and native gas. Source amount must cover the fixed budget plus fees/slippage; routes with missing/insufficient guaranteed output are rejected.

The preset source metadata (Ethereum, Optimism, Arbitrum USDC) is not a claim that every corridor is supported. No live route or funded deposit is certified by this example.

## Execution limits

Routes expire after 60 seconds measured from request start. Approval confirmation may consume that window; reconcile the saved approval before rebuilding. Insufficient nonzero allowances are refused rather than automatically reset. Only injected EVM wallets and ERC-20 source assets are supported; gas is not sponsored.

Web Locks and local storage prevent same-origin duplicate sends, not cross-origin/device sends. Receipt/status retry never broadcasts. Do not delete an unresolved recovery record to enable another deposit; reconcile it in the wallet/explorer first. The optional destination check proves a matching vault event at one canonical block observation, not finality. See the [README](README.md) for the code path and receipt evidence rules.
