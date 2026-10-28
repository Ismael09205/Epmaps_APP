# ADR-004: Usar react-query-persist-client para conservar la caché de medidores al cerrar la app

* **Estado:** Aceptado
* **Fecha:** 2026-10-27
* **Requisitos relacionados:** R3

---

### Contexto
 En campo es habitual que el sistema cierre la app o que el técnico la cierre entre medidor y medidor. Si la caché se pierde, una nueva consulta del mismo medidor durante la jornada obliga a descargarlo otra vez y, sin señal, ni siquiera se podría ver. Hace falta restaurar la caché al abrir la app, antes de que las pantallas consulten.

---

### Alternativas Consideradas

| Alternativa | Ventajas en este proyecto | Desventajas en este proyecto |
| :--- | :--- | :--- |
| **react-query-persist-client** | Plugin oficial. Restaura la caché antes de renderizar. `maxAge` y filtro de consultas (`shouldDehydrateQuery`). | Paquete adicional atado a la versión de `@tanstack/react-query`. Requiere un persister aparte. |
| **Guardar y restaurar manualmente con `dehydrate`/`hydrate`** | Sin dependencias adicionales. | Control manual de escrituras y de la espera de restauración. Propenso a condiciones de carrera. |
| **Guardar los medidores consultados en SQLite** | Reutiliza la base existente. | Duplica la caché. Requiere tablas y migraciones para datos temporales. |

---

### Decisión
Se elige **react-query-persist-client** porque persiste la caché de React Query de forma oficial e integrada. Así los medidores consultados siguen disponibles aunque la app se cierre, sin escribir sincronización manual.

* **Configuración / Reglas técnicas específicas:**
  * `PersistQueryClientProvider` envuelve la app en `src/app/_layout.tsx` con `persistOptions`.
  * `maxAge` es de 24 h (`CACHE_MAX_AGE`).
  * Solo se persisten las consultas con prefijo `['meter-cache']` que tengan datos.

---

### Consecuencias

* **Ganancias:** Los medidores consultados siguen disponibles tras reiniciar la app, incluso sin señal, y no se agregan tablas ni migraciones para datos temporales.
* **Riesgos / Costos:** La caché persistida puede mostrar datos del medidor desactualizados durante 24 h. Si cambia la forma del objeto `Meter`, la caché antigua puede restaurarse con un formato inválido, por lo que hay que validarla (`isMeterCacheEntry`) o cambiar la clave de almacenamiento.
* **Impacto en el código:** Toda consulta nueva que no deba persistirse debe usar una clave distinta de `['meter-cache']`. Las pantallas no deben asumir que la caché está vacía al iniciar.

---

### Verificación
1. Revisar los archivos en `src/app/_layout.tsx` y `src/query/query-client.ts`.
2. Verificar en `package.json` la presencia de `@tanstack/react-query-persist-client`.
3. Validar el comportamiento en el dispositivo: consultar un medidor con señal, cerrar la app, activar el modo avión, reabrirla y consultar el mismo medidor. Debe mostrarse sin descarga. Ejecutar `npx jest src/query/__tests__/query-client.test.ts`.

---

### Uso de IA
* **Consulta realizada:** Se preguntó a la IA cómo evitar que la caché de medidores se pierda al cerrar la app.
* **Propuesta de la IA:** La IA sugirió usar el plugin oficial `@tanstack/react-query-persist-client` en lugar de guardar y restaurar la caché manualmente o duplicarla en SQLite.
* **Decisión sobre la respuesta:** Se aceptó la sugerencia y se decidió persistir solo las consultas `['meter-cache']` con un `maxAge` de 24 h para limitar el tamaño de lo guardado.
