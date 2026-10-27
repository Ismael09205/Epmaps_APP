# Decisiones — HU-002: Identificación del medidor

Decisiones aprobadas mediante entrevista directa el 27/10/2026. Basadas en `docs/historias/HU-002.md`, `docs/constitution.md` y `AGENTS.md`. La comparación con `docs/historias/HU-003.md` se usó para acotar el alcance.

## D-01 — Alcance de la consulta al sistema de la oficina

- **Pregunta (Q1):** HU-002 dice que el código se valida "antes de consultar el sistema de la oficina" y CA-03 prohíbe consultar si está incompleto; la consulta la define HU-003. ¿HU-002 termina en la validación local del formato y en habilitar el paso siguiente, sin hacer ninguna consulta real?
- **Respuesta:** Sí. HU-002 solo captura el código, valida el formato `MED-` + 6 dígitos en lógica local y libera la acción de continuar; la consulta al sistema de la oficina la implementa HU-003.
- **Motivo:** Evita duplicar alcance entre historias (constitución 2) y permite que HU-002 funcione íntegramente sin conexión (constitución 4), que es su condición natural de uso en campo.

## D-02 — Código completo pero mal formado

- **Pregunta (Q2):** CA-03 solo protege el caso "incompleto". ¿Un código de longitud completa pero con formato incorrecto (`MED-12345A`, `MED123456`, `MED-1234567`, caracteres no permitidos) se rechaza con mensaje de formato inválido y sin habilitar el paso siguiente, sin autocompletar ni recortar?
- **Respuesta:** Sí. Cualquier texto que no coincida exactamente con `MED-` + exactamente seis dígitos se rechaza con mensaje inline bajo el campo; no se corrige automáticamente.
- **Motivo:** Mantiene la validación exacta ya aprobada en HU-001 (D-01/D-11) y garantiza la integridad del dato desde la captura (constitución 3): un código erróneo no debe avanzar hacia las pantallas siguientes.

## D-03 — Normalización antes de validar

- **Pregunta (Q3):** ¿Se ignoran espacios al inicio y al final y se aceptan minúsculas convirtiendo a mayúsculas antes de comparar, manteniendo el resto de la comparación exacta?
- **Respuesta:** Sí. Trim de espacios extremos y paso a mayúsculas antes de validar; el código que se muestra/guarda es siempre la forma normalizada (`MED-` + 6 dígitos).
- **Motivo:** Igual que el criterio de HU-001 (D-11): evita rechazos confusos por errores típicos de tecleo en campo sin relajar el formato (constitución 7).

## D-04 — Estados y mensaje de error

- **Pregunta (Q4):** ¿Cómo se presenta la validación al técnico? Propuesta: sin error con el campo vacío o a medio escribir; mensaje de formato inválido inline debajo del campo solo cuando el texto no puede completarse válido o al intentar continuar; acción de continuar deshabilitada hasta que el código sea válido.
- **Respuesta:** Sí, así.
- **Motivo:** Feedback claro y junto al campo, sin alertas modales ni indicadores solo por color (constitución 7); sin errores prematuros durante el tipeo y sin permitir avanzar con un código inválido (constitución 3).

## D-05 — Punto de entrada de la identificación del medidor

- **Pregunta (Q5):** ¿Dónde vive el campo de código, si la HU no lo dice? Propuesta: pantalla propia, accesible desde la pantalla principal (la que queda tras iniciar sesión según HU-001), no en el login ni oculta en ajustes.
- **Respuesta:** Sí. Pantalla propia dedicada con entrada visible desde la pantalla principal.
- **Motivo:** Separa el paso de identificar el medidor del resto del trabajo, prepara el flujo para que HU-003 muestre los datos al continuar y mantiene la navegación simple y predecible en campo (constitución 7).

## D-06 — Tecnología de captura y validación

- **Pregunta (Q6):** Se plantearon tres tecnologías: **(A)** `TextInput` nativo con validación en lógica pura sin dependencias; **(B)** campo enmascarado con librería externa; **(C)** captura por cámara/código de barras. ¿Cuál se usa?
- **Respuesta:** **Opción B — campo enmascarado con librería externa**, para que el código se forme en pantalla mientras el técnico escribe y se reduzcan los errores de tecleo en campo. Las opciones A y C quedan descartadas.
- **Motivo:** La opción A no muestra el formato mientras se escribe; la opción C contradice la HU, que dice literalmente "escribiendo su código" (constitución 2), y añadiría permisos de cámara y más estados de error (constitución 1 y 11). La opción B mejora la usabilidad en campo (constitución 7) a cambio de una dependencia, que se autoriza en D-07.

## D-07 — Librería concreta y autorización de instalación

- **Pregunta (Q7):** Dentro de la opción B, ¿se usa `react-native-mask-text` y se autoriza su instalación en la fase de tareas?
- **Respuesta:** Sí. Se usa **`react-native-mask-text`** y se autoriza aquí su instalación por la tarea correspondiente (no se instala en este momento).
- **Motivo:** Comparadas el 27/10/2026, `react-native-mask-text` está en mantenimiento activo (v0.15.0, junio 2025; ~72 mil descargas/semana; pensada para Expo; licencia MIT), mientras `react-native-masked-text` no tiene releases desde 2019 y Snyk la marca como mantenimiento inactivo. Usar la inactiva sería innecesariamente arriesgado (constitución 1). La autorización queda registrada para no instalar dependencias sin respaldo (constitución 12).

## D-08 — Comportamiento del prefijo y validación final

- **Pregunta (Q8):** ¿El campo presenta el prefijo `MED-` automáticamente y el técnico teclea solo los seis dígitos, manteniendo la validación final como función pura en `src/domain` (la máscara solo formatea, no valida), aplicando la normalización de D-03?
- **Respuesta:** Sí.
- **Motivo:** La validación de CA-02/CA-03 vive en el dominio, separada de la interfaz (constitución 9) y testeable con Jest (constitución 10); la máscara queda como UX pura y la regla de negocio tiene un único lugar (constitución 1).
