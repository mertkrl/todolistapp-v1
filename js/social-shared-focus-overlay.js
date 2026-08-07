import { _escapeHtml } from './social-misc-pure-utils.js';
import { dcSetHushMode } from './social-focus-hush.js';
import {
    gfResetIdleTimer, gfEnsureIdleBindings, gfEnsureFocusModeBinding,
    gfExitFocusMode, gfSetRunning, gfSetGhostModeEnabled
} from './social-group-focus-idle.js';
import { gfStopQuoteRotation } from './social-focus-quote-rotation.js';
import { gfRenderMetroTimeline } from './social-group-focus-render.js';
import { gfHidePhaseTransition } from './social-shared-focus-phase-ui.js';
import {
    deriveSharedFocusPhase, buildSharedFocusSkipUpdate, gfComputeCurrentRound,
    SHARED_FOCUS_DEFAULT_BREAK_MINUTES
} from './social-shared-focus-math.js';
import {
    applySharedFocusModePill, applySharedFocusBreakPill,
    ensureSharedFocusReturnButtonBinding
} from './social-shared-focus-ui.js';
import { exitCWRoomLocal } from './social-shared-focus-room-lifecycle.js';
import { gfPopulateTaskDropdown, gfApplyActiveTaskDisplay } from './social-group-focus-task-selector.js';
import { gfOpenLeaveChoiceModal } from './social-group-focus-leave.js';
import {
    recalcSharedFocusChatVisibility, toggleSharedFocusBreakChat,
    requestSharedFocusStart, requestSharedFocusPauseToggle, syncSharedFocusTimerUI
} from './social-shared-focus-sync.js';
import { getCurrentUser } from '../state/current-user-store.js';
import { getScwTimeLeft, setScwTimeLeft, getScwTimerInterval, setScwTimerInterval, getIsScwRunning, setIsScwRunning } from '../state/scw-timer-store.js';
import { getSharedFocusMinimized, setSharedFocusMinimized } from '../state/shared-focus-minimized-store.js';
import { getCwPartnerUsername, getCwPartnerName, getCwPartnerColor } from '../state/cw-room-partner-store.js';
import { getCwInviteMsgId, setCwInviteRef } from '../state/cw-invite-ref-store.js';
import { getCwRoomOriginGroupScope, setCwRoomOriginGroupScope } from '../state/cw-room-origin-store.js';
import { getCwRoomLinkedHabit } from '../state/cw-room-linked-habit-store.js';
import { getCwRoomIsHost } from '../state/cw-room-host-store.js';
import { getSharedFocusBindingsReady, setSharedFocusBindingsReady } from '../state/shared-focus-bindings-ready-store.js';
import {
    getCurrentRoomId, setCurrentRoomId, getCwRoomIsSupabase, getCwRoomSupaChannel,
    setCwRoomSupaChannel
} from '../state/cw-current-room-store.js';
import { getSharedFocusSoloMode, setSharedFocusSoloMode } from '../state/shared-focus-solo-mode-store.js';
import { getSharedFocusBreakMinutes, setSharedFocusBreakMinutes } from '../state/shared-focus-break-minutes-store.js';
import { getSharedFocusPhaseInitialized, setSharedFocusPhaseInitialized } from '../state/shared-focus-phase-initialized-store.js';
import { getSharedFocusSession, setSharedFocusSession } from '../state/shared-focus-session-store.js';
import { getSharedFocusTotalRounds, setSharedFocusTotalRounds } from '../state/shared-focus-total-rounds-store.js';
import { getSharedFocusDisplaySyncInterval, setSharedFocusDisplaySyncInterval } from '../state/shared-focus-display-sync-interval-store.js';
import { getSharedFocusInFocusMode, setSharedFocusInFocusMode } from '../state/shared-focus-in-focus-mode-store.js';
import { getGfMode, setGfMode } from '../state/gf-mode-store.js';
import { getGfLeaveBtnAC, setGfLeaveBtnAC } from '../state/gf-leave-btn-ac-store.js';
export { buildSoloFocusRoomLike } from './social-shared-focus-overlay-solo-room.js';
import { buildSoloFocusRoomLike } from './social-shared-focus-overlay-solo-room.js';
export { _cwApplyRoleBasedUI } from './social-shared-focus-overlay-role-ui.js';
import { _cwApplyRoleBasedUI } from './social-shared-focus-overlay-role-ui.js';

