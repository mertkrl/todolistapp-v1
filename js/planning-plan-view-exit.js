import { _pvShowUnsavedModal } from './planning-lesson-plan-conflicts.js';
import { _pvDiscardUnacceptedGoal } from './planning-collab-invite-delete.js';

// planning.js dosyasından çıkarıldı (Faz devamı — dev fonksiyon refactoru).
// pvGoalId/pvUnsaved planning.js'in module-seviye state'i; window.__getPvGoalId/
// __getPvUnsaved/__setPvUnsaved köprüleri zaten vardı. _pvIsLessonPlan/
// _pvExplicitSave/closePlanView planning.js'te kalıyor, window.* üzerinden
// çağrılıyor (zaten köprülüydüler).

// pg-pv-back ve pg-pv-close ortak çıkış noktası: burada "zaman çakışması var" uyarısı
// GÖSTERİLMEZ — kullanıcı çakışmayı düzeltmeden de çıkabilir (çakışma bir sonraki
// girişte hâlâ ilgili yerlerde vurgulanır). Sadece kaydedilmemiş değişiklik var mı
// diye sorulur: değişiklik yoksa direkt kapanır, varsa Kaydet/Kaydetmeden Çık/Vazgeç sorulur.
function _pvHandleExitClick() {
    const goals = window._pgGetGoals();
    const pvGoalId = window.__getPvGoalId();
    const g = goals.find(x => x.id === pvGoalId);
    if (g?.pending_accept) {
        // Kabul edilmemiş taslak: hiç değişiklik yapılmadıysa (pvUnsaved false)
        // sessizce geri al — kaydedecek bir şey yok. Ama öğrenci çakışmaları
        // düzeltmek için saat/gün değiştirdiyse (pvUnsaved true), diğer ders
        // planlarında olduğu gibi Kaydet/Kaydetmeden Çık/Vazgeç sorulmalı —
        // aksi halde yaptığı düzeltmeler sessizce çöpe gidiyordu.
        if (window.__getPvUnsaved()) {
            _pvShowUnsavedModal({
                onSaveExit: () => { window._pvExplicitSave(g); window.closePlanView(); },
                onDiscardExit: () => { _pvDiscardUnacceptedGoal(g); window.__setPvUnsaved(false); window.closePlanView(); },
            });
            return;
        }
        _pvDiscardUnacceptedGoal(g);
        window.__setPvUnsaved(false);
        window.closePlanView();
        return;
    }
    if (window.__getPvUnsaved() && window._pvIsLessonPlan(g)) {
        _pvShowUnsavedModal({
            onSaveExit: () => { window._pvExplicitSave(g); window.closePlanView(); },
            onDiscardExit: () => { window.__setPvUnsaved(false); window.closePlanView(); },
        });
        return;
    }
    window.closePlanView();
}
window._pvHandleExitClick = _pvHandleExitClick; // planning.js (_pvInitBindings) için

export { _pvHandleExitClick };
