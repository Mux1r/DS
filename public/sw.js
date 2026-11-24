const CACHE_NAME = 'nurse-duty-v4'; // 換圖示時要加一，不然已安裝的手機會一直用快取裡的舊圖示
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('SW: Caching App Shell and static assets');
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('SW: Clearing old cache', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event
// 首頁（navigate）：網路優先，但最多等 NAV_TIMEOUT。
//   以前沒有逾時：網路「有連上但卡住」（醫院 Wi-Fi、訊號弱）時請求不會失敗、只會一直等，
//   要等瀏覽器自己放棄（常見 30 秒上下）才退回快取，這段期間整頁白屏。
//   逾時、斷線、或回應不是 200（例如部署中的 404）都改用快取；網路版晚到照樣更新快取，下次打開就是新版。
// 其他檔案快取優先：Vite 打包出的 JS/CSS 檔名含雜湊，改版檔名就變，不會拿到舊的。
const NAV_TIMEOUT = 3000;

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip cross-origin or non-GET requests (Firebase 等外部請求不經過快取)
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    const network = fetch(event.request).then((response) => {
      if (response.ok) {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', responseClone));
      }
      return response;
    });
    event.waitUntil(network.then(() => {}, () => {})); // 已經先回快取時，讓 SW 活到網路版存進快取
    event.respondWith((async () => {
      const cached = await caches.match('./index.html');
      if (!cached) return network; // 第一次打開還沒有快取，只能等網路
      const timeout = new Promise((resolve) => setTimeout(() => resolve(null), NAV_TIMEOUT));
      const response = await Promise.race([network.catch(() => null), timeout]);
      return response && response.ok ? response : cached;
    })());
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request).then((response) => {
        // Cache valid responses for next time
        if (response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        }
        return response;
      });
    })
  );
});
