# ADR-002: Usar expo-sqlite para el almacenamiento local de lecturas y borradores

* **Estado:** Aceptado
* **Fecha:** 2026-10-27
* **Requisitos relacionados:** R4, R5, R6, R7, R8, R9, R10

---

### Contexto
Los técnicos registran lecturas en parroquias rurales sin señal, por lo que cada lectura debe guardarse primero en el teléfono y sobrevivir al cierre de la app o del dispositivo durante varios días. Cada registro tiene varios campos relacionados (medidor, técnico, estado del medidor, consumo, ruta de la foto, estado de envío) y la app debe:
- Listar los pendientes de envío y marcarlos como enviados sin duplicarlos.
- Impedir dos registros del mismo medidor en el mismo mes y permitir corregir solo lo no enviado.
- Conservar una captura a medias para continuarla o descartarla.

El formato de los datos guardados también va cambiando con cada HU, así que hace falta migrar sin perder registros existentes.

---

### Alternativas Consideradas

| Alternativa | Ventajas en este proyecto | Desventajas en este proyecto |
| :--- | :--- | :--- |
| **expo-sqlite** | Consultas SQL con índices por técnico, medidor y mes. Transacciones atómicas. Restricciones `CHECK` en el motor. Migraciones versionadas con `PRAGMA user_version`. | SQL y migraciones escritos a mano, sin verificación de tipos. En pruebas unitarias el módulo debe simularse. |
| **AsyncStorage** | API clave-valor simple. Ya instalada en el proyecto. | Sin consultas: hay que leer y reescribir todo el JSON. Sin transacciones. |
| **WatermelonDB / Realm** | Optimizadas para grandes volúmenes de datos offline. | Configuración nativa adicional. Más dependencias de las necesarias para el volumen del proyecto. |

---

### Decisión
Se elige **expo-sqlite** porque permite guardar cada lectura localmente antes de enviarla, consultarla sin conexión y aplicar en la base las reglas de integridad requeridas, con transacciones que toleran interrupciones.

* **Configuración / Reglas técnicas específicas:**
  * Toda la persistencia está centralizada en `src/storage/readings.ts`, con una única conexión abierta con `openDatabaseAsync`.
  * Las migraciones se aplican en orden, una sola vez, según `PRAGMA user_version`. Nunca se borran ni reescriben registros existentes.
  * Tablas: `meter_readings`, que tiene `reading_uuid` y `sync_status` (`pending` | `sent`), y `reading_drafts`, con una captura pendiente por técnico.

---

### Consecuencias

* **Ganancias:** Las lecturas sobreviven sin conexión y al cerrar la app. Las consultas por mes, medidor y estado de envío son directas, y la integridad de los datos queda reforzada con restricciones del motor.
* **Riesgos / Costos:** Una migración mal escrita puede bloquear la apertura de la base o corromper registros existentes. Cada cambio de esquema exige una migración nueva y su prueba. El SQL no lo verifica TypeScript.
* **Impacto en el código:** Ningún componente visual accede a SQLite directamente; todo pasa por las funciones de `src/storage/readings.ts`. Los cambios de esquema se agregan como nuevas entradas en `MIGRATIONS` y nunca se modifican las anteriores.

---

### Verificación
1. Revisar los archivos en `src/storage/readings.ts` y `src/storage/__tests__/readings.test.ts`.
2. Verificar en `package.json` la presencia de `expo-sqlite`.
3. Validar el comportamiento en el dispositivo: activar el modo avión, registrar una lectura, cerrar la app por completo y reabrirla. La lectura debe seguir listada como pendiente. Ejecutar `npx jest src/storage`.

---

### Uso de IA
* **Consulta realizada:** Se pidió a la IA comparar expo-sqlite, AsyncStorage y WatermelonDB/Realm para guardar lecturas y borradores sin conexión durante varios días, evitando duplicados por medidor y mes.
* **Propuesta de la IA:** La IA recomendó expo-sqlite por ofrecer transacciones, restricciones e índices en el propio motor, y sugirió versionar el esquema con `PRAGMA user_version`.
* **Decisión sobre la respuesta:** Se aceptó la recomendación tras contrastarla con los requisitos. Se descartó AsyncStorage por la falta de transacciones y WatermelonDB/Realm por la configuración nativa adicional.
