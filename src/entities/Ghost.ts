import {
  Direction, DX, DY, OPPOSITE, COLS, ROWS, WALL, GATE,
  GhostAI, GHOST_AI_TYPES, GHOST_SPRITES,
  GHOST_SPEED_MULTS, GHOST_HOME_TIMERS, PATROL_ROUTE,
  getGhostBaseSpeed, GHOST_RESPAWN_DELAY,
} from '../config/constants';
import type { MazeMeta } from '../config/mazes';
import { Player } from './Player';

export class Ghost {
  col: number;
  row: number;
  px: number;
  py: number;
  dir: Direction;
  ai: GhostAI;
  spriteKey: string;
  speed: number;
  scared: boolean = false;
  eaten: boolean = false;
  respawning: boolean = false;
  respawnTimer: number = 0;
  home: boolean = true;
  homeTimer: number;
  patrolIdx: number;
  meta: MazeMeta;

  constructor(index: number, level: number, meta: MazeMeta) {
    this.meta = meta;
    const start = meta.ghostStarts[index];
    this.col = start.col;
    this.row = start.row;
    this.px = start.col;
    this.py = start.row;
    this.dir = Direction.UP;
    this.ai = GHOST_AI_TYPES[index];
    this.spriteKey = GHOST_SPRITES[this.ai];
    const baseSpeed = getGhostBaseSpeed(level);
    this.speed = baseSpeed * GHOST_SPEED_MULTS[this.ai];
    this.homeTimer = GHOST_HOME_TIMERS[index];
    this.patrolIdx = 0;
  }

  private isWalkableForGhost(map: number[][], col: number, row: number, canPassGate: boolean): boolean {
    if (row < 0 || row >= ROWS) return false;
    if (col < 0 || col >= COLS) return true;
    const t = map[row][col];
    if (t === WALL) return false;
    if (t === GATE && !canPassGate) return false;
    return true;
  }

