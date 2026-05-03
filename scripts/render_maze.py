"""Pretty-print a 19x21 maze grid for human review.

Tile mapping (matches src/config/constants.ts):
  0 = EMPTY     -> '  '
  1 = WALL      -> '##'
  2 = DOT       -> ' .'
  3 = POWER     -> ' o'
  4 = GATE      -> '=='

Usage:
  python3 scripts/render_maze.py l1
  python3 scripts/render_maze.py l7
"""

from __future__ import annotations
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

GLYPHS = {0: " ", 1: "█", 2: "·", 3: "●", 4: "═"}


def render(name: str, grid: list[list[int]]) -> str:
    cols = len(grid[0])
    header = "    " + "".join(str(c % 10) for c in range(cols))
    lines = [f"=== {name} ({cols}x{len(grid)}) ===", header]
    for r, row in enumerate(grid):
        cells = "".join(GLYPHS[v] for v in row)
        lines.append(f"{r:2d}  {cells}")
    return "\n".join(lines)


# L1 = current BASE_MAP (Changi). Already plays well; we just retheme via bg.
L1: list[list[int]] = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,1],
    [1,3,1,1,2,1,1,1,2,1,2,1,1,1,2,1,1,3,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,2,1,2,1,1,1,1,1,2,1,2,1,1,2,1],
    [1,2,2,2,2,1,2,2,2,1,2,2,2,1,2,2,2,2,1],
    [1,1,1,1,2,1,1,1,0,1,0,1,1,1,2,1,1,1,1],
    [1,2,2,2,2,1,0,0,0,0,0,0,0,1,2,2,2,2,1],
    [1,2,1,1,2,1,0,1,1,4,1,1,0,1,2,1,1,2,1],
    [1,2,2,2,2,0,0,1,0,0,0,1,0,0,2,2,2,2,1],
    [1,2,1,1,2,1,0,1,0,0,0,1,0,1,2,1,1,2,1],
    [1,2,2,2,2,1,0,1,1,1,1,1,0,1,2,2,2,2,1],
    [1,1,1,1,2,1,0,0,0,0,0,0,0,1,2,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,2,1,1,1,2,1,2,1,1,1,2,1,1,2,1],
    [1,3,2,1,2,2,2,2,2,0,2,2,2,2,2,1,2,3,1],
    [1,1,2,1,2,1,2,1,1,1,1,1,2,1,2,1,2,1,1],
    [1,2,2,2,2,1,2,2,2,1,2,2,2,1,2,2,2,2,1],
    [1,2,1,1,1,1,1,1,2,1,2,1,1,1,1,1,1,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
]


# L7 — Typography maze "BEST RATES EVERY TRIP" stacked across 4 lines.
# 3-col x 3-row pixel font (compact). Ghost pen folded into letter spacing.
# Power pellets at the four "punctuation" corners of the message.
#
# Letter glyphs (3 wide x 3 tall, '#' = wall):
#   B: ##./#.#/##. with bottom row . (extended)
# Designed for 19 cols x 21 rows. Gap rows are 1-row corridors with dots.
# Player spawns mid-bottom. Ghost pen at center (between RATES and EVERY).
#
# Layout:
#   row 0      border
#   row 1      top corridor (dots + 2 power pellets)
#   row 2-4    "BEST"   (4 letters * 3 cols + 3 gaps = 15 cols, centered cols 2-16)
#   row 5      corridor
#   row 6-8    "RATES"  (5 letters * 3 cols + 4 gaps = 19 cols, full width)
#   row 9      corridor + ghost pen approach
#   row 10-12  GHOST PEN (replaces letter row — pen takes priority over msg here)
#   row 13     corridor
#   row 14-16  "EVERY"  (full width)
#   row 17     corridor
#   row 18-19  "TRIP"   (4 letters * 3 + 3 = 15, centered) + bottom row spawn
#   row 20     border
#
# Wait — that's 22 rows. Cut to 3-line message: drop "TRIP" — campaign payload
# is "BEST RATES EVERY [trip]"; the word "TRIP" appears on the celebration
# screen instead. Maze says BEST / RATES / EVERY which is still strong.
#
# Revised layout fits 21 rows cleanly:
#   row 0      border
#   row 1      top corridor + power pellets
#   row 2-4    "BEST"
#   row 5      corridor
#   row 6-8    "RATES"
#   row 9      corridor (dots)
#   row 10-12  ghost pen
#   row 13     corridor
#   row 14-16  "EVERY"
#   row 17     corridor + power pellets + player spawn approach
#   row 18-19  bottom dots corridor
#   row 20     border

