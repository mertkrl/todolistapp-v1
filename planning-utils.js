// ─── PLANLAMA — SAF YARDIMCILAR ───────────────────────────────────────
// planning.js dosyasından çıkarıldı (Faz 2, 2026-07-19). Sıfır paylaşılan
// state bağımlılığı — sadece parametre + Date/Math kullanıyorlar.
// uid() BİLEREK burada değil — planning.js içinde "uid" adı çok yerde
// (Supabase user id kısayolu olarak) yerel değişken adı olarak da kullanılıyor;
// bu isim çakışması mekanik taşımayı riskli kılıyor, o yüzden uid() planning.js'te
// bırakıldı.
function msUid() { return 'ms_' + Date.now() + '_' + Math.random().toString(36).slice(2,7); }
window.msUid = msUid;

function deadlineLabel(dl) {
    if (!dl) return '';
    const diff = Math.ceil((new Date(dl) - new Date()) / 86400000);
    if (diff < 0)   return `<span style="color:#f87171;">${Math.abs(diff)} gün geçti ⚠️</span>`;
    if (diff === 0) return `<span style="color:#ffd166;">Bugün son gün!</span>`;
    if (diff <= 7)  return `<span style="color:#ffd166;">${diff} gün kaldı</span>`;
    if (diff <= 30) return `<span style="color:#a78bfa;">${diff} gün kaldı</span>`;
    return `<span style="color:rgba(255,255,255,.35);">${diff} gün kaldı</span>`;
}
window.deadlineLabel = deadlineLabel;

function fmtDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('tr-TR', { day:'numeric', month:'short', year:'numeric' });
}
window.fmtDate = fmtDate;

function fmtShort(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('tr-TR', { day:'numeric', month:'short' });
}
window.fmtShort = fmtShort;

function progressRing(pct, color) {
    const r = 22, circ = 2 * Math.PI * r, dash = (pct/100)*circ;
    return `<div class="pg-ring-wrap">
        <svg width="56" height="56" viewBox="0 0 56 56" style="transform:rotate(-90deg);">
            <circle cx="28" cy="28" r="${r}" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="4"/>
            <circle cx="28" cy="28" r="${r}" fill="none" stroke="${color}" stroke-width="4"
                stroke-dasharray="${dash.toFixed(1)} ${(circ-dash).toFixed(1)}"
                stroke-linecap="round" style="transition:stroke-dasharray .6s ease;"/>
        </svg>
        <span class="pg-ring-pct" style="color:${color};">${pct}%</span>
    </div>`;
}
window.progressRing = progressRing;
