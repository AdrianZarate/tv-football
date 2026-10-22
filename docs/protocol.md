# Connectivity and game-session protocol

One JSON message per WebSocket frame at `/ws`. The relay binds roles to sockets; a message cannot choose another player's slot. Room codes use 8 uppercase characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`. Codes are discovery, not owner credentials. The TV owns physics, goals, clock, score, readiness rules, the 60-second disconnect cancellation and match results. The relay never simulates a match or advances a clock.

## Client → relay

| Message | Sender / effect |
|---|---|
| `{type:"create"}` | Unassigned socket only; creates a legacy probe room and becomes its TV owner. No recovery or readiness. |
| `{type:"createGame"}` | Unassigned socket only; creates a game room owned by this TV socket. |
| `{type:"join",code}` | Unassigned socket; claims the first never-used slot (1 or 2). A disconnected slot is never made available to join. |
| `{type:"resume",code,key}` | Unassigned socket; recovers the original game slot using its current credential, only after the old socket has closed. |
| `{type:"ready"}` | Assigned game phone only; forwards `{type:"ready",slot}` to its owning TV. The same message confirms initial start, resume and rematch. |
| `{type:"gameStatus",phase,score,remainingMs}` | Game-room TV owner only; broadcasts validated authoritative values to this room's phones. Latest status is also sent after game join/resume. |
| `{type:"input",sequence,buttons}` | Assigned phone only. Increasing safe-integer sequence and full snapshot `{left,right,jump,kick}` of booleans. |
| `{type:"ping",id}` | Any socket; relay answers `pong` for phone/TV ↔ relay application RTT. |
| `{type:"probe",id}` | Phone only; relay forwards `{type:"probe",slot,id}` to its TV. |
| `{type:"probeAck",slot,id}` | Room's owning TV only; relay forwards to the originating phone. |

All messages have exactly the listed keys. Ids/sequences are nonnegative safe integers. `phase` is exactly `lobby`, `playing`, `paused`, `finished` or `cancelled`. `score` is exactly two integers, each 0–9999. `remainingMs` is an integer 0–120000. Never send a code, slot or token with `input` or `ready`. Neither controller can address another player's slot. Unknown messages still produce `invalid_message` and close with 1008.

## Relay → client

- `{type:"created",code}`: TV room created (both modes).
- `{type:"joined",slot}`: assigned phone (`slot: 1 | 2`), unchanged in both modes. No secret is added to this message.
- `{type:"resumeKey",key}`: separate message immediately after game `joined`, on first join and successful resume. Never sent to TV or other phones. Persist the rotated key before allowing another recovery.
- `{type:"ready",slot}`: owning TV receives a readiness confirmation from this assigned game phone. The TV decides whether it applies to start, resume or rematch.
- `{type:"gameStatus",phase,score,remainingMs}`: phones receive the TV's exact validated status. Display it; do not predict or run a local clock. There is no relay match timer.
- `{type:"state",connected:[boolean,boolean]}`: TV sees currently connected phones; no credentials or slot recovery metadata.
- `{type:"input",slot,sequence,buttons}`: TV receives validated snapshots. Relay-generated neutral snapshots on disconnect, lease expiry or resume may reuse the last sequence. TV must accept these neutral snapshots even when sequence repeats; relay already enforces client ordering. Resume starts a new sequence space, including zero.
- `{type:"pong",id}`: relay echo.
- `{type:"probe",slot,id}`: TV should reply immediately, not wait for rendering.
- `{type:"probeAck",id}`: phone→relay→TV→relay→phone application RTT, not presentation latency.
- `{type:"error",code}`: bounded machine code, no sensitive diagnostics.
- `{type:"ended",reason}`: TV left or room expired; stop controls, delete this room's saved credential and enter a new room code.

## Game recovery and credentials

Game phones receive independent random 256-bit lowercase hexadecimal credentials (64 characters). The relay stores only SHA-256 hashes in the original room's immutable player records. A key is scoped to its room and slot, never an account or global identity. It must not appear in QR codes, query strings, logs, diagnostics, `created`, `joined`, or `state`. QR links contain only the discovery room code. Use production HTTPS/WSS.