# Pixel letters 3w x 5h. Each is 3 cols wide, 5 rows tall. '1' = wall, '0' = path.
LETTERS_3x5 = {
    "B": [[1,1,0],[1,0,1],[1,1,0],[1,0,1],[1,1,0]],
    "E": [[1,1,1],[1,0,0],[1,1,0],[1,0,0],[1,1,1]],
    "S": [[1,1,1],[1,0,0],[1,1,1],[0,0,1],[1,1,1]],
    "T": [[1,1,1],[0,1,0],[0,1,0],[0,1,0],[0,1,0]],
    "R": [[1,1,0],[1,0,1],[1,1,0],[1,0,1],[1,0,1]],
    "A": [[1,1,1],[1,0,1],[1,1,1],[1,0,1],[1,0,1]],
    "V": [[1,0,1],[1,0,1],[1,0,1],[1,0,1],[0,1,0]],
    "Y": [[1,0,1],[1,0,1],[0,1,0],[0,1,0],[0,1,0]],
    "I": [[1,1,1],[0,1,0],[0,1,0],[0,1,0],[1,1,1]],
    "P": [[1,1,0],[1,0,1],[1,1,0],[1,0,0],[1,0,0]],
}


def lay_word(grid, word, top_row, start_col, gap=1):
    """Stamp a word into the grid as walls. 5-row tall letters, 3 cols wide each."""
    col = start_col
    for ch in word:
        glyph = LETTERS_3x5[ch]
        for dr in range(5):
            for dc in range(3):
                if glyph[dr][dc]:
                    grid[top_row + dr][col + dc] = 1
        col += 3 + gap


def fill_dots(grid):
    """Replace all 0s (paths) with 2 (dot). We'll punch back specific zeros after."""
    for r in range(len(grid)):
        for c in range(len(grid[0])):
            if grid[r][c] == 0:
                grid[r][c] = 2


def flood_fill_reachable(grid, start_r: int, start_c: int) -> set:
    """BFS from start, returning set of (r,c) reachable through non-wall cells.
    Walls (1) block, gates (4) block (player can't cross gate from outside).
    Tunnels at edges (cells with value != 1) are crossable."""
    H = len(grid)
    W = len(grid[0])
    seen = set()
    stack = [(start_r, start_c)]
    while stack:
        r, c = stack.pop()
        if (r, c) in seen:
            continue
        if r < 0 or r >= H or c < 0 or c >= W:
            continue
        if grid[r][c] == 1 or grid[r][c] == 4:
            continue
        seen.add((r, c))
        stack.extend([(r+1, c), (r-1, c), (r, c+1), (r, c-1)])
    # Wraparound: if (r, 0) reachable, (r, W-1) too, and vice versa
    for r in range(H):
        if (r, 0) in seen and grid[r][W-1] != 1:
            stack.append((r, W-1))
        if (r, W-1) in seen and grid[r][0] != 1:
            stack.append((r, 0))
    while stack:
        r, c = stack.pop()
        if (r, c) in seen:
            continue
        if r < 0 or r >= H or c < 0 or c >= W:
            continue
        if grid[r][c] == 1 or grid[r][c] == 4:
            continue
        seen.add((r, c))
        stack.extend([(r+1, c), (r-1, c), (r, c+1), (r, c-1)])
    return seen


