# Spec 003: Consulta y almacenamiento en caché de datos del medidor

Estado: aprobada
HU de origen: docs/historias/HU-003.md

## Contexto y objetivo

El técnico necesita consultar los datos del medidor desde el sistema de la oficina y volver a consultarlos durante la jornada sin esperar otra descarga cuando ya existen datos disponibles. Esta spec define la consulta, la presentación y la vigencia de esos datos cacheados.

La consulta usa el recurso MockAPI aprobado en las decisiones. El recurso remoto aún no está configurado, por lo que la prueba de integración real depende de que se cree con el contrato definido.

## Usuarios

- Técnico de EPMAPS que consulta medidores durante su recorrido.

## Historias de usuario

> **HU-003: Consulta y almacenamiento en caché de datos del medidor**
>
> Como técnico, quiero consultar y visualizar los datos del medidor enviados por el sistema de la oficina, para acceder a su información y evitar esperar una nueva descarga al consultar el mismo medidor durante la jornada.

## Definiciones

- **Caché vigente:** datos consultados durante el día local en Ecuador, antes del siguiente cambio de día.
- **Código de medidor válido:** código normalizado `MED-` seguido de seis dígitos, según HU-002.
- **Respuesta válida:** exactamente un registro que cumple el esquema aprobado y cuyo `meterCode` coincide con el código consultado.
- **Cero resultados:** respuesta de búsqueda sin registros; se interpreta como «no encontrado».

## Requisitos funcionales

- **RF-01:** Cuando el técnico ingrese un código de medidor válido y active `Consultar` con señal disponible, la aplicación debe solicitar al sistema de la oficina los datos del medidor según el recurso y el filtro por código definidos en el contrato aprobado. Origen: CA-01; D-04, D-12, D-13.
- **RF-02:** Cuando la consulta devuelva exactamente un registro válido cuyo `meterCode` coincida con el código consultado, la aplicación debe mostrar la dirección, el sector, el número de cuenta, el estado, la última lectura con su fecha y el consumo promedio mensual. Origen: CA-02; D-10, D-12, D-13.
- **RF-03:** Cuando la aplicación obtenga una respuesta válida, debe guardarla como una unidad de caché asociada al código del técnico y al código normalizado del medidor. La caché debe seguir disponible al cerrar y volver a abrir la aplicación hasta el cambio del día local en Ecuador. Origen: CA-03; D-01, D-06, D-08.
- **RF-04:** Cuando el técnico consulte un medidor con una caché vigente, la aplicación debe mostrar los datos cacheados sin esperar la respuesta de red y, si hay señal, solicitar su actualización en segundo plano. Cuando se restablezca la señal mientras el técnico consulta ese medidor, la aplicación debe reanudar la actualización. Origen: CA-04; D-02, D-05.
- **RF-05:** Cuando no haya señal y exista una caché vigente del medidor para el técnico actual, la aplicación debe mostrar esos datos e indicar que pueden estar desactualizados. Origen: D-07, D-08.
- **RF-06:** Cuando no haya señal y no exista una caché vigente, la aplicación debe informar que no hay datos actuales disponibles. La aplicación no debe mostrar datos de una caché vencida. Origen: D-06, D-07.
- **RF-07:** Cuando una entrada de caché haya vencido, la aplicación debe tratarla como ausente y eliminarla en el siguiente inicio o consulta. Origen: D-06.
- **RF-08:** Cuando la oficina indique que el medidor no existe, la aplicación debe mostrar ese resultado. Si existe una ficha válida cacheada, debe conservarla y mostrarla marcada como desactualizada, sin reemplazarla por el resultado vacío. Origen: D-09.
- **RF-09:** Cuando la consulta falle por un error de red o del servidor, o la respuesta HTTP esté vacía o no cumpla el esquema esperado, la aplicación debe distinguir el error del estado «no encontrado» y conservar la última respuesta válida cacheada. Una colección válida sin resultados corresponde a «no encontrado». Origen: D-09, D-13.
- **RF-10:** Cuando la aplicación presente la fecha de la última lectura recibida como `YYYY-MM-DD`, debe mostrarla como `dd/MM/yyyy`. Cuando presente el consumo promedio mensual, debe conservar la unidad recibida en `monthlyAverageConsumptionUnit`, sin conversiones. Origen: CA-02; D-10, D-12.
- **RF-11:** Mientras una consulta inicial sin caché vigente esté en curso, la aplicación debe mostrar un indicador de actividad y el texto `Consultando datos del medidor…`. Origen: D-14.
- **RF-12:** Cuando la búsqueda devuelva más de un registro, la aplicación debe mostrar un error de respuesta ambigua y conservar la última ficha válida cacheada. Origen: D-13.

## Requisitos no funcionales

- **RNF-01:** La lógica que determina la vigencia, la disponibilidad y la asociación de los datos cacheados debe poder comprobarse independientemente de la interfaz. Origen: Constitución 9 y 10; D-06, D-08.
- **RNF-02:** La interfaz debe distinguir con claridad los estados de carga, datos disponibles, ausencia de datos y error. Origen: Constitución 7; D-07, D-09, D-14.
- **RNF-03:** La aplicación debe manejar los datos cacheados conforme a las decisiones aprobadas y evitar exponerlos a un técnico distinto del asociado a la entrada. Origen: Constitución 11; D-08.

## Casos límite

- El técnico consulta sin señal y no hay caché vigente: la aplicación informa que no hay datos actuales disponibles.
- La caché corresponde a un día local anterior: la aplicación no la muestra y la elimina en el siguiente inicio o consulta.
- La oficina responde «no encontrado» y existe una ficha cacheada vigente: la aplicación informa el resultado actual y conserva la ficha, marcada como desactualizada.
- La consulta falla o devuelve un cuerpo vacío o datos no válidos: la aplicación conserva la última respuesta válida y no presenta el error como «no encontrado».
- La búsqueda devuelve más de un registro: la aplicación comunica la ambigüedad y conserva la última respuesta válida.
- La caché pertenece a otro técnico: la aplicación no la muestra al técnico actual.

## Fuera de alcance

- Configurar o modificar el recurso remoto de MockAPI. Para verificar la integración real, debe existir el recurso `medidores` con el esquema aprobado.
- Guardar mutaciones o implementar procesos pesados. HU-003 solo cachea las respuestas de consulta del medidor.
- Convertir la unidad del consumo promedio mensual.

## Criterios de finalización

- CA-01 está cubierto por RF-01; la verificación de integración queda pendiente hasta que el recurso remoto esté configurado.
- CA-02 está cubierto por RF-02 y RF-10.
- CA-03 está cubierto por RF-03 y RF-07.
- CA-04 está cubierto por RF-04.
- Los escenarios sin señal, expiración, separación por técnico, respuesta «no encontrado» y errores quedan cubiertos por RF-05 a RF-09.
- La lógica de caché puede verificarse independientemente de la interfaz y la interfaz comunica los estados aprobados.

## Dudas abiertas

Ninguna. La configuración del recurso remoto sigue siendo una dependencia externa para la validación de integración.
