// Faz H devamı: social.js'ten çıkarıldı — XP/durum senkronu, grup dinleyicileri
// ve tüm gerçek zamanlı sosyal dinleyicileri başlatan orkestratör
// (syncXP/subscribeToGroup/listenMyGroups/startAllSocialListeners).
import { getCurrentUser } from '../state/current-user-store.js';
import { listenForFriendRequests, _startFriendsListenerSupabase, _startBlocksListenerSupabase, listenForFriendAcceptances, cleanOrphanedBuddyHabits, subscribeLeaderboard } from './social-friends-notifications.js';

import { setupGroupRecentConversationsSupabase } from './social-dm-notifications.js';

import { getScwTimeLeft, getIsScwRunning } from '../state/scw-timer-store.js';
import { getProductivityStats } from './social-productivity-share.js';
import { updateProfileHeader } from './social-profile-header.js';
import { dcChatEnabled, _applyChatGate } from './social-chat-gate.js';
import { ensureSeason, ensureWeeklyLeague } from './social-gamification.js';
import { listenForCWDeclines, listenForCWInvites } from './social-cw-invites.js';
import { syncSidebarGroupList } from './social-dc-panel-view.js';

window.syncXP = () => syncXP(); // Faz 5: social-group-details.js için
function syncXP() {
    if (!getCurrentUser()) return;

    const stats = getProductivityStats();

    let currentStatus = "Uzakta";
    if (typeof getIsScwRunning() !== 'undefined' && getIsScwRunning()) {
        currentStatus = "Odaklanıyor 🧠";
    } else if (typeof getScwTimeLeft() !== 'undefined' && getScwTimeLeft() < 25 * 60 && getScwTimeLeft() > 0) {
        currentStatus = "Molada ☕";
    } else {
        currentStatus = "Planlama Yapıyor 📋";
    }

    const isOnline = getCurrentUser().status !== 'offline';
    // Faz A: XP artık profiles'a client'tan yazılmıyor — tamamlanan öğeler
    // olay olarak sunucuya bildirilir, miktarı sunucu belirler (award_xp).
    if (window.FocusXP) { window.FocusXP.scan(); window.FocusXP.flushSoon(); }

    // Faz B (127_server_presence_stats.sql): focus_streak/completed_today/
    // completed_goals artık client'tan yazılamıyor (profiles_protect_columns
    // trigger'ı korur) — sunucu bu değerleri xp_events/goals'tan yeniden
    // hesaplayıp yazar. focus_min hâlâ client beyanı (051'deki bilinen sınır).
    if (window.FocusSupabase && getCurrentUser().id) {
        window.FocusSupabase.rpc('sync_presence_stats', { p_status: currentStatus }).then(({ error }) => {
            if (error) console.error('[FocusAI Social] sync_presence_stats hatası:', error.message);
        });
        window.FocusSupabase.from('profiles').update({
            focus_min: stats.focusMin
        }).eq('id', getCurrentUser().id).then(({ error }) => {
            if (error) console.error('[FocusAI Social] syncXP hatası:', error.message);
        });
    }

    // DOM'u hemen güncelle — hard reload gerekmez
    updateProfileHeader();
    if (typeof window.updateSbProfile === 'function') window.updateSbProfile();
}

let activeGroupKey = null;

