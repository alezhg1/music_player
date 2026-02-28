const CACHE_NAME = 'music-player-v2';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/style.css',
    '/js/player.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jsmediatags/3.9.5/jsmediatags.min.js'
];

self.addEventListener('install', (event) => {
    console.log('📦 Service Worker: Установка...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('📦 Кэширование статических файлов...');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('✅ Статические файлы закэшированы');
                return self.skipWaiting();
            })
    );
});

self.addEventListener('activate', (event) => {
    console.log('🔄 Service Worker: Активация...');
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name !== CACHE_NAME)
                        .map((name) => caches.delete(name))
                );
            })
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const url = event.request.url;
    
    // Музыкальные файлы - кэшируем по запросу
    if (url.includes('/music/') && url.endsWith('.mp3')) {
        event.respondWith(
            caches.open(CACHE_NAME)
                .then((cache) => {
                    return cache.match(event.request)
                        .then((cachedResponse) => {
                            if (cachedResponse) {
                                console.log('🎵 Из кэша:', url);
                                return cachedResponse;
                            }
                            
                            console.log('🌐 Из сети:', url);
                            return fetch(event.request)
                                .then((networkResponse) => {
                                    if (networkResponse.ok) {
                                        cache.put(event.request, networkResponse.clone());
                                    }
                                    return networkResponse;
                                })
                                .catch((error) => {
                                    console.error('❌ Ошибка загрузки:', url);
                                    return new Response('File not available offline', {
                                        status: 503,
                                        statusText: 'Service Unavailable'
                                    });
                                });
                        });
                })
        );
        return;
    }
    
    // Статические файлы - только кэш
    if (STATIC_ASSETS.includes(url) || 
        url.includes('/css/') || 
        url.includes('/js/') ||
        url.includes('jsmediatags')) {
        event.respondWith(
            caches.match(event.request)
                .then((response) => {
                    if (response) {
                        console.log('📄 Из кэша:', url);
                        return response;
                    }
                    return fetch(event.request);
                })
        );
        return;
    }
    
    // Остальные запросы - сеть с фоллбэком на кэш
    event.respondWith(
        fetch(event.request)
            .catch(() => caches.match(event.request))
    );
});
