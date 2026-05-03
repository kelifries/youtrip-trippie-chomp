import {
  COLS, ROWS, WALL, GATE, DX, DY,
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
 * Find valid corridor tiles for bonus spawning.
 * Excludes ghost pen area (rows 6-12), card corners, outer edges,
 * and tiles with fewer than 2 exits.
 */
function findSpawnCandidates(map: number[][], player: Player): { col: number; row: number }[] {
  const walkable: { col: number; row: number }[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = map[r][c];
      if (t === WALL || t === GATE) continue;
      if (r === player.row && c === player.col) continue;
      // Exclude ghost pen + tunnel area
      if (r >= 6 && r <= 12) continue;
      // Exclude card corners
      if ((r === 2 && c === 1) || (r === 2 && c === 17) ||
          (r === 15 && c === 1) || (r === 15 && c === 17)) continue;
      // Exclude outer edges
      if (c <= 0 || c >= COLS - 1) continue;
      // Count exits
      let exits = 0;
      for (let d = 0; d < 4; d++) {
        const nc = c + DX[d], nr = r + DY[d];
        if (nc >= 0 && nc < COLS && nr >= 0 && nr < ROWS &&
            map[nr][nc] !== WALL && map[nr][nc] !== GATE) exits++;
      }
      if (exits >= 2) walkable.push({ col: c, row: r });
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
