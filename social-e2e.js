// social-e2e.js — social.js'ten ayrıldı (Faz 2 modülerleştirme).
// ─── UÇTAN UCA ŞİFRELEME (E2E) — Sadece özel mesajlar (DM) ──────
// ECDH (P-256) ile her iki kullanıcı için ortak bir AES-GCM anahtarı türetilir.
// Özel anahtar yalnızca bu cihazda (localStorage) tutulur; bu yüzden mesajlar
// sadece anahtarın oluşturulduğu cihazda çözülebilir.
// NOT: getUser/getDB/currentUser social.js'te tanımlı — window.getUser/
// window.getDB/window.currentUser köprüsü üzerinden erişiliyor (social.js'in
// kendisi de bu köprüleri zaten her yerde tutarlı tutuyor).
(function () {
'use strict';

const E2E_PRIVKEY_STORAGE_PREFIX = 'focusai_e2e_privkey_';
let _e2eKeyPair = null;
let _e2ePublicKeyCache = {};  // username -> CryptoKey | null
let _e2eSharedKeyCache = {};  // username -> CryptoKey

function isE2ESupported() {
    return !!(window.crypto && window.crypto.subtle);
}

function _e2eAbToB64(buf) {
    return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function _e2eB64ToAb(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
}

// Özel anahtar (private key) artık düz metin olarak localStorage'da değil,
// tarayıcının IndexedDB'sinde "çıkarılamaz" (non-extractable) bir CryptoKey
// olarak tutulur. Sayfaya sızan bir XSS bile bu anahtarın ham değerini
// okuyup dışarı taşıyamaz — sadece tarayıcının kendi kripto motoru
// (deriveKey/deriveBits) üzerinden "kilitle/aç" işlemi yapılabilir.
const E2E_IDB_NAME = 'focusai_e2e_vault';
const E2E_IDB_STORE = 'keypairs';

function _e2eIdbOpen() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(E2E_IDB_NAME, 1);
        req.onupgradeneeded = () => {
            if (!req.result.objectStoreNames.contains(E2E_IDB_STORE)) {
                req.result.createObjectStore(E2E_IDB_STORE);
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}
async function _e2eIdbGetPair(username) {
    const db = await _e2eIdbOpen();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(E2E_IDB_STORE, 'readonly');
        const req = tx.objectStore(E2E_IDB_STORE).get(username);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
    });
}
async function _e2eIdbPutPair(username, pair) {
    const db = await _e2eIdbOpen();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(E2E_IDB_STORE, 'readwrite');
        tx.objectStore(E2E_IDB_STORE).put(pair, username);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

async function getOrCreateE2EKeyPair() {
    if (_e2eKeyPair) return _e2eKeyPair;
    if (!isE2ESupported()) return null;
    const user = window.getUser();
    if (!user) return null;
    const database = window.getDB();
    const legacyStorageKey = E2E_PRIVKEY_STORAGE_PREFIX + user.username;
    try {
        let pair, jwkPublic;
        const idbPair = await _e2eIdbGetPair(user.username).catch(() => null);
        const legacyStored = localStorage.getItem(legacyStorageKey);

        if (idbPair && idbPair.privateKey && idbPair.publicKey) {
            // Kasada zaten anahtar var — doğrudan kullan.
            pair = idbPair;
            jwkPublic = await crypto.subtle.exportKey('jwk', pair.publicKey);
        } else if (legacyStored) {
            // Eski (düz metin) anahtardan geçiş: aynı anahtar materyalini
            // "çıkarılamaz" olarak yeniden içe aktarıp kasaya taşıyoruz,
            // böylece geçmiş mesajlar hâlâ çözülebilir.
            const jwk = JSON.parse(legacyStored);
            const privateKey = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey', 'deriveBits']);
            const pubJwk = Object.assign({}, jwk);
            delete pubJwk.d;
            delete pubJwk.key_ops;
            const publicKey = await crypto.subtle.importKey('jwk', pubJwk, { name: 'ECDH', namedCurve: 'P-256' }, true, []);
            pair = { privateKey, publicKey };
            jwkPublic = pubJwk;
            await _e2eIdbPutPair(user.username, pair);
            localStorage.removeItem(legacyStorageKey);
        } else {
            // extractable=false → oluşan private key hiçbir zaman export edilemez;
            // public key WebCrypto spesifikasyonu gereği her zaman extractable kalır.
            pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey', 'deriveBits']);
            jwkPublic = await crypto.subtle.exportKey('jwk', pair.publicKey);
            await _e2eIdbPutPair(user.username, pair);
        }
        _e2eKeyPair = { privateKey: pair.privateKey, publicKey: pair.publicKey, jwkPublic };
        // Her zaman güncel public key'i Supabase'e yaz.
        // Hard reset sonrası localStorage'da yeni private key oluşturulur;
        // eski Supabase kaydı kalırsa ECDH shared key uyuşmazlığı olur.
        if (window.FocusSupabase && window.currentUser?.id) {
            window.FocusSupabase.from('profiles')
                .update({ e2e_public_key: jwkPublic })
                .eq('id', window.currentUser.id)
                .then(({ error }) => {
                    if (error) console.warn('[E2E] public key Supabase\'e yazılamadı:', error.message);
                });
            // Shared key cache'ini temizle — stale key ile türetilen cache geçersiz
            _e2eSharedKeyCache = {};
            _e2ePublicKeyCache  = {};
        }
        // Firebase fallback — Firebase aktifse
        if (database) {
            database.ref(`focusai_community/users/${user.username}/e2ePublicKey`).once('value').then(snap => {
                if (!snap.exists()) database.ref(`focusai_community/users/${user.username}/e2ePublicKey`).set(jwkPublic);
            });
        }
    } catch (e) {
        console.warn('E2E anahtar çifti oluşturulamadı:', e);
        _e2eKeyPair = null;
    }
    return _e2eKeyPair;
}

async function getOtherE2EPublicKey(username) {
    if (Object.prototype.hasOwnProperty.call(_e2ePublicKeyCache, username)) return _e2ePublicKeyCache[username];
    const importJwk = async (jwk, source) => {
        if (!jwk) return null;
        try {
            const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, true, []);
            _e2ePublicKeyCache[username] = key;
            return key;
        } catch (e) {
            console.warn(`[E2E] ${username} key import HATA (${source}):`, e.message, jwk);
            return null;
        }
    };
    // Supabase profiles'dan dene (birincil)
    if (window.FocusSupabase) {
        try {
            const { data, error } = await window.FocusSupabase.from('profiles').select('e2e_public_key').eq('username', username).maybeSingle();
            if (data?.e2e_public_key) return importJwk(data.e2e_public_key, 'supabase');
        } catch (e) { console.warn('[E2E] Supabase sorgu hatası:', e.message); }
    }
    _e2ePublicKeyCache[username] = null;
    return null;
}

async function getDmSharedKey(otherUsername) {
    if (_e2eSharedKeyCache[otherUsername]) return _e2eSharedKeyCache[otherUsername];
    if (!isE2ESupported()) return null;
    const myPair = await getOrCreateE2EKeyPair();
    if (!myPair) return null;
    const otherPub = await getOtherE2EPublicKey(otherUsername);
    if (!otherPub) return null;
    try {
        const sharedKey = await crypto.subtle.deriveKey(
            { name: 'ECDH', public: otherPub },
            myPair.privateKey,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
        _e2eSharedKeyCache[otherUsername] = sharedKey;
        return sharedKey;
    } catch (e) {
        return null;
    }
}

// E2E destekleniyorsa ve karşı tarafın genel anahtarı varsa {iv, ct}, yoksa null döner
async function encryptDmText(otherUsername, text) {
    const key = await getDmSharedKey(otherUsername);
    if (!key) return null;
    try {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const enc = new TextEncoder().encode(text);
        const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc);
        return { iv: _e2eAbToB64(iv), ct: _e2eAbToB64(ct) };
    } catch (e) {
        return null;
    }
}

// Çözülemezse null döner (örn. anahtar başka bir cihazda oluşturulduysa)
async function decryptDmText(otherUsername, payload) {
    if (!payload || !payload.iv || !payload.ct) return null;
    const key = await getDmSharedKey(otherUsername);
    if (!key) return null;
    try {
        const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: _e2eB64ToAb(payload.iv) }, key, _e2eB64ToAb(payload.ct));
        return new TextDecoder().decode(pt);
    } catch (e) {
        return null;
    }
}
// social.js'in kendisi (ve social-message-pins.js gibi kardeş modülleri)
// bu fonksiyonu kendi scope'unda bulamadığı için "decryptDmText is not defined"
// ReferenceError'ı atıyordu — global olarak da erişilebilir kılıyoruz.
window.decryptDmText = decryptDmText;

})();
