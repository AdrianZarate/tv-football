import { BALL, FIELD, PLAYER, type MatchSnapshot } from '../game/model.js';

/** Native snapshot view: no simulation, timers, fonts, external assets or WebGL. */
export function createCanvasRenderer(parent: HTMLElement, create = () => document.createElement('canvas')) {
  const canvas = create();
  let background: HTMLCanvasElement | undefined;
  const release = () => {
    canvas.remove(); canvas.width = canvas.height = 0;
    if (background) background.width = background.height = 0;
  };
  let context: CanvasRenderingContext2D;
  try {
    canvas.width = FIELD.width; canvas.height = FIELD.height;
    const visible = canvas.getContext('2d');
    if (!visible) throw new Error('Canvas2D no disponible');
    context = visible;
    background = create(); background.width = FIELD.width; background.height = FIELD.height;
    const art = background.getContext('2d');
    if (!art) throw new Error('Canvas2D no disponible');
    // A single static backing store, baked once. No stadium, lights or animated decoration.
    art.fillStyle = '#102b25'; art.fillRect(0, 0, FIELD.width, FIELD.height);
    art.fillStyle = '#1b5b3d'; art.fillRect(FIELD.left, FIELD.top, FIELD.right - FIELD.left, FIELD.floor - FIELD.top);
    art.strokeStyle = '#edf4ff'; art.lineWidth = 4;
    art.strokeRect(FIELD.left, FIELD.top, FIELD.right - FIELD.left, FIELD.floor - FIELD.top);
    art.beginPath(); art.moveTo(FIELD.width / 2, FIELD.top); art.lineTo(FIELD.width / 2, FIELD.floor); art.stroke();
    art.beginPath(); art.arc(FIELD.width / 2, (FIELD.top + FIELD.floor) / 2, 70, 0, Math.PI * 2); art.stroke();
    art.strokeRect(12, FIELD.goalTop, FIELD.left - 12, FIELD.floor - FIELD.goalTop);
    art.strokeRect(FIELD.right, FIELD.goalTop, FIELD.width - FIELD.right - 12, FIELD.floor - FIELD.goalTop);
    canvas.setAttribute('aria-label', 'Cancha: P1 azul y P2 naranja');
    parent.appendChild(canvas);
  } catch (error) { release(); throw error; }
  let destroyed = false;
  let pose = '';
  return {
    draw(state: MatchSnapshot): boolean {
      if (destroyed) return false;
      // The visual identity excludes readiness, score, clock, velocities and input leases.
      const next = [...state.players.flatMap(player => [player.x, player.y, player.facing]), state.ball.x, state.ball.y].join(',');
      if (next === pose) return false;
      context.drawImage(background!, 0, 0);
      for (const player of state.players) {
        context.fillStyle = player.slot === 1 ? '#389dff' : '#ff9845';
        context.fillRect(player.x - PLAYER.halfWidth, player.y - PLAYER.height, PLAYER.halfWidth * 2, PLAYER.height);
        context.strokeStyle = '#0c1423'; context.lineWidth = 3;
        context.strokeRect(player.x - PLAYER.halfWidth, player.y - PLAYER.height, PLAYER.halfWidth * 2, PLAYER.height);
        context.fillStyle = '#ffffff'; context.fillRect(player.x + player.facing * 10 - 4, player.y - PLAYER.height + 16, 8, 8);
      }
      context.fillStyle = '#ffffff'; context.strokeStyle = '#0c1423'; context.lineWidth = 3;
      context.beginPath(); context.arc(state.ball.x, state.ball.y, BALL.radius, 0, Math.PI * 2); context.fill(); context.stroke();
      pose = next;
      return true;
    },
    destroy() { if (!destroyed) { destroyed = true; release(); } },
  };
}
