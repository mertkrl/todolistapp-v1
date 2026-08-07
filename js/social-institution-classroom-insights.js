// social-institution-classroom-insights.js
// social-institution-panel.js'ten çıkarıldı (Faz H devamı): Sınıf/Ekip Paneli
// "Genel Bakış" analitik özeti — ham veri çekme (_fetchClassroomTabData),
// öğretmen/öğrenci içgörü panelleri (_ctRenderInsightsTeacherView/StudentView,
// renderClassroomInsightsPanel) ve kurumsal "Genel Bakış" giriş bloğu
// (renderInstitutionalOverviewIntro). Tümü doğrulandı: paylaşılan
// _classroomTabCache/_signedUrlCache önbelleklerine dokunmuyor, renderClassroomTab/
// wireClassroomTabEvents ile closure state paylaşmıyor — sadece parametre alıp
// window.* globalleri ve panel.js'te kalan _gotoClassroomSubtab/
// _renderClassroomShortcutsWidget'ı window.* köprüsüyle çağırıyor (panel.js bu
// dosyadan da import ettiği için circular import'u kırmak amacıyla, Faz Q/R devamı).
import { getCurrentUser } from '../state/current-user-store.js';
import { _fetchClassroomTabData } from './social-institution-classroom-insights-data.js';

