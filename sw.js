const CACHE_NAME = 'logic-riddles-v1';

// רשימת הקבצים שחובה לשמור כדי שהאתר יעבוד באופליין
// חשוב: השמות כאן חייבים להיות זהים לשמות הקבצים בתיקייה שלך
const urlsToCache = [
  './',
  './תשובות להגדרות היגיון(1).html',
  './manifest.json'
];

// התקנה של ה-Service Worker ושמירת הקבצים במטמון (Cache)
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: שומר קבצים לעבודה ללא אינטרנט');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// ניקוי גרסאות ישנות של המטמון בעת עדכון
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: מנקה מטמון ישן');
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// ניהול בקשות הרשת (Fetch)
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // אם זו בקשה לחיפוש בגוגל (Drive/Scripts) - נסה רשת, אם נכשל הבא מהמטמון
  if (url.includes('script.google.com') || url.includes('googleusercontent.com')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const resClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    // עבור קבצי האתר (HTML, CSS הפנימי) - שלוף מהמטמון קודם
    event.respondWith(
      caches.match(event.request).then(response => {
        return response || fetch(event.request);
      })
    );
  }
});
