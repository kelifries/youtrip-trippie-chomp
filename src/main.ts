import Phaser from 'phaser';
import { PreloadScene } from './scenes/PreloadScene';
import { StartScene } from './scenes/StartScene';
import { HowToPlayScene } from './scenes/HowToPlayScene';
import { GameScene } from './scenes/GameScene';
import { GameOverScene } from './scenes/GameOverScene';
import { audioSystem } from './systems/AudioSystem';

// Native-event audio unlock — runs at document level, capture phase, BEFORE
// Phaser's input plugin sees the gesture. iOS WebKit (Safari + Chrome iOS)
// only honors AudioContext.resume() / silent-buffer unlock when the call
// chain originates from an unconsumed user activation. Phaser's synthesized
// pointer events can land outside that window, which is why scene click
// handlers alone don't reliably unlock audio on mobile.
const unlockAudio = () => {
  audioSystem.init();
  // Stop listening once unlocked — subsequent scene-level init() calls handle
  // re-suspends caused by backgrounding via the existing resume path.
  if (audioSystem.isRunning()) {
    document.removeEventListener('touchend', unlockAudio, true);
    document.removeEventListener('touchstart', unlockAudio, true);
    document.removeEventListener('mousedown', unlockAudio, true);
    document.removeEventListener('keydown', unlockAudio, true);
  }
};
document.addEventListener('touchend', unlockAudio, { capture: true, passive: true });
document.addEventListener('touchstart', unlockAudio, { capture: true, passive: true });
document.addEventListener('mousedown', unlockAudio, { capture: true });
document.addEventListener('keydown', unlockAudio, { capture: true });

// Fixed game resolution — Phaser scales this to fit any screen.
// 480x720 = 2:3 portrait. Stays width-bound on every phone (iPhone SE→Pro Max),
// which means tile size = logicalTile × phoneW/480. Going taller (e.g. 960)
// makes shorter phones height-bound and SHRINKS tiles — counterintuitively bad.
const GAME_WIDTH = 480;
const GAME_HEIGHT = 720;

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.NO_CENTER,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  backgroundColor: '#0D0D1A',
  scene: [PreloadScene, StartScene, HowToPlayScene, GameScene, GameOverScene],
  input: {
    touch: true,
    keyboard: true,
  },
  fps: {
    target: 60,
    forceSetTimeOut: false,
  },
  render: {
    antialias: true,
    roundPixels: true,
  },
};

new Phaser.Game(config);
