import { gfApplyActiveTaskDisplay, gfPopulateTaskDropdown } from './social-group-focus-task-selector.js';
// ─── ORTAK ODAKLANMA — SAF FAZ/SÜRE HESAPLAMA YARDIMCILARI ─────────────────
// social.js dosyasından çıkarıldı (Faz O, social.js turu): Ortak Odaklanma
// (oda + bireysel mod) zamanlayıcısının iş↔mola fazını ve süresini hesaplayan
// SAF fonksiyonlar. [[faz_e_odak_ve_sohbet_cekirdegi_degerlendirme]]'de bu
// motorun BÜYÜK KISMI "18 alakasız fonksiyonla iç içe, çıkarılamaz" bulunmuştu
// — ama bu 5 fonksiyon o değerlendirmenin İÇİNDE, gerçekten izole bir alt-küme:
// hiçbiri `sharedFocusSession`/`currentRoomId` gibi social.js'in paylaşılan
// durumuna DOKUNMUYOR, sadece parametre olarak verilen `session`/`now`'ı okuyup
// yeni bir nesne döndürüyor (ya da DOM'dan salt-okunur bir değer okuyor).
//
// social.js bu dosyadan SONRA yükleniyor (bkz. inline-module-loader.js —
// social.js'in dosyalar arasındaki konumu planning.js'in TERSİNE, social-*.js
// yardımcı modüllerinden ÖNCE, o yüzden bu dosya özel olarak social.js'ten
// ÖNCEYE eklendi) — social.js kendi içindeki bare çağrılar için bunları
// ES import ile alıyor.

// Oda kurulurken varsayılan mola süresi (kullanıcılar arayüzden değiştirebilir).
// Faz H devamı ile buraya taşındı — social.js'te tanımlıydı, birden çok
// dosyaya (social-shared-focus-*.js) bölünen fonksiyonların hepsinin ihtiyacı
// olan paylaşılan bir SABİT olduğu için (fonksiyon değil) burada merkezi.
const SHARED_FOCUS_DEFAULT_BREAK_MINUTES = 10;

// session: { startedAt, paused, pausedAt, focusMinutes, breakMinutes }
// now: Date.now() değeri
// Bireysel modda (breakMs<=0) tek seferlik geri sayım; oda modunda iş↔mola
// sonsuz döngüsü.
function deriveSharedFocusPhase(session, now) {
    if (!session || !session.startedAt) return null;
    const focusMs = Math.max(1, (session.focusMinutes || 25)) * 60000;
    const breakMs = Math.max(0, (session.breakMinutes || 0)) * 60000;
    const refNow = (session.paused && session.pausedAt) ? session.pausedAt : now;
    const elapsed = Math.max(0, refNow - session.startedAt);

    if (breakMs <= 0) {
        if (elapsed >= focusMs) return { type: 'done', remainingMs: 0, durMs: focusMs };
        return { type: 'work', remainingMs: focusMs - elapsed, durMs: focusMs };
    }
    const cycleMs = focusMs + breakMs;
    const inCycle = elapsed % cycleMs;
    if (inCycle < focusMs) return { type: 'work', remainingMs: focusMs - inCycle, durMs: focusMs };
    return { type: 'break', remainingMs: cycleMs - inCycle, durMs: breakMs };
}

// Duraklat: paused=true + pausedAt=now yaz. Devam: geçen duraklama süresi kadar
// startedAt'ı ileri kaydır.
function buildSharedFocusResumeUpdate(session, now) {
    const shift = now - (session.pausedAt || now);
    return { paused: false, pausedAt: null, startedAt: (session.startedAt || 0) + shift };
}

// Atla: kalan süre kadar startedAt'ı geriye kaydırarak fazı anında bir sonrakine düşürür.
function buildSharedFocusSkipUpdate(session, now) {
    const ph = deriveSharedFocusPhase(session, now);
    if (!ph) return null;
    return { startedAt: (session.startedAt || 0) - ph.remainingMs, paused: false, pausedAt: null };
}

// Mini zamanlayıcının kurulum ekranındaki süre input'unu okur (bireysel mod
// için toplam saniye).
function getSharedFocusTotalSeconds() {
    const input = document.getElementById('gf-duration-input');
    return input ? (parseInt(input.value, 10) || 25) * 60 : 25 * 60;
}

function populateSharedFocusTaskSelect() {
    gfPopulateTaskDropdown();
    gfApplyActiveTaskDisplay();
}

// Grup odaklanmasında şu an kaçıncı iş↔mola turunda olunduğunu hesaplar
// (session.startedAt'tan bu yana kaç tam döngü geçtiği, totalRounds'la sınırlı).
// Faz O ikinci turda eklendi — deriveSharedFocusPhase ile aynı saf hesaplama ailesi.
function gfComputeCurrentRound(session, totalRounds) {
    if (!session || !session.startedAt) return 1;
    const focusMs = Math.max(1, (session.focusMinutes || 25)) * 60000;
    const breakMs = Math.max(0, (session.breakMinutes || 0)) * 60000;
    const refNow  = (session.paused && session.pausedAt) ? session.pausedAt : Date.now();
    const elapsed = Math.max(0, refNow - session.startedAt);
    if (breakMs <= 0) return 1;
    const cycleMs  = focusMs + breakMs;
    const cycleNum = Math.floor(elapsed / cycleMs) + 1;
    return Math.min(cycleNum, totalRounds);
}

// Faz O: gerçek export (social.js bu dosyadan SONRA yüklendiği için güvenli
// — bkz. inline-module-loader.js).
export {
    deriveSharedFocusPhase, buildSharedFocusResumeUpdate, buildSharedFocusSkipUpdate,
    getSharedFocusTotalSeconds, populateSharedFocusTaskSelect, gfComputeCurrentRound,
    SHARED_FOCUS_DEFAULT_BREAK_MINUTES
};
