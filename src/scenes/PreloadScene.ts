import Phaser from 'phaser';
import { LEVELS } from '../config/levels';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' });
  }

  preload(): void {
    this.drawLoadingBar();

    // Player sprites
    this.load.image('trippie-a', 'assets/sprite-trippie-a.webp');         // right closed
    this.load.image('trippie-b', 'assets/sprite-trippie-b.webp');         // front (up/down)
    this.load.image('trippie-c', 'assets/sprite-trippie-c.webp');         // front (up/down)
    this.load.image('trippie-d', 'assets/sprite-trippie-d.webp');         // left closed
    this.load.image('trippie-right-open', 'assets/sprite-trippie-right-open.webp');
    this.load.image('trippie-left-open', 'assets/sprite-trippie-left-open.webp');
    this.load.image('trippie-face', 'assets/trippie-face.webp');
    this.load.image('trippie-coins', 'assets/trippie-coins.webp');

    // Monster sprites — 3 fee monsters
    this.load.image('monster-blue', 'assets/monster-blue.webp');
    this.load.image('monster-blue-dead', 'assets/monster-blue-dead.webp');
    this.load.image('monster-green', 'assets/monster-green.webp');
    this.load.image('monster-green-dead', 'assets/monster-green-dead.webp');
    this.load.image('monster-orange', 'assets/monster-orange.webp');
    this.load.image('monster-orange-dead', 'assets/monster-orange-dead.webp');

    // Item sprites
    this.load.image('card', 'assets/sprite-card.webp');
    this.load.image('airplane', 'assets/sprite-airplane.webp');
    this.load.image('plane-side', 'assets/sprite-plane-side.webp');  // bg animation, SG only
    this.load.image('runway-light', 'assets/runway-light.webp');     // SG runway blink
    this.load.image('scooter', 'assets/sprite-scooter.webp');        // JP street level
    this.load.image('neon-pink', 'assets/neon-sign-pink.webp');      // JP neon blink
    this.load.image('neon-cyan', 'assets/neon-sign-cyan.webp');
    this.load.image('passport', 'assets/passport.webp');
    this.load.image('globe', 'assets/sprite-globe.webp');
    this.load.image('laser', 'assets/sprite-laser.webp');
    this.load.image('magnet', 'assets/sprite-magnet.webp');

    // Game-over background (used by GameOverScene + ShareImage canvas source)
    this.load.image('game-over-bg', 'assets/game-over-bg.webp');

    // Scoreboard polish — Trippie victory sprite
    this.load.image('trippie-victory', 'assets/sprite-trippie-victory.webp');
    this.load.image('bg-underwater', 'assets/bg-underwater.webp');

    // Per-destination level backgrounds — driven by LEVELS config (deduped)
    const seen = new Set<string>();
    for (const level of LEVELS) {
      if (seen.has(level.bgAsset)) continue;
      seen.add(level.bgAsset);
      this.load.image(level.bgAsset, `assets/${level.bgAsset}.webp`);
    }
  }

  create(): void {
    this.scene.start('StartScene');
  }

  private drawLoadingBar(): void {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    const bg = this.add.graphics();
    bg.fillStyle(0x0d0d1a, 1).fillRect(0, 0, w, h);

    const barW = w * 0.6;
    const barH = 14;
    const barX = (w - barW) / 2;
    const barY = h / 2;

    const frame = this.add.graphics();
    frame.lineStyle(2, 0x2a1845, 1);
    frame.strokeRect(barX - 2, barY - 2, barW + 4, barH + 4);

    const fill = this.add.graphics();

    const label = this.add.text(w / 2, barY - 28, 'LOADING…', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '12px',
      color: '#00d2c8',
    }).setOrigin(0.5);

    this.load.on('progress', (value: number) => {
      fill.clear();
      fill.fillStyle(0x00d2c8, 1);
      fill.fillRect(barX, barY, barW * value, barH);
    });

    this.load.on('complete', () => {
      bg.destroy();
      frame.destroy();
      fill.destroy();
      label.destroy();
    });
  }
}
