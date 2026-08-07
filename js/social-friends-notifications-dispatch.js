// social-friends-notifications-dispatch.js
// social-friends-notifications.js'ten çıkarıldı (Faz H devamı, 2. tur): bildirim
// türü başına toast/ses dispatcher'ı (_handleNewNotif) ve onun yalnızca kendi
// içinde kullandığı yardımcılar (_goToLessonPlanTab/_refreshOpenLessonPlanTrackers/
// _handleCollabPlanInvite/_handleCollabGoalDeleted) + TEACHER_NOTIF_ACCENT sabiti.
import { getCurrentUser } from '../state/current-user-store.js';
import { _refreshMyAssignmentsBadge } from './social-assignments-badge.js';

// "Öğretmenden" bildirim ailesi — öğretmen/kurumdan öğrenciye giden tüm bildirimler
// (ödev, ders planı, hatırlatma, sınıf daveti, haftalık özet) tek bir tutarlı renk diliyle
// ayırt edilsin diye ortak vurgu rengi. İkonlar bildirim amacına göre farklı kalır.
export const TEACHER_NOTIF_ACCENT = '#a29bfe';

// Ders planı bildirimlerine (öğrenciye giden atama, öğretmene giden kabul/revize/red)
// tıklayınca genel "Planlama" sekmesi yerine doğrudan ilgili grubun Sınıf Paneli >
// Ders Planı sekmesi açılır — kod (groupCode) yoksa (eski/geçiş dönemi bildirimleri
// için) yine de Planlama'ya düşülür.
function _goToLessonPlanTab(groupCode) {
    if (groupCode && typeof window.dcOpenAssignmentTab === 'function') {
        if (typeof window.switchTab === 'function') window.switchTab('arkadaslar');
        window.dcOpenAssignmentTab(groupCode, 'planlar');
    } else if (typeof window.switchTab === 'function') {
        window.switchTab('planlama');
    }
}

// Öğretmen tarafında Sınıf Paneli > Ders Planı sekmesi zaten açıksa (aynı sekme
// görünürken karşı taraf kabul/revize/red yapınca), sayfa yenilemeden anında
// güncellensin diye — bu bildirimler zaten realtime geldiği için ek bir
// realtime aboneliğine gerek kalmadan "bildirim = tazele sinyali" olarak kullanılır.
function _refreshOpenLessonPlanTrackers() {
    document.querySelectorAll('#cp-lpa-tracker-body[data-lpa-group-id]').forEach(el => {
        const groupId = el.dataset.lpaGroupId;
        if (groupId && typeof window.renderGroupLessonPlanStatus === 'function') {
            window.renderGroupLessonPlanStatus(groupId, el);
        }
    });
}

