const CACHE_NAME = 'logic-puzzles-v1';
const ASSETS = [
  '/',
  '/תשובות להגדרות היגיון.html',
  '/manifest.json',
  '/icon.png'
];

// התקנה ושמירת קבצים בזיכרון
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

// שליפת קבצים מהזיכרון כשאין אינטרנט
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
