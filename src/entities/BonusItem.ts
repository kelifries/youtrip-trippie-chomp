import {
  COLS, ROWS, WALL, GATE, DOT, DX, DY,
  BonusType, BONUS_TYPES, BONUS_LIFETIME,
  BONUS_BLINK_THRESHOLD,
} from '../config/constants';
import { Player } from './Player';

export interface BonusData {
  col: number;
  row: number;
  type: BonusType;
  timer: number;
}

/**
 * Find valid corridor tiles for bonus spawning. Spawns must be inside the
 * playable area (≥2 dot neighbors) so trimmed/circular mazes don't drop
 * pickups in the empty exterior cells beyond the wall ring. Player tile
 * and adjacent tiles are excluded to avoid pickups appearing on top of
 * Trippie. Tiles with <2 walkable exits are excluded so pickups can't
 * land in dead-ends.
 */
function findSpawnCandidates(map: number[][], player: Player): { col: number; row: number }[] {
  const walkable: { col: number; row: number }[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = map[r][c];
      if (t === WALL || t === GATE) continue;
      if (Math.abs(r - player.row) + Math.abs(c - player.col) < 2) continue;
      let exits = 0;
      let dotsAround = (t === DOT) ? 1 : 0;
      for (let d = 0; d < 4; d++) {
        const nc = c + DX[d], nr = r + DY[d];
        if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
        const nt = map[nr][nc];
        if (nt !== WALL && nt !== GATE) exits++;
        if (nt === DOT) dotsAround++;
      }
      // Need to be in active gameplay area (2+ dot neighborhood) and have a
      // path through the cell (2+ exits). Drops candidates outside any
      // trimmed-maze wall ring since those exterior 0-cells have no dots.
      if (dotsAround >= 2 && exits >= 2) walkable.push({ col: c, row: r });
    }
  }
  return walkable;
}

// Cycle through bonus types to guarantee variety
let bonusTypeIndex = Math.floor(Math.random() * BONUS_TYPES.length);

export function spawnBonus(map: number[][], player: Player): BonusData | null {
  const walkable = findSpawnCandidates(map, player);
  if (walkable.length < 1) return null;

  const type = BONUS_TYPES[bonusTypeIndex % BONUS_TYPES.length];
  bonusTypeIndex++;
  const spot = walkable[Math.floor(Math.random() * walkable.length)];
  return { col: spot.col, row: spot.row, type, timer: BONUS_LIFETIME };
}

export function isBonusBlinking(bonus: BonusData): boolean {
  return bonus.timer < BONUS_BLINK_THRESHOLD && Math.floor(bonus.timer / 200) % 2 === 0;
}
