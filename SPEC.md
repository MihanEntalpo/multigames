# Mini Games Collection - Project Specification

## Purpose
A browser-based collection of mini-games built with plain HTML/CSS/JavaScript and rendered via Canvas 2D.

## Project Structure
- `index.html`: main shell with game menu + shared canvas.
- `style.css`: shared styles for all pages.
- `main.js`: main entrypoint, builds registry and starts `GameManager`.
- `test_tetris.html`: standalone Tetris debug page using the same Tetris game script.
- `test_arkanoid.html`: standalone Arkanoid debug page using the same Arkanoid game script.
- `core/game_manager.js`: game registry, hash routing, lifecycle switching.
- `core/storage.js`: localStorage helper utilities.
- `core/canvas_utils.js`: DPR-aware canvas resize helper.
- `games/tetris/tetris.js`: Tetris implementation.
- `games/tetris/GAME_SPEC.md`: Tetris-specific rules/spec.
- `games/arkanoid/arkanoid.js`: Arkanoid implementation.
- `games/arkanoid/GAME_SPEC.md`: Arkanoid-specific rules/spec.
- `games/asteroids/asteroids.js`: Asteroids implementation.
- `games/asteroids/GAME_SPEC.md`: Asteroids-specific rules/spec.
- `games/galaxy/galaxy.js`: Galaxy implementation.
- `games/galaxy/GAME_SPEC.md`: Galaxy-specific rules/spec.
- `games/pacman/maze_validator.js`: PacMan maze validation script (walkability/connectivity checks).
- `games/pacman/pacman.js`: PacMan implementation.
- `games/pacman/GAME_SPEC.md`: PacMan-specific rules/spec.
- `games/frogger/frogger.js`: Frogger implementation.
- `games/frogger/GAME_SPEC.md`: Frogger-specific rules/spec.
- `games/snake/snake.js`: Snake implementation.
- `games/snake/GAME_SPEC.md`: Snake-specific rules/spec.
- `games/sokoban/sokoban.js`: Sokoban implementation.
- `games/sokoban/GAME_SPEC.md`: Sokoban-specific rules/spec.
- `games/xonix/xonix.js`: Xonix implementation.
- `games/xonix/GAME_SPEC.md`: Xonix-specific rules/spec.
- `AGENTS.md`: repository-level agent workflow rules.

## Architecture
- Single shared shell: `index.html` + `style.css`.
- Core orchestration: `GameManager` + in-memory game registry + hash router.
- All core/game scripts are loaded eagerly via classic `<script src="...">` tags (no dynamic loading by hash).
- Script order is mandatory: `core/*` first, then `games/*`, then `main.js`.
- One shared canvas on the main page. Active game owns rendering and input while running.

## Game Contract (Required)
Each game is a class/object that implements:
- `getName(): string`
  - Unique identifier used in hash and storage keys.
  - Allowed characters: `[a-z0-9_-]`.
- `getTitle(): string`
  - Human-readable title for menu display.
- `run(canvas: HTMLCanvasElement): void`
  - Starts game loop, input subscriptions, and rendering.
  - Must support repeated calls after `stop()`.
- `stop(): void`
  - Stops RAF/timers and unsubscribes listeners.
  - Must be idempotent.
  - Leaves canvas in clean/neutral state.

## Routing and Lifecycle
- Hash format: `#<gameName>`.
- On startup:
  - Empty hash: show neutral screen and game list.
  - Known hash: run matching game.
  - Unknown hash: show "Unknown game" message and keep menu usable.
- On `hashchange`:
  - `stop()` previous game.
  - `run()` next game when found.

## Persistence (localStorage)
Shared helper in `core/storage.js`:
- `storageKey(gameName, suffix)` -> `minigames:<gameName>:<suffix>`.
- `loadJSON(key, defaultValue)`.
- `saveJSON(key, value)`.

Rules:
- Each game uses its own `gameName` namespace.
- Persist JSON objects with explicit versioning: `{ version: 1, ... }`.
- Game-level schema and keys are documented in `games/<gameName>/GAME_SPEC.md`.

## Canvas Rules
Shared helper in `core/canvas_utils.js`:
- Resize canvas to parent display size.
- Apply DPR scaling (`devicePixelRatio`) so drawing coordinates remain in CSS pixels.
- Keep rendering robust across window/container resize.

## File and Script Conventions
- Classic browser scripts only (`<script src="...">`), no module syntax.
- No build tools, no TypeScript, no external dependencies.
- Keep files small and focused.
- Shared global namespace is `window.Minigames` for cross-file contracts.
- Avoid arbitrary globals outside `window.Minigames`; entry points are `main.js`, `test_tetris.html`, and `test_arkanoid.html`.
- Canvas rendering only (2D context) for games.

## How to Add a New Game
1. Create folder `games/<gameName>/`.
2. Implement game script with the required contract methods.
3. Create `games/<gameName>/GAME_SPEC.md`.
4. Add game script include to `index.html` before `main.js`.
5. Register the game instance in `main.js` registry.
6. For standalone debug page, include needed `core/*` and game script files in correct order.
7. Ensure independent storage keys via `storageKey(<gameName>, ...)`.
8. Update this `SPEC.md` if contracts/structure/conventions change.

## GAME_SPEC.md Rule
- Every game must have `games/<gameName>/GAME_SPEC.md`.
- `SPEC.md` defines global contracts and cross-project rules.
- `GAME_SPEC.md` defines game-specific behavior.
- `GAME_SPEC.md` must not violate global contracts defined here.
