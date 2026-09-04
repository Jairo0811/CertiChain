# CertiChain — Portfolio Readiness

## Estado

**Versión:** 1.0.0  
**Clasificación:** Proyecto académico UNAPEC finalizado / portfolio-ready  
**Asignatura:** Fundamentos de Seguridad de Software (ISO-915)  
**Período:** Septiembre - Diciembre 2025

CertiChain demuestra una solución integral de credenciales académicas verificables con separación de responsabilidades entre clientes, API, persistencia off-chain y evidencia blockchain. El objetivo del portafolio es evidenciar arquitectura, seguridad, implementación, pruebas y prácticas DevOps; no operar con datos académicos reales ni financiar infraestructura de producción.

## Capacidades demostrables

- portal institucional React + TypeScript;
- aplicación móvil Expo/React Native;
- API Node.js + Express + TypeScript;
- PostgreSQL;
- smart contract `CertificateRegistry.sol` con Solidity, Hardhat y OpenZeppelin;
- emisión, revocación y verificación de credenciales;
- verificador público;
- QR y cámara desde móvil;
- wallet local de credenciales;
- SHA-256;
- cifrado AES-256-GCM;
- adaptador IPFS;
- JWT + RBAC;
- rate limiting y headers defensivos;
- auditoría y logging estructurado;
- métricas Prometheus;
- health/readiness endpoints;
- Docker y Docker Compose;
- CI con formato, lint, type-check, tests y build;
- CodeQL;
- builds reproducibles con `package-lock.json` y `npm ci`;
- scripts de backup/restore de PostgreSQL;
- workflow preparado para despliegue de smart contracts.

## Escenario recomendado de demostración

1. Copiar `.env.example` a `.env` y configurar secretos locales.
2. Ejecutar `docker compose up -d --build`.
3. Confirmar `/health` y `/ready`.
4. Iniciar sesión en el portal institucional.
5. Emitir una credencial de demostración.
6. Consultarla desde el listado institucional.
7. Verificarla públicamente mediante ID + SHA-256.
8. Escanear o importar la credencial desde la aplicación móvil.
9. Revocar la credencial desde el portal.
10. Repetir la verificación y observar el cambio de estado.

El flujo puede demostrarse sin blockchain externa configurada. En ese modo la plataforma utiliza su comportamiento degradado/off-chain de desarrollo. La integración real con Polygon se mantiene como capacidad preparada, no como requisito de presentación académica.

## Decisiones de seguridad destacables

- PII y documentos completos permanecen off-chain.
- La blockchain conserva únicamente evidencia criptográfica y metadata no sensible.
- Los documentos se hashean antes del cifrado.
- Los documentos se cifran con AES-256-GCM antes del almacenamiento.
- Las claves privadas no se almacenan en clientes web/móvil ni en Git.
- Producción aplica validaciones estrictas para impedir configuraciones inseguras.
- La verificación pública minimiza datos personales.
- Se aplican RBAC, rate limiting, headers defensivos y auditoría.

## Evidencia de ingeniería

El repositorio incluye:

- monorepo con npm workspaces;
- separación `apps`, `packages` y `blockchain`;
- CI automatizado;
- CodeQL;
- Dockerfiles de API y web;
- Docker Compose local y de producción;
- scripts operativos;
- documentación de arquitectura, seguridad y production readiness;
- pruebas de API y smart contracts;
- lockfile reproducible.

## Fuera del alcance académico

No se consideran pendientes de esta versión:

- contratar PostgreSQL administrado;
- pagar/provisionar un proveedor IPFS;
- financiar una wallet real de Polygon;
- desplegar a Polygon PoS Mainnet;
- contratar dominio/CDN/WAF;
- contratar observabilidad administrada;
- realizar auditoría comercial independiente del contrato;
- procesar datos o certificados académicos reales.

Estas actividades solo tendrían sentido si CertiChain se convierte posteriormente en un producto o servicio operativo.

## Criterio de cierre

CertiChain v1.0.0 queda **finalizado como proyecto académico de portafolio** porque posee una implementación funcional, reproducible, documentada y verificable de todas las capas que sostienen su propuesta técnica.
