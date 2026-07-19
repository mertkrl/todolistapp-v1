// ─── GRUP ODAK OVERLAY — "AYRIL" SEÇİM AKIŞI ──────────────────────────
// social.js dosyasından çıkarıldı (Faz 2, 2026-07-19 — yüksek risk grubu,
// en karmaşık parça: oda sahipliği devri + çoklu Supabase callback zinciri).
//
// Dış bağımlılıklar salt-okunur getter'lar + fonksiyon köprüleriyle çözüldü
// (hepsi social.js'te tanımlı kalıyor, hiçbiri buraya taşınmadı):
// - gfMode → window._gfGetMode()
// - currentRoomId → window._cwGetRoomId()
// - currentRoomIsHost → window._cwGetRoomIsHost()
// - currentUser → window._dcGetChatContext().currentUser
// - _cwRoomSupaChannel → window._cwGetRoomChannel()
// - minimizeSharedFocusOverlay() / closeGroupFocusOverlay() /
//   exitCWRoomLocal() → social.js'te window.* ile açıldı (bunlar hâlâ
//   social.js'in merkezi CW-oda yaşam döngüsü fonksiyonları, taşınmadı —
//   sadece çağrılabilir hale getirildi).
let _gfLeaveChoiceAC = null;

function gfOpenLeaveChoiceModal() {
    const modal = document.getElementById('gf-leave-choice-modal');
    if (!modal) { console.warn('[CW-DEBUG] gf-leave-choice-modal bulunamadı, direkt gfLeaveSessionCompletely'); gfLeaveSessionCompletely(); return; }
    modal.classList.remove('hidden');
    gfEnsureLeaveChoiceBindings();
}
window.gfOpenLeaveChoiceModal = gfOpenLeaveChoiceModal;

function gfCloseLeaveChoiceModal() {
    document.getElementById('gf-leave-choice-modal')?.classList.add('hidden');
}
window.gfCloseLeaveChoiceModal = gfCloseLeaveChoiceModal;

function gfEnsureLeaveChoiceBindings() {
    const cancelBtn    = document.getElementById('gf-leave-cancel-btn');
    const interfaceBtn = document.getElementById('gf-leave-interface-btn');
    const sessionBtn   = document.getElementById('gf-leave-session-btn');

    if (_gfLeaveChoiceAC) _gfLeaveChoiceAC.abort();
    _gfLeaveChoiceAC = new AbortController();
    const { signal: _gfSig } = _gfLeaveChoiceAC;

    if (cancelBtn) cancelBtn.addEventListener('click', gfCloseLeaveChoiceModal, { signal: _gfSig });
    if (interfaceBtn) interfaceBtn.addEventListener('click', () => {
        try { gfCloseLeaveChoiceModal(); gfLeaveInterfaceOnly(); } catch (e) { console.error('[CW-DEBUG] gfLeaveInterfaceOnly hatası:', e); }
    }, { signal: _gfSig });
    if (sessionBtn) sessionBtn.addEventListener('click', () => {
        try { gfCloseLeaveChoiceModal(); gfLeaveSessionCompletely(); } catch (e) { console.error('[CW-DEBUG] gfLeaveSessionCompletely hatası:', e); }
    }, { signal: _gfSig });
}
window.gfEnsureLeaveChoiceBindings = gfEnsureLeaveChoiceBindings;

// "Sadece Arayüzden Ayrıl" — oturum/zamanlayıcı arka planda devam eder, overlay sadece gizlenir
function gfLeaveInterfaceOnly() {
    if (window._gfGetMode() === 'room') {
        window.minimizeSharedFocusOverlay();
    }
}
window.gfLeaveInterfaceOnly = gfLeaveInterfaceOnly;

// "Oturumdan Tamamen Ayrıl" — oda/oturum kapanır ya da katılımcı listesinden çıkılır
function gfLeaveSessionCompletely() {
    if (window._gfGetMode() !== 'room') return;
    const currentRoomId = window._cwGetRoomId();
    const currentUser = window._dcGetChatContext().currentUser;
    if (!window.FocusSupabase || !currentRoomId || !currentUser?.id) {
        window.closeGroupFocusOverlay();
        window.exitCWRoomLocal();
        return;
    }

    const leftRoomId = currentRoomId;
    const wasOwner = window._cwGetRoomIsHost();
    const myName = currentUser.displayName || currentUser.username || 'Bir katılımcı';
    // Kanal referansını burada yakalıyoruz — exitCWRoomLocal() bu kanalı
    // kaldırır, o yüzden TÜM broadcast'ler ve DB yazımları bitmeden
    // exitCWRoomLocal() ÇAĞRILMAMALI (aksi halde broadcast zaten kapanmış
    // bir kanala gider ve karşı tarafa hiç ulaşmaz).
    const chan = window._cwGetRoomChannel();
    const localExit = () => { window.closeGroupFocusOverlay(); window.exitCWRoomLocal(); };

    window.FocusSupabase.from('cw_room_members').select('user_id, role').eq('room_id', leftRoomId)
        .then(({ data: members }) => {
            const others = (members || []).filter(m => m.user_id !== currentUser.id);

            const finish = () => window.FocusSupabase.from('cw_room_members')
                .delete().eq('room_id', leftRoomId).eq('user_id', currentUser.id)
                .then(({ error }) => {
                    if (error) console.error('[FocusAI] oda üyeliğinden çıkma hatası', error);
                    localExit();
                });

            chan?.send({ type: 'broadcast', event: 'participant_left', payload: { displayName: myName } });

            if (!others.length) {
                // Son kişi ayrılıyor — oturum tamamen biter
                window.FocusSupabase.from('cw_rooms').update({
                    active: false, ended_by_id: currentUser.id,
                    ended_by_name: myName, ended_at: new Date().toISOString()
                }).eq('id', leftRoomId).then(({ error }) => {
                    if (error) console.error('[FocusAI] oturumu sonlandırma hatası', error);
                    finish();
                });
                return;
            }

            const afterOwnership = () => {
                if (others.length === 1) {
                    // Geride tek kişi kaldı — "tek başına devam?" sorusu ona gitsin
                    chan?.send({ type: 'broadcast', event: 'solo_continue_prompt', payload: { leftDisplayName: myName } });
                }
                finish();
            };

            if (wasOwner) {
                // Sahiplik geride kalan bir üyeye devredilir. Doğrudan
                // cw_room_members.update({role}) BAŞKASININ satırını hedeflediği
                // için RLS'de reddediliyordu (policy sadece kendi satırına izin
                // veriyor) — bu yüzden security definer RPC kullanılıyor (070).
                const newOwner = others[Math.floor(Math.random() * others.length)];
                window.FocusSupabase.rpc('transfer_cw_room_ownership', {
                    p_room_id: leftRoomId, p_new_owner_id: newOwner.user_id
                }).then(({ data, error }) => {
                    if (error || !data?.ok) console.error('[FocusAI] oda sahipliği devri hatası', error || data?.error);
                    afterOwnership();
                });
            } else {
                afterOwnership();
            }
        })
        .catch(() => localExit());
}
window.gfLeaveSessionCompletely = gfLeaveSessionCompletely;
