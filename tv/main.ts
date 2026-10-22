import Phaser from 'phaser';
import QRCode from 'qrcode';
import { GameScene } from '../game/scene.js';
import { FIELD } from '../game/model.js';
import { FootballHost, describeMatch, formatClock } from './host.js';
import { type ClientMessage } from '../shared/protocol.js';
import { RttWindow, formatRtt } from '../shared/metrics.js';

declare const __PUBLIC_ORIGIN__: string;
const publicOrigin = __PUBLIC_ORIGIN__;
const relayUrl = publicOrigin.replace(/^http/, 'ws') + '/ws';
const status = document.querySelector<HTMLElement>('#status')!;
const roomLabel = document.querySelector<HTMLElement>('#room')!;
const qr = document.querySelector<HTMLImageElement>('#qr')!;
const button = document.querySelector<HTMLButtonElement>('#new-room')!;
const clock = document.querySelector<HTMLElement>('#clock')!;
const players = document.querySelector<HTMLElement>('#players')!;
let socket: WebSocket | undefined;
let generation = 0;
let diagnosticId = 0;
let relayRtt = new RttWindow();
let lastMessage = 0;
let code = '';
const frameIntervals: number[] = [];
const host = new FootballHost(send, () => performance.now());
document.querySelector('#controller-url')!.textContent = publicOrigin;
document.querySelector('#endpoint')!.textContent = `Relay: ${relayUrl} · TV room recovery is not supported`;

function send(message: ClientMessage) {
  if (socket?.readyState !== WebSocket.OPEN) return;
  if (socket.bufferedAmount > 16 * 1024) {
    stop('Relay connection is too slow. New room needed.');
    return;
  }
  socket.send(JSON.stringify(message));
}
function text(element: HTMLElement, value: string) {
  if (element.textContent !== value) element.textContent = value;
}
function renderStatus() {
  const state = host.snapshot();
  text(clock, formatClock(state.remainingMs));
  text(players, state.connected.map((present, i) => `P${i + 1} ${!present ? 'offline' : state.ready[i] ? 'ready' : 'connected'}`).join(' · '));
  if (code) text(status, describeMatch(state, performance.now()));
  // Collapse only once play begins. The full logical pitch is always visible, never cropped.
  document.body.dataset.phase = state.phase;
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
  stop('Connecting to game relay…');
  if (document.hidden) { status.textContent = 'Return to the TV app, then select New room.'; return; }
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
    if (!message) { stop('Invalid relay message. New room needed.'); return; }
    if (!ownsRoom()) return;
    lastMessage = performance.now();
    switch (message.type) {
      case 'created': {
        code = message.code; roomLabel.textContent = code;
        const roomCode = code;
        void QRCode.toDataURL(`${publicOrigin}/?room=${code}`, { width: 224, margin: 2, errorCorrectionLevel: 'M' }).then(url => {
          if (!ownsRoom() || code !== roomCode) return;
          qr.src = url; qr.style.visibility = 'visible';
        }).catch(() => {
          if (!ownsRoom() || code !== roomCode) return;
          document.querySelector('#join-help')!.textContent = 'QR unavailable. Open the URL and enter the room code.';
        });
        document.querySelector('#join-help')!.textContent = 'Scan on each phone, or open the URL and enter the room code.';
        break;
      }
      case 'pong': relayRtt.acknowledge(message.id, performance.now()); break;
      case 'error': stop(`Relay error: ${message.code}. New room needed.`); return;
      case 'ended': stop(`Room ended: ${message.reason}. New room needed.`); return;
    }
    renderStatus();
  });
  ws.addEventListener('error', () => {
    if (ownsRoom()) stop('WSS connection failed. Check HTTPS and relay settings; then select New room.');
  });
  ws.addEventListener('close', () => {
    if (ownsRoom()) stop('TV disconnected. Restore the connection, then select New room. No match recovery.');
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
    if (delta > 0 && delta < 2000 && !document.hidden) {
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
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  audio: { noAudio: true },
});
button.addEventListener('click', newRoom); button.focus();
// TV loss ends the room; only phones can resume an existing player session.
window.addEventListener('pagehide', () => stop('TV app closed. Select New room when returning.'));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stop('TV app backgrounded. Select New room when returning; the previous match ended.');
});
setInterval(() => {
  const now = performance.now(); relayRtt.expire(now);
  if (socket && !document.hidden) {
    if (now - lastMessage > 6000) stop('Relay stopped responding. Check the network, then select New room.');
    else if (socket.readyState === WebSocket.OPEN) {
      const id = ++diagnosticId;
      if (relayRtt.begin(id, now)) send({ type: 'ping', id });
    }
  }
  text(document.querySelector<HTMLElement>('#relay-rtt')!, `TV ↔ relay application RTT: ${formatRtt(relayRtt)}`);
  const sorted = [...frameIntervals].sort((a, b) => a - b);
  const p50 = sorted[Math.max(0, Math.ceil(sorted.length * 0.5) - 1)];
  const p95 = sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)];
  text(document.querySelector<HTMLElement>('#rendering')!, p50 === undefined ? 'Rendering interval: waiting' : `Observed scene update interval (not display latency): p50 ${p50.toFixed(1)} ms | p95 ${p95!.toFixed(1)} ms | n=${sorted.length}`);
}, 1000);
newRoom();
