---
description: SDD · Busca solo contradicciones y escenarios sin RF (solo detecta, no resuelve)
agent: plan
---
Revisa specs/$1/spec.md como un QA. Usa la skill sdd. Lee también
docs/constitution.md, specs/$1/decisiones.md y la HU indicada en la spec.

Busca SOLO esto:
1. Contradicciones entre requisitos, o entre un requisito y una decisión de
   decisiones.md.
2. Escenarios de la HU que ningún RF cubra.
3. Conflictos con docs/constitution.md.

Ignora las ambigüedades menores y los casos límite poco probables. Si algo no
cambia lo que el usuario ve o hace, no lo listes.

No propongas soluciones y no modifiques ningún archivo. Formato: lista
numerada por sección, máximo 10 puntos en total, cada uno en una o dos líneas
y citando los RF o las decisiones implicados. Si no hay nada, responde
"Sin hallazgos".