// ──────────────────────────────────────────────────────
// ORTAK OVERLAY — AÇMA / KAPAMA (her iki akış için TEK nokta)
// ──────────────────────────────────────────────────────
export function gfOpenOverlayShell() {
    const overlay = document.getElementById('group-focus-overlay');
    if (!overlay) return;
    overlay.style.display = 'flex';
    requestAnimationFrame(() => overlay.classList.add('visible'));
    gfHidePhaseTransition();
    gfExitFocusMode();
    gfEnsureIdleBindings();
    gfEnsureFocusModeBinding();
    gfEnsureTaskSelectorBindingsShim();
    gfEnsureBreakChatBindingsShim();
    gfEnsureDurationSettingsBindings();
    // Hidden input'ları aktif oturum değerleriyle senkronize et
    const sessionFocus = getSharedFocusSession()?.focusMinutes || Math.round((getScwTimeLeft() || 0) / 60) || 25;
    const sessionBreak = getSharedFocusSession()?.breakMinutes || getSharedFocusBreakMinutes() || 10;
    const sessionRounds = getSharedFocusTotalRounds(); // DOM'a bağımlı kalmak yerine güvenilir kaynaktan al
    const durInput = document.getElementById('gf-duration-input');
    const brkInput = document.getElementById('gf-break-input');
    const rndInput = document.getElementById('gf-rounds-input');
    const totalEl2 = document.getElementById('gf-round-total');
    if (durInput)  durInput.value  = sessionFocus;
    if (brkInput)  brkInput.value  = sessionBreak;
    if (rndInput)  rndInput.value  = sessionRounds;
    if (totalEl2)  totalEl2.textContent = sessionRounds;
    const stepperEl2 = document.getElementById('gf-rounds-stepper');
    if (stepperEl2) stepperEl2.value = sessionRounds;
    // Timeline'ı render et — seans zaten çalışıyorsa mevcut konumu hesapla
    const _initRound = gfComputeCurrentRound(getSharedFocusSession(), sessionRounds);
    const _initPhase = getSharedFocusSession()
        ? deriveSharedFocusPhase(getSharedFocusSession(), Date.now())
        : null;
    const _initIsBreak = _initPhase && _initPhase.type === 'break';
    const _initIdx = getSharedFocusSession()
        ? (_initIsBreak ? (_initRound - 1) * 2 + 1 : (_initRound - 1) * 2)
        : 0;
    gfRenderMetroTimeline(sessionRounds, _initIdx, sessionFocus, sessionBreak);

    const leaveBtn = document.getElementById('gf-leave-btn');
    if (leaveBtn) {
        if (getGfLeaveBtnAC()) getGfLeaveBtnAC().abort();
        setGfLeaveBtnAC(new AbortController());
        leaveBtn.addEventListener('click', () => {
            if (getSharedFocusSoloMode()) {
                minimizeSharedFocusOverlay();
            } else {
                gfOpenLeaveChoiceModal();
            }
        }, { signal: getGfLeaveBtnAC().signal });
    }
}
window.gfOpenOverlayShell = gfOpenOverlayShell;

function gfEnsureTaskSelectorBindingsShim() {
    if (typeof window.gfEnsureTaskSelectorBindings === 'function') window.gfEnsureTaskSelectorBindings();
}
function gfEnsureBreakChatBindingsShim() {
    if (typeof window.gfEnsureBreakChatBindings === 'function') window.gfEnsureBreakChatBindings();
}

// Overlay'i tamamen kapatır — tüm gf-* dinleyici/aralıkları temizler ama
// mod-bağımlı (oda/meydan okuma) Firebase referanslarına dokunmaz
export function closeGroupFocusOverlay() {
    dcSetHushMode(false);
    const overlay = document.getElementById('group-focus-overlay');
    if (overlay) {
        overlay.classList.remove('visible', 'group-focus-mode-active', 'group-ghost-mode-active');
        overlay.style.display = 'none';
    }
    gfStopQuoteRotation();
    gfHidePhaseTransition();
    toggleSharedFocusBreakChat(false);
    gfExitFocusMode();
    gfSetRunning(false);
    if (typeof window.gfSetBreakChatPath === 'function') window.gfSetBreakChatPath(null);
    document.getElementById('gf-leave-choice-modal')?.classList.add('hidden');
}
window.closeGroupFocusOverlay = closeGroupFocusOverlay;

// buildSoloFocusRoomLike → social-shared-focus-overlay-solo-room.js
window.buildSoloFocusRoomLike = buildSoloFocusRoomLike;

