// ============================================================
// FOCUSAI SOCIAL.JS — v1.0
// Gerçek Zamanlı Çevrimiçi Özellikler
// ============================================================
// Faz O: bu üç dosya inline-module-loader.js'de social.js'ten HEMEN ÖNCE
// yükleniyor (social.js'in dosyalar-arası konumu planning.js'in TERSİNE —
// diğer social-*.js modülleri social.js'ten SONRA yüklenip window.* köprüleri
// kullanıyor; ama bu üç yeni dosya social.js'in KENDİ İÇİNDEN bare çağrıldığı
// için üretici→tüketici sırası gerekiyor, planning.js'teki desenle aynı).
import { getCurrentUser, setCurrentUser } from './state/current-user-store.js';
import { getSharedFocusMinimized, setSharedFocusMinimized } from './state/shared-focus-minimized-store.js';
import { getDcActiveGroupCode, setDcActiveGroupCode } from './state/dc-active-group-code-store.js';
import { getDcChannelTreeChannel, setDcChannelTreeChannel } from './state/dc-channel-tree-store.js';
import './state/current-channel-is-announcement-store.js';
import { getCurrentActiveGroupCode, setCurrentActiveGroupCode } from './state/current-active-group-code-store.js';
import './state/active-group-id-store.js';
import { getMyGroupsDataCache, setMyGroupsDataCache } from './state/my-groups-data-cache-store.js';
import { getDcMembersSupabaseChannel, setDcMembersSupabaseChannel } from './state/dc-members-supabase-channel-store.js';
import { getDcMembersPresenceHandler, setDcMembersPresenceHandler } from './state/dc-members-presence-handler-store.js';
import { getDcRoomPresenceChannels, setDcRoomPresenceChannels } from './state/dc-room-presence-channels-store.js';
import { getDcCurrentRoomPresence, setDcCurrentRoomPresence } from './state/dc-current-room-presence-store.js';
import { getDcReadChannel, setDcReadChannel } from './state/dc-read-channel-store.js';
import { getDcOtherLastRead, setDcOtherLastRead } from './state/dc-other-last-read-store.js';
import { dcChatEnabled, avatarUploadEnabled, _applyPlanBadge, _applyChatGate } from './social-chat-gate.js';
import { _cwOthersLabel, _cwIsRoomOwner } from './social-cw-room-helpers.js';
import { gfStartQuoteRotation, gfStopQuoteRotation } from './social-focus-quote-rotation.js';
import { getProductivityStats } from './social-productivity-share.js';
import { openAuthModal } from './auth-ui.js';
import { initDcChatTheme } from './social-dc-chat-theme.js';
import { updateProfileHeader, showNotConfiguredBanner } from './social-profile-header.js';
import { gfRenderMetroTimeline, gfRenderParticipants, gfUpdateRing } from './social-group-focus-render.js';
import { closeDcChatSearch, openDcGlobalSearch } from './social-chat-search.js';
import { ensureSeason, ensureWeeklyLeague } from './social-gamification.js';
import { showGroupWelcomeModal } from './social-group-discover.js';
import { openBuddyFocusSettingsModal, openGroupFocusSettingsModal } from './social-buddy-focus-settings-modal.js';
import { openSetupModalAsEdit, resetSetupModalToRegister } from './social-setup-modal-edit.js';
import { setupGroupModalControls } from './social-group-modal-setup.js';
import {
    teardownDcTyping, setupDcTyping, notifyDcTyping, clearDcTypingNow,
    teardownDmTypingSupabase, setupDmTypingSupabase,
    teardownDcGroupTypingSupabase, setupDcGroupTypingSupabase,
    teardownDcGroupReadReceiptSupabase, setupDcGroupReadReceiptSupabase,
    teardownDcReadReceipt, setupDcReadReceipt, setupDmReadReceiptSupabase,
    updateDcReadReceipts, teardownDcGroupReadReceipt
} from './social-typing-read-receipts.js';
import { gfOpenLeaveChoiceModal, gfCloseLeaveChoiceModal, gfLeaveSessionCompletely } from './social-group-focus-leave.js';
import { gfApplyActiveTaskDisplay, gfPopulateTaskDropdown, gfEnsureTaskSelectorBindings } from './social-group-focus-task-selector.js';
import {
    gfSetBreakChatPath, gfAppendChatMessage, gfAlignBreakChat,
    gfToggleBreakChat, gfSendBreakMessage, gfEnsureBreakChatBindings
} from './social-group-focus-break-chat.js';
import { closeReactionPicker, sendGroupKudos, _maybeCelebrateGroupGoal } from './social-activity-feed.js';
import {
    _renderDcCwRoomInviteCard, _renderDcSystemJoinCard,
    _renderDcSystemNotice, _renderDcRoleChangeNotice
} from './social-dc-message-cards.js';
import { sendCWInvite, sendGroupFocusInvite, listenForCWDeclines, listenForCWInvites } from './social-cw-invites.js';
import {
    loadDcMembers, teardownDcRoomPresenceStripChannels,
    renderRoomPresenceStrip, startRoomPresenceSupabase
} from './social-room-presence.js';
import { updateDcBottomProfile, initDcArchitecture, openProfileContextMenu } from './social-dc-init.js';
import { subscribeDcOnlineStatus, dcRebuildDateSeparators } from './social-dc-online-status.js';
import {
    dcPinnedPathFor, teardownDcPinned, setupDcPinned, teardownDmPinnedSupabase,
    refreshDmPinned, setupDmPinnedSupabase, teardownGroupPinnedSupabase,
    refreshGroupPinned, setupGroupPinnedSupabase, toggleDcPinMessage, renderDcPinnedBanner
} from './social-message-pins.js';
import { showDcDmLimitNotice } from './social-dm-limit-notice.js';
import { insertDcUnreadDivider, setupDcJumpUnreadBtn } from './social-unread-divider.js';
import { dcSetHushMode } from './social-focus-hush.js';
import { setupDcMentionAutocomplete, parseDcMentions } from './social-dc-mentions.js';
import { saveDcDraft, restoreDcDraft, clearDcDraft, canSendDcMessage } from './social-dc-draft.js';
import {
    gfResetIdleTimer, gfEnsureIdleBindings, gfEnsureFocusModeBinding,
    gfExitFocusMode, gfSetRunning, gfSetGhostModeEnabled
} from './social-group-focus-idle.js';
import { dcShowUndoToast, dcShowConfirm, dcShowDeleteChoice, DC_DELETE_FOR_EVERYONE_LIMIT_MS } from './social-dc-confirm-toasts.js';
import { DC_EMOJI_GROUPS, initDcEmojiPicker } from './social-emoji-picker.js';
import {
    _resolveProfileByUsername, _resolveProfileById, _fetchDcReactionsMap,
    _normalizeSupabaseDmMessage, _normalizeSupabaseGroupMessage
} from './social-dc-profile-resolve.js';
import { _setArenaChipCurrent, _updateArenaChipActive, renderArenaGroupChips } from './social-arena-chips.js';
import { dcGetClearedAt, dcGetDeletedForMe, dcAddDeletedForMe } from './social-chat-local-delete.js';
import {
    deriveSharedFocusPhase, buildSharedFocusSkipUpdate,
    getSharedFocusTotalSeconds, populateSharedFocusTaskSelect, gfComputeCurrentRound
} from './social-shared-focus-math.js';
import {
    _dcAutoResizeTextarea, _dcMarkPendingBubbleFailed, _dcRemovePendingBubble,
    attachDcMsgAvatar, attachDcMsgSpacer
} from './social-dc-msg-dom-helpers.js';
import {
    _cwNormalizeSupaRoom, bfpUpdatePreview, getSavedUser, _isRateLimitError,
    _syncGlobalRoomBar, _hideGlobalRoomBar, postActivity
} from './social-misc-isolated-utils.js';
import { setFocusState, gscGetFocusingNow, setWaitingState, gscGetWaitingNow } from './social-presence-focus-utils.js';
import { dcIsNearBottom, jumpToDcMsg } from './social-dc-scroll-utils.js';
import { _dcPersistLastOpen, _dcClearLastOpen, _dcPersistEnteredRoom, _dcClearEnteredRoom } from './social-dc-last-open-storage.js';
import { _cwStartHeartbeat, _cwStopHeartbeat } from './social-cw-heartbeat.js';
import { gfShowPhaseTransition, gfHidePhaseTransition } from './social-shared-focus-phase-ui.js';
import { _throttleAction, _trWeekStart } from './social-throttle-and-date-utils.js';
import { getActiveChatTarget, setActiveChatTarget } from './state/active-chat-target-store.js';
import { getDcState, setDcState } from './state/dc-state-store.js';
import { getDcEnteredRoomKey, setDcEnteredRoomKey } from './state/dc-entered-room-key-store.js';
import { getDcGlobalMsgCache, setDcGlobalMsgCache } from './state/dc-global-msg-cache-store.js';
import { getDcCurrentGroupScope, setDcCurrentGroupScope } from './state/dc-current-group-scope-store.js';
import {
    getDcMsgRegistry, setDcMsgRegistry,
    getDcSelectedKeys,
    getDcRenderedKeys,
    getDcCurrentRole, setDcCurrentRole,
    getDcCurrentJoinedAt, setDcCurrentJoinedAt,
    getDcLoadingMore, setDcLoadingMore,
    getDcOldestCreatedAt, setDcOldestCreatedAt,
    getDcCurrentConversation, setDcCurrentConversation,
    getDcCurrentOtherProfile, setDcCurrentOtherProfile
} from './state/dc-message-render-store.js';
import { renderDcMessage } from './social-dc-message-render.js';
import { ensureDcLoadMoreBtn } from './social-dc-pagination.js';
import { getDcEnteredRoomId, setDcEnteredRoomId } from './state/dc-entered-room-id-store.js';
import { setOnlineFriendsPresenceCb } from './state/online-friends-presence-cb-store.js';
import { getActiveReactionPicker, setActiveReactionPicker } from './state/active-reaction-picker-store.js';
import { getPendingClassroomSubtab, setPendingClassroomSubtab } from './state/pending-classroom-subtab-store.js';
import { getDcRestorePending, setDcRestorePending } from './state/dc-restore-pending-store.js';
import { getHushedNotifQueue } from './state/hushed-notif-queue-store.js';
import { getDcCurrentGroupId, setDcCurrentGroupId, getDcCurrentMsgPath, setDcCurrentMsgPath, getDcOldestKey, setDcOldestKey, getDcReplyTo, setDcReplyTo } from './state/dc-chat-view-store.js';
import { initiateDcReply, cancelDcReply, openDcMsgReactionPicker, toggleDcMsgReaction } from './social-dc-reply-reactions.js';
import {
    _escapeHtml, _formatMessageText, _dcCreatePendingBubble,
    generateGroupCode, dcAvatar, getDB, getUser, _pickNewOwner
} from './social-misc-pure-utils.js';
import { showDcSkeleton, setupDcScrollButton, dcHandleScrollAfterRender, _dcRoomMsgCounts } from './social-dc-scroll-skeleton.js';
import { dcHideSessionStrip, dcRenderSessionStrip } from './social-dc-session-strip.js';
import { getCwPartnerUsername, getCwPartnerName, getCwPartnerColor, setCwPartnerInfo } from './state/cw-room-partner-store.js';
import { setCwInviteRef } from './state/cw-invite-ref-store.js';
import { getCwRoomOriginGroupScope, setCwRoomOriginGroupScope } from './state/cw-room-origin-store.js';
import { getCwRoomLinkedHabit, setCwRoomLinkedHabit } from './state/cw-room-linked-habit-store.js';
import { getCwRoomIsHost, setCwRoomIsHost } from './state/cw-room-host-store.js';
import { getSharedFocusBreakInterval, setSharedFocusBreakInterval } from './state/shared-focus-break-interval-store.js';
import { getSharedFocusBindingsReady, setSharedFocusBindingsReady } from './state/shared-focus-bindings-ready-store.js';
import { getCurrentRoomPhase, setCurrentRoomPhase } from './state/cw-room-phase-store.js';
import { getSharedFocusMyTaskId, getSharedFocusMyTaskText, setSharedFocusMyTask } from './state/shared-focus-my-task-store.js';
import { getSharedFocusPhaseInitialized, setSharedFocusPhaseInitialized } from './state/shared-focus-phase-initialized-store.js';
import { getSharedFocusTotalRounds, setSharedFocusTotalRounds } from './state/shared-focus-total-rounds-store.js';
import { _isSupabaseGroupAdmin } from './social-dc-group-admin.js';
import { openDcGroupChannelSupabase, openDcDmRoom, closeDcChat } from './social-dc-room-lifecycle.js';
import { openGroupMentionNotif } from './social-group-mention-notif.js';
import { openDcChatRoom, showDcRoomPreview, updateChatInputStatus } from './social-dc-open-room.js';
import { syncSidebarGroupList } from './social-dc-panel-view.js';
import {
    getCurrentRoomId, setCurrentRoomId,
    getCwRoomIsSupabase, setCwRoomIsSupabase,
    getCwRoomSupaChannel, setCwRoomSupaChannel,
    getCwRoomAllowRequests, setCwRoomAllowRequests
} from './state/cw-current-room-store.js';
import {
    getCwPendingControlRequest, setCwPendingControlRequest,
    getCwMyRequestInFlight, setCwMyRequestInFlight,
    getCwRequestSpamAttempts, setCwRequestSpamAttempts,
    getCwRequestLockoutUntil, setCwRequestLockoutUntil
} from './state/cw-control-request-store.js';
import { getSharedFocusDisplaySyncInterval, setSharedFocusDisplaySyncInterval } from './state/shared-focus-display-sync-interval-store.js';
import { getSharedFocusInFocusMode, setSharedFocusInFocusMode } from './state/shared-focus-in-focus-mode-store.js';
import { getGfMode, setGfMode } from './state/gf-mode-store.js';
import { getGfLeaveBtnAC, setGfLeaveBtnAC } from './state/gf-leave-btn-ac-store.js';
import {
    applySharedFocusModePill, applySharedFocusBreakPill, updateSharedFocusSettingsSummary,
    gfApplyPhaseIndicator, ensureSharedFocusReturnButtonBinding, renderSharedFocusParticipants,
    applySharedFocusPhase, renderSharedFocusTaskStatus
} from './social-shared-focus-ui.js';
import {
    enterCWRoom, _cwApplyRoomData, _cwSetupSupaRoomUI, exitCWRoomLocal
} from './social-shared-focus-room-lifecycle.js';
import {
    closeSharedFocusOverlay,
    gfShowPartnerRestartingModal, _cwShowSoloContinuePrompt
} from './social-shared-focus-timer-ctrl.js';
import {
    gfOpenOverlayShell, closeGroupFocusOverlay, buildSoloFocusRoomLike,
    minimizeSharedFocusOverlay, restoreSharedFocusOverlay, applySharedFocusSkip,
    gfEnsureRoomControlBindings, gfDoEndSession, gfDoRestartSession,
    applySharedFocusWorkDuration, applySharedFocusBreakDuration, _cwApplyRoleBasedUI
} from './social-shared-focus-overlay.js';
import {
    recalcSharedFocusChatVisibility, toggleSharedFocusBreakChat, updateSharedFocusPhaseLabel,
    startSharedBreakCountdownUI, gfApplyFocusModeFromState,
    syncSharedFocusTimerUI,
    recordSharedFocusMinute, handleSharedFocusFocusPhaseComplete
} from './social-shared-focus-sync.js';
import { initSocial, bindAuthChangeListener, loadCommunityProfile, _profileToCurrentUser, ensureCommunityAccess } from './social-auth-bootstrap.js';
import { openCommunitySetupModal, saveUser, registerUser } from './social-user-registration.js';
import { syncXP, subscribeToGroup, listenMyGroups, startAllSocialListeners } from './social-group-listeners.js';
import {
    writeSharedFocusMyTask, _cwHasDirectControl, _cwDeleteInviteMessage,
    start, initScwTimer, ensureSoloFocusOverlay, startLocalScw, pauseLocalScw
} from './social-mini-focus-timer.js';
import { _openFullPanel, _switchToSohbetTab } from './social-chat-panel-open.js';
import { renderRecentConversations, setupGroupRecentConversationsSupabase } from './social-dm-notifications.js';
import { renderLeaderboardFromCache } from './social-friends-notifications.js';
import './social-my-groups-active.js';
(function () {
'use strict';

// ─── GLOBAL MİNİ TOAST + CUSTOM CONFIRM MODAL ────────────────────────────────
// social-toast.js dosyasına taşındı (window.dcShowToast, window.showFocusaiConfirm).

// ─── ÖDEV ADIM KAYNAK LİNKİ ──────────────────────────────────────────────────
// .cp-asg-step-row-link tıklaması, ebeveyn <label>'ın checkbox'ını tetiklemesin
// diye (eskiden onclick="event.stopPropagation()" idi, CSP script-src'den
// unsafe-inline kaldırılabilsin diye delegated listener'a taşındı).
document.addEventListener('click', (e) => {
    if (e.target.closest('.cp-asg-step-row-link')) e.stopPropagation();
});

// ─── GRUP ONBOARDING: "SEANS PLANLA" BUTONU ─────────────────────────────────
document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="onboarding-goto-calendar-tab"]');
    if (!btn) return;
    btn.closest('.group-detail-tabs')?.querySelector('[data-gtab=calendar]')?.click();
});

