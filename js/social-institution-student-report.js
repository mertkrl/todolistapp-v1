import { fmtDate } from './planning-utils.js';
// social-institution-student-report.js
// social-institution-panel.js'ten çıkarıldı (Faz refactor turu, 2. tur):
// "Öğrenci Raporu (PDF)" üretici — Sınıf/Ekip Paneli'nin "Rapor" sekmesinden
// çağrılır, tarayıcının "Yazdır → PDF olarak kaydet" akışını kullanan
// bağımsız bir yardımcı fonksiyon.
//
// Bağımsız doğrulama: _cpGenerateStudentReport panel.js içinde SADECE
// renderClassroomTab'in Rapor sekmesinden çağrılıyor (tek çağrı noktası),
// başka hiçbir yerden çağrılmıyor/tüketilmiyor — bu yüzden panel.js'te KALAN
// renderClassroomTab, bu fonksiyonu artık gerçek `import` ile geri alıyor.
//
// CP_CATEGORY_META burada panel.js'teki aynı sabitin KÜÇÜK bir kopyasıdır
// (panel.js'teki _renderCategoryBreakdownHtml de kendi kopyasını kullanıyor) —
// döngüsel import'tan kaçınmak için bilinçli olarak kopyalandı; sadece
// dekoratif etiket/ikon/renk verisi, iki kopyanın senkron kalması kritik değil
// (uygulamanın genel yaşam-alanı kategorileri değişirse ikisi de ayrı
// güncellenmeli — bu zaten önceki refactor turlarında da böyleydi).
const CP_CATEGORY_META = {
    egitim:  { label: 'Eğitim',  icon: '🧠', color: '#7c6eff' },
    saglik:  { label: 'Sağlık',  icon: '💪', color: '#ef476f' },
    kariyer: { label: 'Kariyer', icon: '💼', color: '#06d6a0' },
    finans:  { label: 'Finans',  icon: '💰', color: '#ffd166' },
    kisisel: { label: 'Kişisel', icon: '🌱', color: '#ff9f43' },
    diger:   { label: 'Diğer',   icon: '✨', color: '#a78bfa' },
};

