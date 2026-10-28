# Plan: Spec 003: Consulta y almacenamiento en caché de datos del medidor

Estado: aprobado
Spec: specs/003-Consulta-Almacenamiento-cache/spec.md (aprobada)
Decisiones aplicadas: D-01 a D-14 de specs/003-Consulta-Almacenamiento-cache/decisiones.md

## 1. Alcance y observaciones previas

Implementa la consulta del medidor desde la pantalla existente, presenta los campos definidos, conserva la respuesta por técnico y medidor durante el día local y maneja los estados de conectividad, carga, error y ausencia de resultados. No implementa mutaciones ni modifica la sesión de HU-001.

Hechos inspeccionados antes de planificar:

- El proyecto usa Expo SDK 57, React Native y Expo Router. Jest y `jest-expo` ya están instalados.
- `src/app/medidor.tsx` ya captura y valida el código. `src/app/_layout.tsx` ya protege esa ruta para sesiones autenticadas.
- `src/auth/session-context.tsx` expone el código de empleado en la sesión. La sesión se guarda en `expo-secure-store`; esta iniciativa no cambia ese almacenamiento.
- No hay cliente de red, TanStack Query ni AsyncStorage instalados.
- La URL base de MockAPI está aprobada, pero el recurso remoto `medidores` aún no está configurado. No se modificarán recursos remotos. La validación manual contra el servicio real queda pendiente hasta que el recurso exista.
- D-01 y D-02 autorizan incorporar las dependencias de TanStack Query, persistencia AsyncStorage y `expo-network` durante implementación. No se instalan en esta fase de planificación.

## 2. Archivos que se crean o modifican

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `package.json`, `package-lock.json` | modificar | añadir TanStack Query, sus paquetes de persistencia, AsyncStorage y `expo-network` (D-01, D-02) |
| `src/domain/meter.ts` | crear | modelo, validación pura del registro, formato de fecha y vigencia diaria (D-06, D-12, D-13) |
| `src/domain/__tests__/meter.test.ts` | crear | pruebas del contrato, asociación, fechas y vigencia |
| `src/api/meters.ts` | crear | petición GET al recurso aprobado y conversión de respuestas a datos o errores identificables (D-12, D-13) |
| `src/api/__tests__/meters.test.ts` | crear | pruebas del cliente con respuestas HTTP simuladas, sin depender del recurso remoto |
| `src/query/query-client.ts` | crear | instancia de QueryClient, persister de AsyncStorage y configuración de conectividad de TanStack Query (D-01, D-02) |
| `src/app/_layout.tsx` | modificar | montar el proveedor persistente y mantener intacta la protección de rutas por sesión |
| `src/app/medidor.tsx` | modificar | añadir `Consultar`, presentar la ficha y los estados de carga, caché, desconexión, ausencia de datos y error |

No se modifica `src/storage/session.ts` ni se borra la caché al cerrar sesión. No se crea una nueva pantalla: HU-003 extiende el flujo existente de identificación del medidor.

## 3. Modelo y lógica pura

`src/domain/meter.ts` define el tipo de la ficha con los campos aprobados:

- `meterCode`, `address`, `sector`, `accountNumber` y `status` como texto.
- `lastReading` y `monthlyAverageConsumption` como números.
- `lastReadingDate` como fecha ISO `YYYY-MM-DD`.
- `monthlyAverageConsumptionUnit` como texto.

La función de validación rechaza objetos incompletos, tipos incorrectos, fechas inválidas o un `meterCode` distinto del consultado. El estado se conserva como texto; no se inventa una lista de estados válidos. La fecha se presenta como `dd/MM/yyyy` sin cambiar el valor recibido.

La vigencia se calcula hasta la próxima medianoche de `America/Guayaquil`. La lógica de dominio permite inyectar el instante actual para comprobar los límites con Jest.

```text
parseMeterResults(results, requestedCode):
  si results no es una colección -> error de respuesta
  si results tiene cero elementos -> no encontrado
  si results tiene más de un elemento -> respuesta ambigua
  validar tipos, fecha y coincidencia exacta de meterCode
  si falla la validación -> error de respuesta
  devolver ficha válida

getCacheExpiry(now):
  obtener la fecha local de America/Guayaquil
  devolver el instante de la siguiente medianoche de esa zona
```

La app conserva la respuesta completa como una unidad para no mezclar campos de consultas distintas (D-03).

## 4. Cliente de la API

`src/api/meters.ts` consulta `https://6ad90cb3f89c5702ed9a631a.mockapi.io/api/v1/medidores?meterCode=<código>`, usando el código normalizado y una petición GET sin autenticación (D-12, D-13).

El cliente distingue:

- colección sin resultados: medidor no encontrado;
- exactamente un registro válido: datos del medidor;
- más de un registro: respuesta ambigua;
- error HTTP, error de conectividad, cuerpo vacío o esquema inválido: error de consulta.

El cliente no convierte unidades ni sustituye errores o resultados ambiguos por una ficha vacía. Las pruebas simulan `fetch`; ninguna prueba automatizada depende de que el recurso remoto esté disponible.

## 5. Caché persistente y conectividad

`src/query/query-client.ts` configura TanStack Query y `@tanstack/query-async-storage-persister` sobre AsyncStorage. La consulta se identifica con una clave que incluye el código del técnico y el código normalizado del medidor. La misma clave no se comparte entre técnicos.

AsyncStorage no cifra los datos. D-01 aprueba expresamente su uso para esta caché; la sesión permanece en SecureStore.