export function _handleNewNotif(info) {
    window.renderNotificationsPanel();
    // 'reaction' tipi bildirimler artık üretilmiyor (sadeleştirme kararı) —
    // eski satırlar panelde görünmeye devam eder ama toast/ses tetiklemez.
    if (info.type === 'group_announcement') {
        playNotificationSound('alert');
        showGenericNotifToast({
            icon: 'fa-bullhorn', accent: '#74b9ff',
            title: `📣 ${_escapeHtml(info.groupName || 'Grup')} duyurusu`,
            body: `${_escapeHtml(info.text || '')} — ${_escapeHtml(info.fromName || '')}`,
            onClick: () => { if (info.groupCode && typeof window.dcOpenGroupPanel === 'function') window.dcOpenGroupPanel(info.groupCode); }
        });
    } else if (info.type === 'group_slot_open') {
        playNotificationSound('alert');
        showGenericNotifToast({
            icon: 'fa-star', accent: '#2ed573', title: 'Grupta Yer Açıldı!',
            body: `<b>${_escapeHtml(info.groupName || '')}</b> grubunda yer açıldı.`,
            onClick: window.openNotificationsPanel
        });
    } else if (info.type === 'focus_reminder') {
        playNotificationSound('alert');
        showGenericNotifToast({
            icon: 'fa-bell', accent: TEACHER_NOTIF_ACCENT, title: 'Öğretmenden Hatırlatma',
            body: `<b>${_escapeHtml(info.fromName || '')}</b> sana <b>${_escapeHtml(info.groupName || '')}</b> için bir hatırlatma gönderdi.`,
            onClick: window.openNotificationsPanel
        });
    } else if (info.type === 'assignment_reminder') {
        playNotificationSound('alert');
        showGenericNotifToast({
            icon: 'fa-clipboard-list', accent: TEACHER_NOTIF_ACCENT, title: 'Öğretmenden: Ödev Hatırlatması',
            body: `<b>${_escapeHtml(info.assignmentTitle || '')}</b> ödevini (${_escapeHtml(info.groupName || '')}) henüz teslim etmedin.`,
            onClick: window.openNotificationsPanel
        });
    } else if (info.type === 'assignment_new') {
        playNotificationSound('alert');
        showGenericNotifToast({
            icon: 'fa-clipboard-list', accent: TEACHER_NOTIF_ACCENT, title: 'Öğretmenden: Yeni Ödev',
            body: `<b>${_escapeHtml(info.fromName || '')}</b> <b>${_escapeHtml(info.groupName || '')}</b>'e yeni bir ödev ekledi: ${_escapeHtml(info.assignmentTitle || '')}`,
            onClick: () => { if (info.groupCode && typeof window.dcOpenAssignmentTab === 'function') window.dcOpenAssignmentTab(info.groupCode); }
        });
        if (typeof _refreshMyAssignmentsBadge === 'function') _refreshMyAssignmentsBadge();
    } else if (info.type === 'classroom_weekly_digest') {
        playNotificationSound('alert');
        showGenericNotifToast({
            icon: 'fa-chart-line', accent: TEACHER_NOTIF_ACCENT, title: 'Öğretmenden: Haftalık Sınıf Özeti',
            body: `<b>${_escapeHtml(info.groupName || '')}</b>: bu hafta ${info.inactiveCount} kişi hiç odaklanmadı.`,
            onClick: window.openNotificationsPanel
        });
    } else if (info.type === 'institution_invite') {
        playNotificationSound('alert');
        showGenericNotifToast({
            icon: 'fa-building-columns', accent: TEACHER_NOTIF_ACCENT, title: 'Öğretmenden: Sınıf Daveti',
            body: `<b>${_escapeHtml(info.fromName || '')}</b> seni <b>${_escapeHtml(info.groupName || '')}</b> sınıfına davet etti.`,
            onClick: window.openNotificationsPanel
        });
    } else if (info.type === 'mention') {
        playNotificationSound('alert');
        const isDm = !!info.conversationId;
        showGenericNotifToast({
            icon: 'fa-at', accent: '#74b9ff', title: 'Bahsedildin',
            body: `<b>${_escapeHtml(info.fromName || '')}</b> seni ${isDm ? 'bir mesajda' : 'bir grup sohbetinde'} etiketledi.`,
            onClick: window.openNotificationsPanel
        });
    } else if (info.type === 'buddy_habit_deleted') {
        playNotificationSound('alert');
        _handleBuddyHabitDeletedNotification(info);
    } else if (info.type === 'buddy_session_ended') {
        playNotificationSound('message');
        _handleBuddySessionEndedNotification(info);
    } else if (info.type === 'collab_plan_invite') {
        playNotificationSound('alert');
        _handleCollabPlanInvite(info);
    } else if (info.type === 'lesson_plan_reminder') {
        playNotificationSound('alert');
        showGenericNotifToast({
            icon: 'fa-book-open', accent: TEACHER_NOTIF_ACCENT, title: 'Öğretmenden: Ders Planı Hatırlatması',
            body: `<b>${_escapeHtml(info.fromName || '')}</b>, <b>${_escapeHtml(info.goalTitle || '')}</b> ders planını henüz tamamlamadığını hatırlatıyor.`,
            onClick: () => { if (typeof window.switchTab === 'function') window.switchTab('planlama'); }
        });
    } else if (info.type === 'lesson_plan_new') {
        playNotificationSound('alert');
        showGenericNotifToast({
            icon: 'fa-graduation-cap', accent: TEACHER_NOTIF_ACCENT, title: 'Bekleyen planlama isteğiniz var',
            body: info.resent
                ? `<b>${_escapeHtml(info.fromName || '')}</b> <b>${_escapeHtml(info.goalTitle || '')}</b> planını düzenleyip tekrar gönderdi.`
                : `<b>${_escapeHtml(info.fromName || '')}</b> sana <b>${_escapeHtml(info.goalTitle || '')}</b> adlı bir ders planı atadı.`,
            onClick: () => _goToLessonPlanTab(info.groupCode)
        });
    } else if (info.type === 'lesson_plan_accepted') {
        playNotificationSound('message');
        _refreshOpenLessonPlanTrackers();
        showGenericNotifToast({
            icon: 'fa-circle-check', accent: '#2ed573', title: 'Ders Planı Kabul Edildi',
            body: `<b>${_escapeHtml(info.fromName || '')}</b> gönderdiğin ders planını kabul etti.`,
            onClick: () => _goToLessonPlanTab(info.groupCode)
        });
    } else if (info.type === 'lesson_plan_revision_requested') {
        playNotificationSound('alert');
        _refreshOpenLessonPlanTrackers();
        showGenericNotifToast({
            icon: 'fa-pen-to-square', accent: '#feca57', title: 'Ders Planında Revize İstendi',
            body: `<b>${_escapeHtml(info.fromName || '')}</b>: “${_escapeHtml(info.note || '')}”`,
            onClick: () => _goToLessonPlanTab(info.groupCode)
        });
    } else if (info.type === 'lesson_plan_rejected') {
        playNotificationSound('alert');
        _refreshOpenLessonPlanTrackers();
        showGenericNotifToast({
            icon: 'fa-circle-xmark', accent: '#ff6b6b', title: 'Ders Planı Reddedildi',
            body: `<b>${_escapeHtml(info.fromName || '')}</b> planı reddetti.${info.note ? ` Sebep: “${_escapeHtml(info.note)}”` : ''} Plan 7 gün içinde tekrar düzenlenip gönderilebilir.`,
            onClick: () => _goToLessonPlanTab(info.groupCode)
        });
    } else if (info.type === 'collab_goal_deleted') {
        playNotificationSound('alert');
        _handleCollabGoalDeleted(info);
    } else if (info.type === 'kudos') {
        playNotificationSound('alert');
        showGenericNotifToast({
            icon: 'fa-hands-clapping', accent: '#feca57', title: 'Alkış Aldın! 👏',
            body: `<b>${_escapeHtml(info.fromName || '')}</b> odaklanmana alkış gönderdi.`,
            onClick: window.openNotificationsPanel
        });
    } else if (info.type === 'group_goal_reached') {
        playNotificationSound('alert');
        if (typeof window.fireConfetti === 'function') window.fireConfetti();
        showGenericNotifToast({
            icon: 'fa-trophy', accent: '#feca57', title: 'Haftalık Hedef Tamamlandı! 🎉',
            body: `<b>${_escapeHtml(info.groupName || '')}</b> grubu bu haftaki ${info.weeklyGoal ? formatFocusMinutes(info.weeklyGoal) : ''} hedefine ulaştı.`,
            onClick: window.openNotificationsPanel
        });
    }
}

