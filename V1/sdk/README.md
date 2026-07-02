# Trustware SDK Examples

Each SDK example is a standalone Next.js package with its own `package.json`, `app` directory, TypeScript config, and `.env.example`.

## Examples

- [Headless](./headless)
- [EOA deposit widget](./widget/eoa_deposit_example)
- [EOA swap widget](./widget/eoa_swap_example)
- [Embedded swap widget](./widget/embedded_swap_example)
- [Embedded deposit + withdraw widget](./widget/embedded_withdraw_example)

## Shared setup

From an example directory:

```bash
cp .env.example .env.local
npm install
npm run dev
```

For local SDK development, replace the package dependency with a local file reference:

```json
"@trustware/sdk": "file:../../../../trustware-sdk"
```

The relative path depends on the example directory depth.
