# TV ligera: Canvas2D sin motor gráfico

La mejora visual de 0.2.6 mantiene Canvas2D nativo: futbolistas originales con cara, camiseta azul/naranja, pantalón y botines; pelota blanca con paneles oscuros y una cancha lateral sobria. Todo el arte se prepara una vez, sin imágenes externas, fuentes ni motor gráfico. **Las pruebas estructurales no certifican que se vea bien ni miden rendimiento físico.** El usuario confirmó arranque, QR/código y volumen inmediato en 0.2.5, pero rechazó su apariencia; el apagado y una partida completa siguen sin confirmar. No autoriza publicar, instalar ni repetir diagnósticos de TV.

## Uso y límites

1. Conectá dos teléfonos mediante el QR o la dirección y el código de sala. Ambos deben pulsar Listo para jugar.
2. Nueva sala admite clic y Enter/OK desde el botón o la cancha. Mantener Enter y su clic nativo duplicado no reemplazan varias salas. Las otras teclas no se cancelan.
3. Una superposición que solo quite el foco no termina la partida. Pasar realmente a segundo plano o cerrar sí termina la sala; volver no recupera una sala ya creada.

El primer inicio oculto espera hasta estar visible. Si falta el evento inicial de visibilidad, el temporizador de red existente puede detectar esa primera vuelta; no reintenta conexiones fallidas continuamente. Los sockets y QR viejos no pueden modificar una sala nueva.

Si Canvas2D falta o falla, aparece «No se pudo dibujar la cancha. Podés crear otra sala o salir de la aplicación.». La red y Nueva sala siguen disponibles; no se reintenta el dibujo automáticamente, tampoco al crear otra sala. Para volver a intentar gráficos hace falta una nueva carga de la aplicación.

## Presupuesto de trabajo

| Área | Implementación y evidencia local | Lo que no demuestra |
| --- | --- | --- |
| Arranque | La creación síncrona del socket ocurre antes del primer RAF que crea los lienzos. Una página oculta no crea gráficos. | No prueba que la causa anterior fuera gráfica. |
| Entrada compilada | Histórico 0.2.5: esbuild en memoria contra ff34506, `write:false`, IIFE, chrome70/safari13: **7.083.297 → 113.326 bytes**. La entrada actual confirma que no importa Phaser ni `game/scene`. Build local 0.2.6 informado por el padre: TV **118.523 bytes**, controles **27.812 bytes**, IPK **22.960 bytes**. | Los **113.340 bytes** de JavaScript y **21.852 bytes** de IPK corresponden a 0.2.5. Ninguno de estos tamaños mide FPS, memoria total o aceptación física. |
| Recursos | Visible y fondo conservan 1280 × 720, sin DPR. Se suma un atlas de **288 × 112 = 32.256 píxeles / 0,123 MiB RGBA**: total **1.875.456 píxeles / 7,154 MiB**, frente a 7,031 MiB; incremento **1,75%**. | No incluye copias del navegador, compositor, QR ni sobrecostes de memoria. |
| Dibujo inicial | **154 operaciones de fondo + 668 de atlas = 822**, una sola vez. Gradas estáticas discretas, césped desde el suelo físico y arcos a y=470..640. Cuatro poses de jugador (dos colores × dos orientaciones) y una pelota; sin animación de patada, filtros, fuentes, audio, WebGL ni recursos externos. | Registro de llamadas estándar Canvas2D, no tiempo de arranque ni aceptación estética. |
| Actualizaciones | **4 `drawImage`** por pose cambiada: fondo y tres actores. Pose idéntica: **0 operaciones**; marcador, preparación y reloj no fuerzan dibujo. Sin caminos, transformaciones ni geometría por fotograma. Destruir o fallar durante la preparación libera los tres tamaños. | No es una medición de CPU/GPU, FPS ni latencia de pantalla. |
| Planificación | Como máximo 30 actualizaciones de RAF por segundo mientras se juega, o una actualización sucia pendiente. Sin cadena continua en sala, pausa, fin ni segundo plano. CSS `object-fit: contain` conserva toda la cancha, sin recorte. | Es un límite del algoritmo, no FPS observado ni prueba física de ajuste visual. |