export function openSharedFocusOverlay(linkedHabit, partnerName, solo) {
    const overlay = document.getElementById('group-focus-overlay');
    const titleEl = document.getElementById('gf-title');
    const creatorEl = document.getElementById('gf-creator');
    if (!overlay) return;

    setGfMode('room');
    setSharedFocusSoloMode(!!solo);
    setSharedFocusPhaseInitialized(false);
    if (solo) _cwApplyRoleBasedUI(true, false, true); // solo modda tüm kontroller kullanıcıya ait

    if (titleEl) {
        titleEl.textContent = solo
            ? (linkedHabit ? `🎯 "${linkedHabit.name}" için Bireysel Odaklanma` : '🎯 Bireysel Odaklanma')
            : (linkedHabit ? `🤝 "${linkedHabit.name}" için Birlikte Odaklanma` : '🤝 Birlikte Odaklanma Odası');
    }
    if (creatorEl) {
        creatorEl.textContent = solo ? '' : (partnerName ? `Partner: ${partnerName}` : '');
    }

    gfOpenOverlayShell();
    // Oda modunda sohbet kutusu doğrudan cw_rooms/.../chat'e yazar (attachSharedFocusChatListener ile dinlenir);
    // bireysel modda partner olmadığından sohbet yolu yok.
    if (typeof window.gfSetBreakChatPath === 'function') {
        window.gfSetBreakChatPath((!solo && getCurrentRoomId() && getCwRoomIsSupabase())
            ? { ref: 'focus_session_supabase', scopeId: getCurrentRoomId() }
            : null);
    }
    gfEnsureRoomControlBindings();
    ensureSharedFocusReturnButtonBinding();
    gfPopulateTaskDropdown();
    gfApplyActiveTaskDisplay();
    applySharedFocusModePill(getSharedFocusSession() ? getSharedFocusSession().focusMinutes : (Math.round(getScwTimeLeft() / 60) || 25));
    applySharedFocusBreakPill(getSharedFocusBreakMinutes() || SHARED_FOCUS_DEFAULT_BREAK_MINUTES);
    syncSharedFocusTimerUI();
    if (getSharedFocusDisplaySyncInterval()) clearInterval(getSharedFocusDisplaySyncInterval());
    setSharedFocusDisplaySyncInterval(setInterval(syncSharedFocusTimerUI, 500));
}
window.openSharedFocusOverlay = openSharedFocusOverlay; // social-dc-message-cards.js için

// "Sadece Arayüzden Ayrıl" — overlay'i gizler ama oturumu/zamanlayıcıyı CANLI bırakır.
// getScwTimerInterval() kasıtlı olarak durdurulmaz; kullanıcı Mini Odak Odası'ndaki
// "Ortak Odaklanma Arayüzüne Dön" butonuyla istediği zaman aynı arayüze geri dönebilir.
export function minimizeSharedFocusOverlay() {
    const overlay = document.getElementById('group-focus-overlay');
    if (overlay) { overlay.classList.remove('visible'); overlay.style.display = 'none'; }
    if (getSharedFocusDisplaySyncInterval()) { clearInterval(getSharedFocusDisplaySyncInterval()); setSharedFocusDisplaySyncInterval(null); }
    gfStopQuoteRotation();
    gfExitFocusMode();
    setSharedFocusInFocusMode(false);

    setSharedFocusMinimized(true);
    const returnBtn = document.getElementById('scw-return-shared-focus-btn');
    if (returnBtn) returnBtn.classList.remove('hidden');
    window._syncFocusReturnMiniBtn();

    if (typeof showPremiumModal === 'function') {
        const returnLabel = getSharedFocusSoloMode() ? 'Odaklanma Arayüzüne Dön' : 'Ortak Odaklanma Arayüzüne Dön';
        showPremiumModal({ title: '🔻 Arayüzden Ayrıldın', message: `Zamanlayıcı arka planda akmaya devam ediyor. İstediğin zaman Mini Odak Odası'ndaki "${returnLabel}" butonuyla geri dönebilirsin.`, type: 'info' });
    }
}
window.minimizeSharedFocusOverlay = minimizeSharedFocusOverlay;

