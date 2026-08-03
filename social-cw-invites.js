// social-cw-invites.js
// social.js'ten çıkarıldı (Faz E — riskli bölge denemesi, 2026-07-23):
// Ortak Odaklanma davet akışı (DM daveti + grup daveti + davet
// reddedilme dinleyicisi + davet modalı + gelen davet dinleyicisi).
//
// Bu bölge "Ortak Odaklanma motoru"nun (dokunulmaması gereken çekirdek)
// PARÇASIYDI — çıkarma için social.js'te 10 paylaşılan oda/oturum state
// değişkenine (currentRoomId, currentRoomIsHost, _cwRoomIsSupabase,
// sharedFocusTotalRounds, _cwPartnerUsername/Name/Color,
// _cwRoomOriginGroupScope, _cwInviteMsgId, _cwInviteScope) YENİ getter/
// setter köprüleri eklendi (bkz. social.js satır ~223-290 civarı):
//   window._cwGetRoomId (zaten vardı) / window._cwGetRoomIsHost (zaten vardı)
//   window._cwGetRoomIsSupabase (YENİ) / window._getSharedFocusTotalRounds (YENİ)
//   window._cwSetPartnerInfo (YENİ) / window._cwSetRoomOriginGroupScope (YENİ)
//   window._cwSetInviteMsgRef (YENİ) / window.enterCWRoom (YENİ export)
// Bu köprüler SADECE bu dosyanın yazması için var — social.js'in kendi
// içindeki (enterCWRoom, exitCWRoomLocal, _cwSetupSupaRoomUI gibi) çekirdek
// fonksiyonlar aynı değişkenlere HALA doğrudan (closure) erişiyor, hiçbiri
// değiştirilmedi.
//
import { getCurrentUser } from './state/current-user-store.js';
import { getCurrentRoomId, getCwRoomIsSupabase } from './state/cw-current-room-store.js';
// Diğer dış bağımlılıklar: getCurrentUser(), window._escapeHtml,
// window.showPremiumModal, window.playNotificationSound,
// window.maybeShowDesktopNotification, window.__getDcCurrentGroupScope,
// window._throttleAction, window.dcShowToast, window.FocusSupabase.

    // Zaten bir odayı yönetiyorsa (premium/kurumsalda kapasite >2 olabilir)
    // yeni davet AYNI odaya gönderilir — böylece tek tek davet ederek odaya
    // birden fazla kişi eklenebilir. Ücretsizde kapasite zaten 2 olduğundan
    // ikinci davet göndermeden önce mevcut oda dolu olur, davranış değişmez.
export function sendCWInvite(targetUsername, targetName, targetColor, linkedHabit, focusMinutes) {
        if (!getCurrentUser()) { console.warn('[CW-DEBUG] sendCWInvite: getCurrentUser() yok, çıkılıyor'); return; }
        // Partner bilgisini sakla — yeniden başlatma akışında kullanılır
        window._cwSetPartnerInfo(targetUsername, targetName, targetColor);
        const reuseExistingRoom = !!(getCurrentRoomId() && window._cwGetRoomIsHost() && getCwRoomIsSupabase());
        const roomId = reuseExistingRoom ? getCurrentRoomId() : `room_${getCurrentUser().username}_${Date.now()}`;
        const minutes = focusMinutes && focusMinutes > 0 ? focusMinutes : 25;

        const doSendInvite = () => {
            window.FocusSupabase.from('profiles').select('id').eq('username', targetUsername).single()
                .then(({ data: prof, error }) => {
                    if (error || !prof) { console.error('[FocusAI] davet: hedef kullanıcı bulunamadı', error); return; }
                    const inviteRow = {
                        room_id: roomId,
                        from_id: getCurrentUser().id,
                        from_username: getCurrentUser().username,
                        from_name: getCurrentUser().displayName,
                        from_color: getCurrentUser().avatarColor || '6c5ce7',
                        to_id: prof.id,
                        to_username: targetUsername,
                        focus_minutes: minutes,
                        rounds: window._getSharedFocusTotalRounds(),
                        linked_habit_id: linkedHabit?.id || null,
                        linked_habit_name: linkedHabit?.name || null,
                        linked_pair_id: linkedHabit?.pairId || null
                    };
                    window.FocusSupabase.from('cw_invites').insert(inviteRow)
                        .then(({ error: e, data: d }) => {
                            if (e) console.error('[CW-DEBUG] davet yazma hatası:', e);
                        });
                });
            if (!reuseExistingRoom) window.enterCWRoom(roomId, targetName, targetColor, linkedHabit, true, minutes);
        };

        if (window.FocusSupabase) {
            if (reuseExistingRoom) {
                // Kapasite dolu mu önceden kontrol et — davetiyi boşuna gönderme
                Promise.all([
                    window.FocusSupabase.from('cw_rooms').select('max_participants').eq('id', roomId).single(),
                    window.FocusSupabase.from('cw_room_members').select('user_id', { count: 'exact', head: true }).eq('room_id', roomId)
                ]).then(([{ data: roomRow, error: rErr }, { count, error: cErr }]) => {
                    const cap = roomRow?.max_participants || 2;
                    if ((count || 0) >= cap) {
                        console.warn('[CW-DEBUG] oda dolu, davet gönderilmiyor');
                        window.dcShowToast?.('Bu oda dolu — daha fazla kişi ekleyemezsin.');
                        return;
                    }
                    doSendInvite();
                });
            } else {
                doSendInvite();
            }
        } else {
            console.warn('[CW-DEBUG] window.FocusSupabase yok!');
        }

        if (typeof window.showPremiumModal === 'function') {
            const msg = linkedHabit
                ? `${targetName} adlı kişiye "${linkedHabit.name}" alışkanlığı için birlikte odaklanma daveti gönderildi. Kabul edince aynı odada buluşacaksınız.`
                : `${targetName} adlı kişiye odak odası daveti gönderildi. Kabul edince aynı odada buluşacaksınız.`;
            window.showPremiumModal({ title: '📨 Davet Gönderildi!', message: msg, type: 'success' });
        }
    }
    window.sendCWInvite = sendCWInvite;

    // Grup/kanal sohbetine "birlikte odaklan" daveti — host için oda kurar
    // (bkz. enterCWRoom) ve kanala herkesin katılabileceği bir davet kartı
    // gönderir (bkz. _renderDcCwRoomInviteCard). sendCWInvite'ın aksine tek
    // bir hedef kullanıcı yoktur, kanaldaki herkes hedeftir.
