// ============================================================
// FOCUSAI SOCIAL.JS — v1.0
// Gerçek Zamanlı Çevrimiçi Özellikler
// ============================================================
(function () {
'use strict';

// ─── GLOBAL MİNİ TOAST + CUSTOM CONFIRM MODAL ────────────────────────────────
// social-toast.js dosyasına taşındı (window.dcShowToast, window.showFocusaiConfirm).

// ─── ÖDEV ADIM KAYNAK LİNKİ ──────────────────────────────────────────────────
// .cp-asg-step-row-link tıklaması, ebeveyn <label>'ın checkbox'ını tetiklemesin
// diye (eskiden onclick="event.stopPropagation()" idi, CSP script-src'den
// unsafe-inline kaldırılabilsin diye delegated listener'a taşındı).
document.addEventListener('click', (e) => {
    if (e.target.closest('.cp-asg-step-row-link')) e.stopPropagation();
});

// ─── GRUP ONBOARDING: "SEANS PLANLA" BUTONU ─────────────────────────────────
document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="onboarding-goto-calendar-tab"]');
    if (!btn) return;
    btn.closest('.group-detail-tabs')?.querySelector('[data-gtab=calendar]')?.click();
});

// ─── BOŞ DURUM CTA'LARI ──────────────────────────────────────────────────────
// data-empty-cta butonları: boş listelerdeki yönlendirme aksiyonları
document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-empty-cta]');
    if (!btn) return;
    const action = btn.dataset.emptyCta;
    if (action === 'add-friend') {
        const openBtn = document.getElementById('open-add-friend-btn');
        if (openBtn) { openBtn.click(); return; }
        document.getElementById('add-friend-modal')?.classList.remove('hidden');
    } else if (action === 'discover-groups') {
        const dBtn = document.getElementById('group-discover-modal-btn');
        if (dBtn) { dBtn.click(); return; }
    }
});

// ─── SINIF/DERS VE İŞ YERİ/EKİP GRUPLARINDA SAHİPLİK DEVRİ SEÇİCİSİ ─────────
// Sahip ayrılırken kime devredeceğini kendi seçer (diğer gruplardaki otomatik
// hiyerarşi seçiminin aksine) — bir öğretmen/yönetici sınıfını rastgele bir
// üyeye değil, bizzat seçtiği kişiye devretmek ister.
window._pickNewOwner = (members, groupName) => _pickNewOwner(members, groupName); // Faz 5: social-group-details.js için
function _pickNewOwner(members, groupName) {
    return new Promise(resolve => {
        const esc = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
        const overlay = document.createElement('div');
        overlay.className = 'focusai-confirm-overlay';
        overlay.innerHTML = `
            <div class="focusai-confirm-box">
                <div class="focusai-confirm-icon danger"><i class="fa-solid fa-door-open"></i></div>
                <div class="focusai-confirm-title">Gruptan Ayrıl</div>
                <div class="focusai-confirm-desc">
                    <b>"${esc(groupName)}"</b> grubunun sahibisiniz. Devam etmeden önce, sahipliği devretmek istediğiniz üyeyi seçin:
                </div>
                <select id="_pno_select" class="gsc-form-input" style="width:100%; margin:12px 0; box-sizing:border-box;">
                    ${members.map(m => `<option value="${m.user_id}">${esc((m.profiles && (m.profiles.display_name || m.profiles.username)) || '?')}</option>`).join('')}
                </select>
                <div class="focusai-confirm-actions">
                    <button class="focusai-confirm-btn cancel" id="_pno_cancel">Vazgeç</button>
                    <button class="focusai-confirm-btn confirm-danger" id="_pno_confirm">Devret ve Ayrıl</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        const close = (val) => {
            overlay.style.opacity = '0';
            overlay.style.transition = 'opacity 0.15s';
            setTimeout(() => overlay.remove(), 150);
            resolve(val);
        };
        overlay.querySelector('#_pno_confirm').addEventListener('click', () => {
            close(overlay.querySelector('#_pno_select')?.value || null);
        });
        overlay.querySelector('#_pno_cancel').addEventListener('click', () => close(null));
        overlay.addEventListener('click', e => { if (e.target === overlay) close(null); });
    });
}

(function () {
    'use strict';

    // XSS koruması — kullanıcı metnini innerHTML'e basmadan önce escape et.
    // Tek kaynak: script.js'teki window.escapeHtml. social.js önce bu dosya
    // yüklendikten sonra çalıştığı için normalde her zaman mevcuttur; olası bir
    // yükleme sırası değişikliğine karşı aynı mantığı yerel fallback olarak tutuyoruz.
    function _escapeHtml(str) {
        if (typeof window.escapeHtml === 'function') return window.escapeHtml(str);
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
    window._escapeHtml = _escapeHtml; // social-roles.js gibi ayrı script scope'larından erişim için

    // "Bu hafta"nın başlangıcını (Pazartesi, TR saati) sunucu tarafındaki
    // date_trunc('week', now() at time zone 'Europe/Istanbul') ile AYNI şekilde
    // hesaplar (bkz. supabase/migrations/109-111). Türkiye yaz saati uygulamadığı
    // için (2016'dan beri sabit UTC+3) basit bir +3 saat offset'i yeterli ve
    // güvenilir — DST hesabına gerek yok.
    window._trWeekStart = (d) => _trWeekStart(d); // Faz 6: social-institution-panel.js için
    function _trWeekStart(d) {
        const base = d || new Date();
        const tr = new Date(base.getTime() + 3 * 3600 * 1000);
        const day = tr.getUTCDay(); // 0=Pazar
        const diff = (day === 0 ? -6 : 1 - day);
        tr.setUTCDate(tr.getUTCDate() + diff);
        return tr.toISOString().slice(0, 10);
    }

    // Genel amaçlı, hafızada (client-side) basit "throttle" kontrolü — ekstra DB
    // okuma/yazma maliyeti olmadan, kullanıcının aynı eylemi çok hızlı tekrarlamasını
    // (spam tıklama, bot vb.) engellemek için kullanılır. Sayfa yenilenince sıfırlanır.
    const _throttleTimestamps = {};
    function _throttleAction(key, minIntervalMs) {
        const now = Date.now();
        const last = _throttleTimestamps[key] || 0;
        if (now - last < minIntervalMs) return false;
        _throttleTimestamps[key] = now;
        return true;
    }
    // social-activity-feed.js gibi ayrı script scope'larından erişim için
    window._throttleAction = _throttleAction;

    // Mesaj textarea'sını yazılan içeriğe göre büyütür (max-height CSS'te sınırlı,
    // sonrasında kendi içinde scroll eder); mesaj gönderildikten sonra sıfırlanmalı.
    function _dcAutoResizeTextarea(el) {
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = el.scrollHeight + 'px';
    }

    // ─── İYİMSER (OPTIMISTIC) GÖNDERİM BALONCUĞU ─────────────
    // Sunucu cevabı beklenmeden mesajı hemen ekranda gösterir; gerçek mesaj
    // realtime dinleyiciden gelince bu geçici baloncuk kaldırılır. Hata olursa
    // "tekrar dene" durumuna geçer.
    function _dcCreatePendingBubble(streamEl, text) {
        const row = document.createElement('div');
        row.className = 'dc-dm-msg-row msg-me dc-msg-pending-row';
        row.dataset.username = currentUser?.username || '';
        row.dataset.timestamp = String(Date.now());
        row.style.cssText = 'display:flex; align-items:flex-start; gap:10px; padding:6px 0 2px; flex-direction: row-reverse;';

        const spacer = document.createElement('div');
        spacer.style.cssText = 'width:32px; flex-shrink:0;';
        row.appendChild(spacer);

        const bubble = document.createElement('div');
        bubble.className = 'dc-msg-bubble';
        bubble.style.cssText = 'max-width:68%; display:flex; flex-direction:column; align-items:flex-end; opacity:0.72;';

        const textEl = document.createElement('div');
        textEl.className = 'dc-msg-text';
        textEl.innerHTML = _formatMessageText(text);
        bubble.appendChild(textEl);

        const statusEl = document.createElement('div');
        statusEl.className = 'dc-msg-pending-status';
        statusEl.style.cssText = 'font-size:10.5px; color:rgba(255,255,255,0.4); margin-top:2px; display:flex; align-items:center; gap:4px;';
        statusEl.innerHTML = '<i class="fa-solid fa-clock" style="font-size:9px;"></i> Gönderiliyor…';
        bubble.appendChild(statusEl);

        row.appendChild(bubble);
        streamEl.appendChild(row);
        streamEl.scrollTop = streamEl.scrollHeight;
        return { row, statusEl };
    }

    // Sunucu rate-limit hatası mı? (048_message_rate_limit.sql trigger'ı)
    function _isRateLimitError(error) {
        return !!(error && typeof error.message === 'string' && error.message.includes('rate_limit'));
    }

    function _dcMarkPendingBubbleFailed(pending, onRetry) {
        if (!pending || !pending.statusEl) return;
        pending.statusEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="font-size:9px;"></i> Gönderilemedi — tekrar dene';
        pending.statusEl.style.color = '#ff7675';
        pending.statusEl.style.cursor = 'pointer';
        pending.statusEl.onclick = () => {
            pending.statusEl.style.color = 'rgba(255,255,255,0.4)';
            pending.statusEl.style.cursor = 'default';
            pending.statusEl.innerHTML = '<i class="fa-solid fa-clock" style="font-size:9px;"></i> Gönderiliyor…';
            onRetry();
        };
    }

    function _dcRemovePendingBubble(pending) {
        if (pending && pending.row) pending.row.remove();
    }

    // Sohbet mesajı metnini güvenli şekilde biçimlendirir:
    // **kalın**, `kod` ve URL'leri otomatik linke çevirir (önce escape edilir, XSS riski yok)
    function _formatMessageText(str) {
        let s = _escapeHtml(str);
        s = s.replace(/`([^`\n]+)`/g, '<code class="chat-inline-code">$1</code>');
        s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
        s = s.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="chat-msg-link">$1</a>');
        return s;
    }

    let currentUser = null;   // { username, displayName, avatarColor }
    // NOT: _friendsCache artık social-friends-notifications.js'te tanımlı (Faz 5
    // çıkarmasında bu dosyaya taşındığında kendi bildirimi unutulmuştu — 2026-07-23
    // düzeltmesiyle oraya taşındı, burada vestigial kopya kaldırıldı).
    // username -> arkadaş olunan zaman damgası. Aktivite akışında bir arkadaşın
    // SADECE bu zamandan SONRAKİ aktiviteleri gösterilir — arkadaş olmadan önceki
    // (eski) aktiviteleri akışta görünmemeli.
    let _friendsSinceCache = null;
    // 🛡️ Yetki Sistemi Global Değişkenleri
    let currentUserRole = 'member'; // Bizim rolümüz ('admin', 'moderator', 'member')
    let allUserRoles = {}; // Tüm üyelerin rolleri burada tutulacak
    let currentChannelIsAnnouncement = false; // Seçili oda duyuru odası mı?
    // social-server-tree.js ile paylaşımlı (o modül de bu bayrağı reassign ediyor)
    window.__getCurrentChannelIsAnnouncement = () => currentChannelIsAnnouncement;
    window.__setCurrentChannelIsAnnouncement = (v) => { currentChannelIsAnnouncement = v; };
    let selectedUserForRole = ''; // Rolünü değiştirmek için seçtiğimiz üye
    let cwTimerInterval = null;
    let currentRoomId = null;
    let _cwRoomIsSupabase = false;
    let _cwRoomSupaChannel = null;
    // Salt-okunur köprüler — social-group-focus-break-chat.js /
    // social-group-focus-leave.js gibi ayrılan modüllerin bu değişkenleri
    // social.js'e taşımadan kullanabilmesi için.
    window._cwGetRoomChannel = () => _cwRoomSupaChannel;
    window._cwGetRoomId = () => currentRoomId;
    window._cwGetRoomIsSupabase = () => _cwRoomIsSupabase; // social-cw-invites.js için
    let _cwPartnerUsername = null;
    let _cwPartnerName     = null;
    let _cwPartnerColor    = null;
    // Getter+setter — social-cw-invites.js (davet akışı) için, oda kurulumu/
    // yeniden başlatma akışıyla paylaşılan partner bilgisi.
    window._cwGetPartnerInfo = () => ({ username: _cwPartnerUsername, name: _cwPartnerName, color: _cwPartnerColor });
    window._cwSetPartnerInfo = (username, name, color) => { _cwPartnerUsername = username; _cwPartnerName = name; _cwPartnerColor = color; };
    let _cwInviteMsgId  = null; // Grup sohbetine gönderilen "odaklanma daveti" kartının messages.id'si (varsa)
    let _cwInviteScope  = null; // { type, id } — davet mesajının ait olduğu scope
    window._cwSetInviteMsgRef = (msgId, scope) => { _cwInviteMsgId = msgId; _cwInviteScope = scope; }; // social-cw-invites.js için
    let _cwRoomOriginGroupScope = null; // Mevcut oda bir grup daveti üzerinden açıldıysa { type, id } — "Yeniden Başlat" hangi ayar modalına döneceğini bilsin diye
    window._cwSetRoomOriginGroupScope = (v) => { _cwRoomOriginGroupScope = v; }; // social-cw-invites.js için
    let currentChatRoomId = "general";
    // social-online-friends.js dosyasına taşındığı için window üzerinde paylaşılıyor
    window._onlineFriendsPresenceCb = null;
    // NOT: _friendsChangedBound artık social-friends-notifications.js'te tanımlı
    // (bindFriendsChangedListener aynı dosyada — 2026-07-23 düzeltmesi, bkz. _friendsCache notu).

    // Mini Sanal Odak Odası Zamanlayıcı Değişkenleri
    let scwTimeLeft = 25 * 60;
    let scwTimerInterval = null;
    let isScwRunning = false;
    let currentRoomLinkedHabit = null; // { id, name, pairId } — odanın bağlı olduğu ortak alışkanlık (varsa)
    window._cwGetLinkedHabit = () => currentRoomLinkedHabit;
    // Ortak odak odası geliştirmeleri için durum değişkenleri
    let currentRoomIsHost = false;
    window._cwGetRoomIsHost = () => currentRoomIsHost;
    let sharedFocusBreakInterval = null;
    let sharedFocusBindingsReady = false;
    let currentRoomPhase = 'work'; // 'work' | 'break' — sohbet görünürlüğü hesaplamasında kullanılır
    let sharedFocusMyTaskId = null; // Bu kullanıcının ortak odakta seçtiği görev id'si
    let sharedFocusMyTaskText = ''; // Seçilen görevin metni — bireysel modda senkron oda olmadığı için yerelde tutulur
    // Salt-okunur/yazma köprüsü — social-group-focus-task-selector.js için.
    window._gfGetMyTask = () => ({ id: sharedFocusMyTaskId, text: sharedFocusMyTaskText });
    window._gfSetMyTask = (id, text) => { sharedFocusMyTaskId = id; sharedFocusMyTaskText = text; };
    let sharedFocusSoloMode = false; // true: tam ekran odaklanma arayüzü bir oda yerine tek başına seans için açık
    let sharedFocusBreakMinutes = 10; // Odanın mola süresi (dk) — partnerle senkron, ayarlanabilir
    let sharedFocusMinimized = false; // true: kullanıcı sadece arayüzden ayrıldı, zamanlayıcı arka planda akıyor
    let sharedFocusPhaseInitialized = false; // ilk oda yüklemesinde geçiş ekranının yanlışlıkla tetiklenmesini önler
    let sharedFocusPhaseTransitionTimeout = null;

    // ═══════════════════════════════════════════════════════
    // 🎯 TÜRETİLMİŞ-ZAMAN MOTORU — Grup Odaklanması'ndaki
    // "startedAt'tan türet" modeliyle birebir aynı mantık: komut
    // round-trip'i yok, herkes kendi Date.now() - startedAt'ından hesaplar.
    // Hem bireysel mini zamanlayıcı hem partner odası bu motoru kullanır;
    // breakMinutes > 0 ise iş↔mola döngüsü, 0/yoksa tek seferlik geri sayım.
    // ═══════════════════════════════════════════════════════
    let sharedFocusSession = null; // { startedAt, paused, pausedAt, focusMinutes, breakMinutes, rounds }
    let sharedFocusTotalRounds = 4; // Seçilen tur sayısı — DOM'dan bağımsız, güvenilir kaynak
    window._getSharedFocusTotalRounds = () => sharedFocusTotalRounds; // social-cw-invites.js için

    function deriveSharedFocusPhase(session, now) {
        if (!session || !session.startedAt) return null;
        const focusMs = Math.max(1, (session.focusMinutes || 25)) * 60000;
        const breakMs = Math.max(0, (session.breakMinutes || 0)) * 60000;
        const refNow = (session.paused && session.pausedAt) ? session.pausedAt : now;
        const elapsed = Math.max(0, refNow - session.startedAt);

        if (breakMs <= 0) {
            // Bireysel mod: tek seferlik geri sayım — süre dolunca 'done'
            if (elapsed >= focusMs) return { type: 'done', remainingMs: 0, durMs: focusMs };
            return { type: 'work', remainingMs: focusMs - elapsed, durMs: focusMs };
        }
        // Oda modu: iş↔mola sonsuz döngüsü (grup odaklanmasındaki faz mantığıyla aynı türetme)
        const cycleMs = focusMs + breakMs;
        const inCycle = elapsed % cycleMs;
        if (inCycle < focusMs) return { type: 'work', remainingMs: focusMs - inCycle, durMs: focusMs };
        return { type: 'break', remainingMs: cycleMs - inCycle, durMs: breakMs };
    }

    // Duraklat: paused=true + pausedAt=now yaz. Devam: geçen duraklama süresi kadar
    // startedAt'ı ileri kaydır — grup odaklanmasındaki resume mantığıyla birebir aynı.
    function buildSharedFocusResumeUpdate(session, now) {
        const shift = now - (session.pausedAt || now);
        return { paused: false, pausedAt: null, startedAt: (session.startedAt || 0) + shift };
    }

    // Atla: kalan süre kadar startedAt'ı geriye kaydırarak fazı anında bir sonrakine düşürür
    // — grup odaklanmasındaki "skip" ile birebir aynı teknik (hiçbir alan ayrıca yazılmaz).
    function buildSharedFocusSkipUpdate(session, now) {
        const ph = deriveSharedFocusPhase(session, now);
        if (!ph) return null;
        return { startedAt: (session.startedAt || 0) - ph.remainingMs, paused: false, pausedAt: null };
    }

    // ──────────────────────────────────────────────────────
    // BAŞLATMA
    // ──────────────────────────────────────────────────────
    async function initSocial() {
        if (!window.FocusAuth) {
            window.showNotConfiguredBanner();
            return;
        }

        bindAuthChangeListener();

        let session;
        try {
            session = await window.FocusAuth.getSession();
        } catch (e) {
            console.error('[FocusAI Social] oturum kontrolü hatası:', e);
            window.showNotConfiguredBanner();
            return;
        }
        if (!session || !session.user) {
            window.showNotConfiguredBanner();
            return;
        }

        await loadCommunityProfile(session.user);
    }

    // SIGNED_IN/SIGNED_OUT olaylarında topluluk profilini (yeniden) yükler —
    // Magic Link ile sayfa yenilenmeden giriş yapıldığında da çalışır.
    let _authChangeBound = false;
    function bindAuthChangeListener() {
        if (_authChangeBound || !window.FocusAuth) return;
        _authChangeBound = true;
        window.FocusAuth.onAuthChange((event, session) => {
            if (event === 'SIGNED_IN' && session && session.user) {
                loadCommunityProfile(session.user);
            } else if (event === 'SIGNED_OUT') {
                currentUser = null;
                window.currentUser = null;
                window.showNotConfiguredBanner();
            }
        });
    }

    // Oturum sahibinin `profiles` satırını çeker. `username` henüz seçilmemişse
    // "topluluk profili" kurulum modalını tetikleyen bir event yayınlar.
    async function loadCommunityProfile(authUser) {
        try {
            const { data: profile, error } = await window.FocusSupabase
                .from('profiles')
                .select('*')
                .eq('id', authUser.id)
                .maybeSingle();
            if (error) throw error;

            if (!profile || !profile.username) {
                window.dispatchEvent(new CustomEvent('focusai:needs-community-profile', {
                    detail: { authUser, profile }
                }));
                return;
            }

            currentUser = _profileToCurrentUser(profile, authUser);
            window.currentUser = currentUser;
            saveUser(currentUser);
            window.updateProfileHeader();
            window.startPresence();
            syncXP();
            startAllSocialListeners();
        } catch (e) {
            console.error('[FocusAI Social] profil yükleme hatası:', e);
            window.showNotConfiguredBanner();
        }
    }

    // `profiles` satırını + auth kullanıcısını eski `currentUser` şekline dönüştürür
    // (mevcut tüm UI kodu bu alan adlarını bekliyor).
    function _profileToCurrentUser(profile, authUser) {
        return {
            id: authUser.id,
            username: profile.username,
            displayName: profile.display_name || profile.username,
            avatarColor: profile.avatar_color || '6c5ce7',
            customAvatar: profile.custom_avatar || null, avatarInitials: profile.avatar_initials || null,
            status: profile.status || 'online',
            statusColor: profile.status_color || '#2ed573',
            statusText: profile.status_text || '',
            institutionRole: profile.institution_role || 'member',
            plan: profile.plan || 'free'
        };
    }

    // Sosyal bir özelliğe (arkadaşlar, bildirimler, ...) erişmeden önce çağrılır:
    // - currentUser hazırsa true döner.
    // - Oturum yoksa hesap/giriş modalını açar.
    // - Oturum var ama topluluk profili (username) eksikse kurulum modalını açar.
    async function ensureCommunityAccess() {
        if (currentUser) return true;
        if (!window.FocusAuth) return false;
        const session = await window.FocusAuth.getSession();
        if (!session || !session.user) {
            if (window.FocusAuthUI?.open) window.FocusAuthUI.open();
            return false;
        }
        await loadCommunityProfile(session.user);
        return !!currentUser;
    }

    // Oturum açıldı ama henüz `profiles.username` seçilmemiş — kayıt modalını
    // (varsa eski Firebase hesabından kalan kullanıcı adıyla önceden doldurarak) açar.
    function openCommunitySetupModal(detail) {
        const modal = document.getElementById('social-setup-modal');
        if (!modal) return;
        resetSetupModalToRegister();

        const cached = getSavedUser();
        const unInput = document.getElementById('social-setup-username');
        const dnInput = document.getElementById('social-setup-displayname');
        if (unInput && cached?.username) unInput.value = cached.username;
        if (dnInput) dnInput.value = (detail && detail.profile && detail.profile.display_name) || cached?.displayName || '';

        modal.classList.remove('hidden');
    }

    // Tüm gerçek zamanlı sosyal dinleyicileri başlatır. Sayfa açılışında (initSocial)
    // ve yeni hesap oluşturulduğunda (registerUser sonrası) çağrılır — böylece yeni
    // kayıt olan bir kullanıcı, sayfayı yenilemeden de arkadaşlık isteklerini,
    // DM bildirimlerini ve son mesajlaşmaları canlı olarak alır.
    // ─── SOHBET YETKİ KAPISI (Kurumsal plan hazırlığı, Faz 1) ─────────
    // Karar (2026-07-02): sohbet bireysel üründen kalkacak, kurumsal aboneliğe
    // (dershane/okul/işyeri) taşınacak. Faz 1 = Arena akışlarının sohbete yazan
    // kısımları bu kapının arkasına alınır; sohbetsiz muadilleri (bildirim toast'ı,
    // aktivite akışı) koşulsuz çalışır. Faz 2'de bu fonksiyon plana/yetkiye
    // bağlanacak ve bireysel kullanıcıda false dönecek — sohbet UI'ı gizlenecek.
    function dcChatEnabled() {
        // Freemium modeli: sohbet bölümü premium (profiles.plan, 053) veya
        // kurumsal rollerde (student/teacher) açık; ücretsiz bireyselde kapalı —
        // sosyal sekme salt Arena. Mola sohbetleri (gf-break-chat) bu kapıdan
        // bağımsızdır, herkese açıktır. Ödeme entegrasyonu gelene kadar plan
        // SQL'den elle atanır.
        if (window.FOCUS_MESSAGING_ENABLED === false) return false;
        if (!currentUser) return false;
        return currentUser.plan === 'premium'
            || ['student', 'teacher'].includes(currentUser.institutionRole);
    }
    window.dcChatEnabled = dcChatEnabled;

    // Kendi fotoğrafını yükleme premium/kurumsal özelliği (Storage maliyeti) —
    // ücretsiz kullanıcılar yerine renk + 2 harf özelleştirebilir (bkz. resolveAvatar).
    function avatarUploadEnabled() {
        if (!currentUser) return false;
        return currentUser.plan === 'premium'
            || ['student', 'teacher'].includes(currentUser.institutionRole);
    }
    window.avatarUploadEnabled = avatarUploadEnabled;

    // Sohbet kapısını arayüze uygular: body.dc-chat-disabled sınıfı CSS ile
    // sohbet giriş noktalarını (süzülen buton, Son Mesajlaşmalar, mesaj arama,
    // DM açma) gizler. Girişte ve rol değişiminde çağrılır.
    // Kullanıcının planını arayüzde görünür kılar: ana sidebar profil alanı
    // (#sidebar-plan-badge). Sohbet paneli profil alanında artık gösterilmiyor.
    // _applyChatGate ile birlikte çağrılır — plan/rol her değiştiğinde tazelenir.
    function _applyPlanBadge() {
        const els = [document.getElementById('sidebar-plan-badge')].filter(Boolean);
        if (!els.length) return;
        if (!currentUser) { els.forEach(el => { el.style.display = 'none'; }); return; }
        const inst = ['student', 'teacher'].includes(currentUser.institutionRole);
        const key = inst ? 'kurumsal' : currentUser.plan === 'premium' ? 'premium' : 'free';
        const labels = { kurumsal: '🏫 Kurumsal', premium: '⭐ Premium', free: 'Ücretsiz Plan' };
        const titles = {
            kurumsal: `Kurumsal (${currentUser.institutionRole === 'teacher' ? 'öğretmen' : 'öğrenci'}): sohbet + sınıf paneli, 10 grup / 100 üye`,
            premium: 'Premium plan: sohbet açık, 5 grup / 30 üye',
            free: 'Ücretsiz plan: Sosyal + 1 grup (10 üye). Sohbet Premium planda.'
        };
        els.forEach(el => {
            el.textContent = labels[key];
            el.title = titles[key];
            el.className = 'plan-badge plan-badge--' + key;
            el.style.display = '';
        });
    }
    window._applyPlanBadge = _applyPlanBadge;

    function _applyChatGate() {
        const off = !dcChatEnabled();
        document.body.classList.toggle('dc-chat-disabled', off);
        _applyPlanBadge();
        // Tanı: sohbet kapısı neden açık/kapalı — plan ya da rol beklenenden
        // farklıysa buradan görülür (profil girişte okunur, değişiklik sonrası yenile)
        if (currentUser) {
            console.info('[FocusAI Plan] plan=%s, rol=%s → sohbet %s',
                currentUser.plan || '-', currentUser.institutionRole || '-', off ? 'KAPALI' : 'AÇIK');
        }
        // Mobil sidebar butonu: sohbetsiz kullanıcıda listede sadece gruplar
        // ve çevrimiçi arkadaşlar kalır — etiket yanıltmasın
        const mobBtn = document.getElementById('dc-home-chats-btn');
        if (mobBtn) {
            mobBtn.innerHTML = off
                ? '<i class="fa-solid fa-people-group"></i> Gruplar'
                : '<i class="fa-solid fa-comments"></i> Sohbetler';
        }
    }
    window._applyChatGate = _applyChatGate;
    _applyChatGate(); // yüklenme anı: giriş yoksa da sohbet kapalı başlar

    function startAllSocialListeners() {
        if (!currentUser) return;
        _applyChatGate(); // rol artık biliniyor — sohbet kapısını uygula

        // Supabase: arkadaş listesi + engelleme listesini realtime dinle
        window._startFriendsListenerSupabase();
        window._startBlocksListenerSupabase();

        if (window.FocusSupabase && currentUser.id && dcChatEnabled()) window.setupGroupRecentConversationsSupabase();
        window.FocusXP?.scan(); // birikmiş tamamlamaları XP olayı olarak kuyruğa al
        window.ensureWeeklyLeague().finally(() => { window.subscribeLeaderboard(); window.ensureSeason(); });
        // social-online-friends.js ayrı dosyaya taşındı — bkz. yukarıdaki not (typeof korumalı)
        if (typeof window.subscribeOnlineFriends === 'function') window.subscribeOnlineFriends();
        if (typeof window.renderHomeSummary === 'function') window.renderHomeSummary();
        window.scheduleFocusReminders();
        if (typeof window.listenForCWInvites === 'function') window.listenForCWInvites();
        if (typeof window.listenForCWDeclines === 'function') window.listenForCWDeclines();
        // social-buddy-habits.js ayrı dosyaya taşındı (dinamik import ile SONRA
        // yükleniyor olabilir) — typeof kontrolüyle olası yükleme sırası
        // yarışını (race condition) güvenle karşılıyoruz.
        if (typeof window.listenForBuddyHabitInvites === 'function') window.listenForBuddyHabitInvites();
        if (typeof window.listenForBuddyHabitResponses === 'function') window.listenForBuddyHabitResponses();
        if (typeof window.populateHabitBuddySelect === 'function') window.populateHabitBuddySelect();
        listenMyGroups();
        window.listenForFriendRequests();
        window.listenForFriendAcceptances();
        syncSidebarGroupList();
        setInterval(syncXP, 5 * 60 * 1000);
        // Uygulama açık kalırken hafta devrilirse (Paz→Pzt gecesi) ligi işle
        setInterval(() => window.ensureWeeklyLeague(), 30 * 60 * 1000);
        setTimeout(window.cleanOrphanedBuddyHabits, 2000);
    }

    // ──────────────────────────────────────────────────────
    // KULLANICI YÖNETİMİ
    // ──────────────────────────────────────────────────────
    function getSavedUser() {
        try { return JSON.parse(localStorage.getItem('focusai_social_user')); }
        catch { return null; }
    }

    function saveUser(u) {
        localStorage.setItem('focusai_social_user', JSON.stringify(u));
        currentUser = u;
        window.currentUser = u;
    }

    // ─── AMACA HİZMET EDEN BİLDİRİMLER — social-focus-reminders.js
    // dosyasına taşındı (Faz 2, 2026-07-19).
    // window.scheduleFocusReminders() üzerinden erişiliyor.

    // ─── "KİŞİLER" POPOVER (2026-07-03) → social-online-people-popover.js dosyasına taşındı ──────

    // ─── "ÖDEVLERİM" ROZETİ (2026-07-06) → social-assignments-badge.js dosyasına taşındı ──────

    // ─── ANA SAYFA ÖZET ŞERİDİ + GRUP HEDEFLERİ → social-home-summary.js
    // dosyasına taşındı (Faz E, 2026-07-23). renderHomeSummary/getLocalXP/
    // renderArenaGroupGoals window.X olarak erişilebilir.

    // Kurumsal rol (institution_role) burada YAZILMAZ: sohbet yetkisi ve kurumsal
    // kapasiteler bu role bağlı olduğundan kullanıcı kendi rolünü seçemez — rol,
    // kurum onboarding'i gelene kadar SQL'den atanır ve 055 ile sunucuda korunur.
    async function registerUser(username, displayName, avatarColor) {
        if (!window.FocusSupabase || !window.FocusAuth) return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
        try {
            const session = await window.FocusAuth.getSession();
            if (!session || !session.user) return { success: false, error: 'Önce giriş yapmalısın.' };

            const { data: existing, error: checkErr } = await window.FocusSupabase
                .from('profiles')
                .select('id')
                .ilike('username', username)
                .neq('id', session.user.id)
                .maybeSingle();
            if (checkErr) throw checkErr;
            if (existing) return { success: false, error: 'Bu kullanıcı adı alınmış, başka birini dene.' };

            const { data: updated, error: updateErr } = await window.FocusSupabase
                .from('profiles')
                .update({
                    username,
                    display_name: displayName,
                    avatar_color: avatarColor,
                    joined_community_at: new Date().toISOString()
                })
                .eq('id', session.user.id)
                .select()
                .single();
            if (updateErr) throw updateErr;

            currentUser = _profileToCurrentUser(updated, session.user);
            window.currentUser = currentUser;
            saveUser(currentUser);

            return { success: true };
        } catch (e) {
            return { success: false, error: 'Bağlantı hatası: ' + e.message };
        }
    }

    // ──────────────────────────────────────────────────────
    // PRESENCE (ÇEVRİMİÇİ DURUM)
    // ──────────────────────────────────────────────────────
    // PRESENCE (ÇEVRİMİÇİ DURUM, heartbeat+polling motoru) → social-presence.js dosyasına taşındı (Faz 6)

    // Pomodoro sayacı gerçekten "odaklanma" (work) modunda çalışırken true,
    // duraklatılınca/durdurulunca veya mola modundayken false çağrılır.
    // script.js'teki timer start/pause/reset/mode-değişimi noktalarından tetiklenir.
    function setFocusState(isFocusing, focusMode, groupSessionId) {
        // Odak kalkanı: kişisel zamanlayıcı odak modundayken (mola değil) sohbet
        // soluklaşır/kilitlenir, toast'lar ve bildirim sesleri susar. Presence'tan
        // bağımsız çalışmalı — sosyal hesaba girilmemiş olsa bile koruma aktif.
        // NOT: sadece zamanlayıcının ARKA PLANDA çalışıyor olması yetmez — kullanıcı
        // gerçekten tam ekran "Odak Modu"na basmadıkça (body.focus-mode-active) bu
        // kalkan devreye girmemeli, aksi halde Sosyal'daki sıralama/seri kartı
        // kullanıcı Odak Modu'na hiç girmeden, sırf zamanlayıcıyı başlatınca soluyordu.
        const shieldActive = !!isFocusing && document.body.classList.contains('focus-mode-active');
        if (typeof window.dcSetHushMode === 'function') window.dcSetHushMode(shieldActive, 'personal');
        if (!window.__getPresencePayload()) return;
        window.__setPresencePayload({
            ...window.__getPresencePayload(),
            studying: !!isFocusing,
            focusMode: isFocusing ? (focusMode || null) : null,
            gscSessionId: isFocusing ? (groupSessionId || null) : null
        });
        window._presenceHeartbeatTick(); // anlık tek yazı (O(1)) — broadcast değil
    }

    // Bir grup seansı için şu an kimlerin odaklandığını polling cache'inden okur
    // (bkz. registerPresenceWatchIds ile seans katılımcılarının izlemeye alınması).
    window.gscGetFocusingNow = (sessionId) => gscGetFocusingNow(sessionId); // Faz 5: social-group-details.js için
    function gscGetFocusingNow(sessionId) {
        if (!sessionId) return [];
        const result = [];
        Object.values(window.__getPolledPresenceCache()).forEach(metas => {
            (metas || []).forEach(m => { if (m.gscSessionId === sessionId) result.push(m); });
        });
        return result;
    }

    // Bir seansın bekleme odasına girdiğini/çıktığını presence'a yazar.
    // gscOpenWaitingRoom/gscCloseWaitingRoom tarafından çağrılır.
    window.setWaitingState = (sessionId) => setWaitingState(sessionId); // Faz 5: social-group-details.js için
    function setWaitingState(sessionId) {
        if (!window.__getPresencePayload()) return;
        window.__setPresencePayload({ ...window.__getPresencePayload(), waitingForSessionId: sessionId || null });
        window._presenceHeartbeatTick();
    }

    // Bir seansın bekleme odasında şu an kimlerin olduğunu polling cache'inden okur.
    window.gscGetWaitingNow = (sessionId) => gscGetWaitingNow(sessionId); // Faz 5: social-group-details.js için
    function gscGetWaitingNow(sessionId) {
        if (!sessionId) return [];
        const result = [];
        Object.values(window.__getPolledPresenceCache()).forEach(metas => {
            (metas || []).forEach(m => { if (m.waitingForSessionId === sessionId) result.push(m); });
        });
        return result;
    }

    // subscribeOnlineFriends gibi yerlerden presence durumuna erişim için —
    // dönüş şekli eskisiyle aynı ({userId: [{...meta}]}), sadece kaynağı artık
    // canlı kanal değil periyodik olarak dolan _polledPresenceCache.
    window.getCommunityPresenceState = () => window.__getPolledPresenceCache();

    window.syncXP = () => syncXP(); // Faz 5: social-group-details.js için
    function syncXP() {
        if (!currentUser) return;

        const stats = typeof window.getProductivityStats === 'function' ? window.getProductivityStats() : { completedToday: 0, focusMin: 0 };

        let currentStatus = "Uzakta";
        if (typeof isScwRunning !== 'undefined' && isScwRunning) {
            currentStatus = "Odaklanıyor 🧠";
        } else if (typeof scwTimeLeft !== 'undefined' && scwTimeLeft < 25 * 60 && scwTimeLeft > 0) {
            currentStatus = "Molada ☕";
        } else {
            currentStatus = "Planlama Yapıyor 📋";
        }

        const isOnline = currentUser.status !== 'offline';
        // Faz A: XP artık profiles'a client'tan yazılmıyor — tamamlanan öğeler
        // olay olarak sunucuya bildirilir, miktarı sunucu belirler (award_xp).
        if (window.FocusXP) { window.FocusXP.scan(); window.FocusXP.flushSoon(); }

        // Faz B (127_server_presence_stats.sql): focus_streak/completed_today/
        // completed_goals artık client'tan yazılamıyor (profiles_protect_columns
        // trigger'ı korur) — sunucu bu değerleri xp_events/goals'tan yeniden
        // hesaplayıp yazar. focus_min hâlâ client beyanı (051'deki bilinen sınır).
        if (window.FocusSupabase && currentUser.id) {
            window.FocusSupabase.rpc('sync_presence_stats', { p_status: currentStatus }).then(({ error }) => {
                if (error) console.error('[FocusAI Social] sync_presence_stats hatası:', error.message);
            });
            window.FocusSupabase.from('profiles').update({
                focus_min: stats.focusMin
            }).eq('id', currentUser.id).then(({ error }) => {
                if (error) console.error('[FocusAI Social] syncXP hatası:', error.message);
            });
        }

        // DOM'u hemen güncelle — hard reload gerekmez
        window.updateProfileHeader();
        if (typeof window.updateSbProfile === 'function') window.updateSbProfile();
    }

    // ──────────────────────────────────────────────────────
    // ARKADAŞLAR
    // ──────────────────────────────────────────────────────
    // ──────────────────────────────────────────────────────
    // SESLİ / MASAÜSTÜ BİLDİRİM SİSTEMİ → social-notif-sounds.js dosyasına taşındı
    // (playNotificationSound, playRoomJoinSound/LeaveSound,
    //  requestDesktopNotificationPermission, maybeShowDesktopNotification,
    //  showChatNotificationToast — hepsi window.X olarak burada da erişilebilir)
    // ──────────────────────────────────────────────────────

    // ──────────────────────────────────────────────────────
    // SOHBET MESAJI BİLDİRİMLERİ + SON MESAJLAŞMALAR/OKUNMAMIŞ ROZET MOTORU
    // → social-dm-notifications.js dosyasına taşındı (Faz E, 2026-07-23).
    // isChatContextActive/handleIncomingChatMessage/setupChatMessageNotifications,
    // loadDmLastRead/saveDmLastRead/markDmRead/getDmLastRead, loadGroupLastRead/
    // saveGroupLastRead/getGroupLastRead/markGroupRead, loadJsonList/saveJsonList,
    // _dcGetBlockedByOthers/_dcSetBlockedByOthers, hasUnreadDm, updateContactUnreadDot/
    // updateOnlineFriendUnreadDot, getFriendInfo, refreshAllDmUnreadCounts/
    // resyncRecentConversationsAndUnread/registerDmUnreadTracking/dcUnreadTotals/
    // renderFloatingChatBadge, setupRecentConversations(Supabase), goToGroupChat,
    // renderRecentConversations/showRecentConvoContextMenu/updateRecentConvoUnread,
    // showRoleChangeToast/showGenericNotifToast — hepsi window.X olarak erişilebilir.
    // ──────────────────────────────────────────────────────



    // ──────────────────────────────────────────────────────
    // ÇEVRİMİÇİ ARKADAŞLAR (YENİ NESİL DİKEY LİSTE) → social-online-friends.js dosyasına taşındı
    // ──────────────────────────────────────────────────────

    // ──────────────────────────────────────────────────────
    // AKTİVİTE AKIŞI
    // ──────────────────────────────────────────────────────
    // closeReactionPicker/_activeReactionPicker, sendGroupKudos,
    // _currentWeekStartKey, _maybeCelebrateGroupGoal → social-activity-feed.js dosyasına taşındı

    // Aktivite akışı 071 migration ile kurulup 2026-07-05'te tekrar tamamen
    // kaldırıldı (kullanıcı kararı — bkz. 072_drop_activity_feed_v2.sql). Kalan
    // çağrı noktalarını (lig terfisi, grup hedefi, kişisel rekor vb.) tek tek
    // sökmek yerine no-op bırakıldı; hiçbir görünür/kalıcı etkisi yok.
    function postActivity() {}
    window.postActivity = postActivity; // social-gamification.js gibi ayrı script scope'larından erişim için

    // ──────────────────────────────────────────────────────
    // ORTAK ALIŞKANLIK ZİNCİRLERİ (BUDDY HABITS) → social-buddy-habits.js dosyasına taşındı
    // ──────────────────────────────────────────────────────

    // ──────────────────────────────────────────────────────
    // GERÇEK ZAMANLI GRUPLAR (GROUPS SYSTEM)
    // ──────────────────────────────────────────────────────
    let activeGroupKey = null;

    // GERÇEK ZAMANLI GRUPLAR (limit/cooldown/oluşturma/katılma) → social-groups.js dosyasına taşındı (Faz 6)

    function subscribeToGroup(groupKey) {
        if (!groupKey) return;

        if (window.FocusSupabase && currentUser?.id) {
            activeGroupKey = groupKey;
            // Grup verilerini Supabase'den çek
            window.FocusSupabase.from('groups').select('*').eq('id', groupKey).maybeSingle()
                .then(({ data: group }) => {
                    if (!group) return;
                    const _nameEl = document.getElementById('active-group-name');
                    const _descEl = document.getElementById('active-group-desc');
                    if (_nameEl) _nameEl.textContent = group.name + ` (${group.code})`;
                    if (_descEl) _descEl.textContent = group.description || '';

                    // Üyeleri çek
                    window.FocusSupabase.from('group_members')
                        .select('*, profile:profiles(id, username, display_name, avatar_color)')
                        .eq('group_id', groupKey)
                        .then(({ data: members }) => {
                            const memberList = members || [];
                            const activeCountEl = document.getElementById('group-active-count');
                            if (activeCountEl) activeCountEl.textContent = `${memberList.length} Üye`;

                            let activeStudyHTML = '';
                            let totalGroupFocusMinutes = 0;
                            const _presenceState = window.getCommunityPresenceState ? window.getCommunityPresenceState() : {};

                            memberList.forEach(m => {
                                const p = m.profile || {};
                                const xp = p.xp || 0;
                                totalGroupFocusMinutes += Math.floor(xp / 10);
                                const isOnline = _presenceState && _presenceState[p.username];
                                if (isOnline) {
                                    activeStudyHTML += `
                                        <div class="glass-element" style="padding: 12px; display: flex; align-items: center; gap: 10px; border: 1px solid #2ed573;">
                                            ${window.avatarImgHtml(p, 30)}
                                            <div class="si-flex1">
                                                <div style="font-size:12px; font-weight:600; color:#fff; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${p.display_name || p.username}</div>
                                                <div style="font-size:10px; color:#2ed573;"><i class="fa-solid fa-book-open"></i> Çalışıyor...</div>
                                            </div>
                                        </div>`;
                                }
                            });

                            const studyContainer = document.getElementById('group-study-members');
                            if (studyContainer) studyContainer.innerHTML = activeStudyHTML || '<div style="color:var(--text-muted); font-size:13px; grid-column: 1/-1; text-align:center;">Şu an odada çıt çıkmıyor, kimse çalışmıyor.</div>';

                            const weeklyGoal = group.weekly_goal || 0;
                            const percent = weeklyGoal ? Math.min(100, Math.floor((totalGroupFocusMinutes / weeklyGoal) * 100)) : 0;
                            const fillEl = document.getElementById('group-goal-fill');
                            const percentText = document.getElementById('group-goal-percent');
                            const goalText = document.getElementById('group-goal-text');
                            if (fillEl) fillEl.style.strokeDashoffset = (238.76 * (1 - percent / 100)).toFixed(2);
                            if (percentText) percentText.textContent = '%' + percent;
                            if (goalText) goalText.textContent = `${totalGroupFocusMinutes} / ${weeklyGoal} dk`;
                        });
                });
            return;
        }
    }

    function listenMyGroups() {
        if (!currentUser) return;
        if (window.FocusSupabase && currentUser.id) return;
    }

    // ──────────────────────────────────────────────────────
    // CO-WORKING ODASI (Gerçek Zamanlı)
    // ──────────────────────────────────────────────────────
    // ──────────────────────────────────────────────────────
    // DAVET ÖNCESİ ZAMANLAYICI AYAR MODALI
    // "Birlikte Odaklan" (cowork-challenge) davetinde olduğu gibi, davet göndermeden
    // önce kullanıcı zamanlayıcı süresini seçer; bu seçim odaya da taşınır.
    // ──────────────────────────────────────────────────────
    let buddyFocusSettingsBound = false;
    let buddyFocusSettingsPending = null; // { targetUsername, targetName, targetColor, linkedHabit } | { isGroup: true, groupScope }

    window.openBuddyFocusSettingsModal = (...a) => openBuddyFocusSettingsModal(...a);
    function openBuddyFocusSettingsModal(targetUsername, targetName, targetColor, linkedHabit) {
        const modal = document.getElementById('buddy-focus-premium-modal');
        if (!modal) {
            console.warn('[CW-DEBUG] buddy-focus-premium-modal bulunamadı, direkt sendCWInvite çağrılıyor');
            window.sendCWInvite(targetUsername, targetName, targetColor, linkedHabit, 25);
            return;
        }

        buddyFocusSettingsPending = { targetUsername, targetName, targetColor, linkedHabit };

        const heroSub = document.getElementById('bfp-hero-sub');
        if (heroSub) {
            heroSub.textContent = linkedHabit
                ? `${targetName || 'Partnerin'} ile "${linkedHabit.name}" için odaklanma seansı kur`
                : `${targetName || 'Partnerin'} ile birlikte odaklanma seansı kur`;
        }

        _openBuddyFocusSettingsModalShared();
    }

    // Grup/kanal sohbetine "birlikte odaklan" daveti gönderirken de aynı
    // zamanlayıcı ayarları modalını (süre/mola/tur seçimi) kullanır —
    // tek fark: gönderince sendCWInvite yerine sendGroupFocusInvite çalışır.
    window.openGroupFocusSettingsModal = (...a) => openGroupFocusSettingsModal(...a);
    function openGroupFocusSettingsModal(groupScope) {
        const modal = document.getElementById('buddy-focus-premium-modal');
        if (!modal) { window.sendGroupFocusInvite(25, 10, 4, groupScope); return; }

        buddyFocusSettingsPending = { isGroup: true, groupScope };

        const heroSub = document.getElementById('bfp-hero-sub');
        if (heroSub) heroSub.textContent = 'Kanaldaki herkese birlikte odaklanma daveti gönder';

        _openBuddyFocusSettingsModalShared();
    }

    function _openBuddyFocusSettingsModalShared() {
        const modal = document.getElementById('buddy-focus-premium-modal');
        // Klasik preset'i varsayılan yap
        document.querySelectorAll('.bfp-preset').forEach(b => b.classList.toggle('active', b.dataset.dur === '25'));
        const durEl = document.getElementById('bfp-duration');
        const brkEl = document.getElementById('bfp-break');
        const rndEl = document.getElementById('bfp-rounds');
        if (durEl) durEl.value = 25;
        if (brkEl) brkEl.value = 10;
        if (rndEl) rndEl.value = 4;
        bfpUpdatePreview();

        modal.classList.remove('hidden');
        ensureBuddyFocusSettingsBindings();
    }

    function closeBuddyFocusSettingsModal() {
        const modal = document.getElementById('buddy-focus-premium-modal');
        if (modal) modal.classList.add('hidden');
        buddyFocusSettingsPending = null;
    }

    function bfpUpdatePreview() {
        const dur    = parseInt(document.getElementById('bfp-duration')?.value) || 25;
        const brk    = parseInt(document.getElementById('bfp-break')?.value) || 10;
        const rounds = parseInt(document.getElementById('bfp-rounds')?.value) || 4;
        const total  = rounds * dur + rounds * brk;
        const h = Math.floor(total / 60), m = total % 60;
        const box = document.getElementById('bfp-preview-box');
        if (box) box.innerHTML = `📋 <b style="color:#fff;">Özet:</b> ${rounds} × ${dur}dk odak + ${rounds} × ${brk}dk mola = <b class="si-green">~${h > 0 ? h + 'sa ' : ''}${m}dk</b>`;
    }

    function ensureBuddyFocusSettingsBindings() {
        if (buddyFocusSettingsBound) return;
        buddyFocusSettingsBound = true;

        const modal = document.getElementById('buddy-focus-premium-modal');

        // Preset chip tıklama
        document.querySelectorAll('.bfp-preset').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('.bfp-preset').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                if (chip.dataset.dur) { document.getElementById('bfp-duration').value = chip.dataset.dur; }
                if (chip.dataset.brk) { document.getElementById('bfp-break').value = chip.dataset.brk; }
                if (chip.dataset.rounds) { document.getElementById('bfp-rounds').value = chip.dataset.rounds; }
                bfpUpdatePreview();
            });
        });

        // Stepper +/- butonları
        document.querySelectorAll('.bfp-step-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const input = document.getElementById(btn.dataset.target);
                if (!input) return;
                const delta = parseInt(btn.dataset.delta);
                const min = parseInt(input.min) || 1;
                const max = parseInt(input.max) || 999;
                input.value = Math.min(max, Math.max(min, (parseInt(input.value) || 0) + delta));
                document.querySelectorAll('.bfp-preset').forEach(c => c.classList.remove('active'));
                document.querySelector('.bfp-preset[data-dur=""]')?.classList.add('active');
                bfpUpdatePreview();
            });
        });

        // Input yazılınca önizlemeyi güncelle
        ['bfp-duration', 'bfp-break', 'bfp-rounds'].forEach(id => {
            document.getElementById(id)?.addEventListener('input', bfpUpdatePreview);
        });

        // Kapat / İptal
        const closeFn = () => closeBuddyFocusSettingsModal();
        document.getElementById('bfp-x-btn')?.addEventListener('click', closeFn);
        document.getElementById('bfp-cancel-btn')?.addEventListener('click', closeFn);
        modal?.addEventListener('click', e => { if (e.target === modal) closeFn(); });

        // Daveti Gönder
        document.getElementById('bfp-send-btn')?.addEventListener('click', () => {
            if (!buddyFocusSettingsPending) { console.warn('[CW-DEBUG] buddyFocusSettingsPending boş, çıkılıyor'); return; }
            const dur    = parseInt(document.getElementById('bfp-duration')?.value) || 25;
            const brk    = parseInt(document.getElementById('bfp-break')?.value) || 10;
            const rounds = parseInt(document.getElementById('bfp-rounds')?.value) || 4;
            const pending = buddyFocusSettingsPending;
            closeBuddyFocusSettingsModal();
            sharedFocusBreakMinutes = brk;
            sharedFocusTotalRounds = rounds; // Güvenilir kaynak olarak sakla
            // Tur bilgisini overlay DOM'una aktar — timeline ve sayaç için
            const totalEl = document.getElementById('gf-round-total');
            const rndInput = document.getElementById('gf-rounds-input');
            if (totalEl)  totalEl.textContent = rounds;
            if (rndInput) rndInput.value      = rounds;
            if (pending.isGroup) {
                window.sendGroupFocusInvite(dur, brk, rounds, pending.groupScope);
            } else {
                const { targetUsername, targetName, targetColor, linkedHabit } = pending;
                window.sendCWInvite(targetUsername, targetName, targetColor, linkedHabit, dur);
            }
        });
    }

    // ─── ORTAK ODAKLANMA DAVET AKIŞI → social-cw-invites.js dosyasına taşındı
    // (Faz E, 2026-07-23 — riskli bölge denemesi). sendCWInvite/
    // sendGroupFocusInvite/listenForCWDeclines/listenForCWInvites window.X
    // olarak erişilebilir. 10 paylaşılan oda/oturum state değişkeni için
    // yeni getter/setter köprüleri eklendi (bkz. dosya başındaki değişken
    // tanımları, ~223-290 satır civarı: _cwGetRoomIsSupabase/
    // _getSharedFocusTotalRounds/_cwSetPartnerInfo/_cwSetRoomOriginGroupScope/
    // _cwSetInviteMsgRef) — çekirdek fonksiyonlar (enterCWRoom vb.) bu
    // değişkenlere hâlâ doğrudan erişiyor, değiştirilmedi.

    // ──────────────────────────────────────────────────────
    // AYRI "BİRLİKTE ODAKLANMA ODASI" ARAYÜZÜ
    // "Birlikte Çalışalım" (cowork-session-overlay) ile birebir aynı görsel yapı/sınıflar
    // kullanılarak tam ekran bir oda açar; partnerler bu özel arayüzde buluşup
    // zamanlayıcıyı (mevcut scw senkron altyapısı üzerinden) birlikte yönetir.
    // ──────────────────────────────────────────────────────
    let sharedFocusDisplaySyncInterval = null;

    function getScwActiveModeSeconds() {
        const activeMode = document.querySelector('.scw-mode-btn.active');
        return activeMode ? parseInt(activeMode.dataset.scwTime) * 60 : 25 * 60;
    }

    // Ortak odaklanma arayüzündeki süre pillerinden (bf-mode-btn) seçili olanın
    // toplam saniyesini döndürür — mini zamanlayıcının pilleriyle (scw-mode-btn) KARIŞMAZ.
    function getSharedFocusTotalSeconds() {
        const input = document.getElementById('gf-duration-input');
        return input ? (parseInt(input.value, 10) || 25) * 60 : 25 * 60;
    }

    // Belirtilen dakika değerine göre hem overlay içindeki (bf-mode-pills) hem de
    // davet öncesi ayar modalındaki (bfs-mode-pills) aktif pil görünümünü günceller.
    function applySharedFocusModePill(minutes) {
        if (!minutes) return;
        const input = document.getElementById('gf-duration-input');
        if (input) input.value = minutes;
        const bfsContainer = document.getElementById('bfs-mode-pills');
        if (bfsContainer) {
            bfsContainer.querySelectorAll('.bf-mode-btn').forEach(btn => {
                const t = parseInt(btn.dataset.bfsTime, 10);
                btn.classList.toggle('active', t === minutes);
            });
        }
        updateSharedFocusSettingsSummary();
    }

    // Mola süresi pillerinin (#bf-break-pills) aktif görünümünü günceller — partnerle senkron.
    function applySharedFocusBreakPill(minutes) {
        if (!minutes) return;
        const input = document.getElementById('gf-break-input');
        if (input) input.value = minutes;
        updateSharedFocusSettingsSummary();
    }

    // "Zamanlayıcı Ayarları" butonunun altındaki kısa özeti (örn. "25 dk çalışma · 10 dk mola") günceller
    function updateSharedFocusSettingsSummary() {
        const el = document.getElementById('bf-settings-summary');
        if (!el) return;
        const workMinutes = Math.round((getSharedFocusTotalSeconds() || (25 * 60)) / 60);
        const breakMinutes = sharedFocusBreakMinutes || SHARED_FOCUS_DEFAULT_BREAK_MINUTES;
        el.textContent = `${workMinutes} dk çalışma · ${breakMinutes} dk mola`;
    }

    // Sohbetin görünürlüğünü tek noktadan hesaplar:
    // - Mola sırasında HER ZAMAN görünür
    // - Odaklanma seansı çalışırken (work fazı + zamanlayıcı aktif) GİZLİDİR
    // - Seans henüz başlamadıysa veya duraklatıldıysa/bittiyse tekrar GÖRÜNÜR
    function recalcSharedFocusChatVisibility() {
        const onBreak = currentRoomPhase === 'break';
        if (sharedFocusSoloMode) {
            // Bireysel modda yalnızca mola fazında panel gösterilir (Firebase bağlantısı yok)
            toggleSharedFocusBreakChat(onBreak);
            return;
        }
        const shouldShow = onBreak || !isScwRunning;
        toggleSharedFocusBreakChat(shouldShow);
    }

    // ──────────────────────────────────────────────────────
    // ODAKLANMA MODU — seans çalışırken arayüz sadeleşir: sadece zamanlayıcı,
    // ilerleme çubuğu, motivasyon sözü ve "neye odaklanıyorsun" bilgisi görünür kalır
    // ──────────────────────────────────────────────────────
    let sharedFocusInFocusMode = false;

    // ══════════════════════════════════════════════════════
    // ⚙️ ORTAK GRUP ODAKLANMA ARAYÜZÜ (#group-focus-overlay, gf-*)
    // Bireysel Zamanlayıcı (#zamanlayici) ile birebir aynı görsel/işlevsel
    // desenleri uygular: dairesel SVG halka, alıntı rotasyonu, "Odak Modu" /
    // ghost-mode (3sn hareketsizlikte sadeleşme). Hem "Birlikte Odaklanma Odası"
    // (alışkanlık eşleştirme/oda tabanlı) hem de "⚡ Birlikte Çalışalım" (sohbetteki
    // yıldırım butonuyla başlatılan meydan okuma tabanlı) akışı bu TEK ortak
    // bileşeni besler ve aşağıdaki ortak gf* yardımcılarını paylaşır.
    // ══════════════════════════════════════════════════════
    let gfMode = null; // 'room' (Birlikte Odaklanma Odası) | 'challenge' (⚡ Birlikte Çalışalım)
    window._gfGetMode = () => gfMode;
    // _gfLeaveChoiceAC → social-group-focus-leave.js dosyasına taşındı.
    let _gfLeaveBtnAC = null;

    // ── Alıntı rotasyonu — social-focus-quote-rotation.js dosyasına taşındı
    // (Faz 2, 2026-07-19). GF_QUOTES/gfShowNextQuote/gfStartQuoteRotation/
    // gfStopQuoteRotation artık window.* üzerinden erişiliyor.

    // ── "Odak Modu" / Ghost Mode — social-group-focus-idle.js dosyasına
    // taşındı (Faz 2, 2026-07-19). gfIsRunning/gfGhostModeEnabled artık o
    // dosyada tamamen özel; buradan window.gfSetRunning()/
    // window.gfSetGhostModeEnabled() ile güncelleniyor. Diğer fonksiyonlar
    // (gfResetIdleTimer, gfEnsureIdleBindings, gfEnsureFocusModeBinding,
    // gfExitFocusMode) window.* üzerinden çağrılıyor.

    // ── Halka animasyonu — bireysel updateTimerDisplay() ile birebir aynı formül ──
    // gfUpdateRing → social-group-focus-render.js dosyasına taşındı (Faz 2,
    // 2026-07-19) — sadece parametre + DOM kullanıyor, window.* ile erişiliyor.

    // ── Metro Timeline Render ──
    // stations = [{type:'focus'|'break', label:'...'}], activeIndex = 0-based
    // gfRenderMetroTimeline → social-group-focus-render.js dosyasına taşındı
    // (Faz 2, 2026-07-19) — sadece parametre + DOM kullanıyor, window.* ile
    // erişiliyor.

    // ── Aşama göstergesi (Metro timeline + Tur sayacı + halka rengi) ──
    function gfApplyPhaseIndicator(phaseType, round, totalRounds) {
        const isBreak = phaseType === 'break' || phaseType === 'shortBreak' || phaseType === 'longBreak';
        const counterEl = document.getElementById('gf-round-counter');
        const roundEl   = document.getElementById('gf-round-count');
        const totalEl   = document.getElementById('gf-round-total');

        // totalRounds: parametre → sharedFocusTotalRounds (güvenilir JS değişkeni) → DOM → varsayılan 4
        const rounds = (totalRounds && totalRounds > 0)
            ? totalRounds
            : (sharedFocusTotalRounds > 0 ? sharedFocusTotalRounds : (parseInt(totalEl?.textContent) || 4));
        // round: parametre → DOM'dan al
        const currentRound = (round && round > 0)
            ? round
            : (parseInt(roundEl?.textContent) || 1);

        // DOM'u güncelle
        if (counterEl) counterEl.style.display = '';
        if (roundEl)   roundEl.textContent   = currentRound;
        if (totalEl)   totalEl.textContent   = rounds;

        // Metro timeline: Her tur: focus(2i), break(2i+1). Son tur için break yok.
        // Son tur'un breakini oluşturmadığımız için max index = 2*rounds - 2
        let activeIdx = isBreak
            ? (currentRound - 1) * 2 + 1
            : (currentRound - 1) * 2;
        // Son turda break yoksa sınırla
        const maxIdx = rounds * 2 - 2; // son focus indeksi
        activeIdx = Math.min(activeIdx, maxIdx + (isBreak ? 0 : 0));

        const focusMin = parseInt(document.getElementById('gf-duration-input')?.value) || 25;
        const breakMin = parseInt(document.getElementById('gf-break-input')?.value) || 10;
        window.gfRenderMetroTimeline(rounds, activeIdx, focusMin, breakMin);

        // Halka rengi
        const overlay = document.getElementById('group-focus-overlay');
        if (overlay) {
            overlay.classList.toggle('gf-phase-focus', !isBreak);
            overlay.classList.toggle('gf-phase-break', isBreak);
        }
    }

    // ── Yumuşak aşama geçiş ekranı — "☕ Mola Zamanı!" / "🧠 Odaklanma Başlıyor!" splash'i ──
    // "ODAK MODUNDA SOHBET SUSTURMA (hush)" bölümü social-focus-hush.js'e taşındı
    // (window.dcSetHushMode / window._hushedNotifQueue).

    function gfShowPhaseTransition(phase) {
        const el = document.getElementById('gf-phase-transition');
        const emojiEl = document.getElementById('gf-phase-transition-emoji');
        const textEl = document.getElementById('gf-phase-transition-text');
        if (!el || !emojiEl || !textEl) return;

        if (phase === 'break') {
            emojiEl.textContent = '☕';
            textEl.textContent = 'Mola Zamanı!';
            window.dcSetHushMode(false);
        } else {
            emojiEl.textContent = '🧠';
            textEl.textContent = 'Odaklanma Başlıyor!';
            window.dcSetHushMode(true);
        }

        if (sharedFocusPhaseTransitionTimeout) { clearTimeout(sharedFocusPhaseTransitionTimeout); sharedFocusPhaseTransitionTimeout = null; }
        el.classList.remove('hidden');
        requestAnimationFrame(() => el.classList.add('visible'));
        sharedFocusPhaseTransitionTimeout = setTimeout(() => {
            el.classList.remove('visible');
            sharedFocusPhaseTransitionTimeout = setTimeout(() => {
                el.classList.add('hidden');
                sharedFocusPhaseTransitionTimeout = null;
            }, 500);
        }, 2200);
    }

    function gfHidePhaseTransition() {
        const el = document.getElementById('gf-phase-transition');
        if (sharedFocusPhaseTransitionTimeout) { clearTimeout(sharedFocusPhaseTransitionTimeout); sharedFocusPhaseTransitionTimeout = null; }
        if (el) { el.classList.remove('visible'); el.classList.add('hidden'); }
    }

    // gfRenderParticipants → social-group-focus-render.js dosyasına taşındı
    // (Faz 2, 2026-07-19) — window.* ile erişiliyor.

    // ── Mola sohbeti — social-group-focus-break-chat.js dosyasına
    // taşındı (Faz 2, 2026-07-19). gfBreakChatPath artık
    // window.gfSetBreakChatPath() ile güncelleniyor; diğer fonksiyonlar
    // (gfAppendChatMessage, gfAlignBreakChat, gfToggleBreakChat,
    // gfSendBreakMessage, gfEnsureBreakChatBindings) window.* üzerinden
    // çağrılıyor.

    // ── Görev seçimi — social-group-focus-task-selector.js dosyasına
    // taşındı (Faz 2, 2026-07-19). window._gfGetMyTask()/_gfSetMyTask()
    // üzerinden sharedFocusMyTaskId/Text'e erişiyor.

    // ── "Ayrıl" seçim modalı — social-group-focus-leave.js dosyasına
    // taşındı (Faz 2, 2026-07-19 — en karmaşık yüksek risk parçası: oda
    // sahipliği devri + çoklu Supabase callback zinciri). gfMode/
    // currentRoomId/currentRoomIsHost/_cwRoomSupaChannel salt-okunur
    // getter'larla, minimizeSharedFocusOverlay/closeGroupFocusOverlay/
    // exitCWRoomLocal window.* köprüsüyle okunuyor.

    // ──────────────────────────────────────────────────────
    // ORTAK OVERLAY — AÇMA / KAPAMA (her iki akış için TEK nokta)
    // ──────────────────────────────────────────────────────
    function gfOpenOverlayShell() {
        const overlay = document.getElementById('group-focus-overlay');
        if (!overlay) return;
        overlay.style.display = 'flex';
        requestAnimationFrame(() => overlay.classList.add('visible'));
        gfHidePhaseTransition();
        window.gfExitFocusMode();
        window.gfEnsureIdleBindings();
        window.gfEnsureFocusModeBinding();
        window.gfEnsureTaskSelectorBindings();
        window.gfEnsureBreakChatBindings();
        gfEnsureDurationSettingsBindings();
        // Hidden input'ları aktif oturum değerleriyle senkronize et
        const sessionFocus = sharedFocusSession?.focusMinutes || Math.round((scwTimeLeft || 0) / 60) || 25;
        const sessionBreak = sharedFocusSession?.breakMinutes || sharedFocusBreakMinutes || 10;
        const sessionRounds = sharedFocusTotalRounds; // DOM'a bağımlı kalmak yerine güvenilir kaynaktan al
        const durInput = document.getElementById('gf-duration-input');
        const brkInput = document.getElementById('gf-break-input');
        const rndInput = document.getElementById('gf-rounds-input');
        const totalEl2 = document.getElementById('gf-round-total');
        if (durInput)  durInput.value  = sessionFocus;
        if (brkInput)  brkInput.value  = sessionBreak;
        if (rndInput)  rndInput.value  = sessionRounds;
        if (totalEl2)  totalEl2.textContent = sessionRounds;
        const stepperEl2 = document.getElementById('gf-rounds-stepper');
        if (stepperEl2) stepperEl2.value = sessionRounds;
        // Timeline'ı render et — seans zaten çalışıyorsa mevcut konumu hesapla
        const _initRound = gfComputeCurrentRound(sharedFocusSession, sessionRounds);
        const _initPhase = sharedFocusSession
            ? deriveSharedFocusPhase(sharedFocusSession, Date.now())
            : null;
        const _initIsBreak = _initPhase && _initPhase.type === 'break';
        const _initIdx = sharedFocusSession
            ? (_initIsBreak ? (_initRound - 1) * 2 + 1 : (_initRound - 1) * 2)
            : 0;
        window.gfRenderMetroTimeline(sessionRounds, _initIdx, sessionFocus, sessionBreak);

        const leaveBtn = document.getElementById('gf-leave-btn');
        if (leaveBtn) {
            if (_gfLeaveBtnAC) _gfLeaveBtnAC.abort();
            _gfLeaveBtnAC = new AbortController();
            leaveBtn.addEventListener('click', () => {
                if (sharedFocusSoloMode) {
                    minimizeSharedFocusOverlay();
                } else {
                    window.gfOpenLeaveChoiceModal();
                }
            }, { signal: _gfLeaveBtnAC.signal });
        }
    }

    // Overlay'i tamamen kapatır — tüm gf-* dinleyici/aralıkları temizler ama
    // mod-bağımlı (oda/meydan okuma) Firebase referanslarına dokunmaz
    function closeGroupFocusOverlay() {
        window.dcSetHushMode(false);
        const overlay = document.getElementById('group-focus-overlay');
        if (overlay) {
            overlay.classList.remove('visible', 'group-focus-mode-active', 'group-ghost-mode-active');
            overlay.style.display = 'none';
        }
        window.gfStopQuoteRotation();
        gfHidePhaseTransition();
        window.gfToggleBreakChat(false);
        window.gfExitFocusMode();
        window.gfSetRunning(false);
        window.gfSetBreakChatPath(null);
        document.getElementById('gf-leave-choice-modal')?.classList.add('hidden');
    }
    window.closeGroupFocusOverlay = closeGroupFocusOverlay;

    // Bireysel (oda dışı) odaklanma seansı için "Birlikte Çalışalım" arayüzüyle birebir aynı
    // görünümdeki tam ekranı besleyecek sahte bir "oda" nesnesi üretir — partner alanları boş kalır,
    // bu sayede renderSharedFocusParticipants/applySharedFocusPhase/renderSharedFocusTaskStatus
    // hiçbir özel dallanmaya gerek kalmadan aynı şekilde çalışır.
    function buildSoloFocusRoomLike() {
        return {
            hostName: currentUser?.displayName || 'Sen',
            guestName: null,
            hostTask: sharedFocusMyTaskId ? { id: sharedFocusMyTaskId, text: sharedFocusMyTaskText } : null,
            guestTask: null,
            startedAt: sharedFocusSession ? sharedFocusSession.startedAt : null,
            paused: sharedFocusSession ? !!sharedFocusSession.paused : false,
            pausedAt: sharedFocusSession ? sharedFocusSession.pausedAt : null,
            focusMinutes: sharedFocusSession ? sharedFocusSession.focusMinutes : (Math.round(scwTimeLeft / 60) || 25),
            breakMinutes: sharedFocusSession ? sharedFocusSession.breakMinutes : (sharedFocusBreakMinutes || SHARED_FOCUS_DEFAULT_BREAK_MINUTES)
        };
    }

    function openSharedFocusOverlay(linkedHabit, partnerName, solo) {
        const overlay = document.getElementById('group-focus-overlay');
        const titleEl = document.getElementById('gf-title');
        const creatorEl = document.getElementById('gf-creator');
        if (!overlay) return;

        gfMode = 'room';
        sharedFocusSoloMode = !!solo;
        sharedFocusPhaseInitialized = false;
        if (solo) _cwApplyRoleBasedUI(true, false, true); // solo modda tüm kontroller kullanıcıya ait

        if (titleEl) {
            titleEl.textContent = solo
                ? (linkedHabit ? `🎯 "${linkedHabit.name}" için Bireysel Odaklanma` : '🎯 Bireysel Odaklanma')
                : (linkedHabit ? `🤝 "${linkedHabit.name}" için Birlikte Odaklanma` : '🤝 Birlikte Odaklanma Odası');
        }
        if (creatorEl) {
            creatorEl.textContent = solo ? '' : (partnerName ? `Partner: ${partnerName}` : '');
        }

        gfOpenOverlayShell();
        // Oda modunda sohbet kutusu doğrudan cw_rooms/.../chat'e yazar (attachSharedFocusChatListener ile dinlenir);
        // bireysel modda partner olmadığından sohbet yolu yok.
        window.gfSetBreakChatPath((!solo && currentRoomId && _cwRoomIsSupabase)
            ? { ref: 'focus_session_supabase', scopeId: currentRoomId }
            : null);
        gfEnsureRoomControlBindings();
        ensureSharedFocusReturnButtonBinding();
        window.gfPopulateTaskDropdown();
        window.gfApplyActiveTaskDisplay();
        applySharedFocusModePill(sharedFocusSession ? sharedFocusSession.focusMinutes : (Math.round(scwTimeLeft / 60) || 25));
        applySharedFocusBreakPill(sharedFocusBreakMinutes || SHARED_FOCUS_DEFAULT_BREAK_MINUTES);
        syncSharedFocusTimerUI();
        if (sharedFocusDisplaySyncInterval) clearInterval(sharedFocusDisplaySyncInterval);
        sharedFocusDisplaySyncInterval = setInterval(syncSharedFocusTimerUI, 500);
    }
    window.openSharedFocusOverlay = openSharedFocusOverlay; // social-dc-message-cards.js için

    function closeSharedFocusOverlay() {
        closeGroupFocusOverlay();
        if (sharedFocusDisplaySyncInterval) { clearInterval(sharedFocusDisplaySyncInterval); sharedFocusDisplaySyncInterval = null; }
        if (sharedFocusBreakInterval) { clearInterval(sharedFocusBreakInterval); sharedFocusBreakInterval = null; }
        sharedFocusInFocusMode = false;
        sharedFocusPhaseInitialized = false;
        sharedFocusSoloMode = false;
        gfMode = null;
    }

    // "Odadasın" çubuğundaki odaklanmaya dönüş butonu — sadece kullanıcı mevcut
    // bir odaklanma oturumunu "Sadece Arayüzden Ayrıl" ile küçültüp (oturum
    // arka planda canlı kalırken) başka bir yere baktığında görünür.
    function _syncFocusReturnMiniBtn() {
        const btn = document.getElementById('dc-leave-bar-focus-return-btn');
        if (btn) btn.style.display = sharedFocusMinimized ? 'flex' : 'none';
    }

    // "Sadece Arayüzden Ayrıl" — overlay'i gizler ama oturumu/zamanlayıcıyı CANLI bırakır.
    // scwTimerInterval kasıtlı olarak durdurulmaz; kullanıcı Mini Odak Odası'ndaki
    // "Ortak Odaklanma Arayüzüne Dön" butonuyla istediği zaman aynı arayüze geri dönebilir.
    function minimizeSharedFocusOverlay() {
        const overlay = document.getElementById('group-focus-overlay');
        if (overlay) { overlay.classList.remove('visible'); overlay.style.display = 'none'; }
        if (sharedFocusDisplaySyncInterval) { clearInterval(sharedFocusDisplaySyncInterval); sharedFocusDisplaySyncInterval = null; }
        window.gfStopQuoteRotation();
        window.gfExitFocusMode();
        sharedFocusInFocusMode = false;

        sharedFocusMinimized = true;
        const returnBtn = document.getElementById('scw-return-shared-focus-btn');
        if (returnBtn) returnBtn.classList.remove('hidden');
        _syncFocusReturnMiniBtn();

        if (typeof showPremiumModal === 'function') {
            const returnLabel = sharedFocusSoloMode ? 'Odaklanma Arayüzüne Dön' : 'Ortak Odaklanma Arayüzüne Dön';
            showPremiumModal({ title: '🔻 Arayüzden Ayrıldın', message: `Zamanlayıcı arka planda akmaya devam ediyor. İstediğin zaman Mini Odak Odası'ndaki "${returnLabel}" butonuyla geri dönebilirsin.`, type: 'info' });
        }
    }
    window.minimizeSharedFocusOverlay = minimizeSharedFocusOverlay;

    // Geriye dönük uyumluluk: artık tüm "ayrıl" akışı ortak gfOpenLeaveChoiceModal'a yönlenir
    function openSharedFocusLeaveChoiceModal() {
        window.gfOpenLeaveChoiceModal();
    }

    // Mini Odak Odası'ndaki "Ortak Odaklanma Arayüzüne Dön" butonu — tek seferlik bağlanır
    let sharedFocusReturnBtnBound = false;
    function ensureSharedFocusReturnButtonBinding() {
        if (sharedFocusReturnBtnBound) return;
        const btn = document.getElementById('scw-return-shared-focus-btn');
        if (!btn) return;
        sharedFocusReturnBtnBound = true;
        btn.addEventListener('click', () => {
            restoreSharedFocusOverlay();
        });
    }

    // Mini Odak Odası'ndan tekrar tam ekran ortak odaklanma arayüzüne dönüş
    function restoreSharedFocusOverlay() {
        if (!currentRoomId && !sharedFocusSoloMode) return;
        sharedFocusMinimized = false;
        gfMode = 'room';
        gfOpenOverlayShell();
        gfEnsureRoomControlBindings();
        ensureSharedFocusReturnButtonBinding();
        window.gfPopulateTaskDropdown();
        window.gfApplyActiveTaskDisplay();
        syncSharedFocusTimerUI();
        if (sharedFocusDisplaySyncInterval) clearInterval(sharedFocusDisplaySyncInterval);
        sharedFocusDisplaySyncInterval = setInterval(syncSharedFocusTimerUI, 500);

        const returnBtn = document.getElementById('scw-return-shared-focus-btn');
        if (returnBtn) returnBtn.classList.add('hidden');
        _syncFocusReturnMiniBtn();
    }

    // ──────────────────────────────────────────────────────
    // PARTNER / KATILIMCI BİLGİSİ — "Birlikte Çalışalım" arayüzündeki
    // katılımcı kartlarıyla aynı görünümde gösterir
    // ──────────────────────────────────────────────────────
    function renderSharedFocusParticipants(room) {
        const people = [];
        if (sharedFocusSoloMode) {
            people.push(currentUser?.displayName || 'Sen');
        } else {
            (room.members || []).forEach(m => { if (m.displayName) people.push(m.displayName); });
        }
        window.gfRenderParticipants(people);
    }

    // Bireysel arayüzdeki .timer-modes (Odaklanma/Mola sekmeleri) ile birebir aynı
    // göstergeyi günceller — "Tur" sayacı oda modunda partner bilgisini taşır
    function updateSharedFocusPhaseLabel(room, isHost, phase) {
        const _currentRound = gfComputeCurrentRound(sharedFocusSession, sharedFocusTotalRounds);
        gfApplyPhaseIndicator(phase, _currentRound, sharedFocusTotalRounds);
        const counterEl = document.getElementById('gf-round-counter');
        if (!counterEl) return;

        if (sharedFocusSoloMode) {
            counterEl.innerHTML = (phase === 'break')
                ? '<i class="fa-solid fa-mug-hot"></i> Kısa bir mola ver — birazdan tekrar odaklanmaya devam edeceksin.'
                : (currentRoomLinkedHabit
                    ? `<i class="fa-solid fa-bullseye"></i> "${_escapeHtml(currentRoomLinkedHabit.name)}" alışkanlığın için tek başına odaklanıyorsun.`
                    : '<i class="fa-solid fa-bullseye"></i> Tek başına odaklanıyorsun — devam et!');
            counterEl.style.display = '';
            return;
        }

        const partner = _cwOthersLabel(room);
        if (!partner) {
            counterEl.innerHTML = '<i class="fa-solid fa-hourglass-half"></i> Partnerin katılması bekleniyor...';
        } else if (phase === 'break') {
            counterEl.innerHTML = `<i class="fa-solid fa-mug-hot"></i> ${_escapeHtml(partner)} ile moladasınız — sohbet edebilirsiniz.`;
        } else if (currentRoomLinkedHabit) {
            counterEl.innerHTML = `<i class="fa-solid fa-people-arrows"></i> ${_escapeHtml(partner)} ile "${_escapeHtml(currentRoomLinkedHabit.name)}" ortak alışkanlığınız için odaklanıyorsunuz.`;
        } else {
            counterEl.innerHTML = `<i class="fa-solid fa-people-arrows"></i> ${_escapeHtml(partner)} ile birlikte odaklanıyorsunuz.`;
        }
        counterEl.style.display = '';
    }

    // ──────────────────────────────────────────────────────
    // OTOMATİK MOLA DÖNGÜSÜ
    // ──────────────────────────────────────────────────────
    const SHARED_FOCUS_DEFAULT_BREAK_MINUTES = 10; // Oda kurulurken varsayılan mola süresi (kullanıcılar arayüzden değiştirebilir)

    // Mola geri sayımını ekranda gösterir — yalnızca görsel; faz geçişi artık tamamen
    // startedAt'tan türetildiği için burada Firebase'e hiçbir yazma yapılmaz
    // (grup odaklanmasındaki gibi her client kendi ekranını bağımsız hesaplar).
    function startSharedBreakCountdownUI(breakEndsAt) {
        if (sharedFocusBreakInterval) clearInterval(sharedFocusBreakInterval);
        const counterEl = document.getElementById('gf-round-counter');
        const tick = () => {
            const remain = Math.max(0, Math.round((breakEndsAt - Date.now()) / 1000));
            const m = Math.floor(remain / 60);
            const s = remain % 60;
            if (counterEl) counterEl.innerHTML = `<i class="fa-solid fa-mug-hot"></i> Mola bitmesine kalan süre: ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
            if (remain <= 0) {
                clearInterval(sharedFocusBreakInterval);
                sharedFocusBreakInterval = null;
            }
        };
        tick();
        sharedFocusBreakInterval = setInterval(tick, 1000);
    }

    function applySharedFocusPhase(room, isHost) {
        // Faz artık odada saklanmıyor — grup odaklanmasındaki gibi yalnızca
        // startedAt/paused/pausedAt'tan türetiliyor (komut round-trip'i yok)
        let newPhase = 'work';
        let derivedPh = null;
        if (room.startedAt && sharedFocusSession) {
            derivedPh = deriveSharedFocusPhase(sharedFocusSession, Date.now());
            if (derivedPh) newPhase = (derivedPh.type === 'break') ? 'break' : 'work';
        }

        updateSharedFocusPhaseLabel(room, isHost, newPhase);

        const phaseChanged = sharedFocusPhaseInitialized && newPhase !== currentRoomPhase;
        currentRoomPhase = newPhase;

        // Faz gerçekten değiştiyse (ilk yüklemede değil) yumuşak geçiş ekranını göster
        if (phaseChanged) {
            gfShowPhaseTransition(newPhase);
        }
        sharedFocusPhaseInitialized = true;

        if (room.breakMinutes) {
            sharedFocusBreakMinutes = room.breakMinutes;
        }

        if (newPhase === 'break' && derivedPh) {
            startSharedBreakCountdownUI(Date.now() + derivedPh.remainingMs);
        } else if (sharedFocusBreakInterval) {
            clearInterval(sharedFocusBreakInterval);
            sharedFocusBreakInterval = null;
        }

        // Sohbetin görünürlüğü artık sadece molaya değil, faz + çalışma durumuna göre belirlenir
        recalcSharedFocusChatVisibility();
        gfApplyFocusModeFromState();
    }

    // Çalışma durumu değiştiğinde "Odak Modu"na uygun şekilde alıntı rotasyonunu/ghost-mode iznini günceller
    function gfApplyFocusModeFromState() {
        const shouldFocus = isScwRunning && currentRoomPhase !== 'break';
        window.gfSetRunning(shouldFocus);
        if (shouldFocus !== sharedFocusInFocusMode) {
            sharedFocusInFocusMode = shouldFocus;
            if (shouldFocus) window.gfStartQuoteRotation();
            else window.gfStopQuoteRotation();
            // Yalnızca durum GERÇEKTEN değiştiğinde yeniden tetikle — her tick'te
            // çağrılırsa zamanlayıcı sürekli sıfırlanır ve ghost-mode hiç tetiklenmez
            window.gfResetIdleTimer();
        }
    }

    // "Sonraki Aşamaya Geç" — hangi taraf basarsa bassın (host ya da partner), kalan süre
    // kadar startedAt'ı geriye kaydırarak fazı anında bir sonrakine düşürür. Grup
    // odaklanmasındaki "skip" ile birebir aynı teknik — ayrı bir faz alanı yazılmaz,
    // her iki taraf da güncellenen startedAt'tan kendi ekranını yeniden türetir.
    function applySharedFocusSkip(room) {
        if (!currentRoomId || !room.startedAt) return;
        const session = sharedFocusSession || {
            startedAt: room.startedAt, paused: !!room.paused, pausedAt: room.pausedAt || null,
            focusMinutes: room.focusMinutes || 25,
            breakMinutes: room.breakMinutes || sharedFocusBreakMinutes || SHARED_FOCUS_DEFAULT_BREAK_MINUTES
        };
        const update = buildSharedFocusSkipUpdate(session, Date.now());
        if (!update) return;
        if (_cwRoomIsSupabase && window.FocusSupabase) {
            window.FocusSupabase.from('cw_rooms').update({
                started_at: new Date(update.startedAt).toISOString(),
                paused: false, paused_at: null
            }).eq('id', currentRoomId).then(() => {});
        }
    }

    // Başlat/Devam Et — grup odaklanmasındaki gibi doğrudan startedAt/paused/pausedAt yazar,
    // hiçbir 'command' round-trip'i yok; her iki taraf da roomRef değişikliğinden anında türetir
    function requestSharedFocusStart() {
        if (currentRoomId && _cwRoomIsSupabase && window.FocusSupabase) {
            window.FocusSupabase.from('cw_rooms').select('started_at, paused, paused_at').eq('id', currentRoomId).single()
                .then(({ data: row, error }) => {
                    if (error || !row) return;
                    const now = new Date().toISOString();
                    if (row.started_at && row.paused) {
                        const session = { startedAt: new Date(row.started_at).getTime(), paused: true, pausedAt: row.paused_at ? new Date(row.paused_at).getTime() : null };
                        const upd = buildSharedFocusResumeUpdate(session, Date.now());
                        window.FocusSupabase.from('cw_rooms').update({
                            started_at: new Date(upd.startedAt).toISOString(),
                            paused: false, paused_at: null
                        }).eq('id', currentRoomId).then(() => {});
                    } else if (!row.started_at) {
                        window.FocusSupabase.from('cw_rooms').update({ started_at: now, paused: false, paused_at: null }).eq('id', currentRoomId).then(() => {});
                    }
                });
        } else {
            startLocalScw();
        }
    }

    // Duraklat/Devam Et — anlık durumu okuyup tersine çevirir (grup odaklanmasındaki pause-toggle ile aynı)
    function requestSharedFocusPauseToggle() {
        if (currentRoomId && _cwRoomIsSupabase && window.FocusSupabase) {
            window.FocusSupabase.from('cw_rooms').select('started_at, paused, paused_at').eq('id', currentRoomId).single()
                .then(({ data: row, error }) => {
                    if (error || !row || !row.started_at) return;
                    if (!row.paused) {
                        window.FocusSupabase.from('cw_rooms').update({ paused: true, paused_at: new Date().toISOString() }).eq('id', currentRoomId).then(() => {});
                    } else {
                        const session = { startedAt: new Date(row.started_at).getTime(), paused: true, pausedAt: row.paused_at ? new Date(row.paused_at).getTime() : null };
                        const upd = buildSharedFocusResumeUpdate(session, Date.now());
                        window.FocusSupabase.from('cw_rooms').update({
                            started_at: new Date(upd.startedAt).toISOString(),
                            paused: false, paused_at: null
                        }).eq('id', currentRoomId).then(() => {});
                    }
                });
        } else if (isScwRunning) {
            pauseLocalScw();
        } else {
            startLocalScw();
        }
    }

    function requestSharedFocusReset() {
        if (currentRoomId && _cwRoomIsSupabase && window.FocusSupabase) {
            window.FocusSupabase.from('cw_rooms').update({ started_at: null, paused: false, paused_at: null }).eq('id', currentRoomId).then(() => {});
        } else {
            resetScwTimer();
        }
    }

    // Oda/bireysel modda gf-* halkasını ve kontrol butonlarını 500ms'de bir
    // türetilmiş zamana göre günceller — bireysel zamanlayıcının `updateTimerDisplay`
    // deseniyle birebir aynı (her iki taraf da yalnızca startedAt'tan kendi ekranını çizer)
    function syncSharedFocusTimerUI() {
        const startBtn = document.getElementById('gf-start-btn');
        const pauseBtn = document.getElementById('gf-pause-btn');
        const pauseIcon = document.getElementById('gf-pause-icon');
        if (sharedFocusSession) {
            const ph = deriveSharedFocusPhase(sharedFocusSession, Date.now());
            if (ph) {
                window.gfUpdateRing(ph.remainingMs, ph.durMs);
                const currentRound = gfComputeCurrentRound(sharedFocusSession, sharedFocusTotalRounds);
                gfApplyPhaseIndicator(ph.type === 'break' ? 'break' : 'focus', currentRound, sharedFocusTotalRounds);
            }
            if (startBtn) startBtn.classList.add('hidden');
            if (pauseBtn) pauseBtn.classList.remove('hidden');
            if (pauseIcon) pauseIcon.className = sharedFocusSession.paused ? 'fa-solid fa-play' : 'fa-solid fa-pause';
        } else {
            const totalMs = Math.max(0, (scwTimeLeft || 0)) * 1000;
            window.gfUpdateRing(totalMs, totalMs || 1);
            gfApplyPhaseIndicator('focus', 1, sharedFocusTotalRounds);
            if (startBtn) startBtn.classList.remove('hidden');
            if (pauseBtn) pauseBtn.classList.add('hidden');
            if (pauseIcon) pauseIcon.className = 'fa-solid fa-pause';
        }
    }

    // Elapsed time'dan kaçıncı odak turunda olduğumuzu hesapla (1-indexed)
    function gfComputeCurrentRound(session, totalRounds) {
        if (!session || !session.startedAt) return 1;
        const focusMs = Math.max(1, (session.focusMinutes || 25)) * 60000;
        const breakMs = Math.max(0, (session.breakMinutes || 0)) * 60000;
        const refNow  = (session.paused && session.pausedAt) ? session.pausedAt : Date.now();
        const elapsed = Math.max(0, refNow - session.startedAt);
        if (breakMs <= 0) return 1;
        const cycleMs  = focusMs + breakMs;
        const cycleNum = Math.floor(elapsed / cycleMs) + 1; // kaçıncı döngü (1-indexed)
        return Math.min(cycleNum, totalRounds);
    }

    // ──────────────────────────────────────────────────────
    // MOLA SOHBETİ — "Birlikte Çalışalım" odasındaki mola sohbetiyle
    // birebir aynı stil/sınıflar (cws-bc-*) kullanılarak uygulanır
    // ──────────────────────────────────────────────────────
    // Sadece görünürlüğü değiştirir — mesaj geçmişi korunur (sohbet sürekli dinleniyor,
    // yalnızca odaklanma çalışırken gizleniyor, durunca/molada tekrar açılıyor)
    function toggleSharedFocusBreakChat(show) {
        const chatEl = document.getElementById('gf-break-chat');
        if (!chatEl) return;
        chatEl.classList.toggle('visible', !!show);
        // Bireysel modda panel açılınca mola mesajını göster (Firebase bağlantısı yok)
        if (show && sharedFocusSoloMode) {
            const msgsEl = document.getElementById('gf-break-chat-messages');
            if (msgsEl && msgsEl.querySelector('.cws-bc-empty')) {
                msgsEl.innerHTML = '<div class="cws-bc-empty">☕ Mola zamanı! Biraz dinlen, su iç.</div>';
            }
            const inputRow = chatEl.querySelector('.cws-bc-input-row');
            if (inputRow) inputRow.style.display = 'none';
        } else if (!show && sharedFocusSoloMode) {
            const inputRow = chatEl.querySelector('.cws-bc-input-row');
            if (inputRow) inputRow.style.display = '';
        }
    }

    // ──────────────────────────────────────────────────────
    // GÖREV SEÇİMİ — kullanıcılar o günkü görevlerinden birine
    // (veya hiçbirine — genel odaklanma) odaklanmayı seçebilir; ayrı ayrı
    // farklı görevlere odaklanabilir ya da aynı görevi seçip birlikte çalışabilirler.
    // ──────────────────────────────────────────────────────
    function populateSharedFocusTaskSelect() {
        window.gfPopulateTaskDropdown();
        window.gfApplyActiveTaskDisplay();
    }

    function writeSharedFocusMyTask(taskId, taskText) {
        if (!currentRoomId) return;
        if (_cwRoomIsSupabase && window.FocusSupabase && currentUser?.id) {
            window.FocusSupabase.from('cw_room_members')
                .update({ task_id: taskId || null, task_text: taskText || null })
                .eq('room_id', currentRoomId).eq('user_id', currentUser.id)
                .then(({ error }) => { if (error) console.error('[FocusAI] görev yazma hatası', error); });
            return;
        }
    }
    window.writeSharedFocusMyTask = writeSharedFocusMyTask;

    // Birleştirilmiş arayüzde ayrı bir görev-durumu paneli yok — görev bilgisi
    // doğrudan `.active-focus-task` alanında (gfApplyActiveTaskDisplay) gösteriliyor.
    function renderSharedFocusTaskStatus(room, isHost) {}

    // ── Katılımcı → Sahip: Duraklat/Başlat/Sonraki Aşama İSTEĞİ ──────────
    // Sahip olmayan bir katılımcı pause/skip'e bastığında doğrudan uygulamak
    // yerine sahibe broadcast ile istek gönderir; sahip onaylarsa kendi
    // client'ında gerçek aksiyonu tetikler ve sonucu `request_result` ile
    // isteği gönderene bildirir (grup challenge'ındaki istek/onay deseniyle
    // aynı ruhta, rooms için yeniden yazıldı).
    let _cwPendingControlRequest = null; // sahip tarafında bekleyen istek: { reqType, displayName }
    // Spam koruması: bir istek yanıtlanana kadar (approve/deny/timeout) veya
    // en fazla 10 sn boyunca yeni istek gönderilemez. Cooldown DOLMADAN üst
    // üste denemeye devam edilirse (ör. reddedilince hemen tekrar basmak),
    // yanlış parola kilidi gibi 1 dakikalık tam kilitlenme devreye girer ve
    // butonlar geçici olarak devre dışı bırakılır.
    let _cwMyRequestInFlight = false;
    let _cwRequestSpamAttempts = 0;
    let _cwRequestLockoutUntil = 0;
    const CW_REQUEST_COOLDOWN_MS = 10000;
    const CW_REQUEST_SPAM_THRESHOLD = 3;
    const CW_REQUEST_LOCKOUT_MS = 60000;

    function _cwSetControlBtnsDisabled(disabled) {
        ['gf-start-btn', 'gf-pause-btn', 'gf-skip-btn'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.disabled = disabled;
        });
    }

    function _cwSendControlRequest(reqType) {
        if (!_cwRoomSupaChannel || !currentUser) return;
        if (!_cwRoomAllowRequests) return; // owner istek göndermeyi tamamen kapatmış

        const now = Date.now();
        if (now < _cwRequestLockoutUntil) {
            const secsLeft = Math.ceil((_cwRequestLockoutUntil - now) / 1000);
            window.dcShowToast?.(`Çok fazla istek gönderdin — ${secsLeft} sn sonra tekrar dene.`);
            return;
        }

        if (_cwMyRequestInFlight) {
            _cwRequestSpamAttempts++;
            if (_cwRequestSpamAttempts >= CW_REQUEST_SPAM_THRESHOLD) {
                _cwRequestLockoutUntil = now + CW_REQUEST_LOCKOUT_MS;
                _cwRequestSpamAttempts = 0;
                _cwSetControlBtnsDisabled(true);
                setTimeout(() => { _cwSetControlBtnsDisabled(false); }, CW_REQUEST_LOCKOUT_MS);
                window.dcShowToast?.('Çok fazla istek gönderdin — 1 dakika boyunca butonlar devre dışı.');
            } else {
                window.dcShowToast?.('Zaten bekleyen bir isteğin var — yanıt bekle.');
            }
            return;
        }

        _cwRequestSpamAttempts = 0;
        _cwMyRequestInFlight = true;
        setTimeout(() => { _cwMyRequestInFlight = false; }, CW_REQUEST_COOLDOWN_MS);
        _cwRoomSupaChannel.send({
            type: 'broadcast', event: 'participant_request',
            payload: { reqType, displayName: currentUser.displayName || currentUser.username || 'Kullanıcı' }
        });
        const labels = { start: 'Başlatma', pause: 'Duraklatma', resume: 'Başlatma', skip: 'Sonraki aşama' };
        window.dcShowToast?.(`${labels[reqType] || 'İstek'} isteği gönderildi ✋`);
    }

    function _cwShowIncomingControlRequest(reqType, displayName) {
        _cwPendingControlRequest = { reqType, displayName };
        document.getElementById('cw-control-request-toast')?.remove();
        const labels = { start: 'başlatmak', pause: 'duraklatmak', resume: 'başlatmak', skip: 'sonraki aşamaya geçmek' };
        const box = document.createElement('div');
        box.id = 'cw-control-request-toast';
        box.style.cssText = 'position:fixed; top:20px; left:50%; transform:translateX(-50%); z-index:10400; background:rgba(18,16,40,0.97); border:1px solid rgba(212,144,14,0.4); border-radius:14px; padding:14px 18px; box-shadow:0 8px 32px rgba(0,0,0,0.55); display:flex; align-items:center; gap:12px; max-width:90vw;';
        box.innerHTML = `
            <span style="color:#fff; font-size:13px;"><b>${_escapeHtml(displayName)}</b> odayı ${labels[reqType] || 'yönetmek'} istiyor ✋</span>
            <button id="cw-control-req-approve" style="background:#2ed573; border:none; color:#000; font-weight:700; padding:6px 12px; border-radius:8px; cursor:pointer; font-size:12px;">Onayla</button>
            <button id="cw-control-req-deny" style="background:rgba(255,255,255,0.1); border:none; color:#fff; padding:6px 12px; border-radius:8px; cursor:pointer; font-size:12px;">Reddet</button>
        `;
        document.body.appendChild(box);
        const cleanup = () => { box.remove(); _cwPendingControlRequest = null; };
        document.getElementById('cw-control-req-approve').addEventListener('click', () => {
            cleanup();
            if (reqType === 'start') requestSharedFocusStart();
            if (reqType === 'pause' || reqType === 'resume') requestSharedFocusPauseToggle();
            if (reqType === 'skip' && currentRoomId && window.FocusSupabase) {
                window.FocusSupabase.from('cw_rooms').select('*').eq('id', currentRoomId).single()
                    .then(({ data: row }) => { if (row) applySharedFocusSkip(_cwNormalizeSupaRoom(row)); });
            }
            _cwRoomSupaChannel?.send({ type: 'broadcast', event: 'request_result', payload: { reqType, approved: true } });
        });
        document.getElementById('cw-control-req-deny').addEventListener('click', () => {
            cleanup();
            _cwRoomSupaChannel?.send({ type: 'broadcast', event: 'request_result', payload: { reqType, approved: false } });
        });
        setTimeout(() => { if (document.getElementById('cw-control-request-toast')) cleanup(); }, 15000);
    }

    // Odada geriye tek kişi kalınca ("partnerin ayrıldı") gösterilen soru —
    // JS ile dinamik oluşturulan modal (gf-habit-complete-overlay ile aynı desen).
    function _cwShowSoloContinuePrompt(leftDisplayName) {
        document.getElementById('gf-solo-continue-overlay')?.remove();
        const overlay = document.createElement('div');
        overlay.id = 'gf-solo-continue-overlay';
        overlay.className = 'modal-overlay';
        overlay.style.cssText = 'z-index:10400;';
        overlay.innerHTML = `
            <div class="modal-content glass-panel" style="max-width:370px; text-align:center; padding:28px 24px;">
                <div style="font-size:32px; margin-bottom:12px;">🚪</div>
                <h3 style="margin:0 0 8px; font-size:17px; color:#fff;">${_escapeHtml(leftDisplayName)} oturumdan ayrıldı</h3>
                <p style="color:var(--text-muted); font-size:13px; margin:0 0 22px;">Odada yalnız kaldın. Tek başına odaklanmaya devam etmek ister misin?</p>
                <div style="display:flex; flex-direction:column; gap:10px;">
                    <button id="gf-solo-continue-yes-btn" class="control-btn primary" style="width:100%; padding:12px;">
                        <i class="fa-solid fa-person-running"></i> Evet, Devam Et
                    </button>
                    <button id="gf-solo-continue-no-btn" class="control-btn" style="width:100%; padding:12px; background:rgba(255,255,255,0.05);">
                        <i class="fa-solid fa-flag-checkered"></i> Hayır, Oturumu Bitir
                    </button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        document.getElementById('gf-solo-continue-yes-btn').addEventListener('click', () => overlay.remove());
        document.getElementById('gf-solo-continue-no-btn').addEventListener('click', () => {
            overlay.remove();
            gfDoEndSession();
        });
    }

    function gfEnsureRoomControlBindings() {
        if (sharedFocusBindingsReady) return;
        sharedFocusBindingsReady = true;

        document.getElementById('gf-start-btn')?.addEventListener('click', () => {
            if (gfMode !== 'room') return; // challenge modunda kendi handler'ı çalışır
            if (!sharedFocusSoloMode && !_cwHasDirectControl()) {
                _cwSendControlRequest('start');
                return;
            }
            // Bir grup sohbetinden gönderilmiş, henüz başlamamış bir davet varsa:
            // oturumu başlatınca artık kimse katılamayacağı için önce onay iste.
            if (_cwInviteMsgId && !sharedFocusSession) {
                if (typeof window.dcShowConfirm === 'function') {
                    window.dcShowConfirm({
                        title: 'Oturumu Başlat',
                        message: 'Oturumu başlattıktan sonra başka kullanıcı katılamaz. Devam etmek istiyor musun?',
                        confirmText: 'Oturumu Başlat',
                        cancelText: 'Vazgeç',
                        danger: false,
                        icon: 'fa-play',
                        onConfirm: () => {
                            _cwDeleteInviteMessage();
                            requestSharedFocusStart();
                        }
                    });
                    return;
                }
                _cwDeleteInviteMessage();
            }
            requestSharedFocusStart();
        });
        document.getElementById('gf-pause-btn')?.addEventListener('click', () => {
            if (gfMode !== 'room') return;
            if (!sharedFocusSoloMode && !_cwHasDirectControl()) {
                _cwSendControlRequest(sharedFocusSession?.paused ? 'resume' : 'pause');
                return;
            }
            requestSharedFocusPauseToggle();
        });
        document.getElementById('gf-skip-btn')?.addEventListener('click', () => {
            if (sharedFocusSoloMode) {
                if (!sharedFocusSession) return;
                const update = buildSharedFocusSkipUpdate(sharedFocusSession, Date.now());
                if (update) sharedFocusSession = Object.assign({}, sharedFocusSession, update);
                return;
            }
            if (!currentRoomId) return;
            if (!_cwHasDirectControl()) { _cwSendControlRequest('skip'); return; }
            if (_cwRoomIsSupabase && window.FocusSupabase) {
                window.FocusSupabase.from('cw_rooms').select('*').eq('id', currentRoomId).single()
                    .then(({ data: row }) => { if (row) applySharedFocusSkip(_cwNormalizeSupaRoom(row)); });
            }
        });

        // ── Oturumu Bitir: onay modalını göster ──
        document.getElementById('gf-end-session-btn')?.addEventListener('click', () => {
            if (gfMode !== 'room') return;
            try { gfOpenEndSessionModal(); } catch (e) { console.error('[CW-DEBUG] gfOpenEndSessionModal hatası:', e); }
        });

        // ── Oturumu Bitir Modal: İptal ──
        document.getElementById('gf-end-cancel-btn')?.addEventListener('click', () => {
            document.getElementById('gf-end-session-modal')?.classList.add('hidden');
        });
        document.getElementById('gf-end-session-modal')?.addEventListener('click', (e) => {
            if (e.target === document.getElementById('gf-end-session-modal'))
                document.getElementById('gf-end-session-modal').classList.add('hidden');
        });

        // ── Oturumu Bitir Modal: Onayla — gfMode'a göre yönlendir ──
        document.getElementById('gf-end-confirm-btn')?.addEventListener('click', () => {
            document.getElementById('gf-end-session-modal')?.classList.add('hidden');
            try { gfDoEndSession(); } catch (e) { console.error('[CW-DEBUG] gfDoEndSession hatası:', e); }
        });

        // ── Ayarlar: Yeniden Başlat butonu ──
        document.getElementById('gf-settings-restart-btn')?.addEventListener('click', () => {
            document.getElementById('gf-settings-modal')?.classList.add('hidden');
            document.getElementById('gf-restart-confirm-modal')?.classList.remove('hidden');
        });

        // ── Yeniden Başlat Modal: İptal ──
        document.getElementById('gf-restart-cancel-btn')?.addEventListener('click', () => {
            document.getElementById('gf-restart-confirm-modal')?.classList.add('hidden');
        });

        // ── Yeniden Başlat Modal: Onayla → daveti gönder ekranına geri dön ──
        document.getElementById('gf-restart-go-btn')?.addEventListener('click', () => {
            document.getElementById('gf-restart-confirm-modal')?.classList.add('hidden');
            gfDoEndSession(/* reopen= */ true);
        });
    }

    function gfOpenEndSessionModal() {
        const mins = (typeof cwFocusedMinutes === 'function') ? cwFocusedMinutes() : 0;
        const rounds = parseInt(document.getElementById('gf-round-count')?.textContent) || 0;
        const timeEl = document.getElementById('gf-end-stat-time');
        const roundsEl = document.getElementById('gf-end-stat-rounds');
        if (timeEl) timeEl.textContent = mins > 0 ? `${mins} dk` : '< 1 dk';
        if (roundsEl) roundsEl.textContent = rounds;
        const m = document.getElementById('gf-end-session-modal');
        m?.classList.remove('hidden');
        setTimeout(() => {
            if (!m) return;
            const el = document.elementFromPoint(window.innerWidth/2, window.innerHeight/2);
        }, 100);
    }

    function _gfFinalizeEndSession() {
        if (currentRoomId && _cwRoomIsSupabase && window.FocusSupabase) {
            window.FocusSupabase.from('cw_rooms').update({
                active: false,
                ended_by_id: currentUser?.id || null,
                ended_by_name: currentUser?.displayName || null,
                ended_at: new Date().toISOString()
            }).eq('id', currentRoomId).then(() => {});
        }
        // Oturum hiç başlamadan bitirildiyse, gruba gönderilmiş davet kartı da
        // artık geçersiz — sohbetten kaldır.
        if (_cwInviteMsgId && !sharedFocusSession) _cwDeleteInviteMessage();
        closeGroupFocusOverlay();
        exitCWRoomLocal();
    }

    function gfDoEndSession(reopenSetup) {
        const mins = (typeof cwFocusedMinutes === 'function') ? cwFocusedMinutes() : 0;
        if (mins > 0 && typeof FocusStorage !== 'undefined') {
            FocusStorage.set('total_focus_minutes', (FocusStorage.get('total_focus_minutes', 0) || 0) + mins);
            FocusStorage.set('focus_minutes', (FocusStorage.get('focus_minutes', 0) || 0) + mins);
            const _td = new Date();
            const _key = String(_td.getDate()).padStart(2,'0')+'-'+String(_td.getMonth()+1).padStart(2,'0')+'-'+_td.getFullYear();
            const _fh = FocusStorage.get('focus_history', {});
            _fh[_key] = (_fh[_key] || 0) + mins;
            FocusStorage.set('focus_history', _fh);
            if (typeof renderStatisticsRef === 'function') setTimeout(() => renderStatisticsRef(), 300);
        }

        if (reopenSetup) {
            gfDoRestartSession();
            return;
        }

        // Ortak alışkanlık bağlıysa tamamlama sorusu sor
        if (currentRoomLinkedHabit && currentRoomLinkedHabit.id) {
            const habit = currentRoomLinkedHabit;
            const partnerName = _cwPartnerName || _cwPartnerUsername || 'Partner';

            // Mevcut overlay varsa kaldır
            document.getElementById('gf-habit-complete-overlay')?.remove();
            const overlay = document.createElement('div');
            overlay.id = 'gf-habit-complete-overlay';
            overlay.className = 'modal-overlay';
            overlay.style.cssText = 'z-index:100060;';
            overlay.innerHTML = `
                <div class="modal-content glass-panel" style="max-width:370px; text-align:center; padding:28px 24px;">
                    <div style="font-size:32px; margin-bottom:12px;">🤝</div>
                    <h3 style="margin:0 0 8px; font-size:17px; color:#fff;">"${_escapeHtml(habit.name)}"</h3>
                    <p style="color:var(--text-muted); font-size:13px; margin:0 0 22px;">Bugünkü ortak alışkanlık hedefini tamamladın mı?</p>
                    <div style="display:flex; flex-direction:column; gap:10px;">
                        <button id="gf-habit-yes-btn" class="control-btn primary" style="width:100%; padding:12px;">
                            <i class="fa-solid fa-check-double"></i> Evet, Tamamladım!
                        </button>
                        <button id="gf-habit-no-btn" class="control-btn" style="width:100%; padding:12px; background:rgba(255,255,255,0.05);">
                            <i class="fa-solid fa-xmark"></i> Hayır, Tamamlamadım
                        </button>
                    </div>
                </div>`;
            document.body.appendChild(overlay);

            const finish = (completed) => {
                overlay.remove();
                if (completed) {
                    completeBuddyHabitSession(habit);
                }
                // Partnere bildirim gönder
                if (window.FocusSupabase && currentUser?.id && _cwPartnerUsername) {
                    window._resolveProfileByUsername?.(_cwPartnerUsername).then(prof => {
                        if (!prof?.id) return;
                        window.FocusSupabase.from('notifications').insert({
                            user_id: prof.id,
                            type: 'buddy_session_ended',
                            payload: {
                                fromUsername: currentUser.username,
                                fromName: currentUser.displayName,
                                habitName: habit.name,
                                completed
                            }
                        }).then(() => {});
                    });
                }
                _gfFinalizeEndSession();
            };

            document.getElementById('gf-habit-yes-btn').addEventListener('click', () => finish(true));
            document.getElementById('gf-habit-no-btn').addEventListener('click', () => finish(false));
            return; // modal kapanınca devam edecek
        }

        _gfFinalizeEndSession();
    }

    // ── Oturumu Yeniden Başlat ──
    function gfDoRestartSession() {
        // Partner bilgisini ve oda id'sini kapanmadan önce yakala
        const restartRoomId    = currentRoomId;
        const partnerUsername  = _cwPartnerUsername;
        const partnerName      = _cwPartnerName;
        const partnerColor     = _cwPartnerColor;
        const linkedHabit      = currentRoomLinkedHabit;
        const groupInviteScope = _cwRoomOriginGroupScope;
        _cwRoomOriginGroupScope = null;

        // Room listener'ı kapat — restarting yazınca kendi listener'ımız tetiklenmesin
        if (_cwRoomSupaChannel) { window.FocusSupabase?.removeChannel(_cwRoomSupaChannel); _cwRoomSupaChannel = null; }
        // (Firebase-era currentRoomRef kaldırıldı — Supabase kanalı zaten yukarıda kapatılıyor)

        // Eğer aktif oda varsa misafire bildir
        if (restartRoomId && _cwRoomIsSupabase && window.FocusSupabase) {
            window.FocusSupabase.from('cw_rooms').update({
                restarting: true,
                restarted_by_id: currentUser?.id,
                restarted_by_name: currentUser?.displayName,
                restarted_at: new Date().toISOString()
            }).eq('id', restartRoomId).then(() => {
                // 4 sn sonra eski odayı temizle
                setTimeout(() => window.FocusSupabase.from('cw_rooms').delete().eq('id', restartRoomId).then(() => {}), 4000);
            });
        }

        // Overlay ve state'i kapat — biri hata verirse bile aşağıdaki modal
        // açma adımı ATLANMASIN diye try/catch ile izole ediyoruz.
        try { closeGroupFocusOverlay(); } catch (e) { console.error('[CW-DEBUG] gfDoRestartSession: closeGroupFocusOverlay hatası', e); }
        try { exitCWRoomLocal(); } catch (e) { console.error('[CW-DEBUG] gfDoRestartSession: exitCWRoomLocal hatası', e); }

        // Nereden davet gönderildiyse aynı ayar modalına dön: grup daveti ise
        // grup ayar modalı, DM/buddy daveti ise onun modalı. Overlay'in
        // display:none'ı henüz DOM'a yansımamış olabileceğinden bir sonraki
        // frame'e bırakıyoruz — aksi halde modal bazı tarayıcılarda kapanan
        // overlay'in arkasında/altında render olabiliyordu.
        requestAnimationFrame(() => {
            try {
                if (groupInviteScope) {
                    if (typeof window.openGroupFocusSettingsModal === 'function') window.openGroupFocusSettingsModal(groupInviteScope);
                } else if (partnerUsername) {
                    openBuddyFocusSettingsModal(partnerUsername, partnerName, partnerColor, linkedHabit);
                } else {
                    const m = document.getElementById('buddy-focus-premium-modal');
                    if (m) m.classList.remove('hidden');
                }
            } catch (e) { console.error('[CW-DEBUG] gfDoRestartSession: ayar modalı açılamadı', e); }
        });
    }

    // Misafir tarafında: partner "restarting" yazdığında gösterilecek bildirim modalı
    function gfShowPartnerRestartingModal(hostName) {
        const modal = document.getElementById('gf-partner-restarting-modal');
        if (!modal) return;
        const titleEl  = document.getElementById('gf-restarting-title');
        const descEl   = document.getElementById('gf-restarting-desc');
        const statusEl = document.getElementById('gf-restarting-status-text');
        if (titleEl)  titleEl.textContent = 'Oturum Yeniden Başlatılıyor';
        if (descEl)   descEl.textContent  = `${hostName || 'Partnerin'} oturumu sıfırlıyor ve yeni ayarlarla sana davet gönderecek. Birazdan bir davet bildirimi alacaksın.`;
        if (statusEl) statusEl.textContent = 'Davet bekleniyor...';
        modal.classList.remove('hidden');

        // Tamam butonu
        const okBtn = document.getElementById('gf-restarting-ok-btn');
        if (okBtn && !okBtn.dataset.bound) {
            okBtn.dataset.bound = '1';
            okBtn.addEventListener('click', () => modal.classList.add('hidden'));
        }
    }

    // ── Odaklanma süresi seçimi: oda modunda Firebase'e yazılır (her iki taraf senkron görür),
    // bireysel modda doğrudan yerel zamanlayıcıyı/oturumu günceller ──
    function applySharedFocusWorkDuration(minutes) {
        if (!minutes) return;
        applySharedFocusModePill(minutes);
        if (currentRoomId && _cwRoomIsSupabase && window.FocusSupabase) {
            window.FocusSupabase.from('cw_rooms').update({ focus_minutes: minutes }).eq('id', currentRoomId).then(() => {});
        } else {
            if (sharedFocusSession) {
                sharedFocusSession.focusMinutes = minutes;
            } else {
                scwTimeLeft = minutes * 60;
                syncSharedFocusTimerUI();
            }
        }
    }

    // ── Mola süresi seçimi: oda modunda yazılır, bireysel modda yerel değişkene ──
    function applySharedFocusBreakDuration(minutes) {
        if (!minutes) return;
        sharedFocusBreakMinutes = minutes;
        applySharedFocusBreakPill(minutes);
        if (currentRoomId && _cwRoomIsSupabase && window.FocusSupabase) {
            window.FocusSupabase.from('cw_rooms').update({ break_minutes: minutes }).eq('id', currentRoomId).then(() => {});
        } else if (sharedFocusSession) {
            sharedFocusSession.breakMinutes = minutes;
        }
    }

    let gfDurationSettingsBound = false;
    function gfEnsureDurationSettingsBindings() {
        if (gfDurationSettingsBound) return;
        gfDurationSettingsBound = true;

        const settingsModal = document.getElementById('gf-settings-modal');

        // Ayarlar modalı açılınca oturum özetini doldur
        document.getElementById('gf-settings-btn')?.addEventListener('click', () => {
            try {
                const stepperEl = document.getElementById('gf-rounds-stepper');
                if (stepperEl) stepperEl.value = sharedFocusTotalRounds;
                const roundsChipEl = document.getElementById('gf-ssi-rounds');
                if (roundsChipEl) roundsChipEl.textContent = `${sharedFocusTotalRounds} tur`;
                const focusChipEl = document.getElementById('gf-ssi-focus');
                const breakChipEl = document.getElementById('gf-ssi-break');
                if (focusChipEl) focusChipEl.textContent = `${parseInt(document.getElementById('gf-duration-input')?.value) || 25} dk odak`;
                if (breakChipEl) breakChipEl.textContent = `${parseInt(document.getElementById('gf-break-input')?.value) || 10} dk mola`;
                settingsModal?.classList.remove('hidden');
                window.gfResetIdleTimer();
                setTimeout(() => {
                    const el = document.elementFromPoint(window.innerWidth/2, window.innerHeight/2);
                }, 100);
            } catch (e) { console.error('[CW-DEBUG] gf-settings-btn handler hatası:', e); }
        });

        // Sadece owner'a görünen "diğerleri de ayarlasın" izni
        document.getElementById('gf-setting-open-settings')?.addEventListener('change', (e) => {
            if (!currentRoomIsHost || !currentRoomId || !window.FocusSupabase) return;
            window.FocusSupabase.from('cw_rooms').update({ settings_open_to_all: !!e.target.checked }).eq('id', currentRoomId).then(() => {});
        });

        // Sadece owner'a görünen "istek gönderme izni" — kapalıysa guest
        // Start/Pause/Skip'i hiç görmez (bkz. _cwApplyRoleBasedUI)
        document.getElementById('gf-setting-allow-requests')?.addEventListener('change', (e) => {
            if (!currentRoomIsHost || !currentRoomId || !window.FocusSupabase) return;
            window.FocusSupabase.from('cw_rooms').update({ allow_requests: !!e.target.checked }).eq('id', currentRoomId).then(() => {});
        });

        // Tur sayısı stepper
        const _applyRoundsChange = () => {
            const inp = document.getElementById('gf-rounds-stepper');
            if (!inp) return;
            const val = Math.min(10, Math.max(1, parseInt(inp.value) || 1));
            inp.value = val;
            sharedFocusTotalRounds = val;
            const totalEl = document.getElementById('gf-round-total');
            const rndInput = document.getElementById('gf-rounds-input');
            if (totalEl) totalEl.textContent = val;
            if (rndInput) rndInput.value = val;
            const focusMin = parseInt(document.getElementById('gf-duration-input')?.value) || 25;
            const breakMin = parseInt(document.getElementById('gf-break-input')?.value) || 10;
            const currentRound = gfComputeCurrentRound(sharedFocusSession, val);
            const ph = sharedFocusSession ? deriveSharedFocusPhase(sharedFocusSession, Date.now()) : null;
            const isBreak = ph && ph.type === 'break';
            const activeIdx = sharedFocusSession
                ? (isBreak ? (currentRound - 1) * 2 + 1 : (currentRound - 1) * 2)
                : 0;
            window.gfRenderMetroTimeline(val, activeIdx, focusMin, breakMin);
        };
        document.getElementById('gf-rounds-step-dec')?.addEventListener('click', () => {
            const inp = document.getElementById('gf-rounds-stepper');
            if (inp) { inp.value = Math.max(1, (parseInt(inp.value) || 1) - 1); _applyRoundsChange(); }
        });
        document.getElementById('gf-rounds-step-inc')?.addEventListener('click', () => {
            const inp = document.getElementById('gf-rounds-stepper');
            if (inp) { inp.value = Math.min(10, (parseInt(inp.value) || 1) + 1); _applyRoundsChange(); }
        });
        document.getElementById('gf-rounds-stepper')?.addEventListener('change', _applyRoundsChange);

        // Tamam, Uygula — sadece toggle tercihlerini okur (süre/tur artık burada yok)
        document.getElementById('gf-settings-close-btn')?.addEventListener('click', () => {
            settingsModal?.classList.add('hidden');
        });

        settingsModal?.addEventListener('click', (e) => {
            if (e.target === settingsModal) settingsModal.classList.add('hidden');
        });

        const ghostToggle = document.getElementById('gf-setting-ghostmode');
        ghostToggle?.addEventListener('change', () => {
            window.gfSetGhostModeEnabled(ghostToggle.checked);
        });
    }

    // Ayarlar modalı oturum özet bilgilerini günceller
    function gfRefreshSettingsSessionInfo() {
        const dur    = parseInt(document.getElementById('gf-duration-input')?.value) || 25;
        const brk    = parseInt(document.getElementById('gf-break-input')?.value) || 10;
        const focusEl  = document.getElementById('gf-ssi-focus');
        const breakEl  = document.getElementById('gf-ssi-break');
        const stepperEl = document.getElementById('gf-rounds-stepper');
        if (focusEl)   focusEl.textContent  = `${dur} dk odak`;
        if (breakEl)   breakEl.textContent  = `${brk} dk mola`;
        if (stepperEl) stepperEl.value = sharedFocusTotalRounds;
    }

    // ──────────────────────────────────────────────────────
    // ORTAK ODA KONTROLÜ VE CANLI SENKRONİZASYON
    // ──────────────────────────────────────────────────────
    // isHost=true  → odayı oluşturan taraf (daveti gönderen)
    // isHost=false → odaya sonradan katılan taraf (daveti kabul eden / misafir)
    // İkisi de aynı roomId'yi dinler; bu sayede start/pause/reset komutları anlık olarak eşleşir.

    // Supabase satırını + üye listesini birleşik oda nesnesine dönüştürür.
    // "host/guest" ikilisi yerine N kişilik `members` dizisi (2026-07 çok
    // katılımcılı oda geçişi) — herkes eşit üye, sadece role:'owner' olan
    // kişi kontrol yetkisine sahip.
    function _cwNormalizeSupaRoom(row, members) {
        if (!row) return null;
        const memberList = (members || []).map(m => ({
            userId: m.user_id,
            username: m.username,
            displayName: m.display_name,
            color: m.color,
            role: m.role,
            taskId: m.task_id || null,
            taskText: m.task_text || ''
        }));
        return {
            members: memberList,
            maxParticipants: row.max_participants || 2,
            active: row.active,
            startedAt: row.started_at ? new Date(row.started_at).getTime() : null,
            paused: !!row.paused,
            pausedAt: row.paused_at ? new Date(row.paused_at).getTime() : null,
            focusMinutes: row.focus_minutes || 25,
            breakMinutes: row.break_minutes || 5,
            rounds: row.rounds || 4,
            linkedHabitId: row.linked_habit_id || null,
            linkedHabitName: row.linked_habit_name || null,
            linkedPairId: row.linked_pair_id || null,
            endedBy: row.ended_by_name || null,
            endedByName: row.ended_by_name || null,
            restarting: !!row.restarting,
            restartedBy: row.restarted_by_id || null,
            restartedByName: row.restarted_by_name || null,
            settingsOpenToAll: !!row.settings_open_to_all,
            allowRequests: row.allow_requests !== false,
            _createdBy: row.created_by,
            _raw: row
        };
    }

    // room.members içinden kendim hariç diğerlerini, insan-okur biçimde
    // birleştirir: "X ile", "X ve Y ile", "X, Y ve 2 kişi daha ile".
    function _cwOthersLabel(room) {
        const others = (room.members || []).filter(m => m.userId !== currentUser?.id).map(m => m.displayName || 'Kullanıcı');
        if (!others.length) return null;
        if (others.length === 1) return others[0];
        if (others.length === 2) return `${others[0]} ve ${others[1]}`;
        return `${others[0]}, ${others[1]} ve ${others.length - 2} kişi daha`;
    }

    // Kendi cw_room_members satırıma bakarak "owner" olup olmadığımı
    // döndürür — ownership devri sonrası currentRoomIsHost'un doğru
    // güncellenmesi için _cwApplyRoomData her yenilemede bunu çağırır.
    function _cwIsRoomOwner(room) {
        const me = (room.members || []).find(m => m.userId === currentUser?.id);
        return !!me && me.role === 'owner';
    }

    // Oda kontrol butonlarının (Ayarlar/Oturumu Bitir/Pause/Skip) görünürlüğünü
    // ve doğrudan-kontrol yetkisini role göre günceller — owner her zaman tam
    // yetkili; owner "Ortak Kontrol"ü açtıysa guest de Ayarlar'ı görür VE
    // Duraklat/Sonraki Aşama'yı isteksiz doğrudan uygulayabilir (bkz.
    // _cwHasDirectControl). Oturumu Bitir owner dışında hiç kimseye görünmez.
    let _cwSettingsOpenToAll = false;
    let _cwRoomAllowRequests = true;
    function _cwHasDirectControl() {
        return currentRoomIsHost || _cwSettingsOpenToAll;
    }
    function _cwApplyRoleBasedUI(isOwner, settingsOpenToAll, allowRequests) {
        _cwSettingsOpenToAll = !!settingsOpenToAll;
        _cwRoomAllowRequests = allowRequests !== false;
        const canSettings = isOwner || _cwSettingsOpenToAll;
        document.getElementById('gf-settings-btn')?.classList.toggle('hidden', !canSettings);
        document.getElementById('gf-end-session-btn')?.classList.toggle('hidden', !isOwner);
        document.getElementById('gf-setting-open-settings-row')?.classList.toggle('hidden', !isOwner);
        document.getElementById('gf-setting-allow-requests-row')?.classList.toggle('hidden', !isOwner);
        const toggle = document.getElementById('gf-setting-open-settings');
        if (toggle && document.activeElement !== toggle) toggle.checked = _cwSettingsOpenToAll;
        const reqToggle = document.getElementById('gf-setting-allow-requests');
        if (reqToggle && document.activeElement !== reqToggle) reqToggle.checked = _cwRoomAllowRequests;

        // İstek izni kapalıysa ve kontrol yetkim yoksa Start/Pause/Skip'i hiç
        // görmeyeyim (elimden bir şey gelmediği için buton anlamsız kalırdı).
        if (!isOwner && !_cwSettingsOpenToAll) {
            const showControls = _cwRoomAllowRequests;
            document.getElementById('gf-start-btn')?.classList.toggle('cw-controls-hidden', !showControls);
            document.getElementById('gf-pause-btn')?.classList.toggle('cw-controls-hidden', !showControls);
            document.getElementById('gf-skip-btn')?.classList.toggle('cw-controls-hidden', !showControls);
        } else {
            document.getElementById('gf-start-btn')?.classList.remove('cw-controls-hidden');
            document.getElementById('gf-pause-btn')?.classList.remove('cw-controls-hidden');
            document.getElementById('gf-skip-btn')?.classList.remove('cw-controls-hidden');
        }
    }

    // Odaklanma arayüzü açıkken periyodik olarak cw_rooms.last_seen_at'i
    // tazeler — sekme hard refresh/kapatma ile terk edilirse heartbeat kesilir
    // ve davet kartı (bkz. _renderDcCwRoomInviteCard) bunu "hayalet oda" olarak
    // algılayıp kendini otomatik temizler.
    let _cwHeartbeatInterval = null;
    function _cwStartHeartbeat(roomId) {
        _cwStopHeartbeat();
        if (!roomId || !window.FocusSupabase) return;
        const tick = () => window.FocusSupabase.rpc('cw_room_heartbeat', { p_room_id: roomId }).then(() => {}).catch(() => {});
        tick();
        _cwHeartbeatInterval = setInterval(tick, 15000);
    }
    function _cwStopHeartbeat() {
        if (_cwHeartbeatInterval) { clearInterval(_cwHeartbeatInterval); _cwHeartbeatInterval = null; }
    }

    // Grup sohbetine gönderilen "odaklanma daveti" kartını siler — oturum
    // başlatıldığında (artık kimse katılamaz) ya da hiç başlamadan
    // bitirildiğinde çağrılır.
    function _cwDeleteInviteMessage() {
        if (!_cwInviteMsgId || !window.FocusSupabase) return;
        window.FocusSupabase.from('messages').delete().eq('id', _cwInviteMsgId).then(() => {});
        _cwInviteMsgId = null;
        _cwInviteScope = null;
    }

    function enterCWRoom(roomId, partnerName, partnerColor, linkedHabit, isHost, focusMinutes) {
        if (!currentUser) return;
        currentRoomId = roomId;
        currentRoomLinkedHabit = linkedHabit || null;
        currentRoomIsHost = !!isHost;
        _cwPartnerUsername = partnerName;
        _cwPartnerName     = partnerName;
        _cwPartnerColor    = partnerColor;
        _cwRoomOriginGroupScope = null; // her yeni giriş DM/tekli varsayar — grup daveti ise sendGroupFocusInvite bunu hemen sonra set eder
        const minutes = focusMinutes && focusMinutes > 0 ? focusMinutes : 25;

        if (window.FocusSupabase) {
            _cwRoomIsSupabase = true;

            if (isHost) {
                scwTimeLeft = minutes * 60;
                applySharedFocusModePill(minutes);
                sharedFocusBreakMinutes = SHARED_FOCUS_DEFAULT_BREAK_MINUTES;
                applySharedFocusBreakPill(sharedFocusBreakMinutes);
                const roomRow = {
                    id: roomId,
                    created_by: currentUser.id,
                    active: true,
                    focus_minutes: minutes,
                    break_minutes: sharedFocusBreakMinutes,
                    rounds: sharedFocusTotalRounds,
                    max_participants: window.getMyRoomCapacity(),
                    linked_habit_id: linkedHabit?.id || null,
                    linked_habit_name: linkedHabit?.name || null,
                    linked_pair_id: linkedHabit?.pairId || null
                };
                window.FocusSupabase.from('cw_rooms').insert(roomRow)
                    .then(({ error }) => {
                        if (error) { console.error('[CW-DEBUG] oda oluşturma hatası:', error.message, error.code, error.details, error.hint); return; }
                        window.FocusSupabase.from('cw_room_members').insert({
                            room_id: roomId, user_id: currentUser.id, username: currentUser.username,
                            display_name: currentUser.displayName, color: currentUser.avatarColor || '6c5ce7', role: 'owner'
                        }).then(({ error: mErr }) => {
                            if (mErr) console.error('[CW-DEBUG] oda üyeliği (owner) oluşturma hatası:', mErr.message, mErr.code, mErr.details, mErr.hint);
                        });
                    });
            } else {
                if (!isScwRunning) {
                    scwTimeLeft = minutes * 60;
                    applySharedFocusModePill(minutes);
                }
                window.FocusSupabase.rpc('join_cw_room', {
                    p_room_id: roomId, p_username: currentUser.username,
                    p_display_name: currentUser.displayName, p_color: currentUser.avatarColor || '6c5ce7'
                }).then(({ data, error }) => {
                        if (error || !data?.ok) {
                            console.error('[CW-DEBUG] odaya katılma hatası (join_cw_room RPC):', error?.message, data?.error);
                            const isFull = data?.error === 'cw_room_full';
                            window.dcShowToast?.(isFull ? 'Bu oda dolu — kapasite doldu.' : 'Odaya katılırken bir hata oluştu.');
                            exitCWRoomLocal();
                        } else {
                        }
                    });
            }

            _cwSetupSupaRoomUI(roomId, partnerName, linkedHabit, isHost, minutes);
            return;
        }

        // Firebase fallback removed — Supabase only
    }
    window.enterCWRoom = enterCWRoom; // social-cw-invites.js için

    // Ortak oda verisi (Firebase veya Supabase normalize) UI'ye uygulanır
    function _cwApplyRoomData(room, isHostParam, statusText, partnerName) {
        // Ownership devri (bkz. gfLeaveSessionCompletely) sonrası isHost'u
        // her yenilemede kendi cw_room_members satırımdan yeniden hesapla —
        // parametre olarak gelen değer sadece odaya İLK girişteki durumu
        // yansıtır, artık güvenilir kaynak değil.
        const isHost = room.members && room.members.length ? _cwIsRoomOwner(room) : isHostParam;
        if (isHost !== currentRoomIsHost) currentRoomIsHost = isHost;
        _cwApplyRoleBasedUI(isHost, room.settingsOpenToAll, room.allowRequests);
        if (room.linkedHabitId && !currentRoomLinkedHabit) {
            currentRoomLinkedHabit = { id: room.linkedHabitId, name: room.linkedHabitName, pairId: room.linkedPairId };
        }
        if (room.rounds && room.rounds > 0) {
            sharedFocusTotalRounds = room.rounds;
            const totalEl = document.getElementById('gf-round-total');
            const rndInput = document.getElementById('gf-rounds-input');
            const stepperEl = document.getElementById('gf-rounds-stepper');
            if (totalEl) totalEl.textContent = room.rounds;
            if (rndInput) rndInput.value = room.rounds;
            if (stepperEl) stepperEl.value = room.rounds;
        }
        const partner = _cwOthersLabel(room);
        if (statusText) {
            if (!partner) {
                statusText.textContent = `${partnerName || 'Partnerin'} katılması bekleniyor...`;
            } else if (currentRoomLinkedHabit) {
                statusText.textContent = `${partner} ile "${currentRoomLinkedHabit.name}" için Birlikte Odaklanıyor`;
            } else {
                statusText.textContent = `${partner} ile Birlikte Odaklanıyor`;
            }
        }
        if (room.startedAt) {
            sharedFocusSession = {
                startedAt: room.startedAt,
                paused: !!room.paused,
                pausedAt: room.pausedAt || null,
                focusMinutes: room.focusMinutes || 25,
                breakMinutes: room.breakMinutes || sharedFocusBreakMinutes || SHARED_FOCUS_DEFAULT_BREAK_MINUTES
            };
            if (!scwTimerInterval) startSharedFocusDerivedTimer();
        } else {
            sharedFocusSession = null;
            if (scwTimerInterval) { clearInterval(scwTimerInterval); scwTimerInterval = null; }
            isScwRunning = false;
            if (room.focusMinutes) {
                const newSeconds = room.focusMinutes * 60;
                if (scwTimeLeft !== newSeconds) scwTimeLeft = newSeconds;
                applySharedFocusModePill(room.focusMinutes);
            }
        }
        renderSharedFocusParticipants(room);
        applySharedFocusPhase(room, isHost);
        renderSharedFocusTaskStatus(room, isHost);
    }

    // Supabase oda UI kurulumu ve realtime aboneliği
    function _cwSetupSupaRoomUI(roomId, partnerName, linkedHabit, isHost, minutes) {
        const statusCard = document.getElementById('scw-partnership-status');
        const statusText = document.getElementById('scw-status-text');
        const leaveBtn = document.getElementById('scw-leave-btn');
        if (statusCard) { statusCard.className = "scw-status-card pair-mode"; }
        if (leaveBtn) { leaveBtn.classList.remove('hidden'); }
        openSharedFocusOverlay(linkedHabit, partnerName);
        ensureSharedFocusReturnButtonBinding();

        // Mola sohbeti: broadcast üzerinden (DB'ye yazmıyoruz)
        const msgsEl = document.getElementById('gf-break-chat-messages');
        if (msgsEl) msgsEl.innerHTML = '<div class="cws-bc-empty">☕ Mola başladığında sohbet açılır</div>';

        // Supabase Realtime + broadcast kanalı
        if (_cwRoomSupaChannel) {
            window.FocusSupabase.removeChannel(_cwRoomSupaChannel);
            _cwRoomSupaChannel = null;
        }

        _cwStartHeartbeat(roomId);

        const refreshRoom = () => {
            Promise.all([
                window.FocusSupabase.from('cw_rooms').select('*').eq('id', roomId).single(),
                window.FocusSupabase.from('cw_room_members').select('*').eq('room_id', roomId)
            ]).then(([{ data: row, error }, { data: members, error: mErr }]) => {
                    if (error || !row || roomId !== currentRoomId) return;
                    if (mErr) console.error('[FocusAI] oda üyeleri okuma hatası', mErr);
                    const room = _cwNormalizeSupaRoom(row, members || []);
                    if (!room) return;

                    if (room.restarting && room.restartedBy !== currentUser?.id) {
                        gfShowPartnerRestartingModal(room.restartedByName || 'Partnerin');
                        closeGroupFocusOverlay();
                        exitCWRoomLocal();
                        return;
                    }
                    if (!room.active) {
                        if (room.endedByName && room.endedBy !== currentUser?.id && typeof showPremiumModal === 'function') {
                            showPremiumModal({ title: '🚪 Oturum Sonlandırıldı', message: `${room.endedByName} ortak odaklanma oturumunu sonlandırdı. Oturumdan çıkılıyor.`, type: 'info' });
                        }
                        exitCWRoomLocal();
                        return;
                    }
                    _cwApplyRoomData(room, isHost, statusText, partnerName);
                });
        };

        refreshRoom();

        _cwRoomSupaChannel = window.FocusSupabase
            .channel(`cw-room-${roomId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'cw_rooms', filter: `id=eq.${roomId}` }, refreshRoom)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'cw_room_members', filter: `room_id=eq.${roomId}` }, refreshRoom)
            .on('broadcast', { event: 'break_chat_msg' }, ({ payload }) => {
                if (!payload?.text || payload.senderId === currentUser?.id) return;
                window.gfAppendChatMessage({ from: null, fromName: payload.displayName || 'Kullanıcı', sender: payload.displayName, text: payload.text });
            })
            .on('broadcast', { event: 'participant_left' }, ({ payload }) => {
                if (!payload?.displayName) return;
                window.dcShowToast?.(`${payload.displayName} oturumdan ayrıldı.`);
            })
            .on('broadcast', { event: 'participant_request' }, ({ payload }) => {
                if (!currentRoomIsHost || !payload?.reqType) return;
                _cwShowIncomingControlRequest(payload.reqType, payload.displayName || 'Bir katılımcı');
            })
            .on('broadcast', { event: 'request_result' }, ({ payload }) => {
                if (currentRoomIsHost) return;
                // Onaylansa da reddedilse de cooldown SÜRESİNCE (10sn) yeni istek
                // gönderilemez — reddedilince hemen tekrar denenip spam yapılmasını
                // önlemek için burada ERKEN sıfırlama yapılmıyor, yalnızca onay
                // durumunda hemen serbest bırakılır.
                if (payload?.approved) _cwMyRequestInFlight = false;
                const labels = { start: 'Başlatma', pause: 'Duraklatma', resume: 'Başlatma', skip: 'Sonraki aşama' };
                const label = labels[payload?.reqType] || 'İstek';
                window.dcShowToast?.(payload?.approved ? `✅ ${label} isteğin onaylandı!` : `❌ ${label} isteğin reddedildi.`);
            })
            .on('broadcast', { event: 'solo_continue_prompt' }, ({ payload }) => {
                if (!payload) return;
                _cwShowSoloContinuePrompt(payload.leftDisplayName || 'Partnerin');
            })
            .subscribe();

        if (leaveBtn) {
            leaveBtn.onclick = () => {
                if (_cwRoomIsSupabase && currentRoomId && currentUser?.id) {
                    const leftRoomId = currentRoomId;
                    const wasOwner = currentRoomIsHost;
                    const removeOwnMembership = () => window.FocusSupabase.from('cw_room_members')
                        .delete().eq('room_id', leftRoomId).eq('user_id', currentUser.id).then(() => {});
                    if (wasOwner) {
                        window.FocusSupabase.from('cw_rooms').update({
                            active: false, ended_by_id: currentUser.id, ended_by_name: currentUser.displayName
                        }).eq('id', leftRoomId).then(() => removeOwnMembership());
                    } else {
                        removeOwnMembership();
                    }
                }
                exitCWRoomLocal();
            };
        }
        // Akış içerik kararı (2026-07-05): kaldırıldı.
    }

    function exitCWRoomLocal() {
        clearInterval(scwTimerInterval);
        isScwRunning = false;
        _cwStopHeartbeat();
        // Supabase kanalını kapat
        if (_cwRoomSupaChannel) { window.FocusSupabase?.removeChannel(_cwRoomSupaChannel); _cwRoomSupaChannel = null; }
        _cwRoomIsSupabase = false;
        // Firebase room listener'ı kapat
        // (Firebase-era currentRoomRef kaldırıldı — Supabase kanalı zaten yukarıda kapatılıyor)
        currentRoomId = null;
        currentRoomLinkedHabit = null;
        currentRoomIsHost = false;
        currentRoomPhase = 'work';
        sharedFocusMyTaskId = null;
        sharedFocusBreakMinutes = SHARED_FOCUS_DEFAULT_BREAK_MINUTES;
        sharedFocusMinimized = false;
        sharedFocusPhaseInitialized = false;
        window.gfCloseLeaveChoiceModal();
        const returnBtn = document.getElementById('scw-return-shared-focus-btn');
        if (returnBtn) returnBtn.classList.add('hidden');
        _syncFocusReturnMiniBtn();

        const statusCard = document.getElementById('scw-partnership-status');
        const statusText = document.getElementById('scw-status-text');
        const leaveBtn = document.getElementById('scw-leave-btn');

        if (statusCard) { statusCard.className = "scw-status-card solo-mode"; }
        if (statusText) { statusText.textContent = "Tek Başına Odaklanıyor"; }
        if (leaveBtn) { leaveBtn.classList.add('hidden'); }
        closeSharedFocusOverlay(); // Ayrı odak odası arayüzünü kapat ve zamanlayıcıyı eski yerine koy
        resetScwTimer();
    }
    window.exitCWRoomLocal = exitCWRoomLocal;

    // ─── UI YARDIMCILARI (avatar/renk/zaman) → social-avatar-utils.js dosyasına
    // taşındı (Faz E, 2026-07-23). avatarSrc/_sanitizeHexColor/_resizeImageToBlob/
    // resolveAvatar/avatarFallbackSrc/avatarImgHtml/groupAvatarHtml/timeAgo/
    // formatFocusMinutes — hepsi window.X olarak erişilebilir.

    // ─── PROFİL HEADER GÜNCELLEME + KURULMAMIŞ PROFİL BANNER'I →
    // social-profile-header.js dosyasına taşındı (Faz E, 2026-07-23).
    // updateProfileHeader/showNotConfiguredBanner window.X olarak erişilebilir.

    // ──────────────────────────────────────────────────────
    // EVENT LISTENERS
    // ──────────────────────────────────────────────────────
    function setupEventListeners() {

        // Renk seçici
        document.querySelectorAll('.social-color-opt').forEach(opt => {
            opt.addEventListener('click', () => {
                document.querySelectorAll('.social-color-opt').forEach(o => {
                    o.style.border = 'none'; o.style.transform = 'scale(1)';
                    o.classList.remove('selected');
                });
                opt.style.border = '3px solid #fff';
                opt.style.transform = 'scale(1.1)';
                opt.classList.add('selected');

                // Önizleme çerçevesini güncelle (sadece özel fotoğraf yoksa)
                const ring = document.getElementById('avatar-color-preview-ring');
                const hasCustom = currentUser && currentUser.customAvatar;
                if (ring) {
                    ring.style.borderColor = '#' + opt.dataset.color;
                    if (!hasCustom) {
                        // Renk değişince ui-avatars önizlemesini de güncelle
                        const dn = document.getElementById('social-setup-displayname')?.value || (currentUser?.displayName || 'U');
                        ring.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(dn)}&background=${opt.dataset.color}&color=fff`;
                        ring.style.display = 'block';
                    }
                }
            });
        });

        // Arkadaşlar sekmesine tıklanınca (henüz kullanıcı yoksa giriş/kurulum modalı aç)
        document.querySelectorAll('[data-target="arkadaslar"]').forEach(el => {
            el.addEventListener('click', () => {
                if (!currentUser) {
                    setTimeout(() => { ensureCommunityAccess(); }, 350);
                }
            });
        });

        // Topluluk profili henüz tamamlanmamış (oturum var ama username boş) —
        // initSocial/loadCommunityProfile tarafından tetiklenir.
        window.addEventListener('focusai:needs-community-profile', (e) => {
            openCommunitySetupModal((e.detail) || {});
        });

        // Profil düzenle butonu — edit modu
        document.getElementById('social-change-profile-btn')?.addEventListener('click', () => {
            openSetupModalAsEdit();
        });

        // Setup modal kapat butonu
        document.getElementById('social-setup-close-btn')?.addEventListener('click', () => {
            document.getElementById('social-setup-modal')?.classList.add('hidden');
            if (!currentUser) return; // kayıt modundaysa sadece kapat
            resetSetupModalToRegister();
        });

        // Sidebar profil alanı click → event delegation ile aşağıda bağlı (social.js sonu)

        // Sohbet paneli tab geçişi
        document.querySelectorAll('.sb-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.sb-tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const tab = btn.dataset.sbTab;
                document.getElementById('sb-panel-contacts').style.display = tab === 'contacts' ? 'block' : 'none';
                document.getElementById('sb-panel-groups').style.display   = tab === 'groups'   ? 'block' : 'none';
            });
        });

        // Sohbet paneli profil zone — context menüyü DC init'te bağlıyoruz (element o zaman hazır olur)

        // Avatar fotoğraf seçimi — DB'ye ham base64 yazmak yerine (egress/boyut
        // maliyeti, bkz. 121_avatar_storage_bucket.sql) önizlemeden önce görsel
        // küçültülür; asıl Storage yüklemesi kaydet butonunda yapılır.
        let _pendingAvatarBlob = null;
        document.getElementById('setup-avatar-file-input')?.addEventListener('change', async function() {
            const file = this.files[0];
            if (!file) return;
            try {
                _pendingAvatarBlob = await window._resizeImageToBlob(file);
                const preview = document.getElementById('setup-avatar-preview');
                if (preview) preview.src = URL.createObjectURL(_pendingAvatarBlob);
            } catch (err) {
                console.error('[FocusAI Social] avatar küçültme hatası:', err);
            }
        });

        // Durum seçici butonları
        document.querySelectorAll('.status-opt-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.status-opt-btn').forEach(b => {
                    b.style.background = 'transparent';
                    b.style.color = 'var(--text-muted)';
                    b.style.borderColor = 'rgba(255,255,255,0.1)';
                });
                btn.style.background = `rgba(${window.hexToRgb(btn.dataset.color)}, 0.15)`;
                btn.style.color = btn.dataset.color;
                btn.style.borderColor = btn.dataset.color;
            });
        });

       // Kayıt ol / Güncelle butonu
       document.getElementById('social-setup-confirm-btn')?.addEventListener('click', async () => {
        const isEditMode = document.getElementById('social-setup-modal')?.dataset.mode === 'edit';
        const displayName = document.getElementById('social-setup-displayname')?.value?.trim();
        const colorOpt = document.querySelector('.social-color-opt.selected') || document.querySelector('.social-color-opt');
        const avatarColor = colorOpt ? colorOpt.dataset.color : '6c5ce7';

        if (!displayName || displayName.length < 2) { window.dcShowToast('Görünen ad en az 2 karakter olmalı.'); return; }

        const btn = document.getElementById('social-setup-confirm-btn');

        if (isEditMode && currentUser) {
            // Durum güncelle
            const activeStatusBtn = document.querySelector('.status-opt-btn[style*="rgba"]');
            const statusVal = activeStatusBtn ? activeStatusBtn.dataset.status : (currentUser.status || 'online');
            const statusColor = activeStatusBtn ? activeStatusBtn.dataset.color : '#2ed573';

            // Yeni bir avatar seçildiyse Storage'a yükle, public URL'i al —
            // seçilmediyse (veya ui-avatars fallback'e dönüldüyse) mevcut değeri koru.
            const avatarPreview = document.getElementById('setup-avatar-preview');
            let customAvatar = currentUser.customAvatar || null;
            if (_pendingAvatarBlob && !avatarUploadEnabled()) {
                _pendingAvatarBlob = null; // ücretsiz kullanıcı UI'ı atlayıp seçmiş olsa bile yükleme yapılmaz
            }
            if (_pendingAvatarBlob && window.FocusSupabase && currentUser.id) {
                const path = `${currentUser.id}/avatar.jpg`;
                const { error: upErr } = await window.FocusSupabase.storage
                    .from('avatars')
                    .upload(path, _pendingAvatarBlob, { upsert: true, contentType: 'image/jpeg', cacheControl: '3600' });
                if (upErr) {
                    console.error('[FocusAI Social] avatar yükleme hatası:', upErr.message);
                } else {
                    const { data } = window.FocusSupabase.storage.from('avatars').getPublicUrl(path);
                    customAvatar = `${data.publicUrl}?v=${Date.now()}`;
                }
                _pendingAvatarBlob = null;
            } else if (avatarPreview && avatarPreview.src && avatarPreview.src.includes('ui-avatars.com')) {
                customAvatar = null; // kullanıcı fallback ikona döndü
            }

            const statusText = (document.getElementById('social-setup-status-text')?.value || '').trim().slice(0, 80);
            const avatarInitials = (document.getElementById('setup-avatar-initials-input')?.value || '').trim().toUpperCase().slice(0, 2) || null;

            currentUser.displayName = displayName;
            currentUser.avatarColor = avatarColor;
            currentUser.status = statusVal;
            currentUser.statusColor = statusColor;
            currentUser.statusText = statusText;
            currentUser.customAvatar = customAvatar;
            currentUser.avatarInitials = avatarInitials;

            saveUser(currentUser);
            // Profil değişikliklerini Supabase'e yaz (kimlik kaynağı)
            if (window.FocusSupabase && currentUser.id) {
                window.FocusSupabase.from('profiles').update({
                    display_name: displayName,
                    avatar_color: avatarColor,
                    custom_avatar: currentUser.customAvatar || null,
                    avatar_initials: avatarInitials,
                    status: statusVal,
                    status_color: statusColor,
                    status_text: statusText
                }).eq('id', currentUser.id).then(({ error }) => {
                    if (error) console.error('[FocusAI Social] profil güncelleme hatası:', error.message);
                });
            }

            document.getElementById('social-setup-modal')?.classList.add('hidden');
                resetSetupModalToRegister();
                window.updateProfileHeader();
                window.updateSbProfile?.();
                syncXP();
                // Profil/durum değişikliği anında tüm modüllere (sohbet alt-profili, liderlik
                // tablosu, arkadaş listeleri vb.) yayılsın — Firebase güncellemesini beklemeden
                window.dispatchEvent(new CustomEvent('focusai:profile-updated'));
                return;
        }

        // Yeni kayıt
        const username = document.getElementById('social-setup-username')?.value?.trim();
        if (!username || username.length < 3) { window.dcShowToast('Kullanıcı adı en az 3 karakter olmalı.'); return; }
        if (!/^[a-z0-9_]+$/.test(username)) { window.dcShowToast('Kullanıcı adı sadece küçük harf, rakam ve _ içerebilir.'); return; }

        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Kontrol ediliyor...';

        const result = await registerUser(username, displayName, avatarColor);

        if (result.success) {
            document.getElementById('social-setup-modal')?.classList.add('hidden');
            window.updateProfileHeader();
            window.startPresence(); syncXP();
            startAllSocialListeners(); // Arkadaşlık istekleri, DM bildirimleri ve son mesajlaşmalar sayfayı yenilemeden de canlı gelsin
            // Akış içerik kararı (2026-07-05): kaldırıldı, belirsiz/düşük sinyal.
            if (typeof showPremiumModal === 'function') {
                showPremiumModal({ title: '🎉 Hoş Geldin!', message: `@${username} olarak topluluğa katıldın. Arkadaş ekleyerek yarışmaya başla!`, type: 'success' });
            }
        } else {
            window.dcShowToast(result.error);
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-rocket"></i> Topluluğa Katıl';
        }
    });


        // "Ortak Alışkanlık Zincirleri" kartının sağ üstündeki tek buton — duruma göre
        // ya Alışkanlıklar sekmesine götürür ya da arkadaş ekleme modalını açar
        // (mod, renderBuddyHabitsSocial içinde data-mode olarak güncellenir)
        document.getElementById('buddy-create-habit-header-btn')?.addEventListener('click', (e) => {
            const mode = e.currentTarget.dataset.mode;
            if (mode === 'addfriend') {
                document.getElementById('open-add-friend-btn')?.click();
            } else {
                document.querySelector('.nav-links li[data-target="aliskanliklar"]')?.click();
            }
        });

        // Arkadaş ekle modal aç/kapat
        document.getElementById('open-add-friend-btn')?.addEventListener('click', async () => {
            if (!(await ensureCommunityAccess())) return;
            document.getElementById('add-friend-modal')?.classList.remove('hidden');
            document.getElementById('add-friend-result').innerHTML = '';
            if (document.getElementById('add-friend-input')) document.getElementById('add-friend-input').value = '';
        });

        document.getElementById('close-add-friend-modal')?.addEventListener('click', () => {
            document.getElementById('add-friend-modal')?.classList.add('hidden');
        });

        // "Oturum yok" banner'ındaki "Giriş Yap" butonu — hesap/giriş modalını açar
        document.getElementById('social-not-configured-login-btn')?.addEventListener('click', () => {
            window.FocusAuthUI?.open();
        });

        // Sidebar'daki global bildirim butonu — hangi sekmede olursak olalım bildirimlere ulaşabilelim
        document.getElementById('global-notif-btn')?.addEventListener('click', async () => {
            if (!(await ensureCommunityAccess())) return;
            window.renderNotificationsPanel();
            document.getElementById('friend-requests-modal')?.classList.remove('hidden');
        });
        document.getElementById('close-friend-requests-modal')?.addEventListener('click', () => {
            document.getElementById('friend-requests-modal')?.classList.add('hidden');
        });

        // Arkadaş ara
        document.getElementById('add-friend-search-btn')?.addEventListener('click', () => window.doFriendSearch());
        document.getElementById('add-friend-input')?.addEventListener('keypress', e => {
            if (e.key === 'Enter') window.doFriendSearch();
        });


        // KOD İLE GRUBA KATILMA
        document.getElementById('group-join-btn')?.addEventListener('click', () => {
            const input = document.getElementById('group-join-input');
            const code = input?.value;
            if (!code) return window.dcShowToast('Lütfen bir grup kodu girin.');
            window.joinGroupWithCode(code);
            if (input) { input.value = ''; _hubInputUpdate(''); }
        });

        // AKILLI INPUT — kod tespiti + keşfet filtresi
        const _hubInput = document.getElementById('group-join-input');
        const _hubJoinBtn = document.getElementById('group-join-btn');
        const _hubIcon = document.getElementById('group-smart-icon');
        const _hubInputRow = _hubInput?.closest('.groups-hub-input-row');

        function _hubInputUpdate(val) {
            const isCode = /^[A-Za-z0-9]{4,8}$/.test(val.trim()) && val.trim().length >= 4;
            if (_hubJoinBtn) _hubJoinBtn.classList.toggle('hidden', !isCode);
            if (_hubIcon) {
                _hubIcon.className = isCode
                    ? 'fa-solid fa-arrow-right-to-bracket groups-hub-input-icon'
                    : 'fa-solid fa-magnifying-glass groups-hub-input-icon';
            }
            if (_hubInputRow) _hubInputRow.classList.toggle('is-code', isCode);

            // Keşfet listesini filtrele
            const q = val.toLowerCase();
            document.querySelectorAll('#global-discover-groups > div').forEach(card => {
                const name = card.querySelector('h4')?.textContent?.toLowerCase() || '';
                card.style.display = (!q || name.includes(q)) ? '' : 'none';
            });
        }

        _hubInput?.addEventListener('input', e => _hubInputUpdate(e.target.value));
        _hubInput?.addEventListener('keydown', e => {
            if (e.key === 'Enter' && _hubJoinBtn && !_hubJoinBtn.classList.contains('hidden')) {
                _hubJoinBtn.click();
            }
        });

    }

    // ─── ARKADAŞ ARAMA ('Kişi Ekle' modalı) → social-friend-search.js
    // dosyasına taşındı (Faz E, 2026-07-23). doFriendSearch() window.X
    // olarak erişilebilir.

    // ──────────────────────────────────────────────────────
    // BAŞLAT
    // ──────────────────────────────────────────────────────
    function start() {
        setupEventListeners();
        initSocial();
        initScwTimer(); // Mini sayacı ayağa kaldırır
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        setTimeout(start, 900);
    }

    // ──────────────────────────────────────────────────────
    // ⏱️ MINI SANAL ODAK ODASI ZAMANLAYICI MOTORU (REALTIME)
    // ──────────────────────────────────────────────────────

    function initScwTimer() {
        const minutesEl = document.getElementById('scw-minutes');
        const secondsEl = document.getElementById('scw-seconds');
        const startBtn = document.getElementById('scw-start-btn');
        const pauseBtn = document.getElementById('scw-pause-btn');
        const resetBtn = document.getElementById('scw-reset-btn');
        const leaveBtn = document.getElementById('scw-leave-btn');
        const modeBtns = document.querySelectorAll('.scw-mode-btn');

        if (!minutesEl) return;

        function updateDisplay(secs) {
            const m = Math.floor(secs / 60);
            const s = secs % 60;
            minutesEl.textContent = String(m).padStart(2, '0');
            secondsEl.textContent = String(s).padStart(2, '0');
        }

        // Süre Butonları (25D, 50D, 5M)
        modeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                if (currentRoomId) return; // Ortak odadayken süre değiştirilemez
                modeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                scwTimeLeft = parseInt(btn.dataset.scwTime) * 60;
                updateDisplay(scwTimeLeft);
                resetScwTimer();
            });
        });

        // Başlat / Devam Et
        startBtn.addEventListener('click', () => {
            requestSharedFocusStart();
        });

        // Duraklat
        pauseBtn.addEventListener('click', () => {
            requestSharedFocusPauseToggle();
        });

        // Sıfırla
        resetBtn.addEventListener('click', () => {
            requestSharedFocusReset();
        });
    }

    // ── BİRLEŞİK TÜRETİLMİŞ-ZAMAN MOTORU ──
    // Hem yalnız hem ortak odaklanma seansları artık tek bir `sharedFocusSession`
    // ({startedAt, paused, pausedAt, focusMinutes, breakMinutes}) modelinden türetiliyor.
    // Yalnız modda bu nesne yereldir; ortak modda Firebase'den aynalanır — tek motor, tek kaynak.
    function startSharedFocusDerivedTimer() {
        if (scwTimerInterval) return;
        isScwRunning = true;
        document.getElementById('scw-start-btn')?.classList.add('hidden');
        document.getElementById('scw-pause-btn')?.classList.remove('hidden');
        syncXP();

        let _lastMinuteMark = -1;
        let _lastPhase = null;

        const tick = () => {
            if (!sharedFocusSession) {
                clearInterval(scwTimerInterval);
                scwTimerInterval = null;
                isScwRunning = false;
                return;
            }
            const now = Date.now();
            const ph = deriveSharedFocusPhase(sharedFocusSession, now);
            if (!ph) return;

            const remainSec = Math.max(0, Math.round(ph.remainingMs / 1000));
            scwTimeLeft = remainSec;
            const mEl = document.getElementById('scw-minutes');
            const sEl = document.getElementById('scw-seconds');
            if (mEl) mEl.textContent = String(Math.floor(remainSec / 60)).padStart(2, '0');
            if (sEl) sEl.textContent = String(remainSec % 60).padStart(2, '0');

            // Bireysel modda oda dinleyicisi olmadığından, "Birlikte Çalışalım" arayüzünü besleyen
            // aynı render fonksiyonlarını burada sahte bir "oda" nesnesiyle besliyoruz —
            // böylece faz etiketi/geçiş animasyonu/katılımcı/görev paneli bire bir aynı şekilde çalışır
            if (sharedFocusSoloMode) {
                const soloRoom = buildSoloFocusRoomLike();
                renderSharedFocusParticipants(soloRoom);
                applySharedFocusPhase(soloRoom, true);
                renderSharedFocusTaskStatus(soloRoom, true);
            }

            // Grup odaklanmasındaki gibi: geçen her 60 saniyelik çalışma süresi için istatistiklere 1 dk ekle
            if (ph.type === 'work' && !sharedFocusSession.paused) {
                const elapsedWorkSec = Math.floor((ph.durMs - ph.remainingMs) / 1000);
                const minuteMark = Math.floor(elapsedWorkSec / 60);
                if (minuteMark === 0) _lastMinuteMark = -1;
                if (minuteMark > _lastMinuteMark && minuteMark > 0) {
                    _lastMinuteMark = minuteMark;
                    recordSharedFocusMinute();
                }
            }

            // Çalışma fazından çıkış anını yakala (mola başlangıcı veya seans sonu) — yalnızca bir kez tetikle
            if (_lastPhase === 'work' && ph.type !== 'work') {
                handleSharedFocusFocusPhaseComplete();
            }
            _lastPhase = ph.type;

            if (ph.type === 'done') {
                clearInterval(scwTimerInterval);
                scwTimerInterval = null;
                isScwRunning = false;
                sharedFocusSession = null;
                document.getElementById('scw-start-btn')?.classList.remove('hidden');
                document.getElementById('scw-pause-btn')?.classList.add('hidden');
            }
        };

        tick();
        scwTimerInterval = setInterval(tick, 1000);
    }

    function recordSharedFocusMinute() {
        if (currentRoomPhase === 'break') return; // Mola fazında (ortak ya da bireysel) odak dakikası sayılmaz
        try {
            if (typeof FocusStorage !== 'undefined') {
                FocusStorage.set('total_focus_minutes', (FocusStorage.get('total_focus_minutes', 0) || 0) + 1);
                FocusStorage.set('focus_minutes', (FocusStorage.get('focus_minutes', 0) || 0) + 1);
                const _td = new Date();
                const _key = String(_td.getDate()).padStart(2, '0') + '-' + String(_td.getMonth() + 1).padStart(2, '0') + '-' + _td.getFullYear();
                const _fh = FocusStorage.get('focus_history', {});
                _fh[_key] = (_fh[_key] || 0) + 1;
                FocusStorage.set('focus_history', _fh);
            } else {
                const prev = parseInt(localStorage.getItem('focusai_total_focus_minutes') || '0');
                localStorage.setItem('focusai_total_focus_minutes', prev + 1);
            }
            if (typeof syncXP === 'function') syncXP();
        } catch (e) { console.warn('[FocusAI] sessiz hata:', e); }
    }

    function handleSharedFocusFocusPhaseComplete() {
        const sessionMinutes = sharedFocusSession ? (sharedFocusSession.focusMinutes || 25) : 25;

        syncXP();
        if (typeof renderStatisticsRef === 'function') setTimeout(() => renderStatisticsRef(), 300);
        if (typeof renderCharts === 'function') renderCharts();
        if (typeof updateStatsPage === 'function') updateStatsPage();
        if (typeof updateTodayStats === 'function') updateTodayStats();

        // Akış gürültüsü kararı (2026-07-05): her tamamlanan seans günde onlarca kez
        // tetiklenip lig terfisi/arkadaş olma gibi asıl önemli olayları gömüyordu —
        // kaldırıldı. Kişisel rekor kırılınca zaten ayrı bir olay düşüyor (aşağıda).

        // ── ORTAK ALIŞKANLIK ODASI: seans bitince ikisinin de bugünkü hedefini işaretle ──
        if (currentRoomId && currentRoomLinkedHabit && currentRoomLinkedHabit.id) {
            completeBuddyHabitSession(currentRoomLinkedHabit);
        }

        // ── ORTAK SEANS İSTATİSTİKLERİ ──
        let jointTotal = 0, jointSessions = 0;
        if (currentRoomId) {
            jointTotal = parseInt(localStorage.getItem('focusai_joint_focus_minutes') || '0') + sessionMinutes;
            jointSessions = parseInt(localStorage.getItem('focusai_joint_focus_sessions') || '0') + 1;
            localStorage.setItem('focusai_joint_focus_minutes', String(jointTotal));
            localStorage.setItem('focusai_joint_focus_sessions', String(jointSessions));
        }

        const msg = currentRoomId
            ? (currentRoomLinkedHabit
                ? `Birlikte ${sessionMinutes} dakika odaklandınız ve "${currentRoomLinkedHabit.name}" alışkanlığını bugün için tamamladınız! 🎉\n\nToplamda partnerlerinle ${jointSessions} ortak seansta ${jointTotal} dakika birlikte odaklandınız. Şimdi bir mola başlıyor — sohbet panelini kullanabilirsiniz ☕`
                : `Birlikte ${sessionMinutes} dakika odaklandınız! Bu süre istatistiklerine eklendi.\n\nToplamda partnerlerinle ${jointSessions} ortak seansta ${jointTotal} dakika birlikte odaklandınız. Şimdi bir mola başlıyor — sohbet panelini kullanabilirsiniz ☕`)
            : `${sessionMinutes} dakikalık odak seansını tamamladın! İstatistiklerin güncellendi.`;

        if (typeof showPremiumModal === 'function') {
            showPremiumModal({ title: '🎉 Seans Bitti!', message: msg, type: 'success' });
        }
    }

    // Bireysel seans, "Birlikte Çalışalım" odasıyla bire bir aynı tam ekran arayüzde akar —
    // oda yoksa bu fonksiyon overlay'i bireysel modda açıp aynı türetilmiş-zaman motorunu besler.
    function ensureSoloFocusOverlay() {
        if (currentRoomId) return;
        const overlay = document.getElementById('group-focus-overlay');
        if (overlay && overlay.style.display === 'flex' && sharedFocusSoloMode) return;
        openSharedFocusOverlay(null, null, true);
    }

    function startLocalScw() {
        if (isScwRunning) return;
        const now = Date.now();
        if (sharedFocusSession && sharedFocusSession.paused) {
            const upd = buildSharedFocusResumeUpdate(sharedFocusSession, now);
            sharedFocusSession = Object.assign({}, sharedFocusSession, upd);
        } else if (!sharedFocusSession) {
            const focusMinutes = Math.round(scwTimeLeft / 60) || 25;
            const breakMinutes = sharedFocusBreakMinutes || SHARED_FOCUS_DEFAULT_BREAK_MINUTES;
            sharedFocusSession = { startedAt: now, paused: false, pausedAt: null, focusMinutes, breakMinutes };
        }
        if (!currentRoomId) ensureSoloFocusOverlay();
        startSharedFocusDerivedTimer();
    }

    function pauseLocalScw() {
        if (sharedFocusSession && !sharedFocusSession.paused) {
            sharedFocusSession.paused = true;
            sharedFocusSession.pausedAt = Date.now();
        }
        if (scwTimerInterval) { clearInterval(scwTimerInterval); scwTimerInterval = null; }
        isScwRunning = false;
        document.getElementById('scw-start-btn')?.classList.remove('hidden');
        document.getElementById('scw-pause-btn')?.classList.add('hidden');
        syncXP();
    }

    function resetScwTimer() {
        if (scwTimerInterval) { clearInterval(scwTimerInterval); scwTimerInterval = null; }
        isScwRunning = false;
        sharedFocusSession = null;
        const activeMode = document.querySelector('.scw-mode-btn.active');
        scwTimeLeft = activeMode ? parseInt(activeMode.dataset.scwTime) * 60 : 25 * 60;
        document.getElementById('scw-minutes').textContent = String(Math.floor(scwTimeLeft / 60)).padStart(2, '0');
        document.getElementById('scw-seconds').textContent = String(scwTimeLeft % 60).padStart(2, '0');
        document.getElementById('scw-start-btn')?.classList.remove('hidden');
        document.getElementById('scw-pause-btn')?.classList.add('hidden');
        if (sharedFocusSoloMode && !currentRoomId) closeSharedFocusOverlay();
    }


    // ──────────────────────────────────────────────────────
    // EDIT MOD AÇICI
    // ──────────────────────────────────────────────────────
    function openSetupModalAsEdit() {
        const modal = document.getElementById('social-setup-modal');
        if (!modal) return;
        modal.dataset.mode = 'edit';

        // Başlık/subtitle güncelle
        const title = document.getElementById('setup-modal-title');
        const subtitle = document.getElementById('setup-modal-subtitle');
        if (title) title.textContent = 'Profili Düzenle';
        if (subtitle) subtitle.textContent = 'Görünen adını, durumunu ve fotoğrafını değiştir.';

        // Mevcut değerleri doldur
        const dnInput = document.getElementById('social-setup-displayname');
        if (dnInput && currentUser) dnInput.value = currentUser.displayName || '';

        // Kullanıcı adı alanını gizle
        const unField = document.getElementById('setup-username-field');
        if (unField) unField.style.display = 'none';

        // Avatar yükleme alanını göster — sadece premium/kurumsal, ücretsizde kilit notu
        const avatarField = document.getElementById('setup-avatar-upload-field');
        const lockedNote = document.getElementById('setup-avatar-locked-note');
        const avatarPreview = document.getElementById('setup-avatar-preview');
        const uploadAllowed = avatarUploadEnabled();
        if (avatarField) avatarField.style.display = uploadAllowed ? 'block' : 'none';
        if (lockedNote) lockedNote.style.display = uploadAllowed ? 'none' : 'block';
        if (avatarPreview && currentUser) {
            avatarPreview.src = currentUser.customAvatar || window.avatarSrc(currentUser.avatarInitials || currentUser.displayName, currentUser.avatarColor);
        }
        const initialsInput = document.getElementById('setup-avatar-initials-input');
        if (initialsInput && currentUser) {
            initialsInput.value = currentUser.avatarInitials || (currentUser.displayName || currentUser.username || 'U').trim().slice(0, 2).toUpperCase();
        }

        // Renk önizleme çerçevesini ayarla
        const ring = document.getElementById('avatar-color-preview-ring');
        if (ring && currentUser) {
            if (currentUser.customAvatar) {
                ring.src = currentUser.customAvatar;
            } else {
                ring.src = window.avatarSrc(currentUser.displayName, currentUser.avatarColor);
            }
            ring.style.borderColor = '#' + (currentUser.avatarColor || '6c5ce7');
            ring.style.display = 'block';
        }

        // Durum seçiciyi göster
        const statusField = document.getElementById('setup-status-field');
        if (statusField) statusField.style.display = 'block';

        // Durum cümlesi alanını doldur
        const statusTextInput = document.getElementById('social-setup-status-text');
        const statusTextCount = document.getElementById('setup-status-text-count');
        if (statusTextInput && currentUser) {
            statusTextInput.value = currentUser.statusText || '';
            if (statusTextCount) statusTextCount.textContent = `${(currentUser.statusText || '').length}/80`;
        }
        if (statusTextInput && statusTextCount) {
            statusTextInput.oninput = () => {
                statusTextCount.textContent = `${statusTextInput.value.length}/80`;
            };
        }

        // Mevcut durumu seç
        const currentStatus = currentUser?.status || 'online';
        document.querySelectorAll('.status-opt-btn').forEach(btn => {
            btn.style.background = 'transparent';
            btn.style.color = 'var(--text-muted)';
            btn.style.borderColor = 'rgba(255,255,255,0.1)';
            if (btn.dataset.status === currentStatus) {
                btn.style.background = `rgba(${window.hexToRgb(btn.dataset.color)}, 0.15)`;
                btn.style.color = btn.dataset.color;
                btn.style.borderColor = btn.dataset.color;
            }
        });

        // Butonu güncelle
        const confirmBtn = document.getElementById('social-setup-confirm-btn');
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = '<i class="fa-solid fa-check"></i> Kaydet';
        }

        modal.classList.remove('hidden');
    }
    window.openSetupModalAsEdit = openSetupModalAsEdit; // social-dc-init.js gibi ayrı script scope'larından erişim için

    function resetSetupModalToRegister() {
        const modal = document.getElementById('social-setup-modal');
        if (!modal) return;
        delete modal.dataset.mode;

        const title = document.getElementById('setup-modal-title');
        const subtitle = document.getElementById('setup-modal-subtitle');
        if (title) title.textContent = 'Topluluğa Katıl!';
        if (subtitle) subtitle.textContent = 'Arkadaşlarınla rekabet et, birlikte çalış.';

        const unField = document.getElementById('setup-username-field');
        if (unField) unField.style.display = 'block';
        const avatarField = document.getElementById('setup-avatar-upload-field');
        if (avatarField) avatarField.style.display = 'none';
        const statusField = document.getElementById('setup-status-field');
        if (statusField) statusField.style.display = 'none';

        const confirmBtn = document.getElementById('social-setup-confirm-btn');
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = '<i class="fa-solid fa-rocket"></i> Topluluğa Katıl';
        }
    }

    // hexToRgb → social-avatar-utils.js dosyasına taşındı (Faz E, 2026-07-23).
    // window.hexToRgb olarak erişilebilir.

    // Ana script'ten çağrılabilmesi için
    let _focusai_personalBests = {};

    window.FocusAISocial = {
        postActivity,
        syncXP,
        // social-buddy-habits.js'e taşındı (dinamik import ile bu satırdan
        // SONRA yüklenir) — gecikmeli sarmalayıcı, çağrı anında window
        // üzerinden arar (script.js'in export yüzeyindeki desenle aynı).
        _sendBuddyHabitDeletedNotification: (...args) => window._sendBuddyHabitDeletedNotification(...args),
        setFocusState,
        checkPersonalRecord: function(type, value, label) {
            if (!currentUser) return;
            const prev = _focusai_personalBests[type];
            if (prev === undefined) {
                _focusai_personalBests[type] = value;
                return;
            }
            if (value > prev) {
                _focusai_personalBests[type] = value;
                postActivity(`istatistiklerinde kişisel rekorunu kırdı! ${label} 📊🏆`);
            }
        }
    };

    // ═══════════════════════════════════════════════════════
    // 👥 GERÇEK ZAMANLI GRUP SİSTEMİ (ONLINE)
    // ═══════════════════════════════════════════════════════
    
    // Benzersiz 6 haneli rastgele grup kodu üretici
    window.generateGroupCode = () => generateGroupCode(); // Faz 6: social-institution-panel.js için
    function generateGroupCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    // Dom elementleri yüklendiğinde butonları bağla
    document.addEventListener("DOMContentLoaded", () => {
        if (typeof IS_CONFIGURED !== 'undefined' && !IS_CONFIGURED) return;

        const groupJoinInput = document.getElementById("group-join-input");
        const groupJoinBtn = document.getElementById("group-join-btn");
        const groupCreateModalBtn = document.getElementById("group-create-modal-btn");
        const myGroupsContainer = document.getElementById("my-groups-container");

        // ========================================================
        // PREMIUM GRUP MODAL KONTROLLERİ
        // ========================================================
        const pModal = document.getElementById("premium-create-group-modal");
        const closePModal = document.getElementById("close-premium-group-modal");
        const cancelPBtn = document.getElementById("cancel-premium-group-btn");
        const savePBtn = document.getElementById("save-premium-group-btn");

       // Modal Aç (Çift Açılmayı Önleyen Güvenli Sürüm)
       groupCreateModalBtn?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        // Güncel kullanıcıyı yerel hafızadan tekrar doğrula
        if (!currentUser) {
            currentUser = getSavedUser();
            window.currentUser = currentUser;
        }

        if (!currentUser) {
            window.dcShowToast("Grup kurabilmek için önce bir topluluk profili oluşturmalısınız!");
            return;
        }
        
        // Kurum türü seçeneklerini plana göre ayarla: premium olmayan kullanıcı
        // yalnızca "Genel Odak Grubu" görsün (sınıf/iş yeri kurumsal özelliktir).
        const classroomTypeSelectEl = document.getElementById("premium-group-classroom-type");
        if (classroomTypeSelectEl) {
            const isPremium = currentUser.plan === 'premium';
            classroomTypeSelectEl.querySelectorAll('option').forEach(opt => {
                opt.hidden = !isPremium && opt.value !== 'general';
            });
            classroomTypeSelectEl.value = 'general';
            classroomTypeSelectEl.dispatchEvent(new Event('change'));
        }

        // Modalı sadece görünür yap, içindeki elementlere müdahale etme
        pModal?.classList.remove("hidden");
    });

        // Modal Kapat fonksiyonları
        const hideGroupModal = () => pModal?.classList.add("hidden");
        closePModal?.addEventListener("click", hideGroupModal);

        // ========================================================
        // KURUMUM MODALI (yalnızca öğretmen rolündeki hesaplarda görünür)
        // ========================================================
        const myInstitutionBtn = document.getElementById("my-institution-modal-btn");
        const myInstitutionModal = document.getElementById("my-institution-modal");
        const closeMyInstitutionModal = document.getElementById("close-my-institution-modal");
        myInstitutionBtn?.addEventListener("click", () => {
            myInstitutionModal?.classList.remove("hidden");
            window.renderMyInstitutionModal();
        });
        closeMyInstitutionModal?.addEventListener("click", () => myInstitutionModal?.classList.add("hidden"));

        // ========================================================
        // KEŞFET MODALI KONTROLLERİ
        // ========================================================
        const discoverModalBtn = document.getElementById("group-discover-modal-btn");
        const discoverModal = document.getElementById("group-discover-modal");
        const closeDiscoverModal = document.getElementById("close-group-discover-modal");
        discoverModalBtn?.addEventListener("click", () => {
            discoverModal?.classList.remove("hidden");
            if (cachedDiscoverGroupsSnapshot) {
                window.computeUserInterestCategoriesSupabase();
                window.renderDiscoverGroups();
            }
        });
        closeDiscoverModal?.addEventListener("click", () => discoverModal?.classList.add("hidden"));
        discoverModal?.addEventListener("click", (e) => { if (e.target === discoverModal) discoverModal.classList.add("hidden"); });

        // ========================================================
        // GRUBA DAVET MODALI KONTROLLERİ
        // ========================================================
        const inviteModal = document.getElementById("group-invite-modal");
        const closeInviteModal = document.getElementById("close-group-invite-modal");
        closeInviteModal?.addEventListener("click", () => inviteModal?.classList.add("hidden"));
        inviteModal?.addEventListener("click", (e) => { if (e.target === inviteModal) inviteModal.classList.add("hidden"); });

        const inviteModalCopyBtn = document.getElementById("group-invite-modal-copy-btn");
        inviteModalCopyBtn?.addEventListener("click", () => {
            const codeEl = document.getElementById("group-invite-modal-code");
            const code = codeEl ? codeEl.textContent : "";
            if (!code) return;
            const done = () => {
                const original = inviteModalCopyBtn.innerHTML;
                inviteModalCopyBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
                setTimeout(() => { inviteModalCopyBtn.innerHTML = original; }, 1200);
            };
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(code).then(done).catch(done);
            } else {
                done();
            }
        });
        cancelPBtn?.addEventListener("click", hideGroupModal);

        // Grup erişim türü — minimalist iki seçenekli toggle
        const privacyToggle = document.getElementById("premium-group-privacy-toggle");
        const privacyInput = document.getElementById("premium-group-privacy");
        const setPrivacyValue = (value) => {
            if (privacyInput) privacyInput.value = value;
            privacyToggle?.querySelectorAll('.group-privacy-opt').forEach(b => {
                const active = b.dataset.value === value;
                b.classList.toggle('active', active);
                b.setAttribute('aria-checked', active ? 'true' : 'false');
            });
        };
        privacyToggle?.querySelectorAll('.group-privacy-opt').forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.disabled) return;
                setPrivacyValue(btn.dataset.value);
            });
        });

        // Sınıf türü değişince "Grup Adı" alanının yerini "Kurum/Okul Adı" alır (sınıf/ders
        // veya iş yeri/ekip seçildiğinde grubun kendi adı yerine kurum adı istenir — sınıf/bölüm
        // ayrımına artık gerek yok); erişim türü de otomatik "Kapalı"ya kilitlenir.
        const classroomTypeSelect = document.getElementById("premium-group-classroom-type");
        const groupNameInput = document.getElementById("premium-group-name");
        const groupInstitutionInput = document.getElementById("premium-group-institution");
        const groupNameLabel = document.getElementById("premium-group-name-label");
        const toggleInstitutionFields = () => {
            if (!classroomTypeSelect) return;
            const isInstitutional = classroomTypeSelect.value !== 'general';

            if (groupNameLabel) groupNameLabel.textContent = isInstitutional ? 'Kurum / Okul Adı' : 'Grup Adı';
            if (groupNameInput) groupNameInput.style.display = isInstitutional ? 'none' : '';
            if (groupInstitutionInput) groupInstitutionInput.style.display = isInstitutional ? '' : 'none';

            const publicBtn = privacyToggle?.querySelector('.group-privacy-opt[data-value="public"]');
            if (publicBtn) publicBtn.disabled = isInstitutional;
            privacyToggle?.classList.toggle('is-locked', isInstitutional);
            if (isInstitutional) {
                setPrivacyValue('private');
            } else if (publicBtn) {
                publicBtn.disabled = false;
            }
        };
        classroomTypeSelect?.addEventListener('change', toggleInstitutionFields);
        toggleInstitutionFields();

        // Karakter sayaçları (Grup Adı / Kurum Adı / Açıklama) — hangi alan görünürse onun uzunluğunu sayar
        const pGroupNameInput = document.getElementById("premium-group-name");
        const pGroupNameCount = document.getElementById("premium-group-name-count");
        const updateNameCount = () => {
            if (!pGroupNameCount) return;
            const isInstitutional = classroomTypeSelect?.value !== 'general';
            const activeInput = isInstitutional ? groupInstitutionInput : pGroupNameInput;
            pGroupNameCount.textContent = `${activeInput?.value.length || 0}/${isInstitutional ? 60 : 30}`;
        };
        pGroupNameInput?.addEventListener("input", updateNameCount);
        groupInstitutionInput?.addEventListener("input", updateNameCount);
        classroomTypeSelect?.addEventListener('change', updateNameCount);
        updateNameCount();

        const pGroupDescInput = document.getElementById("premium-group-desc");
        const pGroupDescCount = document.getElementById("premium-group-desc-count");
        pGroupDescInput?.addEventListener("input", () => {
            if (pGroupDescCount) pGroupDescCount.textContent = `${pGroupDescInput.value.length}/200`;
        });

        // PREMIUM SEVİYE GRUP OLUŞTURMA VE YAZMA (FIREBASE)
        savePBtn?.addEventListener("click", async () => {
            // Güncel kullanıcıyı yerel hafızadan tekrar doğrula (boş gelmesini önlemek için)
            if (!currentUser) {
                currentUser = getSavedUser();
                window.currentUser = currentUser;
            }

            if (!currentUser || !currentUser.username) {
                window.dcShowToast("Grup kurabilmek için önce bir topluluk profili oluşturmalısınız!");
                savePBtn.disabled = false;
                savePBtn.innerHTML = '<i class="fa-solid fa-rocket"></i> Grubu Canlıya Al';
                return;
            }

            const gClassroomTypeVal = document.getElementById("premium-group-classroom-type")?.value || "general";
            const isInstitutionalCreate = gClassroomTypeVal !== 'general';
            // Sınıf/ders veya iş yeri/ekip grubunda "Grup Adı" alanı yerini "Kurum/Okul Adı"na
            // bırakıyor — o durumda kurum adı hem grubun adı hem institutions kaydı olarak kullanılır.
            const gName = isInstitutionalCreate
                ? document.getElementById("premium-group-institution")?.value.trim()
                : document.getElementById("premium-group-name")?.value.trim();
            const gDesc = document.getElementById("premium-group-desc")?.value.trim() || "Birlikte odaklanıyoruz.";
            const gGoal = parseInt(document.getElementById("premium-group-goal")?.value) || 1000;

            if (!gName) {
                window.dcShowToast(isInstitutionalCreate ? "Kurum/okul adı boş bırakılamaz!" : "Grup adı boş bırakılamaz!");
                return;
            }

            if (!isInstitutionalCreate && gName.length > 30) {
                window.dcShowToast("Grup adı en fazla 30 karakter olabilir!");
                return;
            }

            if (isInstitutionalCreate && gName.length > 60) {
                window.dcShowToast("Kurum/okul adı en fazla 60 karakter olabilir!");
                return;
            }

            if (gDesc.length > 200) {
                window.dcShowToast("Grup açıklaması en fazla 200 karakter olabilir!");
                return;
            }

            if (gGoal < 100 || gGoal > 10000) {
                window.dcShowToast("Haftalık odak hedefi 100 ile 10.000 dakika arasında olmalıdır!");
                return;
            }

            savePBtn.disabled = true;
            savePBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Algoritmalar Çalışıyor...';

            // ── SUPABASE: grup oluşturma ──
            if (window.FocusSupabase && currentUser.id) {
                const gPrivacy = document.getElementById("premium-group-privacy")?.value || "public";
                const gCategory = document.getElementById("premium-group-category")?.value || "";
                const gClassroomType = gClassroomTypeVal;
                const gInstitution = isInstitutionalCreate ? gName : null;
                try {
                    const groupData = await window.createGroupSupabase(gName, gDesc, gGoal, gPrivacy, gCategory, gClassroomType, gInstitution, null);
                    savePBtn.disabled = false;
                    savePBtn.innerHTML = '<i class="fa-solid fa-rocket"></i> Grubu Canlıya Al';
                    hideGroupModal();

                    // Akış içerik kararı (2026-07-05): kaldırıldı.

                    if (typeof window.loadUserGroupsForDc === 'function') window.loadUserGroupsForDc();
                    if (typeof window.setupGroupRecentConversationsSupabase === 'function') window.setupGroupRecentConversationsSupabase();

                    if (typeof window.dcOpenGroupPanel === 'function') window.dcOpenGroupPanel(groupData.code);
                    else window.showGroupDetails(groupData.code, groupData);
                    window.showFocusaiConfirm({
                        title: '✨ Grubunuz Yayında!',
                        desc: `Grup kodun: <b style="font-size:16px; letter-spacing:2px;">${groupData.code}</b><br><br>Bu kod ile arkadaşlarını davet edebilirsin.`,
                        type: 'info', icon: 'fa-people-group', confirmText: 'Harika', cancelText: ''
                    });
                } catch (err) {
                    console.error("Grup kurma hatası:", err);
                    window.dcShowToast(err.message || "Grup oluşturulurken bir hata oluştu.");
                    savePBtn.disabled = false;
                    savePBtn.innerHTML = '<i class="fa-solid fa-rocket"></i> Grubu Canlıya Al';
                }
                return;
            }
        });

        // PREMIUM SEVİYE GRUBA KATILMA MOTORU
        groupJoinBtn?.addEventListener("click", async () => {
            const code = groupJoinInput?.value.trim().toUpperCase();
            if (!code || code.length !== 6) {
                window.dcShowToast("Lütfen 6 haneli geçerli bir grup kodu girin!");
                return;
            }

            if (!currentUser) {
                window.dcShowToast("Topluluk simülasyonuna katılmadan gruplara giremezsiniz!");
                return;
            }

            groupJoinBtn.disabled = true;
            groupJoinBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

            // ── SUPABASE: koda göre gruba katılma ──
            if (window.FocusSupabase && currentUser.id) {
                try {
                    const result = await window.joinGroupWithCodeSupabase(code);
                    groupJoinBtn.disabled = false;
                    groupJoinBtn.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket"></i> Gruba Katıl';
                    if (groupJoinInput) groupJoinInput.value = "";

                    if (result.pending) {
                        window.dcShowToast('Bu grup katılım onayı gerektiriyor. İsteğiniz yöneticilere iletildi, onaylandığında gruba katılacaksınız.');
                        return;
                    }

                    // Akış içerik kararı (2026-07-05): kaldırıldı.
                    if (typeof window.loadUserGroupsForDc === 'function') window.loadUserGroupsForDc();
                    if (typeof window.setupGroupRecentConversationsSupabase === 'function') window.setupGroupRecentConversationsSupabase();
                    if (typeof window.showGroupWelcomeModal === 'function') {
                        window.showGroupWelcomeModal(code, {
                            name: result.groupRow.name,
                            description: result.groupRow.description,
                            weeklyGoal: result.groupRow.weekly_goal,
                            category: result.groupRow.category
                        });
                    }
                } catch (e) {
                    groupJoinBtn.disabled = false;
                    groupJoinBtn.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket"></i> Gruba Katıl';
                    window.dcShowToast(e.message || 'Gruba katılırken hata oluştu.');
                }
                return;
            }
        });

       // ========================================================
        // 👥 TAM SENKRONİZE (REAL-TIME) GRUP YÖNETİM MOTORU
        // ========================================================
        let currentActiveGroupCode = null;
        // Faz 5 çıkarması (social-group-details.js) için köprü: o modül
        // currentActiveGroupCode'u okuyup yeniden atıyor, basit import bunu
        // senkron tutmaz (primitif kopyalanır) — getter/setter şart.
        window.__getCurrentActiveGroupCodeRef = () => currentActiveGroupCode;
        window.__setCurrentActiveGroupCodeRef = (v) => { currentActiveGroupCode = v; };

       // 3. ÜYE OLDUĞUM GRUPLARI LİSTELEME (SENKRONİZASYON SORUNU ÇÖZÜLMÜŞ TAM REAL-TIME SÜRÜM)
       // Her grup için açılan db.ref(groups/{code}) dinleyicilerini takip eder —
       // my_groups listesi her güncellendiğinde, artık listede olmayan gruplara ait
       // eski dinleyiciler off() edilmezse hem sızıntı olur hem de o gruba ait kart
       // tekrar render edilip "boş liste" mesajıyla aynı anda görünmeye devam eder.
       let _myGroupCardRefs = {};
       // Gruplarım kartlarında "şu an aktif" rozetini, kullanıcıların online
       // durumu değiştiğinde tekrar render etmeden güncelleyebilmek için
       // her grubun en güncel verisini burada tutuyoruz
       let _myGroupsDataCache = {};
       // Farklı (kardeş) IIFE kapsamlarındaki kanal/grup yönetimi kodu için global erişim
       window.getMyGroupsDataCache = () => _myGroupsDataCache;
       window.__setMyGroupsDataCacheRef = (v) => { _myGroupsDataCache = v; }; // Faz 5: social-institution-panel.js için
       function refreshMyGroupsActiveNow() {
           Object.entries(_myGroupsDataCache).forEach(([groupCode, groupData]) => {
               const activeNow = window.computeActiveNowCount(groupData);
               const el = document.getElementById(`my-group-active-${groupCode}`);
               if (el) {
                   el.innerHTML = activeNow > 0
                       ? `<span class="my-group-card-active-mini"><i class="fa-solid fa-circle"></i> ${activeNow}</span>`
                       : "";
               }
               if (groupCode === currentActiveGroupCode) {
                   const statEl = document.getElementById("group-overview-active-now");
                   if (statEl) statEl.textContent = activeNow;
               }
           });
       }
       // syncSidebarGroupList() de aynı my_groups yoluna kendi dinleyicisini kuruyor —
       // parametresiz .off() o yoldaki TÜM dinleyicileri sildiği için, sadece KENDİ
       // önceki callback'imizi saklayıp onu kaldırıyoruz (bkz. _sidebarMyGroupsCb).
       let _myGroupsListCb = null;

       window.loadMyGroups = () => loadMyGroups(); // Faz 5: social-group-details.js'ten çağrılabilmesi için (hoisting ile güvenli)
       function loadMyGroups() {
        if (!currentUser || !myGroupsContainer) return;

        // ── SUPABASE: "Gruplarım" listesi ──
        if (window.FocusSupabase && currentUser.id) {
            window.loadMyGroupsSupabase();
            return;
        }

    }


    });

    // FocusAI Çevrimiçi Bölüm - Alt Sekme Geçiş Entegrasyonu
document.addEventListener("DOMContentLoaded", () => {
    const socialTabBtns = document.querySelectorAll(".social-tab-btn");
    const socialContents = document.querySelectorAll(".social-content");

    socialTabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const targetTab = btn.getAttribute("data-social-target");

            // Aktif buton sınıfını güncelle
            socialTabBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            // Sohbet sekmesinden ayrılınca açık kalan istatistik panelini kapat
            if (targetTab !== 'tab-sohbet') {
                document.getElementById('analytics-modal')?.classList.remove('dc-panel-open');
            }

            // Sohbet alt-sekmesinden (Bireysel/Gruplar sekmesine) ayrılırken açık bir
            // DM/grup sohbeti varsa kapat — yoksa window._activeChatTarget o sohbete
            // kilitli kalır, karşıdan gelen yeni mesajlar sessizce okundu işaretlenip
            // Son Mesajlaşmalar rozeti hiç görünmez.
            if (btn.getAttribute("data-tab") !== "sohbet" && typeof closeDcChat === 'function') {
                closeDcChat();
            }

            // Aktif içerik sayfasını göster/gizle
            socialContents.forEach(content => {
                if (content.id === targetTab) {
                    content.classList.add("active");
                    content.style.display = "block";
                } else {
                    content.classList.remove("active");
                    content.style.display = "none";
                }
            });

            // 4D: Tab geçişinde render fonksiyonlarını çağır
            const tab = btn.getAttribute("data-tab");
            const socialSection = document.getElementById('arkadaslar');
            if (socialSection) {
                socialSection.classList.toggle('sohbet-active', tab === 'sohbet' || tab === 'bireysel' || tab === 'gruplar');
            }
            if (tab === "bireysel") {
                // TEK PANEL: Bireysel = sohbet panelinin "Ana Sayfa" görünümü
                if (typeof window.dcSetMainView === 'function') window.dcSetMainView('home');
                const sidebar = document.getElementById('premium-social-sidebar');
                if (sidebar) sidebar.classList.remove('hidden-sidebar');
                if (typeof syncSidebarGroupList === "function") syncSidebarGroupList();
                if (typeof window.syncDcContactList === "function") window.syncDcContactList();
                if (typeof window.updateSbProfile === "function") window.updateSbProfile();
                if (typeof window.loadUserGroupsForDc === "function") window.loadUserGroupsForDc();
                if (typeof window.renderLeaderboardFromCache === "function") window.renderLeaderboardFromCache();
            } else if (tab === "gruplar") {
                // TEK PANEL: Gruplar = aktif grubun panel görünümü
                const sidebar = document.getElementById('premium-social-sidebar');
                if (sidebar) sidebar.classList.remove('hidden-sidebar');
                if (typeof syncSidebarGroupList === "function") syncSidebarGroupList();
                if (typeof window.loadUserGroupsForDc === "function") window.loadUserGroupsForDc();
                if (typeof window.dcOpenGroupPanel === 'function') window.dcOpenGroupPanel();
                if (typeof renderMyGroups === "function") renderMyGroups();
            } else if (tab === "sohbet") {
                // Sohbet tabı açılınca panel verilerini güncelle
                if (typeof window.dcSetMainView === 'function') window.dcSetMainView('chat');
                const sidebar = document.getElementById('premium-social-sidebar');
                if (sidebar) sidebar.classList.remove('hidden-sidebar');
                if (typeof syncSidebarGroupList === "function") syncSidebarGroupList();
                if (typeof window.syncDcContactList === "function") window.syncDcContactList();
                if (typeof window.updateSbProfile === "function") window.updateSbProfile();
                if (typeof window.renderRecentConversations === "function") window.renderRecentConversations();
                // Grup listesini yükle (Supabase-öncelikli)
                if (typeof window.loadUserGroupsForDc === "function") window.loadUserGroupsForDc();
                if (typeof window.updateDcBottomProfile === "function") window.updateDcBottomProfile();
            }
        });
    });
});


// ==========================================================================
    // SOSYAL KENAR ÇUBUĞU KAPATMA BUTONU
    // ==========================================================================
    const premiumSidebar = document.getElementById('premium-social-sidebar');
    const closeSidebarBtn = document.getElementById('close-social-sidebar-btn');

    if (closeSidebarBtn) {
        closeSidebarBtn.addEventListener('click', () => {
            // TEK PANEL: kapatma = Ana Sayfa görünümüne dön
            if (typeof closeDcChat === 'function') closeDcChat();
            if (typeof window.dcSetMainView === 'function') window.dcSetMainView('home');
            else premiumSidebar.classList.add('hidden-sidebar');
        });
    }

    // ==========================================================================
    // SOSYAL SAYFASINDAKİ "SOHBET" BUTONU → TAM PANELİ AÇAR
    // ==========================================================================

    function _openFullPanel() {
        // Sohbet artık tab içinde — arkadaslar bölümüne git + Sohbet tabını aç
        const arkadaslarNav = document.querySelector('.nav-links li[data-target="arkadaslar"], .di[data-target="arkadaslar"]');
        if (arkadaslarNav) arkadaslarNav.click();

        setTimeout(() => {
            _switchToSohbetTab();
        }, 80);
    }

    function _switchToSohbetTab() {
        const sohbetBtn = document.getElementById('social-tab-sohbet-btn');
        if (sohbetBtn) {
            sohbetBtn.click();
        } else {
            // Fallback: manuel tab geçişi
            document.querySelectorAll('.social-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.social-content').forEach(c => c.classList.remove('active'));
            document.getElementById('tab-sohbet')?.classList.add('active');
        }
        // Panel verilerini güncelle
        if (premiumSidebar) premiumSidebar.classList.remove('hidden-sidebar');
        syncSidebarGroupList();
        if (typeof window.syncDcContactList === 'function') window.syncDcContactList();
        window.updateSbProfile?.();
        if (typeof window.loadUserGroupsForDc === 'function') window.loadUserGroupsForDc();
        if (typeof window.updateDcBottomProfile === 'function') window.updateDcBottomProfile();
        // Sohbet modunda maksimum alan
        const _sec = document.getElementById('arkadaslar');
        if (_sec) _sec.classList.add('sohbet-active');
    }

    // Social sayfasındaki "Sohbet" butonu → tam paneli açar
    const _socialOpenChatBtn = document.getElementById('social-open-chat-btn');
    if (_socialOpenChatBtn) {
        _socialOpenChatBtn.addEventListener('click', _openFullPanel);
    }

    // Okunmamış sayısını Social butonunda da göster
    const _origRenderFloating = window.renderFloatingChatBadge;
    window.renderFloatingChatBadge = function() {
        if (typeof _origRenderFloating === 'function') _origRenderFloating();
        // Aynı tek kaynaktan oku — yüzen rozetle aynı mantık: sayı sadece DM,
        // grup hareketliliği sessiz nokta.
        const t = (typeof window.dcUnreadTotals === 'function') ? window.dcUnreadTotals() : { dmTotal: 0, groupTotal: 0 };
        const badge = document.getElementById('social-chat-unread-count');
        if (badge) {
            if (t.dmTotal > 0) {
                badge.textContent = t.dmTotal > 9 ? '9+' : t.dmTotal;
                badge.classList.remove('is-dot');
                badge.style.display = 'inline-flex';
            } else if (t.groupTotal > 0) {
                badge.textContent = '';
                badge.classList.add('is-dot');
                badge.style.display = 'inline-flex';
            } else {
                badge.classList.remove('is-dot');
                badge.style.display = 'none';
            }
        }
    };

    // ==========================================================================
    // SOHBET PANELİ FİREBASE ENTEGRASYONU VE CANLI MESAJLAŞMA MOTORU
    // ==========================================================================
    let activeGroupId = null;
    window.__getActiveGroupIdRef = () => activeGroupId; // social-productivity-share.js için salt-okunur köprü

    // "Sosyal > Gruplar" sekmesindeki loadMyGroups() de aynı my_groups yoluna kendi
    // dinleyicisini kuruyor — parametresiz .off() o yoldaki TÜM dinleyicileri (bu
    // fonksiyonunki dahil) sildiği için, sadece KENDİ önceki callback'imizi saklayıp
    // onu kaldırıyoruz; böylece iki dinleyici birbirini söküp canlı güncellemeyi
    // (örn. Keşfet'ten katılınca sohbet listesinin anında güncellenmesini) bozmuyor.
    let _sidebarMyGroupsCb = null;

    // Paneldeki "Gruplarım" listesini mevcut Firebase listesiyle eşitleyen fonksiyon (Kilitlenme ve Takılma Önleyicili Güvenli Sürüm)
    window.syncSidebarGroupList = syncSidebarGroupList;
    function syncSidebarGroupList() {
        const container = document.getElementById('sidebar-my-conversations-list');
        if (!container) return;

        if (window.FocusSupabase && currentUser?.id) {
            if (typeof window.setupGroupRecentConversationsSupabase === 'function') window.setupGroupRecentConversationsSupabase();
            return;
        }
        if (!currentUser) {
            container.innerHTML = '<div style="padding:10px; font-size:12px; color:var(--text-muted); text-align:center;">Giriş bekleniyor...</div>';
            return;
        }
        // Firebase kaldırıldı — Supabase yolu yukarıda ele alındı; burada yapacak bir şey yok
    }

    // Aktif oda satırını vurgula
    function highlightActiveRoom(gCode, roomId) {
        const roomsList = document.getElementById(`sidebar-rooms-${gCode}`);
        if (!roomsList) return;
        roomsList.querySelectorAll('.sb-room-item').forEach(el => {
            el.style.background = 'transparent';
            el.style.color = 'rgba(255,255,255,0.7)';
            el.style.fontWeight = '400';
        });
        // Aktif olanı bul ve vurgula
        roomsList.querySelectorAll('.sb-room-item').forEach(el => {
            const isGeneral = roomId === 'general' && !el.dataset.roomId;
            const isMatch = el.dataset.roomId === roomId;
            if (isGeneral || isMatch) {
                el.style.background = 'rgba(108,92,231,0.2)';
                el.style.color = '#a29bfe';
                el.style.fontWeight = '600';
            }
        });
    }

    // Sohbet Odasını Açma ve Mesajları Firebase'den Canlı Dinleme

    // ── Sohbet İçi Arama + Tüm Sohbetlerde Arama (2026-07-18) → social-chat-search.js dosyasına taşındı ──────

    // ── Sohbeti Temizle Butonu (2026-07-18) → social-chat-clear.js dosyasına taşındı ──────

    // ── ÜRETKENLİK PAYLAŞMA SİSTEMİ ────────────────────────── → social-productivity-share.js dosyasına taşındı

   const sidebarActionAddBtn = document.getElementById('sidebar-action-add-btn');
   const sidebarActionInput = document.getElementById('sidebar-action-input');

   // Bu kutu artık üç işi birden yapıyor: "@kullanıcı" yazılırsa arkadaş ekleme,
   // 6 karakterlik bir kod yazılırsa gruba katılma, bunların hiçbiri değilse
   // (ör. bir cümle/kelime) "Tüm sohbetlerde mesaj ara" akışını açıyoruz —
   // eskiden ayrı bir buton olan bu arama artık aynı kutudan tetikleniyor.
   const GROUP_CODE_RE = /^[a-z0-9]{6}$/i;
   if (sidebarActionAddBtn && sidebarActionInput) {
       sidebarActionAddBtn.addEventListener('click', () => {
           let val = sidebarActionInput.value.trim();
           if (!val) return;

           if (val.startsWith('@')) {
               const cleanUsername = val.replace('@', '').toLowerCase().trim();
               const friendInput = document.getElementById('add-friend-input');
               const friendSearchBtn = document.getElementById('add-friend-search-btn');
               const friendModal = document.getElementById('add-friend-modal');

               if (friendInput && friendSearchBtn && friendModal) {
                   friendModal.classList.remove('hidden');
                   friendInput.value = cleanUsername;
                   sidebarActionInput.value = '';
                   friendSearchBtn.click();
               } else {
                   window.dcShowToast('Arkadaş ekleme sistemi ana sayfada bulunamadı.');
               }
           } else if (GROUP_CODE_RE.test(val)) {
               const mainJoinInput = document.getElementById('join-group-input') || document.getElementById('group-join-input');
               const mainJoinBtn = document.getElementById('join-group-btn') || document.getElementById('group-join-btn');

               if (mainJoinInput && mainJoinBtn) {
                   mainJoinInput.value = val.toUpperCase();
                   mainJoinBtn.click();
                   sidebarActionInput.value = '';
                   setTimeout(syncSidebarGroupList, 1500);
               } else {
                   window.dcShowToast('Grup katılım sistemi ana sekmede bulunamadı.');
               }
           } else if (typeof window.openDcGlobalSearch === 'function') {
               // Mesaj arama sohbetin parçası — sohbet yetkisi yoksa açılmaz
               // (ikon CSS ile zaten gizliydi; bu dal kapısız kalmıştı)
               if (typeof window.dcChatEnabled === 'function' && !window.dcChatEnabled()) {
                   window.dcShowToast('Mesaj arama, sohbetle birlikte Premium planda açılır.', 'info');
                   return;
               }
               window.openDcGlobalSearch(val);
               sidebarActionInput.value = '';
           }
       });

       sidebarActionInput.addEventListener('keydown', e => {
           if (e.key === 'Enter') { e.preventDefault(); sidebarActionAddBtn.click(); }
       });
   }





// ── SOHBET PANELİ: PROFİL GÜNCELLEME + KİŞİLER LİSTESİ (2026-07-18) → social-sidebar-profile.js dosyasına taşındı ──────


// ═══════════════════════════════════════════════════════
// 🎮  GRUP & KANAL NAVİGASYON MOTORU
// ═══════════════════════════════════════════════════════
(function() {
    'use strict';

    // Durum değişkenleri
    let dcActiveGroupCode = null;
    // social-server-tree.js ile paylaşımlı (o modül de bu değeri reassign ediyor)
    window.__getDcActiveGroupCode = () => dcActiveGroupCode;
    window.__setDcActiveGroupCode = (v) => { dcActiveGroupCode = v; };
    let dcActiveRoomId    = 'general';
    // Dışarıdan erişim için window'a bağla
    window._dcState = { groupCode: null, roomId: 'general', chanId: null };
    let _dcMembersSupabaseChannel  = null; // group_members/group_custom_roles realtime kanalı (üye listesi paneli)
    let _dcMembersPresenceHandler  = null; // 'focusai:presence-changed' dinleyicisi (üye listesi paneli)
    // social-room-presence.js ile paylaşımlı (o modül de bu ikisini reassign ediyor)
    window.__getDcMembersSupabaseChannel = () => _dcMembersSupabaseChannel;
    window.__setDcMembersSupabaseChannel = (v) => { _dcMembersSupabaseChannel = v; };
    window.__getDcMembersPresenceHandler = () => _dcMembersPresenceHandler;
    window.__setDcMembersPresenceHandler = (v) => { _dcMembersPresenceHandler = v; };
    let dcContactsUsersRef = null; // Kişi listesindeki çevrimiçi durumların canlı takibi
    let dcContactsUsersCb  = null; // ref.off() argümansız çağrılırsa AYNI yoldaki (focusai_community/users)
                                    // diğer dinleyicileri (ör. subscribeOnlineFriends) de siler — bu yüzden
                                    // sadece kendi callback'imizi off() ile kaldırıyoruz.
    const openCategories  = new Set();
    let _dcRoomPresenceChannels = {}; // subId → Supabase Realtime Presence kanalı (oda şeritleri)
    // social-server-tree.js/social-room-presence.js ile paylaşımlı (property yazımı + wholesale reassign)
    window.__getDcRoomPresenceChannels = () => _dcRoomPresenceChannels;
    window.__setDcRoomPresenceChannels = (v) => { _dcRoomPresenceChannels = v; };
    let _dcLeaveBtnAC = null;
    // Oda/DM değişiminde önceki mesaj gönder listener'larını iptal etmek için — cloneNode yerine
    let _dcInputAbortController = null;

    // ─── UÇTAN UCA ŞİFRELEME (E2E) ───────────────────────────────────────
    // social-e2e.js dosyasına taşındı (isE2ESupported, getOrCreateE2EKeyPair,
    // getOtherE2EPublicKey, getDmSharedKey, encryptDmText, window.decryptDmText).

    // ─── SUPABASE PROFİL ÇÖZÜMLEME + MESAJ NORMALİZE → social-dc-profile-resolve.js
    // dosyasına taşındı (Faz E, 2026-07-23). _resolveProfileByUsername/
    // _resolveProfileById/_fetchDcReactionsMap/_normalizeSupabaseMessageBase/
    // _normalizeSupabaseDmMessage/_normalizeSupabaseGroupMessage window.X
    // olarak erişilebilir.
    // Aynı kişiden bu süre içinde gelen ardışık mesajlar avatar/isim tekrarı olmadan gruplanır
    const DC_MSG_GROUP_WINDOW_MS = 5 * 60 * 1000; // 5 dakika

    // ─── YANITLA + MESAJ SEÇME / İLETME / KOPYALAMA ─────────
    let _dcReplyTo       = null;        // { sender, text, msgKey } — yanıtlanacak mesaj
    let _dcCurrentRole   = 'member';    // Açık olan grup sohbetindeki rolümüz (admin/moderatör mesaj silebilir)
    let _dcSelectedKeys  = new Set();   // Seçili mesajların Firebase key'leri
    window.__getDcSelectedKeys = () => _dcSelectedKeys; // social-dc-msg-selection.js için
    let _dcMsgRegistry   = {};          // key -> mesaj verisi (kopyala/ilet için)
    // social-typing-read-receipts.js ile paylaşımlı (salt-okunur — sadece property okuyor)
    window.__getDcMsgRegistry = () => _dcMsgRegistry;
    // Tüm sohbetlerde arama için: path -> { meta: {...}, msgs: { key: m } }
    let _dcGlobalMsgCache = {};
    window._dcGlobalMsgCache = _dcGlobalMsgCache;
    let _dcCurrentDmTarget = null;      // { username, displayName } — açık DM hedefi (ilet hedefi seçiminde hariç tutulur)
    let _dcCurrentMsgPath  = null;      // Açık sohbetin Firebase mesaj yolu (düzenle/sil için)
    window.__getDcCurrentMsgPath = () => _dcCurrentMsgPath; // social-dc-msg-selection.js için
    let _dcCurrentJoinedAt = 0;         // Açık grup sohbetinde kullanıcının katıldığı tarih — bundan ÖNCEKİ mesajlar gösterilmez
    let _dcRoomPresenceRef = null;      // Açık çalışma odasının presence dinleyicisi
    let _dcCurrentRoomPresence = [];    // Açık çalışma odasında şu an bulunan kullanıcı adları (mention için)
    // social-room-presence.js ile paylaşımlı (o modül de bu diziyi reassign ediyor)
    window.__getDcCurrentRoomPresence = () => _dcCurrentRoomPresence;
    window.__setDcCurrentRoomPresence = (v) => { _dcCurrentRoomPresence = v; };
    let _dcOutgoingDmRequestRef = null;     // Arkadaş olmayan DM hedefine gönderdiğimiz mesaj isteğinin durum dinleyicisi
    let _dcOutgoingDmRequestStatus = null;  // null | 'pending' | 'accepted' — arkadaş olmayan DM hedefine mesaj isteği durumu

    // ─── ESKİ MESAJLARI GEÇ YÜKLEME (LAZY LOAD) ─────────────
    let _dcOldestKey       = null;      // Şu an yüklü en eski mesajın Firebase key'i (veya Supabase DM'de message id'si)
    let _dcLoadingMore     = false;     // Eski mesaj yükleme isteği devam ediyor mu
    let _dcOldestCreatedAt = null;      // Supabase DM: en eski yüklü mesajın created_at'i (sayfalama imleci)

    // ─── SUPABASE GRUP SOHBETİ (M2b-3 Bölüm 1) ──────────────
    let _dcCurrentGroupId = null;       // Açık Supabase grubunun uuid'i (null = Supabase grup modunda değil) — kanal/alt-kanal değişse de set kalır
    // ─── SUPABASE KANAL/ALT-KANAL AĞACI (M2b-3 Bölüm 2) ─────
    let _dcCurrentGroupScope = null;    // { type: 'group'|'group_channel'|'group_subchannel', id: <uuid> } — messages scope_type/scope_id kaynağı
    // social-typing-read-receipts.js ile paylaşımlı (salt-okunur)
    window.__getDcCurrentGroupScope = () => _dcCurrentGroupScope;
    let _dcSupabaseChannelTreeChannel = null; // group_channels/group_subchannels realtime kanalı
    // social-server-tree.js ile paylaşımlı (o modül de bu kanalı reassign ediyor)
    window.__getDcSupabaseChannelTreeChannel = () => _dcSupabaseChannelTreeChannel;
    window.__setDcSupabaseChannelTreeChannel = (v) => { _dcSupabaseChannelTreeChannel = v; };

    // Supabase grup üyeliğinde basit yönetim yetkisi (M2b-4'e kadar: sadece 'admin')
    function _isSupabaseGroupAdmin(groupCode) {
        const g = window.getMyGroupsDataCache()[groupCode];
        const me = currentUser && currentUser.username;
        if (!g || !me || !g.members || !g.members[me]) return false;
        return g.members[me].role === 'admin';
    }
    window._isSupabaseGroupAdmin = _isSupabaseGroupAdmin;

    // ─── SUPABASE DM OTURUMU (M2b-1) ────────────────────────
    let _dcCurrentConversation = null;  // Açık DM'in `conversations` satırı (null = Supabase DM modunda değil)
    // social-typing-read-receipts.js ile paylaşımlı (salt-okunur)
    window.__getDcCurrentConversation = () => _dcCurrentConversation;
    let _dcCurrentOtherProfile = null;  // DM hedefinin `profiles` satırı
    let _dcSupabaseMsgChannel  = null;  // `messages` tablosu realtime kanalı
    let _dcReadChannel             = null;  // `message_reads` tablosu realtime kanalı (DM)
    // social-typing-read-receipts.js ile paylaşımlı (o modül de bu kanalı reassign ediyor)
    window.__getDcReadChannel = () => _dcReadChannel;
    window.__setDcReadChannel = (v) => { _dcReadChannel = v; };
    // _dcPinnedChannel/_dcPinnedConversationId/_dcPinnedScope/_dcPinnedRef/
    // _dcPinnedPath/_dcPinnedMsgs/_dcPinnedIndex → social-message-pins.js
    // dosyasına taşındı (Faz 2, 2026-07-19).

    // ─── SALT-OKUNUR SOHBET BAĞLAMI KÖPRÜSÜ ─────────────────
    // Ayrılan modüllerin (örn. social-message-pins.js) bu değişkenleri
    // window.*'a taşımadan (yüzlerce iç kullanım noktasını değiştirmeye
    // gerek kalmadan) okuyabilmesi için. Fonksiyon her çağrıldığında GÜNCEL
    // değerleri döner (closure) — bunlar hiçbir zaman ayrılan modüller
    // tarafından yazılmıyor, sadece social.js içinde mutasyona uğruyor.
    window._dcGetChatContext = function () {
        return {
            currentUser,
            dmConversation: _dcCurrentConversation,
            groupScope: _dcCurrentGroupScope,
            msgPath: _dcCurrentMsgPath,
            otherProfile: _dcCurrentOtherProfile,
            role: _dcCurrentRole
        };
    };
    let _dcReactionsChannel        = null;  // `message_reactions` tablosu realtime kanalı

    // Açık DM'e ait tüm Supabase realtime kanallarını/oturum durumunu kapatır —
    // DM'den bir grup sohbetine geçerken veya başka bir DM açılırken çağrılır.
    function teardownDcSupabaseDmChannels() {
        if (_dcSupabaseMsgChannel) { window.FocusSupabase.removeChannel(_dcSupabaseMsgChannel); _dcSupabaseMsgChannel = null; }
        if (_dcReadChannel)        { window.FocusSupabase.removeChannel(_dcReadChannel); window.__setDcReadChannel(null); }
        if (_dcReactionsChannel)   { window.FocusSupabase.removeChannel(_dcReactionsChannel); _dcReactionsChannel = null; }
        window.teardownDmTypingSupabase();
        window.teardownDcGroupTypingSupabase();
        window.teardownDcGroupReadReceiptSupabase();
        window.teardownDmPinnedSupabase();
        window.teardownGroupPinnedSupabase();
        _dcCurrentConversation = null;
        _dcCurrentOtherProfile = null;
        _dcCurrentGroupId = null;
        _dcCurrentGroupScope = null;
        window._dcCurrentGroupId = null;
        window._dcCurrentGroupScope = null;
        _dcLastOpenArgs = null;
        dcHideSessionStrip();
    }

    // ─── ANİMASYON / İLK YÜKLEME TAKİBİ ─────────────────────
    let _dcRenderedKeys    = {};        // path -> Set(msgKey) — yeni mesaj animasyonu için

    // ─── SADECE BENDEN SİL — social-chat-local-delete.js dosyasına
    // taşındı (Faz 2, 2026-07-19). window.dcGetClearedAt/dcSetClearedAt/
    // window.dcGetDeletedForMe/window.dcAddDeletedForMe üzerinden erişiliyor.

    // ─── YAZIYOR... GÖSTERGESİ → social-typing-read-receipts.js dosyasına
    // taşındı (Faz 6). _dcTypingMyRef/_dcTypingListenRef/_dcTypingTimeout
    // sadece o dosyada kullanılıyor, buraya taşınmadı.
    let _dcSubtitleDefault   = '';      // Header alt başlığının orijinal metni (yazıyor göstergesi bitince geri dönülür)
    // social-typing-read-receipts.js ile paylaşımlı (salt-okunur)
    window.__getDcSubtitleDefault = () => _dcSubtitleDefault;

    // ─── OKUNDU BİLGİSİ → social-typing-read-receipts.js dosyasına taşındı
    // (Faz 6). _dcReadListenRef/_dcReadPath sadece o dosyada kullanılıyor.
    let _dcOtherLastRead     = 0;       // Karşı tarafın son okuma zaman damgası
    // social-typing-read-receipts.js ile paylaşımlı (o modül bu değeri reassign ediyor)
    window.__getDcOtherLastRead = () => _dcOtherLastRead;
    window.__setDcOtherLastRead = (v) => { _dcOtherLastRead = v; };

    // ─── OKUNDU BİLGİSİ (GRUP) → social-typing-read-receipts.js dosyasına
    // taşındı (Faz 6). _dcGroupReadListenRef/_dcGroupReadPath/_dcGroupLastRead/
    // _dcUserInfoCache sadece o dosyada kullanılıyor.

    // ─── OKUNMAMIŞ AYIRACI / HIZLI ATLAMA ──────────────────
    let _dcOpenLastRead = 0;  // Sohbet açılırken yakalanan "son okuma" zamanı (ayıracı konumlandırmak için)

    // ─── SABİTLENMİŞ MESAJLAR ───────────────────────────────
    // _dcPinnedRef/_dcPinnedPath/_dcPinnedMsgs/_dcPinnedIndex → social-message-pins.js

    // Firebase kaldırıldı — her zaman null döner; tüm `if (!database)` guard'ları bu sayede sağlıklı çalışır
    function getDB() { return null; }
    window.getDB = getDB;

    function getUser() {
        try { return JSON.parse(localStorage.getItem('focusai_social_user')); } catch { return null; }
    }
    window.getUser = getUser;

    // ─── YARDIMCI: avatar URL ───────────────────────────
    function dcAvatar(name, color) {
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(name||'U')}&background=${color||'6c5ce7'}&color=fff`;
    }
    window.dcAvatar = dcAvatar;

    // ─── PANEL GEÇİŞLERİ ────────────────────────────────
    function showHomePanel() {
        // Yenileme restorasyonu devam ederken açık (geri yüklenmiş) sohbeti
        // silme — restore penceresi kapanınca normal davranışa dönülür.
        // (Kullanıcının bilinçli kapatmaları closeDcChat üzerinden geldiği ve
        // closeDcChat _activeChatTarget'ı önce null'ladığı için engellenmez.)
        const _fromUserClick = typeof window.event !== 'undefined' && window.event && window.event.isTrusted;
        if (window._dcRestorePending && window._activeChatTarget && !_fromUserClick) {
            console.warn('[FocusAI] showHomePanel: sohbet restorasyonu sırasında otomatik çağrı yoksayıldı.', new Error().stack);
            return;
        }
        const home  = document.getElementById('dc-home-panel');
        const guild = document.getElementById('dc-guild-panel');
        const chat  = document.getElementById('dc-chat-area');
        if (home)  home.style.display  = 'flex';
        if (guild) guild.style.display = 'none';
        // Sohbet alanını sıfırla
        const empty = document.getElementById('dc-chat-empty-state');
        const stream = document.getElementById('sidebar-chat-messages-stream');
        const header = document.getElementById('dc-chat-header');
        if (empty)  empty.style.display  = 'flex';
        if (stream) { stream.style.display = 'none'; stream.innerHTML = ''; }
        if (header) header.style.display = 'none';
        // Bir kanal/kişi seçilmeden mesaj yazılamasın
        const msgInputEl = document.getElementById('sidebar-chat-message-input');
        const msgSendBtn = document.getElementById('sidebar-chat-send-msg-btn');
        if (msgInputEl) { msgInputEl.disabled = true; msgInputEl.value = ''; }
        if (msgSendBtn) msgSendBtn.disabled = true;
        document.querySelectorAll('.dc-tree-group-header').forEach(el => el.classList.remove('active-group', 'open'));
        document.querySelectorAll('.dc-tree-channels').forEach(el => el.classList.remove('open'));
        document.querySelectorAll('.dc-tree-channel').forEach(el => el.classList.remove('active'));
        dcActiveGroupCode = null;
        window._dcState.groupCode = null;
        window._dcState.roomId = 'general';
        window._dcState.chanId = null;
        if (_dcSupabaseChannelTreeChannel && window.FocusSupabase) { window.FocusSupabase.removeChannel(_dcSupabaseChannelTreeChannel); _dcSupabaseChannelTreeChannel = null; }
        if (typeof window.detachDcListeners === 'function') window.detachDcListeners();
    }
    window.showHomePanel = showHomePanel;

    // Bir gruptan ayrılındığında, o grubun sohbeti açık DC sidebar'da
    // görüntüleniyorsa kapatır — başka bir grubun/DM'in sohbeti açıksa dokunmaz.
    window.__dcCloseChatIfGroup = function(groupCode) {
        const openGroupCode = window._dcState && window._dcState.groupCode;
        if (dcActiveGroupCode === groupCode || openGroupCode === groupCode) {
            window._leaveCurrentWorkRoom();
            if (typeof closeDcChat === 'function') closeDcChat();
            showHomePanel();
            return true;
        }
        return false;
    };

    // ─── TEK PANEL: ANA GÖRÜNÜM YÖNETİCİSİ ─────────────────────
    // Chat alanının üç modu: 'chat' (mesajlaşma, varsayılan), 'home' (Ana Sayfa
    // panosu) ve 'group-panel' (grup istatistik/seans paneli). Mod, #dc-chat-area
    // üzerindeki class ile yönetilir; CSS chat çocuklarını gizleyip ilgili
    // görünümü gösterir. Empty-state ve hc-focus-pane mantığına dokunulmaz —
    // onlar yalnızca 'chat' modunun alt durumlarıdır.
    function dcSetMainView(mode, opts) {
        // Sayfa yenileme restorasyonu (_dcRestoreLastOpenOnLoad) bir grup panelini
        // (ör. Sınıf Paneli > Sınıflar/Öğrenciler) geri açtıktan sonra hâlâ birkaç
        // saniye "kilit" tutuyor (bkz. dcOpenGroupPanel'deki aynı desen) — çünkü
        // DOMContentLoaded+1200ms gibi geç çalışan başka açılış kodları (ör. "Bireysel"
        // sekmesinin varsayılan görünümü) dcOpenGroupPanel'i değil DOĞRUDAN
        // dcSetMainView('home')'u çağırıyordu, bu da o guard'ı atlayıp geri yüklenen
        // paneli ezip kullanıcıyı Arena'ya fırlatıyordu. Gerçek (kullanıcı tıklamalı)
        // "home" çağrılarına ve finish()'in meşru başarısız-restore fallback'ine
        // ({force:true}) izin veriyoruz, otomatik/programatik olanları yoksayıyoruz.
        const _force = !!(opts && opts.force);
        if (mode === 'home' && window._dcRestorePending && !_force) {
            // Sadece gerçek bir TIKLAMA kullanıcı niyeti sayılır — DOMContentLoaded gibi
            // tarayıcı olayları da isTrusted olduğundan (switchTab restore akışı) yalnızca
            // isTrusted kontrolü guard'ı yanlışlıkla atlatıyordu.
            const _fromUserClick = typeof window.event !== 'undefined' && window.event && window.event.isTrusted && window.event.type === 'click';
            if (!_fromUserClick) {
                console.warn('[FocusAI] dcSetMainView(home): restorasyon beklenirken otomatik çağrı yoksayıldı.');
                return;
            }
        }
        // Faz 2: sohbet yetkisi olmayan kullanıcı chat görünümüne GEÇEMEZ —
        // hangi koddan çağrılırsa çağrılsın Arena'ya yönlenir.
        if (mode === 'chat' && !dcChatEnabled()) mode = 'home';
        const area = document.getElementById('dc-chat-area');
        if (!area) return;
        area.classList.toggle('dc-view-home', mode === 'home');
        area.classList.toggle('dc-view-group-panel', mode === 'group-panel');
        // Mobil: görünüm değişince açık sohbet listesi overlay'ini kapat
        document.getElementById('premium-social-sidebar')?.classList.remove('dc-mobile-list-open');
        if (typeof window._updateArenaChipActive === 'function') window._updateArenaChipActive();
    }
    window.dcSetMainView = dcSetMainView;

    // Ana Sayfa nav öğesi (Kademe 2'de görünür olacak; işleyici şimdiden hazır)
    // Özetim'e geçerken açık kalan bir DM/grup sohbeti varsa kapat — aksi halde
    // window._activeChatTarget o sohbete kilitli kalır ve karşıdan gelen yeni
    // mesajlar hâlâ "o sohbeti izliyormuşsun" sanılıp sessizce okundu işaretlenir,
    // Son Mesajlaşmalar'daki rozet hiç görünmez.
    document.getElementById('dc-nav-home')?.addEventListener('click', () => {
        if (typeof closeDcChat === 'function') closeDcChat();
        dcSetMainView('home');
        if (typeof window.renderHomeSummary === 'function') window.renderHomeSummary();
    });
    document.getElementById('dc-chat-focus-invite-btn')?.addEventListener('click', () => {
        const target = window._activeChatTarget;
        if (!target) return;

        if (target.type === 'dm') {
            const titleEl = document.getElementById('live-chat-target-title');
            const targetName = (titleEl?.textContent || target.username).replace(/^@/, '');
            const targetColor = _dcCurrentOtherProfile?.avatar_color || '6c5ce7';
            if (typeof window.openBuddyFocusSettingsModal === 'function') {
                window.openBuddyFocusSettingsModal(target.username, targetName, targetColor, null);
            }
            return;
        }

        // Grup/kanal sohbeti: göndermeden önce DM akışındaki aynı zamanlayıcı
        // ayarları modalını (süre/mola/tur) aç — onaylanınca sendGroupFocusInvite
        // oda kurar ve kanala davet kartı gönderir (bkz. _renderDcCwRoomInviteCard).
        if (target.type === 'group' && _dcCurrentGroupScope && window.FocusSupabase && currentUser?.id) {
            if (typeof window.openGroupFocusSettingsModal === 'function') {
                window.openGroupFocusSettingsModal({ type: _dcCurrentGroupScope.type, id: _dcCurrentGroupScope.id });
            }
        }
    });
    document.getElementById('dc-leave-bar-focus-return-btn')?.addEventListener('click', () => {
        if (typeof restoreSharedFocusOverlay === 'function') restoreSharedFocusOverlay();
    });
    document.getElementById('dc-home-chats-btn')?.addEventListener('click', () => {
        document.getElementById('premium-social-sidebar')?.classList.toggle('dc-mobile-list-open');
    });

    // ─── SEANS ŞERİDİ: kanal sohbetinin üstünde yaklaşan seans ──
    // "Haberleşelim" ihtiyacını mesaj yazmadan çözer: sıradaki seansı ve
    // katılımcı sayısını gösterir, tek tıkla "Varım" denir.
    let _sessionStripGroupId = null;

    function dcHideSessionStrip() {
        _sessionStripGroupId = null;
        document.getElementById('dc-session-strip')?.remove();
    }
    window.dcHideSessionStrip = dcHideSessionStrip;

    window.dcRenderSessionStrip = (groupUuid) => dcRenderSessionStrip(groupUuid); // Faz 5: social-group-details.js için
    async function dcRenderSessionStrip(groupUuid) {
        if (!window.FocusSupabase || !currentUser?.id || !groupUuid) return;
        _sessionStripGroupId = groupUuid;
        try {
            const todayIso = new Date().toISOString().slice(0, 10);
            const { data: sessions } = await window.FocusSupabase
                .from('group_sessions')
                .select('id, title, session_date, session_time, duration, group_session_attendees(user_id, username)')
                .eq('group_id', groupUuid)
                .gte('session_date', todayIso)
                .order('session_date', { ascending: true })
                .order('session_time', { ascending: true })
                .limit(3);
            if (_sessionStripGroupId !== groupUuid) return; // bu arada kanal değişti

            const now = Date.now();
            const next = (sessions || []).find(sess => {
                if (!sess.session_time) return sess.session_date >= todayIso;
                const end = new Date(`${sess.session_date}T${sess.session_time}`).getTime() + (sess.duration || 60) * 60000;
                return end > now;
            });

            document.getElementById('dc-session-strip')?.remove();
            if (!next) return;

            const attendees = next.group_session_attendees || [];
            const iAmIn = attendees.some(a => a.user_id === currentUser.id);
            const start = next.session_time ? new Date(`${next.session_date}T${next.session_time}`) : null;
            const isToday = next.session_date === todayIso;
            const whenTxt = (isToday ? 'Bugün' : new Date(next.session_date + 'T00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }))
                + (start ? ' ' + start.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '');
            const liveNow = start && now >= start.getTime() && now < start.getTime() + (next.duration || 60) * 60000;

            const strip = document.createElement('div');
            strip.id = 'dc-session-strip';
            strip.className = liveNow ? 'is-live' : '';
            strip.innerHTML = `
                <i class="fa-solid ${liveNow ? 'fa-circle-dot dc-ss-live-icon' : 'fa-calendar-day'}"></i>
                <div class="dc-ss-info">
                    <span class="dc-ss-title">${liveNow ? '🔴 ŞU AN: ' : ''}${_escapeHtml(next.title)}</span>
                    <span class="dc-ss-meta">${whenTxt} · ${next.duration || 60} dk · ${attendees.length} kişi varım dedi</span>
                </div>
                <button class="dc-ss-attend-btn${iAmIn ? ' is-in' : ''}">
                    ${iAmIn ? '<i class="fa-solid fa-check"></i> Varsın' : '<i class="fa-solid fa-hand"></i> Varım'}
                </button>`;

            const header = document.getElementById('dc-chat-header');
            const area = document.getElementById('dc-chat-area');
            if (header && area && header.parentNode === area) header.insertAdjacentElement('afterend', strip);

            strip.querySelector('.dc-ss-attend-btn').addEventListener('click', async () => {
                if (iAmIn) {
                    const { data, error } = await window.FocusSupabase.from('group_session_attendees')
                        .delete().eq('session_id', next.id).eq('user_id', currentUser.id).select();
                    if (error || !data || data.length === 0) {
                        console.error('[Seans şeridi] katılım kaldırılamadı', error);
                        dcShowToast('Katılım kaldırılamadı, tekrar dene.', 'error');
                        return;
                    }
                } else {
                    const { data, error } = await window.FocusSupabase.from('group_session_attendees')
                        .upsert({ session_id: next.id, user_id: currentUser.id, username: currentUser.username }).select();
                    if (error || !data || data.length === 0) {
                        console.error('[Seans şeridi] katılım kaydedilemedi', error);
                        dcShowToast('Katılım kaydedilemedi, tekrar dene.', 'error');
                        return;
                    }
                    dcShowToast('Seansa yazıldın — görüşürüz! ⚡', 'success');
                }
                // Bu şerit gscSessionsCache'ten bağımsız kendi fetch'ini kullanıyor — Takvim
                // sekmesiyle senkron kalması için oradaki cache'i de tazele (Faz 5: cache/render
                // artık social-group-details.js'te, window.__getGscSessionsCacheRef/window.gscRenderCalendar köprüsü).
                const _gscCacheForStrip = typeof window.__getGscSessionsCacheRef === 'function' ? window.__getGscSessionsCacheRef() : null;
                if (_gscCacheForStrip && _gscCacheForStrip[next.id]) {
                    const cached = _gscCacheForStrip[next.id];
                    cached.attendees = { ...(cached.attendees || {}) };
                    if (iAmIn) delete cached.attendees[currentUser.username];
                    else cached.attendees[currentUser.username] = {
                        userId: currentUser.id,
                        displayName: currentUser.displayName || currentUser.username,
                        avatarColor: currentUser.avatarColor || '6c5ce7',
                        customAvatar: currentUser.customAvatar || null,
                        checkedInAt: null
                    };
                    if (typeof window.gscRenderCalendar === 'function') window.gscRenderCalendar();
                }
                dcRenderSessionStrip(groupUuid);
            });
        } catch (e) { console.warn('[Seans şeridi] yüklenemedi', e); }
    }

    // ─── TEK PANEL: GRUP PANELİ GÖRÜNÜMÜ ────────────────────────
    // Grubun istatistik/seans/duyuru panelini (eski Gruplar sekmesi içeriği)
    // chat alanındaki group-panel görünümünde açar. groupCode verilmezse
    // aktif guild ya da cache'teki ilk grup kullanılır.
    function dcOpenGroupPanel(groupCode) {
        // Sayfa yenileme restorasyonu bekliyorsa OTOMATİK çağrılar görünümü ele
        // geçiremez — kullanıcının kaldığı sohbet birazdan geri açılacak.
        // Gerçek bir kullanıcı tıklamasından geliyorsa (isTrusted) izin verilir.
        const _fromUserClick = typeof window.event !== 'undefined' && window.event && window.event.isTrusted && window.event.type === 'click';
        if (window._dcRestorePending && !_fromUserClick && !window._dcRestoreInvoking) {
            console.warn('[FocusAI] dcOpenGroupPanel: sohbet restorasyonu beklenirken otomatik çağrı yoksayıldı.', new Error().stack);
            return;
        }
        const cache = (typeof window.getMyGroupsDataCache === 'function') ? window.getMyGroupsDataCache() : {};
        const code = groupCode || dcActiveGroupCode || Object.keys(cache)[0] || null;
        if (!code || !cache[code]) {
            // Cache henüz dolmadıysa (ilk açılış) grup listesi yüklensin, bir kez tekrar dene
            if (!dcOpenGroupPanel._retried) {
                dcOpenGroupPanel._retried = true;
                setTimeout(() => { dcOpenGroupPanel(groupCode); dcOpenGroupPanel._retried = false; }, 900);
                return;
            }
            dcSetMainView('home');
            if (!code) dcShowToast('Henüz bir grubun yok — önce bir gruba katıl.', 'info');
            return;
        }
        if (typeof window.resetActiveGroupPanel === 'function') window.resetActiveGroupPanel();
        if (typeof window.showGroupDetails === 'function') window.showGroupDetails(code, cache[code]);
        window._setArenaChipCurrent(code); // çip barında aktif grubu işaretle
        dcSetMainView('group-panel');
    }
    window.dcOpenGroupPanel = dcOpenGroupPanel;
    // "Ödevlerim" rozeti/popoveri ve ders planı bildirimleri için: grup panelini açıp
    // doğrudan Sınıf/Ekip Paneli sekmesine, onun içinde de Ödevler/Ders Planı alt
    // sekmesine düşürür. _pendingClassroomSubtab TEK BAŞINA yeterli değil — sadece
    // Sınıf Paneli sekmesi zaten açıldıktan SONRA hangi alt sekmenin aktif olacağını
    // belirler; ana "group-detail-tabs" varsayılan olarak "Genel Bakış" ile açılır,
    // bu yüzden ayrıca classroom sekme butonuna programatik tıklamak gerekiyor.
    // showGroupDetails senkron olarak hemen render olmayabilir (grup cache'i henüz
    // dolmamışsa dcOpenGroupPanel içeride 900ms sonra tekrar dener) — bu yüzden
    // kısa aralıklarla birkaç kez deneniyor.
    window.dcOpenAssignmentTab = function(groupCode, innerTab) {
        window._pendingClassroomSubtab = 'odevler';
        window._pendingAsgInnerTab = innerTab === 'planlar' ? 'planlar' : null;
        dcOpenGroupPanel(groupCode);
        const clickClassroomTab = (attempt) => {
            const btn = document.querySelector('.group-detail-tab-btn[data-gtab="classroom"]');
            if (btn) { btn.click(); return; }
            if (attempt < 4) setTimeout(() => clickClassroomTab(attempt + 1), 400);
        };
        setTimeout(() => clickClassroomTab(0), 50);
    };

    document.getElementById('dc-guild-panel-nav')?.addEventListener('click', () => {
        dcOpenGroupPanel(dcActiveGroupCode);
    });

    // ─── TEK PANEL: SOSYAL BÖLÜM AÇILIŞ HOOK'U ──────────────────
    // Ana menüden Sosyal'e her girişte sidebar verileri tazelenir.
    // (Eski sekme sistemindeki sync çağrılarının yerini alır.)
    document.querySelectorAll('.nav-links li[data-target="arkadaslar"], .di[data-target="arkadaslar"]').forEach(el => {
        el.addEventListener('click', () => {
            setTimeout(() => {
                const sidebar = document.getElementById('premium-social-sidebar');
                if (sidebar) sidebar.classList.remove('hidden-sidebar');
                if (typeof window.syncSidebarGroupList === 'function') window.syncSidebarGroupList();
                if (typeof window.syncDcContactList === 'function') window.syncDcContactList();
                if (typeof window.updateSbProfile === 'function') window.updateSbProfile();
                if (typeof window.loadUserGroupsForDc === 'function') window.loadUserGroupsForDc();
                if (typeof window.renderRecentConversations === 'function') window.renderRecentConversations();
                if (typeof window.renderLeaderboardFromCache === 'function') window.renderLeaderboardFromCache();
                if (typeof window.renderHomeSummary === 'function') window.renderHomeSummary();
            }, 60);
        });
    });

    window.showGuildPanel = showGuildPanel; // social-server-tree.js için
    function showGuildPanel(groupCode, groupName) {
        const home  = document.getElementById('dc-home-panel');
        const guild = document.getElementById('dc-guild-panel');
        if (home)  home.style.display  = 'none';
        if (guild) guild.style.display = 'flex';
        const nameEl = document.getElementById('dc-guild-name');
        if (nameEl) nameEl.textContent = groupName;
        dcActiveGroupCode = groupCode;
        window._dcState.groupCode = groupCode;
        window.loadDcChannels(groupCode);
        window.loadDcMembers(groupCode);
    }

    // ─── ARENA GRUP ÇİPLERİ + "+ EKLE" MENÜSÜ → social-arena-chips.js
    // dosyasına taşındı (Faz E, 2026-07-23). renderArenaGroupChips/
    // _updateArenaChipActive window.X olarak erişilebilir,
    // window._setArenaChipCurrent ile aktif çip senkron tutulur.

    // ─── PREMIUM'A YÜKSELT (Madde 7-8, 2026-07-03) ──────────────────
    // Eskiden Arena'da kilitli bir sohbet kartıydı (madde 7 ile kaldırıldı);
    // aynı mesaj artık profil menüsündeki (#v2-user-avatar → #profile-dropdown,
    // script.js) "Premium'a Yükselt" butonuna taşındı. Buton yalnızca ücretsiz
    // planda görünür (script.js updateProfileHeader() dcChatEnabled()'a bakar);
    // tıklanınca ödeme entegrasyonu (Faz 3b) gelene kadar bilgilendirme
    // modalı gösterir.
    document.getElementById('pdm-upgrade-btn')?.addEventListener('click', () => {
        const dropdown = document.getElementById('profile-dropdown');
        if (dropdown) dropdown.style.display = 'none';
        if (typeof window.showFocusaiConfirm === 'function') {
            window.showFocusaiConfirm({
                title: 'Premium Yakında ⭐',
                desc: 'Premium plan: sohbet bölümü (özel mesajlar + grup kanalları), mesajlarda arama, 5 grup ve 30 üye kapasitesi. Ödeme sistemi hazırlanıyor — planlar şimdilik tanıtım aşamasında.',
                type: 'info',
                icon: 'fa-star',
                confirmText: 'Anladım',
                cancelText: 'Kapat'
            });
        } else {
            window.dcShowToast('Premium yakında: sohbet + genişletilmiş grup kapasiteleri.', 'info');
        }
    });


    // SUNUCU AĞACI / KANAL NAVİGASYONU → social-server-tree.js dosyasına taşındı (Faz 6)

    // ÜYE LİSTESİ / ODA PRESENCE ŞERİTLERİ → social-room-presence.js dosyasına taşındı (Faz 6)

    // "Odadasın" göstergesi dock'taki Sosyal ikonu üzerinde gösterilir —
    // ikon yeşile döner, üzerine gelince mini popup ile oda adı + ayrılma
    // butonu açılır.
    function _syncGlobalRoomBar(roomName) {
        const icon = document.getElementById('dock-sosyal-icon');
        const nameEl = document.getElementById('dc-dock-room-name');
        if (!icon) return;
        if (nameEl) nameEl.textContent = roomName || '';
        icon.classList.add('in-room');
    }
    window._hideGlobalRoomBar = _hideGlobalRoomBar; // social-room-presence.js için
    function _hideGlobalRoomBar() {
        document.getElementById('dock-sosyal-icon')?.classList.remove('in-room');
        document.getElementById('dc-dock-room-popup')?.classList.add('hidden');
    }
    document.getElementById('dc-dock-leave-room-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof window._leaveCurrentWorkRoom === 'function') window._leaveCurrentWorkRoom();
    });

    // Dock ikonu overflow:auto olan .dock içinde olduğundan CSS-only hover ile
    // popup'ı absolute konumlandırmak kırpılıyordu — popup body seviyesinde
    // fixed olarak tutulup JS ile ikonun konumuna göre yerleştiriliyor.
    (function _setupDockRoomPopup() {
        const icon = document.getElementById('dock-sosyal-icon');
        const popup = document.getElementById('dc-dock-room-popup');
        if (!icon || !popup) return;
        let hideTimer = null;
        function positionPopup() {
            const r = icon.getBoundingClientRect();
            popup.style.left = (r.right + 10) + 'px';
            popup.style.top = (r.top + r.height / 2) + 'px';
            popup.style.transform = 'translateY(-50%)';
        }
        function show() {
            if (!icon.classList.contains('in-room')) return;
            clearTimeout(hideTimer);
            positionPopup();
            popup.classList.remove('hidden');
        }
        function scheduleHide() {
            clearTimeout(hideTimer);
            hideTimer = setTimeout(() => popup.classList.add('hidden'), 150);
        }
        icon.addEventListener('mouseenter', show);
        icon.addEventListener('mouseleave', scheduleHide);
        popup.addEventListener('mouseenter', () => clearTimeout(hideTimer));
        popup.addEventListener('mouseleave', scheduleHide);
    })();

    // ─── ALT ODA BIRAKMA ÇUBUĞU + BUTON ANİMASYONU ──────
    window.showRoomLeaveBar = showRoomLeaveBar; // social-server-tree.js için
    function showRoomLeaveBar(roomName, database, groupCode, channelId, subId) {
        const bar    = document.getElementById('dc-room-leave-bar');
        const nameEl = document.getElementById('dc-room-leave-name');
        const btn    = document.getElementById('dc-leave-room-btn');
        const actionBtns = document.getElementById('dc-room-action-btns');
        if (!bar || !btn) return;

        if (nameEl) nameEl.textContent = roomName;
        bar.style.display = 'block'; // CSS animasyonu .dc-leave-bar üzerinden çalışır
        _syncFocusReturnMiniBtn();
        _syncGlobalRoomBar(roomName);

        // Yıldırım + ateş butonlarını animasyonla göster
        if (actionBtns) {
            actionBtns.classList.add('visible');
        }

        if (_dcLeaveBtnAC) _dcLeaveBtnAC.abort();
        _dcLeaveBtnAC = new AbortController();
        btn.addEventListener('click', () => {
            window._leaveCurrentWorkRoom();
            // Hâlâ bu odadaysak sohbeti kilitleyip önizlemeye düşür
            if (window._dcState && window._dcState.roomId === subId && window._dcState.groupCode === groupCode) {
                showDcRoomPreview(groupCode, roomName, subId, channelId);
            }
        }, { signal: _dcLeaveBtnAC.signal });
    }

    // ─── ÇALIŞMA ODASI ÖNİZLEMESİ (girmeden okuma/yazma yok) ─
    window.showDcRoomPreview = showDcRoomPreview; // social-server-tree.js için
    function showDcRoomPreview(groupCode, roomName, roomId, channelId, isLockedByRole) {
        const database = getDB(); // Firebase kaldırıldı — null; UI-only işlemler için devam et

        dcActiveRoomId = roomId;
        window._dcState.groupCode = groupCode;
        window._dcState.roomId    = roomId;
        window._dcState.chanId    = channelId || null;

        const titleEl    = document.getElementById('live-chat-target-title');
        const subtitleEl = document.getElementById('live-chat-target-desc');
        if (titleEl)    titleEl.textContent    = '# ' + roomName;
        if (subtitleEl) subtitleEl.textContent = isLockedByRole ? 'Bu oda kilitli — giriş izni yok' : 'Sohbeti görmek için odaya çift tıklayarak gir';

        const emptyEl  = document.getElementById('dc-chat-empty-state');
        const streamEl = document.getElementById('sidebar-chat-messages-stream');
        const headerEl = document.getElementById('dc-chat-header');
        const inputBar = document.querySelector('.dc-chat-input-bar');

        if (emptyEl)  emptyEl.style.display  = 'none';
        if (headerEl) headerEl.style.display = 'flex';
        if (inputBar) inputBar.style.display = 'none';
        if (streamEl) {
            streamEl.style.display = 'flex';
            streamEl.innerHTML = isLockedByRole ? `
                <div style="margin:auto; text-align:center; color:rgba(255,118,117,0.6); font-size:13px; padding:30px;">
                    <i class="fa-solid fa-lock" style="font-size:30px; color:rgba(255,118,117,0.35); margin-bottom:12px; display:block;"></i>
                    <b># ${roomName}</b> çalışma odası kilitli.<br>Bu odaya girmek için yetkili biri tarafından kilidin açılması gerekiyor.
                </div>
            ` : `
                <div style="margin:auto; text-align:center; color:rgba(255,255,255,0.35); font-size:13px; padding:30px;">
                    <i class="fa-solid fa-lock" style="font-size:30px; color:rgba(255,255,255,0.12); margin-bottom:12px; display:block;"></i>
                    <b># ${roomName}</b> çalışma odasının sohbetini görmek ve mesaj yazabilmek için<br>odaya <b>çift tıklayarak</b> girmen gerekiyor.
                </div>
            `;
        }
    }

    // ─── SOHBET ODASINI AÇ (channelId opsiyonel) ────────
    window.openDcChatRoom = (...args) => openDcChatRoom(...args);

    // M2c: Bildirim panelindeki grup @bahsetme bildirimine tıklanınca ilgili
    // kanala/alt-kanala gider (scopeType/scopeId, mention bildirim payload'unda saklanır).
    window.openGroupMentionNotif = (groupCode, scopeType, scopeId, displayLabel) => {
        const supaGroup = window.FocusSupabase && currentUser?.id ? window.getMyGroupsDataCache()[groupCode] : null;
        if (supaGroup?._supaId && scopeType && scopeId) {
            openDcGroupChannelSupabase(groupCode, supaGroup, { type: scopeType, id: scopeId }, displayLabel || '# genel');
        }
    };

    function openDcChatRoom(groupCode, roomName, roomId, channelId) {
        const user = getUser();
        if (!user) return;
        // Savunma katmanı: sohbet yetkisi yoksa grup kanalı hiç yüklenmez
        if (!dcChatEnabled()) { dcSetMainView('home'); return; }

        // ── Supabase-öncelikli yönlendirme ──────────────────────────────────
        // getDB() her zaman null döndürür (Firebase kaldırıldı).
        // Supabase grubuysa openDcGroupChannelSupabase'e devret.
        const supaGroup = (window.FocusSupabase && currentUser?.id)
            ? (typeof window.getMyGroupsDataCache === 'function' ? window.getMyGroupsDataCache()[groupCode] : null)
            : null;
        if (supaGroup?._supaId) {
            // "genel" / "general" → grup scope
            if (!channelId && (roomId === 'general' || roomId === 'genel')) {
                openDcGroupChannelSupabase(groupCode, supaGroup, { type: 'group', id: supaGroup._supaId }, '# genel');
                return;
            }
            // channelId varsa → kategori kanalı scope (eski sistem)
            if (channelId) {
                const isGenSub = (roomId === 'genel' || roomId === 'ch-general');
                const scopeType = isGenSub ? 'group_channel' : 'group_subchannel';
                openDcGroupChannelSupabase(groupCode, supaGroup, { type: scopeType, id: channelId }, '# ' + roomName);
                return;
            }
            // roomId bir Supabase UUID ise → alt-kanal scope
            if (/^[0-9a-f]{8}-/.test(roomId)) {
                openDcGroupChannelSupabase(groupCode, supaGroup, { type: 'group_subchannel', id: roomId }, '# ' + roomName);
                return;
            }
            // Fallback: grup scope
            openDcGroupChannelSupabase(groupCode, supaGroup, { type: 'group', id: supaGroup._supaId }, '# ' + (roomName || 'genel'));
            return;
        }

        // ── Firebase fallback (artık kullanılmıyor — Supabase group cache henüz dolmadıysa) ─
        const database = getDB();
        if (!database) {
            // Cache henüz dolmamış, Supabase'den async yükle sonra tekrar dene
            if (window.FocusSupabase && currentUser?.id && typeof window.getMyGroupsDataCache === 'function') {
                (async () => {
                    const { data: rows } = await window.FocusSupabase
                        .from('group_members')
                        .select('group_id, groups(*)')
                        .eq('user_id', currentUser.id);
                    for (const row of (rows || [])) {
                        const gr = row.groups;
                        if (!gr || gr.code !== groupCode) continue;
                        const { data: memberRows } = await window.FocusSupabase
                            .from('group_members')
                            .select('user_id, role, class_section_id, joined_at, profiles(id, username, display_name, avatar_color, custom_avatar, avatar_initials)')
                            .eq('group_id', gr.id);
                        const gd = await window._normalizeSupabaseGroup(gr, memberRows || []);
                        window.getMyGroupsDataCache()[groupCode] = gd;
                        openDcChatRoom(groupCode, roomName, roomId, channelId); // retry
                        return;
                    }
                })();
            }
            return;
        }
    }

    // ─── GRUP SOHBETİ (SUPABASE — genel/kategori/alt-kanal — M2b-3 Bölüm 1+2) ──────────
    // scope: { type: 'group'|'group_channel'|'group_subchannel', id: <uuid>, locked?: boolean }
    window.openDcGroupChannelSupabase = openDcGroupChannelSupabase; // social-server-tree.js için
    async function openDcGroupChannelSupabase(groupCode, groupData, scope, displayLabel) {
        const user = getUser();
        if (!user) return;
        // Savunma katmanı: UI kapısını atlayan herhangi bir çağrı yolu (bildirim
        // tıklaması, eski kod, konsol) sohbet odası yükleyemez — Arena'ya düşer.
        if (!dcChatEnabled()) { dcSetMainView('home'); return; }
        _dcLastOpenArgs = { fn: 'group', args: [groupCode, groupData, scope, displayLabel] };
        _dcPersistLastOpen({ fn: 'group', code: groupCode, scope: { type: scope.type, id: scope.id, locked: !!scope.locked, isAnnouncement: !!scope.isAnnouncement }, label: displayLabel });
        dcSetMainView('chat');
        dcRenderSessionStrip(groupData?._supaId || null);

        // Oda değişti — önceki yanıt/seçim durumunu sıfırla
        cancelDcReply();
        window.clearDcSelection();
        document.getElementById('analytics-modal')?.classList.remove('dc-panel-open');
        if (typeof window.closeDcChatSearch === 'function') window.closeDcChatSearch();
        _dcMsgRegistry = {};
        _dcOldestKey = null;
        _dcLoadingMore = false;

        const inputBar = document.querySelector('.dc-chat-input-bar');
        if (inputBar) inputBar.style.display = '';

        dcActiveRoomId = scope.id;
        const _actionBtns = document.getElementById('dc-room-action-btns');
        if (_actionBtns && window._dcEnteredRoomId !== scope.id) {
            _actionBtns.classList.remove('visible');
        }
        window._dcState.groupCode = groupCode;
        window._dcState.roomId    = scope.id;
        window._dcState.chanId    = null;
        window._activeChatTarget  = { type: 'group', code: groupCode, roomId: scope.id, channelId: null };

        // Roller/izinler M2b-4'e kadar Supabase grup sohbetinde uygulanmıyor
        _dcCurrentRole = _isSupabaseGroupAdmin(groupCode) ? 'admin' : 'member';

        const titleEl    = document.getElementById('live-chat-target-title');
        const subtitleEl = document.getElementById('live-chat-target-desc');
        if (titleEl)    titleEl.textContent    = displayLabel;
        _dcSubtitleDefault = groupCode + ' grubunun kanalı';
        if (subtitleEl) subtitleEl.textContent = _dcSubtitleDefault;

        const emptyEl  = document.getElementById('dc-chat-empty-state');
        const streamEl = document.getElementById('sidebar-chat-messages-stream');
        const headerEl = document.getElementById('dc-chat-header');
        if (emptyEl)  emptyEl.style.display  = 'none';
        if (streamEl) streamEl.style.display = 'flex';
        if (headerEl) headerEl.style.display = 'flex';
        const msgInputEl = document.getElementById('sidebar-chat-message-input');
        const msgSendBtn = document.getElementById('sidebar-chat-send-msg-btn');

        const headerDot = document.getElementById('dc-header-status-dot');
        if (headerDot) headerDot.style.display = 'none';

        const manageBtn = document.getElementById('live-chat-manage-btn');
        if (manageBtn) manageBtn.style.display = '';
        const focusInviteBtn = document.getElementById('dc-chat-focus-invite-btn');
        if (focusInviteBtn) focusInviteBtn.style.display = '';

        const _blockedBanner = document.getElementById('dc-blocked-banner');
        if (_blockedBanner) _blockedBanner.remove();

        if (typeof window.initDcChatTheme === 'function') window.initDcChatTheme();
        window.initDcEmojiPicker();
        setupDcScrollButton(streamEl);
        showDcSkeleton(streamEl);

        teardownDcSupabaseDmChannels();
        if (_dcRoomPresenceRef) { _dcRoomPresenceRef.off(); _dcRoomPresenceRef = null; }
        window.__setDcCurrentRoomPresence([]);

        const groupId = groupData._supaId;
        _dcCurrentGroupId = groupId;
        _dcCurrentGroupScope = scope;
        window._dcCurrentGroupId = groupId;
        window._dcCurrentGroupScope = scope;
        const groupPath = `supabase_group_${scope.type}_${scope.id}`;
        _dcCurrentMsgPath = groupPath;
        _dcOldestKey = null;
        _dcOldestCreatedAt = null;
        _dcCurrentJoinedAt = 0;
        delete _dcRenderedKeys[groupPath];

        // Kilitli alt-kanal: yönetim yetkisi olmayanlar için sohbet kapalı —
        // mesajları gösterme, fetch/realtime/gönder kurma (Firebase tarafındaki
        // "kilitli oda" placeholder'ıyla aynı görsel davranış). Adminler ve bu oda
        // için "lockRooms" izin istisnası verilmiş roller kilidi görmezden gelir.
        if (scope.type === 'group_subchannel' && scope.locked) {
            const perms = await new Promise(r => getMemberPermissionsSupabase(groupId, user.id, r, { subId: scope.id }));
            if (perms.role !== 'admin' && !perms.lockRooms) {
                if (msgInputEl) msgInputEl.disabled = true;
                if (msgSendBtn) msgSendBtn.disabled = true;
                if (streamEl) {
                    streamEl.innerHTML = `
                        <div style="margin:auto; text-align:center; color:rgba(255,118,117,0.6); font-size:13px; padding:30px;">
                            <i class="fa-solid fa-lock" style="font-size:30px; color:rgba(255,118,117,0.35); margin-bottom:12px; display:block;"></i>
                            <b>${_escapeHtml(displayLabel)}</b> odası kilitli.<br>Bu odaya girmek için yetkili biri tarafından kilidin açılması gerekiyor.
                        </div>`;
                }
                return;
            }
        }

        if (msgInputEl) msgInputEl.disabled = false;
        if (msgSendBtn) msgSendBtn.disabled = false;

        // Duyuru kanalı ise mesaj alanını kilitle
        currentChannelIsAnnouncement = !!(scope.isAnnouncement);
        window._focusCurrentGroupRole = _dcCurrentRole;
        if (typeof updateChatInputStatus === 'function') updateChatInputStatus();

        const renderGroupSnapshot = async (rows) => {
            if (!streamEl || _dcCurrentGroupScope !== scope) return;
            const isFirstLoad = !_dcRenderedKeys[groupPath];
            const wasAtBottom = isFirstLoad ? true : dcIsNearBottom(streamEl);
            streamEl.innerHTML = '';
            if (!rows.length) {
                streamEl.innerHTML = `<div class="dc-empty-channel-placeholder" style="text-align:center; color:rgba(255,255,255,0.2); font-size:13px; padding:30px;">${_escapeHtml(displayLabel)} kanalına hoş geldin! İlk mesajı sen gönder.</div>`;
                _dcRenderedKeys[groupPath] = new Set();
                _dcOldestKey = null;
                _dcOldestCreatedAt = null;
                return;
            }
            const clearedAt = window.dcGetClearedAt(groupPath);
            const deletedForMe = window.dcGetDeletedForMe(groupPath);
            const prevKeys = _dcRenderedKeys[groupPath];
            const newKeys = new Set();
            const _cacheEntry = { meta: { type: 'group', groupCode, roomName: displayLabel.replace(/^#\s*/, ''), roomId: scope.id, channelId: null, displayName: displayLabel }, msgs: {} };
            const reactionsMap = await window._fetchDcReactionsMap(scope.type, scope.id);
            if (_dcCurrentGroupScope !== scope) return;
            for (const row of rows) {
                const m = await window._normalizeSupabaseGroupMessage(row);
                if (_dcCurrentGroupScope !== scope) return;
                m.reactions = reactionsMap[row.id] || {};
                _cacheEntry.msgs[row.id] = m;
                if (m.timestamp && m.timestamp <= clearedAt) continue;
                if (deletedForMe.has(row.id)) continue;
                newKeys.add(row.id);
                const isNew = !isFirstLoad && prevKeys && !prevKeys.has(row.id);
                renderDcMessage(streamEl, m, user.username, row.id, { animate: isNew });
            }
            window._dcGlobalMsgCache[groupPath] = _cacheEntry;
            _dcRenderedKeys[groupPath] = newKeys;
            _dcOldestKey = rows[0].id;
            _dcOldestCreatedAt = rows[0].created_at;
            if (rows.length >= 60) ensureDcLoadMoreBtn(streamEl);
            window.dcRebuildDateSeparators(streamEl);
            dcHandleScrollAfterRender(streamEl, groupPath, rows.length, wasAtBottom, isFirstLoad);
            // Oda açıkken "Son Mesajlaşmalar"daki okunmamış rozetini temizle
            if (typeof window.markGroupRead === 'function') window.markGroupRead(groupPath);
        };

        const fetchAndRenderGroup = () => {
            window.FocusSupabase
                .from('messages')
                .select('*')
                .eq('scope_type', scope.type)
                .eq('scope_id', scope.id)
                .order('created_at', { ascending: false })
                .limit(60)
                .then(({ data, error }) => {
                    if (error) { console.error('[Grup Sohbeti] mesaj yükleme hatası', error); return; }
                    renderGroupSnapshot((data || []).slice().reverse());
                });
        };

        fetchAndRenderGroup();
        window.setupGroupPinnedSupabase(scope);
        window.setupDcGroupTypingSupabase(scope);
        window.setupDcGroupReadReceiptSupabase(scope);

        _dcSupabaseMsgChannel = window.FocusSupabase
            .channel(`group-chat-${scope.type}-${scope.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `scope_id=eq.${scope.id}` }, async payload => {
                if (_dcCurrentGroupScope !== scope) return;
                if (payload.eventType === 'DELETE') {
                    delete _dcMsgRegistry[payload.old.id];
                    fetchAndRenderGroup();
                    return;
                }
                if (payload.eventType === 'UPDATE') {
                    fetchAndRenderGroup();
                    return;
                }
                // INSERT — yeni mesajı DOM'a sadece ekle
                if (payload.eventType === 'INSERT' && payload.new) {
                    if (payload.new.scope_type !== scope.type) return;
                    if (_dcMsgRegistry && _dcMsgRegistry[payload.new.id]) return;
                    const m = await window._normalizeSupabaseGroupMessage(payload.new);
                    if (_dcCurrentGroupScope !== scope) return;
                    const wasAtBottom = streamEl.scrollHeight - streamEl.scrollTop - streamEl.clientHeight < 120;
                    const emptyPlaceholder = streamEl.querySelector('.dc-empty-channel-placeholder');
                    if (emptyPlaceholder) emptyPlaceholder.remove();
                    renderDcMessage(streamEl, m, user.username, payload.new.id, { animate: true });
                    window.dcRebuildDateSeparators(streamEl);
                    if (wasAtBottom) streamEl.scrollTop = streamEl.scrollHeight;
                    if (window._dcGlobalMsgCache?.[groupPath]) {
                        window._dcGlobalMsgCache[groupPath].msgs[payload.new.id] = m;
                    }
                }
            })
            .subscribe();

        if (_dcReactionsChannel) { window.FocusSupabase.removeChannel(_dcReactionsChannel); _dcReactionsChannel = null; }
        _dcReactionsChannel = window.FocusSupabase
            .channel(`group-reactions-${scope.type}-${scope.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions', filter: `scope_id=eq.${scope.id}` }, () => {
                if (_dcCurrentGroupScope !== scope) return;
                fetchAndRenderGroup();
            })
            .subscribe();

        // Mesaj gönder — AbortController ile önceki listener'ları temizle
        const input   = document.getElementById('sidebar-chat-message-input');
        const sendBtn = document.getElementById('sidebar-chat-send-msg-btn');
        if (_dcInputAbortController) _dcInputAbortController.abort();
        _dcInputAbortController = new AbortController();
        const { signal: _inputSignal } = _dcInputAbortController;

        // Dosya yükleme butonu — grup sohbeti input bar'ına ekle
        let _pendingAttachment = null;
        const _inputBar = input.closest('.dc-chat-input-bar') || input.parentElement;
        if (_inputBar && window.FocusChat?.initFileUploadBtn) {
            window.FocusChat.initFileUploadBtn(_inputBar, async (file) => {
                if (!_dcCurrentGroupScope) return;
                const att = await window.FocusChat.uploadChatFile(file, _dcCurrentGroupScope.type, _dcCurrentGroupScope.id);
                if (!att) return;
                _pendingAttachment = att;
                // Önizleme çubuğu göster
                let previewBar = _inputBar.querySelector('.dc-file-preview-bar');
                if (!previewBar) {
                    previewBar = document.createElement('div');
                    previewBar.className = 'dc-file-preview-bar';
                    _inputBar.insertBefore(previewBar, _inputBar.firstChild);
                }
                previewBar.innerHTML = `
                    <i class="fa-solid fa-paperclip" style="color:#a29bfe;flex-shrink:0;"></i>
                    <span class="dc-file-preview-name">${_escapeHtml(att.name)}</span>
                    <button class="dc-file-preview-remove" title="İptal"><i class="fa-solid fa-xmark"></i></button>
                `;
                previewBar.querySelector('.dc-file-preview-remove').addEventListener('click', () => {
                    _pendingAttachment = null;
                    previewBar.remove();
                });
            });
        }

        function sendGroupMessageSupabase() {
            const text = input.value.trim();
            if (!text && !_pendingAttachment) return;
            if (!window.canSendDcMessage()) return;
            // Güncel scope'u her zaman global state'den oku (closure stale olabilir)
            const _scope = _dcCurrentGroupScope || scope;
            const _user  = currentUser;
            if (!window.FocusSupabase || !_user?.id || !_dcCurrentGroupId || !_scope) {
                console.warn('[Grup Sohbeti] sendGroupMessageSupabase: eksik state', { scope: _scope, user: _user?.id, groupId: _dcCurrentGroupId });
                return;
            }
            if (!_throttleAction(`group_send_${_scope.type}_${_scope.id}`, 500)) {
                dcShowToast('Çok hızlı mesaj gönderiyorsunuz, biraz yavaşlayın.');
                return;
            }

            const payload = {
                scope_type: _scope.type,
                scope_id:   _scope.id,
                sender_id:  _user.id,
                text:       text || null,
                reply_to:   _dcReplyTo ? _dcReplyTo.msgKey : null,
                attachments: _pendingAttachment ? [_pendingAttachment] : null
            };

            // Eki temizle
            if (_pendingAttachment) {
                _pendingAttachment = null;
                _inputBar?.querySelector('.dc-file-preview-bar')?.remove();
            }

            // Metinli mesajlarda sunucu cevabı beklenmeden hemen göster (iyimser UI);
            // ek-dosya (metinsiz) gönderimlerde önizleme zaten input bar'da gösterildiği için atlanır.
            const pending = text ? _dcCreatePendingBubble(streamEl, text) : null;

            const insertMessage = () => window.FocusSupabase.from('messages').insert(payload).then(({ error }) => {
                if (error) {
                    console.error('[Grup Sohbeti] mesaj gönderme hatası', error);
                    if (_isRateLimitError(error)) {
                        if (pending) _dcRemovePendingBubble(pending);
                        dcShowToast('Çok hızlı mesaj gönderiyorsun — birkaç saniye bekle ⏳', 'error');
                        return;
                    }
                    if (pending) _dcMarkPendingBubbleFailed(pending, insertMessage);
                    return;
                }
                if (pending) _dcRemovePendingBubble(pending);
            });

            const mentions = window.parseDcMentions(text).filter(u => u !== _user.username);
            if (mentions.length) {
                Promise.all(mentions.map(u => window._resolveProfileId(u))).then(ids => {
                    const validIds = ids.filter(Boolean);
                    payload.mentions = validIds;
                    insertMessage();
                    const roomName = displayLabel.replace(/^#\s*/, '');
                    validIds.forEach(uid => {
                        window.FocusSupabase.from('notifications').insert({
                            user_id: uid,
                            type: 'mention',
                            payload: {
                                fromUser: _user.username,
                                fromName: _user.displayName,
                                fromColor: _user.avatarColor || '6c5ce7',
                                groupCode,
                                scopeType: payload.scope_type,
                                scopeId: payload.scope_id,
                                roomName,
                                text: text.length > 60 ? text.slice(0, 60) + '…' : text
                            }
                        }).then(({ error }) => { if (error) console.warn('[Grup Sohbeti] mention bildirimi yazılamadı', error.message); });
                    });
                });
            } else {
                insertMessage();
            }

            cancelDcReply();
            window.clearDcTypingNow();
            input.value = '';
            _dcAutoResizeTextarea(input);
            window.clearDcDraft();
        }

        sendBtn.addEventListener('click', sendGroupMessageSupabase, { signal: _inputSignal });
        input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendGroupMessageSupabase(); } }, { signal: _inputSignal });
        window.setupDcMentionAutocomplete(input);
        window.restoreDcDraft(input);
        _dcAutoResizeTextarea(input);
        input.addEventListener('input', notifyDcTyping, { signal: _inputSignal });
        input.addEventListener('input', () => window.saveDcDraft(input), { signal: _inputSignal });
        input.addEventListener('input', () => _dcAutoResizeTextarea(input), { signal: _inputSignal });
    }

    // ─── BAĞLANTI DURUMU BANDI & RECONNECT GAP-FILL ─────────────
    // İnternet kopunca üstte bant gösterir; bağlantı gelince açık sohbeti
    // yeniden açarak (realtime kanalları tazelenir) kaçan mesajları doldurur.
    let _dcLastOpenArgs = null; // { fn: 'dm'|'group', args: [...] }
    window._dcGetLastOpenArgs = () => _dcLastOpenArgs; // social-conn-status.js için

    // ─── SON AÇIK SOHBETİ HATIRLA (sayfa yenileme restorasyonu) ──
    // Sayfa yenilenince kullanıcı DM/kanal/çalışma odası sohbetinden atılıp
    // varsayılan görünüme düşüyordu. Açık sohbetin kimliğini localStorage'da
    // tutup, yükleme sonrası (login + grup cache hazır olunca) geri açıyoruz.
    const DC_LAST_OPEN_KEY = 'focusai_dc_last_open';
    function _dcPersistLastOpen(info) {
        try { localStorage.setItem(DC_LAST_OPEN_KEY, JSON.stringify(info)); } catch (_) { console.warn('[FocusAI] sessiz hata:', _); }
    }
    // showGroupDetails/renderClassroomTab (grup paneli sekme/alt-sekme kaydı)
    // ayrı bir üst-seviye IIFE'de tanımlı (bu closure'ın dışında) — window'a
    // asılmazsa oradan yapılan _dcPersistLastOpen çağrıları sessizce hiçbir şey
    // yapmadan (ReferenceError typeof ile yutulup) no-op olur.
    window._dcPersistLastOpen = _dcPersistLastOpen;
    function _dcClearLastOpen() {
        try { localStorage.removeItem(DC_LAST_OPEN_KEY); } catch (_) { console.warn('[FocusAI] sessiz hata:', _); }
    }
    window._dcClearLastOpen = _dcClearLastOpen;

    // "Çalışma odası" (group_subchannel, çift tıkla girilen presence odası)
    // girişini ayrıca hatırlar — sohbet restore'u geri açtıktan sonra presence'ı
    // da geri kurup "Odadasın" çubuğunu göstermek için kullanılır. Yalnızca
    // sohbeti tekrar açmak (tek tık önizleme) bu odaya "girilmiş" saymaz.
    const DC_ENTERED_ROOM_KEY = 'focusai_dc_entered_room';
    window._dcPersistEnteredRoom = _dcPersistEnteredRoom; // social-server-tree.js için
    function _dcPersistEnteredRoom(info) {
        try { localStorage.setItem(DC_ENTERED_ROOM_KEY, JSON.stringify(info)); } catch (_) { console.warn('[FocusAI] sessiz hata:', _); }
    }
    function _dcClearEnteredRoom() {
        try { localStorage.removeItem(DC_ENTERED_ROOM_KEY); } catch (_) { console.warn('[FocusAI] sessiz hata:', _); }
    }
    window._dcClearEnteredRoom = _dcClearEnteredRoom;

    // Çalışma odası presence'ını (ve global "Odadasın" çubuğunu) sayfa
    // yenilenince HER ZAMAN geri kurar — sohbet paneli restore'unun aksine
    // (bkz. _dcRestoreLastOpenOnLoad) hangi sekmede yenilendiğine bakmaz,
    // çünkü artık gösterge sosyal bölümün dışında da (global çubuk) görünüyor.
    (function _dcRestoreEnteredRoomOnLoad() {
        let entered = null;
        try { entered = JSON.parse(localStorage.getItem(DC_ENTERED_ROOM_KEY) || 'null'); } catch (_) { console.warn('[FocusAI] sessiz hata:', _); }
        if (!entered || !entered.subId || !entered.groupCode) return;

        let attempts = 0;
        const timer = setInterval(() => {
            attempts++;
            if (attempts > 100) { clearInterval(timer); return; } // ~30 sn sonra vazgeç
            if (typeof currentUser === 'undefined' || !currentUser) return;
            if (typeof dcChatEnabled === 'function' && !dcChatEnabled()) { clearInterval(timer); return; }
            if (window._dcEnteredRoomKey) { clearInterval(timer); return; } // sohbet restore'u zaten kurdu
            clearInterval(timer);
            try {
                if (typeof startRoomPresenceSupabase === 'function') startRoomPresenceSupabase(entered.groupCode, entered.subId);
                if (typeof showRoomLeaveBar === 'function') showRoomLeaveBar(entered.roomName || '', getDB(), entered.groupCode, 'sub', entered.subId);
                window._dcEnteredRoomId  = entered.subId;
                window._dcEnteredRoomKey = `${entered.groupCode}|sub|${entered.subId}`;
            } catch (e) { console.warn('[FocusAI] çalışma odası presence geri kurulamadı', e); }
        }, 300);
    })();

    (function _dcRestoreLastOpenOnLoad() {
        let saved = null;
        try { saved = JSON.parse(localStorage.getItem(DC_LAST_OPEN_KEY) || 'null'); } catch (_) { console.warn('[FocusAI] sessiz hata:', _); }
        if (!saved || !saved.fn) return;
        // Yalnızca sosyal bölümde yenilendiyse geri aç — başka sekmede
        // arka planda sohbet kurmanın anlamı yok.
        try {
            const lastTab = (typeof FocusStorage !== 'undefined') ? FocusStorage.get('lastActiveTab', 'bugun') : 'bugun';
            if (lastTab !== 'arkadaslar') return;
        } catch (_) { return; }

        // Restorasyon tamamlanana kadar otomatik görünüm değişikliklerini
        // (ör. dcOpenGroupPanel) engelle — "önce grup paneli, sonra sohbet"
        // zıplaması yaşanmasın.
        window._dcRestorePending = true;
        // Restore tamamlandıktan sonra da kilidi bir süre tut: initDcArchitecture
        // (DOMContentLoaded+1200ms) gibi geç çalışan açılış kodları geri yüklenen
        // sohbeti ezmesin. 5 sn sonra normal davranışa dönülür.
        const finish = (opened) => {
            setTimeout(() => { window._dcRestorePending = false; }, 5000);
            // Restore sohbet açmadan bittiyse geçici iskelet görünümünden
            // normal varsayılan görünüme (Arena/home) geri dön.
            if (!opened && !window._activeChatTarget) {
                const emptyEl = document.getElementById('dc-chat-empty-state');
                if (emptyEl) emptyEl.style.display = 'flex';
                if (typeof dcSetMainView === 'function') dcSetMainView('home', { force: true });
            }
        };

        // Görsel zıplamayı önle: sohbet geri yüklenene kadar varsayılan açılış
        // görünümü (Arena/grup içerikleri) yerine sohbet alanında yükleme
        // iskeleti göster — restore bitince kaldığı yerden devam etmiş görünür.
        const _showRestoreSkeleton = () => {
            const area = document.getElementById('dc-chat-area');
            if (area) area.classList.remove('dc-view-home', 'dc-view-group-panel');
            const emptyEl  = document.getElementById('dc-chat-empty-state');
            const streamEl = document.getElementById('sidebar-chat-messages-stream');
            const headerEl = document.getElementById('dc-chat-header');
            if (headerEl) headerEl.style.display = 'none'; // "Kanal" placeholder başlığı görünmesin
            if (emptyEl) emptyEl.style.display = 'none';
            if (streamEl) {
                streamEl.style.display = 'flex';
                if (typeof showDcSkeleton === 'function') { try { showDcSkeleton(streamEl); } catch (_) { console.warn('[FocusAI] sessiz hata:', _); } }
            }
        };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => { if (window._dcRestorePending) _showRestoreSkeleton(); });
        } else {
            _showRestoreSkeleton();
        }

        let attempts = 0;
        const timer = setInterval(() => {
            attempts++;
            if (attempts > 100) { clearInterval(timer); finish(false); return; } // ~20 sn sonra vazgeç
            if (typeof currentUser === 'undefined' || !currentUser) return;
            if (typeof dcChatEnabled === 'function' && !dcChatEnabled()) { clearInterval(timer); finish(false); return; }
            // Kullanıcı bu arada kendisi bir sohbet açtıysa karışma
            if (window._activeChatTarget) { clearInterval(timer); finish(true); return; }
            // Kullanıcı bu arada "Gruplarım"dan bir gruba tıklayıp Genel Bakış panelini
            // açtıysa da karışma — aksi halde restore, kullanıcı zaten bir grubun Genel
            // Bakış'ını açmışken üstüne son kalınan #genel sohbetini zorla açıyordu.
            if (document.getElementById('dc-chat-area')?.classList.contains('dc-view-group-panel')) {
                clearInterval(timer); finish(true); return;
            }

            if (saved.fn === 'dm') {
                clearInterval(timer);
                try { openDcDmRoom(saved.username, saved.name || saved.username); finish(true); }
                catch (e) { console.warn('[FocusAI] son DM geri açılamadı', e); finish(false); }
                return;
            }
            if (saved.fn === 'group') {
                const cache = (typeof window.getMyGroupsDataCache === 'function') ? window.getMyGroupsDataCache() : {};
                const gd = cache[saved.code];
                if (!gd) return; // grup cache'i dolana kadar bekle
                clearInterval(timer);
                try {
                    openDcGroupChannelSupabase(saved.code, gd, saved.scope, saved.label || '# genel');
                    _dcRestoreEnteredRoomIfNeeded(saved);
                    finish(true);
                }
                catch (e) { console.warn('[FocusAI] son grup sohbeti geri açılamadı', e); finish(false); }
                return;
            }
            // Kullanıcı yenileme öncesi bir grubun panelinde (Genel Bakış / Sınıf
            // Paneli / Takvim / Geçmiş vb.) idiyse, sohbet yerine doğrudan aynı
            // grup panelini + aynı sekmeyi geri aç (bkz. showGroupDetails'teki
            // _persistGroupPanelTab ve renderClassroomTab'teki alt sekme kaydı).
            if (saved.fn === 'group-panel') {
                const cache = (typeof window.getMyGroupsDataCache === 'function') ? window.getMyGroupsDataCache() : {};
                if (!cache[saved.code]) return; // grup cache'i dolana kadar bekle
                clearInterval(timer);
                try {
                    if (saved.gtab === 'classroom') window._pendingClassroomSubtab = saved.subtab || null;
                    // showGroupDetails artık _pendingGroupPanelGtab'ı okuyup paneli EN
                    // BAŞTAN doğru sekmeyle (Genel Bakış'a hiç uğramadan, programatik
                    // tıklama beklemeden) render ediyor — bu yüzden görünür bir sekme
                    // geçişi/titreme (flash) hiç oluşmuyor, ayrı bir "sekmeyi bul ve
                    // tıkla" bekleme döngüsüne de gerek kalmıyor.
                    window._pendingGroupPanelGtab = saved.gtab || null;
                    // Kilidi (_dcRestorePending) BIRAKMADAN paneli aç — kilit erken
                    // bırakılınca geç çalışan açılış kodları (initDcArchitecture,
                    // switchTab'ın Arena varsayılanı) restore edilen paneli ezip
                    // kullanıcıyı Arena'ya fırlatabiliyordu. dcOpenGroupPanel'in
                    // "otomatik çağrı" koruması bu meşru çağrı için bayrakla atlanır.
                    window._dcRestoreInvoking = true;
                    try { dcOpenGroupPanel(saved.code); } finally { window._dcRestoreInvoking = false; }
                    finish(true);
                }
                catch (e) { console.warn('[FocusAI] son grup paneli geri açılamadı', e); finish(false); }
            }
        }, 200);
    })();

    // Sayfa yenilenmeden önce bir "çalışma odası"na (group_subchannel, çift
    // tıkla girilen presence odası) girilmişse, sohbeti restore ettikten sonra
    // presence'ı da geri kurup "Odadasın" çubuğunu tekrar gösterir — aksi
    // halde yenileme kullanıcıyı sessizce odadan çıkarmış gibi davranıyordu.
    function _dcRestoreEnteredRoomIfNeeded(saved) {
        let entered = null;
        try { entered = JSON.parse(localStorage.getItem(DC_ENTERED_ROOM_KEY) || 'null'); } catch (_) { console.warn('[FocusAI] sessiz hata:', _); }
        if (!entered || !entered.subId) return;
        if (entered.groupCode !== saved.code || entered.subId !== saved.scope?.id) return;
        const roomKey = `${entered.groupCode}|sub|${entered.subId}`;
        if (typeof startRoomPresenceSupabase === 'function') startRoomPresenceSupabase(entered.groupCode, entered.subId);
        if (typeof showRoomLeaveBar === 'function') showRoomLeaveBar(entered.roomName || '', getDB(), entered.groupCode, 'sub', entered.subId);
        window._dcEnteredRoomId  = entered.subId;
        window._dcEnteredRoomKey = roomKey;
    }

    // ─── BAĞLANTI DURUMU BANNER'I + RECONNECT GAP-FILL → social-conn-status.js
    // dosyasına taşındı (Faz E, 2026-07-23). Tamamen izole, dışarıdan
    // çağrılmıyor (sadece online/offline event listener'ları).

    // ─── DM ODASINI AÇ ──────────────────────────────────
    window.openDcDmRoom = (...args) => openDcDmRoom(...args);
    async function openDcDmRoom(targetUsername, targetName) {
        const user = getUser();
        if (!user) { console.warn('[DM] getUser() null, DM açılamıyor'); return; }
        // Savunma katmanı: sohbet yetkisi yoksa DM odası hiç yüklenmez
        if (!dcChatEnabled()) {
            dcSetMainView('home');
            if (typeof window.dcShowToast === 'function') window.dcShowToast('Sohbet Premium planda — Sosyal herkese açık ⚡', 'info');
            return;
        }
        _dcLastOpenArgs = { fn: 'dm', args: [targetUsername, targetName] };
        _dcPersistLastOpen({ fn: 'dm', username: targetUsername, name: targetName });
        dcSetMainView('chat');
        dcHideSessionStrip();

        // Oda değişti — önceki yanıt/seçim durumunu sıfırla
        cancelDcReply();
        window.clearDcSelection();
        document.getElementById('analytics-modal')?.classList.remove('dc-panel-open');
        if (typeof window.closeDcChatSearch === 'function') window.closeDcChatSearch();
        _dcMsgRegistry = {};
        _dcOldestKey = null;
        _dcLoadingMore = false;

        // DM path: iki kullanıcının sıralı adlarından oluşan oda
        const dmId = [user.username, targetUsername].sort().join('_');
        const dmPath = `focusai_community/direct_messages/${dmId}`;
        window._activeChatTarget = { type: 'dm', username: targetUsername };
        _dcCurrentRole = 'member'; // DM'lerde moderasyon yetkisi yok

        const titleEl    = document.getElementById('live-chat-target-title');
        const subtitleEl = document.getElementById('live-chat-target-desc');
        if (titleEl)    titleEl.textContent    = '@' + targetName;
        _dcSubtitleDefault = 'Özel mesaj';
        if (subtitleEl) subtitleEl.textContent = _dcSubtitleDefault;
        if (subtitleEl) subtitleEl.textContent = _dcSubtitleDefault;

        // Kanal ikonunu @ yap
        const chanIcon = document.querySelector('.dc-channel-icon i');
        if (chanIcon) { chanIcon.className = 'fa-solid fa-at'; }

        const emptyEl  = document.getElementById('dc-chat-empty-state');
        const streamEl = document.getElementById('sidebar-chat-messages-stream');
        const headerEl = document.getElementById('dc-chat-header');
        if (emptyEl)  emptyEl.style.display  = 'none';
        if (streamEl) streamEl.style.display = 'flex';
        if (headerEl) headerEl.style.display = 'flex';
        // Bir kişi seçildi — yazma kutusunu aç
        const msgInputEl = document.getElementById('sidebar-chat-message-input');
        const msgSendBtn = document.getElementById('sidebar-chat-send-msg-btn');
        if (msgInputEl) msgInputEl.disabled = false;
        if (msgSendBtn) msgSendBtn.disabled = false;

        // DM hedefinin çevrimiçi durumunu başlıkta göster
        const headerDot = document.getElementById('dc-header-status-dot');
        if (headerDot) {
            headerDot.style.display = '';
            headerDot.dataset.onlineUser = targetUsername;
            headerDot.classList.remove('online', 'offline');
            headerDot.classList.add('offline');
            window.subscribeDcOnlineStatus(targetUsername);
        }

        // Özel mesajlarda grup yönetimi butonuna gerek yok
        const manageBtn = document.getElementById('live-chat-manage-btn');
        if (manageBtn) manageBtn.style.display = 'none';
        const focusInviteBtn = document.getElementById('dc-chat-focus-invite-btn');
        if (focusInviteBtn) focusInviteBtn.style.display = '';

        // Engelleme durumuna göre giriş kutusunu güncelle
        if (typeof window.updateDcBlockedBanner === 'function') window.updateDcBlockedBanner(targetUsername);

        if (typeof window.initDcChatTheme === 'function') window.initDcChatTheme();
        window.initDcEmojiPicker();
        setupDcScrollButton(streamEl);
        showDcSkeleton(streamEl);

        if (_dcRoomPresenceRef) { _dcRoomPresenceRef.off(); _dcRoomPresenceRef = null; }
        window.__setDcCurrentRoomPresence([]);

        _dcCurrentMsgPath = dmPath;
        _dcOpenLastRead = window.getDmLastRead ? window.getDmLastRead(targetUsername) : 0;
        // Sohbet açıldı — okunmamış rozetlerini hangi yoldan açılırsa açılsın temizle
        // (_dcOpenLastRead yukarıda alındı, okunmamış ayıracı bundan etkilenmez)
        if (typeof window.markDmRead === 'function') window.markDmRead(targetUsername);
        setupDcJumpUnreadBtn(streamEl);
        window.teardownDcGroupReadReceipt();
        delete _dcRenderedKeys[dmPath];

        // ── SUPABASE: conversation bul/oluştur + son 60 mesajı yükle + realtime ──
        if (window.FocusSupabase) teardownDcSupabaseDmChannels();
        _dcOldestKey = null;
        _dcOldestCreatedAt = null;

        if (window.FocusSupabase && currentUser?.id) {
            // Sabitlenmiş mesajlar/okundu/yazıyor durumu artık Supabase üzerinden
            // (conversation çözüldükten sonra) kurulacak — eski Firebase dinleyicilerini temizle
            window.teardownDcPinned();
            window.teardownDcReadReceipt();
            window.teardownDcTyping();
        } else {
            // Supabase oturumu yok — eski Firebase tabanlı yol
            window.setupDcPinned(dmPath);
            window.setupDcTyping(`focusai_community/typing_status/${dmId}`, user.username);
            window.setupDcReadReceipt(dmId, user.username, targetUsername);
        }

        const renderDmSnapshot = async (rows) => {
            if (!streamEl) return;
            const isFirstLoad = !_dcRenderedKeys[dmPath];
            const wasAtBottom = isFirstLoad ? true : dcIsNearBottom(streamEl);
            streamEl.innerHTML = '';
            if (!rows.length) {
                streamEl.innerHTML = `<div style="text-align:center; color:rgba(255,255,255,0.2); font-size:13px; padding:30px;">${_escapeHtml(targetName)} ile konuşmana başla!</div>`;
                _dcRenderedKeys[dmPath] = new Set();
                _dcOldestKey = null;
                _dcOldestCreatedAt = null;
                return;
            }
            const lastRead = _dcOpenLastRead;
            const clearedAt = window.dcGetClearedAt(dmPath);
            const deletedForMe = window.dcGetDeletedForMe(dmPath);
            const prevKeys = _dcRenderedKeys[dmPath];
            const newKeys = new Set();
            let dividerInserted = false;
            let visible = 0;
            const _cacheEntry = { meta: { type: 'dm', username: targetUsername, displayName: targetName }, msgs: {} };
            const reactionsMap = _dcCurrentConversation ? await window._fetchDcReactionsMap('dm', _dcCurrentConversation.id) : {};
            if (window._activeChatTarget?.type !== 'dm' || window._activeChatTarget?.username !== targetUsername) return;
            rows.forEach(row => {
                const m = window._normalizeSupabaseDmMessage(row, _dcCurrentOtherProfile);
                m.reactions = reactionsMap[row.id] || {};
                _cacheEntry.msgs[row.id] = m;
                if (m.timestamp && m.timestamp <= clearedAt) return;
                if (deletedForMe.has(row.id)) return;
                visible++;
                newKeys.add(row.id);
                if (!dividerInserted && m.username !== user.username && m.timestamp > lastRead) {
                    insertDcUnreadDivider(streamEl);
                    dividerInserted = true;
                }
                const isNew = !isFirstLoad && prevKeys && !prevKeys.has(row.id);
                renderDcMessage(streamEl, m, user.username, row.id, { animate: isNew });
            });
            window._dcGlobalMsgCache[dmPath] = _cacheEntry;
            _dcRenderedKeys[dmPath] = newKeys;
            if (visible === 0) {
                streamEl.innerHTML = `<div style="text-align:center; color:rgba(255,255,255,0.2); font-size:13px; padding:30px;">Sohbet temizlendi.</div>`;
            }
            _dcOldestKey = rows[0].id;
            _dcOldestCreatedAt = rows[0].created_at;
            if (rows.length >= 60) ensureDcLoadMoreBtn(streamEl);
            window.dcRebuildDateSeparators(streamEl);
            if (dividerInserted) {
                const divider = streamEl.querySelector('.dc-unread-divider');
                if (divider) divider.scrollIntoView({ block: 'center' });
                _dcRoomMsgCounts[dmPath] = rows.length;
                const btn = document.getElementById('dc-scroll-bottom-btn');
                if (btn) btn.style.display = 'none';
            } else {
                dcHandleScrollAfterRender(streamEl, dmPath, rows.length, wasAtBottom, isFirstLoad);
            }
            setupDcJumpUnreadBtn(streamEl);
            window.updateDcReadReceipts();
        };

        const fetchAndRenderDm = (conversationId) => {
            window.FocusSupabase
                .from('messages')
                .select('*')
                .eq('scope_type', 'dm')
                .eq('scope_id', conversationId)
                .order('created_at', { ascending: false })
                .limit(60)
                .then(({ data, error }) => {
                    if (error) { console.error('[DM] mesaj yükleme hatası', error); return; }
                    renderDmSnapshot((data || []).slice().reverse());
                });
        };

        if (window.FocusSupabase && currentUser?.id) {
            window._resolveOrCreateConversation(targetUsername).then(async conversation => {
                if (!conversation) return;
                // Oda kapatılmadan/değiştirilmeden cevap geldiyse devam et
                if (window._activeChatTarget?.type !== 'dm' || window._activeChatTarget?.username !== targetUsername) return;

                _dcCurrentConversation = conversation;
                _dcCurrentOtherProfile = await window._resolveProfileByUsername(targetUsername);
                fetchAndRenderDm(conversation.id);
                window.setupDmReadReceiptSupabase(conversation, _dcCurrentOtherProfile);
                window.setupDmTypingSupabase(conversation);
                window.setupDmPinnedSupabase(conversation);

                _dcSupabaseMsgChannel = window.FocusSupabase
                    .channel(`dm-messages-${conversation.id}`)
                    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `scope_id=eq.${conversation.id}` }, payload => {
                        if (window._activeChatTarget?.type !== 'dm' || window._activeChatTarget?.username !== targetUsername) return;
                        if (payload.eventType === 'DELETE') {
                            delete _dcMsgRegistry[payload.old.id];
                            fetchAndRenderDm(conversation.id);
                            return;
                        }
                        if (payload.eventType === 'UPDATE') {
                            // Düzenleme/güncelleme — sadece o satırı yeniden çiz
                            fetchAndRenderDm(conversation.id);
                            return;
                        }
                        // INSERT — yeni mesajı DOM'a sadece ekle, tüm listeyi yeniden çizme
                        if (payload.eventType === 'INSERT' && payload.new) {
                            const row = payload.new;
                            // Zaten render edilmişse atla (kendi gönderimiz optimistic eklenmemiş, ama duplicate önle)
                            if (_dcMsgRegistry && _dcMsgRegistry[row.id]) return;
                            const m = window._normalizeSupabaseDmMessage(row, _dcCurrentOtherProfile);
                            const wasAtBottom = streamEl.scrollHeight - streamEl.scrollTop - streamEl.clientHeight < 120;
                            renderDcMessage(streamEl, m, user.username, row.id, { animate: true });
                            window.dcRebuildDateSeparators(streamEl);
                            if (wasAtBottom) streamEl.scrollTop = streamEl.scrollHeight;
                            // Global cache güncelle
                            if (window._dcGlobalMsgCache?.[dmPath]) {
                                window._dcGlobalMsgCache[dmPath].msgs[row.id] = m;
                            }
                        }
                        // Artık fetchAndRenderDm çağrılmıyor (INSERT için)
                        // Sohbet açıkken karşıdan yeni mesaj geldiyse "okundu" zaman damgasını
                        // güncelle — yoksa last_read_at sohbeti AÇTIĞIMIZ andaki değerde
                        // donup kalır ve karşı taraf hep tek tik (gönderildi) görür.
                        if (payload.eventType === 'INSERT' && payload.new?.sender_id !== currentUser.id) {
                            window.FocusSupabase.from('message_reads')
                                .upsert({ conversation_id: conversation.id, user_id: currentUser.id, last_read_at: new Date().toISOString() })
                                .then(({ error }) => { if (error) console.error('[DM] okundu bilgisi güncellenemedi', error); });
                            // Yerel okunmamış rozetleri de temizle — yoksa sohbet açıkken
                            // gelen mesajlar hep "okunmamış" görünmeye devam eder.
                            // Mesajın sunucu zamanı taban olarak geçilir (saat farkına dayanıklı).
                            if (typeof window.markDmRead === 'function') {
                                window.markDmRead(targetUsername, payload.new.created_at ? new Date(payload.new.created_at).getTime() : 0);
                            }
                        }
                    })
                    .subscribe((status) => {
                        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                            // Kanal kopunca mesajları yeniden çek
                            setTimeout(() => {
                                if (window._activeChatTarget?.type === 'dm' && window._activeChatTarget?.username === targetUsername) {
                                    fetchAndRenderDm(conversation.id);
                                }
                            }, 3000);
                        }
                    });

                _dcReactionsChannel = window.FocusSupabase
                    .channel(`dm-reactions-${conversation.id}`)
                    .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions', filter: `scope_id=eq.${conversation.id}` }, () => {
                        if (window._activeChatTarget?.type !== 'dm' || window._activeChatTarget?.username !== targetUsername) return;
                        fetchAndRenderDm(conversation.id);
                    })
                    .subscribe();
            });
        }

        // Mesaj gönder — AbortController ile önceki listener'ları temizle
        const input   = document.getElementById('sidebar-chat-message-input');
        const sendBtn = document.getElementById('sidebar-chat-send-msg-btn');
        if (_dcInputAbortController) _dcInputAbortController.abort();
        _dcInputAbortController = new AbortController();
        const { signal: _inputSignal } = _dcInputAbortController;

        function sendDm() {
            const text = input.value.trim();
            if (!text) return;
            if (!window.canSendDcMessage()) return;
            if (typeof window.isBlockedEitherWay === 'function' && window.isBlockedEitherWay(targetUsername)) {
                dcShowToast('Bu kullanıcıyla iletişim kuramazsınız.');
                return;
            }
            if (!window.FocusSupabase || !currentUser?.id || !_dcCurrentConversation) return;
            if (!_throttleAction(`dm_send_${_dcCurrentConversation.id}`, 500)) {
                dcShowToast('Çok hızlı mesaj gönderiyorsunuz, biraz yavaşlayın.');
                return;
            }
            const conversation = _dcCurrentConversation;
            const replyTo = _dcReplyTo ? _dcReplyTo.msgKey : null;
            // DM'de tek mention hedefi olabilir: karşı taraf (@username)
            const safeTarget = targetUsername.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const mentioned = new RegExp('@' + safeTarget + '\\b', 'i').test(text);

            // Sunucu cevabını beklemeden mesajı hemen göster (iyimser UI)
            const pending = _dcCreatePendingBubble(streamEl, text);

            cancelDcReply();
            window.clearDcTypingNow();
            input.value = '';
            _dcAutoResizeTextarea(input);
            window.clearDcDraft();

            const attemptSend = () => (async () => {
                const payload = {
                    scope_type: 'dm',
                    scope_id:   conversation.id,
                    sender_id:  currentUser.id,
                    reply_to:   replyTo || null,
                    text
                };
                if (mentioned) {
                    const targetId = await window._resolveProfileId(targetUsername);
                    if (targetId) payload.mentions = [targetId];
                }
                window.FocusSupabase.from('messages').insert(payload).then(({ error }) => {
                    if (error) {
                        if (conversation.status === 'pending' && conversation.requested_by === currentUser.id) {
                            window.showDcDmLimitNotice();
                            _dcRemovePendingBubble(pending);
                        } else if (_isRateLimitError(error)) {
                            _dcRemovePendingBubble(pending);
                            dcShowToast('Çok hızlı mesaj gönderiyorsun — birkaç saniye bekle ⏳', 'error');
                        } else {
                            console.error('[DM] mesaj gönderme hatası', error);
                            _dcMarkPendingBubbleFailed(pending, attemptSend);
                        }
                        return;
                    }
                    // Başarılı — gerçek mesaj realtime dinleyiciden gelecek, geçici baloncuğu kaldır
                    _dcRemovePendingBubble(pending);
                    if (mentioned && payload.mentions && payload.mentions.length) {
                        window.FocusSupabase.from('notifications').insert({
                            user_id: payload.mentions[0],
                            type: 'mention',
                            payload: {
                                fromUser: currentUser.username,
                                fromName: currentUser.displayName,
                                fromColor: currentUser.avatarColor || '6c5ce7',
                                conversationId: conversation.id,
                                text: text.length > 60 ? text.slice(0, 60) + '…' : text
                            }
                        }).then(({ error: notifErr }) => { if (notifErr) console.warn('[DM] mention bildirimi yazılamadı', notifErr.message); });
                    }
                });
            })();
            attemptSend();
        }
        sendBtn.addEventListener('click', sendDm, { signal: _inputSignal });
        window.restoreDcDraft(input);
        _dcAutoResizeTextarea(input);
        input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendDm(); } }, { signal: _inputSignal });
        input.addEventListener('input', notifyDcTyping, { signal: _inputSignal });
        input.addEventListener('input', () => window.saveDcDraft(input), { signal: _inputSignal });
        input.addEventListener('input', () => _dcAutoResizeTextarea(input), { signal: _inputSignal });
    }

    // ─── ESKİ MESAJLARI GEÇ YÜKLE ─────────────────────────
    function ensureDcLoadMoreBtn(streamEl) {
        let btn = streamEl.querySelector('#dc-load-more-btn');
        if (!btn) {
            btn = document.createElement('button');
            btn.id = 'dc-load-more-btn';
            btn.className = 'dc-load-more-btn';
            btn.textContent = 'Daha fazla yükle';
            streamEl.insertBefore(btn, streamEl.firstChild);
            btn.addEventListener('click', () => loadOlderDcMessages(streamEl));
        }
        return btn;
    }

    function loadOlderDcMessages(streamEl) {
        if (_dcCurrentGroupId) { loadOlderGroupMessagesSupabase(streamEl); return; }
        if (!_dcOldestKey || _dcLoadingMore || !_dcCurrentMsgPath) return;
        if (_dcCurrentConversation) { loadOlderDmMessagesSupabase(streamEl); return; }
        const database = getDB();
        const user = getUser();
        if (!database || !user) return;

        _dcLoadingMore = true;
        const btn = streamEl.querySelector('#dc-load-more-btn');
        if (btn) btn.textContent = 'Yükleniyor...';

        database.ref(_dcCurrentMsgPath).orderByKey().endBefore(_dcOldestKey).limitToLast(30).once('value').then(snap => {
            _dcLoadingMore = false;
            if (!snap.exists()) {
                if (btn) btn.remove();
                return;
            }
            const prevHeight = streamEl.scrollHeight;
            const frag = document.createDocumentFragment();
            let newOldest = null;
            let count = 0;
            const knownKeys = _dcRenderedKeys[_dcCurrentMsgPath];
            let crossedJoinBoundary = false;
            snap.forEach(msgSnap => {
                if (!newOldest) newOldest = msgSnap.key;
                count++;
                const m = msgSnap.val();
                if (!m) return;
                if (m.username !== user.username && typeof window.isBlockedEitherWay === 'function' && window.isBlockedEitherWay(m.username)) return;
                // Kullanıcının gruba katılma tarihinden ÖNCEKİ mesajlar "Daha fazla yükle"
                // ile de gösterilmesin — bu sınıra ulaşıldıysa daha eski sayfalar da
                // tamamen filtreleneceği için "Daha fazla yükle" butonu kaldırılır.
                if (m.timestamp && _dcCurrentJoinedAt && m.timestamp < _dcCurrentJoinedAt) { crossedJoinBoundary = true; return; }
                if (knownKeys) knownKeys.add(msgSnap.key);
                renderDcMessage(frag, m, user.username, msgSnap.key);
            });
            _dcOldestKey = newOldest;
            streamEl.insertBefore(frag, btn ? btn.nextSibling : streamEl.firstChild);
            window.dcRebuildDateSeparators(streamEl);
            streamEl.scrollTop = streamEl.scrollHeight - prevHeight;
            if ((count < 30 || crossedJoinBoundary) && btn) btn.remove();
            else if (btn) btn.textContent = 'Daha fazla yükle';
        }).catch(() => {
            _dcLoadingMore = false;
            if (btn) btn.textContent = 'Daha fazla yükle';
        });
    }

    // Supabase DM: _dcOldestCreatedAt'ten daha eski 30 mesajı yükler.
    function loadOlderDmMessagesSupabase(streamEl) {
        const user = getUser();
        if (!window.FocusSupabase || !user || !_dcCurrentConversation || !_dcOldestCreatedAt) return;
        const dmPath = _dcCurrentMsgPath;
        const conversationId = _dcCurrentConversation.id;

        _dcLoadingMore = true;
        const btn = streamEl.querySelector('#dc-load-more-btn');
        if (btn) btn.textContent = 'Yükleniyor...';

        window.FocusSupabase
            .from('messages')
            .select('*')
            .eq('scope_type', 'dm')
            .eq('scope_id', conversationId)
            .lt('created_at', _dcOldestCreatedAt)
            .order('created_at', { ascending: false })
            .limit(30)
            .then(({ data, error }) => {
                _dcLoadingMore = false;
                const rows = (data || []).slice().reverse();
                if (error || !rows.length) {
                    if (btn) btn.remove();
                    return;
                }
                const prevHeight = streamEl.scrollHeight;
                const frag = document.createDocumentFragment();
                const knownKeys = _dcRenderedKeys[dmPath];
                const clearedAt = window.dcGetClearedAt(dmPath);
                const deletedForMe = window.dcGetDeletedForMe(dmPath);
                rows.forEach(row => {
                    const m = window._normalizeSupabaseDmMessage(row, _dcCurrentOtherProfile);
                    window._dcGlobalMsgCache[dmPath].msgs[row.id] = m;
                    if (m.timestamp && m.timestamp <= clearedAt) return;
                    if (deletedForMe.has(row.id)) return;
                    if (knownKeys) knownKeys.add(row.id);
                    renderDcMessage(frag, m, user.username, row.id);
                });
                _dcOldestKey = rows[0].id;
                _dcOldestCreatedAt = rows[0].created_at;
                streamEl.insertBefore(frag, btn ? btn.nextSibling : streamEl.firstChild);
                window.dcRebuildDateSeparators(streamEl);
                streamEl.scrollTop = streamEl.scrollHeight - prevHeight;
                if (rows.length < 30 && btn) btn.remove();
                else if (btn) btn.textContent = 'Daha fazla yükle';
            }).catch(() => {
                _dcLoadingMore = false;
                if (btn) btn.textContent = 'Daha fazla yükle';
            });
    }

    // Supabase grup sohbeti: _dcOldestCreatedAt'ten daha eski 30 mesajı yükler.
    function loadOlderGroupMessagesSupabase(streamEl) {
        const user = getUser();
        if (!window.FocusSupabase || !user || !_dcCurrentGroupId || !_dcCurrentGroupScope || !_dcOldestCreatedAt) return;
        const scope = _dcCurrentGroupScope;
        const groupPath = `supabase_group_${scope.type}_${scope.id}`;

        _dcLoadingMore = true;
        const btn = streamEl.querySelector('#dc-load-more-btn');
        if (btn) btn.textContent = 'Yükleniyor...';

        window.FocusSupabase
            .from('messages')
            .select('*')
            .eq('scope_type', scope.type)
            .eq('scope_id', scope.id)
            .lt('created_at', _dcOldestCreatedAt)
            .order('created_at', { ascending: false })
            .limit(30)
            .then(async ({ data, error }) => {
                _dcLoadingMore = false;
                const rows = (data || []).slice().reverse();
                if (error || !rows.length) {
                    if (btn) btn.remove();
                    return;
                }
                if (_dcCurrentGroupScope !== scope) return;
                const prevHeight = streamEl.scrollHeight;
                const frag = document.createDocumentFragment();
                const knownKeys = _dcRenderedKeys[groupPath];
                const clearedAt = window.dcGetClearedAt(groupPath);
                const deletedForMe = window.dcGetDeletedForMe(groupPath);
                for (const row of rows) {
                    const m = await window._normalizeSupabaseGroupMessage(row);
                    if (_dcCurrentGroupScope !== scope) return;
                    if (window._dcGlobalMsgCache[groupPath]) window._dcGlobalMsgCache[groupPath].msgs[row.id] = m;
                    if (m.timestamp && m.timestamp <= clearedAt) continue;
                    if (deletedForMe.has(row.id)) continue;
                    if (knownKeys) knownKeys.add(row.id);
                    renderDcMessage(frag, m, user.username, row.id);
                }
                _dcOldestKey = rows[0].id;
                _dcOldestCreatedAt = rows[0].created_at;
                streamEl.insertBefore(frag, btn ? btn.nextSibling : streamEl.firstChild);
                window.dcRebuildDateSeparators(streamEl);
                streamEl.scrollTop = streamEl.scrollHeight - prevHeight;
                if (rows.length < 30 && btn) btn.remove();
                else if (btn) btn.textContent = 'Daha fazla yükle';
            }).catch(() => {
                _dcLoadingMore = false;
                if (btn) btn.textContent = 'Daha fazla yükle';
            });
    }

    // ─── SCROLL İLE OTOMATİK ESKİ MESAJ YÜKLEME ───────────
    // Kullanıcı akışın en üstüne yaklaşınca "Daha fazla yükle" butonuna basmadan
    // eski mesajlar kendiliğinden gelir (buton yedek olarak durmaya devam eder).
    (function setupDcInfiniteScroll() {
        const streamEl = document.getElementById('sidebar-chat-messages-stream');
        if (!streamEl) return;
        streamEl.addEventListener('scroll', () => {
            if (streamEl.scrollTop < 80 && !_dcLoadingMore && streamEl.querySelector('#dc-load-more-btn')) {
                loadOlderDcMessages(streamEl);
            }
        }, { passive: true });
    })();

    // ─── BAĞLAMLI MESAJA ATLAMA ───────────────────────────
    // Arama sonucundan tıklanan mesaj henüz yüklenmemişse eski sayfaları
    // (en fazla 20 sayfa) yükleyip mesajı bulur, ortalar ve flash ile vurgular.
    window.dcJumpToMessage = async function(msgId) {
        const streamEl = document.getElementById('sidebar-chat-messages-stream');
        if (!streamEl || !msgId) return false;
        const flash = (row) => {
            row.scrollIntoView({ block: 'center', behavior: 'smooth' });
            row.classList.remove('dc-msg-flash');
            void row.offsetWidth;
            row.classList.add('dc-msg-flash');
            setTimeout(() => row.classList.remove('dc-msg-flash'), 1500);
        };
        let row = streamEl.querySelector(`[data-msg-key="${msgId}"]`);
        if (row) { flash(row); return true; }
        for (let i = 0; i < 20; i++) {
            if (!streamEl.querySelector('#dc-load-more-btn')) break;
            loadOlderDcMessages(streamEl);
            // Yükleme bitene kadar bekle (en fazla 4 sn)
            await new Promise(resolve => {
                const t = setInterval(() => { if (!_dcLoadingMore) { clearInterval(t); clearTimeout(g); resolve(); } }, 80);
                const g = setTimeout(() => { clearInterval(t); resolve(); }, 4000);
            });
            row = streamEl.querySelector(`[data-msg-key="${msgId}"]`);
            if (row) { flash(row); return true; }
        }
        return false;
    };

    // ─── "YENİ MESAJLAR" AYIRACI + OKUNMAMIŞA HIZLI ATLAMA BUTONU (2026-07-18) → social-unread-divider.js dosyasına taşındı ──────

    // ─── SABİTLENMİŞ MESAJLAR ───────────────────────────────
    // ─── SABİTLENMİŞ MESAJLAR ───────────────────────────────
    // dcPinnedPathFor / teardownDcPinned / setupDcPinned /
    // teardownDmPinnedSupabase / refreshDmPinned / setupDmPinnedSupabase /
    // teardownGroupPinnedSupabase / refreshGroupPinned /
    // setupGroupPinnedSupabase / toggleDcPinMessage / renderDcPinnedBanner
    // → social-message-pins.js dosyasına taşındı (Faz 2, 2026-07-19).
    // window._dcGetChatContext() üzerinden salt-okunur sohbet bağlamı
    // okuyor, window.* üzerinden çağrılıyor.

    // ─── MESAJ RENDER — ÖZEL KART/SİSTEM MESAJI ALT-FONKSİYONLARI →
    // social-dc-message-cards.js dosyasına taşındı (Faz E, 2026-07-23 —
    // riskli bölge denemesi). _renderDcCwRoomInviteCard/_renderDcSystemJoinCard/
    // _renderDcSystemNotice/_renderDcRoleChangeNotice window.X olarak
    // erişilebilir. renderDcMessage'ın kendisi (dispatcher + normal mesaj
    // render mantığı) HÂLÂ social.js'te, dokunulmadı.

    function renderDcMessage(container, m, myUsername, msgKey, opts) {
        // Özel kart/sistem mesajı türleri — her biri kendi fonksiyonuna taşındı,
        // normal mesaj render mantığından ayrı tutuluyor (bkz. Faz 2 refactor).
        if (m.type === 'cw_room_invite') { window._renderDcCwRoomInviteCard(container, m, msgKey); return; }
        if (m.type === 'system_join_card') { window._renderDcSystemJoinCard(container, m); return; }
        if (m.type === 'system_join' || m.type === 'system_leave' || m.type === 'system') { window._renderDcSystemNotice(container, m); return; }
        if (m.type === 'system_promote' || m.type === 'system_demote') { window._renderDcRoleChangeNotice(container, m); return; }

        // undefined text kontrolü — boş mesajları atla (şifreli mesajların 'enc' alanı vardır)
        if (!m.text && !m.enc) return;
        const isMe = m.username === myUsername;
        const timeStr = m.timestamp
            ? new Date(m.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
            : '';

        // Aynı kişinin, kısa süre içindeki art arda mesajları için compact (gruplu) görünüm
        const lastMsg = container.lastElementChild;
        const lastUser = lastMsg ? lastMsg.dataset.username : null;
        const lastTimestamp = lastMsg ? parseInt(lastMsg.dataset.timestamp || '0', 10) : 0;
        const withinGroupWindow = lastTimestamp && m.timestamp && (m.timestamp - lastTimestamp) < DC_MSG_GROUP_WINDOW_MS;
        const compact  = lastUser === m.username && withinGroupWindow;

        if (msgKey) _dcMsgRegistry[msgKey] = m;
        const isSelected = !!msgKey && _dcSelectedKeys.has(msgKey);

        const row = document.createElement('div');
        row.dataset.username = m.username;
        if (msgKey) row.dataset.msgKey = msgKey;
        row.dataset.timestamp = m.timestamp || '';
        row.className = `dc-dm-msg-row ${isMe ? 'msg-me' : 'msg-other'}${isSelected ? ' dc-msg-selected' : ''}${opts && opts.animate ? ' dc-msg-animate-in' : ''}`;
        row.style.cssText = `
            display:flex; align-items:flex-start; gap:10px;
            padding: ${compact ? '1px 0' : '6px 0 2px'};
            flex-direction: ${isMe ? 'row-reverse' : 'row'};
        `;

        if (!compact) {
            const { url: avUrl, color: avColor } = window.resolveAvatar(m);
            const avWrap = document.createElement('div');
            avWrap.className = 'dc-msg-avatar-wrap';
            avWrap.style.cssText = 'position:relative; flex-shrink:0; margin-top:2px; width:32px; height:32px; cursor:pointer;';
            avWrap.title = 'Profili Gör';
            const avatar = document.createElement('img');
            avatar.src = avUrl;
            avatar.style.cssText = `width:32px; height:32px; border-radius:50%; object-fit:cover; border:2px solid #${avColor}; box-sizing:border-box;`;
            avWrap.appendChild(avatar);
            const statusDot = document.createElement('span');
            statusDot.className = 'dc-dm-status-dot dc-msg-status-dot offline';
            statusDot.dataset.onlineUser = m.username;
            avWrap.appendChild(statusDot);
            avWrap.addEventListener('click', (e) => {
                e.stopPropagation();
                window.openMiniProfile(m.username, { displayName: m.displayName, avatarColor: m.avatarColor, customAvatar: m.customAvatar }, avWrap);
            });
            row.appendChild(avWrap);
            window.subscribeDcOnlineStatus(m.username);
        } else {
            const spacer = document.createElement('div');
            spacer.className = 'dc-msg-spacer';
            spacer.style.cssText = 'width:32px; flex-shrink:0; display:flex; align-items:center; justify-content:center;';
            if (timeStr) {
                const hoverTime = document.createElement('span');
                hoverTime.className = 'dc-msg-compact-time';
                hoverTime.textContent = timeStr;
                spacer.appendChild(hoverTime);
            }
            row.appendChild(spacer);
        }

        const bubble = document.createElement('div');
        bubble.className = 'dc-msg-bubble';
        bubble.style.cssText = `
            position: relative;
            max-width: 68%;
            display: flex; flex-direction: column;
            align-items: ${isMe ? 'flex-end' : 'flex-start'};
        `;

        // Yanıtla / Tepki / Seç / Düzenle / Sil hover butonları
        if (msgKey) {
            const isGroup = window._activeChatTarget && window._activeChatTarget.type === 'group';
            const isDm = window._activeChatTarget && window._activeChatTarget.type === 'dm';
            const isAdminOrMod = isGroup && (_dcCurrentRole === 'admin' || _dcCurrentRole === 'moderator');
            const canModerate = !isMe && isAdminOrMod;
            const canPin = isDm || isAdminOrMod;
            const isPinned = !!_dcPinnedMsgs[msgKey];
            const actions = document.createElement('div');
            actions.className = 'dc-msg-hover-actions';
            actions.innerHTML = `
                <button class="dc-msg-action-btn" data-action="react" title="Tepki ekle"><i class="fa-regular fa-face-smile"></i></button>
                <button class="dc-msg-action-btn" data-action="reply" title="Yanıtla"><i class="fa-solid fa-reply"></i></button>
                <button class="dc-msg-action-btn${isSelected ? ' is-selected' : ''}" data-action="select" title="Seç">
                    <i class="fa-${isSelected ? 'solid fa-circle-check' : 'regular fa-circle'}"></i>
                </button>
                ${canPin ? `
                <button class="dc-msg-action-btn${isPinned ? ' is-selected' : ''}" data-action="pin" title="${isPinned ? 'Sabitlemeyi kaldır' : 'Sabitle'}"><i class="fa-solid fa-thumbtack"></i></button>
                ` : ''}
                ${isMe ? `
                <button class="dc-msg-action-btn" data-action="edit" title="Düzenle"><i class="fa-solid fa-pen"></i></button>
                <button class="dc-msg-action-btn dc-msg-action-danger" data-action="delete" title="Sil"><i class="fa-solid fa-trash-can"></i></button>
                ` : ''}
                ${canModerate ? `
                <button class="dc-msg-action-btn dc-msg-action-danger" data-action="mod-delete" title="Mesajı sil (moderatör)"><i class="fa-solid fa-trash-can"></i></button>
                ` : ''}
            `;
            actions.querySelector('[data-action="react"]').addEventListener('click', (e) => {
                e.stopPropagation();
                openDcMsgReactionPicker(actions.querySelector('[data-action="react"]'), bubble, msgKey, isMe);
            });
            actions.querySelector('[data-action="reply"]').addEventListener('click', (e) => {
                e.stopPropagation();
                initiateDcReply(m.displayName || m.username, m.text || m.decryptedText || '', msgKey);
            });
            actions.querySelector('[data-action="select"]').addEventListener('click', (e) => {
                e.stopPropagation();
                window.toggleDcMsgSelection(msgKey, row);
            });
            const pinBtn = actions.querySelector('[data-action="pin"]');
            if (pinBtn) pinBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                window.toggleDcPinMessage(msgKey, m);
            });
            const editBtn = actions.querySelector('[data-action="edit"]');
            if (editBtn) editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                startDcMsgEdit(msgKey, row, textEl, m);
            });
            const deleteBtn = actions.querySelector('[data-action="delete"]');
            if (deleteBtn) deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteDcMsg(msgKey, row);
            });
            const modDeleteBtn = actions.querySelector('[data-action="mod-delete"]');
            if (modDeleteBtn) modDeleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteDcMsg(msgKey, row, { forceAllowEveryone: true });
            });
            bubble.appendChild(actions);
        }

        if (m.forwardedFrom) {
            const fwdEl = document.createElement('div');
            fwdEl.style.cssText = 'font-size:10px; color: rgba(255,255,255,0.35); display:flex; align-items:center; gap:4px; margin-bottom:2px;';
            fwdEl.innerHTML = `<i class="fa-solid fa-share"></i> İletildi · ${_escapeHtml(m.forwardedFrom)}`;
            bubble.appendChild(fwdEl);
        }

        if (!compact) {
            const meta = document.createElement('div');
            meta.className = 'dc-msg-meta';
            meta.style.cssText = 'display:flex; align-items:baseline; gap:6px; margin-bottom:3px; flex-wrap:wrap;';
            // Rol rozeti: sadece öğretmen ve admin için göster
            const senderRole = isMe ? (currentUser?.institutionRole || 'member') : (m.institutionRole || 'member');
            let roleBadgeHtml = '';
            if (senderRole === 'teacher') {
                roleBadgeHtml = '<span class="dc-role-badge dc-role-teacher" title="Öğretmen"><i class="fa-solid fa-chalkboard-user"></i> Öğretmen</span>';
            } else if (senderRole === 'admin') {
                roleBadgeHtml = '<span class="dc-role-badge dc-role-admin" title="Yönetici"><i class="fa-solid fa-shield-halved"></i> Yönetici</span>';
            }
            meta.innerHTML = `
                <span class="dc-msg-sender-name" style="font-size:12px; font-weight:600; color:${isMe ? 'var(--dc-accent, #a29bfe)' : '#fff'}; cursor:pointer;" title="Profili Gör">${_escapeHtml(m.displayName || m.username)}</span>
                ${roleBadgeHtml}
                <span style="font-size:10px; color:rgba(255,255,255,0.25);">${timeStr}</span>
            `;
            meta.querySelector('.dc-msg-sender-name').addEventListener('click', (e) => {
                e.stopPropagation();
                window.openMiniProfile(m.username, { displayName: m.displayName, avatarColor: m.avatarColor, customAvatar: m.customAvatar }, e.currentTarget);
            });
            bubble.appendChild(meta);
        }

        if (m.replyTo) {
            const rText = m.replyTo.text || m.replyTo.decryptedText || '';
            const replyEl = document.createElement('div');
            replyEl.className = 'chat-reply-quote';
            replyEl.style.cssText = 'background: rgba(108,92,231,0.12); border-left: 3px solid var(--primary-color); padding: 5px 10px; font-size: 11px; color: #a4b0be; border-radius: 6px; margin-bottom: 4px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
            replyEl.innerHTML = `<span style="color:var(--primary-color); font-weight:700;">↩ ${_escapeHtml(m.replyTo.sender)}</span><span style="margin-left:4px; opacity:0.8;">${_escapeHtml(rText.length > 40 ? rText.slice(0, 40) + '…' : rText)}</span>`;
            if (m.replyTo.msgKey) {
                replyEl.style.cursor = 'pointer';
                replyEl.title = 'Orijinal mesaja git';
                replyEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    jumpToDcMsg(m.replyTo.msgKey);
                });
            }
            bubble.appendChild(replyEl);
        }

        const textEl = document.createElement('div');
        textEl.className = 'dc-msg-text';

        const appendEditedTag = () => {
            if (!m.edited) return;
            const editedTag = document.createElement('span');
            editedTag.className = 'dc-msg-edited-tag';
            editedTag.textContent = ' (düzenlendi)';
            editedTag.title = 'Düzenleme geçmişini gör';
            editedTag.style.cursor = 'pointer';
            textEl.appendChild(editedTag);
        };

        if (m.enc) {
            // Şifreli mesaj — çözülene kadar satırı gizle. Çözülemezse (anahtar bu
            // cihazda yok, kurtarılamaz) satır tamamen kaldırılır; boş baloncuk veya
            // uyarı metni gösterilmez.
            row.style.display = 'none';
            const otherUsername = m.username === myUsername
                ? (window._activeChatTarget && window._activeChatTarget.username)
                : m.username;
            const dropRow = () => {
                const parent = row.parentElement;
                row.remove();
                if (parent && parent.classList && parent.classList.contains('dc-messages-stream')) {
                    window.dcRebuildDateSeparators(parent);
                }
            };
            if (otherUsername) {
                window.decryptDmText(otherUsername, m.enc).then(plain => {
                    if (plain !== null) {
                        textEl.innerHTML = _formatMessageText(plain);
                        m.decryptedText = plain;
                        appendEditedTag();
                        row.style.display = 'flex';
                    } else {
                        dropRow();
                    }
                });
            } else {
                dropRow();
            }
        } else {
            textEl.innerHTML = _formatMessageText(m.text);
            if (Array.isArray(m.mentions) && m.mentions.length) {
                let html = textEl.innerHTML;
                m.mentions.forEach(uname => {
                    const safe = uname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const re = new RegExp('@' + safe + '\\b', 'gi');
                    const isMentionedMe = uname === myUsername;
                    html = html.replace(re, `<span class="dc-mention${isMentionedMe ? ' is-me' : ''}">@${_escapeHtml(uname)}</span>`);
                });
                textEl.innerHTML = html;
            }
            appendEditedTag();
        }
        textEl.style.cssText = `
            background: ${isMe ? 'var(--dc-bubble-me-bg, rgba(108,92,231,0.35))' : 'rgba(255,255,255,0.07)'};
            border: 1px solid ${isMe ? 'var(--dc-bubble-me-border, rgba(108,92,231,0.3))' : 'rgba(255,255,255,0.06)'};
            padding: 7px 11px;
            border-radius: ${isMe ? 'var(--dc-bubble-radius-me, 12px 4px 12px 12px)' : 'var(--dc-bubble-radius-other, 4px 12px 12px 12px)'};
            font-size: var(--dc-msg-font-size, 13px);
            font-family: var(--dc-msg-font-family, inherit);
            color: #fff; line-height: 1.5;
            word-break: break-word;
        `;
        // Sadece metin varsa bubble'ı göster, yoksa gizle
        if (!m.text && !m.enc) textEl.style.display = 'none';
        bubble.appendChild(textEl);

        // Dosya ekleri
        if (Array.isArray(m.attachments) && m.attachments.length && window.FocusChat?.renderAttachment) {
            m.attachments.forEach(att => {
                const attEl = window.FocusChat.renderAttachment(att);
                if (attEl) bubble.appendChild(attEl);
            });
        }

        // Anket kartı
        if (m.pollId && window.FocusChat?.renderPollCard) {
            const pollContainer = document.createElement('div');
            bubble.appendChild(pollContainer);
            window.FocusChat.renderPollCard(m.pollId, pollContainer);
        }

        // Tepki (reaksiyon) pilleri
        if (msgKey && m.reactions && Object.keys(m.reactions).length) {
            const reactionsBar = document.createElement('div');
            reactionsBar.className = 'dc-msg-reactions';
            const counts = {};
            Object.entries(m.reactions).forEach(([uname, emoji]) => {
                if (!emoji) return;
                (counts[emoji] = counts[emoji] || []).push(uname);
            });
            Object.entries(counts).forEach(([emoji, users]) => {
                const mine = users.includes(myUsername);
                const pill = document.createElement('button');
                pill.className = `dc-msg-reaction-pill${mine ? ' is-mine' : ''}`;
                pill.innerHTML = `<span>${_escapeHtml(emoji)}</span><span class="dc-msg-reaction-count">${users.length}</span>`;
                pill.title = users.join(', ');
                pill.addEventListener('click', (e) => {
                    e.stopPropagation();
                    toggleDcMsgReaction(msgKey, emoji);
                });
                reactionsBar.appendChild(pill);
            });
            bubble.appendChild(reactionsBar);
        }

        // Okundu bilgisi (sadece kendi mesajlarımızda, DM'de)
        if (isMe && msgKey && window._activeChatTarget && window._activeChatTarget.type === 'dm') {
            const seen = (m.timestamp || 0) <= _dcOtherLastRead;
            const receipt = document.createElement('span');
            receipt.className = `dc-read-receipt ${seen ? 'seen' : 'sent'}`;
            receipt.dataset.msgKey = msgKey;
            receipt.innerHTML = `<i class="fa-solid ${seen ? 'fa-check-double' : 'fa-check'}"></i>`;
            bubble.appendChild(receipt);
        }

        row.appendChild(bubble);

        // Seçim modu aktifken satıra tıklamak da seçimi değiştirsin
        if (msgKey) {
            row.addEventListener('click', () => {
                if (window.__getDcSelectedKeys().size > 0) window.toggleDcMsgSelection(msgKey, row);
            });
        }

        container.appendChild(row);
    }

    // ─── MESAJ DÜZENLE ───────────────────────────────────
    function startDcMsgEdit(msgKey, rowEl, textEl, m) {
        // Supabase-öncelikli: database null olsa bile Supabase yolu çalışır
        if (!_dcCurrentGroupId && !_dcCurrentConversation) return;
        if (rowEl.querySelector('.dc-msg-edit-box')) return; // zaten düzenleniyor

        textEl.style.display = 'none';

        const editBox = document.createElement('div');
        editBox.className = 'dc-msg-edit-box';
        editBox.innerHTML = `
            <textarea class="dc-msg-edit-input">${_escapeHtml(m.text)}</textarea>
            <div class="dc-msg-edit-actions">
                <button class="dc-confirm-btn dc-confirm-cancel" data-action="cancel-edit">Vazgeç</button>
                <button class="dc-confirm-btn dc-confirm-ok" data-action="save-edit">Kaydet</button>
            </div>
        `;
        textEl.insertAdjacentElement('afterend', editBox);

        const textarea = editBox.querySelector('.dc-msg-edit-input');
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
        textarea.addEventListener('input', () => {
            textarea.style.height = 'auto';
            textarea.style.height = textarea.scrollHeight + 'px';
        });

        const finish = () => {
            editBox.remove();
            textEl.style.display = '';
        };

        editBox.querySelector('[data-action="cancel-edit"]').addEventListener('click', (e) => {
            e.stopPropagation();
            finish();
        });
        editBox.querySelector('[data-action="save-edit"]').addEventListener('click', (e) => {
            e.stopPropagation();
            const newText = textarea.value.trim();
            if (!newText) return;
            if (newText !== m.text) {
                if ((_dcCurrentConversation || _dcCurrentGroupId) && window.FocusSupabase) {
                    const targetUsername = window._activeChatTarget?.username;
                    const applyUpdate = (fields) => {
                        window.FocusSupabase.from('messages').update(Object.assign({ edited: true }, fields)).eq('id', msgKey)
                            .then(({ error }) => { if (error) console.error('[DM] mesaj düzenleme hatası', error); });
                    };
                    applyUpdate({ text: newText, enc: null });
                } else {
                    database.ref(`${_dcCurrentMsgPath}/${msgKey}`).update({ text: newText, edited: true });
                }
            }
            finish();
        });
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                editBox.querySelector('[data-action="save-edit"]').click();
            } else if (e.key === 'Escape') {
                finish();
            }
        });
        textarea.addEventListener('click', e => e.stopPropagation());
    }

    // ─── MESAJ SİL ───────────────────────────────────────
    function deleteDcMsg(msgKey, rowEl, opts) {
        // Supabase-öncelikli: database null olsa bile Supabase yolu çalışır
        if (!_dcCurrentGroupId && !_dcCurrentConversation && !_dcCurrentMsgPath) return;
        const database = getDB(); // Firebase fallback (null olabilir — Supabase path aşağıda kontrol edilir)
        const path = _dcCurrentMsgPath;

        const m = _dcMsgRegistry[msgKey];
        const forceAllowEveryone = opts && opts.forceAllowEveryone;
        const allowEveryone = forceAllowEveryone || !m || !m.timestamp || (Date.now() - m.timestamp) < window.DC_DELETE_FOR_EVERYONE_LIMIT_MS;

        window.dcShowDeleteChoice({
            title: 'Mesajı Sil',
            allowEveryone,
            onDeleteForMe: () => {
                _dcSelectedKeys.delete(msgKey);
                if (rowEl) rowEl.style.display = 'none';
                window.dcShowUndoToast('Mesaj silindi.', {
                    onUndo: () => {
                        if (rowEl) rowEl.style.display = '';
                    },
                    onCommit: () => {
                        window.dcAddDeletedForMe(path, [msgKey]);
                        delete _dcMsgRegistry[msgKey];
                        if (rowEl) rowEl.remove();
                    }
                });
            },
            onDeleteForEveryone: () => {
                _dcSelectedKeys.delete(msgKey);
                if (rowEl) rowEl.style.display = 'none';
                window.dcShowUndoToast('Mesaj herkesten silindi.', {
                    onUndo: () => {
                        if (rowEl) rowEl.style.display = '';
                    },
                    onCommit: () => {
                        if (window.FocusSupabase && (_dcCurrentConversation || _dcCurrentGroupId)) {
                            window.FocusSupabase.from('messages').delete().eq('id', msgKey)
                                .then(({ error }) => { if (error) console.error('[Sil] mesaj silme hatası', error); });
                        } else if (database && path) {
                            database.ref(`${path}/${msgKey}`).remove();
                        }
                        delete _dcMsgRegistry[msgKey];
                    }
                });
            }
        });
    }

    // ─── ÇEVRİMİÇİ DURUM NOKTASI + TARİH AYIRICILAR → social-dc-online-status.js
    // dosyasına taşındı (Faz E, 2026-07-23). subscribeDcOnlineStatus/
    // updateDcStatusDots/dcFormatDateSeparator/dcRebuildDateSeparators
    // window.X olarak erişilebilir.

    // ─── MESAJ TEPKİ (REAKSİYON) PICKER ───────────────────
    // Tam emoji seçici — kompozisyon kutusundakiyle aynı emoji grupları kullanılır
    function openDcMsgReactionPicker(triggerBtn, bubbleEl, msgKey, isMe) {
        window.closeReactionPicker();

        const picker = document.createElement('div');
        picker.className = 'activity-reaction-picker dc-msg-reaction-picker dc-emoji-popover dc-msg-reaction-picker-full';
        picker.innerHTML = Object.entries(window.DC_EMOJI_GROUPS).map(([label, emojis]) => `
            <div class="dc-emoji-popover-group-label">${label}</div>
            <div class="dc-emoji-popover-grid">
                ${emojis.map(e => `<button type="button" class="dc-emoji-popover-btn" data-emoji="${e}">${e}</button>`).join('')}
            </div>
        `).join('');
        picker.style[isMe ? 'right' : 'left'] = '0';
        picker.style[isMe ? 'left' : 'right'] = 'auto';

        bubbleEl.appendChild(picker);
        requestAnimationFrame(() => picker.classList.add('is-open'));

        picker.querySelectorAll('.dc-emoji-popover-btn').forEach(emojiBtn => {
            emojiBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleDcMsgReaction(msgKey, emojiBtn.dataset.emoji);
                window.closeReactionPicker();
            });
        });

        window._activeReactionPicker = { picker, outsideHandler: null };
        const outsideHandler = (e) => {
            if (!picker.contains(e.target) && e.target !== triggerBtn) window.closeReactionPicker();
        };
        window._activeReactionPicker.outsideHandler = outsideHandler;
        setTimeout(() => document.addEventListener('click', outsideHandler), 0);
    }

    function toggleDcMsgReaction(msgKey, emoji) {
        const user = getUser();
        if (!user || !msgKey) return;
        // Aynı mesaja hızlı ardışık tepki ver/kaldır spamini engelle
        if (!_throttleAction(`dc_reaction_${msgKey}`, 600)) return;

        // Supabase DM/grup mesajları: message_reactions tablosu
        const scope = _dcCurrentGroupScope || (_dcCurrentConversation ? { type: 'dm', id: _dcCurrentConversation.id } : null);
        if (scope && window.FocusSupabase && currentUser?.id) {
            const existing = (_dcMsgRegistry[msgKey]?.reactions || {})[user.username];
            if (existing === emoji) {
                window.FocusSupabase.from('message_reactions').delete()
                    .eq('message_id', msgKey).eq('user_id', currentUser.id)
                    .then(({ error }) => { if (error) console.error('[Tepki] kaldırma hatası', error); });
            } else {
                window.FocusSupabase.from('message_reactions').upsert({
                    message_id: msgKey,
                    user_id: currentUser.id,
                    scope_type: scope.type,
                    scope_id: scope.id,
                    emoji
                }).then(({ error }) => { if (error) console.error('[Tepki] ekleme hatası', error); });
            }
            return;
        }

        const database = getDB();
        if (!database || !_dcCurrentMsgPath) return;
        const ref = database.ref(`${_dcCurrentMsgPath}/${msgKey}/reactions/${user.username}`);
        ref.once('value').then(snap => {
            if (snap.val() === emoji) ref.remove();
            else ref.set(emoji);
        });
    }

    // ─── EMOJİ PICKER ───────────────────────────────────
    // social-emoji-picker.js dosyasına taşındı (Faz 2, 2026-07-19) — sıfır
    // paylaşılan sohbet-state bağımlılığı olduğu için temiz ayrılabildi.
    // DC_EMOJI_GROUPS ve initDcEmojiPicker artık window.* üzerinden erişiliyor.

    // ─── @BAHSETME OTO-TAMAMLAMA → social-dc-mentions.js dosyasına taşındı
    // (Faz E, 2026-07-23). getDcMentionableNames/setupDcMentionAutocomplete/
    // parseDcMentions window.X olarak erişilebilir.

    // ─── TASLAK KAYDI + SPAM/RATE-LIMIT KORUMASI → social-dc-draft.js
    // dosyasına taşındı (Faz E, 2026-07-23). saveDcDraft/restoreDcDraft/
    // clearDcDraft/canSendDcMessage window.X olarak erişilebilir.


    // ─── SOHBET TEMALARI/GÖRÜNÜM AYARLARI → social-dc-chat-theme.js dosyasına
    // taşındı (Faz E, 2026-07-23). Renk/duvar kağıdı/balon şekli/yazı boyutu-
    // tipi/kompakt mod — initDcChatTheme() window.X olarak erişilebilir.

    // ─── YÜKLENİYOR İSKELETİ ───────────────────────────────
    function showDcSkeleton(streamEl) {
        if (!streamEl) return;
        const rows = [
            { side: 'left',  width: '60%' },
            { side: 'right', width: '40%' },
            { side: 'left',  width: '70%' },
            { side: 'left',  width: '45%' },
            { side: 'right', width: '55%' },
        ];
        streamEl.innerHTML = `<div class="dc-skeleton-wrap">${rows.map(r => `
            <div class="dc-msg-skeleton-row${r.side === 'right' ? ' right' : ''}">
                <div class="dc-skel-avatar"></div>
                <div class="dc-skel-bubble" style="width:${r.width};"></div>
            </div>
        `).join('')}</div>`;
    }

    // ─── AŞAĞI KAYDIR BUTONU ───────────────────────────────
    let _dcRoomMsgCounts = {};

    function setupDcScrollButton(streamEl) {
        const btn = document.getElementById('dc-scroll-bottom-btn');
        if (!btn || btn.dataset.bound) return;
        btn.dataset.bound = '1';

        btn.addEventListener('click', () => {
            streamEl.scrollTo({ top: streamEl.scrollHeight, behavior: 'smooth' });
            btn.style.display = 'none';
            const badge = document.getElementById('dc-scroll-bottom-badge');
            if (badge) { badge.style.display = 'none'; badge.textContent = ''; }
        });

        streamEl.addEventListener('scroll', () => {
            const distFromBottom = streamEl.scrollHeight - streamEl.scrollTop - streamEl.clientHeight;
            if (distFromBottom > 150) {
                btn.style.display = 'flex';
            } else {
                btn.style.display = 'none';
                const badge = document.getElementById('dc-scroll-bottom-badge');
                if (badge) { badge.style.display = 'none'; badge.textContent = ''; }
            }
        });
    }

    function dcIsNearBottom(streamEl) {
        if (!streamEl) return true;
        return (streamEl.scrollHeight - streamEl.scrollTop - streamEl.clientHeight) < 100;
    }
    // social-chat-extras.js (initHybridChatUI) buna bare çağrıyla erişiyor —
    // ayrı dosyaya taşındığı için global export gerekiyor.
    window.dcIsNearBottom = dcIsNearBottom;

    function dcHandleScrollAfterRender(streamEl, path, total, wasAtBottom, forceScroll) {
        const btn = document.getElementById('dc-scroll-bottom-btn');
        const badge = document.getElementById('dc-scroll-bottom-badge');
        const prevCount = _dcRoomMsgCounts[path];
        _dcRoomMsgCounts[path] = total;

        if (wasAtBottom || forceScroll) {
            streamEl.scrollTop = streamEl.scrollHeight;
            if (btn) btn.style.display = 'none';
            if (badge) { badge.style.display = 'none'; badge.textContent = ''; }
            return;
        }

        if (prevCount !== undefined && total > prevCount && btn) {
            const newCount = (parseInt(badge && badge.textContent, 10) || 0) + (total - prevCount);
            if (badge) {
                badge.textContent = newCount > 99 ? '99+' : String(newCount);
                badge.style.display = 'flex';
            }
            btn.style.display = 'flex';
        }
    }

    // YAZIYOR... GÖSTERGESİ / OKUNDU BİLGİSİ → social-typing-read-receipts.js dosyasına taşındı (Faz 6)

    // ─── YANITLA: input üstünde önizleme çubuğu ─────────────
    function initiateDcReply(sender, text, msgKey) {
        _dcReplyTo = msgKey ? { sender, text, msgKey } : { sender, text };
        const inputEl = document.getElementById('sidebar-chat-message-input');
        const inputWrap = inputEl ? inputEl.closest('.dc-chat-input-bar') : null;
        if (!inputWrap) return;

        let replyBar = document.getElementById('sidebar-chat-reply-preview-bar');
        if (!replyBar) {
            replyBar = document.createElement('div');
            replyBar.id = 'sidebar-chat-reply-preview-bar';
            inputWrap.insertBefore(replyBar, inputWrap.firstChild);
        }
        replyBar.className = 'chat-reply-bar-active';
        replyBar.style.display = '';
        replyBar.innerHTML = `
            <div class="chat-reply-bar-inner">
                <i class="fa-solid fa-reply chat-reply-bar-icon"></i>
                <div class="chat-reply-bar-text">
                    <span class="chat-reply-bar-name">@${_escapeHtml(sender)}</span>
                    <span class="chat-reply-bar-preview">${_escapeHtml(text.length > 50 ? text.slice(0, 50) + '…' : text)}</span>
                </div>
                <button class="chat-reply-bar-close" data-action="cancel-reply"><i class="fa-solid fa-xmark"></i></button>
            </div>
        `;
        replyBar.querySelector('[data-action="cancel-reply"]').addEventListener('click', cancelDcReply);
        inputEl?.focus();
    }

    function cancelDcReply() {
        _dcReplyTo = null;
        const replyBar = document.getElementById('sidebar-chat-reply-preview-bar');
        if (replyBar) replyBar.style.display = 'none';
    }
    window.cancelDcReply = cancelDcReply;

    // ─── ALINTILANAN MESAJA GİT ──────────────────────────
    // "Hafif thread": yanıt alıntısına tıklanınca akışta orijinal mesaja kayar ve kısaca vurgular
    function jumpToDcMsg(msgKey) {
        const streamEl = document.getElementById('sidebar-chat-messages-stream');
        if (!streamEl) return;
        const target = streamEl.querySelector(`[data-msg-key="${window.CSS && CSS.escape ? CSS.escape(msgKey) : msgKey}"]`);
        if (!target) {
            const note = document.createElement('div');
            note.className = 'dc-rate-limit-warning';
            note.style.cssText = 'text-align:center; color:rgba(255,255,255,0.5); font-size:12px; padding:6px; opacity:0.9;';
            note.textContent = 'Orijinal mesaj şu an yüklü değil.';
            streamEl.appendChild(note);
            streamEl.scrollTop = streamEl.scrollHeight;
            setTimeout(() => note.remove(), 2500);
            return;
        }
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add('dc-msg-jump-highlight');
        setTimeout(() => target.classList.remove('dc-msg-jump-highlight'), 1600);
    }
    window.jumpToDcMsg = jumpToDcMsg;

    // ─── MESAJ SEÇİMİ (kopyala/toplu-sil araç çubuğu) → social-dc-msg-selection.js
    // dosyasına taşındı (Faz E, 2026-07-23). toggleDcMsgSelection/
    // clearDcSelection window.X olarak erişilebilir.

    // openDcForwardPicker/forwardDcMessagesTo kaldırıldı (sadeleştirme kararı,
    // 2026-07-02): mesaj iletme özelliği ürün kimliğiyle çelişiyordu.

    function dcShowToast(text, type) { window.dcShowToast(text, type); }

    // ─── GERİ ALINABİLİR TOAST + ONAY PENCERELERİ → social-dc-confirm-toasts.js
    // dosyasına taşındı (Faz E, 2026-07-23). dcShowUndoToast/dcShowConfirm/
    // dcShowDeleteChoice + DC_DELETE_FOR_EVERYONE_LIMIT_MS window.X olarak
    // erişilebilir. dcShowToast wrapper'ı (yukarıda) BİLİNÇLİ OLARAK burada
    // kaldı (31 dış bare çağrısı var).

    // ─── SOHBET KAPAT ────────────────────────────────────
    function closeDcChat() {
        window._activeChatTarget = null;
        // Sadece SOHBET (dm/group) kaydını temizle — 'group-panel' kaydı sohbetten
        // bağımsızdır: kullanıcı Sınıf Paneli'ndeyken başka ana sekmeye geçmek
        // closeDcChat'i tetikliyor ve kayıt silinince sayfa yenilemede grup paneli
        // yerine Arena açılıyordu.
        try {
            const _saved = JSON.parse(localStorage.getItem('focusai_dc_last_open') || 'null');
            if (_saved && _saved.fn !== 'group-panel' && typeof window._dcClearLastOpen === 'function') window._dcClearLastOpen();
        } catch (_) {
            if (typeof window._dcClearLastOpen === 'function') window._dcClearLastOpen();
        }
        cancelDcReply();
        window.clearDcSelection();
        window.teardownDcTyping();
        window.teardownDcReadReceipt();
        window.teardownDcGroupReadReceipt();
        window.teardownDcPinned();
        // Sohbet panel tamamen kapatılırken açık kalan Supabase realtime kanallarını
        // (mesaj/okundu/reaksiyon/yazıyor) da kapat — önceden sadece başka bir
        // sohbete GEÇİLİRKEN temizleniyordu, panel kapatılıp hiç sohbet açılmayınca
        // kanallar sayfa yenilenene kadar arka planda açık kalıyordu.
        if (window.FocusSupabase) teardownDcSupabaseDmChannels();
        const jumpBtn = document.getElementById('dc-jump-unread-btn');
        if (jumpBtn) jumpBtn.style.display = 'none';
        _dcMsgRegistry = {};
        const emptyEl  = document.getElementById('dc-chat-empty-state');
        const streamEl = document.getElementById('sidebar-chat-messages-stream');
        const headerEl = document.getElementById('dc-chat-header');
        if (emptyEl)  emptyEl.style.display  = 'flex';
        if (streamEl) { streamEl.style.display = 'none'; streamEl.innerHTML = ''; }
        if (headerEl) headerEl.style.display = 'none';
        document.querySelectorAll('.dc-channel-item').forEach(el => el.classList.remove('active'));
    }
    window.closeDcChat = closeDcChat;

    // ─── DİNLEYİCİLERİ TEMİZLE ──────────────────────────
    // Üye listesi paneli için Supabase realtime kanalını ve presence dinleyicisini kapatır
    window.teardownDcMembersSupabase = teardownDcMembersSupabase; // social-room-presence.js için
    function teardownDcMembersSupabase() {
        if (_dcMembersSupabaseChannel) { window.FocusSupabase.removeChannel(_dcMembersSupabaseChannel); _dcMembersSupabaseChannel = null; }
        if (_dcMembersPresenceHandler) { window.removeEventListener('focusai:presence-changed', _dcMembersPresenceHandler); _dcMembersPresenceHandler = null; }
    }

    function detachDcListeners() {
        teardownDcMembersSupabase();
        teardownDcRoomPresenceStripChannels();
        window.teardownDcTyping();
        window.teardownDcReadReceipt();
        window.teardownDcGroupReadReceipt();
    }
    window.detachDcListeners = detachDcListeners; // social-dc-init.js gibi ayrı script scope'larından erişim için

    // ──────────────────────────────────────────────────────
    // DC (SOHBET MİMARİSİ) INIT/BAĞLAMA KATMANI → social-dc-init.js dosyasına
    // taşındı (Faz E, 2026-07-23). bindAddRoomBtn/bindAddContactBtn/
    // bindAddGroupBtn/bindHomeBtn/bindBackBtn/updateDcBottomProfile/
    // initDcArchitecture/bindProfileZoneMenu/openProfileContextMenu — hepsi
    // window.X olarak erişilebilir.
    // ──────────────────────────────────────────────────────

    // ─── GENEL AYARLAR MODALI → social-settings-modal.js dosyasına taşındı
    // (Faz E, 2026-07-23). openSettingsModal(user) window.X olarak erişilebilir.

    // ─── KİŞİ LİSTESİ DOLDURMA → social-dc-contacts.js dosyasına taşındı
    // (Faz E, 2026-07-23). syncDcContactList() window.X olarak erişilebilir.

    // ── Mesajdaki ... butonuna tıklayınca profil modalını aç ──
    document.addEventListener('click', function(e) {
        const btn = e.target.closest('.chat-user-detail-trigger');
        if (!btn) return;
        e.stopPropagation();
        const uid = btn.dataset.uid;
        const uname = btn.dataset.uname;
        if (uid && uname && typeof window.openDetailedMiniProfile === 'function') {
            window.openDetailedMiniProfile(uid, uname);
        }
    });

    // DOM hazır olunca başlat
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(() => { if (typeof window.initDcArchitecture === 'function') window.initDcArchitecture(); }, 1200));
    } else {
        setTimeout(() => { if (typeof window.initDcArchitecture === 'function') window.initDcArchitecture(); }, 1200);
    }

    // Sidebar profil alanı — event delegation
    document.addEventListener('click', function(e) {
        const zone = e.target.closest('#sidebar-user-profile');
        if (!zone) return;
        e.stopPropagation();
        if (typeof window.openProfileContextMenu === 'function') window.openProfileContextMenu(zone);
    });

    // ─── DM SOHBETİNE GEÇİŞ + MİNİ PROFİL POPUP → social-dc-contacts.js
    // dosyasına taşındı (Faz E, 2026-07-23). goToDmChat/openMiniProfile
    // window.X olarak erişilebilir.

})();


// 🛡️ Duyuru Kanalı Kontrolü ve Mesaj Alanını Kilitleme Fonksiyonu
function updateChatInputStatus() {
    const chatInputArea = document.querySelector('.dc-chat-input-area') || document.querySelector('.chat-input-row') || document.getElementById('dc-chat-form');
    if (!chatInputArea) return;

    // Duyuru kanalında sadece admin ve teacher yazabilir
    const _instRole = (window.currentUser?.institutionRole) || 'member';
    const _groupRole = window._focusCurrentGroupRole || 'member';
    const _canWriteAnnouncement = _groupRole === 'admin' || _groupRole === 'moderator' || _instRole === 'teacher' || _instRole === 'admin';
    if (currentChannelIsAnnouncement && !_canWriteAnnouncement) {
        if (!document.getElementById('chat-locked-notice')) {
            // Input alanlarını ve butonları gizle
            const elements = chatInputArea.querySelectorAll('input, textarea, button, .dc-chat-attachments');
            elements.forEach(el => el.style.display = 'none');

            // Kilitli mesaj kutusunu ekle
            const lockDiv = document.createElement('div');
            lockDiv.id = 'chat-locked-notice';
            lockDiv.className = 'chat-locked-container';
            lockDiv.innerHTML = '<i class="fa-solid fa-lock"></i> Bu bir duyuru kanalıdır. Sadece Yöneticiler mesaj yazabilir.';
            chatInputArea.appendChild(lockDiv);
        }
    } else {
        // Kilidi kaldır ve her şeyi eski haline getir
        const lockNotice = document.getElementById('chat-locked-notice');
        if (lockNotice) lockNotice.remove();
        const elements = chatInputArea.querySelectorAll('input, textarea, button, .dc-chat-attachments');
        elements.forEach(el => el.style.display = '');
    }
}


// ═══════════════════════════════════════════════════════
// 👤 DETAYLI MİNİ PROFİL FONKSİYONLARI
// ═══════════════════════════════════════════════════════
window.openDetailedMiniProfile = function(userId, userName) {
    const modal = document.getElementById('user-detail-modal');
    if (!modal) return;
    
    // Varsayılan yükleniyor değerlerini ata
    document.getElementById('detail-user-name').innerText = userName || "Kullanıcı";
    document.getElementById('detail-user-avatar').innerText = (userName || "U").charAt(0).toUpperCase();
    document.getElementById('detail-user-status').innerText = "Durum bilgisi yükleniyor...";
    
    const badgeContainer = document.getElementById('detail-user-role-badge-container');
    badgeContainer.innerHTML = ''; 

    // Admin kontrolü: İsteyen herkes rol değiştiremesin, sadece admin değiştirebilsin
    const adminArea = document.getElementById('detail-admin-action-area');
    const saveBtn = document.getElementById('btn-save-user-detail-role');
    
    if (typeof currentUserRole !== 'undefined' && currentUserRole === 'admin') {
        if(adminArea) adminArea.style.display = 'block';
        if(saveBtn) saveBtn.style.display = 'inline-block';
    } else {
        if(adminArea) adminArea.style.display = 'none';
        if(saveBtn) saveBtn.style.display = 'none';
    }

    // Firebase rol/durum sorgusu kaldırıldı — rol yönetimi Supabase üzerinden yapılır
    document.getElementById('detail-user-status').innerText = "Şu an aktif bir odağı veya aktivitesi yok.";

    // Modalı görünür yap
    modal.classList.remove('hidden');
};

})();

})();

// Diğer social-*.js modüllerinin import edebilmesi için ince sarmalayıcı export'lar.
export const getUser = window.getUser;
export const getDB = window.getDB;
export const _escapeHtml = window._escapeHtml;