  private dist(x1: number, y1: number, x2: number, y2: number): number {
    return (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  }

  private getTarget(player: Player): { col: number; row: number } {
    if (this.eaten) return { col: this.meta.penCenter.col, row: this.meta.penCenter.row };
    if (this.scared) return {
      col: Math.random() * COLS | 0,
      row: Math.random() * ROWS | 0,
    };

    switch (this.ai) {
      case 'chase':
        return { col: player.col, row: player.row };

      case 'ambush':
        return {
          col: player.col + DX[player.dir] * 4,
          row: player.row + DY[player.dir] * 4,
        };

      case 'patrol': {
        const target = PATROL_ROUTE[this.patrolIdx];
        if (Math.abs(this.col - target.col) <= 2 && Math.abs(this.row - target.row) <= 2) {
          this.patrolIdx = (this.patrolIdx + 1) % PATROL_ROUTE.length;
        }
        return PATROL_ROUTE[this.patrolIdx];
      }

      default:
        return { col: Math.random() * COLS | 0, row: Math.random() * ROWS | 0 };
    }
  }

  /**
   * BFS pathfinding from current position to target. Returns the first move
   * direction along the shortest path, or -1 if no path exists.
   * Used for eaten ghosts so they always find their way back to the pen
   * even through dense mazes — greedy distance heuristic gets stuck in dead-ends.
   */
  private bfsNextDir(map: number[][], targetR: number, targetC: number, canPassGate: boolean): Direction {
    const startR = this.row, startC = this.col;
    if (startR === targetR && startC === targetC) return this.dir;

    const visited: boolean[][] = Array.from({ length: ROWS }, () => new Array(COLS).fill(false));
    const parent: Array<Array<{ r: number; c: number; d: Direction } | null>> =
      Array.from({ length: ROWS }, () => new Array(COLS).fill(null));
    visited[startR][startC] = true;

    const queue: Array<{ r: number; c: number }> = [{ r: startR, c: startC }];
    let found = false;

    while (queue.length > 0) {
      const { r, c } = queue.shift()!;
      if (r === targetR && c === targetC) { found = true; break; }
      for (let d = 0; d < 4; d++) {
        let nc = c + DX[d];
        const nr = r + DY[d];
        if (nc < 0) nc = COLS - 1;
        else if (nc >= COLS) nc = 0;
        if (nr < 0 || nr >= ROWS) continue;
        if (visited[nr][nc]) continue;
        const t = map[nr][nc];
        if (t === WALL) continue;
        if (t === GATE && !canPassGate) continue;
        visited[nr][nc] = true;
        parent[nr][nc] = { r, c, d: d as Direction };
        queue.push({ r: nr, c: nc });
      }
    }

    if (!found) return -1 as Direction;

    // Walk back from target to find the first step from start
    let cr = targetR, cc = targetC;
    let firstDir: Direction = this.dir;
    while (true) {
      const p = parent[cr][cc];
      if (!p) break;
      if (p.r === startR && p.c === startC) { firstDir = p.d; break; }
      cr = p.r; cc = p.c;
    }
    return firstDir;
  }

  private chooseDir(map: number[][], player: Player): Direction {
    const canGate = this.eaten || this.home;

    // Eaten ghosts: BFS to pen.
    if (this.eaten) {
      const bfsDir = this.bfsNextDir(map, this.meta.penCenter.row, this.meta.penCenter.col, true);
      if (bfsDir !== (-1 as Direction)) return bfsDir;
    }

    // Chasing ghosts: BFS to player tile so they don't oscillate in narrow corridors.
    // Scared/patrol ghosts keep the greedy heuristic for visual variety in their wandering.
    if (!this.scared && this.ai === 'chase') {
      const bfsDir = this.bfsNextDir(map, player.row, player.col, false);
      if (bfsDir !== (-1 as Direction)) return bfsDir;
    }

    const target = this.getTarget(player);
    let bestDir: Direction = -1 as Direction;
    let bestDist = Infinity;

    // First pass — pick the best NON-reverse walkable direction.
    for (let d = 0; d < 4; d++) {
      if (d === OPPOSITE[this.dir]) continue;
      const nc = this.col + DX[d];
      const nr = this.row + DY[d];
      const wrappedCol = nc < 0 ? COLS - 1 : nc >= COLS ? 0 : nc;
      if (!this.isWalkableForGhost(map, wrappedCol, nr, canGate)) continue;
      const dd = this.dist(nc, nr, target.col, target.row);
      if (dd < bestDist) { bestDist = dd; bestDir = d as Direction; }
    }
    if (bestDir !== -1) return bestDir;

    // Dead-end fallback — only the reverse direction is walkable, take it.
    const opp = OPPOSITE[this.dir] as Direction;
    if (opp !== undefined) {
      const nc = this.col + DX[opp];
      const nr = this.row + DY[opp];
      const wrappedCol = nc < 0 ? COLS - 1 : nc >= COLS ? 0 : nc;
      if (this.isWalkableForGhost(map, wrappedCol, nr, canGate)) return opp;
    }

    // Truly stuck (surrounded) — keep current dir, will be re-evaluated next tile.
    return this.dir;
  }

  private atCenter(): boolean {
    return Math.abs(this.px - Math.round(this.px)) < 0.02 &&
           Math.abs(this.py - Math.round(this.py)) < 0.02;
  }

  /**
   * Update ghost. Returns true if ghost just finished respawning (ready to re-enter).
   */
  update(map: number[][], player: Player, dtMs: number, frozen: boolean, powerActive: boolean): boolean {
    // Handle respawn delay
    if (this.respawning) {
      this.respawnTimer -= dtMs;
      if (this.respawnTimer <= 0) {
        this.respawning = false;
        this.eaten = false;
        this.scared = powerActive;
        this.col = this.meta.penExit.col;
        this.row = this.meta.penExit.row;
        this.px = this.meta.penExit.col;
        this.py = this.meta.penExit.row;
        this.dir = Direction.LEFT;
        return true;
      }
      return false;
    }

    // Home timer (release from pen)
    if (this.home) {
      this.homeTimer -= dtMs;
      if (this.homeTimer <= 0) {
        this.home = false;
        this.col = this.meta.penExit.col;
        this.row = this.meta.penExit.row;
        this.px = this.meta.penExit.col;
        this.py = this.meta.penExit.row;
        this.dir = Direction.LEFT;
        if (powerActive) this.scared = true;
      }
      return false;
    }

    // Frozen by luggage power-up
    if (frozen) return false;

    // Move
    this.moveGhost(map, player, dtMs);
    return false;
  }

  private moveGhost(map: number[][], player: Player, dtMs: number): void {
    const spdMult = this.eaten ? 2 : this.scared ? 0.6 : 1;
    let remaining = this.speed * spdMult * (dtMs / 16.667);

    while (remaining > 0.001) {
      if (this.atCenter()) {
        this.col = Math.round(this.px);
        this.row = Math.round(this.py);
        if (this.col < 0) this.col = COLS - 1;
        else if (this.col >= COLS) this.col = 0;
        this.px = this.col;
        this.py = this.row;

        // Check pen arrival for eaten ghosts — within 1 cell of pen center
        if (this.eaten &&
            Math.abs(this.col - this.meta.penCenter.col) <= 1 &&
            Math.abs(this.row - this.meta.penCenter.row) <= 1) {
          this.respawning = true;
          this.respawnTimer = GHOST_RESPAWN_DELAY;
          this.eaten = false;
          return;
        }

        this.dir = this.chooseDir(map, player);
        const canGate = this.eaten;
        let nc = this.col + DX[this.dir];
        let nr = this.row + DY[this.dir];
        if (nc < 0) nc = COLS - 1;
        else if (nc >= COLS) nc = 0;
        if (!this.isWalkableForGhost(map, nc, nr, canGate)) break;
      }

      // Distance to next tile center
      let distToCenter: number;
      if (DX[this.dir] !== 0) {
        distToCenter = DX[this.dir] > 0
          ? Math.ceil(this.px + 0.01) - this.px
          : this.px - Math.floor(this.px - 0.01);
      } else {
        distToCenter = DY[this.dir] > 0
          ? Math.ceil(this.py + 0.01) - this.py
          : this.py - Math.floor(this.py - 0.01);
      }
      if (distToCenter < 0.01) distToCenter = 1;

      const step = Math.min(remaining, distToCenter);
      this.px += DX[this.dir] * step;
      this.py += DY[this.dir] * step;
      remaining -= step;

      // Tunnel wrap
      if (this.px < -0.5) this.px += COLS;
      else if (this.px >= COLS - 0.5) this.px -= COLS;

      const newCol = Math.round(this.px);
      const newRow = Math.round(this.py);
      if (newCol !== this.col || newRow !== this.row) {
        this.col = newCol < 0 ? COLS - 1 : newCol >= COLS ? 0 : newCol;
        this.row = newRow;
      }
    }
  }
}
