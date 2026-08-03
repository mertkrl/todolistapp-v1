// ─── YAZIYOR... GÖSTERGESİ / OKUNDU BİLGİSİ ────────────────────────
// social.js dosyasından çıkarıldı (Faz 6, EN YÜKSEK riskli küme — 25 dış
// çağrı noktası vardı): DM/grup "yazıyor..." göstergesi (Firebase + Supabase
// broadcast), DM/grup okundu-bilgisi (✓/✓✓ ve "kim okudu" listesi).
//
// Dış bağımlılıklar (çekirdek sohbet koduna — social.js'te KALIYOR):
// - getCurrentUser() / window.FocusSupabase / getDB / getUser /
//   window._escapeHtml / dcAvatar → zaten window.* köprülüydü
// - window.__getDcMemberNames() → social-room-presence.js'in bıraktığı köprü
// - teardownDcTyping/setupDcTyping/notifyDcTyping/clearDcTypingNow/
//   teardownDmTypingSupabase/setupDmTypingSupabase/notifyDmTypingSupabase/
//   teardownDcGroupTypingSupabase/setupDcGroupTypingSupabase/notifyGroupTypingSupabase/
//   teardownDcGroupReadReceiptSupabase/setupDcGroupReadReceiptSupabase/
//   teardownDcReadReceipt/setupDcReadReceipt/setupDmReadReceiptSupabase/
//   updateDcReadReceipts/teardownDcGroupReadReceipt/setupDcGroupReadReceipt →
//   bu çıkarmada YENİ window.* köprüsü eklendi, social.js'teki 25 dış çağrı
//   noktası da window.*'a çevrildi (chat çekirdeğinin teardownDcSupabaseDmChannels
//   fonksiyonu dahil)
// - _dcSubtitleDefault / _dcCurrentConversation / _dcCurrentGroupScope /
//   _dcMsgRegistry → social.js'teki sohbet çekirdeğinde KALIYOR, bu kümede
import { getCurrentUser } from './state/current-user-store.js';
import { getDB, getUser, dcAvatar } from './social-misc-pure-utils.js';
//   sadece OKUNUYOR (reassign edilmiyor), salt-okunur getter yeterli
// - _dcOtherLastRead / _dcReadChannel → social.js'te KALIYOR, HEM bu kümede
//   HEM dışarıda (teardownDcSupabaseDmChannels) reassign edildiği için
//   getter+setter köprüsü kuruldu
// - _dcTypingMyRef / _dcTypingListenRef / _dcTypingTimeout /
//   _dcGroupReadSupaChannel / _dcGroupReadListenRef / _dcGroupReadPath /
//   _dcGroupLastRead / _dcReadListenRef / _dcReadPath / _dcUserInfoCache →
//   SADECE bu kümede kullanıldığı doğrulandı, köprü GEREKMEDİ — tanımları
//   social.js'ten silinip buraya taşındı
    let _dcTypingMyRef       = null;    // Kendi "yazıyor" durumumuzun ref'i
    let _dcTypingListenRef   = null;    // Karşı tarafın "yazıyor" durumunu dinleyen ref
    let _dcTypingTimeout     = null;    // Yazmayı bıraktıktan sonra durumu temizleyen zamanlayıcı
    let _dcReadListenRef     = null;    // Karşı tarafın "son okuma" zamanını dinleyen ref
    let _dcReadPath          = null;    // Aktif DM'in okundu-bilgisi yolu
    let _dcGroupReadSupaChannel = null; // M5c: group_read_receipts Realtime kanalı (Supabase grup)
    let _dcGroupReadListenRef = null;   // Grup üyelerinin "son okuma" zamanlarını dinleyen ref
    let _dcGroupReadPath      = null;   // Aktif grup odasının okundu-bilgisi yolu
    let _dcGroupLastRead      = {};     // username -> son okuma zaman damgası
    const _dcUserInfoCache    = {};     // username -> { displayName, customAvatar, avatarColor } önbelleği

    // ─── YAZIYOR... GÖSTERGESİ ───────────────────────────────
    window.teardownDcTyping = teardownDcTyping;
