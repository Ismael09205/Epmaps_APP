# Spec 002 — Identificación del medidor

Estado: implementada
HU de origen: docs/historias/HU-002.md

## Contexto y objetivo

El técnico necesita identificar cada medidor de su recorrido antes de trabajar con él. Esta spec define únicamente la captura y validación local del código de etiqueta. Cuando el código es válido, la aplicación comunica ese estado; HU-002 no ofrece una acción de continuación ni consulta al sistema de la oficina.

La consulta al sistema de la oficina y la visualización de los datos del medidor no forman parte de esta historia: los define HU-003. Por ello, esta funcionalidad debe poder usarse por completo sin conectividad.

## Usuarios

- Técnico de EPMAPS que registra lecturas en campo, durante su jornada y frecuentemente sin conexión.

## Historias de usuario

> **HU-002: Identificación del medidor**
>
> Como técnico, quiero identificar cada medidor escribiendo su código de etiqueta, para que la aplicación pueda validar el código antes de consultar el sistema de la oficina.
>
> **Criterios de aceptación**
>
> - **CA-01:** La aplicación debe permitir ingresar el código de etiqueta del medidor.
> - **CA-02:** El código debe tener el formato `MED-` seguido de seis dígitos numéricos.
> - **CA-03:** La aplicación no debe consultar el sistema de la oficina si el código está incompleto.

## Definiciones

- **Código de etiqueta del medidor:** texto que identifica un medidor. Su formato válido es `MED-` seguido de exactamente seis dígitos numéricos.
- **Código incompleto:** texto que todavía puede convertirse en un código válido si el técnico sigue escribiendo (por ejemplo, `MED-123`).
- **Código con formato inválido:** texto que ya no puede convertirse en un código válido (por ejemplo, siete dígitos, letras donde deben ir dígitos, o ausencia del prefijo o del guion).
- **Normalización:** ajuste previo a la validación que elimina espacios al inicio y al final y convierte las letras a mayúsculas. Solo afecta a cómo se interpreta lo escrito; no altera el formato permitido.
- **Sistema de la oficina:** fuente externa de datos del medidor. Su consulta se define en HU-003 y queda fuera de esta spec.

## Requisitos funcionales

- **RF-01:** La aplicación debe permitir al técnico ingresar el código de etiqueta del medidor.
  *Origen: HU-002 CA-01.*

- **RF-02:** Mientras el técnico escribe el código, el campo debe presentar el prefijo `MED-` automáticamente e incorporar únicamente los seis dígitos numéricos, de modo que en pantalla se forme el código completo sin que el técnico tenga que escribir el prefijo a mano. El campo debe ignorar cualquier otra tecla, incluida la escritura manual del prefijo.
  *Origen: HU-002 CA-02; decisiones D-08 y D-12.*

- **RF-03:** Antes de evaluar el código, la aplicación debe normalizarlo: ignorar los espacios al inicio y al final y convertir las letras a mayúsculas. La comparación del resto del código debe ser exacta.
  *Origen: decisión D-03.*

- **RF-04:** La lógica de dominio debe rechazar cualquier código normalizado que no coincida exactamente con `MED-` seguido de seis dígitos. La interfaz solo debe aceptar los seis dígitos permitidos por el campo enmascarado y no debe aceptar un código mal formado como válido.
  *Origen: HU-002 CA-02; decisiones D-02 y D-14.*

- **RF-05:** Mientras el código esté incompleto, la aplicación no debe mostrar ningún mensaje de error por el tecleo en curso, presentarlo como válido ni realizar ninguna consulta al sistema de la oficina.
  *Origen: HU-002 CA-03; decisiones D-01 y D-04.*

- **RF-06:** El campo enmascarado debe ignorar los caracteres no numéricos y cualquier dígito posterior a los seis permitidos, sin incorporarlos al valor ni mostrar un mensaje de error. La función de dominio debe seguir clasificando como inválidos los textos mal formados que reciba.
  *Origen: decisión D-14.*

- **RF-07:** Cuando el código sea válido, la aplicación debe comunicar claramente ese estado. HU-002 no debe mostrar la acción `Continuar`; HU-003 la incorporará cuando exista su destino real. HU-002 no realiza ninguna consulta al sistema de la oficina.
  *Origen: decisión D-13; HU-002 CA-02 y CA-03.*

