# ADR-009: Usar expo-network para detectar la conexión y disparar el envío diferido

* **Estado:** Aceptado
* **Fecha:** 2026-10-27
* **Requisitos relacionados:** R3, R4, R9

---

### Contexto
La app necesita saber en todo momento si hay conexión para:
- Mostrar en todas las pantallas el estado de conexión.
- Decidir si consultar al sistema de la oficina o usar la caché.
- Registrar la lectura como pendiente de verificar cuando no hay señal.
- Enviar las lecturas pendientes y verificarlas en cuanto vuelva la conexión.

En zonas rurales es común estar conectado a una red sin acceso real a internet, por lo que no basta con saber si hay Wi-Fi o datos. TanStack React Query (ADR-003) necesita además una fuente de conectividad nativa para pausar y reanudar los envíos.

---

### Alternativas Consideradas

| Alternativa | Ventajas en este proyecto | Desventajas en este proyecto |
| :--- | :--- | :--- |
| **expo-network** | Eventos de cambio de red y estado inicial. Expone `isConnected` e `isInternetReachable`. Módulo oficial de Expo. | `isInternetReachable` puede devolver `null`. No detecta si el servidor responde. |
| **@react-native-community/netinfo** | Muy usada. Misma información de red. | Dependencia comunitaria adicional. |
| **Sondear el servidor con peticiones periódicas** | Verifica que el servidor responde. | Consume batería y datos. |

---

### Decisión
Se elige **expo-network** porque da eventos nativos de cambio de red con información sobre el acceso real a internet. Se conecta al `onlineManager` de TanStack para pausar y reanudar los envíos automáticamente.

* **Configuración / Reglas técnicas específicas:**
  * Se considera en línea si `isConnected === true` y `isInternetReachable !== false` (`isNetworkStateOnline`).
  * Si no se puede leer el estado inicial, se asume sin conexión.
  * `setupNetworkManager` registra la escucha en `onlineManager`. `setupReadingVerification` verifica y envía los pendientes al pasar a en línea.

---

### Consecuencias

* **Ganancias:** Una sola fuente de conectividad para toda la app: el aviso de conexión, la caché y el envío reaccionan al mismo estado.
* **Riesgos / Costos:** Un falso "en línea" (red sin salida real a internet mientras `isInternetReachable` es `null`) dispara envíos que fallan. Por eso los envíos tienen reintentos con espera (ADR-003). Un falso "sin conexión" retrasa los envíos hasta el siguiente cambio de red o la reapertura de la app.
* **Impacto en el código:** Las pantallas no consultan `expo-network` directamente; leen el estado mediante `onlineManager` (por ejemplo, `ConnectionBanner`). Cualquier nueva acción dependiente de la red debe usar ese mismo estado.

---

### Verificación
1. Revisar los archivos en `src/query/query-client.ts`, `src/query/reading-verification.ts` y `src/components/connection-banner.tsx`.
2. Verificar en `package.json` la presencia de `expo-network`.
3. Validar el comportamiento en el dispositivo: activar y desactivar el modo avión en cada pantalla y comprobar que el aviso de conexión cambie, y que al reconectar se envíen los pendientes. Ejecutar `npx jest src/query`.

---

### Uso de IA
* **Consulta realizada:** Se consultó a la IA cómo detectar la conexión en React Native e integrarla con TanStack React Query, comparando expo-network, NetInfo y sondeo al servidor.
* **Propuesta de la IA:** La IA recomendó expo-network conectado a `onlineManager` y advirtió que `isInternetReachable` puede devolver `null`.
* **Decisión sobre la respuesta:** Se aceptó la recomendación y se definió considerar la app en línea cuando `isConnected` es verdadero e `isInternetReachable` no es falso, apoyándose en los reintentos de envío para los falsos positivos.
