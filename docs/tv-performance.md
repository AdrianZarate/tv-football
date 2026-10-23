# Menos trabajo de dibujo y Nueva sala con el control remoto

La TV muestra un estadio original al atardecer y conserva los personajes, los límites de juego y un único marcador, reloj y estado fuera del lienzo. **La reducción de trabajo en el código no demuestra la causa del retraso del volumen en webOS ni garantiza una mejora de FPS o latencia.** Esa comparación requiere la TV real.

## Uso

1. Conectá los dos teléfonos con el QR o con la dirección y el código de sala.
2. Ambos jugadores deben pulsar Listo para jugar. El estado informa la pausa, la reconexión y la revancha.
3. Para empezar otra sala, seleccioná Nueva sala y pulsá Enter/OK, o hacé clic. Mantener Enter pulsado no crea salas sucesivas. Si el foco está en la cancha, Enter también selecciona Nueva sala.

Al volver de una superposición transitoria, Nueva sala recupera el foco si estaba en el botón o la cancha. El foco de otros controles se respeta. Perder solamente el foco no termina una partida. Pasar realmente a segundo plano o cerrar la aplicación sí termina la sala: no hay recuperación de partidas de TV.

## Qué se verificó y qué no

| Evidencia de código y pruebas | Límite de la conclusión |
| --- | --- |
| Antes se borraba y reconstruía la geometría de los actores en cada actualización, incluso sin movimiento. | No es una medición de saturación de CPU o GPU. |
| Ahora se generan nueve texturas locales al crear la escena: cancha, cuatro poses, pelota, dos sombras y efecto de patada. Las actualizaciones solo cambian la pose; no generan geometría, texturas ni fuentes. | El coste del compositor, del controlador gráfico y de webOS no se midió. |
| La escena libera sus imágenes antes de eliminar las texturas. Nueva sala reutiliza la escena, sin crear nuevas texturas. | El consumo total de memoria incluye copias de lienzo, datos de píxeles y memoria del controlador gráfico. |
| La configuración usa un límite explícito de 30 actualizaciones por segundo y un lienzo de 1280 × 720 sin multiplicar por la densidad de pantalla; conserva la selección automática de renderizador. | El objetivo configurado no es FPS observado. El suavizado de texturas sigue activo; se desactiva el suavizado del contexto WebGL. |
| El adaptador real de entrada antes dependía solo de clic; ahora Enter crea una sala sin necesitar un clic nativo. Se ignoran la repetición y el clic nativo duplicado. | La prueba usa eventos DOM, no un control remoto físico. No se presupone una identidad para los eventos de volumen de webOS. |
| Solo Enter propio se cancela. Las demás teclas pasan sin cambios; el teclado de Phaser está desactivado porque los teléfonos manejan el juego. | No prueba que la aplicación anterior consumiera volumen ni que esta versión resuelva su retraso. |

Phaser 3.90 no tiene una opción de juego `resolution`: se usan las dimensiones lógicas y ajuste visual por CSS, con `zoom: 1`. El área total de las nueve texturas es inferior a un millón de píxeles; no se cargan dibujos externos ni se convierten en direcciones de imagen. Phaser 3.90 genera las texturas con un lienzo interno y las actualiza una vez para Canvas o WebGL, sin cambiar la política de seguridad. El reloj usa el tiempo monótono de la TV, no el objetivo de FPS. Las actualizaciones del anfitrión continúan durante la pausa para aplicar la cancelación de 60 segundos. No cambian las reglas, los 120 segundos, los goles ni el empate.

## Estadio al atardecer: detalle sin trabajo por fotograma

El fondo combina cielo de bandas cálidas, sol y siluetas de edificios lejanos; tres gradas con público estático, pasillos y barandas; dos torres con haces de luz tenues; y césped a franjas con marcas y borde en profundidad. La paleta de tinta oscura, azul y naranja con luces cálidas conecta el estadio con los mandos. Son formas originales, sin gráficos licenciados ni recursos externos.

Todo se dibuja **una sola vez en la textura de cancha existente de 1280 × 720**. El público y las luces no se animan. No se agregan texturas, fuentes, filtros ni sombreadores. Las nueve texturas siguen sumando exactamente **961.232 píxeles** (unos 3,67 MiB de píxeles RGBA, sin contar copias ni sobrecostes del motor). El detalle aumenta las operaciones de dibujo al crear la escena, no las de sus actualizaciones.

