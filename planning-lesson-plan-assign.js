// planning-lesson-plan-assign.js
// planning.js'ten çıkarıldı (Faz 6): "Sınıfa/Öğrenciye Ata" (lesson_plan_assignments)
// — ders planı atama modalı, öğretmen tarafı atama durumu takibi, PlanView
// atama durumu paneli.
//
// Köprüler:
//  - getPgGoals(), window.esc: planning.js'te zaten vardı.
//  - _pvRenderAssignmentStatus, openAssignModal: burada tanımlı, planning.js'in
//    geri kalanı (PlanView) tarafından window.* ile çağrılıyor.
//  - window.renderGroupLessonPlanStatus: bu blokla birlikte taşındı (atama
//    satırı zaten blok içindeydi), social-friends-notifications.js bunu
//    typeof-guard'lı çağırıyor, dosya nerede olursa olsun çalışmaya devam eder.
import { getPgGoals, esc, persistGoals } from './planning.js';

    // ── Sınıfa / Öğrenciye Ata (lesson_plan_assignments) ──────
    async function openAssignModal(goalId) {
        const goal = getPgGoals().find(g => g.id === goalId);
        if (!goal || !window.FocusSupabase || !window.currentUser) return;
        const sb = window.FocusSupabase, uid = window.currentUser.id;

        document.getElementById('pg-assign-modal')?.remove();
        const overlay = document.createElement('div');
        overlay.id = 'pg-assign-modal';
        overlay.className = 'modal-overlay';
        const today = new Date().toISOString().split('T')[0];
        overlay.innerHTML = `
            <div class="modal-content glass-panel pg-assign-modal-content">
                <header class="modal-header">
                    <h2><i class="ti ti-school"></i> Ders Planını Ata</h2>
                    <button id="pg-assign-close" class="icon-btn"><i class="fa-solid fa-xmark"></i></button>
                </header>
                <div class="modal-body">
                    <p class="pg-hint" style="margin-bottom:14px;">"${esc(goal.title)}" planını bir sınıfa veya öğrenciye ata.</p>
                    <div id="pg-assign-loading" class="pg-cw-loading"><span class="pg-cw-pulse-dot"></span> Sınıflar yükleniyor…</div>
                    <div id="pg-assign-body" style="display:none;">
                        <div class="form-group">
                            <label class="form-label">Sınıf</label>
                            <select id="pg-assign-group" class="premium-input modern-select pg-assign-select"></select>
                        </div>
                        <label class="pg-assign-all-row" for="pg-assign-all">
                            <input type="checkbox" id="pg-assign-all">
                            <span class="pg-assign-checkbox"></span>
                            <span class="pg-assign-all-label">Tüm sınıfa ata</span>
                        </label>
                        <div id="pg-assign-students" class="pg-assign-students"></div>
                        <div class="form-group" style="margin-top:14px;">
                            <label class="form-label">Son tarih (opsiyonel)</label>
                            <input id="pg-assign-deadline" type="date" class="premium-input pg-assign-select" value="${today}">
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" id="pg-assign-confirm" class="pg-assign-confirm-btn" disabled><i class="ti ti-send"></i> Ata</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);

        const close = () => overlay.remove();
        overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
        overlay.querySelector('#pg-assign-close').onclick = close;

        const loading = overlay.querySelector('#pg-assign-loading');
        const body    = overlay.querySelector('#pg-assign-body');
        let memberships;
        try {
            ({ data: memberships } = await sb
                .from('group_members').select('group_id, role, groups(id, name, classroom_type, code)')
                .eq('user_id', uid).eq('role', 'admin'));
        } catch (e) {
            console.warn('[FocusAI] openAssignModal:', e);
            loading.textContent = 'Sınıflar yüklenemedi. Bağlantını kontrol edip tekrar dene.';
            return;
        }
        const classGroups = (memberships || [])
            .map(m => m.groups).filter(g => g && (g.classroom_type === 'classroom' || g.classroom_type === 'workplace'));

        if (!classGroups.length) {
            loading.textContent = 'Yönettiğin bir sınıf/ekip grubu bulunamadı.';
            return;
        }
        loading.style.display = 'none';
        body.style.display = '';

        const groupSel = overlay.querySelector('#pg-assign-group');
        groupSel.innerHTML = classGroups.map(g => `<option value="${g.id}">${esc(g.name)}</option>`).join('');

        const allBox     = overlay.querySelector('#pg-assign-all');
        const studentsEl = overlay.querySelector('#pg-assign-students');
        const confirmBtn = overlay.querySelector('#pg-assign-confirm');

        let members = [];
        const loadMembers = async () => {
            studentsEl.innerHTML = '<div class="pg-cw-loading"><span class="pg-cw-pulse-dot"></span> Öğrenciler yükleniyor…</div>';
            let rows;
            try {
                ({ data: rows } = await sb
                    .from('group_members').select('user_id, profiles(id, display_name, username)')
                    .eq('group_id', groupSel.value));
            } catch (e) {
                console.warn('[FocusAI] loadMembers:', e);
                studentsEl.innerHTML = '<p class="pg-cw-empty">Öğrenciler yüklenemedi. Tekrar dene.</p>';
                return;
            }
            members = (rows || []).map(r => r.profiles).filter(p => p && p.id !== uid);
            studentsEl.innerHTML = members.length
                ? members.map(m => `
                    <label class="pg-assign-student-row" for="pg-assign-student-${m.id}">
                        <input type="checkbox" class="pg-assign-student" id="pg-assign-student-${m.id}" value="${m.id}">
                        <span class="pg-assign-checkbox"></span>
                        <span class="pg-assign-student-name">${esc(m.display_name || m.username)}</span>
                    </label>`).join('')
                : '<p class="pg-cw-empty">Bu grupta henüz öğrenci yok.</p>';
            _refreshAssignConfirm();
        };
        groupSel.onchange = loadMembers;
        await loadMembers();

        function _refreshAssignConfirm() {
            const anyChecked = allBox.checked || overlay.querySelectorAll('.pg-assign-student:checked').length > 0;
            confirmBtn.disabled = !anyChecked;
        }
        allBox.onchange = () => {
            studentsEl.querySelectorAll('.pg-assign-student').forEach(cb => { cb.checked = false; cb.disabled = allBox.checked; });
            _refreshAssignConfirm();
        };
        studentsEl.addEventListener('change', _refreshAssignConfirm);

        confirmBtn.onclick = async () => {
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = '<i class="ti ti-loader-2 pg-sync-spin"></i> Atanıyor…';
            const groupId = groupSel.value;
            const targetIds = allBox.checked
                ? members.map(m => m.id)
                : Array.from(overlay.querySelectorAll('.pg-assign-student:checked')).map(cb => cb.value);
            const deadline = overlay.querySelector('#pg-assign-deadline').value || null;
            if (!targetIds.length) return;

            const rows = targetIds.map(studentId => ({
                goal_id: goal.id, group_id: groupId, teacher_id: uid, student_id: studentId,
                status: 'invited', deadline: deadline ? new Date(deadline + 'T23:59:59').toISOString() : null,
                goal_title: goal.title,
            }));
            const { error } = await sb.from('lesson_plan_assignments').upsert(rows, { onConflict: 'goal_id,student_id' });
            if (error) {
                window.dcShowToast?.('Atama başarısız: ' + error.message, 'error');
                confirmBtn.disabled = false;
                confirmBtn.innerHTML = '<i class="ti ti-send"></i> Ata';
                return;
            }
            const groupCode = classGroups.find(cg => cg.id === groupId)?.code || null;
            try {
                await sb.from('notifications').insert(targetIds.map(userId => ({
                    user_id: userId,
                    type: 'lesson_plan_new',
                    payload: { fromName: window.currentUser.displayName || window.currentUser.username, goalTitle: goal.title, groupId, groupCode },
                })));
            } catch (e) {
                console.warn('[FocusAI] lesson_plan_new bildirimi gönderilemedi:', e);
            }
            window.dcShowToast?.('Plan ' + targetIds.length + ' kişiye atandı.', 'success');
            close();
            // Atama, öğretmenin "kaydetmesi gereken" bir değişiklik değil — atama zaten
            // ayrı bir tabloya (lesson_plan_assignments) yazıldı. Yine de pvUnsaved açık
            // kalmışsa (atamadan önce plan üzerinde başka bir düzenleme yapılmışsa) hedefi
            // burada kaydedip bayrağı temizliyoruz ki çıkarken gereksiz "kaydedilmemiş
            // değişiklikler" uyarısı çıkmasın — atadıktan sonra tekrar Kaydet'e basmaya gerek yok.
            const liveGoal = getPgGoals().find(x => x.id === goal.id);
            if (liveGoal) { liveGoal._dirty = true; persistGoals(); }
            pvUnsaved = false;
            _pvRenderAssignmentStatus(goal);
        };
    }

    // ── Öğretmen tarafı: bu ders planının öğrencilere atanma durumu ──────
    // "Bekliyor / Onaylandı / Revize İstendi / Reddedildi / Tamamlandı" —
    // revize isteyen ve reddeden öğrenciler için not + tekrar gönder aksiyonu.
    // Reddedilenler 7 gün sonra (expires_at geçince) bir sonraki açılışta
    // otomatik temizlenir (cron yok, client-side lazy cleanup).
    const PVLPA_STATUS_META = {
        invited:            { label: 'Bekliyor',        cls: 'wait' },
        accepted:           { label: 'Onaylandı',       cls: 'ok' },
        revision_requested: { label: 'Revize İstendi',  cls: 'warn' },
        rejected:           { label: 'Reddedildi',      cls: 'bad' },
        completed:          { label: 'Tamamlandı',      cls: 'ok' },
    };
    async function _pvRenderAssignmentStatus(g) {
        const box = document.getElementById('pg-pv-assign-status');
        if (!box || !window.FocusSupabase || !window.currentUser) return;
        if (g.context?.isTemplate) { box.classList.add('hidden'); return; }
        const sb = window.FocusSupabase, myId = window.currentUser.id;

        let rows;
        try {
            // Süresi dolmuş reddedilenleri sessizce temizle (7 gün, migration 097)
            await sb.from('lesson_plan_assignments').delete()
                .eq('teacher_id', myId).eq('status', 'rejected').lt('expires_at', new Date().toISOString());

            ({ data: rows } = await sb.from('lesson_plan_assignments')
                .select('id, student_id, status, student_note, teacher_note, expires_at, progress_pct, profiles!lesson_plan_assignments_student_id_fkey(display_name, username)')
                .eq('goal_id', g.id).eq('teacher_id', myId));
        } catch (e) {
            console.warn('[FocusAI] _pvRenderAssignmentStatus:', e);
            box.classList.add('hidden');
            return;
        }
        if (!rows || !rows.length) { box.classList.add('hidden'); return; }

        box.classList.remove('hidden');
        box.innerHTML = `
            <div class="pg-pv-assign-status-title"><i class="ti ti-users"></i> Atama Durumu</div>
            <div class="pg-pv-assign-status-list">${rows.map(r => _lpaStatusRowHTML(r, false)).join('')}</div>`;

        box.querySelectorAll('.pg-pv-assign-resend-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader-2 pg-sync-spin"></i> Gönderiliyor…';
                const lpaId = btn.dataset.lpaId, studentId = btn.dataset.studentId;
                try {
                    await sb.from('lesson_plan_assignments').update({
                        status: 'invited', student_note: null, responded_at: null, expires_at: null,
                    }).eq('id', lpaId);
                    const groupCode = await _lpaGetGroupCode(sb, g.context?.lessonPlanGroupId);
                    await sb.from('notifications').insert([{
                        user_id: studentId, type: 'lesson_plan_new',
                        payload: { fromName: window.currentUser.displayName || window.currentUser.username, goalTitle: g.title, resent: true, groupCode },
                    }]);
                    window.dcShowToast?.('Plan tekrar gönderildi.', 'success');
                    _pvRenderAssignmentStatus(g);
                } catch (e) {
                    console.warn('[FocusAI] plan tekrar gönderme hatası:', e);
                    window.dcShowToast?.('Gönderilemedi, tekrar dene.', 'error');
                    btn.disabled = false; btn.innerHTML = 'Tekrar Gönder';
                }
            });
        });
    }
    window._pvRenderAssignmentStatus = _pvRenderAssignmentStatus;

    // Tek bir atama satırının HTML'i — hem tek-plan (yukarıdaki) hem gruba-özel
    // (Sınıf Paneli > Ders Planı) görünümde paylaşılır. `showGoalTitle` gruba-özel
    // görünümde birden fazla plan karışabileceği için başlığı da gösterir.
    // `opts.deleteStatuses`: hangi durumlarda "Sil" butonu gösterilsin (öğrenci sadece
    // rejected'ı silebilir — RLS öyle izin veriyor; öğretmen kendi kaydı olduğu için
    // hem revision_requested hem rejected'ı silebilir).
    function _lpaStatusRowHTML(r, showGoalTitle, showResendBtn, opts) {
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
    // planning-lesson-plan-invites.js modülünün öğrenci davet listesinde
    // kullanabilmesi için köprü.
    window._lpaStatusRowHTML = _lpaStatusRowHTML;

    // Bir grubun kısa katılım kodunu (bildirim onClick'inde Sınıf Paneli'ni doğrudan
    // açabilmek için) uuid'sinden bulur — küçük bir önbellekle tekrar sorgulamayı önler.
    const _lpaGroupCodeCache = {};
    async function _lpaGetGroupCode(sb, groupId) {
        if (!groupId) return null;
        if (_lpaGroupCodeCache[groupId] !== undefined) return _lpaGroupCodeCache[groupId];
        try {
            const { data } = await sb.from('groups').select('code').eq('id', groupId).maybeSingle();
            return (_lpaGroupCodeCache[groupId] = data?.code || null);
        } catch (e) {
            console.warn('[FocusAI] _lpaGetGroupCode:', e);
            return null;
        }
    }

    // Sınıf Paneli > Ders Planı sekmesi — öğretmen tarafı: bu gruptaki TÜM ders planı
    // atamalarının durumu. Kategoriler (Aktif / Revize / Reddedilenler) ayrı sekmeler
    // halinde — hepsi aynı anda listelense çok yer kaplıyordu, artık sadece seçili
    // kategori render ediliyor (bkz. kullanıcı geri bildirimi).
    // "Aktif" sadece kabul edilmeyi BEKLEYEN atamaları gösterir — öğrenci kabul edince
    // (veya tamamlayınca) buradan düşer, yoksa zamanla çok fazla veri birikip liste
    // kullanılamaz hale geliyordu (bkz. kullanıcı geri bildirimi).
    const LPA_GROUP_TABS = [
        { key: 'active',   label: 'Aktif',        statuses: ['invited'] },
        { key: 'revision', label: 'Revize',        statuses: ['revision_requested'] },
        { key: 'rejected', label: 'Reddedilenler', statuses: ['rejected'] },
    ];
    // "Yeni Ders Planı Oluştur" butonu, sekme çubuğuyla aynı satırda (sağda) —
    // Planlama modülünü açıp ders planı oluşturma akışını başlatır.
    const _lpaCreateBtnHtml = `
        <button id="cp-asg-goto-lessonplan-btn" class="control-btn secondary pg-lpa-create-btn">
            <i class="fa-solid fa-book-open-reader"></i> Yeni Ders Planı Oluştur
        </button>`;
    function _lpaBindCreateBtn(containerEl) {
        containerEl.querySelector('#cp-asg-goto-lessonplan-btn')?.addEventListener('click', () => {
            if (typeof window.switchTab === 'function') window.switchTab('planlama');
            setTimeout(() => { if (typeof window.openLessonPlanModal === 'function') window.openLessonPlanModal(); }, 150);
        });
    }

    // Sekme değişiminde ağdan tekrar veri çekmek (fetch+delete round-trip'i) buton
    // tıklamasından geçişe kadar gözle görülür bir gecikmeye yol açıyordu (bkz.
    // kullanıcı geri bildirimi) — bu yüzden sekmeler arası geçiş, ilk yüklemede
    // önbelleğe alınan satırlar üzerinden anında (senkron) render edilir; veri
    // ancak groupId değiştiğinde veya bir aksiyon (sil/tekrar gönder) sonrası
    // sunucudan yeniden çekilir.
    function _lpaRenderTabs(groupId, containerEl, rows) {
        containerEl._lpaRows = rows;
        const buckets = {};
        LPA_GROUP_TABS.forEach(t => { buckets[t.key] = rows.filter(r => t.statuses.includes(r.status)); });
        let activeTab = containerEl.dataset.lpaActiveTab;
        if (!activeTab || !buckets[activeTab]) activeTab = LPA_GROUP_TABS.find(t => buckets[t.key].length)?.key || 'active';
        containerEl.dataset.lpaActiveTab = activeTab;

        containerEl.innerHTML = `
            <div class="pg-lpa-tabs-row">
                <div class="pg-lpa-tabs">
                    ${LPA_GROUP_TABS.map(t => `
                    <button class="pg-lpa-tab-btn${t.key === activeTab ? ' active' : ''}" data-tab="${t.key}">
                        ${esc(t.label)}${buckets[t.key].length ? ` <span class="pg-lpa-tab-count">${buckets[t.key].length}</span>` : ''}
                    </button>`).join('')}
                </div>
                ${_lpaCreateBtnHtml}
            </div>
            <div class="pg-pv-assign-status-list">${buckets[activeTab].length
                ? buckets[activeTab].map(r => _lpaStatusRowHTML(r, true, true, { showEditBtn: true, deleteStatuses: ['revision_requested', 'rejected'] })).join('')
                : '<p class="cp-hint">Bu kategoride kayıt yok.</p>'}</div>`;

        _lpaBindCreateBtn(containerEl);
        containerEl.querySelectorAll('.pg-lpa-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.dataset.tab === containerEl.dataset.lpaActiveTab) return;
                containerEl.dataset.lpaActiveTab = btn.dataset.tab;
                _lpaRenderTabs(groupId, containerEl, containerEl._lpaRows || []);
            });
        });
        containerEl.querySelectorAll('.pg-pv-assign-edit-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.dataset.goalId && typeof window.openPlanView === 'function') window.openPlanView(btn.dataset.goalId);
            });
        });
        containerEl.querySelectorAll('.pg-pv-assign-delete-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                let ok;
                try {
                    ok = await window.showFocusaiConfirm({
                        title: 'Ders Planı Kaydını Sil',
                        desc: 'Bu atama kaydı kalıcı olarak silinsin mi? Bu işlem geri alınamaz.',
                        type: 'danger', icon: 'fa-trash-can', confirmText: 'Sil', cancelText: 'Vazgeç',
                    });
                } catch (e) { console.warn('[FocusAI] sessiz hata:', e); return; }
                if (!ok) return;
                btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader-2 pg-sync-spin"></i>';
                try {
                    await window.FocusSupabase.from('lesson_plan_assignments').delete().eq('id', btn.dataset.lpaId);
                    renderGroupLessonPlanStatus(groupId, containerEl);
                } catch (e) {
                    console.warn('[FocusAI] lesson_plan_assignments silme hatası:', e);
                    btn.disabled = false; btn.innerHTML = 'Sil';
                }
            });
        });
        containerEl.querySelectorAll('.pg-pv-assign-resend-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const sb = window.FocusSupabase;
                btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader-2 pg-sync-spin"></i> Gönderiliyor…';
                const lpaId = btn.dataset.lpaId, studentId = btn.dataset.studentId, goalTitle = btn.dataset.goalTitle;
                try {
                    await sb.from('lesson_plan_assignments').update({
                        status: 'invited', student_note: null, responded_at: null, expires_at: null,
                    }).eq('id', lpaId);
                    const groupCode = await _lpaGetGroupCode(sb, groupId);
                    await sb.from('notifications').insert([{
                        user_id: studentId, type: 'lesson_plan_new',
                        payload: { fromName: window.currentUser.displayName || window.currentUser.username, goalTitle, resent: true, groupCode },
                    }]);
                    window.dcShowToast?.('Plan tekrar gönderildi.', 'success');
                    containerEl.dataset.lpaActiveTab = 'active';
                    renderGroupLessonPlanStatus(groupId, containerEl);
                } catch (e) {
                    console.warn('[FocusAI] plan tekrar gönderme hatası:', e);
                    window.dcShowToast?.('Gönderilemedi, tekrar dene.', 'error');
                    btn.disabled = false; btn.innerHTML = 'Tekrar Gönder';
                }
            });
        });
    }

    async function renderGroupLessonPlanStatus(groupId, containerEl) {
        if (!containerEl || !window.FocusSupabase || !window.currentUser) return;
        const sb = window.FocusSupabase, myId = window.currentUser.id;

        let rows;
        try {
            await sb.from('lesson_plan_assignments').delete()
                .eq('teacher_id', myId).eq('status', 'rejected').lt('expires_at', new Date().toISOString());

            ({ data: rows } = await sb.from('lesson_plan_assignments')
                .select('id, goal_id, student_id, status, student_note, teacher_note, expires_at, progress_pct, goal_title, profiles!lesson_plan_assignments_student_id_fkey(display_name, username)')
                .eq('group_id', groupId).eq('teacher_id', myId)
                .order('assigned_at', { ascending: false }));
        } catch (e) {
            console.warn('[FocusAI] renderGroupLessonPlanStatus:', e);
            containerEl.innerHTML = '<p class="cp-hint">Ders planı durumu yüklenemedi. Tekrar dene.</p>';
            return;
        }
        if (!rows || !rows.length) {
            containerEl.innerHTML = `
                <div class="pg-lpa-tabs-row">
                    <p class="cp-hint" style="margin:0;">Bu sınıf için henüz atanmış bir ders planı yok.</p>
                    ${_lpaCreateBtnHtml}
                </div>`;
            _lpaBindCreateBtn(containerEl);
            return;
        }
        _lpaRenderTabs(groupId, containerEl, rows);
    }
    window.renderGroupLessonPlanStatus = renderGroupLessonPlanStatus;

    // _openCollabWaitOverlay/_closeCollabWaitOverlay/_cwAvatarColor/
    // _collabWaitLoadFriends/_collabWaitSendInvite/_collabWaitShowWaitingSection/
    // _collabWaitRefreshWaitingList/_collabWaitRefreshAccepted →
    // planning-collab-wait.js dosyasına taşındı (Faz 2, 2026-07-19).

    // openModeSelect, closeModeSelect, openLessonPlanModal, _lpHideAllSteps,
    // _lpShowChoiceStep, _lpUpdateBrowseCounts, _lpRenderListStep,
    // _lpShowTemplatesListStep, _lpShowInstancesListStep, _lpBindExistingListEvents,
    // _lpShowTemplateStep, _lpShowFormStep, _lpSetTarget, _cloneMilestonesForTemplate,
    // _cloneTasksForTemplate, _applyTemplateTasksToGoal, _pvSaveGoalAsTemplate,
    // _lpSaveTemplate, _lpLoadStudents, _lpRenderStudentPicker, closeLessonPlanModal,
    // _lpSave -> planning-lesson-plan-modal.js dosyasına taşındı (Faz 2, 2026-07-20).
    // window.* köprüsüyle erişilir. Bu modül planning.js'ten ÖNCE yüklenmeli
    // (init() içinde bu fonksiyonlar senkron addEventListener'a bağlanıyor).

    // Öğretmen/kurum yöneticisi bir sınıf/ders grubunda admin ise "Ders Planı" modu açılır
    let _wzLessonPlanGroups = null; // cache: [{id, name, classroom_type}] | []
    // planning-lesson-plan-modal.js modülünün önbelleği okuyabilmesi için köprü
    // (kendisi burada kalıyor çünkü cardHTML de kullanıyor).
    window._wzGetLessonPlanGroups = () => _wzLessonPlanGroups;
    async function _wzCheckLessonPlanGroups() {
        // FocusSupabase/currentUser henüz hazır değilse sonucu ÖNBELLEKLEME —
        // aksi halde erken (login tamamlanmadan) çağrılan init() bu boş sonucu
        // kalıcı olarak önbelleğe alır ve "Ders Planı" hiç görünmez.
        if (!window.FocusSupabase || !window.currentUser) return [];
        const sb = window.FocusSupabase, uid = window.currentUser.id;
        try {
            const { data: memberships } = await sb
                .from('group_members').select('group_id, role, groups(id, name, classroom_type)')
                .eq('user_id', uid).eq('role', 'admin');
            _wzLessonPlanGroups = (memberships || [])
                .map(m => m.groups).filter(g => g && (g.classroom_type === 'classroom' || g.classroom_type === 'workplace'));
            return _wzLessonPlanGroups;
        } catch (e) {
            console.warn('[FocusAI] _wzCheckLessonPlanGroups:', e);
            return []; // önbelleğe alınmaz (_wzLessonPlanGroups null kalır) — bir sonraki çağrıda tekrar denenir
        }
    }
    window._wzCheckLessonPlanGroups = _wzCheckLessonPlanGroups;

    // openWizard, closeWizard, _wzRenderStep, _wzValidate, _wzNext, _wzBack ve tüm
    // 5-adımlı Hedef Oluşturma Sihirbazı (_wz* — ~2150 satır: adım render'ları,
    // booking takvimi, mini gantt, akordeon, günlük/haftalık/aylık takvim ızgarası,
    // _wzSave) -> planning-milestone-wizard.js dosyasına taşındı (Faz 2, 2026-07-20).
    // wizardState/_wzCalYear/_wzCalMonth state'i de o dosyaya taşındı (planning.js'in
    // başka hiçbir yerinde kullanılmıyordu). window.openWizard/closeWizard/_wzNext/
    // _wzBack köprüleriyle erişilir.
    // ÖNEMLİ: init() closeWizard/_wzNext/_wzBack'i SENKRON addEventListener'a
    // bağladığı için bu modül planning.js'ten ÖNCE yüklenmeli.



window._pvRenderAssignmentStatus = _pvRenderAssignmentStatus;
window.openAssignModal = openAssignModal;
