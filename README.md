# Fútbol TV

Juego original de fútbol caricaturesco para dos personas. La TV LG con webOS ejecuta la partida en TypeScript/Phaser y decide la física, los goles, el reloj y el marcador. Cada teléfono envía Izquierda, Derecha, Saltar y Patear mediante un servidor de enlace WebSocket en Node.js. Hay dos arcos, partidos de dos minutos, empates y revanchas con confirmación de ambos. No hay cuentas, rivales automáticos, WebRTC, video transmitido ni recursos de CDN externos.

**Estado de validación:** la prueba de conectividad anterior se instaló y probó con teléfonos reales; el usuario informó movimiento independiente y buena respuesta. Eso no valida el juego completo. El dibujo, los controles táctiles y el ciclo de vida en la TV instalada siguen pendientes de la [lista de pruebas con dispositivos reales](docs/device-checklist.md).

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

La versión `0.2.1`, titulada `Fútbol TV`, conserva el ID `com.systemautomatic.tvfootball.probe` para actualizar la app de prueba existente. Una compilación web no es un IPK ni una instalación. El despliegue, el empaquetado y la instalación son acciones separadas del operador; no se debe publicar automáticamente, cambiar el VPS o el cortafuegos ni pedir secretos. Durante el juego no hace falta una computadora ni otro servidor en casa, una vez disponibles el servidor público y la app de TV instalada.
