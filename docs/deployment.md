# Desplegar el servidor de enlace con Dokploy

Solo el operador debe desplegar, con aprobación explícita del usuario y la referencia aprobada. Estas son instrucciones, no una publicación automática ni evidencia de un despliegue completado. La versión anterior de conectividad se validó; el juego completo sigue pendiente de aceptación en dispositivos reales. Nunca pidas credenciales de cuentas ni cambies el VPS o el cortafuegos como parte de verificaciones locales.

## Inicio rápido

1. En DNS, apuntá `tvfootbal.systemautomatic.xyz` a `<ACTUAL_VPS_IPV4>` con un registro A. Agregá AAAA solo para `<ACTUAL_WORKING_VPS_IPV6>` si esa dirección y su ruta funcionan realmente. No inventes direcciones ni dejes un AAAA desactualizado.
2. En Dokploy, creá una aplicación con el repositorio y la referencia aprobados. Elegí **Dockerfile**, contexto en la raíz y `Dockerfile`. No publiques el puerto 3000 del equipo anfitrión; Traefik debe llegar al puerto **3000** del contenedor por la red interna de Dokploy.
3. Configurá las variables siguientes. Mantené el argumento de compilación Docker `PUBLIC_ORIGIN=https://tvfootbal.systemautomatic.xyz` igual al valor de ejecución. El IPK de TV compilado por separado debe usar el mismo origen.
4. Agregá el dominio `tvfootbal.systemautomatic.xyz`, ruta `/`, puerto de contenedor `3000`, HTTPS habilitado y certificado público válido. TLS termina en Traefik; el tráfico interno al contenedor es HTTP. Confirmá la emisión del certificado antes de conectar dispositivos.
5. Desplegá solo con autorización y luego hacé las comprobaciones siguientes. Nunca desactives la validación de certificados para conectar la TV.

## Configuración de ejecución

```text
HOST=0.0.0.0
PORT=3000
PUBLIC_ORIGIN=https://tvfootbal.systemautomatic.xyz
DEV_INSECURE=false
ALLOW_TV_OPAQUE_ORIGIN=false
MAX_CONNECTIONS=100
MAX_ROOMS=20
ROOM_TTL_MS=1800000
```

Habilitá `ALLOW_TV_OPAQUE_ORIGIN=true` deliberadamente para probar el enlace de la TV instalada con Origin `null` o ausente. Registrá el comportamiento observado y el motivo. El transporte de producción sigue siendo HTTPS/WSS; esta opción no concede propiedad de sala ni permite reemplazar conexiones. Consultá la [tabla de variables](development.md#referencia-de-variables).

El Dockerfile multietapa usa Node 24 Alpine y compila con `npm ci`. La imagen final instala solo dependencias de producción (incluido `tsx`), copia servidor, código compartido y recursos compilados, ejecuta como `node` y usa CMD de Node en formato ejecutivo para recibir señales de apagado. `EXPOSE 3000` documenta un puerto interno, no lo publica. La comprobación de salud consulta `/healthz`. Secretos, archivos locales de entorno, historial Git, node_modules e IPK quedan fuera del contexto de compilación.

## Comprobar HTTPS y el intermediario WebSocket

Traefik normalmente gestiona la actualización a WebSocket automáticamente. Conservá la semántica de `Upgrade: websocket` y `Connection: Upgrade` para `/ws`; no agregues almacenamiento intermedio de respuestas, cambios de ruta, bucles de redirección ni componentes que quiten la actualización. Los plazos de inactividad deben permitir el tráfico periódico de comprobación de actividad. No abras otro puerto público directo ni cambies el cortafuegos de forma improvisada.

Después de un despliegue autorizado:

```sh
curl --fail https://tvfootbal.systemautomatic.xyz/healthz
```

Cuerpo esperado: `{"ok":true}`. Abrí la página HTTPS de controles y verificá que cargue JS/CSS locales sin contenido mixto ni errores de certificado. Para comprobar WSS, ejecutá esto en la consola de esa página (importa el Origin del navegador):

```js
const smoke = new WebSocket('wss://tvfootbal.systemautomatic.xyz/ws');
smoke.onopen = () => smoke.send(JSON.stringify({ type: 'ping', id: 1 }));
smoke.onmessage = event => { console.log(event.data); smoke.close(); };
smoke.onerror = () => console.error('WSS smoke failed');
```

Se espera `{"type":"pong","id":1}` y conexión `101` en el inspector de red. Ante fallos, revisá DNS, cadena de certificados, ruta de actualización del intermediario y configuración Origin; no pegues registros sensibles en el chat. `/tv/` permite comprobar el juego con dos controles de navegador pulsando **Listo para jugar**, pero es **solo una prueba de escritorio**, no prueba de la app instalada. Una consulta de salud no demuestra que WSS funcione.

## Siguiente verificación

Empaquetá la TV con el mismo origen siguiendo [webOS](webos.md) y completá la [lista de dispositivos](device-checklist.md). Actualizá TV y controles/servidor desde la revisión aprobada del juego: los controles de la prueba anterior no satisfacen la aceptación del juego completo. La TV decide física, goles, marcador y reloj; el VPS solo valida y reenvía mensajes acotados. Consultá las [reglas](game.md).

Una desconexión de teléfono pausa hasta 60 segundos, con lugar reservado a la misma sesión del navegador y confirmación de ambos. El segundo plano o la pérdida de conexión de la TV, o un reinicio del servidor, terminan la sala; no se promete recuperación de TV. Puede hacer falta **Nueva sala**. Las claves de recuperación pertenecen solo al `sessionStorage` del teléfono, nunca a direcciones compartidas, registros del intermediario ni capturas de soporte. No registres mensajes WebSocket con claves.

Con servidor desplegado y app instalada no hace falta computadora ni servidor doméstico para jugar. No elijas otra ubicación de VPS hasta recopilar y revisar mediciones reales; no compres ni aprovisiones infraestructura sin aprobación.

Referencia oficial: [dominios de Dokploy](https://docs.dokploy.com/docs/core/domains).
