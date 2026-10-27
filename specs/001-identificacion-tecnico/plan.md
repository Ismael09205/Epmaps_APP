# Plan — Spec 001: Identificación del técnico

Estado: borrador
Spec: specs/001-identificacion-tecnico/spec.md (aprobada)
Decisiones aplicadas: D-01 a D-11 de specs/001-identificacion-tecnico/decisiones.md

## 1. Alcance y observaciones previas

Implementa la HU-001 completa: identificación con credenciales quemadas, sesión persistente entre reinicios, arranque con navegación según sesión, y cierre de sesión que no toca otros datos locales.

Hechos del repositorio inspeccionados antes de planificar:

- Las rutas viven en `src/app/` (no en `app/`): `_layout.tsx`, `index.tsx`, `explore.tsx` con plantilla de tabs.
- **Jest no está instalado** en `package.json`. La constitución (10) y AGENTS.md exigen `npx jest`; la tarea 1 incluye su instalación, que requiere tu autorización explícita (constitución 12).
- `expo-secure-store` no está instalado; su instalación ya fue anticipada en D-08 y también requiere autorización.
- El estado actual de la app es una plantilla de ejemplo (tabs "index" y "explore"). Este plan la convierte en la estructura mínima de la spec: pantalla de identificación y pantalla principal. Reemplazar pantallas de plantilla será validado contigo en la tarea correspondiente (AGENTS.md prohíbe reemplazar archivos sin autorización).

## 2. Archivos que se crean o modifican

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `package.json` | modificar | añadir devDependencies de Jest y la dependencia `expo-secure-store` (tarea 1, con autorización) |
| `jest.config.js` | crear | configuración mínima de Jest con preset `jest-expo` |
| `src/domain/auth.ts` | crear | constantes de credenciales quemadas y lógica pura de validación (D-01) |
| `src/domain/__tests__/auth.test.ts` | crear | pruebas de la lógica de validación |
| `src/storage/session.ts` | crear | guardar, leer y borrar la sesión con expo-secure-store (D-02, D-07, D-08) |
| `src/storage/__tests__/session.test.ts` | crear | pruebas de persistencia con expo-secure-store simulado |
| `src/auth/session-context.tsx` | crear | contexto de sesión: estado en memoria, carga inicial, signIn, signOut (D-05, D-08) |
| `src/auth/__tests__/session-context.test.tsx` | crear | pruebas del contexto (flujo completo con storage simulado) |
| `src/app/_layout.tsx` | modificar | envolver la app con el proveedor de sesión y redirigir según la sesión cargada (D-05) |
| `src/app/login.tsx` | crear | pantalla de identificación: campos, validación de vacíos, mensaje de credenciales inválidas (RF-01, RF-03, RF-10) |
| `src/app/index.tsx` | modificar | pantalla principal con la acción visible de cerrar sesión y nombre del técnico (RF-07, D-06) |
| `src/app/explore.tsx` | eliminar o vaciar | es contenido de plantilla ajeno a la spec; se elimina solo con tu autorización explícica |

No se crean más archivos: sin capas de servicios, sin repositorios, sin store global. La lógica vive en `src/domain` (puramente testeable), la persistencia en `src/storage` (nombre ya previsto por AGENTS.md) y el estado de sesión en un único contexto (D-08), que es la mínima que cubre RF-04, RF-06 y RF-09.

## 3. Lógica pura (src/domain/auth.ts)

```text
CONSTANTE TECHNICIANS: lista de { employeeCode, password, name, surname }
  (credenciales de prueba quemadas, D-01; incluye nombre y apellido, D-03)

TIPO CredentialCheck =
  | { status: "ok", technician: { employeeCode, name, surname } }
  | { status: "empty" }      // código o clave vacíos tras recortar bordes, D-10
  | { status: "invalid" }    // no coincide con ninguna credencial, D-04

FUNCIÓN PURE checkCredentials(code: string, password: string): CredentialCheck
  1. recortar espacios al inicio y al final de code y de password, D-11
  2. SI code o password resultan vacíos -> { status: "empty" }, D-10
  3. buscar en TECHNICIANS un técnico con employeeCode y password iguales
     exactamente (distinción de mayúsculas, D-11)
  4. SI coincide -> { status: "ok", technician } SIN incluir la clave, D-03, RF-05
  5. SI no -> { status: "invalid" }, D-04
```

La función devuelve `"empty"` e `"invalid"` como estados distintos para que la pantalla muestre mensajes distintos (dato obligatorio vs credenciales inválidas) sin que la lógica conozca la interfaz (constitución 9).

## 4. Estrategia de persistencia (src/storage/session.ts)

expo-secure-store, según D-08. Se persiste un solo valor bajo una clave fija de la app, con el JSON de los datos del técnico: código de empleado, nombre y apellido. La clave (contraseña) nunca se escribe ni se lee (RF-05, RNF-02).

```text
FUNCIÓN saveSession(technician): guarda JSON.stringify(technician)
FUNCIÓN loadSession(): devuelve technician | null
  (null si la clave no existe o el JSON no es válido)
FUNCIÓN clearSession(): elimina únicamente la clave de la sesión, D-07
```

`clearSession` no conoce ninguna otra clave del almacenamiento, por lo que no puede borrar lecturas, fotos u otros datos (RF-08). Cuando existan otros módulos de almacenamiento tendrán sus propias claves; este módulo solo toca la suya.

## 5. Estado de sesión (src/auth/session-context.tsx)

