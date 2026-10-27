---
name: sdd
description: Úsala siempre que trabajes con Spec-Driven Development en este proyecto: redactar, revisar o cambiar decisiones, specs, planes y tareas, o implementar y validar tareas de una spec.
---

# Spec-Driven Development (SDD)

## Flujo y responsabilidades

Constitución → grill-me → Spec → Plan y tareas → Implementación → Cambio.

| Fase | Responsable | Escribe únicamente |
|---|---|---|
| Decisiones | skill `grill-me` | `specs/NNN-nombre/decisiones.md` |
| Spec | agente `sdd-spec` | `specs/NNN-nombre/spec.md` |
| Plan y tareas | agente `sdd-plan` | `specs/NNN-nombre/plan.md` y `tasks.md` |
| Implementación | agente `sdd-implement` | Código, pruebas y estado de las tareas |

- Nunca avances a la siguiente fase sin aprobación explícita del usuario.
- La constitución establece los principios innegociables del proyecto.
- Las historias de usuario y las decisiones aprobadas definen los requisitos funcionales.
- La spec define qué debe hacer el sistema y por qué.
- El plan define cómo se implementará.
- Las tareas dividen el trabajo en unidades verificables.
- Si un requisito no está definido en la historia de usuario, en una decisión aprobada o en la spec activa, no lo inventes.
- Si falta una decisión, márcala como `[NECESITA ACLARACIÓN]` durante la elaboración de la spec. Al planificar o implementar, detente y solicita aclaración cuando esa decisión sea necesaria.
- Los cambios de requisitos deben reflejarse primero en la spec, después en el plan y las tareas, y finalmente en el código.
- Cada spec vive en `specs/NNN-nombre/`.
- `decisiones.md` se modifica únicamente para añadir, al final y con numeración consecutiva, una decisión expresamente indicada por el usuario para resolver una duda abierta.
- Al terminar cada fase o tarea, actualiza en `MEMORY.md` únicamente las secciones `Estado actual` y `Próximos pasos`. Indica el siguiente agente o fase, sin copiar decisiones ni contenido de la spec.

## Alcance de la skill

Esta skill define el proceso de desarrollo, no las reglas funcionales de la aplicación.

- No establece reglas de negocio ni comportamientos funcionales por iniciativa propia.
- No decide cómo debe comportarse una funcionalidad concreta.
- No añade requisitos funcionales a las historias de usuario.
- No sustituye la constitución ni las decisiones aprobadas.
- No permite implementar funcionalidades por considerarlas convenientes si no están definidas.
- No establece tecnologías, dependencias ni soluciones de arquitectura por iniciativa propia.

Los valores y comportamientos funcionales deben proceder de la historia de usuario correspondiente o de una decisión aprobada.

## Plantilla de spec (`spec.md`)

```markdown
# Spec NNN — <Nombre>

Estado: borrador | aprobada | implementada
HU de origen: docs/historias/HU-00N.md

## Contexto y objetivo

## Usuarios

## Historias de usuario

## Definiciones (Solo si existen términos que puedan interpretarse de varias formas.)

## Requisitos funcionales

## Requisitos no funcionales

## Casos límite

## Fuera de alcance

## Criterios de finalización

## Dudas abiertas
- [NECESITA ACLARACIÓN] <duda>