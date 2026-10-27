---
description: SDD · Redacta la spec desde la HU y decisiones.md (uso - /sdd-spec 001-nombre HU-001)
agent: plan
---

NO escribas código en ningún momento. Lee `docs/constitution.md`, `MEMORY.md`, `docs/historias/$2.md` y `specs/$1/decisiones.md`, y usa la skill SDD.

Carpeta de la spec: `specs/$1/`

Genera `specs/$1/spec.md` siguiendo la plantilla de la skill SDD, con los requisitos en EARS y `Estado: borrador`.

Si falta información necesaria, no inventes requisitos ni decisiones. Marca lo que no esté resuelto como `[NECESITA ACLARACIÓN]`.

## Qué haces

1. Lees la historia de usuario y las decisiones documentadas.
2. Identificas los comportamientos esperados y redactas los requisitos funcionales en formato EARS.
3. Compruebas que cada escenario de la historia de usuario esté cubierto por al menos un requisito funcional.
4. Aseguras que cada requisito funcional termine con `Origen:` e identifique el escenario o la decisión de la que procede.
5. Incluyes únicamente requisitos respaldados por la historia de usuario o por decisiones vigentes.
6. Ignoras las decisiones que hayan sido revocadas por decisiones posteriores.
7. Marcas como `[NECESITA ACLARACIÓN]` cualquier aspecto sin resolver en la historia de usuario o en `decisiones.md`, sin decidir por tu cuenta.
8. Mantienes la especificación en el nivel del QUÉ y el POR QUÉ, sin introducir detalles de implementación.

## Qué no haces

- No escribes código ni pruebas.
- No modificas `decisiones.md` ni `MEMORY.md`.
- No generas ni modificas archivos distintos de `specs/$1/spec.md`.
- No añades decisiones técnicas ni requisitos que no estén respaldados por las fuentes.
- No incluyes stack tecnológico, arquitectura, formatos de almacenamiento ni nombres de archivos.
- No haces preguntas: registra los puntos pendientes como `[NECESITA ACLARACIÓN]`.
- No marcas la especificación como aprobada; su estado inicial siempre es `Estado: borrador`.

## Reglas

- Respeta la constitución y la plantilla de la skill SDD.
- No asumas comportamientos que no estén definidos.
- Conserva la trazabilidad entre cada requisito funcional y su origen.
- Antes de terminar, verifica que todos los escenarios de la historia de usuario estén cubiertos y que los aspectos no resueltos estén identificados.
- Escribe únicamente `specs/$1/spec.md` y termina.