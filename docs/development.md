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
- Scripts, estilos y generación QR son locales, no de CDN. La entrada de TV 0.2.7 usa Canvas2D nativo y no importa Phaser ni `game/scene.ts`; la dependencia y escena histórica permanecen para compatibilidad y sus pruebas, sin cambios de manifiestos. No se generan mapas de código fuente. El HTML de controles se copia sin cambios; los encabezados HTTP del servidor aportan su CSP.
- Los recursos de TV usan rutas relativas. Su CSP generada permite solo el `/ws` configurado, scripts/estilos locales e imágenes locales/data para el QR. No se usa `unsafe-eval` ni `unsafe-inline`; el ajuste de cancha usa CSS `object-fit: contain`.
- `PUBLIC_ORIGIN` queda compilado en la TV y su CSP. Cambiarlo requiere volver a compilar, empaquetar e instalar la app; cambiar solo variables del servidor no alcanza.
- `npm run package:tv` requiere `dist/tv` y una CLI webOS instalada explícitamente. Consultá [webOS](webos.md). Nunca descarga ni instala herramientas automáticamente.
- Los metadatos generados tienen versión `0.2.7`, título `Fútbol TV` e ID sin cambios `com.systemautomatic.tvfootball.probe`, para actualizar la app existente. Los demás campos no cambian. Build, IPK y Docker locales no equivalen a entrega; ver el registro `odd/tasks/active-play-feedback.md` para evidencia 0.2.7. Las pruebas físicas siguen separadas; las compilaciones temporales de los tests no son una entrega ni autorizan instalación.
- Las pruebas de compilación ejecutan los scripts públicos en directorios temporales nuevos del sistema y los quitan al terminar. `node --import tsx --test tests/build.test.ts` comprueba compilación/empaquetado.
- `node --import tsx --test tests/tv-game.test.ts` comprueba el adaptador público con tiempo virtual y conexiones reales locales de servidor/teléfonos. No ejecuta el Canvas2D real de un navegador ni demuestra compatibilidad de TV. El adaptador avanza antes de dibujar; física, marcador y tiempo siguen bajo autoridad de la TV.
- `node --import tsx --test tests/tv-ui.test.ts tests/localization.test.ts` ejecuta las entradas reales con plataformas simuladas y comprueba arranque oculto, límites de visibilidad, aislamiento de eventos antiguos y texto español. No reemplaza la prueba física.

## Comprobar los ajustes locales 0.2.7

- Física pública: `node --import tsx --test tests/jump-fall.test.ts tests/kick-boost.test.ts`. Comparar descenso, subida/ápice, disipación de 500 ms activos en ambos sentidos, choques, pausa y reinicios. No cambiar gravedad de pelota ni aumentar permanentemente su límite.
- Final: `node --import tsx --test tests/tv-ui.test.ts tests/localization.test.ts`. Ganador/empate y marcador deben mantenerse hasta revancha, ocultarse al cerrar/cambiar sala y vencer al anuncio de gol al terminar el reloj. No añade temporizadores ni RAF en reposo.
- Integración: `npm test`, `npm run typecheck`, `npm run build` y `npm run package:tv`. No instalan ni publican. Registros diferenciales ignorados en `artifacts/active-play-0.2.7/`; no son tests dependientes de Git.
- [Protector LG](screensaver.md): bloqueado por plataforma, no corregido por esta versión; no agregar video oculto, teclas falsas ni permisos Luna.

## Registro histórico de preparación del pulido 0.2.6

La sección siguiente conserva el estado previo a su publicación. Posteriormente se publicó `d49d47a`, se completó el helper corregido y el usuario probó la app, valoró su apariencia y confirmó la revancha. No representa el estado vigente de 0.2.7.

1. Conectá el mando a una sala de juego; **Controles** solo se habilita tras la asignación real. Abre un panel de página completa e intenta fullscreen nativo y bloqueo horizontal por gesto. iPhone Safari no admite `orientation.lock`: ante falta o rechazo, el aviso permite seguir y girar manualmente. No se simulan APIs ni se garantiza bloqueo del sistema operativo.
2. Dentro del panel comprobá conexión, marcador y preparación (inicio, **Confirmar reanudación**, revancha). Son la misma sesión, clave y cuatro botones con captura de puntero, sin recarga, sockets extra ni nueva asignación. **Volver**, Escape y salida nativa deben liberar entradas sin dejar superposición o bloqueo propio. Barras, resize y giro no deben cambiar credenciales ni perder el modo activo.
3. Revisá arte original cacheado: caras/camisetas/botines, pelota con patrón y cancha lateral ligera. Fondo + atlas se crean una vez: 3 lienzos incluidos el visible, +32.256 píxeles (+1,75%), 7,154 MiB RGBA total; 154 operaciones de fondo +668 de atlas al iniciar, 4 blits por pose cambiada y cero si es idéntica. Sin Phaser/WebGL directo, nuevas dependencias, rutas/fuentes por fotograma ni bucle de dibujo en reposo. Estos presupuestos no prueban apariencia ni rendimiento físico.
4. Patada vertical 650 frente a 400: unos 120 píxeles de elevación frente a 45–47, con horizontal 900, alcance 100, intervalo 400 ms y límite 1400 intactos. Conservá rebote 0,92, contactos/paso bajo salto, goles, reloj, recuperación y confirmación de ambos.