export function teardownDcTyping() {
        if (_dcTypingMyRef) {
            _dcTypingMyRef.onDisconnect().cancel();
            _dcTypingMyRef.remove().catch(() => {});
            _dcTypingMyRef = null;
        }
        if (_dcTypingListenRef) { _dcTypingListenRef.off(); _dcTypingListenRef = null; }
        clearTimeout(_dcTypingTimeout);
    }

    window.setupDcTyping = setupDcTyping;
export function setupDcTyping(typingBasePath, myUsername) {
        const database = getDB();
        if (!database) return;
        teardownDcTyping();

        _dcTypingMyRef = database.ref(`${typingBasePath}/${myUsername}`);
        _dcTypingMyRef.onDisconnect().remove();

        _dcTypingListenRef = database.ref(typingBasePath);
        _dcTypingListenRef.on('value', snap => {
            const data = snap.val() || {};
            const now = Date.now();
            const others = Object.keys(data).filter(u => u !== myUsername && data[u] && (now - data[u]) < 5000);
            const subtitleEl = document.getElementById('live-chat-target-desc');
            if (!subtitleEl) return;
            if (others.length > 0) {
                subtitleEl.innerHTML = `<span class="dc-typing-indicator"><span class="dc-typing-dots"><span></span><span></span><span></span></span> yazıyor</span>`;
            } else {
                subtitleEl.textContent = window.__getDcSubtitleDefault();
            }
        });
    }

    window.notifyDcTyping = notifyDcTyping;
export function notifyDcTyping() {
        if (window.__getDcCurrentConversation()) { notifyDmTypingSupabase(); return; }
        if (window.__getDcCurrentGroupScope() && _groupTypingController.isActive()) { notifyGroupTypingSupabase(); return; }
        if (!_dcTypingMyRef) return;
        _dcTypingMyRef.set(Date.now());
        clearTimeout(_dcTypingTimeout);
        _dcTypingTimeout = setTimeout(() => {
            if (_dcTypingMyRef) _dcTypingMyRef.remove();
        }, 3000);
    }

    window.clearDcTypingNow = clearDcTypingNow;
export function clearDcTypingNow() {
        if (window.__getDcCurrentConversation()) return;
        if (window.__getDcCurrentGroupScope() && _groupTypingController.isActive()) return;
        clearTimeout(_dcTypingTimeout);
        if (_dcTypingMyRef) _dcTypingMyRef.remove();
    }

    // ─── YAZIYOR... GÖSTERGESİ (DM — Supabase Realtime Broadcast) ─────
    // DM ve grup sohbetinde "yazıyor..." göstergesi birebir aynı mantığı ayrı
    // ayrı iki kopya halinde barındırıyordu — ortak bir fabrika fonksiyonuna
    // taşındı; sadece kanal adı ve state'i her tür için ayrı closure'da tutuluyor.
    function _createDcTypingController(getChannelName) {
        let channel = null;
        let showTimeout = null;
        function teardown() {
            if (channel) { window.FocusSupabase?.removeChannel(channel); channel = null; }
            clearTimeout(showTimeout);
            showTimeout = null;
        }
        function setup(arg) {
            teardown();
            if (!window.FocusSupabase || !getCurrentUser()?.id) return;
            channel = window.FocusSupabase
                .channel(getChannelName(arg))
                .on('broadcast', { event: 'typing' }, ({ payload }) => {
                    if (!payload || payload.user_id === getCurrentUser().id) return;
                    const name = payload.displayName || 'Karşı taraf';
                    const subtitleEl = document.getElementById('live-chat-target-desc');
                    const safeName = window._escapeHtml(name);
                    if (subtitleEl) subtitleEl.innerHTML = `<span class="dc-typing-indicator"><span class="u-font-size-11px_opacity-0p85"><b>"${safeName}"</b> yazıyor</span> <span class="dc-typing-dots"><span></span><span></span><span></span></span></span>`;
                    clearTimeout(showTimeout);
                    showTimeout = setTimeout(() => {
                        const el = document.getElementById('live-chat-target-desc');
                        if (el) el.textContent = window.__getDcSubtitleDefault();
                    }, 5000);
                })
                .subscribe();
        }
        function notify() {
            if (!channel || !getCurrentUser()?.id) return;
            channel.send({ type: 'broadcast', event: 'typing', payload: { user_id: getCurrentUser().id, displayName: getCurrentUser().displayName || getCurrentUser().username } });
        }
        function isActive() { return !!channel; }
        return { setup, notify, teardown, isActive };
    }

    const _dmTypingController    = _createDcTypingController(conversation => `dm-typing-${conversation.id}`);
    const _groupTypingController = _createDcTypingController(scope => `group-typing-${scope.type}-${scope.id}`);

    window.teardownDmTypingSupabase = teardownDmTypingSupabase;
