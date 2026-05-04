import Phaser from 'phaser';
import { audioSystem } from '../systems/AudioSystem';

export class StartScene extends Phaser.Scene {
  constructor() {
    super({ key: 'StartScene' });
  }

  create(): void {
    const W = 480, H = 720;

    // Background — cover-fit the canvas
    const bg = this.add.image(W / 2, H / 2, 'game-over-bg');
    const bgScale = Math.max(W / bg.width, H / bg.height);
    bg.setScale(bgScale);

    // Trippie face — preserve aspect ratio
    const face = this.add.image(W / 2, 200, 'trippie-face');
    const faceScale = 160 / face.width;
    face.setScale(faceScale);

    // Floating animation
    this.tweens.add({
      targets: face,
      y: face.y - 10,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Title — "TRIPPIE CHOMP" big retro, light purple
    this.add.text(W / 2, 340, 'TRIPPIE\nCHOMP', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '40px',
      color: '#D8B4FE',
      align: 'center',
      lineSpacing: 12,
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    // Subtitle — pill/badge style with background
    const subText = 'EAT CURRENCIES. DODGE FEE MONSTERS. STACK SAVINGS.';
    const subY = 430;
    const subPadX = 16, subPadY = 10;

    // Create text first to measure it
    const sub = this.add.text(W / 2, subY, subText, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: '#1a1a2e',
      align: 'center',
      wordWrap: { width: 360 },
      lineSpacing: 6,
    }).setOrigin(0.5);

    // Draw pill background behind the text
    const bounds = sub.getBounds();
    const pillG = this.add.graphics();
    pillG.fillStyle(0xE9D5FF, 0.9);
    pillG.fillRoundedRect(
      bounds.x - subPadX,
      bounds.y - subPadY,
      bounds.width + subPadX * 2,
      bounds.height + subPadY * 2,
      8
    );
    pillG.lineStyle(1.5, 0xC4B5FD, 1);
    pillG.strokeRoundedRect(
      bounds.x - subPadX,
      bounds.y - subPadY,
      bounds.width + subPadX * 2,
      bounds.height + subPadY * 2,
      8
    );

    // Bring text above the pill background
    sub.setDepth(1);

    // Play button — pill shape
    const btnW = 280, btnH = 56;
    const btnY = 530;
    const btnGraphics = this.add.graphics();
    btnGraphics.fillStyle(0x00D2C8, 1);
    btnGraphics.fillRoundedRect(W / 2 - btnW / 2, btnY - btnH / 2, btnW, btnH, btnH / 2);
    btnGraphics.setInteractive(
      new Phaser.Geom.Rectangle(W / 2 - btnW / 2, btnY - btnH / 2, btnW, btnH),
      Phaser.Geom.Rectangle.Contains
    );

    this.add.text(W / 2, btnY, 'PLAY NOW', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '16px',
      color: '#0D0D1A',
      letterSpacing: 2,
    }).setOrigin(0.5).setDepth(1);

    const startGame = () => {
      audioSystem.init();
      audioSystem.play('click');
      audioSystem.startBGM('lobby');
      this.scene.start('HowToPlayScene');
    };

    btnGraphics.on('pointerdown', startGame);
    this.input.keyboard?.on('keydown-ENTER', startGame);
    this.input.keyboard?.on('keydown-SPACE', startGame);


  }
}
