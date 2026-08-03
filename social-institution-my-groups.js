import { computeActiveNowCount, computeUserInterestCategoriesSupabase, renderDiscoverGroups } from './social-group-discover.js';
import { getFriends, _fetchNotifications } from './social-friends-notifications.js';

import { setupGroupRecentConversationsSupabase } from './social-dm-notifications.js';

import { getCurrentUser } from './state/current-user-store.js';
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

// ── Kurumum modalı: öğretmenin sahip olduğu kurumlar + her birine bağlı sınıf grupları ──
window.renderMyInstitutionModal = () => renderMyInstitutionModal(); // Faz refactor turu: eksik köprü eklendi (social.js buradan çağırıyor)
// renderMyInstitutionModal'dan ayrılan: liste render edildikten sonraki tüm
// buton/select olaylarını bağlar. Faz S devamı, dev fonksiyon refactoru.
function _wireMyInstitutionModalEvents(listEl) {
    listEl.querySelectorAll('.my-inst-group-row').forEach(row => {
        row.addEventListener('click', () => {
            const code = row.dataset.code;
            document.getElementById('my-institution-modal')?.classList.add('hidden');
            if (code && typeof window.dcOpenGroupPanel === 'function') window.dcOpenGroupPanel(code);
        });
    });

    // Sınıf değiştirme: eski group_members satırını sil, yeni sınıfa ekle.
    listEl.querySelectorAll('.my-inst-student-class-select').forEach(sel => {
        const initialValue = sel.value;
        sel.dataset.prevValue = initialValue;
        sel.addEventListener('change', async () => {
            const userId = sel.dataset.userId;
            const fromGroupId = sel.dataset.prevValue;
            const toGroupId = sel.value;
            if (fromGroupId === toGroupId) return;
            sel.disabled = true;
            const { error: delErr } = await window.FocusSupabase.from('group_members').delete().eq('group_id', fromGroupId).eq('user_id', userId);
            if (delErr) { window.dcShowToast('Sınıf değiştirilemedi: ' + delErr.message, 'error'); sel.value = fromGroupId; sel.disabled = false; return; }
            const { error: insErr } = await window.FocusSupabase.from('group_members').insert({ group_id: toGroupId, user_id: userId, role: null });
            sel.disabled = false;
            if (insErr) { window.dcShowToast('Sınıf değiştirilemedi: ' + insErr.message, 'error'); sel.value = fromGroupId; return; }
            sel.dataset.prevValue = toGroupId;
            window.dcShowToast('Öğrencinin sınıfı güncellendi.', 'success');
        });
    });

    // Yeni öğrenci ekleme: kullanıcı adı + hedef sınıf seçimi, tek adımda ekler.
    listEl.querySelectorAll('.my-inst-roster-block').forEach(block => {
        const btn = block.querySelector('.my-inst-add-student-btn');
        const uInput = block.querySelector('.my-inst-add-username');
        const classSelect = block.querySelector('.my-inst-add-class');
        const statusEl = block.querySelector('.my-inst-add-status');
        btn?.addEventListener('click', async () => {
            const username = (uInput?.value || '').trim().replace(/^@/, '');
            if (!username) { window.dcShowToast('Bir kullanıcı adı yaz.'); return; }
            const groupId = classSelect?.value;
            if (!groupId) return;
            btn.disabled = true;
            if (statusEl) statusEl.textContent = 'Aranıyor…';
            try {
                const { data: target, error: sErr } = await window.FocusSupabase
                    .from('profiles').select('id, username, display_name').ilike('username', username).maybeSingle();
                if (sErr) throw sErr;
                if (!target) { if (statusEl) statusEl.textContent = 'Bu kullanıcı adıyla kimse bulunamadı.'; return; }
                const { error: mErr } = await window.FocusSupabase.from('group_members').insert({ group_id: groupId, user_id: target.id, role: null });
                if (mErr) {
                    if (mErr.code === '23505') { if (statusEl) statusEl.textContent = `@${target.username} zaten bu sınıfta.`; }
                    else { if (statusEl) statusEl.textContent = 'Eklenemedi: ' + mErr.message; }
                    return;
                }
                window.dcShowToast(`@${target.username} eklendi.`, 'success');
                if (uInput) uInput.value = '';
                renderMyInstitutionModal();
            } catch (e) {
                if (statusEl) statusEl.textContent = 'Eklenemedi: ' + e.message;
            } finally {
                btn.disabled = false;
            }
        });
    });
}

