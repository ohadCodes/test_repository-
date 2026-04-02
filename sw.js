const CACHE_NAME = 'logic-riddles-v1';

// 1. רשימת הקבצים הסטטיים שחובה לשמור כדי שהאתר יעלה (Assets)
const urlsToCache = [
  './',
  './index.html',
  './style.css',  // ודא שזה שם קובץ ה-CSS שלך
  './script.js', // ודא שזה שם קובץ ה-JS שלך
  './manifest.json'
];

// התקנה של ה-Service Worker ושמירת קבצי הליבה
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching Core Assets');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting()) // גורם ל-SW החדש להיכנס לפעולה מיד
  );
});

// הפעלה וניקוי מטמון ישן (חשוב כשמעדכנים גרסה)
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Clearing Old Cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// ניהול בקשות (Fetch)
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // אסטרטגיה עבור Google Scripts: "נסה רשת, אם נכשל - הבא מהמטמון"
  // זה מאפשר לראות הגדרות שחיפשת בעבר גם כשאתה באופליין
  if (url.includes('script.google.com') || url.includes('googleusercontent.com')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // שומר עותק של התשובה החדשה מגוגל במטמון לשימוש עתידי באופליין
          const resClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
          return response;
        })
        .catch(() => {
          // אם אין אינטרנט, ננסה למצוא את הבקשה הזו במטמון
          return caches.match(event.request);
        })
    );
    return;
  }

  // אסטרטגיה עבור קבצי האתר (HTML, CSS, JS): "קודם מטמון, אם אין - הבא מהרשת"
  // זה מבטיח טעינה מיידית של האתר (מצב Offline מלא)
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
