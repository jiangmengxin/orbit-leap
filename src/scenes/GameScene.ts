import Phaser from 'phaser';
import {
  W, H, PALETTE, PLAYER_COLOR, VOID_COLOR, STAR_COLOR,
  BOOST_COLOR, UNSTABLE_COLOR, SHIELD_COLOR, BEST_KEY, ZONES,
} from '../constants';
import { sfx } from '../sfx';

/**
 * 行星类型：
 * normal   普通
 * pulse    轨道环半径呼吸伸缩
 * boost    金色，弹射速度 1.5 倍
 * unstable 捕获后引信点燃，倒计时爆炸
 */
type Kind = 'normal' | 'pulse' | 'boost' | 'unstable';

interface Mine {
  a: number;
  sp: number;
  img: Phaser.GameObjects.Image;
}

interface Planet {
  x: number;
  y: number;
  r: number; // 本体半径（碰到即死）
  orbitR: number; // 当前轨道环半径（碰到即捕获）
  baseOrbitR: number;
  color: number;
  kind: Kind;
  visited: boolean;
  ringPhase: number;
  fuse: number; // unstable 引信，<0 未点燃
  mines: Mine[];
  body: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
}

interface Pickup {
  x: number;
  y: number;
  type: 'star' | 'shield';
  img: Phaser.GameObjects.Image;
  halo: Phaser.GameObjects.Image;
}

const SPEED = 430;
const GRAVITY = 260;
const CAPTURE_BAND = 26;
const FUSE_TIME = 2.3;
const COMBO_WINDOW = 7;

export class GameScene extends Phaser.Scene {
  private mode: 'orbit' | 'fly' | 'dead' = 'orbit';

  private planets: Planet[] = [];
  private pickups: Pickup[] = [];
  private current!: Planet;
  private lastLeft: Planet | null = null;
  private leftTimer = 0;

  private angle = 0;
  private angVel = 0;
  private px = 0;
  private py = 0;
  private vx = 0;
  private vy = 0;

  private player!: Phaser.GameObjects.Container;
  private halo!: Phaser.GameObjects.Image;
  private trailCyan!: Phaser.GameObjects.Particles.ParticleEmitter;
  private trailGold!: Phaser.GameObjects.Particles.ParticleEmitter;
  private embers!: Phaser.GameObjects.Particles.ParticleEmitter;
  private fxWorld!: Phaser.GameObjects.Graphics;
  private fxVoid!: Phaser.GameObjects.Graphics;
  private bgFar!: Phaser.GameObjects.TileSprite;
  private bgNear!: Phaser.GameObjects.TileSprite;
  private nebula1!: Phaser.GameObjects.TileSprite;
  private nebula2!: Phaser.GameObjects.TileSprite;
  private nebTint = ZONES[0].tint;

  private voidY = 0;
  private elapsed = 0;
  private emberAcc = 0;
  private shootTimer = 3;
  private nextY = 0;
  private lastX = W / 2;
  private startY = 0;
  private topY = 0;

  private starCount = 0;
  private planetCount = 0;
  private planetScore = 0;
  private combo = 0;
  private comboTimer = 0;
  private maxCombo = 0;
  private shield = false;
  private invuln = 0;
  private zoneIdx = 0;
  private best = 0;

  private scoreText!: Phaser.GameObjects.Text;
  private subText!: Phaser.GameObjects.Text;
  private bestText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;

  constructor() {
    super('Game');
  }

