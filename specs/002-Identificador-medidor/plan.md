# Plan — Spec 002: Identificación del medidor

Estado: aprobada
Spec: specs/002-Identificador-medidor/spec.md (aprobada)
Decisiones aplicadas: D-01 a D-14 de specs/002-Identificador-medidor/decisiones.md

## 1. Alcance y observaciones previas

Implementa la HU-002 completa: captura del código de etiqueta con formato asistido y validación local, comunicando el estado válido sin ofrecer una acción de continuación hasta que exista el destino de HU-003. No se consulta el sistema de la oficina en esta historia (D-01, D-13).

Hechos del repositorio inspeccionados antes de planificar:

- Las rutas viven en `src/app/`. Existen `_layout.tsx`, `index.tsx` (pantalla principal con cierre de sesión de la spec 001) y `login.tsx`.
- Jest ya está instalado (`jest.config.js`, `jest`, `jest-expo`); esta spec no requiere instalar el runner.
- `react-native-mask-text` está instalado según la autorización D-07.
- No hay librería de testing de componentes en el proyecto y no se añade: los componentes se verifican manualmente en Expo Go (constituciones 1 y 12, antislop: sin dependencias innecesarias).
- D-13 define que HU-002 comunica el estado válido, pero no presenta `Continuar` hasta que HU-003 implemente un destino real.
- El layout protege explícitamente `/` y `/login`; se añadirá `/medidor` al grupo autenticado para mantener la ruta protegida.

## 2. Archivos que se crean o modifican

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `package.json` | modificar | añadir `react-native-mask-text` (D-06, D-07; autorización registrada en D-07) |
| `src/domain/meter-code.ts` | crear | normalización y clasificación pura del código (D-02, D-03) |
| `src/domain/__tests__/meter-code.test.ts` | crear | pruebas de la lógica de validación |
| `src/app/medidor.tsx` | crear | pantalla de identificación del medidor: campo con máscara, estados visibles incompleto/válido y borrador en memoria (D-04, D-05, D-08, D-11, D-12, D-13, D-14) |
| `src/app/_layout.tsx` | modificar | declarar `/medidor` dentro del grupo de rutas autenticadas |
| `src/app/index.tsx` | modificar | añadir la entrada visible a la pantalla de identificación del medidor (RF-08) |

No se crean más archivos: sin contexto global, sin módulo de almacenamiento, sin componentes intermedios reutilizables (un solo uso), sin servicios ni capas de red. La lógica vive en `src/domain` (constitución 9) y la interfaz en dos pantallas existentes o mínimas.

## 3. Lógica pura (src/domain/meter-code.ts)

```text
FUNCIÓN PURA normalizeMeterCode(raw: string): string
  1. recortar espacios al inicio y al final
  2. convertir a mayúsculas
  3. devolver el texto            // D-03, RNF-04

FUNCIÓN PURA classifyMeterCode(raw: string): "incomplete" | "invalid" | "valid"
  texto = normalizeMeterCode(raw)
  1. SI texto coincide exactamente con MED- + seis dígitos -> "valid"
     // CA-02, D-02: exactamente seis dígitos, sin autocorrección
  2. SI el texto todavía puede crecer hasta un código válido -> "incomplete"
     // dos formas: el texto es prefijo literal del prefijo ("", "M", "ME",
     // "MED", "MED-") o es "MED-" seguido de 0 a 5 dígitos ("MED-123")
     // cubre vacío y a medio escribir, sin mensaje de error ni estado válido
  3. EN OTRO CASO -> "invalid"
     // letras fuera de lugar, séptimos dígitos, guion ausente,
     // prefijo ajeno (RF-04, RF-06, casos límite de la spec)
```

La función devuelve tres estados para que la pantalla decida qué mostrar sin conocer la lógica ni al revés (constitución 9). El estado `incomplete` cubre también el campo vacío, con el mismo comportamiento en pantalla.

## 4. Estrategia de persistencia

**No hay persistencia** (D-11). El código a medio escribir no se guarda en disco ni en SecureStore: solo sobrevive a los cambios de pantalla dentro de la misma sesión de la aplicación, y empieza vacío al cerrar y reabrir la app.

```text
BORRADOR A NIVEL DE MÓDULO en src/app/medidor.tsx:
  AL MONTAR la pantalla -> el campo parte del borrador en memoria
  AL CAMBIAR el campo   -> actualizar el borrador
  NO se escribe en ningún almacenamiento
```

Una variable a nivel de módulo se reinicia sola al cerrar la app y sobrevive al desmontaje de la pantalla, que es exactamente lo que pide RF-09. Un contexto global o un guardado en storage añadirían complejidad sin beneficio (antislop, constitución 1).

## 5. Navegación y acceso (Expo Router)

- `src/app/medidor.tsx` registra la ruta `/medidor` por convención de Expo Router.
- `src/app/_layout.tsx` declara la pantalla dentro de `Stack.Protected` para que solo esté disponible con sesión autenticada.
- RF-08: `src/app/index.tsx` añade una acción visible `Identificar medidor` que navega a `/medidor`, con área táctil de al menos 44 puntos y etiqueta de accesibilidad (rn-conventions).
- RF-07: dentro de `/medidor`, el estado válido se comunica con texto visible cuando `classifyMeterCode` devuelve `valid`. HU-002 no muestra `Continuar`; HU-003 lo incorporará cuando su destino real exista. No se crean rutas ni pantallas para simular ese destino.
- Toda la validación ocurre en el dispositivo: ninguna llamada de red en esta spec (RNF-01, D-01).

## 6. Comportamiento de la interfaz

**Pantalla de identificación del medidor (`src/app/medidor.tsx`), RF-01 a RF-07, RF-09:**

