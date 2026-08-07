// social-institution-classroom-sections.js
// social-institution-panel.js'ten çıkarıldı (Faz H devamı): renderClassroomTab'ın
// alt-sekme veri üreticileri (Rapor/Ders Programı/Roster/Performans/Ödevler) —
// hepsi async data-fetcher + saf HTML üretici, module-seviye paylaşılan state'e
// (_classroomTabCache/_signedUrlCache) DOKUNMUYOR, sadece _getSignedUrlCached'i
// fonksiyon olarak ÇAĞIRIYOR (kendi Map'i panel.js'te kalıyor). Davranış birebir aynı.
import { getCurrentUser } from '../state/current-user-store.js';
import { _getSignedUrlCached } from './social-institution-panel.js';
import {
    _renderCategoryBreakdownHtml,
    _CT_TREND_WEEKS, _CT_TREND_MIN_TOTAL, _ctPctColor, _ctSparkHtml, _ctTrendDirection, _ctTrendArrowHtml,
    _ctRenderPerfRowsHtml, _ctRenderPerfDistributionHtml,
    _CT_LOW_SAMPLE_MAX, _CT_MIN_ASSIGNED_FOR_SUPPORT, _CT_FOCUS_MISMATCH_HIGH_MULT,
    _CT_FOCUS_MISMATCH_LOW_MULT, _CT_FOCUS_MISMATCH_MIN_MEDIAN, _CT_FOCUS_MISMATCH_HIGH_FLOOR,
    _CT_FOCUS_MISMATCH_HIGH_COMPLETION, _CT_FOCUS_Z_MIN_BASELINE_WEEKS, _CT_FOCUS_Z_DROP_THRESHOLD,
    _CT_FOCUS_Z_MIN_STD, _CT_PERIOD_LABEL, _CT_FOCUS_TREND_LABELS, _CT_ANOMALY_META, _CT_CONTEXT_META,
    _CT_PERF_SORT_KEYS, _ctSortPerfRows, _ctBuildPerfCounts, _ctBuildPerfRows,
} from './social-institution-classroom-perf-utils.js';
export { buildClassroomReportTabHtml, buildAssignmentAnalysisHtml } from './social-institution-classroom-sections-report.js';

       export function _ctAsgCardHtml(a, ctx) {
           const { isClassAdmin, memberLabel, asgLabel, targetCount, targetMembers, asgCompletion, priorityBadge, fmtDue,
               attachUrlById, mySubAttachUrlById, mySubs, mySubmittedAt, mySubAttachment, subsByAsg, stepDoneByAsg,
               myGrades, subNotes, subGrades } = ctx;
           const isMultiStep = !!(a.steps && a.steps.length);
           const subs = subsByAsg[a.id] || [];
           const myStepSet = isMultiStep ? (stepDoneByAsg[a.id]?.[getCurrentUser().id] || new Set()) : null;
           const myStepsDone = isMultiStep ? a.steps.filter(s => myStepSet.has(s.id)).length : 0;
           const done = isMultiStep ? (a.steps.length > 0 && myStepsDone === a.steps.length) : mySubs.has(a.id);
           const stepCompletedUsers = isMultiStep
               ? targetMembers(a).filter(m => { const set = stepDoneByAsg[a.id]?.[m.userId]; return set && a.steps.every(s => set.has(s.id)); })
               : [];
           const closed = a.status === 'closed';
           const overdue = !closed && a.due_date && new Date(a.due_date) < new Date();
           const dueSoon = !closed && !overdue && a.due_date && (new Date(a.due_date) - new Date()) < 2 * 24 * 3600 * 1000;
           const tCount = targetCount(a);
           const isTargeted = !!(a.target_user_ids && a.target_user_ids.length);
           const attachUrl = attachUrlById[a.id];
           const myGrade = myGrades[a.id];
           const classContext = (!isClassAdmin && (closed || overdue)) ? asgCompletion(a) : null;
           const showClassContextNote = !!(classContext && classContext.targetCount >= 3 && classContext.pct < 50);
           const notSubmitted = isMultiStep
               ? targetMembers(a).filter(m => !stepCompletedUsers.some(sm => sm.userId === m.userId))
               : targetMembers(a).filter(m => !subs.includes(m.userId));
           const mySubAt = mySubmittedAt[a.id];
           const wasLate = done && mySubAt && a.due_date && new Date(mySubAt) > new Date(a.due_date);
           const mySubAttachUrl = mySubAttachUrlById[a.id];
           const studentStatusPillHtml = isMultiStep
               ? (done ? `<span class="pg-pv-assign-badge ok">Tamamlandı</span>` : `<span class="pg-pv-assign-badge ${myStepsDone > 0 ? 'warn' : 'wait'}">${myStepsDone}/${a.steps.length} adım</span>`)
               : closed
                   ? (done ? (wasLate ? `<span class="pg-pv-assign-badge warn">Geç teslim ettin</span>` : `<span class="pg-pv-assign-badge ok">Zamanında teslim ettin</span>`) : `<span class="pg-pv-assign-badge bad">Kaçırdın</span>`)
                   : (done ? (wasLate ? `<span class="pg-pv-assign-badge warn">Geç teslim ettin</span>` : `<span class="pg-pv-assign-badge ok">Teslim ettin</span>`) : `<span class="pg-pv-assign-badge wait">Bekliyor</span>`);
           let accent = 'default';
           if (closed) accent = 'closed';
           else if (overdue) accent = 'overdue';
           else if (a.priority === 'urgent') accent = 'urgent';
           else if (!isClassAdmin && done) accent = 'done';
           else if (a.priority === 'important') accent = 'important';
           return `
               <div class="cp-asg${closed ? ' cp-asg--closed' : ''}" data-accent="${accent}">
                   <div class="cp-asg-main">
                       <span class="cp-asg-title">${window._escapeHtml(a.title)}${priorityBadge(a.priority)}${(isClassAdmin && isMultiStep) ? ' <span class="pg-teacher-plan-badge" title="Çok adımlı ödev / ders planı"><i class="fa-solid fa-list-check"></i> Adımlı</span>' : ''}${isTargeted ? ` <span class="cp-asg-targeted-badge" title="Yalnızca seçili ${memberLabel.toLowerCase()}lere atandı"><i class="fa-solid fa-user-check"></i> ${tCount} kişi</span>` : ''}</span>
                       ${a.description ? `<span class="cp-asg-desc">${window._escapeHtml(a.description)}</span>` : ''}
                       ${attachUrl ? `<a href="${attachUrl}" target="_blank" rel="noopener" class="cp-asg-attach"><i class="fa-solid fa-paperclip"></i> ${window._escapeHtml(a.attachment.name || 'Ek dosya')}</a>` : ''}
                       ${!isClassAdmin && mySubAttachUrl ? `<a href="${mySubAttachUrl}" target="_blank" rel="noopener" class="cp-asg-attach" title="Teslimine eklediğin dosya"><i class="fa-solid fa-file-circle-check"></i> ${window._escapeHtml(mySubAttachment[a.id]?.name || 'Teslim dosyan')}</a>` : ''}
                       ${isClassAdmin ? `
                       <span class="cp-asg-meta">
                           ${a.due_date ? `<span${overdue ? ' class="u-color-hff6b6b"' : dueSoon ? ' class="u-color-hfeca57"' : ''}><i class="fa-regular fa-calendar"></i> ${fmtDue(a.due_date)}${dueSoon ? ' · Yakında' : overdue ? ' · Süresi geçti' : ''}</span> · ` : ''}
                           ${isMultiStep
                               ? `<b>${stepCompletedUsers.length}/${tCount}</b> tamamladı`
                               : closed
                                   ? `Kapatıldı · <b>${subs.length}/${tCount}</b> teslim`
                                   : `<b>${subs.length}/${tCount}</b> teslim`}
                       </span>` : (a.due_date ? `
                       <span class="cp-asg-meta cp-asg-meta--v2">
                           <span class="cp-asg-due${overdue ? ' is-overdue' : dueSoon ? ' is-soon' : ''}"><i class="fa-regular fa-calendar"></i> ${fmtDue(a.due_date)}</span>
                       </span>` : '')}
                       ${!isClassAdmin && myGrade ? `
                       <span class="cp-asg-grade">${myGrade.grade != null ? `<b>${myGrade.grade}/100</b>` : ''}${myGrade.teacher_feedback ? ` · <i class="fa-solid fa-comment-dots"></i> ${window._escapeHtml(myGrade.teacher_feedback)}` : ''}</span>` : ''}
                       ${showClassContextNote ? `
                       <span class="cp-asg-context-note"><i class="fa-solid fa-users"></i> Bu ${(asgLabel || 'ödevi').toLowerCase()}i sınıfın sadece %${classContext.pct}'i tamamlayabildi — yalnız değilsin.</span>` : ''}
                       ${!isClassAdmin && !closed && isMultiStep ? `
                       <details class="cp-asg-steps-toggle">
                           <summary>Adımları göster <small>(${myStepsDone}/${a.steps.length})</small></summary>
                           <div class="cp-asg-steps-checklist">
                               ${a.steps.map(s => `
                               <label class="cp-asg-step-row${(s.description || s.resourceUrl || s.estMinutes) ? ' cp-asg-step-row--rich' : ''}">
                                   <input type="checkbox" class="cp-asg-step-check" data-asg-id="${a.id}" data-step-id="${s.id}" ${myStepSet.has(s.id) ? 'checked' : ''}>
                                   <span class="cp-asg-step-row-body">
                                       <span class="cp-asg-step-row-title">${window._escapeHtml(s.title)}${s.estMinutes ? ` <small>(~${s.estMinutes} dk)</small>` : ''}</span>
                                       ${s.description ? `<span class="cp-asg-step-row-desc">${window._escapeHtml(s.description)}</span>` : ''}
                                       ${s.resourceUrl ? `<a href="${window._escapeHtml(s.resourceUrl)}" target="_blank" rel="noopener" class="cp-asg-step-row-link"><i class="fa-solid fa-link"></i> Kaynak</a>` : ''}
                                   </span>
                               </label>`).join('')}
                           </div>
                       </details>` : ''}
                       ${!isClassAdmin && !closed && !isMultiStep && !done ? `
                       <details class="cp-asg-submit-form">
                           <summary>Teslim et…</summary>
                           <div class="cp-asg-submit-body">
                               <textarea class="gsc-form-input cp-asg-submit-note" placeholder="Kısa bir not (opsiyonel)…" maxlength="200" rows="2"></textarea>
                               <div class="cp-asg-submit-row">
                                   <label class="cp-asg-file-label">
                                       <input type="file" class="cp-asg-submit-file u-display-none" >
                                       <span class="cp-asg-submit-file-name"><i class="fa-solid fa-paperclip"></i> Dosya/fotoğraf ekle</span>
                                   </label>
                                   <button class="cp-asg-submit-confirm" data-id="${a.id}"><i class="fa-solid fa-check"></i> Teslim Et</button>
                               </div>
                           </div>
                       </details>` : ''}
                       ${isClassAdmin && !closed ? `
                       <details class="cp-subs">
                           <summary>${isMultiStep ? 'İlerleme durumu' : 'Kim teslim etti?'}</summary>
                           ${isMultiStep ? `
                           <div class="cp-asg-step-breakdown">
                               ${a.steps.map(s => {
                                   const n = targetMembers(a).filter(m => stepDoneByAsg[a.id]?.[m.userId]?.has(s.id)).length;
                                   const pct = tCount ? Math.round(n / tCount * 100) : 0;
                                   return `
                                   <div class="cp-asg-step-bd-row" title="${window._escapeHtml(s.title)}">
                                       <span class="cp-asg-step-bd-title">${window._escapeHtml(s.title)}</span>
                                       <div class="cp-asg-step-bd-bar"><div class="cp-asg-step-bd-fill" data-dyn-w="${pct}"></div></div>
                                       <span class="cp-asg-step-bd-count">${n}/${tCount}</span>
                                   </div>`;
                               }).join('')}
                           </div>` : ''}
                           <div class="cp-subs-list">
                               ${targetMembers(a).map(m => {
                                   if (isMultiStep) {
                                       const set = stepDoneByAsg[a.id]?.[m.userId] || new Set();
                                       const n = a.steps.filter(s => set.has(s.id)).length;
                                       const did = n === a.steps.length;
                                       return `
                                       <details class="cp-sub-student-detail">
                                           <summary class="cp-sub${did ? ' is-done' : ''}">${did ? '✓' : '○'} ${window._escapeHtml(m.displayName)} (${n}/${a.steps.length})</summary>
                                           <div class="cp-sub-student-steps">
                                               ${a.steps.map(s => `<span class="cp-sub-step${set.has(s.id) ? ' is-done' : ''}">${set.has(s.id) ? '✓' : '○'} ${window._escapeHtml(s.title)}</span>`).join('')}
                                           </div>
                                       </details>`;
                                   }
                                   const did = subs.includes(m.userId);
                                   const note = subNotes[a.id]?.[m.userId];
                                   return `<span class="cp-sub${did ? ' is-done' : ''}"${note ? ` title="${window._escapeHtml(note)}"` : ''}>${did ? '✓' : '○'} ${window._escapeHtml(m.displayName)}${note ? ' 💬' : ''}</span>`;
                               }).join('')}
                           </div>
                           ${!isMultiStep && subs.length ? `
                           <div class="cp-grade-list">
                               ${targetMembers(a).filter(m => subs.includes(m.userId)).map(m => {
                                   const g = subGrades[a.id]?.[m.userId] || {};
                                   return `
                                   <div class="cp-grade-row" data-asg-id="${a.id}" data-user-id="${m.userId}">
                                       <span class="cp-grade-row-name">${window._escapeHtml(m.displayName)}</span>
                                       <input type="number" min="0" max="100" placeholder="Puan" class="gsc-form-input cp-grade-input" value="${g.grade != null ? g.grade : ''}">
                                       <input type="text" placeholder="Geri bildirim…" maxlength="200" class="gsc-form-input cp-grade-feedback" value="${window._escapeHtml(g.teacher_feedback || '')}">
                                       <button class="control-btn secondary cp-grade-save" title="Kaydet" aria-label="Kaydet"><i class="fa-solid fa-check"></i></button>
                                   </div>`;
                               }).join('')}
                           </div>` : ''}
                           ${notSubmitted.length ? `<button class="control-btn secondary cp-asg-btn cp-asg-remind u-margin-top-8px_font-size-11px" data-id="${a.id}" ><i class="fa-solid fa-bell"></i> ${isMultiStep ? 'Tamamlamayan' : 'Teslim etmeyen'} ${notSubmitted.length} kişiye hatırlat</button>` : ''}
                       </details>` : ''}
                   </div>
                   <div class="cp-asg-actions${!isClassAdmin ? ' cp-asg-actions--student' : ''}">
                       ${!isClassAdmin ? studentStatusPillHtml : ''}
                       ${!isClassAdmin && !closed && !isMultiStep && done ? `
                       <button class="control-btn secondary cp-asg-btn" data-cp-act="undo" data-id="${a.id}">Geri Al</button>` : ''}
                       ${isClassAdmin && !closed ? `<button class="control-btn secondary cp-asg-btn" data-cp-act="close" data-id="${a.id}" title="Ödevi tamamlandı olarak işaretle"><i class="fa-solid fa-check"></i> Tamamlandı</button>` : ''}
                       ${isClassAdmin ? `<button class="control-btn secondary cp-asg-btn cp-asg-btn--danger" data-cp-act="delete" data-id="${a.id}" title="Sil" aria-label="Sil"><i class="fa-solid fa-trash-can"></i></button>` : ''}
                   </div>
               </div>`;
       }
       // renderClassroomTab'ın 'Ders Programı' alt-sekmesini hesaplar. Kendi Supabase
       // sorgularını yapan, ASENKRON, göreceli olarak bağımsız bir bölüm — ama scheduleRows/
       // scheduleSubjectOptions/scheduleCardByClass/classNameById/DAY_NAMES_TR aşağıda (Aksiyonlar
       // bölümünde, program düzenleme modallerinde) TEKRAR kullanıldığı için hepsi dönüş
       // değerinde — bu yüzden çağıran taraf hâlâ aynı isimlerle destructure ediyor, davranış
       // birebir aynı.
       export async function buildScheduleSectionData(data, isClassAdmin, schedRes, classSections) {
           // ── Ders Programı — öğretmenin girdiği haftalık, tekrarlayan program.
           // Artık sınıf başına değil ŞUBE başına (117) — bu grubun içindeki her şube
           // kendi programına sahip olabilir. Yönetici (öğretmen) tüm şubelerin
           // programlarını kart listesi olarak görür; öğrenci sadece KENDİ şubesinin (veya
           // hiçbir şubeye özel olmayan "Genel" programın) yayınlanmışını doğrudan görür.
           const DAY_NAMES_TR = ['Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi','Pazar'];
           const myClassSectionId = data.members?.[getCurrentUser().username]?.classSectionId || null;
           let schedulePrograms = [];
           if (isClassAdmin) {
               const { data: progRows } = await window.FocusSupabase
                   .from('group_schedule_programs').select('id, group_id, class_section_id, name, status, created_by, published_at')
                   .eq('group_id', data._supaId).order('created_at', { ascending: false });
               schedulePrograms = progRows || [];
           } else {
               schedulePrograms = schedRes?.data || [];
           }
           const publishedProgram = schedulePrograms.find(p => p.status === 'published' && (!p.class_section_id || p.class_section_id === myClassSectionId)) || null;
           let scheduleRows = [];
           if (!isClassAdmin && publishedProgram) {
               const { data: schedSlotRows } = await window.FocusSupabase
                   .from('group_class_schedule').select('*').eq('program_id', publishedProgram.id)
                   .order('day_of_week', { ascending: true }).order('time_start', { ascending: true });
               scheduleRows = schedSlotRows || [];
           }
           const scheduleByDay = {};
           scheduleRows.forEach(r => { (scheduleByDay[r.day_of_week] = scheduleByDay[r.day_of_week] || []).push(r); });
           const scheduleDayCol = (dow) => {
               const items = scheduleByDay[dow] || [];
               return `
               <div class="cp-sched-day-col">
                   <div class="cp-sched-day-head">${DAY_NAMES_TR[dow]}</div>
                   ${items.length ? items.map(r => `
                   <div class="cp-sched-slot" data-id="${r.id}">
                       <div class="cp-sched-slot-time">${(r.time_start || '').slice(0,5)}–${(r.time_end || '').slice(0,5)}</div>
                       <div class="cp-sched-slot-subject">${window._escapeHtml(r.subject)}${r.location ? ` <span class="cp-sched-slot-loc">· ${window._escapeHtml(r.location)}</span>` : ''}</div>
                   </div>`).join('') : `<div class="cp-sched-day-empty">—</div>`}
               </div>`;
           };
           const scheduleSubjectOptions = [...new Set(scheduleRows.map(r => r.subject).filter(Boolean))];

           // Admin görünümü: her ŞUBE için en fazla 1 kart (yayınlanmış varsa onu, yoksa
           // kendi taslağını göster — ikisi de varsa yayınlanmışı önceliklendir, taslak ayrıca
           // "Devam Et" rozetiyle işaretlenir). class_section_id null ise "Genel" (__general__).
           const scheduleCardByClass = {};
           if (isClassAdmin) {
               schedulePrograms.forEach(p => {
                   const key = p.class_section_id || '__general__';
                   const isMine = p.created_by === getCurrentUser().id;
                   if (p.status === 'published') {
                       scheduleCardByClass[key] = { program: p, hasPublished: true, hasMyDraft: scheduleCardByClass[key]?.hasMyDraft || false };
                   } else if (p.status === 'draft' && isMine) {
                       scheduleCardByClass[key] = scheduleCardByClass[key] || { program: null, hasPublished: false, hasMyDraft: false };
                       scheduleCardByClass[key].hasMyDraft = true;
                       scheduleCardByClass[key].draftProgram = p;
                       if (!scheduleCardByClass[key].program) scheduleCardByClass[key].program = p;
                   }
               });
           }
           const classNameById = { __general__: 'Genel (şubesiz)' };
           classSections.forEach(s => { classNameById[s.id] = s.name; });
           const scheduleCardsHtml = Object.keys(scheduleCardByClass).length ? `
               <div class="u-display-flex_flex-direction-column_gap-8px_margin-bottom-1">
                   ${Object.entries(scheduleCardByClass).map(([sectionKey, info]) => {
                       const cName = classNameById[sectionKey] || 'Şube';
                       const badge = info.hasPublished
                           ? `<span class="u-font-size-10p5px_font-weight-600_padding-2px8px_border-rad-3"><i class="fa-solid fa-circle-check"></i> Yayında</span>`
                           : `<span class="u-font-size-10p5px_font-weight-600_padding-2px8px_border-rad-4"><i class="fa-solid fa-pen"></i> Taslak</span>`;
                       const progIdForActions = info.hasPublished ? info.program.id : (info.draftProgram ? info.draftProgram.id : '');
                       return `
                       <div type="button" role="button" tabindex="0" class="cp-asg-card cp-sched-class-card u-display-flex_align-items-center_justify-content-space-betw-18" data-section-id="${sectionKey}" data-section-name="${window._escapeHtml(cName)}" data-published-id="${info.hasPublished ? info.program.id : ''}" data-draft-id="${info.draftProgram ? info.draftProgram.id : ''}" >
                           <span class="u-display-flex_align-items-center_gap-8px_min-width-0">
                               <i class="fa-solid fa-calendar-days u-color-h4ecdc4" ></i>
                               <span class="u-font-size-13px_font-weight-600_color-hfff_overflow-hidden_">Ders Programı</span>
                               <span class="cp-roster-row-class u-max-width-140px" title="${window._escapeHtml(cName)}">${window._escapeHtml(cName)}</span>
                           </span>
                           <span class="u-display-flex_align-items-center_gap-6px_flex-shrink-0">
                               ${badge}
                               <button type="button" class="cp-sched-card-edit u-width-22px_height-22px_border-radius-50pct_background-none" data-section-id="${sectionKey}" data-section-name="${window._escapeHtml(cName)}" data-program-id="${progIdForActions}" data-program-status="${info.hasPublished ? 'published' : 'draft'}" title="Düzenle"  aria-label="Düzenle"><i class="fa-solid fa-pen"></i></button>
                               <button type="button" class="cp-sched-card-del u-width-22px_height-22px_border-radius-50pct_background-none" data-section-id="${sectionKey}" data-section-name="${window._escapeHtml(cName)}" data-program-id="${progIdForActions}" title="Sil"  aria-label="Sil"><i class="fa-solid fa-trash-can"></i></button>
                               <i class="fa-solid fa-chevron-right u-font-size-11px_color-var-text-muted" ></i>
                           </span>
                       </div>`;
                   }).join('')}
               </div>` : '';

           const scheduleHtml = `
               <div class="u-display-flex_align-items-flex-start_justify-content-space--2">
                   <div>
                       <h3 class="cp-section-title u-margin-004px_display-flex_align-items-center_gap-6px" >
                           <i class="fa-solid fa-calendar-days u-color-h4ecdc4" ></i> Ders Programı
                           <div class="cp-popover cp-sched-help-popover">
                               <button type="button" class="cp-sched-help-toggle" aria-label="Ders Programı hakkında bilgi"><i class="fa-solid fa-circle-info"></i></button>
                               <div class="cp-sched-help-panel cp-popover-panel" hidden>
                                   <button type="button" class="cp-popover-close" aria-label="Kapat"><i class="fa-solid fa-xmark"></i></button>
                                   <p>${isClassAdmin ? 'Sınıfların haftalık ders programlarını buradan hazırlayabilirsin — Yayınla demeden öğrenciler göremez.' : 'Öğretmeninin yayınladığı haftalık ders programı.'}</p>
                               </div>
                           </div>
                       </h3>
                   </div>
                   ${isClassAdmin ? `<button id="cp-sched-open-modal-btn" class="cp-roster-pillbtn cp-roster-pillbtn--accent u-flex-shrink-0" ><i class="fa-solid fa-plus"></i> Oluştur</button>` : ''}
               </div>
               ${isClassAdmin ? `
               ${scheduleCardsHtml || '<p class="cp-hint">Henüz hiçbir şube için ders programı oluşturulmadı.</p>'}` : (publishedProgram ? `
               <div class="cp-sched-grid cp-sched-grid--view">
                   ${DAY_NAMES_TR.map((_, i) => scheduleDayCol(i)).join('')}
               </div>` : `<p class="cp-hint">Öğretmenin henüz bir ders programı paylaşmadı.</p>`)}`;
           return { scheduleHtml, scheduleRows, scheduleSubjectOptions, scheduleCardByClass, classNameById, DAY_NAMES_TR, myClassSectionId };
       }

       // renderClassroomTab'ın 'Sınıflar/Öğrenciler' alt-sekmesini hesaplar. rosterMembers
       // aşağıda (Aksiyonlar bölümünde, şube kartı tıklama/öğrenci arama gibi event
       // handler'larında) TEKRAR kullanıldığı için dönüş değerinde.
       export function buildRosterSectionData(el, isClassAdmin, studentMembers, sectionNameById, classSections, memberLabel) {
           // ── Sınıflar/Öğrenciler sekmesi — sadece admin: KURUMDAKİ TÜM sınıfların öğrencilerini
           // (bu grubun TEK öğrenci havuzu — artık kardeş grup yok) tek listede gösterir,
           // kullanıcı adıyla arayıp doğrudan (davet beklemeden) group_members'a ekler, ve
           // öğrencileri bu grubun İÇİNDEKİ şubelere (group_class_sections) atama imkanı sunar.
           const rosterMembers = isClassAdmin
               ? studentMembers.map(m => ({ ...m, classId: m.classSectionId || '__unassigned__', className: m.classSectionId ? (sectionNameById[m.classSectionId] || 'Şube') : 'Sınıfsız' }))
                   .sort((a,b) => (a.displayName||'').localeCompare(b.displayName||'', 'tr'))
               : [];
           const unassignedRosterCount = rosterMembers.filter(m => m.classId === '__unassigned__').length;
           // Durum noktası: üye şu an odaklanıyor/çevrimiçi mi — canlı presence kanalından
           // (aynı sinyal grup üye paneli ve leaderboard'da da kullanılıyor, bkz. satır ~13917).
           if (isClassAdmin) window.registerPresenceWatchIds?.(rosterMembers.map(m => m.userId));
           const rosterPresenceState = isClassAdmin && window.getCommunityPresenceState ? window.getCommunityPresenceState() : null;
           const rosterIsOnline = (userId) => !!(rosterPresenceState && rosterPresenceState[userId] && rosterPresenceState[userId].some(p => p.studying));
           const rosterOgrencilerHtml = `
               ${(classSections.length > 0 && unassignedRosterCount > 0) ? `
               <div id="cp-roster-unassigned-warning" class="cp-roster-unassigned-warning">
                   <i class="fa-solid fa-triangle-exclamation"></i>
                   <span><b>${unassignedRosterCount}</b> ${memberLabel.toLowerCase()} henüz bir şubeye atanmadı — "Sınıfsız" olarak listeleniyor.</span>
               </div>` : ''}
               <div class="cp-roster-toolbar">
                   <div class="cp-roster-searchbox">
                       <i class="fa-solid fa-magnifying-glass cp-roster-addbox-icon"></i>
                       <input id="cp-roster-search" class="cp-roster-input" placeholder="${memberLabel} ara…">
                   </div>
               </div>
               ${rosterMembers.length > 1 ? `
               <div id="cp-roster-bulk-bar" class="cp-roster-bulk-bar hidden">
                   <i class="fa-solid fa-square-check u-color-ha29bfe" ></i>
                   <span id="cp-roster-bulk-count" class="cp-roster-bulk-count">0 ${memberLabel.toLowerCase()} seçildi</span>
                   <div class="cp-roster-bulk-actions">
                       ${classSections.length ? `
                       <select id="cp-roster-bulk-move" class="cp-roster-input cp-roster-input--sm">
                           <option value="">Şubeye ata…</option>
                           ${classSections.map(s => `<option value="${s.id}">${window._escapeHtml(s.name)}</option>`).join('')}
                           <option value="__unassigned__">— Sınıfsız yap —</option>
                       </select>` : ''}
                       <button id="cp-roster-bulk-remove" class="cp-roster-pillbtn cp-roster-pillbtn--danger"><i class="fa-solid fa-user-xmark"></i> Çıkar</button>
                       <button id="cp-roster-bulk-clear" class="cp-roster-iconbtn" title="Seçimi temizle" aria-label="Seçimi temizle"><i class="fa-solid fa-xmark"></i></button>
                   </div>
               </div>
               <label class="cp-roster-selectall-row">
                   <input type="checkbox" id="cp-roster-select-all">
                   <span>Tümünü seç</span>
                   <span class="cp-roster-total-count">${rosterMembers.length} ${memberLabel.toLowerCase()}</span>
               </label>` : ''}
               <div id="cp-roster-member-list" class="cp-roster-list">
                   ${rosterMembers.length ? rosterMembers.map(m => { const sectionOptions = classSections.filter(s => s.id !== m.classId); return `
                   <div class="cp-roster-row" data-search-name="${window._escapeHtml((m.displayName||'').toLowerCase())}">
                       <span class="cp-roster-row-left">
                           ${m.userId !== getCurrentUser().id ? `<input type="checkbox" class="cp-roster-row-check" data-user-id="${m.userId}" data-name="${window._escapeHtml(m.displayName)}">` : '<span class="cp-roster-row-check-spacer"></span>'}
                           <span class="cp-roster-avatar-wrap">
                               ${avatarImgHtml({ displayName: m.displayName, avatarColor: m.avatarColor, customAvatar: m.customAvatar }, 32)}
                               <span class="cp-roster-status-dot${rosterIsOnline(m.userId) ? ' cp-roster-status-dot--on' : ''}" title="${rosterIsOnline(m.userId) ? 'Şu an odaklanıyor' : 'Çevrimdışı'}"></span>
                           </span>
                           <span class="cp-roster-row-name">${window._escapeHtml(m.displayName)}</span>
                           <span class="cp-roster-row-class${m.classId === '__unassigned__' ? ' cp-roster-row-class--unassigned' : ''}" title="${window._escapeHtml(m.className)}">${window._escapeHtml(m.className)}</span>
                       </span>
                       <div class="cp-roster-row-actions">
                           ${classSections.length ? `
                           <select class="cp-roster-input cp-roster-input--sm cp-roster-move-select" data-user-id="${m.userId}" data-name="${window._escapeHtml(m.displayName)}" data-current-section-id="${m.classId}">
                               <option value="">${m.classId === '__unassigned__' ? 'Şubeye ata…' : 'Şube değiştir…'}</option>
                               ${sectionOptions.map(s => `<option value="${s.id}">${window._escapeHtml(s.name)}</option>`).join('')}
                               ${m.classId !== '__unassigned__' ? `<option value="__unassigned__">— Sınıfsız yap —</option>` : ''}
                           </select>` : ''}
                           ${m.userId !== getCurrentUser().id ? `<button class="cp-roster-remove-btn cp-roster-iconbtn cp-roster-iconbtn--danger" data-user-id="${m.userId}" data-name="${window._escapeHtml(m.displayName)}" title="Sınıftan çıkar" aria-label="Sınıftan çıkar"><i class="fa-solid fa-user-xmark"></i></button>` : ''}
                       </div>
                   </div>`; }).join('') : `
                   <div class="cp-roster-empty">
                       <i class="fa-solid fa-user-group"></i>
                       <p>Henüz ${memberLabel.toLowerCase()} yok. Üstteki <b>"Davet Et"</b> butonuyla ilk ${memberLabel.toLowerCase()}ini davet et.</p>
                   </div>`}
               </div>`;

           // "Şubeler" alt-görünümü — bu grubun İÇİNDEKİ sınıf/şube etiketlerini yönetir
           // (group_class_sections, 116). Artık ayrı bir grup DEĞİL, sadece bu grubun
           // öğrencilerini gruplamak için bir etiket sistemi — Performans/Ders Programı bu
           // etikete göre filtrelenir.
           const sectionMemberCount = {};
           rosterMembers.forEach(m => { if (m.classId !== '__unassigned__') sectionMemberCount[m.classId] = (sectionMemberCount[m.classId] || 0) + 1; });
           const rosterSiniflarHtml = `
               <div class="cp-roster-classes-head">
                   <p class="cp-hint u-margin-0" >Bu gruptaki öğrencileri şubelere ayır — Performans tablosunda ve Ders Programı'nda şubeye göre filtreleyebilesin.</p>
               </div>
               <div class="cp-roster-addbox u-margin-bottom-12px" >
                   <i class="fa-solid fa-chalkboard cp-roster-addbox-icon"></i>
                   <input id="cp-section-add-name" class="cp-roster-input" placeholder="Yeni şube adı (ör. 9-A)…" maxlength="40" autocomplete="off">
                   <button id="cp-section-add-btn" class="cp-roster-addbtn" title="Şube Oluştur" aria-label="Şube Oluştur"><i class="fa-solid fa-plus"></i></button>
               </div>
               <div id="cp-section-add-status" class="cp-hint u-margin-6px012px" ></div>
               <div class="cp-inst-class-grid">
                   ${classSections.length ? classSections.map(s => `
                   <div class="cp-inst-class-card cp-section-card-open u-cursor-pointer" role="button" tabindex="0" data-section-id="${s.id}" data-section-name="${window._escapeHtml(s.name)}">
                       <div class="cp-inst-class-icon"><i class="fa-solid fa-chalkboard"></i></div>
                       <div class="cp-inst-class-name">${window._escapeHtml(s.name)}</div>
                       <div class="cp-inst-class-meta">${sectionMemberCount[s.id] || 0} ${memberLabel.toLowerCase()}</div>
                   </div>`).join('') : `<p class="cp-hint">Henüz şube yok. Yukarıdan ilk şubeni oluştur.</p>`}
               </div>`;

           // Öğrenciler/Şubeler iç-sekmesi hangi seçiliyse (kart tıklayıp modal kapatınca ya
           // da bir işlem sonrası refresh() ile) o sekmede kalmaya devam etsin — sabit
           // "ogrenciler" varsayılanı, Şubeler'deyken yapılan her işlemde kullanıcıyı
           // Öğrenciler'e geri atıyordu (bkz. kullanıcı geri bildirimi, 2026-07-11).
           const activeRosterSubtab = el.dataset.activeRosterSubtab === 'siniflar' ? 'siniflar' : 'ogrenciler';
           const rosterHtml = isClassAdmin ? `
               <div class="cp-roster-panel">
                   <h3 class="cp-section-title u-margin-top-0" ><i class="fa-solid fa-users u-color-h74b9ff-2" ></i> Sınıflar/${memberLabel}ler</h3>
                   <div class="cp-roster-segctrl">
                       <button class="cp-roster-innertab-btn${activeRosterSubtab === 'ogrenciler' ? ' active' : ''}" data-cprostersub="ogrenciler"><i class="fa-solid fa-user-group"></i> ${memberLabel}ler</button>
                       <button class="cp-roster-innertab-btn${activeRosterSubtab === 'siniflar' ? ' active' : ''}" data-cprostersub="siniflar"><i class="fa-solid fa-chalkboard-user"></i> Şubeler</button>
                   </div>
                   <div class="cp-roster-innertab-panel${activeRosterSubtab === 'ogrenciler' ? ' active' : ' hidden'}" data-cprosterpanel="ogrenciler">${rosterOgrencilerHtml}</div>
                   <div class="cp-roster-innertab-panel${activeRosterSubtab === 'siniflar' ? ' active' : ' hidden'}" data-cprosterpanel="siniflar">${rosterSiniflarHtml}</div>
               </div>` : '';
           return { rosterHtml, rosterMembers };
       }

       // "Ödev Bazlı Analiz" — "kim yapmadı" değil "hangi ödev genel olarak zor/belirsiz geldi"
       // sorusuna cevap verir. Bir ödevi hedeflenen öğrencilerin çoğu tamamlayamamışsa bu genelde
       // bireysel bir motivasyon sorunu değil, ödevin kendisiyle ilgili bir sinyaldir (çok zor,
       // belirsiz, süre kısa) — öğretmenin kendi ödev tasarımını gözden geçirmesi için. Sadece
       // SONUÇLANMIŞ (süresi geçmiş/kapatılmış) ödevler sayılır; henüz vadesi gelmemiş bir ödev
       // burada "başarısız" gibi görünmesin. Saf fonksiyon — renderClassroomTab'ın sadece BU
       // hesaplamada kullandığı veriyi parametre olarak alır.
       // Faz K/dev-dosya-refactoru: renderClassroomTab'ın Performans sekmesi bölümü (veri işleme +
       // HTML üretimi) buraya çıkarıldı. Aşağıdaki closure'lar (sortPerfRows/filterPerfRowsByClass/
       // renderPerfRowsHtml/renderPerfDistributionHtml/buildPerfRows) renderClassroomTab'ın sonundaki
       // event-binding bloğunda (sıralama/filtre tıklamaları) hâlâ kullanıldığı için döndürülüyor —
       // davranış birebir aynı, sadece konum değişti.
       export async function buildPerformanceSectionData(el, data, isClassAdmin, studentMembers, memberCount, classSections, sectionNameById, assignments, subsByAsg, stepDoneByAsg, statsRes, catRes, focusHistRes, memberLabel, asgLabel) {
           let perfHtml = '';
           let perfRows = [];
           // Bu grubun içinde şube (group_class_sections) tanımlıysa Performans tablosuna
           // "Sınıf" sütunu eklenir ve şubeye göre filtrelenebilir hale gelir — hiç şube
           // tanımlanmamışsa bu sütun anlamsız olacağından gizli kalır.
           const showClassColumn = classSections.length > 0;
           // tableRows: ana sınıf (perfRows, zengin analiz) + kardeş sınıfların temel satırları
           // birleşimi — hem burada (ilk render) hem de aşağıdaki wiring bloğunda (dönem/sınıf
           // değişince) kullanılabilsin diye üst kapsamda tutulur.
           let tableRows = [];
           const filterPerfRowsByClass = (classId, rows) => classId === 'all' ? rows : rows.filter(r => r.classId === classId);
           // Faz H iç-bölme: gövde module-seviye _ctPctColor'da (saf fonksiyon).
           const pctColor = _ctPctColor;
           // Küçük örneklem eşiği: 5'in altındaki ödev sayısında % değeri tek bir ödevle 20+ puan
           // oynayabilir (1/4 → 2/4 = %25 → %50). Bu durumda tabloda "az veri" işareti gösterilir —
           // hem "Destek Önerilir" kararının hem de öğretmenin gözle yaptığı yorumun yanıltıcı
           // kesinlik hissi vermesini önlemek için (bkz. buildPerfRows içindeki lowSample).
           const LOW_SAMPLE_MAX = _CT_LOW_SAMPLE_MAX;
           const periodLabel = _CT_PERIOD_LABEL;
           // Dönem filtresi ödevin VERİLDİĞİ tarihe göre kapsam belirler (created_at) — "son 7 günde
           // verilen ödevlerin ne kadarı tamamlandı" sorusuna cevap verir. Odak dakikası/aktif gün
           // sütunları statsRes RPC'sinden geldiği için her zaman "bu hafta" — bu iki farklı zaman
           // penceresi karışmasın diye sütun başlığında ayrıca belirtiliyor.
           // Faz Dev-Dosya-Bölme: gövde module-seviye _ctBuildPerfCounts'ta (açık parametreli).
           const buildPerfCounts = (period) => _ctBuildPerfCounts(period, assignments, studentMembers, stepDoneByAsg, subsByAsg);
           // Sıralanabilir sütun başlıkları: her başlığa tıklayınca o sütuna göre sıralar, tekrar
           // tıklayınca yönü (artan/azalan) çevirir — Excel/Sheets'teki sütun sıralaması gibi.
           // null/eksik değerler (ör. hiç ödevi olmayan öğrenci) her zaman sona atılır ki
           // "sıralanamayan" satırlar sıralamayı anlamsızlaştırmasın.
           // Faz Dev-Dosya-Bölme: gövde module-seviye _CT_PERF_SORT_KEYS/_ctSortPerfRows'da (saf).
           const PERF_SORT_KEYS = _CT_PERF_SORT_KEYS;
           const sortPerfRows = (key, dir, rows) => _ctSortPerfRows(key, dir, rows);
           // Faz H iç-bölme (2. tur): gövde module-seviye _ctRenderPerfRowsHtml'de
           // (paylaşılan state'e yazmayan, salt-okunur render — "açık context" tekniği:
           // showClassColumn/memberLabel/anomalyMeta/contextMeta/focusTrendLabels artık
           // parametre). Davranış birebir aynı.
           const renderPerfRowsHtml = (rows) => _ctRenderPerfRowsHtml(rows, showClassColumn, memberLabel, anomalyMeta, contextMeta, focusTrendLabels);
           // ── Sınıf Dağılımı (kutu grafiği) ──
           // Faz H iç-bölme (2. tur): gövde module-seviye _ctRenderPerfDistributionHtml'de
           // (salt-okunur render, LOW_SAMPLE_MAX/memberLabel artık parametre).
           const renderPerfDistributionHtml = (rows) => _ctRenderPerfDistributionHtml(rows, LOW_SAMPLE_MAX, memberLabel);
           // ── Trend (son 4 hafta) — tek anlık % değeri "düşüşte mi hep böyle mi" ayrımını
           // yapamaz; öğretmenin doğru müdahaleyi seçmesi tam olarak bu ayrıma bağlı (bkz.
           // Performans analizi). Ödevin VERİLDİĞİ haftaya göre bucketlanır, period filtresinden
           // bağımsızdır (trend her zaman son 4 haftayı gösterir).
           const TREND_WEEKS = _CT_TREND_WEEKS;
           const trendByUser = {};
           {
               const weekMs = 7 * 86400000;
               const now = Date.now();
               assignments.forEach(a => {
                   if (!a.created_at) return;
                   const ageWeeks = Math.floor((now - new Date(a.created_at).getTime()) / weekMs);
                   if (ageWeeks < 0 || ageWeeks >= TREND_WEEKS) return;
                   const bucketIdx = TREND_WEEKS - 1 - ageWeeks; // 0 = en eski, son index = bu hafta
                   const targetIds = (a.target_user_ids && a.target_user_ids.length) ? a.target_user_ids : studentMembers.map(m => m.userId);
                   const isMultiStep = !!(a.steps && a.steps.length);
                   targetIds.forEach(uid => {
                       const buckets = (trendByUser[uid] = trendByUser[uid] || Array.from({ length: TREND_WEEKS }, () => ({ assigned: 0, done: 0 })));
                       buckets[bucketIdx].assigned++;
                       const isDone = isMultiStep
                           ? !!(stepDoneByAsg[a.id]?.[uid] && a.steps.every(s => stepDoneByAsg[a.id][uid].has(s.id)))
                           : (subsByAsg[a.id] || []).includes(uid);
                       if (isDone) buckets[bucketIdx].done++;
                   });
               });
           }
           // Faz H iç-bölme: gövde artık module-seviye _ctSparkHtml'de (yalnızca kendi
           // parametresine bağlı saf fonksiyon), burada sadece davranış-birebir-aynı takma ad.
           const sparkHtml = _ctSparkHtml;
           // Trend yönü: 4 haftalık ödev tamamlama bucket'larındaki geçerli (assigned>0) ilk ve
           // son noktayı karşılaştırır. Anomali: ya odak süresinde önceki haftaya göre keskin düşüş
           // (>=30dk geçen hafta + bu hafta o sürenin %40'ının altına inme) ya da ödev tamamlamada
           // sürekli düşüş trendi. Amaç öğretmene "kim geride" ötesinde "kim yeni yeni geride kalıyor"
           // sinyalini vermek.
           // Küçük örneklem: 4 haftaya yayılan toplam ödev sayısı çok azsa (örn. 2 ödev), iki uç
           // haftayı karşılaştırıp "yükseliş/düşüş" demek istatistiksel olarak anlamsızdır (tek bir
           // ödevin sonucu %100 oynama yaratabilir). Toplam örneklem TREND_MIN_TOTAL altındaysa yön
           // hiç hesaplanmaz — "veri yok" ile "sabit" farklı şeylerdir, ikisini karıştırmamak için
           // sparkHtml zaten boş/az veriyi ayrı gösteriyor (eşik artık module-seviye
           // _CT_TREND_MIN_TOTAL — bu fonksiyonda ayrıca kullanılmıyor, _ctTrendDirection'ın içinde).
           // Regresyon eğimi: eski yöntem sadece İLK ve SON haftayı karşılaştırıyordu — aradaki
           // haftalar (sparkline'da zaten gösteriliyor) yön hesabına hiç girmiyordu. Bu, örneğin
           // "düşük→yüksek→düşük" gibi U-şeklinde bir seyri "sabit" olarak doğru okur ama
           // "yüksek→düşük→orta→yüksek" gibi ara haftalarda gürültülü tek bir kötü haftanın uç
           // noktalardan biri olması durumunda yanlış yöne işaret edebiliyordu. En küçük kareler
           // (least-squares) eğimi TÜM haftaları eşit ağırlıkla hesaba katar, tek bir uç haftanın
           // aşırı etkisini azaltır. Eğim (haftalık ortalama değişim) 4 haftalık pencereye
           // ölçeklenip eski eşiklerle (±0.15) karşılaştırılabilir hale getirilir.
           // Bilgi yoğunluğu azaltma: "flat" (sabit) yön artık HİÇ ikon basmıyor — bu en yaygın
           // durum olduğundan her satırda gereksiz bir ikon olarak birikip asıl önemli olan
           // up/down sinyallerini görsel gürültüye gömüyordu. Sadece gerçek bir yön değişimi
           // varken ikon gösterilir.
           // Faz H iç-bölme: gövde module-seviye _ctTrendArrowHtml'de (saf fonksiyon).
           const trendArrowHtml = _ctTrendArrowHtml;
           // Faz Dev-Dosya-Bölme: gövde module-seviye _CT_FOCUS_TREND_LABELS/_CT_ANOMALY_META'da (saf literal).
           const focusTrendLabels = _CT_FOCUS_TREND_LABELS;
           const anomalyMeta = _CT_ANOMALY_META;
           // ── Odak-Çıktı Uyumsuzluğu ──
           // Odak dakikası ve ödev tamamlama şu ana kadar birbirinden kopuk iki kolon olarak
           // gösteriliyordu. Ama asıl bilgi genelde ikisinin İLİŞKİSİNDE: çok odaklanıp az ödev
           // bitiren bir öğrenci muhtemelen yanlış şeye odaklanıyor / dikkat dağınıklığı yaşıyor
           // ya da ödevi anlamıyor (daha fazla "çalış" demek yardımcı olmaz) — bu "tembellik"
           // sinyalinden ayrı, öğretmenin farklı bir müdahale (yöntem/anlama desteği) seçmesi
           // gereken bir durum. Tersi yönde (az odaklanıp çok ödev bitiren) öğrenci ise ALARM
           // DEĞİL — muhtemelen uygulama dışında da çalışıyor; bu öğrenciye "neden az
           // odaklanıyorsun" demek yanlış olur, o yüzden anomali değil bilgilendirici bağlam notu.
           // Eşikler sınıfın kendi medyan odak süresine görecelidir (sabit "180dk=çok" gibi bir
           // varsayım yapılmaz — sınıflar arası kullanım alışkanlığı çok değişir).
           // (FOCUS_MISMATCH_* sabitleri artık sadece _ctBuildPerfRows içinde kullanılıyor.)
           // ── Z-skor bazlı odak anomali tespiti (109_group_weekly_focus_history) ──
           // Eski mantık sabit bir eşik kullanıyordu ("geçen hafta >=30dk VE bu hafta geçen
           // haftanın %40'ının altında") — bu, doğal olarak dalgalı çalışan bir öğrenci için
           // yanlış alarm üretebilir, istikrarlı ama düşük seviyede çalışan biri için ise gerçek
           // bir düşüşü kaçırabilirdi (bkz. performans analizi tartışması). Z-skor, her öğrencinin
           // KENDİ 8 haftalık ortalama+standart sapmasına göre "bu hafta ne kadar sıra dışı"
           // sorusunu cevaplar — aynı 40dk'lık düşüş, hep 200dk'da gezen biri için normal
           // gürültüyken hep 45dk'da gezen biri için ciddi bir sapma olabilir.
           // Yeterli geçmiş yoksa (migration henüz uygulanmadı / öğrenci yeni / std çok düşük)
           // sessizce null döner ve çağıran taraf eski sabit eşiğe geri düşer.
           const FOCUS_Z_MIN_BASELINE_WEEKS = _CT_FOCUS_Z_MIN_BASELINE_WEEKS;
           const FOCUS_Z_MIN_STD = _CT_FOCUS_Z_MIN_STD;
           const focusHistByUser = {};
           (focusHistRes?.data || []).forEach(r => {
               (focusHistByUser[r.student_id] = focusHistByUser[r.student_id] || []).push(r);
           });
           const focusZInfo = (userId, thisWeekMinutes) => {
               const hist = focusHistByUser[userId];
               if (!hist || thisWeekMinutes === null) return null;
               const sorted = hist.slice().sort((a, b) => a.week_start < b.week_start ? -1 : 1);
               const baseline = sorted.slice(0, -1).map(r => r.weekly_minutes || 0); // son kova = bu hafta, geri kalanı temel alınır
               if (baseline.length < FOCUS_Z_MIN_BASELINE_WEEKS) return null;
               const mean = baseline.reduce((a, b) => a + b, 0) / baseline.length;
               const variance = baseline.reduce((s, b) => s + (b - mean) ** 2, 0) / baseline.length;
               const std = Math.sqrt(variance);
               if (std < FOCUS_Z_MIN_STD) return null;
               return { z: (thisWeekMinutes - mean) / std, mean: Math.round(mean), std: Math.round(std), weeksUsed: baseline.length };
           };
           // Bağlam etiketleri: düşük % rakamının TEK bir nedene indirgenmesini önlemek için,
           // elde zaten olan veriden (ekstra sorgu yok) olası açıklayıcı bağlamı çıkarır. Amaç
           // rozeti "alarm"dan "buraya bak ama şu bağlamda bak"a çevirmek.
           // Faz Dev-Dosya-Bölme: gövde module-seviye _CT_CONTEXT_META'da (saf literal).
           const contextMeta = _CT_CONTEXT_META;
           // Faz Dev-Dosya-Bölme: gövde module-seviye _ctBuildPerfRows'ta (açık parametreli).
           const buildPerfRows = (period) => _ctBuildPerfRows(period, statsRes, studentMembers, assignments, stepDoneByAsg, subsByAsg, trendByUser, focusZInfo);
           if (isClassAdmin) {
               const initialSortKey = PERF_SORT_KEYS[el.dataset.perfSortKey] ? el.dataset.perfSortKey : 'name';
               const initialSortDir = el.dataset.perfSortDir === 'desc' ? 'desc' : 'asc';
               const initialPeriod = ['7d', '30d'].includes(el.dataset.perfPeriod) ? el.dataset.perfPeriod : 'all';
               const initialClass = el.dataset.perfClass || 'all';
               el.dataset.perfSortKey = initialSortKey;
               el.dataset.perfSortDir = initialSortDir;
               el.dataset.perfPeriod = initialPeriod;
               el.dataset.perfClass = initialClass;
               perfRows = buildPerfRows(initialPeriod);
               // Sınıf (group_class_sections) artık bu grubun İÇİNDEKİ bir etiket — öğrenci
               // henüz bir şubeye atanmamışsa "Sınıfsız" sayılır, ayrı bir grup sorgusu gerekmez
               // (tüm öğrenciler zaten aynı sorgudan, tam analizle geliyor).
               perfRows.forEach(r => { r.classId = r.classSectionId || '__unassigned__'; r.className = r.classSectionId ? (sectionNameById[r.classSectionId] || 'Sınıf') : 'Sınıfsız'; });
               const unassignedCount = perfRows.filter(r => !r.is_hidden && !r.classSectionId).length;
               tableRows = perfRows;
               const hiddenCount = filterPerfRowsByClass(initialClass, tableRows).filter(r => r.is_hidden).length;
               const periodBtn = (val, label) => `<button class="cp-perf-filter-btn${initialPeriod === val ? ' active' : ''}" data-perfperiod="${val}">${label}</button>`;
               // Sıralanabilir sütun başlığı: tıklayınca o anahtara göre sıralar, aynı sütuna
               // tekrar tıklayınca yönü çevirir. Aktif sütunda ok ikonu yönü gösterir.
               const sortHeadBtn = (key, label, title) => {
                   const active = initialSortKey === key;
                   const arrow = active ? (initialSortDir === 'desc' ? 'fa-arrow-down' : 'fa-arrow-up') : 'fa-sort';
                   return `<button type="button" class="cp-perf-sort-head${active ? ' active' : ''}" data-perfsortkey="${key}" title="${title || label}"><span class="cp-perf-sort-label">${label}</span><i class="fa-solid ${arrow} cp-perf-sort-arrow"></i></button>`;
               };

               // ── Zaman İçi Takip (classroom_perf_snapshots, 112) ──
               // Performans sisteminin en büyük eksiği anlık kesitten ibaret olmasıydı — bir
               // öğrenci destek listesine girdikten bir hafta sonra "düzeldi mi" sorusuna cevap
               // yoktu. Periyot filtresinden BAĞIMSIZ, hep 'all' periyoduyla hesaplanan durum
               // haftalık olarak upsert edilir (aynı hafta içinde tekrar açılması sadece o
               // haftanın satırını günceller, geçmiş bozulmaz). Karşılaştırma her zaman "bir
               // önceki kayıtlı hafta" ile yapılır (öğretmen ara haftayı hiç açmamışsa bir
               // önceki AÇILAN haftaya kıyaslanır, boşluk atlanır).
               const snapshotWeekStart = window._trWeekStart();
               const snapshotSourceRows = initialPeriod === 'all' ? perfRows : buildPerfRows('all');
               (async () => {
                   const upsertRows = snapshotSourceRows
                       .filter(r => !r.isNewMember)
                       .map(r => ({
                           group_id: data._supaId, user_id: r.user_id, week_start: snapshotWeekStart,
                           pct: r.pct, assigned: r.assigned, support_flag: !!r.supportFlag, anomaly: r.anomaly || null
                       }));
                   if (upsertRows.length) {
                       await window.FocusSupabase.from('classroom_perf_snapshots')
                           .upsert(upsertRows, { onConflict: 'group_id,user_id,week_start' });
                   }
               })().catch(() => {}); // best-effort, arayüzü bloklamaz/hata göstermez

               let perfDeltaHtml = '';
               try {
                   const { data: prevSnaps } = await window.FocusSupabase.from('classroom_perf_snapshots')
                       .select('user_id, pct, support_flag, week_start')
                       .eq('group_id', data._supaId)
                       .lt('week_start', snapshotWeekStart)
                       .order('week_start', { ascending: false })
                       .limit(memberCount * 6);
                   const prevByUser = {};
                   (prevSnaps || []).forEach(s => { if (!prevByUser[s.user_id]) prevByUser[s.user_id] = s; }); // en yeni önce geldiği için ilk görülen = en güncel
                   const comparable = snapshotSourceRows.filter(r => !r.isNewMember && prevByUser[r.user_id] && r.pct !== null && prevByUser[r.user_id].pct !== null);
                   if (comparable.length >= 2) {
                       const improved = comparable.filter(r => prevByUser[r.user_id].support_flag && !r.supportFlag).length;
                       const worsened = comparable.filter(r => !prevByUser[r.user_id].support_flag && r.supportFlag).length;
                       const avgDelta = Math.round(comparable.reduce((s, r) => s + (r.pct - prevByUser[r.user_id].pct), 0) / comparable.length);
                       const prevWeekLabel = prevByUser[comparable[0].user_id].week_start;
                       perfDeltaHtml = `
                       <div class="cp-perf-delta-card">
                           <i class="fa-solid fa-chart-line u-color-h74b9ff-2" ></i>
                           <span>Geçen kayıtlı haftaya göre (${new Date(prevWeekLabel).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}):</span>
                           ${improved ? `<span class="cp-perf-delta-pill cp-perf-delta-pill--up"><i class="fa-solid fa-arrow-trend-up"></i> ${improved} ${memberLabel.toLowerCase()} destek listesinden çıktı</span>` : ''}
                           ${worsened ? `<span class="cp-perf-delta-pill cp-perf-delta-pill--down"><i class="fa-solid fa-arrow-trend-down"></i> ${worsened} ${memberLabel.toLowerCase()} yeni eklendi</span>` : ''}
                           <span class="cp-perf-delta-pill">Ortalama tamamlama: ${avgDelta >= 0 ? '+' : ''}${avgDelta}pp</span>
                       </div>`;
                   }
               } catch (e) { /* best-effort — geçmiş kıyaslaması olmadan da panel tam işlevli kalır */ }

               const asgAnalysisHtml = buildAssignmentAnalysisHtml(assignments, studentMembers, stepDoneByAsg, subsByAsg, pctColor, LOW_SAMPLE_MAX, memberLabel, asgLabel);

               perfHtml = `
                   <div class="cp-perf-toprow">
                       <div class="cp-popover cp-perf-help-popover">
                           <button type="button" class="cp-perf-help-toggle"><i class="fa-solid fa-circle-info"></i> Bu bölüm nasıl okunur?</button>
                           <div class="cp-perf-help-panel cp-popover-panel" hidden>
                               <button type="button" class="cp-popover-close" aria-label="Kapat"><i class="fa-solid fa-xmark"></i></button>
                               <p><b>Destek Önerilir</b>Sınıf ortalamasının belirgin altında tamamlama (en az 3 ödevlik geçmiş gerekir).</p>
                               <p><b>Ani Düşüş</b>Öğrencinin kendi geçmişine göre olağandışı odak düşüşü.</p>
                               <p><b>Efor Karşılıksız</b>Yüksek odak süresi, düşük tamamlama — yöntem sorunu işareti olabilir.</p>
                               <p><b>Az Sürede Verimli</b>Düşük odakla yüksek tamamlama; bu bir alarm değildir.</p>
                               <p><b>"az veri" Rozeti</b>Az ödevden hesaplanan yüzdeye değil, yanındaki ham sayıya (ör. 2/3) bakın.</p>
                               <p><b>Sınıf Dağılımı</b>Kutu: orta %50, çizgi: medyan, kesikli çizgi: ortalama.</p>
                               <p><b>Haftalık Kıyas</b>Her açılışta o haftanın kesiti kaydedilip bir öncekiyle karşılaştırılır.</p>
                           </div>
                       </div>
                       ${tableRows.length ? `
                       <div class="cp-popover cp-perf-filter-popover">
                           <button type="button" class="cp-perf-filter-toggle">
                               <i class="fa-solid fa-sliders"></i> Filtrele <i class="fa-solid fa-chevron-down cp-perf-filter-toggle-caret"></i>
                           </button>
                           <div class="cp-perf-filter-panel cp-popover-panel" hidden>
                               <button type="button" class="cp-popover-close" aria-label="Kapat"><i class="fa-solid fa-xmark"></i></button>
                               <div class="cp-perf-filter-panel-label">Dönem</div>
                               <div class="cp-perf-filter-group">
                                   ${periodBtn('7d', '7 Gün')}${periodBtn('30d', '30 Gün')}${periodBtn('all', 'Tümü')}
                               </div>
                               ${showClassColumn ? `
                               <div class="cp-perf-filter-panel-label">Sınıf</div>
                               <div class="cp-perf-filter-group cp-perf-filter-group--wrap">
                                   <button class="cp-perf-filter-btn${initialClass === 'all' ? ' active' : ''}" data-perfclass="all">Tümü</button>
                                   ${classSections.map(c => `<button class="cp-perf-filter-btn${initialClass === c.id ? ' active' : ''}" data-perfclass="${c.id}">${window._escapeHtml(c.name)}</button>`).join('')}
                                   ${unassignedCount ? `<button class="cp-perf-filter-btn${initialClass === '__unassigned__' ? ' active' : ''}" data-perfclass="__unassigned__">Sınıfsız</button>` : ''}
                               </div>` : ''}
                           </div>
                       </div>` : ''}
                   </div>
                   ${tableRows.length ? `
                   ${perfDeltaHtml}
                   <div id="cp-perf-dist-wrap">${renderPerfDistributionHtml(perfRows)}</div>
                   ${(showClassColumn && unassignedCount) ? `<p class="cp-hint u-margin-4px012px" ><i class="fa-solid fa-triangle-exclamation u-color-hfeca57" ></i> ${unassignedCount} ${memberLabel.toLowerCase()} henüz bir şubeye atanmamış — "Sınıflar/${memberLabel}ler" sekmesinden bir şubeye atayabilirsin.</p>` : ''}
                   <div class="cp-table cp-table--admin">
                       <div class="cp-perf-table-meta${(initialPeriod === 'all' && (!showClassColumn || initialClass === 'all')) ? ' cp-perf-table-meta--hidden' : ''}" id="cp-perf-table-meta">
                           <i class="fa-solid fa-filter"></i> <small id="cp-perf-period-label">${periodLabel[initialPeriod]}</small>${showClassColumn ? `<small id="cp-perf-class-label"> · ${initialClass === 'all' ? 'tüm sınıflar' : (initialClass === '__unassigned__' ? 'sınıfsız' : window._escapeHtml(sectionNameById[initialClass] || ''))}</small>` : ''}
                       </div>
                       <div class="cp-row cp-row--head cp-row--admin${showClassColumn ? ' cp-row--withclass' : ''}">
                           <span>#</span>${sortHeadBtn('name', memberLabel)}${showClassColumn ? sortHeadBtn('className', 'Sınıf') : ''}${sortHeadBtn('pct', 'Ödev', 'Ödev Tamamlama')}<span class="cp-perf-trend-cell" title="Son 4 haftanın ödev tamamlama eğimi (bugünden geriye yuvarlanan pencere)">Trend <small>(4h)</small></span>${sortHeadBtn('weekly_minutes', 'Odak', 'Odak (bu hafta) — bu takvim haftası (Pazartesi-Pazar, TR saati)')}${sortHeadBtn('active_days', 'Aktif', 'Aktif Gün')}<span></span>
                       </div>
                       <div id="cp-perf-rows">${renderPerfRowsHtml(sortPerfRows(initialSortKey, initialSortDir, filterPerfRowsByClass(initialClass, tableRows)))}</div>
                   </div>
                   ${hiddenCount ? `<p class="cp-hint">${hiddenCount} ${memberLabel.toLowerCase()} istatistiklerini gizledi.</p>` : ''}`
                   : `<p class="cp-hint">Henüz ${memberLabel.toLowerCase()} yok. Üstteki <b>"Davet Et"</b> butonuyla ilk ${memberLabel.toLowerCase()}ini davet ettiğinde ödev takibi burada oluşmaya başlayacak.</p>`}

                   ${asgAnalysisHtml}

                   ${_renderCategoryBreakdownHtml(catRes?.data || [])}`;
           }
           return { perfHtml, perfRows, tableRows, sortPerfRows, filterPerfRowsByClass, renderPerfRowsHtml, renderPerfDistributionHtml, showClassColumn, buildPerfRows, periodLabel };
       }

       // Faz K/dev-dosya-refactoru: renderClassroomTab'ın "Hızlı Ödev" (quickAsgHtml/asgCard) bölümü
       // buraya çıkarıldı — olay dinleyicisi yok (event binding'ler renderClassroomTab'ın sonunda
       // querySelector ile bağlanıyor), sadece veri işleyip HTML üretiyor. `targetMembers` closure'ı
       // tail'deki "hatırlat" butonunun event handler'ında da kullanıldığı için ayrıca döndürülüyor.
       export async function buildAssignmentCardsSectionData(el, data, isClassAdmin, isWork, studentMembers, memberCount, memberLabel, asgLabel, assignments, templates, allInstitutionClasses, subsByAsg, stepDoneByAsg, subNotes, subGrades, mySubs, myGrades, mySubmittedAt, mySubAttachment) {
           const fmtDue = (d) => d ? new Date(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' }) : null;
           const targetCount = (a) => (a.target_user_ids && a.target_user_ids.length) ? a.target_user_ids.length : memberCount;
           const targetMembers = (a) => studentMembers.filter(m => (!a.target_user_ids || a.target_user_ids.includes(m.userId)));
           // Sınıf geneli tamamlanma oranı — admin'in "Ödev Bazlı Analiz"ında (resolvedAsgRows)
           // zaten hesaplanan mantığın aynısı, ama burada isClassAdmin bloğunun DIŞINDA (herkese
           // açık) tanımlanıyor ki öğrenci tarafında da kullanılabilsin. Amaç: düşük bir puan/
           // tamamlama gören öğrenciye "bu ödev herkese zor geldi, yalnız değilsin" bağlamını
           // isim/sıra vermeden (anonim, agrega) verebilmek — atıf hatasını ("ben yetersizim")
           // azaltmak için.
           const asgCompletion = (a) => {
               const targetIds = (a.target_user_ids && a.target_user_ids.length) ? a.target_user_ids : studentMembers.map(m => m.userId);
               const isMultiStep = !!(a.steps && a.steps.length);
               const doneCount = isMultiStep
                   ? targetIds.filter(uid => { const set = stepDoneByAsg[a.id]?.[uid]; return set && a.steps.every(s => set.has(s.id)); }).length
                   : targetIds.filter(uid => (subsByAsg[a.id] || []).includes(uid)).length;
               const pct = targetIds.length ? Math.round((doneCount / targetIds.length) * 100) : 0;
               return { targetCount: targetIds.length, doneCount, pct };
           };
           const priorityBadge = (p) => {
               if (p === 'urgent') return '<span class="cp-asg-priority cp-asg-priority--urgent"><i class="fa-solid fa-fire"></i> Acil</span>';
               if (p === 'important') return '<span class="cp-asg-priority cp-asg-priority--important"><i class="fa-solid fa-star"></i> Önemli</span>';
               return '';
           };
           // Ek dosya linkleri (chat-files bucket'ında saklanır). İmzalı URL'nin kendisi 7 gün
           // geçerli ama önceden panel her açıldığında sıfırdan üretiliyordu — artık bucket_path
           // başına module-seviye bir cache'te (6 gün TTL, gerçek 7 günlük geçerlilikten kısa
           // tutulur ki süresi dolmadan yenilensin) tutuluyor, aynı ek tekrar tekrar Storage API'ye
           // sorulmuyor.
           const attachAsgIds = assignments.filter(a => a.attachment?.bucket_path).map(a => a.id);
           const attachUrlById = {};
           if (attachAsgIds.length) {
               await Promise.all(assignments.filter(a => a.attachment?.bucket_path).map(async a => {
                   const url = await _getSignedUrlCached(a.attachment.bucket_path);
                   if (url) attachUrlById[a.id] = url;
               }));
           }
           // Öğrencinin kendi teslim ekinin linki
           const mySubAttachUrlById = {};
           const mySubAttachIds = Object.keys(mySubAttachment);
           if (mySubAttachIds.length) {
               await Promise.all(mySubAttachIds.map(async asgId => {
                   const url = await _getSignedUrlCached(mySubAttachment[asgId].bucket_path);
                   if (url) mySubAttachUrlById[asgId] = url;
               }));
           }
           // Faz Dev-Dosya-Bölme: gövde module-seviye _ctAsgCardHtml'de (ctx-paketli).
           const _asgCardCtx = { isClassAdmin, memberLabel, asgLabel, targetCount, targetMembers, asgCompletion, priorityBadge, fmtDue,
               attachUrlById, mySubAttachUrlById, mySubs, mySubmittedAt, mySubAttachment, subsByAsg, stepDoneByAsg,
               myGrades, subNotes, subGrades };
           const asgCard = (a) => _ctAsgCardHtml(a, _asgCardCtx);
           // Öğrenci sadece kendine atanmış (veya tüm sınıfa açık) ödevleri görür
           const visibleAssignments = isClassAdmin
               ? assignments
               : assignments.filter(a => !a.target_user_ids || a.target_user_ids.includes(getCurrentUser().id));
           const open = visibleAssignments.filter(a => a.status !== 'closed')
               .sort((a, b) => {
                   if (!a.due_date && !b.due_date) return 0;
                   if (!a.due_date) return 1;
                   if (!b.due_date) return -1;
                   return new Date(a.due_date) - new Date(b.due_date);
               });
           const closedList = visibleAssignments.filter(a => a.status === 'closed').slice(0, 5);
           const studentOptions = isClassAdmin ? studentMembers : [];
           const _todayD = new Date();
           const todayInputDate = `${_todayD.getFullYear()}-${String(_todayD.getMonth() + 1).padStart(2, '0')}-${String(_todayD.getDate()).padStart(2, '0')}`;
           // Ders Planı (planning.js — Planlama modülü) takip bölümü: öğretmen "Öğrencilere Ata"
           // dediğinde atanan planlar burada da izlenebilsin diye. Öğretmen tarafı: bu sınıftaki
           // tüm atamaların durumu (bekliyor/kabul/revize/red) + revize-sonrası tekrar gönder.
           // Öğrenci tarafı: bekleyen davetleri buradan da inceleyip kabul/revize/red edebilir —
           // bildirime basmak zorunda değil. planning.js yüklüyse (her zaman yüklü) window
           // üzerinden render fonksiyonları çağrılır; aşağıdaki konteynerler post-render doldurulur.
           // "Yeni Ders Planı Oluştur" butonu artık renderGroupLessonPlanStatus (planning.js)
           // tarafından, Aktif/Revize/Reddedilenler sekme çubuğuyla aynı satırda render
           // ediliyor — bkz. planning.js pg-lpa-tabs-row.
           const lessonPlanTrackerHtml = (!isWork) ? `
               <div class="cp-lpa-tracker">
                   <div id="cp-lpa-tracker-body"${isClassAdmin ? ` data-lpa-group-id="${data._supaId}"` : ''}>
                       <div class="pg-cw-loading"><span class="pg-cw-pulse-dot"></span> Yükleniyor…</div>
                   </div>
               </div>` : '';

           const quickAsgHtml = `
               ${isWork ? `<h3 class="cp-section-title u-margin-top-0" ><i class="fa-solid fa-clipboard-list u-color-hfeca57" ></i> ${asgLabel}</h3>` : ''}
               ${isClassAdmin ? `
               <!-- Minimalist hızlı ödev çubuğu: başlık + teslim tarihi + ekle, tek satır.
                    Herkese atama varsayılan (en sık kullanılan durum) — kişi seçmek isteyen
                    "Kime atanacak?" alanını genişletir. İkincil alanlar (açıklama, şablon,
                    öncelik, dosya) "Detaylar"ın arkasında, gerektiğinde açılır. -->
               <div class="cp-asg-create cp-asg-create--mini">
                   <div class="u-display-flex_align-items-center_justify-content-space-betw-19">
                       <span class="cp-section-subtitle">Hızlı Ödev Ekle</span>
                       <button type="button" id="cp-asg-toggle-add" class="cp-roster-pillbtn cp-roster-pillbtn--accent" title="Ödev Ekle"><i class="fa-solid fa-plus"></i> Ekle</button>
                   </div>
                   <div id="cp-asg-add-form" class="is-hidden">
                   <div class="cp-asg-create-row cp-asg-create-row--main">
                       <input id="cp-asg-title" class="cp-asg-title-input" placeholder="${isWork ? 'Yeni görevlendirme…' : 'Yeni ödev… (örn: Sayfa 40-45 soruları)'}" maxlength="120">
                       <div class="cp-asg-due-wrap">
                           <span class="cp-asg-due-label">Son teslim tarihi</span>
                           <input id="cp-asg-due" class="cp-asg-pill-input cp-asg-due-mini" type="date" title="Son teslim tarihi" value="${todayInputDate}">
                       </div>
                       <button id="cp-asg-add" class="cp-asg-submit-btn" title="Ekle" aria-label="Ekle"><i class="fa-solid fa-plus"></i></button>
                   </div>
                   <div class="cp-asg-char-hint" id="cp-asg-title-count">0/120</div>

                   ${(!isWork && allInstitutionClasses.length > 1) ? `
                   <div class="cp-asg-class-picker">
                       <span class="cp-asg-due-label">Hangi sınıfa?</span>
                       <select id="cp-asg-class-pick" class="cp-asg-pill-input">
                           ${allInstitutionClasses.map(c => `<option value="${c.id}"${c.id === data._supaId ? ' selected' : ''}>${window._escapeHtml(c.name)}${c.id === data._supaId ? ' (bu sınıf)' : ''}</option>`).join('')}
                       </select>
                   </div>` : ''}

                   <details class="cp-asg-target-picker">
                       <summary><i class="fa-solid fa-users"></i> Kime atanacak? <span id="cp-asg-target-summary">Tüm sınıf</span></summary>
                       <div class="cp-asg-target-body">
                           <label class="cp-asg-target-row cp-asg-target-all">
                               <input type="checkbox" id="cp-asg-target-allbox" checked>
                               <span>Tüm ${memberLabel.toLowerCase()}ler</span>
                           </label>
                           <div id="cp-asg-target-students" class="cp-asg-target-students hidden">
                               ${studentOptions.map(s => `
                               <label class="cp-asg-target-row">
                                   <input type="checkbox" class="cp-asg-target-student" value="${s.userId}">
                                   <span>${window._escapeHtml(s.displayName)}</span>
                               </label>`).join('') || '<p class="cp-hint">Sınıfta henüz öğrenci yok.</p>'}
                           </div>
                       </div>
                   </details>

                   <details class="cp-asg-details-toggle">
                       <summary><i class="fa-solid fa-sliders"></i> Detaylar <small>açıklama, öncelik, dosya…</small></summary>
                       <textarea id="cp-asg-desc" class="cp-asg-pill-input cp-asg-desc-input" placeholder="Açıklama (opsiyonel) — detaylar, kaynaklar, yönergeler…" maxlength="500" rows="1"></textarea>
                       <div class="cp-asg-char-hint" id="cp-asg-desc-count">0/500</div>
                       <div class="cp-asg-create-opts">
                           ${templates.length ? `
                           <select id="cp-asg-template-pick" class="cp-asg-pill-input">
                               <option value="">Şablondan doldur…</option>
                               ${templates.map(t => `<option value="${t.id}">${window._escapeHtml(t.title)}</option>`).join('')}
                           </select>
                           <button id="cp-asg-template-del" class="cp-asg-pill-icon-btn u-display-none" title="Seçili şablonu sil" aria-label="Seçili şablonu sil"><i class="fa-solid fa-trash-can"></i></button>` : ''}
                           <select id="cp-asg-priority" class="cp-asg-pill-input">
                               <option value="normal">Öncelik: Normal</option>
                               <option value="important">Öncelik: Önemli</option>
                               <option value="urgent">Öncelik: Acil</option>
                           </select>
                           <label class="cp-asg-file-label">
                               <input type="file" id="cp-asg-file" class="u-display-none">
                               <span id="cp-asg-file-name"><i class="fa-solid fa-paperclip"></i> Dosya ekle</span>
                           </label>
                       </div>
                   </details>
                   </div>
               </div>` : ''}
               ${open.length
                   ? `<div class="cp-asg-list">${open.map(asgCard).join('')}</div>`
                   : `<p class="cp-hint">${isClassAdmin ? 'Henüz aktif ödev yok — yukarıdan ilkini ekle.' : 'Şu an aktif ödev yok. 🎉'}</p>`}
               ${closedList.length ? `
               <button type="button" class="cp-asg-history-toggle" data-cpasghist-toggle>
                   <i class="fa-solid fa-clock-rotate-left"></i>
                   <span class="cp-asg-history-toggle-label">Geçmiş ödevleri göster</span> <span class="pg-lpa-tab-count">${closedList.length}</span>
                   <i class="fa-solid fa-chevron-down cp-asg-history-toggle-chev"></i>
               </button>
               <div class="cp-asg-list hidden" data-cpasghist-panel>${closedList.map(asgCard).join('')}</div>` : ''}`;

           // "Hızlı Ödev" (classroom_assignments/basit+çok adımlı) ile "Ders Planları"
           // (planning.js/lesson_plan_assignments — Planlama modülünden atanan kişiye özel
           // planlar) iki ayrı veri modeli/akış. ÖĞRETMEN için farklı oluşturma/yönetim
           // araçları gerektirdiğinden ayrı bir iç-sekmede kalıyor. ÖĞRENCİ için ise bu ayrım
           // anlamsız bir tıklama engeliydi — öğrenci sadece "bana ne atandı" görmek istiyor;
           // kart görünümleri zaten farklı olduğundan (ödev vs ders planı) hangisinin ne
           // olduğunu ayırt etmek için sekmeye gerek yok. Öğrenci için tek, kesintisiz liste.
           // Bildirimden gelen bir tıklama (ör. ders planı kabul/revize/red), öğretmen tarafında
           // doğrudan "Ders Planları" iç sekmesine düşsün diye — bkz. window.dcOpenAssignmentTab.
           const _initialAsgInner = window._pendingAsgInnerTab === 'planlar' ? 'planlar' : 'hizli';
           window._pendingAsgInnerTab = null;
           // Öğrenci için "Tümü/Ödevler/Ders Planları" filtresi — liste sekmesiz tek akış olduğundan
           // (bkz. üstteki not), öğrencinin sadece birini görmek istediği anlarda (ör. sadece o
           // haftaki ödevlere bakmak) hızlı bir daraltma imkanı sağlar. Filtre görünürlüğü CSS
           // display ile yönetilir, veri yeniden çekilmez.
           const _initialListFilter = 'all';
           const studentListFilterHtml = `
               <div class="cp-inner-tabs u-margin-bottom-14px" >
                   <button class="cp-list-filter-btn${_initialListFilter === 'all' ? ' active' : ''}" data-cplistfilter="all">Tümü</button>
                   <button class="cp-list-filter-btn${_initialListFilter === 'odev' ? ' active' : ''}" data-cplistfilter="odev"><i class="fa-solid fa-clipboard-list"></i> Ödevler</button>
                   <button class="cp-list-filter-btn${_initialListFilter === 'plan' ? ' active' : ''}" data-cplistfilter="plan"><i class="fa-solid fa-chalkboard-user"></i> Ders Planları</button>
               </div>`;
           const asgHtml = isWork
               ? quickAsgHtml
               : isClassAdmin ? `
               <div class="cp-inner-tabs u-margin-bottom-14px" >
                   <button class="cp-asg-innertab-btn${_initialAsgInner === 'hizli' ? ' active' : ''}" data-cpasgsub="hizli"><i class="fa-solid fa-clipboard-list"></i> Hızlı Ödev</button>
                   <button class="cp-asg-innertab-btn${_initialAsgInner === 'planlar' ? ' active' : ''}" data-cpasgsub="planlar"><i class="fa-solid fa-chalkboard-user"></i> Ders Planları</button>
               </div>
               <div class="cp-asg-innertab-panel${_initialAsgInner === 'hizli' ? ' active' : ' hidden'}" data-cpasgpanel="hizli">${quickAsgHtml}</div>
               <div class="cp-asg-innertab-panel${_initialAsgInner === 'planlar' ? ' active' : ' hidden'}" data-cpasgpanel="planlar">${lessonPlanTrackerHtml}</div>`
               : `${studentListFilterHtml}
               <div data-cplist-type="odev">${quickAsgHtml}</div>
               <div data-cplist-type="plan" class="u-margin-top-18px-2">${lessonPlanTrackerHtml}</div>`;

           return { asgHtml, targetMembers };
       }
