(function bootstrapTetris(global) {
  const ns = (global.Minigames = global.Minigames || {});
  const resizeCanvasToDisplaySize = ns.resizeCanvasToDisplaySize;
  const loadJSON = ns.loadJSON;
  const saveJSON = ns.saveJSON;
  const storageKey = ns.storageKey;

  if (!resizeCanvasToDisplaySize || !loadJSON || !saveJSON || !storageKey) {
    throw new Error('Tetris dependencies are missing. Load core scripts before tetris.js.');
  }

const BOARD_COLS = 10;
const BOARD_VISIBLE_ROWS = 20;
const BOARD_HIDDEN_ROWS = 2;
const BOARD_TOTAL_ROWS = BOARD_VISIBLE_ROWS + BOARD_HIDDEN_ROWS;

const DROP_INTERVAL_MS = 700;
const SOFT_DROP_INTERVAL_MS = 60;

const SCORE_TABLE = {
  1: 100,
  2: 300,
  3: 500,
  4: 800,
};

const PIECES = {
  I: {
    color: '#48cae4',
    shape: [[1, 1, 1, 1]],
  },
  O: {
    color: '#ffd166',
    shape: [
      [1, 1],
      [1, 1],
    ],
  },
  T: {
    color: '#c77dff',
    shape: [
      [0, 1, 0],
      [1, 1, 1],
    ],
  },
  S: {
    color: '#80ed99',
    shape: [
      [0, 1, 1],
      [1, 1, 0],
    ],
  },
  Z: {
    color: '#ff6b6b',
    shape: [
      [1, 1, 0],
      [0, 1, 1],
    ],
  },
  J: {
    color: '#4d96ff',
    shape: [
      [1, 0, 0],
      [1, 1, 1],
    ],
  },
  L: {
    color: '#ff9f1c',
    shape: [
      [0, 0, 1],
      [1, 1, 1],
    ],
  },
};

const PIECE_TYPES = Object.keys(PIECES);

const PROGRESS_KEY = storageKey('tetris', 'progress');
const DEFAULT_PROGRESS = {
  version: 1,
  bestScore: 0,
};

function createEmptyBoard() {
  return Array.from({ length: BOARD_TOTAL_ROWS }, () => Array(BOARD_COLS).fill(null));
}

function cloneMatrix(matrix) {
  return matrix.map((row) => [...row]);
}

function rotateClockwise(matrix) {
  const rows = matrix.length;
  const cols = matrix[0].length;
  const rotated = Array.from({ length: cols }, () => Array(rows).fill(0));

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      rotated[x][rows - 1 - y] = matrix[y][x];
    }
  }

  return rotated;
}

function rotateCounterClockwise(matrix) {
  const rows = matrix.length;
  const cols = matrix[0].length;
  const rotated = Array.from({ length: cols }, () => Array(rows).fill(0));

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      rotated[cols - 1 - x][y] = matrix[y][x];
    }
  }

  return rotated;
}

