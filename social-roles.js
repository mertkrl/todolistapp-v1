// social-roles.js — Grup rolleri, izinler, üyelik yönetimi (moderasyon paneli)
// social.js'ten çıkarıldı; ayrı top-level scope'ta çalışır — social.js'in IIFE-özel değişkenlerine
// (window.currentUser gibi) doğrudan erişemez, bu yüzden window.currentUser kullanılır (social.js her atamada senkronlar).

// =======================================================================
// YENİ EKLENEN: SOHBET ALT ODALARI, RÜTBE VE YÖNETİM SİSTEMİ FONKSİYONLARI
// =======================================================================

// ─── ÖZEL ROL & İZİN SİSTEMİ ────────────────────────────
// Yerleşik roller için varsayılan izinler. Özel roller "groups/{code}/customRoles/{roleId}" altında saklanır.
// Hiyerarşi: yüksek "priority" düşük olanı yönetebilir (admin her zaman en üstte, üye en altta)
const BUILTIN_ROLE_PERMS = {
    admin:     { name: 'Admin',     color: 'ff4757', manageRooms: true,  kickMembers: true,  lockRooms: true,  assignRoles: true,  manageSessions: true,  priority: 1000 },
    moderator: { name: 'Moderatör', color: '74b9ff', manageRooms: true,  kickMembers: true,  lockRooms: false, assignRoles: true,  manageSessions: true,  priority: 500  },
    member:    { name: 'Üye',       color: '636e72', manageRooms: false, kickMembers: false, lockRooms: false, assignRoles: false, manageSessions: false, priority: 0    }
};
// social.js bu sabite window. öneki OLMADAN, çıplak global olarak erişiyor (bkz. social.js:15399,
// 20205) — bu dosya IIFE ile sarılmadığı için zaten bir global'di; burada window.X olarak da
// açıkça dışa vermek davranışı değiştirmiyor, sadece dosyalar-arası bu bağımlılığı belgeliyor.
window.BUILTIN_ROLE_PERMS = BUILTIN_ROLE_PERMS;
const CUSTOM_ROLE_BASE_PRIORITY = 100; // özel roller varsayılan olarak Üye ile Moderatör arasına yerleşir
const MAX_CUSTOM_ROLES = 10; // bir grupta oluşturulabilecek en fazla özel rol sayısı

// Bir rolün hiyerarşi sırasını döndürür (yerleşik veya özel)
function getRolePriority(role, customRoles) {
    if (BUILTIN_ROLE_PERMS[role]) return BUILTIN_ROLE_PERMS[role].priority;
    const cr = customRoles && customRoles[role];
    return (cr && typeof cr.priority === 'number') ? cr.priority : CUSTOM_ROLE_BASE_PRIORITY;
}
window.getRolePriority = getRolePriority;

// Bir üyenin (yerleşik veya özel) rolüne göre izinlerini getirir
// channelCtx verilirse (ör. {subId}) o kanala özel izin istisnaları (override) da değerlendirilir
// Firebase kaldırıldı: Firebase-dönemi grupları artık yok; bu çağrı her zaman
// 'Üye' izinleriyle döner. Supabase gruplarında getMemberPermissionsSupabase kullanılır.
function getMemberPermissions(groupId, username, callback) {
    callback({ ...BUILTIN_ROLE_PERMS.member, role: 'member' });
}
window.getMemberPermissions = getMemberPermissions;

// Bir rolün izinlerini küçük etiketler halinde listeler ("Roller & İzinler" satırları için)
function _gmPermLabelList(r) {
    const perms = [];
    if (r.manageRooms)  perms.push('<i class="fa-solid fa-hashtag" title="Oda Kurma"></i> Oda Kurma');
    if (r.kickMembers)  perms.push('<i class="fa-solid fa-user-xmark" title="Üye Ekleme / Üye Atma"></i> Üye Ekleme / Üye Atma');
    if (r.lockRooms)    perms.push('<i class="fa-solid fa-lock" title="Oda Kilitleme"></i> Oda Kilitleme');
    if (r.assignRoles)  perms.push('<i class="fa-solid fa-user-tag" title="Rol Atama"></i> Rol Atama');
    return perms.length ? perms.join('<span style="opacity:0.3;">•</span>') : 'İzin tanımlanmadı';
}

// Rol formunu "düzenleme" moduna geçirir ve mevcut rol verileriyle doldurur
// isBuiltin: true ise (örn. Moderatör), sadece izinler düzenlenebilir; ad/renk/hiyerarşi sabittir
function enterRoleEditMode(groupId, roleId, role, isBuiltin) {
    if (!role) return;
    const section = document.getElementById('gm-create-role-section');
    const editingInput = document.getElementById('gm-editing-role-id');
    const nameInput = document.getElementById('gm-new-role-name');
    const titleText = document.getElementById('gm-role-form-title-text');
    const icon = document.getElementById('gm-role-form-icon');
    const cancelBtn = document.getElementById('gm-role-form-cancel-btn');
    const submitIcon = document.getElementById('gm-role-submit-icon');
    const submitText = document.getElementById('gm-role-submit-text');
    if (!section || !editingInput || !nameInput) return;

    section.classList.remove('hidden');
    editingInput.value = roleId;
    editingInput.dataset.builtin = isBuiltin ? '1' : '';
    nameInput.value = role.name || '';
    nameInput.disabled = !!isBuiltin;
    const createBtnEl = document.getElementById('gm-create-role-btn');
    if (createBtnEl) { createBtnEl.disabled = false; createBtnEl.style.opacity = ''; createBtnEl.style.cursor = ''; }

    document.querySelectorAll('.gm-role-color-opt').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.color === (role.color || '6c5ce7'));
        opt.style.pointerEvents = isBuiltin ? 'none' : '';
        opt.style.opacity = isBuiltin ? '0.4' : '';
    });
    const mr = document.getElementById('gm-perm-manage-rooms');
    const km = document.getElementById('gm-perm-kick-members');
    const lr = document.getElementById('gm-perm-lock-rooms');
    const ar = document.getElementById('gm-perm-assign-roles');
    if (mr) mr.checked = !!role.manageRooms;
    if (km) km.checked = !!role.kickMembers;
    if (lr) lr.checked = !!role.lockRooms;
    if (ar) ar.checked = !!role.assignRoles;

    if (titleText) titleText.textContent = isBuiltin ? `"${role.name}" İzinlerini Düzenle (Yerleşik Rol)` : `"${role.name}" Rolünü Düzenle`;
    if (icon) { icon.className = 'fa-solid fa-pen-to-square'; icon.style.color = '#a29bfe'; }
    if (cancelBtn) cancelBtn.classList.remove('hidden');
    if (submitIcon) submitIcon.className = 'fa-solid fa-floppy-disk';
    if (submitText) submitText.textContent = 'Değişiklikleri Kaydet';

    updateRolePreviewChip();
    section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Rol formunu varsayılan "yeni rol oluştur" moduna sıfırlar
function resetRoleForm() {
    const editingInput = document.getElementById('gm-editing-role-id');
    const nameInput = document.getElementById('gm-new-role-name');
    const titleText = document.getElementById('gm-role-form-title-text');
    const icon = document.getElementById('gm-role-form-icon');
    const cancelBtn = document.getElementById('gm-role-form-cancel-btn');
    const submitIcon = document.getElementById('gm-role-submit-icon');
    const submitText = document.getElementById('gm-role-submit-text');

    if (editingInput) { editingInput.value = ''; editingInput.dataset.builtin = ''; }
    if (nameInput) { nameInput.value = ''; nameInput.disabled = false; }
    document.querySelectorAll('.gm-role-color-opt').forEach((opt, idx) => {
        opt.classList.toggle('selected', idx === 0);
        opt.style.pointerEvents = '';
        opt.style.opacity = '';
    });
    const mr = document.getElementById('gm-perm-manage-rooms');
    const km = document.getElementById('gm-perm-kick-members');
    const lr = document.getElementById('gm-perm-lock-rooms');
    const ar = document.getElementById('gm-perm-assign-roles');
    if (mr) mr.checked = false;
    if (km) km.checked = false;
    if (lr) lr.checked = false;
    if (ar) ar.checked = false;

    if (titleText) titleText.textContent = 'Yeni Rol Oluştur';
    if (icon) { icon.className = 'fa-solid fa-circle-plus'; icon.style.color = '#2ed573'; }
    if (cancelBtn) cancelBtn.classList.add('hidden');
    if (submitIcon) submitIcon.className = 'fa-solid fa-plus';
    if (submitText) submitText.textContent = 'Rolü Oluştur';

    updateRolePreviewChip();
}
window.resetRoleForm = resetRoleForm;

