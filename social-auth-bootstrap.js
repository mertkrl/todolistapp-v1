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
import { openAuthModal } from './auth-ui.js';
import { saveUser } from './social-user-registration.js';
import { syncXP, startAllSocialListeners } from './social-group-listeners.js';

async function initSocial() {
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
        showNotConfiguredBanner();
        return;
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

        setCurrentUser(_profileToCurrentUser(profile, authUser));
        saveUser(getCurrentUser());
        updateProfileHeader();
        window.startPresence();
        syncXP();
        startAllSocialListeners();
    } catch (e) {
        console.error('[FocusAI Social] profil yükleme hatası:', e);
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
// - Oturum yoksa hesap/giriş modalını açar.
// - Oturum var ama topluluk profili (username) eksikse kurulum modalını açar.
async function ensureCommunityAccess() {
    if (getCurrentUser()) return true;
    if (!window.FocusAuth) return false;
    const session = await window.FocusAuth.getSession();
    if (!session || !session.user) {
        openAuthModal();
        return false;
    }
    await loadCommunityProfile(session.user);
    return !!getCurrentUser();
}
window.ensureCommunityAccess = ensureCommunityAccess;

export { initSocial, bindAuthChangeListener, loadCommunityProfile, _profileToCurrentUser, ensureCommunityAccess };
