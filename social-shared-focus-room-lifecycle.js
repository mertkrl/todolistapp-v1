// ─── ORTAK ODAKLANMA ODASI — GİRİŞ / VERİ UYGULAMA / REALTIME KURULUM / ÇIKIŞ ─
// social.js dosyasından çıkarıldı (Faz H devamı, 2026-07-30). Aynı sebep ve
// desen için social-shared-focus-ui.js dosyasındaki başlık yorumuna bakın.
//
// social.js'te KALAN (taşınmayan) fonksiyonlara window köprüsüyle erişiliyor:
// openSharedFocusOverlay/closeGroupFocusOverlay/_cwApplyRoleBasedUI
// (odaklanma zamanlayıcı motorunun bir parçası, sharedFocusSession gibi
// başka paylaşımlı state'e bağımlı — bu görevin kapsamı dışında).
import { getCurrentUser } from './state/current-user-store.js';
import { getScwTimeLeft, setScwTimeLeft, getScwTimerInterval, setScwTimerInterval, getIsScwRunning, setIsScwRunning } from './state/scw-timer-store.js';
import { getSharedFocusSession, setSharedFocusSession } from './state/shared-focus-session-store.js';
import { getSharedFocusBreakMinutes, setSharedFocusBreakMinutes } from './state/shared-focus-break-minutes-store.js';
import { getSharedFocusTotalRounds, setSharedFocusTotalRounds } from './state/shared-focus-total-rounds-store.js';
import { getSharedFocusMyTaskText, setSharedFocusMyTask } from './state/shared-focus-my-task-store.js';
import { getSharedFocusMinimized, setSharedFocusMinimized } from './state/shared-focus-minimized-store.js';
import { getSharedFocusPhaseInitialized, setSharedFocusPhaseInitialized } from './state/shared-focus-phase-initialized-store.js';
import { getCurrentRoomPhase, setCurrentRoomPhase } from './state/cw-room-phase-store.js';
import { getCwPartnerUsername, getCwPartnerName, getCwPartnerColor, setCwPartnerInfo } from './state/cw-room-partner-store.js';
import { getCwRoomOriginGroupScope, setCwRoomOriginGroupScope } from './state/cw-room-origin-store.js';
import { getCwRoomLinkedHabit, setCwRoomLinkedHabit } from './state/cw-room-linked-habit-store.js';
import { getCwRoomIsHost, setCwRoomIsHost } from './state/cw-room-host-store.js';
import {
    getCurrentRoomId, setCurrentRoomId,
    getCwRoomIsSupabase, setCwRoomIsSupabase,
    getCwRoomSupaChannel, setCwRoomSupaChannel
} from './state/cw-current-room-store.js';
import { setCwMyRequestInFlight } from './state/cw-control-request-store.js';
import { SHARED_FOCUS_DEFAULT_BREAK_MINUTES } from './social-shared-focus-math.js';
import { _cwNormalizeSupaRoom } from './social-misc-isolated-utils.js';
import { _cwOthersLabel, _cwIsRoomOwner } from './social-cw-room-helpers.js';
import { _cwStartHeartbeat, _cwStopHeartbeat } from './social-cw-heartbeat.js';
import { gfCloseLeaveChoiceModal } from './social-group-focus-leave.js';
import { gfAppendChatMessage } from './social-group-focus-break-chat.js';
import {
    applySharedFocusModePill, applySharedFocusBreakPill,
    ensureSharedFocusReturnButtonBinding, renderSharedFocusParticipants,
    applySharedFocusPhase, renderSharedFocusTaskStatus
} from './social-shared-focus-ui.js';
import {
    startSharedFocusDerivedTimer, resetScwTimer, closeSharedFocusOverlay,
    gfShowPartnerRestartingModal, _cwShowSoloContinuePrompt
} from './social-shared-focus-timer-ctrl.js';

