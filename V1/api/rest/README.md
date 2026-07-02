# Trustware REST API Examples

These examples use the canonical v1 API:

```text
https://api.trustware.io/api/v1
```

All protected endpoints require:

```text
X-API-Key: <your Trustware API key>
Content-Type: application/json
```

## Examples

- [routes/routes.curl.sh](./routes/routes.curl.sh) - complete route lifecycle.
- [routes/routes.http](./routes/routes.http) - editor-friendly HTTP requests.
- [data/data.curl.sh](./data/data.curl.sh) - balances, transaction history, and token prices.
- [postman/trustware-v1.postman_collection.json](./postman/trustware-v1.postman_collection.json) - importable Postman collection.

## Route Lifecycle

1. Validate your SDK/API key with `GET /sdk/validate`.
2. Discover supported chains with `GET /routes/chains`.
3. Discover supported tokens with `GET /routes/tokens`.
4. Quote a route with `POST /routes/quote`.
5. Build a route with `POST /routes/route`.
6. Broadcast the returned transaction using your wallet or backend signer.
7. Submit the source transaction hash with `POST /route-intent/{intentId}/receipt`.
8. Poll `GET /route-intent/{intentId}/status`.

## Environment

The curl examples use these variables:

```bash
export TRUSTWARE_API_BASE="https://api.trustware.io/api/v1"
export TRUSTWARE_API_KEY="tw_live_or_test_key"
export TRUSTWARE_FROM_CHAIN="8453"
export TRUSTWARE_TO_CHAIN="8453"
export TRUSTWARE_FROM_TOKEN="0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
export TRUSTWARE_TO_TOKEN="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
export TRUSTWARE_FROM_AMOUNT="1000000000000000"
export TRUSTWARE_FROM_ADDRESS="0x0000000000000000000000000000000000000000"
export TRUSTWARE_TO_ADDRESS="0x0000000000000000000000000000000000000000"
```

Replace placeholder addresses before sending live requests.

The shell examples use `jq` to build and read JSON.
