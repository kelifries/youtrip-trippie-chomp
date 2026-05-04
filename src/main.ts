import Phaser from 'phaser';
import { PreloadScene } from './scenes/PreloadScene';
import { StartScene } from './scenes/StartScene';
import { HowToPlayScene } from './scenes/HowToPlayScene';
import { GameScene } from './scenes/GameScene';
import { GameOverScene } from './scenes/GameOverScene';

// Fixed game resolution — Phaser scales this to fit any screen.
// 480x960 = 1:2 portrait, closer to modern phone aspect (9:19.5) so the
// game canvas fills more of the screen vertically.
const GAME_WIDTH = 480;
const GAME_HEIGHT = 960;

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
