# Fútbol TV

Juego original de fútbol caricaturesco para dos personas. La TV LG con webOS ejecuta la partida en TypeScript, dibuja con Canvas2D nativo y decide la física, los goles, el reloj y el marcador. Cada teléfono envía Izquierda, Derecha, Saltar y Patear mediante un servidor de enlace WebSocket en Node.js. Hay dos arcos, partidos de dos minutos, empates y revanchas con confirmación de ambos. No hay cuentas, rivales automáticos, WebRTC, video transmitido ni recursos de CDN externos.

**Pulido local 0.2.6:** arte original cacheado, patadas más altas y modo **Controles**, conservando la base ligera. En la prueba física autorizada de 0.2.5 se confirmaron arranque, QR/código y volumen inmediato, no apagado, partido completo ni calidad visual. La prueba de 0.2.4 había fallado desde el arranque; su causa no se confirmó. 0.2.6 no tiene aceptación física ni entrega autorizada: siguen pendientes [revisión visual, comodidad y pruebas reales](docs/device-checklist.md#pulido-026-pendiente).

## Inicio rápido

Usá Node.js 24 y npm. Estos comandos no despliegan servicios ni instalan nada en la TV.

```sh
npm ci
npm run typecheck
npm test
npm run build
```

La compilación genera paquetes web locales y legibles en `dist/controller` y `dist/tv`, con `https://tvfootbal.systemautomatic.xyz` como origen predeterminado. Seguí [desarrollo local](docs/development.md) para probar en la computadora mediante su dirección de bucle local antes de ejecutar `npm run dev`. `/` contiene los controles del teléfono; `/tv/` permite una comprobación de escritorio, pero no demuestra compatibilidad con la TV instalada.

## Conectarse, jugar y volver

Tras conectarte a una sala de juego, tocá **Controles**: abre un panel que llena la página e intenta pantalla completa nativa y bloqueo horizontal desde ese gesto. Es un intento, no una garantía: iPhone Safari no admite `orientation.lock`; si alguna API falta o rechaza, seguí en el panel y girá el teléfono manualmente según el aviso. **Volver**, Escape o la salida nativa cierran el modo, no la sala. Son los mismos cuatro botones con captura de puntero, la misma sesión y clave, sin recargar ni abrir otra conexión; entrar/salir libera las pulsaciones mantenidas. Marcador, conexión y **Listo para jugar / Confirmar reanudación / Listo para la revancha** siguen accesibles dentro del panel. Ambos jugadores deben confirmar como antes.

Movimiento y acciones siguen separados para ambos pulgares, con objetivos de al menos 64 píxeles lógicos. La conexión y la ayuda pueden desplazarse internamente. Verificá barras, teclado, áreas seguras y orientación en ambos teléfonos: las pruebas no demuestran comodidad física ni ausencia de desplazamiento en teléfonos reales.

El marcador identifica **P1 azul** a la izquierda y **P2 naranja** a la derecha, también en los teléfonos. P1 anota en el arco derecho y P2 en el izquierdo. **¡GOOOLLL!** anuncia durante 1,2 segundos al jugador que recibe el punto, sin detener el reloj. La pelota tiene rebotes mucho mayores (restitución 0,92 en lugar de 0,55) y se corrigió la resolución de contactos simultáneos para evitar que atraviese a un jugador al quedar apretada entre ambos, conservando el paso legítimo bajo un jugador en el aire. 0.2.6 incorpora caras, camisetas y botines originales, pelota con patrón y cancha lateral sobria: fondo y atlas se crean una vez, sin rutas/fuentes nuevas por fotograma. La entrada de TV sigue con Canvas2D nativo, sin Phaser ni WebGL directo, recursos externos ni dependencias nuevas. Conserva 1280×720 sin aumento por DPR, límite activo de 30 Hz y ausencia de bucle continuo de dibujo en sala, pausa y fin; sigue el heartbeat. La patada sube de impulso vertical 400 a 650: arco de unos 120 píxeles en lugar de 45–47, conservando fuerza horizontal 900, alcance 100, intervalo 400 ms, límite vectorial 1400 y todas las reglas. Esto no mide CPU/GPU, diversión ni cuadros por segundo en TV, ni certifica calidad visual. Ver [evidencia y límites](docs/tv-performance.md).

1. Al abrir la app, la TV crea la primera sala cuando está visible. Aparecen el QR, la dirección y el código de sala. Conectá ambos teléfonos con el QR o con la dirección y el código. **Nueva sala** permite empezar otra sala con el control remoto.
2. Ambos jugadores pulsan **Listo para jugar** en sus teléfonos. La TV determina el estado, el marcador y el reloj.
3. Cuando se detecta la desconexión de un teléfono, se congelan el juego y el reloj. Volvé con el **mismo teléfono y la misma sesión del navegador** antes de 60 segundos; ambos jugadores deben pulsar **Confirmar reanudación**. Otro navegador no puede ocupar el lugar reservado.
4. Si vence el plazo, el partido se cancela sin ganador. Si la TV pierde su conexión, pasa a segundo plano o se cierra, la sala termina: seleccioná **Nueva sala** y volvé a conectar los dos teléfonos. La TV no recupera partidas anteriores.

Si el primer intento de conexión queda en segundo plano antes de recibir una sala creada, se cierra y vuelve a intentarse al mostrar la app. Esto solo resuelve el arranque: después de crear cualquier sala, volver al primer plano nunca recupera automáticamente la partida.

Las claves de recuperación quedan en `sessionStorage` del navegador original, no en el QR ni en la dirección. No las compartas ni las registres. Si el almacenamiento está bloqueado, se pierde la sesión del navegador o falla la recuperación, puede ser necesaria una Nueva sala. Consultá las [reglas](docs/game.md) y el [protocolo](docs/protocol.md).

## Guías y límites de entrega

| Objetivo | Guía |
|---|---|
| Desarrollar localmente y configurar variables | [Desarrollo](docs/development.md) |
| Operar el servidor HTTPS/WSS | [Despliegue con Dokploy](docs/deployment.md) |
| Empaquetar e instalar la app LG | [Configuración webOS](docs/webos.md) |
| Verificar el juego en dispositivos reales | [Lista de pruebas](docs/device-checklist.md) |
| Entender el dibujo optimizado y el control remoto | [Rendimiento de TV](docs/tv-performance.md) |
| Revisar la distribución de controles del teléfono | [Diseño de controles](docs/controller-layout.md) |

Los metadatos de `0.2.6`, titulada `Fútbol TV`, conservan el ID `com.systemautomatic.tvfootball.probe` para actualizar la app de prueba existente. Las evidencias históricas de navegador de 0.2.3/0.2.4 no validan el nuevo renderizador ni revierten el fallo físico de 0.2.4. Una compilación web no es un IPK ni una instalación. El despliegue, el empaquetado y la instalación son acciones separadas del operador; no se debe publicar automáticamente, cambiar el VPS o el cortafuegos ni pedir secretos. Durante el juego no hace falta una computadora ni otro servidor en casa, una vez disponibles el servidor público y la app de TV instalada.
