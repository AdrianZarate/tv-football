# TV ligera: Canvas2D sin motor gráfico

La variante de recuperación prepara una cancha simple con Canvas2D nativo. La entrada de TV ya no importa Phaser ni la escena anterior; conserva la física, los controles móviles, el marcador y las reglas de 0.2.4. **La causa de la lentitud real sigue sin confirmar: esto no garantiza recuperar el volumen, el apagado ni la fluidez de webOS.** No autoriza publicar, instalar ni repetir diagnósticos de TV.

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
| Entrada compilada | Comparación esbuild en memoria contra ff34506, `write:false`, IIFE, destinos chrome70/safari13, sin minificar: **7.083.297 → 113.326 bytes** (aprox. 98,4% menos). El grafo actual tiene 36 entradas, ninguna de Phaser ni `game/scene`. | Comparación de fuentes, no tamaño entregado ni memoria de ejecución. El JavaScript real de producción mide **113.340 bytes** y el IPK **21.852 bytes**. |
| Recursos | Un lienzo visible y uno de fondo, ambos 1280 × 720, sin multiplicador DPR. **1.843.200 píxeles**, equivalentes a **7,03 MiB RGBA** entre ambos; el fondo solo usa 921.600 píxeles / 3,52 MiB. | No incluye copias del navegador, compositor, QR ni sobrecostes de memoria. |
| Dibujo inicial | Fondo simple grabado una vez: 12 llamadas de dibujo registradas; primera instantánea: otras 11. Jugadores originales azul/naranja, pelota blanca y arcos en coordenadas físicas. Sin público, luces, fuentes, imágenes externas, audio ni WebGL. | Contar llamadas no mide tiempo de arranque ni calidad visual. |
| Actualizaciones | Se reutilizan los mismos lienzos. Una pose idéntica no dibuja; una pose distinta copia el fondo y dibuja los tres actores, sin crear cachés ni fuentes. Destruir libera los tamaños de ambos lienzos. | No es una medición de CPU/GPU, FPS ni latencia de pantalla. |
| Planificación | Como máximo 30 actualizaciones de RAF por segundo mientras se juega, o una actualización sucia pendiente. Sin cadena continua en sala, pausa, fin ni segundo plano. CSS `object-fit: contain` conserva toda la cancha, sin recorte. | Es un límite del algoritmo, no FPS observado ni prueba física de ajuste visual. |

Los manifiestos y dependencias no cambian en esta unidad. La escena Phaser decorativa de 0.2.4 permanece sin uso en la entrada de TV para compatibilidad y sus pruebas históricas; sus nueve texturas de 961.232 píxeles y 783 operaciones iniciales **no son el renderizador actual**.

## Tiempo y ciclo de vida

`FootballHost` sigue siendo la única autoridad de tiempo monótono y simulación. No se suman deltas de RAF ni se simulan segundos ficticios en temporizadores. El partido conserva 120 segundos activos, lease de entrada de 350 ms, goles, empate y confirmaciones de ambos jugadores para inicio, revancha y reanudación.

Un único timeout cancelable apunta al próximo límite real: vencimiento de los 60 segundos de reconexión, fin del partido o fin de los 1200 ms del anuncio de gol. Así no se necesitan fotogramas de pausa ni se agrega un segundo de tolerancia. El heartbeat de red existente conserva los estados públicos y el contador de pausa sin redibujar. El anuncio corresponde al incremento de marcador acreditado por el modelo, incluso si se liquida justo al desconectar; no se duplica y se limpia en reinicios y estados terminales.

## Comprobaciones repetibles

- Entrada real, renderer, RAF, anfitrión, física y escena histórica: `node --import tsx --test tests/tv-ui.test.ts tests/canvas-renderer.test.ts tests/tv-frame-loop.test.ts tests/tv-game.test.ts tests/game.test.ts tests/ball-contacts.test.ts tests/render.test.ts`.
- Suite: `npm test`. Tipos: `npm run typecheck`.
- La comparación temporal de ff34506 se ejecutó en memoria, sin pruebas comprometidas que lean Git: 23 puntos públicos idénticos de DOM, fase, mensajes, contadores de socket/QR y teclas; otra comparación confirmó 9 instantáneas públicas completas idénticas con gol acreditado, lease, pausa, anuncio, reanudación, ganador y revancha. En ambas, stdout idéntico, stderr vacío y salida 0 en ambos procesos. Se excluyeron solamente las operaciones internas de dibujo del registro comparado, no reloj, preparación ni mensajes públicos.
- Escritor/raíz: enfoque 110/110, suite completa 184/184 y tipos sin errores, con salida 0 y límite exterior de 30 segundos por comando. Esos resultados siguen vigentes: los hashes protegidos de base/fuentes coinciden antes y después de la verificación independiente.
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

Evaluación del padre: riesgo medio, escalamiento independiente del ítem 3 y `reviewDue: false`, bajo presupuesto (16 rutas/632 líneas). No hacen falta más comprobaciones completas; quedan los commits/refs del padre, agrupados por comportamiento con sus pruebas y docs sobre la cadena de rama/base ff34506. La fuente validada permanece inmutable.

## Aceptación física pendiente

La captura y el cierre por inspector/SSH anteriores no confirmaron una causa ni el cierre del proceso; esa sesión está agotada y no se repite. El usuario informó lentitud desde el arranque, antes del QR, y respuesta normal fuera del juego. Eso no demuestra saturación de GPU ni un fallo de física.

Tras una autorización separada de entrega/instalación, un operador deberá comprobar arranque, QR, volumen, apagado, contraste y juego en la TV real. Las pruebas locales y la preparación de 0.2.5 no sustituyen esa aceptación. No se publicó, instaló ni modificó la TV durante esta unidad.
