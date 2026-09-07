<p align="center">
  <img src="docs/images/certichain-logo.jpeg" alt="Logo de CertiChain" width="720" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/UNAPEC-ISO--915-003B70?style=for-the-badge" alt="UNAPEC ISO-915">
  <img src="https://img.shields.io/badge/Versi%C3%B3n-1.0.0-22C55E?style=for-the-badge" alt="Versión 1.0.0">
  <img src="https://img.shields.io/badge/Estado-Portfolio%20Ready-2563EB?style=for-the-badge" alt="Estado: Portfolio Ready">
  <img src="https://img.shields.io/badge/Blockchain-Ethereum%20%2F%20Polygon-7C3AED?style=for-the-badge&logo=ethereum&logoColor=white" alt="Ethereum / Polygon">
</p>

<p align="center"><strong>Sistema de Certificados Académicos Verificables con Evidencia Criptográfica y Blockchain</strong></p>

<p align="center">Verified. Immutable. Trusted.</p>

---

## 📌 Descripción

**CertiChain** es una plataforma académica para emitir, proteger, administrar, descargar, compartir y verificar credenciales mediante evidencia criptográfica, almacenamiento cifrado y una capa blockchain opcional.

Nació como proyecto final de **Fundamentos de Seguridad de Software (ISO-915)** en la Universidad APEC y evolucionó hacia un monorepo profesional con:

- portal institucional web;
- verificador público;
- aplicación móvil Expo / React Native;
- API Node.js + Express + TypeScript;
- PostgreSQL;
- almacenamiento cifrado AES-256-GCM;
- smart contracts Solidity;
- Docker / Docker Compose;
- CI, CodeQL, observabilidad y automatización de despliegue.

La arquitectura sigue un enfoque **off-chain first**: los documentos completos y la información personal permanecen fuera de una blockchain pública; la cadena conserva únicamente evidencia mínima de autenticidad, integridad, emisor y estado cuando la integración blockchain está configurada.

---

## ✅ Estado actual

CertiChain **v1.0.0** está cerrado como proyecto académico de portafolio. El **Mobile Final Polish** queda completado y no se abren nuevas fases salvo bug real o requisito académico nuevo; la infraestructura cloud/mainnet continúa siendo opcional.

### Estado por área

| Área | Estado |
|---|:---:|
| Smart contracts | ✅ |
| Backend / REST API | ✅ |
| Portal institucional | ✅ Hardened |
| Verificador público | ✅ |
| Certificate PDF v3.1 | ✅ |
| Gestión de estados off-chain | ✅ |
| Descarga / eliminación controlada | ✅ |
| Aplicación móvil | ✅ Mobile Final Polish completado |
| QR / cámara / wallet local | ✅ |
| PostgreSQL | ✅ |
| Cifrado AES-256-GCM | ✅ |
| Adaptador IPFS | ✅ |
| Docker / Docker Compose | ✅ |
| `package-lock.json` / `npm ci` | ✅ |
| CI / CodeQL | ✅ |
| Métricas / readiness / logging | ✅ |
| Backup / restore | ✅ |
| Deploy automatizado del contrato | ✅ Preparado |
| Infraestructura cloud/mainnet real | ➕ Opcional |
| Auditoría independiente del smart contract | ➕ Solo antes de mainnet real |

> `main` no contiene claves privadas, tokens de infraestructura ni credenciales de producción. Los servicios cloud/mainnet reales son extensiones opcionales y no requisitos pendientes del cierre académico.

---

## 🆕 Hardening final Web / API / PDF — septiembre 2026

La última ronda de trabajo dejó consolidado el flujo principal de CertiChain antes del cierre móvil.

### Portal institucional

- branding oficial de CertiChain en login, sidebar y favicon;
- iconografía Font Awesome;
- dashboard con métricas, actividad y estados reales;
- emisión con **Wallet técnica, PDF, Metadata URI y SHA-256 generados automáticamente**;
- listado con búsqueda, filtros y paginación;
- acciones explícitas de **Ver detalle**, **Validar**, **PDF**, **Revocar** y **Eliminar**;
- eliminación destructiva reservada al administrador para limpiar credenciales de prueba off-chain;
- validación dentro del propio portal, sin redirigir al verificador público;
- selector de estado **Pendiente / Vigente / Revocado** para credenciales locales/off-chain;
- cambios de estado auditados;
- credenciales realmente vinculadas a blockchain protegidas contra cambios manuales incompatibles con la cadena.