// Mini Odak Odası'ndan tekrar tam ekran ortak odaklanma arayüzüne dönüş
export function restoreSharedFocusOverlay() {
    if (!getCurrentRoomId() && !getSharedFocusSoloMode()) return;
    setSharedFocusMinimized(false);
    setGfMode('room');
    gfOpenOverlayShell();
    gfEnsureRoomControlBindings();
    ensureSharedFocusReturnButtonBinding();
    gfPopulateTaskDropdown();
    gfApplyActiveTaskDisplay();
    syncSharedFocusTimerUI();
    if (getSharedFocusDisplaySyncInterval()) clearInterval(getSharedFocusDisplaySyncInterval());
    setSharedFocusDisplaySyncInterval(setInterval(syncSharedFocusTimerUI, 500));

    const returnBtn = document.getElementById('scw-return-shared-focus-btn');
    if (returnBtn) returnBtn.classList.add('hidden');
    window._syncFocusReturnMiniBtn();
}
window.restoreSharedFocusOverlay = restoreSharedFocusOverlay; // social-dc-panel-view.js için

// "Sonraki Aşamaya Geç" — hangi taraf basarsa bassın (host ya da partner), kalan süre
// kadar startedAt'ı geriye kaydırarak fazı anında bir sonrakine düşürür. Grup
// odaklanmasındaki "skip" ile birebir aynı teknik — ayrı bir faz alanı yazılmaz,
// her iki taraf da güncellenen startedAt'tan kendi ekranını yeniden türetir.
export function applySharedFocusSkip(room) {
    if (!getCurrentRoomId() || !room.startedAt) return;
    const session = getSharedFocusSession() || {
        startedAt: room.startedAt, paused: !!room.paused, pausedAt: room.pausedAt || null,
        focusMinutes: room.focusMinutes || 25,
        breakMinutes: room.breakMinutes || getSharedFocusBreakMinutes() || SHARED_FOCUS_DEFAULT_BREAK_MINUTES
    };
    const update = buildSharedFocusSkipUpdate(session, Date.now());
    if (!update) return;
    if (getCwRoomIsSupabase() && window.FocusSupabase) {
        window.FocusSupabase.from('cw_rooms').update({
            started_at: new Date(update.startedAt).toISOString(),
            paused: false, paused_at: null
        }).eq('id', getCurrentRoomId()).then(() => {});
    }
}
window.applySharedFocusSkip = applySharedFocusSkip; // social-cw-control-request.js için