// ─── BOŞ DURUM CTA'LARI ──────────────────────────────────────────────────────
// data-empty-cta butonları: boş listelerdeki yönlendirme aksiyonları
document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-empty-cta]');
    if (!btn) return;
    const action = btn.dataset.emptyCta;
    if (action === 'add-friend') {
        const openBtn = document.getElementById('open-add-friend-btn');
        if (openBtn) { openBtn.click(); return; }
        document.getElementById('add-friend-modal')?.classList.remove('hidden');
    } else if (action === 'discover-groups') {
        const dBtn = document.getElementById('group-discover-modal-btn');
        if (dBtn) { dBtn.click(); return; }
    }
});

// ─── SINIF/DERS VE İŞ YERİ/EKİP GRUPLARINDA SAHİPLİK DEVRİ SEÇİCİSİ ─────────
// Sahip ayrılırken kime devredeceğini kendi seçer (diğer gruplardaki otomatik
// hiyerarşi seçiminin aksine) — bir öğretmen/yönetici sınıfını rastgele bir
// üyeye değil, bizzat seçtiği kişiye devretmek ister.
// _pickNewOwner → social-misc-pure-utils.js'e taşındı (window köprüsü orada kuruluyor).

(function () {
    'use strict';

    // XSS koruması — kullanıcı metnini innerHTML'e basmadan önce escape et.
    // Tek kaynak: script.js'teki window.escapeHtml. social.js önce bu dosya
    // yüklendikten sonra çalıştığı için normalde her zaman mevcuttur; olası bir
    // yükleme sırası değişikliğine karşı aynı mantığı yerel fallback olarak tutuyoruz.
    // _escapeHtml → social-misc-pure-utils.js'e taşındı.

    // "Bu hafta"nın başlangıcını (Pazartesi, TR saati) sunucu tarafındaki
    // date_trunc('week', now() at time zone 'Europe/Istanbul') ile AYNI şekilde
    // hesaplar (bkz. supabase/migrations/109-111). Türkiye yaz saati uygulamadığı
    // için (2016'dan beri sabit UTC+3) basit bir +3 saat offset'i yeterli ve
    // güvenilir — DST hesabına gerek yok.
    // _trWeekStart/_throttleAction → social-throttle-and-date-utils.js'e taşındı
    // (Faz O). window.* köprüleri de o dosyada.

    // ─── İYİMSER (OPTIMISTIC) GÖNDERİM BALONCUĞU ─────────────
    // Sunucu cevabı beklenmeden mesajı hemen ekranda gösterir; gerçek mesaj
    // realtime dinleyiciden gelince bu geçici baloncuk kaldırılır. Hata olursa
    // "tekrar dene" durumuna geçer.
    // _dcCreatePendingBubble → social-misc-pure-utils.js'e taşındı.

    // _isRateLimitError/_dcMarkPendingBubbleFailed/_dcRemovePendingBubble →
    // social-misc-isolated-utils.js / social-dc-msg-dom-helpers.js'e taşındı (Faz O).

    // _formatMessageText → social-misc-pure-utils.js'e taşındı.

    // currentUser → state/current-user-store.js'e taşındı (Faz H devamı, tam dönüşüm).
    // NOT: _friendsCache artık social-friends-notifications.js'te tanımlı (Faz 5
    // çıkarmasında bu dosyaya taşındığında kendi bildirimi unutulmuştu — 2026-07-23
    // düzeltmesiyle oraya taşındı, burada vestigial kopya kaldırıldı).
    // username -> arkadaş olunan zaman damgası. Aktivite akışında bir arkadaşın
    // SADECE bu zamandan SONRAKİ aktiviteleri gösterilir — arkadaş olmadan önceki
    // (eski) aktiviteleri akışta görünmemeli.
    let _friendsSinceCache = null;
    // 🛡️ Yetki Sistemi Global Değişkenleri
    // currentUserRole → state/current-user-role-store.js'e taşındı.
    let allUserRoles = {}; // Tüm üyelerin rolleri burada tutulacak
    let selectedUserForRole = ''; // Rolünü değiştirmek için seçtiğimiz üye
    // getCurrentRoomId()/getCwRoomIsSupabase()/_cwRoomSupaChannel → state/cw-current-room-store.js'e taşındı.
    // social-group-focus-leave.js ve social-group-focus-break-chat.js artık store'u doğrudan import ediyor.
    // Getter+setter — social-cw-invites.js (davet akışı) için, oda kurulumu/
    // yeniden başlatma akışıyla paylaşılan partner bilgisi.
    window._cwGetPartnerInfo = () => ({ username: getCwPartnerUsername(), name: getCwPartnerName(), color: getCwPartnerColor() });
    window._cwSetPartnerInfo = (username, name, color) => { setCwPartnerInfo(username, name, color); };
    window._cwSetInviteMsgRef = (msgId, scope) => { setCwInviteRef(msgId, scope); }; // social-cw-invites.js için
    window._cwSetRoomOriginGroupScope = (v) => { setCwRoomOriginGroupScope(v); }; // social-cw-invites.js için
    let currentChatRoomId = "general";
    // social-online-friends.js dosyasına taşındığı için window üzerinde paylaşılıyor
    setOnlineFriendsPresenceCb(null);
    // NOT: _friendsChangedBound artık social-friends-notifications.js'te tanımlı
    // (bindFriendsChangedListener aynı dosyada — 2026-07-23 düzeltmesi, bkz. _friendsCache notu).

    // Mini Sanal Odak Odası Zamanlayıcı Değişkenleri
    // getCwRoomLinkedHabit() → state/cw-room-linked-habit-store.js'e taşındı.
    window._cwGetLinkedHabit = () => getCwRoomLinkedHabit();
    // Ortak odak odası geliştirmeleri için durum değişkenleri
    // getCwRoomIsHost() → state/cw-room-host-store.js'e taşındı.
    window._cwGetRoomIsHost = () => getCwRoomIsHost();
    // getSharedFocusBreakInterval()/getSharedFocusBindingsReady()/getCurrentRoomPhase()/
    // getSharedFocusMyTaskId()/Text/getSharedFocusSoloMode()/getSharedFocusBreakMinutes()/
    // getSharedFocusPhaseInitialized() → ilgili state/*-store.js dosyalarına taşındı.
    // Salt-okunur/yazma köprüsü — social-group-focus-task-selector.js için.
    window._gfGetMyTask = () => ({ id: getSharedFocusMyTaskId(), text: getSharedFocusMyTaskText() });
    window._gfSetMyTask = (id, text) => { setSharedFocusMyTask(id, text); };
    // sharedFocusMinimized → state/shared-focus-minimized-store.js'e taşındı (Faz H devamı).
    // sharedFocusPhaseTransitionTimeout → social-shared-focus-phase-ui.js'e taşındı (Faz O).

    // ═══════════════════════════════════════════════════════
    // 🎯 TÜRETİLMİŞ-ZAMAN MOTORU — Grup Odaklanması'ndaki
    // "startedAt'tan türet" modeliyle birebir aynı mantık: komut
    // round-trip'i yok, herkes kendi Date.now() - startedAt'ından hesaplar.
    // Hem bireysel mini zamanlayıcı hem partner odası bu motoru kullanır;
    // breakMinutes > 0 ise iş↔mola döngüsü, 0/yoksa tek seferlik geri sayım.
    // ═══════════════════════════════════════════════════════
    // getSharedFocusSession() → state/shared-focus-session-store.js'e taşındı.
    // getSharedFocusTotalRounds() → state/shared-focus-total-rounds-store.js'e taşındı.
    window._getSharedFocusTotalRounds = () => getSharedFocusTotalRounds(); // social-cw-invites.js için

    // deriveSharedFocusPhase/buildSharedFocusResumeUpdate/buildSharedFocusSkipUpdate
    // → social-shared-focus-math.js'e taşındı (Faz O).

    // ──────────────────────────────────────────────────────
    // BAŞLATMA
    // ──────────────────────────────────────────────────────
    // initSocial/bindAuthChangeListener/loadCommunityProfile/_profileToCurrentUser/
    // ensureCommunityAccess → social-auth-bootstrap.js dosyasına taşındı (Faz H devamı, 2026-07-31).

    // openCommunitySetupModal/saveUser/registerUser → social-user-registration.js
    // dosyasına taşındı (Faz H devamı, 2026-07-31).

    // Tüm gerçek zamanlı sosyal dinleyicileri başlatır. Sayfa açılışında (initSocial)
    // ve yeni hesap oluşturulduğunda (registerUser sonrası) çağrılır — böylece yeni
    // kayıt olan bir kullanıcı, sayfayı yenilemeden de arkadaşlık isteklerini,
    // DM bildirimlerini ve son mesajlaşmaları canlı olarak alır.
    // ─── SOHBET YETKİ KAPISI (Kurumsal plan hazırlığı, Faz 1) ─────────
    // Karar (2026-07-02): sohbet bireysel üründen kalkacak, kurumsal aboneliğe
    // (dershane/okul/işyeri) taşınacak. Faz 1 = Arena akışlarının sohbete yazan
    // kısımları bu kapının arkasına alınır; sohbetsiz muadilleri (bildirim toast'ı,
    // aktivite akışı) koşulsuz çalışır. Faz 2'de bu fonksiyon plana/yetkiye
    // bağlanacak ve bireysel kullanıcıda false dönecek — sohbet UI'ı gizlenecek.
    // dcChatEnabled / avatarUploadEnabled / _applyPlanBadge / _applyChatGate
    // → social-chat-gate.js dosyasına taşındı (Faz S adım 2).
    // startAllSocialListeners/saveUser/registerUser/syncXP → social-group-listeners.js
    // ve social-user-registration.js dosyalarına taşındı (Faz H devamı, 2026-07-31).
    _applyChatGate(); // yüklenme anı: giriş yoksa da sohbet kapalı başlar

    // ─── AMACA HİZMET EDEN BİLDİRİMLER — social-focus-reminders.js
    // dosyasına taşındı (Faz 2, 2026-07-19).
    // window.scheduleFocusReminders() üzerinden erişiliyor.

    // ─── "KİŞİLER" POPOVER (2026-07-03) → social-online-people-popover.js dosyasına taşındı ──────

    // ─── "ÖDEVLERİM" ROZETİ (2026-07-06) → social-assignments-badge.js dosyasına taşındı ──────

    // ─── ANA SAYFA ÖZET ŞERİDİ + GRUP HEDEFLERİ → social-home-summary.js
    // dosyasına taşındı (Faz E, 2026-07-23). renderHomeSummary/getLocalXP/
    // renderArenaGroupGoals window.X olarak erişilebilir.

    // ──────────────────────────────────────────────────────
    // PRESENCE (ÇEVRİMİÇİ DURUM)
    // ──────────────────────────────────────────────────────
    // PRESENCE (ÇEVRİMİÇİ DURUM, heartbeat+polling motoru) → social-presence.js dosyasına taşındı (Faz 6)

    // Pomodoro sayacı gerçekten "odaklanma" (work) modunda çalışırken true,
    // duraklatılınca/durdurulunca veya mola modundayken false çağrılır.
    // script.js'teki timer start/pause/reset/mode-değişimi noktalarından tetiklenir.
    // setFocusState/gscGetFocusingNow/setWaitingState/gscGetWaitingNow →
    // social-presence-focus-utils.js'e taşındı (Faz O). window.* köprüleri de
    // o dosyada.

    // subscribeOnlineFriends gibi yerlerden presence durumuna erişim için —
    // dönüş şekli eskisiyle aynı ({userId: [{...meta}]}), sadece kaynağı artık
    // canlı kanal değil periyodik olarak dolan _polledPresenceCache.
    window.getCommunityPresenceState = () => window.__getPolledPresenceCache();

    // ──────────────────────────────────────────────────────
    // ARKADAŞLAR
    // ──────────────────────────────────────────────────────
    // ──────────────────────────────────────────────────────
    // SESLİ / MASAÜSTÜ BİLDİRİM SİSTEMİ → social-notif-sounds.js dosyasına taşındı
    // (playNotificationSound, playRoomJoinSound/LeaveSound,
    //  requestDesktopNotificationPermission, maybeShowDesktopNotification,
    //  showChatNotificationToast — hepsi window.X olarak burada da erişilebilir)
    // ──────────────────────────────────────────────────────

    // ──────────────────────────────────────────────────────
    // SOHBET MESAJI BİLDİRİMLERİ + SON MESAJLAŞMALAR/OKUNMAMIŞ ROZET MOTORU
    // → social-dm-notifications.js dosyasına taşındı (Faz E, 2026-07-23).
    // isChatContextActive/handleIncomingChatMessage/setupChatMessageNotifications,
    // loadDmLastRead/saveDmLastRead/markDmRead/getDmLastRead, loadGroupLastRead/
    // saveGroupLastRead/getGroupLastRead/markGroupRead, loadJsonList/saveJsonList,
    // _dcGetBlockedByOthers/_dcSetBlockedByOthers, hasUnreadDm, updateContactUnreadDot/
    // updateOnlineFriendUnreadDot, getFriendInfo, refreshAllDmUnreadCounts/
    // resyncRecentConversationsAndUnread/registerDmUnreadTracking/dcUnreadTotals/
    // renderFloatingChatBadge, setupRecentConversations(Supabase), goToGroupChat,
    // renderRecentConversations/showRecentConvoContextMenu/updateRecentConvoUnread,
    // showRoleChangeToast/showGenericNotifToast — hepsi window.X olarak erişilebilir.
    // ──────────────────────────────────────────────────────



    // ──────────────────────────────────────────────────────
    // ÇEVRİMİÇİ ARKADAŞLAR (YENİ NESİL DİKEY LİSTE) → social-online-friends.js dosyasına taşındı
    // ──────────────────────────────────────────────────────

    // ──────────────────────────────────────────────────────
    // AKTİVİTE AKIŞI
    // ──────────────────────────────────────────────────────
    // closeReactionPicker/_activeReactionPicker, sendGroupKudos,
    // _currentWeekStartKey, _maybeCelebrateGroupGoal → social-activity-feed.js dosyasına taşındı

    // postActivity → social-misc-isolated-utils.js'e taşındı (Faz O).

    // ──────────────────────────────────────────────────────
    // ORTAK ALIŞKANLIK ZİNCİRLERİ (BUDDY HABITS) → social-buddy-habits.js dosyasına taşındı
    // ──────────────────────────────────────────────────────

    // ──────────────────────────────────────────────────────
    // GERÇEK ZAMANLI GRUPLAR (GROUPS SYSTEM)
    // ──────────────────────────────────────────────────────
    // subscribeToGroup/listenMyGroups/activeGroupKey → social-group-listeners.js
    // dosyasına taşındı (Faz H devamı, 2026-07-31).

    // ──────────────────────────────────────────────────────
    // CO-WORKING ODASI (Gerçek Zamanlı)
    // ──────────────────────────────────────────────────────
    // ──────────────────────────────────────────────────────
    // DAVET ÖNCESİ ZAMANLAYICI AYAR MODALI
    // "Birlikte Odaklan" (cowork-challenge) davetinde olduğu gibi, davet göndermeden
    // önce kullanıcı zamanlayıcı süresini seçer; bu seçim odaya da taşınır.
    // ──────────────────────────────────────────────────────
    // openBuddyFocusSettingsModal/openGroupFocusSettingsModal/
    // _openBuddyFocusSettingsModalShared/closeBuddyFocusSettingsModal/
    // ensureBuddyFocusSettingsBindings → social-buddy-focus-settings-modal.js
    // dosyasına taşındı (Faz H devamı). window.X köprüleri de o dosyada.

    // ─── ORTAK ODAKLANMA DAVET AKIŞI → social-cw-invites.js dosyasına taşındı
    // (Faz E, 2026-07-23 — riskli bölge denemesi). sendCWInvite/
    // sendGroupFocusInvite/listenForCWDeclines/listenForCWInvites window.X
    // olarak erişilebilir. 10 paylaşılan oda/oturum state değişkeni için
    // yeni getter/setter köprüleri eklendi (bkz. dosya başındaki değişken
    // tanımları, ~223-290 satır civarı: _cwGetRoomIsSupabase/
    // _getSharedFocusTotalRounds/_cwSetPartnerInfo/_cwSetRoomOriginGroupScope/
    // _cwSetInviteMsgRef) — çekirdek fonksiyonlar (enterCWRoom vb.) bu
    // değişkenlere hâlâ doğrudan erişiyor, değiştirilmedi.

    // ──────────────────────────────────────────────────────
    // AYRI "BİRLİKTE ODAKLANMA ODASI" ARAYÜZÜ
    // "Birlikte Çalışalım" (cowork-session-overlay) ile birebir aynı görsel yapı/sınıflar
    // kullanılarak tam ekran bir oda açar; partnerler bu özel arayüzde buluşup
    // zamanlayıcıyı (mevcut scw senkron altyapısı üzerinden) birlikte yönetir.
    // ──────────────────────────────────────────────────────
    // sharedFocusDisplaySyncInterval → state/shared-focus-display-sync-interval-store.js'e taşındı.

    // getScwActiveModeSeconds → ölü kod olduğu doğrulanıp silindi (Faz H devamı, 2026-07-31).

    // getSharedFocusTotalSeconds → social-shared-focus-math.js'e taşındı (Faz O).

    // applySharedFocusModePill/applySharedFocusBreakPill/updateSharedFocusSettingsSummary
    // → social-shared-focus-ui.js dosyasına taşındı (Faz H devamı, 2026-07-30).

    // recalcSharedFocusChatVisibility/toggleSharedFocusBreakChat → social-shared-focus-sync.js dosyasına taşındı (Faz H devamı).

    // ──────────────────────────────────────────────────────
    // ODAKLANMA MODU — seans çalışırken arayüz sadeleşir: sadece zamanlayıcı,
    // ilerleme çubuğu, motivasyon sözü ve "neye odaklanıyorsun" bilgisi görünür kalır
    // ──────────────────────────────────────────────────────
    // sharedFocusInFocusMode → state/shared-focus-in-focus-mode-store.js'e taşındı.

    // ══════════════════════════════════════════════════════
    // ⚙️ ORTAK GRUP ODAKLANMA ARAYÜZÜ (#group-focus-overlay, gf-*)
    // Bireysel Zamanlayıcı (#zamanlayici) ile birebir aynı görsel/işlevsel
    // desenleri uygular: dairesel SVG halka, alıntı rotasyonu, "Odak Modu" /
    // ghost-mode (3sn hareketsizlikte sadeleşme). Hem "Birlikte Odaklanma Odası"
    // (alışkanlık eşleştirme/oda tabanlı) hem de "⚡ Birlikte Çalışalım" (sohbetteki
    // yıldırım butonuyla başlatılan meydan okuma tabanlı) akışı bu TEK ortak
    // bileşeni besler ve aşağıdaki ortak gf* yardımcılarını paylaşır.
    // ══════════════════════════════════════════════════════
    // gfMode → state/gf-mode-store.js'e taşındı.
    window._gfGetMode = () => getGfMode();
    // _gfLeaveChoiceAC → social-group-focus-leave.js dosyasına taşındı.
    // _gfLeaveBtnAC → state/gf-leave-btn-ac-store.js'e taşındı.

    // ── Alıntı rotasyonu — social-focus-quote-rotation.js dosyasına taşındı
    // (Faz 2, 2026-07-19). GF_QUOTES/gfShowNextQuote/gfStartQuoteRotation/
    // gfStopQuoteRotation artık gerçek import ile erişiliyor (Faz T).

    // ── "Odak Modu" / Ghost Mode — social-group-focus-idle.js dosyasına
    // taşındı (Faz 2, 2026-07-19). gfIsRunning/gfGhostModeEnabled artık o
    // dosyada tamamen özel; buradan gfSetRunning()/
    // gfSetGhostModeEnabled() ile güncelleniyor. Diğer fonksiyonlar
    // (gfResetIdleTimer, gfEnsureIdleBindings, gfEnsureFocusModeBinding,
    // gfExitFocusMode) window.* üzerinden çağrılıyor.

    // ── Halka animasyonu — bireysel updateTimerDisplay() ile birebir aynı formül ──
    // gfUpdateRing → social-group-focus-render.js dosyasına taşındı (Faz 2,
    // 2026-07-19) — sadece parametre + DOM kullanıyor, window.* ile erişiliyor.

    // ── Metro Timeline Render ──
    // stations = [{type:'focus'|'break', label:'...'}], activeIndex = 0-based
    // gfRenderMetroTimeline → social-group-focus-render.js dosyasına taşındı
    // (Faz 2, 2026-07-19) — sadece parametre + DOM kullanıyor, window.* ile
    // erişiliyor.

    // gfApplyPhaseIndicator → social-shared-focus-ui.js dosyasına taşındı (Faz H devamı, 2026-07-30).

    // ── Yumuşak aşama geçiş ekranı — "☕ Mola Zamanı!" / "🧠 Odaklanma Başlıyor!" splash'i ──
    // "ODAK MODUNDA SOHBET SUSTURMA (hush)" bölümü social-focus-hush.js'e taşındı
    // (window.dcSetHushMode / getHushedNotifQueue()).

    // gfShowPhaseTransition/gfHidePhaseTransition → social-shared-focus-phase-ui.js'e
    // taşındı (Faz O).

    // gfRenderParticipants → social-group-focus-render.js dosyasına taşındı
    // (Faz 2, 2026-07-19) — window.* ile erişiliyor.

    // ── Mola sohbeti — social-group-focus-break-chat.js dosyasına
    // taşındı (Faz 2, 2026-07-19). gfBreakChatPath artık
    // gfSetBreakChatPath() ile güncelleniyor; diğer fonksiyonlar
    // (gfAppendChatMessage, gfAlignBreakChat, gfToggleBreakChat,
    // gfSendBreakMessage, gfEnsureBreakChatBindings) window.* üzerinden
    // çağrılıyor.

    // ── Görev seçimi — social-group-focus-task-selector.js dosyasına
    // taşındı (Faz 2, 2026-07-19). window._gfGetMyTask()/_gfSetMyTask()
    // üzerinden getSharedFocusMyTaskId()/Text'e erişiyor.

    // ── "Ayrıl" seçim modalı — social-group-focus-leave.js dosyasına
    // taşındı (Faz 2, 2026-07-19 — en karmaşık yüksek risk parçası: oda
    // sahipliği devri + çoklu Supabase callback zinciri). gfMode/
    // getCurrentRoomId()/getCwRoomIsHost()/_cwRoomSupaChannel salt-okunur
    // getter'larla, minimizeSharedFocusOverlay/closeGroupFocusOverlay/
    // exitCWRoomLocal window.* köprüsüyle okunuyor.

    // gfOpenOverlayShell/closeGroupFocusOverlay/buildSoloFocusRoomLike/openSharedFocusOverlay/
    // minimizeSharedFocusOverlay/restoreSharedFocusOverlay/applySharedFocusSkip/openSharedFocusLeaveChoiceModal
    // → social-shared-focus-overlay.js dosyasına taşındı (Faz H devamı, 2026-07-31).


    // ──────────────────────────────────────────────────────
    // PARTNER / KATILIMCI BİLGİSİ — "Birlikte Çalışalım" arayüzündeki
    // katılımcı kartlarıyla aynı görünümde gösterir
    // ──────────────────────────────────────────────────────
    // renderSharedFocusParticipants → social-shared-focus-ui.js dosyasına taşındı (Faz H devamı, 2026-07-30).

    // updateSharedFocusPhaseLabel/startSharedBreakCountdownUI/gfApplyFocusModeFromState/
    // applySharedFocusSkip/requestSharedFocusStart/requestSharedFocusPauseToggle/requestSharedFocusReset/
    // syncSharedFocusTimerUI/toggleSharedFocusBreakChat → social-shared-focus-sync.js /
    // social-shared-focus-overlay.js dosyalarına taşındı (Faz H devamı, 2026-07-31).


    // ──────────────────────────────────────────────────────
    // GÖREV SEÇİMİ — kullanıcılar o günkü görevlerinden birine
    // (veya hiçbirine — genel odaklanma) odaklanmayı seçebilir; ayrı ayrı
    // farklı görevlere odaklanabilir ya da aynı görevi seçip birlikte çalışabilirler.
    // ──────────────────────────────────────────────────────
    // populateSharedFocusTaskSelect → social-shared-focus-math.js'e taşındı (Faz O).

    // writeSharedFocusMyTask → social-mini-focus-timer.js dosyasına taşındı (Faz H devamı, 2026-07-31).

    // Birleştirilmiş arayüzde ayrı bir görev-durumu paneli yok — görev bilgisi
    // doğrudan `.active-focus-task` alanında (gfApplyActiveTaskDisplay) gösteriliyor.
    // renderSharedFocusTaskStatus → social-shared-focus-ui.js dosyasına taşındı (Faz H devamı, 2026-07-30).

    // ── Katılımcı → Sahip: Duraklat/Başlat/Sonraki Aşama İSTEĞİ ──────────
    // Sahip olmayan bir katılımcı pause/skip'e bastığında doğrudan uygulamak
    // yerine sahibe broadcast ile istek gönderir; sahip onaylarsa kendi
    // client'ında gerçek aksiyonu tetikler ve sonucu `request_result` ile
    // isteği gönderene bildirir (grup challenge'ındaki istek/onay deseniyle
    // aynı ruhta, rooms için yeniden yazıldı).
    // _cwPendingControlRequest/_cwMyRequestInFlight/_cwRequestSpamAttempts/
    // _cwRequestLockoutUntil → state/cw-control-request-store.js'e taşındı.
    // Spam koruması: bir istek yanıtlanana kadar (approve/deny/timeout) veya
    // en fazla 10 sn boyunca yeni istek gönderilemez. Cooldown DOLMADAN üst
    // üste denemeye devam edilirse (ör. reddedilince hemen tekrar basmak),
    // yanlış parola kilidi gibi 1 dakikalık tam kilitlenme devreye girer ve
    // butonlar geçici olarak devre dışı bırakılır.
    // _cwSetControlBtnsDisabled/_cwSendControlRequest/_cwShowIncomingControlRequest
    // → social-cw-control-request.js dosyasına taşındı (2026-07-30).

    // Odada geriye tek kişi kalınca ("partnerin ayrıldı") gösterilen soru —
    // JS ile dinamik oluşturulan modal (gf-habit-complete-overlay ile aynı desen).
    // _cwShowSoloContinuePrompt → social-shared-focus-timer-ctrl.js dosyasına taşındı (Faz H devamı, 2026-07-30).

    // gfEnsureRoomControlBindings/gfOpenEndSessionModal/_gfFinalizeEndSession/gfDoEndSession/
    // gfDoRestartSession/applySharedFocusWorkDuration/applySharedFocusBreakDuration/
    // gfEnsureDurationSettingsBindings → social-shared-focus-overlay.js dosyasına taşındı (Faz H devamı, 2026-07-31).


    // gfRefreshSettingsSessionInfo → ölü kod olduğu doğrulanıp silindi (Faz H devamı, 2026-07-31).

    // ──────────────────────────────────────────────────────
    // ORTAK ODA KONTROLÜ VE CANLI SENKRONİZASYON
    // ──────────────────────────────────────────────────────
    // isHost=true  → odayı oluşturan taraf (daveti gönderen)
    // isHost=false → odaya sonradan katılan taraf (daveti kabul eden / misafir)
    // İkisi de aynı roomId'yi dinler; bu sayede start/pause/reset komutları anlık olarak eşleşir.

    // Supabase satırını + üye listesini birleşik oda nesnesine dönüştürür.
    // "host/guest" ikilisi yerine N kişilik `members` dizisi (2026-07 çok
    // katılımcılı oda geçişi) — herkes eşit üye, sadece role:'owner' olan
    // kişi kontrol yetkisine sahip.
    // _cwNormalizeSupaRoom → social-misc-isolated-utils.js'e taşındı (Faz O).

    // _cwOthersLabel / _cwIsRoomOwner → social-cw-room-helpers.js dosyasına
    // taşındı (Faz S adım 2).

    // Oda kontrol butonlarının (Ayarlar/Oturumu Bitir/Pause/Skip) görünürlüğünü
    // ve doğrudan-kontrol yetkisini role göre günceller — owner her zaman tam
    // yetkili; owner "Ortak Kontrol"ü açtıysa guest de Ayarlar'ı görür VE
    // Duraklat/Sonraki Aşama'yı isteksiz doğrudan uygulayabilir (bkz.
    // _cwHasDirectControl). Oturumu Bitir owner dışında hiç kimseye görünmez.
    // getCwRoomAllowRequests() → state/cw-current-room-store.js'e taşındı.
    // _cwHasDirectControl → social-mini-focus-timer.js dosyasına taşındı (Faz H devamı, 2026-07-31).
    // _cwApplyRoleBasedUI → social-shared-focus-overlay.js dosyasına taşındı (Faz H devamı, 2026-07-31).

    // _cwStartHeartbeat/_cwStopHeartbeat → social-cw-heartbeat.js'e taşındı (Faz O).

    // Grup sohbetine gönderilen "odaklanma daveti" kartını siler — oturum
    // başlatıldığında (artık kimse katılamaz) ya da hiç başlamadan
    // bitirildiğinde çağrılır.
    // _cwDeleteInviteMessage → social-mini-focus-timer.js dosyasına taşındı (Faz H devamı, 2026-07-31).

    // enterCWRoom/_cwApplyRoomData/_cwSetupSupaRoomUI/exitCWRoomLocal →
    // social-shared-focus-room-lifecycle.js dosyasına taşındı (Faz H devamı, 2026-07-30).

    // ─── UI YARDIMCILARI (avatar/renk/zaman) → social-avatar-utils.js dosyasına
    // taşındı (Faz E, 2026-07-23). avatarSrc/_sanitizeHexColor/_resizeImageToBlob/
    // resolveAvatar/avatarFallbackSrc/avatarImgHtml/groupAvatarHtml/timeAgo/
    // formatFocusMinutes — hepsi window.X olarak erişilebilir.

    // ─── PROFİL HEADER GÜNCELLEME + KURULMAMIŞ PROFİL BANNER'I →
    // social-profile-header.js dosyasına taşındı (Faz E, 2026-07-23).
    // updateProfileHeader/showNotConfiguredBanner window.X olarak erişilebilir.

    // ──────────────────────────────────────────────────────
    // EVENT LISTENERS
    // ──────────────────────────────────────────────────────
    // setupEventListeners/start/initScwTimer/ensureSoloFocusOverlay/startLocalScw/
    // pauseLocalScw → social-mini-focus-timer.js dosyasına taşındı (Faz H devamı, 2026-07-31).
    // start() modül-yüklenme anında (DOMContentLoaded veya setTimeout ile)
    // çağrılıyor — statik import'lar her modülün üst-seviye kodu çalışmadan
    // ÖNCE çözüldüğü için taşıma güvenli; kayıt kodu da fonksiyonla birlikte taşındı.

    // ─── ARKADAŞ ARAMA ('Kişi Ekle' modalı) → social-friend-search.js
    // dosyasına taşındı (Faz E, 2026-07-23). doFriendSearch() window.X
    // olarak erişilebilir.

    // startSharedFocusDerivedTimer → social-shared-focus-timer-ctrl.js dosyasına taşındı (Faz H devamı, 2026-07-30).

    // recordSharedFocusMinute/handleSharedFocusFocusPhaseComplete → social-shared-focus-sync.js dosyasına taşındı (Faz H devamı, 2026-07-31).


    // ──────────────────────────────────────────────────────
    // EDIT MOD AÇICI
    // ──────────────────────────────────────────────────────
    // openSetupModalAsEdit/resetSetupModalToRegister → social-setup-modal-edit.js
    // dosyasına taşındı (Faz H devamı). window.openSetupModalAsEdit köprüsü de o dosyada.

    // hexToRgb → social-avatar-utils.js dosyasına taşındı (Faz E, 2026-07-23).
    // window.hexToRgb olarak erişilebilir.

    // Ana script'ten çağrılabilmesi için
    let _focusai_personalBests = {};

    window.FocusAISocial = {
        postActivity,
        syncXP,
        // social-buddy-habits.js'e taşındı (dinamik import ile bu satırdan
        // SONRA yüklenir) — gecikmeli sarmalayıcı, çağrı anında window
        // üzerinden arar (script.js'in export yüzeyindeki desenle aynı).
        _sendBuddyHabitDeletedNotification: (...args) => window._sendBuddyHabitDeletedNotification(...args),
        setFocusState,
        checkPersonalRecord: function(type, value, label) {
            if (!getCurrentUser()) return;
            const prev = _focusai_personalBests[type];
            if (prev === undefined) {
                _focusai_personalBests[type] = value;
                return;
            }
            if (value > prev) {
                _focusai_personalBests[type] = value;
                postActivity(`istatistiklerinde kişisel rekorunu kırdı! ${label} 📊🏆`);
            }
        }
    };

    // ═══════════════════════════════════════════════════════
    // 👥 GERÇEK ZAMANLI GRUP SİSTEMİ (ONLINE)
    // ═══════════════════════════════════════════════════════
    
    // generateGroupCode → social-misc-pure-utils.js'e taşındı (window köprüsü orada kuruluyor).

    // Dom elementleri yüklendiğinde butonları bağla — social.js dinamik import() ile
    // sayfa 'load' olayından SONRA yüklendiği için (inline-module-loader.js), bu noktada
    // document.readyState zaten 'complete' olur ve DOMContentLoaded olayı çoktan geçmiş
    // olur. Düz addEventListener kullanılırsa bu callback HİÇBİR ZAMAN çalışmaz (grup
    // oluşturma kaydet butonu, gizlilik toggle'ı, karakter sayaçları vb. tamamen ölü kalır).
    // planning.js/collab.js'nin de kullandığı, aşağıdaki initDcArchitecture guard'ıyla
    // (bkz. bu dosyada ~1432. satır) aynı desen uygulanıyor.
    const __socialGroupHubInit = () => {
        if (typeof IS_CONFIGURED !== 'undefined' && !IS_CONFIGURED) return;

        const groupJoinInput = document.getElementById("group-join-input");
        const groupJoinBtn = document.getElementById("group-join-btn");
        const groupCreateModalBtn = document.getElementById("group-create-modal-btn");
        const myGroupsContainer = document.getElementById("my-groups-container");

        // ========================================================
        // PREMIUM GRUP MODAL KONTROLLERİ
        // ========================================================
        const pModal = document.getElementById("premium-create-group-modal");
        const closePModal = document.getElementById("close-premium-group-modal");
        const cancelPBtn = document.getElementById("cancel-premium-group-btn");
        const savePBtn = document.getElementById("save-premium-group-btn");

       // Modal Aç (Çift Açılmayı Önleyen Güvenli Sürüm) — hem hub'daki buton hem de
       // "Ekle" menüsündeki "Grup Kur" (social-arena-chips.js) aynı gating'i uygulasın
       // diye window köprüsüne çıkarıldı (premium olmayan kullanıcı sınıf/iş yeri grubu
       // kuramamalı — daha önce sadece bu buton üzerinden zorlanıyordu, diğer giriş
       // noktası gating'i atlıyordu).
       window.openPremiumGroupCreateModal = () => {
        // Güncel kullanıcıyı yerel hafızadan tekrar doğrula
        if (!getCurrentUser()) {
            setCurrentUser(getSavedUser());
        }

        if (!getCurrentUser()) {
            window.dcShowToast("Grup kurabilmek için önce bir topluluk profili oluşturmalısınız!");
            return;
        }

        // Kurum türü seçeneklerini plana göre ayarla: premium olmayan VE kurumsal
        // rolü (öğretmen/öğrenci) olmayan kullanıcı yalnızca "Genel Odak Grubu"
        // görsün (sınıf/iş yeri kurumsal özelliktir). Öğretmen rolündeki hesap
        // zaten kurumsal katmanda sayılır, ayrıca premium olması gerekmez.
        const classroomTypeSelectEl = document.getElementById("premium-group-classroom-type");
        if (classroomTypeSelectEl) {
            const isPremium = getCurrentUser().plan === 'premium';
            const isInstitutional = ['student', 'teacher'].includes(getCurrentUser().institutionRole);
            const canUseInstitutionalTypes = isPremium || isInstitutional;
            classroomTypeSelectEl.querySelectorAll('option').forEach(opt => {
                opt.hidden = !canUseInstitutionalTypes && opt.value !== 'general';
            });
            classroomTypeSelectEl.value = 'general';
            classroomTypeSelectEl.dispatchEvent(new Event('change'));
        }

        // Modalı sadece görünür yap, içindeki elementlere müdahale etme
        pModal?.classList.remove("hidden");
       };

       groupCreateModalBtn?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        window.openPremiumGroupCreateModal();
    });

        // Modal Kapat fonksiyonları
        closePModal?.addEventListener("click", () => pModal?.classList.add("hidden"));

        // ========================================================
        // KURUMUM MODALI (yalnızca öğretmen rolündeki hesaplarda görünür)
        // ========================================================
        const myInstitutionBtn = document.getElementById("my-institution-modal-btn");
        const myInstitutionModal = document.getElementById("my-institution-modal");
        const closeMyInstitutionModal = document.getElementById("close-my-institution-modal");
        myInstitutionBtn?.addEventListener("click", () => {
            myInstitutionModal?.classList.remove("hidden");
            window.renderMyInstitutionModal();
        });
        closeMyInstitutionModal?.addEventListener("click", () => myInstitutionModal?.classList.add("hidden"));

        // ========================================================
        // KEŞFET MODALI KONTROLLERİ
        // ========================================================
        const discoverModalBtn = document.getElementById("group-discover-modal-btn");
        const discoverModal = document.getElementById("group-discover-modal");
        const closeDiscoverModal = document.getElementById("close-group-discover-modal");
        discoverModalBtn?.addEventListener("click", () => {
            discoverModal?.classList.remove("hidden");
            if (cachedDiscoverGroupsSnapshot) {
                computeUserInterestCategoriesSupabase();
                renderDiscoverGroups();
            }
        });
        closeDiscoverModal?.addEventListener("click", () => discoverModal?.classList.add("hidden"));
        discoverModal?.addEventListener("click", (e) => { if (e.target === discoverModal) discoverModal.classList.add("hidden"); });

        // GRUBA DAVET MODALI KONTROLLERİ + PREMIUM GRUP MODAL erişim türü/alan/sayaç
        // kontrolleri → social-group-modal-setup.js dosyasına taşındı (Faz H devamı).
        setupGroupModalControls();
        cancelPBtn?.addEventListener("click", () => pModal?.classList.add("hidden"));

        // PREMIUM SEVİYE GRUP OLUŞTURMA VE YAZMA (FIREBASE)
        savePBtn?.addEventListener("click", async () => {
            // Güncel kullanıcıyı yerel hafızadan tekrar doğrula (boş gelmesini önlemek için)
            if (!getCurrentUser()) {
                setCurrentUser(getSavedUser());
            }

            if (!getCurrentUser() || !getCurrentUser().username) {
                window.dcShowToast("Grup kurabilmek için önce bir topluluk profili oluşturmalısınız!");
                savePBtn.disabled = false;
                savePBtn.innerHTML = '<i class="fa-solid fa-rocket"></i> Grubu Canlıya Al';
                return;
            }

            const gClassroomTypeVal = document.getElementById("premium-group-classroom-type")?.value || "general";
            const isInstitutionalCreate = gClassroomTypeVal !== 'general';
            // Sınıf/ders veya iş yeri/ekip grubunda "Grup Adı" alanı yerini "Kurum/Okul Adı"na
            // bırakıyor — o durumda kurum adı hem grubun adı hem institutions kaydı olarak kullanılır.
            const gName = isInstitutionalCreate
                ? document.getElementById("premium-group-institution")?.value.trim()
                : document.getElementById("premium-group-name")?.value.trim();
            const gDesc = document.getElementById("premium-group-desc")?.value.trim() || "Birlikte odaklanıyoruz.";
            const gGoal = parseInt(document.getElementById("premium-group-goal")?.value) || 1000;

            if (!gName) {
                window.dcShowToast(isInstitutionalCreate ? "Kurum/okul adı boş bırakılamaz!" : "Grup adı boş bırakılamaz!");
                return;
            }

            if (!isInstitutionalCreate && gName.length > 30) {
                window.dcShowToast("Grup adı en fazla 30 karakter olabilir!");
                return;
            }

            if (isInstitutionalCreate && gName.length > 60) {
                window.dcShowToast("Kurum/okul adı en fazla 60 karakter olabilir!");
                return;
            }

            if (gDesc.length > 200) {
                window.dcShowToast("Grup açıklaması en fazla 200 karakter olabilir!");
                return;
            }

            if (gGoal < 100 || gGoal > 10000) {
                window.dcShowToast("Haftalık odak hedefi 100 ile 10.000 dakika arasında olmalıdır!");
                return;
            }

            savePBtn.disabled = true;
            savePBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Algoritmalar Çalışıyor...';

            // ── SUPABASE: grup oluşturma ──
            if (window.FocusSupabase && getCurrentUser().id) {
                const gPrivacy = document.getElementById("premium-group-privacy")?.value || "public";
                const gCategory = document.getElementById("premium-group-category")?.value || "";
                const gClassroomType = gClassroomTypeVal;
                const gInstitution = isInstitutionalCreate ? gName : null;
                try {
                    const groupData = await window.createGroupSupabase(gName, gDesc, gGoal, gPrivacy, gCategory, gClassroomType, gInstitution, null);
                    savePBtn.disabled = false;
                    savePBtn.innerHTML = '<i class="fa-solid fa-rocket"></i> Grubu Canlıya Al';
                    pModal?.classList.add("hidden");

                    // Akış içerik kararı (2026-07-05): kaldırıldı.

                    if (typeof window.loadUserGroupsForDc === 'function') window.loadUserGroupsForDc();
                    if (typeof window.setupGroupRecentConversationsSupabase === 'function') setupGroupRecentConversationsSupabase();

                    if (typeof window.dcOpenGroupPanel === 'function') window.dcOpenGroupPanel(groupData.code);
                    else window.showGroupDetails(groupData.code, groupData);
                    window.showFocusaiConfirm({
                        title: '✨ Grubunuz Yayında!',
                        desc: `Grup kodun: <b class="u-font-size-16px_letter-spacing-2px">${groupData.code}</b><br><br>Bu kod ile arkadaşlarını davet edebilirsin.`,
                        type: 'info', icon: 'fa-people-group', confirmText: 'Harika', cancelText: ''
                    });
                } catch (err) {
                    console.error("Grup kurma hatası:", err);
                    window.dcShowToast(err.message || "Grup oluşturulurken bir hata oluştu.");
                    savePBtn.disabled = false;
                    savePBtn.innerHTML = '<i class="fa-solid fa-rocket"></i> Grubu Canlıya Al';
                }
                return;
            }
        });

        // PREMIUM SEVİYE GRUBA KATILMA MOTORU
        groupJoinBtn?.addEventListener("click", async () => {
            const code = groupJoinInput?.value.trim().toUpperCase();
            if (!code || code.length !== 6) {
                window.dcShowToast("Lütfen 6 haneli geçerli bir grup kodu girin!");
                return;
            }

            if (!getCurrentUser()) {
                window.dcShowToast("Topluluk simülasyonuna katılmadan gruplara giremezsiniz!");
                return;
            }

            groupJoinBtn.disabled = true;
            groupJoinBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

            // ── SUPABASE: koda göre gruba katılma ──
            if (window.FocusSupabase && getCurrentUser().id) {
                try {
                    const result = await window.joinGroupWithCodeSupabase(code);
                    groupJoinBtn.disabled = false;
                    groupJoinBtn.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket"></i> Gruba Katıl';
                    if (groupJoinInput) groupJoinInput.value = "";

                    if (result.pending) {
                        window.dcShowToast('Bu grup katılım onayı gerektiriyor. İsteğiniz yöneticilere iletildi, onaylandığında gruba katılacaksınız.');
                        return;
                    }

                    // Akış içerik kararı (2026-07-05): kaldırıldı.
                    if (typeof window.loadUserGroupsForDc === 'function') window.loadUserGroupsForDc();
                    if (typeof window.setupGroupRecentConversationsSupabase === 'function') setupGroupRecentConversationsSupabase();
                    if (typeof showGroupWelcomeModal === 'function') {
                        showGroupWelcomeModal(code, {
                            name: result.groupRow.name,
                            description: result.groupRow.description,
                            weeklyGoal: result.groupRow.weekly_goal,
                            category: result.groupRow.category
                        });
                    }
                } catch (e) {
                    groupJoinBtn.disabled = false;
                    groupJoinBtn.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket"></i> Gruba Katıl';
                    window.dcShowToast(e.message || 'Gruba katılırken hata oluştu.');
                }
                return;
            }
        });

       // ========================================================
        // 👥 TAM SENKRONİZE (REAL-TIME) GRUP YÖNETİM MOTORU
        // ========================================================

       // 3. ÜYE OLDUĞUM GRUPLARI LİSTELEME (SENKRONİZASYON SORUNU ÇÖZÜLMÜŞ TAM REAL-TIME SÜRÜM)
       // Her grup için açılan db.ref(groups/{code}) dinleyicilerini takip eder —
       // my_groups listesi her güncellendiğinde, artık listede olmayan gruplara ait
       // eski dinleyiciler off() edilmezse hem sızıntı olur hem de o gruba ait kart
       // tekrar render edilip "boş liste" mesajıyla aynı anda görünmeye devam eder.
       let _myGroupCardRefs = {};
       // syncSidebarGroupList() de aynı my_groups yoluna kendi dinleyicisini kuruyor —
       // parametresiz .off() o yoldaki TÜM dinleyicileri sildiği için, sadece KENDİ
       // önceki callback'imizi saklayıp onu kaldırıyoruz (bkz. _sidebarMyGroupsCb).
       let _myGroupsListCb = null;

    };
    if (document.readyState === 'loading') {
        document.addEventListener("DOMContentLoaded", __socialGroupHubInit);
    } else {
        __socialGroupHubInit();
    }

    // FocusAI Çevrimiçi Bölüm - Alt Sekme Geçiş Entegrasyonu — aynı geç-yükleme
    // sorunu burada da geçerli, aynı guard uygulanıyor.
