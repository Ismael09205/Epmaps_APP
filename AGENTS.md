# AGENTS.md — Aplicación móvil para el registro de lecturas de medidores de agua de EPMAPS

Aplicación móvil para técnicos de EPMAPS que permite registrar lecturas de medidores de agua durante sus recorridos, adjuntar evidencia fotográfica y conservar los registros sin conexión. Los datos pendientes se sincronizan cuando se recupera la conectividad, evitando pérdidas y duplicaciones.

## Stack y estructura

- Expo, React Native, TypeScript y Expo Router.
- Persistencia local para conservar lecturas y datos necesarios para el funcionamiento sin conexión.
- `src/domain/`: lógica pura del dominio, sin dependencias de React ni del almacenamiento.
- `src/storage/`: persistencia local.
- `app/`: pantallas y navegación.
- Pruebas junto a cada módulo, dentro de `__tests__/`.
- `docs/constitution.md`: principios y restricciones del proyecto.
- `docs/historias/`: historias de usuario.
- `specs/NNN-nombre/`: especificaciones, decisiones, planes, tareas y memoria de cada iniciativa.
- `.opencode/skills/`: skills específicas del proyecto, como `sdd` y `rn-conventions`.

La estructura real del repositorio y las decisiones aprobadas prevalecen sobre cualquier ejemplo de esta guía.

## Comandos

- Ejecutar la aplicación: `npx expo start`.
- Ejecutar las pruebas: `npx jest`.
- Verificar TypeScript: `npx tsc --noEmit`.
- No ejecutar comandos adicionales que alteren dependencias o archivos sin autorización.

## Convenciones

- Código, clases, funciones, variables e identificadores en inglés.
- Textos visibles de la interfaz, comentarios y documentación en español.
- Aplicar las reglas funcionales definidas en las historias de usuario (HU) y las especificaciones aprobadas.
- Las decisiones funcionales se documentan en `specs/NNN-nombre/decisiones.md` y se toman a partir de las HU y las aclaraciones aprobadas.
- Utilizar las skills pertinentes para cada tarea: `sdd` para el proceso de desarrollo y `rn-conventions` para las pantallas, formularios y componentes de React Native.
- Mantener una interfaz clara, legible y práctica para técnicos que trabajan en campo.
- Respetar las convenciones de accesibilidad, adaptación a pantalla y presentación de estados definidas en las skills y especificaciones aprobadas.

## Forma de trabajar

- Leer `MEMORY.md`, `docs/constitution.md` y la especificación activa antes de modificar código.
- Revisar las HU, decisiones, plan y tareas correspondientes a la iniciativa.
- Inspeccionar el código existente antes de proponer cambios.
- Seguir el flujo SDD: decisiones necesarias, especificación, plan, tareas, implementación y validación.
- Trabajar únicamente en la fase y tarea autorizadas.
- Implementar una tarea a la vez, salvo que el usuario autorice explícitamente varias.
- No asumir requisitos funcionales ni tomar decisiones de producto no aprobadas.
- Si falta una definición necesaria, marcarla como `[NECESITA ACLARACIÓN]` y solicitar aclaración antes de continuar con la parte afectada.

## Límites

- Priorizar pruebas antes de implementar o modificar lógica de dominio.
- No instalar dependencias sin autorización.
- No crear archivos fuera del plan aprobado.
- No cambiar formatos de datos persistidos sin autorización.
- No reemplazar archivos existentes sin autorización.
- No añadir funcionalidades, pantallas ni comportamientos que no estén contemplados en las HU o especificaciones aprobadas.
- No asumir políticas de sincronización, reintentos, resolución de conflictos ni eliminación de registros que no estén definidas.
- No perder ni duplicar registros durante la captura, persistencia o sincronización.
- Mantener la asociación correcta entre cada lectura, su medidor y la evidencia fotográfica correspondiente, cuando aplique.
- No eliminar ni modificar registros o fotografías existentes sin autorización.
- No realizar commits sin autorización.
- No afirmar que una validación pasó si no se ejecutó.

## Memoria

- Al comenzar, leer el `MEMORY.md` de la iniciativa activa.
- Al terminar una fase SDD o una tarea, actualizar únicamente las secciones `Estado actual` y `Próximos pasos`.
- Indicar en `Próximos pasos` la siguiente fase o el agente que corresponde ejecutar.
- No copiar decisiones, especificaciones ni detalles de implementación a la memoria; remitir a los documentos correspondientes.
- Mantener `MEMORY.md` conciso, con un máximo aproximado de 50 líneas.

## Verificación

- **Lógica:** ejecutar `npx jest` y revisar las pruebas de los módulos afectados.
- **Tipos:** ejecutar `npx tsc --noEmit` cuando corresponda.
- **Persistencia:** verificar los escenarios definidos para guardar, recuperar y conservar los registros.
- **Funcionamiento sin conexión:** comprobar los escenarios aprobados para registrar lecturas sin conectividad y conservar los datos localmente.
- **Sincronización:** verificar los escenarios definidos para enviar registros pendientes, recuperarse de interrupciones y evitar duplicaciones.
- **Integridad de datos:** comprobar que cada lectura conserve su asociación correcta con el medidor y la evidencia correspondiente.
- **Interfaz:** comprobar manualmente la tarea en Expo Go y revisar legibilidad, adaptación a pantalla, accesibilidad y estados interactivos.
- **Cámara y fotografías:** verificar los permisos y escenarios correspondientes cuando estas funcionalidades estén dentro del alcance de la tarea.
- Informar los archivos modificados, las pruebas ejecutadas, sus resultados y las comprobaciones pendientes.
- No marcar como completada una tarea que todavía requiera una validación manual pendiente.
- No afirmar que el funcionamiento sin conexión o la sincronización son correctos si los escenarios correspondientes no se han verificado.


## Skills de calidad

- Utilizar `antislop` para evitar soluciones genéricas y complejidad innecesaria.
- Cargar las skills anti-slop especializadas según la tarea: código, copywriting, accesibilidad, diseño adaptable o interfaz visual.
- Leer las instrucciones de cada skill antes de aplicarla.
- Las skills no autorizan cambios fuera del alcance aprobado ni prevalecen sobre la constitución, las HU, la spec o el plan aprobado.