export function sendGroupFocusInvite(minutes, breakMinutes, rounds, groupScope) {
        const scope = groupScope || window.__getDcCurrentGroupScope();
        if (!scope || !window.FocusSupabase || !getCurrentUser()?.id) return;
        if (typeof _throttleAction === 'function' && !_throttleAction(`focus_invite_${scope.type}_${scope.id}`, 5000)) {
            if (typeof window.dcShowToast === 'function') window.dcShowToast('Az önce bir davet gönderdin, biraz bekle.');
            return;
        }
        const roomId = `room_${getCurrentUser().username}_${Date.now()}`;
        const mins = minutes && minutes > 0 ? minutes : 25;
        if (typeof window.enterCWRoom === 'function') window.enterCWRoom(roomId, null, null, null, true, mins);
        // enterCWRoom bunu null'a sıfırlar — "Yeniden Başlat" hangi ayar
        // modalına (grup mu DM mi) döneceğini bilsin diye hemen sonra set ediyoruz.
        window._cwSetRoomOriginGroupScope({ type: scope.type, id: scope.id });
        window.FocusSupabase.from('messages').insert({
            scope_type: scope.type,
            scope_id:   scope.id,
            sender_id:  getCurrentUser().id,
            text: null,
            reply_to: null,
            attachments: [{
                kind: 'cw_room_invite',
                roomId,
                hostUsername: getCurrentUser().username,
                hostName: getCurrentUser().displayName || getCurrentUser().username,
                hostColor: getCurrentUser().avatarColor || '6c5ce7',
                minutes: mins
            }]
        }).select().single().then(({ data, error }) => {
            if (error) {
                console.error('[Odaklanma Daveti] mesaj gönderilemedi', error);
                if (typeof window.dcShowToast === 'function') window.dcShowToast('Davet gönderilemedi, tekrar dene.');
                return;
            }
            // Oturum başlatılınca ya da başlamadan bitirilince bu kartı
            // sohbetten silebilmek için mesaj id'sini/scope'unu sakla.
            window._cwSetInviteMsgRef(data?.id || null, { type: scope.type, id: scope.id });
        });
    }
    window.sendGroupFocusInvite = sendGroupFocusInvite;

    let _cwDeclineSupaChannel = null;