const __socialSubTabSwitchInit = () => {
    const socialTabBtns = document.querySelectorAll(".social-tab-btn");
    const socialContents = document.querySelectorAll(".social-content");

    socialTabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const targetTab = btn.getAttribute("data-social-target");

            // Aktif buton sınıfını güncelle
            socialTabBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            // Sohbet sekmesinden ayrılınca açık kalan istatistik panelini kapat
            if (targetTab !== 'tab-sohbet') {
                document.getElementById('analytics-modal')?.classList.remove('dc-panel-open');
            }

            // Sohbet alt-sekmesinden (Bireysel/Gruplar sekmesine) ayrılırken açık bir
            // DM/grup sohbeti varsa kapat — yoksa getActiveChatTarget() o sohbete
            // kilitli kalır, karşıdan gelen yeni mesajlar sessizce okundu işaretlenip
            // Son Mesajlaşmalar rozeti hiç görünmez.
            if (btn.getAttribute("data-tab") !== "sohbet" && typeof closeDcChat === 'function') {
                closeDcChat();
            }

            // Aktif içerik sayfasını göster/gizle
            socialContents.forEach(content => {
                if (content.id === targetTab) {
                    content.classList.add("active");
                    content.style.display = "block";
                } else {
                    content.classList.remove("active");
                    content.style.display = "none";
                }
            });

            // 4D: Tab geçişinde render fonksiyonlarını çağır
            const tab = btn.getAttribute("data-tab");
            const socialSection = document.getElementById('arkadaslar');
            if (socialSection) {
                socialSection.classList.toggle('sohbet-active', tab === 'sohbet' || tab === 'bireysel' || tab === 'gruplar');
            }
            if (tab === "bireysel") {
                // TEK PANEL: Bireysel = sohbet panelinin "Ana Sayfa" görünümü
                if (typeof window.dcSetMainView === 'function') window.dcSetMainView('home');
                const sidebar = document.getElementById('premium-social-sidebar');
                if (sidebar) sidebar.classList.remove('hidden-sidebar');
                if (typeof syncSidebarGroupList === "function") syncSidebarGroupList();
                if (typeof window.syncDcContactList === "function") window.syncDcContactList();
                if (typeof window.updateSbProfile === "function") window.updateSbProfile();
                if (typeof window.loadUserGroupsForDc === "function") window.loadUserGroupsForDc();
                renderLeaderboardFromCache();
            } else if (tab === "gruplar") {
                // TEK PANEL: Gruplar = aktif grubun panel görünümü
                const sidebar = document.getElementById('premium-social-sidebar');
                if (sidebar) sidebar.classList.remove('hidden-sidebar');
                if (typeof syncSidebarGroupList === "function") syncSidebarGroupList();
                if (typeof window.loadUserGroupsForDc === "function") window.loadUserGroupsForDc();
                if (typeof window.dcOpenGroupPanel === 'function') window.dcOpenGroupPanel();
                if (typeof renderMyGroups === "function") renderMyGroups();
            } else if (tab === "sohbet") {
                // Sohbet tabı açılınca panel verilerini güncelle
                if (typeof window.dcSetMainView === 'function') window.dcSetMainView('chat');
                const sidebar = document.getElementById('premium-social-sidebar');
                if (sidebar) sidebar.classList.remove('hidden-sidebar');
                if (typeof syncSidebarGroupList === "function") syncSidebarGroupList();
                if (typeof window.syncDcContactList === "function") window.syncDcContactList();
                if (typeof window.updateSbProfile === "function") window.updateSbProfile();
                if (typeof window.renderRecentConversations === "function") renderRecentConversations();
                // Grup listesini yükle (Supabase-öncelikli)
                if (typeof window.loadUserGroupsForDc === "function") window.loadUserGroupsForDc();
                if (typeof updateDcBottomProfile === "function") updateDcBottomProfile();
            }
        });
    });
};
if (document.readyState === 'loading') {
    document.addEventListener("DOMContentLoaded", __socialSubTabSwitchInit);
} else {
    __socialSubTabSwitchInit();
}


