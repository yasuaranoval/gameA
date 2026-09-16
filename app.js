// ===================== Logic/Middleware + Data layer =====================
// All game state lives in-memory (Data layer for this MVP); High Score is
// persisted via localStorage (Data persistence layer).

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

const hudLevel = document.getElementById('hudLevel');
const hudScore = document.getElementById('hudScore');
const hudHighScore = document.getElementById('hudHighScore');
const levelBanner = document.getElementById('levelBanner');
const gameOverScreen = document.getElementById('gameOverScreen');
const finalScoreEl = document.getElementById('finalScore');
const restartBtn = document.getElementById('restartBtn');
const powerupBanner = document.getElementById('powerupBanner');

const HIGH_SCORE_KEY = 'asteroidsMvpHighScore';

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function distance(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

// ----------------------- Player -----------------------
class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.size = 24;
    this.baseSpeed = 4;
    this.speed = this.baseSpeed;
    this.vx = 0;
    this.vy = 0;
    this.fireCooldown = 0;
    this.baseFireRate = 12; // frames between shots
    this.fireRate = this.baseFireRate;
    this.speedBoostTimer = 0;
    this.rapidFireTimer = 0;
  }

  get rect() {
    return { x: this.x - this.size / 2, y: this.y - this.size / 2, w: this.size, h: this.size };
  }

  applyPowerUp(type) {
    if (type === 'rapidFire') {
      this.rapidFireTimer = 300; // 5s at 60fps
      this.fireRate = 4;
      powerupBanner.textContent = 'Rapid Fire active!';
    } else if (type === 'speedBoost') {
      this.speedBoostTimer = 300;
      this.speed = this.baseSpeed * 1.8;
      powerupBanner.textContent = 'Speed Boost active!';
    }
  }

  update(keys, obstacles) {
    if (this.rapidFireTimer > 0) {
      this.rapidFireTimer--;
      if (this.rapidFireTimer === 0) this.fireRate = this.baseFireRate;
    }
    if (this.speedBoostTimer > 0) {
      this.speedBoostTimer--;
      if (this.speedBoostTimer === 0) this.speed = this.baseSpeed;
    }
    if (this.rapidFireTimer <= 0 && this.speedBoostTimer <= 0) {
      powerupBanner.textContent = '';
    }

    let dx = 0, dy = 0;
    if (keys['w'] || keys['arrowup']) dy -= 1;
    if (keys['s'] || keys['arrowdown']) dy += 1;
    if (keys['a'] || keys['arrowleft']) dx -= 1;
    if (keys['d'] || keys['arrowright']) dx += 1;

    const len = Math.hypot(dx, dy);
    if (len > 0) {
      dx /= len; dy /= len;
    }
    this.vx = dx * this.speed;
    this.vy = dy * this.speed;

    const nextX = this.x + this.vx;
    const nextY = this.y + this.vy;

    const half = this.size / 2;
    const clampedX = Math.max(half, Math.min(canvas.width - half, nextX));
    const clampedY = Math.max(half, Math.min(canvas.height - half, nextY));

    const testRectX = { x: clampedX - half, y: this.y - half, w: this.size, h: this.size };
    let blockedX = obstacles.some(o => rectsOverlap(testRectX, o.rect));
    if (!blockedX) this.x = clampedX;

    const testRectY = { x: this.x - half, y: clampedY - half, w: this.size, h: this.size };
    let blockedY = obstacles.some(o => rectsOverlap(testRectY, o.rect));
    if (!blockedY) this.y = clampedY;

    if (this.fireCooldown > 0) this.fireCooldown--;
  }

  canFire() {
    return this.fireCooldown <= 0;
  }

  resetFireCooldown() {
    this.fireCooldown = this.fireRate;
  }

  draw() {
    ctx.fillStyle = '#4caf50';
    ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
  }
}

// ----------------------- Bullet -----------------------
class Bullet {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    this.size = 6;
    this.speed = 9;
    this.vx = Math.cos(angle) * this.speed;
    this.vy = Math.sin(angle) * this.speed;
    this.dead = false;
  }

  get rect() {
    return { x: this.x - this.size / 2, y: this.y - this.size / 2, w: this.size, h: this.size };
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) {
      this.dead = true;
    }
  }

  draw() {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
  }
}

// ----------------------- Enemy -----------------------
class Enemy {
  constructor(x, y, speed) {
    this.x = x;
    this.y = y;
    this.size = 22;
    this.speed = speed;
    this.dead = false;
  }

  get rect() {
    return { x: this.x - this.size / 2, y: this.y - this.size / 2, w: this.size, h: this.size };
  }

