// ─── PLANVIEW: HEADER / STEPPER ────────────────────────────────────
// planning.js dosyasından çıkarıldı (Faz 6, YÜKSEK riskli küme — planning.js
// içindeki en yoğun çıkarma, 27 dış çağrı noktası + 9 paylaşımlı state):
// Hedef Detay Panelinin (PlanView) üst başlık (kategori/ilerleme/kaydet/
// ata/davet butonları) ve sol aşama-listesi (stepper) render mantığı.
//
// Dış bağımlılıklar (PlanView çekirdeğine — planning.js'te KALIYOR):
// - window.getCat/window.fmtDate/window.fmtShort/window.esc/
//   window._pvIsLessonPlan/window.closePlanView → zaten window.* köprülüydü
// - window._pvSaveGoalAsTemplate/window._pvRenderAssignmentStatus/
//   window.openAssignModal/window._updateGoalCollabState → ayrı modüllerde
//   zaten window.* köprülüydü
// - window._pvUpdateConflictBanner/window._pvHasUnresolvedConflicts/
//   window._pvShowUnresolvedConflictModal/window._pvExplicitSave/
//   window._pvIsMirrorMs/window._pvWeekTotalMins/window._pvFmtDuration →
//   bu çıkarmada YENİ window.* köprüsü eklendi
// - window._pvRenderMainCal/window._pvRenderDayPanel/window._localToday/
//   window._normYMD/window._pvRenderWizard → planning-wizard.js
//   çıkarmasından kalan köprüler (aynı isimler, çakışma yok)
// - window.__getPvGoalId → planning-wizard.js çıkarmasından kalan köprü
//   (bu kümede DOĞRUDAN kullanılmıyor ama tutarlılık için not düşüldü)
// - window.__getPvWiz/__setPvWiz → planning-wizard.js çıkarmasından kalan
//   köprü, bu kümede de kullanılıyor (pvWiz PlanView'in ortak state'i)
// - window.__getPvSeqMode/__getPvReadOnly → YENİ salt-okunur getter'lar
//   (bu kümede sadece okunuyorlar)
// - window.__getPvReadOnlyShowOwnTasks/__setPvReadOnlyShowOwnTasks/
//   window.__getPvActiveMsId/__setPvActiveMsId/
//   window.__getPvCalYear/__setPvCalYear/window.__getPvCalMonth/__setPvCalMonth/
//   window.__getPvSelectedDate/__setPvSelectedDate → YENİ getter+setter
//   köprüleri (bu kümede hem okunuyor hem reassign ediliyorlar)
// - planning.js'in geri kalanından (Ana Takvim/Gün Paneli/Sihirbaz-dışı akışlar)
//   `_pvRenderHeader`/`_pvRenderStepper`'a 27 bare çağrı vardı, hepsi
//   `window.*`'a çevrildi (tanımları artık burada)
    // ── Header ────────────────────────────────
    window._pvRenderHeader = _pvRenderHeader; // planning.js için
    export function _pvRenderHeader(g) {
        window._pvUpdateConflictBanner(g);
        const cat = window.getCat(g.category);
        const pct = g.progress_pct || 0;
        const el  = document.getElementById('pg-pv-goal-info');
        if (!el) return;
        el.innerHTML = `
            <div class="pg-pv-goal-cat-dot" style="background:${cat.color};color:${cat.color};"></div>
            <div>
                <div class="pg-pv-goal-title-text">${window.esc(g.title)}</div>
                <div class="pg-pv-goal-meta">
                    <span>${cat.icon} ${cat.label}</span>
                    ${g.deadline ? `<span>·</span><span><i class="ti ti-calendar-due"></i> ${window.fmtDate(g.deadline)}</span>` : ''}
                </div>
            </div>
            <div class="pg-pv-goal-progress-wrap">
                <div class="pg-pv-goal-progress-bar">
                    <div class="pg-pv-goal-progress-fill" style="width:${pct}%;background:${cat.color};"></div>
                </div>
                <span class="pg-pv-goal-pct" style="color:${cat.color};">${pct}%</span>
            </div>`;

        // Seq toggle sync — ders planında anlamsız (aşamalar öğretmen tarafından serbestçe eklenir), gizle
        const seqCheck = document.getElementById('pg-pv-seq-check');
        if (seqCheck) seqCheck.checked = window.__getPvSeqMode();
        document.querySelector('.pg-pv-seq-wrap')?.classList.toggle('hidden', window._pvIsLessonPlan(g));

        // Ders planı (Uygulama Planı + Şablon) — sağ üstte açık "Kaydet" butonu
        const saveBtn = document.getElementById('pg-pv-save-btn');
        if (saveBtn) {
            saveBtn.classList.toggle('hidden', !window._pvIsLessonPlan(g) || window.__getPvReadOnly());
            saveBtn.onclick = () => {
                if (window._pvHasUnresolvedConflicts(g)) {
                    window._pvShowUnresolvedConflictModal({ onLeave: () => { window._pvExplicitSave(g); window.closePlanView(); } });
                    return;
                }
                window._pvExplicitSave(g);
            };
        }

        // Öğretmenin sana atadığı planı "İncele" ile salt okunur açtığında: düzenleme/
        // atama butonları yerine sadece bir bilgi rozeti göster, aşama-ekleme/görev
        // düzenleme aksiyonları da _pvRenderStepper/_pvRenderDayPanel'de gizlenir.
        document.getElementById('pg-pv-edit-goal')?.classList.toggle('hidden', window.__getPvReadOnly() || window._pvHasUnresolvedConflicts(g));
        const invLaterWrap = document.getElementById('pg-pv-invite-later-wrap');
        if (window.__getPvReadOnly()) {
            document.getElementById('pg-pv-assign-status')?.classList.add('hidden');
            if (invLaterWrap) {
                invLaterWrap.innerHTML = `
                    <span class="pg-pv-readonly-badge"><i class="ti ti-eye"></i> Öğretmen Planı — Salt Okunur Önizleme</span>
                    <button class="pg-pv-own-tasks-toggle-btn${window.__getPvReadOnlyShowOwnTasks() ? ' active' : ''}" id="pg-pv-own-tasks-toggle">
                        <i class="ti ti-calendar-user"></i> ${window.__getPvReadOnlyShowOwnTasks() ? 'Mevcut Görevlerimi Gizle' : 'Mevcut Görevlerimi Gör'}
                    </button>`;
                document.getElementById('pg-pv-own-tasks-toggle')?.addEventListener('click', () => {
                    window.__setPvReadOnlyShowOwnTasks(!window.__getPvReadOnlyShowOwnTasks());
                    _pvRenderHeader(g);
                    window._pvRenderDayPanel(g, window.__getPvSelectedDate());
                });
            }
            return;
        }
        if (invLaterWrap) {
            if (g.lpa_id) {
                // Öğretmenden kabul edilmiş ders planı kopyası: atama/şablon
                // aksiyonları öğretmene özeldir, öğrenciye gösterilmez.
                document.getElementById('pg-pv-assign-status')?.classList.add('hidden');
                invLaterWrap.innerHTML = '';
            } else if (window._pvIsLessonPlan(g)) {
                const isTpl = !!g.context?.isTemplate;
                invLaterWrap.innerHTML = `
                    ${!isTpl ? `<button class="pg-pv-save-template-btn" id="pg-pv-save-template-btn" title="Bu planın aşama/görev yapısını yeni dönemlerde tekrar kullanabileceğin bir şablon olarak kaydet">
                        <i class="ti ti-copy"></i> Şablon Olarak Kaydet
                    </button>` : ''}
                    ${!isTpl ? `<button class="pg-pv-assign-class-btn" id="pg-pv-assign-class-btn">
                        <i class="ti ti-send"></i> Öğrencilere Ata
                    </button>` : ''}`;
                document.getElementById('pg-pv-save-template-btn')?.addEventListener('click', () => window._pvSaveGoalAsTemplate(g));
                if (!isTpl) window._pvRenderAssignmentStatus(g);
                else document.getElementById('pg-pv-assign-status')?.classList.add('hidden');
                document.getElementById('pg-pv-assign-class-btn')?.addEventListener('click', async () => {
                    const groupId = g.context?.lessonPlanGroupId;
                    await window.openAssignModal(g.id);
                    if (groupId) {
                        const sel = document.getElementById('pg-assign-group');
                        if (sel) { sel.value = groupId; sel.dispatchEvent(new Event('change')); }
                    }
                });
            } else if (!g.collab_room_id) {
                document.getElementById('pg-pv-assign-status')?.classList.add('hidden');
                invLaterWrap.innerHTML = `
                    <button class="pg-pv-invite-later-btn" id="pg-pv-invite-later-btn">
                        <i class="ti ti-user-plus"></i> Arkadaşını bu plana davet et
                    </button>`;
                document.getElementById('pg-pv-invite-later-btn')?.addEventListener('click', async () => {
                    const btn = document.getElementById('pg-pv-invite-later-btn');
                    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader" style="animation:spin .8s linear infinite;display:inline-block;"></i>'; }
                    try {
                        const { roomId, inviteCode } = await window.PlanningCollab.enableCollab(g.id, g.title);
                        window._updateGoalCollabState?.(g.id, { collab_room_id: roomId, invite_code: inviteCode, is_collaborative: true });
                        await window.PlanningCollab.joinRoom(roomId, g.id, 'owner');
                        // Reload plan view header to remove button
                        const freshGoal = FocusStorage.get('goals', []).find(x => x.id === g.id) || { ...g, collab_room_id: roomId, invite_code: inviteCode };
                        _pvRenderHeader(freshGoal);
                        // Show invite modal
                        _pvOpenCollabInviteModal(inviteCode);
                    } catch(e) {
                        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-user-plus"></i> Arkadaşını bu plana davet et'; }
                    }
                });
            } else {
                document.getElementById('pg-pv-assign-status')?.classList.add('hidden');
                invLaterWrap.innerHTML = '';
            }
        }
    }

    // ── Plan view collab invite modal ─────────
    function _pvOpenCollabInviteModal(inviteCode) {
        const modal = document.getElementById('pg-pv-collab-invite-modal');
        if (!modal) return;
        const codeEl = document.getElementById('pg-pv-collab-invite-code');
        if (codeEl) codeEl.textContent = inviteCode || '—';

        const membersEl = document.getElementById('pg-pv-collab-members');
        if (membersEl) membersEl.innerHTML = '<p style="font-size:12px;color:var(--text-muted);">Henüz katılan yok. Kodu paylaştıktan sonra arkadaşın <strong>Odaya Katıl</strong> seçeneğinden bu kodu girince burada görünür.</p>';

        const copyBtn = document.getElementById('pg-pv-collab-copy-btn');
        if (copyBtn && !copyBtn._pvBound) {
            copyBtn._pvBound = true;
            copyBtn.addEventListener('click', () => {
                navigator.clipboard?.writeText(inviteCode).catch(()=>{});
                copyBtn.innerHTML = '<i class="ti ti-check"></i> Kopyalandı';
                setTimeout(() => { copyBtn.innerHTML = '<i class="ti ti-copy"></i> Kopyala'; }, 2000);
            });
        }

        const closeBtn = document.getElementById('pg-pv-collab-invite-close');
        if (closeBtn && !closeBtn._pvBound) {
            closeBtn._pvBound = true;
            closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
        }
        modal.addEventListener('click', e => { if (e.target === modal) modal.classList.add('hidden'); });
        modal.classList.remove('hidden');
    }

    // ── Left: Stepper ─────────────────────────
    window._pvRenderStepper = _pvRenderStepper; // planning-wizard.js için
    window._pvRenderStepper = _pvRenderStepper; // planning.js için
    export function _pvRenderStepper(g) {
        document.getElementById('pg-pv-body')?.classList.toggle('pg-pv-no-stages', window._pvIsLessonPlan(g));
        const el  = document.getElementById('pg-pv-stepper');
        if (!el) return;
        // Takvimden saat saat eklenen görevlerin aynası olan milestone'lar burada da
        // hariç tutulur — gerçek bir "aşama" değiller, sol listede aşama gibi görünüp
        // kafa karıştırmasınlar diye (bkz. _pvIsMirrorMs).
        const ms  = (g.milestones || []).filter(m => !window._pvIsMirrorMs(m));
        const cat = window.getCat(g.category);

        // Wizard active and in dates step → keep showing chat even with milestones
        const wizActive = window.__getPvWiz() && window.__getPvWiz().step !== 'done' && window.__getPvWiz().step !== null;

        // Ders planı: "kaç aşamaya bölmek istersiniz" sohbet sihirbazı hiç gösterilmez —
        // öğretmen aşamaları doğrudan, tamamen opsiyonel olarak ekler.
        if (window._pvIsLessonPlan(g)) {
            document.querySelector('.pg-pv-panel-header')?.style.removeProperty('display');
            document.getElementById('pg-pv-overall-progress')?.style.removeProperty('display');
            window.__setPvWiz(null);
        } else if (!ms.length || wizActive) {
            // Show wizard if not already in wizard flow
            if (!window.__getPvWiz()) window.__setPvWiz({ step: 'welcome' });
            window._pvRenderWizard(g, el);
            // Hide normal panel chrome while in wizard
            document.querySelector('.pg-pv-panel-header')?.style.setProperty('display','none');
            document.getElementById('pg-pv-quick-add-ms')?.style.setProperty('display','none');
            document.getElementById('pg-pv-overall-progress')?.style.setProperty('display','none');
            return;
        }
        // Milestones exist & wizard done — restore normal chrome
        document.querySelector('.pg-pv-panel-header')?.style.removeProperty('display');
        document.getElementById('pg-pv-overall-progress')?.style.removeProperty('display');
        window.__setPvWiz(null);

        const allTasks = FocusStorage.get('tasks', []).filter(t => String(t.parentGoal) === String(g.id));
        const today    = window._localToday();

        el.innerHTML = ms.map((m, i) => {
            const isActive = m.id === window.__getPvActiveMsId();
            const isLocked = window.__getPvSeqMode() && i > 0 && !ms[i - 1].done && !m.done;
            const stsDone  = (m.subtasks || []).filter(s => s.done).length;
            const stTotal  = (m.subtasks || []).length;
            const stPct    = stTotal ? Math.round(stsDone / stTotal * 100) : (m.done ? 100 : 0);

            // Task count in this milestone's date range — only this goal's tasks
            const mTasks   = m.start_date && m.due_date
                ? allTasks.filter(t => { const d = window._normYMD(t.date); return d >= m.start_date && d <= m.due_date && String(t.parentGoal) === String(g.id); })
                : [];
            const mDone    = mTasks.filter(t => t.completed).length;

            // Days remaining / elapsed
            let daysInfo = '';
            if (!m.done && m.due_date) {
                const diff = Math.round((new Date(m.due_date + 'T00:00:00') - new Date(today + 'T00:00:00')) / 86400000);
                if (diff > 0)       daysInfo = `${diff} gün kaldı`;
                else if (diff === 0) daysInfo = 'Bugün bitiyor';
                else                daysInfo = `${-diff} gün geçti`;
            }

            // Duration (planned time)
            const mMins = window._pvWeekTotalMins(allTasks, m.start_date || '', m.due_date || '');
            const mDur  = window._pvFmtDuration(mMins);

            // Status badge
            let statusBadge = '';
            if (m.done)        statusBadge = `<span class="pg-pv-ms-badge done">✓ Tamamlandı</span>`;
            else if (isLocked) statusBadge = `<span class="pg-pv-ms-badge locked"><i class="ti ti-lock"></i> Kilitli</span>`;
            else if (isActive) statusBadge = `<span class="pg-pv-ms-badge active" style="--ms-color:${cat.color};">▶ Aktif</span>`;

            // Date range label
            const timeLabel = (m.start_time || m.end_time) ? ` · ${m.start_time || ''}${m.end_time ? '–'+m.end_time : ''}` : '';
            const dateRange = (m.start_date && m.due_date)
                ? `${window.fmtShort(m.start_date)} → ${window.fmtShort(m.due_date)}${timeLabel}`
                : m.due_date ? `Bitiş: ${window.fmtShort(m.due_date)}${timeLabel}` : '';

            return `
            ${i > 0 ? `<div class="pg-pv-step-connector${ms[i-1].done?' done':''}"></div>` : ''}
            <div class="pg-pv-step-item${isActive?' active':''}${m.done?' done':''}${isLocked?' locked':''}"
                data-pvms="${m.id}" style="${isActive?`--ms-color:${cat.color};`:''}"
                ${isLocked ? 'title="Sıralı modda önceki aşama tamamlanmadan açılamaz"' : ''}>

                <div class="pg-pv-step-top">
                    <div class="pg-pv-step-num" style="${isActive||m.done?`background:${cat.color};color:#000;`:''}">
                        ${m.done ? '✓' : i + 1}
                    </div>
                    <div class="pg-pv-step-body">
                        <div class="pg-pv-step-title">${window.esc(m.title)}</div>
                        ${statusBadge}
                    </div>
                </div>

                ${dateRange ? `<div class="pg-pv-step-daterange"><i class="ti ti-calendar-event"></i> ${dateRange}</div>` : ''}

                ${(stTotal || mTasks.length) ? `
                <div class="pg-pv-step-progress-row">
                    <div class="pg-pv-step-progress-bar">
                        <div class="pg-pv-step-progress-fill" style="width:${stPct}%;background:${cat.color};"></div>
                    </div>
                    <span class="pg-pv-step-progress-pct">${stPct}%</span>
                </div>` : ''}

                <div class="pg-pv-step-stats">
                    ${mTasks.length ? `<span class="pg-pv-step-stat"><i class="ti ti-checkbox"></i> ${mDone}/${mTasks.length} görev</span>` : ''}
                    ${stTotal ? `<span class="pg-pv-step-stat"><i class="ti ti-list-check"></i> ${stsDone}/${stTotal} alt görev</span>` : ''}
                    ${mDur ? `<span class="pg-pv-step-stat"><i class="ti ti-clock"></i> ${mDur}</span>` : ''}
                    ${daysInfo ? `<span class="pg-pv-step-stat${m.due_date < today && !m.done ? ' overdue' : ''}"><i class="ti ti-hourglass"></i> ${daysInfo}</span>` : ''}
                </div>
            </div>`;
        }).join('');

        // Click to highlight milestone date on calendar
        el.querySelectorAll('[data-pvms]').forEach(item => {
            item.addEventListener('click', () => {
                if (item.classList.contains('locked')) return;
                window.__setPvActiveMsId(item.dataset.pvms);
                _pvRenderStepper(g);
                // Jump to milestone's month on calendar
                const ms = (g.milestones || []).find(m => m.id === window.__getPvActiveMsId());
                if (ms?.due_date) {
                    const d = new Date(ms.due_date);
                    window.__setPvCalYear(d.getFullYear());
                    window.__setPvCalMonth(d.getMonth());
                    window.__setPvSelectedDate(ms.due_date);
                }
                window._pvRenderMainCal(g);
                window._pvRenderDayPanel(g, window.__getPvSelectedDate());
            });
        });
    }
