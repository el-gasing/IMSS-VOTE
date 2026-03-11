#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${1:-$ROOT_DIR/.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Env file not found: $ENV_FILE" >&2
  exit 1
fi

if ! command -v forge >/dev/null 2>&1; then
  echo "forge is required. Install Foundry first: https://book.getfoundry.sh/getting-started/installation" >&2
  exit 1
fi

if ! command -v cast >/dev/null 2>&1; then
  echo "cast is required (part of Foundry)." >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required." >&2
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

if [[ -z "${RPC_URL:-}" || -z "${ADMIN_SIGNER_KEY:-}" ]]; then
  echo "RPC_URL and ADMIN_SIGNER_KEY must be set in $ENV_FILE" >&2
  exit 1
fi

DEPLOY_RPC_URL="${DEPLOY_RPC_URL:-$RPC_URL}"
if [[ "$DEPLOY_RPC_URL" == "http://anvil:8545" || "$DEPLOY_RPC_URL" == "https://anvil:8545" ]]; then
  DEPLOY_RPC_URL="http://127.0.0.1:8545"
fi

CHAIN_ID="$(cast chain-id --rpc-url "$DEPLOY_RPC_URL")"
echo "Deploying Election contract to chain id $CHAIN_ID..."

cd "$ROOT_DIR/packages/contracts"
forge script script/DeployElection.s.sol:DeployElectionScript \
  --rpc-url "$DEPLOY_RPC_URL" \
  --broadcast \
  --skip-simulation

RUN_JSON="$ROOT_DIR/packages/contracts/broadcast/DeployElection.s.sol/$CHAIN_ID/run-latest.json"
if [[ ! -f "$RUN_JSON" ]]; then
  echo "Cannot find broadcast output at: $RUN_JSON" >&2
  exit 1
fi

CONTRACT_ADDRESS="$(jq -r '.transactions[] | select(.transactionType=="CREATE") | .contractAddress' "$RUN_JSON" | tail -n1)"
if [[ -z "$CONTRACT_ADDRESS" || "$CONTRACT_ADDRESS" == "null" ]]; then
  echo "Cannot parse contract address from broadcast json." >&2
  exit 1
fi

echo "Contract deployed at $CONTRACT_ADDRESS"

sed -i '' -E "s|^CHAIN_ID=.*$|CHAIN_ID=$CHAIN_ID|" "$ENV_FILE"
sed -i '' -E "s|^NEXT_PUBLIC_CHAIN_ID=.*$|NEXT_PUBLIC_CHAIN_ID=$CHAIN_ID|" "$ENV_FILE"
sed -i '' -E "s|^ELECTION_CONTRACT_ADDRESS=.*$|ELECTION_CONTRACT_ADDRESS=$CONTRACT_ADDRESS|" "$ENV_FILE"
sed -i '' -E "s|^NEXT_PUBLIC_ELECTION_CONTRACT_ADDRESS=.*$|NEXT_PUBLIC_ELECTION_CONTRACT_ADDRESS=$CONTRACT_ADDRESS|" "$ENV_FILE"

echo "Updated $ENV_FILE:"
echo "  CHAIN_ID=$CHAIN_ID"
echo "  NEXT_PUBLIC_CHAIN_ID=$CHAIN_ID"
echo "  ELECTION_CONTRACT_ADDRESS=$CONTRACT_ADDRESS"
echo "  NEXT_PUBLIC_ELECTION_CONTRACT_ADDRESS=$CONTRACT_ADDRESS"
echo
echo "Rebuild service after deploy:"
echo "  docker compose --env-file .env -f infra/docker-compose.yml up -d --build api web reverse-proxy"
