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
// - goals → window.__getGoalsRef()/__setGoalsRef() (deleteGoal içinde
//   reassignment var — bu çıkarmada setter YENİ eklendi)
// - tasks/habits → window.__getTasksRef()/__getHabitsRef() (salt-okunur,
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

const MAX_ACTIVE_GOALS = 5;
const goalModal = document.getElementById('goal-modal');
const goalsContainer = document.getElementById('goals-container');
const btnOpenGoalModal = document.getElementById('btn-open-goal-modal');
const monthNamesShort = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

window.editGoalInfo = function() {
    const goalId = document.getElementById('detail-active-goal-id').value;
    const goal = window.__getGoalsRef().find(g => String(g.id) === String(goalId));
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
        const goal = window.__getGoalsRef().find(g => String(g.id) === String(goalId));
        if (goal) {
            goal.status = 'completed';
            goal.completedAt = Date.now();
            Store.goals.set(window.__getGoalsRef());
            if (window.FocusAISocial && typeof window.FocusAISocial.postActivity === 'function') {
                window.FocusAISocial.postActivity(`"${goal.title}" hedefini başarıyla tamamladı 🏆`);
            }
            renderGoals();
        }
        victoryModal.classList.add('hidden');
        document.getElementById('goal-details-modal').classList.add('hidden');
        if(typeof fireConfetti === 'function') fireConfetti();
        window.showPremiumModal({ title: 'Başarı Arşivlendi! 🏆', message: 'Tebrikler! Bu büyük başarı artık Başarılarım sekmesinde.', type: 'success' });
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
            window.showPremiumModal({ title: 'Hata', message: 'Lütfen hedefinizi yazın.', type: 'warning' });
            return;
        }

        if (idToEdit) {
            // Düzenleme Modu
            const goal = window.__getGoalsRef().find(g => String(g.id) === String(idToEdit));
            if (goal) {
                goal.title = title;
                goal.desc = desc;
                goal.deadline = deadline;
                if(categorySelect) goal.category = category; // Kategoriyi güncelle
                window.showPremiumModal({ title: 'Güncellendi!', message: 'Ana hedef başarıyla güncellendi.', type: 'success' });
            }
        } else {
            // Yeni Ekleme Modu
            const activeGoalCount = window.__getGoalsRef().filter(g => g.status !== 'completed' && g.status !== 'expired').length;
            if (activeGoalCount >= MAX_ACTIVE_GOALS) {
                window.showPremiumModal({
                    title: 'Odağını Koru 🎯',
                    message: `Aynı anda en fazla ${MAX_ACTIVE_GOALS} aktif ana hedef belirleyebilirsin. Yeni bir vizyon eklemeden önce mevcut hedeflerinden birini tamamla ya da arşivle.`,
                    type: 'warning'
                });
                return;
            }
            window.__getGoalsRef().push({
                id: window.generateId(),
                title: title,
                desc: desc,
                deadline: deadline,
                category: category, // Kategoriyi kaydet
                createdAt: Date.now()
            });

            if (window.FocusAISocial && typeof window.FocusAISocial.postActivity === 'function') {
               window.FocusAISocial.postActivity(`"${title}" adında yeni bir ana hedef belirledi 🎯`);
           }
            window.showPremiumModal({ title: 'Vizyon Belirlendi!', message: 'Harika bir hedef! Şimdi görev ve alışkanlıklarını bu hedefe bağlayabilirsin.', type: 'success' });
        }
        Store.goals.set(window.__getGoalsRef());
        window.populateParentHabitSelects();
        renderGoals();
        
        // YENİ DÜZELTME: Bir sonraki ana hedef oluşturulduğunda tarihin eski hedeften referans almasını engellemek için formları sıfırlıyoruz.
        document.getElementById('goal-title-input').value = '';
        document.getElementById('goal-desc-input').value = '';
        if (document.getElementById('goal-deadline-input')._flatpickr) {
            document.getElementById('goal-deadline-input')._flatpickr.setDate(new Date());
        } else {
            document.getElementById('goal-deadline-input').value = window.toInputDate(window.formatDateToString(new Date()));
        }

        closeGoalModal();
        
        // Eğer detay paneli arka planda o hedefe aitse ekranı canlandır
        if (idToEdit) {
            window.openGoalDetails(idToEdit);
        }
    }
}
// saveGoalBtn'in onclick="saveGoal()" HTML attribute'u zaten _saveGoalImpl'i çağırıyor.
// addEventListener ile ikinci kez bağlarsak çift tetiklenip form temizlendikten sonra
// boş başlık uyarısı gösterir. Bu yüzden addEventListener kullanmıyoruz.

