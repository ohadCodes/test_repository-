const CACHE_NAME = 'logic-riddles-v1';
// כאן רשומים הקבצים שהדפדפן מנסה לשמור. ודא שהשמות תואמים לקבצים שלך.
const urlsToCache = [
  './',
  './index.html'
];

// התקנה של ה-Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        // נשתמש ב-addAll רק על קבצים שאנחנו בטוחים שקיימים
        return cache.addAll(urlsToCache);
      })
  );
});

// הפעלה וניקוי מטמון ישן
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

self.addEventListener('fetch', event => {
  // החרגה של כתובות Google Script כדי למנוע שגיאות CORS ו-Fetch
  if (event.request.url.includes('script.google.com') || event.request.url.includes('googleusercontent.com')) {
    return; // מאפשר לבקשה לעבור ישירות לרשת ללא התערבות ה-Service Worker
  }

  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    }).catch(() => fetch(event.request))
  );
});