export function teardownDmTypingSupabase() { _dmTypingController.teardown(); }
    window.setupDmTypingSupabase = setupDmTypingSupabase;
export function setupDmTypingSupabase(conversation) { _dmTypingController.setup(conversation); }
    window.notifyDmTypingSupabase = notifyDmTypingSupabase;
export function notifyDmTypingSupabase() { _dmTypingController.notify(); }

    window.teardownDcGroupTypingSupabase = teardownDcGroupTypingSupabase;
export function teardownDcGroupTypingSupabase() { _groupTypingController.teardown(); }
    window.setupDcGroupTypingSupabase = setupDcGroupTypingSupabase;
export function setupDcGroupTypingSupabase(scope) { _groupTypingController.setup(scope); }
    window.notifyGroupTypingSupabase = notifyGroupTypingSupabase;
export function notifyGroupTypingSupabase() { _groupTypingController.notify(); }

    // ─── OKUNDU BİLGİSİ (GRUP — Supabase group_read_receipts) M5c ──────────
    window.teardownDcGroupReadReceiptSupabase = teardownDcGroupReadReceiptSupabase;
export function teardownDcGroupReadReceiptSupabase() {
        if (_dcGroupReadSupaChannel) { window.FocusSupabase?.removeChannel(_dcGroupReadSupaChannel); _dcGroupReadSupaChannel = null; }
    }

    window.setupDcGroupReadReceiptSupabase = setupDcGroupReadReceiptSupabase;