- Etiqueta visible `Código del medidor` y campo con el prefijo `MED-` formado automáticamente; el técnico teclea solo los seis dígitos con teclado numérico; cualquier otra tecla se ignora (D-08, D-12).
- Campo vacío o a medio escribir (`incomplete`): sin mensaje de error ni estado válido; no hay acción de continuación en HU-002 (RF-05, D-13).
- Entrada no admitida (caracteres no numéricos o dígitos extra): se ignora sin incorporarla al campo ni mostrar un error (D-14). La clasificación de textos arbitrarios inválidos se comprueba en las pruebas del dominio.
- Código válido (`valid`): comunicar el estado con texto visible, sin presentar `Continuar` en HU-002 (RF-07, D-13).
- Al salir y volver navegando dentro de la app, el código escrito se conserva; al cerrar y reabrir la app, el campo empieza vacío (RF-09, D-11).
- Diseño sobrio y legible para campo: textos en español, contraste suficiente, objetivos táctiles cómodos, formulario visible con el teclado abierto (constitución 7, rn-conventions, antislop).
- La pantalla `/medidor` solo está disponible con una sesión autenticada.

**Pantalla principal (`src/app/index.tsx`), RF-08:**

- Se añade la acción `Identificar medidor` junto a lo ya existente de la spec 001, sin alterar el cierre de sesión ni el nombre del técnico.

## 7. Decisiones técnicas y alternativas descartadas

| Decisión | Fundamento | Alternativa descartada |
|---|---|---|
| Campo enmascarado con `react-native-mask-text` | D-06, D-07 | `TextInput` sin formateo (opción A de D-06: el técnico ve el código mientras escribe); `react-native-masked-text` (inactiva desde 2019, D-07); cámara (opción C de D-06: contradice la HU) |
| Validación final en función pura del dominio | D-08, RNF-02, constitución 9 | confiar solo en la máscara: formatea, no valida (D-08) |
| Tres estados de clasificación (`incomplete`, `invalid`, `valid`) | D-04, RF-04, RF-05, RF-06 | estados `vacio` y `incomplete` separados (mismo comportamiento en pantalla, complejidad sin beneficio) |
| Regla de `incomplete` como texto que aún puede crecer hasta un código válido | D-02, casos límite de la spec | reglas por longitud y caracteres sueltas (más casos y ambigüedad) |
| Borrador en memoria a nivel de módulo, sin persistencia | D-11, RF-09 | persistir el borrador (habría que definir formato, clave y ciclo de vida de un dato temporal, constitución 1); contexto global (dependencia de estado innecesaria) |
| Sin librería de testing de componentes | constituciones 1 y 12 | `@testing-library/react-native` (dependencia nueva; la interfaz se verifica manualmente en Expo Go, AGENTS.md) |
| Pantalla propia en `/medidor` | D-05 | meter el campo en la pantalla principal (la decisión exige pantalla propia) |

## 8. Estrategia de pruebas con Jest

- `src/domain/__tests__/meter-code.test.ts`:
  - válido: `MED-123456`.
  - normalización: `med-123456` con espacios de bordes (`  MED-123456 `) clasifica `valid`; `normalizeMeterCode` devuelve mayúsculas sin espacios de bordes (RNF-04).
  - incompleto: vacío, `M`, `MED`, `MED-`, `MED-12`, `med-123`, `MED-12345` (nueve caracteres, aún crecible).
  - inválido: `MED-12345A`, `MED-1234567`, `MED123456`, `MED-12A456`, `XYZ-123456`, `MED-1234566` (siete dígitos), `MED- 12345` (espacio intermedio).
  - el resultado nunca contiene un cuarto estado (la unión es cerrada).

No se prueban los componentes visuales con Jest; esos comportamientos se verifican manualmente en Expo Go, como en la spec 001.

## 9. Cobertura de RF

| RF | Cubierto por |
|---|---|
| RF-01 | medidor.tsx (campo) |
| RF-02 | medidor.tsx (máscara y teclado) + D-12 |
| RF-03 | normalizeMeterCode |
| RF-04 | classifyMeterCode (`invalid`); el campo no admite códigos mal formados |
| RF-05 | classifyMeterCode (`incomplete`) + medidor.tsx (sin mensaje ni estado válido) |
| RF-06 | medidor.tsx (ignora caracteres no numéricos y dígitos extra); classifyMeterCode rechaza textos arbitrarios |
| RF-07 | medidor.tsx (estado válido visible; sin `Continuar` hasta HU-003) |
| RF-08 | index.tsx (entrada visible) + _layout.tsx (ruta protegida) |
| RF-09 | borrador a nivel de módulo en medidor.tsx |
| RNF-01 | ninguna llamada de red en toda la spec |
| RNF-02 | pruebas de `meter-code.test.ts` |
| RNF-03 | estados incompleto/válido en texto; clasificación invalid en dominio |
| RNF-04 | salida de `normalizeMeterCode` y clasificación sobre el texto normalizado |

## 10. Validación final

- `npx jest` en verde (todos los módulos).
- `npx tsc --noEmit` sin errores.
- Manual en Expo Go con la lista de `rn-conventions`: prefijo automático y hasta seis dígitos (D-12, D-14), estados vacío/incompleto/válido, teclas no numéricas y dígitos extra ignorados, ausencia de `Continuar` en HU-002, conservación del código al salir y volver, campo vacío tras cerrar la app, acceso desde la pantalla principal y bloqueo de `/medidor` sin sesión, textos en español, objetivos táctiles, teclado sin tapar el formulario y funcionamiento sin conexión. Los textos arbitrarios inválidos se cubren con las pruebas del dominio.
