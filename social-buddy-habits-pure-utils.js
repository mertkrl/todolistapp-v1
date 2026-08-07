// social-buddy-habits.js'ten çıkarıldı: hiçbir paylaşılan mutable state'e
// dokunmayan iki saf yardımcı fonksiyon (gün anahtarı üretimi + çift kullanıcı
// eşleştirme id'si).

// habits.history ile aynı formatta gün anahtarı üretir (DD-MM-YYYY)
export function buddyDayKey(date) {
    const d = date || new Date();
    return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}

export function buddyPairId(userA, userB) {
    return [userA, userB].sort().join('__');
}
window.buddyPairId = buddyPairId;