def clear_unreachable(grid, player_spawn_r: int, player_spawn_c: int):
    """Set unreachable non-wall cells to EMPTY (0) so they don't gate completion."""
    reachable = flood_fill_reachable(grid, player_spawn_r, player_spawn_c)
    H = len(grid)
    W = len(grid[0])
    for r in range(H):
        for c in range(W):
            if grid[r][c] == 2 and (r, c) not in reachable:
                grid[r][c] = 0  # decorative interior, not a collectable dot


def punch(grid, r, c, val):
    grid[r][c] = val


def build_l7() -> list[list[int]]:
    """L7 typography maze — 'BEST' over 'RATES', 5-tall letters, ghost pen in middle gap.

    Layout (21 rows × 19 cols):
      row 0       border wall
      row 1-2     top corridor (dots) + 2 power pellets in corners
      row 3-7     'BEST'  — 4 letters * 3 cols + 3 gaps = 15 cols, start col 2
      row 8       corridor (dots)
      row 9-11    GHOST PEN — 3 rows tall, cols 7-11, gate on top
      row 12      corridor (dots)
      row 13-17   'RATES' — 5 letters * 3 cols + 4 gaps = 19 cols, start col 0... too tight.
                  Use 5 letters * 3 cols + 0 gaps (touching) = 15 cols, start col 2 (matches BEST)
      row 18-19   bottom corridor (dots) + 2 power pellets
      row 20      border wall
      side tunnel at row 10 (mid-pen): cols 0 and 18 = EMPTY (wraparound)

    Player spawn: row 19, col 9 (matches existing PLAYER_START area, just shifted).
    """
    g = [[0]*19 for _ in range(21)]
    # Border
    for c in range(19):
        g[0][c] = 1
        g[20][c] = 1
    for r in range(21):
        g[r][0] = 1
        g[r][18] = 1

    # "BEST" — 4 letters * 3 cols + 3 gaps = 15 cols, centered start col 2
    lay_word(g, "BEST", top_row=3, start_col=2, gap=1)
    # "RATES" — 5 letters * 3 cols + 4 gaps = 19 cols, full width start col 0.
    # Edge letters (R, S) sit ON the border columns — visually merges with the
    # border walls, but the interior shape of each letter still reads.
    lay_word(g, "RATES", top_row=13, start_col=0, gap=1)

    # Ghost pen — rows 9-11, cols 7-11
    for c in range(7, 12):
        g[9][c] = 1   # top wall
        g[11][c] = 1  # bottom wall
    g[10][7] = 1
    g[10][11] = 1
    g[9][9] = 4  # gate

    # Convert paths to dots.
    fill_dots(g)

    # Pen interior is empty
    g[10][8] = 0
    g[10][9] = 0
    g[10][10] = 0

    # Side tunnels — open at row 10 (mid-pen)
    g[10][0] = 0
    g[10][18] = 0
    # Tunnel approach corridor on row 10 should be empty (no dots in tunnel)
    for c in range(1, 7):
        if g[10][c] == 2:
            g[10][c] = 0
    for c in range(12, 18):
        if g[10][c] == 2:
            g[10][c] = 0

    # Power pellets at 4 corners
    g[1][1] = 3
    g[1][17] = 3
    g[19][1] = 3
    g[19][17] = 3

    # Strip dots from cells unreachable from player spawn (decorative letter interiors)
    clear_unreachable(g, player_spawn_r=19, player_spawn_c=9)

    return g


def empty_grid_with_border() -> list[list[int]]:
    g = [[0]*19 for _ in range(21)]
    for c in range(19):
        g[0][c] = 1
        g[20][c] = 1
    for r in range(21):
        g[r][0] = 1
        g[r][18] = 1
    return g


def stamp_pen(g, top_row=8, gate_col=9, left_col=7, right_col=11):
    """Stamp standard ghost pen — 3 rows tall, 5 cols wide, gate on top-middle row."""
    for c in range(left_col, right_col+1):
        g[top_row][c] = 1
        g[top_row+2][c] = 1
    g[top_row+1][left_col] = 1
    g[top_row+1][right_col] = 1
    g[top_row][gate_col] = 4  # gate is always in the top wall of the pen


