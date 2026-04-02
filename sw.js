const CACHE_NAME = 'logic-riddles-v2'; // עדכון גרסה לרענון המטמון

// רשימת הקבצים לשמירה - וודא שהשמות תואמים בדיוק לשמות הקבצים בתיקייה
const urlsToCache = [
  './',
  './תשובות להגדרות היגיון(1).html',
  './manifest.json'
];

// התקנה של ה-Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: מנסה לשמור קבצים במטמון...');
        
        // שימוש ב-Promise.allSettled כדי למנוע קריסה אם קובץ אחד חסר
        return Promise.allSettled(
          urlsToCache.map(url => 
            cache.add(url).catch(err => console.warn(`נכשלה טעינת הקובץ: ${url}`, err))
          )
        );
      })
      .then(() => {
        console.log('Service Worker: התקנה הושלמה');
        return self.skipWaiting();
      })
  );
});

// ניקוי מטמון ישן בעת הפעלה (Activation)
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: מנקה מטמון ישן', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// ניהול בקשות רשת (Fetch Strategy: Network First)
self.addEventListener('fetch', event => {
  // דילוג על בקשות שאינן GET (כמו POST של גוגל)
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // אם הצלחנו להביא מהרשת, נשמור עותק במטמון
        if (response && response.status === 200) {
          const resClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
        }
        return response;
      })
      .catch(() => {
        // אם אין אינטרנט, ננסה להביא מהמטמון
        return caches.match(event.request).then(cachedResponse => {
          if (cachedResponse) return cachedResponse;
          
          // אם זה דף HTML ואין במטמון, נחזיר את דף הבית (Fallback)
          if (event.request.headers.get('accept').includes('text/html')) {
            return caches.match('./תשובות להגדרות היגיון(1).html');
          }
        });
      })
  );
});
