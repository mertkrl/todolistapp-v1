// ─── ORTAK ODAKLANMA — FAZ GEÇİŞ (İŞ↔MOLA) BİLDİRİM OVERLAY'İ ──────────────
// social.js dosyasından çıkarıldı (Faz O, social.js turu, 5. tur): iş↔mola
// geçişinde ortada beliren "Mola Zamanı!"/"Odaklanma Başlıyor!" overlay'ini
// gösterip gizleyen çift. `sharedFocusPhaseTransitionTimeout` (setTimeout
// handle) SADECE bu iki fonksiyon tarafından kullanılıyor (grep ile
// doğrulandı) — bridge gerekmeden yerel state olarak taşınabildi.
import { dcSetHushMode } from './social-focus-hush.js';

let sharedFocusPhaseTransitionTimeout = null;

function gfShowPhaseTransition(phase) {
    const el = document.getElementById('gf-phase-transition');
    const emojiEl = document.getElementById('gf-phase-transition-emoji');
    const textEl = document.getElementById('gf-phase-transition-text');
    if (!el || !emojiEl || !textEl) return;

    if (phase === 'break') {
        emojiEl.textContent = '☕';
        textEl.textContent = 'Mola Zamanı!';
        dcSetHushMode(false);
    } else {
        emojiEl.textContent = '🧠';
        textEl.textContent = 'Odaklanma Başlıyor!';
        dcSetHushMode(true);
    }

    if (sharedFocusPhaseTransitionTimeout) { clearTimeout(sharedFocusPhaseTransitionTimeout); sharedFocusPhaseTransitionTimeout = null; }
    el.classList.remove('hidden');
    requestAnimationFrame(() => el.classList.add('visible'));
    sharedFocusPhaseTransitionTimeout = setTimeout(() => {
        el.classList.remove('visible');
        sharedFocusPhaseTransitionTimeout = setTimeout(() => {
            el.classList.add('hidden');
            sharedFocusPhaseTransitionTimeout = null;
        }, 500);
    }, 2200);
}

function gfHidePhaseTransition() {
    const el = document.getElementById('gf-phase-transition');
    if (sharedFocusPhaseTransitionTimeout) { clearTimeout(sharedFocusPhaseTransitionTimeout); sharedFocusPhaseTransitionTimeout = null; }
    if (el) { el.classList.remove('visible'); el.classList.add('hidden'); }
}

// Faz O: gerçek export (social.js bu dosyadan SONRA yüklendiği için güvenli
// — bkz. inline-module-loader.js).
export { gfShowPhaseTransition, gfHidePhaseTransition };
