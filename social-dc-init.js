// social-dc-init.js
// social.js'ten çıkarıldı (Faz E, 2026-07-23): DC (Discord-clone benzeri
// sohbet mimarisi) init/bağlama katmanı — oda/kanal/alt-kanal oluşturma
// butonları, kişi/grup ekleme butonları, ana sayfa/geri butonları, sidebar
// alt profil güncellemesi, profil context-menüsü (Profili Düzenle/Ayarlar/
// Çıkış Yap). closeDcChat/teardownDcMembersSupabase/detachDcListeners
// BİLİNÇLİ OLARAK social.js'te BIRAKILDI — bunlar sohbet çekirdeğinin
// (_dcMsgRegistry, cancelDcReply, clearDcSelection, teardownDcSupabaseDmChannels)
// paylaşılan state'ine doğrudan bağımlı, dokunulmaması gereken bölgeyle iç içe.
//
// Dış bağımlılıklar (social.js'in geri kalanından, window.* üzerinden):
// window.__getDcActiveGroupCode, window._isSupabaseGroupAdmin,
// getCurrentUser(), window._escapeHtml, window.showHomePanel,
// window.closeDcChat, window.detachDcListeners, window.openSetupModalAsEdit,
// window.openSettingsModal, dcAvatar, window.syncDcContactList,
// window.getMyGroupsDataCache, window.loadUserGroupsForDc.
// getMemberPermissions/logGroupAuditSupabase (social-roles.js) ve
// getUser/getDB (social.js, zaten window.* köprülü) gerçek global fonksiyon
// bildirimleri olduğu için bare çağrılıyor.

