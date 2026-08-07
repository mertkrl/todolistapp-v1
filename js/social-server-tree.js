import { renderArenaGroupChips } from './social-arena-chips.js';
import { isChatMuted, toggleChatMuted } from './social-chat-list-actions.js';
import { teardownDcRoomPresenceStripChannels, renderRoomPresenceStrip, startRoomPresenceSupabase } from './social-room-presence.js';
import { getCurrentUser } from '../state/current-user-store.js';
import { getDcState } from '../state/dc-state-store.js';
import { getDcActiveGroupCode, setDcActiveGroupCode } from '../state/dc-active-group-code-store.js';
import { setDcCurrentRoomPresence } from '../state/dc-current-room-presence-store.js';
import { getDcChannelTreeChannel, setDcChannelTreeChannel } from '../state/dc-channel-tree-store.js';
import { getDcEnteredRoomKey, setDcEnteredRoomKey } from '../state/dc-entered-room-key-store.js';
import { getDcEnteredRoomId, setDcEnteredRoomId } from '../state/dc-entered-room-id-store.js';
import { logGroupAuditSupabase, getMemberPermissionsSupabase, openChannelPermOverridePopoverSupabase } from './social-roles.js';
import { getDB, getUser } from './social-misc-pure-utils.js';
import { openChannelContextMenu, openInlineRename } from './social-server-tree-context-menu.js';

