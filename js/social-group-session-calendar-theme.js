// social-group-session-calendar-theme.js
// social-group-session-calendar.js'ten çıkarıldı (Faz devam): Grup Teması
// seçici alt-sistemi — sadece kendi parametrelerine/localStorage'a bağımlı,
// GSC modül-seviyeli state'ine (gscSessionsCache vb.) dokunmuyor.

export const GROUP_THEME_COLORS = [
    { label: 'Mor (varsayılan)', hex: '6c5ce7' },
    { label: 'Mavi',   hex: '0984e3' },
    { label: 'Deniz',  hex: '00b894' },
    { label: 'Sarı',   hex: 'D4900E' },
    { label: 'Kırmızı', hex: 'e17055' },
    { label: 'Pembe',  hex: 'fd79a8' },
    { label: 'Gri',    hex: '636e72' },
    { label: 'Buz',    hex: '74b9ff' }
];

export function _groupThemeKey(supaId) { return `focusai_group_theme_${supaId}`; }

export function _hexToRgb(hex) {
    const r = parseInt(hex.slice(0,2),16), g = parseInt(hex.slice(2,4),16), b = parseInt(hex.slice(4,6),16);
    return `${r},${g},${b}`;
}

export function _applyGroupTheme(supaId) {
    const saved = supaId ? localStorage.getItem(_groupThemeKey(supaId)) : null;
    const hex = saved || '6c5ce7';
    let styleEl = document.getElementById('group-theme-style');
    if (!styleEl) { styleEl = document.createElement('style'); styleEl.id = 'group-theme-style'; document.head.appendChild(styleEl); }
    styleEl.textContent = `
        #active-group-panel .group-detail-tab-btn.active { background: #${hex}; border-color: #${hex}; }
        #active-group-panel .group-announcement-banner { border-left-color: #${hex}; }
        #active-group-panel .gsc-day-col.selected { background: rgba(${_hexToRgb(hex)}, 0.14); border-color: rgba(${_hexToRgb(hex)}, 0.45); }
    `;
}

export function _openGroupThemePicker(supaId, anchorEl) {
    document.querySelector('.grp-theme-picker')?.remove();
    const current = localStorage.getItem(_groupThemeKey(supaId)) || '6c5ce7';
    const picker = document.createElement('div');
    picker.className = 'grp-theme-picker';
    picker.innerHTML = `
        <div class="u-font-size-11px_font-weight-600_color-var-text-muted_margin">Grup Teması</div>
        <div class="u-display-flex_flex-wrap-wrap_gap-8px_margin-bottom-10px">
            ${GROUP_THEME_COLORS.map(c => `
                <button class="grp-theme-swatch${c.hex === current ? ' active' : ''}" data-hex="${c.hex}"
                    title="${c.label}"></button>`).join('')}
        </div>
        <button id="grp-theme-reset" class="u-font-size-11px_color-var-text-muted_background-none_border">Varsayılana sıfırla</button>
    `;
    const rect = anchorEl.getBoundingClientRect();
    picker.style.position = 'fixed';
    picker.style.top = `${rect.bottom+6}px`;
    picker.style.right = `${window.innerWidth-rect.right}px`;
    picker.style.zIndex = '20000';
    document.body.appendChild(picker);
    picker.querySelectorAll('.grp-theme-swatch').forEach(btn => {
        btn.style.background = '#' + btn.dataset.hex;
        btn.onclick = () => {
            localStorage.setItem(_groupThemeKey(supaId), btn.dataset.hex);
            _applyGroupTheme(supaId);
            picker.remove();
        };
    });
    picker.querySelector('#grp-theme-reset').onclick = () => {
        localStorage.removeItem(_groupThemeKey(supaId));
        _applyGroupTheme(supaId);
        picker.remove();
    };
    const close = (e) => { if (!picker.contains(e.target) && e.target !== anchorEl) { picker.remove(); document.removeEventListener('click', close, true); } };
    setTimeout(() => document.addEventListener('click', close, true), 50);
}
