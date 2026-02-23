# Galaxy GAME_SPEC

## Overview
Arcade shooter on Canvas 2D. The player controls a bottom cannon and shoots upward at descending alien ships.

## Controls
- `ArrowLeft` / `A`: move cannon left.
- `ArrowRight` / `D`: move cannon right.
- `Space`: shoot upward.
- `P`: pause/resume.
- `R`: restart run.
- `Enter`: restart after game over.

## Rules & Scoring
- Player starts with 3 lives.
- Aliens spawn as a formation near the top.
- Formation moves horizontally; when reaching a side border, it shifts downward and reverses direction.
- Player bullets destroy aliens.
- Some aliens periodically fire bullets downward.
- Score:
  - +100 for each destroyed alien.
- New wave starts when all aliens are destroyed.
- Difficulty scales by wave (faster movement and firing rate).
- Game over if:
  - player lives reach 0, or
  - an alien reaches the cannon line near the bottom.

## Game States
- `playing`: active simulation.
- `paused`: simulation stopped, overlay shown.
- `gameover`: simulation stopped, restart prompt shown.

## Rendering
- Game uses the provided canvas only (2D context).
- Draws star background, player cannon, alien formation, bullets, and HUD.
- Canvas sizing uses shared DPR-aware utility from `core/canvas_utils.js`.

## Persistence
- Namespace: `minigames:galaxy:*`.
- Key: `minigames:galaxy:progress`.
- Schema:
  - `{ version: 1, bestScore: number }`
- `bestScore` updates whenever current score exceeds saved best.

## Known Limitations / TODO
- MVP has one alien type and no power-ups.
- No boss wave in MVP.
