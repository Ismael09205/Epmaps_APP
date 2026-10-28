# Tareas: Spec 003: Consulta y almacenamiento en caché de datos del medidor

Estado: aprobado, implementación en curso
Plan: specs/003-Consulta-Almacenamiento-cache/plan.md

Orden por dependencias. Completar y verificar cada tarea antes de pasar a la siguiente. La instalación de dependencias está autorizada en D-01 y D-02; no se realiza durante la fase de planificación.

## T1: Instalar dependencias de consulta, persistencia y conectividad

- **Estado:** completada.
- **Duración estimada:** 25 minutos.
- **Depende de:** ninguna.
- **Acción:** instalar `@tanstack/react-query`, `@tanstack/react-query-persist-client` y `@tanstack/query-async-storage-persister`; instalar `@react-native-async-storage/async-storage` y `expo-network` con `npx expo install`, según D-01 y D-02. Autorización registrada en las decisiones.
- **Archivos:** `package.json`, `package-lock.json`.
- **RF:** habilita RF-03, RF-04 y RF-07.
- **Hecho cuando:** las dependencias están registradas, `npx tsc --noEmit` no muestra errores nuevos y `npx jest` sigue en verde. **Cumplido:** ambos comandos finalizaron correctamente.
- **Verificación:** `npx tsc --noEmit`, `npx jest`.

## T2: Modelar y validar datos del medidor

- **Estado:** completada.
- **Duración estimada:** 25 minutos.
- **Depende de:** ninguna.
- **Acción:** crear `src/domain/meter.ts` con el tipo de respuesta aprobada, validación de campos y código asociado, tratamiento de cero/uno/varios resultados, formato de fecha y cálculo de expiración al siguiente cambio de día en `America/Guayaquil` (D-06, D-12, D-13).
- **Archivos:** `src/domain/meter.ts`, `src/domain/__tests__/meter.test.ts`.
- **RF:** RF-02, RF-07, RF-08, RF-09, RF-10, RF-12, RNF-01.
- **Hecho cuando:** `npx jest src/domain/__tests__/meter.test.ts` comprueba campos faltantes y tipos inválidos, fechas válidas e inválidas, código coincidente y no coincidente, cero/uno/varios resultados, formato visible de fecha y expiración antes y después de medianoche en Ecuador.
- **Verificación:** `npx jest src/domain/__tests__/meter.test.ts` (22 pruebas) y `npx tsc --noEmit`, ambos correctos.

## T3: Implementar cliente de consulta MockAPI

- **Estado:** completada.
- **Duración estimada:** 25 minutos.
- **Depende de:** T2.
- **Acción:** crear el cliente GET del recurso `medidores` con filtro por código y conversión de resultados a ficha válida, «no encontrado», respuesta ambigua o error, sin autenticación y sin reemplazar respuestas válidas con errores (D-12, D-13).
- **Archivos:** `src/api/meters.ts`, `src/api/__tests__/meters.test.ts`.
- **RF:** RF-01, RF-02, RF-08, RF-09, RF-12.
- **Hecho cuando:** las pruebas simuladas cubren uno, cero y varios registros, error HTTP, rechazo de red, cuerpo vacío y esquema inválido; ninguna requiere que el recurso remoto exista.
- **Verificación:** `npx jest src/api/__tests__/meters.test.ts` (7 pruebas) y `npx tsc --noEmit`, ambos correctos.

## T4: Configurar QueryClient, persistencia y vencimiento

- **Estado:** completada.
- **Duración estimada:** 30 minutos.
- **Depende de:** T1, T2.
- **Acción:** crear la configuración de TanStack Query con persister AsyncStorage y claves por código de empleado y código de medidor; restaurar la caché, retirar entradas vencidas al iniciar o consultar y conectar `expo-network` con `onlineManager`. No borrar la caché al cerrar sesión (D-01, D-02, D-06, D-08).
- **Archivos:** `src/query/query-client.ts` y, si hace falta para el comportamiento probado, pruebas focalizadas del módulo.
- **RF:** RF-03, RF-04, RF-07, RNF-01, RNF-03.
- **Hecho cuando:** las pruebas verifican aislamiento de claves por técnico, persistencia entre reinicios simulados, eliminación de entradas vencidas y reanudación de consultas al recuperar conectividad.
- **Verificación:** `npx jest src/query/__tests__/query-client.test.ts --runInBand` (4 pruebas) y `npx tsc --noEmit`, ambos correctos.

## T5: Montar proveedores en navegación raíz

