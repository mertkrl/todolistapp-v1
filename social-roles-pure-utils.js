// social-roles-pure-utils.js
// social-roles.js'ten çıkarıldı: sadece kendi parametrelerine/DOM'a bağlı saf
// yardımcı fonksiyonlar — grup rolleri/izinler modülünün paylaşılan state'ine
// (Supabase kanalları, form state'i vb.) dokunmuyorlar.

export function _applyDynStyles(root) {
    if (!root) return;
    root.querySelectorAll('[data-dyn-bg]').forEach(el => { el.style.backgroundColor = el.getAttribute('data-dyn-bg'); });
    root.querySelectorAll('[data-dyn-color]').forEach(el => { el.style.color = el.getAttribute('data-dyn-color'); });
    root.querySelectorAll('[data-dyn-bdc]').forEach(el => { el.style.borderLeftColor = el.getAttribute('data-dyn-bdc'); });
    root.querySelectorAll('[data-dyn-shadow]').forEach(el => { el.style.boxShadow = el.getAttribute('data-dyn-shadow'); });
    root.querySelectorAll('[data-dyn-cursor]').forEach(el => { el.style.cursor = el.getAttribute('data-dyn-cursor'); });
    root.querySelectorAll('[data-dyn-opacity]').forEach(el => { el.style.opacity = el.getAttribute('data-dyn-opacity'); });
    root.querySelectorAll('[data-dyn-bordercolor]').forEach(el => { el.style.borderColor = el.getAttribute('data-dyn-bordercolor'); });
}

// Bir rolün izinlerini küçük etiketler halinde listeler ("Roller & İzinler" satırları için)
export function _gmPermLabelList(r) {
    const perms = [];
    if (r.manageRooms)  perms.push('<i class="fa-solid fa-hashtag" title="Oda Kurma"></i> Oda Kurma');
    if (r.kickMembers)  perms.push('<i class="fa-solid fa-user-xmark" title="Üye Ekleme / Üye Atma"></i> Üye Ekleme / Üye Atma');
    if (r.lockRooms)    perms.push('<i class="fa-solid fa-lock" title="Oda Kilitleme"></i> Oda Kilitleme');
    if (r.assignRoles)  perms.push('<i class="fa-solid fa-user-tag" title="Rol Atama"></i> Rol Atama');
    return perms.length ? perms.join('<span class="u-opacity-0p3">•</span>') : 'İzin tanımlanmadı';
}

export function _gmPermBadges(perms) {
    if (!perms) return '';
    const items = [];
    if (perms.manageRooms) items.push('<i class="fa-solid fa-hashtag" title="Oda kurma izni" class="si-blue"></i>');
    if (perms.kickMembers) items.push('<i class="fa-solid fa-user-xmark" title="Üye ekleme / üye atma izni" class="si-red"></i>');
    if (perms.lockRooms)   items.push('<i class="fa-solid fa-lock" title="Oda kilitleme izni" class="si-yellow"></i>');
    if (perms.assignRoles) items.push('<i class="fa-solid fa-user-tag u-color-h6c5ce7" title="Rol atama izni" ></i>');
    if (!items.length) return '<span class="u-font-size-10px_color-rgba2552552550p3">izin yok</span>';
    return `<span class="u-display-inline-flex_gap-6px_font-size-11px">${items.join('')}</span>`;
}

export function _ensurePermOverrideStyles() {
    if (document.getElementById('gm-perm-override-styles')) return;
    const style = document.createElement('style');
    style.id = 'gm-perm-override-styles';
    style.textContent = `
        .gm-override-toggle { position:relative; display:inline-block; width:34px; height:20px; flex-shrink:0; }
        .gm-override-toggle input { opacity:0; width:0; height:0; }
        .gm-override-toggle .gm-toggle-track {
            position:absolute; inset:0; background:rgba(255,255,255,0.12); border-radius:999px;
            transition:background 0.18s ease; cursor:pointer;
        }
        .gm-override-toggle .gm-toggle-track::before {
            content:''; position:absolute; left:2px; top:2px; width:16px; height:16px; border-radius:50%;
            background:#fff; transition:transform 0.18s ease; box-shadow:0 1px 3px rgba(0,0,0,0.3);
        }
        .gm-override-toggle input:checked + .gm-toggle-track { background:#feca57; }
        .gm-override-toggle input:checked + .gm-toggle-track::before { transform:translateX(14px); }
        .gm-perm-override-popover::-webkit-scrollbar { width:6px; }
        .gm-perm-override-popover ::-webkit-scrollbar { width:6px; }
        .gm-perm-override-popover ::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.12); border-radius:99px; }
        .gm-override-row { transition: background 0.15s ease, border-color 0.15s ease; }
        .gm-override-row:hover { background:rgba(255,255,255,0.055) !important; border-color:rgba(255,255,255,0.1) !important; }
    `;
    document.head.appendChild(style);
}
