// ─── ANA HEDEFLER (GOALS) MODALI + YAPAY ZEKA ANALİZİ ──────────────────
// script.js dosyasından çıkarıldı (Faz 2, 2026-07-20). Hedef düzenleme
// (editGoalInfo), kaydetme (_saveGoalImpl), silme (deleteGoal — bağlı
// task/habit referanslarını da temizler), "Zafer Modalı" (hedef tamamlanınca
// arşivleme), FocusAI metin analizi (generateAIAnalysis), sekme/sıralama ve
// ana render fonksiyonu (renderGoals).
//
// openGoalModal/closeGoalModal BİLİNÇLİ OLARAK script.js'te bırakıldı:
// index.html'in inline-goal-modal-globals.js'i (KLASİK script, type="module"
// DEĞİL) bu isimlerle bir "her zaman çalışan" fallback tanımlıyor — script.js
// kendi zengin openGoalModal'ını (MAX_ACTIVE_GOALS kontrolü vb.) BİLEREK
// window'a export ETMİYOR, çünkü öyle yapılırsa modül-scope'lu bare
// referanslar (HTML onclick="..." gibi GERÇEK global scope'tan çağrılanlar
// değil) davranışı sessizce değişirdi. Bu dosya da aynı prensibi korur:
// closeGoalModal() bare çağrıları burada YAPILMADI/değiştirilmedi — window
// fallthrough ile inline-goal-modal-globals.js'in fonksiyonuna çözümlenir,
// ki o da aynı DOM işlemini (modal'ı gizle) yapar, davranış farkı yok.
//
// Dış bağımlılıklar (script.js'te kalıyor, window.* köprüsüyle açıldı):
// - goals → getGoalsRef()/__setGoalsRef() (deleteGoal içinde
//   reassignment var — bu çıkarmada setter YENİ eklendi)
// - tasks/habits → getTasksRef()/__getHabitsRef() (salt-okunur,
//   sadece forEach ile mutasyon, reassignment yok)
// - saveTasks, saveHabits, populateParentHabitSelects → window.* (bu
//   çıkarmada köprüleri YENİ eklendi — önceden sadece bare erişilebiliyordu)
// - openGoalDetails, generateId, showPremiumModal → window.* (zaten köprülüydü)
// - escapeHtml, fireConfetti (typeof kontrolü), window.FocusAISocial →
//   zaten global (window-fallthrough)
//
// goalModal/goalsContainer/btnOpenGoalModal/goalSortSelect DOM referansları
// ve MAX_ACTIVE_GOALS/monthNamesShort sabitleri köprü yerine burada TEKRAR
// sorgulanıyor/tanımlanıyor (basit document.getElementById/sabit değer —
// çapraz dosya bağımlılığından daha basit).

import { getGoalsRef, setGoalsRef, getHabitsRef, getTasksRef, openGoalDetails, saveTasks, saveHabits } from './script.js';
import { showPremiumModal } from './script-premium-modal.js';
import { populateParentHabitSelects } from './script-populate-parent-selects.js';
import { generateId } from './storage-manager.js';
import { toInputDate, formatDateToString } from './script-date-time-utils.js';

const MAX_ACTIVE_GOALS = 5;
const goalModal = document.getElementById('goal-modal');
const goalsContainer = document.getElementById('goals-container');
const btnOpenGoalModal = document.getElementById('btn-open-goal-modal');
const monthNamesShort = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

window.editGoalInfo = function() {
    const goalId = document.getElementById('detail-active-goal-id').value;
    const goal = getGoalsRef().find(g => String(g.id) === String(goalId));
    if(!goal) return;

    document.getElementById('edit-goal-id').value = goal.id;
    document.getElementById('goal-title-input').value = goal.title;
    document.getElementById('goal-desc-input').value = goal.desc || '';
    document.getElementById('goal-deadline-input').value = goal.deadline || '';

    document.getElementById('goal-details-modal').classList.add('hidden');
    goalModal.classList.remove('hidden');
}

