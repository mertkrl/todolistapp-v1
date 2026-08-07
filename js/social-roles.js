import { _resolveProfileById } from './social-dc-profile-resolve.js';
import { getCurrentUser } from '../state/current-user-store.js';
import { getGmMembersSupabaseChannel, setGmMembersSupabaseChannel } from '../state/gm-members-channel-store.js';
import { getGmCustomRolesSupabaseChannel, setGmCustomRolesSupabaseChannel } from '../state/gm-custom-roles-channel-store.js';
import { _applyDynStyles, _gmPermLabelList, _gmPermBadges, _ensurePermOverrideStyles } from './social-roles-pure-utils.js';
// social-roles.js — Grup rolleri, izinler, üyelik yönetimi (moderasyon paneli)
// social.js'ten çıkarıldı; ayrı top-level scope'ta çalışır — social.js'in IIFE-özel değişkenlerine
// (getCurrentUser() gibi) doğrudan erişemez, bu yüzden getCurrentUser() kullanılır (social.js her atamada senkronlar).

// =======================================================================
// YENİ EKLENEN: SOHBET ALT ODALARI, RÜTBE VE YÖNETİM SİSTEMİ FONKSİYONLARI
// =======================================================================

// ─── ÖZEL ROL & İZİN SİSTEMİ ────────────────────────────
// Yerleşik roller için varsayılan izinler. Özel roller "groups/{code}/customRoles/{roleId}" altında saklanır.
// Hiyerarşi: yüksek "priority" düşük olanı yönetebilir (admin her zaman en üstte, üye en altta)
export const BUILTIN_ROLE_PERMS = {
    admin:     { name: 'Admin',     color: 'ff4757', manageRooms: true,  kickMembers: true,  lockRooms: true,  assignRoles: true,  manageSessions: true,  priority: 1000 },
    moderator: { name: 'Moderatör', color: '74b9ff', manageRooms: true,  kickMembers: true,  lockRooms: false, assignRoles: true,  manageSessions: true,  priority: 500  },
    member:    { name: 'Üye',       color: '636e72', manageRooms: false, kickMembers: false, lockRooms: false, assignRoles: false, manageSessions: false, priority: 0    }
};
// social.js bu sabite window. öneki OLMADAN, çıplak global olarak erişiyor (bkz. social.js:15399,
// 20205) — bu dosya IIFE ile sarılmadığı için zaten bir global'di; burada window.X olarak da
// açıkça dışa vermek davranışı değiştirmiyor, sadece dosyalar-arası bu bağımlılığı belgeliyor.
const CUSTOM_ROLE_BASE_PRIORITY = 100; // özel roller varsayılan olarak Üye ile Moderatör arasına yerleşir
const MAX_CUSTOM_ROLES = 10; // bir grupta oluşturulabilecek en fazla özel rol sayısı

// Bir rolün hiyerarşi sırasını döndürür (yerleşik veya özel)
export function getRolePriority(role, customRoles) {
    if (BUILTIN_ROLE_PERMS[role]) return BUILTIN_ROLE_PERMS[role].priority;
    const cr = customRoles && customRoles[role];
    return (cr && typeof cr.priority === 'number') ? cr.priority : CUSTOM_ROLE_BASE_PRIORITY;
}