// ==========================================================================
    // SOSYAL KENAR ÇUBUĞU KAPATMA BUTONU
    // ==========================================================================
    const premiumSidebar = document.getElementById('premium-social-sidebar');
    const closeSidebarBtn = document.getElementById('close-social-sidebar-btn');

    if (closeSidebarBtn) {
        closeSidebarBtn.addEventListener('click', () => {
            // TEK PANEL: kapatma = Ana Sayfa görünümüne dön
            if (typeof closeDcChat === 'function') closeDcChat();
            if (typeof window.dcSetMainView === 'function') window.dcSetMainView('home');
            else premiumSidebar.classList.add('hidden-sidebar');
        });
    }

    // ==========================================================================
    // SOSYAL SAYFASINDAKİ "SOHBET" BUTONU → TAM PANELİ AÇAR
    // ==========================================================================

    // _openFullPanel/_switchToSohbetTab → social-chat-panel-open.js dosyasına
    // taşındı (Faz H devamı, 2026-07-31). premiumSidebar bağımlılığı orada
    // doğrudan document.getElementById ile çözülüyor.

    // Social sayfasındaki "Sohbet" butonu → tam paneli açar
    const _socialOpenChatBtn = document.getElementById('social-open-chat-btn');
    if (_socialOpenChatBtn) {
        _socialOpenChatBtn.addEventListener('click', _openFullPanel);
    }

    // ==========================================================================
    // SOHBET PANELİ FİREBASE ENTEGRASYONU VE CANLI MESAJLAŞMA MOTORU
    // ==========================================================================

    // "Sosyal > Gruplar" sekmesindeki loadMyGroups() de aynı my_groups yoluna kendi
    // dinleyicisini kuruyor — parametresiz .off() o yoldaki TÜM dinleyicileri (bu
    // fonksiyonunki dahil) sildiği için, sadece KENDİ önceki callback'imizi saklayıp
    // onu kaldırıyoruz; böylece iki dinleyici birbirini söküp canlı güncellemeyi
    // (örn. Keşfet'ten katılınca sohbet listesinin anında güncellenmesini) bozmuyor.
    let _sidebarMyGroupsCb = null;

    // syncSidebarGroupList/highlightActiveRoom → social-dc-panel-view.js dosyasına
    // taşındı (Faz H devamı, tam çıkarma turu). window.X köprüsü mevcut, gerçek
    // import da yukarıda.

    // Sohbet Odasını Açma ve Mesajları Firebase'den Canlı Dinleme

    // ── Sohbet İçi Arama + Tüm Sohbetlerde Arama (2026-07-18) → social-chat-search.js dosyasına taşındı ──────

    // ── Sohbeti Temizle Butonu (2026-07-18) → social-chat-clear.js dosyasına taşındı ──────

    // ── ÜRETKENLİK PAYLAŞMA SİSTEMİ ────────────────────────── → social-productivity-share.js dosyasına taşındı

   const sidebarActionAddBtn = document.getElementById('sidebar-action-add-btn');
   const sidebarActionInput = document.getElementById('sidebar-action-input');

   // Bu kutu artık üç işi birden yapıyor: "@kullanıcı" yazılırsa arkadaş ekleme,
   // 6 karakterlik bir kod yazılırsa gruba katılma, bunların hiçbiri değilse
   // (ör. bir cümle/kelime) "Tüm sohbetlerde mesaj ara" akışını açıyoruz —
   // eskiden ayrı bir buton olan bu arama artık aynı kutudan tetikleniyor.
   const GROUP_CODE_RE = /^[a-z0-9]{6}$/i;
   if (sidebarActionAddBtn && sidebarActionInput) {
       sidebarActionAddBtn.addEventListener('click', () => {
           let val = sidebarActionInput.value.trim();
           if (!val) return;

           if (val.startsWith('@')) {
               const cleanUsername = val.replace('@', '').toLowerCase().trim();
               const friendInput = document.getElementById('add-friend-input');
               const friendSearchBtn = document.getElementById('add-friend-search-btn');
               const friendModal = document.getElementById('add-friend-modal');

               if (friendInput && friendSearchBtn && friendModal) {
                   friendModal.classList.remove('hidden');
                   friendInput.value = cleanUsername;
                   sidebarActionInput.value = '';
                   friendSearchBtn.click();
               } else {
                   window.dcShowToast('Arkadaş ekleme sistemi ana sayfada bulunamadı.');
               }
           } else if (GROUP_CODE_RE.test(val)) {
               const mainJoinInput = document.getElementById('join-group-input') || document.getElementById('group-join-input');
               const mainJoinBtn = document.getElementById('join-group-btn') || document.getElementById('group-join-btn');

               if (mainJoinInput && mainJoinBtn) {
                   mainJoinInput.value = val.toUpperCase();
                   mainJoinBtn.click();
                   sidebarActionInput.value = '';
                   setTimeout(syncSidebarGroupList, 1500);
               } else {
                   window.dcShowToast('Grup katılım sistemi ana sekmede bulunamadı.');
               }
           } else if (typeof openDcGlobalSearch === 'function') {
               // Mesaj arama sohbetin parçası — sohbet yetkisi yoksa açılmaz
               // (ikon CSS ile zaten gizliydi; bu dal kapısız kalmıştı)
               if (typeof window.dcChatEnabled === 'function' && !window.dcChatEnabled()) {
                   window.dcShowToast('Mesaj arama, sohbetle birlikte Premium planda açılır.', 'info');
                   return;
               }
               openDcGlobalSearch(val);
               sidebarActionInput.value = '';
           }
       });

       sidebarActionInput.addEventListener('keydown', e => {
           if (e.key === 'Enter') { e.preventDefault(); sidebarActionAddBtn.click(); }
       });
   }