// ─── ÖĞRENCİ RAPORU (PDF) ─────────────────────────────────────────
// Sınıf/Ekip Paneli'nin "Rapor" sekmesinden çağrılır. Üç okuyucu gözetilerek
// tasarlandı: ÖĞRETMEN (hızlıca "bu öğrenci nasıl gidiyor" görmek/velinin eline
// vermek için), ÖĞRENCİ (kendi durumunu somut sayılarla görmek için), PSİKOLOG/
// DANIŞMAN (odaklanma tutarlılığı + ödev disiplini gibi davranışsal göstergeler —
// yargılayıcı değil, betimleyici dille). PDF çıktısı için tarayıcının kendi
// "Yazdır → PDF olarak kaydet" akışı kullanılıyor (harici kütüphane/CDN'siz,
// Türkçe karakterler için en güvenilir yol — jsPDF gömülü fontlarda ı/ş/ğ gibi
// karakterlerde sorun çıkarabiliyor).
// _cpGenerateStudentReport'tan ayrılan: rapor için gereken tüm veriyi hesaplar (DOM/pencere yazmaz).
// Faz S devamı, dev fonksiyon refactoru.
async function _cpComputeStudentReportData({ data, assignments, subsByAsg, subGrades, stepDoneByAsg, submittedAtByAsgUser, scheduleRows, studentUserId }) {
        // ── Odaklanma verisi: son 8 hafta günlük istatistik ──
        // daily_stats'ın RLS'i sadece "user_id = auth.uid()" satırlarına izin verir; yönetici
        // başka bir üyenin verisini isteyince doğrudan tablo sorgusu boş dönerdi — bu yüzden
        // 096_group_member_daily_stats.sql'deki SECURITY DEFINER RPC kullanılıyor (grup admini
        // veya kullanıcının kendisi için, stats_hidden_from_institution'a saygı gösterir).
        const since = new Date(Date.now() - 56 * 24 * 3600 * 1000).toISOString().slice(0, 10);
        const { data: dailyRows } = await window.FocusSupabase
            .rpc('group_member_daily_stats', { p_group_id: data._supaId, p_user_id: studentUserId, p_since: since });
        const rows = dailyRows || [];
        const totalMinutes = rows.reduce((s, r) => s + (r.focus_minutes || 0), 0);
        const activeDays = rows.filter(r => (r.focus_minutes || 0) > 0).length;
        // Haftalık kova (bu hafta dahil son 8 hafta), en yeni en sonda
        const weekBuckets = Array.from({ length: 8 }, () => 0);
        const now = new Date();
        rows.forEach(r => {
            const daysAgo = Math.floor((now - new Date(r.stat_date)) / (24 * 3600 * 1000));
            const bucket = 7 - Math.min(7, Math.floor(daysAgo / 7));
            if (bucket >= 0) weekBuckets[bucket] += (r.focus_minutes || 0);
        });
    
        // ── Ödevler: bu öğrenciye atanmış olanlar + durumu ──
        const myAssignments = assignments.filter(a => {
            const targets = a.target_user_ids;
            return !targets || !targets.length || targets.includes(studentUserId);
        });
        let completedCount = 0, lateCount = 0;
        const asgRows = myAssignments.map(a => {
            const isMultiStep = !!(a.steps && a.steps.length);
            let completed;
            if (isMultiStep) {
                const doneSet = stepDoneByAsg[a.id]?.[studentUserId] || new Set();
                completed = a.steps.every(s => doneSet.has(s.id));
            } else {
                completed = !!(subsByAsg[a.id] || []).includes(studentUserId);
            }
            const submittedAt = submittedAtByAsgUser[a.id]?.[studentUserId] || null;
            const late = completed && a.due_date && submittedAt && new Date(submittedAt) > new Date(a.due_date);
            const grade = subGrades[a.id]?.[studentUserId];
            if (completed) completedCount++;
            if (late) lateCount++;
            return { title: a.title, due_date: a.due_date, completed, late, isMultiStep, grade };
        }).sort((a, b) => (b.due_date || '').localeCompare(a.due_date || ''));
        const completionRate = myAssignments.length ? Math.round((completedCount / myAssignments.length) * 100) : null;
    
        // ── Bireysel alan dağılımı (kök neden analizi) ──
        // Sınıf paneli sadece SINIF GENELİNDE kategori kırılımı gösteriyordu; bir öğrencinin
        // "Ani Düşüş" ya da "Efor Karşılıksız" anomalisinin HANGİ alanda (Eğitim/Kariyer/...)
        // yoğunlaştığını görmek, öğretmene "genel bir yorgunluk mu yoksa tek derse özgü bir
        // sorun mu" ayrımını verir (bkz. performans analizi, 2026-07-11). 113 migration'ıyla
        // group_member_daily_stats artık category_minutes de döndürüyor.
        const catTotals = {};
        rows.forEach(r => {
            Object.entries(r.category_minutes || {}).forEach(([k, v]) => {
                catTotals[k] = (catTotals[k] || 0) + (Number(v) || 0);
            });
        });
        const catRows = Object.entries(catTotals)
            .map(([category, minutes]) => ({ category, minutes }))
            .filter(r => r.minutes > 0)
            .sort((a, b) => b.minutes - a.minutes);
        const catGrandTotal = catRows.reduce((s, r) => s + r.minutes, 0);
    
        // ── Ders programı (sınıfın haftalık programı — herkes için ortak) ──
        const byDay = {};
        (scheduleRows || []).forEach(r => { (byDay[r.day_of_week] = byDay[r.day_of_week] || []).push(r); });
    
        const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
        const today = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
        return { totalMinutes, activeDays, weekBuckets, myAssignments, asgRows, completedCount, lateCount, completionRate, catRows, catGrandTotal, byDay, fmtDate, today, rows };
}

