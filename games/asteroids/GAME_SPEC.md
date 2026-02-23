# Asteroids GAME_SPEC

## Overview
Classic single-player Asteroids on Canvas 2D. The player pilots a ship, destroys asteroids, and survives collisions.

## Controls
- `ArrowLeft` / `A`: rotate ship left.
- `ArrowRight` / `D`: rotate ship right.
- `ArrowUp` / `W`: thrust forward.
- `Space`: shoot.
- `P`: pause/resume.
- `R`: restart run.
- `Enter`: restart after game over.

## Rules & Scoring
- Player starts with 3 lives.
- Wave starts with large asteroids.
- Destroying asteroids grants score:
  - large: +20
  - medium: +50
  - small: +100
- Large and medium asteroids split into two smaller asteroids when destroyed.
- Small asteroids are removed permanently.
- New wave starts when all asteroids are cleared.
- Game over when lives reach 0.

## Game States
- `playing`: active simulation.
- `paused`: simulation stopped, pause overlay shown.
- `gameover`: simulation stopped, restart prompt shown.

## Rendering
- Entire game renders on provided canvas.
- Ship, asteroids, bullets, and HUD are vector-like primitives.
- Canvas sizing uses shared DPR-aware utility from `core/canvas_utils.js`.
- Objects wrap around screen edges.
- Final visible frame is post-processed by shared CRT pipeline from `core/crt_renderer.js`.

## Persistence
- Namespace: `minigames:asteroids:*`.
- Key: `minigames:asteroids:progress`.
- Schema:
  - `{ version: 1, bestScore: number }`
- `bestScore` updates whenever current score exceeds saved best.

## Known Limitations / TODO
- MVP uses one weapon type only.
- No UFO enemies in MVP.
