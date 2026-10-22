# Real-device connectivity milestone
Objective: validate two browser controllers with an installed LG TV app, not implement the football game. Original branch: feature/connectivity; published as master with explicit user authorization. Delivery: feature-branch-chain; no PR authorization.
Runner: npm test (Node test runner via tsx), npm run typecheck, npm run build. Forecast: 1,800–2,600 authored lines excluding generated assets/lockfile; slices: foundation, relay, controller, TV, deployment. Basic real-device validation accepted; full-game product decisions remain open.

## Specs
S1. "Inspect the new folder and available tools before making changes." "Use a simple, maintainable structure and reproducible scripts."
S2. "Use:" "TypeScript and Phaser for the TV game." "A lightweight mobile web interface for controllers." "Node.js with secure WebSocket connections for the relay server." "Docker deployment compatible with Dokploy." "HTTPS for mobile pages and WSS for communication."
S3. "The TV owns the authoritative game simulation: physics, collisions, goals, clock and score. Phones send control inputs. The VPS manages rooms and relays inputs; it must not simulate the match or stream video." "Keep game logic independent of the transport." "Do not include WebRTC in the initial scope. Its availability in an ordinary installed webOS app is not established."
S4. "Display a QR code and an alternative room-entry method." "Connect two mobile browsers and assign distinct player slots." "Let each phone move a separate simple object on the TV."
S5. "Support simultaneous touch inputs, including movement plus an action." "Handle release, touch cancellation, backgrounding and disconnection without leaving controls stuck."
S6. "Measure application-level round-trip time and variation; distinguish those measurements from actual button-to-screen latency." "Guide me through testing perceived responsiveness on the TV." "Do not promise a frame rate or latency before measuring. A desktop browser or emulator does not establish TV compatibility."
S7. "Protect room ownership and player assignments: knowing a room code must not allow a third device to replace an existing player or impersonate the TV. Validate messages and bound their size and frequency."
S8. "Provide automated checks for game rules, player isolation, room capacity, input handling and disconnections, plus a real-device test checklist." Scope: prototype movement rules only; football rules remain deferred.
S9. "Document:" "Local development." "Dokploy deployment, domain, HTTPS and WebSocket proxy configuration." "Required environment variables, with placeholders instead of secrets." "webOS packaging, Developer Mode installation and session renewal."
S10. "Install a minimal app on the actual TV." "Review the results with me before building the full game. If the VPS route is inadequate, propose a better-latency server location based on measurements. Do not purchase or provision infrastructure without approval." "No computer or additional home server may be required during gameplay."
S11. "Do not request secrets in chat, commit credentials, modify my VPS, publish services or open firewall ports without explicit approval." "Communicate with me in Spanish. Explain technical decisions clearly; do not assume I know networking or webOS development. Use English for code and identifiers."
S12. "1. si tengo instalada la app en mi tv y tambien tengo una cuenta de lg developer, tambien esta esta computadora que esta en la misma red que la tv." "2. un android y un iphone ambos pueden usar el navegador." "3. tvfootbal.systemautomatic.xyz es el dominio que le puedo configurar en el vps"