function _handleCollabPlanInvite(info) {
    const esc = window.escapeHtml;
    document.getElementById('collab-plan-invite-overlay')?.remove();

    const fromName   = info.fromName  || info.fromUsername || 'Biri';
    const goalTitle  = info.goalTitle || 'bir plan';
    const inviteCode = info.inviteCode;
    const goalId     = info.goalId;

    const overlay = document.createElement('div');
    overlay.id        = 'collab-plan-invite-overlay';
    overlay.className = 'modal-overlay';
    overlay.style.zIndex = '100080';
    overlay.innerHTML = `
        <div class="cpi-card">
            <div class="cpi-avatar-row">
                <div class="cpi-from-avatar">${esc(fromName.slice(0,2).toUpperCase())}</div>
            </div>
            <p class="cpi-from-name">${esc(fromName)}</p>
            <p class="cpi-label">seni bir plana davet etti</p>
            <p class="cpi-goal-title">"${esc(goalTitle)}"</p>
            <div class="cpi-actions">
                <button id="cpi-reject-btn" class="cpi-btn-reject">Reddet</button>
                <button id="cpi-accept-btn" class="cpi-btn-accept">
                    <i class="ti ti-check"></i> Kabul Et
                </button>
            </div>
            <div id="cpi-status" class="cpi-status-msg"></div>
        </div>`;
    document.body.appendChild(overlay);

    overlay.querySelector('#cpi-reject-btn').addEventListener('click', () => {
        overlay.remove();
        if (goalId && window.FocusSupabase && getCurrentUser()?.id) {
            window.FocusSupabase.from('lesson_plan_assignments')
                .update({ status: 'rejected', responded_at: new Date().toISOString() })
                .eq('goal_id', goalId).eq('student_id', getCurrentUser().id).then(() => {});
        }
    });

    overlay.querySelector('#cpi-accept-btn').addEventListener('click', async () => {
        const acceptBtn = overlay.querySelector('#cpi-accept-btn');
        const statusEl  = overlay.querySelector('#cpi-status');
        acceptBtn.disabled = true;
        acceptBtn.innerHTML = '<span class="cpi-spinner"></span>';

        try {
            const result = await window.PlanningCollab?.joinByCode?.(inviteCode);
            if (!result) {
                statusEl.textContent = 'Geçersiz davet kodu.';
                acceptBtn.disabled = false;
                acceptBtn.innerHTML = '<i class="ti ti-check"></i> Kabul Et';
                return;
            }

            // Hedefi local'e ekle
            await window._applyInviteJoin?.(result);

            const targetGoalIdForStatus = result.goalId || goalId;
            if (targetGoalIdForStatus && window.FocusSupabase && getCurrentUser()?.id) {
                window.FocusSupabase.from('lesson_plan_assignments')
                    .update({ status: 'accepted', responded_at: new Date().toISOString() })
                    .eq('goal_id', targetGoalIdForStatus).eq('student_id', getCurrentUser().id).then(() => {});
            }

            // Planlama sekmesine geç ve plana doğrudan gir — ders planı ataması bir
            // ödev gibidir, öğretmenin "planlamayı başlat" tuşuna basmasını beklemeye gerek yok
            // (o mekanizma canlı/senkron ortak planlama oturumları için var, ders planı ataması için değil).
            if (typeof window.switchTab === 'function') window.switchTab('planlama');

            const targetGoalId = result.goalId || goalId;
            await window.PlanningCollab?.joinRoom?.(result.roomId, targetGoalId, 'editor');
            window.PlanningCollab?.setHandlers?.({
                onStartPlanning: () => {},
                onMilestoneChange: () => {},
                onProgressChange:  () => {},
            });

            overlay.remove();
            if (typeof window.openPlanView === 'function') {
                window.openPlanView(targetGoalId);
            }

        } catch(e) {
            statusEl.textContent = 'Bir hata oluştu, tekrar dene.';
            acceptBtn.disabled = false;
            acceptBtn.innerHTML = '<i class="ti ti-check"></i> Kabul Et';
        }
    });
}

