// sw.js — PWA Service Worker v3 (Lebih Optimal)
// Cache-first untuk shell + network-first untuk data penting

const CACHE_NAME = 'evora-v3-20260724';
const SHELL_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.bundle.min.js',
  './supabaseClient.js',
  './config.js',
  './error-handler.js',
  './ErrorBoundary.js',
  './validation.js',
  './offline-sync.js',
  './manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_ASSETS).catch(()=>{}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Jangan cache Supabase API, storage, atau RPC — selalu network
  if (url.hostname.includes('supabase.co') || url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(req).catch(() => new Response('Offline — Supabase tidak bisa dijangkau', { status: 503 })));
    return;
  }

  // Untuk shell assets: cache-first
  if (SHELL_ASSETS.some(path => url.pathname.endsWith(path.replace('./','/')) || url.pathname === '/' )) {
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
        return res;
      }).catch(() => cached))
    );
    return;
  }

  // Default: network-first dengan fallback cache
  event.respondWith(
    fetch(req).then(res => {
      // Cache GET success saja
      if (req.method === 'GET' && res.ok) {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, clone).catch(()=>{}));
      }
      return res;
    }).catch(() => caches.match(req))
  );
});
