// social-dc-chat-theme-constants.js
// social-dc-chat-theme.js dosyasından çıkarıldı: sohbet teması sabit
// tabloları (renk/duvar kağıdı/balon şekli/yazı boyutu/tipi) + saf
// hex→rgba yardımcı fonksiyonu. Hiçbir dış bağımlılığı yok.

export const DC_CHAT_THEMES = {
    purple:    { label: 'Mor',      accent: '#a29bfe', bubbleMe: 'rgba(108,92,231,0.35)', bubbleMeBorder: 'rgba(108,92,231,0.3)' },
    blue:      { label: 'Mavi',     accent: '#74b9ff', bubbleMe: 'rgba(52,152,219,0.35)',  bubbleMeBorder: 'rgba(52,152,219,0.3)' },
    green:     { label: 'Yeşil',    accent: '#55efc4', bubbleMe: 'rgba(46,213,115,0.30)',  bubbleMeBorder: 'rgba(46,213,115,0.3)' },
    pink:      { label: 'Pembe',    accent: '#ff9ff3', bubbleMe: 'rgba(255,71,158,0.30)',  bubbleMeBorder: 'rgba(255,71,158,0.3)' },
    orange:    { label: 'Turuncu',  accent: '#ffb86c', bubbleMe: 'rgba(255,159,67,0.32)',  bubbleMeBorder: 'rgba(255,159,67,0.3)' },
    red:       { label: 'Kırmızı',  accent: '#ff7675', bubbleMe: 'rgba(255,118,117,0.30)', bubbleMeBorder: 'rgba(255,118,117,0.3)' },
    yellow:    { label: 'Sarı',     accent: '#feca57', bubbleMe: 'rgba(254,202,87,0.28)',  bubbleMeBorder: 'rgba(254,202,87,0.3)' },
    turquoise: { label: 'Turkuaz',  accent: '#00d2d3', bubbleMe: 'rgba(0,210,211,0.28)',   bubbleMeBorder: 'rgba(0,210,211,0.3)' },
    gray:      { label: 'Gri',      accent: '#b2bec3', bubbleMe: 'rgba(178,190,195,0.25)', bubbleMeBorder: 'rgba(178,190,195,0.3)' },
};
export const DC_CHAT_THEME_KEY = 'focusai_chat_theme';
export const DC_CHAT_CUSTOM_COLOR_KEY = 'focusai_chat_custom_color';

export const DC_CHAT_WALLPAPERS = {
    none:     { label: 'Yok' },
    stars:    { label: 'Yıldızlı Gece' },
    aurora:   { label: 'Aurora' },
    dots:     { label: 'Noktalı' },
    waves:    { label: 'Dalga' },
};
export const DC_CHAT_WALLPAPER_KEY = 'focusai_chat_wallpaper';

export const DC_CHAT_FONT_SIZES = {
    small:  { label: 'Küçük', value: '12px' },
    medium: { label: 'Orta',  value: '13px' },
    large:  { label: 'Büyük', value: '15px' },
};
export const DC_CHAT_FONT_SIZE_KEY = 'focusai_chat_font_size';

export const DC_CHAT_FONT_FAMILIES = {
    default: { label: 'Varsayılan', value: 'inherit' },
    rounded: { label: 'Yuvarlak',   value: "'Quicksand','Poppins',sans-serif" },
    mono:    { label: 'Mono',       value: "'Fira Code','Courier New',monospace" },
};
export const DC_CHAT_FONT_FAMILY_KEY = 'focusai_chat_font_family';

export const DC_CHAT_BUBBLE_SHAPES = {
    rounded: { label: 'Yuvarlak', meRadius: '12px 4px 12px 12px', otherRadius: '4px 12px 12px 12px' },
    square:  { label: 'Köşeli',   meRadius: '4px 4px 4px 4px',    otherRadius: '4px 4px 4px 4px' },
};
export const DC_CHAT_BUBBLE_SHAPE_KEY = 'focusai_chat_bubble_shape';
export const DC_CHAT_COMPACT_KEY = 'focusai_chat_compact_mode';

export function dcHexToRgba(hex, alpha) {
    let h = (hex || '#a29bfe').replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const r = parseInt(h.slice(0, 2), 16) || 0;
    const g = parseInt(h.slice(2, 4), 16) || 0;
    const b = parseInt(h.slice(4, 6), 16) || 0;
    return `rgba(${r},${g},${b},${alpha})`;
}