// --- ZAFER MODALI BUTONLARI ---
const victoryModal = document.getElementById('goal-victory-modal');
const btnVictoryArchive = document.getElementById('btn-victory-archive');
const btnVictoryClose = document.getElementById('btn-victory-close');

if (btnVictoryArchive && victoryModal) {
    btnVictoryArchive.addEventListener('click', () => {
        const goalId = victoryModal._activeGoalId;
        const goal = getGoalsRef().find(g => String(g.id) === String(goalId));
        if (goal) {
            goal.status = 'completed';
            goal.completedAt = Date.now();
            Store.goals.set(getGoalsRef());
            if (window.FocusAISocial && typeof window.FocusAISocial.postActivity === 'function') {
                window.FocusAISocial.postActivity(`"${goal.title}" hedefini başarıyla tamamladı 🏆`);
            }
            renderGoals();
        }
        victoryModal.classList.add('hidden');
        document.getElementById('goal-details-modal').classList.add('hidden');
        if(typeof fireConfetti === 'function') fireConfetti();
        showPremiumModal({ title: 'Başarı Arşivlendi! 🏆', message: 'Tebrikler! Bu büyük başarı artık Başarılarım sekmesinde.', type: 'success' });
    });
}

if (btnVictoryClose && victoryModal) {
    btnVictoryClose.addEventListener('click', () => {
        victoryModal.classList.add('hidden');
    });
}

if (victoryModal) {
    victoryModal.addEventListener('click', (e) => {
        if (e.target === victoryModal) victoryModal.classList.add('hidden');
    });
}

window._saveGoalImpl = function() {
    {
        const idToEdit = document.getElementById('edit-goal-id') ? document.getElementById('edit-goal-id').value : '';
        const title = document.getElementById('goal-title-input').value.trim();
        const desc = document.getElementById('goal-desc-input').value.trim();
        const rawDeadline = document.getElementById('goal-deadline-input').value;
           // Flatpickr'dan gelen d-m-Y formatını renderGoals'un beklediği YYYY-MM-DD formatına dönüştürüyoruz
           let deadline = rawDeadline;
           if (rawDeadline && rawDeadline.includes('-')) {
               const parts = rawDeadline.split('-');
               if (parts[0].length === 2) { // Eğer ilk parça gün ise (d-m-Y)
                   deadline = `${parts[2]}-${parts[1]}-${parts[0]}`; // YYYY-MM-DD formatına çevir
               }
           }

        // --- YENİ EKLENEN: Kategoriyi Okuma ---
        const categorySelect = document.getElementById('goal-category-input');
        const category = categorySelect ? categorySelect.value : '';

        if(!title) {
            showPremiumModal({ title: 'Hata', message: 'Lütfen hedefinizi yazın.', type: 'warning' });
            return;
        }

        if (idToEdit) {
            // Düzenleme Modu
            const goal = getGoalsRef().find(g => String(g.id) === String(idToEdit));
            if (goal) {
                goal.title = title;
                goal.desc = desc;
                goal.deadline = deadline;
                if(categorySelect) goal.category = category; // Kategoriyi güncelle
                showPremiumModal({ title: 'Güncellendi!', message: 'Ana hedef başarıyla güncellendi.', type: 'success' });
            }
        } else {
            // Yeni Ekleme Modu
            const activeGoalCount = getGoalsRef().filter(g => g.status !== 'completed' && g.status !== 'expired').length;
            if (activeGoalCount >= MAX_ACTIVE_GOALS) {
                showPremiumModal({
                    title: 'Odağını Koru 🎯',
                    message: `Aynı anda en fazla ${MAX_ACTIVE_GOALS} aktif ana hedef belirleyebilirsin. Yeni bir vizyon eklemeden önce mevcut hedeflerinden birini tamamla ya da arşivle.`,
                    type: 'warning'
                });
                return;
            }
            getGoalsRef().push({
                id: generateId(),
                title: title,
                desc: desc,
                deadline: deadline,
                category: category, // Kategoriyi kaydet
                createdAt: Date.now()
            });

            if (window.FocusAISocial && typeof window.FocusAISocial.postActivity === 'function') {
               window.FocusAISocial.postActivity(`"${title}" adında yeni bir ana hedef belirledi 🎯`);
           }
            showPremiumModal({ title: 'Vizyon Belirlendi!', message: 'Harika bir hedef! Şimdi görev ve alışkanlıklarını bu hedefe bağlayabilirsin.', type: 'success' });
        }
        Store.goals.set(getGoalsRef());
        populateParentHabitSelects();
        renderGoals();
        
        // YENİ DÜZELTME: Bir sonraki ana hedef oluşturulduğunda tarihin eski hedeften referans almasını engellemek için formları sıfırlıyoruz.
        document.getElementById('goal-title-input').value = '';
        document.getElementById('goal-desc-input').value = '';
        if (document.getElementById('goal-deadline-input')._flatpickr) {
            document.getElementById('goal-deadline-input')._flatpickr.setDate(new Date());
        } else {
            document.getElementById('goal-deadline-input').value = toInputDate(formatDateToString(new Date()));
        }

        closeGoalModal();
        
        // Eğer detay paneli arka planda o hedefe aitse ekranı canlandır
        if (idToEdit) {
            openGoalDetails(idToEdit);
        }
    }
}
// saveGoalBtn'in onclick="saveGoal()" HTML attribute'u zaten _saveGoalImpl'i çağırıyor.
// addEventListener ile ikinci kez bağlarsak çift tetiklenip form temizlendikten sonra
// boş başlık uyarısı gösterir. Bu yüzden addEventListener kullanmıyoruz.