export function gfEnsureRoomControlBindings() {
    if (getSharedFocusBindingsReady()) return;
    setSharedFocusBindingsReady(true);

    document.getElementById('gf-start-btn')?.addEventListener('click', () => {
        if (getGfMode() !== 'room') return; // challenge modunda kendi handler'ı çalışır
        if (!getSharedFocusSoloMode() && !window._cwHasDirectControl()) {
            window._cwSendControlRequest('start');
            return;
        }
        // Bir grup sohbetinden gönderilmiş, henüz başlamamış bir davet varsa:
        // oturumu başlatınca artık kimse katılamayacağı için önce onay iste.
        if (getCwInviteMsgId() && !getSharedFocusSession()) {
            if (typeof window.dcShowConfirm === 'function') {
                dcShowConfirm({
                    title: 'Oturumu Başlat',
                    message: 'Oturumu başlattıktan sonra başka kullanıcı katılamaz. Devam etmek istiyor musun?',
                    confirmText: 'Oturumu Başlat',
                    cancelText: 'Vazgeç',
                    danger: false,
                    icon: 'fa-play',
                    onConfirm: () => {
                        window._cwDeleteInviteMessage();
                        requestSharedFocusStart();
                    }
                });
                return;
            }
            window._cwDeleteInviteMessage();
        }
        requestSharedFocusStart();
    });
    document.getElementById('gf-pause-btn')?.addEventListener('click', () => {
        if (getGfMode() !== 'room') return;
        if (!getSharedFocusSoloMode() && !window._cwHasDirectControl()) {
            window._cwSendControlRequest(getSharedFocusSession()?.paused ? 'resume' : 'pause');
            return;
        }
        requestSharedFocusPauseToggle();
    });
    document.getElementById('gf-skip-btn')?.addEventListener('click', () => {
        if (getSharedFocusSoloMode()) {
            if (!getSharedFocusSession()) return;
            const update = buildSharedFocusSkipUpdate(getSharedFocusSession(), Date.now());
            if (update) setSharedFocusSession(Object.assign({}, getSharedFocusSession(), update));
            return;
        }
        if (!getCurrentRoomId()) return;
        if (!window._cwHasDirectControl()) { window._cwSendControlRequest('skip'); return; }
        if (getCwRoomIsSupabase() && window.FocusSupabase) {
            window.FocusSupabase.from('cw_rooms').select('*').eq('id', getCurrentRoomId()).single()
                .then(({ data: row }) => { if (row) applySharedFocusSkip(window._cwNormalizeSupaRoom(row)); });
        }
    });

    // ── Oturumu Bitir: onay modalını göster ──
    document.getElementById('gf-end-session-btn')?.addEventListener('click', () => {
        if (getGfMode() !== 'room') return;
        try { gfOpenEndSessionModal(); } catch (e) { console.error('[CW-DEBUG] gfOpenEndSessionModal hatası:', e); }
    });

    // ── Oturumu Bitir Modal: İptal ──
    document.getElementById('gf-end-cancel-btn')?.addEventListener('click', () => {
        document.getElementById('gf-end-session-modal')?.classList.add('hidden');
    });
    document.getElementById('gf-end-session-modal')?.addEventListener('click', (e) => {
        if (e.target === document.getElementById('gf-end-session-modal'))
            document.getElementById('gf-end-session-modal').classList.add('hidden');
    });

    // ── Oturumu Bitir Modal: Onayla — gfMode'a göre yönlendir ──
    document.getElementById('gf-end-confirm-btn')?.addEventListener('click', () => {
        document.getElementById('gf-end-session-modal')?.classList.add('hidden');
        try { gfDoEndSession(); } catch (e) { console.error('[CW-DEBUG] gfDoEndSession hatası:', e); }
    });

    // ── Ayarlar: Yeniden Başlat butonu ──
    document.getElementById('gf-settings-restart-btn')?.addEventListener('click', () => {
        document.getElementById('gf-settings-modal')?.classList.add('hidden');
        document.getElementById('gf-restart-confirm-modal')?.classList.remove('hidden');
    });

    // ── Yeniden Başlat Modal: İptal ──
    document.getElementById('gf-restart-cancel-btn')?.addEventListener('click', () => {
        document.getElementById('gf-restart-confirm-modal')?.classList.add('hidden');
    });

    // ── Yeniden Başlat Modal: Onayla → daveti gönder ekranına geri dön ──
    document.getElementById('gf-restart-go-btn')?.addEventListener('click', () => {
        document.getElementById('gf-restart-confirm-modal')?.classList.add('hidden');
        gfDoEndSession(/* reopen= */ true);
    });
}
window.gfEnsureRoomControlBindings = gfEnsureRoomControlBindings;

function gfOpenEndSessionModal() {
    const mins = (typeof cwFocusedMinutes === 'function') ? cwFocusedMinutes() : 0;
    const rounds = parseInt(document.getElementById('gf-round-count')?.textContent) || 0;
    const timeEl = document.getElementById('gf-end-stat-time');
    const roundsEl = document.getElementById('gf-end-stat-rounds');
    if (timeEl) timeEl.textContent = mins > 0 ? `${mins} dk` : '< 1 dk';
    if (roundsEl) roundsEl.textContent = rounds;
    const m = document.getElementById('gf-end-session-modal');
    m?.classList.remove('hidden');
    setTimeout(() => {
        if (!m) return;
        const el = document.elementFromPoint(window.innerWidth/2, window.innerHeight/2);
    }, 100);
}

function _gfFinalizeEndSession() {
    if (getCurrentRoomId() && getCwRoomIsSupabase() && window.FocusSupabase) {
        window.FocusSupabase.from('cw_rooms').update({
            active: false,
            ended_by_id: getCurrentUser()?.id || null,
            ended_by_name: getCurrentUser()?.displayName || null,
            ended_at: new Date().toISOString()
        }).eq('id', getCurrentRoomId()).then(() => {});
    }
    // Oturum hiç başlamadan bitirildiyse, gruba gönderilmiş davet kartı da
    // artık geçersiz — sohbetten kaldır.
    if (getCwInviteMsgId() && !getSharedFocusSession()) window._cwDeleteInviteMessage();
    closeGroupFocusOverlay();
    exitCWRoomLocal();
}