// _fetchClassroomTabData artık social-institution-classroom-insights-data.js'te tanımlı
// (Faz devamı: veri katmanı ayrıştırıldı) — panel.js'in import listesini bozmamak için
// burada re-export ediliyor.
export { _fetchClassroomTabData };

       // Faz Dev-Dosya-Bölme: renderClassroomInsightsPanel'in isClassAdmin==true dalı module-
       // seviyeye taşındı — bağımsız async blok, sadece box/data/memberCount/isWork/memberLabel/
       // asgLabel'a ihtiyaç duyuyor (paylaşılan mutable state yok). Davranış birebir aynı.
       export async function _ctRenderInsightsTeacherView(box, data, memberCount, isWork, memberLabel, asgLabel) {
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
               <div class="cp-kpi u-i-0" ><span class="cp-kpi-num">${activeAsgCount}</span><span class="cp-kpi-label">Aktif Ödev</span></div>
               <div class="cp-kpi u-i-1" ><span class="cp-kpi-num">${activeLessonPlanCount}</span><span class="cp-kpi-label">Aktif Ders Planı</span></div>
               <div class="cp-kpi u-i-2" title="Süresi geçmiş/kapanmış ödev ve ders planlarında ${memberLabel.toLowerCase()}lerin teslim oranı"><span class="cp-kpi-num">${asgRate !== null ? `%${asgRate}` : '–'}</span><span class="cp-kpi-label">Ödev Teslim Oranı</span></div>
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
                       <i class="fa-solid fa-list-check u-color-h74b9ff_font-size-18px" ></i>
                       <div class="cp-weektodo-body">
                           <p class="cp-weektodo-title">Bu hafta ne yapmalıyım?</p>
                           <p class="cp-hint u-margin-0" >En yakın <b>${window._escapeHtml(next.title || asgLabel)}</b> ödevi <b>${dueLabel}</b> tarihinde doluyor — ${remaining > 0 ? `<b>${remaining}/${target}</b> ${memberLabel.toLowerCase()} henüz teslim etmedi.` : `${memberLabel.toLowerCase()}lerin hepsi teslim etti.`}</p>
                       </div>
                       <i class="fa-solid fa-chevron-right u-font-size-12px_color-var-text-muted" ></i>
                   </div>`;
               } else {
                   weekTodoHtml = `
                   <div class="cp-weektodo-card cp-weektodo-card--clear">
                       <i class="fa-solid fa-circle-check u-color-h2ed573_font-size-18px" ></i>
                       <div class="cp-weektodo-body">
                           <p class="cp-weektodo-title">Bu hafta ne yapmalıyım?</p>
                           <p class="cp-hint u-margin-0" >Bekleyen ${asgLabel.toLowerCase()} yok — yeni bir tane eklemek ister misin?</p>
                       </div>
                   </div>`;
               }
           }

           const onboardingHtml = memberCount === 0 ? `
           <div class="cp-onboarding-card">
               <i class="fa-solid fa-rocket u-color-h74b9ff_font-size-20px" ></i>
               <div>
                   <p class="u-margin-004px_font-weight-700_color-hfff_font-size-13px">${isWork ? 'Ekibin' : 'Sınıfın'} henüz boş</p>
                   <p class="cp-hint u-margin-0" >Üstteki <b>"Davet Et"</b> butonuyla ${memberLabel.toLowerCase()}lerini davet et, ardından Sınıf Paneli'nden ilk ödevini ekle.</p>
               </div>
           </div>` : '';

           box.innerHTML = `${onboardingHtml}${weekTodoHtml}${kpiHtml}`;

           box.querySelector('#cp-weektodo-goto')?.addEventListener('click', () => window._gotoClassroomSubtab('odevler'));
       }
       // Faz Dev-Dosya-Bölme: renderClassroomInsightsPanel'in isClassAdmin==false (öğrenci) dalı
       // module-seviyeye taşındı — aynı gerekçe: bağımsız async blok.
       export async function _ctRenderInsightsStudentView(box, data, memberCount, isWork, memberLabel, asgLabel) {
           // Odak-süresi istatistikleri (Bu Hafta Odağın/Sınıf Ortalaması/8 haftalık grafik)
           // BİLEREK burada tutulmuyor — İstatistikler bölümünde zaten görülüyor (2026-07-12,
           // kullanıcı geri bildirimi: burada tekrarı gereksizdi). Performansım artık sadece
           // burada başka hiçbir yerde olmayan veriye, yani ödev/ders planı tamamlama
           // durumuna odaklanıyor.
           const [myPrivacyRes, myAsgRes, myLpaRes] = await Promise.all([
               window.FocusSupabase.from('profiles').select('stats_hidden_from_institution').eq('id', getCurrentUser().id).maybeSingle(),
               window.FocusSupabase.from('classroom_assignments').select('id, title, target_user_ids, steps, due_date, created_at, status')
                   .eq('group_id', data._supaId).order('created_at', { ascending: false }).limit(50),
               // Gerçek "Ders Planı" ilerlemesi classroom_assignments.steps'te DEĞİL,
               // lesson_plan_assignments.progress_pct'te tutulur (bkz. planning.js _syncDirty:
               // milestone tamamlama oranı buraya yazılıyor) — classroom_assignments.steps
               // hiçbir zaman doldurulmuyor (2026-07-12'de tespit edildi, kart hep boş kalıyordu).
               window.FocusSupabase.from('lesson_plan_assignments').select('id, status, progress_pct, deadline')
                   .eq('group_id', data._supaId).eq('student_id', getCurrentUser().id)
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
               !a.target_user_ids || !a.target_user_ids.length || a.target_user_ids.includes(getCurrentUser().id));
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
                   .eq('user_id', getCurrentUser().id).in('assignment_id', myAssignments.map(a => a.id));
               const mySubmittedIds = new Set((subs || []).map(s => s.assignment_id));
               const isDone = (a) => mySubmittedIds.has(a.id);

               const nextMine = pendingMineAll.find(a => !isDone(a));
               if (nextMine) {
                   const dueLabel = nextMine.due_date
                       ? new Date(nextMine.due_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })
                       : 'Tarih belirtilmemiş';
                   nextMineHtml = `
                   <div class="cp-weektodo-card" id="cp-next-asg-goto">
                       <i class="fa-solid fa-list-check u-color-h74b9ff_font-size-18px" ></i>
                       <div class="cp-weektodo-body">
                           <p class="cp-weektodo-title">Sıradaki ödev</p>
                           <p class="cp-hint u-margin-0" ><b>${window._escapeHtml(nextMine.title || asgLabel)}</b> — ${dueLabel}</p>
                       </div>
                       <i class="fa-solid fa-chevron-right u-font-size-12px_color-var-text-muted" ></i>
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
                           <p class="cp-hint u-margin-0" >Şimdiye kadar tamamladığın: <b>${myDoneCount}/${resolvedAssignments.length}</b> (%${myTotalPct}) — bu sadece kendi geçmişinle kıyaslanır, kimseyle yarıştırılmaz.</p>
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
           <div class="cp-section-title u-margin-14px08px" ><i class="fa-solid fa-bolt u-color-hfeca57" ></i> Aktif Durumun</div>
           <div class="cp-kpi-strip">
               <div class="cp-kpi u-i-0" >
                   <span class="cp-kpi-num">${activeLessonPlans.length}</span>
                   <span class="cp-kpi-label">Aktif ${stepLabel}</span>
               </div>
               <div class="cp-kpi u-i-1" >
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
               <div class="cp-kpi u-i-0" >
                   <span class="cp-kpi-num">%${lessonPlanPct}</span>
                   <span class="cp-kpi-label">${stepLabel} İlerlemesi${activeLessonPlans.length > 1 ? ` (${activeLessonPlans.length} plan ortalaması)` : ''}</span>
               </div>` : ''}
               ${resolvedAssignments.length ? `
               <div class="cp-kpi${myLowSample ? ' cp-kpi--lowsample' : ''} u-i-1" >
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

           box.querySelector('#cp-next-asg-goto')?.addEventListener('click', () => window._gotoClassroomSubtab('odevler'));

           // "az veri" rozeti: masaüstünde title ile hover'da görünüyor ama mobilde title
           // tetiklenmiyor — dokununca da aynı açıklamayı toast olarak gösteriyoruz.
           box.querySelector('#cp-lowsample-badge')?.addEventListener('click', (e) => {
               window.dcShowToast(e.currentTarget.title, 'info');
           });

           box.querySelector('#cp-stats-privacy-toggle')?.addEventListener('change', async (e) => {
               const checked = e.target.checked;
               e.target.disabled = true;
               const { error } = await window.FocusSupabase
                   .from('profiles').update({ stats_hidden_from_institution: checked }).eq('id', getCurrentUser().id);
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

       export async function renderClassroomInsightsPanel(introEl, data, isClassAdmin, studentCount) {
           const box = introEl.querySelector('#grp-intro-insights');
           if (!box || !window.FocusSupabase || !getCurrentUser()?.id || !data._supaId) return;
           const isWork = data.classroomType === 'workplace';
           const memberLabel = isWork ? 'Çalışan' : 'Öğrenci';
           const asgLabel = isWork ? 'Görevlendirmeler' : 'Ders Planı';
           // Tek doğruluk kaynağı: öğrenci sayısı çağıran renderInstitutionalOverviewIntro'dan
           // geliyor (data.members bazlı) — burada ayrıca statsRes/data.members üzerinden farklı
           // bir sayım yapılırsa (ör. hesap silinmiş üyeler dahil/hariç tutulursa) ekranın iki
           // farklı yerinde çelişen üye sayıları görünür (2026-07-12'de yaşandı).
           const memberCount = studentCount;
           // Faz Dev-Dosya-Bölme: gövde module-seviye _ctRenderInsightsTeacherView/StudentView'da.
           if (isClassAdmin) {
               await _ctRenderInsightsTeacherView(box, data, memberCount, isWork, memberLabel, asgLabel);
           } else {
               await _ctRenderInsightsStudentView(box, data, memberCount, isWork, memberLabel, asgLabel);
           }
       }

       export async function renderInstitutionalOverviewIntro(data, isClassAdmin) {
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
                   ${isClassAdmin ? `<div id="grp-intro-insights" class="cp-skeleton u-margin-bottom-14px" ><div class="cp-skel-strip"><div class="cp-skel-box"></div><div class="cp-skel-box"></div></div></div>` : ''}
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

           if (isClassAdmin) window._renderClassroomShortcutsWidget(introEl, data, memberLabel);

           // Öğrenci için "Kendi Aynan" (streak/KPI/geçmiş) artık burada değil, Sınıf Paneli >
           // "Performansım" alt sekmesinde gösteriliyor (bkz. renderClassroomTab) — Genel Bakış'ta
           // sadece öğretmenin özet KPI şeridi kalıyor (bkz. renderClassroomInsightsPanel içindeki
           // "Dikkat Gerekenler kaldırıldı" notu).
           if (isClassAdmin) renderClassroomInsightsPanel(introEl, data, isClassAdmin, studentCount);
       }
