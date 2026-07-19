// ============================================================
// FOCUSAI SOCIAL-BUDDY-HABITS.JS
// social.js'ten çıkarılmış "Ortak Alışkanlık Zincirleri" (buddy habits)
// sistemi: davet gönderme/kabul/red, gerçek zamanlı davet/yanıt dinleme,
// ortak oturum tamamlama, kart render'ı.
// window.currentUser, window.getFriends, window.FocusSupabase,
// window.showPremiumModal, window.playNotificationSound,
// window.maybeShowDesktopNotification, window.showGenericNotifToast,
// window._escapeHtml, window.avatarImgHtml, window.openBuddyFocusSettingsModal
// gibi social.js/script.js globallerine bağımlı — onlardan SONRA yüklenmeli.
// Bu dosyanın kendi fonksiyonlarından bazıları (buddyPairId,
// populateHabitBuddySelect, _sendBuddyHabitDeletedNotification,
// _handleBuddyHabitDeletedNotification, _handleBuddySessionEndedNotification,
// listenForBuddyHabitInvites, listenForBuddyHabitResponses,
// completeBuddyHabitSession) social.js'in GERİ KALANINDAN çıplak
// çağrılıyor — bu yüzden window.X olarak da dışa açılıyor.
// ============================================================
(function () {
'use strict';

// habits.history ile aynı formatta gün anahtarı üretir (DD-MM-YYYY)
function buddyDayKey(date) {
    const d = date || new Date();
    return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}

function buddyPairId(userA, userB) {
    return [userA, userB].sort().join('__');
}
window.buddyPairId = buddyPairId;

// Arkadaş listesini "habit-buddy" seçim kutusuna doldurur (gerçek görünen adlarla).
function populateHabitBuddySelect() {
    const select = document.getElementById('habit-buddy');
    if (!select || !window.currentUser) return;

    const friends = window.getFriends();
    Array.from(select.options).forEach(opt => { if (opt.value !== 'none') opt.remove(); });
    if (!friends.length) return;

    const addOption = (username, displayName) => {
        if (!select.querySelector(`option[value="${username}"]`)) {
            const opt = document.createElement('option');
            opt.value = username;
            opt.textContent = `👥 ${displayName}`;
            select.appendChild(opt);
        }
    };

    if (window.FocusSupabase && window.currentUser.id) {
        friends.forEach(async username => {
            const profile = await window._resolveProfileByUsername?.(username);
            addOption(username, profile?.display_name || profile?.username || username);
        });
    }
}
window.populateHabitBuddySelect = populateHabitBuddySelect;

// Yeni bir ortak alışkanlık daveti gönderir. Alışkanlık, partner kabul edene kadar oluşturulmaz.
window.sendBuddyHabitInvite = async function(targetUsername, draft) {
    const currentUser = window.currentUser;
    if (!currentUser) {
        if (typeof window.showPremiumModal === 'function') {
            window.showPremiumModal({ title: 'Bağlantı Yok', message: 'Ortak alışkanlık daveti göndermek için çevrimiçi profilini kurman gerekiyor.', type: 'error' });
        }
        return false;
    }
    if (targetUsername === currentUser.username) return false;

    const pairId = buddyPairId(currentUser.username, targetUsername);

    if (window.FocusSupabase && currentUser.id) {
        const targetProfile = await window._resolveProfileByUsername?.(targetUsername);
        if (!targetProfile?.id) return false;
        const habitId = crypto.randomUUID();
        const { error } = await window.FocusSupabase.from('buddy_habit_invites').insert({
            habit_id: habitId,
            pair_id: pairId,
            from_id: currentUser.id,
            from_username: currentUser.username,
            from_name: currentUser.displayName,
            from_color: currentUser.avatarColor || '6c5ce7',
            to_id: targetProfile.id,
            to_username: targetUsername,
            name: draft.name,
            icon: draft.icon || 'fa-star',
            target_days: draft.targetDays || 21,
            category: draft.category || 'genel'
        });
        if (error) { console.error('[BuddyHabit] davet gönderme hatası', error); return false; }
        // Akış içerik kararı (2026-07-05): kaldırıldı, ara adım.
        return true;
    }

    return false;
};

function _showBuddyHabitInviteModal(inv) {
    const currentUser = window.currentUser;
    const modal = document.getElementById('buddy-habit-invite-modal');
    const fromEl = document.getElementById('buddy-habit-invite-from');
    const nameEl = document.getElementById('buddy-habit-invite-name');
    const targetEl = document.getElementById('buddy-habit-invite-target');
    if (!modal || !fromEl || !nameEl || !targetEl) return;

    fromEl.textContent = inv.fromName;
    nameEl.textContent = inv.name;
    targetEl.textContent = inv.targetDays;
    modal.classList.remove('hidden');
    window.playNotificationSound('alert');
    window.maybeShowDesktopNotification('Ortak Alışkanlık Daveti', `${inv.fromName} seni "${inv.name}" alışkanlığına davet etti.`);

    const acceptBtn = document.getElementById('buddy-habit-accept-btn');
    const declineBtn = document.getElementById('buddy-habit-decline-btn');

    if (_buddyHabitModalAC) _buddyHabitModalAC.abort();
    _buddyHabitModalAC = new AbortController();
    const { signal: _bhSig } = _buddyHabitModalAC;

    acceptBtn.addEventListener('click', async () => {
        modal.classList.add('hidden');
        if (inv._supaId && window.FocusSupabase && currentUser?.id) {
            // Supabase: buddy_habits oluştur + response yaz + daveti sil
            await window.FocusSupabase.from('buddy_habits').insert({
                id: inv.habitId, pair_id: inv.pairId,
                name: inv.name, icon: inv.icon, target_days: inv.targetDays, category: inv.category,
                host_id: inv._fromId, host_username: inv.fromUsername,
                guest_id: currentUser.id, guest_username: currentUser.username
            });
            await window.FocusSupabase.from('buddy_habit_responses').insert({
                habit_id: inv.habitId, pair_id: inv.pairId,
                from_id: currentUser.id, from_username: currentUser.username, from_name: currentUser.displayName,
                to_id: inv._fromId, name: inv.name, icon: inv.icon, target_days: inv.targetDays, category: inv.category, accepted: true
            });
            // Aynı göndericiden gelen tüm davetleri sil (tekrar eden modal sorununu önler)
            await window.FocusSupabase.from('buddy_habit_invites').delete()
                .eq('from_id', inv._fromId).eq('to_id', currentUser.id);
        }
        if (typeof window.addBuddyHabitLocal === 'function') {
            window.addBuddyHabitLocal({
                id: inv.habitId, name: inv.name, icon: inv.icon, targetDays: inv.targetDays,
                category: inv.category, buddy: inv.fromUsername, pairId: inv.pairId
            });
        }
        // Akış içerik kararı (2026-07-05): kaldırıldı.
        _nextBuddyHabitInvite(); // Sıradaki daveti göster
        if (typeof window.showPremiumModal === 'function') {
            window.showPremiumModal({ title: 'Ortak Hedef Kilitlendi!', message: `${inv.fromName} ile birlikte "${inv.name}" alışkanlığını başlattınız. Artık birbirinize karşı sorumlusunuz!`, type: 'success' });
        }
    }, { signal: _bhSig });

    declineBtn.addEventListener('click', async () => {
        modal.classList.add('hidden');
        if (inv._supaId && window.FocusSupabase && currentUser?.id) {
            await window.FocusSupabase.from('buddy_habit_responses').insert({
                habit_id: inv.habitId, pair_id: inv.pairId,
                from_id: currentUser.id, from_username: currentUser.username, from_name: currentUser.displayName,
                to_id: inv._fromId, name: inv.name, icon: inv.icon, target_days: inv.targetDays, category: inv.category, accepted: false
            });
            // Aynı göndericiden gelen tüm davetleri sil
            await window.FocusSupabase.from('buddy_habit_invites').delete()
                .eq('from_id', inv._fromId).eq('to_id', currentUser.id);
        }
        _nextBuddyHabitInvite(); // Sıradaki daveti göster
    }, { signal: _bhSig });
}

// Partner'a alışkanlık silindi bildirimi gönder
async function _sendBuddyHabitDeletedNotification(habitId, buddyUsername, habitName) {
    const currentUser = window.currentUser;
    if (!window.FocusSupabase || !currentUser?.id || !buddyUsername) {
        console.warn('[BuddyHabit] ön koşul hatası:', { supabase: !!window.FocusSupabase, userId: currentUser?.id, buddy: buddyUsername });
        return;
    }
    // Partner id'sini çöz
    let partnerId = null;
    try {
        const cached = await window._resolveProfileByUsername?.(buddyUsername);
        partnerId = cached?.id || null;
        if (!partnerId) {
            const { data: p, error: pe } = await window.FocusSupabase.from('profiles').select('id').eq('username', buddyUsername).maybeSingle();
            if (pe) console.warn('[BuddyHabit] profiles sorgu hatası:', pe.message);
            partnerId = p?.id || null;
        }
    } catch (e) { console.warn('[BuddyHabit] profil çözme hatası:', e.message); }
    if (!partnerId) {
        console.warn('[BuddyHabit] partner profili bulunamadı, username:', buddyUsername);
        return;
    }
    const resolvedName = habitName || '';
    const { error } = await window.FocusSupabase.from('notifications').insert({
        user_id: partnerId, type: 'buddy_habit_deleted',
        payload: { fromUsername: currentUser.username, fromName: currentUser.displayName || currentUser.username, habitId, habitName: resolvedName }
    });
    if (error) console.warn('[BuddyHabit] bildirim insert hatası:', error.message);
}
window._sendBuddyHabitDeletedNotification = _sendBuddyHabitDeletedNotification;

// Ortak alışkanlık silindi bildirimini işle — partnere modal göster
function _handleBuddyHabitDeletedNotification(info) {
    document.getElementById('gf-buddy-habit-deleted-overlay')?.remove();
    const habitName = info.habitName || 'bir ortak alışkanlık';
    const fromName = info.fromName || info.fromUsername || 'Partner';
    const overlay = document.createElement('div');
    overlay.id = 'gf-buddy-habit-deleted-overlay';
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'z-index:100060;';
    overlay.innerHTML = `
        <div class="modal-content glass-panel" style="max-width:370px; text-align:center; padding:28px 24px;">
            <div style="font-size:32px; margin-bottom:12px;">🍃</div>
            <h3 style="margin:0 0 8px; font-size:16px; color:#fff;">${window._escapeHtml(fromName)} ayrıldı</h3>
            <p style="color:var(--text-muted); font-size:13px; margin:0 0 22px;">
                <b style="color:#fff;">"${window._escapeHtml(habitName)}"</b> alışkanlığını ortak olarak sildi.<br>Bu alışkanlığa tek başına devam etmek ister misin?
            </p>
            <div style="display:flex; flex-direction:column; gap:10px;">
                <button id="gf-bh-solo-btn" class="control-btn primary" style="width:100%; padding:12px;">
                    <i class="fa-solid fa-person-running"></i> Evet, Solo Devam Et
                </button>
                <button id="gf-bh-delete-btn" class="control-btn" style="width:100%; padding:12px; background:rgba(255,71,87,0.1); color:#ff6b81;">
                    <i class="fa-solid fa-trash"></i> Hayır, Alışkanlığı Sil
                </button>
            </div>
        </div>`;
    document.body.appendChild(overlay);

    document.getElementById('gf-bh-solo-btn').addEventListener('click', () => {
        overlay.remove();
        // Alışkanlığı solo'ya çevir (buddy/pairId'yi kaldır)
        if (info.habitId && typeof window.convertBuddyHabitToSolo === 'function') {
            window.convertBuddyHabitToSolo(info.habitId);
        }
    });
    document.getElementById('gf-bh-delete-btn').addEventListener('click', () => {
        overlay.remove();
        if (info.habitId && typeof window.deleteHabitById === 'function') {
            window.deleteHabitById(info.habitId);
        }
    });
}
window._handleBuddyHabitDeletedNotification = _handleBuddyHabitDeletedNotification;

// Oturum bitti bildirimini işle — toast göster
function _handleBuddySessionEndedNotification(info) {
    const fromName = info.fromName || info.fromUsername || 'Partner';
    const habitName = info.habitName || 'ortak alışkanlık';
    const completed = info.completed;
    if (typeof window.showGenericNotifToast === 'function') {
        window.showGenericNotifToast({
            icon: completed ? 'fa-check-double' : 'fa-hourglass-end',
            accent: completed ? '#2ed573' : '#fdcb6e',
            title: completed ? 'Oturum Bitti — Tamamlandı! 🎉' : 'Oturum Sonlandı',
            body: completed
                ? `<b>${window._escapeHtml(fromName)}</b>, "${window._escapeHtml(habitName)}" alışkanlığını bugün tamamladığını bildirdi.`
                : `<b>${window._escapeHtml(fromName)}</b> odak oturumunu sonlandırdı.`
        });
    }
}
window._handleBuddySessionEndedNotification = _handleBuddySessionEndedNotification;

let _buddyInviteSupaChannel = null;

// ── Davet sırası (queue) — aynı anda tek modal gösterir ──────────────────
let _buddyHabitInviteQueue = [];
let _buddyHabitInviteShowing = false;
let _buddyHabitModalAC = null;

function _queueBuddyHabitInvite(inv) {
    // Aynı göndericiden zaten sırada bekleyen bir davet varsa ekleme
    const alreadyQueued = _buddyHabitInviteQueue.some(i => i._fromId && i._fromId === inv._fromId);
    if (alreadyQueued) return;
    _buddyHabitInviteQueue.push(inv);
    if (!_buddyHabitInviteShowing) _nextBuddyHabitInvite();
}

function _nextBuddyHabitInvite() {
    if (_buddyHabitInviteQueue.length === 0) { _buddyHabitInviteShowing = false; return; }
    _buddyHabitInviteShowing = true;
    _showBuddyHabitInviteModal(_buddyHabitInviteQueue.shift());
}
// ─────────────────────────────────────────────────────────────────────────

function listenForBuddyHabitInvites() {
    const currentUser = window.currentUser;
    if (!currentUser) return;

    if (window.FocusSupabase && currentUser.id) {
        if (_buddyInviteSupaChannel) { window.FocusSupabase.removeChannel(_buddyInviteSupaChannel); _buddyInviteSupaChannel = null; }

        // Bekleyen davetleri yükle — zaten kabul edilmiş veya çift gönderilmiş olanları temizle
        window.FocusSupabase
            .from('buddy_habit_invites')
            .select('*')
            .eq('to_id', currentUser.id)
            .order('created_at', { ascending: false })
            .then(async ({ data }) => {
                if (!data || data.length === 0) return;
                // Mevcut buddy_habits'teki id'leri çek
                const { data: existing } = await window.FocusSupabase
                    .from('buddy_habits').select('id')
                    .or(`host_id.eq.${currentUser.id},guest_id.eq.${currentUser.id}`);
                const existingIds = new Set((existing || []).map(r => r.id));

                // Gönderici başına: en yeni daveti sakla, diğerlerini sil
                const latestPerSender = {};
                data.forEach(row => {
                    if (existingIds.has(row.habit_id)) {
                        // Zaten kabul edilmiş — temizle
                        window.FocusSupabase.from('buddy_habit_invites').delete().eq('id', row.id).then(() => {});
                        return;
                    }
                    if (!latestPerSender[row.from_id]) {
                        latestPerSender[row.from_id] = row; // created_at desc sırası sayesinde ilk = en yeni
                    } else {
                        // Aynı göndericinin eski/çift daveti — sil
                        window.FocusSupabase.from('buddy_habit_invites').delete().eq('id', row.id).then(() => {});
                    }
                });

                Object.values(latestPerSender).forEach(row => {
                    _queueBuddyHabitInvite({
                        habitId: row.habit_id, pairId: row.pair_id,
                        fromUsername: row.from_username, fromName: row.from_name, fromColor: row.from_color,
                        name: row.name, icon: row.icon, targetDays: row.target_days, category: row.category,
                        _supaId: row.id, _fromId: row.from_id
                    });
                });
            });

        _buddyInviteSupaChannel = window.FocusSupabase
            .channel(`buddy-habit-invites-${currentUser.id}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'buddy_habit_invites', filter: `to_id=eq.${currentUser.id}` }, ({ new: row }) => {
                _queueBuddyHabitInvite({
                    habitId: row.habit_id, pairId: row.pair_id,
                    fromUsername: row.from_username, fromName: row.from_name, fromColor: row.from_color,
                    name: row.name, icon: row.icon, targetDays: row.target_days, category: row.category,
                    _supaId: row.id, _fromId: row.from_id
                });
            })
            .subscribe();
        return;
    }
}
window.listenForBuddyHabitInvites = listenForBuddyHabitInvites;

let _buddyResponseSupaChannel = null;

// Daveti gönderen taraf, partnerin yanıtını burada dinler.
function listenForBuddyHabitResponses() {
    const currentUser = window.currentUser;
    if (!currentUser) return;

    if (window.FocusSupabase && currentUser.id) {
        if (_buddyResponseSupaChannel) { window.FocusSupabase.removeChannel(_buddyResponseSupaChannel); _buddyResponseSupaChannel = null; }

        const handleResponse = async (row) => {
            // Önce sil (idempotent — sayfa yenilenince tekrar işlenmesin)
            const { error: delErr } = await window.FocusSupabase.from('buddy_habit_responses').delete().eq('id', row.id);
            if (delErr) return; // Başka sekme zaten sildi, atla
            window.playNotificationSound('alert');
            if (row.accepted) {
                // Alışkanlık zaten local'de varsa tekrar ekleme
                const alreadyLocal = typeof window.addBuddyHabitLocal === 'function'
                    ? window.addBuddyHabitLocal({
                        id: row.habit_id, name: row.name, icon: row.icon, targetDays: row.target_days,
                        category: row.category, buddy: row.from_username, pairId: row.pair_id
                      })
                    : false;
                // host (davetçi) olarak buddy_habit'e kendi kaydımızı ekliyoruz
                await window.FocusSupabase.from('buddy_habits').upsert({
                    id: row.habit_id, pair_id: row.pair_id,
                    name: row.name, icon: row.icon, target_days: row.target_days, category: row.category,
                    host_id: currentUser.id, host_username: currentUser.username,
                    guest_id: row.from_id, guest_username: row.from_username
                });
                if (alreadyLocal !== false && typeof window.showPremiumModal === 'function') {
                    window.showPremiumModal({ title: 'Davetin Kabul Edildi! 🎉', message: `${row.from_name}, "${row.name}" ortak alışkanlığını kabul etti. Artık birlikte takip edebilirsiniz!`, type: 'success' });
                }
            } else {
                if (typeof window.showPremiumModal === 'function') {
                    window.showPremiumModal({ title: 'Davet Reddedildi', message: `${row.from_name}, "${row.name}" ortak alışkanlık davetini şimdilik kabul etmedi.`, type: 'info' });
                }
            }
        };

        // Mevcut yanıtları işle
        window.FocusSupabase.from('buddy_habit_responses').select('*').eq('to_id', currentUser.id)
            .then(({ data }) => { (data || []).forEach(handleResponse); });

        _buddyResponseSupaChannel = window.FocusSupabase
            .channel('buddy-habit-responses')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'buddy_habit_responses', filter: `to_id=eq.${currentUser.id}` }, ({ new: row }) => handleResponse(row))
            .subscribe();
        return;
    }
}
window.listenForBuddyHabitResponses = listenForBuddyHabitResponses;

// Ortak odaklanma seansı bitince ikisinin de bugünkü hedefini işaretler.
function completeBuddyHabitSession(linkedHabit) {
    const currentUser = window.currentUser;
    if (!currentUser || !linkedHabit || !linkedHabit.id) return;
    const todayKey = buddyDayKey();

    if (typeof window.markHabitCompleteForDate === 'function') {
        window.markHabitCompleteForDate(linkedHabit.id, todayKey);
    }

    if (window.FocusSupabase && currentUser.id && linkedHabit.pairId) {
        window.FocusSupabase.from('buddy_habit_completions')
            .upsert({ habit_id: linkedHabit.id, user_id: currentUser.id, day_key: todayKey })
            .catch(err => console.error('[BuddyHabit] tamamlama yazma hatası', err));
        return;
    }

}
window.completeBuddyHabitSession = completeBuddyHabitSession;

// Bireysel sekmesindeki "Ortak Alışkanlık Zincirleri" kartlarını gerçek zamanlı partner durumu ile çizer.
window.renderBuddyHabitsSocial = function(habits) {
    const currentUser = window.currentUser;
    if (!window.FocusSupabase) return;
    const container = document.getElementById('buddy-habits-list');
    if (!container) return;

    const friends = window.getFriends();
    const buddyHabits = (habits || []).filter(h => h.buddy && h.buddy !== 'none' && h.pairId && friends.includes(h.buddy));
    const hasFriends = friends.length > 0;

    // Kart başlığındaki tek butonu duruma göre değiştir — arkadaş yoksa
    // "Arkadaşını Davet Et", varsa "Yeni Ortak Alışkanlık Oluştur" göster.
    // Böylece aynı anda iki ayrı buton (biri üstte, biri içerikte) gösterilmiyor.
    const headerBtn = document.getElementById('buddy-create-habit-header-btn');
    if (headerBtn) {
        if (hasFriends) {
            headerBtn.dataset.mode = 'create';
            headerBtn.innerHTML = '<i class="fa-solid fa-leaf"></i> Yeni Ortak Alışkanlık Oluştur';
        } else {
            headerBtn.dataset.mode = 'addfriend';
            headerBtn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Arkadaşını Davet Et';
        }
    }

    if (!buddyHabits.length) {
        container.innerHTML = `
            <div style="width:100%; text-align: center; padding: 16px 10px;">
                <p style="color: var(--text-muted); font-size: 13px; margin: 0;">
                    ${hasFriends
                        ? 'Henüz ortak bir alışkanlık oluşturmadın. "Alışkanlıklar" sekmesinden yeni bir hedef belirle, partnerini seç ve davet gönder!'
                        : 'Ortak alışkanlık zinciri için önce bir arkadaş eklemen gerekiyor.'}
                </p>
            </div>`;
        return;
    }

    const todayKey = buddyDayKey();

    const renderCard = (habit, buddyDisplayName, buddyAvatarColor, buddyOnline, isUserDoneToday, isBuddyDoneToday) => {
        const cardId = `buddy-habit-card-${habit.id}`;
        let card = document.getElementById(cardId);
        if (!card) { card = document.createElement('div'); card.id = cardId; card.className = 'buddy-habit-card'; container.appendChild(card); }
        const completedDays = Object.keys(habit.history || {}).length;
        const targetDays = habit.targetDays || 21;
        const progressPercentage = Math.min(Math.round((completedDays / targetDays) * 100), 100);
        const bothDone = isUserDoneToday && isBuddyDoneToday;
        const buddyFakeUser = { username: habit.buddy, displayName: buddyDisplayName, avatarColor: buddyAvatarColor };
        const buddyAvatar = window.avatarImgHtml(buddyFakeUser, 28, 'margin-left:-10px;');
        const statusClass = bothDone ? 'buddy-status-success' : 'buddy-status-waiting';
        const statusText = bothDone
            ? '<i class="fa-solid fa-check-double"></i> İkiniz de Tamamladınız'
            : `<i class="fa-solid fa-hourglass-half"></i> Sen: ${isUserDoneToday ? '✅' : '⏳'} · ${window._escapeHtml(buddyDisplayName)}: ${isBuddyDoneToday ? '✅' : '⏳'}`;
        card.innerHTML = `
            <div class="buddy-header">
                <span class="buddy-title"><i class="fa-solid ${habit.icon || 'fa-star'}" style="color: var(--primary-color);"></i> ${window._escapeHtml(habit.name)}</span>
                <div class="buddy-users"><div class="buddy-avatar-group">${window.avatarImgHtml(currentUser, 28)}${buddyAvatar}</div></div>
            </div>
            <div class="buddy-progress-wrapper">
                <div class="buddy-status-text">
                    <span>Ortak İlerleme: <strong>${completedDays}/${targetDays} Gün</strong></span>
                    <span class="buddy-status-badge ${statusClass}">${statusText}</span>
                </div>
                <div class="buddy-progress-bar"><div class="buddy-progress-fill ${bothDone ? 'success' : ''}" style="width:${progressPercentage}%;"></div></div>
            </div>
            <div style="margin-top:12px; display:flex; align-items:center; justify-content:flex-end; gap:8px; flex-wrap:wrap;">
                ${!bothDone ? (buddyOnline
                    ? `<span class="buddy-online-badge"><i class="fa-solid fa-circle" style="font-size:7px;"></i> ${buddyDisplayName} çevrimiçi</span>`
                    : `<span class="buddy-offline-warning"><i class="fa-solid fa-circle" style="font-size:7px;"></i> ${buddyDisplayName} çevrimiçi değil</span>`) : ''}
                <button class="control-btn primary buddy-focus-btn" data-habit-id="${habit.id}" style="font-size:12px; padding:8px 14px;" ${(bothDone || !buddyOnline) ? 'disabled' : ''}>
                    <i class="fa-solid fa-bolt"></i> ${bothDone ? 'Bugün Tamamlandı' : 'Birlikte Odaklan'}
                </button>
            </div>`;
        const focusBtn = card.querySelector('.buddy-focus-btn');
        if (focusBtn && !bothDone) {
            focusBtn.addEventListener('click', () => window.openBuddyFocusSettingsModal(habit.buddy, buddyDisplayName, buddyAvatarColor || '6c5ce7', { id: habit.id, name: habit.name, pairId: habit.pairId }));
        }
    };

    buddyHabits.forEach(habit => {
        const isUserDoneToday = !!(habit.history && habit.history[todayKey]);

        if (window.FocusSupabase && currentUser?.id) {
            (async () => {
                const profile = await window._resolveProfileByUsername?.(habit.buddy);
                const buddyDisplayName = profile?.display_name || profile?.username || habit.buddy;
                const buddyAvatarColor = profile?.avatar_color || '6c5ce7';
                // Presence'den çevrimiçi durumu al
                const state = window.getCommunityPresenceState ? window.getCommunityPresenceState() : {};
                const onlineUsernames = new Set();
                Object.values(state).forEach(arr => { if (Array.isArray(arr)) arr.forEach(p => p.username && onlineUsernames.add(p.username)); });
                const buddyOnline = onlineUsernames.has(habit.buddy);

                const { data: completions } = await window.FocusSupabase
                    .from('buddy_habit_completions')
                    .select('user_id, day_key')
                    .eq('habit_id', habit.id)
                    .eq('day_key', todayKey);

                const doneSet = new Set((completions || []).map(r => r.user_id));
                const isBuddyDoneToday = profile?.id ? doneSet.has(profile.id) : false;
                renderCard(habit, buddyDisplayName, buddyAvatarColor, buddyOnline, isUserDoneToday, isBuddyDoneToday);

                // Tamamlama değişikliklerini gerçek zamanlı dinle
                const existingChannel = window._buddyHabitCompletionChannels?.[habit.id];
                if (!existingChannel) {
                    window._buddyHabitCompletionChannels = window._buddyHabitCompletionChannels || {};
                    window._buddyHabitCompletionChannels[habit.id] = window.FocusSupabase
                        .channel(`bhc-${habit.id}`)
                        .on('postgres_changes', { event: '*', schema: 'public', table: 'buddy_habit_completions', filter: `habit_id=eq.${habit.id}` }, async () => {
                            const { data: c2 } = await window.FocusSupabase.from('buddy_habit_completions').select('user_id').eq('habit_id', habit.id).eq('day_key', todayKey);
                            const set2 = new Set((c2 || []).map(r => r.user_id));
                            const buddyDone2 = profile?.id ? set2.has(profile.id) : false;
                            const userDone2 = !!(habit.history && habit.history[todayKey]);
                            renderCard(habit, buddyDisplayName, buddyAvatarColor, buddyOnline, userDone2, buddyDone2);
                        })
                        .subscribe();
                }
            })();
        }
    });

    // Artık var olmayan kartları ve kanallarını temizle
    Array.from(container.children).forEach(child => {
        const stillExists = buddyHabits.some(h => `buddy-habit-card-${h.id}` === child.id);
        if (!stillExists) {
            const habitId = child.id?.replace('buddy-habit-card-', '');
            if (habitId && window._buddyHabitCompletionChannels?.[habitId] && window.FocusSupabase) {
                try { window.FocusSupabase.removeChannel(window._buddyHabitCompletionChannels[habitId]); } catch (_) { console.warn('[FocusAI] sessiz hata:', _); }
                delete window._buddyHabitCompletionChannels[habitId];
            }
            child.remove();
        }
    });
};

})();
