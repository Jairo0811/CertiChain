# CertiChain — Production Readiness v1.0

CertiChain se considera **finalizado como proyecto académico de portafolio de UNAPEC en versión 1.0.0**. Este documento conserva la arquitectura y los controles necesarios para una eventual conversión a servicio productivo real, pero esas operaciones externas **no forman parte de los criterios pendientes del cierre académico**.

## Estado técnico de v1.0

### Implementado en código

- quality gates: formato, lint, type-check, tests y build;
- `package-lock.json` v3 y uso de `npm ci` en CI y builds Docker;
- pruebas de smart contracts;
- portal web institucional y verificación pública;
- aplicación móvil con wallet local, QR e historial;
- API con autenticación, RBAC, rate limiting, headers defensivos y auditoría;
- PostgreSQL como persistencia de producción, con fallback JSON únicamente para desarrollo/test sin `DATABASE_URL`;
- creación automática de esquema SQL e índices necesarios;
- cifrado de documentos con AES-256-GCM antes de persistirlos;
- almacenamiento local cifrado para desarrollo;
- adaptador IPFS para un despliegue productivo opcional;
- SHA-256 calculado sobre el documento original antes del cifrado;
- healthcheck `/health` y readiness `/ready`;
- métricas Prometheus en `/metrics`, protegibles mediante `METRICS_TOKEN`;
- logging estructurado de solicitudes con request ID;
- Docker para API/web y PostgreSQL local;
- configuración de producción separada y validada;
- scripts de backup y restore de PostgreSQL con checksum;
- workflow manual de despliegue de `CertificateRegistry` a Sepolia, Polygon Amoy o Polygon PoS;
- workflow de releases versionadas;
- CodeQL para JavaScript/TypeScript;
- pruebas de ciclo de vida de certificados: autenticación → emisión → listado → revocación → verificación.

## Cierre académico / portafolio

Para el alcance de portafolio, se consideran cumplidos los siguientes criterios:

- [x] arquitectura completa y documentada;
- [x] implementación funcional de web, API, móvil y smart contract;
- [x] persistencia SQL y almacenamiento cifrado;
- [x] separación on-chain/off-chain de datos sensibles;
- [x] pruebas automatizadas y quality gates;
- [x] análisis CodeQL;
- [x] contenedores reproducibles;
- [x] ejecución local documentada;
- [x] observabilidad y readiness;
- [x] scripts operativos de backup/restore;
- [x] flujo de despliegue blockchain preparado;
- [x] documentación de seguridad y producción;
- [x] versión de portafolio `1.0.0` consolidada.

El proyecto **no necesita almacenar datos académicos reales, pagar infraestructura, desplegar en Polygon PoS ni contratar un proveedor IPFS** para demostrar el cumplimiento de su objetivo académico y técnico.

## Requisitos únicamente para un despliegue productivo real

La API rechaza `NODE_ENV=production` si no se han configurado correctamente:

- `DATABASE_URL`;
- `JWT_SECRET` exclusivo;
- `ADMIN_PASSWORD` exclusivo;
- `CORS_ORIGIN` HTTPS/no-localhost;
- `BLOCKCHAIN_RPC_URL`;
- `CERTIFICATE_REGISTRY_ADDRESS`;
- `BLOCKCHAIN_PRIVATE_KEY`;
- `STORAGE_DRIVER=ipfs`;
- `DOCUMENT_ENCRYPTION_KEY` de 32 bytes representados como 64 caracteres hexadecimales;
- `IPFS_API_URL`;
- `METRICS_TOKEN`.

Esto evita iniciar accidentalmente una instancia real con persistencia temporal, claves bootstrap o almacenamiento inseguro.

## Arquitectura objetivo para producción

- Web estática detrás de CDN/WAF.
- API en contenedores administrados.
- PostgreSQL administrado.
- Documentos cifrados antes de IPFS.
- Secretos en Key Vault/HSM o gestor equivalente.
- RPC blockchain administrado y redundante.
- Métricas Prometheus y logs centralizados.
- Backups periódicos con pruebas de recuperación.

## Datos on-chain

Solo deben publicarse datos necesarios para demostrar autenticidad:

- identificador criptográfico;
- hash del documento;
- emisor;
- estado;
- timestamps;
- referencia de metadata no sensible.

PII, documentos académicos completos y secretos permanecen off-chain.

## Extensión opcional: go-live real

Las siguientes tareas se conservan como **extensiones opcionales** y no como deuda del portafolio:

- [ ] crear secretos de producción en un gestor seguro;
- [ ] provisionar PostgreSQL administrado y ejecutar una prueba real de backup/restore;
- [ ] contratar/configurar proveedor IPFS y probar pinning/retención;
- [ ] provisionar RPC para Polygon y wallet de despliegue con fondos mínimos;
- [ ] ejecutar el workflow de despliegue y registrar la dirección real de `CertificateRegistry`;
- [ ] configurar dominio HTTPS, CDN/WAF y rate limiting perimetral;
- [ ] conectar Prometheus/logging a una plataforma de observabilidad;
- [ ] realizar auditoría independiente del smart contract antes de mainnet;
- [ ] ejecutar pruebas E2E contra staging real (web, API, móvil, IPFS y blockchain);
- [ ] aprobar política de privacidad, retención y procedimiento de incidentes;
- [ ] publicar un GitHub Release/tag si se desea distribuir la aplicación formalmente.

Estas actividades solo son obligatorias si CertiChain evoluciona desde proyecto académico hacia un servicio que procese credenciales reales.

## Entornos previstos

1. `development` — Docker local, PostgreSQL local y almacenamiento cifrado local.
2. `test` — CI y pruebas automatizadas.
3. `staging` — opcional; Polygon Amoy + PostgreSQL/IPFS equivalentes a producción.
4. `production` — opcional; Polygon PoS + servicios administrados.

Nunca reutilizar claves privadas, contraseñas o llaves de cifrado entre entornos.

## Escalamiento posterior a v1.0

- multiinstitución avanzada;
- API pública para empleadores y universidades;
- credenciales verificables W3C;
- interoperabilidad con wallets académicas;
- multiidioma;
- analítica antifraude;
- emisión por lotes;
- integración con sistemas académicos externos.

**Conclusión:** la v1.0 está completa para su propósito académico y de portafolio. La infraestructura externa queda preservada como ruta de evolución futura, no como requisito pendiente de CertiChain.
