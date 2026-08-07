// ─── GRUP ODAK OVERLAY — "ODAK MODU" / GHOST MODE ─────────────────────
// social.js dosyasından çıkarıldı (Faz 2, 2026-07-19 — orta risk grubu:
// bu özellik gfIsRunning/gfGhostModeEnabled durumunu social.js'in birkaç
// farklı yerinden doğrudan atama ile değiştiriyordu. Burada bu iki
// değişken artık TAMAMEN ÖZEL (module-scope) — dışarıdan sadece
// gfSetRunning()/gfSetGhostModeEnabled() setter'larıyla değiştirilebiliyor.
// Bu, social.js'teki "her yerden mutasyona uğrayabilen paylaşılan state"
// desenini gerçek bir kapsülleme sınırına çeviriyor.
let gfIdleTimeout = null;
let gfIdleBound = false;
let gfIsRunning = false;
let gfGhostModeEnabled = true;

export function gfResetIdleTimer() {
    clearTimeout(gfIdleTimeout);
    const overlay = document.getElementById('group-focus-overlay');
    if (!overlay) return;
    overlay.classList.remove('group-ghost-mode-active');
    if (gfGhostModeEnabled && gfIsRunning && overlay.classList.contains('group-focus-mode-active')) {
        gfIdleTimeout = setTimeout(() => {
            overlay.classList.add('group-ghost-mode-active');
        }, 3000);
    }
}
window.gfResetIdleTimer = gfResetIdleTimer;

export function gfEnsureIdleBindings() {
    if (gfIdleBound) return;
    gfIdleBound = true;
    ['mousemove', 'mousedown', 'keydown', 'touchstart'].forEach(evt => {
        document.addEventListener(evt, gfResetIdleTimer);
    });
}
window.gfEnsureIdleBindings = gfEnsureIdleBindings;

export function gfEnsureFocusModeBinding() {
    const btn = document.getElementById('gf-focus-mode-btn');
    if (!btn || btn.dataset.gfBound) return;
    btn.dataset.gfBound = '1';
    btn.addEventListener('click', () => {
        const overlay = document.getElementById('group-focus-overlay');
        if (!overlay) return;
        overlay.classList.toggle('group-focus-mode-active');
        if (overlay.classList.contains('group-focus-mode-active')) {
            btn.innerHTML = '<i class="fa-solid fa-compress"></i> Çıkış';
            btn.classList.replace('secondary', 'primary');
            gfResetIdleTimer();
        } else {
            btn.innerHTML = '<i class="fa-solid fa-expand"></i> Odak Modu';
            btn.classList.replace('primary', 'secondary');
            clearTimeout(gfIdleTimeout);
            overlay.classList.remove('group-ghost-mode-active');
        }
    });
}
window.gfEnsureFocusModeBinding = gfEnsureFocusModeBinding;

export function gfExitFocusMode() {
    const overlay = document.getElementById('group-focus-overlay');
    const btn = document.getElementById('gf-focus-mode-btn');
    if (overlay) overlay.classList.remove('group-focus-mode-active', 'group-ghost-mode-active');
    if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-expand"></i> Odak Modu';
        btn.classList.remove('primary');
        btn.classList.add('secondary');
    }
    clearTimeout(gfIdleTimeout);
}
window.gfExitFocusMode = gfExitFocusMode;

// ── Dışarıdan (social.js) durum güncellemesi için setter'lar ──
export function gfSetRunning(isRunning) {
    gfIsRunning = !!isRunning;
}
window.gfSetRunning = gfSetRunning;

export function gfSetGhostModeEnabled(enabled) {
    gfGhostModeEnabled = !!enabled;
    if (!gfGhostModeEnabled) {
        clearTimeout(gfIdleTimeout);
        document.getElementById('group-focus-overlay')?.classList.remove('group-ghost-mode-active');
    } else {
        gfResetIdleTimer();
    }
}
window.gfSetGhostModeEnabled = gfSetGhostModeEnabled;
