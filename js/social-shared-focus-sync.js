import { _escapeHtml } from './social-misc-pure-utils.js';
import { _cwOthersLabel } from './social-cw-room-helpers.js';
import { gfResetIdleTimer, gfSetRunning } from './social-group-focus-idle.js';
import { gfStartQuoteRotation, gfStopQuoteRotation } from './social-focus-quote-rotation.js';
import { gfRenderMetroTimeline, gfUpdateRing } from './social-group-focus-render.js';
import {
    deriveSharedFocusPhase, buildSharedFocusResumeUpdate, buildSharedFocusSkipUpdate,
    gfComputeCurrentRound
} from './social-shared-focus-math.js';
import { gfApplyPhaseIndicator } from './social-shared-focus-ui.js';
import { resetScwTimer } from './social-shared-focus-timer-ctrl.js';
import { getScwTimeLeft, getIsScwRunning } from '../state/scw-timer-store.js';
import { getCwRoomLinkedHabit } from '../state/cw-room-linked-habit-store.js';
import { getCwRoomIsSupabase } from '../state/cw-current-room-store.js';
import { getCurrentRoomId } from '../state/cw-current-room-store.js';
import { getCurrentRoomPhase } from '../state/cw-room-phase-store.js';
import { getSharedFocusBreakInterval, setSharedFocusBreakInterval } from '../state/shared-focus-break-interval-store.js';
import { getSharedFocusSoloMode } from '../state/shared-focus-solo-mode-store.js';
import { getSharedFocusSession } from '../state/shared-focus-session-store.js';
import { getSharedFocusTotalRounds } from '../state/shared-focus-total-rounds-store.js';
import { getSharedFocusInFocusMode, setSharedFocusInFocusMode } from '../state/shared-focus-in-focus-mode-store.js';

// Sohbetin görünürlüğünü tek noktadan hesaplar:
// - Mola sırasında HER ZAMAN görünür
// - Odaklanma seansı çalışırken (work fazı + zamanlayıcı aktif) GİZLİDİR
// - Seans henüz başlamadıysa veya duraklatıldıysa/bittiyse tekrar GÖRÜNÜR
export function recalcSharedFocusChatVisibility() {
    const onBreak = getCurrentRoomPhase() === 'break';
    if (getSharedFocusSoloMode()) {
        // Bireysel modda yalnızca mola fazında panel gösterilir (Firebase bağlantısı yok)
        toggleSharedFocusBreakChat(onBreak);
        return;
    }
    const shouldShow = onBreak || !getIsScwRunning();
    toggleSharedFocusBreakChat(shouldShow);
}
window.recalcSharedFocusChatVisibility = recalcSharedFocusChatVisibility;

// Sadece görünürlüğü değiştirir — mesaj geçmişi korunur (sohbet sürekli dinleniyor,
// yalnızca odaklanma çalışırken gizleniyor, durunca/molada tekrar açılıyor)
export function toggleSharedFocusBreakChat(show) {
    const chatEl = document.getElementById('gf-break-chat');
    if (!chatEl) return;
    chatEl.classList.toggle('visible', !!show);
    // Bireysel modda panel açılınca mola mesajını göster (Firebase bağlantısı yok)
    if (show && getSharedFocusSoloMode()) {
        const msgsEl = document.getElementById('gf-break-chat-messages');
        if (msgsEl && msgsEl.querySelector('.cws-bc-empty')) {
            msgsEl.innerHTML = '<div class="cws-bc-empty">☕ Mola zamanı! Biraz dinlen, su iç.</div>';
        }
        const inputRow = chatEl.querySelector('.cws-bc-input-row');
        if (inputRow) inputRow.style.display = 'none';
    } else if (!show && getSharedFocusSoloMode()) {
        const inputRow = chatEl.querySelector('.cws-bc-input-row');
        if (inputRow) inputRow.style.display = '';
    }
}
window.toggleSharedFocusBreakChat = toggleSharedFocusBreakChat;

