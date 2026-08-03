// XSS koruması — kullanıcı metnini innerHTML'e basmadan önce escape et (tüm modüllerde ortak)
window.escapeHtml = function escapeHtml(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

// JSON.parse reviver — localStorage/import edilen dosyalardaki `__proto__`/
// `constructor`/`prototype` anahtarlarını (prototype pollution girişimi) atar.
// Object.assign/spread ile merge edilen verilerde bu anahtarlar Object.prototype'ı
// kirletebilirdi; savunma amaçlı, gerçekçi saldırı zaten XSS gerektirir ama ucuz.
function _safeJsonReviver(key, value) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') return undefined;
    return value;
}
window._safeJsonReviver = _safeJsonReviver;

const FocusStorage = (() => {
    const PREFIX = 'focusai_';


    function get(key, fallback = null) {
        try {
            const raw = localStorage.getItem(PREFIX + key);
            if (raw === null || raw === undefined) return fallback;
            return JSON.parse(raw, _safeJsonReviver);
        } catch (e) {
            console.warn(`[FocusStorage] Okuma hatası → "${key}":`, e.message);
            return fallback;
        }
    }


    function set(key, value) {
        try {
            localStorage.setItem(PREFIX + key, JSON.stringify(value));
            _updateStorageBar();
            if (window.FocusSync) window.FocusSync.pushKey(key, value);
            return true;
        } catch (e) {
            if (_isQuotaError(e)) {
                _showQuotaBanner();
            } else {
                console.error(`[FocusStorage] Yazma hatası → "${key}":`, e.message);
            }
            return false;
        }
    }


    function setRaw(key, value) {
        try {
            localStorage.setItem(PREFIX + key, value);
            return true;
        } catch (e) {
            if (_isQuotaError(e)) _showQuotaBanner();
            return false;
        }
    }


    function getRaw(key, fallback = null) {
        try {
            const val = localStorage.getItem(PREFIX + key);
            return val !== null ? val : fallback;
        } catch (e) {
            return fallback;
        }
    }


    function remove(key) {
        try {
            localStorage.removeItem(PREFIX + key);
            _updateStorageBar();
            return true;
        } catch (e) {
            console.error(`[FocusStorage] Silme hatası → "${key}":`, e.message);
            return false;
        }
    }

    function _isQuotaError(e) {
        return e.name === 'QuotaExceededError'
            || e.name === 'NS_ERROR_DOM_QUOTA_REACHED'
            || e.code === 22;
    }

    function _getUsedBytes() {
        let total = 0;
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                const v = localStorage.getItem(k) || '';
                total += (k.length + v.length) * 2; // UTF-16: 2 byte/char
            }
        } catch (_) { console.warn('[FocusAI] sessiz hata:', _); }
        return total;
    }

    function getUsageKB()      { return Math.round(_getUsedBytes() / 1024); }
    function getUsagePercent() { return Math.min(100, Math.round((_getUsedBytes() / (5 * 1024 * 1024)) * 100)); }

    function _updateStorageBar() {
        const pct   = getUsagePercent();
        const kb    = getUsageKB();
        const fill  = document.getElementById('storage-fill');
        const label = document.getElementById('storage-label');
        if (fill)  {
            fill.style.width = pct + '%';
            fill.style.background = pct >= 80 ? '#ff4757' : pct >= 60 ? '#ff9f43' : '#2ed573';
        }
        if (label) label.textContent = `${kb} KB / 5 MB`;
    }

    function _showQuotaBanner() {
        if (document.getElementById('focusai-quota-banner')) return;
        const banner = document.createElement('div');
        banner.id = 'focusai-quota-banner';
        banner.innerHTML = `
            <i class="fa-solid fa-triangle-exclamation u-color-hfff" ></i>
            <span>Depolama alanı doldu! Yeni veriler kaydedilemiyor.</span>
            <button class="focusai-quota-banner-export u-margin-left-10px_padding-4px14px_border-radius-8px_border-"
 >
                Şimdi Yedekle
            </button>
            <button class="focusai-quota-banner-dismiss u-margin-left-6px_padding-4px10px_border-none_background-tra"
 >
                ×
            </button>
        `;
        Object.assign(banner.style, {
            position:   'fixed', top: '0', left: '0', right: '0', zIndex: '999999',
            background: 'linear-gradient(90deg,#c0392b,#e74c3c)',
            color:      '#fff', padding: '10px 20px',
            display:    'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            fontSize:   '13px', fontFamily: 'Poppins,sans-serif',
            boxShadow:  '0 3px 15px rgba(0,0,0,0.4)',
        });
        banner.querySelector('.focusai-quota-banner-export').addEventListener('click', () => DataManager.exportData());
        banner.querySelector('.focusai-quota-banner-dismiss').addEventListener('click', function() { this.parentElement.remove(); });
        document.body.prepend(banner);
    }


    function checkOnInit() {
        const pct = getUsagePercent();
        _updateStorageBar();
        if (pct >= 80) {
            setTimeout(() => {
                if (!document.getElementById('focusai-quota-banner')) {
                    const banner = document.createElement('div');
                    banner.id = 'focusai-quota-banner';
                    banner.innerHTML = `
                        <i class="fa-solid fa-hard-drive u-color-hfff" ></i>
                        <span>Depolama %${pct} dolu. Veri kaybını önlemek için yedek al.</span>
                        <button class="focusai-quota-banner-export u-margin-left-10px_padding-4px14px_border-radius-8px_border-"
 >
                            Yedekle
                        </button>
                        <button class="focusai-quota-banner-dismiss u-margin-left-6px_padding-4px10px_border-none_background-tra"
 >
                            ×
                        </button>
                    `;
                    Object.assign(banner.style, {
                        position:   'fixed', top: '0', left: '0', right: '0', zIndex: '999999',
                        background: 'linear-gradient(90deg,#e17055,#d63031)',
                        color:      '#fff', padding: '10px 20px',
                        display:    'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        fontSize:   '13px', fontFamily: 'Poppins,sans-serif',
                        boxShadow:  '0 3px 15px rgba(0,0,0,0.4)',
                    });
                    banner.querySelector('.focusai-quota-banner-export').addEventListener('click', () => DataManager.exportData());
                    banner.querySelector('.focusai-quota-banner-dismiss').addEventListener('click', function() { this.parentElement.remove(); });
                    document.body.prepend(banner);
                }
            }, 2000);
        }
    }

    return { get, set, getRaw, setRaw, remove, getUsageKB, getUsagePercent, checkOnInit };
})();
window.FocusStorage = FocusStorage;

