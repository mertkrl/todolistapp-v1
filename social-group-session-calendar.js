// social-group-session-calendar.js
// social-group-details.js'ten çıkarıldı (Faz I): Grup Odak Seansı Takvimi (GSC)
// alt-sistemi — hafta görünümü, gün detayı, seans oluşturma/düzenleme, bekleme
// odası, aktivite akışı, geçmiş, izin/UI uygulaması ve kişisel başarılar.
//
// Bu modül showGroupDetails() (social-group-details.js) tarafından
// initGroupSessionCalendar/_computeGroupAchievements çağrılarıyla ve
// getGscSessionsCache/getGscGroupKey/gscResetState köprüleriyle kullanılıyor.
// social.js ise window.__getGscSessionsCacheRef / window.gscRenderCalendar
// köprülerini (bu dosyanın en altında tanımlı) kullanmaya devam ediyor.

    // ══════════════════════════════════════════════════════════
    //  GRUP ODAK SEANSİ TAKVİMİ
    // ══════════════════════════════════════════════════════════

    let gscGroupKey = null;
    let gscSupaGroupId = null;   // Supabase group UUID (null = Firebase fallback)
    let _gscSupaChannel = null;
    let gscWeekOffset = 0;   // 0 = bu hafta, -1 = geçen hafta, +1 = gelecek hafta
    let gscSessionsCache = {};
    let gscIsInstitutional = false;
    let gscUnsubscribe = null;
    let gscSelectedDay = null; // seçili günün date-key'i (alt detay paneli için)
    let gscCanManageSessions = false; // grup yetki sistemine bağlı: seans ekleme/düzenleme iznin var mı
    let gscPresenceHandler = null; // "kim şu an odaklanıyor" göstergesini canlı tutan presence dinleyicisi

    const GSC_DAYS_TR = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

    function gscGetWeekDates(offset) {
        const now = new Date();
        const day = now.getDay(); // 0=Sun
        const mondayDiff = (day === 0 ? -6 : 1 - day);
        const monday = new Date(now);
        monday.setDate(now.getDate() + mondayDiff + offset * 7);
        monday.setHours(0, 0, 0, 0);
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            return d;
        });
    }

    function gscDateKey(date) {
        // ÖNEMLİ: toISOString() UTC'ye çevirir — UTC+3 gibi dilimlerde gece saatlerinde
        // tarih bir gün kayabilirdi (örn. 23:30 yerel saat → ertesi gün UTC). Yerel
        // tarih bileşenlerini kullanmak bu kaymayı önler.
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function gscIsToday(date) {
        return gscDateKey(date) === gscDateKey(new Date());
    }

    // "HH:MM" + dakika → "HH:MM" (gün içinde sarmalanır, sadece varsayılan bitiş saati önerisi için)
    function gscAddMinutes(timeStr, mins) {
        const [h, m] = (timeStr || '00:00').split(':').map(Number);
        const total = (h * 60 + m + mins + 1440) % 1440;
        return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
    }

    // İki "HH:MM" arasındaki farkı dakika olarak döner (bitiş başlangıçtan önceyse negatif/0)
    function gscMinutesBetween(startStr, endStr) {
        const [sh, sm] = (startStr || '00:00').split(':').map(Number);
        const [eh, em] = (endStr || '00:00').split(':').map(Number);
        return (eh * 60 + em) - (sh * 60 + sm);
    }

    // Verilen tarih + saat aralığı, o güne ait mevcut seanslardan biriyle çakışıyor mu?
    // excludeKey: düzenleme akışında kendisini hariç tutmak için.
    function gscFindOverlap(dateKey, startStr, endStr, excludeKey) {
        const [sh, sm] = startStr.split(':').map(Number);
        const newStart = sh * 60 + sm;
        const newEnd = newStart + gscMinutesBetween(startStr, endStr);
        return Object.entries(gscSessionsCache).find(([key, s]) => {
            if (key === excludeKey || s.date !== dateKey || !s.time) return false;
            const [oh, om] = s.time.split(':').map(Number);
            const existingStart = oh * 60 + om;
            const existingEnd = existingStart + (s.duration || 60);
            return newStart < existingEnd && existingStart < newEnd;
        });
    }

    // Bir grup seansına RSVP vermeden önce, o saat aralığında kullanıcının KİŞİSEL takviminde
    // (Takvim sekmesindeki görevler) çakışan bir planı olup olmadığını sorar. script.js'teki
    // window.getPersonalScheduleConflict köprüsünü kullanır; "dd-mm-yyyy" formatı bekler.
    function gscPersonalConflict(dateKey, startStr, endStr) {
        if (typeof window.getPersonalScheduleConflict !== 'function') return null;
        const [y, m, d] = dateKey.split('-');
        const ddmmyyyy = `${d}-${m}-${y}`;
        const toMins = (t) => { const [h, mi] = (t || '00:00').split(':').map(Number); return h * 60 + mi; };
        return window.getPersonalScheduleConflict(ddmmyyyy, toMins(startStr), toMins(endStr));
    }

    // Seans süresi ve bir güne planlanabilecek seans sayısı için üst/alt sınırlar —
    // takvimin tek bir günde sınırsız büyüyüp kullanışsız hâle gelmesini önler.
    const GSC_MIN_DURATION_MIN = 10;
    const GSC_MAX_DURATION_MIN = 480; // 8 saat
    const GSC_MAX_SESSIONS_PER_DAY = 6;

    function gscCountSessionsOnDate(dateKey, excludeKey) {
        return Object.entries(gscSessionsCache).filter(([key, s]) => key !== excludeKey && s.date === dateKey).length;
    }

    // "Geçti" = seans gerçekten bitti (başlangıç + süre < şu an). Sadece başlama anına değil,
    // bitiş anına bakar — böylece seans sürerken hâlâ "devam ediyor" sayılır, "Tamamlandı" ve
    // ilgili butonlar yalnızca seans gerçekten bittiğinde devreye girer.
    function gscIsPast(s) {
        const start = gscSessionStartDate(s).getTime();
        const end = start + (s.duration || 60) * 60000;
        return end < Date.now();
    }

    // Bir seans için "Odaklanma" başlatma butonunun gösterilip gösterilmeyeceğini belirler:
    // başlamadan GSC_REMINDER_LEAD_MIN dakika önce belirir, seans bitince kaybolur.
    function gscCanFocusNow(s) {
        if (!currentUser || !(s.attendees && s.attendees[currentUser.username])) return false;
        const start = gscSessionStartDate(s).getTime();
        const now = Date.now();
        if (now < start - GSC_REMINDER_LEAD_MIN * 60000) return false;
        return !gscIsPast(s);
    }

    function gscSessionStartDate(s) {
        const [h, m] = (s.time || '00:00').split(':').map(Number);
        const dt = new Date((s.date || '') + 'T00:00:00');
        dt.setHours(h, m, 0, 0);
        return dt;
    }

    // Seans hâlâ kapsamdaysa (henüz bitmemişse) Zamanlayıcı'ya aktarılacak dakikayı hesaplar —
    // tam süresinden değil, "şu an"dan seansın bitişine kalan süreden, böylece geç katılan biri
    // planlanandan fazla odaklanma süresi kazanmış olmaz.
    function gscRemainingFocusMinutes(s) {
        const start = gscSessionStartDate(s).getTime();
        const end = start + (s.duration || 60) * 60000;
        const remainingMs = end - Date.now();
        return Math.max(1, Math.round(remainingMs / 60000));
    }

    // Kullanıcı bir seansa "Şimdi Başla"ya bastığında/tıkladığında çağrılır: seans zaten
    // 'live' ise (yetkili başlattı) doğrudan Zamanlayıcı'ya katılır; hâlâ 'scheduled' ise
    // doğrudan başlamaz, bekleme odasına alınır — çünkü başlatma yetkisi artık yalnızca
    // seans sahibi/yöneticide.
    function gscJoinOrWaitForSession(sessionId, s) {
        if (s && s.status === 'live') { gscStartFocusForSession(sessionId, s); return; }
        gscOpenWaitingRoom(sessionId, s);
    }

    // "Şimdi Başla" → check-in + Zamanlayıcı'yı seansın kalan süresiyle otomatik kurup başlatır,
    // sonra Zamanlayıcı sekmesine geçer. Bu, grup takvimini gerçek odaklanma sistemine bağlar.
    // Yalnızca seans zaten 'live' olduğunda (yetkili başlattı) çağrılmalı — bkz. gscJoinOrWaitForSession.
    function gscStartFocusForSession(sessionId, s) {
        gscCheckIn(sessionId);
        const minutes = gscRemainingFocusMinutes(s);
        const started = typeof window.startGroupFocusSession === 'function' && window.startGroupFocusSession(minutes, sessionId);
        if (typeof window.switchTab === 'function') window.switchTab('zamanlayici');
        if (!started && typeof showGenericNotifToast === 'function') {
            showGenericNotifToast({ icon: 'fa-triangle-exclamation', accent: '#ff4757', title: 'Zamanlayıcı başlatılamadı', body: 'Süreyi elle ayarlayıp başlatabilirsin.' });
        }
    }

    // "Şimdi Başla" gerçekten tıklandığında bu seans için check-in işaretler —
    // RSVP niyetiyle gerçek katılımı ayırt edip "Katılım Oranı" istatistiğini besler.
    function gscCheckIn(sessionId) {
        if (!window.FocusSupabase || !currentUser?.id) return;
        window.FocusSupabase.from('group_session_attendees')
            .update({ checked_in_at: new Date().toISOString() })
            .eq('session_id', sessionId)
            .eq('user_id', currentUser.id)
            .then(({ error }) => { if (error) console.warn('[GSC] check-in hatası:', error.message); });
    }

    // ── RSVP → BEKLEME ODASI → ZAMANLAYICI köprüsü ──
    // "Varım" dediğin bir seans başlamak üzereyken otomatik olarak bekleme odasına alınırsın.
    // Yetkili (seans sahibi/yönetici) oturumu başlatana kadar herkes orada bekler; başlarsa
    // herkesin Zamanlayıcı'sı eşzamanlı kurulur, planlanan saatten belli bir süre sonra hâlâ
    // başlatılmadıysa seans otomatik iptal olur.
    let gscReminderInterval = null;
    const GSC_REMINDER_LEAD_MIN = 10; // "Odaklan" butonu / eski hatırlatma penceresi
    const GSC_REMINDER_GRACE_MIN = 3;
    const GSC_WAITING_LEAD_MIN = 15;   // seanstan kaç dakika önce bekleme odası otomatik açılır
    const GSC_AUTOCANCEL_MIN = 10;     // planlanan saatten kaç dakika sonra hâlâ başlamadıysa iptal edilir

    let gscActiveWaitingSessionId = null; // şu an açık olan bekleme odası modalının seansı

    function gscCheckUpcomingReminders() {
        if (!currentUser) return;
        const now = Date.now();
        for (const [sessionId, s] of Object.entries(gscSessionsCache)) {
            const isMine = s.attendees && s.attendees[currentUser.username];
            if (!isMine) continue;

            const startMs = gscSessionStartDate(s).getTime();
            const minutesUntil = (startMs - now) / 60000;

            // Bekleme odasını otomatik aç (T-15) — sadece hâlâ 'scheduled' olan seanslar için.
            if (s.status === 'scheduled' && minutesUntil <= GSC_WAITING_LEAD_MIN && minutesUntil > -GSC_AUTOCANCEL_MIN) {
                const openedKey = `focusai_gsc_waiting_opened_${sessionId}`;
                if (!localStorage.getItem(openedKey)) {
                    localStorage.setItem(openedKey, '1');
                    gscOpenWaitingRoom(sessionId, s);
                }
            }

            // Yetkili planlanan saatten GSC_AUTOCANCEL_MIN dk sonrasına kadar başlatmadıysa
            // otomatik iptal et. Guard (status='scheduled' koşulu) sayesinde birden fazla
            // client aynı anda denese de yalnızca ilk update etkili olur.
            if (s.status === 'scheduled' && minutesUntil <= -GSC_AUTOCANCEL_MIN) {
                gscAutoCancelSession(sessionId);
                continue;
            }

            // Eski davranış: seans yaklaşınca/başlayınca tıkla-git hatırlatma toast'ı — artık
            // bekleme odasına yönlendiriyor (doğrudan Zamanlayıcı başlatmıyor), çünkü başlatma
            // yetkisi artık yalnızca yetkili kişide.
            if (minutesUntil > GSC_REMINDER_LEAD_MIN || minutesUntil < -GSC_REMINDER_GRACE_MIN) continue;
            const dedupeKey = `focusai_gsc_reminder_${sessionId}`;
            if (localStorage.getItem(dedupeKey)) continue;
            localStorage.setItem(dedupeKey, '1');

            const startingNow = minutesUntil <= 0;
            if (typeof showGenericNotifToast === 'function') {
                playNotificationSound('alert');
                showGenericNotifToast({
                    icon: 'fa-stopwatch', accent: '#2ed573',
                    title: startingNow ? 'Seansın Başladı! ⏱️' : `Seansın ${Math.max(Math.round(minutesUntil), 1)} dk Sonra Başlıyor`,
                    body: `<b>${_escapeHtml(s.title || 'Seans')}</b> — bekleme odasına git, yetkili başlatınca herkesle birlikte odaklanmaya başla.`,
                    onClick: () => gscOpenWaitingRoom(sessionId, s)
                });
            }
        }
    }

    // Planlanan saatten GSC_AUTOCANCEL_MIN dk sonrasına kadar yetkili başlatmadıysa seansı
    // iptal eder. `status='scheduled'` guard'ı sayesinde birden fazla client aynı anda çağırsa
    // bile sadece ilki etkili olur (diğerleri 0 satır güncelleyip no-op olarak biter).
    let gscAutoCancelAttempted = new Set();
    async function gscAutoCancelSession(sessionId) {
        if (!window.FocusSupabase || gscAutoCancelAttempted.has(sessionId)) return;
        gscAutoCancelAttempted.add(sessionId);
        await window.FocusSupabase.from('group_sessions')
            .update({ status: 'cancelled' })
            .eq('id', sessionId)
            .eq('status', 'scheduled');
        // Sonuç postgres_changes ile zaten tüm client'lara yayılacak (debouncedRefresh →
        // gscReconcileWaitingRooms), burada ekstra bir şey yapmaya gerek yok.
    }

    // Bekleme odası açıkken/açıldıktan sonra en güncel seans durumuna göre modalı senkronlar:
    // 'live' → herkesin Zamanlayıcısı eşzamanlı başlar, 'cancelled' → modal kapanır + toast.
    // Her refresh() sonunda (postgres_changes ile ~800ms debounce) çağrılır.
    function gscReconcileWaitingRooms() {
        if (!gscActiveWaitingSessionId) return;
        const sessionId = gscActiveWaitingSessionId;
        const s = gscSessionsCache[sessionId];
        if (!s) { gscCloseWaitingRoom(); return; }

        if (s.status === 'live') {
            gscCloseWaitingRoom();
            gscStartFocusForSession(sessionId, s);
        } else if (s.status === 'cancelled') {
            gscCloseWaitingRoom();
            if (typeof showGenericNotifToast === 'function') {
                showGenericNotifToast({
                    icon: 'fa-calendar-xmark', accent: '#ff4757',
                    title: 'Seans İptal Edildi',
                    body: `<b>${_escapeHtml(s.title || 'Seans')}</b> yetkili tarafından zamanında başlatılmadığı için iptal edildi.`
                });
            }
        } else {
            gscRenderWaitingRoom(sessionId, s);
        }
    }

    // Bekleme odasını açar: check-in yazar, presence'ı işaretler, modalı render eder.
    // Zaten açıksa (aynı ya da başka bir seans için) tekrar açmaz/üzerine yazmaz.
    function gscOpenWaitingRoom(sessionId, s) {
        if (!s || s.status !== 'scheduled' || gscIsPast(s)) return;
        if (gscActiveWaitingSessionId === sessionId) { gscRenderWaitingRoom(sessionId, s); return; }
        gscCheckIn(sessionId);
        gscActiveWaitingSessionId = sessionId;
        window.setWaitingState(sessionId);
        gscRenderWaitingRoom(sessionId, s);
    }

    function gscCloseWaitingRoom() {
        if (!gscActiveWaitingSessionId) return;
        gscActiveWaitingSessionId = null;
        window.setWaitingState(null);
        document.getElementById('gsc-waiting-modal')?.remove();
    }

    // Bekleme odası modalını (mevcut .gsc-modal-overlay/.gsc-modal-box desenini, bkz.
    // gscOpenDetailModal, kullanarak) oluşturur/günceller: başlık, kalan-iptal-süresi,
    // bekleyenler listesi, yetkiliyse "Oturumu Başlat" butonu. gscReconcileWaitingRooms
    // tarafından periyodik (her realtime tazelemede) yeniden çağrılır.
    function gscRenderWaitingRoom(sessionId, s) {
        let overlay = document.getElementById('gsc-waiting-modal');
        const isFirstRender = !overlay;
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'gsc-waiting-modal';
            overlay.className = 'gsc-modal-overlay';
            document.body.appendChild(overlay);
        }

        const startMs = gscSessionStartDate(s).getTime();
        const cancelAt = startMs + GSC_AUTOCANCEL_MIN * 60000;
        const minsLeft = Math.max(0, Math.round((cancelAt - Date.now()) / 60000));
        const subTxt = Date.now() < startMs
            ? 'Seans yakında başlıyor. Yetkili başlatınca otomatik katılacaksın.'
            : `Yetkili henüz başlatmadı — ${minsLeft} dk içinde başlamazsa seans iptal olur.`;

        const isAuthorized = !!currentUser && (s.createdByUserId === currentUser.id || gscCanManageSessions);
        const waiting = window.gscGetWaitingNow(sessionId);
        const listHtml = waiting.length
            ? waiting.map(m => `<span class="gsc-waiting-chip">${_escapeHtml(m.displayName || m.username || 'Katılımcı')}</span>`).join('')
            : '<span class="gsc-waiting-empty">Henüz kimse bekleme odasında değil.</span>';

        overlay.innerHTML = `
            <div class="gsc-modal-box">
                <p class="gsc-modal-title"><i class="fa-solid fa-hourglass-half"></i> Bekleme Odası</p>
                <p class="gsc-detail-title">${_escapeHtml(s.title || 'Seans')}</p>
                <p class="u-font-size-13px_color-var-text-muted_margin-0">${subTxt}</p>
                <div class="gsc-waiting-list u-display-flex_flex-wrap-wrap_gap-6px" >${listHtml}</div>
                <div class="gsc-modal-footer">
                    ${isAuthorized ? '<button id="gsc-waiting-start-btn" class="control-btn primary-btn"><i class="fa-solid fa-play"></i> Oturumu Başlat</button>' : ''}
                    <button id="gsc-waiting-leave-btn" class="control-btn secondary">Ayrıl</button>
                </div>
            </div>`;

        overlay.querySelector('#gsc-waiting-start-btn')?.addEventListener('click', () => gscAuthorizeStartSession(sessionId));
        overlay.querySelector('#gsc-waiting-leave-btn')?.addEventListener('click', () => gscCloseWaitingRoom());
        if (isFirstRender) {
            overlay.addEventListener('click', e => { if (e.target === overlay) gscCloseWaitingRoom(); });
        }
    }

    // Yetkili "Oturumu Başlat"a bastığında çağrılır. status='scheduled' guard'ı sayesinde
    // iki kere tıklansa/başka bir yetkili aynı anda dener de tek update etkili olur.
    // Sonuç, group-sessions realtime kanalıyla bekleme odasındaki herkese anında yayılır —
    // her client kendi gscReconcileWaitingRooms'unda status='live' görüp Zamanlayıcısını
    // eşzamanlı başlatır (tek DB event'i tetikleyici olduğu için client saatleri arasında sapma olmaz).
    async function gscAuthorizeStartSession(sessionId) {
        if (!window.FocusSupabase) return;
        const { error } = await window.FocusSupabase.from('group_sessions')
            .update({ status: 'live', started_at: new Date().toISOString() })
            .eq('id', sessionId)
            .eq('status', 'scheduled');
        if (error && typeof showGenericNotifToast === 'function') {
            showGenericNotifToast({ icon: 'fa-triangle-exclamation', accent: '#ff4757', title: 'Başlatılamadı', body: error.message });
        }
    }

    function initGroupSessionCalendar(groupKey, supaGroupId, isInstitutional) {
        if (!groupKey || !currentUser) return;
        if (gscUnsubscribe) { gscUnsubscribe(); gscUnsubscribe = null; }
        if (_gscSupaChannel) { window.FocusSupabase?.removeChannel(_gscSupaChannel); _gscSupaChannel = null; }
        clearInterval(gscReminderInterval);

        gscGroupKey = groupKey;
        gscSupaGroupId = supaGroupId || null;
        gscIsInstitutional = !!isInstitutional;
        gscWeekOffset = 0;
        gscSessionsCache = {};
        gscSelectedDay = gscDateKey(new Date());
        gscCanManageSessions = false;

        if (gscSupaGroupId && window.FocusSupabase && currentUser.id) {
            _initGroupSessionCalendarSupabase();
            getMemberPermissionsSupabase(gscSupaGroupId, currentUser.id, perms => {
                gscCanManageSessions = !!(perms && perms.manageSessions);
                gscApplyPermissionUI();
            });
        }

        // Panel açıkken 30 saniyede bir, "Varım" dediğin yaklaşan/başlamış seansları kontrol et.
        gscReminderInterval = setInterval(() => {
            gscCheckUpcomingReminders();
            // "Odaklan" butonu saat yaklaştıkça belirsin / seans bitince kaybolsun diye
            // gün detay panelini de zamana göre tazele (kullanıcı etkileşimi gerekmeden).
            gscRenderDayDetail();
        }, 30000);

        // Biri grup seansından "Odaklan"a bastığında/bıraktığında presence anında değişir —
        // bu olayı dinleyip paneli hemen tazeleriz, 30sn'lik aralığı beklemeye gerek kalmaz.
        if (gscPresenceHandler) window.removeEventListener('focusai:presence-changed', gscPresenceHandler);
        gscPresenceHandler = () => gscRenderDayDetail();
        window.addEventListener('focusai:presence-changed', gscPresenceHandler);

        // Buton dinleyicileri
        gscApplyPermissionUI();

        const prevBtn = document.getElementById('gsc-prev-week');
        if (prevBtn) prevBtn.onclick = () => {
            // GSC_HISTORY_DAYS'ten daha eskiye gitme — o veriler zaten sunucudan çekilmiyor.
            if (gscWeekOffset * 7 <= -GSC_HISTORY_DAYS) return;
            gscWeekOffset--; gscRenderCalendar();
        };

        const nextBtn = document.getElementById('gsc-next-week');
        if (nextBtn) nextBtn.onclick = () => { gscWeekOffset++; gscRenderCalendar(); };

        const todayBtn = document.getElementById('gsc-today-btn');
        if (todayBtn) todayBtn.onclick = () => {
            gscWeekOffset = 0;
            gscSelectedDay = gscDateKey(new Date());
            gscRenderCalendar();
        };
    }

    // Yetkisiz üyelerden "Seans Ekle" butonlarını tamamen gizler (üst buton + gün detay panelindeki buton).
    // Sadece manageSessions iznine sahip roller (admin/moderatör) seans planlayabilir.
    // Geçmiş Seanslar sekmesini doldurur: gscSessionsCache'deki bitmiş seansları
    // tarihine göre yeniden eskiye sıralar ve kart olarak gösterir.
    // Grup aktivite akışı — mevcut gscSessionsCache verisinden olayları türetir,
    // yeni Supabase sorgusu gerekmez. Güncelleme: her takvim yenilemesinde çağrılır.
    // ── KİŞİSEL GRUP BAŞARILARI ─────────────────────────────
    // gscSessionsCache + localStorage'dan türetilen kalıcı unvanlar.
    // Kriter eşiği aşıldığında kazanılır, bir kez kazanıldıktan sonra hep görünür.
    const GROUP_ACHIEVEMENTS = [
        { id: 'first_step',   icon: '🌱', label: 'İlk Adım',      desc: 'Bu grupta ilk seansına katıldın.',          check: (ci) => ci >= 1  },
        { id: 'warming_up',   icon: '☕', label: 'Isınıyor',       desc: '3 seansa katıldın.',                        check: (ci) => ci >= 3  },
        { id: 'focus_mode',   icon: '🎯', label: 'Odaklanma Modu', desc: '5 seansa katıldın.',                        check: (ci) => ci >= 5  },
        { id: 'regular',      icon: '📅', label: 'Düzenli',        desc: '7 farklı günde seansa katıldın.',           check: (ci, days) => days >= 7  },
        { id: 'team_player',  icon: '🤝', label: 'Takım Oyuncusu', desc: '10 seansa katıldın.',                       check: (ci) => ci >= 10 },
        { id: 'hero',         icon: '🦸', label: 'Kahraman',       desc: '20 seansa katıldın.',                       check: (ci) => ci >= 20 },
        { id: 'legend',       icon: '🏆', label: 'Efsane',         desc: '50 seansa katıldın.',                       check: (ci) => ci >= 50 }
    ];

    function _computeGroupAchievements(username, groupKey) {
        // Check-in yaptığı seansları say
        let checkInCount = 0;
        const activeDates = new Set();
        Object.values(gscSessionsCache).forEach(s => {
            const a = s.attendees && s.attendees[username];
            if (a && a.checkedInAt) {
                checkInCount++;
                activeDates.add(s.date);
            }
        });
        const earned = GROUP_ACHIEVEMENTS.filter(ach => ach.check(checkInCount, activeDates.size));
        // Yeni kazanılanları localStorage'a kaydet (bildirim için fark tespiti)
        if (groupKey && earned.length > 0) {
            const key = `focusai_grp_ach_${groupKey}_${username}`;
            const prev = new Set(JSON.parse(localStorage.getItem(key) || '[]', window._safeJsonReviver));
            const newOnes = earned.filter(a => !prev.has(a.id));
            if (newOnes.length > 0) {
                newOnes.forEach(a => prev.add(a.id));
                localStorage.setItem(key, JSON.stringify([...prev]));
                // Yeni unvan için toast göster
                newOnes.forEach(a => {
                    if (typeof showGenericNotifToast === 'function') {
                        showGenericNotifToast({ icon: 'fa-trophy', accent: 'var(--primary-color)',
                            title: `Yeni Unvan: ${a.label} ${a.icon}`, body: a.desc });
                    }
                });
            }
        }
        return earned;
    }

    // ── GRUP TEMASI ──────────────────────────────────────────
    const GROUP_THEME_COLORS = [
        { label: 'Mor (varsayılan)', hex: '6c5ce7' },
        { label: 'Mavi',   hex: '0984e3' },
        { label: 'Deniz',  hex: '00b894' },
        { label: 'Sarı',   hex: 'D4900E' },
        { label: 'Kırmızı', hex: 'e17055' },
        { label: 'Pembe',  hex: 'fd79a8' },
        { label: 'Gri',    hex: '636e72' },
        { label: 'Buz',    hex: '74b9ff' }
    ];

    function _groupThemeKey(supaId) { return `focusai_group_theme_${supaId}`; }

    function _applyGroupTheme(supaId) {
        const saved = supaId ? localStorage.getItem(_groupThemeKey(supaId)) : null;
        const hex = saved || '6c5ce7';
        let styleEl = document.getElementById('group-theme-style');
        if (!styleEl) { styleEl = document.createElement('style'); styleEl.id = 'group-theme-style'; document.head.appendChild(styleEl); }
        styleEl.textContent = `
            #active-group-panel .group-detail-tab-btn.active { background: #${hex}; border-color: #${hex}; }
            #active-group-panel .group-announcement-banner { border-left-color: #${hex}; }
            #active-group-panel .gsc-day-col.selected { background: rgba(${_hexToRgb(hex)}, 0.14); border-color: rgba(${_hexToRgb(hex)}, 0.45); }
        `;
    }

    function _hexToRgb(hex) {
        const r = parseInt(hex.slice(0,2),16), g = parseInt(hex.slice(2,4),16), b = parseInt(hex.slice(4,6),16);
        return `${r},${g},${b}`;
    }

    function _openGroupThemePicker(supaId, anchorEl) {
        document.querySelector('.grp-theme-picker')?.remove();
        const current = localStorage.getItem(_groupThemeKey(supaId)) || '6c5ce7';
        const picker = document.createElement('div');
        picker.className = 'grp-theme-picker';
        picker.innerHTML = `
            <div class="u-font-size-11px_font-weight-600_color-var-text-muted_margin">Grup Teması</div>
            <div class="u-display-flex_flex-wrap-wrap_gap-8px_margin-bottom-10px">
                ${GROUP_THEME_COLORS.map(c => `
                    <button class="grp-theme-swatch${c.hex === current ? ' active' : ''}" data-hex="${c.hex}"
                        title="${c.label}"></button>`).join('')}
            </div>
            <button id="grp-theme-reset" class="u-font-size-11px_color-var-text-muted_background-none_border">Varsayılana sıfırla</button>
        `;
        const rect = anchorEl.getBoundingClientRect();
        picker.style.position = 'fixed';
        picker.style.top = `${rect.bottom+6}px`;
        picker.style.right = `${window.innerWidth-rect.right}px`;
        picker.style.zIndex = '20000';
        document.body.appendChild(picker);
        picker.querySelectorAll('.grp-theme-swatch').forEach(btn => {
            btn.style.background = '#' + btn.dataset.hex;
            btn.onclick = () => {
                localStorage.setItem(_groupThemeKey(supaId), btn.dataset.hex);
                _applyGroupTheme(supaId);
                picker.remove();
            };
        });
        picker.querySelector('#grp-theme-reset').onclick = () => {
            localStorage.removeItem(_groupThemeKey(supaId));
            _applyGroupTheme(supaId);
            picker.remove();
        };
        const close = (e) => { if (!picker.contains(e.target) && e.target !== anchorEl) { picker.remove(); document.removeEventListener('click', close, true); } };
        setTimeout(() => document.addEventListener('click', close, true), 50);
    }

    function gscRenderActivityFeed() {
        const el = document.getElementById('group-activity-feed');
        if (!el) return;

        const months = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
        const now = Date.now();
        const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

        // Her seansın olaylarını topla: oluşturulma + tamamlanma + check-in'ler
        const events = [];
        Object.values(gscSessionsCache).forEach(s => {
            const sessionLabel = `<b class="u-color-hfff">${_escapeHtml(s.title || 'Seans')}</b>`;
            const [y, m, d] = (s.date || '').split('-');
            const dateStr = y ? `${d} ${months[parseInt(m)-1]}` : '';

            // Seans oluşturuldu
            if (s.createdAt && (now - s.createdAt) < SEVEN_DAYS * 4) {
                events.push({
                    ts: s.createdAt,
                    icon: 'fa-calendar-plus',
                    color: 'var(--primary-color)',
                    text: `${sessionLabel} seansı planlandı${dateStr ? ` (${dateStr})` : ''}.`,
                    sub: s.createdBy ? `@${_escapeHtml(s.createdBy)}` : ''
                });
            }

            // Seans tamamlandı
            if (gscIsPast(s)) {
                const endTs = gscSessionStartDate(s).getTime() + (s.duration || 60) * 60000;
                if ((now - endTs) < SEVEN_DAYS * 4) {
                    const attendees = Object.keys(s.attendees || {});
                    const checkedIn = attendees.filter(u => s.attendees[u].checkedInAt).length;
                    events.push({
                        ts: endTs,
                        icon: 'fa-circle-check',
                        color: '#74b9ff',
                        text: `${sessionLabel} tamamlandı${dateStr ? ` (${dateStr})` : ''}.`,
                        sub: checkedIn > 0 ? `${checkedIn} kişi check-in yaptı` : 'Kimse check-in yapmadı'
                    });
                }

                // Check-in'ler
                Object.entries(s.attendees || {}).forEach(([username, a]) => {
                    if (!a.checkedInAt) return;
                    if ((now - a.checkedInAt) < SEVEN_DAYS) {
                        events.push({
                            ts: a.checkedInAt,
                            icon: 'fa-bolt',
                            color: '#D4900E',
                            text: `<b class="u-color-hfff">@${_escapeHtml(username)}</b> ${sessionLabel} seansına katıldı.`,
                            sub: ''
                        });
                    }
                });
            }
        });

        events.sort((a, b) => b.ts - a.ts);
        const slice = events.slice(0, 12);

        if (slice.length === 0) {
            el.innerHTML = `<p class="u-font-size-12px_color-var-text-muted_margin-0_padding-6px0">Henüz aktivite yok.</p>`;
            return;
        }

        const fmtTs = (ts) => {
            const diff = now - ts;
            if (diff < 60000)     return 'Az önce';
            if (diff < 3600000)   return `${Math.floor(diff / 60000)} dk önce`;
            if (diff < 86400000)  return `${Math.floor(diff / 3600000)} sa önce`;
            if (diff < 604800000) return `${Math.floor(diff / 86400000)} gün önce`;
            const d = new Date(ts);
            return `${d.getDate()} ${months[d.getMonth()]}`;
        };

        el.innerHTML = slice.map((ev, i) => `
            <div class="grp-feed-item" data-feed-idx="${i}">
                <div class="grp-feed-dot"></div>
                <div class="si-flex1">
                    <div class="u-font-size-12px_color-rgba2552552550p8_line-height-1p4">${ev.text}</div>
                    ${ev.sub ? `<div class="u-font-size-10px_color-var-text-muted_margin-top-1px">${ev.sub}</div>` : ''}
                </div>
                <div class="u-font-size-10px_color-var-text-muted_flex-shrink-0_white-sp">${fmtTs(ev.ts)}</div>
            </div>`).join('');
        el.querySelectorAll('.grp-feed-item').forEach(item => {
            const i = parseInt(item.dataset.feedIdx, 10);
            const dot = item.querySelector('.grp-feed-dot');
            if (dot) dot.style.background = slice[i].color;
        });
    }

    function gscRenderHistory() {
        const container = document.getElementById('group-history-list');
        if (!container || !currentUser) return;

        // Öğretmen/yönetici (gscCanManageSessions) tamamlanan TÜM seansları görür
        // (kaç kişi katıldı, ne kadar sürdü vb. detaylarla); öğrenci ise sadece
        // kendisinin gerçekten check-in yaparak KATILDIĞI seansları görür — geçmişi
        // gitmediği derslerle kalabalıklaşmasın (2026-07-13, kullanıcı kararı).
        const isTeacherView = gscCanManageSessions;
        const past = Object.entries(gscSessionsCache)
            .filter(([, s]) => gscIsPast(s))
            .filter(([, s]) => isTeacherView || !!(s.attendees && s.attendees[currentUser.username] && s.attendees[currentUser.username].checkedInAt))
            .sort(([, a], [, b]) => {
                const ta = new Date(a.date + 'T' + (a.time || '00:00')).getTime();
                const tb = new Date(b.date + 'T' + (b.time || '00:00')).getTime();
                return tb - ta;
            });

        if (past.length === 0) {
            container.innerHTML = `
                <div class="grp-onboarding-card">
                    <i class="fa-solid fa-clock-rotate-left u-font-size-26px_color-var-primary-color_margin-bottom-8px" ></i>
                    <p class="u-font-size-13px_font-weight-600_color-hfff_margin-004px">${isTeacherView ? 'Henüz tamamlanan seans yok' : 'Henüz katıldığın tamamlanmış bir seans yok'}</p>
                    <p class="u-font-size-12px_color-var-text-muted_margin-0">${isTeacherView ? 'Takvim sekmesinden ilk seansı planla, katıl ve burada geçmişini gör.' : 'Takvim sekmesinden bir seansa katılıp check-in yaptığında burada görünür.'}</p>
                </div>`;
            return;
        }

        const months = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
        container.innerHTML = past.map(([, s]) => {
            const [y, m, d] = (s.date || '').split('-');
            const dateLabel = y ? `${d} ${months[parseInt(m)-1]} ${y}` : '-';
            const durationMin = s.duration || 60;
            const timeRange = s.time ? `${s.time}–${gscAddMinutes(s.time, durationMin)}` : '--:--';
            const attendees = Object.keys(s.attendees || {});
            const checkedIn = attendees.filter(u => s.attendees[u].checkedInAt);
            const iWasIn = !!(s.attendees && s.attendees[currentUser.username]);
            const avatarsHtml = (isTeacherView ? attendees : checkedIn).slice(0, 5)
                .map(u => avatarImgHtml({ ...s.attendees[u], displayName: s.attendees[u].displayName || u }, 18))
                .join('');
            const shownCount = isTeacherView ? attendees.length : checkedIn.length;
            const overflow = shownCount > 5 ? `<span class="u-font-size-10px_color-var-text-muted_margin-left-4px">+${shownCount-5}</span>` : '';
            return `
                <div class="grp-history-card${iWasIn ? ' mine' : ''}">
                    <div class="u-display-flex_align-items-center_justify-content-space-betw-12">
                        <div class="si-min0">
                            <div class="si-title-bold">${_escapeHtml(s.title || 'Seans')}</div>
                            <div class="si-meta">
                                <i class="fa-solid fa-calendar-day u-font-size-9px" ></i> ${dateLabel}
                                &nbsp;·&nbsp;
                                <i class="fa-solid fa-clock u-font-size-9px" ></i> ${timeRange}
                                &nbsp;·&nbsp;
                                <i class="fa-solid fa-hourglass-half u-font-size-9px" ></i> ${durationMin} dk
                                ${!isTeacherView ? `<span class="u-color-h74b9ff_margin-left-6px"><i class="fa-solid fa-circle-check u-font-size-9px" ></i> Katıldım</span>` : ''}
                            </div>
                        </div>
                        <div class="u-display-flex_align-items-center_gap-10px_flex-shrink-0">
                            ${shownCount > 0 ? `<div class="u-display-flex_align-items-center_gap-4px">${avatarsHtml}${overflow}</div>` : ''}
                            ${isTeacherView ? `<span class="u-font-size-11px_color-rgba2552552550p5">${checkedIn.length}/${attendees.length} katıldı</span>` : ''}
                        </div>
                    </div>
                </div>`;
        }).join('');
    }

    function gscApplyPermissionUI() {
        // Seans ekleme artık tek yerden (gün detay panelindeki "Seans Ekle" butonu) yapılıyor —
        // gscRenderDayDetail bu butonu gscCanManageSessions'a göre zaten koşullu render ediyor.
        gscRenderDayDetail();
    }

    const GSC_HISTORY_DAYS = 60; // geçmişte bu kadar gün geriye kadar seans çek (Katılım Oranı için yeterli, sınırsız büyümeyi önler)

    async function _initGroupSessionCalendarSupabase() {
        const refresh = async () => {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - GSC_HISTORY_DAYS);
            const { data: sessionRows, error } = await window.FocusSupabase
                .from('group_sessions')
                .select('*, group_session_attendees(user_id, username, checked_in_at, profiles(display_name, avatar_color, custom_avatar, avatar_initials))')
                .eq('group_id', gscSupaGroupId)
                .gte('session_date', gscDateKey(cutoff));
            // NOT: '*' zaten status/started_at/created_by kolonlarını içerir (118 migration).
            if (error) { console.error('[GSC] Supabase sessions yükleme hatası:', error); return; }

            gscSessionsCache = {};
            (sessionRows || []).forEach(row => {
                const attendees = {};
                (row.group_session_attendees || []).forEach(a => {
                    const p = a.profiles || {};
                    attendees[a.username] = {
                        userId: a.user_id,
                        displayName: p.display_name || a.username,
                        avatarColor: p.avatar_color || '6c5ce7',
                        customAvatar: p.custom_avatar || null, avatarInitials: p.avatar_initials || null,
                        checkedInAt: a.checked_in_at ? new Date(a.checked_in_at).getTime() : null
                    };
                });
                gscSessionsCache[row.id] = {
                    title: row.title,
                    date: row.session_date,
                    time: row.session_time ? row.session_time.slice(0, 5) : null,
                    duration: row.duration,
                    note: row.note || '',
                    createdBy: row.created_by_username,
                    createdByUserId: row.created_by,
                    createdAt: new Date(row.created_at).getTime(),
                    recurrenceGroupId: row.recurrence_group_id || null,
                    status: row.status || 'scheduled',
                    startedAt: row.started_at ? new Date(row.started_at).getTime() : null,
                    attendees
                };
            });

            gscRenderCalendar();
            gscCheckUpcomingReminders();
            gscReconcileWaitingRooms();
            // Açık sekmeye göre tazele: geçmiş veya genel bakış aktifse içeriklerini güncelle
            const historyTab = document.getElementById('group-gtab-history');
            if (historyTab && historyTab.classList.contains('active')) gscRenderHistory();
            gscRenderActivityFeed();
        };

        await refresh();

        // Ardışık RSVP tıklamalarında her event'te tam tablo sorgusu atmamak için debounce
        let refreshDebounce = null;
        const debouncedRefresh = () => {
            clearTimeout(refreshDebounce);
            refreshDebounce = setTimeout(refresh, 800);
        };

        _gscSupaChannel = window.FocusSupabase
            .channel(`group-sessions-${gscSupaGroupId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'group_sessions', filter: `group_id=eq.${gscSupaGroupId}` }, debouncedRefresh)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'group_session_attendees' }, debouncedRefresh)
            .subscribe();

        gscUnsubscribe = () => {
            if (_gscSupaChannel) { window.FocusSupabase.removeChannel(_gscSupaChannel); _gscSupaChannel = null; }
        };
    }

    function gscRenderCalendar() {
        if (!currentUser) return;
        const grid = document.getElementById('gsc-week-grid');
        const weekLabel = document.getElementById('gsc-week-label');
        if (!grid) return;

        const days = gscGetWeekDates(gscWeekOffset);
        const weekStart = days[0], weekEnd = days[6];

        if (weekLabel) {
            const fmt = d => `${d.getDate()} ${['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'][d.getMonth()]}`;
            weekLabel.textContent = `${fmt(weekStart)} – ${fmt(weekEnd)}`;
        }

        // Haftalık seansları topla
        const weekKeys = days.map(d => gscDateKey(d));
        const weekSessions = Object.entries(gscSessionsCache).filter(([, s]) => weekKeys.includes(s.date));

        // İstatistikleri güncelle
        const planned = weekSessions.length;
        const done    = weekSessions.filter(([, s]) => gscIsPast(s)).length;
        const myRsvp  = weekSessions.filter(([, s]) => s.attendees && s.attendees[currentUser.username]).length;
        const stPlanned = document.getElementById('gsc-stat-planned');
        const stDone    = document.getElementById('gsc-stat-done');
        const stRsvp    = document.getElementById('gsc-stat-rsvp');
        if (stPlanned) stPlanned.textContent = planned;
        if (stDone)    stDone.textContent    = done;
        if (stRsvp)    stRsvp.textContent    = myRsvp;

        // Katılım Oranım: "Varım" dediğim ve vakti geçmiş tüm seanslardan kaçında
        // gerçekten check-in yaptım (Şimdi Başla'ya bastım) — RSVP niyeti yerine
        // gerçek katılımı ölçen, görünen haftayla sınırlı olmayan genel bir güvenilirlik skoru.
        // Az örneklemde (örn. 1 seans) %0/%100 gibi yanıltıcı uç değerler göstermemek için
        // en az GSC_RELIABILITY_MIN_SAMPLE geçmiş RSVP gerektiriyoruz.
        const GSC_RELIABILITY_MIN_SAMPLE = 3;
        const stReliability = document.getElementById('gsc-stat-reliability');
        const stReliabilityNote = document.getElementById('gsc-stat-reliability-note');
        if (stReliability) {
            const myPastRsvps = Object.values(gscSessionsCache)
                .filter(s => s.attendees && s.attendees[currentUser.username] && gscIsPast(s));
            if (myPastRsvps.length < GSC_RELIABILITY_MIN_SAMPLE) {
                stReliability.textContent = '–';
                if (stReliabilityNote) {
                    stReliabilityNote.textContent = myPastRsvps.length === 0
                        ? 'Henüz veri yok'
                        : `${myPastRsvps.length}/${GSC_RELIABILITY_MIN_SAMPLE} seans — henüz erken`;
                }
            } else {
                const attended = myPastRsvps.filter(s => s.attendees[currentUser.username].checkedInAt).length;
                stReliability.textContent = `%${Math.round((attended / myPastRsvps.length) * 100)}`;
                if (stReliabilityNote) stReliabilityNote.textContent = `${attended}/${myPastRsvps.length} seansa katıldın`;
            }
        }

        // Seçili gün bu hafta içinde değilse — bugün haftadaysa ona, değilse Pazartesi'ye düş
        if (!weekKeys.includes(gscSelectedDay)) {
            const todayKey = gscDateKey(new Date());
            gscSelectedDay = weekKeys.includes(todayKey) ? todayKey : weekKeys[0];
        }

        // Grid render — her gün sade bir hücre: gün adı, tarih, seans sayısı kadar nokta.
        // Detay/ekleme her zaman alttaki tek panelde olur, böylece bir güne istediğin kadar
        // seans eklenebilir ve grid kalabalıklaşmaz.
        grid.innerHTML = '';
        days.forEach((day, i) => {
            const dayKey = gscDateKey(day);
            const daySessions = Object.entries(gscSessionsCache)
                .filter(([, s]) => s.date === dayKey)
                .sort(([, a], [, b]) => (a.time || '').localeCompare(b.time || ''));

            const col = document.createElement('div');
            col.className = 'gsc-day-col'
                + (gscIsToday(day) ? ' today' : '')
                + (dayKey === gscSelectedDay ? ' selected' : '');
            col.onclick = () => { gscSelectedDay = dayKey; gscRenderCalendar(); };

            const myCount = daySessions.filter(([, s]) => s.attendees && s.attendees[currentUser.username]).length;
            const DOTS_MAX = 4;
            const dotsHtml = daySessions.slice(0, DOTS_MAX).map(([, s]) => {
                const isMine = s.attendees && s.attendees[currentUser.username];
                return `<span class="gsc-day-dot${isMine ? ' mine' : ''}"></span>`;
            }).join('');
            const dotsOverflow = daySessions.length > DOTS_MAX ? `<span class="gsc-day-dot-more">+${daySessions.length - DOTS_MAX}</span>` : '';

            col.innerHTML = `
                <div class="gsc-day-name">${GSC_DAYS_TR[i]}</div>
                <div class="gsc-day-num">${day.getDate()}</div>
                <div class="gsc-day-dots">${dotsHtml}${dotsOverflow}</div>
            `;
            col.title = myCount > 0 ? `${daySessions.length} seans · ${myCount} tanesine varım` : (daySessions.length > 0 ? `${daySessions.length} seans` : 'Seans yok');
            grid.appendChild(col);
        });

        gscRenderDayDetail();
    }

    // Seçili günün seans listesini ve "seans ekle" aksiyonunu alttaki tek panelde gösterir.
    function gscRenderDayDetail() {
        const panel = document.getElementById('gsc-day-detail');
        if (!panel || !gscSelectedDay) return;

        const dayDate = new Date(gscSelectedDay + 'T00:00:00');
        const dayLabel = `${dayDate.getDate()} ${['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'][dayDate.getMonth()]} ${GSC_DAYS_TR[(dayDate.getDay() + 6) % 7]}`;

        const daySessions = Object.entries(gscSessionsCache)
            .filter(([, s]) => s.date === gscSelectedDay)
            .sort(([, a], [, b]) => (a.time || '').localeCompare(b.time || ''));

        const rowsHtml = daySessions.map(([key, s]) => {
            const isPast = gscIsPast(s);
            const isMine = s.attendees && s.attendees[currentUser.username];
            const attendeeUsernames = s.attendees ? Object.keys(s.attendees) : [];
            const attendeeCount = attendeeUsernames.length;
            const VISIBLE_AVATARS = 4;
            const avatarsHtml = attendeeUsernames.slice(0, VISIBLE_AVATARS)
                .map(u => avatarImgHtml({ ...s.attendees[u], displayName: s.attendees[u].displayName || u }, 16))
                .join('');
            const overflowCount = attendeeCount - VISIBLE_AVATARS;
            const overflowHtml = overflowCount > 0 ? `<span class="gsc-pill-avatar-fallback">+${overflowCount}</span>` : '';
            const timeRange = s.time ? `${s.time}–${gscAddMinutes(s.time, s.duration || 60)}` : '--:--';
            const canFocus = gscCanFocusNow(s);
            const focusingNow = window.gscGetFocusingNow(key);
            const subText = focusingNow.length > 0
                ? `<span class="si-blue"><span class="gsc-live-dot"></span> ${focusingNow.length} kişi şu an odaklanıyor</span>`
                : (isMine ? '✓ Varım' : (attendeeCount > 0 ? `${attendeeCount} kişi katılıyor` : 'Henüz kimse yok'));
            return `
                <div class="gsc-day-detail-row${isPast ? ' completed' : ''}${isMine ? ' mine' : ''}" data-key="${key}">
                    <div class="gsc-ddr-time">${timeRange}${s.recurrenceGroupId ? ' <i class="fa-solid fa-repeat u-font-size-9px_opacity-0p7" title="Tekrarlayan seans"></i>' : ''}</div>
                    <div class="gsc-ddr-main">
                        <div class="gsc-ddr-title">${_escapeHtml(s.title || 'Seans')}</div>
                        <div class="gsc-ddr-sub">${subText}</div>
                    </div>
                    ${attendeeCount > 0 ? `<div class="gsc-pill-avatars">${avatarsHtml}${overflowHtml}</div>` : ''}
                    ${canFocus ? `<button class="gsc-ddr-focus-btn" data-key="${key}" title="Odaklanmayı başlat"><i class="fa-solid fa-bolt"></i> Odaklan</button>` : ''}
                </div>
            `;
        }).join('');

        panel.innerHTML = `
            <div class="gsc-day-detail-head">
                <span>${dayLabel}${daySessions.length > 0 ? ` · ${daySessions.length} seans` : ''}</span>
                ${gscCanManageSessions ? `<button id="gsc-day-detail-add" class="control-btn secondary u-padding-4px10px_font-size-11px" ><i class="fa-solid fa-plus"></i> Seans Ekle</button>` : ''}
            </div>
            ${daySessions.length > 0
                ? `<div class="gsc-day-detail-list">${rowsHtml}</div>`
                : `<div class="gsc-day-detail-empty">Bu güne henüz seans planlanmadı.</div>`}
        `;

        panel.querySelectorAll('.gsc-day-detail-row').forEach(row => {
            row.onclick = () => {
                const key = row.dataset.key;
                gscOpenDetailModal(key, gscSessionsCache[key]);
            };
        });
        panel.querySelectorAll('.gsc-ddr-focus-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const key = btn.dataset.key;
                gscJoinOrWaitForSession(key, gscSessionsCache[key]);
            };
        });
        const addBtn = document.getElementById('gsc-day-detail-add');
        if (addBtn) addBtn.onclick = () => gscOpenCreateModal(gscSelectedDay);
    }

    // editSession verilirse ("Düzenle" akışı): { id, s } — tek bir satırı günceller,
    // tekrar ayarına dokunmaz (seri yeniden oluşturma karmaşıklığından kaçınmak için
    // bilinçli bir kapsam sınırı: tekrarlayan bir seansın tekrar deseni değiştirilemez,
    // sadece tek tek seanslar silinebilir/yeniden oluşturulabilir).
    // gscOpenCreateModal'ın veri hazırlama + HTML üretim katmanı — overlay elementini
    // oluşturup döner (henüz DOM'a eklenmemiş). Faz S devamı, dev fonksiyon refactoru.
    function _gscBuildCreateModalOverlay(prefDate, editSession) {
        const existing = document.getElementById('gsc-create-modal');
        if (existing) existing.remove();

        const isEdit = !!editSession;
        const es = editSession ? editSession.s : null;
        const today = isEdit ? es.date : (prefDate || gscDateKey(new Date()));
        const startTime = isEdit ? (es.time || '20:00') : '20:00';
        const endTime = isEdit ? gscAddMinutes(startTime, es.duration || 60) : gscAddMinutes(startTime, 60);
        const overlay = document.createElement('div');
        overlay.id = 'gsc-create-modal';
        overlay.className = 'gsc-modal-overlay';
        overlay.innerHTML = `
            <div class="gsc-modal-box">
                <div class="u-display-flex_align-items-center_justify-content-space-betw-13">
                    <div class="gsc-modal-title"><i class="fa-solid ${isEdit ? 'fa-pen' : 'fa-calendar-plus'}"></i> ${isEdit ? 'Seansı Düzenle' : 'Yeni Seans Planla'}</div>
                    <button id="gsc-cm-close" class="icon-btn si-muted" aria-label="Kapat"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="gsc-form-row">
                    <label class="gsc-form-label">Seans Başlığı</label>
                    <input id="gsc-cm-title" class="gsc-form-input" placeholder="Örn: Akşam matematik seansı" maxlength="50" value="${isEdit ? _escapeHtml(es.title || '') : ''}">
                </div>
                <div class="gsc-form-row">
                    <label class="gsc-form-label">Tarih</label>
                    <input id="gsc-cm-date" type="date" class="gsc-form-input" value="${today}" min="${gscDateKey(new Date())}">
                </div>
                <div class="gsc-two-col">
                    <div class="gsc-form-row">
                        <label class="gsc-form-label">Başlangıç Saati</label>
                        <input id="gsc-cm-time" type="time" class="gsc-form-input" value="${startTime}">
                    </div>
                    <div class="gsc-form-row">
                        <label class="gsc-form-label">Bitiş Saati</label>
                        <input id="gsc-cm-time-end" type="time" class="gsc-form-input" value="${endTime}">
                    </div>
                </div>
                <p id="gsc-cm-time-error" class="u-display-none_font-size-11px_color-hff4757_margin-8px00"></p>
                <div class="gsc-form-row">
                    <label class="gsc-form-label">Not (isteğe bağlı)</label>
                    <input id="gsc-cm-note" class="gsc-form-input" placeholder="Konu, bağlantı vs." maxlength="120" value="${isEdit ? _escapeHtml(es.note || '') : ''}">
                </div>
                ${isEdit ? (es.recurrenceGroupId ? `<p class="u-font-size-11px_color-var-text-muted_margin-0"><i class="fa-solid fa-circle-info"></i> Bu, tekrarlayan bir serinin parçası. Buradaki değişiklik yalnızca bu tek seansı etkiler.</p>` : '') : `
                <div class="gsc-form-row">
                    <label class="u-display-flex_align-items-center_gap-8px_cursor-pointer_fon">
                        <input id="gsc-cm-repeat" type="checkbox" class="u-width-16px_height-16px_cursor-pointer">
                        <i class="fa-solid fa-repeat u-color-var-primary-color_font-size-12px" ></i> Her hafta aynı gün/saatte tekrarla
                    </label>
                </div>
                <div class="gsc-form-row u-display-none" id="gsc-cm-repeat-weeks-row" >
                    <label class="gsc-form-label">Kaç hafta sürsün?</label>
                    <input id="gsc-cm-repeat-weeks" type="number" class="gsc-form-input" value="8" min="2" max="12">
                </div>`}
                <div class="gsc-modal-footer">
                    <button id="gsc-cm-cancel" class="control-btn secondary u-padding-9px18px" >İptal</button>
                    <button id="gsc-cm-save" class="primary-btn u-padding-9px20px" ><i class="fa-solid fa-check"></i> ${isEdit ? 'Kaydet' : 'Planla'}</button>
                </div>
            </div>
        `;
        return overlay;
    }

    // gscOpenCreateModal'ın olay bağlama katmanı — overlay zaten DOM'a eklenmiş olmalı.
    // Faz S devamı, dev fonksiyon refactoru.
    function _gscWireCreateModalEvents(overlay, isEdit, editSession) {
        overlay.querySelector('#gsc-cm-close').onclick  = () => overlay.remove();
        overlay.querySelector('#gsc-cm-cancel').onclick = () => overlay.remove();
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

        const repeatCheckbox = overlay.querySelector('#gsc-cm-repeat');
        const repeatWeeksRow = overlay.querySelector('#gsc-cm-repeat-weeks-row');
        if (repeatCheckbox) {
            repeatCheckbox.onchange = () => repeatWeeksRow.style.display = repeatCheckbox.checked ? '' : 'none';
        }

        // Başlangıç saati değişince bitiş saatini aynı süreyi koruyarak kaydır —
        // kullanıcı her seferinde iki alanı da elle ayarlamak zorunda kalmasın.
        const startInput = overlay.querySelector('#gsc-cm-time');
        const endInput = overlay.querySelector('#gsc-cm-time-end');
        startInput.addEventListener('change', () => {
            const prevDuration = gscMinutesBetween(startInput.dataset.prev || startInput.value, endInput.value);
            endInput.value = gscAddMinutes(startInput.value, prevDuration > 0 ? prevDuration : 60);
            startInput.dataset.prev = startInput.value;
        });
        startInput.dataset.prev = startInput.value;

        overlay.querySelector('#gsc-cm-save').onclick = async () => {
            const title    = overlay.querySelector('#gsc-cm-title').value.trim();
            const date     = overlay.querySelector('#gsc-cm-date').value;
            const time     = overlay.querySelector('#gsc-cm-time').value;
            const timeEnd  = overlay.querySelector('#gsc-cm-time-end').value;
            const note     = overlay.querySelector('#gsc-cm-note').value.trim();
            const repeat   = repeatCheckbox ? repeatCheckbox.checked : false;
            const repeatWeeks = repeat ? Math.min(12, Math.max(2, parseInt(overlay.querySelector('#gsc-cm-repeat-weeks').value) || 8)) : 1;

            if (!title) { overlay.querySelector('#gsc-cm-title').focus(); return; }
            if (!date)  { overlay.querySelector('#gsc-cm-date').focus();  return; }

            const duration = gscMinutesBetween(time, timeEnd);
            const errorEl = overlay.querySelector('#gsc-cm-time-error');
            const showTimeError = (msg) => { if (errorEl) { errorEl.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${msg}`; errorEl.style.display = ''; } };

            // Geçmiş bir tarihe/saate seans planlanamaz (bugünse başlangıç saati de şu andan sonra olmalı).
            const todayKey = gscDateKey(new Date());
            if (date < todayKey) {
                showTimeError('Geçmiş bir tarihe seans planlanamaz.');
                overlay.querySelector('#gsc-cm-date').focus();
                return;
            }
            if (date === todayKey && gscSessionStartDate({ date, time }).getTime() <= Date.now()) {
                showTimeError('Başlangıç saati geçmişte kalamaz.');
                overlay.querySelector('#gsc-cm-time').focus();
                return;
            }

            if (duration <= 0) {
                showTimeError('Bitiş saati başlangıçtan sonra olmalı.');
                overlay.querySelector('#gsc-cm-time-end').focus();
                return;
            }
            if (duration < GSC_MIN_DURATION_MIN) {
                showTimeError(`Seans en az ${GSC_MIN_DURATION_MIN} dakika olmalı.`);
                overlay.querySelector('#gsc-cm-time-end').focus();
                return;
            }
            if (duration > GSC_MAX_DURATION_MIN) {
                showTimeError(`Seans en fazla ${GSC_MAX_DURATION_MIN / 60} saat (${GSC_MAX_DURATION_MIN} dk) olabilir.`);
                overlay.querySelector('#gsc-cm-time-end').focus();
                return;
            }

            // Aynı güne (ve tekrarlıyorsa her tekrar gününe) saat çakışması ve günlük seans
            // limiti var mı kontrol et — bir grup üyesinin aynı anda iki seansa "Varım"
            // demesini ve takvimin tek bir günde sınırsız büyümesini önlemek için.
            const excludeKey = isEdit ? editSession.id : null;
            const datesToCheck = repeat
                ? Array.from({ length: repeatWeeks }, (_, i) => {
                    const d = new Date(date + 'T00:00:00');
                    d.setDate(d.getDate() + i * 7);
                    return gscDateKey(d);
                  })
                : [date];

            const overlap = datesToCheck.map(d => gscFindOverlap(d, time, timeEnd, excludeKey)).find(Boolean);
            if (overlap) {
                const [, conflictSession] = overlap;
                showTimeError(`Bu saat aralığında zaten "${_escapeHtml(conflictSession.title || 'bir seans')}" var.`);
                overlay.querySelector('#gsc-cm-time').focus();
                return;
            }

            const fullDay = datesToCheck.find(d => gscCountSessionsOnDate(d, excludeKey) >= GSC_MAX_SESSIONS_PER_DAY);
            if (fullDay) {
                showTimeError(`Bu güne zaten en fazla ${GSC_MAX_SESSIONS_PER_DAY} seans planlanabilir.`);
                overlay.querySelector('#gsc-cm-date').focus();
                return;
            }
            if (errorEl) errorEl.style.display = 'none';

            const saveBtn = overlay.querySelector('#gsc-cm-save');
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

            try {
                if (gscSupaGroupId && window.FocusSupabase && currentUser.id) {
                    if (isEdit) {
                        const { error } = await window.FocusSupabase
                            .from('group_sessions')
                            .update({ title, duration, note: note || null, session_date: date, session_time: time || null })
                            .eq('id', editSession.id);
                        if (error) throw error;
                    } else {
                        const recurrenceGroupId = repeat ? crypto.randomUUID() : null;
                        const baseDate = new Date(date + 'T00:00:00');
                        const rows = Array.from({ length: repeatWeeks }, (_, i) => {
                            const d = new Date(baseDate);
                            d.setDate(d.getDate() + i * 7);
                            return {
                                group_id: gscSupaGroupId,
                                title, duration, note: note || null,
                                session_date: gscDateKey(d),
                                session_time: time || null,
                                created_by: currentUser.id,
                                created_by_username: currentUser.username,
                                recurrence_group_id: recurrenceGroupId
                            };
                        });

                        const { error } = await window.FocusSupabase
                            .from('group_sessions')
                            .insert(rows);
                        if (error) throw error;
                        // Seansı oluşturan (öğretmen/yönetici) otomatik katılımcı olarak eklenmez —
                        // zaten yetkili sıfatıyla seansı başlatacak, "Varım" listesine girmesi gerekmez.
                    }
                }
                overlay.remove();
            } catch (e) {
                console.error('Seans kaydetme hatası:', e);
                saveBtn.disabled = false;
                saveBtn.innerHTML = `<i class="fa-solid fa-check"></i> ${isEdit ? 'Kaydet' : 'Planla'}`;
            }
        };
    }

    // Seans oluşturma/düzenleme modalını açar: veri+HTML katmanını kurar, DOM'a ekler, sonra olayları bağlar.
    function gscOpenCreateModal(prefDate, editSession) {
        if (!gscCanManageSessions) return; // yetki sistemi: sadece admin/moderatör seans planlayabilir
        const overlay = _gscBuildCreateModalOverlay(prefDate, editSession);
        document.body.appendChild(overlay);
        _gscWireCreateModalEvents(overlay, !!editSession, editSession);
    }

    // gscOpenDetailModal'ın veri hazırlama + HTML üretim katmanı — overlay elementini
    // oluşturup döner (henüz DOM'a eklenmemiş), ayrıca event wiring için gereken
    // bayrakları (isMine/isPast/canManage) da döner. Faz S devamı, dev fonksiyon refactoru.
    function _gscBuildDetailModalOverlay(sessionKey, s) {
        const isPast     = gscIsPast(s);
        const isMine     = s.attendees && s.attendees[currentUser.username];
        const isCreator  = s.createdBy === currentUser.username;
        // Silme/düzenleme yetkisi artık yalnızca gerçek oluşturanla sınırlı değil — admin/moderator
        // da yönetebilir (bkz. 119 migration'daki DELETE policy, 118'deki UPDATE policy ile aynı sınır).
        const canManage  = isCreator || gscCanManageSessions;
        const attendees  = s.attendees ? Object.keys(s.attendees) : [];
        const [Y, M, D]  = (s.date || '').split('-');
        const dateLabel  = Y ? `${D} ${['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'][parseInt(M)-1]} ${Y}` : '-';
        // RSVP'lisin ve seans başlamak üzere/devam ediyorsa (henüz bitmediyse) doğrudan başlat butonu göster
        const canStartNow = gscCanFocusNow(s);
        const focusingNowCount = window.gscGetFocusingNow(sessionKey).length;

        // Geçmiş seans özeti: kaç kişi "Varım" demişti, kaçı gerçekten check-in yaptı
        const checkedInCount = attendees.filter(u => s.attendees[u].checkedInAt).length;
        const recapHtml = isPast && attendees.length > 0
            ? `<div class="u-display-flex_align-items-center_gap-8px_padding-10px14px_b">
                <i class="fa-solid fa-clipboard-check u-color-hD4900E" ></i>
                <span><b class="u-color-hfff">${checkedInCount}/${attendees.length}</b> kişi gerçekten katıldı (check-in yaptı).</span>
               </div>`
            : '';

        const overlay = document.createElement('div');
        overlay.id = 'gsc-detail-modal';
        overlay.className = 'gsc-modal-overlay';
        overlay.innerHTML = `
            <div class="gsc-modal-box">
                <div class="u-display-flex_align-items-flex-start_justify-content-space-">
                    <div>
                        <p class="gsc-detail-title">${_escapeHtml(s.title || 'Seans')}</p>
                        <div class="gsc-detail-meta">
                            <span class="gsc-detail-badge"><i class="fa-solid fa-calendar-day"></i> ${dateLabel}</span>
                            <span class="gsc-detail-badge"><i class="fa-solid fa-clock"></i> ${s.time ? `${s.time}–${gscAddMinutes(s.time, s.duration || 60)}` : '--:--'}</span>
                            ${s.recurrenceGroupId ? '<span class="gsc-detail-badge"><i class="fa-solid fa-repeat"></i> Her hafta tekrarlıyor</span>' : ''}
                            ${focusingNowCount > 0 ? `<span class="gsc-detail-badge live"><span class="gsc-live-dot"></span> ${focusingNowCount} kişi şu an odaklanıyor</span>` : ''}
                            ${isPast ? '<span class="gsc-detail-badge green"><i class="fa-solid fa-check"></i> Tamamlandı</span>' : ''}
                        </div>
                    </div>
                    <button id="gsc-dm-close" class="icon-btn u-color-var-text-muted_flex-shrink-0"  aria-label="Kapat"><i class="fa-solid fa-xmark"></i></button>
                </div>
                ${s.note ? `<p class="u-font-size-13px_color-var-text-muted_margin-0_padding-10px1">${_escapeHtml(s.note)}</p>` : ''}
                ${recapHtml}
                <div>
                    <p class="u-font-size-12px_font-weight-600_color-var-text-muted_text-t">
                        <i class="fa-solid fa-user-check"></i> Katılımcılar (${attendees.length})
                    </p>
                    <div class="gsc-attendee-grid" id="gsc-attendee-list">
                        ${attendees.map(u => `<div class="gsc-attendee-chip">${avatarImgHtml({ ...s.attendees[u], displayName: s.attendees[u].displayName || u }, 18)}${_escapeHtml(s.attendees[u].displayName || u)}${s.attendees[u].checkedInAt ? ' <i class="fa-solid fa-circle-check u-color-h74b9ff_font-size-10px" title="Check-in yaptı"></i>' : ''}</div>`).join('')}
                        ${attendees.length === 0 ? '<span class="u-font-size-12px_color-var-text-muted">Henüz kimse katılmadı.</span>' : ''}
                    </div>
                </div>
                ${canStartNow ? `<button id="gsc-start-now-btn" class="primary-btn u-width-100pct_padding-11px" ><i class="fa-solid fa-bolt"></i> Şimdi Başla</button>` : ''}
                ${!isPast && !canManage ? `<button id="gsc-rsvp-btn" class="gsc-rsvp-btn ${isMine ? 'leave' : 'join'}">
                    ${isMine
                        ? '<i class="fa-solid fa-xmark"></i> Katılımı İptal Et'
                        : '<i class="fa-solid fa-hand-point-up"></i> Ben Varım!'}
                </button>` : ''}
                ${canManage && !isPast ? `<button id="gsc-dm-edit" class="control-btn secondary u-width-100pct_padding-9px" ><i class="fa-solid fa-pen"></i> Düzenle</button>` : ''}
                ${canManage ? `<button id="gsc-dm-delete" class="gsc-delete-btn"><i class="fa-solid fa-trash-can"></i> Seansı Sil</button>` : ''}
                ${canManage && s.recurrenceGroupId ? `<button id="gsc-dm-delete-series" class="gsc-delete-btn u-margin-top-6px" ><i class="fa-solid fa-trash-can"></i> Bu ve Sonraki Tüm Tekrarları Sil</button>` : ''}
                <p class="u-font-size-11px_color-rgba2552552550p25_margin-0_text-align">Oluşturan: @${_escapeHtml(s.createdBy || '')}</p>
            </div>
        `;
        return { overlay, isMine, isPast, canManage };
    }

    // gscOpenDetailModal'ın buton/RSVP olay bağlama katmanı — overlay zaten DOM'a
    // eklenmiş olmalı. Faz S devamı, dev fonksiyon refactoru.
    function _gscWireDetailModalEvents(overlay, sessionKey, s, isMine, canManage) {
        overlay.querySelector('#gsc-dm-close').onclick = () => overlay.remove();
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

        const editBtn = overlay.querySelector('#gsc-dm-edit');
        if (editBtn) {
            editBtn.onclick = () => {
                overlay.remove();
                gscOpenCreateModal(null, { id: sessionKey, s });
            };
        }

        const startNowBtn = overlay.querySelector('#gsc-start-now-btn');
        if (startNowBtn) {
            startNowBtn.onclick = () => {
                overlay.remove();
                gscJoinOrWaitForSession(sessionKey, s);
            };
        }

        const rsvpBtn = overlay.querySelector('#gsc-rsvp-btn');
        if (rsvpBtn) {
            rsvpBtn.onclick = async () => {
                // Katılmaya çalışıyorsa (zaten katılmıyorsa) önce kişisel takvimle çakışma var mı bak.
                if (!isMine) {
                    const conflict = gscPersonalConflict(s.date, s.time, gscAddMinutes(s.time, s.duration || 60));
                    if (conflict) {
                        if (typeof showGenericNotifToast === 'function') {
                            showGenericNotifToast({
                                icon: 'fa-triangle-exclamation', accent: '#ff4757',
                                title: 'Takviminde çakışma var',
                                body: `O saatte "${_escapeHtml(conflict.text || 'bir görev')}" planlı, bu seansa katılım işaretlenemedi.`
                            });
                        } else {
                            window.dcShowToast('O saatte takviminde başka bir planın var, bu seansa katılamazsın.');
                        }
                        return;
                    }
                }
                rsvpBtn.disabled = true;
                try {
                    if (gscSupaGroupId && window.FocusSupabase && currentUser.id) {
                        if (isMine) {
                            const { data, error } = await window.FocusSupabase.from('group_session_attendees')
                                .delete().eq('session_id', sessionKey).eq('user_id', currentUser.id).select();
                            if (error) throw error;
                            // RLS filtreye takılıp 0 satır silinirse Supabase hata döndürmez — bunu
                            // ayrıca kontrol etmezsek "başarılı" görünüp DB'de hiçbir şey değişmez.
                            if (!data || data.length === 0) throw new Error('Katılım kaydı silinemedi (0 satır etkilendi) — yetki sorunu olabilir.');
                        } else {
                            const { data, error } = await window.FocusSupabase.from('group_session_attendees')
                                .upsert({ session_id: sessionKey, user_id: currentUser.id, username: currentUser.username }).select();
                            if (error) throw error;
                            if (!data || data.length === 0) throw new Error('Katılım kaydedilemedi (0 satır etkilendi).');
                        }
                    }
                } catch (e) {
                    console.error('[GSC] RSVP hatası:', e);
                    if (typeof showGenericNotifToast === 'function') {
                        showGenericNotifToast({ icon: 'fa-triangle-exclamation', accent: '#ff4757', title: 'İşlem başarısız', body: e.message || 'Katılım durumu güncellenemedi.' });
                    }
                    rsvpBtn.disabled = false;
                    return;
                }

                // Realtime tazelemeyi (postgres_changes, ~800ms debounce) beklemeden yerel cache'i
                // hemen güncelle — aksi halde katılımı kaldırdıktan sonra modal kapanana kadarki
                // kısa sürede takvimde hâlâ "Varım" olarak görünmeye devam edebiliyordu.
                if (gscSessionsCache[sessionKey]) {
                    const cached = gscSessionsCache[sessionKey];
                    cached.attendees = { ...(cached.attendees || {}) };
                    if (isMine) {
                        delete cached.attendees[currentUser.username];
                    } else {
                        cached.attendees[currentUser.username] = {
                            userId: currentUser.id,
                            displayName: currentUser.displayName || currentUser.username,
                            avatarColor: currentUser.avatarColor || '6c5ce7',
                            customAvatar: currentUser.customAvatar || null,
                            checkedInAt: null
                        };
                    }
                }
                overlay.remove();
                gscRenderCalendar();
            };
        }

        const deleteBtn = overlay.querySelector('#gsc-dm-delete');
        if (deleteBtn) {
            deleteBtn.onclick = async () => {
                const ok = await window.showFocusaiConfirm({
                    title: 'Seansı Sil',
                    desc: 'Bu seansı silmek istediğine emin misin? Geri alınamaz.',
                    type: 'danger', icon: 'fa-trash-can',
                    confirmText: 'Sil', cancelText: 'Vazgeç'
                });
                if (!ok) return;
                if (gscSupaGroupId && window.FocusSupabase) {
                    const { data, error } = await window.FocusSupabase.from('group_sessions').delete().eq('id', sessionKey).select();
                    if (error || !data || data.length === 0) {
                        console.error('[GSC] Seans silinemedi', error);
                        if (typeof showGenericNotifToast === 'function') {
                            showGenericNotifToast({ icon: 'fa-triangle-exclamation', accent: '#ff4757', title: 'Seans silinemedi', body: error?.message || 'Bu işlem için yetkin yok.' });
                        }
                        return;
                    }
                    // Realtime tazelemeyi (postgres_changes, ~800ms debounce) beklemeden yerel
                    // cache'i hemen güncelle — aksi halde silinen seans, gerçek DB durumu
                    // doğru olsa bile bir sonraki tam yenilemeye kadar takvimde görünmeye devam ediyordu.
                    delete gscSessionsCache[sessionKey];
                }
                overlay.remove();
                if (typeof gscRenderCalendar === 'function') gscRenderCalendar();
            };
        }

        const deleteSeriesBtn = overlay.querySelector('#gsc-dm-delete-series');
        if (deleteSeriesBtn) {
            deleteSeriesBtn.onclick = async () => {
                const ok = await window.showFocusaiConfirm({
                    title: 'Tüm Tekrarları Sil',
                    desc: 'Bu seans ve bundan sonraki tüm haftalık tekrarları silinecek. Geçmiş tekrarlar etkilenmez. Geri alınamaz.',
                    type: 'danger', icon: 'fa-trash-can',
                    confirmText: 'Tümünü Sil', cancelText: 'Vazgeç'
                });
                if (!ok) return;
                if (gscSupaGroupId && window.FocusSupabase) {
                    // created_by filtresi kaldırıldı — RLS zaten oluşturan/yönetici sınırını uyguluyor
                    // (bkz. 119 migration), burada tekrar aynı sınırı client'ta dayatmak admin/moderator'ı
                    // kendi oluşturmadığı bir seriyi silmekten engelliyordu.
                    const { data, error } = await window.FocusSupabase.from('group_sessions')
                        .delete()
                        .eq('recurrence_group_id', s.recurrenceGroupId)
                        .gte('session_date', s.date)
                        .select();
                    if (error || !data || data.length === 0) {
                        console.error('[GSC] Seri silinemedi', error);
                        if (typeof showGenericNotifToast === 'function') {
                            showGenericNotifToast({ icon: 'fa-triangle-exclamation', accent: '#ff4757', title: 'Seri silinemedi', body: error?.message || 'Bu işlem için yetkin yok.' });
                        }
                        return;
                    }
                    // Silinen tüm satırları (bu seans + gelecekteki tekrarları) yerel cache'ten de kaldır.
                    data.forEach(row => { delete gscSessionsCache[row.id]; });
                }
                overlay.remove();
                if (typeof gscRenderCalendar === 'function') gscRenderCalendar();
            };
        }
    }

    // Seans detay modalını açar: veri+HTML katmanını kurar, DOM'a ekler, sonra olayları bağlar.
    function gscOpenDetailModal(sessionKey, s) {
        const { overlay, isMine, canManage } = _gscBuildDetailModalOverlay(sessionKey, s);
        document.body.appendChild(overlay);
        _gscWireDetailModalEvents(overlay, sessionKey, s, isMine, canManage);
    }

// ── Dışa açılan köprüler ──────────────────────────────────────────────
export function getGscSessionsCache() { return gscSessionsCache; }
export function getGscGroupKey() { return gscGroupKey; }

// resetActiveGroupPanel (social-group-details.js) çağırıyor: bu modülün
// kendi iç state'ini (takvim dinleyicisi, hatırlatma zamanlayıcısı,
// presence dinleyicisi, seans cache'i, grup anahtarı) temizler.
export function gscResetState() {
    if (gscUnsubscribe) { gscUnsubscribe(); gscUnsubscribe = null; }
    clearInterval(gscReminderInterval);
    if (gscPresenceHandler) { window.removeEventListener('focusai:presence-changed', gscPresenceHandler); gscPresenceHandler = null; }
    gscSessionsCache = {};
    gscGroupKey = null;
}

export { initGroupSessionCalendar, gscRenderCalendar, gscGetWeekDates, gscDateKey, gscRenderActivityFeed, gscRenderHistory, _applyGroupTheme, _openGroupThemePicker };
export { _computeGroupAchievements as computeGroupAchievements };

window.__getGscSessionsCacheRef = () => gscSessionsCache;
window.gscRenderCalendar = gscRenderCalendar;
