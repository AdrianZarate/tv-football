import Phaser from 'phaser';
import { BALL, FIELD, PLAYER, type FootballMatch, type MatchSnapshot, type PlayerSnapshot } from './model.js';

export type SnapshotSource = () => MatchSnapshot;
const COLORS = [0x389dff, 0xff9845] as const;
const INK = 0x172940;
const FONT = 'Arial, sans-serif';

/** Original canvas geometry only. The TV host, not this scene, advances the model. */
export class GameScene extends Phaser.Scene {
  private readonly readSnapshot: SnapshotSource;
  private actors!: Phaser.GameObjects.Graphics;
  private scoreLabel!: Phaser.GameObjects.Text;
  private clockLabel!: Phaser.GameObjects.Text;
  private statusLabel!: Phaser.GameObjects.Text;
  private readyLabel!: Phaser.GameObjects.Text;

  constructor(source: FootballMatch | SnapshotSource) {
    super({ key: 'GameScene' });
    this.readSnapshot = typeof source === 'function' ? source : () => source.snapshot();
  }

  create(): void {
    this.drawPitch();
    this.actors = this.add.graphics();
    this.scoreLabel = this.add.text(FIELD.width / 2, 18, '', {
      fontFamily: FONT, fontSize: '34px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    this.clockLabel = this.add.text(FIELD.width - 44, 24, '', {
      fontFamily: FONT, fontSize: '30px', color: '#fff3b0',
    }).setOrigin(1, 0);
    this.statusLabel = this.add.text(FIELD.width / 2, 130, '', {
      fontFamily: FONT, fontSize: '28px', color: '#ffffff', align: 'center',
      backgroundColor: '#172940', padding: { x: 18, y: 10 },
    }).setOrigin(0.5, 0);
    this.readyLabel = this.add.text(FIELD.width / 2, 690, '', {
      fontFamily: FONT, fontSize: '21px', color: '#ffffff',
    }).setOrigin(0.5);
    this.renderSnapshot(this.readSnapshot());
  }

  update(): void {
    this.renderSnapshot(this.readSnapshot());
  }

  private drawPitch(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(0x172940).fillRect(0, 0, FIELD.width, FIELD.height);
    graphics.fillStyle(0x8bd3e6).fillRect(0, FIELD.top, FIELD.width, FIELD.floor - FIELD.top);
    // Clouds, stands and a low skyline are hand-built shapes, not image assets.
    graphics.fillStyle(0xe3f8ff, 0.8);
    for (const x of [170, 530, 1000]) {
      graphics.fillCircle(x, 190, 32).fillCircle(x + 33, 180, 40).fillCircle(x + 68, 195, 27);
    }
    graphics.fillStyle(0x5398ad).fillRect(FIELD.left, 395, FIELD.right - FIELD.left, 85);
    graphics.fillStyle(0xb9e3df);
    for (let x = 90; x < FIELD.right; x += 40) {
      graphics.fillCircle(x, 418, 8).fillCircle(x + 15, 447, 8);
    }
    graphics.fillStyle(0x34835a).fillRect(0, FIELD.floor, FIELD.width, FIELD.height - FIELD.floor);
    graphics.fillStyle(0x51b96d).fillRect(FIELD.left, FIELD.floor, FIELD.right - FIELD.left, 12);
    graphics.lineStyle(3, 0xd3ffdf).lineBetween(FIELD.left, FIELD.floor, FIELD.right, FIELD.floor);
    graphics.lineStyle(2, 0xcaffdc, 0.5).lineBetween(FIELD.width / 2, FIELD.floor, FIELD.width / 2, FIELD.height);
    graphics.strokeEllipse(FIELD.width / 2, FIELD.floor + 28, 180, 38);
    graphics.lineStyle(5, 0x36566e);
    graphics.lineBetween(FIELD.left, FIELD.top, FIELD.left, FIELD.goalTop);
    graphics.lineBetween(FIELD.right, FIELD.top, FIELD.right, FIELD.goalTop);
    graphics.lineStyle(2, 0x36566e, 0.4).lineBetween(FIELD.left, FIELD.top, FIELD.right, FIELD.top);
    this.drawGoal(graphics, FIELD.left - 48, FIELD.left, COLORS[0]);
    this.drawGoal(graphics, FIELD.right, FIELD.right + 48, COLORS[1]);
    this.add.text(28, 26, 'CANCHA DE BOLSILLO', {
      fontFamily: FONT, fontSize: '25px', color: '#bdebea', fontStyle: 'bold',
    });
  }

  private drawGoal(graphics: Phaser.GameObjects.Graphics, left: number, right: number, color: number): void {
    graphics.fillStyle(0xf1fcff, 0.25).fillRect(left, FIELD.goalTop, right - left, FIELD.floor - FIELD.goalTop);
    graphics.lineStyle(1, 0xffffff, 0.55);
    for (let x = left; x <= right; x += 12) graphics.lineBetween(x, FIELD.goalTop, x, FIELD.floor);
    for (let y = FIELD.goalTop; y <= FIELD.floor; y += 17) graphics.lineBetween(left, y, right, y);
    graphics.lineStyle(6, color).strokeRect(left, FIELD.goalTop, right - left, FIELD.floor - FIELD.goalTop);
    graphics.lineStyle(3, 0xffffff).lineBetween(left, FIELD.goalTop, right, FIELD.goalTop);
  }

