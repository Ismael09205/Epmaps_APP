# Decisiones: HU-003: Consulta y almacenamiento en caché de datos del medidor

Decisiones aprobadas mediante entrevista directa. Basadas en `docs/historias/HU-003.md`, `docs/constitution.md` y la conversación de aclaración.

## D-01: Persistencia de la caché de consulta

- **Pregunta:** ¿Qué biblioteca se usa para consultar y conservar los datos entre reinicios: `expo-sqlite`, AsyncStorage o TanStack Query?
- **Respuesta:** Se usa **TanStack Query** para la consulta y gestión de su caché, con persistencia mediante **AsyncStorage**, `@tanstack/react-query-persist-client` y `@tanstack/query-async-storage-persister`. Se autoriza incorporar estas dependencias durante la fase de implementación. AsyncStorage no cifra los datos; se aprueba su uso para esta caché. La sesión de HU-001 continúa en `expo-secure-store`.
- **Motivo:** La consulta requiere presentar datos cacheados antes de completar una actualización de red y conservarlos al reiniciar la aplicación. La persistencia queda limitada a los datos del medidor definidos en HU-003; no modifica el almacenamiento de la sesión.

## D-02: Detección de conectividad

- **Pregunta:** ¿Cómo se informa a TanStack Query del estado de conectividad en React Native para pausar consultas sin red y reanudarlas al reconectar?
- **Respuesta:** Se usa **`expo-network`** para conectar el estado de red con `onlineManager`. Se autoriza incorporar la dependencia durante la fase de implementación.
- **Motivo:** TanStack Query requiere una integración de estado de conectividad en React Native para gestionar las consultas al perderse o recuperarse la señal. `expo-network` es compatible con Expo SDK 57 y Expo Go.

## D-03: Alcance de consultas y mutaciones

- **Pregunta:** ¿HU-003 debe incluir caché de mutaciones o procesos pesados además de consultar los datos del medidor?
- **Respuesta:** No. HU-003 cachea como una unidad la respuesta completa de cada consulta del medidor. Las mutaciones y los procesos pesados quedan fuera de esta historia y requieren una HU posterior.
- **Motivo:** HU-003 define consulta y visualización, no operaciones de escritura. No se deben inventar colas, reintentos ni resolución de conflictos sin requisitos aprobados (constituciones 2 y 5).

## D-04: Inicio de la consulta

- **Pregunta:** ¿La consulta comienza automáticamente al completar el código o mediante una acción explícita?
- **Respuesta:** Cuando el código `MED-` seguido de seis dígitos sea válido, se ofrece la acción `Consultar`. La consulta se inicia al pulsarla; no se lanza automáticamente al completar el último dígito.
- **Motivo:** Evita consultas accidentales y separa la identificación local del medidor de la consulta al sistema de la oficina.

## D-05: Uso y actualización de la caché

- **Pregunta:** Al consultar un medidor con datos cacheados vigentes, ¿se espera la respuesta nueva o se muestra primero la caché?
- **Respuesta:** Se muestra inmediatamente la respuesta cacheada vigente y se solicita una actualización en segundo plano cuando haya conectividad. Una respuesta válida actualiza la ficha y la caché.
- **Motivo:** Cumple CA-04 sin bloquear al técnico mientras se descarga la actualización.

## D-06: Vigencia y limpieza

- **Pregunta:** ¿Durante cuánto tiempo es vigente la caché y cuándo se eliminan sus entradas vencidas?
- **Respuesta:** Cada entrada es vigente hasta el cambio del día local en Ecuador y sobrevive al cierre y reinicio de la aplicación. Las entradas vencidas se eliminan en el siguiente inicio o consulta; una entrada vencida se trata como ausente.
- **Motivo:** Acota la vigencia a la jornada aprobada y evita conservar indefinidamente datos de cuenta vencidos.

## D-07: Comportamiento sin conexión

- **Pregunta:** ¿Qué se muestra cuando no hay señal?
- **Respuesta:** Si existe caché vigente, se muestra con un aviso de que puede estar desactualizada. Si no existe caché vigente, se informa que no hay datos actuales por falta de conexión. La caché vencida no se muestra.
- **Motivo:** Permite consultar datos disponibles sin presentar datos de una jornada anterior como actuales.

## D-08: Separación de caché por técnico

