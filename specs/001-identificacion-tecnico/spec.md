# Spec 001 — Identificación del técnico

Estado: aprobada
HU de origen: docs/historias/HU-001.md

## Contexto y objetivo

Los técnicos de EPMAPS registran lecturas de medidores durante sus recorridos en campo, donde la conectividad no está garantizada. Esta spec define cómo el técnico se identifica en la aplicación con su código de empleado y una clave, y cómo se conserva su sesión hasta que él decida cerrarla, para que pueda trabajar bajo su identidad sin volver a identificarse en cada apertura de la aplicación.

Según la HU-001, los datos de usuario pueden estar quemados: no se implementa gestión de usuarios.

## Usuarios

- **Técnico:** persona que utiliza la aplicación en campo para registrar lecturas bajo su identidad.

## Historias de usuario

- **HU-001:** Como técnico, quiero identificarme en la aplicación mediante mi código de empleado y una clave, para mantener mi sesión iniciada hasta que cierre sesión.

## Definiciones

- **Sesión iniciada:** estado en el que el técnico ya se identificó y la aplicación lo reconoce como tal hasta que él cierre sesión de forma explícita.
- **Credenciales quemadas:** datos de usuario de prueba definidos dentro de la aplicación, sin gestión de usuarios ni backend.
- **Datos del técnico:** código de empleado, nombre y apellido.

## Requisitos funcionales

- **RF-01:** La aplicación debe permitir al técnico identificarse mediante su código de empleado y una clave. — *Origen: HU-001 CA-01.*

- **RF-02:** Cuando el técnico introduzca un código de empleado y una clave que coincidan exactamente (distinguiendo mayúsculas de minúsculas y ignorando únicamente los espacios al inicio y al final) con una credencial válida, la aplicación debe iniciar su sesión y permitirle continuar al área de trabajo. — *Origen: HU-001 CA-01; decisiones D-01, D-11.*

- **RF-03:** Si la combinación de código de empleado y clave no coincide con ninguna credencial válida, la aplicación debe mostrar un mensaje claro de credenciales inválidas sin indicar cuál de los dos datos fue incorrecto, y el técnico debe poder reintentar de inmediato, sin límite de intentos ni bloqueo. — *Origen: decisión D-04.*

- **RF-04:** Una vez iniciada la sesión, la aplicación debe mantenerla iniciada hasta que el técnico la cierre de forma explícita, incluso si la aplicación se cierra y se vuelve a abrir. — *Origen: HU-001 CA-02; decisión D-02.*

- **RF-05:** Al iniciar la sesión, la aplicación debe conservar únicamente los datos del técnico (código de empleado, nombre y apellido); la clave no debe conservarse. — *Origen: decisión D-03.*

- **RF-06:** Cuando la aplicación se abra y exista una sesión iniciada del técnico, este debe entrar directamente al área de trabajo sin identificarse de nuevo; cuando no exista una sesión iniciada, la aplicación debe mostrar la pantalla de identificación. — *Origen: decisión D-05.*

- **RF-07:** El técnico debe poder cerrar sesión desde el área de trabajo mediante una acción visible y accesible. — *Origen: HU-001 CA-02; decisión D-06.*

- **RF-08:** Cuando el técnico cierre sesión, la aplicación debe eliminar únicamente la sesión iniciada y los datos del técnico conservados para la identificación, sin eliminar ni alterar ningún otro dato local (como lecturas pendientes de sincronizar, fotografías u otros registros). — *Origen: decisión D-07.*

- **RF-09:** El código de empleado del técnico identificado debe quedar disponible para identificarlo en los registros que genere durante la sesión, cuando otras historias de usuario lo requieran. — *Origen: decisión D-09.*

- **RF-10:** Antes de evaluar la credencial, la aplicación debe validar que el código de empleado y la clave no estén vacíos; si alguno de los dos está vacío, debe mostrar un mensaje indicando que el dato es obligatorio, sin evaluar la credencial. — *Origen: decisión D-10.*

## Requisitos no funcionales

- **RNF-01:** La identificación debe funcionar sin conectividad, ya que las credenciales se encuentran definidas en la propia aplicación. — *Origen: HU-001 CA-03; decisión D-01; constitución 4.*

- **RNF-02:** La clave del técnico no debe almacenarse ni exponerse en ningún momento; los datos del técnico deben conservarse mínimamente y sin mostrar información innecesaria. — *Origen: decisión D-03; constitución 11.*

- **RNF-03:** La sesión persistida no debe perderse por el cierre o reinicio de la aplicación. — *Origen: decisión D-02; constitución 8.*

## Casos límite

- Código de empleado o clave vacíos: la aplicación no evalúa la credencial y muestra el mensaje de dato obligatorio (cubierto por RF-10; decisión D-10).
- Diferencias de mayúsculas/minúsculas o espacios al inicio o al final en el código o la clave: la comparación distingue mayúsculas y solo ignora los espacios de los bordes (cubierto por RF-02; decisión D-11).
- Espacios en el interior del código o la clave: se comparan tal cual, sin eliminarse (cubierto por RF-02).
- Varias aperturas de la aplicación sin conexión: la sesión debe conservarse (cubierto por RF-04 y RNF-03).
- Cierre de sesión con datos locales pendientes: no deben alterarse (cubierto por RF-08).

## Fuera de alcance

- Gestión de usuarios (alta, baja, edición de datos de técnicos). — HU-001 CA-03.
- Autenticación contra backend o servicio remoto.
- Recuperación de clave olvidada.
- Límite de intentos, bloqueo de cuenta o políticas de seguridad de acceso.
- Roles, permisos o niveles de acceso.
- Definición de la ubicación exacta del control de cierre de sesión en la pantalla, deferida al diseño de la interfaz. — decisión D-06.

## Criterios de finalización

- Cada criterio de aceptación de la HU-001 (CA-01, CA-02, CA-03) está cubierto por al menos un requisito funcional.
- Las decisiones D-01 a D-11 están reflejadas en los requisitos sin contradicciones.
- La lógica de validación de credenciales y de gestión de sesión es verificable de forma independiente de la interfaz.
- Se verifica que cerrar la aplicación con sesión iniciada no pierde la sesión, y que cerrar sesión no altera otros datos locales.

## Dudas abiertas

Ninguna. Las dos dudas pendientes quedaron resueltas con las decisiones D-10 y D-11 de `decisiones.md`, incorporadas en RF-10 y RF-02 respectivamente.