import { getCurrentUser } from './state/current-user-store.js';
import { getActiveChatTarget } from './state/active-chat-target-store.js';
import { getDcRestorePending } from './state/dc-restore-pending-store.js';
import { getMemberPermissions, logGroupAuditSupabase } from './social-roles.js';
import { dcAvatar } from './social-misc-pure-utils.js';
import { openProfileContextMenu } from './social-dc-profile-menu.js';
export { openProfileContextMenu };
    function bindAddRoomBtn() {
       // "+" METİN KANALLAR → düz kanal ekle (#duyurular, #genel-sohbet …)
       const btn = document.getElementById('dc-add-text-room-btn');
       if (btn) {
           btn.addEventListener('click', e => {
               e.stopPropagation();
               const user = getUser();
               if (!user) return window.dcShowToast('Giriş yapmalısınız.');
               if (!window.__getDcActiveGroupCode()) return window.dcShowToast('Önce bir grup seçin.');
               // M2d: Supabase gruplarında düz "oda" kavramı yok — sadece kategori
               // kanalları (group_channels) var. Bu yüzden Firebase tabanlı yetki
               // kontrolü Supabase gruplarında her zaman "yetkiniz yok" diyordu.
               if (window.FocusSupabase && window.getMyGroupsDataCache()[window.__getDcActiveGroupCode()]?._supaId) {
                   if (!window._isSupabaseGroupAdmin(window.__getDcActiveGroupCode())) return window.dcShowToast('Bu grupta oda/kanal oluşturma yetkiniz yok.');
                   window._dcPendingChannelCreateSupabase = true;
                   document.getElementById('create-channel-modal')?.classList.remove('hidden');
                   return;
               }
               getMemberPermissions(window.__getDcActiveGroupCode(), user.username, (perms) => {
                   if (!perms.manageRooms) return window.dcShowToast('Bu grupta oda/kanal oluşturma yetkiniz yok.');
                   document.getElementById('create-room-modal')?.classList.remove('hidden');
               });
           });
       }

       // Düz kanal oluştur — confirm
       const confirmRoomBtn = document.getElementById('btn-confirm-create-room');
       if (confirmRoomBtn) {
           confirmRoomBtn.addEventListener('click', () => {
               const nameInput = document.getElementById('new-room-name-input');
               const roomName  = nameInput?.value?.trim();
               if (!roomName) return window.dcShowToast('Kanal adı boş olamaz.');
               const database = getDB();
               const user = getUser();
               if (!database || !user || !window.__getDcActiveGroupCode()) return;
               const roomId = roomName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || ('room-' + Date.now());
               database.ref(`focusai_community/groups/${window.__getDcActiveGroupCode()}/rooms/${roomId}`).set({
                   name: roomName, createdBy: user.username, createdAt: Date.now()
               }).then(() => {
                   document.getElementById('create-room-modal')?.classList.add('hidden');
                   if (nameInput) nameInput.value = '';
               });
           });
       }

       // "+" KANALLAR bölümü → kategori kanal ekle (Matematik, Fizik …)
       const catBtn = document.getElementById('dc-add-category-btn');
       if (catBtn) {
           catBtn.addEventListener('click', e => {
               e.stopPropagation();
               const user = getUser();
               if (!user) return window.dcShowToast('Giriş yapmalısınız.');
               if (!window.__getDcActiveGroupCode()) return window.dcShowToast('Önce bir grup seçin.');
               if (window.FocusSupabase && window.getMyGroupsDataCache()[window.__getDcActiveGroupCode()]?._supaId) {
                   if (!window._isSupabaseGroupAdmin(window.__getDcActiveGroupCode())) return window.dcShowToast('Bu grupta kategori oluşturma yetkiniz yok.');
                   window._dcPendingChannelCreateSupabase = true;
                   document.getElementById('create-channel-modal')?.classList.remove('hidden');
                   return;
               }
               getMemberPermissions(window.__getDcActiveGroupCode(), user.username, (perms) => {
                   if (!perms.manageRooms) return window.dcShowToast('Bu grupta oda/kanal oluşturma yetkiniz yok.');
                   document.getElementById('create-channel-modal')?.classList.remove('hidden');
               });
           });
       }

       // Kategori kanal oluştur — confirm
       const confirmChannelBtn = document.getElementById('btn-confirm-create-channel');
       if (confirmChannelBtn) {
           confirmChannelBtn.addEventListener('click', () => {
               const input = document.getElementById('new-channel-name-input');
               const channelName = input?.value?.trim();
               if (!channelName) return window.dcShowToast('Kanal adı boş olamaz.');
               const user = getUser();
               if (!user || !window.__getDcActiveGroupCode()) return;

               if (window._dcPendingChannelCreateSupabase) {
                   window._dcPendingChannelCreateSupabase = false;
                   const groupData = window.getMyGroupsDataCache()[window.__getDcActiveGroupCode()];
                   if (!window.FocusSupabase || !groupData?._supaId || !getCurrentUser()?.id) return;
                   window.FocusSupabase.from('group_channels').insert({
                       group_id: groupData._supaId, name: channelName, created_by: getCurrentUser().id
                   }).then(() => {
                       logGroupAuditSupabase(groupData._supaId, 'channel_create', `"${channelName}" adlı kategori oluşturuldu`);
                       document.getElementById('create-channel-modal')?.classList.add('hidden');
                       if (input) input.value = '';
                   });
                   return;
               }

               const database = getDB();
               if (!database) return;
               const channelId = 'ch-' + Date.now();
               database.ref(`focusai_community/groups/${window.__getDcActiveGroupCode()}/channels/${channelId}`).set({
                   name: channelName, createdBy: user.username, createdAt: Date.now()
               }).then(() => {
                   document.getElementById('create-channel-modal')?.classList.add('hidden');
                   if (input) input.value = '';
               });
           });
       }
        // Alt-kanal oluştur - event delegation (dinamik butonlar için)
        document.addEventListener('click', (e) => {
            const addSubBtn = e.target.closest('.dc-add-subchan-btn');
            if (!addSubBtn) return;
            e.stopPropagation();
            const user = getUser();
            if (!user) return window.dcShowToast('Giriş yapmalısınız.');
            const groupCodeForPerm = addSubBtn.dataset.group;
            getMemberPermissions(groupCodeForPerm, user.username, (perms) => {
                if (!perms.manageRooms) return window.dcShowToast('Bu grupta oda/kanal oluşturma yetkiniz yok.');
                // Hangi kanala eklenecek bilgisini modalda sakla
                window._dcPendingSubChan = {
                    groupCode:   addSubBtn.dataset.group,
                    channelId:   addSubBtn.dataset.channel,
                    channelName: addSubBtn.dataset.channelName
                };
                const label = document.getElementById('subchan-modal-channel-label');
                if (label) label.textContent = addSubBtn.dataset.channelName;
                document.getElementById('create-subchannel-modal')?.classList.remove('hidden');
            });
        });

        // Alt-kanal oluştur - confirm butonu
        const confirmSubBtn = document.getElementById('btn-confirm-create-subchannel');
        if (confirmSubBtn) {
            confirmSubBtn.addEventListener('click', () => {
                const input = document.getElementById('new-subchannel-name-input');
                const subName = input?.value?.trim();
                if (!subName) return window.dcShowToast('Alt kanal adı boş olamaz.');

                if (window._dcPendingSubChanSupabase) {
                    const pendingSupa = window._dcPendingSubChanSupabase;
                    window._dcPendingSubChanSupabase = null;
                    if (!window.FocusSupabase || !getCurrentUser()?.id) return;
                    window.FocusSupabase.from('group_subchannels').insert({
                        channel_id: pendingSupa.channelId, name: subName, created_by: getCurrentUser().id
                    }).then(() => {
                        const supaGroupId = window.getMyGroupsDataCache()[pendingSupa.groupCode]?._supaId;
                        if (supaGroupId) logGroupAuditSupabase(supaGroupId, 'subchannel_create', `"${pendingSupa.channelName}" kategorisine "${subName}" odası eklendi`);
                        document.getElementById('create-subchannel-modal')?.classList.add('hidden');
                        if (input) input.value = '';
                    });
                    return;
                }

                const pending = window._dcPendingSubChan;
                if (!pending) return;
                const database = getDB();
                const user = getUser();
                if (!database || !user) return;

                const subId = subName.toLowerCase()
                    .replace(/\s+/g, '-')
                    .replace(/[^a-z0-9\-]/g, '')
                    || ('sub-' + Date.now());

                database.ref(`focusai_community/groups/${pending.groupCode}/channels/${pending.channelId}/subChannels/${subId}`).set({
                    name:      subName,
                    createdBy: user.username,
                    createdAt: Date.now()
                }).then(() => {
                    document.getElementById('create-subchannel-modal')?.classList.add('hidden');
                    if (input) input.value = '';
                    window._dcPendingSubChan = null;
                });
            });
        }

        // Modal kapatma butonları
        document.getElementById('btn-close-channel-modal')?.addEventListener('click', () => {
            document.getElementById('create-channel-modal')?.classList.add('hidden');
            window._dcPendingChannelCreateSupabase = false;
        });
        document.getElementById('btn-close-subchannel-modal')?.addEventListener('click', () => {
            document.getElementById('create-subchannel-modal')?.classList.add('hidden');
            window._dcPendingSubChanSupabase = null;
        });
    }

    // ─── KİŞİ EKLEME BUTONU (Sohbet > Çevrimiçi yanındaki +) ──
    function bindAddContactBtn() {
        const btn = document.getElementById('dc-add-dm-btn');
        if (!btn) return;
        btn.addEventListener('click', () => {
            const user = getUser();
            if (!user) return window.dcShowToast('Giriş yapmalısınız.');
            const modal = document.getElementById('add-friend-modal');
            if (!modal) return;
            modal.classList.remove('hidden');
            const result = document.getElementById('add-friend-result');
            const input = document.getElementById('add-friend-input');
            if (result) result.innerHTML = '';
            if (input) input.value = '';
        });
    }

    // ─── GRUP EKLEME BUTONU ──────────────────────────────
    function bindAddGroupBtn() {
        const btn = document.getElementById('dc-add-group-btn');
        if (!btn) return;
        btn.addEventListener('click', () => {
            const user = getUser();
            if (!user) return window.dcShowToast('Giriş yapmalısınız.');
            document.getElementById('premium-create-group-modal')?.classList.remove('hidden');
        });
    }

    // ─── ANA SAYFA BUTONU ────────────────────────────────
    function bindHomeBtn() {
        const btn = document.getElementById('dc-home-btn');
        if (!btn) return;
        btn.addEventListener('click', () => {
            // Bu buton "Gruplara Geri Dön" — çalışma odasından AYRILMAZ, kullanıcı
            // odadayken başka panellere göz atabilir. Odadan çıkış yalnızca "Odadasın"
            // çubuğundaki ayrıl butonuna basınca veya başka bir odaya girince gerçekleşir.
            window.detachDcListeners();
            window.closeDcChat();
            window.showHomePanel();
        });
    }

    // ─── GERİ BUTONU ────────────────────────────────────
    function bindBackBtn() {
        const btn = document.getElementById('live-chat-back-btn');
        if (!btn) return;
        btn.addEventListener('click', () => {
            // Geri butonu çalışma odasından AYRILMAZ — kullanıcı odadayken başka
            // panellere göz atabilir. Odadan çıkış yalnızca "Odadasın" çubuğundaki
            // ayrıl butonuna basınca veya başka bir odaya girince gerçekleşir.
            window.closeDcChat();
            window.showHomePanel();
            // Mobil: sidebar gizliyken geri = sohbet listesi overlay'ini aç
            if (window.innerWidth <= 480) {
                document.getElementById('premium-social-sidebar')?.classList.add('dc-mobile-list-open');
            }
        });
    }

    // ─── SIDEBAR AÇILINCA PROFİLİ GÜNCELLE ──────────────
