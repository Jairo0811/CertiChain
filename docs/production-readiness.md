# CertiChain — Production Readiness

Este documento define el cierre técnico de las fases 7 y 8 y los controles necesarios para desplegar CertiChain de forma responsable.

## Fase 7 — Testing, DevOps y despliegue

### Quality gates

El repositorio mantiene como gate obligatorio:

- formato
- lint
- type-check
- pruebas automatizadas
- build de los workspaces
- pruebas de smart contracts

La API incluye smoke tests para salud del servicio, payloads de autenticación inválidos y solicitudes públicas de verificación malformadas.

### Contenedores

Se incluyen imágenes separadas para:

- `apps/api/Dockerfile`
- `apps/web/Dockerfile`

El backend se ejecuta con usuario no-root y volumen persistente para el almacenamiento MVP. El frontend se publica mediante Nginx con fallback de SPA y headers defensivos.

`docker-compose.yml` permite levantar el stack completo y exige secretos sensibles como `JWT_SECRET` y `ADMIN_PASSWORD`.

### Entornos

Entornos recomendados:

1. `development` — ejecución local.
2. `test` — CI y pruebas automatizadas.
3. `staging` — Polygon Amoy + infraestructura equivalente a producción.
4. `production` — Polygon PoS + servicios administrados.

Nunca reutilizar claves privadas o secretos entre entornos.

## Fase 8 — Producción y expansión

### Blockchain

Hardhat queda preparado para:

- Ethereum Sepolia
- Polygon Amoy
- Polygon PoS Mainnet

El despliegue a mainnet debe realizarse únicamente con una wallet de despliegue dedicada y fondos mínimos necesarios. La clave no debe almacenarse en el repositorio ni en archivos `.env` compartidos.

### Arquitectura objetivo de producción

- Web estática detrás de CDN/WAF.
- API en contenedores administrados.
- Persistencia migrada desde JSON a SQL administrado.
- Documentos cifrados antes de almacenamiento distribuido/IPFS.
- Secretos en Key Vault/HSM o gestor equivalente.
- RPC blockchain administrado con límites y redundancia.
- Observabilidad centralizada para logs, métricas y alertas.
- Backups y recuperación probados.

### Datos on-chain

Solo deben publicarse datos necesarios para demostrar autenticidad:

- identificador criptográfico
- hash del documento
- emisor
- estado
- timestamps
- referencia de metadata no sensible

PII, documentos académicos completos y secretos permanecen off-chain.

### Go-live checklist

Antes de habilitar producción:

- [ ] reemplazar credenciales bootstrap
- [ ] configurar CORS con dominio HTTPS real
- [ ] desplegar `CertificateRegistry` en Polygon
- [ ] guardar la dirección del contrato en configuración segura
- [ ] migrar persistencia a SQL administrado
- [ ] habilitar cifrado de documentos
- [ ] configurar almacenamiento/IPFS productivo
- [ ] habilitar WAF/rate limiting perimetral
- [ ] configurar backups
- [ ] configurar logs, métricas y alertas
- [ ] ejecutar pruebas de recuperación
- [ ] ejecutar revisión de seguridad del smart contract
- [ ] ejecutar E2E web/API/móvil
- [ ] validar política de privacidad y retención

## Escalamiento posterior

La arquitectura queda preparada para evolucionar hacia:

- multiinstitución
- API pública para empleadores y universidades
- credenciales verificables W3C
- interoperabilidad con wallets académicas
- multiidioma
- analítica antifraude
- emisión por lotes
- integración con sistemas académicos externos

La finalización de las fases de desarrollo significa que el producto dispone de una base funcional y de despliegue. El paso a mainnet y el go-live real siguen siendo operaciones controladas que requieren secretos, infraestructura y aprobaciones externas que no deben automatizarse desde el código fuente.
