# ADR-008: Usar expo-file-system para conservar las fotos del medidor hasta su envío

* **Estado:** Aceptado
* **Fecha:** 2026-10-27
* **Requisitos relacionados:** R7, R8

---

### Contexto
La cámara (ADR-007) guarda cada foto en un directorio de caché temporal que el sistema operativo puede vaciar en cualquier momento. Se exige conservar la foto en el teléfono, aunque pasen varios días sin señal, hasta que se envíe la lectura. Por su parte, se exige que una captura descartada no deje fotos huérfanas, pero sin borrar nunca la foto de una lectura guardada. Guardar la imagen dentro de la base de datos aumentaría mucho su tamaño.

---

### Alternativas Consideradas

| Alternativa | Ventajas en este proyecto | Desventajas en este proyecto |
| :--- | :--- | :--- |
| **expo-file-system** | Almacenamiento persistente en `Paths.document`. API `Directory`/`File` para copiar, comprobar y borrar. La base solo guarda la ruta. | Foto y registro separados: la consistencia se mantiene a mano. Las fotos ocupan espacio hasta su envío. |
| **expo-media-library** | Fotos visibles en la galería. | Permiso adicional. Las fotos pueden borrarse o modificarse fuera de la app. |
| **Guardar la imagen en base64 dentro de SQLite** | Foto y lectura en un solo registro. | Base más pesada. Consultas más lentas y mayor uso de memoria. |
| **Usar la URI temporal de la cámara** | Sin código adicional. | El sistema puede borrar el archivo en cualquier momento. |

---

### Decisión
Se elige **expo-file-system** porque mueve la foto a un almacenamiento persistente y privado de la app, donde se conserva hasta el envío. La lectura en SQLite queda asociada solo con la ruta del archivo.

* **Configuración / Reglas técnicas específicas:**
  * Carpeta `Paths.document/reading-photos`, que se crea si no existe.
  * Nombre de archivo `<código-medidor>-<timestamp>.jpg`, para que no colisionen dos fotos.
  * `deleteReadingPhoto` solo se usa con fotos de capturas descartadas o reemplazadas, nunca con fotos de lecturas guardadas.

---

### Consecuencias

* **Ganancias:** Las fotos sobreviven a cierres de la app y a la limpieza de caché del sistema. La base de datos sigue siendo pequeña y la evidencia no se expone en la galería.
* **Riesgos / Costos:** Si se borra un registro sin borrar su foto, o al revés, quedan archivos huérfanos o lecturas sin evidencia. Con muchos días sin señal y muchas fotos, el almacenamiento del teléfono puede llenarse. Las fotos se pierden si se desinstala la app.
* **Impacto en el código:** Toda foto debe pasar por `persistReadingPhoto` antes de guardarse en un borrador o una lectura, y todo descarte de borrador debe llamar a `deleteReadingPhoto`.

---

### Verificación
1. Revisar los archivos en `src/storage/photos.ts` y `src/storage/__tests__/photos.test.ts`.
2. Verificar en `package.json` la presencia de `expo-file-system`.
3. Validar el comportamiento en el dispositivo: tomar una foto en modo avión, guardar la lectura y cerrar la app; al reabrirla días después la foto debe seguir visible. Descartar un borrador con foto y comprobar que se elimine. Ejecutar `npx jest src/storage/__tests__/photos.test.ts`.

---

### Uso de IA
* **Consulta realizada:** Se preguntó a la IA cómo conservar las fotos hasta el envío, comparando expo-file-system, la galería, base64 en SQLite y la URI temporal de la cámara.
* **Propuesta de la IA:** La IA sugirió copiar las fotos a `Paths.document` con expo-file-system y guardar solo la ruta en SQLite.
* **Decisión sobre la respuesta:** Se aceptó la sugerencia y se añadió la regla de borrar únicamente las fotos de capturas descartadas o reemplazadas.
