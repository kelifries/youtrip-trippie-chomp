// Per-level destination config. Sequence (revised May 4 2026):
//   L1 = Singapore Changi (start)
//   L2 = Tokyo
//   L3 = Outer Space (BONUS — first bonus, early reward)
//   L4 = Bangkok
//   L5 = Seoul
//   L6 = Underwater (BONUS — second bonus, mid-tour break)
//   L7 = Kuala Lumpur
//   L8 = Sydney
//
// After L8: loop L2-L8 with speed climbing (L1 is one-shot tutorial).

import type { MazeKey } from './mazes';

export interface PaletteOverride {
  wall?: number;
  wallBorder?: number;
  dotAccent?: number;
}

export interface BgAnim {
  sprite: string;             // texture key (must be loaded in PreloadScene)
  motion: 'scroll' | 'blink' | 'orbit';
  startX: number;
  startY: number;
  endX?: number;              // for scroll
  endY?: number;
  scale: number;
  duration: number;           // ms for one cycle
  repeatDelay?: number;       // ms between cycles
  ease?: string;
  alpha?: number;
  flipX?: boolean;
  blinkPeriod?: number;       // for blink motion: full on→off→on cycle ms
}

export interface LevelConfig {
  id: string;            // stable kebab-case id
  destination: string;   // display name
  country: string;
  cityCode: string;      // 3-letter IATA-ish code for boarding pass
  flag: string;          // emoji flag
  bgAsset: string;       // background asset key (loaded in PreloadScene)
  mazeKey: MazeKey;      // which maze layout to load
  isBonus?: boolean;     // bonus levels — slow ghosts, dot rush, dim bg
  palette?: PaletteOverride;
  shareHeadline: string;
  tagline: string;       // boarding-pass header copy on level transition
  bgAnimations?: BgAnim[];   // animated bg layers, all rendered behind maze
}

