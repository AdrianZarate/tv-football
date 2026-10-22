import Phaser from 'phaser';
import QRCode from 'qrcode';
import { ProbeSimulation } from './model.js';
import { parseServerMessage, type ClientMessage } from '../shared/protocol.js';
import { RttWindow, formatRtt } from '../shared/metrics.js';

declare const __PUBLIC_ORIGIN__: string;
const publicOrigin = __PUBLIC_ORIGIN__;
const relayUrl = publicOrigin.replace(/^http/, 'ws') + '/ws';
const model = new ProbeSimulation();
const status = document.querySelector<HTMLElement>('#status')!;
const roomLabel = document.querySelector<HTMLElement>('#room')!;
const qr = document.querySelector<HTMLImageElement>('#qr')!;
const button = document.querySelector<HTMLButtonElement>('#new-room')!;
let socket: WebSocket | undefined;
let connected: [boolean, boolean] = [false, false];
let generation = 0;
let diagnosticId = 0;
let relayRtt = new RttWindow();
let lastMessage = 0;
let code = '';
let frameIntervals: number[] = [];
document.querySelector('#controller-url')!.textContent = publicOrigin;
document.querySelector('#endpoint')!.textContent = `Relay: ${relayUrl} · No automatic reconnection`;

function send(message: ClientMessage) {
  if (socket?.readyState !== WebSocket.OPEN) return;
  if (socket.bufferedAmount > 16 * 1024) { socket.close(); return; }
  socket.send(JSON.stringify(message));
}
function stop(message: string) {
  model.setConnected([false, false]); connected = [false, false];
  status.textContent = message;
  code = ''; roomLabel.textContent = '—'; qr.style.visibility = 'hidden';
  document.querySelector('#players')!.textContent = 'Players: 0 / 2';
}
function newRoom() {
  const current = ++generation;
  socket?.close();
  stop('Connecting to relay…'); relayRtt = new RttWindow();
  const ws = new WebSocket(relayUrl); socket = ws;
  ws.addEventListener('open', () => { if (current === generation) { lastMessage = performance.now(); send({ type: 'create' }); } });
  ws.addEventListener('message', event => {
    if (current !== generation || typeof event.data !== 'string') return;
    const message = parseServerMessage(event.data);
    if (!message) { stop('Invalid relay message. Create a new room.'); ws.close(); return; }
    lastMessage = performance.now();
    switch (message.type) {
      case 'created': {
        code = message.code; roomLabel.textContent = code;
        status.textContent = 'Waiting for two phones. Objects pause until both connect.';
        const roomCode = code;
        void QRCode.toDataURL(`${publicOrigin}/?room=${code}`, { width: 224, margin: 2, errorCorrectionLevel: 'M' }).then(url => {
          if (current !== generation || code !== roomCode) return;
          qr.src = url; qr.style.visibility = 'visible';
        }).catch(() => { status.textContent = 'QR unavailable. Use the URL and room code.'; });
        break;
      }
      case 'state':
        connected = message.connected; model.setConnected(connected);
        document.querySelector('#players')!.textContent = `Players: ${connected.filter(Boolean).length} / 2`;
        status.textContent = model.paused ? 'PAUSED — both phones must be connected. After a disconnect, create a new room.' : 'Both players connected. Test movement + Jump + Kick together.';
        break;
      case 'input': model.setInput(message.slot, message.buttons, performance.now()); break;
      case 'probe': send({ type: 'probeAck', slot: message.slot, id: message.id }); break;
      case 'pong': relayRtt.acknowledge(message.id, performance.now()); break;
      case 'error': stop(`Relay error: ${message.code}. Create a new room.`); ws.close(); break;
      case 'ended': stop(`Room ended: ${message.reason}. Create a new room.`); ws.close(); break;
    }
  });
  ws.addEventListener('error', () => { if (current === generation) stop('WSS connection failed. Check the domain, HTTPS certificate and relay origin settings.'); });
  ws.addEventListener('close', () => { if (current === generation) stop('Disconnected. Create a new room after restoring the connection.'); });
}
class ProbeScene extends Phaser.Scene {
  private squares: Phaser.GameObjects.Rectangle[] = [];
  private labels: Phaser.GameObjects.Text[] = [];
  create() {
    this.add.line(0, 0, 70, 210, 1210, 210, 0x456080).setOrigin(0);
    this.add.line(0, 0, 70, 450, 1210, 450, 0x456080).setOrigin(0);
    for (const [index, color] of [0x4db8ff, 0xffab56].entries()) {
      this.squares.push(this.add.rectangle(0, 0, 70, 70, color));
      this.labels.push(this.add.text(0, 0, `P${index + 1}`, { fontSize: '30px', color: '#ffffff' }).setOrigin(0.5));
    }
  }
  update(_time: number, delta: number) {
    if (delta > 0 && delta < 2000 && !document.hidden) {
      frameIntervals.push(delta); if (frameIntervals.length > 120) frameIntervals.shift();
    }
    model.step(delta / 1000, performance.now());
    for (const [i, object] of model.snapshot().entries()) {
      this.squares[i]?.setPosition(object.x, object.y).setStrokeStyle(object.kick ? 12 : 2, object.kick ? 0xfff36a : 0xffffff);
      this.labels[i]?.setPosition(object.x, object.y);
    }
  }
}
new Phaser.Game({
  type: Phaser.AUTO,
  width: 1280, height: 540,
  parent: 'stage', backgroundColor: '#15243b', scene: ProbeScene,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  audio: { noAudio: true },
});
button.addEventListener('click', newRoom); button.focus();
window.addEventListener('blur', () => model.clear());
window.addEventListener('pagehide', () => { model.clear(); socket?.close(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { model.clear(); socket?.close(); stop('TV app backgrounded. Create a new room when returning.'); }
});
setInterval(() => {
  const now = performance.now(); relayRtt.expire(now);
  if (socket?.readyState === WebSocket.OPEN && !document.hidden) {
    if (now - lastMessage > 6000) { stop('Relay stopped responding. Create a new room after checking the network.'); socket.close(); }
    else { const id = ++diagnosticId; if (relayRtt.begin(id, now)) send({ type: 'ping', id }); }
  }
  document.querySelector('#relay-rtt')!.textContent = `TV ↔ relay application RTT: ${formatRtt(relayRtt)}`;
  const sorted = [...frameIntervals].sort((a, b) => a - b);
  const p50 = sorted[Math.max(0, Math.ceil(sorted.length * 0.5) - 1)];
  const p95 = sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)];
  document.querySelector('#rendering')!.textContent = p50 === undefined ? 'Rendering interval: waiting' : `Observed scene update interval (not display latency): p50 ${p50.toFixed(1)} ms | p95 ${p95!.toFixed(1)} ms | n=${sorted.length}`;
}, 1000);
newRoom();
