export const W = 540;
export const H = 960;

/** 霓虹行星配色 */
export const PALETTE = [0xff5d8f, 0x9b5dff, 0x5d8fff, 0xffa05d, 0x5dffc3];

export const PLAYER_COLOR = 0x7df9ff;
export const VOID_COLOR = 0xff3355;
export const STAR_COLOR = 0xffe066;
export const BOOST_COLOR = 0xffd24a;
export const UNSTABLE_COLOR = 0xff7a3d;
export const SHIELD_COLOR = 0x7dffd2;

export const BEST_KEY = 'orbit-leap-best';

/** 高度区域：到达 at（米）切换名称与星云色调，虚空随区域加速 */
export const ZONES = [
  { name: '近地轨道', tint: 0x9b5dff, at: 0 },
  { name: '电离层', tint: 0x5dc8ff, at: 400 },
  { name: '深空', tint: 0x5d8fff, at: 800 },
  { name: '星云带', tint: 0xff5dd2, at: 1200 },
  { name: '幽蓝远域', tint: 0x7d5dff, at: 1600 },
  { name: '虚空边境', tint: 0xff5d6e, at: 2000 },
];
