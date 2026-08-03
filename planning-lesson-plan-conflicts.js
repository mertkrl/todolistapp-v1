// ─── DERS PLANI SAAT ÇAKIŞMASI TESPİTİ ─────────────────────
// planning.js dosyasından çıkarıldı (Faz O, ilk dilim): öğrencinin kendi
// görevleriyle öğretmenden kabul ettiği ders planı arasındaki saat
// çakışmalarını hesaplayan/gösteren fonksiyonlar. planning.js'in geri kalanı
// (goals/dependencies/activeFilters gibi paylaşılan state, takvim render
// çekirdeği) ile GERÇEK bir bağımlılığı yok — sadece parametre olarak
// geçirilen `g` (goal) nesnesini okuyor, hiçbir closure state'ini
// değiştirmiyor. Bu yüzden bu dilim mekanik olarak (bridge gerekmeden)
// çıkarılabildi.
//
// Dış bağımlılıklar (planning.js'te KALIYOR, buradan sadece OKUNUYOR):
// - FocusStorage → zaten global (window.FocusStorage), bare referans yeterli
// - _normYMD → planning-wizard.js'te tanımlı, window._normYMD köprüsü zaten
//   var ve bu dosyadan ÖNCE yükleniyor (bkz. inline-module-loader.js) —
//   bare referans yeterli, yeni köprü gerekmedi
//
// NOT: _pvConflictHourKeys eskiden planning.js'teki _pvTimeToMinLocal'i
// çağırıyordu — o fonksiyon burada YOK ama _lpaTimeToMin ile TAMAMEN AYNI
// mantığa sahip (ikisi de "HH:MM" -> dakika çeviriyor), bu yüzden referans
// _lpaTimeToMin'e çevrildi, ayrı bir köprüye gerek kalmadı.
//
// window._pvUpdateConflictBanner / window._pvHasUnresolvedConflicts /
// window._pvShowUnresolvedConflictModal köprüleri KORUNDU — bunları
// planning-plan-header.js kullanıyor (bkz. o dosyanın üst yorumu).

function _lpaTimeToMin(t) { const [h, m] = (t || '0:00').split(':').map(Number); return h * 60 + (m || 0); }

function _lpaOverlap(aStart, aEnd, bStart, bEnd) {
    let s1 = _lpaTimeToMin(aStart), e1 = _lpaTimeToMin(aEnd || aStart); if (e1 <= s1) e1 = 24 * 60;
    let s2 = _lpaTimeToMin(bStart), e2 = _lpaTimeToMin(bEnd || bStart); if (e2 <= s2) e2 = 24 * 60;
    return s1 < e2 && e1 > s2;
}

function _lpaFindConflicts(clonedMs) {
    const myTasks = FocusStorage.get('tasks', []);
    const conflicts = [];
    clonedMs.forEach(ms => {
        if (!ms.due_date || !ms.start_time) return;
        const clash = myTasks.find(t => t.timeStart && t.timeEnd && _normYMD(t.date) === ms.due_date
            && _lpaOverlap(ms.start_time, ms.end_time, t.timeStart, t.timeEnd));
        if (clash) conflicts.push({ ms, task: clash });
    });
    return conflicts;
}