## Tasks
T1 | S1-S3,S7,S11 | inline (shared contract/bootstrap precedes independent units) | done | commit 5dca27d; RED exit 1 missing protocol module, GREEN 3/3 tests and typecheck exit 0.
T2 | S2-S5,S7-S8 | inline fallback (parallel writer launch unavailable, no retry) | done | commit dffdd6e; RED missing app module exit 1, GREEN relay 8/8 exit 0 + typecheck; independent source verification passed. Risk: item 2 (room identity/assignment guards), item 4 (disconnect lifecycle). Native medium, escalated verification high, reviewDue=false (under_budget).
T3 | S4-S6,S8 | inline fallback (parallel writer launch unavailable, no retry) | done | commit cd11c93; RED missing input module exit 1; GREEN controller 4/4 exit 0 + typecheck. Actual mobile browser touch remains hardware gate. Native medium, reviewDue=false (under_budget).
T4 | S2-S6,S8 | inline (TV adapter consumes completed units) | done | commit 7a426cd; RED missing model module exit 1; GREEN TV model 3/3 exit 0 + typecheck. Installed app/render/input behavior remains hardware gate. Native medium, reviewDue=false (under_budget).
T5 | S2,S9,S11-S12 | delegated writer (runtime context backstop at 76,482 tokens) | done | commit 26e09c8; web build and 6 focused tests passed; CLI 3.2.6 IPK + Docker build exit 0; isolated container health exit 0. Integrated retry 24/24 + typecheck + diff check exit 0. Optional .env.example creation denied; variables documented in development guide, no bypass. Risk: item 5 (Docker/dependencies/packaging). Native medium, escalated verification high, reviewDue=false (under_budget).
T6 | S3-S9,S11 | independent verify after self-checks | done | verifier found no severe source blockers, 18 original source tests + 2 scratch probes exit 0, typecheck exit 0. First integrated run failed 23/24 plus timeout; explicitly authorized single retry passed 24/24 + typecheck + diff check exit 0. All delivered source slices assessed with actual Git bases after staging; reviewDue=false, no native review/approval claimed.
T7 | S6,S10,S12 | human real-device gate | done | user reports fluent two-object movement with almost no perceived lag/stutter; confirms releases and app switching leave no stuck controls. TV photo: application RTT n120/p50 126ms/p95 184ms/timeouts 0. Basic acceptance only, not exhaustive physical testing or button-to-screen measurement. Evidence L11-L12; tied-match/reconnection policy still undecided.

## Log
L1. Original user request (verbatim):

Build a new project from scratch: a local two-player 2D arcade football game running as an installed LG webOS TV app, with
 two smartphones acting as browser-based controllers.

   Communicate with me in Spanish. Explain technical decisions clearly; do not assume I know networking or webOS development.
 Use English for code and identifiers.

   ## Confirmed hardware and infrastructure

   - TV: LG 55UR7800PSB.
   - Reported system: webOS25 / 10.3.2-33.
   - Install the TV app through LG Developer Mode as an .ipk package.
   - I accept periodically renewing Developer Mode.
   - Players are located in Colombia.
   - I own a Contabo VPS running Dokploy, reportedly located in Central America.
   - I have a domain available.
   - No computer or additional home server may be required during gameplay.
   - A computer may be used for development and installation.
   - Phones and TV will normally share the same home network.
   - Internet connectivity is acceptable.

   ## Architecture

   Use:
   - TypeScript and Phaser for the TV game.
   - A lightweight mobile web interface for controllers.
   - Node.js with secure WebSocket connections for the relay server.
   - Docker deployment compatible with Dokploy.
   - HTTPS for mobile pages and WSS for communication.

   The TV owns the authoritative game simulation: physics, collisions,
   goals, clock and score. Phones send control inputs. The VPS manages
   rooms and relays inputs; it must not simulate the match or stream video.

   Do not include WebRTC in the initial scope. Its availability in an
   ordinary installed webOS app is not established.

   Keep game logic independent of the transport.

   ## First milestone: validate the real devices

   Before implementing the complete game, build the smallest useful
   connectivity prototype:

   1. Install a minimal app on the actual TV.
   2. Display a QR code and an alternative room-entry method.
   3. Connect two mobile browsers and assign distinct player slots.
   4. Let each phone move a separate simple object on the TV.
   5. Support simultaneous touch inputs, including movement plus an action.
   6. Handle release, touch cancellation, backgrounding and disconnection
      without leaving controls stuck.
   7. Measure application-level round-trip time and variation; distinguish
      those measurements from actual button-to-screen latency.
   8. Guide me through testing perceived responsiveness on the TV.

   Do not promise a frame rate or latency before measuring.
   A desktop browser or emulator does not establish TV compatibility.

   Review the results with me before building the full game. If the VPS
   route is inadequate, propose a better-latency server location based on
   measurements. Do not purchase or provision infrastructure without approval.

   ## Approved first game version

   Create an original game inspired by Football Legends, not a copy of its
   characters, branding, artwork, audio or code.

   - Exactly two human players, one controlled by each phone.
   - Side-view football pitch with two goals.
   - Cartoon-style characters and ball physics.
   - Controls: left, right, jump and kick.
   - Two-minute matches; the higher score wins.
   - QR connection screen.
   - Both players confirm readiness before starting.
   - Rematch flow.
   - Pause when a controller disconnects.

   No accounts, tournaments, special powers, online matchmaking or AI
   opponents in the first version.

   Resolve unspecified consequential rules, such as tied matches and
   reconnection behavior, with me before implementing them.

   ## Engineering and deployment

   Inspect the new folder and available tools before making changes.
   Use a simple, maintainable structure and reproducible scripts.

   Protect room ownership and player assignments: knowing a room code must
   not allow a third device to replace an existing player or impersonate
   the TV. Validate messages and bound their size and frequency.

   Provide automated checks for game rules, player isolation, room capacity,
   input handling and disconnections, plus a real-device test checklist.

   Document:
   - Local development.
   - Dokploy deployment, domain, HTTPS and WebSocket proxy configuration.
   - Required environment variables, with placeholders instead of secrets.
   - webOS packaging, Developer Mode installation and session renewal.

   Do not request secrets in chat, commit credentials, modify my VPS,
   publish services or open firewall ports without explicit approval.

   Start by summarizing the architecture and asking only for the information
   needed to execute the connectivity milestone. Do not build the full game
   before that milestone is validated.

