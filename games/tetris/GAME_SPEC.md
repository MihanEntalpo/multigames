# Tetris GAME_SPEC

## Overview
Classic single-player Tetris implemented on Canvas 2D.

## Controls
- `ArrowLeft`: move active piece left.
- `ArrowRight`: move active piece right.
- `ArrowDown`: soft drop (faster fall while key is held).
- `ArrowUp` or `X`: rotate clockwise.
- `Z`: rotate counterclockwise.
- `Space`: hard drop.
- `P`: pause/resume.
- `R`: restart current run.
- `Enter`: restart when game over.

## Rules & Scoring
- Board size: 10x20 visible cells, with 2 hidden spawn rows above the visible area.
- Standard tetromino set: `I, O, T, S, Z, J, L`.
- Randomizer: 7-bag shuffle (all 7 pieces appear before bag refill).
- Piece locks when it can no longer move down.
- Full rows are cleared immediately after lock.
- Score per clear:
  - 1 line: +100
  - 2 lines: +300
  - 3 lines: +500
  - 4 lines: +800
- Total cleared lines are tracked.
- Gravity timing:
  - normal fall: 700 ms per cell
  - soft drop: 60 ms per cell while key is held
  - after piece lock/spawn, gravity accumulator is reset (no timer carry-over between pieces)
- Game over occurs when a newly spawned piece collides immediately.

## Game States
- `playing`: normal update/render loop.
- `paused`: simulation stops, render shows pause overlay.
- `gameover`: simulation stops, render shows restart hint.

## Rendering
- Game uses a single provided canvas.
- Canvas sizing uses shared DPR-aware resize utility from `core/canvas_utils.js`.
- Playfield and side panel (score, lines, best score, controls hint) are rendered in CSS pixel coordinates.
- Colors are code-defined; no external assets.

## Persistence
- Namespace: `minigames:tetris:*`.
- Key: `minigames:tetris:progress`.
- Schema:
  - `{ version: 1, bestScore: number }`
- `bestScore` updates when current score exceeds saved best.

## Known Limitations / TODO
- Rotation system is stable but simplified (no full SRS kick table).
- No preview queue / hold piece in MVP.
