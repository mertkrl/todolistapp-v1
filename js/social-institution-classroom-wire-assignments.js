// social-institution-classroom-wire-assignments.js
// social-institution-classroom-wire.js'ten çıkarıldı: Ödevler sekmesi (hedef/sınıf/
// şablon seçiciler, ödev ekleme/silme/kapama, öğrenci teslim formu, notlandırma,
// hatırlatma, çok-adımlı ödev işaretleme). `refresh` üst orkestratörden gelir.
import { getCurrentUser } from '../state/current-user-store.js';

export function _ctWireAssignmentSetup(el, data, ctx) {
const { assignments, subsByAsg, templates, allInstitutionClasses, studentMembers, targetMembers } = ctx;
// Hedef seçici: "Tüm sınıf" kutusu işaretliyken bireysel öğrenci listesi gizli/pasif;
// kaldırıldığında liste açılır ve seçilen kişiler target_user_ids'e yazılır.
const targetAllBox = el.querySelector('#cp-asg-target-allbox');
const targetStudentsBox = el.querySelector('#cp-asg-target-students');
const targetSummaryEl = el.querySelector('#cp-asg-target-summary');
// Tarayıcı, aynı sayfada yeniden render edilen checkbox'ların işaretli
// durumunu bazen bir önceki render'dan "hatırlayıp" geri getiriyor
// (form-restore davranışı) — her açılışta tümü kesin olarak boş/varsayılan
// duruma sıfırlanır: "Tüm sınıf" işaretli, bireysel öğrenciler boş.
if (targetAllBox) targetAllBox.checked = true;
el.querySelectorAll('.cp-asg-target-student').forEach(cb => { cb.checked = false; });
targetStudentsBox?.classList.add('hidden');
const updateTargetSummary = () => {
    if (!targetSummaryEl) return;
    if (targetAllBox?.checked) { targetSummaryEl.textContent = 'Tüm sınıf'; return; }
    const n = el.querySelectorAll('.cp-asg-target-student:checked').length;
    targetSummaryEl.textContent = n ? `${n} kişi seçili` : 'Kimse seçilmedi';
};
targetAllBox?.addEventListener('change', () => {
    targetStudentsBox?.classList.toggle('hidden', targetAllBox.checked);
    if (targetAllBox.checked) el.querySelectorAll('.cp-asg-target-student').forEach(cb => { cb.checked = false; });
    updateTargetSummary();
});
el.querySelectorAll('.cp-asg-target-student').forEach(cb => cb.addEventListener('change', updateTargetSummary));

// Sınıf seçici: başka bir sınıfa ödev vermek için o sınıfın öğrenci listesini
// "Kime atanacak?" bölümüne yükler (bkz. cp-asg-add — ödev, seçilen sınıfın
// group_id'sine yazılır).
const classPick = el.querySelector('#cp-asg-class-pick');
classPick?.addEventListener('change', () => {
    const cls = allInstitutionClasses.find(c => c.id === classPick.value);
    const members = (cls?.members || []).filter(m => m.userId && m.userId !== getCurrentUser().id);
    if (targetStudentsBox) {
        targetStudentsBox.innerHTML = members.map(s => `
            <label class="cp-asg-target-row">
                <input type="checkbox" class="cp-asg-target-student" value="${s.userId}">
                <span>${window._escapeHtml(s.displayName)}</span>
            </label>`).join('') || '<p class="cp-hint">Bu sınıfta henüz öğrenci yok.</p>';
        targetStudentsBox.querySelectorAll('.cp-asg-target-student').forEach(cb => cb.addEventListener('change', updateTargetSummary));
    }
    if (targetAllBox) { targetAllBox.checked = true; }
    targetStudentsBox?.classList.add('hidden');
    updateTargetSummary();
});

// Şablon seçilince formu doldurur
const templatePick = el.querySelector('#cp-asg-template-pick');
const templateDelBtn = el.querySelector('#cp-asg-template-del');
templatePick?.addEventListener('change', () => {
    const t = templates.find(t => t.id === templatePick.value);
    templateDelBtn.style.display = t ? '' : 'none';
    if (!t) return;
    el.querySelector('#cp-asg-title').value = t.title || '';
    el.querySelector('#cp-asg-desc').value = t.description || '';
    el.querySelector('#cp-asg-priority').value = t.priority || 'normal';
});
templateDelBtn?.addEventListener('click', async () => {
    const t = templates.find(t => t.id === templatePick.value);
    if (!t) return;
    const ok = await window.showFocusaiConfirm({
        title: 'Şablonu Sil', desc: `<b>${window._escapeHtml(t.title)}</b> şablonunu silmek istediğine emin misin?`,
        type: 'danger', icon: 'fa-trash-can', confirmText: 'Sil', cancelText: 'Vazgeç'
    });
    if (!ok) return;
    await window.FocusSupabase.from('assignment_templates').delete().eq('id', t.id);
    refresh();
});

// Karakter sayacı — başlık ve açıklama
const titleInput = el.querySelector('#cp-asg-title');
const titleCountEl = el.querySelector('#cp-asg-title-count');
titleInput?.addEventListener('input', () => {
    if (titleCountEl) titleCountEl.textContent = `${titleInput.value.length}/${titleInput.maxLength}`;
});
const descInput = el.querySelector('#cp-asg-desc');
const descCountEl = el.querySelector('#cp-asg-desc-count');
descInput?.addEventListener('input', () => {
    if (descCountEl) descCountEl.textContent = `${descInput.value.length}/${descInput.maxLength}`;
});

// Dosya seçilince adını göster
const fileInput = el.querySelector('#cp-asg-file');
const fileNameEl = el.querySelector('#cp-asg-file-name');
fileInput?.addEventListener('change', () => {
    const f = fileInput.files?.[0];
    if (f) fileNameEl.innerHTML = `<i class="fa-solid fa-file"></i> ${window._escapeHtml(f.name)}`;
});
    return { targetAllBox, classPick, fileInput };
}
export function _ctWireAssignmentActions(el, data, ctx, refresh, refs) {
    const { assignments, subsByAsg, templates, allInstitutionClasses, studentMembers, targetMembers } = ctx;
    const { targetAllBox, classPick, fileInput } = refs;
// Notlandırma: her teslim satırı için puan + geri bildirim kaydı
el.querySelectorAll('.cp-grade-row').forEach(row => {
    row.querySelector('.cp-grade-save')?.addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        const asgId = row.dataset.asgId, userId = row.dataset.userId;
        const gradeVal = row.querySelector('.cp-grade-input')?.value;
        const feedbackVal = row.querySelector('.cp-grade-feedback')?.value.trim();
        btn.disabled = true;
        const { error } = await window.FocusSupabase.from('assignment_submissions')
            .update({
                grade: gradeVal === '' ? null : Math.max(0, Math.min(100, parseInt(gradeVal, 10))),
                teacher_feedback: feedbackVal || null
            })
            .eq('assignment_id', asgId).eq('user_id', userId);
        btn.disabled = false;
        if (error) { window.dcShowToast('Kaydedilemedi: ' + error.message, 'error'); return; }
        window.dcShowToast('Not kaydedildi.', 'success');
    });
});

