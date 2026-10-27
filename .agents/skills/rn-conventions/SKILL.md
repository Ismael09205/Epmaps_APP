---
name: rn-conventions
description: Úsala siempre que crees o modifiques pantallas, formularios o componentes de interfaz de la aplicación móvil de registro de lecturas de medidores.
---

# Convenciones de interfaz en React Native

- Estilos con StyleSheet. Sin librerías de interfaz adicionales, salvo que la planificación aprobada indique lo contrario.
- Evitar diseños genéricos. Priorizar una interfaz clara, práctica y legible para el trabajo en campo.
- Respetar las áreas seguras del dispositivo (muesca y barras del sistema).
- Los formularios no deben quedar tapados por el teclado. Usa un contenedor que se desplace o ajuste y permite tocar los botones con el teclado abierto.
- Los campos numéricos deben utilizar el teclado apropiado para el tipo de dato.
- Las listas deben utilizar FlatList y una clave estable por elemento, nunca el índice.
- Los objetivos táctiles deben tener al menos 44x44 puntos.
- Todos los botones e iconos interactivos deben tener etiquetas de accesibilidad.
- Toda acción destructiva debe solicitar confirmación mediante un diálogo del sistema cuando corresponda.
- Todos los textos visibles deben estar en español.
- Los estados de carga, error, vacío, éxito y falta de conexión deben comunicarse claramente cuando correspondan.
- Los indicadores de estado no deben depender únicamente del color.
- La interfaz debe respetar los requisitos definidos para el funcionamiento sin conexión y la sincronización, sin inventar comportamientos adicionales.
- No introducir componentes, pantallas ni funcionalidades que no estén contemplados en la especificación y el plan aprobados.

## Lista manual de verificación en Expo Go

- [ ] La interfaz se adapta correctamente al dispositivo y respeta las áreas seguras.
- [ ] Los campos y botones siguen siendo accesibles cuando el teclado está abierto.
- [ ] Los textos, etiquetas, botones y mensajes están en español y son legibles.
- [ ] Los objetivos táctiles y las etiquetas de accesibilidad cumplen las convenciones.
- [ ] Los estados de carga, error, vacío y falta de conexión se muestran correctamente cuando corresponda.
- [ ] Los formularios validan los datos conforme a los requisitos de la historia de usuario.
- [ ] Los datos se conservan al cerrar y volver a abrir la aplicación cuando así lo establezcan los requisitos.
- [ ] Las pantallas permiten identificar claramente el estado de sincronización cuando corresponda.
- [ ] Los escenarios sin conexión y de recuperación de conectividad se comportan según los requisitos aprobados.
- [ ] Las fotografías y los datos asociados se visualizan correctamente cuando la funcionalidad esté implementada.
- [ ] Los mensajes de estado pueden entenderse sin depender únicamente del color.
- [ ] No se observan desbordamientos, elementos superpuestos ni controles inaccesibles.