# CertiChain — Security, Privacy and Storage Baseline

## Scope

This document defines the security baseline for Phase 6. CertiChain treats blockchain as an integrity and audit layer, not as a database for personal or academic records.

## Data classification

### On-chain

Only data required to prove integrity and lifecycle state should be persisted on-chain:

- certificate identifier;
- document hash;
- issuer address;
- student wallet address when required by the contract;
- issuance timestamp;
- revocation state;
- metadata reference.

### Off-chain

The following data must remain outside public blockchains:

- student full name;
- email, phone, national identifiers and contact data;
- certificate PDF or source document;
- institutional internal metadata;
- authentication credentials;
- audit context that could identify a natural person.

## Public verification privacy

The public verifier returns only the minimum information required to establish trust. Student names are masked by default. Administrative endpoints remain protected with JWT and RBAC.

Since November 2026:

- An identifier lookup reports registry and blockchain status with `integrity: "not_evaluated"`; it never claims anything about a document.
- A verifier who holds the PDF can select it in the public verifier. The SHA-256 is computed in the browser with the Web Crypto API and only the hash is sent; the document never leaves the device.
- On-chain authenticity is asserted only when the contract was consulted successfully. RPC failures produce `blockchain_unavailable`; servers without blockchain configuration produce `blockchain_not_configured`.
- Demo (portfolio) credentials are labelled `demo` and never presented as anchored.

## API hardening

The API implements:

- Helmet security headers;
- disabled `x-powered-by`;
- restrictive CORS configuration;
- JSON body size limits;
- request IDs;
- `no-store` cache policy for API responses;
- generic server error responses with a stable `code` and the request id only;
- rate limits for general API traffic, login attempts and public verification, each with an isolated counter store, bounded memory and `Retry-After`;
- client addresses taken from `req.ip`; `X-Forwarded-For` is honoured only when `TRUST_PROXY` declares the proxy (Compose: `uniquelocal`, behind nginx);
- Zod validation for identifiers, hashes, EIP-55 wallets, dates and strict payloads (no unknown fields);
- uploaded documents accepted only as `application/pdf` with a `%PDF-` signature;
- JWT pinned to HS256 with issuer, audience and subject checks, Zod-validated claims and a configurable lifetime (`JWT_TTL_MINUTES`);
- constant-time bootstrap credential comparison and a single generic login error;
- RBAC per operation (issuers issue/revoke/anchor; only administrators delete test data, change off-chain status or read the audit log).

Known limitations: rate limits and per-certificate mutation locks are in-process (single instance). Horizontally scaled deployments need a shared store (e.g. Redis) and database-level locking. The bootstrap administrator is configured through environment variables; a user directory with hashed passwords is the next step.

## Key management

Private keys must never be stored in Git, browser storage, mobile source code or public CI logs. Production deployments should use a secret manager or HSM-backed signing service. The current environment-variable signer is development-only.

## Document storage

Production documents should be encrypted before upload. IPFS may store encrypted objects or metadata references, but unencrypted academic documents must not be placed on a public content-addressed network.

Recommended production flow:

1. Compute SHA-256 locally or in a trusted service.
2. Encrypt the document using an authenticated cipher such as AES-256-GCM.
3. Store the encrypted object in approved object storage or IPFS.
4. Store only the encrypted-object reference off-chain.
5. Anchor the document hash and lifecycle information on-chain.
6. Keep encryption keys in a managed key vault, separate from stored documents.

## Web application

- Session tokens live in `sessionStorage` (per tab) with an explicit expiry; the UI ends the session when it expires or when the API answers `session_expired`.
- nginx serves a strict Content-Security-Policy: scripts, styles, fonts and API calls are same-origin only; `frame-ancestors 'none'`.
- Demo credentials are shown on the login screen only in development builds or when `VITE_DEMO_MODE=true`.

## Mobile application

The mobile client must not embed blockchain private keys. Authentication tokens and future wallet secrets must use platform secure storage. Verification is performed through the public API and does not require MetaMask.

The local wallet stores one SecureStore entry per credential plus an index, keeping every value below the ~2 KB per-value limit documented by Expo. Each credential keeps the real result of its last verification, shown as cached data; it is never re-labelled as a fresh check.

## Operational controls still required before production

- managed SQL database and encrypted backups;
- production identity provider and refresh-token rotation;
- managed secrets / key vault;
- WAF or reverse-proxy rate limiting;
- centralized immutable audit logging;
- dependency and container vulnerability scanning;
- SAST/DAST;
- TLS enforcement and certificate management;
- retention/deletion policy for personal data;
- incident response and key-rotation runbooks;
- retention policy for public verification audit events (each lookup is recorded);
- dependency upgrades that require majors (zod 4, Expo CLI chain) — see `docs/AUDIT-2026-11.md`.
