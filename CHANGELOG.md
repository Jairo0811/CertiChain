# Changelog

Todos los cambios relevantes de CertiChain se documentan en este archivo.

## Modernización técnica - 2026-11-05

Auditoría y modernización incremental en `feature/portfolio-modernization`. Detalle completo en `docs/AUDIT-2026-11.md`.

### Seguridad

- Rate limiting con contadores aislados por política (general, login, verificación), barrido y tope de memoria; `X-Forwarded-For` solo se respeta con `TRUST_PROXY`.
- JWT HS256 con `iss`, `aud`, `sub`, claims validados con Zod, `session_expired` y `JWT_TTL_MINUTES`.
- Comparación de credenciales en tiempo constante y error genérico `invalid_credentials`.
- Errores uniformes `{ error, code, requestId }` sin detalles internos; correlation id validado.
- Validación estricta: wallets EIP-55, fechas no futuras, payloads sin campos extra, `/api/documents` solo PDF real.
- CSP estricta en nginx; sin CDNs de terceros.

### Blockchain y consistencia

- Emisión *persist-first* con `chainSyncStatus`, `chainTxHash` y `chainError`; activación tras confirmación.
- `POST /api/certificates/:id/anchor`: reconciliación idempotente por recibo o evento; nunca reenvía una transacción enviada.
- Modos de evidencia `on-chain`, `off-chain` y `demo`. Las credenciales ancladas no se revocan solo off-chain, no se borran y no se reactivan.
- Revocación on-chain primero, con sincronización si ya estaba revocada en el contrato y bloqueo por certificado contra revocaciones concurrentes.
- `scripts/deploy.ts` concede `ISSUER_ROLE` al emisor de la API (`ISSUER_ADDRESS`). Contrato sin cambios.

### Verificación

- `GET /api/verify/:id` sin hash consulta estado sin afirmar integridad documental; con `?hash=` compara un SHA-256 aportado por el verificador.
- Respuesta con `outcome`, `evidenceMode`, `checks.integrity`, `checks.blockchainStatus` y `checks.statusManagedByBlockchain`; `valid` se mantiene por compatibilidad.
- RPC caído o no configurado → `blockchain_unavailable` / `blockchain_not_configured` en lugar de HTTP 500.
- Verificador público con comprobación opcional de PDF local mediante Web Crypto.

### API y persistencia

- `app.ts` separado en `http/`, `routes/` y `services/`; `createApp()` acepta store y registry inyectables y monta las rutas de estado.
- `GET /api/dashboard?range=30|90|365|all`, `GET /api/certificates/:id` con historial, `GET /api/auth/session`, paginación y búsqueda en `GET /api/certificates`.
- Migraciones PostgreSQL versionadas (`schema_migrations`, advisory lock) que adoptan esquemas existentes; índices nuevos; auditoría acotada.
- `documentAvailable` comprueba la existencia real del documento.
- Transiciones off-chain auditadas; reactivar una credencial revocada exige motivo.

### Portal web

- Rediseño con sistema de tokens, tipografías locales e iconos SVG; logo e isotipo originales preservados (derivados optimizados).
- Arquitectura en `pages/`, `components/`, `hooks/`, `services/`, `lib/`, `types/`; cliente HTTP central.
- Dashboard con filtros reales, gráficos SVG y actividad desde auditoría.
- Certificados con paginación en servidor, ordenamiento, menú de acciones, drawer con historial y confirmaciones explícitas.
- Emisión con wallet del titular en modo blockchain, prevención de doble envío y estado de sincronización.
- Sustitución de la intercepción de `window.open` por validación explícita.
- Accesibilidad: etiquetas explícitas, foco gestionado en diálogos, regiones vivas, navegación por teclado, sin scroll horizontal.
- API en el mismo origen (proxy en Vite y nginx).

### Mobile

- El detalle muestra el resultado real de la última verificación, rotulado como caché; ya no reconstruye comprobaciones.
- Verificación por ID sin reenviar el hash del registro; hashes de enlaces legacy rotulados como tales.
- Wallet SecureStore v2 (una entrada por credencial) con migración desde v1.

### Calidad y DevOps

- Pruebas: API 64 (6 con PostgreSQL real), web 33, mobile 17, contratos 9.
- ESLint (typescript-eslint, React hooks) y Prettier en todo el código; `--passWithNoTests` eliminado.
- CI con servicio PostgreSQL 16; `npm audit fix` sin `--force` (0 avisos críticos en producción).
- Build de la API sin archivos de prueba; build web sin emitir JS junto a los fuentes.

## Mobile Final Polish - 2026-09-07

### Branding y UX

- Mobile adopta de forma consistente el logo e isotipo oficiales de CertiChain.
- `App.tsx` queda reducido a entrypoint y la implementación móvil se organiza en `src/` con helpers, tema y componentes reutilizables.
- Header institucional con tagline `Verified. Immutable. Trusted.` y estado de conexión con API.
- Wallet y cards compactas con estados explícitos `Vigente`, `Pendiente` y `Revocada`.
- Detalle de credencial reforzado con ID, SHA-256, última verificación, QR e indicadores de integridad.
- Mejoras razonables de accesibilidad: labels, roles, hit areas, contraste y mensajes de estado legibles.

### QR, wallet y scanner

- Verificación por ID sin solicitar SHA-256 manualmente.
- Recuperación automática del hash desde `/api/verify/:id/evidence`.
- Compatibilidad con QR actual `?id=<credential-id>&autoverify=1`, deep links legacy con `id + hash` e ID directo.
- QR móvil construido desde `EXPO_PUBLIC_VERIFY_URL` sin `localhost` hardcodeado en lógica productiva.
- Scanner bloquea lecturas repetidas y presenta mensajes de QR inválido, credencial no encontrada y API no disponible sin exponer errores técnicos crudos.
- Revalidación actualiza la credencial existente, conserva el mismo ID y evita duplicados en SecureStore.
- Historial ordenado por última verificación y tratado como último estado conocido, no como vigencia permanente.
- Compartir limita el contenido a título, institución y URL pública de verificación.

### Estados, conectividad y configuración

- Helper central de estado con `statusLabel`, `statusColor`, `statusTone` y `statusDescription`.
- Manejo explícito de `pending`, `active` y `revoked`; se elimina cualquier equivalencia implícita tipo `status !== revoked => vigente`.
- Manejo de API no configurada, timeout, error de red, 404 y respuesta inválida.
- `app.json` conserva isotipo para icon/adaptive icon y usa el logo completo oficial en splash.
- Documentación de `EXPO_PUBLIC_API_URL` y `EXPO_PUBLIC_VERIFY_URL` para IP LAN, Android Emulator y producción HTTPS futura.
- Build móvil explícito mediante `expo export --platform android` dentro del gate global de CI.

### Tests

- Tests de QR moderno, QR legacy e ID directo.
- Tests de estados `pending`, `active` y `revoked`.
- Tests de URL/mensaje compartido sin PII del estudiante.
- Tests de deduplicación, transformación `Verification -> WalletCredential` y actualización por revalidación.

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