L2. User hardware/domain confirmation (verbatim):
1. si tengo instalada la app en mi tv y tambien tengo una cuenta de lg developer, tambien esta esta computadora que esta en la misma red que la tv.
2. un android y un iphone ambos pueden usar el navegador.
3. tvfootbal.systemautomatic.xyz es el dominio que le puedo configurar en el vps

L3. User selected delivery strategy (tool answer verbatim):
User selected: 1. Bloques encadenados sobre una rama del proyecto (recomendado) (value: feature-branch-chain)

L4. Initial evidence: folder contained only .atl/, no Git repository. Node v24.22.0, npm 11.11.1, pnpm and Docker executable available; ares tools not in PATH. No Docker daemon or TV connectivity established. LG official sources: https://webostv.developer.lge.com/develop/getting-started/developer-mode-app ; https://webostv.developer.lge.com/develop/references/appinfo-json ; https://webostv.developer.lge.com/develop/specifications/web-api-and-web-engine ; https://docs.dokploy.com/docs/core/domains . Current CLI is @webos-tools/cli. Installed app WSS/origin behavior requires hardware proof; do not infer the actual engine from the reported firmware.
L5. Prototype boundary: TV creates a new room and its existing socket owns it; knowing a code cannot attach as TV or change that socket's role. A controller socket claims only an unused slot, which remains reserved until the room ends. No recovery/resume/reassignment feature is implemented: after disconnection, create a new room deliberately. The final game's reconnection/tie rules remain undecided. A disconnected TV ends its room. Bounded input leases prevent stuck controls. Browser transport and deterministic prototype model remain separate. Development insecure localhost mode is explicit; production permits configured HTTPS controller origin plus a separately configured installed-TV opaque origin, authenticated by socket role, not origin. No full football, ready/match/rematch/tie rules implemented.