export const LEVELS: LevelConfig[] = [
  {
    id: 'sg-airport',
    destination: 'Singapore',
    country: 'Singapore',
    cityCode: 'SIN',
    flag: '\u{1F1F8}\u{1F1EC}',
    bgAsset: 'bg-sg-airport',
    mazeKey: 'sg-airport',
    tagline: 'TIME TO FLY',
    shareHeadline: 'Trippie boarded the world tour',
    bgAnimations: [
      // Plane taking off — bottom-left to top-right with takeoff arc
      {
        sprite: 'plane-side',
        motion: 'scroll',
        startX: -100, startY: 640,
        endX: 580, endY: 90,
        scale: 0.55,
        duration: 6500,
        repeatDelay: 4500,
        ease: 'Quad.easeOut',
        alpha: 0.9,
      },
      // Runway lights — 3 blinker dots at the runway level (bottom strip), staggered
      {
        sprite: 'runway-light',
        motion: 'blink',
        startX: 120, startY: 605,
        scale: 1,
        duration: 0,
        blinkPeriod: 900,
        alpha: 1,
      },
      {
        sprite: 'runway-light',
        motion: 'blink',
        startX: 240, startY: 605,
        scale: 1,
        duration: 0,
        blinkPeriod: 1100,
        alpha: 1,
      },
      {
        sprite: 'runway-light',
        motion: 'blink',
        startX: 360, startY: 605,
        scale: 1,
        duration: 0,
        blinkPeriod: 700,
        alpha: 1,
      },
    ],
  },
  {
    id: 'jp-tokyo',
    destination: 'Tokyo',
    country: 'Japan',
    cityCode: 'TYO',
    flag: '\u{1F1EF}\u{1F1F5}',
    bgAsset: 'bg-jp-tokyo',
    mazeKey: 'jp-tokyo',
    palette: { wall: 0x2a1338, wallBorder: 0xff8fb1, dotAccent: 0xffc0cb },
    tagline: 'MORE YEN FOR MY RAMEN',
    shareHeadline: 'Trippie made it to Tokyo',
  },
  {
    id: 'space',
    destination: 'Outer Space',
    country: 'Cosmos',
    cityCode: 'SPC',
    flag: '\u{1F680}', // rocket
    bgAsset: 'bg-space',
    mazeKey: 'lounge',
    isBonus: true,
    palette: { wall: 0x0a0a1a, wallBorder: 0x4FC3F7, dotAccent: 0xFFFFFF },
    tagline: 'BONUS LEVEL',
    shareHeadline: 'Trippie blasted off to space',
  },
  {
    id: 'th-bangkok',
    destination: 'Bangkok',
    country: 'Thailand',
    cityCode: 'BKK',
    flag: '\u{1F1F9}\u{1F1ED}',
    bgAsset: 'bg-th-bangkok',
    mazeKey: 'th-bangkok',
    palette: { wall: 0x1f1505, wallBorder: 0xd4a017, dotAccent: 0xffd700 },
    tagline: 'TUK-TUK TO TOMORROW',
    shareHeadline: 'Trippie made it to Bangkok',
  },
  {
    id: 'kr-seoul',
    destination: 'Seoul',
    country: 'Korea',
    cityCode: 'SEL',
    flag: '\u{1F1F0}\u{1F1F7}',
    bgAsset: 'bg-kr-seoul',
    mazeKey: 'kr-seoul',
    palette: { wall: 0x150f2a, wallBorder: 0x6b3fe0, dotAccent: 0x00ffe1 },
    tagline: "WON-DERFUL DAY FOR CHOMPIN'",
    shareHeadline: 'Trippie made it to Seoul',
  },
  {
    id: 'underwater',
    destination: 'Coral Reef',
    country: 'Underwater',
    cityCode: 'SEA',
    flag: '\u{1F30A}', // wave
    bgAsset: 'bg-underwater',
    mazeKey: 'underwater',
    isBonus: true,
    palette: { wall: 0x062845, wallBorder: 0x00d2c8, dotAccent: 0xffff66 },
    tagline: 'BONUS LEVEL',
    shareHeadline: 'Trippie dove into the reef',
  },
  {
    id: 'my-kl',
    destination: 'Kuala Lumpur',
    country: 'Malaysia',
    cityCode: 'KUL',
    flag: '\u{1F1F2}\u{1F1FE}',
    bgAsset: 'bg-my-kl',
    mazeKey: 'my-kl',
    palette: { wall: 0x0a1f15, wallBorder: 0x2a8b5f, dotAccent: 0x7fffd4 },
    tagline: 'RINGGIT RUN',
    shareHeadline: 'Trippie made it to Kuala Lumpur',
  },
  {
    id: 'au-sydney',
    destination: 'Sydney',
    country: 'Australia',
    cityCode: 'SYD',
    flag: '\u{1F1E6}\u{1F1FA}',
    bgAsset: 'bg-au-sydney',
    mazeKey: 'au-sydney',
    palette: { wall: 0x0a1429, wallBorder: 0x4a90e2, dotAccent: 0xffe066 },
    tagline: "G'DAY, GREAT RATES",
    shareHeadline: 'Best rates, every trip',
  },
];

// Resolve the level config for any level number, including endless loop after L8.
// L1 = Changi (one-time tutorial); L2-L8 = main tour; L9+ loops back to L2.
export function getLevelConfig(level: number): LevelConfig {
  if (level <= LEVELS.length) return LEVELS[level - 1];
  const tourLength = LEVELS.length - 1; // 7 levels after Changi
  const loopIdx = ((level - 2) % tourLength) + 1;
  return LEVELS[loopIdx];
}

// Loop counter: 0 on first pass, 1+ on subsequent loops.
export function getLoopNumber(level: number): number {
  if (level <= LEVELS.length) return 0;
  return Math.floor((level - 2) / (LEVELS.length - 1));
}
