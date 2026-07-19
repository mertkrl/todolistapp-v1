// ============================================================
// FOCUSAI SCRIPT-GOAL-ARCHIVER.JS
// script.js'ten çıkarılmış: "OTOMATİK ZAMANLAYICI ARŞİV KONTROLÜ MOTORU".
// Sistemdeki tüm hedefleri periyodik tarar; süresi dolduğunda ilerleme
// durumuna göre (tamamlanmışsa 'completed', değilse 'expired') otomatik
// arşivler. Sayfa açılışında bir kez ve ardından her dakika çalışır.
// script.js'in window'a koyduğu ince sarmalayıcıları (__getGoalsRef,
// __getTasksRef, Store, renderGoals) kullanır.
// script.js'ten SONRA, orijinal DOMContentLoaded zamanlamasını korumak
// için kendi DOMContentLoaded sarmalayıcısında yüklenir.
// ============================================================
(function () {
'use strict';
document.addEventListener('DOMContentLoaded', () => {

    // --- OTOMATİK ZAMANLAYICI ARŞİV KONTROLÜ MOTORU ---
    // Bu fonksiyon sistemdeki tüm hedefleri tarar; süre dolduğunda başarı durumuna göre arşive kaldırır, ilerleme %100 olsa bile süresi dolana kadar kontrolü kullanıcıda bırakır.
    function runAutomaticGoalArchiver() {
        const goals = window.__getGoalsRef();
        const tasks = window.__getTasksRef();
        const today = new Date();
        let goalsUpdated = false;

        goals.forEach(goal => {
            // Eğer hedef zaten elle veya sistemce arşivlenmiş/tamamlanmışsa atla
            if (goal.status === 'completed' || goal.status === 'expired') return;

            // Tarih formatını güvenli parçala (d-m-Y veya YYYY-MM-DD uyumlu)
            let deadlineDate;
            if (goal.deadline && goal.deadline.includes('-')) {
                const parts = goal.deadline.split('-');
                if (parts[0].length === 4) { // YYYY-MM-DD
                    deadlineDate = new Date(parts[0], parts[1] - 1, parts[2]);
                } else { // d-m-Y
                    deadlineDate = new Date(parts[2], parts[1] - 1, parts[0]);
                }
            }

            if (!deadlineDate) return;
            deadlineDate.setHours(23, 59, 59, 999);

            // Eğer süresi dolmuşsa sisteme müdahale et
            if (today > deadlineDate) {
                // Hedef ilerlemesini hesapla
                let linkedTasks = tasks.filter(t => t.parentGoal === goal.id);
                let totalSteps = linkedTasks.length;
                let completedSteps = linkedTasks.filter(t => t.completed).length;

                let progress = totalSteps === 0 ? 0 : Math.round((completedSteps / totalSteps) * 100);

                if (progress >= 100) {
                    goal.status = 'completed'; // Başarılı Arşiv
                    goal.completedAt = Date.now();
                } else {
                    goal.status = 'expired'; // Süresi Doldu Olarak Arşivle
                    goal.completedAt = Date.now();
                }
                goalsUpdated = true;
            }
        });

        if (goalsUpdated) {
            window.Store.goals.set(goals);
            if (typeof window.renderGoals === 'function') window.renderGoals();
        }
    }
    // Her dakika arka planda zamanı kontrol etmesi için tetikleyici
    setInterval(runAutomaticGoalArchiver, 60000);
    // Sayfa ilk açıldığında da bir kez çalıştır
    setTimeout(runAutomaticGoalArchiver, 1000);

});
})();