export function gfDoEndSession(reopenSetup) {
    const mins = (typeof cwFocusedMinutes === 'function') ? cwFocusedMinutes() : 0;
    if (mins > 0 && typeof FocusStorage !== 'undefined') {
        FocusStorage.set('total_focus_minutes', (FocusStorage.get('total_focus_minutes', 0) || 0) + mins);
        FocusStorage.set('focus_minutes', (FocusStorage.get('focus_minutes', 0) || 0) + mins);
        const _td = new Date();
        const _key = String(_td.getDate()).padStart(2,'0')+'-'+String(_td.getMonth()+1).padStart(2,'0')+'-'+_td.getFullYear();
        const _fh = FocusStorage.get('focus_history', {});
        _fh[_key] = (_fh[_key] || 0) + mins;
        FocusStorage.set('focus_history', _fh);
        if (typeof renderStatisticsRef === 'function') setTimeout(() => renderStatisticsRef(), 300);
    }

    if (reopenSetup) {
        gfDoRestartSession();
        return;
    }

    // Ortak alışkanlık bağlıysa tamamlama sorusu sor
    if (getCwRoomLinkedHabit() && getCwRoomLinkedHabit().id) {
        const habit = getCwRoomLinkedHabit();
        const partnerName = getCwPartnerName() || getCwPartnerUsername() || 'Partner';

        // Mevcut overlay varsa kaldır
        document.getElementById('gf-habit-complete-overlay')?.remove();
        const overlay = document.createElement('div');
        overlay.id = 'gf-habit-complete-overlay';
        overlay.className = 'modal-overlay';
        overlay.style.zIndex = '100060';
        overlay.innerHTML = `
            <div class="modal-content glass-panel u-max-width-370px_text-align-center_padding-28px24px" >
                <div class="u-font-size-32px_margin-bottom-12px">🤝</div>
                <h3 class="u-margin-008px_font-size-17px_color-hfff">"${_escapeHtml(habit.name)}"</h3>
                <p class="u-color-var-text-muted_font-size-13px_margin-0022px">Bugünkü ortak alışkanlık hedefini tamamladın mı?</p>
                <div class="u-display-flex_flex-direction-column_gap-10px-2">
                    <button id="gf-habit-yes-btn" class="control-btn primary u-width-100pct_padding-12px" >
                        <i class="fa-solid fa-check-double"></i> Evet, Tamamladım!
                    </button>
                    <button id="gf-habit-no-btn" class="control-btn u-width-100pct_padding-12px_background-rgba2552552550p05" >
                        <i class="fa-solid fa-xmark"></i> Hayır, Tamamlamadım
                    </button>
                </div>
            </div>`;
        document.body.appendChild(overlay);

        const finish = (completed) => {
            overlay.remove();
            if (completed) {
                completeBuddyHabitSession(habit);
            }
            // Partnere bildirim gönder
            if (window.FocusSupabase && getCurrentUser()?.id && getCwPartnerUsername()) {
                window._resolveProfileByUsername?.(getCwPartnerUsername()).then(prof => {
                    if (!prof?.id) return;
                    window.FocusSupabase.from('notifications').insert({
                        user_id: prof.id,
                        type: 'buddy_session_ended',
                        payload: {
                            fromUsername: getCurrentUser().username,
                            fromName: getCurrentUser().displayName,
                            habitName: habit.name,
                            completed
                        }
                    }).then(() => {});
                });
            }
            _gfFinalizeEndSession();
        };

        document.getElementById('gf-habit-yes-btn').addEventListener('click', () => finish(true));
        document.getElementById('gf-habit-no-btn').addEventListener('click', () => finish(false));
        return; // modal kapanınca devam edecek
    }

    _gfFinalizeEndSession();
}
window.gfDoEndSession = gfDoEndSession;

