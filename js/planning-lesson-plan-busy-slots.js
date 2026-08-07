// ─── DERS PLANI "DOLU SAATLER" (MEŞGULİYET) KONTROLÜ ─────────────────────
// planning.js dosyasından çıkarıldı (Faz O, ikinci dilim): kişiye/sınıfa özel
// ders planlamasında öğrencinin (veya sınıftaki tüm öğrencilerin) dolu
// saatlerini Supabase'ten çekip takvimde gösteren ve yeni saat eklerken
// çakışma uyarısı çıkaran özellik. planning.js'in goals/dependencies/
// activeFilters gibi ana durumuyla GERÇEK bir bağımlılığı yok — kendi
// izole state'ini (aşağıda) taşıyor, dışarıya sadece iki dar getter
// (_pvGetSuppressBusyWarning / _pvGetCachedGroupMemberName) ve bir reset
// fonksiyonu (_pvResetBusyState) açıyor.
//
// Dış bağımlılıklar (planning.js'te KALIYOR, window.* üzerinden çağrılıyor —
// planning-wizard.js'teki AYNI desen, bkz. o dosyanın üst yorumu):
// - window._pvRenderMainCal, window.esc → zaten köprülü
// - _lpaTimeToMin → planning-lesson-plan-conflicts.js'ten import (bu dosya
//   ondan SONRA yükleniyor, bkz. inline-module-loader.js) — planning.js'teki
//   _pvTimeToMinLocal ile birebir aynı mantık, ayrı köprüye gerek kalmadı.
import { _lpaTimeToMin } from './planning-lesson-plan-conflicts.js';
import { getCurrentUser } from '../state/current-user-store.js';

// ── İzole state (planning.js'in goals/dependencies'inden bağımsız) ──
let pvShowBusy = false;
let pvBusySlots = null;        // [{task_date, time_start, time_end, is_overnight, student_id}] | null (yüklenmedi)
let pvBusyStudentId = null;    // hangi öğrenci/grup için yüklendiği (cache anahtarı)
let pvBusySlotsLoaded = false; // cacheKey için yükleme gerçekten tamamlandı mı (boş sonuç da geçerli sayılsın diye)
let pvGroupMembersCache = null; // { groupId, members: [{id, display_name, username}] }
let pvSuppressBusyWarning = false; // "bir daha gösterme" — sadece bu planlama oturumu boyunca geçerli

function _pvBusyTargetStudentId(g) {
    return (g?.plan_mode === 'lesson-plan') ? (g.context?.lessonPlanStudentId || null) : null;
}

// Sınıfa özel planlarda çakışma kontrolü gruptaki HERKESE karşı yapılmalı —
// isim de gösterebilmek için üye listesini (id + ad) ayrıca önbelleğe alıyoruz.
async function _pvGroupMembers(groupId) {
    if (!groupId || !window.FocusSupabase) return [];
    if (pvGroupMembersCache?.groupId === groupId) return pvGroupMembersCache.members;
    const myId = getCurrentUser()?.id;
    try {
        const { data } = await window.FocusSupabase
            .from('group_members').select('user_id, profiles(id, display_name, username)')
            .eq('group_id', groupId);
        const members = (data || []).map(r => r.profiles).filter(p => p && p.id !== myId);
        pvGroupMembersCache = { groupId, members };
        return members;
    } catch (e) {
        console.warn('[FocusAI] _pvGroupMembers:', e);
        return [];
    }
}