window.deleteGoal = function(id) {
    showPremiumModal({
        title: 'Hedefi Sil',
        message: 'Bu ana hedefi silmek istediğinize emin misiniz? (Bağlı görev ve alışkanlıklar silinmez, sadece bağları kopar).',
        type: 'warning',
        showCancel: true,
        confirmText: 'Sil',
        onConfirm: () => {
            setGoalsRef(getGoalsRef().filter(g => String(g.id) !== String(id)));
            getTasksRef().forEach(t => { if(t.parentGoal === id) t.parentGoal = ""; });
            getHabitsRef().forEach(h => { 
                if(h.parentGoals) h.parentGoals = h.parentGoals.filter(gid => gid !== id);
            });
            saveTasks();
            saveHabits();
           
           getHabitsRef().forEach(h => { 
               if(h.parentGoals) h.parentGoals = h.parentGoals.filter(gid => gid !== id);
               //  edef silindiğinde bugünkü sahte kilit geçmişini temizler
               const todayStr = formatDateToString(new Date());
               if (h.history && h.history[todayStr]) {
                   delete h.history[todayStr];
               }
           });
          
            Store.goals.set(getGoalsRef());
            populateParentHabitSelects();
            renderGoals();
        }
    });
}

function generateAIAnalysis(goal, progress, totalTasks, completedTasks) {
    if (totalTasks === 0) {
        return `<i class="fa-solid fa-wand-magic-sparkles u-color-hfeca57-2" ></i> <strong>FocusAI Analizi:</strong> "${escapeHtml(goal.title)}" hedefine ulaşmak için henüz aksiyon planı yapmadın. Hemen yeni bir görev oluştur ve bu hedefe bağla. Unutma, planlanmamış bir hedef sadece bir dilektir!`;
    }
    if (progress === 0) {
        return `<i class="fa-solid fa-wand-magic-sparkles u-color-hfeca57-2" ></i> <strong>FocusAI Analizi:</strong> Adımlarını belirlemişsin ama henüz ilk harekete geçmemişsin. Başlamak bitirmenin yarısıdır. Nedenin: "${goal.desc ? escapeHtml(goal.desc) : 'Kendin için daha iyi bir gelecek.'}" Bunu hatırla ve bugün başla!`;
    }
    if (progress < 50) {
        return `<i class="fa-solid fa-wand-magic-sparkles u-color-h2ed573-2" ></i> <strong>FocusAI Analizi:</strong> İlerleme kaydediyorsun! Toplam ${totalTasks} adımın ${completedTasks} tanesini tamamladın. Sadece ivmeni kaybetme, damlaya damlaya göl olur.`;
    }
    if (progress < 100) {
        return `<i class="fa-solid fa-wand-magic-sparkles u-color-hff9f43-2" ></i> <strong>FocusAI Analizi:</strong> İnanılmaz gidiyorsun! %${progress} oranında tamamladın. "${escapeHtml(goal.title)}" vizyonun artık bir hayal değil, gerçeğe dönüşmek üzere. Odaklan ve bitir!`;
    }
    return `<i class="fa-solid fa-trophy u-color-hfeca57-2" ></i> <strong>FocusAI Analizi:</strong> TEBRİKLER! Bu vizyonu %100 tamamladın. Kendine verdiğin sözü tuttun. Şimdi bu başarıyı kutla ve kendine daha büyük zirveler belirle!`;
}
window.generateAIAnalysis = generateAIAnalysis;

