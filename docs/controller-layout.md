# Mandos abajo, al alcance de los pulgares

Los controles ocupan dos zonas inferiores: movimiento a la izquierda, acciones a la derecha. La conexión queda arriba y la ayuda sigue a los controles como pie desplegable; ambos paneles tienen desplazamiento interno. El fondo combina tinta oscura y azul de atardecer con naranja y dorado, en sintonía con el estadio; son gradientes y paneles estáticos, sin imágenes, filtros ni animaciones. Es un rediseño de distribución, no una afirmación de comodidad física ya comprobada.

## Para jugar

1. Ingresá el código de la TV y tocá «Entrar a la sala». El formulario se oculta solo al recibir la asignación; vuelve al perder la conexión o terminar la sala.
2. Leé tu jugador y confirmá «Listo para jugar». Ambos deben confirmar también la reanudación y la revancha.
3. Mantené «Izquierda» o «Derecha» con el pulgar izquierdo. Tocá «Saltar» (naranja, elevado) o «Patear» (dorado, abajo) con el derecho. Podés mantener movimiento y acción a la vez.

«Ayuda y conexión» sigue a los cuatro controles, tanto en pantalla como en el orden de lectura y navegación con teclado. Empieza cerrada y se desplaza por dentro al abrirse. También podés desplazar el panel de conexión si el teclado o los avisos dejan poco espacio. No hace falta desplazar la página para llegar a los botones de juego. Se permite girar y ampliar; solo esos cuatro botones bloquean los gestos para conservar los dedos simultáneos.

## Distribución y estados

| Aspecto | Decisión |
| --- | --- |
| Vertical | El margen superior automático de los controles absorbe el espacio libre después de la conexión. Los dos pares compactos quedan en la zona inferior, justo antes del pie de ayuda; salto está ligeramente elevado. El flujo flex conserva el orden conexión → controles → ayuda, sin reordenamiento visual. |
| Ancho mínimo y escritorio | A 320 píxeles CSS, los mínimos declarados son 64 × 64, con 8 píxeles entre botones de cada par y al menos 24 entre grupos. Los botones crecen hasta 112 × 112 cuando hay espacio; los pares no se dispersan por toda la pantalla en escritorio. El cuerpo se limita a 1040 píxeles. |
| Horizontal corto | Hasta 500 píxeles de alto en horizontal, el tamaño depende de la altura visible, entre 64 y 88 píxeles. Se reducen el escalón de salto y el relleno, no el mínimo de los botones. Los pares siguen en los lados inferiores. |
| Altura y bordes | Se usan las cuatro áreas seguras y la altura visible. El entrypoint ya existente agrupa cambios de barras, orientación y teclado en un cuadro mediante `visualViewport.height` o `innerHeight`, sin sondeo ni escrituras repetidas. No se fuerza la orientación. |
| Información extensa | Conexión y ayuda tienen desplazamiento interno independiente. La ayuda abierta ocupa como máximo el 24 % de la altura visible, acotado entre 44 y 180 píxeles. Los controles no se encogen para cederle sitio al texto; el pie abierto puede desplazarlos hacia arriba dentro de la zona visible, sin invertir el orden. |
| Lectura y respuesta | Cuatro etiquetas españolas permanentes, iconos locales decorativos, foco visible, borde discontinuo al desactivar y contraste de fondo/borde/sombra al mantener pulsado. No se depende solo del color. |
| Marcador | Siempre P1 azul a la izquierda y P2 naranja a la derecha, aunque controles a P2. La TV proporciona marcador y reloj; no hay predicción local. |
| Preparación y recuperación | Se conservan «Listo para jugar», «Confirmar reanudación» y «Listo para la revancha». Al desconectarse, el HUD muestra «Reconectando…»; al terminar/rechazar la sala se limpia el marcador anterior y queda el aviso real. |
| Entrada y sesión | Redimensionar no envía entradas, crea conexiones ni rota claves. Se mantienen los mismos nodos de botones, captura/liberación de puntero, varios dedos y liberación al cancelar, perder foco o pasar a segundo plano. |

Las salas de juego conservan el lugar durante 60 segundos en el mismo navegador. La clave rota al recuperar la conexión, no al redimensionar. Otro navegador no reemplaza al jugador. Las salas de prueba anteriores no ofrecen esa recuperación. RTT mide mensajes de ida y vuelta, **no** el tiempo entre tocar y ver la acción en la TV.

## Qué comprueban las pruebas

`tests/mobile-viewport.test.ts` ejecuta el entrypoint real empaquetado en una fachada de APIs DOM: altura visible frente a altura de layout, cambios de barras/orientación, ausencia de `visualViewport`, nodos y pulsaciones simultáneas, preparación, errores, almacenamiento y recuperación. Su contrato diferencial puede recibir código y HTML externos para comparar la entrada pública con una base, sin leer historial de Git en las pruebas guardadas. `tests/localization.test.ts` comprueba las cuatro etiquetas y grupos, además de los mensajes españoles anteriores. Se conserva el contrato previo de `tests/mobile-layout.test.ts`: controles antes de la ayuda progresiva, con los mismos enlaces, formulario y avisos.