async function _pvLoadBusySlots(g) {
    const groupId = g.context?.lessonPlanGroupId;
    if (!groupId || !window.FocusSupabase) { pvBusySlots = []; return; }
    const studentId = _pvBusyTargetStudentId(g);
    const cacheKey = studentId || `group:${groupId}`;
    // Not: boş dizi de geçerli bir sonuç olduğundan (JS'te [] truthy'dir), cache kontrolünü
    // ayrı bir "yüklendi" bayrağıyla yapıyoruz — yoksa geçici/erken boş sonuç kalıcı
    // önbelleğe girip "Dolu Saatler" butonu tekrar basılsa bile yenilenmiyordu.
    if (pvBusyStudentId === cacheKey && pvBusySlotsLoaded) return; // zaten yüklü
    try {
        if (studentId) {
            const { data, error } = await window.FocusSupabase
                .rpc('lesson_plan_student_busy_slots', { p_student_id: studentId, p_group_id: groupId });
            pvBusySlots = error ? [] : (data || []).map(s => ({ ...s, student_id: studentId }));
            if (error) { pvBusyStudentId = null; pvBusySlotsLoaded = false; return; }
        } else {
            // Sınıfa özel: gruptaki her öğrencinin dolu saatlerini tek tek çekip birleştiriyoruz
            // (RPC tek öğrenci alıyor, çoklu-öğrenci varyantı yok — döngüyle çözülüyor).
            const members = await _pvGroupMembers(groupId);
            const results = await Promise.all(members.map(m =>
                window.FocusSupabase.rpc('lesson_plan_student_busy_slots', { p_student_id: m.id, p_group_id: groupId })
                    .then(({ data, error }) => error ? [] : (data || []).map(s => ({ ...s, student_id: m.id })))
            ));
            pvBusySlots = results.flat();
        }
    } catch (e) {
        console.warn('[FocusAI] _pvLoadBusySlots:', e);
        pvBusySlots = [];
        pvBusyStudentId = null; pvBusySlotsLoaded = false;
        return;
    }
    pvBusyStudentId = cacheKey;
    pvBusySlotsLoaded = true;
}

// dateStr (YYYY-MM-DD) + saat (0-23) dolu mu?
function _pvIsBusyHour(dateStr, hour) {
    if (!pvShowBusy || !pvBusySlots) return false;
    const cellStart = hour * 60, cellEnd = cellStart + 60;
    return pvBusySlots.some(s => {
        if (s.task_date !== dateStr) return false;
        const startMin = _lpaTimeToMin((s.time_start || '00:00').slice(0,5));
        let endMin = _lpaTimeToMin((s.time_end || '00:00').slice(0,5));
        if (s.is_overnight || endMin <= startMin) endMin = 24 * 60;
        return startMin < cellEnd && endMin > cellStart;
    });
}

// dateStr (YYYY-MM-DD) içinde herhangi bir dolu saat var mı? (aylık görünüm — gün bazlı özet)
function _pvIsBusyDay(dateStr) {
    if (!pvShowBusy || !pvBusySlots) return false;
    return pvBusySlots.some(s => s.task_date === dateStr);
}

function _pvBusyToggleBtn(g) {
    if (!_pvBusyTargetStudentId(g)) return '';
    const legend = pvShowBusy ? `<span class="pg-pv-busy-legend"><span class="pg-pv-busy-legend-swatch"></span>Öğrencinin dolu saati</span>` : '';
    return `<button type="button" class="pg-pv-main-cal-today-btn pg-pv-busy-toggle-btn${pvShowBusy?' active':''}" id="pg-pv-busy-toggle" title="Öğrencinin dolu saatlerini göster (sadece bilgi amaçlı)">
        <i class="ti ti-eye${pvShowBusy?'':'-off'}"></i> Dolu Saatler
    </button>${legend}`;
}

function _pvBindBusyToggle(el, g) {
    const btn = el.querySelector('#pg-pv-busy-toggle');
    if (!btn) return;
    btn.addEventListener('click', async () => {
        pvShowBusy = !pvShowBusy;
        if (pvShowBusy) await _pvLoadBusySlots(g);
        window._pvRenderMainCal(g);
    });
}