El padre informó suite 218/218 y tipos salida 0 antes de la integración de metadatos. Los helpers nuevos `artifacts/landscape-polish-0.2.6/browser-01.mjs` y `browser-02.mjs` están **preparados, no ejecutados**: una sola TaskSpace nueva, preview loopback propio del padre en `http://localhost:3300/`, sin capturas/exportación ni TV. Solo podrán demostrar flujo público, geometría emulada y resultado real de fullscreen o fallback; nunca rotación física, comodidad ni estética. No ejecutes el helper histórico 0.2.5 como validación de 0.2.6. Si aparece un permiso/control humano, detener sin reintento. Ver [aceptación pendiente](device-checklist.md#pulido-026-pendiente).

## Referencia histórica: recuperación ligera 0.2.5

La prueba física de 0.2.4 falló al arrancar, antes del QR, con demora de volumen y apagado. Fuera del juego la respuesta volvió a ser normal. No se confirmó la causa; reducir carga de software no demuestra resolver el problema del sistema.

- Arranque y dibujo: el socket se crea antes del primer dibujo visible; una página inicialmente oculta no crea lienzos. Fondo simple cacheado una vez, un lienzo visible y otro de fondo de 1280×720, sin escala DPR, fuentes, audio, WebGL ni decoración animada. Hasta 30 actualizaciones activas por segundo, sin cadena continua en sala, pausa ni fin; el heartbeat conserva estados y los límites temporales usan un timeout acotado. Un error gráfico se muestra sin reintentos automáticos.
- Evidencia de fuente, no entrega: esbuild en memoria `write:false`, sin minificar y con idénticos destinos, comparó ff34506 con T1: 7.083.297 → 113.326 bytes, 36 entradas actuales sin Phaser/escena histórica. No son bytes de un IPK ni medidas de CPU/GPU o FPS. Ver [presupuesto y preservación](tv-performance.md).
- Reglas conservadas: ambos confirman inicio, revancha y reanudación; 120 segundos activos, recuperación de la misma sesión antes de 60 segundos y cancelación sin ganador al vencer. Se mantiene el anuncio de 1,2 segundos acreditado al jugador correcto, sin parar el reloj.
- Comprobación histórica local de navegador: el padre ejecutó el helper `artifacts/lightweight-recovery-0.2.5/browser-check.mjs` y registró éxito funcional, sin capturas. Después, la prueba física autorizada de 0.2.5 confirmó arranque, QR/código y volumen inmediato; no apagado ni todo el partido ni apariencia. Ese helper queda obsoleto para el candidato 0.2.6; no se vuelve a ejecutar aquí.

### Conservar los cambios jugables de 0.2.4

- Mandos: grupos de movimiento/acciones para ambos pulgares, diseño adaptable y fondo estático coherente con el estadio. Revisá 320 píxeles de ancho en vertical, horizontal de poca altura y escritorio; barras, teclado, zonas seguras, ayuda y varios dedos. Conservá zoom y navegación por teclado. El diseño no demuestra comodidad ni ausencia de desplazamiento en teléfonos reales.
- Física: rebotes mucho mayores con restitución 0,92 (antes 0,55), sin cambiar las acciones disponibles. Probá la pelota apretada entre jugadores en ambas direcciones, al empujar ambos y al soltar; no debe atravesar cuerpos, pero sí pasar bajo un jugador si el salto deja espacio. Verificá cruce de pelota completa, ambos arcos, gol en contra y anuncio sin bloquear el reloj.
- Contraste: la TV ahora usa cancha simple en lugar del estadio elaborado; el mando conserva su decoración estática. Revisá pelota/jugadores/arcos y avisos sin recorte; no deduzcas FPS de TV ni diversión de los tests. Volumen, apagado y OK/Nueva sala deben volver a comprobarse en la TV real.

La evidencia de navegador de 0.2.3/0.2.4 es histórica, no prueba del renderizador 0.2.5. Las comprobaciones nuevas de navegador y las pruebas físicas 0.2.6 siguen pendientes; usá la [lista de pulido](device-checklist.md#pulido-026-pendiente). No se autorizan aquí publicación, instalación ni reintentos por inspector/SSH.

Consultá el [protocolo](protocol.md) para caducidad de controles, lugares reservados y mensajes acotados. La prueba anterior de conectividad se validó en dispositivos; este juego completo todavía no tiene aceptación física. El siguiente paso es la [lista de dispositivos](device-checklist.md), incluido dibujo/CSP, foco del control remoto y recuperación.
