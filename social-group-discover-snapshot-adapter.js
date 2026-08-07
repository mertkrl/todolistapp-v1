// social-group-discover-snapshot-adapter.js
// social-group-discover.js'ten çıkarıldı: Supabase'den çekilen düz
// { [code]: groupData } map'ini eski Firebase snapshot arayüzüne
// (.forEach, .child(code).exists()/.val()) uyarlayan saf yardımcı —
// sadece kendi parametresine bağımlı, paylaşılan closure state'e dokunmuyor.
export function _buildSnapshotLike(groupsMap) {
    return {
        forEach(cb) {
            Object.entries(groupsMap).forEach(([key, val]) => cb({ key, val: () => val }));
        },
        child(code) {
            const exists = Object.prototype.hasOwnProperty.call(groupsMap, code);
            return { exists: () => exists, val: () => (exists ? groupsMap[code] : null) };
        }
    };
}