Los contratos de hoja de estilo comprueban anclaje inferior, separación y límites declarados, áreas seguras, desplazamiento interno, foco/estado y arte estático. **No calculan rectángulos, impactos ni comodidad.** Las propiedades CSS son intención de diseño, no evidencia física.

### Evidencia anterior: solo la distribución 0.2.3

Antes de este rediseño, `artifacts/browser-viewport-goals/round-02.mjs` había medido seis tamaños emulados: 390 × 844 con 650 visibles, 360 × 800 con 600, 320 × 568 con 450, 844 × 390 con 320, 667 × 375 con 280 y 390 × 844 completo. En esa versión se observaron cuatro blancos de al menos 64 × 64, sin desbordamiento ni obstáculos, incluso con ayuda abierta. Dos toques automatizados conservaron movimiento y salto durante un cambio de altura y liberaron al terminar; el cierre de sala limpió el HUD. No se capturaron imágenes.

Esa evidencia **no valida esta distribución ni demuestra comodidad**. Tampoco representa barras reales de Android/iPhone, dedos físicos, webOS, diversión ni latencia toque–TV.

### Evidencia 0.2.4: geometría y entrada emuladas, sin imágenes

El padre informó ejecución directa de las rondas 01 y 02, ambas con salida 0. El registro existente `artifacts/browser-responsive-stadium-0.2.4/results.json`, leído sin repetir pruebas, declara `success: true` y espacio 6. Estas son sus ocho filas de tamaño/altura visible, con etiquetas exactas:

| Fila del registro | Alcance |
| --- | --- |
| `390x844/visible650` | Vertical, altura reducida |
| `360x800/visible600` | Vertical, altura reducida |
| `320x568/visible450` | Ancho mínimo |
| `844x390/visible320` | Horizontal |
| `667x375/visible280` | Horizontal corto |
| `390x844/visible844` | Altura completa |
| `desktop-1440x900/mobilefalse` | Escritorio |
| `keyboard-height-shadow-390x844/visible360` | Altura de teclado simulada, sin teclado real |

También constan `short-landscape-expanded-help/visible280`, `short-landscape-phase-lobby/visible280`, `short-landscape-phase-paused/visible280` y `short-landscape-phase-finished/visible280`. Las filas geométricas muestran cuatro botones de al menos 64 × 64 dentro del área visible, hit-test verdadero, sin desbordamiento de página y con scrollTop/scrollLeft 0. El formulario tiene display calculado `none`; el marcador global conserva «P1 azul: 7» y «· P2 naranja: 9» con sus colores. Controles antes de ayuda en orden semántico y visual, flujo en columna y todos los valores CSS order en 0. En la primera fila, los botones miden aproximadamente 80,67 píxeles; movimiento/patada terminan en y578 y salto en y554.

Las filas `before-trusted-touch/visible650`, `trusted-touch-held-after-resize/visible600` y `trusted-two-touch-relay` registran dos toques CDP confiables: izquierda + salto llegaron al propietario por WebSocket efímero real, siguieron pulsados al pasar de 650 a 600 visibles y quedaron neutros al terminar. `phone-ready-for-visual/390x844-visible600` solo registra la preparación geométrica posterior, **no una captura**.

Todo esto es Chromium emulado con VisualViewport sustituido: **no prueba barras reales, teclado real, dedos, iPhone, comodidad, rendimiento de TV ni diversión**. La ronda 03 intentó una sola captura de TV antes del teléfono y falló con `CdpRequestTimeoutError` en `Page.captureScreenshot` tras unos 17 segundos (salida 1, sin alcanzar el límite exterior de 45 segundos). No hubo imagen ni veredicto visual; la captura del teléfono no se intentó. No se autorizaron reintentos ni alternativas. T4 queda bloqueada: el usuario debe elegir entre autorizar publicación 0.2.4 para inspección visual manual o esperar reparación del navegador. La aprobación previa era solo para 0.2.3; no se publicó ni instaló 0.2.4.

## Comprobaciones pendientes

- [ ] Obtener inspección visual de mando y estadio por la vía que el usuario autorice; la geometría emulada anterior ya está registrada y no se repetirá para suplir imágenes. La entrada de código/teclado real y la comodidad siguen sin aceptación física.
- [ ] En Android, Brave e iPhone, probar vertical con barras expandidas/recogidas, incluido ancho de 320 píxeles CSS; confirmar alcance cómodo, no solo que los botones entren.
- [ ] Girar a horizontal corto, con áreas seguras: ambos pares cómodos y preparación accesible por su panel. Abrir teclado y avisos largos; desplazar ayuda y conexión sin expulsar los controles.
- [ ] Mantener movimiento y acción al cambiar barras o girar; soltar fuera, cancelar, cambiar de aplicación y volver: ningún botón queda sostenido.
- [ ] Recuperar dentro de 60 segundos en la misma pestaña: controles desactivados mientras reconecta, clave rotada y confirmación de ambos antes de reanudar.
- [ ] Revisar contraste, fondo, foco, lector de pantalla y ampliación: cuatro nombres españoles, avisos completos accesibles y jugador/marcador correctos.

La simulación, las comunicaciones y el dibujo del estadio no se modifican en esta unidad.
