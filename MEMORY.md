# MEMORY.md - Medidor_EPMAPS
Estado del trabajo entre sesiones. Máximo ~70 líneas.

## Estado actual
- Spec 001 `specs/001-identificacion-tecnico/`: decisiones (D-01 a D-11), spec (aprobada), plan y tareas (borrador) generados.
- Pendiente la aprobación del plan y de las tareas que requieren autorización (T1, T6, T8).
- Spec 002 `specs/002-Identificador-medidor/`: decisiones (D-01 a D-08) aprobadas por entrevista; falta redactar la spec.

## Decisiones (y por que)
- Ver `specs/001-identificacion-tecnico/decisiones.md` (D-01 a D-11).

## Aprendizaje y errores a evitar
- El repo usa rutas en `src/app/` (plantilla Expo con tabs); Jest no estaba instalado.

## Proximos pasos
- Aprobar plan/tasks 001 y autorizar T1 (instalar Jest y expo-secure-store), T6 y T8 (reemplazar contenido de plantilla).
- Redactar la spec 002 (agente `sdd-spec`) a partir de `specs/002-Identificador-medidor/decisiones.md`; la instalación de `react-native-mask-text` queda para su tarea, con autorización registrada en D-07.
