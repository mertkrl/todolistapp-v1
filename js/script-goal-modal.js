// ─── ANA HEDEFLER (GOALS) MODALI + YAPAY ZEKA ANALİZİ ──────────────────
// script.js dosyasından çıkarıldı (Faz 2, 2026-07-20). Hedef düzenleme
// (editGoalInfo), kaydetme (_saveGoalImpl), silme (deleteGoal — bağlı
// task/habit referanslarını da temizler), "Zafer Modalı" (hedef tamamlanınca
// arşivleme), FocusAI metin analizi (generateAIAnalysis), sekme/sıralama ve
// ana render fonksiyonu (renderGoals).
//
// openGoalModal/closeGoalModal BİLİNÇLİ OLARAK script.js'te bırakıldı — ama
// GERÇEK BUG BULUNDU (2026-08-06): bare closeGoalModal() çağrısının window
// fallthrough ile inline-goal-modal-globals.js'in fonksiyonuna çözüleceği
// varsayımı artık YANLIŞ. planning-goal-crud.js (Planlama'nın KENDİ hedef
// modalı, #pg-goal-modal) `window.closeGoalModal = closeGoalModal;` ile AYNI
// global ismi ele geçiriyor ve #goal-modal yerine #pg-goal-modal'ı gizliyor —
// yani "Yeni Hedef" modalı "Oluştur"a basınca hiç kapanmıyordu. Bu yüzden
// _saveGoalImpl artık kendi modalını DOĞRUDAN DOM'dan kapatıyor, isim
// çakışmasına bağımlı kalmıyor.
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

import { getGoalsRef, setGoalsRef, getHabitsRef, getTasksRef, openGoalDetails, saveTasks, saveHabits, getMindDumpsRef, setMindDumpsRef } from './script.js';
import { showPremiumModal } from './script-premium-modal.js';
import { populateParentHabitSelects } from './script-populate-parent-selects.js';
import { generateId } from './storage-manager.js';
import { toInputDate, formatDateToString } from './script-date-time-utils.js';
import { generateAIAnalysis } from './script-goal-modal-analysis.js';
import { buildArchivedGoalCardEl, buildActiveGoalCardEl } from './script-goal-modal-cards.js';
import { buildEmptyCompletedStateHtml, buildEmptyExpiredStateHtml, _prepareSortedGoals } from './script-goal-modal-list-utils.js';
import { saveMindDumps, renderMindDumps } from './script-mind-dump.js';

const MAX_ACTIVE_GOALS = 5;
const goalModal = document.getElementById('goal-modal');
const goalsContainer = document.getElementById('goals-container');
const btnOpenGoalModal = document.getElementById('btn-open-goal-modal');

