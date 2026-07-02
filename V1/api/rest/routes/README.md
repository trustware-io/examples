# Routes REST Examples

Use these examples for backend-controlled route creation and status tracking.

```bash
export TRUSTWARE_API_KEY="tw_live_or_test_key"
export TRUSTWARE_FROM_ADDRESS="0xYourSourceWallet"
export TRUSTWARE_TO_ADDRESS="0xYourDestinationWallet"
./routes.curl.sh
```

The route response contains an `intentId` and a route transaction payload. Broadcast that transaction with your wallet/signer, then call the receipt endpoint with the source-chain transaction hash.