export function listenForCWDeclines() {
        if (!getCurrentUser()) return;
        if (window.FocusSupabase) {
            // Supabase: cw_invites'da from_id=benim ve status='declined' olan kayıtları dinle
            if (_cwDeclineSupaChannel) {
                window.FocusSupabase.removeChannel(_cwDeclineSupaChannel);
                _cwDeclineSupaChannel = null;
            }
            _cwDeclineSupaChannel = window.FocusSupabase
                .channel(`cw-declines-${getCurrentUser().id}`)
                .on('postgres_changes', {
                    event: 'UPDATE', schema: 'public', table: 'cw_invites',
                    filter: `from_id=eq.${getCurrentUser().id}`
                }, ({ new: row }) => {
                    if (row.status !== 'declined') return;
                    const byName = row.to_username || 'Partnerin';
                    window.playNotificationSound('alert');
                    const overlay = document.getElementById('group-focus-overlay');
                    const overlayOpen = overlay && overlay.style.display !== 'none' && overlay.classList.contains('visible');
                    if (overlayOpen) {
                        showDeclineToastInOverlay(byName);
                    } else if (typeof window.showPremiumModal === 'function') {
                        window.showPremiumModal({ title: 'Davet Reddedildi', message: `${byName} odaklanma davetini reddetti.`, type: 'info' });
                    }
                    // Declined kaydını temizle
                    window.FocusSupabase.from('cw_invites').delete().eq('id', row.id).then(() => {});
                })
                .subscribe();
            return;
        }
    }
    window.listenForCWDeclines = listenForCWDeclines;

    function showDeclineToastInOverlay(byName) {
        const existing = document.getElementById('focus-decline-toast');
        if (existing) existing.remove();

        const esc = window._escapeHtml;

        const toast = document.createElement('div');
        toast.id = 'focus-decline-toast';
        toast.innerHTML = `
            <div class="u-display-flex_align-items-flex-start_gap-12px">
                <div class="u-width-38px_height-38px_border-radius-50pct_background-rgba">
                    <i class="fa-solid fa-user-xmark u-color-hff4757_font-size-15px" ></i>
                </div>
                <div class="si-flex1">
                    <div class="u-font-weight-700_color-hfff_font-size-14px_margin-bottom-3p">Davet Reddedildi</div>
                    <div class="u-color-rgba2552552550p65_font-size-13px_line-height-1p4"><strong class="u-color-hff7675">${esc(byName)}</strong> odaklanma davetini şu an kabul edemedi.</div>
                </div>
                <button id="focus-decline-toast-close" title="Kapat" class="u-background-none_border-none_color-rgba2552552550p3_cursor- fdt-close-btn">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <div class="u-display-flex_gap-8px_margin-top-14px_justify-content-flex-">
                <button id="focus-decline-toast-stay" class="u-background-rgba2552552550p07_border-1pxsolidrgba2552552550 fdt-stay-btn">
                    <i class="fa-solid fa-person-running"></i> Tek Başıma Devam Et
                </button>
                <button id="focus-decline-toast-leave" class="u-background-rgba25571870p15_border-1pxsolidrgba25571870p35_ fdt-leave-btn">
                    <i class="fa-solid fa-right-from-bracket"></i> Odadan Ayrıl
                </button>
            </div>
        `;
        toast.style.position = 'fixed';
        toast.style.top = '28px';
        toast.style.right = '28px';
        toast.style.background = 'rgba(18,16,40,0.97)';
        toast.style.border = '1px solid rgba(255,71,87,0.4)';
        toast.style.borderRadius = '14px';
        toast.style.padding = '16px 18px';
        toast.style.maxWidth = '340px';
        toast.style.width = 'calc(100vw - 56px)';
        toast.style.boxShadow = '0 8px 32px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,71,87,0.15)';
        toast.style.backdropFilter = 'blur(14px)';
        toast.style.webkitBackdropFilter = 'blur(14px)';
        toast.style.zIndex = '999999';
        toast.style.animation = 'slideInRight 0.35s cubic-bezier(0.34,1.56,0.64,1) both';

        document.body.appendChild(toast);

        const closeToast = () => {
            toast.style.animation = 'slideOutRight 0.25s ease forwards';
            setTimeout(() => toast.remove(), 250);
        };

        document.getElementById('focus-decline-toast-close')?.addEventListener('click', closeToast);
        document.getElementById('focus-decline-toast-stay')?.addEventListener('click', closeToast);
        document.getElementById('focus-decline-toast-leave')?.addEventListener('click', () => {
            closeToast();
            // Ayrıl butonunu tetikle — mevcut leaveCWRoom / gf-leave-btn akışını kullan
            document.getElementById('gf-leave-btn')?.click();
        });

        // 12 saniye sonra otomatik kapat
        setTimeout(() => { if (document.getElementById('focus-decline-toast')) closeToast(); }, 12000);
    }

    let _lastCWInviteTimestamp = 0;
    let _cwInviteSupaChannel = null;
    let _cwInviteModalAC = null;

    function _cwShowInviteModal(inv) {
        // inv: { room_id/roomId, from_name/fromName, from_color/fromColor, from_username/fromUsername,
        //        linked_habit_id/linkedHabitId, linked_habit_name/linkedHabitName, linked_pair_id/linkedPairId,
        //        focus_minutes/focusMinutes, _inviteId (Supabase), _isSupabase }
        const modal = document.getElementById('coworking-invite-modal');
        const nameEl = document.getElementById('invite-friend-name');
        if (!modal || !nameEl) return;

        const fromName = inv.from_name || inv.fromName || '';
        const fromColor = inv.from_color || inv.fromColor || '6c5ce7';
        const fromUsername = inv.from_username || inv.fromUsername || '';
        const roomId = inv.room_id || inv.roomId;
        const focusMinutes = inv.focus_minutes || inv.focusMinutes || 25;
        const habitId = inv.linked_habit_id || inv.linkedHabitId;
        const habitName = inv.linked_habit_name || inv.linkedHabitName;
        const pairId = inv.linked_pair_id || inv.linkedPairId;

        nameEl.textContent = fromName;
        const bodyP = modal.querySelector('.modal-body p');
        if (bodyP) {
            bodyP.innerHTML = habitId
                ? `<strong id="invite-friend-name" class="u-color-hfff">${fromName}</strong> seni <strong class="u-color-var-primary-color">"${habitName}"</strong> ortak alışkanlığınız için birlikte odaklanma seansına davet ediyor. Katılıyor musun?`
                : `<strong id="invite-friend-name" class="u-color-hfff">${fromName}</strong> seni ${focusMinutes} dakikalık bir odaklanma seansına davet ediyor. Birlikte çalışmaya var mısın?`;
        }
        modal.classList.remove('hidden');

        const acceptBtn = document.getElementById('accept-invite-btn');
        const declineBtn = document.getElementById('decline-invite-btn');

        if (_cwInviteModalAC) _cwInviteModalAC.abort();
        _cwInviteModalAC = new AbortController();
        const { signal: _cwSig } = _cwInviteModalAC;

        const linkedHabit = habitId ? { id: habitId, name: habitName, pairId } : null;

        acceptBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
            if (inv._inviteId) {
                window.FocusSupabase.from('cw_invites').delete().eq('id', inv._inviteId).then(() => {});
            }
            // Kapasite kontrolü artık join_cw_room RPC'sinde (security definer, 068) yapılıyor
            window.enterCWRoom(roomId, fromName, fromColor, linkedHabit, false, focusMinutes);
        }, { signal: _cwSig });
        declineBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
            if (inv._inviteId) {
                window.FocusSupabase.from('cw_invites').update({ status: 'declined' }).eq('id', inv._inviteId).then(() => {});
            }
        }, { signal: _cwSig });
    }

