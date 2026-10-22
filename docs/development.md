# Desarrollar y compilar Fútbol TV

Empezá con una comprobación de escritorio en la dirección de bucle local. Los teléfonos reales y la app instalada deben usar después el servidor público HTTPS/WSS; no se admite alojamiento inseguro en la red local.

## Inicio rápido

```sh
npm ci
npm run typecheck
npm test
```

Configurá estas variables en la misma terminal y compilá **antes** de iniciar el servidor.

```sh
# POSIX shell: desktop smoke only
export HOST=127.0.0.1 PORT=3000
export PUBLIC_ORIGIN=http://localhost:3000 DEV_INSECURE=true
export ALLOW_TV_OPAQUE_ORIGIN=false
npm run build
npm run dev
```

```powershell
# PowerShell alternative: desktop smoke only
$env:HOST='127.0.0.1'; $env:PORT='3000'
$env:PUBLIC_ORIGIN='http://localhost:3000'; $env:DEV_INSECURE='true'
$env:ALLOW_TV_OPAQUE_ORIGIN='false'
npm run build
npm run dev
```

Abrí `http://localhost:3000/tv/` y dos pestañas de controles en `http://localhost:3000/`. Ingresá el código mostrado y pulsá **Listo para jugar** en ambos controles. Comprobá jugadores azul/naranja independientes, acciones simultáneas, goles, reloj de dos minutos y revancha. Consultá las [reglas](game.md). El QR con localhost no permite que un teléfono llegue a esta computadora. No vincules el modo inseguro a una dirección de la red local ni expongas este puerto.

Cerrar un control pausa la partida y congela el reloj. La misma sesión del navegador puede recuperar su lugar antes de 60 segundos con la clave específica de sala en `sessionStorage`; ambos deben confirmar otra vez. Otro navegador no puede reemplazar a ese jugador. Nunca compartas ni registres claves. Almacenamiento denegado, cierre de la sesión completa o recuperación fallida pueden requerir **Nueva sala**. El segundo plano, la pérdida de conexión o la salida de página de la TV terminan la sala; no se reanuda automáticamente.

En el primer arranque, la TV espera visibilidad antes de pedir una sala. Si el intento inicial se oculta antes de recibir `created`, se cierra y reintenta al volver. Tras recibir cualquier sala creada, el regreso al primer plano no inicia otra: se requiere **Nueva sala**. Los eventos de conexiones o QR antiguos no deben alterar la sala nueva.

`npm run dev` sirve archivos ya compilados; no recarga código automáticamente. Volvé a compilar tras cambiar clientes, reiniciá el servidor tras cambiar servidor/configuración y actualizá las páginas. Detené con Ctrl+C. Antes de producción, quitá las variables locales, configurá `DEV_INSECURE=false` y el `PUBLIC_ORIGIN` de producción y volvé a compilar.

## Referencia de variables

Configurá variables en la terminal o la interfaz del alojamiento. Node no carga archivos `.env` automáticamente. Nunca guardes credenciales aquí.

| Variable | Valor predeterminado fuera de Docker | Significado |
|---|---|---|
| `HOST` | `127.0.0.1` | Dirección de escucha; Docker usa `0.0.0.0` en su red privada. |
| `PORT` | `3000` | Entero positivo hasta 65535. Puerto HTTP interno detrás del intermediario TLS. |
| `PUBLIC_ORIGIN` | `https://tvfootbal.systemautomatic.xyz` | Origen exacto de controles; usado al compilar TV y ejecutar servidor. Sin barra final, credenciales, ruta, consulta ni fragmento. HTTPS obligatorio en producción. |
| `DEV_INSECURE` | `false` | El literal `true` permite HTTP solo para orígenes `localhost`/`127.0.0.1`; la escucha debe ser de bucle local. Solo escritorio, nunca red local insegura. |
| `ALLOW_TV_OPAQUE_ORIGIN` | `false` | Opción explícita para probar el enlace de la app instalada con Origin `null` o ausente. Dejar false en pruebas de navegador local. Habilitar deliberadamente solo en el servidor HTTPS para la TV instalada; no identifica ni autentica una TV. |
| `MAX_CONNECTIONS` | `100` | Máximo de conexiones WebSocket simultáneas, entero positivo. |
| `MAX_ROOMS` | `20` | Máximo de salas activas, entero positivo. |
| `ROOM_TTL_MS` | `1800000` | Duración de sala en milisegundos (30 minutos), entero positivo. |

La TV instalada no puede usar localhost de esta computadora. Probá su comportamiento WSS de origen opaco/archivo contra el despliegue HTTPS autorizado con `DEV_INSECURE=false`; nunca resuelvas errores TLS con una red local insegura. La propiedad de sala depende de la conexión, no de Origin.

## Compilación y empaquetado

- `npm run build` agrupa controles y TV en IIFE legibles con esbuild para Chrome 70/Safari 13. Ese objetivo de transformación no demuestra qué motor tiene la TV; no se incluyen adaptadores de API en ejecución.
- Scripts, estilos, Phaser y generación QR son locales, no de CDN. No se generan mapas de código fuente. El HTML de controles se copia sin cambios; los encabezados HTTP del servidor aportan su CSP.
- Los recursos de TV usan rutas relativas. Su CSP generada permite solo el `/ws` configurado, scripts/estilos locales e imágenes locales/data para el QR. No se usa `unsafe-eval` ni `unsafe-inline`: el gestor de escala de Phaser asigna propiedades de estilo individuales, no bloques en línea.
- `PUBLIC_ORIGIN` queda compilado en la TV y su CSP. Cambiarlo requiere volver a compilar, empaquetar e instalar la app; cambiar solo variables del servidor no alcanza.
- `npm run package:tv` requiere `dist/tv` y una CLI webOS instalada explícitamente. Consultá [webOS](webos.md). Nunca descarga ni instala herramientas automáticamente.
- Los metadatos generados tienen versión `0.2.1`, título `Fútbol TV` e ID sin cambios `com.systemautomatic.tvfootball.probe`, para actualizar la app existente.
- Las pruebas de compilación ejecutan los scripts públicos en directorios temporales nuevos del sistema y los quitan al terminar. `node --import tsx --test tests/build.test.ts` comprueba compilación/empaquetado.
- `node --import tsx --test tests/tv-game.test.ts` comprueba el adaptador público con tiempo virtual y conexiones reales locales de servidor/teléfonos. No ejecuta Phaser en un navegador ni demuestra compatibilidad de TV. El adaptador avanza antes de dibujar; física, marcador y tiempo siguen bajo autoridad de la TV.
- `node --import tsx --test tests/tv-ui.test.ts tests/localization.test.ts` ejecuta las entradas reales con plataformas simuladas y comprueba arranque oculto, límites de visibilidad, aislamiento de eventos antiguos y texto español. No reemplaza la prueba física.

Consultá el [protocolo](protocol.md) para caducidad de controles, lugares reservados y mensajes acotados. La prueba anterior de conectividad se validó en dispositivos; este juego completo todavía no tiene aceptación física. El siguiente paso es la [lista de dispositivos](device-checklist.md), incluido dibujo/CSP, foco del control remoto y recuperación.
