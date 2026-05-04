import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Ghost } from '../entities/Ghost';
import { BonusData, spawnBonus, isBonusBlinking } from '../entities/BonusItem';
import { audioSystem } from '../systems/AudioSystem';
import { cloneMaze, countDots, analyzeMaze, type MazeMeta } from '../config/mazes';
import {
  COLS, ROWS, WALL, DOT, POWER, EMPTY, GATE, DX, DY,
  Direction, STARTING_LIVES,
  POWER_DURATION, POWER_FLASH_THRESHOLD,
  INVINCIBLE_DURATION, DYING_DURATION, LEVEL_WIN_DURATION,
  BONUS_FIRST_SPAWN_DELAY, BONUS_SPAWN_MIN, BONUS_SPAWN_MAX,
  BOOST_DURATION, FREEZE_DURATION,
  LASER_DURATION, LASER_FIRE_INTERVAL, LASER_BEAM_FADE,
  MAGNET_DURATION, MAGNET_RADIUS, MAGNET_PULL_INTERVAL,
  SCORE_DOT, SCORE_POWER, SCORE_BONUS, SCORE_GHOST_BASE,
  POPUP_DURATION,
  COLOR_WALL, COLOR_WALL_BORDER, COLOR_DOT, COLOR_GATE,
} from '../config/constants';
import { getLevelConfig } from '../config/levels';

// Fixed game dimensions (must match main.ts)
const W = 480;
const H = 720;
const HUD_HEIGHT = 52;

type GameState = 'playing' | 'dying' | 'levelwin' | 'scoreboard';

export class GameScene extends Phaser.Scene {
  // Game state
  private map!: number[][];
  private mazeMeta!: MazeMeta;
  private score: number = 0;
  private lives: number = STARTING_LIVES;
  private level: number = 1;
  private dotsLeft: number = 0;
  private gameState: GameState = 'playing';

  // Entities
  private player!: Player;
  private ghosts: Ghost[] = [];

  // Timers (in ms)
  private bonusLevelTimer: number = 0;
  private powerTimer: number = 0;
  private comboCount: number = 0;
  private comboTimer: number = 0;  // ms until combo expires
  private comboText?: Phaser.GameObjects.Text;
  private ghostScore: number = SCORE_GHOST_BASE;
  private invincibleTimer: number = 0;
  private freezeTimer: number = 0;
  private boostTimer: number = 0;          // legacy — retained for any old refs
  private laserTimer: number = 0;
  private laserCooldown: number = 0;
  private magnetTimer: number = 0;
  private magnetPullCooldown: number = 0;
  private magnetFlying: Set<string> = new Set();
  private laserGraphics!: Phaser.GameObjects.Graphics;
  private magnetAuraGraphics!: Phaser.GameObjects.Graphics;
  private popupTimer: number = 0;
  private popupText: string = '';
  private popupGlow!: Phaser.GameObjects.Graphics;
  private popupTween?: Phaser.Tweens.Tween;
  private screenFlash?: Phaser.GameObjects.Rectangle;
  private dyingTimer: number = 0;
  private levelWinTimer: number = 0;

  // Bonus
  private bonusItem: BonusData | null = null;
  private bonusSpawnTimer: number = BONUS_FIRST_SPAWN_DELAY;

  // Stats
  private totalDotsEaten: number = 0;
  private totalGhostsEaten: number = 0;
  private levelStartScore: number = 0;
  private levelDotsAtStart: number = 0;
  private levelGhostsAtStart: number = 0;

  // Rendering
  private tileSize: number = 24;
  private offsetX: number = 0;
  private offsetY: number = 0;
  private mazeGraphics!: Phaser.GameObjects.Graphics;
  private wallGlowGraphics!: Phaser.GameObjects.Graphics;
  private mazeDimmer!: Phaser.GameObjects.Rectangle;
  private entityGraphics!: Phaser.GameObjects.Graphics;
  private scoreText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private muteText!: Phaser.GameObjects.Text;
  private bonusTimerText?: Phaser.GameObjects.Text;
  private bonusTimerLabel?: Phaser.GameObjects.Text;
  private lastBonusSec: number = -1;
  private tickingScore: boolean = false;
  private transitionFreezeTimer: number = 0;
  private livesContainer!: Phaser.GameObjects.Container;
  private popupTextObj!: Phaser.GameObjects.Text;
  private bgImage!: Phaser.GameObjects.Image;
  private bgAnimSprites: Phaser.GameObjects.Image[] = [];
  private bgAnimTweens: Phaser.Tweens.Tween[] = [];

  // Input
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private touchStartX: number = 0;
  private touchStartY: number = 0;

  // Sprite objects
  private playerSprite!: Phaser.GameObjects.Image;
  private ghostSprites: Phaser.GameObjects.Image[] = [];
  private cardSprites: Phaser.GameObjects.Image[] = [];
  private bonusSprites: Phaser.GameObjects.Image[] = [];

  constructor() {
    super({ key: 'GameScene' });
  }

  private parseStartLevel(): number {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('level');
    if (!raw) return 1;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 1 ? n : 1;
  }

  create(): void {
    this.score = 0;
    this.lives = STARTING_LIVES;
    this.level = this.parseStartLevel();
    this.totalDotsEaten = 0;
    this.totalGhostsEaten = 0;

    // Start gameplay music
    audioSystem.startBGM('game');

    this.calculateLayout();
    this.setupRendering();
    this.setupInput();
    this.startLevel();

    // L1 cold-start animation — boarding pass with the destination tagline so
    // the game opens with the same beat as later transitions, not a cut to
    // gameplay. fromCode='' suppresses the route ribbon.
    if (this.level === 1 && this.gameState === 'playing') {
      const cfg = getLevelConfig(1);
      this.showLevelTransition('', cfg.cityCode, cfg.destination, cfg.flag);
      this.transitionFreezeTimer = 3800;
    }

    // Debug: ?sb=1 jumps straight to the scoreboard with stub stats so the
    // pixel-art frame + Trippie victory render can be verified without playing
    // through L1.
    if (new URLSearchParams(window.location.search).get('sb') === '1') {
      this.totalDotsEaten = 142;
      this.totalGhostsEaten = 3;
      this.score = 1840;
      this.levelStartScore = 1240;
      this.gameState = 'scoreboard';
      this.time.delayedCall(120, () => this.showScoreboard(600));
    }
  }

  private calculateLayout(): void {
    // Maze tiling — clear HUD text + small gap top, slim bg-reveal strip
    // bottom. Center maze vertically in the remaining space so the game
    // doesn't feel top-anchored on tall phones.
    const availW = W - 8;
    const TOP_PAD = 16;      // clears HUD text + small gap
    const BG_REVEAL = 40;    // exposed bg strip below maze (was 110 — felt small on mobile)
    const availH = H - HUD_HEIGHT - TOP_PAD - BG_REVEAL;
    this.tileSize = Math.floor(Math.min(availW / COLS, availH / ROWS));
    this.tileSize = Math.max(this.tileSize, 10);

    const mazeW = COLS * this.tileSize;
    const mazeH = ROWS * this.tileSize;
    this.offsetX = (W - mazeW) / 2;
    this.offsetY = HUD_HEIGHT + TOP_PAD + Math.max(0, (availH - mazeH) / 2);
  }

  private setupRendering(): void {
    // Background — per-level destination scene; swapped in applyLevelBackground()
    // each time startLevel() runs. Initial texture matches the starting level.
    const startBg = getLevelConfig(this.level).bgAsset;
    this.bgImage = this.add.image(W / 2, H / 2, startBg);
    const bgScale = Math.max(W / this.bgImage.width, H / this.bgImage.height);
    this.bgImage.setScale(bgScale);

    // Animated bg layers are created per-level in applyLevelBackground via setupBgAnimations(cfg.bgAnimations).

    // Maze-area dimmer — semi-transparent dark rectangle covering exactly the
    // maze tile region so dots and walls always read against any bg.
    const dimmer = this.add.rectangle(0, 0, 1, 1, 0x000000, 0.45);
    dimmer.setOrigin(0, 0).setDepth(1.5);
    this.mazeDimmer = dimmer;

    // Maze graphics layer — explicit depth above bg layers but below sprites/HUD
    this.mazeGraphics = this.add.graphics();
    this.mazeGraphics.setDepth(2);

    // Wall inner-glow layer — draws a 1px highlight just inside the wall
    // border with alpha pulsing 0 → 0.6 every ~1.8s. Additive blend so walls
    // feel like neon flickering rather than static blocks.
    this.wallGlowGraphics = this.add.graphics();
    this.wallGlowGraphics.setDepth(2.3).setBlendMode(Phaser.BlendModes.ADD);

    // Card sprites (power pellets) — depth 3 (above maze)
    this.cardSprites = [];
    for (let i = 0; i < 4; i++) {
      const card = this.add.image(0, 0, 'card');
      card.setVisible(false);
      card.setDepth(3);
      this.cardSprites.push(card);
    }

    // Bonus sprites — depth 3
    this.bonusSprites = [];
    for (let i = 0; i < 2; i++) {
      const bonus = this.add.image(0, 0, 'airplane');
      bonus.setVisible(false);
      bonus.setDepth(3);
      this.bonusSprites.push(bonus);
    }

    // Ghost sprites — depth 3
    this.ghostSprites = [];
    for (let i = 0; i < 3; i++) {
      const ghost = this.add.image(0, 0, 'monster-blue');
      ghost.setVisible(false);
      ghost.setDepth(3);
      this.ghostSprites.push(ghost);
    }

    // Entity graphics layer (overlays, trails)
    this.entityGraphics = this.add.graphics();
    // Laser beam layer — additive blend so beams glow over the maze.
    this.laserGraphics = this.add.graphics();
    this.laserGraphics.setDepth(3.6).setBlendMode(Phaser.BlendModes.ADD);
    // Magnet aura layer — sits below the player sprite.
    this.magnetAuraGraphics = this.add.graphics();
    this.magnetAuraGraphics.setDepth(3.4).setBlendMode(Phaser.BlendModes.ADD);

    // Player sprite — depth 4 (above maze at 2 and ghosts at 3)
    this.playerSprite = this.add.image(0, 0, 'trippie-a');
    this.playerSprite.setVisible(false);
    this.playerSprite.setDepth(4);

    // ← INTRO button (top-left)
    const introBtnG = this.add.graphics();
    introBtnG.fillStyle(0x1E1432, 0.8);
    introBtnG.fillRoundedRect(8, 6, 105, 24, 12);
    introBtnG.lineStyle(1, 0xFFFFFF, 0.15);
    introBtnG.strokeRoundedRect(8, 6, 105, 24, 12);
    introBtnG.setInteractive(
      new Phaser.Geom.Rectangle(8, 6, 105, 24),
      Phaser.Geom.Rectangle.Contains
    ).setDepth(50);
    this.add.text(60, 18, '← INTRO', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: '#FFFFFF',
    }).setOrigin(0.5).setDepth(50);
    introBtnG.on('pointerdown', () => {
      audioSystem.play('click');
      audioSystem.stopBGM();
      this.scene.start('HowToPlayScene');
    });

