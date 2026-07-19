// ============================================================
// FOCUSAI SCRIPT-MILESTONE-AUTO-SPLITTER.JS
// script.js'ten çıkarılmış: Ana Hedef Detay ekranındaki "Otomatik Aşama
// Parçalayıcı & Boşluk Doldurucu" özelliği. Kullanıcı hedef detayında
// AI butonuna basıp aralık (3-5) seçtiğinde, hedefin başlangıç/bitiş
// tarihleri arasına akıllıca dağıtılmış dönüm noktaları (milestone) ekler.
// script.js'in window'a koyduğu ince sarmalayıcıları (__getGoalsRef,
// showPremiumModal, updateGoalDetailsUI, generateId, FocusStorage, Store)
// kullanır.
// script.js'ten SONRA, orijinal DOMContentLoaded zamanlamasını korumak
// için kendi DOMContentLoaded sarmalayıcısında yüklenir.
// ============================================================
(function () {
'use strict';
document.addEventListener('DOMContentLoaded', () => {

    // --- YENİ EKLENEN: FocusAI Otomatik Aşama Parçalayıcı & Boşluk Doldurucu ---
    const detailAiMilestoneToggleBtn = document.getElementById('detail-ai-milestone-toggle-btn');
    const detailAiMilestonePopover = document.getElementById('detail-ai-milestone-popover');
    const aiMilestoneMinus = document.getElementById('ai-milestone-minus');
    const aiMilestonePlus = document.getElementById('ai-milestone-plus');
    const detailAiMilestoneCount = document.getElementById('detail-ai-milestone-count');

    if (detailAiMilestoneToggleBtn && detailAiMilestonePopover) {
        // Her ihtimale karşı başlangıçta gizli tutalım
        detailAiMilestonePopover.style.display = 'none';

        // AI butonuna basınca alt paneli aç/kapat (display mantığıyla)
        detailAiMilestoneToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (detailAiMilestonePopover.style.display === 'none') {
                detailAiMilestonePopover.style.display = 'block';
            } else {
                detailAiMilestonePopover.style.display = 'none';
            }
        });

        // Ekranın başka bir yerine tıklanırsa veya dışarı basılırsa paneli kapat
        document.addEventListener('click', (e) => {
            if (!detailAiMilestonePopover.contains(e.target) && e.target !== detailAiMilestoneToggleBtn) {
                detailAiMilestonePopover.style.display = 'none';
            }
        });
    }

    // Eksi (-) Butonu Aktivitesi
    if (aiMilestoneMinus && detailAiMilestoneCount) {
        aiMilestoneMinus.addEventListener('click', (e) => {
            e.stopPropagation();
            let val = parseInt(detailAiMilestoneCount.value) || 3;
            if (val > 3) {
                detailAiMilestoneCount.value = val - 1;
            }
        });
    }

    // Artı (+) Butonu Aktivitesi
    if (aiMilestonePlus && detailAiMilestoneCount) {
        aiMilestonePlus.addEventListener('click', (e) => {
            e.stopPropagation();
            let val = parseInt(detailAiMilestoneCount.value) || 3;
            if (val < 5) {
                detailAiMilestoneCount.value = val + 1;
            }
        });
    }

    const detailAiMilestoneBtn = document.getElementById('detail-ai-milestone-btn');
    if (detailAiMilestoneBtn) {
        detailAiMilestoneBtn.addEventListener('click', () => {
            const goals = window.__getGoalsRef();
            const goalId = document.getElementById('detail-active-goal-id').value;
            const goal = goals.find(g => String(g.id) === String(goalId));
            if(!goal) return;

            const targetCount = detailAiMilestoneCount ? (parseInt(detailAiMilestoneCount.value) || 3) : 3;

            // Butona yükleniyor efekti verelim
            const originalHTML = detailAiMilestoneBtn.innerHTML;
            detailAiMilestoneBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            detailAiMilestoneBtn.disabled = true;

            setTimeout(() => {
               try {
                   // SÜPER GÜVENLİ TARİH PARSE MOTORU
                   function parseSecureDate(rawVal) {
                       if (!rawVal) return new Date();
                       if (typeof rawVal === 'number' || !isNaN(rawVal)) {
                           return new Date(Number(rawVal));
                       }
                       const str = String(rawVal).trim();
                       const parts = str.split('-');
                       if (parts.length === 3) {
                           if (parts[0].length === 4) { // YYYY-MM-DD
                               return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                           } else { // DD-MM-YYYY
                               return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                           }
                       }
                       return new Date(str);
                   }

                   const startDate = goal.createdAt ? parseSecureDate(goal.createdAt) : new Date();
                   startDate.setHours(0, 0, 0, 0);

                   const endDate = goal.deadline ? parseSecureDate(goal.deadline) : new Date();
                   endDate.setHours(0, 0, 0, 0);

                   const totalTimeDiff = endDate.getTime() - startDate.getTime();
                   let totalDays = Math.floor(totalTimeDiff / (1000 * 60 * 60 * 24));
                   if (isNaN(totalDays) || totalDays < 0) totalDays = 30;

                   // GÜVENLİK KONTROLÜ (1. MADDE)
                   if (totalDays < targetCount) {
                       window.showPremiumModal({
                           title: 'Zaman Aralığı Çok Kısa! ⚠️',
                           message: `Bu ana hedefin toplam süresi (${totalDays} gün), seçtiğiniz dönüm noktası sayısından (${targetCount}) daha azdır. Çakışmaları önlemek için otomatik oluşturma iptal edildi. Lütfen elinizle ekleyin.`,
                           type: 'info'
                       });
                       if (detailAiMilestonePopover) detailAiMilestonePopover.style.display = 'none';
                       detailAiMilestoneBtn.innerHTML = originalHTML;
                       detailAiMilestoneBtn.disabled = false;
                       return;
                   }

                   let addedCount = 0;
                   const titleLower = goal.title ? goal.title.toLowerCase() : '';
                   let aiTexts = [
                       "Gerekli araştırma ve planlama aşamasını bitir",
                       "İlk somut adımı başarıyla tamamla",
                       "Karşılaştığın engelleri aşarak devam et",
                       "Son rötuşları yap ve büyük hedefi tamamla",
                       "Gelişmeleri gözden geçir ve optimize et",
                       "Hedefin yarı yolunu başarıyla geç",
                       "Eksiklikleri tespit et ve hızlan"
                   ];

                   if (titleLower.includes('ingilizce') || titleLower.includes('dil') || titleLower.includes('öğren')) {
                       aiTexts = ["Temel kavramları ve kelimeleri öğren", "Pratik yapmaya başla ve seviyeni test et", "Gramer eksiklerini kapat ve akıcılık kazan", "Zorlu metinleri anla ve hedef seviyeye ulaş", "Günlük hayatta aktif kullanmaya başla"];
                   } else if (titleLower.includes('yazılım') || titleLower.includes('proje') || titleLower.includes('kod')) {
                       aiTexts = ["İhtiyaç analizini yap ve proje mimarisini çiz", "Temel altyapıyı (Backend/Veritabanı) kur", "Kullanıcı arayüzünü (UI) tasarla ve entegre et", "Son testleri tamamla ve projeyi canlıya al", "Kullanıcı geri bildirimlerini topla"];
                   } else if (titleLower.includes('kitap') || titleLower.includes('oku')) {
                       aiTexts = ["Okunacak kitaplar listesini hazırla", "Her gün belirli bir sayfa okuma alışkanlığı kazan", "İlk kitabı bitir ve önemli notları çıkar", "Listeyi tamamla ve öğrendiklerini özetle", "Yeni bir okuma listesine geç"];
                   } else if (titleLower.includes('para') || titleLower.includes('birikim') || titleLower.includes('finans')) {
                       aiTexts = ["Aylık bütçe ve harcama analizi yap", "Gereksiz abonelikleri ve masrafları kes", "İlk birikim (Acil durum) fonunu oluştur", "Hedeflenen finansal değere ulaş", "Yatırımlarını çeşitlendir"];
                   }

                   if(!goal.milestones) goal.milestones = [];

                   // AKILLI DAĞITIM VE KENDİNDEN FORMATLAMA DÖNGÜSÜ
                   for(let i = 1; i <= targetCount; i++) {
                       let percentage = 0.25;
                       if (targetCount === 3) {
                           percentage = [0.25, 0.55, 0.90][i - 1];
                       } else if (targetCount === 4) {
                           percentage = [0.20, 0.45, 0.70, 0.92][i - 1];
                       } else {
                           percentage = [0.15, 0.35, 0.55, 0.75, 0.94][i - 1];
                       }

                       const addedDaysForEnd = Math.max(i, Math.floor(totalDays * percentage));
                       const addedDaysForStart = Math.max(i - 1, Math.floor(totalDays * (percentage - 0.20)));

                       const milestoneEndDate = new Date(startDate.getTime());
                       milestoneEndDate.setDate(startDate.getDate() + addedDaysForEnd);

                       const milestoneStartDate = new Date(startDate.getTime());
                       milestoneStartDate.setDate(startDate.getDate() + addedDaysForStart);

                       // TARAYICIYI DONDURMAYACAK ŞEKİLDE TARİHLERİ DOĞRUDAN FORMATLIYORUZ (ÖNEMLİ KISIM)
                       const endDD = String(milestoneEndDate.getDate()).padStart(2, '0');
                       const endMM = String(milestoneEndDate.getMonth() + 1).padStart(2, '0');
                       const endYYYY = milestoneEndDate.getFullYear();
                       let expectedDateStr = `${endDD}-${endMM}-${endYYYY}`; // Listelemenin okuyacağı format

                       const startDD = String(milestoneStartDate.getDate()).padStart(2, '0');
                       const startMM = String(milestoneStartDate.getMonth() + 1).padStart(2, '0');
                       const startYYYY = milestoneStartDate.getFullYear();
                       let prevDateStr = `${startDD}-${startMM}-${startYYYY}`;

                       let isCovered = false;
                       for(let m of goal.milestones) {
                           if (m.date === expectedDateStr) {
                               isCovered = true;
                               break;
                           }
                       }

                       if (!isCovered) {
                           let mText = aiTexts[(i-1) % aiTexts.length];
                           let uniqueMilestoneId = (typeof window.generateId === 'function')
                               ? window.generateId()
                               : 'ms-' + Math.random().toString(36).substr(2, 9);

                           goal.milestones.push({
                               id: uniqueMilestoneId,
                               text: `${mText} (Aşama ${i})`,
                               startDate: prevDateStr,
                               date: expectedDateStr,
                               completed: false
                           });
                           addedCount++;
                       }
                   }

                   // KAYIT VE ARAYÜZ YENİLEME AŞAMASI
                   if (addedCount > 0) {
                       if (typeof window.FocusStorage !== 'undefined' && window.FocusStorage.set) {
                           window.Store.goals.set(goals);
                       } else if (typeof localStorage !== 'undefined') {
                           localStorage.setItem('goals', JSON.stringify(goals));
                       }

                       if (typeof window.updateGoalDetailsUI === 'function') {
                           window.updateGoalDetailsUI(goalId);
                       }

                       window.showPremiumModal({
                           title: 'Tam Otomatik Bölüştürme! ✨',
                           message: `FocusAI, zaman çizelgeni analiz etti ve boşlukları zekice doldurarak ${addedCount} yeni aşama ekledi.`,
                           type: 'success'
                       });
                   } else {
                       window.showPremiumModal({
                           title: 'Her Şey Yolunda',
                           message: 'Mevcut dönüm noktaların, hedefin geneline zaten harika bir şekilde dağılmış durumda. Ekstra bir boşluk bulunamadı.',
                           type: 'info'
                       });
                   }
               } catch (error) {
                   console.error("AI Parçalayıcı Hatası Engellendi:", error);
               }

               // Butonu ve paneli ne olursa olsun kapatıp serbest bırakıyoruz (DÖNMEYİ BİTİREN KISIM)
               if (detailAiMilestonePopover) detailAiMilestonePopover.style.display = 'none';
               detailAiMilestoneBtn.innerHTML = originalHTML;
               detailAiMilestoneBtn.disabled = false;

            }, 1000);
        });
    }

});
})();
