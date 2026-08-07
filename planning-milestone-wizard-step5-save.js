// planning-milestone-wizard-step5-save.js
// planning-milestone-wizard.js'ten çıkarıldı (Faz H devamı, 2. tur): Adım 5
// (özet) render'ı ve sihirbazı kapatıp yeni hedefi kaydeden _wzSave. wizardState'i
// sadece OKUYOR (reassignment yok) — ana dosyadaki canlı binding üzerinden erişiyor.
import { CATEGORIES, fmtDate, fmtShort, getCat, msUid } from './planning-utils.js';
import { wizardState, closeWizard } from './planning-milestone-wizard.js';

// ── Step 5 ────────────────────────────────
export function _wzStep5Render() {
    const { goal, milestones, firstMsDetail } = wizardState;
    const cat = getCat(goal.category);

    // Celebration sub text
    const subEl = document.getElementById('pg-wz-celebration-sub');
    if (subEl) {
        subEl.textContent = `${cat.icon} ${goal.title} · ${milestones.length} aşama · ${goal.deadline ? fmtDate(goal.deadline) + ' hedef tarihi' : 'Esnek takvim'}`;
    }

    // Summary
    const msDet = wizardState.msDet || {};
    const totalSubs = milestones.reduce((s, m) => s + ((msDet[m.id]?.subtasks || []).length), 0);
    const workDays  = goal.work_days || [];
    const dayNames  = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

    const sumEl = document.getElementById('pg-wz-summary');
    if (sumEl) {
        sumEl.innerHTML = `
        <div class="pg-wz-summary-card">
            <div class="pg-wz-summary-row">
                <span class="pg-wz-summary-label">Hedef</span>
                <span class="pg-wz-summary-val">${cat.icon} ${window.esc(goal.title)}</span>
            </div>
            ${goal.deadline ? `<div class="pg-wz-summary-row">
                <span class="pg-wz-summary-label">Son Tarih</span>
                <span class="pg-wz-summary-val">${fmtDate(goal.deadline)}</span>
            </div>` : ''}
            <div class="pg-wz-summary-row">
                <span class="pg-wz-summary-label">Dönüm Noktaları</span>
                <span class="pg-wz-summary-val">${milestones.length} aşama</span>
            </div>
            <div class="pg-wz-summary-ms-list">
                ${milestones.map(m => `<div class="pg-wz-summary-ms-item">
                    ${m.icon} ${window.esc(m.title)}
                    ${m.due_date ? `<span class="pg-wz-summary-ms-date">· ${fmtShort(m.due_date)}</span>` : ''}
                    ${msDet[m.id]?.criteria ? `<span class="pg-wz-summary-ms-date u-color-h4ade80" > ✓ ${window.esc(msDet[m.id].criteria)}</span>` : ''}
                </div>`).join('')}
            </div>
            ${workDays.length ? `<div class="pg-wz-summary-row">
                <span class="pg-wz-summary-label">Çalışma Günleri</span>
                <span class="pg-wz-summary-val">${workDays.length} gün/hafta · ${[...workDays].sort((a,b)=>a===0?1:b===0?-1:a-b).map(d=>dayNames[d]).join(', ')}</span>
            </div>` : ''}
            ${goal.hours_per_week ? `<div class="pg-wz-summary-row">
                <span class="pg-wz-summary-label">Haftalık Süre</span>
                <span class="pg-wz-summary-val">${goal.hours_per_week} saat/hafta</span>
            </div>` : ''}
            ${totalSubs ? `<div class="pg-wz-summary-row">
                <span class="pg-wz-summary-label">Toplam Alt Görev</span>
                <span class="pg-wz-summary-val">${totalSubs} hazır</span>
            </div>` : ''}
        </div>`;
        sumEl.querySelector('.pg-wz-summary-card')?.style.setProperty('--summary-color', cat.color);
    }

    // Collab info — adım 1'de seçilen moda göre göster
    const ci = document.getElementById('pg-wz-collab-info');
    if (ci) ci.style.display = (wizardState.mode || 'solo') === 'collab' ? '' : 'none';
}

// ── Wizard Save ───────────────────────────
export function _wzSave() {
    if (!wizardState) return;
    const { goal, milestones, firstMsDetail, mode } = wizardState;
    const cat = getCat(goal.category);

    const newGoal = {
        id: window.uid(), title: goal.title.trim(),
        description: goal.motivation || '',
        category: goal.category, color: cat.color,
        deadline: goal.deadline || '', priority: goal.priority,
        status: 'active', progress_pct: 0, milestones: [],
        work_days: goal.work_days || [],
        hours_per_week: goal.hours_per_week || 5,
        context: goal.context || {},
        plan_mode: wizardState.planMode || null,
        created_at: new Date().toISOString(), _dirty: true,
    };

    const msDet = wizardState.msDet || {};
    milestones.forEach((m, i) => {
        const det = msDet[m.id] || {};
        newGoal.milestones.push({
            id: m.id, title: m.title.trim(),
            description: det.resources || '',
            due_date: m.due_date || '', done: false, order: i,
            criteria: det.criteria || '',
            subtasks: (det.subtasks || []).map(s => ({ ...s })),
            planned_units: det.planned_units || [],
            created_at: new Date().toISOString(),
        });
    });

    window._pgGetGoals().unshift(newGoal);
    window.persistGoals();
    window.render();

    // ② Tarihli görevleri global görev sistemine aktar (Bugün sekmesinde görünsün)
    // st.date is YYYY-MM-DD; addGlobalTask expects DD-MM-YYYY
    const _ymToDD = (d) => { if (!d) return ''; const p = d.split('-'); return p.length === 3 && p[0].length === 4 ? `${p[2]}-${p[1]}-${p[0]}` : d; };
    newGoal.milestones.forEach(m => {
        (m.subtasks || []).forEach(st => {
            if (!st.date) return;
            const dateDDMMYYYY = _ymToDD(st.date);
            // Sihirbazın 4. adımında (Görev Planla) kullanıcı bir saat aralığı seçtiyse
            // onu kullan — seçmediyse eskisi gibi 09:00-10:00 varsayılanına düş.
            const timeStart = st.timeStart || '09:00';
            const timeEnd   = st.timeEnd   || '10:00';
            if (typeof window.addGlobalTask === 'function') {
                window.addGlobalTask(st.title, newGoal.priority || 2, newGoal.category || '', dateDDMMYYYY, timeStart, timeEnd, '', newGoal.id);
            } else {
                const tasks = FocusStorage.get('tasks', []);
                tasks.push({ id: 'task_' + Date.now() + '_' + Math.random().toString(36).slice(2,5), text: st.title, completed: false, priority: newGoal.priority || 2, category: newGoal.category || '', date: dateDDMMYYYY, timeStart, timeEnd, parentGoal: newGoal.id });
                FocusStorage.set('tasks', tasks);
            }
        });
    });

    closeWizard();
    window.toast('Hedef oluşturuldu! 🎯');

    setTimeout(() => {
        window.openPlanView(newGoal.id);
        if (mode === 'collab' && window.PlanningCollab) {
            setTimeout(() => window.PlanningCollab._handleEnableCollab(newGoal), 800);
        }
    }, 350);
}