  create() {
    // 重开一局时字段全部复位
    this.mode = 'orbit';
    this.planets = [];
    this.pickups = [];
    this.lastLeft = null;
    this.leftTimer = 0;
    this.elapsed = 0;
    this.emberAcc = 0;
    this.shootTimer = 3;
    this.starCount = 0;
    this.planetCount = 0;
    this.planetScore = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.maxCombo = 0;
    this.shield = false;
    this.invuln = 0;
    this.zoneIdx = 0;
    this.nebTint = ZONES[0].tint;
    this.best = Number(localStorage.getItem(BEST_KEY) ?? 0);

    // 背景：星云两层 + 星空两层 + 暗角
    this.nebula1 = this.add.tileSprite(W / 2, H / 2, W, H, 'nebula')
      .setScrollFactor(0).setAlpha(0.75).setTint(this.nebTint).setDepth(-2);
    this.nebula2 = this.add.tileSprite(W / 2, H / 2, W, H, 'nebula')
      .setScrollFactor(0).setAlpha(0.45).setTileScale(1.8).setTint(this.nebTint).setDepth(-1.5);
    this.bgFar = this.add.tileSprite(W / 2, H / 2, W, H, 'stars')
      .setScrollFactor(0).setAlpha(0.4).setTileScale(1.7).setDepth(-1);
    this.bgNear = this.add.tileSprite(W / 2, H / 2, W, H, 'stars')
      .setScrollFactor(0).setAlpha(0.8).setDepth(-0.5);
    this.add.image(W / 2, H / 2, 'vignette').setDisplaySize(W, H).setScrollFactor(0).setDepth(95);

    this.fxWorld = this.add.graphics().setDepth(3);
    this.fxVoid = this.add.graphics().setDepth(40);

    // 起始行星（永远是普通行星）
    const first = this.spawnPlanet(W / 2, 0, 96, 'normal');
    first.visited = true;
    this.current = first;
    this.angle = -Math.PI / 2;
    this.angVel = SPEED / first.orbitR;
    this.px = first.x + Math.cos(this.angle) * first.orbitR;
    this.py = first.y + Math.sin(this.angle) * first.orbitR;
    this.startY = this.py;
    this.topY = this.py;
    this.nextY = -300;
    this.lastX = first.x;

    // 玩家：辉光 + 白色内核 + 护盾光环
    const glow = this.add.image(0, 0, 'glow').setTint(PLAYER_COLOR).setAlpha(0.85)
      .setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(54, 54);
    const core = this.add.image(0, 0, 'circle').setDisplaySize(15, 15);
    this.halo = this.add.image(0, 0, 'ring').setTint(SHIELD_COLOR).setAlpha(0.9)
      .setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(40, 40).setVisible(false);
    this.player = this.add.container(this.px, this.py, [glow, core, this.halo]).setDepth(10);

    const trailCfg = {
      speed: { min: 0, max: 18 },
      lifespan: 380,
      scale: { start: 0.85, end: 0 },
      alpha: { start: 0.7, end: 0 },
      frequency: 16,
      blendMode: 'ADD',
    };
    this.trailCyan = this.add.particles(0, 0, 'dot', { ...trailCfg, tint: PLAYER_COLOR }).setDepth(9);
    this.trailCyan.startFollow(this.player);
    this.trailGold = this.add.particles(0, 0, 'dot', { ...trailCfg, tint: BOOST_COLOR, frequency: 10 }).setDepth(9);
    this.trailGold.startFollow(this.player);
    this.trailGold.stop();

    // 虚空边缘上飘的余烬
    this.embers = this.add.particles(0, 0, 'dot', {
      speed: { min: 20, max: 80 },
      angle: { min: 250, max: 290 },
      lifespan: { min: 500, max: 1000 },
      scale: { start: 0.7, end: 0 },
      alpha: { start: 0.8, end: 0 },
      tint: VOID_COLOR,
      blendMode: 'ADD',
      emitting: false,
    }).setDepth(41);

    this.cameras.main.setScroll(0, this.py - H * 0.62);
    this.voidY = this.py + 480;

    this.ensureSpawns();
    this.createUi();

    this.input.on('pointerdown', () => this.launch());
    this.input.keyboard?.on('keydown-SPACE', () => this.launch());
    this.input.keyboard?.addCapture('SPACE');
  }

