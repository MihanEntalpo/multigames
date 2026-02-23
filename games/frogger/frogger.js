(function bootstrapFrogger(global) {
  const ns = (global.Minigames = global.Minigames || {});
  const resizeCanvasToDisplaySize = ns.resizeCanvasToDisplaySize;
  const loadJSON = ns.loadJSON;
  const saveJSON = ns.saveJSON;
  const storageKey = ns.storageKey;

  if (!resizeCanvasToDisplaySize || !loadJSON || !saveJSON || !storageKey) {
    throw new Error('Frogger dependencies are missing. Load core scripts before frogger.js.');
  }

  const COLS = 13;
  const ROWS = 13;

  const HOME_ROW = 0;
  const RIVER_ROWS = new Set([2, 3, 4, 5, 6]);
  const ROAD_ROWS = new Set([8, 9, 10, 11]);

  const START_COL = 6;
  const START_ROW = 12;

  const FROG_WIDTH_TILES = 0.72;
  const JUMP_COOLDOWN_SEC = 0.11;
  const LEVEL_SPEED_STEP = 0.13;
  const LEVEL_SPEED_MAX = 2.1;

  const START_LIVES = 3;
  const SCORE_UP_JUMP = 10;
  const SCORE_HOME = 50;
  const SCORE_LEVEL_BONUS = 100;

  const HOME_SLOTS_TEMPLATE = [1, 3, 6, 9, 11];
  const HOME_SLOT_TOLERANCE = 0.46;

  const PROGRESS_KEY = storageKey('frogger', 'progress');
  const DEFAULT_PROGRESS = {
    version: 1,
    bestScore: 0,
    bestLevel: 1,
  };

  const DIR_UP = { dx: 0, dy: -1, key: 'up' };
  const DIR_DOWN = { dx: 0, dy: 1, key: 'down' };
  const DIR_LEFT = { dx: -1, dy: 0, key: 'left' };
  const DIR_RIGHT = { dx: 1, dy: 0, key: 'right' };

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

  const LANE_DEFS = [
    {
      row: 11,
      type: 'road',
      speed: 2.6,
      entities: [
        { x: -0.8, len: 1.9, style: 'truck' },
        { x: 6.4, len: 1.9, style: 'truck' },
      ],
    },
    {
      row: 10,
      type: 'road',
      speed: -3.2,
      entities: [
        { x: 1.1, len: 1.5, style: 'car' },
        { x: 5.8, len: 1.5, style: 'car' },
        { x: 10.5, len: 1.5, style: 'car' },
      ],
    },
    {
      row: 9,
      type: 'road',
      speed: 2.1,
      entities: [
        { x: 1.8, len: 2.2, style: 'bus' },
        { x: 9.2, len: 2.2, style: 'bus' },
      ],
    },
    {
      row: 8,
      type: 'road',
      speed: -2.8,
      entities: [
        { x: -0.4, len: 1.4, style: 'car' },
        { x: 4.5, len: 1.4, style: 'car' },
        { x: 9.4, len: 1.4, style: 'car' },
      ],
    },
    {
      row: 6,
      type: 'river',
      speed: -2.0,
      entities: [
        { x: -0.6, len: 3.0, style: 'log' },
        { x: 6.1, len: 3.0, style: 'log' },
      ],
    },
    {
      row: 5,
      type: 'river',
      speed: 1.8,
      entities: [
        { x: 0.4, len: 2.2, style: 'turtle' },
        { x: 6.0, len: 2.2, style: 'turtle' },
      ],
    },
    {
      row: 4,
      type: 'river',
      speed: -2.5,
      entities: [
        { x: -0.2, len: 2.6, style: 'log' },
        { x: 4.9, len: 2.6, style: 'log' },
        { x: 10.0, len: 2.6, style: 'log' },
      ],
    },
    {
      row: 3,
      type: 'river',
      speed: 2.4,
      entities: [
        { x: 0.9, len: 1.9, style: 'turtle' },
        { x: 5.7, len: 1.9, style: 'turtle' },
        { x: 10.5, len: 1.9, style: 'turtle' },
      ],
    },
    {
      row: 2,
      type: 'river',
      speed: -1.9,
      entities: [
        { x: -1.1, len: 3.6, style: 'log' },
        { x: 6.0, len: 3.6, style: 'log' },
      ],
    },
  ];

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function overlap(aStart, aEnd, bStart, bEnd) {
    return aStart < bEnd && aEnd > bStart;
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

  class FroggerGame {
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

      this.state = 'ready';
      this.score = 0;
      this.level = 1;
      this.lives = START_LIVES;
      this.bestScore = 0;
      this.bestLevel = 1;

      this.homeSlots = [];
      this.lanes = [];

      this.frog = {
        x: START_COL + 0.5,
        y: START_ROW + 0.5,
        dir: DIR_UP,
      };
      this.jumpCooldown = 0;

      this.isRunning = false;
      this.animationFrameId = null;
      this.lastTimestamp = 0;

      this.boundFrame = this.frame.bind(this);
      this.boundKeyDown = this.onKeyDown.bind(this);
      this.boundResize = this.onResize.bind(this);
    }

    getName() {
      return 'frogger';
    }

    getTitle() {
      return 'Frogger';
    }

    run(canvas) {
      if (this.isRunning) {
        this.stop();
      }

      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      if (!this.ctx) {
        throw new Error('Frogger requires CanvasRenderingContext2D.');
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
      const progress = normalizeProgress(loadJSON(PROGRESS_KEY, DEFAULT_PROGRESS));
      this.bestScore = progress.bestScore;
      this.bestLevel = progress.bestLevel;
    }

    saveProgressIfNeeded() {
      let changed = false;

      if (this.score > this.bestScore) {
        this.bestScore = this.score;
        changed = true;
      }
      if (this.level > this.bestLevel) {
        this.bestLevel = this.level;
        changed = true;
      }

      if (!changed) {
        return;
      }

      saveJSON(PROGRESS_KEY, {
        version: 1,
        bestScore: this.bestScore,
        bestLevel: this.bestLevel,
      });
    }

    resetRun() {
      this.state = 'ready';
      this.score = 0;
      this.level = 1;
      this.lives = START_LIVES;
      this.jumpCooldown = 0;

      this.resetHomeSlots();
      this.resetLanes();
      this.resetFrogToStart();
      this.saveProgressIfNeeded();
    }

    resetHomeSlots() {
      this.homeSlots = HOME_SLOTS_TEMPLATE.map((col) => ({ col, filled: false }));
    }

    resetLanes() {
      this.lanes = LANE_DEFS.map((laneDef) => ({
        row: laneDef.row,
        type: laneDef.type,
        speed: laneDef.speed,
        entities: laneDef.entities.map((entity) => ({
          x: entity.x,
          len: entity.len,
          style: entity.style,
        })),
      }));
    }

    resetFrogToStart() {
      this.frog.x = START_COL + 0.5;
      this.frog.y = START_ROW + 0.5;
      this.frog.dir = DIR_UP;
      this.jumpCooldown = 0;
    }

    getSpeedScale() {
      return Math.min(LEVEL_SPEED_MAX, 1 + (this.level - 1) * LEVEL_SPEED_STEP);
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
      const side = width >= 900;

      if (side) {
        const panelWidth = Math.max(230, Math.floor(width * 0.29));
        const availableW = width - panelWidth - pad * 3;
        const availableH = height - pad * 2;
        const tilePx = Math.max(12, Math.floor(Math.min(availableW / COLS, availableH / ROWS)));

        const boardWidth = tilePx * COLS;
        const boardHeight = tilePx * ROWS;

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

      const panelHeight = 174;
      const availableW = width - pad * 2;
      const availableH = height - panelHeight - pad * 3;
      const tilePx = Math.max(10, Math.floor(Math.min(availableW / COLS, availableH / ROWS)));
      const boardWidth = tilePx * COLS;
      const boardHeight = tilePx * ROWS;

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

    frame(timestamp) {
      if (!this.isRunning) {
        return;
      }

      const dt = Math.min(0.05, (timestamp - this.lastTimestamp) / 1000);
      this.lastTimestamp = timestamp;

      if (this.state === 'playing') {
        this.update(dt);
      }

      this.render();
      this.animationFrameId = requestAnimationFrame(this.boundFrame);
    }

    update(dt) {
      this.jumpCooldown = Math.max(0, this.jumpCooldown - dt);

      this.updateLanePositions(dt);

      if (this.applyRiverEffects(dt)) {
        return;
      }
      if (this.checkRoadCollision()) {
        return;
      }
      this.checkHomeArrival();
    }

    updateLanePositions(dt) {
      const speedScale = this.getSpeedScale();

      for (let i = 0; i < this.lanes.length; i += 1) {
        const lane = this.lanes[i];
        const laneShift = lane.speed * speedScale * dt;

        for (let j = 0; j < lane.entities.length; j += 1) {
          const entity = lane.entities[j];
          entity.x += laneShift;

          if (lane.speed > 0 && entity.x > COLS + 1) {
            entity.x = -entity.len - 1;
          } else if (lane.speed < 0 && entity.x + entity.len < -1) {
            entity.x = COLS + 1;
          }
        }
      }
    }

    rowFromY(y) {
      return Math.round(y - 0.5);
    }

    getLaneAtRow(row, laneType) {
      for (let i = 0; i < this.lanes.length; i += 1) {
        const lane = this.lanes[i];
        if (lane.row === row && lane.type === laneType) {
          return lane;
        }
      }
      return null;
    }

    entityOverlapsFrog(entityX, entityLen) {
      const frogHalf = FROG_WIDTH_TILES * 0.5;
      const frogStart = this.frog.x - frogHalf;
      const frogEnd = this.frog.x + frogHalf;

      for (let shiftIndex = -1; shiftIndex <= 1; shiftIndex += 1) {
        const shift = shiftIndex * COLS;
        const start = entityX + shift;
        const end = start + entityLen;
        if (overlap(frogStart, frogEnd, start, end)) {
          return true;
        }
      }
      return false;
    }

    applyRiverEffects(dt) {
      const frogRow = this.rowFromY(this.frog.y);
      if (!RIVER_ROWS.has(frogRow)) {
        return false;
      }

      const lane = this.getLaneAtRow(frogRow, 'river');
      if (!lane) {
        return this.triggerFrogFailure();
      }

      let carried = false;
      for (let i = 0; i < lane.entities.length; i += 1) {
        const entity = lane.entities[i];
        if (this.entityOverlapsFrog(entity.x, entity.len)) {
          carried = true;
          break;
        }
      }

      if (!carried) {
        return this.triggerFrogFailure();
      }

      this.frog.x += lane.speed * this.getSpeedScale() * dt;
      if (this.frog.x < -0.45 || this.frog.x > COLS + 0.45) {
        return this.triggerFrogFailure();
      }
      return false;
    }

    checkRoadCollision() {
      const frogRow = this.rowFromY(this.frog.y);
      if (!ROAD_ROWS.has(frogRow)) {
        return false;
      }

      const lane = this.getLaneAtRow(frogRow, 'road');
      if (!lane) {
        return false;
      }

      for (let i = 0; i < lane.entities.length; i += 1) {
        const entity = lane.entities[i];
        if (this.entityOverlapsFrog(entity.x, entity.len)) {
          return this.triggerFrogFailure();
        }
      }
      return false;
    }

    checkHomeArrival() {
      const frogRow = this.rowFromY(this.frog.y);
      if (frogRow !== HOME_ROW) {
        return;
      }

      let slotIndex = -1;
      for (let i = 0; i < this.homeSlots.length; i += 1) {
        const slot = this.homeSlots[i];
        const center = slot.col + 0.5;
        if (Math.abs(this.frog.x - center) <= HOME_SLOT_TOLERANCE) {
          slotIndex = i;
          break;
        }
      }

      if (slotIndex < 0) {
        this.triggerFrogFailure();
        return;
      }

      const slot = this.homeSlots[slotIndex];
      if (slot.filled) {
        this.triggerFrogFailure();
        return;
      }

      slot.filled = true;
      this.score += SCORE_HOME;
      this.saveProgressIfNeeded();

      const completed = this.homeSlots.every((home) => home.filled);
      if (completed) {
        this.score += SCORE_LEVEL_BONUS;
        this.level += 1;
        this.resetHomeSlots();
        this.resetLanes();
      }

      this.resetFrogToStart();
      this.state = 'ready';
      this.saveProgressIfNeeded();
    }

    triggerFrogFailure() {
      this.lives -= 1;
      if (this.lives <= 0) {
        this.lives = 0;
        this.state = 'gameover';
        this.saveProgressIfNeeded();
      } else {
        this.resetFrogToStart();
        this.state = 'ready';
      }
      return true;
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

      if (this.state === 'gameover') {
        if (event.code === 'Enter') {
          this.resetRun();
        }
        return;
      }

      if (this.state === 'paused') {
        return;
      }

      const dir = KEY_TO_DIR[event.code];
      if (!dir || event.repeat) {
        return;
      }

      if (this.state === 'ready') {
        this.state = 'playing';
        this.lastTimestamp = performance.now();
      }

      if (this.state === 'playing') {
        this.tryJump(dir);
      }
    }

    tryJump(dir) {
      if (this.jumpCooldown > 0) {
        return;
      }

      const baseCol = clamp(Math.round(this.frog.x - 0.5), 0, COLS - 1);
      const baseRow = clamp(Math.round(this.frog.y - 0.5), 0, ROWS - 1);

      const nextCol = clamp(baseCol + dir.dx, 0, COLS - 1);
      const nextRow = clamp(baseRow + dir.dy, 0, ROWS - 1);

      if (nextCol === baseCol && nextRow === baseRow) {
        return;
      }

      this.frog.x = nextCol + 0.5;
      this.frog.y = nextRow + 0.5;
      this.frog.dir = dir;
      this.jumpCooldown = JUMP_COOLDOWN_SEC;

      if (dir.dy < 0) {
        this.score += SCORE_UP_JUMP;
        this.saveProgressIfNeeded();
      }
    }

    render() {
      if (!this.ctx) {
        return;
      }

      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.viewport.width, this.viewport.height);
      ctx.fillStyle = '#081019';
      ctx.fillRect(0, 0, this.viewport.width, this.viewport.height);

      this.drawBoard();
      this.drawHud();

      if (this.state === 'ready') {
        this.drawOverlay('READY', 'Make a jump to start');
      } else if (this.state === 'paused') {
        this.drawOverlay('PAUSED', 'Press P to continue');
      } else if (this.state === 'gameover') {
        this.drawOverlay('GAME OVER', 'Press Enter or R to restart');
      }
    }

    rowColor(row) {
      if (row === HOME_ROW || row === 1) {
        return '#17353a';
      }
      if (RIVER_ROWS.has(row)) {
        return '#154067';
      }
      if (row === 7 || row === START_ROW) {
        return '#234f2f';
      }
      if (ROAD_ROWS.has(row)) {
        return '#2f3035';
      }
      return '#1f3324';
    }

    drawBoard() {
      const ctx = this.ctx;
      const tile = this.layout.tilePx;

      for (let row = 0; row < ROWS; row += 1) {
        const y = this.layout.boardY + row * tile;
        ctx.fillStyle = this.rowColor(row);
        ctx.fillRect(this.layout.boardX, y, this.layout.boardWidth, tile);
      }

      ctx.strokeStyle = 'rgba(214, 230, 247, 0.08)';
      ctx.lineWidth = 1;
      for (let col = 0; col <= COLS; col += 1) {
        const x = this.layout.boardX + col * tile + 0.5;
        ctx.beginPath();
        ctx.moveTo(x, this.layout.boardY);
        ctx.lineTo(x, this.layout.boardY + this.layout.boardHeight);
        ctx.stroke();
      }
      for (let row = 0; row <= ROWS; row += 1) {
        const y = this.layout.boardY + row * tile + 0.5;
        ctx.beginPath();
        ctx.moveTo(this.layout.boardX, y);
        ctx.lineTo(this.layout.boardX + this.layout.boardWidth, y);
        ctx.stroke();
      }

      this.drawHomeSlots();
      this.drawLanes();
      this.drawFrog();

      ctx.strokeStyle = 'rgba(180, 208, 234, 0.28)';
      ctx.lineWidth = 2;
      ctx.strokeRect(this.layout.boardX + 1, this.layout.boardY + 1, this.layout.boardWidth - 2, this.layout.boardHeight - 2);
    }

    drawHomeSlots() {
      const ctx = this.ctx;
      const tile = this.layout.tilePx;
      const rowY = this.layout.boardY + HOME_ROW * tile;

      for (let i = 0; i < this.homeSlots.length; i += 1) {
        const slot = this.homeSlots[i];
        const cx = this.layout.boardX + (slot.col + 0.5) * tile;
        const cy = rowY + tile * 0.5;
        const r = tile * 0.3;

        ctx.fillStyle = slot.filled ? '#77dd77' : '#0a1f20';
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        if (slot.filled) {
          ctx.fillStyle = '#183d1e';
          ctx.beginPath();
          ctx.arc(cx - r * 0.26, cy - r * 0.2, r * 0.08, 0, Math.PI * 2);
          ctx.arc(cx + r * 0.26, cy - r * 0.2, r * 0.08, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    drawLanes() {
      const ctx = this.ctx;
      const tile = this.layout.tilePx;

      for (let i = 0; i < this.lanes.length; i += 1) {
        const lane = this.lanes[i];
        for (let j = 0; j < lane.entities.length; j += 1) {
          const entity = lane.entities[j];
          this.drawEntity(lane.type, entity, lane.row, tile);
        }
      }
    }

    drawEntity(laneType, entity, row, tile) {
      const ctx = this.ctx;

      const drawAtX = (x) => {
        const px = this.layout.boardX + x * tile;
        const py = this.layout.boardY + row * tile + tile * 0.16;
        const w = entity.len * tile;
        const h = tile * 0.68;

        if (laneType === 'road') {
          if (entity.style === 'truck') {
            ctx.fillStyle = '#f35a4b';
          } else if (entity.style === 'bus') {
            ctx.fillStyle = '#f7ad45';
          } else {
            ctx.fillStyle = '#dce3f0';
          }
          ctx.fillRect(px + 2, py, w - 4, h);
          ctx.fillStyle = '#1a2533';
          ctx.fillRect(px + w * 0.18, py + h * 0.18, w * 0.24, h * 0.22);
          ctx.fillRect(px + w * 0.58, py + h * 0.18, w * 0.24, h * 0.22);
          ctx.fillStyle = '#0a0a0f';
          ctx.fillRect(px + w * 0.15, py + h * 0.84, w * 0.16, h * 0.16);
          ctx.fillRect(px + w * 0.69, py + h * 0.84, w * 0.16, h * 0.16);
          return;
        }

        if (entity.style === 'turtle') {
          ctx.fillStyle = '#8ed8de';
          ctx.fillRect(px + 2, py + h * 0.15, w - 4, h * 0.7);
          ctx.fillStyle = '#2f5762';
          ctx.fillRect(px + w * 0.2, py + h * 0.3, w * 0.6, h * 0.1);
        } else {
          ctx.fillStyle = '#9d6b3f';
          ctx.fillRect(px + 1, py + h * 0.1, w - 2, h * 0.8);
          ctx.fillStyle = '#6f4727';
          ctx.fillRect(px + w * 0.2, py + h * 0.23, w * 0.12, h * 0.52);
          ctx.fillRect(px + w * 0.62, py + h * 0.23, w * 0.12, h * 0.52);
        }
      };

      // Draw wrapped copies so entities crossing border remain continuous.
      drawAtX(entity.x - COLS);
      drawAtX(entity.x);
      drawAtX(entity.x + COLS);
    }

    drawFrog() {
      const ctx = this.ctx;
      const tile = this.layout.tilePx;
      const px = this.layout.boardX + this.frog.x * tile;
      const py = this.layout.boardY + this.frog.y * tile;
      const bodyW = tile * 0.62;
      const bodyH = tile * 0.62;

      ctx.fillStyle = '#66d17a';
      ctx.fillRect(px - bodyW / 2, py - bodyH / 2, bodyW, bodyH);

      ctx.fillStyle = '#3aa65a';
      ctx.fillRect(px - bodyW * 0.45, py - bodyH * 0.44, bodyW * 0.32, bodyH * 0.22);
      ctx.fillRect(px + bodyW * 0.13, py - bodyH * 0.44, bodyW * 0.32, bodyH * 0.22);

      let eyeDx = 0;
      let eyeDy = 0;
      if (this.frog.dir === DIR_LEFT) {
        eyeDx = -tile * 0.07;
      } else if (this.frog.dir === DIR_RIGHT) {
        eyeDx = tile * 0.07;
      } else if (this.frog.dir === DIR_UP) {
        eyeDy = -tile * 0.07;
      } else if (this.frog.dir === DIR_DOWN) {
        eyeDy = tile * 0.07;
      }

      ctx.fillStyle = '#10271a';
      ctx.beginPath();
      ctx.arc(px - tile * 0.15 + eyeDx, py - tile * 0.12 + eyeDy, tile * 0.06, 0, Math.PI * 2);
      ctx.arc(px + tile * 0.15 + eyeDx, py - tile * 0.12 + eyeDy, tile * 0.06, 0, Math.PI * 2);
      ctx.fill();
    }

    drawHud() {
      const ctx = this.ctx;
      const x = this.layout.panelX;
      let y = this.layout.panelY + 30;

      ctx.fillStyle = '#e7f2ff';
      ctx.font = 'bold 26px "Trebuchet MS", sans-serif';
      ctx.fillText('FROGGER', x, y);

      y += 32;
      ctx.fillStyle = '#9ec0d8';
      ctx.font = '16px "Trebuchet MS", sans-serif';
      ctx.fillText(`Score: ${this.score}`, x, y);
      y += 24;
      ctx.fillText(`Best Score: ${this.bestScore}`, x, y);
      y += 24;
      ctx.fillText(`Level: ${this.level}`, x, y);
      y += 24;
      ctx.fillText(`Best Level: ${this.bestLevel}`, x, y);
      y += 24;
      ctx.fillText(`Lives: ${this.lives}`, x, y);
      y += 24;
      ctx.fillText(`Homes: ${this.homeSlots.filter((slot) => slot.filled).length}/${this.homeSlots.length}`, x, y);

      y += 34;
      ctx.fillStyle = '#7fa2bc';
      ctx.font = '14px "Trebuchet MS", sans-serif';
      ctx.fillText('Controls:', x, y);
      y += 20;
      ctx.fillText('Arrows / WASD - jump', x, y);
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

  ns.FroggerGame = FroggerGame;
})(window);