| Contrato comprobado por la escena pública | Validación visual pendiente |
| --- | --- |
| Bandas de cielo, silueta, tres filas acotadas de público, dos luces y césped quedan grabados en la textura de cancha. La creación tiene un techo de 1.200 operaciones registradas. | Composición, atractivo y contraste percibido requieren inspección en navegador y TV; contar formas no demuestra calidad visual. |
| Se conservan coordenadas de campo, bocas de arco y poses de pelota/jugadores. Las decoraciones quedan detrás de los arcos; la zona baja usa un fondo tranquilo. | Comprobar que pelota blanca, camisetas azul/naranja y ambos arcos se distingan durante saltos, goles y movimiento. |
| Reposo, movimiento, gol, pausa y fin no crean geometría, imágenes, texturas ni texto. Al cerrar se destruyen imágenes antes de liberar texturas; una escena nueva reproduce el mismo fondo. | La prueba estructural no mide FPS, latencia, memoria GPU total ni el coste inicial de dibujar el estadio en webOS. |

Para repetir solo la comprobación estructural: `node --import tsx --test tests/render.test.ts`. Se registraron **783 operaciones iniciales frente a 310 del fondo anterior**, con los mismos 961.232 píxeles y cero operaciones de dibujo durante las actualizaciones. La comparación de ambas escenas conservó poses, texturas y liberación/recreación; solo cambió el dibujo inicial de cancha. El doble de Phaser registra llamadas públicas, no tiempos de ejecución ni calidad visual, y no sustituye la inspección con el renderizador real.

## Evidencia 0.2.4: lienzo real sin veredicto visual

Según el padre, las comprobaciones funcionales finales pasaron: suite 174/174 y tipos sin errores; tras corregir el bloqueo de salto inicial, la verificación independiente del código actual pasó 10/10 sondas de salto original/espejado, límites estrictos y caducidad, más 28/28 contactos, salida 0 y sin stderr. Hash de fuente validada: `b25b3f2f8f76fccafc31b67565a728a1e2573f3a`; no se modificó la fuente después. Evaluación final: riesgo medio con escalamiento del ítem 3, `reviewDue: false`; no se inició revisión nativa. Los fallos iniciales de suite y preparación temporal son antecedentes, no fallos funcionales actuales.

El job 3 regeneró producción HTTPS, IPK 0.2.4 con el mismo ID `com.systemautomatic.tvfootball.probe` y preview loopback; reemplaza los artefactos obsoletos del job 2 previo a la corrección. Docker local `tv-football-polish-024:local`, con runtime `--network none`, respondió HTTP 200 y cuerpo exacto `{"ok":true}`, salida 0. Avisos conocidos requiredACG/DEP0190 sin cambios. Son resultados locales atribuidos al padre, no una publicación ni una medición de TV.

La ronda 03 intentó una sola captura, primero de TV. Falló en `Page.captureScreenshot` con `CdpRequestTimeoutError` tras unos 17 segundos, salida 1; no llegó al límite exterior de 45 segundos. Antes solo se observó el lienzo Phaser real en DOM: 1280 × 720 lógicos, rectángulo 1072 × 603 en x28/y206, viewport 1440 × 900, DPR1 y fase Lobby. **Eso prueba límites, no una imagen, contraste ni calidad visual del estadio.** La captura del teléfono no se intentó. No hubo reintento, alternativa, migración, espacio nuevo ni finalización forzada del espacio con error. El espacio Ego 6 conserva p1 teléfono/p2 TV; el padre detuvo su servidor loopback del job 4.

La prueba visual no está disponible: T4 sigue bloqueada hasta que el usuario elija autorizar publicación 0.2.4 para inspección manual o esperar reparación del navegador. No hay más verificaciones autorizadas ni aceptación física; la aprobación anterior solo cubría 0.2.3.

## Diagnóstico opcional

La vista normal no muestra información técnica ni calcula percentiles de dibujo. Para una sesión de diagnóstico abrí la página de TV con `?debug=1` y desplegá Diagnóstico de conexión. Los intervalos observados entre actualizaciones y el RTT de mensajes **NO miden la latencia del botón a la pantalla**, la carga de CPU/GPU ni el tiempo de respuesta del volumen del sistema. No se añaden temporizadores de muestreo. Los mensajes de error no muestran valores internos del protocolo ni claves de sesión.

## Pendiente en la TV real

- Comparar la respuesta de subir/bajar volumen y silenciar antes y después, tanto en la sala como durante el juego.
- Comprobar que una pulsación de OK crea una sola sala, que mantenerlo pulsado no la reemplaza y que el clic sigue funcionando.
- Verificar foco al cerrar la superposición de volumen, QR, aspecto del estadio al atardecer y cancelación al salir realmente de la aplicación.
- Comprobar contraste de pelota, jugadores y arcos sobre cielo, público y césped en la TV real, sin inferir comodidad ni calidad visual de las pruebas estructurales.

No se publicó, instaló ni modificó la TV para estas pruebas de código.
