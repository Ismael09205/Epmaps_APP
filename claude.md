# EPMAPS — Instrucciones del proyecto

## Problemática
EPMAPS necesita una aplicación móvil para registrar lecturas mensuales de medidores de agua en Quito, incluidas parroquias rurales con conectividad limitada o inexistente. Actualmente, las lecturas se recopilan mediante fotos y WhatsApp, lo que genera errores de transcripción, pérdida de información y dificultades de trazabilidad.

La aplicación debe permitir registrar lecturas en campo con evidencia fotográfica, conservar los datos sin conexión y sincronizarlos con la oficina al recuperar conectividad.

## Reglas
- Respeta las tecnologías, arquitectura y decisiones técnicas definidas por el usuario.
- No propongas alternativas tecnológicas, rediseños ni dependencias adicionales.
- Implementa directamente la HU solicitada, sin generar planes ni documentos intermedios.
- Consulta únicamente los requisitos y archivos necesarios para implementar la HU.
- No releas ni analices información que ya esté disponible en el contexto.
- No implementes funcionalidades adicionales ni modifiques código ajeno a la tarea.
- Si falta información imprescindible o existen contradicciones, pregunta antes de asumir.
- Necesito que me preguntes que tecnologia o libreria deberias de usar pero solo preguntame no propongas nada y yo te paso la tecnologia que debes usar para solventar la HU

## Requisitos esenciales
- Registrar y consultar lecturas sin conexión.
- Guardar localmente cada lectura y su fotografía antes de sincronizar.
- Sincronizar automáticamente los registros pendientes al recuperar conexión.
- Tolerar interrupciones y reintentos sin duplicar lecturas.
- Asociar cada lectura con el medidor y período correctos.
- Respetar las reglas de edición, envío y trazabilidad definidas en las HU.

## Verificación
- Comprueba los criterios de aceptación de la HU implementada.
- Ejecuta únicamente las pruebas pertinentes.
- Corrige los errores causados por los cambios realizados.
- Informa brevemente qué implementaste y qué pruebas ejecutaste.