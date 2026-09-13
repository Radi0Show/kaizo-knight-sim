// The service worker: what makes add-to-home-screen a standalone app rather
// than a browser tab, and what keeps the fight playable offline once loaded.
// A copy of knight-sim's, with ONE structural difference explained below.
//
// STRATEGY, deliberately boring: navigation goes network-first (a deploy is
// picked up on the next launch, offline falls back to the cached page);
// everything else — sprites, audio, modules — is cache-first with a
// background fill, because those files are content-stable between deploys
// and there are hundreds of them. CACHE bumps on deploy via sw.js itself
// changing, which retires the old cache in activate.
// KEEP IN LOCKSTEP WITH web/version.js — the worker cannot import modules,
// so the link is by convention: every release bumps both, and the new cache
// name is what makes an installed PWA pick up the new build.
//
// THE PREFIX IS THE SEPARATION. knight-sim's worker names its cache
// blackknife-<version>; this one is kaizoknight-<version>. Cache Storage is
// PER ORIGIN, not per path, and GitHub project pages share one origin — so
// a worker that deleted "every cache that is not mine" would evict the other
// game's cache on every activate, and be evicted by it in turn. That is the
// intersection this repo was split to avoid. activate below therefore deletes
// ONLY caches carrying this prefix. (knight-sim's worker was given the same
// discipline on the same day, for its own prefix.)
const PREFIX = 'kaizoknight-';
const CACHE = PREFIX + '0.1.19';

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(['./', './index.html', './kaizo.html', './kaizo.js']))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((r) => {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
          return r;
        })
        // THE SHELL MAY ONLY STAND IN FOR ITSELF — inherited from knight-sim,
        // where a failed navigation was once answered with the wrong game. A
        // cached copy of the page actually asked for is always right; past
        // that, only the root, index, or kaizo.html may be handed the kaizo
        // page, and anything else gets an honest failure.
        .catch(() => caches.match(e.request).then((m) => {
          if (m) return m;
          const p = url.pathname;
          const isShell = p.endsWith('/') || p.endsWith('/index.html') || p.endsWith('/kaizo.html');
          if (isShell) return caches.match('./kaizo.html');
          return new Response(
            'Offline, and this page is not cached.',
            { status: 503, headers: { 'Content-Type': 'text/plain' } },
          );
        })),
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then((hit) => hit ?? fetch(e.request).then((r) => {
      const copy = r.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return r;
    })),
  );
});
