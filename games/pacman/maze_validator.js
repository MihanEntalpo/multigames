(function bootstrapPacmanMazeValidator(global) {
  const ns = (global.Minigames = global.Minigames || {});

  const WALKABLE_CHARS = new Set([' ', '.', 'o', 'P', 'G']);
  const ALLOWED_CHARS = new Set(['#', ' ', '.', 'o', 'P', 'G']);

  function validatePacmanMaze(template) {
    if (!Array.isArray(template) || template.length === 0) {
      return { valid: false, reason: 'Maze template must be a non-empty array of strings.' };
    }

    const rows = template.map((row) => String(row));
    const height = rows.length;
    const width = rows[0].length;
    if (width === 0) {
      return { valid: false, reason: 'Maze template must have non-empty rows.' };
    }

    let playerCount = 0;
    let ghostCount = 0;
    let pelletCount = 0;
    let walkableCount = 0;
    let playerX = -1;
    let playerY = -1;

    for (let y = 0; y < height; y += 1) {
      const row = rows[y];
      if (row.length !== width) {
        return { valid: false, reason: 'All maze rows must have the same width.' };
      }

      for (let x = 0; x < width; x += 1) {
        const ch = row[x];
        if (!ALLOWED_CHARS.has(ch)) {
          return { valid: false, reason: `Unsupported maze character "${ch}".` };
        }

        if (WALKABLE_CHARS.has(ch)) {
          walkableCount += 1;
        }
        if (ch === '.') {
          pelletCount += 1;
        } else if (ch === 'o') {
          pelletCount += 1;
        } else if (ch === 'P') {
          playerCount += 1;
          playerX = x;
          playerY = y;
        } else if (ch === 'G') {
          ghostCount += 1;
        }
      }
    }

    // Keep maze shape controlled: closed outer frame prevents leaks/out-of-bounds movement.
    for (let x = 0; x < width; x += 1) {
      if (rows[0][x] !== '#' || rows[height - 1][x] !== '#') {
        return { valid: false, reason: 'Maze border must be fully closed with walls (#).' };
      }
    }
    for (let y = 0; y < height; y += 1) {
      if (rows[y][0] !== '#' || rows[y][width - 1] !== '#') {
        return { valid: false, reason: 'Maze border must be fully closed with walls (#).' };
      }
    }

    if (playerCount !== 1) {
      return { valid: false, reason: 'Maze must contain exactly one player spawn (P).' };
    }
    if (ghostCount < 1) {
      return { valid: false, reason: 'Maze must contain at least one ghost spawn (G).' };
    }
    if (pelletCount < 1) {
      return { valid: false, reason: 'Maze must contain at least one pellet (.) or power pellet (o).' };
    }

    const visited = Array.from({ length: height }, () => Array(width).fill(false));
    const queue = [{ x: playerX, y: playerY }];
    visited[playerY][playerX] = true;
    let reachableWalkable = 0;
    let reachablePellets = 0;

    for (let i = 0; i < queue.length; i += 1) {
      const cell = queue[i];
      const ch = rows[cell.y][cell.x];
      if (WALKABLE_CHARS.has(ch)) {
        reachableWalkable += 1;
      }
      if (ch === '.' || ch === 'o') {
        reachablePellets += 1;
      }

      const neighbors = [
        { x: cell.x + 1, y: cell.y },
        { x: cell.x - 1, y: cell.y },
        { x: cell.x, y: cell.y + 1 },
        { x: cell.x, y: cell.y - 1 },
      ];

      for (let n = 0; n < neighbors.length; n += 1) {
        const next = neighbors[n];
        if (next.x < 0 || next.y < 0 || next.x >= width || next.y >= height) {
          continue;
        }
        if (visited[next.y][next.x]) {
          continue;
        }
        if (!WALKABLE_CHARS.has(rows[next.y][next.x])) {
          continue;
        }
        visited[next.y][next.x] = true;
        queue.push(next);
      }
    }

    if (reachableWalkable !== walkableCount) {
      return {
        valid: false,
        reason: `Maze has unreachable walkable cells (${walkableCount - reachableWalkable}).`,
      };
    }

    if (reachablePellets !== pelletCount) {
      return {
        valid: false,
        reason: `Maze has unreachable pellets (${pelletCount - reachablePellets}).`,
      };
    }

    return {
      valid: true,
      width,
      height,
      walkableCount,
      pelletCount,
    };
  }

  ns.validatePacmanMaze = validatePacmanMaze;
})(window);