export function listenForCWInvites() {
        if (!getCurrentUser()) { console.warn('[CW-DEBUG] listenForCWInvites: getCurrentUser() yok'); return; }
        if (window.FocusSupabase) {
            // Mevcut bekleyen davetleri hemen yükle
            window.FocusSupabase.from('cw_invites')
                .select('*').eq('to_id', getCurrentUser().id).eq('status', 'pending')
                .order('created_at', { ascending: false }).limit(1)
                .then(({ data: rows, error }) => {
                    if (!rows || rows.length === 0) return;
                    const row = rows[0];
                    const age = Date.now() - new Date(row.created_at).getTime();
                    if (age > 60000) {
                        window.FocusSupabase.from('cw_invites').delete().eq('id', row.id).then(() => {});
                        return;
                    }
                    window.playNotificationSound('alert');
                    window.maybeShowDesktopNotification('Odaklanma Daveti', `${row.from_name} seni birlikte odaklanma seansına davet ediyor.`);
                    _cwShowInviteModal({ ...row, _isSupabase: true, _inviteId: row.id });
                });

            // Yeni davetleri gerçek zamanlı dinle
            if (_cwInviteSupaChannel) {
                window.FocusSupabase.removeChannel(_cwInviteSupaChannel);
                _cwInviteSupaChannel = null;
            }
            _cwInviteSupaChannel = window.FocusSupabase
                .channel(`cw-invites-${getCurrentUser().id}`)
                .on('postgres_changes', {
                    event: 'INSERT', schema: 'public', table: 'cw_invites',
                    filter: `to_id=eq.${getCurrentUser().id}`
                }, ({ new: row }) => {
                    if (row.status !== 'pending') { console.warn('[CW-DEBUG] status pending değil, atlanıyor:', row.status); return; }
                    const age = Date.now() - new Date(row.created_at).getTime();
                    if (age > 60000) { console.warn('[CW-DEBUG] davet 60sn\'den eski, atlanıyor', age); return; }
                    window.playNotificationSound('alert');
                    window.maybeShowDesktopNotification('Odaklanma Daveti', `${row.from_name} seni birlikte odaklanma seansına davet ediyor.`);
                    _cwShowInviteModal({ ...row, _isSupabase: true, _inviteId: row.id });
                })
                .subscribe();
            return;
        }
    }
    window.listenForCWInvites = listenForCWInvites;

