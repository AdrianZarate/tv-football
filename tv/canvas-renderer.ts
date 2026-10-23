import { BALL, FIELD, PLAYER, type MatchSnapshot } from '../game/model.js';

const INK = '#172c3a';
// Four 52x100 actors with two-pixel gutters, plus one 36x36 ball. No DPR growth.
const ATLAS = { width: 288, height: 112, stride: 56, inset: 2, ballX: 226 };
const TAU = Math.PI * 2;

function polygon(art: CanvasRenderingContext2D, color: string, points: number[][], outline = true) {
  art.fillStyle = color; art.beginPath();
  points.forEach(([x, y], index) => index ? art.lineTo(x!, y!) : art.moveTo(x!, y!));
  art.closePath(); art.fill();
  if (outline) { art.strokeStyle = INK; art.lineWidth = 2; art.stroke(); }
}

function oval(art: CanvasRenderingContext2D, color: string, x: number, y: number, rx: number, ry: number, outline = true) {
  art.fillStyle = color; art.beginPath(); art.ellipse(x, y, rx, ry, 0, 0, TAU); art.fill();
  if (outline) { art.strokeStyle = INK; art.lineWidth = 2; art.stroke(); }
}

/** Small original paper-cut footballers. All coordinates stay inside the physical body. */
function bakePlayer(art: CanvasRenderingContext2D, kit: string) {
  polygon(art, '#f2c59d', [[7, 49], [14, 51], [13, 67], [7, 71], [3, 66]]);
  polygon(art, '#f2c59d', [[40, 50], [46, 48], [49, 65], [45, 70], [39, 65]]);
  polygon(art, kit, [[15, 41], [35, 41], [45, 47], [42, 58], [36, 55], [38, 69], [12, 69], [15, 55], [9, 58], [6, 48]]);
  polygon(art, '#ffffff', [[18, 42], [26, 47], [33, 42], [29, 51], [23, 51]], false);
  polygon(art, '#ffffff', [[15, 59], [36, 59], [37, 63], [14, 63]], false);
  polygon(art, INK, [[12, 68], [38, 68], [40, 80], [28, 81], [26, 75], [23, 81], [11, 80]]);
  polygon(art, '#ffffff', [[13, 81], [23, 81], [22, 93], [13, 93]]);
  polygon(art, '#ffffff', [[29, 81], [38, 81], [39, 93], [30, 93]]);
  polygon(art, kit, [[13, 84], [23, 84], [23, 88], [13, 88]], false);
  polygon(art, kit, [[29, 84], [39, 84], [39, 88], [29, 88]], false);
  polygon(art, INK, [[12, 92], [22, 92], [27, 96], [26, 99], [7, 99], [7, 96]]);
  polygon(art, INK, [[30, 92], [39, 92], [48, 96], [48, 99], [29, 99]]);
  oval(art, '#f2c59d', 8, 25, 4, 6);
  oval(art, '#f2c59d', 26, 23, 20, 20);
  polygon(art, '#49392f', [[7, 23], [6, 14], [11, 6], [22, 2], [36, 3], [45, 10], [45, 17], [35, 14], [31, 10], [24, 17], [14, 16], [13, 26]]);
  oval(art, '#ffffff', 36, 23, 6, 7, false);
  art.fillStyle = INK; art.beginPath(); art.arc(38, 24, 2.5, 0, TAU); art.fill();
  polygon(art, '#f2c59d', [[44, 25], [50, 29], [44, 31]], false);
  art.strokeStyle = INK; art.lineWidth = 2;
  art.beginPath(); art.moveTo(31, 16); art.lineTo(40, 17); art.stroke();
  art.beginPath(); art.moveTo(33, 35); art.quadraticCurveTo(38, 39, 42, 34); art.stroke();
}

function bakeBall(art: CanvasRenderingContext2D) {
  art.fillStyle = '#ffffff'; art.strokeStyle = INK; art.lineWidth = 3;
  art.beginPath(); art.arc(BALL.radius, BALL.radius, BALL.radius - 1.5, 0, TAU); art.fill(); art.stroke();
  polygon(art, INK, [[18, 10], [25, 15], [22, 24], [14, 24], [11, 15]]);
  art.lineWidth = 1.5;
  for (const [x, y, edgeX, edgeY] of [[18, 10, 18, 2], [25, 15, 33, 12], [22, 24, 28, 31], [14, 24, 8, 31], [11, 15, 3, 12]]) {
    art.beginPath(); art.moveTo(x!, y!); art.lineTo(edgeX!, edgeY!); art.stroke();
  }
  polygon(art, INK, [[14, 3], [22, 3], [18, 6]], false);
  polygon(art, INK, [[30, 26], [27, 31], [25, 28]], false);
}

