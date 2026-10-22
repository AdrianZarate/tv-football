# Controles pensados para los pulgares

El teléfono separa movimiento a la izquierda y acciones a la derecha. «Patear» es el botón dorado principal; «Saltar» queda un poco más arriba y con menor énfasis. No cambia ninguna regla, mensaje de red ni lógica de entrada o recuperación.

## Uso

1. Ingresá el código de la TV y tocá «Entrar a la sala».
2. Confirmá «Listo para jugar» cuando aparezca. Ambos jugadores deben confirmar; también para reanudar y para la revancha.
3. Mantené un botón de movimiento con el pulgar izquierdo y tocá «Saltar» o «Patear» con el derecho.

La conexión, las advertencias de almacenamiento y el estado del partido quedan fuera de la ayuda plegable. «Ayuda y conexión» empieza cerrada: abrila para consultar recuperación y mediciones. El RTT mide mensajes de ida y vuelta, **no** el tiempo entre tocar y ver la acción en la TV.

## Distribución y accesibilidad

| Aspecto | Intención del diseño |
| --- | --- |
| Vertical | Dos grupos inferiores separados; los cuatro botones siguen visibles en una misma franja, no una columna larga. |
| Horizontal | Los mismos grupos y orden; se reducen espacios y tamaño máximo para dejar sitio al estado y a la preparación. No se fuerza la orientación. |
| Zonas táctiles | Botones circulares con mínimo declarado de 64 × 64 píxeles CSS; separación central de al menos 16 píxeles y separación interna de 8. |
| Bordes del teléfono | Márgenes que contemplan las cuatro áreas seguras, incluidas muesca e indicador de inicio. |
| Lectura y foco | Etiquetas visibles en español, grupos con nombre accesible e iconos decorativos hechos con CSS o flechas, sin recursos externos. Foco con contorno; pulsación con relleno y borde; desactivación con opacidad y borde discontinuo. |
| Navegación | Solo los botones de juego bloquean gestos y selección. El formulario y la ayuda conservan desplazamiento, selección y ampliación normales. |

El botón de preparación permanece encima de los controles. Los errores y avisos no se recortan ni se ocultan para hacer caber el diseño: pueden desplazar el contenido hacia abajo. El formulario sigue disponible; no se agregan estados visuales controlados por JavaScript.

## Comprobaciones pendientes en teléfonos reales

Las pruebas automáticas verifican estructura pública, enlaces de los cuatro botones, estado inicial desactivado y ayuda cerrada. También comprueban declaraciones de áreas seguras y recursos locales; **no demuestran** ajuste visual, tamaño táctil efectivo ni latencia. Android e iPhone siguen sin validación física de este diseño.

- [ ] En Android e iPhone, revisar ancho de 320 píxeles CSS y vertical con 640 de alto: sin desbordamiento horizontal y con acciones al alcance sin desplazamiento, cuando los avisos lo permitan.
- [ ] Girar a horizontal con unos 360 píxeles CSS de alto; comprobar ambos grupos, preparación, conexión y bordes seguros sin bloquear la orientación.
- [ ] Abrir el teclado, ingresar el código y cerrarlo; el formulario sigue utilizable y no tapa permanentemente los controles.
- [ ] Mantener movimiento mientras se pulsa cada acción; probar varios dedos, soltar fuera, cancelar el toque y cambiar de aplicación: ningún botón queda sostenido.
- [ ] Desconectar y volver dentro de 60 segundos en la misma pestaña: aviso visible, controles desactivados durante recuperación y confirmación de ambos antes de reanudar. Otro navegador no reemplaza al jugador.
- [ ] Revisar con lector de pantalla, foco de teclado y texto ampliado: nombres claros, avisos completos y ayuda operable. Con ampliación o avisos largos se admite desplazamiento antes que ocultar información.

La prueba real en ambos teléfonos es el siguiente paso; esta documentación no afirma haberla realizado. La TV y su estilo quedan fuera de este cambio.