export async function setupDcGroupReadReceiptSupabase(scope) {
        teardownDcGroupReadReceiptSupabase();
        if (!window.FocusSupabase || !getCurrentUser()?.id) return;

        const now = new Date().toISOString();
        await window.FocusSupabase
            .from('group_read_receipts')
            .upsert({ scope_type: scope.type, scope_id: scope.id, user_id: getCurrentUser().id, last_read_at: now });

        const { data } = await window.FocusSupabase
            .from('group_read_receipts')
            .select('user_id, last_read_at, profiles(username)')
            .eq('scope_type', scope.type)
            .eq('scope_id', scope.id);
        if (data) {
            _dcGroupLastRead = {};
            data.forEach(r => {
                const uname = r.profiles?.username;
                if (uname) _dcGroupLastRead[uname] = new Date(r.last_read_at).getTime();
            });
            renderDcGroupReadReceipt();
        }

        _dcGroupReadSupaChannel = window.FocusSupabase
            .channel(`group-reads-${scope.type}-${scope.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'group_read_receipts',
                filter: `scope_id=eq.${scope.id}` }, async payload => {
                if (window.__getDcCurrentGroupScope()?.id !== scope.id) return;
                const row = payload.new;
                if (!row) return;
                const { data: prof } = await window.FocusSupabase
                    .from('profiles').select('username').eq('id', row.user_id).maybeSingle();
                if (prof?.username) {
                    _dcGroupLastRead[prof.username] = new Date(row.last_read_at).getTime();
                    renderDcGroupReadReceipt();
                }
            })
            .subscribe();
    }

    // ─── OKUNDU BİLGİSİ (✓ / ✓✓) ──────────────────────────────
    window.teardownDcReadReceipt = teardownDcReadReceipt;
export function teardownDcReadReceipt() {
        if (_dcReadListenRef) { _dcReadListenRef.off(); _dcReadListenRef = null; }
        _dcReadPath = null;
        window.__setDcOtherLastRead(0);
    }

    window.setupDcReadReceipt = setupDcReadReceipt;
export function setupDcReadReceipt(dmId, myUsername, otherUsername) {
        const database = getDB();
        if (!database) return;
        teardownDcReadReceipt();

        _dcReadPath = `focusai_community/dm_meta/${dmId}/lastRead`;
        database.ref(`${_dcReadPath}/${myUsername}`).set(Date.now());

        _dcReadListenRef = database.ref(`${_dcReadPath}/${otherUsername}`);
        _dcReadListenRef.on('value', snap => {
            window.__setDcOtherLastRead(snap.val() || 0);
            updateDcReadReceipts();
        });
    }

    // ─── OKUNDU BİLGİSİ (DM — Supabase `message_reads`) ────────────────
    window.setupDmReadReceiptSupabase = setupDmReadReceiptSupabase;
export function setupDmReadReceiptSupabase(conversation, otherProfile) {
        if (!window.FocusSupabase || !getCurrentUser()?.id) return;
        window.__setDcOtherLastRead(0);

        window.FocusSupabase
            .from('message_reads')
            .upsert({ conversation_id: conversation.id, user_id: getCurrentUser().id, last_read_at: new Date().toISOString() })
            .then(({ error }) => { if (error) console.error('[DM] okundu bilgisi yazma hatası', error); });

        if (!otherProfile?.id) { updateDcReadReceipts(); return; }

        window.FocusSupabase
            .from('message_reads')
            .select('last_read_at')
            .eq('conversation_id', conversation.id)
            .eq('user_id', otherProfile.id)
            .maybeSingle()
            .then(({ data, error }) => {
                if (error) { console.error('[DM] okundu bilgisi okuma hatası', error); return; }
                window.__setDcOtherLastRead(data?.last_read_at ? new Date(data.last_read_at).getTime() : 0);
                updateDcReadReceipts();
            });

        window.__setDcReadChannel(window.FocusSupabase
            .channel(`dm-reads-${conversation.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reads', filter: `conversation_id=eq.${conversation.id}` }, payload => {
                const row = payload.new;
                if (!row || row.user_id !== otherProfile.id) return;
                window.__setDcOtherLastRead(row.last_read_at ? new Date(row.last_read_at).getTime() : 0);
                updateDcReadReceipts();
            })
            .subscribe());
    }

    window.updateDcReadReceipts = updateDcReadReceipts;
export function updateDcReadReceipts() {
        document.querySelectorAll('#sidebar-chat-messages-stream .dc-read-receipt').forEach(el => {
            const key = el.dataset.msgKey;
            const m = key && window.__getDcMsgRegistry()[key];
            if (!m) return;
            const seen = (m.timestamp || 0) <= window.__getDcOtherLastRead();
            el.classList.toggle('seen', seen);
            el.classList.toggle('sent', !seen);
            el.innerHTML = `<i class="fa-solid ${seen ? 'fa-check-double' : 'fa-check'}"></i>`;
        });
    }

    // ─── OKUNDU BİLGİSİ (GRUP — "kim okudu" listesi) ─────────────
    window.teardownDcGroupReadReceipt = teardownDcGroupReadReceipt;
export function teardownDcGroupReadReceipt() {
        if (_dcGroupReadListenRef) { _dcGroupReadListenRef.off(); _dcGroupReadListenRef = null; }
        teardownDcGroupReadReceiptSupabase();
        _dcGroupReadPath = null;
        _dcGroupLastRead = {};
    }

    window.setupDcGroupReadReceipt = setupDcGroupReadReceipt;
