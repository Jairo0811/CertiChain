<p align="center">
  <img src="https://img.shields.io/badge/UNAPEC-ISO--915-003B70?style=for-the-badge" alt="UNAPEC ISO-915">
</p>


<p align="center">
  <img src="https://img.shields.io/badge/Estado-En%20desarrollo-F59E0B?style=for-the-badge" alt="Estado: En desarrollo">
  <img src="https://img.shields.io/badge/Blockchain-Ethereum%20%2F%20Polygon-7C3AED?style=for-the-badge&logo=ethereum&logoColor=white" alt="Ethereum / Polygon">
</p>

<h1 align="center">🎓⛓️ CertiChain</h1>

<p align="center"><strong>Sistema de Certificados Académicos con Blockchain</strong></p>

<p align="center">
  Verificación inmutable, transparente y portable de credenciales académicas.
</p>

---

## 📌 Descripción

**CertiChain** es un proyecto académico de la **Universidad APEC (UNAPEC)** concebido para combatir la falsificación de certificados académicos y reducir la fricción asociada a la verificación tradicional de credenciales.

La propuesta utiliza **blockchain** para registrar evidencia criptográfica de los certificados emitidos, permitiendo que estudiantes, instituciones, empresas y otros verificadores validen su autenticidad mediante un **código QR** o un **identificador único**.

El concepto original fue diseñado como una **aplicación móvil**, acompañado de smart contracts, almacenamiento distribuido y mecanismos de verificación de integridad.

> Este repositorio representa la evolución del proyecto académico original hacia una implementación profesional, modular, segura, mantenible y preparada para crecer.

---

## 🎓 Información académica

| Información | Detalle |
|---|---|
| 📖 Asignatura | **Fundamentos de Seguridad de Software (ISO-915)** |
| 👨‍🏫 Profesor | **Ing. Pedro José Ramirez Rodriguez** |
| 🏫 Institución | **Universidad APEC (UNAPEC)** |
| 📅 Período académico | **2024-2025** |
| 🧩 Tipo de proyecto | **Proyecto final / Aplicación móvil con Blockchain** |

### 👥 Equipo académico original

| Integrante | Matrícula |
|---|---|
| **Francis Jairo Matías Rosario** | **A00115261** |
| **Piernyela Carrasco** | **A00116415** |
| **Jenrry Monegro** | **A00116621** |
| **Enmanuel Arias** | **A00117358** |

> El orden anterior se presenta por matrícula para mantener una convención uniforme dentro de la colección de proyectos académicos.

---

## 🧭 Continuidad académica

CertiChain forma parte de una línea de proyectos académicos desarrollados en UNAPEC bajo la docencia del **Ing. Pedro José Ramirez Rodriguez**.

