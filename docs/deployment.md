# Deploy the relay with Dokploy

Deploy only after explicit user approval, using the user-approved ref. These are operator instructions, not an automatic push or evidence of a completed game deployment. The previous connectivity version was validated; the new full game still needs actual-device acceptance. Never request account credentials or make VPS/firewall changes as part of local validation.

## Quick path

1. In DNS, point `tvfootbal.systemautomatic.xyz` to `<ACTUAL_VPS_IPV4>` with an A record. Add an AAAA record only for `<ACTUAL_WORKING_VPS_IPV6>` if that address and route actually work. Do not invent an address or leave a stale AAAA record.
2. In Dokploy, create an application from the approved repository/ref. Select **Dockerfile**, repository-root context and `Dockerfile`. Do not publish host port 3000; Traefik must reach container port **3000** through Dokploy's internal network.
3. Set runtime variables below. Keep the Docker build argument `PUBLIC_ORIGIN=https://tvfootbal.systemautomatic.xyz` aligned with the runtime value. The same origin must be used for any separately built TV IPK.
4. Add domain `tvfootbal.systemautomatic.xyz`, path `/`, container port `3000`, HTTPS enabled with a valid public certificate. TLS terminates at Traefik; internal container traffic is HTTP. Confirm certificate issuance before connecting devices.
5. Deploy only when authorized, then run the smoke checks below. Never disable certificate validation to make the TV connect.

## Runtime configuration

```text
HOST=0.0.0.0
PORT=3000
PUBLIC_ORIGIN=https://tvfootbal.systemautomatic.xyz
DEV_INSECURE=false
ALLOW_TV_OPAQUE_ORIGIN=false
MAX_CONNECTIONS=100
MAX_ROOMS=20
ROOM_TTL_MS=1800000
```

Enable `ALLOW_TV_OPAQUE_ORIGIN=true` explicitly when testing the installed TV's `null`/absent Origin handshake. Record the observed Origin behavior and the reason for enabling it. The production transport still requires HTTPS/WSS; this flag does not grant TV room ownership or permit replacing another socket. See the full [environment table](development.md#environment-reference).

The multi-stage Node 24 Alpine Dockerfile builds with `npm ci`. Runtime installs only production dependencies (including `tsx`), copies server/shared/built assets, runs as `node`, and uses an exec-form Node CMD for shutdown signals. `EXPOSE 3000` documents an internal port; it does not publish it. The healthcheck requests `/healthz`. Secrets, local environment files, Git history, node_modules and IPKs are excluded from the build context.

## HTTPS and WebSocket proxy checks

Traefik normally handles WebSocket upgrades automatically. Preserve `Upgrade: websocket` and `Connection: Upgrade` semantics for `/ws`; do not introduce response buffering, path rewriting, redirect loops or middleware stripping the upgrade. Ensure idle timeouts allow ongoing heartbeat traffic. Do not add a second raw public port or make ad-hoc firewall changes.

After authorized deployment:

```sh
curl --fail https://tvfootbal.systemautomatic.xyz/healthz
```

Expected body: `{"ok":true}`. Open the HTTPS controller page and confirm its local JS/CSS load without mixed content or certificate errors. For a WSS check, run in that page's browser console (the correct browser Origin matters):

```js
const smoke = new WebSocket('wss://tvfootbal.systemautomatic.xyz/ws');
smoke.onopen = () => smoke.send(JSON.stringify({ type: 'ping', id: 1 }));
smoke.onmessage = event => { console.log(event.data); smoke.close(); };
smoke.onerror = () => console.error('WSS smoke failed');
```

Expect `{"type":"pong","id":1}` and an upgraded `101` connection in the Network inspector. If it fails, inspect DNS, certificate chain, proxy upgrade routing and relay Origin configuration; do not paste sensitive logs into chat. `/tv/` can check the game with two browser controllers pressing Ready, but is **desktop smoke only**, not installed-TV proof. A proxy healthcheck alone does not establish WSS correctness.

## Next gate

Package the TV with the same public origin using [webOS instructions](webos.md), then complete the [device checklist](device-checklist.md). Update both TV and controller/relay from the approved game revision: the old probe's controls are not the full-game acceptance gate. The TV owns physics, goals, score and clock; the VPS only validates and relays bounded messages. See [match rules](game.md).

Phone disconnection pauses the match for up to 60 seconds, with same-browser reserved-slot recovery and both-player confirmation. TV backgrounding, TV connection loss or a relay restart ends the room; there is no TV recovery promise. Users may need New room after failures. Resume keys belong only in the phone browser's `sessionStorage`, never in shared URLs, proxy logs or support screenshots. Do not log WebSocket payloads containing keys.

Once deployed and installed, gameplay needs no computer or home server. Do not choose another VPS location until real measurements are collected and reviewed; do not purchase or provision infrastructure without approval.

Official reference: [Dokploy domains](https://docs.dokploy.com/docs/core/domains).
