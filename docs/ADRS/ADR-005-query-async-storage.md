# ADR-005: Usar query-async-storage-persister como persister de la caché de consultas

* **Estado:** Aceptado
* **Fecha:** 2026-10-27
* **Requisitos relacionados:** R3

---

### Contexto
ADR-004 establece que la caché de medidores se persiste con `PersistQueryClientProvider`, pero ese proveedor necesita un *persister* que serialice la caché y la escriba en un almacenamiento del dispositivo. El almacenamiento disponible en el dispositivo es asíncrono. Además, la caché cambia cada vez que se consulta un medidor, así que las escrituras deben agruparse para no saturar el almacenamiento.

---

### Alternativas Consideradas

| Alternativa | Ventajas en este proyecto | Desventajas en este proyecto |
| :--- | :--- | :--- |
| **query-async-storage-persister** | Persister oficial para almacenamiento asíncrono. Escrituras agrupadas (*throttle*). Clave configurable. | Serializa toda la caché en un único JSON. Dependencia atada a la versión de TanStack. |
| **query-sync-storage-persister** | Persister oficial. | Requiere un almacenamiento síncrono que el proyecto no tiene. |
| **Persister propio** | Sin dependencias. | Reimplementa serialización, *throttle* y manejo de errores. |

---

### Decisión
Se elige **query-async-storage-persister** porque es el adaptador oficial entre la persistencia de React Query (ADR-004) y un almacenamiento asíncrono como AsyncStorage.

* **Configuración / Reglas técnicas específicas:** Se crea con `createAsyncStoragePersister({ storage: AsyncStorage, key: 'epmaps-meter-query-cache' })` en `src/query/query-client.ts`.

---

### Consecuencias

* **Ganancias:** La persistencia de la caché funciona sin código propio de serialización y con escrituras agrupadas.
* **Riesgos / Costos:** Al guardarse como un solo JSON, si un día se persistieran consultas grandes, por ejemplo con muchas lecturas, el tiempo de escritura y de restauración crecería. Por eso solo se persisten las consultas `['meter-cache']`.
* **Impacto en el código:** La clave `epmaps-meter-query-cache` no debe reutilizarse para otros datos. Si cambia el formato de la caché, se debe cambiar la clave para descartar la anterior.

---

### Verificación
1. Revisar el archivo `src/query/query-client.ts` (`queryPersister`).
2. Verificar en `package.json` la presencia de `@tanstack/query-async-storage-persister`.
3. Validar el comportamiento: ejecutar `npx jest src/query/__tests__/query-client.test.ts`, donde se persiste y restaura la caché usando el mock de AsyncStorage.

---

### Uso de IA
* **Consulta realizada:** Se consultó a la IA qué persister usar con `PersistQueryClientProvider` en React Native.
* **Propuesta de la IA:** La IA indicó que el persister síncrono no es adecuado porque el almacenamiento del dispositivo es asíncrono, y recomendó `@tanstack/query-async-storage-persister`.
* **Decisión sobre la respuesta:** Se aceptó la recomendación tras verificar en la documentación oficial que el persister agrupa las escrituras, y se definió una clave propia para la caché.