window.deleteGoal = function(id) {
    window.showPremiumModal({
        title: 'Hedefi Sil',
        message: 'Bu ana hedefi silmek istediğinize emin misiniz? (Bağlı görev ve alışkanlıklar silinmez, sadece bağları kopar).',
        type: 'warning',
        showCancel: true,
        confirmText: 'Sil',
        onConfirm: () => {
            window.__setGoalsRef(window.__getGoalsRef().filter(g => String(g.id) !== String(id)));
            window.__getTasksRef().forEach(t => { if(t.parentGoal === id) t.parentGoal = ""; });
            window.__getHabitsRef().forEach(h => { 
                if(h.parentGoals) h.parentGoals = h.parentGoals.filter(gid => gid !== id);
            });
            window.saveTasks();
            window.saveHabits();
           
           window.__getHabitsRef().forEach(h => { 
               if(h.parentGoals) h.parentGoals = h.parentGoals.filter(gid => gid !== id);
               //  edef silindiğinde bugünkü sahte kilit geçmişini temizler
               const todayStr = window.formatDateToString(new Date());
               if (h.history && h.history[todayStr]) {
                   delete h.history[todayStr];
               }
           });
          
            Store.goals.set(window.__getGoalsRef());
            window.populateParentHabitSelects();
            renderGoals();
        }
    });
}

