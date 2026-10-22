# Empaquetar e instalar Fútbol TV en LG

La compilación web no es un IPK. Una CLI webOS actual y una instalación autorizada en la TV real son requisitos separados. La prueba anterior de conectividad funcionó en LG 55UR7800PSB; eso no demuestra compatibilidad con el juego completo. Todavía hay que probar su dibujo, CSP y ciclo de vida en esa TV. La versión de firmware informada no demuestra qué motor web tiene instalado.

## Inicio rápido: compilar y empaquetar

Usá el origen público aprobado, nunca localhost de una computadora para una TV real. Configurá `PUBLIC_ORIGIN=https://tvfootbal.systemautomatic.xyz` y `DEV_INSECURE=false` en la terminal ([sintaxis por terminal](development.md#inicio-rápido)).

```sh
npm run build
npm run package:tv
```

`package:tv` primero comprueba `dist/tv`, luego usa `node_modules/.bin/ares-package` local del proyecto o `ares-package` instalado en PATH, incluidos adaptadores `.cmd` de Windows. Escribe en `artifacts/` solo si hay una CLI. Si falta, termina con instrucciones de configuración local; no instala nada automáticamente. Un `npm run build` exitoso no implica que exista un `.ipk`.

El proyecto fija `@webos-tools/cli` como dependencia de desarrollo; `npm ci` la instala localmente. No se requiere instalación global. El script de empaquetado nunca instala herramientas por su cuenta. No uses nombres obsoletos de paquetes CLI ni instales globalmente sin una decisión deliberada del usuario. Los ejemplos siguientes suponen la CLI en PATH; para una instalación local usá el ejecutable `node_modules/.bin/ares-*` correspondiente (`.cmd` en Windows). Consultá la ayuda real de la versión instalada antes de operar un dispositivo:

```sh
ares-setup-device --help
ares-novacom --help
ares-package --help
ares-install --help
ares-launch --help
```

## Vincular Developer Mode: secretos solo locales

1. En la TV, iniciá sesión localmente en la app oficial Developer Mode. Habilitá Developer Mode, seguí sus indicaciones de reinicio y habilitá **Key Server** al obtener la clave. TV y computadora de instalación deben estar en la misma red.
2. Ejecutá `ares-setup-device` de forma interactiva. Creá el alias `tv`, ingresá la dirección privada de la TV **localmente**, usá puerto SSH `9922`, usuario `prisoner` y seguí las indicaciones de autenticación de la CLI instalada. No guardes direcciones privadas, frases de acceso ni claves en este repositorio o chat. La configuración de dispositivos pertenece a tu computadora, fuera del repositorio.
3. Obtené la clave mediante el flujo oficial siguiente; ingresá la frase mostrada por la TV solo cuando la terminal local la solicite. Nunca la pongas en argumentos, scripts ni archivos versionados.

```sh
ares-setup-device
ares-novacom --device tv --getkey
```

El procedimiento cambia según la versión de CLI. Confirmá `--help` y las instrucciones oficiales de Developer Mode; no adivines opciones ni pidas secretos.

## Instalar y abrir solo con aprobación explícita

`npm run package:tv` envuelve la operación equivalente:

```sh
ares-package dist/tv -o artifacts
```

Revisá el nombre real del archivo generado. Sustituí `filename.ipk` por ese archivo; no afirmes que se instaló si falló el empaquetado.

```sh
ares-install --device tv artifacts/filename.ipk
ares-launch --device tv com.systemautomatic.tvfootball.probe
```

El juego muestra una cancha original de 1280×720, marcador, reloj y QR, más dirección y código manuales. La primera sala se crea cuando la app se vuelve visible, incluso si arrancó oculta. Si el primer intento se oculta antes de recibir la sala, se reintenta al volver. Después de crear una sala, pasar a segundo plano termina esa sala y exige **Nueva sala**; no recupera partidas automáticamente.

Ambos teléfonos deben pulsar **Listo para jugar**; el panel de conexión se reduce durante el juego. **Nueva sala** conserva foco accesible con el control remoto, sin escribir en la TV. Verificá cancha completa, texto legible y diagnósticos accesibles debajo. Probá confianza del certificado HTTPS y enlace WSS de origen opaco/archivo; habilitá deliberadamente `ALLOW_TV_OPAQUE_ORIGIN=true` en el servidor si hace falta para esa prueba. No debilites TLS ni expongas HTTP inseguro en la red local como alternativa. `/tv/` en un navegador o emulador no demuestra compatibilidad de la app instalada.

Un teléfono puede recuperar su lugar antes de 60 segundos solo con la clave `sessionStorage` de la misma sesión del navegador; ambos vuelven a confirmar. Nunca compartas ni registres esa clave. Si falla, puede hacer falta **Nueva sala**. Segundo plano, salida o pérdida de conexión de TV terminan la sala, no dejan una partida recuperable. Al volver, seleccioná **Nueva sala** y conectá ambos teléfonos de nuevo. Consultá las [reglas](game.md).

## Contenido del paquete y renovación

`dist/tv/appinfo.json` aporta los campos documentados `id`, `version`, `vendor`, `type`, `main`, `title` e `icon`. ID: `com.systemautomatic.tvfootball.probe` (sin cambios para actualizar la app existente); versión: `0.2.2`; título: `Fútbol TV`; main: `index.html`; type: `web`; vendor: `Independent`. El icono PNG de 80×80 es arte geométrico original generado localmente, no una marca de fútbol copiada. Los recursos usan rutas relativas y dependencias incluidas, sin CDN.

La CLI 3.2.6 observada al empaquetar la prueba anterior funcionó, pero avisó que falta `requiredACG`; eso no demuestra que este nuevo IPK se haya empaquetado o instalado. El juego no llama API Luna. El paquete actual es para pruebas en Developer Mode, no para publicar en tienda; registrá cualquier rechazo en la TV y consultá la [guía ACG de LG](https://webostv.developer.lge.com/develop/guides/acg-guide) antes de cambiar permisos. npm también informó dependencias transitivas obsoletas de la CLI; esta se usa solo en desarrollo y no entra en la imagen de ejecución.

En Windows puede aparecer el aviso `DEP0190` de Node sobre argumentos con `shell: true` al usar adaptadores `.cmd`. Registralo; no lo confundas con prueba de instalación ni cambies permisos o autenticación para ocultarlo. Los comandos de este documento requieren autorización de operación del dispositivo.

Revisá el tiempo restante de Developer Mode en la app de TV y usá **EXTEND antes de vencer**. Seguí las indicaciones actuales de LG; no supongas una duración fija ni renovación automática. Vencimiento/desactivación pueden quitar apps de desarrollo o impedir ejecutarlas; reinstalá solo por el flujo autorizado. La computadora se necesita para desarrollar, vincular e instalar, no para jugar una vez listos servidor público e IPK.

## Referencias oficiales y siguiente paso

- [Developer Mode, configuración y obtención de clave](https://webostv.developer.lge.com/develop/getting-started/developer-mode-app)
- [Guía de CLI webOS actual](https://webostv.developer.lge.com/develop/tools/cli-introduction)
- [Campos de appinfo.json](https://webostv.developer.lge.com/develop/references/appinfo-json)
- [Compatibilidad de API web y motores](https://webostv.developer.lge.com/develop/specifications/web-api-and-web-engine)

Completá la [lista con dispositivos reales](device-checklist.md) y revisá los resultados del juego completo con el usuario antes de afirmar aceptación física o autorizar otro despliegue.
