// social-institution-classroom-insights-data.js
// social-institution-classroom-insights.js'ten çıkarıldı: Sınıf Paneli için ham veri
// çekme katmanı (_fetchClassroomTabData). Hiçbir DOM'a dokunmaz, sadece Supabase
// sorgularını yapıp saf bir sonuç nesnesi döner. Davranış birebir aynı, sadece konum
// değişti — social-institution-classroom-insights.js bu fonksiyonu re-export eder.
import { getCurrentUser } from './state/current-user-store.js';

// Sınıf Paneli için ham veri çekme + şekillendirme — renderClassroomTab'in
// (Faz S devamı, dev fonksiyon refactoru) veri katmanı. Hiçbir DOM'a
// dokunmaz, sadece Supabase sorgularını yapıp saf bir sonuç nesnesi döner —
// renderClassroomTab bunu orkestre edip aşağı akış builder'lara (build*SectionData)
// dağıtır. Davranış birebir aynı, sadece konum değişti.
export async function _fetchClassroomTabData(data, isClassAdmin) {
    // Şubeler (116) — bu grubun İÇİNDEKİ sınıf/şube etiketleri (ör. "9-A", "10-B").
    // Ayrı bir grup DEĞİL — Performans/Öğrenciler sekmelerinde öğrencileri gruplamak için.
    const { data: classSectionsRaw } = isClassAdmin
        ? await window.FocusSupabase.from('group_class_sections').select('id, name').eq('group_id', data._supaId).order('name')
        : { data: null };
    const classSections = (classSectionsRaw || []).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    const sectionNameById = {};
    classSections.forEach(s => { sectionNameById[s.id] = s.name; });

    // Performans istatistikleri + aylık rapor (sadece yönetici) + ödevler paralel yüklenir
    const [statsRes, catRes, asgRes, tplRes, schedRes, focusHistRes] = await Promise.all([
        isClassAdmin
            ? window.FocusSupabase.rpc('group_weekly_member_stats', { p_group_id: data._supaId })
            : Promise.resolve({ data: null }),
        // Konu/alan bazlı haftalık dağılım (094) — "hangi alana ne kadar zaman ayrılıyor"
        isClassAdmin
            ? window.FocusSupabase.rpc('group_weekly_category_breakdown', { p_group_id: data._supaId })
            : Promise.resolve({ data: null }),
        window.FocusSupabase.from('classroom_assignments')
            .select('*').eq('group_id', data._supaId)
            .order('created_at', { ascending: false }).limit(30),
        isClassAdmin
            ? window.FocusSupabase.from('assignment_templates').select('*').eq('group_id', data._supaId)
                .order('created_at', { ascending: false }).limit(20)
            : Promise.resolve({ data: null }),
        // Ders Programı (095, 104) — sadece 'published' program tüm üyelere görünür;
        // taslaklar yalnızca oluşturan admine görünür (RLS ile korunur).
        window.FocusSupabase.from('group_schedule_programs')
            .select('id, name, status, class_section_id, created_by, created_at, published_at').eq('group_id', data._supaId)
            .order('created_at', { ascending: false }),
        // Z-skor bazlı anomali tespiti (109) — sabit "%60 düştü" eşiği yerine her öğrencinin
        // KENDİ 8 haftalık geçmişine göre normal dalgalanma sınırının dışına çıkıp çıkmadığını
        // ölçer. RPC henüz canlıya uygulanmadıysa (migration 109) sessizce boş döner, eski
        // sabit-eşik mantığına (bkz. FOCUS_DROP_FIXED_THRESHOLD) geri düşülür.
        isClassAdmin
            ? Promise.resolve(window.FocusSupabase.rpc('group_weekly_focus_history', { p_group_id: data._supaId, p_weeks_back: 8 })).catch(() => ({ data: null }))
            : Promise.resolve({ data: null })
    ]);
    const assignments = asgRes.data || [];
    const templates = tplRes.data || [];
    // Sınıflar/Öğrenciler sekmesi için: aynı kurumdaki diğer sınıflar (öğrenci taşıma
    // ve "Sınıflar" alt-görünümü için) + kurumun tüm sınıflarının üye listesi.
    let siblingClasses = [];
    let myInstitutionId = null;
    let allInstitutionClasses = []; // [{id, code, name, members:[{userId,displayName}]}] — mevcut sınıf dahil
    if (isClassAdmin) {
        const { data: ownGroup } = await window.FocusSupabase
            .from('groups').select('institution_id').eq('id', data._supaId).maybeSingle();
        myInstitutionId = ownGroup?.institution_id || null;
        if (myInstitutionId) {
            const { data: sibs } = await window.FocusSupabase
                .from('groups').select('id, code, name').eq('institution_id', myInstitutionId).neq('id', data._supaId);
            siblingClasses = sibs || [];
            const allClassIds = [data._supaId, ...siblingClasses.map(g => g.id)];
            const { data: allMemberRows } = await window.FocusSupabase
                .from('group_members').select('group_id, user_id, role, profiles(id, username, display_name, avatar_color, custom_avatar, avatar_initials)').in('group_id', allClassIds);
            const membersByGroup = {};
            (allMemberRows || []).forEach(r => {
                if (!r.profiles || r.role === 'admin') return; // öğretmen/kurucu kendi sınıfının öğrenci listesinde görünmesin
                (membersByGroup[r.group_id] = membersByGroup[r.group_id] || []).push({
                    userId: r.user_id, displayName: r.profiles.display_name || r.profiles.username,
                    avatarColor: r.profiles.avatar_color || '6c5ce7', customAvatar: r.profiles.custom_avatar || null, avatarInitials: r.profiles.avatar_initials || null,
                });
            });
            allInstitutionClasses = [{ id: data._supaId, code: data.code, name: data.name }, ...siblingClasses].map(g => ({
                id: g.id, code: g.code, name: g.name, members: (membersByGroup[g.id] || []).sort((a,b) => (a.displayName||'').localeCompare(b.displayName||'', 'tr'))
            }));
            // Sınıf kartlarında mini özet (haftalık ort. odak dk) için — tek toplu RPC
            // (107_group_weekly_class_average_batch), önceden sınıf başına ayrı bir RPC
            // çağrısıydı (N+1); RPC yalnızca aramayı yapan kullanıcının üyesi olduğu
            // sınıflar için satır döner, sınıfı kuran öğretmen genelde tüm sınıflara üye
            // olduğundan pratikte çalışır; üye olmadığı sınıflarda avgMinutes null kalır.
            let avgRows = null;
            try {
                const res = await window.FocusSupabase
                    .rpc('group_weekly_class_average_batch', { p_group_ids: allInstitutionClasses.map(g => g.id) });
                avgRows = res.data;
            } catch (_e) { avgRows = null; }
            const avgByGroup = {};
            (avgRows || []).forEach(r => { avgByGroup[r.group_id] = r; });
            allInstitutionClasses.forEach(g => { g.avgMinutes = avgByGroup[g.id] ? Math.round(avgByGroup[g.id].avg_minutes) : null; });
        }
    }
    // Teslimler: RLS gereği yönetici hepsini, üye kendininkini görür
    const subsByAsg = {};
    const subNotes = {}; // assignment_id -> { user_id: note }
    const subGrades = {}; // assignment_id -> { user_id: { grade, teacher_feedback } }
    const mySubs = new Set();
    const myGrades = {}; // assignment_id -> { grade, teacher_feedback } (öğrenci kendi notu)
    const mySubmittedAt = {}; // assignment_id -> submitted_at (geç teslim tespiti için)
    const mySubAttachment = {}; // assignment_id -> attachment
    const submittedAtByAsgUser = {}; // assignment_id -> { user_id: submitted_at } — rapor için (geç teslim tespiti, herhangi bir öğrenci)
    if (assignments.length) {
        const { data: subs } = await window.FocusSupabase
            .from('assignment_submissions')
            .select('assignment_id, user_id, note, grade, teacher_feedback, submitted_at, attachment')
            .in('assignment_id', assignments.map(a => a.id));
        (subs || []).forEach(s => {
            (subsByAsg[s.assignment_id] = subsByAsg[s.assignment_id] || []).push(s.user_id);
            if (s.note) (subNotes[s.assignment_id] = subNotes[s.assignment_id] || {})[s.user_id] = s.note;
            if (s.grade != null || s.teacher_feedback) {
                (subGrades[s.assignment_id] = subGrades[s.assignment_id] || {})[s.user_id] = { grade: s.grade, teacher_feedback: s.teacher_feedback };
            }
            (submittedAtByAsgUser[s.assignment_id] = submittedAtByAsgUser[s.assignment_id] || {})[s.user_id] = s.submitted_at;
            if (s.user_id === getCurrentUser().id) {
                mySubs.add(s.assignment_id);
                mySubmittedAt[s.assignment_id] = s.submitted_at;
                if (s.attachment) mySubAttachment[s.assignment_id] = s.attachment;
                if (s.grade != null || s.teacher_feedback) myGrades[s.assignment_id] = { grade: s.grade, teacher_feedback: s.teacher_feedback };
            }
        });
    }
    // Adım ilerlemesi (çok adımlı ödev / ders planı): assignment_id -> user_id -> Set(step_id)
    const stepDoneByAsg = {};
    const multiStepAsgIds = assignments.filter(a => a.steps && a.steps.length).map(a => a.id);
    if (multiStepAsgIds.length) {
        const { data: stepRows } = await window.FocusSupabase
            .from('assignment_step_progress')
            .select('assignment_id, user_id, step_id')
            .in('assignment_id', multiStepAsgIds).eq('done', true);
        (stepRows || []).forEach(r => {
            const m = (stepDoneByAsg[r.assignment_id] = stepDoneByAsg[r.assignment_id] || {});
            (m[r.user_id] = m[r.user_id] || new Set()).add(r.step_id);
        });
    }
    return {
        classSections, sectionNameById, statsRes, catRes, assignments, templates,
        schedRes, focusHistRes, allInstitutionClasses,
        subsByAsg, subNotes, subGrades, mySubs, myGrades, mySubmittedAt, mySubAttachment,
        submittedAtByAsgUser, stepDoneByAsg
    };
}
