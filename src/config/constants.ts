// Grid dimensions
export const COLS = 19;
export const ROWS = 21;
export const TILE_SIZE = 24; // Base tile size, will be scaled

// Tile types
export const WALL = 1;
export const DOT = 2;
export const POWER = 3;
export const EMPTY = 0;
export const GATE = 4;

// Directions
export enum Direction {
  UP = 0,
  DOWN = 1,
  LEFT = 2,
  RIGHT = 3,
  NONE = -1,
}

export const DX = [0, 0, -1, 1];
export const DY = [-1, 1, 0, 0];
export const OPPOSITE: Record<number, number> = { 0: 1, 1: 0, 2: 3, 3: 2 };

// Speeds (tiles per tick at 60fps, same as v1)
export function getPlayerSpeed(level: number): number {
  return Math.min(0.10 + (level - 1) * 0.01, 0.20);
}

export function getGhostBaseSpeed(level: number): number {
  return Math.min(0.06 + (level - 1) * 0.008, 0.15);
}

// Timers (in ms)
export const POWER_DURATION = 7000;
export const POWER_FLASH_THRESHOLD = 1500;
export const GHOST_RESPAWN_DELAY = 5000;  // 5s — eaten ghosts serve real time before re-entering chase
export const INVINCIBLE_DURATION = 2000;
export const DYING_DURATION = 1000; // 60 ticks * 16.67ms
export const LEVEL_WIN_DURATION = 800; // Quick transition between levels

// Bonus system
export const BONUS_FIRST_SPAWN_DELAY = 5000;
export const BONUS_SPAWN_MIN = 8000;
export const BONUS_SPAWN_MAX = 12000;
export const BONUS_LIFETIME = 15000;
export const BONUS_BLINK_THRESHOLD = 3000;
export const BOOST_DURATION = 7000;
export const FREEZE_DURATION = 5000;
export const TELEPORT_MIN_DISTANCE = 8;

// Scoring
export const SCORE_DOT = 10;
export const SCORE_POWER = 50;
export const SCORE_BONUS = 100;
export const SCORE_GHOST_BASE = 200;

// Ghost release timers — staggered exit from pen
export const GHOST_HOME_TIMERS = [1500, 5000, 9000]; // ms

// Popup
export const POPUP_DURATION = 2000;

// Starting lives
export const STARTING_LIVES = 3;

// Player start position
export const PLAYER_START = { col: 9, row: 15 };

// Ghost pen position
export const GHOST_PEN_EXIT = { col: 9, row: 7 };

// Ghost start positions — all 3 inside the pen, waiting to exit (classic Pacman style)
export const GHOST_STARTS = [
  { col: 9, row: 9 },   // chaser - center of pen
  { col: 8, row: 9 },   // ambusher - left of pen
  { col: 10, row: 9 },  // patroller - right of pen
];

// Ghost AI types — 3 fee monsters
export type GhostAI = 'chase' | 'ambush' | 'patrol';
export const GHOST_AI_TYPES: GhostAI[] = ['chase', 'ambush', 'patrol'];

// Ghost sprite mapping
export const GHOST_SPRITES: Record<GhostAI, string> = {
  chase: 'monster-blue',
  ambush: 'monster-green',
  patrol: 'monster-orange',
};

// Ghost speed multipliers
export const GHOST_SPEED_MULTS: Record<GhostAI, number> = {
  chase: 1,
  ambush: 1,
  patrol: 0.85,
};

// Patrol waypoints
export const PATROL_ROUTE = [
  { col: 1, row: 1 },
  { col: 17, row: 1 },
  { col: 17, row: 19 },
  { col: 1, row: 19 },
];

// Colors
export const COLOR_BG = 0x0D0D1A;
export const COLOR_WALL = 0x150D26;
export const COLOR_WALL_BORDER = 0x4FC3F7;  // bright cyan — pops against any bg
export const COLOR_DOT = 0xFFD700;
export const COLOR_GATE = 0xFF69B4;
export const COLOR_TEAL = 0x00D2C8;
export const COLOR_POPUP = 0x00D2C8;

// Bonus types
export type BonusType = 'boost' | 'teleport' | 'freeze';
export const BONUS_TYPES: BonusType[] = ['boost', 'teleport', 'freeze'];

// Power pellet corner positions (where POWER tiles are in the map)
export const POWER_CORNERS = [
  { row: 2, col: 1 },
  { row: 2, col: 17 },
  { row: 15, col: 1 },
  { row: 15, col: 17 },
];
