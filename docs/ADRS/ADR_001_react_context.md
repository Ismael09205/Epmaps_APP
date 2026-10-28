# ADR-001: Uso de React Context para manejo de credenciales quemadas

* **Estado:** Aceptado
* **Fecha:** 28/10/2026
* **Requisitos relacionados:** R1 (en la parte que indica el manejo de credenciales para los técnicos)

---

### Contexto
La aplicación debe ser capaz de manejar credenciales de los técnicos. El técnico debe poder identificarse dentro de la aplicación con un código de empleado y una clave para mantener la sesión iniciada hasta que cierre sesión. Todo esto se realiza mediante datos quemados los cuales deben manejarse dentro de la app para permitir un inicio de sesión exitoso.

---

### Alternativas Consideradas

| Alternativa | Ventajas en este proyecto | Desventajas en este proyecto |
| :--- | :--- | :--- |
| **Zustand** | Estado global en un hook, sin *Providers*. Suscripción selectiva que evita re-renderizados. | Dependencia externa adicional. Sobredimensionado para un único estado de sesión. |
| **React Context** | API nativa de React, sin dependencias. Comparte la sesión entre pantallas con un solo proveedor. | Re-renderiza a todos los consumidores al cambiar el valor. Requiere envolver la app en un *Provider*. No escala a estados globales complejos. |

---

### Decisión
Se escogió **React Context** debido a su simplicidad. Al manejar datos quemados para la autenticación básica, la incorporación de una librería externa como Zustand resultaba innecesaria. Al gestionar un único estado global (autenticación), la API nativa de React Context permite implementar la solución mediante un proveedor centralizado proporcional a las necesidades actuales.

---

### Consecuencias
* **Ganancias:**
  * No se agrega ninguna librería o dependencia externa al proyecto.
  * Simplicidad en el manejo y lectura del estado de sesión entre pantallas.
* **Riesgos y Desventajas:**
  * **Limitación futura:** Si se requieren manejar estados más complejos de sesión (como tokens o códigos de autenticación dinámicos), React Context se quedará corto.
  * **Riesgo:** Pérdida de sesión al cerrar la aplicación, ya que el estado almacenado únicamente en memoria vuelve a su valor inicial al reiniciar la app.

---

### Verificación
* La lógica centralizada del Context se encuentra en `src/auth/sesión-context.tsx`.
* Se puede verificar su integración en `src/app/_layout.tsx` y su consumo en `src/app/medidor.tsx` para asociar las lecturas realizadas a cada técnico.

---

### Uso de IA
Se solicitó a la IA comparar React Context y Zustand para el manejo de estados de autenticación. La IA recomendó React Context, decisión que se aceptó tras evaluar pros y contras. Se descartó la recomendación inicial de usar Zustand por considerarla una sobrecapacidad para el alcance del proyecto.