// social-dc-chat-theme.js
// social.js'ten çıkarıldı (Faz E, 2026-07-23): DC sohbet teması/görünüm
// ayarları — renk teması, arka plan (duvar kağıdı), balon şekli, yazı
// boyutu/tipi, kompakt mod. Tamamen izole: paylaşılan mesaj/oda state'ine
// (_dcMsgRegistry, currentRoomId vb.) hiç dokunmuyor, sadece localStorage +
// #dc-chat-area DOM'u üzerinden çalışıyor.
//
// Dış bağımlılık YOK. Tek dışa açık nokta: window.initDcChatTheme —
// social.js'in openDcGroupChannelSupabase/openDcDmRoom fonksiyonlarından
// (oda/DM açılışında) çağrılıyor.

    // Tema/duvar kağıdı/balon şekli/yazı boyutu/tipi sabit tabloları +
    // dcHexToRgba → social-dc-chat-theme-constants.js dosyasına taşındı.
    import {
        DC_CHAT_THEMES, DC_CHAT_THEME_KEY, DC_CHAT_CUSTOM_COLOR_KEY,
        DC_CHAT_WALLPAPERS, DC_CHAT_WALLPAPER_KEY,
        DC_CHAT_FONT_SIZES, DC_CHAT_FONT_SIZE_KEY,
        DC_CHAT_FONT_FAMILIES, DC_CHAT_FONT_FAMILY_KEY,
        DC_CHAT_BUBBLE_SHAPES, DC_CHAT_BUBBLE_SHAPE_KEY,
        DC_CHAT_COMPACT_KEY, dcHexToRgba
    } from './social-dc-chat-theme-constants.js';

    function getDcChatCustomColor() {
        let customColor = '#a29bfe';
        try { customColor = localStorage.getItem(DC_CHAT_CUSTOM_COLOR_KEY) || '#a29bfe'; } catch (e) { console.warn('[FocusAI] sessiz hata:', e); }
        return customColor;
    }

    function getDcChatThemeVars(themeKey) {
        if (themeKey === 'custom') {
            const customColor = getDcChatCustomColor();
            return { accent: customColor, bubbleMe: dcHexToRgba(customColor, 0.32), bubbleMeBorder: dcHexToRgba(customColor, 0.3) };
        }
        return DC_CHAT_THEMES[themeKey] || DC_CHAT_THEMES.purple;
    }

    function setDcChatThemeVars(themeKey) {
        const area = document.getElementById('dc-chat-area');
        if (!area) return;
        const theme = getDcChatThemeVars(themeKey);
        area.style.setProperty('--dc-accent', theme.accent);
        area.style.setProperty('--dc-bubble-me-bg', theme.bubbleMe);
        area.style.setProperty('--dc-bubble-me-border', theme.bubbleMeBorder);
    }

    function applyDcChatTheme(themeKey) {
        setDcChatThemeVars(themeKey);
        try { localStorage.setItem(DC_CHAT_THEME_KEY, themeKey); } catch (e) { console.warn('[FocusAI] sessiz hata:', e); }
        updateDcThemePopoverActiveStates();
    }

    function previewDcChatTheme(themeKey) { setDcChatThemeVars(themeKey); }

    function restoreDcChatTheme() {
        let saved = 'purple';
        try { saved = localStorage.getItem(DC_CHAT_THEME_KEY) || 'purple'; } catch (e) { console.warn('[FocusAI] sessiz hata:', e); }
        setDcChatThemeVars(saved);
    }

    function applyDcChatCustomColor(hex) {
        try { localStorage.setItem(DC_CHAT_CUSTOM_COLOR_KEY, hex); } catch (e) { console.warn('[FocusAI] sessiz hata:', e); }
        applyDcChatTheme('custom');
    }

    function setDcChatWallpaperClass(wallpaperKey) {
        const streamEl = document.getElementById('sidebar-chat-messages-stream');
        if (!streamEl) return;
        Object.keys(DC_CHAT_WALLPAPERS).forEach(key => streamEl.classList.remove(`dc-wallpaper-${key}`));
        if (wallpaperKey && wallpaperKey !== 'none') streamEl.classList.add(`dc-wallpaper-${wallpaperKey}`);
    }

    function applyDcChatWallpaper(wallpaperKey) {
        setDcChatWallpaperClass(wallpaperKey);
        try { localStorage.setItem(DC_CHAT_WALLPAPER_KEY, wallpaperKey); } catch (e) { console.warn('[FocusAI] sessiz hata:', e); }
        updateDcThemePopoverActiveStates();
    }

    function previewDcChatWallpaper(wallpaperKey) { setDcChatWallpaperClass(wallpaperKey); }

    function restoreDcChatWallpaper() {
        let saved = 'none';
        try { saved = localStorage.getItem(DC_CHAT_WALLPAPER_KEY) || 'none'; } catch (e) { console.warn('[FocusAI] sessiz hata:', e); }
        setDcChatWallpaperClass(saved);
    }

    function setDcChatFontSizeVar(sizeKey) {
        const size = DC_CHAT_FONT_SIZES[sizeKey] || DC_CHAT_FONT_SIZES.medium;
        const area = document.getElementById('dc-chat-area');
        if (!area) return;
        area.style.setProperty('--dc-msg-font-size', size.value);
    }

    function applyDcChatFontSize(sizeKey) {
        setDcChatFontSizeVar(sizeKey);
        try { localStorage.setItem(DC_CHAT_FONT_SIZE_KEY, sizeKey); } catch (e) { console.warn('[FocusAI] sessiz hata:', e); }
        updateDcThemePopoverActiveStates();
    }

    function previewDcChatFontSize(sizeKey) { setDcChatFontSizeVar(sizeKey); }

    function restoreDcChatFontSize() {
        let saved = 'medium';
        try { saved = localStorage.getItem(DC_CHAT_FONT_SIZE_KEY) || 'medium'; } catch (e) { console.warn('[FocusAI] sessiz hata:', e); }
        setDcChatFontSizeVar(saved);
    }

    function setDcChatFontFamilyVar(familyKey) {
        const family = DC_CHAT_FONT_FAMILIES[familyKey] || DC_CHAT_FONT_FAMILIES.default;
        const area = document.getElementById('dc-chat-area');
        if (!area) return;
        area.style.setProperty('--dc-msg-font-family', family.value);
    }

    function applyDcChatFontFamily(familyKey) {
        setDcChatFontFamilyVar(familyKey);
        try { localStorage.setItem(DC_CHAT_FONT_FAMILY_KEY, familyKey); } catch (e) { console.warn('[FocusAI] sessiz hata:', e); }
        updateDcThemePopoverActiveStates();
    }

    function previewDcChatFontFamily(familyKey) { setDcChatFontFamilyVar(familyKey); }

    function restoreDcChatFontFamily() {
        let saved = 'default';
        try { saved = localStorage.getItem(DC_CHAT_FONT_FAMILY_KEY) || 'default'; } catch (e) { console.warn('[FocusAI] sessiz hata:', e); }
        setDcChatFontFamilyVar(saved);
    }

    function setDcChatBubbleShapeVars(shapeKey) {
        const shape = DC_CHAT_BUBBLE_SHAPES[shapeKey] || DC_CHAT_BUBBLE_SHAPES.rounded;
        const area = document.getElementById('dc-chat-area');
        if (!area) return;
        area.style.setProperty('--dc-bubble-radius-me', shape.meRadius);
        area.style.setProperty('--dc-bubble-radius-other', shape.otherRadius);
    }

    function applyDcChatBubbleShape(shapeKey) {
        setDcChatBubbleShapeVars(shapeKey);
        try { localStorage.setItem(DC_CHAT_BUBBLE_SHAPE_KEY, shapeKey); } catch (e) { console.warn('[FocusAI] sessiz hata:', e); }
        updateDcThemePopoverActiveStates();
    }

    function previewDcChatBubbleShape(shapeKey) { setDcChatBubbleShapeVars(shapeKey); }

    function restoreDcChatBubbleShape() {
        let saved = 'rounded';
        try { saved = localStorage.getItem(DC_CHAT_BUBBLE_SHAPE_KEY) || 'rounded'; } catch (e) { console.warn('[FocusAI] sessiz hata:', e); }
        setDcChatBubbleShapeVars(saved);
    }

    function applyDcChatCompactMode(enabled) {
        const area = document.getElementById('dc-chat-area');
        if (area) area.classList.toggle('dc-compact-mode', !!enabled);
        try { localStorage.setItem(DC_CHAT_COMPACT_KEY, enabled ? 'true' : 'false'); } catch (e) { console.warn('[FocusAI] sessiz hata:', e); }
        updateDcThemePopoverActiveStates();
    }

    function restoreDcChatCompactMode() {
        let saved = 'false';
        try { saved = localStorage.getItem(DC_CHAT_COMPACT_KEY) || 'false'; } catch (e) { console.warn('[FocusAI] sessiz hata:', e); }
        const area = document.getElementById('dc-chat-area');
        if (area) area.classList.toggle('dc-compact-mode', saved === 'true');
    }

    function updateDcThemePopoverActiveStates() {
        const popover = document.getElementById('dc-chat-theme-popover');
        if (!popover) return;
        let savedTheme = 'purple', savedWallpaper = 'none', savedShape = 'rounded',
            savedFontSize = 'medium', savedFontFamily = 'default', savedCompact = 'false';
        try {
            savedTheme = localStorage.getItem(DC_CHAT_THEME_KEY) || 'purple';
            savedWallpaper = localStorage.getItem(DC_CHAT_WALLPAPER_KEY) || 'none';
            savedShape = localStorage.getItem(DC_CHAT_BUBBLE_SHAPE_KEY) || 'rounded';
            savedFontSize = localStorage.getItem(DC_CHAT_FONT_SIZE_KEY) || 'medium';
            savedFontFamily = localStorage.getItem(DC_CHAT_FONT_FAMILY_KEY) || 'default';
            savedCompact = localStorage.getItem(DC_CHAT_COMPACT_KEY) || 'false';
        } catch (e) { console.warn('[FocusAI] sessiz hata:', e); }

        popover.querySelectorAll('[data-theme]').forEach(el => el.classList.toggle('is-active', el.dataset.theme === savedTheme));
        popover.querySelectorAll('[data-wallpaper]').forEach(el => el.classList.toggle('is-active', el.dataset.wallpaper === savedWallpaper));
        popover.querySelectorAll('[data-shape]').forEach(el => el.classList.toggle('is-active', el.dataset.shape === savedShape));
        popover.querySelectorAll('[data-fontsize]').forEach(el => el.classList.toggle('is-active', el.dataset.fontsize === savedFontSize));
        popover.querySelectorAll('[data-fontfamily]').forEach(el => el.classList.toggle('is-active', el.dataset.fontfamily === savedFontFamily));
        const compactToggle = popover.querySelector('[data-compact-toggle]');
        if (compactToggle) compactToggle.classList.toggle('is-active', savedCompact === 'true');

        const customSwatch = popover.querySelector('.dc-theme-swatch-custom');
        if (customSwatch) {
            const customColor = getDcChatCustomColor();
            customSwatch.style.background = customColor;
            const inp = customSwatch.querySelector('input[type="color"]');
            if (inp) inp.value = customColor;
        }
    }