// Bir üyenin (yerleşik veya özel) rolüne göre izinlerini getirir
// channelCtx verilirse (ör. {subId}) o kanala özel izin istisnaları (override) da değerlendirilir
// Firebase kaldırıldı: Firebase-dönemi grupları artık yok; bu çağrı her zaman
// 'Üye' izinleriyle döner. Supabase gruplarında getMemberPermissionsSupabase kullanılır.
export function getMemberPermissions(groupId, username, callback) {
    callback({ ...BUILTIN_ROLE_PERMS.member, role: 'member' });
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
export function resetRoleForm() {
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
export function logGroupAuditSupabase(groupId, type, detail) {
    if (!window.FocusSupabase || !getCurrentUser() || !getCurrentUser().id || !groupId) return;
    window.FocusSupabase.from('group_audit_log').insert({
        group_id: groupId,
        actor_id: getCurrentUser().id,
        type,
        detail
    }).then(({ error }) => {
        if (error) console.warn('logGroupAuditSupabase:', error.message);
    });
}

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
            const p = await _resolveProfileById(id);
            if (p) actors[id] = p;
        }));
        listEl.innerHTML = entries.map(e => {
            const meta = GM_AUDIT_TYPE_META[e.type] || { icon: 'fa-circle-info', color: '74b9ff' };
            const actor = actors[e.actor_id];
            const actorName = actor ? (actor.display_name || actor.username) : 'Birisi';
            const date = new Date(e.created_at);
            const timeStr = date.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
            return `
                <div class="u-display-flex_align-items-flex-start_gap-10px_padding-9px10">
                    <span data-dyn-bg="#${meta.color}1f" data-dyn-color="#${meta.color}" class="u-width-28px_height-28px_border-radius-50pct_display-flex_al">
                        <i class="fa-solid ${meta.icon}"></i>
                    </span>
                    <div class="si-min0">
                        <div class="u-font-size-12px_color-hfff_line-height-1p4"><b>${window._escapeHtml(actorName)}</b> — ${window._escapeHtml(e.detail || '')}</div>
                        <div class="u-font-size-10px_color-var-text-muted_margin-top-2px">${timeStr}</div>
                    </div>
                </div>
            `;
        }).join('');
        _applyDynStyles(listEl);
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

