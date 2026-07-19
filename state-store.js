// Çekirdek state için tek okuma/yazma/kaydetme noktası (tasks/goals/habits/events/mind_dumps).
// FocusStorage'ı sarmalar: set() her zaman localStorage'a otomatik kaydeder, unutma riski kalmaz.
// subscribe() altyapısı ileride reaktif render için hazır — bu fazda henüz kullanılmıyor.
const Store = (() => {
    const KEYS = {
        tasks: [],
        goals: [],
        habits: [],
        events: {},
        mind_dumps: [],
    };

    const listeners = {};
    Object.keys(KEYS).forEach(k => { listeners[k] = []; });

    function makeSlice(key, fallback) {
        return {
            get() {
                return FocusStorage.get(key, fallback);
            },
            set(value) {
                FocusStorage.set(key, value);
                listeners[key].forEach(fn => {
                    try { fn(value); } catch (e) { console.error(`[Store] "${key}" listener hatası:`, e); }
                });
                return value;
            },
            subscribe(fn) {
                listeners[key].push(fn);
                return () => {
                    const i = listeners[key].indexOf(fn);
                    if (i !== -1) listeners[key].splice(i, 1);
                };
            },
        };
    }

    const store = {};
    Object.keys(KEYS).forEach(key => {
        store[key] = makeSlice(key, KEYS[key]);
    });
    return store;
})();

window.Store = Store;
