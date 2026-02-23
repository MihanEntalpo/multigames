(function bootstrapPacman(global) {
  const ns = (global.Minigames = global.Minigames || {});
  const resizeCanvasToDisplaySize = ns.resizeCanvasToDisplaySize;
  const loadJSON = ns.loadJSON;
  const saveJSON = ns.saveJSON;
  const storageKey = ns.storageKey;
  const validatePacmanMaze = ns.validatePacmanMaze;

  if (!resizeCanvasToDisplaySize || !loadJSON || !saveJSON || !storageKey || !validatePacmanMaze) {
    throw new Error('Pacman dependencies are missing. Load core scripts before pacman.js.');
  }

  const MAZE_TEMPLATES = [
    [
      '###################',
      '#o.....#...#.....o#',
      '#.###.#...#...###.#',
      '#.....#.#.#.#.....#',
      '###.#.#.#.#.#.#.###',
      '#...#...#.#...#...#',
      '#.#...##  ##....#.#',
      '#.#...#GGGG#....#.#',
      '#.#...######....#.#',
      '#...#....P....#...#',
      '###.#.#.#.#.#.#.###',
      '#.....#.#.#.#.....#',
      '#.###.#.#.#.#.###.#',
      '#o...............o#',
      '###################',
    ],
    [
      '###################',
      '#o.....#...#.....o#',
      '#.###.#...#...###.#',
      '#.....#.#.#.#.....#',
      '###...#.#.#.#...###',
      '#...#...#.#...#...#',
      '#.#...##  ##....#.#',
      '#.#...#GGGG#....#.#',
      '#.#...######....#.#',
      '#...#....P....#...#',
      '###.#.#.#.#.#.#.###',
      '#.....#.#.#.#.....#',
      '#.###.#.#.#.#.###.#',
      '#o...............o#',
      '###################',
    ],
    [
      '###################',
      '#o.....#...#.....o#',
      '#.#.#.#...#...#.#.#',
      '#.....#.#.#.#.....#',
      '###.#.#.....#.#.###',
      '#...#...#.#...#...#',
      '#.#...##  ##....#.#',
      '#.#...#GGGG#....#.#',
      '#.#...######....#.#',
      '#...#....P....#...#',
      '###.#.#.....#.#.###',
      '#.....#.#.#.#.....#',
      '#.#.#.#...#...#.#.#',
      '#o...............o#',
      '###################',
    ],
    [
      '###################',
      '#o.....#...#.....o#',
      '#.###.#...#...###.#',
      '#.....#.#.#.#.....#',
      '###...#.#.#.#...###',
      '#.......#.#.......#',
      '#.#...##  ##....#.#',
      '#.#...#GGGG#....#.#',
      '#.#...######....#.#',
      '#...#....P....#...#',
      '###...#.#.#.#...###',
      '#.....#.#.#.#.....#',
      '#.###.#...#...###.#',
      '#o...............o#',
      '###################',
    ],
  ];

  const TILE_WALL = 1;
  const TILE_EMPTY = 0;

  const PLAYER_BASE_SPEED = 6.2;
  const GHOST_BASE_SPEED = 4.8;
  const GHOST_FRIGHT_SPEED = 3.2;
  const GHOST_EYES_SPEED = 6.6;
  const POWER_DURATION_SEC = 8;
  const POWER_FLASH_WINDOW_SEC = 1;
  const POWER_FLASH_INTERVAL_SEC = 0.12;

  const DEATH_HOLD_SEC = 0.18;
  const DEATH_OPEN_SEC = 0.44;
  const DEATH_INVERT_SEC = 0.42;
  const DEATH_BURST_SEC = 0.52;
  const DEATH_TOTAL_SEC = DEATH_HOLD_SEC + DEATH_OPEN_SEC + DEATH_INVERT_SEC + DEATH_BURST_SEC;

  const START_LIVES = 3;
  const SCORE_PELLET = 10;
  const SCORE_POWER = 50;
  const SCORE_GHOST = 200;

  const PROGRESS_KEY = storageKey('pacman', 'progress');
  const DEFAULT_PROGRESS = {
    version: 1,
    bestScore: 0,
    bestLevel: 1,
  };

  const GHOST_PROFILES = [
    { id: 'blinky', color: '#ff4d6d', speedFactor: 1.06 },
    { id: 'pinky', color: '#ff9fd8', speedFactor: 1.0 },
    { id: 'inky', color: '#6bd6ff', speedFactor: 0.98 },
    { id: 'clyde', color: '#ffb347', speedFactor: 0.94 },
  ];
  const GHOST_MODE_SEQUENCE = [
    { mode: 'scatter', duration: 7 },
    { mode: 'chase', duration: 20 },
    { mode: 'scatter', duration: 7 },
    { mode: 'chase', duration: 20 },
    { mode: 'scatter', duration: 5 },
    { mode: 'chase', duration: 20 },
    { mode: 'scatter', duration: 5 },
    { mode: 'chase', duration: Infinity },
  ];

  const DIR_UP = { dx: 0, dy: -1, key: 'up' };
  const DIR_DOWN = { dx: 0, dy: 1, key: 'down' };
  const DIR_LEFT = { dx: -1, dy: 0, key: 'left' };
  const DIR_RIGHT = { dx: 1, dy: 0, key: 'right' };
  const DIRECTIONS = [DIR_UP, DIR_LEFT, DIR_DOWN, DIR_RIGHT];
  const ASTAR_STEPS = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];

  const KEY_TO_DIR = {
    ArrowUp: DIR_UP,
    KeyW: DIR_UP,
    ArrowDown: DIR_DOWN,
    KeyS: DIR_DOWN,
    ArrowLeft: DIR_LEFT,
    KeyA: DIR_LEFT,
    ArrowRight: DIR_RIGHT,
    KeyD: DIR_RIGHT,
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function normalizeProgress(data) {
    if (!data || typeof data !== 'object') {
      return { ...DEFAULT_PROGRESS };
    }

    const bestScore = Number.isFinite(data.bestScore) ? Math.max(0, Math.floor(data.bestScore)) : 0;
    const bestLevel = Number.isFinite(data.bestLevel) ? Math.max(1, Math.floor(data.bestLevel)) : 1;

    return {
      version: 1,
      bestScore,
      bestLevel,
    };
  }

  function isReverse(a, b) {
    if (!a || !b) {
      return false;
    }
    return a.dx === -b.dx && a.dy === -b.dy;
  }

  function distSquared(ax, ay, bx, by) {
    const dx = ax - bx;
    const dy = ay - by;
    return dx * dx + dy * dy;
  }

  class PacmanGame {
    constructor() {
      this.canvas = null;
      this.ctx = null;
      this.viewport = { width: 1, height: 1, dpr: 1, resized: false };
      this.layout = {
        boardX: 0,
        boardY: 0,
        boardWidth: 1,
        boardHeight: 1,
        tilePx: 16,
        panelX: 0,
        panelY: 0,
        panelWidth: 1,
      };

      this.mapTemplate = MAZE_TEMPLATES[0].slice();
      this.cols = this.mapTemplate[0].length;
      this.rows = this.mapTemplate.length;

      this.walls = [];
      this.ghostDoor = [];
      this.pellets = [];
      this.pelletCount = 0;

      this.playerSpawn = { x: 1.5, y: 1.5 };
      this.ghostSpawns = [];
      this.ghostHouse = null;

      this.player = {
        x: 1.5,
        y: 1.5,
        dir: DIR_LEFT,
        nextDir: DIR_LEFT,
      };

      this.ghosts = [];

      this.state = 'ready';
      this.score = 0;
      this.level = 1;
      this.lives = START_LIVES;
      this.powerTimer = 0;

      this.progress = normalizeProgress(DEFAULT_PROGRESS);

      this.isRunning = false;
      this.animationFrameId = null;
      this.lastTimestamp = 0;
      this.playerChompDistance = 0;
      this.lastMazeTemplateIndex = -1;
      this.ghostBehaviorMode = 'scatter';
      this.ghostModePhaseIndex = 0;
      this.ghostModePhaseTimer = 0;
      this.deathTimer = 0;
      this.deathCenter = { x: 0, y: 0 };

      this.boundFrame = this.frame.bind(this);
      this.boundKeyDown = this.onKeyDown.bind(this);
      this.boundResize = this.onResize.bind(this);
    }

    getName() {
      return 'pacman';
    }

    getTitle() {
      return 'PacMan';
    }

    run(canvas) {
      if (this.isRunning) {
        this.stop();
      }

      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      if (!this.ctx) {
        throw new Error('Pacman requires CanvasRenderingContext2D.');
      }

      this.loadProgress();
      this.resetRun();

      window.addEventListener('keydown', this.boundKeyDown);
      window.addEventListener('resize', this.boundResize);

      this.onResize();
      this.isRunning = true;
      this.lastTimestamp = performance.now();
      this.animationFrameId = requestAnimationFrame(this.boundFrame);
    }

    stop() {
      if (this.animationFrameId !== null) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }

      window.removeEventListener('keydown', this.boundKeyDown);
      window.removeEventListener('resize', this.boundResize);

      this.isRunning = false;

      if (this.ctx && this.viewport) {
        this.ctx.setTransform(this.viewport.dpr || 1, 0, 0, this.viewport.dpr || 1, 0, 0);
        this.ctx.clearRect(0, 0, this.viewport.width, this.viewport.height);
      }

      this.canvas = null;
      this.ctx = null;
    }

    loadProgress() {
      this.progress = normalizeProgress(loadJSON(PROGRESS_KEY, DEFAULT_PROGRESS));
    }

    saveProgressIfNeeded() {
      let changed = false;

      if (this.score > this.progress.bestScore) {
        this.progress.bestScore = this.score;
        changed = true;
      }
      if (this.level > this.progress.bestLevel) {
        this.progress.bestLevel = this.level;
        changed = true;
      }

      if (changed) {
        saveJSON(PROGRESS_KEY, {
          version: 1,
          bestScore: this.progress.bestScore,
          bestLevel: this.progress.bestLevel,
        });
      }
    }

    createNewMaze() {
      const candidates = [];

      let lastError = 'No maze templates available.';
      for (let i = 0; i < MAZE_TEMPLATES.length; i += 1) {
        const candidate = MAZE_TEMPLATES[i];
        const check = validatePacmanMaze(candidate);
        if (check.valid) {
          candidates.push({ index: i, template: candidate });
        } else {
          lastError = `Template #${i + 1}: ${check.reason}`;
        }
      }

      if (candidates.length > 0) {
        let pick = (this.level - 1) % candidates.length;
        if (pick < 0) {
          pick = 0;
        }
        if (candidates.length > 1 && candidates[pick].index === this.lastMazeTemplateIndex) {
          pick = (pick + 1) % candidates.length;
        }

        const selected = candidates[pick];
        this.lastMazeTemplateIndex = selected.index;
        this.mapTemplate = selected.template.slice();
        this.cols = this.mapTemplate[0].length;
        this.rows = this.mapTemplate.length;
        this.setupMapTemplate();
        return;
      }

      throw new Error(`Pacman maze validation failed. ${lastError}`);
    }

    setupMapTemplate() {
      this.walls = Array.from({ length: this.rows }, () => Array(this.cols).fill(TILE_EMPTY));
      this.ghostDoor = Array.from({ length: this.rows }, () => Array(this.cols).fill(0));
      this.pellets = Array.from({ length: this.rows }, () => Array(this.cols).fill(0));
      this.ghostSpawns = [];
      this.ghostHouse = null;

      let minGhostX = Infinity;
      let maxGhostX = -Infinity;
      let minGhostY = Infinity;
      let maxGhostY = -Infinity;

      for (let y = 0; y < this.rows; y += 1) {
        for (let x = 0; x < this.cols; x += 1) {
          const ch = this.mapTemplate[y][x];

          if (ch === '#') {
            this.walls[y][x] = TILE_WALL;
            continue;
          }

          if (ch === '.') {
            this.pellets[y][x] = 1;
          } else if (ch === 'o') {
            this.pellets[y][x] = 2;
          } else if (ch === 'P') {
            this.playerSpawn = { x: x + 0.5, y: y + 0.5 };
          } else if (ch === 'G') {
            this.ghostSpawns.push({ x: x + 0.5, y: y + 0.5 });
            minGhostX = Math.min(minGhostX, x);
            maxGhostX = Math.max(maxGhostX, x);
            minGhostY = Math.min(minGhostY, y);
            maxGhostY = Math.max(maxGhostY, y);
          }
        }
      }

      if (this.ghostSpawns.length > 0 && Number.isFinite(minGhostX)) {
        const doorLeft = clamp(minGhostX + 1, minGhostX, maxGhostX);
        const doorRight = clamp(maxGhostX - 1, minGhostX, maxGhostX);
        const doorCenterX = (doorLeft + doorRight + 1) / 2;
        const doorY = minGhostY - 1;
        this.ghostHouse = {
          minX: minGhostX,
          maxX: maxGhostX,
          minY: minGhostY,
          maxY: maxGhostY,
          doorLeft,
          doorRight,
          doorCenterX,
          doorY,
        };

        if (doorY >= 0 && doorY < this.rows) {
          for (let x = doorLeft; x <= doorRight; x += 1) {
            if (x >= 0 && x < this.cols && this.walls[doorY][x] !== TILE_WALL) {
              this.ghostDoor[doorY][x] = 1;
            }
          }
        }
      }
    }

    resetPelletsFromTemplate() {
      this.pelletCount = 0;

      for (let y = 0; y < this.rows; y += 1) {
        for (let x = 0; x < this.cols; x += 1) {
          const ch = this.mapTemplate[y][x];
          if (ch === '.') {
            this.pellets[y][x] = 1;
            this.pelletCount += 1;
          } else if (ch === 'o') {
            this.pellets[y][x] = 2;
            this.pelletCount += 1;
          } else {
            this.pellets[y][x] = 0;
          }
        }
      }
    }

    resetRun() {
      this.score = 0;
      this.level = 1;
      this.lives = START_LIVES;
      this.powerTimer = 0;
      this.state = 'ready';
      this.playerChompDistance = 0;
      this.deathTimer = 0;

      this.createNewMaze();
      this.startWave(true);
      this.saveProgressIfNeeded();
    }

    startWave(resetPellets) {
      if (resetPellets) {
        this.resetPelletsFromTemplate();
      }

      this.player.x = this.playerSpawn.x;
      this.player.y = this.playerSpawn.y;
      this.player.dir = DIR_LEFT;
      this.player.nextDir = DIR_LEFT;
      this.playerChompDistance = 0;
      this.deathTimer = 0;
      this.deathCenter.x = this.playerSpawn.x;
      this.deathCenter.y = this.playerSpawn.y;

      this.ghosts = this.ghostSpawns.map((spawn, index) => {
        const profile = GHOST_PROFILES[index % GHOST_PROFILES.length];
        return {
          x: spawn.x,
          y: spawn.y,
          spawnX: spawn.x,
          spawnY: spawn.y,
          dir: DIRECTIONS[(index + 1) % DIRECTIONS.length],
          color: profile.color,
          ghostId: profile.id,
          speedFactor: profile.speedFactor,
          mode: 'normal',
        };
      });

      this.powerTimer = 0;
      this.state = 'ready';
      this.resetGhostModeCycle();
      this.saveProgressIfNeeded();
    }

    onResize() {
      if (!this.canvas || !this.ctx) {
        return;
      }

      this.viewport = resizeCanvasToDisplaySize(this.canvas, this.ctx);
      this.layout = this.computeLayout(this.viewport.width, this.viewport.height);
      this.render();
    }

    computeLayout(width, height) {
      const pad = 14;
      const side = width >= 820;

      if (side) {
        const panelWidth = Math.max(220, Math.floor(width * 0.3));
        const availableW = width - panelWidth - pad * 3;
        const availableH = height - pad * 2;
        const tilePx = Math.max(12, Math.floor(Math.min(availableW / this.cols, availableH / this.rows)));

        const boardWidth = tilePx * this.cols;
        const boardHeight = tilePx * this.rows;

        return {
          tilePx,
          boardX: pad,
          boardY: Math.max(pad, Math.floor((height - boardHeight) / 2)),
          boardWidth,
          boardHeight,
          panelX: pad + boardWidth + pad,
          panelY: pad,
          panelWidth,
        };
      }

      const panelHeight = 156;
      const availableW = width - pad * 2;
      const availableH = height - panelHeight - pad * 3;
      const tilePx = Math.max(10, Math.floor(Math.min(availableW / this.cols, availableH / this.rows)));
      const boardWidth = tilePx * this.cols;
      const boardHeight = tilePx * this.rows;

      return {
        tilePx,
        boardX: Math.floor((width - boardWidth) / 2),
        boardY: pad,
        boardWidth,
        boardHeight,
        panelX: pad,
        panelY: pad + boardHeight + pad,
        panelWidth: width - pad * 2,
      };
    }

    resetGhostModeCycle() {
      this.ghostBehaviorMode = GHOST_MODE_SEQUENCE[0].mode;
      this.ghostModePhaseIndex = 0;
      this.ghostModePhaseTimer = 0;
    }

    advanceGhostModeCycle(dt) {
      if (this.powerTimer > 0) {
        return;
      }

      let remaining = dt;
      while (remaining > 0 && this.ghostModePhaseIndex < GHOST_MODE_SEQUENCE.length) {
        const phase = GHOST_MODE_SEQUENCE[this.ghostModePhaseIndex];
        if (!Number.isFinite(phase.duration)) {
          this.ghostBehaviorMode = phase.mode;
          return;
        }

        const leftInPhase = phase.duration - this.ghostModePhaseTimer;
        if (remaining < leftInPhase) {
          this.ghostModePhaseTimer += remaining;
          this.ghostBehaviorMode = phase.mode;
          return;
        }

        remaining -= leftInPhase;
        this.ghostModePhaseIndex = Math.min(this.ghostModePhaseIndex + 1, GHOST_MODE_SEQUENCE.length - 1);
        this.ghostModePhaseTimer = 0;
        this.ghostBehaviorMode = GHOST_MODE_SEQUENCE[this.ghostModePhaseIndex].mode;
      }
    }

    isFrightenedEdible() {
      if (this.powerTimer <= 0) {
        return false;
      }
      if (this.powerTimer > POWER_FLASH_WINDOW_SEC) {
        return true;
      }

      const elapsedInFlash = POWER_FLASH_WINDOW_SEC - this.powerTimer;
      const phase = Math.floor(elapsedInFlash / POWER_FLASH_INTERVAL_SEC);
      return phase % 2 === 0;
    }

    startDeathSequence() {
      if (this.state === 'dying' || this.state === 'gameover') {
        return;
      }

      this.state = 'dying';
      this.deathTimer = 0;
      this.deathCenter.x = this.player.x;
      this.deathCenter.y = this.player.y;
      this.player.dir = DIR_UP;
      this.powerTimer = 0;
    }

    updateDying(dt) {
      this.deathTimer += dt;
      if (this.deathTimer >= DEATH_TOTAL_SEC) {
        this.completeDeathSequence();
      }
    }

    completeDeathSequence() {
      this.lives -= 1;

      if (this.lives <= 0) {
        this.lives = 0;
        this.state = 'gameover';
        this.saveProgressIfNeeded();
        return;
      }

      this.startWave(false);
    }

    frame(timestamp) {
      if (!this.isRunning) {
        return;
      }

      const dt = Math.min(0.05, (timestamp - this.lastTimestamp) / 1000);
      this.lastTimestamp = timestamp;

      if (this.state === 'playing') {
        this.update(dt);
      } else if (this.state === 'dying') {
        this.updateDying(dt);
      }

      this.render();
      this.animationFrameId = requestAnimationFrame(this.boundFrame);
    }

    update(dt) {
      if (this.powerTimer > 0) {
        this.powerTimer = Math.max(0, this.powerTimer - dt);
      }
      this.advanceGhostModeCycle(dt);

      this.updatePlayer(dt);
      this.consumePelletAtPlayer();

      const frightenedMovement = this.powerTimer > 0;
      const frightenedEdible = this.isFrightenedEdible();
      for (let i = 0; i < this.ghosts.length; i += 1) {
        this.updateGhost(this.ghosts[i], dt, frightenedMovement);
      }

      this.handlePlayerGhostCollisions(frightenedEdible);
    }

    wallAt(tx, ty) {
      if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) {
        return true;
      }
      return this.walls[ty][tx] === TILE_WALL;
    }

    doorAt(tx, ty) {
      if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) {
        return false;
      }
      return this.ghostDoor[ty][tx] === 1;
    }

    playerBlockedAt(tx, ty) {
      return this.wallAt(tx, ty) || this.doorAt(tx, ty);
    }

    isNearCenter(entity) {
      const cx = Math.floor(entity.x) + 0.5;
      const cy = Math.floor(entity.y) + 0.5;
      return Math.abs(entity.x - cx) < 0.045 && Math.abs(entity.y - cy) < 0.045;
    }

    snapToCenter(entity) {
      entity.x = Math.floor(entity.x) + 0.5;
      entity.y = Math.floor(entity.y) + 0.5;
    }

    canMoveFromCenter(cx, cy, dir, forPlayer) {
      const tx = Math.floor(cx + dir.dx);
      const ty = Math.floor(cy + dir.dy);
      return forPlayer ? !this.playerBlockedAt(tx, ty) : !this.wallAt(tx, ty);
    }

    updateAxisMovement(entity, dt, speed) {
      entity.x += entity.dir.dx * speed * dt;
      entity.y += entity.dir.dy * speed * dt;
    }

    resolveWallCollision(entity, forPlayer) {
      const tx = Math.floor(entity.x);
      const ty = Math.floor(entity.y);
      const blocked = forPlayer ? this.playerBlockedAt(tx, ty) : this.wallAt(tx, ty);
      if (blocked) {
        this.snapToCenter(entity);
      }
    }

    updatePlayer(dt) {
      const speed = PLAYER_BASE_SPEED + Math.min(2, (this.level - 1) * 0.2);
      const p = this.player;
      const prevX = p.x;
      const prevY = p.y;

      if (this.isNearCenter(p)) {
        this.snapToCenter(p);

        if (p.nextDir && this.canMoveFromCenter(p.x, p.y, p.nextDir, true)) {
          p.dir = p.nextDir;
        }

        if (!this.canMoveFromCenter(p.x, p.y, p.dir, true)) {
          p.dir = { dx: 0, dy: 0, key: 'none' };
        }
      }

      this.updateAxisMovement(p, dt, speed);
      this.resolveWallCollision(p, true);

      const moved = Math.hypot(p.x - prevX, p.y - prevY);
      this.playerChompDistance += moved;
    }

    consumePelletAtPlayer() {
      const tx = Math.floor(this.player.x);
      const ty = Math.floor(this.player.y);

      if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) {
        return;
      }

      const pellet = this.pellets[ty][tx];
      if (!pellet) {
        return;
      }

      this.pellets[ty][tx] = 0;
      this.pelletCount -= 1;

      if (pellet === 1) {
        this.score += SCORE_PELLET;
      } else {
        this.score += SCORE_POWER;
        this.powerTimer = POWER_DURATION_SEC;
      }

      this.saveProgressIfNeeded();

      if (this.pelletCount <= 0) {
        this.level += 1;
        this.createNewMaze();
        this.startWave(true);
      }
    }

    availableGhostDirs(ghost, allowReverse) {
      const cx = Math.floor(ghost.x) + 0.5;
      const cy = Math.floor(ghost.y) + 0.5;

      const dirs = [];
      for (let i = 0; i < DIRECTIONS.length; i += 1) {
        const d = DIRECTIONS[i];
        if (this.canMoveFromCenter(cx, cy, d)) {
          dirs.push(d);
        }
      }

      if (dirs.length > 1 && !allowReverse) {
        return dirs.filter((d) => !isReverse(d, ghost.dir));
      }

      return dirs;
    }

    chooseGhostDir(ghost, frightened) {
      const isEyes = ghost.mode === 'eyes';
      const dirs = this.availableGhostDirs(ghost, isEyes);
      if (dirs.length === 0) {
        return ghost.dir;
      }

      if (isEyes) {
        const startX = Math.floor(ghost.x);
        const startY = Math.floor(ghost.y);
        const targetX = Math.floor(ghost.spawnX);
        const targetY = Math.floor(ghost.spawnY);
        const path = this.findPathAStar(startX, startY, targetX, targetY);
        if (path && path.length > 1) {
          const next = path[1];
          const dir = this.directionToNeighbor(startX, startY, next.x, next.y);
          if (dir) {
            return dir;
          }
        }

        return this.chooseDirTowardsTarget(ghost, dirs, ghost.spawnX, ghost.spawnY);
      }

      const house = this.ghostHouse;
      if (house) {
        const tx = Math.floor(ghost.x);
        const ty = Math.floor(ghost.y);
        const inHouse = tx >= house.minX && tx <= house.maxX && ty >= house.minY && ty <= house.maxY;
        if (inHouse) {
          return this.chooseDirTowardsTarget(ghost, dirs, house.doorCenterX, house.doorY + 0.5);
        }

        if (ty === house.doorY && tx >= house.doorLeft && tx <= house.doorRight) {
          if (this.canMoveFromCenter(ghost.x, ghost.y, DIR_UP)) {
            return DIR_UP;
          }
        }
      }

      if (frightened) {
        const playerTile = this.getPlayerTile();
        return this.chooseDirAwayFromTarget(ghost, dirs, playerTile.x + 0.5, playerTile.y + 0.5);
      }

      const target = this.getGhostTargetTile(ghost);
      return this.chooseDirTowardsTarget(ghost, dirs, target.x + 0.5, target.y + 0.5);
    }

    getGhostById(ghostId) {
      for (let i = 0; i < this.ghosts.length; i += 1) {
        if (this.ghosts[i].ghostId === ghostId) {
          return this.ghosts[i];
        }
      }
      return null;
    }

    getPlayerTile() {
      return {
        x: Math.floor(this.player.x),
        y: Math.floor(this.player.y),
      };
    }

    getPlayerLookAheadTile(steps, applyUpLeftBug) {
      const playerTile = this.getPlayerTile();
      const dir = this.player.dir || DIR_LEFT;

      if (applyUpLeftBug && dir === DIR_UP) {
        return {
          x: playerTile.x - steps,
          y: playerTile.y - steps,
        };
      }

      return {
        x: playerTile.x + dir.dx * steps,
        y: playerTile.y + dir.dy * steps,
      };
    }

    clampTileToBoard(tile) {
      return {
        x: clamp(tile.x, 1, this.cols - 2),
        y: clamp(tile.y, 1, this.rows - 2),
      };
    }

    getScatterTargetForGhost(ghost) {
      if (ghost.ghostId === 'blinky') {
        return { x: this.cols - 2, y: 1 };
      }
      if (ghost.ghostId === 'pinky') {
        return { x: 1, y: 1 };
      }
      if (ghost.ghostId === 'inky') {
        return { x: this.cols - 2, y: this.rows - 2 };
      }
      return { x: 1, y: this.rows - 2 };
    }

    getChaseTargetForGhost(ghost) {
      const playerTile = this.getPlayerTile();

      if (ghost.ghostId === 'blinky') {
        return playerTile;
      }

      if (ghost.ghostId === 'pinky') {
        return this.getPlayerLookAheadTile(4, true);
      }

      if (ghost.ghostId === 'inky') {
        const blinky = this.getGhostById('blinky') || ghost;
        const blinkyTile = {
          x: Math.floor(blinky.x),
          y: Math.floor(blinky.y),
        };
        const ahead = this.getPlayerLookAheadTile(2, true);
        const vx = ahead.x - blinkyTile.x;
        const vy = ahead.y - blinkyTile.y;
        return {
          x: ahead.x + vx,
          y: ahead.y + vy,
        };
      }

      const ghostTile = {
        x: Math.floor(ghost.x),
        y: Math.floor(ghost.y),
      };
      const distanceToPlayer = Math.hypot(playerTile.x - ghostTile.x, playerTile.y - ghostTile.y);
      if (distanceToPlayer >= 8) {
        return playerTile;
      }
      return this.getScatterTargetForGhost(ghost);
    }

    getGhostTargetTile(ghost) {
      const rawTarget = this.ghostBehaviorMode === 'scatter'
        ? this.getScatterTargetForGhost(ghost)
        : this.getChaseTargetForGhost(ghost);
      return this.clampTileToBoard(rawTarget);
    }

    chooseDirTowardsTarget(ghost, dirs, targetX, targetY) {
      let best = dirs[0];
      let bestScore = Infinity;

      for (let i = 0; i < dirs.length; i += 1) {
        const d = dirs[i];
        const nx = Math.floor(ghost.x) + d.dx + 0.5;
        const ny = Math.floor(ghost.y) + d.dy + 0.5;
        const s = distSquared(nx, ny, targetX, targetY);
        if (s < bestScore) {
          bestScore = s;
          best = d;
        }
      }

      return best;
    }

    chooseDirAwayFromTarget(ghost, dirs, targetX, targetY) {
      let best = dirs[0];
      let bestScore = -Infinity;

      for (let i = 0; i < dirs.length; i += 1) {
        const d = dirs[i];
        const nx = Math.floor(ghost.x) + d.dx + 0.5;
        const ny = Math.floor(ghost.y) + d.dy + 0.5;
        const s = distSquared(nx, ny, targetX, targetY);
        if (s > bestScore) {
          bestScore = s;
          best = d;
        }
      }

      return best;
    }

    tileHeuristic(ax, ay, bx, by) {
      return Math.abs(ax - bx) + Math.abs(ay - by);
    }

    directionToNeighbor(fromX, fromY, toX, toY) {
      const dx = toX - fromX;
      const dy = toY - fromY;
      if (Math.abs(dx) + Math.abs(dy) !== 1) {
        return null;
      }

      if (dx === 1 && dy === 0) {
        return DIR_RIGHT;
      }
      if (dx === -1 && dy === 0) {
        return DIR_LEFT;
      }
      if (dx === 0 && dy === 1) {
        return DIR_DOWN;
      }
      if (dx === 0 && dy === -1) {
        return DIR_UP;
      }

      return null;
    }

    findPathAStar(startX, startY, targetX, targetY) {
      if (startX === targetX && startY === targetY) {
        return [{ x: startX, y: startY }];
      }
      if (this.wallAt(startX, startY) || this.wallAt(targetX, targetY)) {
        return null;
      }

      const gScore = Array.from({ length: this.rows }, () => Array(this.cols).fill(Infinity));
      const fScore = Array.from({ length: this.rows }, () => Array(this.cols).fill(Infinity));
      const cameFrom = Array.from({ length: this.rows }, () => Array(this.cols).fill(null));
      const inOpen = Array.from({ length: this.rows }, () => Array(this.cols).fill(false));

      const open = [{ x: startX, y: startY }];
      inOpen[startY][startX] = true;
      gScore[startY][startX] = 0;
      fScore[startY][startX] = this.tileHeuristic(startX, startY, targetX, targetY);

      while (open.length > 0) {
        let bestIndex = 0;
        let bestF = fScore[open[0].y][open[0].x];

        for (let i = 1; i < open.length; i += 1) {
          const node = open[i];
          const score = fScore[node.y][node.x];
          if (score < bestF) {
            bestF = score;
            bestIndex = i;
          }
        }

        const current = open.splice(bestIndex, 1)[0];
        inOpen[current.y][current.x] = false;

        if (current.x === targetX && current.y === targetY) {
          const path = [{ x: targetX, y: targetY }];
          let cx = targetX;
          let cy = targetY;

          while (cx !== startX || cy !== startY) {
            const prev = cameFrom[cy][cx];
            if (!prev) {
              return null;
            }
            path.push({ x: prev.x, y: prev.y });
            cx = prev.x;
            cy = prev.y;
          }

          path.reverse();
          return path;
        }

        for (let i = 0; i < ASTAR_STEPS.length; i += 1) {
          const step = ASTAR_STEPS[i];
          const nx = current.x + step.dx;
          const ny = current.y + step.dy;

          if (this.wallAt(nx, ny)) {
            continue;
          }

          const tentativeG = gScore[current.y][current.x] + 1;
          if (tentativeG >= gScore[ny][nx]) {
            continue;
          }

          cameFrom[ny][nx] = { x: current.x, y: current.y };
          gScore[ny][nx] = tentativeG;
          fScore[ny][nx] = tentativeG + this.tileHeuristic(nx, ny, targetX, targetY);

          if (!inOpen[ny][nx]) {
            inOpen[ny][nx] = true;
            open.push({ x: nx, y: ny });
          }
        }
      }

      return null;
    }

    updateGhost(ghost, dt, frightened) {
      const isEyes = ghost.mode === 'eyes';
      const speedBase = isEyes ? GHOST_EYES_SPEED : frightened ? GHOST_FRIGHT_SPEED : GHOST_BASE_SPEED;
      const speedLeveled = isEyes ? speedBase : speedBase + Math.min(1.8, (this.level - 1) * 0.15);
      const speed = speedLeveled * (ghost.speedFactor || 1);
      const prevX = ghost.x;
      const prevY = ghost.y;

      if (this.isNearCenter(ghost)) {
        this.snapToCenter(ghost);

        if (isEyes && distSquared(ghost.x, ghost.y, ghost.spawnX, ghost.spawnY) < 0.04 * 0.04) {
          ghost.mode = 'normal';
          ghost.dir = DIR_UP;
          return;
        }

        const next = this.chooseGhostDir(ghost, frightened);
        if (next) {
          ghost.dir = next;
        }
      }

      this.updateAxisMovement(ghost, dt, speed);

      const tx = Math.floor(ghost.x);
      const ty = Math.floor(ghost.y);
      if (this.wallAt(tx, ty)) {
        ghost.x = Math.floor(prevX) + 0.5;
        ghost.y = Math.floor(prevY) + 0.5;
        ghost.dir = this.chooseGhostDir(ghost, frightened);
      }
    }

    handlePlayerGhostCollisions(frightened) {
      for (let i = 0; i < this.ghosts.length; i += 1) {
        const g = this.ghosts[i];
        if (g.mode === 'eyes') {
          continue;
        }

        const d2 = distSquared(this.player.x, this.player.y, g.x, g.y);
        if (d2 > 0.42 * 0.42) {
          continue;
        }

        if (frightened) {
          this.score += SCORE_GHOST;
          g.mode = 'eyes';
          g.dir = DIRECTIONS[(i + 2) % DIRECTIONS.length];
          this.saveProgressIfNeeded();
        } else {
          this.startDeathSequence();
          return;
        }
      }
    }

    onKeyDown(event) {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(event.code)) {
        event.preventDefault();
      }

      if (!this.isRunning) {
        return;
      }

      if (event.code === 'KeyP') {
        if (this.state === 'playing') {
          this.state = 'paused';
        } else if (this.state === 'paused') {
          this.state = 'playing';
          this.lastTimestamp = performance.now();
        }
        return;
      }

      if (event.code === 'KeyR') {
        this.resetRun();
        return;
      }

      if (this.state === 'dying') {
        return;
      }

      if (this.state === 'ready') {
        const dir = KEY_TO_DIR[event.code];
        if (dir) {
          this.player.nextDir = dir;
        }
        if (dir || event.code === 'Space' || event.code === 'Enter') {
          this.state = 'playing';
          this.lastTimestamp = performance.now();
        }
        return;
      }

      if (this.state === 'gameover') {
        if (event.code === 'Enter') {
          this.resetRun();
        }
        return;
      }

      if (this.state !== 'playing') {
        return;
      }

      const dir = KEY_TO_DIR[event.code];
      if (dir) {
        this.player.nextDir = dir;
      }
    }

    render() {
      if (!this.ctx) {
        return;
      }

      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.viewport.width, this.viewport.height);
      ctx.fillStyle = '#060b13';
      ctx.fillRect(0, 0, this.viewport.width, this.viewport.height);

      this.drawMaze();
      this.drawHud();

      if (this.state === 'ready') {
        this.drawOverlay('READY', 'Press move key to start');
      }

      if (this.state === 'paused') {
        this.drawOverlay('PAUSED', 'Press P to continue');
      }

      if (this.state === 'gameover') {
        this.drawOverlay('GAME OVER', 'Press Enter or R to restart');
      }
    }

    drawMaze() {
      const ctx = this.ctx;
      const tile = this.layout.tilePx;

      ctx.fillStyle = '#08131f';
      ctx.fillRect(this.layout.boardX, this.layout.boardY, this.layout.boardWidth, this.layout.boardHeight);

      for (let y = 0; y < this.rows; y += 1) {
        for (let x = 0; x < this.cols; x += 1) {
          if (this.walls[y][x] !== TILE_WALL) {
            continue;
          }

          const px = this.layout.boardX + x * tile;
          const py = this.layout.boardY + y * tile;
          ctx.fillStyle = '#2246d6';
          ctx.fillRect(px + 1, py + 1, tile - 2, tile - 2);
        }
      }

      if (this.ghostHouse) {
        const py = this.layout.boardY + this.ghostHouse.doorY * tile + tile * 0.46;
        const leftPx = this.layout.boardX + this.ghostHouse.doorLeft * tile + 2;
        const widthPx = (this.ghostHouse.doorRight - this.ghostHouse.doorLeft + 1) * tile - 4;
        ctx.fillStyle = '#ffd2ee';
        ctx.fillRect(leftPx, py, widthPx, Math.max(2, Math.floor(tile * 0.1)));
      }

      for (let y = 0; y < this.rows; y += 1) {
        for (let x = 0; x < this.cols; x += 1) {
          const p = this.pellets[y][x];
          if (!p) {
            continue;
          }

          const cx = this.layout.boardX + (x + 0.5) * tile;
          const cy = this.layout.boardY + (y + 0.5) * tile;
          ctx.beginPath();
          ctx.fillStyle = '#f7f2d0';
          ctx.arc(cx, cy, p === 2 ? tile * 0.2 : tile * 0.1, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      this.drawPlayer();
      this.drawGhosts();

      ctx.strokeStyle = 'rgba(180, 208, 234, 0.28)';
      ctx.lineWidth = 2;
      ctx.strokeRect(this.layout.boardX + 1, this.layout.boardY + 1, this.layout.boardWidth - 2, this.layout.boardHeight - 2);
    }

    drawPlayer() {
      if (this.state === 'dying') {
        this.drawPlayerDeathAnimation();
        return;
      }

      const ctx = this.ctx;
      const tile = this.layout.tilePx;
      const px = this.layout.boardX + this.player.x * tile;
      const py = this.layout.boardY + this.player.y * tile;
      const radius = tile * 0.43;

      let angleBase = 0;
      if (this.player.dir === DIR_RIGHT) {
        angleBase = 0;
      } else if (this.player.dir === DIR_LEFT) {
        angleBase = Math.PI;
      } else if (this.player.dir === DIR_UP) {
        angleBase = -Math.PI / 2;
      } else if (this.player.dir === DIR_DOWN) {
        angleBase = Math.PI / 2;
      }

      const chompCycle = Math.abs(Math.sin(this.playerChompDistance * Math.PI));
      const isMoving = this.player.dir.dx !== 0 || this.player.dir.dy !== 0;
      const mouth = isMoving ? 0.06 + chompCycle * 0.34 : 0.08;

      this.drawPacmanShape(px, py, radius, angleBase, mouth, '#ffd43b');
    }

    drawPacmanShape(px, py, radius, angleBase, mouth, color) {
      const ctx = this.ctx;
      const safeMouth = clamp(mouth, 0.01, Math.PI - 0.06);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.arc(px, py, radius, angleBase + safeMouth, angleBase - safeMouth + Math.PI * 2, false);
      ctx.closePath();
      ctx.fill();
    }

    drawPlayerDeathAnimation() {
      const tile = this.layout.tilePx;
      const px = this.layout.boardX + this.deathCenter.x * tile;
      const py = this.layout.boardY + this.deathCenter.y * tile;
      const baseRadius = tile * 0.43;
      const faceUp = -Math.PI / 2;
      const t = this.deathTimer;

      if (t < DEATH_HOLD_SEC) {
        this.drawPacmanShape(px, py, baseRadius, faceUp, 0.08, '#ffd43b');
        return;
      }

      if (t < DEATH_HOLD_SEC + DEATH_OPEN_SEC) {
        const p = (t - DEATH_HOLD_SEC) / DEATH_OPEN_SEC;
        const mouth = 0.08 + p * (Math.PI - 0.14);
        this.drawPacmanShape(px, py, baseRadius, faceUp, mouth, '#ffd43b');
        return;
      }

      if (t < DEATH_HOLD_SEC + DEATH_OPEN_SEC + DEATH_INVERT_SEC) {
        const p = (t - DEATH_HOLD_SEC - DEATH_OPEN_SEC) / DEATH_INVERT_SEC;
        const radius = baseRadius * (1 - p * 0.7);

        // "Inside-out" phase: body turns dark and the remaining yellow sliver collapses.
        this.drawPacmanShape(px, py, radius, faceUp, Math.PI - 0.08, '#06111c');
        const sliverMouth = Math.PI - 0.08 - p * (Math.PI - 0.14);
        this.drawPacmanShape(px, py, radius * (1 - p * 0.25), faceUp + Math.PI, sliverMouth, '#ffd43b');
        return;
      }

      const p = clamp((t - DEATH_HOLD_SEC - DEATH_OPEN_SEC - DEATH_INVERT_SEC) / DEATH_BURST_SEC, 0, 1);
      const ctx = this.ctx;
      const coreRadius = baseRadius * (1 - p) * 0.22;
      if (coreRadius > 0.5) {
        ctx.fillStyle = '#ffd43b';
        ctx.beginPath();
        ctx.arc(px, py, coreRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      const blinkOn = Math.floor(t / 0.08) % 2 === 0;
      if (!blinkOn) {
        return;
      }

      ctx.strokeStyle = '#ffe694';
      ctx.lineCap = 'round';
      const burstBase = tile * (0.45 + p * 0.6);
      for (let i = 0; i < 3; i += 1) {
        const offsetY = (i - 1) * tile * 0.14;
        const len = burstBase * (1 - i * 0.18);
        ctx.lineWidth = Math.max(1.2, tile * (0.12 - i * 0.02));
        ctx.beginPath();
        ctx.moveTo(px - tile * 0.12, py + offsetY);
        ctx.lineTo(px - len, py + offsetY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(px + tile * 0.12, py + offsetY);
        ctx.lineTo(px + len, py + offsetY);
        ctx.stroke();
      }
    }

    drawGhosts() {
      const ctx = this.ctx;
      const tile = this.layout.tilePx;
      const frightened = this.isFrightenedEdible();

      for (let i = 0; i < this.ghosts.length; i += 1) {
        const g = this.ghosts[i];
        const x = this.layout.boardX + g.x * tile;
        const y = this.layout.boardY + g.y * tile;
        const w = tile * 0.82;
        const h = tile * 0.82;

        if (g.mode !== 'eyes') {
          ctx.fillStyle = frightened ? '#4a80ff' : g.color;

          ctx.beginPath();
          ctx.arc(x, y - h * 0.1, w * 0.5, Math.PI, 0);
          ctx.lineTo(x + w * 0.5, y + h * 0.42);
          ctx.lineTo(x + w * 0.25, y + h * 0.3);
          ctx.lineTo(x, y + h * 0.42);
          ctx.lineTo(x - w * 0.25, y + h * 0.3);
          ctx.lineTo(x - w * 0.5, y + h * 0.42);
          ctx.closePath();
          ctx.fill();
        }

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x - w * 0.16, y - h * 0.1, w * 0.12, 0, Math.PI * 2);
        ctx.arc(x + w * 0.16, y - h * 0.1, w * 0.12, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#0f1d2c';
        ctx.beginPath();
        ctx.arc(x - w * 0.16, y - h * 0.1, w * 0.06, 0, Math.PI * 2);
        ctx.arc(x + w * 0.16, y - h * 0.1, w * 0.06, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    drawHud() {
      const ctx = this.ctx;
      const x = this.layout.panelX;
      let y = this.layout.panelY + 30;

      ctx.fillStyle = '#e7f2ff';
      ctx.font = 'bold 26px "Trebuchet MS", sans-serif';
      ctx.fillText('PACMAN', x, y);

      y += 32;
      ctx.fillStyle = '#9ec0d8';
      ctx.font = '16px "Trebuchet MS", sans-serif';
      ctx.fillText(`Score: ${this.score}`, x, y);
      y += 24;
      ctx.fillText(`Best Score: ${this.progress.bestScore}`, x, y);
      y += 24;
      ctx.fillText(`Level: ${this.level}`, x, y);
      y += 24;
      ctx.fillText(`Best Level: ${this.progress.bestLevel}`, x, y);
      y += 24;
      ctx.fillText(`Lives: ${this.lives}`, x, y);
      y += 24;
      ctx.fillText(`Pellets Left: ${this.pelletCount}`, x, y);

      y += 34;
      ctx.fillStyle = '#7fa2bc';
      ctx.font = '14px "Trebuchet MS", sans-serif';
      ctx.fillText('Controls:', x, y);
      y += 20;
      ctx.fillText('Arrows / WASD - move', x, y);
      y += 20;
      ctx.fillText('P - pause, R - restart', x, y);
      y += 20;
      ctx.fillText('Enter - restart after game over', x, y);
    }

    drawOverlay(title, subtitle) {
      const ctx = this.ctx;
      ctx.fillStyle = 'rgba(2, 8, 15, 0.62)';
      ctx.fillRect(this.layout.boardX, this.layout.boardY, this.layout.boardWidth, this.layout.boardHeight);

      const cx = this.layout.boardX + this.layout.boardWidth / 2;
      const cy = this.layout.boardY + this.layout.boardHeight / 2;

      ctx.fillStyle = '#f1f7ff';
      ctx.textAlign = 'center';
      ctx.font = 'bold 34px "Trebuchet MS", sans-serif';
      ctx.fillText(title, cx, cy - 12);

      ctx.fillStyle = '#bfd4e8';
      ctx.font = '17px "Trebuchet MS", sans-serif';
      ctx.fillText(subtitle, cx, cy + 20);
      ctx.textAlign = 'left';
    }
  }

  ns.PacmanGame = PacmanGame;
})(window);
