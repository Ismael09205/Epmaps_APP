# Tareas — Spec 001: Identificación del técnico

Estado: borrador
Plan: specs/001-identificacion-tecnico/plan.md

Orden por dependencias. Cada tarea se verifica antes de pasar a la siguiente. Las tareas que instalan dependencias o eliminan archivos requieren autorización explícita previa (constitución 12).

## T1 — Preparar entorno de pruebas y dependencia de persistencia

- **Acción:** instalar `jest`, `jest-expo` y `@types/jest` como devDependencies, añadir el preset de Jest en `jest.config.js` y ejecutar un test trivial de humo para comprobar que `npx jest` funciona. Instalar `expo-secure-store` con `npx expo install`. **[REQUIERE AUTORIZACIÓN]**
- **Archivos:** `package.json`, `jest.config.js`.
- **RF:** RNF-02, RNF-03 (habilita).
- **Hecho cuando:** `npx jest` ejecuta y aprueba el test de humo, `npx tsc --noEmit` no muestra errores nuevos y `expo-secure-store` aparece en dependencias.
- **Verificación:** `npx jest`, `npx tsc --noEmit`.

## T2 — Constante de credenciales quemadas

- **Acción:** crear `src/domain/auth.ts` con el tipo `Technician`, la constante `TECHNICIANS` (código, clave, nombre, apellido de prueba) y el tipo `CredentialCheck`, sin lógica todavía.
- **Archivos:** `src/domain/auth.ts`.
- **RF:** RF-01 (base), RF-05.
- **Hecho cuando:** el archivo compila y exporta los tipos y la constante con al menos un técnico de prueba.
- **Verificación:** `npx tsc --noEmit`.

## T3 — Lógica pura de validación de credenciales

- **Acción:** implementar `checkCredentials` en `src/domain/auth.ts` (recorte de bordes, estados `empty`/`invalid`/`ok`, sin clave en el resultado) y sus pruebas en `src/domain/__tests__/auth.test.ts` cubriendo todos los casos del plan (sección 9).
- **Archivos:** `src/domain/auth.ts`, `src/domain/__tests__/auth.test.ts`.
- **RF:** RF-01, RF-02 (validación), RF-05, RF-10.
- **Hecho cuando:** todas las pruebas de `auth.test.ts` pasan, incluidas: espacios de bordes ignorados, mayúsculas distintas rechazadas, espacios intermedios conservados, vacíos detectados y resultado sin clave.
- **Verificación:** `npx jest src/domain`.

## T4 — Módulo de persistencia de la sesión

- **Acción:** crear `src/storage/session.ts` con `saveSession`, `loadSession` y `clearSession` sobre expo-secure-store, y sus pruebas con el módulo simulado (`src/storage/__tests__/session.test.ts`): guardado y carga, null sin sesión, null con JSON corrupto y `clearSession` que solo borra la propia clave.
- **Archivos:** `src/storage/session.ts`, `src/storage/__tests__/session.test.ts`.
- **RF:** RF-04, RF-05 (persistencia), RF-08, RNF-02, RNF-03.
- **Hecho cuando:** las pruebas pasan y el módulo no exporta ninguna función que toque claves distintas a la de la sesión.
- **Verificación:** `npx jest src/storage`.

## T5 — Contexto de sesión

- **Acción:** crear `src/auth/session-context.tsx` con `SessionProvider`, `useSession` y los flujos `signIn`/`signOut` del plan (sección 5), más sus pruebas (`src/auth/__tests__/session-context.test.tsx`): signIn correcto persiste, vacío e inválido no persisten, carga inicial con sesión existente autentica, signOut limpia solo la sesión.
- **Archivos:** `src/auth/session-context.tsx`, `src/auth/__tests__/session-context.test.tsx`.
- **RF:** RF-02, RF-03, RF-04, RF-06, RF-07 (lógica), RF-08 (lógica), RF-09.
- **Hecho cuando:** las pruebas pasan y el contexto expone `technician.employeeCode` sin exponer la clave.
- **Verificación:** `npx jest src/auth`.

## T6 — Pantalla de identificación

- **Acción:** crear `src/app/login.tsx` con los dos campos (etiquetas visibles, clave oculta), el mensaje de dato obligatorio, el mensaje de credenciales inválidas reintentable y la navegación al autenticarse, consumiendo `useSession`. **[REQUIERE AUTORIZACIÓN previa para reemplazar contenido de plantilla]** sin tocar otras pantallas.
- **Archivos:** `src/app/login.tsx`.
- **RF:** RF-01, RF-03, RF-10.
- **Hecho cuando:** en Expo Go se puede identificar un técnico válido, enviar con campos vacíos mostrando el mensaje de obligatoriedad, fallar con credenciales inválidas mostrando el mensaje genérico y reintentar de inmediato.
- **Verificación:** `npx tsc --noEmit` y lista manual de `rn-conventions` (legibilidad, adaptación a pantalla, estados, táctiles cómodos) en Expo Go.

## T7 — Navegación por sesión en el layout

- **Acción:** modificar `src/app/_layout.tsx` para envolver con `SessionProvider` y redirigir según `status` (loading, unauthenticated a `/login`, authenticated a `/`), tal como define la sección 6 del plan.
- **Archivos:** `src/app/_layout.tsx`.
- **RF:** RF-06.
- **Hecho cuando:** abriendo la app sin sesión se ve `/login`, y con sesión persistida se entra directo al área de trabajo sin identificarse.
- **Verificación:** `npx tsc --noEmit` y prueba manual en Expo Go incluyendo reinicio de la app.

## T8 — Pantalla principal con cierre de sesión

- **Acción:** modificar `src/app/index.tsx` para mostrar nombre y apellido del técnico y una acción visible de cerrar sesión en la cabecera que llama a `signOut` y vuelve al login. **[REQUIERE AUTORIZACIÓN] reemplaza contenido de plantilla**; tratar la eliminación de `explore.tsx` (contenido de plantilla ajeno) solo si autorizas.
- **Archivos:** `src/app/index.tsx`, `src/app/explore.tsx` (solo si autorizas).
- **RF:** RF-07, RF-08 (efecto visible).
- **Hecho cuando:** en Expo Go se ve el nombre del técnico, el cerrar sesión vuelve al login, y una lectura o dato local existente no se ve afectado tras cerrar sesión.
- **Verificación:** `npx tsc --noEmit` y lista manual de `rn-conventions` en Expo Go.

## T9 — Verificación integral

- **Acción:** ejecutar la suite completa, el chequeo de tipos y recorrer manualmente en Expo Go los escenarios del plan (sección 11): identificación correcta, mensajes de vacío e inválidos, sesión tras reinicio, cierre de sesión sin afectar otros datos locales y uso sin conexión.
- **Archivos:** ninguno (salvo correcciones que se indiquen).
- **RF:** todos (RF-01 a RF-10, RNF-01 a RNF-03).
- **Hecho cuando:** `npx jest` en verde, `npx tsc --noEmit` sin errores y los cinco escenarios manuales pasan, informando resultado por escenario.
- **Verificación:** `npx jest`, `npx tsc --noEmit`, manual en Expo Go.

## Resumen

- 9 tareas. Ninguna supera los 30 minutos estimados.
- T1 y T4 dependen de autorización para instalar dependencias; T6 y T8 dependen de autorización para reemplazar contenido de la plantilla.
- Todas están en el orden de dependencias: dominio (T2, T3) antes que persistencia (T4), contexto (T5) antes que pantallas (T6, T7, T8), e integral al final (T9).
