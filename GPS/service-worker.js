/* Nazwa cache dla zasobów aplikacji */
const CACHE_NAME = 'master-terminal-v1';
/* Lista plików do zapamiętania offline */
const ASSETS = [
    '/',
    '/index.html',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png'
];

// Instalacja i cachowanie zasobów
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

// Aktywacja i czyszczenie starych wersji cache
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            );
        })
    );
});

// Obsługa zapytań sieciowych (wymagane do PWA)
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});
