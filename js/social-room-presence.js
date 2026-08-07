// ─── ÜYE LİSTESİ / ODA PRESENCE ŞERİTLERİ ──────────────────────────
// social.js dosyasından çıkarıldı (Faz 6): sidebar üye listesi paneli,
// oda presence şeritleri (kim hangi odada), oda giriş/çıkış presence
// yönetimi.
//
// Dış bağımlılıklar (çekirdek sohbet koduna — social.js'te KALIYOR):
// - window.getMyGroupsDataCache / window.isBlockedEitherWay /
//   window.getCommunityPresenceState / window.FocusSupabase /
//   getCurrentUser() / getDcEnteredRoomKey() / getDcEnteredRoomId()
//   → zaten global
// - window.avatarImgHtml / window._escapeHtml / window.openMiniProfile /
//   getUser / window._dcClearEnteredRoom /
//   teardownWorkRoomConvoListener → zaten window.* köprülüydü
// - BUILTIN_ROLE_PERMS / window.loadGroupCustomRolesMapSupabase
//   (social-roles.js) / window.playRoomLeaveSound (social-notif-sounds.js)
//   → ayrı modüllerde zaten window'a bağlıydı ama social.js'te BARE
//   çağrılıyordu (gizli çapraz-modül bug, bu çıkarmada fark edilip düzeltildi)
// - window.teardownDcMembersSupabase / window._hideGlobalRoomBar → bu
//   çıkarmada YENİ window.* köprüsü eklendi (tanımları social.js'te kalıyor)
// - window._leaveCurrentWorkRoom → leaveCurrentWorkRoom FARKLI isimle
import { getCurrentUser } from '../state/current-user-store.js';
import { teardownWorkRoomConvoListener } from './social-dm-notifications.js';

import { getDcEnteredRoomKey, setDcEnteredRoomKey } from '../state/dc-entered-room-key-store.js';
import { getDcEnteredRoomId, setDcEnteredRoomId } from '../state/dc-entered-room-id-store.js';
import { BUILTIN_ROLE_PERMS, loadGroupCustomRolesMapSupabase } from './social-roles.js';
import { getUser } from './social-misc-pure-utils.js';
//   (önceden) köprülenmişti, bu isim korunuyor
// - window.teardownDcRoomPresenceStripChannels / window.renderRoomPresenceStrip /
//   window.startRoomPresenceSupabase → social-server-tree.js'in de kullandığı
//   köprüler (bu çıkarmayla birlikte TANIMLARI buraya taşındı, köprü isimleri
//   AYNI kaldığı için social-server-tree.js hiç değişmedi)
// - _dcMembersSupabaseChannel / _dcMembersPresenceHandler / _dcCurrentRoomPresence /
//   _dcRoomPresenceChannels → social.js'teki sohbet çekirdeğiyle PAYLAŞIMLI,
//   hepsi dışarıdan da reassign edildiği için getter+setter köprüsü kuruldu
// - _dcMemberNames → dışarıdan (social.js) sadece OKUNUYOR, salt-okunur getter
//   yeterli (not: bu dizi hiçbir yerde doldurulmuyor, halihazırda hep boş —
//   önceden var olan bir durum, bu çıkarmada davranış korunuyor)
// - _dcActiveRoomPresenceChannel / activePresenceRef → sadece bu kümede
//   kullanıldığı doğrulandı, köprü GEREKMEDİ — tanımları da buraya taşındı
    let activePresenceRef = null; // Aktif oda presence dinleyicisi
    let _dcActiveRoomPresenceChannel = null; // Şu an girilmiş Supabase odasının presence kanalı
    window.__getDcActiveRoomPresenceChannel = () => _dcActiveRoomPresenceChannel; // social-server-tree.js'in presence-strip senk. için okuduğu köprü

    // ─── ÜYELERİ YÜKLE ──────────────────────────────────
    let _dcMemberNames    = [];     // En son bilinen üye listesi (Supabase üye listesi için)
    window.__getDcMemberNames = () => _dcMemberNames;

    window.loadDcMembers = loadDcMembers; // social.js (showGuildPanel) için
