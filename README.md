# Medical Access Control

![CI](https://github.com/Excelwastaken/medical-access-control/actions/workflows/ci.yml/badge.svg)

Prototype for the master's dissertation *Development of Decentralized Access
Control Methods for Medical Data on Blockchain* (Astana IT University).

Patient consent is an EIP-712 typed signature verified on-chain at authorization
time, together with organization-scoped role checks and immutable audit events.
Medical data stays off-chain.

## Structure

| Folder | Content |
|---|---|
| `blockchain/` | Hardhat project: `OrganizationRegistry`, `RoleManager`, `ConsentManager`, `AccessController`, tests |
| `backend/` | Node.js/Express gateway, evaluation harness (`src/evaluation/`) |
| `database/` | PostgreSQL via Docker (`docker-compose.yml`, init scripts) |
| `frontend/` | React/Vite client with MetaMask |

## Requirements

Node.js 22, npm, Docker, MetaMask (for the client).

## Run tests

```bash
cd blockchain
npm ci
npx hardhat test
```

## Run the frontend

```bash
cd frontend
npm ci
npm run dev
```

## Database

```bash
cd database
docker compose up -d
```

PostgreSQL is exposed on port 5433 (5432 may be occupied locally).

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`) runs on every push and pull request:
contract compile and tests, backend install, frontend lint and build.

## License

MIT

## Assignment 5: research analysis pipeline

The Python component in `analysis/` independently summarizes the repeated evaluation results.
See [analysis instructions](analysis/README.md) for local and Docker runs, and
[Jenkins setup](analysis/jenkins/README.md) for the versioned root `Jenkinsfile`.
The pipeline runs unit tests, builds a Docker image, and archives analysis reports.
It processes recorded measurements; it does not execute new blockchain experiments.