window.enterCWRoom = enterCWRoom; // social-cw-invites.js için
export function enterCWRoom(roomId, partnerName, partnerColor, linkedHabit, isHost, focusMinutes) {
    if (!getCurrentUser()) return;
    setCurrentRoomId(roomId);
    setCwRoomLinkedHabit(linkedHabit || null);
    setCwRoomIsHost(!!isHost);
    setCwPartnerInfo(partnerName, partnerName, partnerColor);
    setCwRoomOriginGroupScope(null); // her yeni giriş DM/tekli varsayar — grup daveti ise sendGroupFocusInvite bunu hemen sonra set eder
    const minutes = focusMinutes && focusMinutes > 0 ? focusMinutes : 25;

    if (window.FocusSupabase) {
        setCwRoomIsSupabase(true);

        if (isHost) {
            setScwTimeLeft(minutes * 60);
            applySharedFocusModePill(minutes);
            setSharedFocusBreakMinutes(SHARED_FOCUS_DEFAULT_BREAK_MINUTES);
            applySharedFocusBreakPill(getSharedFocusBreakMinutes());
            const roomRow = {
                id: roomId,
                created_by: getCurrentUser().id,
                active: true,
                focus_minutes: minutes,
                break_minutes: getSharedFocusBreakMinutes(),
                rounds: getSharedFocusTotalRounds(),
                max_participants: window.getMyRoomCapacity(),
                linked_habit_id: linkedHabit?.id || null,
                linked_habit_name: linkedHabit?.name || null,
                linked_pair_id: linkedHabit?.pairId || null
            };
            window.FocusSupabase.from('cw_rooms').insert(roomRow)
                .then(({ error }) => {
                    if (error) { console.error('[CW-DEBUG] oda oluşturma hatası:', error.message, error.code, error.details, error.hint); return; }
                    window.FocusSupabase.from('cw_room_members').insert({
                        room_id: roomId, user_id: getCurrentUser().id, username: getCurrentUser().username,
                        display_name: getCurrentUser().displayName, color: getCurrentUser().avatarColor || '6c5ce7', role: 'owner'
                    }).then(({ error: mErr }) => {
                        if (mErr) console.error('[CW-DEBUG] oda üyeliği (owner) oluşturma hatası:', mErr.message, mErr.code, mErr.details, mErr.hint);
                    });
                });
        } else {
            if (!getIsScwRunning()) {
                setScwTimeLeft(minutes * 60);
                applySharedFocusModePill(minutes);
            }
            window.FocusSupabase.rpc('join_cw_room', {
                p_room_id: roomId, p_username: getCurrentUser().username,
                p_display_name: getCurrentUser().displayName, p_color: getCurrentUser().avatarColor || '6c5ce7'
            }).then(({ data, error }) => {
                    if (error || !data?.ok) {
                        console.error('[CW-DEBUG] odaya katılma hatası (join_cw_room RPC):', error?.message, data?.error);
                        const isFull = data?.error === 'cw_room_full';
                        window.dcShowToast?.(isFull ? 'Bu oda dolu — kapasite doldu.' : 'Odaya katılırken bir hata oluştu.');
                        exitCWRoomLocal();
                    } else {
                    }
                });
        }

        _cwSetupSupaRoomUI(roomId, partnerName, linkedHabit, isHost, minutes);
        return;
    }

    // Firebase fallback removed — Supabase only
}

// Ortak oda verisi (Firebase veya Supabase normalize) UI'ye uygulanır
export function _cwApplyRoomData(room, isHostParam, statusText, partnerName) {
    // Ownership devri (bkz. gfLeaveSessionCompletely) sonrası isHost'u
    // her yenilemede kendi cw_room_members satırımdan yeniden hesapla —
    // parametre olarak gelen değer sadece odaya İLK girişteki durumu
    // yansıtır, artık güvenilir kaynak değil.
    const isHost = room.members && room.members.length ? _cwIsRoomOwner(room) : isHostParam;
    if (isHost !== getCwRoomIsHost()) setCwRoomIsHost(isHost);
    window._cwApplyRoleBasedUI(isHost, room.settingsOpenToAll, room.allowRequests);
    if (room.linkedHabitId && !getCwRoomLinkedHabit()) {
        setCwRoomLinkedHabit({ id: room.linkedHabitId, name: room.linkedHabitName, pairId: room.linkedPairId });
    }
    if (room.rounds && room.rounds > 0) {
        setSharedFocusTotalRounds(room.rounds);
        const totalEl = document.getElementById('gf-round-total');
        const rndInput = document.getElementById('gf-rounds-input');
        const stepperEl = document.getElementById('gf-rounds-stepper');
        if (totalEl) totalEl.textContent = room.rounds;
        if (rndInput) rndInput.value = room.rounds;
        if (stepperEl) stepperEl.value = room.rounds;
    }
    const partner = _cwOthersLabel(room);
    if (statusText) {
        if (!partner) {
            statusText.textContent = `${partnerName || 'Partnerin'} katılması bekleniyor...`;
        } else if (getCwRoomLinkedHabit()) {
            statusText.textContent = `${partner} ile "${getCwRoomLinkedHabit().name}" için Birlikte Odaklanıyor`;
        } else {
            statusText.textContent = `${partner} ile Birlikte Odaklanıyor`;
        }
    }
    if (room.startedAt) {
        setSharedFocusSession({
            startedAt: room.startedAt,
            paused: !!room.paused,
            pausedAt: room.pausedAt || null,
            focusMinutes: room.focusMinutes || 25,
            breakMinutes: room.breakMinutes || getSharedFocusBreakMinutes() || SHARED_FOCUS_DEFAULT_BREAK_MINUTES
        });
        if (!getScwTimerInterval()) startSharedFocusDerivedTimer();
    } else {
        setSharedFocusSession(null);
        if (getScwTimerInterval()) { clearInterval(getScwTimerInterval()); setScwTimerInterval(null); }
        setIsScwRunning(false);
        if (room.focusMinutes) {
            const newSeconds = room.focusMinutes * 60;
            if (getScwTimeLeft() !== newSeconds) setScwTimeLeft(newSeconds);
            applySharedFocusModePill(room.focusMinutes);
        }
    }
    renderSharedFocusParticipants(room);
    applySharedFocusPhase(room, isHost);
    renderSharedFocusTaskStatus(room, isHost);
}

