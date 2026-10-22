# Controles pensados para los pulgares

El teléfono mantiene movimiento a la izquierda y acciones a la derecha, sin el gran espacio flexible entre cabecera y botones. La altura sigue el área visible del navegador, incluidas sus barras. El marcador identifica siempre **P1 azul a la izquierda y P2 naranja a la derecha**, aunque controles a P2. No cambia la asignación de goles ni la recuperación.

## Uso

1. Ingresá el código de la TV y tocá «Entrar a la sala». El formulario se pliega solo después de recibir una asignación; vuelve al perder la conexión o terminar la sala.
2. Leé tu jugador en el aviso de conexión. Confirmá «Listo para jugar» cuando aparezca; ambos deben confirmar también la reanudación y la revancha.
3. Mantené movimiento con el pulgar izquierdo y tocá «Saltar» o «Patear» con el derecho. «Patear» es el botón dorado; «Saltar» queda algo más arriba.

La conexión, los errores, las advertencias de almacenamiento, el marcador y la preparación quedan en un panel compacto con desplazamiento **interno** si no caben. El formulario también se puede desplazar dentro de ese panel cuando aparece el teclado. «Ayuda y conexión» empieza cerrada y tiene su propio desplazamiento al abrirse: no debe empujar los controles fuera de la página visible. Solo los botones de juego bloquean gestos; la ampliación y la orientación siguen disponibles.

## Distribución y estados

| Aspecto | Comportamiento |
| --- | --- |
| Altura | CSS usa altura dinámica; el entrypoint actualiza una variable con `visualViewport.height` o, si falta/no es válida, `innerHeight`. Los cambios de barras, orientación y teclado se agrupan en un cuadro; no hay sondeo ni escrituras si la altura entera no cambia. Se ignoran métricas nulas o no finitas sin alternativa válida. |
| Vertical y horizontal | Mismos grupos y orden. Los botones conservan mínimos declarados de 64 × 64 píxeles CSS; se acotan sus máximos según la altura visible. No se fuerza la orientación. |
| Bordes y lectura | Se contemplan las cuatro áreas seguras. Etiquetas españolas y colores identifican jugadores sin depender solo del color; iconos locales, foco visible y estado de pulsación contrastado. |
| Recuperación | Al desconectarse desaparecen el marcador y reloj anteriores: se muestra «Reconectando…», no «En juego». Al terminar o rechazar la sala se limpia el HUD y permanece el aviso explicativo. La TV vuelve a proporcionar los valores al reconectar. |
| Preparación | «Listo para jugar», «Confirmar reanudación» y «Listo para la revancha» mantienen sus condiciones anteriores; siguen accesibles en el panel de estado. |
| Entrada y sesión | Redimensionar no envía entradas, abre conexiones ni cambia claves o secuencias. Los botones mantienen identidad, captura de puntero y varios dedos simultáneos. Se conserva liberación al cancelar o pasar a segundo plano. |

Las salas de juego conservan el lugar durante 60 segundos en el mismo navegador; no se cambia la clave por redimensionar. La ayuda explica las limitaciones de las salas de prueba y del almacenamiento no disponible. RTT mide mensajes de ida y vuelta, **no** el tiempo entre tocar y ver la acción en la TV.

## Evidencia automática y límites

Las pruebas ejecutan el entrypoint real empaquetado con esbuild en una fachada de APIs DOM. Reproducen un viewport de layout de 844 píxeles frente a 650 visibles, cambios de barras/orientación y ausencia de `visualViewport`. Comprueban la variable CSS pública, el HUD, la preparación, la recuperación y que los cambios de altura no modifiquen mensajes ni almacenamiento. Otras pruebas comprueban estructura y declaraciones de estilo.

**La fachada no calcula geometría.** Una comprobación posterior en Chromium sí midió los rectángulos del navegador: `artifacts/browser-viewport-goals/round-02.mjs` terminó con código 0 y dejó los resultados en `artifacts/browser-viewport-goals/results.json`.

| Layout (píxeles CSS) | Altura visible simulada |
| --- | --- |
| 390 × 844 | 650 |
| 360 × 800 | 600 |
| 320 × 568 | 450 |
| 844 × 390 | 320 |
| 667 × 375 | 280 |
| 390 × 844 | 844 |

En los seis tamaños, la altura del cuerpo coincidió con la visible; los cuatro controles midieron al menos 64 × 64 píxeles CSS, quedaron enteros dentro del área visible y pasaron la prueba de impacto sin elementos que los taparan. No hubo desbordamiento de página ni desplazamiento (`pageOverflow=false`, `scrollTop=0`); el formulario asignado tuvo `display=none`. También pasaron esas comprobaciones con ayuda expandida y en espera, pausa y fin de partido.

Dos toques automatizados de Chromium mediante CDP mantuvieron izquierda y salto simultáneos a través del relay WebSocket real. El cambio de altura visible de 650 a 600 conservó la pulsación y `touchend` liberó ambos controles. El cierre real de la conexión propietaria de la sala limpió el HUD anterior y restauró el formulario. No se intentaron ni repitieron capturas de pantalla.

**Es emulación, no aceptación física:** la altura de VisualViewport y su cambio se simularon; no se movieron barras reales ni se usaron dedos físicos. Esta evidencia no demuestra comportamiento de iPhone, rendimiento de webOS, diversión ni latencia entre toque y TV. Las comprobaciones siguientes siguen pendientes; T4 requiere la actualización autorizada por el operador y la prueba en teléfonos/TV reales, sin publicación autorizada todavía.

## Comprobaciones pendientes en teléfonos reales

- [ ] En Android, Brave e iPhone, revisar vertical con barras expandidas y recogidas: cuatro controles visibles sin desplazar la página, también a 320 píxeles CSS de ancho.
- [ ] Girar a horizontal con unos 360 píxeles CSS de alto; comprobar los grupos, preparación y áreas seguras.
- [ ] Abrir teclado, ingresar el código y cerrarlo; abrir ayuda completa y avisos largos: desplazamiento interno utilizable sin expulsar los controles.
- [ ] Mantener movimiento y acción simultáneos al cambiar las barras o girar; soltar fuera, cancelar, cambiar de aplicación y volver: ningún botón queda sostenido.
- [ ] Recuperar dentro de 60 segundos en la misma pestaña: controles desactivados durante reconexión, clave rotada y confirmación de ambos antes de reanudar. Otro navegador no reemplaza al jugador.
- [ ] Revisar lector de pantalla, foco y ampliación: avisos completos accesibles por desplazamiento interno, jugador asignado correcto y P1/P2 sin invertir números.

La TV, sus reglas y su estilo quedan fuera de este cambio.
