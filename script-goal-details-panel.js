import { getGoalsRef } from './state/goals-store.js';
import { getTasksRef } from './state/tasks-store.js';
import { setupGoalRewardUI } from './script-goal-reward-ui.js';
import { showPremiumModal } from './script-premium-modal.js';

export function openGoalDetails(goalId) {
    // 1. Hedefi Bul
    const goal = getGoalsRef().find(g => String(g.id) === String(goalId));
    if(!goal) return;

    // 2. Aktif hedef ID'sini gizli inputa yaz (Görev eklerken lazım olacak)
    document.getElementById('detail-active-goal-id').value = goal.id;

    // 3. Tepe Kısmı: Temel Bilgiler
    document.getElementById('detail-goal-title').innerHTML = `<i class="fa-solid fa-mountain-sun u-color-var-primary-color_margin-right-8px" ></i>${window.escapeHtml(goal.title)}`;

    if (goal.vision) {
        document.getElementById('detail-goal-desc').textContent = `"${goal.vision}"`;
    } else {
        document.getElementById('detail-goal-desc').textContent = `"Nedenini hatırlamayan yolunu kaybeder..."`;
    }

   // 4. İlerleme ve Kalan Gün
   const progress = goal._progress || 0;
   document.getElementById('detail-goal-progress-text').textContent = `%${progress}`;
   document.getElementById('detail-goal-progress-fill').style.width = `${progress}%`;

   if (goal.deadline) {
       let deadlineDate;
       // Eğer tarih d-m-Y (örn: 25-12-2026) formatındaysa parçala ve güvenli Date nesnesi yap
       if (goal.deadline.includes('-')) {
           const parts = goal.deadline.split('-');
           if (parts[0].length === 4) { // YYYY-MM-DD
               deadlineDate = new Date(parts[0], parts[1] - 1, parts[2]);
           } else { // d-m-Y
               deadlineDate = new Date(parts[2], parts[1] - 1, parts[0]);
           }
       } else {
           deadlineDate = new Date(goal.deadline);
       }

       // GERÇEK BUG DÜZELTMESİ (2026-08-06): deadlineDate gün sonuna
       // (23:59:59.999) sabitlenip today saatin o anki değeriyle
       // bırakılıyordu — bu yüzden bitiş tarihi TAM BUGÜN olsa bile
       // (örn. saat 14:00'te bakılırsa) fark hep bir tam güne
       // yuvarlanıyor (Math.ceil), "days===0 → Bugün son gün!" dalı asla
       // tetiklenmiyor, hep "1 gün kaldı" gösteriyordu. İki tarihi de gün
       // başına (00:00:00) sabitleyip Math.round kullanmak doğru gün
       // farkını veriyor — script-goal-details-sections.js'teki dönüm
       // noktası rozeti (satır ~317) zaten bu doğru deseni kullanıyor.
       deadlineDate.setHours(0, 0, 0, 0);
       const today = new Date();
       today.setHours(0, 0, 0, 0);
       const diff = deadlineDate - today;
       const days = Math.round(diff / (1000 * 60 * 60 * 24));

       if (days < 0) {
           document.getElementById('detail-goal-countdown').textContent = 'Süre bitti!';
       } else if (days === 0) {
           document.getElementById('detail-goal-countdown').textContent = 'Bugün son gün!';
       } else {
           document.getElementById('detail-goal-countdown').textContent = `${days} gün kaldı`;
       }
   } else {
       document.getElementById('detail-goal-countdown').textContent = 'Süresiz';
   }

   // 5. Hedef Ödülü (Kilitli Sistem)
   const rewardInput = document.getElementById('detail-goal-reward');
   const saveRewardBtn = document.getElementById('save-reward-btn');
   const editRewardBtn = document.getElementById('edit-reward-btn');

   // Dinamik olarak "Ödülü Sil" butonu var mı kontrol et, yoksa oluştur ve ekle
   let deleteRewardBtn = document.getElementById('delete-reward-btn');
   if (!deleteRewardBtn) {
       deleteRewardBtn = document.createElement('button');
       deleteRewardBtn.id = 'delete-reward-btn';
       deleteRewardBtn.className = 'icon-btn delete-icon-btn';
       deleteRewardBtn.title = 'Ödülü Kaldır';
       deleteRewardBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
       deleteRewardBtn.style.background = 'rgba(255, 71, 87, 0.1)';
       deleteRewardBtn.style.color = '#ff4757';
       deleteRewardBtn.style.padding = '6px 12px';
       deleteRewardBtn.style.fontSize = '12px';
       deleteRewardBtn.style.borderRadius = '6px';
       deleteRewardBtn.style.border = '1px solid rgba(255, 71, 87, 0.3)';
       deleteRewardBtn.style.cursor = 'pointer';
       deleteRewardBtn.style.display = 'none';
       deleteRewardBtn.style.alignItems = 'center';
       deleteRewardBtn.style.justifyContent = 'center';
       editRewardBtn.parentNode.appendChild(deleteRewardBtn);
   }

   rewardInput.value = goal.reward || '';

   // updateRewardUIState + save/edit/delete-reward onclick'leri
   // -> script-goal-reward-ui.js dosyasına taşındı.
   setupGoalRewardUI(goal, rewardInput, saveRewardBtn, editRewardBtn, deleteRewardBtn);

   // YENİ: Tamamla butonunu gizle/göster
   const manualBtn = document.getElementById('manual-complete-goal-btn');
   if (manualBtn) {
       const currentProgress = goal._progress || 0;
       if (goal.status === 'completed' || currentProgress === 100) {
           manualBtn.style.display = 'none';
       } else {
           manualBtn.style.display = 'inline-flex';
       }
   }

   // Tarih ve saat alanlarını bugüne/varsayılana sıfırla
   const detailDateInput = document.getElementById('detail-task-date');
   if(detailDateInput) detailDateInput.value = window.toInputDate(window.formatDateToString(new Date()));
   const detailTimeStart = document.getElementById('detail-task-time-start');
   const detailTimeEnd = document.getElementById('detail-task-time-end');
   if(detailTimeStart) detailTimeStart.value = '09:00';
   if(detailTimeEnd) detailTimeEnd.value = '10:00';


  // --- DÖNÜM NOKTASI (MILESTONE) TAKVİM SINIRLANDIRMASI ---
  const milestoneDateInput = document.getElementById('detail-new-milestone-date');
  const milestoneStartDateInput = document.getElementById('detail-new-milestone-start');

  if (milestoneDateInput || milestoneStartDateInput) {
      let goalStartDate = goal.createdAt ? new Date(goal.createdAt) : new Date();
      goalStartDate.setHours(0, 0, 0, 0);

      let goalEndDate = new Date();
      if (goal.deadline) {
          // Tarihi güvenli şekilde parse et
          const parts = goal.deadline.trim().split('-');
          if (parts.length === 3) {
              if (parts[0].length === 4) { // YYYY-MM-DD
                  goalEndDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
              } else { // d-m-Y
                  goalEndDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
              }
          }
      }
      goalEndDate.setHours(23, 59, 59, 999);

      // Mevcut dönüm noktası aralıklarını hesapla (görsel işaretleme)
      const existingMilestones = (goal.milestones || []).filter(m => m.date);
      // Bitiş tarihleri artık kilitlenmiyor — bitişik aralıklara (21-22, 22-23) izin verilir.
      // Çakışma kontrolü kaydetme aşamasında yapılır (katı < > ile).

      // Mevcut milestone aralıklarını renk paleti ile eşleştir
      const _msColors = ['#0984e3','#6c5ce7','#00b894','#e17055','#fdcb6e','#fd79a8'];
      const _msRangeData = existingMilestones.map((m, i) => {
          const toYMD = (d) => { if(!d) return ''; const p=d.split('-'); return p[0].length===4 ? d : `${p[2]}-${p[1]}-${p[0]}`; };
          return { start: toYMD(m.startDate || ''), end: toYMD(m.date), color: _msColors[i % _msColors.length], text: m.text };
      });

      // onDayCreate: takvim günlerine milestone rengi ekle
      const _onDayCreate = (dObj, dStr, fp, dayElem) => {
          const dayYMD = dStr; // flatpickr dateFormat Y-m-d zaten YYYY-MM-DD döner
          for (const range of _msRangeData) {
              if (!range.end) continue;
              const inRange = (range.start ? dayYMD >= range.start : true) && dayYMD <= range.end;
              if (inRange) {
                  const isEnd = dayYMD === range.end;
                  const isStart = range.start && dayYMD === range.start;
                  dayElem.style.background = `${range.color}22`;
                  dayElem.style.borderRadius = '6px';
                  // Başlangıç ve bitiş günleri daha belirgin
                  if (isStart || isEnd) {
                      dayElem.style.background = `${range.color}55`;
                      dayElem.style.border = `1px solid ${range.color}`;
                  }
                  // Kilit ikonu (bitiş günü disabled ise)
                  if (isEnd) {
                      const dot = document.createElement('span');
                      dot.style.display = 'block';
                      dot.style.width = '5px';
                      dot.style.height = '5px';
                      dot.style.borderRadius = '50%';
                      dot.style.background = range.color;
                      dot.style.margin = '1px auto 0';
                      dot.style.position = 'absolute';
                      dot.style.bottom = '2px';
                      dot.style.left = '50%';
                      dot.style.transform = 'translateX(-50%)';
                      dayElem.style.position = 'relative';
                      dayElem.appendChild(dot);
                  }
                  dayElem.title = `🚩 ${range.text}`;
                  break;
              }
          }
      };

      // Başlangıç Tarihi Seçici Yapılandırması
      if (milestoneStartDateInput) {
          flatpickr(milestoneStartDateInput, {
              locale: "tr",
              altInput: true,
              altFormat: "d-m-Y",
              dateFormat: "Y-m-d",
              minDate: goalStartDate,
              maxDate: goalEndDate,
              disableMobile: "true",
              onDayCreate: _onDayCreate
          });
      }

      // Bitiş Tarihi Seçici Yapılandırması
      if (milestoneDateInput) {
          flatpickr(milestoneDateInput, {
              locale: "tr",
              altInput: true,
              altFormat: "d-m-Y",
              dateFormat: "Y-m-d",
              minDate: goalStartDate,
              maxDate: goalEndDate,
              disableMobile: "true",
              onDayCreate: _onDayCreate
          });
      }
  }
   // --------------------------------------------------------



   // 6. Modalı Aç
   document.getElementById('goal-details-modal').classList.remove('hidden');

    updateGoalDetailsUI(goalId);
}

