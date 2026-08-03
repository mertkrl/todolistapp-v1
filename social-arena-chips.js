import { getUser } from './social-misc-pure-utils.js';
// social-arena-chips.js
// social.js'ten çıkarıldı (Faz E — çekirdek bölge derin taraması, 2026-07-23):
// Arena grup çipleri (ücretsiz planda sol ray yerine geçen yatay çip barı)
// + "+ Ekle" menüsü. Kendi state'i (_arenaChipCurrent) getter/setter ile
// köprülendi (dcOpenGroupPanel — social.js'te kalan çekirdek fonksiyon —
// bu state'i tek noktadan yazıyor).
//
// Dış bağımlılıklar (window.* üzerinden): window.closeDcChat,
// window.dcSetMainView, window.dcOpenGroupPanel, getUser,
// window._escapeHtml, window.renderHomeSummary, window.dcShowToast,
// window.joinGroupWithCode, window.showFocusaiConfirm.
// ─── ARENA GRUP ÇİPLERİ (Faz 1, ücretsiz görünüm) ───────────
// Ücretsiz planda sol ray tamamen gizli (CSS: body.dc-chat-disabled) —
// grup geçişi Arena üstündeki bu yatay çip barından yapılır. Bar her zaman
// render edilir ama yalnızca dc-chat-disabled iken CSS ile görünür olur
// (premium/kurumsalda ray geri gelir, bar gizlenir).
let _arenaChipCurrent = null;
export const _setArenaChipCurrent = (v) => { _arenaChipCurrent = v; }; // social.js'in dcOpenGroupPanel'i için

export function _updateArenaChipActive() {
        const bar = document.getElementById('arena-group-chips');
        if (!bar) return;
        const area = document.getElementById('dc-chat-area');
        const isPanel = !!area && area.classList.contains('dc-view-group-panel');
        bar.querySelectorAll('.agc-chip').forEach(c => {
            const active = isPanel
                ? (!!c.dataset.agcCode && c.dataset.agcCode === _arenaChipCurrent)
                : c.dataset.agc === 'home';
            c.classList.toggle('active', active);
        });
    }
    window._updateArenaChipActive = _updateArenaChipActive;

export function renderArenaGroupChips(groups) {
        const bar = document.getElementById('arena-group-chips');
        if (!bar) return;
        bar.innerHTML = '';

        const mkChip = (cls, html, onClick) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'agc-chip' + (cls ? ' ' + cls : '');
            b.innerHTML = html;
            b.addEventListener('click', onClick);
            bar.appendChild(b);
            return b;
        };

        mkChip('agc-chip--home', '<i class="fa-solid fa-trophy"></i> Sosyal', () => {
            if (typeof window.closeDcChat === 'function') window.closeDcChat();
            window.dcSetMainView('home');
            if (typeof window.renderHomeSummary === 'function') window.renderHomeSummary();
        }).dataset.agc = 'home';

        (groups || []).forEach(g => {
            const chip = mkChip('', `<i class="fa-solid fa-people-group"></i> ${window._escapeHtml(g.name || g.code)}`, () => {
                window.dcOpenGroupPanel(g.code);
            });
            chip.dataset.agcCode = g.code;
            chip.title = 'Grup paneli: istatistikler, seanslar, duyurular';
        });

        const addChip = mkChip('agc-chip--add', '<i class="fa-solid fa-plus"></i> Ekle', (e) => {
            e.stopPropagation();
            _openArenaAddMenu(addChip);
        });
        addChip.dataset.agc = 'add';
        addChip.title = 'Arkadaş ekle, gruba katıl veya grup kur';

        _updateArenaChipActive();
    }

    // ─── "+ EKLE" MENÜSÜ (Faz 2) ────────────────────────────────
    // Sol raydaki dağınık giriş noktalarının (arkadaş ekle, kodla katıl, grup
    // kur, keşfet) ücretsiz görünümdeki tek toplama noktası. Çip barı yatay
    // scroll'lu olduğundan menü body'ye fixed konumla eklenir.
    function _openArenaAddMenu(anchor) {
        const existing = document.getElementById('arena-add-menu');
        if (existing) { existing.remove(); return; } // aynı çipe ikinci tık: kapat
        const r = anchor.getBoundingClientRect();
        const menu = document.createElement('div');
        menu.id = 'arena-add-menu';
        menu.className = 'arena-add-menu';
        menu.style.top = (r.bottom + 6) + 'px';
        menu.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 232)) + 'px';
        menu.innerHTML = `
            <button type="button" class="aam-item" data-aam="friend"><i class="fa-solid fa-user-plus"></i> Kişi Ekle</button>
            <button type="button" class="aam-item" data-aam="join"><i class="fa-solid fa-key"></i> Kodla Gruba Katıl</button>
            <button type="button" class="aam-item" data-aam="create"><i class="fa-solid fa-plus"></i> Grup Kur</button>
            <button type="button" class="aam-item" data-aam="discover"><i class="fa-solid fa-earth-americas"></i> Grupları Keşfet</button>`;
        document.body.appendChild(menu);

        const onDoc = (e) => {
            if (menu.contains(e.target) || e.target === anchor || anchor.contains(e.target)) return;
            close();
        };
        const close = () => { menu.remove(); document.removeEventListener('click', onDoc, true); };
        setTimeout(() => document.addEventListener('click', onDoc, true), 0);

        const needProfile = () => {
            if (getUser()) return false;
            close();
            document.getElementById('social-setup-modal')?.classList.remove('hidden');
            return true;
        };

        menu.querySelectorAll('.aam-item').forEach(item => item.addEventListener('click', () => {
            const act = item.dataset.aam;
            if (act === 'friend') {
                if (needProfile()) return;
                close();
                const modal = document.getElementById('add-friend-modal');
                if (modal) {
                    modal.classList.remove('hidden');
                    const res = document.getElementById('add-friend-result'); if (res) res.innerHTML = '';
                    const inp = document.getElementById('add-friend-input'); if (inp) { inp.value = ''; inp.focus(); }
                }
            } else if (act === 'create') {
                if (needProfile()) return;
                close();
                document.getElementById('premium-create-group-modal')?.classList.remove('hidden');
            } else if (act === 'discover') {
                close();
                const dBtn = document.getElementById('group-discover-modal-btn');
                if (dBtn) dBtn.click();
                else document.getElementById('group-discover-modal')?.classList.remove('hidden');
            } else if (act === 'join') {
                if (needProfile()) return;
                // Menü içinde mini form: kod gir → katıl
                menu.innerHTML = `
                    <div class="aam-join-row">
                        <input type="text" id="aam-join-input" maxlength="8" placeholder="Grup kodu" autocomplete="off" spellcheck="false">
                        <button type="button" id="aam-join-go" title="Katıl" aria-label="Katıl"><i class="fa-solid fa-arrow-right"></i></button>
                    </div>`;
                const jin = menu.querySelector('#aam-join-input');
                const go = () => {
                    const code = (jin.value || '').trim();
                    if (!/^[a-z0-9]{4,8}$/i.test(code)) { window.dcShowToast('Geçerli bir grup kodu gir (4-8 harf/rakam).'); return; }
                    close();
                    if (typeof window.joinGroupWithCode === 'function') window.joinGroupWithCode(code);
                };
                menu.querySelector('#aam-join-go').addEventListener('click', go);
                jin.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
                jin.focus();
            }
        }));
    }

