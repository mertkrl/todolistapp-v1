// ============================================================
// FOCUSAI SCRIPT-GOAL-DETAILS-SECTIONS.JS
// script.js'ten çıkarılmış: Hedef Detay panelinin 4 alt-bölüm render
// fonksiyonu (Aksiyon Planı / Destekleyici Alışkanlıklar / Milestones /
// İstatistikler-Kutlama). window.updateGoalDetailsUI bunları sırayla çağırır.
// script.js'in window'a koyduğu ince sarmalayıcıları (__getTasksRef,
// __getHabitsRef, __getGoalsRef, escapeHtml, FocusStorage, updateGoalDetailsUI,
// showPremiumModal) kullanır.
// ============================================================
import { getTasksRef, getHabitsRef, getGoalsRef, updateGoalDetailsUI, showPremiumModal } from './script.js';
import { formatDateToString } from './script-date-time-utils.js';
import { FocusStorage, escapeHtml } from './storage-manager.js';

(function () {
'use strict';

// Hedef detay panelinin "Aksiyon Planı" (bağlı görevler) bölümü — kendi
// milestone-grup gövdesini render eder, çağırana { linkedTasks, completedTaskCount }
// döner (İstatistikler bölümü toplam ilerleme hesabında bunları kullanıyor).
function _gdRenderActionPlanSection(goalId, goal) {
    const tasks = getTasksRef();
    const detailTaskList = document.getElementById('detail-task-list');
    // detail-task-list, hedef detay modalının içinde — modal DOM'dan hiç
    // kaldırılmaz ama bu fonksiyon çağrı zincirinin bulunmadığı bir görev/
    // görev-silme setTimeout'undan (ör. deleteGlobalTask sonrası 50ms'lik
    // gecikmeli çağrı) tetiklendiğinde savunmasız null erişimi önlemek için
    // koruma ekleniyor.
    if (!detailTaskList) return null;
    detailTaskList.innerHTML = '';
    const linkedTasks = tasks.filter(t => String(t.parentGoal) === String(goalId));

    // Günün hedefini de dahil et (highlight_history, tarih=bugün, parentGoal=bu hedef)
    const _todayStrAP = window.formatDateToString(new Date());
    const _hlHistory = FocusStorage.get('highlight_history', {});
    const _todayHL = _hlHistory[_todayStrAP];
    if (_todayHL && _todayHL.parentGoal && String(_todayHL.parentGoal) === String(goalId)) {
        // Sahte görev objesi — zaten tasks'ta yoksa ekle
        const alreadyIn = linkedTasks.some(t => t._isHighlight);
        if (!alreadyIn) {
            // parentMilestone hesapla
            let _hlMs = '';
            if (goal && Array.isArray(goal.milestones)) {
                const _norm = (d) => { if(!d) return ''; const p=d.split('-'); return p.length===3&&p[0].length!==4?(p[2]+'-'+p[1]+'-'+p[0]):d; };
                const _dn = _norm(_todayStrAP);
                const _m = goal.milestones.find(ms => { const s=_norm(ms.startDate||'');const e=_norm(ms.date||''); return s&&e?_dn>=s&&_dn<=e:(e?_dn<=e:false); });
                if (_m) _hlMs = _m.id;
            }
            linkedTasks.push({ id: '__highlight__', text: _todayHL.text, completed: _todayHL.completed, priority: 'high', date: _todayStrAP, timeStart: null, timeEnd: null, parentGoal: goalId, parentMilestone: _hlMs, _isHighlight: true });
        }
    }

    let completedTaskCount = 0;

    const apCompleted = document.getElementById('ap-completed-count');
    const apPending = document.getElementById('ap-pending-count');

    completedTaskCount = linkedTasks.filter(t => t.completed).length;
    if(apCompleted) apCompleted.textContent = completedTaskCount;
    if(apPending) apPending.textContent = linkedTasks.length - completedTaskCount;

    const milestones = (goal && goal.milestones) ? goal.milestones : [];

    // Milestone gruplarını tarihe göre sırala
    const sortedMs = [...milestones].sort((a, b) => {
        const da = a.startDate || a.date || '';
        const db = b.startDate || b.date || '';
        return da.localeCompare(db);
    });

    // Her milestone için tarih aralığı hesapla
    // startDate yoksa bir önceki milestone'un bitişini başlangıç say
    const msRanges = sortedMs.map((ms, i) => {
        const endDate = ms.date || '';
        let startDate = ms.startDate || '';
        if (!startDate && i > 0) {
            startDate = sortedMs[i - 1].date || '';
        }
        return { ms, startDate, endDate };
    });

    // Görevleri tarih aralıklarına göre grupla
    const assignedIds = new Set();
    const groups = [];

    // Tarihi YYYY-MM-DD'ye normalize et (app DD-MM-YYYY, milestone YYYY-MM-DD saklar)
    const _normApDate = (d) => { if(!d) return ''; const p=d.split('-'); return p.length===3 && p[0].length!==4 ? (p[2]+'-'+p[1]+'-'+p[0]) : d; };

    msRanges.forEach(({ ms, startDate, endDate }) => {
        const msTasks = linkedTasks.filter(t => {
            // Önce parentMilestone'a göre kontrol et (explicit bağlantı)
            if (t.parentMilestone && String(t.parentMilestone) === String(ms.id)) return true;
            // parentMilestone yoksa tarih aralığına göre grupla
            if (t.parentMilestone) return false; // Başka milestone'a bağlıysa dahil etme
            if (!t.date) return false;
            const tdn = _normApDate(t.date);
            const sdn = _normApDate(startDate);
            const edn = _normApDate(endDate);
            if (edn && sdn) return tdn >= sdn && tdn <= edn;
            if (edn && !sdn) return tdn <= edn;
            return false;
        });
        msTasks.forEach(t => assignedIds.add(t.id));
        // Milestone grubu HER ZAMAN göster (görev olmasa bile)
        groups.push({ type: 'milestone', ms, tasks: msTasks });
    });

    const unassigned = linkedTasks.filter(t => !assignedIds.has(t.id));
    if (unassigned.length > 0) groups.push({ type: 'general', ms: null, tasks: unassigned });

    if(linkedTasks.length === 0 && groups.filter(g => g.type === 'milestone').length === 0) {
        detailTaskList.innerHTML = '<li class="empty-list-note">Henüz bu hedefe bağlı bir aksiyon (görev) yok. Yukarıdan hızlıca ekleyebilirsin.</li>';
    } else {

        const renderTaskCard = (t) => {
            const priorityLabels = { 'high': 'Yüksek', 'medium': 'Orta', 'low': 'Düşük' };
            const pLabel = priorityLabels[t.priority] || 'Orta';
            const pClass = t.priority || 'medium';
            const li = document.createElement('li');
            li.className = `detail-task-item ${t.completed ? 'completed' : ''}`;
            if (t._isHighlight) {
                // Günün hedefi — özel görünüm, saat olmadan
                li.style.borderLeft = '3px solid #ff9f43';
                li.style.background = 'linear-gradient(90deg, rgba(255,159,67,0.04) 0%, transparent 100%)';
               li.innerHTML = `
                   <div class="ap-priority-bar u-background-hff9f43" ></div>
                   <div class="task-checkbox gd-task-checkbox u-border-radius-8px_width-22px_height-22px_flex-shrink-0_bor" data-action="gd-toggle-highlight-task" data-date="${_todayStrAP}" data-goal-id="${goalId}">
                       ${t.completed ? '<i class="fa-solid fa-check u-font-size-11px_color-white" ></i>' : ''}
                   </div>
                   <div class="u-display-flex_flex-direction-column_gap-4px_flex-1_min-widt">
                       <span class="gd-task-title u-font-size-14px_white-space-nowrap_overflow-hidden_text-ove" >${escapeHtml(t.text)}</span>
                       <div class="u-display-flex_gap-6px_align-items-center_flex-wrap-wrap">
                           <span class="u-font-size-10px_background-rgba255159670p12_padding-2px8px_"><i class="fa-solid fa-star u-margin-right-3px" ></i>Günün Hedefi</span>
                           <span class="u-font-size-10px_background-rgba2552552550p05_padding-2px8px"><i class="fa-regular fa-calendar"></i> ${t.date}</span>
                       </div>
                   </div>
               `;
               { const _cb = li.querySelector('.gd-task-checkbox'); if (_cb && t.completed) _cb.style.background = '#ff9f43'; }
               { const _ti = li.querySelector('.gd-task-title'); if (_ti) { if (t.completed) { _ti.style.textDecoration = 'line-through'; _ti.style.color = 'var(--text-muted)'; } else { _ti.style.color = '#fff'; _ti.style.fontWeight = '500'; } } }
            } else {
               li.innerHTML = `
                   <div class="ap-priority-bar ${pClass}"></div>
                   <div class="task-checkbox gd-task-checkbox u-border-radius-8px_width-22px_height-22px_flex-shrink-0" data-action="gd-toggle-task" data-id="${t.id}" data-goal-id="${goalId}">
                       ${t.completed ? '<i class="fa-solid fa-check u-font-size-11px_color-white" ></i>' : ''}
                   </div>
                   <div class="u-display-flex_flex-direction-column_gap-4px_flex-1_min-widt">
                       <span class="gd-task-title u-font-size-14px_white-space-nowrap_overflow-hidden_text-ove" >${escapeHtml(t.text)}</span>
                       <div class="u-display-flex_gap-6px_align-items-center_flex-wrap-wrap">
                           <span class="u-font-size-10px_background-rgba2552552550p05_padding-2px8px"><i class="fa-regular fa-clock"></i> ${t.timeStart || '09:00'}</span>
                           <span class="gd-task-prio u-font-size-10px_padding-2px8px_border-radius-6px_font-weigh" >${pLabel}</span>
                           ${t.date ? `<span class="u-font-size-10px_background-rgba2552552550p05_padding-2px8px"><i class="fa-regular fa-calendar"></i> ${t.date}</span>` : ''}
                       </div>
                   </div>
                   <button class="ap-delete-btn" data-action="gd-delete-task" data-id="${t.id}" data-task-date="${t.date}" data-goal-id="${goalId}" title="Sil" aria-label="Sil"><i class="fa-solid fa-trash"></i></button>
               `;
               { const _cb2 = li.querySelector('.gd-task-checkbox'); if (_cb2) { if (t.completed) { _cb2.style.background = '#2ed573'; _cb2.style.borderColor = '#2ed573'; } else { _cb2.style.borderColor = '#2ed573'; } } }
               { const _ti2 = li.querySelector('.gd-task-title'); if (_ti2) { if (t.completed) { _ti2.style.textDecoration = 'line-through'; _ti2.style.color = 'var(--text-muted)'; } else { _ti2.style.color = '#fff'; _ti2.style.fontWeight = '500'; } } }
               { const _pr = li.querySelector('.gd-task-prio'); if (_pr) { if (t.priority === 'high') { _pr.style.color = '#ff4757'; _pr.style.background = 'rgba(255,71,87,0.1)'; _pr.style.border = '1px solid rgba(255,71,87,0.2)'; } else if (t.priority === 'low') { _pr.style.color = '#2ed573'; _pr.style.background = 'rgba(46,213,115,0.1)'; _pr.style.border = '1px solid rgba(46,213,115,0.2)'; } else { _pr.style.color = '#ff9f43'; _pr.style.background = 'rgba(255,159,67,0.1)'; _pr.style.border = '1px solid rgba(255,159,67,0.2)'; } } }
            }
            return li;
         };

         // Katlanma durumunu bellekte tut
         if (!window._msGroupCollapsed) window._msGroupCollapsed = {};

         groups.forEach((group, groupIndex) => {
             const groupKey = group.type === 'milestone' ? `ms_${group.ms.id}` : `general_${goalId}`;
             // İlk açılışta hepsi açık
             if (window._msGroupCollapsed[groupKey] === undefined) window._msGroupCollapsed[groupKey] = false;
             const isCollapsed = window._msGroupCollapsed[groupKey];

             // Grup başlığı
             const header = document.createElement('li');
             header.style.listStyle = 'none';
             header.style.padding = '0';
             header.style.marginBottom = '4px';
             header.style.marginTop = '8px';

             if (group.type === 'milestone') {
                 const msCompleted = group.tasks.filter(t => t.completed).length;
                 const msTotal = group.tasks.length;
                 const allDone = msCompleted === msTotal;
                 // Tarih aralığı label'ı oluştur
                 const _fmtMsDate = (d) => { if(!d) return '?'; const p=d.split('-'); return p[0].length===4 ? `${p[2]}.${p[1]}.${p[0]}` : `${p[0]}.${p[1]}.${p[2]}`; };
                 const msStart = group.ms.startDate || '';
                 const msEnd = group.ms.date || '';
                 const msDateRange = (msStart || msEnd) ? `<span class="u-font-size-10px_color-rgba1161852550p7_background-rgba91322"><i class="fa-regular fa-calendar-range u-margin-right-3px" ></i>${_fmtMsDate(msStart)} → ${_fmtMsDate(msEnd)}</span>` : '';
                header.innerHTML = `
                    <div class="gd-ms-header u-display-flex_align-items-center_gap-8px_padding-8px12px_bo" data-group-key="${groupKey}" >
                        <i class="fa-solid fa-chevron-${isCollapsed ? 'right' : 'down'} gd-ms-chevron u-font-size-10px_transition-transform0p2s_width-10px" ></i>
                        <i class="fa-solid fa-flag-checkered gd-ms-flag u-font-size-12px" ></i>
                        <span class="gd-ms-title u-font-size-12px_font-weight-700_flex-1_min-width-0" >${escapeHtml(group.ms.text)}</span>
                        ${msDateRange}
                        <span class="u-font-size-11px_color-var-text-muted_background-rgba2552552">${msCompleted}/${msTotal}</span>
                    </div>
                `;
                { const _hdr = header.querySelector('.gd-ms-header'); if (_hdr) { _hdr.style.background = allDone ? 'rgba(46,213,115,0.07)' : 'rgba(9,132,227,0.07)'; _hdr.style.border = allDone ? '1px solid rgba(46,213,115,0.2)' : '1px solid rgba(9,132,227,0.2)'; } }
                { const _chev = header.querySelector('.gd-ms-chevron'); if (_chev) _chev.style.color = allDone ? '#2ed573' : '#74b9ff'; }
                { const _flag = header.querySelector('.gd-ms-flag'); if (_flag) _flag.style.color = allDone ? '#2ed573' : '#0984e3'; }
                { const _title = header.querySelector('.gd-ms-title'); if (_title) _title.style.color = allDone ? '#2ed573' : '#74b9ff'; }
             } else {
                 header.innerHTML = `
                     <div data-group-key="${groupKey}" class="u-display-flex_align-items-center_gap-8px_padding-8px12px_bo-2">
                         <i class="fa-solid fa-chevron-${isCollapsed ? 'right' : 'down'} u-font-size-10px_color-var-text-muted_width-10px" ></i>
                         <i class="fa-solid fa-layer-group u-font-size-12px_color-var-text-muted" ></i>
                         <span class="u-font-size-12px_font-weight-700_color-var-text-muted_flex-1">Genel</span>
                         <span class="u-font-size-11px_color-var-text-muted_background-rgba2552552">${group.tasks.length} görev</span>
                     </div>
                 `;
             }

              // Başlığa tıklama: aç/kapat
              header.querySelector('[data-group-key]').addEventListener('click', () => {
                  window._msGroupCollapsed[groupKey] = !window._msGroupCollapsed[groupKey];
                  updateGoalDetailsUI(goalId);
              });

              detailTaskList.appendChild(header);

              // Görevleri render et (kapalıysa ekleme)
              if (!isCollapsed) {
                  group.tasks.forEach(t => detailTaskList.appendChild(renderTaskCard(t)));
              }
          });
     }
     return { linkedTasks, completedTaskCount };
}

// Hedef detay panelinin "Destekleyici Alışkanlıklar" bölümü — döner:
// { completedHabitSteps, totalHabitTarget } (İstatistikler bölümü için).
function _gdRenderHabitsSection(goalId) {
   const habits = getHabitsRef();
   const detailHabitList = document.getElementById('detail-habit-list');
   detailHabitList.innerHTML = '';
   const linkedHabits = habits.filter(h => h.parentGoals && h.parentGoals.includes(String(goalId)));

   let completedHabitSteps = 0;
   let totalHabitTarget = 0;

   if(linkedHabits.length === 0) {
       detailHabitList.innerHTML = '<li class="empty-list-note">Bu hedefe bağlı destekleyici alışkanlık bulunmuyor. "Alışkanlıklar" sekmesinden ekleyebilirsiniz.</li>';
   } else {
       const todayStr = formatDateToString(new Date());

       linkedHabits.forEach(h => {
           const hCompleted = Object.keys(h.history).length;
           const hTarget = h.targetDays || 21;
           completedHabitSteps += hCompleted;
           totalHabitTarget += hTarget;
           const hProgress = Math.min(Math.round((hCompleted / hTarget) * 100), 100);

           const isDoneToday = !!h.history[todayStr];

           const li = document.createElement('li');
           li.className = 'detail-habit-item';
           li.innerHTML = `
               <div class="habit-premium-header">
                   <div class="habit-premium-title-group">
                       <div class="habit-premium-icon">
                           <i class="fa-solid ${h.icon || 'fa-leaf'}"></i>
                       </div>
                       <span class="habit-premium-name">${escapeHtml(h.name)}</span>
                   </div>

                   <button class="habit-premium-today-check ${isDoneToday ? 'done' : ''}"
                           data-action="gd-toggle-habit" data-id="${h.id}" data-date="${todayStr}" data-goal-id="${goalId}"
                           title="${isDoneToday ? 'Bugün Tamamlandı! Geri al?' : 'Bugün için tamamla'}">
                       <i class="fa-solid ${isDoneToday ? 'fa-check' : 'fa-bolt'}"></i> ${isDoneToday ? 'Bitti' : 'Bugün'}
                   </button>
               </div>

               <div class="habit-premium-progress-area">
                   <div class="habit-premium-stats">
                       <span>İlerleme: ${hCompleted} / ${hTarget} Gün</span>
                       <strong>%${hProgress}</strong>
                   </div>
                   <div class="habit-premium-track">
                       <div class="habit-premium-fill" ></div>
                   </div>
               </div>
           `;
           { const _fill = li.querySelector('.habit-premium-fill'); if (_fill) _fill.style.width = hProgress + '%'; }
           detailHabitList.appendChild(li);
       });
   }
   return { completedHabitSteps, totalHabitTarget };
}

// Hedef detay panelinin "Milestones (Dönüm Noktaları)" bölümü — sadece DOM'a
// yazar, İstatistikler bölümü ilerleme hesabı için goal.milestones'a doğrudan bakar.
function _gdRenderMilestonesSection(goal) {
    if(!goal.milestones) goal.milestones = [];
    const milestoneList = document.getElementById('detail-milestone-list');
    milestoneList.innerHTML = '';

    const totalMs = goal.milestones.length;
    const completedMs = goal.milestones.filter(m => m.completed).length;
    const msBadge = document.getElementById('milestone-progress-badge');
    const msFill = document.getElementById('milestone-overall-fill');
    if(msBadge) msBadge.textContent = `${completedMs} / ${totalMs}`;
    if(msFill) msFill.style.width = totalMs > 0 ? `${Math.round((completedMs/totalMs)*100)}%` : '0%';

    if(goal.milestones.length === 0) {
        milestoneList.innerHTML = '<li class="u-padding-20px0_text-align-center_color-var-text-muted_font-"><i class="fa-solid fa-route u-font-size-24px_display-block_margin-bottom-8px_opacity-0p3" ></i>Henüz aşama eklenmedi.<br>Hedefini parçalara bölerek başarmayı kolaylaştır.</li>';
    } else {
        const tasks = getTasksRef();
        goal.milestones.forEach((m, index) => {
            const li = document.createElement('li');

            // Bağlı görevleri hesapla
            const linkedToMs = tasks.filter(t => String(t.parentMilestone) === String(m.id) && String(t.parentGoal) === String(goal.id));
            const completedLinked = linkedToMs.filter(t => t.completed).length;
            const totalLinked = linkedToMs.length;

            // --- Premium Liste Tarih Badge Çözümleyici Başlangıç ---
            let dateBadge = '';
            if (m.date) {
                const today = new Date(); today.setHours(0, 0, 0, 0);

                // Güvenli tarih ayrıştırıcı (TR ve US formatlarına tam uyumlu)
                let msDate = new Date();
                const dateParts = m.date.trim().split('-');
                if (dateParts.length === 3) {
                    if (dateParts[0].length === 4) { // YYYY-MM-DD
                        msDate = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
                    } else { // DD-MM-YYYY
                        msDate = new Date(parseInt(dateParts[2]), parseInt(dateParts[1]) - 1, parseInt(dateParts[0]));
                    }
                } else {
                    msDate = new Date(m.date);
                }
                msDate.setHours(0, 0, 0, 0);

                const diffDays = Math.round((msDate - today) / 86400000);
                if (!m.completed) {
                    if (diffDays < 0) dateBadge = `<span class="u-color-hff4757_background-rgba25571870p12_border-1pxsolidrg"><i class="fa-solid fa-clock"></i> ${Math.abs(diffDays)}g gecikmiş</span>`;
                    else if (diffDays === 0) dateBadge = `<span class="u-color-hffa502_background-rgba25516520p12_border-1pxsolidrg"><i class="fa-solid fa-bolt"></i> Bugün</span>`;
                    else dateBadge = `<span class="u-color-h74b9ff_background-rgba1161852550p1_border-1pxsolidr"><i class="fa-regular fa-calendar"></i> ${diffDays}g kaldı</span>`;
                }
            }
            // --- Premium Liste Tarih Badge Çözümleyici Bitiş ---

           // Görev sayacı badge'i
           let taskBadge = '';
           let taskBadgeAllDone = false;
           if (totalLinked > 0) {
               taskBadgeAllDone = completedLinked === totalLinked;
               taskBadge = `<span class="ms-task-badge u-border-radius-10px_padding-1px7px_font-size-10px_font-weig" ><i class="fa-solid fa-list-check"></i> ${completedLinked}/${totalLinked} görev</span>`;
           }

            li.className = `detail-milestone-item ${m.completed ? 'completed' : ''}`;
            li.innerHTML = `
                <div class="ms-dot u-cursor-default" title="${m.completed ? 'Tamamlandı' : `Adım ${index + 1}`}">
                    ${m.completed
                        ? '<i class="fa-solid fa-check u-font-size-10px_color-hfff" ></i>'
                        : `<span class="ms-step-label">${index + 1}</span>`
                    }
                </div>
                <div class="ms-content">
                    <span class="ms-text">${escapeHtml(m.text)}</span>
                    <div class="ms-meta u-flex-wrap-wrap_gap-5px" >
                        ${m.completed
                            ? '<i class="fa-solid fa-circle-check u-font-size-10px" ></i> Tamamlandı'
                            : `<i class="fa-solid fa-circle u-font-size-6px_opacity-0p4" ></i> Adım ${index + 1}`
                        }
                        ${dateBadge}
                        ${taskBadge}
                    </div>
                </div>
               <div class="u-display-flex_flex-direction-column_gap-5px_flex-shrink-0">
                   <button class="ms-delete-btn u-color-h74b9ff_background-rgba1161852550p08_border-color-rg" data-action="gd-edit-milestone" data-goal-id="${goal.id}" data-id="${m.id}" title="Düzenle"  aria-label="Düzenle"><i class="fa-solid fa-pen"></i></button>
                   <button class="ms-delete-btn" data-action="gd-delete-milestone" data-goal-id="${goal.id}" data-id="${m.id}" title="Sil" aria-label="Sil"><i class="fa-solid fa-trash"></i></button>
                </div>
            `;
            if (totalLinked > 0) {
                const _msBadge = li.querySelector('.ms-task-badge');
                if (_msBadge) {
                    _msBadge.style.color = taskBadgeAllDone ? '#2ed573' : '#a29bfe';
                    _msBadge.style.background = taskBadgeAllDone ? 'rgba(46,213,115,0.1)' : 'rgba(162,155,254,0.1)';
                    _msBadge.style.border = taskBadgeAllDone ? '1px solid rgba(46,213,115,0.25)' : '1px solid rgba(162,155,254,0.2)';
                }
            }
            milestoneList.appendChild(li);
        });
    }
}

// Hedef detay panelinin "İstatistikler & İlerleme Güncellemesi" bölümü —
// toplam ilerlemeyi hesaplayıp üstteki çubuğu/AI analizini günceller,
// %100 tamamlanınca konfeti/başarı modalını tetikler.
function _gdUpdateStatsAndCelebration(goalId, goal, linkedTasks, completedTaskCount, completedHabitSteps, totalHabitTarget) {
 // Milestone katkısı (her milestone = 1 adım ağırlığında)
 const totalMsSteps = goal.milestones ? goal.milestones.length : 0;
 const completedMsSteps = goal.milestones ? goal.milestones.filter(m => m.completed).length : 0;

 const totalSteps = linkedTasks.length + totalHabitTarget + totalMsSteps;
 const completedSteps = completedTaskCount + completedHabitSteps + completedMsSteps;
 let totalProgress = totalSteps === 0 ? 0 : Math.round((completedSteps / totalSteps) * 100);
 if (totalProgress > 100) totalProgress = 100;

 // Tepe İlerleme Çubuğunu Canlı Güncelle
 document.getElementById('detail-goal-progress-text').textContent = `%${totalProgress}`;
 const manualBtn2 = document.getElementById('manual-complete-goal-btn');
 if(manualBtn2) manualBtn2.style.display = (goal.status === 'completed') ? 'none' : 'inline-flex';
 document.getElementById('detail-goal-progress-fill').style.width = `${totalProgress}%`;

 // Odaklanma Eforu (Artık tamamen gerçek Pomodoro verisi!)
 const totalFocusMins = goal.focusTime || 0;
 const hTime = Math.floor(totalFocusMins / 60);
 const mTime = totalFocusMins % 60;
 document.getElementById('detail-goal-focus-time').textContent = hTime > 0 ? `${hTime} sa ${mTime} dk` : `${mTime} dk`;

// FocusAI Analizi
const aiContainer = document.getElementById('detail-goal-ai-text');
if (typeof window.generateAIAnalysis === 'function') {
    aiContainer.innerHTML = window.generateAIAnalysis(goal, totalProgress, totalSteps, completedSteps);
}

// Arşivlendiyse Tamamla butonunu gizle
const manualBtnCheck = document.getElementById('manual-complete-goal-btn');
if (manualBtnCheck) {
    manualBtnCheck.style.display = (goal.status === 'completed' || totalProgress === 100) ? 'none' : 'inline-flex';
}

 // --- YENİ: %100 TAMAMLANMA VE KONFETİ KONTROLÜ ---
 if (totalProgress === 100 && totalSteps > 0 && !goal.isCelebrated) {
     goal.isCelebrated = true; // Sürekli patlamaması için işaretle
     Store.goals.set(getGoalsRef());
     if(typeof window.fireConfetti === 'function') window.fireConfetti(); // Şölen başlasın!

     // Başarı modalını göster (btn-victory-archive / btn-victory-close)
     const victoryModal = document.getElementById('goal-victory-modal');
     if (victoryModal) {
         victoryModal._activeGoalId = goalId;
         victoryModal.classList.remove('hidden');
     } else {
         showPremiumModal({
             title: 'Vizyon Gerçekleşti! 🏆',
             message: `Muazzam bir iş başardın! "${escapeHtml(goal.title)}" hedefine ulaştın.`,
             type: 'success'
         });
     }
 } else if (totalProgress < 100 && goal.isCelebrated) {
      goal.isCelebrated = false; // Kullanıcı bir görevin tikini geri alırsa kutlama hakkını sıfırla
      Store.goals.set(getGoalsRef());
 }
}

window.__gdRenderActionPlanSection = _gdRenderActionPlanSection;
window.__gdRenderHabitsSection = _gdRenderHabitsSection;
window.__gdRenderMilestonesSection = _gdRenderMilestonesSection;
window.__gdUpdateStatsAndCelebration = _gdUpdateStatsAndCelebration;

})();
