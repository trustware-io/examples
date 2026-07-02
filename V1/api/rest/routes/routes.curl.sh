#!/usr/bin/env bash
#
# Trustware REST API route lifecycle demo
# ============================================
# This example walks the full route lifecycle directly with curl:
#
#   1. GET  /sdk/validate                       -> validate your API key
#   2. GET  /routes/chains                      -> list supported chains
#   3. GET  /routes/tokens                      -> list supported tokens
#   4. POST /routes/quote                       -> quote a route
#   5. POST /routes/route                       -> build a route (signable tx)
#   6. Broadcast the returned transaction with your own wallet/signer.
#   7. POST /route-intent/{intentId}/receipt    -> submit the tx hash
#   8. GET  /route-intent/{intentId}/status     -> poll status
#
# Env vars you'll need:
#   TRUSTWARE_API_KEY            Your Trustware API key
#   TRUSTWARE_FROM_CHAIN         Chain ID funds are sent from (default: Base, 8453)
#   TRUSTWARE_TO_CHAIN           Chain ID funds should land on (default: Base, 8453)
#   TRUSTWARE_FROM_TOKEN         Token address funds are sent from (default: native token)
#   TRUSTWARE_TO_TOKEN           Token address funds should land as (default: USDC on Base)
#   TRUSTWARE_FROM_AMOUNT        Amount to send, in base units
#   TRUSTWARE_FROM_ADDRESS       Source wallet address
#   TRUSTWARE_TO_ADDRESS         Destination wallet address
#
# Run `TRUSTWARE_TX_HASH=0x... TRUSTWARE_INTENT_ID=... ./routes.curl.sh submit-receipt`
# after broadcasting to submit the receipt and poll status.
set -euo pipefail

: "${TRUSTWARE_API_BASE:=https://api.trustware.io/api/v1}"
: "${TRUSTWARE_API_KEY:?Set TRUSTWARE_API_KEY}"
: "${TRUSTWARE_FROM_CHAIN:=8453}"
: "${TRUSTWARE_TO_CHAIN:=8453}"
: "${TRUSTWARE_FROM_TOKEN:=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE}"
: "${TRUSTWARE_TO_TOKEN:=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913}"
: "${TRUSTWARE_FROM_AMOUNT:=1000000000000000}"
: "${TRUSTWARE_FROM_ADDRESS:=}"
: "${TRUSTWARE_TO_ADDRESS:=}"

auth_headers=(
  -H "Content-Type: application/json"
  -H "X-API-Key: ${TRUSTWARE_API_KEY}"
)

if [[ "${1:-}" == "submit-receipt" ]]; then
  : "${TRUSTWARE_INTENT_ID:?Set TRUSTWARE_INTENT_ID}"
  : "${TRUSTWARE_TX_HASH:?Set TRUSTWARE_TX_HASH}"

  echo "Submit receipt"
  curl -sS -X POST "${TRUSTWARE_API_BASE}/route-intent/${TRUSTWARE_INTENT_ID}/receipt" \
    "${auth_headers[@]}" \
    -H "Idempotency-Key: ${TRUSTWARE_TX_HASH}" \
    -d "$(jq -n --arg txHash "${TRUSTWARE_TX_HASH}" '{txHash: $txHash}')"
  echo

  echo "Poll status"
  curl -sS "${TRUSTWARE_API_BASE}/route-intent/${TRUSTWARE_INTENT_ID}/status" "${auth_headers[@]}"
  echo
  exit 0
fi

: "${TRUSTWARE_FROM_ADDRESS:?Set TRUSTWARE_FROM_ADDRESS}"
: "${TRUSTWARE_TO_ADDRESS:?Set TRUSTWARE_TO_ADDRESS}"

echo "Validate API key"
curl -sS "${TRUSTWARE_API_BASE}/sdk/validate" "${auth_headers[@]}"
echo

echo "List supported chains"
curl -sS "${TRUSTWARE_API_BASE}/routes/chains"
echo

echo "List supported tokens for destination chain"
curl -sS "${TRUSTWARE_API_BASE}/routes/tokens?chainId=${TRUSTWARE_TO_CHAIN}"
echo

route_body=$(
  jq -n \
    --arg fromChain "${TRUSTWARE_FROM_CHAIN}" \
    --arg toChain "${TRUSTWARE_TO_CHAIN}" \
    --arg fromToken "${TRUSTWARE_FROM_TOKEN}" \
    --arg toToken "${TRUSTWARE_TO_TOKEN}" \
    --arg fromAmount "${TRUSTWARE_FROM_AMOUNT}" \
    --arg fromAddress "${TRUSTWARE_FROM_ADDRESS}" \
    --arg toAddress "${TRUSTWARE_TO_ADDRESS}" \
    '{
      fromChain: $fromChain,
      toChain: $toChain,
      fromToken: $fromToken,
      toToken: $toToken,
      fromAmount: $fromAmount,
      fromAddress: $fromAddress,
      toAddress: $toAddress,
      slippageBps: 100
    }'
)

echo "Quote route"
curl -sS -X POST "${TRUSTWARE_API_BASE}/routes/quote" \
  "${auth_headers[@]}" \
  -d "${route_body}"
echo

echo "Build route"
route_response=$(
  curl -sS -X POST "${TRUSTWARE_API_BASE}/routes/route" \
    "${auth_headers[@]}" \
    -d "${route_body}"
)
echo "${route_response}"
echo

intent_id=$(printf '%s' "${route_response}" | jq -r '.data.intentId // .intentId // empty')
if [[ -z "${intent_id}" ]]; then
  echo "No intent ID returned. Check the route response above." >&2
  exit 1
fi

cat <<EOF
Broadcast the returned transaction with your wallet or signer.
Then submit the transaction hash:

  TRUSTWARE_TX_HASH=0x... TRUSTWARE_INTENT_ID=${intent_id} ./routes.curl.sh submit-receipt
EOF
