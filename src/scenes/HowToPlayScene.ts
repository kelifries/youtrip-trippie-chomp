import Phaser from 'phaser';
import { audioSystem } from '../systems/AudioSystem';

export class HowToPlayScene extends Phaser.Scene {
  constructor() {
    super({ key: 'HowToPlayScene' });
  }

  create(): void {
    const W = 480, H = 720;
    const font = '"Press Start 2P", monospace';

    // Ensure lobby music is playing (idempotent)
    audioSystem.init();
    audioSystem.startBGM('lobby');

    // Background — same as start screen
    const bg = this.add.image(W / 2, H / 2, 'game-over-bg');
    const bgScale = Math.max(W / bg.width, H / bg.height);
    bg.setScale(bgScale);

    const bounceTargets: Phaser.GameObjects.Image[] = [];

    // ─── ← BACK button (top-left) ───
    const backBtnG = this.add.graphics();
    backBtnG.fillStyle(0x1E1432, 0.8);
    backBtnG.fillRoundedRect(8, 8, 105, 24, 12);
    backBtnG.lineStyle(1, 0xFFFFFF, 0.15);
    backBtnG.strokeRoundedRect(8, 8, 105, 24, 12);
    backBtnG.setInteractive(
      new Phaser.Geom.Rectangle(8, 8, 105, 24),
      Phaser.Geom.Rectangle.Contains
    ).setDepth(50);
    this.add.text(60, 20, '← BACK', {
      fontFamily: font, fontSize: '8px', color: '#FFFFFF',
    }).setOrigin(0.5).setDepth(50);
    backBtnG.on('pointerdown', () => {
      audioSystem.init();
      audioSystem.play('click');
      this.scene.start('StartScene');
    });

    // ─── MEET TRIPPIE ─── y=55-130
    const face = this.add.image(160, 100, 'trippie-face');
    face.setScale(100 / face.width);

    const meetX = face.x + 50 + 14;
    this.add.text(meetX, 82, 'MEET', {
      fontFamily: font, fontSize: '24px', color: '#D8B4FE',
      stroke: '#000', strokeThickness: 4,
    });
    this.add.text(meetX, 114, 'TRIPPIE', {
      fontFamily: font, fontSize: '24px', color: '#FFFFFF',
      stroke: '#000', strokeThickness: 4,
    });

    // ─── Description pill ─── y=170 (more space from Meet Trippie)
    const descText = this.add.text(W / 2, 184, 'TRIPPIE IS LOST IN THE AIRPORT MAZE.\nHELP TRIPPIE FIND HIS WAY HOME.', {
      fontFamily: font, fontSize: '10px', color: '#1a1a2e',
      align: 'center', lineSpacing: 10,
    }).setOrigin(0.5, 0.5).setDepth(1);

    const db = descText.getBounds();
    const descG = this.add.graphics();
    descG.fillStyle(0xE9D5FF, 0.85);
    descG.fillRoundedRect(db.x - 18, db.y - 12, db.width + 36, db.height + 24, 8);
    descG.lineStyle(1.5, 0xC4B5FD, 1);
    descG.strokeRoundedRect(db.x - 18, db.y - 12, db.width + 36, db.height + 24, 8);

    // ─── CHOMP ON POWER PELLETS ─── y=258
    this.add.text(W / 2, 258, '●  CHOMP ON POWER PELLETS  ●', {
      fontFamily: font, fontSize: '12px', color: '#00D2C8',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5);

    // 4 item cards — y=252
    const items = [
      { key: 'laser', name: 'LASER', desc: 'Auto-fire\nbeam', color: '#FF3EC8' },
      { key: 'card', name: 'YOUTRIP', desc: 'Chomp on\nmonsters', color: '#D8B4FE' },
      { key: 'magnet', name: 'MAGNET', desc: 'Pull dots\nin', color: '#FF5252' },
      { key: 'globe', name: 'LOCK', desc: 'Freeze\nmonsters', color: '#4FC3F7' },
    ];
    const cardW = 108, cardH = 150, cardGap = 8;
    const totalCardsW = items.length * cardW + (items.length - 1) * cardGap;
    const cardsStartX = (W - totalCardsW) / 2;
    const cardsY = 282;

    items.forEach((item, i) => {
      const cx = cardsStartX + i * (cardW + cardGap) + cardW / 2;
      const cg = this.add.graphics();
      cg.fillStyle(0x1a1a3e, 0.8);
      cg.fillRoundedRect(cx - cardW / 2, cardsY, cardW, cardH, 10);
      cg.lineStyle(1.5, 0x3a3a6e, 1);
      cg.strokeRoundedRect(cx - cardW / 2, cardsY, cardW, cardH, 10);

      const sprite = this.add.image(cx, cardsY + 46, item.key);
      sprite.setScale(64 / Math.max(sprite.width, sprite.height));
      bounceTargets.push(sprite);

      this.add.text(cx, cardsY + 92, item.name, {
        fontFamily: font, fontSize: '11px', color: item.color,
        stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5);
      this.add.text(cx, cardsY + 122, item.desc, {
        fontFamily: font, fontSize: '10px', color: '#FFFFFF',
        stroke: '#000', strokeThickness: 2, align: 'center', lineSpacing: 6,
      }).setOrigin(0.5);
    });

    // ─── DODGE FEE MONSTERS ─── y=450
    this.add.text(W / 2, 450, '●  DODGE FEE MONSTERS  ●', {
      fontFamily: font, fontSize: '12px', color: '#00D2C8',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5);

    // Ghost combined card — 3 fee monsters in one card
    const ghosts = [
      { key: 'monster-blue', name: 'CHASER', color: '#4FC3F7' },
      { key: 'monster-green', name: 'AMBUSHER', color: '#7CDB52' },
      { key: 'monster-orange', name: 'PATROLLER', color: '#FF6B9D' },
    ];
    const ghostCardW = 400, ghostCardH = 130;
    const ghostCardX = W / 2;
    const ghostCardY = 470;

    // Card background
    const ghostCardG = this.add.graphics();
    ghostCardG.fillStyle(0x1a1a3e, 0.7);
    ghostCardG.fillRoundedRect(ghostCardX - ghostCardW / 2, ghostCardY, ghostCardW, ghostCardH, 12);
    ghostCardG.lineStyle(1.5, 0x3a3a6e, 0.8);
    ghostCardG.strokeRoundedRect(ghostCardX - ghostCardW / 2, ghostCardY, ghostCardW, ghostCardH, 12);

    // 3 columns inside
    const colW = ghostCardW / 3;
    ghosts.forEach((ghost, i) => {
      const cx = ghostCardX - ghostCardW / 2 + colW * (i + 0.5);

      const sprite = this.add.image(cx, ghostCardY + 50, ghost.key);
      sprite.setScale(58 / Math.max(sprite.width, sprite.height));
      bounceTargets.push(sprite);

      this.add.text(cx, ghostCardY + 100, ghost.name, {
        fontFamily: font, fontSize: '11px', color: ghost.color,
        stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5);
    });

    // ─── START GAME button ─── shifted up
    const btnW = 320, btnH = 56;
    const btnY = 645;
    const btnG = this.add.graphics();
    btnG.fillStyle(0x00D2C8, 1);
    btnG.fillRoundedRect(W / 2 - btnW / 2, btnY - btnH / 2, btnW, btnH, btnH / 2);
    btnG.lineStyle(1.5, 0x000000, 0.5);
    btnG.strokeRoundedRect(W / 2 - btnW / 2, btnY - btnH / 2, btnW, btnH, btnH / 2);
    btnG.setInteractive(
      new Phaser.Geom.Rectangle(W / 2 - btnW / 2, btnY - btnH / 2, btnW, btnH),
      Phaser.Geom.Rectangle.Contains
    );

    this.add.text(W / 2, btnY, 'START GAME', {
      fontFamily: font, fontSize: '16px', color: '#0D0D1A', letterSpacing: 2,
    }).setOrigin(0.5).setDepth(1);

    const startGame = () => {
      audioSystem.init();
      audioSystem.play('click');
      audioSystem.startBGM('game');
      this.scene.start('GameScene');
    };
    btnG.on('pointerdown', startGame);
    this.input.keyboard?.on('keydown-ENTER', startGame);
    this.input.keyboard?.on('keydown-SPACE', startGame);

    // ─── Bounce — all sprites in sync ───
    this.tweens.add({
      targets: bounceTargets,
      y: '-=4',
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }
}