### Verificador público

- funciona sin autenticación;
- búsqueda por ID / Blockchain ID;
- recuperación automática del SHA-256 registrado;
- soporte de `?id=<credential>&autoverify=1`;
- resultado con estado, integridad off-chain, coincidencia SHA-256 y disponibilidad blockchain;
- privacidad por diseño mediante enmascarado del nombre del estudiante.

### Certificate PDF v3.1

- **logo completo original de CertiChain**;
- compatibilidad con Adobe Acrobat sin JPEG `/DCTDecode` defectuoso;
- branding rasterizado desde el PNG oficial mediante `/FlateDecode`;
- tildes y texto académico correctos;
- layout depurado sin ID, fecha o etiqueta de credencial duplicados en el header;
- ID mostrado una sola vez en `IDENTIDAD DE LA CREDENCIAL`;
- fecha mostrada una sola vez en `Fecha de emisión`;
- bloque `INTEGRIDAD DIGITAL` con SHA-256, AES-256-GCM y Blockchain-ready;
- QR de validación automática;
- wallet / identidad técnica;
- estado dinámico: el PDF no fija como verdad permanente un estado que pueda cambiar después.

### Docker y persistencia

- runtime de API no-root;
- ownership mediante `COPY --chown`, evitando `chown -R /app` sobre dependencias de solo lectura;
- almacenamiento JSON de fallback con archivos temporales únicos y cola de persistencia para evitar colisiones concurrentes;
- PostgreSQL continúa siendo la persistencia del stack Docker principal.

---

## 📱 Mobile Final Polish — septiembre 2026

La aplicación móvil queda finalizada al mismo nivel de coherencia visual, funcional y de calidad del resto del proyecto, sin reescribir React Native / Expo ni ampliar el alcance académico.

- branding oficial en header, cards, detalle, iconografía y splash;
- tagline `Verified. Immutable. Trusted.`;
- verificación por ID / Blockchain ID sin pedir SHA-256 manualmente;
- recuperación automática del hash desde la API;
- compatibilidad con QR actual `?id=<credential-id>&autoverify=1`, deep links legacy con `id + hash` e ID directo;
- estados centralizados y explícitos: `pending`, `active`, `revoked` → **Pendiente**, **Vigente**, **Revocada**;
- Wallet con resumen de guardadas, vigentes, pendientes y revocadas;
- deduplicación por credential ID y revalidación que actualiza estado, hash, fecha y metadata sin crear duplicados;
- detalle con ID, SHA-256, QR, último momento de verificación e indicadores off-chain/hash/blockchain;
- compartir limitado a título, institución y URL de verificación;
- scanner con permiso explicado, bloqueo de lecturas repetidas y mensajes de error legibles;
- historial ordenado por última verificación y tratado como último estado conocido;
- perfil con versión, privacidad por diseño, SecureStore, endpoint actual y borrado local confirmado;
- conectividad con `/health`, timeout y errores de red sin borrar la wallet local;
- `EXPO_PUBLIC_API_URL` y `EXPO_PUBLIC_VERIFY_URL` como configuración de entorno;
- tests unitarios de QR, estados, share URL, deduplicación y transformación a wallet;
- export de Expo Android incluido como build móvil del gate de CI.

---

## 🎓 Información académica

| Información | Detalle |
|---|---|
| 📖 Asignatura | **Fundamentos de Seguridad de Software (ISO-915)** |
| 👨‍🏫 Profesor | **Ing. Pedro José Ramirez Rodriguez** |
| 🏫 Institución | **Universidad APEC (UNAPEC)** |
| 📅 Período académico | **Septiembre - Diciembre 2025** |
| 🧩 Tipo | **Proyecto final / Aplicación móvil con Blockchain** |

### 👥 Equipo académico original

| 👤 Integrante | 🆔 Matrícula |
|---|---|
| 👨🏻‍💻 **Francis Jairo Matías Rosario** | **A00115261** |
| 👩🏻‍💻 **Pieranyela José Carrasco Rodríguez** | **A00116415** |
| 👨🏻‍💻 **Jenrry Monegro Rosario** | **A00116621** |
| 👨🏻‍💻 **Enmanuel Alberto Arias de Jesus** | **A00117358** |

## 🧭 Continuidad académica

CertiChain ocupa un punto intermedio dentro de varias relaciones académicas verificables de la trayectoria en UNAPEC. Estas relaciones se documentan por separado para distinguir recurrencia de estudiantes, continuidad docente y cruce institucional ITLA → UNAPEC.

