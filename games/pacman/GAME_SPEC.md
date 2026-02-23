# PacMan GAME_SPEC

## Overview
Arcade maze game (Pac-Man-like) on Canvas 2D. The player navigates a maze, eats pellets, avoids ghosts, and clears waves.

## Controls
- `ArrowLeft` / `A`: move left.
- `ArrowRight` / `D`: move right.
- `ArrowUp` / `W`: move up.
- `ArrowDown` / `S`: move down.
- Any movement key also starts a new wave from `ready` state.
- `P`: pause/resume.
- `R`: restart run.
- `Enter`: restart after game over.

## Rules & Scoring
- Player starts with 3 lives.
- Eating normal pellet: +10 points.
- Eating power pellet: +50 points and temporary ghost frightened mode.
- Eating frightened ghost: +200 points, ghost turns into eyes and runs back to spawn.
- If normal ghost touches player: lose one life and reset positions.
- Ghosts spawn/respawn in the central ghost house (`#GGG#`) and leave through the top opening.
- Ghosts use slightly different individual speed factors, so they naturally spread out instead of moving as one cluster.
- Ghost in `eyes` mode does not damage player and restores to normal only after reaching its spawn cell.
- Ghost in `eyes` mode uses A* pathfinding to return to spawn via maze corridors.
- A* for eyes uses only cardinal movement (up/down/left/right), diagonal steps are forbidden.
- Player spawn point (`P`) is directly below the ghost house.
- Wave is cleared when all pellets are eaten.
- New wave restarts pellets, increases level, and switches to the next validated maze template (cyclic).
- Game over when lives reach 0.

## Game States
- `ready`: initial state of each wave; simulation is frozen until player starts movement.
- `playing`: active simulation.
- `paused`: simulation stopped.
- `gameover`: simulation stopped; restart prompt shown.

## Rendering
- Game uses provided canvas only.
- Maze, pellets, player, ghosts, and HUD are rendered by code (no assets).
- PacMan mouth animation is tied to traveled distance, so chomp speed matches movement/pellet eating pace.
- In `eyes` mode ghost body is hidden, only eyes are rendered.
- Canvas sizing uses shared DPR-aware utility from `core/canvas_utils.js`.

## Maze Validation (Required)
- Every newly created maze template must be validated by `games/pacman/maze_validator.js`.
- Validation is executed on every new level before selecting the next maze.
- Validation checks connectivity of the whole walkable graph: all walkable cells and all pellets must be reachable from player spawn.
- Validation also enforces controlled maze shape: rectangular rows and a fully closed outer border of walls (`#`).
- If validation fails (unreachable cells/pellets or invalid markers), the game must discard that template and create/select another maze.

## Persistence
- Namespace: `minigames:pacman:*`.
- Key: `minigames:pacman:progress`.
- Schema:
  - `{ version: 1, bestScore: number, bestLevel: number }`

## Known Limitations / TODO
- MVP uses a small built-in set of maze templates selected per level with validation.
- No fruit bonus in MVP.
