// script-mind-dump.js dosyasından çıkarıldı — etiket meta verisi/renk paleti
// ve özel etiket okuma/yazma yardımcıları. Modül-seviyesi state yok, sadece
// sabit veri + FocusStorage (global) okuma/yazma.

// Sabit etiket renk paleti (özel etiketler de bu renklerden döngüsel olarak alır)
export const DUMP_CUSTOM_TAG_COLORS = [
    { color: '#00cec9', bg: 'rgba(0,206,201,0.12)',   border: 'rgba(0,206,201,0.25)'   },
    { color: '#fd79a8', bg: 'rgba(253,121,168,0.12)', border: 'rgba(253,121,168,0.25)' },
    { color: '#55efc4', bg: 'rgba(85,239,196,0.12)',  border: 'rgba(85,239,196,0.25)'  },
    { color: '#ffeaa7', bg: 'rgba(255,234,167,0.12)', border: 'rgba(255,234,167,0.25)' },
    { color: '#b2bec3', bg: 'rgba(178,190,195,0.12)', border: 'rgba(178,190,195,0.25)' },
];
export const DUMP_CUSTOM_TAG_MAX = 5;

export const DUMP_PRESET_TAGS = {
    'ana-hedef':  { label: '🎯 Ana Hedef',  color: '#a29bfe', bg: 'rgba(162,155,254,0.12)', border: 'rgba(162,155,254,0.25)' },
    'aliskanlik': { label: '🔥 Alışkanlık', color: '#fd79a8', bg: 'rgba(253,121,168,0.12)', border: 'rgba(253,121,168,0.25)' },
    'fikir':      { label: '💡 Fikir',       color: '#fdcb6e', bg: 'rgba(253,203,110,0.12)', border: 'rgba(253,203,110,0.25)' },
    'diger':      { label: '📦 Diğer',       color: 'rgba(255,255,255,0.45)', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.1)' },
    // Geriye dönük uyum (eski kayıtlar)
    'endise':       { label: '😟 Endişe',      color: '#e17055', bg: 'rgba(225,112,85,0.12)',  border: 'rgba(225,112,85,0.25)'  },
    'hatirlatici':  { label: '📌 Hatırlatıcı', color: '#a29bfe', bg: 'rgba(162,155,254,0.12)', border: 'rgba(162,155,254,0.25)' },
    'soru':         { label: '❓ Soru',         color: '#74b9ff', bg: 'rgba(116,185,255,0.12)', border: 'rgba(116,185,255,0.25)' },
};

export function getDumpCustomTags() {
    return FocusStorage.get('dump_custom_tags', []);
}
export function saveDumpCustomTags(tags) {
    FocusStorage.set('dump_custom_tags', tags);
}

// Tüm tag meta (preset + özel) birleştirir
export function getDumpTagMeta() {
    const custom = getDumpCustomTags();
    const meta = { ...DUMP_PRESET_TAGS };
    custom.forEach((t, i) => {
        const c = DUMP_CUSTOM_TAG_COLORS[i % DUMP_CUSTOM_TAG_COLORS.length];
        meta[t.id] = { label: t.label, ...c };
    });
    return meta;
}