const openCategories = new Set(); // Açık kalan kanal kategorilerini hatırlar (render'lar arası kalıcı)
// ─── SUNUCU AĞACI / KANAL NAVİGASYONU ──────────────────────────────
// social.js dosyasından çıkarıldı (Faz 6): sidebar grup ağacı render,
// kanal/alt-kanal listesi, kanal context menüsü, inline yeniden adlandırma.
//
// Dış bağımlılıklar (çekirdek sohbet koduna — social.js'te KALIYOR):
// - dcChatEnabled / getDB / getUser / showHomePanel / openDcChatRoom /
//   _escapeHtml / logGroupAuditSupabase / _isSupabaseGroupAdmin /
//   getMemberPermissionsSupabase / playRoomJoinSound /
//   openChannelPermOverridePopoverSupabase → zaten window.* köprülüydü
// - showGuildPanel / renderArenaGroupChips / openDcGroupChannelSupabase /
//   showDcRoomPreview / showRoomLeaveBar / startRoomPresenceSupabase /
//   _dcPersistEnteredRoom / renderRoomPresenceStrip /
//   teardownDcRoomPresenceStripChannels → bu çıkarmada YENİ window.*
//   köprüsü eklendi (tanımları social.js'te kalıyor)
// - leaveCurrentWorkRoom → zaten window._leaveCurrentWorkRoom olarak
//   köprülüydü (farklı isimle export edilmiş, dikkat)
// - loadDcChannels / loadUserGroupsForDc → bu dosyada tanımlı, social.js'in
//   kendisi (showGuildPanel, init akışı) window.* üzerinden çağırıyor
// - dcActiveGroupCode / currentChannelIsAnnouncement /
//   _dcSupabaseChannelTreeChannel → social.js'teki Ortak sohbet koduyla
//   PAYLAŞIMLI, her ikisi de dışarıdan reassign edildiği için getter+setter
//   köprüsü kuruldu (window.__getDcActiveGroupCode/__setDcActiveGroupCode vb.)
// - _dcRoomPresenceChannels → sadece referans üzerinden property yazılıyor,
//   salt-okunur getter (window.__getDcRoomPresenceChannels) yeterli
// - getCurrentUser() / window.FocusSupabase / window.getMyGroupsDataCache /
//   window._normalizeSupabaseGroup / window.showFocusaiConfirm /
//   window.isChatMuted / window.toggleChatMuted → zaten global
    // ─── AĞAÇ: TEK BİR GRUP SATIRI OLUŞTUR (klasörsüz ya da klasör içinde kullanılır) ───
    function _buildGroupTreeItem(g) {
        const groupEl = document.createElement('div');
        groupEl.className = 'dc-tree-group';
        groupEl.dataset.code = g.code;

        const header = document.createElement('div');
        header.className = 'dc-tree-group-header';
        header.innerHTML = `<i class="fa-solid fa-caret-right dc-tree-arrow"></i><span>${window._escapeHtml(g.name || g.code)}</span>`;

        const channelsEl = document.createElement('div');
        channelsEl.className = 'dc-tree-channels';
        channelsEl.id = `tree-channels-${g.code}`;

        // Gruba tıklayınca: genel sohbeti aç, alt kanalları aç/kapat.
        // Sohbet yetkisi yoksa (bireysel kullanıcı, Faz 2): kanal listesi
        // yerine doğrudan grup paneli (istatistik/seans/duyuru) açılır.
        header.addEventListener('click', () => {
            if (!window.dcChatEnabled()) {
                if (typeof window.dcOpenGroupPanel === 'function') window.dcOpenGroupPanel(g.code);
                return;
            }
            const isOpen = header.classList.contains('open');
            if (!isOpen) {
                header.classList.add('open', 'active-group');
                channelsEl.classList.add('open');
                loadTreeChannels(g.code, channelsEl, header);
                // Genel sohbeti aç
                openTreeChannel(g.code, 'general', 'genel', header);
            } else {
                header.classList.remove('open', 'active-group');
                channelsEl.classList.remove('open');
            }
        });

        groupEl.appendChild(header);
        groupEl.appendChild(channelsEl);
        return groupEl;
    }

    // ─── GRUP AĞACINI RENDER ET (Discord metin tarzı) ───
    // Bir kurumun (ör. "X Lisesi") birden çok sınıfı (9,10,11,12-A vb.) olabilir —
    // ama sidebar'daki "Gruplar" listesi bir kurumdan yalnızca TEK satır gösterir
    // (kurucu/en eski sınıf grubu, kurum adıyla). Diğer kardeş sınıflar sidebar'da
    // hiç görünmez; onlar yalnızca o panelin "Sınıflar/Öğrenciler → Sınıflar"
    // sekmesinde kart olarak listelenir (bkz. renderClassroomTab, allInstitutionClasses).
    function renderServerIcons(groups) {
        renderArenaGroupChips(groups); // ücretsiz görünümün çip barı aynı veriden beslenir
        const container = document.getElementById('dc-groups-tree');
        if (!container) return;
        if (!groups.length) {
            container.innerHTML = `
                <div class="dc-empty-cta-box dc-empty-cta-box--compact">
                    <div class="dc-empty-cta-sub">Henüz bir gruba katılmadın. Sana uygun çalışma gruplarını keşfet ya da kodun varsa katıl.</div>
                    <button class="dc-empty-cta-btn dc-empty-cta-btn--ghost" data-empty-cta="discover-groups">
                        <i class="fa-solid fa-earth-americas"></i> Grupları Keşfet
                    </button>
                </div>`;
            return;
        }
        container.innerHTML = '';

        const cache = typeof window.getMyGroupsDataCache === 'function' ? window.getMyGroupsDataCache() : {};
        const plainGroups = [];
        const instBuckets = {}; // key -> [{g, createdAt}, ...]
        groups.forEach(g => {
            const cached = cache[g.code];
            const key = cached?.classroomType === 'classroom' ? (cached.institutionId || cached.institutionName) : null;
            if (key) {
                (instBuckets[key] = instBuckets[key] || []).push({ g, createdAt: cached.createdAt || 0 });
            } else {
                plainGroups.push(g);
            }
        });

        plainGroups.forEach(g => container.appendChild(_buildGroupTreeItem(g)));

        Object.values(instBuckets).forEach(items => {
            // Kurumdan sidebar'a yalnızca en eski (kurucu) sınıf grubu düşer.
            const primary = items.reduce((a, b) => a.createdAt <= b.createdAt ? a : b);
            container.appendChild(_buildGroupTreeItem(primary.g));
        });
    }

    // ─── AĞAÇ: KANALLARI YÜKLE ─────────────────────────
    async function loadTreeChannels(groupCode, container, groupHeader) {
        container.innerHTML = '';
        addTreeChannelItem(container, groupCode, 'general', 'genel', groupHeader);

        // Supabase grupları için alt kanalları ekle
        if (window.FocusSupabase && getCurrentUser()?.id) {
            const groupData = typeof window.getMyGroupsDataCache === 'function'
                ? window.getMyGroupsDataCache()[groupCode] : null;
            const supaId = groupData?._supaId;
            if (supaId) {
                const { data: channels } = await window.FocusSupabase
                    .from('group_channels')
                    .select('id')
                    .eq('group_id', supaId);
                const channelIds = (channels || []).map(c => c.id);
                if (channelIds.length) {
                    const { data: subs } = await window.FocusSupabase
                        .from('group_subchannels')
                        .select('id, name')
                        .in('channel_id', channelIds)
                        .order('created_at');
                    (subs || []).forEach(sub => {
                        addTreeChannelItem(container, groupCode, sub.id, sub.name || sub.id, groupHeader);
                    });
                }
                return;
            }
        }
        // Firebase fallback
        const database = getDB();
        if (!database) return;
        database.ref(`focusai_community/groups/${groupCode}/rooms`).once('value', snap => {
            if (!snap.exists()) return;
            snap.forEach(roomSnap => {
                addTreeChannelItem(container, groupCode, roomSnap.key, roomSnap.val().name || roomSnap.key, groupHeader);
            });
        });
    }

    function addTreeChannelItem(container, groupCode, roomId, roomName, groupHeader) {
        const item = document.createElement('div');
        item.className = 'dc-tree-channel';
        item.dataset.roomId = roomId;
        item.innerHTML = `<span class="dc-tree-hash">#</span><span>${window._escapeHtml(roomName)}</span>`;
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            openTreeChannel(groupCode, roomId, roomName, groupHeader);
        });
        container.appendChild(item);
    }

    async function openTreeChannel(groupCode, roomId, roomName, groupHeader) {
        document.querySelectorAll('.dc-tree-channel.active').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.dc-tree-group-header.active-group').forEach(el => el.classList.remove('active-group'));
        if (groupHeader) groupHeader.classList.add('active-group');
        setDcActiveGroupCode(groupCode);
        const gName = groupHeader ? groupHeader.querySelector('span')?.textContent : groupCode;

        // Cache boşsa Supabase'den doldur, sonra guild paneli aç
        const cache = typeof window.getMyGroupsDataCache === 'function' ? window.getMyGroupsDataCache() : {};
        if (!cache[groupCode] && window.FocusSupabase && getCurrentUser()?.id) {
            const { data: rows } = await window.FocusSupabase
                .from('group_members')
                .select('group_id, groups(*)')
                .eq('user_id', getCurrentUser().id);
            for (const row of (rows || [])) {
                const gr = row.groups;
                if (!gr || gr.code !== groupCode) continue;
                const { data: memberRows } = await window.FocusSupabase
                    .from('group_members')
                    .select('user_id, role, class_section_id, joined_at, profiles(id, username, display_name, avatar_color, custom_avatar, avatar_initials)')
                    .eq('group_id', gr.id);
                const gd = await window._normalizeSupabaseGroup(gr, memberRows || []);
                window.getMyGroupsDataCache()[groupCode] = gd;
                break;
            }
        }

        window.showGuildPanel(groupCode, gName);
        // Supabase grubuysa openDcGroupChannelSupabase ile aç, aksi halde eski yol
        const supaGroup = typeof window.getMyGroupsDataCache === 'function'
            ? window.getMyGroupsDataCache()[groupCode] : null;
        if (supaGroup?._supaId && window.FocusSupabase) {
            window.openDcGroupChannelSupabase(groupCode, supaGroup, { type: 'group', id: supaGroup._supaId }, '# genel');
        } else {
            window.openDcChatRoom(groupCode, 'genel', 'general', null);
        }
    }

    // ─── KULLANICI GRUPLARINI YÜKle ─────────────────────
    window.loadUserGroupsForDc = () => loadUserGroupsForDc();
    function loadUserGroupsForDc() {
        // Supabase-öncelikli yol (Firebase kaldırıldı — getDB() her zaman null döner)
        if (window.FocusSupabase && getCurrentUser()?.id) {
            loadUserGroupsForDcSupabase();
            return;
        }
        // Firebase fallback (artık kullanılmıyor ama stub olarak bırakıldı)
        const database = getDB();
        const user = getUser();
        if (!database || !user) return;
        database.ref(`focusai_community/users/${user.username}/my_groups`).on('value', async snap => {
            const groupsObj = snap.val() || {};
            const groups = [];
            for (let key of Object.keys(groupsObj)) {
                const gSnap = await database.ref(`focusai_community/groups/${key}`).get();
                const gData = gSnap.val();
                if (gData) groups.push({ code: key, name: gData.name });
            }
            _finishGroupRender(groups);
        });
    }

    async function loadUserGroupsForDcSupabase() {
        if (!window.FocusSupabase || !getCurrentUser()?.id) return;
        const groups = [];
        try {
            const { data: rows, error } = await window.FocusSupabase
                .from('group_members')
                .select('group_id, groups(*)')
                .eq('user_id', getCurrentUser().id);
            if (error) { console.error('[FocusAI DC] loadUserGroupsForDcSupabase:', error); }
            for (const row of (rows || [])) {
                const groupRow = row.groups;
                if (!groupRow) continue;
                // Cache'i güncelle (varsa atla — zaten loadMyGroupsSupabase doldurmuştur)
                const _groupsCache = typeof window.getMyGroupsDataCache === 'function' ? window.getMyGroupsDataCache() : {};
                if (!_groupsCache[groupRow.code]) {
                    const { data: memberRows } = await window.FocusSupabase
                        .from('group_members')
                        .select('user_id, role, class_section_id, joined_at, profiles(id, username, display_name, avatar_color, custom_avatar, avatar_initials)')
                        .eq('group_id', groupRow.id);
                    const groupData = await window._normalizeSupabaseGroup(groupRow, memberRows || []);
                    _groupsCache[groupRow.code] = groupData;
                }
                // Duplicate kontrolü
                if (!groups.find(g => g.code === groupRow.code)) {
                    groups.push({ code: groupRow.code, name: groupRow.name });
                }
            }
        } catch (e) {
            console.error('[FocusAI DC] loadUserGroupsForDcSupabase exception:', e);
        }
        _finishGroupRender(groups);
    }

    function _finishGroupRender(groups) {
        // Şu an açık olan grup artık "Gruplarım" listesinde değilse sohbet ekranını kapat
        const openGroupCode = getDcState() && getDcState().groupCode;
        const allCodes = groups.map(g => g.code);
        if ((getDcActiveGroupCode() && !allCodes.includes(getDcActiveGroupCode())) ||
            (openGroupCode && !allCodes.includes(openGroupCode))) {
            if (typeof window._leaveCurrentWorkRoom === 'function') window._leaveCurrentWorkRoom();
            if (typeof showHomePanel === 'function') window.showHomePanel();
        }
        renderServerIcons(groups);
        const badge = document.getElementById('sb-groups-badge');
        if (badge) badge.textContent = groups.length;
    }

   // ─── KANALLARI YÜKLE ─────────────────────────────────────────
   window.loadDcChannels = loadDcChannels; // social.js (showGuildPanel) için
   function loadDcChannels(groupCode) {
    const groupData = typeof window.getMyGroupsDataCache === 'function'
        ? window.getMyGroupsDataCache()[groupCode] : null;
    const isSupabase = window.FocusSupabase && groupData?._supaId;

    // Sınıf/Ders grubunda sol panel başlıkları derse özel adlarla gösterilir
    const isClassGroup = groupData?.classroomType === 'classroom' || groupData?.classroomType === 'workplace';
    const textChannelsHeader = document.getElementById('dc-text-channels-header');
    const categoryChannelsHeader = document.getElementById('dc-category-channels-header');
    if (textChannelsHeader) textChannelsHeader.textContent = isClassGroup ? 'DUYURULAR' : 'METİN KANALLAR';
    if (categoryChannelsHeader) categoryChannelsHeader.textContent = isClassGroup ? 'DERSLER' : 'KANALLAR';

    // ── Bölüm 1: Düz metin kanallar (#genel, #duyurular …) ──
    const flatContainer = document.getElementById('dc-text-channels');
    if (flatContainer) {
        flatContainer.innerHTML = '';
        renderFlatChannelItem(flatContainer, groupCode, 'general', 'genel');
        // Supabase grupları için flat kanallar loadSupabaseGroupChannels tarafından yönetilir
    }

    // ── Bölüm 2: Kategori kanallar ──
    const catContainer = document.getElementById('dc-category-channels');
    if (catContainer) {
        catContainer.innerHTML = '';
        if (isSupabase) {
            loadSupabaseGroupChannels(groupCode, groupData, catContainer);
        }
    }
}

