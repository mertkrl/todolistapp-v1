// social-avatar-utils.js
// social.js'ten çıkarıldı (Faz E, 2026-07-23): avatar/renk/zaman UI
// yardımcıları — avatarSrc, _sanitizeHexColor, _resizeImageToBlob,
// resolveAvatar, avatarFallbackSrc, avatarImgHtml, groupAvatarHtml,
// timeAgo, formatFocusMinutes. Tamamen saf fonksiyonlar (parametre alıp
// değer/HTML string döndürür), paylaşılan mesaj/oda/odak state'ine hiç
// dokunmuyor — currentUser bağımlılığı yok.
//
// Dış bağımlılık: sadece window._escapeHtml (social.js'te tanımlı, zaten
// window köprülü).
(function () {
'use strict';

    // ──────────────────────────────────────────────────────
    // UI YARDIMCILARI
    // ──────────────────────────────────────────────────────
    function avatarSrc(name, color) {
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'U')}&background=${color || '6c5ce7'}&color=fff&length=2`;
    }
    window.avatarSrc = avatarSrc;

    // "Profili Düzenle" ekranındaki renk seçici düz hex yerine
    // "linear-gradient(135deg,#6c5ce7,#a29bfe)" gibi bir CSS gradient string'i
    // avatar_color olarak kaydedebiliyor. Böyle bozuk bir değer ui-avatars.com'a
    // ham haliyle gönderilirse (ör. background=linear-gradient(...)) servis siyah
    // bir görsele düşüyor. Burada gradient/geçersiz string'lerden ilk geçerli hex
    // rengi çıkarıyoruz; hiçbiri yoksa varsayılana dönüyoruz.
    function _sanitizeHexColor(value) {
        if (!value) return '6c5ce7';
        const str = String(value);
        // Önce "#" ile başlayan geçerli uzunlukta (3/4/6/8) bir hex renk ara —
        // gradient string'lerinde "135deg" gibi ifadeler de hex karakterlerden
        // oluştuğu için "#" öneki olmadan arama yanlış eşleşmeye yol açıyordu.
        const hashMatch = str.match(/#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/);
        if (hashMatch) return hashMatch[1];
        // "#" yoksa, string'in tamamı geçerli bir hex renkse onu kullan
        if (/^([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})$/.test(str)) return str;
        return '6c5ce7';
    }
    window._sanitizeHexColor = _sanitizeHexColor;

    // Seçilen avatar dosyasını canvas ile en uzun kenarı maxDim'e indirip
    // JPEG Blob'a çevirir — Storage'a küçük, sabit boyutlu bir dosya yüklensin
    // diye (bkz. 121_avatar_storage_bucket.sql, setup-avatar-file-input handler).
    function _resizeImageToBlob(file, maxDim = 256, quality = 0.82) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
                const w = Math.max(1, Math.round(img.width * scale));
                const h = Math.max(1, Math.round(img.height * scale));
                const canvas = document.createElement('canvas');
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                URL.revokeObjectURL(img.src);
                canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('toBlob başarısız')), 'image/jpeg', quality);
            };
            img.onerror = reject;
            img.src = URL.createObjectURL(file);
        });
    }
    window._resizeImageToBlob = _resizeImageToBlob;

    // Bir kullanıcı verisinden (DB snapshot veya currentUser) görsel URL'sini ve
    // dış çember (ring) rengini tutarlı biçimde çözer. customAvatar varsa onu,
    // yoksa avatarColor ile üretilen otomatik avatarı kullanır.
    function resolveAvatar(u) {
        if (!u) return { url: avatarSrc('U', '6c5ce7'), color: '6c5ce7' };
        const color = _sanitizeHexColor(u.avatarColor);
        const url = u.customAvatar || avatarSrc(u.avatarInitials || u.displayName || u.username, color);
        return { url, color };
    }
    window.resolveAvatar = resolveAvatar;

    // Ağ üzerinden (ui-avatars.com) gelen avatar yüklenemezse (engellenme, zaman aşımı, vs.)
    // tarayıcı bazen rengi/baş harfi göstermek yerine simsiyah bir daire bırakıyor — bu yüzden
    // tamamen yerel, ağ gerektirmeyen bir SVG data-URI'ye düşüyoruz. Bu hep çalışır.
    function avatarFallbackSrc(name, color) {
        const initials = (name || 'U').trim().slice(0, 2).toUpperCase() || 'U';
        const safeColor = /^[0-9a-fA-F]{3,8}$/.test(color) ? color : '6c5ce7';
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#${safeColor}"/><text x="32" y="33" font-size="${initials.length > 1 ? 22 : 30}" fill="#fff" text-anchor="middle" dominant-baseline="central" font-family="Arial, sans-serif">${initials}</text></svg>`;
        return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
    }
    window.avatarFallbackSrc = avatarFallbackSrc;

    // <img> etiketini, avatarColor'a göre renklenen dış çemberle birlikte üretir.
    function avatarImgHtml(u, size, extraStyle, extraAttrs) {
        const { url, color } = resolveAvatar(u);
        const px = size || 36;
        const name = (u && (u.avatarInitials || u.displayName || u.username)) || 'U';
        const fallback = avatarFallbackSrc(name, color);
        // onerror: resim yüklenemezse (ör. ui-avatars.com'a erişilemiyorsa) simsiyah bir daire
        // yerine yerelde üretilen renkli/baş harfli bir avatara düşer.
        // url, profiles.custom_avatar'dan geliyor — UI'da yalnızca Storage upload'ıyla
        // set edilse de, RLS bu alanın İÇERİĞİNİ kısıtlamıyor; bir istemci Supabase'i
        // doğrudan çağırıp buraya keyfi metin yazabilir. Attribute context'te " karakteri
        // attribute'tan kaçışa (ve onload= gibi handler enjeksiyonuna) izin vereceğinden escape ediyoruz.
        return `<img src="${window._escapeHtml(url)}" onerror="this.onerror=null;this.src='${window._escapeHtml(fallback)}';" ${extraAttrs || ''} style="width:${px}px; height:${px}px; border-radius:50%; object-fit:cover; border:2px solid #${color}; background:#${color}; box-sizing:border-box; ${extraStyle || ''}" alt="">`;
    }
    window.avatarImgHtml = avatarImgHtml; // social-roles.js gibi ayrı script scope'larından erişim için

    // Grup kodundan deterministik bir renk seçip, grup adının baş harfiyle
    // küçük bir "rozet" üretir — gruplar listesinde hızlı görsel tanıma sağlar.
    const GROUP_AVATAR_COLORS = ['6c5ce7', '0984e3', '00b894', 'e17055', 'fd79a8', 'fdcb6e', '00cec9', 'e84393', '20bf6b', '54a0ff'];
    window.groupAvatarHtml = (code, name, size) => groupAvatarHtml(code, name, size); // Faz 5: social-group-details.js için
    function groupAvatarHtml(code, name, size) {
        const px = size || 42;
        let hash = 0;
        const str = code || name || '?';
        for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
        const color = GROUP_AVATAR_COLORS[hash % GROUP_AVATAR_COLORS.length];
        const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
        return `<div class="group-avatar" style="width:${px}px; height:${px}px; min-width:${px}px; font-size:${Math.round(px * 0.42)}px; background: linear-gradient(135deg, #${color}, #${color}99);">${window._escapeHtml(initial)}</div>`;
    }

    function timeAgo(ts) {
        const d = Date.now() - ts;
        const m = Math.floor(d / 60000);
        if (m < 1) return 'Az önce';
        if (m < 60) return `${m} dk önce`;
        const h = Math.floor(m / 60);
        if (h < 24) return `${h} sa önce`;
        return `${Math.floor(h / 24)} gün önce`;
    }
    window.timeAgo = timeAgo; // social-dm-notifications.js gibi ayrı script scope'larından erişim için

    // Odaklanma dakikalarını "1s 40dk" gibi okunabilir bir biçime çevirir.
    function formatFocusMinutes(min) {
        const total = Math.max(0, Math.floor(min || 0));
        if (total < 60) return `${total} dk`;
        const h = Math.floor(total / 60);
        const m = total % 60;
        return m === 0 ? `${h} sa` : `${h} sa ${m} dk`;
    }
    window.formatFocusMinutes = formatFocusMinutes;

    // Hex rengi "r,g,b" formatına çevirir (rgba() CSS için) — social.js'ten
    // taşındı (Faz E, 2026-07-23).
    function hexToRgb(hex) {
        const r = parseInt(hex.slice(1,3),16);
        const g = parseInt(hex.slice(3,5),16);
        const b = parseInt(hex.slice(5,7),16);
        return `${r},${g},${b}`;
    }
    window.hexToRgb = hexToRgb;

})();

// Diğer social-*.js modüllerinin import edebilmesi için ince sarmalayıcı export.
export const avatarImgHtml = window.avatarImgHtml;
