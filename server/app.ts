import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';
import { parseClientMessage, neutralButtons, MAX_MESSAGE_BYTES, INPUT_LEASE_MS, type Slot, type Buttons, type ServerMessage } from '../shared/protocol.js';

export interface RelayOptions {
  publicOrigin: string;
  allowTvOpaqueOrigin?: boolean;
  devInsecure?: boolean;
  maxConnections?: number;
  maxRooms?: number;
  maxMessagesPerSecond?: number;
  roomTtlMs?: number;
  inputLeaseMs?: number;
  handshakeTimeoutMs?: number;
  staticRoot?: string;
}
interface Peer {
  ws: WebSocket;
  role: 'unassigned' | 'tv' | 'phone';
  room?: Room;
  slot?: Slot;
  sequence: number;
  rateStart: number;
  count: number;
  opened: number;
  alive: boolean;
}
interface Player {
  peer: Peer;
  buttons: Buttons;
  updated: number;
  probes: Map<number, number>;
}
interface Room { code: string; tv: Peer; players: [Player?, Player?]; created: number }
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function createRelay(options: RelayOptions) {
  const origin = new URL(options.publicOrigin);
  if (origin.origin !== options.publicOrigin || (origin.protocol !== 'https:' && !(options.devInsecure && origin.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(origin.hostname)))) {
    throw new Error('PUBLIC_ORIGIN must be an HTTPS origin (localhost HTTP only in explicit development mode)');
  }
  const limits = {
    connections: options.maxConnections ?? 100,
    rooms: options.maxRooms ?? 20,
    rate: options.maxMessagesPerSecond ?? 80,
    ttl: options.roomTtlMs ?? 30 * 60_000,
    lease: options.inputLeaseMs ?? INPUT_LEASE_MS,
    handshake: options.handshakeTimeoutMs ?? 10_000,
  };
  for (const value of Object.values(limits)) if (!Number.isSafeInteger(value) || value <= 0) throw new Error('Limits must be positive integers');
  const peers = new Set<Peer>();
  const rooms = new Map<string, Room>();
  const root = resolve(options.staticRoot ?? 'dist');
  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'");
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
    const pathname = (req.url ?? '').split('?')[0];
    if (pathname === '/healthz') { res.setHeader('Content-Type', 'application/json'); res.end(req.method === 'HEAD' ? undefined : '{"ok":true}'); return; }
    let decoded: string;
    try { decoded = decodeURIComponent(pathname ?? ''); } catch { res.writeHead(404).end(); return; }
    if (decoded.includes('..') || decoded.includes('\\') || decoded.includes('\0')) { res.writeHead(404).end(); return; }
    const isTv = decoded === '/tv' || decoded.startsWith('/tv/');
    const relative = isTv ? decoded.slice(3) : decoded;
    const asset = relative === '' || relative === '/' ? 'index.html' : relative.replace(/^\//, '');
    // Only generated client assets are public; never serve repository files.
    const base = resolve(root, isTv ? 'tv' : 'controller');
    const file = resolve(base, asset);
    const types: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png' };
    const mime = types[extname(file)];
    if (!file.startsWith(base + sep) || !mime) { res.writeHead(404).end(); return; }
    try {
      const body = await readFile(file);
      res.setHeader('Content-Type', mime); res.end(req.method === 'HEAD' ? undefined : body);
    } catch { res.writeHead(404).end(); }
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES, perMessageDeflate: false });
  server.on('upgrade', (req, socket, head) => {
    const requestOrigin = req.headers.origin;
    const opaque = options.allowTvOpaqueOrigin && (requestOrigin === undefined || requestOrigin === 'null');
    if (req.url !== '/ws' || (!opaque && requestOrigin !== options.publicOrigin) || peers.size >= limits.connections) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return;
    }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws));
  });
  function send(peer: Peer, message: ServerMessage) {
    if (peer.ws.readyState !== WebSocket.OPEN) return;
    if (peer.ws.bufferedAmount > 64 * 1024) { peer.ws.terminate(); return; }
    peer.ws.send(JSON.stringify(message));
  }
  function fail(peer: Peer, code: string, close = false) {
    send(peer, { type: 'error', code });
    if (close) peer.ws.close(1008, code);
  }
  function state(room: Room) {
    send(room.tv, { type: 'state', connected: room.players.map(p => Boolean(p && p.peer.ws.readyState === WebSocket.OPEN)) as [boolean, boolean] });
  }
  function neutral(room: Room, slot: Slot) {
    const player = room.players[slot - 1];
    if (!player) return;
    player.buttons = neutralButtons();
    send(room.tv, { type: 'input', slot, sequence: Math.max(player.peer.sequence, 0), buttons: player.buttons });
  }
  function end(room: Room, reason: string) {
    if (!rooms.delete(room.code)) return;
    for (const peer of [room.tv, ...room.players.map(p => p?.peer)]) {
      if (!peer) continue;
      peer.room = undefined;
      send(peer, { type: 'ended', reason }); peer.ws.close(1000, reason);
    }
  }
  wss.on('connection', (ws: WebSocket) => {
    const peer: Peer = { ws, role: 'unassigned', sequence: -1, rateStart: Date.now(), count: 0, opened: Date.now(), alive: true };
    peers.add(peer);
    ws.on('error', () => { /* close handler owns lifecycle cleanup */ });
    ws.on('pong', () => { peer.alive = true; });
    ws.on('close', () => {
      peers.delete(peer);
      const room = peer.room;
      if (!room) return;
      if (peer.role === 'tv') end(room, 'tv_disconnected');
      else if (peer.slot) { neutral(room, peer.slot); room.players[peer.slot - 1]?.probes.clear(); state(room); }
    });
    ws.on('message', (raw, binary) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      const now = Date.now();
      if (now - peer.rateStart >= 1000) { peer.rateStart = now; peer.count = 0; }
      if (++peer.count > limits.rate) { fail(peer, 'rate_limited', true); return; }
      if (binary) { fail(peer, 'binary_not_allowed', true); return; }
      const message = parseClientMessage(raw.toString());
      if (!message) { fail(peer, 'invalid_message', true); return; }
      if (message.type === 'ping') { send(peer, { type: 'pong', id: message.id }); return; }
      if (message.type === 'create' || message.type === 'join') {
        if (peer.role !== 'unassigned') { fail(peer, 'role_locked'); return; }
        if (message.type === 'create') {
          if (rooms.size >= limits.rooms) { fail(peer, 'room_limit'); return; }
          let code: string;
          do { code = Array.from(randomBytes(8), b => alphabet[b % alphabet.length]).join(''); } while (rooms.has(code));
          const room: Room = { code, tv: peer, players: [], created: now };
          // Keep the array's length exactly two, including unoccupied slots.
          room.players = [undefined, undefined];
          peer.role = 'tv'; peer.room = room; rooms.set(code, room);
          send(peer, { type: 'created', code }); state(room); return;
        }
        const room = rooms.get(message.code);
        if (!room) { fail(peer, 'room_unavailable', true); return; }
        const index = room.players.findIndex(p => p === undefined);
        if (index === -1) { fail(peer, 'room_full', true); return; }
        peer.role = 'phone'; peer.room = room; peer.slot = (index + 1) as Slot;
        room.players[index] = { peer, buttons: neutralButtons(), updated: now, probes: new Map() };
        send(peer, { type: 'joined', slot: peer.slot }); state(room); return;
      }
      const room = peer.room;
      if (!room || !rooms.has(room.code)) { fail(peer, 'not_assigned', true); return; }
      if (message.type === 'input' || message.type === 'probe') {
        if (peer.role !== 'phone' || !peer.slot) { fail(peer, 'phone_only'); return; }
        const player = room.players[peer.slot - 1]!;
        if (message.type === 'input') {
          if (message.sequence <= peer.sequence) { fail(peer, 'stale_sequence'); return; }
          peer.sequence = message.sequence; player.buttons = { ...message.buttons }; player.updated = now;
          send(room.tv, { ...message, slot: peer.slot }); return;
        }
        if (player.probes.has(message.id) || player.probes.size >= 8) { fail(peer, 'probe_limit'); return; }
        player.probes.set(message.id, now);
        send(room.tv, { type: 'probe', slot: peer.slot, id: message.id }); return;
      }
      if (message.type === 'probeAck') {
        if (peer !== room.tv) { fail(peer, 'tv_only'); return; }
        const player = room.players[message.slot - 1];
        const started = player?.probes.get(message.id);
        if (started === undefined || now - started > 5000) { fail(peer, 'unknown_probe'); return; }
        player!.probes.delete(message.id);
        send(player!.peer, { type: 'probeAck', id: message.id });
      }
    });
  });
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const peer of peers) if (peer.role === 'unassigned' && now - peer.opened > limits.handshake) peer.ws.close(1008, 'handshake_timeout');
    for (const room of rooms.values()) {
      if (now - room.created > limits.ttl) { end(room, 'room_expired'); continue; }
      for (const [index, player] of room.players.entries()) {
        if (!player) continue;
        if (now - player.updated > limits.lease && Object.values(player.buttons).some(Boolean)) neutral(room, (index + 1) as Slot);
        for (const [id, started] of player.probes) if (now - started > 5000) player.probes.delete(id);
      }
    }
  }, 25);
  const heartbeat = setInterval(() => {
    for (const peer of peers) {
      if (!peer.alive) { peer.ws.terminate(); continue; }
      peer.alive = false; peer.ws.ping();
    }
  }, 10_000);
  sweep.unref(); heartbeat.unref();
  return {
    server,
    async close() {
      clearInterval(sweep); clearInterval(heartbeat);
      for (const peer of peers) peer.ws.terminate();
      await new Promise<void>(resolveClose => wss.close(() => resolveClose()));
      if (server.listening) await new Promise<void>((resolveClose, reject) => server.close(error => error ? reject(error) : resolveClose()));
    },
  };
}