The controller saves credentials only in `sessionStorage`, under `tv-football:resume:<ROOM>`, with a volatile in-page fallback. Storage denial/unavailability is explicitly shown: in-page recovery can still work, but reload recovery is not promised. Changing the form's room code loads only that room's credential. Reload/foreground recovery uses `resume`, never a fallback `join` into an empty slot. Session storage is browser-managed, not durable identity or proof of physical device; copied/duplicated browser-session storage can carry the credential, so do not share the tab or credential.

Successful resume atomically rotates the key once, sends the same `joined` shape followed by the new `resumeKey`, clears outstanding probes and controls, and resets the sequence counter. The old key becomes invalid immediately. Stale socket cleanup cannot neutralize or clear a replacement's state. A live or closing socket is never evicted by a valid key. If a rotated-key response is lost before the browser receives it, the old key cannot be replayed: recovery fails closed, rather than granting a second identity or joining a different slot.

Recovery errors:

- `resume_busy`: original socket is still open/closing. Retry without eviction. This error does not assign the retry socket.
- `resume_invalid`: wrong room mode, wrong key, revoked/replayed key. Terminal for this controller; discard this room's saved key. No token details are returned.
- `room_unavailable`: room ended/expired/nonexistent. Terminal; discard saved key.
- `role_locked`: an assigned socket cannot create, join or resume another role.
- `game_phone_only`, `game_only`, `tv_only`, `not_assigned`: sender is not authorized for that operation; no forwarding occurs.

On game background/pagehide, the phone releases all pointers, sends a neutral snapshot and closes its socket so the TV pauses immediately when the close arrives. Leases remain a fallback. On foreground or an unexpected disconnect, recovery attempts use one-second backoff for at most 60 seconds of wall time, with no attempts while hidden. `resume_busy` may retry within that same budget; wrong keys and unavailable rooms are terminal. Controls and readiness stay disabled during recovery. Confirmations from both phones are required by the TV after returning. The relay neither cancels the match after 60 seconds nor interprets results; the TV does that. TV disconnect ends the room, with no TV recovery.

## Safety and liveness

Maximum frame: 1,024 bytes. Rate: 80 messages per second per socket, including all new messages. Phones send full snapshots on change plus 100 ms held-input renewals. A 350 ms input lease clears held buttons at the relay; the TV also has its own 350 ms safety lease. Browser handlers cover pointer capture/up/cancel/lost capture, blur, pagehide and visibility changes. Bounded RTT maps remain diagnostic only. The TV pauses whenever either phone is absent.

Legacy probe rooms keep their original behavior: `create`, `join`, `ping`, `probe`, `probeAck`, and `input` work without credentials, readiness or recovery. Both modes reserve used slots after disconnect. A legacy phone must ask for a new TV room after disconnect; the absence of `resumeKey` identifies the probe flow.

For installed-TV handshake testing, the relay optionally accepts exact opaque origin `null` (or absent Origin). Origin is defense-in-depth, not identity; room authority comes exclusively from the original socket. Existing `/ws` path/origin checks, frame/rate bounds, backpressure, socket/room capacity, handshake timeout, heartbeat, leases and room TTL apply equally to both modes. Public anonymous room creation is not a complete Internet DDoS defense.

## Real-device session checklist

- Join two game phones by QR; confirm distinct slots and require both Ready buttons before TV start.
- Hold movement plus Jump/Kick with separate fingers. Release, cancel touch, lose capture and blur; confirm no stuck controls and diagnostics remain bounded.
- Background a held-input phone; confirm immediate TV pause and frozen clock. Return within 60 seconds; confirm same slot, neutral controls, rotated credential and both resume confirmations.
- Reload the same browser with session storage enabled; enter the same room code and confirm recovery rather than a new slot. Deny storage and confirm the reload-recovery warning without losing in-page recovery.
- Try a third browser before and after a disconnect; confirm it cannot replace either reserved slot. Attempt recovery while the old socket is half-open; confirm no eviction.
- Stay absent beyond 60 seconds; confirm the TV cancels without a winner. Finish a tied match; confirm both phones can request a rematch using the same readiness button.
- Close the TV room; confirm saved keys are cleared, controls disable and the join form accepts a new code. A different room must never reuse another room's credential.
- Repeat the original probe-room join/input/RTT flow; confirm no readiness UI or credential-based recovery.
