import { computeActiveNowCount, computeUserInterestCategoriesSupabase, renderDiscoverGroups } from './social-group-discover.js';
import { getFriends, _fetchNotifications } from './social-friends-notifications.js';

import { setupGroupRecentConversationsSupabase } from './social-dm-notifications.js';

import { getCurrentUser } from './state/current-user-store.js';
import './social-institution-my-groups-institution-modal.js';
import './social-institution-my-groups-invite-modal.js';
// social-institution-my-groups.js
// social-institution-panel.js'ten çıkarıldı (Faz refactor turu): "Kurumum"
// modalı (öğretmenin sahip olduğu kurumlar + sınıflara öğrenci ataması +
// haftalık pasif-öğrenci özet bildirimi), "Gruplarım" listesi (Supabase
// realtime), ve grup davet mini modalı (arkadaş daveti / kurumsal davetli-
// girişli sınıflar için kullanıcı adıyla davet).
//
// Bağımsız doğrulama: bu 3 fonksiyon (+ özel yardımcıları) panel.js'in geri
// kalanından (renderClassroomTab dahil) hiç çağrılmıyordu — sadece window.*
// köprüsüyle social.js (window.renderMyInstitutionModal/loadMyGroupsSupabase)
// ve social-group-details.js (window.openGroupInviteModal) tarafından
// tüketiliyorlar. Bu yüzden gerçekten izole bir dosyaya taşınabildiler.
//
// Bulunan gerçek bug'lar (çıkarma sırasında bağımlılık doğrulaması yapılırken
// ortaya çıktı, düzeltildi):
//  - window.renderMyInstitutionModal / window.loadMyGroupsSupabase hiç
//    ATANMAMIŞTI (sadece tüketici tarafta çağrılıyordu) — social.js'teki
//    çağrılar TypeError atıyordu. Aşağıda düzeltildi.
//  - loadMyGroupsSupabase içinde myGroupsContainer/currentActiveGroupCode/
//    cachedDiscoverGroupsSnapshot bare kullanılıyordu ama bu modülün
//    kapsamında hiç tanımlı değillerdi (social.js/social-group-discover.js'in
//    kendi closure'larında yaşıyorlar) — ReferenceError riski. myGroupsContainer
//    artık doğrudan getElementById ile alınıyor, currentActiveGroupCode
//    social.js'teki __getCurrentActiveGroupCodeRef/__setCurrentActiveGroupCodeRef
//    köprüsünü kullanıyor, cachedDiscoverGroupsSnapshot kontrolü ise
//    window.computeUserInterestCategoriesSupabase fonksiyon varlığı kontrolüne
//    çevrildi (o fonksiyonlar zaten kendi cachedDiscoverGroupsSnapshot'larını
//    kendi içlerinde kontrol ediyor).
//  - window.computeUserInterestCategoriesSupabase / window.renderDiscoverGroups
//    da hiç atanmamıştı (social-group-discover.js'te ayrıca düzeltildi).
//
// Köprüler:
//  - window.FocusSupabase, getCurrentUser(), window._escapeHtml,
//    window.dcShowToast, getFriends, window.getMyGroupsDataCache()/
//    __setMyGroupsDataCacheRef(), window.__getCurrentActiveGroupCodeRef()/
//    __setCurrentActiveGroupCodeRef() (social.js'te tanımlı state köprüleri).
//  - window.computeActiveNowCount, window.computeUserInterestCategoriesSupabase,
//    window.renderDiscoverGroups (social-group-discover.js'te tanımlı).
//  - window.groupAvatarHtml, window.avatarImgHtml (social-avatar-utils.js'te
//    tanımlı, bare erişiliyor — window.* property'leri global scope'ta
//    unqualified identifier olarak çözülüyor, tarayıcıda sorunsuz).
//  - window._normalizeSupabaseGroup (social-groups.js'te tanımlı).
//  - window.dcOpenGroupPanel, window.showGroupDetails, window.resetActiveGroupPanel,
//    window.__dcCloseChatIfGroup, setupGroupRecentConversationsSupabase,
//    window.loadUserGroupsForDc, _fetchNotifications: opsiyonel,
//    varlık kontrolüyle çağrılıyor.

// "Kurumum" modalı social-institution-my-groups-institution-modal.js'e çıkarıldı.

// ── SUPABASE: "Gruplarım" listesi ──
let _myGroupsChannelSupabase = null;

