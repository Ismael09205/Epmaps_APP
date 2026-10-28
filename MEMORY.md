# MEMORY.md - Medidor_EPMAPS
Estado del trabajo entre sesiones. Máximo ~70 líneas.

## Estado actual
- Spec 001 `specs/001-identificacion-tecnico/`: decisiones (D-01 a D-11), spec (aprobada), plan y tareas (borrador); pendientes sus aprobaciones y las autorizaciones T1, T6 y T8.
- Spec 002 `specs/002-Identificador-medidor/`: implementación completada. T1-T5, pruebas automatizadas y escenarios manuales confirmados.
- HU-003: spec, plan y tasks aprobados. T1-T4 y T7 completadas; 7 suites/77 pruebas y TypeScript pasan. T5-T6 implementadas con validación manual pendiente. T8 bloqueada: el endpoint aprobado devolvió HTTP 404 en consulta de prueba.
- HU-004: implementada sin SDD (a pedido del usuario) con expo-sqlite en `src/storage/readings.ts`; 10 suites/113 pruebas y TypeScript pasan. Validación manual en Expo Go pendiente.
- HU-005: implementada sin SDD con Valibot y migración SQLite v2 (autorizada); 10 suites/132 pruebas y TypeScript pasan. Validación manual pendiente.
- HU-006: implementada sin SDD con expo-camera, expo-file-system y migración SQLite v3 (autorizada); 11 suites/149 pruebas y TypeScript pasan. Validación manual pendiente.
- HU-007: implementada sin SDD; 11 suites/158 pruebas y TypeScript pasan. Validación manual pendiente.
- HU-008: implementada sin SDD con SQLite (migración v4); 12 suites/170 pruebas y TypeScript pasan. Validación manual pendiente.
- HU-009: implementada sin SDD con TanStack Query (migración v5, UUID por registro); 15 suites/186 pruebas y TypeScript pasan. Validación manual pendiente.
- HU-010: implementada sin SDD (migración v6, un registro por medidor y mes); 15 suites/192 pruebas y TypeScript pasan. Validación manual pendiente.

## Decisiones (y por que)
- Ver `specs/001-identificacion-tecnico/decisiones.md` (D-01 a D-11).

## Aprendizaje y errores a evitar
- El repo usa rutas en `src/app/` (plantilla Expo con tabs); Jest no estaba instalado.

## Proximos pasos
- Confirmar la ruta/recurso MockAPI disponible y completar el click-through Expo Go para cerrar T5, T6 y T8 de HU-003.
- HU-004: probar en Expo Go el registro con y sin conexión y la verificación al reconectar.
- HU-005: probar en Expo Go los tres estados y que la migración conserve las lecturas de HU-004.
- HU-006: probar en Expo Go el consumo elevado (casilla, permiso de cámara, foto persistente) y la migración v3.
- HU-007: probar en Expo Go foto obligatoria (dañado/elevado), opcional (resto) y permiso de cámara denegado.
- HU-008: probar en Expo Go cerrar la app a mitad del registro, continuar (caché vigente, vencida con y sin conexión, sin ficha) y descartar.
- HU-009: probar en Expo Go el envío a /logs, corte de señal durante el envío, franja de conexión y contador. La idempotencia por `readingId` depende del servidor.
- HU-010: probar en Expo Go «Corregir» (bloqueo durante el envío y tras enviar, reemplazo de foto) y el rechazo de un segundo registro del mes.
- Pendiente: aprobación de plan/tasks 001 y autorización de sus tareas T1, T6 y T8.