export function setupDcGroupReadReceipt(chatPath, myUsername) {
        const database = getDB();
        if (!database) return;
        teardownDcGroupReadReceipt();

        _dcGroupReadPath = `focusai_community/group_meta/${chatPath.replace(/\//g, '_')}/lastRead`;
        database.ref(`${_dcGroupReadPath}/${myUsername}`).set(Date.now());

        _dcGroupReadListenRef = database.ref(_dcGroupReadPath);
        _dcGroupReadListenRef.on('value', snap => {
            _dcGroupLastRead = snap.val() || {};
            renderDcGroupReadReceipt();
        });
    }

    // Sadece kendi gönderdiğimiz EN SON mesajın altına "kim okudu" bilgisini render eder
    function renderDcGroupReadReceipt() {
        const streamEl = document.getElementById('sidebar-chat-messages-stream');
        if (!streamEl) return;

        // Önceki göstergeyi temizle
        streamEl.querySelectorAll('.dc-group-read-receipt').forEach(el => el.remove());

        const myUsername = (getUser() || {}).username;
        if (!myUsername) return;

        // En son "benim" mesajım olan satırı bul
        const rows = streamEl.querySelectorAll('.dc-dm-msg-row.msg-me');
        const lastRow = rows[rows.length - 1];
        if (!lastRow) return;
        const msgKey = lastRow.dataset.msgKey;
        const m = msgKey && window.__getDcMsgRegistry()[msgKey];
        if (!m || !m.timestamp) return;

        const readers = (window.__getDcMemberNames() || [])
            .filter(u => u !== myUsername)
            .filter(u => (_dcGroupLastRead[u] || 0) >= m.timestamp);

        if (!readers.length) return;

        const receipt = document.createElement('div');
        receipt.className = 'dc-group-read-receipt';
        receipt.style.display = 'flex';
        receipt.style.alignItems = 'center';
        receipt.style.gap = '4px';
        receipt.style.justifyContent = 'flex-end';
        receipt.style.padding = '2px 4px 0';
        receipt.style.fontSize = '10px';
        receipt.style.color = 'rgba(255,255,255,0.35)';
        receipt.style.cursor = 'pointer';
        receipt.innerHTML = `<i class="fa-solid fa-check-double si-blue"></i> ${readers.length} kişi okudu`;
        receipt.addEventListener('click', () => showDcGroupReadersList(readers));
        lastRow.appendChild(receipt);
    }

    function showDcGroupReadersList(usernames) {
        const database = getDB();
        document.querySelectorAll('.dc-readers-popover').forEach(el => el.remove());

        const overlay = document.createElement('div');
        overlay.className = 'dc-readers-popover';
        overlay.innerHTML = `
            <div class="dc-readers-popover-inner">
                <div class="dc-readers-popover-title">Okuyanlar</div>
                <div class="dc-readers-popover-list">
                    ${usernames.map(u => `
                        <div class="dc-readers-popover-item" data-username="${u}">
                            <img class="dc-readers-popover-avatar" src="${dcAvatar(u, '6c5ce7')}" alt="">
                            <span class="dc-readers-popover-name">@${window._escapeHtml(u)}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('show'));

        const close = () => { overlay.classList.remove('show'); setTimeout(() => overlay.remove(), 160); };
        overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

        // İsim/avatarları yükle (önbellekten veya Firebase'den)
        if (database) {
            usernames.forEach(u => {
                const apply = (data) => {
                    const item = overlay.querySelector(`.dc-readers-popover-item[data-username="${u}"]`);
                    if (!item) return;
                    const nameEl = item.querySelector('.dc-readers-popover-name');
                    const avEl   = item.querySelector('.dc-readers-popover-avatar');
                    if (nameEl) nameEl.textContent = data.displayName || u;
                    if (avEl)   avEl.src = data.customAvatar || dcAvatar(data.displayName || u, data.avatarColor || '6c5ce7');
                };
                if (_dcUserInfoCache[u]) { apply(_dcUserInfoCache[u]); return; }
                database.ref(`focusai_community/users/${u}`).once('value').then(snap => {
                    const data = snap.val() || {};
                    _dcUserInfoCache[u] = data;
                    apply(data);
                });
            });
        }
    }