// Rol oluşturma formundaki canlı önizleme rozetini günceller
function updateRolePreviewChip() {
    const chip = document.getElementById('gm-role-preview-chip');
    const dot  = document.getElementById('gm-role-preview-dot');
    const nameEl = document.getElementById('gm-role-preview-name');
    if (!chip || !dot || !nameEl) return;
    const nameInput = document.getElementById('gm-new-role-name');
    const colorOpt = document.querySelector('.gm-role-color-opt.selected');
    const color = colorOpt ? colorOpt.dataset.color : '6c5ce7';
    const name = (nameInput && nameInput.value.trim()) || 'Yeni Rol';
    chip.style.background = `#${color}26`;
    chip.style.color = `#${color}`;
    chip.style.borderColor = `#${color}55`;
    dot.style.background = `#${color}`;
    nameEl.textContent = name;
}

// ─── DENETİM KAYDI (GEÇMİŞ) ─────────────────────────────
const GM_AUDIT_TYPE_META = {
    role_assign:    { icon: 'fa-user-tag',         color: '6c5ce7' },
    role_change:    { icon: 'fa-user-tag',         color: '6c5ce7' },
    role_create:    { icon: 'fa-circle-plus',      color: '2ed573' },
    role_edit:      { icon: 'fa-pen-to-square',    color: 'a29bfe' },
    role_delete:    { icon: 'fa-trash-can',        color: 'ff4757' },
    member_kick:    { icon: 'fa-user-xmark',       color: 'ff4757' },
    member_approve: { icon: 'fa-user-check',       color: '2ed573' },
    member_reject:  { icon: 'fa-user-slash',       color: 'ff7675' },
    room_lock:      { icon: 'fa-lock',             color: 'feca57' },
    room_unlock:    { icon: 'fa-lock-open',        color: 'feca57' },
    settings_change:{ icon: 'fa-sliders',          color: '74b9ff' },
    ownership_transfer: { icon: 'fa-crown',        color: 'feca57' },
    announcement_update: { icon: 'fa-bullhorn',    color: '74b9ff' },
    channel_create:    { icon: 'fa-folder-plus',   color: '2ed573' },
    channel_rename:    { icon: 'fa-pen-to-square', color: 'a29bfe' },
    channel_delete:    { icon: 'fa-trash-can',     color: 'ff4757' },
    subchannel_create: { icon: 'fa-circle-plus',   color: '2ed573' },
    subchannel_rename: { icon: 'fa-pen-to-square', color: 'a29bfe' },
    subchannel_delete: { icon: 'fa-trash-can',     color: 'ff4757' }
};

// M2b-4 Bölüm 1: Supabase grupları için logGroupAudit eşdeğeri (fire-and-forget)
function logGroupAuditSupabase(groupId, type, detail) {
    if (!window.FocusSupabase || !window.currentUser || !window.currentUser.id || !groupId) return;
    window.FocusSupabase.from('group_audit_log').insert({
        group_id: groupId,
        actor_id: window.currentUser.id,
        type,
        detail
    }).then(({ error }) => {
        if (error) console.warn('logGroupAuditSupabase:', error.message);
    });
}
window.logGroupAuditSupabase = logGroupAuditSupabase;

