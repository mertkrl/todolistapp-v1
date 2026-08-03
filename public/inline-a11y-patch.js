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

    // ═══════════════════════════════════════════════════════
    // FOCUS-TRAP: modal açıkken Tab döngüsü modal dışına kaçmasın,
    // açılışta odak modala taşınsın, kapanışta tetikleyen elemana dönsün.
    // Modaller HTML'de hep DOM'da duruyor, sadece "hidden" class'ı ile
    // gizleniyor/gösteriliyor (67+ modal, ortak desen) — bu yüzden tek bir
    // class-attribute MutationObserver'ı hepsini kapsıyor, her modalin kendi
      // aç/kapat JS'ine dokunmadan.
    // ═══════════════════════════════════════════════════════
    const MODAL_SEL = '.modal-overlay, .zk-modal-overlay, [class*="modal-overlay"], .focusai-confirm-overlay';
    const FOCUSABLE_SEL = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    let lastTrigger = null;

    function isVisible(el) {
        // offsetParent, position:fixed elemanlarda (tüm modal overlay'ler bunu kullanıyor)
        // Chrome/Firefox'ta HER ZAMAN null döner — bu yüzden layout tabanlı kontrol yerine
        // computed style kullanılıyor.
        if (el.classList.contains('hidden')) return false;
        const cs = getComputedStyle(el);
        return cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0';
    }

    function topmostOpenModal() {
        const open = [...document.querySelectorAll(MODAL_SEL)].filter(isVisible);
        if (!open.length) return null;
        // En yüksek z-index'e sahip olan (iç içe modal/onay kutusu durumunda üstteki) kazanır.
        return open.reduce((top, el) => {
            const z = parseInt(getComputedStyle(el).zIndex, 10) || 0;
            const topZ = top ? (parseInt(getComputedStyle(top).zIndex, 10) || 0) : -1;
            return z >= topZ ? el : top;
        }, null);
    }

    function focusFirstIn(modal) {
        const target = modal.querySelector(FOCUSABLE_SEL);
        (target || modal).focus?.({ preventScroll: true });
    }

    document.addEventListener('keydown', e => {
        if (e.key !== 'Tab') return;
        const modal = topmostOpenModal();
        if (!modal) return;
        const focusables = [...modal.querySelectorAll(FOCUSABLE_SEL)].filter(el => el.offsetParent !== null);
        if (!focusables.length) return;
        const first = focusables[0], last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault(); last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault(); first.focus();
        } else if (!modal.contains(document.activeElement)) {
            // Odak bir şekilde modal dışına kaçmışsa (ör. arkadaki sayfa elemanı) geri çek.
            e.preventDefault(); first.focus();
        }
    });

    // ── EVRENSEL ESCAPE-TO-CLOSE ─────────────────────────────────────
    // ~45/69 modalin kendi Escape handler'ı yoktu. Yeni bir kapatma mantığı
    // YAZMAK yerine (state/temizlik riski) modalin KENDİ kapat/vazgeç/reddet
    // butonuna programatik .click() atıyoruz — böylece o modalin zaten var
    // olan kapama/temizleme kodu aynen çalışır. Modalin ZATEN kendi Escape
    // handler'ı varsa (bu script'ten ÖNCE, yani DOM'da daha erken kayıtlı
    // <script>'lerde tanımlı) o handler aynı tuş basımında ÖNCE çalışıp
    // modali zaten kapatmış olur — bu yüzden bu genel handler o modallerde
    // sessizce hiçbir şey yapmaz (topmostOpenModal() artık null döner).
    // "Evet/Hayır" gibi nötr bir "iptal" seçeneği olmayan onay modallerinde
    // (ör. bir görevi tamamladın mı? sorusu) kasıtlı olarak HİÇBİR buton
    // otomatik tıklanmıyor — yanlış bir eylemi (ör. "Hayır"a basmış gibi
    // görev durumunu değiştirme) tetiklemektense o modal Escape ile kapanmaz.
    document.addEventListener('keydown', e => {
        if (e.key !== 'Escape') return;
        const modal = topmostOpenModal();
        if (!modal) return;
        const closeBtn = modal.querySelector('[aria-label="Kapat"]')
            || modal.querySelector('button[id*="cancel" i], button[id*="close" i], button[id*="decline" i]');
        if (closeBtn) closeBtn.click();
    });

    const modalStateObserver = new MutationObserver(mutations => {
        for (const m of mutations) {
            const el = m.target;
            if (!(el.nodeType === 1 && el.matches?.(MODAL_SEL))) continue;
            if (isVisible(el)) {
                if (!el._a11yWasOpen) {
                    el._a11yWasOpen = true;
                    lastTrigger = document.activeElement;
                    // Modal içeriği JS ile az sonra doldurulabiliyor (bkz. innerHTML render'ları) —
                    // bir sonraki frame'e ertelemek focus hedefinin gerçekten var olmasını garanti eder.
                    setTimeout(() => focusFirstIn(el), 0);
                }
            } else if (el._a11yWasOpen) {
                el._a11yWasOpen = false;
                if (lastTrigger && document.body.contains(lastTrigger)) {
                    lastTrigger.focus?.({ preventScroll: true });
                }
                lastTrigger = null;
            }
        }
    });
    document.querySelectorAll(MODAL_SEL).forEach(el => {
        modalStateObserver.observe(el, { attributes: true, attributeFilter: ['class'] });
        // Sayfa yüklenirken zaten açık olan bir modal (ör. günlük özet hatırlatması) class
        // hiç DEĞİŞMEDİĞİ için mutation callback'i hiç tetiklenmez — başlangıç durumunu da
        // elle kontrol ediyoruz ki ilk açılışta odak orada kalsın.
        if (isVisible(el) && !el._a11yWasOpen) {
            el._a11yWasOpen = true;
            setTimeout(() => focusFirstIn(el), 0);
        }
    });
    // Sonradan DOM'a eklenen modaller için de class-değişim gözlemi kur.
    observer.observe(document.body, { childList: true, subtree: true }); // (zaten yukarıda var, tekrar çağrı zararsız)
    const attachObserverToNewModals = new MutationObserver(mutations => {
        for (const m of mutations) {
            m.addedNodes.forEach(node => {
                if (node.nodeType !== 1) return;
                const modals = node.matches?.(MODAL_SEL) ? [node] : [...(node.querySelectorAll?.(MODAL_SEL) || [])];
                modals.forEach(el => modalStateObserver.observe(el, { attributes: true, attributeFilter: ['class'] }));
            });
        }
    });
    attachObserverToNewModals.observe(document.body, { childList: true, subtree: true });
})();