window.editGoalInfo = function() {
    const goalId = document.getElementById('detail-active-goal-id').value;
    const goal = getGoalsRef().find(g => String(g.id) === String(goalId));
    if(!goal) return;

    document.getElementById('edit-goal-id').value = goal.id;
    document.getElementById('goal-title-input').value = goal.title;
    document.getElementById('goal-desc-input').value = goal.desc || '';
    // GERÇEK BUG DÜZELTMESİ (2026-08-06): #goal-deadline-input flatpickr'a
    // bağlı (native değil) — ham .value = "..." ataması flatpickr'ın kendi
    // görünür proxy input'unu ve internal selectedDates'ini GÜNCELLEMİYOR,
    // sadece arkadaki gizli input'u değiştiriyor. Sonuç: "Düzenle" tıklanınca
    // kullanıcı hep bugünün tarihini görüyordu (flatpickr'ın son bildiği
    // tarih), gerçek bitiş tarihini değil — ve fark etmeden "Oluştur"a
    // basarsa hedefin bitiş tarihi sessizce BUGÜNE değişiyordu. Diğer
    // flatpickr alanlarında (script-habit-modal-dates.js, script-convert-
    // modal.js) zaten kullanılan window._setFlatpickrDate ile düzeltildi.
    const deadlineInput = document.getElementById('goal-deadline-input');
    if (goal.deadline) {
        const [dy, dm, dd] = goal.deadline.split('-').map(Number);
        // deadline hem "YYYY-MM-DD" hem eski "DD-MM-YYYY" olarak kaydedilmiş
        // olabilir (bkz. script-goal-details-panel.js'teki aynı format
        // toleransı) — hangi parça 4 haneli yıl ise ona göre ayrıştır.
        const date = String(dy).length === 4 ? new Date(dy, dm - 1, dd) : new Date(dd, dm - 1, dy);
        window._setFlatpickrDate(deadlineInput, date);
    } else {
        window._setFlatpickrDate(deadlineInput, new Date());
    }

    // GERÇEK BUG DÜZELTMESİ (2026-08-06): modal başlığı/kaydet butonu hep
    // sabit "Yeni Hedef"/"Oluştur" gösteriyordu — kullanıcı mevcut bir
    // hedefi düzenlediğini fark etmiyordu (yeni hedef oluşturuyor izlenimi
    // veriyordu, işlevsel olarak _saveGoalImpl edit-goal-id'ye bakıp doğru
    // güncelliyordu ama arayüz yanıltıcıydı). openGoalModal() (script-goal-
    // modal-open-close.js) yeni hedef akışında bunu tekrar varsayılana
    // döndürüyor.
    const modalTitleEl = document.getElementById('goal-modal-title');
    if (modalTitleEl) modalTitleEl.textContent = 'Hedefi Düzenle';
    const saveBtnEl = document.getElementById('save-goal-btn');
    if (saveBtnEl) saveBtnEl.innerHTML = '<i class="fa-solid fa-check"></i> Kaydet';

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

            // Zihin Çöplüğü'nden "Detaylı Hedef Formunu Aç" ile gelindiyse ve
            // hedef GERÇEKTEN kaydedildiyse, kaynak fikri şimdi sil (bkz.
            // script-convert-modal.js — önceden form açılır açılmaz siliniyordu,
            // kullanıcı iptal ederse fikir kayboluyordu).
            if (window.__pendingDumpConversionId) {
                const pendingId = window.__pendingDumpConversionId;
                window.__pendingDumpConversionId = null;
                setMindDumpsRef(getMindDumpsRef().filter(d => String(d.id) !== String(pendingId)));
                saveMindDumps();
                renderMindDumps();

                // GERÇEK BUG DÜZELTMESİ: script-convert-modal.js'teki görev/alışkanlık
                // dönüşüm yolu "mind_dump_conversions" günlüğüne yazıyordu (İstatistikler'deki
                // "Fikir Dönüşüm Oranı" bunu okuyor), ama bu ana-hedef yolu hiç yazmıyordu —
                // Ana Hedef'e dönüştürülen fikirler istatistikte sessizce sayılmıyordu.
                const conversionLog = FocusStorage.get('mind_dump_conversions', []);
                conversionLog.push({ id: pendingId, date: formatDateToString(new Date()) });
                FocusStorage.set('mind_dump_conversions', conversionLog);
            }
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

        document.getElementById('goal-modal')?.classList.add('hidden');

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

// generateAIAnalysis → script-goal-modal-analysis.js
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

// buildArchivedGoalCardEl/buildActiveGoalCardEl → script-goal-modal-cards.js
// buildEmptyCompletedStateHtml/_prepareSortedGoals → script-goal-modal-list-utils.js

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
        // Hiç hedef yokken: Başarılarım sekmesi kendi kısa/motive edici mesajını
        // gösterir; Aktif Hedefler VE Süresi Dolanlar (hiç hedef yoksa gösterecek
        // özel bir şeyi olmadığı için) aynı genel "Henüz Bir Hedefin Yok" mesajını
        // paylaşır — kullanıcı isteği (2026-08-06).
        if (currentGoalFilter === 'completed') {
            goalsContainer.innerHTML = buildEmptyCompletedStateHtml();
        } else if (currentGoalFilter === 'expired') {
            goalsContainer.innerHTML = buildEmptyExpiredStateHtml();
        } else {
            goalsContainer.innerHTML = `
            <div class="glass-element u-text-align-center_padding-50px20px_border-1pxdashedrgba108" >
                <i class="fa-solid fa-mountain u-font-size-48px_color-rgba108922310p5_margin-bottom-15px" ></i>
                <h3 class="u-color-hfff_margin-bottom-10px-2">Henüz Bir Hedefin Yok</h3>
                <p class="u-color-var-text-muted_font-size-14px_font-style-italic_marg">"Büyük yolculuklar tek bir adımla başlar..." <br><span class="u-font-size-12px_opacity-0p7_color-var-primary-color_font-we"><i class="fa-solid fa-wand-magic-sparkles"></i> FocusAI</span></p>
                <button data-action="open-goal-modal" class="primary-btn u-margin-0auto_justify-content-center" ><i class="fa-solid fa-plus"></i> İlk Hedefini Belirle</button>
            </div>`;
        }
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
        // Başarılarım/Süresi Dolanlar boşken, elimizde en az bir AKTİF hedef
        // varsa "ilk hedefini belirle"/"iyi haber" kartı yerine o aktif
        // hedef(ler)i motive edici bir başlıkla göster — kullanıcı isteği
        // (2026-08-06): "mevcut ana hedef gözüksün, başarmaya şu kadar kaldı
        // tarzında motivasyon versin". Aktif Hedefler'deki AYNI kartı
        // (buildActiveGoalCardEl — ilerleme çubuğu + FocusAI motivasyon
        // metni + süre rozeti zaten içeriyor) yeniden kullanıyoruz.
        const activeGoalsForMotivation = processedGoals.filter(g => g.status !== 'completed' && g.status !== 'expired');

        if (currentGoalFilter === 'active') {
            goalsContainer.innerHTML = `
            <div class="u-text-align-center_padding-48px20px_border-1pxdashedrgba255">
                <i class="fa-solid fa-mountain u-font-size-36px_color-rgba2552552550p15_margin-bottom-14px_" ></i>
                <p class="u-color-var-text-muted_font-size-14px_margin-bottom-18px">Henüz aktif hedefin yok.<br>Yeni bir hedef belirleyerek başla.</p>
                <button data-action="open-goal-modal" class="primary-btn u-margin-0auto_justify-content-center-2" ><i class="fa-solid fa-plus"></i> Hedef Belirle</button>
            </div>`;
        } else if (currentGoalFilter === 'expired') {
            if (activeGoalsForMotivation.length > 0) {
                const heading = document.createElement('div');
                heading.className = 'gc-motivation-heading';
                heading.innerHTML = '<i class="fa-solid fa-hourglass-half"></i> Süresi dolan hedefin yok — aktif hedeflerinin süresi şöyle:';
                goalsContainer.appendChild(heading);
                activeGoalsForMotivation.forEach(goal => goalsContainer.appendChild(buildActiveGoalCardEl(goal)));
            } else {
                goalsContainer.innerHTML = buildEmptyExpiredStateHtml();
            }
        } else {
            if (activeGoalsForMotivation.length > 0) {
                const heading = document.createElement('div');
                heading.className = 'gc-motivation-heading';
                heading.innerHTML = '<i class="fa-solid fa-fire"></i> Henüz arşivlenen bir başarın yok — ama şuna bu kadar yaklaştın:';
                goalsContainer.appendChild(heading);
                activeGoalsForMotivation.forEach(goal => goalsContainer.appendChild(buildActiveGoalCardEl(goal)));
            } else {
                goalsContainer.innerHTML = buildEmptyCompletedStateHtml();
            }
        }
    }
}
window.renderGoals = renderGoals;
