# Constitución — Aplicación móvil EPMAPS

**Principios innegociables del proyecto. Toda historia de usuario, spec, decisión, plan, tarea e implementación debe cumplir esta constitución. Ninguna decisión técnica puede contradecirla sin una modificación explícita y aprobada de la constitución.**

## 1. Simplicidad primero

La aplicación debe mantener una arquitectura simple, comprensible y adecuada a su propósito. No se añaden dependencias, servicios externos ni complejidad innecesaria sin aprobación explícita.

## 2. Las historias de usuario definen el alcance

Ninguna funcionalidad puede implementarse si no está definida en una spec aprobada que la desarrolle. Si falta una decisión de producto o existe una contradicción, se debe marcar como `[NECESITA ACLARACIÓN]` y solicitar una definición antes de continuar.

## 3. La información registrada debe ser íntegra

Los datos registrados deben conservar su integridad durante la captura, el almacenamiento, la consulta y la sincronización. No se deben alterar, perder ni asociar incorrectamente los registros. Las reglas de validación y los comportamientos esperados deben estar definidos en las historias de usuario y las decisiones aprobadas.

## 4. El funcionamiento sin conexión es esencial

Las funcionalidades que deban utilizarse en campo sin conectividad deben funcionar sin datos móviles ni Wi-Fi, de acuerdo con los requisitos aprobados. La pérdida de conexión no debe provocar la pérdida de los registros que deban conservarse localmente.

## 5. La sincronización debe ser confiable

Los registros pendientes deben sincronizarse según las reglas definidas en las historias de usuario. Los errores de conexión, los reintentos y las interrupciones durante los envíos deben gestionarse sin provocar duplicaciones ni pérdida de información. No se deben inventar políticas de reintento, resolución de conflictos o eliminación de registros que no hayan sido aprobadas.

## 6. La trazabilidad debe conservarse

La información necesaria para identificar y consultar los registros realizados debe mantenerse según los requisitos aprobados. Cuando se requiera evidencia fotográfica, esta debe conservar su asociación con la lectura correspondiente. No se deben eliminar ni modificar evidencias o registros históricos sin autorización.

## 7. La interfaz debe facilitar el trabajo en campo

La interfaz debe ser clara, comprensible y adecuada para su uso durante las jornadas de trabajo. Los datos, las acciones disponibles y los estados relevantes deben presentarse de manera consistente. Las decisiones sobre navegación, validaciones, mensajes y comportamiento visual deben respetar las historias de usuario y las especificaciones aprobadas.

## 8. La persistencia debe proteger los datos

Los registros y demás datos que deban conservarse deben persistir según las decisiones aprobadas. Cerrar o reabrir la aplicación no debe provocar pérdidas de información que deba mantenerse. Los cambios de código no pueden invalidar, sobrescribir ni eliminar datos existentes sin autorización.

## 9. La lógica debe estar separada de la interfaz

Las reglas de negocio y los procesos de validación, persistencia y sincronización deben organizarse de manera que puedan comprobarse independientemente cuando corresponda. La lógica de negocio no debe depender innecesariamente de los componentes visuales, y su diseño debe respetar la arquitectura definida y aprobada para el proyecto.

## 10. Las pruebas son obligatorias

La lógica debe probarse con Jest. Los criterios de aceptación de cada historia de usuario deben verificarse antes de considerar terminada su implementación. Las pruebas manuales deben realizarse cuando sean necesarias para comprobar el comportamiento de la interfaz, la conectividad y las funcionalidades que no puedan validarse adecuadamente mediante pruebas automatizadas.

No se debe avanzar con pruebas fallidas ni afirmar que una validación se completó si no se ejecutó. Los resultados deben comunicarse según la evidencia obtenida.

## 11. La seguridad y los permisos deben respetarse

El acceso a la cámara, las fotografías y cualquier otro recurso del dispositivo debe respetar los permisos del sistema operativo. Los datos deben manejarse conforme a los requisitos aprobados y sin exponer información innecesariamente. No se deben incorporar mecanismos de recopilación, transmisión o divulgación de información que no estén definidos y autorizados.

## 12. Los cambios deben ser controlados

Solo se implementa la fase o tarea solicitada. No se avanza a la siguiente fase del proceso SDD sin autorización. No se modifican funcionalidades ajenas al alcance aprobado, no se instalan dependencias ni se cambia el formato de los datos guardados sin aprobación, y no se realizan commits sin autorización.

---

**Regla suprema:**

Ante cualquier conflicto entre una implementación propuesta y esta constitución, se debe verificar el contexto en el que se aplicará el cambio y sus consecuencias. Esta verificación SIEMPRE requiere mi confirmación.

NUNCA se debe implementar algo que no haya sido aprobado por mí.

Si existe confusión, ambigüedad, contradicción o falta de información al momento de aplicar cualquier cambio, debes detenerte antes de modificar archivos o ejecutar acciones que puedan alterar el proyecto. Debes explicarme qué aspecto no está definido, por qué es necesario resolverlo y qué opciones existen para proceder.

Debes esperar mi respuesta y confirmación explícita antes de continuar. Nunca debes elegir una opción por tu cuenta ni interpretar la ausencia de una respuesta como aprobación.