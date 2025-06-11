const CACHE_NAME = "smilefit-cache-v6";  // ✅ 버전 변경 중요!
const urlsToCache = [
  "/",
  "/manifest.json",
  "/serviceWorker.js",
  "/scripts/index.js",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
];

// ✅ 설치 단계 - 캐시 저장
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

// ✅ 활성화 단계 - 이전 캐시 제거
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keyList) =>
      Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);  
          }
        })
      )
    )
  );
  return self.clients.claim();
});

// ✅ fetch - 캐시 대신 항상 네트워크 우선
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request);
    })
  );
});