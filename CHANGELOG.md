# Changelog

Todos los cambios relevantes de CertiChain se documentan en este archivo.

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