function subscribeToGroup(groupKey) {
    if (!groupKey) return;

    if (window.FocusSupabase && getCurrentUser()?.id) {
        activeGroupKey = groupKey;
        // Grup verilerini Supabase'den çek
        window.FocusSupabase.from('groups').select('*').eq('id', groupKey).maybeSingle()
            .then(({ data: group }) => {
                if (!group) return;
                const _nameEl = document.getElementById('active-group-name');
                const _descEl = document.getElementById('active-group-desc');
                if (_nameEl) _nameEl.textContent = group.name + ` (${group.code})`;
                if (_descEl) _descEl.textContent = group.description || '';

                // Üyeleri çek
                window.FocusSupabase.from('group_members')
                    .select('*, profile:profiles(id, username, display_name, avatar_color)')
                    .eq('group_id', groupKey)
                    .then(({ data: members }) => {
                        const memberList = members || [];
                        const activeCountEl = document.getElementById('group-active-count');
                        if (activeCountEl) activeCountEl.textContent = `${memberList.length} Üye`;

                        let activeStudyHTML = '';
                        let totalGroupFocusMinutes = 0;
                        const _presenceState = window.getCommunityPresenceState ? window.getCommunityPresenceState() : {};

                        memberList.forEach(m => {
                            const p = m.profile || {};
                            const xp = p.xp || 0;
                            totalGroupFocusMinutes += Math.floor(xp / 10);
                            const isOnline = _presenceState && _presenceState[p.username];
                            if (isOnline) {
                                activeStudyHTML += `
                                    <div class="glass-element u-padding-12px_display-flex_align-items-center_gap-10px_bord" >
                                        ${window.avatarImgHtml(p, 30)}
                                        <div class="si-flex1">
                                            <div class="u-font-weight-600_color-hfff_font-size-12px_overflow-hidden_">${p.display_name || p.username}</div>
                                            <div class="u-font-size-10px_color-h2ed573"><i class="fa-solid fa-book-open"></i> Çalışıyor...</div>
                                        </div>
                                    </div>`;
                            }
                        });

                        const studyContainer = document.getElementById('group-study-members');
                        if (studyContainer) studyContainer.innerHTML = activeStudyHTML || '<div class="u-color-var-text-muted_font-size-13px_grid-column-1-1_text-a">Şu an odada çıt çıkmıyor, kimse çalışmıyor.</div>';

                        const weeklyGoal = group.weekly_goal || 0;
                        const percent = weeklyGoal ? Math.min(100, Math.floor((totalGroupFocusMinutes / weeklyGoal) * 100)) : 0;
                        const fillEl = document.getElementById('group-goal-fill');
                        const percentText = document.getElementById('group-goal-percent');
                        const goalText = document.getElementById('group-goal-text');
                        if (fillEl) fillEl.style.strokeDashoffset = (238.76 * (1 - percent / 100)).toFixed(2);
                        if (percentText) percentText.textContent = '%' + percent;
                        if (goalText) goalText.textContent = `${totalGroupFocusMinutes} / ${weeklyGoal} dk`;
                    });
            });
        return;
    }
}

function listenMyGroups() {
    if (!getCurrentUser()) return;
    if (window.FocusSupabase && getCurrentUser().id) return;
}

// Tüm gerçek zamanlı sosyal dinleyicileri başlatır. Sayfa açılışında (initSocial)
// ve yeni hesap oluşturulduğunda (registerUser sonrası) çağrılır — böylece yeni
// kayıt olan bir kullanıcı, sayfayı yenilemeden de arkadaşlık isteklerini,
// DM bildirimlerini ve son mesajlaşmaları canlı olarak alır.
_applyChatGate(); // yüklenme anı: giriş yoksa da sohbet kapalı başlar

function startAllSocialListeners() {
    if (!getCurrentUser()) return;
    _applyChatGate(); // rol artık biliniyor — sohbet kapısını uygula

    // Supabase: arkadaş listesi + engelleme listesini realtime dinle
    _startFriendsListenerSupabase();
    _startBlocksListenerSupabase();

    if (window.FocusSupabase && getCurrentUser().id && dcChatEnabled()) setupGroupRecentConversationsSupabase();
    window.FocusXP?.scan(); // birikmiş tamamlamaları XP olayı olarak kuyruğa al
    ensureWeeklyLeague().finally(() => { subscribeLeaderboard(); ensureSeason(); });
    // social-online-friends.js ayrı dosyaya taşındı — bkz. yukarıdaki not (typeof korumalı)
    if (typeof window.subscribeOnlineFriends === 'function') window.subscribeOnlineFriends();
    if (typeof window.renderHomeSummary === 'function') window.renderHomeSummary();
    window.scheduleFocusReminders();
    if (typeof window.listenForCWInvites === 'function') listenForCWInvites();
    if (typeof window.listenForCWDeclines === 'function') listenForCWDeclines();
    // social-buddy-habits.js ayrı dosyaya taşındı (dinamik import ile SONRA
    // yükleniyor olabilir) — typeof kontrolüyle olası yükleme sırası
    // yarışını (race condition) güvenle karşılıyoruz.
    if (typeof window.listenForBuddyHabitInvites === 'function') window.listenForBuddyHabitInvites();
    if (typeof window.listenForBuddyHabitResponses === 'function') window.listenForBuddyHabitResponses();
    if (typeof window.populateHabitBuddySelect === 'function') window.populateHabitBuddySelect();
    listenMyGroups();
    listenForFriendRequests();
    listenForFriendAcceptances();
    syncSidebarGroupList();
    setInterval(syncXP, 5 * 60 * 1000);
    // Uygulama açık kalırken hafta devrilirse (Paz→Pzt gecesi) ligi işle
    setInterval(() => ensureWeeklyLeague(), 30 * 60 * 1000);
    setTimeout(cleanOrphanedBuddyHabits, 2000);
}
window.startAllSocialListeners = startAllSocialListeners;

export { syncXP, subscribeToGroup, listenMyGroups, startAllSocialListeners };
