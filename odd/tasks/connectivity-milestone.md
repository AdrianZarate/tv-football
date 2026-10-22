# Real-device connectivity milestone
Objective: validate two browser controllers with an installed LG TV app, not implement the football game. Branch: feature/connectivity. Delivery: feature-branch-chain; local commits only, no remote or PR authorization.
Runner: npm test (Node test runner via tsx), npm run typecheck, npm run build. Forecast: 1,800–2,600 authored lines excluding generated assets/lockfile; slices: foundation, relay, controller, TV, deployment. Hardware proof remains a separate human gate.

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
T1 | S1-S3,S7,S11 | inline (shared contract/bootstrap precedes independent units) | done | foundation commit: see git log feat(protocol); RED exit 1 missing protocol module, GREEN 3/3 tests and typecheck exit 0.
T2 | S2-S5,S7-S8 | delegated parallel writer (independent relay behavior >100 lines) | in_progress | relay, commit pending; Risk: item 2 (room identity/assignment guards), item 4 (disconnect lifecycle).
T3 | S4-S6,S8 | delegated parallel writer (independent touch-input behavior >100 lines) | in_progress | controller, commit pending; reuses frozen protocol, no dependency on relay implementation.
T4 | S2-S6,S8 | inline (TV adapter consumes completed units) | pending | TV prototype, commit pending.
T5 | S2,S9,S11-S12 | inline (deployment/packaging consumes built prototype) | pending | deployment, commit pending; Risk: item 5 (Docker/dependencies/packaging).
T6 | S3-S9,S11 | independent verify after self-checks | pending | final security/behavior verification, native assessment/review only as offered.
T7 | S6,S10,S12 | human real-device gate | blocked | waits for explicit deployment/TV installation authorization and actual measurements; no full game until user validates results.

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
