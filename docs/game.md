# Pocket Pitch: game unit

An original, side-view football game for exactly two people. P1 is blue and attacks the right goal; P2 is orange and attacks the left goal. Each phone controls only its assigned player. There is no AI, networking, audio or external artwork in the game unit.

## Controls and rules

- **Left / Right:** move and face that direction. Holding both cancels movement.
- **Jump:** press while grounded. Holding does not repeat; an airborne press does not queue another jump.
- **Kick:** press near the ball, facing towards it, to launch it forward and upward. Each attempt has a 400 ms cooldown. Holding does not repeat.
- Movement and actions can be pressed simultaneously. Release and cancellation must send neutral buttons. Inputs expire after 350 ms without a fresh packet.

Both phones must be connected and **both players must press Ready** before starting. The clock starts at 2:00, runs only during play, and ends at exactly two minutes of active time. The higher score wins; equal scores produce a draw, with no overtime. Both players can confirm a rematch, which resets the clock, score, ball and players.

A goal counts only when the whole ball crosses a touchline inside the goal mouth. The opposite player scores. Each goal atomically resets the ball, players and controls at kickoff, without resetting the clock or scoring again on the next frame. Above the crossbar the ball bounces off the side wall. Gravity, floor/ceiling rebounds and body/head collisions apply to the ball; players cannot pass through each other or leave the pitch.

A controller disconnect immediately pauses physics and the clock, and clears both players' inputs and readiness. The missing controller has 60 seconds to return. Once both are back, the deadline is removed, but **both must press Ready again** to resume. A new dropout while waiting for confirmation starts a new 60-second deadline; socket churn during an ongoing outage never extends it. At the deadline, cancellation is terminal and awards no winner, even if one player leads. Create a new room after cancellation. Disconnecting in the lobby does not start a match or a match-cancellation timer.

## TV integration API

`game/model.ts` imports only `Buttons`, `Slot`, `neutralButtons` and `INPUT_LEASE_MS` from the shared protocol. It has no Phaser, DOM, transport, random source or real-time timer dependency.

```ts
import { FootballMatch, FIELD } from '../game/model.js';
import { GameScene } from '../game/scene.js';

const match = new FootballMatch();
match.setConnected([true, true], performance.now());
match.ready(1);
match.ready(2);
// Relay input packets are already authenticated, assigned and validated by the host.
match.setInput(1, { left: false, right: true, jump: false, kick: false }, performance.now());
// TV update: deltaSeconds is the complete elapsed frame interval, not a physics clamp.
match.step(deltaSeconds, performance.now());
const snapshot = match.snapshot();
const scene = new GameScene(match); // Alternatively: new GameScene(() => match.snapshot()).
// Host Phaser config: width FIELD.width, height FIELD.height, scene: [scene],
// scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }.
```

The renderer **does not call `step`**. The host must advance the model exactly once per frame, before rendering. `step(seconds, nowMs)` consumes the full active `seconds` for the match clock while limiting physics to 100 ms and at most twelve substeps. If that frame exhausts the clock, it finishes before doing physics: no late goals. Never pre-clamp the clock delta. Resume with a fresh frame delta, not an interval that includes the paused period. Supply a consistent monotonic millisecond clock for input leases and disconnect deadlines; call `step` even when paused so the TV can expire the deadline. No phone or relay controls the clock.

Methods return no value, except `snapshot()`, which returns a detached copy:

| Method | Effect |
| --- | --- |
| `setConnected([boolean, boolean], nowMs)` | Update presence; immediately pause on a playing dropout; enforce deadline before accepting a late reconnect. |
| `ready(slot)` | Confirm start, resume or rematch only when both are connected; duplicate confirmation cannot impersonate the other player. |
| `setInput(slot, buttons, nowMs)` | Replace that player's controls during play; neutral releases are visible immediately in snapshots. |
| `step(seconds, nowMs)` | Advance the active clock and bounded physics, release stale inputs, or expire a paused outage. |
| `snapshot()` | Read phase, connected/ready tuples, score, remaining time, players, ball, winner and disconnect deadline. |

`MatchSnapshot.phase` is `lobby | playing | paused | finished | cancelled`. Score and readiness tuples use index 0 for slot 1 and index 1 for slot 2. `winner` is `null | 1 | 2`; draws, lobby, active play and cancellations use `null`. `disconnectDeadlineMs` is an absolute monotonic deadline or `null`. Player `x` is the horizontal center and `y` is the feet coordinate. Ball coordinates denote its center. Each player exposes velocity, facing (`-1 | 1`), grounded state, kick cooldown and copied buttons. All positions use a 1280 × 720 logical canvas, downward-positive y, with exported `FIELD`, `PLAYER`, `BALL`, `PHYSICS`, `MATCH_MS`, `DISCONNECT_MS` constants and public types.

Optional `new FootballMatch({ initialState: { players: [partialBody, partialBody], ball: partialBody } })` supplies trusted, finite physics fixtures for the **first kickoff only**. It cannot change readiness, score or clock. Goals and rematches always use the standard kickoff. This is a deterministic test seam, not a gameplay menu or remote message schema.

TV room loss, app backgrounding and app exit must end the current room at the host level; there is no TV match recovery API. Room QR, controller assignment/resume and relay status are separate integration responsibilities. The scene takes a model or snapshot callback, draws snapshots only and owns no game rules or socket lifecycle.

## Original artwork and runtime constraints

All visible game artwork is authored as Phaser `Graphics` geometry in `game/scene.ts`: round heads, caps, jerseys, arms, boots, a segmented ball, goalposts/nets, clouds, spectator dots and pitch markings. No image files, copied characters, branding, source code, sampled sound, external asset URLs or CDN fonts are used. “Pocket Pitch” is a local working label, not a borrowed game's title. Inspiration is limited to the general two-person cartoon football genre.

Text uses locally available Arial / sans-serif through Phaser's canvas text. The scene creates no DOM nodes, injected style blocks, dynamic code or eval; it requires no `unsafe-eval` or inline CSS allowance. The existing host supplies Phaser locally and controls stage sizing/FIT, CSP and app lifecycle. Automated model tests and TypeScript do not prove actual webOS rendering or CSP compatibility; those remain integration/device gates.

## Verification and real-device checklist

Focused deterministic model tests: `node --import tsx --test tests/game.test.ts`. TypeScript: `npm run typecheck`.

On the installed TV app with two actual phones:

1. Connect via room QR; confirm a single player's Ready never starts play.
2. Start with both Ready, move each player separately, then hold movement + Jump + Kick simultaneously on both phones.
3. Release, cancel a touch and background a phone; confirm no stuck movement and an immediate frozen match/clock on disconnect.
4. Reconnect within 60 seconds; verify both must confirm and the saved physics/clock resume unchanged.
5. Disconnect both phones, reconnect only one repeatedly and verify the original deadline still cancels with no winner, including a non-tied score.
6. Score through each goal, hit walls above the crossbar, bounce the ball off a player/head/floor, and check one score and one kickoff per goal.
7. Play to two minutes, check winner or draw and no overtime; verify both-confirmed rematch starts at 0–0 and 2:00.
8. Check FIT at the TV's real resolution, clear goal mouths, distinct colors/readable labels, local artwork, no CSP errors and acceptable rendering responsiveness.

Hardware acceptance, browser/CSP execution and real relay integration are not established by the pure model test suite.
