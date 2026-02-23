# Xonix GAME_SPEC

## Overview
Arcade territory-capture game (Xonix-like) on Canvas 2D. The player moves along safe borders and draws trails through open area to capture regions while avoiding enemies.

## Controls
- `ArrowLeft` / `A`: move left.
- `ArrowRight` / `D`: move right.
- `ArrowUp` / `W`: move up.
- `ArrowDown` / `S`: move down.
- `P`: pause/resume.
- `R`: restart run.
- `Space` / `Enter` / `N` or mouse click: continue after level clear.

## Rules & Scoring
- Player starts on a safe border.
- Moving in open area creates a vulnerable trail.
- Returning trail to safe area captures enclosed region.
- Captured percent and score increase after successful fill.
- Enemy contact with player or active trail costs a life.
- Game over when lives reach 0.
- Goal percent per level starts at `60%` and increases by level.
- Score model:
  - capture gain bonus on successful enclosure,
  - level-complete bonus (`level * 200`).

## Game States
- `playing`: active simulation.
- `paused`: simulation stopped.
- `levelclear`: waiting for player input to start next level.
- `gameover`: run ended.

## Rendering
- Game uses provided canvas only.
- Uses grid-based playfield with side HUD.
- Canvas sizing uses shared DPR-aware utility from `core/canvas_utils.js`.
- Final visible frame is post-processed by shared CRT pipeline from `core/crt_renderer.js`.

## Persistence
- Namespace: `minigames:xonix:*`.
- Key: `minigames:xonix:progress`.
- Schema:
  - `{ version: 1, bestScore: number, bestCapturePercent: number }`

## Known Limitations / TODO
- MVP uses one built-in mode and fixed rule set.
