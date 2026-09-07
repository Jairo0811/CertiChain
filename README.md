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

CertiChain **v1.0.0** está cerrado como proyecto académico de portafolio y continúa recibiendo **hardening de presentación y experiencia de usuario**, sin convertirlo en un SaaS comercial ni ampliar innecesariamente el alcance académico.

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
| Aplicación móvil | ✅ Base funcional / 🎨 polish en curso |
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

La última ronda de trabajo dejó consolidado el flujo principal de CertiChain antes de continuar con el polish móvil.

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

## 🎓 Información académica

| Información | Detalle |
|---|---|
| 📖 Asignatura | **Fundamentos de Seguridad de Software (ISO-915)** |
| 👨‍🏫 Profesor | **Ing. Pedro José Ramirez Rodriguez** |
| 🏫 Institución | **Universidad APEC (UNAPEC)** |
| 📅 Período académico | **Septiembre - Diciembre 2025** |
| 🧩 Tipo | **Proyecto final / Aplicación móvil con Blockchain** |

### 👥 Equipo académico original

| Integrante | Matrícula |
|---|---|
| **Francis Jairo Matías Rosario** | **A00115261** |
| **Pieranyela José Carrasco Rodríguez** | **A00116415** |
| **Jenrry Monegro Rosario** | **A00116621** |
| **Enmanuel Alberto Arias de Jesus** | **A00117358** |

### 🧭 Continuidad académica

CertiChain forma parte de una línea de proyectos preservados y modernizados durante la trayectoria académica en UNAPEC.

- Pieranyela José Carrasco Rodríguez y Jenrry Monegro Rosario coincidieron también en **AccessiUX Market** (ISO-505) y posteriormente en **CineGest** (ISO-610).
- El profesor Ing. Pedro José Ramirez Rodriguez aparece también en **NutriFlow** (INF-164) y **Digital Sanctuary** (ISO-710), dentro de una continuidad formativa de proyectos independientes.
- Los cuatro integrantes del equipo cuentan además con trayectoria académica previa documentada en ITLA antes de coincidir en UNAPEC.

Estas relaciones son académicas y cronológicas; no implican dependencia técnica entre los proyectos.

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

Base funcional existente:

- React Native + Expo + TypeScript;
- wallet local de credenciales verificadas;
- navegación Inicio / Escanear / Historial / Perfil;
- QR de credenciales;
- escáner real con `expo-camera`;
- detalle de credenciales;
- copiar y compartir identificadores;
- historial protegido mediante `expo-secure-store`;
- icono, adaptive icon, splash y branding assets de CertiChain.

**Siguiente foco:** llevar la app móvil al mismo nivel visual y de UX que el portal institucional, eliminar placeholders visuales heredados (`CC`), alinear el flujo de verificación con la recuperación automática de SHA-256 y mejorar estados, feedback y experiencia de cámara.

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
```

> En producción, `PUBLIC_VERIFY_URL` debe usar HTTPS, un dominio real y terminar en `/verify`.

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

Para un dispositivo físico, `EXPO_PUBLIC_API_URL` debe apuntar a una URL alcanzable desde el teléfono —por ejemplo la IP LAN del equipo que ejecuta la API— y no a `localhost` del teléfono.

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
| Mobile Final Polish | Visual parity, verificación y UX móvil | 🚧 En curso |

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
