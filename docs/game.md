# Cancha de bolsillo: reglas e integración

Juego original de fútbol de vista lateral para exactamente dos personas. P1 es azul y ataca el arco derecho; P2 es naranja y ataca el izquierdo. Cada teléfono controla solo su jugador asignado. El módulo del juego no incluye rivales automáticos, red, audio ni ilustraciones externas.

## Controles y reglas

- **Izquierda / Derecha:** moverse y mirar en esa dirección. Mantener ambas cancela el movimiento.
- **Saltar:** pulsar estando en el suelo. Mantener el botón no repite el salto; pulsarlo en el aire no deja otro salto pendiente.
- **Patear:** pulsar cerca de la pelota y mirando hacia ella para impulsarla hacia adelante y arriba. Cada intento tiene 400 ms de espera antes del siguiente. Mantener el botón no repite la patada.
- Se pueden combinar movimiento y acciones. Soltar o cancelar un toque debe enviar controles neutros. Los controles vencen tras 350 ms sin un mensaje nuevo.

Ambos teléfonos deben estar conectados y **ambos jugadores deben pulsar Listo para jugar** para empezar. El reloj comienza en 2:00, avanza solo durante el juego y termina al completar dos minutos de tiempo activo. Gana quien tiene más goles; con igual marcador hay empate, sin tiempo extra. Ambos pueden confirmar una revancha, que reinicia reloj, marcador, pelota y jugadores.

Un gol cuenta solo cuando toda la pelota cruza el límite lateral dentro de la boca del arco. El arco derecho suma siempre a **P1 azul** y el izquierdo a **P2 naranja**, incluso si el último toque fue un gol en contra. El marcador de TV mantiene siempre el orden global **P1 azul a la izquierda, P2 naranja a la derecha**: no indica de quién es el arco cercano. Cada gol reinicia de forma conjunta la pelota, los jugadores y los controles para el saque, sin reiniciar el reloj ni volver a puntuar en el siguiente cuadro. Por encima del travesaño, la pelota rebota contra el límite lateral. La pelota tiene gravedad, rebotes en suelo/techo y colisiones con cuerpo/cabeza; los jugadores no pueden atravesarse ni salir de la cancha.

La desconexión de un teléfono pausa inmediatamente la física y el reloj, y borra los controles y las confirmaciones de ambos jugadores. El teléfono ausente tiene 60 segundos para volver. Cuando están ambos, se retira el plazo, pero **ambos deben pulsar Confirmar reanudación**. Otra desconexión mientras se espera confirmación inicia un nuevo plazo de 60 segundos; reconexiones parciales durante una ausencia en curso nunca lo extienden. Al vencer, la cancelación es definitiva y no hay ganador, aunque uno vaya adelante. Creá una Nueva sala después de cancelar. Una desconexión en la espera inicial no inicia una partida ni un plazo de cancelación.

## Física ágil y controlable

Los valores usan píxeles lógicos y segundos, no dependen de la resolución del televisor:

| Parámetro | Valor elegido y compromiso |
|---|---|
| Movimiento | 420 px/s (antes 300); 210 px en medio segundo, con parada inmediata al soltar. |
| Salto | Impulso de 780 px/s, subida y altura aproximada de 176 px conservadas. La gravedad del jugador es 1700 px/s² al subir o en el ápice y 3400 px/s² solo al descender: vuelve al suelo en unos 0,79 s, sin doble salto ni repetición automática. La pelota conserva gravedad de 1700 px/s². |
| Rebote | Restitución de 0,92 (antes 0,55) en superficies y jugadores: rebotes mucho más altos y duraderos, sin ganar energía contra una superficie quieta. Un contacto ya separado no vuelve a aplicar restitución. |
| Rodadura | Arrastre exponencial de 1,8 s⁻¹ integrado por tiempo, no por cantidad de cuadros/contactos. Una pelota libre a 300 px/s conserva unos 49,59 px/s tras un segundo y avanza unos 139,12 px. Bajo 2 px/s se detiene; rebotes verticales menores de 35 px/s se asientan. |
| Patada | Velocidad horizontal inicial objetivo de 1200 px/s (antes 900), con la potencia extra disipada suavemente durante 500 ms de física activa. Impulso vertical de 650 px/s, alcance de 100 px y espera de 400 ms conservados. Sustituye la velocidad entrante en ambas direcciones; sin contactos, baja hasta 900 px/s, sin modificador permanente. Desde el suelo, conserva el arco de unos 120 px, el reloj y la adjudicación de goles. |
| Seguridad | Velocidad total de pelota limitada a 1400 px/s antes de integrar y después de contactos; física en subpasos de hasta 1/120 s y límite de 100 ms por cuadro, sin recortar el reloj. |

