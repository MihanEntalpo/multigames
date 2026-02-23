# Sokoban GAME_SPEC

## Overview
Single-player Sokoban puzzle on Canvas 2D. The player moves in a grid and pushes boxes onto target cells.

## Controls
- `ArrowLeft` / `A`: move left.
- `ArrowRight` / `D`: move right.
- `ArrowUp` / `W`: move up.
- `ArrowDown` / `S`: move down.
- `R`: restart current level.
- `P`: pause/resume.
- `N` or `Enter`: proceed after level clear.
- `[` / `]`: previous/next unlocked level.

## Rules
- Movement is tile-based.
- Player can push (not pull) exactly one box at a time.
- A move into a wall is blocked.
- Pushing is blocked if next tile after a box is a wall or another box.
- Each level has matching counts of boxes and target tiles.
- Level is solved when all boxes are on target tiles.
- On solve:
  - next level is unlocked,
  - best move count for level is updated when improved.
- On game start, current level is set to the highest unlocked level.

## Game States
- `playing`: active gameplay.
- `paused`: input for movement disabled.
- `level_complete`: current level solved, waiting for next-level command.
- `all_complete`: all levels solved, waiting for restart command.

## Rendering
- Draws board, walls, targets, boxes, player, and side HUD.
- Board is centered in a dedicated area and scales by cell size.
- Canvas sizing uses shared DPR-aware utility from `core/canvas_utils.js`.

## Persistence
- Namespace: `minigames:sokoban:*`.
- Key: `minigames:sokoban:progress`.
- Schema:
  - `{ version: 1, highestUnlocked: number, bestMovesByLevel: Record<string, number> }`
- `highestUnlocked` stores max unlocked level index.
- `bestMovesByLevel[levelIndex]` stores best (minimum) moves for each completed level.

## Known Limitations / TODO
- MVP includes a small built-in set of levels only.
- No undo feature in MVP.
