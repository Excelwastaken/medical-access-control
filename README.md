# Decentralized Access Control for Medical Data

A blockchain-based access control system for medical data. Authorization
decisions combine organization-scoped role validation with cryptographically
verifiable, patient-signed consent (EIP-712), while clinical records stay
off-chain. Every authorized access emits an immutable on-chain audit event.

## Architecture

The system is organized into four layers:

1. **User interaction layer** — patient, staff, and auditor views (React)
2. **Provider application & gateway layer** — REST API, policy-enforcement
   point (Node.js / Express)
3. **Permissioned blockchain layer** — four Solidity smart contracts on an
   Ethereum-compatible chain (Hardhat)
4. **Off-chain storage layer** — clinical records (PostgreSQL)

```
frontend/     React UI — Admin / Patient / Staff dashboards, MetaMask integration
backend/      Node.js gateway — REST API, blockchain + database clients
blockchain/   Solidity contracts, Hardhat project, tests, deployment scripts
database/     PostgreSQL schema and seed data (Docker Compose)
```

### Smart contracts (`blockchain/contracts/`)

| Contract | Responsibility |
|---|---|
| `OrganizationRegistry.sol` | Consortium membership (admin-managed) |
| `RoleManager.sol` | Organization-scoped staff role assignments |
| `ConsentManager.sol` | EIP-712 patient-signed consent verification |
| `AccessController.sol` | Orchestrates authorization; emits audit events |

## Prerequisites

- Node.js 18+
- Docker (for PostgreSQL)
- A browser wallet (MetaMask) for the interactive patient consent flow

## Setup

### 1. Blockchain

```bash
cd blockchain
npm install
npx hardhat node                 # keep running in its own terminal
```

In a second terminal:

```bash
npx hardhat ignition deploy ignition/modules/MedicalAccessControl.ts --network localhost
npx hardhat run scripts/smoke-test.ts --network localhost   # seeds a hospital + doctor role
```

### 2. Database

```bash
cd database
docker compose up -d
```

### 3. Backend

```bash
cd backend
npm install
npm run dev                      # http://localhost:3000
```

### 4. Frontend

```bash
cd frontend
npm install
npm run dev                      # http://localhost:5173
```

Verify everything is connected:

```bash
curl http://localhost:3000/health
```

## Tests

```bash
cd blockchain
npx hardhat test                 # unit tests covering the contract layer
```

## Evaluation

Runs functional, security, and performance scenarios against the deployed
contracts and gateway:

```bash
cd backend
npx tsx src/evaluation/run-evaluation-repeated.ts
```

Requires the blockchain, database, and backend to be running (see Setup).
Results are written to `evaluation-results-repeated.json`.

## Key design points

- **Patient consent is a signature, not stored state.** The patient signs
  an EIP-712 typed-data message with their own wallet key; the contract
  recovers and verifies the signer on-chain. No party other than the
  patient can produce a valid consent.
- **Authorization and audit are inseparable.** A record is released only
  after an on-chain `AccessGranted` event is emitted; there is no path to
  access a record without leaving an immutable trace.
- **Clinical content stays off-chain.** Only identifiers, role assignments,
  consent-verification state, and audit events are written to the ledger.

## Limitations

This is a prototype evaluated on a single-node development chain with
instantaneous block confirmation; reported latency figures are a functional
lower bound, not a production estimate. Multi-node consensus behavior and
scaling with network size have not been measured. Off-chain database
confidentiality against a fully compromised host, and encryption for
cross-organization sharing, are out of scope.

## License

MIT