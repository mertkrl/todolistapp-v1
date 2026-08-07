// social-gamification.js'ten çıkarıldı: Grup İçi Mini-Turnuva (premium özellik, 062).
// Kendi kapsamında tamamen izole — XP/lig/sezon/seri state'ine hiç dokunmuyor,
// sadece window.FocusSupabase/window.dcShowToast/window.dcChatEnabled/
// window.avatarImgHtml/window._escapeHtml'e bağımlı.

// Haftalık grup hedefinin yanına, kısa süreli (1-14 gün) isteğe bağlı bir
// "kim önde bitirecek" yarışması. Başlatma premium/kurumsal ile sınırlı
// (dcChatEnabled() sunucudaki aynı plan kontrolüyle örtüşüyor — bkz. 062
// migration); katılım grubun tüm üyelerine açık. Sunucu bitiş zamanı
// geçince lazy olarak sonuçlandırır (diğer lig/sezon/düello desenleriyle aynı).
export async function renderGroupTournament(groupId) {
        const el = document.getElementById('group-tournament-card');
        if (!el || !groupId || !window.FocusSupabase) { if (el) el.innerHTML = ''; return; }
        try {
            const { data, error } = await window.FocusSupabase.rpc('get_group_tournament', { p_group_id: groupId });
            if (error || !data || data.status === 'no_access') { el.innerHTML = ''; return; } // 062 uygulanmadıysa sessizce gizli

            const canStart = typeof window.dcChatEnabled === 'function' && window.dcChatEnabled();

            if (data.status === 'none') {
                el.innerHTML = `
                    <div class="glass-panel u-padding-14px_border-1pxsolidrgba255159670p18_border-radius" >
                        <h3 class="u-font-size-14px_margin-006px_color-hfff"><i class="fa-solid fa-trophy u-color-hfeca57" ></i> Mini Turnuva</h3>
                        <p class="si-muted-sm u-margin-0010px" >Grubun içinde kısa süreli bir XP yarışması başlat — kim önde bitirecek?</p>
                        ${canStart
                            ? `<div class="u-display-flex_gap-6px">
                                 <button class="control-btn secondary btn-md" data-gt-start="3">3 Gün</button>
                                 <button class="control-btn secondary btn-md" data-gt-start="7">7 Gün</button>
                               </div>`
                            : `<span class="u-font-size-11p5px_color-var-text-muted"><i class="fa-solid fa-lock"></i> Turnuva başlatmak Premium/Kurumsal özelliği — katılım herkese açık kalacak.</span>`}
                    </div>`;
                el.querySelectorAll('[data-gt-start]').forEach(b => b.addEventListener('click', () => _startGroupTournament(groupId, parseInt(b.dataset.gtStart, 10))));
                return;
            }

            const rows = (data.rows || []).slice().sort((a, b) => (b.rank_xp || 0) - (a.rank_xp || 0));
            const topXp = Math.max(rows[0]?.rank_xp || 0, 1);
            const finished = data.tournament_status === 'finished';
            const daysLeft = !finished ? Math.max(0, Math.ceil((new Date(data.ends_at).getTime() - Date.now()) / 86400000)) : 0;

            const rowsHtml = rows.map((r, i) => {
                const xp = r.rank_xp || 0;
                const pct = Math.max(2, Math.round((xp / topXp) * 100));
                const isWinner = finished && r.user_id === data.winner_id;
                return `
                    <li class="lb-row${r.is_me ? ' lb-row--me' : ''}">
                        <span class="lb-rank">${isWinner ? '👑' : i + 1}</span>
                        ${window.avatarImgHtml({ displayName: r.display_name, username: r.username, avatarColor: r.avatar_color, customAvatar: r.custom_avatar, avatarInitials: r.avatar_initials || null }, 28, 'flex-shrink:0;')}
                        <div class="lb-main">
                            <div class="lb-name-line">
                                <span class="lb-name">${window._escapeHtml(r.display_name || r.username)}${r.is_me ? '<span class="lb-me-tag"> (Sen)</span>' : ''}</span>
                                <span class="lb-xp">${xp} XP</span>
                            </div>
                            <div class="lb-bar"><div class="lb-bar-fill${r.is_me ? ' lb-bar-fill--me' : ''}" data-w="${pct}"></div></div>
                        </div>
                    </li>`;
            }).join('');

            const joinBtn = (!finished && !data.i_joined)
                ? `<button class="control-btn secondary btn-md u-margin-top-8px" data-gt-join="${data.tournament_id}" >Turnuvaya Katıl</button>`
                : '';

            el.innerHTML = `
                <div class="glass-panel u-padding-14px_border-1pxsolidrgba255159670p18_border-radius" >
                    <h3 class="u-font-size-14px_margin-004px_color-hfff_display-flex_align-">
                        <span><i class="fa-solid fa-trophy u-color-hfeca57" ></i> Mini Turnuva</span>
                        <small class="u-color-var-text-muted_font-weight-600">${finished ? 'Bitti' : `${daysLeft} gün kaldı`}</small>
                    </h3>
                    ${finished ? `<p class="si-muted-sm u-margin-008px" >🎉 ${window._escapeHtml(rows.find(r => r.user_id === data.winner_id)?.display_name || rows.find(r => r.user_id === data.winner_id)?.username || 'Biri')} turnuvayı kazandı!</p>` : ''}
                    <ul class="u-list-style-none_display-flex_flex-direction-column_gap-8px">${rowsHtml}</ul>
                    ${joinBtn}
                    ${finished && canStart ? `<button class="control-btn secondary btn-md u-margin-top-8px" data-gt-start="3" >Yeni Turnuva Başlat (3 Gün)</button>` : ''}
                </div>`;

            el.querySelectorAll('.lb-bar-fill').forEach(fill => {
                fill.style.width = fill.dataset.w + '%';
            });

            el.querySelectorAll('[data-gt-join]').forEach(b => b.addEventListener('click', () => _joinGroupTournament(groupId, b.dataset.gtJoin)));
            el.querySelectorAll('[data-gt-start]').forEach(b => b.addEventListener('click', () => _startGroupTournament(groupId, parseInt(b.dataset.gtStart, 10))));
        } catch (e) { console.warn('[Mini Turnuva] yükleme hatası', e); el.innerHTML = ''; }
    }
    window.renderGroupTournament = renderGroupTournament;

    async function _startGroupTournament(groupId, days) {
        if (!window.FocusSupabase) return;
        const { data, error } = await window.FocusSupabase.rpc('start_group_tournament', { p_group_id: groupId, p_days: days || 3 });
        if (error || !data?.ok) {
            const err = data?.error;
            window.dcShowToast?.(
                err === 'premium_required' ? 'Turnuva başlatmak Premium/Kurumsal özelliği.' :
                err === 'already_active' ? 'Bu grupta zaten aktif bir turnuva var.' :
                'Turnuva başlatılamadı.'
            );
            return;
        }
        window.dcShowToast?.('Mini turnuva başladı! 🏆');
        renderGroupTournament(groupId);
    }

    async function _joinGroupTournament(groupId, tournamentId) {
        if (!window.FocusSupabase || !tournamentId) return;
        const { data, error } = await window.FocusSupabase.rpc('join_group_tournament', { p_tournament_id: tournamentId });
        if (error || !data?.ok) { window.dcShowToast?.('Katılınamadı.'); return; }
        window.dcShowToast?.('Turnuvaya katıldın! ⚔️');
        renderGroupTournament(groupId);
    }
