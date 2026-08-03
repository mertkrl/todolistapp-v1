// social-dc-message-cards.js
// social.js'ten çıkarıldı (Faz E — riskli bölge denemesi, 2026-07-23):
// sohbet çekirdeğinin (renderDcMessage) özel kart/sistem mesajı render
// alt-fonksiyonları — bunlar renderDcMessage'ın en başında tip bazlı
// early-return olarak çağrılıyor (renderDcMessage'ın kendisi HÂLÂ social.js'te,
// dokunulmadı), her biri kendi konteynerini dolduran BAĞIMSIZ render
// fonksiyonları: _renderDcCwRoomInviteCard (Ortak Odaklanma davet kartı),
// _renderDcSystemJoinCard/_renderDcSystemNotice/_renderDcRoleChangeNotice.
//
// Dış bağımlılıklar (window.* üzerinden): window._escapeHtml,
// window.avatarImgHtml, window._cwGetLinkedHabit,
// window.enterCWRoom, window.openSharedFocusOverlay (YENİ export edildi),
// window.FocusSupabase. currentRoomId artık state/cw-current-room-store.js'ten
// gerçek import ile okunuyor.
import { getCurrentRoomId } from './state/cw-current-room-store.js';

    // ─── MESAJ RENDER ────────────────────────────────────
    // Sunucuya yeni katılan üye için özel görünümlü karşılama kartı — renderDcMessage'tan ayrıldı
    // Grup/kanal sohbetine gönderilen "birlikte odaklan" davet kartı — davet
    // eden zaten oda kurmuştur (bkz. dc-chat-focus-invite-btn), kart yalnızca
    // aynı cw_rooms odasına katılma kısayolu sağlar.
export function _renderDcCwRoomInviteCard(container, m, msgKey) {
        const inv = m.cwInvite || {};
        // Mesajlar kronolojik sırayla senkron render edildiği için satırın
        // yerini şimdi ayırıyoruz; asıl içerik (ve "hâlâ geçerli mi?" kontrolü)
        // aşağıda async olarak dolduruluyor/kaldırılıyor.
        const card = document.createElement('div');
        card.style.display = 'none';
        container.appendChild(card);

        if (!inv.roomId || !window.FocusSupabase) { card.remove(); return; }

        let pollTimer = null;
        const stopPolling = () => { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } };
        const removeInvite = () => {
            stopPolling();
            card.remove();
            if (msgKey) window.FocusSupabase.from('messages').delete().eq('id', msgKey).then(() => {});
        };

        const checkAndRender = (attempt) => {
            window.FocusSupabase.rpc('get_cw_room_invite_status', { p_room_id: inv.roomId }).then(({ data, error }) => {
                if (error) throw error;
                const found = !!data?.found;
                const active = !!data?.active;
                const c = data?.count || 0;
                const roomAgeMs = data?.created_at ? (Date.now() - new Date(data.created_at).getTime()) : Infinity;
                const heartbeatAgeMs = data?.last_seen_at ? (Date.now() - new Date(data.last_seen_at).getTime()) : Infinity;
                // Oda az önce kurulduysa (host'un cw_room_members satırı henüz
                // yazılıyor olabilir) hemen "kimse yok" deyip silmek yerine
                // birkaç kez kısa aralıklarla tekrar dene.
                if (found && active && c < 1 && roomAgeMs < 6000 && attempt < 4) {
                    setTimeout(() => checkAndRender(attempt + 1), 1200);
                    return;
                }
                // Oda artık aktif değilse (bitmiş/başlamış), kimse yoksa (herkes
                // ayrılmış) ya da hard refresh/sekme kapatma yüzünden heartbeat
                // uzun süredir gelmiyorsa ("hayalet" oda) — davet artık
                // geçersizdir, kartı göstermeyip mesajı da sohbetten temizle.
                if (!found || !active || c < 1 || heartbeatAgeMs > 40000) {
                    if (!document.body.contains(card)) return; // zaten kaldırılmış (silme yarışı)
                    removeInvite();
                    return;
                }

                if (!card.dataset.rendered) {
                    card.dataset.rendered = '1';
                    card.style.display = 'flex';
                    card.style.alignItems = 'center';
                    card.style.gap = '12px';
                    card.style.margin = '10px 0';
                    card.style.padding = '12px 16px';
                    card.style.background = 'linear-gradient(135deg, rgba(255,159,67,0.14), rgba(108,92,231,0.08))';
                    card.style.border = '1px solid rgba(255,159,67,0.3)';
                    card.style.borderRadius = '12px';
                    card.innerHTML = `
                        <div class="u-font-size-24px_line-height-1_flex-shrink-0">⚡</div>
                        <div class="si-min0 u-flex-1" >
                            <div class="u-font-size-13p5px_color-hfff">
                                <span class="u-font-weight-700">${window._escapeHtml(m.displayName || m.username || '')}</span>
                                <span class="si-muted"> birlikte odaklanma daveti gönderdi</span>
                            </div>
                            <div class="u-font-size-11p5px_color-var-text-muted_margin-top-2px"><i class="fa-solid fa-user-group u-font-size-10px" ></i> <span class="cw-invite-count-num">${c}</span> kişi odada · katılmak ister misin?</div>
                        </div>
                        <button class="cw-invite-join-btn u-flex-shrink-0_background-var-dc-accentha29bfe_color-hfff_b" >Katıl</button>
                    `;
                    card.querySelector('.cw-invite-join-btn').addEventListener('click', () => {
                        if (!inv.roomId) return;
                        if (getCurrentRoomId() === inv.roomId) {
                            if (typeof window.openSharedFocusOverlay === 'function') window.openSharedFocusOverlay(window._cwGetLinkedHabit(), inv.hostName);
                            return;
                        }
                        if (typeof window.enterCWRoom === 'function') window.enterCWRoom(inv.roomId, inv.hostName, inv.hostColor, null, false, inv.minutes || 25);
                    });
                    // Kart görünürken kişi sayısını canlı tutmak için periyodik
                    // olarak durumu tekrar sorgula (RLS bypass eden RPC üzerinden).
                    pollTimer = setInterval(() => {
                        if (!document.body.contains(card)) { stopPolling(); return; }
                        checkAndRender(0);
                    }, 5000);
                } else {
                    const countEl = card.querySelector('.cw-invite-count-num');
                    if (countEl) countEl.textContent = c;
                }
            }).catch(() => { removeInvite(); });
        };
        checkAndRender(0);
    }

    window._renderDcCwRoomInviteCard = _renderDcCwRoomInviteCard;

