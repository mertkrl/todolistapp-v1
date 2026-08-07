// Uygulama genelinde giriş kapısı. #app-login-gate (index.html, <body> içinde
// ilk eleman) sayfa yüklendiğinde varsayılan olarak görünür durumda gelir —
// FOUC'u önlemek için "hidden" class'ı yok, JS burada session'ı doğrulayınca
// gizliyor. Böylece kullanıcı geçerli bir Supabase oturumu olmadan
// uygulamanın hiçbir sekmesine erişemiyor; oturum localStorage'da kalıcı
// olduğu için sayfa yenilense bile tekrar giriş bilgisi istenmiyor.
//
// Akış: önce sadece e-posta istenir (adım "email"). E-posta girilince
// kayıtlı bir hesap varsayımıyla şifre istenir (adım "login"). Giriş
// başarısız olursa (hesap yok ya da şifre yanlış — Supabase ikisini de aynı
// hatayla döner, hesap varlığını sızdırmamak için) kullanıcıya kayıt olma
// seçeneği sunulur (adım "signup") — orada e-posta zaten bilindiği için
// sadece kullanıcı adı + şifre istenir.
import { _isStrongPassword, _validateEmail } from './auth-ui-utils.js';

let _email = '';

// ── GELİŞTİRİCİ TEST GİRİŞİ (sadece test@gmail.com / testt@gmail.com) ────
// Kullanıcının isteğiyle eklendi: sadece bu SABİT e-postalar için şifre
// istenmeden, gerçek Supabase auth'a hiç dokunmadan kapı kapatılır.
// Başka hiçbir e-posta için çalışmaz — güvenlik riski taşımaz, çünkü gerçek
// bir hesabı/oturumu temsil etmez.
const DEV_TEST_EMAILS = ['test@gmail.com', 'testt@gmail.com'];

function _showGate() {
    document.getElementById('app-login-gate')?.classList.remove('hidden');
    document.body.classList.add('app-gate-locked');
}

function _hideGate() {
    document.getElementById('app-login-gate')?.classList.add('hidden');
    document.body.classList.remove('app-gate-locked');
}

function _goToBugunTab() {
    document.querySelector('.nav-links li[data-target="bugun"]')?.click();
}

const STEP_IDS = ['app-gate-step-email', 'app-gate-step-login', 'app-gate-step-signup', 'app-gate-section-reset'];
function _showStep(id) {
    STEP_IDS.forEach(sid => document.getElementById(sid)?.classList.toggle('hidden', sid !== id));
}

function _resetToEmailStep() {
    _email = '';
    const emailInput = document.getElementById('app-gate-email');
    if (emailInput) emailInput.value = '';
    const emailStatus = document.getElementById('app-gate-email-status');
    if (emailStatus) emailStatus.textContent = '';
    document.getElementById('app-gate-goto-signup-btn')?.classList.add('hidden');
    _showStep('app-gate-step-email');
}

// E-postanın kayıtlı olup olmadığını sorar (bkz. supabase/migrations/135_email_exists_rpc.sql).
// Supabase, giriş denemesinden "hesap yok" ile "şifre yanlış"ı ayırt eden bir
// sinyal vermiyor (kullanıcı numaralandırmasını önlemek için kasıtlı) — bu
// yüzden ayrı bir RPC gerekiyor. Fonksiyon henüz deploy edilmemişse (hata
// dönerse) girişe varsayılan olarak devam edilir; şifre yanlış çıkarsa zaten
// "Hesap Oluştur" butonu devreye girer (_submitLoginStep).
async function _emailIsRegistered(email) {
    if (!window.FocusSupabase) return null;
    try {
        const { data, error } = await window.FocusSupabase.rpc('email_exists', { check_email: email });
        if (error) throw error;
        return !!data;
    } catch (e) {
        console.warn('[app-login-gate] email_exists RPC kullanılamıyor, giriş adımına devam ediliyor:', e.message);
        return null;
    }
}

