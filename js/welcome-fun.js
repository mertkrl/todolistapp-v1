// Karşılama/giriş kapısı için eğlenceli, tamamen kozmetik etkileşim katmanı.
// #app-login-gate görünürken çalışır (body.app-gate-locked), oturum açılınca
// durur. Giriş/kayıt akışına dokunmaz — app-login-gate.js ile hiçbir bağımlılığı yoktur.
(function () {
    'use strict';

    var MICRO_TASKS = [
        { emoji: '☕', text: 'Kahve iç' },
        { emoji: '📚', text: 'Biraz oku' },
        { emoji: '🏃', text: 'Kısa bir yürüyüş' },
        { emoji: '💧', text: 'Su iç' },
        { emoji: '📝', text: 'Not al' },
        { emoji: '🎯', text: 'Hedef belirle' },
        { emoji: '🌱', text: 'Yeni bir alışkanlık' },
        { emoji: '🔔', text: 'Hatırlatıcı kur' },
        { emoji: '💡', text: 'Fikrini yaz' },
        { emoji: '📅', text: 'Takvimi gözden geçir' },
        { emoji: '💪', text: 'Kısa bir egzersiz' },
        { emoji: '🧠', text: 'Yeni bir şey öğren' },
        { emoji: '🍎', text: 'Sağlıklı atıştır' },
        { emoji: '😴', text: 'Erken yat' },
        { emoji: '✅', text: 'Listeni gözden geçir' },
        { emoji: '🔥', text: 'Serini koru' },
        { emoji: '📖', text: 'Günlük tut' },
        { emoji: '⏰', text: 'Odak seansı yap' },
        { emoji: '📈', text: 'İlerlemeni izle' },
        { emoji: '🏆', text: 'Küçük bir zafer kutla' },
        { emoji: '🗓️', text: 'Yarını planla' }
    ];

    var layer = null;
    var counterEl = null;
    var counterNumEl = null;
    var counterMsgEl = null;
    var lastMsgIndex = -1;

    // Psikolojik açıdan destekleyici, süreç odaklı kısa ifadeler — sonucu
    // değil çabayı ve devamlılığı öven, baskı yaratmayan, özerkliği
    // vurgulayan dil (davranış değişimi literatüründeki "process praise").
    // Tek düze kalmasın diye her patlatmada rastgele (art arda tekrarsız)
    // değişir — sabit bir cümle zamanla anlamını yitirir.
    var SUPPORT_MESSAGES = [
        'güzel bir başlangıç',
        'iyi gidiyorsun',
        'bu senin temposun',
        'küçük ama değerli',
        'kendine zaman ayırdın',
        'sağlam bir adım',
        'bu ritmi seviyorum',
        'yavaş da olsa ileri gidiyorsun',
        'kendine gösterdiğin özen değerli',
        'mükemmel olmak zorunda değil',
        // growth mindset — "henüz" vurgusu, ilerlemeyi bir süreç olarak çerçeveler
        'henüz yolun başındasın',
        // öz-şefkat — kendine karşı sert olmayı değil nazikliği teşvik eder
        'kendine nazik davran',
        // varlık/çaba övgüsü — mükemmel sonuç değil, orada olmak bile değerli
        'burada olman bile bir adım',
        // sosyal kıyası ortadan kaldırır — içsel motivasyonu korur
        'kimseyle yarışmıyorsun',
        // çaba fark ediliyor mesajı — dışsal değil içsel doğrulama hissi verir
        'çaban gerçekten görünüyor',
        // süreklilik > mükemmellik — küçük tutarlı adımların değerini vurgular
        'küçük tutarlılık büyük fark yaratır'
    ];

    function nextSupportMessage() {
        if (SUPPORT_MESSAGES.length === 1) return SUPPORT_MESSAGES[0];
        var idx;
        do {
            idx = Math.floor(Math.random() * SUPPORT_MESSAGES.length);
        } while (idx === lastMsgIndex);
        lastMsgIndex = idx;
        return SUPPORT_MESSAGES[idx];
    }
    var spawnTimer = null;
    var completedCount = 0;
    var running = false;
    var activeTexts = {};
    var nextSide = 0; // 0 = sol, 1 = sağ — sırayla dönüşerek iki taraftan eşit sayıda balon çıkar

    function rand(min, max) {
        return Math.random() * (max - min) + min;
    }

    function ensureLayer() {
        if (layer) return;

        layer = document.createElement('div');
        layer.className = 'welcome-fun-layer';
        layer.setAttribute('aria-hidden', 'true');

        var glow = document.createElement('div');
        glow.className = 'welcome-fun-glow';
        layer.appendChild(glow);
        layer._glow = glow;

        var gate = document.getElementById('app-login-gate') || document.body;
        gate.insertBefore(layer, gate.firstChild);

        counterEl = document.createElement('div');
        counterEl.className = 'welcome-fun-counter';
        counterEl.innerHTML = '<span class="wf-counter-emoji">✨</span>' +
            '<span><span class="wf-counter-num">0</span>. adım <span class="wf-counter-msg"></span></span>';
        gate.appendChild(counterEl);
        counterNumEl = counterEl.querySelector('.wf-counter-num');
        counterMsgEl = counterEl.querySelector('.wf-counter-msg');

        document.addEventListener('mousemove', onMouseMove, { passive: true });
    }

    function onMouseMove(e) {
        if (!layer || !layer._glow) return;
        layer._glow.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px) translate(-50%,-50%)';
    }

    function pickTask() {
        // Ekranda o an yüzen balonlarla aynı metni tekrar etmemek için
        // önce henüz aktif olmayan görevler arasından seçim yapılır.
        var available = MICRO_TASKS.filter(function (t) { return !activeTexts[t.text]; });
        var pool = available.length ? available : MICRO_TASKS;
        return pool[Math.floor(Math.random() * pool.length)];
    }

    function spawnBubble() {
        if (!layer || !running) return;

        var task = pickTask();
        activeTexts[task.text] = (activeTexts[task.text] || 0) + 1;

        var bubble = document.createElement('div');
        bubble.className = 'welcome-fun-bubble';
        bubble.innerHTML = '<span class="wf-emoji">' + task.emoji + '</span><span>' + task.text + '</span>';

        // Kart genelde ekranın ortasında olduğu için balonlar okunabilirliği
        // bozmasın diye orta banttan (~%32-%68) uzak tutulur, ama ekran
        // kenarına da yapışmasınlar diye (uzun metinler taşabiliyordu) çok
        // uca değil, kenara yakın-ortaya yakın bir aralığa yerleştirilir.
        // Sağ taraftakiler "right" ile konumlanır ki metin uzunluğu ne
        // olursa olsun sağ kenardan dışarı taşmasın.
        var edgeGap = rand(11, 24);
        var isRight = nextSide === 1;
        nextSide = nextSide === 0 ? 1 : 0;
        var duration = rand(13, 20);
        var drift = rand(-60, 60);
        var rot = rand(-6, 6);

        if (isRight) {
            bubble.style.right = edgeGap + 'vw';
        } else {
            bubble.style.left = edgeGap + 'vw';
        }
        bubble.style.setProperty('--wf-dur', duration + 's');
        bubble.style.setProperty('--wf-drift', drift + 'px');
        bubble.style.setProperty('--wf-rot', rot + 'deg');

        bubble.addEventListener('click', function () {
            releaseTask(task);
            completeBubble(bubble);
        });

        bubble.addEventListener('animationend', function (ev) {
            if (ev.animationName === 'welcome-fun-float' && bubble.parentNode) {
                bubble.parentNode.removeChild(bubble);
                releaseTask(task);
            }
        });

        layer.appendChild(bubble);
    }

    function releaseTask(task) {
        if (!activeTexts[task.text]) return;
        activeTexts[task.text]--;
        if (activeTexts[task.text] <= 0) delete activeTexts[task.text];
    }

    function completeBubble(bubble) {
        if (bubble.classList.contains('is-done')) return;
        bubble.classList.add('is-done');

        burstParticles(bubble);
        bumpCounter();

        setTimeout(function () {
            bubble.classList.add('is-gone');
            setTimeout(function () {
                if (bubble.parentNode) bubble.parentNode.removeChild(bubble);
            }, 500);
        }, 380);
    }

    function burstParticles(bubble) {
        var rect = bubble.getBoundingClientRect();
        var cx = rect.left + rect.width / 2;
        var cy = rect.top + rect.height / 2;
        var colors = ['#D4900E', '#4ADE80', '#60A5FA', '#A78BFA'];

        for (var i = 0; i < 10; i++) {
            var p = document.createElement('div');
            p.className = 'welcome-fun-particle';
            var angle = rand(0, Math.PI * 2);
            var dist = rand(24, 54);
            p.style.left = cx + 'px';
            p.style.top = cy + 'px';
            p.style.background = colors[Math.floor(Math.random() * colors.length)];
            p.style.setProperty('--wf-px', Math.cos(angle) * dist + 'px');
            p.style.setProperty('--wf-py', Math.sin(angle) * dist + 'px');
            layer.appendChild(p);
            (function (particle) {
                setTimeout(function () {
                    if (particle.parentNode) particle.parentNode.removeChild(particle);
                }, 650);
            })(p);
        }
    }

    var counterHideTimer = null;

    function bumpCounter() {
        completedCount++;
        if (counterNumEl) counterNumEl.textContent = String(completedCount);
        if (counterMsgEl) counterMsgEl.textContent = nextSupportMessage();
        if (counterEl) {
            counterEl.classList.add('is-visible');
            counterEl.style.transform = 'translateY(0) scale(1.06)';
            setTimeout(function () {
                counterEl.style.transform = '';
            }, 180);

            if (counterHideTimer) clearTimeout(counterHideTimer);
            counterHideTimer = setTimeout(function () {
                if (counterEl) counterEl.classList.remove('is-visible');
            }, 2600);
        }
    }

    function wireIconPulse() {
        var icon = document.querySelector('.app-login-gate-icon');
        if (!icon || icon._wfWired) return;
        icon._wfWired = true;
        icon.addEventListener('click', function () {
            icon.classList.remove('wf-pulse');
            void icon.offsetWidth;
            icon.classList.add('wf-pulse');
        });
    }

    function start() {
        if (running) return;
        running = true;
        activeTexts = {};
        nextSide = 0;
        ensureLayer();
        wireIconPulse();
        layer.style.display = '';
        if (counterEl) counterEl.style.display = '';

        for (var i = 0; i < 3; i++) {
            setTimeout(spawnBubble, i * 900);
        }
        spawnTimer = setInterval(spawnBubble, 2600);
    }

    function stop() {
        running = false;
        if (spawnTimer) {
            clearInterval(spawnTimer);
            spawnTimer = null;
        }
        if (counterHideTimer) {
            clearTimeout(counterHideTimer);
            counterHideTimer = null;
        }
        if (layer) layer.style.display = 'none';
        if (counterEl) counterEl.style.display = 'none';
    }

    function syncWithGate() {
        var isLocked = document.body.classList.contains('app-gate-locked');
        if (isLocked) start(); else stop();
    }

    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
    }

    function init() {
        syncWithGate();
        var observer = new MutationObserver(syncWithGate);
        observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
