# Widget Examples

The widget examples are Next.js apps grouped by wallet ownership model.

## EOA Wallets

- [EOA deposit](./eoa_deposit_example) uses the Trustware widget with browser/injected wallet detection.
- [EOA swap](./eoa_swap_example) enables swap mode for injected wallets.

## Embedded Wallets

- [Embedded swap](./embedded_swap_example) shows a Privy-style embedded wallet passed into Trustware as the host wallet, with swap mode enabled.
- [Embedded deposit + withdraw](./embedded_withdraw_example) uses the same embedded wallet bridge for deposits (via the widget), plus a headless withdrawal route using the embedded wallet as the source.
