import Phaser from 'phaser';
import { W, H } from './constants';
import { sfx } from './sfx';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { GameOverScene } from './scenes/GameOverScene';

// 离线支持：注册 Service Worker（仅生产构建；开发时避免缓存干扰热更新）
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

// 移动端浏览器要求 AudioContext 在用户手势内激活
window.addEventListener('pointerdown', () => sfx.unlock(), { once: true });

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  width: W,
  height: H,
  backgroundColor: '#05060f',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, MenuScene, GameScene, GameOverScene],
});

// 供调试 / 自动化测试使用
(window as unknown as { __game: Phaser.Game }).__game = game;
