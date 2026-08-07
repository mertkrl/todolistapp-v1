// script-goal-modal.js dosyasından çıkarıldı — renderGoals'ın hazırlık/boş-
// durum yardımcıları. Sadece getGoalsRef()/getTasksRef()/getHabitsRef()
// (salt-okunur) üzerinden kendi verisini okuyan saf fonksiyonlar.
import { getGoalsRef, getTasksRef, getHabitsRef } from './script.js';

// "Başarılarım" sekmesinde hiç tamamlanmış hedef yokken gösterilen boş durum —
// kısa/motive edici bir cümle + doğrudan hedef oluşturmaya götüren buton
// (Aktif Hedefler sekmesindeki "İlk Hedefini Belirle" ile aynı aksiyon).
// Kullanıcı isteği (2026-08-06): önceki sürüm "en yakın başarı adayı" ilerleme
// çubuğu gösteriyordu, bunun yerine sade/kısa bir karşılama istendi.
export function buildEmptyCompletedStateHtml() {
    return `
    <div class="glass-element u-text-align-center_padding-50px28px40px_border-1pxdashedrgb" >
        <div class="u-font-size-64px_margin-bottom-12px_line-height-1_filter-dro">🏆</div>
        <h3 class="u-color-hfff_font-size-20px_font-weight-700_margin-bottom-8p">Henüz Başarın Yok</h3>
        <p class="u-color-var-text-muted_font-size-14px_max-width-340px_margin">
            Her büyük başarı bir hedef belirlemekle başlar. İlk adımını şimdi at!
        </p>
       <button data-action="open-goal-modal" class="primary-btn u-margin-24pxauto0_justify-content-center_background-rgba254" >
            <i class="fa-solid fa-plus"></i> İlk Hedefini Belirle
        </button>
    </div>`;
}

// "Süresi Dolanlar" sekmesinde hiç süresi dolmuş hedef yokken gösterilen boş
// durum — buildEmptyCompletedStateHtml ile aynı görsel dilde ama olumlu bir
// çerçeveden: bu listenin boş olması iyi bir haber, hedefler zamanında
// tamamlanıyor demektir.
export function buildEmptyExpiredStateHtml() {
    return `
    <div class="glass-element u-text-align-center_padding-50px28px40px_border-1pxdashedrgb" >
        <div class="u-font-size-64px_margin-bottom-12px_line-height-1_filter-dro">⏳</div>
        <h3 class="u-color-hfff_font-size-20px_font-weight-700_margin-bottom-8p">Süresi Dolan Hedefin Yok</h3>
        <p class="u-color-var-text-muted_font-size-14px_max-width-340px_margin">
            Bu, iyi bir haber: hedeflerin zamanında tamamlanıyor. Süresi dolan bir hedef olursa burada listelenir.
        </p>
       <button data-action="click-active-goal-tab" class="primary-btn u-margin-24pxauto0_justify-content-center_background-rgba254" >
            <i class="fa-solid fa-mountain-sun"></i> Aktif Hedeflerime Git
        </button>
    </div>`;
}

// Hedefleri render etmeden önce ilerleme yüzdelerini hesaplayıp sıralanmış bir
// dizi döner — saf veri işleme, DOM'a dokunmaz. Faz S devamı, dev fonksiyon
// refactoru: renderGoals'tan çıkarıldı.
export function _prepareSortedGoals(sortType) {
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
