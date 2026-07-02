#!/usr/bin/env bash
#
# Trustware REST API data demo
# ============================================
# This example calls the read-only data endpoints directly with curl:
#
#   1. GET /data/balances/{address}              -> balances across all chains
#   2. GET /data/wallets/{chain}/{address}/balances -> balances on one chain
#   3. GET /data/transactions/{address}           -> transaction history
#   4. GET /data/transactions/{address}/links     -> transaction history w/ links
#   5. GET /price/native                          -> native token USD price
#   6. GET /price/token                           -> ERC20/SPL token USD price
#
# Env vars you'll need:
#   TRUSTWARE_API_KEY          Your Trustware API key
#   TRUSTWARE_WALLET_ADDRESS   Wallet address to look up
#   TRUSTWARE_CHAIN            Chain ID (default: Base, 8453)
#   TRUSTWARE_TOKEN_ADDRESS    Token address for price lookups (default: USDC on Base)
set -euo pipefail

: "${TRUSTWARE_API_BASE:=https://api.trustware.io/api/v1}"
: "${TRUSTWARE_API_KEY:?Set TRUSTWARE_API_KEY}"
: "${TRUSTWARE_WALLET_ADDRESS:?Set TRUSTWARE_WALLET_ADDRESS}"
: "${TRUSTWARE_CHAIN:=8453}"
: "${TRUSTWARE_TOKEN_ADDRESS:=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913}"

auth_headers=(
  -H "Content-Type: application/json"
  -H "X-API-Key: ${TRUSTWARE_API_KEY}"
)

echo "Balances by address across supported chains"
curl -sS "${TRUSTWARE_API_BASE}/data/balances/${TRUSTWARE_WALLET_ADDRESS}" "${auth_headers[@]}"
echo

echo "Wallet balances on one chain"
curl -sS "${TRUSTWARE_API_BASE}/data/wallets/${TRUSTWARE_CHAIN}/${TRUSTWARE_WALLET_ADDRESS}/balances" "${auth_headers[@]}"
echo

echo "Transactions by source address"
curl -sS "${TRUSTWARE_API_BASE}/data/transactions/${TRUSTWARE_WALLET_ADDRESS}" "${auth_headers[@]}"
echo

echo "Transactions with link metadata"
curl -sS "${TRUSTWARE_API_BASE}/data/transactions/${TRUSTWARE_WALLET_ADDRESS}/links" "${auth_headers[@]}"
echo

echo "Native token USD price"
curl -sS "${TRUSTWARE_API_BASE}/price/native?chainId=${TRUSTWARE_CHAIN}" "${auth_headers[@]}"
echo

echo "ERC20/SPL token USD price"
curl -sS "${TRUSTWARE_API_BASE}/price/token?chainId=${TRUSTWARE_CHAIN}&address=${TRUSTWARE_TOKEN_ADDRESS}" "${auth_headers[@]}"
echo