export function updateDcBottomProfile() {
        const user = getUser();
        if (!user) return;
        const avatarUrl = user.customAvatar || dcAvatar(user.displayName, user.avatarColor);
        const nameEl  = document.getElementById('dc-bottom-name');
        const tagEl   = document.getElementById('dc-bottom-tag');
        const avEl    = document.getElementById('dc-bottom-avatar');
        const dotEl   = document.getElementById('dc-bottom-status-dot');
        if (nameEl) nameEl.textContent = user.displayName || user.username;
        if (tagEl)  tagEl.textContent  = user.username ? '#' + user.username : '';
        if (avEl) {
            avEl.src = avatarUrl;
            avEl.style.border = `2px solid #${(user.avatarColor || '6c5ce7').replace('#','')}`;
            avEl.style.boxSizing = 'border-box';
            avEl.style.objectFit = 'cover';
        }
        const statusColors = { online: '#2ed573', away: '#ff9f43', dnd: '#ff4757', offline: '#a4b0be' };
        if (dotEl) dotEl.style.background = statusColors[user.status || 'online'];
    }
    window.updateDcBottomProfile = updateDcBottomProfile; // social.js'in kalan çağrı noktaları için

    // ─── BAŞLATICI ───────────────────────────────────────
    let _profileUpdatedBound = false; // 'focusai:profile-updated' dinleyicisi tek kez bağlansın