export async function renderMyInstitutionModal() {
    const listEl = document.getElementById('my-institution-list');
    if (!listEl || !window.FocusSupabase || !getCurrentUser()?.id) return;
    listEl.innerHTML = '<div class="u-text-align-center_color-var-text-muted_font-size-13px_padd">Yükleniyor…</div>';

    const { data: institutions, error: instErr } = await window.FocusSupabase
        .from('institutions').select('id, name, created_at').eq('owner_id', getCurrentUser().id).order('created_at', { ascending: true });
    if (instErr) {
        listEl.innerHTML = `<div class="u-color-hff6b6b_font-size-13px_padding-10px">Yüklenemedi: ${window._escapeHtml(instErr.message)}</div>`;
        return;
    }
    if (!institutions || !institutions.length) {
        listEl.innerHTML = '<div class="u-text-align-center_color-var-text-muted_font-size-13px_padd">Henüz bir kurumun yok. "Grup Oluştur" → Sınıf tipiyle bir grup açtığında burada görünecek.</div>';
        return;
    }

    const { data: groups } = await window.FocusSupabase
        .from('groups').select('id, code, name, grade_level, institution_id')
        .in('institution_id', institutions.map(i => i.id));

    const groupsByInst = {};
    (groups || []).forEach(g => { (groupsByInst[g.institution_id] = groupsByInst[g.institution_id] || []).push(g); });

    // Her grubun üye sayısı + öğrenci-sınıf atama paneli için tam üye listesi
    // (isim + hangi sınıfta olduğu) — öğretmen kullanıcı adı yazmadan, dropdown'la
    // öğrencileri sınıflar arasında bölebilsin.
    const groupIds = (groups || []).map(g => g.id);
    const countByGroup = {};
    let allMemberRows = [];
    if (groupIds.length) {
        const { data: memberRows } = await window.FocusSupabase
            .from('group_members').select('group_id, user_id, profiles(id, username, display_name)').in('group_id', groupIds);
        allMemberRows = memberRows || [];
        allMemberRows.forEach(r => { countByGroup[r.group_id] = (countByGroup[r.group_id] || 0) + 1; });
    }

    // Sınıflar arası çapraz özet: her grup için bu haftaki pasif üye sayısı —
    // öğretmen tek tek girmeden hangi sınıfın ilgi istediğini görsün.
    const summaryByGroup = {};
    await Promise.all(groupIds.map(async (gid) => {
        const { data: stats } = await window.FocusSupabase.rpc('group_weekly_member_stats', { p_group_id: gid });
        const rows = stats || [];
        summaryByGroup[gid] = {
            memberCount: countByGroup[gid] || 0,
            // is_hidden olan üyeler null döner — gizlilik nedeniyle bilinmiyor demektir,
            // pasif sayılıp yanlış alarm oluşturmasın.
            inactiveCount: rows.filter(r => !r.is_hidden && !r.weekly_minutes).length
        };
    }));

    listEl.innerHTML = institutions.map(inst => {
        const gList = groupsByInst[inst.id] || [];
        const gById = {}; gList.forEach(g => { gById[g.id] = g; });
        // Bu kurumdaki tüm öğrenciler, mevcut sınıflarıyla birlikte — tekilleştirilmiş
        // (bir öğrenci birden fazla sınıfta olabilir ama genelde tek sınıfta olur).
        const studentsByUser = {};
        allMemberRows.filter(r => gById[r.group_id] && r.profiles).forEach(r => {
            const u = studentsByUser[r.user_id] || (studentsByUser[r.user_id] = { profile: r.profiles, groupIds: [] });
            u.groupIds.push(r.group_id);
        });
        const studentList = Object.entries(studentsByUser)
            .sort((a, b) => (a[1].profile.display_name || '').localeCompare(b[1].profile.display_name || '', 'tr'));
        return `
        <div class="glass-panel u-padding-12px14px_border-1pxsolidrgba2552552550p07_border-r" >
            <div class="u-font-weight-600_color-hfff_font-size-14px_margin-bottom-8p"><i class="fa-solid fa-building-columns u-color-h74b9ff-2" ></i> ${window._escapeHtml(inst.name)}</div>
            ${gList.length ? gList.map(g => {
                const s = summaryByGroup[g.id] || { memberCount: 0, inactiveCount: 0 };
                return `
            <div class="my-inst-group-row u-display-flex_align-items-center_justify-content-space-betw-16" data-code="${window._escapeHtml(g.code)}" >
                <div class="u-min-width-0">
                    <div class="u-font-size-13px_color-hfff_font-weight-500_overflow-hidden_">${window._escapeHtml(g.name)}</div>
                    <div class="u-font-size-11px_color-var-text-muted">${g.grade_level ? window._escapeHtml(g.grade_level) + ' · ' : ''}${s.memberCount} üye${s.inactiveCount ? ` · <span class="u-color-hfeca57">${s.inactiveCount} pasif</span>` : ' · hepsi aktif ✓'}</div>
                </div>
                <i class="fa-solid fa-chevron-right u-color-var-text-muted_font-size-12px_flex-shrink-0" ></i>
            </div>`;
            }).join('') : '<p class="cp-hint">Bu kurumda henüz sınıf grubu yok.</p>'}
        </div>
        ${gList.length ? `
        <div class="glass-panel my-inst-roster-block u-padding-12px14px_border-1pxsolidrgba2552552550p07_border-r" data-inst-id="${inst.id}" >
            <div class="u-font-weight-600_color-hfff_font-size-14px_margin-bottom-8p"><i class="fa-solid fa-users u-color-h74b9ff-2" ></i> Öğrencileri Sınıflara Ayır</div>
            <p class="cp-hint u-margin-4px010px" >Her öğrencinin sınıfını buradan değiştirebilirsin — seçim yapınca anında uygulanır.</p>
            <div class="my-inst-add-student-row u-display-flex_gap-6px_margin-bottom-10px" >
                <input class="cp-asg-pill-input my-inst-add-username u-flex-1" placeholder="Yeni öğrenci — kullanıcı adı" maxlength="40" >
                <select class="cp-asg-pill-input my-inst-add-class">
                    ${gList.map(g => `<option value="${g.id}">${window._escapeHtml(g.name)}</option>`).join('')}
                </select>
                <button class="cp-asg-submit-btn my-inst-add-student-btn" title="Ekle" aria-label="Ekle"><i class="fa-solid fa-plus"></i></button>
            </div>
            <div class="my-inst-add-status cp-hint"></div>
            <div class="my-inst-student-list">
                ${studentList.length ? studentList.map(([userId, u]) => `
                <div class="my-inst-student-row u-display-flex_align-items-center_justify-content-space-betw-17" >
                    <span class="u-font-size-12p5px_color-hfff_overflow-hidden_text-overflow-">${window._escapeHtml(u.profile.display_name || u.profile.username)}</span>
                    <select class="cp-asg-pill-input my-inst-student-class-select u-max-width-160px" data-user-id="${userId}" >
                        ${gList.map(g => `<option value="${g.id}" ${u.groupIds.includes(g.id) ? 'selected' : ''}>${window._escapeHtml(g.name)}</option>`).join('')}
                    </select>
                </div>`).join('') : '<p class="cp-hint">Henüz öğrenci yok — yukarıdan ekleyebilirsin.</p>'}
            </div>
        </div>` : ''}`;
    }).join('');

    _wireMyInstitutionModalEvents(listEl);

    _maybeSendWeeklyDigest(groupIds, groups, summaryByGroup);
}

