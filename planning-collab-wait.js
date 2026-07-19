// ─── ORTAKLAŞA HEDEF — DAVET BEKLEME EKRANI ────────────────────────────
// planning.js dosyasından çıkarıldı (Faz 2, 2026-07-19 — yüksek risk grubu).
// Bir hedef "ortaklaşa" modda oluşturulunca (bkz. planning-quick-create.js
// _qcStartCollab), arkadaş listesinden davet gönderip kabul bekleme ekranı.
//
// Dış bağımlılıklar (hepsi planning.js'te kalıyor, window.* köprüsüyle
// açıldı/zaten açıktı):
// - goals → window._pgGetGoals() (referans — findIndex/splice/delete
//   çalışır)
// - persistGoals, render, toast, openPlanView, esc, uid (kullanılmıyor
//   burada — DOM dataset "uid" değişkeni farklı, planning.js'in uid()
//   fonksiyonuyla alakasız) → window.*
// - window.getFriendsForFilter / window.getCommunityPresenceState /
//   window.FocusSupabase / window.PlanningCollab / window.currentUser →
//   zaten global
let _collabWaitPollTimer = null;
let _collabWaitGoal      = null;
let _collabInviteStatus  = {};
// username → { displayName, color } cache (davet sırasında doldurulur)
let _cwFriendCache = {};

function _openCollabWaitOverlay(goal) {
    const overlay = document.getElementById('pg-collab-wait-overlay');
    if (!overlay) return;

    _collabWaitGoal     = goal;
    _collabInviteStatus = {};
    _cwFriendCache      = {};

    // Goal title
    const titleEl = document.getElementById('pg-cw-goal-title');
    if (titleEl) titleEl.textContent = '"' + goal.title + '"';

    // Fallback code (copy button)
    const codeEl  = document.getElementById('pg-cw-invite-code');
    if (codeEl) codeEl.textContent = goal.invite_code || '—';
    const copyBtn = document.getElementById('pg-cw-copy-btn');
    if (copyBtn) {
        copyBtn.onclick = () => {
            const url = window.location.href.split('?')[0] + '?collab_invite=' + goal.invite_code;
            navigator.clipboard?.writeText(url).catch(() => navigator.clipboard?.writeText(goal.invite_code));
            copyBtn.innerHTML = '<i class="ti ti-check"></i> Kopyalandı!';
            setTimeout(() => { copyBtn.innerHTML = '<i class="ti ti-copy"></i> Kopyala'; }, 2500);
        };
    }

    // Cancel — pending hedefi ve collab odasını temizle
    const cancelBtn = document.getElementById('pg-cw-cancel-btn');
    if (cancelBtn) cancelBtn.onclick = () => {
        const g = _collabWaitGoal;
        if (g) {
            // Collab odasını kapat
            if (g.collab_room_id) {
                window.PlanningCollab?.disableCollab?.(g.id, g.collab_room_id);
            }
            // Pending hedefi listeden sil
            const goals = window._pgGetGoals();
            const idx = goals.findIndex(x => x.id === g.id);
            if (idx !== -1) goals.splice(idx, 1);
            window.persistGoals();
        }
        _closeCollabWaitOverlay();
    };

    overlay.classList.remove('hidden');

    // Load friends list
    _collabWaitLoadFriends(goal);

    // Poll every 3 s for accepted members
    clearInterval(_collabWaitPollTimer);
    _collabWaitPollTimer = setInterval(() => _collabWaitRefreshAccepted(goal), 3000);
}
window._openCollabWaitOverlay = _openCollabWaitOverlay;

function _closeCollabWaitOverlay() {
    clearInterval(_collabWaitPollTimer);
    _collabWaitPollTimer = null;
    _collabWaitGoal      = null;
    document.getElementById('pg-collab-wait-overlay')?.classList.add('hidden');
}
window._closeCollabWaitOverlay = _closeCollabWaitOverlay;

// Renk üretici — username'den deterministik renk
function _cwAvatarColor(str) {
    const palette = ['#7c6eff','#ef476f','#06d6a0','#ffd166','#ff9f43','#a78bfa','#60a5fa','#f97316'];
    let h = 0;
    for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
    return palette[Math.abs(h) % palette.length];
}
window._cwAvatarColor = _cwAvatarColor;