// ============ HEDEF SEKMELERİ VE SIRALAMA MANTIĞI ============
let currentGoalFilter = 'active';

const goalTabBtns = document.querySelectorAll('.goal-tab-btn');
goalTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        goalTabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentGoalFilter = btn.getAttribute('data-goal-filter');
        renderGoals(); // Sekme değişince listeyi yenile
    });
});

const goalSortSelect = document.getElementById('goal-sort-select');
if (goalSortSelect) {
    goalSortSelect.addEventListener('change', () => {
        renderGoals(); // Menüden yeni sıralama seçilince listeyi yenile
    });
}

// renderGoals'ın "Zaferler/Süresi Dolanlar" arşiv kartını üretir — goal zaten
// _progress/_totalSteps gibi işlenmiş alanlarla geliyor (bkz. processedGoals).
function buildArchivedGoalCardEl(goal) {
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
function buildActiveGoalCardEl(goal) {
        let aiText = generateAIAnalysis(goal, goal._progress, goal._totalSteps, goal._completedSteps);

        const [y, m, d] = goal.deadline.split('-');
        const deadlineDisplay = `${d} ${monthNamesShort[parseInt(m)-1]} ${y}`;

        // --- 3. MADDE: Akıllı Tarih Hesaplaması (Urgency) ---
       const deadlineDate = new Date(y, m - 1, d);
       deadlineDate.setHours(23, 59, 59, 999);
       const today = new Date();
       const diffTime = deadlineDate - today;
       const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
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

// "Başarılarım/Süresi Dolanlar" sekmesinde hiç arşivlenmiş hedef yokken gösterilen
// boş durum — en yakın tamamlanmaya yaklaşan aktif hedefi de vurgular. Parametre
// gerekmiyor, getGoalsRef()/getTasksRef() üzerinden kendi verisini okuyor.
function buildEmptyArchiveStateHtml() {
    const activeGoals = getGoalsRef().filter(g => g.status !== 'completed' && g.status !== 'expired');
    let nearestGoalHTML = '';
    if (activeGoals.length > 0) {
        const bestGoal = activeGoals.reduce((prev, curr) => {
            const prevLinked = getTasksRef().filter(t => t.parentGoal === prev.id);
            const currLinked = getTasksRef().filter(t => t.parentGoal === curr.id);
            const prevPct = prevLinked.length === 0 ? 0 : Math.round((prevLinked.filter(t => t.completed).length / prevLinked.length) * 100);
            const currPct = currLinked.length === 0 ? 0 : Math.round((currLinked.filter(t => t.completed).length / currLinked.length) * 100);
            return currPct > prevPct ? curr : prev;
        });
        const linkedTasks = getTasksRef().filter(t => t.parentGoal === bestGoal.id);
        const pct = linkedTasks.length === 0 ? 0 : Math.round((linkedTasks.filter(t => t.completed).length / linkedTasks.length) * 100);
        nearestGoalHTML = `
        <div class="u-margin-top-24px_padding-16px20px_background-rgba108922310p">
            <div class="u-font-size-11px_font-weight-700_letter-spacing-1px_color-ha">En Yakın Başarı Adayı</div>
            <div class="u-font-size-15px_font-weight-600_color-hfff_margin-bottom-10">${escapeHtml(bestGoal.title)}</div>
            <div class="u-background-rgba2552552550p07_border-radius-8px_height-8px_">
                <div class="gc-empty-nearest-fill u-height-100pct_background-linear-gradient90degh6c5ce7ha29bf" data-pct="${pct}"></div>
            </div>
            <div class="u-color-var-text-muted_font-size-12px">%${pct} tamamlandı — devam et!</div>
        </div>`;
    }
    return `
    <div class="glass-element u-text-align-center_padding-50px28px40px_border-1pxdashedrgb" >
        <div class="u-font-size-64px_margin-bottom-12px_line-height-1_filter-dro">🏆</div>
        <h3 class="u-color-hfff_font-size-20px_font-weight-700_margin-bottom-8p">Henüz Bir Başarın Yok</h3>
        <p class="u-color-var-text-muted_font-size-14px_max-width-340px_margin">
            Tamamladığın hedefler burada arşivlenir. Bir hedefi %100 bitirdiğinde otomatik olarak buraya taşınır.
        </p>
        ${nearestGoalHTML}
       <button data-action="click-active-goal-tab" class="primary-btn u-margin-24pxauto0_justify-content-center_background-rgba254" >
            <i class="fa-solid fa-mountain-sun"></i> Aktif Hedeflerime Git
        </button>
    </div>`;
}

// Hedefleri render etmeden önce ilerleme yüzdelerini hesaplayıp sıralanmış bir
// dizi döner — saf veri işleme, DOM'a dokunmaz. Faz S devamı, dev fonksiyon
// refactoru: renderGoals'tan çıkarıldı.
function _prepareSortedGoals(sortType) {
let processedGoals = getGoalsRef().map(goal => {
    let linkedTasks = getTasksRef().filter(t => t.parentGoal === goal.id);
    let linkedHabits = getHabitsRef().filter(h => h.parentGoals && h.parentGoals.includes(goal.id));
    
    let totalSteps = linkedTasks.length;
    let completedSteps = linkedTasks.filter(t => t.completed).length;

    linkedHabits.forEach(h => {
        totalSteps += (h.targetDays || 21);
        completedSteps += Object.keys(h.history).length;
    });

    // Milestone katkısı
    if (goal.milestones && goal.milestones.length > 0) {
        totalSteps += goal.milestones.length;
        completedSteps += goal.milestones.filter(m => m.completed).length;
    }

    let progress = totalSteps === 0 ? 0 : Math.round((completedSteps / totalSteps) * 100);
    if (progress > 100) progress = 100;

    const milestoneTotal = goal.milestones ? goal.milestones.length : 0;
    const milestoneDone  = goal.milestones ? goal.milestones.filter(m => m.completed).length : 0;

    // Hesaplanan verileri (progress, adımlar) geçici objeye kaydediyoruz
    return {
        ...goal,
        _progress: progress,
        _totalSteps: totalSteps,
        _completedSteps: completedSteps,
        _linkedTasks: linkedTasks,
        _linkedHabits: linkedHabits,
        _milestoneTotal: milestoneTotal,
        _milestoneDone: milestoneDone,
    };
});

// --- SIRALAMA (SORT) İŞLEMİ ---
processedGoals.sort((a, b) => {
    if (sortType === 'deadline') {
        return new Date(a.deadline) - new Date(b.deadline); // Yakın tarih önce
    } else if (sortType === 'progress-high') {
        return b._progress - a._progress; // Yüksek yüzde önce
    } else if (sortType === 'progress-low') {
        return a._progress - b._progress; // Düşük yüzde önce
    } else {
        return (b.createdAt || 0) - (a.createdAt || 0); // En yeni eklenen önce
    }
});

    return processedGoals;
}

export function renderGoals() {
    if(!goalsContainer) return;
    goalsContainer.innerHTML = '';

    // Başarılarım veya Süresi Dolanlar sekmesindeyken özet banner göster
    if (currentGoalFilter === 'completed' || currentGoalFilter === 'expired') {
        const wonGoals = getGoalsRef().filter(g => g.status === 'completed');
        const expiredGoals = getGoalsRef().filter(g => g.status === 'expired');
        if (wonGoals.length > 0 || expiredGoals.length > 0) {
            const banner = document.createElement('div');
            banner.style.display = 'flex';
            banner.style.gap = '12px';
            banner.style.marginBottom = '16px';
            banner.style.flexWrap = 'wrap';
            banner.innerHTML = `
                <div class="u-flex-1_min-width-120px_background-rgba254202870p1_border-1">
                    <span class="u-font-size-24px">🏆</span>
                    <div><div class="u-font-size-22px_font-weight-800_color-hfeca57_line-height-1">${wonGoals.length}</div><div class="u-font-size-11px_color-var-text-muted_font-weight-600_text-t">Başarı</div></div>
                </div>
                <div class="u-flex-1_min-width-120px_background-rgba25571870p08_border-1">
                    <span class="u-font-size-24px">⏰</span>
                    <div><div class="u-font-size-22px_font-weight-800_color-hff4757_line-height-1">${expiredGoals.length}</div><div class="u-font-size-11px_color-var-text-muted_font-weight-600_text-t">Süre Doldu</div></div>
                </div>
                <div class="u-flex-1_min-width-120px_background-rgba108922310p08_border-">
                    <span class="u-font-size-24px">📊</span>
                    <div><div class="u-font-size-22px_font-weight-800_color-ha29bfe_line-height-1">${wonGoals.length + expiredGoals.length > 0 ? Math.round((wonGoals.length / (wonGoals.length + expiredGoals.length)) * 100) : 0}%</div><div class="u-font-size-11px_color-var-text-muted_font-weight-600_text-t">Başarı Oranı</div></div>
                </div>
            `;
            goalsContainer.appendChild(banner);
        }
    }

    // Sekme butonlarına sayı badge'i ekle (early return'dan ÖNCE yapılmalı)
    const wonCount = getGoalsRef().filter(g => g.status === 'completed').length;
    const expiredCount = getGoalsRef().filter(g => g.status === 'expired').length;
    const activeCount = getGoalsRef().filter(g => g.status !== 'completed' && g.status !== 'expired').length;
    const victoryTabBtn = document.querySelector('.goal-tab-btn[data-goal-filter="completed"]');
    const expiredTabBtn = document.querySelector('.goal-tab-btn[data-goal-filter="expired"]');
    const activeTabBtn = document.querySelector('.goal-tab-btn[data-goal-filter="active"]');
    if (victoryTabBtn) victoryTabBtn.innerHTML = `<i class="fa-solid fa-trophy u-color-hfeca57" ></i> Başarılarım${wonCount > 0 ? ` <span class="u-background-rgba254202870p2_color-hfeca57_padding-1px7px_bo">${wonCount}</span>` : ''}`;
    if (expiredTabBtn) expiredTabBtn.innerHTML = `⏳ Süresi Dolanlar${expiredCount > 0 ? ` <span class="u-background-rgba25571870p2_color-hff4757_padding-1px7px_bor">${expiredCount}</span>` : ''}`;
    if (activeTabBtn) activeTabBtn.innerHTML = `<i class="fa-solid fa-mountain-sun"></i> Aktif Hedefler${activeCount > 0 ? ` <span class="u-background-rgba108922310p2_color-ha29bfe_padding-1px7px_bo">${activeCount}</span>` : ''}`;

    // "+ Yeni Hedef" butonuna aktif/limit sayısını göster; limite ulaşınca soluklaştır
    if (btnOpenGoalModal) {
        const atLimit = activeCount >= MAX_ACTIVE_GOALS;
        btnOpenGoalModal.innerHTML = `<i class="fa-solid fa-plus"></i> Yeni Hedef <span class="u-opacity-p75_font-weight-500_font-size-12px">(${activeCount}/${MAX_ACTIVE_GOALS})</span>`;
        btnOpenGoalModal.style.opacity = atLimit ? '0.55' : '';
        btnOpenGoalModal.title = atLimit ? `Aynı anda en fazla ${MAX_ACTIVE_GOALS} aktif ana hedef belirleyebilirsin.` : '';
    }

    if(getGoalsRef().length === 0) {
        goalsContainer.innerHTML = `
        <div class="glass-element u-text-align-center_padding-50px20px_border-1pxdashedrgba108" >
            <i class="fa-solid fa-mountain u-font-size-48px_color-rgba108922310p5_margin-bottom-15px" ></i>
            <h3 class="u-color-hfff_margin-bottom-10px-2">Henüz Bir Hedefin Yok</h3>
            <p class="u-color-var-text-muted_font-size-14px_font-style-italic_marg">"Büyük yolculuklar tek bir adımla başlar..." <br><span class="u-font-size-12px_opacity-0p7_color-var-primary-color_font-we"><i class="fa-solid fa-wand-magic-sparkles"></i> FocusAI</span></p>
            <button data-action="open-goal-modal" class="primary-btn u-margin-0auto_justify-content-center" ><i class="fa-solid fa-plus"></i> İlk Hedefini Belirle</button>
        </div>`;
        return;
    };

    let displayedCount = 0;
    const sortType = goalSortSelect ? goalSortSelect.value : 'newest';
    const processedGoals = _prepareSortedGoals(sortType);

    processedGoals.forEach(goal => {
        // Filtre (Aktif/Başarılarım/Süresi Dolanlar) kontrolü - İlerleme %100 olsa bile durum completed veya expired olmadan arşiv sekmesine gitmez
        const isArchived = goal.status === 'completed' || goal.status === 'expired';
        if (currentGoalFilter === 'active' && isArchived) return;
        if (currentGoalFilter === 'completed' && goal.status !== 'completed') return;
        if (currentGoalFilter === 'expired' && goal.status !== 'expired') return;

        displayedCount++;

        // --- ZAFERLERİ ÖZEL KART RENDER ---
        if (isArchived) {
            goalsContainer.appendChild(buildArchivedGoalCardEl(goal));
            return;
        }

        goalsContainer.appendChild(buildActiveGoalCardEl(goal));
    });

    if (displayedCount === 0) {
        if (currentGoalFilter === 'active') {
            goalsContainer.innerHTML = `
            <div class="u-text-align-center_padding-48px20px_border-1pxdashedrgba255">
                <i class="fa-solid fa-mountain u-font-size-36px_color-rgba2552552550p15_margin-bottom-14px_" ></i>
                <p class="u-color-var-text-muted_font-size-14px_margin-bottom-18px">Henüz aktif hedefin yok.<br>Yeni bir hedef belirleyerek başla.</p>
                <button data-action="open-goal-modal" class="primary-btn u-margin-0auto_justify-content-center-2" ><i class="fa-solid fa-plus"></i> Hedef Belirle</button>
            </div>`;
        } else {
            goalsContainer.innerHTML = buildEmptyArchiveStateHtml();
            const _nearestFill = goalsContainer.querySelector('.gc-empty-nearest-fill');
            if (_nearestFill) _nearestFill.style.width = _nearestFill.dataset.pct + '%';
        }
    }
}
window.renderGoals = renderGoals;
