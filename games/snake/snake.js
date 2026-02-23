(function bootstrapSnake(global) {
  const ns = (global.Minigames = global.Minigames || {});
  const resizeCanvasToDisplaySize = ns.resizeCanvasToDisplaySize;
  const loadJSON = ns.loadJSON;
  const saveJSON = ns.saveJSON;
  const storageKey = ns.storageKey;

  if (!resizeCanvasToDisplaySize || !loadJSON || !saveJSON || !storageKey) {
    throw new Error('Snake dependencies are missing. Load core scripts before snake.js.');
  }

  const COLS = 24;
  const ROWS = 24;

  const START_LENGTH = 3;
  const START_LIVES = 1;
  const APPLES_PER_LEVEL = 6;
  const SCORE_PER_APPLE = 10;

  const BASE_STEP_SEC = 0.17;
  const STEP_DEC_PER_LEVEL = 0.009;
  const MIN_STEP_SEC = 0.07;

  const MAX_OBSTACLES = 54;
  const OBSTACLES_PER_LEVEL = 3;

  const PROGRESS_KEY = storageKey('snake', 'progress');
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

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function cellKey(x, y) {
    return `${x},${y}`;
  }

  function isOpposite(a, b) {
    return a.dx === -b.dx && a.dy === -b.dy;
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

  class SnakeGame {
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
      this.applesForLevel = 0;

      this.bestScore = 0;
      this.bestLevel = 1;

      this.snake = [];
      this.apple = { x: 0, y: 0 };
      this.obstacles = new Set();

      this.direction = DIR_RIGHT;
      this.pendingDirection = DIR_RIGHT;
      this.stepAccumulator = 0;

      this.isRunning = false;
      this.animationFrameId = null;
      this.lastTimestamp = 0;

      this.boundFrame = this.frame.bind(this);
      this.boundKeyDown = this.onKeyDown.bind(this);
      this.boundResize = this.onResize.bind(this);
    }

    getName() {
      return 'snake';
    }

    getTitle() {
      return 'Snake';
    }

    run(canvas) {
      if (this.isRunning) {
        this.stop();
      }

      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      if (!this.ctx) {
        throw new Error('Snake requires CanvasRenderingContext2D.');
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
      this.applesForLevel = 0;
      this.stepAccumulator = 0;

      this.resetSnake();
      this.generateObstacles();
      this.spawnApple();
      this.saveProgressIfNeeded();
    }

    resetSnake() {
      const cx = Math.floor(COLS / 2);
      const cy = Math.floor(ROWS / 2);
      this.snake = [];
      for (let i = 0; i < START_LENGTH; i += 1) {
        this.snake.push({ x: cx - i, y: cy });
      }
      this.direction = DIR_RIGHT;
      this.pendingDirection = DIR_RIGHT;
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
      const side = width >= 860;

      if (side) {
        const panelWidth = Math.max(230, Math.floor(width * 0.3));
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

      const panelHeight = 180;
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
      this.stepAccumulator += dt;
      const moveStep = this.getMoveStepSeconds();

      while (this.stepAccumulator >= moveStep) {
        this.stepAccumulator -= moveStep;
        if (!this.step()) {
          break;
        }
      }
    }

    getMoveStepSeconds() {
      return Math.max(MIN_STEP_SEC, BASE_STEP_SEC - (this.level - 1) * STEP_DEC_PER_LEVEL);
    }

    step() {
      if (!isOpposite(this.pendingDirection, this.direction)) {
        this.direction = this.pendingDirection;
      }

      const head = this.snake[0];
      const nextX = head.x + this.direction.dx;
      const nextY = head.y + this.direction.dy;

      if (nextX < 0 || nextY < 0 || nextX >= COLS || nextY >= ROWS) {
        this.state = 'gameover';
        this.saveProgressIfNeeded();
        return false;
      }
      if (this.obstacles.has(cellKey(nextX, nextY))) {
        this.state = 'gameover';
        this.saveProgressIfNeeded();
        return false;
      }

      const willGrow = nextX === this.apple.x && nextY === this.apple.y;
      const checkLimit = willGrow ? this.snake.length : this.snake.length - 1;
      for (let i = 0; i < checkLimit; i += 1) {
        const part = this.snake[i];
        if (part.x === nextX && part.y === nextY) {
          this.state = 'gameover';
          this.saveProgressIfNeeded();
          return false;
        }
      }

      this.snake.unshift({ x: nextX, y: nextY });

      if (willGrow) {
        this.score += SCORE_PER_APPLE;
        this.applesForLevel += 1;
        this.saveProgressIfNeeded();

        if (this.applesForLevel >= APPLES_PER_LEVEL) {
          this.level += 1;
          this.applesForLevel = 0;
          this.resetSnake();
          this.generateObstacles();
          this.spawnApple();
          this.state = 'ready';
          this.stepAccumulator = 0;
          this.saveProgressIfNeeded();
          return true;
        }

        this.spawnApple();
      } else {
        this.snake.pop();
      }

      return true;
    }

    generateObstacles() {
      this.obstacles.clear();

      const targetCount = Math.min(MAX_OBSTACLES, Math.max(0, (this.level - 1) * OBSTACLES_PER_LEVEL));
      if (targetCount <= 0) {
        return;
      }

      const cx = Math.floor(COLS / 2);
      const cy = Math.floor(ROWS / 2);
      const safeRadius = 4;

      let seed = ((this.level + 17) * 2654435761) >>> 0;
      const rand = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
      };

      let attempts = 0;
      while (this.obstacles.size < targetCount && attempts < 6000) {
        attempts += 1;

        const x = 1 + Math.floor(rand() * (COLS - 2));
        const y = 1 + Math.floor(rand() * (ROWS - 2));

        if (Math.abs(x - cx) <= safeRadius && Math.abs(y - cy) <= safeRadius) {
          continue;
        }

        let onSnake = false;
        for (let i = 0; i < this.snake.length; i += 1) {
          const part = this.snake[i];
          if (part.x === x && part.y === y) {
            onSnake = true;
            break;
          }
        }
        if (onSnake) {
          continue;
        }

        this.obstacles.add(cellKey(x, y));
      }
    }

    spawnApple() {
      const free = [];

      for (let y = 0; y < ROWS; y += 1) {
        for (let x = 0; x < COLS; x += 1) {
          if (this.obstacles.has(cellKey(x, y))) {
            continue;
          }

          let onSnake = false;
          for (let i = 0; i < this.snake.length; i += 1) {
            const part = this.snake[i];
            if (part.x === x && part.y === y) {
              onSnake = true;
              break;
            }
          }
          if (!onSnake) {
            free.push({ x, y });
          }
        }
      }

      if (free.length === 0) {
        this.state = 'gameover';
        this.saveProgressIfNeeded();
        return;
      }

      const pick = free[Math.floor(Math.random() * free.length)];
      this.apple.x = pick.x;
      this.apple.y = pick.y;
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

      if (this.state === 'playing' && !isOpposite(dir, this.direction)) {
        this.pendingDirection = dir;
      }
    }

    render() {
      if (!this.ctx) {
        return;
      }

      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.viewport.width, this.viewport.height);
      ctx.fillStyle = '#091018';
      ctx.fillRect(0, 0, this.viewport.width, this.viewport.height);

      this.drawBoard();
      this.drawHud();

      if (this.state === 'ready') {
        this.drawOverlay('READY', `Press direction to start (Level ${this.level})`);
      } else if (this.state === 'paused') {
        this.drawOverlay('PAUSED', 'Press P to continue');
      } else if (this.state === 'gameover') {
        this.drawOverlay('GAME OVER', 'Press Enter or R to restart');
      }
    }

    drawBoard() {
      const ctx = this.ctx;
      const tile = this.layout.tilePx;
      const boardX = this.layout.boardX;
      const boardY = this.layout.boardY;

      ctx.fillStyle = '#102030';
      ctx.fillRect(boardX, boardY, this.layout.boardWidth, this.layout.boardHeight);

      ctx.strokeStyle = 'rgba(196, 220, 255, 0.07)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= COLS; x += 1) {
        const px = boardX + x * tile + 0.5;
        ctx.beginPath();
        ctx.moveTo(px, boardY);
        ctx.lineTo(px, boardY + this.layout.boardHeight);
        ctx.stroke();
      }
      for (let y = 0; y <= ROWS; y += 1) {
        const py = boardY + y * tile + 0.5;
        ctx.beginPath();
        ctx.moveTo(boardX, py);
        ctx.lineTo(boardX + this.layout.boardWidth, py);
        ctx.stroke();
      }

      this.drawObstacles();
      this.drawApple();
      this.drawSnake();

      ctx.strokeStyle = 'rgba(180, 208, 234, 0.28)';
      ctx.lineWidth = 2;
      ctx.strokeRect(boardX + 1, boardY + 1, this.layout.boardWidth - 2, this.layout.boardHeight - 2);
    }

    drawObstacles() {
      const ctx = this.ctx;
      const tile = this.layout.tilePx;

      ctx.fillStyle = '#4b3756';
      this.obstacles.forEach((key) => {
        const parts = key.split(',');
        const x = Number(parts[0]);
        const y = Number(parts[1]);
        const px = this.layout.boardX + x * tile;
        const py = this.layout.boardY + y * tile;

        ctx.fillRect(px + 1, py + 1, tile - 2, tile - 2);
      });
    }

    drawApple() {
      const ctx = this.ctx;
      const tile = this.layout.tilePx;
      const cx = this.layout.boardX + (this.apple.x + 0.5) * tile;
      const cy = this.layout.boardY + (this.apple.y + 0.5) * tile;

      ctx.fillStyle = '#ef4f58';
      ctx.beginPath();
      ctx.arc(cx, cy, tile * 0.28, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#8ad674';
      ctx.lineWidth = Math.max(1, tile * 0.08);
      ctx.beginPath();
      ctx.moveTo(cx + tile * 0.08, cy - tile * 0.24);
      ctx.lineTo(cx + tile * 0.2, cy - tile * 0.38);
      ctx.stroke();
    }

    drawSnake() {
      const ctx = this.ctx;
      const tile = this.layout.tilePx;

      for (let i = this.snake.length - 1; i >= 0; i -= 1) {
        const part = this.snake[i];
        const px = this.layout.boardX + part.x * tile;
        const py = this.layout.boardY + part.y * tile;
        const t = i / Math.max(1, this.snake.length - 1);
        const g = Math.floor(180 + t * 45);
        const b = Math.floor(90 + t * 45);
        ctx.fillStyle = `rgb(72, ${g}, ${b})`;
        ctx.fillRect(px + 2, py + 2, tile - 4, tile - 4);
      }

      const head = this.snake[0];
      if (!head) {
        return;
      }

      const hx = this.layout.boardX + (head.x + 0.5) * tile;
      const hy = this.layout.boardY + (head.y + 0.5) * tile;
      const eyeOffset = tile * 0.12;
      let ex = 0;
      let ey = 0;

      if (this.direction === DIR_UP) {
        ey = -tile * 0.1;
      } else if (this.direction === DIR_DOWN) {
        ey = tile * 0.1;
      } else if (this.direction === DIR_LEFT) {
        ex = -tile * 0.1;
      } else if (this.direction === DIR_RIGHT) {
        ex = tile * 0.1;
      }

      ctx.fillStyle = '#102024';
      ctx.beginPath();
      ctx.arc(hx - eyeOffset + ex, hy - eyeOffset + ey, tile * 0.06, 0, Math.PI * 2);
      ctx.arc(hx + eyeOffset + ex, hy - eyeOffset + ey, tile * 0.06, 0, Math.PI * 2);
      ctx.fill();
    }

    drawHud() {
      const ctx = this.ctx;
      const x = this.layout.panelX;
      let y = this.layout.panelY + 30;

      ctx.fillStyle = '#e7f2ff';
      ctx.font = 'bold 26px "Trebuchet MS", sans-serif';
      ctx.fillText('SNAKE', x, y);

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
      ctx.fillText(`Apples: ${this.applesForLevel}/${APPLES_PER_LEVEL}`, x, y);
      y += 24;
      ctx.fillText(`Obstacles: ${this.obstacles.size}`, x, y);

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

  ns.SnakeGame = SnakeGame;
})(window);
