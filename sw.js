self.addEventListener('fetch', (event) => {
  // האזהרה נעלמת כי אנחנו משתמשים ב-respondWith
  event.respondWith(fetch(event.request));
});