export function initDcChatTheme() {
        restoreDcChatTheme();
        restoreDcChatWallpaper();
        restoreDcChatBubbleShape();
        restoreDcChatFontSize();
        restoreDcChatFontFamily();
        restoreDcChatCompactMode();

        const btn = document.getElementById('dc-chat-theme-btn');
        const popover = document.getElementById('dc-chat-theme-popover');
        if (!btn || !popover || btn.dataset.bound) {
            updateDcThemePopoverActiveStates();
            return;
        }
        btn.dataset.bound = '1';

        const wallpaperPreviewClass = {
            none: '', stars: 'dc-wallpaper-swatch-stars', aurora: 'dc-wallpaper-swatch-aurora',
            dots: 'dc-wallpaper-swatch-dots', waves: 'dc-wallpaper-swatch-waves',
        };

        const customColor = getDcChatCustomColor();

        popover.innerHTML = `
            <div class="dc-theme-section">
                <div class="dc-theme-section-label">Renk</div>
                <div class="dc-theme-section-row">
                    ${Object.entries(DC_CHAT_THEMES).map(([key, t]) => `
                        <button class="dc-theme-swatch" data-theme="${key}" data-accent="${t.accent}" title="${t.label}"></button>
                    `).join('')}
                    <label class="dc-theme-swatch dc-theme-swatch-custom" data-theme="custom" title="Özel Renk">
                        <input type="color" value="${customColor}">
                    </label>
                </div>
            </div>
            <div class="dc-theme-section">
                <div class="dc-theme-section-label">Arka Plan</div>
                <div class="dc-theme-section-row">
                    ${Object.entries(DC_CHAT_WALLPAPERS).map(([key, w]) => `
                        <button class="dc-wallpaper-swatch ${wallpaperPreviewClass[key]}" data-wallpaper="${key}" title="${w.label}">${key === 'none' ? '<i class="fa-solid fa-ban"></i>' : ''}</button>
                    `).join('')}
                </div>
            </div>
            <div class="dc-theme-section">
                <div class="dc-theme-section-label">Balon Şekli</div>
                <div class="dc-theme-section-row">
                    ${Object.entries(DC_CHAT_BUBBLE_SHAPES).map(([key, s]) => `
                        <button class="dc-theme-pill" data-shape="${key}">${s.label}</button>
                    `).join('')}
                    <button class="dc-theme-pill" data-compact-toggle title="Avatarsız, sıkışık görünüm"><i class="fa-solid fa-compress"></i> Kompakt Mod</button>
                </div>
            </div>
            <div class="dc-theme-section">
                <div class="dc-theme-section-label">Yazı Boyutu</div>
                <div class="dc-theme-section-row">
                    ${Object.entries(DC_CHAT_FONT_SIZES).map(([key, s]) => `
                        <button class="dc-theme-pill" data-fontsize="${key}">${s.label}</button>
                    `).join('')}
                </div>
            </div>
            <div class="dc-theme-section">
                <div class="dc-theme-section-label">Yazı Tipi</div>
                <div class="dc-theme-section-row">
                    ${Object.entries(DC_CHAT_FONT_FAMILIES).map(([key, f]) => `
                        <button class="dc-theme-pill" data-fontfamily="${key}">${f.label}</button>
                    `).join('')}
                </div>
            </div>
        `;

        popover.querySelectorAll('.dc-theme-swatch[data-accent]').forEach(swatch => {
            swatch.style.background = swatch.dataset.accent;
        });
        popover.querySelectorAll('.dc-theme-pill[data-fontfamily]').forEach(pill => {
            const fam = DC_CHAT_FONT_FAMILIES[pill.dataset.fontfamily]?.value;
            if (fam) pill.style.fontFamily = fam;
        });

        popover.querySelectorAll('.dc-theme-swatch[data-theme]:not(.dc-theme-swatch-custom)').forEach(swatch => {
            swatch.addEventListener('click', (e) => {
                e.stopPropagation();
                applyDcChatTheme(swatch.dataset.theme);
            });
            swatch.addEventListener('mouseenter', () => previewDcChatTheme(swatch.dataset.theme));
            swatch.addEventListener('mouseleave', () => restoreDcChatTheme());
        });

        const customSwatch = popover.querySelector('.dc-theme-swatch-custom');
        if (customSwatch) customSwatch.style.background = customColor;
        const customInput = customSwatch ? customSwatch.querySelector('input[type="color"]') : null;
        if (customSwatch && customInput) {
            customInput.addEventListener('click', (e) => e.stopPropagation());
            customInput.addEventListener('input', (e) => {
                e.stopPropagation();
                customSwatch.style.background = e.target.value;
                applyDcChatCustomColor(e.target.value);
            });
            customSwatch.addEventListener('mouseenter', () => previewDcChatTheme('custom'));
            customSwatch.addEventListener('mouseleave', () => restoreDcChatTheme());
        }

        popover.querySelectorAll('.dc-wallpaper-swatch').forEach(swatch => {
            swatch.addEventListener('click', (e) => {
                e.stopPropagation();
                applyDcChatWallpaper(swatch.dataset.wallpaper);
            });
            swatch.addEventListener('mouseenter', () => previewDcChatWallpaper(swatch.dataset.wallpaper));
            swatch.addEventListener('mouseleave', () => restoreDcChatWallpaper());
        });
        popover.querySelectorAll('[data-shape]').forEach(pill => {
            pill.addEventListener('click', (e) => {
                e.stopPropagation();
                applyDcChatBubbleShape(pill.dataset.shape);
            });
            pill.addEventListener('mouseenter', () => previewDcChatBubbleShape(pill.dataset.shape));
            pill.addEventListener('mouseleave', () => restoreDcChatBubbleShape());
        });
        popover.querySelectorAll('[data-fontsize]').forEach(pill => {
            pill.addEventListener('click', (e) => {
                e.stopPropagation();
                applyDcChatFontSize(pill.dataset.fontsize);
            });
            pill.addEventListener('mouseenter', () => previewDcChatFontSize(pill.dataset.fontsize));
            pill.addEventListener('mouseleave', () => restoreDcChatFontSize());
        });
        popover.querySelectorAll('[data-fontfamily]').forEach(pill => {
            pill.addEventListener('click', (e) => {
                e.stopPropagation();
                applyDcChatFontFamily(pill.dataset.fontfamily);
            });
            pill.addEventListener('mouseenter', () => previewDcChatFontFamily(pill.dataset.fontfamily));
            pill.addEventListener('mouseleave', () => restoreDcChatFontFamily());
        });
        popover.querySelector('[data-compact-toggle]')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const area = document.getElementById('dc-chat-area');
            const isOn = area && area.classList.contains('dc-compact-mode');
            applyDcChatCompactMode(!isOn);
        });

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            popover.style.display = popover.style.display === 'none' ? 'flex' : 'none';
        });
        document.addEventListener('click', (e) => {
            if (popover.style.display !== 'none' && !popover.contains(e.target) && e.target !== btn) {
                popover.style.display = 'none';
            }
        });

        updateDcThemePopoverActiveStates();
    }
    window.initDcChatTheme = initDcChatTheme; // social.js'in oda/DM açılış akışı için

