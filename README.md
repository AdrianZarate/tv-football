# TV Football connectivity probe

Validate an installed LG webOS app with two phone browsers before building the football game. The TV runs a TypeScript/Phaser movement probe; phones send independent controls through a Node.js WebSocket relay. The relay neither simulates the game nor streams video. No WebRTC is used.

## Quick path

Use Node.js 24 and npm. No deployment or TV installation is performed by these commands.

```sh
npm ci
npm run typecheck
npm test
npm run build
```

The build creates readable, offline-bundled assets in `dist/controller` and `dist/tv`. It defaults to `https://tvfootbal.systemautomatic.xyz`. For a loopback-only desktop smoke test, follow [local development](docs/development.md) before starting `npm run dev`.

## Next steps

| Goal | Guide |
|---|---|
| Develop locally; configure environment | [Development](docs/development.md) |
| Deploy relay behind HTTPS/WSS | [Dokploy deployment](docs/deployment.md) |
| Package and install the LG app | [webOS setup](docs/webos.md) |
| Record TV, Android and iPhone evidence | [Real-device checklist](docs/device-checklist.md) |
| Understand messages and safety limits | [Protocol](docs/protocol.md) |

`/` is the controller. `/tv/` is a desktop smoke-test view, not proof of installed-TV compatibility. A webOS CLI is required separately to produce an `.ipk`; a successful web build is not a package or an installation. Real-device compatibility and responsiveness remain pending.

## Boundary and review gate

The prototype moves two objects and measures application RTT. It does not implement football physics, goals, matches, ties, readiness or rematches. Slots remain reserved after disconnection; there is no reconnection feature. Create a new room after a disconnect.

**Stop before the full game:** review the completed device checklist and measurements with the user. Do not deploy, change the VPS/firewall, provision infrastructure, or install on the TV without explicit approval. Never put credentials, device passphrases or private keys in chat or this repository. After the public relay is deployed and the IPK installed, gameplay requires only the TV, phones and Internet—not a development computer or home server.
