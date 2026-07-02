# Trustware Examples

Runnable examples for integrating Trustware through the React/TypeScript SDK or the REST API.

## Resources

- Documentation: https://docs.trustware.io
- SDK package: https://www.npmjs.com/package/@trustware/sdk
- SDK source: https://github.com/trustware-io/trustware-sdk

## Examples

### SDK

- [Headless Next.js example](./V1/sdk/headless) - build routes with the SDK core API without the widget.
- [EOA deposit widget](./V1/sdk/widget/eoa_deposit_example) - injected/browser wallet deposit flow.
- [EOA swap widget](./V1/sdk/widget/eoa_swap_example) - injected/browser wallet swap flow.
- [Embedded swap widget](./V1/sdk/widget/embedded_swap_example) - Privy-style embedded wallet swap flow.
- [Embedded deposit + withdraw widget](./V1/sdk/widget/embedded_withdraw_example) - Privy-style embedded wallet deposit flow (via the widget) plus a headless withdrawal flow.

### REST API

- [REST overview](./V1/api/rest) - language-neutral REST examples for direct backend integrations.
- [Routes API curl examples](./V1/api/rest/routes/routes.curl.sh) - validate a key, list chains/tokens, quote, build a route, submit a receipt, and poll status.
- [Data API curl examples](./V1/api/rest/data/data.curl.sh) - wallet balances, transaction history, and price lookups.
- [HTTP requests](./V1/api/rest/routes/routes.http) - the same route flow in editor-friendly `.http` format.
- [Postman collection](./V1/api/rest/postman/trustware-v1.postman_collection.json) - importable collection for the v1 routes and data APIs.

## API version

The examples use the canonical v1 paths under:

```text
https://api.trustware.io/api/v1
```

The backend also serves legacy aliases under `/api` and deprecated Squid shims under `/api/squid`, but new integrations should use `/api/v1`.

## Getting an API Key

Create an SDK/API key from the Trustware dashboard, then copy the relevant `.env.example` file in the example you want to run:

```bash
cp .env.example .env.local
```

Never commit real API keys.
