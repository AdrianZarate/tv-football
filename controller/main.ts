import { InputTracker } from './input.js';
import { RttWindow, formatRtt } from '../shared/metrics.js';
import { parseServerMessage, ROOM_CODE_PATTERN, type Buttons, type ClientMessage, type Slot } from '../shared/protocol.js';

const form = document.querySelector<HTMLFormElement>('#join-form')!;
const roomInput = document.querySelector<HTMLInputElement>('#room')!;
const joinButton = document.querySelector<HTMLButtonElement>('#join')!;
const status = document.querySelector<HTMLElement>('#status')!;
const controls = [...document.querySelectorAll<HTMLButtonElement>('[data-control]')];
let socket: WebSocket | undefined;
let slot: Slot | undefined;
let sequence = 0;
let diagnosticId = 0;
let relayRtt = new RttWindow();
let tvRtt = new RttWindow();
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
function disable() {
  input.reset(); slot = undefined;
  for (const button of controls) button.disabled = true;
  joinButton.disabled = false;
}
for (const button of controls) {
  button.addEventListener('pointerdown', event => {
    if (!slot || document.hidden) return;
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    input.press(event.pointerId, button.dataset.control as keyof Buttons);
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    button.addEventListener(name, event => input.release((event as PointerEvent).pointerId));
  }
  button.addEventListener('contextmenu', event => event.preventDefault());
}
// No lifecycle event relies on a final packet arriving: relay and TV leases also expire.
window.addEventListener('blur', () => input.reset());
window.addEventListener('pagehide', () => input.reset());
document.addEventListener('visibilitychange', () => { if (document.hidden) input.reset(); });

const queryCode = new URLSearchParams(location.search).get('room');
if (queryCode && ROOM_CODE_PATTERN.test(queryCode.toUpperCase())) roomInput.value = queryCode.toUpperCase();
form.addEventListener('submit', event => {
  event.preventDefault();
  const code = roomInput.value.trim().toUpperCase();
  if (!ROOM_CODE_PATTERN.test(code)) { setStatus('Enter the 8-character room code shown on the TV.'); return; }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  if (location.protocol !== 'https:' && !local) { setStatus('HTTPS is required. Do not use an insecure network address.'); return; }
  if (socket && socket.readyState !== WebSocket.CLOSED) socket.close();
  disable(); joinButton.disabled = true;
  relayRtt = new RttWindow(); tvRtt = new RttWindow(); sequence = 0;
  const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  socket = ws;
  setStatus('Connecting…');
  ws.addEventListener('open', () => { if (socket === ws) send({ type: 'join', code }); });
  ws.addEventListener('message', event => {
    if (socket !== ws || typeof event.data !== 'string') return;
    const message = parseServerMessage(event.data);
    if (!message) { disable(); ws.close(); setStatus('Invalid server message. Create a new room on the TV.'); return; }
    switch (message.type) {
      case 'joined':
        slot = message.slot;
        for (const button of controls) button.disabled = false;
        setStatus(`Player ${slot} connected. Wait for both players on the TV.`);
        input.reset(); break;
      case 'pong': relayRtt.acknowledge(message.id, performance.now()); break;
      case 'probeAck': tvRtt.acknowledge(message.id, performance.now()); break;
      case 'error': disable(); ws.close(); setStatus(`Cannot continue: ${message.code}. Create a new room on the TV.`); break;
      case 'ended': disable(); ws.close(); setStatus(`Room ended: ${message.reason}. Create a new room on the TV.`); break;
    }
  });
  ws.addEventListener('close', () => {
    if (socket !== ws) return;
    disable(); setStatus('Disconnected. Ask the TV to create a new room. Slots are not reassigned.');
  });
  ws.addEventListener('error', () => { if (socket === ws) setStatus('Connection failed. Check HTTPS/WSS and the room code.'); });
});
setInterval(() => {
  if (!slot || document.hidden) return;
  const buttons = input.snapshot();
  if (Object.values(buttons).some(Boolean)) send({ type: 'input', sequence: ++sequence, buttons });
}, 100);
setInterval(() => {
  const now = performance.now();
  relayRtt.expire(now); tvRtt.expire(now);
  if (slot && !document.hidden) {
    const id = ++diagnosticId;
    if (relayRtt.begin(id, now)) send({ type: 'ping', id });
    if (tvRtt.begin(id, now)) send({ type: 'probe', id });
  }
  document.querySelector('#relay-rtt')!.textContent = formatRtt(relayRtt);
  document.querySelector('#tv-rtt')!.textContent = formatRtt(tvRtt);
}, 1000);
