# CertiChain — Arquitectura

## Objetivo

CertiChain se diseña como un monorepo modular que separa la experiencia de usuario, la lógica de aplicación, la infraestructura off-chain y la capa blockchain.

## Componentes

```text
┌──────────────────────┐      ┌──────────────────────┐
│ React Native / Expo  │      │ React / Vite Web     │
│ App del estudiante   │      │ Portal institucional │
└──────────┬───────────┘      └──────────┬───────────┘
           │                              │
           └──────────────┬───────────────┘
                          ▼
                 ┌─────────────────┐
                 │ Node.js API     │
                 │ TypeScript      │
                 └───────┬─────────┘
                         │
          ┌──────────────┼──────────────────┐
          ▼              ▼                  ▼
   ┌────────────┐  ┌─────────────┐   ┌──────────────┐
   │ Database   │  │ IPFS/Storage│   │ Blockchain   │
   │ off-chain  │  │ documentos  │   │ Solidity     │
   └────────────┘  └─────────────┘   └──────────────┘
```

## Límites de responsabilidad

### `apps/mobile`

Aplicación del estudiante y flujo móvil de verificación. Consume la API y, cuando corresponda, consultas blockchain de solo lectura mediante una abstracción dedicada.

### `apps/web`

Portal institucional y verificador público. Incluye emisión, revocación, administración institucional y consulta pública de credenciales.

### `apps/api`

Backend de aplicación. Orquesta autenticación, autorización, persistencia off-chain, almacenamiento documental, preparación de hashes, auditoría y comunicación controlada con blockchain.

### `blockchain`

Smart contracts, scripts de despliegue y pruebas. La blockchain actúa como ancla de confianza e integridad, no como base de datos de información personal.

### `packages/shared`

Utilidades puras y reutilizables sin dependencias de infraestructura.

### `packages/types`

Contratos TypeScript compartidos entre API, web y móvil.

### `packages/config`

Configuraciones reutilizables de TypeScript, linting y tooling.

## On-chain vs. off-chain

### On-chain

Solo información necesaria para la prueba criptográfica y el estado de la credencial:

- identificador del certificado;
- hash criptográfico del documento/credencial;
- identificador de la institución emisora;
- referencia del sujeto mediante un identificador no sensible o wallet cuando aplique;
- fecha/timestamp de emisión;
- estado de revocación;
- referencia content-addressed cuando su publicación sea segura.

### Off-chain

- nombres completos;
- correos y datos de contacto;
- información académica ampliada;
- documentos originales;
- permisos y usuarios administrativos;
- auditoría detallada;
- configuraciones internas.

## Flujo de emisión

1. Una institución autenticada solicita emitir una credencial.
2. La API valida permisos y datos.
3. Se genera una representación canónica del certificado.
4. Se calcula SHA-256.
5. El documento se almacena off-chain/IPFS según la política de privacidad.
6. La API envía la transacción al smart contract mediante una identidad emisora autorizada.
7. Se persiste el `transactionHash`, `certificateId` y estado de sincronización.
8. Se genera QR con un identificador verificable, nunca con secretos.

### Implementación actual (noviembre 2026)

1. La API valida el payload (wallet EIP-55 obligatoria si blockchain está configurada).
2. Genera el PDF, calcula SHA-256 y guarda el documento cifrado (AES-256-GCM).
3. **Persiste** la credencial como `pending` con `chainSyncStatus = submitting` antes de cualquier transacción.
4. Envía la transacción y guarda `chainTxHash` en cuanto el RPC la acepta (`submitted`).
5. Al confirmarse el evento `CertificateIssued`, guarda `blockchainId` y activa la credencial (`anchored`).
6. Si algo falla, el registro queda recuperable: `failed` (sin tx, reintento seguro) o `submitted` (solo se consulta el recibo). `POST /api/certificates/:id/anchor` reconcilia sin duplicar.

```text
not_requested (off-chain)
submitting ──▶ submitted ──▶ anchored
     │             │
     ▼             ▼ (revertida o descartada tras 10 min)
   failed ◀────────┘          ── reintento seguro ──▶ submitting
```

### Modos de evidencia

| Modo | Identificador | Estado gobernado por | Operaciones manuales |
|---|---|---|---|
| `on-chain` | `blockchainId` bytes32 del contrato | Contrato | Solo revocación on-chain (permanente) |
| `off-chain` | UUID | Registro CertiChain | Transiciones auditadas; reactivar exige motivo |
| `demo` | `DEMO-0001`… | Registro CertiChain | Igual que off-chain; nunca se ancla |

## Flujo de verificación

1. El verificador escanea el QR o introduce el ID.
2. El sistema obtiene la credencial pública.
3. Consulta el registro del smart contract.
4. Recalcula/compara hash cuando existe documento verificable.
5. Comprueba emisor autorizado, existencia y estado de revocación.
6. Devuelve un resultado explícito: `VALID`, `REVOKED`, `NOT_FOUND` o `INTEGRITY_MISMATCH`.

### Implementación actual (noviembre 2026)

`GET /api/verify/:id[?hash=0x…]` devuelve `outcome` ∈ `valid`, `pending`, `revoked`, `not_found`, `integrity_mismatch`, `blockchain_mismatch`, `blockchain_not_configured`, `blockchain_unavailable`, más comprobaciones separadas:

- `integrity`: `match` / `mismatch` cuando el verificador aporta un SHA-256 (calculado en su navegador a partir del PDF que posee); `not_evaluated` en consultas por ID. El servidor nunca recibe el documento.
- `blockchainStatus`: `verified`, `hash_mismatch`, `revoked_on_chain`, `not_found_on_chain`, `not_configured`, `unavailable`, `not_anchored`, `demo`.

Reenviar al servidor el hash obtenido de `/verify/:id/evidence` no demuestra nada sobre un archivo y los clientes ya no lo hacen; ese endpoint se mantiene como referencia y por compatibilidad.

## Principios arquitectónicos

- Modularidad por dominio.
- Dependencias orientadas hacia abstracciones.
- API y blockchain desacopladas mediante servicios/adaptadores.
- Ninguna clave privada dentro de clientes móviles o web.
- Operaciones blockchain idempotentes o reconciliables siempre que sea posible.
- Trazabilidad mediante correlation IDs y auditoría.
- Validación de datos en cada boundary.
- Configuración mediante entorno, sin secretos versionados.

## Estructura de módulos (noviembre 2026)

```text
apps/api/src
├── app.ts                 composición (createApp con store/registry inyectables)
├── http/                  auth (JWT, RBAC), errores uniformes, esquemas Zod
├── routes/                certificados, verificación pública
├── services/              emisión/anclaje/revocación, verificación, dashboard
├── certificateEvidence.ts modos de evidencia y transiciones off-chain
├── migrations.ts          migraciones PostgreSQL versionadas
└── store.ts / storage.ts / blockchain.ts   adaptadores de infraestructura

apps/web/src
├── pages/                 Login, Dashboard, Certificates, Issue, PublicVerify
├── components/            layout, ui, dashboard, certificates, verify
├── hooks/                 useAsync, useRoute, useCertificateActions
├── services/ lib/ types/  cliente HTTP, formato, Web Crypto, contratos compartidos
└── styles/                tokens y hojas por capa
```

## Evolución prevista

La primera implementación priorizará Sepolia para desarrollo. Polygon podrá incorporarse como red objetivo cuando los contratos, costos y modelo operacional estén validados. La selección de almacenamiento persistente y proveedor IPFS se mantendrá desacoplada mediante interfaces de infraestructura.
