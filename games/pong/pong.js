(function bootstrapPong(global) {
  const ns = (global.Minigames = global.Minigames || {});
  const resizeCanvasToDisplaySize = ns.resizeCanvasToDisplaySize;
  const loadJSON = ns.loadJSON;
  const saveJSON = ns.saveJSON;
  const storageKey = ns.storageKey;

  if (!resizeCanvasToDisplaySize || !loadJSON || !saveJSON || !storageKey) {
    throw new Error('Pong dependencies are missing. Load core scripts before pong.js.');
  }

  const WIN_SCORE = 7;

  const PADDLE_WIDTH = 14;
  const PADDLE_HEIGHT = 108;
  const BALL_SIZE = 14;

  const PLAYER_SPEED = 520;
  const AI_MAX_SPEED = 300;
  const AI_REACTION_INTERVAL = 0.085;
  const AI_TRACKING_DEADZONE = 7;
  const AI_MISTAKE_BASE = 8;
  const AI_MISTAKE_FROM_BALL_SPEED = 0.032;

  const BALL_START_SPEED = 380;
  const BALL_SPEED_INCREASE = 1.05;
  const BALL_SPEED_MAX = 840;
  const BALL_MAX_VERTICAL = 510;

  const PROGRESS_KEY = storageKey('pong', 'progress');
  const DEFAULT_PROGRESS = {
    version: 1,
    bestScore: 0,
    matchesWon: 0,
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function normalizeProgress(data) {
    if (!data || typeof data !== 'object') {
      return { ...DEFAULT_PROGRESS };
    }

    const bestScore = Number.isFinite(data.bestScore) ? Math.max(0, Math.floor(data.bestScore)) : 0;
    const matchesWon = Number.isFinite(data.matchesWon) ? Math.max(0, Math.floor(data.matchesWon)) : 0;
    return {
      version: 1,
      bestScore,
      matchesWon,
    };
  }

  class PongGame {
    constructor() {
      this.canvas = null;
      this.ctx = null;

      this.viewport = { width: 1, height: 1, dpr: 1, resized: false };
      this.layout = {
        arenaX: 0,
        arenaY: 0,
        arenaWidth: 1,
        arenaHeight: 1,
        panelY: 0,
      };

      this.state = 'ready';
      this.playerScore = 0;
      this.aiScore = 0;
      this.bestScore = 0;
      this.matchesWon = 0;
      this.winner = '';

      this.leftPaddle = { x: 0, y: 0, width: PADDLE_WIDTH, height: PADDLE_HEIGHT };
      this.rightPaddle = { x: 0, y: 0, width: PADDLE_WIDTH, height: PADDLE_HEIGHT };
      this.ball = { x: 0, y: 0, size: BALL_SIZE, vx: 0, vy: 0 };
      this.serveDirection = 1;

      this.keys = { up: false, down: false };
      this.aiTargetY = 0;
      this.aiReactionTimer = 0;

      this.isRunning = false;
      this.animationFrameId = null;
      this.lastTimestamp = 0;

      this.boundFrame = this.frame.bind(this);
      this.boundKeyDown = this.onKeyDown.bind(this);
      this.boundKeyUp = this.onKeyUp.bind(this);
      this.boundResize = this.onResize.bind(this);
    }

    getName() {
      return 'pong';
    }

    getTitle() {
      return 'Pong';
    }

    run(canvas) {
      if (this.isRunning) {
        this.stop();
      }

      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      if (!this.ctx) {
        throw new Error('Pong requires CanvasRenderingContext2D.');
      }

      this.loadProgress();
      this.resetMatch();

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

      this.keys.up = false;
      this.keys.down = false;
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
      this.matchesWon = progress.matchesWon;
    }

    saveProgressIfNeeded() {
      saveJSON(PROGRESS_KEY, {
        version: 1,
        bestScore: this.bestScore,
        matchesWon: this.matchesWon,
      });
    }

    resetMatch() {
      this.state = 'ready';
      this.playerScore = 0;
      this.aiScore = 0;
      this.winner = '';
      this.serveDirection = Math.random() < 0.5 ? -1 : 1;
      this.resetPositions();
    }

    resetPositions() {
      const arenaCenterY = this.layout.arenaY + this.layout.arenaHeight * 0.5;
      this.leftPaddle.y = arenaCenterY - this.leftPaddle.height * 0.5;
      this.rightPaddle.y = arenaCenterY - this.rightPaddle.height * 0.5;
      this.aiTargetY = this.rightPaddle.y;
      this.aiReactionTimer = 0;
      this.resetBall(this.serveDirection);
    }

    resetBall(direction) {
      const centerX = this.layout.arenaX + this.layout.arenaWidth * 0.5;
      const centerY = this.layout.arenaY + this.layout.arenaHeight * 0.5;
      this.ball.x = centerX - this.ball.size * 0.5;
      this.ball.y = centerY - this.ball.size * 0.5;
      this.ball.vx = 0;
      this.ball.vy = 0;
      this.serveDirection = direction;
    }

    startServe() {
      const angle = Math.random() * 0.8 - 0.4;
      const speed = BALL_START_SPEED;
      this.ball.vx = Math.cos(angle) * speed * this.serveDirection;
      this.ball.vy = Math.sin(angle) * speed;
      this.state = 'playing';
    }

    onResize() {
      if (!this.canvas || !this.ctx) {
        return;
      }

      const hadLayout = this.layout.arenaWidth > 1 && this.layout.arenaHeight > 1;
      let leftRatio = 0.5;
      let rightRatio = 0.5;
      let ballXRatio = 0.5;
      let ballYRatio = 0.5;

      if (hadLayout) {
        leftRatio = (this.leftPaddle.y - this.layout.arenaY) / Math.max(1, this.layout.arenaHeight - this.leftPaddle.height);
        rightRatio = (this.rightPaddle.y - this.layout.arenaY) / Math.max(1, this.layout.arenaHeight - this.rightPaddle.height);
        ballXRatio = (this.ball.x + this.ball.size * 0.5 - this.layout.arenaX) / Math.max(1, this.layout.arenaWidth);
        ballYRatio = (this.ball.y + this.ball.size * 0.5 - this.layout.arenaY) / Math.max(1, this.layout.arenaHeight);
      }

      this.viewport = resizeCanvasToDisplaySize(this.canvas, this.ctx);
      this.layout = this.computeLayout(this.viewport.width, this.viewport.height);

      this.leftPaddle.x = this.layout.arenaX + 24;
      this.rightPaddle.x = this.layout.arenaX + this.layout.arenaWidth - 24 - this.rightPaddle.width;

      if (!hadLayout) {
        this.resetPositions();
      } else {
        this.leftPaddle.y = this.layout.arenaY + clamp(leftRatio, 0, 1) * Math.max(1, this.layout.arenaHeight - this.leftPaddle.height);
        this.rightPaddle.y = this.layout.arenaY + clamp(rightRatio, 0, 1) * Math.max(1, this.layout.arenaHeight - this.rightPaddle.height);

        const ballCenterX = this.layout.arenaX + clamp(ballXRatio, 0, 1) * this.layout.arenaWidth;
        const ballCenterY = this.layout.arenaY + clamp(ballYRatio, 0, 1) * this.layout.arenaHeight;
        this.ball.x = ballCenterX - this.ball.size * 0.5;
        this.ball.y = ballCenterY - this.ball.size * 0.5;
      }

      this.render();
    }

    computeLayout(width, height) {
      const pad = 16;
      const header = 84;

      const arenaX = pad;
      const arenaY = pad + header;
      const arenaWidth = Math.max(180, width - pad * 2);
      const arenaHeight = Math.max(180, height - arenaY - pad);

      return {
        arenaX,
        arenaY,
        arenaWidth,
        arenaHeight,
        panelY: pad,
      };
    }

    frame(timestamp) {
      if (!this.isRunning) {
        return;
      }

      const dt = Math.min(0.033, (timestamp - this.lastTimestamp) / 1000);
      this.lastTimestamp = timestamp;

      if (this.state === 'ready' || this.state === 'playing') {
        this.updatePlayer(dt);
        this.updateAI(dt);
      }
      if (this.state === 'playing') {
        this.updateBall(dt);
      }

      this.render();
      this.animationFrameId = requestAnimationFrame(this.boundFrame);
    }

    updatePlayer(dt) {
      let dir = 0;
      if (this.keys.up && !this.keys.down) {
        dir = -1;
      } else if (this.keys.down && !this.keys.up) {
        dir = 1;
      }

      if (dir !== 0) {
        this.leftPaddle.y += dir * PLAYER_SPEED * dt;
      }

      this.leftPaddle.y = clamp(
        this.leftPaddle.y,
        this.layout.arenaY,
        this.layout.arenaY + this.layout.arenaHeight - this.leftPaddle.height
      );
    }

    updateAI(dt) {
      this.aiReactionTimer -= dt;
      if (this.aiReactionTimer <= 0) {
        this.aiReactionTimer = AI_REACTION_INTERVAL;

        const centerTarget = this.layout.arenaY + this.layout.arenaHeight * 0.5 - this.rightPaddle.height * 0.5;
        if (this.ball.vx > 0) {
          const ballSpeed = Math.hypot(this.ball.vx, this.ball.vy);
          const inaccuracy = AI_MISTAKE_BASE + Math.max(0, ballSpeed - BALL_START_SPEED) * AI_MISTAKE_FROM_BALL_SPEED;
          const randomOffset = (Math.random() * 2 - 1) * inaccuracy;
          this.aiTargetY = this.ball.y + this.ball.size * 0.5 - this.rightPaddle.height * 0.5 + randomOffset;
        } else {
          this.aiTargetY = centerTarget;
        }
      }

      this.aiTargetY = clamp(
        this.aiTargetY,
        this.layout.arenaY,
        this.layout.arenaY + this.layout.arenaHeight - this.rightPaddle.height
      );

      const delta = this.aiTargetY - this.rightPaddle.y;
      const maxStep = AI_MAX_SPEED * dt;
      if (Math.abs(delta) > AI_TRACKING_DEADZONE) {
        this.rightPaddle.y += clamp(delta, -maxStep, maxStep);
      }

      this.rightPaddle.y = clamp(
        this.rightPaddle.y,
        this.layout.arenaY,
        this.layout.arenaY + this.layout.arenaHeight - this.rightPaddle.height
      );
    }

    updateBall(dt) {
      this.ball.x += this.ball.vx * dt;
      this.ball.y += this.ball.vy * dt;

      const top = this.layout.arenaY;
      const bottom = this.layout.arenaY + this.layout.arenaHeight;
      if (this.ball.y <= top) {
        this.ball.y = top;
        this.ball.vy = Math.abs(this.ball.vy);
      } else if (this.ball.y + this.ball.size >= bottom) {
        this.ball.y = bottom - this.ball.size;
        this.ball.vy = -Math.abs(this.ball.vy);
      }

      this.handlePaddleCollision(this.leftPaddle, true);
      this.handlePaddleCollision(this.rightPaddle, false);

      if (this.ball.x + this.ball.size < this.layout.arenaX) {
        this.onScore('ai');
      } else if (this.ball.x > this.layout.arenaX + this.layout.arenaWidth) {
        this.onScore('player');
      }
    }

    handlePaddleCollision(paddle, isLeft) {
      const ballLeft = this.ball.x;
      const ballRight = this.ball.x + this.ball.size;
      const ballTop = this.ball.y;
      const ballBottom = this.ball.y + this.ball.size;

      const paddleLeft = paddle.x;
      const paddleRight = paddle.x + paddle.width;
      const paddleTop = paddle.y;
      const paddleBottom = paddle.y + paddle.height;

      const overlaps = ballLeft < paddleRight && ballRight > paddleLeft && ballTop < paddleBottom && ballBottom > paddleTop;
      if (!overlaps) {
        return;
      }
      if (isLeft && this.ball.vx >= 0) {
        return;
      }
      if (!isLeft && this.ball.vx <= 0) {
        return;
      }

      const speed = clamp(Math.hypot(this.ball.vx, this.ball.vy) * BALL_SPEED_INCREASE, BALL_START_SPEED, BALL_SPEED_MAX);
      const paddleCenter = paddle.y + paddle.height * 0.5;
      const ballCenter = this.ball.y + this.ball.size * 0.5;
      const offset = clamp((ballCenter - paddleCenter) / (paddle.height * 0.5), -1, 1);

      this.ball.vx = (isLeft ? 1 : -1) * Math.max(220, speed * (1 - Math.abs(offset) * 0.22));
      this.ball.vy = clamp(offset * BALL_MAX_VERTICAL, -BALL_MAX_VERTICAL, BALL_MAX_VERTICAL);

      if (isLeft) {
        this.ball.x = paddleRight + 0.1;
      } else {
        this.ball.x = paddleLeft - this.ball.size - 0.1;
      }
    }

    onScore(side) {
      if (side === 'player') {
        this.playerScore += 1;
      } else {
        this.aiScore += 1;
      }

      if (this.playerScore > this.bestScore) {
        this.bestScore = this.playerScore;
      }

      if (this.playerScore >= WIN_SCORE || this.aiScore >= WIN_SCORE) {
        if (this.playerScore > this.aiScore) {
          this.winner = 'PLAYER';
          this.matchesWon += 1;
        } else {
          this.winner = 'AI';
        }
        this.state = 'gameover';
        this.saveProgressIfNeeded();
        return;
      }

      this.serveDirection = side === 'player' ? 1 : -1;
      this.state = 'ready';
      this.resetBall(this.serveDirection);
      this.saveProgressIfNeeded();
    }

    onKeyDown(event) {
      if (['ArrowUp', 'ArrowDown', 'Space'].includes(event.code)) {
        event.preventDefault();
      }
      if (!this.isRunning) {
        return;
      }

      if (event.code === 'KeyW' || event.code === 'ArrowUp') {
        this.keys.up = true;
      } else if (event.code === 'KeyS' || event.code === 'ArrowDown') {
        this.keys.down = true;
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
        this.resetMatch();
        return;
      }

      if ((event.code === 'Space' || event.code === 'Enter') && this.state === 'ready') {
        this.startServe();
        this.lastTimestamp = performance.now();
        return;
      }

      if (this.state === 'gameover' && event.code === 'Enter') {
        this.resetMatch();
      }
    }

    onKeyUp(event) {
      if (!this.isRunning) {
        return;
      }

      if (event.code === 'KeyW' || event.code === 'ArrowUp') {
        this.keys.up = false;
      } else if (event.code === 'KeyS' || event.code === 'ArrowDown') {
        this.keys.down = false;
      }
    }

    render() {
      if (!this.ctx) {
        return;
      }

      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.viewport.width, this.viewport.height);
      ctx.fillStyle = '#0a121f';
      ctx.fillRect(0, 0, this.viewport.width, this.viewport.height);

      this.drawArena();
      this.drawHud();

      if (this.state === 'ready') {
        this.drawOverlay('READY', 'Press Space or Enter to serve');
      } else if (this.state === 'paused') {
        this.drawOverlay('PAUSED', 'Press P to continue');
      } else if (this.state === 'gameover') {
        this.drawOverlay(`GAME OVER (${this.winner})`, 'Press Enter or R to restart');
      }
    }

    drawArena() {
      const ctx = this.ctx;
      const { arenaX, arenaY, arenaWidth, arenaHeight } = this.layout;

      ctx.fillStyle = '#081019';
      ctx.fillRect(arenaX, arenaY, arenaWidth, arenaHeight);

      ctx.strokeStyle = 'rgba(186, 213, 245, 0.18)';
      ctx.lineWidth = 2;
      ctx.strokeRect(arenaX + 1, arenaY + 1, arenaWidth - 2, arenaHeight - 2);

      const midX = arenaX + arenaWidth * 0.5;
      ctx.strokeStyle = 'rgba(190, 214, 240, 0.28)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 12]);
      ctx.beginPath();
      ctx.moveTo(midX, arenaY + 10);
      ctx.lineTo(midX, arenaY + arenaHeight - 10);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#8ed5ff';
      ctx.fillRect(this.leftPaddle.x, this.leftPaddle.y, this.leftPaddle.width, this.leftPaddle.height);
      ctx.fillStyle = '#ffb880';
      ctx.fillRect(this.rightPaddle.x, this.rightPaddle.y, this.rightPaddle.width, this.rightPaddle.height);

      ctx.fillStyle = '#f2f8ff';
      ctx.fillRect(this.ball.x, this.ball.y, this.ball.size, this.ball.size);
    }

    drawHud() {
      const ctx = this.ctx;
      const centerX = this.viewport.width * 0.5;
      const y = this.layout.panelY + 44;

      ctx.fillStyle = '#e4f1ff';
      ctx.textAlign = 'center';
      ctx.font = 'bold 38px "Trebuchet MS", sans-serif';
      ctx.fillText(`${this.playerScore} : ${this.aiScore}`, centerX, y);

      ctx.font = '14px "Trebuchet MS", sans-serif';
      ctx.fillStyle = '#9fc0db';
      ctx.fillText(`Best score: ${this.bestScore}  |  Matches won: ${this.matchesWon}`, centerX, y + 26);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#8eb2cf';
      ctx.fillText('W/S or Arrows - move', this.layout.arenaX, this.layout.panelY + 18);
      ctx.fillText('Space/Enter - serve   P - pause   R - restart', this.layout.arenaX, this.layout.panelY + 36);
    }

    drawOverlay(title, subtitle) {
      const ctx = this.ctx;
      const { arenaX, arenaY, arenaWidth, arenaHeight } = this.layout;

      ctx.fillStyle = 'rgba(3, 8, 16, 0.6)';
      ctx.fillRect(arenaX, arenaY, arenaWidth, arenaHeight);

      const cx = arenaX + arenaWidth * 0.5;
      const cy = arenaY + arenaHeight * 0.5;

      ctx.textAlign = 'center';
      ctx.fillStyle = '#f0f7ff';
      ctx.font = 'bold 34px "Trebuchet MS", sans-serif';
      ctx.fillText(title, cx, cy - 12);

      ctx.fillStyle = '#bad2e8';
      ctx.font = '16px "Trebuchet MS", sans-serif';
      ctx.fillText(subtitle, cx, cy + 20);
      ctx.textAlign = 'left';
    }
  }

  ns.PongGame = PongGame;
})(window);