async function _collabWaitLoadFriends(goal) {
    const listEl = document.getElementById('pg-cw-friends-list');
    if (!listEl) return;

    const friends = (window.getFriendsForFilter?.() || []);

    if (!friends.length) {
        listEl.innerHTML = '<p class="pg-cw-empty">Henüz arkadaşın yok. Aşağıdaki kodu paylaşabilirsin.</p>';
        const fallback = document.getElementById('pg-cw-code-fallback');
        if (fallback) fallback.style.display = '';
        return;
    }

    listEl.innerHTML = `<div class="pg-cw-loading"><span class="pg-cw-pulse-dot"></span> Profiller yükleniyor…</div>`;

    // Supabase'den profilleri çek
    let profileMap = {}; // username → profile
    if (window.FocusSupabase) {
        try {
            const { data } = await window.FocusSupabase
                .from('profiles')
                .select('id, username, display_name, avatar_color, custom_avatar')
                .in('username', friends);
            (data || []).forEach(p => { profileMap[p.username] = p; });
        } catch (_) { console.warn('[FocusAI] sessiz hata:', _); }
    }

    // Online presence bilgisi
    const presenceState = window.getCommunityPresenceState?.() || {};
    const onlineUsernames = new Set(
        Object.values(presenceState).flatMap(arr => arr).map(u => u.username).filter(Boolean)
    );

    listEl.innerHTML = friends.map(username => {
        const p        = profileMap[username] || {};
        const displayName = p.display_name || username;
        const color    = p.avatar_color ? (p.avatar_color.startsWith('#') ? p.avatar_color : '#' + p.avatar_color) : _cwAvatarColor(username);
        // Cache'e kaydet — waiting list'te gösterilmek için
        _cwFriendCache[username] = { displayName, color };
        const initials = displayName.slice(0, 2).toUpperCase();
        const isOnline = onlineUsernames.has(username);
        const uid      = p.id || '';
        const hasCustomAvatar = !!p.custom_avatar;

        return `
        <div class="pg-cw-friend-row" data-username="${window.esc(username)}" data-uid="${window.esc(uid)}">
            <div class="pg-cw-friend-avatar-wrap">
                ${hasCustomAvatar
                    ? `<img src="${window.esc(p.custom_avatar)}" class="pg-cw-friend-avatar-img" alt="${window.esc(displayName)}">`
                    : `<div class="pg-cw-friend-avatar" style="background:${window.esc(color)};">${window.esc(initials)}</div>`}
                ${isOnline ? '<span class="pg-cw-online-dot"></span>' : ''}
            </div>
            <div class="pg-cw-friend-info">
                <span class="pg-cw-friend-name">${window.esc(displayName)}</span>
                <span class="pg-cw-friend-username">@${window.esc(username)}</span>
            </div>
            <button class="pg-cw-invite-btn secondary-btn" data-username="${window.esc(username)}" data-uid="${window.esc(uid)}">
                <i class="ti ti-send"></i> Davet Et
            </button>
        </div>`;
    }).join('');

    // Butonlara tıklama olayı
    listEl.querySelectorAll('.pg-cw-invite-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const username = btn.dataset.username;
            const uid      = btn.dataset.uid;
            btn.disabled = true;
            btn.innerHTML = '<i class="ti ti-loader" style="animation:spin .8s linear infinite;display:inline-block;"></i>';
            const ok = await _collabWaitSendInvite(username, uid, goal);
            if (ok) {
                btn.innerHTML = '<i class="ti ti-check"></i> Gönderildi';
                btn.classList.remove('secondary-btn');
                btn.classList.add('pg-cw-sent-btn');
                _collabInviteStatus[username] = 'sent';
                _collabWaitShowWaitingSection();
                _collabWaitRefreshWaitingList();
            } else {
                btn.disabled = false;
                btn.innerHTML = '<i class="ti ti-send"></i> Tekrar Dene';
            }
        });
    });
}
window._collabWaitLoadFriends = _collabWaitLoadFriends;

async function _collabWaitSendInvite(username, userId, goal) {
    if (!window.FocusSupabase) {
        window.toast('Davet göndermek için giriş yapman gerekiyor.');
        return false;
    }
    try {
        // Kullanıcı id'si yoksa username'den çek
        let targetId = userId || null;
        if (!targetId) {
            const { data: p, error: pe } = await window.FocusSupabase
                .from('profiles').select('id').eq('username', username).maybeSingle();
            if (pe) { console.error('[Collab Invite] profile lookup error:', pe); }
            targetId = p?.id || null;
        }
        if (!targetId) {
            window.toast('Kullanıcı bulunamadı: @' + username);
            return false;
        }

        const cu           = window.currentUser || {};
        const fromName     = cu.displayName || cu.username || 'Biri';
        const fromUsername = cu.username || '';

        const { error } = await window.FocusSupabase.from('notifications').insert({
            user_id: targetId,
            type: 'collab_plan_invite',
            payload: {
                fromUsername,
                fromName,
                inviteCode: goal.invite_code,
                roomId:     goal.collab_room_id,
                goalId:     goal.id,
                goalTitle:  goal.title,
            }
        });

        if (error) {
            console.error('[Collab Invite] insert error:', error);
            window.toast('Davet gönderilemedi: ' + (error.message || 'Bilinmeyen hata'));
            return false;
        }

        return true;
    } catch(e) {
        console.error('[Collab Invite] exception:', e);
        window.toast('Davet gönderilemedi: ' + (e.message || ''));
        return false;
    }
}
window._collabWaitSendInvite = _collabWaitSendInvite;

