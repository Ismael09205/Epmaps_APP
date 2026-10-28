# ADR-006: Usar Valibot para validar los datos del formulario de lectura

* **Estado:** Aceptado
* **Fecha:** 2026-10-27
* **Requisitos relacionados:** R5, R6, R10

---

### Contexto
El formulario de lectura cambia según el estado del medidor:
- **Normal:** la lectura es obligatoria.
- **Inaccesible:** el motivo es obligatorio y no se registra lectura.
- **Dañado:** la descripción del daño es obligatoria y la lectura es opcional.

El valor de la lectura llega como texto y debe convertirse a número con reglas de decimales, mientras que los textos libres tienen una longitud de 10 a 100 caracteres y un conjunto de caracteres permitido. Las reglas deben poder probarse sin interfaz (constitución, principio 9) y producir mensajes en español por campo. Validar mal significa guardar datos incorrectos que luego se sincronizan con la oficina.

---

### Alternativas Consideradas

| Alternativa | Ventajas en este proyecto | Desventajas en este proyecto |
| :--- | :--- | :--- |
| **Valibot** | `v.variant` modela las variantes del formulario. Esquemas componibles con transformación. Paquete liviano y modular. Inferencia de tipos. | Menos documentación y ejemplos. API funcional menos familiar. |
| **Zod** | Amplia documentación. Uniones discriminadas. | Paquete más pesado para el mismo resultado. |

---

### Decisión
Se elige **Valibot** porque modela de forma declarativa y tipada las reglas condicionales por estado del medidor y la conversión del valor de lectura. Además mantiene la validación en la capa de dominio, separada de la interfaz y fácil de probar con Jest.

* **Configuración / Reglas técnicas específicas:**
  * Los esquemas viven en `src/domain/reading.ts` (`ReadingFormSchema`).
  * Se ejecuta con `v.safeParse` y los *issues* se traducen a `ReadingFormErrors` por campo.
  * Notas: 10–100 caracteres, solo letras, números, espacios, coma, punto y guion.

---

### Consecuencias

* **Ganancias:** Una sola definición de reglas produce el tipo de salida y los mensajes de error. Los casos por estado del medidor quedan explícitos y cubiertos por pruebas.
* **Riesgos / Costos:** Si cambian las reglas en una HU, hay que actualizar el esquema y sus pruebas a la vez. Una actualización mayor de Valibot puede cambiar su API. Por ahora solo se usa en el formulario de lectura; las demás validaciones (por ejemplo, el código `MED-`) siguen siendo funciones propias, así que conviven dos estilos.
* **Impacto en el código:** Las pantallas no validan por su cuenta: llaman a `validateReadingForm` y muestran los errores que devuelve.

---

### Verificación
1. Revisar los archivos en `src/domain/reading.ts` y `src/domain/__tests__/reading.test.ts`.
2. Verificar en `package.json` la presencia de `valibot`.
3. Validar el comportamiento en el dispositivo: elegir "Inaccesible" con un motivo de menos de 10 caracteres y comprobar que no se pueda guardar. Elegir "Normal" sin lectura y comprobar el mensaje. Ejecutar `npx jest src/domain/__tests__/reading.test.ts`.

---

### Uso de IA
* **Consulta realizada:** Se pidió a la IA comparar Valibot y Zod para el formulario de lectura, cuyas reglas cambian según el estado del medidor.
* **Propuesta de la IA:** La IA recomendó Valibot por su menor peso y por `v.variant`, que modela las variantes del formulario de forma directa.
* **Decisión sobre la respuesta:** Se aceptó la recomendación tras evaluar el peso del paquete y la falta de experiencia previa del equipo, que se consideró un costo asumible.