// ── SOHBET PANELİ: PROFİL GÜNCELLEME + KİŞİLER LİSTESİ (2026-07-18) → social-sidebar-profile.js dosyasına taşındı ──────


// ═══════════════════════════════════════════════════════
// 🎮  GRUP & KANAL NAVİGASYON MOTORU
// ═══════════════════════════════════════════════════════
(function() {
    'use strict';

    // Durum değişkenleri
    // dcActiveGroupCode → state/dc-active-group-code-store.js'e taşındı (Faz H
    // devamı). window.__getDcActiveGroupCode/__setDcActiveGroupCode geriye dönük
    // uyumluluk için korunuyor (social-server-tree.js kullanıyor).
    window.__getDcActiveGroupCode = () => getDcActiveGroupCode();
    window.__setDcActiveGroupCode = (v) => setDcActiveGroupCode(v);
    // dcActiveRoomId → getDcState().roomId ile aynı değeri tuttuğu için (bare
    // kopya) kaldırıldı; tek kaynak artık getDcState().roomId (Faz H devamı).
    // Dışarıdan erişim için window'a bağla
    setDcState({ groupCode: null, roomId: 'general', chanId: null });
    let dcContactsUsersRef = null; // Kişi listesindeki çevrimiçi durumların canlı takibi
    let dcContactsUsersCb  = null; // ref.off() argümansız çağrılırsa AYNI yoldaki (focusai_community/users)
                                    // diğer dinleyicileri (ör. subscribeOnlineFriends) de siler — bu yüzden
                                    // sadece kendi callback'imizi off() ile kaldırıyoruz.
    const openCategories  = new Set();
    // _dcLeaveBtnAC → social-dc-panel-view.js dosyasına taşındı (showRoomLeaveBar
    // ile birlikte, Faz H devamı, tam çıkarma turu).
    // _dcInputAbortController → social-dc-room-lifecycle.js dosyasına taşındı
    // (Faz H devamı, 2026-07-30) — tek yazar/okuyucu oradaki fonksiyonlardı.

    // ─── UÇTAN UCA ŞİFRELEME (E2E) ───────────────────────────────────────
    // social-e2e.js dosyasına taşındı (isE2ESupported, getOrCreateE2EKeyPair,
    // getOtherE2EPublicKey, getDmSharedKey, encryptDmText, window.decryptDmText).

    // ─── SUPABASE PROFİL ÇÖZÜMLEME + MESAJ NORMALİZE → social-dc-profile-resolve.js
    // dosyasına taşındı (Faz E, 2026-07-23). _resolveProfileByUsername/
    // _resolveProfileById/_fetchDcReactionsMap/_normalizeSupabaseMessageBase/
    // _normalizeSupabaseDmMessage/_normalizeSupabaseGroupMessage window.X
    // olarak erişilebilir.
    // Aynı kişiden bu süre içinde gelen ardışık mesajlar avatar/isim tekrarı olmadan gruplanır
    const DC_MSG_GROUP_WINDOW_MS = 5 * 60 * 1000; // 5 dakika

    // ─── YANITLA + MESAJ SEÇME / İLETME / KOPYALAMA ─────────
    // getDcCurrentRole()/getDcSelectedKeys()/getDcMsgRegistry() → state/dc-message-render-store.js
    // dosyasına taşındı (Faz H devamı). window.__getDcSelectedKeys/window.__getDcMsgRegistry
    // geriye dönük uyumluluk için korunuyor.
    window.__getDcSelectedKeys = () => getDcSelectedKeys(); // social-dc-msg-selection.js için
    // social-typing-read-receipts.js ile paylaşımlı (salt-okunur — sadece property okuyor)
    window.__getDcMsgRegistry = () => getDcMsgRegistry();
    // Tüm sohbetlerde arama için: path -> { meta: {...}, msgs: { key: m } }
    let _dcGlobalMsgCache = {};
    setDcGlobalMsgCache(_dcGlobalMsgCache);
    let _dcCurrentDmTarget = null;      // { username, displayName } — açık DM hedefi (ilet hedefi seçiminde hariç tutulur)
    // _dcRoomPresenceRef → social-dc-room-lifecycle.js dosyasına taşındı (Faz H devamı).
    let _dcOutgoingDmRequestRef = null;     // Arkadaş olmayan DM hedefine gönderdiğimiz mesaj isteğinin durum dinleyicisi
    let _dcOutgoingDmRequestStatus = null;  // null | 'pending' | 'accepted' — arkadaş olmayan DM hedefine mesaj isteği durumu

    // ─── ESKİ MESAJLARI GEÇ YÜKLEME (LAZY LOAD) ─────────────
    // getDcLoadingMore()/getDcOldestCreatedAt() → state/dc-message-render-store.js dosyasına taşındı.

    // ─── SUPABASE GRUP SOHBETİ (M2b-3 Bölüm 1) ──────────────
    // ─── SUPABASE KANAL/ALT-KANAL AĞACI (M2b-3 Bölüm 2) ─────
    // _dcCurrentGroupScope → state/dc-current-group-scope-store.js dosyasındaki
    // getDcCurrentGroupScope()/setDcCurrentGroupScope() üzerinden okunuyor/yazılıyor
    // (Faz H devamı — eskiden bare değişken + store paralel tutuluyordu).
    // social-typing-read-receipts.js ile paylaşımlı (salt-okunur)
    window.__getDcCurrentGroupScope = () => getDcCurrentGroupScope();
    // _dcSupabaseChannelTreeChannel → state/dc-channel-tree-store.js'e taşındı
    // (Faz H devamı). window.__get/__set köprüsü geriye dönük uyumluluk için
    // korunuyor (social-server-tree.js kullanıyor).
    window.__getDcSupabaseChannelTreeChannel = () => getDcChannelTreeChannel();
    window.__setDcSupabaseChannelTreeChannel = (v) => setDcChannelTreeChannel(v);

    // Supabase grup üyeliğinde basit yönetim yetkisi (M2b-4'e kadar: sadece 'admin')
    // _isSupabaseGroupAdmin → social-dc-group-admin.js dosyasına taşındı.

    // ─── SUPABASE DM OTURUMU (M2b-1) ────────────────────────
    // getDcCurrentConversation()/getDcCurrentOtherProfile() → state/dc-message-render-store.js dosyasına taşındı.
    // social-typing-read-receipts.js ile paylaşımlı (salt-okunur)
    window.__getDcCurrentConversation = () => getDcCurrentConversation();
    // _dcSupabaseMsgChannel → social-dc-room-lifecycle.js dosyasına taşındı (Faz H devamı).
    // _dcPinnedChannel/_dcPinnedConversationId/_dcPinnedScope/_dcPinnedRef/
    // _dcPinnedPath/_dcPinnedMsgs/_dcPinnedIndex → social-message-pins.js
    // dosyasına taşındı (Faz 2, 2026-07-19).

    // ─── SALT-OKUNUR SOHBET BAĞLAMI KÖPRÜSÜ ─────────────────
    // Ayrılan modüllerin (örn. social-message-pins.js) bu değişkenleri
    // window.*'a taşımadan (yüzlerce iç kullanım noktasını değiştirmeye
    // gerek kalmadan) okuyabilmesi için. Fonksiyon her çağrıldığında GÜNCEL
    // değerleri döner (closure) — bunlar hiçbir zaman ayrılan modüller
    // tarafından yazılmıyor, sadece social.js içinde mutasyona uğruyor.
    // _dcGetChatContext → social-dc-chat-context.js dosyasına taşındı.
    // window._dcGetChatContext köprüsü orada kuruluyor, gerçek import da orada.

    // _dcReactionsChannel/teardownDcSupabaseDmChannels → social-dc-room-lifecycle.js
    // dosyasına taşındı (Faz H devamı, 2026-07-30). window.teardownDcSupabaseDmChannels
    // köprüsü mevcut; social.js içinde artık bare çağrısı kalmadı (tek çağıranlar
    // aynı taşınan fonksiyonlardı).

    // ─── ANİMASYON / İLK YÜKLEME TAKİBİ ─────────────────────
    // getDcRenderedKeys() → state/dc-message-render-store.js dosyasına taşındı.

    // ─── SADECE BENDEN SİL — social-chat-local-delete.js dosyasına
    // taşındı (Faz 2, 2026-07-19). window.dcGetClearedAt/dcSetClearedAt/
    // window.dcGetDeletedForMe/window.dcAddDeletedForMe üzerinden erişiliyor.

    // ─── YAZIYOR... GÖSTERGESİ → social-typing-read-receipts.js dosyasına
    // taşındı (Faz 6). _dcTypingMyRef/_dcTypingListenRef/_dcTypingTimeout
    // sadece o dosyada kullanılıyor, buraya taşınmadı.
    // _dcSubtitleDefault → social-dc-room-lifecycle.js dosyasına taşındı (Faz H
    // devamı). window.__getDcSubtitleDefault köprüsü artık orada tanımlı.

    // ─── OKUNDU BİLGİSİ → social-typing-read-receipts.js dosyasına taşındı
    // (Faz 6). _dcReadListenRef/_dcReadPath sadece o dosyada kullanılıyor.

    // ─── OKUNDU BİLGİSİ (GRUP) → social-typing-read-receipts.js dosyasına
    // taşındı (Faz 6). _dcGroupReadListenRef/_dcGroupReadPath/_dcGroupLastRead/
    // _dcUserInfoCache sadece o dosyada kullanılıyor.

    // ─── OKUNMAMIŞ AYIRACI / HIZLI ATLAMA ──────────────────
    // _dcOpenLastRead → sadece openDcDmRoom içinde kullanıldığı için o
    // fonksiyonla birlikte social-dc-room-lifecycle.js dosyasına taşındı
    // (yerel değişken oldu, artık social.js seviyesinde tutulmuyor).

    // ─── SABİTLENMİŞ MESAJLAR ───────────────────────────────
    // _dcPinnedRef/_dcPinnedPath/_dcPinnedMsgs/_dcPinnedIndex → social-message-pins.js

    // Firebase kaldırıldı — her zaman null döner; tüm `if (!database)` guard'ları bu sayede sağlıklı çalışır
    // getDB/getUser/dcAvatar → social-misc-pure-utils.js'e taşındı (window köprüsü orada kuruluyor).

    // ─── PANEL GEÇİŞLERİ ────────────────────────────────
    // showHomePanel/dcSetMainView/dcOpenGroupPanel/showGuildPanel/showRoomLeaveBar/
    // window.__dcCloseChatIfGroup (+ _syncFocusReturnMiniBtn/syncSidebarGroupList/
    // highlightActiveRoom) → social-dc-panel-view.js dosyasına taşındı (Faz H
    // devamı, tam çıkarma turu, 2026-07-30). window.X köprüsü mevcut, gerçek
    // import da yukarıda. Bu fonksiyonların DOM event listener kayıtları
    // (dc-nav-home, dc-guild-panel-nav, dc-dock-leave-room-btn, dock popup,
    // pdm-upgrade-btn vb.) da o dosyada.

    // ─── ÇALIŞMA ODASI ÖNİZLEMESİ + SOHBET ODASINI AÇ (channelId opsiyonel) →
    // social-dc-open-room.js dosyasına taşındı (Faz H devamı, 2026-07-30).
    // showDcRoomPreview/openDcChatRoom window.X köprüsüyle erişilebilir,
    // gerçek import da yukarıda mevcut.

    // M2c: Bildirim panelindeki grup @bahsetme bildirimine tıklanınca ilgili
    // kanala/alt-kanala gider (scopeType/scopeId, mention bildirim payload'unda saklanır).
    // openGroupMentionNotif -> social-group-mention-notif.js dosyasına taşındı.

    // ─── GRUP SOHBETİ (SUPABASE) + sendGroupMessageSupabase → social-dc-room-lifecycle.js
    // dosyasına taşındı (Faz H devamı, 2026-07-30). openDcGroupChannelSupabase
    // window.X köprüsüyle erişilebilir, gerçek import da aşağıda mevcut.

    // ─── BAĞLANTI DURUMU BANDI & RECONNECT GAP-FILL ─────────────
    // İnternet kopunca üstte bant gösterir; bağlantı gelince açık sohbeti
    // yeniden açarak (realtime kanalları tazelenir) kaçan mesajları doldurur.
    // _dcLastOpenArgs → social-dc-room-lifecycle.js dosyasına taşındı (Faz H
    // devamı). window._dcGetLastOpenArgs köprüsü artık orada tanımlı.

    // ─── SON AÇIK SOHBETİ HATIRLA (sayfa yenileme restorasyonu) →
    // social-dc-open-room.js dosyasına taşındı (Faz H devamı, 2026-07-30).
    // _dcRestoreEnteredRoomOnLoad/_dcRestoreLastOpenOnLoad/_dcRestoreEnteredRoomIfNeeded
    // IIFE olarak orada kendiliğinden çalışıyor, dışarıdan çağrılmıyor.
    // _dcPersistLastOpen/_dcClearLastOpen/_dcPersistEnteredRoom/_dcClearEnteredRoom
    // → social-dc-last-open-storage.js'e taşındı (Faz O).

    // ─── BAĞLANTI DURUMU BANNER'I + RECONNECT GAP-FILL → social-conn-status.js
    // dosyasına taşındı (Faz E, 2026-07-23). Tamamen izole, dışarıdan
    // çağrılmıyor (sadece online/offline event listener'ları).

    // ─── DM ODASINI AÇ → social-dc-room-lifecycle.js dosyasına taşındı (Faz H
    // devamı, 2026-07-30). openDcDmRoom window.X köprüsüyle erişilebilir,
    // gerçek import da aşağıda mevcut.

    // ensureDcLoadMoreBtn/loadOlderDcMessages/loadOlderDmMessagesSupabase/
    // loadOlderGroupMessagesSupabase/dcJumpToMessage → social-dc-pagination.js
    // dosyasına taşındı (Faz H devamı, 2026-07-30). window.X köprüsü mevcut.


    // ─── "YENİ MESAJLAR" AYIRACI + OKUNMAMIŞA HIZLI ATLAMA BUTONU (2026-07-18) → social-unread-divider.js dosyasına taşındı ──────

    // ─── SABİTLENMİŞ MESAJLAR ───────────────────────────────
    // ─── SABİTLENMİŞ MESAJLAR ───────────────────────────────
    // dcPinnedPathFor / teardownDcPinned / setupDcPinned /
    // teardownDmPinnedSupabase / refreshDmPinned / setupDmPinnedSupabase /
    // teardownGroupPinnedSupabase / refreshGroupPinned /
    // setupGroupPinnedSupabase / toggleDcPinMessage / renderDcPinnedBanner
    // → social-message-pins.js dosyasına taşındı (Faz 2, 2026-07-19).
    // window._dcGetChatContext() üzerinden salt-okunur sohbet bağlamı
    // okuyor, window.* üzerinden çağrılıyor.

    // ─── MESAJ RENDER — ÖZEL KART/SİSTEM MESAJI ALT-FONKSİYONLARI →
    // social-dc-message-cards.js dosyasına taşındı (Faz E, 2026-07-23 —
    // riskli bölge denemesi). _renderDcCwRoomInviteCard/_renderDcSystemJoinCard/
    // _renderDcSystemNotice/_renderDcRoleChangeNotice window.X olarak
    // erişilebilir.

    // renderDcMessage'ın alt-blokları (buildDcMsgHoverActions/fillDcMsgTextBody/
    // buildDcMsgReactionsBar/renderDcMessage) → social-dc-message-render.js
    // dosyasına taşındı (Faz H devamı, 2026-07-30). Gerçek import ile erişiliyor
    // (yukarıda), ayrıca window.X köprüsü de mevcut.

    // startDcMsgEdit/deleteDcMsg → social-dc-message-mutate.js dosyasına
    // taşındı (Faz H devamı, 2026-07-30). window.X köprüsü mevcut.


    // ─── ÇEVRİMİÇİ DURUM NOKTASI + TARİH AYIRICILAR → social-dc-online-status.js
    // dosyasına taşındı (Faz E, 2026-07-23). subscribeDcOnlineStatus/
    // updateDcStatusDots/dcFormatDateSeparator/dcRebuildDateSeparators
    // window.X olarak erişilebilir.

    // ─── MESAJ TEPKİ (REAKSİYON) PICKER ───────────────────
    // Tam emoji seçici — kompozisyon kutusundakiyle aynı emoji grupları kullanılır
    // ─── YANITLA + MESAJ TEPKİLERİ → social-dc-reply-reactions.js dosyasına
    // taşındı (Faz H devamı, 2026-07-30). openDcMsgReactionPicker/
    // toggleDcMsgReaction/initiateDcReply/cancelDcReply gerçek import ile
    // erişilebilir (yukarıda), ayrıca window.X köprüsü de mevcut.

    // ─── EMOJİ PICKER ───────────────────────────────────
    // social-emoji-picker.js dosyasına taşındı (Faz 2, 2026-07-19) — sıfır
    // paylaşılan sohbet-state bağımlılığı olduğu için temiz ayrılabildi.
    // DC_EMOJI_GROUPS ve initDcEmojiPicker artık window.* üzerinden erişiliyor.

    // ─── @BAHSETME OTO-TAMAMLAMA → social-dc-mentions.js dosyasına taşındı
    // (Faz E, 2026-07-23). getDcMentionableNames/setupDcMentionAutocomplete/
    // parseDcMentions window.X olarak erişilebilir.

    // ─── TASLAK KAYDI + SPAM/RATE-LIMIT KORUMASI → social-dc-draft.js
    // dosyasına taşındı (Faz E, 2026-07-23). saveDcDraft/restoreDcDraft/
    // clearDcDraft/canSendDcMessage window.X olarak erişilebilir.


    // ─── SOHBET TEMALARI/GÖRÜNÜM AYARLARI → social-dc-chat-theme.js dosyasına
    // taşındı (Faz E, 2026-07-23). Renk/duvar kağıdı/balon şekli/yazı boyutu-
    // tipi/kompakt mod — initDcChatTheme() window.X olarak erişilebilir.

    // ─── YÜKLENİYOR İSKELETİ ───────────────────────────────
    // showDcSkeleton/_dcRoomMsgCounts/setupDcScrollButton/dcHandleScrollAfterRender
    // → social-dc-scroll-skeleton.js dosyasına taşındı.

    // dcIsNearBottom → social-dc-scroll-utils.js'e taşındı (Faz O). window.*
    // köprüsü de o dosyada (social-chat-extras.js hâlâ window.* üzerinden çağırıyor).

    // YAZIYOR... GÖSTERGESİ / OKUNDU BİLGİSİ → social-typing-read-receipts.js dosyasına taşındı (Faz 6)

    // ─── YANITLA: input üstünde önizleme çubuğu → social-dc-reply-reactions.js
    // dosyasına taşındı (Faz H devamı, 2026-07-30). initiateDcReply/
    // cancelDcReply gerçek import ile erişilebilir (yukarıda).

    // ─── ALINTILANAN MESAJA GİT ──────────────────────────
    // jumpToDcMsg → social-dc-scroll-utils.js'e taşındı (Faz O). window.*
    // köprüsü de o dosyada.

    // ─── MESAJ SEÇİMİ (kopyala/toplu-sil araç çubuğu) → social-dc-msg-selection.js
    // dosyasına taşındı (Faz E, 2026-07-23). toggleDcMsgSelection/
    // clearDcSelection window.X olarak erişilebilir.

    // openDcForwardPicker/forwardDcMessagesTo kaldırıldı (sadeleştirme kararı,
    // 2026-07-02): mesaj iletme özelliği ürün kimliğiyle çelişiyordu.

    // ─── GERİ ALINABİLİR TOAST + ONAY PENCERELERİ → social-dc-confirm-toasts.js
    // dosyasına taşındı (Faz E, 2026-07-23). dcShowUndoToast/dcShowConfirm/
    // dcShowDeleteChoice + DC_DELETE_FOR_EVERYONE_LIMIT_MS window.X olarak
    // erişilebilir.

    // ─── SOHBET KAPAT / DİNLEYİCİLERİ TEMİZLE → social-dc-room-lifecycle.js
    // dosyasına taşındı (Faz H devamı, 2026-07-30).
    // closeDcChat/teardownDcMembersSupabase/detachDcListeners window.X
    // köprüsüyle erişilebilir, gerçek import da aşağıda mevcut.

    // ──────────────────────────────────────────────────────
    // DC (SOHBET MİMARİSİ) INIT/BAĞLAMA KATMANI → social-dc-init.js dosyasına
    // taşındı (Faz E, 2026-07-23). bindAddRoomBtn/bindAddContactBtn/
    // bindAddGroupBtn/bindHomeBtn/bindBackBtn/updateDcBottomProfile/
    // initDcArchitecture/bindProfileZoneMenu/openProfileContextMenu — hepsi
    // window.X olarak erişilebilir.
    // ──────────────────────────────────────────────────────

    // ─── GENEL AYARLAR MODALI → social-settings-modal.js dosyasına taşındı
    // (Faz E, 2026-07-23). openSettingsModal(user) window.X olarak erişilebilir.

    // ─── KİŞİ LİSTESİ DOLDURMA → social-dc-contacts.js dosyasına taşındı
    // (Faz E, 2026-07-23). syncDcContactList() window.X olarak erişilebilir.

    // ── Mesajdaki ... butonuna tıklayınca profil modalını aç ──
    document.addEventListener('click', function(e) {
        const btn = e.target.closest('.chat-user-detail-trigger');
        if (!btn) return;
        e.stopPropagation();
        const uid = btn.dataset.uid;
        const uname = btn.dataset.uname;
        if (uid && uname && typeof window.openDetailedMiniProfile === 'function') {
            window.openDetailedMiniProfile(uid, uname);
        }
    });

    // DOM hazır olunca başlat
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(() => { if (typeof initDcArchitecture === 'function') initDcArchitecture(); }, 1200));
    } else {
        setTimeout(() => { if (typeof initDcArchitecture === 'function') initDcArchitecture(); }, 1200);
    }

    // Sidebar profil alanı — event delegation
    document.addEventListener('click', function(e) {
        const zone = e.target.closest('#sidebar-user-profile');
        if (!zone) return;
        e.stopPropagation();
        if (typeof openProfileContextMenu === 'function') openProfileContextMenu(zone);
    });

    // ─── DM SOHBETİNE GEÇİŞ + MİNİ PROFİL POPUP → social-dc-contacts.js
    // dosyasına taşındı (Faz E, 2026-07-23). goToDmChat/openMiniProfile
    // window.X olarak erişilebilir.

})();


