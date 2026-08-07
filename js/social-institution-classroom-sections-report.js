export function buildClassroomReportTabHtml(isClassAdmin, studentMembers, classSections, memberLabel) {
    const reportStudentOptions = isClassAdmin
        ? studentMembers.map(m => ({ ...m, classId: m.classSectionId || '__unassigned__' })).sort((a,b) => (a.displayName||'').localeCompare(b.displayName||'', 'tr'))
        : [];
    // Sınıf filtresi (117) — öğretmen kalabalık bir sınıfta öğrenciyi isim listesinde
    // arayıp bulmak yerine önce şubeye göre daraltabilsin.
    const reportSectionFilterHtml = (isClassAdmin && classSections.length) ? `
        <select id="cp-report-section-filter" class="cp-asg-pill-input u-flex-00150px" >
            <option value="">Tüm şubeler</option>
            ${classSections.map(s => `<option value="${s.id}">${window._escapeHtml(s.name)}</option>`).join('')}
            <option value="__unassigned__">Sınıfsız</option>
        </select>` : '';
    const reportHtml = isClassAdmin ? `
        <h3 class="cp-section-title u-margin-top-0" ><i class="fa-solid fa-file-pdf u-color-hff6b6b" ></i> ${memberLabel} Raporu</h3>
        <p class="cp-hint u-margin-4px012px" >Bir ${memberLabel.toLowerCase()} seç — ders programı, ödev tamamlama durumu ve odaklanma özetini içeren bir PDF raporu oluştur. Veli görüşmesi, danışmanlık ya da kurum kaydı için kullanılabilir.</p>
        <div class="cp-report-picker">
            ${reportSectionFilterHtml}
            <select id="cp-report-student-select" class="cp-asg-pill-input u-flex-1" >
                <option value="">${memberLabel} seç…</option>
                ${reportStudentOptions.map(m => `<option value="${m.userId}" data-section-id="${m.classId}">${window._escapeHtml(m.displayName)}</option>`).join('')}
            </select>
            <button id="cp-report-generate-btn" class="cp-report-btn" disabled><i class="fa-solid fa-file-arrow-down"></i> PDF Raporu Oluştur</button>
        </div>
        <div id="cp-report-status" class="cp-hint u-margin-top-8px" ></div>` : `
        <h3 class="cp-section-title u-margin-top-0" ><i class="fa-solid fa-file-pdf u-color-hff6b6b" ></i> Raporum</h3>
        <p class="cp-hint u-margin-4px012px" >Ders programını, ödev tamamlama durumunu ve odaklanma özetini içeren kişisel raporunu PDF olarak indir.</p>
        <button id="cp-report-generate-btn" class="cp-report-btn"><i class="fa-solid fa-file-arrow-down"></i> Raporumu PDF Olarak İndir</button>
        <div id="cp-report-status" class="cp-hint u-margin-top-8px" ></div>`;
    return { reportHtml, reportStudentOptions };
}
export function buildAssignmentAnalysisHtml(assignments, studentMembers, stepDoneByAsg, subsByAsg, pctColor, LOW_SAMPLE_MAX, memberLabel, asgLabel) {
    const resolvedAsgRows = assignments
        .filter(a => a.status === 'closed' || (a.due_date && new Date(a.due_date) < new Date()))
        .map(a => {
            const targetIds = (a.target_user_ids && a.target_user_ids.length) ? a.target_user_ids : studentMembers.map(m => m.userId);
            const isMultiStep = !!(a.steps && a.steps.length);
            const doneCount = isMultiStep
                ? targetIds.filter(uid => { const set = stepDoneByAsg[a.id]?.[uid]; return set && a.steps.every(s => set.has(s.id)); }).length
                : targetIds.filter(uid => (subsByAsg[a.id] || []).includes(uid)).length;
            const pct = targetIds.length ? Math.round((doneCount / targetIds.length) * 100) : 0;
            return { id: a.id, title: a.title, targetCount: targetIds.length, doneCount, pct };
        })
        .filter(r => r.targetCount >= 3) // küçük hedef gruplarında oran anlamsız dalgalanır
        .sort((a, b) => a.pct - b.pct);
    const lowAsgRows = resolvedAsgRows.filter(r => r.pct < 50);
    if (!resolvedAsgRows.length) return '';
    return `
        <h3 class="cp-section-title u-margin-top-20px" ><i class="fa-solid fa-magnifying-glass-chart u-color-ha29bfe" ></i> Ödev Bazlı Analiz <small>sonuçlanmış ödevler</small></h3>
        <div class="cp-table">
            <div class="cp-row cp-row--head u-grid-template-columns-1fr110px" >
                <span>${asgLabel}</span><span>Tamamlama</span>
            </div>
            ${resolvedAsgRows.map(r => `
            <div class="cp-row u-grid-template-columns-1fr110px" >
                <span class="cp-name">${window._escapeHtml(r.title)}${r.pct < 50 ? '<span class="cp-support-badge u-color-ha29bfe_background-rgba1621552540p12_border-color-rg" ><i class="fa-solid fa-magnifying-glass"></i> Gözden Geçir</span>' : ''}</span>
                <span class="cp-asg-pct-cell${r.targetCount < LOW_SAMPLE_MAX ? ' cp-asg-pct-cell--lowsample' : ''}">
                    <div class="cp-asg-pct-track"><div class="cp-asg-pct-fill" data-dyn-w="${r.pct}" data-dyn-bg="${pctColor(r.pct)}"></div></div>
                    <b data-dyn-color="${pctColor(r.pct)}">${r.doneCount}/${r.targetCount}</b>${r.targetCount < LOW_SAMPLE_MAX ? `<span class="cp-lowsample-badge cp-lowsample-badge--icon" title="Az veri: sadece ${r.targetCount} ${memberLabel.toLowerCase()} hedeflendi — bu kadar az veride % oranı bir kişinin sonucuyla bile büyük ölçüde değişebilir"><i class="fa-solid fa-circle-info"></i></span>` : ''}
                </span>
            </div>`).join('')}
        </div>
        ${lowAsgRows.length ? `<p class="cp-hint">"Gözden Geçir" rozeti, hedeflenen ${memberLabel.toLowerCase()}lerin yarısından azının tamamlayabildiği ödevleri işaret eder — bu genelde bireysel bir sorun değil, ödevin zorluğu/açıklığıyla ilgili bir sinyal olabilir.</p>` : ''}`;
}