  update(player, obstacles) {
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = (dx / len) * this.speed;
    const ny = (dy / len) * this.speed;

    const half = this.size / 2;
    const testRectX = { x: this.x + nx - half, y: this.y - half, w: this.size, h: this.size };
    if (!obstacles.some(o => rectsOverlap(testRectX, o.rect))) this.x += nx;

    const testRectY = { x: this.x - half, y: this.y + ny - half, w: this.size, h: this.size };
    if (!obstacles.some(o => rectsOverlap(testRectY, o.rect))) this.y += ny;
  }

  draw() {
    ctx.fillStyle = '#e53935';
    ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
  }
}

// ----------------------- Obstacle -----------------------
class Obstacle {
  constructor(x, y, w, h) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
  }

  get rect() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }

  draw() {
    ctx.fillStyle = '#757575';
    ctx.fillRect(this.x, this.y, this.w, this.h);
  }
}

// ----------------------- PowerUp -----------------------
class PowerUp {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.size = 16;
    this.type = type; // 'rapidFire' | 'speedBoost'
    this.dead = false;
  }

  get rect() {
    return { x: this.x - this.size / 2, y: this.y - this.size / 2, w: this.size, h: this.size };
  }

  draw() {
    ctx.fillStyle = '#ffd54a';
    ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
  }
}

// ----------------------- LevelManager -----------------------
class LevelManager {
  constructor() {
    this.level = 1;
    this.defeatsInCurrentLevel = 0;
    this.transitioning = false;
  }

  // Spec: Level 1 requires 10 defeats. Level N requires 10 + (N * 5) defeats.
  // For N=1 that formula gives 15, conflicting with the explicit "Level 1 = 10".
  // We honor the explicit Level 1 = 10 case, and use 10 + (N * 5) for N > 1.
  targetForLevel(n) {
    return n === 1 ? 10 : 10 + n * 5;
  }

  enemySpeedMultiplier() {
    return Math.pow(1.15, this.level - 1);
  }

  powerUpDropChance() {
    return 0.10 + (this.level - 1) * 0.05;
  }

  recordDefeat() {
    this.defeatsInCurrentLevel++;
    return this.defeatsInCurrentLevel >= this.targetForLevel(this.level);
  }

  advance() {
    this.level++;
    this.defeatsInCurrentLevel = 0;
  }
}

// ----------------------- GameEngine -----------------------
class GameEngine {
  constructor() {
    this.player = null;
    this.bullets = [];
    this.enemies = [];
    this.obstacles = [];
    this.powerUps = [];
    this.levelManager = new LevelManager();
    this.score = 0;
    this.highScore = Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0;
    this.keys = {};
    this.mouse = { x: 0, y: 0 };
    this.enemySpawnTimer = 0;
    this.enemySpawnInterval = 90; // frames
    this.gameOver = false;
    this.bannerTimer = 0;

    hudHighScore.textContent = `High Score: ${this.highScore}`;

    this.bindInput();
    this.startLevel(1, true);
  }

