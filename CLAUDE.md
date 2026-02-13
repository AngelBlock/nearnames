# CLAUDE.md

## Project Overview

NEAR Domain Names Auction Marketplace — a decentralized domain name auction platform on the NEAR blockchain. Users can offer domain names for sale via auction, place bids, claim names after winning, and manage seller profiles/rewards.

Three main components:
- **`/contract`** — Main marketplace smart contract (Rust/NEAR SDK)
- **`/lock_unlock_account_contract`** — Secondary contract for locking accounts during auctions (Rust)
- **`/frontend`** — React web UI

## Build Commands

### Smart Contracts

```bash
./contract/build.sh                          # Build marketplace contract (Rust → WASM)
./contract/test.sh                           # Build + run contract tests
./lock_unlock_account_contract/build.sh      # Build lock contract with WASM minification
```

Requires Rust nightly with `wasm32-unknown-unknown` target.

### Frontend

```bash
cd frontend
npm install                                  # Install dependencies
npm run start                                # Dev server (Parcel)
npm run build                                # Production build
npm run build:testnet                        # Testnet build
npm run test                                 # Run Jest tests (--runInBand)
```

### Deployment

```bash
npm run deploy:contract:dev                  # Deploy contract to dev account
npm run deploy:contract                      # Deploy contract to mainnet
npm run deploy:web                           # Deploy frontend to GitHub Pages
npm run deploy:testnet                       # Deploy to testnet
```

### Docker

```bash
./contract/docker_build.sh && ./contract/docker_run.sh
./lock_unlock_account_contract/docker_build.sh && ./lock_unlock_account_contract/docker_run.sh
```

## Testing

- **Contract tests:** `./contract/test.sh` or `cargo test` inside `/contract`
- **Frontend tests:** `npm run test` inside `/frontend` (Jest)
- CI runs via GitHub Actions (`.github/workflows/contract.yml`): cargo build + cargo test

## Toolchain

- **Rust** edition 2021, nightly ~1.56.1, target `wasm32-unknown-unknown`
- **NEAR SDK** `4.0.0-pre.5`
- **Node.js** 14+, **Parcel v2**, **React 17**, **MUI v5**, **@near-wallet-selector** v10
- WASM tools: `wasm-snip`, `wasm-gc`, `wasm-opt` (for lock contract minification)

## Code Conventions

### Contract (Rust)

- Modular file layout: `contract.rs` (main struct), `lot.rs` (domain entity), `profile.rs`, `api_lot.rs`, `api_profile.rs`, `economics.rs`, `fraction.rs`, `utils.rs`
- Type aliases for clarity: `LotId = AccountId`, `ProfileId = AccountId`, `WrappedBalance = U128`, etc.
- Storage prefixes: single-char (`"u"` profiles, `"a"` lots, `"y"` bids, `"b"` profile lots bidding, `"f"` profile lots offering)
- Cross-contract calls via `ext_contract` traits (`ExtLockContract`, `ExtSelfContract`)
- Release profile optimized for WASM size: `opt-level = "z"`, LTO, `panic = "abort"`, `overflow-checks = true`

### Frontend (JavaScript/React)

- **Wallet integration:** `@near-wallet-selector` v10 with modal UI (MyNearWallet, HERE, Meteor, Sender, HOT)
  - `WalletSelectorProvider` wraps the app in `index.js`
  - `useWalletSelector` hook in `App.js` for sign-in/out, viewFunction, callFunction
  - `makeContractProxy()` in `utils.js` creates a contract-like object for child components
  - Legacy `near-api-js` kept only for the Offer flow (requires full access key sign-in)
- React Router v5 with hash-based routing
- Custom hooks (`useConfirm`) and context providers (`ConfirmContextProvider`)
- LocalStorage namespaced with `contractName:v01:` prefix
- Network config in `src/config.js` (supports mainnet, testnet, betanet, local, ci)

## Working Principles

### 1. Plan Mode Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately — don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 3. Self-Improvement Loop
- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 4. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)
- Skip this for simple, obvious fixes — don't over-engineer
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests — then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how
- **Checkpoint rule:** for bugs touching data-collector, signal-agent, or live DB — confirm approach before applying

## Task Management

1. **Plan First:** Write plan to `tasks/todo.md` with checkable items
2. **Verify Plan:** Check in before starting implementation
3. **Track Progress:** Mark items complete as you go
4. **Explain Changes:** High-level summary at each step
5. **Document Results:** Add review section to `tasks/todo.md`
6. **Capture Lessons:** Update `tasks/lessons.md` after corrections

**Lightweight mode:** For small fixes (< 3 files, obvious change), skip steps 1-2 and just fix → verify → explain.

## Core Principles

- **Simplicity First:** Make every change as simple as possible. Impact minimal code.
- **No Laziness:** Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact:** Changes should only touch what's necessary. Avoid introducing bugs.
- **Data Safety:** Never run destructive operations on `prices.sqlite` without explicit confirmation.

## Key Files

| File | Purpose |
|------|---------|
| `contract/Cargo.toml` | Contract dependencies and build profile |
| `contract/src/contract.rs` | Main contract struct and config |
| `contract/src/api_lot.rs` | Lot API methods (offer, bid, claim) |
| `contract/src/economics.rs` | Commission and pricing logic |
| `frontend/package.json` | Frontend deps, scripts, Jest config |
| `frontend/src/config.js` | Network/environment configuration |
| `contract/scripts/lot_offer.js` | CLI utility for programmatic lot offers |
| `HASHES.md` | WASM binary version checksums |
| `contract/backlog.md` | Development backlog |