async function _submitEmailStep() {
    const emailInput = document.getElementById('app-gate-email');
    const status = document.getElementById('app-gate-email-status');
    const email = (emailInput.value || '').trim();
    if (!_validateEmail(email, status)) return;

    if (DEV_TEST_EMAILS.includes(email.toLowerCase())) {
        // Sosyal'in kendi test-girişini de kur (currentUser) — aksi halde Sosyal
        // paneli gerçek bir FocusAuth oturumu olmadığı için boş/kilitli kalır.
        // window.__devTestLogin social-auth-bootstrap.js'te tanımlı (social.js
        // ile birlikte gecikmeli yükleniyor); henüz yüklenmediyse sessizce atlanır.
        if (typeof window.__devTestLogin === 'function') {
            window.__devTestLogin(email);
        }
        // Test hesabının gerçek bir Supabase oturumu YOK — bu yüzden sayfa
        // yenilenince FocusAuth.getSession() hep null dönüyor ve kapı tekrar
        // açılıyordu (kullanıcı raporu, 2026-08-06). Bu işareti localStorage'a
        // yazıp _initAppLoginGate'te kontrol ederek yenilemede de girişi
        // hatırlıyoruz.
        localStorage.setItem('focusai_dev_test_email', email.toLowerCase());
        _hideGate();
        _goToBugunTab();
        return;
    }

    const btn = document.getElementById('app-gate-email-next-btn');
    btn.disabled = true;
    status.textContent = 'Kontrol ediliyor...';
    status.style.color = 'var(--text-muted)';
    const registered = await _emailIsRegistered(email);
    btn.disabled = false;
    status.textContent = '';

    _email = email;
    document.getElementById('app-gate-login-email-label').textContent = email;
    document.getElementById('app-gate-signup-email-label').textContent = email;
    document.getElementById('app-gate-status').textContent = '';
    document.getElementById('app-gate-password').value = '';
    document.getElementById('app-gate-goto-signup-btn')?.classList.add('hidden');

    if (registered === false) {
        _goToSignupStep();
    } else {
        // registered === true ya da RPC kullanılamadı (null) — giriş adımına devam
        _showStep('app-gate-step-login');
        document.getElementById('app-gate-password')?.focus();
    }
}

async function _submitLoginStep() {
    if (!window.FocusAuth) {
        const status = document.getElementById('app-gate-status');
        status.textContent = 'Supabase yapılandırılmamış — giriş yapılamıyor.';
        status.style.color = '#ff4757';
        return;
    }

    const password = document.getElementById('app-gate-password').value || '';
    const status = document.getElementById('app-gate-status');
    if (!password) {
        status.textContent = 'Şifreni gir.';
        status.style.color = '#ff4757';
        return;
    }

    const btn = document.getElementById('app-gate-send-btn');
    btn.disabled = true;
    status.textContent = 'Giriş yapılıyor...';
    status.style.color = 'var(--text-muted)';
    try {
        const { error } = await window.FocusAuth.signIn(_email, password);
        if (error) throw error;
        // SIGNED_IN eventi tetiklenecek, kapı oradan kapanıp Bugün'e geçilecek
    } catch (e) {
        status.textContent = 'Bu e-posta ile hesap bulunamadı ya da şifre yanlış.';
        status.style.color = '#ff4757';
        document.getElementById('app-gate-goto-signup-btn')?.classList.remove('hidden');
    } finally {
        btn.disabled = false;
    }
}

function _goToSignupStep() {
    document.getElementById('app-gate-signup-status').textContent = '';
    document.getElementById('app-gate-username').value = '';
    document.getElementById('app-gate-signup-password').value = '';
    _showStep('app-gate-step-signup');
    document.getElementById('app-gate-username')?.focus();
}

async function _submitSignupStep() {
    if (!window.FocusAuth) {
        const status = document.getElementById('app-gate-signup-status');
        status.textContent = 'Supabase yapılandırılmamış — kayıt olunamıyor.';
        status.style.color = '#ff4757';
        return;
    }

    const usernameInput = document.getElementById('app-gate-username');
    const username = (usernameInput.value || '').trim().toLowerCase();
    const password = document.getElementById('app-gate-signup-password').value || '';
    const status = document.getElementById('app-gate-signup-status');

    if (!username || username.length < 3 || /[^a-z0-9_]/.test(username)) {
        status.textContent = 'Kullanıcı adı en az 3 karakter olmalı, sadece harf/rakam/alt çizgi içerebilir.';
        status.style.color = '#ff4757';
        return;
    }
    if (!_isStrongPassword(password)) {
        status.textContent = 'Şifre en az 8 karakter olmalı ve en az bir rakam içermeli.';
        status.style.color = '#ff4757';
        return;
    }

    const btn = document.getElementById('app-gate-signup-send-btn');
    btn.disabled = true;
    status.textContent = 'Hesap oluşturuluyor...';
    status.style.color = 'var(--text-muted)';
    try {
        const { data, error } = await window.FocusAuth.signUp(_email, password);
        if (error) throw error;
        if (data && data.user && data.session) {
            // E-posta onayı gerekmiyor — oturum hemen döndü, kullanıcı adını kaydet.
            try {
                await window.FocusAuth.updateProfile(data.user.id, {
                    username,
                    display_name: username,
                });
            } catch (profileErr) {
                console.error('[app-login-gate] profil kaydı hatası:', profileErr);
            }
            // SIGNED_IN eventi tetiklenecek, kapı oradan kapanıp Bugün'e geçilecek
        } else {
            status.textContent = 'Hesabını onaylamak için e-postana gönderdiğimiz bağlantıya tıkla.';
            status.style.color = '#2ed573';
        }
    } catch (e) {
        status.textContent = 'Hata: ' + (e.message || 'İşlem başarısız.');
        status.style.color = '#ff4757';
    } finally {
        btn.disabled = false;
    }
}