// Haftada bir kez (Kurumum panelini açtığında), pasif öğrencisi olan sınıflar
// için öğretmene özet bildirimi düşer — sunucu cron'u olmadan "proaktif" uyarı.
function _weeklyDigestWeekStart() {
    const d = new Date();
    const day = (d.getDay() + 6) % 7; // Pazartesi = 0
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - day);
    return d.toISOString().slice(0, 10);
}
async function _maybeSendWeeklyDigest(groupIds, groups, summaryByGroup) {
    if (!groupIds.length || !window.FocusSupabase) return;
    const weekStart = _weeklyDigestWeekStart();
    const { data: existing } = await window.FocusSupabase
        .from('institution_weekly_digests').select('group_id')
        .in('group_id', groupIds).eq('week_start', weekStart);
    const already = new Set((existing || []).map(r => r.group_id));
    const pending = groupIds.filter(gid => !already.has(gid));
    if (!pending.length) return;

    const groupById = {}; (groups || []).forEach(g => { groupById[g.id] = g; });
    for (const gid of pending) {
        const s = summaryByGroup[gid] || { inactiveCount: 0 };
        const g = groupById[gid];
        if (s.inactiveCount > 0 && g) {
            await window.FocusSupabase.from('notifications').insert({
                user_id: getCurrentUser().id,
                type: 'classroom_weekly_digest',
                payload: { groupCode: g.code, groupName: g.name, inactiveCount: s.inactiveCount }
            });
        }
        await window.FocusSupabase.from('institution_weekly_digests')
            .insert({ group_id: gid, week_start: weekStart, inactive_count: s.inactiveCount })
            .then(() => {}); // yarış durumunda unique ihlali sessizce yok sayılır
    }
    _fetchNotifications();
}

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