Los manifiestos y dependencias no cambian en esta unidad. La escena Phaser decorativa de 0.2.4 permanece sin uso en la entrada de TV para compatibilidad y sus pruebas históricas; sus nueve texturas de 961.232 píxeles y 783 operaciones iniciales **no son el renderizador actual**.

## Tiempo y ciclo de vida

`FootballHost` sigue siendo la única autoridad de tiempo monótono y simulación. No se suman deltas de RAF ni se simulan segundos ficticios en temporizadores. El partido conserva 120 segundos activos, lease de entrada de 350 ms, goles, empate y confirmaciones de ambos jugadores para inicio, revancha y reanudación.

Un único timeout cancelable apunta al próximo límite real: vencimiento de los 60 segundos de reconexión, fin del partido o fin de los 1200 ms del anuncio de gol. Así no se necesitan fotogramas de pausa ni se agrega un segundo de tolerancia. El heartbeat de red existente conserva los estados públicos y el contador de pausa sin redibujar. El anuncio corresponde al incremento de marcador acreditado por el modelo, incluso si se liquida justo al desconectar; no se duplica y se limpia en reinicios y estados terminales.

## Verificación del arte nativo (T2 / S1)

- RED: `node --import tsx --test tests/canvas-renderer.test.ts`, salida 1: 5 pasan y 6 fallan por falta de atlas, suelo lateral y ciclo de vida del tercer recurso.
- GREEN: `node --import tsx --test tests/canvas-renderer.test.ts tests/tv-ui.test.ts tests/tv-frame-loop.test.ts tests/render.test.ts`, **51/51**, salida 0. Tipos: `npm run typecheck`, salida 0; ambos dentro de 30 segundos. No se ejecutaron suite completa, build, navegador ni TV en esta unidad.
- El contexto registrador verifica paleta, cabeza/cara, piezas del uniforme, paneles de pelota, límites de actores de 52 × 100 y 36 × 36, ambas orientaciones, caché único y fallos de creación/contexto/dibujo con liberación. La entrada pública conserva inicio oculto, reposo sin RAF, límite de 30 Hz, reloj, red, teclas y anuncio de gol. En su adaptador solo cambia el presupuesto de dos a tres lienzos; `tests/render.test.ts` sigue intacto.
- Diferencial temporal contra **5a74bac**, compilado en memoria para chrome70/safari13: 10 casos públicos de pose/metadatos, identidad de caché, recreación, limpieza y cinco fallos comunes preservados; **stdout idéntico byte a byte, stderr vacío, salidas 0/0**. Solo se excluyeron el arte inicial, el tercer caché y las primitivas sustituidas por cuatro blits. El scratch externo se eliminó; ninguna prueba comprometida lee historial Git.
- El atlas no cambia posiciones: los pies siguen en `player.y`, el cuerpo ocupa x±26/y−100..y y la pelota conserva radio 18. No se dibuja un campo cenital detrás de cuerpos laterales: el césped empieza en y=640 y la línea central es una marca corta sobre el suelo.

**Pendiente:** aceptación visual humana en pantalla y comprobaciones físicas de la siguiente entrega, con autorización separada. Contar operaciones no prueba atractivo, comodidad, respuesta del volumen ni fluidez de TV.

## Integración local final 0.2.6: evidencia atribuida, no aceptación física

