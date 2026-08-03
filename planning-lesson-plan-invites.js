import { fmtDate } from './planning-utils.js';
// ─── SINIF PANELİ > DERS PLANI — ÖĞRENCİ DAVET KUTUSU ──────────────────
// planning.js dosyasından çıkarıldı (Faz 2, 2026-07-20). Öğrencinin
// öğretmenden gelen ders planı davetlerini görüntülemesi, önizlemesi,
// revize/red etmesi (kabul akışı `_acceptLessonPlanInvite` çakışma
// çözümü sistemiyle çok iç içe olduğu için planning.js'te kaldı, bkz.
// window._acceptLessonPlanInvite köprüsü).
//
// Dış bağımlılıklar (hepsi planning.js'te kalıyor, window.* köprüsüyle
// açıldı):
// - goals → getPgGoals() / setPgGoals() (reassign edildiği
//   için salt-okunur referans yetmiyor, setter da gerekli)
// - persistGoals, render, toast, esc, openPlanView → window.*
// - _lpaStatusRowHTML, _pvAddHour, _acceptLessonPlanInvite → window.*
//   (planning.js'te kalan, birbirine bağımlı fonksiyonlar)
// - pvReadOnly / pvReadOnlyTempId (planning.js modül-içi state, doğrudan
//   yazılamıyor) → setPvReadOnlyPreview(val, tempId)
// - window.FocusSupabase / getCurrentUser() / window.fmtDate /
//   FocusStorage / window.showFocusaiConfirm → zaten global
import { getPgGoals, setPgGoals, persistGoals, toast, esc, openPlanView, acceptLessonPlanInvite, setPvReadOnlyPreview, pvAddHour } from './planning.js';
import { getCurrentUser } from './state/current-user-store.js';

// Bir davet kartının HTML'i — Planlama sayfasındaki (artık gizli) genel kutu VE
// Sınıf Paneli > Ders Planı sekmesindeki gruba-özel liste aynı işaretlemeyi (ve
// aynı kabul/revize/red fonksiyonlarını) paylaşır.
function _lpaInviteCardHTML(inv) {
    const groupName = esc(inv.groups?.name || 'sınıfın');
    const metaParts = [groupName];
    if (inv.deadline) metaParts.push(`Son tarih: ${fmtDate(inv.deadline)}`);
    return `
        <div class="pg-lpa-invite-card" data-lpa-id="${inv.id}" data-goal-id="${inv.goal_id}" data-group-code="${esc(inv.groups?.code || '')}">
            <div class="pg-lpa-invite-top">
                <i class="ti ti-school"></i>
                <div class="pg-lpa-invite-body">
                    <div class="pg-lpa-invite-title">${esc(inv.goal_title || 'Ders Planı')}</div>
                    <div class="pg-lpa-invite-meta">${metaParts.join(' · ')}</div>
                    ${inv.teacher_note ? `<div class="pg-lpa-teacher-note"><i class="ti ti-message-circle"></i> ${esc(inv.teacher_note)}</div>` : ''}
                </div>
            </div>
            <div class="pg-lpa-invite-actions">
                <button class="pg-lpa-mini-btn pg-lpa-review" data-id="${inv.id}" data-goal-id="${inv.goal_id}" title="İncele"><i class="ti ti-eye"></i> İncele</button>
                <div class="pg-lpa-invite-actions-right">
                    <button class="pg-lpa-mini-btn pg-lpa-reject" data-id="${inv.id}" title="Reddet"><i class="ti ti-x"></i></button>
                    <button class="pg-lpa-mini-btn pg-lpa-revise" data-id="${inv.id}" title="Revize İste"><i class="ti ti-edit"></i></button>
                    <button class="pg-lpa-mini-btn pg-lpa-accept" data-id="${inv.id}" data-goal-id="${inv.goal_id}" title="Kabul Et"><i class="ti ti-check"></i> Kabul Et</button>
                </div>
            </div>
        </div>`;
}
window._lpaInviteCardHTML = _lpaInviteCardHTML;

