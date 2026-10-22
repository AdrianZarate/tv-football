import { InputTracker } from './input.js';
import { RoomCredentials, RetryWindow } from './session.js';
import { RttWindow, formatRtt } from '../shared/metrics.js';
import { parseServerMessage, ROOM_CODE_PATTERN, type Buttons, type ClientMessage, type GameStatus, type Slot } from '../shared/protocol.js';

const form = document.querySelector<HTMLFormElement>('#join-form')!;
const roomInput = document.querySelector<HTMLInputElement>('#room')!;
const joinButton = document.querySelector<HTMLButtonElement>('#join')!;
const readyButton = document.querySelector<HTMLButtonElement>('#ready')!;
const status = document.querySelector<HTMLElement>('#status')!;
const gameDisplay = document.querySelector<HTMLElement>('#game-status')!;
const storageStatus = document.querySelector<HTMLElement>('#storage-status')!;
const controls = [...document.querySelectorAll<HTMLButtonElement>('[data-control]')];
const credentials = new RoomCredentials(() => window.sessionStorage, () => {
  storageStatus.textContent = 'Session storage is unavailable. Recovery works only while this page stays open; reload recovery is not available.';
});
const retry = new RetryWindow();
let socket: WebSocket | undefined;
let slot: Slot | undefined;
let roomCode: string | undefined;
let key: string | undefined;
let game = false;
let mode: 'idle' | 'connecting' | 'connected' | 'recovering' | 'ended' = 'idle';
let latestStatus: GameStatus | undefined;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let connectTimer: ReturnType<typeof setTimeout> | undefined;
let pageHidden = false;
let sequence = 0;
let diagnosticId = 0;
let relayRtt = new RttWindow();
let tvRtt = new RttWindow();
const hidden = () => document.hidden || pageHidden;
const setStatus = (message: string) => { status.textContent = message; };
function send(message: ClientMessage) {
  if (socket?.readyState !== WebSocket.OPEN) return false;
  if (socket.bufferedAmount > 16 * 1024) { socket.close(); return false; }
  socket.send(JSON.stringify(message)); return true;
}
const input = new InputTracker(buttons => {
  for (const button of controls) button.dataset.held = String(buttons[button.dataset.control as keyof Buttons]);
  if (slot) send({ type: 'input', sequence: ++sequence, buttons });
});
function clearRetryTimer() { clearTimeout(retryTimer); retryTimer = undefined; }
function detach() {
  const old = socket;
  socket = undefined; // Old close/error/message callbacks can never affect the replacement.
  clearTimeout(connectTimer); connectTimer = undefined;
  old?.close();
}
function updateReady() {
  readyButton.hidden = !game;
  readyButton.disabled = !game || mode !== 'connected' || !slot || hidden()
    || latestStatus?.phase === 'playing' || latestStatus?.phase === 'cancelled';
  readyButton.textContent = latestStatus?.phase === 'finished' ? 'Ready for rematch'
    : latestStatus?.phase === 'paused' ? 'Confirm resume' : 'Ready to play';
}
function disable() {
  input.reset(); slot = undefined;
  for (const button of controls) button.disabled = true;
  readyButton.disabled = true;
  joinButton.disabled = false;
}
function enable() {
  mode = 'connected'; retry.reset(); clearRetryTimer(); joinButton.disabled = true;
  clearTimeout(connectTimer); connectTimer = undefined;
  for (const button of controls) button.disabled = hidden();
  updateReady();
  setStatus(`Player ${slot} connected. ${game ? 'Confirm readiness on both phones.' : 'Wait for both players on the TV.'}`);
  input.reset();
  if (game && hidden()) background();
}
function stop(message: string, clearSaved = false) {
  disable(); mode = 'ended'; clearRetryTimer(); detach(); retry.reset();
  if (clearSaved && roomCode) { credentials.clear(roomCode); key = undefined; }
  setStatus(message);
}
function recover() {
  clearRetryTimer();
  if (!game || !key || !roomCode) { stop('Disconnected. Ask the TV to create a new probe room. Slots are not reassigned.'); return; }
  mode = 'recovering'; retry.begin(performance.now());
  if (retry.expired(performance.now())) { stop('Recovery timed out after 60 seconds. Check the TV; no player slot was reassigned.'); return; }
  updateReady();
  setStatus(hidden() ? 'Game paused while this phone is in the background.' : 'Reconnecting the original player… Controls are disabled.');
  const delay = retry.delay(performance.now(), hidden());
  if (delay !== undefined) retryTimer = setTimeout(() => {
    retryTimer = undefined;
    if (hidden() || mode !== 'recovering') return;
    if (retry.expired(performance.now())) { recover(); return; }
    retry.attempted(performance.now());
    openConnection(true);
  }, delay);
}
function openConnection(resuming: boolean) {
  const code = roomCode!;
  const credential = key;
  const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  socket = ws; sequence = 0;
  let joined = false;
  connectTimer = setTimeout(() => {
    if (socket !== ws) return;
    disable(); detach();
    if (game && key) recover(); else stop('Connection timed out. Check HTTPS/WSS and the room code.');
  }, 5000);
  ws.addEventListener('open', () => {
    if (socket !== ws) return;
    if (resuming && credential) send({ type: 'resume', code, key: credential });
    else send({ type: 'join', code });
  });
  ws.addEventListener('message', event => {
    if (socket !== ws || typeof event.data !== 'string') return;
    const message = parseServerMessage(event.data);
    if (!message) { stop('Invalid server message. Check the room on the TV.'); return; }
    switch (message.type) {
      case 'joined':
        if (joined) { stop('Unexpected player assignment. Check the TV.'); return; }
        joined = true; slot = message.slot;
        // A resumed connection stays disabled until its rotated credential is persisted.
        if (!resuming) enable();
        break;
      case 'resumeKey':
        if (!joined) { stop('Unexpected recovery credential. Check the TV.'); return; }
        game = true; key = message.key;
        credentials.save(code, key); // Volatile fallback is set before any future reconnect.
        enable();
        break;
      case 'gameStatus': {
        latestStatus = message;
        const seconds = Math.ceil(message.remainingMs / 1000);
        gameDisplay.textContent = `${message.score[0]} – ${message.score[1]} · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} · ${message.phase}`;
        updateReady(); // Render TV values only: no local clock or score prediction.
        break;
      }
      case 'pong': relayRtt.acknowledge(message.id, performance.now()); break;
      case 'probeAck': tvRtt.acknowledge(message.id, performance.now()); break;
      case 'error':
        if (message.code === 'resume_busy' && resuming) {
          disable(); detach(); recover();
        } else {
          const invalidCredential = ['resume_invalid', 'room_unavailable'].includes(message.code);
          stop(`Cannot continue: ${message.code}. Check the room on the TV.`, invalidCredential);
        }
        break;
      case 'ended': stop(`Room ended: ${message.reason}. Enter a new TV room code.`, true); break;
    }
  });
  ws.addEventListener('close', () => {
    if (socket !== ws) return;
    disable(); detach();
    if (game && key) recover(); else stop('Disconnected. Ask the TV to create a new probe room. Slots are not reassigned.');
  });
  // close owns recovery; error must never leave controls held or create a second retry.
  ws.addEventListener('error', () => {
    if (socket !== ws) return;
    disable(); ws.close();
  });
}
function background() {
  input.reset();
  clearRetryTimer();
  if (game && socket) {
    disable(); detach(); recover();
  }
  updateReady();
}
function foreground() {
  if (mode === 'recovering' && !socket) recover();
  else if (mode === 'connected') {
    for (const button of controls) button.disabled = hidden();
    updateReady();
  }
}
for (const button of controls) {
  button.addEventListener('pointerdown', event => {
    if (!slot || mode !== 'connected' || hidden()) return;
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    input.press(event.pointerId, button.dataset.control as keyof Buttons);
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    button.addEventListener(name, event => input.release((event as PointerEvent).pointerId));
  }
  button.addEventListener('contextmenu', event => event.preventDefault());
}
readyButton.addEventListener('click', () => {
  if (!readyButton.disabled && slot && game && mode === 'connected' && !hidden()) {
    input.reset();
    if (send({ type: 'ready' })) setStatus(`Player ${slot} ready. Waiting for the TV and the other player.`);
  }
});
window.addEventListener('blur', () => input.reset());
window.addEventListener('pagehide', () => { pageHidden = true; background(); });
window.addEventListener('pageshow', () => { pageHidden = false; foreground(); });
document.addEventListener('visibilitychange', () => { if (hidden()) background(); else foreground(); });

const queryCode = new URLSearchParams(location.search).get('room');
if (queryCode && ROOM_CODE_PATTERN.test(queryCode.toUpperCase())) roomInput.value = queryCode.toUpperCase();
form.addEventListener('submit', event => {
  event.preventDefault();
  const code = roomInput.value.trim().toUpperCase();
  if (!ROOM_CODE_PATTERN.test(code)) { setStatus('Enter the 8-character room code shown on the TV.'); return; }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  if (location.protocol !== 'https:' && !local) { setStatus('HTTPS is required. Do not use an insecure network address.'); return; }
  disable(); clearRetryTimer(); detach(); retry.reset();
  storageStatus.textContent = '';
  roomCode = code; key = credentials.load(code); game = Boolean(key); latestStatus = undefined;
  gameDisplay.textContent = ''; updateReady();
  relayRtt = new RttWindow(); tvRtt = new RttWindow();
  mode = key ? 'recovering' : 'connecting'; joinButton.disabled = true;
  if (key) retry.begin(performance.now());
  setStatus(key ? 'Recovering the original player…' : 'Connecting…');
  openConnection(Boolean(key));
});
// QR/reload recovery is automatic only when this exact room has a session credential.
if (ROOM_CODE_PATTERN.test(roomInput.value) && credentials.load(roomInput.value)) form.requestSubmit();
setInterval(() => {
  if (!slot || mode !== 'connected' || hidden()) return;
  const buttons = input.snapshot();
  if (Object.values(buttons).some(Boolean)) send({ type: 'input', sequence: ++sequence, buttons });
}, 100);
setInterval(() => {
  const now = performance.now();
  if (mode === 'recovering' && retry.expired(now)) {
    stop('Recovery timed out after 60 seconds. Check the TV; no player slot was reassigned.');
  }
  relayRtt.expire(now); tvRtt.expire(now);
  if (slot && mode === 'connected' && !hidden()) {
    const id = ++diagnosticId;
    if (relayRtt.begin(id, now)) send({ type: 'ping', id });
    if (tvRtt.begin(id, now)) send({ type: 'probe', id });
  }
  document.querySelector('#relay-rtt')!.textContent = formatRtt(relayRtt);
  document.querySelector('#tv-rtt')!.textContent = formatRtt(tvRtt);
}, 1000);
