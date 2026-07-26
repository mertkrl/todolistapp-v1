// script-habit-sync.js
// script.js'ten çıkarıldı (Faz 6): alışkanlık-görev senkron aksiyonları —
// changeHabitDailyGoal, checkHabitMilestones, toggleHabitFromToday,
// getTodayTasksForFocus, markHabitCompleteForDate, addBuddyHabitLocal,
// convertBuddyHabitToSolo, deleteHabitById. Tümü zaten `window.X = function`
// deseniyle tanımlıydı (kendiliğinden dışa açık), sadece checkHabitMilestones
// ve toggleHabitFromToday'in DIŞ çağrı noktaları köprülenmesi gerekti.
//
// Köprüler:
//  - window.__getHabitsRef()/__getTasksRef(): script.js'te zaten vardı.
//  - window.__getRenderBuddyHabitsRef/__getRenderCalendarRef/__getRenderEventsRef/
//    __getRenderHabitsRef: script.js'te bu çıkarma için yeni eklendi (satır
//    ~305 civarındaki ref değişkenleri için, script-timer.js'teki
//    __getRenderStatisticsRef ile aynı desen).
//  - window.saveHabits/renderHabits/renderTasks: script.js'te zaten vardı.

     window.changeHabitDailyGoal = function(habitId, dateStr, goalId) {
         const habit = window.__getHabitsRef().find(h => String(h.id) === String(habitId));
         if (habit) {
             if (!habit.dailyGoals) habit.dailyGoals = {};
             habit.dailyGoals[dateStr] = goalId;
             window.saveHabits();
             renderGoals(); // <-- Bu satırın eklendiğinden emin ol
         }
     };
 
     // Bir alışkanlık %25 / %50 / %75 / %100 hedef gününe ulaştığında, o eşiği
     // ilk geçtiği anda aktivite akışına ayrı bir kayıt düşer (her eşik bir kez).
     function checkHabitMilestones(habit, oldCount, newCount) {
         if (!window.FocusAISocial || typeof window.FocusAISocial.postActivity !== 'function') return;
         const target = habit.targetDays || 21;
         if (target <= 0) return;
         [25, 50, 75, 100].forEach(milestone => {
             const oldPct = (oldCount / target) * 100;
             const newPct = (newCount / target) * 100;
             if (oldPct < milestone && newPct >= milestone) {
                 if (milestone === 100) {
                     window.FocusAISocial.postActivity(`"${habit.name}" alışkanlığını %100 tamamladı, hedefe ulaştı! 🏆`);
                 } else {
                     window.FocusAISocial.postActivity(`"${habit.name}" alışkanlığında %${milestone}'e ulaştı 🔥`);
                 }
             }
         });
     }

     window.toggleHabitFromToday = function(habitId, dateStr) {
         const habit = window.__getHabitsRef().find(h => String(h.id) === String(habitId));
         if (habit) {
             const willComplete = !habit.history[dateStr];
             const oldCount = Object.keys(habit.history).length;

             if (willComplete) {
                 habit.history[dateStr] = true;
             } else {
                 delete habit.history[dateStr];
             }

             // --- SİNERJİ: Alışkanlığa bağlı BUGÜNKÜ Görevleri de otomatik tamamla/kaldır ---
             window.__getTasksRef().forEach(t => {
                 if (String(t.parentHabit) === String(habitId) && t.date === dateStr) {
                     t.completed = willComplete;
                 }
             });

             window.saveHabits();
             saveTasks();
             window.renderTasks();

             if(typeof window.__getRenderHabitsRef() === 'function') window.__getRenderHabitsRef()();
             if(typeof window.__getRenderCalendarRef() === 'function') window.__getRenderCalendarRef()();
             if(typeof window.__getRenderEventsRef() === 'function') window.__getRenderEventsRef()();
             if(typeof renderGoals === 'function') renderGoals();
             // Hedef detay modalı açıksa ilerlemeyi anında güncelle
             const detailModal = document.getElementById('goal-details-modal');
             const detailGoalId = document.getElementById('detail-active-goal-id');
             if (detailModal && !detailModal.classList.contains('hidden') && detailGoalId && detailGoalId.value) {
                 if(typeof updateGoalDetailsUI === 'function') updateGoalDetailsUI(detailGoalId.value);
             }

             if (willComplete && window.FocusAISocial && typeof window.FocusAISocial.postActivity === 'function') {
                 window.FocusAISocial.postActivity(`"${habit.name}" alışkanlığını tamamladı 🔥`);
                 checkHabitMilestones(habit, oldCount, oldCount + 1);
             }
         }
     }
 
     // Ortak odaklanma odası (social.js) bugünün görevlerini listeleyip kullanıcıya
     // "hangi göreve odaklanacaksın?" seçeneği sunabilsin diye basit bir global erişim sağlar.
     window.getTodayTasksForFocus = function() {
         try {
             const todayStr = window.formatDateToString(new Date());
             return window.__getTasksRef()
                 .filter(t => t.date === todayStr && !t.completed && !t.isLessonPlanDraft)
                 .map(t => ({ id: t.id, text: t.text }));
         } catch (e) {
             return [];
         }
     };

     // Ortak alışkanlık (buddy habit) entegrasyonu için social.js'in çağırdığı global yardımcılar.
     // Bir günü "tamamlandı" olarak işaretler — zaten tamamlanmışsa dokunmaz (idempotent, toggle değildir).
     window.markHabitCompleteForDate = function(habitId, dateStr) {
         const habit = window.__getHabitsRef().find(h => String(h.id) === String(habitId));
         if (!habit || habit.history[dateStr]) return false;

         const oldCount = Object.keys(habit.history).length;
         habit.history[dateStr] = true;
         window.__getTasksRef().forEach(t => {
             if (String(t.parentHabit) === String(habitId) && t.date === dateStr) t.completed = true;
         });

         checkHabitMilestones(habit, oldCount, oldCount + 1);

         window.saveHabits();
         saveTasks();
         window.renderTasks();
         if(typeof window.__getRenderHabitsRef() === 'function') window.__getRenderHabitsRef()();
         if(typeof window.__getRenderCalendarRef() === 'function') window.__getRenderCalendarRef()();
         if(typeof window.__getRenderEventsRef() === 'function') window.__getRenderEventsRef()();
         if(typeof renderGoals === 'function') renderGoals();
         if(typeof window.__getRenderBuddyHabitsRef() === 'function') window.__getRenderBuddyHabitsRef()();
         return true;
     };

     // Davet kabul edildiğinde / partner kabul ettiğinde ortak alışkanlığı yerel listeye ekler.
     window.addBuddyHabitLocal = function(habitData) {
         if (window.__getHabitsRef().some(h => String(h.id) === String(habitData.id))) return false;
         window.__getHabitsRef().push({
             id: habitData.id,
             name: habitData.name,
             icon: habitData.icon || 'fa-repeat',
             targetDays: habitData.targetDays || 21,
             category: habitData.category || 'genel',
             startDate: habitData.startDate || window.formatDateToString(new Date()),
             buddy: habitData.buddy,
             pairId: habitData.pairId,
             parentGoals: habitData.parentGoals || [],
             history: {}
         });
         window.saveHabits(); window.renderHabits(); window.renderTasks();
         if(window.__getRenderCalendarRef()) window.__getRenderCalendarRef()();
         if(window.__getRenderEventsRef()) window.__getRenderEventsRef()();
         if(window.__getRenderBuddyHabitsRef() && document.getElementById('arkadaslar').classList.contains('active')) window.__getRenderBuddyHabitsRef()();
         return true;
     };

     // Ortak alışkanlığı solo'ya çevir (buddy/pairId'yi kaldır)
     window.convertBuddyHabitToSolo = function(habitId) {
         const h = window.__getHabitsRef().find(h => String(h.id) === String(habitId));
         if (!h) return;
         h.buddy = null;
         h.pairId = null;
         window.saveHabits();
         if (typeof renderHabits === 'function') window.renderHabits();
         if (typeof window.__getRenderBuddyHabitsRef() === 'function') window.__getRenderBuddyHabitsRef()();
         // Supabase'den de sil (artık buddy değil)
         if (window.FocusSupabase && window.currentUser?.id) {
             window.FocusSupabase.from('buddy_habits').delete().eq('id', String(habitId)).then(() => {});
         }
     };

     // Alışkanlığı id'ye göre tamamen sil
     window.deleteHabitById = function(habitId) {
         const idx = window.__getHabitsRef().findIndex(h => String(h.id) === String(habitId));
         if (idx === -1) return;
         window.__getHabitsRef().splice(idx, 1);
         window.saveHabits();
         if (typeof renderHabits === 'function') window.renderHabits();
         if (typeof renderGoals === 'function') renderGoals();
         if (typeof window.__getRenderBuddyHabitsRef() === 'function') window.__getRenderBuddyHabitsRef()();
         if (window.FocusSupabase && window.currentUser?.id) {
             window.FocusSupabase.from('buddy_habits').delete().eq('id', String(habitId)).then(() => {});
         }
     };


export function toggleHabitFromToday(...args) { return window.toggleHabitFromToday(...args); }
