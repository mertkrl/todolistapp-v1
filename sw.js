const CACHE = 'focusai-14f682c3ee';
const FILES = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './social.js',
  './planning.js',
  './collab.js',
  './storage-manager.js',
  './supabase-client.js',
  './auth-ui.js'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(FILES))
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // .js, .css, .html ve sayfa navigasyonları: stale-while-revalidate.
  // Önceki sürüm ("her zaman ağdan bekle") her yüklemede 4.6MB'lık ham JS/CSS'i
  // yeniden indirtiyordu — PWA'nın hız avantajını tamamen sıfırlıyordu. Bu
  // sürüm önbellekte varsa ANINDA onu döndürür (hızlı ilk boyama), AYNI ANDA
  // arka planda ağdan taze kopyayı çekip önbelleği günceller — bir sonraki
  // yüklemede yeni sürüm görünür. "Bayat veri asla güncellenmez" bug'ı
  // (2026-07-14) burada oluşmuyor çünkü her istekte arka plan revalidasyonu
  // tetikleniyor, cache asla "sonsuza dek dondurulmuş" olmuyor.
  const url = e.request.url;
  if (e.request.mode === 'navigate' || url.endsWith('.js') || url.endsWith('.css') || url.endsWith('.html')) {
    e.respondWith(
      caches.open(CACHE).then(async c => {
        const cached = await c.match(e.request);
        const network = fetch(e.request).then(res => {
          if (res && res.ok) c.put(e.request, res.clone());
          return res;
        }).catch(() => null);
        if (cached) {
          network; // arka planda güncelle, yanıtı bekletme
          return cached;
        }
        const fresh = await network;
        return fresh || cached || Response.error();
      })
    );
    return;
  }
  // Cross-origin istekleri (Supabase REST/Auth/Realtime, avatar/CDN vb.) HİÇ
  // önbelleğe alma. Aşağıdaki cache-first strateji buraya da uygulanıyordu —
  // aynı sorgu URL'si (ör. group_members select?group_id=eq.X) ilk yüklemede
  // önbelleğe yazılıp bir daha ASLA güncellenmiyordu (bu cache'in süresi/
  // geçersiz kılma mantığı yok). Sonuç: şube ataması gibi gerçek DB
  // güncellemeleri veritabanında doğru şekilde kalıcı oluyordu ama sayfa
  // yenilenince tarayıcı hep İLK YÜKLEMEDEKİ bayat API yanıtını görüyordu —
  // hem "şube ataması sayfa yenilenince gidiyor" hem de grup/panel restore
  // akışının bayat veriyle çalışıp Arena'ya düşmesi buradan kaynaklanıyordu
  // (2026-07-14). Cross-origin isteklerde respondWith çağırmayıp tarayıcının
  // normal ağ isteğini yapmasına izin veriyoruz.
  if (url.startsWith(self.location.origin)) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request))
    );
  }
});
// 4.3 — Push Notification handler
self.addEventListener('push', e => {
  let data = { title: 'FocusAI', body: 'Yeni bildirim', icon: './icon-192.png', tag: 'focusai' };
  try { if (e.data) data = { ...data, ...e.data.json() }; } catch(_) {}
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body, icon: data.icon || './icon-192.png',
      badge: './icon-192.png', tag: data.tag || 'focusai',
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(clients.matchAll({ type:'window' }).then(list => {
    const w = list.find(c => c.url === url && 'focus' in c);
    return w ? w.focus() : clients.openWindow(url);
  }));
});
