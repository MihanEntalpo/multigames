(function bootstrapXonix(global) {
  const ns = (global.Minigames = global.Minigames || {});
  const resizeCanvasToDisplaySize = ns.resizeCanvasToDisplaySize;
  const loadJSON = ns.loadJSON;
  const saveJSON = ns.saveJSON;
  const storageKey = ns.storageKey;

  if (!resizeCanvasToDisplaySize || !loadJSON || !saveJSON || !storageKey) {
    throw new Error('Xonix dependencies are missing. Load core scripts before xonix.js.');
  }

  const HERO_SIZE = 7;
  const ENEMY_SIZE = 7;
  const HERO_SPEED = 28;
  const CELL_SIZE = 8;

  const SEA_COLOR = '#061a3a';
  const SHORE_COLOR = '#000000';
  const TRAIL_COLOR = '#ffd100';
  const HERO_COLOR = '#ffd100';
  const SEA_ENEMY_COLOR = '#ff2a2a';
  const LAND_ENEMY_COLOR = '#ff69ff';

  const SEA = 0;
  const LAND = 1;
  const SHORE = 2;
  const TRAIL = 3;

  const DIRS = {
    up: { dx: 0, dy: -1 },
    down: { dx: 0, dy: 1 },
    left: { dx: -1, dy: 0 },
    right: { dx: 1, dy: 0 },
  };

  const KEY_TO_DIR = new Map([
    ['ArrowUp', 'up'],
    ['KeyW', 'up'],
    ['ArrowDown', 'down'],
    ['KeyS', 'down'],
    ['ArrowLeft', 'left'],
    ['KeyA', 'left'],
    ['ArrowRight', 'right'],
    ['KeyD', 'right'],
  ]);

  const PROGRESS_KEY = storageKey('xonix', 'progress');
  const DEFAULT_PROGRESS = {
    version: 1,
    bestScore: 0,
    bestCapturePercent: 0,
  };

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function makeRng(seed) {
    let s = (seed >>> 0) || 1;
    return () => {
      s = (1664525 * s + 1013904223) >>> 0;
      return s / 0x100000000;
    };
  }

  function normalizeProgress(data) {
    if (!data || typeof data !== 'object') {
      return { ...DEFAULT_PROGRESS };
    }

    const bestScore = Number.isFinite(data.bestScore) ? Math.max(0, Math.floor(data.bestScore)) : 0;
    const bestCapturePercent = Number.isFinite(data.bestCapturePercent)
      ? clamp(data.bestCapturePercent, 0, 100)
      : 0;

    return {
      version: 1,
      bestScore,
      bestCapturePercent,
    };
  }

  class XonixGame {
    constructor() {
      this.canvas = null;
      this.ctx = null;
      this.viewport = { width: 1, height: 1, dpr: 1, resized: false };

      this.layout = {
        fieldX: 0,
        fieldY: 0,
        fieldW: 1,
        fieldH: 1,
        panelX: 0,
        panelY: 0,
        panelW: 1,
      };

      this.cols = 0;
      this.rows = 0;
      this.grid = null;
      this.mark = null;
      this.bg = null;

      this.isRunning = false;
      this.animationFrameId = null;
      this.lastTs = 0;
      this.lastHeldDir = null;
      this.keys = new Set();

      this.progress = normalizeProgress(DEFAULT_PROGRESS);

      this.game = {
        state: 'playing',
        lives: 3,
        level: 1,
        goalPct: 60,
        capturedPct: 0,
        score: 0,

        hero: {
          gx: 1,
          gy: 0,
          dir: null,
          pendingTurn: null,
          mode: 'land',
          acc: 0,
          trail: [],
          trailPath: [],
          spawn: { gx: 1, gy: 0 },
        },

        seaEnemies: [],
        landEnemies: [],
      };

      this.boundFrame = this.frame.bind(this);
      this.boundResize = this.onResize.bind(this);
      this.boundKeyDown = this.onKeyDown.bind(this);
      this.boundKeyUp = this.onKeyUp.bind(this);
      this.boundCanvasClick = this.onCanvasClick.bind(this);
    }

    getName() {
      return 'xonix';
    }

    getTitle() {
      return 'Xonix';
    }

    run(canvas) {
      if (this.isRunning) {
        this.stop();
      }

      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      if (!this.ctx) {
        throw new Error('Xonix requires CanvasRenderingContext2D.');
      }
      this.ctx.imageSmoothingEnabled = false;

      this.loadProgress();
      this.onResize();

      window.addEventListener('resize', this.boundResize);
      window.addEventListener('keydown', this.boundKeyDown);
      window.addEventListener('keyup', this.boundKeyUp);
      this.canvas.addEventListener('click', this.boundCanvasClick);

      this.isRunning = true;
      this.lastTs = performance.now();
      this.animationFrameId = requestAnimationFrame(this.boundFrame);
    }

    stop() {
      if (this.animationFrameId !== null) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }

      window.removeEventListener('resize', this.boundResize);
      window.removeEventListener('keydown', this.boundKeyDown);
      window.removeEventListener('keyup', this.boundKeyUp);
      if (this.canvas) {
        this.canvas.removeEventListener('click', this.boundCanvasClick);
      }

      this.isRunning = false;
      this.keys.clear();
      this.lastHeldDir = null;

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

      if (this.game.score > this.progress.bestScore) {
        this.progress.bestScore = this.game.score;
        changed = true;
      }
      if (this.game.capturedPct > this.progress.bestCapturePercent) {
        this.progress.bestCapturePercent = this.game.capturedPct;
        changed = true;
      }

      if (changed) {
        saveJSON(PROGRESS_KEY, {
          version: 1,
          bestScore: this.progress.bestScore,
          bestCapturePercent: this.progress.bestCapturePercent,
        });
      }
    }

    computeLayout(width, height) {
      const pad = 14;
      const side = width >= 860;

      if (side) {
        const panelW = Math.max(220, Math.floor(width * 0.28));
        const fieldW = Math.max(220, width - panelW - pad * 3);
        const fieldH = Math.max(180, height - pad * 2);

        return {
          fieldX: pad,
          fieldY: pad,
          fieldW,
          fieldH,
          panelX: pad + fieldW + pad,
          panelY: pad,
          panelW,
        };
      }

      const panelH = 130;
      const fieldW = Math.max(220, width - pad * 2);
      const fieldH = Math.max(180, height - panelH - pad * 3);

      return {
        fieldX: pad,
        fieldY: pad,
        fieldW,
        fieldH,
        panelX: pad,
        panelY: pad + fieldH + pad,
        panelW: width - pad * 2,
      };
    }

    onResize() {
      if (!this.canvas || !this.ctx) {
        return;
      }

      this.viewport = resizeCanvasToDisplaySize(this.canvas, this.ctx);
      this.layout = this.computeLayout(this.viewport.width, this.viewport.height);

      const nextCols = Math.max(20, Math.floor(this.layout.fieldW / CELL_SIZE));
      const nextRows = Math.max(18, Math.floor(this.layout.fieldH / CELL_SIZE));

      if (nextCols !== this.cols || nextRows !== this.rows || !this.grid) {
        this.cols = nextCols;
        this.rows = nextRows;
        this.startNewGame();
      }

      this.render();
    }

    idx(x, y) {
      return y * this.cols + x;
    }

    inBounds(x, y) {
      return x >= 0 && y >= 0 && x < this.cols && y < this.rows;
    }

    cell(x, y) {
      return this.grid[this.idx(x, y)];
    }

    setCell(x, y, value) {
      this.grid[this.idx(x, y)] = value;
    }

    isLandType(cellType) {
      return cellType === LAND || cellType === SHORE;
    }

    rebuildGrid() {
      this.grid = new Int8Array(this.cols * this.rows);
      this.mark = new Uint8Array(this.cols * this.rows);

      for (let y = 0; y < this.rows; y += 1) {
        for (let x = 0; x < this.cols; x += 1) {
          const border = x === 0 || y === 0 || x === this.cols - 1 || y === this.rows - 1;
          this.grid[this.idx(x, y)] = border ? SHORE : SEA;
        }
      }
    }

    buildBackground(level) {
      const off = document.createElement('canvas');
      off.width = Math.max(1, this.cols * CELL_SIZE);
      off.height = Math.max(1, this.rows * CELL_SIZE);

      const g = off.getContext('2d');
      g.imageSmoothingEnabled = false;

      const lg = g.createLinearGradient(0, 0, off.width, off.height);
      lg.addColorStop(0, '#2ff3c9');
      lg.addColorStop(0.35, '#5a7dff');
      lg.addColorStop(0.7, '#ff6ad5');
      lg.addColorStop(1, '#ffd166');
      g.fillStyle = lg;
      g.fillRect(0, 0, off.width, off.height);

      const rnd = makeRng(0xc0ffee ^ (level * 2654435761));
      for (let i = 0; i < 56; i += 1) {
        const x = rnd() * off.width;
        const y = rnd() * off.height;
        const r = 20 + rnd() * 120;
        g.globalAlpha = 0.1 + rnd() * 0.1;
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fillStyle = `hsl(${Math.floor(rnd() * 360)}, 90%, 60%)`;
        g.fill();
      }
      g.globalAlpha = 1;

      this.bg = off;
    }

    goalForLevel(level) {
      const value = 60 + 40 * (1 - Math.pow(0.85, level - 1));
      return Math.min(99.5, value);
    }

    countCapturedPct() {
      const total = Math.max(1, (this.cols - 2) * (this.rows - 2));
      let land = 0;

      for (let y = 1; y < this.rows - 1; y += 1) {
        for (let x = 1; x < this.cols - 1; x += 1) {
          if (this.grid[this.idx(x, y)] === LAND) {
            land += 1;
          }
        }
      }

      return (land / total) * 100;
    }

    heroPixelRect() {
      return {
        x: this.game.hero.gx * CELL_SIZE,
        y: this.game.hero.gy * CELL_SIZE,
        w: HERO_SIZE,
        h: HERO_SIZE,
      };
    }

    enemyCellRect(enemy) {
      return { x: enemy.x, y: enemy.y, w: ENEMY_SIZE, h: ENEMY_SIZE };
    }

    aabbOverlap(a, b) {
      return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }

    rectHitsCells(rect, predicate) {
      const x0 = clamp(Math.floor(rect.x / CELL_SIZE), 0, this.cols - 1);
      const y0 = clamp(Math.floor(rect.y / CELL_SIZE), 0, this.rows - 1);
      const x1 = clamp(Math.floor((rect.x + rect.w - 1) / CELL_SIZE), 0, this.cols - 1);
      const y1 = clamp(Math.floor((rect.y + rect.h - 1) / CELL_SIZE), 0, this.rows - 1);

      for (let y = y0; y <= y1; y += 1) {
        for (let x = x0; x <= x1; x += 1) {
          if (predicate(this.grid[this.idx(x, y)], x, y)) {
            return true;
          }
        }
      }

      return false;
    }

    randomCellMatching(predicate, rng, tries) {
      const maxTries = tries || 2000;

      for (let i = 0; i < maxTries; i += 1) {
        const x = 1 + Math.floor(rng() * (this.cols - 2));
        const y = 1 + Math.floor(rng() * (this.rows - 2));
        if (predicate(x, y)) {
          return { x, y };
        }
      }

      for (let y = 1; y < this.rows - 1; y += 1) {
        for (let x = 1; x < this.cols - 1; x += 1) {
          if (predicate(x, y)) {
            return { x, y };
          }
        }
      }

      return { x: 1, y: 1 };
    }

    spawnSeaEnemy(rng, speed) {
      const p = this.randomCellMatching((x, y) => this.cell(x, y) === SEA, rng);
      const sign = () => (rng() < 0.5 ? -1 : 1);

      return {
        x: p.x * CELL_SIZE + 0.5,
        y: p.y * CELL_SIZE + 0.5,
        vx: sign() * speed,
        vy: sign() * speed,
        kind: 'sea',
      };
    }

    spawnLandEnemy(rng, speed) {
      const p = this.randomCellMatching((x, y) => this.isLandType(this.cell(x, y)), rng);
      const sign = () => (rng() < 0.5 ? -1 : 1);

      return {
        x: p.x * CELL_SIZE + 0.5,
        y: p.y * CELL_SIZE + 0.5,
        vx: sign() * speed,
        vy: sign() * speed,
        kind: 'land',
      };
    }

    clearTrail() {
      const h = this.game.hero;

      for (let i = 0; i < h.trail.length; i += 1) {
        const p = h.trail[i];
        if (this.inBounds(p[0], p[1]) && this.grid[this.idx(p[0], p[1])] === TRAIL) {
          this.grid[this.idx(p[0], p[1])] = SEA;
        }
      }

      h.trail.length = 0;
      h.trailPath.length = 0;
    }

    resetHeroToSpawn() {
      const h = this.game.hero;
      h.gx = h.spawn.gx;
      h.gy = h.spawn.gy;
      h.dir = null;
      h.pendingTurn = null;
      h.mode = 'land';
      h.acc = 0;
      this.clearTrail();
    }

    killHero() {
      if (this.game.state !== 'playing') {
        return;
      }

      this.game.lives -= 1;
      this.clearTrail();

      if (this.game.lives <= 0) {
        this.game.state = 'gameover';
        return;
      }

      const rng = makeRng((this.game.level * 1234567) ^ (this.game.lives * 891011));
      const seaSpeed = 70 + (this.game.level - 1) * 10;
      const landSpeed = 60 + Math.max(0, this.game.level - 5) * 8;

      for (let i = 0; i < this.game.seaEnemies.length; i += 1) {
        const e = this.game.seaEnemies[i];
        const p = this.randomCellMatching((x, y) => this.cell(x, y) === SEA, rng);
        e.x = p.x * CELL_SIZE + 0.5;
        e.y = p.y * CELL_SIZE + 0.5;
        e.vx = (rng() < 0.5 ? -1 : 1) * seaSpeed;
        e.vy = (rng() < 0.5 ? -1 : 1) * seaSpeed;
      }

      for (let i = 0; i < this.game.landEnemies.length; i += 1) {
        const e = this.game.landEnemies[i];
        const p = this.randomCellMatching((x, y) => this.isLandType(this.cell(x, y)), rng);
        e.x = p.x * CELL_SIZE + 0.5;
        e.y = p.y * CELL_SIZE + 0.5;
        e.vx = (rng() < 0.5 ? -1 : 1) * landSpeed;
        e.vy = (rng() < 0.5 ? -1 : 1) * landSpeed;
      }

      this.resetHeroToSpawn();
    }

    fillCapturedAreaStandardXonix() {
      const h = this.game.hero;

      for (let i = 0; i < h.trail.length; i += 1) {
        const p = h.trail[i];
        if (this.inBounds(p[0], p[1])) {
          this.grid[this.idx(p[0], p[1])] = LAND;
        }
      }

      this.mark.fill(0);
      const qx = new Int32Array(this.cols * this.rows);
      const qy = new Int32Array(this.cols * this.rows);
      let qh = 0;
      let qt = 0;

      const push = (x, y) => {
        const i = this.idx(x, y);
        if (this.mark[i]) {
          return;
        }
        this.mark[i] = 1;
        qx[qt] = x;
        qy[qt] = y;
        qt += 1;
      };

      for (let i = 0; i < this.game.seaEnemies.length; i += 1) {
        const e = this.game.seaEnemies[i];
        const cx = clamp(Math.floor((e.x + ENEMY_SIZE * 0.5) / CELL_SIZE), 1, this.cols - 2);
        const cy = clamp(Math.floor((e.y + ENEMY_SIZE * 0.5) / CELL_SIZE), 1, this.rows - 2);
        if (this.grid[this.idx(cx, cy)] === SEA) {
          push(cx, cy);
        }
      }

      if (qt === 0) {
        for (let y = 1; y < this.rows - 1 && qt === 0; y += 1) {
          for (let x = 1; x < this.cols - 1 && qt === 0; x += 1) {
            if (this.grid[this.idx(x, y)] === SEA) {
              push(x, y);
            }
          }
        }
      }

      while (qh < qt) {
        const x = qx[qh];
        const y = qy[qh];
        qh += 1;

        const neighbors = [
          [x + 1, y],
          [x - 1, y],
          [x, y + 1],
          [x, y - 1],
        ];

        for (let k = 0; k < neighbors.length; k += 1) {
          const nx = neighbors[k][0];
          const ny = neighbors[k][1];

          if (nx <= 0 || ny <= 0 || nx >= this.cols - 1 || ny >= this.rows - 1) {
            continue;
          }

          const ii = this.idx(nx, ny);
          if (this.mark[ii] || this.grid[ii] !== SEA) {
            continue;
          }

          this.mark[ii] = 1;
          qx[qt] = nx;
          qy[qt] = ny;
          qt += 1;
        }
      }

      for (let y = 1; y < this.rows - 1; y += 1) {
        for (let x = 1; x < this.cols - 1; x += 1) {
          const i = this.idx(x, y);
          if (this.grid[i] === SEA && !this.mark[i]) {
            this.grid[i] = LAND;
          }
        }
      }

      h.trail.length = 0;
      h.trailPath.length = 0;

      this.game.capturedPct = this.countCapturedPct();
    }

    closeTrailAndMaybeAdvance() {
      const before = this.game.capturedPct;
      this.fillCapturedAreaStandardXonix();
      const gained = Math.max(0, this.game.capturedPct - before);

      if (gained > 0) {
        this.game.score += Math.round(gained * 12) + this.game.level * 3;
      }

      if (this.game.capturedPct + 1e-9 >= this.game.goalPct) {
        this.game.score += this.game.level * 200;
        this.game.state = 'levelclear';
      }

      this.saveProgressIfNeeded();
    }

    startLevel(level) {
      this.game.level = level;
      this.game.goalPct = this.goalForLevel(level);
      this.game.state = 'playing';

      this.rebuildGrid();
      this.buildBackground(level);

      this.game.hero.spawn.gx = 1;
      this.game.hero.spawn.gy = 0;
      this.resetHeroToSpawn();

      const rng = makeRng(0xbadc0de ^ (level * 1013));
      const seaCount = 2 + (level - 1);
      const seaSpeed = 70 + (level - 1) * 10;

      this.game.seaEnemies = [];
      for (let i = 0; i < seaCount; i += 1) {
        this.game.seaEnemies.push(this.spawnSeaEnemy(rng, seaSpeed));
      }

      const landCount = Math.max(0, level - 4);
      const landSpeed = 60 + Math.max(0, level - 5) * 8;
      this.game.landEnemies = [];
      for (let i = 0; i < landCount; i += 1) {
        this.game.landEnemies.push(this.spawnLandEnemy(rng, landSpeed));
      }

      this.game.capturedPct = this.countCapturedPct();
      this.saveProgressIfNeeded();
    }

    startNewGame() {
      this.game.lives = 3;
      this.game.score = 0;
      this.startLevel(1);
    }

    onKeyDown(event) {
      const code = event.code;

      if (KEY_TO_DIR.has(code) || code === 'Space') {
        event.preventDefault();
      }

      if (!this.isRunning) {
        return;
      }

      if (code === 'KeyP' && !event.repeat) {
        if (this.game.state === 'playing') {
          this.game.state = 'paused';
        } else if (this.game.state === 'paused') {
          this.game.state = 'playing';
          this.lastTs = performance.now();
        }
        return;
      }

      if (code === 'KeyR' && !event.repeat) {
        this.startNewGame();
        return;
      }

      if (code === 'Enter' && this.game.state === 'gameover') {
        this.startNewGame();
        return;
      }

      if ((code === 'Space' || code === 'Enter' || code === 'KeyN') && this.game.state === 'levelclear') {
        this.startLevel(this.game.level + 1);
        return;
      }

      if (this.game.state !== 'playing') {
        return;
      }

      this.keys.add(code);

      const dirName = KEY_TO_DIR.get(code);
      if (!dirName) {
        return;
      }

      this.lastHeldDir = dirName;

      const h = this.game.hero;
      if (h.mode === 'sea' && h.dir) {
        const nd = DIRS[dirName];
        if (nd.dx === -h.dir.dx && nd.dy === -h.dir.dy) {
          return;
        }
        if (nd.dx === 0 && h.dir.dx !== 0) {
          h.pendingTurn = nd;
        }
        if (nd.dy === 0 && h.dir.dy !== 0) {
          h.pendingTurn = nd;
        }
      }
    }

    onKeyUp(event) {
      this.keys.delete(event.code);

      if (!this.lastHeldDir) {
        return;
      }

      let still = false;
      for (const key of this.keys) {
        if (KEY_TO_DIR.get(key) === this.lastHeldDir) {
          still = true;
          break;
        }
      }

      if (still) {
        return;
      }

      let picked = null;
      const order = [
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
        'KeyW',
        'KeyS',
        'KeyA',
        'KeyD',
      ];

      for (let i = 0; i < order.length; i += 1) {
        if (this.keys.has(order[i])) {
          picked = KEY_TO_DIR.get(order[i]);
          break;
        }
      }

      this.lastHeldDir = picked;
    }

    onCanvasClick() {
      if (this.game.state === 'levelclear') {
        this.startLevel(this.game.level + 1);
      }
    }

    heldDirObject() {
      if (!this.lastHeldDir) {
        return null;
      }

      let ok = false;
      for (const key of this.keys) {
        if (KEY_TO_DIR.get(key) === this.lastHeldDir) {
          ok = true;
          break;
        }
      }

      if (!ok) {
        return null;
      }

      return DIRS[this.lastHeldDir];
    }

    stepHero(dt) {
      const h = this.game.hero;
      const stepT = 1 / HERO_SPEED;

      if (h.mode === 'land') {
        const d = this.heldDirObject();
        if (!d) {
          return;
        }

        h.acc += dt;
        while (h.acc >= stepT) {
          h.acc -= stepT;

          const nx = h.gx + d.dx;
          const ny = h.gy + d.dy;
          if (!this.inBounds(nx, ny)) {
            break;
          }

          const t = this.cell(nx, ny);

          if (this.isLandType(t)) {
            h.gx = nx;
            h.gy = ny;
            continue;
          }

          if (t === SEA) {
            h.mode = 'sea';
            h.dir = d;
            h.pendingTurn = null;

            h.trailPath.length = 0;
            h.trail.length = 0;
            h.trailPath.push([h.gx, h.gy]);

            h.gx = nx;
            h.gy = ny;
            if (this.cell(h.gx, h.gy) !== SEA) {
              this.killHero();
              return;
            }
            this.setCell(h.gx, h.gy, TRAIL);
            h.trail.push([h.gx, h.gy]);
            h.trailPath.push([h.gx, h.gy]);
            continue;
          }

          break;
        }
        return;
      }

      h.acc += dt;
      while (h.acc >= stepT) {
        h.acc -= stepT;

        if (h.pendingTurn) {
          h.dir = h.pendingTurn;
          h.pendingTurn = null;
        }

        const nx = h.gx + h.dir.dx;
        const ny = h.gy + h.dir.dy;

        if (!this.inBounds(nx, ny)) {
          this.killHero();
          return;
        }

        const t = this.cell(nx, ny);

        if (t === TRAIL) {
          this.killHero();
          return;
        }

        if (t === SEA) {
          h.gx = nx;
          h.gy = ny;
          this.setCell(nx, ny, TRAIL);
          h.trail.push([nx, ny]);
          h.trailPath.push([nx, ny]);
          continue;
        }

        if (this.isLandType(t)) {
          h.gx = nx;
          h.gy = ny;
          h.mode = 'land';
          h.dir = null;
          h.pendingTurn = null;
          h.acc = 0;
          this.closeTrailAndMaybeAdvance();
          return;
        }

        this.killHero();
        return;
      }
    }

    updateEnemy(enemy, dt) {
      const rectAt = (x, y) => ({ x, y, w: ENEMY_SIZE, h: ENEMY_SIZE });

      const obstaclePredicate = (t) => {
        if (enemy.kind === 'sea') {
          return t === LAND || t === SHORE;
        }
        return t === SEA || t === TRAIL;
      };

      let nx = enemy.x + enemy.vx * dt;
      let ny = enemy.y;

      if (this.rectHitsCells(rectAt(nx, ny), obstaclePredicate)) {
        enemy.vx = -enemy.vx;
        nx = enemy.x + enemy.vx * dt;
        if (this.rectHitsCells(rectAt(nx, ny), obstaclePredicate)) {
          nx = enemy.x;
        }
      }
      enemy.x = nx;

      nx = enemy.x;
      ny = enemy.y + enemy.vy * dt;

      if (this.rectHitsCells(rectAt(nx, ny), obstaclePredicate)) {
        enemy.vy = -enemy.vy;
        ny = enemy.y + enemy.vy * dt;
        if (this.rectHitsCells(rectAt(nx, ny), obstaclePredicate)) {
          ny = enemy.y;
        }
      }
      enemy.y = ny;

      enemy.x = clamp(enemy.x, 0, this.cols * CELL_SIZE - ENEMY_SIZE);
      enemy.y = clamp(enemy.y, 0, this.rows * CELL_SIZE - ENEMY_SIZE);
    }

    stepEnemies(dt) {
      const h = this.game.hero;
      const heroRect = this.heroPixelRect();

      for (let i = 0; i < this.game.seaEnemies.length; i += 1) {
        const e = this.game.seaEnemies[i];
        this.updateEnemy(e, dt);

        const er = this.enemyCellRect(e);

        if (this.rectHitsCells(er, (t) => t === TRAIL)) {
          this.killHero();
          return;
        }

        if (h.mode === 'sea' && this.aabbOverlap(heroRect, er)) {
          this.killHero();
          return;
        }
      }

      for (let i = 0; i < this.game.landEnemies.length; i += 1) {
        const e = this.game.landEnemies[i];
        this.updateEnemy(e, dt);

        const er = this.enemyCellRect(e);

        if (this.aabbOverlap(heroRect, er)) {
          this.killHero();
          return;
        }
      }
    }

    frame(ts) {
      if (!this.isRunning) {
        return;
      }

      const dt = Math.min(0.05, (ts - this.lastTs) / 1000);
      this.lastTs = ts;

      if (this.game.state === 'playing') {
        this.stepHero(dt);
        this.stepEnemies(dt);
      }

      this.render();
      this.animationFrameId = requestAnimationFrame(this.boundFrame);
    }

    drawShore() {
      const ctx = this.ctx;
      ctx.fillStyle = SHORE_COLOR;

      for (let y = 0; y < this.rows; y += 1) {
        let x = 0;
        while (x < this.cols) {
          while (x < this.cols && this.grid[this.idx(x, y)] !== SHORE) {
            x += 1;
          }
          if (x >= this.cols) {
            break;
          }

          const x0 = x;
          while (x < this.cols && this.grid[this.idx(x, y)] === SHORE) {
            x += 1;
          }
          ctx.fillRect(x0 * CELL_SIZE, y * CELL_SIZE, (x - x0) * CELL_SIZE, CELL_SIZE);
        }
      }
    }

    renderField() {
      const ctx = this.ctx;
      const fw = this.cols * CELL_SIZE;
      const fh = this.rows * CELL_SIZE;

      if (this.game.state === 'levelclear') {
        if (this.bg) {
          ctx.drawImage(this.bg, 0, 0, fw, fh);
        } else {
          ctx.fillStyle = '#222';
          ctx.fillRect(0, 0, fw, fh);
        }

        this.drawShore();

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.font = 'bold 22px "Trebuchet MS", sans-serif';
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(0,0,0,0.85)';
        ctx.fillStyle = '#ffffff';
        ctx.strokeText('Level cleared', fw / 2, fh - 36);
        ctx.fillText('Level cleared', fw / 2, fh - 36);

        ctx.font = '14px "Trebuchet MS", sans-serif';
        ctx.lineWidth = 3;
        ctx.strokeText('Press Space / Enter or click to continue', fw / 2, fh - 14);
        ctx.fillText('Press Space / Enter or click to continue', fw / 2, fh - 14);
        ctx.restore();
        return;
      }

      ctx.fillStyle = SEA_COLOR;
      ctx.fillRect(0, 0, fw, fh);

      if (this.bg) {
        for (let y = 0; y < this.rows; y += 1) {
          let x = 0;
          while (x < this.cols) {
            while (x < this.cols && this.grid[this.idx(x, y)] !== LAND) {
              x += 1;
            }
            if (x >= this.cols) {
              break;
            }

            const x0 = x;
            while (x < this.cols && this.grid[this.idx(x, y)] === LAND) {
              x += 1;
            }

            const w = (x - x0) * CELL_SIZE;
            const px = x0 * CELL_SIZE;
            const py = y * CELL_SIZE;
            ctx.drawImage(this.bg, px, py, w, CELL_SIZE, px, py, w, CELL_SIZE);
          }
        }
      }

      this.drawShore();

      const h = this.game.hero;
      if (h.trailPath.length >= 2) {
        ctx.save();
        ctx.strokeStyle = TRAIL_COLOR;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < h.trailPath.length; i += 1) {
          const p = h.trailPath[i];
          const cx = p[0] * CELL_SIZE + CELL_SIZE / 2;
          const cy = p[1] * CELL_SIZE + CELL_SIZE / 2;
          if (i === 0) {
            ctx.moveTo(cx, cy);
          } else {
            ctx.lineTo(cx, cy);
          }
        }
        ctx.stroke();
        ctx.restore();
      }

      for (let i = 0; i < this.game.seaEnemies.length; i += 1) {
        const e = this.game.seaEnemies[i];
        ctx.fillStyle = SEA_ENEMY_COLOR;
        ctx.fillRect(Math.floor(e.x), Math.floor(e.y), ENEMY_SIZE, ENEMY_SIZE);
      }

      for (let i = 0; i < this.game.landEnemies.length; i += 1) {
        const e = this.game.landEnemies[i];
        ctx.fillStyle = LAND_ENEMY_COLOR;
        ctx.fillRect(Math.floor(e.x), Math.floor(e.y), ENEMY_SIZE, ENEMY_SIZE);
      }

      const hr = this.heroPixelRect();
      ctx.fillStyle = HERO_COLOR;
      ctx.fillRect(hr.x, hr.y, HERO_SIZE, HERO_SIZE);

      if (this.game.state === 'gameover' || this.game.state === 'paused') {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(0, 0, fw, fh);
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.font = 'bold 28px "Trebuchet MS", sans-serif';
        if (this.game.state === 'gameover') {
          ctx.fillText('GAME OVER', fw / 2, fh / 2 - 18);
          ctx.font = '14px "Trebuchet MS", sans-serif';
          ctx.fillText('Press Enter or R to restart', fw / 2, fh / 2 + 14);
        } else {
          ctx.fillText('PAUSED', fw / 2, fh / 2 - 18);
          ctx.font = '14px "Trebuchet MS", sans-serif';
          ctx.fillText('Press P to continue', fw / 2, fh / 2 + 14);
        }
        ctx.restore();
      }
    }

    renderHud() {
      const ctx = this.ctx;
      const panelX = this.layout.panelX;
      let y = this.layout.panelY + 30;

      ctx.fillStyle = '#e8f3ff';
      ctx.font = 'bold 27px "Trebuchet MS", sans-serif';
      ctx.fillText('XONIX', panelX, y);

      y += 30;
      ctx.fillStyle = '#9ec2de';
      ctx.font = '16px "Trebuchet MS", sans-serif';
      ctx.fillText(`Level: ${this.game.level}`, panelX, y);
      y += 24;
      ctx.fillText(`Lives: ${this.game.lives}`, panelX, y);
      y += 24;
      ctx.fillText(`Score: ${this.game.score}`, panelX, y);
      y += 24;
      ctx.fillText(`Best score: ${this.progress.bestScore}`, panelX, y);
      y += 24;
      ctx.fillText(`Captured: ${this.game.capturedPct.toFixed(1)}%`, panelX, y);
      y += 24;
      ctx.fillText(`Best capture: ${this.progress.bestCapturePercent.toFixed(1)}%`, panelX, y);
      y += 24;
      ctx.fillText(`Goal: ${this.game.goalPct.toFixed(1)}%`, panelX, y);
      y += 24;
      ctx.fillText(`Mode: ${this.game.hero.mode === 'sea' ? 'SEA' : 'LAND'}`, panelX, y);
      y += 24;
      ctx.fillText(`Sea enemies: ${this.game.seaEnemies.length}`, panelX, y);
      y += 24;
      ctx.fillText(`Land enemies: ${this.game.landEnemies.length}`, panelX, y);

      y += 30;
      ctx.fillStyle = '#7fa4bf';
      ctx.font = '14px "Trebuchet MS", sans-serif';
      ctx.fillText('Controls:', panelX, y);
      y += 20;
      ctx.fillText('Arrows / WASD - move', panelX, y);
      y += 20;
      ctx.fillText('P - pause', panelX, y);
      y += 20;
      ctx.fillText('R - restart game', panelX, y);
      y += 20;
      ctx.fillText('Space / Enter - next level', panelX, y);
    }

    render() {
      if (!this.ctx || !this.grid) {
        return;
      }

      const ctx = this.ctx;
      const width = this.viewport.width;
      const height = this.viewport.height;

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#07101a';
      ctx.fillRect(0, 0, width, height);

      const fw = this.cols * CELL_SIZE;
      const fh = this.rows * CELL_SIZE;
      const boardX = this.layout.fieldX + Math.floor((this.layout.fieldW - fw) / 2);
      const boardY = this.layout.fieldY + Math.floor((this.layout.fieldH - fh) / 2);

      ctx.save();
      ctx.translate(boardX, boardY);
      this.renderField();
      ctx.restore();

      ctx.strokeStyle = 'rgba(157, 191, 217, 0.28)';
      ctx.lineWidth = 2;
      ctx.strokeRect(boardX - 1, boardY - 1, fw + 2, fh + 2);

      this.renderHud();
    }
  }

  ns.XonixGame = XonixGame;
})(window);