// Kabul öncesi ilk uyarı: detaylı çözüm ekranı yerine kısa, profesyonel bir
// bildirim — kullanıcı ister hemen düzenlesin, ister planı olduğu gibi kabul
// edip daha sonra düzeltsin.
function _lpaShowSimpleConflictWarning(conflicts, { onEdit, onLater }) {
    const overlay = document.createElement('div');
    overlay.className = 'pg-pv-conflict-overlay';
    overlay.innerHTML = `
        <div class="pg-pv-conflict-box">
            <div class="pg-pv-conflict-icon"><i class="ti ti-alert-triangle"></i></div>
            <div class="pg-pv-conflict-title">Saat çakışması var</div>
            <div class="pg-pv-conflict-msg">Öğretmeninin planındaki bazı saatler, senin zaten planladığın görevlerle çakışıyor. Şimdi düzenleyebilir ya da planı olduğu gibi kabul edip daha sonra düzenleyebilirsin.</div>
            <div class="pg-pv-conflict-actions">
                <button type="button" class="pg-pv-conflict-btn pg-pv-conflict-cancel" data-action="later">Daha sonra düzenle</button>
                <button type="button" class="pg-pv-conflict-btn pg-pv-conflict-confirm" data-action="edit">Düzenle</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelector('[data-action="later"]').addEventListener('click', () => { close(); onLater(); });
    overlay.querySelector('[data-action="edit"]').addEventListener('click', () => { close(); onEdit(); });
}

// Kabul edilen dersin çakışan günlerine sırayla odaklanır ve o günleri
// "kilitli" işaretler (bkz. planning.js: _pvMoveTaskToSlot) — kullanıcı
// sadece saat değiştirebilir, görevleri başka güne sürükleyemez.
// dateStr + saat aralığı (HH:MM) -> o aralığa denk gelen her saat hücresi için
// "dateStr|saat" anahtarları — hcal grid hücrelerini vurgulamak için kullanılır.
function _pvConflictHourKeys(dateStr, startT, endT) {
    if (!dateStr || !startT) return [];
    const sH = Math.floor(_lpaTimeToMin(startT) / 60);
    let eMin = _lpaTimeToMin(endT || startT);
    let eH = Math.floor((eMin > 0 ? eMin - 1 : 0) / 60);
    if (eH < sH) eH = sH;
    const keys = [];
    for (let h = sH; h <= eH; h++) keys.push(`${dateStr}|${h}`);
    return keys;
}

// Üst bardaki "çakışan saatler var" rozetini günceller — çözülünce otomatik kaybolur.
window._pvUpdateConflictBanner = _pvUpdateConflictBanner; // planning-plan-header.js için
function _pvUpdateConflictBanner(g) {
    const banner = document.getElementById('pg-pv-conflict-banner');
    if (!banner) return;
    const count = _pvRecomputeUnresolvedConflicts(g).length;
    banner.classList.toggle('hidden', count === 0);
    if (count > 0) {
        const textEl = document.getElementById('pg-pv-conflict-banner-text');
        if (textEl) textEl.textContent = count === 1 ? 'Çakışan bir saat var — düzenlemen gerekiyor' : `${count} çakışan saat var — düzenlemen gerekiyor`;
    }
}

// Öğrencinin öğretmenden kabul ettiği ders planında (g.lpa_id) bu plana ait
// saatli görevlerle öğrencinin kendi diğer görevleri arasında hâlâ çakışma var
// mı diye HER ZAMAN canlı hesaplar — bir önceki oturumda "Düzenle" ile açılıp
// açılmadığına bakmaz, böylece sayfa yenilense/plan farklı bir yoldan tekrar
// açılsa bile kaydet/çık uyarısı doğru çalışır.
function _pvRecomputeUnresolvedConflicts(g) {
    if (!g || !g.lpa_id) return [];
    const allTasks = FocusStorage.get('tasks', []);
    const lessonTasks = allTasks.filter(t => String(t.parentGoal) === String(g.id) && t.timeStart && t.timeEnd);
    const ownTasks = allTasks.filter(t => String(t.parentGoal) !== String(g.id) && t.timeStart && t.timeEnd);
    const conflicts = [];
    lessonTasks.forEach(lesson => {
        const own = ownTasks.find(o => _normYMD(o.date) === _normYMD(lesson.date)
            && _lpaOverlap(lesson.timeStart, lesson.timeEnd, o.timeStart, o.timeEnd));
        if (own) conflicts.push({ lesson, own });
    });
    return conflicts;
}

window._pvHasUnresolvedConflicts = _pvHasUnresolvedConflicts; // planning-plan-header.js için
function _pvHasUnresolvedConflicts(g) { return _pvRecomputeUnresolvedConflicts(g).length > 0; }

// Bir tarih, o gün için hâlâ çözülmemiş bir çakışma varsa "kilitli" sayılır —
// bkz. planning.js: _pvMoveTaskToSlot — kilitli günlerdeki görevler başka bir
// güne sürüklenemez.
function _pvIsDateLocked(g, dateStr) {
    if (!g?.lpa_id) return false;
    return _pvRecomputeUnresolvedConflicts(g).some(c => _normYMD(c.lesson.date) === dateStr || _normYMD(c.own.date) === dateStr);
}

// Bu plana ait hcal grid hücrelerini vurgulamak için "dateStr|saat" anahtar seti üretir.
function _pvConflictHourSetFor(g) {
    const set = new Set();
    if (!g?.lpa_id) return set;
    _pvRecomputeUnresolvedConflicts(g).forEach(c => {
        _pvConflictHourKeys(_normYMD(c.lesson.date), c.lesson.timeStart, c.lesson.timeEnd).forEach(k => set.add(k));
        _pvConflictHourKeys(_normYMD(c.own.date), c.own.timeStart, c.own.timeEnd).forEach(k => set.add(k));
    });
    return set;
}

// Çakışma çözülmeden kaydet/çık denendiğinde gösterilen uyarı.
window._pvShowUnresolvedConflictModal = _pvShowUnresolvedConflictModal; // planning-plan-header.js için
function _pvShowUnresolvedConflictModal({ onLeave }) {
    const overlay = document.createElement('div');
    overlay.className = 'pg-pv-conflict-overlay';
    overlay.innerHTML = `
        <div class="pg-pv-conflict-box">
            <div class="pg-pv-conflict-icon"><i class="ti ti-alert-triangle"></i></div>
            <div class="pg-pv-conflict-title">Çakışan saatler var</div>
            <div class="pg-pv-conflict-msg">Bu planda hâlâ çözülmemiş saat çakışmaları var. Çıkmadan önce düzenlemeye devam edebilir ya da planlamadan ayrılabilirsin.</div>
            <div class="pg-pv-conflict-actions">
                <button type="button" class="pg-pv-conflict-btn pg-pv-conflict-cancel" data-action="continue">Düzenlemeye Devam Et</button>
                <button type="button" class="pg-pv-conflict-btn pg-pv-conflict-confirm" data-action="leave">Planlamadan Ayrıl</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelector('[data-action="continue"]').addEventListener('click', close);
    overlay.querySelector('[data-action="leave"]').addEventListener('click', () => { close(); onLeave(); });
}