La disipación multiplica la velocidad horizontal actual por la razón entre dos valores consecutivos de una envolvente lineal 1200→900. Nunca empuja hacia una velocidad objetivo ni añade energía: conserva el sentido y las pérdidas de los rebotes/contactos, también tras una proyección cercana al pie que ya se separa. No modifica la velocidad vertical ni la restitución de 0,92; el arrastre de rodadura y el límite vectorial siguen actuando normalmente. Solo hay una cuenta de tiempo de física: la pausa la congela, un cuadro largo consume como máximo 100 ms de disipación, una nueva patada válida la reinicia y cada saque/revancha la borra.

Se priorizan rebotes vivos, rodadura predecible y contactos estables; no se agregan ajustes ni poderes. Que resulte **divertido necesita comentarios de usuarios reales**: una prueba unitaria demuestra resultados deterministas, no diversión ni respuesta física del dispositivo.

### Pelota entre dos jugadores

Los contactos se resuelven juntos con suelo, techo y límites laterales cerrados: corregir contra un jugador no puede volver a meter la pelota en el otro ni debajo del suelo. Cada cuerpo aporta un plano tangente del lado por el que llegó la pelota, recalculado para la posición candidata del cuerpo. Así, al pasar de una esquina a un lateral durante el aterrizaje, una diagonal antigua no bloquea el descenso. En las esquinas esa aproximación es conservadora; debajo de un jugador suficientemente elevado sigue habiendo paso real.

Si los jugadores intentan cerrar un hueco que ya no admite la pelota, se frena el avance: puede quedar bloqueada o acompañar un contacto, pero no atraviesa cuerpos ni sale disparada arbitrariamente por encima de ellos. El bloqueo distingue los ejes: primero intenta conservar todo el movimiento vertical reduciendo solo el horizontal; si no es posible, prueba conservar el horizontal reduciendo el vertical. Solo si ambos intentos fallan reduce ambos juntos. Así, correr contra una pelota bloqueada no cancela un salto válido, tampoco después de mantener la presión. No se vuelve a insertar el impulso ni el evento de salto: mantener Saltar sigue sin repetirlo al aterrizar.

Se busca la fracción segura con doce bisecciones como máximo, más hasta dos comprobaciones de ejes. Cada proyección evalúa hasta seis planos y sus intersecciones (hasta 22 candidatos), sin bucles hasta converger. El desplazamiento local no supera el recorrido máximo de pelota más el movimiento de jugador del subpaso. La restitución se aplica una sola vez y simultáneamente; si dos rebotes son incompatibles, se usa contacto sin rebote y, si hace falta, se retira solo la velocidad normal al contacto, conservando la tangencial. Se conserva el límite vectorial de 1400 px/s y la patada cercana con sus reglas de impulso, espera y nueva pulsación.

## Marcador y anuncio de gol en TV

Un único marcador DOM identifica cada número con texto y color, sin depender de emojis ni de fuentes externas. Al aumentar realmente el marcador del modelo autoritativo, aparece **«¡GOOOLLL! P1 azul»** o **«¡GOOOLLL! P2 naranja»** según quién recibe el punto, también en goles en contra. Dura 1200 ms del reloj monotónico de actualización, no captura toques ni detiene controles o el reloj del partido. Cuadros repetidos, confirmaciones y mensajes de red sin un gol no repiten el anuncio. Nueva sala, reinicio/decremento del marcador, revancha y fin/cancelación lo limpian. No hay una fase de gol ni temporizadores adicionales; la escena cacheada no crea textos, geometría ni texturas por gol.

## API de integración con la TV

