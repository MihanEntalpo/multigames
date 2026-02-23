# Arkanoid GAME_SPEC

## Overview
Single-player Arkanoid (brick breaker) on Canvas 2D. The player controls a paddle and keeps the ball in play to clear all bricks.

## Controls
- `ArrowLeft` / `A`: move paddle left.
- `ArrowRight` / `D`: move paddle right.
- `Space`: launch ball from paddle (before start) and continue after lose-life pause.
- `P`: pause/resume.
- `R`: restart current run.
- `Enter`: restart after game over or win.

## Rules & Scoring
- Field uses one paddle, one ball, and a brick grid at the top.
- Ball bounces off walls, paddle, and bricks.
- Brick hit removes brick and gives points.
- Default brick score: +100 per brick.
- Initial lives: 3.
- Life is lost when ball goes below the bottom border.
- If lives remain, round continues after ball reset on paddle.
- Win condition: all bricks are destroyed.
- Lose condition: lives reach 0.

## Game States
- `ready`: ball attached to paddle, waiting for launch.
- `playing`: active simulation.
- `paused`: simulation stopped, overlay shown.
- `won`: all bricks cleared.
- `gameover`: no lives left.

## Rendering
- Game draws playfield border, bricks, paddle, ball, and HUD (score/lives/best score).
- Canvas size is managed through shared DPR-aware utility from `core/canvas_utils.js`.
- Layout scales to available canvas size while preserving gameplay proportions.
- Final visible frame is post-processed by shared CRT pipeline from `core/crt_renderer.js`.

## Persistence
- Namespace: `minigames:arkanoid:*`.
- Key: `minigames:arkanoid:progress`.
- Schema:
  - `{ version: 1, bestScore: number }`
- `bestScore` is updated whenever current score exceeds saved value.

## Known Limitations / TODO
- Single level only in MVP.
- No power-ups or multi-ball.
