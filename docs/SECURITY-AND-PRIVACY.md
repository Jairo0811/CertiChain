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

## API hardening

The API implements:

- Helmet security headers;
- disabled `x-powered-by`;
- restrictive CORS configuration;
- JSON body size limits;
- request IDs;
- `no-store` cache policy for API responses;
- generic server error responses;
- rate limits for general API traffic, login attempts and public verification;
- Zod validation for identifiers, hashes and payloads;
- RBAC for certificate issuance, revocation and audit access.

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

## Mobile application

The mobile client must not embed blockchain private keys. Authentication tokens and future wallet secrets must use platform secure storage. Verification is performed through the public API and does not require MetaMask.

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
- incident response and key-rotation runbooks.
