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
const seCharacterImage = document.getElementById('seCharacterImage');
const revopsCharacterImage = document.getElementById('revopsCharacterImage');

const HIGH_SCORE_KEY = 'asteroidsMvpHighScore';

// ----------------------- Player classes (Data layer: stat config) -----------------------
const PLAYER_CLASSES = {
  warrior: { id: 'warrior', baseSpeed: 5.2, baseFireRate: 18, scoreMultiplier: 1,    color: '#B0BEC5', image: seCharacterImage },
  wizard:  { id: 'wizard',  baseSpeed: 3.4, baseFireRate: 8,  scoreMultiplier: 1.25, color: '#AB47BC', image: revopsCharacterImage },
};
const DEFAULT_CLASS_ID = 'warrior';

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function formatCurrency(amount) {
  return `€${Math.round(amount).toLocaleString('en-US')}`;
}

function distance(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

function drawCharacterImage(image, x, y, height) {
  if (!image.complete || image.naturalWidth === 0) return false;
  const width = height * (image.naturalWidth / image.naturalHeight);
  ctx.drawImage(image, x - width / 2, y - height / 2, width, height);
  return true;
}

// ----------------------- City data (Data layer: level -> city, in-memory) -----------------------
const CITIES = ['Amsterdam', 'Barcelona', 'Berlin', 'Dublin', 'London', 'Madrid', 'Munich'];

function cityForLevel(level) {
  return CITIES[(level - 1) % CITIES.length];
}

// ----------------------- City backgrounds (Data layer: level -> background image) -----------------------
const CITY_BACKGROUNDS = {};
CITIES.forEach((city) => {
  const img = new Image();
  img.src = `assets/images/background-${city}.png`;
  CITY_BACKGROUNDS[city] = img;
});
const BACKGROUND_OPACITY = 0.15;

// Draws the city background image scaled to fit inside the canvas without
// stretching (contain-fit), centered, and at low opacity so it doesn't clutter gameplay.
function drawCityBackground(city) {
  const img = CITY_BACKGROUNDS[city];
  if (!img || !img.complete || img.naturalWidth === 0) return;

  const scale = Math.min(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
  const drawW = img.naturalWidth * scale;
  const drawH = img.naturalHeight * scale;
  const drawX = (canvas.width - drawW) / 2;
  const drawY = (canvas.height - drawH) / 2;

  ctx.save();
  ctx.globalAlpha = BACKGROUND_OPACITY;
  ctx.drawImage(img, drawX, drawY, drawW, drawH);
  ctx.restore();
}

// ----------------------- City obstacle images (Data layer: level -> obstacle sprite) -----------------------
const CITY_OBSTACLE_IMAGES = {};
CITIES.forEach((city) => {
  const img = new Image();
  img.src = `assets/images/obstacle-${city}-removebg-preview.png`;
  CITY_OBSTACLE_IMAGES[city] = img;
});

// ----------------------- Enemy images (Data layer: player class -> enemy sprite set) -----------------------
// Enemies attacking the SE Warrior use the "SEenemy" set; enemies attacking the
// RevOps Wizard use the "revopsenemy" set.
function loadImage(src) {
  const img = new Image();
  img.src = src;
  return img;
}

const ENEMY_IMAGE_SETS = {
  warrior: ['SEenemy1.jpeg', 'SEenemy2.png'].map((name) => loadImage(`assets/images/${name}`)),
  wizard: ['revopsenemy1.png', 'revopsenemy2.png'].map((name) => loadImage(`assets/images/${name}`)),
};

// ----------------------- Landmark silhouettes (Client/UI: vector obstacle art) -----------------------
// Each drawer renders a simplified landmark silhouette inside the (x, y, w, h) box
// that also defines the obstacle's collision rect, so visuals and hitboxes stay in sync.
const LANDMARKS = {
  Amsterdam: [drawCanalHouse, drawWindmill],
  Barcelona: [drawSagradaFamilia, drawParkGuell],
  Berlin: [drawBrandenburgGate, drawTvTower],
  Dublin: [drawHapennyBridge, drawSamuelBeckettBridge],
  London: [drawBigBen, drawLondonEye],
  Madrid: [drawPuertaAlcala, drawMetropolisBuilding],
  Munich: [drawFrauenkirche, drawNeuesRathaus],
};

function drawCanalHouse(ctx, x, y, w, h) {
  ctx.fillStyle = '#8a6d4f';
  ctx.strokeStyle = '#3a2e20';
  ctx.lineWidth = 2;
  const gableH = h * 0.28;
  ctx.beginPath();
  ctx.moveTo(x, y + gableH);
  ctx.lineTo(x + w / 2, y);
  ctx.lineTo(x + w, y + gableH);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#4a3a2a';
  ctx.fillRect(x + w * 0.42, y + h * 0.66, w * 0.16, h * 0.34);

  ctx.fillStyle = '#cfe0ea';
  const winRows = [0.42, 0.62];
  for (const ry of winRows) {
    ctx.fillRect(x + w * 0.18, y + h * ry, w * 0.14, h * 0.12);
    ctx.fillRect(x + w * 0.68, y + h * ry, w * 0.14, h * 0.12);
  }
}

function drawWindmill(ctx, x, y, w, h) {
  const cx = x + w / 2;
  const baseY = y + h;
  ctx.fillStyle = '#9c8465';
  ctx.strokeStyle = '#3a2e20';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.22, baseY);
  ctx.lineTo(cx - w * 0.12, y + h * 0.2);
  ctx.lineTo(cx + w * 0.12, y + h * 0.2);
  ctx.lineTo(cx + w * 0.22, baseY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  const hubY = y + h * 0.2;
  ctx.strokeStyle = '#e8d9b0';
  ctx.lineWidth = 3;
  for (let i = 0; i < 4; i++) {
    const angle = (Math.PI / 2) * i + Math.PI / 4;
    ctx.beginPath();
    ctx.moveTo(cx, hubY);
    ctx.lineTo(cx + Math.cos(angle) * w * 0.4, hubY + Math.sin(angle) * h * 0.4);
    ctx.stroke();
  }
  ctx.fillStyle = '#e8d9b0';
  ctx.beginPath();
  ctx.arc(cx, hubY, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawSagradaFamilia(ctx, x, y, w, h) {
  ctx.fillStyle = '#b89a6b';
  ctx.strokeStyle = '#5c4a2e';
  ctx.lineWidth = 2;
  const spireCount = 3;
  const spireW = w / spireCount;
  for (let i = 0; i < spireCount; i++) {
    const sx = x + i * spireW;
    const peakH = h * (0.55 + (i % 2 === 0 ? 0.4 : 0.15));
    ctx.beginPath();
    ctx.moveTo(sx + spireW * 0.15, y + h);
    ctx.lineTo(sx + spireW * 0.5, y + h - peakH);
    ctx.lineTo(sx + spireW * 0.85, y + h);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#e0c98f';
    ctx.beginPath();
    ctx.arc(sx + spireW * 0.5, y + h - peakH, spireW * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b89a6b';
  }
}

function drawParkGuell(ctx, x, y, w, h) {
  ctx.fillStyle = '#8fae7a';
  ctx.strokeStyle = '#4a5c3a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.quadraticCurveTo(x + w * 0.2, y + h * 0.3, x + w * 0.5, y + h * 0.4);
  ctx.quadraticCurveTo(x + w * 0.8, y + h * 0.5, x + w, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = '#d98a8a';
  ctx.lineWidth = 2;
  const dots = [[0.3, 0.55], [0.45, 0.48], [0.6, 0.58], [0.72, 0.5]];
  for (const [dx, dy] of dots) {
    ctx.beginPath();
    ctx.arc(x + w * dx, y + h * dy, w * 0.05, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawBrandenburgGate(ctx, x, y, w, h) {
  ctx.fillStyle = '#c9c2a8';
  ctx.strokeStyle = '#4a463a';
  ctx.lineWidth = 2;
  const lintelH = h * 0.18;
  ctx.fillRect(x, y, w, lintelH);
  ctx.strokeRect(x, y, w, lintelH);

  const colCount = 5;
  const colW = w * 0.12;
  const gap = (w - colCount * colW) / (colCount - 1);
  for (let i = 0; i < colCount; i++) {
    const cx = x + i * (colW + gap);
    ctx.fillRect(cx, y + lintelH, colW, h - lintelH);
    ctx.strokeRect(cx, y + lintelH, colW, h - lintelH);
  }
}

function drawTvTower(ctx, x, y, w, h) {
  const cx = x + w / 2;
  ctx.strokeStyle = '#c9c2a8';
  ctx.lineWidth = Math.max(2, w * 0.06);
  ctx.beginPath();
  ctx.moveTo(cx, y + h);
  ctx.lineTo(cx, y + h * 0.3);
  ctx.stroke();

  ctx.fillStyle = '#d9d2b8';
  ctx.beginPath();
  ctx.arc(cx, y + h * 0.22, w * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#4a463a';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.strokeStyle = '#d9d2b8';
  ctx.lineWidth = Math.max(2, w * 0.03);
  ctx.beginPath();
  ctx.moveTo(cx, y + h * 0.05);
  ctx.lineTo(cx, y + h * 0.3);
  ctx.stroke();
}

function drawHapennyBridge(ctx, x, y, w, h) {
  ctx.strokeStyle = '#a3a89c';
  ctx.lineWidth = Math.max(2, h * 0.05);
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.quadraticCurveTo(x + w / 2, y + h * 0.15, x + w, y + h);
  ctx.stroke();

  ctx.lineWidth = 2;
  const railCount = 6;
  for (let i = 1; i < railCount; i++) {
    const t = i / railCount;
    const rx = x + w * t;
    const ry = y + h - Math.sin(t * Math.PI) * h * 0.75;
    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.lineTo(rx, ry + h * 0.18);
    ctx.stroke();
  }
}

function drawSamuelBeckettBridge(ctx, x, y, w, h) {
  const cx = x + w * 0.25;
  ctx.strokeStyle = '#c7cdd6';
  ctx.lineWidth = Math.max(3, w * 0.05);
  ctx.beginPath();
  ctx.moveTo(cx, y + h);
  ctx.lineTo(cx, y);
  ctx.stroke();

  ctx.lineWidth = 2;
  const anchors = [0.35, 0.55, 0.75, 0.95];
  for (const t of anchors) {
    ctx.beginPath();
    ctx.moveTo(cx, y + h * 0.1);
    ctx.lineTo(x + w * t, y + h);
    ctx.stroke();
  }
  ctx.strokeStyle = '#8b929c';
  ctx.lineWidth = Math.max(2, h * 0.04);
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x + w, y + h);
  ctx.stroke();
}

function drawBigBen(ctx, x, y, w, h) {
  ctx.fillStyle = '#b8a568';
  ctx.strokeStyle = '#4a4230';
  ctx.lineWidth = 2;
  const towerW = w * 0.6;
  const tx = x + (w - towerW) / 2;
  ctx.fillRect(tx, y + h * 0.25, towerW, h * 0.75);
  ctx.strokeRect(tx, y + h * 0.25, towerW, h * 0.75);

  ctx.beginPath();
  ctx.moveTo(tx, y + h * 0.25);
  ctx.lineTo(tx + towerW / 2, y);
  ctx.lineTo(tx + towerW, y + h * 0.25);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f2e6b8';
  ctx.beginPath();
  ctx.arc(tx + towerW / 2, y + h * 0.42, towerW * 0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#4a4230';
  ctx.stroke();
}

function drawLondonEye(ctx, x, y, w, h) {
  const cx = x + w / 2;
  const cy = y + h * 0.55;
  const r = Math.min(w, h) * 0.42;

  ctx.strokeStyle = '#9fb8c9';
  ctx.lineWidth = Math.max(2, r * 0.08);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI / 4) * i;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
    ctx.stroke();
  }

  ctx.strokeStyle = '#6b8494';
  ctx.lineWidth = Math.max(2, r * 0.1);
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.5, y + h);
  ctx.lineTo(cx, cy);
  ctx.lineTo(cx + r * 0.5, y + h);
  ctx.stroke();
}

function drawPuertaAlcala(ctx, x, y, w, h) {
  ctx.fillStyle = '#c7a373';
  ctx.strokeStyle = '#5c4426';
  ctx.lineWidth = 2;
  const archW = w / 3;
  for (let i = 0; i < 3; i++) {
    const ax = x + i * archW;
    const archH = i === 1 ? h * 0.85 : h * 0.65;
    const pillarW = archW * 0.32;
    ctx.fillRect(ax, y + h - archH, pillarW, archH);
    ctx.strokeRect(ax, y + h - archH, pillarW, archH);
    ctx.fillRect(ax + archW - pillarW, y + h - archH, pillarW, archH);
    ctx.strokeRect(ax + archW - pillarW, y + h - archH, pillarW, archH);
    ctx.beginPath();
    ctx.arc(ax + archW / 2, y + h - archH, archW / 2 - pillarW * 0.2, Math.PI, 0);
    ctx.stroke();
  }
}

function drawMetropolisBuilding(ctx, x, y, w, h) {
  ctx.fillStyle = '#c9b98a';
  ctx.strokeStyle = '#4a4230';
  ctx.lineWidth = 2;
  const bodyH = h * 0.7;
  ctx.fillRect(x + w * 0.15, y + h - bodyH, w * 0.7, bodyH);
  ctx.strokeRect(x + w * 0.15, y + h - bodyH, w * 0.7, bodyH);

  const domeCx = x + w / 2;
  const domeCy = y + h - bodyH;
  ctx.beginPath();
  ctx.arc(domeCx, domeCy, w * 0.28, Math.PI, 0);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = '#e0d09a';
  ctx.lineWidth = Math.max(2, w * 0.04);
  ctx.beginPath();
  ctx.moveTo(domeCx, domeCy - w * 0.28);
  ctx.lineTo(domeCx, domeCy - w * 0.5);
  ctx.stroke();
}

function drawFrauenkirche(ctx, x, y, w, h) {
  ctx.fillStyle = '#9c8a76';
  ctx.strokeStyle = '#3a3126';
  ctx.lineWidth = 2;
  const towerW = w * 0.32;
  for (const tx of [x, x + w - towerW]) {
    ctx.fillRect(tx, y + h * 0.2, towerW, h * 0.8);
    ctx.strokeRect(tx, y + h * 0.2, towerW, h * 0.8);
    ctx.beginPath();
    ctx.arc(tx + towerW / 2, y + h * 0.2, towerW / 2, Math.PI, 0);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#c7622e';
    ctx.beginPath();
    ctx.arc(tx + towerW / 2, y + h * 0.08, towerW * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#9c8a76';
  }
}

function drawNeuesRathaus(ctx, x, y, w, h) {
  ctx.fillStyle = '#8a7d6b';
  ctx.strokeStyle = '#3a3126';
  ctx.lineWidth = 2;
  const towerW = w * 0.34;
  const tx = x + (w - towerW) / 2;
  ctx.fillRect(tx, y + h * 0.15, towerW, h * 0.85);
  ctx.strokeRect(tx, y + h * 0.15, towerW, h * 0.85);

  ctx.beginPath();
  ctx.moveTo(tx - towerW * 0.15, y + h * 0.15);
  ctx.lineTo(tx + towerW / 2, y);
  ctx.lineTo(tx + towerW * 1.15, y + h * 0.15);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#e0d5b8';
  ctx.fillRect(tx + towerW * 0.3, y + h * 0.32, towerW * 0.4, towerW * 0.4);
}

// ----------------------- Player -----------------------
class Player {
  constructor(x, y, classId) {
    this.x = x;
    this.y = y;
    this.classId = classId;
    const cls = PLAYER_CLASSES[classId] || PLAYER_CLASSES[DEFAULT_CLASS_ID];
    this.image = cls.image;
    this.color = cls.color;
    this.scoreMultiplier = cls.scoreMultiplier;
    this.size = 24;
    this.baseSpeed = cls.baseSpeed;
    this.speed = this.baseSpeed;
    this.vx = 0;
    this.vy = 0;
    this.fireCooldown = 0;
    this.baseFireRate = cls.baseFireRate; // frames between shots
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
    if (!drawCharacterImage(this.image, this.x, this.y, 86)) {
      ctx.fillStyle = this.color;
      ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
    }
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

// ----------------------- Euro pop (deal-closed visual effect) -----------------------
const EURO_POP_LIFESPAN = 30; // 0.5s at 60fps

class EuroPop {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.age = 0;
    this.dead = false;
  }

  update() {
    this.age++;
    this.y -= 1.6;
    if (this.age >= EURO_POP_LIFESPAN) this.dead = true;
  }

  draw() {
    const progress = this.age / EURO_POP_LIFESPAN;
    ctx.save();
    ctx.globalAlpha = 1 - progress;
    ctx.fillStyle = '#00FF66';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('€', this.x, this.y);
    ctx.restore();
  }
}

// ----------------------- Enemy -----------------------
class Enemy {
  constructor(x, y, speed, image) {
    this.x = x;
    this.y = y;
    this.size = 22;
    this.speed = speed;
    this.image = image;
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
    if (this.image && drawCharacterImage(this.image, this.x, this.y, 48)) return;

    // Fallback while the enemy's sprite is still loading (or missing).
    const width = 52;
    const height = 38;
    const left = this.x - width / 2;
    const top = this.y - height / 2;

    ctx.fillStyle = '#f0c94b';
    ctx.strokeStyle = '#5a4316';
    ctx.lineWidth = 2;
    ctx.fillRect(left, top, width, height);
    ctx.strokeRect(left, top, width, height);
    ctx.fillStyle = '#fff5c7';
    ctx.fillRect(left + 5, top + 6, width - 10, 4);
    ctx.fillRect(left + 5, top + 15, width - 20, 4);
    ctx.fillRect(left + 5, top + 24, width - 14, 4);
  }
}

// ----------------------- Obstacle -----------------------
class Obstacle {
  constructor(x, y, w, h, city) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.image = CITY_OBSTACLE_IMAGES[city];
    const variants = LANDMARKS[city] || LANDMARKS[CITIES[0]];
    this.drawLandmark = variants[Math.floor(Math.random() * variants.length)];
  }

  // Collision rect matches the box the sprite/landmark is drawn into, so
  // hitboxes stay as tight as the plain-rectangle obstacles they replace.
  get rect() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }

  draw() {
    if (this.image && this.image.complete && this.image.naturalWidth > 0) {
      ctx.drawImage(this.image, this.x, this.y, this.w, this.h);
      return;
    }
    // Fallback while the city's uploaded sprite is still loading (or missing).
    this.drawLandmark(ctx, this.x, this.y, this.w, this.h);
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

  // Level 1 -> 2 gets a gentler speed bump; growth returns to the normal
  // 1.15x-per-level rate from level 2 onward.
  enemySpeedMultiplier() {
    if (this.level <= 1) return 1;
    if (this.level === 2) return 1.06;
    return 1.06 * Math.pow(1.15, this.level - 2);
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
  constructor(classId) {
    this.player = null;
    this.classId = classId || DEFAULT_CLASS_ID;
    this.bullets = [];
    this.enemies = [];
    this.obstacles = [];
    this.powerUps = [];
    this.euroPops = [];
    this.levelManager = new LevelManager();
    this.score = 0;
    this.highScore = Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0;
    this.keys = {};
    this.mouse = { x: 0, y: 0 };
    this.enemySpawnTimer = 0;
    this.enemySpawnInterval = 90; // frames
    this.gameOver = false;
    this.bannerTimer = 0;
    this.awaitingLevelStart = false;
    this.pendingLevel = null;

    hudHighScore.textContent = `Record Target: ${formatCurrency(this.highScore)}`;

    this.bindInput();
    this.startLevel(1, true);
  }

  bindInput() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.key.toLowerCase()] = true;
      if (e.key.toLowerCase() === 'r' && this.gameOver) {
        this.restart();
      }
      if (e.code === 'Space') {
        e.preventDefault();
        if (this.awaitingLevelStart) {
          this.beginPendingLevel();
        } else {
          this.fireRequested = true;
        }
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
      if (this.awaitingLevelStart) {
        this.beginPendingLevel();
        return;
      }
      this.fireRequested = true;
    });
    restartBtn.addEventListener('click', () => this.restart());
  }

  spawnObstacles(count) {
    this.obstacles = [];
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const safeRadius = 140;
    const city = cityForLevel(this.levelManager.level);
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
      this.obstacles.push(new Obstacle(x, y, w, h, city));
    }
  }

  startLevel(n, isFirst) {
    this.levelManager.level = n;
    this.levelManager.defeatsInCurrentLevel = 0;
    this.enemies = [];
    this.bullets = [];
    this.powerUps = [];
    // Randomized each call, so obstacle count/positions differ level to level.
    const obstacleCount = 2 + Math.floor(Math.random() * 3); // 2-4
    this.spawnObstacles(obstacleCount);

    if (!isFirst) {
      this.player.x = canvas.width / 2;
      this.player.y = canvas.height / 2;
    } else {
      this.player = new Player(canvas.width / 2, canvas.height / 2, this.classId);
    }

    this.showLevelBanner(`Level ${n}`, false);
  }

  // persist=true keeps the banner up (with a "click to continue" hint) and
  // pauses the game via awaitingLevelStart until the player clicks.
  showLevelBanner(text, persist) {
    levelBanner.innerHTML = persist ? `${text}<br><span class="hint">Click to continue</span>` : text;
    levelBanner.classList.toggle('waiting', !!persist);
    levelBanner.classList.add('show');
    this.bannerTimer = persist ? 0 : 90;
  }

  beginPendingLevel() {
    this.awaitingLevelStart = false;
    const nextLevel = this.pendingLevel;
    this.pendingLevel = null;
    levelBanner.classList.remove('waiting');
    this.startLevel(nextLevel, false);
  }

  spawnEnemy() {
    const edge = Math.floor(Math.random() * 4);
    let x, y;
    if (edge === 0) { x = Math.random() * canvas.width; y = -30; }
    else if (edge === 1) { x = canvas.width + 30; y = Math.random() * canvas.height; }
    else if (edge === 2) { x = Math.random() * canvas.width; y = canvas.height + 30; }
    else { x = -30; y = Math.random() * canvas.height; }

    const speed = 1.6 * this.levelManager.enemySpeedMultiplier();
    const enemyImages = ENEMY_IMAGE_SETS[this.classId] || ENEMY_IMAGE_SETS[DEFAULT_CLASS_ID];
    const image = enemyImages[Math.floor(Math.random() * enemyImages.length)];
    this.enemies.push(new Enemy(x, y, speed, image));
  }

  fireBullet() {
    const angle = Math.atan2(this.mouse.y - this.player.y, this.mouse.x - this.player.x);
    this.bullets.push(new Bullet(this.player.x, this.player.y, angle));
    this.player.resetFireCooldown();
  }

  update() {
    if (this.gameOver || !this.player) return;
    if (this.awaitingLevelStart) return;

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
          this.score += Math.round(100 * this.player.scoreMultiplier);
          hudScore.textContent = `ARR Closed: ${formatCurrency(this.score)}`;
          this.euroPops.push(new EuroPop(enemy.x, enemy.y));

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

    this.euroPops.forEach(p => p.update());
    this.euroPops = this.euroPops.filter(p => !p.dead);

    hudLevel.textContent = `Level ${this.levelManager.level}: ${cityForLevel(this.levelManager.level)}`;
  }

  levelUp() {
    const completedLevel = this.levelManager.level;
    this.pendingLevel = completedLevel + 1;
    this.awaitingLevelStart = true;
    this.enemies = [];
    this.bullets = [];
    this.showLevelBanner(`Level ${completedLevel} Complete!`, true);
  }

  triggerGameOver() {
    this.gameOver = true;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem(HIGH_SCORE_KEY, String(this.highScore));
      hudHighScore.textContent = `Record Target: ${formatCurrency(this.highScore)}`;
    }
    finalScoreEl.textContent = `Final Score: ${formatCurrency(this.score)}`;
    gameOverScreen.classList.add('show');
  }

  restart() {
    this.score = 0;
    this.gameOver = false;
    this.awaitingLevelStart = false;
    this.pendingLevel = null;
    hudScore.textContent = `ARR Closed: ${formatCurrency(0)}`;
    gameOverScreen.classList.remove('show');
    levelBanner.classList.remove('waiting');
    powerupBanner.textContent = '';
    this.enemySpawnTimer = 0;
    this.euroPops = [];
    this.startLevel(1, true);
  }

  draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawCityBackground(cityForLevel(this.levelManager.level));

    this.obstacles.forEach(o => o.draw());
    this.powerUps.forEach(p => p.draw());
    this.enemies.forEach(e => e.draw());
    this.bullets.forEach(b => b.draw());
    this.euroPops.forEach(p => p.draw());
    if (this.player) this.player.draw();
  }

  loop() {
    this.update();
    this.draw();
    requestAnimationFrame(() => this.loop());
  }
}

// ----------------------- Intro box screen (Client/UI + Logic/Middleware) -----------------------
const introScreen = document.getElementById('introScreen');
const gameBox = document.getElementById('gameBox');

function openIntroBox() {
  if (gameBox.classList.contains('opening')) return;
  gameBox.classList.add('opening');
  introScreen.classList.add('fade-out');
  window.setTimeout(() => {
    introScreen.classList.remove('show', 'fade-out');
    startScreen.classList.add('show');
    window.addEventListener('keydown', onStartKey);
  }, 950);
}
gameBox.addEventListener('click', openIntroBox);

// ----------------------- Start screen (Client/UI + Logic/Middleware) -----------------------
const startScreen = document.getElementById('startScreen');
const startBtn = document.getElementById('startBtn');
const classCards = document.querySelectorAll('.class-card');
const controlsLegendEl = document.getElementById('controlsLegend');

const CONTROLS = [
  { key: 'WASD / Arrows', action: 'Move', state: 'active' },
  { key: 'Mouse', action: 'Aim', state: 'active' },
  { key: 'Click / Space', action: 'Data Blast (fire)', state: 'active' },
  { key: 'Click / Space', action: 'Continue to next city', state: 'active' },
  { key: 'R', action: 'Retry after game over', state: 'active' },
  { key: 'B', action: 'Melee Strike', state: 'locked' },
  { key: 'X', action: 'Items', state: 'locked' },
];

function renderControlsLegend() {
  controlsLegendEl.innerHTML = CONTROLS.map(c => `
    <div class="control-row${c.state === 'locked' ? ' locked' : ''}">
      <span class="control-key">${c.key}</span>
      <span class="control-action">${c.action}</span>
      ${c.state === 'locked' ? '<span class="control-tag">soon</span>' : ''}
    </div>
  `).join('');
}
renderControlsLegend();

let selectedClassId = DEFAULT_CLASS_ID;

function selectClass(classId) {
  selectedClassId = classId;
  classCards.forEach(card => {
    const isSelected = card.dataset.class === classId;
    card.classList.toggle('selected', isSelected);
    card.setAttribute('aria-pressed', String(isSelected));
  });
}
selectClass(DEFAULT_CLASS_ID);

classCards.forEach(card => {
  card.addEventListener('click', () => selectClass(card.dataset.class));
});

function onStartKey(e) {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault();
    const ids = Object.keys(PLAYER_CLASSES);
    const idx = ids.indexOf(selectedClassId);
    const nextIdx = e.key === 'ArrowLeft'
      ? (idx - 1 + ids.length) % ids.length
      : (idx + 1) % ids.length;
    selectClass(ids[nextIdx]);
    return;
  }
  if (e.key === 'Enter' || e.code === 'Space') {
    e.preventDefault();
    startGame();
  }
}
startBtn.addEventListener('click', startGame);

let engine = null;

function startGame() {
  if (engine) return;
  window.removeEventListener('keydown', onStartKey);
  startScreen.classList.remove('show');
  engine = new GameEngine(selectedClassId);
  engine.loop();
}