// _cpGenerateStudentReport'tan ayrılan: hesaplanan veriden yazdırılabilir rapor HTML'ini üretir.
// Faz S devamı, dev fonksiyon refactoru.
function _cpBuildStudentReportHtml({ data, isWork, memberLabel, DAY_NAMES_TR, studentName, totalMinutes, activeDays, weekBuckets, myAssignments, asgRows, completedCount, lateCount, completionRate, catRows, catGrandTotal, byDay, fmtDate, today, rows }) {
    return `<!doctype html><html lang="tr"><head><meta charset="utf-8">
    <title>${window._escapeHtml(studentName)} — ${isWork ? 'Çalışan' : 'Öğrenci'} Raporu</title>
    <style>
        * { box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 32px 40px; }
        h1 { font-size: 20px; margin: 0 0 2px; }
        .sub { color: #666; font-size: 12px; margin: 0 0 22px; }
        .kpi-row { display: flex; gap: 12px; margin-bottom: 24px; }
        .kpi { flex: 1; border: 1px solid #ddd; border-radius: 8px; padding: 10px 12px; text-align: center; }
        .kpi b { display: block; font-size: 20px; }
        .kpi span { font-size: 10.5px; color: #666; }
        h2 { font-size: 14px; border-bottom: 2px solid #333; padding-bottom: 4px; margin: 26px 0 10px; }
        table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
        th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #eee; }
        th { color: #555; font-weight: 600; background: #f7f7f7; }
        .ok { color: #1a9e5e; font-weight: 600; }
        .warn { color: #d97706; font-weight: 600; }
        .bad { color: #c0392b; font-weight: 600; }
        .muted { color: #888; }
        .foot { margin-top: 30px; font-size: 10px; color: #999; text-align: right; }
        @media print { body { padding: 14mm 16mm; } }
    </style></head><body>
        <h1>${window._escapeHtml(studentName)} — ${isWork ? 'Çalışan' : 'Öğrenci'} Raporu</h1>
        <p class="sub">${window._escapeHtml(data.name || '')}${data.institutionName ? ' · ' + window._escapeHtml(data.institutionName) : ''} · Oluşturulma: ${today}</p>

        <div class="kpi-row">
            <div class="kpi"><b>${myAssignments.length}</b><span>Atanan ${memberLabel === 'Çalışan' ? 'Görev' : 'Ödev'}</span></div>
            <div class="kpi"><b>${completedCount}</b><span>Tamamlanan</span></div>
            <div class="kpi"><b>${completionRate === null ? '—' : completionRate + '%'}</b><span>Tamamlama Oranı</span></div>
            <div class="kpi"><b>${lateCount}</b><span>Geç Teslim</span></div>
            <div class="kpi"><b>${formatFocusMinutes(totalMinutes)}</b><span>Son 8 Hafta Odak</span></div>
            <div class="kpi"><b>${activeDays}</b><span>Aktif Gün (8 hf)</span></div>
        </div>

        <h2>Ders Programı</h2>
        ${scheduleRows && scheduleRows.length ? `
        <table>
            <thead><tr><th>Gün</th><th>Saat</th><th>Ders</th><th>Konum</th></tr></thead>
            <tbody>
                ${DAY_NAMES_TR.map((day, i) => (byDay[i] || []).map(r => `
                <tr><td>${day}</td><td>${(r.time_start||'').slice(0,5)}–${(r.time_end||'').slice(0,5)}</td><td>${window._escapeHtml(r.subject||'')}</td><td>${window._escapeHtml(r.location||'') || '—'}</td></tr>`).join('')).join('')}
            </tbody>
        </table>` : `<p class="muted">Bu grup için henüz bir ders programı girilmemiş.</p>`}

        <h2>${memberLabel === 'Çalışan' ? 'Görev' : 'Ödev'} Geçmişi</h2>
        ${asgRows.length ? `
        <table>
            <thead><tr><th>Başlık</th><th>Teslim Tarihi</th><th>Durum</th><th>Not</th></tr></thead>
            <tbody>
                ${asgRows.map(a => `
                <tr>
                    <td>${window._escapeHtml(a.title)}${a.isMultiStep ? ' <span class="muted">(çok adımlı)</span>' : ''}</td>
                    <td>${fmtDate(a.due_date)}</td>
                    <td>${a.completed ? (a.late ? '<span class="warn">Geç Teslim</span>' : '<span class="ok">Tamamlandı</span>') : '<span class="bad">Bekliyor</span>'}</td>
                    <td>${a.grade?.grade != null ? a.grade.grade + '/100' : '—'}</td>
                </tr>`).join('')}
            </tbody>
        </table>` : `<p class="muted">Henüz bu ${memberLabel.toLowerCase()}e atanmış bir kayıt yok.</p>`}

        <h2>Odaklanma Özeti (Son 8 Hafta)</h2>
        ${rows.length ? `
        <table>
            <thead><tr><th>Hafta</th><th>Toplam Odak</th></tr></thead>
            <tbody>
                ${weekBuckets.map((v, i) => `
                <tr><td>${i === 7 ? 'Bu hafta' : `${7 - i} hafta önce`}</td><td>${formatFocusMinutes(v)}</td></tr>`).join('')}
            </tbody>
        </table>
        <p class="muted u-margin-top-10px_font-size-11px" >Bu tablo betimleyicidir; tek bir düşük hafta bir sorun anlamına gelmeyebilir — asıl anlamlı olan zaman içindeki tutarlılıktır.</p>` : `<p class="muted">Son 8 haftada kayıtlı odaklanma verisi bulunamadı.</p>`}

        <h2>Alan Dağılımı (Son 8 Hafta)</h2>
        ${catRows.length ? `
        <table>
            <thead><tr><th>Alan</th><th>Toplam</th><th class="u-width-50pct">Pay</th></tr></thead>
            <tbody>
                ${catRows.map(r => {
                    const meta = CP_CATEGORY_META[r.category] || { label: r.category, icon: '•', color: '#888' };
                    const pct = Math.max(2, Math.round((r.minutes / catGrandTotal) * 100));
                    return `
                <tr>
                    <td>${meta.icon} ${window._escapeHtml(meta.label)}</td>
                    <td>${formatFocusMinutes(r.minutes)}</td>
                    <td><div class="u-background-heee_border-radius-4px_overflow-hidden_height-1"><div class="cp-bar-fill u-height-100pct" data-bar-pct="${pct}" data-bar-color="${window._escapeHtml(meta.color)}" ></div></div></td>
                </tr>`;
                }).join('')}
            </tbody>
        </table>
        <p class="muted u-margin-top-10px_font-size-11px" >Uygulamanın genel yaşam-alanı kategorileri (Eğitim/Kariyer/Kişisel gelişim...) — ders bazlı bir ayrım değildir. Bir anomalinin tek bir alanda mı yoksa genelde mi olduğunu ayırt etmek için kullanılabilir.</p>` : `<p class="muted">Son 8 haftada alan bazlı kayıtlı veri bulunamadı.</p>`}

        <p class="foot">FocusAI tarafından otomatik oluşturulmuştur · ${today}</p>
    </body></html>`;
}

