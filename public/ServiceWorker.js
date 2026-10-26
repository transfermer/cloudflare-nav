/**
 * ==========================================
 * ServiceWorker.js - PWA 核心腳本
 * 實現 Stale-While-Revalidate 緩存策略
 * ==========================================
 */

// 緩存版本號（更新時需修改）
const CACHE_NAME = 'nav-cache-v7';

// 需要緩存的核心靜態資源
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/css/style.css',
  '/assets/js/utils.js',
  '/assets/js/colorExtractor.js',
  '/assets/js/app.js',
  'https://cdn.jsdelivr.net/npm/remixicon@3.5.0/fonts/remixicon.css',
  'https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js'
];

/**
 * 安裝事件
 * @description 緩存核心靜態資源，跳過等待直接激活
 *               單個資源失敗不影響其他資源的緩存
 */
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // 逐個緩存，單個失敗不影響整體（比 cache.addAll 更健壯）
      return Promise.allSettled(
        URLS_TO_CACHE.map(url =>
          cache.add(url).catch(err => console.warn('SW 緩存失敗:', url, err.message))
        )
      );
    })
  );
});

/**
 * 激活事件
 * @description 清理舊版本緩存，確保只保留當前版本
 */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

/**
 * 請求攔截事件
 */
self.addEventListener('fetch', event => {
  // API 請求不走 SW 緩存
  if (event.request.url.includes('/api/')) return;

  // 1. 對於 HTML 頁面請求，優先使用緩存，後臺更新（Stale-While-Revalidate）
  //    避免每次導航都等待網絡，提升首屏加載速度
  const acceptHeader = event.request.headers.get('accept') || '';
  if (event.request.mode === 'navigate' || acceptHeader.includes('text/html')) {
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        const fetchPromise = fetch(event.request).then(networkResponse => {
          if (networkResponse.ok) {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse.clone()));
          }
          return networkResponse;
        }).catch(() => {});
        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // 2. 其他靜態資源 (CSS/JS/圖片) 保持 Stale-While-Revalidate (緩存優先並後臺更新)
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      const fetchPromise = fetch(event.request).then(networkResponse => {
        if (networkResponse.ok) {
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse.clone()));
        }
        return networkResponse;
      }).catch(() => {});
      return cachedResponse || fetchPromise;
    })
  );
});