// Faz H devamı: social.js'ten çıkarıldı — oturum/topluluk profili başlatma
// zinciri (initSocial → bindAuthChangeListener/loadCommunityProfile →
// _profileToCurrentUser, + ensureCommunityAccess). saveUser/syncXP/
// startAllSocialListeners social-user-registration.js / social-group-listeners.js
// dosyalarından import ediliyor — bu iki dosya da _profileToCurrentUser'ı
// buradan import ettiği için ES modül döngüsel import'u var, ama hepsi sadece
// fonksiyon GÖVDESİ içinde (modül değerlendirme anında değil) kullanıldığı
// için canlı binding'lerle güvenli.
import { getCurrentUser, setCurrentUser } from './state/current-user-store.js';
import { updateProfileHeader, showNotConfiguredBanner } from './social-profile-header.js';
import { saveUser } from './social-user-registration.js';
import { syncXP, startAllSocialListeners } from './social-group-listeners.js';

async function initSocial() {
    // Test hesabının (bkz. devTestLogin) gerçek bir Supabase oturumu yok —
    // sayfa yenilenince aşağıdaki getSession() kontrolü onun için hep null
    // dönüp Sosyal panelini boş/kilitli bırakıyordu (kullanıcı raporu,
    // 2026-08-06). app-login-gate.js'in yazdığı localStorage işaretini burada
    // da kontrol edip currentUser'ı yeniden kuruyoruz.
    const devTestEmail = localStorage.getItem('focusai_dev_test_email');
    if (devTestEmail && devTestLogin(devTestEmail)) {
        return;
    }

    if (!window.FocusAuth) {
        showNotConfiguredBanner();
        return;
    }

    bindAuthChangeListener();

    let session;
    try {
        session = await window.FocusAuth.getSession();
    } catch (e) {
        console.error('[FocusAI Social] oturum kontrolü hatası:', e);
        showNotConfiguredBanner();
        return;
    }
    if (!session || !session.user) {
        // GERÇEK BUG DÜZELTMESİ (2026-08-06): sayfa yenilendiğinde/ilk
        // yüklendiğinde bu getSession() çağrısı bazen Supabase istemcisinin
        // localStorage'daki oturumu henüz geri yüklemesi TAMAMLANMADAN
        // koşuyor ve null dönüyor — halbuki oturum aslında geçerli ve
        // milisaniyeler içinde hazır oluyor. Bu durumda showNotConfiguredBanner()
        // kalıcı olarak "Topluluk Özellikleri için Oturum Gerekiyor" banner'ını
        // gösterip kalıyordu (kullanıcı gerçekte giriş yapmış olsa bile) —
        // hiçbir şey daha sonra tekrar deneyip banner'ı kaldırmıyordu (canlı
        // testte doğrulandı: manuel initSocial() tekrar çağrısı düzeltiyordu).
        // Bir kez kısa gecikmeyle tekrar deniyoruz.
        await new Promise(r => setTimeout(r, 700));
        try {
            session = await window.FocusAuth.getSession();
        } catch (e) {
            session = null;
        }
        if (!session || !session.user) {
            showNotConfiguredBanner();
            return;
        }
    }

    await loadCommunityProfile(session.user);
}
window.initSocial = initSocial;

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
            setCurrentUser(null);
            showNotConfiguredBanner();
        }
    });
}

