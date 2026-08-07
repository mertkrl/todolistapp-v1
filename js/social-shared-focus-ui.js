// ─── ORTAK ODAKLANMA — GÖRSEL BİLEŞENLER (pil/katılımcı/faz render) ────────
// social.js dosyasından çıkarıldı (Faz H devamı, 2026-07-30). Bu küme daha
// önce sharedFocusInFocusMode/gfMode/_gfLeaveBtnAC/sharedFocusDisplaySyncInterval
// gibi social.js'in bare closure değişkenlerine bağımlı olduğu için
// çıkarılamıyordu — hepsi artık state/*.js'te gerçek store, bu yüzden
// köprüsüz taşınabildi.
//
// social.js'te KALAN (taşınmayan) fonksiyonlara window köprüsüyle erişiliyor:
// updateSharedFocusPhaseLabel/startSharedBreakCountdownUI/
// recalcSharedFocusChatVisibility/gfApplyFocusModeFromState (odaklanma
// zamanlayıcı motorunun bir parçası, sharedFocusSession gibi başka
// paylaşımlı state'e bağımlı — bu görevin kapsamı dışında).
import { getSharedFocusTotalRounds } from '../state/shared-focus-total-rounds-store.js';
import { getSharedFocusBreakMinutes, setSharedFocusBreakMinutes } from '../state/shared-focus-break-minutes-store.js';
import { getSharedFocusBreakInterval, setSharedFocusBreakInterval } from '../state/shared-focus-break-interval-store.js';
import { getSharedFocusSoloMode } from '../state/shared-focus-solo-mode-store.js';
import { getSharedFocusPhaseInitialized, setSharedFocusPhaseInitialized } from '../state/shared-focus-phase-initialized-store.js';
import { getSharedFocusSession } from '../state/shared-focus-session-store.js';
import { getCurrentRoomPhase, setCurrentRoomPhase } from '../state/cw-room-phase-store.js';
import { getCurrentUser } from '../state/current-user-store.js';
import { getSharedFocusTotalSeconds, SHARED_FOCUS_DEFAULT_BREAK_MINUTES, deriveSharedFocusPhase } from './social-shared-focus-math.js';
import { gfRenderMetroTimeline, gfRenderParticipants } from './social-group-focus-render.js';
import { gfShowPhaseTransition } from './social-shared-focus-phase-ui.js';

let sharedFocusReturnBtnBound = false;

// Belirtilen dakika değerine göre hem overlay içindeki (bf-mode-pills) hem de
// davet öncesi ayar modalındaki (bfs-mode-pills) aktif pil görünümünü günceller.
window.applySharedFocusModePill = applySharedFocusModePill; // social-shared-focus-room-lifecycle.js için
export function applySharedFocusModePill(minutes) {
    if (!minutes) return;
    const input = document.getElementById('gf-duration-input');
    if (input) input.value = minutes;
    const bfsContainer = document.getElementById('bfs-mode-pills');
    if (bfsContainer) {
        bfsContainer.querySelectorAll('.bf-mode-btn').forEach(btn => {
            const t = parseInt(btn.dataset.bfsTime, 10);
            btn.classList.toggle('active', t === minutes);
        });
    }
    updateSharedFocusSettingsSummary();
}

// Mola süresi pillerinin (#bf-break-pills) aktif görünümünü günceller — partnerle senkron.
window.applySharedFocusBreakPill = applySharedFocusBreakPill; // social-shared-focus-room-lifecycle.js için
export function applySharedFocusBreakPill(minutes) {
    if (!minutes) return;
    const input = document.getElementById('gf-break-input');
    if (input) input.value = minutes;
    updateSharedFocusSettingsSummary();
}

// "Zamanlayıcı Ayarları" butonunun altındaki kısa özeti (örn. "25 dk çalışma · 10 dk mola") günceller
export function updateSharedFocusSettingsSummary() {
    const el = document.getElementById('bf-settings-summary');
    if (!el) return;
    const workMinutes = Math.round((getSharedFocusTotalSeconds() || (25 * 60)) / 60);
    const breakMinutes = getSharedFocusBreakMinutes() || SHARED_FOCUS_DEFAULT_BREAK_MINUTES;
    el.textContent = `${workMinutes} dk çalışma · ${breakMinutes} dk mola`;
}