// M2b-4 Bölüm 1: Supabase grupları için loadGroupAuditLog eşdeğeri
function loadGroupAuditLogSupabase(groupId, listEl) {
    if (!listEl || !window.FocusSupabase) return;

    const render = async () => {
        const { data: entries, error } = await window.FocusSupabase
            .from('group_audit_log')
            .select('*')
            .eq('group_id', groupId)
            .order('created_at', { ascending: false })
            .limit(40);
        if (error) { console.warn('loadGroupAuditLogSupabase:', error.message); return; }
        if (!entries || !entries.length) {
            listEl.innerHTML = `<div class="si-empty">Henüz bir işlem kaydı yok.</div>`;
            return;
        }
        const actorIds = [...new Set(entries.map(e => e.actor_id).filter(Boolean))];
        const actors = {};
        await Promise.all(actorIds.map(async id => {
            const p = await window._resolveProfileById(id);
            if (p) actors[id] = p;
        }));
        listEl.innerHTML = entries.map(e => {
            const meta = GM_AUDIT_TYPE_META[e.type] || { icon: 'fa-circle-info', color: '74b9ff' };
            const actor = actors[e.actor_id];
            const actorName = actor ? (actor.display_name || actor.username) : 'Birisi';
            const date = new Date(e.created_at);
            const timeStr = date.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
            return `
                <div style="display:flex; align-items:flex-start; gap:10px; padding:9px 10px; border-radius:9px; background:rgba(255,255,255,0.02);">
                    <span style="width:28px; height:28px; border-radius:50%; background:#${meta.color}1f; color:#${meta.color}; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:12px;">
                        <i class="fa-solid ${meta.icon}"></i>
                    </span>
                    <div class="si-min0">
                        <div style="font-size:12px; color:#fff; line-height:1.4;"><b>${window._escapeHtml(actorName)}</b> — ${window._escapeHtml(e.detail || '')}</div>
                        <div style="font-size:10px; color:var(--text-muted); margin-top:2px;">${timeStr}</div>
                    </div>
                </div>
            `;
        }).join('');
    };

    render();

    if (window._gmAuditSupabaseChannel) {
        try { window.FocusSupabase.removeChannel(window._gmAuditSupabaseChannel); } catch (_) { console.warn('[FocusAI] sessiz hata:', _); }
        window._gmAuditSupabaseChannel = null;
    }
    window._gmAuditSupabaseChannel = window.FocusSupabase
        .channel(`group-audit-${groupId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_audit_log', filter: `group_id=eq.${groupId}` }, render)
        .subscribe();
}
window.loadGroupAuditLogSupabase = loadGroupAuditLogSupabase;

// ─── M2b-4 BÖLÜM 2a: ROL ATAMA + ÜYE ATMA (Supabase) ─────
// `group_custom_roles` satırlarını Firebase `customRoles` şekline çevirir
async function loadGroupCustomRolesMapSupabase(groupId) {
    if (!window.FocusSupabase || !groupId) return {};
    const { data, error } = await window.FocusSupabase
        .from('group_custom_roles')
        .select('*')
        .eq('group_id', groupId);
    if (error || !data) return {};
    const map = {};
    data.forEach(r => {
        map[r.id] = {
            name: r.name,
            color: r.color || '6c5ce7',
            manageRooms: !!r.manage_rooms,
            kickMembers: !!r.kick_members,
            lockRooms: !!r.lock_rooms,
            assignRoles: !!r.assign_roles,
            priority: typeof r.priority === 'number' ? r.priority : CUSTOM_ROLE_BASE_PRIORITY
        };
    });
    return map;
}
window.loadGroupCustomRolesMapSupabase = loadGroupCustomRolesMapSupabase;

// `getMemberPermissions`in Supabase karşılığı (kanal bazlı permOverrides M2b-4 Bölüm 2c'de)
// channelCtx verilirse (ör. {subId}) o alt-kanala özel izin istisnaları da değerlendirilir
async function getMemberPermissionsSupabase(groupId, userId, callback, channelCtx) {
    if (!window.FocusSupabase || !groupId || !userId) { callback({ ...BUILTIN_ROLE_PERMS.member }); return; }

    const [{ data: groupRow }, { data: memberRow }, customRoles] = await Promise.all([
        window.FocusSupabase.from('groups').select('created_by, builtin_role_overrides').eq('id', groupId).maybeSingle(),
        window.FocusSupabase.from('group_members').select('role').eq('group_id', groupId).eq('user_id', userId).maybeSingle(),
        loadGroupCustomRolesMapSupabase(groupId)
    ]);

    let role = memberRow && memberRow.role;
    if (!role) role = (groupRow && groupRow.created_by === userId) ? 'admin' : 'member';

    let basePerms;
    if (BUILTIN_ROLE_PERMS[role]) {
        basePerms = { ...BUILTIN_ROLE_PERMS[role] };
        const overrides = groupRow && groupRow.builtin_role_overrides;
        const builtinOverride = overrides && overrides[role];
        if (builtinOverride) Object.assign(basePerms, builtinOverride);
    } else {
        const customRole = customRoles[role];
        basePerms = customRole ? { ...customRole } : { ...BUILTIN_ROLE_PERMS.member };
    }
    basePerms.role = role;

    // Alt-kanal bazlı izin istisnası — sadece ek izin verir, mevcut izni kısıtlamaz
    if (channelCtx && channelCtx.subId) {
        try {
            const { data: subRow } = await window.FocusSupabase
                .from('group_subchannels').select('perm_overrides').eq('id', channelCtx.subId).maybeSingle();
            const ov = subRow && subRow.perm_overrides && subRow.perm_overrides[role];
            if (ov) {
                if (ov.manageRooms) basePerms.manageRooms = true;
                if (ov.lockRooms)   basePerms.lockRooms   = true;
            }
        } catch (e) { /* okuma izni yoksa override yok say */ }
    }

    callback(basePerms);
}
window.getMemberPermissionsSupabase = getMemberPermissionsSupabase;

// `openChannelPermOverridePopover`ın Supabase karşılığı (M2b-4 Bölüm 2c)
function openChannelPermOverridePopoverSupabase(anchorEl, groupId, subId, roomName) {
    document.querySelectorAll('.gm-perm-override-popover').forEach(p => p.remove());
    if (!window.FocusSupabase) return;
    _ensurePermOverrideStyles();

    const popover = document.createElement('div');
    popover.className = 'gm-perm-override-popover glass-panel';
    popover.style.cssText = `
        position:absolute; z-index:10200; min-width:290px; max-width:330px; padding:0;
        border-radius:14px; background:rgba(22,22,32,0.98); border:1px solid rgba(255,255,255,0.08);
        box-shadow:0 16px 40px rgba(0,0,0,0.5); overflow:hidden;
        opacity:0; transform:translateY(-6px) scale(0.97); transition:opacity 0.14s ease, transform 0.14s ease;
    `;
    popover.innerHTML = `
        <div style="display:flex; align-items:flex-start; gap:10px; padding:14px 14px 12px; background:linear-gradient(135deg, rgba(116,185,255,0.14), rgba(116,185,255,0.02)); border-bottom:1px solid rgba(255,255,255,0.06);">
            <div style="width:32px; height:32px; border-radius:9px; background:rgba(116,185,255,0.18); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                <i class="fa-solid fa-sliders" style="color:#74b9ff; font-size:14px;"></i>
            </div>
            <div class="si-flex1">
                <div style="font-size:12.5px; font-weight:700; color:#fff; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"># ${window._escapeHtml(roomName)}</div>
                <div style="font-size:10.5px; color:var(--text-muted); margin-top:1px;">İzin İstisnaları</div>
            </div>
            <button class="gm-perm-override-close" title="Kapat" style="background:rgba(255,255,255,0.06); border:none; color:var(--text-muted); width:24px; height:24px; border-radius:7px; cursor:pointer; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:11px;">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
        <div style="padding:12px 14px;">
            <div style="display:flex; gap:8px; align-items:flex-start; font-size:10.5px; color:var(--text-muted); line-height:1.45; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.05); border-radius:9px; padding:9px 10px; margin-bottom:10px;">
                <i class="fa-solid fa-circle-info" style="color:#74b9ff; margin-top:1px;"></i>
                <span>Normalde "oda kilitleme" iznine sahip olmayan rollere, <b style="color:#fff;">sadece bu oda için</b> kilitleme/açma istisnası tanımlayabilirsin.</span>
            </div>
            <div id="gm-perm-override-rows" style="display:flex; flex-direction:column; gap:6px; max-height:260px; overflow-y:auto;"></div>
        </div>
    `;
    document.body.appendChild(popover);

    const anchorRect = anchorEl.getBoundingClientRect();
    popover.style.top  = (window.scrollY + anchorRect.bottom + 6) + 'px';
    popover.style.left = (window.scrollX + Math.min(anchorRect.left - 230, window.innerWidth - popover.offsetWidth - 16)) + 'px';
    requestAnimationFrame(() => { popover.style.opacity = '1'; popover.style.transform = 'translateY(0) scale(1)'; });

    const closePopover = () => {
        popover.style.opacity = '0';
        popover.style.transform = 'translateY(-6px) scale(0.97)';
        setTimeout(() => popover.remove(), 140);
        document.removeEventListener('click', closeOnOutsideClick);
    };
    popover.querySelector('.gm-perm-override-close')?.addEventListener('click', closePopover);

    const rowsEl = popover.querySelector('#gm-perm-override-rows');

    Promise.all([
        loadGroupCustomRolesMapSupabase(groupId),
        window.FocusSupabase.from('group_subchannels').select('perm_overrides').eq('id', subId).maybeSingle()
    ]).then(([customRoles, { data: subRow }]) => {
        const overrides = (subRow && subRow.perm_overrides) || {};

        // Sadece "kilitleme" iznine taban olarak sahip OLMAYAN roller burada listelenir — onlara bu özel oda için istisna tanımlanabilir
        const candidateRoles = [
            { id: 'member', ...BUILTIN_ROLE_PERMS.member },
            { id: 'moderator', ...BUILTIN_ROLE_PERMS.moderator },
            ...Object.keys(customRoles).map(rId => ({ id: rId, name: customRoles[rId].name, color: customRoles[rId].color || '6c5ce7', lockRooms: !!customRoles[rId].lockRooms }))
        ].filter(r => !r.lockRooms);

        if (!candidateRoles.length) {
            rowsEl.innerHTML = `
                <div style="text-align:center; padding:22px 10px;">
                    <i class="fa-solid fa-circle-check" style="font-size:22px; color:rgba(46,213,115,0.5); display:block; margin-bottom:8px;"></i>
                    <div class="si-muted-xs">Tüm roller zaten kilitleme iznine sahip.<br>İstisna tanımlanacak rol yok.</div>
                </div>`;
            return;
        }

        rowsEl.innerHTML = candidateRoles.map(r => {
            const ov = overrides[r.id] || {};
            const checked = !!ov.lockRooms;
            return `
                <div class="gm-override-row" style="display:flex; align-items:center; justify-content:space-between; gap:10px; padding:9px 10px; border-radius:9px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.04);">
                    <div style="display:flex; align-items:center; gap:8px; min-width:0;">
                        <div style="width:26px; height:26px; border-radius:50%; background:#${window._escapeHtml(r.color)}; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700; color:#fff; flex-shrink:0;">${window._escapeHtml((r.name || '?').charAt(0)).toUpperCase()}</div>
                        <div class="si-min0">
                            <div style="font-size:12px; color:#fff; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${window._escapeHtml(r.name)}</div>
                            <div style="font-size:10px; color:var(--text-muted); display:flex; align-items:center; gap:4px; margin-top:1px;">
                                <i class="fa-solid fa-lock" style="font-size:9px; color:${checked ? '#feca57' : 'var(--text-muted)'};"></i>
                                ${checked ? 'Kilitleme izni verildi' : 'Kilitleme izni yok'}
                            </div>
                        </div>
                    </div>
                    <label class="gm-override-toggle" title="Bu odayı kilitleme/açma izni ver">
                        <input type="checkbox" class="gm-override-cb" data-role-id="${r.id}" data-perm="lockRooms" ${checked ? 'checked' : ''}>
                        <span class="gm-toggle-track"></span>
                    </label>
                </div>
            `;
        }).join('');

        rowsEl.querySelectorAll('.gm-override-cb').forEach(cb => {
            cb.addEventListener('change', async () => {
                const roleId = cb.dataset.roleId;
                const merged = { ...overrides, [roleId]: { ...(overrides[roleId] || {}), lockRooms: cb.checked } };
                overrides[roleId] = merged[roleId];
                await window.FocusSupabase.from('group_subchannels').update({ perm_overrides: merged }).eq('id', subId);
                const roleObj = candidateRoles.find(r => r.id === roleId);
                // Etiket metnini ve ikon rengini anında güncelle
                const row = cb.closest('.gm-override-row');
                const label = row?.querySelector('div[style*="margin-top:1px"]');
                if (label) {
                    label.innerHTML = `<i class="fa-solid fa-lock" style="font-size:9px; color:${cb.checked ? '#feca57' : 'var(--text-muted)'};"></i> ${cb.checked ? 'Kilitleme izni verildi' : 'Kilitleme izni yok'}`;
                }
                logGroupAuditSupabase(groupId, 'settings_change', `# ${roomName} odasında "${roleObj ? roleObj.name : roleId}" rolüne kilitleme izni ${cb.checked ? 'verildi' : 'kaldırıldı'}`);
            });
        });
    });

    const closeOnOutsideClick = (e) => {
        if (!popover.contains(e.target) && e.target !== anchorEl) {
            closePopover();
        }
    };
    setTimeout(() => document.addEventListener('click', closeOnOutsideClick), 0);
}
window.openChannelPermOverridePopoverSupabase = openChannelPermOverridePopoverSupabase;

// `changeMemberRole`in Supabase karşılığı
function changeMemberRoleSupabase(groupId, memberUserId, newRole, roleLabel, oldRole, memberDisplayName) {
    if (!window.FocusSupabase) return;
    window.FocusSupabase.from('group_members')
        .update({ role: newRole === 'member' ? null : newRole })
        .eq('group_id', groupId).eq('user_id', memberUserId)
        .select()
        .then(({ data, error }) => {
            if (error) { window.dcShowToast('Hata: ' + error.message); return; }
            if (!data || !data.length) { window.dcShowToast('Rol değiştirilemedi: Bu işlem için yetkiniz yok.'); return; }
            logGroupAuditSupabase(groupId, 'role_change', `${memberDisplayName ? '"' + memberDisplayName + '"' : 'Bir üyenin'} rolü "${roleLabel || newRole}" olarak değiştirildi`);
        });
}
window.changeMemberRoleSupabase = changeMemberRoleSupabase;

