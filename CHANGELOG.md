# Changelog

Todos los cambios relevantes de CertiChain se documentan en este archivo.

## [1.0.0] - 2026-09-04

### Estado

- CertiChain queda finalizado como proyecto académico de portafolio de UNAPEC.
- Las fases 0–8 permanecen implementadas.
- La infraestructura cloud/mainnet real se clasifica como extensión opcional y no como requisito pendiente del alcance académico.

### Plataforma

- Portal institucional React + TypeScript.
- Aplicación móvil Expo/React Native.
- API Node.js + Express + TypeScript.
- PostgreSQL con fallback de desarrollo/test.
- Smart contract `CertificateRegistry.sol` con Solidity, Hardhat y OpenZeppelin.
- Verificación pública, emisión, revocación, QR y wallet local.

### Seguridad

- JWT y RBAC.
- Rate limiting y headers defensivos.
- SHA-256.
- Cifrado AES-256-GCM.
- Separación on-chain/off-chain de PII.
- CodeQL.
- Logging estructurado, auditoría y métricas.

### DevOps

- Docker y Docker Compose.
- CI con formato, lint, type-check, tests y build.
- `package-lock.json` v3 para instalaciones reproducibles.
- `npm ci` en CI y builds Docker.
- Workflows de imágenes, seguridad, despliegue de contrato y release.
- Scripts de backup/restore PostgreSQL.

### Documentación

- README actualizado para reflejar estado portfolio-ready.
- Production readiness reclasificado como ruta opcional de evolución.
- Nueva guía `docs/portfolio-readiness.md` para presentación y demostración.
