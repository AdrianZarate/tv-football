import type { GamePhase } from './protocol.js';
import type { RttWindow } from './metrics.js';

const errors: Record<string, string> = {
  rate_limited: 'Se enviaron demasiados mensajes. Volvé a conectar.',
  binary_not_allowed: 'El formato del mensaje no está permitido.',
  invalid_message: 'Se recibió un mensaje no válido.',
  role_locked: 'Esta conexión ya tiene un rol asignado.',
  room_unavailable: 'La sala no está disponible. Creá una Nueva sala en la TV.',
  resume_invalid: 'No se pudo recuperar este jugador. Revisá la sala en la TV.',
  resume_busy: 'La conexión anterior sigue abierta. Esperá mientras se vuelve a conectar.',
  room_limit: 'El servidor alcanzó el límite de salas. Intentá más tarde.',
  room_full: 'La sala ya tiene dos lugares reservados. Usá los teléfonos originales.',
  not_assigned: 'Esta conexión no tiene un jugador asignado.',
  tv_only: 'Solo la TV de esta sala puede realizar esa acción.',
  game_only: 'Esta acción requiere una sala de juego.',
  game_phone_only: 'Esta acción requiere un teléfono asignado a la partida.',
  phone_only: 'Solo un teléfono asignado puede realizar esa acción.',
  stale_sequence: 'El mensaje de controles está desactualizado.',
  probe_limit: 'Hay demasiadas mediciones pendientes.',
  unknown_probe: 'La medición ya venció o no está disponible.',
};
const endings: Record<string, string> = {
  tv_disconnected: 'La TV se desconectó y la sala terminó. Creá una Nueva sala en la TV.',
  room_expired: 'La sala venció. Creá una Nueva sala en la TV.',
};
// Only allowlisted text is displayed: unknown codes may contain sensitive data.
export function errorMessage(code: string): string {
  return Object.prototype.hasOwnProperty.call(errors, code) ? errors[code]! : 'No se pudo continuar. Revisá la sala en la TV.';
}
export function endedMessage(reason: string): string {
  return Object.prototype.hasOwnProperty.call(endings, reason) ? endings[reason]! : 'La sala terminó. Creá una Nueva sala en la TV.';
}
export function phaseLabel(phase: GamePhase): string {
  return { lobby: 'Esperando jugadores', playing: 'En juego', paused: 'En pausa', finished: 'Finalizado', cancelled: 'Cancelado' }[phase];
}
export function formatRttSpanish(window: RttWindow): string {
  const stats = window.stats();
  const ms = (value: number | null) => value === null ? '—' : `${Math.round(value)} ms`;
  return `muestras=${stats.n} | última ${ms(stats.latest)} | p50 ${ms(stats.median)} | p95 ${ms(stats.p95)} | variación (p95−p50) ${ms(stats.variation)} | esperas agotadas ${stats.timeouts}`;
}