Cada dato cacheado incluye su instante de expiración. Al restaurar la caché y antes de mostrar una consulta, la aplicación elimina las entradas cuya vigencia terminó. El QueryClient y el persister deben conservar los datos el tiempo suficiente para realizar esa limpieza en el siguiente inicio; la vigencia diaria individual se determina con `getCacheExpiry`, no con un TTL relativo fijo.

`expo-network` informa a `onlineManager` de los cambios de conectividad. Las consultas pausadas sin red se reanudan al reconectar. Cerrar sesión no elimina las consultas persistidas (D-07 de HU-001 y D-08 de HU-003); la separación por código de empleado impide mostrarlas a otro técnico.

## 6. Comportamiento de la interfaz

`src/app/medidor.tsx` mantiene la captura actual. Al completar un código válido ofrece `Consultar`; al pulsarlo:

- Si hay caché vigente, muestra la ficha inmediatamente e intenta actualizarla en segundo plano si hay señal.
- Si no hay caché vigente y la consulta comienza con señal, muestra un indicador y `Consultando datos del medidor…`.
- Si no hay conexión y hay caché vigente, muestra la ficha con aviso de posible desactualización.
- Si no hay conexión ni caché vigente, informa que no hay datos actuales.
- Si la API devuelve cero registros, informa «no encontrado» y conserva la ficha válida anterior, marcada como desactualizada si se muestra.
- Si hay error HTTP, de red, respuesta inválida o varios registros, muestra el estado de error y conserva la ficha válida existente.
- Muestra dirección, sector, cuenta, estado, última lectura, fecha formateada y consumo mensual con la unidad recibida.

Se conservan los objetivos táctiles, etiquetas accesibles, textos en español y estados legibles definidos en `rn-conventions`. No se añade navegación nueva.

## 7. Decisiones técnicas y alternativas descartadas

| Decisión | Fundamento | Alternativa descartada |
|---|---|---|
| TanStack Query con persistencia AsyncStorage | D-01; caché de consulta persistente aprobada | solo caché en memoria, que se pierde al reiniciar; SQLite, sustituido por la elección aprobada |
| Clave por técnico y medidor | D-08; aislamiento entre técnicos sin borrar al cerrar sesión | clave solo por medidor, que compartiría datos |
| Expiración a medianoche de `America/Guayaquil` | D-06; la vigencia es por día local, no por una ventana relativa desde la consulta | TTL fijo desde la hora de consulta, que no coincide necesariamente con el cambio de día |
| `expo-network` conectado a `onlineManager` | D-02; control de consultas al perder o recuperar conectividad | repetir peticiones sin estado de red |
| `fetch` nativo para HTTP | no requiere una dependencia adicional para GET; el contrato aprobado no necesita interceptores | Axios, que añade dependencia sin comportamiento requerido |
| Sin mutaciones ni cola offline | D-03 y HU-003 | guardar o reintentar operaciones de escritura no definidas |

## 8. Estrategia de pruebas

- `src/domain/__tests__/meter.test.ts`: valida los campos, tipos, código asociado, fecha ISO, formato visible, cero/uno/varios resultados y límites de expiración alrededor de la medianoche de Ecuador.
- `src/api/__tests__/meters.test.ts`: simula HTTP exitoso, cero resultados, varios resultados, error HTTP, rechazo de red, cuerpo vacío y datos que no cumplen el esquema.
- Pruebas focalizadas de caché: comprueban que la query key incluye técnico y medidor, que una entrada vigente se presenta de inmediato y que una vencida se elimina sin persistir otra ficha bajo su clave.
- `npx jest` y `npx tsc --noEmit` en la validación final.
- La configuración visual y conectividad se verifican manualmente en Expo Go. La petición real queda pendiente hasta que el usuario configure el recurso remoto.

## 9. Trazabilidad de requisitos

| Requisito | Cobertura prevista |
|---|---|
| RF-01 | `src/api/meters.ts` y acción `Consultar` en `src/app/medidor.tsx` |
| RF-02, RF-10 | validación del modelo y presentación de ficha en dominio e interfaz |
| RF-03, RF-07 | `src/query/query-client.ts` y lógica de expiración del dominio |
| RF-04 | query cache-first, actualización en segundo plano y `onlineManager` |
| RF-05, RF-06 | estados de caché vigente, desconexión y falta de datos en la pantalla |
| RF-08, RF-09, RF-12 | clasificación de respuestas en API/dominio y estados visibles en la pantalla |
| RF-11 | estado de carga inicial en la pantalla |
| RNF-01 | lógica de respuesta, fecha y expiración comprobable en dominio |
| RNF-02 | estados visibles y verificación manual de interfaz |
| RNF-03 | clave de caché aislada por empleado y medidor |

## 10. Validación final

- `npx jest` en verde.
- `npx tsc --noEmit` sin errores.
- En Expo Go, revisar la lista manual de `rn-conventions`: adaptación al dispositivo y áreas seguras, textos en español, accesibilidad y objetivos táctiles, indicador de carga, resultados, errores, falta de conexión y ausencia de datos.
- Verificar que la ficha cacheada se muestra sin esperar red, persiste tras reiniciar y no se comparte entre técnicos. Las pruebas de dominio comprueban su vencimiento al cambiar el día de Ecuador.
- Verificar desconexión y recuperación de señal con el dispositivo.
- Probar en MockAPI los casos de cero, uno y varios resultados cuando el recurso remoto esté configurado. Hasta entonces, dejar esta validación indicada como pendiente y no afirmar que la integración real pasó.
