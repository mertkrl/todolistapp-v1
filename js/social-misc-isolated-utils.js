// ─── SOSYAL MODÜL — DAĞINIK AMA BAĞIMSIZ KÜÇÜK YARDIMCILAR ─────────────────
// social.js dosyasından çıkarıldı (Faz O, social.js turu): birbirleriyle
// tematik ilgisi olmayan ama HEPSİ social.js'in paylaşılan durumuna
// (currentUser/cwXxx/sharedFocusXxx state'lerine) dokunmayan küçük
// fonksiyonlar. Tek ortak noktaları: sistematik bir tarama scripti
// (fonksiyon gövdesinde 118 durum değişkeninden hangilerinin geçtiğini
// kontrol eden) ile bulundular ve tek tek doğrulandı.

// Supabase'ten gelen ham "cw_rooms" satırını (+ üye listesini) uygulamanın
// beklediği normalize edilmiş oda nesnesine çevirir.
function _cwNormalizeSupaRoom(row, members) {
    if (!row) return null;
    const memberList = (members || []).map(m => ({
        userId: m.user_id,
        username: m.username,
        displayName: m.display_name,
        color: m.color,
        role: m.role,
        taskId: m.task_id || null,
        taskText: m.task_text || ''
    }));
    return {
        members: memberList,
        maxParticipants: row.max_participants || 2,
        active: row.active,
        startedAt: row.started_at ? new Date(row.started_at).getTime() : null,
        paused: !!row.paused,
        pausedAt: row.paused_at ? new Date(row.paused_at).getTime() : null,
        focusMinutes: row.focus_minutes || 25,
        breakMinutes: row.break_minutes || 5,
        rounds: row.rounds || 4,
        linkedHabitId: row.linked_habit_id || null,
        linkedHabitName: row.linked_habit_name || null,
        linkedPairId: row.linked_pair_id || null,
        endedBy: row.ended_by_name || null,
        endedByName: row.ended_by_name || null,
        restarting: !!row.restarting,
        restartedBy: row.restarted_by_id || null,
        restartedByName: row.restarted_by_name || null,
        settingsOpenToAll: !!row.settings_open_to_all,
        allowRequests: row.allow_requests !== false,
        _createdBy: row.created_by,
        _raw: row
    };
}

// Buddy-focus davet kurulum modalındaki süre/mola/tur önizleme metnini günceller.
function bfpUpdatePreview() {
    const dur    = parseInt(document.getElementById('bfp-duration')?.value) || 25;
    const brk    = parseInt(document.getElementById('bfp-break')?.value) || 10;
    const rounds = parseInt(document.getElementById('bfp-rounds')?.value) || 4;
    const total  = rounds * dur + rounds * brk;
    const h = Math.floor(total / 60), m = total % 60;
    const box = document.getElementById('bfp-preview-box');
    if (box) box.innerHTML = `📋 <b class="u-color-hfff">Özet:</b> ${rounds} × ${dur}dk odak + ${rounds} × ${brk}dk mola = <b class="si-green">~${h > 0 ? h + 'sa ' : ''}${m}dk</b>`;
}

// localStorage'da saklanan sosyal kullanıcı profilini okur (currentUser'ı
// DEĞİŞTİRMEZ — sadece okur, atama social.js'te kalıyor).
function getSavedUser() {
    try { return JSON.parse(localStorage.getItem('focusai_social_user'), window._safeJsonReviver); }
    catch { return null; }
}

function _isRateLimitError(error) {
    return !!(error && typeof error.message === 'string' && error.message.includes('rate_limit'));
}

// Dock'taki küçük "odadasın" göstergesini günceller/gizler.
function _syncGlobalRoomBar(roomName) {
    const icon = document.getElementById('dock-sosyal-icon');
    const nameEl = document.getElementById('dc-dock-room-name');
    if (!icon) return;
    if (nameEl) nameEl.textContent = roomName || '';
    icon.classList.add('in-room');
}
window._hideGlobalRoomBar = _hideGlobalRoomBar; // social-room-presence.js için
function _hideGlobalRoomBar() {
    document.getElementById('dock-sosyal-icon')?.classList.remove('in-room');
    document.getElementById('dc-dock-room-popup')?.classList.add('hidden');
}

// Aktivite akışı 071 migration ile kurulup 2026-07-05'te tekrar tamamen
// kaldırıldı (kullanıcı kararı — bkz. 072_drop_activity_feed_v2.sql). Kalan
// çağrı noktalarını tek tek sökmek yerine no-op bırakıldı — hiçbir görünür/
// kalıcı etkisi yok. (Faz O beşinci turda buraya taşındı.)
window.postActivity = postActivity; // social-gamification.js gibi ayrı script scope'larından erişim için
function postActivity() {}

// Faz O: gerçek export (social.js bu dosyadan SONRA yüklendiği için güvenli
// — bkz. inline-module-loader.js). window._hideGlobalRoomBar köprüsü KORUNDU:
// social-room-presence.js hâlâ window.* üzerinden çağırıyor.
export {
    _cwNormalizeSupaRoom, bfpUpdatePreview, getSavedUser, _isRateLimitError,
    _syncGlobalRoomBar, _hideGlobalRoomBar, postActivity
};