L6. User authorized exact generated build files (tool answer verbatim): "User selected: 1. Autorizar esos archivos generados (value: approve-generated-build-paths)". Worker build tests observed RED exit 1 (missing scripts), GREEN 6/6, web build and typecheck exit 0. Safety denied optional .env.example write; no bypass attempted, environment reference lives in docs/development.md. Local CLI 3.2.6 installed only as pinned development dependency. No global tools installed.
L7. First integrated command `npm test && npm run typecheck && git diff --check` timed out at 30 seconds: 23/24 tests, one packaging-guard subprocess unexpectedly exited 3221225794 (0xC0000142 / STATUS_DLL_INIT_FAILED). Cause unproven. No automatic retry. User then explicitly selected (verbatim): "User selected: 1. Sí, repetir la verificación local (value: authorize-one-serial-verification-retry)". Single retry, without parallel installs/builds, exited 0 in 8 seconds: 24/24 tests, typecheck, diff check. This does not establish the cause of the first failure.
L8. Independent verifier read all specs and reviewed source, ownership, isolation, lifecycle, build/runtime. Its isolated source command passed 18 original tests plus 2 scratch probes; typecheck exit 0; no severe source blocker. Actual browser touch, installed-TV WSS/CSP/rendering and physical latency are unverified T7, not implied by automated checks. No native review requested: successful per-slice assessments reported native medium, reviewDue=false (under_budget); security and deployment escalations retained independent verification.
L9. Artifacts: artifacts/com.systemautomatic.tvfootball.probe_0.1.0_all.ipk, 333670 bytes, SHA256 fc7def2c056e913ddea11e012bb5caa822fbc98d3bd6412d03a1d7de43803887; package command exit 0. Warnings: missing requiredACG (no Luna APIs used), Node DEP0190 shell warning, deprecated transitive development-tool dependencies; documented in docs/webos.md. Docker image tv-football-probe:local built exit 0; isolated `docker run --rm --network none ...` served health 200 {"ok":true} and exited 0, no ports published. No VPS, DNS, firewall or TV changed.
L10. Local delivery slices: 5dca27d foundation (lockfile + verbatim task log make initial diff larger); dffdd6e relay 407 authored lines; cd11c93 controller 253; 7a426cd TV 249; 26e09c8 packaging/deployment approximately 638 authored lines excluding generated lockfile. Coherent packaging unit kept intact rather than artificially shrinking tests/docs. Delivery choice remains feature-branch-chain; no push/PR authorization. Next decision: authorize guided test deployment to tvfootbal.systemautomatic.xyz and Developer Mode installation. Collect device checklist results, then review before full-game design. Final football tied-match/reconnection rules remain undecided.

L11. Later user publication/deployment authorization (verbatim):
este es el repo en github para que subas el codigo y yo configuro el vps:
git remote add origin git@github.com:AdrianZarate/tv-football.git
git branch -M master
git push -u origin master

y si, pasemos al despliegue de pruebas

Remote configured exactly, current branch renamed master, push exit 0 at d03717e; user operates VPS. User reports /healthz {"ok":true}; independent WSS ping/pong exit 0. Subsequent photos after local Developer Mode instructions show installed TV QR, rendered objects and Android Player 1 with full phone-to-TV RTT. This newer authorization supersedes historical no-push statements above, not secrets/firewall/provisioning boundaries.
L12. User responsiveness feedback (verbatim, excluding attachment locator): "ya lo probe, y se mueven bien, no se siente casi retraso o tirones". TV photo: n120, TV-to-relay application RTT p50 126ms, p95 184ms, variation 58ms, timeouts 0; scene update interval 16.7ms is not presentation latency or guaranteed FPS. Photo is paused at 1/2 and does not alone establish when/why a phone left. Asked whether releasing buttons stops actions and switching apps during held movement leaves no object moving alone; user replied verbatim: "confirmo". Basic connectivity acceptance is supported by user observations; explicit manual-entry, third-device, touch-cancellation and prolonged-load physical checklist cases were not separately confirmed. Retain current VPS route for now. No full-game implementation starts before resolving tied matches and reconnection policy with the user.
