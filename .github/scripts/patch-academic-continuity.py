from pathlib import Path

path = Path("README.md")
text = path.read_text(encoding="utf-8")

text = text.replace("| **Piernyela Carrasco** | **A00116415** |", "| **Pieranyela José Carrasco Rodríguez** | **A00116415** |")
text = text.replace("| **Jenrry Monegro** | **A00116621** |", "| **Jenrry Monegro Rosario** | **A00116621** |")

start = text.index("## 🧭 Continuidad académica")
end = text.index("\n---\n\n## 🔴 Problema", start)

replacement = '''## 🧭 Continuidad académica

La continuidad académica de CertiChain se documenta mediante relaciones verificables entre **estudiantes**, **profesores** y la **trayectoria institucional ITLA → UNAPEC**. Estas relaciones son formativas y cronológicas; no implican dependencia técnica ni una relación de secuela entre las aplicaciones.

### 👥 Continuidad por estudiante

CertiChain comparte dos integrantes con [**CineGest**](https://github.com/Jairo0811/CineGest), desarrollado posteriormente en UNAPEC durante el período **Enero - Abril 2026**.

| Estudiante | Matrícula | Proyecto de origen | Continuidad posterior |
|---|---|---|---|
| **Pieranyela José Carrasco Rodríguez** | **A00116415** | **CertiChain** — ISO-915 — Septiembre - Diciembre 2025 | **CineGest** — ISO-610 — Enero - Abril 2026 |
| **Jenrry Monegro Rosario** | **A00116621** | **CertiChain** — ISO-915 — Septiembre - Diciembre 2025 | **CineGest** — ISO-610 — Enero - Abril 2026 |

Esta coincidencia evidencia continuidad por compañeros de equipo en dos proyectos académicos consecutivos de Ingeniería de Software en UNAPEC.

### 👨‍🏫 Continuidad por profesor

CertiChain forma parte de una secuencia de tres asignaturas impartidas por el **Ing. Pedro José Ramirez Rodriguez** dentro de la colección académica documentada.

| Orden | Asignatura | Proyecto | Período | Profesor |
|---:|---|---|---|---|
| 1 | Bases de Datos 1 (**INF-164**) | [**NutriFlow**](https://github.com/Jairo0811/NutriFlow) | Mayo - Agosto 2024 | **Ing. Pedro José Ramirez Rodriguez** |
| 2 | Fundamentos de Seguridad de Software (**ISO-915**) | **CertiChain** | Septiembre - Diciembre 2025 | **Ing. Pedro José Ramirez Rodriguez** |
| 3 | Desarrollo de Software con Tecnología Propietaria 2 (**ISO-710**) | [**Digital Sanctuary**](https://github.com/Jairo0811/DigitalSanctuary) | Mayo - Agosto 2026 | **Ing. Pedro José Ramirez Rodriguez** |

Esta continuidad docente muestra una evolución formativa desde fundamentos de datos, pasando por seguridad de software, hasta desarrollo con tecnología propietaria. Cada repositorio conserva un dominio, alcance y arquitectura independientes.

### 🏫 Cruce institucional ITLA → UNAPEC

CertiChain también documenta un cruce institucional entre **ITLA** y **UNAPEC**. Tres integrantes del equipo académico original cuentan con trayectoria previa en ITLA y posteriormente convergieron en este proyecto en UNAPEC.

| Integrante | Matrícula UNAPEC | Matrícula ITLA | Relación documentada |
|---|---|---|---|
| **Francis Jairo Matías Rosario** | **A00115261** | **2015-2984** | ITLA → UNAPEC |
| **Jenrry Monegro Rosario** | **A00116621** | **2019-8690** | ITLA → UNAPEC; coincidencia posterior en CertiChain |
| **Pieranyela José Carrasco Rodríguez** | **A00116415** | **2019-8767** | ITLA → UNAPEC; coincidencia posterior en CertiChain |

Este cruce se documenta como **trayectoria institucional compartida**, no como continuidad por asignaturas cursadas conjuntamente en ITLA. Con la información disponible no se establece que Francis Jairo Matías Rosario haya coincidido en una misma materia de ITLA con Jenrry Monegro Rosario o Pieranyela José Carrasco Rodríguez.

La convergencia académica confirmada entre estos integrantes ocurre en **CertiChain (ISO-915, Septiembre - Diciembre 2025)** en UNAPEC.
'''

text = text[:start] + replacement + text[end:]
path.write_text(text, encoding="utf-8")
