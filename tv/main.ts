import Phaser from 'phaser';
import QRCode from 'qrcode';
import { GameScene } from '../game/scene.js';
import { FIELD } from '../game/model.js';
import { FootballHost, describeMatch, formatClock } from './host.js';
import { type ClientMessage } from '../shared/protocol.js';
import { RttWindow } from '../shared/metrics.js';
import { errorMessage, endedMessage, formatRttSpanish } from '../shared/messages.js';

declare const __PUBLIC_ORIGIN__: string;
const publicOrigin = __PUBLIC_ORIGIN__;
const relayUrl = publicOrigin.replace(/^http/, 'ws') + '/ws';
const status = document.querySelector<HTMLElement>('#status')!;
const roomLabel = document.querySelector<HTMLElement>('#room')!;
const qr = document.querySelector<HTMLImageElement>('#qr')!;
const button = document.querySelector<HTMLButtonElement>('#new-room')!;
const clock = document.querySelector<HTMLElement>('#clock')!;
const scoreP1 = document.querySelector<HTMLElement>('#score-p1')!;
const scoreP2 = document.querySelector<HTMLElement>('#score-p2')!;
const goalBanner = document.querySelector<HTMLElement>('#goal-banner')!;
const debug = new URLSearchParams(location.search).get('debug') === '1';
document.querySelector<HTMLElement>('#diagnostics')!.hidden = !debug;
let socket: WebSocket | undefined;
let generation = 0;
let displayedScore: [number, number] = [0, 0];
let goalGeneration = 0;
let goalUntil = 0;
let diagnosticId = 0;
let relayRtt = new RttWindow();
let lastMessage = 0;
let code = '';
// Initial visibility is not room loss. Only a created response completes first launch.
let initialRoomPending = true;
let pageHidden = false;
const hidden = () => document.hidden || pageHidden;
const frameIntervals: number[] = [];
const host = new FootballHost(send, () => performance.now());
document.querySelector('#controller-url')!.textContent = publicOrigin;
if (debug) text(document.querySelector<HTMLElement>('#endpoint')!, `Servidor de enlace: ${relayUrl} · La TV no recupera partidas terminadas`);

function send(message: ClientMessage) {
  if (socket?.readyState !== WebSocket.OPEN) return;
  if (socket.bufferedAmount > 16 * 1024) {
    stop('La conexión con el servidor es demasiado lenta. Seleccioná Nueva sala.');
    return;
  }
  socket.send(JSON.stringify(message));
}
function text(element: HTMLElement, value: string) {
  if (element.textContent !== value) element.textContent = value;
}
function clearGoal() {
  goalUntil = 0;
  goalBanner.hidden = true;
  text(goalBanner, '');
}
function renderStatus() {
  const state = host.snapshot();
  const now = performance.now();
  text(clock, formatClock(state.remainingMs));
  text(scoreP1, `P1 azul: ${state.score[0]}`);
  text(scoreP2, `P2 naranja: ${state.score[1]}`);
  const reset = goalGeneration !== generation || state.score.some((value, index) => value < displayedScore[index]!)
    || state.phase === 'lobby' || state.phase === 'finished' || state.phase === 'cancelled';
  if (reset) clearGoal();
  else if (code && state.score.some((value, index) => value > displayedScore[index]!)) {
    // Only the authoritative model's credited score matters, never last touch or network text.
    text(goalBanner, `¡GOOOLLL! ${state.score[0] > displayedScore[0] ? 'P1 azul' : 'P2 naranja'}`);
    goalBanner.hidden = false;
    goalUntil = now + 1200;
  } else if (now >= goalUntil) clearGoal();
  displayedScore = [...state.score];
  goalGeneration = generation;
  if (code) text(status, describeMatch(state, now));
  // Collapse only once play begins. The full logical pitch is always visible, never cropped.
  if (document.body.dataset.phase !== state.phase) document.body.dataset.phase = state.phase;
}
function stop(message: string) {
  const old = socket;
  socket = undefined; // Stale socket callbacks cannot end a replacement room.
  host.endRoom(generation);
  code = ''; roomLabel.textContent = '—'; qr.removeAttribute('src'); qr.style.visibility = 'hidden';
  renderStatus();
  status.textContent = message;
  old?.close(); // Graceful owner close tells the relay to end all old controllers.
}
function newRoom() {
  stop('Conectando con el servidor de juego…');
  if (hidden()) { status.textContent = 'Volvé a la aplicación de TV para conectar. Si la sala terminó, seleccioná Nueva sala.'; return; }
  const current = generation = host.newRoom();
  relayRtt = new RttWindow(); frameIntervals.length = 0;
  renderStatus();
  const ws = new WebSocket(relayUrl); socket = ws;
  lastMessage = performance.now();
  const ownsRoom = () => current === generation && socket === ws;
  ws.addEventListener('open', () => {
    if (!ownsRoom()) return;
    lastMessage = performance.now();
    send({ type: 'createGame' });
  });
  ws.addEventListener('message', event => {
    if (!ownsRoom() || typeof event.data !== 'string') return;
    // Host parses through the shared validator and replies to probes before UI/render work.
    const message = host.receive(event.data, current);
    if (!message) { stop('Mensaje del servidor no válido. Seleccioná Nueva sala.'); return; }
    if (!ownsRoom()) return;
    lastMessage = performance.now();
    switch (message.type) {
      case 'created': {
        initialRoomPending = false;
        code = message.code; roomLabel.textContent = code;
        const roomCode = code;
        void QRCode.toDataURL(`${publicOrigin}/?room=${code}`, { width: 224, margin: 2, errorCorrectionLevel: 'M' }).then(url => {
          if (!ownsRoom() || code !== roomCode) return;
          qr.src = url; qr.style.visibility = 'visible';
        }).catch(() => {
          if (!ownsRoom() || code !== roomCode) return;
          document.querySelector('#join-help')!.textContent = 'QR no disponible. Abrí la dirección e ingresá el código de sala.';
        });
        document.querySelector('#join-help')!.textContent = 'Escaneá con cada teléfono, o abrí la dirección e ingresá el código de sala.';
        break;
      }
      case 'pong': relayRtt.acknowledge(message.id, performance.now()); break;
      case 'error': stop(`${errorMessage(message.code)} Seleccioná Nueva sala.`); return;
      case 'ended': stop(endedMessage(message.reason)); return;
    }
    renderStatus();
  });
  ws.addEventListener('error', () => {
    if (ownsRoom()) stop('Falló la conexión WSS. Revisá HTTPS y la configuración del servidor; después seleccioná Nueva sala.');
  });
  ws.addEventListener('close', () => {
    if (ownsRoom()) stop('La TV se desconectó. Restablecé la conexión y seleccioná Nueva sala. La partida anterior terminó.');
  });
}