export function _renderDcSystemJoinCard(container, m) {
        const welcomeEmojis = ['👋', '🎉', '🚀', '✨', '🌟'];
        const emoji = welcomeEmojis[Math.abs((m.username || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % welcomeEmojis.length];
        const card = document.createElement('div');
        card.style.display = 'flex';
        card.style.alignItems = 'center';
        card.style.gap = '12px';
        card.style.margin = '10px 0';
        card.style.padding = '12px 16px';
        card.style.background = 'linear-gradient(135deg, rgba(108,92,231,0.12), rgba(46,213,115,0.08))';
        card.style.border = '1px solid rgba(108,92,231,0.25)';
        card.style.borderRadius = '12px';
        card.innerHTML = `
            <div class="u-font-size-24px_line-height-1_flex-shrink-0">${emoji}</div>
            ${window.avatarImgHtml({ displayName: m.displayName, avatarColor: m.avatarColor, customAvatar: m.customAvatar, username: m.username }, 36)}
            <div class="si-min0">
                <div class="u-font-size-13p5px_color-hfff">
                    <span class="u-font-weight-700">${window._escapeHtml(m.displayName || m.username || '')}</span>
                    <span class="si-muted"> sunucuya katıldı!</span>
                </div>
                <div class="u-font-size-11p5px_color-var-text-muted_margin-top-2px">Aramıza hoş geldin 🎊 #genel üzerinden tanışabilirsin.</div>
            </div>
        `;
        container.appendChild(card);
    }

    window._renderDcSystemJoinCard = _renderDcSystemJoinCard;

    // Sistem mesajı (katılım/ayrılma bildirimleri) — renderDcMessage'tan ayrıldı
export function _renderDcSystemNotice(container, m) {
        const sysRow = document.createElement('div');
        sysRow.style.display = 'flex';
        sysRow.style.alignItems = 'center';
        sysRow.style.justifyContent = 'center';
        sysRow.style.gap = '8px';
        sysRow.style.padding = '6px 0';
        sysRow.innerHTML = `
            <span class="u-flex-1_height-1px_background-rgba2552552550p07"></span>
            <span class="u-font-size-11px_color-rgba2552552550p35_white-space-nowrap_">
                ${m.type === 'system_join' ? '<i class="fa-solid fa-arrow-right-to-bracket u-color-h2ed573_margin-right-4px" ></i>' : '<i class="fa-solid fa-arrow-right-from-bracket u-color-hff7675_margin-right-4px" ></i>'}
                ${window._escapeHtml(m.text)}
            </span>
            <span class="u-flex-1_height-1px_background-rgba2552552550p07"></span>
        `;
        container.appendChild(sysRow);
    }

    window._renderDcSystemNotice = _renderDcSystemNotice;

    // Sistem mesajı (rol terfi/düşürme bildirimi) — renderDcMessage'tan ayrıldı
export function _renderDcRoleChangeNotice(container, m) {
        const isPromote = m.type === 'system_promote';
        const accent = isPromote ? '#ffd166' : '#ff7675';
        const bg = isPromote ? 'rgba(255, 209, 102, 0.08)' : 'rgba(255, 118, 117, 0.08)';
        const icon = isPromote ? 'fa-solid fa-arrow-trend-up' : 'fa-solid fa-arrow-trend-down';
        const sysRow = document.createElement('div');
        sysRow.style.display = 'flex';
        sysRow.style.alignItems = 'center';
        sysRow.style.justifyContent = 'center';
        sysRow.style.gap = '8px';
        sysRow.style.padding = '8px 0';
        sysRow.innerHTML = `
            <span class="dc-role-change-badge u-display-inline-flex_align-items-center_gap-8px_font-size-1" >
                <i class="${icon}"></i>
                ${window._escapeHtml(m.text)}
            </span>
        `;
        const badgeEl = sysRow.querySelector('.dc-role-change-badge');
        badgeEl.style.color = accent;
        badgeEl.style.background = bg;
        badgeEl.style.border = `1px solid ${accent}33`;
        container.appendChild(sysRow);
    }
    window._renderDcRoleChangeNotice = _renderDcRoleChangeNotice;

