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

## Dataset demo opcional de portafolio

Para capturas, demostraciones y revisión visual existe un seed **explícito, idempotente y exclusivo de entornos no productivos**. Inserta 24 credenciales ficticias marcadas como `Demo`, distribuidas en 3 instituciones ficticias:

- 21 vigentes;
- 2 revocadas;
- 1 pendiente.

Después de levantar/reconstruir la API con Docker:

```bash
docker compose exec api node apps/api/dist/demoSeed.js
```

El comando devuelve además un par ID + SHA-256 listo para probar el verificador público. El seed utiliza identificadores deterministas, por lo que puede ejecutarse varias veces sin duplicar esas 24 credenciales. No borra certificados existentes.

La ejecución se bloquea cuando `NODE_ENV=production` para evitar que datos ficticios entren accidentalmente en un entorno operativo.

## Escenario recomendado de demostración

1. Copiar `.env.example` a `.env` y configurar secretos locales.
2. Ejecutar `docker compose up -d --build`.
3. Confirmar `/health` y `/ready`.
4. Opcionalmente ejecutar `docker compose exec api node apps/api/dist/demoSeed.js` para poblar el showcase visual.
5. Iniciar sesión en el portal institucional.
6. Consultar el dashboard y el listado institucional.
7. Verificar públicamente una credencial vigente por ID (o abriendo su QR) y, opcionalmente, comparar el PDF descargado: el verificador calcula su SHA-256 en el navegador.
8. Escanear o importar la credencial desde la aplicación móvil.
9. Revocar una credencial desde el portal.
10. Repetir la verificación y observar el cambio de estado.
11. Opcional: levantar un nodo Hardhat local, desplegar el contrato (`npm run deploy -w @certichain/blockchain -- --network localhost`) y repetir el flujo en modo on-chain, incluida la caída del RPC y la reconciliación (`Sincronizar con blockchain`).

El flujo puede demostrarse sin blockchain externa configurada. En ese modo la plataforma utiliza su comportamiento degradado/off-chain de desarrollo. La integración real con Polygon se mantiene como capacidad preparada, no como requisito de presentación académica.

## Decisiones de seguridad destacables

- PII y documentos completos permanecen off-chain.
- La blockchain conserva únicamente evidencia criptográfica y metadata no sensible.
- Los documentos se hashean antes del cifrado.
- Los documentos se cifran con AES-256-GCM antes del almacenamiento.
- Las claves privadas no se almacenan en clientes web/móvil ni en Git.
- Producción aplica validaciones estrictas para impedir configuraciones inseguras.
- La verificación pública minimiza datos personales.
- La verificación separa registro, integridad documental y ancla blockchain, y nunca afirma autenticidad on-chain sin consultar el contrato.
- La emisión on-chain persiste antes de enviar la transacción y se reconcilia sin duplicados.
- El dataset demo se rotula como tal y nunca se presenta como anclado.
- Se aplican RBAC, rate limiting, headers defensivos y auditoría.
- El dataset de portafolio se bloquea explícitamente en producción.

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
- pruebas de API (incluida PostgreSQL real), portal web, móvil y smart contracts (123 en total);
- ESLint y Prettier en todo el código fuente;
- informe de auditoría técnica (`docs/AUDIT-2026-11.md`);
- lockfile reproducible;
- dataset demo determinista para showcases sin utilizar PII real.

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

## Modernización noviembre 2026

La revisión técnica de noviembre 2026 conservó la arquitectura, la historia académica y las funcionalidades existentes, y corrigió defectos reales de seguridad, consistencia y semántica de verificación. Ver `docs/AUDIT-2026-11.md`.

## Criterio de cierre

CertiChain v1.0.0 queda **finalizado como proyecto académico de portafolio** porque posee una implementación funcional, reproducible, documentada y verificable de todas las capas que sostienen su propuesta técnica.
