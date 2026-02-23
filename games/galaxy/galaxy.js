(function bootstrapGalaxy(global) {
  const ns = (global.Minigames = global.Minigames || {});
  const resizeCanvasToDisplaySize = ns.resizeCanvasToDisplaySize;
  const loadJSON = ns.loadJSON;
  const saveJSON = ns.saveJSON;
  const storageKey = ns.storageKey;

  if (!resizeCanvasToDisplaySize || !loadJSON || !saveJSON || !storageKey) {
    throw new Error('Galaxy dependencies are missing. Load core scripts before galaxy.js.');
  }

  const WORLD_WIDTH = 960;
  const WORLD_HEIGHT = 640;

  const PLAYER_WIDTH = 72;
  const PLAYER_HEIGHT = 24;
  const PLAYER_SPEED = 460;
  const PLAYER_COOLDOWN_MS = 220;

  const PLAYER_BULLET_SPEED = 620;
  const ENEMY_BULLET_SPEED = 270;

  const START_LIVES = 3;
  const SCORE_PER_ALIEN = 100;

  const ALIEN_ROWS = 5;
  const ALIEN_COLS = 10;
  const ALIEN_WIDTH = 42;
  const ALIEN_HEIGHT = 26;
  const ALIEN_GAP_X = 18;
  const ALIEN_GAP_Y = 14;

  const ALIEN_START_X = 110;
  const ALIEN_START_Y = 92;
  const ALIEN_DESCEND_STEP = 22;

  const PROGRESS_KEY = storageKey('galaxy', 'progress');
  const DEFAULT_PROGRESS = {
    version: 1,
    bestScore: 0,
  };

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

  function randomInt(max) {
    return Math.floor(Math.random() * max);
  }

  class GalaxyGame {
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

      this.state = 'playing';
      this.score = 0;
      this.bestScore = 0;
      this.lives = START_LIVES;
      this.wave = 1;

      this.player = {
        x: (WORLD_WIDTH - PLAYER_WIDTH) / 2,
        y: WORLD_HEIGHT - 56,
        w: PLAYER_WIDTH,
        h: PLAYER_HEIGHT,
      };

      this.playerCooldownMs = 0;
      this.playerBullets = [];
      this.enemyBullets = [];

      this.aliens = [];
      this.alienDirection = 1;
      this.alienMoveSpeed = 56;
      this.enemyFireAccumulator = 0;
      this.enemyFireIntervalMs = 980;

      this.stars = [];

      this.input = {
        left: false,
        right: false,
        shoot: false,
      };

      this.boundFrame = this.frame.bind(this);
      this.boundKeyDown = this.onKeyDown.bind(this);
      this.boundKeyUp = this.onKeyUp.bind(this);
      this.boundResize = this.onResize.bind(this);
    }

    getName() {
      return 'galaxy';
    }

    getTitle() {
      return 'Galaxy';
    }

    run(canvas) {
      if (this.isRunning) {
        this.stop();
      }

      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      if (!this.ctx) {
        throw new Error('Galaxy requires CanvasRenderingContext2D.');
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
      this.input.shoot = false;

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
      this.state = 'playing';
      this.score = 0;
      this.lives = START_LIVES;
      this.wave = 1;

      this.player.x = (WORLD_WIDTH - PLAYER_WIDTH) / 2;
      this.player.y = WORLD_HEIGHT - 56;

      this.playerCooldownMs = 0;
      this.playerBullets = [];
      this.enemyBullets = [];

      this.createStars();
      this.spawnWave();
      this.saveProgressIfNeeded();
    }

    createStars() {
      this.stars = [];
      for (let i = 0; i < 80; i += 1) {
        this.stars.push({
          x: Math.random() * WORLD_WIDTH,
          y: Math.random() * WORLD_HEIGHT,
          size: Math.random() * 1.8 + 0.5,
          alpha: Math.random() * 0.7 + 0.25,
        });
      }
    }

    spawnWave() {
      this.aliens = [];
      this.playerBullets = [];
      this.enemyBullets = [];

      this.alienDirection = 1;
      this.alienMoveSpeed = 56 + (this.wave - 1) * 12;
      this.enemyFireIntervalMs = Math.max(260, 980 - (this.wave - 1) * 80);
      this.enemyFireAccumulator = 0;

      for (let row = 0; row < ALIEN_ROWS; row += 1) {
        for (let col = 0; col < ALIEN_COLS; col += 1) {
          this.aliens.push({
            x: ALIEN_START_X + col * (ALIEN_WIDTH + ALIEN_GAP_X),
            y: ALIEN_START_Y + row * (ALIEN_HEIGHT + ALIEN_GAP_Y),
            w: ALIEN_WIDTH,
            h: ALIEN_HEIGHT,
            alive: true,
          });
        }
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

      const dt = Math.min(0.05, (timestamp - this.lastTimestamp) / 1000);
      this.lastTimestamp = timestamp;

      if (this.state === 'playing') {
        this.update(dt);
      }

      this.render();
      this.animationFrameId = requestAnimationFrame(this.boundFrame);
    }

    update(dt) {
      this.updatePlayer(dt);
      this.updateBullets(dt);
      this.updateAliens(dt);
      this.handlePlayerBulletHits();
      this.handleEnemyBulletHits();
      this.handleEnemyFire(dt);
      this.checkWaveState();
    }

    updatePlayer(dt) {
      let move = 0;
      if (this.input.left) {
        move -= 1;
      }
      if (this.input.right) {
        move += 1;
      }

      this.player.x += move * PLAYER_SPEED * dt;
      this.player.x = clamp(this.player.x, 0, WORLD_WIDTH - this.player.w);

      this.playerCooldownMs = Math.max(0, this.playerCooldownMs - dt * 1000);
      if (this.input.shoot && this.playerCooldownMs <= 0) {
        this.firePlayerBullet();
      }
    }

    firePlayerBullet() {
      this.playerBullets.push({
        x: this.player.x + this.player.w / 2,
        y: this.player.y - 8,
        w: 4,
        h: 14,
      });
      this.playerCooldownMs = PLAYER_COOLDOWN_MS;
    }

    updateBullets(dt) {
      for (let i = this.playerBullets.length - 1; i >= 0; i -= 1) {
        const bullet = this.playerBullets[i];
        bullet.y -= PLAYER_BULLET_SPEED * dt;
        if (bullet.y + bullet.h < 0) {
          this.playerBullets.splice(i, 1);
        }
      }

      for (let i = this.enemyBullets.length - 1; i >= 0; i -= 1) {
        const bullet = this.enemyBullets[i];
        bullet.y += ENEMY_BULLET_SPEED * dt;
        if (bullet.y > WORLD_HEIGHT + bullet.h) {
          this.enemyBullets.splice(i, 1);
        }
      }
    }

    updateAliens(dt) {
      let minX = Infinity;
      let maxX = -Infinity;

      for (let i = 0; i < this.aliens.length; i += 1) {
        const alien = this.aliens[i];
        if (!alien.alive) {
          continue;
        }
        minX = Math.min(minX, alien.x);
        maxX = Math.max(maxX, alien.x + alien.w);
      }

      if (!Number.isFinite(minX)) {
        return;
      }

      const canMove =
        this.alienDirection > 0
          ? maxX + this.alienMoveSpeed * dt <= WORLD_WIDTH - 8
          : minX - this.alienMoveSpeed * dt >= 8;

      if (canMove) {
        const shift = this.alienDirection * this.alienMoveSpeed * dt;
        for (let i = 0; i < this.aliens.length; i += 1) {
          if (this.aliens[i].alive) {
            this.aliens[i].x += shift;
          }
        }
      } else {
        this.alienDirection *= -1;
        for (let i = 0; i < this.aliens.length; i += 1) {
          if (this.aliens[i].alive) {
            this.aliens[i].y += ALIEN_DESCEND_STEP;
          }
        }
      }

      for (let i = 0; i < this.aliens.length; i += 1) {
        const alien = this.aliens[i];
        if (!alien.alive) {
          continue;
        }
        if (alien.y + alien.h >= this.player.y - 8) {
          this.state = 'gameover';
          this.saveProgressIfNeeded();
          return;
        }
      }
    }

    handlePlayerBulletHits() {
      for (let i = this.playerBullets.length - 1; i >= 0; i -= 1) {
        const bullet = this.playerBullets[i];
        let consumed = false;

        for (let j = 0; j < this.aliens.length; j += 1) {
          const alien = this.aliens[j];
          if (!alien.alive) {
            continue;
          }

          if (
            bullet.x < alien.x + alien.w &&
            bullet.x + bullet.w > alien.x &&
            bullet.y < alien.y + alien.h &&
            bullet.y + bullet.h > alien.y
          ) {
            alien.alive = false;
            this.playerBullets.splice(i, 1);
            consumed = true;

            this.score += SCORE_PER_ALIEN;
            this.saveProgressIfNeeded();
            break;
          }
        }

        if (consumed) {
          continue;
        }
      }
    }

    handleEnemyFire(dt) {
      this.enemyFireAccumulator += dt * 1000;
      if (this.enemyFireAccumulator < this.enemyFireIntervalMs) {
        return;
      }
      this.enemyFireAccumulator = 0;

      const shooters = this.getBottomAliens();
      if (shooters.length === 0) {
        return;
      }

      const shooter = shooters[randomInt(shooters.length)];
      this.enemyBullets.push({
        x: shooter.x + shooter.w / 2 - 2,
        y: shooter.y + shooter.h + 2,
        w: 4,
        h: 14,
      });
    }

    getBottomAliens() {
      const byColumn = new Map();

      for (let i = 0; i < this.aliens.length; i += 1) {
        const alien = this.aliens[i];
        if (!alien.alive) {
          continue;
        }

        const col = Math.round((alien.x - ALIEN_START_X) / (ALIEN_WIDTH + ALIEN_GAP_X));
        const existing = byColumn.get(col);
        if (!existing || alien.y > existing.y) {
          byColumn.set(col, alien);
        }
      }

      return Array.from(byColumn.values());
    }

    handleEnemyBulletHits() {
      for (let i = this.enemyBullets.length - 1; i >= 0; i -= 1) {
        const bullet = this.enemyBullets[i];

        if (
          bullet.x < this.player.x + this.player.w &&
          bullet.x + bullet.w > this.player.x &&
          bullet.y < this.player.y + this.player.h &&
          bullet.y + bullet.h > this.player.y
        ) {
          this.enemyBullets.splice(i, 1);
          this.damagePlayer();
          break;
        }
      }
    }

    damagePlayer() {
      this.lives -= 1;
      if (this.lives <= 0) {
        this.lives = 0;
        this.state = 'gameover';
        this.saveProgressIfNeeded();
        return;
      }

      this.player.x = (WORLD_WIDTH - this.player.w) / 2;
      this.playerBullets = [];
      this.enemyBullets = [];
    }

    checkWaveState() {
      let aliveCount = 0;
      for (let i = 0; i < this.aliens.length; i += 1) {
        if (this.aliens[i].alive) {
          aliveCount += 1;
        }
      }

      if (aliveCount === 0 && this.state === 'playing') {
        this.wave += 1;
        this.spawnWave();
      }
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
          this.lastTimestamp = performance.now();
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
          this.input.shoot = true;
          if (this.playerCooldownMs <= 0) {
            this.firePlayerBullet();
          }
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
        case 'Space':
          this.input.shoot = false;
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
      ctx.clearRect(0, 0, this.viewport.width, this.viewport.height);
      ctx.fillStyle = '#07101a';
      ctx.fillRect(0, 0, this.viewport.width, this.viewport.height);

      ctx.save();
      ctx.translate(this.offsetX, this.offsetY);
      ctx.scale(this.scale, this.scale);

      this.drawBackground(ctx);
      this.drawAliens(ctx);
      this.drawBullets(ctx);
      this.drawPlayer(ctx);
      this.drawHud(ctx);

      if (this.state === 'paused') {
        this.drawOverlay(ctx, 'Pause', 'Press P to continue');
      } else if (this.state === 'gameover') {
        this.drawOverlay(ctx, 'Game Over', 'Press Enter or R to restart');
      }

      ctx.restore();
    }

    drawBackground(ctx) {
      ctx.fillStyle = '#060f17';
      ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

      for (let i = 0; i < this.stars.length; i += 1) {
        const star = this.stars[i];
        ctx.globalAlpha = star.alpha;
        ctx.fillStyle = '#dde8f9';
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      ctx.strokeStyle = 'rgba(154, 188, 217, 0.3)';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, WORLD_WIDTH - 2, WORLD_HEIGHT - 2);

      ctx.strokeStyle = 'rgba(129, 160, 189, 0.22)';
      ctx.beginPath();
      ctx.moveTo(0, this.player.y + this.player.h + 6);
      ctx.lineTo(WORLD_WIDTH, this.player.y + this.player.h + 6);
      ctx.stroke();
    }

    drawPlayer(ctx) {
      ctx.fillStyle = '#7fc7ff';
      ctx.fillRect(this.player.x, this.player.y + 8, this.player.w, this.player.h - 8);

      ctx.fillStyle = '#bde5ff';
      ctx.beginPath();
      ctx.moveTo(this.player.x + this.player.w / 2, this.player.y - 8);
      ctx.lineTo(this.player.x + this.player.w - 8, this.player.y + 8);
      ctx.lineTo(this.player.x + 8, this.player.y + 8);
      ctx.closePath();
      ctx.fill();
    }

    drawAliens(ctx) {
      for (let i = 0; i < this.aliens.length; i += 1) {
        const alien = this.aliens[i];
        if (!alien.alive) {
          continue;
        }

        ctx.fillStyle = '#ff98c0';
        ctx.fillRect(alien.x, alien.y, alien.w, alien.h);

        ctx.fillStyle = '#3a1230';
        ctx.fillRect(alien.x + 8, alien.y + 8, 7, 7);
        ctx.fillRect(alien.x + alien.w - 15, alien.y + 8, 7, 7);
      }
    }

    drawBullets(ctx) {
      ctx.fillStyle = '#e8f6ff';
      for (let i = 0; i < this.playerBullets.length; i += 1) {
        const bullet = this.playerBullets[i];
        ctx.fillRect(bullet.x, bullet.y, bullet.w, bullet.h);
      }

      ctx.fillStyle = '#ffcf84';
      for (let i = 0; i < this.enemyBullets.length; i += 1) {
        const bullet = this.enemyBullets[i];
        ctx.fillRect(bullet.x, bullet.y, bullet.w, bullet.h);
      }
    }

    drawHud(ctx) {
      ctx.fillStyle = '#d7e7f8';
      ctx.font = 'bold 24px "Trebuchet MS", sans-serif';
      ctx.fillText('GALAXY', 22, 36);

      ctx.fillStyle = '#9dbad4';
      ctx.font = '16px "Trebuchet MS", sans-serif';
      ctx.fillText(`Score: ${this.score}`, 22, 62);
      ctx.fillText(`Best: ${this.bestScore}`, 160, 62);
      ctx.fillText(`Lives: ${this.lives}`, 298, 62);
      ctx.fillText(`Wave: ${this.wave}`, 412, 62);

      ctx.fillStyle = '#7797b4';
      ctx.font = '14px "Trebuchet MS", sans-serif';
      ctx.fillText('A/D or Left/Right move, Space shoot, P pause, R restart', 22, WORLD_HEIGHT - 18);
    }

    drawOverlay(ctx, title, subtitle) {
      ctx.fillStyle = 'rgba(2, 7, 12, 0.68)';
      ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

      ctx.fillStyle = '#edf5ff';
      ctx.textAlign = 'center';
      ctx.font = 'bold 44px "Trebuchet MS", sans-serif';
      ctx.fillText(title, WORLD_WIDTH / 2, WORLD_HEIGHT / 2 - 10);

      ctx.fillStyle = '#c1d6e8';
      ctx.font = '18px "Trebuchet MS", sans-serif';
      ctx.fillText(subtitle, WORLD_WIDTH / 2, WORLD_HEIGHT / 2 + 26);
      ctx.textAlign = 'left';
    }
  }

  ns.GalaxyGame = GalaxyGame;
})(window);
