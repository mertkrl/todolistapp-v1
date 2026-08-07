// collab.js dosyasından çıkarıldı — PlanningCollab nesnesinin `this` durumuna
// bağlı olmayan, saf/izole yardımcı fonksiyonlar (esc/id üretimi/zaman biçimi/
// localStorage yardımcıları/auth kullanıcı çözümleme).
export function esc(s) {
    if (typeof window.escapeHtml === 'function') return window.escapeHtml(s);
    return String(s)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

export function shortId(len = 8) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let id = '';
    for (let i = 0; i < len; i++) id += chars[Math.floor(Math.random() * chars.length)];
    return id;
}

export function genId() { return 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2,6); }

export function timeAgo(ts) {
    const diff = (Date.now() - new Date(ts).getTime()) / 1000;
    if (diff < 60)  return 'az önce';
    if (diff < 3600) return Math.floor(diff/60) + 'dk önce';
    if (diff < 86400) return Math.floor(diff/3600) + 'sa önce';
    return Math.floor(diff/86400) + 'g önce';
}

export function parseMentions(text) {
    return text.replace(/@(\w+)/g, '<span class="pg-mention">@$1</span>');
}

export function toast(msg, color) {
    let el = document.getElementById('pg-toast');
    if (!el) { el = document.createElement('div'); el.id = 'pg-toast'; el.className = 'pg-toast'; document.body.appendChild(el); }
    el.textContent = msg;
    el.style.borderColor = color || '';
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.classList.remove('show'); el.style.borderColor=''; }, 3000);
}

export async function getAuthUser() {
    try { if (!window.FocusSupabase) return null; const { data } = await window.FocusSupabase.auth.getUser(); return data?.user||null; }
    catch (_) { return null; }
}

export function getUserDisplayName(u) {
    if (!u) return 'Anonim';
    return u.user_metadata?.display_name || u.user_metadata?.username || u.email?.split('@')[0] || 'Kullanıcı';
}

export function stringToColor(s) {
    const c = ['#7c6eff','#ef476f','#06d6a0','#ffd166','#ff9f43','#a78bfa','#60a5fa','#f97316'];
    let h = 0; for (let i=0;i<s.length;i++) h=s.charCodeAt(i)+((h<<5)-h);
    return c[Math.abs(h)%c.length];
}

export function lsGet(key, def) { try { return JSON.parse(localStorage.getItem(key) ?? 'null', window._safeJsonReviver) ?? def; } catch(_){ return def; } }
export function lsSet(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