// `kickGroupMember`in Supabase karşılığı
async function kickGroupMemberSupabase(groupId, memberUserId, memberDisplayName) {
    if (!window.FocusSupabase) return;
    const confirmed = await window.showFocusaiConfirm({
        title: 'Üye Atılıyor',
        desc: `<b>${memberDisplayName ? (window._escapeHtml(memberDisplayName)) : 'Bu kullanıcı'}</b> gruptan atılacak.<br>Bu işlemi onaylıyor musunuz?`,
        type: 'danger',
        icon: 'fa-user-xmark',
        confirmText: 'Evet, At',
        cancelText: 'Vazgeç'
    });
    if (!confirmed) return;

    const { data, error } = await window.FocusSupabase.from('group_members')
        .delete().eq('group_id', groupId).eq('user_id', memberUserId)
        .select();
    if (error) { window.dcShowToast('Üye atılırken hata: ' + error.message); return; }
    if (!data || !data.length) { window.dcShowToast('Üye atılamadı: Bu işlem için yetkiniz yok.'); return; }
    logGroupAuditSupabase(groupId, 'member_kick', `${memberDisplayName ? '"' + memberDisplayName + '"' : 'Bir üye'} gruptan atıldı`);
}
window.kickGroupMemberSupabase = kickGroupMemberSupabase;

// `openRolePickerPopover`in Supabase karşılığı
function openRolePickerPopoverSupabase(anchorEl, groupId, memberUserId, currentRole, customRoles, myPriority, memberDisplayName, moderatorOverride) {
    document.querySelectorAll('.gm-role-picker-popover').forEach(p => p.remove());

    const popover = document.createElement('div');
    popover.className = 'gm-role-picker-popover glass-panel';
    popover.style.cssText = `
        position:absolute; z-index:10200; min-width:215px; padding:8px;
        border-radius:12px; background:rgba(25,25,35,0.97); border:1px solid rgba(255,255,255,0.08);
        box-shadow:0 14px 34px rgba(0,0,0,0.45); display:flex; flex-direction:column; gap:2px;
        opacity:0; transform:translateY(-6px) scale(0.97); transition:opacity 0.14s ease, transform 0.14s ease;
    `;

    const builtinRoles = [
        { id: 'member',    ...BUILTIN_ROLE_PERMS.member },
        { id: 'moderator', ...BUILTIN_ROLE_PERMS.moderator, ...(moderatorOverride || {}) },
        { id: 'admin',     ...BUILTIN_ROLE_PERMS.admin }
    ];
    const customRoleList = Object.keys(customRoles || {}).map(rId => ({
        id: rId,
        name: customRoles[rId].name,
        color: customRoles[rId].color || '6c5ce7',
        manageRooms: !!customRoles[rId].manageRooms,
        kickMembers: !!customRoles[rId].kickMembers,
        lockRooms: !!customRoles[rId].lockRooms,
        assignRoles: !!customRoles[rId].assignRoles,
        priority: typeof customRoles[rId].priority === 'number' ? customRoles[rId].priority : CUSTOM_ROLE_BASE_PRIORITY
    }));

    // Hiyerarşi: kendinden yüksek veya eşit rütbeli bir rolü başkasına veremezsin (adminler her şeyi atayabilir)
    const iAmAdmin = myPriority === BUILTIN_ROLE_PERMS.admin.priority;
    const renderOpt = (r) => {
        const isLocked = !iAmAdmin && (typeof myPriority === 'number') && r.priority >= myPriority;
        return `
        <div class="gm-role-picker-opt" data-role-id="${r.id}" ${isLocked ? 'data-locked="1"' : ''}
             style="display:flex; align-items:center; gap:9px; padding:8px 10px; border-radius:8px; font-size:12px; color:#fff;
                    cursor:${isLocked ? 'not-allowed' : 'pointer'}; opacity:${isLocked ? '0.4' : '1'};
                    transition:background 0.12s ease; ${r.id === currentRole ? 'background:rgba(255,255,255,0.05);' : ''}">
            <span style="width:9px; height:9px; border-radius:50%; background:#${r.color}; display:inline-block; flex-shrink:0; box-shadow:0 0 6px #${r.color}88;"></span>
            <span style="flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:500;">${r.name}</span>
            ${isLocked ? '<i class="fa-solid fa-lock" style="font-size:10px; color:rgba(255,255,255,0.35);" title="Bu rolü vermek için yeterli yetkiniz yok"></i>' : _gmPermBadges(r)}
            ${r.id === currentRole ? '<i class="fa-solid fa-check" style="font-size:11px; color:#2ed573;"></i>' : ''}
        </div>
    `;
    };

    const sectionLabel = (txt) => `<div style="font-size:10px; text-transform:uppercase; letter-spacing:0.6px; color:rgba(255,255,255,0.35); padding:8px 10px 4px;">${txt}</div>`;

    let html = sectionLabel('Yerleşik Roller') + builtinRoles.map(renderOpt).join('');
    if (customRoleList.length) {
        html += `<div style="height:1px; background:rgba(255,255,255,0.06); margin:4px 4px;"></div>`;
        html += sectionLabel('Özel Roller') + customRoleList.map(renderOpt).join('');
    }
    popover.innerHTML = html;

    document.body.appendChild(popover);
    const anchorRect = anchorEl.getBoundingClientRect();
    popover.style.top  = (window.scrollY + anchorRect.bottom + 6) + 'px';
    popover.style.left = (window.scrollX + Math.min(anchorRect.left, window.innerWidth - popover.offsetWidth - 16)) + 'px';
    requestAnimationFrame(() => {
        popover.style.opacity = '1';
        popover.style.transform = 'translateY(0) scale(1)';
    });

    const allRolesById = {};
    [...builtinRoles, ...customRoleList].forEach(r => { allRolesById[r.id] = r; });

    popover.querySelectorAll('.gm-role-picker-opt').forEach(opt => {
        if (opt.dataset.locked === '1') return;
        opt.addEventListener('mouseenter', () => { opt.style.background = 'rgba(108,92,231,0.18)'; });
        opt.addEventListener('mouseleave', () => { opt.style.background = (opt.dataset.roleId === currentRole) ? 'rgba(255,255,255,0.05)' : 'transparent'; });
        opt.addEventListener('click', async (e) => {
            e.stopPropagation();
            const picked = allRolesById[opt.dataset.roleId];
            const roleName = (picked && picked.name) || opt.dataset.roleId;
            popover.style.opacity = '0';
            popover.style.transform = 'translateY(-6px) scale(0.97)';
            setTimeout(() => popover.remove(), 140);
            const confirmed = await window.showFocusaiConfirm({
                title: 'Rol Değiştiriliyor',
                desc: `<b>${memberDisplayName ? (window._escapeHtml(memberDisplayName)) : 'Bu kullanıcıya'}</b> <b>"${roleName}"</b> rolü verilecek.<br>Bu işlemi onaylıyor musunuz?`,
                type: 'info',
                icon: 'fa-user-shield',
                confirmText: 'Evet, Ver',
                cancelText: 'Vazgeç'
            });
            if (!confirmed) return;
            changeMemberRoleSupabase(groupId, memberUserId, opt.dataset.roleId, roleName, currentRole, memberDisplayName);
        });
    });

    const closeOnOutsideClick = (e) => {
        if (!popover.contains(e.target) && e.target !== anchorEl) {
            popover.style.opacity = '0';
            popover.style.transform = 'translateY(-6px) scale(0.97)';
            setTimeout(() => popover.remove(), 140);
            document.removeEventListener('click', closeOnOutsideClick);
        }
    };
    setTimeout(() => document.addEventListener('click', closeOnOutsideClick), 0);
}
window.openRolePickerPopoverSupabase = openRolePickerPopoverSupabase;

// ─── M2b-4 BÖLÜM 2b: ROLLER & İZİNLER + İSTEKLER + TEHLİKELİ BÖLGE (Supabase) ─────