El padre informó suite **218/218** y tipos salida 0, foco de fuentes **117/117** tras actualizar solo la expectativa intencional de patada 400→650, y verificación independiente **153/153**, tipos salida 0 y stderr vacío. Cubrió salida/reentrada combinadas, fullscreen ajeno, segundo plano y recuperación a 59.999 ms con clave rotada y preparación dentro del panel; también nueve límites de fallo nativo de creación/horneado/blit y liberación de recursos. Los hashes protegidos de fuentes/estado coincidieron: no hubo cambios de producto posteriores a esa verificación. Dos problemas iniciales de sintaxis del scratch y un timeout de inspección `du` fueron preparación, no fallos de comprobaciones del producto; sin reintentos.

Job15 del padre: build, paquete y Docker locales, salida 0; salud HTTP 200 con cuerpo exacto `{"ok":true}`. Metadatos 0.2.6 con ID `com.systemautomatic.tvfootball.probe` sin cambios; avisos conocidos requiredACG/DEP0190 conservados. El grafo sigue libre de Phaser y los presupuestos de caché/reposo de arriba no cambiaron: 822 llamadas de preparación **una vez**, +32.256 píxeles (+1,75%), 1.875.456 píxeles/7,154 MiB totales, cuatro blits por pose cambiada y cero si es idéntica. Son artefactos y contadores locales, no instalación, recuperación de volumen ni FPS de TV.

