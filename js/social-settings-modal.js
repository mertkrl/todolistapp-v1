// social-settings-modal.js
// social.js'ten çıkarıldı (Faz E, 2026-07-23): Genel Ayarlar modalı — tema/
// bildirim/gizlilik/dil ayarları + engellenen kullanıcılar listesi girişi.
// Tamamen izole: sadece localStorage + kendi DOM'u üzerinden çalışır,
// paylaşılan mesaj/oda/odak state'ine dokunmuyor. Tek çağıran nokta zaten
// social-dc-init.js'te window.openSettingsModal(user) olarak kullanılıyor.
//
// renderBlockedUsersSettings (social-block-users.js) ve
// requestDesktopNotificationPermission (social-notif-sounds.js) artık gerçek
// import — Faz H (2026-07-27): loader sırası bu 2 üretici dosyayı bu
// tüketiciden ÖNCEYE alacak şekilde düzenlendi. showFocusaiToast için
// hâlâ üretici dosya yok (window.* guard'ı hep false döner, dokunulmadı).
import { renderBlockedUsersSettings } from './social-block-users.js';
import { requestDesktopNotificationPermission } from './social-notif-sounds.js';

(function () {
'use strict';

    function openSettingsModal(user) {
        document.getElementById('focusai-settings-modal')?.remove();

        const savedTheme   = localStorage.getItem('focusai_theme')   || 'dark';
        const savedNotif   = localStorage.getItem('focusai_notif_sound') !== 'false';
        const savedChatNotif = localStorage.getItem('focusai_chat_notif_sound') !== 'false';
        const savedLang    = localStorage.getItem('focusai_lang')     || 'tr';
        const savedPrivacy = localStorage.getItem('focusai_privacy')  || 'everyone';

        const modal = document.createElement('div');
        modal.id = 'focusai-settings-modal';
        modal.className = 'modal-overlay';
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.style.zIndex = '10100';
        modal.innerHTML = `
          <div class="settings-modal-box" id="focusai-settings-box">
            <div class="settings-modal-header">
              <span><i class="fa-solid fa-sliders"></i> Ayarlar</span>
              <button class="settings-modal-close" id="settings-close-btn" aria-label="Kapat"><i class="fa-solid fa-xmark"></i></button>
            </div>

            <div class="settings-sections">

              <div class="settings-section">
                <div class="settings-section-title"><i class="fa-solid fa-palette"></i> Görünüm</div>
                <div class="settings-row">
                  <label class="settings-label">Tema</label>
                  <div class="settings-theme-btns">
                    <button class="settings-theme-btn ${savedTheme === 'dark' ? 'active' : ''}" data-theme="dark">
                      <i class="fa-solid fa-moon"></i> Koyu
                    </button>
                    <button class="settings-theme-btn ${savedTheme === 'light' ? 'active' : ''}" data-theme="light">
                      <i class="fa-solid fa-sun"></i> Açık
                    </button>
                  </div>
                </div>
              </div>

              <div class="settings-section">
                <div class="settings-section-title"><i class="fa-solid fa-bell"></i> Bildirimler</div>
                <div class="settings-row">
                  <label class="settings-label">Bildirim Sesi</label>
                  <label class="settings-toggle">
                    <input type="checkbox" id="settings-notif-toggle" ${savedNotif ? 'checked' : ''}>
                    <span class="settings-toggle-track"></span>
                  </label>
                </div>
                <div class="settings-row">
                  <label class="settings-label">Sohbet Mesajı Bildirimi</label>
                  <label class="settings-toggle">
                    <input type="checkbox" id="settings-chat-notif-toggle" ${savedChatNotif ? 'checked' : ''}>
                    <span class="settings-toggle-track"></span>
                  </label>
                </div>
                <div class="u-font-size-11px_color-var-text-muted_margin-top-4px">Gruptan veya özelden yeni bir mesaj geldiğinde sesli ve masaüstü bildirim alırsın.</div>
              </div>

              <div class="settings-section">
                <div class="settings-section-title"><i class="fa-solid fa-lock"></i> Gizlilik</div>
                <div class="settings-row">
                  <label class="settings-label">Profil Görünürlüğü</label>
                  <select class="settings-select" id="settings-privacy-select">
                    <option value="everyone"  ${savedPrivacy === 'everyone'  ? 'selected' : ''}>Herkes</option>
                    <option value="friends"   ${savedPrivacy === 'friends'   ? 'selected' : ''}>Sadece Arkadaşlar</option>
                    <option value="nobody"    ${savedPrivacy === 'nobody'    ? 'selected' : ''}>Kimse</option>
                  </select>
                </div>
              </div>

              <div class="settings-section">
                <div class="settings-section-title"><i class="fa-solid fa-ban"></i> Engellenen Kullanıcılar</div>
                <div id="settings-blocked-list" class="settings-blocked-list">
                  <div class="u-font-size-12px_color-var-text-muted_padding-6px0">Yükleniyor...</div>
                </div>
              </div>

              <div class="settings-section">
                <div class="settings-section-title"><i class="fa-solid fa-globe"></i> Dil</div>
                <div class="settings-row">
                  <label class="settings-label">Arayüz Dili</label>
                  <select class="settings-select" id="settings-lang-select">
                    <option value="tr" ${savedLang === 'tr' ? 'selected' : ''}>Türkçe</option>
                    <option value="en" ${savedLang === 'en' ? 'selected' : ''}>English</option>
                  </select>
                </div>
              </div>

            </div>

            <div class="settings-modal-footer">
              <button class="control-btn secondary" id="settings-cancel-btn">İptal</button>
              <button class="control-btn" id="settings-save-btn"><i class="fa-solid fa-floppy-disk"></i> Kaydet</button>
            </div>
          </div>
        `;

        document.body.appendChild(modal);
        requestAnimationFrame(() => modal.querySelector('#focusai-settings-box').classList.add('settings-modal-box--open'));

        renderBlockedUsersSettings();

        const closeModal = () => {
            const box = modal.querySelector('#focusai-settings-box');
            box.classList.remove('settings-modal-box--open');
            setTimeout(() => modal.remove(), 220);
        };

        modal.querySelector('#settings-close-btn').addEventListener('click', closeModal);
        modal.querySelector('#settings-cancel-btn').addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

        modal.querySelectorAll('.settings-theme-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                modal.querySelectorAll('.settings-theme-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        modal.querySelector('#settings-save-btn').addEventListener('click', () => {
            const theme     = modal.querySelector('.settings-theme-btn.active')?.dataset.theme || 'dark';
            const notif     = modal.querySelector('#settings-notif-toggle').checked;
            const chatNotif = modal.querySelector('#settings-chat-notif-toggle').checked;
            const privacy   = modal.querySelector('#settings-privacy-select').value;
            const lang      = modal.querySelector('#settings-lang-select').value;

            localStorage.setItem('focusai_theme', theme);
            localStorage.setItem('focusai_notif_sound', notif);
            localStorage.setItem('focusai_chat_notif_sound', chatNotif);
            localStorage.setItem('focusai_privacy', privacy);
            localStorage.setItem('focusai_lang', lang);

            // Sohbet bildirimleri açıldıysa masaüstü bildirim izni iste
            if (chatNotif) {
                requestDesktopNotificationPermission();
            }

            // Tema uygula
            if (theme === 'light') document.body.classList.add('light-theme');
            else document.body.classList.remove('light-theme');

            closeModal();
            if (typeof window.showFocusaiToast === 'function') {
                window.showFocusaiToast('Ayarlar kaydedildi.', 'success');
            }
        });
    }
    window.openSettingsModal = openSettingsModal; // social-dc-init.js gibi ayrı script scope'larından erişim için

})();