// Teslim etmeyenlere hatırlatma bildirimi
el.querySelectorAll('.cp-asg-remind').forEach(btn => btn.addEventListener('click', async (e) => {
    e.preventDefault();
    const asgId = btn.dataset.id;
    const a = assignments.find(x => x.id === asgId);
    if (!a) return;
    const subs = subsByAsg[asgId] || [];
    const targets = targetMembers(a).filter(m => !subs.includes(m.userId));
    if (!targets.length) return;
    btn.disabled = true;
    const rows = targets.map(m => ({
        user_id: m.userId,
        type: 'assignment_reminder',
        payload: {
            fromName: getCurrentUser().displayName || getCurrentUser().username,
            groupCode: data.code, groupName: data.name,
            assignmentTitle: a.title, dueDate: a.due_date
        }
    }));
    const { error } = await window.FocusSupabase.from('notifications').insert(rows);
    if (error) { window.dcShowToast('Gönderilemedi: ' + error.message, 'error'); btn.disabled = false; return; }
    window.dcShowToast(`${targets.length} kişiye hatırlatma gönderildi.`, 'success');
    btn.textContent = 'Hatırlatma gönderildi ✓';
}));

// "Ekle" butonu — Bugün sekmesindeki görev ekleme çubuğuyla (td-toggle-add/td-add-form)
// aynı davranış: form varsayılan gizli, butona basınca açılıp odak başlık alanına gider.
const asgToggleAdd = el.querySelector('#cp-asg-toggle-add');
const asgAddForm = el.querySelector('#cp-asg-add-form');
if (asgToggleAdd && asgAddForm) {
    asgToggleAdd.addEventListener('click', () => {
        const open = !asgAddForm.classList.contains('is-hidden');
        asgAddForm.classList.toggle('is-hidden', open);
        asgToggleAdd.classList.toggle('is-open', !open);
        if (!open) el.querySelector('#cp-asg-title')?.focus();
    });
}

