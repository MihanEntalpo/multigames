# AGENTS Rules for This Repository

1. Always read `SPEC.md` before starting any implementation task.
2. Always read `games/<gameName>/GAME_SPEC.md` before working on a specific game.
3. If `games/<gameName>/GAME_SPEC.md` is missing, create it before implementing the game.
4. Update `SPEC.md` whenever project structure, contracts, interfaces, routing, storage approach, or technical conventions change.
5. Update the corresponding `GAME_SPEC.md` whenever game rules, controls, rendering, progression, or persistence behavior changes.
6. Use plain HTML/CSS/JavaScript only.
7. Do not add npm dependencies, build tools, frameworks, or transpilers.
8. Keep code readable and simple; avoid unnecessary abstractions.
9. All games must render through Canvas 2D context.
10. Keep game persistence isolated by game-specific localStorage keys under the common namespace format.
