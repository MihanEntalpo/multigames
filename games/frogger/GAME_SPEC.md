# Frogger GAME_SPEC

## Overview
Arcade game on Canvas 2D inspired by Frogger. The player controls a frog that must cross dangerous road and river lanes to reach top home slots.

## Controls
- `ArrowUp` / `W`: jump one tile up.
- `ArrowDown` / `S`: jump one tile down.
- `ArrowLeft` / `A`: jump one tile left.
- `ArrowRight` / `D`: jump one tile right.
- `P`: pause/resume.
- `R`: restart run.
- `Enter`: restart after game over.

## Rules & Scoring
- Player starts with 3 lives.
- Frog starts on the bottom safe row.
- Road lanes contain moving vehicles:
  - collision with a vehicle costs one life.
  - lane template is intentionally forgiving: fewer vehicles and wider gaps than arcade-original pacing.
- River lanes contain moving carriers (logs/turtles):
  - frog must stand on a carrier; otherwise it drowns.
  - while on a carrier, frog drifts together with it.
  - carriers are also spaced with larger safe intervals to reduce early difficulty.
- Top row contains home slots:
  - reaching an empty slot locks it as filled and gives score.
  - reaching an already filled slot counts as failure.
- Wave/level completes when all home slots are filled.
- Next level increases lane speed and keeps score/lives.

Scoring:
- +10 for each upward jump.
- +50 for each filled home slot.
- +100 bonus when finishing a level.

## Game States
- `ready`: waiting for first move input.
- `playing`: active simulation.
- `paused`: simulation stopped.
- `gameover`: simulation stopped; restart prompt shown.

## Rendering
- Game uses provided canvas only.
- World is grid-based: safe rows, road rows, river rows, frog, vehicles, carriers, and home slots are drawn by code.
- Canvas uses shared DPR-aware resize utility from `core/canvas_utils.js`.
- Final visible frame is post-processed by shared CRT pipeline from `core/crt_renderer.js`.

## Persistence
- Namespace: `minigames:frogger:*`.
- Key: `minigames:frogger:progress`.
- Schema:
  - `{ version: 1, bestScore: number, bestLevel: number }`

## Known Limitations / TODO
- MVP has one static lane layout template (easy-density variant).
- No bonus timers or extra life mechanics in MVP.
