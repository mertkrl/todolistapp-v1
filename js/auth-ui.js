/**
 * FocusAI hesap / senkronizasyon arayüzü.
 * - Magic link (yeni kullanıcı) + OTP kodu (mevcut kullanıcı) girişi
 * - İlk girişte profil kurulum modalı (kullanıcı adı, isim, avatar rengi)
 * - Veri aktarım sihirbazı
 */
import {
    AVATAR_COLORS, _toast, _avatarColorSwatches,
    _isStrongPassword, _validateEmail, _summaryRow
} from './auth-ui-utils.js';

(() => {
    function _injectModals() {
        if (document.getElementById('focusai-auth-modal')) return;

        const wrapper = document.createElement('div');
        wrapper.innerHTML = `
            <!-- Auth Modal -->
            <div id="focusai-auth-modal" class="modal-overlay hidden">
                <div class="modal-content glass-panel u-max-width-420px" >
                    <div class="modal-icon-wrapper info"><i class="fa-solid fa-cloud"></i></div>
                    <div class="modal-header">
                        <h2>Hesap / Senkronizasyon</h2>
                        <button class="icon-btn" id="focusai-auth-close" aria-label="Kapat"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div class="modal-body">

                        <!-- Oturum açık değil -->
                        <div id="focusai-auth-signed-out">
                            <div class="u-display-flex_gap-8px_margin-bottom-16px_border-bottom-1pxs">
                                <button type="button" id="focusai-auth-tab-login" class="focusai-auth-tab u-flex-1_background-none_border-none_padding-10px0_font-size" data-selected="true"
 >Giriş Yap</button>
                                <button type="button" id="focusai-auth-tab-signup" class="focusai-auth-tab u-flex-1_background-none_border-none_padding-10px0_font-size-2"
 >Kayıt Ol</button>
                            </div>

                            <div id="focusai-section-form">
                                <input type="email" id="focusai-auth-email" class="premium-input u-margin-bottom-10px" placeholder="ornek@eposta.com" autocomplete="email" >
                                <input type="password" id="focusai-auth-password" class="premium-input" placeholder="Şifre" autocomplete="current-password">
                                <input type="password" id="focusai-auth-password-confirm" class="premium-input hidden u-margin-top-10px" placeholder="Şifreyi tekrar gir" autocomplete="new-password" >
                                <p class="u-margin-top-8px_text-align-right">
                                    <a href="#" id="focusai-auth-forgot-link" class="u-font-size-12px_color-var-text-muted">Şifremi unuttum</a>
                                </p>
                                <p id="focusai-auth-status" class="u-margin-top-6px_font-size-13px_color-var-text-muted"></p>
                            </div>

                            <!-- Şifre sıfırlama -->
                            <div id="focusai-section-reset" class="hidden">
                                <p class="u-margin-bottom-12px_font-size-13px_color-var-text-muted">E-postana bir sıfırlama bağlantısı gönderelim.</p>
                                <input type="email" id="focusai-reset-email" class="premium-input" placeholder="ornek@eposta.com" autocomplete="email">
                                <p id="focusai-reset-status" class="u-margin-top-10px_font-size-13px_color-var-text-muted"></p>
                                <button type="button" id="focusai-reset-send-btn" class="primary-btn u-width-100pct_margin-top-10px" ><i class="fa-solid fa-paper-plane"></i> Bağlantı Gönder</button>
                                <button type="button" id="focusai-reset-back-btn" class="control-btn secondary u-width-100pct_margin-top-8px" >Geri Dön</button>
                            </div>
                        </div>

                        <!-- Oturum açık -->
                        <div id="focusai-auth-signed-in" class="hidden">
                            <div class="u-display-flex_align-items-center_gap-14px_margin-bottom-10p">
                                <div id="focusai-user-avatar" class="u-width-44px_height-44px_border-radius-50pct_display-flex_al">?</div>
                                <div>
                                    <div id="focusai-user-displayname" class="u-font-weight-600_font-size-15px"></div>
                                    <div id="focusai-auth-email-label" class="u-font-size-12px_color-var-text-muted"></div>
                                </div>
                            </div>
                            <p class="u-font-size-13px_color-var-text-muted">Verilerin bu hesapla otomatik olarak senkronize ediliyor.</p>
                        </div>

                    </div>
                    <div class="modal-footer">
                        <button id="focusai-auth-signout-btn" class="control-btn secondary hidden"><i class="fa-solid fa-right-from-bracket"></i> Çıkış Yap</button>
                        <button id="focusai-auth-send-btn" class="primary-btn"><i class="fa-solid fa-arrow-right"></i> Giriş Yap</button>
                    </div>
                </div>
            </div>

            <!-- Profil Kurulum Modalı (ilk giriş) -->
            <div id="focusai-profile-modal" class="modal-overlay hidden">
                <div class="modal-content glass-panel u-max-width-440px" >
                    <div class="modal-icon-wrapper success"><i class="fa-solid fa-user-pen"></i></div>
                    <div class="modal-header"><h2>Hesabını Kur</h2></div>
                    <div class="modal-body">
                        <p class="u-margin-bottom-16px">Merhaba! Profilini oluşturalım. Bu bilgiler arkadaşlarına görünür.</p>

                        <!-- Avatar önizleme -->
                        <div class="u-display-flex_flex-direction-column_align-items-center_gap-">
                            <div id="focusai-profile-avatar-preview"
 class="u-width-72px_height-72px_border-radius-50pct_display-flex_al">
                                ?
                            </div>
                            <div class="u-display-flex_gap-8px_flex-wrap-wrap_justify-content-center">
                                ${_avatarColorSwatches()}
                            </div>
                        </div>

                        <div class="u-display-flex_flex-direction-column_gap-10px-2">
                            <div>
                                <label class="u-font-size-12px_color-var-text-muted_display-block_margin-b-2">Kullanıcı Adı <span class="u-color-hff4757">*</span></label>
                                <input type="text" id="focusai-profile-username" class="premium-input u-text-transform-lowercase" placeholder="ornekkullanici" maxlength="30"
 autocomplete="username">
                                <p id="focusai-username-hint" class="u-font-size-11px_color-var-text-muted_margin-top-4px-2">Harf, rakam ve alt çizgi kullanabilirsin.</p>
                            </div>
                            <div>
                                <label class="u-font-size-12px_color-var-text-muted_display-block_margin-b-2">Görünen İsim <span class="u-color-hff4757">*</span></label>
                                <input type="text" id="focusai-profile-displayname" class="premium-input" placeholder="Adın Soyadın" maxlength="40" autocomplete="name">
                            </div>
                        </div>
                        <p id="focusai-profile-status" class="u-margin-top-12px_font-size-13px_color-var-text-muted"></p>
                    </div>
                    <div class="modal-footer">
                        <button id="focusai-profile-skip-btn" class="control-btn secondary">Daha Sonra</button>
                        <button id="focusai-profile-save-btn" class="primary-btn"><i class="fa-solid fa-rocket"></i> Başla!</button>
                    </div>
                </div>
            </div>

            <!-- Veri Aktarım Modalı -->
            <div id="focusai-import-modal" class="modal-overlay hidden">
                <div class="modal-content glass-panel u-max-width-420px" >
                    <div class="modal-icon-wrapper success"><i class="fa-solid fa-cloud-arrow-up"></i></div>
                    <div class="modal-header"><h2>Verilerini Buluta Aktar</h2></div>
                    <div class="modal-body">
                        <p>Bu cihazda kayıtlı verilerin bir kopyasını hesabına aktaracağız:</p>
                        <ul id="focusai-import-summary" class="u-color-var-text-muted_font-size-14px_line-height-1p9_list-s"></ul>
                    </div>
                    <div class="modal-footer">
                        <button id="focusai-import-skip-btn" class="control-btn secondary">Daha Sonra</button>
                        <button id="focusai-import-confirm-btn" class="primary-btn"><i class="fa-solid fa-check"></i> Aktar</button>
                    </div>
                </div>
            </div>

            <!-- Yeni Şifre Belirleme Modalı (sıfırlama bağlantısından dönüş) -->
            <div id="focusai-recovery-modal" class="modal-overlay hidden">
                <div class="modal-content glass-panel u-max-width-400px" >
                    <div class="modal-icon-wrapper info"><i class="fa-solid fa-key"></i></div>
                    <div class="modal-header"><h2>Yeni Şifre Belirle</h2></div>
                    <div class="modal-body">
                        <input type="password" id="focusai-recovery-password" class="premium-input" placeholder="Yeni şifre (en az 6 karakter)" autocomplete="new-password">
                        <input type="password" id="focusai-recovery-password-confirm" class="premium-input u-margin-top-10px" placeholder="Yeni şifreyi tekrar gir" autocomplete="new-password" >
                        <p id="focusai-recovery-status" class="u-margin-top-10px_font-size-13px_color-var-text-muted"></p>
                    </div>
                    <div class="modal-footer">
                        <button id="focusai-recovery-save-btn" class="primary-btn"><i class="fa-solid fa-check"></i> Şifreyi Kaydet</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(wrapper);

        _bindAuthModal();
        _bindProfileModal();
        _bindImportModal();
        _bindRecoveryModal();
    }

    // ─── Auth modal bağlantıları ────────────────────────────────────────────
    let _authMode = 'login'; // 'login' | 'signup'

    function _setAuthMode(mode) {
        _authMode = mode;
        const loginTab = document.getElementById('focusai-auth-tab-login');
        const signupTab = document.getElementById('focusai-auth-tab-signup');
        const confirmInput = document.getElementById('focusai-auth-password-confirm');
        const sendBtn = document.getElementById('focusai-auth-send-btn');
        const forgotLink = document.getElementById('focusai-auth-forgot-link');
        const status = document.getElementById('focusai-auth-status');
        if (status) status.textContent = '';

        document.getElementById('focusai-section-reset').classList.add('hidden');
        document.getElementById('focusai-section-form').classList.remove('hidden');
        sendBtn.classList.remove('hidden');

        const active = { color: 'var(--text-color)', borderBottom: '2px solid var(--primary-color)' };
        const inactive = { color: 'var(--text-muted)', borderBottom: '2px solid transparent' };
        Object.assign(loginTab.style, mode === 'login' ? active : inactive);
        Object.assign(signupTab.style, mode === 'signup' ? active : inactive);

        if (mode === 'signup') {
            confirmInput.classList.remove('hidden');
            forgotLink.classList.add('hidden');
            sendBtn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Hesap Oluştur';
        } else {
            confirmInput.classList.add('hidden');
            forgotLink.classList.remove('hidden');
            sendBtn.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Giriş Yap';
        }
    }

    function _bindAuthModal() {
        const authModal = document.getElementById('focusai-auth-modal');

        document.getElementById('focusai-auth-close').addEventListener('click', () => authModal.classList.add('hidden'));
        authModal.addEventListener('click', (e) => { if (e.target === authModal) authModal.classList.add('hidden'); });

        document.getElementById('focusai-auth-tab-login').addEventListener('click', () => _setAuthMode('login'));
        document.getElementById('focusai-auth-tab-signup').addEventListener('click', () => _setAuthMode('signup'));
        _setAuthMode('login');

        // Giriş yap / Hesap oluştur
        document.getElementById('focusai-auth-send-btn').addEventListener('click', async () => {
            const email = (document.getElementById('focusai-auth-email').value || '').trim();
            const password = document.getElementById('focusai-auth-password').value || '';
            const status = document.getElementById('focusai-auth-status');
            if (!_validateEmail(email, status)) return;

            // Geliştirici test hesabı (test@gmail.com): şifre istenmeden, gerçek
            // Supabase auth'a hiç dokunmadan yerel test oturumu açar. Kullanıcının
            // kendi isteğiyle eklendi — sadece bu sabit e-posta için çalışır.
            if (_authMode === 'login' && typeof window.__devTestLogin === 'function' && window.__devTestLogin(email)) {
                document.getElementById('focusai-auth-modal').classList.add('hidden');
                return;
            }

            if (_authMode === 'signup') {
                if (!_isStrongPassword(password)) {
                    status.textContent = 'Şifre en az 8 karakter olmalı ve en az bir rakam içermeli.';
                    status.style.color = '#ff4757';
                    return;
                }
            } else if (!password) {
                status.textContent = 'Şifreni gir.';
                status.style.color = '#ff4757';
                return;
            }

            const btn = document.getElementById('focusai-auth-send-btn');
            try {
                if (_authMode === 'signup') {
                    const confirm = document.getElementById('focusai-auth-password-confirm').value || '';
                    if (password !== confirm) {
                        status.textContent = 'Şifreler eşleşmiyor.';
                        status.style.color = '#ff4757';
                        return;
                    }
                    btn.disabled = true;
                    status.textContent = 'Hesap oluşturuluyor...';
                    status.style.color = 'var(--text-muted)';
                    const { data, error } = await window.FocusAuth.signUp(email, password);
                    if (error) throw error;
                    if (data && data.user && !data.session) {
                        status.textContent = 'Hesabını onaylamak için e-postana gönderdiğimiz bağlantıya tıkla.';
                        status.style.color = '#2ed573';
                    }
                    // Oturum döndüyse SIGNED_IN eventi tetiklenecek, modal oradan kapanacak
                } else {
                    btn.disabled = true;
                    status.textContent = 'Giriş yapılıyor...';
                    status.style.color = 'var(--text-muted)';
                    const { error } = await window.FocusAuth.signIn(email, password);
                    if (error) throw error;
                    // SIGNED_IN eventi tetiklenecek, modal oradan kapanacak
                }
            } catch (e) {
                status.textContent = 'Hata: ' + (e.message || 'İşlem başarısız.');
                status.style.color = '#ff4757';
            } finally {
                btn.disabled = false;
            }
        });

        // Şifremi unuttum
        document.getElementById('focusai-auth-forgot-link').addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('focusai-section-form').classList.add('hidden');
            document.getElementById('focusai-section-reset').classList.remove('hidden');
            document.getElementById('focusai-auth-send-btn').classList.add('hidden');
            document.getElementById('focusai-reset-email').value = document.getElementById('focusai-auth-email').value || '';
        });
        document.getElementById('focusai-reset-back-btn').addEventListener('click', () => {
            document.getElementById('focusai-section-reset').classList.add('hidden');
            document.getElementById('focusai-section-form').classList.remove('hidden');
            document.getElementById('focusai-auth-send-btn').classList.remove('hidden');
        });
        document.getElementById('focusai-reset-send-btn').addEventListener('click', async () => {
            const email = (document.getElementById('focusai-reset-email').value || '').trim();
            const status = document.getElementById('focusai-reset-status');
            if (!_validateEmail(email, status)) return;
            const btn = document.getElementById('focusai-reset-send-btn');
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

        // Çıkış yap
        document.getElementById('focusai-auth-signout-btn').addEventListener('click', async () => {
            await window.FocusAuth.signOut();
            authModal.classList.add('hidden');
            _toast('Çıkış yapıldı. Veriler bu cihazda yerel olarak çalışmaya devam ediyor.', 'warning');
            _updateSyncButton();
        });
    }

    // _isStrongPassword/_validateEmail → auth-ui-utils.js

    // ─── Şifre sıfırlama (recovery) modalı ─────────────────────────────────
    function _bindRecoveryModal() {
        document.getElementById('focusai-recovery-save-btn').addEventListener('click', async () => {
            const password = document.getElementById('focusai-recovery-password').value || '';
            const confirm = document.getElementById('focusai-recovery-password-confirm').value || '';
            const status = document.getElementById('focusai-recovery-status');

            if (!_isStrongPassword(password)) {
                status.textContent = 'Şifre en az 8 karakter olmalı ve en az bir rakam içermeli.';
                status.style.color = '#ff4757';
                return;
            }
            if (password !== confirm) {
                status.textContent = 'Şifreler eşleşmiyor.';
                status.style.color = '#ff4757';
                return;
            }

            const btn = document.getElementById('focusai-recovery-save-btn');
            btn.disabled = true;
            try {
                status.textContent = 'Kaydediliyor...';
                status.style.color = 'var(--text-muted)';
                const { error } = await window.FocusAuth.updatePassword(password);
                if (error) throw error;
                document.getElementById('focusai-recovery-modal').classList.add('hidden');
                _toast('Şifren güncellendi. Artık yeni şifrenle giriş yapabilirsin.', 'success');
            } catch (e) {
                status.textContent = 'Hata: ' + (e.message || 'Kaydedilemedi.');
                status.style.color = '#ff4757';
            } finally {
                btn.disabled = false;
            }
        });
    }

    // ─── Profil modalı bağlantıları ────────────────────────────────────────
    let _selectedAvatarColor = AVATAR_COLORS[0].color;

    function _bindProfileModal() {
        const profileModal = document.getElementById('focusai-profile-modal');
        const preview = document.getElementById('focusai-profile-avatar-preview');
        const usernameInput = document.getElementById('focusai-profile-username');
        const displayNameInput = document.getElementById('focusai-profile-displayname');

        // Renk seçimi
        profileModal.querySelectorAll('.avatar-swatch').forEach(btn => {
            btn.style.background = btn.dataset.color;
            btn.style.border = btn.hasAttribute('data-selected') ? '3px solid #fff' : '3px solid transparent';
            btn.addEventListener('click', () => {
                profileModal.querySelectorAll('.avatar-swatch').forEach(b => {
                    b.style.border = '3px solid transparent';
                    b.style.transform = 'scale(1)';
                    b.removeAttribute('data-selected');
                });
                btn.style.border = '3px solid #fff';
                btn.style.transform = 'scale(1.15)';
                btn.setAttribute('data-selected', 'true');
                _selectedAvatarColor = btn.dataset.color;
                preview.style.background = _selectedAvatarColor;
            });
        });

        // Canlı avatar önizleme
        displayNameInput.addEventListener('input', () => {
            const letter = (displayNameInput.value.trim()[0] || '?').toUpperCase();
            preview.textContent = letter;
        });

        // Kullanıcı adı küçük harf + sadece geçerli karakter
        usernameInput.addEventListener('input', () => {
            usernameInput.value = usernameInput.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
        });

        // Kaydet
        document.getElementById('focusai-profile-save-btn').addEventListener('click', async () => {
            const username = usernameInput.value.trim();
            const displayName = displayNameInput.value.trim();
            const status = document.getElementById('focusai-profile-status');

            if (!username || username.length < 3) {
                status.textContent = 'Kullanıcı adı en az 3 karakter olmalı.';
                status.style.color = '#ff4757';
                return;
            }
            if (!displayName) {
                status.textContent = 'Görünen isim boş bırakılamaz.';
                status.style.color = '#ff4757';
                return;
            }

            const btn = document.getElementById('focusai-profile-save-btn');
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Kaydediliyor...';

            try {
                const session = await window.FocusAuth.getSession();
                await window.FocusAuth.updateProfile(session.user.id, {
                    username,
                    display_name: displayName,
                    avatar_color: _selectedAvatarColor,
                });
                profileModal.classList.add('hidden');
                _toast('Profil oluşturuldu! Hoşgeldin ' + displayName + ' 🎉', 'success');
                _updateSyncButton();
                // Veri aktarım sihirbazını aç
                setTimeout(() => _openImportWizard(), 600);
            } catch (e) {
                status.textContent = 'Hata: ' + (e.message || 'Profil kaydedilemedi.');
                status.style.color = '#ff4757';
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-rocket"></i> Başla!';
            }
        });

        // Daha sonra
        document.getElementById('focusai-profile-skip-btn').addEventListener('click', () => {
            profileModal.classList.add('hidden');
            _openImportWizard();
        });
    }

    // ─── Veri aktarım modalı ───────────────────────────────────────────────
    function _bindImportModal() {
        const importModal = document.getElementById('focusai-import-modal');
        document.getElementById('focusai-import-skip-btn').addEventListener('click', () => importModal.classList.add('hidden'));
        document.getElementById('focusai-import-confirm-btn').addEventListener('click', async () => {
            const btn = document.getElementById('focusai-import-confirm-btn');
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Aktarılıyor...';
            try {
                await window.FocusSync.runImportWizard();
                importModal.classList.add('hidden');
                _toast('Verilerin buluta aktarıldı ✓', 'success');
            } catch (e) {
                _toast('Aktarma başarısız: ' + e.message, 'error');
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-check"></i> Aktar';
            }
        });
    }

    // ─── Oturum durumuna göre modal içeriği ───────────────────────────────
    function _renderAuthModalState(session) {
        const signedOut = document.getElementById('focusai-auth-signed-out');
        const signedIn = document.getElementById('focusai-auth-signed-in');
        const sendBtn = document.getElementById('focusai-auth-send-btn');
        const signoutBtn = document.getElementById('focusai-auth-signout-btn');

        if (session && session.user) {
            signedOut.classList.add('hidden');
            signedIn.classList.remove('hidden');
            sendBtn.classList.add('hidden');
            signoutBtn.classList.remove('hidden');
            document.getElementById('focusai-auth-email-label').textContent = session.user.email || '';
            _loadProfileIntoSignedInView(session.user.id);
        } else {
            signedOut.classList.remove('hidden');
            signedIn.classList.add('hidden');
            sendBtn.classList.remove('hidden');
            signoutBtn.classList.add('hidden');
            const status = document.getElementById('focusai-auth-status');
            if (status) status.textContent = '';
        }
    }

    async function _loadProfileIntoSignedInView(userId) {
        if (!window.FocusSupabase) return;
        try {
            const { data } = await window.FocusSupabase.from('profiles').select('display_name,avatar_color,username').eq('id', userId).maybeSingle();
            if (!data) return;
            const avatarEl = document.getElementById('focusai-user-avatar');
            const nameEl = document.getElementById('focusai-user-displayname');
            if (data.display_name) {
                nameEl.textContent = data.display_name;
                avatarEl.textContent = data.display_name[0].toUpperCase();
            } else if (data.username) {
                nameEl.textContent = '@' + data.username;
                avatarEl.textContent = data.username[0].toUpperCase();
            }
            if (data.avatar_color) avatarEl.style.background = data.avatar_color;
        } catch (_) { console.warn('[FocusAI] sessiz hata:', _); }
    }

    function _updateSyncButton() {
        const btn = document.getElementById('btn-sync-account');
        if (!btn) return;
        const enabled = window.FocusSync && window.FocusSync.isEnabled();
        const icon = btn.querySelector('i');
        const label = btn.querySelector('span');
        if (enabled) {
            if (icon) icon.className = 'fa-solid fa-cloud-arrow-up';
            if (label) label.textContent = 'Senkronize';
            btn.title = 'Hesabınla senkronize ediliyor';
        } else {
            if (icon) icon.className = 'fa-solid fa-cloud';
            if (label) label.textContent = 'Hesap';
            btn.title = 'Hesap / Senkronizasyon';
        }
    }

    // _summaryRow → auth-ui-utils.js

    function _openImportWizard() {
        _injectModals();
        if (typeof DataManager === 'undefined' || typeof DataManager.collectAllData !== 'function') return;
        const data = DataManager.collectAllData();
        const eventCount = Object.values(data.events || {}).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);

        const summary = document.getElementById('focusai-import-summary');
        summary.innerHTML = [
            _summaryRow('fa-list-check', 'görev', (data.tasks || []).length),
            _summaryRow('fa-calendar-days', 'takvim etkinliği', eventCount),
            _summaryRow('fa-bullseye', 'ana hedef', (data.goals || []).length),
            _summaryRow('fa-repeat', 'alışkanlık', (data.habits || []).length),
            _summaryRow('fa-book-open', 'günlük girdisi', (data.focusai_journal_entries || []).length),
            _summaryRow('fa-lightbulb', 'fikir', (data.mind_dumps || []).length),
        ].join('');

        document.getElementById('focusai-import-modal').classList.remove('hidden');
    }

    async function _openAuthModal() {
        _injectModals();
        const session = window.FocusAuth ? await window.FocusAuth.getSession() : null;
        _renderAuthModalState(session);
        document.getElementById('focusai-auth-modal').classList.remove('hidden');
    }

    window.FocusAuthUI = { open: _openAuthModal };

    // ─── İlk giriş sonrası profil kurulum kontrolü ─────────────────────────
    async function _checkAndShowProfileSetup(userId) {
        if (!window.FocusSupabase) return false;
        try {
            const { data } = await window.FocusSupabase
                .from('profiles')
                .select('username, display_name, imported_at')
                .eq('id', userId)
                .maybeSingle();
            // Profil kurulmamışsa kurulum modalını göster
            if (data && !data.username) {
                const preview = document.getElementById('focusai-profile-avatar-preview');
                if (preview) preview.textContent = '?';
                document.getElementById('focusai-profile-modal').classList.remove('hidden');
                return true;
            }
            // Kurulu ama veri aktarımı yapılmamışsa aktarım sihirbazını göster
            if (data && !data.imported_at) {
                _openImportWizard();
            }
            return false;
        } catch (e) {
            console.warn('[FocusAuth] profil kontrol hatası:', e.message);
            return false;
        }
    }

    async function _init() {
        _injectModals();

        const syncBtn = document.getElementById('btn-sync-account');
        if (syncBtn) syncBtn.addEventListener('click', _openAuthModal);

        if (!window.FocusAuth) return;

        const session = await window.FocusAuth.getSession();
        _updateSyncButton();

        window.FocusAuth.onAuthChange(async (event, newSession) => {
            _renderAuthModalState(newSession);
            _updateSyncButton();

            if (event === 'PASSWORD_RECOVERY') {
                _injectModals();
                document.getElementById('focusai-auth-modal').classList.add('hidden');
                document.getElementById('focusai-recovery-modal').classList.remove('hidden');
                return;
            }

            if (event === 'SIGNED_IN' && newSession && newSession.user) {
                const authModal = document.getElementById('focusai-auth-modal');
                if (authModal) authModal.classList.add('hidden');
                _toast('Giriş yapıldı!', 'success');

                await window.FocusSync.pullAll();
                await _checkAndShowProfileSetup(newSession.user.id);
            }
        });

        if (session && session.user) {
            await window.FocusSync.pullAll();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _init);
    } else {
        _init();
    }
})();

export function openAuthModal() { window.FocusAuthUI.open(); }
