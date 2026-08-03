// Faz H devamı: social.js'ten çıkarıldı — topluluk profili kurulum modalı +
// kullanıcı kaydetme/oluşturma (openCommunitySetupModal/saveUser/registerUser).
// _profileToCurrentUser social-auth-bootstrap.js'ten import ediliyor (döngüsel
// import, ama sadece fonksiyon gövdesi içinde kullanıldığı için güvenli).
import { getCurrentUser, setCurrentUser } from './state/current-user-store.js';
import { resetSetupModalToRegister } from './social-setup-modal-edit.js';
import { getSavedUser } from './social-misc-isolated-utils.js';
import { _profileToCurrentUser } from './social-auth-bootstrap.js';

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
window.openCommunitySetupModal = openCommunitySetupModal;

function saveUser(u) {
    localStorage.setItem('focusai_social_user', JSON.stringify(u));
    setCurrentUser(u);
}
window.saveUser = saveUser;

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

        setCurrentUser(_profileToCurrentUser(updated, session.user));
        saveUser(getCurrentUser());

        return { success: true };
    } catch (e) {
        return { success: false, error: 'Bağlantı hatası: ' + e.message };
    }
}
window.registerUser = registerUser;

export { openCommunitySetupModal, saveUser, registerUser };