- **Estado:** implementación lista; validación manual en Expo Go pendiente.
- **Duración estimada:** 20 minutos.
- **Depende de:** T1, T4.
- **Acción:** integrar el proveedor persistente en `src/app/_layout.tsx` sin alterar la carga de sesión, la protección de rutas ni el estado de autenticación. Mantener el almacenamiento SecureStore de sesión intacto.
- **Archivos:** `src/app/_layout.tsx`.
- **RF:** RF-03, RF-04, RF-07, RNF-03.
- **Hecho cuando:** la app restaura QueryClient antes de consultar, las rutas protegidas siguen requiriendo sesión y cerrar sesión no borra los datos persistidos de otros módulos.
- **Verificación:** `npx tsc --noEmit`, `npx jest` y comprobación manual en Expo Go.

## T6: Integrar consulta y ficha en la pantalla del medidor

- **Estado:** implementación lista; validación manual en Expo Go pendiente.
- **Duración estimada:** 30 minutos.
- **Depende de:** T2, T3, T4, T5.
- **Acción:** modificar `src/app/medidor.tsx` para ofrecer `Consultar` solo con código válido, mostrar la ficha de respuesta completa y estados de carga, caché, falta de conexión, no encontrado, respuesta ambigua y error. La ficha debe conservar la asociación con el código consultado y mostrar el texto exacto de carga aprobado (D-04, D-05, D-07, D-09, D-10, D-12, D-13, D-14).
- **Archivos:** `src/app/medidor.tsx`.
- **RF:** RF-01 a RF-12, RNF-02, RNF-03.
- **Hecho cuando:** el botón solo está disponible con código válido; caché vigente aparece inmediatamente, los estados diferenciados no dependen solo del color, y la fecha y unidad se presentan según la spec.
- **Verificación:** `npx tsc --noEmit`, `npx jest` y lista manual de `rn-conventions` en Expo Go.

## T7: Ejecutar pruebas automatizadas y revisión de tipos

- **Estado:** completada.
- **Duración estimada:** 20 minutos.
- **Depende de:** T1 a T6.
- **Acción:** ejecutar la suite y el chequeo de tipos, corregir únicamente fallos relacionados con HU-003 y verificar la cobertura de todos los RF.
- **Archivos:** ninguno salvo correcciones directamente relacionadas.
- **RF:** RF-01 a RF-12, RNF-01 a RNF-03.
- **Hecho cuando:** `npx jest` y `npx tsc --noEmit` terminan sin errores, y las pruebas cubren validación, contrato, expiración e aislamiento por técnico. **Cumplido:** 7 suites, 77 pruebas y TypeScript sin errores.
- **Verificación:** `npx jest --runInBand` (7 suites, 77 pruebas) y `npx tsc --noEmit`, ambos correctos.

## T8: Verificar escenarios manuales en Expo Go

- **Estado:** bloqueada; la ruta aprobada de MockAPI respondió HTTP 404 a una consulta de prueba.
- **Duración estimada:** 25 minutos una vez disponible el recurso remoto.
- **Depende de:** T6, T7 y configuración externa del recurso `medidores`.
- **Acción:** comprobar en Expo Go carga inicial, ficha, caché inmediata y tras reiniciar, aislamiento entre técnicos, falta y recuperación de conectividad, no encontrado, errores y cardinalidad ambigua. La expiración al cambiar el día se comprueba con las pruebas de dominio. El recurso MockAPI lo configura el usuario fuera de este plan.
- **Archivos:** ninguno.
- **RF:** RF-01 a RF-12, RNF-02, RNF-03.
- **Hecho cuando:** se registran los resultados de cada escenario; si el recurso aún no existe, la verificación de integración queda pendiente y T8 no se marca completada. **Pendiente:** la ruta `https://6ad90cb3f89c5702ed9a631a.mockapi.io/api/v1/medidores?meterCode=__probe__` respondió HTTP 404 y no se ejecutó el click-through manual en Expo Go.
- **Verificación:** lista manual de `rn-conventions` en Expo Go, revisión de consola y pruebas contra el recurso cuando esté configurado.

## Resumen

- 8 tareas. Ninguna supera los 30 minutos de trabajo estimado; T8 requiere además que el usuario configure el recurso remoto.
- Dependencias: T1 y T2 preparan la base; T3 construye la consulta; T4 configura caché y conectividad; T5 monta el proveedor; T6 integra la pantalla; T7 verifica pruebas y tipos; T8 realiza la validación manual real.
- Las dependencias nuevas están autorizadas por D-01 y D-02. No se instalan durante la planificación.
- No se crea ni modifica el recurso remoto MockAPI durante estas tareas.
