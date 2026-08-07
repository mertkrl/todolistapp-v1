// ─── PLANLAMA — SAF YARDIMCILAR ───────────────────────────────────────
// planning.js dosyasından çıkarıldı (Faz 2, 2026-07-19). Sıfır paylaşılan
// state bağımlılığı — sadece parametre + Date/Math kullanıyorlar.
// uid() BİLEREK burada değil — planning.js içinde "uid" adı çok yerde
// (Supabase user id kısayolu olarak) yerel değişken adı olarak da kullanılıyor;
// bu isim çakışması mekanik taşımayı riskli kılıyor, o yüzden uid() planning.js'te
// bırakıldı.
export const CATEGORIES = [
    { id: 'egitim',  label: 'Eğitim',  icon: '🧠', color: '#7c6eff' },
    { id: 'saglik',  label: 'Sağlık',  icon: '💪', color: '#ef476f' },
    { id: 'kariyer', label: 'Kariyer', icon: '💼', color: '#06d6a0' },
    { id: 'finans',  label: 'Finans',  icon: '💰', color: '#ffd166' },
    { id: 'kisisel', label: 'Kişisel', icon: '🌱', color: '#ff9f43' },
    { id: 'diger',   label: 'Diğer',   icon: '✨', color: '#a78bfa' },
];
window.CATEGORIES = CATEGORIES;

export function getCat(id) { return CATEGORIES.find(c => c.id === id) || CATEGORIES[5]; }
window.getCat = getCat;

export function msUid() { return 'ms_' + Date.now() + '_' + Math.random().toString(36).slice(2,7); }
window.msUid = msUid;

export function deadlineLabel(dl) {
    if (!dl) return '';
    const diff = Math.ceil((new Date(dl) - new Date()) / 86400000);
    if (diff < 0)   return `<span class="u-color-hf87171">${Math.abs(diff)} gün geçti ⚠️</span>`;
    if (diff === 0) return `<span class="u-color-hffd166">Bugün son gün!</span>`;
    if (diff <= 7)  return `<span class="u-color-hffd166">${diff} gün kaldı</span>`;
    if (diff <= 30) return `<span class="u-color-ha78bfa">${diff} gün kaldı</span>`;
    return `<span class="u-color-rgba255255255p35">${diff} gün kaldı</span>`;
}
window.deadlineLabel = deadlineLabel;

export function fmtDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('tr-TR', { day:'numeric', month:'short', year:'numeric' });
}
window.fmtDate = fmtDate;

export function fmtShort(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('tr-TR', { day:'numeric', month:'short' });
}
window.fmtShort = fmtShort;

export function progressRing(pct, color) {
    const r = 22, circ = 2 * Math.PI * r, dash = (pct/100)*circ;
    return `<div class="pg-ring-wrap">
        <svg width="56" height="56" viewBox="0 0 56 56" class="u-transform-rotate-90deg">
            <circle cx="28" cy="28" r="${r}" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="4"/>
            <circle cx="28" cy="28" r="${r}" fill="none" stroke-width="4" data-pr-color="${color}"
 stroke-dasharray="${dash.toFixed(1)} ${(circ-dash).toFixed(1)}"
 stroke-linecap="round" / class="u-transition-stroke-dasharrayp6sease">
        </svg>
        <span class="pg-ring-pct" data-pr-color="${color}">${pct}%</span>
    </div>`;
}
window.progressRing = progressRing;

// progressRing() birçok farklı dosyada (nested template literal içinde) çağrılıyor;
// her çağrı noktasını güncellemek yerine, halka/rengin rengini DOM'a eklendiği anda
// otomatik uygulayan bu gözlemci CSP style-src'nin interpolated inline style'ları
// hash'leyemediği sorunu tek merkezden çözüyor (bkz. social-avatar-utils.js'teki
// aynı desen).
function _applyPendingRingColors(root) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll('[data-pr-color]:not([data-pr-applied])').forEach(el => {
        const color = el.getAttribute('data-pr-color');
        if (el.tagName === 'circle') el.setAttribute('stroke', color);
        else el.style.color = color;
        el.setAttribute('data-pr-applied', '1');
    });
}
function _startRingColorObserver() {
    const obs = new MutationObserver(mutations => {
        for (const mut of mutations) {
            mut.addedNodes.forEach(node => {
                if (node.nodeType !== 1) return;
                _applyPendingRingColors(node);
                if (node.matches && node.matches('[data-pr-color]:not([data-pr-applied])')) {
                    _applyPendingRingColors(node.parentNode || node);
                }
            });
        }
    });
    obs.observe(document.body, { childList: true, subtree: true });
}
if (typeof document !== 'undefined') {
    if (document.body) _startRingColorObserver();
    else document.addEventListener('DOMContentLoaded', _startRingColorObserver);
}
