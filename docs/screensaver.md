# Protector de pantalla LG: limitación pendiente

**0.2.7 no evita el protector de pantalla durante el juego.** El usuario confirmó que se trata del protector, no de un temporizador de apagado. No presentamos una corrección sin respaldo de la plataforma.

## Qué permite LG

La [guía oficial](https://webostv.developer.lge.com/develop/guides/screensaver) describe activación tras un tiempo sin acciones del usuario y una excepción para reproducción de **video fullscreen**. Dibujar Canvas o recibir controles por WebSocket no garantiza reiniciar la inactividad del sistema.

Las variantes `screenSaverProperties` tipo 2/3 se documentan solo para OLED con webOS 5 o superior; no corresponden a la LG UR7800 LCD. Además, extienden el plazo con reducción de brillo, no inhiben el protector indefinidamente. La [respuesta de soporte LG del 5 de febrero de 2026](https://forum.webostv.developer.lge.com/t/request-for-guidance-to-prevent-app-from-entering-idle-screen-saver-mode-on-webos/28089) mantiene la excepción de video, no ofrece inhibición garantizada para Canvas.

## Qué no hace esta app

- No agrega video oculto ni motor multimedia para aparentar actividad.
- No simula pulsaciones del mando ni modifica ajustes globales, permisos Luna o flags OLED inaplicables.
- No promete que `navigator.wakeLock` impida el protector de webOS: no hay prueba de ese resultado en esta TV.
- No altera temporizadores programados ni intenta volver a encender una TV apagada.

## Alternativa manual y siguiente decisión

El mando físico sí aporta interacción real. Durante una sesión se puede usar volumen —la app no lo intercepta— sin crear otra sala. Evitá OK/Enter sobre **Nueva sala**, porque esa es una acción real del juego. Esto es una alternativa manual, no una corrección automática.

Si el firmware ofrece algún ajuste aplicable, primero identificar su nombre y alcance con el usuario; no inventamos una ruta de menú ni asumimos que desactivar anuncios del protector desactive el protector. No se operó la TV ni se cambió su configuración. Una solución automática requiere un mecanismo soportado por LG y validación explícita en el dispositivo; hasta entonces este punto permanece bloqueado.