// Gruba arkadaş davet etmek için açılan mini modal: grup kodu + arkadaş listesi.
// classroom tipi gruplarda (davetli-girişli) öğretmen için farklı bir akış açılır:
// kullanıcı adıyla arayıp doğrudan institution_invites daveti gönderir.
window.openGroupInviteModal = (code, data) => openGroupInviteModal(code, data); // Faz 5: social-group-details.js'ten çağrılabilmesi için (hoisting ile güvenli)
export async function openGroupInviteModal(code, data) {
    const modal = document.getElementById("group-invite-modal");
    const codeEl = document.getElementById("group-invite-modal-code");
    const codeRowEl = document.getElementById("group-invite-modal-code-row");
    const listEl = document.getElementById("group-invite-modal-list");
    if (!modal || !codeEl || !listEl) return;

    if (data.classroomType === 'classroom' && getCurrentUser().institutionRole === 'teacher') {
        modal.classList.remove("hidden");
        codeRowEl?.classList.add('hidden');
        listEl.innerHTML = `
            <p class="u-color-var-text-muted_font-size-12px_margin-0010px">Bu sınıf davetli-girişlidir: öğrenciler yalnızca gönderdiğin daveti kabul ederek katılabilir.</p>
            <div class="cp-asg-form u-flex-direction-column_align-items-stretch_gap-8px" >
                <input id="gim-inst-username" class="gsc-form-input u-width-100pct" placeholder="Öğrencinin kullanıcı adını girin" maxlength="40" >
                <button id="gim-inst-send" class="control-btn secondary u-align-self-flex-end_padding-5px12px_font-size-11p5px" ><i class="fa-solid fa-paper-plane"></i> Gönder</button>
            </div>
            <div id="gim-inst-status" class="cp-hint"></div>`;

        const statusEl = listEl.querySelector('#gim-inst-status');
        listEl.querySelector('#gim-inst-send')?.addEventListener('click', async () => {
            const uInput = listEl.querySelector('#gim-inst-username');
            const username = (uInput?.value || '').trim().replace(/^@/, '');
            if (!username) { window.dcShowToast('Bir kullanıcı adı yaz.'); return; }
            statusEl.textContent = 'Aranıyor…';
            try {
                const { data: target, error: sErr } = await window.FocusSupabase
                    .from('profiles').select('id, username, display_name').ilike('username', username).maybeSingle();
                if (sErr) throw sErr;
                if (!target) { statusEl.textContent = 'Bu kullanıcı adıyla kimse bulunamadı.'; return; }
                // Zaten sınıfın üyesiyse davet göndermeye gerek yok — göndersek de kabul
                // ettiğinde "Sınıfa katıldın!" gibi yanlış bir mesaj çıkardı (2026-07-13).
                const { data: existingMember } = await window.FocusSupabase
                    .from('group_members').select('user_id')
                    .eq('group_id', data._supaId).eq('user_id', target.id).maybeSingle();
                if (existingMember) { statusEl.textContent = `@${target.username} zaten bu sınıfın öğrencisi.`; return; }
                const { error: iErr } = await window.FocusSupabase.from('institution_invites').insert({
                    group_id: data._supaId,
                    invited_by: getCurrentUser().id,
                    invited_user_id: target.id
                });
                if (iErr) {
                    if (iErr.code === '23505') { statusEl.textContent = `@${target.username} kullanıcısına zaten bekleyen bir davet var.`; }
                    else { statusEl.textContent = 'Davet gönderilemedi: ' + iErr.message; }
                    return;
                }
                statusEl.textContent = `@${target.username} kullanıcısına davet gönderildi.`;
                uInput.value = '';
            } catch (e) {
                statusEl.textContent = 'Davet gönderilemedi: ' + e.message;
            }
        });
        return;
    }

    codeEl.textContent = code;
    modal.classList.remove("hidden");
    listEl.innerHTML = `<p class="u-color-var-text-muted_font-size-12px_margin-8px0"><i class="fa-solid fa-spinner fa-spin"></i> Arkadaşlar yükleniyor...</p>`;

    const friends = getFriends();
    if (friends.length === 0) {
        listEl.innerHTML = `<p class="u-color-var-text-muted_font-size-12px_margin-8px0_text-align">Henüz bir arkadaşın yok.</p>`;
        return;
    }

    let memberSet = new Set();
    let profileMap = {}; // username -> {displayName, avatarColor, customAvatar}

    if (data._supaId && window.FocusSupabase && getCurrentUser().id) {
        const { data: memberRows } = await window.FocusSupabase
            .from('group_members')
            .select('profiles(username)')
            .eq('group_id', data._supaId);
        memberSet = new Set((memberRows || []).map(r => r.profiles?.username).filter(Boolean));

        const { data: profiles } = await window.FocusSupabase
            .from('profiles')
            .select('username, display_name, avatar_color, custom_avatar, avatar_initials')
            .in('username', friends);
        (profiles || []).forEach(p => {
            profileMap[p.username] = { displayName: p.display_name, avatarColor: p.avatar_color, customAvatar: p.custom_avatar, avatarInitials: p.avatar_initials || null };
        });
    }

    listEl.innerHTML = friends.map(username => {
        const p = profileMap[username] || {};
        const displayName = p.displayName || username;
        const uData = { username, displayName, avatarColor: p.avatarColor, customAvatar: p.customAvatar };
        const isMember = memberSet.has(username);
        return `
        <div class="group-invite-row" data-username="${window._escapeHtml(username)}">
            ${window.avatarImgHtml(uData, 28)}
            <div class="gir-name">${window._escapeHtml(displayName)}</div>
            ${isMember
                ? `<span class="si-muted-xs"><i class="fa-solid fa-check"></i> Üye</span>`
                : `<button class="control-btn primary group-invite-send-btn u-font-size-11px_padding-5px10px" data-username="${window._escapeHtml(username)}" data-name="${window._escapeHtml(displayName)}">
                    <i class="fa-solid fa-paper-plane"></i> Davet Et
                </button>`}
        </div>`;
    }).join("");

    listEl.querySelectorAll(".group-invite-send-btn").forEach(btn => {
        btn.onclick = async () => {
            const targetUsername = btn.dataset.username;
            btn.disabled = true;
            try {
                if (data._supaId && window.FocusSupabase && getCurrentUser().id) {
                    const { data: targetProfile } = await window.FocusSupabase
                        .from('profiles').select('id').eq('username', targetUsername).maybeSingle();
                    if (targetProfile) {
                        await window.FocusSupabase.from('notifications').insert({
                            user_id: targetProfile.id,
                            type: 'group_invite',
                            payload: {
                                groupCode: code, groupName: data.name,
                                fromUser: getCurrentUser().username,
                                fromName: getCurrentUser().displayName || getCurrentUser().username,
                                fromColor: getCurrentUser().avatarColor || '6c5ce7',
                                fromCustomAvatar: getCurrentUser().customAvatar || null
                            }
                        });
                    }
                }
                btn.innerHTML = '<i class="fa-solid fa-check"></i> Gönderildi';
                window.dcShowToast(`@${targetUsername} kullanıcısına davet gönderildi.`);
            } catch (e) {
                btn.disabled = false;
                window.dcShowToast('Davet gönderilemedi: ' + e.message);
            }
        };
    });
}