`game/model.ts` importa solo `Buttons`, `Slot`, `neutralButtons` e `INPUT_LEASE_MS` del protocolo compartido. No depende de Phaser, DOM, transporte, aleatoriedad ni temporizadores de tiempo real.

```ts
import { FootballMatch, FIELD } from '../game/model.js';
import { GameScene } from '../game/scene.js';

const match = new FootballMatch();
match.setConnected([true, true], performance.now());
match.ready(1);
match.ready(2);
// Relay input packets are already authenticated, assigned and validated by the host.
match.setInput(1, { left: false, right: true, jump: false, kick: false }, performance.now());
// TV update: deltaSeconds is the complete elapsed frame interval, not a physics clamp.
match.step(deltaSeconds, performance.now());
const snapshot = match.snapshot();
const scene = new GameScene(match); // Alternatively: new GameScene(() => match.snapshot()).
// Host Phaser config: width FIELD.width, height FIELD.height, scene: [scene],
// scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }.
```

El dibujado **no llama a `step`**. Quien integra el modelo debe avanzarlo exactamente una vez por intervalo activo antes de dibujarlo. `step(seconds, nowMs)` consume todos los `seconds` activos para el reloj, pero limita la física a 100 ms y doce subpasos como máximo. Si ese intervalo agota el reloj, termina antes de simular física: no hay goles tardíos. Nunca recortes previamente el intervalo del reloj. Al reanudar, usá un intervalo nuevo, no uno que incluya la pausa. Proporcioná un reloj monotónico coherente en milisegundos para la caducidad de controles y los plazos; llamá a `step` incluso en pausa para detectar el vencimiento. Ni el teléfono ni el servidor controlan el reloj.

El adaptador `FootballHost` usa un único cursor monotónico para asentar el tiempo anterior a cada evento y cuadro. Así una desconexión entre cuadros no borra tiempo activo y un intervalo de dibujo antiguo no lo cobra dos veces.

Los métodos no devuelven valores salvo `snapshot()`, que devuelve una copia independiente:

| Método | Efecto |
|---|---|
| `setConnected([boolean, boolean], nowMs)` | Actualiza presencia; pausa ante una ausencia durante el juego; aplica el vencimiento antes de aceptar una reconexión tardía. |
| `ready(slot)` | Confirma inicio, reanudación o revancha solo con ambos conectados; repetir una confirmación no suplanta al otro jugador. |
| `setInput(slot, buttons, nowMs)` | Reemplaza los controles de ese jugador durante el juego; las liberaciones neutras aparecen inmediatamente en las copias del estado. |
| `step(seconds, nowMs)` | Avanza reloj activo y física acotada, libera controles antiguos o vence una ausencia en pausa. |
| `snapshot()` | Lee fase, presencia/preparación, marcador, tiempo restante, jugadores, pelota, ganador y plazo de desconexión. |

`MatchSnapshot.phase` usa `lobby | playing | paused | finished | cancelled`. Las tuplas de marcador y preparación usan índice 0 para el lugar 1 e índice 1 para el 2. `winner` es `null | 1 | 2`; empate, espera inicial, juego activo y cancelación usan `null`. `disconnectDeadlineMs` es un plazo monotónico absoluto o `null`. `x` del jugador es su centro horizontal; `y`, la posición de los pies. Las coordenadas de la pelota indican su centro. Cada jugador expone velocidad, orientación (`-1 | 1`), contacto con el suelo, espera entre patadas y botones copiados. Todas las posiciones usan un lienzo lógico de 1280 × 720, con eje y positivo hacia abajo, y las constantes y tipos públicos `FIELD`, `PLAYER`, `BALL`, `PHYSICS`, `MATCH_MS`, `DISCONNECT_MS`.

La opción `new FootballMatch({ initialState: { players: [partialBody, partialBody], ball: partialBody } })` aporta estados físicos de prueba confiables y finitos solo para el **primer saque**. No cambia preparación, marcador ni reloj. Goles y revanchas siempre usan el saque estándar. Es un punto de prueba determinista, no un menú ni un esquema de mensajes remotos.

