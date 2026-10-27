# Decisiones — HU-001: Identificación del técnico

Decisiones aprobadas mediante entrevista directa el 27/10/2026. Basadas en `docs/historias/HU-001.md`, `docs/constitution.md` y `AGENTS.md`.

## D-01 — Credenciales quemadas: origen y regla de validación

- **Pregunta (Q1):** ¿De dónde salen las credenciales válidas y qué regla de validación aplica?
- **Respuesta:** Sí. Una lista pequeña de técnicos de prueba (código de empleado + clave) definida en una constante del dominio (`src/domain`). Cualquier combinación que no coincida exactamente con la lista se considera inválida.
- **Motivo:** Es lo más simple compatible con "Simplicidad primero" (constitución 1) y con CA-03, que permite datos quemados sin gestión de usuarios. Validación exacta, sin hash ni dependencias nuevas.

## D-02 — Persistencia de la sesión entre reinicios

- **Pregunta (Q2):** ¿"Mantener la sesión iniciada" significa que la sesión sobrevive al cierre y reinicio de la app?
- **Respuesta:** Sí. La sesión debe persistir localmente; solo termina con el cierre de sesión explícito del técnico.
- **Motivo:** El técnico trabaja en campo y sin conexión; no debe reidentificarse cada vez que la app se cierra o el sistema mata el proceso. La constitución 8 exige que cerrar o reabrir la app no pierda información que deba mantenerse.

## D-03 — Campos del técnico persistidos

- **Pregunta (Q3/Q4):** ¿Qué datos del técnico se conservan tras identificarse?
- **Respuesta:** Exactamente: **código de empleado, nombre y apellido**. Cualquier otro dato operativo (zona, ruta asignada, turno, teléfono, etc.) queda fuera hasta que una HU lo pida.
- **Motivo:** La respuesta inicial fue ampliar más allá del código, pero acotada la discusión se aprobó la lista mínima que la HU permite inferir. La clave no se persiste. Añadir campos sin una HU que los use sería inventar requisitos (constitución 2 y 12); los nombres sirven como base de trazabilidad (constitución 6).

## D-04 — Comportamiento ante credenciales inválidas

- **Pregunta (Q5):** ¿Qué ocurre cuando el código o la clave no coinciden?
- **Respuesta:** La app muestra un mensaje claro de "credenciales inválidas" sin indicar cuál de los dos campos falló. No hay límite de intentos ni bloqueo; se puede reintentar de inmediato.
- **Motivo:** Sin backend ni riesgo real de ataque, un límite de intentos sería complejidad innecesaria (constitución 1). El mensaje genérico evita revelar cuál código de empleado es válido (constitución 11).

## D-05 — Navegación al iniciar la aplicación

- **Pregunta (Q6):** ¿Qué pantalla ve el técnico al abrir la app?
- **Respuesta:** Al arrancar, la app verifica la sesión persistida: si existe, entra directo a la pantalla principal sin identificarse de nuevo; si no existe, muestra la pantalla de identificación.
- **Motivo:** Es la consecuencia lógica de CA-02 y de la persistencia aprobada en D-02; evita pasos innecesarios en campo.

## D-06 — Ubicación del cierre de sesión

- **Pregunta (Q7):** ¿Dónde queda la acción de cerrar sesión?
- **Respuesta:** En la pantalla principal, en un lugar visible y accesible (cabecera, botón de perfil u opciones de la pantalla). La ubicación exacta se define al diseñar la pantalla.
- **Motivo:** CA-02 exige que el técnico pueda cerrar sesión; una acción escondida en otra pantalla u oculta en ajustes dificulta su uso en campo (constitución 7).

## D-07 — Efecto del cierre de sesión sobre los datos locales

- **Pregunta (Q8):** ¿Qué pasa con los datos locales al cerrar sesión?
- **Respuesta:** El cierre de sesión solo elimina la sesión iniciada y los datos del técnico persistidos para la identificación. No elimina ni altera ningún otro dato local (lecturas pendientes de sincronizar, fotografías u otros registros).
- **Motivo:** Obligatorio por las constituciones 8 y 5: cerrar sesión no puede provocar pérdida de registros que deban conservarse ni interferir con la sincronización pendiente.

## D-08 — Herramienta de sesión y persistencia

- **Pregunta:** ¿Qué herramientas se usan para gestionar el estado de sesión y persistir la sesión y los datos del técnico?
- **Respuesta:** Se usa **React Context** para el estado de sesión (indicador de sesión iniciada y datos del técnico) y **expo-secure-store** para persistirlo de forma segura en el dispositivo.
- **Motivo:** Contexto simple y sin dependencias nuevas para el estado; secure-store respeta la constitución 11 (manejo seguro de datos) y su límite de tamaño por clave es suficiente para código de empleado, nombre y apellido. Requiere autorización explícita para instalar la dependencia en la fase de tareas (constitución 12).

## D-09 — Alcance de la sesión para trazabilidad

- **Pregunta (implicita en Q3/Q4):** ¿Para qué queda disponible el código del técnico identificado?
- **Respuesta:** El código de empleado persistido queda disponible como identificación del técnico para los registros que genere durante la sesión, cuando otras historias de usuario lo requieran (por ejemplo, la trazabilidad de lecturas).
- **Motivo:** Constitución 6 (trazabilidad); no se anticipa ningún uso concreto fuera de lo que definan las HU futuras.

## D-10 — Validación de campos vacíos

- **Pregunta (Q1 de cierre de spec):** ¿Qué ocurre cuando el código de empleado o la clave están vacíos?
- **Respuesta:** La aplicación debe validar siempre que el código de empleado y la clave no estén vacíos antes de evaluar la credencial. Si alguno está vacío, se muestra un mensaje indicando que el dato es obligatorio, sin evaluar la credencial.
- **Motivo:** Evita un intento de validación inútil y da feedback inmediato y claro al campo correspondiente, adecuado para uso en campo (constitución 7), sin añadir complejidad.

## D-11 — Sensibilidad de la coincidencia exacta

- **Pregunta (Q2 de cierre de spec):** ¿La coincidencia exacta de D-01 distingue mayúsculas y cómo trata los espacios?
- **Respuesta:** La comparación del código de empleado y la clave es exacta y distingue mayúsculas de minúsculas; únicamente se ignoran los espacios al inicio y al final de lo que escriba el técnico.
- **Motivo:** Mantiene la validación exacta aprobada en D-01 y evita rechazos confusos por espacios accidentales, un error común al escribir en el campo, sin relajar la validación.