// Bireysel arayüzdeki .timer-modes (Odaklanma/Mola sekmeleri) ile birebir aynı
// göstergeyi günceller — "Tur" sayacı oda modunda partner bilgisini taşır
export function updateSharedFocusPhaseLabel(room, isHost, phase) {
    const _currentRound = gfComputeCurrentRound(getSharedFocusSession(), getSharedFocusTotalRounds());
    gfApplyPhaseIndicator(phase, _currentRound, getSharedFocusTotalRounds());
    const counterEl = document.getElementById('gf-round-counter');
    if (!counterEl) return;

    if (getSharedFocusSoloMode()) {
        counterEl.innerHTML = (phase === 'break')
            ? '<i class="fa-solid fa-mug-hot"></i> Kısa bir mola ver — birazdan tekrar odaklanmaya devam edeceksin.'
            : (getCwRoomLinkedHabit()
                ? `<i class="fa-solid fa-bullseye"></i> "${_escapeHtml(getCwRoomLinkedHabit().name)}" alışkanlığın için tek başına odaklanıyorsun.`
                : '<i class="fa-solid fa-bullseye"></i> Tek başına odaklanıyorsun — devam et!');
        counterEl.style.display = '';
        return;
    }

    const partner = _cwOthersLabel(room);
    if (!partner) {
        counterEl.innerHTML = '<i class="fa-solid fa-hourglass-half"></i> Partnerin katılması bekleniyor...';
    } else if (phase === 'break') {
        counterEl.innerHTML = `<i class="fa-solid fa-mug-hot"></i> ${_escapeHtml(partner)} ile moladasınız — sohbet edebilirsiniz.`;
    } else if (getCwRoomLinkedHabit()) {
        counterEl.innerHTML = `<i class="fa-solid fa-people-arrows"></i> ${_escapeHtml(partner)} ile "${_escapeHtml(getCwRoomLinkedHabit().name)}" ortak alışkanlığınız için odaklanıyorsunuz.`;
    } else {
        counterEl.innerHTML = `<i class="fa-solid fa-people-arrows"></i> ${_escapeHtml(partner)} ile birlikte odaklanıyorsunuz.`;
    }
    counterEl.style.display = '';
}
window.updateSharedFocusPhaseLabel = updateSharedFocusPhaseLabel;