// ── Oturumu Yeniden Başlat ──
export function gfDoRestartSession() {
    // Partner bilgisini ve oda id'sini kapanmadan önce yakala
    const restartRoomId    = getCurrentRoomId();
    const partnerUsername  = getCwPartnerUsername();
    const partnerName      = getCwPartnerName();
    const partnerColor     = getCwPartnerColor();
    const linkedHabit      = getCwRoomLinkedHabit();
    const groupInviteScope = getCwRoomOriginGroupScope();
    setCwRoomOriginGroupScope(null);

    // Room listener'ı kapat — restarting yazınca kendi listener'ımız tetiklenmesin
    if (getCwRoomSupaChannel()) { window.FocusSupabase?.removeChannel(getCwRoomSupaChannel()); setCwRoomSupaChannel(null); }
    // (Firebase-era currentRoomRef kaldırıldı — Supabase kanalı zaten yukarıda kapatılıyor)

    // Eğer aktif oda varsa misafire bildir
    if (restartRoomId && getCwRoomIsSupabase() && window.FocusSupabase) {
        window.FocusSupabase.from('cw_rooms').update({
            restarting: true,
            restarted_by_id: getCurrentUser()?.id,
            restarted_by_name: getCurrentUser()?.displayName,
            restarted_at: new Date().toISOString()
        }).eq('id', restartRoomId).then(() => {
            // 4 sn sonra eski odayı temizle
            setTimeout(() => window.FocusSupabase.from('cw_rooms').delete().eq('id', restartRoomId).then(() => {}), 4000);
        });
    }

    // Overlay ve state'i kapat — biri hata verirse bile aşağıdaki modal
    // açma adımı ATLANMASIN diye try/catch ile izole ediyoruz.
    try { closeGroupFocusOverlay(); } catch (e) { console.error('[CW-DEBUG] gfDoRestartSession: closeGroupFocusOverlay hatası', e); }
    try { exitCWRoomLocal(); } catch (e) { console.error('[CW-DEBUG] gfDoRestartSession: exitCWRoomLocal hatası', e); }

    // Nereden davet gönderildiyse aynı ayar modalına dön: grup daveti ise
    // grup ayar modalı, DM/buddy daveti ise onun modalı. Overlay'in
    // display:none'ı henüz DOM'a yansımamış olabileceğinden bir sonraki
    // frame'e bırakıyoruz — aksi halde modal bazı tarayıcılarda kapanan
    // overlay'in arkasında/altında render olabiliyordu.
    requestAnimationFrame(() => {
        try {
            if (groupInviteScope) {
                if (typeof window.openGroupFocusSettingsModal === 'function') window.openGroupFocusSettingsModal(groupInviteScope);
            } else if (partnerUsername) {
                window.openBuddyFocusSettingsModal(partnerUsername, partnerName, partnerColor, linkedHabit);
            } else {
                const m = document.getElementById('buddy-focus-premium-modal');
                if (m) m.classList.remove('hidden');
            }
        } catch (e) { console.error('[CW-DEBUG] gfDoRestartSession: ayar modalı açılamadı', e); }
    });
}
window.gfDoRestartSession = gfDoRestartSession;

// ── Odaklanma süresi seçimi: oda modunda Firebase'e yazılır (her iki taraf senkron görür),
// bireysel modda doğrudan yerel zamanlayıcıyı/oturumu günceller ──
export function applySharedFocusWorkDuration(minutes) {
    if (!minutes) return;
    applySharedFocusModePill(minutes);
    if (getCurrentRoomId() && getCwRoomIsSupabase() && window.FocusSupabase) {
        window.FocusSupabase.from('cw_rooms').update({ focus_minutes: minutes }).eq('id', getCurrentRoomId()).then(() => {});
    } else {
        if (getSharedFocusSession()) {
            getSharedFocusSession().focusMinutes = minutes;
        } else {
            setScwTimeLeft(minutes * 60);
            syncSharedFocusTimerUI();
        }
    }
}
window.applySharedFocusWorkDuration = applySharedFocusWorkDuration;

// ── Mola süresi seçimi: oda modunda yazılır, bireysel modda yerel değişkene ──
export function applySharedFocusBreakDuration(minutes) {
    if (!minutes) return;
    setSharedFocusBreakMinutes(minutes);
    applySharedFocusBreakPill(minutes);
    if (getCurrentRoomId() && getCwRoomIsSupabase() && window.FocusSupabase) {
        window.FocusSupabase.from('cw_rooms').update({ break_minutes: minutes }).eq('id', getCurrentRoomId()).then(() => {});
    } else if (getSharedFocusSession()) {
        getSharedFocusSession().breakMinutes = minutes;
    }
}
window.applySharedFocusBreakDuration = applySharedFocusBreakDuration;