// `loadGroupCustomRoles`in Supabase karşılığı
async function loadGroupCustomRolesSupabase(groupId, isAdmin) {
    const listEl = document.getElementById('gm-roles-list');
    if (!listEl || !window.FocusSupabase) return;

    const [{ data: roleRows }, { data: groupRow }, { data: memberRows }] = await Promise.all([
        window.FocusSupabase.from('group_custom_roles').select('*').eq('group_id', groupId).order('priority', { ascending: false }),
        window.FocusSupabase.from('groups').select('builtin_role_overrides').eq('id', groupId).maybeSingle(),
        window.FocusSupabase.from('group_members').select('role').eq('group_id', groupId)
    ]);
    const roles = roleRows || [];
    const memberCounts = {};
    (memberRows || []).forEach(m => {
        const r = m.role || 'member';
        memberCounts[r] = (memberCounts[r] || 0) + 1;
    });
    const moderatorOverride = (groupRow && groupRow.builtin_role_overrides && groupRow.builtin_role_overrides.moderator) || {};
    window._gmModeratorOverride = moderatorOverride;
    const moderatorPerms = { ...BUILTIN_ROLE_PERMS.moderator, ...moderatorOverride };

    const moderatorRowHtml = `
        <div class="glass-panel" style="padding:7px 10px; border-radius:8px; display:flex; align-items:center; justify-content:space-between; gap:8px; border-left:3px solid #${BUILTIN_ROLE_PERMS.moderator.color};">
            <div style="display:flex; align-items:center; gap:8px; min-width:0; flex:1;">
                <i class="fa-solid fa-lock" style="font-size:10px; color:rgba(255,255,255,0.25); flex-shrink:0;" title="Yerleşik rol — sırası sabittir"></i>
                <span style="font-size:12.5px; font-weight:600; color:#${BUILTIN_ROLE_PERMS.moderator.color}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${BUILTIN_ROLE_PERMS.moderator.name}</span>
                <span class="si-badge" style="flex-shrink:0;">${memberCounts['moderator'] || 0} üye</span>
                ${_gmPermBadges(moderatorPerms)}
            </div>
            <div class="si-row-g2">
                ${isAdmin ? `<button class="gm-edit-role-btn" data-role-id="moderator" title="İzinleri Düzenle"><i class="fa-solid fa-pen"></i></button>` : ''}
            </div>
        </div>
    `;

    const customRolesHtml = !roles.length
        ? `<div style="text-align:center; color:var(--text-muted); padding:10px; font-size:12px;">Henüz özel rol oluşturulmadı.</div>`
        : roles.map((r, idx) => {
        const color = r.color || '6c5ce7';
        const count = memberCounts[r.id] || 0;
        return `
            <div class="glass-panel" style="padding:7px 10px; border-radius:8px; display:flex; align-items:center; justify-content:space-between; gap:8px; border-left:3px solid #${color};">
                <div style="display:flex; flex-direction:column; gap:0; flex-shrink:0;">
                    <button class="gm-role-row-up" data-role-id="${r.id}" data-dir="up" ${idx === 0 ? 'disabled' : ''} title="Yukarı taşı (daha yetkili)"><i class="fa-solid fa-chevron-up"></i></button>
                    <button class="gm-role-row-down" data-role-id="${r.id}" data-dir="down" ${idx === roles.length - 1 ? 'disabled' : ''} title="Aşağı taşı (daha az yetkili)"><i class="fa-solid fa-chevron-down"></i></button>
                </div>
                <div style="display:flex; align-items:center; gap:8px; min-width:0; flex:1;">
                    <span style="font-size:12.5px; font-weight:600; color:#${color}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${r.name}</span>
                    <span class="si-badge" style="flex-shrink:0;">${count} üye</span>
                    ${_gmPermBadges({ manageRooms: r.manage_rooms, kickMembers: r.kick_members, lockRooms: r.lock_rooms, assignRoles: r.assign_roles })}
                </div>
                <div class="si-row-g2">
                    <button class="gm-edit-role-btn" data-role-id="${r.id}" title="Rolü Düzenle"><i class="fa-solid fa-pen"></i></button>
                    <button class="icon-btn gm-delete-role-btn" data-role-id="${r.id}" title="Rolü Sil" class="si-red"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            </div>
        `;
    }).join('');

    listEl.innerHTML = moderatorRowHtml + customRolesHtml;

    const limitNoteEl = document.getElementById('gm-role-limit-note');
    if (limitNoteEl) limitNoteEl.textContent = `${roles.length}/${MAX_CUSTOM_ROLES}`;
    const atLimit = roles.length >= MAX_CUSTOM_ROLES;
    const editingRoleId = document.getElementById('gm-editing-role-id')?.value;
    const createBtn = document.getElementById('gm-create-role-btn');
    const nameInput = document.getElementById('gm-new-role-name');
    if (createBtn && nameInput && !editingRoleId) {
        createBtn.disabled = atLimit;
        createBtn.style.opacity = atLimit ? '0.45' : '';
        createBtn.style.cursor = atLimit ? 'not-allowed' : '';
        nameInput.disabled = atLimit;
        nameInput.placeholder = atLimit ? `Rol limitine ulaşıldı (${MAX_CUSTOM_ROLES}/${MAX_CUSTOM_ROLES})` : 'Örn: Etkinlik Sorumlusu';
    }

    listEl.querySelector('.gm-edit-role-btn[data-role-id="moderator"]')?.addEventListener('click', () => {
        enterRoleEditMode(groupId, 'moderator', moderatorPerms, true);
    });

    listEl.querySelectorAll('.gm-edit-role-btn').forEach(btn => {
        if (btn.dataset.roleId === 'moderator') return;
        const r = roles.find(x => x.id === btn.dataset.roleId);
        if (!r) return;
        btn.addEventListener('click', () => {
            enterRoleEditMode(groupId, r.id, {
                name: r.name, color: r.color,
                manageRooms: r.manage_rooms, kickMembers: r.kick_members, lockRooms: r.lock_rooms, assignRoles: r.assign_roles
            });
        });
    });

    listEl.querySelectorAll('.gm-delete-role-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const roleId = btn.dataset.roleId;
            const r = roles.find(x => x.id === roleId);
            const roleName = r && r.name;
            const confirmed = await window.showFocusaiConfirm({
                title: 'Rol Siliniyor',
                desc: `<b>"${roleName || roleId}"</b> adlı rol kalıcı olarak silinecek.<br>Bu role sahip tüm üyeler otomatik olarak <b>"Üye"</b> rütbesine döner.`,
                type: 'danger',
                icon: 'fa-trash-can',
                confirmText: 'Evet, Sil',
                cancelText: 'Vazgeç'
            });
            if (!confirmed) return;
            await deleteCustomRoleSupabase(groupId, roleId, roleName);
            loadGroupCustomRolesSupabase(groupId, isAdmin);
        });
    });

    // Hiyerarşi sırasını değiştir — komşu rolün önceliğiyle yer değiştir
    listEl.querySelectorAll('.gm-role-row-up, .gm-role-row-down').forEach(btn => {
        btn.addEventListener('click', async () => {
            const roleId = btn.dataset.roleId;
            const dir = btn.dataset.dir;
            const ids = roles.map(r => r.id);
            const curIdx = ids.indexOf(roleId);
            const swapIdx = dir === 'up' ? curIdx - 1 : curIdx + 1;
            if (swapIdx < 0 || swapIdx >= ids.length) return;
            const otherId = ids[swapIdx];
            const myPriority = roles[curIdx].priority ?? CUSTOM_ROLE_BASE_PRIORITY;
            const otherPriority = roles[swapIdx].priority ?? CUSTOM_ROLE_BASE_PRIORITY;
            await Promise.all([
                window.FocusSupabase.from('group_custom_roles').update({ priority: otherPriority }).eq('id', roleId),
                window.FocusSupabase.from('group_custom_roles').update({ priority: myPriority }).eq('id', otherId)
            ]);
            loadGroupCustomRolesSupabase(groupId, isAdmin);
        });
    });
}
window.loadGroupCustomRolesSupabase = loadGroupCustomRolesSupabase;

// `createCustomRole`in Supabase karşılığı (oluşturma + düzenleme, dahil Moderatör izin override'ı)
async function createOrUpdateCustomRoleSupabase(groupId) {
    if (!window.FocusSupabase) return;
    const nameInput = document.getElementById('gm-new-role-name');
    const name = nameInput ? nameInput.value.trim() : '';

    const colorOpt = document.querySelector('.gm-role-color-opt.selected');
    const color = colorOpt ? colorOpt.dataset.color : '6c5ce7';

    const manageRooms = !!document.getElementById('gm-perm-manage-rooms')?.checked;
    const kickMembers = !!document.getElementById('gm-perm-kick-members')?.checked;
    const lockRooms   = !!document.getElementById('gm-perm-lock-rooms')?.checked;
    const assignRoles = !!document.getElementById('gm-perm-assign-roles')?.checked;

    const editingInput = document.getElementById('gm-editing-role-id');
    const editingRoleId = editingInput ? editingInput.value : '';

    // Yerleşik rol (Moderatör) izin düzenlemesi
    if (editingRoleId && editingInput.dataset.builtin === '1') {
        const { data: groupRow } = await window.FocusSupabase.from('groups').select('builtin_role_overrides').eq('id', groupId).maybeSingle();
        const overrides = { ...((groupRow && groupRow.builtin_role_overrides) || {}) };
        overrides[editingRoleId] = { manageRooms, kickMembers, lockRooms, assignRoles };
        const { error } = await window.FocusSupabase.from('groups').update({ builtin_role_overrides: overrides }).eq('id', groupId);
        if (error) { window.dcShowToast('İzinler güncellenirken hata: ' + error.message); return; }
        const roleName = BUILTIN_ROLE_PERMS[editingRoleId] ? BUILTIN_ROLE_PERMS[editingRoleId].name : editingRoleId;
        logGroupAuditSupabase(groupId, 'role_edit', `"${roleName}" rolünün izinleri güncellendi`);
        resetRoleForm();
        loadGroupCustomRolesSupabase(groupId, true);
        return;
    }

    if (!name || name.length < 2) { window.dcShowToast('Rol adı en az 2 karakter olmalı.'); return; }

    if (editingRoleId) {
        const { error } = await window.FocusSupabase.from('group_custom_roles')
            .update({ name, color, manage_rooms: manageRooms, kick_members: kickMembers, lock_rooms: lockRooms, assign_roles: assignRoles })
            .eq('id', editingRoleId);
        if (error) { window.dcShowToast('Rol güncellenirken hata: ' + error.message); return; }
        logGroupAuditSupabase(groupId, 'role_edit', `"${name}" adlı rol düzenlendi`);
        resetRoleForm();
        loadGroupCustomRolesSupabase(groupId, true);
        return;
    }

    const { data: existing } = await window.FocusSupabase.from('group_custom_roles').select('priority').eq('group_id', groupId);
    if ((existing || []).length >= MAX_CUSTOM_ROLES) {
        window.dcShowToast(`En fazla ${MAX_CUSTOM_ROLES} özel rol oluşturabilirsiniz.`);
        return;
    }
    const maxPriority = (existing || []).reduce((m, r) => Math.max(m, r.priority || CUSTOM_ROLE_BASE_PRIORITY), CUSTOM_ROLE_BASE_PRIORITY);
    const priority = Math.min(maxPriority + 10, BUILTIN_ROLE_PERMS.moderator.priority - 1);

    const { error } = await window.FocusSupabase.from('group_custom_roles').insert({
        group_id: groupId, name, color,
        manage_rooms: manageRooms, kick_members: kickMembers, lock_rooms: lockRooms, assign_roles: assignRoles,
        priority
    });
    if (error) { window.dcShowToast('Rol oluşturulurken hata: ' + error.message); return; }
    logGroupAuditSupabase(groupId, 'role_create', `"${name}" adlı yeni bir rol oluşturuldu`);
    resetRoleForm();
    loadGroupCustomRolesSupabase(groupId, true);
}
window.createOrUpdateCustomRoleSupabase = createOrUpdateCustomRoleSupabase;