// Kapat / Tüm Hedefler'e basıldığında kaydedilmemiş değişiklik varsa gösterilen
// onay modalı — Faz O beşinci dilimde eklendi, yukarıdaki
// _pvShowUnresolvedConflictModal ile aynı "modal" ailesinden, aynı şekilde
// closure state'ine dokunmuyor.
function _pvShowUnsavedModal({ onSaveExit, onDiscardExit }) {
    const overlay = document.createElement('div');
    overlay.className = 'pg-pv-conflict-overlay';
    overlay.innerHTML = `
        <div class="pg-pv-conflict-box">
            <div class="pg-pv-conflict-icon"><i class="ti ti-device-floppy"></i></div>
            <div class="pg-pv-conflict-title">Kaydedilmemiş değişiklikler</div>
            <div class="pg-pv-conflict-msg">
                Bu planda henüz kaydedilmemiş değişiklikler var. Çıkmadan önce ne yapmak istersiniz?
            </div>
            <div class="pg-pv-conflict-actions u-flex-direction-column_gap-8px" >
                <button type="button" class="pg-pv-conflict-btn pg-pv-conflict-confirm u-width-100pct" id="pg-pv-unsaved-save" >Kaydet ve Çık</button>
                <div class="u-display-flex_gap-8px_width-100pct">
                    <button type="button" class="pg-pv-conflict-btn pg-pv-conflict-cancel" id="pg-pv-unsaved-cancel">Vazgeç</button>
                    <button type="button" class="pg-pv-conflict-btn pg-pv-conflict-discard" id="pg-pv-unsaved-discard">Kaydetmeden Çık</button>
                </div>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    overlay.querySelector('#pg-pv-unsaved-cancel').addEventListener('click', close);
    overlay.querySelector('#pg-pv-unsaved-save').addEventListener('click', () => { close(); onSaveExit(); });
    overlay.querySelector('#pg-pv-unsaved-discard').addEventListener('click', () => { close(); onDiscardExit(); });
}

// Faz O: gerçek export (planning.js bu dosyadan ÖNCE yüklendiği için güvenli
// — bkz. inline-module-loader.js). window.* köprüleri KALDIRILMADI:
// planning-plan-header.js hâlâ window.* üzerinden çağırıyor.
export {
    _lpaTimeToMin, _lpaOverlap, _lpaFindConflicts, _lpaShowSimpleConflictWarning,
    _pvConflictHourKeys, _pvRecomputeUnresolvedConflicts, _pvHasUnresolvedConflicts,
    _pvIsDateLocked, _pvConflictHourSetFor, _pvShowUnresolvedConflictModal,
    _pvUpdateConflictBanner, _pvShowUnsavedModal
};
