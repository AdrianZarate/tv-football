# Connectivity protocol (v0 prototype)

One JSON message per WebSocket frame at `/ws`. The relay binds roles to sockets; a message cannot choose another player's slot. Room codes use 8 uppercase characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`. They are discovery codes, not owner credentials. No accounts, cookies, persistent sessions, or reconnect feature.

## Client → relay

| Message | Sender / effect |
|---|---|
| `{type:"create"}` | Unassigned socket only; creates its own room and becomes its TV owner. Never attaches to an existing TV. |
| `{type:"join",code}` | Unassigned socket; claims first never-used slot (1 or 2). |
| `{type:"input",sequence,buttons}` | Assigned phone only. Increasing safe-integer sequence and full snapshot `{left,right,jump,kick}` of booleans. |
| `{type:"ping",id}` | Any socket; relay answers `pong` for phone/TV ↔ relay application RTT. |
| `{type:"probe",id}` | Phone only; relay forwards `{type:"probe",slot,id}` to its TV. |
| `{type:"probeAck",slot,id}` | Room's owning TV only; relay forwards to the originating phone. |

All messages must have exactly the listed keys. Ids/sequences are nonnegative safe integers. Never send a code, slot or token with `input`. Neither controller can address another player's slot.

## Relay → client

- `{type:"created",code}`: TV room created.
- `{type:"joined",slot}`: assigned phone (`slot: 1 | 2`).
- `{type:"state",connected:[boolean,boolean]}`: TV sees currently connected phones.
- `{type:"input",slot,sequence,buttons}`: TV receives validated snapshot; relay-generated neutral snapshots on disconnect/lease expiry may reuse last sequence. TV must accept neutral snapshots even if sequence repeats (relay already enforces sequence ordering).
- `{type:"pong",id}`: relay echo.
- `{type:"probe",slot,id}`: TV should reply immediately, not wait for rendering.
- `{type:"probeAck",id}`: phone's full phone→relay→TV→relay→phone application RTT. Not screen/presentation latency.
- `{type:"error",code}`: bounded machine code; no sensitive diagnostics.
- `{type:"ended",reason}`: TV left or room expired; stop controls and create a new room from TV.

## Safety and liveness

Maximum frame: 1,024 bytes. Rate: 80 messages per second per socket. Phones send snapshots on change plus 100 ms held-input renewals. A 350 ms input lease clears held buttons at relay; the TV also has its own 350 ms safety lease. The TV pauses both objects whenever either phone is absent. Browser lifecycle handlers release all pointers immediately; an interrupted connection still expires safely.

Slots stay reserved even after a phone disconnects. Reloading a phone does not reclaim its slot: create a new room using the TV's New room control. This intentionally avoids deciding the final game's reconnection policy.

Public production WSS is required. For installed-TV handshake testing, the relay optionally accepts the exact opaque origin `null` (or absent Origin). Origin is defense-in-depth, not identity; room authority comes exclusively from the original socket. A third device may create a separate room, not become owner of an existing one. Global room/socket limits and room expiry bound memory; public anonymous room creation is not a complete Internet DDoS defense.