- **Pregunta:** ¿Cómo se evita que un técnico vea la caché de otro y qué ocurre al cerrar sesión?
- **Respuesta:** La caché se identifica por el código del técnico y el código normalizado del medidor. Se conserva al cerrar sesión hasta su vencimiento, pero no se comparte entre técnicos.
- **Motivo:** Mantiene el aislamiento de la información sin contradecir D-07 de HU-001, que impide que el cierre de sesión elimine otros datos locales.

## D-09: Medidor no encontrado y respuestas no válidas

- **Pregunta:** ¿Qué ocurre si la oficina responde que el medidor no existe o devuelve una respuesta vacía/no válida cuando hay datos cacheados?
- **Respuesta:** Se informa que la oficina no encontró el medidor. Si existe una ficha válida cacheada, se conserva y se muestra claramente marcada como desactualizada. Las respuestas vacías o no válidas y los errores de red/servidor no reemplazan la última respuesta válida; se distinguen del estado «no encontrado».
- **Motivo:** Evita perder información válida por una respuesta incompleta o fallida y permite distinguir el resultado actual de los datos anteriores.

## D-10: Datos y presentación

- **Pregunta:** ¿Qué campos se muestran y cómo se presentan la fecha y el consumo promedio?
- **Respuesta:** Se muestran dirección, sector, número de cuenta, estado, última lectura con su fecha y consumo promedio mensual. La fecha se presenta como `dd/MM/yyyy`; la unidad del consumo se muestra tal como la entregue la API, sin conversiones.
- **Motivo:** Cubre CA-02 sin inventar unidades ni reglas de conversión.

## D-11: Contrato de la API de oficina

- **Pregunta:** ¿Qué endpoint, autenticación y esquema de respuesta se usan para consultar los datos?
- **Respuesta:** No se encontró un contrato de API en el repositorio. No se inventarán endpoint, autenticación ni esquema. Si el contrato aún no existe, queda pendiente de definición y la integración se bloquea hasta que se apruebe.
- **Motivo:** La consulta depende de un sistema externo y esos detalles no están definidos en HU-003. La spec debe marcar lo pendiente como `[NECESITA ACLARACIÓN]`.

## D-12: Esquema y recurso de MockAPI

- **Pregunta:** ¿Qué campos debe exponer el recurso MockAPI y qué ruta usa?
- **Respuesta:** El proyecto base es `https://6ad90cb3f89c5702ed9a631a.mockapi.io`. Se define el recurso `medidores` en `/api/v1/medidores`, sin autenticación. Cada registro contiene `meterCode` (texto), `address` (texto), `sector` (texto), `accountNumber` (texto), `status` (texto sin enum impuesto), `lastReading` (número), `lastReadingDate` (fecha ISO `YYYY-MM-DD`), `monthlyAverageConsumption` (número) y `monthlyAverageConsumptionUnit` (texto). El recurso aún no está configurado. Esta decisión reemplaza D-11 en cuanto al contrato, la ruta y la autenticación.
- **Motivo:** Los campos corresponden a CA-02. El esquema plano es sencillo de configurar en MockAPI, conserva la unidad entregada y trata el número de cuenta como texto para preservar ceros iniciales.

## D-13: Consulta y cardinalidad de respuesta

- **Pregunta:** ¿Cómo consulta la app el medidor y qué significa cada cantidad de resultados?
- **Respuesta:** La app usa `GET /api/v1/medidores?meterCode=<código>`. Cero resultados significa «no encontrado»; exactamente un resultado es la ficha del medidor. Más de un resultado es una respuesta ambigua, se muestra como error y no sustituye la caché válida. Los errores HTTP y de conectividad se distinguen de «no encontrado» y no sustituyen la caché válida.
- **Motivo:** Evita elegir arbitrariamente entre registros duplicados y conserva la diferencia entre ausencia del medidor y fallo de consulta.

## D-14: Estado de consulta inicial

- **Pregunta:** ¿Qué se muestra al iniciar una consulta sin datos cacheados?
- **Respuesta:** La interfaz muestra un indicador de actividad junto al texto `Consultando datos del medidor…` hasta recibir un resultado o un error.
- **Motivo:** El técnico puede reconocer que la consulta sigue en curso, sin confundir la espera con una pantalla vacía.
