# Aceptación del juego completo en dispositivos reales

Ejecutá solo después de un despliegue HTTPS y una instalación IPK autorizados. Recogé evidencia de LG real + Android + iPhone. La prueba anterior de conectividad se validó y tuvo buena respuesta; el juego completo sigue pendiente de aceptación física. Navegadores de escritorio, pruebas sin pantalla, emuladores y compilaciones exitosas no demuestran compatibilidad de TV ni latencia aceptable. Consultá las [reglas](game.md).

## Pulido 0.2.6: pendiente

**T4 integración en curso; T5 aceptación física bloqueada por entrega/operación aún no autorizadas.** No hay prueba física 0.2.6. Los tres «sí» de la prueba autorizada 0.2.5 confirman solo arranque, QR/código y volumen inmediato, no apagado, partido completo ni calidad visual. Esa autorización de instalación/apertura se agotó; no habilita otra operación.

Preparación local: caras/camisetas/botines originales, pelota con patrón y cancha lateral sobria en Canvas2D nativo. Fondo y atlas cacheados una vez, sin Phaser ni WebGL directo, dependencias nuevas, rutas/fuentes por fotograma o bucle de dibujo en reposo; se conservan 1280×720 sin DPR y límite activo 30 Hz. El presupuesto medido de 3 lienzos/7,154 MiB no certifica apariencia ni rendimiento físico. La patada vertical 650 (antes 400) da unos 120 píxeles frente a 45–47, sin cambiar horizontal 900, alcance 100, intervalo 400 ms, límite 1400, rebote 0,92 ni reglas.

### Evidencia local completada, no aceptación física