// Düz kanal satırı (# genel, # duyurular …)
function renderFlatChannelItem(container, groupCode, roomId, roomName) {
    if (container.querySelector(`[data-room-id="${roomId}"]`)) return;
    const chatPath = roomId === 'general'
        ? `focusai_community/groups/${groupCode}/messages`
        : `focusai_community/groups/${groupCode}/rooms/${roomId}/messages`;
    const supabaseChatPath = `supabase_group_${roomId === 'general' ? (window.getMyGroupsDataCache?.()[groupCode]?._supaId || roomId) : roomId}`;
    const muted = typeof window.isChatMuted === 'function' && isChatMuted(supabaseChatPath);
    const item = document.createElement('div');
    item.className = 'dc-channel-item' + (roomId === getDcState().roomId ? ' active' : '') + (muted ? ' is-muted' : '');
    item.dataset.roomId = roomId;
    item.innerHTML = `
        <span class="dc-ch-icon"><i class="fa-solid fa-hashtag"></i></span>
        <span class="dc-ch-name">${window._escapeHtml(roomName)}</span>
        <button class="dc-ch-more-btn u-opacity-0_background-transparent_border-none_color-rgba255" title="Seçenekler" >
            <i class="fa-solid fa-ellipsis-vertical"></i>
        </button>`;
    item.addEventListener('mouseenter', () => { const b = item.querySelector('.dc-ch-more-btn'); if(b) b.style.opacity='1'; });
    item.addEventListener('mouseleave', () => { const b = item.querySelector('.dc-ch-more-btn'); if(b) b.style.opacity='0'; });
    item.addEventListener('click', () => {
        document.querySelectorAll('.dc-channel-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
        window.openDcChatRoom(groupCode, roomName, roomId, null);
    });
    const moreBtn = item.querySelector('.dc-ch-more-btn');
    moreBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        const muteIcon = moreBtn.querySelector('i');
        openChannelContextMenu(moreBtn, {
            chatPath: supabaseChatPath,
            muteIconEl: muteIcon,
            canRename: false,
        });
    });
    container.appendChild(item);
}

    // Grup genel sohbeti (sabit, üstte)
    function renderGeneralChannelItem(container, groupCode) {
        const item = document.createElement('div');
        item.className = 'dc-channel-item';
        item.dataset.roomId = 'general';
        item.innerHTML = `<span class="dc-ch-icon"><i class="fa-solid fa-hashtag"></i></span><span class="dc-ch-name">genel</span>`;
        item.addEventListener('click', () => {
            document.querySelectorAll('.dc-channel-item').forEach(el => el.classList.remove('active'));
            item.classList.add('active');
            window.openDcChatRoom(groupCode, 'genel', 'general', null);
        });
        container.appendChild(item);
    }

    // ─── SUPABASE KANAL/ALT-KANAL AĞACI (M2b-3 Bölüm 2) ────
    async function loadSupabaseGroupChannels(groupCode, groupData, catContainer) {
        if (!window.FocusSupabase || !groupData?._supaId) return;
        const groupId = groupData._supaId;

        const render = async () => {
            const { data: channels, error } = await window.FocusSupabase
                .from('group_channels')
                .select('*')
                .eq('group_id', groupId)
                .order('position', { ascending: true });
            if (error || !channels) return;

            teardownDcRoomPresenceStripChannels();
            catContainer.querySelectorAll('.dc-channel-group').forEach(el => el.remove());

            for (const channel of channels) {
                const { data: subs } = await window.FocusSupabase
                    .from('group_subchannels')
                    .select('*')
                    .eq('channel_id', channel.id)
                    .order('position', { ascending: true });
                renderSupabaseChannelGroup(catContainer, groupCode, groupData, channel, subs || []);
            }
        };

        await render();

        if (getDcChannelTreeChannel()) {
            window.FocusSupabase.removeChannel(getDcChannelTreeChannel());
            setDcChannelTreeChannel(null);
        }
        setDcChannelTreeChannel(window.FocusSupabase
            .channel(`group-channel-tree-${groupId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'group_channels', filter: `group_id=eq.${groupId}` }, () => render())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'group_subchannels' }, () => render())
            .subscribe());
    }

    // Kanal grubu render (Supabase) — örn: "Matematik" → genel + alt kanallar
    function renderSupabaseChannelGroup(container, groupCode, groupData, channel, subchannels) {
        const channelId = channel.id;
        const channelName = channel.name || '';
        const isAdmin = window._isSupabaseGroupAdmin(groupCode);

        const group = document.createElement('div');
        group.className = 'dc-channel-group';
        group.dataset.channelId = channelId;

        const catHeader = document.createElement('div');
        catHeader.className = 'dc-category-header dc-channel-cat-header';
        catHeader.style.cursor = 'pointer';
        catHeader.innerHTML = `
            <i class="fa-solid fa-caret-right dc-category-arrow u-transition-transform0p2s" ></i>
            <span class="u-flex-1_overflow-hidden_text-overflow-ellipsis_white-space--2">${window._escapeHtml(channelName.toUpperCase())}</span>
            <button class="dc-section-add-btn dc-cat-more-btn ch-more-btn u-pointer-events-all" title="Seçenekler" >
                <i class="fa-solid fa-ellipsis-vertical"></i>
            </button>
            <button class="dc-section-add-btn dc-add-subchan-btn u-pointer-events-all" title="Alt Kanal Ekle" >
                <i class="fa-solid fa-plus"></i>
            </button>
        `;
        {
            const _catMoreBtn = catHeader.querySelector('.dc-cat-more-btn');
            if (_catMoreBtn) _catMoreBtn.style.display = isAdmin ? '' : 'none';
            const _addSubBtnEl = catHeader.querySelector('.dc-add-subchan-btn');
            if (_addSubBtnEl) _addSubBtnEl.style.display = isAdmin ? '' : 'none';
        }

        if (isAdmin) {
            const moreBtn = catHeader.querySelector('.dc-cat-more-btn');
            moreBtn?.addEventListener('click', (e) => {
                e.stopPropagation();
                const _catChatPath = `supabase_group_channel_${channelId}`;
                openChannelContextMenu(moreBtn, {
                    type: 'category',
                    chatPath: _catChatPath,
                    canDelete: true,
                    onRename: () => {
                        openInlineRename(catHeader.querySelector('span'), channelName, async (newName) => {
                            await window.FocusSupabase.from('group_channels').update({ name: newName }).eq('id', channelId);
                            logGroupAuditSupabase(groupData._supaId, 'channel_rename', `"${channelName}" kategorisi "${newName}" olarak yeniden adlandırıldı`);
                        });
                    },
                    onDelete: async () => {
                        const ok = await window.showFocusaiConfirm({
                            title: 'Kategoriyi Sil',
                            desc: `<b>${window._escapeHtml(channelName)}</b> kategorisini ve içindeki tüm odaları silmek istediğine emin misin?`,
                            type: 'danger', icon: 'fa-trash-can',
                            confirmText: 'Sil', cancelText: 'Vazgeç'
                        });
                        if (ok) {
                            await window.FocusSupabase.from('group_channels').delete().eq('id', channelId);
                            logGroupAuditSupabase(groupData._supaId, 'channel_delete', `"${channelName}" kategorisi silindi`);
                        }
                    }
                });
            });

            const addSubBtn = catHeader.querySelector('.dc-add-subchan-btn');
            addSubBtn?.addEventListener('click', (e) => {
                e.stopPropagation();
                window._dcPendingSubChanSupabase = { groupCode, channelId, channelName };
                const label = document.getElementById('subchan-modal-channel-label');
                if (label) label.textContent = channelName;
                document.getElementById('create-subchannel-modal')?.classList.remove('hidden');
            });
        }

        const subList = document.createElement('div');
        subList.id = `sublist-supa-${channelId}`;
        subList.style.display = 'none';

        const genItem = document.createElement('div');
        genItem.className = 'dc-channel-item dc-subchan-item';
        genItem.innerHTML = `<span class="dc-ch-icon si-yellow"><i class="fa-solid fa-bullhorn"></i></span><span class="dc-ch-name">genel</span>`;
        genItem.addEventListener('click', () => {
            document.querySelectorAll('.dc-channel-item').forEach(el => el.classList.remove('active'));
            genItem.classList.add('active');
            window.openDcGroupChannelSupabase(groupCode, groupData, { type: 'group_channel', id: channelId }, '# ' + channelName + ' › genel');
        });
        subList.appendChild(genItem);

        (subchannels || []).forEach(sub => {
            const isLocked = !!sub.locked;
            const isAnnouncement = !!sub.is_announcement;
            const subItem = document.createElement('div');
            subItem.className = 'dc-channel-item dc-subchan-item' + (isLocked ? ' dc-subchan-locked' : '') + (isAnnouncement ? ' dc-subchan-announcement' : '');
            subItem.dataset.subId = sub.id;
            subItem.dataset.isAnnouncement = isAnnouncement ? '1' : '0';
            subItem.innerHTML = `
                <span class="dc-ch-icon u-flex-shrink-0" >
                    <i class="fa-solid ${isAnnouncement ? 'fa-bullhorn' : 'fa-people-group'}"></i>
                </span>
                <span class="dc-ch-name u-flex-1_overflow-hidden_text-overflow-ellipsis_white-space--2" >${window._escapeHtml(sub.name || '')}</span>
                ${isAnnouncement ? '<span class="dc-subchan-announce-badge u-flex-shrink-0_font-size-9px_background-rgba2532031100p2_co" title="Duyuru kanalı — sadece yöneticiler yazabilir" >DUYURU</span>' : ''}
                ${isLocked && !isAnnouncement ? '<span class="dc-subchan-locked-badge" title="Bu odaya girmek için yetki gerekiyor" class="si-shrink0"><i class="fa-solid fa-lock"></i></span>' : ''}
                <button class="ch-more-btn u-flex-shrink-0" title="Seçenekler" >
                    <i class="fa-solid fa-ellipsis-vertical"></i>
                </button>
            `;
            subItem.querySelector('.dc-ch-icon').style.color = isAnnouncement ? '#fdcb6e' : '#74b9ff';

            // Admin olmayan kullanıcılar da ... menüsünü görsün (sadece sessize al için)
            {
                const moreBtn = subItem.querySelector('.ch-more-btn');
                if (moreBtn) moreBtn.style.display = '';
                moreBtn?.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const _subChatPath = `supabase_group_subchannel_${sub.id}`;
                    openChannelContextMenu(moreBtn, {
                        type: 'room',
                        chatPath: _subChatPath,
                        isLocked,
                        isAnnouncement,
                        canRename: isAdmin,
                        canDelete: isAdmin,
                        canLock: isAdmin,
                        canAnnouncement: isAdmin,
                        canPerm: isAdmin,
                        onRename: () => {
                            const nameSpan = subItem.querySelector('.dc-ch-name');
                            openInlineRename(nameSpan, sub.name || '', async (newName) => {
                                await window.FocusSupabase.from('group_subchannels').update({ name: newName }).eq('id', sub.id);
                                logGroupAuditSupabase(groupData._supaId, 'subchannel_rename', `"${sub.name || ''}" odası "${newName}" olarak yeniden adlandırıldı`);
                            });
                        },
                        onDelete: async () => {
                            const ok = await window.showFocusaiConfirm({
                                title: 'Odayı Sil',
                                desc: `<b>${window._escapeHtml(sub.name || '')}</b> odasını silmek istediğine emin misin? Tüm mesajlar silinecek.`,
                                type: 'danger', icon: 'fa-trash-can',
                                confirmText: 'Sil', cancelText: 'Vazgeç'
                            });
                            if (ok) {
                                await window.FocusSupabase.from('group_subchannels').delete().eq('id', sub.id);
                                logGroupAuditSupabase(groupData._supaId, 'subchannel_delete', `"${sub.name || ''}" odası silindi`);
                            }
                        },
                        onLock: async () => {
                            await window.FocusSupabase.from('group_subchannels').update({ locked: !isLocked }).eq('id', sub.id);
                            logGroupAuditSupabase(groupData._supaId, isLocked ? 'room_unlock' : 'room_lock', `"${sub.name || ''}" odasının kilidi ${isLocked ? 'açıldı' : 'kilitlendi'}`);
                        },
                        onAnnouncement: async () => {
                            const newVal = !isAnnouncement;
                            await window.FocusSupabase.from('group_subchannels').update({ is_announcement: newVal }).eq('id', sub.id);
                            logGroupAuditSupabase(groupData._supaId, newVal ? 'room_announcement_on' : 'room_announcement_off', `"${sub.name || ''}" odası ${newVal ? 'duyuru kanalı yapıldı' : 'normal odaya döndürüldü'}`);
                        },
                        onPerm: () => {
                            openChannelPermOverridePopoverSupabase(moreBtn, groupData._supaId, sub.id, sub.name || '');
                        }
                    });
                });
            }

            const roomLabel = '# ' + channelName + ' › ' + (sub.name || '');
            const roomKey   = `${groupCode}|sub|${sub.id}`;

            // Presence şeridi — odada kim var (Supabase Realtime Presence)
            const presenceStrip = document.createElement('div');
            presenceStrip.className = 'room-presence-strip';
            presenceStrip.dataset.subId = sub.id;
            presenceStrip.style.display = 'none';

            if (window.FocusSupabase && getCurrentUser()?.id) {
                const roomChannel = window.FocusSupabase.channel(`group-room-${sub.id}`, { config: { presence: { key: getCurrentUser().id } } });
                roomChannel.on('presence', { event: 'sync' }, () => {
                    renderRoomPresenceStrip(presenceStrip, roomChannel);
                    if (window.__getDcActiveRoomPresenceChannel() === roomChannel) {
                        const state = roomChannel.presenceState();
                        setDcCurrentRoomPresence(Object.values(state)
                            .map(entries => entries && entries[0] && entries[0].username)
                            .filter(Boolean));
                    }
                });
                roomChannel.subscribe();
                window.__getDcRoomPresenceChannels()[sub.id] = roomChannel;
            }

            // Kilitli bir odaya girişi engeller — kilidi açma yetkisi olmayanlar için
            const checkLockBlocks = (cb) => {
                if (!isLocked) return cb(false);
                getMemberPermissionsSupabase(groupData._supaId, getCurrentUser().id, (perms) => {
                    cb(perms.role !== 'admin' && !perms.lockRooms);
                }, { subId: sub.id });
            };

            // TEK TIKLA → sadece önizleme (sohbeti okuyamaz/yazamaz, girmesi gerekir)
            subItem.addEventListener('click', (e) => {
                e.stopPropagation();
                document.querySelectorAll('.dc-channel-item').forEach(el => el.classList.remove('active'));
                subItem.classList.add('active');
                checkLockBlocks((blocked) => {
                    if (blocked) {
                        window.showDcRoomPreview(groupCode, channelName + ' › ' + (sub.name || ''), sub.id, channelId, true);
                        return;
                    }
                    window.__setCurrentChannelIsAnnouncement(isAnnouncement);
                    if (getDcEnteredRoomKey() === roomKey) {
                        window.openDcGroupChannelSupabase(groupCode, groupData, { type: 'group_subchannel', id: sub.id, locked: isLocked, isAnnouncement }, roomLabel);
                        window.showRoomLeaveBar(sub.name || '', getDB(), groupCode, 'sub', sub.id);
                        // Sohbet yeniden açıldı — bu odanın presence durumunu (mention için) tazele
                        const activeRoomPresenceChannel = window.__getDcActiveRoomPresenceChannel();
                        if (activeRoomPresenceChannel) {
                            const state = activeRoomPresenceChannel.presenceState();
                            setDcCurrentRoomPresence(Object.values(state)
                                .map(entries => entries && entries[0] && entries[0].username)
                                .filter(Boolean));
                        }
                    } else if (getDcEnteredRoomId() === sub.id) {
                        window.__setCurrentChannelIsAnnouncement(isAnnouncement);
                        window.openDcGroupChannelSupabase(groupCode, groupData, { type: 'group_subchannel', id: sub.id, locked: isLocked, isAnnouncement }, roomLabel);
                    } else {
                        window.showDcRoomPreview(groupCode, channelName + ' › ' + (sub.name || ''), sub.id, channelId);
                    }
                });
            });

            // ÇİFT TIKLA → odaya gir (presence track + sohbeti aç + "Odadasın" çubuğu)
            subItem.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                document.querySelectorAll('.dc-channel-item').forEach(el => el.classList.remove('active'));
                subItem.classList.add('active');
                checkLockBlocks((blocked) => {
                    if (blocked) {
                        window.showDcRoomPreview(groupCode, channelName + ' › ' + (sub.name || ''), sub.id, channelId, true);
                        return;
                    }
                    window.__setCurrentChannelIsAnnouncement(isAnnouncement);
                    window.openDcGroupChannelSupabase(groupCode, groupData, { type: 'group_subchannel', id: sub.id, locked: isLocked, isAnnouncement }, roomLabel);
                    if (getDcEnteredRoomKey() !== roomKey) window.playRoomJoinSound();
                    startRoomPresenceSupabase(groupCode, sub.id);
                    window.showRoomLeaveBar(sub.name || '', getDB(), groupCode, 'sub', sub.id);
                    setDcEnteredRoomId(sub.id);
                    setDcEnteredRoomKey(roomKey);
                    window._dcPersistEnteredRoom({ groupCode, subId: sub.id, roomName: sub.name || '', channelId, locked: isLocked, isAnnouncement });
                    subItem.style.background = 'rgba(116,185,255,0.15)';
                    setTimeout(() => { subItem.style.background = ''; }, 500);
                });
            });

            subList.appendChild(subItem);
            subList.appendChild(presenceStrip);
        });

        let isOpen = openCategories.has('supa-' + channelId);
        subList.style.display = isOpen ? 'block' : 'none';
        const arrowInit = catHeader.querySelector('.dc-category-arrow');
        if (arrowInit) arrowInit.style.transform = isOpen ? 'rotate(90deg)' : '';

        catHeader.addEventListener('click', (e) => {
            if (e.target.closest('.dc-add-subchan-btn') || e.target.closest('.dc-cat-more-btn')) return;
            isOpen = !isOpen;
            if (isOpen) openCategories.add('supa-' + channelId);
            else openCategories.delete('supa-' + channelId);
            subList.style.display = isOpen ? 'block' : 'none';
            const arrow = catHeader.querySelector('.dc-category-arrow');
            if (arrow) arrow.style.transform = isOpen ? 'rotate(90deg)' : '';
        });

        group.appendChild(catHeader);
        group.appendChild(subList);
        container.appendChild(group);
    }
