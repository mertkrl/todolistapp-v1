// inline-dock-topbar-init.js — index.html'deki "FAZ 2: Dock + Topbar init" inline <script>'ten taşındı.
(function() {
    // Topbar tarih göster
    var tbDate = document.getElementById('v2-tb-date');
    if (tbDate) {
        tbDate.textContent = new Date().toLocaleDateString('tr-TR', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    }

    // Dock: section geçişi — switchTab doğrudan çağır (DOMContentLoaded sonrası çalışır)
    document.querySelectorAll('#app-dock .di[data-target]').forEach(function(di) {
        di.addEventListener('click', function(e) {
            var targetId = di.dataset.target;
            if (typeof window.switchTab === 'function') {
                window.switchTab(targetId);
            } else {
                // Fallback: switchTab henüz hazır değilse gizli navLink'e tıkla
                var navLink = document.querySelector('.nav-links li[data-target="' + targetId + '"]');
                if (navLink) navLink.click();
            }
        });
    });

    // Dock sıralaması: uzun-basma ile "düzenleme/sürükleme modu" özelliği
    // KALDIRILDI — kullanıcılar yanlışlıkla tetikleyip ikonların kilitlendiğini
    // veya sürüklenirken ekran dışına kaybolduğunu sanıyordu. Daha önce
    // kaydedilmiş özel sıralama (dock_order) varsa yine de uygulanır.
    (function initDockOrder() {
        var dock = document.getElementById('app-dock');
        if (!dock) return;

        var sepIndex = 0;
        Array.from(dock.children).forEach(function(child) {
            var key = child.dataset.target || child.id || ('sep-' + (sepIndex++));
            child.dataset.dockKey = key;
        });

        if (typeof window.FocusStorage !== 'undefined') {
            var savedOrder = FocusStorage.get('dock_order', null);
            if (Array.isArray(savedOrder) && savedOrder.length) {
                var byKey = {};
                Array.from(dock.children).forEach(function(c) { byKey[c.dataset.dockKey] = c; });
                savedOrder.forEach(function(key) {
                    if (byKey[key]) dock.appendChild(byKey[key]);
                });
            }
        }
    })();

    // ── YATAY SWIPE İLE "GERİ/İLERİ" NAVİGASYONUNU ENGELLE ──
    // Trackpad'de iki parmakla sola/sağa kaydırma (veya boşlukta basılı
    // tutup sürükleme) tarayıcının geçmiş navigasyon jestini tetikliyor ve
    // tüm arayüz ekran dışına kayıyormuş gibi görünüyordu. CSS'teki
    // overscroll-behavior-x her tarayıcıda yeterli olmadığı için yatay
    // ağırlıklı wheel olaylarını JS ile de iptal ediyoruz. Uygulama içinde
    // gerçekten yatay kaydırılabilen alanlar (örn. etiket şeritleri)
    // etkilenmesin diye önce hedefin atalarında yatay scroll aranıyor.
    window.addEventListener('wheel', function(e) {
        if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return; // dikey ağırlıklıysa karışma
        var el = e.target;
        while (el && el !== document.documentElement) {
            if (el.scrollWidth > el.clientWidth + 1) {
                var ox = getComputedStyle(el).overflowX;
                if (ox === 'auto' || ox === 'scroll') return; // içeride meşru yatay scroll var
            }
            el = el.parentElement;
        }
        e.preventDefault();
    }, { passive: false });

    // Haftalık Plan dock butonu
    var dockWeekly = document.getElementById('dock-weekly-plan');
    if (dockWeekly) {
        dockWeekly.addEventListener('click', function() {
            var navBtn = document.getElementById('nav-weekly-plan');
            if (navBtn) navBtn.click();
        });
    }

    // Tur dock butonu
    var dockTour = document.getElementById('dock-tour-btn');
    if (dockTour) {
        dockTour.addEventListener('click', function() {
            var tourBtn = document.getElementById('btn-restart-tour-sidebar');
            if (tourBtn) tourBtn.click();
        });
    }

    // Sidebar kullanıcı profili → Topbar avatar başharfleri
    function updateTopbarAvatar() {
        var nameEl = document.getElementById('sidebar-display-name');
        var avEl = document.getElementById('v2-user-avatar');
        if (nameEl && avEl && nameEl.textContent && nameEl.textContent !== 'Kullanıcı') {
            var parts = nameEl.textContent.trim().split(' ');
            var initials = parts.length >= 2
                ? (parts[0][0] + parts[parts.length-1][0]).toUpperCase()
                : nameEl.textContent.trim().substring(0, 2).toUpperCase();
            avEl.textContent = initials;
        }
    }
    // Sidebar-display-name değişince güncelle
    var sidebarName = document.getElementById('sidebar-display-name');
    if (sidebarName) {
        new MutationObserver(updateTopbarAvatar).observe(sidebarName, { childList: true, characterData: true, subtree: true });
    }
    updateTopbarAvatar();
})();
