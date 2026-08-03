import { CATEGORIES } from './planning-utils.js';
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
//  - computeUserInterestCategoriesSupabase()/renderDiscoverGroups():
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
import { _refreshMyAssignmentsBadge } from './social-assignments-badge.js';
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
import { getCurrentUser } from './state/current-user-store.js';
import { getPendingClassroomSubtab, setPendingClassroomSubtab } from './state/pending-classroom-subtab-store.js';
import {
    _renderCategoryBreakdownHtml,
    _CT_TREND_WEEKS, _CT_TREND_MIN_TOTAL, _ctPctColor, _ctSparkHtml, _ctTrendDirection, _ctTrendArrowHtml,
    _ctRenderPerfRowsHtml, _ctRenderPerfDistributionHtml,
    _CT_LOW_SAMPLE_MAX, _CT_MIN_ASSIGNED_FOR_SUPPORT, _CT_FOCUS_MISMATCH_HIGH_MULT,
    _CT_FOCUS_MISMATCH_LOW_MULT, _CT_FOCUS_MISMATCH_MIN_MEDIAN, _CT_FOCUS_MISMATCH_HIGH_FLOOR,
    _CT_FOCUS_MISMATCH_HIGH_COMPLETION, _CT_FOCUS_Z_MIN_BASELINE_WEEKS, _CT_FOCUS_Z_DROP_THRESHOLD,
    _CT_FOCUS_Z_MIN_STD, _CT_PERIOD_LABEL, _CT_FOCUS_TREND_LABELS, _CT_ANOMALY_META, _CT_CONTEXT_META,
    _CT_PERF_SORT_KEYS, _ctSortPerfRows, _ctBuildPerfCounts, _ctBuildPerfRows,
} from './social-institution-classroom-perf-utils.js';
import {
    buildClassroomReportTabHtml,
    buildScheduleSectionData,
    buildRosterSectionData,
    buildAssignmentAnalysisHtml,
    buildPerformanceSectionData,
    buildAssignmentCardsSectionData,
} from './social-institution-classroom-sections.js';
import {
    _wireReportTabEvents,
    _wireSubtabSwitching,
    _wireAssignmentFilterEvents,
    _wirePerformanceTabEvents,
    _wireScheduleAndRosterEvents,
    _wireAssignmentFormEvents,
} from './social-institution-classroom-wire.js';
import {
    _fetchClassroomTabData,
    renderClassroomInsightsPanel,
    renderInstitutionalOverviewIntro,
} from './social-institution-classroom-insights.js';

       // Sınıf/Ekip Paneli'nde "yönetici misin" kontrolü tek bir yere toplandı — önceden sadece
       // grup sahibi (isOwner) veya group_members.role==='admin' bakılıyordu; bir öğretmenin kurumsal
       // rolü (institutionRole) olduğu halde bu grupta üyelik satırı henüz 'admin' olarak
       // işaretlenmemişse (senkron gecikmesi/eksik veri) KPI ve performans panelleri sessizce
       // hiç görünmüyordu. institutionRole==='teacher' de artık ayrıca kabul ediliyor.
       window._isInstitutionalAdmin = (data, isOwner) => _isInstitutionalAdmin(data, isOwner); // Faz 5: social-group-details.js için
       export function _applyDynStyles(root) {
           if (!root) return;
           root.querySelectorAll('[data-dyn-w]').forEach(el => { el.style.width = el.getAttribute('data-dyn-w') + '%'; });
           root.querySelectorAll('[data-dyn-h]').forEach(el => { el.style.height = el.getAttribute('data-dyn-h') + 'px'; });
           root.querySelectorAll('[data-dyn-bg]').forEach(el => { el.style.backgroundColor = el.getAttribute('data-dyn-bg'); });
           root.querySelectorAll('[data-dyn-color]').forEach(el => { el.style.color = el.getAttribute('data-dyn-color'); });
       }
       function _isInstitutionalAdmin(data, isOwner) {
           const myRole = data.members?.[getCurrentUser()?.username]?.role;
           return !!(isOwner || myRole === 'admin' || getCurrentUser()?.institutionRole === 'teacher');
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
       export async function _getSignedUrlCached(bucketPath) {
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
       // renderClassroomTab'ın "Rapor" alt-sekmesi HTML'ini üretir — öğrenci/veli/psikolog/
       // öğretmenin PDF olarak indirebileceği özet: ders programı, ödev tamamlama durumu,
       // odaklanma özeti. Yönetici istediği öğrenciyi seçer, öğrenci sadece kendi raporunu
       // indirebilir. Saf hesaplama, dışarıdan sadece gerekli veriyi parametre olarak alır.
       // Faz Dev-Dosya-Bölme: buildAssignmentCardsSectionData'nın asgCard(a) closure'ı module-
       // seviyeye taşındı — tek bir ödev kartının HTML'ini üretir, dışarıdan sadece `a` (ödev
       // objesi) alır ve geri kalan 18 bağımlılığı tek bir `ctx` paketinden okur (tek tek
       // parametre yerine — bu kadar çok bağımlılıkta paket daha az hataya açık). Davranış
       // birebir aynı, sadece closure yerine ctx.

       // Faz K/dev-dosya-refactoru: renderClassroomTab'ın event-binding bölümü (tüm addEventListener
       // bağlamaları) buraya taşındı. `ctx` renderClassroomTab'ın data-fetch + render bölümünde
       // hesaplanan her şeyi taşıyor; ctx.perfRows/ctx.tableRows İÇERİDE reassign edilebildiği için
       // (dönem/sınıf filtresi değişince) mutable tutulmaları gerekiyor — geri kalanı salt-okunur.
       // `refresh` burada tanımlanıyor çünkü sadece data/isClassAdmin/renderClassroomTabCached'a
       // bağımlı, ctx'siz de çalışır — davranış birebir aynı, sadece konum değişti.
       // Sınıf Paneli'nin "Rapor" sekmesi: öğrenci seçimi + PDF (yazdır) oluşturma.

       // Sınıf Paneli'nin tüm sekmelerindeki olay bağlamalarını başlatan orkestratör.
       // Faz S devamı, dev fonksiyon refactoru: eskiden bu tek ~830 satırlık fonksiyondaydı,
       // şimdi her sekme kendi _wire*Events fonksiyonunda. `refresh` (tüm paneli force
       // yeniden çeken) Ders Programı/Roster/Ödevler arasında paylaşıldığı için burada
       // tanımlanıp parametre olarak geçiliyor.
       function wireClassroomTabEvents(el, data, isClassAdmin, ctx) {
           // "Performansım" panelinin içeriği (streak/KPI/geçmiş) — aynı renderClassroomInsightsPanel
           // fonksiyonu (öğrenci dalı), artık Genel Bakış yerine burayı (#grp-intro-insights bu panelin
           // içinde) hedefliyor. İki konum aynı anda DOM'da olmuyor (biri isClassAdmin, diğeri değil).
           if (ctx.hasStudentPerfTab) renderClassroomInsightsPanel(el, data, false, ctx.memberCount);

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

           const refresh = () => {
               renderClassroomTabCached(data, isClassAdmin, true);
               if (!isClassAdmin && typeof _refreshMyAssignmentsBadge === 'function') _refreshMyAssignmentsBadge();
           };

           _wireReportTabEvents(el, data, isClassAdmin, ctx);
           _wireSubtabSwitching(el, data);
           _wireAssignmentFilterEvents(el);
           _wirePerformanceTabEvents(el, data, isClassAdmin, ctx, refresh);
           if (isClassAdmin) _wireScheduleAndRosterEvents(el, data, isClassAdmin, ctx, refresh);
           _wireAssignmentFormEvents(el, data, isClassAdmin, ctx, refresh);
       }


       async function renderClassroomTab(data, isClassAdmin) {
           const el = document.getElementById('group-gtab-classroom');
           if (!el || !window.FocusSupabase || !getCurrentUser()?.id || !data._supaId) return;
           // Tek satır "Yükleniyor…" yerine, gelecek panelin kabaca şeklini taklit eden iskelet
           el.innerHTML = `
               <div class="cp-skeleton">
                   <div class="cp-skel-strip"><div class="cp-skel-box"></div><div class="cp-skel-box"></div><div class="cp-skel-box"></div><div class="cp-skel-box"></div></div>
                   <div class="cp-skel-line u-width-40pct" ></div>
                   <div class="cp-skel-row"></div>
                   <div class="cp-skel-row"></div>
                   <div class="cp-skel-row"></div>
               </div>`;

           const isWork = data.classroomType === 'workplace';
           // NOT: asgLabel eskiden aşağıda ("Ödevler / Ders Planı" bölümünde) tanımlıydı ama
           // "Ödev Bazlı Analiz" (asgAnalysisHtml, perfHtml içinde) ondan ÖNCE kullanıyordu —
           // temporal-dead-zone ReferenceError (sadece isClassAdmin VE en az 1 kapanmış/süresi
           // geçmiş ödev varken tetikleniyordu, bu yüzden fark edilmemiş). Buraya taşındı.
           const asgLabel = isWork ? 'Görevlendirmeler' : 'Ders Planı';
           const memberLabel = isWork ? 'Çalışan' : 'Öğrenci';
           // Öğretmen/kurucu (role === 'admin') sınıfın kendi öğrenci listelerinde,
           // ödev hedef havuzunda ve Performans tablosunda görünmesin — "öğrenci" kavramı
           // yönetici olmayan üyelerdir (bkz. Sınıf Paneli tartışması, 2026-07-11).
           const studentMembers = Object.values(data.members || {}).filter(m => m.userId && m.role !== 'admin');
           const memberCount = studentMembers.length;

           const cd = await _fetchClassroomTabData(data, isClassAdmin);
           const {
               classSections, sectionNameById, statsRes, catRes, assignments, templates,
               schedRes, focusHistRes, allInstitutionClasses,
               subsByAsg, subNotes, subGrades, mySubs, myGrades, mySubmittedAt, mySubAttachment,
               submittedAtByAsgUser, stepDoneByAsg
           } = cd;
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
           // Faz K/dev-dosya-refactoru: perfHtml/perfRows/tableRows ve ilgili sıralama/filtre
           // yardımcıları artık module-seviye buildPerformanceSectionData'da (saf veri işleme +
           // tek seferlik snapshot upsert) — davranış birebir aynı, sadece konum değişti. TEK
           // sefer çağrılır (snapshot upsert/karşılaştırma sorgusu yan etkili — iki kez çağırmak
           // veriyi ikiye katlar).
           const perfData = await buildPerformanceSectionData(el, data, isClassAdmin, studentMembers, memberCount, classSections, sectionNameById, assignments, subsByAsg, stepDoneByAsg, statsRes, catRes, focusHistRes, memberLabel, asgLabel);
           const { perfHtml, buildPerfRows, showClassColumn, periodLabel, sortPerfRows, filterPerfRowsByClass, renderPerfRowsHtml, renderPerfDistributionHtml } = perfData;
           let { perfRows, tableRows } = perfData;

           // Faz K/dev-dosya-refactoru: Hızlı Ödev / Ders Planı takip bölümü (quickAsgHtml/asgCard,
           // olay dinleyicisi yok) artık module-seviye buildAssignmentCardsSectionData'da —
           // davranış birebir aynı. targetMembers, aşağıdaki "hatırlat" butonu event handler'ında
           // da kullanıldığı için ayrıca döndürülüyor.
           const { asgHtml, targetMembers } = await buildAssignmentCardsSectionData(el, data, isClassAdmin, isWork, studentMembers, memberCount, memberLabel, asgLabel, assignments, templates, allInstitutionClasses, subsByAsg, stepDoneByAsg, subNotes, subGrades, mySubs, myGrades, mySubmittedAt, mySubAttachment);


           const { scheduleHtml, scheduleRows, scheduleSubjectOptions, scheduleCardByClass, classNameById, DAY_NAMES_TR, myClassSectionId } = await buildScheduleSectionData(data, isClassAdmin, schedRes, classSections);

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

           const { reportHtml, reportStudentOptions } = buildClassroomReportTabHtml(isClassAdmin, studentMembers, classSections, memberLabel);

           const { rosterHtml, rosterMembers } = buildRosterSectionData(el, isClassAdmin, studentMembers, sectionNameById, classSections, memberLabel);

           // Öğrenci için "Performansım" — eskiden Genel Bakış'ta ayrı bir kart olan streak/KPI/
           // geçmiş bloğu, artık Sınıf Paneli'nin İLK alt sekmesi (öğretmenin "Performans"ıyla
           // karışmasın diye ayrı isim). Öğretmende bu sekme yok, kendi "Performans" sekmesi zaten var.
           const hasStudentPerfTab = !isClassAdmin;
           const availableSubtabs = [...(hasStudentPerfTab ? ['performansim'] : []), ...(hasPerfTab ? ['performans'] : []), 'odevler', 'program', ...(isClassAdmin ? ['roster'] : []), 'rapor'];
           const defaultSubtab = hasStudentPerfTab ? 'performansim' : (hasPerfTab ? 'performans' : 'odevler');
           let activeSubtab = availableSubtabs.includes(el.dataset.activeSubtab) ? el.dataset.activeSubtab : defaultSubtab;
           // "Ödevlerim" rozetinden gelen tıklama, panel ilk açıldığında doğrudan Ödevler sekmesine düşsün
           if (getPendingClassroomSubtab() && availableSubtabs.includes(getPendingClassroomSubtab())) {
               activeSubtab = getPendingClassroomSubtab();
           }
           setPendingClassroomSubtab(null);
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
           _applyDynStyles(el);

           wireClassroomTabEvents(el, data, isClassAdmin, {
               hasStudentPerfTab, memberCount, memberLabel, asgLabel,
               classSections, sectionNameById, reportStudentOptions,
               assignments, subsByAsg, subGrades, stepDoneByAsg, submittedAtByAsgUser,
               scheduleRows, scheduleSubjectOptions, scheduleCardByClass, classNameById, DAY_NAMES_TR,
               rosterMembers, templates, allInstitutionClasses, studentMembers, isWork,
               targetMembers, tableRows, perfRows, sortPerfRows, filterPerfRowsByClass, renderPerfRowsHtml,
               renderPerfDistributionHtml, buildPerfRows, showClassColumn, periodLabel,
           });
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
       window._gotoClassroomSubtab = _gotoClassroomSubtab; // social-institution-classroom-insights.js için (circular import kırma)
       export function _gotoClassroomSubtab(subtab, opts = {}) {
           setPendingClassroomSubtab(subtab);
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

       window.renderInstitutionalOverviewIntro = (data, isClassAdmin) => renderInstitutionalOverviewIntro(data, isClassAdmin); // Faz 5: social-group-details.js için

       // Öğretmenin Genel Bakış'ta gördüğü kısayol widget'ı — Apple'ın "widget ekle" galerisine
       // benzer: "Düzenle" butonu bir galeri açar, öğretmen oradan istediği kısayolu widget
       // şeridine SÜRÜKLEYİP bırakabilir ya da tıklayarak ekleyip çıkarabilir; widget içindeki
       // kartlar da sürüklenerek yeniden sıralanabilir. Seçim + sıra tarayıcıya (localStorage)
       // grup bazında kaydedilir — sunucu tarafında saklanmaz, cihaza özeldir.
       // Faz Dev-Dosya-Bölme: _renderClassroomShortcutsWidget'ın gövdesi (kısayol widget'ı —
       // sürükle-bırak sıralama/ekleme) module-seviye fonksiyonlara bölündü. 6 mutable değişken
       // (selected/galleryOpen/panelOpen/dragId/dragFromGrid/liveOrder) birbirine çapraz-referans
       // veren birçok closure tarafından okunup yazılıyordu — bunları TEK bir paylaşılan `w.state`
       // objesine taşıyıp (JS objeleri referansla geçtiği için mutasyonlar her yerde görünür) her
       // fonksiyona `w` (widget context) parametre olarak geçirdik. Davranış birebir aynı — SADECE
       // değişken erişimi closure yerine w.state.X. DİKKAT: sürükle-bırak akışı görsel/etkileşimli
       // olduğu için mutlaka tarayıcıda test edilmeli.
       function _ctShortcutDefs(memberLabel) {
           return {
               'asg-add':    { icon: 'fa-plus',          label: 'Ödev Ekle',      subtab: 'odevler',   openAdd: true },
               'performans': { icon: 'fa-chart-line',    label: 'Performans',     subtab: 'performans' },
               'roster':     { icon: 'fa-users',         label: `${memberLabel}ler`, subtab: 'roster' },
               'rapor':      { icon: 'fa-file-pdf',      label: 'Rapor',          subtab: 'rapor' },
               'program':    { icon: 'fa-calendar-days', label: 'Ders Programı',  subtab: 'program' },
           };
       }
       function _ctSwLoadIds(w) {
           let ids;
           try { ids = JSON.parse(localStorage.getItem(w.storeKey) || 'null', window._safeJsonReviver); } catch { ids = null; }
           if (!Array.isArray(ids)) ids = w.DEFAULT_IDS.slice();
           return ids.filter(id => w.defs[id]);
       }
       function _ctSwSaveIds(w, ids) {
           try { localStorage.setItem(w.storeKey, JSON.stringify(ids)); } catch {}
       }
       function _ctSwGotoSubtab(w, id) {
           const def = w.defs[id];
           if (!def) return;
           _gotoClassroomSubtab(def.subtab, { openAdd: def.openAdd });
       }
       // Sadece kart şeridini (grid) yeniden çizer — sürükleme sırasında sık çağrılır,
       // galeriyi de her seferinde yeniden kurmak gereksiz DOM/olay maliyeti yaratır.
       function _ctSwRenderGrid(w, idsOverride) {
           const grid = w.wrap.querySelector('#grp-intro-shortcuts');
           if (!grid) return;
           const ids = idsOverride || w.state.selected;
           const tileHtml = (id) => {
               const def = w.defs[id];
               const isGhost = w.state.dragFromGrid === false && id === w.state.dragId; // galeriden henüz bırakılmamış önizleme kartı
               return `<button type="button" class="grp-intro-shortcut-btn${id === w.state.dragId ? ' is-dragging' : ''}${isGhost ? ' is-ghost' : ''}" draggable="true" data-shortcut="${id}">
                   <i class="fa-solid fa-grip-vertical grp-intro-shortcut-handle"></i>
                   <i class="fa-solid ${def.icon}"></i><span>${def.label}</span>
               </button>`;
           };
           grid.innerHTML = `${ids.map(tileHtml).join('')}
               <button type="button" class="grp-intro-shortcut-btn grp-intro-shortcut-edit" id="grp-intro-shortcut-edit-btn">
                   <i class="fa-solid fa-sliders"></i><span>Düzenle</span>
               </button>`;
       }
       function _ctSwRender(w) {
           const galleryRowHtml = (id) => {
               const def = w.defs[id];
               const isOn = w.state.selected.includes(id);
               return `<div class="grp-shortcut-gallery-item${isOn ? ' is-added' : ''}" draggable="true" data-shortcut="${id}" title="Widget'a sürükle ya da tıkla">
                   <i class="fa-solid ${def.icon}"></i><span>${def.label}</span>
                   <i class="fa-solid ${isOn ? 'fa-check' : 'fa-plus'} grp-shortcut-gallery-toggle"></i>
               </div>`;
           };
           w.wrap.innerHTML = `
               <button type="button" class="grp-intro-shortcuts-toggle" id="grp-intro-shortcuts-toggle">
                   <i class="fa-solid fa-grip-vertical"></i> Kısayollar
                   <i class="fa-solid fa-chevron-${w.state.panelOpen ? 'up' : 'down'} u-margin-left-auto" ></i>
               </button>
               <div class="grp-intro-shortcuts-collapse${w.state.panelOpen ? '' : ' hidden'}" id="grp-intro-shortcuts-collapse">
                   <div class="grp-intro-shortcuts" id="grp-intro-shortcuts"></div>
                   <div class="grp-shortcut-gallery${w.state.galleryOpen ? '' : ' hidden'}" id="grp-shortcut-gallery">
                       <div class="grp-shortcut-gallery-hint"><i class="fa-solid fa-hand-pointer"></i> Widget'a eklemek için sürükle ya da tıkla</div>
                       <div class="grp-shortcut-gallery-list">
                           ${Object.keys(w.defs).map(galleryRowHtml).join('')}
                       </div>
                   </div>
               </div>`;
           _ctSwRenderGrid(w);
           _ctSwBindGridOnce(w);
           _ctSwBindGallery(w);

           w.wrap.querySelector('#grp-intro-shortcuts-toggle')?.addEventListener('click', () => {
               w.state.panelOpen = !w.state.panelOpen;
               try { localStorage.setItem(w.openStoreKey, w.state.panelOpen ? '1' : '0'); } catch {}
               _ctSwRender(w);
           });
       }
       // Sürüklenen kartın, imlecin üstünde durduğu kart hedefine göre nerede duracağını
       // hesaplar — iOS'ta widget taşırken diğer kartların kayarak yer açması gibi, burada
       // da her dragover'da diziyi yeniden kurup grid'i anında yeniden çiziyoruz.
       function _ctSwPreviewInsertAt(w, targetBtn, clientX) {
           if (!w.state.dragId || !w.defs[w.state.dragId]) return;
           const base = w.state.selected.filter(x => x !== w.state.dragId);
           const targetId = targetBtn.dataset.shortcut;
           let idx = base.indexOf(targetId);
           if (idx === -1) idx = base.length;
           else {
               const rect = targetBtn.getBoundingClientRect();
               if (clientX > rect.left + rect.width / 2) idx += 1;
           }
           base.splice(idx, 0, w.state.dragId);
           if (w.state.liveOrder && w.state.liveOrder.join('|') === base.join('|')) return; // değişmediyse yeniden çizme
           w.state.liveOrder = base;
           _ctSwRenderGrid(w, w.state.liveOrder);
       }
       // Grid konteynerine TEK SEFERLİK olay delegasyonu bağlanır — renderGrid() sürükleme
       // sırasında saniyede onlarca kez çağrılabildiği için (her dragover'da), dinleyicileri
       // her seferinde tek tek karta bağlamak yığılan (duplicate) event listener'lara yol
       // açardı. Bunun yerine kalıcı konteynerin kendisine bağlanıp e.target.closest ile
       // hangi karta denk geldiği bulunuyor.
       function _ctSwBindGridOnce(w) {
           const grid = w.wrap.querySelector('#grp-intro-shortcuts');
           if (!grid || grid.dataset.bound) return;
           grid.dataset.bound = '1';

           grid.addEventListener('click', (e) => {
               if (e.target.closest('#grp-intro-shortcut-edit-btn')) {
                   w.state.galleryOpen = !w.state.galleryOpen;
                   _ctSwRender(w);
                   return;
               }
               if (w.state.dragId) return;
               const btn = e.target.closest('.grp-intro-shortcut-btn[data-shortcut]');
               if (btn) _ctSwGotoSubtab(w, btn.dataset.shortcut);
           });
           grid.addEventListener('dragstart', (e) => {
               const btn = e.target.closest('.grp-intro-shortcut-btn[data-shortcut]');
               if (!btn) return;
               w.state.dragId = btn.dataset.shortcut;
               w.state.dragFromGrid = true;
               w.state.liveOrder = null;
               e.dataTransfer.effectAllowed = 'move';
               e.dataTransfer.setData('text/plain', w.state.dragId);
           });
           grid.addEventListener('dragover', (e) => {
               e.preventDefault();
               if (!w.state.dragId) return;
               const btn = e.target.closest('.grp-intro-shortcut-btn[data-shortcut]');
               if (btn) { _ctSwPreviewInsertAt(w, btn, e.clientX); return; }
               // Boş alan ya da "Düzenle" butonu üstü → sona ekle.
               const base = w.state.selected.filter(x => x !== w.state.dragId);
               const asEnd = [...base, w.state.dragId];
               if (w.state.liveOrder && w.state.liveOrder.join('|') === asEnd.join('|')) return;
               w.state.liveOrder = asEnd;
               _ctSwRenderGrid(w, w.state.liveOrder);
           });
           grid.addEventListener('drop', (e) => {
               e.preventDefault();
               _ctSwCommitDrag(w);
           });
           grid.addEventListener('dragleave', (e) => {
               if (grid.contains(e.relatedTarget)) return; // hâlâ grid içindeyiz, sıfırlama
               w.state.liveOrder = null;
               if (!w.state.dragFromGrid) _ctSwRenderGrid(w); // galeriden gelen önizleme kartını kaldır
           });
       }
       function _ctSwCommitDrag(w) {
           if (w.state.dragId && w.defs[w.state.dragId]) {
               w.state.selected = w.state.liveOrder || (w.state.selected.includes(w.state.dragId) ? w.state.selected : [...w.state.selected, w.state.dragId]);
               _ctSwSaveIds(w, w.state.selected);
           }
           w.state.dragId = null;
           w.state.dragFromGrid = false;
           w.state.liveOrder = null;
           _ctSwRender(w);
       }
       function _ctSwBindGallery(w) {
           const gallery = w.wrap.querySelector('#grp-shortcut-gallery');
           gallery?.querySelectorAll('.grp-shortcut-gallery-item').forEach(item => {
               item.addEventListener('click', () => {
                   const id = item.dataset.shortcut;
                   if (w.state.selected.includes(id)) w.state.selected = w.state.selected.filter(x => x !== id);
                   else w.state.selected.push(id);
                   _ctSwSaveIds(w, w.state.selected);
                   _ctSwRender(w);
               });
               item.addEventListener('dragstart', (e) => {
                   w.state.dragId = item.dataset.shortcut;
                   w.state.dragFromGrid = false;
                   w.state.liveOrder = null;
                   e.dataTransfer.effectAllowed = 'copy';
                   e.dataTransfer.setData('text/plain', w.state.dragId);
               });
               item.addEventListener('dragend', () => {
                   // Widget üstünde bırakılmadıysa (drop grid'de tetiklenmediyse) sıfırla.
                   if (w.state.dragId) { w.state.dragId = null; w.state.dragFromGrid = false; w.state.liveOrder = null; _ctSwRenderGrid(w); }
               });
           });
       }
       window._renderClassroomShortcutsWidget = _renderClassroomShortcutsWidget; // social-institution-classroom-insights.js için (circular import kırma)
       export function _renderClassroomShortcutsWidget(introEl, data, memberLabel) {
           const wrap = introEl.querySelector('#grp-intro-shortcuts-wrap');
           if (!wrap) return;
           const defs = _ctShortcutDefs(memberLabel);
           const DEFAULT_IDS = ['asg-add', 'performans', 'roster', 'rapor'];
           const storeKey = `dc_grp_shortcuts_${data._supaId || data.code || 'x'}`;
           // Widget artık Genel Bakış'ı kalabalıklaştırmasın diye varsayılan KAPALI —
           // bir butona basınca açılıp kapanıyor (2026-07-12, kullanıcı geri bildirimi:
           // "çok karmakarışık"). Açık/kapalı tercihi cihaza özel hatırlanır.
           const openStoreKey = `${storeKey}_open`;
           const w = { wrap, data, memberLabel, defs, DEFAULT_IDS, storeKey, openStoreKey, state: null };
           w.state = {
               selected: _ctSwLoadIds(w),
               galleryOpen: false,
               panelOpen: localStorage.getItem(openStoreKey) === '1',
               dragId: null,       // sürüklenen kısayol id'si (galeriden ya da widget'ın kendisinden)
               dragFromGrid: false, // widget içinden mi sürükleniyor (sıralama) yoksa galeriden mi (ekleme)
               liveOrder: null,     // sürükleme sırasında canlı önizleme dizisi (iOS widget taşıma efekti)
           };
           _ctSwRender(w);
       }

