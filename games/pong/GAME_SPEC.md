# Pong GAME_SPEC

## Overview
Classic Pong on Canvas 2D in single-player format: player controls the left paddle, AI controls the right paddle.

## Controls
- `W` / `ArrowUp`: move paddle up.
- `S` / `ArrowDown`: move paddle down.
- `Space` / `Enter`: start next serve from `ready` state.
- `P`: pause/resume.
- `R`: restart match.

## Rules & Scoring
- Match score is tracked as `Player : AI`.
- Ball bounces from top/bottom borders and paddles.
- If ball leaves left border, AI scores a point.
- If ball leaves right border, player scores a point.
- Match ends when one side reaches 7 points.
- During play, each successful paddle hit slightly increases ball speed (with cap).
- AI paddle uses capped movement speed and discrete reaction updates (not frame-perfect tracking).
- Because AI speed/reaction are limited, sufficiently fast ball rallies can outpace the AI and open scoring windows for the player.

## Game States
- `ready`: waiting for serve start.
- `playing`: active simulation.
- `paused`: simulation stopped.
- `gameover`: match ended; restart prompt shown.

## Rendering
- Game uses provided canvas only.
- Draws arena center line, paddles, ball, score, and state overlays by code.
- Canvas uses shared DPR-aware resize utility from `core/canvas_utils.js`.
- Final visible frame is post-processed by shared CRT pipeline from `core/crt_renderer.js`.

## Persistence
- Namespace: `minigames:pong:*`.
- Key: `minigames:pong:progress`.
- Schema:
  - `{ version: 1, bestScore: number, matchesWon: number }`
- `bestScore` stores best player points achieved in a match.

## Known Limitations / TODO
- MVP has one AI difficulty profile (fixed capped-speed bot).
- No local multiplayer mode in MVP.
