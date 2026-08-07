// script-goal-modal.js dosyasından çıkarıldı — renderGoals'ın kart üretici
// yardımcıları. Sadece kendi `goal` parametresine ve getTasksRef()'e
// (salt-okunur) bağlı, escapeHtml global window-fallthrough ile çözülüyor.
import { getTasksRef } from './script.js';
import { generateAIAnalysis } from './script-goal-modal-analysis.js';

const monthNamesShort = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

// renderGoals'ın "Zaferler/Süresi Dolanlar" arşiv kartını üretir — goal zaten
// _progress/_totalSteps gibi işlenmiş alanlarla geliyor (bkz. processedGoals).
export function buildArchivedGoalCardEl(goal) {
    const isWon = goal.status === 'completed';
    const startDate = new Date(goal.createdAt || Date.now());
    const endDate = new Date(goal.completedAt || Date.now());
    const diffMs = endDate - startDate;
    const diffDaysTotal = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
    const durationText = diffDaysTotal === 0 ? 'Aynı gün' : diffDaysTotal === 1 ? '1 gün' : `${diffDaysTotal} gün`;
    const emoji = isWon ? '🏆' : '⏰';
    const cardBorder = isWon ? 'rgba(254,202,87,0.35)' : 'rgba(255,71,87,0.25)';
    const cardBg = isWon ? 'linear-gradient(135deg, rgba(254,202,87,0.07), rgba(0,0,0,0.25))' : 'linear-gradient(135deg, rgba(255,71,87,0.06), rgba(0,0,0,0.25))';
    const accentColor = isWon ? '#feca57' : '#ff4757';
    const accentBg = isWon ? 'rgba(254,202,87,0.12)' : 'rgba(255,71,87,0.12)';
    const statusLabel = isWon ? 'Başarıldı!' : 'Süre Doldu';
    const statusIcon = isWon ? 'fa-trophy' : 'fa-hourglass-end';
    const linkedTaskCount = getTasksRef().filter(t => t.parentGoal === goal.id).length;
    const completedTaskCount = getTasksRef().filter(t => t.parentGoal === goal.id && t.completed).length;
    const categoryLabel = goal.category ? goal.category.charAt(0).toUpperCase() + goal.category.slice(1).replace(/-/g, ' ') : '';

    const div = document.createElement('div');
    div.className = 'glass-element';
    div.dataset.id = goal.id;
    div.style.border = `1px solid ${cardBorder}`;
    div.style.background = cardBg;
    div.style.borderRadius = '16px';
    div.style.padding = '22px 24px';
    div.style.position = 'relative';
    div.style.overflow = 'hidden';
    div.style.cursor = 'default';
    div.innerHTML = `
        <div class="u-position-absolute_top-0_right-0_font-size-90px_opacity-0p0">${emoji}</div>
        <div class="u-display-flex_align-items-flex-start_gap-16px_position-rela">
            <div class="agc-emoji u-font-size-36px_line-height-1_flex-shrink-0" >${emoji}</div>
            <div class="u-flex-1_min-width-0-2">
                <div class="u-display-flex_align-items-center_gap-8px_flex-wrap-wrap_mar">
                    <span class="agc-status-badge u-padding-3px10px_border-radius-20px_font-size-11px_font-wei" >
                        <i class="fa-solid ${statusIcon} u-margin-right-4px" ></i>${statusLabel}
                    </span>
                    ${categoryLabel ? `<span class="u-background-rgba108922310p12_color-ha29bfe_padding-3px10px_">${categoryLabel}</span>` : ''}
                </div>
                <div class="u-font-size-17px_font-weight-700_color-hfff_margin-bottom-4p">${escapeHtml(goal.title)}</div>
                ${goal.desc ? `<div class="u-font-size-12px_color-var-text-muted_font-style-italic_marg">"${escapeHtml(goal.desc)}"</div>` : ''}
                <div class="u-display-flex_flex-wrap-wrap_gap-10px_margin-top-12px">
                    <div class="u-display-flex_align-items-center_gap-6px_font-size-12px_col-2">
                        <i class="fa-regular fa-calendar agc-accent-icon"></i>
                        ${endDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>
                    <div class="u-display-flex_align-items-center_gap-6px_font-size-12px_col-2">
                        <i class="fa-regular fa-clock agc-accent-icon"></i>
                        ${durationText} sürdü
                    </div>
                    ${linkedTaskCount > 0 ? `<div class="u-display-flex_align-items-center_gap-6px_font-size-12px_col-2">
                        <i class="fa-solid fa-list-check agc-accent-icon"></i>
                        ${completedTaskCount}/${linkedTaskCount} görev
                    </div>` : ''}
                    <div class="agc-progress-badge u-display-flex_align-items-center_gap-6px_font-size-12px_fon" >
                        <i class="fa-solid fa-chart-simple"></i> %${goal._progress}
                    </div>
                </div>
            </div>
            <div class="u-display-flex_flex-direction-column_gap-8px_flex-shrink-0">
                ${!isWon ? `<button class="control-btn u-white-space-nowrap_font-size-12px_font-weight-700_padding-" data-action="extend-goal-deadline" data-id="${goal.id}" title="Süreyi Uzat" >
                    <i class="fa-solid fa-calendar-plus"></i> Süreyi Uzat
                </button>` : ''}
                <button class="icon-btn delete-icon-btn goal-archive-del-btn u-opacity-0p4_transition-0p3s_align-self-flex-end_width-30px" data-action="delete-goal" data-id="${goal.id}" title="Sil"  aria-label="Sil">
                    <i class="fa-solid fa-trash u-font-size-12px" ></i>
                </button>
            </div>
        </div>
    `;
    div.querySelectorAll('.agc-accent-icon').forEach(el => { el.style.color = accentColor; });
    const _agcEmoji = div.querySelector('.agc-emoji');
    if (_agcEmoji) _agcEmoji.style.filter = `drop-shadow(0 2px 8px ${accentColor}66)`;
    const _agcStatusBadge = div.querySelector('.agc-status-badge');
    if (_agcStatusBadge) {
        _agcStatusBadge.style.background = accentBg;
        _agcStatusBadge.style.color = accentColor;
        _agcStatusBadge.style.border = `1px solid ${accentColor}44`;
    }
    const _agcProgressBadge = div.querySelector('.agc-progress-badge');
    if (_agcProgressBadge) {
        _agcProgressBadge.style.color = accentColor;
        _agcProgressBadge.style.background = accentBg;
        _agcProgressBadge.style.border = `1px solid ${accentColor}33`;
    }
    return div;
}

