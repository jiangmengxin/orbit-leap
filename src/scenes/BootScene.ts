import Phaser from 'phaser';

/**
 * 程序化生成全部贴图：粒子、辉光、星空、星云、暗角、
 * 三种行星表面纹理、地雷、护盾六边形、冲击波环。零外部资源。
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    const g = this.add.graphics();

    // 粒子点
    g.fillStyle(0xffffff, 1);
    g.fillCircle(4, 4, 4);
    g.generateTexture('dot', 8, 8);
    g.clear();

    // 通用实心圆
    g.fillStyle(0xffffff, 1);
    g.fillCircle(32, 32, 32);
    g.generateTexture('circle', 64, 64);
    g.clear();

    // 冲击波 / 光环
    g.lineStyle(6, 0xffffff, 1);
    g.strokeCircle(32, 32, 28);
    g.generateTexture('ring', 64, 64);
    g.clear();

    // 五角星
    const starPts: { x: number; y: number }[] = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 11 : 4.8;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      starPts.push({ x: 12 + Math.cos(a) * r, y: 12 + Math.sin(a) * r });
    }
    g.fillStyle(0xffffff, 1);
    g.fillPoints(starPts, true);
    g.generateTexture('star', 24, 24);
    g.clear();

    // 护盾六边形
    const hexPts: { x: number; y: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 3;
      hexPts.push({ x: 12 + Math.cos(a) * 9.5, y: 12 + Math.sin(a) * 9.5 });
    }
    g.fillStyle(0xffffff, 0.22);
    g.fillPoints(hexPts, true);
    g.lineStyle(2.5, 0xffffff, 1);
    g.strokePoints(hexPts, true, true);
    g.generateTexture('hex', 24, 24);
    g.clear();

    // 轨道地雷：圆核 + 8 根尖刺
    g.lineStyle(2.5, 0xffffff, 1);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      g.lineBetween(12 + Math.cos(a) * 3, 12 + Math.sin(a) * 3, 12 + Math.cos(a) * 10.5, 12 + Math.sin(a) * 10.5);
    }
    g.fillStyle(0xffffff, 1);
    g.fillCircle(12, 12, 5);
    g.generateTexture('mine', 24, 24);
    g.destroy();

    // 径向渐变辉光
    const glow = this.textures.createCanvas('glow', 128, 128);
    if (glow) {
      const ctx = glow.getContext();
      const grd = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      grd.addColorStop(0, 'rgba(255,255,255,1)');
      grd.addColorStop(0.3, 'rgba(255,255,255,0.5)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, 128, 128);
      glow.refresh();
    }

    // 可平铺星空底纹
    const stars = this.textures.createCanvas('stars', 256, 256);
    if (stars) {
      const ctx = stars.getContext();
      for (let i = 0; i < 60; i++) {
        const x = Math.random() * 256;
        const y = Math.random() * 256;
        const r = Math.random() * 1.2 + 0.4;
        ctx.fillStyle = `rgba(255,255,255,${(Math.random() * 0.7 + 0.15).toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      stars.refresh();
    }

    // 星云：白色低透明度团块，运行时整体着色
    const nebula = this.textures.createCanvas('nebula', 512, 512);
    if (nebula) {
      const ctx = nebula.getContext();
      for (let i = 0; i < 10; i++) {
        const r = 70 + Math.random() * 120;
        const x = r + Math.random() * (512 - 2 * r);
        const y = r + Math.random() * (512 - 2 * r);
        const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
        grd.addColorStop(0, `rgba(255,255,255,${(0.05 + Math.random() * 0.07).toFixed(3)})`);
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grd;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      nebula.refresh();
    }

    // 暗角
    const vig = this.textures.createCanvas('vignette', 512, 512);
    if (vig) {
      const ctx = vig.getContext();
      const grd = ctx.createRadialGradient(256, 256, 0, 256, 256, 360);
      grd.addColorStop(0, 'rgba(0,0,0,0)');
      grd.addColorStop(0.55, 'rgba(0,0,0,0)');
      grd.addColorStop(1, 'rgba(2,3,12,0.85)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, 512, 512);
      vig.refresh();
    }

    // 三种行星表面：气流带 / 陨石坑 / 漩涡弧线
    for (let v = 0; v < 3; v++) this.makePlanetTexture(`planet${v}`, v);

    this.scene.start('Menu');
  }

  private makePlanetTexture(key: string, variant: number) {
    const S = 160;
    const R = 78;
    const tex = this.textures.createCanvas(key, S, S);
    if (!tex) return;
    const ctx = tex.getContext();
    ctx.save();
    ctx.beginPath();
    ctx.arc(80, 80, R, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#10142a';
    ctx.fillRect(0, 0, S, S);

    if (variant === 0) {
      // 横向气流带
      for (let i = 0; i < 7; i++) {
        const y = 14 + i * 22 + Math.random() * 8;
        ctx.fillStyle = `rgba(150,165,255,${(0.05 + Math.random() * 0.06).toFixed(3)})`;
        ctx.beginPath();
        ctx.ellipse(80, y, R + 10, 8 + Math.random() * 7, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (variant === 1) {
      // 陨石坑
      for (let i = 0; i < 10; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * R * 0.8;
        const cx = 80 + Math.cos(a) * d;
        const cy = 80 + Math.sin(a) * d;
        const cr = 3 + Math.random() * 9;
        ctx.fillStyle = 'rgba(5,7,18,0.6)';
        ctx.beginPath();
        ctx.arc(cx, cy, cr, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(170,185,255,0.1)';
        ctx.beginPath();
        ctx.arc(cx - cr * 0.25, cy - cr * 0.25, cr * 0.55, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // 漩涡弧线
      for (let i = 0; i < 9; i++) {
        ctx.strokeStyle = `rgba(150,165,255,${(0.05 + Math.random() * 0.07).toFixed(3)})`;
        ctx.lineWidth = 2 + Math.random() * 4;
        ctx.beginPath();
        const rr = 10 + Math.random() * R * 0.9;
        const st = Math.random() * Math.PI * 2;
        ctx.arc(80, 80, rr, st, st + 1 + Math.random() * 2.5);
        ctx.stroke();
      }
    }

    // 左上光照 + 边缘投影
    const grd = ctx.createRadialGradient(58, 54, 8, 80, 80, R + 4);
    grd.addColorStop(0, 'rgba(255,255,255,0.16)');
    grd.addColorStop(0.5, 'rgba(255,255,255,0.02)');
    grd.addColorStop(1, 'rgba(0,0,10,0.6)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, S, S);
    ctx.restore();
    tex.refresh();
  }
}
