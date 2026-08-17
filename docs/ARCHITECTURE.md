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

## Flujo de verificación

1. El verificador escanea el QR o introduce el ID.
2. El sistema obtiene la credencial pública.
3. Consulta el registro del smart contract.
4. Recalcula/compara hash cuando existe documento verificable.
5. Comprueba emisor autorizado, existencia y estado de revocación.
6. Devuelve un resultado explícito: `VALID`, `REVOKED`, `NOT_FOUND` o `INTEGRITY_MISMATCH`.

## Principios arquitectónicos

- Modularidad por dominio.
- Dependencias orientadas hacia abstracciones.
- API y blockchain desacopladas mediante servicios/adaptadores.
- Ninguna clave privada dentro de clientes móviles o web.
- Operaciones blockchain idempotentes o reconciliables siempre que sea posible.
- Trazabilidad mediante correlation IDs y auditoría.
- Validación de datos en cada boundary.
- Configuración mediante entorno, sin secretos versionados.

## Evolución prevista

La primera implementación priorizará Sepolia para desarrollo. Polygon podrá incorporarse como red objetivo cuando los contratos, costos y modelo operacional estén validados. La selección de almacenamiento persistente y proveedor IPFS se mantendrá desacoplada mediante interfaces de infraestructura.