function bakeArena(art: CanvasRenderingContext2D) {
  art.fillStyle = '#b8d3cd'; art.fillRect(0, 0, FIELD.width, FIELD.height);
  art.fillStyle = '#cfdfcf'; art.fillRect(0, 290, FIELD.width, 100);
  // Quiet distant silhouette, not an aerial pitch floating behind side-view actors.
  art.fillStyle = '#91afa1'; art.beginPath(); art.moveTo(0, 410);
  art.quadraticCurveTo(230, 322, 460, 396); art.quadraticCurveTo(850, 310, 1280, 400);
  art.lineTo(1280, 480); art.lineTo(0, 480); art.closePath(); art.fill();
  art.fillStyle = '#718f86'; art.fillRect(100, 408, 1080, 52);
  art.fillStyle = '#7f9c92'; art.fillRect(100, 428, 1080, 5);
  for (let x = 126; x < 1180; x += 46) {
    oval(art, x % 3 === 0 ? '#aec0af' : '#4e726b', x, 421, 6, 7, false);
  }
  art.fillStyle = '#456e60'; art.fillRect(0, 458, FIELD.width, FIELD.floor - 458);
  art.fillStyle = '#547c64'; art.fillRect(FIELD.left, 478, FIELD.right - FIELD.left, FIELD.floor - 478);
  art.fillStyle = '#355b4b'; art.fillRect(0, FIELD.floor, FIELD.width, FIELD.height - FIELD.floor);
  art.fillStyle = '#8ead71'; art.fillRect(0, FIELD.floor, FIELD.width, 5);
  art.fillStyle = '#41654d'; art.fillRect(0, 660, FIELD.width, 12);
  art.fillStyle = '#3b604b'; art.fillRect(0, 696, FIELD.width, 12);
  // Ground-level halfway mark; no top-down centre circle or ceiling border.
  art.fillStyle = '#b2c6a4'; art.fillRect(FIELD.width / 2 - 2, FIELD.floor, 4, 34);
  for (const [post, back] of [[FIELD.left, 16], [FIELD.right, FIELD.width - 16]]) {
    art.fillStyle = '#355d53'; art.fillRect(Math.min(post!, back!), FIELD.goalTop, Math.abs(post! - back!), FIELD.floor - FIELD.goalTop);
    art.strokeStyle = '#648a79'; art.lineWidth = 1;
    art.beginPath();
    for (let y = FIELD.goalTop + 17; y < FIELD.floor; y += 17) {
      art.moveTo(back!, y); art.lineTo(post!, y);
    }
    for (let x = Math.min(post!, back!) + 12; x < Math.max(post!, back!); x += 12) {
      art.moveTo(x, FIELD.goalTop); art.lineTo(x, FIELD.floor);
    }
    art.stroke();
    art.strokeStyle = '#e3e9ce'; art.lineWidth = 4;
    art.beginPath(); art.moveTo(post!, FIELD.floor); art.lineTo(post!, FIELD.goalTop);
    art.lineTo(back!, FIELD.goalTop); art.lineTo(back!, FIELD.floor); art.stroke();
  }
}

/** Native snapshot view: no simulation, timers, fonts, external assets or WebGL. */
export function createCanvasRenderer(parent: HTMLElement, create = () => document.createElement('canvas')) {
  const canvas = create();
  let background: HTMLCanvasElement | undefined;
  let atlas: HTMLCanvasElement | undefined;
  const release = () => {
    canvas.remove(); canvas.width = canvas.height = 0;
    if (background) background.width = background.height = 0;
    if (atlas) atlas.width = atlas.height = 0;
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
    bakeArena(art);
    atlas = create(); atlas.width = ATLAS.width; atlas.height = ATLAS.height;
    const sprites = atlas.getContext('2d');
    if (!sprites) throw new Error('Canvas2D no disponible');
    for (let index = 0; index < 4; index++) {
      sprites.save(); sprites.translate(index * ATLAS.stride + ATLAS.inset, ATLAS.inset);
      if (index % 2) { sprites.translate(PLAYER.halfWidth * 2, 0); sprites.scale(-1, 1); }
      bakePlayer(sprites, index < 2 ? '#389dff' : '#ff9845'); sprites.restore();
    }
    sprites.save(); sprites.translate(ATLAS.ballX, ATLAS.inset); bakeBall(sprites); sprites.restore();
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
        const cell = (player.slot - 1) * 2 + (player.facing === -1 ? 1 : 0);
        context.drawImage(atlas!, cell * ATLAS.stride + ATLAS.inset, ATLAS.inset, PLAYER.halfWidth * 2, PLAYER.height,
          player.x - PLAYER.halfWidth, player.y - PLAYER.height, PLAYER.halfWidth * 2, PLAYER.height);
      }
      context.drawImage(atlas!, ATLAS.ballX, ATLAS.inset, BALL.radius * 2, BALL.radius * 2,
        state.ball.x - BALL.radius, state.ball.y - BALL.radius, BALL.radius * 2, BALL.radius * 2);
      pose = next;
      return true;
    },
    destroy() { if (!destroyed) { destroyed = true; release(); } },
  };
}