function _bindLpaInviteCard(box) {
    box.querySelectorAll('.pg-lpa-review').forEach(btn => btn.onclick = () => _toggleLessonPlanPreview(btn.dataset.id, btn.dataset.goalId));
    box.querySelectorAll('.pg-lpa-accept').forEach(btn => btn.onclick = () => acceptLessonPlanInvite(btn.closest('.pg-lpa-invite-card')));
    box.querySelectorAll('.pg-lpa-revise').forEach(btn => btn.onclick = () => _promptLessonPlanNote(btn.dataset.id, btn.closest('.pg-lpa-invite-card'), 'revise'));
    box.querySelectorAll('.pg-lpa-reject').forEach(btn => btn.onclick = () => _promptLessonPlanNote(btn.dataset.id, btn.closest('.pg-lpa-invite-card'), 'reject'));
}
window._bindLpaInviteCard = _bindLpaInviteCard;

// Sınıf Paneli > Ders Planı sekmesi — bu gruba özel TÜM ders planı atamalarını
// render eder (öğrenci tarafı): bekleyenler tam kart (İncele/Kabul/Revize/Reddet),
// geri kalanı (kabul/revize istendi/red/tamamlandı) kısa durum satırı olarak.
async function renderStudentLessonPlanInvitesForGroup(groupId, containerEl) {
    if (!containerEl || !window.FocusSupabase || !getCurrentUser()) return;
    const sb = window.FocusSupabase, uid = getCurrentUser().id;
    let rows;
    try {
        ({ data: rows } = await sb
            .from('lesson_plan_assignments')
            .select('id, goal_id, group_id, deadline, status, student_note, teacher_id, teacher_note, progress_pct, goal_title, profiles!lesson_plan_assignments_teacher_id_fkey(display_name, username), groups(name, code)')
            .eq('student_id', uid).eq('group_id', groupId)
            .order('assigned_at', { ascending: false }));
    } catch (e) {
        console.warn('[FocusAI] renderStudentLessonPlanInvitesForGroup:', e);
        containerEl.innerHTML = '<p class="cp-hint">Ders planları yüklenemedi. Bağlantını kontrol edip tekrar dene.</p>';
        return;
    }
    if (!rows || !rows.length) { containerEl.innerHTML = '<p class="cp-hint">Bu sınıf için henüz sana atanmış bir ders planı yok.</p>'; return; }

    const invites = rows.filter(r => r.status === 'invited');
    const rest = rows.filter(r => r.status !== 'invited');
    containerEl.innerHTML = `
        ${invites.map(inv => _lpaInviteCardHTML(inv)).join('')}
        ${rest.length ? `<div class="pg-pv-assign-status-list">${rest.map(r => window._lpaStatusRowHTML(r, true, false, { deleteStatuses: ['rejected'], isStudentView: true })).join('')}</div>` : ''}`;
    const statusListEl = containerEl.querySelector('.pg-pv-assign-status-list');
    if (statusListEl) statusListEl.style.marginTop = invites.length ? '10px' : '0';
    _bindLpaInviteCard(containerEl);

    // Reddedilen bir isteği öğrenci 7 gün beklemeden kendi de silebilir
    containerEl.querySelectorAll('.pg-pv-assign-delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            let ok;
            try {
                ok = await window.showFocusaiConfirm({
                    title: 'Ders Planı Kaydını Sil',
                    desc: 'Bu reddedilen kayıt kalıcı olarak silinsin mi?',
                    type: 'danger', icon: 'fa-trash-can', confirmText: 'Sil', cancelText: 'Vazgeç',
                });
            } catch (e) { console.warn('[FocusAI] sessiz hata:', e); return; }
            if (!ok) return;
            btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader-2 pg-sync-spin"></i>';
            try {
                await sb.from('lesson_plan_assignments').delete().eq('id', btn.dataset.lpaId);
                renderStudentLessonPlanInvitesForGroup(groupId, containerEl);
            } catch (e) {
                console.warn('[FocusAI] lesson_plan_assignments silme hatası:', e);
                btn.disabled = false; btn.innerHTML = 'Sil';
            }
        });
    });
}
window.renderStudentLessonPlanInvitesForGroup = renderStudentLessonPlanInvitesForGroup;

