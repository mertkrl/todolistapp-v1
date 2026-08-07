/**
 * FocusAI ↔ Supabase senkronizasyon katmanı.
 * Bağımsız tarih dönüştürücüler içerir (script.js'e bağımlı değil),
 * böylece script.js'ten ÖNCE yüklenebilir.
 *
 * Sağladığı global API'ler:
 *   window.FocusSupabase  → supabase.createClient(...) örneği (ya da null)
 *   window.FocusAuth      → { getSession, signUp, signIn, resetPasswordForEmail, updatePassword, signOut, onAuthChange }
 *   window.FocusSync      → { isEnabled, pushKey, pullAll, runImportWizard }
 */
import {
    ddmmyyyyToIso, isoToDdmmyyyy, isUuid,
    taskToRow, flattenEvents, goalToRow, habitToRow, habitCategoryToRow, journalToRow,
    rowToTask, rowsToEvents, rowToGoal, rowsToHabits, rowToHabitCategory, rowToJournalEntry,
} from './supabase-client-row-converters.js';
(() => {
    // Launch öncesi maliyet kısıtı (Supabase free tier realtime bağlantı limiti):
    // sohbet/mesajlaşma tamamen kapalı. Ürün para kazandırmaya başlayınca true yapılır.
    window.FOCUS_MESSAGING_ENABLED = false;

    const SUPABASE_URL = 'https://qyzfkiideqovqiarabds.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_M4Sed5jniCGdzX6GgHvzxw_ZzlcwEpj';

    const _client = (window.supabase && typeof window.supabase.createClient === 'function' && /^https?:\/\//.test(SUPABASE_URL))
        ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
        : null;

    window.FocusSupabase = _client;

    if (!_client) {
        console.warn('[FocusSync] Supabase yapılandırılmamış (placeholder bilgiler) — senkronizasyon devre dışı, uygulama localStorage ile normal çalışıyor.');
    }

    let _session = null;
    let _suppressPush = false;
    let _pullInFlight = null; // aynı anda birden fazla pullAll() çağrısını tekilleştirir
    const _authListeners = [];
    const _pushTimers = {};
    const _pendingValues = {}; // flush için değerleri saklar
    const PUSH_DEBOUNCE_MS = 1200;

    // ============================================================
    // Auth
    // ============================================================
    if (_client) {
        _client.auth.getSession().then(({ data }) => { _session = data.session; });
        _client.auth.onAuthStateChange((event, session) => {
            _session = session;
            _authListeners.forEach(cb => {
                try { cb(event, session); } catch (e) { console.error('[FocusAuth] listener hatası:', e); }
            });
        });
    }

    const FocusAuth = {
        async getSession() {
            if (!_client) return null;
            const { data } = await _client.auth.getSession();
            _session = data.session;
            return _session;
        },
        // Gerçek kayıt: kullanıcı kendi şifresini belirler. Supabase Dashboard >
        // Authentication > Providers > Email'de "Confirm email" AÇIK olmalı ki
        // hesap sadece o e-postaya erişimi olan kişi tarafından doğrulanabilsin.
        async signUp(email, password) {
            if (!_client) throw new Error('Supabase yapılandırılmamış.');
            return _client.auth.signUp({ email, password });
        },
        async signIn(email, password) {
            if (!_client) throw new Error('Supabase yapılandırılmamış.');
            return _client.auth.signInWithPassword({ email, password });
        },
        // Şifremi unuttum: kullanıcının e-postasına sıfırlama bağlantısı gönderir.
        async resetPasswordForEmail(email) {
            if (!_client) throw new Error('Supabase yapılandırılmamış.');
            return _client.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname });
        },
        // Sıfırlama bağlantısından dönüldükten sonra (PASSWORD_RECOVERY oturumu) yeni şifreyi kaydeder.
        async updatePassword(newPassword) {
            if (!_client) throw new Error('Supabase yapılandırılmamış.');
            return _client.auth.updateUser({ password: newPassword });
        },
        async updateProfile(userId, fields) {
            if (!_client) throw new Error('Supabase yapılandırılmamış.');
            const { error } = await _client.from('profiles').update(fields).eq('id', userId);
            if (error) throw error;
        },
        async getProfile(userId) {
            if (!_client) return null;
            const { data } = await _client.from('profiles').select('*').eq('id', userId).maybeSingle();
            return data;
        },
        async updateAuthUser(fields) {
            // email ve/veya password günceller (Supabase Auth)
            if (!_client) throw new Error('Supabase yapılandırılmamış.');
            const { error } = await _client.auth.updateUser(fields);
            if (error) throw error;
        },
        async uploadAvatar(userId, file) {
            if (!_client) throw new Error('Supabase yapılandırılmamış.');
            const ext = file.name.split('.').pop();
            const path = `${userId}/avatar.${ext}`;
            const { error: upErr } = await _client.storage.from('avatars').upload(path, file, { upsert: true });
            if (upErr) throw upErr;
            const { data } = _client.storage.from('avatars').getPublicUrl(path);
            return data.publicUrl;
        },
        async signOut() {
            if (!_client) return;
            await _client.auth.signOut();
            _session = null;
        },
        onAuthChange(cb) {
            _authListeners.push(cb);
        },
    };
    window.FocusAuth = FocusAuth;

    // ============================================================
    // Ortak yardımcılar
    // ============================================================
    async function _replaceRows(table, rows, userId) {
        if (!_client) return;
        try {
            await _client.from(table).delete().eq('user_id', userId);
            if (rows && rows.length) {
                    const { error } = await _client.from(table).insert(rows, { ignoreDuplicates: true });
                if (error) console.warn(`[FocusSync] "${table}" ekleme hatası:`, error.message);
            }
        } catch (e) {
            console.warn(`[FocusSync] "${table}" senkronizasyon hatası:`, e.message);
        }
    }

    async function _syncHabits(habitsArr, userId) {
        if (!_client) return;
        // NOT: burada bilerek "delete-all sonra insert-all" (_replaceRows) yerine
        // "upsert önce, temizlik-delete sonra" sırası kullanılıyor. Hard refresh
        // ortasında istek yarıda kesilirse (delete sunucuda tamamlanır ama insert
        // hiç gönderilemez), _replaceRows tüm alışkanlıkları kalıcı olarak siliyordu —
        // sık sık yenilemede bu yüzden alışkanlıklar bir süre sonra kayboluyordu.
        // Upsert-önce sırasıyla en kötü ihtimalde silinmesi gereken eski bir satır
        // geride kalır (zararsız, bir sonraki senkronda temizlenir); asıl veri asla kaybolmaz.
        //
        // parentGoals artık habitToRow() ile aynı satırda (parent_goals sütunu) atomik
        // olarak taşınıyor — ayrı habit_goals tablosuna yazan iki aşamalı adım kaldırıldı,
        // çünkü hard refresh tam iki adım arasına girince ana hedef bağlantısı kayboluyordu.
        const rows = (habitsArr || []).map(h => habitToRow(h, userId));
        try {
            if (rows.length) {
                const { error } = await _client.from('habits').upsert(rows, { onConflict: 'id' });
                if (error) console.warn('[FocusSync] "habits" upsert hatası:', error.message);
            }
            const keepIds = rows.map(r => r.id);
            let delQuery = _client.from('habits').delete().eq('user_id', userId);
            if (keepIds.length) delQuery = delQuery.not('id', 'in', `(${keepIds.join(',')})`);
            const { error: delError } = await delQuery;
            if (delError) console.warn('[FocusSync] "habits" temizlik-silme hatası:', delError.message);
        } catch (e) {
            console.warn('[FocusSync] "habits" senkronizasyon hatası:', e.message);
        }
    }

    // ============================================================
    // FocusSync
    // ============================================================
    const SYNC_TABLE_KEYS = new Set([
        'tasks', 'events', 'goals', 'habits', 'habit_categories', 'focusai_journal_entries', 'highlight_history',
    ]);

    const SYNC_PROFILE_COLUMNS = {
        app_theme: 'app_theme',
        timer_settings: 'timer_settings',
        tour_completed: 'tour_completed',
        weekly_planned: 'weekly_planned',
        focus_minutes: 'focus_minutes_total',
    };

    function isEnabled() {
        return !!(_client && _session && _session.user);
    }

    // Sessiz senkronizasyon hataları: bir ağ kesintisinde push başarısız olursa
    // eskiden sadece console.warn ile yutuluyordu ve değer bir daha denenmeden
    // kaybolabiliyordu. Şimdi: (1) bir kez daha yeniden dene (kısa gecikmeyle),
    // (2) art arda başarısız olursa kullanıcıya görünür bir uyarı göster.
    const _pushRetryCount = {};
    const _failureNotified = new Set();
    const PUSH_RETRY_MS = 8000;
    const PUSH_MAX_RETRIES = 2;

    function _notifySyncFailure(key) {
        if (_failureNotified.has(key)) return;
        _failureNotified.add(key);
        const msg = 'Değişikliklerin sunucuya kaydedilemedi (bağlantı sorunu). İnternetin geldiğinde otomatik tekrar denenecek.';
        if (typeof window.dcShowToast === 'function') {
            window.dcShowToast(msg, 'error');
        } else {
            console.warn(`[FocusSync] ${msg} (key: ${key})`);
        }
    }

    function _notifySyncRecovered(key) {
        if (!_failureNotified.has(key)) return;
        _failureNotified.delete(key);
        if (typeof window.dcShowToast === 'function') {
            window.dcShowToast('Senkronizasyon tekrar çalışıyor, değişikliklerin kaydedildi.', 'success');
        }
    }

    function _runSyncFn(key, value) {
        return SYNC_TABLE_KEYS.has(key) ? _syncTable(key, value) : _syncProfileField(key, value);
    }

    function _pushWithRetry(key, value) {
        return _runSyncFn(key, value).then(() => {
            _pushRetryCount[key] = 0;
            _notifySyncRecovered(key);
        }).catch(e => {
            console.warn(`[FocusSync] "${key}" gönderme hatası:`, e && e.message);
            const attempts = (_pushRetryCount[key] || 0) + 1;
            _pushRetryCount[key] = attempts;
            if (attempts <= PUSH_MAX_RETRIES) {
                setTimeout(() => _pushWithRetry(key, value), PUSH_RETRY_MS * attempts);
            } else {
                _notifySyncFailure(key);
            }
        });
    }

    async function _syncTable(key, value) {
        const userId = _session.user.id;
        switch (key) {
            case 'tasks':
                await _replaceRows('tasks', (value || []).map(t => taskToRow(t, userId)), userId);
                break;
            case 'events':
                await _replaceRows('events', flattenEvents(value, userId), userId);
                break;
            case 'goals':
                await _replaceRows('goals', (value || []).map(g => goalToRow(g, userId)), userId);
                break;
            case 'habits':
                await _syncHabits(value, userId);
                break;
            case 'habit_categories':
                await _replaceRows('habit_categories', (value || []).map(c => habitCategoryToRow(c, userId)), userId);
                break;
            case 'focusai_journal_entries':
                await _replaceRows('journal_entries', (value || []).map(e => journalToRow(e, userId)), userId);
                break;
            case 'highlight_history': {
                const highlightRows = Object.entries(value || {}).map(([d, h]) => ({
                    user_id: userId,
                    highlight_date: ddmmyyyyToIso(d),
                    text: h.text || null,
                    completed: !!h.completed,
                    achievement: h.achievement || null,
                    contract_if: h.contract ? (h.contract.ifText || null) : null,
                    contract_then: h.contract ? (h.contract.thenText || null) : null,
                    parent_goal_id: isUuid(h.parentGoal) ? h.parentGoal : null,
                }));
                await _replaceRows('daily_highlights', highlightRows, userId);
                break;
            }
        }
    }

    async function _syncProfileField(key, value) {
        if (!_client) return;
        const userId = _session.user.id;
        const col = SYNC_PROFILE_COLUMNS[key];
        const patch = { [col]: value };
        const { error } = await _client.from('profiles').update(patch).eq('id', userId);
        if (error) console.warn(`[FocusSync] profil alanı "${col}" güncelleme hatası:`, error.message);
    }

    function pushKey(key, value) {
        if (!isEnabled() || _suppressPush) return;
        if (!SYNC_TABLE_KEYS.has(key) && !SYNC_PROFILE_COLUMNS[key]) return;

        _pendingValues[key] = value;
        clearTimeout(_pushTimers[key]);
        _pushTimers[key] = setTimeout(() => {
            delete _pendingValues[key];
            _pushWithRetry(key, value);
        }, PUSH_DEBOUNCE_MS);
    }

    // Not: bu fonksiyon artık bekleyen push'ların Supabase'e GERÇEKTEN ulaştığı anı
    // bildiren bir Promise döndürüyor. pullAll() bunu await etmeden okumaya geçerse,
    // az önce silinen bir görev henüz DB'den silinmeden geri çekilip "hayalet görev"
    // olarak local'e geri yazılabiliyordu.
    function flushAll() {
        if (!isEnabled()) return Promise.resolve();
        const keys = Object.keys(_pendingValues);
        if (!keys.length) return Promise.resolve();
        const promises = keys.map(key => {
            clearTimeout(_pushTimers[key]);
            delete _pushTimers[key];
            const value = _pendingValues[key];
            delete _pendingValues[key];
            // İlk deneme burada beklenir (pullAll'un hayalet-görev riskini önlemek için);
            // başarısız olursa arka planda _pushWithRetry'nin kendi retry/uyarı zinciri devreye girer.
            return _runSyncFn(key, value).catch(e => {
                console.warn(`[FocusSync] flush hatası "${key}":`, e && e.message);
                _pushRetryCount[key] = 1;
                setTimeout(() => _pushWithRetry(key, value), PUSH_RETRY_MS);
            });
        });
        return Promise.all(promises);
    }

    // pullAll(); script.js init'te, auth-ui.js'in SIGNED_IN dinleyicisinde ve auth-ui.js'in
    // "zaten oturum açık" kontrolünde — sayfa yüklemesinde birden fazla yerden çağrılabiliyor.
    // Bunlar eşzamanlı çalışırsa iki ayrı pullAll() birbirinin ara local/remote karşılaştırma
    // anını bozup henüz sunucuya yazılmamış bir alışkanlığı kalıcı olarak siliyordu. Bu yüzden
    // aynı anda tek bir çalışma olmasını garanti ediyoruz; ikinci çağrı ilkinin bitmesini bekler.
    function pullAll() {
        if (_pullInFlight) return _pullInFlight;
        _pullInFlight = _pullAllImpl().finally(() => { _pullInFlight = null; });
        return _pullInFlight;
    }

    async function _pullAllImpl() {
        if (!isEnabled()) return;
        const userId = _session.user.id;
        // Flush any in-flight debounced pushes BEFORE suppressing, so local
        // changes (özellikle silmeler) Supabase'e GERÇEKTEN yazılana kadar bekleniyor —
        // aksi halde aşağıdaki select'ler henüz silinmemiş eski satırı görüp geri getirir.
        await flushAll();
        _suppressPush = true;
        try {
            const [profileRes, tasksRes, eventsRes, goalsRes, habitsRes, habitGoalsRes, catsRes, journalRes, highlightsRes] = await Promise.all([
                _client.from('profiles').select('*').eq('id', userId).maybeSingle(),
                _client.from('tasks').select('*').eq('user_id', userId),
                _client.from('events').select('*').eq('user_id', userId),
                _client.from('goals').select('*').eq('user_id', userId),
                _client.from('habits').select('*').eq('user_id', userId),
                // habit_goals'ta user_id kolonu yok (composite PK: habit_id+goal_id) —
                // eq('user_id',...) burada uygulanamaz. Erişim RLS ile habit_id üzerinden
                // habits.user_id'ye zincirlenerek kısıtlanır (001_personal_data.sql:255-262,
                // policy "own_data_all"), yani bu sorgu zaten sadece kullanıcının kendi
                // satırlarını döndürür — filtresiz görünmesi kasıtlı, doğrulanmıştır.
                _client.from('habit_goals').select('*'),
                _client.from('habit_categories').select('*').eq('user_id', userId),
                _client.from('journal_entries').select('*').eq('user_id', userId),
                _client.from('daily_highlights').select('*').eq('user_id', userId),
            ]);

            if (tasksRes.data) {
                const remoteTasks = tasksRes.data.map(rowToTask);
                const remoteIds   = new Set(remoteTasks.map(t => t.id));

                // Collect locally-known tasks that Supabase doesn't have yet.
                // Two sources:
                //   1) _pendingValues['tasks']  — in-memory debounce buffer (same page session)
                //   2) current localStorage     — survives hard-refresh (Cmd+Shift+R)
                const pendingTasks  = _pendingValues['tasks'];
                const localTasks    = FocusStorage.get('tasks', []);
                const localById     = new Map(localTasks.map(t => [t.id, t]));
                const localOnlyIds  = new Set(
                    localTasks.filter(t => !remoteIds.has(t.id)).map(t => t.id)
                );
                const pendingIds    = pendingTasks ? new Set(pendingTasks.map(t => t.id)) : new Set();

                const allOrphanIds  = new Set([...localOnlyIds, ...pendingIds]);

                // Planning goal IDs use a non-UUID format (pg_xxx) so isUuid() returns false
                // and parent_goal_id is stored as null in Supabase. Restore parentGoal and
                // other local-only metadata from localStorage after reload.
                const restoreLocalMeta = (rt) => {
                    const local = localById.get(rt.id);
                    if (!local) return rt;
                    const patch = {};
                    if (!rt.parentGoal  && local.parentGoal)  patch.parentGoal  = local.parentGoal;
                    if (!rt._addedBy    && local._addedBy)    patch._addedBy    = local._addedBy;
                    if (!rt._pending    && local._pending)    patch._pending    = local._pending;
                    // isLessonPlanDraft: öğretmenin başka bir öğrenci için henüz atamadığı ders
                    // planı taslağı bayrağı — Supabase'de sütunu yok, bu yüzden restore edilmezse
                    // ilk pullAll()'da sessizce kayboluyor ve görev öğretmenin kendi Bugün/Takvim
                    // görünümlerinde tekrar görünür hale geliyordu.
                    if (!rt.isLessonPlanDraft && local.isLessonPlanDraft) patch.isLessonPlanDraft = local.isLessonPlanDraft;
                    return Object.keys(patch).length ? { ...rt, ...patch } : rt;
                };

                if (allOrphanIds.size > 0) {
                    // Keep remote tasks that aren't overridden, then add all orphan tasks.
                    const orphanSource = pendingTasks || localTasks;
                    const orphans      = orphanSource.filter(t => allOrphanIds.has(t.id));
                    const merged       = [
                        ...remoteTasks.filter(t => !allOrphanIds.has(t.id)).map(restoreLocalMeta),
                        ...orphans,
                    ];
                    FocusStorage.set('tasks', merged);
                    // Re-push the orphan tasks to Supabase after pullAll settles.
                    setTimeout(() => {
                        if (isEnabled() && !_suppressPush) {
                            pushKey('tasks', merged);
                        }
                    }, 500);
                } else {
                    FocusStorage.set('tasks', remoteTasks.map(restoreLocalMeta));
                }
            }
            if (eventsRes.data) {
                const remoteEvents = rowsToEvents(eventsRes.data);
                // Also merge locally-pending events (same logic as tasks).
                const pendingEvents = _pendingValues['events'];
                const localEvents   = FocusStorage.get('events', {});
                // isLessonPlanDraft: Supabase'de sütunu olmayan client-only bayrak — o günün
                // event dizisi remote'takiyle değiştirildiğinde restore edilmezse kayboluyordu.
                const localEventById = {};
                Object.values(localEvents).forEach(dayArr => (dayArr || []).forEach(e => { localEventById[e.id] = e; }));
                const restoreEventMeta = (ev) => {
                    const local = localEventById[ev.id];
                    if (!local || !local.isLessonPlanDraft || ev.isLessonPlanDraft) return ev;
                    return { ...ev, isLessonPlanDraft: local.isLessonPlanDraft };
                };
                Object.keys(remoteEvents).forEach(d => { remoteEvents[d] = remoteEvents[d].map(restoreEventMeta); });
                // Find event dates that are only local (not in remote).
                const remoteDates   = new Set(Object.keys(remoteEvents));
                const localOnlyDates = Object.keys(localEvents).filter(d => !remoteDates.has(d));
                const pendingDates   = pendingEvents ? new Set(Object.keys(pendingEvents)) : new Set();
                const orphanDates    = new Set([...localOnlyDates, ...pendingDates]);

                if (orphanDates.size > 0) {
                    const orphanSource  = pendingEvents || localEvents;
                    const orphanEntries = {};
                    orphanDates.forEach(d => { if (orphanSource[d]) orphanEntries[d] = orphanSource[d]; });
                    const merged = { ...remoteEvents, ...orphanEntries };
                    FocusStorage.set('events', merged);
                } else {
                    FocusStorage.set('events', remoteEvents);
                }
            }
            if (goalsRes.data) {
                const localGoals = FocusStorage.get('goals', []);
                const remoteGoalIds = new Set(goalsRes.data.map(r => r.id));
                const localGoalsMap = new Map(localGoals.map(g => [g.id, g]));

                // Milestone merge: local milestones önce al (hard-reset'te Supabase'in gerisinde kalabilir)
                const localMilestonesMap = {};
                localGoals.forEach(g => {
                    if (g.milestones && g.milestones.length > 0) {
                        localMilestonesMap[g.id] = g.milestones;
                    }
                });

                const mergedGoals = goalsRes.data.map(r => {
                    const remoteGoal = rowToGoal(r);
                    // `goals` tablosunda sütunu olmayan client-only alanlar (pending_accept,
                    // plan_mode, lpa_id, context, color, priority, progress_pct, collab_room_id,
                    // my_role vb.) rowToGoal()'da hiç set edilmiyor. Önce local'i baz alıp remote
                    // ile üzerine yazmak — bu alanların her pullAll()'da sessizce kaybolmasını
                    // (örn. ders planı taslağının "kabul bekliyor" durumunun silinip, henüz kabul
                    // edilmemiş planın kalıcıymış gibi görünmesini) önlüyor.
                    const local = localGoalsMap.get(remoteGoal.id);
                    const goal = local ? { ...local, ...remoteGoal } : remoteGoal;
                    // Supabase milestone yoksa veya local daha güncel/uzunsa local'i tercih et
                    const localMs = localMilestonesMap[goal.id];
                    if (localMs && (!goal.milestones || goal.milestones.length === 0 || localMs.length > goal.milestones.length)) {
                        goal.milestones = localMs;
                    }
                    return goal;
                });

                // Orphan goals: Supabase'de henüz olmayan local hedefler (debounce fırlamamıştı)
                const orphanGoals = localGoals.filter(g => !remoteGoalIds.has(g.id));
                const allGoals = [...mergedGoals, ...orphanGoals];
                FocusStorage.set('goals', allGoals);

                if (orphanGoals.length > 0) {
                    setTimeout(() => {
                        if (isEnabled() && !_suppressPush) pushKey('goals', allGoals);
                    }, 600);
                }
            }
            if (habitsRes.data) {
                let remoteHabits = rowsToHabits(habitsRes.data, habitGoalsRes.data);
                const remoteHabitIds = new Set(remoteHabits.map(h => h.id));

                const pendingHabits = _pendingValues['habits'];
                const localHabits   = FocusStorage.get('habits', []);
                const localHabitsMap = new Map(localHabits.map(h => [h.id, h]));

                // parentGoals ilişkisi ayrı bir tabloda (habit_goals) tutuluyor; habit_goals
                // insert'i habits'in kendisinden ayrı bir adım olduğundan, push debounce'ı hard
                // refresh'te yarım kaldığında remote'ta habit satırı var ama goal bağlantısı yok
                // olabiliyor. Böyle durumlarda local'deki (daha zengin) parentGoals'ı koru —
                // goals'daki milestone koruma mantığıyla aynı yaklaşım.
                let restoredGoalLinks = false;
                remoteHabits = remoteHabits.map(rh => {
                    const local = localHabitsMap.get(rh.id);
                    if (local && local.parentGoals && local.parentGoals.length > (rh.parentGoals ? rh.parentGoals.length : 0)) {
                        restoredGoalLinks = true;
                        return { ...rh, parentGoals: local.parentGoals };
                    }
                    return rh;
                });

                // Orphan habits: local'de var ama Supabase'e henüz push edilmemiş
                // (debounce hard-refresh'te ölmüş olabilir) — tasks/goals'takiyle aynı mantık.
                const localOnlyIds  = new Set(
                    localHabits.filter(h => !remoteHabitIds.has(h.id)).map(h => h.id)
                );
                const pendingIds    = pendingHabits ? new Set(pendingHabits.map(h => h.id)) : new Set();
                const allOrphanIds  = new Set([...localOnlyIds, ...pendingIds]);

                if (allOrphanIds.size > 0) {
                    const orphanSource = pendingHabits || localHabits;
                    const orphans      = orphanSource.filter(h => allOrphanIds.has(h.id));
                    const merged       = [
                        ...remoteHabits.filter(h => !allOrphanIds.has(h.id)),
                        ...orphans,
                    ];
                    FocusStorage.set('habits', merged);
                    setTimeout(() => {
                        if (isEnabled() && !_suppressPush) pushKey('habits', merged);
                    }, 500);
                } else {
                    FocusStorage.set('habits', remoteHabits);
                    // Local'den restore edilen parentGoals varsa, ilişkiyi buluta geri yaz.
                    if (restoredGoalLinks) {
                        setTimeout(() => {
                            if (isEnabled() && !_suppressPush) pushKey('habits', remoteHabits);
                        }, 500);
                    }
                }
            }
            if (catsRes.data && catsRes.data.length) FocusStorage.set('habit_categories', catsRes.data.map(rowToHabitCategory));
            if (journalRes.data) {
                // Journal merge: remote'u olduğu gibi yazmak, push'u buluta yetişememiş
                // (sayfa kapanınca debounce ölür) günlük kayıtlarını siliyordu →
                // gün sonu değerlendirmesi yapılmış olsa da her açılışta tekrar soruyordu.
                // Local'de olup remote'ta olmayan (ya da local'i tamamlanmış/dolu olan)
                // tarihleri koru ve farkı buluta geri push'la.
                const remoteJournal = journalRes.data.map(rowToJournalEntry);
                const localJournal  = FocusStorage.get('focusai_journal_entries', []);
                const remoteByDate  = new Map(remoteJournal.map(e => [e.date, e]));
                let needsPush = false;
                localJournal.forEach(le => {
                    if (!le || !le.date) return;
                    const re = remoteByDate.get(le.date);
                    const localRicher = !re ||
                        ((le.completed || le.skipped) && !(re.completed || re.skipped)) ||
                        ((le.achieve || le.improve) && !(re.achieve || re.improve));
                    if (localRicher) {
                        remoteByDate.set(le.date, le);
                        needsPush = true;
                    }
                });
                const mergedJournal = Array.from(remoteByDate.values());
                FocusStorage.set('focusai_journal_entries', mergedJournal);
                if (needsPush) {
                    setTimeout(() => {
                        if (isEnabled() && !_suppressPush) pushKey('focusai_journal_entries', mergedJournal);
                    }, 700);
                }
            }

            if (highlightsRes.data && highlightsRes.data.length) {
                const highlightHistory = {};
                highlightsRes.data.forEach(r => {
                    const dateKey = isoToDdmmyyyy(r.highlight_date);
                    highlightHistory[dateKey] = {
                        text: r.text || '',
                        completed: !!r.completed,
                        achievement: r.achievement || null,
                        contract: (r.contract_if || r.contract_then) ? { ifText: r.contract_if, thenText: r.contract_then } : null,
                        parentGoal: r.parent_goal_id || null,
                    };
                });
                FocusStorage.set('highlight_history', highlightHistory);
            }

            const profile = profileRes.data;
            if (profile) {
                if (profile.app_theme) FocusStorage.set('app_theme', profile.app_theme);
                if (profile.timer_settings) FocusStorage.set('timer_settings', profile.timer_settings);
                // Tur tamamlanmışlığını asla geri alma: profildeki false/null değeri
                // local'de tamamlanmış turu sıfırlayıp her sayfa yenilemede turun
                // (ve onunla birlikte 'bugun' sekmesine zorla geçişin) yeniden
                // başlamasına yol açıyordu. true ise yaz, değilse local'e dokunma.
                if (profile.tour_completed) FocusStorage.set('tour_completed', true);
                if (typeof profile.weekly_planned === 'string') FocusStorage.setRaw('weekly_planned', profile.weekly_planned);
                if (typeof profile.focus_minutes_total === 'number') FocusStorage.set('focus_minutes', profile.focus_minutes_total);
            }

            window.dispatchEvent(new CustomEvent('focusai:data-synced'));
            startRealtimeSync();
        } catch (e) {
            console.warn('[FocusSync] pullAll hatası:', e.message);
        } finally {
            _suppressPush = false;
        }
    }

    async function runImportWizard() {
        if (!isEnabled()) throw new Error('Oturum açık değil.');
        if (typeof DataManager === 'undefined' || typeof DataManager.collectAllData !== 'function') {
            throw new Error('DataManager.collectAllData bulunamadı.');
        }

        const userId = _session.user.id;
        _suppressPush = true;
        try {
            const data = DataManager.collectAllData();

            await _replaceRows('tasks', (data.tasks || []).map(t => taskToRow(t, userId)), userId);
            await _replaceRows('events', flattenEvents(data.events, userId), userId);
            await _replaceRows('goals', (data.goals || []).map(g => goalToRow(g, userId)), userId);
            await _syncHabits(data.habits, userId);
            await _replaceRows('habit_categories', (data.habit_categories || []).map(c => habitCategoryToRow(c, userId)), userId);
            await _replaceRows('journal_entries', (data.focusai_journal_entries || []).map(e => journalToRow(e, userId)), userId);

            // daily_stats: focus_history + category_focus + focus_hours birleşimi
            const statDates = new Set([
                ...Object.keys(data.focus_history || {}),
                ...Object.keys(data.category_focus || {}),
                ...Object.keys(data.focus_hours || {}),
            ]);
            const statRows = Array.from(statDates).map(d => ({
                user_id: userId,
                stat_date: ddmmyyyyToIso(d),
                focus_minutes: (data.focus_history || {})[d] || 0,
                category_minutes: (data.category_focus || {})[d] || {},
                hourly_minutes: (data.focus_hours || {})[d] || {},
            }));
            await _replaceRows('daily_stats', statRows, userId);

            // daily_highlights
            const highlightRows = Object.entries(data.highlight_history || {}).map(([d, h]) => ({
                user_id: userId,
                highlight_date: ddmmyyyyToIso(d),
                text: h.text || null,
                completed: !!h.completed,
                achievement: h.achievement || null,
                contract_if: h.contract ? (h.contract.ifText || null) : null,
                contract_then: h.contract ? (h.contract.thenText || null) : null,
                parent_goal_id: isUuid(h.parentGoal) ? h.parentGoal : null,
            }));
            await _replaceRows('daily_highlights', highlightRows, userId);

            // mind_dumps
            const mindDumpRows = (data.mind_dumps || []).map(m => {
                const row = {
                    user_id: userId,
                    text: m.text,
                    created_at: m.timestamp ? new Date(m.timestamp).toISOString() : new Date().toISOString(),
                };
                if (isUuid(m.id)) row.id = m.id;
                return row;
            });
            await _replaceRows('mind_dumps', mindDumpRows, userId);

            // mind_dump_conversions
            const conversionRows = (data.mind_dump_conversions || []).map(c => ({
                user_id: userId,
                mind_dump_id: isUuid(c.id) ? c.id : null,
                conversion_date: ddmmyyyyToIso(c.date),
            }));
            await _replaceRows('mind_dump_conversions', conversionRows, userId);

            // profiles
            const { error } = await _client.from('profiles').update({
                app_theme: data.app_theme,
                timer_settings: data.timer_settings,
                tour_completed: !!data.tour_completed,
                weekly_planned: typeof data.weekly_planned === 'string' ? data.weekly_planned : null,
                focus_minutes_total: data.focus_minutes || 0,
                imported_at: new Date().toISOString(),
            }).eq('id', userId);
            if (error) console.warn('[FocusSync] profil güncelleme hatası:', error.message);
        } finally {
            _suppressPush = false;
        }
    }

    // ============================================================
    // Realtime — kişisel veri değişimlerini dinle
    // ============================================================
    let _realtimeChannel = null;

    function startRealtimeSync() {
        if (!_client || !_session) return;
        if (_realtimeChannel) {
            _client.removeChannel(_realtimeChannel);
            _realtimeChannel = null;
        }
        const userId = _session.user.id;
        _realtimeChannel = _client
            .channel(`personal-data-${userId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks',    filter: `user_id=eq.${userId}` }, _onPersonalDataChange)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'habits',   filter: `user_id=eq.${userId}` }, _onPersonalDataChange)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'goals',    filter: `user_id=eq.${userId}` }, _onPersonalDataChange)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_highlights', filter: `user_id=eq.${userId}` }, _onPersonalDataChange)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_stats',      filter: `user_id=eq.${userId}` }, _onPersonalDataChange)
            .subscribe();
    }

    let _realtimeDebounce = null;
    function _onPersonalDataChange() {
        if (_suppressPush) return;
        clearTimeout(_realtimeDebounce);
        _realtimeDebounce = setTimeout(() => {
            pullAll();
        }, 1500);
    }

    // Auth değişince realtime'ı başlat/durdur
    if (_client) {
        _client.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session) {
                setTimeout(startRealtimeSync, 500);
            } else if (event === 'SIGNED_OUT') {
                if (_realtimeChannel) {
                    _client.removeChannel(_realtimeChannel);
                    _realtimeChannel = null;
                }
            }
        });
    }

    // ============================================================
    // İstatistik dönem sorgusu (daily_stats tablosu)
    // ============================================================
    async function fetchFocusMinutesForPeriod(days) {
        if (!isEnabled()) return null;
        const userId = _session.user.id;
        let query = _client.from('daily_stats').select('stat_date, focus_minutes').eq('user_id', userId);
        if (days > 0) {
            const since = new Date();
            since.setDate(since.getDate() - days);
            query = query.gte('stat_date', since.toISOString().split('T')[0]);
        }
        const { data, error } = await query;
        if (error) { console.warn('[FocusSync] daily_stats sorgu hatası:', error.message); return null; }
        return (data || []).reduce((sum, row) => sum + (row.focus_minutes || 0), 0);
    }

    window.FocusSync = { isEnabled, pushKey, flushAll, pullAll, runImportWizard, fetchFocusMinutesForPeriod };

    // Sayfa kapanmadan önce bekleyen tüm değişiklikleri Supabase'e gönder
    window.addEventListener('beforeunload', () => flushAll());
})();