function shuffleInPlace(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function normalizeProgress(data) {
  if (!data || typeof data !== 'object') {
    return { ...DEFAULT_PROGRESS };
  }

  const bestScore = Number.isFinite(data.bestScore) ? Math.max(0, Math.floor(data.bestScore)) : 0;
  return {
    version: 1,
    bestScore,
  };
}

class TetrisGame {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.viewport = { width: 1, height: 1, dpr: 1, resized: false };

    this.animationFrameId = null;
    this.isRunning = false;

    this.board = createEmptyBoard();
    this.activePiece = null;
    this.bag = [];

    this.state = 'playing';
    this.score = 0;
    this.lines = 0;
    this.bestScore = 0;

    this.dropAccumulator = 0;
    this.lastTimestamp = 0;
    this.softDropActive = false;

    this.boundFrame = this.frame.bind(this);
    this.boundKeyDown = this.onKeyDown.bind(this);
    this.boundKeyUp = this.onKeyUp.bind(this);
    this.boundResize = this.onResize.bind(this);
  }

  getName() {
    return 'tetris';
  }

  getTitle() {
    return 'Tetris';
  }

  run(canvas) {
    if (this.isRunning) {
      this.stop();
    }

    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    if (!this.ctx) {
      throw new Error('Tetris requires CanvasRenderingContext2D.');
    }

    this.loadProgress();
    this.resetGame();

    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);
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
    window.removeEventListener('keyup', this.boundKeyUp);
    window.removeEventListener('resize', this.boundResize);

    this.isRunning = false;
    this.softDropActive = false;

    if (this.ctx && this.viewport) {
      this.ctx.setTransform(this.viewport.dpr || 1, 0, 0, this.viewport.dpr || 1, 0, 0);
      this.ctx.clearRect(0, 0, this.viewport.width, this.viewport.height);
    }

    this.canvas = null;
    this.ctx = null;
  }

  loadProgress() {
    this.bestScore = normalizeProgress(loadJSON(PROGRESS_KEY, DEFAULT_PROGRESS)).bestScore;
  }

  saveProgressIfNeeded() {
    if (this.score <= this.bestScore) {
      return;
    }

    this.bestScore = this.score;
    saveJSON(PROGRESS_KEY, {
      version: 1,
      bestScore: this.bestScore,
    });
  }

  resetGame() {
    this.board = createEmptyBoard();
    this.activePiece = null;
    this.bag = [];

    this.state = 'playing';
    this.score = 0;
    this.lines = 0;

    this.dropAccumulator = 0;
    this.softDropActive = false;

    this.spawnPiece();
  }

  onResize() {
    if (!this.canvas || !this.ctx) {
      return;
    }

    this.viewport = resizeCanvasToDisplaySize(this.canvas, this.ctx);
    this.render();
  }

  frame(timestamp) {
    if (!this.isRunning) {
      return;
    }

    const dt = Math.min(100, timestamp - this.lastTimestamp);
    this.lastTimestamp = timestamp;

    if (this.state === 'playing') {
      this.update(dt);
    }

    this.render();
    this.animationFrameId = requestAnimationFrame(this.boundFrame);
  }

  update(dt) {
    const interval = this.softDropActive ? SOFT_DROP_INTERVAL_MS : DROP_INTERVAL_MS;
    this.dropAccumulator += dt;

    while (this.dropAccumulator >= interval && this.state === 'playing') {
      this.dropAccumulator -= interval;

      if (!this.tryMove(0, 1)) {
        this.lockPiece();
        this.dropAccumulator = 0;
      }
    }
  }

  onKeyDown(event) {
    if (!this.isRunning) {
      return;
    }

    if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'Space'].includes(event.code)) {
      event.preventDefault();
    }

    if (event.code === 'KeyP') {
      if (this.state === 'playing') {
        this.state = 'paused';
      } else if (this.state === 'paused') {
        this.state = 'playing';
        this.dropAccumulator = 0;
      }
      this.render();
      return;
    }

    if (event.code === 'KeyR') {
      this.resetGame();
      this.render();
      return;
    }

    if (this.state === 'gameover') {
      if (event.code === 'Enter') {
        this.resetGame();
        this.render();
      }
      return;
    }

    if (this.state !== 'playing') {
      return;
    }

    if (!this.activePiece) {
      return;
    }

    switch (event.code) {
      case 'ArrowLeft':
        this.tryMove(-1, 0);
        break;
      case 'ArrowRight':
        this.tryMove(1, 0);
        break;
      case 'ArrowDown':
        this.softDropActive = true;
        if (!this.tryMove(0, 1)) {
          this.lockPiece();
        }
        break;
      case 'ArrowUp':
      case 'KeyX':
        this.tryRotate(1);
        break;
      case 'KeyZ':
        this.tryRotate(-1);
        break;
      case 'Space':
        this.hardDrop();
        break;
      default:
        return;
    }

    this.render();
  }

  onKeyUp(event) {
    if (event.code === 'ArrowDown') {
      this.softDropActive = false;
    }
  }

  getNextType() {
    if (this.bag.length === 0) {
      this.bag = shuffleInPlace([...PIECE_TYPES]);
    }
    return this.bag.pop();
  }

  spawnPiece() {
    const type = this.getNextType();
    const pieceDef = PIECES[type];
    const matrix = cloneMatrix(pieceDef.shape);
    const x = Math.floor((BOARD_COLS - matrix[0].length) / 2);
    const y = 0;

    this.activePiece = null;

    if (this.collides(matrix, x, y)) {
      this.state = 'gameover';
      this.saveProgressIfNeeded();
      return;
    }

    this.activePiece = {
      type,
      color: pieceDef.color,
      matrix,
      x,
      y,
    };
    // Prevent time carry-over from previous piece causing instant multi-cell fall.
    this.dropAccumulator = 0;
  }

  tryMove(deltaX, deltaY) {
    if (!this.activePiece) {
      return false;
    }

    const nextX = this.activePiece.x + deltaX;
    const nextY = this.activePiece.y + deltaY;

    if (this.collides(this.activePiece.matrix, nextX, nextY)) {
      return false;
    }

    this.activePiece.x = nextX;
    this.activePiece.y = nextY;
    return true;
  }

  tryRotate(direction) {
    if (!this.activePiece) {
      return;
    }

    const rotated =
      direction > 0
        ? rotateClockwise(this.activePiece.matrix)
        : rotateCounterClockwise(this.activePiece.matrix);

    const kicks = [0, -1, 1, -2, 2];
    for (const offsetX of kicks) {
      const nextX = this.activePiece.x + offsetX;
      if (!this.collides(rotated, nextX, this.activePiece.y)) {
        this.activePiece.matrix = rotated;
        this.activePiece.x = nextX;
        return;
      }
    }
  }

  hardDrop() {
    if (!this.activePiece) {
      return;
    }

    while (this.tryMove(0, 1)) {
      // Drop until collision.
    }

    this.lockPiece();
  }

  collides(matrix, offsetX, offsetY) {
    for (let y = 0; y < matrix.length; y += 1) {
      for (let x = 0; x < matrix[y].length; x += 1) {
        if (!matrix[y][x]) {
          continue;
        }

        const boardX = offsetX + x;
        const boardY = offsetY + y;

        if (boardX < 0 || boardX >= BOARD_COLS || boardY >= BOARD_TOTAL_ROWS) {
          return true;
        }

        if (boardY >= 0 && this.board[boardY][boardX]) {
          return true;
        }
      }
    }

    return false;
  }

  lockPiece() {
    if (!this.activePiece || this.state !== 'playing') {
      return;
    }

    for (let y = 0; y < this.activePiece.matrix.length; y += 1) {
      for (let x = 0; x < this.activePiece.matrix[y].length; x += 1) {
        if (!this.activePiece.matrix[y][x]) {
          continue;
        }

        const boardX = this.activePiece.x + x;
        const boardY = this.activePiece.y + y;

        if (boardY >= 0 && boardY < BOARD_TOTAL_ROWS && boardX >= 0 && boardX < BOARD_COLS) {
          this.board[boardY][boardX] = this.activePiece.color;
        }
      }
    }

    const cleared = this.clearFilledRows();
    if (cleared > 0) {
      this.lines += cleared;
      this.score += SCORE_TABLE[cleared] || 0;
      this.saveProgressIfNeeded();
    }

    this.spawnPiece();
    this.dropAccumulator = 0;
  }

  clearFilledRows() {
    let cleared = 0;

    for (let y = BOARD_TOTAL_ROWS - 1; y >= 0; y -= 1) {
      let full = true;
      for (let x = 0; x < BOARD_COLS; x += 1) {
        if (!this.board[y][x]) {
          full = false;
          break;
        }
      }

      if (!full) {
        continue;
      }

      this.board.splice(y, 1);
      this.board.unshift(Array(BOARD_COLS).fill(null));
      cleared += 1;
      y += 1;
    }

    return cleared;
  }

  render() {
    if (!this.ctx || !this.viewport) {
      return;
    }

    const { width, height } = this.viewport;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#0b1622';
    ctx.fillRect(0, 0, width, height);

    const layout = this.computeLayout(width, height);

    this.drawBoardFrame(layout);
    this.drawSettledBlocks(layout);
    this.drawActivePiece(layout);
    this.drawPanel(layout);

    if (this.state === 'paused') {
      this.drawOverlay(layout, 'Пауза', 'Нажмите P для продолжения');
    }

    if (this.state === 'gameover') {
      this.drawOverlay(layout, 'Game Over', 'Нажмите Enter или R для рестарта');
    }
  }

  computeLayout(width, height) {
    const padding = 18;
    const sideBySide = width >= 760;

    if (sideBySide) {
      const panelWidth = Math.max(180, Math.floor(width * 0.28));
      const maxBoardWidth = width - panelWidth - padding * 3;
      const maxBoardHeight = height - padding * 2;
      const cellSize = Math.max(
        12,
        Math.floor(Math.min(maxBoardWidth / BOARD_COLS, maxBoardHeight / BOARD_VISIBLE_ROWS))
      );

      const boardWidth = cellSize * BOARD_COLS;
      const boardHeight = cellSize * BOARD_VISIBLE_ROWS;
      const boardX = Math.max(padding, Math.floor((width - (boardWidth + panelWidth + padding)) / 2));
      const boardY = Math.max(padding, Math.floor((height - boardHeight) / 2));

      return {
        cellSize,
        boardX,
        boardY,
        boardWidth,
        boardHeight,
        panelX: boardX + boardWidth + padding,
        panelY: boardY,
        panelWidth,
      };
    }

    const panelHeight = 120;
    const maxBoardWidth = width - padding * 2;
    const maxBoardHeight = height - panelHeight - padding * 3;
    const cellSize = Math.max(
      10,
      Math.floor(Math.min(maxBoardWidth / BOARD_COLS, maxBoardHeight / BOARD_VISIBLE_ROWS))
    );

    const boardWidth = cellSize * BOARD_COLS;
    const boardHeight = cellSize * BOARD_VISIBLE_ROWS;
    const boardX = Math.floor((width - boardWidth) / 2);
    const boardY = padding;

    return {
      cellSize,
      boardX,
      boardY,
      boardWidth,
      boardHeight,
      panelX: padding,
      panelY: boardY + boardHeight + padding,
      panelWidth: width - padding * 2,
    };
  }

  drawBoardFrame(layout) {
    const ctx = this.ctx;
    ctx.fillStyle = '#09101b';
    ctx.fillRect(layout.boardX, layout.boardY, layout.boardWidth, layout.boardHeight);

    ctx.strokeStyle = 'rgba(147, 184, 208, 0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(layout.boardX + 0.5, layout.boardY + 0.5, layout.boardWidth - 1, layout.boardHeight - 1);

    ctx.strokeStyle = 'rgba(147, 184, 208, 0.12)';
    for (let x = 1; x < BOARD_COLS; x += 1) {
      const gx = layout.boardX + x * layout.cellSize + 0.5;
      ctx.beginPath();
      ctx.moveTo(gx, layout.boardY);
      ctx.lineTo(gx, layout.boardY + layout.boardHeight);
      ctx.stroke();
    }

    for (let y = 1; y < BOARD_VISIBLE_ROWS; y += 1) {
      const gy = layout.boardY + y * layout.cellSize + 0.5;
      ctx.beginPath();
      ctx.moveTo(layout.boardX, gy);
      ctx.lineTo(layout.boardX + layout.boardWidth, gy);
      ctx.stroke();
    }
  }

  drawSettledBlocks(layout) {
    for (let boardY = BOARD_HIDDEN_ROWS; boardY < BOARD_TOTAL_ROWS; boardY += 1) {
      for (let boardX = 0; boardX < BOARD_COLS; boardX += 1) {
        const color = this.board[boardY][boardX];
        if (!color) {
          continue;
        }

        this.drawCell(
          layout,
          boardX,
          boardY - BOARD_HIDDEN_ROWS,
          color
        );
      }
    }
  }

  drawActivePiece(layout) {
    if (!this.activePiece) {
      return;
    }

    for (let y = 0; y < this.activePiece.matrix.length; y += 1) {
      for (let x = 0; x < this.activePiece.matrix[y].length; x += 1) {
        if (!this.activePiece.matrix[y][x]) {
          continue;
        }

        const boardX = this.activePiece.x + x;
        const boardY = this.activePiece.y + y;

        if (boardY < BOARD_HIDDEN_ROWS) {
          continue;
        }

        this.drawCell(
          layout,
          boardX,
          boardY - BOARD_HIDDEN_ROWS,
          this.activePiece.color
        );
      }
    }
  }

  drawCell(layout, cellX, cellY, color) {
    const ctx = this.ctx;
    const x = layout.boardX + cellX * layout.cellSize;
    const y = layout.boardY + cellY * layout.cellSize;
    const size = layout.cellSize;

    ctx.fillStyle = color;
    ctx.fillRect(x + 1, y + 1, size - 2, size - 2);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.fillRect(x + 2, y + 2, size - 6, Math.max(3, Math.floor(size * 0.18)));
  }

  drawPanel(layout) {
    const ctx = this.ctx;
    const lineGap = 26;
    const textX = layout.panelX;
    let textY = layout.panelY + 28;

    ctx.fillStyle = '#d8e9f6';
    ctx.font = 'bold 22px "Trebuchet MS", sans-serif';
    ctx.fillText('TETRIS', textX, textY);

    textY += lineGap;
    ctx.fillStyle = '#9fb9cd';
    ctx.font = '16px "Trebuchet MS", sans-serif';
    ctx.fillText(`Score: ${this.score}`, textX, textY);

    textY += lineGap;
    ctx.fillText(`Lines: ${this.lines}`, textX, textY);

    textY += lineGap;
    ctx.fillText(`Best: ${this.bestScore}`, textX, textY);

    textY += lineGap + 12;
    ctx.fillStyle = '#7ea1b8';
    ctx.font = '14px "Trebuchet MS", sans-serif';
    ctx.fillText('Controls:', textX, textY);
    textY += 20;
    ctx.fillText('←/→ move, ↓ soft drop', textX, textY);
    textY += 20;
    ctx.fillText('Space hard drop, Z/X rotate', textX, textY);
    textY += 20;
    ctx.fillText('P pause, R restart', textX, textY);
  }

  drawOverlay(layout, title, subtitle) {
    const ctx = this.ctx;

    ctx.fillStyle = 'rgba(2, 6, 10, 0.72)';
    ctx.fillRect(layout.boardX, layout.boardY, layout.boardWidth, layout.boardHeight);

    const centerX = layout.boardX + layout.boardWidth / 2;
    const centerY = layout.boardY + layout.boardHeight / 2;

    ctx.fillStyle = '#f4f7fb';
    ctx.font = 'bold 30px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, centerX, centerY - 10);

    ctx.fillStyle = '#bbd0df';
    ctx.font = '16px "Trebuchet MS", sans-serif';
    ctx.fillText(subtitle, centerX, centerY + 22);
    ctx.textAlign = 'left';
  }
}

  ns.TetrisGame = TetrisGame;
})(window);