    // HUD — score left, level center, lives right (all vertically aligned)
    const hudY = 10;
    const hudStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '11px',
      color: '#ffffff',
    };

    const hudRow = HUD_HEIGHT + 2;
    this.scoreText = this.add.text(16, hudRow, 'SCORE: 0', hudStyle);
    this.levelText = this.add.text(W / 2, hudRow, 'LVL: 1', hudStyle).setOrigin(0.5, 0);
    this.livesContainer = this.add.container(W - 10, hudRow);

    // Brand subtitle under HUD — anchors the score framing to the campaign
    this.add.text(16, hudRow + 14, 'FROM FOREIGN FEES', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '6px',
      color: '#FFD700',
    }).setAlpha(0.7);

    // Mute toggle — bottom-right corner
    this.muteText = this.add.text(W - 14, H - 14, audioSystem.isMuted() ? '🔇' : '🔊', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '18px',
    }).setOrigin(1, 1).setDepth(60);
    this.muteText.setInteractive({ useHandCursor: true });
    this.muteText.on('pointerdown', () => {
      const next = !audioSystem.isMuted();
      audioSystem.setMuted(next);
      this.muteText.setText(next ? '🔇' : '🔊');
    });
    this.input.keyboard?.on('keydown-M', () => {
      const next = !audioSystem.isMuted();
      audioSystem.setMuted(next);
      this.muteText.setText(next ? '🔇' : '🔊');
    });

    // Screen flash (full canvas) — for level up glow
    this.screenFlash = this.add.rectangle(W / 2, H / 2, W, H, 0xFFFFFF, 0)
      .setDepth(98).setVisible(false);

    // Popup glow (radial graphics behind text)
    this.popupGlow = this.add.graphics();
    this.popupGlow.setDepth(99);
    this.popupGlow.setAlpha(0);

    // Popup text — fixed bigger size for visibility
    this.popupTextObj = this.add.text(W / 2, H / 2, '', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '28px',
      color: '#00D2C8',
      stroke: '#000000',
      strokeThickness: 5,
      align: 'center',
    }).setOrigin(0.5).setAlpha(0).setDepth(100);
  }

  private setupInput(): void {
    // Keyboard
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };

    // DEV ONLY — press N to clear remaining dots and trigger level-up.
    // TODO: REMOVE BEFORE PRODUCTION LAUNCH.
    this.input.keyboard!.on('keydown-N', () => {
      for (let r = 0; r < this.map.length; r++) {
        for (let c = 0; c < this.map[r].length; c++) {
          if (this.map[r][c] === 2) this.map[r][c] = 0;
        }
      }
      this.dotsLeft = 0;
      this.bonusLevelTimer = 0;
    });

    // Native touch events on document — exact port of v1's swipe logic
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 0) return;
      this.touchStartX = e.touches[0].clientX;
      this.touchStartY = e.touches[0].clientY;
      if (this.gameState === 'playing') e.preventDefault();
    };

    const onTouchMove = (e: TouchEvent) => {
      if (this.gameState === 'playing') e.preventDefault();
      if (this.gameState !== 'playing') return;
      if (e.touches.length === 0) return;

      const dx = e.touches[0].clientX - this.touchStartX;
      const dy = e.touches[0].clientY - this.touchStartY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      // 5px threshold like v1 — prevents jitter from flipping direction
      if (Math.max(absDx, absDy) < 5) return;

      if (absDx > absDy) {
        this.player.nextDir = dx > 0 ? Direction.RIGHT : Direction.LEFT;
      } else {
        this.player.nextDir = dy > 0 ? Direction.DOWN : Direction.UP;
      }

      // Reset origin for continuous chained swipes
      this.touchStartX = e.touches[0].clientX;
      this.touchStartY = e.touches[0].clientY;
    };

    document.addEventListener('touchstart', onTouchStart, { passive: false });
    document.addEventListener('touchmove', onTouchMove, { passive: false });

    // Clean up on scene shutdown
    this.events.once('shutdown', () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
    });
  }

  private startLevel(): void {
    const bpStyle = new URLSearchParams(window.location.search).get('bp');
    const cfgDemo = getLevelConfig(this.level);
    const fromCode = this.level > 1 ? getLevelConfig(this.level - 1).cityCode : 'YOU';
    if (bpStyle === 'fly') {
      this.time.delayedCall(200, () => {
        this.showFlightInterstitial(fromCode, cfgDemo.cityCode, cfgDemo.destination, cfgDemo.flag);
      });
    } else if (bpStyle === 'card' || bpStyle === 'departure' || bpStyle === 'stamp') {
      this.time.delayedCall(200, () => {
        this.showBoardingPass(bpStyle as any, cfgDemo.destination, cfgDemo.cityCode, cfgDemo.flag);
      });
    }
    this.applyLevelBackground();
    const cfg = getLevelConfig(this.level);
    this.map = cloneMaze(cfg.mazeKey);
    this.mazeMeta = analyzeMaze(this.map);
    // Snapshot stats at level start for the scoreboard delta
    this.levelStartScore = this.score;
    this.levelDotsAtStart = this.totalDotsEaten;
    this.levelGhostsAtStart = this.totalGhostsEaten;
    // Resize the dimmer to cover the maze region. Bonus levels keep a light
    // dim so the nebula bg shows through but pellets stay readable; main levels
    // use the full dimmer for contrast against busy destination art.
    this.mazeDimmer.setVisible(true);
    this.mazeDimmer.setPosition(this.offsetX, this.offsetY);
    this.mazeDimmer.setSize(COLS * this.tileSize, ROWS * this.tileSize);
    this.mazeDimmer.setFillStyle(0x000000, cfg.isBonus ? 0.55 : 0.45);
    this.dotsLeft = countDots(this.map);
    this.player = new Player(this.level, this.mazeMeta);
    this.ghosts = [];
    for (let i = 0; i < 3; i++) {
      this.ghosts.push(new Ghost(i, this.level, this.mazeMeta));
    }
    // Bonus level — teleport ghosts OUT of pen immediately, set scared + slow,
    // then they wander the chamber as eatable for 30s.
    if (cfg.isBonus) {
      this.bonusLevelTimer = 30000;
      for (const g of this.ghosts) {
        g.scared = true;
        g.speed *= 0.5;
        g.home = false;
        g.col = this.mazeMeta.penExit.col;
        g.row = this.mazeMeta.penExit.row;
        g.px = this.mazeMeta.penExit.col;
        g.py = this.mazeMeta.penExit.row;
      }
      this.showBonusIntro();
    } else {
      this.bonusLevelTimer = 0;
    }
    this.powerTimer = cfg.isBonus ? 30000 : 0;
    this.ghostScore = SCORE_GHOST_BASE;
    this.bonusItem = null;
    this.bonusSpawnTimer = cfg.isBonus ? 1000 : BONUS_FIRST_SPAWN_DELAY;
    this.boostTimer = 0;
    this.laserTimer = 0;
    this.laserCooldown = 0;
    this.magnetTimer = 0;
    this.magnetPullCooldown = 0;
    this.freezeTimer = 0;
    this.invincibleTimer = 0;
    this.gameState = 'playing';
    this.updateHUD();
    this.drawMaze();
  }

  private applyLevelBackground(): void {
    const cfg = getLevelConfig(this.level);
    if (this.bgImage.texture.key !== cfg.bgAsset) {
      this.bgImage.setTexture(cfg.bgAsset);
      const bgScale = Math.max(W / this.bgImage.width, H / this.bgImage.height);
      this.bgImage.setScale(bgScale);
    }
    this.setupBgAnimations(cfg.bgAnimations || []);
  }

  private setupBgAnimations(anims: import('../config/levels').BgAnim[]): void {
    // Always tear down previous level's animations first — fixes leak across levels.
    for (const t of this.bgAnimTweens) t.stop();
    this.bgAnimTweens = [];
    for (const s of this.bgAnimSprites) s.destroy();
    this.bgAnimSprites = [];

    for (const a of anims) {
      const sprite = this.add.image(a.startX, a.startY, a.sprite);
      sprite.setDepth(1);  // above bgImage (0), below mazeGraphics (2)
      sprite.setScale(a.scale);
      if (a.alpha !== undefined) sprite.setAlpha(a.alpha);
      if (a.flipX) sprite.setFlipX(true);
      this.bgAnimSprites.push(sprite);

      if (a.motion === 'scroll') {
        const tween = this.tweens.add({
          targets: sprite,
          x: a.endX ?? a.startX,
          y: a.endY ?? a.startY,
          duration: a.duration,
          repeat: -1,
          repeatDelay: a.repeatDelay ?? 0,
          ease: a.ease ?? 'Linear',
        });
        this.bgAnimTweens.push(tween);
      } else if (a.motion === 'blink') {
        const period = a.blinkPeriod ?? 1000;
        const tween = this.tweens.add({
          targets: sprite,
          alpha: 0.15,
          duration: period / 2,
          yoyo: true,
          repeat: -1,
          ease: 'Linear',
        });
        this.bgAnimTweens.push(tween);
      } else if (a.motion === 'orbit') {
        // Simple horizontal orbit ping-pong — for things like satellites circling
        const tween = this.tweens.add({
          targets: sprite,
          x: a.endX ?? a.startX,
          y: a.endY ?? a.startY,
          duration: a.duration,
          yoyo: true,
          repeat: -1,
          ease: a.ease ?? 'Sine.inOut',
        });
        this.bgAnimTweens.push(tween);
      }
    }
  }

  private resetAfterDeath(): void {
    this.player = new Player(this.level, this.mazeMeta);
    this.ghosts = [];
    for (let i = 0; i < 3; i++) {
      this.ghosts.push(new Ghost(i, this.level, this.mazeMeta));
    }
    this.powerTimer = 0;
    this.invincibleTimer = INVINCIBLE_DURATION;
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta, 100);

    this.handleInput();

    switch (this.gameState) {
      case 'dying':
        this.updateDying(dt);
        break;
      case 'levelwin':
        this.updateLevelWin(dt);
        break;
      case 'playing':
        this.updatePlaying(dt);
        break;
    }

    this.drawEntities();
  }

  private handleInput(): void {
    if (this.gameState !== 'playing') return;

    if (this.cursors.up.isDown || this.wasd.W.isDown) {
      this.player.nextDir = Direction.UP;
    } else if (this.cursors.down.isDown || this.wasd.S.isDown) {
      this.player.nextDir = Direction.DOWN;
    } else if (this.cursors.left.isDown || this.wasd.A.isDown) {
      this.player.nextDir = Direction.LEFT;
    } else if (this.cursors.right.isDown || this.wasd.D.isDown) {
      this.player.nextDir = Direction.RIGHT;
    }
  }

  private updateDying(dt: number): void {
    this.dyingTimer -= dt;
    if (this.dyingTimer <= 0) {
      this.lives--;
      if (this.lives <= 0) {
        audioSystem.stopBGM();
        audioSystem.play('gameover');
        this.scene.start('GameOverScene', {
          score: this.score,
          level: this.level,
          dotsEaten: this.totalDotsEaten,
          ghostsEaten: this.totalGhostsEaten,
        });
      } else {
        this.resetAfterDeath();
        this.gameState = 'playing';
      }
    }
    this.updateHUD();
  }

  private updateLevelWin(_dt: number): void {
    // No longer used — scoreboard owns the post-level flow now.
  }

  private showScoreboard(levelBonus: number): void {
    const cfg = getLevelConfig(this.level);
    const dotsThisLevel = this.totalDotsEaten - this.levelDotsAtStart;
    const ghostsThisLevel = this.totalGhostsEaten - this.levelGhostsAtStart;
    const finalScore = this.score;

    const objs: Phaser.GameObjects.GameObject[] = [];
    // Darker overlay
    const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x05050d, 0.92).setDepth(140);
    objs.push(overlay);

    // Confetti rain behind the panel — keeps screen feeling alive
    const colors = [0xffd700, 0xff6bb5, 0x4fc3f7, 0xffb347, 0x00d2c8];
    for (let i = 0; i < 24; i++) {
      const c = this.add.rectangle(Math.random() * W, -10 - Math.random() * 200, 4, 4,
        colors[i % colors.length]).setDepth(140.5).setRotation(Math.random() * Math.PI);
      objs.push(c);
      this.tweens.add({
        targets: c, y: H + 20, rotation: c.rotation + Math.PI * 4,
        duration: 3500 + Math.random() * 1500,
        delay: Math.random() * 800,
        ease: 'Linear',
        onComplete: () => c.destroy(),
      });
    }

    // Card layout — 76% width, 460 tall. Code-drawn panel: dark inner + thin
    // magenta border + 1px cyan inner glow. No asset frame — keeps the focus
    // on stats, lets Trippie read large.
    const cw = W * 0.78, ch = 460, cx = W / 2, cy = H / 2;
    const panel = this.add.rectangle(cx, cy, cw, ch, 0x1a0e2e, 0.97)
      .setStrokeStyle(3, 0xff3ec8, 1)
      .setDepth(141).setAlpha(0).setScale(0.7);
    objs.push(panel);
    this.tweens.add({
      targets: panel, alpha: 1, scale: 1,
      duration: 320, ease: 'Back.easeOut',
    });
    // Inner cyan glow line — sits 1px inside the magenta border for the
    // arcade neon feel without an asset.
    const innerGlow = this.add.rectangle(cx, cy, cw - 10, ch - 10, 0x000000, 0)
      .setStrokeStyle(1, 0x00d2c8, 0.65)
      .setDepth(141.5).setAlpha(0);
    objs.push(innerGlow);
    this.tweens.add({ targets: innerGlow, alpha: 1, duration: 320, delay: 120 });

    // Header — bigger gold text + small pulse
    const header = this.add.text(cx, cy - ch / 2 + 38, cfg.isBonus ? '🚀 BONUS CLEAR!' : `LVL ${this.level} CLEARED`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '22px', color: '#FFD700',
      stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(143).setAlpha(0).setScale(0.8);
    objs.push(header);
    this.tweens.add({ targets: header, alpha: 1, scale: 1, duration: 350, delay: 150, ease: 'Back.easeOut' });

    const flagText = this.add.text(cx, cy - ch / 2 + 72, `${cfg.flag} ${cfg.destination.toUpperCase()}`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '13px', color: '#00d2c8',
    }).setOrigin(0.5).setDepth(143).setAlpha(0);
    objs.push(flagText);
    this.tweens.add({ targets: flagText, alpha: 1, duration: 280, delay: 350 });

    // Trippie victory mascot — large, anchors the celebration. Sits between
    // the country text and the stat rows.
    const victory = this.add.image(cx, cy - ch / 2 + 158, 'trippie-victory')
      .setDepth(144);
    victory.setDisplaySize(168, 112);
    const vSx = victory.scaleX;
    const vSy = victory.scaleY;
    victory.setAlpha(0).setScale(0);
    objs.push(victory);
    this.tweens.add({
      targets: victory, alpha: 1, scaleX: vSx, scaleY: vSy,
      duration: 420, delay: 280, ease: 'Back.easeOut',
    });
    this.time.delayedCall(720, () => {
      this.tweens.add({
        targets: victory, y: victory.y - 3,
        yoyo: true, repeat: -1, duration: 760, ease: 'Sine.easeInOut',
      });
    });

    // Stat rows — bigger fonts, more breathing room
    const statY = cy + 5;
    const rowGap = 36;
    const stats = [
      { icon: '🪙', label: 'CURRENCIES', value: dotsThisLevel, color: '#FFD700' },
      { icon: '👾', label: 'MONSTERS', value: ghostsThisLevel, color: '#FF6BB5' },
      { icon: '⭐', label: 'LVL BONUS', value: levelBonus, prefix: '+', color: '#4FC3F7' },
    ];
    stats.forEach((s, i) => {
      const y = statY + i * rowGap;
      const labelText = this.add.text(cx - cw / 2 + 24, y, `${s.icon}  ${s.label}`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '13px', color: '#ffffff',
      }).setOrigin(0, 0.5).setDepth(143).setAlpha(0);
      objs.push(labelText);
      const valText = this.add.text(cx + cw / 2 - 24, y, '0', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '19px', color: s.color,
        stroke: '#000', strokeThickness: 3,
      }).setOrigin(1, 0.5).setDepth(143).setAlpha(0);
      objs.push(valText);
      const delay = 600 + i * 220;
      this.tweens.add({ targets: [labelText, valText], alpha: 1, duration: 250, delay });
      const obj = { v: 0 };
      let lastTickV = 0;
      this.tweens.add({
        targets: obj, v: s.value,
        duration: 500, delay: delay + 50, ease: 'Cubic.easeOut',
        onUpdate: () => {
          const cur = Math.floor(obj.v);
          valText.setText(`${s.prefix || ''}${cur}`);
          // Counting tick — fire every 4 units climbed (caps the rate so 142
          // doesn't sound like a machine gun).
          if (cur - lastTickV >= Math.max(1, Math.ceil(s.value / 14))) {
            lastTickV = cur;
            audioSystem.play('tick');
          }
        },
        onComplete: () => {
          valText.setText(`${s.prefix || ''}${s.value}`);
          audioSystem.play('pop');
          this.tweens.add({ targets: valText, scale: 1.25, yoyo: true, duration: 180 });
        },
      });
    });

    // TOTAL row — divider + glowing total
    const totalY = statY + stats.length * rowGap + 30;
    const divider = this.add.rectangle(cx, totalY - 12, cw - 48, 2, 0x00d2c8, 0.5).setDepth(143).setAlpha(0);
    objs.push(divider);
    this.tweens.add({ targets: divider, alpha: 1, duration: 250, delay: 1300 });

    const totalLabel = this.add.text(cx - cw / 2 + 24, totalY + 14, 'TOTAL', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '15px', color: '#ffffff',
    }).setOrigin(0, 0.5).setDepth(143).setAlpha(0);
    objs.push(totalLabel);
    this.tweens.add({ targets: totalLabel, alpha: 1, duration: 250, delay: 1400 });

    // Glow effect — additive yellow rect behind total
    const totalGlow = this.add.rectangle(cx + cw / 2 - 60, totalY + 14, 120, 36, 0xFFD700, 0)
      .setDepth(142).setBlendMode(Phaser.BlendModes.ADD);
    objs.push(totalGlow);

    const totalText = this.add.text(cx + cw / 2 - 24, totalY + 14, `${this.levelStartScore}`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '28px', color: '#FFD700',
      stroke: '#000', strokeThickness: 5,
    }).setOrigin(1, 0.5).setDepth(144).setAlpha(0);
    objs.push(totalText);
    this.tweens.add({ targets: totalText, alpha: 1, duration: 250, delay: 1400 });

    const totalObj = { v: this.levelStartScore };
    this.tweens.add({
      targets: totalObj, v: finalScore,
      duration: 950, delay: 1500, ease: 'Cubic.easeOut',
      onUpdate: () => totalText.setText(`${Math.floor(totalObj.v)}`),
      onComplete: () => {
        totalText.setText(`${finalScore}`);
        // Big pulse + glow flash + emphatic pop
        this.tweens.add({ targets: totalText, scale: 1.3, yoyo: true, duration: 200, ease: 'Sine.easeOut' });
        this.tweens.add({ targets: totalGlow, alpha: 0.6, yoyo: true, duration: 250 });
        audioSystem.play('pop');
      },
    });

    // Proceed button — bouncier entry
    const btn = this.add.rectangle(cx, cy + ch / 2 - 32, cw - 60, 50, 0x00d2c8, 1)
      .setDepth(143).setStrokeStyle(2, 0xffffff, 1).setAlpha(0).setScale(0.6);
    objs.push(btn);
    const btnLabel = this.add.text(cx, cy + ch / 2 - 32, 'NEXT TRIP →', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '16px', color: '#0d0d1a',
    }).setOrigin(0.5).setDepth(144).setAlpha(0);
    objs.push(btnLabel);
    this.tweens.add({ targets: [btn, btnLabel], alpha: 1, scale: 1, duration: 350, delay: 2500, ease: 'Back.easeOut' });
    // Pulse the button so it reads as actionable
    this.time.delayedCall(2900, () => {
      this.tweens.add({ targets: btn, scaleX: 1.04, scaleY: 1.06, yoyo: true, repeat: -1, duration: 700 });
    });

    btn.setInteractive({ useHandCursor: true });
    const proceed = () => {
      btn.disableInteractive();
      this.tweens.add({
        targets: objs,
        alpha: 0,
        duration: 200,
        onComplete: () => {
          objs.forEach(o => (o as any).destroy && (o as any).destroy());
          const fromCode = getLevelConfig(this.level).cityCode;
          this.level++;
          const next = getLevelConfig(this.level);
          // New 2-phase transition: stamp held long for readability, then plane wipe.
          this.showLevelTransition(fromCode, next.cityCode, next.destination, next.flag);
          this.transitionFreezeTimer = 3800;
          this.startLevel();
        },
      });
    };
    btn.on('pointerdown', proceed);
    // Also allow Enter/Space to proceed once button is visible
    const keyHandler = (e: KeyboardEvent) => {
      if ((e.key === 'Enter' || e.key === ' ') && this.gameState === 'scoreboard') {
        document.removeEventListener('keydown', keyHandler);
        proceed();
      }
    };
    this.time.delayedCall(2400, () => {
      document.addEventListener('keydown', keyHandler);
    });
  }

  private updatePlaying(dt: number): void {
    if (this.transitionFreezeTimer > 0) {
      this.transitionFreezeTimer -= dt;
      // Pause everything during the level-transition interstitial
      return;
    }
    if (this.invincibleTimer > 0) this.invincibleTimer -= dt;
    if (this.freezeTimer > 0) this.freezeTimer -= dt;
    if (this.boostTimer > 0) this.boostTimer -= dt;
    if (this.popupTimer > 0) this.popupTimer -= dt;
    if (this.laserTimer > 0) {
      this.laserTimer -= dt;
      this.fireLaser();  // continuous — redraws every frame, kills any monster in path
      if (this.laserTimer <= 0) this.laserGraphics.clear();
    }
    if (this.magnetTimer > 0) {
      this.magnetTimer -= dt;
      this.magnetPullCooldown -= dt;
      if (this.magnetPullCooldown <= 0) {
        this.pullMagnetDots();
        this.magnetPullCooldown = MAGNET_PULL_INTERVAL;
      }
    }
    if (this.bonusLevelTimer > 0) {
      this.bonusLevelTimer -= dt;
      this.updateHUD();
    }
    // Combo decay
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.comboCount = 0;
        if (this.comboText) { this.comboText.destroy(); this.comboText = undefined; }
      } else {
        const mult = Math.min(1 + Math.floor(this.comboCount / 5), 4);
        if (mult > 1) {
          if (!this.comboText) {
            this.comboText = this.add.text(W / 2, HUD_HEIGHT + 32, `🔥 COMBO x${mult}`, {
              fontFamily: '"Press Start 2P", monospace',
              fontSize: '10px',
              color: '#FF6BB5',
              stroke: '#000000', strokeThickness: 3,
            }).setOrigin(0.5, 0).setDepth(80);
          } else {
            this.comboText.setText(`🔥 COMBO x${mult}`);
          }
        } else if (this.comboText) {
          this.comboText.destroy(); this.comboText = undefined;
        }
      }
    }

    // Bonus spawn
    if (!this.bonusItem) {
      this.bonusSpawnTimer -= dt;
      if (this.bonusSpawnTimer <= 0) {
        this.bonusItem = spawnBonus(this.map, this.player);
        this.bonusSpawnTimer = BONUS_SPAWN_MIN + Math.random() * (BONUS_SPAWN_MAX - BONUS_SPAWN_MIN);
      }
    } else {
      this.bonusItem.timer -= dt;
      if (this.bonusItem.timer <= 0) this.bonusItem = null;
    }

    // Power timer
    if (this.powerTimer > 0) {
      this.powerTimer -= dt;
      if (this.powerTimer <= 0) {
        this.powerTimer = 0;
        this.ghosts.forEach(g => { g.scared = false; });
      }
    }

    // Move player
    const collected = this.player.move(this.map, dt, this.boostTimer > 0);
    if (collected) {
      this.collectAtTile(collected.col, collected.row);
      if (this.gameState !== 'playing') return;
    }

    // Move ghosts
    const frozen = this.freezeTimer > 0;
    this.ghosts.forEach(g => {
      g.update(this.map, this.player, dt, frozen, this.powerTimer > 0);
    });

    this.checkCollisions();
  }

  private collectAtTile(col: number, row: number): void {
    const tile = this.map[row][col];
    const cfg = getLevelConfig(this.level);
    const bonusMult = cfg.isBonus ? 3 : 1;
    if (tile === DOT) {
      this.map[row][col] = EMPTY;
      // Combo: chained dots within 1.5s build a multiplier (1x → 2x → 3x → 4x cap)
      this.comboCount = Math.min(this.comboCount + 1, 50);
      this.comboTimer = 1500;
      const comboMult = Math.min(1 + Math.floor(this.comboCount / 5), 4);
      const earned = SCORE_DOT * comboMult * bonusMult;
      this.score += earned;
      this.dotsLeft--;
      this.totalDotsEaten++;
      this.spawnScoreFloater(earned, col, row);
      this.spawnCollectParticles(col, row, 0xffd700);
      audioSystem.play('dot');
      this.drawMaze();
    } else if (tile === POWER) {
      this.map[row][col] = EMPTY;
      const earned = SCORE_POWER * bonusMult;
      this.score += earned;
      this.spawnScoreFloater(earned, col, row);
      this.spawnCollectParticles(col, row, 0xff6bb5);
      this.cameras.main.shake(120, 0.003);
      // Don't decrement dotsLeft — power pellets don't gate level-up
      this.powerTimer = POWER_DURATION;
      this.ghostScore = SCORE_GHOST_BASE;
      this.ghosts.forEach(g => {
        if (!g.eaten && !g.home && !g.respawning) g.scared = true;
      });
      if (!cfg.isBonus) this.showPopup('CHOMP ON FEE MONSTERS!');
      audioSystem.play('power');
      this.drawMaze();
    }

    // Bonus collection — single-cell pickup
    if (this.bonusItem && col === this.bonusItem.col && row === this.bonusItem.row) {
      const type = this.bonusItem.type;
      const earned = SCORE_BONUS * bonusMult;
      this.score += earned;
      this.spawnScoreFloater(earned, this.player.col, this.player.row);
      this.spawnCollectParticles(this.player.col, this.player.row, 0xffb347);
      this.cameras.main.shake(220, 0.008);
      this.bonusItem = null;
      if (type === 'laser') {
        this.laserTimer = LASER_DURATION;
        this.laserCooldown = 0;
        this.showPopup('LASER LOCKED ON!');
      } else if (type === 'freeze') {
        this.freezeTimer = FREEZE_DURATION;
        this.showPopup('RATES LOCKED!');
      } else if (type === 'magnet') {
        this.magnetTimer = MAGNET_DURATION;
        this.magnetPullCooldown = 0;
        this.showPopup('MAGNET ACTIVE!');
      }
      audioSystem.play('power');
    }

    const levelEnd = cfg.isBonus
      ? this.bonusLevelTimer <= 0
      : this.dotsLeft <= 0;
    if (levelEnd) {
      this.gameState = 'scoreboard';
      const bonus = 500 * this.level;
      this.score += bonus;
      this.spawnCelebration();
      audioSystem.play('levelup');
      this.showScoreboard(bonus);
      this.updateHUD();
    }
    this.updateHUD();
  }

  private checkCollisions(): void {
    for (const g of this.ghosts) {
      if (g.home || g.respawning || g.eaten) continue;
      if (g.col === this.player.col && g.row === this.player.row) {
        if (g.scared) {
          g.eaten = true;
          g.scared = false;
          this.score += this.ghostScore;
          this.spawnScoreFloater(this.ghostScore, g.col, g.row);
          this.spawnCollectParticles(g.col, g.row, 0xff6bb5);
          this.cameras.main.shake(140, 0.004);
          this.ghostScore *= 2;
          this.totalGhostsEaten++;
          audioSystem.play('ghost');
          this.updateHUD();
        } else if (this.invincibleTimer <= 0) {
          this.gameState = 'dying';
          this.dyingTimer = DYING_DURATION;
          audioSystem.play('die');
        }
      }
    }
  }

  private showPopup(text: string): void {
    this.popupText = text;
    this.popupTimer = POPUP_DURATION;

    // Stop any in-flight tween
    if (this.popupTween) this.popupTween.stop();

    const isLevelUp = text === 'LEVEL UP!';
    const popupColor = isLevelUp ? '#FFD700' : '#00D2C8';
    // Auto-size font based on text length so it always fits within 460px (480 canvas - margin)
    // Press Start 2P chars are roughly 1.0x font size wide
    const maxWidth = 460;
    let fontSize: string;
    if (isLevelUp) {
      fontSize = '40px';
    } else {
      const len = text.length;
      const idealSize = Math.floor(maxWidth / len);
      fontSize = `${Math.max(14, Math.min(24, idealSize))}px`;
    }

    // Configure text
    this.popupTextObj.setText(text);
    this.popupTextObj.setColor(popupColor);
    this.popupTextObj.setFontSize(fontSize);
    this.popupTextObj.setScale(0.4);
    this.popupTextObj.setAlpha(0);

    // Bounce-in scale + fade-in
    this.popupTween = this.tweens.add({
      targets: this.popupTextObj,
      scale: { from: 0.4, to: 1.0 },
      alpha: { from: 0, to: 1 },
      duration: 280,
      ease: 'Back.easeOut',
      onComplete: () => {
        // Hold, then fade out
        this.tweens.add({
          targets: this.popupTextObj,
          alpha: 0,
          scale: 1.15,
          duration: 400,
          delay: POPUP_DURATION - 280 - 400,
          ease: 'Sine.easeIn',
        });
      },
    });

    // No glow — just the text animation
    this.popupGlow.clear();
    this.popupGlow.setAlpha(0);
  }

  private dotFloaterCounter: number = 0;

  private spawnCollectParticles(col: number, row: number, color: number): void {
    const T = this.tileSize;
    const cx = this.offsetX + col * T + T / 2;
    const cy = this.offsetY + row * T + T / 2;
    const N = 4;
    for (let i = 0; i < N; i++) {
      const angle = (Math.PI * 2 * i) / N + Math.random() * 0.4;
      const dist = T * 0.6;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist;
      const p = this.add.circle(cx, cy, 2, color);
      p.setDepth(45);
      this.tweens.add({
        targets: p,
        x: cx + dx,
        y: cy + dy,
        alpha: 0,
        scale: 0.2,
        duration: 350,
        ease: 'Cubic.easeOut',
        onComplete: () => p.destroy(),
      });
    }
  }

  private spawnLevelBonusFly(amount: number): void {
    // Big "+500" originates BELOW the LEVEL UP popup so they don't collide.
    const big = this.add.text(W / 2, H / 2 + 80, `+${amount}`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '28px',
      color: '#FFD700',
      stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(110).setScale(0.2).setAlpha(0);
    this.tweens.add({
      targets: big,
      alpha: 1,
      scale: 1,
      duration: 250,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: big,
          x: 80,
          y: HUD_HEIGHT + 8,
          alpha: 0,
          scale: 0.4,
          duration: 600,
          delay: 250,
          ease: 'Cubic.easeIn',
          onComplete: () => big.destroy(),
        });
      },
    });

    // Score number ticker — animate from old to new over ~1s.
    const startScore = this.score;
    const targetScore = startScore + amount;
    const obj = { v: startScore };
    this.tickingScore = true;
    this.tweens.add({
      targets: obj,
      v: targetScore,
      duration: 950,
      delay: 350,
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        this.scoreText.setText(`SCORE: ${Math.floor(obj.v)}`);
      },
      onComplete: () => {
        this.tickingScore = false;
        this.scoreText.setText(`SCORE: ${this.score}`);
      },
    });
  }

  private spawnCelebration(): void {
    // Confetti — 18 colored particles burst from player position upward.
    const T = this.tileSize;
    const cx = this.offsetX + this.player.col * T + T / 2;
    const cy = this.offsetY + this.player.row * T + T / 2;
    const colors = [0xffd700, 0xff6bb5, 0x4fc3f7, 0xffb347, 0x00d2c8];
    for (let i = 0; i < 18; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI;
      const speed = 80 + Math.random() * 120;
      const dx = Math.cos(angle) * speed;
      const dy = Math.sin(angle) * speed;
      const c = this.add.rectangle(cx, cy, 4, 4, colors[i % colors.length]);
      c.setDepth(105);
      c.setRotation(Math.random() * Math.PI);
      this.tweens.add({
        targets: c,
        x: cx + dx,
        y: cy + dy + 60, // gravity
        rotation: c.rotation + Math.PI * 2,
        alpha: 0,
        duration: 900 + Math.random() * 300,
        ease: 'Quad.easeOut',
        onComplete: () => c.destroy(),
      });
    }
    // Trippie celebration jump — quick scale bounce
    this.tweens.add({
      targets: this.playerSprite,
      scale: this.playerSprite.scale * 1.4,
      yoyo: true,
      duration: 250,
      ease: 'Sine.easeOut',
    });
  }

  /**
   * Two-phase level transition:
   *  Phase A (0–2600ms): boarding stamp/destination reveal — held long enough to read
   *  Phase B (2600–3800ms): plane wipe across screen with contrail (transition out)
   * Caller sets transitionFreezeTimer to 3800.
   */
  showLevelTransition(fromCode: string, toCode: string, destinationName: string, flag: string): void {
    const objs: Phaser.GameObjects.GameObject[] = [];

    // Boarding pass slam SFX — synced to the camera shake on stamp slam below.
    audioSystem.play('whoosh');

    // Dark cosmic overlay
    const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x0a0a1a, 0).setDepth(120);
    objs.push(overlay);
    this.tweens.add({ targets: overlay, alpha: 0.92, duration: 240 });

    // Twinkle stars
    for (let i = 0; i < 35; i++) {
      const star = this.add.rectangle(Math.random() * W, Math.random() * H, 2, 2, 0xffffff, 0.7).setDepth(121);
      objs.push(star);
      this.tweens.add({ targets: star, alpha: 0.15, yoyo: true, repeat: -1, duration: 400 + Math.random() * 600 });
    }

    // ===== Phase A: Boarding stamp slams in (250ms-2600ms hold) =====
    const nextCfg = getLevelConfig(this.level);
    const isBonusNext = nextCfg.isBonus === true;

    // Brand purple card with cyan border (or magenta for bonus)
    const cardW = W * 0.84, cardH = 240;
    const cardBg = this.add.rectangle(W / 2, H / 2, cardW, cardH, 0x2a1845, 0.97)
      .setDepth(124)
      .setStrokeStyle(3, isBonusNext ? 0xff3ec8 : 0x00d2c8, 1)
      .setAlpha(0).setScale(0.6).setRotation(-0.05);
    objs.push(cardBg);
    this.tweens.add({ targets: cardBg, alpha: 1, scale: 1, rotation: 0, duration: 350, ease: 'Back.easeOut' });

    // Header — tagline lives in level config (e.g. "MORE YEN FOR MY RAMEN")
    const headerText = isBonusNext ? '★ BONUS ROUND ★' : nextCfg.tagline;
    const header = this.add.text(W / 2, H / 2 - cardH / 2 + 28, headerText, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: headerText.length > 18 ? '9px' : '11px',
      color: isBonusNext ? '#ff3ec8' : '#00d2c8',
    }).setOrigin(0.5).setDepth(125).setAlpha(0);
    objs.push(header);
    this.tweens.add({ targets: header, alpha: 1, duration: 280, delay: 200 });

    // Big copy — destination name OR "BONUS LEVEL"
    const bigText = isBonusNext ? 'BONUS LEVEL' : destinationName.toUpperCase();
    const big = this.add.text(W / 2, H / 2 - 10, bigText, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: bigText.length > 8 ? '24px' : '32px',
      color: '#FFD700',
      stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(125).setAlpha(0).setScale(0.6);
    objs.push(big);
    this.tweens.add({ targets: big, alpha: 1, scale: 1, duration: 350, delay: 350, ease: 'Back.easeOut' });

    // Subline — flag/code on travel transitions, "SURVIVE 30 SECONDS" on bonus
    const sublineText = isBonusNext ? 'SURVIVE 30 SECONDS' : `${flag} ${toCode}`;
    const flagText = this.add.text(W / 2, H / 2 + 32, sublineText, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: isBonusNext ? '14px' : '18px',
      color: isBonusNext ? '#FFFFFF' : '#FFFFFF',
      stroke: '#2a1845', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(125).setAlpha(0);
    objs.push(flagText);
    this.tweens.add({ targets: flagText, alpha: 1, duration: 280, delay: 600 });

    // Route ribbon — only on regular travel transitions with a known origin
    const ribbonObjs: Phaser.GameObjects.GameObject[] = [];
    if (!isBonusNext && fromCode) {
      const ribbonY = H / 2 + cardH / 2 - 32;
      const fromText = this.add.text(W / 2 - 80, ribbonY, fromCode, {
        fontFamily: '"Press Start 2P", monospace', fontSize: '11px', color: '#00d2c8',
      }).setOrigin(0.5).setDepth(125).setAlpha(0);
      ribbonObjs.push(fromText);
      const arrowText = this.add.text(W / 2, ribbonY, '→', {
        fontFamily: 'monospace', fontSize: '20px', color: '#FFD700',
      }).setOrigin(0.5).setDepth(125).setAlpha(0);
      ribbonObjs.push(arrowText);
      const toText = this.add.text(W / 2 + 80, ribbonY, toCode, {
        fontFamily: '"Press Start 2P", monospace', fontSize: '11px', color: '#FFD700',
      }).setOrigin(0.5).setDepth(125).setAlpha(0);
      ribbonObjs.push(toText);
      objs.push(...ribbonObjs);
      this.tweens.add({ targets: ribbonObjs, alpha: 1, duration: 350, delay: 800 });
    }

    // Stamp shake on slam
    this.cameras.main.shake(220, 0.008);

    // ===== Phase B: Plane wipe across (starts ~2600ms) =====
    this.time.delayedCall(2600, () => {
      // Fade card down so plane gets focus
      this.tweens.add({ targets: [cardBg, header, big, flagText, ...ribbonObjs], alpha: 0, duration: 250 });

      // Plane streaks across with a particle contrail
      const plane = this.add.image(-100, H * 0.5, 'plane-side').setDepth(123);
      plane.setScale(190 / plane.width).setAlpha(1);
      objs.push(plane);
      this.tweens.add({ targets: plane, x: W + 100, duration: 1100, ease: 'Sine.easeInOut' });

      const contrail = this.time.addEvent({
        delay: 30, repeat: 35,
        callback: () => {
          const p = this.add.rectangle(plane.x - 30, plane.y + 4, 4, 4, 0xffffff, 0.8).setDepth(122);
          objs.push(p);
          this.tweens.add({
            targets: p, alpha: 0, scale: 0.3, duration: 700,
            ease: 'Cubic.easeOut', onComplete: () => p.destroy(),
          });
        },
      });
      objs.push(contrail as any);
    });

    // Final fade-out at 3800ms (covers the new level fade-in)
    this.time.delayedCall(3700, () => {
      this.tweens.add({
        targets: objs.filter(o => 'alpha' in (o as any)),
        alpha: 0, duration: 300,
        onComplete: () => objs.forEach(o => (o as any).destroy && (o as any).destroy()),
      });
    });
  }

  showFlightInterstitial(fromCode: string, toCode: string, destinationName: string, flag: string): void {
    // 2.2s sequence with brand polish:
    //  - Dark overlay + twinkle stars
    //  - Plane flies left→right with particle contrail
    //  - Route ribbon below plane: SIN → TYO with arrow drawing in
    //  - City code centerpiece slams down with brand-colored stamp + letter flip
    //  - Camera shake on slam
    const objs: Phaser.GameObjects.GameObject[] = [];
    const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x0a0a1a, 0).setDepth(120);
    objs.push(overlay);
    this.tweens.add({ targets: overlay, alpha: 0.88, duration: 200 });

    // Twinkle stars
    for (let i = 0; i < 35; i++) {
      const star = this.add.rectangle(Math.random() * W, Math.random() * H, 2, 2, 0xffffff, 0.7).setDepth(121);
      objs.push(star);
      this.tweens.add({
        targets: star, alpha: 0.15, yoyo: true, repeat: -1,
        duration: 400 + Math.random() * 600,
      });
    }

    // Plane + contrail particle emitter
    const plane = this.add.image(-100, H * 0.32, 'plane-side').setDepth(123);
    plane.setScale(170 / plane.width).setAlpha(1);
    objs.push(plane);

    // Particle contrail behind plane — spawn small white pixels every frame
    const contrail = this.time.addEvent({
      delay: 35,
      repeat: 50,
      callback: () => {
        const p = this.add.rectangle(plane.x - 30, plane.y + 4, 3, 3, 0xffffff, 0.7).setDepth(122);
        objs.push(p);
        this.tweens.add({
          targets: p,
          alpha: 0,
          scale: 0.3,
          duration: 700,
          ease: 'Cubic.easeOut',
          onComplete: () => p.destroy(),
        });
      },
    });
    objs.push(contrail as any);

    // Route ribbon below plane
    const ribbonY = plane.y + 56;
    const fromText = this.add.text(60, ribbonY, fromCode, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '13px', color: '#FFD700',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0, 0.5).setDepth(123).setAlpha(0);
    objs.push(fromText);
    const toText = this.add.text(W - 60, ribbonY, toCode, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '13px', color: '#FFD700',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(1, 0.5).setDepth(123).setAlpha(0);
    objs.push(toText);
    const arrow = this.add.text(W / 2, ribbonY, '→', {
      fontFamily: 'monospace', fontSize: '24px', color: '#00d2c8',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(123).setAlpha(0).setScale(0.5);
    objs.push(arrow);
    this.tweens.add({ targets: [fromText, toText], alpha: 1, duration: 300, delay: 250 });
    this.tweens.add({ targets: arrow, alpha: 1, scale: 1, duration: 350, delay: 600, ease: 'Back.easeOut' });

    // Plane scroll
    this.tweens.add({
      targets: plane,
      x: W + 100,
      duration: 1700,
      delay: 200,
      ease: 'Sine.easeInOut',
    });

    // City code slam — brand-colored card + letter flip
    this.time.delayedCall(1500, () => {
      const slamY = H / 2 + 40;
      // Brand purple card behind the code (using Rectangle GameObject for clean positioning)
      const cardBg = this.add.rectangle(W / 2, slamY, W * 0.7, 130, 0x2a1845, 0.95)
        .setDepth(124).setStrokeStyle(3, 0x00d2c8, 1).setAlpha(0).setScale(0.7);
      objs.push(cardBg);
      this.tweens.add({ targets: cardBg, alpha: 1, scale: 1, duration: 250, ease: 'Back.easeOut' });

      // City code letters fly in one by one
      const letterStartX = W / 2 - (toCode.length * 28) / 2 + 14;
      toCode.split('').forEach((ch, i) => {
        const letter = this.add.text(letterStartX + i * 28, slamY - 18, ch, {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: '40px',
          color: '#FFD700',
          stroke: '#2a1845', strokeThickness: 5,
        }).setOrigin(0.5).setDepth(125).setScale(3).setAlpha(0).setRotation(-0.3);
        objs.push(letter);
        this.tweens.add({
          targets: letter,
          scale: 1, alpha: 1, rotation: 0,
          duration: 250, delay: i * 80,
          ease: 'Back.easeOut',
        });
      });

      // Subtitle
      const sub = this.add.text(W / 2, slamY + 32, `${flag}  ${destinationName.toUpperCase()}`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '11px', color: '#00d2c8',
        stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(125).setAlpha(0);
      objs.push(sub);
      this.tweens.add({ targets: sub, alpha: 1, duration: 250, delay: 350 });

      this.cameras.main.shake(220, 0.008);
    });

    // Auto-fade after 2.2s
    this.time.delayedCall(2200, () => {
      this.tweens.add({
        targets: objs.filter(o => 'alpha' in (o as any)),
        alpha: 0,
        duration: 250,
        onComplete: () => objs.forEach(o => (o as any).destroy && (o as any).destroy()),
      });
    });
  }

  showBoardingPass(style: 'card' | 'departure' | 'stamp', destinationName: string, cityCode: string, flag: string): Phaser.GameObjects.GameObject[] {
    const objs: Phaser.GameObjects.GameObject[] = [];
    const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.7).setDepth(120);
    objs.push(overlay);

    if (style === 'card') {
      // Boarding pass ticket — beige card with route, dotted tear edge.
      const card = this.add.graphics().setDepth(121);
      const cw = W * 0.85, ch = 230, cx = (W - cw) / 2, cy = H / 2 - ch / 2;
      card.fillStyle(0xf5e8c9, 1);
      card.fillRoundedRect(cx, cy, cw, ch, 8);
      card.lineStyle(2, 0x2a1845, 1);
      card.strokeRoundedRect(cx, cy, cw, ch, 8);
      // Tear-off perforation line
      card.lineStyle(1, 0x2a1845, 0.5);
      const perfX = cx + cw * 0.7;
      for (let y = cy + 10; y < cy + ch - 10; y += 8) {
        card.lineBetween(perfX, y, perfX, y + 4);
      }
      objs.push(card);
      objs.push(this.add.text(cx + 18, cy + 18, 'YOUTRIP AIRLINES', { fontFamily: '"Press Start 2P", monospace', fontSize: '8px', color: '#2a1845' }).setDepth(121));
      objs.push(this.add.text(cx + 18, cy + 50, 'SIN', { fontFamily: '"Press Start 2P", monospace', fontSize: '32px', color: '#2a1845' }).setDepth(121));
      objs.push(this.add.text(cx + 18 + 90, cy + 60, '✈', { fontSize: '28px', color: '#00d2c8' }).setDepth(121));
      objs.push(this.add.text(cx + 18 + 140, cy + 50, cityCode, { fontFamily: '"Press Start 2P", monospace', fontSize: '32px', color: '#2a1845' }).setDepth(121));
      objs.push(this.add.text(cx + 18, cy + 110, `${flag}  ${destinationName.toUpperCase()}`, { fontFamily: '"Press Start 2P", monospace', fontSize: '14px', color: '#d4a017' }).setDepth(121));
      objs.push(this.add.text(cx + 18, cy + 145, 'GATE A23   SEAT 1A', { fontFamily: '"Press Start 2P", monospace', fontSize: '8px', color: '#2a1845' }).setDepth(121));
      objs.push(this.add.text(cx + 18, cy + 165, 'BOARDING NOW', { fontFamily: '"Press Start 2P", monospace', fontSize: '10px', color: '#c54128' }).setDepth(121));
      objs.push(this.add.text(perfX + 18, cy + 50, cityCode, { fontFamily: '"Press Start 2P", monospace', fontSize: '20px', color: '#2a1845' }).setDepth(121));
      objs.push(this.add.text(perfX + 18, cy + 80, '1A', { fontFamily: '"Press Start 2P", monospace', fontSize: '24px', color: '#2a1845' }).setDepth(121));
    } else if (style === 'departure') {
      // Split-flap departure board — black bg, amber chars
      const board = this.add.graphics().setDepth(121);
      const bw = W * 0.88, bh = 200, bx = (W - bw) / 2, by = H / 2 - bh / 2;
      board.fillStyle(0x111111, 1).fillRoundedRect(bx, by, bw, bh, 4);
      board.lineStyle(2, 0xffb347, 1).strokeRoundedRect(bx, by, bw, bh, 4);
      objs.push(board);
      objs.push(this.add.text(bx + 14, by + 14, 'DEPARTURES', { fontFamily: '"Press Start 2P", monospace', fontSize: '10px', color: '#ffb347' }).setDepth(121));
      objs.push(this.add.text(bx + bw - 14, by + 14, '──', { fontFamily: '"Press Start 2P", monospace', fontSize: '10px', color: '#ffb347' }).setOrigin(1, 0).setDepth(121));
      objs.push(this.add.text(bx + bw / 2, by + 60, `${flag}  ${destinationName.toUpperCase()}`, { fontFamily: '"Press Start 2P", monospace', fontSize: '20px', color: '#ffb347' }).setOrigin(0.5).setDepth(121));
      objs.push(this.add.text(bx + bw / 2, by + 100, `FLT YT${100 + this.level}    ${cityCode}`, { fontFamily: '"Press Start 2P", monospace', fontSize: '12px', color: '#ffd700' }).setOrigin(0.5).setDepth(121));
      const status = this.add.text(bx + bw / 2, by + 140, 'BOARDING', { fontFamily: '"Press Start 2P", monospace', fontSize: '14px', color: '#5cf07a' }).setOrigin(0.5).setDepth(121);
      objs.push(status);
      this.tweens.add({ targets: status, alpha: 0.3, yoyo: true, repeat: -1, duration: 400 });
    } else {
      // Passport stamp slam
      const passport = this.add.graphics().setDepth(121);
      const pw = W * 0.7, ph = 240, px = (W - pw) / 2, py = H / 2 - ph / 2;
      passport.fillStyle(0x4a2e1f, 1).fillRoundedRect(px, py, pw, ph, 6);
      passport.fillStyle(0xf5e8c9, 1).fillRoundedRect(px + 12, py + 12, pw - 24, ph - 24, 4);
      passport.lineStyle(1, 0xd4a017, 1).strokeRoundedRect(px + 12, py + 12, pw - 24, ph - 24, 4);
      objs.push(passport);
      objs.push(this.add.text(px + pw / 2, py + 30, 'PASSPORT', { fontFamily: '"Press Start 2P", monospace', fontSize: '10px', color: '#4a2e1f' }).setOrigin(0.5).setDepth(121));
      // The stamp — starts huge + transparent, slams to size + opaque
      const stamp = this.add.container(W / 2, H / 2 + 20).setDepth(123);
      const stampBg = this.add.graphics();
      stampBg.fillStyle(0xc54128, 0.88);
      stampBg.fillRoundedRect(-100, -50, 200, 100, 8);
      stampBg.lineStyle(3, 0xc54128, 1);
      stampBg.strokeRoundedRect(-100, -50, 200, 100, 8);
      stamp.add(stampBg);
      stamp.add(this.add.text(0, -20, `${flag} ${cityCode}`, { fontFamily: '"Press Start 2P", monospace', fontSize: '22px', color: '#ffffff' }).setOrigin(0.5));
      stamp.add(this.add.text(0, 12, destinationName.toUpperCase(), { fontFamily: '"Press Start 2P", monospace', fontSize: '10px', color: '#ffffff' }).setOrigin(0.5));
      stamp.add(this.add.text(0, 32, 'ARRIVED', { fontFamily: '"Press Start 2P", monospace', fontSize: '8px', color: '#ffffff' }).setOrigin(0.5));
      stamp.setScale(3).setAlpha(0).setRotation(-0.2);
      this.tweens.add({ targets: stamp, scale: 1, alpha: 1, rotation: -0.08, duration: 250, ease: 'Back.easeOut' });
      this.tweens.add({ targets: stamp, scale: 1.06, yoyo: true, duration: 80, delay: 250 });
      this.cameras.main.shake(120, 0.005, false, undefined, true);
      objs.push(stamp);
    }

    // Auto-fade after 1.7s
    this.time.delayedCall(1700, () => {
      this.tweens.add({
        targets: objs,
        alpha: 0,
        duration: 250,
        onComplete: () => objs.forEach(o => o.destroy()),
      });
    });
    return objs;
  }

  private showBonusIntro(): void {
    const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6).setDepth(120);
    const headline = this.add.text(W / 2, H / 2 - 24, 'BONUS LEVEL', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '22px',
      color: '#FFD700',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(121);
    const sub = this.add.text(W / 2, H / 2 + 14, 'SURVIVE 30s · POINTS x3', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '11px',
      color: '#FFFFFF',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(121);
    this.time.delayedCall(1700, () => {
      this.tweens.add({
        targets: [overlay, headline, sub],
        alpha: 0,
        duration: 250,
        onComplete: () => { overlay.destroy(); headline.destroy(); sub.destroy(); },
      });
    });
  }

  private spawnScoreFloater(amount: number, col: number, row: number): void {
    // Throttle small dot floaters — only show every 5th dot collected so we
    // don't drown the screen in rising numbers.
    if (amount < 50) {
      this.dotFloaterCounter = (this.dotFloaterCounter + 1) % 5;
      if (this.dotFloaterCounter !== 0) return;
    }
    const T = this.tileSize;
    const x = this.offsetX + col * T + T / 2;
    const y = this.offsetY + row * T + T / 2;
    let color = '#00D2C8';
    if (amount >= 200) color = '#FFB347';
    else if (amount >= 100) color = '#FF6BB5';
    else if (amount >= 50) color = '#FFD700';
    const txt = this.add.text(x, y, `+${amount}`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: amount >= 100 ? '14px' : '10px',
      color,
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(50);
    this.tweens.add({
      targets: txt,
      y: y - (amount >= 100 ? 50 : 32),
      alpha: 0,
      duration: amount >= 100 ? 1500 : 1100,
      ease: 'Cubic.easeOut',
      onComplete: () => txt.destroy(),
    });
  }

  private updateHUD(): void {
    const cfg = getLevelConfig(this.level);
    if (cfg.isBonus && this.bonusLevelTimer > 0) {
      const sec = Math.ceil(this.bonusLevelTimer / 1000);
      if (!this.tickingScore) this.scoreText.setText(`SCORE: ${this.score}`);
      this.levelText.setText(`LVL: ${this.level}`);
      // Bonus timer below the maze in the bg-reveal strip — large, prominent.
      if (!this.bonusTimerText) {
        const timerY = this.offsetY + ROWS * this.tileSize + 30;
        this.bonusTimerText = this.add.text(W / 2, timerY, '', {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: '32px',
          color: '#FFD700',
          stroke: '#000000', strokeThickness: 6,
          align: 'center',
        }).setOrigin(0.5).setDepth(82);
        this.bonusTimerLabel = this.add.text(W / 2, timerY + 26, '3x POINTS', {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: '10px',
          color: '#FF6BB5',
          stroke: '#000000', strokeThickness: 3,
        }).setOrigin(0.5).setDepth(82);
      }
      this.bonusTimerText.setText(`${sec}s`);
      this.bonusTimerText.setVisible(true);
      this.bonusTimerLabel?.setVisible(true);
      // Last-5s urgency: pulse + red on each second tick
      if (this.lastBonusSec !== sec) {
        this.lastBonusSec = sec;
        if (sec <= 5) {
          this.bonusTimerText.setColor('#FF3838');
          this.tweens.killTweensOf(this.bonusTimerText);
          this.bonusTimerText.setScale(1);
          this.tweens.add({
            targets: this.bonusTimerText,
            scale: 1.45, yoyo: true, duration: 220, ease: 'Sine.easeOut',
          });
          audioSystem.play('click');
        } else {
          this.bonusTimerText.setColor('#FFD700');
        }
      }
    } else {
      if (!this.tickingScore) this.scoreText.setText(`SCORE: ${this.score}`);
      this.levelText.setText(`LVL: ${this.level}`);
      if (this.bonusTimerText) this.bonusTimerText.setVisible(false);
      if (this.bonusTimerLabel) this.bonusTimerLabel.setVisible(false);
      this.lastBonusSec = -1;
    }

    this.livesContainer.removeAll(true);
    for (let i = 0; i < this.lives; i++) {
      const life = this.add.image(-i * 28, -3, 'trippie-face');
      life.setScale(26 / life.width);
      life.setOrigin(1, 0);
      this.livesContainer.add(life);
    }
  }

  private updateWallGlow(): void {
    this.wallGlowGraphics.clear();
    const t = this.time.now / 1000;
    const alpha = (Math.sin(t * 3.5) + 1) / 2 * 0.55 + 0.05;  // 0.05..0.60
    if (alpha < 0.05) return;
    const T = this.tileSize;
    const inset = 2;
    const borderColor = COLOR_WALL_BORDER;
    this.wallGlowGraphics.lineStyle(1, borderColor, alpha);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (this.map[r][c] !== WALL) continue;
        const x = this.offsetX + c * T;
        const y = this.offsetY + r * T;
        // Glow on every wall edge that touches a non-wall (the visible side).
        if (r > 0 && this.map[r - 1][c] !== WALL) {
          this.wallGlowGraphics.lineBetween(x + inset, y + inset, x + T - inset, y + inset);
        }
        if (r < ROWS - 1 && this.map[r + 1][c] !== WALL) {
          this.wallGlowGraphics.lineBetween(x + inset, y + T - inset, x + T - inset, y + T - inset);
        }
        if (c > 0 && this.map[r][c - 1] !== WALL) {
          this.wallGlowGraphics.lineBetween(x + inset, y + inset, x + inset, y + T - inset);
        }
        if (c < COLS - 1 && this.map[r][c + 1] !== WALL) {
          this.wallGlowGraphics.lineBetween(x + T - inset, y + inset, x + T - inset, y + T - inset);
        }
      }
    }
  }

  private fireLaser(): void {
    const T = this.tileSize;
    const dir = this.player.dir;
    if (dir < 0) {
      this.laserGraphics.clear();
      return;  // Direction.NONE
    }
    const dx = DX[dir];
    const dy = DY[dir];

    // Walk forward until first wall / edge
    let endCol = this.player.col;
    let endRow = this.player.row;
    const killed: Ghost[] = [];
    for (let step = 1; step <= Math.max(COLS, ROWS); step++) {
      const c = this.player.col + dx * step;
      const r = this.player.row + dy * step;
      if (c < 0 || c >= COLS || r < 0 || r >= ROWS) break;
      if (this.map[r][c] === WALL) break;
      endCol = c;
      endRow = r;
      for (const g of this.ghosts) {
        if (g.eaten || g.respawning || g.home) continue;
        if (Math.round(g.px) === c && Math.round(g.py) === r) killed.push(g);
      }
    }

    // Continuous beam — redraw every frame with a slight pulse on the core.
    const x0 = this.offsetX + this.player.col * T + T / 2;
    const y0 = this.offsetY + this.player.row * T + T / 2;
    const x1 = this.offsetX + endCol * T + T / 2;
    const y1 = this.offsetY + endRow * T + T / 2;
    const pulse = 0.85 + 0.15 * Math.sin(this.time.now * 0.025);
    this.laserGraphics.clear().setAlpha(1);
    this.laserGraphics.lineStyle(10, 0xff3ec8, 0.55 * pulse);
    this.laserGraphics.lineBetween(x0, y0, x1, y1);
    this.laserGraphics.lineStyle(4, 0x00ffff, 0.95 * pulse);
    this.laserGraphics.lineBetween(x0, y0, x1, y1);
    this.laserGraphics.fillStyle(0xffffff, pulse);
    this.laserGraphics.fillCircle(x1, y1, 4);  // tip glow

    // Kill any ghost newly hit this frame.
    for (const g of killed) {
      g.eaten = true;
      g.scared = false;
      const earned = this.ghostScore;
      this.score += earned;
      this.totalGhostsEaten++;
      this.spawnScoreFloater(earned, Math.round(g.px), Math.round(g.py));
      this.spawnCollectParticles(Math.round(g.px), Math.round(g.py), 0x00ffff);
      this.ghostScore *= 2;
    }
    if (killed.length > 0) {
      audioSystem.play('ghost');
      this.cameras.main.shake(120, 0.004);
    }
  }

  private pullMagnetDots(): void {
    const pr = this.player.row;
    const pc = this.player.col;
    const T = this.tileSize;
    let pulled = 0;
    for (let r = Math.max(0, pr - MAGNET_RADIUS); r <= Math.min(ROWS - 1, pr + MAGNET_RADIUS); r++) {
      for (let c = Math.max(0, pc - MAGNET_RADIUS); c <= Math.min(COLS - 1, pc + MAGNET_RADIUS); c++) {
        if (Math.abs(r - pr) + Math.abs(c - pc) > MAGNET_RADIUS) continue;
        if (this.map[r][c] !== DOT) continue;
        const key = `${r},${c}`;
        if (this.magnetFlying.has(key)) continue;

        // Lift the dot off the map and into a flying sprite that tweens to
        // Trippie's current position. Score awarded on contact.
        this.magnetFlying.add(key);
        this.map[r][c] = EMPTY;
        const startX = this.offsetX + c * T + T / 2;
        const startY = this.offsetY + r * T + T / 2;
        const flyer = this.add.circle(startX, startY, T * 0.18, 0xFFFFAA, 1)
          .setDepth(3.7).setStrokeStyle(1, 0x00ffff, 0.7);
        const obj = { v: 0 };
        this.tweens.add({
          targets: obj, v: 1,
          duration: 320, ease: 'Cubic.easeIn',
          onUpdate: () => {
            const tx = this.offsetX + this.player.col * T + T / 2;
            const ty = this.offsetY + this.player.row * T + T / 2;
            flyer.x = startX + (tx - startX) * obj.v;
            flyer.y = startY + (ty - startY) * obj.v;
            flyer.setScale(1 + obj.v * 0.4);  // grow slightly as it nears
          },
          onComplete: () => {
            flyer.destroy();
            this.magnetFlying.delete(key);
            this.score += SCORE_DOT;
            this.dotsLeft--;
            this.totalDotsEaten++;
            this.spawnCollectParticles(this.player.col, this.player.row, 0x00ffff);
            audioSystem.play('dot');
          },
        });
        pulled++;
      }
    }
    if (pulled > 0) this.drawMaze();
  }

  private drawMagnetAura(): void {
    // Visual aura intentionally removed — the dot-flying animation on pull is
    // enough feedback. Keep the layer cleared in case it accumulated draws.
    this.magnetAuraGraphics.clear();
  }

  private drawMaze(): void {
    const T = this.tileSize;
    const half = T / 2;
    this.mazeGraphics.clear();

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const t = this.map[r][c];
        const x = this.offsetX + c * T;
        const y = this.offsetY + r * T;

        // Draw path tiles with a subtle lighter fill so corridors are visible
        if (t !== WALL) {
          this.mazeGraphics.fillStyle(0xFFFFFF, 0.04);
          this.mazeGraphics.fillRect(x, y, T, T);
        }

        if (t === WALL) {
          this.mazeGraphics.fillStyle(COLOR_WALL, 1);
          this.mazeGraphics.fillRect(x, y, T, T);

          // Bright outline on every exposed wall edge (toward path) — makes
          // walls pop against busy backgrounds.
          this.mazeGraphics.lineStyle(2, COLOR_WALL_BORDER, 1);
          if (r > 0 && this.map[r - 1][c] !== WALL) {
            this.mazeGraphics.lineBetween(x, y, x + T, y);
          }
          if (r < ROWS - 1 && this.map[r + 1][c] !== WALL) {
            this.mazeGraphics.lineBetween(x, y + T, x + T, y + T);
          }
          if (c > 0 && this.map[r][c - 1] !== WALL) {
            this.mazeGraphics.lineBetween(x, y, x, y + T);
          }
          if (c < COLS - 1 && this.map[r][c + 1] !== WALL) {
            this.mazeGraphics.lineBetween(x + T, y, x + T, y + T);
          }
        } else if (t === DOT) {
          // Soft outer glow + bright core — pops against any bg
          this.mazeGraphics.fillStyle(COLOR_DOT, 0.35);
          this.mazeGraphics.fillCircle(x + half, y + half, T * 0.22);
          this.mazeGraphics.fillStyle(0xFFFFAA, 1);
          this.mazeGraphics.fillCircle(x + half, y + half, T * 0.16);
        } else if (t === GATE) {
          this.mazeGraphics.fillStyle(COLOR_GATE, 1);
          this.mazeGraphics.fillRect(x, y + half - 1.5, T, 3);
        }
      }
    }
  }

  private drawEntities(): void {
    const T = this.tileSize;
    const half = T / 2;
    const now = this.time.now;
    this.entityGraphics.clear();
    this.updateWallGlow();

    // Power pellet cards
    let cardIdx = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (this.map[r][c] === POWER && cardIdx < this.cardSprites.length) {
          const pulse = 0.9 + 0.1 * Math.sin(now * 0.004);
          const size = T * 1.4 * pulse;
          const x = this.offsetX + c * T + half;
          const y = this.offsetY + r * T + half;
          this.cardSprites[cardIdx].setPosition(x, y);
          this.cardSprites[cardIdx].setDisplaySize(size, size);
          this.cardSprites[cardIdx].setVisible(true);
          cardIdx++;
        }
      }
    }
    for (let i = cardIdx; i < this.cardSprites.length; i++) {
      this.cardSprites[i].setVisible(false);
    }

    // Bonus items — 2x bigger than cards, with glow
    this.bonusSprites.forEach(s => s.setVisible(false));
    if (this.bonusItem) {
      const pulse = 0.8 + 0.2 * Math.sin(now * 0.005);
      const size = T * 2.1 * pulse;
      const blinking = isBonusBlinking(this.bonusItem);
      const alpha = blinking ? 0.3 : 1;

      const bx = this.offsetX + this.bonusItem.col * T + half;
      const by = this.offsetY + this.bonusItem.row * T + half;

      // Glow circle behind bonus
      const glowColors: Record<string, number> = { laser: 0xff3ec8, magnet: 0xff5252, freeze: 0x4FC3F7 };
      const glowColor = glowColors[this.bonusItem.type] || 0xFFFFFF;
      this.entityGraphics.fillStyle(glowColor, 0.15 * alpha);
      this.entityGraphics.fillCircle(bx, by, size * 0.7);
      this.entityGraphics.fillStyle(glowColor, 0.08 * alpha);
      this.entityGraphics.fillCircle(bx, by, size * 1.0);

      const textureKey = this.bonusItem.type === 'laser' ? 'laser'
        : this.bonusItem.type === 'magnet' ? 'magnet'
        : 'globe';
      this.bonusSprites[0].setTexture(textureKey);
      this.bonusSprites[0].setPosition(bx, by);
      this.bonusSprites[0].setDisplaySize(size, size);
      this.bonusSprites[0].setAlpha(alpha);
      this.bonusSprites[0].setVisible(true);
    }
    this.drawMagnetAura();

    // Player
    const pSprite = this.playerSprite;
    if (this.gameState === 'dying') {
      const progress = 1 - this.dyingTimer / DYING_DURATION;
      if (this.dyingTimer > 0 && Math.floor(this.dyingTimer / 166) % 2 > 0) {
        const targetSize = T * 1.7 * (1 - progress);
        const px = this.offsetX + this.player.px * T + half;
        const py = this.offsetY + this.player.py * T + half;
        pSprite.setTexture(this.getPlayerTexture());
        pSprite.setPosition(px, py);
        pSprite.setScale(targetSize / Math.max(pSprite.width, pSprite.height));
        pSprite.setAlpha(1 - progress);
        pSprite.setVisible(true);
      } else {
        pSprite.setVisible(false);
      }
    } else {
      const targetSize = T * 1.7;
      const px = this.offsetX + this.player.px * T + half;
      const py = this.offsetY + this.player.py * T + half;

      let alpha = 1;
      if (this.invincibleTimer > 0 && Math.floor(this.invincibleTimer / 100) % 2 === 0) {
        alpha = 0.4;
      }

      // Subtle anchor glow behind Trippie — soft white pulse so the player
      // sprite reads against busy destination/aquarium backgrounds.
      const glowPulse = 0.55 + 0.25 * Math.sin(now * 0.005);
      this.entityGraphics.fillStyle(0xffffff, 0.12 * glowPulse);
      this.entityGraphics.fillCircle(px, py, T * 0.95);
      this.entityGraphics.fillStyle(0xffffff, 0.18 * glowPulse);
      this.entityGraphics.fillCircle(px, py, T * 0.65);

      pSprite.setTexture(this.getPlayerTexture());
      pSprite.setPosition(px, py);
      pSprite.setScale(targetSize / Math.max(pSprite.width, pSprite.height));
      pSprite.setAlpha(alpha);
      pSprite.setVisible(true);

      // Speed boost trail
      if (this.boostTimer > 0) {
        if (this.boostTimer < 1500 && Math.floor(this.boostTimer / 120) % 2 === 0) {
          pSprite.setAlpha(0.5);
        }
        const trailDx = this.player.dir === Direction.RIGHT ? -1 : this.player.dir === Direction.LEFT ? 1 : 0;
        const trailDy = this.player.dir === Direction.DOWN ? -1 : this.player.dir === Direction.UP ? 1 : 0;
        for (let i = 1; i <= 3; i++) {
          this.entityGraphics.fillStyle(0xFFD700, 0.3 - i * 0.08);
          this.entityGraphics.fillCircle(
            px + trailDx * T * 0.3 * i,
            py + trailDy * T * 0.3 * i,
            T * (0.2 - i * 0.04)
          );
        }
      }
    }

    // Ghosts
    for (let i = 0; i < this.ghosts.length; i++) {
      const g = this.ghosts[i];
      const gs = this.ghostSprites[i];

      if (g.respawning) {
        // Keep the X-eyed "eaten" sprite visible while ghost recovers in pen.
        const T = this.tileSize;
        const half = T / 2;
        const targetSize = T * 1.9;
        gs.setTexture(g.spriteKey + '-dead');
        gs.setPosition(this.offsetX + g.px * T + half, this.offsetY + g.py * T + half);
        const scale = targetSize / Math.max(gs.width, gs.height);
        gs.setScale(scale);
        gs.setAlpha(0.55);
        gs.setVisible(true);
        continue;
      }

      let textureKey: string;
      if (g.scared || g.eaten) {
        textureKey = g.spriteKey + '-dead';
        if (this.powerTimer < POWER_FLASH_THRESHOLD && this.powerTimer > 0 &&
            Math.floor(this.powerTimer / 150) % 2 === 0) {
          textureKey = g.spriteKey;
        }
      } else {
        textureKey = g.spriteKey;
      }

      const targetSize = T * 1.9;
      const gx = this.offsetX + g.px * T + half;
      const gy = this.offsetY + g.py * T + half;

      gs.setTexture(textureKey);
      gs.setPosition(gx, gy);
      // Use setScale to preserve sprite aspect ratio (monsters aren't square)
      const scale = targetSize / Math.max(gs.width, gs.height);
      gs.setScale(scale);
      gs.setVisible(true);

      if (g.eaten) {
        gs.setAlpha(0.4);
      } else if (this.freezeTimer > 0) {
        if (this.freezeTimer < 1500 && Math.floor(this.freezeTimer / 150) % 2 === 0) {
          gs.setAlpha(0.5);
        } else {
          gs.setAlpha(1);
        }
        this.entityGraphics.fillStyle(0x4FC3F7, 0.3);
        this.entityGraphics.fillRect(gx - targetSize / 2, gy - targetSize / 2, targetSize, targetSize);
      } else {
        gs.setAlpha(1);
      }
    }

    // Popup text alpha is now managed by tweens in showPopup()
  }

  private getPlayerTexture(): string {
    const dir = this.player.dir;
    const mouthOpen = this.player.mouthAngle > 0.18;

    // For UP/DOWN, use the last horizontal direction (no front-facing sprite)
    let facingRight = this.player.lastHDir === 'right';
    if (dir === Direction.RIGHT) facingRight = true;
    else if (dir === Direction.LEFT) facingRight = false;

    if (facingRight) {
      return mouthOpen ? 'trippie-right-open' : 'trippie-a';
    }
    return mouthOpen ? 'trippie-left-open' : 'trippie-d';
  }
}
