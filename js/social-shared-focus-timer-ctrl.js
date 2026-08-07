// ─── ORTAK ODAKLANMA — ZAMANLAYICI KONTROLÜ / SIFIRLAMA / KAPATMA ──────────
// social.js dosyasından çıkarıldı (Faz H devamı, 2026-07-30). Aynı sebep ve
// desen için social-shared-focus-ui.js dosyasındaki başlık yorumuna bakın.
//
// social.js'te KALAN (taşınmayan) fonksiyonlara window köprüsüyle erişiliyor:
// buildSoloFocusRoomLike/recordSharedFocusMinute/
// handleSharedFocusFocusPhaseComplete/gfDoEndSession (odaklanma zamanlayıcı
// motorunun bir parçası, sharedFocusSession gibi başka paylaşımlı state'e
// bağımlı — bu görevin kapsamı dışında).
import { getScwTimerInterval, setScwTimerInterval, setIsScwRunning, setScwTimeLeft, getScwTimeLeft } from '../state/scw-timer-store.js';
import { getSharedFocusSession, setSharedFocusSession } from '../state/shared-focus-session-store.js';
import { getSharedFocusSoloMode, setSharedFocusSoloMode } from '../state/shared-focus-solo-mode-store.js';
import { getSharedFocusDisplaySyncInterval, setSharedFocusDisplaySyncInterval } from '../state/shared-focus-display-sync-interval-store.js';
import { getSharedFocusBreakInterval, setSharedFocusBreakInterval } from '../state/shared-focus-break-interval-store.js';
import { getSharedFocusInFocusMode, setSharedFocusInFocusMode } from '../state/shared-focus-in-focus-mode-store.js';
import { setSharedFocusPhaseInitialized } from '../state/shared-focus-phase-initialized-store.js';
import { setGfMode } from '../state/gf-mode-store.js';
import { getCurrentRoomId } from '../state/cw-current-room-store.js';
import { deriveSharedFocusPhase } from './social-shared-focus-math.js';
import { _escapeHtml } from './social-misc-pure-utils.js';
import { renderSharedFocusParticipants, applySharedFocusPhase, renderSharedFocusTaskStatus } from './social-shared-focus-ui.js';

