// ============================================================
// FOCUSAI SCRIPT-TIMER-FLAME.JS
// script.js'ten çıkarılmış TsfFlame canvas parçacık animasyonu
// (gün serisi rozeti için). Bağımsız — sadece #tsf-canvas DOM
// elemanına ve window.TsfFlame.setIntensity(t) export'una bağlı.
// script.js'ten sonra herhangi bir yerde yüklenebilir.
// ============================================================
/* ═══════════════════════════════════════════
   TsfFlame — Gün serisi rozeti için canvas parçacık alevi.
   Tabandan doğan parçacıklar yükselirken daralır, sinüs türbülansıyla
   kıvrılır ve ısı rampasında söner (beyaz çekirdek → sarı → turuncu →
   kızıl → duman). 'lighter' karışım modu üst üste binen parçacıkları
   gerçek ateş gibi parlatır. Şiddet (0-1) parçacık sayısını, boyutunu,
   hızını ve çekirdek sıcaklığını sürer; script.js seri güncellenince
   TsfFlame.setIntensity(t) çağırır.
   ═══════════════════════════════════════════ */
(function () {
    const canvas = document.getElementById('tsf-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, H = 0;
    function resize() {
        const r = canvas.getBoundingClientRect();
        if (!r.width) return;
        W = r.width; H = r.height;
        canvas.width = W * DPR; canvas.height = H * DPR;
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }

    let intensity = 0;          // 0-1, seri şiddeti
    let particles = [];
    let sparks = [];            // gövdeden savrulan serbest kıvılcımlar
    let running = false;
    let rafId = 0;
    let lastT = 0;
    let spawnAcc = 0;
    let clock = Math.random() * 100; // global zaman — titreme & rüzgar fazları

    // Isı rampası: yaş (0=doğum, 1=ölüm) → renk. Şiddet arttıkça çekirdek beyazlaşır.
    function heatColor(age, hot) {
        // 'lighter' modunda üst üste binen parçacıklar toplandığı için alfa düşük
        // tutulur; beyaza doyma yerine sıcak sarı çekirdek + turuncu gövde kalır.
        // [r,g,b,a] döner — parçacık, merkezden kenara şeffaflaşan radyal
        // gradyanla çizilir ki komşularıyla kaynaşıp sürekli bir alev oluştursun.
        if (age < 0.18) return [255, Math.round(215 + hot * 35), 110, 0.55];
        if (age < 0.42) return [255, 190, 50, 0.5];
        if (age < 0.68) return [255, 115, 10, 0.46];
        if (age < 0.88) return [215, 55, 0, 0.35];
        return [140, 40, 15, 0.18];
    }

    function spawn() {
        // Tabanda ortaya yakın doğar (merkez ağırlıklı dağılım)
        const spread = (Math.random() + Math.random() - 1) * 0.5; // -0.5..0.5, merkezde yoğun
        const baseW = W * (0.26 + intensity * 0.16);
        // Damla silueti: merkeze yakın doğan parçacık uzun yaşar (alevin sivri
        // ucunu oluşturur), kenardakiler erken söner (koni tabanını oluşturur)
        const centered = 1 - Math.abs(spread) * 2; // 1=merkez, 0=kenar
        particles.push({
            x: W / 2 + spread * baseW,
            y: H - 2,
            r: W * (0.055 + Math.random() * 0.06) * (0.75 + intensity * 0.6),
            vy: H * (0.55 + Math.random() * 0.3 + centered * 0.45) * (0.8 + intensity * 0.9), // merkez sütun en hızlı yükselir
            drift: (Math.random() - 0.5) * 6,
            wob: Math.random() * Math.PI * 2,       // türbülans fazı
            wobF: 5 + Math.random() * 6,            // türbülans frekansı
            life: 0,
            ttl: 0.3 + centered * 0.55 + Math.random() * 0.2 // saniye
        });
    }

    function frame(now) {
        if (!running) return;
        const dt = Math.min((now - lastT) / 1000, 0.05);
        lastT = now;
        clock += dt;

        // GLOBAL TİTREME: gerçek alev sabit yanmaz — boyu ve parlaklığı, farklı
        // frekanslı iki sinüsün toplamıyla (periyodik görünmeyen) sürekli dalgalanır
        const flicker = 1 + Math.sin(clock * 7.3) * 0.06 + Math.sin(clock * 11.9) * 0.05
                      + Math.sin(clock * 2.1) * 0.05;
        // RÜZGAR: alevin tümü yavaşça bir sağa bir sola yaslanır; tepe daha çok eğilir
        const wind = (Math.sin(clock * 1.7) * 0.6 + Math.sin(clock * 0.53) * 0.4) * W * 0.14;

        // Şiddete göre saniyede ~22-70 parçacık (titremeyle mikro dalgalanır)
        spawnAcc += dt * (22 + intensity * 48) * flicker;
        while (spawnAcc >= 1) { spawnAcc -= 1; spawn(); }
        // Ara sıra gövdeden kopan serbest kıvılcım (şiddet arttıkça sıklaşır)
        if (Math.random() < dt * (0.6 + intensity * 2.2)) {
            sparks.push({
                x: W / 2 + (Math.random() - 0.5) * W * 0.3,
                y: H - H * (0.25 + Math.random() * 0.3),
                vx: (Math.random() - 0.5) * W * 0.6,
                vy: H * (0.5 + Math.random() * 0.5),
                life: 0, ttl: 0.4 + Math.random() * 0.45
            });
        }

        ctx.clearRect(0, 0, W, H);

        // Dipteki sıcak taban parıltısı — alevin en parlak noktası hep diptir
        const g = ctx.createRadialGradient(W / 2, H - 1, 0, W / 2, H - 1, W * 0.42);
        g.addColorStop(0, `rgba(255,200,90,${(0.35 + intensity * 0.3) * flicker})`);
        g.addColorStop(1, 'rgba(180,40,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, H - W * 0.45, W, W * 0.45);

        ctx.globalCompositeOperation = 'lighter';
        const rise = (0.75 + intensity * 0.45) * flicker; // şiddet+titreme → alev boyu
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.life += dt;
            const age = p.life / p.ttl;
            if (age >= 1) { particles.splice(i, 1); continue; }
            // Kaldırma kuvveti: sıcak gaz yükseldikçe hızlanır
            p.y -= p.vy * dt * rise * (1 + age * 0.7);
            p.wob += p.wobF * dt;
            // Yükseldikçe türbülans artar (tepe hep en kararsız kısımdır),
            // gövde yukarı doğru merkeze toplanarak alev silueti oluşturur;
            // rüzgar tüm gövdeyi yaşla orantılı yaslar (dip sabit, uç savrulur)
            const pinch = (W / 2 + wind * age - p.x) * age * 2.6 * dt * 6;
            p.x += Math.sin(p.wob) * age * W * 0.35 * dt + p.drift * dt * (W / 26) + pinch;
            const r = Math.max(p.r * (1 - age * 0.62), 0.4) * 1.8;
            const c = heatColor(age, intensity);
            // Ölüme yaklaşırken yumuşak sönüş — parçacık "aniden yok olmak"
            // yerine son %25'inde eriyerek kaybolur
            const fade = age > 0.75 ? (1 - age) / 0.25 : 1;
            const pg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
            pg.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${(c[3] * fade * flicker).toFixed(3)})`);
            pg.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
            ctx.fillStyle = pg;
            ctx.beginPath();
            ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
            ctx.fill();
        }
        // Kıvılcımlar: küçük, parlak, rüzgarla savrulan noktalar
        for (let i = sparks.length - 1; i >= 0; i--) {
            const s = sparks[i];
            s.life += dt;
            const age = s.life / s.ttl;
            if (age >= 1 || s.y < 0) { sparks.splice(i, 1); continue; }
            s.y -= s.vy * dt;
            s.x += s.vx * dt + wind * dt * 2;
            ctx.fillStyle = `rgba(255,210,120,${(1 - age) * 0.85})`;
            ctx.beginPath();
            ctx.arc(s.x, s.y, W * 0.02 * (1 - age * 0.5) + 0.3, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
        rafId = requestAnimationFrame(frame);
    }

    function start() {
        if (running || intensity <= 0) return;
        resize();
        if (!W) { setTimeout(start, 500); return; } // henüz layout yoksa (gizli sekme) tekrar dene
        running = true;
        lastT = performance.now();
        rafId = requestAnimationFrame(frame);
    }
    function stop() {
        running = false;
        cancelAnimationFrame(rafId);
        particles = [];
        sparks = [];
        // Seri 0: hiçbir şey çizilmez — rozet tamamen boş kalır
        if (!W) resize();
        if (W) ctx.clearRect(0, 0, W, H);
    }

    // Sekme görünmezken boşa çizim yapma
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) { running = false; cancelAnimationFrame(rafId); }
        else start();
    });
    window.addEventListener('resize', () => { if (running) resize(); });

    window.TsfFlame = {
        setIntensity(t) {
            intensity = Math.max(0, Math.min(1, t));
            if (intensity > 0) start(); else stop();
        }
    };
})();
