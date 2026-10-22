# Real-device full-game review gate

Run only after authorized HTTPS deployment and IPK installation. Capture actual LG TV + Android + iPhone evidence. The previous connectivity probe was validated and reported responsive; the new full game remains pending actual-device acceptance. Desktop browsers, headless adapter tests, emulators and build success do not establish TV compatibility or acceptable latency. See [match rules](game.md).

## Quick path

1. Record the environment below; put all three devices on the same Wi-Fi and use the deployed public relay.
2. Join both phones, confirm readiness, play complete matches, exercise recovery/lifecycle failures and collect idle/load measurements for each phone.
3. Review the new game's results with the user. **Do not claim full-game hardware acceptance from the earlier probe.**

## Record the environment

Do not commit private addresses, account data, device passphrases or keys. Redact screenshots/logs before sharing.

| Field | Observed result |
|---|---|
| TV model | |
| TV firmware / webOS version (read on device) | |
| Installed-app web engine / user agent (manual inspection or authorized inspector) | |
| IPK version / build revision / configured relay origin | |
| Android model / OS / browser version | |
| iPhone model / iOS / browser version | |
| Wi-Fi conditions / test time / network load | |
| VPS location as verified by operator, not assumed | |
| TV picture mode / game mode if available | |
| Developer Mode remaining time / renewal checked | |

Do not infer the engine from reported firmware. Record missing facts as unknown.

## Connectivity and isolation

- [ ] Launch the installed app. Check valid TLS/certificate trust, WSS upgrade and file/opaque-origin handshake. Record any need for the explicit `ALLOW_TV_OPAQUE_ORIGIN` relay flag; production stays HTTPS/WSS.
- [ ] QR opens the HTTPS controller; separately test manual URL plus room-code entry on both phones.
- [ ] The full original 1280×720 pitch fits without cropping: two goals, blue P1, orange P2, readable score and clock. No CSP errors, remote assets or missing artwork.
- [ ] Android and iPhone receive distinct slots and control only their own player. Connected alone does not start play; both must press Ready on their phones. TV shows P1/P2 readiness.
- [ ] The join panel collapses during play, leaving the full pitch visible; QR/manual join instructions remain available when needed. New room has visible remote focus and requires no TV text entry.
- [ ] A third browser/device cannot replace either player. A room code cannot impersonate the existing TV socket.
- [ ] New room on TV changes the room; old controllers cannot control it. Join both phones again deliberately.

## Match rules and recovery

- [ ] Both players Ready starts at 0–0 and 02:00. Test left/right plus simultaneous jump/kick. Check body/head/floor collisions and both goal mouths.
- [ ] Score through each goal; check exactly one point to the correct player and one kickoff reset, with the clock preserved. Above-crossbar hits do not score.
- [ ] Complete 120 seconds of active play. Clock uses ceiling seconds, down to 00:00. Higher score wins; tied score displays DRAW with no overtime.
- [ ] Finished screen shows result and each player's rematch readiness. One confirmation alone does not restart; both reset score, clock and kickoff.
- [ ] Disconnect a phone while playing. Once recognized, physics and match clock freeze; TV shows the 60-second reconnect deadline countdown and clears both readiness states.
- [ ] Return within the deadline with the same phone and original browser session. Slot stays the same; a new browser with only the room code cannot replace it. Both players must confirm resume before clock/physics advance.
- [ ] When both are back, TV waits for both confirmations without counting down a missing-phone deadline. A new dropout starts a fresh 60-second wait; reconnecting only one during an existing outage does not extend it.
- [ ] Leave a phone missing for the full 60-second recognized-disconnect window, including when one player leads. Match cancels with no winner, remains frozen and requires New room.
- [ ] Losing the saved browser session or denied storage gives clear recovery feedback; failed recovery may require New room. Resume keys stay in the original browser's `sessionStorage`, never in QR/URLs, shared screenshots or logs.