// Oturum sahibinin `profiles` satırını çeker. `username` henüz seçilmemişse
// "topluluk profili" kurulum modalını tetikleyen bir event yayınlar.
async function loadCommunityProfile(authUser, _isRetry) {
    try {
        const { data: profile, error } = await window.FocusSupabase
            .from('profiles')
            .select('*')
            .eq('id', authUser.id)
            .maybeSingle();
        if (error) throw error;

        if (!profile || !profile.username) {
            // GERÇEK BUG DÜZELTMESİ (2026-08-06): app-login-gate.js'in kayıt
            // akışı (_submitSignupStep) signUp() başarılı dönünce kullanıcı
            // adını updateProfile() ile YAZIYOR, ama Supabase'in kendi
            // SIGNED_IN olayı bu yazma tamamlanmadan ÖNCE (aynı mikro-görev
            // turunda) tetiklenebiliyor — bu da loadCommunityProfile'ın
            // profili HENÜZ username'siz haldeyken görüp gereksiz yere
            // "Topluluğa Katıl!" kurulum modalını açmasına yol açıyordu
            // (canlı testte doğrulandı: profil aslında saniyeler içinde
            // doğru username ile duruyordu). Bir kez, kısa bir gecikmeyle
            // tekrar kontrol ederek bu yarış durumunu (race condition)
            // ortadan kaldırıyoruz — gerçekten kurulum gereken hesaplar için
            // sadece yarım saniyelik zararsız bir gecikme ekliyor.
            if (!_isRetry) {
                setTimeout(() => loadCommunityProfile(authUser, true), 900);
                return;
            }
            window.dispatchEvent(new CustomEvent('focusai:needs-community-profile', {
                detail: { authUser, profile }
            }));
            return;
        }

        setCurrentUser(_profileToCurrentUser(profile, authUser));
        saveUser(getCurrentUser());
        updateProfileHeader();

        // GERÇEK BUG DÜZELTMESİ (2026-08-06): profil başarıyla yüklenip
        // updateProfileHeader() banner'ı doğru şekilde gizledikten SONRA,
        // aşağıdaki dinleyici kurulum çağrılarından biri (örn.
        // startAllSocialListeners() → listenForFriendAcceptances()) hata
        // fırlatırsa, dıştaki try/catch bunu "profil yüklenemedi" sanıp
        // showNotConfiguredBanner() ile banner'ı GERİ getiriyordu — halbuki
        // kullanıcı zaten düzgün giriş yapmıştı, sadece ikincil bir
        // bildirim/dinleyici kurulumu başarısız olmuştu (canlı testte
        // doğrulandı: window.__getFriendAcceptSupaChannelRef tanımsızdı).
        // Bu kritik-olmayan adımlar artık kendi try/catch'lerinde — biri
        // patlarsa sadece konsola loglanır, zaten başarılı olan profil
        // durumunu geri almaz.
        try {
            window.startPresence();
            syncXP();
            startAllSocialListeners();
        } catch (listenerErr) {
            console.error('[FocusAI Social] dinleyici kurulum hatası (profil yine de yüklü kaldı):', listenerErr);
        }
    } catch (e) {
        console.error('[FocusAI Social] profil yükleme hatası:', e);
        // GERÇEK BUG DÜZELTMESİ (2026-08-07): taze bir giriş/sekme geçişinden
        // hemen sonra `.from('profiles').select()` bazen geçici bir hata
        // fırlatıyordu (Supabase istemcisinin oturum/JWT'yi tam
        // uygulamadığı bir an — canlı testte doğrulandı: AYNI sorgu
        // milisaniyeler sonra elle tekrar çalıştırılınca sorunsuz
        // çalışıyordu). Bu, kullanıcı gerçekte giriş yapmış olsa bile
        // "Topluluk Özellikleri için Oturum Gerekiyor" banner'ının
        // görünmesine ve currentUser'ın null kalmasına yol açıyordu — bir
        // sekme değiştirene kadar kendi kendine düzelmiyordu. Yukarıdaki
        // username-yarışı düzeltmesiyle aynı desende bir kez tekrar deniyoruz.
        if (!_isRetry) {
            setTimeout(() => loadCommunityProfile(authUser, true), 900);
            return;
        }
        showNotConfiguredBanner();
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
// - Oturum yoksa false döner (normal akışta olmamalı — uygulamaya girmek
//   zaten #app-login-gate'ten geçmeyi gerektiriyor, bkz. app-login-gate.js;
//   giriş artık tek yer olduğu için burada eski "Hesap/Senkronizasyon"
//   modalını açmıyoruz).
// - Oturum var ama topluluk profili (username) eksikse kurulum modalını açar.
async function ensureCommunityAccess() {
    if (getCurrentUser()) return true;
    if (!window.FocusAuth) return false;
    const session = await window.FocusAuth.getSession();
    if (!session || !session.user) {
        return false;
    }
    await loadCommunityProfile(session.user);
    return !!getCurrentUser();
}
window.ensureCommunityAccess = ensureCommunityAccess;

// ── GELİŞTİRİCİ TEST GİRİŞİ (sadece test@gmail.com / testt@gmail.com) ────
// Kullanıcının kendi isteğiyle eklendi: sadece bu SABİT e-postalar için, gerçek
// Supabase auth'a HİÇ dokunmadan (signIn/signUp çağrılmaz, şifre kontrol
// edilmez) yerel bir sahte currentUser kurar. Başka hiçbir e-posta için
// çalışmaz — güvenlik riski taşımaz, çünkü gerçek bir hesabı/oturumu temsil
// etmez ve Supabase RLS'e bağlı sorgular (id eşleşmediği için) boş döner.
// Sadece "Topluluk Özellikleri için Giriş Yap" duvarını UI'da aşıp Arena/
// Sıralama gibi ekranları test edebilmek içindir.
const DEV_TEST_ACCOUNTS = {
    'test@gmail.com': {
        id: '00000000-0000-0000-0000-0000000000f1',
        username: 'test',
        displayName: 'Test Kullanıcı',
        avatarColor: '6c5ce7',
    },
    'testt@gmail.com': {
        id: '00000000-0000-0000-0000-0000000000f2',
        username: 'testt',
        displayName: 'Test Kullanıcı 2',
        avatarColor: 'ff6b81',
    },
};
function devTestLogin(email) {
    const account = DEV_TEST_ACCOUNTS[(email || '').trim().toLowerCase()];
    if (!account) return false;
    const user = {
        // Geçerli bir UUID biçiminde (ama gerçekte var olmayan) sabit bir id —
        // Supabase REST sorguları (ör. .eq('user_id', id)) bir UUID sütununa
        // geçersiz biçimli bir string verildiğinde 400 döner; bu id formatı
        // doğru olduğu için sorgular normal şekilde çalışır (sadece eşleşen
        // satır olmadığından boş sonuç döner, hata değil).
        id: account.id,
        username: account.username,
        displayName: account.displayName,
        avatarColor: account.avatarColor,
        customAvatar: null, avatarInitials: null,
        status: 'online',
        statusColor: '#2ed573',
        statusText: '',
        institutionRole: 'member',
        plan: 'free',
        _devTestAccount: true,
    };
    // NOT: window.getUser() (social-misc-pure-utils.js) currentUser state'ini
    // DEĞİL, doğrudan localStorage 'focusai_social_user' anahtarını okuyor —
    // bu yüzden sadece setCurrentUser çağırmak yetmiyor, aynı anahtara da
    // yazmak gerekiyor (aksi halde "Kişi Ekle" gibi getUser() kontrolü yapan
    // butonlar test hesabında hep "giriş yapılmamış" sanıp yanlış uyarı verir).
    localStorage.setItem('focusai_social_user', JSON.stringify(user));
    setCurrentUser(user);
    updateProfileHeader();
    return true;
}
window.__devTestLogin = devTestLogin;

export { initSocial, bindAuthChangeListener, loadCommunityProfile, _profileToCurrentUser, ensureCommunityAccess, devTestLogin };
