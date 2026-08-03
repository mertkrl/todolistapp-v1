// social-friend-search.js
// social.js'ten çıkarıldı (Faz E — çekirdek bölge derin taraması, son tur,
// 2026-07-23): "Kişi Ekle" modalındaki arkadaş arama akışı (doFriendSearch).
// Tek çağıran noktası vardı (Enter tuşu / arama butonu), currentUser'ı
// sadece OKUYOR, hiç mutasyon yok. Tamamen izole.
//
// Dış bağımlılıklar: getCurrentUser(), window.showPremiumModal (window.*
// üzerinden — showPremiumModal script.js'te tanımlı ve bu loader'dan önce
// yüklenir). searchUser/getFriends/sendFriendRequest/removeFriend
// (social-friends-notifications.js), isBlockedEitherWay (social-block-users.js)
// ve avatarImgHtml/_escapeHtml (social-avatar-utils.js/social.js) artık
// gerçek import — Faz H (2026-07-27): loader sırası bu 3 üretici dosyayı
// bu tüketiciden ÖNCEYE alacak şekilde düzenlendi.
import { searchUser, getFriends, sendFriendRequest, removeFriend } from './social-friends-notifications.js';
import { isBlockedEitherWay } from './social-block-users.js';
import { avatarImgHtml } from './social-avatar-utils.js';
import { _escapeHtml } from './social.js';
import { getCurrentUser } from './state/current-user-store.js';

(function () {
'use strict';

    async function doFriendSearch() {
        const username = document.getElementById('add-friend-input')?.value?.trim();
        if (!username) return;
        const resultEl = document.getElementById('add-friend-result');
        if (!resultEl) return;

        resultEl.innerHTML = '<p class="u-font-size-13px_color-var-text-muted"><i class="fa-solid fa-spinner fa-spin"></i> Aranıyor...</p>';

        const user = await searchUser(username);

        if (!user) {
            resultEl.innerHTML = `<p class="u-color-hff4757_font-size-13px"><i class="fa-solid fa-circle-xmark"></i> "@${_escapeHtml(username)}" bulunamadı.</p>`;
            return;
        }
        if (username === getCurrentUser()?.username) {
            resultEl.innerHTML = `<p class="u-color-hff9f43_font-size-13px-2">Kendinizi ekleyemezsiniz 😄</p>`;
            return;
        }
        if (isBlockedEitherWay(username)) {
            resultEl.innerHTML = `<p class="u-color-hff4757_font-size-13px"><i class="fa-solid fa-circle-xmark"></i> "@${_escapeHtml(username)}" bulunamadı.</p>`;
            return;
        }

        const isFriend = getFriends().includes(username);
        resultEl.innerHTML = `
            <div class="u-display-flex_align-items-center_justify-content-space-betw-5">
                <div class="u-display-flex_align-items-center_gap-12px">
                    ${avatarImgHtml(user, 44)}
                    <div>
                        <div class="u-font-weight-600_color-hfff-2">${_escapeHtml(user.displayName)}</div>
                        <div class="si-muted-sm">@${_escapeHtml(username)} · ${user.xp || 0} XP · ${user.online ? '<span class="si-green">Çevrimiçi</span>' : 'Çevrimdışı'}</div>
                    </div>
                </div>
                ${isFriend
                    ? `<button id="af-remove-btn" data-username="${_escapeHtml(username)}" class="control-btn secondary u-color-hff4757_border-color-rgba25571870p3_font-size-12px_p" >
                           <i class="fa-solid fa-user-minus"></i> Kaldır
                       </button>`
                    : `<button id="af-add-btn" data-username="${_escapeHtml(username)}" class="primary-btn u-font-size-12px_padding-6px14px" >
                           <i class="fa-solid fa-user-plus"></i> Ekle
                       </button>`}
            </div>`;

            document.getElementById('af-add-btn')?.addEventListener('click', async (e) => {
                const targetUser = e.currentTarget.dataset.username;
                const btn = document.getElementById('af-add-btn');
                if (btn) {
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> İstek Gidiyor...';
                }
                
                const res = await sendFriendRequest(targetUser);
                if (res.success) {
                    document.getElementById('add-friend-modal')?.classList.add('hidden');
                    if (typeof window.showPremiumModal === 'function') {
                        window.showPremiumModal({ title: '📨 İstek Gönderildi!', message: `${user.displayName} kullanıcısına arkadaşlık isteği gönderildi. Onayladığında arkadaş olacaksınız.`, type: 'success' });
                    }
                } else {
                    if (typeof window.showPremiumModal === 'function') {
                        window.showPremiumModal({ title: 'Bir Sorun Oluştu', message: res.error || 'İstek gönderilirken bir hata oluştu. Lütfen tekrar dene.', type: 'warning' });
                    }
                    if (btn) { btn.disabled = false; btn.innerHTML = 'Ekle'; }
                }
            });

        document.getElementById('af-remove-btn')?.addEventListener('click', e => {
            removeFriend(e.currentTarget.dataset.username);
            resultEl.innerHTML = `<p class="u-color-h2ed573_font-size-13px"><i class="fa-solid fa-check"></i> Arkadaşlıktan çıkarıldı.</p>`;
        });
    }
    window.doFriendSearch = doFriendSearch;

})();
