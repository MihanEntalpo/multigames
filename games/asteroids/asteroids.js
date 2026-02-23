(function bootstrapAsteroids(global) {
  const ns = (global.Minigames = global.Minigames || {});
  const resizeCanvasToDisplaySize = ns.resizeCanvasToDisplaySize;
  const loadJSON = ns.loadJSON;
  const saveJSON = ns.saveJSON;
  const storageKey = ns.storageKey;

  if (!resizeCanvasToDisplaySize || !loadJSON || !saveJSON || !storageKey) {
    throw new Error('Asteroids dependencies are missing. Load core scripts before asteroids.js.');
  }

  const WORLD_WIDTH = 960;
  const WORLD_HEIGHT = 640;

  const SHIP_RADIUS = 14;
  const SHIP_ROT_SPEED = 3.8;
  const SHIP_THRUST = 340;
  const SHIP_FRICTION = 0.985;
  const SHIP_MAX_SPEED = 460;
  const SHIP_INVULN_MS = 2200;

  const BULLET_SPEED = 620;
  const BULLET_LIFE_MS = 1200;
  const SHOOT_COOLDOWN_MS = 160;

  const START_LIVES = 3;
  const ASTEROID_BASE_COUNT = 4;

  const ASTEROID_RADII = {
    3: 52,
    2: 32,
    1: 19,
  };

  const SCORE_BY_SIZE = {
    3: 20,
    2: 50,
    1: 100,
  };

  const PROGRESS_KEY = storageKey('asteroids', 'progress');
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

  function wrapAxis(value, limit) {
    if (value < 0) {
      return value + limit;
    }
    if (value >= limit) {
      return value - limit;
    }
    return value;
  }

  function distanceSquared(ax, ay, bx, by) {
    const dx = ax - bx;
    const dy = ay - by;
    return dx * dx + dy * dy;
  }

  function randomRange(min, max) {
    return min + Math.random() * (max - min);
  }

  class AsteroidsGame {
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

      this.ship = {
        x: WORLD_WIDTH / 2,
        y: WORLD_HEIGHT / 2,
        vx: 0,
        vy: 0,
        angle: -Math.PI / 2,
        radius: SHIP_RADIUS,
        invulnerableMs: 0,
      };

      this.asteroids = [];
      this.bullets = [];
      this.stars = [];

      this.shootCooldownMs = 0;

      this.input = {
        left: false,
        right: false,
        thrust: false,
        shoot: false,
      };

      this.boundFrame = this.frame.bind(this);
      this.boundKeyDown = this.onKeyDown.bind(this);
      this.boundKeyUp = this.onKeyUp.bind(this);
      this.boundResize = this.onResize.bind(this);
    }

    getName() {
      return 'asteroids';
    }

    getTitle() {
      return 'Asteroids';
    }

    run(canvas) {
      if (this.isRunning) {
        this.stop();
      }

      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      if (!this.ctx) {
        throw new Error('Asteroids requires CanvasRenderingContext2D.');
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
      this.input.thrust = false;
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
      this.bullets = [];
      this.shootCooldownMs = 0;

      this.createStars();
      this.resetShip(true);
      this.spawnWave();
      this.saveProgressIfNeeded();
    }

    createStars() {
      this.stars = [];
      for (let i = 0; i < 90; i += 1) {
        this.stars.push({
          x: Math.random() * WORLD_WIDTH,
          y: Math.random() * WORLD_HEIGHT,
          r: randomRange(0.7, 2.2),
          a: randomRange(0.25, 0.9),
        });
      }
    }

    resetShip(centered) {
      this.ship.x = centered ? WORLD_WIDTH / 2 : this.ship.x;
      this.ship.y = centered ? WORLD_HEIGHT / 2 : this.ship.y;
      this.ship.vx = 0;
      this.ship.vy = 0;
      this.ship.angle = -Math.PI / 2;
      this.ship.invulnerableMs = SHIP_INVULN_MS;
    }

    spawnWave() {
      const asteroidCount = ASTEROID_BASE_COUNT + (this.wave - 1);
      this.asteroids = [];
      this.bullets = [];

      const safeRadius = 140;

      for (let i = 0; i < asteroidCount; i += 1) {
        let x = 0;
        let y = 0;

        do {
          x = Math.random() * WORLD_WIDTH;
          y = Math.random() * WORLD_HEIGHT;
        } while (distanceSquared(x, y, this.ship.x, this.ship.y) < safeRadius * safeRadius);

        this.asteroids.push(this.createAsteroid(3, x, y));
      }
    }

    createAsteroid(size, x, y) {
      const radius = ASTEROID_RADII[size];
      const speed = randomRange(28, 75) * (1 + (4 - size) * 0.25);
      const angle = Math.random() * Math.PI * 2;

      return {
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size,
        radius,
        rotation: randomRange(-0.8, 0.8),
        heading: Math.random() * Math.PI * 2,
        roughness: [
          randomRange(0.78, 1.22),
          randomRange(0.78, 1.22),
          randomRange(0.78, 1.22),
          randomRange(0.78, 1.22),
          randomRange(0.78, 1.22),
          randomRange(0.78, 1.22),
          randomRange(0.78, 1.22),
        ],
      };
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
      this.updateShip(dt);
      this.updateBullets(dt);
      this.updateAsteroids(dt);
      this.handleBulletAsteroidCollisions();
      this.handleShipAsteroidCollision();

      this.shootCooldownMs = Math.max(0, this.shootCooldownMs - dt * 1000);
      if (this.input.shoot && this.shootCooldownMs <= 0) {
        this.fireBullet();
      }

      if (this.ship.invulnerableMs > 0) {
        this.ship.invulnerableMs = Math.max(0, this.ship.invulnerableMs - dt * 1000);
      }

      if (this.asteroids.length === 0 && this.state === 'playing') {
        this.wave += 1;
        this.spawnWave();
        this.resetShip(true);
      }
    }

    updateShip(dt) {
      if (this.input.left) {
        this.ship.angle -= SHIP_ROT_SPEED * dt;
      }
      if (this.input.right) {
        this.ship.angle += SHIP_ROT_SPEED * dt;
      }

      if (this.input.thrust) {
        this.ship.vx += Math.cos(this.ship.angle) * SHIP_THRUST * dt;
        this.ship.vy += Math.sin(this.ship.angle) * SHIP_THRUST * dt;
      }

      const frictionFactor = Math.pow(SHIP_FRICTION, dt * 60);
      this.ship.vx *= frictionFactor;
      this.ship.vy *= frictionFactor;

      const speed = Math.hypot(this.ship.vx, this.ship.vy);
      if (speed > SHIP_MAX_SPEED) {
        const scale = SHIP_MAX_SPEED / speed;
        this.ship.vx *= scale;
        this.ship.vy *= scale;
      }

      this.ship.x += this.ship.vx * dt;
      this.ship.y += this.ship.vy * dt;

      this.ship.x = wrapAxis(this.ship.x, WORLD_WIDTH);
      this.ship.y = wrapAxis(this.ship.y, WORLD_HEIGHT);
    }

    updateBullets(dt) {
      for (let i = this.bullets.length - 1; i >= 0; i -= 1) {
        const bullet = this.bullets[i];
        bullet.lifeMs -= dt * 1000;

        if (bullet.lifeMs <= 0) {
          this.bullets.splice(i, 1);
          continue;
        }

        bullet.x += bullet.vx * dt;
        bullet.y += bullet.vy * dt;
        bullet.x = wrapAxis(bullet.x, WORLD_WIDTH);
        bullet.y = wrapAxis(bullet.y, WORLD_HEIGHT);
      }
    }

    updateAsteroids(dt) {
      for (let i = 0; i < this.asteroids.length; i += 1) {
        const asteroid = this.asteroids[i];
        asteroid.x += asteroid.vx * dt;
        asteroid.y += asteroid.vy * dt;
        asteroid.x = wrapAxis(asteroid.x, WORLD_WIDTH);
        asteroid.y = wrapAxis(asteroid.y, WORLD_HEIGHT);
        asteroid.heading += asteroid.rotation * dt;
      }
    }

    handleBulletAsteroidCollisions() {
      for (let i = this.bullets.length - 1; i >= 0; i -= 1) {
        const bullet = this.bullets[i];
        let hit = false;

        for (let j = this.asteroids.length - 1; j >= 0; j -= 1) {
          const asteroid = this.asteroids[j];
          const rr = asteroid.radius + 2;
          if (distanceSquared(bullet.x, bullet.y, asteroid.x, asteroid.y) > rr * rr) {
            continue;
          }

          this.bullets.splice(i, 1);
          this.destroyAsteroid(j);
          hit = true;
          break;
        }

        if (hit) {
          continue;
        }
      }
    }

    destroyAsteroid(index) {
      const asteroid = this.asteroids[index];
      if (!asteroid) {
        return;
      }

      this.asteroids.splice(index, 1);

      this.score += SCORE_BY_SIZE[asteroid.size] || 0;
      this.saveProgressIfNeeded();

      if (asteroid.size <= 1) {
        return;
      }

      for (let k = 0; k < 2; k += 1) {
        const child = this.createAsteroid(
          asteroid.size - 1,
          asteroid.x + randomRange(-6, 6),
          asteroid.y + randomRange(-6, 6)
        );

        child.vx += asteroid.vx * 0.2;
        child.vy += asteroid.vy * 0.2;
        this.asteroids.push(child);
      }
    }

    handleShipAsteroidCollision() {
      if (this.ship.invulnerableMs > 0) {
        return;
      }

      for (let i = 0; i < this.asteroids.length; i += 1) {
        const asteroid = this.asteroids[i];
        const rr = asteroid.radius + this.ship.radius;
        if (distanceSquared(this.ship.x, this.ship.y, asteroid.x, asteroid.y) > rr * rr) {
          continue;
        }

        this.handleShipHit();
        return;
      }
    }

    handleShipHit() {
      this.lives -= 1;

      if (this.lives <= 0) {
        this.lives = 0;
        this.state = 'gameover';
        this.saveProgressIfNeeded();
        return;
      }

      this.resetShip(true);
      this.bullets = [];
    }

    fireBullet() {
      const cos = Math.cos(this.ship.angle);
      const sin = Math.sin(this.ship.angle);

      this.bullets.push({
        x: this.ship.x + cos * (this.ship.radius + 5),
        y: this.ship.y + sin * (this.ship.radius + 5),
        vx: this.ship.vx + cos * BULLET_SPEED,
        vy: this.ship.vy + sin * BULLET_SPEED,
        lifeMs: BULLET_LIFE_MS,
      });

      this.shootCooldownMs = SHOOT_COOLDOWN_MS;
    }

    onKeyDown(event) {
      if (!this.isRunning) {
        return;
      }

      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space'].includes(event.code)) {
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
        case 'ArrowUp':
        case 'KeyW':
          this.input.thrust = true;
          break;
        case 'Space':
          this.input.shoot = true;
          if (this.shootCooldownMs <= 0) {
            this.fireBullet();
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
        case 'ArrowUp':
        case 'KeyW':
          this.input.thrust = false;
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
      ctx.fillStyle = '#050c14';
      ctx.fillRect(0, 0, this.viewport.width, this.viewport.height);

      ctx.save();
      ctx.translate(this.offsetX, this.offsetY);
      ctx.scale(this.scale, this.scale);

      this.drawBackground(ctx);
      this.drawAsteroids(ctx);
      this.drawBullets(ctx);
      this.drawShip(ctx);
      this.drawHud(ctx);

      if (this.state === 'paused') {
        this.drawOverlay(ctx, 'Пауза', 'Нажмите P для продолжения');
      } else if (this.state === 'gameover') {
        this.drawOverlay(ctx, 'Game Over', 'Enter или R: новая игра');
      }

      ctx.restore();
    }

    drawBackground(ctx) {
      ctx.fillStyle = '#060f18';
      ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

      for (let i = 0; i < this.stars.length; i += 1) {
        const star = this.stars[i];
        ctx.globalAlpha = star.a;
        ctx.fillStyle = '#dbe8ff';
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      ctx.strokeStyle = 'rgba(163, 193, 219, 0.24)';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, WORLD_WIDTH - 2, WORLD_HEIGHT - 2);
    }

    drawShip(ctx) {
      if (this.state === 'gameover') {
        return;
      }

      if (this.ship.invulnerableMs > 0 && Math.floor(this.ship.invulnerableMs / 120) % 2 === 0) {
        return;
      }

      ctx.save();
      ctx.translate(this.ship.x, this.ship.y);
      ctx.rotate(this.ship.angle);

      ctx.strokeStyle = '#f1f7ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(this.ship.radius + 4, 0);
      ctx.lineTo(-this.ship.radius, this.ship.radius * 0.78);
      ctx.lineTo(-this.ship.radius * 0.72, 0);
      ctx.lineTo(-this.ship.radius, -this.ship.radius * 0.78);
      ctx.closePath();
      ctx.stroke();

      if (this.input.thrust && this.state === 'playing') {
        ctx.strokeStyle = '#ff9b56';
        ctx.beginPath();
        ctx.moveTo(-this.ship.radius, 0);
        ctx.lineTo(-this.ship.radius - randomRange(10, 18), 0);
        ctx.stroke();
      }

      ctx.restore();
    }

    drawAsteroids(ctx) {
      ctx.strokeStyle = '#a7c2de';
      ctx.lineWidth = 2;

      for (let i = 0; i < this.asteroids.length; i += 1) {
        const asteroid = this.asteroids[i];

        ctx.save();
        ctx.translate(asteroid.x, asteroid.y);
        ctx.rotate(asteroid.heading);

        ctx.beginPath();
        for (let p = 0; p < asteroid.roughness.length; p += 1) {
          const angle = (p / asteroid.roughness.length) * Math.PI * 2;
          const radius = asteroid.radius * asteroid.roughness[p];
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          if (p === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.closePath();
        ctx.stroke();

        ctx.restore();
      }
    }

    drawBullets(ctx) {
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < this.bullets.length; i += 1) {
        const bullet = this.bullets[i];
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    drawHud(ctx) {
      ctx.fillStyle = '#dbe8f7';
      ctx.font = 'bold 24px "Trebuchet MS", sans-serif';
      ctx.fillText('ASTEROIDS', 22, 36);

      ctx.fillStyle = '#a7c2de';
      ctx.font = '16px "Trebuchet MS", sans-serif';
      ctx.fillText(`Score: ${this.score}`, 22, 62);
      ctx.fillText(`Best: ${this.bestScore}`, 150, 62);
      ctx.fillText(`Lives: ${this.lives}`, 278, 62);
      ctx.fillText(`Wave: ${this.wave}`, 382, 62);

      ctx.fillStyle = '#7f9cb8';
      ctx.font = '14px "Trebuchet MS", sans-serif';
      ctx.fillText('A/D or Left/Right rotate, W or Up thrust, Space shoot, P pause, R restart', 22, WORLD_HEIGHT - 18);
    }

    drawOverlay(ctx, title, subtitle) {
      ctx.fillStyle = 'rgba(4, 9, 14, 0.68)';
      ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

      ctx.fillStyle = '#eef6ff';
      ctx.textAlign = 'center';
      ctx.font = 'bold 44px "Trebuchet MS", sans-serif';
      ctx.fillText(title, WORLD_WIDTH / 2, WORLD_HEIGHT / 2 - 10);

      ctx.fillStyle = '#c4d9ea';
      ctx.font = '18px "Trebuchet MS", sans-serif';
      ctx.fillText(subtitle, WORLD_WIDTH / 2, WORLD_HEIGHT / 2 + 26);
      ctx.textAlign = 'left';
    }
  }

  ns.AsteroidsGame = AsteroidsGame;
})(window);