// "İncele" — öğretmenin planını, planlama arayüzünün TAMAMINDA (takvim + aşamalar)
// salt okunur önizleme modunda açar. Basit bir tabloya indirgemek yerine gerçek
// Plan Görünümü'nü kullanır ki öğretmen aşamayı "Aşama Ekle" ile mi yoksa takvimden
// saat saat mi oluşturmuş olursa olsun, öğrenci aynı görünümü görsün.
async function _toggleLessonPlanPreview(lpaId, goalId) {
    const sb = window.FocusSupabase;
    // planning_goals/planning_milestones'ın RLS'i sadece sahibinin okumasına izin verir —
    // öğrenci öğretmenin planını göremez. Bu yüzden 098_lesson_plan_preview_rpc.sql'deki
    // SECURITY DEFINER RPC kullanılıyor (çağıran ya sahip ya da bu goal_id için bir
    // lesson_plan_assignments kaydı olan taraf olmalı).
    let preview, error;
    try {
        ({ data: preview, error } = await sb.rpc('lesson_plan_preview', { p_goal_id: goalId }));
    } catch (e) {
        console.warn('[FocusAI] lesson_plan_preview:', e);
        toast('Plan yüklenemedi.'); return;
    }
    if (error || !preview) { toast('Plan yüklenemedi.'); return; }
    const tGoal = preview, tMs = preview.milestones || [];

    const previewMs = (tMs || []).map(m => ({
        id: m.id, title: m.title, due_date: m.due_date || '', start_date: m.start_date || '',
        start_time: m.start_time || '', end_time: m.end_time || '',
        is_task_mirror: !!m.is_task_mirror,
        done: !!m.done, order: m.order_index, description: m.description || '',
    }));
    const tempId = 'lpa_preview_' + lpaId;
    // Önceki önizleme kalıntısı varsa temizle
    let goals = getPgGoals().filter(x => x.id !== tempId);
    goals.unshift({
        id: tempId, title: tGoal.title, description: tGoal.description || '',
        category: tGoal.category, color: tGoal.color, deadline: tGoal.deadline || null,
        priority: tGoal.priority || 2, status: 'active', progress_pct: tGoal.progress_pct || 0,
        milestones: previewMs, plan_mode: 'lesson-plan', context: { lessonPlanReadOnly: true },
    });
    setPgGoals(goals);

    // "Günün Görevleri" paneli ve ısı/gün renklendirmesi milestone değil `tasks`
    // dizisini okuyor — önizleme için saatli aşamaları geçici (kalıcı olmayan,
    // kapanınca silinen) görevler olarak da FocusStorage'a yazıyoruz.
    const allTasks = FocusStorage.get('tasks', []);
    const previewTasks = previewMs.filter(m => m.due_date && m.start_time).map(m => {
        const [y, mo, dd] = m.due_date.split('-');
        return {
            id: 'lpa_prev_task_' + m.id, text: m.title, completed: !!m.done,
            date: `${dd}-${mo}-${y}`, timeStart: m.start_time, timeEnd: m.end_time || pvAddHour(m.start_time),
            priority: tGoal.priority || 2, category: tGoal.category || '', parentGoal: tempId,
        };
    });
    FocusStorage.set('tasks', [...allTasks, ...previewTasks]);

    setPvReadOnlyPreview(true, tempId);
    openPlanView(tempId);
    localStorage.removeItem('pg_pv_last_goal'); // önizleme kalıcı değil, sayfa yenilenince tekrar açılmasın
}
window._toggleLessonPlanPreview = _toggleLessonPlanPreview;

// Revize İste / Reddet — açıklama yazmadan gönderilemez (öğretmenin ne yapması gerektiğini bilmesi için)
function _promptLessonPlanNote(lpaId, card, kind) {
    const existing = card.querySelector('.pg-lpa-note-box');
    if (existing) { existing.remove(); return; }
    const box = document.createElement('div');
    box.className = 'pg-lpa-note-box';
    const isReject = kind === 'reject';
    box.innerHTML = `
        <textarea class="pg-lpa-note-inp" maxlength="300" placeholder="${isReject ? 'Neden reddettiğini kısaca yaz (öğretmenine gidecek)…' : 'Ne değişmeli? (örn: Salı 15:00 yerine 17:00 uygun olur)…'}"></textarea>
        <div class="pg-lpa-note-actions">
            <button class="control-btn secondary pg-lpa-note-cancel">Vazgeç</button>
            <button class="control-btn ${isReject ? 'danger' : 'primary'} pg-lpa-note-send">${isReject ? 'Reddet' : 'Revize İste'}</button>
        </div>`;
    card.appendChild(box);
    const inp = box.querySelector('.pg-lpa-note-inp');
    inp.focus();
    box.querySelector('.pg-lpa-note-cancel').onclick = () => box.remove();
    box.querySelector('.pg-lpa-note-send').onclick = async () => {
        const note = inp.value.trim();
        if (!note) { inp.focus(); return; }
        if (kind === 'reject') await _rejectLessonPlanInvite(lpaId, card, note);
        else await _requestLessonPlanRevision(lpaId, card, note);
    };
}
window._promptLessonPlanNote = _promptLessonPlanNote;

