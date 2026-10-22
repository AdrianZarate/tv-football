# Menos trabajo de dibujo y Nueva sala con el control remoto

La TV conserva la cancha y los personajes originales, con un único marcador, reloj y estado fuera del lienzo. **La reducción de trabajo en el código no demuestra la causa del retraso del volumen en webOS ni garantiza una mejora de FPS o latencia.** Esa comparación requiere la TV real.

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

## Diagnóstico opcional

La vista normal no muestra información técnica ni calcula percentiles de dibujo. Para una sesión de diagnóstico abrí la página de TV con `?debug=1` y desplegá Diagnóstico de conexión. Los intervalos observados entre actualizaciones y el RTT de mensajes **NO miden la latencia del botón a la pantalla**, la carga de CPU/GPU ni el tiempo de respuesta del volumen del sistema. No se añaden temporizadores de muestreo. Los mensajes de error no muestran valores internos del protocolo ni claves de sesión.

## Pendiente en la TV real

- Comparar la respuesta de subir/bajar volumen y silenciar antes y después, tanto en la sala como durante el juego.
- Comprobar que una pulsación de OK crea una sola sala, que mantenerlo pulsado no la reemplaza y que el clic sigue funcionando.
- Verificar foco al cerrar la superposición de volumen, QR, aspecto de los dibujos y cancelación al salir realmente de la aplicación.

No se publicó, instaló ni modificó la TV para estas pruebas de código.