// Odada geriye tek kişi kalınca ("partnerin ayrıldı") gösterilen soru —
// JS ile dinamik oluşturulan modal (gf-habit-complete-overlay ile aynı desen).
window._cwShowSoloContinuePrompt = _cwShowSoloContinuePrompt; // social-shared-focus-room-lifecycle.js için
export function _cwShowSoloContinuePrompt(leftDisplayName) {
    document.getElementById('gf-solo-continue-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'gf-solo-continue-overlay';
    overlay.className = 'modal-overlay';
    overlay.style.zIndex = '10400';
    overlay.innerHTML = `
        <div class="modal-content glass-panel u-max-width-370px_text-align-center_padding-28px24px" >
            <div class="u-font-size-32px_margin-bottom-12px">🚪</div>
            <h3 class="u-margin-008px_font-size-17px_color-hfff">${_escapeHtml(leftDisplayName)} oturumdan ayrıldı</h3>
            <p class="u-color-var-text-muted_font-size-13px_margin-0022px">Odada yalnız kaldın. Tek başına odaklanmaya devam etmek ister misin?</p>
            <div class="u-display-flex_flex-direction-column_gap-10px-2">
                <button id="gf-solo-continue-yes-btn" class="control-btn primary u-width-100pct_padding-12px" >
                    <i class="fa-solid fa-person-running"></i> Evet, Devam Et
                </button>
                <button id="gf-solo-continue-no-btn" class="control-btn u-width-100pct_padding-12px_background-rgba2552552550p05" >
                    <i class="fa-solid fa-flag-checkered"></i> Hayır, Oturumu Bitir
                </button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    document.getElementById('gf-solo-continue-yes-btn').addEventListener('click', () => overlay.remove());
    document.getElementById('gf-solo-continue-no-btn').addEventListener('click', () => {
        overlay.remove();
        window.gfDoEndSession();
    });
}

// Misafir tarafında: partner "restarting" yazdığında gösterilecek bildirim modalı
window.gfShowPartnerRestartingModal = gfShowPartnerRestartingModal; // social-shared-focus-room-lifecycle.js için
export function gfShowPartnerRestartingModal(hostName) {
    const modal = document.getElementById('gf-partner-restarting-modal');
    if (!modal) return;
    const titleEl  = document.getElementById('gf-restarting-title');
    const descEl   = document.getElementById('gf-restarting-desc');
    const statusEl = document.getElementById('gf-restarting-status-text');
    if (titleEl)  titleEl.textContent = 'Oturum Yeniden Başlatılıyor';
    if (descEl)   descEl.textContent  = `${hostName || 'Partnerin'} oturumu sıfırlıyor ve yeni ayarlarla sana davet gönderecek. Birazdan bir davet bildirimi alacaksın.`;
    if (statusEl) statusEl.textContent = 'Davet bekleniyor...';
    modal.classList.remove('hidden');

    // Tamam butonu
    const okBtn = document.getElementById('gf-restarting-ok-btn');
    if (okBtn && !okBtn.dataset.bound) {
        okBtn.dataset.bound = '1';
        okBtn.addEventListener('click', () => modal.classList.add('hidden'));
    }
}

// ── BİRLEŞİK TÜRETİLMİŞ-ZAMAN MOTORU ──
// Hem yalnız hem ortak odaklanma seansları artık tek bir `getSharedFocusSession()`
// ({startedAt, paused, pausedAt, focusMinutes, breakMinutes}) modelinden türetiliyor.
// Yalnız modda bu nesne yereldir; ortak modda Firebase'den aynalanır — tek motor, tek kaynak.
window.startSharedFocusDerivedTimer = startSharedFocusDerivedTimer; // social-shared-focus-room-lifecycle.js için
export function startSharedFocusDerivedTimer() {
    if (getScwTimerInterval()) return;
    setIsScwRunning(true);
    document.getElementById('scw-start-btn')?.classList.add('hidden');
    document.getElementById('scw-pause-btn')?.classList.remove('hidden');
    window.syncXP();

    let _lastMinuteMark = -1;
    let _lastPhase = null;

    const tick = () => {
        if (!getSharedFocusSession()) {
            clearInterval(getScwTimerInterval());
            setScwTimerInterval(null);
            setIsScwRunning(false);
            return;
        }
        const now = Date.now();
        const ph = deriveSharedFocusPhase(getSharedFocusSession(), now);
        if (!ph) return;

        const remainSec = Math.max(0, Math.round(ph.remainingMs / 1000));
        setScwTimeLeft(remainSec);
        const mEl = document.getElementById('scw-minutes');
        const sEl = document.getElementById('scw-seconds');
        if (mEl) mEl.textContent = String(Math.floor(remainSec / 60)).padStart(2, '0');
        if (sEl) sEl.textContent = String(remainSec % 60).padStart(2, '0');

        // Bireysel modda oda dinleyicisi olmadığından, "Birlikte Çalışalım" arayüzünü besleyen
        // aynı render fonksiyonlarını burada sahte bir "oda" nesnesiyle besliyoruz —
        // böylece faz etiketi/geçiş animasyonu/katılımcı/görev paneli bire bir aynı şekilde çalışır
        if (getSharedFocusSoloMode()) {
            const soloRoom = window.buildSoloFocusRoomLike();
            renderSharedFocusParticipants(soloRoom);
            applySharedFocusPhase(soloRoom, true);
            renderSharedFocusTaskStatus(soloRoom, true);
        }

        // Grup odaklanmasındaki gibi: geçen her 60 saniyelik çalışma süresi için istatistiklere 1 dk ekle
        if (ph.type === 'work' && !getSharedFocusSession().paused) {
            const elapsedWorkSec = Math.floor((ph.durMs - ph.remainingMs) / 1000);
            const minuteMark = Math.floor(elapsedWorkSec / 60);
            if (minuteMark === 0) _lastMinuteMark = -1;
            if (minuteMark > _lastMinuteMark && minuteMark > 0) {
                _lastMinuteMark = minuteMark;
                window.recordSharedFocusMinute();
            }
        }

        // Çalışma fazından çıkış anını yakala (mola başlangıcı veya seans sonu) — yalnızca bir kez tetikle
        if (_lastPhase === 'work' && ph.type !== 'work') {
            window.handleSharedFocusFocusPhaseComplete();
        }
        _lastPhase = ph.type;

        if (ph.type === 'done') {
            clearInterval(getScwTimerInterval());
            setScwTimerInterval(null);
            setIsScwRunning(false);
            setSharedFocusSession(null);
            document.getElementById('scw-start-btn')?.classList.remove('hidden');
            document.getElementById('scw-pause-btn')?.classList.add('hidden');
        }
    };

    tick();
    setScwTimerInterval(setInterval(tick, 1000));
}

// Ayrı odak odası arayüzünü kapatır (overlay + zamanlayıcı senkron aralığı + odaklanma
// modu bayrakları) — çıkışta (exitCWRoomLocal) ve sıfırlamada (resetScwTimer) kullanılır.
window.closeSharedFocusOverlay = closeSharedFocusOverlay; // social-shared-focus-room-lifecycle.js için
export function closeSharedFocusOverlay() {
    window.closeGroupFocusOverlay();
    if (getSharedFocusDisplaySyncInterval()) { clearInterval(getSharedFocusDisplaySyncInterval()); setSharedFocusDisplaySyncInterval(null); }
    if (getSharedFocusBreakInterval()) { clearInterval(getSharedFocusBreakInterval()); setSharedFocusBreakInterval(null); }
    setSharedFocusInFocusMode(false);
    setSharedFocusPhaseInitialized(false);
    setSharedFocusSoloMode(false);
    setGfMode(null);
}

export function resetScwTimer() {
    if (getScwTimerInterval()) { clearInterval(getScwTimerInterval()); setScwTimerInterval(null); }
    setIsScwRunning(false);
    setSharedFocusSession(null);
    const activeMode = document.querySelector('.scw-mode-btn.active');
    setScwTimeLeft(activeMode ? parseInt(activeMode.dataset.scwTime) * 60 : 25 * 60);
    document.getElementById('scw-minutes').textContent = String(Math.floor(getScwTimeLeft() / 60)).padStart(2, '0');
    document.getElementById('scw-seconds').textContent = String(getScwTimeLeft() % 60).padStart(2, '0');
    document.getElementById('scw-start-btn')?.classList.remove('hidden');
    document.getElementById('scw-pause-btn')?.classList.add('hidden');
    if (getSharedFocusSoloMode() && !getCurrentRoomId()) closeSharedFocusOverlay();
}
