import { esc } from './planning.js';

// planning-lesson-plan-assign.js'ten çıkarıldı: durum meta tablosu + saf HTML satır üretici.
export const PVLPA_STATUS_META = {
    invited:            { label: 'Bekliyor',        cls: 'wait' },
    accepted:           { label: 'Onaylandı',       cls: 'ok' },
    revision_requested: { label: 'Revize İstendi',  cls: 'warn' },
    rejected:           { label: 'Reddedildi',      cls: 'bad' },
    completed:          { label: 'Tamamlandı',      cls: 'ok' },
};

// Tek bir atama satırının HTML'i — hem tek-plan hem gruba-özel (Sınıf Paneli >
// Ders Planı) görünümde paylaşılır. `showGoalTitle` gruba-özel görünümde birden
// fazla plan karışabileceği için başlığı da gösterir. `opts.deleteStatuses`:
// hangi durumlarda "Sil" butonu gösterilsin.
export function _lpaStatusRowHTML(r, showGoalTitle, showResendBtn, opts) {
    showResendBtn = showResendBtn !== false;
    opts = opts || {};
    const deleteStatuses = opts.deleteStatuses || [];
    const meta = PVLPA_STATUS_META[r.status] || { label: r.status, cls: '' };
    const name = esc(r.profiles?.display_name || r.profiles?.username || '?');
    const daysLeft = r.status === 'rejected' && r.expires_at ? Math.max(0, Math.ceil((new Date(r.expires_at) - Date.now()) / 86400000)) : null;
    return `
    <div class="pg-pv-assign-row${opts.isStudentView ? ' pg-pv-assign-row--premium' : ''}" data-lpa-id="${r.id}" data-goal-id="${r.goal_id || ''}">
        ${!opts.isStudentView ? `<span class="pg-pv-assign-name">${name}</span>` : ''}
        ${showGoalTitle ? `<span class="pg-pv-assign-goal">${esc(r.goal_title || '')}</span>` : ''}
        <span class="pg-pv-assign-badge ${meta.cls}${opts.isStudentView ? ' pg-pv-assign-badge--end' : ''}">${meta.label}</span>
        ${r.status === 'accepted' || r.status === 'completed' ? `<span class="pg-pv-assign-progress">%${r.progress_pct || 0}</span>` : ''}
        ${r.student_note ? `<div class="pg-pv-assign-note"><i class="ti ti-message-circle"></i> ${esc(r.student_note)}</div>` : ''}
        ${daysLeft !== null ? `<span class="pg-pv-assign-expiry">${daysLeft} gün sonra otomatik silinir</span>` : ''}
        ${(opts.showEditBtn && r.status === 'revision_requested') ? `
        <button class="pg-lpa-mini-btn pg-pv-assign-edit-btn" data-goal-id="${r.goal_id}" title="Planı düzenle">
            <i class="ti ti-pencil"></i> Düzenle
        </button>` : ''}
        ${(showResendBtn && (r.status === 'revision_requested' || r.status === 'rejected')) ? `
        <button class="control-btn secondary pg-pv-assign-resend-btn" data-lpa-id="${r.id}" data-student-id="${r.student_id}" data-goal-title="${esc(r.goal_title || '')}">
            <i class="ti ti-send"></i> Planı Düzenledim, Tekrar Gönder
        </button>` : ''}
        ${deleteStatuses.includes(r.status) ? `
        <button class="pg-lpa-mini-btn pg-pv-assign-delete-btn" data-lpa-id="${r.id}" title="Şimdi sil">
            <i class="ti ti-trash"></i> Sil
        </button>` : ''}
    </div>`;
}
