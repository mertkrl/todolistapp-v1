// social-friends-notifications-panel-events.js
// social-friends-notifications.js'ten çıkarıldı (Faz H devamı, ikinci tur):
// renderNotificationsPanel'den ayrılan _wireNotificationsPanelEvents ve onun
// 12 bağımsız bildirim-türü wiring bloğu — hepsi window.__getX() getter'ları
// üzerinden dış state'e erişiyor, aralarında paylaşılan mutable state yok
// (sadece _ctWireCpPlanInviteNotif 'items' parametresine ihtiyaç duyuyor).
import { getFriends, saveFriends, renderNotificationsPanel, __getPendingDmRequestsSupabaseRef } from './social-friends-notifications.js';
import { getCurrentUser } from './state/current-user-store.js';
import { openSavedGroupPreview } from './social-group-discover.js';

function _ctWireFrAccept(listEl) {
    listEl.querySelectorAll('.fr-accept-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const fromUser = btn.dataset.from;
            const fromName = btn.dataset.name;

            const friends = getFriends();
            if (!friends.includes(fromUser)) {
                friends.push(fromUser);
                saveFriends(friends);
            }
            window.markFriendSince(fromUser);
            // Akış içerik kararı (2026-07-05): kaldırıldı.
            populateHabitBuddySelect();

            const supaId = window.__getPendingFriendRequestsRef()[fromUser]?._supaId;
            if (supaId && window.FocusSupabase) {
                // Supabase yolu: friendship'i accepted yap
                window.FocusSupabase.from('friendships')
                    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
                    .eq('id', supaId)
                    .then(({ error }) => { if (error) console.error('[FocusAI] arkadaşlık kabul hatası', error); });
                delete window.__getPendingFriendRequestsRef()[fromUser];
                renderNotificationsPanel();
            }

            if (typeof window.showPremiumModal === 'function') {
                window.showPremiumModal({ title: 'Yeni Arkadaş! 🎉', message: `${fromName} ile artık arkadaşsınız.`, type: 'success' });
            }
        });
    });
}
function _ctWireFrDecline(listEl) {

    listEl.querySelectorAll('.fr-decline-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const fromUser = btn.dataset.from;
            const supaId = window.__getPendingFriendRequestsRef()[fromUser]?._supaId;
            if (supaId && window.FocusSupabase) {
                window.FocusSupabase.from('friendships').delete().eq('id', supaId)
                    .then(() => {});
                delete window.__getPendingFriendRequestsRef()[fromUser];
                renderNotificationsPanel();
            }
        });
    });
}
function _ctWireNotifDismiss(listEl) {

    listEl.querySelectorAll('.notif-dismiss-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            if (window.FocusSupabase && getCurrentUser()?.id && window.__getNotificationsSupabaseRef()[id]) {
                // Optimistik silme: önce cache'den kaldır
                const backup = window.__getNotificationsSupabaseRef()[id];
                delete window.__getNotificationsSupabaseRef()[id];
                renderNotificationsPanel();
                // DB'den sil; başarısız olursa cache'e geri ekle
                const { error } = await window.FocusSupabase.from('notifications').delete().eq('id', id).eq('user_id', getCurrentUser().id);
                if (error) {
                    console.warn('[Bildirim] Silme hatası:', error.message);
                    window.__getNotificationsSupabaseRef()[id] = backup;
                    renderNotificationsPanel();
                }
            }
        });
    });
}
function _ctWireGroupInviteAccept(listEl) {

    listEl.querySelectorAll('.group-invite-accept-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            btn.disabled = true;
            const code = btn.dataset.code;
            const notifId = btn.dataset.id;
            if (!code || typeof window.joinGroupWithCode !== 'function') { btn.disabled = false; return; }
            try {
                await window.joinGroupWithCode(code);
                // Katılım başarılı (ya da onay bekliyor) — davet bildirimi artık gereksiz
                if (getCurrentUser()?.id && window.__getNotificationsSupabaseRef()[notifId]) {
                    delete window.__getNotificationsSupabaseRef()[notifId];
                    if (window.FocusSupabase) {
                        await window.FocusSupabase.from('notifications').delete().eq('id', notifId).eq('user_id', getCurrentUser().id);
                    }
                }
                renderNotificationsPanel();
            } catch (e) {
                // Grup artık mevcut değilse (silinmiş/kod geçersiz) bildirim asla kabul edilemeyecektir — temizle
                const msg = e?.message || '';
                if (msg.includes('bulunamadı') && getCurrentUser()?.id && window.__getNotificationsSupabaseRef()[notifId]) {
                    delete window.__getNotificationsSupabaseRef()[notifId];
                    if (window.FocusSupabase) {
                        await window.FocusSupabase.from('notifications').delete().eq('id', notifId).eq('user_id', getCurrentUser().id);
                    }
                    window.dcShowToast('Bu grup artık mevcut değil, davet kaldırıldı.');
                    renderNotificationsPanel();
                } else {
                    window.dcShowToast(msg || 'Gruba katılırken hata oluştu.');
                    btn.disabled = false;
                }
            }
        });
    });
}
function _ctWireGroupInviteDecline(listEl) {

    listEl.querySelectorAll('.group-invite-decline-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            btn.disabled = true;
            const notifId = btn.dataset.id;
            if (getCurrentUser()?.id && window.__getNotificationsSupabaseRef()[notifId]) {
                delete window.__getNotificationsSupabaseRef()[notifId];
                renderNotificationsPanel();
                if (window.FocusSupabase) {
                    const { error } = await window.FocusSupabase.from('notifications').delete().eq('id', notifId).eq('user_id', getCurrentUser().id);
                    if (error) console.warn('[Bildirim] Grup daveti reddedilirken silme hatası:', error.message);
                }
            }
        });
    });
}
function _ctWireInstitutionInviteAccept(listEl) {

    listEl.querySelectorAll('.institution-invite-accept-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            btn.disabled = true;
            const notifId = btn.dataset.id;
            const inviteId = btn.dataset.inviteId;
            if (!inviteId || !window.FocusSupabase) { btn.disabled = false; return; }
            const { error } = await window.FocusSupabase.rpc('accept_institution_invite', { p_invite_id: inviteId });
            if (error) {
                window.dcShowToast('Davet kabul edilemedi: ' + error.message, 'error');
                btn.disabled = false;
                return;
            }
            if (getCurrentUser()?.id && window.__getNotificationsSupabaseRef()[notifId]) {
                delete window.__getNotificationsSupabaseRef()[notifId];
                await window.FocusSupabase.from('notifications').delete().eq('id', notifId).eq('user_id', getCurrentUser().id);
            }
            window.dcShowToast('Sınıfa katıldın! 🎉', 'success');
            renderNotificationsPanel();
            if (typeof window.loadMyGroups === 'function') window.loadMyGroups();
            if (typeof window.loadUserGroupsForDc === 'function') window.loadUserGroupsForDc();
        });
    });
}
function _ctWireInstitutionInviteDecline(listEl) {

    listEl.querySelectorAll('.institution-invite-decline-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            btn.disabled = true;
            const notifId = btn.dataset.id;
            const inviteId = btn.dataset.inviteId;
            if (inviteId && window.FocusSupabase) {
                await window.FocusSupabase.from('institution_invites').update({ status: 'rejected', responded_at: new Date().toISOString() }).eq('id', inviteId);
            }
            if (getCurrentUser()?.id && window.__getNotificationsSupabaseRef()[notifId]) {
                delete window.__getNotificationsSupabaseRef()[notifId];
                await window.FocusSupabase.from('notifications').delete().eq('id', notifId).eq('user_id', getCurrentUser().id);
            }
            renderNotificationsPanel();
        });
    });
}
function _ctWireDmReqAdd(listEl) {

    listEl.querySelectorAll('.dm-req-add-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const fromUser = btn.dataset.from;
            const fromName = btn.dataset.name;

            const friends = getFriends();
            if (!friends.includes(fromUser)) {
                friends.push(fromUser);
                saveFriends(friends);
            }
            window.markFriendSince(fromUser);
            // Akış içerik kararı (2026-07-05): kaldırıldı.
            populateHabitBuddySelect();
            window._syncFriendAcceptToSupabase(fromUser);
            if (window.FocusSupabase && getCurrentUser().id && __getPendingDmRequestsSupabaseRef()[fromUser]) {
                window.FocusSupabase.from('conversations').update({ status: 'accepted' })
                    .eq('id', __getPendingDmRequestsSupabaseRef()[fromUser].conversationId);
            }

            if (typeof window.showPremiumModal === 'function') {
                window.showPremiumModal({ title: 'Yeni Arkadaş! 🎉', message: `${fromName} ile artık arkadaşsınız.`, type: 'success' });
            }
            if (typeof window.openDcDmRoom === 'function') window.openDcDmRoom(fromUser, fromName);
        });
    });
}
function _ctWireDmReqContinue(listEl) {

    listEl.querySelectorAll('.dm-req-continue-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const fromUser = btn.dataset.from;
            const fromName = btn.dataset.name;
            if (window.FocusSupabase && getCurrentUser().id && __getPendingDmRequestsSupabaseRef()[fromUser]) {
                window.FocusSupabase.from('conversations').update({ status: 'accepted' })
                    .eq('id', __getPendingDmRequestsSupabaseRef()[fromUser].conversationId);
            }
            if (typeof window.openDcDmRoom === 'function') window.openDcDmRoom(fromUser, fromName);
        });
    });
}
function _ctWireDiscoverSavedSlotNotif(listEl) {

    listEl.querySelectorAll('.discover-saved-slot-notif').forEach(el => {
        el.addEventListener('click', (e) => {
            if (e.target.closest('.notif-dismiss-btn')) return;
            if (el.dataset.lessonPlanJump === '1') {
                if (typeof window.switchTab === 'function') window.switchTab('planlama');
                return;
            }
            const groupCode = el.dataset.group;
            if (el.dataset.assignmentJump === '1' && groupCode && typeof window.dcOpenAssignmentTab === 'function') {
                window.dcOpenAssignmentTab(groupCode);
                return;
            }
            if (groupCode && typeof openSavedGroupPreview === 'function') {
                openSavedGroupPreview(groupCode);
            }
        });
    });
}
function _ctWireCpPlanInviteNotif(listEl, items) {

    listEl.querySelectorAll('.cp-plan-invite-notif').forEach(el => {
        el.addEventListener('click', (e) => {
            if (e.target.closest('.notif-dismiss-btn')) return;
            const item = items.find(it => it.key === el.dataset.id);
            if (item) window._handleCollabPlanInvite(item.info);
        });
    });
}
function _ctWireDcMentionNotif(listEl) {

    listEl.querySelectorAll('.dc-mention-notif').forEach(el => {
        el.addEventListener('click', (e) => {
            if (e.target.closest('.notif-dismiss-btn')) return;
            const { dm, from, fromName, group, scopeType, scopeId, room, channel, roomName } = el.dataset;
            if (dm === '1') {
                if (from && typeof window.openDcDmRoom === 'function') window.openDcDmRoom(from, fromName || from);
            } else if (group && scopeType && scopeId && typeof window.openGroupMentionNotif === 'function') {
                window.openGroupMentionNotif(group, scopeType, scopeId, roomName);
            } else if (group && room && typeof window.openDcChatRoom === 'function') {
                window.openDcChatRoom(group, roomName || room, room, channel || null);
            }
        });
    });
}
export function _wireNotificationsPanelEvents(listEl, items) {
    _ctWireFrAccept(listEl);
    _ctWireFrDecline(listEl);
    _ctWireNotifDismiss(listEl);
    _ctWireGroupInviteAccept(listEl);
    _ctWireGroupInviteDecline(listEl);
    _ctWireInstitutionInviteAccept(listEl);
    _ctWireInstitutionInviteDecline(listEl);
    _ctWireDmReqAdd(listEl);
    _ctWireDmReqContinue(listEl);
    _ctWireDiscoverSavedSlotNotif(listEl);
    _ctWireCpPlanInviteNotif(listEl, items);
    _ctWireDcMentionNotif(listEl);
}
