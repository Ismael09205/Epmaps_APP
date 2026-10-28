# ADR-003: Usar TanStack Query para la comunicación con la oficina, la caché y el envío diferido

* **Estado:** Aceptado
* **Fecha:** 2026-10-27
* **Requisitos relacionados:** R3, R4, R9, R10

---

### Contexto
La app consulta al sistema de la oficina los datos de cada medidor y envía las lecturas registradas. En campo la señal aparece y desaparece, por lo que:
- Si el técnico vuelve a consultar un medidor durante la jornada, no debe esperar una nueva descarga.
- Las lecturas pendientes deben enviarse automáticamente al recuperar la conexión, reintentando ante fallos de red, sin enviar dos a la vez ni duplicar registros.
- Las pantallas deben reflejar el estado de los envíos y el número de pendientes.
- Al reconectar, las lecturas registradas sin señal deben verificarse y refrescarse.

---

### Alternativas Consideradas

| Alternativa | Ventajas en este proyecto | Desventajas en este proyecto |
| :--- | :--- | :--- |
| **TanStack React Query** | Caché por clave con tiempo de vida configurable. Pausa y reanuda mutaciones según la conexión (`onlineManager`). Reintentos configurables y `scope` para envíos en serie. | Curva de aprendizaje (claves, `gcTime`, invalidaciones). No garantiza idempotencia por sí misma. |
| **fetch + useEffect + estado propio** | Sin dependencias. Control total del flujo. | Caché, reintentos, pausa sin conexión y exclusión mutua implementados a mano. Más código que probar. |
| **SWR** | Ligera. Caché por clave. | Mutaciones, reintentos y persistencia limitados. Sin cola de envío offline. |

---

### Decisión
Se elige **TanStack React Query** porque resuelve en una sola herramienta la caché de medidores y el envío diferido con reintentos y exclusión mutua. La lógica de envío queda separada de la interfaz.

* **Configuración / Reglas técnicas específicas:**
  * Caché de consultas: `gcTime` de 24 h y sin reintentos en consultas (`retry: false`). Las entradas de medidor guardan su propio `expiresAt` y se depuran con `pruneExpiredMeterCache`.
  * Envío (`src/query/reading-sync.ts`): mutación `['reading-sync']` con `scope: { id: 'reading-sync' }`. Hasta 3 reintentos, y solo ante errores de red, esperando 2, 4 y 8 s. Los errores HTTP no se reintentan.
  * Al terminar cada envío se invalidan el conteo de pendientes y las lecturas del medidor.

---

### Consecuencias

* **Ganancias:** La caché de medidores evita esperas repetidas y los envíos se reanudan solos al reconectar. La UI se mantiene sincronizada con invalidaciones en vez de con estado manual.
* **Riesgos / Costos:** Si una invalidación queda mal configurada, la UI puede mostrar un conteo de pendientes desactualizado. La idempotencia no la da la librería: depende de releer los pendientes en cada intento y de marcar cada lectura como enviada (ADR-002). Un corte justo después de que el servidor reciba la lectura, pero antes de marcarla como enviada, provoca un reenvío que el servidor debe tolerar mediante `reading_uuid`.
* **Impacto en el código:** Las claves de consulta se generan solo con las funciones exportadas (`meterCacheQueryKey`, `pendingSyncCountQueryKey`, `meterReadingsQueryKey`). Toda escritura que cambie lecturas debe invalidar esas claves.

---

### Verificación
1. Revisar los archivos en `src/query/query-client.ts`, `src/query/reading-sync.ts`, `src/query/reading-verification.ts`, `src/app/medidor.tsx` y `src/app/index.tsx`.
2. Verificar en `package.json` la presencia de `@tanstack/react-query`.
3. Validar el comportamiento en el dispositivo: registrar dos lecturas en modo avión, desactivarlo y comprobar que el contador de pendientes baje a 0 sin duplicados. Consultar dos veces el mismo medidor y comprobar que la segunda vez no haya carga. Ejecutar `npx jest src/query`.

---

### Uso de IA
* **Consulta realizada:** Se consultó a la IA cómo manejar la caché de medidores y el envío diferido de lecturas con reintentos, comparando TanStack React Query, SWR y una solución propia con `fetch`.
* **Propuesta de la IA:** La IA propuso TanStack React Query por integrar `onlineManager`, reintentos por mutación y `scope` para evitar envíos simultáneos.
* **Decisión sobre la respuesta:** Se aceptó la propuesta. Se ajustaron los parámetros de reintento (3 intentos solo ante errores de red) según el contexto del proyecto y se mantuvo SQLite como fuente de verdad de las lecturas.