/** Single write thread: advance the TV model once, then draw that exact snapshot. */
class HostedGameScene extends GameScene {
  private lastUpdate = performance.now();
  constructor() { super(() => host.snapshot()); }
  update(): void {
    // Phaser may smooth/clamp its delta; the match clock needs the full active interval.
    const now = performance.now();
    const delta = now - this.lastUpdate;
    this.lastUpdate = now;
    if (debug && delta > 0 && delta < 2000 && !hidden()) {
      frameIntervals.push(delta); if (frameIntervals.length > 120) frameIntervals.shift();
    }
    host.update(delta / 1000);
    super.update();
    renderStatus();
  }
}
new Phaser.Game({
  type: Phaser.AUTO, width: FIELD.width, height: FIELD.height,
  parent: 'stage', backgroundColor: '#172940', scene: [new HostedGameScene()],
  // Phaser 3.90 uses these logical dimensions directly, with CSS-only FIT scaling (no DPR multiplier).
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, zoom: 1 },
  audio: { noAudio: true },
  fps: { target: 30, limit: 30 },
  render: { antialias: true, antialiasGL: false },
  input: { keyboard: false }, // Phones own gameplay input; DOM owns the remote button.
});
let enterHeld = false;
let suppressNativeClick = false;
const isEnter = (event: KeyboardEvent) => event.key === 'Enter' || (!event.key && event.keyCode === 13);
const roomFocus = () => document.activeElement === button || document.activeElement === document.body
  || document.activeElement?.tagName === 'CANVAS';
function restoreFocus() {
  if (!hidden() && roomFocus()) button.focus();
}
document.addEventListener('keydown', event => {
  if (!isEnter(event)) {
    // Space retains native button activation; unrelated/system keys never change Enter ownership.
    if (event.key === ' ' && document.activeElement === button && !enterHeld) suppressNativeClick = false;
    return;
  }
  if (hidden() || !roomFocus() || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  event.preventDefault(); // Only the Enter press owned by Nueva sala is consumed.
  if (event.repeat || enterHeld) return;
  enterHeld = true; suppressNativeClick = true;
  button.focus(); newRoom();
});
document.addEventListener('keyup', event => {
  if (!isEnter(event) || !enterHeld) return;
  event.preventDefault(); enterHeld = false;
});
button.addEventListener('click', event => {
  // Native keyboard click can arrive on keydown or keyup. Pointer clicks remain independent.
  if (event.detail === 0 && suppressNativeClick) return;
  suppressNativeClick = false;
  newRoom();
});
window.addEventListener('blur', () => { enterHeld = false; });
window.addEventListener('focus', restoreFocus);
button.focus();
// TV loss ends the room; only phones can resume an existing player session.
function foreground() {
  if (!hidden() && initialRoomPending && !socket) newRoom();
  restoreFocus();
}
window.addEventListener('pagehide', () => {
  pageHidden = true;
  stop('La aplicación de TV se cerró. Al volver, seleccioná Nueva sala.');
});
window.addEventListener('pageshow', () => { pageHidden = false; foreground(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stop('La aplicación de TV pasó a segundo plano. La partida terminó; al volver, seleccioná Nueva sala.');
  else foreground();
});
setInterval(() => {
  const now = performance.now(); relayRtt.expire(now);
  if (socket && !hidden()) {
    if (now - lastMessage > 6000) stop('El servidor dejó de responder. Revisá la red y seleccioná Nueva sala.');
    else if (socket.readyState === WebSocket.OPEN) {
      const id = ++diagnosticId;
      if (relayRtt.begin(id, now)) send({ type: 'ping', id });
    }
  }
  if (!debug) return;
  text(document.querySelector<HTMLElement>('#relay-rtt')!, `RTT de aplicación TV ↔ servidor: ${formatRttSpanish(relayRtt)}`);
  const sorted = [...frameIntervals].sort((a, b) => a - b);
  const p50 = sorted[Math.max(0, Math.ceil(sorted.length * 0.5) - 1)];
  const p95 = sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)];
  text(document.querySelector<HTMLElement>('#rendering')!, p50 === undefined ? 'Intervalo de dibujo: esperando muestras' : `Intervalo observado entre actualizaciones (no es latencia de pantalla): p50 ${p50.toFixed(1)} ms | p95 ${p95!.toFixed(1)} ms | muestras=${sorted.length}`);
}, 1000);
newRoom();