- Padre: suite **218/218**, foco de fuentes **117/117** tras la expectativa intencional 650 y tipos salida 0. Independiente **153/153**, tipos salida 0 y stderr vacío: salida/reentrada/fullscreen ajeno, segundo plano y recuperación a 59.999 ms con clave rotada/preparación dentro del panel, más nueve límites de fallo de gráficos nativos. Fuentes protegidas sin cambios posteriores. Problemas preparatorios de sintaxis en scratch y timeout de inspección `du` no fueron fallos del producto ni se reintentaron.
- Job15 del padre: build/IPK/Docker locales, salida 0, salud HTTP 200/cuerpo exacto `{"ok":true}`. TV JS **118.523 bytes**, controles **27.812 bytes**, IPK **22.960 bytes**, 0.2.6/ID sin cambios; avisos requiredACG/DEP0190 conservados. Caché/reposo y grafo libre de Phaser intactos: 154+668 llamadas una sola vez, 1.875.456 píxeles/7,154 MiB, cuatro blits por cambio y cero en pose idéntica. No mide FPS ni respuesta de volumen.
- Navegador: browser01 funcionó; browser02 salió 1 por exigir altura emulada 650 al fullscreen nativo real 1920 × 967. El fallo original queda preservado; no se parcheó ni debilitó el producto. El padre ejecutó **solo la continuación corregida browser03** en el mismo espacio 8/p1, salida 0 tras unos 21 segundos. El JSON existente `artifacts/landscape-polish-0.2.6/browser-corrected-results.json`, leído pasivamente, declara `success: true`, `stage: complete` y ninguna medición pendiente.
- Nativo: panel propietario 1920 × 967; cuatro botones 112 × 112, Volver 84 × 64 y preparación 139,15625 × 64 dentro del viewport real y sin oclusión. Volver salió y conservó claves/nodos/presencia; entrada neutra y HUD limpio al cerrar el propietario. No se deduce bloqueo de orientación.
- Respaldo CSS: misma página, servidor local separado 3301 con `Permissions-Policy: fullscreen=()`; denegación real del navegador, sin sustituir APIs ni cambiar producción. Ocho viewports/alturas visibles simuladas, cuatro botones y Volver ≥64, dentro del área y sin oclusión; conexión, marcador y preparación en el panel. Inicio/reanudación/revancha alcanzables, sin pulsar Listo con un solo jugador. Toques CDP izquierda + salto con captura de puntero llegaron por WebSocket y se soltaron a neutro; Escape y Volver con entradas sostenidas también. Claves, nodos, presencia, conexión y página se conservaron, sin preparación accidental; cierre final limpió HUD/formulario. «En juego» fue solo distribución, no física real. Ver [matriz y límites](controller-layout.md#evidencia-local-026-fullscreen-nativo-y-respaldo-css-separados).
- **Pendiente físico:** bloqueo/desbloqueo/giro del SO, teléfonos, calidad visual, comodidad, apagado y partido completo. No hubo capturas/exportación de imágenes ni reintento/alternativa de captura. Espacio finalizado una vez con SUCCESS; el padre detuvo sus servidores propios jobs16/20. Aviso de actualización de Ego Lite comunicado, sin autorización ni actualización.
- Evaluación del padre: riesgo medio + ítem 3 alto, `reviewDue: false` sobre 925 líneas antes de esta documentación; sin revisión nativa iniciada. T1/T2/T3 terminadas como código, T4 solo pendiente de documentación final/commits/refs; T5 bloqueada. No hubo TV, Dokploy, SSH/inspector, instalación ni publicación. Esta actualización es solo lectura de evidencia/documentación, sin nuevas verificaciones.

### Pendiente tras autorización separada

No se reabre el inspector/SSH de TV ni se publica o instala desde esta tarea. La aprobación de 0.2.5 no concede operaciones de 0.2.6.

Solo tras entrega autorizada, con Android e iPhone reales:

- [ ] Comparar arranque, QR/código y volumen con 0.2.5; probar además apagado y partido completo, sin inferirlos de los tres «sí» anteriores.
- [ ] Revisar caras, camisetas/botines, pelota y cancha lateral con marcador/arcos legibles; recoger juicio visual humano, no deducirlo del DOM ni de conteos de dibujo.
- [ ] Conectarse, tocar **Controles** y registrar si realmente entra en fullscreen y bloquea horizontal. iPhone Safari no admite `orientation.lock`: verificar panel de página completa + aviso español y giro manual si falta/rechaza alguna API. No confundir resize emulado o `orientation.type` con rotación/bloqueo del sistema operativo.
- [ ] Verificar **Volver** alcanzable, cuatro botones ≥64, captura de puntero y varios dedos sin recorte/oclusión, con barras expandidas/contraídas, áreas seguras, giro y horizontal corto. Misma sesión/clave, sin recarga, reconexión extra ni lugar nuevo.
- [ ] Mantener movimiento + salto/patada; salir con Volver, Escape y salida nativa, o pasar a segundo plano: no deben quedar pulsaciones pegadas, superposición ni fullscreen/bloqueo propio. Resize conserva el modo; no debe perder preparación ni credenciales.
- [ ] Dentro del panel, acceder a conexión, marcador, **Listo para jugar**, **Confirmar reanudación** y **Listo para la revancha**; ambos confirman. Conservar zoom y teclado. Registrar comodidad física por separado de la mera visibilidad.
- [ ] Comparar patadas más altas en ambos sentidos y preservar contactos, paso bajo salto, goles completos/en contra, reloj 120 s, anuncio 1,2 s y recuperación 60 s. Repetir la matriz táctil y ciclo de vida de abajo.

## Recuperación ligera 0.2.5: evidencia histórica parcial

**Estado actualizado:** hubo entrega e instalación/apertura autorizadas una vez y confirmación física parcial de arranque, QR/código y volumen. Apagado, partido completo y apariencia no quedaron confirmados. La prueba física de 0.2.4 falló desde el arranque, antes del QR: volumen lento y apagado demorado; el usuario informó respuesta normal fuera del juego. No hay aceptación física de 0.2.4 ni causa confirmada. No se repiten la sesión agotada de inspector/SSH ni la captura fallida anterior.

La entrada de TV 0.2.5 elimina Phaser de su grafo y usa Canvas2D nativo: fondo simple cacheado una vez, lienzos de 1280×720 sin multiplicador DPR, hasta 30 actualizaciones activas por segundo y sin cadena continua de dibujo en sala, pausa o fin. Conserva heartbeat, reglas, física y mandos de 0.2.4. Es reducción local de trabajo de software, no prueba de CPU/GPU ni de recuperación del sistema.

### Evidencia local 0.2.5 completada, no aceptación física

- Padre job11: build, paquete TV 0.2.5, preview loopback y Docker local `tv-football-lightweight-025:local` con `--network none`, salida 0; salud HTTP 200 con cuerpo exacto `{"ok":true}`. JavaScript entregado **113.340 bytes**, IPK **21.852 bytes**, ID `com.systemautomatic.tvfootball.probe` sin cambios. La comparación de fuentes `write:false` **7.083.297→113.326 bytes** (~98,4% menos) es una medición distinta. Avisos requiredACG/DEP0190 conocidos conservados.
- Verificador independiente: enfoque 110/110, salida 0, stderr vacío y ningún bloqueo de software reproducido para S1–S3. Tipos salió 1 por entorno (`tsc` ausente al omitir `.bin` de Windows en el scratch), sin diagnósticos TypeScript ni reintento. Suite raíz 184/184 y tipos raíz salida 0 siguen vigentes para las mismas fuentes protegidas. Una sonda inicialmente demasiado estricta sobre el último RAF sucio se corrigió en scratch y pasó dirigida 1/1; no hubo defecto ni corrección del producto. Ver [evidencia y límites](tv-performance.md).
- Padre job13: una nueva comprobación funcional **local** 0.2.5, salida 0 tras aproximadamente un segundo. El JSON existente `artifacts/lightweight-recovery-0.2.5/browser-results.json` da `success: true`, espacio 7, viewport visible 1280×900/DPR1, sala y lobby/02:00/P1 azul: 0/P2 naranja: 0; el padre confirmó QR creado. Un Canvas2D nativo lógico 1280×720, error oculto, ajuste completo y 265 píxeles coincidentes en margen/cancha/P1/P2/pelota. Contenido centrado 912×513 dentro de caja 912×752. No hubo screenshot/exportación, mutación privada del anfitrión, TV, teléfonos ni flujo de juego. El helper finalizó una vez con SUCCESS y el padre detuvo su preview propio (job12).
- Esa comprobación no repite la captura 0.2.4 ni el diagnóstico agotado de TV. No demuestra QR físico, volumen, apagado, FPS, latencia ni recuperación: en esa comprobación local quedaron desconocidos. La confirmación física posterior solo cubrió arranque, QR/código y volumen inmediato; apagado y juego completo siguen pendientes.
- Evaluación del padre: riesgo medio + escalamiento independiente ítem 3, `reviewDue: false` bajo presupuesto de 16 rutas/632 líneas. Fuentes protegidas sin cambios; T1/T2 terminadas como código, T3 solo pendiente de commits/refs del padre, sin más comprobaciones completas necesarias. No hubo push, instalación ni cambios de VPS/TV: la autorización es preparar solamente.

Solo después de autorización y entrega por el operador:

- [ ] Registrar versión real instalada, revisión y entorno. Desde el inicio, comprobar que aparece la cancha completa, una sola sala, QR y dirección manual sin bloqueo; no conectar teléfonos antes de observar el arranque.
- [ ] Comparar volumen/silenciar con la app cerrada, sala abierta y jugando; comprobar apagado con el operador y registrar demoras, sin atribuirlas a CPU/GPU ni repetir diagnósticos remotos.
- [ ] Verificar cancha simple sin recorte, P1 azul/P2 naranja, pelota y ambos arcos, marcador y reloj 02:00 legibles. OK/Nueva sala cambia una sola sala por pulsación; otras teclas conservan su función.
- [ ] Conectar ambos teléfonos por QR y también por código; comprobar mandos vertical/horizontal y acciones simultáneas. Ambos confirman inicio, revancha y reanudación. Repetir contactos, paso bajo salto, restitución 0,92, goles completos/en contra y anuncio acreditado de 1,2 segundos sin parar el reloj.
- [ ] Desconectar y recuperar con la misma sesión antes de 60 segundos; ambos confirman. Comprobar cancelación sin ganador al vencer. Segundo plano/salida/pérdida de red de TV terminan la sala; volver requiere Nueva sala y no recuperación automática.
- [ ] Revalidar las secciones de conexión, reglas y matriz táctil de abajo; revisar resultados con el usuario antes de afirmar recuperación o aceptación física.

## Inicio rápido

1. Registrá el entorno; conectá los tres dispositivos a la misma Wi-Fi y usá el servidor público desplegado, solo tras autorización.
2. Observá primero arranque/QR y respuesta del sistema. Luego conectá ambos teléfonos, confirmá preparación y ejercitá juego, recuperación y ciclo de vida.
3. Revisá los resultados nuevos con el usuario. **No afirmes aceptación física del juego completo a partir de la prueba anterior.**

## Referencia histórica: volumen, control remoto y distribución (0.2.2)

- [ ] Con la app cerrada, probar una pulsación de subir/bajar volumen y silenciar. Registrar si la respuesta es inmediata o tarda.
- [ ] Repetir con la sala abierta y durante una partida en la versión anterior y en 0.2.2, manteniendo las mismas condiciones. Anotar la versión y el resultado; un video corto puede ayudar. No atribuir la causa al servidor o a CPU/GPU solo por la percepción.
- [ ] Seleccionar **Nueva sala** con el control remoto: una pulsación de OK debe cambiar el código una vez; mantener OK no debe crear salas sucesivas. Repetir con clic y después de cerrar la superposición de volumen.
- [ ] Solo marcador, reloj y estado esenciales en la vista principal; QR/dirección/código legibles cuando hacen falta. Diagnóstico técnico oculto salvo modo explícito `?debug=1`; no mide carga de CPU/GPU ni latencia del volumen. Ver [límites de la optimización](tv-performance.md).
- [ ] En Android e iPhone, revisar grupos de movimiento y acciones, alcance de ambos pulgares y botones de al menos 64 píxeles lógicos, vertical y horizontal. Probar pulsaciones simultáneas, soltar y cancelar; los avisos de conexión/preparación no deben quedar ocultos. Ver [diseño de controles](controller-layout.md).

## Referencia histórica: pulido 0.2.3

Referencia histórica: conservá estos criterios y cualquier evidencia de navegador de 0.2.3 como resultados de esa versión, no como prueba del código 0.2.4. El rebote moderado de esta sección describe el ajuste anterior, no el objetivo nuevo.

- [ ] En Android e iPhone, con barras del navegador expandidas y contraídas, revisar vertical y horizontal: los cuatro botones de juego deben quedar dentro del área visible sin desplazar la página. La conexión/ayuda pueden desplazarse internamente; probar también teclado, orientación y ampliación sin desactivar zoom.
- [ ] Durante cambios de tamaño/barras, no se debe perder el lugar, cambiar la clave ni enviar pulsaciones por sí solo. Probar movimiento más patada, liberación, cancelación y recuperación de la sesión.
- [ ] Al terminar o perder la sala, el mando no debe seguir diciendo **En juego** con datos antiguos; preparación y errores deben ser claros.
- [ ] Identificar **P1 azul** y **P2 naranja** en TV y teléfonos. Arco derecho suma a P1; arco izquierdo a P2, incluso en gol en contra. Cada cruce válido suma una vez.
- [ ] Cada gol muestra **¡GOOOLLL!** con el jugador acreditado durante unos 1,2 segundos; el reloj sigue y no se bloquean controles. Revancha, Nueva sala y cierre no deben mostrar anuncios viejos ni anunciar el reinicio a cero.
- [ ] Probar movimiento más rápido/preciso, salto más útil, rebotes moderados y patada consistente. Registrar si la sensación resulta divertida y controlable; no darla por probada solo porque pasan tests.
- [ ] Confirmar que volumen y OK/Nueva sala mantienen la respuesta aceptada en 0.2.2.

## Comprobar los cambios 0.2.4

**Registro histórico, no aceptación: la prueba física posterior de 0.2.4 falló al arrancar.** Esa falla motivó preparar la base ligera 0.2.5. La decisión vigente es pulirla localmente en 0.2.6, sin nueva publicación, instalación ni reintentos de diagnóstico de TV. La alternativa anterior de publicar 0.2.4 para inspección ya no es el siguiente paso.

Los datos siguientes corresponden al candidato histórico 0.2.4 y no validan Canvas2D 0.2.5. Conservá los criterios jugables para revalidación autorizada, sustituyendo el estadio decorativo por la cancha simple. El código y las pruebas automáticas no prueban comodidad física, ausencia de desplazamiento en teléfonos reales, FPS de TV ni diversión.

### Evidencia existente, no aceptación física

- Padre: suite final 174/174 y tipos sin errores. Verificación independiente inicial 142/142 + tipos, seguida de un bloqueo de salto; tras la corrección acotada, código actual 10/10 sondas de salto original/espejado, límites estrictos y caducidad, y 28/28 contactos, salida 0 sin stderr. Bloqueo resuelto; fallos iniciales de suite/preparación temporal quedan como historia. Fuente validada e inmutable después: `b25b3f2f8f76fccafc31b67565a728a1e2573f3a`.
- Padre: job 3 regeneró HTTPS de producción, IPK 0.2.4 con ID de app sin cambios y preview loopback; sustituye el job 2 obsoleto previo a la corrección. Docker local `tv-football-polish-024:local` con `--network none`: salud HTTP 200, cuerpo exacto `{"ok":true}`, salida 0. Avisos requiredACG/DEP0190 conocidos sin cambios. No hubo publicación ni instalación.
- Rondas 01/02 del padre: salida 0. Lectura del `artifacts/browser-responsive-stadium-0.2.4/results.json` existente: `success: true`, espacio 6; ocho tamaños/alturas, ayuda abierta y tres fases de horizontal corto. Cuatro botones ≥64, dentro del área visible, hit-test verdadero, sin desbordamiento ni scroll de página, formulario oculto y controles antes de ayuda; marcador global P1 azul 7/P2 naranja 9. Dos toques CDP izquierda + salto llegaron por WebSocket real, se mantuvieron durante 650→600 visibles y se liberaron a neutro. Ver [etiquetas exactas y límites](controller-layout.md). Es Chromium emulado con VisualViewport sustituido, no barras/teclado/fingers físicos ni iPhone.
- Ronda 03: única captura TV-first fallida, salida 1 tras unos 17 segundos por `CdpRequestTimeoutError` en `Page.captureScreenshot`, antes de intentar teléfono y sin alcanzar el límite exterior de 45 segundos. Solo se midió el lienzo Phaser real: lógico 1280 × 720, rectángulo 1072 × 603 en x28/y206, viewport 1440 × 900 DPR1, fase Lobby. Sin imagen ni veredicto visual 0.2.4, sin reintento ni alternativa. Espacio Ego 6 p1 teléfono/p2 TV conservado por el error; servidor loopback propio del padre (job 4) detenido.
- Evaluación final del padre: riesgo medio + escalamiento ítem 3, `reviewDue: false`, sin revisión nativa iniciada. T1–T3 están terminadas como código, no como aceptación visual/física. Los commits locales serán del padre, con pruebas/docs completas por comportamiento: física (~423 líneas, sobre la recomendación de 400 para conservar todas las regresiones de salto), mando (~253), estadio cacheado (~253), metadatos/evidencia. Sin staging parcial de pruebas ni publicación automática. Este cierre histórico de código no implica aceptación física: la prueba posterior falló y motivó la recuperación 0.2.5.

- [ ] En Android e iPhone, probar vertical de 320 píxeles lógicos de ancho, horizontal de poca altura y también navegador de escritorio. Registrar área visible y orientación: grupos para ambos pulgares, cuatro acciones y botones de al menos 64 píxeles lógicos; confirmar que todos sean alcanzables sin desplazar la página y anotar si resultan cómodos.
- [ ] Repetir con barras del navegador expandidas/contraídas, teclado abierto/cerrado y zonas seguras (muescas/indicador de inicio). Ayuda/conexión deben poder desplazarse internamente sin tapar controles. Conservar ampliación y navegación por teclado; no exigir orientación fija.
- [ ] Probar varios dedos: movimiento + salto + patada, liberación independiente, salida del botón y cancelación. Girar/redimensionar con botones pulsados; no deben quedar entradas pegadas ni cambiar lugar/credenciales. Cortar y restaurar Wi-Fi; recuperar con la misma sesión dentro del plazo y confirmar ambos, sin compartir claves. Repetir la matriz táctil completa de abajo.
- [ ] Apretar la pelota entre los dos jugadores: corredor contra rival quieto, ambos empujando, mantener presión y soltar, repitiendo en ambas direcciones. No debe atravesar cuerpos ni salir disparada a una posición lejana. Saltar y confirmar que pase por debajo solo cuando haya espacio real.
- [ ] Comparar los rebotes mucho mayores (restitución 0,92 frente a 0,55) en suelo, paredes y jugadores; registrar sensación y control sin darlos por aceptados. Confirmar pelota completa dentro del arco para puntuar, ausencia de gol sobre el travesaño, gol en contra acreditado al rival y un único punto por cruce. **¡GOOOLLL!** debe acreditar al jugador correcto sin detener reloj ni controles.
- [ ] Criterio visual histórico 0.2.4: fondos estáticos más ricos y coherentes en estadio y mando. Para 0.2.5, revisar la cancha simple y el mando conservado: pelota, jugadores, arcos, marcador, reloj y avisos legibles. No confundir detalle estático con rendimiento en TV. Repetir volumen/silenciar, apagado y OK/Nueva sala con sala abierta y jugando, sin dar por recuperada la respuesta.

## Registrar el entorno

No guardes direcciones privadas, cuentas, frases de acceso ni claves en Git. Ocultá datos sensibles en capturas y registros antes de compartir.

| Dato | Resultado observado |
|---|---|
| Modelo de TV | |
| Firmware / versión webOS leída en la TV | |
| Motor web / agente de usuario de la app instalada, inspección manual o autorizada | |
| Versión IPK / revisión de compilación / origen configurado | |
| Modelo Android / sistema / versión de navegador | |
| Modelo iPhone / iOS / versión de navegador | |
| Condiciones Wi-Fi / hora / carga de red | |
| Ubicación del VPS verificada por el operador, no supuesta | |
| Modo de imagen de TV / modo juego si existe | |
| Tiempo restante de Developer Mode / renovación comprobada | |

No deduzcas el motor web a partir del firmware. Marcá como desconocidos los datos que falten.

## Conexión y aislamiento

- [ ] Abrir la app instalada. Comprobar TLS/certificado válido, actualización WSS y enlace con origen opaco/archivo. Registrar si se requiere `ALLOW_TV_OPAQUE_ORIGIN`; producción sigue en HTTPS/WSS.
- [ ] Comprobar el primer arranque: aunque empiece oculta, al mostrarse aparece una sola sala con código y QR. Si se oculta antes de recibir la primera sala, cerrar el intento y crear una sola al volver. Repetir visibilidad no debe duplicarla.
- [ ] QR abre los controles HTTPS; probar por separado dirección y código manuales en ambos teléfonos. Si falla el QR, dirección y código siguen visibles.
- [ ] Cancha original completa de 1280×720 sin recorte: dos arcos, P1 azul, P2 naranja, marcador y reloj legibles. Sin errores CSP, recursos remotos ni arte ausente.
- [ ] Android e iPhone reciben lugares distintos y controlan solo su jugador. Conectarse no basta para empezar: ambos pulsan **Listo para jugar**. La TV muestra preparación P1/P2.
- [ ] El panel de conexión se reduce al jugar y deja toda la cancha visible; instrucciones QR/manuales siguen disponibles cuando hacen falta. **Nueva sala** tiene foco visible con el control remoto y no requiere texto en TV.
- [ ] Un tercer dispositivo/navegador no reemplaza jugadores. Un código no suplanta la conexión de TV propietaria.
- [ ] **Nueva sala** cambia de sala; controles anteriores no afectan la nueva. Volver a conectar ambos deliberadamente. Eventos o QR tardíos de la sala anterior no deben cambiar el código, la imagen ni terminar la nueva.
- [ ] Revisar que etiquetas, ayuda, estados, resultados, botones y diagnósticos de TV y teléfono estén en español, sin motivos internos ni claves visibles.

## Reglas y recuperación

- [ ] Ambos listos inician 0–0 y 02:00. Probar izquierda/derecha y salto/patada simultáneos. Revisar colisiones de cuerpo/cabeza/suelo y ambos arcos.
- [ ] Marcar en cada arco; exactamente un punto al jugador correcto y un saque, conservando reloj. Golpear por encima del travesaño no puntúa.
- [ ] Completar 120 segundos activos. Reloj redondeado hacia arriba hasta 00:00. Gana el mayor marcador; igualdad muestra EMPATE, sin tiempo extra.
- [ ] Pantalla final muestra resultado y preparación para revancha. Una confirmación no reinicia; ambas reinician marcador, reloj y saque.
- [ ] Desconectar un teléfono durante el juego. Al reconocerse, física y reloj se congelan; TV muestra cuenta regresiva de 60 segundos y borra ambas preparaciones.
- [ ] Volver dentro del plazo con el mismo teléfono y sesión original. Mismo lugar; otro navegador con solo el código no puede ocuparlo. Ambos pulsan **Confirmar reanudación** antes de avanzar reloj/física.
- [ ] Con ambos de vuelta, TV espera confirmaciones sin descontar un plazo de ausencia. Otra ausencia inicia 60 segundos nuevos; volver solo uno durante una ausencia en curso no extiende el plazo.
- [ ] Dejar un teléfono ausente los 60 segundos desde la detección, incluso con alguien ganando. Se cancela sin ganador, queda congelado y exige **Nueva sala**.
- [ ] Pérdida de sesión o almacenamiento denegado dan información clara; recuperación fallida puede requerir **Nueva sala**. Claves solo en `sessionStorage` original, nunca QR/direcciones, capturas compartidas ni registros.

## Matriz táctil y ciclo de vida

Repetí cada fila en **ambos** teléfonos observando ambos jugadores. Registrá aprobado/fallido y detalles, no solo si cargó la página.

| Acción | Resultado Android | Resultado iPhone |
|---|---|---|
| Mantener izquierda + patear + saltar; repetir con derecha | | |
| Soltar cada dedo independientemente con otros pulsados | | |
| Deslizar un dedo fuera de su botón y soltar | | |
| Cancelar puntero / interrumpir gesto táctil | | |
| Girar el teléfono con controles pulsados | | |
| Cambiar de app / pasar navegador a segundo plano | | |
| Bloquear teléfono mientras se pulsa; desbloquear y volver | | |
| Cerrar pestaña / desconectar navegador mientras se pulsa | | |
| Apagar Wi-Fi mientras se pulsa; restaurar red | | |
| Pasar TV a segundo plano, volver, reabrir y usar Nueva sala | | |

Esperado: soltar/cancelar libera los controles afectados; no quedan acciones ni movimiento pegados. Una conexión medio abierta libera botones tras 350 ms de caducidad de seguridad, más la demora de temporizadores, sin esperar la comprobación de actividad. Reconocer una desconexión completa del teléfono puede llevar unos 20 segundos por esa comprobación del servidor; al detectarse, pausa y empieza el plazo de 60 segundos. Vencer controles no cambia la presencia del lugar. Registrá demoras reales, sin prometer plazos exactos de tiempo real. Las comprobaciones de actividad de la TV pueden terminar su sesión antes.

Los lugares siguen reservados: solo la clave de la sesión original recupera ese jugador, incluso al recargar dentro de esa sesión. Cerrar toda la sesión puede perderla. Otro navegador no reemplaza el lugar. Segundo plano, salida, pérdida de conexión o fallo de actividad de TV terminan toda la sala; volver **no** recupera la partida. Seleccioná **Nueva sala** y conectá ambos teléfonos otra vez. Comprobá aviso de fin a controles viejos y que no afecten la nueva partida. Probá vencimiento de sala a los 30 minutos predeterminados, o documentá un plazo menor configurado deliberadamente y restaurá el valor después.

## Medir RTT sin confundirlo con respuesta visual

Recogé RTT de aplicación teléfono↔servidor, teléfono↔TV a través del servidor y TV↔servidor. RTT es el tiempo de ida y vuelta de un mensaje. Por cada ventana móvil, registrá **p50, p95, cantidad de muestras** y **variación = p95 − p50**, en milisegundos. Hay hasta 120 muestras; esperá una cantidad útil y registrá la real. Las mediciones usan `performance.now()` local, no relojes sincronizados ni latencia de un solo sentido. «Última» es la muestra más reciente; «esperas agotadas» cuenta mediciones sin respuesta dentro del plazo, no goles ni errores de juego.

La respuesta de medición teléfono→servidor→TV→servidor→teléfono sale **antes de dibujar**. No mide latencia del botón a la pantalla. Los intervalos entre actualizaciones de escena no son tiempos de presentación ni garantizan cuadros por segundo.

| Prueba / teléfono / reposo o carga | Ruta | p50 ms | p95 ms | Muestras | Variación ms | Errores / notas |
|---|---|---|---|---|---|---|
| | Teléfono ↔ servidor | | | | | |
| | Teléfono ↔ TV por servidor | | | | | |
| | TV ↔ servidor | | | | | |
| | Teléfono ↔ servidor | | | | | |
| | Teléfono ↔ TV por servidor | | | | | |
| | TV ↔ servidor | | | | | |

## Respuesta percibida

- [ ] Si existe, habilitar modo juego de imagen y registrar configuración; mantener dispositivos en la misma Wi-Fi.
- [ ] Repetir movimiento + salto + patada en Android e iPhone, primero con red en reposo y después con carga representativa. Registrar demora, variación, liberaciones perdidas y bloqueos por separado del RTT.
- [ ] Opcional: filmar dedo y TV juntos con video de alta velocidad. Contar cuadros desde el toque visible hasta la primera respuesta visible; estimar `frames / camera_fps × 1000` ms. Indicar cuadros por segundo de la cámara y cantidad contada. Es aproximado y limitado por cuadros; exposición, detección táctil y barrido de pantalla agregan incertidumbre.
- [ ] No prometer cuadros por segundo ni latencia a partir de mediciones preliminares. No elegir otra ubicación del VPS sin evidencia y revisión del usuario.

## Detenerse para revisión del usuario

| Resultado de revisión | Evidencia / decisión del usuario |
|---|---|
| Instalación / TLS / compatibilidad de motor | |
| Seguridad y ciclo de vida con dos teléfonos | |
| RTT en reposo/carga y respuesta percibida | |
| Aceptar ruta actual o investigar alternativas | |
| Reglas, preparación, revancha y recuperación del juego completo | |

**Detenerse aquí hasta que el usuario revise los resultados reales.** Registrar fallos honestamente; la prueba anterior no satisface esta aceptación. Si la ruta del VPS es insuficiente, proponer ubicación de menor latencia solo con mediciones; no comprar, aprovisionar ni modificar infraestructura sin aprobación. No debe requerirse computadora ni servidor doméstico adicional durante el juego una vez instalados servidor público y app de TV.
