// script-goal-modal.js dosyasından çıkarıldı — saf metin üreticisi,
// sadece parametrelerine bağlı (escapeHtml global window-fallthrough ile).
export function generateAIAnalysis(goal, progress, totalTasks, completedTasks) {
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
