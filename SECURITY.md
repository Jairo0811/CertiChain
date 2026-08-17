# Security Policy

CertiChain gestiona credenciales académicas y referencias criptográficas, por lo que la seguridad forma parte del diseño del producto y no se considera una tarea posterior.

## Principios

- No almacenar claves privadas, secretos JWT, tokens RPC ni credenciales de infraestructura en Git.
- No almacenar datos personales sensibles directamente en una blockchain pública.
- Registrar on-chain únicamente los datos mínimos necesarios para demostrar autenticidad, integridad, emisor y estado.
- Mantener documentos y datos personales off-chain con cifrado y controles de acceso.
- Aplicar mínimo privilegio a usuarios, instituciones, servicios y contratos.
- Validar entradas en todos los límites de confianza.
- Mantener trazabilidad de emisiones, revocaciones y operaciones administrativas.

## Smart contracts

Los contratos deben seguir, como mínimo:

- OpenZeppelin para componentes estándar y controles de acceso.
- Checks-effects-interactions cuando aplique.
- Pruebas unitarias para permisos, emisión, revocación y estados inválidos.
- Cobertura de casos de abuso y llamadas no autorizadas.
- Sin llaves privadas hardcodeadas.
- Despliegues en testnet antes de cualquier uso en mainnet.

## Manejo de secretos

Use variables de entorno locales y GitHub Secrets en CI/CD. El archivo `.env.example` documenta únicamente nombres de variables y valores no sensibles.

## Reporte de vulnerabilidades

No publique secretos, datos personales ni exploits activos en issues públicos. Para una eventual versión pública del producto deberá configurarse un canal privado de divulgación responsable mediante GitHub Security Advisories.
