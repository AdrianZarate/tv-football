import Phaser from 'phaser';
import { BALL, FIELD, PLAYER, type FootballMatch, type MatchSnapshot, type PlayerSnapshot } from './model.js';

export type SnapshotSource = () => MatchSnapshot;
const COLORS = [0x389dff, 0xff9845] as const;
const INK = 0x172940;
const textureKey = (name: string) => `football-${name}`;
type PlayerView = { body: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Image; kick: Phaser.GameObjects.Image };

/** Original artwork baked once. The TV host, not this scene, advances the model. */
export class GameScene extends Phaser.Scene {
  private readonly readSnapshot: SnapshotSource;
  private playerViews: PlayerView[] = [];
  private ball!: Phaser.GameObjects.Image;
  private ballShadow!: Phaser.GameObjects.Image;
  private images: Phaser.GameObjects.Image[] = [];
  private ownedTextures: string[] = [];

  constructor(source: FootballMatch | SnapshotSource) {
    super({ key: 'GameScene' });
    this.readSnapshot = typeof source === 'function' ? source : () => source.snapshot();
  }

  create(): void {
    this.bake('pitch', FIELD.width, FIELD.height, graphics => this.drawPitch(graphics));
    for (const slot of [1, 2] as const) {
      for (const facing of [-1, 1] as const) {
        this.bake(`player-${slot}-${facing === 1 ? 'right' : 'left'}`, 72, 112,
          graphics => this.drawPlayer(graphics, slot, facing));
      }
    }
    this.bake('player-shadow', 70, 16, graphics => {
      graphics.fillStyle(INK, 0.22).fillEllipse(35, 8, PLAYER.halfWidth * 2 + 14, 12);
    });
    this.bake('ball-shadow', 40, 12, graphics => {
      graphics.fillStyle(INK, 0.2).fillEllipse(20, 6, 37, 9);
    });
    this.bake('kick', 116, 36, graphics => {
      graphics.lineStyle(4, 0xfff5a1, 0.9);
      graphics.lineBetween(88, 15, 107, 4).lineBetween(90, 23, 113, 23);
    });
    this.bake('ball', 40, 40, graphics => this.drawBall(graphics));
    this.image('pitch').setOrigin(0);
    this.playerViews = [1, 2].map(slot => ({
      shadow: this.image('player-shadow'),
      body: this.image(`player-${slot}-right`).setOrigin(0.5, 108 / 112),
      kick: this.image('kick').setOrigin(0.5, 32 / 36),
    }));
    this.ballShadow = this.image('ball-shadow');
    this.ball = this.image('ball');
    this.events.once('shutdown', () => {
      // Destroy every user of these textures before removing their canvas/GPU sources.
      for (const image of this.images) image.destroy();
      for (const key of this.ownedTextures) this.textures.remove(key);
      this.images = []; this.ownedTextures = []; this.playerViews = [];
    });
    this.renderSnapshot(this.readSnapshot());
  }

  private bake(name: string, width: number, height: number, draw: (graphics: Phaser.GameObjects.Graphics) => void): void {
    const key = textureKey(name);
    if (this.textures.exists(key)) return;
    const graphics = this.add.graphics();
    draw(graphics);
    // Phaser uses a local Canvas source and refreshes it for either renderer; no image URL.
    graphics.generateTexture(key, width, height);
    graphics.destroy();
    this.ownedTextures.push(key);
  }

  private image(name: string): Phaser.GameObjects.Image {
    const image = this.add.image(0, 0, textureKey(name));
    this.images.push(image);
    return image;
  }

  update(): void {
    this.renderSnapshot(this.readSnapshot());
  }

  private drawPitch(graphics: Phaser.GameObjects.Graphics): void {
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
    for (const player of state.players) {
      const view = this.playerViews[player.slot - 1]!;
      view.shadow.setPosition(player.x, FIELD.floor + 3);
      view.body.setPosition(player.x, player.y)
        .setTexture(textureKey(`player-${player.slot}-${player.facing === 1 ? 'right' : 'left'}`));
      view.kick.setPosition(player.x, player.y).setFlipX(player.facing === -1).setVisible(player.kickCooldownMs > 300);
    }
    this.ballShadow.setPosition(state.ball.x, FIELD.floor + 3);
    this.ball.setPosition(state.ball.x, state.ball.y);
  }

  private drawPlayer(graphics: Phaser.GameObjects.Graphics, slot: PlayerSnapshot['slot'], facing: PlayerSnapshot['facing']): void {
    const x = 36, y = 108;
    const color = COLORS[slot - 1]!;
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
    graphics.fillStyle(INK).fillCircle(x + (slot === 1 ? 0 : -2), y - 43, 2);
    if (slot === 2) graphics.fillCircle(x + 3, y - 43, 2);
  }

  private drawBall(graphics: Phaser.GameObjects.Graphics): void {
    const x = 20, y = 20;
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
