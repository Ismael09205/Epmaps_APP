# ADR-007: Usar expo-camera para capturar la foto del medidor dentro de la app

* **Estado:** Aceptado
* **Fecha:** 2026-10-27
* **Requisitos relacionados:** R6, R7

---

### Contexto
La foto del medidor es obligatoria cuando el consumo supera el triple del promedio o el medidor está dañado, y opcional en los demás casos. Hoy las fotos se envían por WhatsApp y se pierden o se confunden. La app debe:
- Tomar la foto en el mismo flujo de registro para asociarla a la lectura.
- Pedir el permiso de cámara y explicar por qué se necesita si el técnico lo niega.
- Permitir continuar cuando la foto no es obligatoria.

Todo esto debe funcionar sin conexión.

---

### Alternativas Consideradas

| Alternativa | Ventajas en este proyecto | Desventajas en este proyecto |
| :--- | :--- | :--- |
| **expo-camera** | Cámara integrada en la pantalla (`CameraView`). Control de permisos con `useCameraPermissions`. Calidad de imagen configurable. Módulo oficial de Expo. | Interfaz de captura propia. La foto se guarda en un directorio temporal. |
| **expo-image-picker** | Usa la cámara nativa del sistema, sin interfaz propia. | Abre una app externa y la app puede cerrarse por memoria. Permite elegir fotos de la galería. |
| **react-native-vision-camera** | Alto rendimiento y procesamiento de frames. | Configuración nativa adicional. Complejidad innecesaria para una foto por lectura. |

---

### Decisión
Se elige **expo-camera** porque la foto se toma dentro del flujo de registro, lo que garantiza que corresponde al medidor visitado. Además da control del permiso para cumplir lo requerido sin dependencias nativas adicionales.

* **Configuración / Reglas técnicas específicas:**
  * Cámara trasera (`facing="back"`) y calidad `0.7` para reducir el peso de las fotos que se guardan durante días.
  * El componente es `src/components/meter-photo-capture.tsx`.

---

### Consecuencias

* **Ganancias:** Evidencia fotográfica asociada al registro y sin fotos de galería. El manejo de permisos es coherente con la constitución (principio 11).
* **Riesgos / Costos:** Si el técnico niega el permiso de forma permanente, solo puede concederlo desde los ajustes del sistema, y mientras tanto no podrá guardar lecturas que exigen foto. La cámara consume batería y memoria en teléfonos de gama baja. No funciona en simuladores sin cámara, por lo que se requiere prueba manual en un dispositivo.
* **Impacto en el código:** Toda foto tomada debe persistirse con `persistReadingPhoto` (ADR-008) antes de asociarla a la lectura o al borrador. Nunca se guarda la URI temporal.

---

### Verificación
1. Revisar el archivo `src/components/meter-photo-capture.tsx`.
2. Verificar en `package.json` la presencia de `expo-camera` y en `app.json` el texto del permiso de cámara.
3. Validar el comportamiento en el dispositivo: negar el permiso y comprobar el mensaje explicativo. Registrar un medidor dañado y comprobar que exige foto. Registrar uno normal con consumo habitual y comprobar que permite continuar sin foto.

---

### Uso de IA
* **Consulta realizada:** Se consultó a la IA qué opción usar para tomar la foto del medidor: expo-camera, expo-image-picker o react-native-vision-camera.
* **Propuesta de la IA:** La IA recomendó expo-camera para capturar la foto dentro del flujo de registro y controlar el permiso de cámara.
* **Decisión sobre la respuesta:** Se aceptó la recomendación. Se descartó expo-image-picker porque permite elegir fotos de la galería y se definió una calidad de 0.7 para reducir el peso de las fotos.