// ── Aşama göstergesi (Metro timeline + Tur sayacı + halka rengi) ──
window.gfApplyPhaseIndicator = gfApplyPhaseIndicator; // social.js/social-shared-focus-*.js için
export function gfApplyPhaseIndicator(phaseType, round, totalRounds) {
    const isBreak = phaseType === 'break' || phaseType === 'shortBreak' || phaseType === 'longBreak';
    const counterEl = document.getElementById('gf-round-counter');
    const roundEl   = document.getElementById('gf-round-count');
    const totalEl   = document.getElementById('gf-round-total');

    // totalRounds: parametre → sharedFocusTotalRounds (güvenilir JS değişkeni) → DOM → varsayılan 4
    const rounds = (totalRounds && totalRounds > 0)
        ? totalRounds
        : (getSharedFocusTotalRounds() > 0 ? getSharedFocusTotalRounds() : (parseInt(totalEl?.textContent) || 4));
    // round: parametre → DOM'dan al
    const currentRound = (round && round > 0)
        ? round
        : (parseInt(roundEl?.textContent) || 1);

    // DOM'u güncelle
    if (counterEl) counterEl.style.display = '';
    if (roundEl)   roundEl.textContent   = currentRound;
    if (totalEl)   totalEl.textContent   = rounds;

    // Metro timeline: Her tur: focus(2i), break(2i+1). Son tur için break yok.
    // Son tur'un breakini oluşturmadığımız için max index = 2*rounds - 2
    let activeIdx = isBreak
        ? (currentRound - 1) * 2 + 1
        : (currentRound - 1) * 2;
    // Son turda break yoksa sınırla
    const maxIdx = rounds * 2 - 2; // son focus indeksi
    activeIdx = Math.min(activeIdx, maxIdx + (isBreak ? 0 : 0));

    const focusMin = parseInt(document.getElementById('gf-duration-input')?.value) || 25;
    const breakMin = parseInt(document.getElementById('gf-break-input')?.value) || 10;
    gfRenderMetroTimeline(rounds, activeIdx, focusMin, breakMin);

    // Halka rengi
    const overlay = document.getElementById('group-focus-overlay');
    if (overlay) {
        overlay.classList.toggle('gf-phase-focus', !isBreak);
        overlay.classList.toggle('gf-phase-break', isBreak);
    }
}

// Mini Odak Odası'ndaki "Ortak Odaklanma Arayüzüne Dön" butonu — tek seferlik bağlanır
window.ensureSharedFocusReturnButtonBinding = ensureSharedFocusReturnButtonBinding; // social-shared-focus-room-lifecycle.js için
export function ensureSharedFocusReturnButtonBinding() {
    if (sharedFocusReturnBtnBound) return;
    const btn = document.getElementById('scw-return-shared-focus-btn');
    if (!btn) return;
    sharedFocusReturnBtnBound = true;
    btn.addEventListener('click', () => {
        window.restoreSharedFocusOverlay();
    });
}

// ──────────────────────────────────────────────────────
// PARTNER / KATILIMCI BİLGİSİ — "Birlikte Çalışalım" arayüzündeki
// katılımcı kartlarıyla aynı görünümde gösterir
// ──────────────────────────────────────────────────────
window.renderSharedFocusParticipants = renderSharedFocusParticipants; // social-shared-focus-room-lifecycle.js/timer-ctrl.js için
export function renderSharedFocusParticipants(room) {
    const people = [];
    if (getSharedFocusSoloMode()) {
        people.push(getCurrentUser()?.displayName || 'Sen');
    } else {
        (room.members || []).forEach(m => { if (m.displayName) people.push(m.displayName); });
    }
    gfRenderParticipants(people);
}

window.applySharedFocusPhase = applySharedFocusPhase; // social-shared-focus-room-lifecycle.js/timer-ctrl.js için
export function applySharedFocusPhase(room, isHost) {
    // Faz artık odada saklanmıyor — grup odaklanmasındaki gibi yalnızca
    // startedAt/paused/pausedAt'tan türetiliyor (komut round-trip'i yok)
    let newPhase = 'work';
    let derivedPh = null;
    if (room.startedAt && getSharedFocusSession()) {
        derivedPh = deriveSharedFocusPhase(getSharedFocusSession(), Date.now());
        if (derivedPh) newPhase = (derivedPh.type === 'break') ? 'break' : 'work';
    }

    window.updateSharedFocusPhaseLabel(room, isHost, newPhase);

    const phaseChanged = getSharedFocusPhaseInitialized() && newPhase !== getCurrentRoomPhase();
    setCurrentRoomPhase(newPhase);

    // Faz gerçekten değiştiyse (ilk yüklemede değil) yumuşak geçiş ekranını göster
    if (phaseChanged) {
        gfShowPhaseTransition(newPhase);
    }
    setSharedFocusPhaseInitialized(true);

    if (room.breakMinutes) {
        setSharedFocusBreakMinutes(room.breakMinutes);
    }

    if (newPhase === 'break' && derivedPh) {
        window.startSharedBreakCountdownUI(Date.now() + derivedPh.remainingMs);
    } else if (getSharedFocusBreakInterval()) {
        clearInterval(getSharedFocusBreakInterval());
        setSharedFocusBreakInterval(null);
    }

    // Sohbetin görünürlüğü artık sadece molaya değil, faz + çalışma durumuna göre belirlenir
    window.recalcSharedFocusChatVisibility();
    window.gfApplyFocusModeFromState();
}

// Birleştirilmiş arayüzde ayrı bir görev-durumu paneli yok — görev bilgisi
// doğrudan `.active-focus-task` alanında (gfApplyActiveTaskDisplay) gösteriliyor.
window.renderSharedFocusTaskStatus = renderSharedFocusTaskStatus; // social-shared-focus-room-lifecycle.js/timer-ctrl.js için
export function renderSharedFocusTaskStatus(room, isHost) {}