// Mola geri sayımını ekranda gösterir — yalnızca görsel; faz geçişi artık tamamen
// startedAt'tan türetildiği için burada Firebase'e hiçbir yazma yapılmaz
// (grup odaklanmasındaki gibi her client kendi ekranını bağımsız hesaplar).
export function startSharedBreakCountdownUI(breakEndsAt) {
    if (getSharedFocusBreakInterval()) clearInterval(getSharedFocusBreakInterval());
    const counterEl = document.getElementById('gf-round-counter');
    const tick = () => {
        const remain = Math.max(0, Math.round((breakEndsAt - Date.now()) / 1000));
        const m = Math.floor(remain / 60);
        const s = remain % 60;
        if (counterEl) counterEl.innerHTML = `<i class="fa-solid fa-mug-hot"></i> Mola bitmesine kalan süre: ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        if (remain <= 0) {
            clearInterval(getSharedFocusBreakInterval());
            setSharedFocusBreakInterval(null);
        }
    };
    tick();
    setSharedFocusBreakInterval(setInterval(tick, 1000));
}
window.startSharedBreakCountdownUI = startSharedBreakCountdownUI;

// Çalışma durumu değiştiğinde "Odak Modu"na uygun şekilde alıntı rotasyonunu/ghost-mode iznini günceller
export function gfApplyFocusModeFromState() {
    const shouldFocus = getIsScwRunning() && getCurrentRoomPhase() !== 'break';
    gfSetRunning(shouldFocus);
    if (shouldFocus !== getSharedFocusInFocusMode()) {
        setSharedFocusInFocusMode(shouldFocus);
        if (shouldFocus) gfStartQuoteRotation();
        else gfStopQuoteRotation();
        // Yalnızca durum GERÇEKTEN değiştiğinde yeniden tetikle — her tick'te
        // çağrılırsa zamanlayıcı sürekli sıfırlanır ve ghost-mode hiç tetiklenmez
        gfResetIdleTimer();
    }
}
window.gfApplyFocusModeFromState = gfApplyFocusModeFromState;

// Başlat/Devam Et — grup odaklanmasındaki gibi doğrudan startedAt/paused/pausedAt yazar,
// hiçbir 'command' round-trip'i yok; her iki taraf da roomRef değişikliğinden anında türetir
export function requestSharedFocusStart() {
    if (getCurrentRoomId() && getCwRoomIsSupabase() && window.FocusSupabase) {
        window.FocusSupabase.from('cw_rooms').select('started_at, paused, paused_at').eq('id', getCurrentRoomId()).single()
            .then(({ data: row, error }) => {
                if (error || !row) return;
                const now = new Date().toISOString();
                if (row.started_at && row.paused) {
                    const session = { startedAt: new Date(row.started_at).getTime(), paused: true, pausedAt: row.paused_at ? new Date(row.paused_at).getTime() : null };
                    const upd = buildSharedFocusResumeUpdate(session, Date.now());
                    window.FocusSupabase.from('cw_rooms').update({
                        started_at: new Date(upd.startedAt).toISOString(),
                        paused: false, paused_at: null
                    }).eq('id', getCurrentRoomId()).then(() => {});
                } else if (!row.started_at) {
                    window.FocusSupabase.from('cw_rooms').update({ started_at: now, paused: false, paused_at: null }).eq('id', getCurrentRoomId()).then(() => {});
                }
            });
    } else {
        window.startLocalScw();
    }
}
window.requestSharedFocusStart = requestSharedFocusStart;

// Duraklat/Devam Et — anlık durumu okuyup tersine çevirir (grup odaklanmasındaki pause-toggle ile aynı)
export function requestSharedFocusPauseToggle() {
    if (getCurrentRoomId() && getCwRoomIsSupabase() && window.FocusSupabase) {
        window.FocusSupabase.from('cw_rooms').select('started_at, paused, paused_at').eq('id', getCurrentRoomId()).single()
            .then(({ data: row, error }) => {
                if (error || !row || !row.started_at) return;
                if (!row.paused) {
                    window.FocusSupabase.from('cw_rooms').update({ paused: true, paused_at: new Date().toISOString() }).eq('id', getCurrentRoomId()).then(() => {});
                } else {
                    const session = { startedAt: new Date(row.started_at).getTime(), paused: true, pausedAt: row.paused_at ? new Date(row.paused_at).getTime() : null };
                    const upd = buildSharedFocusResumeUpdate(session, Date.now());
                    window.FocusSupabase.from('cw_rooms').update({
                        started_at: new Date(upd.startedAt).toISOString(),
                        paused: false, paused_at: null
                    }).eq('id', getCurrentRoomId()).then(() => {});
                }
            });
    } else if (getIsScwRunning()) {
        window.pauseLocalScw();
    } else {
        window.startLocalScw();
    }
}
window.requestSharedFocusPauseToggle = requestSharedFocusPauseToggle;

export function requestSharedFocusReset() {
    if (getCurrentRoomId() && getCwRoomIsSupabase() && window.FocusSupabase) {
        window.FocusSupabase.from('cw_rooms').update({ started_at: null, paused: false, paused_at: null }).eq('id', getCurrentRoomId()).then(() => {});
    } else {
        resetScwTimer();
    }
}
window.requestSharedFocusReset = requestSharedFocusReset;

// Oda/bireysel modda gf-* halkasını ve kontrol butonlarını 500ms'de bir
// türetilmiş zamana göre günceller — bireysel zamanlayıcının `updateTimerDisplay`
// deseniyle birebir aynı (her iki taraf da yalnızca startedAt'tan kendi ekranını çizer)
export function syncSharedFocusTimerUI() {
    const startBtn = document.getElementById('gf-start-btn');
    const pauseBtn = document.getElementById('gf-pause-btn');
    const pauseIcon = document.getElementById('gf-pause-icon');
    if (getSharedFocusSession()) {
        const ph = deriveSharedFocusPhase(getSharedFocusSession(), Date.now());
        if (ph) {
            gfUpdateRing(ph.remainingMs, ph.durMs);
            const currentRound = gfComputeCurrentRound(getSharedFocusSession(), getSharedFocusTotalRounds());
            gfApplyPhaseIndicator(ph.type === 'break' ? 'break' : 'focus', currentRound, getSharedFocusTotalRounds());
        }
        if (startBtn) startBtn.classList.add('hidden');
        if (pauseBtn) pauseBtn.classList.remove('hidden');
        if (pauseIcon) pauseIcon.className = getSharedFocusSession().paused ? 'fa-solid fa-play' : 'fa-solid fa-pause';
    } else {
        const totalMs = Math.max(0, (getScwTimeLeft() || 0)) * 1000;
        gfUpdateRing(totalMs, totalMs || 1);
        gfApplyPhaseIndicator('focus', 1, getSharedFocusTotalRounds());
        if (startBtn) startBtn.classList.remove('hidden');
        if (pauseBtn) pauseBtn.classList.add('hidden');
        if (pauseIcon) pauseIcon.className = 'fa-solid fa-pause';
    }
}
window.syncSharedFocusTimerUI = syncSharedFocusTimerUI;

export function recordSharedFocusMinute() {
    if (getCurrentRoomPhase() === 'break') return; // Mola fazında (ortak ya da bireysel) odak dakikası sayılmaz
    try {
        if (typeof FocusStorage !== 'undefined') {
            FocusStorage.set('total_focus_minutes', (FocusStorage.get('total_focus_minutes', 0) || 0) + 1);
            FocusStorage.set('focus_minutes', (FocusStorage.get('focus_minutes', 0) || 0) + 1);
            const _td = new Date();
            const _key = String(_td.getDate()).padStart(2, '0') + '-' + String(_td.getMonth() + 1).padStart(2, '0') + '-' + _td.getFullYear();
            const _fh = FocusStorage.get('focus_history', {});
            _fh[_key] = (_fh[_key] || 0) + 1;
            FocusStorage.set('focus_history', _fh);
        } else {
            const prev = parseInt(localStorage.getItem('focusai_total_focus_minutes') || '0');
            localStorage.setItem('focusai_total_focus_minutes', prev + 1);
        }
        if (typeof syncXP === 'function') syncXP();
    } catch (e) { console.warn('[FocusAI] sessiz hata:', e); }
}
window.recordSharedFocusMinute = recordSharedFocusMinute;

export function handleSharedFocusFocusPhaseComplete() {
    const sessionMinutes = getSharedFocusSession() ? (getSharedFocusSession().focusMinutes || 25) : 25;

    syncXP();
    if (typeof renderStatisticsRef === 'function') setTimeout(() => renderStatisticsRef(), 300);
    if (typeof renderCharts === 'function') renderCharts();
    if (typeof updateStatsPage === 'function') updateStatsPage();
    if (typeof updateTodayStats === 'function') updateTodayStats();

    // Akış gürültüsü kararı (2026-07-05): her tamamlanan seans günde onlarca kez
    // tetiklenip lig terfisi/arkadaş olma gibi asıl önemli olayları gömüyordu —
    // kaldırıldı. Kişisel rekor kırılınca zaten ayrı bir olay düşüyor (aşağıda).

    // ── ORTAK ALIŞKANLIK ODASI: seans bitince ikisinin de bugünkü hedefini işaretle ──
    if (getCurrentRoomId() && getCwRoomLinkedHabit() && getCwRoomLinkedHabit().id) {
        completeBuddyHabitSession(getCwRoomLinkedHabit());
    }

    // ── ORTAK SEANS İSTATİSTİKLERİ ──
    let jointTotal = 0, jointSessions = 0;
    if (getCurrentRoomId()) {
        jointTotal = parseInt(localStorage.getItem('focusai_joint_focus_minutes') || '0') + sessionMinutes;
        jointSessions = parseInt(localStorage.getItem('focusai_joint_focus_sessions') || '0') + 1;
        localStorage.setItem('focusai_joint_focus_minutes', String(jointTotal));
        localStorage.setItem('focusai_joint_focus_sessions', String(jointSessions));
    }

    const msg = getCurrentRoomId()
        ? (getCwRoomLinkedHabit()
            ? `Birlikte ${sessionMinutes} dakika odaklandınız ve "${getCwRoomLinkedHabit().name}" alışkanlığını bugün için tamamladınız! 🎉\n\nToplamda partnerlerinle ${jointSessions} ortak seansta ${jointTotal} dakika birlikte odaklandınız. Şimdi bir mola başlıyor — sohbet panelini kullanabilirsiniz ☕`
            : `Birlikte ${sessionMinutes} dakika odaklandınız! Bu süre istatistiklerine eklendi.\n\nToplamda partnerlerinle ${jointSessions} ortak seansta ${jointTotal} dakika birlikte odaklandınız. Şimdi bir mola başlıyor — sohbet panelini kullanabilirsiniz ☕`)
        : `${sessionMinutes} dakikalık odak seansını tamamladın! İstatistiklerin güncellendi.`;

    if (typeof showPremiumModal === 'function') {
        showPremiumModal({ title: '🎉 Seans Bitti!', message: msg, type: 'success' });
    }
}
window.handleSharedFocusFocusPhaseComplete = handleSharedFocusFocusPhaseComplete;
