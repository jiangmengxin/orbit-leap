import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

/** 递归列出 dist 下所有文件（相对路径，正斜杠） */
function listFiles(dir: string, root = dir): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? listFiles(full, root) : [relative(root, full).replace(/\\/g, '/')];
  });
}

/**
 * 零依赖 PWA 插件：构建完成后扫描 dist，生成 sw.js。
 * 预缓存全部产物（安装即可完整离线），缓存名取内容哈希，新版本上线自动清旧缓存。
 */
function generateServiceWorker(): Plugin {
  let outDir = 'dist';
  return {
    name: 'orbit-leap:generate-sw',
    apply: 'build',
    configResolved(config) {
      outDir = join(config.root, config.build.outDir);
    },
    closeBundle() {
      const files = listFiles(outDir).filter((f) => f !== 'sw.js' && !f.endsWith('.map'));
      const hash = createHash('sha256');
      for (const f of files.sort()) hash.update(f).update(readFileSync(join(outDir, f)));
      const cacheName = `orbit-leap-${hash.digest('hex').slice(0, 12)}`;
      const assets = ['./', ...files.map((f) => `./${f}`)];
      const sw = `// 由 vite.config.ts 自动生成，勿手改
const CACHE = ${JSON.stringify(cacheName)};
const ASSETS = ${JSON.stringify(assets, null, 1)};

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // ignoreVary：服务器常带 Vary: Origin/Accept-Encoding，会让预缓存匹配失败
  const OPTS = { ignoreSearch: true, ignoreVary: true };
  e.respondWith(
    caches.match(req, OPTS).then((hit) => {
      if (hit) return hit;
      if (req.mode === 'navigate') return caches.match('./', OPTS);
      return fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
`;
      writeFileSync(join(outDir, 'sw.js'), sw);
      console.log(`  生成 sw.js（${cacheName}，预缓存 ${assets.length} 项）`);
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [generateServiceWorker()],
});
