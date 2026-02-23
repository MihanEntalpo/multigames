# Snake GAME_SPEC

## Overview
Classic Snake on Canvas 2D. The player controls a snake that collects apples, grows, and avoids collisions.

## Controls
- `ArrowUp` / `W`: move up.
- `ArrowDown` / `S`: move down.
- `ArrowLeft` / `A`: move left.
- `ArrowRight` / `D`: move right.
- `P`: pause/resume.
- `R`: restart run.
- `Enter`: restart after game over.

## Rules & Scoring
- Snake moves on a fixed tile grid.
- Eating an apple:
  - increases snake length by 1.
  - gives score (`+10`).
- Collision with wall, obstacle, or own body causes game over.
- Level progression:
  - every 6 apples increases level by 1.
  - each new level adds/changes obstacle layout.
  - movement speed increases with level.

## Obstacles
- Obstacles are generated deterministically from current level.
- Higher level means more blocked cells.
- Obstacles never spawn inside snake start zone.
- Apples never spawn inside obstacles or snake body.

## Game States
- `ready`: waiting for first direction input.
- `playing`: active simulation.
- `paused`: simulation stopped.
- `gameover`: simulation stopped; restart prompt shown.

## Rendering
- Game uses provided canvas only.
- Draws board, grid, snake, apple, obstacles, and HUD via code.
- Canvas sizing uses shared DPR-aware utility from `core/canvas_utils.js`.
- Final visible frame is post-processed by shared CRT pipeline from `core/crt_renderer.js`.

## Persistence
- Namespace: `minigames:snake:*`.
- Key: `minigames:snake:progress`.
- Schema:
  - `{ version: 1, bestScore: number, bestLevel: number }`

## Known Limitations / TODO
- MVP has one game mode (no wrap-through walls mode).
- No special apples/power-ups in MVP.