// `deleteCustomRole`in Supabase karşılığı
async function deleteCustomRoleSupabase(groupId, roleId, roleName) {
    if (!window.FocusSupabase) return;
    const { error } = await window.FocusSupabase.from('group_custom_roles').delete().eq('id', roleId);
    if (error) { window.dcShowToast('Rol silinirken hata: ' + error.message); return; }
    // Bu role sahip üyeleri "member" rolüne çevir
    await window.FocusSupabase.from('group_members').update({ role: null }).eq('group_id', groupId).eq('role', roleId);
    logGroupAuditSupabase(groupId, 'role_delete', `"${roleName || roleId}" adlı rol silindi`);
}
window.deleteCustomRoleSupabase = deleteCustomRoleSupabase;

// `loadPendingMembers`in Supabase karşılığı ("İstekler" sekmesi)
async function loadPendingMembersSupabase(groupId) {
    const listEl = document.getElementById('gm-pending-list');
    const badgeEl = document.getElementById('gm-pending-count-badge');
    if (!listEl || !window.FocusSupabase) return;

    const render = async () => {
        const { data: rows, error } = await window.FocusSupabase
            .from('group_pending_members')
            .select('user_id, requested_at, profiles(username, display_name, avatar_color, custom_avatar, avatar_initials)')
            .eq('group_id', groupId)
            .order('requested_at', { ascending: true });
        if (error) { console.warn('loadPendingMembersSupabase:', error.message); return; }

        if (badgeEl) {
            const n = (rows || []).length;
            if (n) { badgeEl.textContent = n > 9 ? '9+' : String(n); badgeEl.classList.remove('hidden'); }
            else badgeEl.classList.add('hidden');
        }

        if (!rows || !rows.length) {
            listEl.innerHTML = `
                <div class="si-empty">
                    <i class="fa-solid fa-circle-check" style="font-size:20px; opacity:0.25; display:block; margin-bottom:8px;"></i>
                    Bekleyen katılım isteği yok.
                </div>`;
            return;
        }

        listEl.innerHTML = rows.map(row => {
            const profile = row.profiles || {};
            const username = profile.username || row.user_id;
            const displayName = profile.display_name || username;
            return `
                <div class="glass-panel" data-user-id="${row.user_id}" style="padding:10px 12px; border-radius:10px; display:flex; align-items:center; justify-content:space-between; gap:10px;">
                    <div class="si-row-g10-min0">
                        ${window.avatarImgHtml({ customAvatar: profile.custom_avatar, avatarInitials: profile.avatar_initials || null, avatarColor: profile.avatar_color, displayName }, 32, '', '')}
                        <div class="si-col">
                            <span class="gm-pending-name si-title-bold">${window._escapeHtml(displayName)}</span>
                            <span class="si-muted-xs">@${window._escapeHtml(username)}</span>
                        </div>
                    </div>
                    <div style="display:flex; gap:6px; flex-shrink:0;">
                        <button class="gm-approve-btn" data-user-id="${row.user_id}" title="Onayla" style="background:rgba(46,213,115,0.15); border:1px solid rgba(46,213,115,0.3); color:#2ed573; border-radius:8px; padding:7px 11px; cursor:pointer; font-size:12px;"><i class="fa-solid fa-check"></i></button>
                        <button class="gm-reject-btn" data-user-id="${row.user_id}" title="Reddet" style="background:rgba(255,71,87,0.15); border:1px solid rgba(255,71,87,0.3); color:#ff4757; border-radius:8px; padding:7px 11px; cursor:pointer; font-size:12px;"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                </div>
            `;
        }).join('');

        listEl.querySelectorAll('.gm-approve-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const displayName = btn.closest('[data-user-id]')?.querySelector('.gm-pending-name')?.textContent || '';
                approvePendingMemberSupabase(groupId, btn.dataset.userId, displayName);
            });
        });
        listEl.querySelectorAll('.gm-reject-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const displayName = btn.closest('[data-user-id]')?.querySelector('.gm-pending-name')?.textContent || '';
                rejectPendingMemberSupabase(groupId, btn.dataset.userId, displayName);
            });
        });
    };

    await render();

    if (window._gmPendingSupabaseChannel) {
        try { window.FocusSupabase.removeChannel(window._gmPendingSupabaseChannel); } catch (_) { console.warn('[FocusAI] sessiz hata:', _); }
        window._gmPendingSupabaseChannel = null;
    }
    window._gmPendingSupabaseChannel = window.FocusSupabase
        .channel(`group-mgmt-pending-${groupId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'group_pending_members', filter: `group_id=eq.${groupId}` }, render)
        .subscribe();
}
window.loadPendingMembersSupabase = loadPendingMembersSupabase;

// `approvePendingMember`in Supabase karşılığı
async function approvePendingMemberSupabase(groupId, userId, displayName) {
    if (!window.FocusSupabase) return;
    const { error: insErr } = await window.FocusSupabase.from('group_members').insert({ group_id: groupId, user_id: userId, role: null });
    if (insErr) { window.dcShowToast('Onaylanırken hata: ' + insErr.message); return; }
    await window.FocusSupabase.from('group_pending_members').delete().eq('group_id', groupId).eq('user_id', userId);
    logGroupAuditSupabase(groupId, 'member_approve', `${displayName ? '"' + displayName + '"' : 'Bir kullanıcının'} katılım isteği onaylandı`);
}
window.approvePendingMemberSupabase = approvePendingMemberSupabase;

// `rejectPendingMember`in Supabase karşılığı
async function rejectPendingMemberSupabase(groupId, userId, displayName) {
    if (!window.FocusSupabase) return;
    const { error } = await window.FocusSupabase.from('group_pending_members').delete().eq('group_id', groupId).eq('user_id', userId);
    if (error) { window.dcShowToast('Reddedilirken hata: ' + error.message); return; }
    logGroupAuditSupabase(groupId, 'member_reject', `${displayName ? '"' + displayName + '"' : 'Bir kullanıcının'} katılım isteği reddedildi`);
}
window.rejectPendingMemberSupabase = rejectPendingMemberSupabase;

// `toggleRequireApproval`in Supabase karşılığı
function toggleRequireApprovalSupabase(groupId, enabled) {
    if (!window.FocusSupabase) return;
    window.FocusSupabase.from('groups').update({ require_approval: !!enabled }).eq('id', groupId).then(({ error }) => {
        if (error) { window.dcShowToast('Hata: ' + error.message); return; }
        logGroupAuditSupabase(groupId, 'settings_change', `Katılım onayı ${enabled ? 'açıldı' : 'kapatıldı'}`);
    });
}
window.toggleRequireApprovalSupabase = toggleRequireApprovalSupabase;

// "Tehlikeli Bölge" — grubu kapat ve sil (Supabase: FK cascade ile bağlı tüm tablolar otomatik temizlenir)
async function closeGroupSupabase(groupCode, groupId, groupName) {
    if (!window.FocusSupabase) return;
    const ok = await window.showFocusaiConfirm({
        title: 'Grubu Kapat ve Sil',
        desc: `<b>"${window._escapeHtml(groupName)}"</b> grubunu kapatmak istediğine emin misin?<br>Tüm üyeler gruptan çıkarılacak ve grup kalıcı olarak silinecek. Bu işlem geri alınamaz.`,
        type: 'danger',
        icon: 'fa-trash-can',
        confirmText: 'Evet, Kapat',
        cancelText: 'Vazgeç'
    });
    if (!ok) return;

    const btn = document.getElementById('gm-close-group-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Kapatılıyor...'; }

    const { error } = await window.FocusSupabase.from('groups').delete().eq('id', groupId);
    if (error) {
        window.dcShowToast('Grup kapatılırken bir hata oluştu: ' + error.message);
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-trash-can"></i> Grubu Kapat ve Sil'; }
        return;
    }

    ['_gmMembersSupabaseChannel', '_gmCustomRolesSupabaseChannel', '_gmPendingSupabaseChannel', '_gmAuditSupabaseChannel'].forEach(key => {
        if (window[key]) { try { window.FocusSupabase.removeChannel(window[key]); } catch (_) { console.warn('[FocusAI] sessiz hata:', _); } window[key] = null; }
    });

    document.getElementById('group-management-modal')?.classList.add('hidden');
    if (typeof window.__dcCloseChatIfGroup === 'function') window.__dcCloseChatIfGroup(groupCode);
    if (typeof window.resetActiveGroupPanel === 'function') window.resetActiveGroupPanel();
}
window.closeGroupSupabase = closeGroupSupabase;

// M2b-4 Bölüm 1: Supabase grupları için sadeleştirilmiş "Grup Yönetimi" modalı
// (Üyeler salt-okunur + Geçmiş sekmesi; Roller/İstekler/Tehlikeli Bölge Bölüm 2'ye kadar gizli)
async function openGroupManagementModalSupabase(groupCode, groupId, groupData) {
    const modalEl = document.getElementById('group-management-modal');
    if (!modalEl) return;
    modalEl.classList.remove('hidden');
    modalEl.dataset.activeGroupId = groupId;

    const ALL_GM_TABS = ['members', 'roles', 'requests', 'audit'];
    const setActiveTab = (tab) => {
        modalEl.querySelectorAll('.gm-tab-btn').forEach(b => {
            const isActive = b.dataset.gmTab === tab;
            b.classList.toggle('active', isActive);
            b.style.background = isActive ? 'rgba(108,92,231,0.15)' : 'transparent';
            b.style.color = isActive ? '#fff' : 'var(--text-muted)';
        });
        ALL_GM_TABS.forEach(t => {
            document.getElementById(`gm-tab-panel-${t}`)?.classList.toggle('hidden', t !== tab);
        });
    };

    if (!modalEl.dataset.tabsBound) {
        modalEl.dataset.tabsBound = '1';
        modalEl.querySelectorAll('.gm-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => setActiveTab(btn.dataset.gmTab));
        });
    }

    const myPerms = await new Promise(resolve => getMemberPermissionsSupabase(groupId, window.currentUser.id, resolve));
    const isAdmin = myPerms.role === 'admin';
    const canSeeRequests = !!myPerms.kickMembers;
    const isOwner = groupData.createdBy === window.currentUser.username;

    // Sınıf/ders ve iş yeri/ekip gruplarında davetli-girişli olduğu için "İstekler" (katılım
    // onayı) sekmesine hiç gerek yok — davet zaten institution_invites üzerinden yönetiliyor.
    const isInstitutionalGroup = groupData.classroomType === 'classroom' || groupData.classroomType === 'workplace';

    // Roller sekmesi herkese görünür; İstekler sadece üye atma yetkisi olanlara (ve kurumsal
    // olmayan gruplarda); Tehlikeli Bölge sadece sahibe.
    modalEl.querySelector('.gm-tab-btn[data-gm-tab="roles"]')?.classList.remove('hidden');
    modalEl.querySelector('.gm-tab-btn[data-gm-tab="requests"]')?.classList.toggle('hidden', !canSeeRequests || isInstitutionalGroup);
    // Kurumsal gruplarda doğrudan sil yerine destek iletişim kutusu gösterilir — ikisi de sadece sahibe.
    document.getElementById('gm-danger-zone')?.classList.toggle('hidden', !isOwner || isInstitutionalGroup);
    document.getElementById('gm-institutional-danger-zone')?.classList.toggle('hidden', !isOwner || !isInstitutionalGroup);

    let activeTab = modalEl.querySelector('.gm-tab-btn.active')?.dataset.gmTab || 'members';
    if (modalEl.querySelector(`.gm-tab-btn[data-gm-tab="${activeTab}"]`)?.classList.contains('hidden')) activeTab = 'members';
    setActiveTab(activeTab);

    // Rol oluşturma formu sadece adminlere görünür
    document.getElementById('gm-create-role-section')?.classList.toggle('hidden', !isAdmin);
    document.getElementById('gm-roles-admin-notice')?.classList.toggle('hidden', isAdmin);
    if (typeof window.resetRoleForm === 'function') window.resetRoleForm();

    // Katılım onayı ayarı sadece adminlere görünür/düzenlenebilir (kurumsal gruplarda anlamsız)
    document.getElementById('gm-approval-toggle-wrap')?.classList.toggle('hidden', !isAdmin || isInstitutionalGroup);
    const approvalToggle = document.getElementById('gm-require-approval-toggle');
    if (approvalToggle) approvalToggle.checked = !!groupData.requireApproval;
    if (!canSeeRequests || isInstitutionalGroup) document.getElementById('gm-pending-count-badge')?.classList.add('hidden');

    // Roller/üyeler formlarına ait genel (backend-bağımsız) bağlamalar — bir kez bağlanır
    if (!modalEl.dataset.genericBoundSupabase) {
        modalEl.dataset.genericBoundSupabase = '1';

        modalEl.querySelectorAll('.gm-role-color-opt').forEach(opt => {
            opt.addEventListener('click', () => {
                modalEl.querySelectorAll('.gm-role-color-opt').forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
                updateRolePreviewChip();
            });
        });
        modalEl.querySelectorAll('.gm-perm-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.gm-switch')) return;
                const checkbox = card.querySelector('input[type="checkbox"]');
                if (checkbox) checkbox.checked = !checkbox.checked;
            });
        });
        document.getElementById('gm-new-role-name')?.addEventListener('input', updateRolePreviewChip);
        updateRolePreviewChip();

        document.getElementById('gm-create-role-btn')?.addEventListener('click', () => {
            createOrUpdateCustomRoleSupabase(modalEl.dataset.activeGroupId);
        });
        document.getElementById('gm-role-form-cancel-btn')?.addEventListener('click', () => {
            if (typeof window.resetRoleForm === 'function') window.resetRoleForm();
        });

        document.getElementById('gm-member-search-input')?.addEventListener('input', (e) => {
            const q = e.target.value.trim().toLowerCase();
            let visibleCount = 0;
            document.querySelectorAll('#group-mgmt-members-list .mgmt-member-row').forEach(row => {
                const name = (row.querySelector('.mgmt-member-name')?.textContent || '').toLowerCase();
                const uname = (row.querySelector('.mgmt-member-username')?.textContent || '').toLowerCase();
                const match = !q || name.includes(q) || uname.includes(q);
                row.style.display = match ? '' : 'none';
                if (match) visibleCount++;
            });
            document.getElementById('gm-member-empty-state')?.classList.toggle('hidden', visibleCount !== 0 || !q);
        });

        document.getElementById('gm-require-approval-toggle')?.addEventListener('change', (e) => {
            toggleRequireApprovalSupabase(modalEl.dataset.activeGroupId, e.target.checked);
        });
    }

    // Üyeler sekmesi: rol chip'i (atanabiliyorsa tıklanabilir) + üye atma butonu
    const membersListEl = document.getElementById('group-mgmt-members-list');
    async function renderMembersListSupabase() {
        if (!membersListEl || !window.FocusSupabase) return;
        const { data: memberRows, error } = await window.FocusSupabase
            .from('group_members')
            .select('user_id, role, profiles(username, display_name, avatar_color, custom_avatar, avatar_initials)')
            .eq('group_id', groupId);
        if (error || !memberRows) return;

        const customRolesMap = await loadGroupCustomRolesMapSupabase(groupId);
        const moderatorOverride = (groupData.builtinRoleOverrides && groupData.builtinRoleOverrides.moderator) || null;
        const createdByUsername = groupData.createdBy;

        const myRow = memberRows.find(m => m.user_id === window.currentUser.id);
        let myRole = myRow ? myRow.role : null;
        if (!myRole) myRole = (createdByUsername === window.currentUser.username) ? 'admin' : 'member';
        let myPerms;
        if (BUILTIN_ROLE_PERMS[myRole]) {
            myPerms = { ...BUILTIN_ROLE_PERMS[myRole] };
            if (myRole === 'moderator' && moderatorOverride) Object.assign(myPerms, moderatorOverride);
        } else {
            myPerms = customRolesMap[myRole] ? { ...customRolesMap[myRole] } : { ...BUILTIN_ROLE_PERMS.member };
        }
        const isAdmin = myRole === 'admin';
        const myPriority = getRolePriority(myRole, customRolesMap);

        if (!memberRows.length) {
            membersListEl.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:10px;">Üye bulunamadı.</div>`;
            return;
        }

        membersListEl.innerHTML = memberRows.map(m => {
            const profile = m.profiles || {};
            const username = profile.username || m.user_id;
            const displayName = profile.display_name || username;
            const memberRole = m.role || ((createdByUsername === username) ? 'admin' : 'member');
            const roleColor = BUILTIN_ROLE_PERMS[memberRole] ? BUILTIN_ROLE_PERMS[memberRole].color : (customRolesMap[memberRole] ? (customRolesMap[memberRole].color || '6c5ce7') : '636e72');
            const roleLabel = BUILTIN_ROLE_PERMS[memberRole] ? BUILTIN_ROLE_PERMS[memberRole].name : (customRolesMap[memberRole] ? customRolesMap[memberRole].name : memberRole);
            const targetPriority = getRolePriority(memberRole, customRolesMap);
            const canAssignRole = (isAdmin || myPerms.assignRoles) && m.user_id !== window.currentUser.id && (isAdmin || targetPriority < myPriority);
            const canKick = myPerms.kickMembers && m.user_id !== window.currentUser.id && targetPriority < myPriority;

            // roleLabel özel rollerde admin'in yazdığı serbest metin olabilir (bkz.
            // createOrUpdateCustomRoleSupabase) — escape şart. roleColor de aynı
            // sebeple (RLS içeriği kısıtlamıyor, bkz. avatarImgHtml'deki emsal).
            const safeRoleColor = window._escapeHtml(roleColor);
            const chipHtml = `
                <span class="gm-role-chip ${canAssignRole ? 'gm-role-chip-clickable' : ''}" data-user-id="${m.user_id}" data-role="${window._escapeHtml(memberRole)}"
                      style="display:inline-flex; align-items:center; gap:6px; font-size:11px; font-weight:600; padding:5px 10px; border-radius:20px;
                             background:#${safeRoleColor}26; color:#${safeRoleColor}; border:1px solid #${safeRoleColor}55; ${canAssignRole ? 'cursor:pointer;' : ''}">
                    <span style="width:7px; height:7px; border-radius:50%; background:#${safeRoleColor}; display:inline-block;"></span>
                    ${window._escapeHtml(roleLabel)}
                    ${canAssignRole ? '<i class="fa-solid fa-chevron-down" style="font-size:9px; opacity:0.7;"></i>' : ''}
                </span>
            `;

            const kickHtml = canKick ? `
                <button class="gm-kick-member-btn" data-user-id="${m.user_id}" title="Gruptan At"
                        style="display:inline-flex; align-items:center; gap:6px; margin-left:8px; padding:6px 9px;
                               border-radius:8px; border:1px solid rgba(255,71,87,0.25); background:rgba(255,71,87,0.08);
                               color:#ff4757; font-size:11px; font-weight:600; cursor:pointer; overflow:hidden;
                               max-width:30px; transition:max-width 0.22s ease, background 0.15s ease, padding 0.22s ease;">
                    <i class="fa-solid fa-user-xmark si-shrink0"></i>
                    <span style="white-space:nowrap; opacity:0; transition:opacity 0.15s ease;">Gruptan At</span>
                </button>
            ` : '';

            return `
                <div class="mgmt-member-row" data-user-id="${m.user_id}" style="display:flex; align-items:center; justify-content:space-between; gap:10px; padding:9px 10px; border-radius:10px;">
                    <div class="mgmt-member-info si-row-g10-min0">
                        ${window.avatarImgHtml({ customAvatar: profile.custom_avatar, avatarInitials: profile.avatar_initials || null, avatarColor: profile.avatar_color, displayName }, 34, '', 'class="mgmt-member-avatar"')}
                        <div class="mgmt-member-details si-col">
                            <span class="mgmt-member-name si-title-bold">${window._escapeHtml(displayName)}</span>
                            <span class="mgmt-member-username si-muted-xs">@${window._escapeHtml(username)}</span>
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; flex-shrink:0;">${chipHtml}${kickHtml}</div>
                </div>
            `;
        }).join('');

        membersListEl.querySelectorAll('.gm-role-chip-clickable').forEach(chip => {
            chip.addEventListener('click', (e) => {
                e.stopPropagation();
                const userId = chip.dataset.userId;
                const memberDisplayName = chip.closest('.mgmt-member-row')?.querySelector('.mgmt-member-name')?.textContent || '';
                openRolePickerPopoverSupabase(chip, groupId, userId, chip.dataset.role, customRolesMap, myPriority, memberDisplayName, moderatorOverride);
            });
        });

        membersListEl.querySelectorAll('.gm-kick-member-btn').forEach(btn => {
            const kickLabel = btn.querySelector('span');
            btn.addEventListener('mouseenter', () => {
                btn.style.maxWidth = '110px';
                btn.style.background = 'rgba(255,71,87,0.18)';
                if (kickLabel) kickLabel.style.opacity = '1';
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.maxWidth = '30px';
                btn.style.background = 'rgba(255,71,87,0.08)';
                if (kickLabel) kickLabel.style.opacity = '0';
            });
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const userId = btn.dataset.userId;
                const memberDisplayName = btn.closest('.mgmt-member-row')?.querySelector('.mgmt-member-name')?.textContent || '';
                kickGroupMemberSupabase(groupId, userId, memberDisplayName);
            });
        });
    }
    renderMembersListSupabase();

    document.getElementById('gm-member-empty-state')?.classList.add('hidden');

    // Roller & İzinler sekmesi
    loadGroupCustomRolesSupabase(groupId, isAdmin);

    // İstekler sekmesi (sadece üye atma yetkisi olanlar)
    if (canSeeRequests) loadPendingMembersSupabase(groupId);

    // Geçmiş sekmesi
    const auditListEl = document.getElementById('gm-audit-log-list');
    if (auditListEl) loadGroupAuditLogSupabase(groupId, auditListEl);

    // Üye/rol değişikliklerinde "Üyeler" sekmesini canlı güncelle
    if (window._gmMembersSupabaseChannel) {
        try { window.FocusSupabase.removeChannel(window._gmMembersSupabaseChannel); } catch (_) { console.warn('[FocusAI] sessiz hata:', _); }
        window._gmMembersSupabaseChannel = null;
    }
    window._gmMembersSupabaseChannel = window.FocusSupabase
        .channel(`group-mgmt-members-${groupId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members', filter: `group_id=eq.${groupId}` }, renderMembersListSupabase)
        .subscribe();

    if (window._gmCustomRolesSupabaseChannel) {
        try { window.FocusSupabase.removeChannel(window._gmCustomRolesSupabaseChannel); } catch (_) { console.warn('[FocusAI] sessiz hata:', _); }
        window._gmCustomRolesSupabaseChannel = null;
    }
    window._gmCustomRolesSupabaseChannel = window.FocusSupabase
        .channel(`group-mgmt-custom-roles-${groupId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'group_custom_roles', filter: `group_id=eq.${groupId}` }, () => {
            renderMembersListSupabase();
            loadGroupCustomRolesSupabase(groupId, isAdmin);
        })
        .subscribe();

    const closeBtn = document.getElementById('close-group-mgmt-modal');
    if (closeBtn && !closeBtn.dataset.cleanupBoundSupabase) {
        closeBtn.dataset.cleanupBoundSupabase = '1';
        closeBtn.addEventListener('click', () => {
            ['_gmAuditSupabaseChannel', '_gmMembersSupabaseChannel', '_gmCustomRolesSupabaseChannel', '_gmPendingSupabaseChannel'].forEach(key => {
                if (window[key]) {
                    try { window.FocusSupabase.removeChannel(window[key]); } catch (_) { console.warn('[FocusAI] sessiz hata:', _); }
                    window[key] = null;
                }
            });
        });
    }

    // Tehlikeli Bölge: grubu kapat
    const closeGroupBtn = document.getElementById('gm-close-group-btn');
    if (closeGroupBtn) {
        closeGroupBtn.disabled = false;
        closeGroupBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i> Grubu Kapat ve Sil';
        closeGroupBtn.onclick = () => closeGroupSupabase(groupCode, groupId, groupData.name);
    }
}
window.openGroupManagementModalSupabase = openGroupManagementModalSupabase;

function _gmPermBadges(perms) {
    if (!perms) return '';
    const items = [];
    if (perms.manageRooms) items.push('<i class="fa-solid fa-hashtag" title="Oda kurma izni" class="si-blue"></i>');
    if (perms.kickMembers) items.push('<i class="fa-solid fa-user-xmark" title="Üye ekleme / üye atma izni" class="si-red"></i>');
    if (perms.lockRooms)   items.push('<i class="fa-solid fa-lock" title="Oda kilitleme izni" class="si-yellow"></i>');
    if (perms.assignRoles) items.push('<i class="fa-solid fa-user-tag" title="Rol atama izni" style="color:#6c5ce7;"></i>');
    if (!items.length) return '<span style="font-size:10px; color:rgba(255,255,255,0.3);">izin yok</span>';
    return `<span style="display:inline-flex; gap:6px; font-size:11px;">${items.join('')}</span>`;
}

function _ensurePermOverrideStyles() {
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