// renderGoals'ın aktif hedef kartını üretir — goal işlenmiş alanlarla
// (_progress/_linkedTasks vb.) geliyor.
export function buildActiveGoalCardEl(goal) {
        let aiText = generateAIAnalysis(goal, goal._progress, goal._totalSteps, goal._completedSteps);

        const [y, m, d] = goal.deadline.split('-');
        const deadlineDisplay = `${d} ${monthNamesShort[parseInt(m)-1]} ${y}`;

        // --- 3. MADDE: Akıllı Tarih Hesaplaması (Urgency) ---
       // GERÇEK BUG DÜZELTMESİ (2026-08-06): bkz. script-goal-details-panel.js'teki
       // aynı düzeltme — deadlineDate gün sonuna sabitlenip today'nin saati
       // bırakılınca, bitiş TAM BUGÜN olsa bile "diffDays===0 → Bugün Son Gün!"
       // dalı asla tetiklenmiyor, kart hep "1 Gün Kaldı!" gösteriyordu.
       const deadlineDate = new Date(y, m - 1, d);
       deadlineDate.setHours(0, 0, 0, 0);
       const today = new Date();
       today.setHours(0, 0, 0, 0);
       const diffTime = deadlineDate - today;
       const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        let urgencyClass = 'urgency-safe';
        let urgencyIcon = 'fa-regular fa-calendar-check';
        let urgencyText = deadlineDisplay;

        // --- YENİ DURUM VE RENK MOTORU BAŞLANGICI ---
        if (goal.status === 'completed' || goal._progress === 100) {
            // Hedef erken veya zamanında tamamlandıysa yeşil buton
            urgencyClass = 'urgency-safe';
            urgencyIcon = 'fa-solid fa-circle-check';
            urgencyText = 'Tamamlandı';
        } else if (diffDays < 0 || goal.status === 'expired') {
            // Süresi bittiyse ve tamamlanmadıysa kırmızı buton
            urgencyClass = 'urgency-danger';
            urgencyIcon = 'fa-solid fa-circle-xmark';
            urgencyText = 'Tamamlanamadı';
        } else if (diffDays == 0) {
            urgencyClass = 'urgency-danger';
            urgencyIcon = 'fa-solid fa-fire-flame-curved';
            urgencyText = 'Bugün Son Gün!';
        } else if (diffDays <= 3) {
            urgencyClass = 'urgency-danger';
            urgencyIcon = 'fa-solid fa-fire-flame-curved';
            urgencyText = `${diffDays} Gün Kaldı!`;
        } else if (diffDays <= 7) {
            urgencyClass = 'urgency-warning';
            urgencyIcon = 'fa-solid fa-hourglass-half';
            urgencyText = `${diffDays} Gün Kaldı`;
        } else {
            urgencyClass = 'urgency-safe';
            urgencyIcon = 'fa-regular fa-calendar-check';
            urgencyText = `${diffDays} Gün Kaldı`;
        }
        // --- YENİ DURUM VE RENK MOTORU BİTİŞİ ---

        // --- 5. MADDE: Kart İçi İlerleme Çubuğu Vurgusu ---
        let progressColor = 'linear-gradient(90deg, #0984e3, #74b9ff)'; // %0-30 arası (Mavi)

        if (goal._progress === 100) {
            progressColor = 'linear-gradient(90deg, #feca57, #ff9f43)'; // %100 Altın Sarısı
        } else if (goal._progress >= 70) {
            progressColor = 'linear-gradient(90deg, #2ed573, #7bed9f)'; // %70-99 arası (Yeşil)
        } else if (goal._progress >= 30) {
            progressColor = 'linear-gradient(90deg, #6c5ce7, #a29bfe)'; // %30-69 arası (Mor)
        }
        // --------------------------------------------------

        const div = document.createElement('div');
        div.className = 'goal-card glass-element';
        div.dataset.id = goal.id;
        const isUrgent = diffDays >= 0 && diffDays <= 3;
        const urgencyStyle = isUrgent ? 'background: rgba(255, 71, 87, 0.15); color: #ff4757; border-color: rgba(255, 71, 87, 0.4); box-shadow: 0 0 15px rgba(255,71,87,0.2);' : '';

       // YENİ: Tarih rozeti oluşturucu
       let dateInfoHTML = '';
       // İlerleme %100 olsa bile sadece süre dolup otomatik arşiv motoru statüyü değiştirdiğinde bu alan tetiklenir
       if (goal.status === 'completed' || goal.status === 'expired') {
           const startD = new Date(goal.createdAt || Date.now());
           const endD = new Date(goal.completedAt || Date.now());
           const badgeColor = goal.status === 'completed' ? '#2ed573' : '#ff4757';
           const badgeBg = goal.status === 'completed' ? 'rgba(46, 213, 115, 0.1)' : 'rgba(255, 71, 87, 0.1)';
           const badgeBorder = goal.status === 'completed' ? 'rgba(46, 213, 115, 0.2)' : 'rgba(255, 71, 87, 0.2)';
           const badgeIcon = goal.status === 'completed' ? 'fa-calendar-check' : 'fa-calendar-times';
           const badgeText = goal.status === 'completed' ? 'Tamamlanma' : 'Süre Dolumu';

           dateInfoHTML = `<div class="gc-date-info-badge u-margin-top-10px_display-inline-flex_align-items-center_gap" data-badge-color="${badgeColor}" data-badge-bg="${badgeBg}" data-badge-border="${badgeBorder}"><i class="fa-regular ${badgeIcon}"></i> Başlangıç: ${startD.toLocaleDateString('tr-TR')} &nbsp;|&nbsp; ${badgeText}: ${endD.toLocaleDateString('tr-TR')}</div>`;
       }

       // Başlangıç ve bitiş tarihlerini oluştur
       const gcStartDate = goal.createdAt ? new Date(goal.createdAt) : null;
       const gcStartDisplay = gcStartDate ? `${String(gcStartDate.getDate()).padStart(2,'0')} ${monthNamesShort[gcStartDate.getMonth()]} ${gcStartDate.getFullYear()}` : '—';
       const gcEndDisplay = deadlineDisplay || '—';

       div.innerHTML = `
       <div class="gc-top">
           <div class="gc-left">
               <div class="gc-title">${escapeHtml(goal.title)}</div>
               <div class="gc-meta-row">
                   <span class="gc-meta-item"><i class="fa-regular fa-calendar-plus"></i> ${gcStartDisplay} <i class="fa-solid fa-arrow-right gc-meta-arrow"></i> ${gcEndDisplay}</span>
                   ${goal.reward && goal.reward.trim() !== '' ? `<span class="gc-meta-item gc-meta-reward"><i class="fa-solid fa-gift"></i> ${escapeHtml(goal.reward)}</span>` : ''}
               </div>
           </div>
           <div class="gc-right">
               <span class="gc-badge ${urgencyClass}">${urgencyText}</span>
               <button class="gc-del-btn" data-action="delete-goal" data-id="${goal.id}" title="Sil" aria-label="Sil"><i class="fa-solid fa-trash"></i></button>
           </div>
       </div>

       ${(goal._milestoneTotal > 0 || goal._linkedTasks.length > 0 || goal._linkedHabits.length > 0) ? `
       <div class="gc-link-row">
           ${goal._milestoneTotal > 0 ? `<span class="gc-stat-chip"><i class="fa-solid fa-flag-checkered"></i> ${goal._milestoneDone}/${goal._milestoneTotal} dönüm noktası</span>` : ''}
           ${goal._linkedTasks.length > 0 ? `<span class="gc-stat-chip"><i class="fa-solid fa-list-check"></i> ${goal._linkedTasks.filter(t => t.completed).length}/${goal._linkedTasks.length} görev</span>` : ''}
           ${goal._linkedHabits.slice(0, 3).map(h => `<span class="gc-habit-chip">${h.icon && !h.icon.startsWith('fa-') ? escapeHtml(h.icon) : '<i class="fa-solid fa-repeat"></i>'} ${escapeHtml(h.name)}</span>`).join('')}
           ${goal._linkedHabits.length > 3 ? `<span class="gc-habit-chip gc-habit-more">+${goal._linkedHabits.length - 3} alışkanlık</span>` : ''}
       </div>` : ''}

       <div class="gc-progress-area">
           <div class="gc-progress-track">
               <div class="gc-progress-fill"></div>
           </div>
           <div class="gc-progress-meta">
               <span>${goal._completedSteps}/${goal._totalSteps} adım</span>
               <span class="gc-pct">%${goal._progress}</span>
           </div>
       </div>

       <div class="gc-actions">
           ${goal.status !== 'completed' ? `<button class="gc-complete-btn" data-action="quick-complete-goal" data-id="${goal.id}"><i class="fa-solid fa-check"></i> Tamamla</button>` : '<span></span>'}
           <button class="gc-detail-btn" data-action="open-goal-details" data-id="${goal.id}">Detaylar <i class="fa-solid fa-arrow-right"></i></button>
       </div>
       `;
    const _gcFill = div.querySelector('.gc-progress-fill');
    if (_gcFill) { _gcFill.style.width = goal._progress + '%'; _gcFill.style.background = progressColor; }
    return div;
}
