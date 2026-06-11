import Phaser from 'phaser';
import { W, H, PLAYER_COLOR, VOID_COLOR, BOOST_COLOR, UNSTABLE_COLOR, SHIELD_COLOR, BEST_KEY } from '../constants';
import { sfx } from '../sfx';

export class MenuScene extends Phaser.Scene {
  private demoDot!: Phaser.GameObjects.Container;
  private demoCx = W / 2;
  private demoCy = 432;
  private demoR = 92;

  constructor() {
    super('Menu');
  }

  create() {
    this.add.tileSprite(W / 2, H / 2, W, H, 'nebula').setAlpha(0.75).setTint(0x9b5dff);
    this.add.tileSprite(W / 2, H / 2, W, H, 'nebula').setAlpha(0.4).setTileScale(1.8).setTint(0x5d8fff);
    this.add.tileSprite(W / 2, H / 2, W, H, 'stars').setAlpha(0.8);
    this.add.tileSprite(W / 2, H / 2, W, H, 'stars').setAlpha(0.4).setTileScale(1.7);

    // 演示行星 + 轨道环
    this.add.image(this.demoCx, this.demoCy, 'glow')
      .setTint(0x9b5dff).setAlpha(0.4).setBlendMode(Phaser.BlendModes.ADD)
      .setDisplaySize(210, 210);
    this.add.image(this.demoCx, this.demoCy, 'planet0').setDisplaySize(82, 82);
    const ring = this.add.graphics();
    ring.lineStyle(2.5, 0x9b5dff, 0.9).strokeCircle(this.demoCx, this.demoCy, 40);
    ring.lineStyle(1.5, 0x9b5dff, 0.35).strokeCircle(this.demoCx, this.demoCy, this.demoR);

    const glow = this.add.image(0, 0, 'glow').setTint(PLAYER_COLOR).setAlpha(0.8)
      .setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(52, 52);
    const core = this.add.image(0, 0, 'circle').setDisplaySize(16, 16);
    this.demoDot = this.add.container(0, 0, [glow, core]);

    this.add.text(W / 2, 160, '轨道跃迁', {
      fontFamily: '"Microsoft YaHei", sans-serif',
      fontSize: '72px',
      fontStyle: 'bold',
      color: '#e8ecff',
    }).setOrigin(0.5).setShadow(0, 0, '#7df9ff', 24, false, true);

    this.add.text(W / 2, 228, 'O R B I T   L E A P', {
      fontFamily: 'Consolas, monospace',
      fontSize: '22px',
      color: '#7df9ff',
    }).setOrigin(0.5);

    this.add.text(W / 2, 570, '点击 / 空格 脱离轨道 · 连续跃迁可获连击加分', {
      fontFamily: '"Microsoft YaHei", sans-serif',
      fontSize: '20px',
      color: '#9fb3ff',
    }).setOrigin(0.5);

    // 机制图例
    const legend: { icon: string; tint: number; label: string; spin?: boolean }[] = [
      { icon: 'mine', tint: VOID_COLOR, label: '轨道地雷 —— 碰到即坠毁', spin: true },
      { icon: 'ring', tint: BOOST_COLOR, label: '金色行星 —— 1.5 倍强力弹射' },
      { icon: 'circle', tint: UNSTABLE_COLOR, label: '不稳定行星 —— 捕获后即将爆炸' },
      { icon: 'hex', tint: SHIELD_COLOR, label: '护盾 —— 抵挡一次致命撞击' },
    ];
    legend.forEach((item, i) => {
      const y = 622 + i * 40;
      const icon = this.add.image(W / 2 - 168, y, item.icon).setTint(item.tint).setDisplaySize(22, 22);
      if (item.spin) this.tweens.add({ targets: icon, angle: 360, duration: 5000, repeat: -1 });
      this.add.text(W / 2 - 144, y, item.label, {
        fontFamily: '"Microsoft YaHei", sans-serif',
        fontSize: '18px',
        color: '#9fb3ff',
      }).setOrigin(0, 0.5);
    });

    const best = Number(localStorage.getItem(BEST_KEY) ?? 0);
    if (best > 0) {
      this.add.text(W / 2, 800, `最佳纪录  ${best}`, {
        fontFamily: 'Consolas, monospace',
        fontSize: '22px',
        color: '#ffe066',
      }).setOrigin(0.5);
    }

    const prompt = this.add.text(W / 2, 860, '— 点击任意处开始 —', {
      fontFamily: '"Microsoft YaHei", sans-serif',
      fontSize: '24px',
      color: '#e8ecff',
    }).setOrigin(0.5);
    this.tweens.add({ targets: prompt, alpha: 0.25, duration: 700, yoyo: true, repeat: -1 });

    this.add.image(W / 2, H / 2, 'vignette').setDisplaySize(W, H).setDepth(95);

    const start = () => {
      sfx.click();
      this.scene.start('Game');
    };
    this.input.once('pointerdown', start);
    this.input.keyboard?.once('keydown-SPACE', start);
    this.input.keyboard?.addCapture('SPACE');
  }

  update(time: number) {
    const a = (time / 1000) * 1.5;
    this.demoDot.setPosition(this.demoCx + Math.cos(a) * this.demoR, this.demoCy + Math.sin(a) * this.demoR);
  }
}
