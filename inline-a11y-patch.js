// inline-a11y-patch.js — index.html'deki "ERİŞİLEBİLİRLİK YAMASI" inline <script>'ten taşındı.
// 395+ modal ve binlerce ikon-buton HTML'de tek tek elle işaretlenmiş
// değil (bkz. denetim raporu — 5575 satırda sadece 22 aria-label).
// Bunları tek tek düzeltmek yerine, DOM'da her modal/ikon-buton
// (statik veya JS ile sonradan oluşturulan) belirdiğinde otomatik
// olarak eksik role/aria-* özniteliklerini tamamlayan sistemsel bir
// katman. Sadece öznitelik EKLER — hiçbir mevcut tıklama/kapatma
// mantığını değiştirmez veya üzerine yazmaz, bu yüzden davranış
// riski yok.
(function() {
    function labelFor(el) {
        if (el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby')) return null;
        if (el.textContent && el.textContent.trim()) return null; // görünür metni var, etiket gerekmez
        const title = el.getAttribute('title');
        if (title && title.trim()) return title.trim();
        const tip = el.querySelector('.tip, .tooltip, [data-tooltip]');
        if (tip) {
            const t = tip.getAttribute('data-tooltip') || tip.textContent;
            if (t && t.trim()) return t.trim();
        }
        const sibTip = el.parentElement?.querySelector(':scope > .tip, :scope > .tooltip');
        if (sibTip && sibTip.textContent.trim()) return sibTip.textContent.trim();
        return null;
    }

    function enhanceModals(root) {
        root.querySelectorAll('.modal-overlay, .zk-modal-overlay, [class*="modal-overlay"], .focusai-confirm-overlay').forEach(el => {
            if (!el.hasAttribute('role')) el.setAttribute('role', 'dialog');
            if (!el.hasAttribute('aria-modal')) el.setAttribute('aria-modal', 'true');
        });
    }

    function enhanceIconButtons(root) {
        // Gerçek <button>/<a> elemanlarında sadece ikon olup metin/aria-label'ı olmayanlar
        root.querySelectorAll('button, a[href], [role="button"]').forEach(el => {
            const label = labelFor(el);
            if (label) el.setAttribute('aria-label', label);
        });
        // Dock/nav'daki tıklanabilir ama <div> olan sahte butonlar — klavye ile
        // ne odaklanabiliyor ne de Enter/Space ile tetiklenebiliyordu.
        root.querySelectorAll('.di[data-target], .nav-links li[data-target]').forEach(el => {
            if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
            if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
            const label = labelFor(el);
            if (label) el.setAttribute('aria-label', label);
            if (!el._a11yKeyBound) {
                el._a11yKeyBound = true;
                el.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        el.click();
                    }
                });
            }
        });
    }

    function enhance(root) {
        enhanceModals(root);
        enhanceIconButtons(root);
    }

    enhance(document);

    // Sosyal/planlama/collab modülleri modal'ları document.createElement ile
    // JS'den sonradan ekliyor (bkz. planning.js _showCollabDeleteModal vb.) —
    // bunları da yakalamak için DOM'u izliyoruz.
    const observer = new MutationObserver(mutations => {
        for (const m of mutations) {
            m.addedNodes.forEach(node => {
                if (node.nodeType !== 1) return;
                enhance(node);
                if (node.matches?.('.modal-overlay, .zk-modal-overlay, [class*="modal-overlay"], .focusai-confirm-overlay')) {
                    enhanceModals(node.parentElement || document);
                }
            });
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
})();