window.openGoalDetails = openGoalDetails;

// Hedef Detay Panelini günceller — 4 alt-bölümü (Aksiyon Planı/Alışkanlıklar/
// Milestones/İstatistikler) sırayla render eder. Faz S devamı, dev fonksiyon
// refactoru: eskiden bu 4 bölüm tek ~400 satırlık fonksiyondaydı.
export function updateGoalDetailsUI(goalId) {
    const goal = getGoalsRef().find(g => String(g.id) === String(goalId));
    if(!goal) return;

    const actionPlan = window.__gdRenderActionPlanSection(goalId, goal);
    if (!actionPlan) return; // detail-task-list DOM'da yok (bkz. _gdRenderActionPlanSection notu)
    const { linkedTasks, completedTaskCount } = actionPlan;

    const { completedHabitSteps, totalHabitTarget } = window.__gdRenderHabitsSection(goalId);
    window.__gdRenderMilestonesSection(goal);
    window.__gdUpdateStatsAndCelebration(goalId, goal, linkedTasks, completedTaskCount, completedHabitSteps, totalHabitTarget);
}

window.updateGoalDetailsUI = updateGoalDetailsUI;

export function checkGoalSynergy(goalId) {
    if(!goalId) return;
    const goal = getGoalsRef().find(g => String(g.id) === String(goalId));
    if(!goal || goal.status === 'completed') return;

    const linkedTasks = getTasksRef().filter(t => String(t.parentGoal) === String(goalId));
    if(linkedTasks.length > 0) {
        const completedCount = linkedTasks.filter(t => t.completed).length;
        const newProgress = Math.round((completedCount / linkedTasks.length) * 100);

        if(goal._progress !== newProgress) {
            goal._progress = newProgress;
            goal._completedSteps = completedCount;
            goal._totalSteps = linkedTasks.length;

            window.Store.getGoalsRef().set(getGoalsRef());

            if(newProgress === 100) {
                // Görevler %100 oldu diye konfeti patlatıp motive edelim
                if(typeof window.fireConfetti === 'function') window.fireConfetti();

                window.renderGoals();

                // Kullanıcıyı bilgilendiriyoruz ama hedefi asla otomatik olarak tamamlayıp arşive ATMIYORUZ.
                showPremiumModal({
                    title: 'Mevcut Adımlar Tamamlandı! 🚀',
                    message: `Harika! "${window.escapeHtml(goal.title)}" hedefine bağladığın tüm görevleri bitirdin. Bu vizyonu büyütmek için yeni görevler ekleyebilir veya hazır hissettiğinde hedefi tamamlayıp zaferini ilan edebilirsin!`,
                    type: 'success'
                });
            } else {
                window.renderGoals();
            }
        }
    }
}

window.checkGoalSynergy = checkGoalSynergy;
