# Develop and build the connectivity probe

Start with a loopback desktop check. Real phones and the installed TV must later use the public HTTPS/WSS relay; insecure LAN hosting is not supported.

## Quick path

```sh
npm ci
npm run typecheck
npm test
```

Set these variables in the same terminal, then build **before** starting the server.

```sh
# POSIX shell: desktop smoke only
export HOST=127.0.0.1 PORT=3000
export PUBLIC_ORIGIN=http://localhost:3000 DEV_INSECURE=true
export ALLOW_TV_OPAQUE_ORIGIN=false
npm run build
npm run dev
```

```powershell
# PowerShell alternative: desktop smoke only
$env:HOST='127.0.0.1'; $env:PORT='3000'
$env:PUBLIC_ORIGIN='http://localhost:3000'; $env:DEV_INSECURE='true'
$env:ALLOW_TV_OPAQUE_ORIGIN='false'
npm run build
npm run dev
```

Open `http://localhost:3000/tv/` and two controller tabs at `http://localhost:3000/`. Use the displayed room code; the QR's localhost URL cannot reach this computer from a phone. Do not bind insecure mode to a LAN address or expose this port.

`npm run dev` serves built assets; it is not a hot-reload server. Rebuild after client edits, restart the server after server/config edits, and refresh the pages. Stop with Ctrl+C. Before production, clear the local overrides, set `DEV_INSECURE=false` and the production `PUBLIC_ORIGIN`, and rebuild.

## Environment reference

Set variables in the terminal or hosting UI. Node does not automatically load `.env` files. Never store credentials here.

| Variable | Default outside Docker | Meaning |
|---|---|---|
| `HOST` | `127.0.0.1` | Listener; Docker uses `0.0.0.0` on its private network. |
| `PORT` | `3000` | Positive integer, at most 65535. Internal HTTP port behind TLS proxy. |
| `PUBLIC_ORIGIN` | `https://tvfootbal.systemautomatic.xyz` | Exact controller origin; used at TV build time and relay runtime. No trailing slash, credentials, path, query or fragment. HTTPS required in production. |
| `DEV_INSECURE` | `false` | Literal `true` permits HTTP only for `localhost`/`127.0.0.1` origins; listener must be loopback. Desktop smoke only, never insecure LAN. |
| `ALLOW_TV_OPAQUE_ORIGIN` | `false` | Explicit installed-app handshake-testing flag accepting `null`/absent Origin. Leave false for ordinary local browser smoke. Enable only deliberately on the HTTPS relay for installed-TV testing; it does not identify or authenticate a TV. |
| `MAX_CONNECTIONS` | `100` | Maximum simultaneous WebSockets, positive integer. |
| `MAX_ROOMS` | `20` | Maximum active rooms, positive integer. |
| `ROOM_TTL_MS` | `1800000` | Room lifetime in milliseconds (30 minutes), positive integer. |

An installed TV cannot use this computer's localhost relay. Test its opaque/file-origin WSS behavior against the authorized HTTPS deployment with `DEV_INSECURE=false`; never work around TLS errors with insecure LAN mode. Room ownership is socket-bound, not established by Origin.

## Build and packaging details

- `npm run build` bundles controller and TV as readable IIFEs with esbuild targets Chrome 70/Safari 13. This transpilation target is not a claim about the installed TV engine; no runtime API polyfills are supplied.
- Client scripts, styles, Phaser and QR generation are local bundles, not remote CDNs. No source maps are generated. Controller HTML is copied unchanged; relay HTTP headers supply its CSP.
- TV assets use relative paths. Its generated CSP permits only the configured `/ws` endpoint, local scripts/styles and local/data images for the QR. There is no `unsafe-eval` or `unsafe-inline`: Phaser's scale manager sets individual style properties, not inline script/style blocks.
- `PUBLIC_ORIGIN` is compiled into the TV and its CSP. Changing it requires a rebuild, repackaging and reinstalling the TV app; changing relay runtime variables alone is insufficient.
- `npm run package:tv` requires `dist/tv` and an explicitly installed webOS CLI. See [webOS](webos.md). It never downloads or installs tools automatically.
- Build tests invoke public scripts in fresh OS temporary directories and remove those directories afterward. `node --import tsx --test tests/build.test.ts` runs only packaging/build checks.

See [protocol](protocol.md) for leases, reserved slots and bounded messages; [device checklist](device-checklist.md) is the required next hardware gate.
