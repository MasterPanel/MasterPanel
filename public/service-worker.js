/* * SERVICE WORKER - Zaawansowana obsługa PWA
 * MasterOS - Pełny tryb Offline z odświeżaniem danych
 */

const CACHE_STATIC = 'pwa-static-v1'; // Zmiana wersji wymusza aktualizację
const CACHE_DYNAMIC = 'pwa-dynamic-v1';

const OFFLINE_URL = '/index.html';

// Pełna lista plików do cache
const urlsToCache = [
  '/',
  '/index.html',
   '/asystent.html',
    '/brylak.html',
     '/czat.html',
      '/info.html',
            '/nativ.html',
                
  '/Coder.html',
  '/listwa.html',
  '/PRALKA.html',
  '/SmartHome.html',
  '/kalq.html',
  '/paczki.html',
  '/Kreator.html',
  '/generator.html',
  '/TEMP.html',
  '/Light.html',
  '/tv.html',
  '/V.html',
  '/gra.html',
  '/KAMERA.html',
  '/WYKRESY.html',
  '/manifest.json',
  '/temp.png',
  '/app.html',
  '/sklep.html',
  '/os.html',
  '/7slot.html',
  '/1.jpg',
  '/2.jpg',
  '/3.jpg',
  '/4.jpg',
  '/5.jpg',
  '/6.jpg',
  '/7.jpg',
  '/8.jpg',
  '/9.jpg',
  '/10.jpg',
  '/icon-512.png',
  '/icon-192.png'
];

// --- INSTALACJA ---
// Pobieranie kluczowych zasobów do Cache Static
self.addEventListener('install', event => {
  self.skipWaiting(); 
  event.waitUntil(
    caches.open(CACHE_STATIC).then(cache => {
      console.log('[SW] Buforowanie zasobów statycznych');
      return Promise.all(
        urlsToCache.map(url => {
          return cache.add(url).catch(err => console.error(`[SW] Błąd buforowania: ${url}`, err));
        })
      );
    })
  );
});

// --- AKTYWACJA ---
// Usuwanie starych wersji Cache i przejmowanie kontroli
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_STATIC && key !== CACHE_DYNAMIC)
          .map(key => caches.delete(key))
      );
    })
  );
  console.log('[SW] Aktywowany i gotowy do pracy offline');
  return self.clients.claim();
});

// --- KOMUNIKACJA ---
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// --- FETCH ---
// Strategia zróżnicowana dla zasobów statycznych i dynamicznych danych
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Specjalna obsługa dla pomiarów temperatury i wilgotności (Network First)
  // Zakładamy, że zapytania o dane zawierają w ścieżce frazy 'temp', 'hum' lub 'pomiary'
  if (url.pathname.includes('temp') || url.pathname.includes('hum') || url.pathname.includes('pomiary')) {
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          // Jeśli sieć działa, zapisz świeże dane do cache i zwróć je
          return caches.open(CACHE_DYNAMIC).then(cache => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        })
        .catch(() => {
          // Jeśli brak sieci, zwróć ostatnie zapisane dane z cache
          return caches.match(event.request);
        })
    );
    return;
  }

  // Standardowa strategia Cache First dla pozostałych zasobów (pliki HTML, JS, obrazy)
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then(networkResponse => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }

          const responseToCache = networkResponse.clone();
          caches.open(CACHE_DYNAMIC).then(cache => {
            cache.put(event.request, responseToCache);
          });

          return networkResponse;
        })
        .catch(() => {
          if (event.request.mode === 'navigate') {
            return caches.match(OFFLINE_URL);
          }
        });
    })
  );
});