```text
CONTEXTO SessionProvider con estado:
  status: "loading" | "authenticated" | "unauthenticated"
  technician: Technician | null   // solo código, nombre y apellido

AL MONTAR: loadSession()
  si hay sesión -> status authenticated + technician (RF-04, RF-06, D-05)
  si no -> status unauthenticated

signIn(code, password):
  checkCredentials()
  si "empty" o "invalid" -> retorna ese estado SIN persistir (RF-10, RF-03)
  si "ok" -> saveSession(technician) y status authenticated (RF-02)

signOut():
  clearSession() -> status unauthenticated, technician null (RF-07, RF-08)
  no llama a ningún otro almacenamiento
```

El contexto expone `technician.employeeCode` disponible para futuras historias (RF-09, D-09) sin añadir nada más.

## 6. Navegación (src/app/_layout.tsx)

Expo Router. El layout envuelve con `SessionProvider` y, según `status`:

- `loading`: pantalla vacía o indicador mientras se carga la sesión (evita parpadeo a la pantalla de identificación).
- `unauthenticated`: redirige a `/login`.
- `authenticated`: muestra la ruta principal (`/`).

Esto cubre RF-06 y D-05 sin lógica de navegación repartida en varias pantallas.

## 7. Comportamiento de la interfaz

**Pantalla de identificación (`src/app/login.tsx`), RF-01, RF-03, RF-10:**

- Dos campos: código de empleado y clave, con etiquetas visibles y teclado adecuado (la clave oculta el texto).
- Al enviar: llama a `signIn`; si el estado es `empty`, muestra "El código de empleado y la clave son obligatorios" junto al campo; si es `invalid`, muestra "Credenciales inválidas" sin indicar qué campo falló, y permite reintentar de inmediato sin bloquear el botón (D-04).
- Al autenticarse, navega al área de trabajo.
- Diseño sobrio y legible para uso en campo: texto grande, contraste suficiente, área táctil cómoda, sin adornos (constitución 7, antislop).

**Pantalla principal (`src/app/index.tsx`), RF-07, D-06:**

- Muestra el nombre y apellido del técnico identificado (visible, no escondido).
- Acción de cerrar sesión visible en la cabecera de la pantalla, de alcance directo sin menús intermedios (D-06).
- Al cerrar sesión, vuelve a `/login` (RF-08).

Contenido futuro de esta pantalla (lecturas, medidores) pertenece a otras HU; aquí solo se sitúa la acción de cierre y la identidad visible, sin inventar funcionalidad.

## 8. Decisiones técnicas y alternativas descartadas

| Decisión | Fundamento | Alternativa descartada |
|---|---|---|
| Credenciales como constante en `src/domain` | D-01; lógica pura testeable sin dependencias | fichero JSON externo (complejidad sin beneficio, la lista es fija) |
| Validación exacta con recorte de bordes | D-01, D-11 | hash de contraseñas (CA-03 permite datos quemados; sin backend no aporta) |
| expo-secure-store para la sesión | D-08; constitución 11 | AsyncStorage (menos seguro para datos personales) y SecureStore para todo el almacenamiento (no sirve para fotos o datos grandes, y la spec solo requiere la sesión) |
| Un único contexto de sesión | D-08; simplicidad primero | biblioteca de estado global (dependencia nueva sin necesidad) |
| Redirección en el layout raíz | D-05; un solo punto de decisión | guard en cada pantalla (más puntos de fallo) |
| `saveSession` guarda solo datos del técnico | D-03, RF-05, RNF-02 | guardar la credencial completa (viola RNF-02) |
| Jest con preset `jest-expo` | constitución 10; estándar Expo | otro runner (AGENTS.md exige `npx jest`) |

## 9. Estrategia de pruebas con Jest

- `src/domain/__tests__/auth.test.ts`: credencial válida (con y sin espacios en los bordes), mayúsculas diferentes rechazadas, espacios intermedios conservados, código vacío, clave vacío, ambos vacíos, credencial inexistente, y que el resultado nunca incluye la clave.
- `src/storage/__tests__/session.test.ts`: con expo-secure-store simulado: guardar y recuperar la sesión, devolver null sin sesión, devolver null con JSON corrupto, y que `clearSession` solo elimina la propia clave.
- `src/auth/__tests__/session-context.test.tsx`: signIn correcto persiste y autentica; signIn vacío o inválido no persiste; carga inicial con sesión existente autentica; signOut limpia solo la sesión.

No se prueban aquí los componentes visuales; esos comportamientos se verifican manualmente en Expo Go (AGENTS.md).

## 10. Cobertura de RF

| RF | Cubierto por |
|---|---|
| RF-01 | login.tsx + checkCredentials |
| RF-02 | checkCredentials + signIn |
| RF-03 | signIn + login.tsx |
| RF-04 | saveSession/loadSession + SessionProvider |
| RF-05 | checkCredentials (sin clave) + saveSession (solo datos del técnico) |
| RF-06 | SessionProvider + _layout.tsx |
| RF-07 | index.tsx (acción visible) + signOut |
| RF-08 | clearSession + signOut |
| RF-09 | SessionProvider expone employeeCode |
| RF-10 | checkCredentials ("empty") + login.tsx |
| RNF-01 | credenciales en el dispositivo, sin red |
| RNF-02 | secure-store + clave nunca persistida |
| RNF-03 | secure-store sobrevive a reinicio |

## 11. Validación final

- `npx jest` en verde (todos los módulos).
- `npx tsc --noEmit` sin errores.
- Manual en Expo Go: identificación correcta, mensajes de vacío e inválidos, reinicio de la app conserva la sesión, cierre de sesión vuelve al login y no afecta a otros datos locales, funcionamiento con el dispositivo sin conexión.