export async function _cpGenerateStudentReport({ data, isWork, memberLabel, assignments, subsByAsg, subGrades, stepDoneByAsg, submittedAtByAsgUser, scheduleRows, DAY_NAMES_TR, studentUserId, studentName }) {
    const { totalMinutes, activeDays, weekBuckets, myAssignments, asgRows, completedCount, lateCount, completionRate, catRows, catGrandTotal, byDay, fmtDate, today, rows } =
        await _cpComputeStudentReportData({ data, assignments, subsByAsg, subGrades, stepDoneByAsg, submittedAtByAsgUser, scheduleRows, studentUserId });

    const html = _cpBuildStudentReportHtml({ data, isWork, memberLabel, DAY_NAMES_TR, studentName, totalMinutes, activeDays, weekBuckets, myAssignments, asgRows, completedCount, lateCount, completionRate, catRows, catGrandTotal, byDay, fmtDate, today, rows });


    const win = window.open('', '_blank');
    if (!win) throw new Error('Açılır pencere engellendi. Lütfen tarayıcı ayarlarından izin ver.');
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.document.querySelectorAll('.cp-bar-fill').forEach(el => {
        el.style.width = el.dataset.barPct + '%';
        el.style.background = el.dataset.barColor;
    });
    win.focus();
    setTimeout(() => { win.print(); }, 300);
}