### 👥 Continuidad por estudiantes

**Pieranyela José Carrasco Rodríguez (A00116415)** y **Jenrry Monegro Rosario (A00116621)** coincidieron con Francis Jairo Matías Rosario en dos asignaturas distintas durante **Septiembre - Diciembre de 2025**: **CertiChain (ISO-915)** y [**AccessiUX Market**](https://github.com/Jairo0811/AccessiUX-Market), originado en **Ingeniería de la Usabilidad (ISO-505)**. Posteriormente, ambos volvieron a coincidir con Francis en [**CineGest**](https://github.com/Jairo0811/CineGest), correspondiente a **Desarrollo de Software con Tecnología Open Source I (ISO-610)** durante **Enero - Abril de 2026**.

| Orden | Asignatura | Proyecto | Período |
|---:|---|---|---|
| 1 | Fundamentos de Seguridad de Software (ISO-915) | **CertiChain** | Septiembre - Diciembre 2025 |
| 2 | Ingeniería de la Usabilidad (ISO-505) | [**AccessiUX Market**](https://github.com/Jairo0811/AccessiUX-Market) | Septiembre - Diciembre 2025 |
| 3 | Desarrollo de Software con Tecnología Open Source I (ISO-610) | [**CineGest**](https://github.com/Jairo0811/CineGest) | Enero - Abril 2026 |

La recurrencia queda respaldada por el mismo **nombre completo y matrícula** en los equipos académicos de los tres proyectos. La relación es formativa y cronológica; no implica dependencia técnica entre las aplicaciones.

### 👨‍🏫 Continuidad por profesor

El profesor **Ing. Pedro José Ramirez Rodriguez** aparece en una secuencia formativa de tres proyectos independientes: [**NutriFlow**](https://github.com/Jairo0811/NutriFlow), CertiChain y [**Digital Sanctuary**](https://github.com/Jairo0811/DigitalSanctuary).

| Orden | Asignatura | Proyecto | Período |
|---:|---|---|---|
| 1 | Bases de Datos 1 (INF-164) | [**NutriFlow**](https://github.com/Jairo0811/NutriFlow) | Mayo - Agosto 2024 |
| 2 | Fundamentos de Seguridad de Software (ISO-915) | **CertiChain** | Septiembre - Diciembre 2025 |
| 3 | Desarrollo de Software con Tecnología Propietaria 2 (ISO-710) | [**Digital Sanctuary**](https://github.com/Jairo0811/DigitalSanctuary) | Mayo - Agosto 2026 |

La secuencia es **formativa y cronológica**: comienza con fundamentos de datos y modelado, continúa con seguridad de software y blockchain, y posteriormente llega al desarrollo de una aplicación Android nativa. Los proyectos no constituyen versiones ni dependencias técnicas entre sí.

### 🏫 Cruce institucional ITLA → UNAPEC

Dentro del equipo de CertiChain existen trayectorias previas documentadas en el **Instituto Tecnológico de Las Américas (ITLA)** antes de coincidir en UNAPEC:

| Integrante | Matrícula UNAPEC | Matrícula ITLA |
|---|---|---|
| Francis Jairo Matías Rosario | A00115261 | 2015-2984 |
| Pieranyela José Carrasco Rodríguez | A00116415 | 2019-8767 |
| Jenrry Monegro Rosario | A00116621 | 2019-8690 |
| Enmanuel Alberto Arias de Jesus | A00117358 | 2019-7415 |

El cruce institucional documenta la trayectoria educativa previa de los cuatro integrantes del equipo. Para Pieranyela y Jenrry, la continuidad posterior en UNAPEC queda además documentada en **AccessiUX Market** y **CineGest**. No implica que hayan cursado juntos una misma asignatura en ITLA.

CertiChain forma parte de la evolución académica y técnica de proyectos preservados y modernizados posteriormente con prácticas de ingeniería de software.

---

## ✨ Funcionalidades

### 🖥️ Portal institucional

- autenticación administrativa;
- dashboard con métricas y actividad reciente;
- emisión automática de evidencia PDF;
- listado, búsqueda, filtros y paginación;
- detalle de credenciales;
- validación criptográfica in-place;
- gestión de estado local/off-chain;
- descarga del PDF;
- revocación;
- eliminación segura de certificados de prueba;
- verificador público independiente.

### 📱 Aplicación móvil

✅ **Mobile Final Polish completado**

- React Native + Expo + TypeScript;
- navegación Inicio / Escanear / Historial / Perfil;
- Wallet local protegida mediante `expo-secure-store`;
- verificación por ID / Blockchain ID;
- SHA-256 recuperado automáticamente;
- QR local generado desde `EXPO_PUBLIC_VERIFY_URL`;
- escáner real con `expo-camera`;
- compatibilidad con QR moderno y legacy;
- detalle con estado, ID, SHA-256, última verificación e indicadores de integridad;
- compartir credencial sin PII innecesaria;
- copiar ID y SHA-256 de forma separada;
- revalidación que actualiza la entrada existente;
- historial ordenado por última validación;
- gestión explícita de `pending`, `active` y `revoked`;
- manejo de API offline, timeout, 404 y respuesta inválida;
- icono, adaptive icon, splash y branding assets oficiales de CertiChain;
- accesibilidad y responsive hardening razonable.

### ⚙️ Backend

- Node.js + Express + TypeScript;
- JWT y RBAC;
- emisión, revocación, verificación, cambio de estado local y auditoría;
- Zod;
- rate limiting y headers defensivos;
- PostgreSQL con `DATABASE_URL`;
- JSON únicamente como fallback local/test;
- almacenamiento de documentos cifrados;
- generación PDF;
- QR;
- `/health`, `/ready` y `/metrics`.

### ⛓️ Blockchain

- `CertificateRegistry.sol`;
- emisores autorizados;
- emisión y revocación;
- verificación de hashes;
- eventos de trazabilidad;
- Hardhat + OpenZeppelin;
- redes Sepolia, Polygon Amoy y Polygon PoS preparadas.

---

## 🏗️ Arquitectura

```text
┌───────────────────────────────────────────────────────────────┐
│                           Clientes                            │
│                                                               │
│   📱 Mobile App      🖥️ Portal Institucional      🔍 Verify   │
└───────────────┬──────────────────┬────────────────────────────┘
                │                  │
                └─────────┬────────┘
                          ▼
                ┌──────────────────────┐
                │      REST API        │
                │ Node.js / Express TS │
                └──────────┬───────────┘
                           │
              ┌────────────┼──────────────┐
              ▼            ▼              ▼
         PostgreSQL    Encrypted       Blockchain
                       Storage/IPFS     Gateway
                           │              │
                           │              ▼
                           │       CertificateRegistry
                           │       Solidity / Polygon
                           └──────────────┬─────────────
                                          ▼
                                   Audit / Metrics
```

### Datos on-chain

- identificador criptográfico;
- hash del documento;
- emisor;
- estado;
- timestamps;
- referencia no sensible.

### Datos off-chain

- nombre del estudiante;
- PDF y documentos académicos;
- wallet / identidad técnica local;
- información privada institucional;
- secretos y claves.

---

## 🧱 Stack tecnológico

### 📱 Mobile y Web

<p>
  <img src="https://skillicons.dev/icons?i=react,ts,vite" alt="React, TypeScript y Vite" />
  <img src="https://img.shields.io/badge/Expo-54-000020?style=flat-square&logo=expo&logoColor=white" alt="Expo 54" />
</p>

### ⚙️ Backend y API

<p>
  <img src="https://skillicons.dev/icons?i=nodejs,express,ts" alt="Node.js, Express y TypeScript" />
  <img src="https://img.shields.io/badge/Zod-Validation-3E67B1?style=flat-square&logo=zod&logoColor=white" alt="Zod" />
  <img src="https://img.shields.io/badge/JWT-Auth-000000?style=flat-square&logo=jsonwebtokens&logoColor=white" alt="JWT" />
</p>

### 🗄️ Datos, Blockchain y Storage

<p>
  <img src="https://skillicons.dev/icons?i=postgres,solidity" alt="PostgreSQL y Solidity" />
  <img src="https://img.shields.io/badge/Hardhat-Contracts-FFF100?style=flat-square&logo=hardhat&logoColor=000000" alt="Hardhat" />
  <img src="https://img.shields.io/badge/OpenZeppelin-Security-4E5EE4?style=flat-square&logo=openzeppelin&logoColor=white" alt="OpenZeppelin" />
  <img src="https://img.shields.io/badge/IPFS-Storage-65C2CB?style=flat-square&logo=ipfs&logoColor=white" alt="IPFS" />
</p>

### 🧪 Testing, Seguridad y DevOps

<p>
  <img src="https://skillicons.dev/icons?i=docker,github,githubactions" alt="Docker, GitHub y GitHub Actions" />
  <img src="https://img.shields.io/badge/Vitest-Testing-6E9F18?style=flat-square&logo=vitest&logoColor=white" alt="Vitest" />
  <img src="https://img.shields.io/badge/CodeQL-Security-181717?style=flat-square&logo=github&logoColor=white" alt="CodeQL" />
  <img src="https://img.shields.io/badge/Prometheus-Observability-E6522C?style=flat-square&logo=prometheus&logoColor=white" alt="Prometheus" />
</p>

| Capa | Tecnologías |
|---|---|
| Mobile | React Native, Expo 54, TypeScript, Expo Camera, Secure Store, QR Code SVG |
| Web | React 19, TypeScript, Vite |
| API | Node.js, Express, TypeScript, Zod, JWT |
| Persistencia | PostgreSQL; JSON como fallback local/test |
| Blockchain | Solidity, Hardhat, OpenZeppelin, Ethers.js |
| Redes | Sepolia, Polygon Amoy, Polygon PoS |
| Storage | AES-256-GCM + Local/IPFS adapter |
| Testing | Vitest, Supertest, Hardhat Test |
| DevOps | Docker, Docker Compose, GitHub Actions, GHCR |
| Seguridad | CodeQL, RBAC, SHA-256, rate limiting, auditoría |
| Observabilidad | Prometheus metrics, readiness, structured logs |

---

## 🚀 Ejecución local con Docker

### Requisitos

- Docker Desktop / Docker Engine;
- Docker Compose;
- Git.

### 1. Configuración

```bash
cp .env.example .env
```

Para desarrollo local configura al menos:

```env
JWT_SECRET=replace-this-with-a-long-local-secret
ADMIN_PASSWORD=CertiChain2026!Local
CORS_ORIGIN=http://localhost:8080
VITE_API_URL=http://localhost:4000
PUBLIC_VERIFY_URL=http://localhost:8080/verify
EXPO_PUBLIC_API_URL=http://localhost:4000
EXPO_PUBLIC_VERIFY_URL=http://localhost:8080/verify
```

> En producción, `PUBLIC_VERIFY_URL` y `EXPO_PUBLIC_VERIFY_URL` deben usar HTTPS y una ruta real de verificación. El repositorio no inventa ni fija un dominio de producción.

### 2. Levantar el stack

```bash
docker compose up -d --build
```

Servicios:

- PostgreSQL;
- API: `http://localhost:4000`;
- Web: `http://localhost:8080`.

### 3. Health / readiness

```bash
curl http://localhost:4000/health
curl http://localhost:4000/ready
```

### 4. Mobile

Desde el monorepo:

```bash
npm run start --workspace=@certichain/mobile
```

#### Expo Go en teléfono físico

El teléfono y la PC deben estar en la misma red local. No uses `localhost` para la API desde el teléfono; `localhost` apuntaría al propio dispositivo.

Ejemplo de configuración temporal de desarrollo:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.50:4000
EXPO_PUBLIC_VERIFY_URL=http://192.168.1.50:8080/verify
```

Sustituye `192.168.1.50` por la IP LAN real de tu PC. No se debe commitear un `.env` personal.

Luego ejecuta:

```bash
npm run start --workspace=@certichain/mobile
```

Abre el QR de Expo con Expo Go y verifica que el teléfono pueda abrir `http://<IP-LAN>:4000/health` en el navegador antes de probar certificados.

#### Android Emulator

Usa el alias del host Android:

```env
EXPO_PUBLIC_API_URL=http://10.0.2.2:4000
EXPO_PUBLIC_VERIFY_URL=http://10.0.2.2:8080/verify
```

Después:

```bash
npm run android --workspace=@certichain/mobile
```

#### Build de validación móvil

El gate global ejecuta:

```bash
npm run build --workspace=@certichain/mobile
```

que exporta el bundle Android mediante Expo sin introducir E2E móvil complejo.

---

## 🔐 Documentos cifrados e IPFS

La API calcula **SHA-256 sobre el documento original** y después cifra el contenido con **AES-256-GCM** antes de escribirlo en storage.

Desarrollo:

```env
STORAGE_DRIVER=local
```

Producción opcional:

```env
STORAGE_DRIVER=ipfs
DOCUMENT_ENCRYPTION_KEY=<64 caracteres hexadecimales>
IPFS_API_URL=https://...
IPFS_API_TOKEN=...
```

---

## 🗄️ PostgreSQL y recuperación

Con `DATABASE_URL`, la API utiliza PostgreSQL y crea tablas e índices requeridos de manera idempotente.

```bash
scripts/backup-postgres.sh
ALLOW_RESTORE=YES scripts/restore-postgres.sh backups/certichain-<timestamp>.dump
```

Los backups generan checksum SHA-256 y el restore exige confirmación explícita.

---

## ⛓️ Smart contracts

El workflow **Deploy CertificateRegistry** permite despliegue manual hacia:

- `sepolia`;
- `amoy`;
- `polygon`.

Los RPC y `BLOCKCHAIN_PRIVATE_KEY` deben residir únicamente en secretos de GitHub Environments.

Para el alcance académico no es necesario financiar un despliegue mainnet.

---

## 📊 Observabilidad

```text
GET /health
GET /ready
GET /metrics
```

Las solicitudes generan logs estructurados con request ID, método, ruta, código HTTP y duración. En producción, `/metrics` puede protegerse mediante `METRICS_TOKEN`.

---

## 🧪 Quality gates

CI utiliza `package-lock.json` + `npm ci` y exige:

```text
format
lint
type-check
tests
build
CodeQL
```

Los tests cubren, entre otros:

```text
autenticación
→ emisión
→ generación PDF / SHA-256
→ listado
→ validación
→ pending ↔ active ↔ revoked en off-chain
→ revocación
→ eliminación de prueba
→ QR moderno / legacy / ID directo en Mobile
→ estados Mobile pending / active / revoked
→ URL de compartir sin PII innecesaria
→ deduplicación y revalidación de wallet
```

Los contratos cuentan con pruebas de permisos, emisión, revocación e integridad.

> El reporte global de `npm audit` del monorepo debe analizarse por workspace antes de aplicar upgrades; no se recomienda `npm audit fix --force` sin revisar impacto sobre Expo/Hardhat y dependencias transitivas.

---

## 🗺️ Roadmap

| Fase | Alcance | Estado |
|---|---|:---:|
| 0 | Fundación, documentación y arquitectura | ✅ |
| 1 | Blockchain Core | ✅ |
| 2 | Backend API | ✅ |
| 3 | Portal institucional | ✅ |
| 4 | Aplicación móvil base | ✅ |
| 5 | Verificación pública | ✅ |
| 6 | Seguridad, privacidad y storage | ✅ |
| 7 | Testing, DevOps y despliegue | ✅ |
| 8 | Production readiness | ✅ Base implementada |
| Hardening Web/API/PDF 2026 | UX, branding, Certificate PDF v3.1, estados, cleanup | ✅ |
| Mobile Final Polish | Visual parity, verificación y UX móvil | ✅ Finalizado |

### Extensiones opcionales de producción

- PostgreSQL administrado;
- proveedor IPFS real;
- RPC de Polygon y wallet de despliegue;
- dominio HTTPS + CDN/WAF;
- observabilidad administrada;
- auditoría independiente del smart contract;
- staging E2E;
- GitHub Release/tag formal.

Consulta [`docs/portfolio-readiness.md`](docs/portfolio-readiness.md), [`docs/production-readiness.md`](docs/production-readiness.md) y [`CHANGELOG.md`](CHANGELOG.md).

---

## 🔒 Seguridad

- ningún secreto debe almacenarse en Git;
- PII y documentos completos permanecen off-chain;
- documentos se cifran antes de storage/IPFS;
- cambios administrativos sensibles quedan auditados;
- una credencial blockchain-bound no puede borrarse ni cambiar de estado manualmente de forma incompatible con la cadena;
- wallets de despliegue deben usar mínimo privilegio y fondos limitados;
- antes de Polygon Mainnet se requiere revisión independiente del smart contract.

Consulta [`SECURITY.md`](SECURITY.md) para el proceso de reporte de vulnerabilidades.

---

## 📄 Licencia

MIT. Consulta [`LICENSE`](LICENSE).

---

## 👨‍💻 Mantenimiento

**Francis Jairo Matías Rosario**  
Matrícula: **A00115261**  
Ingeniería de Software  
Universidad APEC (UNAPEC)

---

<p align="center"><strong>CertiChain — Verify once. Trust anywhere.</strong></p>
