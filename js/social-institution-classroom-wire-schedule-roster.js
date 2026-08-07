// social-institution-classroom-wire-schedule-roster.js
// social-institution-classroom-wire.js'ten çıkarıldı: Ders Programı + Öğrenciler/
// Sınıflar (roster) sekmeleri event-binding fonksiyonları. Sadece isClassAdmin
// iken çağrılır. `refresh` üst orkestratörden gelir.
import { getCurrentUser } from '../state/current-user-store.js';
import {
    _cpOpenScheduleModal,
    _cpOpenScheduleViewModal,
    _cpOpenSectionDetailModal,
    _cpPatchMemberSection,
    _cpRosterPatchRowAfterMove,
    _cpRosterPatchSectionsPanelAfterMove,
    _cpSchedShowBuilder,
} from './social-institution-class-modals.js';

export function _ctWireScheduleEvents(el, data, ctx, refresh) {
    const { classSections, scheduleSubjectOptions } = ctx;
    const buildClassChoices = () => classSections.map(s => ({ id: s.id, name: s.name }));
    el.querySelector('#cp-sched-open-modal-btn')?.addEventListener('click', () => {
        _cpOpenScheduleModal(buildClassChoices(), scheduleSubjectOptions, refresh, data._supaId);
    });
    el.querySelectorAll('.cp-sched-class-card').forEach(btn => {
        btn.addEventListener('click', () => {
            const sectionId = btn.dataset.sectionId;
            const sectionName = btn.dataset.sectionName;
            const publishedId = btn.dataset.publishedId;
            const draftId = btn.dataset.draftId;
            // Yayınlanmış program varsa önce salt-okunur görüntüle; taslak varsa
            // (yayın yoksa veya kendi taslağı) düzenleme ekranına götür.
            if (publishedId) {
                _cpOpenScheduleViewModal(data._supaId, sectionName, publishedId);
            } else if (draftId) {
                _cpOpenScheduleModal(buildClassChoices(), scheduleSubjectOptions, refresh, data._supaId);
                _cpSchedShowBuilder({ groupId: data._supaId, sectionId, groupName: sectionName, programId: draftId, programStatus: 'draft' });
            }
        });
    });
    el.querySelectorAll('.cp-sched-card-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const sectionId = btn.dataset.sectionId, sectionName = btn.dataset.sectionName;
            const programId = btn.dataset.programId, programStatus = btn.dataset.programStatus;
            if (!programId) return;
            _cpOpenScheduleModal(buildClassChoices(), scheduleSubjectOptions, refresh, data._supaId);
            _cpSchedShowBuilder({ groupId: data._supaId, sectionId, groupName: sectionName, programId, programStatus });
        });
    });
    el.querySelectorAll('.cp-sched-card-del').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const sectionName = btn.dataset.sectionName, programId = btn.dataset.programId;
            if (!programId) return;
            const ok = await window.showFocusaiConfirm({
                title: 'Ders Programını Sil',
                desc: `"${window._escapeHtml(sectionName)}" için ders programı (tüm dersleriyle birlikte) kalıcı olarak silinsin mi? Bu işlem geri alınamaz.`,
                type: 'danger', icon: 'fa-trash-can', confirmText: 'Sil', cancelText: 'Vazgeç',
            });
            if (!ok) return;
            btn.disabled = true;
            await window.FocusSupabase.from('group_class_schedule').delete().eq('program_id', programId);
            await window.FocusSupabase.from('group_schedule_programs').delete().eq('id', programId);
            window.dcShowToast?.('Ders programı silindi.', 'success');
            refresh();
        });
    });

}
export function _ctWireRosterEvents(el, data, ctx, refresh) {
    const { classSections, scheduleSubjectOptions, scheduleCardByClass, rosterMembers, memberLabel } = ctx;
    // Öğrenciler sekmesi: isme göre anlık arama/filtreleme
    const rosterSearchInput = el.querySelector('#cp-roster-search');
    rosterSearchInput?.addEventListener('input', () => {
        const q = rosterSearchInput.value.trim().toLocaleLowerCase('tr');
        el.querySelectorAll('.cp-roster-row').forEach(card => {
            card.style.display = !q || (card.dataset.searchName || '').includes(q) ? '' : 'none';
        });
    });

    el.querySelectorAll('.cp-roster-remove-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const userId = btn.dataset.userId;
            const name = btn.dataset.name;
            const ok = await window.showFocusaiConfirm({
                title: `${memberLabel === 'Çalışan' ? 'Ekipten' : 'Sınıftan'} Çıkar`,
                desc: `<b>${window._escapeHtml(name)}</b> ${memberLabel.toLowerCase()}sini sınıftan çıkarmak istediğine emin misin?`,
                type: 'danger', icon: 'fa-user-xmark', confirmText: 'Çıkar', cancelText: 'Vazgeç'
            });
            if (!ok) return;
            btn.disabled = true;
            const fromGroupId = btn.dataset.classId || data._supaId;
            const { error } = await window.FocusSupabase.from('group_members').delete().eq('group_id', fromGroupId).eq('user_id', userId);
            if (error) { window.dcShowToast('Çıkarılamadı: ' + error.message, 'error'); btn.disabled = false; return; }
            window.dcShowToast(`${name} sınıftan çıkarıldı.`, 'success');
            refresh();
        });
    });

    // Şubeye atama: artık ayrı bir gruba taşıma değil, AYNI grubun içinde
    // group_members.class_section_id güncellenmesi (116) — tek bir UPDATE yeterli.
    el.querySelectorAll('.cp-roster-move-select').forEach(sel => {
        sel.addEventListener('change', async () => {
            const val = sel.value;
            if (!val) return;
            const userId = sel.dataset.userId;
            const name = sel.dataset.name;
            const targetName = val === '__unassigned__' ? 'Sınıfsız' : (classSections.find(s => s.id === val)?.name || 'Şube');
            const ok = await window.showFocusaiConfirm({
                title: 'Şube Değiştir',
                desc: `<b>${window._escapeHtml(name)}</b> için şube <b>${window._escapeHtml(targetName)}</b> olarak değiştirilsin mi?`,
                type: 'default', icon: 'fa-chalkboard-user', confirmText: 'Değiştir', cancelText: 'Vazgeç'
            });
            if (!ok) { sel.value = ''; return; }
            sel.disabled = true;
            const oldSectionId = sel.dataset.currentSectionId || null;
            // .select() ŞART: RLS satırı reddederse Supabase hata döndürmez,
            // sadece 0 satır etkiler — dönen satırı kontrol etmezsek "başarılı"
            // gösterip sayfa yenilenince atama kaybolmuş gibi görünür (124/125).
            const { data: updRows, error } = await window.FocusSupabase.from('group_members')
                .update({ class_section_id: val === '__unassigned__' ? null : val })
                .eq('group_id', data._supaId).eq('user_id', userId).select('user_id');
            if (error || !updRows || updRows.length === 0) {
                window.dcShowToast('Şube güncellenemedi' + (error ? ': ' + error.message : ' — yetki (RLS) reddetti, 124/125 migration canlıda uygulanmamış olabilir.'), 'error');
                sel.disabled = false; sel.value = ''; return;
            }
            const newSectionId = val === '__unassigned__' ? null : val;
            _cpPatchMemberSection(data, userId, newSectionId);
            // "Şube kartına tıkla → öğrenci listesi" modalı (aşağıdaki
            // cp-section-card-open click handler'ı) bu render'ın kapandığı
            // `rosterMembers` dizisini filtreleyip listeliyor — sadece data.members'ı
            // (yukarıda) veya DOM'u güncellemek bu diziyi TAZELEMEZ, kart hemen
            // ardından tıklanınca öğrenci hâlâ eski şubede/sınıfsız görünürdü
            // (kullanıcı bildirimi: "şubede kullanıcının kaydı gözükmüyor"). Bu
            // kapanmış diziyi de yerinde güncelliyoruz.
            const rmEntry = rosterMembers.find(rm => rm.userId === userId);
            if (rmEntry) {
                rmEntry.classId = newSectionId || '__unassigned__';
                rmEntry.className = newSectionId ? (classSections.find(s => s.id === newSectionId)?.name || 'Şube') : 'Sınıfsız';
            }
            window.dcShowToast(`${name} için şube güncellendi.`, 'success');
            // Değişikliği tüm sekmeyi yeniden yükleyip (iskelet-yükleniyor yanıp
            // sönmesine, "sayfa yenilenmiş gibi" hissettiren gecikmeye yol açan
            // refresh()) yerine, sadece ilgili satırı/sayacı yerinde güncelliyoruz.
            _cpRosterPatchRowAfterMove(el, sel, userId, newSectionId, classSections, memberLabel);
            // "Şubeler" paneli ayrı bir statik HTML bloğu olarak gömüldüğü için
            // yukarıdaki satır-patch'i hiç görmüyordu — kart sayaçlarını da güncelle.
            _cpRosterPatchSectionsPanelAfterMove(el, oldSectionId, newSectionId);
            sel.dataset.currentSectionId = newSectionId || '__unassigned__';
            sel.disabled = false;
        });
    });

    // Toplu seçim/işlem: checkbox'lardan seçileni topla, üst çubukta sayaç göster,
    // "Sınıf değiştir" / "Çıkar" işlemlerini seçili tüm üyelere sırayla uygula.
    const rosterBulkBar = el.querySelector('#cp-roster-bulk-bar');
    const rosterBulkCount = el.querySelector('#cp-roster-bulk-count');
    const rosterSelectAll = el.querySelector('#cp-roster-select-all');
    const rosterRowChecks = () => [...el.querySelectorAll('.cp-roster-row-check')];
    const updateRosterBulkBar = () => {
        const checked = rosterRowChecks().filter(cb => cb.checked);
        if (rosterBulkBar) rosterBulkBar.classList.toggle('hidden', checked.length === 0);
        if (rosterBulkCount) rosterBulkCount.textContent = `${checked.length} ${memberLabel.toLowerCase()} seçildi`;
        if (rosterSelectAll) {
            const all = rosterRowChecks();
            rosterSelectAll.checked = all.length > 0 && checked.length === all.length;
            rosterSelectAll.indeterminate = checked.length > 0 && checked.length < all.length;
        }
    };
    rosterRowChecks().forEach(cb => cb.addEventListener('change', updateRosterBulkBar));
    rosterSelectAll?.addEventListener('change', () => {
        rosterRowChecks().forEach(cb => { cb.checked = rosterSelectAll.checked; });
        updateRosterBulkBar();
    });
    el.querySelector('#cp-roster-bulk-clear')?.addEventListener('click', () => {
        rosterRowChecks().forEach(cb => { cb.checked = false; });
        updateRosterBulkBar();
    });
    el.querySelector('#cp-roster-bulk-remove')?.addEventListener('click', async (ev) => {
        const checked = rosterRowChecks().filter(cb => cb.checked);
        if (!checked.length) return;
        const btn = ev.currentTarget;
        const names = checked.map(cb => cb.dataset.name);
        const ok = await window.showFocusaiConfirm({
            title: `${memberLabel === 'Çalışan' ? 'Ekipten' : 'Sınıftan'} Çıkar`,
            desc: `<b>${checked.length}</b> ${memberLabel.toLowerCase()} (${window._escapeHtml(names.join(', '))}) sınıftan çıkarılacak. Emin misin?`,
            type: 'danger', icon: 'fa-user-xmark', confirmText: 'Çıkar', cancelText: 'Vazgeç'
        });
        if (!ok) return;
        btn.disabled = true;
        // Seçili öğrenciler artık farklı sınıflardan olabilir — her birini kendi
        // sınıfından (data-class-id) çıkarmak için gruplandırıp ayrı ayrı silinir.
        const byClass = {};
        checked.forEach(cb => {
            const cid = cb.dataset.classId || data._supaId;
            (byClass[cid] = byClass[cid] || []).push(cb.dataset.userId);
        });
        let hadError = false;
        for (const [cid, userIds] of Object.entries(byClass)) {
            const { error } = await window.FocusSupabase.from('group_members').delete().eq('group_id', cid).in('user_id', userIds);
            if (error) { hadError = true; window.dcShowToast('Çıkarılamadı: ' + error.message, 'error'); }
        }
        btn.disabled = false;
        if (hadError) return;
        window.dcShowToast(`${checked.length} ${memberLabel.toLowerCase()} sınıftan çıkarıldı.`, 'success');
        refresh();
    });
    el.querySelector('#cp-roster-bulk-move')?.addEventListener('change', async (ev) => {
        const sel = ev.currentTarget;
        const val = sel.value;
        if (!val) return;
        const checked = rosterRowChecks().filter(cb => cb.checked);
        if (!checked.length) { sel.value = ''; return; }
        const targetName = val === '__unassigned__' ? 'Sınıfsız' : (classSections.find(s => s.id === val)?.name || 'Şube');
        const names = checked.map(cb => cb.dataset.name).filter(Boolean);
        const ok = await window.showFocusaiConfirm({
            title: 'Şube Değiştir',
            desc: `<b>${checked.length}</b> ${memberLabel.toLowerCase()} (${window._escapeHtml(names.join(', '))}) için şube <b>${window._escapeHtml(targetName)}</b> olarak değiştirilsin mi?`,
            type: 'default', icon: 'fa-chalkboard-user', confirmText: 'Değiştir', cancelText: 'Vazgeç'
        });
        if (!ok) { sel.value = ''; return; }
        sel.disabled = true;
        const userIds = checked.map(cb => cb.dataset.userId);
        // .select() ŞART — RLS sessiz 0-satır durumunu yakala (bkz. tekli atama notu)
        const { data: updRows, error } = await window.FocusSupabase.from('group_members')
            .update({ class_section_id: val === '__unassigned__' ? null : val })
            .eq('group_id', data._supaId).in('user_id', userIds).select('user_id');
        if (error || !updRows || updRows.length === 0) {
            window.dcShowToast('Şube güncellenemedi' + (error ? ': ' + error.message : ' — yetki (RLS) reddetti, 124/125 migration canlıda uygulanmamış olabilir.'), 'error');
            sel.disabled = false; sel.value = ''; return;
        }
        userIds.forEach(uid => _cpPatchMemberSection(data, uid, val === '__unassigned__' ? null : val));
        window.dcShowToast(`${checked.length} ${memberLabel.toLowerCase()} için şube güncellendi.`, 'success');
        refresh();
    });

    // "Öğrenciler" / "Sınıflar" iç-sekme geçişi
    el.querySelectorAll('.cp-roster-innertab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            el.querySelectorAll('.cp-roster-innertab-btn').forEach(b => b.classList.remove('active'));
            el.querySelectorAll('.cp-roster-innertab-panel').forEach(p => p.classList.add('hidden'));
            btn.classList.add('active');
            el.querySelector(`.cp-roster-innertab-panel[data-cprosterpanel="${btn.dataset.cprostersub}"]`)?.classList.remove('hidden');
            el.dataset.activeRosterSubtab = btn.dataset.cprostersub;
        });
    });

    // "Şubeler" alt-görünümü: yeni şube oluştur (bu grubun İÇİNDE, group_class_sections).
    const sectionAddBtn = el.querySelector('#cp-section-add-btn');
    const sectionAddInput = el.querySelector('#cp-section-add-name');
    const sectionAddStatus = el.querySelector('#cp-section-add-status');
    const createSection = async () => {
        const name = (sectionAddInput?.value || '').trim();
        if (!name) { if (sectionAddStatus) sectionAddStatus.textContent = 'Bir şube adı yaz.'; return; }
        if (sectionAddBtn) sectionAddBtn.disabled = true;
        if (sectionAddStatus) sectionAddStatus.textContent = 'Oluşturuluyor…';
        const { error } = await window.FocusSupabase.from('group_class_sections')
            .insert({ group_id: data._supaId, name, created_by: getCurrentUser().id });
        if (sectionAddBtn) sectionAddBtn.disabled = false;
        if (error) {
            if (sectionAddStatus) sectionAddStatus.textContent = error.code === '23505' ? `"${name}" adında bir şube zaten var.` : 'Oluşturulamadı: ' + error.message;
            return;
        }
        window.dcShowToast(`"${name}" şubesi oluşturuldu.`, 'success');
        refresh();
    };
    sectionAddBtn?.addEventListener('click', createSection);
    sectionAddInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') createSection(); });

    // Şube kartına tıklayınca detay modalı: şubedeki öğrenciler, ders programı,
    // adını değiştirme/silme tek yerden yapılır (bkz. _cpOpenSectionDetailModal).
    el.querySelectorAll('.cp-section-card-open').forEach(card => {
        card.addEventListener('click', () => {
            const sectionId = card.dataset.sectionId;
            const sectionName = card.dataset.sectionName;
            const students = rosterMembers.filter(m => m.classId === sectionId)
                .map(m => ({ userId: m.userId, displayName: m.displayName }));
            _cpOpenSectionDetailModal({
                groupId: data._supaId, groupData: data, sectionId, sectionName, memberLabel, students,
                scheduleInfo: scheduleCardByClass[sectionId] || null,
                subjectOptions: scheduleSubjectOptions, buildClassChoices, onChanged: refresh,
            });
        });
        card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); } });
    });
}
export function _wireScheduleAndRosterEvents(el, data, isClassAdmin, ctx, refresh) {
    // Not: Aylık Rapor (ve CSV dışa aktarma) kaldırıldı (2026-07-13, kullanıcı kararı) —
    // buradaki eski #cp-csv-btn bağlama kodu da bu yüzden yok.
    if (isClassAdmin) {
        _ctWireScheduleEvents(el, data, ctx, refresh);
        _ctWireRosterEvents(el, data, ctx, refresh);
    }
}