| Orden | Asignatura | Proyecto | Período | Profesor |
|---:|---|---|---|---|
| 1 | Bases de Datos 1 (**INF-164**) | [**NutriFlow**](https://github.com/Jairo0811/NutriFlow) | Mayo - Agosto 2024 | **Ing. Pedro José Ramirez Rodriguez** |
| 2 | Fundamentos de Seguridad de Software (**ISO-915**) | **CertiChain** | Septiembre - Diciembre 2025 | **Ing. Pedro José Ramirez Rodriguez** |
| 3 | Desarrollo de Software con Tecnología Propietaria 2 (**ISO-710**) | [**Digital Sanctuary**](https://github.com/Jairo0811/DigitalSanctuary) | Mayo - Agosto 2026 | **Ing. Pedro José Ramirez Rodriguez** |

Esta continuidad es **académica y docente**: los proyectos son independientes, pertenecen a asignaturas diferentes y documentan distintas etapas de formación en desarrollo de software.

---

## 🔴 Problema

Los sistemas tradicionales de certificación académica presentan varios riesgos y limitaciones:

- falsificación o alteración de certificados;
- procesos de verificación lentos y burocráticos;
- dependencia de la disponibilidad de la institución emisora;
- pérdida, deterioro o destrucción de documentos físicos;
- dificultad para compartir credenciales de forma inmediata;
- poca trazabilidad sobre emisión, vigencia y revocación.

---

## ✅ Solución propuesta

CertiChain plantea una infraestructura donde cada certificado dispone de una representación verificable criptográficamente.

El sistema permite:

- registrar certificados emitidos por instituciones autorizadas;
- generar un **hash único** del documento;
- comprobar su integridad sin exponer innecesariamente información sensible;
- verificar certificados mediante **QR** o identificador;
- consultar su estado actual;
- revocar credenciales cuando corresponda;
- permitir al estudiante consultar y compartir sus certificados;
- mantener evidencia auditable de emisión y validación.

---

## 🎯 Objetivos

### Objetivo general

Construir una plataforma segura para la emisión, administración y verificación de certificados académicos utilizando blockchain como mecanismo de integridad y trazabilidad.

### Objetivos específicos

- Reducir el riesgo de falsificación de credenciales.
- Permitir verificaciones prácticamente instantáneas.
- Facilitar la portabilidad de certificados académicos.
- Proteger los datos personales mediante una estrategia **off-chain first**.
- Mantener trazabilidad de emisión, revocación y verificación.
- Proporcionar APIs para futuras integraciones institucionales.
- Diseñar una arquitectura escalable y mantenible.

---

## 👤 Actores del sistema

### 🎓 Estudiante

- consulta sus certificados;
- visualiza el estado de cada credencial;
- genera o muestra códigos QR;
- comparte enlaces o identificadores de verificación;
- descarga representaciones digitales cuando estén disponibles.

### 🏫 Institución emisora

- administra usuarios autorizados;
- registra certificados;
- consulta certificados emitidos;
- revoca certificados cuando corresponde;
- supervisa actividad y auditoría.

### 🔍 Verificador

- escanea un QR;
- introduce un identificador manualmente;
- consulta la evidencia registrada;
- valida integridad, emisor y estado de la credencial.

### 🛡️ Administrador

- administra instituciones autorizadas;
- controla permisos y configuración global;
- consulta auditoría;
- supervisa integridad operativa de la plataforma.

---

## 🔄 Flujo de emisión

```text
Institución autorizada
        │
        ▼
Generación / carga del certificado
        │
        ▼
Cálculo SHA-256
        │
        ├──────────────► Documento cifrado / almacenamiento off-chain
        │
        ▼
Smart Contract
        │
        ▼
Registro de evidencia criptográfica
        │
        ▼
Identificador + QR
        │
        ▼
Certificado disponible para el estudiante
```

La blockchain no debe utilizarse como repositorio de datos personales sensibles. La implementación profesional priorizará almacenar **hashes, identificadores técnicos, emisor, estado y referencias verificables**, manteniendo los documentos y datos privados fuera de la cadena.

---

## 🔍 Flujo de verificación

```text
QR / ID del certificado
        │
        ▼
Resolver identificador
        │
        ▼
Consultar Smart Contract
        │
        ├── ¿Existe?
        ├── ¿Emisor autorizado?
        ├── ¿Activo o revocado?
        └── Hash registrado
                │
                ▼
       Comparación de integridad
                │
                ▼
      Resultado de verificación
```

Validaciones principales:

- existencia del certificado;
- integridad del documento;
- institución emisora;
- estado activo o revocado;
- fecha de emisión;
- asociación con el titular mediante identificadores protegidos.

---

## 💻 Smart Contract

El alcance original contempla operaciones equivalentes a:

```solidity
issueCertificate(studentAddress, hash, metadata)
verifyCertificate(certificateId)
revokeCertificate(certificateId)
getCertificatesByStudent(studentAddress)
```

En la evolución profesional, estas operaciones serán modeladas con:

- control de acceso basado en roles;
- eventos blockchain para auditoría;
- pausabilidad de emergencia cuando aplique;
- validaciones explícitas;
- pruebas unitarias del contrato;
- protección contra usos no autorizados;
- minimización de datos almacenados on-chain.

---

## 🏗️ Arquitectura objetivo

```text
┌─────────────────────────────────────────────────────────────┐
│                         Clientes                            │
│                                                             │
│  📱 Mobile App        🖥️ Portal Institucional   🔍 Verifier │
└───────────────┬─────────────────────┬───────────────────────┘
                │                     │
                └──────────┬──────────┘
                           ▼
                 ┌───────────────────┐
                 │    REST API       │
                 │ Node.js / TS      │
                 └─────────┬─────────┘
                           │
             ┌─────────────┼─────────────┐
             ▼             ▼             ▼
        Application      Storage      Blockchain
          Database       / IPFS       Gateway
             │             │             │
             │             │             ▼
             │             │        Smart Contracts
             │             │        Solidity
             │             │             │
             └─────────────┴─────────────┘
                           │
                           ▼
                    Audit / Security
```

### Principios arquitectónicos

- separación de responsabilidades;
- arquitectura modular;
- SOLID, DRY y KISS;
- dominio independiente de infraestructura;
- servicios externos detrás de abstracciones;
- validación de entrada en todas las fronteras;
- mínimo privilegio;
- secretos fuera del código fuente;
- auditoría estructurada;
- contratos e integraciones testeables.

---

## 🧱 Stack tecnológico

### 📱 Aplicación móvil

<p>
  <img src="https://skillicons.dev/icons?i=react,ts" alt="React y TypeScript" />
  <img src="https://img.shields.io/badge/React%20Native-20232A?style=flat-square&logo=react&logoColor=61DAFB" alt="React Native" />
  <img src="https://img.shields.io/badge/Expo-000020?style=flat-square&logo=expo&logoColor=white" alt="Expo" />
</p>

- React Native
- Expo
- TypeScript
- Ethers.js
- cámara / QR
- Secure Storage para secretos locales

### 🖥️ Portal web

<p>
  <img src="https://skillicons.dev/icons?i=react,ts,vite" alt="React TypeScript Vite" />
</p>

- React
- TypeScript
- Vite
- portal institucional
- verificador público

### ⚙️ Backend

<p>
  <img src="https://skillicons.dev/icons?i=nodejs,express,ts" alt="Node.js Express TypeScript" />
</p>

- Node.js
- Express.js
- TypeScript
- REST API
- OpenAPI / Swagger
- validación estructurada
- autenticación y autorización RBAC

### ⛓️ Blockchain

<p>
  <img src="https://skillicons.dev/icons?i=solidity" alt="Solidity" />
  <img src="https://img.shields.io/badge/Ethereum-3C3C3D?style=flat-square&logo=ethereum&logoColor=white" alt="Ethereum" />
  <img src="https://img.shields.io/badge/Polygon-8247E5?style=flat-square&logo=polygon&logoColor=white" alt="Polygon" />
  <img src="https://img.shields.io/badge/OpenZeppelin-4E5EE4?style=flat-square&logo=openzeppelin&logoColor=white" alt="OpenZeppelin" />
</p>

- Solidity
- Ethereum / Polygon
- Hardhat
- OpenZeppelin Contracts
- Sepolia Testnet para desarrollo inicial
- Ethers.js para integración

### 🗄️ Persistencia y documentos

<p>
  <img src="https://skillicons.dev/icons?i=postgres,firebase" alt="PostgreSQL y Firebase" />
  <img src="https://img.shields.io/badge/IPFS-65C2CB?style=flat-square&logo=ipfs&logoColor=white" alt="IPFS" />
</p>

- base de datos relacional para información operativa;
- IPFS como opción para almacenamiento direccionado por contenido;
- Firebase presente en el planteamiento académico original y evaluado según necesidades reales de la evolución;
- cifrado de información sensible antes de almacenamiento externo.

> La selección definitiva de persistencia se cerrará durante la fase de arquitectura. No se almacenarán datos personales sensibles directamente en una blockchain pública.

### 🔐 Seguridad

<p>
  <img src="https://img.shields.io/badge/SHA--256-Hashing-111827?style=flat-square" alt="SHA-256" />
  <img src="https://img.shields.io/badge/AES--256-Encryption-2563EB?style=flat-square" alt="AES-256" />
  <img src="https://img.shields.io/badge/RBAC-Authorization-7C3AED?style=flat-square" alt="RBAC" />
</p>

- SHA-256
- cifrado AES-256 cuando corresponda
- RBAC
- gestión segura de secretos
- rate limiting
- validación y sanitización
- registros de auditoría
- principio de mínimo privilegio

### 🧪 Testing y DevOps

<p>
  <img src="https://skillicons.dev/icons?i=jest,git,github,githubactions,docker" alt="Jest Git GitHub GitHub Actions Docker" />
</p>

- Jest
- Mocha / Chai para contratos cuando corresponda
- Hardhat Test
- pruebas de integración
- GitHub Actions
- Docker / Docker Compose
- análisis estático y quality gates

---

## 🔐 Modelo de seguridad

CertiChain trata la seguridad como requisito transversal y no como una característica añadida al final.

### Datos on-chain

Preferentemente:

- hash del certificado;
- identificador técnico;
- identificador de institución emisora;
- timestamp;
- estado;
- referencia criptográfica o de contenido cuando sea necesaria.

### Datos off-chain

- nombre del estudiante;
- documento de identidad;
- expediente académico;
- PDF completo;
- información institucional privada;
- metadatos sensibles.

### Controles previstos

- autenticación segura;
- autorización RBAC;
- cifrado en tránsito mediante TLS;
- cifrado en reposo donde aplique;
- gestión segura de wallets y claves;
- secretos mediante variables de entorno / secret managers;
- auditoría de acciones críticas;
- revocación de certificados;
- protección contra replay y operaciones duplicadas;
- validación de contratos inteligentes.

---

## 📦 Estructura objetivo del repositorio

```text
CertiChain/
├── apps/
│   ├── mobile/              # React Native + Expo
│   ├── web/                 # Portal institucional y verificador
│   └── api/                 # Node.js + TypeScript
│
├── blockchain/
│   ├── contracts/           # Solidity
│   ├── scripts/
│   ├── test/
│   └── hardhat.config.ts
│
├── packages/
│   ├── config/
│   ├── shared/
│   └── types/
│
├── docs/
│   ├── architecture/
│   ├── security/
│   └── academic/
│
├── .github/
│   └── workflows/
│
├── docker/
├── .gitignore
├── LICENSE
└── README.md
```

---

## 🗺️ Roadmap de evolución

| Fase | Alcance | Estado |
|---|---|:---:|
| 0 | Fundación, documentación, arquitectura y estándares | 🚧 |
| 1 | Smart Contracts y dominio de certificados | ⏳ |
| 2 | Backend, autenticación, instituciones y RBAC | ⏳ |
| 3 | Emisión, revocación, hashing y almacenamiento | ⏳ |
| 4 | App móvil del estudiante | ⏳ |
| 5 | Portal institucional y verificador QR | ⏳ |
| 6 | Seguridad avanzada, auditoría y hardening | ⏳ |
| 7 | Testing integral, CI/CD, Docker y observabilidad | ⏳ |
| 8 | Piloto, despliegue y preparación de release | ⏳ |

### Relación con el plan académico original

El proyecto académico planteaba cuatro etapas generales:

1. **MVP**;
2. **Piloto**;
3. **Escalamiento**;
4. **Expansión**.

El roadmap actual descompone esas etapas en entregables de ingeniería más pequeños y verificables sin cambiar el propósito original del proyecto.

---

## ✅ Definición de terminado

Una funcionalidad se considerará completada cuando:

- implemente el comportamiento requerido;
- cuente con validaciones y manejo de errores;
- tenga pruebas automatizadas relevantes;
- no introduzca secretos en el repositorio;
- respete la arquitectura establecida;
- pase CI;
- mantenga documentación suficiente;
- haya sido revisada antes de fusionarse a `main`.

---

## 🚀 Estado actual

**CertiChain se encuentra en reconstrucción y evolución profesional.**

La documentación académica y el diseño conceptual constituyen el punto de partida. Las funcionalidades descritas en este README representan tanto el alcance original como la arquitectura objetivo y **no deben interpretarse todavía como funcionalidades implementadas** hasta que sus respectivas fases sean completadas.

---

## 👨‍💻 Mantenimiento

**Francis Jairo Matías Rosario**  
Matrícula: **A00115261**  
Ingeniería de Software  
Universidad APEC (UNAPEC)

CertiChain forma parte de una colección de proyectos académicos preservados y evolucionados posteriormente con prácticas modernas de ingeniería de software.

---

<p align="center">
  <strong>CertiChain — Verify once. Trust anywhere.</strong>
</p>