window.loadMyGroupsSupabase = () => loadMyGroupsSupabase(); // Faz refactor turu: eksik köprü eklendi (social.js buradan çağırıyor)
export async function loadMyGroupsSupabase() {
    // Faz refactor turu: myGroupsContainer bare kullanılıyordu ama bu değişken
    // bu modülün kapsamında hiç tanımlı değildi (social.js'in kendi DOMContentLoaded
    // kapsamında bir const olarak yaşıyor) — ReferenceError riski, gerçek bağımlılık
    // doğrulaması sırasında bulundu, burada düzeltildi.
    const myGroupsContainer = document.getElementById("my-groups-container");
    if (!getCurrentUser()?.id || !myGroupsContainer) return;

    if (_myGroupsChannelSupabase) {
        await window.FocusSupabase.removeChannel(_myGroupsChannelSupabase);
        _myGroupsChannelSupabase = null;
    }

    const renderList = async () => {
        const { data: rows, error } = await window.FocusSupabase
            .from('group_members')
            .select('group_id, groups(*)')
            .eq('user_id', getCurrentUser().id);

        if (error) {
            console.error('loadMyGroupsSupabase:', error);
            return;
        }

        myGroupsContainer.innerHTML = "";
        window.__setMyGroupsDataCacheRef({});

        if (!rows || rows.length === 0) {
            myGroupsContainer.innerHTML = `<p class="u-color-var-text-muted_font-size-13px_text-align-center_padd">Henüz bir gruba üye değilsiniz.</p>`;

            const activePanel = document.getElementById('active-group-panel');
            if (activePanel) {
                activePanel.innerHTML = `
                    <div class="u-text-align-center_padding-40px20px_color-var-text-muted">
                        <i class="fa-solid fa-people-group u-font-size-32px_margin-bottom-15px_color-var-primary-color_" ></i>
                        <p class="u-margin-0_font-size-14px">Henüz aktif bir grubunuz yok.</p>
                        <p class="u-margin-5px000_font-size-12px_opacity-0p7">Yandaki listeden bir gruba katılabilir veya yeni bir grup oluşturabilirsiniz.</p>
                    </div>
                `;
            }
            if (window.__getCurrentActiveGroupCodeRef?.()) window.resetActiveGroupPanel();
            if (typeof computeUserInterestCategoriesSupabase === 'function') {
                computeUserInterestCategoriesSupabase();
                renderDiscoverGroups();
            }
            return;
        }

        const firstGroupCode = rows[0].groups.code;

        for (const row of rows) {
            const groupRow = row.groups;
            if (!groupRow) continue;
            const groupCode = groupRow.code;

            const { data: memberRows } = await window.FocusSupabase
                .from('group_members')
                .select('user_id, role, class_section_id, joined_at, profiles(id, username, display_name, avatar_color, custom_avatar, avatar_initials)')
                .eq('group_id', groupRow.id);

            const groupData = await window._normalizeSupabaseGroup(groupRow, memberRows || []);
            window.getMyGroupsDataCache()[groupCode] = groupData;

            const isOwner = groupData.createdBy === getCurrentUser().username;
            const ownerBadge = isOwner ? `<i class="fa-solid fa-crown u-color-hfeca57_font-size-11px" title="Grup Sahibi"></i> ` : '';
            const activeNow = computeActiveNowCount(groupData);
            const activeNowHtml = activeNow > 0
                ? `<span class="si-green"><i class="fa-solid fa-circle u-font-size-7px" ></i> ${activeNow} kişi şu an aktif</span>`
                : "";
            const myGroupMemberCount = Object.keys(groupData.members).length;

            const groupCard = document.createElement("div");
            groupCard.className = "glass-panel my-group-card-item";
            groupCard.id = `card-${groupCode}`;
            groupCard.classList.toggle("active-hub-group", window.__getCurrentActiveGroupCodeRef?.() === groupCode);

            const activeNowMiniHtml = activeNow > 0
                ? `<span class="my-group-card-active-mini"><i class="fa-solid fa-circle"></i> ${activeNow}</span>`
                : "";

            groupCard.innerHTML = `
                <div class="my-group-card-row">
                    ${window.groupAvatarHtml(groupCode, groupData.name, 30)}
                    <div class="my-group-card-body">
                        <h4 class="my-group-card-name">${ownerBadge}${window._escapeHtml(groupData.name)}</h4>
                        <div class="my-group-card-meta">
                            <span class="my-group-card-members"><i class="fa-solid fa-users"></i> ${myGroupMemberCount}</span>
                            <span id="my-group-active-${groupCode}">${activeNowMiniHtml}</span>
                        </div>
                    </div>
                </div>
            `;

            groupCard.onclick = function() {
                window.__setCurrentActiveGroupCodeRef?.(groupCode);
                document.querySelectorAll(".my-group-card-item").forEach(c => c.classList.remove("active-hub-group"));
                groupCard.classList.add("active-hub-group");
                if (typeof window.dcOpenGroupPanel === 'function') {
                    document.getElementById('social-tab-sohbet-btn')?.click();
                    window.dcOpenGroupPanel(groupCode);
                } else {
                    window.showGroupDetails(groupCode, groupData);
                }
            };

            myGroupsContainer.appendChild(groupCard);

            // Varsayılan grubu yalnızca GÖRSEL olarak işaretle — groupCard.click()
            // çağrılırsa dcOpenGroupPanel görünümü zorla grup paneline çevirdiğinden,
            // sayfa yenilendiğinde açık olan DM/kanal/çalışma odası sohbeti kayboluyordu.
            if (!window.__getCurrentActiveGroupCodeRef?.() && groupCode === firstGroupCode) {
                window.__setCurrentActiveGroupCodeRef?.(groupCode);
                groupCard.classList.add("active-hub-group");
            }
        }

        if (typeof computeUserInterestCategoriesSupabase === 'function') {
            computeUserInterestCategoriesSupabase();
            renderDiscoverGroups();
        }
    };

    await renderList();

    _myGroupsChannelSupabase = window.FocusSupabase
        .channel(`my-groups-${getCurrentUser().id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members', filter: `user_id=eq.${getCurrentUser().id}` }, (payload) => {
            // Bir gruptan atıldığımızda (DELETE), o gruba ait "Son Mesajlaşmalar"
            // girişlerini temizle ve sohbeti açıksa kapat — hard reset gerekmesin.
            if (payload.eventType === 'DELETE') {
                const removedGroupId = payload.old && payload.old.group_id;
                const removedGroup = Object.values(window.getMyGroupsDataCache()).find(g => g._supaId === removedGroupId);
                const removedCode = removedGroup && removedGroup.code;
                if (removedCode && typeof window.__dcCloseChatIfGroup === 'function') {
                    window.__dcCloseChatIfGroup(removedCode);
                }
                if (typeof window.setupGroupRecentConversationsSupabase === 'function') {
                    setupGroupRecentConversationsSupabase();
                }
                if (typeof window.loadUserGroupsForDc === 'function') {
                    window.loadUserGroupsForDc();
                }
            }
            renderList();
        })
        .subscribe();
}

