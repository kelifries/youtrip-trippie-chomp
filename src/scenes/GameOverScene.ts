import Phaser from 'phaser';
import { shareToIG, ShareStats } from '../systems/ShareImage';
import { audioSystem } from '../systems/AudioSystem';

export class GameOverScene extends Phaser.Scene {
  private stats!: ShareStats;

  constructor() {
    super({ key: 'GameOverScene' });
  }

  init(data: ShareStats): void {
    this.stats = data;
  }

  create(): void {
    const W = 480, H = 720;
    const font = '"Press Start 2P", monospace';

    // Background — cover-fit
    const bg = this.add.image(W / 2, H / 2, 'game-over-bg');
    const bgScale = Math.max(W / bg.width, H / bg.height);
    bg.setScale(bgScale);

    // ← INTRO button (top-left)
    const introBtnG = this.add.graphics();
    introBtnG.fillStyle(0x1E1432, 0.8);
    introBtnG.fillRoundedRect(8, 8, 105, 24, 12);
    introBtnG.lineStyle(1, 0xFFFFFF, 0.15);
    introBtnG.strokeRoundedRect(8, 8, 105, 24, 12);
    introBtnG.setInteractive(
      new Phaser.Geom.Rectangle(8, 8, 105, 24),
      Phaser.Geom.Rectangle.Contains
    ).setDepth(50);
    this.add.text(60, 20, '← INTRO', {
      fontFamily: font,
      fontSize: '8px',
      color: '#FFFFFF',
    }).setOrigin(0.5).setDepth(50);
    introBtnG.on('pointerdown', () => {
      audioSystem.play('click');
      audioSystem.startBGM('lobby');
      this.scene.start('HowToPlayScene');
    });

    // Card
    const cardW = 420, cardH = 560;
    const cardX = W / 2, cardY = H / 2;
    const cardLeft = cardX - cardW / 2;
    const cardTop = cardY - cardH / 2;
    const pad = 20;

    const cg = this.add.graphics();
    cg.fillStyle(0x1E1432, 0.75);
    cg.fillRoundedRect(cardLeft, cardTop, cardW, cardH, 16);
    cg.lineStyle(1, 0xFFFFFF, 0.12);
    cg.strokeRoundedRect(cardLeft, cardTop, cardW, cardH, 16);

    // Title — big, light purple with black stroke like TRIPPIE CHOMP
    this.add.text(cardX, cardTop + 38, 'GAME\nOVER', {
      fontFamily: font,
      fontSize: '36px',
      color: '#D8B4FE',
      align: 'center',
      lineSpacing: 8,
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5, 0);

    // Trippie coins image — bigger
    const coins = this.add.image(cardX, cardTop + 170, 'trippie-coins');
    const coinsScale = 240 / coins.width;
    coins.setScale(coinsScale);

    // Score
    this.add.text(cardX, cardTop + 246, `YOU SAVED S$${this.stats.score}!`, {
      fontFamily: font,
      fontSize: '20px',
      color: '#FFD700',
      stroke: '#000',
      strokeThickness: 3,
    }).setOrigin(0.5, 0);

    // Stats row
    const statLabels = ['CURRENCIES\nEATEN', 'LEVEL\nREACHED', 'FEE MONSTERS\nEATEN'];
    const statValues = [this.stats.dotsEaten, this.stats.level, this.stats.ghostsEaten];
    const statGap = 8;
    const statW = (cardW - pad * 2 - statGap * 2) / 3;
    const statH = 95;
    const statY = cardTop + 285;
    const statStartX = cardLeft + pad;

    for (let i = 0; i < 3; i++) {
      const sx = statStartX + i * (statW + statGap);
      const sg = this.add.graphics();
      sg.fillStyle(0xFFFFFF, 0.08);
      sg.fillRoundedRect(sx, statY, statW, statH, 10);
      sg.lineStyle(1, 0xFFFFFF, 0.15);
      sg.strokeRoundedRect(sx, statY, statW, statH, 10);

      this.add.text(sx + statW / 2, statY + 14, statLabels[i], {
        fontFamily: font,
        fontSize: '7px',
        color: 'rgba(255,255,255,0.65)',
        align: 'center',
        lineSpacing: 4,
      }).setOrigin(0.5, 0);

      this.add.text(sx + statW / 2, statY + statH - 14, String(statValues[i]), {
        fontFamily: font,
        fontSize: '24px',
        color: '#00D2C8',
        stroke: '#000',
        strokeThickness: 2,
      }).setOrigin(0.5, 1);
    }

    // Share button
    const btnW = cardW - pad * 2;
    const btnH = 44;
    const shareBtnY = statY + statH + 16;

    const shareBtnG = this.add.graphics();
    shareBtnG.fillStyle(0x00D2C8, 1);
    shareBtnG.fillRoundedRect(cardX - btnW / 2, shareBtnY, btnW, btnH, btnH / 2);
    shareBtnG.lineStyle(1.5, 0x000000, 0.5);
    shareBtnG.strokeRoundedRect(cardX - btnW / 2, shareBtnY, btnW, btnH, btnH / 2);
    shareBtnG.setInteractive(
      new Phaser.Geom.Rectangle(cardX - btnW / 2, shareBtnY, btnW, btnH),
      Phaser.Geom.Rectangle.Contains
    );

    this.add.text(cardX, shareBtnY + btnH / 2, 'SHARE ON INSTAGRAM', {
      fontFamily: font,
      fontSize: '10px',
      color: '#0D0D1A',
    }).setOrigin(0.5);

    shareBtnG.on('pointerdown', () => {
      audioSystem.play('click');
      const gameOverBg = this.textures.get('game-over-bg').getSourceImage() as HTMLImageElement;
      const trippieCoins = this.textures.get('trippie-coins').getSourceImage() as HTMLImageElement;
      shareToIG(this.stats, gameOverBg, trippieCoins);
    });

    // Play again button
    const playBtnY = shareBtnY + btnH + 10;
    const playBtnH = 40;

    const playBtnG = this.add.graphics();
    playBtnG.lineStyle(1, 0xFFFFFF, 0.2);
    playBtnG.strokeRoundedRect(cardX - btnW / 2, playBtnY, btnW, playBtnH, playBtnH / 2);
    playBtnG.setInteractive(
      new Phaser.Geom.Rectangle(cardX - btnW / 2, playBtnY, btnW, playBtnH),
      Phaser.Geom.Rectangle.Contains
    );

    this.add.text(cardX, playBtnY + playBtnH / 2, 'PLAY AGAIN', {
      fontFamily: font,
      fontSize: '9px',
      color: 'rgba(255,255,255,0.6)',
    }).setOrigin(0.5);

    playBtnG.on('pointerdown', () => {
      audioSystem.play('click');
      audioSystem.init();
      this.scene.start('GameScene');
    });

    // CTA text
    this.add.text(cardX, playBtnY + playBtnH + 22, 'SHARE ON IG & STAND A CHANCE\nTO WIN A YEAR OF TRAVEL ON US', {
      fontFamily: font,
      fontSize: '9px',
      color: 'rgba(255,255,255,0.6)',
      align: 'center',
      lineSpacing: 8,
    }).setOrigin(0.5, 0);

    // Keyboard restart
    const restart = () => { audioSystem.play('click'); audioSystem.init(); this.scene.start('GameScene'); };
    this.input.keyboard?.on('keydown-ENTER', restart);
    this.input.keyboard?.on('keydown-SPACE', restart);
  }
}
