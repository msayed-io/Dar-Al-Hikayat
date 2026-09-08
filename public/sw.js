// Service Worker أساسي لجعل التطبيق قابل للتثبيت (PWA)
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
    // تمرير الطلبات كما هي بدون تخزين مؤقت معقد حالياً
    event.respondWith(fetch(event.request));
});
