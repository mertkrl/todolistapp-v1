// social-institution-panel.js
// social.js'ten çıkarıldı (Faz 5/6): Kurum/Sınıf Paneli — öğretmenin sahip
// olduğu kurumlar + sınıf grupları, ödevler, ders programı, performans/
// liderlik, öğrenci raporu, program şablonları, kısayol widget'ı vb.
// ~4555 satır, ~55 kardeş fonksiyon (tek dev fonksiyon DEĞİL — önceki analiz
// yanlıştı, gerçekte kendi kapsamında büyük ölçüde izole bir bölüm).
//
// Köprüler:
//  - _isInstitutionalAdmin, renderClassroomTabCached, renderClassroomInsightsPanel,
//    renderInstitutionalOverviewIntro, computeActiveNowCount: ÖNCEDEN (Faz 5,
//    social-group-details.js çıkarması sırasında) window'a atanmıştı, o atama
//    satırları bu modüle fonksiyonlarıyla BİRLİKTE taşındı.
//  - window.getMyGroupsDataCache()/__setMyGroupsDataCacheRef(): social.js'te
//    tanımlı _myGroupsDataCache state'i için (bu modül hem okuyor hem reassign
//    ediyor).
//  - window.computeUserInterestCategoriesSupabase()/window.renderDiscoverGroups():
//    social-group-discover.js'te tanımlı (aynı anda çıkarılan kardeş modül).
//
// Faz refactor turu: Sınıf/Şube modalları (Yeni Sınıf/Sınıf Detayı/Ders
// Programı/Şube Detayı) social-institution-class-modals.js'e çıkarıldı,
// gerçek ES import ile geri alınıyor (aşağıdaki renderClassroomTab bu
// fonksiyonları çağırıyor).
//
// Faz refactor turu (2. tur): "Kurumum" modalı + "Gruplarım" listesi (Supabase
// realtime) + grup davet mini modalı social-institution-my-groups.js'e
// çıkarıldı — bağımlılık doğrulaması bu 3 fonksiyonun panel.js'in geri
// kalanından (renderClassroomTab dahil) HİÇ çağrılmadığını, sadece window.*
// köprüsüyle (social.js/social-group-details.js) tüketildiğini gösterdi, bu
// yüzden panel.js tarafında geriye import edilmesine gerek yok — sadece
// side-effect import'la (window.* köprülerinin kurulması için) yükleniyor.
//
// Aynı tur: _cpGenerateStudentReport (Öğrenci Raporu/PDF üretici) — tek çağrı
// noktası renderClassroomTab'in Rapor sekmesi, bu yüzden
// social-institution-student-report.js'e çıkarılıp gerçek import ile geri
// alındı. O dosyadaki CP_CATEGORY_META, aşağıdaki _renderCategoryBreakdownHtml'in
// kullandığı sabitin bilinçli KÜÇÜK bir kopyasıdır (döngüsel import'tan kaçınmak
// için — sadece dekoratif etiket verisi, kritik değil).
import './social-institution-my-groups.js';
import { _cpGenerateStudentReport } from './social-institution-student-report.js';
import {
    _cpOpenScheduleModal,
    _cpOpenScheduleViewModal,
    _cpOpenSectionDetailModal,
    _cpPatchMemberSection,
    _cpRosterPatchRowAfterMove,
    _cpRosterPatchSectionsPanelAfterMove,
    _cpSchedShowBuilder,
} from './social-institution-class-modals.js';

       // Sınıf/Ekip Paneli'nde "yönetici misin" kontrolü tek bir yere toplandı — önceden sadece
       // grup sahibi (isOwner) veya group_members.role==='admin' bakılıyordu; bir öğretmenin kurumsal
       // rolü (institutionRole) olduğu halde bu grupta üyelik satırı henüz 'admin' olarak
       // işaretlenmemişse (senkron gecikmesi/eksik veri) KPI ve performans panelleri sessizce
       // hiç görünmüyordu. institutionRole==='teacher' de artık ayrıca kabul ediliyor.
       window._isInstitutionalAdmin = (data, isOwner) => _isInstitutionalAdmin(data, isOwner); // Faz 5: social-group-details.js için
       function _isInstitutionalAdmin(data, isOwner) {
           const myRole = data.members?.[window.currentUser?.username]?.role;
           return !!(isOwner || myRole === 'admin' || window.currentUser?.institutionRole === 'teacher');
       }

       // Uygulamanın genel yaşam-alanı kategorileri (planning.js'deki CATEGORIES ile aynı küme) —
       // gerçek "ders" (Matematik/Fizik/...) etiketleme sistemi yok, bu bir yaklaşık/proxy dağılımdır.
       const CP_CATEGORY_META = {
           egitim:  { label: 'Eğitim',  icon: '🧠', color: '#7c6eff' },
           saglik:  { label: 'Sağlık',  icon: '💪', color: '#ef476f' },
           kariyer: { label: 'Kariyer', icon: '💼', color: '#06d6a0' },
           finans:  { label: 'Finans',  icon: '💰', color: '#ffd166' },
           kisisel: { label: 'Kişisel', icon: '🌱', color: '#ff9f43' },
           diger:   { label: 'Diğer',   icon: '✨', color: '#a78bfa' },
       };
       function _renderCategoryBreakdownHtml(rows, opts) {
           if (!rows || !rows.length) return '';
           const total = rows.reduce((s, r) => s + (r.minutes || 0), 0);
           if (!total) return '';
           const scopeLabel = opts?.scopeLabel || 'bu hafta, sınıf geneli';
           const captionText = opts?.captionText || 'Sınıfın bu hafta odaklandığı zamanın alanlara dağılımı (uygulamanın genel Eğitim/Kariyer/Kişisel gelişim kategorileri — ders bazlı bir ayrım değil).';
           return `
               <div class="cp-section-title" style="margin-top:22px;">
                   <i class="fa-solid fa-chart-pie" style="color:#7c6eff;"></i> Alan Dağılımı <small>${scopeLabel}</small>
               </div>
               <p class="cp-hint" style="margin:-4px 0 10px;">${captionText}</p>
               <div class="cp-cat-breakdown">
                   ${rows.map(r => {
                       const meta = CP_CATEGORY_META[r.category] || { label: r.category, icon: '•', color: '#888' };
                       const pct = Math.max(2, Math.round((r.minutes / total) * 100));
                       return `
                       <div class="cp-cat-row">
                           <span class="cp-cat-label">${meta.icon} ${meta.label}</span>
                           <div class="cp-cat-bar-track"><div class="cp-cat-bar-fill" style="width:${pct}%; background:${meta.color};"></div></div>
                           <span class="cp-cat-minutes">${formatFocusMinutes(r.minutes)}</span>
                       </div>`;
                   }).join('')}
               </div>`;
       }

       // Sınıf/Şube modalları (Yeni Sınıf/Sınıf Detayı/Ders Programı/Şube Detayı)
       // social-institution-class-modals.js'e çıkarıldı (Faz refactor turu).

       // ─── SINIF / EKİP PANELİ (Faz 3 — kurumsal, ödeme hariç) ─────────
       // classroom/workplace tipi gruplarda görünen sekme. Yönetici (kurucu veya
       // admin rolü) öğrenci performans tablosu + ödev yönetimi görür; üyeler
       // aktif ödevleri görüp "Yaptım" işaretler. Veri kaynakları zaten canlıda:
       // group_weekly_member_stats RPC (037), classroom_assignments +
       // assignment_submissions (044) — bu sekme o altyapının ilk arayüzü.
       //
       // Ek dosyaların imzalı URL'leri 7 gün geçerli ama önceden panel her açılışta
       // sıfırdan üretiliyordu (gereksiz Storage API çağrısı). bucket_path başına
       // module-seviye bir cache — 6 gün TTL (7 günlük gerçek geçerlilikten kısa
       // tutulur ki süre dolmadan taze bir tane üretilsin).
       const _signedUrlCache = window._signedUrlCache || (window._signedUrlCache = new Map());
       const SIGNED_URL_TTL_MS = 6 * 24 * 60 * 60 * 1000;
       async function _getSignedUrlCached(bucketPath) {
           const cached = _signedUrlCache.get(bucketPath);
           if (cached && (Date.now() - cached.ts) < SIGNED_URL_TTL_MS) return cached.url;
           const { data: signed } = await window.FocusSupabase.storage.from('chat-files')
               .createSignedUrl(bucketPath, 60 * 60 * 24 * 7);
           if (signed?.signedUrl) {
               _signedUrlCache.set(bucketPath, { url: signed.signedUrl, ts: Date.now() });
               return signed.signedUrl;
           }
           return null;
       }
       async function renderClassroomTab(data, isClassAdmin) {
           const el = document.getElementById('group-gtab-classroom');
           if (!el || !window.FocusSupabase || !window.currentUser?.id || !data._supaId) return;
           // Tek satır "Yükleniyor…" yerine, gelecek panelin kabaca şeklini taklit eden iskelet
           el.innerHTML = `
               <div class="cp-skeleton">
                   <div class="cp-skel-strip"><div class="cp-skel-box"></div><div class="cp-skel-box"></div><div class="cp-skel-box"></div><div class="cp-skel-box"></div></div>
                   <div class="cp-skel-line" style="width:40%;"></div>
                   <div class="cp-skel-row"></div>
                   <div class="cp-skel-row"></div>
                   <div class="cp-skel-row"></div>
               </div>`;

           const isWork = data.classroomType === 'workplace';
           const memberLabel = isWork ? 'Çalışan' : 'Öğrenci';
           const nameById = {};
           Object.values(data.members || {}).forEach(m => { if (m.userId) nameById[m.userId] = m.displayName; });
           // Öğretmen/kurucu (role === 'admin') sınıfın kendi öğrenci listelerinde,
           // ödev hedef havuzunda ve Performans tablosunda görünmesin — "öğrenci" kavramı
           // yönetici olmayan üyelerdir (bkz. Sınıf Paneli tartışması, 2026-07-11).
           const studentMembers = Object.values(data.members || {}).filter(m => m.userId && m.role !== 'admin');
           const memberCount = studentMembers.length;

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
                   if (s.user_id === window.currentUser.id) {
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
           // Üye başına toplam ödev teslim sayısı (performans tablosu "Ödev" kolonu) —
           // çok adımlı ödevlerde "teslim" yerine "tüm adımları tamamladı" sayılır.
           const subsCountByUser = {};
           Object.values(subsByAsg).forEach(ids => ids.forEach(id => { subsCountByUser[id] = (subsCountByUser[id] || 0) + 1; }));
           assignments.filter(a => a.steps && a.steps.length).forEach(a => {
               Object.entries(stepDoneByAsg[a.id] || {}).forEach(([uid, doneSet]) => {
                   if (a.steps.every(s => doneSet.has(s.id))) subsCountByUser[uid] = (subsCountByUser[uid] || 0) + 1;
               });
           });
           // Üye başına atanmış ödev sayısı — hedefli (belirli kişilere) ödevler diğer üyelerin
           // paydasına dahil edilmesin diye
           const assignedCountByUser = {};
           assignments.forEach(a => {
               const targets = (a.target_user_ids && a.target_user_ids.length)
                   ? a.target_user_ids
                   : studentMembers.map(m => m.userId);
               targets.forEach(uid => { assignedCountByUser[uid] = (assignedCountByUser[uid] || 0) + 1; });
           });

           // ── Ödev Takibi (yönetici) — artık odak-süresi değil ÖDEV TAMAMLAMA merkezli.
           // Kaynak `statsRes` (bir RPC) değil doğrudan `data.members` — bir üye hiç odaklanmamış/
           // hiç ödev yapmamış olsa da (hatta stats RPC'si her nedense boş dönse de) satırı burada
           // görünmeye devam eder.
           //
           // Çerçeve bilinçli olarak "başarısızlık teşhiri" değil "destek sinyali" dilinde: varsayılan
           // sıralama alfabetik (öğretmen bir "en kötüden en iyiye" liste karşısında bulmaz kendini),
           // düşük tamamlama "kırmızı hata" rengi yerine amber "Destek Önerilir" rozetiyle işaretlenir,
           // ve öğretmen isterse "Desteğe İhtiyacı Olabilir" görünümüne kendi geçebilir. Filtre butonları
           // BİLEREK `.cp-subtab-btn` DEĞİL `.cp-perf-filter-btn` sınıfını kullanır — aksi halde
           // aşağıdaki genel ".cp-subtab-btn" delegasyon dinleyicisi (data-cpsub bekler) bu butonları da
           // yakalar ve hem ana sekmeleri hem de bu filtreyi bozar (bkz. wireKickBtns yakınındaki dinleyici).
           let perfHtml = '';
           let perfRows = [];
           // Bu grubun içinde şube (group_class_sections) tanımlıysa Performans tablosuna
           // "Sınıf" sütunu eklenir ve şubeye göre filtrelenebilir hale gelir — hiç şube
           // tanımlanmamışsa bu sütun anlamsız olacağından gizli kalır.
           const showClassColumn = classSections.length > 0;
           // tableRows: ana sınıf (perfRows, zengin analiz) + kardeş sınıfların temel satırları
           // birleşimi — hem burada (ilk render) hem de aşağıdaki wiring bloğunda (dönem/sınıf
           // değişince) kullanılabilsin diye üst kapsamda tutulur.
           let tableRows = [];
           const filterPerfRowsByClass = (classId, rows) => classId === 'all' ? rows : rows.filter(r => r.classId === classId);
           const pctColor = (pct) => pct === null ? '#888' : pct >= 80 ? '#06d6a0' : pct >= 50 ? '#feca57' : '#ff8f70';
           // Küçük örneklem eşiği: 5'in altındaki ödev sayısında % değeri tek bir ödevle 20+ puan
           // oynayabilir (1/4 → 2/4 = %25 → %50). Bu durumda tabloda "az veri" işareti gösterilir —
           // hem "Destek Önerilir" kararının hem de öğretmenin gözle yaptığı yorumun yanıltıcı
           // kesinlik hissi vermesini önlemek için (bkz. buildPerfRows içindeki lowSample).
           const LOW_SAMPLE_MAX = 5;
           const periodLabel = { all: 'tüm zamanlar', '7d': 'son 7 gün', '30d': 'son 30 gün' };
           // Dönem filtresi ödevin VERİLDİĞİ tarihe göre kapsam belirler (created_at) — "son 7 günde
           // verilen ödevlerin ne kadarı tamamlandı" sorusuna cevap verir. Odak dakikası/aktif gün
           // sütunları statsRes RPC'sinden geldiği için her zaman "bu hafta" — bu iki farklı zaman
           // penceresi karışmasın diye sütun başlığında ayrıca belirtiliyor.
           const buildPerfCounts = (period) => {
               const cutoff = period === '7d' ? Date.now() - 7 * 86400000 : period === '30d' ? Date.now() - 30 * 86400000 : null;
               const scoped = cutoff ? assignments.filter(a => a.created_at && new Date(a.created_at).getTime() >= cutoff) : assignments;
               const assignedByUser = {};
               const doneByUser = {};
               const now = new Date();
               scoped.forEach(a => {
                   // Bir öğrenci sadece "karar anı geçmiş" ödevlerden sorumlu tutulmalı — henüz
                   // açık ve son tarihi gelmemiş bir ödev, tamamlanmadıysa bile "kaçırılmış" gibi
                   // sayılmamalı (vakti henüz var). "Ödev Bazlı Analiz" (resolvedAsgRows) zaten
                   // sadece kapalı/süresi geçmiş ödevleri sayıyordu — bu, bireysel % hesabını da
                   // aynı adil kurala getiriyor. İstisna: öğrenci ödevi ZATEN erken tamamladıysa,
                   // süresi gelmeden de kendi lehine hemen sayılır (erken bitirmek cezalandırılmaz).
                   const resolved = a.status === 'closed' || (a.due_date && new Date(a.due_date) < now);
                   const targets = (a.target_user_ids && a.target_user_ids.length)
                       ? a.target_user_ids
                       : studentMembers.map(m => m.userId);
                   const isMultiStep = !!(a.steps && a.steps.length);
                   const doneMap = isMultiStep ? (stepDoneByAsg[a.id] || {}) : null;
                   const subUsers = isMultiStep ? null : (subsByAsg[a.id] || []);
                   targets.forEach(uid => {
                       const isDone = isMultiStep
                           ? !!(doneMap[uid] && a.steps.every(s => doneMap[uid].has(s.id)))
                           : subUsers.includes(uid);
                       if (!resolved && !isDone) return;
                       assignedByUser[uid] = (assignedByUser[uid] || 0) + 1;
                       if (isDone) doneByUser[uid] = (doneByUser[uid] || 0) + 1;
                   });
               });
               return { assignedByUser, doneByUser };
           };
           // Sıralanabilir sütun başlıkları: her başlığa tıklayınca o sütuna göre sıralar, tekrar
           // tıklayınca yönü (artan/azalan) çevirir — Excel/Sheets'teki sütun sıralaması gibi.
           // null/eksik değerler (ör. hiç ödevi olmayan öğrenci) her zaman sona atılır ki
           // "sıralanamayan" satırlar sıralamayı anlamsızlaştırmasın.
           const PERF_SORT_KEYS = {
               name: { get: r => r.name || '', type: 'text' },
               className: { get: r => r.className || '', type: 'text' },
               pct: { get: r => r.pct, type: 'num' },
               weekly_minutes: { get: r => r.weekly_minutes, type: 'num' },
               active_days: { get: r => r.active_days, type: 'num' },
           };
           const sortPerfRows = (key, dir, rows) => {
               const spec = PERF_SORT_KEYS[key] || PERF_SORT_KEYS.name;
               const mul = dir === 'desc' ? -1 : 1;
               const arr = [...rows];
               arr.sort((a, b) => {
                   const av = spec.get(a), bv = spec.get(b);
                   const aNull = av === null || av === undefined;
                   const bNull = bv === null || bv === undefined;
                   if (aNull && bNull) return (a.name || '').localeCompare(b.name || '', 'tr');
                   if (aNull) return 1;
                   if (bNull) return -1;
                   if (spec.type === 'text') return mul * String(av).localeCompare(String(bv), 'tr');
                   return mul * (av - bv);
               });
               return arr;
           };
           const renderPerfRowsHtml = (rows) => rows.map((r, i) => r.is_hidden ? `
               <div class="cp-row cp-row--admin${showClassColumn ? ' cp-row--withclass' : ''}">
                   <span>${i + 1}</span>
                   <span class="cp-name cp-perf-name-link" data-user-id="${r.user_id}" title="Rapor sekmesinde ${window._escapeHtml(r.name)} için detay aç">${window._escapeHtml(r.name)}</span>
                   ${showClassColumn ? `<span class="cp-perf-class-tag" title="${window._escapeHtml(r.className || '')}">${window._escapeHtml(r.className || '—')}</span>` : ''}
                   <span style="grid-column: span 4; color:var(--text-muted); font-size:12px;"><i class="fa-solid fa-lock"></i> İstatistiklerini gizledi</span>
                   <button class="cp-row-kick-btn" data-user-id="${r.user_id}" data-name="${window._escapeHtml(r.name)}" title="${memberLabel === 'Çalışan' ? 'Ekipten' : 'Sınıftan'} çıkar"><i class="fa-solid fa-user-xmark"></i></button>
               </div>` : `
               <div class="cp-row cp-row--admin${showClassColumn ? ' cp-row--withclass' : ''}${r.supportFlag ? ' cp-row--support' : ''}${r.anomaly ? ' cp-row--anomaly' : ''}">
                   <span>${i + 1}</span>
                   <span class="cp-name cp-perf-name-link" data-user-id="${r.user_id}" title="Rapor sekmesinde ${window._escapeHtml(r.name)} için detay aç">${window._escapeHtml(r.name)}${r.supportFlag ? '<span class="cp-support-badge"><i class="fa-solid fa-hand-holding-heart"></i> Destek Önerilir</span>' : ''}${r.anomaly ? `<span class="cp-anomaly-badge" title="${window._escapeHtml(r.anomalyDetail || anomalyMeta[r.anomaly].title)}"><i class="fa-solid fa-triangle-exclamation"></i> ${anomalyMeta[r.anomaly].label}</span>` : ''}${(r.contextNotes && r.contextNotes.length) ? `<span class="cp-context-note" title="${r.contextNotes.map(k => contextMeta[k].title).join(' • ')}"><i class="fa-solid fa-circle-info"></i> ${r.contextNotes.map(k => contextMeta[k].label).join(', ')}</span>` : ''}</span>
                   ${showClassColumn ? `<span class="cp-perf-class-tag" title="${window._escapeHtml(r.className || '')}">${window._escapeHtml(r.className || '—')}</span>` : ''}
                   <span class="cp-asg-pct-cell${r.lowSample ? ' cp-asg-pct-cell--lowsample' : ''}">
                       ${r.assigned ? `
                       <div class="cp-asg-pct-track"><div class="cp-asg-pct-fill" style="width:${r.pct}%; background-color:${pctColor(r.pct)};"></div></div>
                       <b style="color:${pctColor(r.pct)};">${r.done}/${r.assigned}</b>${r.lowSample ? `<span class="cp-lowsample-badge cp-lowsample-badge--icon" title="Az veri: sadece ${r.assigned} ödev üzerinden hesaplandı — bu kadar az veride % oranı tek bir ödevle bile büyük ölçüde değişebilir, ${r.done}/${r.assigned} rakamına bakmak daha güvenilir"><i class="fa-solid fa-circle-info"></i></span>` : ''}` : `<span style="color:var(--text-muted); font-size:11px;">Ödev yok</span>`}
                   </span>
                   <span class="cp-perf-trend-cell">${sparkHtml(r.trend)}${trendArrowHtml(r.trendDir)}</span>
                   <span class="cp-perf-focus-cell">${formatFocusMinutes(r.weekly_minutes)}${trendArrowHtml(r.focusTrendDir, focusTrendLabels)}</span>
                   <span class="cp-perf-active-cell">${r.active_days}/7</span>
                   <button class="cp-row-kick-btn" data-user-id="${r.user_id}" data-name="${window._escapeHtml(r.name)}" title="${memberLabel === 'Çalışan' ? 'Ekipten' : 'Sınıftan'} çıkar"><i class="fa-solid fa-user-xmark"></i></button>
               </div>`).join('');
           // ── Sınıf Dağılımı (kutu grafiği) ──
           // Tek bir öğrenciye "düşük" demek ancak sınıfın GENELİNİN nerede olduğu bilinirse
           // anlam kazanır (bkz. performans analizi: ortalama birkaç aşırı yüksek/düşük öğrenci
           // tarafından çarpıtılabilir, medyan daha dayanıklıdır). Bu kutu grafiği medyan + orta
           // %50 (çeyrekler arası aralık) + min-maks aralığını, ortalamayı (kesikli çizgi, medyandan
           // sapması varsa çarpıklığa işaret eder) ve her öğrencinin tek tek noktasını gösterir —
           // öğretmen "Destek Önerilir" rozetli bir öğrencinin sınıfın kuyruğunda mı yoksa aslında
           // herkese yakın mı olduğunu bir bakışta görebilir.
           const _distJitter = (str) => { let h = 0; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0; return (Math.abs(h) % 9) - 4; };
           const renderPerfDistributionHtml = (rows) => {
               // LOW_SAMPLE_MAX kullanılıyor (aynı "az veri" güvenilirlik eşiği, dosya başında
               // tanımlı) — dağılıma güvenilmez bir % ile katkı veren öğrenci karışmasın.
               const scored = rows.filter(r => !r.is_hidden && !r.isNewMember && r.assigned >= LOW_SAMPLE_MAX);
               if (scored.length < 4) return '';
               const vals = scored.map(r => r.pct).sort((a, b) => a - b);
               const pctile = (p) => {
                   const idx = (vals.length - 1) * p;
                   const lo = Math.floor(idx), hi = Math.ceil(idx);
                   return lo === hi ? vals[lo] : vals[lo] + (vals[hi] - vals[lo]) * (idx - lo);
               };
               const min = vals[0], max = vals[vals.length - 1];
               const q1 = pctile(0.25), median = pctile(0.5), q3 = pctile(0.75);
               const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
               const W = 600, padX = 14, plotW = W - padX * 2, boxY = 26, boxH = 18, dotsY = boxY + boxH + 16, H = dotsY + 12;
               const xOf = (v) => padX + (v / 100) * plotW;
               const dotsHtml = scored.map(r => {
                   const cx = xOf(r.pct);
                   const cy = dotsY + _distJitter(r.user_id || r.name || '');
                   return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="3" fill="${pctColor(r.pct)}" opacity="0.85"><title>${window._escapeHtml(r.name)}: %${r.pct}</title></circle>`;
               }).join('');
               return `
               <div class="cp-perf-dist">
                   <div class="cp-perf-dist-title">Sınıf Dağılımı <small>ödev tamamlama %, n=${scored.length}</small></div>
                   <svg viewBox="0 0 ${W} ${H}" class="cp-perf-dist-svg" preserveAspectRatio="none">
                       <line x1="${padX}" y1="${boxY + boxH / 2}" x2="${xOf(q1).toFixed(1)}" y2="${boxY + boxH / 2}" stroke="var(--text-muted)" stroke-width="1.5"/>
                       <line x1="${xOf(q3).toFixed(1)}" y1="${boxY + boxH / 2}" x2="${(padX + plotW).toFixed(1)}" y2="${boxY + boxH / 2}" stroke="var(--text-muted)" stroke-width="1.5"/>
                       <line x1="${xOf(min).toFixed(1)}" y1="${boxY + 2}" x2="${xOf(min).toFixed(1)}" y2="${boxY + boxH - 2}" stroke="var(--text-muted)" stroke-width="1.5"/>
                       <line x1="${xOf(max).toFixed(1)}" y1="${boxY + 2}" x2="${xOf(max).toFixed(1)}" y2="${boxY + boxH - 2}" stroke="var(--text-muted)" stroke-width="1.5"/>
                       <rect x="${xOf(q1).toFixed(1)}" y="${boxY}" width="${Math.max(0, xOf(q3) - xOf(q1)).toFixed(1)}" height="${boxH}" fill="rgba(116,185,255,0.15)" stroke="#74b9ff" stroke-width="1.5" rx="3"></rect>
                       <line x1="${xOf(median).toFixed(1)}" y1="${boxY}" x2="${xOf(median).toFixed(1)}" y2="${boxY + boxH}" stroke="#74b9ff" stroke-width="2.5"><title>Medyan: %${Math.round(median)}</title></line>
                       <line x1="${xOf(mean).toFixed(1)}" y1="${boxY - 6}" x2="${xOf(mean).toFixed(1)}" y2="${boxY + boxH + 6}" stroke="#feca57" stroke-width="1.5" stroke-dasharray="3,2"><title>Ortalama: %${Math.round(mean)}</title></line>
                       ${dotsHtml}
                   </svg>
                   <div class="cp-perf-dist-legend">
                       <span><i class="cp-perf-dist-swatch" style="background:#74b9ff;"></i> Medyan %${Math.round(median)}</span>
                       <span><i class="cp-perf-dist-swatch" style="background:#feca57;"></i> Ortalama %${Math.round(mean)}${Math.abs(mean - median) >= 10 ? ' <span class="cp-perf-dist-skew-note">(sınıf ortalaması aşırı uçlardan etkileniyor olabilir)</span>' : ''}</span>
                       <span class="cp-perf-dist-hint">Kutu: orta %50 (Ç1–Ç3) · Çizgiler: min–maks · Nokta: her ${memberLabel.toLowerCase()}</span>
                   </div>
               </div>`;
           };
           // ── Trend (son 4 hafta) — tek anlık % değeri "düşüşte mi hep böyle mi" ayrımını
           // yapamaz; öğretmenin doğru müdahaleyi seçmesi tam olarak bu ayrıma bağlı (bkz.
           // Performans analizi). Ödevin VERİLDİĞİ haftaya göre bucketlanır, period filtresinden
           // bağımsızdır (trend her zaman son 4 haftayı gösterir).
           const TREND_WEEKS = 4;
           const trendByUser = {};
           {
               const weekMs = 7 * 86400000;
               const now = Date.now();
               assignments.forEach(a => {
                   if (!a.created_at) return;
                   const ageWeeks = Math.floor((now - new Date(a.created_at).getTime()) / weekMs);
                   if (ageWeeks < 0 || ageWeeks >= TREND_WEEKS) return;
                   const bucketIdx = TREND_WEEKS - 1 - ageWeeks; // 0 = en eski, son index = bu hafta
                   const targetIds = (a.target_user_ids && a.target_user_ids.length) ? a.target_user_ids : studentMembers.map(m => m.userId);
                   const isMultiStep = !!(a.steps && a.steps.length);
                   targetIds.forEach(uid => {
                       const buckets = (trendByUser[uid] = trendByUser[uid] || Array.from({ length: TREND_WEEKS }, () => ({ assigned: 0, done: 0 })));
                       buckets[bucketIdx].assigned++;
                       const isDone = isMultiStep
                           ? !!(stepDoneByAsg[a.id]?.[uid] && a.steps.every(s => stepDoneByAsg[a.id][uid].has(s.id)))
                           : (subsByAsg[a.id] || []).includes(uid);
                       if (isDone) buckets[bucketIdx].done++;
                   });
               });
           }
           const sparkHtml = (buckets) => {
               if (!buckets || !buckets.some(b => b.assigned)) return '<span class="cp-perf-spark-empty">—</span>';
               return `<span class="cp-perf-spark" title="Son ${TREND_WEEKS} hafta">${buckets.map(b => {
                   if (!b.assigned) return '<span class="cp-perf-spark-bar cp-perf-spark-bar--empty"></span>';
                   const pct = Math.round((b.done / b.assigned) * 100);
                   // Trend sütunü büyütülüp daha görünür hale getirildi (24px yükseklik,
                   // 8px çubuk genişliği — bkz. .cp-perf-spark, kullanıcı isteği 2026-07-13).
                   const h = Math.max(3, Math.round((pct / 100) * 24));
                   return `<span class="cp-perf-spark-bar" style="height:${h}px; background:${pctColor(pct)};" title="%${pct}"></span>`;
               }).join('')}</span>`;
           };
           // Trend yönü: 4 haftalık ödev tamamlama bucket'larındaki geçerli (assigned>0) ilk ve
           // son noktayı karşılaştırır. Anomali: ya odak süresinde önceki haftaya göre keskin düşüş
           // (>=30dk geçen hafta + bu hafta o sürenin %40'ının altına inme) ya da ödev tamamlamada
           // sürekli düşüş trendi. Amaç öğretmene "kim geride" ötesinde "kim yeni yeni geride kalıyor"
           // sinyalini vermek.
           // Küçük örneklem: 4 haftaya yayılan toplam ödev sayısı çok azsa (örn. 2 ödev), iki uç
           // haftayı karşılaştırıp "yükseliş/düşüş" demek istatistiksel olarak anlamsızdır (tek bir
           // ödevin sonucu %100 oynama yaratabilir). Toplam örneklem TREND_MIN_TOTAL altındaysa yön
           // hiç hesaplanmaz — "veri yok" ile "sabit" farklı şeylerdir, ikisini karıştırmamak için
           // sparkHtml zaten boş/az veriyi ayrı gösteriyor.
           const TREND_MIN_TOTAL = 4;
           // Regresyon eğimi: eski yöntem sadece İLK ve SON haftayı karşılaştırıyordu — aradaki
           // haftalar (sparkline'da zaten gösteriliyor) yön hesabına hiç girmiyordu. Bu, örneğin
           // "düşük→yüksek→düşük" gibi U-şeklinde bir seyri "sabit" olarak doğru okur ama
           // "yüksek→düşük→orta→yüksek" gibi ara haftalarda gürültülü tek bir kötü haftanın uç
           // noktalardan biri olması durumunda yanlış yöne işaret edebiliyordu. En küçük kareler
           // (least-squares) eğimi TÜM haftaları eşit ağırlıkla hesaba katar, tek bir uç haftanın
           // aşırı etkisini azaltır. Eğim (haftalık ortalama değişim) 4 haftalık pencereye
           // ölçeklenip eski eşiklerle (±0.15) karşılaştırılabilir hale getirilir.
           const trendDirection = (buckets) => {
               if (!buckets) return null;
               const totalAssigned = buckets.reduce((sum, b) => sum + (b.assigned || 0), 0);
               if (totalAssigned < TREND_MIN_TOTAL) return null;
               const points = buckets.map((b, i) => b.assigned ? { x: i, y: b.done / b.assigned } : null).filter(p => p !== null);
               if (points.length < 2) return null;
               const n = points.length;
               const meanX = points.reduce((s, p) => s + p.x, 0) / n;
               const meanY = points.reduce((s, p) => s + p.y, 0) / n;
               const num = points.reduce((s, p) => s + (p.x - meanX) * (p.y - meanY), 0);
               const den = points.reduce((s, p) => s + (p.x - meanX) ** 2, 0);
               if (den === 0) return null; // tüm veri tek haftada, eğim tanımsız
               const slope = num / den; // hafta başına ortalama değişim (fraksiyon)
               const totalChange = slope * (buckets.length - 1); // pencerenin tamamına ölçeklenmiş toplam değişim
               if (totalChange >= 0.15) return 'up';
               if (totalChange <= -0.15) return 'down';
               return 'flat';
           };
           // Bilgi yoğunluğu azaltma: "flat" (sabit) yön artık HİÇ ikon basmıyor — bu en yaygın
           // durum olduğundan her satırda gereksiz bir ikon olarak birikip asıl önemli olan
           // up/down sinyallerini görsel gürültüye gömüyordu. Sadece gerçek bir yön değişimi
           // varken ikon gösterilir.
           const trendArrowHtml = (dir, labels) => {
               const t = labels || { up: 'Yükseliş trendi', down: 'Düşüş trendi' };
               if (dir === 'up') return `<i class="fa-solid fa-arrow-trend-up cp-trend-icon cp-trend-icon--up" title="${t.up}"></i>`;
               if (dir === 'down') return `<i class="fa-solid fa-arrow-trend-down cp-trend-icon cp-trend-icon--down" title="${t.down}"></i>`;
               return '';
           };
           const focusTrendLabels = { up: 'Odak süresi geçen haftaya göre artıyor', down: 'Odak süresi geçen haftaya göre azalıyor', flat: 'Odak süresi geçen haftayla benzer' };
           const anomalyMeta = {
               focus_drop: { label: 'Ani Düşüş', title: 'Bu haftaki odak süresi geçen haftaya göre belirgin şekilde düştü' },
               focus_drop_z: { label: 'Ani Düşüş', title: 'Bu haftaki odak süresi, öğrencinin KENDİ geçmiş ortalamasına göre olağan dalgalanmanın belirgin şekilde altında' },
               assignment_decline: { label: 'Gerileme', title: 'Ödev tamamlama oranı son haftalarda düşüş eğiliminde' },
               focus_output_mismatch: { label: 'Efor Karşılıksız', title: 'Sınıf ortalamasının belirgin üzerinde odaklanıyor ama ödev tamamlama oranı düşük — harcanan zaman çıktıya yansımıyor' },
           };
           // ── Odak-Çıktı Uyumsuzluğu ──
           // Odak dakikası ve ödev tamamlama şu ana kadar birbirinden kopuk iki kolon olarak
           // gösteriliyordu. Ama asıl bilgi genelde ikisinin İLİŞKİSİNDE: çok odaklanıp az ödev
           // bitiren bir öğrenci muhtemelen yanlış şeye odaklanıyor / dikkat dağınıklığı yaşıyor
           // ya da ödevi anlamıyor (daha fazla "çalış" demek yardımcı olmaz) — bu "tembellik"
           // sinyalinden ayrı, öğretmenin farklı bir müdahale (yöntem/anlama desteği) seçmesi
           // gereken bir durum. Tersi yönde (az odaklanıp çok ödev bitiren) öğrenci ise ALARM
           // DEĞİL — muhtemelen uygulama dışında da çalışıyor; bu öğrenciye "neden az
           // odaklanıyorsun" demek yanlış olur, o yüzden anomali değil bilgilendirici bağlam notu.
           // Eşikler sınıfın kendi medyan odak süresine görecelidir (sabit "180dk=çok" gibi bir
           // varsayım yapılmaz — sınıflar arası kullanım alışkanlığı çok değişir).
           const FOCUS_MISMATCH_HIGH_MULT = 1.5; // medyanın 1.5 katı ve üzeri = "yüksek odak"
           const FOCUS_MISMATCH_LOW_MULT = 0.5;  // medyanın yarısı ve altı = "düşük odak"
           const FOCUS_MISMATCH_MIN_MEDIAN = 30; // dk — sınıf medyanı bunun altındaysa çarpanlar anlamsızlaşır (herkes zaten az kullanıyor)
           const FOCUS_MISMATCH_HIGH_FLOOR = 60;  // dk — mutlak taban, medyan çok düşükken 1.5x hâlâ küçük bir sayı olabilir
           const FOCUS_MISMATCH_HIGH_COMPLETION = 80; // % — "yüksek tamamlama" sabit eşiği (destekThreshold'dan bağımsız, üst uç için ayrı bir kavram)
           // ── Z-skor bazlı odak anomali tespiti (109_group_weekly_focus_history) ──
           // Eski mantık sabit bir eşik kullanıyordu ("geçen hafta >=30dk VE bu hafta geçen
           // haftanın %40'ının altında") — bu, doğal olarak dalgalı çalışan bir öğrenci için
           // yanlış alarm üretebilir, istikrarlı ama düşük seviyede çalışan biri için ise gerçek
           // bir düşüşü kaçırabilirdi (bkz. performans analizi tartışması). Z-skor, her öğrencinin
           // KENDİ 8 haftalık ortalama+standart sapmasına göre "bu hafta ne kadar sıra dışı"
           // sorusunu cevaplar — aynı 40dk'lık düşüş, hep 200dk'da gezen biri için normal
           // gürültüyken hep 45dk'da gezen biri için ciddi bir sapma olabilir.
           // Yeterli geçmiş yoksa (migration henüz uygulanmadı / öğrenci yeni / std çok düşük)
           // sessizce null döner ve çağıran taraf eski sabit eşiğe geri düşer.
           const FOCUS_Z_MIN_BASELINE_WEEKS = 3;
           const FOCUS_Z_DROP_THRESHOLD = -1.5; // ~normal dağılımda alt %7'lik dilim
           const FOCUS_Z_MIN_STD = 10; // dakika — bundan daha "dümdüz" bir geçmişte z-skor gürültüye aşırı duyarlı olur
           const focusHistByUser = {};
           (focusHistRes?.data || []).forEach(r => {
               (focusHistByUser[r.student_id] = focusHistByUser[r.student_id] || []).push(r);
           });
           const focusZInfo = (userId, thisWeekMinutes) => {
               const hist = focusHistByUser[userId];
               if (!hist || thisWeekMinutes === null) return null;
               const sorted = hist.slice().sort((a, b) => a.week_start < b.week_start ? -1 : 1);
               const baseline = sorted.slice(0, -1).map(r => r.weekly_minutes || 0); // son kova = bu hafta, geri kalanı temel alınır
               if (baseline.length < FOCUS_Z_MIN_BASELINE_WEEKS) return null;
               const mean = baseline.reduce((a, b) => a + b, 0) / baseline.length;
               const variance = baseline.reduce((s, b) => s + (b - mean) ** 2, 0) / baseline.length;
               const std = Math.sqrt(variance);
               if (std < FOCUS_Z_MIN_STD) return null;
               return { z: (thisWeekMinutes - mean) / std, mean: Math.round(mean), std: Math.round(std), weeksUsed: baseline.length };
           };
           // Bağlam etiketleri: düşük % rakamının TEK bir nedene indirgenmesini önlemek için,
           // elde zaten olan veriden (ekstra sorgu yok) olası açıklayıcı bağlamı çıkarır. Amaç
           // rozeti "alarm"dan "buraya bak ama şu bağlamda bak"a çevirmek.
           const contextMeta = {
               newMember: { label: 'Yeni katıldı', title: 'Son 7 gün içinde sınıfa katıldı — henüz yeterli veri birikmedi' },
               lowActivity: { label: 'Aktif gün az', title: 'Bu hafta 1 veya daha az gün aktif oldu — devamsızlık veya erişim sorunu olabilir' },
               classAvgLow: { label: 'Sınıf geneli düşük', title: 'Sınıfın geneli bu dönemde düşük tamamlama oranına sahip — bireysel değil, sistemik bir durum olabilir' },
               singleAssignmentDip: { label: 'Tek ödeve özgü', title: 'Genel performansı iyi, düşüş son ödev(ler)e özgü görünüyor' },
               efficientLowFocus: { label: 'Az sürede verimli', title: 'Sınıf ortalamasının belirgin altında odak süresine rağmen ödevlerini büyük ölçüde tamamlıyor — muhtemelen uygulama dışında da çalışıyor, düşük dakika onu "az çalışıyor" gibi göstermesin' },
           };
           const buildPerfRows = (period) => {
               const statsById = {};
               (statsRes.data || []).forEach(r => { statsById[r.user_id] = r; });
               const { assignedByUser, doneByUser } = buildPerfCounts(period);
               const rows = studentMembers
                   .map(m => {
                       const s = statsById[m.userId] || {};
                       const assigned = assignedByUser[m.userId] || 0;
                       const done = doneByUser[m.userId] || 0;
                       const pct = assigned ? Math.round((done / assigned) * 100) : null;
                       // Küçük örneklem uyarısı: 1-4 ödevlik bir geçmişte %'ler tek bir ödevin
                       // sonucuna göre uçlara savrulur (örn. 1/2 = %50, 2/2 = %100). LOW_SAMPLE_MAX
                       // altındaki oranlar "Destek Önerilir" rozetine zaten giremiyor
                       // (MIN_ASSIGNED_FOR_SUPPORT=3) ama görsel olarak da "bu % henüz güvenilir
                       // değil" sinyali vermek için ayrıca işaretlenir.
                       const lowSample = assigned > 0 && assigned < LOW_SAMPLE_MAX;
                       const trend = trendByUser[m.userId] || null;
                       const trendDir = trendDirection(trend);
                       const weeklyMinutes = s.weekly_minutes || 0;
                       const activeDays = s.active_days || 0;
                       const prevWeekMinutes = typeof s.prev_week_minutes === 'number' ? s.prev_week_minutes : null;
                       // Öncelik: yeterli geçmiş varsa (109 migration uygulanmış + en az 3 haftalık
                       // temel veri) z-skor kullanılır — kişiye özel, "kendi normaline göre" bir ölçüm.
                       // Yoksa eski sabit eşiğe (%60 düşüş) geri düşülür.
                       const zInfo = !s.is_hidden ? focusZInfo(m.userId, weeklyMinutes) : null;
                       const focusDropZ = zInfo && zInfo.z <= FOCUS_Z_DROP_THRESHOLD;
                       const focusDropFixed = !zInfo && !s.is_hidden && prevWeekMinutes !== null && prevWeekMinutes >= 30 && weeklyMinutes < prevWeekMinutes * 0.4;
                       const focusDrop = focusDropZ || focusDropFixed;
                       const anomaly = focusDrop ? (zInfo ? 'focus_drop_z' : 'focus_drop') : (trendDir === 'down' ? 'assignment_decline' : null);
                       const anomalyDetail = focusDrop && zInfo
                           ? `Bu hafta ${weeklyMinutes} dk, kendi son ${zInfo.weeksUsed} haftalık ortalaması ${zInfo.mean} dk (±${zInfo.std} dk) — yaklaşık ${Math.abs(zInfo.z).toFixed(1)} standart sapma altında`
                           : null;
                       // Odak süresi trendi: RPC şu an sadece bu hafta + geçen hafta döndürüyor
                       // (gerçek 4 haftalık sparkline yeni bir RPC/migration ister), o yüzden burada
                       // 2 noktalı bir yön göstergesi yeterli — gürültüyü önlemek için en az 15dk'lık
                       // mutlak fark aranır (çok küçük dakikalarda %ile oynama anlamsız olurdu).
                       let focusTrendDir = null;
                       if (!s.is_hidden && prevWeekMinutes !== null) {
                           const diff = weeklyMinutes - prevWeekMinutes;
                           if (diff >= 15) focusTrendDir = 'up';
                           else if (diff <= -15) focusTrendDir = 'down';
                           else focusTrendDir = 'flat';
                       }

                       const isNewMember = !!(m.joinedAt && (Date.now() - m.joinedAt) < 7 * 86400000);
                       const contextNotes = [];
                       if (isNewMember) contextNotes.push('newMember');
                       if (!s.is_hidden && activeDays <= 1) contextNotes.push('lowActivity');
                       if (trend) {
                           const weekPcts = trend.map(b => b.assigned ? (b.done / b.assigned) * 100 : null);
                           const lastPct = weekPcts[weekPcts.length - 1];
                           const priorValid = weekPcts.slice(0, -1).filter(p => p !== null);
                           if (lastPct !== null && lastPct < 50 && priorValid.length && (priorValid.reduce((a, b) => a + b, 0) / priorValid.length) >= 70) {
                               contextNotes.push('singleAssignmentDip');
                           }
                       }

                       return {
                           user_id: m.userId, name: m.displayName || '?',
                           classSectionId: m.classSectionId || null,
                           is_hidden: !!s.is_hidden,
                           weekly_minutes: weeklyMinutes, active_days: activeDays,
                           prev_week_minutes: prevWeekMinutes, focusTrendDir,
                           assigned, done, pct, isNewMember, lowSample,
                           trend, trendDir, anomaly, anomalyDetail, contextNotes,
                       };
                   });
               // Minimum örneklem eşiği: "Ödev Bazlı Analiz" (resolvedAsgRows) sınıf geneli
               // yüzdeleri için zaten targetCount>=3 şartı koyuyordu ("küçük hedef gruplarında
               // oran anlamsız dalgalanır"), bireysel supportFlag tarafında böyle bir alt sınır
               // yoktu — 1 ödev verilip kaçırılan bir öğrenci (pct=0) hemen rozet alabiliyordu.
               // Aynı kuralı buraya da getiriyoruz.
               const MIN_ASSIGNED_FOR_SUPPORT = 3;
               // Ayrıca bkz. LOW_SAMPLE_MAX (bu fonksiyonun dışında, dosya başında tanımlı) —
               // "Destek Önerilir" rozeti için MIN_ASSIGNED_FOR_SUPPORT (>=3) yeterli olsa da,
               // 3-4 ödevlik bir geçmişte % hâlâ çok oynak olduğundan tabloda ayrı bir görsel
               // uyarı (lowSample) verilir.
               // Göreli eşik: sabit %34 yerine sınıfın kendi tamamlama dağılımına göre "Destek
               // Önerilir" sınırı belirlenir (ortalama - en az 12 puan veya 1 standart sapma,
               // 15-50 arası sınırlanır). Örneklem küçükse (<3 ödevli üye) sabit %34'e döner —
               // 1-2 kişilik veriyle ortalama/sapma anlamlı olmaz. Yeni katılan üyeler (son 7 gün)
               // ve az ödevli üyeler (<3) bu ortalamaya DAHİL EDİLMEZ — hem henüz fırsat
               // bulamamış hem de istatistiksel olarak gürültülü %'ler, diğer herkesin eşiğini
               // haksız yere aşağı çekmesin diye.
               const scored = rows.filter(r => r.assigned >= MIN_ASSIGNED_FOR_SUPPORT && !r.isNewMember);
               let supportThreshold = 34;
               let classAvgPct = null;
               if (scored.length >= 3) {
                   classAvgPct = scored.reduce((sum, r) => sum + r.pct, 0) / scored.length;
                   const variance = scored.reduce((sum, r) => sum + (r.pct - classAvgPct) ** 2, 0) / scored.length;
                   const stddev = Math.sqrt(variance);
                   supportThreshold = Math.min(50, Math.max(15, Math.round(classAvgPct - Math.max(stddev, 12))));
               }
               // Odak-Çıktı Uyumsuzluğu için referans: sınıfın medyan haftalık odak dakikası
               // (ortalama değil — birkaç aşırı yüksek odaklanan öğrenci ortalamayı yukarı çekip
               // "yüksek odak" eşiğini herkes için haksız yere yükseltebilirdi, bkz. performans
               // analizi tartışmasındaki medyan/ortalama sorunu). Gizli/yeni üyeler dışlanır.
               const focusScored = rows.filter(r => !r.is_hidden && !r.isNewMember);
               let classMedianFocus = null;
               if (focusScored.length >= 3) {
                   const sortedFocus = focusScored.map(r => r.weekly_minutes).sort((a, b) => a - b);
                   const mid = Math.floor(sortedFocus.length / 2);
                   classMedianFocus = sortedFocus.length % 2 ? sortedFocus[mid] : Math.round((sortedFocus[mid - 1] + sortedFocus[mid]) / 2);
               }
               rows.forEach(r => {
                   // Yeni katılan bir üyeye "Destek Önerilir" ya da anomali ("Ani Düşüş"/"Gerileme")
                   // rozeti YAKIŞTIRILMAZ — henüz yeterli geçmişi yokken düşük % veya "düşüş trendi"
                   // görmek doğal ve beklenen bir durum, bunu "destek gerekiyor" olarak etiketlemek
                   // yanlış/haksız bir sinyal olurdu. Tek gösterilen bilgi "Yeni katıldı" kalır.
                   r.supportFlag = r.assigned >= MIN_ASSIGNED_FOR_SUPPORT && !r.isNewMember && r.pct < supportThreshold;
                   if (r.isNewMember) r.anomaly = null;
                   // Odak-Çıktı Uyumsuzluğu — hem yüksek-odak/düşük-tamamlama (uyarı) hem
                   // düşük-odak/yüksek-tamamlama (bilgilendirici, alarm değil) yönü. Güvenilir bir
                   // % gerektiği için en az LOW_SAMPLE_MAX ödevlik geçmiş şart (aksi halde tek bir
                   // ödevin sonucu yanlış bir eşleşme üretebilir).
                   if (!r.isNewMember && !r.is_hidden && r.assigned >= LOW_SAMPLE_MAX && r.pct !== null
                       && classMedianFocus !== null && classMedianFocus >= FOCUS_MISMATCH_MIN_MEDIAN) {
                       const highFocusBar = Math.max(classMedianFocus * FOCUS_MISMATCH_HIGH_MULT, FOCUS_MISMATCH_HIGH_FLOOR);
                       const lowFocusBar = classMedianFocus * FOCUS_MISMATCH_LOW_MULT;
                       const isHighFocus = r.weekly_minutes >= highFocusBar;
                       const isLowFocus = r.weekly_minutes <= lowFocusBar;
                       const isLowCompletion = r.pct < supportThreshold;
                       const isHighCompletion = r.pct >= FOCUS_MISMATCH_HIGH_COMPLETION;
                       // "Ani Düşüş" (focus_drop/focus_drop_z) daha acil/zamana-duyarlı bir sinyal
                       // olduğundan öncelikli kalır; mismatch sadece o yokken (veya zaten zayıf bir
                       // "Gerileme" sinyali varken, ki mismatch ondan daha spesifik/aksiyon alınabilir)
                       // anomali kutusunu doldurur.
                       if (isHighFocus && isLowCompletion && (!r.anomaly || r.anomaly === 'assignment_decline')) {
                           r.anomaly = 'focus_output_mismatch';
                           r.anomalyDetail = `Bu hafta ${r.weekly_minutes} dk odaklandı (sınıf medyanı ~${classMedianFocus} dk) ama ödevlerin sadece ${r.pct}%'ini tamamladı (${r.done}/${r.assigned}) — harcanan zaman çıktıya yansımıyor, yöntem/dikkat/anlama desteği gerekebilir`;
                       } else if (isLowFocus && isHighCompletion) {
                           r.contextNotes.push('efficientLowFocus');
                       }
                   }
                   if (r.supportFlag && classAvgPct !== null && classAvgPct < 40) r.contextNotes.push('classAvgLow');
                   if (r.isNewMember) {
                       r.contextNotes = ['newMember'];
                   } else if (!r.supportFlag && !r.anomaly && !r.contextNotes.includes('efficientLowFocus')) {
                       // Gürültü azaltma: bağlam etiketleri artık SADECE zaten bir sinyal (Destek
                       // Önerilir rozeti, anomali veya "Az sürede verimli" notu) varken gösteriliyor —
                       // önceden gayet iyi giden bir öğrenciye bile anlamsız yere etiket takılıyordu.
                       r.contextNotes = [];
                   } else if (r.contextNotes.length) {
                       // En fazla 2 etiket gösterilir, öncelik sırasına göre.
                       const priority = ['classAvgLow', 'efficientLowFocus', 'singleAssignmentDip', 'lowActivity'];
                       r.contextNotes = [...new Set(r.contextNotes)]
                           .sort((a, b) => priority.indexOf(a) - priority.indexOf(b))
                           .slice(0, 2);
                   }
               });
               rows.__supportThreshold = supportThreshold;
               return rows;
           };
           if (isClassAdmin) {
               const initialSortKey = PERF_SORT_KEYS[el.dataset.perfSortKey] ? el.dataset.perfSortKey : 'name';
               const initialSortDir = el.dataset.perfSortDir === 'desc' ? 'desc' : 'asc';
               const initialPeriod = ['7d', '30d'].includes(el.dataset.perfPeriod) ? el.dataset.perfPeriod : 'all';
               const initialClass = el.dataset.perfClass || 'all';
               el.dataset.perfSortKey = initialSortKey;
               el.dataset.perfSortDir = initialSortDir;
               el.dataset.perfPeriod = initialPeriod;
               el.dataset.perfClass = initialClass;
               perfRows = buildPerfRows(initialPeriod);
               // Sınıf (group_class_sections) artık bu grubun İÇİNDEKİ bir etiket — öğrenci
               // henüz bir şubeye atanmamışsa "Sınıfsız" sayılır, ayrı bir grup sorgusu gerekmez
               // (tüm öğrenciler zaten aynı sorgudan, tam analizle geliyor).
               perfRows.forEach(r => { r.classId = r.classSectionId || '__unassigned__'; r.className = r.classSectionId ? (sectionNameById[r.classSectionId] || 'Sınıf') : 'Sınıfsız'; });
               const unassignedCount = perfRows.filter(r => !r.is_hidden && !r.classSectionId).length;
               tableRows = perfRows;
               const hiddenCount = filterPerfRowsByClass(initialClass, tableRows).filter(r => r.is_hidden).length;
               const periodBtn = (val, label) => `<button class="cp-perf-filter-btn${initialPeriod === val ? ' active' : ''}" data-perfperiod="${val}">${label}</button>`;
               // Sıralanabilir sütun başlığı: tıklayınca o anahtara göre sıralar, aynı sütuna
               // tekrar tıklayınca yönü çevirir. Aktif sütunda ok ikonu yönü gösterir.
               const sortHeadBtn = (key, label, title) => {
                   const active = initialSortKey === key;
                   const arrow = active ? (initialSortDir === 'desc' ? 'fa-arrow-down' : 'fa-arrow-up') : 'fa-sort';
                   return `<button type="button" class="cp-perf-sort-head${active ? ' active' : ''}" data-perfsortkey="${key}" title="${title || label}"><span class="cp-perf-sort-label">${label}</span><i class="fa-solid ${arrow} cp-perf-sort-arrow"></i></button>`;
               };

               // ── Zaman İçi Takip (classroom_perf_snapshots, 112) ──
               // Performans sisteminin en büyük eksiği anlık kesitten ibaret olmasıydı — bir
               // öğrenci destek listesine girdikten bir hafta sonra "düzeldi mi" sorusuna cevap
               // yoktu. Periyot filtresinden BAĞIMSIZ, hep 'all' periyoduyla hesaplanan durum
               // haftalık olarak upsert edilir (aynı hafta içinde tekrar açılması sadece o
               // haftanın satırını günceller, geçmiş bozulmaz). Karşılaştırma her zaman "bir
               // önceki kayıtlı hafta" ile yapılır (öğretmen ara haftayı hiç açmamışsa bir
               // önceki AÇILAN haftaya kıyaslanır, boşluk atlanır).
               const snapshotWeekStart = window._trWeekStart();
               const snapshotSourceRows = initialPeriod === 'all' ? perfRows : buildPerfRows('all');
               (async () => {
                   const upsertRows = snapshotSourceRows
                       .filter(r => !r.isNewMember)
                       .map(r => ({
                           group_id: data._supaId, user_id: r.user_id, week_start: snapshotWeekStart,
                           pct: r.pct, assigned: r.assigned, support_flag: !!r.supportFlag, anomaly: r.anomaly || null
                       }));
                   if (upsertRows.length) {
                       await window.FocusSupabase.from('classroom_perf_snapshots')
                           .upsert(upsertRows, { onConflict: 'group_id,user_id,week_start' });
                   }
               })().catch(() => {}); // best-effort, arayüzü bloklamaz/hata göstermez

               let perfDeltaHtml = '';
               try {
                   const { data: prevSnaps } = await window.FocusSupabase.from('classroom_perf_snapshots')
                       .select('user_id, pct, support_flag, week_start')
                       .eq('group_id', data._supaId)
                       .lt('week_start', snapshotWeekStart)
                       .order('week_start', { ascending: false })
                       .limit(memberCount * 6);
                   const prevByUser = {};
                   (prevSnaps || []).forEach(s => { if (!prevByUser[s.user_id]) prevByUser[s.user_id] = s; }); // en yeni önce geldiği için ilk görülen = en güncel
                   const comparable = snapshotSourceRows.filter(r => !r.isNewMember && prevByUser[r.user_id] && r.pct !== null && prevByUser[r.user_id].pct !== null);
                   if (comparable.length >= 2) {
                       const improved = comparable.filter(r => prevByUser[r.user_id].support_flag && !r.supportFlag).length;
                       const worsened = comparable.filter(r => !prevByUser[r.user_id].support_flag && r.supportFlag).length;
                       const avgDelta = Math.round(comparable.reduce((s, r) => s + (r.pct - prevByUser[r.user_id].pct), 0) / comparable.length);
                       const prevWeekLabel = prevByUser[comparable[0].user_id].week_start;
                       perfDeltaHtml = `
                       <div class="cp-perf-delta-card">
                           <i class="fa-solid fa-chart-line" style="color:#74b9ff;"></i>
                           <span>Geçen kayıtlı haftaya göre (${new Date(prevWeekLabel).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}):</span>
                           ${improved ? `<span class="cp-perf-delta-pill cp-perf-delta-pill--up"><i class="fa-solid fa-arrow-trend-up"></i> ${improved} ${memberLabel.toLowerCase()} destek listesinden çıktı</span>` : ''}
                           ${worsened ? `<span class="cp-perf-delta-pill cp-perf-delta-pill--down"><i class="fa-solid fa-arrow-trend-down"></i> ${worsened} ${memberLabel.toLowerCase()} yeni eklendi</span>` : ''}
                           <span class="cp-perf-delta-pill">Ortalama tamamlama: ${avgDelta >= 0 ? '+' : ''}${avgDelta}pp</span>
                       </div>`;
                   }
               } catch (e) { /* best-effort — geçmiş kıyaslaması olmadan da panel tam işlevli kalır */ }

               // ── Ödev Bazlı Analiz — "kim yapmadı" değil "hangi ödev genel olarak zor/belirsiz
               // geldi" sorusuna cevap verir. Bir ödevi hedeflenen öğrencilerin çoğu tamamlayamamışsa
               // bu genelde bireysel bir motivasyon sorunu değil, ödevin kendisiyle ilgili bir
               // sinyaldir (çok zor, belirsiz, süre kısa) — öğretmenin kendi ödev tasarımını
               // gözden geçirmesi için. Sadece SONUÇLANMIŞ (süresi geçmiş/kapatılmış) ödevler
               // sayılır; henüz vadesi gelmemiş bir ödev burada "başarısız" gibi görünmesin.
               const resolvedAsgRows = assignments
                   .filter(a => a.status === 'closed' || (a.due_date && new Date(a.due_date) < new Date()))
                   .map(a => {
                       const targetIds = (a.target_user_ids && a.target_user_ids.length) ? a.target_user_ids : studentMembers.map(m => m.userId);
                       const isMultiStep = !!(a.steps && a.steps.length);
                       const doneCount = isMultiStep
                           ? targetIds.filter(uid => { const set = stepDoneByAsg[a.id]?.[uid]; return set && a.steps.every(s => set.has(s.id)); }).length
                           : targetIds.filter(uid => (subsByAsg[a.id] || []).includes(uid)).length;
                       const pct = targetIds.length ? Math.round((doneCount / targetIds.length) * 100) : 0;
                       return { id: a.id, title: a.title, targetCount: targetIds.length, doneCount, pct };
                   })
                   .filter(r => r.targetCount >= 3) // küçük hedef gruplarında oran anlamsız dalgalanır
                   .sort((a, b) => a.pct - b.pct);
               const lowAsgRows = resolvedAsgRows.filter(r => r.pct < 50);
               const asgAnalysisHtml = resolvedAsgRows.length ? `
                   <h3 class="cp-section-title" style="margin-top:20px;"><i class="fa-solid fa-magnifying-glass-chart" style="color:#a29bfe;"></i> Ödev Bazlı Analiz <small>sonuçlanmış ödevler</small></h3>
                   <div class="cp-table">
                       <div class="cp-row cp-row--head" style="grid-template-columns: 1fr 110px;">
                           <span>${asgLabel}</span><span>Tamamlama</span>
                       </div>
                       ${resolvedAsgRows.map(r => `
                       <div class="cp-row" style="grid-template-columns: 1fr 110px;">
                           <span class="cp-name">${window._escapeHtml(r.title)}${r.pct < 50 ? '<span class="cp-support-badge" style="color:#a29bfe; background:rgba(162,155,254,0.12); border-color:rgba(162,155,254,0.25);"><i class="fa-solid fa-magnifying-glass"></i> Gözden Geçir</span>' : ''}</span>
                           <span class="cp-asg-pct-cell${r.targetCount < LOW_SAMPLE_MAX ? ' cp-asg-pct-cell--lowsample' : ''}">
                               <div class="cp-asg-pct-track"><div class="cp-asg-pct-fill" style="width:${r.pct}%; background-color:${pctColor(r.pct)};"></div></div>
                               <b style="color:${pctColor(r.pct)};">${r.doneCount}/${r.targetCount}</b>${r.targetCount < LOW_SAMPLE_MAX ? `<span class="cp-lowsample-badge cp-lowsample-badge--icon" title="Az veri: sadece ${r.targetCount} ${memberLabel.toLowerCase()} hedeflendi — bu kadar az veride % oranı bir kişinin sonucuyla bile büyük ölçüde değişebilir"><i class="fa-solid fa-circle-info"></i></span>` : ''}
                           </span>
                       </div>`).join('')}
                   </div>
                   ${lowAsgRows.length ? `<p class="cp-hint">"Gözden Geçir" rozeti, hedeflenen ${memberLabel.toLowerCase()}lerin yarısından azının tamamlayabildiği ödevleri işaret eder — bu genelde bireysel bir sorun değil, ödevin zorluğu/açıklığıyla ilgili bir sinyal olabilir.</p>` : ''}`
                   : '';

               perfHtml = `
                   <div class="cp-perf-toprow">
                       <div class="cp-popover cp-perf-help-popover">
                           <button type="button" class="cp-perf-help-toggle"><i class="fa-solid fa-circle-info"></i> Bu bölüm nasıl okunur?</button>
                           <div class="cp-perf-help-panel cp-popover-panel" hidden>
                               <button type="button" class="cp-popover-close" aria-label="Kapat"><i class="fa-solid fa-xmark"></i></button>
                               <p><b>Destek Önerilir</b>Sınıf ortalamasının belirgin altında tamamlama (en az 3 ödevlik geçmiş gerekir).</p>
                               <p><b>Ani Düşüş</b>Öğrencinin kendi geçmişine göre olağandışı odak düşüşü.</p>
                               <p><b>Efor Karşılıksız</b>Yüksek odak süresi, düşük tamamlama — yöntem sorunu işareti olabilir.</p>
                               <p><b>Az Sürede Verimli</b>Düşük odakla yüksek tamamlama; bu bir alarm değildir.</p>
                               <p><b>"az veri" Rozeti</b>Az ödevden hesaplanan yüzdeye değil, yanındaki ham sayıya (ör. 2/3) bakın.</p>
                               <p><b>Sınıf Dağılımı</b>Kutu: orta %50, çizgi: medyan, kesikli çizgi: ortalama.</p>
                               <p><b>Haftalık Kıyas</b>Her açılışta o haftanın kesiti kaydedilip bir öncekiyle karşılaştırılır.</p>
                           </div>
                       </div>
                       ${tableRows.length ? `
                       <div class="cp-popover cp-perf-filter-popover">
                           <button type="button" class="cp-perf-filter-toggle">
                               <i class="fa-solid fa-sliders"></i> Filtrele <i class="fa-solid fa-chevron-down cp-perf-filter-toggle-caret"></i>
                           </button>
                           <div class="cp-perf-filter-panel cp-popover-panel" hidden>
                               <button type="button" class="cp-popover-close" aria-label="Kapat"><i class="fa-solid fa-xmark"></i></button>
                               <div class="cp-perf-filter-panel-label">Dönem</div>
                               <div class="cp-perf-filter-group">
                                   ${periodBtn('7d', '7 Gün')}${periodBtn('30d', '30 Gün')}${periodBtn('all', 'Tümü')}
                               </div>
                               ${showClassColumn ? `
                               <div class="cp-perf-filter-panel-label">Sınıf</div>
                               <div class="cp-perf-filter-group cp-perf-filter-group--wrap">
                                   <button class="cp-perf-filter-btn${initialClass === 'all' ? ' active' : ''}" data-perfclass="all">Tümü</button>
                                   ${classSections.map(c => `<button class="cp-perf-filter-btn${initialClass === c.id ? ' active' : ''}" data-perfclass="${c.id}">${window._escapeHtml(c.name)}</button>`).join('')}
                                   ${unassignedCount ? `<button class="cp-perf-filter-btn${initialClass === '__unassigned__' ? ' active' : ''}" data-perfclass="__unassigned__">Sınıfsız</button>` : ''}
                               </div>` : ''}
                           </div>
                       </div>` : ''}
                   </div>
                   ${tableRows.length ? `
                   ${perfDeltaHtml}
                   <div id="cp-perf-dist-wrap">${renderPerfDistributionHtml(perfRows)}</div>
                   ${(showClassColumn && unassignedCount) ? `<p class="cp-hint" style="margin:-4px 0 12px;"><i class="fa-solid fa-triangle-exclamation" style="color:#feca57;"></i> ${unassignedCount} ${memberLabel.toLowerCase()} henüz bir şubeye atanmamış — "Sınıflar/${memberLabel}ler" sekmesinden bir şubeye atayabilirsin.</p>` : ''}
                   <div class="cp-table cp-table--admin">
                       <div class="cp-perf-table-meta${(initialPeriod === 'all' && (!showClassColumn || initialClass === 'all')) ? ' cp-perf-table-meta--hidden' : ''}" id="cp-perf-table-meta">
                           <i class="fa-solid fa-filter"></i> <small id="cp-perf-period-label">${periodLabel[initialPeriod]}</small>${showClassColumn ? `<small id="cp-perf-class-label"> · ${initialClass === 'all' ? 'tüm sınıflar' : (initialClass === '__unassigned__' ? 'sınıfsız' : window._escapeHtml(sectionNameById[initialClass] || ''))}</small>` : ''}
                       </div>
                       <div class="cp-row cp-row--head cp-row--admin${showClassColumn ? ' cp-row--withclass' : ''}">
                           <span>#</span>${sortHeadBtn('name', memberLabel)}${showClassColumn ? sortHeadBtn('className', 'Sınıf') : ''}${sortHeadBtn('pct', 'Ödev', 'Ödev Tamamlama')}<span class="cp-perf-trend-cell" title="Son 4 haftanın ödev tamamlama eğimi (bugünden geriye yuvarlanan pencere)">Trend <small>(4h)</small></span>${sortHeadBtn('weekly_minutes', 'Odak', 'Odak (bu hafta) — bu takvim haftası (Pazartesi-Pazar, TR saati)')}${sortHeadBtn('active_days', 'Aktif', 'Aktif Gün')}<span></span>
                       </div>
                       <div id="cp-perf-rows">${renderPerfRowsHtml(sortPerfRows(initialSortKey, initialSortDir, filterPerfRowsByClass(initialClass, tableRows)))}</div>
                   </div>
                   ${hiddenCount ? `<p class="cp-hint">${hiddenCount} ${memberLabel.toLowerCase()} istatistiklerini gizledi.</p>` : ''}`
                   : `<p class="cp-hint">Henüz ${memberLabel.toLowerCase()} yok. Üstteki <b>"Davet Et"</b> butonuyla ilk ${memberLabel.toLowerCase()}ini davet ettiğinde ödev takibi burada oluşmaya başlayacak.</p>`}

                   ${asgAnalysisHtml}

                   ${_renderCategoryBreakdownHtml(catRes?.data || [])}`;
           }

           // ── Ödevler / Ders Planı — tek arayüz: basit ödev ve çok adımlı ders planı
           // aynı classroom_assignments tablosunda, aynı sekmede yaşıyor (bkz. steps kolonu).
           const asgLabel = isWork ? 'Görevlendirmeler' : 'Ders Planı';
           const fmtDue = (d) => d ? new Date(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' }) : null;
           const targetCount = (a) => (a.target_user_ids && a.target_user_ids.length) ? a.target_user_ids.length : memberCount;
           const targetMembers = (a) => studentMembers.filter(m => (!a.target_user_ids || a.target_user_ids.includes(m.userId)));
           // Sınıf geneli tamamlanma oranı — admin'in "Ödev Bazlı Analiz"ında (resolvedAsgRows)
           // zaten hesaplanan mantığın aynısı, ama burada isClassAdmin bloğunun DIŞINDA (herkese
           // açık) tanımlanıyor ki öğrenci tarafında da kullanılabilsin. Amaç: düşük bir puan/
           // tamamlama gören öğrenciye "bu ödev herkese zor geldi, yalnız değilsin" bağlamını
           // isim/sıra vermeden (anonim, agrega) verebilmek — atıf hatasını ("ben yetersizim")
           // azaltmak için.
           const asgCompletion = (a) => {
               const targetIds = (a.target_user_ids && a.target_user_ids.length) ? a.target_user_ids : studentMembers.map(m => m.userId);
               const isMultiStep = !!(a.steps && a.steps.length);
               const doneCount = isMultiStep
                   ? targetIds.filter(uid => { const set = stepDoneByAsg[a.id]?.[uid]; return set && a.steps.every(s => set.has(s.id)); }).length
                   : targetIds.filter(uid => (subsByAsg[a.id] || []).includes(uid)).length;
               const pct = targetIds.length ? Math.round((doneCount / targetIds.length) * 100) : 0;
               return { targetCount: targetIds.length, doneCount, pct };
           };
           const priorityBadge = (p) => {
               if (p === 'urgent') return '<span class="cp-asg-priority cp-asg-priority--urgent"><i class="fa-solid fa-fire"></i> Acil</span>';
               if (p === 'important') return '<span class="cp-asg-priority cp-asg-priority--important"><i class="fa-solid fa-star"></i> Önemli</span>';
               return '';
           };
           // Ek dosya linkleri (chat-files bucket'ında saklanır). İmzalı URL'nin kendisi 7 gün
           // geçerli ama önceden panel her açıldığında sıfırdan üretiliyordu — artık bucket_path
           // başına module-seviye bir cache'te (6 gün TTL, gerçek 7 günlük geçerlilikten kısa
           // tutulur ki süresi dolmadan yenilensin) tutuluyor, aynı ek tekrar tekrar Storage API'ye
           // sorulmuyor.
           const attachAsgIds = assignments.filter(a => a.attachment?.bucket_path).map(a => a.id);
           const attachUrlById = {};
           if (attachAsgIds.length) {
               await Promise.all(assignments.filter(a => a.attachment?.bucket_path).map(async a => {
                   const url = await _getSignedUrlCached(a.attachment.bucket_path);
                   if (url) attachUrlById[a.id] = url;
               }));
           }
           // Öğrencinin kendi teslim ekinin linki
           const mySubAttachUrlById = {};
           const mySubAttachIds = Object.keys(mySubAttachment);
           if (mySubAttachIds.length) {
               await Promise.all(mySubAttachIds.map(async asgId => {
                   const url = await _getSignedUrlCached(mySubAttachment[asgId].bucket_path);
                   if (url) mySubAttachUrlById[asgId] = url;
               }));
           }
           const asgCard = (a) => {
               const isMultiStep = !!(a.steps && a.steps.length);
               const subs = subsByAsg[a.id] || [];
               const myStepSet = isMultiStep ? (stepDoneByAsg[a.id]?.[window.currentUser.id] || new Set()) : null;
               const myStepsDone = isMultiStep ? a.steps.filter(s => myStepSet.has(s.id)).length : 0;
               const done = isMultiStep ? (a.steps.length > 0 && myStepsDone === a.steps.length) : mySubs.has(a.id);
               const stepCompletedUsers = isMultiStep
                   ? targetMembers(a).filter(m => { const set = stepDoneByAsg[a.id]?.[m.userId]; return set && a.steps.every(s => set.has(s.id)); })
                   : [];
               const closed = a.status === 'closed';
               const overdue = !closed && a.due_date && new Date(a.due_date) < new Date();
               const dueSoon = !closed && !overdue && a.due_date && (new Date(a.due_date) - new Date()) < 2 * 24 * 3600 * 1000;
               const tCount = targetCount(a);
               const isTargeted = !!(a.target_user_ids && a.target_user_ids.length);
               const attachUrl = attachUrlById[a.id];
               const myGrade = myGrades[a.id];
               // Sadece sonuçlanmış (kapalı/süresi geçmiş) ve yeterince kalabalık (>=3 hedef)
               // ödevlerde gösterilir — küçük gruplarda oran anlamsız dalgalanır, admin'in kendi
               // "Ödev Bazlı Analiz"indeki eşikle (targetCount>=3, pct<50) tutarlı.
               const classContext = (!isClassAdmin && (closed || overdue)) ? asgCompletion(a) : null;
               const showClassContextNote = !!(classContext && classContext.targetCount >= 3 && classContext.pct < 50);
               const notSubmitted = isMultiStep
                   ? targetMembers(a).filter(m => !stepCompletedUsers.some(sm => sm.userId === m.userId))
                   : targetMembers(a).filter(m => !subs.includes(m.userId));
               const mySubAt = mySubmittedAt[a.id];
               const wasLate = done && mySubAt && a.due_date && new Date(mySubAt) > new Date(a.due_date);
               const mySubAttachUrl = mySubAttachUrlById[a.id];
               // Öğrenci durum rozeti — kartın sağ üstünde ayrı duran tek bir etiket (bkz.
               // kullanıcı geri bildirimi: "Bekliyor" yazısı kartın en sağında yer alsın).
               const studentStatusPillHtml = isMultiStep
                   ? (done ? `<span class="pg-pv-assign-badge ok">Tamamlandı</span>` : `<span class="pg-pv-assign-badge ${myStepsDone > 0 ? 'warn' : 'wait'}">${myStepsDone}/${a.steps.length} adım</span>`)
                   : closed
                       ? (done ? (wasLate ? `<span class="pg-pv-assign-badge warn">Geç teslim ettin</span>` : `<span class="pg-pv-assign-badge ok">Zamanında teslim ettin</span>`) : `<span class="pg-pv-assign-badge bad">Kaçırdın</span>`)
                       : (done ? (wasLate ? `<span class="pg-pv-assign-badge warn">Geç teslim ettin</span>` : `<span class="pg-pv-assign-badge ok">Teslim ettin</span>`) : `<span class="pg-pv-assign-badge wait">Bekliyor</span>`);
               // Kart kenar rengi: en acil/dikkat çekici duruma göre seçilir
               let accent = 'default';
               if (closed) accent = 'closed';
               else if (overdue) accent = 'overdue';
               else if (a.priority === 'urgent') accent = 'urgent';
               else if (!isClassAdmin && done) accent = 'done';
               else if (a.priority === 'important') accent = 'important';
               return `
                   <div class="cp-asg${closed ? ' cp-asg--closed' : ''}" data-accent="${accent}">
                       <div class="cp-asg-main">
                           <span class="cp-asg-title">${window._escapeHtml(a.title)}${priorityBadge(a.priority)}${(isClassAdmin && isMultiStep) ? ' <span class="pg-teacher-plan-badge" title="Çok adımlı ödev / ders planı"><i class="fa-solid fa-list-check"></i> Adımlı</span>' : ''}${isTargeted ? ` <span class="cp-asg-targeted-badge" title="Yalnızca seçili ${memberLabel.toLowerCase()}lere atandı"><i class="fa-solid fa-user-check"></i> ${tCount} kişi</span>` : ''}</span>
                           ${a.description ? `<span class="cp-asg-desc">${window._escapeHtml(a.description)}</span>` : ''}
                           ${attachUrl ? `<a href="${attachUrl}" target="_blank" rel="noopener" class="cp-asg-attach"><i class="fa-solid fa-paperclip"></i> ${window._escapeHtml(a.attachment.name || 'Ek dosya')}</a>` : ''}
                           ${!isClassAdmin && mySubAttachUrl ? `<a href="${mySubAttachUrl}" target="_blank" rel="noopener" class="cp-asg-attach" title="Teslimine eklediğin dosya"><i class="fa-solid fa-file-circle-check"></i> ${window._escapeHtml(mySubAttachment[a.id]?.name || 'Teslim dosyan')}</a>` : ''}
                           ${isClassAdmin ? `
                           <span class="cp-asg-meta">
                               ${a.due_date ? `<span${overdue ? ' style="color:#ff6b6b;"' : dueSoon ? ' style="color:#feca57;"' : ''}><i class="fa-regular fa-calendar"></i> ${fmtDue(a.due_date)}${dueSoon ? ' · Yakında' : overdue ? ' · Süresi geçti' : ''}</span> · ` : ''}
                               ${isMultiStep
                                   ? `<b>${stepCompletedUsers.length}/${tCount}</b> tamamladı`
                                   : closed
                                       ? `Kapatıldı · <b>${subs.length}/${tCount}</b> teslim`
                                       : `<b>${subs.length}/${tCount}</b> teslim`}
                           </span>` : (a.due_date ? `
                           <span class="cp-asg-meta cp-asg-meta--v2">
                               <span class="cp-asg-due${overdue ? ' is-overdue' : dueSoon ? ' is-soon' : ''}"><i class="fa-regular fa-calendar"></i> ${fmtDue(a.due_date)}</span>
                           </span>` : '')}
                           ${!isClassAdmin && myGrade ? `
                           <span class="cp-asg-grade">${myGrade.grade != null ? `<b>${myGrade.grade}/100</b>` : ''}${myGrade.teacher_feedback ? ` · <i class="fa-solid fa-comment-dots"></i> ${window._escapeHtml(myGrade.teacher_feedback)}` : ''}</span>` : ''}
                           ${showClassContextNote ? `
                           <span class="cp-asg-context-note"><i class="fa-solid fa-users"></i> Bu ${(asgLabel || 'ödevi').toLowerCase()}i sınıfın sadece %${classContext.pct}'i tamamlayabildi — yalnız değilsin.</span>` : ''}
                           ${!isClassAdmin && !closed && isMultiStep ? `
                           <details class="cp-asg-steps-toggle">
                               <summary>Adımları göster <small>(${myStepsDone}/${a.steps.length})</small></summary>
                               <div class="cp-asg-steps-checklist">
                                   ${a.steps.map(s => `
                                   <label class="cp-asg-step-row${(s.description || s.resourceUrl || s.estMinutes) ? ' cp-asg-step-row--rich' : ''}">
                                       <input type="checkbox" class="cp-asg-step-check" data-asg-id="${a.id}" data-step-id="${s.id}" ${myStepSet.has(s.id) ? 'checked' : ''}>
                                       <span class="cp-asg-step-row-body">
                                           <span class="cp-asg-step-row-title">${window._escapeHtml(s.title)}${s.estMinutes ? ` <small>(~${s.estMinutes} dk)</small>` : ''}</span>
                                           ${s.description ? `<span class="cp-asg-step-row-desc">${window._escapeHtml(s.description)}</span>` : ''}
                                           ${s.resourceUrl ? `<a href="${window._escapeHtml(s.resourceUrl)}" target="_blank" rel="noopener" class="cp-asg-step-row-link"><i class="fa-solid fa-link"></i> Kaynak</a>` : ''}
                                       </span>
                                   </label>`).join('')}
                               </div>
                           </details>` : ''}
                           ${!isClassAdmin && !closed && !isMultiStep && !done ? `
                           <details class="cp-asg-submit-form">
                               <summary>Teslim et…</summary>
                               <div class="cp-asg-submit-body">
                                   <textarea class="gsc-form-input cp-asg-submit-note" placeholder="Kısa bir not (opsiyonel)…" maxlength="200" rows="2"></textarea>
                                   <div class="cp-asg-submit-row">
                                       <label class="cp-asg-file-label">
                                           <input type="file" class="cp-asg-submit-file" style="display:none;">
                                           <span class="cp-asg-submit-file-name"><i class="fa-solid fa-paperclip"></i> Dosya/fotoğraf ekle</span>
                                       </label>
                                       <button class="cp-asg-submit-confirm" data-id="${a.id}"><i class="fa-solid fa-check"></i> Teslim Et</button>
                                   </div>
                               </div>
                           </details>` : ''}
                           ${isClassAdmin && !closed ? `
                           <details class="cp-subs">
                               <summary>${isMultiStep ? 'İlerleme durumu' : 'Kim teslim etti?'}</summary>
                               ${isMultiStep ? `
                               <div class="cp-asg-step-breakdown">
                                   ${a.steps.map(s => {
                                       const n = targetMembers(a).filter(m => stepDoneByAsg[a.id]?.[m.userId]?.has(s.id)).length;
                                       const pct = tCount ? Math.round(n / tCount * 100) : 0;
                                       return `
                                       <div class="cp-asg-step-bd-row" title="${window._escapeHtml(s.title)}">
                                           <span class="cp-asg-step-bd-title">${window._escapeHtml(s.title)}</span>
                                           <div class="cp-asg-step-bd-bar"><div class="cp-asg-step-bd-fill" style="width:${pct}%;"></div></div>
                                           <span class="cp-asg-step-bd-count">${n}/${tCount}</span>
                                       </div>`;
                                   }).join('')}
                               </div>` : ''}
                               <div class="cp-subs-list">
                                   ${targetMembers(a).map(m => {
                                       if (isMultiStep) {
                                           const set = stepDoneByAsg[a.id]?.[m.userId] || new Set();
                                           const n = a.steps.filter(s => set.has(s.id)).length;
                                           const did = n === a.steps.length;
                                           return `
                                           <details class="cp-sub-student-detail">
                                               <summary class="cp-sub${did ? ' is-done' : ''}">${did ? '✓' : '○'} ${window._escapeHtml(m.displayName)} (${n}/${a.steps.length})</summary>
                                               <div class="cp-sub-student-steps">
                                                   ${a.steps.map(s => `<span class="cp-sub-step${set.has(s.id) ? ' is-done' : ''}">${set.has(s.id) ? '✓' : '○'} ${window._escapeHtml(s.title)}</span>`).join('')}
                                               </div>
                                           </details>`;
                                       }
                                       const did = subs.includes(m.userId);
                                       const note = subNotes[a.id]?.[m.userId];
                                       return `<span class="cp-sub${did ? ' is-done' : ''}"${note ? ` title="${window._escapeHtml(note)}"` : ''}>${did ? '✓' : '○'} ${window._escapeHtml(m.displayName)}${note ? ' 💬' : ''}</span>`;
                                   }).join('')}
                               </div>
                               ${!isMultiStep && subs.length ? `
                               <div class="cp-grade-list">
                                   ${targetMembers(a).filter(m => subs.includes(m.userId)).map(m => {
                                       const g = subGrades[a.id]?.[m.userId] || {};
                                       return `
                                       <div class="cp-grade-row" data-asg-id="${a.id}" data-user-id="${m.userId}">
                                           <span class="cp-grade-row-name">${window._escapeHtml(m.displayName)}</span>
                                           <input type="number" min="0" max="100" placeholder="Puan" class="gsc-form-input cp-grade-input" value="${g.grade != null ? g.grade : ''}">
                                           <input type="text" placeholder="Geri bildirim…" maxlength="200" class="gsc-form-input cp-grade-feedback" value="${window._escapeHtml(g.teacher_feedback || '')}">
                                           <button class="control-btn secondary cp-grade-save" title="Kaydet"><i class="fa-solid fa-check"></i></button>
                                       </div>`;
                                   }).join('')}
                               </div>` : ''}
                               ${notSubmitted.length ? `<button class="control-btn secondary cp-asg-btn cp-asg-remind" data-id="${a.id}" style="margin-top:8px; font-size:11px;"><i class="fa-solid fa-bell"></i> ${isMultiStep ? 'Tamamlamayan' : 'Teslim etmeyen'} ${notSubmitted.length} kişiye hatırlat</button>` : ''}
                           </details>` : ''}
                       </div>
                       <div class="cp-asg-actions${!isClassAdmin ? ' cp-asg-actions--student' : ''}">
                           ${!isClassAdmin ? studentStatusPillHtml : ''}
                           ${!isClassAdmin && !closed && !isMultiStep && done ? `
                           <button class="control-btn secondary cp-asg-btn" data-cp-act="undo" data-id="${a.id}">Geri Al</button>` : ''}
                           ${isClassAdmin && !closed ? `<button class="control-btn secondary cp-asg-btn" data-cp-act="close" data-id="${a.id}" title="Ödevi tamamlandı olarak işaretle"><i class="fa-solid fa-check"></i> Tamamlandı</button>` : ''}
                           ${isClassAdmin ? `<button class="control-btn secondary cp-asg-btn cp-asg-btn--danger" data-cp-act="delete" data-id="${a.id}" title="Sil"><i class="fa-solid fa-trash-can"></i></button>` : ''}
                       </div>
                   </div>`;
           };
           // Öğrenci sadece kendine atanmış (veya tüm sınıfa açık) ödevleri görür
           const visibleAssignments = isClassAdmin
               ? assignments
               : assignments.filter(a => !a.target_user_ids || a.target_user_ids.includes(window.currentUser.id));
           const open = visibleAssignments.filter(a => a.status !== 'closed')
               .sort((a, b) => {
                   if (!a.due_date && !b.due_date) return 0;
                   if (!a.due_date) return 1;
                   if (!b.due_date) return -1;
                   return new Date(a.due_date) - new Date(b.due_date);
               });
           const closedList = visibleAssignments.filter(a => a.status === 'closed').slice(0, 5);
           const studentOptions = isClassAdmin ? studentMembers : [];
           const _todayD = new Date();
           const todayInputDate = `${_todayD.getFullYear()}-${String(_todayD.getMonth() + 1).padStart(2, '0')}-${String(_todayD.getDate()).padStart(2, '0')}`;
           // Ders Planı (planning.js — Planlama modülü) takip bölümü: öğretmen "Öğrencilere Ata"
           // dediğinde atanan planlar burada da izlenebilsin diye. Öğretmen tarafı: bu sınıftaki
           // tüm atamaların durumu (bekliyor/kabul/revize/red) + revize-sonrası tekrar gönder.
           // Öğrenci tarafı: bekleyen davetleri buradan da inceleyip kabul/revize/red edebilir —
           // bildirime basmak zorunda değil. planning.js yüklüyse (her zaman yüklü) window
           // üzerinden render fonksiyonları çağrılır; aşağıdaki konteynerler post-render doldurulur.
           // "Yeni Ders Planı Oluştur" butonu artık renderGroupLessonPlanStatus (planning.js)
           // tarafından, Aktif/Revize/Reddedilenler sekme çubuğuyla aynı satırda render
           // ediliyor — bkz. planning.js pg-lpa-tabs-row.
           const lessonPlanTrackerHtml = (!isWork) ? `
               <div class="cp-lpa-tracker">
                   <div id="cp-lpa-tracker-body"${isClassAdmin ? ` data-lpa-group-id="${data._supaId}"` : ''}>
                       <div class="pg-cw-loading"><span class="pg-cw-pulse-dot"></span> Yükleniyor…</div>
                   </div>
               </div>` : '';

           const quickAsgHtml = `
               ${isWork ? `<h3 class="cp-section-title" style="margin-top:0;"><i class="fa-solid fa-clipboard-list" style="color:#feca57;"></i> ${asgLabel}</h3>` : ''}
               ${isClassAdmin ? `
               <!-- Minimalist hızlı ödev çubuğu: başlık + teslim tarihi + ekle, tek satır.
                    Herkese atama varsayılan (en sık kullanılan durum) — kişi seçmek isteyen
                    "Kime atanacak?" alanını genişletir. İkincil alanlar (açıklama, şablon,
                    öncelik, dosya) "Detaylar"ın arkasında, gerektiğinde açılır. -->
               <div class="cp-asg-create cp-asg-create--mini">
                   <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
                       <span class="cp-section-subtitle">Hızlı Ödev Ekle</span>
                       <button type="button" id="cp-asg-toggle-add" class="cp-roster-pillbtn cp-roster-pillbtn--accent" title="Ödev Ekle"><i class="fa-solid fa-plus"></i> Ekle</button>
                   </div>
                   <div id="cp-asg-add-form" style="display:none;">
                   <div class="cp-asg-create-row cp-asg-create-row--main">
                       <input id="cp-asg-title" class="cp-asg-title-input" placeholder="${isWork ? 'Yeni görevlendirme…' : 'Yeni ödev… (örn: Sayfa 40-45 soruları)'}" maxlength="120">
                       <div class="cp-asg-due-wrap">
                           <span class="cp-asg-due-label">Son teslim tarihi</span>
                           <input id="cp-asg-due" class="cp-asg-pill-input cp-asg-due-mini" type="date" title="Son teslim tarihi" value="${todayInputDate}">
                       </div>
                       <button id="cp-asg-add" class="cp-asg-submit-btn" title="Ekle"><i class="fa-solid fa-plus"></i></button>
                   </div>
                   <div class="cp-asg-char-hint" id="cp-asg-title-count">0/120</div>

                   ${(!isWork && allInstitutionClasses.length > 1) ? `
                   <div class="cp-asg-class-picker">
                       <span class="cp-asg-due-label">Hangi sınıfa?</span>
                       <select id="cp-asg-class-pick" class="cp-asg-pill-input">
                           ${allInstitutionClasses.map(c => `<option value="${c.id}"${c.id === data._supaId ? ' selected' : ''}>${window._escapeHtml(c.name)}${c.id === data._supaId ? ' (bu sınıf)' : ''}</option>`).join('')}
                       </select>
                   </div>` : ''}

                   <details class="cp-asg-target-picker">
                       <summary><i class="fa-solid fa-users"></i> Kime atanacak? <span id="cp-asg-target-summary">Tüm sınıf</span></summary>
                       <div class="cp-asg-target-body">
                           <label class="cp-asg-target-row cp-asg-target-all">
                               <input type="checkbox" id="cp-asg-target-allbox" checked>
                               <span>Tüm ${memberLabel.toLowerCase()}ler</span>
                           </label>
                           <div id="cp-asg-target-students" class="cp-asg-target-students hidden">
                               ${studentOptions.map(s => `
                               <label class="cp-asg-target-row">
                                   <input type="checkbox" class="cp-asg-target-student" value="${s.userId}">
                                   <span>${window._escapeHtml(s.displayName)}</span>
                               </label>`).join('') || '<p class="cp-hint">Sınıfta henüz öğrenci yok.</p>'}
                           </div>
                       </div>
                   </details>

                   <details class="cp-asg-details-toggle">
                       <summary><i class="fa-solid fa-sliders"></i> Detaylar <small>açıklama, öncelik, dosya…</small></summary>
                       <textarea id="cp-asg-desc" class="cp-asg-pill-input cp-asg-desc-input" placeholder="Açıklama (opsiyonel) — detaylar, kaynaklar, yönergeler…" maxlength="500" rows="1"></textarea>
                       <div class="cp-asg-char-hint" id="cp-asg-desc-count">0/500</div>
                       <div class="cp-asg-create-opts">
                           ${templates.length ? `
                           <select id="cp-asg-template-pick" class="cp-asg-pill-input">
                               <option value="">Şablondan doldur…</option>
                               ${templates.map(t => `<option value="${t.id}">${window._escapeHtml(t.title)}</option>`).join('')}
                           </select>
                           <button id="cp-asg-template-del" class="cp-asg-pill-icon-btn" style="display:none;" title="Seçili şablonu sil"><i class="fa-solid fa-trash-can"></i></button>` : ''}
                           <select id="cp-asg-priority" class="cp-asg-pill-input">
                               <option value="normal">Öncelik: Normal</option>
                               <option value="important">Öncelik: Önemli</option>
                               <option value="urgent">Öncelik: Acil</option>
                           </select>
                           <label class="cp-asg-file-label">
                               <input type="file" id="cp-asg-file" style="display:none;">
                               <span id="cp-asg-file-name"><i class="fa-solid fa-paperclip"></i> Dosya ekle</span>
                           </label>
                       </div>
                   </details>
                   </div>
               </div>` : ''}
               ${open.length
                   ? `<div class="cp-asg-list">${open.map(asgCard).join('')}</div>`
                   : `<p class="cp-hint">${isClassAdmin ? 'Henüz aktif ödev yok — yukarıdan ilkini ekle.' : 'Şu an aktif ödev yok. 🎉'}</p>`}
               ${closedList.length ? `
               <button type="button" class="cp-asg-history-toggle" data-cpasghist-toggle>
                   <i class="fa-solid fa-clock-rotate-left"></i>
                   <span class="cp-asg-history-toggle-label">Geçmiş ödevleri göster</span> <span class="pg-lpa-tab-count">${closedList.length}</span>
                   <i class="fa-solid fa-chevron-down cp-asg-history-toggle-chev"></i>
               </button>
               <div class="cp-asg-list hidden" data-cpasghist-panel>${closedList.map(asgCard).join('')}</div>` : ''}`;

           // "Hızlı Ödev" (classroom_assignments/basit+çok adımlı) ile "Ders Planları"
           // (planning.js/lesson_plan_assignments — Planlama modülünden atanan kişiye özel
           // planlar) iki ayrı veri modeli/akış. ÖĞRETMEN için farklı oluşturma/yönetim
           // araçları gerektirdiğinden ayrı bir iç-sekmede kalıyor. ÖĞRENCİ için ise bu ayrım
           // anlamsız bir tıklama engeliydi — öğrenci sadece "bana ne atandı" görmek istiyor;
           // kart görünümleri zaten farklı olduğundan (ödev vs ders planı) hangisinin ne
           // olduğunu ayırt etmek için sekmeye gerek yok. Öğrenci için tek, kesintisiz liste.
           // Bildirimden gelen bir tıklama (ör. ders planı kabul/revize/red), öğretmen tarafında
           // doğrudan "Ders Planları" iç sekmesine düşsün diye — bkz. window.dcOpenAssignmentTab.
           const _initialAsgInner = window._pendingAsgInnerTab === 'planlar' ? 'planlar' : 'hizli';
           window._pendingAsgInnerTab = null;
           // Öğrenci için "Tümü/Ödevler/Ders Planları" filtresi — liste sekmesiz tek akış olduğundan
           // (bkz. üstteki not), öğrencinin sadece birini görmek istediği anlarda (ör. sadece o
           // haftaki ödevlere bakmak) hızlı bir daraltma imkanı sağlar. Filtre görünürlüğü CSS
           // display ile yönetilir, veri yeniden çekilmez.
           const _initialListFilter = 'all';
           const studentListFilterHtml = `
               <div class="cp-inner-tabs" style="margin-bottom:14px;">
                   <button class="cp-list-filter-btn${_initialListFilter === 'all' ? ' active' : ''}" data-cplistfilter="all">Tümü</button>
                   <button class="cp-list-filter-btn${_initialListFilter === 'odev' ? ' active' : ''}" data-cplistfilter="odev"><i class="fa-solid fa-clipboard-list"></i> Ödevler</button>
                   <button class="cp-list-filter-btn${_initialListFilter === 'plan' ? ' active' : ''}" data-cplistfilter="plan"><i class="fa-solid fa-chalkboard-user"></i> Ders Planları</button>
               </div>`;
           const asgHtml = isWork
               ? quickAsgHtml
               : isClassAdmin ? `
               <div class="cp-inner-tabs" style="margin-bottom:14px;">
                   <button class="cp-asg-innertab-btn${_initialAsgInner === 'hizli' ? ' active' : ''}" data-cpasgsub="hizli"><i class="fa-solid fa-clipboard-list"></i> Hızlı Ödev</button>
                   <button class="cp-asg-innertab-btn${_initialAsgInner === 'planlar' ? ' active' : ''}" data-cpasgsub="planlar"><i class="fa-solid fa-chalkboard-user"></i> Ders Planları</button>
               </div>
               <div class="cp-asg-innertab-panel${_initialAsgInner === 'hizli' ? ' active' : ' hidden'}" data-cpasgpanel="hizli">${quickAsgHtml}</div>
               <div class="cp-asg-innertab-panel${_initialAsgInner === 'planlar' ? ' active' : ' hidden'}" data-cpasgpanel="planlar">${lessonPlanTrackerHtml}</div>`
               : `${studentListFilterHtml}
               <div data-cplist-type="odev">${quickAsgHtml}</div>
               <div data-cplist-type="plan" style="margin-top:18px;">${lessonPlanTrackerHtml}</div>`;

           // ── Ders Programı — öğretmenin girdiği haftalık, tekrarlayan program.
           // Artık sınıf başına değil ŞUBE başına (117) — bu grubun içindeki her şube
           // kendi programına sahip olabilir. Yönetici (öğretmen) tüm şubelerin
           // programlarını kart listesi olarak görür; öğrenci sadece KENDİ şubesinin (veya
           // hiçbir şubeye özel olmayan "Genel" programın) yayınlanmışını doğrudan görür.
           const DAY_NAMES_TR = ['Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi','Pazar'];
           const myClassSectionId = data.members?.[window.currentUser.username]?.classSectionId || null;
           let schedulePrograms = [];
           if (isClassAdmin) {
               const { data: progRows } = await window.FocusSupabase
                   .from('group_schedule_programs').select('id, group_id, class_section_id, name, status, created_by, published_at')
                   .eq('group_id', data._supaId).order('created_at', { ascending: false });
               schedulePrograms = progRows || [];
           } else {
               schedulePrograms = schedRes?.data || [];
           }
           const publishedProgram = schedulePrograms.find(p => p.status === 'published' && (!p.class_section_id || p.class_section_id === myClassSectionId)) || null;
           let scheduleRows = [];
           if (!isClassAdmin && publishedProgram) {
               const { data: schedSlotRows } = await window.FocusSupabase
                   .from('group_class_schedule').select('*').eq('program_id', publishedProgram.id)
                   .order('day_of_week', { ascending: true }).order('time_start', { ascending: true });
               scheduleRows = schedSlotRows || [];
           }
           const scheduleByDay = {};
           scheduleRows.forEach(r => { (scheduleByDay[r.day_of_week] = scheduleByDay[r.day_of_week] || []).push(r); });
           const scheduleDayCol = (dow) => {
               const items = scheduleByDay[dow] || [];
               return `
               <div class="cp-sched-day-col">
                   <div class="cp-sched-day-head">${DAY_NAMES_TR[dow]}</div>
                   ${items.length ? items.map(r => `
                   <div class="cp-sched-slot" data-id="${r.id}">
                       <div class="cp-sched-slot-time">${(r.time_start || '').slice(0,5)}–${(r.time_end || '').slice(0,5)}</div>
                       <div class="cp-sched-slot-subject">${window._escapeHtml(r.subject)}${r.location ? ` <span class="cp-sched-slot-loc">· ${window._escapeHtml(r.location)}</span>` : ''}</div>
                   </div>`).join('') : `<div class="cp-sched-day-empty">—</div>`}
               </div>`;
           };
           const scheduleSubjectOptions = [...new Set(scheduleRows.map(r => r.subject).filter(Boolean))];

           // Admin görünümü: her ŞUBE için en fazla 1 kart (yayınlanmış varsa onu, yoksa
           // kendi taslağını göster — ikisi de varsa yayınlanmışı önceliklendir, taslak ayrıca
           // "Devam Et" rozetiyle işaretlenir). class_section_id null ise "Genel" (__general__).
           const scheduleCardByClass = {};
           if (isClassAdmin) {
               schedulePrograms.forEach(p => {
                   const key = p.class_section_id || '__general__';
                   const isMine = p.created_by === window.currentUser.id;
                   if (p.status === 'published') {
                       scheduleCardByClass[key] = { program: p, hasPublished: true, hasMyDraft: scheduleCardByClass[key]?.hasMyDraft || false };
                   } else if (p.status === 'draft' && isMine) {
                       scheduleCardByClass[key] = scheduleCardByClass[key] || { program: null, hasPublished: false, hasMyDraft: false };
                       scheduleCardByClass[key].hasMyDraft = true;
                       scheduleCardByClass[key].draftProgram = p;
                       if (!scheduleCardByClass[key].program) scheduleCardByClass[key].program = p;
                   }
               });
           }
           const classNameById = { __general__: 'Genel (şubesiz)' };
           classSections.forEach(s => { classNameById[s.id] = s.name; });
           const scheduleCardsHtml = Object.keys(scheduleCardByClass).length ? `
               <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:14px;">
                   ${Object.entries(scheduleCardByClass).map(([sectionKey, info]) => {
                       const cName = classNameById[sectionKey] || 'Şube';
                       const badge = info.hasPublished
                           ? `<span style="font-size:10.5px; font-weight:600; padding:2px 8px; border-radius:20px; background:rgba(46,204,113,0.15); color:#2ecc71;"><i class="fa-solid fa-circle-check"></i> Yayında</span>`
                           : `<span style="font-size:10.5px; font-weight:600; padding:2px 8px; border-radius:20px; background:rgba(255,193,7,0.15); color:#ffc107;"><i class="fa-solid fa-pen"></i> Taslak</span>`;
                       const progIdForActions = info.hasPublished ? info.program.id : (info.draftProgram ? info.draftProgram.id : '');
                       return `
                       <div type="button" role="button" tabindex="0" class="cp-asg-card cp-sched-class-card" data-section-id="${sectionKey}" data-section-name="${window._escapeHtml(cName)}" data-published-id="${info.hasPublished ? info.program.id : ''}" data-draft-id="${info.draftProgram ? info.draftProgram.id : ''}" style="display:flex; align-items:center; justify-content:space-between; gap:8px; width:100%; text-align:left; cursor:pointer; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:10px; padding:10px 14px; color:inherit; font:inherit;">
                           <span style="display:flex; align-items:center; gap:8px; min-width:0;">
                               <i class="fa-solid fa-calendar-days" style="color:#4ecdc4;"></i>
                               <span style="font-size:13px; font-weight:600; color:#fff; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">Ders Programı</span>
                               <span class="cp-roster-row-class" style="max-width:140px;" title="${window._escapeHtml(cName)}">${window._escapeHtml(cName)}</span>
                           </span>
                           <span style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
                               ${badge}
                               <button type="button" class="cp-sched-card-edit" data-section-id="${sectionKey}" data-section-name="${window._escapeHtml(cName)}" data-program-id="${progIdForActions}" data-program-status="${info.hasPublished ? 'published' : 'draft'}" title="Düzenle" style="width:22px; height:22px; border-radius:50%; background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:11px; display:flex; align-items:center; justify-content:center;"><i class="fa-solid fa-pen"></i></button>
                               <button type="button" class="cp-sched-card-del" data-section-id="${sectionKey}" data-section-name="${window._escapeHtml(cName)}" data-program-id="${progIdForActions}" title="Sil" style="width:22px; height:22px; border-radius:50%; background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:11px; display:flex; align-items:center; justify-content:center;"><i class="fa-solid fa-trash-can"></i></button>
                               <i class="fa-solid fa-chevron-right" style="color:var(--text-muted); font-size:11px;"></i>
                           </span>
                       </div>`;
                   }).join('')}
               </div>` : '';

           const scheduleHtml = `
               <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:12px;">
                   <div>
                       <h3 class="cp-section-title" style="margin:0 0 4px; display:flex; align-items:center; gap:6px;">
                           <i class="fa-solid fa-calendar-days" style="color:#4ecdc4;"></i> Ders Programı
                           <div class="cp-popover cp-sched-help-popover">
                               <button type="button" class="cp-sched-help-toggle" aria-label="Ders Programı hakkında bilgi"><i class="fa-solid fa-circle-info"></i></button>
                               <div class="cp-sched-help-panel cp-popover-panel" hidden>
                                   <button type="button" class="cp-popover-close" aria-label="Kapat"><i class="fa-solid fa-xmark"></i></button>
                                   <p>${isClassAdmin ? 'Sınıfların haftalık ders programlarını buradan hazırlayabilirsin — Yayınla demeden öğrenciler göremez.' : 'Öğretmeninin yayınladığı haftalık ders programı.'}</p>
                               </div>
                           </div>
                       </h3>
                   </div>
                   ${isClassAdmin ? `<button id="cp-sched-open-modal-btn" class="cp-roster-pillbtn cp-roster-pillbtn--accent" style="flex-shrink:0;"><i class="fa-solid fa-plus"></i> Oluştur</button>` : ''}
               </div>
               ${isClassAdmin ? `
               ${scheduleCardsHtml || '<p class="cp-hint">Henüz hiçbir şube için ders programı oluşturulmadı.</p>'}` : (publishedProgram ? `
               <div class="cp-sched-grid cp-sched-grid--view">
                   ${DAY_NAMES_TR.map((_, i) => scheduleDayCol(i)).join('')}
               </div>` : `<p class="cp-hint">Öğretmenin henüz bir ders programı paylaşmadı.</p>`)}`;

           // Öğrenci daveti artık burada değil — grup başlığındaki "Davet Et" butonu
           // (openGroupInviteModal) classroom tipi gruplarda otomatik olarak bu institution_invites
           // akışına geçiyor, tekrar aynı formu burada göstermeye gerek yok.
           // Not: Eski, ayrı "Ders Planı" (Yönetim) sekmesi kaldırıldı — çok adımlı ödev/ders planı
           // artık Ödevler sekmesindeki "Çok adımlı ödev / ders planı yap" seçeneğiyle aynı arayüzde
           // yönetiliyor (bkz. asgHtml, classroom_assignments.steps).

           // KPI şeridi, dikkat gerekenler, yoğunluk uyarısı ve kendi durumun/gizlilik artık
           // Genel Bakış'ta gösteriliyor (bkz. renderClassroomInsightsPanel) — panel doğrudan
           // en çok kullanılan sekmeyle (Performans/Ödevler) açılır.
           const hasPerfTab = isClassAdmin;

           // ── Rapor sekmesi — öğrenci/veli/psikolog/öğretmenin PDF olarak indirebileceği
           // öğrenci özeti: ders programı, ödev tamamlama durumu, odaklanma özeti. Yönetici
           // istediği öğrenciyi seçer, öğrenci sadece kendi raporunu indirebilir.
           const reportStudentOptions = isClassAdmin
               ? studentMembers.map(m => ({ ...m, classId: m.classSectionId || '__unassigned__' })).sort((a,b) => (a.displayName||'').localeCompare(b.displayName||'', 'tr'))
               : [];
           // Sınıf filtresi (117) — öğretmen kalabalık bir sınıfta öğrenciyi isim listesinde
           // arayıp bulmak yerine önce şubeye göre daraltabilsin.
           const reportSectionFilterHtml = (isClassAdmin && classSections.length) ? `
               <select id="cp-report-section-filter" class="cp-asg-pill-input" style="flex:0 0 150px;">
                   <option value="">Tüm şubeler</option>
                   ${classSections.map(s => `<option value="${s.id}">${window._escapeHtml(s.name)}</option>`).join('')}
                   <option value="__unassigned__">Sınıfsız</option>
               </select>` : '';
           const reportHtml = isClassAdmin ? `
               <h3 class="cp-section-title" style="margin-top:0;"><i class="fa-solid fa-file-pdf" style="color:#ff6b6b;"></i> ${memberLabel} Raporu</h3>
               <p class="cp-hint" style="margin:-4px 0 12px;">Bir ${memberLabel.toLowerCase()} seç — ders programı, ödev tamamlama durumu ve odaklanma özetini içeren bir PDF raporu oluştur. Veli görüşmesi, danışmanlık ya da kurum kaydı için kullanılabilir.</p>
               <div class="cp-report-picker">
                   ${reportSectionFilterHtml}
                   <select id="cp-report-student-select" class="cp-asg-pill-input" style="flex:1;">
                       <option value="">${memberLabel} seç…</option>
                       ${reportStudentOptions.map(m => `<option value="${m.userId}" data-section-id="${m.classId}">${window._escapeHtml(m.displayName)}</option>`).join('')}
                   </select>
                   <button id="cp-report-generate-btn" class="cp-report-btn" disabled><i class="fa-solid fa-file-arrow-down"></i> PDF Raporu Oluştur</button>
               </div>
               <div id="cp-report-status" class="cp-hint" style="margin-top:8px;"></div>` : `
               <h3 class="cp-section-title" style="margin-top:0;"><i class="fa-solid fa-file-pdf" style="color:#ff6b6b;"></i> Raporum</h3>
               <p class="cp-hint" style="margin:-4px 0 12px;">Ders programını, ödev tamamlama durumunu ve odaklanma özetini içeren kişisel raporunu PDF olarak indir.</p>
               <button id="cp-report-generate-btn" class="cp-report-btn"><i class="fa-solid fa-file-arrow-down"></i> Raporumu PDF Olarak İndir</button>
               <div id="cp-report-status" class="cp-hint" style="margin-top:8px;"></div>`;

           // ── Sınıflar/Öğrenciler sekmesi — sadece admin: KURUMDAKİ TÜM sınıfların öğrencilerini
           // (bu grubun TEK öğrenci havuzu — artık kardeş grup yok) tek listede gösterir,
           // kullanıcı adıyla arayıp doğrudan (davet beklemeden) group_members'a ekler, ve
           // öğrencileri bu grubun İÇİNDEKİ şubelere (group_class_sections) atama imkanı sunar.
           const rosterMembers = isClassAdmin
               ? studentMembers.map(m => ({ ...m, classId: m.classSectionId || '__unassigned__', className: m.classSectionId ? (sectionNameById[m.classSectionId] || 'Şube') : 'Sınıfsız' }))
                   .sort((a,b) => (a.displayName||'').localeCompare(b.displayName||'', 'tr'))
               : [];
           const unassignedRosterCount = rosterMembers.filter(m => m.classId === '__unassigned__').length;
           // Durum noktası: üye şu an odaklanıyor/çevrimiçi mi — canlı presence kanalından
           // (aynı sinyal grup üye paneli ve leaderboard'da da kullanılıyor, bkz. satır ~13917).
           if (isClassAdmin) window.registerPresenceWatchIds?.(rosterMembers.map(m => m.userId));
           const rosterPresenceState = isClassAdmin && window.getCommunityPresenceState ? window.getCommunityPresenceState() : null;
           const rosterIsOnline = (userId) => !!(rosterPresenceState && rosterPresenceState[userId] && rosterPresenceState[userId].some(p => p.studying));
           const rosterOgrencilerHtml = `
               ${(classSections.length > 0 && unassignedRosterCount > 0) ? `
               <div id="cp-roster-unassigned-warning" class="cp-roster-unassigned-warning">
                   <i class="fa-solid fa-triangle-exclamation"></i>
                   <span><b>${unassignedRosterCount}</b> ${memberLabel.toLowerCase()} henüz bir şubeye atanmadı — "Sınıfsız" olarak listeleniyor.</span>
               </div>` : ''}
               <div class="cp-roster-toolbar">
                   <div class="cp-roster-searchbox">
                       <i class="fa-solid fa-magnifying-glass cp-roster-addbox-icon"></i>
                       <input id="cp-roster-search" class="cp-roster-input" placeholder="${memberLabel} ara…">
                   </div>
               </div>
               ${rosterMembers.length > 1 ? `
               <div id="cp-roster-bulk-bar" class="cp-roster-bulk-bar hidden">
                   <i class="fa-solid fa-square-check" style="color:#a29bfe;"></i>
                   <span id="cp-roster-bulk-count" class="cp-roster-bulk-count">0 ${memberLabel.toLowerCase()} seçildi</span>
                   <div class="cp-roster-bulk-actions">
                       ${classSections.length ? `
                       <select id="cp-roster-bulk-move" class="cp-roster-input cp-roster-input--sm">
                           <option value="">Şubeye ata…</option>
                           ${classSections.map(s => `<option value="${s.id}">${window._escapeHtml(s.name)}</option>`).join('')}
                           <option value="__unassigned__">— Sınıfsız yap —</option>
                       </select>` : ''}
                       <button id="cp-roster-bulk-remove" class="cp-roster-pillbtn cp-roster-pillbtn--danger"><i class="fa-solid fa-user-xmark"></i> Çıkar</button>
                       <button id="cp-roster-bulk-clear" class="cp-roster-iconbtn" title="Seçimi temizle"><i class="fa-solid fa-xmark"></i></button>
                   </div>
               </div>
               <label class="cp-roster-selectall-row">
                   <input type="checkbox" id="cp-roster-select-all">
                   <span>Tümünü seç</span>
                   <span class="cp-roster-total-count">${rosterMembers.length} ${memberLabel.toLowerCase()}</span>
               </label>` : ''}
               <div id="cp-roster-member-list" class="cp-roster-list">
                   ${rosterMembers.length ? rosterMembers.map(m => { const sectionOptions = classSections.filter(s => s.id !== m.classId); return `
                   <div class="cp-roster-row" data-search-name="${window._escapeHtml((m.displayName||'').toLowerCase())}">
                       <span class="cp-roster-row-left">
                           ${m.userId !== window.currentUser.id ? `<input type="checkbox" class="cp-roster-row-check" data-user-id="${m.userId}" data-name="${window._escapeHtml(m.displayName)}">` : '<span class="cp-roster-row-check-spacer"></span>'}
                           <span class="cp-roster-avatar-wrap">
                               ${avatarImgHtml({ displayName: m.displayName, avatarColor: m.avatarColor, customAvatar: m.customAvatar }, 32)}
                               <span class="cp-roster-status-dot${rosterIsOnline(m.userId) ? ' cp-roster-status-dot--on' : ''}" title="${rosterIsOnline(m.userId) ? 'Şu an odaklanıyor' : 'Çevrimdışı'}"></span>
                           </span>
                           <span class="cp-roster-row-name">${window._escapeHtml(m.displayName)}</span>
                           <span class="cp-roster-row-class${m.classId === '__unassigned__' ? ' cp-roster-row-class--unassigned' : ''}" title="${window._escapeHtml(m.className)}">${window._escapeHtml(m.className)}</span>
                       </span>
                       <div class="cp-roster-row-actions">
                           ${classSections.length ? `
                           <select class="cp-roster-input cp-roster-input--sm cp-roster-move-select" data-user-id="${m.userId}" data-name="${window._escapeHtml(m.displayName)}" data-current-section-id="${m.classId}">
                               <option value="">${m.classId === '__unassigned__' ? 'Şubeye ata…' : 'Şube değiştir…'}</option>
                               ${sectionOptions.map(s => `<option value="${s.id}">${window._escapeHtml(s.name)}</option>`).join('')}
                               ${m.classId !== '__unassigned__' ? `<option value="__unassigned__">— Sınıfsız yap —</option>` : ''}
                           </select>` : ''}
                           ${m.userId !== window.currentUser.id ? `<button class="cp-roster-remove-btn cp-roster-iconbtn cp-roster-iconbtn--danger" data-user-id="${m.userId}" data-name="${window._escapeHtml(m.displayName)}" title="Sınıftan çıkar"><i class="fa-solid fa-user-xmark"></i></button>` : ''}
                       </div>
                   </div>`; }).join('') : `
                   <div class="cp-roster-empty">
                       <i class="fa-solid fa-user-group"></i>
                       <p>Henüz ${memberLabel.toLowerCase()} yok. Üstteki <b>"Davet Et"</b> butonuyla ilk ${memberLabel.toLowerCase()}ini davet et.</p>
                   </div>`}
               </div>`;

           // "Şubeler" alt-görünümü — bu grubun İÇİNDEKİ sınıf/şube etiketlerini yönetir
           // (group_class_sections, 116). Artık ayrı bir grup DEĞİL, sadece bu grubun
           // öğrencilerini gruplamak için bir etiket sistemi — Performans/Ders Programı bu
           // etikete göre filtrelenir.
           const sectionMemberCount = {};
           rosterMembers.forEach(m => { if (m.classId !== '__unassigned__') sectionMemberCount[m.classId] = (sectionMemberCount[m.classId] || 0) + 1; });
           const rosterSiniflarHtml = `
               <div class="cp-roster-classes-head">
                   <p class="cp-hint" style="margin:0;">Bu gruptaki öğrencileri şubelere ayır — Performans tablosunda ve Ders Programı'nda şubeye göre filtreleyebilesin.</p>
               </div>
               <div class="cp-roster-addbox" style="margin-bottom:12px;">
                   <i class="fa-solid fa-chalkboard cp-roster-addbox-icon"></i>
                   <input id="cp-section-add-name" class="cp-roster-input" placeholder="Yeni şube adı (ör. 9-A)…" maxlength="40" autocomplete="off">
                   <button id="cp-section-add-btn" class="cp-roster-addbtn" title="Şube Oluştur"><i class="fa-solid fa-plus"></i></button>
               </div>
               <div id="cp-section-add-status" class="cp-hint" style="margin:-6px 0 12px;"></div>
               <div class="cp-inst-class-grid">
                   ${classSections.length ? classSections.map(s => `
                   <div class="cp-inst-class-card cp-section-card-open" role="button" tabindex="0" style="cursor:pointer;" data-section-id="${s.id}" data-section-name="${window._escapeHtml(s.name)}">
                       <div class="cp-inst-class-icon"><i class="fa-solid fa-chalkboard"></i></div>
                       <div class="cp-inst-class-name">${window._escapeHtml(s.name)}</div>
                       <div class="cp-inst-class-meta">${sectionMemberCount[s.id] || 0} ${memberLabel.toLowerCase()}</div>
                   </div>`).join('') : `<p class="cp-hint">Henüz şube yok. Yukarıdan ilk şubeni oluştur.</p>`}
               </div>`;

           // Öğrenciler/Şubeler iç-sekmesi hangi seçiliyse (kart tıklayıp modal kapatınca ya
           // da bir işlem sonrası refresh() ile) o sekmede kalmaya devam etsin — sabit
           // "ogrenciler" varsayılanı, Şubeler'deyken yapılan her işlemde kullanıcıyı
           // Öğrenciler'e geri atıyordu (bkz. kullanıcı geri bildirimi, 2026-07-11).
           const activeRosterSubtab = el.dataset.activeRosterSubtab === 'siniflar' ? 'siniflar' : 'ogrenciler';
           const rosterHtml = isClassAdmin ? `
               <div class="cp-roster-panel">
                   <h3 class="cp-section-title" style="margin-top:0;"><i class="fa-solid fa-users" style="color:#74b9ff;"></i> Sınıflar/${memberLabel}ler</h3>
                   <div class="cp-roster-segctrl">
                       <button class="cp-roster-innertab-btn${activeRosterSubtab === 'ogrenciler' ? ' active' : ''}" data-cprostersub="ogrenciler"><i class="fa-solid fa-user-group"></i> ${memberLabel}ler</button>
                       <button class="cp-roster-innertab-btn${activeRosterSubtab === 'siniflar' ? ' active' : ''}" data-cprostersub="siniflar"><i class="fa-solid fa-chalkboard-user"></i> Şubeler</button>
                   </div>
                   <div class="cp-roster-innertab-panel${activeRosterSubtab === 'ogrenciler' ? ' active' : ' hidden'}" data-cprosterpanel="ogrenciler">${rosterOgrencilerHtml}</div>
                   <div class="cp-roster-innertab-panel${activeRosterSubtab === 'siniflar' ? ' active' : ' hidden'}" data-cprosterpanel="siniflar">${rosterSiniflarHtml}</div>
               </div>` : '';

           // Öğrenci için "Performansım" — eskiden Genel Bakış'ta ayrı bir kart olan streak/KPI/
           // geçmiş bloğu, artık Sınıf Paneli'nin İLK alt sekmesi (öğretmenin "Performans"ıyla
           // karışmasın diye ayrı isim). Öğretmende bu sekme yok, kendi "Performans" sekmesi zaten var.
           const hasStudentPerfTab = !isClassAdmin;
           const availableSubtabs = [...(hasStudentPerfTab ? ['performansim'] : []), ...(hasPerfTab ? ['performans'] : []), 'odevler', 'program', ...(isClassAdmin ? ['roster'] : []), 'rapor'];
           const defaultSubtab = hasStudentPerfTab ? 'performansim' : (hasPerfTab ? 'performans' : 'odevler');
           let activeSubtab = availableSubtabs.includes(el.dataset.activeSubtab) ? el.dataset.activeSubtab : defaultSubtab;
           // "Ödevlerim" rozetinden gelen tıklama, panel ilk açıldığında doğrudan Ödevler sekmesine düşsün
           if (window._pendingClassroomSubtab && availableSubtabs.includes(window._pendingClassroomSubtab)) {
               activeSubtab = window._pendingClassroomSubtab;
           }
           window._pendingClassroomSubtab = null;
           // "pending" ile (tıklama olmadan, ör. sayfa yenileme restorasyonu
           // sırasında) belirlenen alt sekme, tıklama olay dinleyicisi hiç
           // tetiklenmediği için hem dataset'e hem localStorage'a hiç yazılmıyordu
           // — bu yüzden bir sonraki yenilemede tekrar varsayılan sekmeye düşülüyordu.
           // Her render'da güncel alt sekmeyi burada senkronla.
           el.dataset.activeSubtab = activeSubtab;
           if (typeof window._dcPersistLastOpen === 'function') {
               window._dcPersistLastOpen({ fn: 'group-panel', code: data.code, gtab: 'classroom', subtab: activeSubtab });
           }
           const isActive = (name) => name === activeSubtab ? ' active' : '';
           el.innerHTML = `
               <div class="cp-subtabs">
                   ${hasStudentPerfTab ? `<button class="cp-subtab-btn${isActive('performansim')}" data-cpsub="performansim"><i class="fa-solid fa-chart-line"></i> Performansım</button>` : ''}
                   ${hasPerfTab ? `<button class="cp-subtab-btn${isActive('performans')}" data-cpsub="performans"><i class="fa-solid fa-chart-line"></i> Performans</button>` : ''}
                   <button class="cp-subtab-btn${isActive('odevler')}" data-cpsub="odevler"><i class="fa-solid fa-clipboard-list"></i> ${asgLabel}</button>
                   <button class="cp-subtab-btn${isActive('program')}" data-cpsub="program"><i class="fa-solid fa-calendar-days"></i> Ders Programı</button>
                   ${isClassAdmin ? `<button class="cp-subtab-btn${isActive('roster')}" data-cpsub="roster"><i class="fa-solid fa-users"></i> Sınıflar/${memberLabel}ler</button>` : ''}
                   <button class="cp-subtab-btn${isActive('rapor')}" data-cpsub="rapor"><i class="fa-solid fa-file-pdf"></i> Rapor</button>
               </div>
               ${hasStudentPerfTab ? `<div class="cp-subtab-panel${isActive('performansim')}" data-cpsubpanel="performansim"><div id="grp-intro-insights" class="cp-skeleton"><div class="cp-skel-strip"><div class="cp-skel-box"></div><div class="cp-skel-box"></div><div class="cp-skel-box"></div><div class="cp-skel-box"></div></div></div></div>` : ''}
               ${hasPerfTab ? `<div class="cp-subtab-panel${isActive('performans')}" data-cpsubpanel="performans">${perfHtml}</div>` : ''}
               <div class="cp-subtab-panel${isActive('odevler')}" data-cpsubpanel="odevler">${asgHtml}</div>
               <div class="cp-subtab-panel${isActive('program')}" data-cpsubpanel="program">${scheduleHtml}</div>
               ${isClassAdmin ? `<div class="cp-subtab-panel${isActive('roster')}" data-cpsubpanel="roster">${rosterHtml}</div>` : ''}
               <div class="cp-subtab-panel${isActive('rapor')}" data-cpsubpanel="rapor">${reportHtml}</div>`;

           // "Performansım" panelinin içeriği (streak/KPI/geçmiş) — aynı renderClassroomInsightsPanel
           // fonksiyonu (öğrenci dalı), artık Genel Bakış yerine burayı (#grp-intro-insights bu panelin
           // içinde) hedefliyor. İki konum aynı anda DOM'da olmuyor (biri isClassAdmin, diğeri değil).
           if (hasStudentPerfTab) renderClassroomInsightsPanel(el, data, false, memberCount);

           // ── Ders Planları takip bölümü (planning.js'deki render fonksiyonlarını çağırır) ──
           const lpaTrackerBody = el.querySelector('#cp-lpa-tracker-body');
           if (lpaTrackerBody) {
               if (isClassAdmin && typeof window.renderGroupLessonPlanStatus === 'function') {
                   window.renderGroupLessonPlanStatus(data._supaId, lpaTrackerBody);
               } else if (!isClassAdmin && typeof window.renderStudentLessonPlanInvitesForGroup === 'function') {
                   window.renderStudentLessonPlanInvitesForGroup(data._supaId, lpaTrackerBody);
               } else {
                   lpaTrackerBody.innerHTML = '<p class="cp-hint">Bu bölüm şu an yüklenemedi.</p>';
               }
           }

           // ── Rapor sekmesi: öğrenci seçimi + PDF (yazdır) oluşturma ──
           const reportSelect = el.querySelector('#cp-report-student-select');
           const reportSectionFilter = el.querySelector('#cp-report-section-filter');
           const reportBtn = el.querySelector('#cp-report-generate-btn');
           const reportStatus = el.querySelector('#cp-report-status');
           reportSelect?.addEventListener('change', () => {
               if (reportBtn) reportBtn.disabled = !reportSelect.value;
           });
           reportSectionFilter?.addEventListener('change', () => {
               const sectionId = reportSectionFilter.value;
               [...(reportSelect?.options || [])].forEach(opt => {
                   if (!opt.value) return; // "… seç" placeholder her zaman görünür kalır
                   opt.hidden = !!sectionId && opt.dataset.sectionId !== sectionId;
               });
               // Filtrelenip görünmez kalan bir öğrenci seçiliyse seçim sıfırlanır.
               const selectedOpt = reportSelect?.selectedOptions?.[0];
               if (selectedOpt && selectedOpt.hidden) {
                   reportSelect.value = '';
                   if (reportBtn) reportBtn.disabled = true;
               }
           });
           reportBtn?.addEventListener('click', async () => {
               const studentUserId = isClassAdmin ? reportSelect?.value : window.currentUser.id;
               const studentEntry = isClassAdmin
                   ? reportStudentOptions.find(m => m.userId === studentUserId)
                   : { displayName: window.currentUser.displayName || window.currentUser.username };
               if (!studentUserId || !studentEntry) return;
               reportBtn.disabled = true;
               const prevLabel = reportBtn.innerHTML;
               reportBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Hazırlanıyor…';
               if (reportStatus) reportStatus.textContent = '';
               try {
                   await _cpGenerateStudentReport({
                       data, isWork, memberLabel, assignments, subsByAsg, subGrades, stepDoneByAsg,
                       submittedAtByAsgUser, scheduleRows, DAY_NAMES_TR, studentUserId,
                       studentName: studentEntry.displayName
                   });
               } catch (e) {
                   if (reportStatus) { reportStatus.textContent = 'Rapor oluşturulamadı: ' + (e.message || 'bilinmeyen hata'); reportStatus.style.color = '#ff6b6b'; }
               } finally {
                   reportBtn.disabled = isClassAdmin ? !reportSelect.value : false;
                   reportBtn.innerHTML = prevLabel;
               }
           });

           el.querySelectorAll('.cp-subtab-btn').forEach(btn => {
               btn.addEventListener('click', () => {
                   el.dataset.activeSubtab = btn.dataset.cpsub;
                   el.querySelectorAll('.cp-subtab-btn').forEach(b => b.classList.remove('active'));
                   el.querySelectorAll('.cp-subtab-panel').forEach(p => p.classList.remove('active'));
                   btn.classList.add('active');
                   el.querySelector(`.cp-subtab-panel[data-cpsubpanel="${btn.dataset.cpsub}"]`)?.classList.add('active');
                   // Sınıf Paneli'nin hangi alt sekmesinde olunduğunu da kaydet — sayfa
                   // yenilemesinde grup paneli geri açıldığında aynı alt sekmeye düşülsün.
                   if (typeof window._dcPersistLastOpen === 'function') window._dcPersistLastOpen({ fn: 'group-panel', code: data.code, gtab: 'classroom', subtab: btn.dataset.cpsub });
               });
           });

           // "Hızlı Ödev" / "Ders Planları" iç-sekme geçişi (sadece öğretmen tarafında var)
           el.querySelectorAll('.cp-asg-innertab-btn').forEach(btn => {
               btn.addEventListener('click', () => {
                   el.querySelectorAll('.cp-asg-innertab-btn').forEach(b => b.classList.remove('active'));
                   el.querySelectorAll('.cp-asg-innertab-panel').forEach(p => p.classList.add('hidden'));
                   btn.classList.add('active');
                   el.querySelector(`.cp-asg-innertab-panel[data-cpasgpanel="${btn.dataset.cpasgsub}"]`)?.classList.remove('hidden');
               });
           });

           // Öğrenci "Tümü/Ödevler/Ders Planları" filtresi — veri yeniden çekilmez, sadece
           // ilgili blok(lar) gösterilir/gizlenir.
           el.querySelectorAll('.cp-list-filter-btn').forEach(btn => {
               btn.addEventListener('click', () => {
                   el.querySelectorAll('.cp-list-filter-btn').forEach(b => b.classList.remove('active'));
                   btn.classList.add('active');
                   const filter = btn.dataset.cplistfilter;
                   el.querySelectorAll('[data-cplist-type]').forEach(block => {
                       block.classList.toggle('hidden', filter !== 'all' && block.dataset.cplistType !== filter);
                   });
               });
           });

           // "Geçmiş ödevleri göster" açılır-kapanır bağlantı — önceden ayrı bir Aktif/Geçmiş
           // sekme çubuğuydu ("kafa karıştırıcı" geri bildirimi üzerine kaldırıldı); artık aktif
           // liste her zaman görünür, geçmiş sadece istenirse tek tıkla altta açılır.
           el.querySelectorAll('[data-cpasghist-toggle]').forEach(btn => {
               btn.addEventListener('click', () => {
                   const panel = btn.nextElementSibling;
                   if (!panel || !panel.matches('[data-cpasghist-panel]')) return;
                   const willShow = panel.classList.contains('hidden');
                   panel.classList.toggle('hidden', !willShow);
                   btn.classList.toggle('is-open', willShow);
                   const label = btn.querySelector('.cp-asg-history-toggle-label');
                   if (label) label.textContent = willShow ? 'Geçmiş ödevleri gizle' : 'Geçmiş ödevleri göster';
               });
           });

           const wireKickBtns = (scope) => {
               scope.querySelectorAll('.cp-row-kick-btn').forEach(btn => {
                   btn.addEventListener('click', async () => {
                       const userId = btn.dataset.userId;
                       const name = btn.dataset.name;
                       const ok = await window.showFocusaiConfirm({
                           title: `${memberLabel === 'Çalışan' ? 'Ekipten' : 'Sınıftan'} Çıkar`,
                           desc: `<b>${window._escapeHtml(name)}</b> ${memberLabel.toLowerCase()}sini gruptan çıkarmak istediğine emin misin?`,
                           type: 'danger', icon: 'fa-user-xmark', confirmText: 'Çıkar', cancelText: 'Vazgeç'
                       });
                       if (!ok) return;
                       btn.disabled = true;
                       const { error } = await window.FocusSupabase.from('group_members').delete().eq('group_id', data._supaId).eq('user_id', userId);
                       if (error) { window.dcShowToast('Çıkarılamadı: ' + error.message, 'error'); btn.disabled = false; return; }
                       window.dcShowToast(`${name} gruptan çıkarıldı.`, 'success');
                       refresh();
                   });
               });
           };
           wireKickBtns(el);

           // Performans satırındaki isme tıklama → Rapor sekmesine geçip o üyeyi otomatik seçer.
           // group_member_daily_stats RPC'si (096) zaten Rapor sekmesinde kullanılıyor; burada
           // ekstra sorgu yok, sadece mevcut "öğrenci seç" dropdown'ını programatik dolduruyoruz —
           // öğretmen "bu satırda neden böyle" sorusunu tek tıkla 8 haftalık detaya inerek yanıtlayabilsin.
           const wireReportDrilldown = (scope) => {
               scope.querySelectorAll('.cp-perf-name-link').forEach(nameEl => {
                   nameEl.addEventListener('click', () => {
                       const userId = nameEl.dataset.userId;
                       if (!userId) return;
                       el.querySelector('.cp-subtab-btn[data-cpsub="rapor"]')?.click();
                       const select = el.querySelector('#cp-report-student-select');
                       if (select) {
                           select.value = userId;
                           select.dispatchEvent(new Event('change'));
                           select.scrollIntoView({ behavior: 'smooth', block: 'center' });
                       }
                   });
               });
           };
           wireReportDrilldown(el);

           // "az veri" rozeti masaüstünde native title ile hover'da açıklamasını gösteriyor
           // ama mobilde/tablette title hiç tetiklenmiyor — dokununca aynı açıklamayı toast
           // olarak gösteriyoruz (KPI şeridindeki tekil rozette zaten aynı çözüm var, bkz.
           // cp-lowsample-badge click handler'ı — burada satır satır tekrarlayan rozetler için).
           const wireLowSampleBadges = (scope) => {
               scope.querySelectorAll('.cp-lowsample-badge').forEach(badge => {
                   badge.addEventListener('click', (e) => {
                       e.stopPropagation();
                       window.dcShowToast(badge.title, 'info');
                   });
               });
           };
           wireLowSampleBadges(el);

           // Popover'lar (Bu bölüm nasıl okunur / Filtrele): sohbet balonu gibi açılıp
           // kapanan, tıklama-dışı veya çarpı ile kapanan mini panel. Tek seferlik
           // delege edilmiş "dışa tıklama" dinleyicisi tüm .cp-popover'lar için ortak.
           el.querySelectorAll('.cp-popover').forEach(pop => {
               const toggle = pop.querySelector(':scope > button');
               const panel = pop.querySelector(':scope > .cp-popover-panel');
               if (!toggle || !panel) return;
               toggle.addEventListener('click', (e) => {
                   e.stopPropagation();
                   const willOpen = panel.hidden;
                   document.querySelectorAll('.cp-popover-panel').forEach(p => { p.hidden = true; });
                   document.querySelectorAll('.cp-popover.cp-popover-open').forEach(p => p.classList.remove('cp-popover-open'));
                   panel.hidden = !willOpen;
                   pop.classList.toggle('cp-popover-open', willOpen);
               });
               panel.addEventListener('click', (e) => e.stopPropagation());
               panel.querySelector('.cp-popover-close')?.addEventListener('click', () => {
                   panel.hidden = true;
                   pop.classList.remove('cp-popover-open');
               });
           });
           if (!window.__cpPopoverOutsideClickWired) {
               window.__cpPopoverOutsideClickWired = true;
               document.addEventListener('click', (e) => {
                   document.querySelectorAll('.cp-popover').forEach(pop => {
                       if (!pop.contains(e.target)) {
                           const panel = pop.querySelector(':scope > .cp-popover-panel');
                           if (panel) panel.hidden = true;
                           pop.classList.remove('cp-popover-open');
                       }
                   });
               });
           }

           if (isClassAdmin && tableRows.length) {
               const perfRowsWrap = el.querySelector('#cp-perf-rows');
               const perfPeriodLabelEl = el.querySelector('#cp-perf-period-label');
               const perfClassLabelEl = el.querySelector('#cp-perf-class-label');
               const perfTableMetaEl = el.querySelector('#cp-perf-table-meta');
               const perfDistWrap = el.querySelector('#cp-perf-dist-wrap');
               const rerenderPerfRows = () => {
                   const visible = filterPerfRowsByClass(el.dataset.perfClass, tableRows);
                   perfRowsWrap.innerHTML = renderPerfRowsHtml(sortPerfRows(el.dataset.perfSortKey, el.dataset.perfSortDir, visible));
                   wireKickBtns(perfRowsWrap);
                   wireReportDrilldown(perfRowsWrap);
                   wireLowSampleBadges(perfRowsWrap);
                   const cid = el.dataset.perfClass;
                   if (perfClassLabelEl) {
                       perfClassLabelEl.textContent = ' · ' + (cid === 'all' ? 'tüm sınıflar' : cid === '__unassigned__' ? 'sınıfsız' : (sectionNameById[cid] || ''));
                   }
                   // Filtre şeridi yalnızca varsayılandan (dönem=Tümü + sınıf=Tümü) farklıyken
                   // görünür — aksi halde her zaman aynı şeyi söyleyen gereksiz bir satır olurdu.
                   if (perfTableMetaEl) {
                       const isDefault = el.dataset.perfPeriod === 'all' && (!showClassColumn || cid === 'all');
                       perfTableMetaEl.classList.toggle('cp-perf-table-meta--hidden', isDefault);
                   }
               };
               // Sıralanabilir sütun başlıkları — 3 durumlu döngü (Excel/Sheets'teki gibi):
               // 1. tık: artan (asc), 2. tık: azalan (desc), 3. tık: varsayılana (isme göre artan)
               // döner — aksi halde bir sütunda sonsuza dek asc/desc arasında sıkışıp kalır ve
               // "eski hâline dönme" yolu olmazdı.
               const PERF_DEFAULT_SORT_KEY = 'name', PERF_DEFAULT_SORT_DIR = 'asc';
               el.querySelectorAll('[data-perfsortkey]').forEach(btn => {
                   btn.addEventListener('click', () => {
                       const key = btn.dataset.perfsortkey;
                       const sameKey = el.dataset.perfSortKey === key;
                       if (sameKey && el.dataset.perfSortDir === 'desc') {
                           el.dataset.perfSortKey = PERF_DEFAULT_SORT_KEY;
                           el.dataset.perfSortDir = PERF_DEFAULT_SORT_DIR;
                       } else if (sameKey) {
                           el.dataset.perfSortDir = 'desc';
                       } else {
                           el.dataset.perfSortKey = key;
                           el.dataset.perfSortDir = 'asc';
                       }
                       el.querySelectorAll('[data-perfsortkey]').forEach(b => {
                           const active = b.dataset.perfsortkey === el.dataset.perfSortKey;
                           b.classList.toggle('active', active);
                           const icon = b.querySelector('.cp-perf-sort-arrow');
                           if (icon) icon.className = 'fa-solid cp-perf-sort-arrow ' + (active ? (el.dataset.perfSortDir === 'desc' ? 'fa-arrow-down' : 'fa-arrow-up') : 'fa-sort');
                       });
                       rerenderPerfRows();
                   });
               });
               el.querySelectorAll('[data-perfclass]').forEach(btn => {
                   btn.addEventListener('click', () => {
                       const classId = btn.dataset.perfclass;
                       if (el.dataset.perfClass === classId) return;
                       el.dataset.perfClass = classId;
                       el.querySelectorAll('[data-perfclass]').forEach(b => b.classList.toggle('active', b.dataset.perfclass === classId));
                       rerenderPerfRows();
                   });
               });
               el.querySelectorAll('[data-perfperiod]').forEach(btn => {
                   btn.addEventListener('click', async () => {
                       const period = btn.dataset.perfperiod;
                       if (el.dataset.perfPeriod === period) return;
                       el.dataset.perfPeriod = period;
                       el.querySelectorAll('[data-perfperiod]').forEach(b => b.classList.toggle('active', b.dataset.perfperiod === period));
                       if (perfPeriodLabelEl) perfPeriodLabelEl.textContent = periodLabel[period];
                       perfRows = buildPerfRows(period);
                       perfRows.forEach(r => { r.classId = r.classSectionId || '__unassigned__'; r.className = r.classSectionId ? (sectionNameById[r.classSectionId] || 'Sınıf') : 'Sınıfsız'; });
                       tableRows = perfRows;
                       if (perfDistWrap) perfDistWrap.innerHTML = renderPerfDistributionHtml(perfRows);
                       rerenderPerfRows();
                   });
               });
           }


           // ── Aksiyonlar ──
           const refresh = () => {
               renderClassroomTabCached(data, isClassAdmin, true);
               if (!isClassAdmin && typeof window._refreshMyAssignmentsBadge === 'function') window._refreshMyAssignmentsBadge();
           };
           // Not: Aylık Rapor (ve CSV dışa aktarma) kaldırıldı (2026-07-13, kullanıcı kararı) —
           // buradaki eski #cp-csv-btn bağlama kodu da bu yüzden yok.

           // Ders Programı: "Ders Programı Oluştur" modalını aç + şube kartına tıklayınca
           // o şubenin programını görüntüle/düzenle (sadece admin). "classChoices" artık
           // gruplar değil, bu grubun içindeki ŞUBELER — "Genel (şubesiz)" seçeneği kaldırıldı
           // (2026-07-11, kullanıcı kararı): yeni bir ders programı ancak bir şubeye atanarak
           // oluşturulabilir, önce Şubeler'den bir şube açılması gerekir. Var olan eski "Genel"
           // programları (class_section_id = null) görüntüleme/düzenleme/silme için hâlâ çalışır
           // (bkz. scheduleCardByClass/classNameById) — sadece YENİ oluşturma akışından kaldırıldı.
           if (isClassAdmin) {
               const buildClassChoices = () => classSections.map(s => ({ id: s.id, name: s.name }));
               el.querySelector('#cp-sched-open-modal-btn')?.addEventListener('click', () => {
                   _cpOpenScheduleModal(buildClassChoices(), scheduleSubjectOptions, refresh, data._supaId);
               });
               el.querySelectorAll('.cp-sched-class-card').forEach(btn => {
                   btn.addEventListener('click', () => {
                       const sectionId = btn.dataset.sectionId;
                       const sectionName = btn.dataset.sectionName;
                       const publishedId = btn.dataset.publishedId;
                       const draftId = btn.dataset.draftId;
                       // Yayınlanmış program varsa önce salt-okunur görüntüle; taslak varsa
                       // (yayın yoksa veya kendi taslağı) düzenleme ekranına götür.
                       if (publishedId) {
                           _cpOpenScheduleViewModal(data._supaId, sectionName, publishedId);
                       } else if (draftId) {
                           _cpOpenScheduleModal(buildClassChoices(), scheduleSubjectOptions, refresh, data._supaId);
                           _cpSchedShowBuilder({ groupId: data._supaId, sectionId, groupName: sectionName, programId: draftId, programStatus: 'draft' });
                       }
                   });
               });
               el.querySelectorAll('.cp-sched-card-edit').forEach(btn => {
                   btn.addEventListener('click', (e) => {
                       e.stopPropagation();
                       const sectionId = btn.dataset.sectionId, sectionName = btn.dataset.sectionName;
                       const programId = btn.dataset.programId, programStatus = btn.dataset.programStatus;
                       if (!programId) return;
                       _cpOpenScheduleModal(buildClassChoices(), scheduleSubjectOptions, refresh, data._supaId);
                       _cpSchedShowBuilder({ groupId: data._supaId, sectionId, groupName: sectionName, programId, programStatus });
                   });
               });
               el.querySelectorAll('.cp-sched-card-del').forEach(btn => {
                   btn.addEventListener('click', async (e) => {
                       e.stopPropagation();
                       const sectionName = btn.dataset.sectionName, programId = btn.dataset.programId;
                       if (!programId) return;
                       const ok = await window.showFocusaiConfirm({
                           title: 'Ders Programını Sil',
                           desc: `"${window._escapeHtml(sectionName)}" için ders programı (tüm dersleriyle birlikte) kalıcı olarak silinsin mi? Bu işlem geri alınamaz.`,
                           type: 'danger', icon: 'fa-trash-can', confirmText: 'Sil', cancelText: 'Vazgeç',
                       });
                       if (!ok) return;
                       btn.disabled = true;
                       await window.FocusSupabase.from('group_class_schedule').delete().eq('program_id', programId);
                       await window.FocusSupabase.from('group_schedule_programs').delete().eq('id', programId);
                       window.dcShowToast?.('Ders programı silindi.', 'success');
                       refresh();
                   });
               });

               // Öğrenciler sekmesi: isme göre anlık arama/filtreleme
               const rosterSearchInput = el.querySelector('#cp-roster-search');
               rosterSearchInput?.addEventListener('input', () => {
                   const q = rosterSearchInput.value.trim().toLocaleLowerCase('tr');
                   el.querySelectorAll('.cp-roster-row').forEach(card => {
                       card.style.display = !q || (card.dataset.searchName || '').includes(q) ? '' : 'none';
                   });
               });

               el.querySelectorAll('.cp-roster-remove-btn').forEach(btn => {
                   btn.addEventListener('click', async () => {
                       const userId = btn.dataset.userId;
                       const name = btn.dataset.name;
                       const ok = await window.showFocusaiConfirm({
                           title: `${memberLabel === 'Çalışan' ? 'Ekipten' : 'Sınıftan'} Çıkar`,
                           desc: `<b>${window._escapeHtml(name)}</b> ${memberLabel.toLowerCase()}sini sınıftan çıkarmak istediğine emin misin?`,
                           type: 'danger', icon: 'fa-user-xmark', confirmText: 'Çıkar', cancelText: 'Vazgeç'
                       });
                       if (!ok) return;
                       btn.disabled = true;
                       const fromGroupId = btn.dataset.classId || data._supaId;
                       const { error } = await window.FocusSupabase.from('group_members').delete().eq('group_id', fromGroupId).eq('user_id', userId);
                       if (error) { window.dcShowToast('Çıkarılamadı: ' + error.message, 'error'); btn.disabled = false; return; }
                       window.dcShowToast(`${name} sınıftan çıkarıldı.`, 'success');
                       refresh();
                   });
               });

               // Şubeye atama: artık ayrı bir gruba taşıma değil, AYNI grubun içinde
               // group_members.class_section_id güncellenmesi (116) — tek bir UPDATE yeterli.
               el.querySelectorAll('.cp-roster-move-select').forEach(sel => {
                   sel.addEventListener('change', async () => {
                       const val = sel.value;
                       if (!val) return;
                       const userId = sel.dataset.userId;
                       const name = sel.dataset.name;
                       const targetName = val === '__unassigned__' ? 'Sınıfsız' : (classSections.find(s => s.id === val)?.name || 'Şube');
                       const ok = await window.showFocusaiConfirm({
                           title: 'Şube Değiştir',
                           desc: `<b>${window._escapeHtml(name)}</b> için şube <b>${window._escapeHtml(targetName)}</b> olarak değiştirilsin mi?`,
                           type: 'default', icon: 'fa-chalkboard-user', confirmText: 'Değiştir', cancelText: 'Vazgeç'
                       });
                       if (!ok) { sel.value = ''; return; }
                       sel.disabled = true;
                       const oldSectionId = sel.dataset.currentSectionId || null;
                       // .select() ŞART: RLS satırı reddederse Supabase hata döndürmez,
                       // sadece 0 satır etkiler — dönen satırı kontrol etmezsek "başarılı"
                       // gösterip sayfa yenilenince atama kaybolmuş gibi görünür (124/125).
                       const { data: updRows, error } = await window.FocusSupabase.from('group_members')
                           .update({ class_section_id: val === '__unassigned__' ? null : val })
                           .eq('group_id', data._supaId).eq('user_id', userId).select('user_id');
                       if (error || !updRows || updRows.length === 0) {
                           window.dcShowToast('Şube güncellenemedi' + (error ? ': ' + error.message : ' — yetki (RLS) reddetti, 124/125 migration canlıda uygulanmamış olabilir.'), 'error');
                           sel.disabled = false; sel.value = ''; return;
                       }
                       const newSectionId = val === '__unassigned__' ? null : val;
                       _cpPatchMemberSection(data, userId, newSectionId);
                       // "Şube kartına tıkla → öğrenci listesi" modalı (aşağıdaki
                       // cp-section-card-open click handler'ı) bu render'ın kapandığı
                       // `rosterMembers` dizisini filtreleyip listeliyor — sadece data.members'ı
                       // (yukarıda) veya DOM'u güncellemek bu diziyi TAZELEMEZ, kart hemen
                       // ardından tıklanınca öğrenci hâlâ eski şubede/sınıfsız görünürdü
                       // (kullanıcı bildirimi: "şubede kullanıcının kaydı gözükmüyor"). Bu
                       // kapanmış diziyi de yerinde güncelliyoruz.
                       const rmEntry = rosterMembers.find(rm => rm.userId === userId);
                       if (rmEntry) {
                           rmEntry.classId = newSectionId || '__unassigned__';
                           rmEntry.className = newSectionId ? (classSections.find(s => s.id === newSectionId)?.name || 'Şube') : 'Sınıfsız';
                       }
                       window.dcShowToast(`${name} için şube güncellendi.`, 'success');
                       // Değişikliği tüm sekmeyi yeniden yükleyip (iskelet-yükleniyor yanıp
                       // sönmesine, "sayfa yenilenmiş gibi" hissettiren gecikmeye yol açan
                       // refresh()) yerine, sadece ilgili satırı/sayacı yerinde güncelliyoruz.
                       _cpRosterPatchRowAfterMove(el, sel, userId, newSectionId, classSections, memberLabel);
                       // "Şubeler" paneli ayrı bir statik HTML bloğu olarak gömüldüğü için
                       // yukarıdaki satır-patch'i hiç görmüyordu — kart sayaçlarını da güncelle.
                       _cpRosterPatchSectionsPanelAfterMove(el, oldSectionId, newSectionId);
                       sel.dataset.currentSectionId = newSectionId || '__unassigned__';
                       sel.disabled = false;
                   });
               });

               // Toplu seçim/işlem: checkbox'lardan seçileni topla, üst çubukta sayaç göster,
               // "Sınıf değiştir" / "Çıkar" işlemlerini seçili tüm üyelere sırayla uygula.
               const rosterBulkBar = el.querySelector('#cp-roster-bulk-bar');
               const rosterBulkCount = el.querySelector('#cp-roster-bulk-count');
               const rosterSelectAll = el.querySelector('#cp-roster-select-all');
               const rosterRowChecks = () => [...el.querySelectorAll('.cp-roster-row-check')];
               const updateRosterBulkBar = () => {
                   const checked = rosterRowChecks().filter(cb => cb.checked);
                   if (rosterBulkBar) rosterBulkBar.classList.toggle('hidden', checked.length === 0);
                   if (rosterBulkCount) rosterBulkCount.textContent = `${checked.length} ${memberLabel.toLowerCase()} seçildi`;
                   if (rosterSelectAll) {
                       const all = rosterRowChecks();
                       rosterSelectAll.checked = all.length > 0 && checked.length === all.length;
                       rosterSelectAll.indeterminate = checked.length > 0 && checked.length < all.length;
                   }
               };
               rosterRowChecks().forEach(cb => cb.addEventListener('change', updateRosterBulkBar));
               rosterSelectAll?.addEventListener('change', () => {
                   rosterRowChecks().forEach(cb => { cb.checked = rosterSelectAll.checked; });
                   updateRosterBulkBar();
               });
               el.querySelector('#cp-roster-bulk-clear')?.addEventListener('click', () => {
                   rosterRowChecks().forEach(cb => { cb.checked = false; });
                   updateRosterBulkBar();
               });
               el.querySelector('#cp-roster-bulk-remove')?.addEventListener('click', async (ev) => {
                   const checked = rosterRowChecks().filter(cb => cb.checked);
                   if (!checked.length) return;
                   const btn = ev.currentTarget;
                   const names = checked.map(cb => cb.dataset.name);
                   const ok = await window.showFocusaiConfirm({
                       title: `${memberLabel === 'Çalışan' ? 'Ekipten' : 'Sınıftan'} Çıkar`,
                       desc: `<b>${checked.length}</b> ${memberLabel.toLowerCase()} (${window._escapeHtml(names.join(', '))}) sınıftan çıkarılacak. Emin misin?`,
                       type: 'danger', icon: 'fa-user-xmark', confirmText: 'Çıkar', cancelText: 'Vazgeç'
                   });
                   if (!ok) return;
                   btn.disabled = true;
                   // Seçili öğrenciler artık farklı sınıflardan olabilir — her birini kendi
                   // sınıfından (data-class-id) çıkarmak için gruplandırıp ayrı ayrı silinir.
                   const byClass = {};
                   checked.forEach(cb => {
                       const cid = cb.dataset.classId || data._supaId;
                       (byClass[cid] = byClass[cid] || []).push(cb.dataset.userId);
                   });
                   let hadError = false;
                   for (const [cid, userIds] of Object.entries(byClass)) {
                       const { error } = await window.FocusSupabase.from('group_members').delete().eq('group_id', cid).in('user_id', userIds);
                       if (error) { hadError = true; window.dcShowToast('Çıkarılamadı: ' + error.message, 'error'); }
                   }
                   btn.disabled = false;
                   if (hadError) return;
                   window.dcShowToast(`${checked.length} ${memberLabel.toLowerCase()} sınıftan çıkarıldı.`, 'success');
                   refresh();
               });
               el.querySelector('#cp-roster-bulk-move')?.addEventListener('change', async (ev) => {
                   const sel = ev.currentTarget;
                   const val = sel.value;
                   if (!val) return;
                   const checked = rosterRowChecks().filter(cb => cb.checked);
                   if (!checked.length) { sel.value = ''; return; }
                   const targetName = val === '__unassigned__' ? 'Sınıfsız' : (classSections.find(s => s.id === val)?.name || 'Şube');
                   const names = checked.map(cb => cb.dataset.name).filter(Boolean);
                   const ok = await window.showFocusaiConfirm({
                       title: 'Şube Değiştir',
                       desc: `<b>${checked.length}</b> ${memberLabel.toLowerCase()} (${window._escapeHtml(names.join(', '))}) için şube <b>${window._escapeHtml(targetName)}</b> olarak değiştirilsin mi?`,
                       type: 'default', icon: 'fa-chalkboard-user', confirmText: 'Değiştir', cancelText: 'Vazgeç'
                   });
                   if (!ok) { sel.value = ''; return; }
                   sel.disabled = true;
                   const userIds = checked.map(cb => cb.dataset.userId);
                   // .select() ŞART — RLS sessiz 0-satır durumunu yakala (bkz. tekli atama notu)
                   const { data: updRows, error } = await window.FocusSupabase.from('group_members')
                       .update({ class_section_id: val === '__unassigned__' ? null : val })
                       .eq('group_id', data._supaId).in('user_id', userIds).select('user_id');
                   if (error || !updRows || updRows.length === 0) {
                       window.dcShowToast('Şube güncellenemedi' + (error ? ': ' + error.message : ' — yetki (RLS) reddetti, 124/125 migration canlıda uygulanmamış olabilir.'), 'error');
                       sel.disabled = false; sel.value = ''; return;
                   }
                   userIds.forEach(uid => _cpPatchMemberSection(data, uid, val === '__unassigned__' ? null : val));
                   window.dcShowToast(`${checked.length} ${memberLabel.toLowerCase()} için şube güncellendi.`, 'success');
                   refresh();
               });

               // "Öğrenciler" / "Sınıflar" iç-sekme geçişi
               el.querySelectorAll('.cp-roster-innertab-btn').forEach(btn => {
                   btn.addEventListener('click', () => {
                       el.querySelectorAll('.cp-roster-innertab-btn').forEach(b => b.classList.remove('active'));
                       el.querySelectorAll('.cp-roster-innertab-panel').forEach(p => p.classList.add('hidden'));
                       btn.classList.add('active');
                       el.querySelector(`.cp-roster-innertab-panel[data-cprosterpanel="${btn.dataset.cprostersub}"]`)?.classList.remove('hidden');
                       el.dataset.activeRosterSubtab = btn.dataset.cprostersub;
                   });
               });

               // "Şubeler" alt-görünümü: yeni şube oluştur (bu grubun İÇİNDE, group_class_sections).
               const sectionAddBtn = el.querySelector('#cp-section-add-btn');
               const sectionAddInput = el.querySelector('#cp-section-add-name');
               const sectionAddStatus = el.querySelector('#cp-section-add-status');
               const createSection = async () => {
                   const name = (sectionAddInput?.value || '').trim();
                   if (!name) { if (sectionAddStatus) sectionAddStatus.textContent = 'Bir şube adı yaz.'; return; }
                   if (sectionAddBtn) sectionAddBtn.disabled = true;
                   if (sectionAddStatus) sectionAddStatus.textContent = 'Oluşturuluyor…';
                   const { error } = await window.FocusSupabase.from('group_class_sections')
                       .insert({ group_id: data._supaId, name, created_by: window.currentUser.id });
                   if (sectionAddBtn) sectionAddBtn.disabled = false;
                   if (error) {
                       if (sectionAddStatus) sectionAddStatus.textContent = error.code === '23505' ? `"${name}" adında bir şube zaten var.` : 'Oluşturulamadı: ' + error.message;
                       return;
                   }
                   window.dcShowToast(`"${name}" şubesi oluşturuldu.`, 'success');
                   refresh();
               };
               sectionAddBtn?.addEventListener('click', createSection);
               sectionAddInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') createSection(); });

               // Şube kartına tıklayınca detay modalı: şubedeki öğrenciler, ders programı,
               // adını değiştirme/silme tek yerden yapılır (bkz. _cpOpenSectionDetailModal).
               el.querySelectorAll('.cp-section-card-open').forEach(card => {
                   card.addEventListener('click', () => {
                       const sectionId = card.dataset.sectionId;
                       const sectionName = card.dataset.sectionName;
                       const students = rosterMembers.filter(m => m.classId === sectionId)
                           .map(m => ({ userId: m.userId, displayName: m.displayName }));
                       _cpOpenSectionDetailModal({
                           groupId: data._supaId, groupData: data, sectionId, sectionName, memberLabel, students,
                           scheduleInfo: scheduleCardByClass[sectionId] || null,
                           subjectOptions: scheduleSubjectOptions, buildClassChoices, onChanged: refresh,
                       });
                   });
                   card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); } });
               });
           }

           // Hedef seçici: "Tüm sınıf" kutusu işaretliyken bireysel öğrenci listesi gizli/pasif;
           // kaldırıldığında liste açılır ve seçilen kişiler target_user_ids'e yazılır.
           const targetAllBox = el.querySelector('#cp-asg-target-allbox');
           const targetStudentsBox = el.querySelector('#cp-asg-target-students');
           const targetSummaryEl = el.querySelector('#cp-asg-target-summary');
           // Tarayıcı, aynı sayfada yeniden render edilen checkbox'ların işaretli
           // durumunu bazen bir önceki render'dan "hatırlayıp" geri getiriyor
           // (form-restore davranışı) — her açılışta tümü kesin olarak boş/varsayılan
           // duruma sıfırlanır: "Tüm sınıf" işaretli, bireysel öğrenciler boş.
           if (targetAllBox) targetAllBox.checked = true;
           el.querySelectorAll('.cp-asg-target-student').forEach(cb => { cb.checked = false; });
           targetStudentsBox?.classList.add('hidden');
           const updateTargetSummary = () => {
               if (!targetSummaryEl) return;
               if (targetAllBox?.checked) { targetSummaryEl.textContent = 'Tüm sınıf'; return; }
               const n = el.querySelectorAll('.cp-asg-target-student:checked').length;
               targetSummaryEl.textContent = n ? `${n} kişi seçili` : 'Kimse seçilmedi';
           };
           targetAllBox?.addEventListener('change', () => {
               targetStudentsBox?.classList.toggle('hidden', targetAllBox.checked);
               if (targetAllBox.checked) el.querySelectorAll('.cp-asg-target-student').forEach(cb => { cb.checked = false; });
               updateTargetSummary();
           });
           el.querySelectorAll('.cp-asg-target-student').forEach(cb => cb.addEventListener('change', updateTargetSummary));

           // Sınıf seçici: başka bir sınıfa ödev vermek için o sınıfın öğrenci listesini
           // "Kime atanacak?" bölümüne yükler (bkz. cp-asg-add — ödev, seçilen sınıfın
           // group_id'sine yazılır).
           const classPick = el.querySelector('#cp-asg-class-pick');
           classPick?.addEventListener('change', () => {
               const cls = allInstitutionClasses.find(c => c.id === classPick.value);
               const members = (cls?.members || []).filter(m => m.userId && m.userId !== window.currentUser.id);
               if (targetStudentsBox) {
                   targetStudentsBox.innerHTML = members.map(s => `
                       <label class="cp-asg-target-row">
                           <input type="checkbox" class="cp-asg-target-student" value="${s.userId}">
                           <span>${window._escapeHtml(s.displayName)}</span>
                       </label>`).join('') || '<p class="cp-hint">Bu sınıfta henüz öğrenci yok.</p>';
                   targetStudentsBox.querySelectorAll('.cp-asg-target-student').forEach(cb => cb.addEventListener('change', updateTargetSummary));
               }
               if (targetAllBox) { targetAllBox.checked = true; }
               targetStudentsBox?.classList.add('hidden');
               updateTargetSummary();
           });

           // Şablon seçilince formu doldurur
           const templatePick = el.querySelector('#cp-asg-template-pick');
           const templateDelBtn = el.querySelector('#cp-asg-template-del');
           templatePick?.addEventListener('change', () => {
               const t = templates.find(t => t.id === templatePick.value);
               templateDelBtn.style.display = t ? '' : 'none';
               if (!t) return;
               el.querySelector('#cp-asg-title').value = t.title || '';
               el.querySelector('#cp-asg-desc').value = t.description || '';
               el.querySelector('#cp-asg-priority').value = t.priority || 'normal';
           });
           templateDelBtn?.addEventListener('click', async () => {
               const t = templates.find(t => t.id === templatePick.value);
               if (!t) return;
               const ok = await window.showFocusaiConfirm({
                   title: 'Şablonu Sil', desc: `<b>${window._escapeHtml(t.title)}</b> şablonunu silmek istediğine emin misin?`,
                   type: 'danger', icon: 'fa-trash-can', confirmText: 'Sil', cancelText: 'Vazgeç'
               });
               if (!ok) return;
               await window.FocusSupabase.from('assignment_templates').delete().eq('id', t.id);
               refresh();
           });

           // Karakter sayacı — başlık ve açıklama
           const titleInput = el.querySelector('#cp-asg-title');
           const titleCountEl = el.querySelector('#cp-asg-title-count');
           titleInput?.addEventListener('input', () => {
               if (titleCountEl) titleCountEl.textContent = `${titleInput.value.length}/${titleInput.maxLength}`;
           });
           const descInput = el.querySelector('#cp-asg-desc');
           const descCountEl = el.querySelector('#cp-asg-desc-count');
           descInput?.addEventListener('input', () => {
               if (descCountEl) descCountEl.textContent = `${descInput.value.length}/${descInput.maxLength}`;
           });

           // Dosya seçilince adını göster
           const fileInput = el.querySelector('#cp-asg-file');
           const fileNameEl = el.querySelector('#cp-asg-file-name');
           fileInput?.addEventListener('change', () => {
               const f = fileInput.files?.[0];
               if (f) fileNameEl.innerHTML = `<i class="fa-solid fa-file"></i> ${window._escapeHtml(f.name)}`;
           });

           // Notlandırma: her teslim satırı için puan + geri bildirim kaydı
           el.querySelectorAll('.cp-grade-row').forEach(row => {
               row.querySelector('.cp-grade-save')?.addEventListener('click', async (e) => {
                   const btn = e.currentTarget;
                   const asgId = row.dataset.asgId, userId = row.dataset.userId;
                   const gradeVal = row.querySelector('.cp-grade-input')?.value;
                   const feedbackVal = row.querySelector('.cp-grade-feedback')?.value.trim();
                   btn.disabled = true;
                   const { error } = await window.FocusSupabase.from('assignment_submissions')
                       .update({
                           grade: gradeVal === '' ? null : Math.max(0, Math.min(100, parseInt(gradeVal, 10))),
                           teacher_feedback: feedbackVal || null
                       })
                       .eq('assignment_id', asgId).eq('user_id', userId);
                   btn.disabled = false;
                   if (error) { window.dcShowToast('Kaydedilemedi: ' + error.message, 'error'); return; }
                   window.dcShowToast('Not kaydedildi.', 'success');
               });
           });

           // Teslim etmeyenlere hatırlatma bildirimi
           el.querySelectorAll('.cp-asg-remind').forEach(btn => btn.addEventListener('click', async (e) => {
               e.preventDefault();
               const asgId = btn.dataset.id;
               const a = assignments.find(x => x.id === asgId);
               if (!a) return;
               const subs = subsByAsg[asgId] || [];
               const targets = targetMembers(a).filter(m => !subs.includes(m.userId));
               if (!targets.length) return;
               btn.disabled = true;
               const rows = targets.map(m => ({
                   user_id: m.userId,
                   type: 'assignment_reminder',
                   payload: {
                       fromName: window.currentUser.displayName || window.currentUser.username,
                       groupCode: data.code, groupName: data.name,
                       assignmentTitle: a.title, dueDate: a.due_date
                   }
               }));
               const { error } = await window.FocusSupabase.from('notifications').insert(rows);
               if (error) { window.dcShowToast('Gönderilemedi: ' + error.message, 'error'); btn.disabled = false; return; }
               window.dcShowToast(`${targets.length} kişiye hatırlatma gönderildi.`, 'success');
               btn.textContent = 'Hatırlatma gönderildi ✓';
           }));

           // "Ekle" butonu — Bugün sekmesindeki görev ekleme çubuğuyla (td-toggle-add/td-add-form)
           // aynı davranış: form varsayılan gizli, butona basınca açılıp odak başlık alanına gider.
           const asgToggleAdd = el.querySelector('#cp-asg-toggle-add');
           const asgAddForm = el.querySelector('#cp-asg-add-form');
           if (asgToggleAdd && asgAddForm) {
               asgToggleAdd.addEventListener('click', () => {
                   const open = asgAddForm.style.display !== 'none' && asgAddForm.style.display !== '';
                   asgAddForm.style.display = open ? 'none' : 'block';
                   asgToggleAdd.classList.toggle('is-open', !open);
                   if (!open) el.querySelector('#cp-asg-title')?.focus();
               });
           }

           el.querySelector('#cp-asg-add')?.addEventListener('click', async (e) => {
               const addBtn = e.currentTarget;
               const title = el.querySelector('#cp-asg-title')?.value.trim();
               const due = el.querySelector('#cp-asg-due')?.value || null;
               const description = el.querySelector('#cp-asg-desc')?.value.trim() || '';
               const priority = el.querySelector('#cp-asg-priority')?.value || 'normal';
               const file = fileInput?.files?.[0];
               if (!title) { window.dcShowToast('Bir başlık yaz.'); return; }
               const useAll = targetAllBox?.checked !== false;
               const selectedIds = [...el.querySelectorAll('.cp-asg-target-student:checked')].map(cb => cb.value);
               if (!useAll && !selectedIds.length) { window.dcShowToast('En az bir kişi seç ya da "Tüm sınıf" kutusunu işaretle.'); return; }
               // Sınıf seçici varsa (kurumun birden fazla sınıfı varsa) ödev, seçilen sınıfa
               // yazılır — yoksa mevcut sınıfa (varsayılan davranış).
               const targetClassId = classPick?.value || data._supaId;
               const targetClass = allInstitutionClasses.find(c => c.id === targetClassId);
               addBtn.disabled = true;
               let attachment = null;
               if (file) {
                   if (file.size > 15 * 1024 * 1024) { window.dcShowToast('Dosya boyutu 15MB\'ı geçemez.'); addBtn.disabled = false; return; }
                   const ext = file.name.split('.').pop() || 'bin';
                   const path = `assignment/${targetClassId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
                   const { data: up, error: upErr } = await window.FocusSupabase.storage.from('chat-files').upload(path, file, { upsert: false });
                   if (upErr) { window.dcShowToast('Dosya yüklenemedi: ' + upErr.message, 'error'); addBtn.disabled = false; return; }
                   attachment = { name: file.name, size: file.size, type: file.type, bucket_path: up.path };
               }
               const { error } = await window.FocusSupabase.from('classroom_assignments').insert({
                   group_id: targetClassId, created_by: window.currentUser.id,
                   title, description, priority,
                   due_date: due ? new Date(due + 'T23:59:59').toISOString() : null,
                   target_user_ids: useAll ? null : selectedIds,
                   attachment
               });
               if (error) { window.dcShowToast('Ödev eklenemedi: ' + error.message, 'error'); addBtn.disabled = false; return; }
               // Hedeflenen öğrencilere yeni ödev bildirimi — sistem genelinde senkron olması için
               // (bugün/takvim rozetleri, "Ödevlerim" özeti) bunlar zaten Supabase realtime ile
               // classroom_assignments tablosunu dinliyor; bu sadece anlık toast/bildirim.
               const notifyIds = useAll
                   ? (targetClassId === data._supaId
                       ? studentMembers.filter(m => m.userId !== window.currentUser.id).map(m => m.userId)
                       : (targetClass?.members || []).filter(m => m.userId && m.userId !== window.currentUser.id).map(m => m.userId))
                   : selectedIds;
               if (notifyIds.length) {
                   await window.FocusSupabase.from('notifications').insert(notifyIds.map(userId => ({
                       user_id: userId,
                       type: 'assignment_new',
                       payload: {
                           fromName: window.currentUser.displayName || window.currentUser.username,
                           groupCode: targetClass?.code || data.code, groupName: targetClass?.name || data.name,
                           assignmentTitle: title, dueDate: due ? new Date(due + 'T23:59:59').toISOString() : null
                       }
                   })));
               }
               window.dcShowToast(useAll ? `${targetClass?.name || data.name} sınıfına eklendi 📋` : `${selectedIds.length} kişiye atandı 📋`, 'success');
               refresh();
           });
           el.querySelectorAll('[data-cp-act]').forEach(btn => btn.addEventListener('click', async () => {
               const id = btn.dataset.id, act = btn.dataset.cpAct;
               if (act === 'undo') {
                   await window.FocusSupabase.from('assignment_submissions').delete().eq('assignment_id', id).eq('user_id', window.currentUser.id);
               } else if (act === 'close') {
                   await window.FocusSupabase.from('classroom_assignments').update({ status: 'closed' }).eq('id', id);
               } else if (act === 'delete') {
                   const ok = await window.showFocusaiConfirm({
                       title: 'Ödevi Sil', desc: 'Bu ödev ve tüm teslimleri kalıcı olarak silinsin mi?',
                       type: 'danger', icon: 'fa-trash-can', confirmText: 'Sil', cancelText: 'Vazgeç'
                   });
                   if (!ok) return;
                   await window.FocusSupabase.from('classroom_assignments').delete().eq('id', id);
               }
               refresh();
           }));

           // Öğrenci teslim formu: not + opsiyonel dosya/fotoğraf eki
           el.querySelectorAll('.cp-asg-submit-file').forEach(input => input.addEventListener('change', () => {
               const f = input.files?.[0];
               const nameEl = input.closest('.cp-asg-file-label')?.querySelector('.cp-asg-submit-file-name');
               if (f && nameEl) nameEl.innerHTML = `<i class="fa-solid fa-file"></i> ${window._escapeHtml(f.name)}`;
           }));
           el.querySelectorAll('.cp-asg-submit-confirm').forEach(btn => btn.addEventListener('click', async () => {
               const id = btn.dataset.id;
               const form = btn.closest('.cp-asg-submit-body');
               const note = (form.querySelector('.cp-asg-submit-note')?.value || '').trim().slice(0, 200);
               const file = form.querySelector('.cp-asg-submit-file')?.files?.[0];
               btn.disabled = true;
               let attachment = null;
               if (file) {
                   if (file.size > 15 * 1024 * 1024) { window.dcShowToast('Dosya boyutu 15MB\'ı geçemez.'); btn.disabled = false; return; }
                   const ext = file.name.split('.').pop() || 'bin';
                   const path = `assignment-submission/${id}/${window.currentUser.id}_${Date.now()}.${ext}`;
                   const { data: up, error: upErr } = await window.FocusSupabase.storage.from('chat-files').upload(path, file, { upsert: true });
                   if (upErr) { window.dcShowToast('Dosya yüklenemedi: ' + upErr.message, 'error'); btn.disabled = false; return; }
                   attachment = { name: file.name, size: file.size, type: file.type, bucket_path: up.path };
               }
               const { error } = await window.FocusSupabase.from('assignment_submissions')
                   .upsert({ assignment_id: id, user_id: window.currentUser.id, note: note || null, attachment });
               if (error) { window.dcShowToast('Teslim edilemedi: ' + error.message, 'error'); btn.disabled = false; return; }
               if (typeof window.fireConfetti === 'function') window.fireConfetti();
               window.dcShowToast('Harika iş! Ödev teslim edildi 🎉', 'success');
               refresh();
           }));

           // Çok adımlı ödev / ders planı — öğrenci bir adımı işaretler
           el.querySelectorAll('.cp-asg-step-check').forEach(cb => cb.addEventListener('change', async () => {
               const asgId = cb.dataset.asgId, stepId = cb.dataset.stepId, doneNow = cb.checked;
               cb.disabled = true;
               const { error } = await window.FocusSupabase.from('assignment_step_progress')
                   .upsert({ assignment_id: asgId, user_id: window.currentUser.id, step_id: stepId, done: doneNow, done_at: doneNow ? new Date().toISOString() : null },
                       { onConflict: 'assignment_id,user_id,step_id' });
               if (error) { window.dcShowToast('Kaydedilemedi: ' + error.message, 'error'); cb.checked = !doneNow; cb.disabled = false; return; }
               const allChecked = [...el.querySelectorAll(`.cp-asg-step-check[data-asg-id="${asgId}"]`)].every(c => c.checked);
               if (allChecked && typeof window.fireConfetti === 'function') window.fireConfetti();
               refresh();
           }));
       }
       // Sınıf Paneli sekmesine kısa süre içinde tekrar girişte (ör. Genel Bakış'a gidip geri
       // dönme) tüm fetch zincirini (5 paralel sorgu + submissions + step_progress + kardeş
       // sınıf özetleri + imzalı URL'ler) baştan çalıştırmamak için ince bir TTL cache. Gerçek
       // bir mutasyon sonrası (ödev oluşturma/silme/teslim vb.) her zaman `force=true` ile
       // çağrılır, böylece kullanıcı asla bayat veri görmez — sadece "aynı yere geri dönme"
       // senaryosunda gereksiz tekrar sorgu engellenir.
       const _classroomTabCache = window._classroomTabCache || (window._classroomTabCache = new Map());
       const CLASSROOM_TAB_CACHE_TTL = 45000;
       window.renderClassroomTabCached = (data, isClassAdmin, force) => renderClassroomTabCached(data, isClassAdmin, force); // Faz 5: social-group-details.js için
       function renderClassroomTabCached(data, isClassAdmin, force) {
           const gid = data && data._supaId;
           if (!gid) return renderClassroomTab(data, isClassAdmin);
           const lastTs = _classroomTabCache.get(gid);
           if (!force && lastTs && (Date.now() - lastTs) < CLASSROOM_TAB_CACHE_TTL) return;
           _classroomTabCache.set(gid, Date.now());
           return renderClassroomTab(data, isClassAdmin);
       }

       // Kurumsal (sınıf/işyeri) gruplarda "Genel Bakış" hem TANITIM/vitrin bilgisini (kim kurdu,
       // kaç kişi, katılım kodu, hedefi ne) hem de analitik özeti (KPI şeridi, dikkat gerekenler,
       // yoğunluk, kendi durumun) tek ekranda gösterir — Sınıf/Ekip Paneli'ne ayrıca gitmeye gerek
       // kalmadan öğretmen/öğrenci grubu açar açmaz durumu görür. Sınıf Paneli doğrudan işlemsel
       // sekmelerle (Performans/Ödevler) açılır. Analitik bölüm aşağıdaki renderClassroomInsightsPanel
       // tarafından ayrıca doldurulur — KPI şeridi,
       // dikkat gerekenler (risk), yoğunluk uyarısı (yönetici) ve kendi durumun/gizlilik
       // (üye) artık doğrudan Genel Bakış'ta, ayrı bir sekmeye gitmeye gerek kalmadan gösterilir.
       // Genel Bakış'taki kısayol widget'ı VE özet kartları (öğretmenin "Bu hafta ne
       // yapmalıyım" kartı, öğrencinin "Sıradaki ödev" hatırlatıcısı) aynı Sınıf/Ekip
       // Paneli alt sekmesine yönlendirme mantığını paylaşır — tek yerden bakımlı kalsın.
       function _gotoClassroomSubtab(subtab, opts = {}) {
           window._pendingClassroomSubtab = subtab;
           document.querySelector('.group-detail-tab-btn[data-gtab="classroom"]')?.click();
           const trySelectSubtab = (attempt) => {
               const subBtn = document.querySelector(`.cp-subtab-btn[data-cpsub="${subtab}"]`);
               if (subBtn) {
                   subBtn.click();
                   if (opts.openAdd) setTimeout(() => document.querySelector('#cp-asg-toggle-add')?.click(), 150);
                   return;
               }
               if (attempt < 8) setTimeout(() => trySelectSubtab(attempt + 1), 250);
           };
           setTimeout(() => trySelectSubtab(0), 250);
       }

       window.renderClassroomInsightsPanel = (introEl, data, isClassAdmin, studentCount) => renderClassroomInsightsPanel(introEl, data, isClassAdmin, studentCount); // Faz 5: social-group-details.js için
       async function renderClassroomInsightsPanel(introEl, data, isClassAdmin, studentCount) {
           const box = introEl.querySelector('#grp-intro-insights');
           if (!box || !window.FocusSupabase || !window.currentUser?.id || !data._supaId) return;
           const isWork = data.classroomType === 'workplace';
           const memberLabel = isWork ? 'Çalışan' : 'Öğrenci';
           const asgLabel = isWork ? 'Görevlendirmeler' : 'Ders Planı';
           // Tek doğruluk kaynağı: öğrenci sayısı çağıran renderInstitutionalOverviewIntro'dan
           // geliyor (data.members bazlı) — burada ayrıca statsRes/data.members üzerinden farklı
           // bir sayım yapılırsa (ör. hesap silinmiş üyeler dahil/hariç tutulursa) ekranın iki
           // farklı yerinde çelişen üye sayıları görünür (2026-07-12'de yaşandı).
           const memberCount = studentCount;

           if (isClassAdmin) {
               // "Dikkat Gerekenler" kartı kaldırıldı (2026-07-11, kullanıcı kararı) — Performans
               // sekmesindeki buildPerfRows ile PARALEL, farklı eşikler kullanan (sabit %34, z-skor
               // yok, regresyon yok, küçük-n koruması yok) bağımsız bir risk hesaplaması yapıyordu.
               // Aynı öğrenci için iki ekranda iki farklı "risk" kararı çıkabiliyordu — bu, tek bir
               // doğruluk kaynağı olmayan bir ölçüm sisteminde kabul edilemez bir tutarsızlıktı.
               // Öğretmen artık tek yerden (Sınıf Paneli > Performans) bakıyor; "Yoğun Programlı"
               // (group_student_weekly_load tabanlı) sinyali de sadece o yeniden birleştirilene
               // kadar burada YOK — bkz. focusai_arena_plan.md için sıradaki iş.
               const asgRes = await window.FocusSupabase.from('classroom_assignments')
                   .select('id, title, due_date, status, target_user_ids, steps').eq('group_id', data._supaId)
                   .order('created_at', { ascending: false }).limit(30);
               const assignments = asgRes.data || [];
               const subsByAsg = {};
               if (assignments.length) {
                   const { data: subs } = await window.FocusSupabase
                       .from('assignment_submissions').select('assignment_id, user_id').in('assignment_id', assignments.map(a => a.id));
                   (subs || []).forEach(s => { (subsByAsg[s.assignment_id] = subsByAsg[s.assignment_id] || []).push(s.user_id); });
               }

               // Sadece SONUÇLANMIŞ (kapalı/süresi geçmiş) ödevler paydaya girer — Performans
               // sekmesindeki buildPerfCounts ile aynı kural (bkz. social.js ~11932): henüz vadesi
               // gelmemiş bir ödev "kaçırılmış" gibi sayılıp KPI'ı haksız yere düşürmesin.
               const now = new Date();
               const resolvedAssignments = assignments.filter(a => a.status === 'closed' || (a.due_date && new Date(a.due_date) < now));
               const totalSubs = resolvedAssignments.reduce((s, a) => s + ((a.target_user_ids && a.target_user_ids.length) ? a.target_user_ids.length : memberCount), 0);
               const doneSubs = resolvedAssignments.reduce((s, a) => s + (subsByAsg[a.id]?.length || 0), 0);
               const asgRate = totalSubs > 0 ? Math.round((doneSubs / totalSubs) * 100) : null;

               // Bekleyen (henüz kapanmamış/vadesi geçmemiş) ödevler — "Bu hafta ne
               // yapmalıyım" kartında en yakın vadeliyi öne çıkarmak için sıralanır.
               const pendingAssignments = assignments
                   .filter(a => a.status !== 'closed' && !(a.due_date && new Date(a.due_date) < now))
                   .sort((a, b) => {
                       if (!a.due_date) return 1;
                       if (!b.due_date) return -1;
                       return new Date(a.due_date) - new Date(b.due_date);
                   });
               // Aktif (bekleyen) ödevler iki türe ayrılır — adımsız/basit olanlar "ödev",
               // adımlı (steps) olanlar planning.js'ten atanan çok aşamalı "ders planı"
               // (bkz. social.js ~12830 notu: aynı sekme ikisini birden barındırır).
               const activeAsgCount = pendingAssignments.filter(a => !a.steps || !a.steps.length).length;
               const activeLessonPlanCount = pendingAssignments.filter(a => a.steps && a.steps.length).length;

               // Nötr, tanımlayıcı rakamlar — yargı içermez (bkz. yukarıdaki "Dikkat
               // Gerekenler kaldırıldı" notu), sadece durumu özetler.
               const kpiHtml = memberCount > 0 ? `
               <div class="cp-kpi-strip">
                   <div class="cp-kpi" style="--i:0"><span class="cp-kpi-num">${activeAsgCount}</span><span class="cp-kpi-label">Aktif Ödev</span></div>
                   <div class="cp-kpi" style="--i:1"><span class="cp-kpi-num">${activeLessonPlanCount}</span><span class="cp-kpi-label">Aktif Ders Planı</span></div>
                   <div class="cp-kpi" style="--i:2" title="Süresi geçmiş/kapanmış ödev ve ders planlarında ${memberLabel.toLowerCase()}lerin teslim oranı"><span class="cp-kpi-num">${asgRate !== null ? `%${asgRate}` : '–'}</span><span class="cp-kpi-label">Ödev Teslim Oranı</span></div>
               </div>` : '';

               // "Bu hafta ne yapmalıyım" — öğretmenin Genel Bakış'tan Sınıf Paneli'ne hiç
               // girmeden en yakın aksiyonu görmesi için (2026-07-12 geliştirme).
               let weekTodoHtml = '';
               if (memberCount > 0) {
                   const next = pendingAssignments.find(a => a.due_date) || pendingAssignments[0];
                   if (next) {
                       const target = (next.target_user_ids && next.target_user_ids.length) ? next.target_user_ids.length : memberCount;
                       const submitted = subsByAsg[next.id]?.length || 0;
                       const remaining = Math.max(0, target - submitted);
                       const dueLabel = next.due_date
                           ? new Date(next.due_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })
                           : 'Tarih belirtilmemiş';
                       weekTodoHtml = `
                       <div class="cp-weektodo-card" id="cp-weektodo-goto">
                           <i class="fa-solid fa-list-check" style="color:#74b9ff; font-size:18px;"></i>
                           <div class="cp-weektodo-body">
                               <p class="cp-weektodo-title">Bu hafta ne yapmalıyım?</p>
                               <p class="cp-hint" style="margin:0;">En yakın <b>${window._escapeHtml(next.title || asgLabel)}</b> ödevi <b>${dueLabel}</b> tarihinde doluyor — ${remaining > 0 ? `<b>${remaining}/${target}</b> ${memberLabel.toLowerCase()} henüz teslim etmedi.` : `${memberLabel.toLowerCase()}lerin hepsi teslim etti.`}</p>
                           </div>
                           <i class="fa-solid fa-chevron-right" style="color:var(--text-muted); font-size:12px;"></i>
                       </div>`;
                   } else {
                       weekTodoHtml = `
                       <div class="cp-weektodo-card cp-weektodo-card--clear">
                           <i class="fa-solid fa-circle-check" style="color:#2ed573; font-size:18px;"></i>
                           <div class="cp-weektodo-body">
                               <p class="cp-weektodo-title">Bu hafta ne yapmalıyım?</p>
                               <p class="cp-hint" style="margin:0;">Bekleyen ${asgLabel.toLowerCase()} yok — yeni bir tane eklemek ister misin?</p>
                           </div>
                       </div>`;
                   }
               }

               const onboardingHtml = memberCount === 0 ? `
               <div class="cp-onboarding-card">
                   <i class="fa-solid fa-rocket" style="color:#74b9ff; font-size:20px;"></i>
                   <div>
                       <p style="margin:0 0 4px; font-weight:700; color:#fff; font-size:13px;">${isWork ? 'Ekibin' : 'Sınıfın'} henüz boş</p>
                       <p class="cp-hint" style="margin:0;">Üstteki <b>"Davet Et"</b> butonuyla ${memberLabel.toLowerCase()}lerini davet et, ardından Sınıf Paneli'nden ilk ödevini ekle.</p>
                   </div>
               </div>` : '';

               box.innerHTML = `${onboardingHtml}${weekTodoHtml}${kpiHtml}`;

               box.querySelector('#cp-weektodo-goto')?.addEventListener('click', () => _gotoClassroomSubtab('odevler'));
           } else {
               // Odak-süresi istatistikleri (Bu Hafta Odağın/Sınıf Ortalaması/8 haftalık grafik)
               // BİLEREK burada tutulmuyor — İstatistikler bölümünde zaten görülüyor (2026-07-12,
               // kullanıcı geri bildirimi: burada tekrarı gereksizdi). Performansım artık sadece
               // burada başka hiçbir yerde olmayan veriye, yani ödev/ders planı tamamlama
               // durumuna odaklanıyor.
               const [myPrivacyRes, myAsgRes, myLpaRes] = await Promise.all([
                   window.FocusSupabase.from('profiles').select('stats_hidden_from_institution').eq('id', window.currentUser.id).maybeSingle(),
                   window.FocusSupabase.from('classroom_assignments').select('id, title, target_user_ids, steps, due_date, created_at, status')
                       .eq('group_id', data._supaId).order('created_at', { ascending: false }).limit(50),
                   // Gerçek "Ders Planı" ilerlemesi classroom_assignments.steps'te DEĞİL,
                   // lesson_plan_assignments.progress_pct'te tutulur (bkz. planning.js _syncDirty:
                   // milestone tamamlama oranı buraya yazılıyor) — classroom_assignments.steps
                   // hiçbir zaman doldurulmuyor (2026-07-12'de tespit edildi, kart hep boş kalıyordu).
                   window.FocusSupabase.from('lesson_plan_assignments').select('id, status, progress_pct, deadline')
                       .eq('group_id', data._supaId).eq('student_id', window.currentUser.id)
               ]);
               const myStatsHidden = !!myPrivacyRes.data?.stats_hidden_from_institution;
               const myLessonPlans = myLpaRes.data || [];
               const activeLessonPlans = myLessonPlans.filter(p => p.status === 'accepted');
               const lessonPlanPct = activeLessonPlans.length
                   ? Math.round(activeLessonPlans.reduce((s, p) => s + (p.progress_pct || 0), 0) / activeLessonPlans.length)
                   : null;

               // ── Kendi Aynan (öğrenci) — "yakalanma" değil "kendini görme" aracı: sıralama/kırmızı
               // uyarı yok, sadece kendi geçmişine göre ilerleme + tamamlama serisi. Sadece SÜRESİ
               // GEÇMİŞ/kapatılmış ödevler "sonuçlanmış" sayılır — henüz vadesi gelmemiş bir ödev
               // "kaçırıldı" olarak seriye dahil edilip seriyi haksız yere kesmesin.
               const myAssignments = (myAsgRes.data || []).filter(a =>
                   !a.target_user_ids || !a.target_user_ids.length || a.target_user_ids.includes(window.currentUser.id));
               const resolvedAssignments = myAssignments
                   .filter(a => a.status === 'closed' || (a.due_date && new Date(a.due_date) < new Date()))
                   .sort((a, b) => new Date(b.due_date || b.created_at) - new Date(a.due_date || a.created_at));
               // Henüz kapanmamış/vadesi geçmemiş ödevler — "Sıradaki ödev" hatırlatıcısı
               // (2026-07-12 geliştirme) buradan en yakın vadeliyi seçer.
               const pendingMineAll = myAssignments
                   .filter(a => a.status !== 'closed' && !(a.due_date && new Date(a.due_date) < new Date()))
                   .sort((a, b) => {
                       if (!a.due_date) return 1;
                       if (!b.due_date) return -1;
                       return new Date(a.due_date) - new Date(b.due_date);
                   });
               // classroom_assignments.steps hiç kullanılmıyor/doldurulmuyor (bkz. yukarıdaki
               // lesson_plan_assignments notu) — bu tablodaki her satır düz "Ödev", gerçek çok
               // adımlı "Ders Planı" kavramı ayrı sorgudan (myLessonPlans) geliyor.
               const stepLabel = isWork ? 'Çok Adımlı Görevlendirme' : 'Ders Planı';
               const simpleLabel = isWork ? 'Tekil Görevlendirme' : 'Ödev';

               let myStreakHtml = '';
               let nextMineHtml = '';
               let myDoneCount = 0;
               let myTotalPct = 0;
               if (myAssignments.length) {
                   // isDone hem seri kartı hem "Sıradaki ödev" kartı için tek seferde hesaplanır.
                   const { data: subs } = await window.FocusSupabase.from('assignment_submissions').select('assignment_id')
                       .eq('user_id', window.currentUser.id).in('assignment_id', myAssignments.map(a => a.id));
                   const mySubmittedIds = new Set((subs || []).map(s => s.assignment_id));
                   const isDone = (a) => mySubmittedIds.has(a.id);

                   const nextMine = pendingMineAll.find(a => !isDone(a));
                   if (nextMine) {
                       const dueLabel = nextMine.due_date
                           ? new Date(nextMine.due_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })
                           : 'Tarih belirtilmemiş';
                       nextMineHtml = `
                       <div class="cp-weektodo-card" id="cp-next-asg-goto">
                           <i class="fa-solid fa-list-check" style="color:#74b9ff; font-size:18px;"></i>
                           <div class="cp-weektodo-body">
                               <p class="cp-weektodo-title">Sıradaki ödev</p>
                               <p class="cp-hint" style="margin:0;"><b>${window._escapeHtml(nextMine.title || asgLabel)}</b> — ${dueLabel}</p>
                           </div>
                           <i class="fa-solid fa-chevron-right" style="color:var(--text-muted); font-size:12px;"></i>
                       </div>`;
                   }

                   if (resolvedAssignments.length) {
                       let streak = 0;
                       for (const a of resolvedAssignments) { if (isDone(a)) streak++; else break; }
                       myDoneCount = resolvedAssignments.filter(isDone).length;
                       myTotalPct = Math.round((myDoneCount / resolvedAssignments.length) * 100);

                       // Kilometre taşına yeni ulaşıldıysa bir kez kutla — aynı seri tekrar tekrar
                       // görüntülenince her seferinde confetti patlamasın diye localStorage'da işaretlenir.
                       const milestones = [3, 5, 10, 15, 20, 30, 50];
                       const seenKey = `focusai_streak_seen_${data._supaId}`;
                       const lastSeen = parseInt(localStorage.getItem(seenKey) || '0', 10);
                       const hitMilestone = streak > lastSeen && milestones.includes(streak);
                       localStorage.setItem(seenKey, String(streak));

                       myStreakHtml = `
                       <div class="cp-streak-card${streak >= 3 ? ' cp-streak-card--hot' : ''}">
                           <div class="cp-streak-num">${streak > 0 ? `🔥 ${streak}` : myDoneCount > 0 ? '👍' : '📋'}</div>
                           <div class="cp-streak-body">
                               <p class="cp-streak-title">${streak > 0
                                   ? `Üst üste ${streak} ${(asgLabel || 'ödev').toLowerCase()} tamamladın!`
                                   : myDoneCount > 0 ? 'Tekrar başlamak için harika bir zaman' : 'Henüz sonuçlanmış bir ödevin yok'}</p>
                               <p class="cp-hint" style="margin:0;">Şimdiye kadar tamamladığın: <b>${myDoneCount}/${resolvedAssignments.length}</b> (%${myTotalPct}) — bu sadece kendi geçmişinle kıyaslanır, kimseyle yarıştırılmaz.</p>
                           </div>
                       </div>`;
                       if (hitMilestone && typeof window.fireConfetti === 'function') {
                           setTimeout(() => window.fireConfetti(), 300);
                           window.dcShowToast?.(`🔥 ${streak} ${(asgLabel || 'ödev').toLowerCase()} üst üste tamamladın!`, 'success');
                       }

                       // Sınıf ortalamasıyla kıyas kasıtlı olarak KALDIRILDI (2026-07-12, kullanıcı
                       // geri bildirimi): öğrenci sadece kendi geçmişiyle yarışsın, sosyal kıyas
                       // kaygı/utanç tetikleyebiliyor ve streak kartındaki "kimseyle yarıştırılmaz"
                       // ilkesiyle çelişiyordu. Sınıf ortalaması artık hiç hesaplanmıyor/gösterilmiyor.
                   }
               }

               // Aktif durum özeti — henüz kapanmamış ders planı/ödev sayıları (2026-07-12
               // geliştirme). Ders planı sayısı/ilerlemesi lesson_plan_assignments'tan (yukarıda
               // sorgulandı), aktif ödev sayısı classroom_assignments'tan geliyor. Aktif hiçbir
               // şey yokken de kartlar 0 değeriyle gösterilir (kullanıcı isteği 2026-07-12: bölüm
               // tamamen gizlenince "Aktif Ders Planı/Aktif Ödev" bilgisi hiç görünmüyordu).
               const myActiveStatusHtml = `
               <div class="cp-section-title" style="margin:14px 0 8px;"><i class="fa-solid fa-bolt" style="color:#feca57;"></i> Aktif Durumun</div>
               <div class="cp-kpi-strip">
                   <div class="cp-kpi" style="--i:0">
                       <span class="cp-kpi-num">${activeLessonPlans.length}</span>
                       <span class="cp-kpi-label">Aktif ${stepLabel}</span>
                   </div>
                   <div class="cp-kpi" style="--i:1">
                       <span class="cp-kpi-num">${pendingMineAll.length}</span>
                       <span class="cp-kpi-label">Aktif ${simpleLabel}</span>
                   </div>
               </div>`;

               // Tamamlama-odaklı özet — odak süresi yerine sadece burada var olan veriye
               // (ödev/ders planı teslim durumu) odaklanır (2026-07-12, kullanıcı geri bildirimi).
               // Öğretmen tarafındaki LOW_SAMPLE_MAX (satır ~12224) o dalda tanımlı olduğundan
               // (isClassAdmin branch) öğrenci akışından erişilemiyor — burada aynı eşiği (5)
               // yerel bir sabitle tekrarlıyoruz: az veri varken % oranı tek bir ödevle bile büyük
               // ölçüde savrulabilir, bu yüzden "az veri" rozetiyle güvenilmezliği açıkça belirtiyoruz
               // (2026-07-12, kullanıcı geri bildirimi).
               const STUDENT_LOW_SAMPLE_MAX = 5;
               const myLowSample = resolvedAssignments.length > 0 && resolvedAssignments.length < STUDENT_LOW_SAMPLE_MAX;
               const lowSampleExplain = `Sadece ${resolvedAssignments.length} ${asgLabel.toLowerCase()} üzerinden hesaplandı — bu kadar az veride % oranı tek bir sonuçla bile büyük ölçüde değişebilir.`;
               const myCompletionHtml = (resolvedAssignments.length || lessonPlanPct !== null) ? `
               <div class="cp-kpi-strip">
                   ${lessonPlanPct !== null ? `
                   <div class="cp-kpi" style="--i:0">
                       <span class="cp-kpi-num">%${lessonPlanPct}</span>
                       <span class="cp-kpi-label">${stepLabel} İlerlemesi${activeLessonPlans.length > 1 ? ` (${activeLessonPlans.length} plan ortalaması)` : ''}</span>
                   </div>` : ''}
                   ${resolvedAssignments.length ? `
                   <div class="cp-kpi${myLowSample ? ' cp-kpi--lowsample' : ''}" style="--i:1">
                       <span class="cp-kpi-num">%${myTotalPct}${myLowSample ? `<span class="cp-lowsample-badge" id="cp-lowsample-badge" title="${window._escapeHtml(lowSampleExplain)}">az veri</span>` : ''}</span>
                       <span class="cp-kpi-label">Ödev Tamamlama Oranın</span>
                   </div>` : ''}
               </div>` : '';

               // Toggle'ın ne yaptığı önceden belirsizdi ("istatistiklerimi gizle" yazıyordu ama
               // tam olarak neyin gizlenip neyin gizlenmediği söylenmiyordu). Gerçek davranış
               // (group_weekly_member_stats 077 + group_member_daily_stats 096): SADECE odak
               // süresi/aktif gün verisi gizleniyor — ödev tamamlama durumu bu ayardan bağımsız,
               // öğretmen HER ZAMAN görüyor (aksi halde ödev takibi işlevsiz kalırdı). Bunu açıkça
               // yazıp, kapalıyken de anında ne olduğunu gösteren bir durum satırı ekliyoruz.
               const privacyHtml = `
               <div class="cp-privacy-box">
                   <label class="cp-privacy-toggle-row">
                       <input type="checkbox" id="cp-stats-privacy-toggle" ${myStatsHidden ? 'checked' : ''}>
                       <span>Odak süremi ve aktif günlerimi ${memberLabel.toLowerCase()} performans tablosunda öğretmenimden/yöneticimden gizle</span>
                   </label>
                   <p class="cp-privacy-detail" id="cp-stats-privacy-detail">
                       ${myStatsHidden
                           ? `<i class="fa-solid fa-eye-slash"></i> Şu an <b>gizli</b>: haftalık odak süren ve aktif gün sayın öğretmenine gösterilmiyor.`
                           : `<i class="fa-solid fa-eye"></i> Şu an <b>görünür</b>: haftalık odak süren ve aktif gün sayın öğretmenine gösteriliyor.`}
                       Ödev/görev tamamlama durumun bu ayardan <b>etkilenmez</b>, öğretmenin her zaman görebilir.
                   </p>
               </div>`;

               box.innerHTML = `${nextMineHtml}${myStreakHtml}${myActiveStatusHtml}${myCompletionHtml}${privacyHtml}`;

               box.querySelector('#cp-next-asg-goto')?.addEventListener('click', () => _gotoClassroomSubtab('odevler'));

               // "az veri" rozeti: masaüstünde title ile hover'da görünüyor ama mobilde title
               // tetiklenmiyor — dokununca da aynı açıklamayı toast olarak gösteriyoruz.
               box.querySelector('#cp-lowsample-badge')?.addEventListener('click', (e) => {
                   window.dcShowToast(e.currentTarget.title, 'info');
               });

               box.querySelector('#cp-stats-privacy-toggle')?.addEventListener('change', async (e) => {
                   const checked = e.target.checked;
                   e.target.disabled = true;
                   const { error } = await window.FocusSupabase
                       .from('profiles').update({ stats_hidden_from_institution: checked }).eq('id', window.currentUser.id);
                   e.target.disabled = false;
                   if (error) {
                       e.target.checked = !checked;
                       window.dcShowToast('Kaydedilemedi: ' + error.message, 'error');
                       return;
                   }
                   window.dcShowToast(checked ? 'Odak süren artık gizli.' : 'Odak süren tekrar görünür.', 'success');
                   const detailEl = box.querySelector('#cp-stats-privacy-detail');
                   if (detailEl) {
                       detailEl.innerHTML = `${checked
                           ? `<i class="fa-solid fa-eye-slash"></i> Şu an <b>gizli</b>: haftalık odak süren ve aktif gün sayın öğretmenine gösterilmiyor.`
                           : `<i class="fa-solid fa-eye"></i> Şu an <b>görünür</b>: haftalık odak süren ve aktif gün sayın öğretmenine gösteriliyor.`}
                       Ödev/görev tamamlama durumun bu ayardan <b>etkilenmez</b>, öğretmenin her zaman görebilir.`;
                   }
               });
           }
       }

       window.renderInstitutionalOverviewIntro = (data, isClassAdmin) => renderInstitutionalOverviewIntro(data, isClassAdmin); // Faz 5: social-group-details.js için
       async function renderInstitutionalOverviewIntro(data, isClassAdmin) {
           const introEl = document.getElementById('inst-group-intro');
           if (!introEl) return;
           const isWork = data.classroomType === 'workplace';
           const memberLabel = isWork ? 'Çalışan' : 'Öğrenci';
           const typeIcon = isWork ? 'fa-briefcase' : 'fa-graduation-cap';
           const members = Object.values(data.members || {});
           // Tek doğruluk kaynağı: "öğrenci sayısı" öğretmen/yönetici rolündeki üyeyi saymaz —
           // renderClassroomInsightsPanel'e de aynı sayı geçiriliyor, ekranda iki farklı üye
           // sayısı çelişkisi yaşanmasın diye (bkz. renderClassroomInsightsPanel notu).
           const studentMembers = members.filter(m => m.userId && m.role !== 'admin' && m.role !== 'owner');
           const studentCount = studentMembers.length;
           // Öğretmenin "kaç öğrenci var, kaç sınıf var" sorusuna Sınıf Paneli'ne hiç
           // girmeden Genel Bakış'tan cevap alabilmesi için (2026-07-12 geliştirme).
           let sectionCount = null;
           if (isClassAdmin && data._supaId && window.FocusSupabase) {
               const { count } = await window.FocusSupabase
                   .from('group_class_sections').select('id', { count: 'exact', head: true }).eq('group_id', data._supaId);
               sectionCount = count || 0;
           }

           // Sadeleştirilmiş Genel Bakış (2026-07-12, kullanıcı geri bildirimi: eski hâli "çok
           // karmakarışık/iç içe" duruyordu). Üye/şube sayıları artık avatar yığını, arka planları
           // çatışan iç içe kutular vb. olmadan, tek bakışta okunan iki sade istatistik kartı.
           const statTilesHtml = `
               <div class="grp-stat-tiles">
                   <div class="grp-stat-tile">
                       <div class="grp-stat-tile-icon grp-stat-tile-icon--purple"><i class="fa-solid fa-users"></i></div>
                       <div><div class="grp-stat-tile-num">${studentCount}</div><div class="grp-stat-tile-label">${memberLabel}</div></div>
                   </div>
                   ${sectionCount !== null ? `
                   <div class="grp-stat-tile">
                       <div class="grp-stat-tile-icon grp-stat-tile-icon--teal"><i class="fa-solid fa-chalkboard"></i></div>
                       <div><div class="grp-stat-tile-num">${sectionCount}</div><div class="grp-stat-tile-label">${isWork ? 'Departman' : 'Şube'}</div></div>
                   </div>` : ''}
               </div>`;

           introEl.innerHTML = `
               <div class="grp-intro-card">
                   ${statTilesHtml}
                   ${isClassAdmin ? `<div id="grp-intro-insights" class="cp-skeleton" style="margin-bottom:14px;"><div class="cp-skel-strip"><div class="cp-skel-box"></div><div class="cp-skel-box"></div></div></div>` : ''}
                   ${isClassAdmin ? `<div id="grp-intro-shortcuts-wrap"></div>` : `
                   <button type="button" class="control-btn primary grp-intro-cta-btn" id="grp-intro-goto-classroom">
                       <i class="fa-solid ${typeIcon}"></i> ${isWork ? 'Ekip Paneline Git' : 'Sınıf Paneline Git'} <i class="fa-solid fa-arrow-right"></i>
                   </button>`}
               </div>`;

           introEl.querySelector('#grp-intro-goto-classroom')?.addEventListener('click', () => {
               document.querySelector('.group-detail-tab-btn[data-gtab="classroom"]')?.click();
           });
           introEl.querySelector('#grp-intro-code-copy')?.addEventListener('click', () => {
               if (data.code) navigator.clipboard?.writeText(data.code);
               window.dcShowToast?.('Katılım kodu kopyalandı', 'success');
           });

           if (isClassAdmin) _renderClassroomShortcutsWidget(introEl, data, memberLabel);

           // Öğrenci için "Kendi Aynan" (streak/KPI/geçmiş) artık burada değil, Sınıf Paneli >
           // "Performansım" alt sekmesinde gösteriliyor (bkz. renderClassroomTab) — Genel Bakış'ta
           // sadece öğretmenin özet KPI şeridi kalıyor (bkz. renderClassroomInsightsPanel içindeki
           // "Dikkat Gerekenler kaldırıldı" notu).
           if (isClassAdmin) renderClassroomInsightsPanel(introEl, data, isClassAdmin, studentCount);
       }

       // Öğretmenin Genel Bakış'ta gördüğü kısayol widget'ı — Apple'ın "widget ekle" galerisine
       // benzer: "Düzenle" butonu bir galeri açar, öğretmen oradan istediği kısayolu widget
       // şeridine SÜRÜKLEYİP bırakabilir ya da tıklayarak ekleyip çıkarabilir; widget içindeki
       // kartlar da sürüklenerek yeniden sıralanabilir. Seçim + sıra tarayıcıya (localStorage)
       // grup bazında kaydedilir — sunucu tarafında saklanmaz, cihaza özeldir.
       function _renderClassroomShortcutsWidget(introEl, data, memberLabel) {
           const wrap = introEl.querySelector('#grp-intro-shortcuts-wrap');
           if (!wrap) return;

           const SHORTCUT_DEFS = {
               'asg-add':    { icon: 'fa-plus',          label: 'Ödev Ekle',      subtab: 'odevler',   openAdd: true },
               'performans': { icon: 'fa-chart-line',    label: 'Performans',     subtab: 'performans' },
               'roster':     { icon: 'fa-users',         label: `${memberLabel}ler`, subtab: 'roster' },
               'rapor':      { icon: 'fa-file-pdf',      label: 'Rapor',          subtab: 'rapor' },
               'program':    { icon: 'fa-calendar-days', label: 'Ders Programı',  subtab: 'program' },
           };
           const DEFAULT_IDS = ['asg-add', 'performans', 'roster', 'rapor'];
           const storeKey = `dc_grp_shortcuts_${data._supaId || data.code || 'x'}`;

           const loadIds = () => {
               let ids;
               try { ids = JSON.parse(localStorage.getItem(storeKey) || 'null'); } catch { ids = null; }
               if (!Array.isArray(ids)) ids = DEFAULT_IDS.slice();
               return ids.filter(id => SHORTCUT_DEFS[id]);
           };
           const saveIds = (ids) => {
               try { localStorage.setItem(storeKey, JSON.stringify(ids)); } catch {}
           };
           let selected = loadIds();
           let galleryOpen = false;
           // Widget artık Genel Bakış'ı kalabalıklaştırmasın diye varsayılan KAPALI —
           // bir butona basınca açılıp kapanıyor (2026-07-12, kullanıcı geri bildirimi:
           // "çok karmakarışık"). Açık/kapalı tercihi cihaza özel hatırlanır.
           const openStoreKey = `${storeKey}_open`;
           let panelOpen = localStorage.getItem(openStoreKey) === '1';

           const gotoSubtab = (id) => {
               const def = SHORTCUT_DEFS[id];
               if (!def) return;
               _gotoClassroomSubtab(def.subtab, { openAdd: def.openAdd });
           };

           let dragId = null;       // sürüklenen kısayol id'si (galeriden ya da widget'ın kendisinden)
           let dragFromGrid = false; // widget içinden mi sürükleniyor (sıralama) yoksa galeriden mi (ekleme)
           let liveOrder = null;     // sürükleme sırasında canlı önizleme dizisi (iOS widget taşıma efekti)

           // Sadece kart şeridini (grid) yeniden çizer — sürükleme sırasında sık çağrılır,
           // galeriyi de her seferinde yeniden kurmak gereksiz DOM/olay maliyeti yaratır.
           const renderGrid = (idsOverride) => {
               const grid = wrap.querySelector('#grp-intro-shortcuts');
               if (!grid) return;
               const ids = idsOverride || selected;
               const tileHtml = (id) => {
                   const def = SHORTCUT_DEFS[id];
                   const isGhost = dragFromGrid === false && id === dragId; // galeriden henüz bırakılmamış önizleme kartı
                   return `<button type="button" class="grp-intro-shortcut-btn${id === dragId ? ' is-dragging' : ''}${isGhost ? ' is-ghost' : ''}" draggable="true" data-shortcut="${id}">
                       <i class="fa-solid fa-grip-vertical grp-intro-shortcut-handle"></i>
                       <i class="fa-solid ${def.icon}"></i><span>${def.label}</span>
                   </button>`;
               };
               grid.innerHTML = `${ids.map(tileHtml).join('')}
                   <button type="button" class="grp-intro-shortcut-btn grp-intro-shortcut-edit" id="grp-intro-shortcut-edit-btn">
                       <i class="fa-solid fa-sliders"></i><span>Düzenle</span>
                   </button>`;
           };

           const render = () => {
               const galleryRowHtml = (id) => {
                   const def = SHORTCUT_DEFS[id];
                   const isOn = selected.includes(id);
                   return `<div class="grp-shortcut-gallery-item${isOn ? ' is-added' : ''}" draggable="true" data-shortcut="${id}" title="Widget'a sürükle ya da tıkla">
                       <i class="fa-solid ${def.icon}"></i><span>${def.label}</span>
                       <i class="fa-solid ${isOn ? 'fa-check' : 'fa-plus'} grp-shortcut-gallery-toggle"></i>
                   </div>`;
               };
               wrap.innerHTML = `
                   <button type="button" class="grp-intro-shortcuts-toggle" id="grp-intro-shortcuts-toggle">
                       <i class="fa-solid fa-grip-vertical"></i> Kısayollar
                       <i class="fa-solid fa-chevron-${panelOpen ? 'up' : 'down'}" style="margin-left:auto;"></i>
                   </button>
                   <div class="grp-intro-shortcuts-collapse${panelOpen ? '' : ' hidden'}" id="grp-intro-shortcuts-collapse">
                       <div class="grp-intro-shortcuts" id="grp-intro-shortcuts"></div>
                       <div class="grp-shortcut-gallery${galleryOpen ? '' : ' hidden'}" id="grp-shortcut-gallery">
                           <div class="grp-shortcut-gallery-hint"><i class="fa-solid fa-hand-pointer"></i> Widget'a eklemek için sürükle ya da tıkla</div>
                           <div class="grp-shortcut-gallery-list">
                               ${Object.keys(SHORTCUT_DEFS).map(galleryRowHtml).join('')}
                           </div>
                       </div>
                   </div>`;
               renderGrid();
               bindGridOnce();
               bindGallery();

               wrap.querySelector('#grp-intro-shortcuts-toggle')?.addEventListener('click', () => {
                   panelOpen = !panelOpen;
                   try { localStorage.setItem(openStoreKey, panelOpen ? '1' : '0'); } catch {}
                   render();
               });
           };

           // Sürüklenen kartın, imlecin üstünde durduğu kart hedefine göre nerede duracağını
           // hesaplar — iOS'ta widget taşırken diğer kartların kayarak yer açması gibi, burada
           // da her dragover'da diziyi yeniden kurup grid'i anında yeniden çiziyoruz.
           const previewInsertAt = (targetBtn, clientX) => {
               if (!dragId || !SHORTCUT_DEFS[dragId]) return;
               const base = selected.filter(x => x !== dragId);
               const targetId = targetBtn.dataset.shortcut;
               let idx = base.indexOf(targetId);
               if (idx === -1) idx = base.length;
               else {
                   const rect = targetBtn.getBoundingClientRect();
                   if (clientX > rect.left + rect.width / 2) idx += 1;
               }
               base.splice(idx, 0, dragId);
               if (liveOrder && liveOrder.join('|') === base.join('|')) return; // değişmediyse yeniden çizme
               liveOrder = base;
               renderGrid(liveOrder);
           };

           // Grid konteynerine TEK SEFERLİK olay delegasyonu bağlanır — renderGrid() sürükleme
           // sırasında saniyede onlarca kez çağrılabildiği için (her dragover'da), dinleyicileri
           // her seferinde tek tek karta bağlamak yığılan (duplicate) event listener'lara yol
           // açardı. Bunun yerine kalıcı konteynerin kendisine bağlanıp e.target.closest ile
           // hangi karta denk geldiği bulunuyor.
           const bindGridOnce = () => {
               const grid = wrap.querySelector('#grp-intro-shortcuts');
               if (!grid || grid.dataset.bound) return;
               grid.dataset.bound = '1';

               grid.addEventListener('click', (e) => {
                   if (e.target.closest('#grp-intro-shortcut-edit-btn')) {
                       galleryOpen = !galleryOpen;
                       render();
                       return;
                   }
                   if (dragId) return;
                   const btn = e.target.closest('.grp-intro-shortcut-btn[data-shortcut]');
                   if (btn) gotoSubtab(btn.dataset.shortcut);
               });
               grid.addEventListener('dragstart', (e) => {
                   const btn = e.target.closest('.grp-intro-shortcut-btn[data-shortcut]');
                   if (!btn) return;
                   dragId = btn.dataset.shortcut;
                   dragFromGrid = true;
                   liveOrder = null;
                   e.dataTransfer.effectAllowed = 'move';
                   e.dataTransfer.setData('text/plain', dragId);
               });
               grid.addEventListener('dragover', (e) => {
                   e.preventDefault();
                   if (!dragId) return;
                   const btn = e.target.closest('.grp-intro-shortcut-btn[data-shortcut]');
                   if (btn) { previewInsertAt(btn, e.clientX); return; }
                   // Boş alan ya da "Düzenle" butonu üstü → sona ekle.
                   const base = selected.filter(x => x !== dragId);
                   const asEnd = [...base, dragId];
                   if (liveOrder && liveOrder.join('|') === asEnd.join('|')) return;
                   liveOrder = asEnd;
                   renderGrid(liveOrder);
               });
               grid.addEventListener('drop', (e) => {
                   e.preventDefault();
                   commitDrag();
               });
               grid.addEventListener('dragleave', (e) => {
                   if (grid.contains(e.relatedTarget)) return; // hâlâ grid içindeyiz, sıfırlama
                   liveOrder = null;
                   if (!dragFromGrid) renderGrid(); // galeriden gelen önizleme kartını kaldır
               });
           };

           const commitDrag = () => {
               if (dragId && SHORTCUT_DEFS[dragId]) {
                   selected = liveOrder || (selected.includes(dragId) ? selected : [...selected, dragId]);
                   saveIds(selected);
               }
               dragId = null;
               dragFromGrid = false;
               liveOrder = null;
               render();
           };

           const bindGallery = () => {
               const gallery = wrap.querySelector('#grp-shortcut-gallery');
               gallery?.querySelectorAll('.grp-shortcut-gallery-item').forEach(item => {
                   item.addEventListener('click', () => {
                       const id = item.dataset.shortcut;
                       if (selected.includes(id)) selected = selected.filter(x => x !== id);
                       else selected.push(id);
                       saveIds(selected);
                       render();
                   });
                   item.addEventListener('dragstart', (e) => {
                       dragId = item.dataset.shortcut;
                       dragFromGrid = false;
                       liveOrder = null;
                       e.dataTransfer.effectAllowed = 'copy';
                       e.dataTransfer.setData('text/plain', dragId);
                   });
                   item.addEventListener('dragend', () => {
                       // Widget üstünde bırakılmadıysa (drop grid'de tetiklenmediyse) sıfırla.
                       if (dragId) { dragId = null; dragFromGrid = false; liveOrder = null; renderGrid(); }
                   });
               });
           };

           render();
       }