// ── Çakışma kontrolü: seçilen tarih/saat aralığı öğrencinin dolu bir dilimiyle kesişiyor mu? ──
function _pvBusyConflict(dateStr, timeStart, timeEnd) {
    if (!pvBusySlots || !pvBusySlots.length) return null;
    const rangeStart = _lpaTimeToMin((timeStart || '00:00').slice(0,5));
    let rangeEnd = _lpaTimeToMin((timeEnd || '00:00').slice(0,5));
    if (rangeEnd <= rangeStart) rangeEnd = 24 * 60;
    return pvBusySlots.find(s => {
        if (s.task_date !== dateStr) return false;
        const startMin = _lpaTimeToMin((s.time_start || '00:00').slice(0,5));
        let endMin = _lpaTimeToMin((s.time_end || '00:00').slice(0,5));
        if (s.is_overnight || endMin <= startMin) endMin = 24 * 60;
        return startMin < rangeEnd && endMin > rangeStart;
    }) || null;
}

// Profesyonel onay modalı — "bu uyarıyı bir daha gösterme" seçeneğiyle
function _pvShowConflictModal({ timeStart, timeEnd, studentName, onConfirm }) {
    const esc = window.esc;
    const overlay = document.createElement('div');
    overlay.className = 'pg-pv-conflict-overlay';
    overlay.innerHTML = `
        <div class="pg-pv-conflict-box">
            <div class="pg-pv-conflict-icon"><i class="ti ti-alert-triangle"></i></div>
            <div class="pg-pv-conflict-title">Zaman çakışması</div>
            <div class="pg-pv-conflict-msg">
                <b>${esc(timeStart)}–${esc(timeEnd)}</b> saat aralığında ${studentName ? `<b>${esc(studentName)}</b>'nin` : 'öğrencinin'} planında başka bir görevi görünüyor.
                Yine de bu saate ders eklemek istiyor musunuz?
            </div>
            <label class="pg-pv-conflict-suppress">
                <input type="checkbox" id="pg-pv-conflict-suppress-chk">
                Bu uyarıyı bir daha gösterme (bu oturum için)
            </label>
            <div class="pg-pv-conflict-actions">
                <button type="button" class="pg-pv-conflict-btn pg-pv-conflict-cancel" id="pg-pv-conflict-cancel">Vazgeç</button>
                <button type="button" class="pg-pv-conflict-btn pg-pv-conflict-confirm" id="pg-pv-conflict-confirm">Yine de Ekle</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    overlay.querySelector('#pg-pv-conflict-cancel').addEventListener('click', close);
    overlay.querySelector('#pg-pv-conflict-confirm').addEventListener('click', () => {
        if (overlay.querySelector('#pg-pv-conflict-suppress-chk')?.checked) pvSuppressBusyWarning = true;
        close();
        onConfirm();
    });
}

// planning.js openPlanView() yeni bir hedef açarken çağırıyor — eski
// hedefin dolu-saat state'i yeni hedefe sızmasın diye.
function _pvResetBusyState() {
    pvShowBusy = false;
    pvBusySlots = null;
    pvBusyStudentId = null;
    pvBusySlotsLoaded = false;
    pvSuppressBusyWarning = false;
}

// planning.js'in "çakışan saat" mesajında öğrenci adını göstermek için —
// önbellekteki üye listesinden isim arar, dışarıya ham cache nesnesini
// sızdırmadan.
function _pvGetCachedGroupMemberName(studentId) {
    if (!studentId) return null;
    const m = pvGroupMembersCache?.members.find(x => x.id === studentId);
    return m?.display_name || m?.username || null;
}

function _pvGetSuppressBusyWarning() { return pvSuppressBusyWarning; }

export {
    _pvBusyTargetStudentId, _pvGroupMembers, _pvLoadBusySlots, _pvIsBusyHour,
    _pvIsBusyDay, _pvBusyToggleBtn, _pvBindBusyToggle, _pvBusyConflict,
    _pvShowConflictModal, _pvResetBusyState, _pvGetCachedGroupMemberName,
    _pvGetSuppressBusyWarning
};