export function initDcArchitecture() {
        // Firebase rol sistemi kaldırıldı — rol yönetimi Supabase üzerinden yapılır

        // Profil/durum güncellemesi (profil düzenleme modalından) anında yansısın
        if (!_profileUpdatedBound) {
            _profileUpdatedBound = true;
            window.addEventListener('focusai:profile-updated', () => {
                updateDcBottomProfile();
            });
        }

        // UI ilk yüklendiğinde — ancak sayfa yenileme sohbet restorasyonu
        // bekliyorsa/tamamlandıysa açık sohbeti SİLME (window.showHomePanel sohbet
        // alanını boş duruma sıfırlıyor).
        if (!getDcRestorePending() && !getActiveChatTarget()) window.showHomePanel();
        updateDcBottomProfile();
        bindHomeBtn();
        bindBackBtn();
        bindAddRoomBtn();
        bindAddGroupBtn();
        bindAddContactBtn();

        // Karşılama ekranı CTA butonları — doğrudan modal aç
        document.getElementById('dc-empty-join-group-btn')?.addEventListener('click', () => {
            const user = getUser();
            if (!user) return window.dcShowToast('Giriş yapmalısınız.');
            // Sidebar'daki grup kodu girişine odaklan (JOIN akışı)
            const sidebarInput = document.getElementById('sidebar-action-input');
            if (sidebarInput) {
                sidebarInput.focus();
                sidebarInput.placeholder = 'Grup kodunu gir (6 karakter)...';
                sidebarInput.style.outline = '2px solid var(--primary-color, #D4900E)';
                sidebarInput.style.transition = 'outline 0.3s';
                setTimeout(() => {
                    sidebarInput.style.outline = '';
                    sidebarInput.placeholder = 'Grup kodu veya @kullanıcı...';
                }, 3000);
            }
        });
        document.getElementById('dc-empty-add-friend-btn')?.addEventListener('click', () => {
            const user = getUser();
            if (!user) return window.dcShowToast('Giriş yapmalısınız.');
            const modal = document.getElementById('add-friend-modal');
            if (!modal) return;
            modal.classList.remove('hidden');
            const result = document.getElementById('add-friend-result');
            const input  = document.getElementById('add-friend-input');
            if (result) result.innerHTML = '';
            if (input)  input.value = '';
        });

        // Kişiler listesini DC DM formatında doldur
        syncDcContactList();

        // Grupları hemen yükle (sayfa açılışında da çalışsın)
        window.loadUserGroupsForDc();

        // Profil edit btn2
        document.getElementById('sb-profile-edit-btn2')?.addEventListener('click', () => {
            if (typeof window.openSetupModalAsEdit === 'function') window.openSetupModalAsEdit();
        });

        // ─── PROFİL ZONE CONTEXT MENÜSÜ ─────────────────────
        bindProfileZoneMenu();
    }
    window.initDcArchitecture = initDcArchitecture; // social.js'in DOMContentLoaded başlatıcısı için

    function bindProfileZoneMenu() {
        // Sohbet paneli profil alanı artık sadece gösterim amaçlı; tıklanmıyor.
    }

    window.openProfileContextMenu = openProfileContextMenu; // social.js'in sidebar profil tıklama delegation'ı için

