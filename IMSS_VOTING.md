# IMSS Voting Monorepo

This monorepo adds a production-ready voting stack on top of the existing repository.

## Structure

- `apps/web`: Next.js frontend (CAS SSO UI flow), vote UI, thank-you page.
- `apps/api`: Express API for registration, auto-approval hook, admin whitelist sync.
- `packages/contracts`: Solidity contract + Foundry tests.
- `infra/`: Hostinger VPS deploy stack (Docker Compose + Caddy + Postgres).

## Smart Contract

Contract: `packages/contracts/src/Election.sol`

Core functions:
- `setWhitelist(address,bool)`
- `setWhitelistBatch(address[],bool)`
- `voteKetum(uint256)`
- `voteWaketum(uint256)`
- `finalize()`
- `getResults()`

Events:
- `VoterWhitelisted`
- `VoteCast`
- `ElectionFinalized`

Run tests:

```bash
cd packages/contracts
forge test
```

## API Endpoints

- `GET /auth/cas/login`
- `GET /auth/cas/callback`
- `GET /auth/me`
- `POST /auth/logout`
- `POST /registration/nonce` (student auth required)
- `POST /registration/bind-wallet` (student auth required)
- `GET /registration/me` (auth required)
- `POST /registration/approve-auto` (internal key)
- `POST /admin/whitelist/sync` (admin role)
- `GET /admin/registrations` (admin role)

Auth session uses `imss_session` HttpOnly cookie after CAS ticket validation.

## Web Routes

- `/auth/login`
- `/register-wallet`
- `/vote`
- `/results`

## Hostinger VPS Deploy

1. Copy `.env.example` to `.env` and fill real values.
2. Fill blockchain vars in `.env`:
- `RPC_URL` = RPC endpoint dari infra blockchain kamu.
- `ADMIN_SIGNER_KEY` = private key deployer/admin (server-side only).
3. Deploy contract (otomatis update `.env` dengan chain id + contract address):

```bash
./scripts/deploy-election.sh
```

4. Start stack:

```bash
docker compose --env-file .env -f infra/docker-compose.yml up -d --build
```

5. Set DNS `A` record of your domain to Hostinger VPS IP.
6. Caddy handles TLS automatically.

## Notes

- Keep `ADMIN_SIGNER_KEY` in server-side env only.
- For custom EVM chain, set both `CHAIN_ID` and `NEXT_PUBLIC_CHAIN_ID` ke chain id yang sama.
- `ui_subject_id` and wallet are unique, enforcing one-user-one-wallet.
- Voting page requires active CAS SSO session.
