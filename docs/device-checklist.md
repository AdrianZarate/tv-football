# Real-device connectivity review gate

Run only after authorized HTTPS deployment and IPK installation. Capture actual LG TV + Android + iPhone evidence. Desktop browsers, emulators and automated tests do not establish TV compatibility or acceptable latency.

## Quick path

1. Record the environment below; put all three devices on the same Wi-Fi and use the deployed public relay.
2. Join both phones, exercise controls/lifecycle failures, and collect idle/load measurements for each phone.
3. Review results with the user. **Do not build the full football game until the user approves this milestone.**

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
- [ ] Android and iPhone receive distinct slots and move only their own object. Both objects pause until both phones are connected.
- [ ] A third browser/device cannot replace either player. A room code cannot impersonate the existing TV socket.
- [ ] New room on TV changes the room; old controllers cannot control it. Join both phones again deliberately.

## Touch and lifecycle matrix

Repeat every row on **both** phones, observing both TV objects. Record pass/fail and details, not just whether the page loaded.

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

Expected: releases/cancellations clear affected controls; no stuck movement/action. On a half-open connection, held inputs clear after the 350 ms safety lease (plus timer scheduling), without waiting for heartbeat. Full phone disconnection recognition can take up to about 20 seconds via relay heartbeat; both objects pause when absence is recognized. Lease expiry clears controls, not slot connection state. Record observed delays rather than promising an exact wall-clock deadline. TV-side liveness checks may stop its session sooner.

Slots stay reserved after disconnect; returning/reloading does not reclaim them. There is **no reconnect feature**: create a new room and join both phones again. Verify room expiry at the default 30-minute TTL (or document a deliberately configured shorter test TTL); return to the default afterward.

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
| User approval before full game | |

**Stop here until the user reviews the real-device results.** If the VPS route is inadequate, propose a better-latency location based on measurements only; do not purchase, provision or modify infrastructure without approval. Final football rules, tied matches and reconnection policy remain deferred. No computer or extra home server should be needed during gameplay once the relay and TV app are installed.