  private createUi() {
    const mono = { fontFamily: 'Consolas, monospace' };
    this.scoreText = this.add.text(20, 16, '', { ...mono, fontSize: '30px', color: '#e8ecff', fontStyle: 'bold' })
      .setScrollFactor(0).setDepth(100).setShadow(0, 0, '#7df9ff', 10, false, true);
    this.subText = this.add.text(20, 54, '', { ...mono, fontSize: '19px', color: '#9fb3ff' })
      .setScrollFactor(0).setDepth(100);
    this.bestText = this.add.text(W - 20, 16, `最佳 ${this.best}`, { ...mono, fontSize: '19px', color: '#ffe066' })
      .setOrigin(1, 0).setScrollFactor(0).setDepth(100);
    this.comboText = this.add.text(W / 2, 108, '', {
      fontFamily: '"Microsoft YaHei", sans-serif',
      fontSize: '34px',
      fontStyle: 'bold',
      color: '#ffd24a',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(100).setShadow(0, 0, '#ff7a3d', 14, false, true).setVisible(false);
  }

  // ---------- 生成 ----------

  private spawnPlanet(x: number, y: number, orbitR: number, kind: Kind): Planet {
    const color = kind === 'boost' ? BOOST_COLOR : kind === 'unstable' ? UNSTABLE_COLOR
      : PALETTE[Phaser.Math.Between(0, PALETTE.length - 1)];
    const r = orbitR * Phaser.Math.FloatBetween(0.36, 0.48);
    const glow = this.add.image(x, y, 'glow').setTint(color).setAlpha(0.32)
      .setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(r * 5, r * 5).setDepth(1);
    const body = this.add.image(x, y, `planet${Phaser.Math.Between(0, 2)}`)
      .setDisplaySize(r * 2.06, r * 2.06).setRotation(Math.random() * Math.PI * 2).setDepth(2);
    if (kind === 'boost') body.setTint(0xfff3cf);
    if (kind === 'unstable') body.setTint(0xffd9c2);
    const p: Planet = {
      x, y, r, orbitR, baseOrbitR: orbitR, color, kind,
      visited: false, ringPhase: Math.random() * Math.PI * 2, fuse: -1, mines: [], body, glow,
    };
    this.planets.push(p);
    return p;
  }

  private addMines(p: Planet, count: number) {
    for (let i = 0; i < count; i++) {
      const img = this.add.image(p.x, p.y, 'mine').setTint(VOID_COLOR).setDisplaySize(24, 24).setDepth(5);
      p.mines.push({
        a: Math.random() * Math.PI * 2,
        sp: Phaser.Math.FloatBetween(0.7, 1.3) * (Math.random() < 0.5 ? 1 : -1),
        img,
      });
    }
  }

  private spawnPickup(x: number, y: number, type: 'star' | 'shield') {
    const color = type === 'star' ? STAR_COLOR : SHIELD_COLOR;
    const halo = this.add.image(x, y, 'glow').setTint(color).setAlpha(0.3)
      .setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(52, 52).setDepth(4);
    const img = this.add.image(x, y, type === 'star' ? 'star' : 'hex').setTint(color).setDepth(4);
    if (type === 'star') this.tweens.add({ targets: img, angle: 360, duration: 4000, repeat: -1 });
    else this.tweens.add({ targets: img, angle: 360, duration: 6000, repeat: -1 });
    this.tweens.add({ targets: img, scale: 1.25, duration: 600, yoyo: true, repeat: -1, ease: 'sine.inout' });
    this.pickups.push({ x, y, type, img, halo });
  }

  private heightAt(y: number) {
    return Math.max(0, Math.round((this.startY - y) / 10));
  }

  private ensureSpawns() {
    const camTop = this.cameras.main.scrollY;
    while (this.nextY > camTop - 900) {
      const h = this.heightAt(this.nextY);
      const roll = Math.random();
      const kind: Kind =
        h > 250 && roll < 0.13 ? 'unstable'
        : h > 100 && roll < 0.25 ? 'boost'
        : h > 150 && roll < 0.43 ? 'pulse'
        : 'normal';

      const orbitR = Phaser.Math.Between(62, 108);
      const x = Phaser.Math.Clamp(this.lastX + Phaser.Math.Between(-240, 240), 115, W - 115);
      const p = this.spawnPlanet(x, this.nextY, orbitR, kind);

      // 地雷只放在普通 / 脉冲行星上，越高越多
      if ((kind === 'normal' || kind === 'pulse') && h > 200) {
        const prob = Math.min(0.5, 0.12 + h / 1800);
        if (Math.random() < prob) this.addMines(p, h > 800 && Math.random() < 0.4 ? 2 : 1);
      }

      if (Math.random() < 0.6 && this.planets.length > 1) {
        const prev = this.planets[this.planets.length - 2];
        const sx = Phaser.Math.Clamp((prev.x + x) / 2 + Phaser.Math.Between(-70, 70), 40, W - 40);
        const sy = (prev.y + this.nextY) / 2 + Phaser.Math.Between(-50, 50);
        this.spawnPickup(sx, sy, Math.random() < 0.18 ? 'shield' : 'star');
      }
      this.lastX = x;
      this.nextY -= Phaser.Math.Between(250, 340);
    }

    // 清理远在屏幕下方的对象
    const cullY = this.cameras.main.scrollY + H + 400;
    this.planets = this.planets.filter((p) => {
      if (p.y > cullY && p !== this.current) {
        this.destroyPlanet(p);
        return false;
      }
      return true;
    });
    this.pickups = this.pickups.filter((s) => {
      if (s.y > cullY) {
        s.img.destroy();
        s.halo.destroy();
        return false;
      }
      return true;
    });
  }

  private destroyPlanet(p: Planet) {
    p.body.destroy();
    p.glow.destroy();
    p.mines.forEach((m) => m.img.destroy());
    p.mines = [];
  }

  // ---------- 玩法 ----------

  private launch(forced = false) {
    if (this.mode !== 'orbit' && !forced) return;
    this.mode = 'fly';
    const boost = this.current.kind === 'boost';
    const mul = forced ? 1.2 : boost ? 1.5 : 1;
    // v = ω × r：切线方向延续公转方向
    this.vx = -Math.sin(this.angle) * this.angVel * this.current.orbitR * mul;
    this.vy = Math.cos(this.angle) * this.angVel * this.current.orbitR * mul;
    this.lastLeft = this.current;
    this.leftTimer = 0.3;
    if (boost) {
      sfx.boost();
      this.trailCyan.stop();
      this.trailGold.start();
      this.shockwave(this.px, this.py, 70, BOOST_COLOR);
    } else {
      sfx.launch();
    }
    this.burst(this.px, this.py, boost ? BOOST_COLOR : PLAYER_COLOR, 10, 160);
  }

  private capture(p: Planet) {
    this.mode = 'orbit';
    this.current = p;
    this.angle = Math.atan2(this.py - p.y, this.px - p.x);
    // 用 r × v 的叉积决定公转方向，保证运动方向连续
    const rx = this.px - p.x;
    const ry = this.py - p.y;
    const cross = rx * this.vy - ry * this.vx;
    this.angVel = ((cross >= 0 ? 1 : -1) * SPEED) / p.orbitR;

    this.trailGold.stop();
    this.trailCyan.start();
    sfx.capture();
    this.cameras.main.shake(80, 0.0035);
    this.shockwave(p.x, p.y, p.orbitR, p.color);

    if (!p.visited) {
      p.visited = true;
      this.planetCount++;
      this.combo = this.comboTimer > 0 ? this.combo + 1 : 1;
      this.comboTimer = COMBO_WINDOW;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      const pts = 50 * this.combo;
      this.planetScore += pts;
      this.popup(p.x, p.y - p.orbitR - 18, this.combo > 1 ? `+${pts} ×${this.combo}` : `+${pts}`, '#7df9ff');
      if (this.combo >= 2) {
        sfx.comboBlip(this.combo);
        this.comboText.setVisible(true).setScale(1.5).setAlpha(1);
        this.tweens.add({ targets: this.comboText, scale: 1, duration: 220, ease: 'back.out' });
      }
    }

    // 不稳定行星：点燃引信
    if (p.kind === 'unstable' && p.fuse < 0) {
      p.fuse = FUSE_TIME;
      sfx.warning();
    }
  }

  /** 致命打击。返回 true 表示玩家真的死了；护盾 / 无敌帧可抵消 */
  private lethal(reason: string): boolean {
    if (this.invuln > 0) return false;
    if (this.shield) {
      this.shield = false;
      this.halo.setVisible(false);
      this.invuln = 1.2;
      sfx.shieldBreak();
      this.burst(this.px, this.py, SHIELD_COLOR, 18, 260);
      this.shockwave(this.px, this.py, 80, SHIELD_COLOR);
      return false;
    }
    this.die(reason);
    return true;
  }

  /** 返回 true 表示爆炸导致玩家死亡 */
  private explodePlanet(p: Planet): boolean {
    sfx.explosion();
    this.cameras.main.shake(260, 0.01);
    this.burst(p.x, p.y, UNSTABLE_COLOR, 40, 380);
    this.burst(p.x, p.y, 0xffffff, 18, 240);
    this.shockwave(p.x, p.y, p.orbitR + 60, UNSTABLE_COLOR);

    const blast = p.orbitR + 60;
    const d = Phaser.Math.Distance.Between(this.px, this.py, p.x, p.y);
    const wasAttached = this.current === p && this.mode === 'orbit';
    let died = false;
    if (d < blast) died = this.lethal('被超新星吞没');

    this.destroyPlanet(p);
    this.planets = this.planets.filter((x) => x !== p);
    if (this.lastLeft === p) this.lastLeft = null;

    // 护盾保命且仍挂在该轨道上：被冲击波弹射出去
    if (!died && wasAttached) this.launch(true);
    return died;
  }

  private collectPickup(s: Pickup) {
    if (s.type === 'star') {
      this.starCount++;
      sfx.star();
      this.burst(s.x, s.y, STAR_COLOR, 14, 220);
      this.popup(s.x, s.y - 14, '+100', '#ffe066');
    } else if (this.shield) {
      this.planetScore += 150;
      sfx.star();
      this.burst(s.x, s.y, SHIELD_COLOR, 10, 180);
      this.popup(s.x, s.y - 14, '+150', '#7dffd2');
    } else {
      this.shield = true;
      this.halo.setVisible(true);
      sfx.shield();
      this.burst(s.x, s.y, SHIELD_COLOR, 14, 220);
      this.popup(s.x, s.y - 14, '护盾！', '#7dffd2');
    }
    s.img.destroy();
    s.halo.destroy();
    this.pickups = this.pickups.filter((it) => it !== s);
  }

  private die(reason: string) {
    if (this.mode === 'dead') return;
    this.mode = 'dead';
    this.trailCyan.stop();
    this.trailGold.stop();
    this.player.setVisible(false);
    sfx.death();
    this.burst(this.px, this.py, PLAYER_COLOR, 46, 360);
    this.burst(this.px, this.py, VOID_COLOR, 24, 260);
    this.shockwave(this.px, this.py, 160, 0xffffff);
    this.cameras.main.shake(350, 0.012);
    this.cameras.main.flash(220, 255, 51, 85);

    const score = this.computeScore();
    const newBest = score > this.best;
    if (newBest) localStorage.setItem(BEST_KEY, String(score));

    this.time.delayedCall(1000, () => {
      this.scene.start('Over', {
        score,
        height: this.height(),
        stars: this.starCount,
        planets: this.planetCount,
        maxCombo: this.maxCombo,
        best: Math.max(this.best, score),
        newBest,
        reason,
      });
    });
  }

  private height() {
    return this.heightAt(this.topY);
  }

  private computeScore() {
    return this.height() + this.starCount * 100 + this.planetScore;
  }

  // ---------- 特效 ----------

  private burst(x: number, y: number, tint: number, count: number, maxSpeed: number) {
    const e = this.add.particles(x, y, 'dot', {
      speed: { min: 40, max: maxSpeed },
      angle: { min: 0, max: 360 },
      lifespan: { min: 300, max: 750 },
      scale: { start: 1.1, end: 0 },
      tint,
      blendMode: 'ADD',
      emitting: false,
    }).setDepth(20);
    e.explode(count);
    this.time.delayedCall(900, () => e.destroy());
  }

  private shockwave(x: number, y: number, toR: number, color: number) {
    const ring = this.add.image(x, y, 'ring').setTint(color).setAlpha(0.8)
      .setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(toR * 0.7, toR * 0.7).setDepth(21);
    this.tweens.add({
      targets: ring,
      displayWidth: toR * 2.4,
      displayHeight: toR * 2.4,
      alpha: 0,
      duration: 380,
      ease: 'cubic.out',
      onComplete: () => ring.destroy(),
    });
  }

  private popup(x: number, y: number, str: string, color: string) {
    const t = this.add.text(x, y, str, {
      fontFamily: 'Consolas, monospace',
      fontSize: '24px',
      fontStyle: 'bold',
      color,
    }).setOrigin(0.5).setDepth(60);
    this.tweens.add({ targets: t, y: y - 46, alpha: 0, duration: 800, ease: 'cubic.out', onComplete: () => t.destroy() });
  }

  private popupCenter(str: string, color: string) {
    const t = this.add.text(W / 2, 300, str, {
      fontFamily: '"Microsoft YaHei", sans-serif',
      fontSize: '38px',
      fontStyle: 'bold',
      color,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(100).setAlpha(0).setShadow(0, 0, color, 16, false, true);
    this.tweens.add({
      targets: t, alpha: 1, y: 280, duration: 400, ease: 'cubic.out',
      onComplete: () => this.tweens.add({ targets: t, alpha: 0, y: 260, delay: 900, duration: 500, onComplete: () => t.destroy() }),
    });
  }

  private setZone(idx: number) {
    this.zoneIdx = idx;
    const zone = ZONES[idx];
    this.popupCenter(`—— ${zone.name} ——`, '#e8ecff');
    sfx.capture();
    const from = Phaser.Display.Color.IntegerToColor(this.nebTint);
    const to = Phaser.Display.Color.IntegerToColor(zone.tint);
    this.nebTint = zone.tint;
    this.tweens.addCounter({
      from: 0, to: 1, duration: 1500,
      onUpdate: (tw) => {
        const v = tw.getValue() ?? 0;
        const c = Phaser.Display.Color.Interpolate.ColorWithColor(from, to, 1, v);
        const tint = Phaser.Display.Color.GetColor(c.r, c.g, c.b);
        this.nebula1.setTint(tint);
        this.nebula2.setTint(tint);
      },
    });
  }

  private spawnShootingStar() {
    const ang = Phaser.Math.FloatBetween(0.35, 0.55);
    const x = Phaser.Math.Between(0, Math.floor(W * 0.8));
    const y = Phaser.Math.Between(40, Math.floor(H * 0.45));
    const img = this.add.image(x, y, 'dot').setDisplaySize(90, 2.5).setRotation(ang)
      .setAlpha(0).setScrollFactor(0).setTint(0xcfe7ff).setBlendMode(Phaser.BlendModes.ADD).setDepth(0.6);
    this.tweens.add({ targets: img, alpha: 0.9, duration: 250, yoyo: true });
    this.tweens.add({
      targets: img,
      x: x + Math.cos(ang) * 260,
      y: y + Math.sin(ang) * 260,
      duration: 620,
      ease: 'sine.in',
      onComplete: () => img.destroy(),
    });
  }

  // ---------- 主循环 ----------

  update(_time: number, delta: number) {
    const dt = Math.min(delta / 1000, 0.05);
    const cam = this.cameras.main;

    this.bgFar.tilePositionY = cam.scrollY * 0.12;
    this.bgNear.tilePositionY = cam.scrollY * 0.3;
    this.nebula1.tilePositionY = cam.scrollY * 0.05;
    this.nebula2.tilePositionY = cam.scrollY * 0.085;

    if (this.mode === 'dead') {
      this.drawVoid();
      return;
    }

    this.elapsed += dt;
    this.leftTimer -= dt;
    this.invuln -= dt;

    // 连击窗口
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0 && this.combo > 0) {
        this.combo = 0;
        this.tweens.add({ targets: this.comboText, alpha: 0, duration: 300, onComplete: () => this.comboText.setVisible(false) });
      }
    }

    // 行星状态：脉冲伸缩 / 地雷公转 / 引信倒计时
    const exploding: Planet[] = [];
    for (const p of this.planets) {
      if (p.kind === 'pulse') {
        p.orbitR = p.baseOrbitR + Math.sin(this.elapsed * 1.7 + p.ringPhase) * 9;
      }
      for (const m of p.mines) {
        m.a += m.sp * dt;
        m.img.setPosition(p.x + Math.cos(m.a) * p.orbitR, p.y + Math.sin(m.a) * p.orbitR);
        m.img.rotation += dt * 3;
      }
      if (p.fuse > 0) {
        p.fuse -= dt;
        p.body.setAlpha(0.6 + 0.4 * Math.sin(this.elapsed * (34 - p.fuse * 10)));
        if (p.fuse <= 0) exploding.push(p);
      }
    }
    for (const p of exploding) {
      if (this.explodePlanet(p)) return;
    }

    if (this.mode === 'orbit') {
      this.angle += this.angVel * dt;
      this.px = this.current.x + Math.cos(this.angle) * this.current.orbitR;
      this.py = this.current.y + Math.sin(this.angle) * this.current.orbitR;
    } else {
      this.vy += GRAVITY * dt;
      this.px += this.vx * dt;
      this.py += this.vy * dt;
      this.px = Phaser.Math.Wrap(this.px, -20, W + 20);

      for (const p of this.planets) {
        if (p === this.lastLeft && this.leftTimer > 0) continue;
        const d = Phaser.Math.Distance.Between(this.px, this.py, p.x, p.y);
        if (d < p.r + 9) {
          if (this.lethal('撞上了行星本体')) return;
          continue;
        }
        if (Math.abs(d - p.orbitR) < CAPTURE_BAND) {
          this.capture(p);
          break;
        }
      }
    }

    // 地雷碰撞（公转与飞行都判定）
    for (const p of this.planets) {
      for (const m of [...p.mines]) {
        if (Phaser.Math.Distance.Between(this.px, this.py, m.img.x, m.img.y) < 17) {
          if (this.lethal('触雷坠毁')) return;
          // 护盾 / 无敌帧扛住：地雷被引爆清除
          this.burst(m.img.x, m.img.y, VOID_COLOR, 12, 200);
          m.img.destroy();
          p.mines = p.mines.filter((x) => x !== m);
        }
      }
    }

    // 玩家姿态：飞行时沿速度方向拉伸，无敌帧闪烁
    if (this.mode === 'fly') {
      this.player.setRotation(Math.atan2(this.vy, this.vx));
      this.player.setScale(1.22, 0.85);
    } else {
      this.player.setRotation(this.angle + (this.angVel > 0 ? Math.PI / 2 : -Math.PI / 2));
      this.player.setScale(1);
    }
    this.player.setAlpha(this.invuln > 0 ? 0.55 + 0.45 * Math.sin(this.elapsed * 22) : 1);
    this.halo.rotation += dt * 1.5;
    this.player.setPosition(this.px, this.py);
    this.topY = Math.min(this.topY, this.py);

    // 摄像机只向上推进
    const target = this.py - H * 0.6;
    if (target < cam.scrollY) {
      cam.scrollY += (target - cam.scrollY) * Math.min(1, dt * 5);
    }

    // 拾取
    for (const s of [...this.pickups]) {
      if (Phaser.Math.Distance.Between(this.px, this.py, s.x, s.y) < 28) this.collectPickup(s);
    }

    // 虚空上涌：随时间与区域加速，且不会落后摄像机太远
    const voidSpeed = Math.min(165, 28 + this.elapsed * 1.3 + this.zoneIdx * 12);
    this.voidY -= voidSpeed * dt;
    this.voidY = Math.min(this.voidY, cam.scrollY + H + 260);
    if (this.py > this.voidY + 4) {
      this.die('被虚空吞噬');
      return;
    }

    // 虚空余烬
    this.emberAcc += dt;
    while (this.emberAcc > 0.07) {
      this.emberAcc -= 0.07;
      if (this.voidY < cam.scrollY + H + 40) {
        this.embers.emitParticleAt(Phaser.Math.Between(-20, W + 20), this.voidY + Phaser.Math.Between(0, 8));
      }
    }

    // 流星
    this.shootTimer -= dt;
    if (this.shootTimer <= 0) {
      this.shootTimer = Phaser.Math.FloatBetween(2.5, 6);
      this.spawnShootingStar();
    }

    // 高度区域推进
    const h = this.height();
    let zi = 0;
    for (let i = 0; i < ZONES.length; i++) if (h >= ZONES[i].at) zi = i;
    if (zi > this.zoneIdx) this.setZone(zi);

    this.ensureSpawns();
    this.drawWorld();
    this.drawVoid();

    this.scoreText.setText(`分数 ${this.computeScore()}`);
    this.subText.setText(`高度 ${h}m   ★ ${this.starCount}${this.shield ? '   [护盾]' : ''}`);
    if (this.combo >= 2) this.comboText.setText(`连击 ×${this.combo}`);
    if (this.computeScore() > this.best) this.bestText.setColor('#7dffa0');
  }

  private drawWorld() {
    const cam = this.cameras.main;
    const g = this.fxWorld;
    g.clear();

    for (const p of this.planets) {
      if (p.y < cam.scrollY - 220 || p.y > cam.scrollY + H + 220) continue;
      const pulse = 0.1 * Math.sin(this.elapsed * 2.4 + p.ringPhase);

      // 本体霓虹轮廓：宽辉光描边 + 细亮描边
      g.lineStyle(6, p.color, 0.2);
      g.strokeCircle(p.x, p.y, p.r + 1);
      g.lineStyle(2.5, p.color, 0.95);
      g.strokeCircle(p.x, p.y, p.r);

      // 轨道环
      if (p.kind === 'unstable') {
        const flick = p.fuse > 0 ? Math.random() * 0.6 + 0.3 : 0.3 + 0.15 * Math.sin(this.elapsed * 6 + p.ringPhase);
        g.lineStyle(1.8, p.color, flick);
        g.strokeCircle(p.x, p.y, p.orbitR);
        if (p.fuse > 0) {
          // 引信弧：顺时针收缩到爆炸
          g.lineStyle(3.5, 0xffffff, 0.9);
          g.beginPath();
          g.arc(p.x, p.y, p.orbitR + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (p.fuse / FUSE_TIME));
          g.strokePath();
        }
      } else if (p.kind === 'boost') {
        g.lineStyle(1.8, p.color, 0.5 + pulse);
        g.strokeCircle(p.x, p.y, p.orbitR);
        // 旋转的能量短弧
        g.lineStyle(3, p.color, 0.85);
        for (let k = 0; k < 8; k++) {
          const a = this.elapsed * 1.4 + (k * Math.PI) / 4;
          g.beginPath();
          g.arc(p.x, p.y, p.orbitR, a, a + 0.22);
          g.strokePath();
        }
      } else {
        g.lineStyle(1.6, p.color, 0.3 + pulse);
        g.strokeCircle(p.x, p.y, p.orbitR);
        if (p.kind === 'pulse') {
          g.lineStyle(1, p.color, 0.14);
          g.strokeCircle(p.x, p.y, p.baseOrbitR);
        }
      }
    }

    // 公转时画虚线瞄准线
    if (this.mode === 'orbit') {
      const dx = -Math.sin(this.angle) * Math.sign(this.angVel);
      const dy = Math.cos(this.angle) * Math.sign(this.angVel);
      const color = this.current.kind === 'boost' ? BOOST_COLOR : PLAYER_COLOR;
      g.lineStyle(2, color, 0.65);
      for (let i = 0; i < 5; i++) {
        const a = 20 + i * 22;
        g.lineBetween(this.px + dx * a, this.py + dy * a, this.px + dx * (a + 12), this.py + dy * (a + 12));
      }
    }
  }

  private drawVoid() {
    const cam = this.cameras.main;
    const g = this.fxVoid;
    g.clear();
    const bottom = cam.scrollY + H + 60;
    if (this.voidY > bottom) return;

    // 波动的吞噬面
    const crest: { x: number; y: number }[] = [];
    for (let x = -30; x <= W + 30; x += 20) {
      crest.push({ x, y: this.voidY + Math.sin(x * 0.02 + this.elapsed * 2.8) * 7 });
    }
    const poly = [...crest, { x: W + 30, y: bottom }, { x: -30, y: bottom }];
    g.fillStyle(VOID_COLOR, 0.16);
    g.fillPoints(poly, true);
    g.lineStyle(9, VOID_COLOR, 0.22);
    g.strokePoints(crest, false);
    g.lineStyle(3, VOID_COLOR, 0.95);
    g.strokePoints(crest, false);
  }
}
