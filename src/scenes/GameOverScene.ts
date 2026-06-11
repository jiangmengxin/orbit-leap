import Phaser from 'phaser';
import { W, H } from '../constants';
import { sfx } from '../sfx';

interface OverData {
  score: number;
  height: number;
  stars: number;
  planets: number;
  maxCombo: number;
  best: number;
  newBest: boolean;
  reason: string;
}

export class GameOverScene extends Phaser.Scene {
  private data2!: OverData;

  constructor() {
    super('Over');
  }

  init(data: OverData) {
    this.data2 = data;
  }

  create() {
    const d = this.data2;
    this.add.tileSprite(W / 2, H / 2, W, H, 'nebula').setAlpha(0.6).setTint(0xff5d6e);
    this.add.tileSprite(W / 2, H / 2, W, H, 'stars').setAlpha(0.5);

    this.add.text(W / 2, 220, '坠 落', {
      fontFamily: '"Microsoft YaHei", sans-serif',
      fontSize: '64px',
      fontStyle: 'bold',
      color: '#ff5d7d',
    }).setOrigin(0.5).setShadow(0, 0, '#ff3355', 22, false, true);

    this.add.text(W / 2, 286, d.reason, {
      fontFamily: '"Microsoft YaHei", sans-serif',
      fontSize: '20px',
      color: '#9fb3ff',
    }).setOrigin(0.5);

    const score = this.add.text(W / 2, 408, `${d.score}`, {
      fontFamily: 'Consolas, monospace',
      fontSize: '88px',
      fontStyle: 'bold',
      color: '#e8ecff',
    }).setOrigin(0.5).setShadow(0, 0, '#7df9ff', 18, false, true);
    score.setScale(0);
    this.tweens.add({ targets: score, scale: 1, duration: 450, ease: 'back.out' });

    if (d.newBest) {
      const nb = this.add.text(W / 2, 480, '★ 新纪录 ★', {
        fontFamily: '"Microsoft YaHei", sans-serif',
        fontSize: '26px',
        color: '#ffe066',
      }).setOrigin(0.5);
      this.tweens.add({ targets: nb, alpha: 0.4, duration: 500, yoyo: true, repeat: -1 });
    } else {
      this.add.text(W / 2, 480, `最佳 ${d.best}`, {
        fontFamily: 'Consolas, monospace',
        fontSize: '22px',
        color: '#ffe066',
      }).setOrigin(0.5);
    }

    this.add.text(W / 2, 560, `高度 ${d.height}m    星星 ${d.stars} × 100    行星 ${d.planets}`, {
      fontFamily: '"Microsoft YaHei", sans-serif',
      fontSize: '19px',
      color: '#9fb3ff',
    }).setOrigin(0.5);

    if (d.maxCombo >= 2) {
      this.add.text(W / 2, 596, `最高连击 ×${d.maxCombo}`, {
        fontFamily: '"Microsoft YaHei", sans-serif',
        fontSize: '19px',
        color: '#ffd24a',
      }).setOrigin(0.5);
    }

    const retry = this.add.text(W / 2, 720, '— 点击 / 空格 再来一次 —', {
      fontFamily: '"Microsoft YaHei", sans-serif',
      fontSize: '26px',
      color: '#e8ecff',
    }).setOrigin(0.5);
    this.tweens.add({ targets: retry, alpha: 0.3, duration: 650, yoyo: true, repeat: -1 });

    this.add.text(W / 2, 778, '按 M 返回菜单', {
      fontFamily: '"Microsoft YaHei", sans-serif',
      fontSize: '18px',
      color: '#5d6a99',
    }).setOrigin(0.5);

    this.add.image(W / 2, H / 2, 'vignette').setDisplaySize(W, H).setDepth(95);

    // 稍作延迟，避免死亡瞬间的点击误触重开
    this.time.delayedCall(400, () => {
      const restart = () => {
        sfx.click();
        this.scene.start('Game');
      };
      this.input.once('pointerdown', restart);
      this.input.keyboard?.once('keydown-SPACE', restart);
      this.input.keyboard?.once('keydown-M', () => {
        sfx.click();
        this.scene.start('Menu');
      });
    });
  }
}
