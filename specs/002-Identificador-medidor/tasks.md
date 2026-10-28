# Tareas — Spec 002: Identificación del medidor

Estado: completada
Plan: specs/002-Identificador-medidor/plan.md (aprobado)

Orden por dependencias. Cada tarea se verifica antes de pasar a la siguiente. La instalación de T1 está autorizada en D-07 (constitución 12).

## T1 — Instalar la librería de máscara de entrada

- **Estado:** completada.
- **Acción:** instalar `react-native-mask-text` con `npx expo install react-native-mask-text`, según D-06 y D-07. **[AUTORIZACIÓN REGISTRADA EN D-07]**
- **Archivos:** `package.json`, `package-lock.json`.
- **RF:** habilita RF-02.
- **Hecho cuando:** la dependencia aparece en `package.json`, `npx tsc --noEmit` no muestra errores nuevos y `npx jest` sigue en verde.
- **Verificación:** `npx tsc --noEmit`, `npx jest`.

## T2 — Lógica pura de normalización y clasificación del código

- **Estado:** completada.
- **Acción:** crear `src/domain/meter-code.ts` con `normalizeMeterCode` y `classifyMeterCode` según la sección 3 del plan, y sus pruebas en `src/domain/__tests__/meter-code.test.ts` según la sección 8 del plan.
- **Archivos:** `src/domain/meter-code.ts`, `src/domain/__tests__/meter-code.test.ts`.
- **RF:** RF-03, RF-04 (lógica), RF-05 (lógica), RF-06 (lógica), RNF-02, RNF-04.
- **Hecho cuando:** `npx jest src/domain` aprueba los casos del plan: válido `MED-123456`; válidos con minúsculas y espacios de bordes; incompletos vacío, `MED-123` y `med-123`; inválidos `MED-12345A`, `MED-1234567`, `MED123456`, `MED-12A456` y espacio intermedio.
- **Verificación:** `npx jest src/domain`.

## T3 — Pantalla de identificación del medidor

- **Estado:** completada; validación manual confirmada por el usuario.
- **Acción:** crear `src/app/medidor.tsx` con etiqueta visible, campo con prefijo `MED-` automático y hasta seis dígitos con teclado numérico (D-08, D-12, D-14), ignorar letras y dígitos extra sin error visible, comunicar los estados incompleto y válido con texto sin mostrar `Continuar` (D-13), y conservar el borrador en memoria a nivel de módulo (RF-09). Añadir la ruta al grupo autenticado en `src/app/_layout.tsx`.
- **Archivos:** `src/app/medidor.tsx`, `src/app/_layout.tsx`.
- **RF:** RF-01, RF-02, RF-04, RF-05, RF-06, RF-07, RF-09, RNF-01, RNF-03.
- **Hecho cuando:** en Expo Go se comprueba que solo dígitos forman `MED-123456`, que letras, el tecleo manual del prefijo y los dígitos posteriores al sexto se ignoran sin error; que vacío y a medio escribir no muestran estado válido; que el código válido comunica su estado sin presentar `Continuar`; que al salir y volver se conserva el código escrito; que tras cerrar la app el campo empieza vacío; y que `/medidor` requiere una sesión autenticada. Los textos inválidos arbitrarios se verifican en T2.
- **Verificación:** `npx tsc --noEmit` y lista manual de `rn-conventions` (áreas seguras, teclado sin tapar el formulario, textos en español, táctiles de 44 puntos, estados sin depender solo del color, sin desbordamientos).

## T4 — Acceso desde la pantalla principal

- **Estado:** completada; validación manual confirmada por el usuario.
- **Acción:** modificar `src/app/index.tsx` para añadir la acción visible `Identificar medidor` que navega a `/medidor`, sin alterar el nombre del técnico ni el cierre de sesión de la spec 001.
- **Archivos:** `src/app/index.tsx`.
- **RF:** RF-08.
- **Hecho cuando:** en Expo Go se llega desde la pantalla principal a la identificación del medidor con un toque, el objetivo táctil mide al menos 44 puntos y la acción tiene etiqueta de accesibilidad.
- **Verificación:** `npx tsc --noEmit` y lista manual de `rn-conventions` en Expo Go.

## T5 — Verificación integral

- **Estado:** completada; automatizadas y validación manual confirmadas.
- **Acción:** ejecutar la suite completa, el chequeo de tipos y recorrer manualmente en Expo Go los escenarios de la sección 10 del plan, incluido el uso con el dispositivo sin conexión.
- **Archivos:** ninguno (salvo correcciones que se indiquen).
- **RF:** todos (RF-01 a RF-09, RNF-01 a RNF-04).
- **Hecho cuando:** `npx jest` en verde, `npx tsc --noEmit` sin errores y todos los escenarios manuales pasan, informando el resultado por escenario, incluidos el campo estricto, el estado válido sin `Continuar` y la protección de `/medidor`.
- **Verificación:** `npx jest`, `npx tsc --noEmit`, manual en Expo Go.

## Resumen

- 5 tareas. Ninguna supera los 30 minutos estimados.
- T1 solo requiere ejecutar una instalación ya autorizada en D-07; no hay otras tareas que dependan de autorización extra.
- Orden de dependencias: dependencia (T1) y lógica (T2) antes que la pantalla (T3), pantalla antes que la entrada desde el inicio (T4), verificación integral al final (T5).
- HU-002 no muestra `Continuar`; HU-003 incorporará esa acción junto con su destino real (D-13).
