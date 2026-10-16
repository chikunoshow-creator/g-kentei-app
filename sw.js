// バージョン番号（pushするたびにここを変えてもOKですが、スクリプト側で自動更新します）
const CACHE_NAME = 'gkentei-v2';

// インストール時は待機せず即座に有効化（skipWaiting）
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// 古いキャッシュを一掃
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Network First戦略：まずネットワークから最新を取得し、失敗したらキャッシュを使う
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // 取得成功したらキャッシュを更新
        if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // 圏外・オフラインの時はキャッシュから返す
        return caches.match(event.request);
      })
  );
});