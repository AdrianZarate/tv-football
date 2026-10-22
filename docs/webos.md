# Package and install the LG connectivity probe

The web build is not an IPK. A current webOS CLI and an authorized installation on the actual TV are separate prerequisites. Installed-app compatibility remains pending until tested on the LG 55UR7800PSB; the reported firmware is not evidence of its installed web engine.

## Quick path: build, then package

Use the approved public relay origin, never a computer's localhost address for a real TV. Set `PUBLIC_ORIGIN=https://tvfootbal.systemautomatic.xyz` and `DEV_INSECURE=false` in the terminal ([shell syntax](development.md#quick-path)).

```sh
npm run build
npm run package:tv
```

`package:tv` first checks `dist/tv`, then uses a project-local `node_modules/.bin/ares-package` or an installed `ares-package` in PATH, including Windows `.cmd` shims. It writes to `artifacts/` only if a CLI is available. If the CLI is absent, it exits with local setup guidance; it does not auto-install anything. No `.ipk` is implied by a successful `npm run build`.

The project pins `@webos-tools/cli` as a development dependency; `npm ci` installs it locally. No global installation is required. The packaging script never installs tools itself. Do not use obsolete CLI package names or install globally without a deliberate user decision. The remaining examples assume the CLI is in PATH; for a project-local install use the corresponding `node_modules/.bin/ares-*` executable (`.cmd` on Windows). Check the installed version's actual help before operating a device:

```sh
ares-setup-device --help
ares-novacom --help
ares-package --help
ares-install --help
ares-launch --help
```

## Developer Mode pairing (local secrets only)

1. On the TV, sign into the official Developer Mode app locally. Enable Developer Mode, follow its restart prompts, and enable **Key Server** when obtaining the key. TV and installation computer must be on the same network.
2. Run `ares-setup-device` interactively. Create alias `tv`, enter the TV's private address **locally**, use SSH port `9922`, user `prisoner`, and follow the installed CLI's authentication prompts. Do not store a private address, passphrase or key in this repo or chat. CLI device configuration belongs on your computer, outside the repository.
3. Obtain the key using the official flow below; enter the TV-displayed passphrase only in the local prompt. Never place it in command arguments, scripts or committed files.

```sh
ares-setup-device
ares-novacom --device tv --getkey
```

Pairing details vary by CLI version. Confirm actual `--help` and the official Developer Mode instructions rather than guessing options or requesting secrets.

## Install and launch after explicit approval

`npm run package:tv` wraps the equivalent packaging operation:

```sh
ares-package dist/tv -o artifacts
```

Inspect the actual generated filename. Replace `filename.ipk` below with that file; do not claim installation if packaging failed.

```sh
ares-install --device tv artifacts/filename.ipk
ares-launch --device tv com.systemautomatic.tvfootball.probe
```

The app displays a QR plus manual controller URL/code and two simple objects, not a football match. Test HTTPS certificate trust and file/opaque-origin WSS behavior; deliberately enable relay `ALLOW_TV_OPAQUE_ORIGIN=true` for the installed-app handshake test if required. Do not weaken TLS or expose insecure LAN HTTP as a workaround. `/tv/` in a browser or an emulator cannot prove installed-app compatibility.

## Package contents and renewal

`dist/tv/appinfo.json` supplies the documented web-app fields: `id`, `version`, `vendor`, `type`, `main`, `title` and `icon`. ID: `com.systemautomatic.tvfootball.probe`; version: `0.1.0`; title: `TV Football Probe`; main: `index.html`; type: `web`; vendor: `Independent`. The bundled 80×80 PNG icon is original locally generated geometric artwork, not copied football branding. Assets use relative paths and bundled dependencies with no remote CDN.

The observed CLI 3.2.6 packaging succeeded but warned that `requiredACG` is absent. This probe does not call Luna APIs. The current package is for Developer Mode testing, not a store submission; record any on-device rejection and consult LG's [ACG guide](https://webostv.developer.lge.com/develop/guides/acg-guide) before changing permissions. npm also reported deprecated transitive CLI dependencies; the CLI is development-only and is omitted from the runtime image.

Check remaining Developer Mode time in its TV app and use **EXTEND before expiry**. Follow LG's current renewal prompts; do not assume a fixed session duration or that renewal is automatic. Expiry/disablement can remove or prevent running development apps; reinstall only through the authorized workflow. The computer is needed for development/pairing/installation, not for gameplay once the public relay and IPK are ready.

## Official references and next step

- [Developer Mode app, device setup and key retrieval](https://webostv.developer.lge.com/develop/getting-started/developer-mode-app)
- [Current webOS CLI guide](https://webostv.developer.lge.com/develop/tools/cli-introduction)
- [appinfo.json fields](https://webostv.developer.lge.com/develop/references/appinfo-json)
- [Web API and web engine support](https://webostv.developer.lge.com/develop/specifications/web-api-and-web-engine)

Complete the [real-device checklist](device-checklist.md) and review results with the user before any full-game implementation.
