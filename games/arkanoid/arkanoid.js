(function bootstrapArkanoid(global) {
  const ns = (global.Minigames = global.Minigames || {});
  const resizeCanvasToDisplaySize = ns.resizeCanvasToDisplaySize;
  const loadJSON = ns.loadJSON;
  const saveJSON = ns.saveJSON;
  const storageKey = ns.storageKey;

  if (!resizeCanvasToDisplaySize || !loadJSON || !saveJSON || !storageKey) {
    throw new Error('Arkanoid dependencies are missing. Load core scripts before arkanoid.js.');
  }

const FIELD_WIDTH = 800;
const FIELD_HEIGHT = 600;

const PADDLE_WIDTH = 120;
const PADDLE_HEIGHT = 16;
const PADDLE_SPEED = 520;

const BALL_RADIUS = 9;
const BALL_SPEED = 360;
const BALL_MAX_SPEED = 760;

const BRICK_ROWS = 6;
const BRICK_COLS = 10;
const BRICK_HEIGHT = 24;
const BRICK_GAP = 6;
const BRICK_TOP = 90;
const BRICK_SIDE_PADDING = 34;
const BRICK_SCORE = 100;

const START_LIVES = 3;

const PROGRESS_KEY = storageKey('arkanoid', 'progress');
const DEFAULT_PROGRESS = {
  version: 1,
  bestScore: 0,
};

const BRICK_COLORS = ['#ff8fa3', '#ffb86b', '#ffe66d', '#95d5b2', '#74c0fc', '#c8b6ff'];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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

function intersectsCircleRect(circleX, circleY, radius, rect) {
  const closestX = clamp(circleX, rect.x, rect.x + rect.w);
  const closestY = clamp(circleY, rect.y, rect.y + rect.h);
  const dx = circleX - closestX;
  const dy = circleY - closestY;
  return dx * dx + dy * dy <= radius * radius;
}

class ArkanoidGame {
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

    this.state = 'ready';
    this.score = 0;
    this.bestScore = 0;
    this.lives = START_LIVES;

    this.input = {
      left: false,
      right: false,
    };

    this.paddle = {
      x: 0,
      y: FIELD_HEIGHT - 44,
      w: PADDLE_WIDTH,
      h: PADDLE_HEIGHT,
    };

    this.ball = {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      radius: BALL_RADIUS,
    };

    this.bricks = [];

    this.boundFrame = this.frame.bind(this);
    this.boundKeyDown = this.onKeyDown.bind(this);
    this.boundKeyUp = this.onKeyUp.bind(this);
    this.boundResize = this.onResize.bind(this);
  }

  getName() {
    return 'arkanoid';
  }

  getTitle() {
    return 'Arkanoid';
  }

  run(canvas) {
    if (this.isRunning) {
      this.stop();
    }

    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    if (!this.ctx) {
      throw new Error('Arkanoid requires CanvasRenderingContext2D.');
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
    this.input.left = false;
    this.input.right = false;

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
    this.state = 'ready';
    this.score = 0;
    this.lives = START_LIVES;

    this.createBricks();

    this.paddle.w = PADDLE_WIDTH;
    this.paddle.h = PADDLE_HEIGHT;
    this.paddle.x = (FIELD_WIDTH - this.paddle.w) / 2;
    this.paddle.y = FIELD_HEIGHT - 44;

    this.attachBallToPaddle();
  }

  createBricks() {
    this.bricks = [];

    const totalGap = BRICK_GAP * (BRICK_COLS - 1);
    const availableWidth = FIELD_WIDTH - BRICK_SIDE_PADDING * 2 - totalGap;
    const brickWidth = Math.floor(availableWidth / BRICK_COLS);

    for (let row = 0; row < BRICK_ROWS; row += 1) {
      for (let col = 0; col < BRICK_COLS; col += 1) {
        const x = BRICK_SIDE_PADDING + col * (brickWidth + BRICK_GAP);
        const y = BRICK_TOP + row * (BRICK_HEIGHT + BRICK_GAP);
        this.bricks.push({
          x,
          y,
          w: brickWidth,
          h: BRICK_HEIGHT,
          color: BRICK_COLORS[row % BRICK_COLORS.length],
          alive: true,
        });
      }
    }
  }

  attachBallToPaddle() {
    this.ball.x = this.paddle.x + this.paddle.w / 2;
    this.ball.y = this.paddle.y - this.ball.radius - 1;
    this.ball.vx = 0;
    this.ball.vy = 0;
  }

  launchBall() {
    if (this.state !== 'ready') {
      return;
    }

    const angle = (Math.random() * 0.7 + 0.3) * (Math.random() > 0.5 ? 1 : -1);
    this.ball.vx = Math.sin(angle) * BALL_SPEED;
    this.ball.vy = -Math.cos(angle) * BALL_SPEED;
    this.state = 'playing';
  }

  onResize() {
    if (!this.canvas || !this.ctx) {
      return;
    }

    this.viewport = resizeCanvasToDisplaySize(this.canvas, this.ctx);

    this.scale = Math.min(
      this.viewport.width / FIELD_WIDTH,
      this.viewport.height / FIELD_HEIGHT
    );
    this.offsetX = Math.floor((this.viewport.width - FIELD_WIDTH * this.scale) / 2);
    this.offsetY = Math.floor((this.viewport.height - FIELD_HEIGHT * this.scale) / 2);

    this.render();
  }

  frame(timestamp) {
    if (!this.isRunning) {
      return;
    }

    const dt = Math.min(0.033, (timestamp - this.lastTimestamp) / 1000);
    this.lastTimestamp = timestamp;

    this.update(dt);
    this.render();

    this.animationFrameId = requestAnimationFrame(this.boundFrame);
  }

  update(dt) {
    if (this.state === 'paused' || this.state === 'won' || this.state === 'gameover') {
      return;
    }

    this.updatePaddle(dt);

    if (this.state === 'ready') {
      this.attachBallToPaddle();
      return;
    }

    this.updateBall(dt);
  }

  updatePaddle(dt) {
    let move = 0;
    if (this.input.left) {
      move -= 1;
    }
    if (this.input.right) {
      move += 1;
    }

    if (move === 0) {
      return;
    }

    this.paddle.x += move * PADDLE_SPEED * dt;
    this.paddle.x = clamp(this.paddle.x, 0, FIELD_WIDTH - this.paddle.w);
  }

  updateBall(dt) {
    const previousX = this.ball.x;
    const previousY = this.ball.y;

    this.ball.x += this.ball.vx * dt;
    this.ball.y += this.ball.vy * dt;

    if (this.ball.x - this.ball.radius <= 0) {
      this.ball.x = this.ball.radius;
      this.ball.vx = Math.abs(this.ball.vx);
    } else if (this.ball.x + this.ball.radius >= FIELD_WIDTH) {
      this.ball.x = FIELD_WIDTH - this.ball.radius;
      this.ball.vx = -Math.abs(this.ball.vx);
    }

    if (this.ball.y - this.ball.radius <= 0) {
      this.ball.y = this.ball.radius;
      this.ball.vy = Math.abs(this.ball.vy);
    }

    if (
      this.ball.vy > 0 &&
      this.ball.y + this.ball.radius >= this.paddle.y &&
      previousY + this.ball.radius <= this.paddle.y &&
      this.ball.x >= this.paddle.x - this.ball.radius &&
      this.ball.x <= this.paddle.x + this.paddle.w + this.ball.radius
    ) {
      this.ball.y = this.paddle.y - this.ball.radius - 0.01;

      const relative =
        (this.ball.x - (this.paddle.x + this.paddle.w / 2)) / (this.paddle.w / 2);
      const hit = clamp(relative, -1, 1);

      const currentSpeed = Math.min(
        BALL_MAX_SPEED,
        Math.hypot(this.ball.vx, this.ball.vy) * 1.03
      );

      this.ball.vx = currentSpeed * Math.sin(hit * (Math.PI / 3));
      this.ball.vy = -Math.abs(currentSpeed * Math.cos(hit * (Math.PI / 3)));
    }

    this.handleBrickCollisions(previousX, previousY);

    if (this.ball.y - this.ball.radius > FIELD_HEIGHT) {
      this.handleLostLife();
    }
  }

  handleBrickCollisions(previousX, previousY) {
    for (const brick of this.bricks) {
      if (!brick.alive) {
        continue;
      }

      if (!intersectsCircleRect(this.ball.x, this.ball.y, this.ball.radius, brick)) {
        continue;
      }

      brick.alive = false;
      this.score += BRICK_SCORE;
      this.saveProgressIfNeeded();

      const fromLeft = previousX + this.ball.radius <= brick.x;
      const fromRight = previousX - this.ball.radius >= brick.x + brick.w;

      if (fromLeft || fromRight) {
        this.ball.vx *= -1;
      } else {
        this.ball.vy *= -1;
      }

      if (this.bricks.every((item) => !item.alive)) {
        this.state = 'won';
        this.saveProgressIfNeeded();
      }
      return;
    }
  }

  handleLostLife() {
    this.lives -= 1;

    if (this.lives <= 0) {
      this.state = 'gameover';
      this.saveProgressIfNeeded();
      return;
    }

    this.state = 'ready';
    this.attachBallToPaddle();
  }

  onKeyDown(event) {
    if (!this.isRunning) {
      return;
    }

    if (['ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }

    if (event.code === 'KeyP') {
      if (this.state === 'playing') {
        this.state = 'paused';
      } else if (this.state === 'paused') {
        this.state = 'playing';
      }
      this.render();
      return;
    }

    if (event.code === 'KeyR') {
      this.resetGame();
      this.render();
      return;
    }

    if (this.state === 'won' || this.state === 'gameover') {
      if (event.code === 'Enter') {
        this.resetGame();
        this.render();
      }
      return;
    }

    switch (event.code) {
      case 'ArrowLeft':
      case 'KeyA':
        this.input.left = true;
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.input.right = true;
        break;
      case 'Space':
        this.launchBall();
        break;
      default:
        return;
    }
  }

  onKeyUp(event) {
    switch (event.code) {
      case 'ArrowLeft':
      case 'KeyA':
        this.input.left = false;
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.input.right = false;
        break;
      default:
        return;
    }
  }

  render() {
    if (!this.ctx || !this.viewport) {
      return;
    }

    const ctx = this.ctx;
    const width = this.viewport.width;
    const height = this.viewport.height;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#0a1420';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);

    this.drawField(ctx);
    this.drawBricks(ctx);
    this.drawPaddle(ctx);
    this.drawBall(ctx);
    this.drawHud(ctx);

    if (this.state === 'paused') {
      this.drawOverlay(ctx, 'Пауза', 'Нажмите P для продолжения');
    } else if (this.state === 'ready') {
      this.drawOverlay(ctx, 'Готово', 'Space: запуск мяча');
    } else if (this.state === 'won') {
      this.drawOverlay(ctx, 'Победа', 'Enter или R: новая игра');
    } else if (this.state === 'gameover') {
      this.drawOverlay(ctx, 'Game Over', 'Enter или R: рестарт');
    }

    ctx.restore();
  }

  drawField(ctx) {
    ctx.fillStyle = '#08111b';
    ctx.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);

    ctx.strokeStyle = 'rgba(170, 204, 230, 0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, FIELD_WIDTH - 2, FIELD_HEIGHT - 2);
  }

  drawBricks(ctx) {
    for (const brick of this.bricks) {
      if (!brick.alive) {
        continue;
      }

      ctx.fillStyle = brick.color;
      ctx.fillRect(brick.x, brick.y, brick.w, brick.h);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.fillRect(brick.x + 2, brick.y + 2, brick.w - 4, 5);
    }
  }

  drawPaddle(ctx) {
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(this.paddle.x, this.paddle.y, this.paddle.w, this.paddle.h);
  }

  drawBall(ctx) {
    ctx.beginPath();
    ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }

  drawHud(ctx) {
    ctx.fillStyle = '#d8e7f3';
    ctx.font = 'bold 20px "Trebuchet MS", sans-serif';
    ctx.fillText('ARKANOID', 24, 34);

    ctx.fillStyle = '#a3c0d7';
    ctx.font = '16px "Trebuchet MS", sans-serif';
    ctx.fillText(`Score: ${this.score}`, 24, 56);
    ctx.fillText(`Lives: ${this.lives}`, 170, 56);
    ctx.fillText(`Best: ${this.bestScore}`, 290, 56);

    ctx.fillStyle = '#7fa2bc';
    ctx.font = '14px "Trebuchet MS", sans-serif';
    ctx.fillText('←/→ or A/D move  |  Space launch  |  P pause  |  R restart', 24, FIELD_HEIGHT - 18);
  }

  drawOverlay(ctx, title, subtitle) {
    ctx.fillStyle = 'rgba(2, 7, 13, 0.56)';
    ctx.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);

    ctx.fillStyle = '#f2f6fb';
    ctx.textAlign = 'center';
    ctx.font = 'bold 40px "Trebuchet MS", sans-serif';
    ctx.fillText(title, FIELD_WIDTH / 2, FIELD_HEIGHT / 2 - 8);

    ctx.fillStyle = '#c3d7e6';
    ctx.font = '18px "Trebuchet MS", sans-serif';
    ctx.fillText(subtitle, FIELD_WIDTH / 2, FIELD_HEIGHT / 2 + 28);
    ctx.textAlign = 'left';
  }
}

  ns.ArkanoidGame = ArkanoidGame;
})(window);