def open_side_tunnel(g, row: int):
    g[row][0] = 0
    g[row][18] = 0


def clear_transit_lanes(g, cols=(1, 17), rows=()):
    """Clear dots from specified columns and rows — turns them into open transit lanes
    (no dots = movement highway). Walls remain walls; only dots (2) → empty (0)."""
    for r in range(len(g)):
        for c in cols:
            if g[r][c] == 2:
                g[r][c] = 0
    for r in rows:
        for c in range(len(g[0])):
            if g[r][c] == 2:
                g[r][c] = 0


def build_l2_tokyo() -> list[list[int]]:
    """L2 Tokyo — simpler than L1, fewer crevices, easy to navigate.
    Two horizontal walls + a small Fuji accent. Plenty of long open corridors."""
    g = empty_grid_with_border()
    # Mt Fuji accent — tiny, top-center
    for r, cs in [(2, [9]), (3, [8, 9, 10])]:
        for c in cs:
            g[r][c] = 1
    # Top half — modest pillars + 2 standalone blocks for variety
    walls_top = [
        (4, [9]),                          # below Fuji
        (5, [3, 4, 5, 13, 14, 15]),
        (5, [9]),
        (6, [9]),
        (7, [3, 4, 5, 13, 14, 15]),
        (7, [7, 11]),                       # extra pillar pair near pen
    ]
    for r, cs in walls_top:
        for c in cs:
            g[r][c] = 1
    # Pen
    stamp_pen(g, top_row=8)
    # Bottom half — mirror with one extra row of pillars
    walls_bot = [
        (12, [3, 4, 5, 13, 14, 15]),
        (12, [7, 11]),                      # extra pillar pair
        (13, [9]),
        (14, [3, 4, 5, 13, 14, 15]),
        (14, [9]),
        (16, [6, 7, 11, 12]),               # mid-block bar
        (17, [4, 5, 14, 15]),
    ]
    for r, cs in walls_bot:
        for c in cs:
            g[r][c] = 1
    fill_dots(g)
    g[9][8] = 0; g[9][9] = 0; g[9][10] = 0
    open_side_tunnel(g, 9)
    # Tokyo is meant to be easier than classic Pacman — strip lots of lanes
    clear_transit_lanes(g, cols=(1, 2, 16, 17), rows=(4, 11, 15, 16, 18, 19))
    g[1][9] = 3
    g[5][1] = 3
    g[5][17] = 3
    g[19][9] = 3
    clear_unreachable(g, 19, 9)
    return g


def build_l3_bangkok() -> list[list[int]]:
    """L3 Bangkok — open meander pattern, no dead-ends. Walls form
    horizontal/vertical bars only, with all corridors connecting back to a loop."""
    g = empty_grid_with_border()
    # Three temple spire pips top center
    for r, cs in [(2, [5, 9, 13])]:
        for c in cs:
            g[r][c] = 1
    # Symmetric horizontal bars — all corridors loop back through outer ring
    walls = [
        # Top zone — long horizontal bars
        (4, [3, 4, 5, 13, 14, 15]),       # left + right horizontal slabs
        (4, [8, 9, 10]),                   # center slab
        (6, [3, 4, 5, 6, 12, 13, 14, 15]), # wider bars
        (6, [9]),                           # center divider gap
        # Pen rows 8-10 (stamped via stamp_pen)
        # Bottom zone — mirror of top
        (12, [3, 4, 5, 6, 12, 13, 14, 15]),
        (12, [9]),
        (14, [3, 4, 5, 13, 14, 15]),
        (14, [8, 9, 10]),
        # Bottom decorative spires
        (17, [4, 5, 13, 14]),
        (17, [9]),
    ]
    for r, cs in walls:
        for c in cs:
            g[r][c] = 1
    stamp_pen(g, top_row=8)
    fill_dots(g)
    g[9][8] = 0; g[9][9] = 0; g[9][10] = 0
    open_side_tunnel(g, 9)
    # Lighter transit-lane stripping than before — keep more pellets in flow
    clear_transit_lanes(g, cols=(1, 17), rows=(11,))
    # Trap zone — strip dots above pen
    for r in (6, 7):
        for c in range(6, 13):
            if g[r][c] == 2:
                g[r][c] = 0
    g[1][1] = 3; g[1][17] = 3
    g[19][1] = 3; g[19][17] = 3
    clear_unreachable(g, 19, 9)
    return g