La evidencia de navegador de controles está en `artifacts/landscape-polish-0.2.6/browser-corrected-results.json`, leído sin ejecutar nada: éxito y etapa completa en espacio 8/p1. Nativo real 1920 × 967 y ocho tamaños CSS con denegación HTTP real se comprobaron por separado, con sesión, captura de puntero y salidas neutras; ver [alcance exacto](controller-layout.md#evidencia-local-026-fullscreen-nativo-y-respaldo-css-separados). El intento browser02 fallido se conserva como error del harness al comparar fullscreen nativo con altura emulada, sin parche del producto. El navegador no evaluó arte de TV, física real de partido ni bloqueo de orientación del sistema. No hubo capturas ni exportación de imágenes, reintentos o imágenes alternativas.

Evaluación informada por el padre: riesgo medio + escalamiento alto del ítem 3, `reviewDue: false` sobre 925 líneas en ese momento; no se inició revisión nativa. La verificación independiente sí se completó. El padre cerró una vez el espacio exitoso y detuvo sus servidores propios (jobs16/20). Sin TV, SSH/inspector, Dokploy, publicación, instalación ni actualización de Ego Lite. T4 solo conserva documentación final/commits/refs del padre; T5 permanece bloqueada por aceptación física y entrega separada. Esta actualización documental no ejecutó verificaciones nuevas.

## Historial de comprobaciones de 0.2.5

Estos resultados describen la recuperación anterior; no sustituyen la verificación del arte nuevo ni afirman que sus fuentes permanezcan iguales.

- Entrada real, renderer, RAF, anfitrión, física y escena histórica: `node --import tsx --test tests/tv-ui.test.ts tests/canvas-renderer.test.ts tests/tv-frame-loop.test.ts tests/tv-game.test.ts tests/game.test.ts tests/ball-contacts.test.ts tests/render.test.ts`.
- Suite: `npm test`. Tipos: `npm run typecheck`.
- La comparación temporal de ff34506 se ejecutó en memoria, sin pruebas comprometidas que lean Git: 23 puntos públicos idénticos de DOM, fase, mensajes, contadores de socket/QR y teclas; otra comparación confirmó 9 instantáneas públicas completas idénticas con gol acreditado, lease, pausa, anuncio, reanudación, ganador y revancha. En ambas, stdout idéntico, stderr vacío y salida 0 en ambos procesos. Se excluyeron solamente las operaciones internas de dibujo del registro comparado, no reloj, preparación ni mensajes públicos.
- Escritor/raíz de 0.2.5: enfoque 110/110, suite completa 184/184 y tipos sin errores, con salida 0 y límite exterior de 30 segundos por comando. En aquella verificación, los hashes protegidos de base/fuentes coincidieron antes y después de la comprobación independiente.
- Verificador independiente: enfoque 110/110, salida 0 y stderr vacío; sin bloqueo de software reproducido para S1–S3. Tipos salió 1 por entorno: `tsc` no encontrado porque el scratch omitió `.bin` de Windows, sin diagnósticos TypeScript ni reintento. No equivale a un fallo del producto ni a que todos los comandos salieran 0.
- Sondas independientes: primero 2/3; la única falla exigía erróneamente cero RAF pendientes cuando se debía permitir el último dibujo sucio. Corregida esa aserción temporal, la sonda dirigida pasó 1/1, sin cambiar el producto. Cubrieron fallo `drawImage` enclavado/liberación de cachés/sin reasignación al preparar o crear sala, estados públicos cada segundo (119000/118000/117000 ms) sin dibujo, vencimiento sin RAF, reanudación fraccionaria, lease exacto de 350 ms y sustitución de plazos viejos. El timeout preparatorio de inspección `du` no fue verificación de la app y no se reintentó.
- El adaptador de pruebas conserva las comprobaciones públicas anteriores; las aserciones de configuración/texturas Phaser de la entrada pasan a dimensiones, identidad de caché nativa y RAF cancelable. Las pruebas de `tests/render.test.ts` permanecen intactas.

El diagnóstico `?debug=1` reutiliza el heartbeat existente para RTT y percentiles de intervalos de actualización. No mide latencia botón-pantalla ni respuesta del volumen. La vista normal no calcula percentiles.

## Evidencia local final 0.2.5

El padre completó job11 con salida 0: `npm run build`, paquete TV 0.2.5, preview loopback y Docker local `tv-football-lightweight-025:local` con `--network none`; salud HTTP 200 y cuerpo exacto `{"ok":true}`. ID conservado: `com.systemautomatic.tvfootball.probe`. Los avisos conocidos requiredACG/DEP0190 permanecen. Es preparación local, sin publicación ni instalación.

Job13 del padre ejecutó **una comprobación funcional nueva y local de 0.2.5**, salida 0 tras aproximadamente un segundo. El archivo existente `artifacts/lightweight-recovery-0.2.5/browser-results.json` registra `success: true`, espacio 7, página visible de 1280×900/DPR1, sala presente y lobby con 02:00, P1 azul: 0/P2 naranja: 0, error gráfico oculto y un lienzo Canvas2D nativo lógico de 1280×720. El padre confirmó sala/QR creados.

- Caja de lienzo/escenario: x28/y132, 912×752; contenido centrado con `contain`: x28/y251,5, 912×513. Las tres comprobaciones de ajuste dieron verdadero.
- Los 265 píxeles muestreados coincidieron: margen 9, cancha 64, P1 64, P2 64 y pelota 64; regiones distinguibles. Es evidencia de dibujo real por API, no una captura ni aceptación visual de TV.
- Sin screenshot/exportación, cambios privados del anfitrión, inspección de TV, teléfonos ni flujo de partida. El helper finalizó su espacio una sola vez con SUCCESS; el padre detuvo su preview propio (job12). No es un reintento de la captura 0.2.4 ni del diagnóstico de TV.

Evaluación histórica del padre para 0.2.5: riesgo medio, escalamiento independiente del ítem 3 y `reviewDue: false`, bajo presupuesto (16 rutas/632 líneas). Los commits/refs y la integración de la siguiente entrega siguen bajo responsabilidad del padre; esta unidad no los modifica.

## Aceptación física pendiente

La captura y el cierre por inspector/SSH anteriores no confirmaron una causa ni el cierre del proceso; esa sesión está agotada y no se repite. El usuario informó lentitud desde el arranque, antes del QR, y respuesta normal fuera del juego. Eso no demuestra saturación de GPU ni un fallo de física.

Tras una autorización separada de entrega/instalación, un operador deberá comprobar arranque, QR, volumen, apagado, contraste y juego en la TV real. Las pruebas locales y la preparación de 0.2.5 no sustituyen esa aceptación. No se publicó, instaló ni modificó la TV durante esta unidad.