function _bindGateForm() {
    document.getElementById('app-gate-email-next-btn')?.addEventListener('click', _submitEmailStep);
    document.getElementById('app-gate-email')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') _submitEmailStep();
    });

    document.getElementById('app-gate-login-change-email')?.addEventListener('click', (e) => {
        e.preventDefault();
        _resetToEmailStep();
    });
    document.getElementById('app-gate-signup-change-email')?.addEventListener('click', (e) => {
        e.preventDefault();
        _resetToEmailStep();
    });

    document.getElementById('app-gate-send-btn')?.addEventListener('click', _submitLoginStep);
    document.getElementById('app-gate-password')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') _submitLoginStep();
    });
    document.getElementById('app-gate-goto-signup-btn')?.addEventListener('click', _goToSignupStep);

    document.getElementById('app-gate-signup-send-btn')?.addEventListener('click', _submitSignupStep);
    ['app-gate-username', 'app-gate-signup-password'].forEach(id => {
        document.getElementById(id)?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') _submitSignupStep();
        });
    });
    document.getElementById('app-gate-username')?.addEventListener('input', (e) => {
        e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
    });

    document.getElementById('app-gate-forgot-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        const resetEmail = document.getElementById('app-gate-reset-email');
        if (resetEmail) resetEmail.value = _email;
        _showStep('app-gate-section-reset');
    });
    document.getElementById('app-gate-reset-back-btn')?.addEventListener('click', () => {
        _showStep('app-gate-step-login');
    });
    document.getElementById('app-gate-reset-send-btn')?.addEventListener('click', async () => {
        if (!window.FocusAuth) return;
        const email = (document.getElementById('app-gate-reset-email').value || '').trim();
        const status = document.getElementById('app-gate-reset-status');
        if (!_validateEmail(email, status)) return;
        const btn = document.getElementById('app-gate-reset-send-btn');
        try {
            btn.disabled = true;
            status.textContent = 'Gönderiliyor...';
            status.style.color = 'var(--text-muted)';
            const { error } = await window.FocusAuth.resetPasswordForEmail(email);
            if (error) throw error;
            status.textContent = 'Sıfırlama bağlantısı e-postana gönderildi.';
            status.style.color = '#2ed573';
        } catch (e) {
            status.textContent = 'Hata: ' + (e.message || 'Gönderilemedi.');
            status.style.color = '#ff4757';
        } finally {
            btn.disabled = false;
        }
    });
}

async function _initAppLoginGate() {
    _bindGateForm();
    _resetToEmailStep();

    // Test hesabı (bkz. DEV_TEST_EMAILS) gerçek bir Supabase oturumu açmıyor,
    // bu yüzden aşağıdaki FocusAuth.getSession() kontrolü onun için hep null
    // döner. localStorage'daki işareti burada kontrol ederek yenilemede kapı
    // tekrar açılmasın diye kapıyı hemen kapatıyoruz (kullanıcı raporu,
    // 2026-08-06). window.__devTestLogin henüz yüklenmemiş olabilir (social.js
    // gecikmeli yükleniyor) — social-auth-bootstrap.js'in initSocial() aynı
    // işareti kendi tarafında da kontrol edip currentUser'ı kuruyor.
    const devTestEmail = localStorage.getItem('focusai_dev_test_email');
    if (devTestEmail && DEV_TEST_EMAILS.includes(devTestEmail)) {
        if (typeof window.__devTestLogin === 'function') {
            window.__devTestLogin(devTestEmail);
        }
        _hideGate();
        return;
    }

    if (!window.FocusAuth) {
        // Supabase yapılandırılmamış — kapı açık kalır, kullanıcı bilgilendirilir.
        return;
    }

    window.FocusAuth.onAuthChange((event, session) => {
        if (event === 'SIGNED_IN' && session && session.user) {
            _hideGate();
            _goToBugunTab();
        } else if (event === 'SIGNED_OUT') {
            _showGate();
            _resetToEmailStep();
        }
    });

    const session = await window.FocusAuth.getSession();
    if (session && session.user) {
        _hideGate();
    } else {
        // index.html'deki senkron ön-gizleme scripti localStorage'da bir
        // Supabase auth-token anahtarı GÖRDÜĞÜ için kapıyı erkenden gizlemiş
        // olabilir, ama token aslında geçersiz/süresi dolmuş çıkabilir — bu
        // durumda kapıyı burada tekrar açıyoruz (aksi halde kullanıcı ne
        // giriş ekranını ne de uygulamayı göremeyen boş bir sayfada kalır).
        _showGate();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _initAppLoginGate);
} else {
    _initAppLoginGate();
}