// 🛡️ Duyuru Kanalı Kontrolü ve Mesaj Alanını Kilitleme Fonksiyonu →
// social-dc-open-room.js dosyasına taşındı (Faz H devamı, 2026-07-30).
// window.updateChatInputStatus köprüsüyle erişilebilir.


// 👤 DETAYLI MİNİ PROFİL FONKSİYONU (openDetailedMiniProfile) →
// social-mini-profile-popup.js dosyasına taşındı. window.openDetailedMiniProfile
// köprüsüyle erişilebilir.

})();

})();

// Diğer social-*.js modüllerinin import edebilmesi için ince sarmalayıcı export'lar.
export { getUser, getDB, _escapeHtml, _formatMessageText, _dcCreatePendingBubble, generateGroupCode, dcAvatar, _pickNewOwner };
export { _isSupabaseGroupAdmin };

// social.js'nin geri kalan window.* köprülerini de aynı şekilde dışa açan
// evrensel shim'ler (Faz P/Q mimari turu). window.NAME hem fonksiyon hem
// düz değer olabildiği için çağrı anında tipine bakılıyor — fonksiyonsa
// argümanlarla çağrılır, değilse olduğu gibi (canlı, import anındaki
// donmuş kopyası DEĞİL) döndürülür. Kullanım: import { X } from './social.js'; X() 
// hem fonksiyon çağrısı hem değer okuma için aynı şekilde çalışır.
export function FocusAISocial(...args) { const v = window.FocusAISocial; return (typeof v === "function") ? v(...args) : v; }
export function __dcCloseChatIfGroup(...args) { const v = window.__dcCloseChatIfGroup; return (typeof v === "function") ? v(...args) : v; }
export function __getActiveGroupIdRef(...args) { const v = window.__getActiveGroupIdRef; return (typeof v === "function") ? v(...args) : v; }
export function __getCurrentActiveGroupCodeRef(...args) { const v = window.__getCurrentActiveGroupCodeRef; return (typeof v === "function") ? v(...args) : v; }
export function __getCurrentChannelIsAnnouncement(...args) { const v = window.__getCurrentChannelIsAnnouncement; return (typeof v === "function") ? v(...args) : v; }
export function __getDcActiveGroupCode(...args) { const v = window.__getDcActiveGroupCode; return (typeof v === "function") ? v(...args) : v; }
export function __getDcCurrentConversation(...args) { const v = window.__getDcCurrentConversation; return (typeof v === "function") ? v(...args) : v; }
export function __getDcCurrentGroupScope(...args) { const v = window.__getDcCurrentGroupScope; return (typeof v === "function") ? v(...args) : v; }
export function __getDcMsgRegistry(...args) { const v = window.__getDcMsgRegistry; return (typeof v === "function") ? v(...args) : v; }
export function __getDcSelectedKeys(...args) { const v = window.__getDcSelectedKeys; return (typeof v === "function") ? v(...args) : v; }
export function __getDcSubtitleDefault(...args) { const v = window.__getDcSubtitleDefault; return (typeof v === "function") ? v(...args) : v; }
export function __getDcSupabaseChannelTreeChannel(...args) { const v = window.__getDcSupabaseChannelTreeChannel; return (typeof v === "function") ? v(...args) : v; }
export function __setCurrentActiveGroupCodeRef(...args) { const v = window.__setCurrentActiveGroupCodeRef; return (typeof v === "function") ? v(...args) : v; }
export function __setCurrentChannelIsAnnouncement(...args) { const v = window.__setCurrentChannelIsAnnouncement; return (typeof v === "function") ? v(...args) : v; }
export function __setDcActiveGroupCode(...args) { const v = window.__setDcActiveGroupCode; return (typeof v === "function") ? v(...args) : v; }
export function __setDcSupabaseChannelTreeChannel(...args) { const v = window.__setDcSupabaseChannelTreeChannel; return (typeof v === "function") ? v(...args) : v; }
export function _cwGetLinkedHabit(...args) { const v = window._cwGetLinkedHabit; return (typeof v === "function") ? v(...args) : v; }
export function _cwGetPartnerInfo(...args) { const v = window._cwGetPartnerInfo; return (typeof v === "function") ? v(...args) : v; }
export function _cwGetRoomChannel(...args) { const v = window._cwGetRoomChannel; return (typeof v === "function") ? v(...args) : v; }
export function _cwGetRoomId(...args) { const v = window._cwGetRoomId; return (typeof v === "function") ? v(...args) : v; }
export function _cwGetRoomIsHost(...args) { const v = window._cwGetRoomIsHost; return (typeof v === "function") ? v(...args) : v; }
export function _cwGetRoomIsSupabase(...args) { const v = window._cwGetRoomIsSupabase; return (typeof v === "function") ? v(...args) : v; }
export function _cwSetInviteMsgRef(...args) { const v = window._cwSetInviteMsgRef; return (typeof v === "function") ? v(...args) : v; }
export function _cwSetPartnerInfo(...args) { const v = window._cwSetPartnerInfo; return (typeof v === "function") ? v(...args) : v; }
export function _cwSetRoomOriginGroupScope(...args) { const v = window._cwSetRoomOriginGroupScope; return (typeof v === "function") ? v(...args) : v; }
export function _dcGetChatContext(...args) { const v = window._dcGetChatContext; return (typeof v === "function") ? v(...args) : v; }
export function _dcGetLastOpenArgs(...args) { const v = window._dcGetLastOpenArgs; return (typeof v === "function") ? v(...args) : v; }
export function _dcRestoreInvoking(...args) { const v = window._dcRestoreInvoking; return (typeof v === "function") ? v(...args) : v; }
export function _focusCurrentGroupRole(...args) { const v = window._focusCurrentGroupRole; return (typeof v === "function") ? v(...args) : v; }
export function _getSharedFocusTotalRounds(...args) { const v = window._getSharedFocusTotalRounds; return (typeof v === "function") ? v(...args) : v; }
export function _gfGetMode(...args) { const v = window._gfGetMode; return (typeof v === "function") ? v(...args) : v; }
export function _gfGetMyTask(...args) { const v = window._gfGetMyTask; return (typeof v === "function") ? v(...args) : v; }
export function _gfSetMyTask(...args) { const v = window._gfSetMyTask; return (typeof v === "function") ? v(...args) : v; }
export function _pendingAsgInnerTab(...args) { const v = window._pendingAsgInnerTab; return (typeof v === "function") ? v(...args) : v; }
export function _pendingGroupPanelGtab(...args) { const v = window._pendingGroupPanelGtab; return (typeof v === "function") ? v(...args) : v; }
export function dcOpenAssignmentTab(...args) { const v = window.dcOpenAssignmentTab; return (typeof v === "function") ? v(...args) : v; }
export function getCommunityPresenceState(...args) { const v = window.getCommunityPresenceState; return (typeof v === "function") ? v(...args) : v; }
export function loadMyGroups(...args) { const v = window.loadMyGroups; return (typeof v === "function") ? v(...args) : v; }
export function openDetailedMiniProfile(...args) { const v = window.openDetailedMiniProfile; return (typeof v === "function") ? v(...args) : v; }
export { openGroupMentionNotif };
export function renderFloatingChatBadge(...args) { const v = window.renderFloatingChatBadge; return (typeof v === "function") ? v(...args) : v; }
export { syncXP, ensureCommunityAccess, openCommunitySetupModal, startAllSocialListeners, saveUser, registerUser };