export function loadDcMembers(groupCode) {
        window.teardownDcMembersSupabase();

        const cachedGroup = window.getMyGroupsDataCache ? window.getMyGroupsDataCache()[groupCode] : null;
        if (window.FocusSupabase && cachedGroup && cachedGroup._supaId) {
            loadDcMembersSupabase(cachedGroup._supaId, groupCode);
            return;
        }
        // Firebase kaldırıldı — Supabase grubu değilse üye listesi gösterilemiyor
    }

    // ─── ÜYELERİ YÜKLE (Supabase) ───────────────────────
    // group_members + profiles + group_custom_roles'dan üye listesini doldurur,
    // çevrimiçi durumu 'community-presence' Realtime Presence kanalından okur.
export async function loadDcMembersSupabase(groupId, groupCode) {
        const container = document.getElementById('dc-members-list');
        const countEl   = document.getElementById('dc-online-count');
        if (!container) return;

        let latestMembers  = {}; // username → { userId, displayName, avatarColor, customAvatar, role }
        let customRolesMap = await loadGroupCustomRolesMapSupabase(groupId);

        function getRoleDisplay(roleId) {
            const builtinLabels = { admin: 'Admin', moderator: 'Mod', member: 'Üye' };
            if (builtinLabels[roleId]) return { label: builtinLabels[roleId], color: BUILTIN_ROLE_PERMS[roleId] ? BUILTIN_ROLE_PERMS[roleId].color : '636e72' };
            if (customRolesMap[roleId]) return { label: customRolesMap[roleId].name, color: customRolesMap[roleId].color || '6c5ce7' };
            return { label: 'Üye', color: '636e72' };
        }

        function isMemberOnline(userId) {
            const state = window.getCommunityPresenceState ? window.getCommunityPresenceState() : {};
            const entries = state[userId];
            return !!(entries && entries.length);
        }

        function renderMembers() {
            container.innerHTML = '';
            let onlineCount = 0;

            const sorted = Object.keys(latestMembers)
                .filter(u => !(typeof window.isBlockedEitherWay === 'function' && window.isBlockedEitherWay(u)))
                .sort((a, b) => {
                    const aOn = isMemberOnline(latestMembers[a].userId);
                    const bOn = isMemberOnline(latestMembers[b].userId);
                    return (bOn ? 1 : 0) - (aOn ? 1 : 0);
                });

            sorted.forEach(mUsername => {
                const mData = latestMembers[mUsername];
                const isOnline = isMemberOnline(mData.userId);
                if (isOnline) onlineCount++;

                const item = document.createElement('div');
                item.className = 'dc-member-item' + (isOnline ? '' : ' is-offline');
                const mRole = mData.role || 'member';
                const roleDisplay = getRoleDisplay(mRole);
                const xpValS = Number(mData.xp || 0);
                const actDetailS = xpValS ? `${xpValS} XP` : (isOnline ? 'Çevrimiçi' : 'Çevrimdışı');
                item.innerHTML = `
                    <div class="u-position-relative_flex-shrink-0">
                        ${window.avatarImgHtml({ ...mData, displayName: mData.displayName || mUsername }, 26, 'flex-shrink:0;')}
                        <span class="dc-dm-status-dot ${isOnline ? 'online' : 'offline'} u-border-color-h0f0c28" ></span>
                    </div>
                    <div class="u-flex-1_min-width-0">
                        <span class="dc-member-name u-display-block" >
                            ${window._escapeHtml(mData.displayName || mUsername)}
                            <span class="role-badge role-${mRole}">${window._escapeHtml(roleDisplay.label)}</span>
                        </span>
                        <div class="dc-member-activity-detail">${actDetailS}</div>
                    </div>
                `;
                const roleBadgeEl = item.querySelector('.role-badge');
                if (roleBadgeEl) {
                    roleBadgeEl.style.background = '#' + roleDisplay.color + '26';
                    roleBadgeEl.style.color = '#' + roleDisplay.color;
                    roleBadgeEl.style.border = '1px solid #' + roleDisplay.color + '55';
                }
                item.addEventListener('click', (e) => {
                    window.openMiniProfile(mUsername, mData, item, latestMembers[mUsername] || null);
                });
                container.appendChild(item);
            });

            if (countEl) countEl.textContent = onlineCount;
        }

        async function refreshMembers() {
            const { data: memberRows, error } = await window.FocusSupabase
                .from('group_members')
                .select('user_id, role, profiles(username, display_name, avatar_color, custom_avatar, avatar_initials)')
                .eq('group_id', groupId);

            if (error) console.error('[FocusAI] loadDcMembersSupabase / group_members hata:', error);

            const nextMembers = {};
            (memberRows || []).forEach(mr => {
                const profile = mr.profiles;
                if (!profile) return;
                nextMembers[profile.username] = {
                    userId: mr.user_id,
                    displayName: profile.display_name || profile.username,
                    avatarColor: profile.avatar_color || '6c5ce7',
                    customAvatar: profile.custom_avatar || null, avatarInitials: profile.avatar_initials || null,
                    role: mr.role || undefined
                };
            });
            latestMembers = nextMembers;
            renderMembers();
        }

        await refreshMembers();

        window.__setDcMembersPresenceHandler(() => renderMembers());
        window.addEventListener('focusai:presence-changed', window.__getDcMembersPresenceHandler());

        window.__setDcMembersSupabaseChannel(window.FocusSupabase
            .channel(`dc-members-${groupId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members', filter: `group_id=eq.${groupId}` }, () => refreshMembers())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'group_custom_roles', filter: `group_id=eq.${groupId}` }, async () => {
                customRolesMap = await loadGroupCustomRolesMapSupabase(groupId);
                renderMembers();
            })
            .subscribe());
    }
    window.loadDcMembersSupabase = loadDcMembersSupabase;

    // ─── ODA PRESENCE ŞERİTLERİ (Supabase) ──────────────
    // Sidebar'daki her oda için presenceState'i izleyen kanalları kapatır
    // (kanal ağacı yeniden render edilmeden önce çağrılır).
    window.teardownDcRoomPresenceStripChannels = teardownDcRoomPresenceStripChannels; // social-server-tree.js için
export function teardownDcRoomPresenceStripChannels() {
        if (!window.FocusSupabase) { window.__setDcRoomPresenceChannels({}); return; }
        Object.values(window.__getDcRoomPresenceChannels()).forEach(ch => {
            try { window.FocusSupabase.removeChannel(ch); } catch (_) { console.warn('[FocusAI] sessiz hata:', _); }
        });
        window.__setDcRoomPresenceChannels({});
    }

    // Bir Supabase çalışma odası presence şeridini, kanalın presenceState'ine göre render eder
    window.renderRoomPresenceStrip = renderRoomPresenceStrip; // social-server-tree.js için
export function renderRoomPresenceStrip(stripEl, channel) {
        const state = channel.presenceState();
        const keys = Object.keys(state);
        stripEl.innerHTML = '';
        stripEl.style.display = keys.length > 0 ? 'block' : 'none';
        keys.forEach(key => {
            const entries = state[key];
            if (!entries || !entries.length) return;
            const presence = entries[0];
            const isMe = getCurrentUser() && presence.user_id === getCurrentUser().id;
            const card = document.createElement('div');
            card.className = 'room-presence-card';
            card.innerHTML = `
                <div class="presence-avatar-wrap">
                    ${window.avatarImgHtml({ avatarColor: presence.avatarColor, customAvatar: presence.customAvatar, displayName: presence.displayName }, 22, '', 'class="presence-avatar"')}
                    <span class="presence-online-dot"></span>
                </div>
                <span class="presence-name">${window._escapeHtml(presence.displayName || presence.username)}${isMe ? ' <span class="presence-you-tag">ben</span>' : ''}</span>
            `;
            stripEl.appendChild(card);
        });
    }

    // Bir Supabase çalışma odasına (alt-kanal) girer: presence kanalına track() yapar
    // ve `_dcCurrentRoomPresence`'ı (mention autocomplete için) bu odanın presenceState'i ile besler.
    window.startRoomPresenceSupabase = startRoomPresenceSupabase; // social-server-tree.js için
export function startRoomPresenceSupabase(groupCode, subId) {
        if (!window.FocusSupabase || !getCurrentUser()?.id) return;

        // Önceki odadaki presence'ı kaldır (kanalı silme — sidebar şeridi onu hâlâ kullanıyor)
        if (_dcActiveRoomPresenceChannel && _dcActiveRoomPresenceChannel !== window.__getDcRoomPresenceChannels()[subId]) {
            try { _dcActiveRoomPresenceChannel.untrack(); } catch (_) { console.warn('[FocusAI] sessiz hata:', _); }
        }
        _dcActiveRoomPresenceChannel = null;

        // Sidebar şeridi için zaten açık bir kanal varsa onu yeniden kullan, yoksa yeni kur.
        // NOT: subscribe() sonrası aynı kanala yeni 'presence' callback'i eklemek hata fırlatır,
        // bu yüzden 'sync' dinleyicisi sadece kanal ilk oluşturulurken bir kez bağlanır
        // (bkz. renderSupabaseChannelGroup) — burada sadece track() çağrılır.
        let channel = window.__getDcRoomPresenceChannels()[subId];
        if (!channel) {
            channel = window.FocusSupabase.channel(`group-room-${subId}`, { config: { presence: { key: getCurrentUser().id } } });
            channel.on('presence', { event: 'sync' }, () => {
                const strip = document.querySelector(`.room-presence-strip[data-sub-id="${subId}"]`);
                if (strip) renderRoomPresenceStrip(strip, channel);
                if (_dcActiveRoomPresenceChannel === channel) {
                    const state = channel.presenceState();
                    window.__setDcCurrentRoomPresence(Object.values(state)
                        .map(entries => entries && entries[0] && entries[0].username)
                        .filter(Boolean));
                }
            });
            channel.subscribe();
            window.__getDcRoomPresenceChannels()[subId] = channel;
        }
        channel.track({
            user_id: getCurrentUser().id,
            username: getCurrentUser().username,
            displayName: getCurrentUser().displayName,
            avatarColor: getCurrentUser().avatarColor,
            customAvatar: getCurrentUser().customAvatar || null
        });
        _dcActiveRoomPresenceChannel = channel;
    }

    // Şu an girilmiş Supabase çalışma odasından presence'ı kaldırır
    function leaveCurrentWorkRoomSupabase() {
        if (_dcActiveRoomPresenceChannel) {
            try { _dcActiveRoomPresenceChannel.untrack(); } catch (_) { console.warn('[FocusAI] sessiz hata:', _); }
            _dcActiveRoomPresenceChannel = null;
        }
        window.__setDcCurrentRoomPresence([]);
    }

    // ─── ODA PRESENCE (Odada Kim Var?) ──────────────────
    // Önceki odanın presence'ını silmek için referansı sakla
    let _prevMyPresenceRef = null;

    function startRoomPresence(database, groupCode, channelId, subId, container, getUserFn) {
        if (!database) return;
        const user = getUserFn ? getUserFn() : null;
        if (!user) return;

        const presencePath = `focusai_community/groups/${groupCode}/channels/${channelId}/subChannels/${subId}/presence`;

        if (_prevMyPresenceRef) {
            _prevMyPresenceRef.remove();
            _prevMyPresenceRef = null;
        }
        if (activePresenceRef) { activePresenceRef.off(); activePresenceRef = null; }

        const myRef = database.ref(`${presencePath}/${user.username}`);
        myRef.set({
            displayName: user.displayName,
            avatarColor: user.avatarColor || '6c5ce7',
            customAvatar: user.customAvatar || null,
            online: true,
            joinedAt: Date.now()
        });
        myRef.onDisconnect().remove();
        _prevMyPresenceRef = myRef;
    }

    // Şu an girilmiş olan çalışma odasından (varsa) presence'ı kaldırır ve ilgili UI'yi
    // sıfırlar. "Ayrıl" butonuna basmadan geri/ana sayfa butonuyla çıkıldığında da
    // kullanıcının "hayalet" olarak odada görünmeye devam etmesini önler.
    function leaveCurrentWorkRoom() {
        const user = getUser();
        if (getDcEnteredRoomKey() && user) {
            const [groupCode, channelId, subId] = getDcEnteredRoomKey().split('|');
            window.playRoomLeaveSound();
            leaveCurrentWorkRoomSupabase();
        }
        if (_prevMyPresenceRef) {
            _prevMyPresenceRef.remove();
            _prevMyPresenceRef = null;
        }
        setDcEnteredRoomId(null);
        setDcEnteredRoomKey(null);
        window._dcClearEnteredRoom();
        if (typeof teardownWorkRoomConvoListener === 'function') teardownWorkRoomConvoListener();
        const bar = document.getElementById('dc-room-leave-bar');
        if (bar) bar.style.display = 'none';
        const actionBtns = document.getElementById('dc-room-action-btns');
        if (actionBtns) actionBtns.classList.remove('visible');
        if (typeof window._hideGlobalRoomBar === 'function') window._hideGlobalRoomBar();
    }
    window._leaveCurrentWorkRoom = leaveCurrentWorkRoom;
