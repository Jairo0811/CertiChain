from pathlib import Path

path = Path("README.md")
text = path.read_text(encoding="utf-8")

text = text.replace(
    "Tres integrantes del equipo académico original cuentan con trayectoria previa en ITLA y posteriormente convergieron en este proyecto en UNAPEC.",
    "Cuatro integrantes del equipo académico original cuentan con trayectoria previa en ITLA y posteriormente convergieron en este proyecto en UNAPEC.",
)

old_rows = """| **Francis Jairo Matías Rosario** | **A00115261** | **2015-2984** | ITLA → UNAPEC |\n| **Jenrry Monegro Rosario** | **A00116621** | **2019-8690** | ITLA → UNAPEC; coincidencia posterior en CertiChain |\n| **Pieranyela José Carrasco Rodríguez** | **A00116415** | **2019-8767** | ITLA → UNAPEC; coincidencia posterior en CertiChain |"""
new_rows = """| **Francis Jairo Matías Rosario** | **A00115261** | **2015-2984** | ITLA → UNAPEC |\n| **Enmanuel Alberto Arias de Jesus** | **A00117358** | **2019-7415** | ITLA → UNAPEC; coincidencia posterior en CertiChain |\n| **Jenrry Monegro Rosario** | **A00116621** | **2019-8690** | ITLA → UNAPEC; coincidencia posterior en CertiChain |\n| **Pieranyela José Carrasco Rodríguez** | **A00116415** | **2019-8767** | ITLA → UNAPEC; coincidencia posterior en CertiChain |"""
text = text.replace(old_rows, new_rows)

text = text.replace(
    "Con la información disponible no se establece que Francis Jairo Matías Rosario haya coincidido en una misma materia de ITLA con Jenrry Monegro Rosario o Pieranyela José Carrasco Rodríguez.",
    "Con la información disponible no se establece que Francis Jairo Matías Rosario haya coincidido en una misma materia de ITLA con Enmanuel Alberto Arias de Jesus, Jenrry Monegro Rosario o Pieranyela José Carrasco Rodríguez.",
)

path.write_text(text, encoding="utf-8")
