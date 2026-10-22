# TV Football

An original two-player cartoon football game: the LG webOS TV runs the authoritative TypeScript/Phaser match, and each phone sends Left, Right, Jump and Kick through a Node.js WebSocket relay. Two goals, two-minute matches, draws and both-confirmed rematches. No accounts, AI, WebRTC, video streaming or remote CDN assets.

**Validation status:** the previous connectivity probe was installed and tested with real phones; the user reported responsive independent movement. That is not validation of this new game. Full-game rendering, touch behavior and lifecycle on the installed TV still require the [real-device checklist](docs/device-checklist.md).

## Quick path

Use Node.js 24 and npm. These commands do not deploy or install on the TV.

```sh
npm ci
npm run typecheck
npm test
npm run build
```

The build creates readable offline bundles in `dist/controller` and `dist/tv`, defaulting to `https://tvfootbal.systemautomatic.xyz`. Follow [local development](docs/development.md) for loopback desktop testing before starting `npm run dev`. `/` is the phone controller; `/tv/` is desktop smoke only, not installed-TV proof.

## Play and recover

1. Select **New room** on the TV with its remote. Join both phones using the QR or manual URL/code.
2. Both players press **Ready to play** on their phones. TV status, score and clock are authoritative.
3. A recognized phone disconnect freezes play and the clock. Return with the **same phone and browser session** within 60 seconds; both players must confirm resume. Another browser cannot take the reserved slot.
4. Missing the deadline cancels without a winner. TV socket loss, TV backgrounding or exit ends the room outright: select New room, then rejoin both phones. There is no TV match recovery.

Recovery keys remain in the original browser's `sessionStorage`, not the QR or URL. Do not share keys or put them in logs. Blocked storage, lost browser sessions or recovery failures may require a new room. See [match rules](docs/game.md) and [protocol](docs/protocol.md).

## Guides and delivery boundary

| Goal | Guide |
|---|---|
| Develop locally; configure environment | [Development](docs/development.md) |
| Operate the HTTPS/WSS relay | [Dokploy deployment](docs/deployment.md) |
| Package and install the LG app | [webOS setup](docs/webos.md) |
| Verify the game on actual devices | [Real-device checklist](docs/device-checklist.md) |

App version `0.2.0` keeps ID `com.systemautomatic.tvfootball.probe` so it can update the existing test app. A web build is not an IPK or installation. Deployment, packaging and TV installation are separate operator actions; never auto-push, change the VPS/firewall or request secrets. No computer or additional home server is required during gameplay once the public relay and TV app are installed.
