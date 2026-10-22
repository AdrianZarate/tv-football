# Protocolo de conexión y sesiones de juego

Cada cuadro WebSocket en `/ws` contiene un mensaje JSON. El servidor de enlace vincula roles a conexiones; ningún mensaje puede elegir el lugar de otro jugador. Los códigos de sala tienen 8 caracteres de `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`. Sirven para encontrar la sala, no son credenciales de propiedad. La TV decide física, goles, reloj, marcador, preparación, cancelación por ausencia de 60 segundos y resultados. El servidor no simula partidas ni avanza el reloj.

## Cliente → servidor de enlace

| Mensaje | Emisor / efecto |
|---|---|
| `{type:"create"}` | Solo conexión sin asignar; crea una sala de prueba anterior y se vuelve su TV propietaria. Sin recuperación ni preparación. |
| `{type:"createGame"}` | Solo conexión sin asignar; crea una sala de juego propiedad de esa conexión de TV. |
| `{type:"join",code}` | Conexión sin asignar; ocupa el primer lugar nunca usado (1 o 2). Desconectar no vuelve a habilitar un lugar para entrar. |
| `{type:"resume",code,key}` | Conexión sin asignar; recupera el lugar de juego original con su credencial vigente, solo después de cerrarse la conexión anterior. |
| `{type:"ready"}` | Solo teléfono asignado de juego; reenvía `{type:"ready",slot}` a la TV propietaria. El mismo mensaje confirma inicio, reanudación o revancha. |
| `{type:"gameStatus",phase,score,remainingMs}` | Solo TV propietaria de juego; envía los valores autoritativos validados a sus teléfonos. El último estado también se envía al entrar o recuperar. |
| `{type:"input",sequence,buttons}` | Solo teléfono asignado. Secuencia creciente de enteros seguros y copia completa de booleanos `{left,right,jump,kick}`. |
| `{type:"ping",id}` | Cualquier conexión; responde `pong` para medir RTT de aplicación teléfono/TV ↔ servidor. |
| `{type:"probe",id}` | Solo teléfono; reenvía `{type:"probe",slot,id}` a su TV. |
| `{type:"probeAck",slot,id}` | Solo TV propietaria; reenvía la respuesta al teléfono que inició la medición. |

Cada mensaje tiene exactamente las claves indicadas. Identificadores y secuencias son enteros seguros no negativos. `phase` es exactamente `lobby`, `playing`, `paused`, `finished` o `cancelled`. `score` contiene exactamente dos enteros de 0–9999. `remainingMs` es un entero de 0–120000. Nunca envíes código, lugar ni clave con `input` o `ready`. Ningún teléfono puede dirigirse al lugar del otro. Los mensajes desconocidos siguen produciendo `invalid_message` y cierre 1008.

## Servidor de enlace → cliente

- `{type:"created",code}`: sala de TV creada, en ambos modos.
- `{type:"joined",slot}`: teléfono asignado (`slot: 1 | 2`), igual en ambos modos. No contiene secretos.
- `{type:"resumeKey",key}`: mensaje separado inmediatamente después de `joined` de juego, al entrar por primera vez y al recuperar. Nunca se envía a la TV ni a otros teléfonos. Guardá la clave rotada antes de permitir otra recuperación.
- `{type:"ready",slot}`: la TV recibe la confirmación del teléfono asignado. La TV decide si aplica a inicio, reanudación o revancha.
- `{type:"gameStatus",phase,score,remainingMs}`: el teléfono muestra los valores exactos validados de la TV, sin predecirlos ni ejecutar un reloj local. El servidor no tiene temporizador de partido.
- `{type:"state",connected:[boolean,boolean]}`: la TV ve presencia de teléfonos, sin credenciales ni metadatos de recuperación.
- `{type:"input",slot,sequence,buttons}`: la TV recibe controles validados. Los controles neutros generados por desconexión, vencimiento o recuperación pueden repetir la última secuencia. La TV debe aceptarlos: el servidor ya controla el orden del cliente. Recuperar inicia un espacio de secuencias nuevo, incluido cero.
- `{type:"pong",id}`: respuesta del servidor.
- `{type:"probe",slot,id}`: la TV debe responder inmediatamente, sin esperar al dibujado.
- `{type:"probeAck",id}`: RTT de aplicación teléfono→servidor→TV→servidor→teléfono, no latencia hasta la presentación en pantalla.
- `{type:"error",code}`: código de máquina acotado, sin diagnóstico sensible.
- `{type:"ended",reason}`: la TV salió o la sala venció; detener controles, borrar la credencial de esa sala e ingresar otro código.

Los nombres, tipos, fases y códigos de máquina permanecen en inglés. La interfaz los presenta en español mediante `shared/messages.ts`, sin mostrar códigos o motivos desconocidos: usa un aviso genérico en español que tampoco revela datos arbitrarios. El formateador español de RTT consulta `RttWindow.stats()` sin modificar muestras; el formateador público inglés `formatRtt` sigue disponible sin cambios.

## Recuperación y credenciales

Cada teléfono de juego recibe una credencial aleatoria independiente de 256 bits, representada por 64 caracteres hexadecimales en minúscula. El servidor guarda solo resúmenes SHA-256 en registros de jugador inmutables de la sala original. La clave vale solo para su sala y lugar, no es una cuenta ni identidad global. No debe aparecer en QR, parámetros de dirección, registros, diagnósticos, `created`, `joined` ni `state`. Los enlaces QR incluyen solo el código público de sala. En producción se requiere HTTPS/WSS.