function generateAIAnalysis(goal, progress, totalTasks, completedTasks) {
    if (totalTasks === 0) {
        return `<i class="fa-solid fa-wand-magic-sparkles" style="color: #feca57;"></i> <strong>FocusAI Analizi:</strong> "${escapeHtml(goal.title)}" hedefine ulaşmak için henüz aksiyon planı yapmadın. Hemen yeni bir görev oluştur ve bu hedefe bağla. Unutma, planlanmamış bir hedef sadece bir dilektir!`;
    }
    if (progress === 0) {
        return `<i class="fa-solid fa-wand-magic-sparkles" style="color: #feca57;"></i> <strong>FocusAI Analizi:</strong> Adımlarını belirlemişsin ama henüz ilk harekete geçmemişsin. Başlamak bitirmenin yarısıdır. Nedenin: "${goal.desc ? escapeHtml(goal.desc) : 'Kendin için daha iyi bir gelecek.'}" Bunu hatırla ve bugün başla!`;
    }
    if (progress < 50) {
        return `<i class="fa-solid fa-wand-magic-sparkles" style="color: #2ed573;"></i> <strong>FocusAI Analizi:</strong> İlerleme kaydediyorsun! Toplam ${totalTasks} adımın ${completedTasks} tanesini tamamladın. Sadece ivmeni kaybetme, damlaya damlaya göl olur.`;
    }
    if (progress < 100) {
        return `<i class="fa-solid fa-wand-magic-sparkles" style="color: #ff9f43;"></i> <strong>FocusAI Analizi:</strong> İnanılmaz gidiyorsun! %${progress} oranında tamamladın. "${escapeHtml(goal.title)}" vizyonun artık bir hayal değil, gerçeğe dönüşmek üzere. Odaklan ve bitir!`;
    }
    return `<i class="fa-solid fa-trophy" style="color: #feca57;"></i> <strong>FocusAI Analizi:</strong> TEBRİKLER! Bu vizyonu %100 tamamladın. Kendine verdiğin sözü tuttun. Şimdi bu başarıyı kutla ve kendine daha büyük zirveler belirle!`;
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

export function renderGoals() {
    if(!goalsContainer) return;
    goalsContainer.innerHTML = '';

    // Başarılarım veya Süresi Dolanlar sekmesindeyken özet banner göster
    if (currentGoalFilter === 'completed' || currentGoalFilter === 'expired') {
        const wonGoals = window.__getGoalsRef().filter(g => g.status === 'completed');
        const expiredGoals = window.__getGoalsRef().filter(g => g.status === 'expired');
        if (wonGoals.length > 0 || expiredGoals.length > 0) {
            const banner = document.createElement('div');
            banner.style.cssText = 'display:flex; gap:12px; margin-bottom:16px; flex-wrap:wrap;';
            banner.innerHTML = `
                <div style="flex:1; min-width:120px; background: rgba(254,202,87,0.1); border: 1px solid rgba(254,202,87,0.25); border-radius:12px; padding:14px 18px; display:flex; align-items:center; gap:10px;">
                    <span style="font-size:24px;">🏆</span>
                    <div><div style="font-size:22px; font-weight:800; color:#feca57; line-height:1;">${wonGoals.length}</div><div style="font-size:11px; color:var(--text-muted); font-weight:600; text-transform:uppercase; letter-spacing:.5px;">Başarı</div></div>
                </div>
                <div style="flex:1; min-width:120px; background: rgba(255,71,87,0.08); border: 1px solid rgba(255,71,87,0.2); border-radius:12px; padding:14px 18px; display:flex; align-items:center; gap:10px;">
                    <span style="font-size:24px;">⏰</span>
                    <div><div style="font-size:22px; font-weight:800; color:#ff4757; line-height:1;">${expiredGoals.length}</div><div style="font-size:11px; color:var(--text-muted); font-weight:600; text-transform:uppercase; letter-spacing:.5px;">Süre Doldu</div></div>
                </div>
                <div style="flex:1; min-width:120px; background: rgba(108,92,231,0.08); border: 1px solid rgba(108,92,231,0.2); border-radius:12px; padding:14px 18px; display:flex; align-items:center; gap:10px;">
                    <span style="font-size:24px;">📊</span>
                    <div><div style="font-size:22px; font-weight:800; color:#a29bfe; line-height:1;">${wonGoals.length + expiredGoals.length > 0 ? Math.round((wonGoals.length / (wonGoals.length + expiredGoals.length)) * 100) : 0}%</div><div style="font-size:11px; color:var(--text-muted); font-weight:600; text-transform:uppercase; letter-spacing:.5px;">Başarı Oranı</div></div>
                </div>
            `;
            goalsContainer.appendChild(banner);
        }
    }

    // Sekme butonlarına sayı badge'i ekle (early return'dan ÖNCE yapılmalı)
    const wonCount = window.__getGoalsRef().filter(g => g.status === 'completed').length;
    const expiredCount = window.__getGoalsRef().filter(g => g.status === 'expired').length;
    const activeCount = window.__getGoalsRef().filter(g => g.status !== 'completed' && g.status !== 'expired').length;
    const victoryTabBtn = document.querySelector('.goal-tab-btn[data-goal-filter="completed"]');
    const expiredTabBtn = document.querySelector('.goal-tab-btn[data-goal-filter="expired"]');
    const activeTabBtn = document.querySelector('.goal-tab-btn[data-goal-filter="active"]');
    if (victoryTabBtn) victoryTabBtn.innerHTML = `<i class="fa-solid fa-trophy" style="color:#feca57;"></i> Başarılarım${wonCount > 0 ? ` <span style="background:rgba(254,202,87,0.2);color:#feca57;padding:1px 7px;border-radius:10px;font-size:11px;font-weight:700;margin-left:4px;">${wonCount}</span>` : ''}`;
    if (expiredTabBtn) expiredTabBtn.innerHTML = `⏳ Süresi Dolanlar${expiredCount > 0 ? ` <span style="background:rgba(255,71,87,0.2);color:#ff4757;padding:1px 7px;border-radius:10px;font-size:11px;font-weight:700;margin-left:4px;">${expiredCount}</span>` : ''}`;
    if (activeTabBtn) activeTabBtn.innerHTML = `<i class="fa-solid fa-mountain-sun"></i> Aktif Hedefler${activeCount > 0 ? ` <span style="background:rgba(108,92,231,0.2);color:#a29bfe;padding:1px 7px;border-radius:10px;font-size:11px;font-weight:700;margin-left:4px;">${activeCount}</span>` : ''}`;

    // "+ Yeni Hedef" butonuna aktif/limit sayısını göster; limite ulaşınca soluklaştır
    if (btnOpenGoalModal) {
        const atLimit = activeCount >= MAX_ACTIVE_GOALS;
        btnOpenGoalModal.innerHTML = `<i class="fa-solid fa-plus"></i> Yeni Hedef <span style="opacity:.75; font-weight:500; font-size:12px;">(${activeCount}/${MAX_ACTIVE_GOALS})</span>`;
        btnOpenGoalModal.style.opacity = atLimit ? '0.55' : '';
        btnOpenGoalModal.title = atLimit ? `Aynı anda en fazla ${MAX_ACTIVE_GOALS} aktif ana hedef belirleyebilirsin.` : '';
    }

    if(window.__getGoalsRef().length === 0) {
        goalsContainer.innerHTML = `
        <div class="glass-element" style="text-align: center; padding: 50px 20px; border: 1px dashed rgba(108, 92, 231, 0.3); background: rgba(0,0,0,0.2);">
            <i class="fa-solid fa-mountain" style="font-size: 48px; color: rgba(108, 92, 231, 0.5); margin-bottom: 15px;"></i>
            <h3 style="color: #fff; margin-bottom: 10px;">Henüz Bir Hedefin Yok</h3>
            <p style="color: var(--text-muted); font-size: 14px; font-style: italic; margin-bottom: 20px; line-height: 1.6;">"Büyük yolculuklar tek bir adımla başlar..." <br><span style="font-size:12px; opacity:0.7; color: var(--primary-color); font-weight: 600;"><i class="fa-solid fa-wand-magic-sparkles"></i> FocusAI</span></p>
            <button data-action="open-goal-modal" class="primary-btn" style="margin: 0 auto; justify-content: center;"><i class="fa-solid fa-plus"></i> İlk Hedefini Belirle</button>
        </div>`;
        return;
    };

    let displayedCount = 0;
    const sortType = goalSortSelect ? goalSortSelect.value : 'newest';

    // Hedefleri render etmeden önce ilerleme yüzdelerini hesaplayıp sıralamak için geçici bir dizi oluşturuyoruz
    let processedGoals = window.__getGoalsRef().map(goal => {
        let linkedTasks = window.__getTasksRef().filter(t => t.parentGoal === goal.id);
        let linkedHabits = window.__getHabitsRef().filter(h => h.parentGoals && h.parentGoals.includes(goal.id));
        
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

    processedGoals.forEach(goal => {
        // Filtre (Aktif/Başarılarım/Süresi Dolanlar) kontrolü - İlerleme %100 olsa bile durum completed veya expired olmadan arşiv sekmesine gitmez
        const isArchived = goal.status === 'completed' || goal.status === 'expired';
        if (currentGoalFilter === 'active' && isArchived) return;
        if (currentGoalFilter === 'completed' && goal.status !== 'completed') return;
        if (currentGoalFilter === 'expired' && goal.status !== 'expired') return;

        displayedCount++;

        // --- ZAFERLERİ ÖZEL KART RENDER ---
        if (isArchived) {
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
            const linkedTaskCount = window.__getTasksRef().filter(t => t.parentGoal === goal.id).length;
            const completedTaskCount = window.__getTasksRef().filter(t => t.parentGoal === goal.id && t.completed).length;
            const categoryLabel = goal.category ? goal.category.charAt(0).toUpperCase() + goal.category.slice(1).replace(/-/g, ' ') : '';

            const div = document.createElement('div');
            div.className = 'glass-element';
            div.dataset.id = goal.id;
            div.style.cssText = `border: 1px solid ${cardBorder}; background: ${cardBg}; border-radius: 16px; padding: 22px 24px; position: relative; overflow: hidden; cursor: default;`;
            div.innerHTML = `
                <div style="position: absolute; top: 0; right: 0; font-size: 90px; opacity: 0.06; line-height: 1; padding: 10px 14px; user-select: none;">${emoji}</div>
                <div style="display: flex; align-items: flex-start; gap: 16px; position: relative; z-index: 1;">
                    <div style="font-size: 36px; line-height: 1; filter: drop-shadow(0 2px 8px ${accentColor}66); flex-shrink: 0;">${emoji}</div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px;">
                            <span style="background: ${accentBg}; color: ${accentColor}; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; border: 1px solid ${accentColor}44;">
                                <i class="fa-solid ${statusIcon}" style="margin-right:4px;"></i>${statusLabel}
                            </span>
                            ${categoryLabel ? `<span style="background: rgba(108,92,231,0.12); color: #a29bfe; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; border: 1px solid rgba(108,92,231,0.25);">${categoryLabel}</span>` : ''}
                        </div>
                        <div style="font-size: 17px; font-weight: 700; color: #fff; margin-bottom: 4px; line-height: 1.3;">${escapeHtml(goal.title)}</div>
                        ${goal.desc ? `<div style="font-size: 12px; color: var(--text-muted); font-style: italic; margin-bottom: 10px;">"${escapeHtml(goal.desc)}"</div>` : ''}
                        <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px;">
                            <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-muted); background: rgba(255,255,255,0.04); padding: 5px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.07);">
                                <i class="fa-regular fa-calendar" style="color:${accentColor};"></i>
                                ${endDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </div>
                            <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-muted); background: rgba(255,255,255,0.04); padding: 5px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.07);">
                                <i class="fa-regular fa-clock" style="color:${accentColor};"></i>
                                ${durationText} sürdü
                            </div>
                            ${linkedTaskCount > 0 ? `<div style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-muted); background: rgba(255,255,255,0.04); padding: 5px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.07);">
                                <i class="fa-solid fa-list-check" style="color:${accentColor};"></i>
                                ${completedTaskCount}/${linkedTaskCount} görev
                            </div>` : ''}
                            <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: ${accentColor}; background: ${accentBg}; padding: 5px 12px; border-radius: 8px; border: 1px solid ${accentColor}33;">
                                <i class="fa-solid fa-chart-simple"></i> %${goal._progress}
                            </div>
                        </div>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:8px; flex-shrink:0;">
                        ${!isWon ? `<button class="control-btn" data-action="extend-goal-deadline" data-id="${goal.id}" title="Süreyi Uzat" style="white-space:nowrap; font-size:12px; font-weight:700; padding:7px 12px; border-radius:8px; background:rgba(255,159,67,0.12); border:1px solid rgba(255,159,67,0.35); color:#ff9f43; display:flex; align-items:center; gap:6px;">
                            <i class="fa-solid fa-calendar-plus"></i> Süreyi Uzat
                        </button>` : ''}
                        <button class="icon-btn delete-icon-btn goal-archive-del-btn" data-action="delete-goal" data-id="${goal.id}" title="Sil" style="opacity:0.4; transition:0.3s; align-self:flex-end; width:30px; height:30px; border-radius:8px; background:rgba(255,255,255,0.05); display:flex; justify-content:center; align-items:center;">
                            <i class="fa-solid fa-trash" style="font-size:12px;"></i>
                        </button>
                    </div>
                </div>
            `;
            goalsContainer.appendChild(div);
            return;
        }

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

           dateInfoHTML = `<div style="margin-top: 10px; display: inline-flex; align-items: center; gap: 8px; font-size: 12px; color: ${badgeColor}; background: ${badgeBg}; padding: 5px 12px; border-radius: 8px; border: 1px solid ${badgeBorder};"><i class="fa-regular ${badgeIcon}"></i> Başlangıç: ${startD.toLocaleDateString('tr-TR')} &nbsp;|&nbsp; ${badgeText}: ${endD.toLocaleDateString('tr-TR')}</div>`;
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
               <button class="gc-del-btn" data-action="delete-goal" data-id="${goal.id}" title="Sil"><i class="fa-solid fa-trash"></i></button>
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
               <div class="gc-progress-fill" style="width:${goal._progress}%; background:${progressColor};"></div>
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
        goalsContainer.appendChild(div);
    });

    if (displayedCount === 0) {
        if (currentGoalFilter === 'active') {
            goalsContainer.innerHTML = `
            <div style="text-align:center; padding:48px 20px; border: 1px dashed rgba(255,255,255,0.08); border-radius:12px;">
                <i class="fa-solid fa-mountain" style="font-size:36px; color:rgba(255,255,255,0.15); margin-bottom:14px; display:block;"></i>
                <p style="color:var(--text-muted); font-size:14px; margin-bottom:18px;">Henüz aktif hedefin yok.<br>Yeni bir hedef belirleyerek başla.</p>
                <button data-action="open-goal-modal" class="primary-btn" style="margin:0 auto; justify-content:center;"><i class="fa-solid fa-plus"></i> Hedef Belirle</button>
            </div>`;
        } else {
            // --- ZAFERLERİ YOK EMPTY STATE ---
            const activeGoals = window.__getGoalsRef().filter(g => g.status !== 'completed' && g.status !== 'expired');
            let nearestGoalHTML = '';
            if (activeGoals.length > 0) {
                const bestGoal = activeGoals.reduce((prev, curr) => {
                    const prevLinked = window.__getTasksRef().filter(t => t.parentGoal === prev.id);
                    const currLinked = window.__getTasksRef().filter(t => t.parentGoal === curr.id);
                    const prevPct = prevLinked.length === 0 ? 0 : Math.round((prevLinked.filter(t => t.completed).length / prevLinked.length) * 100);
                    const currPct = currLinked.length === 0 ? 0 : Math.round((currLinked.filter(t => t.completed).length / currLinked.length) * 100);
                    return currPct > prevPct ? curr : prev;
                });
                const linkedTasks = window.__getTasksRef().filter(t => t.parentGoal === bestGoal.id);
                const pct = linkedTasks.length === 0 ? 0 : Math.round((linkedTasks.filter(t => t.completed).length / linkedTasks.length) * 100);
                nearestGoalHTML = `
                <div style="margin-top: 24px; padding: 16px 20px; background: rgba(108,92,231,0.1); border: 1px solid rgba(108,92,231,0.25); border-radius: 14px; text-align: left;">
                    <div style="font-size: 11px; font-weight: 700; letter-spacing: 1px; color: #a29bfe; margin-bottom: 8px; text-transform: uppercase;">En Yakın Başarı Adayı</div>
                    <div style="font-size: 15px; font-weight: 600; color: #fff; margin-bottom: 10px;">${escapeHtml(bestGoal.title)}</div>
                    <div style="background: rgba(255,255,255,0.07); border-radius: 8px; height: 8px; overflow: hidden; margin-bottom: 6px;">
                        <div style="height: 100%; width: ${pct}%; background: linear-gradient(90deg, #6c5ce7, #a29bfe); border-radius: 8px; transition: width 0.5s;"></div>
                    </div>
                    <div style="font-size: 12px; color: var(--text-muted);">%${pct} tamamlandı — devam et!</div>
                </div>`;
            }
            goalsContainer.innerHTML = `
            <div class="glass-element" style="text-align: center; padding: 50px 28px 40px; border: 1px dashed rgba(254,202,87,0.3); background: linear-gradient(135deg, rgba(0,0,0,0.25), rgba(254,202,87,0.03));">
                <div style="font-size: 64px; margin-bottom: 12px; line-height: 1; filter: drop-shadow(0 4px 16px rgba(254,202,87,0.4));">🏆</div>
                <h3 style="color: #fff; font-size: 20px; font-weight: 700; margin-bottom: 8px;">Henüz Bir Başarın Yok</h3>
                <p style="color: var(--text-muted); font-size: 14px; max-width: 340px; margin: 0 auto; line-height: 1.6;">
                    Tamamladığın hedefler burada arşivlenir. Bir hedefi %100 bitirdiğinde otomatik olarak buraya taşınır.
                </p>
                ${nearestGoalHTML}
               <button data-action="click-active-goal-tab" class="primary-btn" style="margin: 24px auto 0; justify-content: center; background: rgba(254,202,87,0.15); border-color: rgba(254,202,87,0.4); color: #feca57;">
                    <i class="fa-solid fa-mountain-sun"></i> Aktif Hedeflerime Git
                </button>
            </div>`;
        }
    }
}
window.renderGoals = renderGoals;