  private renderSnapshot(state: MatchSnapshot): void {
    this.actors.clear();
    for (const player of state.players) this.drawPlayer(player);
    this.drawBall(state.ball.x, state.ball.y);
    this.scoreLabel.setText(`P1  ${state.score[0]}  :  ${state.score[1]}  P2`);
    const seconds = Math.ceil(state.remainingMs / 1000);
    this.clockLabel.setText(`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`);
    const messages: Record<MatchSnapshot['phase'], string> = {
      lobby: 'Conectá dos teléfonos; ambos deben pulsar Listo para jugar',
      playing: '',
      paused: state.disconnectDeadlineMs === null
        ? 'PAUSA — ambos deben confirmar para reanudar'
        : 'PAUSA — volvé a conectar los teléfonos antes de 60 segundos',
      finished: state.winner === null ? 'EMPATE — ambos deben confirmar la revancha' : `GANA P${state.winner} — ambos deben confirmar la revancha`,
      cancelled: 'PARTIDO CANCELADO — sin ganador. Creá una Nueva sala.',
    };
    this.statusLabel.setText(messages[state.phase]).setVisible(state.phase !== 'playing');
    this.readyLabel.setText(state.phase === 'playing'
      ? 'P1 AZUL  ·  Mover + Saltar + Patear  ·  P2 NARANJA'
      : state.players.map((player, index) => `P${player.slot}: ${!state.connected[index] ? 'sin conexión' : state.ready[index] ? 'listo' : 'esperando'}`).join('     |     '));
  }

  private drawPlayer(player: PlayerSnapshot): void {
    const graphics = this.actors;
    const { x, y, facing } = player;
    const color = COLORS[player.slot - 1]!;
    graphics.fillStyle(0x172940, 0.22).fillEllipse(x, FIELD.floor + 3, PLAYER.halfWidth * 2 + 14, 12);
    // Heavy outline, round head, jersey, short arms and oversized boots.
    graphics.fillStyle(INK).fillRoundedRect(x - 25, y - 66, 50, 51, 13);
    graphics.fillStyle(color).fillRoundedRect(x - 21, y - 62, 42, 42, 10);
    graphics.lineStyle(9, INK).lineBetween(x - 21, y - 49, x - 29, y - 29);
    graphics.lineBetween(x + 21, y - 49, x + 29, y - 29);
    graphics.fillStyle(0xffdfb0).fillCircle(x - 29, y - 29, 6).fillCircle(x + 29, y - 29, 6);
    graphics.fillStyle(INK).fillEllipse(x - 13, y - 8, 28, 16).fillEllipse(x + 13, y - 8, 28, 16);
    graphics.fillStyle(0xf4f7ff).fillRect(x - 23, y - 11, 19, 4).fillRect(x + 4, y - 11, 19, 4);
    graphics.fillStyle(INK).fillCircle(x, y - 77, 27);
    graphics.fillStyle(0xffdfb0).fillCircle(x, y - 77, 23);
    graphics.fillStyle(color).fillRoundedRect(x - 24, y - 101, 48, 13, 5);
    graphics.fillStyle(INK).fillCircle(x + facing * 9, y - 79, 3);
    graphics.lineStyle(2, INK).lineBetween(x + facing * 5, y - 67, x + facing * 13, y - 69);
    graphics.fillStyle(0xffffff).fillCircle(x, y - 43, 7);
    graphics.fillStyle(INK).fillCircle(x + (player.slot === 1 ? 0 : -2), y - 43, 2);
    if (player.slot === 2) graphics.fillCircle(x + 3, y - 43, 2);
    if (player.kickCooldownMs > 300) {
      graphics.lineStyle(4, 0xfff5a1, 0.9);
      graphics.lineBetween(x + facing * 30, y - 17, x + facing * 49, y - 28);
      graphics.lineBetween(x + facing * 32, y - 9, x + facing * 55, y - 9);
    }
  }

  private drawBall(x: number, y: number): void {
    const graphics = this.actors;
    graphics.fillStyle(0x172940, 0.2).fillEllipse(x, FIELD.floor + 3, 37, 9);
    graphics.fillStyle(INK).fillCircle(x, y, BALL.radius);
    graphics.fillStyle(0xfffdf2).fillCircle(x, y, BALL.radius - 2);
    graphics.fillStyle(INK).beginPath();
    for (let n = 0; n < 5; n++) {
      const angle = -Math.PI / 2 + n * Math.PI * 2 / 5;
      const px = x + Math.cos(angle) * 7;
      const py = y + Math.sin(angle) * 7;
      if (n === 0) graphics.moveTo(px, py); else graphics.lineTo(px, py);
    }
    graphics.closePath().fillPath();
    graphics.lineStyle(2, INK);
    for (let n = 0; n < 5; n++) {
      const angle = -Math.PI / 2 + n * Math.PI * 2 / 5;
      graphics.lineBetween(x + Math.cos(angle) * 7, y + Math.sin(angle) * 7,
        x + Math.cos(angle) * (BALL.radius - 2), y + Math.sin(angle) * (BALL.radius - 2));
    }
  }
}