El teléfono guarda credenciales solo en `sessionStorage`, bajo `tv-football:resume:<ROOM>`, con respaldo volátil en la página. Si el almacenamiento se deniega o no está disponible, se avisa: puede funcionar la recuperación dentro de la página, pero no se promete recuperación al recargar. Cambiar el código del formulario carga solo la credencial de esa sala. Recargar o volver al primer plano usa `resume`, nunca un `join` alternativo a otro lugar. El almacenamiento lo administra el navegador; no es identidad duradera ni prueba de dispositivo físico. Duplicar/copiar una sesión puede copiar la clave: no compartas la pestaña ni la credencial.

Una recuperación exitosa rota la clave atómicamente una vez, envía `joined` con el mismo formato seguido del nuevo `resumeKey`, borra mediciones y controles pendientes y reinicia la secuencia. La clave anterior deja de valer inmediatamente. La limpieza de conexiones antiguas no puede neutralizar ni borrar el reemplazo. Una clave válida nunca expulsa una conexión viva o en cierre. Si se pierde la respuesta con la clave nueva antes de recibirla, la antigua no se reutiliza: se rechaza la recuperación en vez de conceder otra identidad o lugar.

Errores de recuperación:

- `resume_busy`: la conexión original sigue abierta o cerrándose; reintentar sin expulsarla. No asigna la conexión del reintento.
- `resume_invalid`: modo incorrecto, clave incorrecta, revocada o repetida. Es definitivo para ese teléfono; borrar la clave guardada de esa sala. No devuelve detalles de la clave.
- `room_unavailable`: sala terminada, vencida o inexistente. Definitivo; borrar la clave guardada.
- `role_locked`: una conexión asignada no puede crear, entrar ni recuperar otro rol.
- `game_phone_only`, `game_only`, `tv_only`, `not_assigned`: emisor sin autorización para esa operación; no se reenvía.

Al pasar a segundo plano o recibir `pagehide`, el teléfono libera todos los toques, envía controles neutros y cierra su conexión para que la TV pause cuando detecte el cierre. La caducidad de controles sigue como respaldo. Al volver o desconectarse inesperadamente, reintenta cada segundo por un máximo de 60 segundos de tiempo real, sin intentos mientras está oculto. `resume_busy` puede reintentarse dentro del mismo plazo; claves incorrectas y salas no disponibles son definitivas. Controles y preparación permanecen desactivados durante la recuperación. La TV exige confirmación de ambos al volver. El servidor no cancela tras 60 segundos ni interpreta resultados: lo hace la TV. Desconectar la TV termina la sala, sin recuperación de TV.

## Seguridad y continuidad

Máximo por cuadro: 1.024 bytes. Límite: 80 mensajes por segundo por conexión, incluidos los nuevos mensajes. El teléfono envía el estado completo al cambiar y renueva cada 100 ms mientras hay botones pulsados. El servidor libera controles tras 350 ms sin renovación; la TV aplica su propia caducidad de 350 ms. Se atienden captura/liberación/cancelación/pérdida del puntero, pérdida de foco, `pagehide` y cambios de visibilidad. Los mapas RTT acotados son solo diagnósticos. La TV pausa cuando falta cualquier teléfono.

Las salas de prueba anteriores conservan `create`, `join`, `ping`, `probe`, `probeAck` e `input`, sin credenciales, preparación ni recuperación. Ambos modos reservan lugares usados tras desconectar. Un teléfono de prueba necesita otra sala de TV al desconectarse; la ausencia de `resumeKey` identifica ese flujo.

Para probar el enlace de la app instalada, el servidor puede aceptar explícitamente el origen opaco exacto `null` o ausencia de Origin. Origin es defensa adicional, no identidad: la autoridad de sala depende exclusivamente de la conexión original. Ruta `/ws`, comprobaciones de origen, tamaño/frecuencia, congestión, capacidad, plazo inicial, comprobación de actividad, caducidad de controles y duración de sala aplican a ambos modos. La creación pública anónima de salas no es una defensa completa contra ataques de denegación de servicio.

## Pruebas de sesión en dispositivos reales

- Conectar dos teléfonos por QR; lugares distintos y ambos **Listo para jugar** antes de iniciar.
- Mantener movimiento + Saltar/Patear con varios dedos. Soltar, cancelar, perder captura y foco; sin controles pegados y con diagnósticos acotados.
- Pasar un teléfono con botones pulsados a segundo plano; pausa al detectar la ausencia y reloj congelado. Volver antes de 60 segundos; mismo lugar, controles neutros, clave rotada y confirmación de ambos.
- Recargar el mismo navegador con almacenamiento habilitado e ingresar la misma sala: recuperar, no asignar otro lugar. Denegar almacenamiento y comprobar el aviso de limitación al recargar sin perder recuperación dentro de la página.
- Intentar entrar con un tercer navegador antes y después de una desconexión: no reemplaza lugares. Recuperar con la conexión anterior medio abierta: no la expulsa.
- Ausentarse más de 60 segundos: cancelación sin ganador. Terminar empatado y confirmar revancha con el mismo botón de preparación.
- Cerrar la sala de TV: borrar claves guardadas, desactivar controles y permitir otro código. Una sala distinta nunca reutiliza la clave de otra.
- Repetir conexión/controles/RTT de una sala de prueba anterior: sin preparación ni recuperación por credencial.

La [lista completa](device-checklist.md) sigue pendiente de aceptación real.