La pérdida de sala, el segundo plano y la salida de la TV terminan la sala en el adaptador; no hay API de recuperación de partidas de TV. En el primer arranque se espera a que la app sea visible; si se oculta antes de recibir `created`, puede reintentarse al volver. Después de cualquier `created`, regresar no crea otra sala automáticamente: se necesita **Nueva sala**. El QR, la asignación/recuperación de teléfonos y el estado del servidor pertenecen a la integración. La escena recibe un modelo o una función de lectura y solo dibuja; no controla reglas ni conexiones.

## Arte original y restricciones de ejecución

Todo el arte visible se crea con geometría `Graphics` de Phaser en `game/scene.ts`: cabezas redondas, gorras, camisetas, brazos, botines, pelota segmentada, postes/redes, nubes, público y líneas. No se usan archivos de imágenes, personajes, marcas, código o sonidos copiados, recursos externos ni fuentes de CDN. «Cancha de bolsillo» es un nombre de trabajo local, no el título de otro juego. La inspiración se limita al género general del fútbol caricaturesco para dos personas.

El texto usa Arial / sans-serif disponible localmente mediante el lienzo de Phaser. La escena no crea nodos DOM, bloques de estilos inyectados, código dinámico ni eval; no necesita `unsafe-eval` ni permiso de CSS en línea. La integración proporciona Phaser local y controla tamaño/FIT, CSP y ciclo de vida. Las pruebas automáticas y TypeScript no demuestran dibujo real en webOS ni compatibilidad CSP; siguen siendo verificaciones pendientes en dispositivos.

## Verificación y pruebas reales

Descenso y patada transitoria: `node --import tsx --test tests/jump-fall.test.ts tests/kick-boost.test.ts tests/kick-height.test.ts`. Comprueban ambos sentidos a 30/60 Hz, subida/ápice conservados, disipación de 500 ms, rebotes y contactos sin energía añadida, proyección junto al pie, pausa y reinicio. Modelo, contactos, goles y TV: `node --import tsx --test tests/ball-contacts.test.ts tests/goals-physics.test.ts tests/game.test.ts tests/tv-game.test.ts tests/tv-ui.test.ts`. Renderizado: `node --import tsx --test tests/render.test.ts`. TypeScript: `npm run typecheck`.

Las regresiones públicas cubren un corredor contra un rival quieto, ambos presionando, espejos y orden de jugadores, presión sostenida y liberación, cuerpo/cabeza/esquina junto al suelo y paso bajo un jugador elevado. También comprueban correr + Saltar inmediatamente o tras doce subpasos de presión, P1/P2 en ambos sentidos, el vuelo normal completo sin salto automático al aterrizar y Patear bajo bloqueo con espera y nueva pulsación. Verifican separación en cada subpaso observable, velocidad acotada y ausencia de goles o cambios de reloj/controles inesperados; no sustituyen la prueba física.

En la app instalada con dos teléfonos reales:

1. Conectá por QR; una sola confirmación no debe iniciar el juego.
2. Iniciá con ambos listos, mové cada jugador por separado y combiná movimiento + Saltar + Patear simultáneamente en ambos teléfonos.
3. Soltá, cancelá un toque y pasá un teléfono a segundo plano; comprobá que no queden controles activos y que al detectarse la ausencia se congelen partida y reloj.
4. Volvé antes de 60 segundos; ambos deben confirmar y se deben conservar física y reloj.
5. Desconectá ambos, reconectá solo uno repetidamente y verificá que el plazo original cancele sin ganador, incluso con marcador desigual.
6. Marcá en ambos arcos y en contra: derecha suma P1 azul; izquierda, P2 naranja. Comprobá los números etiquetados y el anuncio breve del jugador acreditado, sin detener el reloj. Golpeá por encima del travesaño y hacé rebotar en jugador/cabeza/suelo; debe haber un punto y un saque por gol.
7. Completá dos minutos, comprobá ganador o empate sin tiempo extra; una revancha confirmada por ambos empieza 0–0 y 2:00.
8. Comprobá FIT en la resolución real, arcos completos, colores distinguibles, texto legible, arte local, ausencia de errores CSP y respuesta aceptable.

La aceptación física, la ejecución en navegador/CSP y la integración real con el servidor no quedan demostradas por las pruebas del modelo puro. Seguí la [lista completa](device-checklist.md).
