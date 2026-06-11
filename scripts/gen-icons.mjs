/**
 * 程序化生成 PWA 图标：纯 Node（zlib + 手写 PNG 编码），零外部资源。
 * 主视觉与游戏一致：深空底 + 紫色行星 + 青色轨道环 + 轨道光点。
 * 用法：node scripts/gen-icons.mjs   （输出到 public/icons/）
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

// ---------- PNG 编码 ----------
const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'latin1'), data])), 0);
  return Buffer.concat([head, data, crc]);
}
function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  // 每行前置 filter byte 0
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- 绘制工具 ----------
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (e0, e1, x) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
// 确定性伪随机（星点位置可复现）
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 0xffffffff);
}
const rand = rng(20260611);
const STARS = Array.from({ length: 46 }, () => ({
  x: rand(),
  y: rand(),
  r: 0.003 + rand() * 0.006,
  a: 0.35 + rand() * 0.6,
}));

/** 单像素着色，uv ∈ [0,1]，aa 为约 1px 的归一化宽度 */
function shade(u, v, aa, contentScale) {
  // 背景：左上偏亮的深空渐变 + 暗角
  const bgT = Math.hypot(u - 0.32, v - 0.26) / 1.05;
  let col = mix([26, 30, 66], [5, 6, 15], smooth(0, 1, bgT));
  const vig = smooth(0.55, 1.0, Math.hypot(u - 0.5, v - 0.5) * 1.42);
  col = mix(col, [3, 4, 10], vig * 0.7);

  // 星点
  for (const s of STARS) {
    const d = Math.hypot(u - s.x, v - s.y);
    const lit = (1 - smooth(s.r * 0.4, s.r + aa, d)) * s.a;
    if (lit > 0) col = mix(col, [225, 235, 255], lit);
  }

  // 内容坐标（maskable 时整体向中心收缩，留出安全区）
  const cu = (u - 0.5) / contentScale + 0.5;
  const cv = (v - 0.5) / contentScale + 0.5;
  const caa = aa / contentScale;

  const px = 0.42, py = 0.6; // 行星中心
  const pr = 0.215; // 行星半径
  const ringR = 0.355; // 轨道环半径

  const dp = Math.hypot(cu - px, cv - py);
  const dRing = Math.abs(dp - ringR);

  // 轨道环辉光（行星会盖在其上方）
  const glow = (1 - smooth(0.0, 0.085, dRing)) * 0.32;
  col = mix(col, [125, 249, 255], glow);

  // 行星：紫色基底 + 左上光照 + 两条气流暗带
  const inPlanet = 1 - smooth(pr - caa, pr + caa, dp);
  if (inPlanet > 0) {
    const lx = (cu - (px - pr * 0.45)) / pr;
    const ly = (cv - (py - pr * 0.45)) / pr;
    const light = 1 - smooth(0.1, 1.5, Math.hypot(lx, ly));
    let pc = mix([86, 42, 158], [203, 150, 255], light);
    // 气流带：沿斜向的两条暗纹
    const band = Math.sin(((cu - px) * 0.7 + (cv - py)) / pr * 5.2);
    pc = mix(pc, [58, 26, 112], smooth(0.55, 0.9, band) * 0.5);
    // 边缘大气光
    const rim = 1 - smooth(0.0, 0.07, pr - dp);
    pc = mix(pc, [190, 140, 255], rim * 0.55);
    col = mix(col, pc, inPlanet);
  }

  // 轨道环实线（行星外侧部分压在行星之上也无妨，环穿过行星前后增强立体感：
  // 仅在行星外或环的"前半段"绘制——用左下到右上的方向判定前后）
  const front = (cu - px) - (cv - py) > -0.02; // 右上为前
  if (dp > pr - caa || front) {
    const line = 1 - smooth(0.012, 0.012 + caa * 1.5, dRing);
    col = mix(col, [125, 249, 255], line * 0.95);
  }

  // 玩家光点：环上 -45°（右上）
  const ang = -Math.PI / 4;
  const dx0 = px + Math.cos(ang) * ringR;
  const dy0 = py + Math.sin(ang) * ringR;
  const dd = Math.hypot(cu - dx0, cv - dy0);
  col = mix(col, [125, 249, 255], (1 - smooth(0.02, 0.1, dd)) * 0.55); // 辉光
  col = mix(col, [240, 254, 255], 1 - smooth(0.028, 0.028 + caa * 2, dd)); // 核心

  // 金色小星形点缀（左上）
  const sx = Math.abs(cu - 0.18), sy = Math.abs(cv - 0.2);
  const diamond = sx + sy + Math.hypot(sx, sy) * 1.2;
  col = mix(col, [255, 210, 74], 1 - smooth(0.02, 0.05, diamond));

  return col;
}

function render(size, contentScale) {
  const rgba = Buffer.alloc(size * size * 4);
  const aa = 1.1 / size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const col = shade((x + 0.5) / size, (y + 0.5) / size, aa, contentScale);
      const i = (y * size + x) * 4;
      rgba[i] = Math.round(clamp01(col[0] / 255) * 255);
      rgba[i + 1] = Math.round(clamp01(col[1] / 255) * 255);
      rgba[i + 2] = Math.round(clamp01(col[2] / 255) * 255);
      rgba[i + 3] = 255;
    }
  }
  return encodePng(size, rgba);
}

mkdirSync(OUT, { recursive: true });
const jobs = [
  ['icon-512.png', 512, 1],
  ['icon-192.png', 192, 1],
  ['icon-maskable-512.png', 512, 0.74], // 内容收缩进 maskable 安全区
  ['apple-touch-icon.png', 180, 0.92],
  ['favicon-64.png', 64, 1],
];
for (const [name, size, scale] of jobs) {
  const png = render(size, scale);
  writeFileSync(join(OUT, name), png);
  console.log(`${name}  ${size}×${size}  ${(png.length / 1024).toFixed(1)} KB`);
}
