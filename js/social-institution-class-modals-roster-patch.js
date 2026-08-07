// social-institution-class-modals-roster-patch.js
// social-institution-class-modals.js'ten çıkarıldı: öğrenci/şube listesi
// satır-içi yama fonksiyonları (tam re-render yerine yerinde güncelleme).
// Tamamen izole — sadece kendi parametrelerine ve window._escapeHtml'e bağımlı.

export function _cpPatchMemberSection(groupData, userId, sectionId) {
    if (!groupData?.members) return;
    for (const uname in groupData.members) {
        if (groupData.members[uname]?.userId === userId) { groupData.members[uname].classSectionId = sectionId; break; }
    }
}

export function _cpRosterPatchRowAfterMove(el, sel, userId, newSectionId, classSections, memberLabel) {
    const row = sel.closest('.cp-roster-row');
    const newName = newSectionId ? (classSections.find(s => s.id === newSectionId)?.name || 'Şube') : 'Sınıfsız';
    const badge = row?.querySelector('.cp-roster-row-class');
    if (badge) {
        badge.textContent = newName;
        badge.title = newName;
        badge.classList.toggle('cp-roster-row-class--unassigned', !newSectionId);
    }
    const sectionOptions = classSections.filter(s => s.id !== newSectionId);
    sel.innerHTML = `
        <option value="">${newSectionId ? 'Şube değiştir…' : 'Şubeye ata…'}</option>
        ${sectionOptions.map(s => `<option value="${s.id}">${window._escapeHtml(s.name)}</option>`).join('')}
        ${newSectionId ? `<option value="__unassigned__">— Sınıfsız yap —</option>` : ''}`;
    sel.value = '';
    _cpRosterUpdateUnassignedWarning(el, memberLabel);
}
export function _cpRosterUpdateUnassignedWarning(el, memberLabel) {
    if (!el) return;
    const count = el.querySelectorAll('.cp-roster-row-class--unassigned').length;
    let warningEl = el.querySelector('#cp-roster-unassigned-warning');
    if (count === 0) { warningEl?.remove(); return; }
    const text = `<b>${count}</b> ${(memberLabel || 'öğrenci').toLowerCase()} henüz bir şubeye atanmadı — "Sınıfsız" olarak listeleniyor.`;
    if (!warningEl) {
        const toolbar = el.querySelector('.cp-roster-toolbar');
        if (!toolbar) return;
        warningEl = document.createElement('div');
        warningEl.id = 'cp-roster-unassigned-warning';
        warningEl.className = 'cp-roster-unassigned-warning';
        warningEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i><span></span>`;
        toolbar.before(warningEl);
    }
    const span = warningEl.querySelector('span');
    if (span) span.innerHTML = text;
}
export function _cpRosterPatchSectionsPanelAfterMove(el, oldSectionId, newSectionId) {
    const panel = el?.querySelector('[data-cprosterpanel="siniflar"]');
    if (!panel) return;
    const bump = (sectionId, delta) => {
        if (!sectionId || sectionId === '__unassigned__') return;
        const card = panel.querySelector(`.cp-inst-class-card[data-section-id="${sectionId}"]`);
        const metaEl = card?.querySelector('.cp-inst-class-meta');
        if (!metaEl) return;
        const match = metaEl.textContent.match(/\d+/);
        const current = match ? parseInt(match[0], 10) : 0;
        metaEl.textContent = metaEl.textContent.replace(/\d+/, String(Math.max(0, current + delta)));
    };
    bump(oldSectionId, -1);
    bump(newSectionId, 1);
}