## Touch and lifecycle matrix

Repeat every row on **both** phones, observing both TV players. Record pass/fail and details, not just whether the page loaded.

| Action | Android result | iPhone result |
|---|---|---|
| Hold left + kick + jump simultaneously; also test right | | |
| Release each finger independently while others stay held | | |
| Slide a finger outside its button, then release | | |
| Pointer cancellation / interrupted touch gesture | | |
| Rotate phone during held controls | | |
| Switch app / background browser during hold | | |
| Lock phone during hold; unlock and return | | |
| Close tab / disconnect browser during hold | | |
| Wi-Fi off during hold; restore network | | |
| TV app background, return, relaunch and New room | | |

Expected: releases/cancellations clear affected controls; no stuck movement/action. On a half-open connection, held inputs clear after the 350 ms safety lease (plus timer scheduling), without waiting for heartbeat. Full phone disconnection recognition can take up to about 20 seconds via relay heartbeat; the match and clock pause when absence is recognized, then the 60-second recovery deadline begins. Lease expiry clears controls, not slot connection state. Record observed delays rather than promising an exact wall-clock deadline. TV-side liveness checks may stop its session sooner.

Phone slots remain reserved: only the original browser session's key can resume that player, including reload within that session. Closing the whole browser session may lose it. Another browser cannot replace the slot. TV app backgrounding, exit, TV socket loss or liveness failure ends the current room entirely; returning does **not** recover the match. Select New room and join both phones again. Verify old-room controllers receive an end notice and cannot control the new match. Verify room expiry at the default 30-minute TTL (or document a deliberately configured shorter test TTL); return to the default afterward.

## Measure RTT honestly

Collect phone↔relay, phone↔TV via relay, and TV↔relay application RTT. For each displayed rolling window, record **p50, p95, n** and **variation = p95 − p50** in milliseconds. The window holds up to 120 samples; wait for a useful sample count and record the actual `n`. These use local `performance.now()` round trips, not synchronized device clocks or one-way latency.

The full phone→relay→TV→relay→phone probe ACK is sent **before drawing**. It is not button-to-screen latency. Scene update intervals are not display presentation time or guaranteed FPS.

| Run / phone / idle or load | Route | p50 ms | p95 ms | n | Variation ms | Errors / notes |
|---|---|---|---|---|---|---|
| | Phone ↔ relay | | | | | |
| | Phone ↔ TV via relay | | | | | |
| | TV ↔ relay | | | | | |
| | Phone ↔ relay | | | | | |
| | Phone ↔ TV via relay | | | | | |
| | TV ↔ relay | | | | | |

## Perceived responsiveness

- [ ] If available, enable TV game picture mode and record the actual setting; keep devices on the same Wi-Fi.
- [ ] Repeat movement + jump + kick on Android and iPhone, first on an idle network and then under representative network load. Record delay, jitter, missed releases and visible stalls separately from RTT.
- [ ] Optionally film the finger and TV together with high-speed video. Count frames from visible touch to first visible response; estimate `frames / camera_fps × 1000` ms. State camera FPS and frame count. This is approximate and frame-quantized; exposure, touch detection and display scanout add uncertainty.
- [ ] Do not promise FPS or latency from these preliminary measurements. Do not select a new VPS location without collected evidence and user review.

## Hard stop: user review

| Review outcome | Evidence / user decision |
|---|---|
| Installation / TLS / engine compatibility | |
| Two-phone safety and lifecycle results | |
| Idle/load RTT and perceived responsiveness | |
| Accept current route or investigate alternatives | |
| Full-game rules, readiness, rematch and recovery acceptance | |

**Stop here until the user reviews the real-device results.** Record failures honestly; the earlier probe does not satisfy this game gate. If the VPS route is inadequate, propose a better-latency location based on measurements only; do not purchase, provision or modify infrastructure without approval. No computer or extra home server should be needed during gameplay once the relay and TV app are installed.
