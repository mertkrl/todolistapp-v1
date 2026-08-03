// Merkezi currentUser deposu — Faz S adım 1.
// Tek yazar: social.js. Okuyucular (41 dosya) hâlâ window.currentUser üzerinden
// okuyabilir; bu modül sadece YAZMA yolunu tek bir fonksiyonda topluyor ki
// gelecekte state değişikliklerine tepki vermek (subscribe) istendiğinde
// tüm okuyucuları tek tek değiştirmeye gerek kalmasın.
const listeners = new Set();

export function getCurrentUser() {
    return window.currentUser || null;
}

export function setCurrentUser(user) {
    window.currentUser = user;
    listeners.forEach(fn => fn(user));
    return user;
}

export function onCurrentUserChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

window.getCurrentUser = getCurrentUser;