// Supabase oda UI kurulumu ve realtime aboneliği
export function _cwSetupSupaRoomUI(roomId, partnerName, linkedHabit, isHost, minutes) {
    const statusCard = document.getElementById('scw-partnership-status');
    const statusText = document.getElementById('scw-status-text');
    const leaveBtn = document.getElementById('scw-leave-btn');
    if (statusCard) { statusCard.className = "scw-status-card pair-mode"; }
    if (leaveBtn) { leaveBtn.classList.remove('hidden'); }
    window.openSharedFocusOverlay(linkedHabit, partnerName);
    ensureSharedFocusReturnButtonBinding();

    // Mola sohbeti: broadcast üzerinden (DB'ye yazmıyoruz)
    const msgsEl = document.getElementById('gf-break-chat-messages');
    if (msgsEl) msgsEl.innerHTML = '<div class="cws-bc-empty">☕ Mola başladığında sohbet açılır</div>';

    // Supabase Realtime + broadcast kanalı
    if (getCwRoomSupaChannel()) {
        window.FocusSupabase.removeChannel(getCwRoomSupaChannel());
        setCwRoomSupaChannel(null);
    }

    _cwStartHeartbeat(roomId);

    const refreshRoom = () => {
        Promise.all([
            window.FocusSupabase.from('cw_rooms').select('*').eq('id', roomId).single(),
            window.FocusSupabase.from('cw_room_members').select('*').eq('room_id', roomId)
        ]).then(([{ data: row, error }, { data: members, error: mErr }]) => {
                if (error || !row || roomId !== getCurrentRoomId()) return;
                if (mErr) console.error('[FocusAI] oda üyeleri okuma hatası', mErr);
                const room = _cwNormalizeSupaRoom(row, members || []);
                if (!room) return;

                if (room.restarting && room.restartedBy !== getCurrentUser()?.id) {
                    gfShowPartnerRestartingModal(room.restartedByName || 'Partnerin');
                    window.closeGroupFocusOverlay();
                    exitCWRoomLocal();
                    return;
                }
                if (!room.active) {
                    if (room.endedByName && room.endedBy !== getCurrentUser()?.id && typeof showPremiumModal === 'function') {
                        showPremiumModal({ title: '🚪 Oturum Sonlandırıldı', message: `${room.endedByName} ortak odaklanma oturumunu sonlandırdı. Oturumdan çıkılıyor.`, type: 'info' });
                    }
                    exitCWRoomLocal();
                    return;
                }
                _cwApplyRoomData(room, isHost, statusText, partnerName);
            });
    };

    refreshRoom();

    setCwRoomSupaChannel(window.FocusSupabase
        .channel(`cw-room-${roomId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'cw_rooms', filter: `id=eq.${roomId}` }, refreshRoom)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'cw_room_members', filter: `room_id=eq.${roomId}` }, refreshRoom)
        .on('broadcast', { event: 'break_chat_msg' }, ({ payload }) => {
            if (!payload?.text || payload.senderId === getCurrentUser()?.id) return;
            gfAppendChatMessage({ from: null, fromName: payload.displayName || 'Kullanıcı', sender: payload.displayName, text: payload.text });
        })
        .on('broadcast', { event: 'participant_left' }, ({ payload }) => {
            if (!payload?.displayName) return;
            window.dcShowToast?.(`${payload.displayName} oturumdan ayrıldı.`);
        })
        .on('broadcast', { event: 'participant_request' }, ({ payload }) => {
            if (!getCwRoomIsHost() || !payload?.reqType) return;
            window._cwShowIncomingControlRequest(payload.reqType, payload.displayName || 'Bir katılımcı');
        })
        .on('broadcast', { event: 'request_result' }, ({ payload }) => {
            if (getCwRoomIsHost()) return;
            // Onaylansa da reddedilse de cooldown SÜRESİNCE (10sn) yeni istek
            // gönderilemez — reddedilince hemen tekrar denenip spam yapılmasını
            // önlemek için burada ERKEN sıfırlama yapılmıyor, yalnızca onay
            // durumunda hemen serbest bırakılır.
            if (payload?.approved) setCwMyRequestInFlight(false);
            const labels = { start: 'Başlatma', pause: 'Duraklatma', resume: 'Başlatma', skip: 'Sonraki aşama' };
            const label = labels[payload?.reqType] || 'İstek';
            window.dcShowToast?.(payload?.approved ? `✅ ${label} isteğin onaylandı!` : `❌ ${label} isteğin reddedildi.`);
        })
        .on('broadcast', { event: 'solo_continue_prompt' }, ({ payload }) => {
            if (!payload) return;
            _cwShowSoloContinuePrompt(payload.leftDisplayName || 'Partnerin');
        })
        .subscribe());

    if (leaveBtn) {
        leaveBtn.onclick = () => {
            if (getCwRoomIsSupabase() && getCurrentRoomId() && getCurrentUser()?.id) {
                const leftRoomId = getCurrentRoomId();
                const wasOwner = getCwRoomIsHost();
                const removeOwnMembership = () => window.FocusSupabase.from('cw_room_members')
                    .delete().eq('room_id', leftRoomId).eq('user_id', getCurrentUser().id).then(() => {});
                if (wasOwner) {
                    window.FocusSupabase.from('cw_rooms').update({
                        active: false, ended_by_id: getCurrentUser().id, ended_by_name: getCurrentUser().displayName
                    }).eq('id', leftRoomId).then(() => removeOwnMembership());
                } else {
                    removeOwnMembership();
                }
            }
            exitCWRoomLocal();
        };
    }
    // Akış içerik kararı (2026-07-05): kaldırıldı.
}

window.exitCWRoomLocal = exitCWRoomLocal;
export function exitCWRoomLocal() {
    clearInterval(getScwTimerInterval());
    setIsScwRunning(false);
    _cwStopHeartbeat();
    // Supabase kanalını kapat
    if (getCwRoomSupaChannel()) { window.FocusSupabase?.removeChannel(getCwRoomSupaChannel()); setCwRoomSupaChannel(null); }
    setCwRoomIsSupabase(false);
    // Firebase room listener'ı kapat
    // (Firebase-era currentRoomRef kaldırıldı — Supabase kanalı zaten yukarıda kapatılıyor)
    setCurrentRoomId(null);
    setCwRoomLinkedHabit(null);
    setCwRoomIsHost(false);
    setCurrentRoomPhase('work');
    setSharedFocusMyTask(null, getSharedFocusMyTaskText());
    setSharedFocusBreakMinutes(SHARED_FOCUS_DEFAULT_BREAK_MINUTES);
    setSharedFocusMinimized(false);
    setSharedFocusPhaseInitialized(false);
    gfCloseLeaveChoiceModal();
    const returnBtn = document.getElementById('scw-return-shared-focus-btn');
    if (returnBtn) returnBtn.classList.add('hidden');
    window._syncFocusReturnMiniBtn();

    const statusCard = document.getElementById('scw-partnership-status');
    const statusText = document.getElementById('scw-status-text');
    const leaveBtn = document.getElementById('scw-leave-btn');

    if (statusCard) { statusCard.className = "scw-status-card solo-mode"; }
    if (statusText) { statusText.textContent = "Tek Başına Odaklanıyor"; }
    if (leaveBtn) { leaveBtn.classList.add('hidden'); }
    closeSharedFocusOverlay(); // Ayrı odak odası arayüzünü kapat ve zamanlayıcıyı eski yerine koy
    resetScwTimer();
}
