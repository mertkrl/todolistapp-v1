# FocusAI — Mimari Notları

Bu dosya, kod tabanına yeni bakan biri (ya da altı ay sonraki siz) için
oturum hafızalarında dağınık duran mimari bilgiyi tek yerde toplar. Faz 2/5
modülerleştirme çalışmalarının çıkardığı dersler burada.

## 1. Dosya yükleme modelleri — üç ayrı kategori

Proje framework kullanmıyor (vanilla JS + Vite). `index.html`'deki her
`<script>` etiketi ayrı bir yükleme modeline giriyor, ve bu MODEL dosyalar
arası bağımlılığın nasıl kurulabileceğini belirliyor:

### a) Statik ES modülleri (`<script type="module" src="...">`)
`index.html`'de doğrudan listelenen `script.js`, `script-*.js`,
`supabase-client.js`, `auth-ui.js`, `storage-manager.js`, `state-store.js`,
`inline-module-loader.js`. Her biri KENDİ izole modül kapsamına sahip —
aralarında bare (window.'siz) isim paylaşımı ÇALIŞMAZ, sadece:
  - `export`/`import` (ör. `script-command-palette.js` → `script.js`'ten
    `getTasksRef` gibi fonksiyonları named import ile alıyor), veya
  - `window.*` köprüsü.

**Sıra kuralı:** `<script type="module">` etiketleri defer semantiğiyle
çalışır — TÜMÜ DOMContentLoaded'dan ÖNCE top-level kodlarını çalıştırır,
ETİKET SIRASI genelde önemsiz. İSTİSNA: bir modülün top-level kodu (event
listener kaydı DIŞINDA) SENKRON olarak başka bir modülün üst-seviye
fonksiyonuna bare referans veriyorsa (nadir), o zaman sıra önemli hale gelir
— `script-date-time-utils.js` index.html'de `script.js`'ten ÖNCE yüklenir,
çünkü script.js'in üst seviyesinde senkron çağrılan bir fonksiyona ihtiyacı
var.

### b) Dynamic import() (`inline-module-loader.js` üzerinden)
`social.js`, `social-*.js`, `planning.js`, `planning-*.js`, `collab.js` bu
şekilde yükleniyor. Yine izole modül kapsamı — (a) ile aynı kurallar
geçerli, TEK FARK: **YÜKLEME SIRASI ÖNEMLİ**. `inline-module-loader.js`'deki
dizi sırayla `await import(...)` ediliyor; bir modülün top-level kodu (ya da
`init()` gibi hemen çağrılan bir fonksiyonu) başka bir modülün bare
isimlerine ihtiyaç duyuyorsa, o modül dizide ÖNCE olmalı. Örnek:
`social-toast.js` listenin en başında çünkü `social.js` onun tanımladığı
`window.dcShowToast`'ı bare (`dcShowToast(...)`) çağırıyor.

### c) Classic script (`<script src="...">`, `type="module"` YOK)
`inline-*.js` (çoğu), `sw.js` (ayrı bir service worker global kapsamı, HİÇBİRİYLE
paylaşmıyor). Sayfadaki TÜM classic script'ler TEK bir global kapsamı
paylaşır — aralarında bare isim paylaşımı NORMAL, izolasyon yok. `sw.js`
tamamen ayrı bir execution context'te çalışır (service worker), sayfa
kapsamıyla hiçbir şey paylaşmaz.

## 2. window.* köprü sicili (bilinenler)

Modül izolasyonu nedeniyle paylaşılması gereken state/fonksiyonlar
`window.*` üzerinden köprüleniyor. İki tür köprü var:

- **Salt-okunur getter** (`window.__getXRef`): sahibi dosyada tanımlı `let`
  değişkeni okumak için.
- **Getter+setter çifti** (`window.__getXRef` / `window.__setXRef`): değişken
  HEM sahibinde HEM tüketicide reassign ediliyorsa (basit import/kopyalama
  senkron kalmaz, primitif değerler kopyalanır).
- **Fonksiyon exposure** (`window.fnName = fnName`): bir fonksiyonun başka
  modülden çağrılabilmesi için.

| Köprü | Sahibi | Tipi | Not |
|---|---|---|---|
| `__getTasksRef` / `__getGoalsRef` / `__getHabitsRef` / `__getMindDumpsRef` / `__getCalendarEventsRef` | script.js | getter | salt-okunur, script-*.js modülleri tüketir |
| `__setGoalsRef` | script.js | setter | goals reassign eden modüller için |
| `__getActiveFocusTaskRef` | script.js | getter | Odak Görevi Seçici state'i |
| `__getRenderStatisticsRef` / `__getRenderSocialStatsRef` | script.js | getter | script-timer.js gibi modüllerin XP senkronu için |
| `__getCurrentActiveGroupCodeRef` / `__setCurrentActiveGroupCodeRef` | social.js | getter+setter | social-group-details.js tüketir |
| `__getActiveGroupIdRef` | social.js | getter | |
| `__getGscSessionsCacheRef` | social-group-details.js | getter | social.js'in dcRenderSessionStrip/_refreshWatchedPresence fonksiyonları tüketir (bu iki fonksiyon closure zinciriyle DEĞİL, köprüyle erişiyor — bkz. Faz 5 notu aşağıda) |
| `gscRenderCalendar` | social-group-details.js | fonksiyon exposure | aynı sebep |
| `_pgSetGoals` / `_pgSetDependencies` / `_pgSetPvReadOnlyPreview` | planning.js | setter | planning-*.js modülleri tüketir |
| `showGroupDetails`, `resetActiveGroupPanel`, `loadMyGroups`, `openGroupInviteModal`, `_isSupabaseGroupAdmin`, `_isInstitutionalAdmin`, `_pickNewOwner`, `computeActiveNowCount`, `dcRenderSessionStrip`, `groupAvatarHtml`, `renderClassroomTabCached`, `renderClassroomInsightsPanel`, `renderInstitutionalOverviewIntro`, `setWaitingState`, `syncXP`, `gscGetFocusingNow`, `gscGetWaitingNow` | social.js ↔ social-group-details.js | fonksiyon exposure (çift yönlü) | Faz 5 çıkarması — 15 köprü, detay aşağıda |
| `showDcDmLimitNotice` | social-dm-limit-notice.js | fonksiyon exposure | Faz 5, tek çağrı noktalı izole çıkarma |
| `getFriends`, `saveFriends`, `markFriendSince`, `sendFriendRequest`, `listenForFriendRequests`, `_startFriendsListenerSupabase`, `_startBlocksListenerSupabase`, `_resolveOrCreateConversation`, `_resolveProfileId`, `_syncFriendAcceptToSupabase`, `_syncFriendRemoveToSupabase`, `_handleCollabPlanInvite`, `_fetchNotifications` | social-friends-notifications.js | fonksiyon exposure (social.js kalanı tüketir) | Faz 5, arkadaşlık çekirdeği çıkarması |
| `renderNotificationsPanel`, `openNotificationsPanel` | social.js (henüz taşınmadı — leaderboard koduyla iç içe) | fonksiyon exposure | social-friends-notifications.js tüketir |
| `__getPendingFriendRequestsRef`, `__getNotificationsSupabaseRef`, `__getPendingDmRequestsSupabaseRef`, `__getReactionNotificationsRef`, `__getPendingDmRequestsRef`, `__getProfileIdByUsernameRef` | social-friends-notifications.js | getter | social.js kalanı (bildirim paneli render/kabul/red kodu) property-mutate ediyor |
| `__getDmRequestsInitialLoadDoneSupabaseRef`/`__setDmRequestsInitialLoadDoneSupabaseRef`, `__getFriendAcceptSupaChannelRef`/`__setFriendAcceptSupaChannelRef` | social-friends-notifications.js | getter+setter | social.js kalanı reassign ediyor |
| `renderNotificationsPanel`, `openNotificationsPanel` | social-friends-notifications.js | fonksiyon exposure | Faz 5, ikinci artırım (2246-2991) — leaderboard'dan ayrıştırıldı, `TEACHER_NOTIF_ACCENT` bug'ı burada bulunup düzeltildi (bkz. ders #7) |
| `TEACHER_NOTIF_ACCENT` | social-friends-notifications.js | sabit exposure | social.js'in kalan kodu (bu modüle henüz taşınmamışken) hâlâ kullanıyordu — ilk çıkarmada unutulmuş, ikinci artırımda bulundu |
| `listenForFriendAcceptances`, `removeFriend`, `searchUser`, `cleanOrphanedBuddyHabits` | social-friends-notifications.js | fonksiyon exposure | Faz 5, üçüncü artırım (2247-2519, "arkadaşlık yönetimi") — `cleanOrphanedBuddyHabits` `setTimeout(fn, ms)`'e REFERANS olarak veriliyordu (çağrı değil), `window.` önekiyle referans köprülendi |
| `window.FocusStorage`, `window.showPremiumModal` | storage-manager.js / script.js | zaten window-exposed | Üçüncü artırımda `Object.method()` biçimindeki bare nesne referansları (`FocusStorage.set(...)`) bulundu — ders #10 |
| `subscribeLeaderboard`, `renderLeaderboardFromCache` | social-friends-notifications.js | fonksiyon exposure | Faz 5, dördüncü (son) artırım (2248-2491, "Liderlik Tablosu") — arkadaşlık/bildirim kümesiyle aynı dosyada, `_refreshLeaderboardFromSupabase`/`renderMostImprovedBadge`/`computeRankDeltas`/`bindFriendsChangedListener`/`renderLeaderboard` dahil taşındı |
| `renderMyInstitutionModal`, `loadMyGroupsSupabase` | social-institution-panel.js | fonksiyon exposure | Faz 6 — Kurum/Sınıf Paneli (~4555 satır, ~55 kardeş fonksiyon; ÖNCEKİ analiz "tek dev fonksiyon" demişti, YANLIŞTI — gerçekte kendi kapsamında büyük ölçüde izole bir bölüm, ders #12 |
| `computeUserInterestCategoriesSupabase`, `renderDiscoverGroups` | social-group-discover.js | fonksiyon exposure | Faz 6 — Global Açık Grupları Keşfetme Motoru (~721 satır), Kurum Paneli'yle aynı anda ama AYRI dosyaya çıkarıldı, ikisi birbirine 4 noktadan çapraz bağımlı |
| `window.__setMyGroupsDataCacheRef` (getter zaten vardı) | social.js | setter | Kurum Paneli'nin `_myGroupsDataCache`'i reassign etmesi için |
| `window.GROUP_LIMITS`, `window.isGroupFull`, `window.joinGroupWithCodeSupabase`, `window._trWeekStart`, `window.generateGroupCode` | social.js | sabit/fonksiyon exposure | Faz 6 çıkarmasında bulunan 5 ek köprü ihtiyacı |
| `window.renderStatistics` | script-statistics.js | fonksiyon exposure | Faz 6 — script.js'in renderStatistics() çıkarması (~692 satır), salt-okunur, sadece getter köprüsü yeterliydi |
| `window.monthNames`, `window.monthNamesShort` | script.js | sabit exposure | script-statistics.js için yeni eklendi (önceden sadece script.js'in kendi closure'ında bare kullanılıyordu) |
| `STATUS_META`, `renderStatsCard`, `_goalComplete`, `_sparkle` | planning-misc-widgets.js | fonksiyon/sabit exposure | Faz 6 — 5 non-contiguous düşük-risk blok (Sabitler/GridView/StatsCard/Animasyonlar/Stubs) tek dosyada birleştirildi |
| `window.__getPgLoadedAtRef`/`__getPgRenderCountRef`/`__incPgRenderCountRef`, `window._pgGetGoals` (zaten vardı), `window.esc`/`uid`/`_recalcProgress` (zaten vardı), `window._wzGetLessonPlanGroups()` (zaten vardı), `window._deleteGoalWithUndo` (zaten vardı) | planning.js | getter/increment/zaten mevcut köprüler | GridView/StatsCard'ın planning.js çekirdeğine bağımlılıkları |
| `window.openDetailPanel`, `window.toggleArchive` | planning.js | fonksiyon exposure | Bu çıkarmada bulunan 2 ek köprü ihtiyacı |
| `window.SUBTASK_SUGGESTIONS` | planning-misc-widgets.js | sabit exposure | **Bugünkü işten ÖNCE var olan gerçek bug**: `planning-milestone-wizard.js` bunu bare kullanıyordu, tanım dosyası hep erişilemezdi — bu çıkarma sırasında fark edilip düzeltildi |
| `_pvRenderAssignmentStatus`, `openAssignModal` | planning-lesson-plan-assign.js | fonksiyon exposure | Faz 6 (Faz B) — "Sınıfa/Öğrenciye Ata" bölümü (1159-1630, ~472 satır), PlanView çekirdeğinden çağrılıyor. `window._wzGetLessonPlanGroups()` getter'ı bu blokla birlikte taşındı (tanım+getter aynı yerde). |
| `window.__getRenderBuddyHabitsRef`/`__getRenderCalendarRef`/`__getRenderEventsRef`/`__getRenderHabitsRef` | script.js | getter | Faz 6 (Faz B) — script-habit-sync.js için yeni eklendi, `__getRenderStatisticsRef` ile aynı desen (satır ~305 civarındaki ref değişkenleri) |
| `checkHabitMilestones`, `toggleHabitFromToday` | script-habit-sync.js | fonksiyon exposure | Faz 6 (Faz B) — geri kalanı zaten `window.X = function` deseniyle kendiliğinden dışa açıktı, sadece bu ikisinin dış çağrı noktaları köprülendi |
| `window.renderCalendar`, `window.renderEvents`, `window.addSmartTask` | script.js | fonksiyon exposure | Faz 6 (Faz B) — **kritik bulgu**: bunlar önceden HİÇ window'a atanmamıştı, script.js'in kendi closure'ında sadece fonksiyon hoisting'ine dayanan bare referanslardı; "Dönüştürme Modalı" çıkarmasında bulunup düzeltildi, aksi halde extraction sonrası sessizce no-op'a düşerlerdi |
| `window.__getMindDumpsRef`/`__setMindDumpsRef` (getter zaten vardı, setter yeni), `window.__getHabitCategoriesRef` (yeni) | script.js | getter/setter | script-convert-modal.js için — mindDumps hem okunuyor hem `filter()` sonucu reassign ediliyor |
| `window.editTask` (zaten `window.X = function` deseniyle vardı) | script-edit-task-modal.js | — | Faz 6 (Faz B) — Görev Düzenleme Modalı çıkarıldı; bir bare çağrı (script.js:1476, Day Drawer'ın "cdd-edit-task" aksiyonu) bulunup `window.editTask`'e çevrildi |
| `window.renderCalendar`, `window.renderEvents`, `window.initCalEventListDnD`, `window.getGoalColor`, `window.openDayDrawer` | script-calendar-month-view.js (ilk 3) / script.js (son 2, zaten çıkarılan modül için) | fonksiyon exposure | Faz 6 (Faz B) — Ay görünümü + Gün Detay Paneli çıkarması. **En yüksek dokunma sayılı çıkarma**: renderCalendar/renderEvents script.js'in geri kalanında 33+ yerden bare çağrılıyordu, hepsi `window.*`'a çevrildi (bkz. ders #13) |
| `window.__getCurrentDateRef`/`__setCurrentDateRef`, `window.__getSelectedDateRef`/`__setSelectedDateRef` | script.js | getter/setter | Faz 6 — currentDate/selectedDate hem bu blokta hem takvim navigasyonunda (prev/next/today) reassign ediliyor; DEKLARASYON script.js'te kaldı (sadece extraction hedefinin dışında da çok kullanıldığı için), bu yüzden bu ikisi için köprü GEREKMEDİ aslında — sadece extraction hedefinin KENDİ İÇİNDEKİ reassignment'lar için kuruldu |
| `window.renderWeeklyView`/`renderDailyView` (zaten vardı), `window.createCalDragGhost`/`openCalInlineAdd` (yeni), `window.CAL_HOUR_START`/`CAL_HOUR_END`/`DAY_NAMES_LOCAL`/`PRIORITY_DOT_COLOR` (yeni), `window.switchCalView`/`updateCalUnifiedTitle` (yeni) | script-calendar-week-day-view.js (ilk 4) / script.js (son 6, tanım orada kaldı) | fonksiyon/sabit exposure | Faz 6 (Faz B) — Haftalık+Günlük Görünüm TEK dosyada birleştirilerek çıkarıldı (paylaşılan yardımcılar iç içeydi). `GAP` sabiti bu blokta tanımlıydı — collab.js/social.js'in ÖNCEDEN VAR OLAN backlog bug'ı (bare `GAP` referansı) konumu değişti, düzeltilmedi |
| `window.__setTasksRef` | script.js | setter — **İLK KEZ `tasks` için** | Faz 6 (Faz B), Plan Sihirbazı çıkarması — sihirbazın "Bitir"/"İptal" akışları `tasks = tasks.filter(...)` ile TAM reassignment yapıyordu. `tasks` bugüne kadar hep salt-okunur (getter-only) kabul edilmişti; yeni bir extraction `tasks` reassignment'ı gerektirirse AYNI setter'ı kullansın, yeni bir tane icat etmesin (bkz. script-plan-wizard.js başlığındaki not) |
| — (ölü kod silindi) | script.js | — | **Faz 6, gerçek bulgu**: `window.renderCalMindDump`'ın script.js'teki eski sürümü ÖLÜ KODMUŞ — `script-mind-dump-drawer.js` (script.js'ten SONRA yüklenip) aynı `window.renderCalMindDump`'ı eziyordu, bu zaten o dosyanın kendi yorumunda belgeliydi ("eski/yedek"). Tanımsız `calMindDumpList`/`Store` bare referansları da bunu doğruluyordu (hiç çalışmamış olurdu). Güvenle silindi. |
| `window.addGlobalTask`/`hasTimeConflict`/`showPremiumModal` (zaten vardı) | script-mind-dump-calendar-bridge.js | — | Faz 6 — `convertDumpToTaskForDate`/`findFirstAvailableSlot` çıkarıldı (script-calendar-dragdrop.js tarafından çağrılıyor), `window.__setMindDumpsRef` ile `mindDumps` reassignment'ı köprülendi. **script.js'in modülerleştirme fazı TAMAMLANDI** (2026-07-20): 9.478 → 6.652 satır (%29,8 azalma). |

Bu liste TAM değil (kod tabanında muhtemelen başka `window.*` atamaları da
var) — `grep -rn "window\.\w\+\s*=" *.js` ile güncel tam listeyi
çıkarabilirsiniz. Yeni bir köprü eklediğinizde bu tabloya satır ekleyin.

## 2b. Merkezi state store deseni (`state/*.js`) — YENİ TERCİH EDİLEN YÖNTEM

Faz V'de (2026-07-29) `__getXRef`/`__setXRef` çift-köprü deseninin yerini
alacak daha temiz bir alternatif tanıtıldı: `state/` klasöründe, HER paylaşılan
mutable değer için kendi dosyası olan minik bir store modülü.

```js
// state/example-store.js
export function getExample() { return window._example || null; }
export function setExample(v) { window._example = v; return v; }
window.getExample = getExample; // geriye dönük window.* okuyucular için (opsiyonel)
```

Sahibi dosya `setExample(...)` ile yazar, tüketiciler `import { getExample }
from './state/example-store.js'` ile okur — hem sahip hem tüketici GERÇEK
`import`/`export` üzerinden bağlanır, `window.X` sadece store'un İÇİNDE
implementasyon detayı olarak kalır (dışarıya sızmaz). Bu, `__getXRef` deseninin
iki farkı: (1) tek bir merkezi dosya, N farklı sahibin kendi ad-hoc getter'ını
icat etmesi yerine; (2) `onXChange(fn)` gibi bir subscribe API'si eklenebilir
(bkz. `current-user-store.js`/`active-chat-target-store.js`), ki `__getXRef`
deseninde yok.

**Kurulmuş 18 store (bu oturum itibarıyla):**
`current-user-store.js`, `active-chat-target-store.js`, `dc-state-store.js`,
`dc-entered-room-key-store.js`, `dc-entered-room-id-store.js`,
`dc-global-msg-cache-store.js`, `dc-current-group-scope-store.js`,
`hushed-notif-queue-store.js`, `last-avatar-click-store.js`,
`my-server-xp-store.js`, `my-league-state-store.js`, `my-season-state-store.js`,
`online-friends-presence-cb-store.js`, `active-reaction-picker-store.js`,
`pending-classroom-subtab-store.js`, `dc-restore-pending-store.js`,
`gm-members-channel-store.js`, `gm-custom-roles-channel-store.js`.

**Kritik ders (2 kez tekrarlanan bug):** Otomatik/elle geçiş sırasında bir
dosyaya `setX(...)` çağrısı eklenip import satırına SADECE `getX` konursa (ya
da tam tersi), bu **`npm run build`'da YAKALANMAZ** — syntax hatası değil,
çalışma-zamanı `ReferenceError`'ı olur (Vite/Rollup import-graph analizi
sadece gerçekten `import` edilen isimleri kontrol eder, dosya içinde
KULLANILAN ama import edilmemiş bare isimleri değil). Her migrasyon turunun
sonunda şu doğrulama mutlaka çalıştırılmalı:

```python
# Her dosyada: kullanılan get*/set* fonksiyon adları ile
# "from './state/...'" import bloklarındaki adları karşılaştır, farkı bul.
```

Yeni bir cross-file mutable state ekleniyorsa (ör. iki dosya arasında
paylaşılan bir sayaç/önbellek/flag), `__getXRef` yerine bu deseni kullanın.

## 3. Modülerleştirme sırasında ÖĞRENİLEN DERSLER (Faz 2 + Faz 5)

1. **Manuel/ajan bazlı bağımlılık taraması TEK BAŞINA GÜVENİLMEZ.** Faz 5'te
   (social-group-details.js çıkarması) iki ayrı Explore ajanının taraması
   gerçek bağımlılıkların sadece bir kısmını buldu; kalan 12/15 köprü ancak
   sistematik bir script ile ortaya çıktı. **Her yeni çıkarmadan önce ve
   sonra `python3 scripts/check-cross-module-deps.py` çalıştırın.**
2. **`typeof X === 'function'` guard'lı bare çağrılar SESSİZ regresyona
   dönüşebilir.** X'i tanımlayan dosya taşınırsa, guard hata fırlatmaz —
   sadece sessizce no-op'a düşer (ör. `gscSessionsCache` presence senkronu,
   modülleşme öncesi `undefined` kontrolüyle "korunuyormuş" gibi görünüyordu
   ama gerçekte modülleşme sonrası davranışı sessizce bozacaktı). ÖNEMLİ:
   `check-cross-module-deps.py` sadece `X(...)` ÇAĞRI kalıbını arar,
   `typeof X === 'function'` GUARD kalıbını YAKALAMAZ — arkadaşlık kümesi
   çıkarmasında (`social-friends-notifications.js`) script'in kaçırdığı 3
   guard (`getFriends`, `sendFriendRequest`, `_fetchNotifications`) elle
   `grep -n "typeof İSIM"` ile bulundu. Her çıkarmadan sonra taşınan her isim
   için bu grep'i AYRICA çalıştırın.
3. **Hoisting'e dayanan bağımlılıklar extraction'da kırılır.** Bir fonksiyon
   dosyanın SONRAKİ bir satırında tanımlı bir isme (fonksiyon hoisting
   sayesinde) güveniyorsa, bu bağımlılık extraction'da AYRICA kontrol
   edilmeli (bkz. `_isSupabaseGroupAdmin` örneği, Faz 5).
4. **ES modülde duplicate top-level function declaration SyntaxError verir**
   — script bağlamında sessizce çalışan eski/ölü duplicate tanımlar modül
   ayrımında patlar. Her çıkarmadan önce
   `grep -oE '^function [A-Za-z_$]+' dosya.js | sort | uniq -c | sort -rn`.
5. **`inline-*.js` ile isim çakışması riski.** Bazı fonksiyonlar (ör.
   `openGoalModal`/`closeGoalModal`) BİLİNÇLİ OLARAK window'a export
   edilmiyor çünkü `inline-*.js` aynı isimle bir fallback tanımlıyor. Yeni
   bir fonksiyon çıkarırken `grep -rn "fonksiyonAdı" inline-*.js index.html`.
6. **Paylaşılan mutable state'in gerçek sahibi metinsel konumdan farklı
   olabilir.** Faz 5'te "showGroupDetails'in içindeki state" sanılan
   değişkenlerin çoğu aslında dosyanın ÇOK ÖNCESİNDE (satır 8406 gibi)
   tanımlıydı, hem extraction hedefinin İÇİNDE hem DIŞINDA kullanılıyordu.
7. **Bölüm başlıkları içerik sınırını GÜVENİLİR şekilde işaretlemez —
   iki kez doğrulandı.** GSC'de olduğu gibi, "LİDERLİK TABLOSU" başlığının
   hemen altında ~1000 satır boyunca aslında leaderboard değil bildirim
   paneli kodu vardı (gerçek leaderboard çok sonra başlıyordu). Satır
   aralığını ASLA sadece yorum başlığına bakarak belirlemeyin — fonksiyon
   tanımlarını (`function X(...)`) tek tek bulup gerçek sınırı doğrulayın.
8. **SABİT (UPPER_CASE) değer referansları hem `bare_calls()` hem `typeof`
   taramasından KAÇAR** — ne çağrı (`X(`) ne guard (`typeof X`) kalıbına
   uyar, sadece `accent: X` gibi düz bir referanstır. Bu, `TEACHER_NOTIF_ACCENT`
   bug'ının kaynağıydı (bir çıkarmada sabitin TANIMI taşındı ama KULLANIMI
   social.js'te kaldı → ReferenceError). `check-cross-module-deps.py` artık
   bunu da tarıyor (`bare_const_refs`) ama SADECE tam büyük harfli isimler
   için — küçük/karışık harfli paylaşılan sabitler hâlâ kör nokta.
9. **Bir extraction'ın "önce"/"sonra" segmentlerini AYRI AYRI işlerken
   ikisini de kapsadığınızdan emin olun.** `social-friends-notifications.js`
   çıkarmasında bloktan ÖNCEKİ segmentteki bir kullanım (`_profileIdByUsername`,
   satır ~931) ilk geçişte atlandı çünkü dönüştürme script'i sadece "sonra"
   segmentini taradı — extraction sonrası TÜM dosyada (önce+sonra) taşınan her
   isim için ayrıca `grep` ile son bir tarama yapın.
10. **`Object.method()` biçimindeki bare nesne referansları `X(` çağrı
    kalıbına UYMAZ, dolayısıyla `conv_call`/`bare_calls()` regex'i bunu
    YAKALAMAZ.** `FocusStorage.set(...)`/`FocusStorage.get(...)` gibi
    kullanımlar taşınan blokta bare kaldı çünkü isim hemen ardından `(` değil
    `.` ile devam ediyordu. Bir nesne ismi taşınıyorsa/köprüleniyorsa, SADECE
    çağrı kalıbını değil ismin TÜM bare geçişlerini (`(?<![.\w$])İSIM\b`)
    dönüştürün.
11. **"LİDERLİK TABLOSU" başlığı altındaki gerçek küme sınırları:** bildirim
    paneli (2246-2991) ve leaderboard (gerçek başlangıç `subscribeLeaderboard`)
    arasında üçüncü, bağımsız bir "arkadaşlık yönetimi" kümesi vardı
    (`listenForFriendAcceptances`/`addFriend`/`showUnfriendConfirm`/
    `performUnfriendCleanup`/`cleanBuddyHabitsLocally`/`removeFriend`/
    `cleanOrphanedBuddyHabits`/`searchUser`) — üçü de artık
    `social-friends-notifications.js`'te. Leaderboard kümesi de (dördüncü
    artırım) aynı dosyaya taşındı — "arkadaşlık + bildirim + leaderboard"
    kümesi TAMAMLANDI (2026-07-20).
12. **Bir "bölüm" olarak işaretlenen büyük satır aralığı, gerçekte TEK DEV
    FONKSİYON olmayabilir.** Önceki bir yapısal analiz "Kurum/Sınıf Paneli"ni
    (6095-11373, ~5275 satır) `renderMyInstitutionModal` adlı tek bir
    fonksiyon sanmıştı. Gerçek brace-eşleştirme (bkz. aşağıdaki not) bu
    fonksiyonun sadece ~165 satır olduğunu, geri kalanının ~55 KARDEŞ
    fonksiyondan oluştuğunu gösterdi — çok daha kolay bir çıkarma oldu.
    **Naif satır-bazlı `{`/`}` sayımı STRING/TEMPLATE LITERAL içindeki
    parantezleri de sayar, YANLIŞ sonuç verir** — `check-innerhtml.py`'deki
    tokenizer mantığı (string/template/yorum atlama) yeniden kullanılarak
    doğru kapanış noktası bulundu. Ayrıca aynı aralıkta İKİ AYRI özellik
    (Kurum Paneli + Grupları Keşfet) iç içe olduğu sanılırken aslında TEMİZ
    ayrık olduğu (10651'de net kesim) ama son satırdaki `});`'nin bu iki
    kümenin HİÇBİRİNE ait olmayıp çok daha önce açılmış dış bir wrapper'a
    ait olduğu (brace dengesi ile doğrulandı) ortaya çıktı — kesim noktasını
    1 satır erken (11372) almak gerekti.
13. **Bir fonksiyon script.js'in kendi İÇİNDE 20-30+ yerden bare çağrılıyorsa,
    "sadece extraction hedefinin dışına bakma" yeterli değil — dosyanın
    TAMAMINI (extraction hedefinden SONRAKİ binlerce satır dahil) tarayın.**
    `renderCalendar`/`renderEvents` çıkarmasında ilk "blok dışı kullanım"
    taraması bunları doğru buldu ama gerçek dış çağrı sayısı (33+) script.js'in
    çok uzak bölgelerine (takvim navigasyonu, wizard, event listener'lar)
    yayılmıştı. `grep -c "\bFONKSIYON(" dosya.js` ile TOPLAM çağrı sayısını
    önceden tahmin edin — 1-4 ise hızlı, 10+ ise "yüksek dokunma sayılı,
    zaman ayırın" sinyali.

## 3b. CSS modülerleştirmesi (Faz 6, style.css)

`style.css` (33.362 satır) hiç bölünmemişti. JS'ten FARKLI risk modeli: paylaşılan
state/closure yok, ama SELECTOR TEKRARI ve YÜKLEME SIRASI (cascade) kritik — aynı
selector birden fazla yerde tanımlıysa SONRAKİ (source-order'da geç gelen) kazanır.

**Çıkarılanlar (2026-07-20):**
- `tokens.css` (36 satır) — `@import` + `:root` design token'ları. **HER ZAMAN ilk
  yüklenmeli**, 1.636 `var()` kullanımı buna bağımlı.
- `onboarding-tour.css` (242 satır) — sadece `.tour-*` önekli kurallar (satır
  4518-4759). ÖNEMLİ: `.tour-tooltip` için satır ~19077'de `!important`'lı bir
  override HÂLÂ `style.css`'te duruyor (bilinçli olarak taşınmadı) — override,
  taşınan taban tanımdan SONRA yüklenmeye devam ediyor (style.css, onboarding-tour.css'ten
  sonra linklendiği için cascade sırası korunuyor).
- `help-center.css` (35 satır), `timer-profiles.css` (137 satır) — dosya sonundan,
  net sınırlı, çakışma yok.
- `a11y-reduced-motion.css` (13 satır) — `prefers-reduced-motion` override'ı,
  **tüm CSS dosyalarından SONRA** linklenmeli (index.html'de en son sırada).

**Yükleme sırası (index.html, `<head>` içinde):** `tokens.css` → `onboarding-tour.css`
→ `style.css` → `help-center.css` → `timer-profiles.css` → `a11y-reduced-motion.css`.

**Bilinçli olarak ATLANAN aday:** `.cp-roster-*` (Sınıf/Ekip Paneli Roster) —
ilk analiz bunu izole sanmıştı ama gerçekte `.cp-subtab-btn, .cp-roster-innertab-btn,
.cp-asg-innertab-btn, .cp-perf-filter-btn, .cp-list-filter-btn { ... }` gibi
BİRLEŞİK selector listelerinde diğer Kurum Paneli alt-sistemleriyle (assignment,
performance) iç içe — ayırmak riskli, dokunulmadı.

**Kalan (henüz taranmamış):** Wizard (~30110-30504), Collab Live (~31114-31364),
Mini Profil Popup (~31547-31815), Arena/Meydan Okuma (~31721-31873) — Faz A
listesinde ama bu oturumda işlenmedi. Ayrıca dosyanın ~%70'i (satır ~6480-30020)
hâlâ haritalanmamış.

**CSS extraction dersi:** Bir "bölüm" olduğu düşünülen satır aralığı içinde
FARKLI, ilgisiz özelliklere ait küçük bloklar (undo-toast, spotlight-quick-add-modal
gibi) serpiştirilmiş olabilir — JS'teki "başlık yanıltıcı" dersiyle aynı, CSS'te de
geçerli. Sadece net bir CSS class ÖNEKİYLE (`.tour-`, `.help-`, `.timer-profile-`)
eşleşen satırları çıkarın, aradaki "bezer ama farklı" bloklara güvenmeyin.

## 4. Bilinçli olarak modülerleştirilmeyen çekirdek kümeler

Şu kümeler kasıtlı olarak tek dosyada bırakıldı — kazanç/risk oranı kötü,
tekrar gündeme getirmeyin (kullanıcı özellikle istemedikçe):

- **script.js**: görev render+CRUD çekirdeği, takvim (ay/hafta/gün +
  sürükle-bırak, ~4100 satır), alışkanlık takibi çekirdeği.
- **planning.js**: Hedef/Aşama çekirdek CRUD+render, PlanView (çakışma
  çözümü sistemiyle iç içe, ~2800 satır).
- **social.js**: sohbet çekirdeği + Grup&Kanal Navigasyon Motoru (~6400
  satır, state konsolidasyonu gerektirir), arkadaşlık sistemi + bildirimler
  (henüz taranmadı, muhtemelen yüksek risk).

## 5. Araçlar

- `scripts/check-innerhtml.py` + `scripts/innerhtml-baseline.txt` +
  `.git/hooks/pre-commit` (gate: `scripts/check-innerhtml-gate.py`) — XSS
  (escape edilmemiş innerHTML) denetimi. Yeni bir dosya oluşturunca
  `check-innerhtml.py`'nin `main()` içindeki dosya listesine ekleyin.
- `scripts/check-cross-module-deps.py` — çapraz-modül köprü denetimi (bkz.
  yukarıdaki ders #1). Kurulum gerektirmez (sadece `python3`). Şu an
  pre-commit hook'a BAĞLI DEĞİL (yanlış pozitif oranı XSS taramasından daha
  yüksek, otomatik gate için önce daha fazla olgunlaştırılmalı) — elle
  çalıştırın: her modülerleştirme çıkarmasından önce ve sonra.