// "Düzenle" ile oluşturulmuş ama hiç kabul edilmemiş (pending_accept) bir taslak
// varsa — öğrenci revize istedi/reddetti — o taslağı ve aynalanmış görevlerini
// temizler, aksi halde kabul edilmemiş bir hedef yereldeki listede takılı kalır.
function _lpaDiscardDraft(lpaId) {
    const goals = getPgGoals();
    const draft = goals.find(x => x.lpa_id === lpaId && x.pending_accept);
    if (!draft) return;
    setPgGoals(goals.filter(x => x.id !== draft.id));
    persistGoals();
    const remainingTasks = FocusStorage.get('tasks', []).filter(t => String(t.parentGoal) !== String(draft.id));
    FocusStorage.set('tasks', remainingTasks);
    if (typeof window.syncTasksFromStorage === 'function') window.syncTasksFromStorage();
    if (typeof window.renderCalendarGlobal === 'function') window.renderCalendarGlobal();
    window.render();
}
window._lpaDiscardDraft = _lpaDiscardDraft;

async function _requestLessonPlanRevision(lpaId, card, note) {
    const sb = window.FocusSupabase;
    card.style.opacity = '.5'; card.style.pointerEvents = 'none';
    _lpaDiscardDraft(lpaId);
    try {
        const { data: lpa } = await sb.from('lesson_plan_assignments')
            .update({ status: 'revision_requested', student_note: note, responded_at: new Date().toISOString() })
            .eq('id', lpaId).select('teacher_id, goal_id').single();
        if (lpa?.teacher_id) {
            await sb.from('notifications').insert([{
                user_id: lpa.teacher_id, type: 'lesson_plan_revision_requested',
                payload: { fromName: getCurrentUser().displayName || getCurrentUser().username, goalId: lpa.goal_id, note, groupCode: card.dataset.groupCode || null },
            }]);
        }
    } catch (e) {
        console.warn('[FocusAI] _requestLessonPlanRevision:', e);
        card.style.opacity = ''; card.style.pointerEvents = '';
        toast('Revize isteği gönderilemedi, tekrar dene.');
        return;
    }
    card.remove();
    if (!document.querySelectorAll('.pg-lpa-invite-card').length) document.getElementById('pg-lpa-invites')?.style.setProperty('display', 'none');
    toast('Revize isteğin öğretmenine gönderildi.');
}
window._requestLessonPlanRevision = _requestLessonPlanRevision;

async function _rejectLessonPlanInvite(lpaId, card, note) {
    const sb = window.FocusSupabase;
    card.style.opacity = '.5'; card.style.pointerEvents = 'none';
    _lpaDiscardDraft(lpaId);
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    try {
        const { data: lpa } = await sb.from('lesson_plan_assignments')
            .update({ status: 'rejected', student_note: note || null, responded_at: new Date().toISOString(), expires_at: expiresAt })
            .eq('id', lpaId).select('teacher_id, goal_id').single();
        if (lpa?.teacher_id) {
            await sb.from('notifications').insert([{
                user_id: lpa.teacher_id, type: 'lesson_plan_rejected',
                payload: { fromName: getCurrentUser().displayName || getCurrentUser().username, goalId: lpa.goal_id, note: note || null, groupCode: card.dataset.groupCode || null },
            }]);
        }
    } catch (e) {
        console.warn('[FocusAI] _rejectLessonPlanInvite:', e);
        card.style.opacity = ''; card.style.pointerEvents = '';
        toast('İşlem gönderilemedi, tekrar dene.');
        return;
    }
    card.remove();
    if (!document.querySelectorAll('.pg-lpa-invite-card').length) document.getElementById('pg-lpa-invites')?.style.setProperty('display', 'none');
}
window._rejectLessonPlanInvite = _rejectLessonPlanInvite;