let gfDurationSettingsBound = false;
function gfEnsureDurationSettingsBindings() {
    if (gfDurationSettingsBound) return;
    gfDurationSettingsBound = true;

    const settingsModal = document.getElementById('gf-settings-modal');

    // Ayarlar modalı açılınca oturum özetini doldur
    document.getElementById('gf-settings-btn')?.addEventListener('click', () => {
        try {
            const stepperEl = document.getElementById('gf-rounds-stepper');
            if (stepperEl) stepperEl.value = getSharedFocusTotalRounds();
            const roundsChipEl = document.getElementById('gf-ssi-rounds');
            if (roundsChipEl) roundsChipEl.textContent = `${getSharedFocusTotalRounds()} tur`;
            const focusChipEl = document.getElementById('gf-ssi-focus');
            const breakChipEl = document.getElementById('gf-ssi-break');
            if (focusChipEl) focusChipEl.textContent = `${parseInt(document.getElementById('gf-duration-input')?.value) || 25} dk odak`;
            if (breakChipEl) breakChipEl.textContent = `${parseInt(document.getElementById('gf-break-input')?.value) || 10} dk mola`;
            settingsModal?.classList.remove('hidden');
            gfResetIdleTimer();
            setTimeout(() => {
                const el = document.elementFromPoint(window.innerWidth/2, window.innerHeight/2);
            }, 100);
        } catch (e) { console.error('[CW-DEBUG] gf-settings-btn handler hatası:', e); }
    });

    // Sadece owner'a görünen "diğerleri de ayarlasın" izni
    document.getElementById('gf-setting-open-settings')?.addEventListener('change', (e) => {
        if (!getCwRoomIsHost() || !getCurrentRoomId() || !window.FocusSupabase) return;
        window.FocusSupabase.from('cw_rooms').update({ settings_open_to_all: !!e.target.checked }).eq('id', getCurrentRoomId()).then(() => {});
    });

    // Sadece owner'a görünen "istek gönderme izni" — kapalıysa guest
    // Start/Pause/Skip'i hiç görmez (bkz. _cwApplyRoleBasedUI)
    document.getElementById('gf-setting-allow-requests')?.addEventListener('change', (e) => {
        if (!getCwRoomIsHost() || !getCurrentRoomId() || !window.FocusSupabase) return;
        window.FocusSupabase.from('cw_rooms').update({ allow_requests: !!e.target.checked }).eq('id', getCurrentRoomId()).then(() => {});
    });

    // Tur sayısı stepper
    const _applyRoundsChange = () => {
        const inp = document.getElementById('gf-rounds-stepper');
        if (!inp) return;
        const val = Math.min(10, Math.max(1, parseInt(inp.value) || 1));
        inp.value = val;
        setSharedFocusTotalRounds(val);
        const totalEl = document.getElementById('gf-round-total');
        const rndInput = document.getElementById('gf-rounds-input');
        if (totalEl) totalEl.textContent = val;
        if (rndInput) rndInput.value = val;
        const focusMin = parseInt(document.getElementById('gf-duration-input')?.value) || 25;
        const breakMin = parseInt(document.getElementById('gf-break-input')?.value) || 10;
        const currentRound = gfComputeCurrentRound(getSharedFocusSession(), val);
        const ph = getSharedFocusSession() ? deriveSharedFocusPhase(getSharedFocusSession(), Date.now()) : null;
        const isBreak = ph && ph.type === 'break';
        const activeIdx = getSharedFocusSession()
            ? (isBreak ? (currentRound - 1) * 2 + 1 : (currentRound - 1) * 2)
            : 0;
        gfRenderMetroTimeline(val, activeIdx, focusMin, breakMin);
    };
    document.getElementById('gf-rounds-step-dec')?.addEventListener('click', () => {
        const inp = document.getElementById('gf-rounds-stepper');
        if (inp) { inp.value = Math.max(1, (parseInt(inp.value) || 1) - 1); _applyRoundsChange(); }
    });
    document.getElementById('gf-rounds-step-inc')?.addEventListener('click', () => {
        const inp = document.getElementById('gf-rounds-stepper');
        if (inp) { inp.value = Math.min(10, (parseInt(inp.value) || 1) + 1); _applyRoundsChange(); }
    });
    document.getElementById('gf-rounds-stepper')?.addEventListener('change', _applyRoundsChange);

    // Tamam, Uygula — sadece toggle tercihlerini okur (süre/tur artık burada yok)
    document.getElementById('gf-settings-close-btn')?.addEventListener('click', () => {
        settingsModal?.classList.add('hidden');
    });

    settingsModal?.addEventListener('click', (e) => {
        if (e.target === settingsModal) settingsModal.classList.add('hidden');
    });

    const ghostToggle = document.getElementById('gf-setting-ghostmode');
    ghostToggle?.addEventListener('change', () => {
        gfSetGhostModeEnabled(ghostToggle.checked);
    });
}

// _cwApplyRoleBasedUI → social-shared-focus-overlay-role-ui.js
window._cwApplyRoleBasedUI = _cwApplyRoleBasedUI;