// ─── M2b-4 BÖLÜM 2a: ROL ATAMA + ÜYE ATMA (Supabase) ─────
// `group_custom_roles` satırlarını Firebase `customRoles` şekline çevirir
export async function loadGroupCustomRolesMapSupabase(groupId) {
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

// `getMemberPermissions`in Supabase karşılığı (kanal bazlı permOverrides M2b-4 Bölüm 2c'de)
// channelCtx verilirse (ör. {subId}) o alt-kanala özel izin istisnaları da değerlendirilir
export async function getMemberPermissionsSupabase(groupId, userId, callback, channelCtx) {
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

// `openChannelPermOverridePopover`ın Supabase karşılığı (M2b-4 Bölüm 2c)
export function openChannelPermOverridePopoverSupabase(anchorEl, groupId, subId, roomName) {
    document.querySelectorAll('.gm-perm-override-popover').forEach(p => p.remove());
    if (!window.FocusSupabase) return;
    _ensurePermOverrideStyles();

    const popover = document.createElement('div');
    popover.className = 'gm-perm-override-popover glass-panel';
    popover.style.position = 'absolute';
    popover.style.zIndex = '10200';
    popover.style.minWidth = '290px';
    popover.style.maxWidth = '330px';
    popover.style.padding = '0';
    popover.style.borderRadius = '14px';
    popover.style.background = 'rgba(22,22,32,0.98)';
    popover.style.border = '1px solid rgba(255,255,255,0.08)';
    popover.style.boxShadow = '0 16px 40px rgba(0,0,0,0.5)';
    popover.style.overflow = 'hidden';
    popover.style.opacity = '0';
    popover.style.transform = 'translateY(-6px) scale(0.97)';
    popover.style.transition = 'opacity 0.14s ease, transform 0.14s ease';
    popover.innerHTML = `
        <div class="u-display-flex_align-items-flex-start_gap-10px_padding-14px1">
            <div class="u-width-32px_height-32px_border-radius-9px_background-rgba11">
                <i class="fa-solid fa-sliders u-color-h74b9ff_font-size-14px" ></i>
            </div>
            <div class="si-flex1">
                <div class="u-font-size-12p5px_font-weight-700_color-hfff_overflow-hidde"># ${window._escapeHtml(roomName)}</div>
                <div class="u-fs10p5_color-text-muted_mt1">İzin İstisnaları</div>
            </div>
            <button class="gm-perm-override-close u-background-rgba2552552550p06_border-none_color-var-text-mu" title="Kapat"  aria-label="Kapat">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
        <div class="u-padding-12px14px">
            <div class="u-display-flex_gap-8px_align-items-flex-start_font-size-10p5">
                <i class="fa-solid fa-circle-info u-color-h74b9ff_mt1"></i>
                <span>Normalde "oda kilitleme" iznine sahip olmayan rollere, <b class="u-color-hfff">sadece bu oda için</b> kilitleme/açma istisnası tanımlayabilirsin.</span>
            </div>
            <div id="gm-perm-override-rows" class="u-display-flex_flex-direction-column_gap-6px_max-height-260p"></div>
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
                <div class="u-text-align-center_padding-22px10px">
                    <i class="fa-solid fa-circle-check u-font-size-22px_color-rgba462131150p5_display-block_margin-" ></i>
                    <div class="si-muted-xs">Tüm roller zaten kilitleme iznine sahip.<br>İstisna tanımlanacak rol yok.</div>
                </div>`;
            return;
        }

        rowsEl.innerHTML = candidateRoles.map(r => {
            const ov = overrides[r.id] || {};
            const checked = !!ov.lockRooms;
            return `
                <div class="gm-override-row u-display-flex_align-items-center_justify-content-space-betw-20" >
                    <div class="u-display-flex_align-items-center_gap-8px_min-width-0">
                        <div data-dyn-bg="#${window._escapeHtml(r.color)}" class="u-width-26px_height-26px_border-radius-50pct_display-flex_al">${window._escapeHtml((r.name || '?').charAt(0)).toUpperCase()}</div>
                        <div class="si-min0">
                            <div class="u-font-weight-600_color-hfff_font-size-12px_overflow-hidden_">${window._escapeHtml(r.name)}</div>
                            <div class="u-fs10_color-text-muted_flex_ai-center_gap4_mt1">
                                <i class="fa-solid fa-lock u-font-size-9px" data-dyn-color="${checked ? '#feca57' : 'var(--text-muted)'}"></i>
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
        _applyDynStyles(rowsEl);

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
                    label.innerHTML = `<i class="fa-solid fa-lock u-font-size-9px" ></i> ${cb.checked ? 'Kilitleme izni verildi' : 'Kilitleme izni yok'}`;
                    const lockIcon = label.querySelector('i.fa-lock');
                    if (lockIcon) lockIcon.style.color = cb.checked ? '#feca57' : 'var(--text-muted)';
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

// `openRolePickerPopover`in Supabase karşılığı
function openRolePickerPopoverSupabase(anchorEl, groupId, memberUserId, currentRole, customRoles, myPriority, memberDisplayName, moderatorOverride) {
    document.querySelectorAll('.gm-role-picker-popover').forEach(p => p.remove());

    const popover = document.createElement('div');
    popover.className = 'gm-role-picker-popover glass-panel';
    popover.style.position = 'absolute';
    popover.style.zIndex = '10200';
    popover.style.minWidth = '215px';
    popover.style.padding = '8px';
    popover.style.borderRadius = '12px';
    popover.style.background = 'rgba(25,25,35,0.97)';
    popover.style.border = '1px solid rgba(255,255,255,0.08)';
    popover.style.boxShadow = '0 14px 34px rgba(0,0,0,0.45)';
    popover.style.display = 'flex';
    popover.style.flexDirection = 'column';
    popover.style.gap = '2px';
    popover.style.opacity = '0';
    popover.style.transform = 'translateY(-6px) scale(0.97)';
    popover.style.transition = 'opacity 0.14s ease, transform 0.14s ease';

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
        <div class="gm-role-picker-opt u-display-flex_align-items-center_gap-9px_padding-8px10px_bo" data-role-id="${r.id}" ${isLocked ? 'data-locked="1"' : ''}
 
 data-dyn-cursor="${isLocked ? 'not-allowed' : 'pointer'}" data-dyn-opacity="${isLocked ? '0.4' : '1'}"
 ${r.id === currentRole ? 'data-dyn-bg="rgba(255,255,255,0.05)"' : ''}>
            <span data-dyn-bg="#${r.color}" data-dyn-shadow="0 0 6px #${r.color}88" class="u-width-9px_height-9px_border-radius-50pct_display-inline-bl"></span>
            <span class="u-flex-1_min-width-0_overflow-hidden_text-overflow-ellipsis_">${window._escapeHtml(r.name)}</span>
            ${isLocked ? '<i class="fa-solid fa-lock u-font-size-10px_color-rgba2552552550p35" title="Bu rolü vermek için yeterli yetkiniz yok"></i>' : _gmPermBadges(r)}
            ${r.id === currentRole ? '<i class="fa-solid fa-check u-font-size-11px_color-h2ed573" ></i>' : ''}
        </div>
    `;
    };

    const sectionLabel = (txt) => `<div class="u-font-size-10px_text-transform-uppercase_letter-spacing-0p6">${txt}</div>`;

    let html = sectionLabel('Yerleşik Roller') + builtinRoles.map(renderOpt).join('');
    if (customRoleList.length) {
        html += `<div class="u-height-1px_background-rgba2552552550p06_margin-4px4px"></div>`;
        html += sectionLabel('Özel Roller') + customRoleList.map(renderOpt).join('');
    }
    popover.innerHTML = html;
    _applyDynStyles(popover);

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
                desc: `<b>${memberDisplayName ? (window._escapeHtml(memberDisplayName)) : 'Bu kullanıcıya'}</b> <b>"${window._escapeHtml(roleName)}"</b> rolü verilecek.<br>Bu işlemi onaylıyor musunuz?`,
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
    const moderatorPerms = { ...BUILTIN_ROLE_PERMS.moderator, ...moderatorOverride };

    const moderatorRowHtml = `
        <div class="glass-panel u-padding-7px10px_border-radius-8px_display-flex_align-items" data-dyn-bdc="#${BUILTIN_ROLE_PERMS.moderator.color}">
            <div class="u-display-flex_align-items-center_gap-8px_min-width-0_flex-1">
                <i class="fa-solid fa-lock u-font-size-10px_color-rgba2552552550p25_flex-shrink-0" title="Yerleşik rol — sırası sabittir"></i>
                <span data-dyn-color="#${BUILTIN_ROLE_PERMS.moderator.color}" class="u-font-size-12p5px_font-weight-600_white-space-nowrap_overfl">${BUILTIN_ROLE_PERMS.moderator.name}</span>
                <span class="si-badge u-flex-shrink-0" >${memberCounts['moderator'] || 0} üye</span>
                ${_gmPermBadges(moderatorPerms)}
            </div>
            <div class="si-row-g2">
                ${isAdmin ? `<button class="gm-edit-role-btn" data-role-id="moderator" title="İzinleri Düzenle" aria-label="İzinleri Düzenle"><i class="fa-solid fa-pen"></i></button>` : ''}
            </div>
        </div>
    `;

    const customRolesHtml = !roles.length
        ? `<div class="u-padding-10px_font-size-12px_color-var-text-muted_text-alig">Henüz özel rol oluşturulmadı.</div>`
        : roles.map((r, idx) => {
        const color = r.color || '6c5ce7';
        const count = memberCounts[r.id] || 0;
        return `
            <div class="glass-panel u-padding-7px10px_border-radius-8px_display-flex_align-items" data-dyn-bdc="#${color}">
                <div class="u-display-flex_flex-direction-column_gap-0_flex-shrink-0">
                    <button class="gm-role-row-up" data-role-id="${r.id}" data-dir="up" ${idx === 0 ? 'disabled' : ''} title="Yukarı taşı (daha yetkili)" aria-label="Yukarı taşı (daha yetkili)"><i class="fa-solid fa-chevron-up"></i></button>
                    <button class="gm-role-row-down" data-role-id="${r.id}" data-dir="down" ${idx === roles.length - 1 ? 'disabled' : ''} title="Aşağı taşı (daha az yetkili)" aria-label="Aşağı taşı (daha az yetkili)"><i class="fa-solid fa-chevron-down"></i></button>
                </div>
                <div class="u-display-flex_align-items-center_gap-8px_min-width-0_flex-1">
                    <span data-dyn-color="#${color}" class="u-font-size-12p5px_font-weight-600_white-space-nowrap_overfl">${window._escapeHtml(r.name)}</span>
                    <span class="si-badge u-flex-shrink-0" >${count} üye</span>
                    ${_gmPermBadges({ manageRooms: r.manage_rooms, kickMembers: r.kick_members, lockRooms: r.lock_rooms, assignRoles: r.assign_roles })}
                </div>
                <div class="si-row-g2">
                    <button class="gm-edit-role-btn" data-role-id="${r.id}" title="Rolü Düzenle" aria-label="Rolü Düzenle"><i class="fa-solid fa-pen"></i></button>
                    <button class="icon-btn gm-delete-role-btn" data-role-id="${r.id}" title="Rolü Sil" class="si-red" aria-label="Rolü Sil"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            </div>
        `;
    }).join('');

    listEl.innerHTML = moderatorRowHtml + customRolesHtml;
    _applyDynStyles(listEl);

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

// `deleteCustomRole`in Supabase karşılığı
async function deleteCustomRoleSupabase(groupId, roleId, roleName) {
    if (!window.FocusSupabase) return;
    const { error } = await window.FocusSupabase.from('group_custom_roles').delete().eq('id', roleId);
    if (error) { window.dcShowToast('Rol silinirken hata: ' + error.message); return; }
    // Bu role sahip üyeleri "member" rolüne çevir
    await window.FocusSupabase.from('group_members').update({ role: null }).eq('group_id', groupId).eq('role', roleId);
    logGroupAuditSupabase(groupId, 'role_delete', `"${roleName || roleId}" adlı rol silindi`);
}

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
                    <i class="fa-solid fa-circle-check u-font-size-20px_opacity-0p25_display-block_margin-bottom-8p" ></i>
                    Bekleyen katılım isteği yok.
                </div>`;
            return;
        }

        listEl.innerHTML = rows.map(row => {
            const profile = row.profiles || {};
            const username = profile.username || row.user_id;
            const displayName = profile.display_name || username;
            return `
                <div class="glass-panel u-padding-10px12px_border-radius-10px_display-flex_align-ite" data-user-id="${row.user_id}" >
                    <div class="si-row-g10-min0">
                        ${window.avatarImgHtml({ customAvatar: profile.custom_avatar, avatarInitials: profile.avatar_initials || null, avatarColor: profile.avatar_color, displayName }, 32, '', '')}
                        <div class="si-col">
                            <span class="gm-pending-name si-title-bold">${window._escapeHtml(displayName)}</span>
                            <span class="si-muted-xs">@${window._escapeHtml(username)}</span>
                        </div>
                    </div>
                    <div class="u-display-flex_gap-6px_flex-shrink-0">
                        <button class="gm-approve-btn u-background-rgba462131150p15_border-1pxsolidrgba462131150p3" data-user-id="${row.user_id}" title="Onayla"  aria-label="Onayla"><i class="fa-solid fa-check"></i></button>
                        <button class="gm-reject-btn u-background-rgba25571870p15_border-1pxsolidrgba25571870p3_c" data-user-id="${row.user_id}" title="Reddet"  aria-label="Reddet"><i class="fa-solid fa-xmark"></i></button>
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

// `approvePendingMember`in Supabase karşılığı
async function approvePendingMemberSupabase(groupId, userId, displayName) {
    if (!window.FocusSupabase) return;
    const { error: insErr } = await window.FocusSupabase.from('group_members').insert({ group_id: groupId, user_id: userId, role: null });
    if (insErr) { window.dcShowToast('Onaylanırken hata: ' + insErr.message); return; }
    await window.FocusSupabase.from('group_pending_members').delete().eq('group_id', groupId).eq('user_id', userId);
    logGroupAuditSupabase(groupId, 'member_approve', `${displayName ? '"' + displayName + '"' : 'Bir kullanıcının'} katılım isteği onaylandı`);
}

// `rejectPendingMember`in Supabase karşılığı
async function rejectPendingMemberSupabase(groupId, userId, displayName) {
    if (!window.FocusSupabase) return;
    const { error } = await window.FocusSupabase.from('group_pending_members').delete().eq('group_id', groupId).eq('user_id', userId);
    if (error) { window.dcShowToast('Reddedilirken hata: ' + error.message); return; }
    logGroupAuditSupabase(groupId, 'member_reject', `${displayName ? '"' + displayName + '"' : 'Bir kullanıcının'} katılım isteği reddedildi`);
}

// `toggleRequireApproval`in Supabase karşılığı
function toggleRequireApprovalSupabase(groupId, enabled) {
    if (!window.FocusSupabase) return;
    window.FocusSupabase.from('groups').update({ require_approval: !!enabled }).eq('id', groupId).then(({ error }) => {
        if (error) { window.dcShowToast('Hata: ' + error.message); return; }
        logGroupAuditSupabase(groupId, 'settings_change', `Katılım onayı ${enabled ? 'açıldı' : 'kapatıldı'}`);
    });
}

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

// M2b-4 Bölüm 1: Supabase grupları için sadeleştirilmiş "Grup Yönetimi" modalı
// (Üyeler salt-okunur + Geçmiş sekmesi; Roller/İstekler/Tehlikeli Bölge Bölüm 2'ye kadar gizli)
// openGroupManagementModalSupabase'den ayrılan: Üyeler sekmesi listesini render eder.
// groupId/groupData/membersListEl parametre olarak geçirilir (dış closure'a bağımlılık yok),
// bu yüzden hem ilk render'da hem realtime callback'lerde aynı isimle çağrılabilir.
// Faz S devamı, dev fonksiyon refactoru.
async function _gmRenderMembersList(membersListEl, groupId, groupData) {
        if (!membersListEl || !window.FocusSupabase) return;
        const { data: memberRows, error } = await window.FocusSupabase
            .from('group_members')
            .select('user_id, role, profiles(username, display_name, avatar_color, custom_avatar, avatar_initials)')
            .eq('group_id', groupId);
        if (error || !memberRows) return;

        const customRolesMap = await loadGroupCustomRolesMapSupabase(groupId);
        const moderatorOverride = (groupData.builtinRoleOverrides && groupData.builtinRoleOverrides.moderator) || null;
        const createdByUsername = groupData.createdBy;

        const myRow = memberRows.find(m => m.user_id === getCurrentUser().id);
        let myRole = myRow ? myRow.role : null;
        if (!myRole) myRole = (createdByUsername === getCurrentUser().username) ? 'admin' : 'member';
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
            membersListEl.innerHTML = `<div class="u-text-align-center_color-var-text-muted_padding-10px">Üye bulunamadı.</div>`;
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
            const canAssignRole = (isAdmin || myPerms.assignRoles) && m.user_id !== getCurrentUser().id && (isAdmin || targetPriority < myPriority);
            const canKick = myPerms.kickMembers && m.user_id !== getCurrentUser().id && targetPriority < myPriority;

            // roleLabel özel rollerde admin'in yazdığı serbest metin olabilir (bkz.
            // createOrUpdateCustomRoleSupabase) — escape şart. roleColor de aynı
            // sebeple (RLS içeriği kısıtlamıyor, bkz. avatarImgHtml'deki emsal).
            const safeRoleColor = window._escapeHtml(roleColor);
            const chipHtml = `
                <span class="gm-role-chip ${canAssignRole ? 'gm-role-chip-clickable' : ''} u-display-inline-flex_align-items-center_gap-6px_font-size-1" data-user-id="${m.user_id}" data-role="${window._escapeHtml(memberRole)}"
 
 data-dyn-bg="#${safeRoleColor}26" data-dyn-color="#${safeRoleColor}" data-dyn-bordercolor="#${safeRoleColor}55"
 ${canAssignRole ? 'data-dyn-cursor="pointer"' : ''}>
                    <span data-dyn-bg="#${safeRoleColor}" class="u-width-7px_height-7px_border-radius-50pct_display-inline-bl"></span>
                    ${window._escapeHtml(roleLabel)}
                    ${canAssignRole ? '<i class="fa-solid fa-chevron-down u-font-size-9px_opacity-0p7" ></i>' : ''}
                </span>
            `;

            const kickHtml = canKick ? `
                <button class="gm-kick-member-btn u-display-inline-flex_align-items-center_gap-6px_margin-left" data-user-id="${m.user_id}" title="Gruptan At"
 >
                    <i class="fa-solid fa-user-xmark si-shrink0"></i>
                    <span class="u-white-space-nowrap_opacity-0_transition-opacity0p15sease">Gruptan At</span>
                </button>
            ` : '';

            return `
                <div class="mgmt-member-row u-display-flex_align-items-center_justify-content-space-betw-21" data-user-id="${m.user_id}" >
                    <div class="mgmt-member-info si-row-g10-min0">
                        ${window.avatarImgHtml({ customAvatar: profile.custom_avatar, avatarInitials: profile.avatar_initials || null, avatarColor: profile.avatar_color, displayName }, 34, '', 'class="mgmt-member-avatar"')}
                        <div class="mgmt-member-details si-col">
                            <span class="mgmt-member-name si-title-bold">${window._escapeHtml(displayName)}</span>
                            <span class="mgmt-member-username si-muted-xs">@${window._escapeHtml(username)}</span>
                        </div>
                    </div>
                    <div class="u-display-flex_align-items-center_flex-shrink-0">${chipHtml}${kickHtml}</div>
                </div>
            `;
        }).join('');
        _applyDynStyles(membersListEl);

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

export async function openGroupManagementModalSupabase(groupCode, groupId, groupData) {
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

    const myPerms = await new Promise(resolve => getMemberPermissionsSupabase(groupId, getCurrentUser().id, resolve));
    const isAdmin = myPerms.role === 'admin';
    const canSeeRequests = !!myPerms.kickMembers;
    const isOwner = groupData.createdBy === getCurrentUser().username;

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
    resetRoleForm();

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
            resetRoleForm();
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
    _gmRenderMembersList(membersListEl, groupId, groupData);

    document.getElementById('gm-member-empty-state')?.classList.add('hidden');

    // Roller & İzinler sekmesi
    loadGroupCustomRolesSupabase(groupId, isAdmin);

    // İstekler sekmesi (sadece üye atma yetkisi olanlar)
    if (canSeeRequests) loadPendingMembersSupabase(groupId);

    // Geçmiş sekmesi
    const auditListEl = document.getElementById('gm-audit-log-list');
    if (auditListEl) loadGroupAuditLogSupabase(groupId, auditListEl);

    // Üye/rol değişikliklerinde "Üyeler" sekmesini canlı güncelle
    if (getGmMembersSupabaseChannel()) {
        try { window.FocusSupabase.removeChannel(getGmMembersSupabaseChannel()); } catch (_) { console.warn('[FocusAI] sessiz hata:', _); }
        setGmMembersSupabaseChannel(null);
    }
    setGmMembersSupabaseChannel(window.FocusSupabase
        .channel(`group-mgmt-members-${groupId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members', filter: `group_id=eq.${groupId}` }, () => _gmRenderMembersList(membersListEl, groupId, groupData))
        .subscribe());

    if (getGmCustomRolesSupabaseChannel()) {
        try { window.FocusSupabase.removeChannel(getGmCustomRolesSupabaseChannel()); } catch (_) { console.warn('[FocusAI] sessiz hata:', _); }
        setGmCustomRolesSupabaseChannel(null);
    }
    setGmCustomRolesSupabaseChannel(window.FocusSupabase
        .channel(`group-mgmt-custom-roles-${groupId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'group_custom_roles', filter: `group_id=eq.${groupId}` }, () => {
            _gmRenderMembersList(membersListEl, groupId, groupData);
            loadGroupCustomRolesSupabase(groupId, isAdmin);
        })
        .subscribe());

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

