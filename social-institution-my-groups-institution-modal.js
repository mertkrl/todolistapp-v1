import { getCurrentUser } from './state/current-user-store.js';
import { _fetchNotifications } from './social-friends-notifications.js';

// social-institution-my-groups.js'ten çıkarıldı: "Kurumum" modalı (öğretmenin
// sahip olduğu kurumlar + sınıflara öğrenci ataması + haftalık pasif-öğrenci
// özet bildirimi) — kendi kapsamında tamamen izole, dosyanın geri kalanındaki
// _myGroupsChannelSupabase/loadMyGroupsSupabase state'ine dokunmuyor.

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