function _collabWaitShowWaitingSection() {
    const sec = document.getElementById('pg-cw-waiting-section');
    if (sec) sec.style.display = '';
}
window._collabWaitShowWaitingSection = _collabWaitShowWaitingSection;

function _collabWaitRefreshWaitingList() {
    const listEl = document.getElementById('pg-cw-waiting-list');
    if (!listEl) return;
    const entries = Object.entries(_collabInviteStatus);
    if (!entries.length) { listEl.innerHTML = ''; return; }
    listEl.innerHTML = entries.map(([uname, status]) => {
        const cached = _cwFriendCache[uname] || {};
        const displayName = cached.displayName || uname;
        const color       = cached.color || _cwAvatarColor(uname);
        const initials    = displayName.slice(0, 2).toUpperCase();
        return `
        <div class="pg-cw-friend-row" style="padding:8px 10px;">
            <div class="pg-cw-friend-avatar-wrap">
                <div class="pg-cw-friend-avatar" style="background:${color};width:32px;height:32px;font-size:12px;">${initials}</div>
                ${status === 'accepted' ? '<span class="pg-cw-online-dot"></span>' : ''}
            </div>
            <div class="pg-cw-friend-info">
                <span class="pg-cw-friend-name" style="font-size:13px;">${window.esc(displayName)}</span>
                <span class="pg-cw-friend-username">@${window.esc(uname)}</span>
            </div>
            ${status === 'accepted'
                ? '<span class="pg-cw-member-joined">✓ Katıldı</span>'
                : '<span class="pg-cw-member-waiting"><span class="pg-cw-pulse-dot" style="width:7px;height:7px;"></span> Bekleniyor</span>'}
        </div>`;
    }).join('');
}
window._collabWaitRefreshWaitingList = _collabWaitRefreshWaitingList;

async function _collabWaitRefreshAccepted(goal) {
    if (!goal?.collab_room_id) return;
    let members;
    try {
        members = await (window.PlanningCollab?.getMembers?.(goal.collab_room_id) || Promise.resolve([]));
    } catch (e) {
        console.warn('[FocusAI] _collabWaitRefreshAccepted:', e);
        return;
    }
    const others  = members.filter(m => m.role !== 'owner');
    if (!others.length) return;

    let anyNew = false;
    others.forEach(m => {
        // username varsa onu kullan (davet gönderilirken bu key ile kayıt yapıldı)
        const key = m.username || m.name || m.user_id;
        // _collabInviteStatus'taki tüm key'leri güncelle (username veya user_id eşleşebilir)
        const matchingKey = Object.keys(_collabInviteStatus).find(k =>
            k === key || k === m.username || k === m.name
        ) || key;
        if (_collabInviteStatus[matchingKey] !== 'accepted') {
            _collabInviteStatus[matchingKey] = 'accepted';
            anyNew = true;
        }
    });

    if (anyNew) {
        _collabWaitRefreshWaitingList();
        // Show proceed button
        const proceedWrap = document.getElementById('pg-cw-proceed-wrap');
        if (proceedWrap && !proceedWrap.querySelector('#pg-cw-proceed-btn')) {
            proceedWrap.innerHTML = `
                <button id="pg-cw-proceed-btn" class="primary-btn" style="width:100%;margin-top:12px;padding:12px 0;font-size:15px;">
                    <i class="ti ti-arrow-right"></i> Planlamaya Başla
                </button>`;
            document.getElementById('pg-cw-proceed-btn')?.addEventListener('click', () => {
                // _pending_collab flag'ini kaldır → hedef artık görünür
                const goals = window._pgGetGoals();
                const gIdx = goals.findIndex(x => x.id === goal.id);
                if (gIdx !== -1) {
                    delete goals[gIdx]._pending_collab;
                    window.persistGoals();
                    window.render();
                }
                // Broadcast: kabul eden kişilere "şimdi başlıyoruz" sinyali
                if (window.PlanningCollab?.channel) {
                    window.PlanningCollab.broadcast('start_planning', { goalId: goal.id });
                }
                _closeCollabWaitOverlay();
                window.toast('Planlamaya başlayalım! 🎉', '#06d6a0');
                setTimeout(() => window.openPlanView(goal.id), 300);
            });
        }
    }
}
window._collabWaitRefreshAccepted = _collabWaitRefreshAccepted;