def build_l4_lounge() -> list[list[int]]:
    """L4 SPACE bonus — bigger rocket silhouette, fully connected.
    Densely packed dots inside. GameScene reads cfg.isBonus: 30s timer, scared
    slow ghosts, x3 score, no maze dimmer (space bg fills the canvas around)."""
    g = empty_grid_with_border()
    # Wall off the canvas — carve the rocket silhouette open.
    for r in range(1, 20):
        for c in range(1, 18):
            g[r][c] = 1

    # Bigger rocket — fills more of canvas, fully connected from nose to engine.
    rocket = [
        # Nose cone (rows 1-3)
        (1, [9]),
        (2, [8, 9, 10]),
        (3, [7, 8, 9, 10, 11]),
        # Upper body (rows 4-7)
        (4, [6, 7, 8, 9, 10, 11, 12]),
        (5, [5, 6, 7, 8, 9, 10, 11, 12, 13]),
        (6, [5, 6, 7, 8, 9, 10, 11, 12, 13]),
        (7, [5, 6, 7, 8, 9, 10, 11, 12, 13]),
        # Mid body (rows 8-11) — widest, ghost pen lives here
        (8, [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]),
        (9, [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]),
        (10, [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]),
        (11, [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]),
        # Lower body (rows 12-13)
        (12, [5, 6, 7, 8, 9, 10, 11, 12, 13]),
        (13, [5, 6, 7, 8, 9, 10, 11, 12, 13]),
        # Fins flare (rows 14-15)
        (14, [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]),
        (15, [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]),
        # Fin tips taper (row 16)
        (16, [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]),
        # Engine flare (rows 17-18) — narrows to point
        (17, [7, 8, 9, 10, 11]),
        (18, [8, 9, 10]),
    ]
    for r, cs in rocket:
        for c in cs:
            g[r][c] = 0

    # Ghost pen — inside mid body (rows 9-11 cols 8-10)
    stamp_pen(g, top_row=9, left_col=8, right_col=10)

    fill_dots(g)
    g[10][8] = 0; g[10][9] = 0; g[10][10] = 0  # pen interior

    # Power pellets at distinctive points
    g[1][9] = 3   # nose tip
    g[14][3] = 3  # left fin tip
    g[14][15] = 3 # right fin tip
    g[18][9] = 3  # engine tip

    # Verify all open cells reachable from player spawn (engine area).
    # If not — flag visually by leaving as walls. (Player spawn computed by analyzeMaze
    # walks col 9 up from bottom, will land on row 18 col 9 = engine.)
    clear_unreachable(g, 18, 9)
    return g


def build_l5_seoul() -> list[list[int]]:
    """L5 Seoul — dense Gangnam city-block grid. Many 2x2 blocks at high density.
    Tiny Namsan tip top-center as accent (no full tower)."""
    g = empty_grid_with_border()
    # Tiny Namsan tip accent
    g[2][9] = 1
    # Dense 2x2 block grid — uniform Gangnam city-block feel
    blocks = [
        # Row band 3-4
        (3, 2), (3, 5), (3, 8), (3, 11), (3, 14),
        # Row band 5-6
        (5, 3), (5, 6), (5, 9), (5, 12), (5, 15),
        # Row band 12-13
        (12, 2), (12, 5), (12, 8), (12, 11), (12, 14),
        # Row band 14-15
        (14, 3), (14, 6), (14, 9), (14, 12), (14, 15),
        # Row band 16-17
        (16, 2), (16, 5), (16, 8), (16, 11), (16, 14),
    ]
    for r, c in blocks:
        if c + 1 < 18:
            g[r][c] = 1
            g[r][c+1] = 1
            g[r+1][c] = 1
            g[r+1][c+1] = 1
    # Pen rows 8-10
    stamp_pen(g, top_row=8)
    fill_dots(g)
    g[9][8] = 0; g[9][9] = 0; g[9][10] = 0
    open_side_tunnel(g, 9)
    clear_transit_lanes(g, cols=(1, 17), rows=(11, 18, 19))
    g[1][1] = 3; g[1][17] = 3
    g[19][1] = 3; g[19][17] = 3
    clear_unreachable(g, 19, 9)
    return g


