import { _gotoClassroomSubtab } from './social-institution-panel.js';

// Öğretmenin Genel Bakış'ta gördüğü kısayol widget'ı — Apple'ın "widget ekle" galerisine
// benzer: "Düzenle" butonu bir galeri açar, öğretmen oradan istediği kısayolu widget
// şeridine SÜRÜKLEYİP bırakabilir ya da tıklayarak ekleyip çıkarabilir; widget içindeki
// kartlar da sürüklenerek yeniden sıralanabilir. Seçim + sıra tarayıcıya (localStorage)
// grup bazında kaydedilir — sunucu tarafında saklanmaz, cihaza özeldir.
// social-institution-panel.js'ten çıkarıldı: 6 mutable değişken (selected/galleryOpen/
// panelOpen/dragId/dragFromGrid/liveOrder) tek bir paylaşılan `w.state` objesine taşınmıştı,
// tüm fonksiyonlar sadece `w` (widget context) parametresi üzerinden çalışıyor — kendi
// içinde tamamen izole, sadece _gotoClassroomSubtab'a dışarıdan bağımlı.
function _ctShortcutDefs(memberLabel) {
    return {
        'asg-add':    { icon: 'fa-plus',          label: 'Ödev Ekle',      subtab: 'odevler',   openAdd: true },
        'performans': { icon: 'fa-chart-line',    label: 'Performans',     subtab: 'performans' },
        'roster':     { icon: 'fa-users',         label: `${memberLabel}ler`, subtab: 'roster' },
        'rapor':      { icon: 'fa-file-pdf',      label: 'Rapor',          subtab: 'rapor' },
        'program':    { icon: 'fa-calendar-days', label: 'Ders Programı',  subtab: 'program' },
    };
}
function _ctSwLoadIds(w) {
    let ids;
    try { ids = JSON.parse(localStorage.getItem(w.storeKey) || 'null', window._safeJsonReviver); } catch { ids = null; }
    if (!Array.isArray(ids)) ids = w.DEFAULT_IDS.slice();
    return ids.filter(id => w.defs[id]);
}
function _ctSwSaveIds(w, ids) {
    try { localStorage.setItem(w.storeKey, JSON.stringify(ids)); } catch {}
}
function _ctSwGotoSubtab(w, id) {
    const def = w.defs[id];
    if (!def) return;
    _gotoClassroomSubtab(def.subtab, { openAdd: def.openAdd });
}
// Sadece kart şeridini (grid) yeniden çizer — sürükleme sırasında sık çağrılır,
// galeriyi de her seferinde yeniden kurmak gereksiz DOM/olay maliyeti yaratır.
function _ctSwRenderGrid(w, idsOverride) {
    const grid = w.wrap.querySelector('#grp-intro-shortcuts');
    if (!grid) return;
    const ids = idsOverride || w.state.selected;
    const tileHtml = (id) => {
        const def = w.defs[id];
        const isGhost = w.state.dragFromGrid === false && id === w.state.dragId; // galeriden henüz bırakılmamış önizleme kartı
        return `<button type="button" class="grp-intro-shortcut-btn${id === w.state.dragId ? ' is-dragging' : ''}${isGhost ? ' is-ghost' : ''}" draggable="true" data-shortcut="${id}">
            <i class="fa-solid fa-grip-vertical grp-intro-shortcut-handle"></i>
            <i class="fa-solid ${def.icon}"></i><span>${def.label}</span>
        </button>`;
    };
    grid.innerHTML = `${ids.map(tileHtml).join('')}
        <button type="button" class="grp-intro-shortcut-btn grp-intro-shortcut-edit" id="grp-intro-shortcut-edit-btn">
            <i class="fa-solid fa-sliders"></i><span>Düzenle</span>
        </button>`;
}
function _ctSwRender(w) {
    const galleryRowHtml = (id) => {
        const def = w.defs[id];
        const isOn = w.state.selected.includes(id);
        return `<div class="grp-shortcut-gallery-item${isOn ? ' is-added' : ''}" draggable="true" data-shortcut="${id}" title="Widget'a sürükle ya da tıkla">
            <i class="fa-solid ${def.icon}"></i><span>${def.label}</span>
            <i class="fa-solid ${isOn ? 'fa-check' : 'fa-plus'} grp-shortcut-gallery-toggle"></i>
        </div>`;
    };
    w.wrap.innerHTML = `
        <button type="button" class="grp-intro-shortcuts-toggle" id="grp-intro-shortcuts-toggle">
            <i class="fa-solid fa-grip-vertical"></i> Kısayollar
            <i class="fa-solid fa-chevron-${w.state.panelOpen ? 'up' : 'down'} u-margin-left-auto" ></i>
        </button>
        <div class="grp-intro-shortcuts-collapse${w.state.panelOpen ? '' : ' hidden'}" id="grp-intro-shortcuts-collapse">
            <div class="grp-intro-shortcuts" id="grp-intro-shortcuts"></div>
            <div class="grp-shortcut-gallery${w.state.galleryOpen ? '' : ' hidden'}" id="grp-shortcut-gallery">
                <div class="grp-shortcut-gallery-hint"><i class="fa-solid fa-hand-pointer"></i> Widget'a eklemek için sürükle ya da tıkla</div>
                <div class="grp-shortcut-gallery-list">
                    ${Object.keys(w.defs).map(galleryRowHtml).join('')}
                </div>
            </div>
        </div>`;
    _ctSwRenderGrid(w);
    _ctSwBindGridOnce(w);
    _ctSwBindGallery(w);

    w.wrap.querySelector('#grp-intro-shortcuts-toggle')?.addEventListener('click', () => {
        w.state.panelOpen = !w.state.panelOpen;
        try { localStorage.setItem(w.openStoreKey, w.state.panelOpen ? '1' : '0'); } catch {}
        _ctSwRender(w);
    });
}
// Sürüklenen kartın, imlecin üstünde durduğu kart hedefine göre nerede duracağını
// hesaplar — iOS'ta widget taşırken diğer kartların kayarak yer açması gibi, burada
// da her dragover'da diziyi yeniden kurup grid'i anında yeniden çiziyoruz.
function _ctSwPreviewInsertAt(w, targetBtn, clientX) {
    if (!w.state.dragId || !w.defs[w.state.dragId]) return;
    const base = w.state.selected.filter(x => x !== w.state.dragId);
    const targetId = targetBtn.dataset.shortcut;
    let idx = base.indexOf(targetId);
    if (idx === -1) idx = base.length;
    else {
        const rect = targetBtn.getBoundingClientRect();
        if (clientX > rect.left + rect.width / 2) idx += 1;
    }
    base.splice(idx, 0, w.state.dragId);
    if (w.state.liveOrder && w.state.liveOrder.join('|') === base.join('|')) return; // değişmediyse yeniden çizme
    w.state.liveOrder = base;
    _ctSwRenderGrid(w, w.state.liveOrder);
}
// Grid konteynerine TEK SEFERLİK olay delegasyonu bağlanır — renderGrid() sürükleme
// sırasında saniyede onlarca kez çağrılabildiği için (her dragover'da), dinleyicileri
// her seferinde tek tek karta bağlamak yığılan (duplicate) event listener'lara yol
// açardı. Bunun yerine kalıcı konteynerin kendisine bağlanıp e.target.closest ile
// hangi karta denk geldiği bulunuyor.
function _ctSwBindGridOnce(w) {
    const grid = w.wrap.querySelector('#grp-intro-shortcuts');
    if (!grid || grid.dataset.bound) return;
    grid.dataset.bound = '1';

    grid.addEventListener('click', (e) => {
        if (e.target.closest('#grp-intro-shortcut-edit-btn')) {
            w.state.galleryOpen = !w.state.galleryOpen;
            _ctSwRender(w);
            return;
        }
        if (w.state.dragId) return;
        const btn = e.target.closest('.grp-intro-shortcut-btn[data-shortcut]');
        if (btn) _ctSwGotoSubtab(w, btn.dataset.shortcut);
    });
    grid.addEventListener('dragstart', (e) => {
        const btn = e.target.closest('.grp-intro-shortcut-btn[data-shortcut]');
        if (!btn) return;
        w.state.dragId = btn.dataset.shortcut;
        w.state.dragFromGrid = true;
        w.state.liveOrder = null;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', w.state.dragId);
    });
    grid.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (!w.state.dragId) return;
        const btn = e.target.closest('.grp-intro-shortcut-btn[data-shortcut]');
        if (btn) { _ctSwPreviewInsertAt(w, btn, e.clientX); return; }
        // Boş alan ya da "Düzenle" butonu üstü → sona ekle.
        const base = w.state.selected.filter(x => x !== w.state.dragId);
        const asEnd = [...base, w.state.dragId];
        if (w.state.liveOrder && w.state.liveOrder.join('|') === asEnd.join('|')) return;
        w.state.liveOrder = asEnd;
        _ctSwRenderGrid(w, w.state.liveOrder);
    });
    grid.addEventListener('drop', (e) => {
        e.preventDefault();
        _ctSwCommitDrag(w);
    });
    grid.addEventListener('dragleave', (e) => {
        if (grid.contains(e.relatedTarget)) return; // hâlâ grid içindeyiz, sıfırlama
        w.state.liveOrder = null;
        if (!w.state.dragFromGrid) _ctSwRenderGrid(w); // galeriden gelen önizleme kartını kaldır
    });
}
function _ctSwCommitDrag(w) {
    if (w.state.dragId && w.defs[w.state.dragId]) {
        w.state.selected = w.state.liveOrder || (w.state.selected.includes(w.state.dragId) ? w.state.selected : [...w.state.selected, w.state.dragId]);
        _ctSwSaveIds(w, w.state.selected);
    }
    w.state.dragId = null;
    w.state.dragFromGrid = false;
    w.state.liveOrder = null;
    _ctSwRender(w);
}
function _ctSwBindGallery(w) {
    const gallery = w.wrap.querySelector('#grp-shortcut-gallery');
    gallery?.querySelectorAll('.grp-shortcut-gallery-item').forEach(item => {
        item.addEventListener('click', () => {
            const id = item.dataset.shortcut;
            if (w.state.selected.includes(id)) w.state.selected = w.state.selected.filter(x => x !== id);
            else w.state.selected.push(id);
            _ctSwSaveIds(w, w.state.selected);
            _ctSwRender(w);
        });
        item.addEventListener('dragstart', (e) => {
            w.state.dragId = item.dataset.shortcut;
            w.state.dragFromGrid = false;
            w.state.liveOrder = null;
            e.dataTransfer.effectAllowed = 'copy';
            e.dataTransfer.setData('text/plain', w.state.dragId);
        });
        item.addEventListener('dragend', () => {
            // Widget üstünde bırakılmadıysa (drop grid'de tetiklenmediyse) sıfırla.
            if (w.state.dragId) { w.state.dragId = null; w.state.dragFromGrid = false; w.state.liveOrder = null; _ctSwRenderGrid(w); }
        });
    });
}
window._renderClassroomShortcutsWidget = _renderClassroomShortcutsWidget; // social-institution-classroom-insights.js için (circular import kırma)
export function _renderClassroomShortcutsWidget(introEl, data, memberLabel) {
    const wrap = introEl.querySelector('#grp-intro-shortcuts-wrap');
    if (!wrap) return;
    const defs = _ctShortcutDefs(memberLabel);
    const DEFAULT_IDS = ['asg-add', 'performans', 'roster', 'rapor'];
    const storeKey = `dc_grp_shortcuts_${data._supaId || data.code || 'x'}`;
    // Widget artık Genel Bakış'ı kalabalıklaştırmasın diye varsayılan KAPALI —
    // bir butona basınca açılıp kapanıyor (2026-07-12, kullanıcı geri bildirimi:
    // "çok karmakarışık"). Açık/kapalı tercihi cihaza özel hatırlanır.
    const openStoreKey = `${storeKey}_open`;
    const w = { wrap, data, memberLabel, defs, DEFAULT_IDS, storeKey, openStoreKey, state: null };
    w.state = {
        selected: _ctSwLoadIds(w),
        galleryOpen: false,
        panelOpen: localStorage.getItem(openStoreKey) === '1',
        dragId: null,       // sürüklenen kısayol id'si (galeriden ya da widget'ın kendisinden)
        dragFromGrid: false, // widget içinden mi sürükleniyor (sıralama) yoksa galeriden mi (ekleme)
        liveOrder: null,     // sürükleme sırasında canlı önizleme dizisi (iOS widget taşıma efekti)
    };
    _ctSwRender(w);
}