- **RF-08:** La identificación del medidor debe realizarse en una pantalla propia, accesible desde la pantalla principal que el técnico alcanza tras identificarse, y no dentro de la pantalla de identificación del técnico ni en ajustes.
  *Origen: decisión D-05.*

- **RF-09:** Cuando el técnico salga de la pantalla de identificación y vuelva a ella navegando dentro de la aplicación, el código ingresado a medio escribir debe conservarse. Cuando se cierre y vuelva a abrir la aplicación, el campo debe empezar vacío.
  *Origen: decisión D-11.*

## Requisitos no funcionales

- **RNF-01:** La identificación del medidor debe funcionar sin conectividad: no se requiere red para ingresar ni validar el código.
  *Origen: decisión D-01; constitución 4.*

- **RNF-02:** La lógica de validación del código debe poder comprobarse de forma independiente de la interfaz, con pruebas automatizadas.
  *Origen: constituciones 9 y 10; decisión D-08.*

- **RNF-03:** Los estados incompleto y válido deben comunicarse junto al campo con texto y sin depender únicamente del color. La interfaz ignora las teclas no admitidas sin avisos; la clasificación `invalid` se mantiene en la lógica de dominio.
  *Origen: decisiones D-04 y D-14; constitución 7.*

- **RNF-04:** El código que se conserve como identificación del medidor después de validar debe ser siempre la forma normalizada (`MED-` seguido de seis dígitos).
  *Origen: decisión D-03.*

## Casos límite

- Campo vacío: sin mensaje de error ni estado válido.
- Código a medio escribir (`MED-12`): sin error ni estado válido; el técnico puede seguir escribiendo.
- Código con minúsculas (`med-123456`): se acepta tras normalizar a mayúsculas.
- Código con espacios al inicio o al final (` MED-123456 `): se acepta tras normalizar.
- Código con letras en el interior (`MED-12A456`): la lógica de dominio lo clasifica como inválido; la interfaz ignora las teclas no numéricas.
- Código sin guion (`MED123456`): la lógica de dominio lo clasifica como inválido.
- Código con siete dígitos (`MED-1234567`): la lógica de dominio lo clasifica como inválido; la interfaz ignora el séptimo dígito.
- Código con caracteres no permitidos: la lógica de dominio lo clasifica como inválido; la interfaz no incorpora las teclas no numéricas.
- Código con cinco dígitos: incompleto, sin mensaje de error.
- Código válido: se comunica el estado válido, sin mostrar `Continuar` en HU-002.
- Salir de la pantalla con el código a medio escribir y volver: el código se conserva.
- Cerrar y reabrir la aplicación: el campo empieza vacío.
- Intentar teclear el prefijo `MED-` a mano: las teclas se ignoran y solo se incorporan los dígitos.
- Codificación de letras no contemplada en el formato, sea mayúscula o minúscula, que no pueda completarse como código válido: formato inválido.

## Fuera de alcance

- Consultar el sistema de la oficina y mostrar los datos del medidor: HU-003.
- Almacenamiento en caché de datos del medidor: HU-003.
- Captura del código mediante cámara o escaneo.
- El código de empleado y la clave del técnico, y su lista de credenciales: HU-001, sin cambios por esta spec.
- Cualquier regla adicional sobre códigos repetidos, reintentos o límites de intentos: no definida en la HU ni en decisiones vigentes.

## Criterios de finalización

- CA-01, CA-02 y CA-03 cubiertos por al menos un requisito funcional y verificados con pruebas automatizadas de la lógica de validación.
- Casos límite comprobados con pruebas automatizadas donde corresponda.
- Verificación manual en dispositivo de los estados incompleto y válido, de que el estado válido no ofrece `Continuar` en HU-002 y de la ubicación de la pantalla (RF-08), según constitución 10.
- Verificación manual de que el prefijo se forma automáticamente, que las teclas no numéricas y los dígitos adicionales se ignoran sin error (RF-02, RF-06), y de la conservación del código a medio escribir al salir y volver y al cerrar la aplicación (RF-09).
- Confirmación de que ninguna consulta al sistema de la oficina se dispara desde esta funcionalidad.
- Revisión de legibilidad y claridad de los estados para uso en campo, según constitución 7.

## Dudas abiertas

Ninguna. Las decisiones D-09 a D-14 están registradas en `decisiones.md` y reflejadas en los requisitos correspondientes.