def build_l6_kl() -> list[list[int]]:
    """L6 KL — Petronas Twin Towers as two tall parallel wall columns + skybridge."""
    g = empty_grid_with_border()
    # Left tower — cols 6-7, rows 2-12 (tall)
    for r in range(2, 13):
        g[r][6] = 1
        g[r][7] = 1
    # Right tower — cols 11-12, rows 2-12
    for r in range(2, 13):
        g[r][11] = 1
        g[r][12] = 1
    # Skybridge — connects mid-height (row 7)
    for c in range(7, 12):
        g[7][c] = 1
    # Tower spires (top antennas)
    g[1][6] = 1; g[1][7] = 1; g[1][11] = 1; g[1][12] = 1
    # Tower bases — extend at bottom
    for c in [5, 13]:
        g[12][c] = 1
    # Ghost pen — placed BELOW twin towers, rows 14-16
    stamp_pen(g, top_row=14)
    # Top corridor decorations between/around towers — sparse
    for r, c in [(3, 9), (5, 9), (9, 9), (11, 9)]:
        g[r][c] = 1  # central column dots-blocker beats
    # Bottom corridor pillars
    for c in [3, 4, 14, 15]:
        g[18][c] = 1
    fill_dots(g)
    g[15][8] = 0; g[15][9] = 0; g[15][10] = 0
    open_side_tunnel(g, 15)
    clear_transit_lanes(g, cols=(1, 17), rows=(13,))
    g[1][1] = 3; g[1][17] = 3
    g[19][1] = 3; g[19][17] = 3
    clear_unreachable(g, 19, 9)
    return g


def build_l1_changi():
    g = [row[:] for row in L1]
    # Strip dots from highways: row 9 (mid), row 13 (lower), cols 1+17 (vertical highways)
    clear_transit_lanes(g, cols=(1, 17), rows=(9, 13))
    return g


BUILDERS = {
    "l1": ("L1 — Changi (existing BASE_MAP)", build_l1_changi),
    "l2": ("L2 — Tokyo (Mt Fuji silhouette + Tokyo Tower)", build_l2_tokyo),
    "l3": ("L3 — Bangkok (Wat Arun three spires)", build_l3_bangkok),
    "l4": ("L4 — Bonus First Class Lounge", build_l4_lounge),
    "l5": ("L5 — Seoul (Namsan + Gangnam grid)", build_l5_seoul),
    "l6": ("L6 — Kuala Lumpur (Petronas Twin Towers)", build_l6_kl),
    "l7": ("L7 — Sydney Typography 'BEST RATES' (bg = Opera House silhouette)", build_l7),
}


def main():
    if len(sys.argv) < 2:
        print("usage: render_maze.py l1|l2|l3|l4|l5|l6|l7|all")
        return
    mode = sys.argv[1].lower()
    if mode == "all":
        for k in ["l1","l2","l3","l4","l5","l6","l7"]:
            name, fn = BUILDERS[k]
            print(render(name, fn()))
            print()
        return
    if mode == "both":  # backwards compat
        mode_list = ["l1", "l7"]
    else:
        mode_list = [mode]
    for k in mode_list:
        if k not in BUILDERS:
            print(f"unknown: {k}"); continue
        name, fn = BUILDERS[k]
        print(render(name, fn()))
        print()


if __name__ == "__main__":
    main()
