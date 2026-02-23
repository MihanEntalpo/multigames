(function bootstrapSokoban(global) {
  const ns = (global.Minigames = global.Minigames || {});
  const resizeCanvasToDisplaySize = ns.resizeCanvasToDisplaySize;
  const loadJSON = ns.loadJSON;
  const saveJSON = ns.saveJSON;
  const storageKey = ns.storageKey;

  if (!resizeCanvasToDisplaySize || !loadJSON || !saveJSON || !storageKey) {
    throw new Error('Sokoban dependencies are missing. Load core scripts before sokoban.js.');
  }

  const WORLD_WIDTH = 960;
  const WORLD_HEIGHT = 640;

  const BOARD_AREA = {
    x: 26,
    y: 56,
    w: 620,
    h: 560,
  };

  const PROGRESS_KEY = storageKey('sokoban', 'progress');
  const DEFAULT_PROGRESS = {
    version: 1,
    highestUnlocked: 0,
    bestMovesByLevel: {},
  };

  const LEVELS = [
    [
      '########',
      '#      #',
      '# .$$  #',
      '# . @  #',
      '#      #',
      '########',
    ],
    [
      '##########',
      '#        #',
      '# .  . . #',
      '# $$ $   #',
      '#   @    #',
      '#        #',
      '##########',
    ],
    [
      '###########',
      '#   #     #',
      '# .   .   #',
      '# $$#$    #',
      '#   @   . #',
      '#         #',
      '###########',
    ],
  ];

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function keyOf(x, y) {
    return `${x},${y}`;
  }

  function normalizeProgress(data) {
    if (!data || typeof data !== 'object') {
      return {
        version: 1,
        highestUnlocked: 0,
        bestMovesByLevel: {},
      };
    }

    const highestUnlocked = Number.isFinite(data.highestUnlocked)
      ? clamp(Math.floor(data.highestUnlocked), 0, LEVELS.length - 1)
      : 0;

    const bestMovesByLevel = {};
    if (data.bestMovesByLevel && typeof data.bestMovesByLevel === 'object') {
      for (const levelKey of Object.keys(data.bestMovesByLevel)) {
        const value = data.bestMovesByLevel[levelKey];
        if (Number.isFinite(value) && value > 0) {
          bestMovesByLevel[levelKey] = Math.floor(value);
        }
      }
    }

    return {
      version: 1,
      highestUnlocked,
      bestMovesByLevel,
    };
  }

  function parseLevel(lines) {
    const height = lines.length;
    const width = lines.reduce((max, line) => Math.max(max, line.length), 0);

    const walls = Array.from({ length: height }, () => Array(width).fill(false));
    const targets = new Set();
    const boxes = [];
    let player = { x: 1, y: 1 };

    for (let y = 0; y < height; y += 1) {
      const line = lines[y];
      for (let x = 0; x < width; x += 1) {
        const cell = line[x] || ' ';

        if (cell === '#') {
          walls[y][x] = true;
        } else if (cell === '.') {
          targets.add(keyOf(x, y));
        } else if (cell === '$') {
          boxes.push({ x, y });
        } else if (cell === '@') {
          player = { x, y };
        } else if (cell === '*') {
          boxes.push({ x, y });
          targets.add(keyOf(x, y));
        } else if (cell === '+') {
          player = { x, y };
          targets.add(keyOf(x, y));
        }
      }
    }

    const boxIndexByKey = new Map();
    for (let i = 0; i < boxes.length; i += 1) {
      boxIndexByKey.set(keyOf(boxes[i].x, boxes[i].y), i);
    }

    return {
      width,
      height,
      walls,
      targets,
      boxes,
      boxIndexByKey,
      player,
    };
  }

  class SokobanGame {
    constructor() {
      this.canvas = null;
      this.ctx = null;
      this.viewport = { width: 1, height: 1, dpr: 1, resized: false };

      this.scale = 1;
      this.offsetX = 0;
      this.offsetY = 0;

      this.animationFrameId = null;
      this.isRunning = false;
      this.lastTimestamp = 0;
      this.blinkMs = 0;

      this.progress = normalizeProgress(DEFAULT_PROGRESS);

      this.currentLevelIndex = 0;
      this.state = 'playing';
      this.level = null;
      this.moves = 0;
      this.pushes = 0;

      this.boundFrame = this.frame.bind(this);
      this.boundKeyDown = this.onKeyDown.bind(this);
      this.boundResize = this.onResize.bind(this);
    }

    getName() {
      return 'sokoban';
    }

    getTitle() {
      return 'Sokoban';
    }

    run(canvas) {
      if (this.isRunning) {
        this.stop();
      }

      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      if (!this.ctx) {
        throw new Error('Sokoban requires CanvasRenderingContext2D.');
      }

      this.loadProgress();
      this.currentLevelIndex = clamp(this.progress.highestUnlocked, 0, LEVELS.length - 1);
      this.loadLevel(this.currentLevelIndex);

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

    saveProgress() {
      saveJSON(PROGRESS_KEY, {
        version: 1,
        highestUnlocked: this.progress.highestUnlocked,
        bestMovesByLevel: this.progress.bestMovesByLevel,
      });
    }

    loadLevel(levelIndex) {
      this.currentLevelIndex = clamp(levelIndex, 0, LEVELS.length - 1);
      this.level = parseLevel(LEVELS[this.currentLevelIndex]);
      this.moves = 0;
      this.pushes = 0;
      this.state = 'playing';
      this.blinkMs = 0;
    }

    restartCurrentLevel() {
      this.loadLevel(this.currentLevelIndex);
    }

    nextLevel() {
      if (this.currentLevelIndex < LEVELS.length - 1) {
        this.loadLevel(this.currentLevelIndex + 1);
      }
    }

    previousLevel() {
      if (this.currentLevelIndex > 0) {
        this.loadLevel(this.currentLevelIndex - 1);
      }
    }

    onResize() {
      if (!this.canvas || !this.ctx) {
        return;
      }

      this.viewport = resizeCanvasToDisplaySize(this.canvas, this.ctx);
      this.scale = Math.min(this.viewport.width / WORLD_WIDTH, this.viewport.height / WORLD_HEIGHT);
      this.offsetX = Math.floor((this.viewport.width - WORLD_WIDTH * this.scale) / 2);
      this.offsetY = Math.floor((this.viewport.height - WORLD_HEIGHT * this.scale) / 2);
      this.render();
    }

    frame(timestamp) {
      if (!this.isRunning) {
        return;
      }

      const dt = Math.min(100, timestamp - this.lastTimestamp);
      this.lastTimestamp = timestamp;
      this.blinkMs += dt;

      this.render();
      this.animationFrameId = requestAnimationFrame(this.boundFrame);
    }

    onKeyDown(event) {
      if (!this.isRunning) {
        return;
      }

      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(event.code)) {
        event.preventDefault();
      }

      if (event.code === 'KeyP' && !event.repeat) {
        if (this.state === 'playing') {
          this.state = 'paused';
        } else if (this.state === 'paused') {
          this.state = 'playing';
        }
        return;
      }

      if (event.code === 'KeyR' && !event.repeat) {
        this.restartCurrentLevel();
        return;
      }

      if (event.code === 'BracketLeft' && !event.repeat) {
        this.previousLevel();
        return;
      }

      if (event.code === 'BracketRight' && !event.repeat) {
        if (this.currentLevelIndex < this.progress.highestUnlocked) {
          this.nextLevel();
        }
        return;
      }

      if (this.state === 'level_complete') {
        if ((event.code === 'Enter' || event.code === 'KeyN') && !event.repeat) {
          this.nextLevel();
        }
        return;
      }

      if (this.state === 'all_complete') {
        if ((event.code === 'Enter' || event.code === 'KeyN') && !event.repeat) {
          this.loadLevel(0);
        }
        return;
      }

      if (this.state !== 'playing') {
        return;
      }

      switch (event.code) {
        case 'ArrowLeft':
        case 'KeyA':
          this.tryMove(-1, 0);
          break;
        case 'ArrowRight':
        case 'KeyD':
          this.tryMove(1, 0);
          break;
        case 'ArrowUp':
        case 'KeyW':
          this.tryMove(0, -1);
          break;
        case 'ArrowDown':
        case 'KeyS':
          this.tryMove(0, 1);
          break;
        default:
          return;
      }
    }

    isWall(x, y) {
      if (!this.level) {
        return true;
      }

      if (x < 0 || x >= this.level.width || y < 0 || y >= this.level.height) {
        return true;
      }

      return this.level.walls[y][x];
    }

    hasBox(x, y) {
      return this.level.boxIndexByKey.has(keyOf(x, y));
    }

    moveBox(fromX, fromY, toX, toY) {
      const fromKey = keyOf(fromX, fromY);
      const toKey = keyOf(toX, toY);
      const boxIndex = this.level.boxIndexByKey.get(fromKey);

      this.level.boxIndexByKey.delete(fromKey);
      this.level.boxIndexByKey.set(toKey, boxIndex);
      this.level.boxes[boxIndex].x = toX;
      this.level.boxes[boxIndex].y = toY;
    }

    tryMove(dx, dy) {
      if (!this.level) {
        return false;
      }

      const nextX = this.level.player.x + dx;
      const nextY = this.level.player.y + dy;

      if (this.isWall(nextX, nextY)) {
        return false;
      }

      if (this.hasBox(nextX, nextY)) {
        const pushX = nextX + dx;
        const pushY = nextY + dy;

        if (this.isWall(pushX, pushY) || this.hasBox(pushX, pushY)) {
          return false;
        }

        this.moveBox(nextX, nextY, pushX, pushY);
        this.pushes += 1;
      }

      this.level.player.x = nextX;
      this.level.player.y = nextY;
      this.moves += 1;

      if (this.isLevelSolved()) {
        this.finishLevel();
      }

      return true;
    }

    isLevelSolved() {
      if (!this.level) {
        return false;
      }

      if (this.level.boxes.length !== this.level.targets.size) {
        return false;
      }

      for (let i = 0; i < this.level.boxes.length; i += 1) {
        const box = this.level.boxes[i];
        if (!this.level.targets.has(keyOf(box.x, box.y))) {
          return false;
        }
      }

      return true;
    }

    finishLevel() {
      const levelKey = String(this.currentLevelIndex);
      const best = this.progress.bestMovesByLevel[levelKey];
      if (!best || this.moves < best) {
        this.progress.bestMovesByLevel[levelKey] = this.moves;
      }

      if (this.currentLevelIndex < LEVELS.length - 1) {
        this.progress.highestUnlocked = Math.max(this.progress.highestUnlocked, this.currentLevelIndex + 1);
        this.state = 'level_complete';
      } else {
        this.progress.highestUnlocked = LEVELS.length - 1;
        this.state = 'all_complete';
      }

      this.saveProgress();
    }

    render() {
      if (!this.ctx || !this.level) {
        return;
      }

      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.viewport.width, this.viewport.height);
      ctx.fillStyle = '#08111b';
      ctx.fillRect(0, 0, this.viewport.width, this.viewport.height);

      ctx.save();
      ctx.translate(this.offsetX, this.offsetY);
      ctx.scale(this.scale, this.scale);

      this.drawBackground(ctx);
      const boardLayout = this.computeBoardLayout();
      this.drawBoard(ctx, boardLayout);
      this.drawHud(ctx);
      this.drawStateOverlay(ctx, boardLayout);

      ctx.restore();
    }

    computeBoardLayout() {
      const cell = Math.max(
        16,
        Math.floor(
          Math.min(
            BOARD_AREA.w / Math.max(1, this.level.width),
            BOARD_AREA.h / Math.max(1, this.level.height)
          )
        )
      );

      const width = cell * this.level.width;
      const height = cell * this.level.height;
      const x = BOARD_AREA.x + Math.floor((BOARD_AREA.w - width) / 2);
      const y = BOARD_AREA.y + Math.floor((BOARD_AREA.h - height) / 2);

      return { cell, x, y, width, height };
    }

    drawBackground(ctx) {
      ctx.fillStyle = '#07111b';
      ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      for (let i = 0; i < 130; i += 1) {
        const x = (i * 73) % WORLD_WIDTH;
        const y = (i * 41) % WORLD_HEIGHT;
        ctx.fillRect(x, y, 2, 2);
      }

      ctx.strokeStyle = 'rgba(152, 188, 214, 0.28)';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, WORLD_WIDTH - 2, WORLD_HEIGHT - 2);
    }

    drawBoard(ctx, layout) {
      const { cell, x: baseX, y: baseY } = layout;

      ctx.fillStyle = '#0d1b2b';
      ctx.fillRect(layout.x - 4, layout.y - 4, layout.width + 8, layout.height + 8);

      for (let y = 0; y < this.level.height; y += 1) {
        for (let x = 0; x < this.level.width; x += 1) {
          const px = baseX + x * cell;
          const py = baseY + y * cell;
          const isWall = this.level.walls[y][x];
          const isTarget = this.level.targets.has(keyOf(x, y));

          if (isWall) {
            ctx.fillStyle = '#2a3d52';
            ctx.fillRect(px, py, cell, cell);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
            ctx.fillRect(px + 2, py + 2, cell - 4, 5);
          } else {
            ctx.fillStyle = '#132236';
            ctx.fillRect(px, py, cell, cell);
          }

          if (isTarget) {
            ctx.fillStyle = '#78d6a6';
            ctx.beginPath();
            ctx.arc(px + cell / 2, py + cell / 2, Math.max(4, cell * 0.18), 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      for (let i = 0; i < this.level.boxes.length; i += 1) {
        const box = this.level.boxes[i];
        const px = baseX + box.x * cell;
        const py = baseY + box.y * cell;
        const onTarget = this.level.targets.has(keyOf(box.x, box.y));

        ctx.fillStyle = onTarget ? '#f5d77d' : '#c8915c';
        ctx.fillRect(px + 2, py + 2, cell - 4, cell - 4);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.fillRect(px + 4, py + 4, cell - 8, 5);
      }

      const playerX = baseX + this.level.player.x * cell;
      const playerY = baseY + this.level.player.y * cell;
      ctx.fillStyle = '#8ebeff';
      ctx.beginPath();
      ctx.arc(playerX + cell / 2, playerY + cell / 2, Math.max(6, cell * 0.33), 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(193, 219, 242, 0.28)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= this.level.width; x += 1) {
        const gx = baseX + x * cell + 0.5;
        ctx.beginPath();
        ctx.moveTo(gx, baseY);
        ctx.lineTo(gx, baseY + this.level.height * cell);
        ctx.stroke();
      }
      for (let y = 0; y <= this.level.height; y += 1) {
        const gy = baseY + y * cell + 0.5;
        ctx.beginPath();
        ctx.moveTo(baseX, gy);
        ctx.lineTo(baseX + this.level.width * cell, gy);
        ctx.stroke();
      }
    }

    drawHud(ctx) {
      const panelX = 680;
      let lineY = 84;

      ctx.fillStyle = '#e7f2ff';
      ctx.font = 'bold 28px "Trebuchet MS", sans-serif';
      ctx.fillText('SOKOBAN', panelX, lineY);

      lineY += 34;
      ctx.fillStyle = '#9ec0dc';
      ctx.font = '17px "Trebuchet MS", sans-serif';
      ctx.fillText(`Level: ${this.currentLevelIndex + 1}/${LEVELS.length}`, panelX, lineY);

      lineY += 26;
      ctx.fillText(`Moves: ${this.moves}`, panelX, lineY);

      lineY += 26;
      ctx.fillText(`Pushes: ${this.pushes}`, panelX, lineY);

      lineY += 26;
      const bestMoves = this.progress.bestMovesByLevel[String(this.currentLevelIndex)] || '-';
      ctx.fillText(`Best moves: ${bestMoves}`, panelX, lineY);

      lineY += 26;
      ctx.fillText(`Unlocked: ${this.progress.highestUnlocked + 1}`, panelX, lineY);

      lineY += 38;
      ctx.fillStyle = '#7fa2bd';
      ctx.font = '14px "Trebuchet MS", sans-serif';
      ctx.fillText('Controls:', panelX, lineY);
      lineY += 22;
      ctx.fillText('Arrows / WASD - move', panelX, lineY);
      lineY += 20;
      ctx.fillText('R - restart level', panelX, lineY);
      lineY += 20;
      ctx.fillText('P - pause', panelX, lineY);
      lineY += 20;
      ctx.fillText('N or Enter - next after clear', panelX, lineY);
      lineY += 20;
      ctx.fillText('[ / ] - previous/next unlocked', panelX, lineY);
    }

    drawStateOverlay(ctx, layout) {
      if (this.state === 'playing') {
        return;
      }

      const blinkOn = Math.floor(this.blinkMs / 500) % 2 === 0;

      ctx.fillStyle = 'rgba(2, 8, 14, 0.66)';
      ctx.fillRect(layout.x, layout.y, layout.width, layout.height);

      ctx.fillStyle = '#eff6ff';
      ctx.textAlign = 'center';
      ctx.font = 'bold 34px "Trebuchet MS", sans-serif';

      const centerX = layout.x + layout.width / 2;
      const centerY = layout.y + layout.height / 2;

      if (this.state === 'paused') {
        ctx.fillText('Paused', centerX, centerY - 10);
        ctx.fillStyle = '#bed2e4';
        ctx.font = '18px "Trebuchet MS", sans-serif';
        ctx.fillText('Press P to continue', centerX, centerY + 22);
      } else if (this.state === 'level_complete') {
        ctx.fillText('Level Cleared', centerX, centerY - 10);
        if (blinkOn) {
          ctx.fillStyle = '#bed2e4';
          ctx.font = '18px "Trebuchet MS", sans-serif';
          ctx.fillText('Press N or Enter for next level', centerX, centerY + 22);
        }
      } else if (this.state === 'all_complete') {
        ctx.fillText('All Levels Cleared', centerX, centerY - 10);
        if (blinkOn) {
          ctx.fillStyle = '#bed2e4';
          ctx.font = '18px "Trebuchet MS", sans-serif';
          ctx.fillText('Press Enter to play again', centerX, centerY + 22);
        }
      }

      ctx.textAlign = 'left';
    }
  }

  ns.SokobanGame = SokobanGame;
})(window);