  bindInput() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.key.toLowerCase()] = true;
      if (e.key.toLowerCase() === 'r' && this.gameOver) {
        this.restart();
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;
    });
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - rect.left;
      this.mouse.y = e.clientY - rect.top;
    });
    canvas.addEventListener('mousedown', () => {
      this.fireRequested = true;
    });
    restartBtn.addEventListener('click', () => this.restart());
  }

  spawnObstacles(count) {
    this.obstacles = [];
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const safeRadius = 140;
    let attempts = 0;
    while (this.obstacles.length < count && attempts < 200) {
      attempts++;
      const w = 60 + Math.random() * 80;
      const h = 60 + Math.random() * 80;
      const x = Math.random() * (canvas.width - w);
      const y = Math.random() * (canvas.height - h);
      const centerX = x + w / 2;
      const centerY = y + h / 2;
      if (distance(centerX, centerY, cx, cy) < safeRadius) continue;
      this.obstacles.push(new Obstacle(x, y, w, h));
    }
  }

  startLevel(n, isFirst) {
    this.levelManager.level = n;
    this.levelManager.defeatsInCurrentLevel = 0;
    this.enemies = [];
    this.bullets = [];
    this.powerUps = [];
    const obstacleCount = 2 + Math.floor(Math.random() * 3); // 2-4
    this.spawnObstacles(obstacleCount);

    if (!isFirst) {
      this.player.x = canvas.width / 2;
      this.player.y = canvas.height / 2;
    } else {
      this.player = new Player(canvas.width / 2, canvas.height / 2);
    }

    this.showLevelBanner(n === 1 ? 'Level 1' : `Level ${n - 1} Complete!`);
  }

  showLevelBanner(text) {
    levelBanner.textContent = text;
    levelBanner.classList.add('show');
    this.bannerTimer = 90;
  }

  spawnEnemy() {
    const edge = Math.floor(Math.random() * 4);
    let x, y;
    if (edge === 0) { x = Math.random() * canvas.width; y = -30; }
    else if (edge === 1) { x = canvas.width + 30; y = Math.random() * canvas.height; }
    else if (edge === 2) { x = Math.random() * canvas.width; y = canvas.height + 30; }
    else { x = -30; y = Math.random() * canvas.height; }

    const speed = 1.6 * this.levelManager.enemySpeedMultiplier();
    this.enemies.push(new Enemy(x, y, speed));
  }

  fireBullet() {
    const angle = Math.atan2(this.mouse.y - this.player.y, this.mouse.x - this.player.x);
    this.bullets.push(new Bullet(this.player.x, this.player.y, angle));
    this.player.resetFireCooldown();
  }

  update() {
    if (this.gameOver) return;

    if (this.bannerTimer > 0) {
      this.bannerTimer--;
      if (this.bannerTimer === 0) levelBanner.classList.remove('show');
    }

    this.player.update(this.keys, this.obstacles);

    if (this.fireRequested && this.player.canFire()) {
      this.fireBullet();
    }
    this.fireRequested = false;

    this.enemySpawnTimer++;
    if (this.enemySpawnTimer >= this.enemySpawnInterval) {
      this.enemySpawnTimer = 0;
      this.spawnEnemy();
    }

    this.bullets.forEach(b => b.update());
    this.bullets = this.bullets.filter(b => !b.dead);

    this.enemies.forEach(e => e.update(this.player, this.obstacles));

    // Bullet vs obstacle
    for (const bullet of this.bullets) {
      for (const obs of this.obstacles) {
        if (rectsOverlap(bullet.rect, obs.rect)) {
          bullet.dead = true;
        }
      }
    }

    // Bullet vs enemy
    for (const bullet of this.bullets) {
      if (bullet.dead) continue;
      for (const enemy of this.enemies) {
        if (enemy.dead) continue;
        if (rectsOverlap(bullet.rect, enemy.rect)) {
          bullet.dead = true;
          enemy.dead = true;
          this.score += 100;
          hudScore.textContent = `Score: ${this.score}`;

          if (Math.random() < this.levelManager.powerUpDropChance()) {
            const type = Math.random() < 0.5 ? 'rapidFire' : 'speedBoost';
            this.powerUps.push(new PowerUp(enemy.x, enemy.y, type));
          }

          const levelComplete = this.levelManager.recordDefeat();
          if (levelComplete) {
            this.levelUp();
          }
          break;
        }
      }
    }

    this.bullets = this.bullets.filter(b => !b.dead);
    this.enemies = this.enemies.filter(e => !e.dead);

    // Enemy vs player -> game over
    for (const enemy of this.enemies) {
      if (rectsOverlap(enemy.rect, this.player.rect)) {
        this.triggerGameOver();
        return;
      }
    }

    // Player vs powerup
    for (const p of this.powerUps) {
      if (rectsOverlap(p.rect, this.player.rect)) {
        p.dead = true;
        this.player.applyPowerUp(p.type);
      }
    }
    this.powerUps = this.powerUps.filter(p => !p.dead);

    hudLevel.textContent = `Level: ${this.levelManager.level}`;
  }

  levelUp() {
    const nextLevel = this.levelManager.level + 1;
    this.enemies = [];
    this.startLevel(nextLevel, false);
  }

  triggerGameOver() {
    this.gameOver = true;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem(HIGH_SCORE_KEY, String(this.highScore));
      hudHighScore.textContent = `High Score: ${this.highScore}`;
    }
    finalScoreEl.textContent = `Final Score: ${this.score}`;
    gameOverScreen.classList.add('show');
  }

  restart() {
    this.score = 0;
    this.gameOver = false;
    hudScore.textContent = 'Score: 0';
    gameOverScreen.classList.remove('show');
    powerupBanner.textContent = '';
    this.enemySpawnTimer = 0;
    this.startLevel(1, true);
  }

  draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    this.obstacles.forEach(o => o.draw());
    this.powerUps.forEach(p => p.draw());
    this.enemies.forEach(e => e.draw());
    this.bullets.forEach(b => b.draw());
    this.player.draw();
  }

  loop() {
    this.update();
    this.draw();
    requestAnimationFrame(() => this.loop());
  }
}

const engine = new GameEngine();
engine.loop();