el.querySelector('#cp-asg-add')?.addEventListener('click', async (e) => {
    const addBtn = e.currentTarget;
    const title = el.querySelector('#cp-asg-title')?.value.trim();
    const due = el.querySelector('#cp-asg-due')?.value || null;
    const description = el.querySelector('#cp-asg-desc')?.value.trim() || '';
    const priority = el.querySelector('#cp-asg-priority')?.value || 'normal';
    const file = fileInput?.files?.[0];
    if (!title) { window.dcShowToast('Bir başlık yaz.'); return; }
    const useAll = targetAllBox?.checked !== false;
    const selectedIds = [...el.querySelectorAll('.cp-asg-target-student:checked')].map(cb => cb.value);
    if (!useAll && !selectedIds.length) { window.dcShowToast('En az bir kişi seç ya da "Tüm sınıf" kutusunu işaretle.'); return; }
    // Sınıf seçici varsa (kurumun birden fazla sınıfı varsa) ödev, seçilen sınıfa
    // yazılır — yoksa mevcut sınıfa (varsayılan davranış).
    const targetClassId = classPick?.value || data._supaId;
    const targetClass = allInstitutionClasses.find(c => c.id === targetClassId);
    addBtn.disabled = true;
    let attachment = null;
    if (file) {
        if (file.size > 15 * 1024 * 1024) { window.dcShowToast('Dosya boyutu 15MB\'ı geçemez.'); addBtn.disabled = false; return; }
        const ext = file.name.split('.').pop() || 'bin';
        const path = `assignment/${targetClassId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { data: up, error: upErr } = await window.FocusSupabase.storage.from('chat-files').upload(path, file, { upsert: false });
        if (upErr) { window.dcShowToast('Dosya yüklenemedi: ' + upErr.message, 'error'); addBtn.disabled = false; return; }
        attachment = { name: file.name, size: file.size, type: file.type, bucket_path: up.path };
    }
    const { error } = await window.FocusSupabase.from('classroom_assignments').insert({
        group_id: targetClassId, created_by: getCurrentUser().id,
        title, description, priority,
        due_date: due ? new Date(due + 'T23:59:59').toISOString() : null,
        target_user_ids: useAll ? null : selectedIds,
        attachment
    });
    if (error) { window.dcShowToast('Ödev eklenemedi: ' + error.message, 'error'); addBtn.disabled = false; return; }
    // Hedeflenen öğrencilere yeni ödev bildirimi — sistem genelinde senkron olması için
    // (bugün/takvim rozetleri, "Ödevlerim" özeti) bunlar zaten Supabase realtime ile
    // classroom_assignments tablosunu dinliyor; bu sadece anlık toast/bildirim.
    const notifyIds = useAll
        ? (targetClassId === data._supaId
            ? studentMembers.filter(m => m.userId !== getCurrentUser().id).map(m => m.userId)
            : (targetClass?.members || []).filter(m => m.userId && m.userId !== getCurrentUser().id).map(m => m.userId))
        : selectedIds;
    if (notifyIds.length) {
        await window.FocusSupabase.from('notifications').insert(notifyIds.map(userId => ({
            user_id: userId,
            type: 'assignment_new',
            payload: {
                fromName: getCurrentUser().displayName || getCurrentUser().username,
                groupCode: targetClass?.code || data.code, groupName: targetClass?.name || data.name,
                assignmentTitle: title, dueDate: due ? new Date(due + 'T23:59:59').toISOString() : null
            }
        })));
    }
    window.dcShowToast(useAll ? `${targetClass?.name || data.name} sınıfına eklendi 📋` : `${selectedIds.length} kişiye atandı 📋`, 'success');
    refresh();
});
el.querySelectorAll('[data-cp-act]').forEach(btn => btn.addEventListener('click', async () => {
    const id = btn.dataset.id, act = btn.dataset.cpAct;
    if (act === 'undo') {
        await window.FocusSupabase.from('assignment_submissions').delete().eq('assignment_id', id).eq('user_id', getCurrentUser().id);
    } else if (act === 'close') {
        await window.FocusSupabase.from('classroom_assignments').update({ status: 'closed' }).eq('id', id);
    } else if (act === 'delete') {
        const ok = await window.showFocusaiConfirm({
            title: 'Ödevi Sil', desc: 'Bu ödev ve tüm teslimleri kalıcı olarak silinsin mi?',
            type: 'danger', icon: 'fa-trash-can', confirmText: 'Sil', cancelText: 'Vazgeç'
        });
        if (!ok) return;
        await window.FocusSupabase.from('classroom_assignments').delete().eq('id', id);
    }
    refresh();
}));

// Öğrenci teslim formu: not + opsiyonel dosya/fotoğraf eki
el.querySelectorAll('.cp-asg-submit-file').forEach(input => input.addEventListener('change', () => {
    const f = input.files?.[0];
    const nameEl = input.closest('.cp-asg-file-label')?.querySelector('.cp-asg-submit-file-name');
    if (f && nameEl) nameEl.innerHTML = `<i class="fa-solid fa-file"></i> ${window._escapeHtml(f.name)}`;
}));
el.querySelectorAll('.cp-asg-submit-confirm').forEach(btn => btn.addEventListener('click', async () => {
    const id = btn.dataset.id;
    const form = btn.closest('.cp-asg-submit-body');
    const note = (form.querySelector('.cp-asg-submit-note')?.value || '').trim().slice(0, 200);
    const file = form.querySelector('.cp-asg-submit-file')?.files?.[0];
    btn.disabled = true;
    let attachment = null;
    if (file) {
        if (file.size > 15 * 1024 * 1024) { window.dcShowToast('Dosya boyutu 15MB\'ı geçemez.'); btn.disabled = false; return; }
        const ext = file.name.split('.').pop() || 'bin';
        const path = `assignment-submission/${id}/${getCurrentUser().id}_${Date.now()}.${ext}`;
        const { data: up, error: upErr } = await window.FocusSupabase.storage.from('chat-files').upload(path, file, { upsert: true });
        if (upErr) { window.dcShowToast('Dosya yüklenemedi: ' + upErr.message, 'error'); btn.disabled = false; return; }
        attachment = { name: file.name, size: file.size, type: file.type, bucket_path: up.path };
    }
    const { error } = await window.FocusSupabase.from('assignment_submissions')
        .upsert({ assignment_id: id, user_id: getCurrentUser().id, note: note || null, attachment });
    if (error) { window.dcShowToast('Teslim edilemedi: ' + error.message, 'error'); btn.disabled = false; return; }
    if (typeof window.fireConfetti === 'function') window.fireConfetti();
    window.dcShowToast('Harika iş! Ödev teslim edildi 🎉', 'success');
    refresh();
}));

// Çok adımlı ödev / ders planı — öğrenci bir adımı işaretler
el.querySelectorAll('.cp-asg-step-check').forEach(cb => cb.addEventListener('change', async () => {
    const asgId = cb.dataset.asgId, stepId = cb.dataset.stepId, doneNow = cb.checked;
    cb.disabled = true;
    const { error } = await window.FocusSupabase.from('assignment_step_progress')
        .upsert({ assignment_id: asgId, user_id: getCurrentUser().id, step_id: stepId, done: doneNow, done_at: doneNow ? new Date().toISOString() : null },
            { onConflict: 'assignment_id,user_id,step_id' });
    if (error) { window.dcShowToast('Kaydedilemedi: ' + error.message, 'error'); cb.checked = !doneNow; cb.disabled = false; return; }
    const allChecked = [...el.querySelectorAll(`.cp-asg-step-check[data-asg-id="${asgId}"]`)].every(c => c.checked);
    if (allChecked && typeof window.fireConfetti === 'function') window.fireConfetti();
    refresh();
}));
}
export function _wireAssignmentFormEvents(el, data, isClassAdmin, ctx, refresh) {
    const refs = _ctWireAssignmentSetup(el, data, ctx);
    _ctWireAssignmentActions(el, data, ctx, refresh, refs);
}