function _handleCollabGoalDeleted(info) {
    const esc = window.escapeHtml;
    document.getElementById('collab-goal-deleted-overlay')?.remove();

    const fromName  = info.fromName || info.fromUsername || 'Biri';
    const goalTitle = info.goalTitle || 'bir plan';
    const goalId    = info.goalId;

    const overlay = document.createElement('div');
    overlay.id        = 'collab-goal-deleted-overlay';
    overlay.className = 'modal-overlay';
    overlay.style.zIndex = '100085';
    overlay.innerHTML = `
        <div class="modal-content glass-panel u-text-align-center-2" >
            <div class="modal-icon-wrapper warning">
                <i class="fa-solid fa-triangle-exclamation"></i>
            </div>
            <h2 class="u-margin-bottom-10px_color-hfff">Ortak Çalışma Sona Erdi</h2>
            <p class="u-color-var-text-muted_font-size-14px_line-height-1p6_margin">
                <strong class="u-color-rgba255255255p85">${esc(fromName)}</strong>,
                <em>"${esc(goalTitle)}"</em> planındaki ortak çalışmayı sonlandırdı.
            </p>
            <p class="u-color-var-text-muted_font-size-13px_line-height-1p5_margin-2">
                Planı bireysel olarak sürdürebilir ya da hesabınızdan kalıcı olarak kaldırabilirsiniz.
            </p>
            <div class="u-display-grid_grid-template-columns-1fr1fr1fr_gap-8px_margi">
                <button id="cgd-later-btn"  class="cdm-btn cdm-btn--ghost">Sonra Karar Ver</button>
                <button id="cgd-delete-btn" class="cdm-btn cdm-btn--danger">Kalıcı Olarak Sil</button>
                <button id="cgd-solo-btn"   class="cdm-btn cdm-btn--purple">Bireysel Sürdür</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);

    overlay.querySelector('#cgd-later-btn').addEventListener('click', () => overlay.remove());

    overlay.querySelector('#cgd-solo-btn').addEventListener('click', async () => {
        overlay.remove();
        if (typeof window._convertGoalToSoloById === 'function') {
            await window._convertGoalToSoloById(goalId);
        }
    });

    overlay.querySelector('#cgd-delete-btn').addEventListener('click', async () => {
        overlay.remove();
        if (typeof window._deleteGoalSilently === 'function') {
            window._deleteGoalSilently(goalId);
        }
    });
}