const DataManager = (() => {

    const SCHEMA_VERSION = '1.2';


    function collectAllData() {
        return {
            tasks:                   FocusStorage.get('tasks', []),
            events:                  FocusStorage.get('events', {}),
            goals:                   FocusStorage.get('goals', []),
            habits:                  FocusStorage.get('habits', []),
            habit_categories:        FocusStorage.get('habit_categories', []),
            focus_minutes:           FocusStorage.get('focus_minutes', 0),
            focus_history:           FocusStorage.get('focus_history', {}),
            category_focus:          FocusStorage.get('category_focus', {}),
            focus_hours:             FocusStorage.get('focus_hours', {}),
            highlight_history:       FocusStorage.get('highlight_history', {}),
            focusai_journal_entries: FocusStorage.get('focusai_journal_entries', []),
            mind_dumps:              FocusStorage.get('mind_dumps', []),
            mind_dump_conversions:   FocusStorage.get('mind_dump_conversions', []),
            timer_settings:          FocusStorage.get('timer_settings', { pomodoro: 25, shortBreak: 5, longBreak: 15 }),
            app_theme:               FocusStorage.get('app_theme', 'dark'),
            tour_completed:          FocusStorage.get('tour_completed', false),
            weekly_planned:          FocusStorage.getRaw('weekly_planned', null),
        };
    }


    function exportData() {
        try {
            const snapshot = {
                _schema:     SCHEMA_VERSION,
                _exportDate: new Date().toISOString(),
                _appName:    'FocusAI',
                ...collectAllData(),
            };

            const json = JSON.stringify(snapshot, null, 2);
            const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href     = url;
            a.download = `focusai-yedek-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            _showToast('Veriler başarıyla indirildi ✓', 'success');
            return true;
        } catch (e) {
            console.error('[DataManager] Export hatası:', e);
            _showToast('Dışa aktarma başarısız: ' + e.message, 'error');
            return false;
        }
    }


    function _ddmmyyyyToIso(s) {
        const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s);
        return m ? `${m[3]}-${m[2]}-${m[1]}` : s;
    }


    function importData(file) {
        return new Promise((resolve, reject) => {
            if (!file) { reject(new Error('Dosya seçilmedi.')); return; }
            if (!file.name.toLowerCase().endsWith('.json')) {
                reject(new Error('Lütfen .json uzantılı bir dosya seçin.')); return;
            }

            const reader = new FileReader();
            reader.onerror = () => reject(new Error('Dosya okunamadı.'));

            reader.onload = (e) => {
                try {
                    const parsed = JSON.parse(e.target.result, _safeJsonReviver);

                    if (parsed._appName !== 'FocusAI' || !parsed._schema || !Array.isArray(parsed.tasks)) {
                        reject(new Error('Bu dosya FocusAI yedeği değil veya tanınmayan bir formatta.')); return;
                    }

                    if (Array.isArray(parsed.tasks))                 FocusStorage.set('tasks',               parsed.tasks);
                    if (parsed.events)                               FocusStorage.set('events',              parsed.events);
                    if (Array.isArray(parsed.goals))                 FocusStorage.set('goals',               parsed.goals);
                    if (Array.isArray(parsed.habits))                FocusStorage.set('habits',              parsed.habits);
                    if (Array.isArray(parsed.habit_categories))      FocusStorage.set('habit_categories',    parsed.habit_categories);
                    if (typeof parsed.focus_minutes === 'number')    FocusStorage.set('focus_minutes',       parsed.focus_minutes);
                    if (parsed.focus_history)                        FocusStorage.set('focus_history',       parsed.focus_history);
                    if (parsed.category_focus)                       FocusStorage.set('category_focus',      parsed.category_focus);
                    if (parsed.focus_hours)                          FocusStorage.set('focus_hours',         parsed.focus_hours);
                    if (parsed.highlight_history)                    FocusStorage.set('highlight_history',   parsed.highlight_history);
                    if (Array.isArray(parsed.mind_dumps))            FocusStorage.set('mind_dumps',          parsed.mind_dumps);
                    if (Array.isArray(parsed.mind_dump_conversions)) FocusStorage.set('mind_dump_conversions', parsed.mind_dump_conversions);
                    if (parsed.timer_settings)                       FocusStorage.set('timer_settings',      parsed.timer_settings);
                    if (parsed.app_theme)                            FocusStorage.set('app_theme',           parsed.app_theme);
                    if (typeof parsed.tour_completed === 'boolean')  FocusStorage.set('tour_completed',      parsed.tour_completed);
                    if (parsed.weekly_planned)                       FocusStorage.setRaw('weekly_planned',   parsed.weekly_planned);

                    if (Array.isArray(parsed.focusai_journal_entries)) {
                        FocusStorage.set('focusai_journal_entries', parsed.focusai_journal_entries);
                    } else if (parsed.reflection_history) {
                        // Eski yedek (schema < 1.2): reflection_history -> focusai_journal_entries
                        const merged = Object.entries(parsed.reflection_history).map(([key, entry]) => ({
                            date:      /^\d{2}-\d{2}-\d{4}$/.test(key) ? _ddmmyyyyToIso(key) : key,
                            achieve:   entry.achieve || '',
                            improve:   entry.improve || '',
                            completed: !!entry.completed,
                            skipped:   !!entry.skipped,
                        }));
                        FocusStorage.set('focusai_journal_entries', merged);
                    }

                    resolve(parsed._exportDate
                        ? new Date(parsed._exportDate).toLocaleString('tr-TR')
                        : 'Bilinmiyor');
                } catch (err) {
                    reject(new Error('JSON ayrıştırma hatası: ' + err.message));
                }
            };

            reader.readAsText(file, 'UTF-8');
        });
    }


    function clearAllData() {
        const keys = [
            'goals', 'tasks', 'events', 'habits', 'habit_categories',
            'focus_minutes', 'focus_history', 'category_focus', 'focus_hours',
            'highlight_history', 'reflection_history', 'focusai_journal_entries',
            'mind_dumps', 'mind_dump_conversions',
            'timer_settings', 'app_theme', 'tour_completed', 'weekly_planned',
            'planning_goals',
        ];
        keys.forEach(k => FocusStorage.remove(k));
        localStorage.removeItem('focusai_reflections'); // eski ham günlük anahtarı
        localStorage.removeItem('planning_goals');      // prefix'siz direkt yazılan planlama verisi
        _showToast('Tüm veriler silindi.', 'warning');
    }

    function _showToast(msg, type = 'success') {
        const colors = { success: '#2ed573', error: '#ff4757', warning: '#ff9f43' };
        const toast = document.createElement('div');
        toast.textContent = msg;
        Object.assign(toast.style, {
            position:     'fixed', bottom: '30px', right: '30px', zIndex: '999999',
            background:   colors[type] || colors.success,
            color:        '#000', padding: '12px 20px', borderRadius: '12px',
            fontSize:     '13px', fontFamily: 'Poppins,sans-serif', fontWeight: '600',
            boxShadow:    '0 4px 20px rgba(0,0,0,0.4)',
            opacity:      '0', transform: 'translateY(10px)',
            transition:   'opacity 0.3s ease, transform 0.3s ease',
        });
        document.body.appendChild(toast);
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        });
        setTimeout(() => {
            toast.style.opacity  = '0';
            toast.style.transform = 'translateY(10px)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    return { exportData, importData, clearAllData, collectAllData };
})();
window.DataManager = DataManager;

function generateId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
}
window.generateId = generateId;

// ── ES module export yüzeyi ── (window.X atamaları geriye dönük uyumluluk
// için hâlâ duruyor; bu dosyanın hepsi senkron/üst-seviye çalıştığı için
// (DOMContentLoaded'a bağımlı değil) doğrudan export güvenli.
export const escapeHtml = window.escapeHtml;
export { FocusStorage, DataManager, generateId };
