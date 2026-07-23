// script-task-complete-sound.js
// script.js'ten çıkarıldı (Faz F, 3. tur): Görev tamamlama ses efekti.
// Bağımsız — sadece FocusStorage (global) ve Web Audio API kullanıyor.
// Not: script.js içinde şu an hiçbir çağrı noktası bulunamadı (ölü kod
// olabilir), yine de geriye dönük uyumluluk için window köprüsü bırakıldı.

function playTaskCompleteSound() {
    const cfg = FocusStorage.get('system_settings', { tasksound: true });
    if (cfg.tasksound === false) return;
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator(); const g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.05);
        osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.1);
        g.gain.setValueAtTime(0.25, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start(); osc.stop(ctx.currentTime + 0.4);
    } catch (e) { console.warn('[FocusAI] sessiz hata:', e); }
}
window.playTaskCompleteSound = playTaskCompleteSound;
