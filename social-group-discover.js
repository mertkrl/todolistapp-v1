// social-group-discover.js
// social.js'ten çıkarıldı (Faz 5/6): Global Açık Grupları Keşfetme Motoru
// (Discover Groups) — kategori/filtre/sıralama, kaydedilen gruplar, herkese
// açık grup listesi, gruba katılma akışı, önizleme/karşılama modalları.
//
// Köprüler:
//  - computeUserInterestCategoriesSupabase, renderDiscoverGroups: social.js'in
//    geri kalanı VE social-institution-panel.js tarafından window.* ile
//    çağrılıyor, burada tanımlı, dışa açıldı.
//  - computeActiveNowCount: ÖNCEDEN (Faz 5) window'a atanmıştı, atama satırı
//    fonksiyonuyla birlikte bu modüle taşındı.
//  - window.GROUP_LIMITS: social.js'te tanımlı sabit, bu modülde salt-okunur
//    kullanılıyor.
//  - window.getMyGroupsDataCache(): social.js'teki _myGroupsDataCache'i
//    salt-okunur okumak için.


        // 5. GLOBAL AÇIK GRUPLARI KEŞFETME MOTORU (TAM REAL-TIME)
        const GROUP_CATEGORY_LABELS = {
            "spor": "🏅 Spor",
            "egitim": "📚 Eğitim",
            "is": "💼 İş",
            "yazilim": "💻 Yazılım",
            "kisisel-gelisim": "🌱 Kişisel Gelişim"
        };
        let activeDiscoverCategory = "all";
        // Keşfet ana listesi için sıralama ve filtre durumu
        let discoverSortMode = "default"; // default | members-desc | members-asc | active-desc
        let discoverFilterHasSlot = false; // "Boş Yer Var"
        let discoverFilterActiveOnly = false; // "Şu An Aktif"
        let cachedDiscoverGroupsSnapshot = null;
        let userInterestCategories = new Set();
        let recommendationsOffset = 0;
        let discoverMainOffset = 0;
        const DISCOVER_MAIN_COUNT = 4;

        // Tüm kullanıcıların online durumlarının önbelleği — "şu an aktif" göstergesi için
        let _discoverAllUsersCache = {};
        // Kullanıcının kaydettiği gruplar: { [groupCode]: { savedAt, notified } }
        let _savedGroupsCache = {};
        // Kaydedilen gruplarda doluluk durumunun önceki değeri (yer açıldı bildirimi için)
        let _savedGroupFullState = {};

        // Bir grubun üyelerinden şu anda kaç tanesi çevrimiçi (aktif) onu hesaplar.
        // Supabase grupları için üye kaydındaki userId, 'community-presence' Realtime
        // Presence durumuyla; Firebase grupları için kullanıcı adı, eski online cache'iyle eşleştirilir.
        window.computeActiveNowCount = (groupData) => computeActiveNowCount(groupData); // Faz 5: social-group-details.js için
        function computeActiveNowCount(groupData) {
            const members = groupData.members || {};
            if (groupData._supaId) window.registerPresenceWatchIds?.(Object.values(members).map(m => m?.userId).filter(Boolean));
            const presenceState = (groupData._supaId && window.getCommunityPresenceState) ? window.getCommunityPresenceState() : null;
            let count = 0;
            Object.keys(members).forEach((uname) => {
                const member = members[uname];
                if (presenceState && member && member.userId) {
                    const entries = presenceState[member.userId];
                    if (entries && entries.some(p => p.studying)) count++;
                } else if (_discoverAllUsersCache[uname]?.online === true) {
                    count++;
                }
            });
            return count;
        }

        // Bir grubu "Kaydettiklerim" listesine ekler/çıkarır
        function toggleSaveGroup(groupCode) {
            if (!currentUser) return;
            toggleSaveGroupSupabase(groupCode);
        }

        function checkSavedGroupSlotNotifications() {
            checkSavedGroupSlotNotificationsSupabase();
        }

        function computeUserInterestCategories(callback) {
            callback();
        }

        // ──────────────────────────────────────────────────────
        // SUPABASE: KEŞFET + KAYDEDİLENLER (M2b-2 Bölüm 2)
        // ──────────────────────────────────────────────────────

        // Supabase'den çekilen { [code]: groupData } map'ini eski Firebase
        // snapshot arayüzüne (.forEach, .child(code).exists()/.val()) uyarlar —
        // renderDiscoverGroups/renderSavedGroupsSection/checkSavedGroupSlotNotifications/
        // openSavedGroupPreview değişmeden çalışır.
        function _buildSnapshotLike(groupsMap) {
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

        // privacy='public' olan tüm Supabase gruplarını + üyelerini çeker ve
        // _normalizeSupabaseGroup ile eski groupData şekline çevirir.
        async function fetchPublicGroupsSupabase() {
            const { data: groupRows, error } = await window.FocusSupabase
                .from('groups')
                .select('*')
                .eq('privacy', 'public');
            if (error) {
                console.error('fetchPublicGroupsSupabase:', error);
                return {};
            }

            const groupsMap = {};
            for (const groupRow of (groupRows || [])) {
                const { data: memberRows } = await window.FocusSupabase
                    .from('group_members')
                    .select('user_id, role, class_section_id, joined_at, profiles(id, username, display_name, avatar_color, custom_avatar, avatar_initials)')
                    .eq('group_id', groupRow.id);
                groupsMap[groupRow.code] = await _normalizeSupabaseGroup(groupRow, memberRows || []);
            }
            return groupsMap;
        }

        // Kullanıcının "Kaydettiklerim" listesini Supabase `group_saved`'ten
        // çeker ve eski Firebase şekliyle (_savedGroupsCache) doldurur.
        async function loadSavedGroupsSupabase() {
            if (!currentUser?.id) return;
            const { data: rows, error } = await window.FocusSupabase
                .from('group_saved')
                .select('group_id, saved_at, notified, groups(code)')
                .eq('user_id', currentUser.id);
            if (error) {
                console.error('loadSavedGroupsSupabase:', error);
                return;
            }
            _savedGroupsCache = {};
            (rows || []).forEach((row) => {
                const code = row.groups?.code;
                if (!code) return;
                _savedGroupsCache[code] = {
                    savedAt: row.saved_at ? new Date(row.saved_at).getTime() : Date.now(),
                    notified: !!row.notified,
                    groupId: row.group_id || null
                };
            });
        }

        // Bir grubu Supabase `group_saved` tablosunda kaydet/kaydı kaldır.
        async function toggleSaveGroupSupabase(groupCode) {
            if (!currentUser?.id || !cachedDiscoverGroupsSnapshot) return;
            const gSnap = cachedDiscoverGroupsSnapshot.child(groupCode);
            if (!gSnap.exists()) return;
            const groupData = gSnap.val();
            const groupId = groupData._supaId;
            if (!groupId) return;

            if (_savedGroupsCache[groupCode]) {
                await window.FocusSupabase.from('group_saved').delete()
                    .eq('user_id', currentUser.id).eq('group_id', groupId);
            } else {
                await window.FocusSupabase.from('group_saved')
                    .upsert({ user_id: currentUser.id, group_id: groupId, saved_at: new Date().toISOString(), notified: false });
            }

            await loadSavedGroupsSupabase();
            renderDiscoverGroups();
        }

        // Kaydedilen gruplarda "dolu" -> "yer açıldı" geçişini tespit edip
        // Supabase `notifications` tablosuna bildirim yazar (checkSavedGroupSlotNotifications'ın Supabase karşılığı).
        async function checkSavedGroupSlotNotificationsSupabase() {
            if (!cachedDiscoverGroupsSnapshot || !currentUser?.id) return;
            for (const code of Object.keys(_savedGroupsCache)) {
                const gSnap = cachedDiscoverGroupsSnapshot.child(code);
                if (!gSnap.exists()) continue;
                const groupData = gSnap.val();
                const full = window.isGroupFull(groupData);
                const wasFull = _savedGroupFullState[code];

                if (wasFull === undefined) {
                    _savedGroupFullState[code] = full;
                    continue;
                }

                if (wasFull && !full && !_savedGroupsCache[code]?.notified) {
                    await window.FocusSupabase.from('notifications').insert({
                        user_id: currentUser.id,
                        type: 'group_slot_open',
                        payload: { groupCode: code, groupName: groupData.name || '' }
                    });
                    await window.FocusSupabase.from('group_saved')
                        .update({ notified: true })
                        .eq('user_id', currentUser.id).eq('group_id', groupData._supaId);
                    if (_savedGroupsCache[code]) _savedGroupsCache[code].notified = true;
                } else if (!wasFull && full) {
                    await window.FocusSupabase.from('group_saved')
                        .update({ notified: false })
                        .eq('user_id', currentUser.id).eq('group_id', groupData._supaId);
                    if (_savedGroupsCache[code]) _savedGroupsCache[code].notified = false;
                }

                _savedGroupFullState[code] = full;
            }
        }

        // Kullanıcının ilgi alanlarını (Sana Özel Öneriler için) zaten yüklü
        // _myGroupsDataCache'teki (loadMyGroupsSupabase) grup kategorilerinden çıkarır.
        // Faz refactor turu: bu köprü daha önce dosya başlığında "dışa açıldı" diye
        // belgelenmişti ama satır hiç yazılmamıştı — social-institution-panel.js'teki
        // loadMyGroupsSupabase'in window.computeUserInterestCategoriesSupabase() çağrısı
        // (ve social.js'teki eşdeğer eski kod yolu) sessizce TypeError atıyordu. Gerçek bağımlılık
        // doğrulaması sırasında bulundu, burada düzeltildi.
        window.computeUserInterestCategoriesSupabase = () => computeUserInterestCategoriesSupabase();
        function computeUserInterestCategoriesSupabase() {
            // _myGroupsDataCache bare olarak bu dosyanın kapsamında yok (social.js'in kendi
            // özel kapsamında) — window.getMyGroupsDataCache() köprüsü zaten var, onu kullan
            // (ayrı bulunan bağımlılık doğrulama sırasında bulunan bir başka ReferenceError).
            userInterestCategories = new Set(
                Object.values(window.getMyGroupsDataCache ? window.getMyGroupsDataCache() : {})
                    .map((g) => g.category)
                    .filter((c) => c && GROUP_CATEGORY_LABELS[c])
            );
        }

        // Global açık grupları Supabase'den yükler/canlı tutar (loadGlobalDiscoverGroups'un Supabase karşılığı).
        let _discoverChannelSupabase = null;
        async function loadGlobalDiscoverGroupsSupabase() {
            if (!currentUser?.id) return;
            buildDiscoverCategoryTabs();

            const refresh = async () => {
                const groupsMap = await fetchPublicGroupsSupabase();
                cachedDiscoverGroupsSnapshot = _buildSnapshotLike(groupsMap);
                await loadSavedGroupsSupabase();
                computeUserInterestCategoriesSupabase();
                await checkSavedGroupSlotNotificationsSupabase();
                renderDiscoverGroups();
            };

            await refresh();

            if (_discoverChannelSupabase) {
                window.FocusSupabase.removeChannel(_discoverChannelSupabase);
                _discoverChannelSupabase = null;
            }
            _discoverChannelSupabase = window.FocusSupabase
                .channel(`discover-groups-${currentUser.id}`)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'groups' }, () => refresh())
                .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members' }, () => refresh())
                .subscribe();
        }

        // Keşfetten bir gruba katılma/katılım isteği gönderme işlemini yürütür —
        // hem kart üzerindeki "Katıl" butonu hem de tanıtım modalındaki katıl
        // butonu bu fonksiyonu kullanır.
        function performGroupJoin(targetCode, groupData, btn) {
            const setBtnLoading = (loading, html) => {
                if (!btn) return;
                btn.disabled = loading;
                if (html) btn.innerHTML = html;
            };

            if (window.isGroupFull(groupData)) {
                window.dcShowToast(`Bu grup dolu (maks. ${window.GROUP_LIMITS.MAX_MEMBERS_PER_GROUP} üye). Başka bir gruba katılmayı deneyin.`);
                return;
            }

            if (window.FocusSupabase && currentUser.id && groupData._supaId) {
                setBtnLoading(true, '<i class="fa-solid fa-spinner fa-spin"></i>');
                window.joinGroupWithCodeSupabase(groupData.code).then(async (result) => {
                    if (result.pending) {
                        document.getElementById('group-preview-modal')?.remove();
                        window.dcShowToast('Bu grup katılım onayı gerektiriyor. İsteğiniz yöneticilere iletildi, onaylandığında gruba katılacaksınız.');
                        return;
                    }
                    // Akış içerik kararı (2026-07-05): kaldırıldı.
                    if (typeof window.loadUserGroupsForDc === 'function') window.loadUserGroupsForDc();
                    if (typeof window.setupGroupRecentConversationsSupabase === 'function') window.setupGroupRecentConversationsSupabase();
                    if (_savedGroupsCache[targetCode]) {
                        await toggleSaveGroupSupabase(targetCode);
                    }
                    document.getElementById('group-preview-modal')?.remove();
                    showGroupWelcomeModal(groupData.code, groupData);
                    loadGlobalDiscoverGroupsSupabase();
                }).catch((e) => {
                    window.dcShowToast(e.message || 'Gruba katılırken hata oluştu.');
                    setBtnLoading(false, '<i class="fa-solid fa-plus"></i> Katıl');
                });
                return;
            }
        }

        // Gruba katılım başarılı olduğunda gösterilen "Hoşgeldin" karşılama modalı —
        // tanıtım modalındaki temel bilgilerin bir kısmını tekrarlayarak tutarlılık sağlar
        function showGroupWelcomeModal(groupCode, groupData) {
            document.getElementById('group-preview-modal')?.remove();
            document.getElementById('group-welcome-modal')?.remove();

            const esc = _escapeHtml;
            const categoryTag = (groupData.category && GROUP_CATEGORY_LABELS[groupData.category])
                ? GROUP_CATEGORY_LABELS[groupData.category]
                : null;

            const overlay = document.createElement('div');
            overlay.id = 'group-welcome-modal';
            overlay.className = 'focusai-confirm-overlay';
            overlay.innerHTML = `
                <div class="focusai-confirm-box" style="max-width:440px; width:90%; text-align:center; position:relative; padding:28px;">
                    <div style="font-size:42px; margin-bottom:10px;">🎉</div>
                    <h2 style="font-size:19px; margin:0 0 8px 0; color:#fff;">"${esc(groupData.name || '')}" Topluluğuna Hoş Geldin!</h2>
                    <p style="color:var(--text-muted); font-size:13px; line-height:1.5; margin:0 0 16px 0;">${esc(groupData.description || 'Bu topluluğun bir parçası oldun. Hedeflerine birlikte ulaşın!')}</p>

                    <div style="display:flex; gap:10px; margin-bottom:18px;">
                        <div class="glass-panel si-flex1-pad">
                            <div class="si-header-title">${groupData.weeklyGoal || 0}</div>
                            <div class="si-meta"><i class="fa-solid fa-bullseye"></i> dk/hafta hedef</div>
                        </div>
                        ${categoryTag ? `
                        <div class="glass-panel si-flex1-pad">
                            <div class="si-header-title">${categoryTag}</div>
                            <div class="si-meta"><i class="fa-solid fa-tag"></i> Kategori</div>
                        </div>` : ''}
                    </div>

                    <p style="font-size:12px; color:var(--text-muted); margin:0 0 18px 0;">
                        <i class="fa-solid fa-circle-info"></i> Metin kanallarından sohbet edebilir, üyelerle birlikte odaklanma seanslarına katılabilir ve grup hedefine katkı sağlayabilirsin.
                    </p>

                    <button id="gwm-start-btn" class="primary-btn" style="width:100%; padding:12px; font-size:14px;"><i class="fa-solid fa-rocket"></i> Başlayalım</button>
                </div>
            `;

            document.body.appendChild(overlay);

            const close = () => overlay.remove();
            overlay.querySelector('#gwm-start-btn')?.addEventListener('click', close);
            overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
        }
        window.showGroupWelcomeModal = showGroupWelcomeModal;

        // Bir grubun "tanıtım" modalını açar — gruba henüz üye olmayan kullanıcıya
        // gruba neden katılması gerektiğini gösteren bilgi kartı (Keşfet kartına tıklayınca açılır)
        function showGroupPreviewModal(groupCode, groupData) {
            document.getElementById('group-preview-modal')?.remove();

            const esc = _escapeHtml;
            const memberEntries = Object.entries(groupData.members || {});
            const memberCount = memberEntries.length;
            const isFull = window.isGroupFull(groupData);
            const categoryTag = (groupData.category && GROUP_CATEGORY_LABELS[groupData.category])
                ? GROUP_CATEGORY_LABELS[groupData.category]
                : null;
            const isNew = groupData.createdAt && (Date.now() - groupData.createdAt <= 48 * 3600 * 1000);

            // Kuruluş tarihini "X gün önce" biçiminde göster
            let createdAgoText = '';
            if (groupData.createdAt) {
                const diffDays = Math.floor((Date.now() - groupData.createdAt) / (24 * 3600 * 1000));
                if (diffDays <= 0) createdAgoText = 'Bugün kuruldu';
                else if (diffDays === 1) createdAgoText = 'Dün kuruldu';
                else createdAgoText = `${diffDays} gün önce kuruldu`;
            }

            const ownerUsername = groupData.createdBy;
            const ownerData = ownerUsername ? groupData.members?.[ownerUsername] : null;
            const ownerName = ownerData?.displayName || ownerUsername || 'Bilinmiyor';

            const activeNow = computeActiveNowCount(groupData);
            const isSaved = !!_savedGroupsCache[groupCode];

            // İlk birkaç üyenin avatarını göster (sosyal kanıt)
            const AVATAR_PREVIEW_LIMIT = 8;
            const avatarsHtml = memberEntries.slice(0, AVATAR_PREVIEW_LIMIT).map(([uname, m]) => {
                const initial = (m.displayName || uname).charAt(0).toUpperCase();
                const color = m.avatarColor || '6c5ce7';
                return `<div title="${esc(m.displayName || uname)}" style="width:34px; height:34px; border-radius:50%; background:#${color}; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:700; color:#fff; border:2px solid rgba(20,20,35,0.9); margin-left:-8px; flex-shrink:0;">${esc(initial)}</div>`;
            }).join('');
            const extraCount = memberCount - Math.min(memberCount, AVATAR_PREVIEW_LIMIT);
            const extraAvatarHtml = extraCount > 0
                ? `<div style="width:34px; height:34px; border-radius:50%; background:rgba(255,255,255,0.08); display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700; color:var(--text-muted); border:2px solid rgba(20,20,35,0.9); margin-left:-8px; flex-shrink:0;">+${extraCount}</div>`
                : '';

            let footerBtnHtml;
            if (isFull) {
                footerBtnHtml = `<button class="primary-btn" disabled style="width:100%; padding:12px; font-size:14px; background: rgba(255,255,255,0.04); color: var(--text-muted); border: 1px solid rgba(255,255,255,0.06); cursor: not-allowed;"><i class="fa-solid fa-lock"></i> Grup Dolu</button>`;
            } else if (groupData.requireApproval) {
                footerBtnHtml = `<button id="gpm-join-btn" class="primary-btn" style="width:100%; padding:12px; font-size:14px; background: rgba(116, 185, 255, 0.15); color: #74b9ff; border: 1px solid rgba(116, 185, 255, 0.3);"><i class="fa-solid fa-paper-plane"></i> Katılım İsteği Gönder</button>`;
            } else {
                footerBtnHtml = `<button id="gpm-join-btn" class="primary-btn" style="width:100%; padding:12px; font-size:14px; background: rgba(46, 213, 115, 0.15); color: #2ed573; border: 1px solid rgba(46, 213, 115, 0.3);"><i class="fa-solid fa-arrow-right-to-bracket"></i> Gruba Katıl</button>`;
            }

            const overlay = document.createElement('div');
            overlay.id = 'group-preview-modal';
            overlay.className = 'focusai-confirm-overlay';
            overlay.innerHTML = `
                <div class="focusai-confirm-box" style="max-width:440px; width:90%; text-align:left; position:relative; padding:24px;">
                    <button id="gpm-close-btn" style="position:absolute; top:12px; right:14px; background:none; border:none; color:var(--text-muted); font-size:18px; cursor:pointer; line-height:1;">&times;</button>
                    <button id="gpm-save-btn" title="${isSaved ? 'Kaydedildi' : 'Sonra bakmak için kaydet'}" style="position:absolute; top:12px; right:42px; background:none; border:none; color:${isSaved ? '#ffd166' : 'var(--text-muted)'}; font-size:18px; cursor:pointer; line-height:1;"><i class="fa-${isSaved ? 'solid' : 'regular'} fa-star"></i></button>

                    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:6px;">
                        ${categoryTag ? `<span class="discover-category-tag">${categoryTag}</span>` : ''}
                        ${isNew ? `<span class="discover-new-badge">Yeni</span>` : ''}
                        ${groupData.requireApproval ? `<span style="font-size:11px; padding:2px 8px; border-radius:6px; background:rgba(255,159,67,0.15); color:#ff9f43; border:1px solid rgba(255,159,67,0.3);"><i class="fa-solid fa-lock"></i> Onaylı Katılım</span>` : `<span style="font-size:11px; padding:2px 8px; border-radius:6px; background:rgba(46,213,115,0.1); color:#2ed573; border:1px solid rgba(46,213,115,0.25);"><i class="fa-solid fa-globe"></i> Herkese Açık</span>`}
                        ${activeNow > 0 ? `<span style="font-size:11px; padding:2px 8px; border-radius:6px; background:rgba(46,213,115,0.1); color:#2ed573; border:1px solid rgba(46,213,115,0.25);"><i class="fa-solid fa-circle" style="font-size:8px;"></i> ${activeNow} aktif</span>` : ''}
                    </div>

                    <h2 style="font-size:20px; margin:0 0 8px 0; color:#fff;">${esc(groupData.name || '')}</h2>
                    <p style="color:var(--text-muted); font-size:13px; line-height:1.5; margin:0 0 16px 0;">${esc(groupData.description || 'Bu grup için henüz bir açıklama eklenmemiş.')}</p>

                    <div style="display:flex; gap:10px; margin-bottom:16px;">
                        <div class="glass-panel si-flex1-pad">
                            <div class="si-header-title">${memberCount}/${window.GROUP_LIMITS.MAX_MEMBERS_PER_GROUP}</div>
                            <div class="si-meta"><i class="fa-solid fa-users"></i> Üye</div>
                        </div>
                        <div class="glass-panel si-flex1-pad">
                            <div class="si-header-title">${groupData.weeklyGoal || 0}</div>
                            <div class="si-meta"><i class="fa-solid fa-bullseye"></i> dk/hafta hedef</div>
                        </div>
                        <div class="glass-panel si-flex1-pad">
                            <div class="si-header-title"><i class="fa-solid fa-crown" style="color:#ffd166;"></i></div>
                            <div style="font-size:11px; color:var(--text-muted); margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${esc(ownerName)}">@${esc(ownerName)}</div>
                        </div>
                    </div>

                    ${memberCount > 0 ? `
                    <div style="display:flex; align-items:center; margin-bottom:6px; padding-left:8px;">
                        ${avatarsHtml}${extraAvatarHtml}
                    </div>` : ''}
                    ${createdAgoText ? `<div style="font-size:11px; color:var(--text-muted); margin-bottom:18px;"><i class="fa-regular fa-clock"></i> ${createdAgoText}</div>` : '<div style="margin-bottom:18px;"></div>'}

                    ${footerBtnHtml}
                </div>
            `;

            document.body.appendChild(overlay);

            const close = () => overlay.remove();
            overlay.querySelector('#gpm-close-btn')?.addEventListener('click', close);
            overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

            overlay.querySelector('#gpm-join-btn')?.addEventListener('click', (e) => {
                performGroupJoin(groupCode, groupData, e.currentTarget);
            });

            overlay.querySelector('#gpm-save-btn')?.addEventListener('click', (e) => {
                toggleSaveGroup(groupCode);
                const nowSaved = !_savedGroupsCache[groupCode];
                const icon = e.currentTarget.querySelector('i');
                if (icon) icon.className = `fa-${nowSaved ? 'solid' : 'regular'} fa-star`;
                e.currentTarget.style.color = nowSaved ? '#ffd166' : 'var(--text-muted)';
                e.currentTarget.title = nowSaved ? 'Kaydedildi' : 'Sonra bakmak için kaydet';
            });
        }
        window.showGroupPreviewModal = showGroupPreviewModal;

        // Bildirim panelinden "Kaydettiklerim" listesindeki bir gruba tıklayınca tanıtım modalını aç
        window.openSavedGroupPreview = function (groupCode) {
            if (!cachedDiscoverGroupsSnapshot) return;
            const gSnap = cachedDiscoverGroupsSnapshot.child(groupCode);
            if (gSnap.exists()) showGroupPreviewModal(groupCode, gSnap.val());
        };

        // Tek bir keşfet kartı oluşturur (öneriler ve ana liste için ortak)
        function createDiscoverCard(groupCode, groupData) {
            const memberCount = groupData.members ? Object.keys(groupData.members).length : 0;
            const isFull = window.isGroupFull(groupData);
            const isNew = groupData.createdAt && (Date.now() - groupData.createdAt <= 48 * 3600 * 1000);
            const newBadge = isNew ? `<span class="discover-new-badge">Yeni</span>` : "";
            const categoryTag = (groupData.category && GROUP_CATEGORY_LABELS[groupData.category])
                ? `<span class="discover-category-tag">${GROUP_CATEGORY_LABELS[groupData.category]}</span>`
                : "";
            const activeNow = computeActiveNowCount(groupData);
            const activeNowHtml = activeNow > 0
                ? ` · <span class="si-green"><i class="fa-solid fa-circle" style="font-size:7px;"></i> ${activeNow} aktif</span>`
                : "";
            const isSaved = !!_savedGroupsCache[groupCode];

            const discoverCard = document.createElement("div");
            discoverCard.className = "glass-panel discover-group-card";
            discoverCard.innerHTML = `
                ${groupAvatarHtml(groupCode, groupData.name, 40)}
                <div class="discover-card-body">
                    <div class="discover-card-name-row">
                        <h4 class="discover-card-name">${_escapeHtml(groupData.name)}</h4>
                        ${categoryTag}
                        ${newBadge}
                    </div>
                    <div class="discover-card-meta">
                        <i class="fa-solid fa-users"></i> ${memberCount}/${window.GROUP_LIMITS.MAX_MEMBERS_PER_GROUP} · <i class="fa-solid fa-bullseye"></i> ${groupData.weeklyGoal} dk${activeNowHtml}
                    </div>
                </div>
                <div class="discover-card-actions">
                    <button class="discover-save-btn" data-code="${groupCode}" title="${isSaved ? 'Kaydedildi' : 'Sonra bakmak için kaydet'}" style="background: ${isSaved ? 'rgba(255,209,102,0.12)' : 'rgba(255,255,255,0.04)'}; color: ${isSaved ? '#ffd166' : 'var(--text-muted)'}; border: 1px solid ${isSaved ? 'rgba(255,209,102,0.3)' : 'rgba(255,255,255,0.06)'};">
                        <i class="fa-${isSaved ? 'solid' : 'regular'} fa-star"></i>
                    </button>
                    ${isFull
                        ? `<button class="primary-btn" disabled style="padding: 5px 12px; font-size: 11px; background: rgba(255,255,255,0.04); color: var(--text-muted); border: 1px solid rgba(255,255,255,0.06); cursor: not-allowed;">
                            <i class="fa-solid fa-lock"></i> Dolu
                        </button>`
                        : `<button class="primary-btn quick-join-discover-btn" data-code="${groupCode}" style="padding: 5px 12px; font-size: 11px; background: rgba(46, 213, 115, 0.15); color: #2ed573; border: 1px solid rgba(46, 213, 115, 0.3);">
                            <i class="fa-solid fa-plus"></i> Katıl
                        </button>`
                    }
                </div>
            `;

            // Karta tıklayınca grubun tanıtım modalını aç
            discoverCard.addEventListener("click", () => {
                showGroupPreviewModal(groupCode, groupData);
            });

            // Hızlı Katıl Buton Motoru
            const joinBtn = discoverCard.querySelector(".quick-join-discover-btn");
            joinBtn?.addEventListener("click", (e) => {
                e.stopPropagation(); // Kart tıklamasını (modal açılmasını) engelle
                performGroupJoin(groupCode, groupData, e.currentTarget);
            });

            // Kaydet/Kaydı kaldır butonu
            const saveBtn = discoverCard.querySelector(".discover-save-btn");
            saveBtn?.addEventListener("click", (e) => {
                e.stopPropagation();
                toggleSaveGroup(groupCode);
            });

            return discoverCard;
        }

        // Kategori sekmelerini oluşturur (bir kez çağrılır)
        function buildDiscoverCategoryTabs() {
            const tabsContainer = document.getElementById("discover-category-tabs");
            if (!tabsContainer || tabsContainer.childElementCount > 0) return;

            const tabs = [{ key: "all", label: "Tümü" }];
            Object.keys(GROUP_CATEGORY_LABELS).forEach((key) => tabs.push({ key, label: GROUP_CATEGORY_LABELS[key] }));

            tabs.forEach((tab) => {
                const pill = document.createElement("button");
                pill.className = "discover-category-pill" + (tab.key === activeDiscoverCategory ? " active" : "");
                pill.textContent = tab.label;
                pill.dataset.category = tab.key;
                pill.addEventListener("click", () => {
                    activeDiscoverCategory = tab.key;
                    tabsContainer.querySelectorAll(".discover-category-pill").forEach((p) => p.classList.remove("active"));
                    pill.classList.add("active");
                    renderDiscoverGroups();
                });
                tabsContainer.appendChild(pill);
            });

            // Sol/sağ ok butonlarıyla kaydırma
            const scrollLeftBtn = document.getElementById("discover-tabs-scroll-left");
            const scrollRightBtn = document.getElementById("discover-tabs-scroll-right");
            scrollLeftBtn?.addEventListener("click", () => tabsContainer.scrollBy({ left: -100, behavior: "smooth" }));
            scrollRightBtn?.addEventListener("click", () => tabsContainer.scrollBy({ left: 100, behavior: "smooth" }));
        }

        // Keşfet sıralama/filtre kontrollerini bağlar (bir kez çağrılır)
        function setupDiscoverFilterControls() {
            const sortSelect = document.getElementById("discover-sort-select");
            const slotChip = document.getElementById("discover-filter-slot");
            const activeChip = document.getElementById("discover-filter-active");
            if (!sortSelect || sortSelect.dataset.bound) return;
            sortSelect.dataset.bound = "1";

            sortSelect.value = discoverSortMode;
            sortSelect.addEventListener("change", () => {
                discoverSortMode = sortSelect.value;
                renderDiscoverGroups();
            });

            slotChip?.addEventListener("click", () => {
                discoverFilterHasSlot = !discoverFilterHasSlot;
                slotChip.dataset.active = String(discoverFilterHasSlot);
                renderDiscoverGroups();
            });

            activeChip?.addEventListener("click", () => {
                discoverFilterActiveOnly = !discoverFilterActiveOnly;
                activeChip.dataset.active = String(discoverFilterActiveOnly);
                renderDiscoverGroups();
            });
        }

        // "Kaydettiklerim" bölümünü çizer — kullanıcının "sonra bakarım" diye işaretlediği gruplar
        function renderSavedGroupsSection() {
            const savedContainer = document.getElementById("discover-saved-groups");
            if (!savedContainer || !currentUser || !cachedDiscoverGroupsSnapshot) return;

            savedContainer.innerHTML = "";
            const savedCodes = Object.keys(_savedGroupsCache);
            if (savedCodes.length === 0) return;

            const cardsToShow = [];
            savedCodes.forEach((code) => {
                const gSnap = cachedDiscoverGroupsSnapshot.child(code);
                if (!gSnap.exists()) {
                    if (window.FocusSupabase && currentUser.id && _savedGroupsCache[code]?.groupId) {
                        window.FocusSupabase.from('group_saved').delete()
                            .eq('user_id', currentUser.id).eq('group_id', _savedGroupsCache[code].groupId).then(() => {});
                    }
                    return;
                }
                const groupData = gSnap.val();
                const isAlreadyMember = groupData.members && groupData.members[currentUser.username];
                if (isAlreadyMember) {
                    const _supaGroupId = groupData._supaId || _savedGroupsCache[code]?.groupId;
                    if (window.FocusSupabase && currentUser.id && _supaGroupId) {
                        window.FocusSupabase.from('group_saved').delete()
                            .eq('user_id', currentUser.id).eq('group_id', _supaGroupId).then(() => {});
                    }
                    return;
                }
                cardsToShow.push({ code, groupData });
            });

            if (cardsToShow.length === 0) return;

            const title = document.createElement("div");
            title.className = "discover-recommendations-title";
            title.innerHTML = `⭐ Kaydettiklerim`;
            savedContainer.appendChild(title);
            cardsToShow.forEach(({ code, groupData }) => savedContainer.appendChild(createDiscoverCard(code, groupData)));
        }

        // Önbelleğe alınmış grup verisinden Keşfet listesini ve önerileri çizer
        // (aynı eksik-köprü bulgusu: window.renderDiscoverGroups da yazılmamıştı.)
        window.renderDiscoverGroups = () => renderDiscoverGroups();
        function renderDiscoverGroups() {
            const discoverContainer = document.getElementById("global-discover-groups");
            const recommendationsContainer = document.getElementById("discover-recommendations");
            if (!discoverContainer || !currentUser || !cachedDiscoverGroupsSnapshot) return;

            discoverContainer.innerHTML = "";
            if (recommendationsContainer) recommendationsContainer.innerHTML = "";
            renderSavedGroupsSection();
            setupDiscoverFilterControls();

            const candidates = [];
            cachedDiscoverGroupsSnapshot.forEach((gSnap) => {
                const groupCode = gSnap.key;
                const groupData = gSnap.val();
                const isPublic = groupData.privacy === "public";
                const isAlreadyMember = groupData.members && groupData.members[currentUser.username];
                if (isPublic && !isAlreadyMember) {
                    candidates.push({ groupCode, groupData });
                }
            });

            if (candidates.length === 0) {
                discoverContainer.innerHTML = `<p style="color:var(--text-muted); font-size:12px; text-align:center; padding:15px; margin:0;">Keşfedilecek açık grup bulunamadı.</p>`;
                if (recommendationsContainer) recommendationsContainer.style.display = "none";
                return;
            }

            // Sana Özel Öneriler (4'er gruplu, "Farklı Öneriler Göster" ile döngüsel kayar)
            const recommended = candidates.filter((c) => c.groupData.category && userInterestCategories.has(c.groupData.category));
            const RECOMMENDATION_COUNT = 4;
            let recommendedSlice = [];
            if (recommended.length > 0) {
                if (recommendationsOffset >= recommended.length) recommendationsOffset = 0;
                for (let i = 0; i < Math.min(RECOMMENDATION_COUNT, recommended.length); i++) {
                    recommendedSlice.push(recommended[(recommendationsOffset + i) % recommended.length]);
                }
            }
            const recommendedCodes = new Set(recommendedSlice.map((c) => c.groupCode));

            if (recommendationsContainer) {
                if (recommendedSlice.length > 0) {
                    recommendationsContainer.style.display = "block";
                    const title = document.createElement("div");
                    title.className = "discover-recommendations-title";
                    title.innerHTML = `✨ Sana Özel Öneriler`;
                    recommendationsContainer.appendChild(title);
                    recommendedSlice.forEach((c) => recommendationsContainer.appendChild(createDiscoverCard(c.groupCode, c.groupData)));

                    if (recommended.length > RECOMMENDATION_COUNT) {
                        const refreshBtn = document.createElement("button");
                        refreshBtn.className = "discover-refresh-recommendations-btn";
                        refreshBtn.innerHTML = `<i class="fa-solid fa-rotate"></i> Farklı Öneriler Göster`;
                        refreshBtn.addEventListener("click", () => {
                            recommendationsOffset = (recommendationsOffset + RECOMMENDATION_COUNT) % recommended.length;
                            renderDiscoverGroups();
                        });
                        recommendationsContainer.appendChild(refreshBtn);
                    }
                } else {
                    recommendationsContainer.style.display = "none";
                }
            }

            // Ana liste
            let mainList;
            if (activeDiscoverCategory === "all") {
                mainList = candidates.filter((c) => !recommendedCodes.has(c.groupCode));
            } else {
                mainList = candidates.filter((c) => c.groupData.category === activeDiscoverCategory);
            }

            // "Boş Yer Var" ve "Şu An Aktif" filtreleri
            if (discoverFilterHasSlot) {
                mainList = mainList.filter((c) => !window.isGroupFull(c.groupData));
            }
            if (discoverFilterActiveOnly) {
                mainList = mainList.filter((c) => computeActiveNowCount(c.groupData) > 0);
            }

            if (mainList.length === 0) {
                discoverContainer.innerHTML = `<p style="color:var(--text-muted); font-size:12px; text-align:center; padding:15px; margin:0;">${(discoverFilterHasSlot || discoverFilterActiveOnly) ? "Filtrelere uyan grup bulunamadı." : "Katılabileceğiniz açık grup kalmadı 🏔️"}</p>`;
                return;
            }

            // Sıralama
            const memberCount = (g) => g.members ? Object.keys(g.members).length : 0;
            if (discoverSortMode === "members-desc") {
                mainList = [...mainList].sort((a, b) => memberCount(b.groupData) - memberCount(a.groupData));
            } else if (discoverSortMode === "members-asc") {
                mainList = [...mainList].sort((a, b) => memberCount(a.groupData) - memberCount(b.groupData));
            } else if (discoverSortMode === "active-desc") {
                mainList = [...mainList].sort((a, b) => computeActiveNowCount(b.groupData) - computeActiveNowCount(a.groupData));
            }

            // Listede en fazla DISCOVER_MAIN_COUNT grup gösterilir; "Farklı Gruplar Göster" ile döngüsel kayar
            if (discoverMainOffset >= mainList.length) discoverMainOffset = 0;
            const mainSlice = [];
            for (let i = 0; i < Math.min(DISCOVER_MAIN_COUNT, mainList.length); i++) {
                mainSlice.push(mainList[(discoverMainOffset + i) % mainList.length]);
            }
            mainSlice.forEach((c) => discoverContainer.appendChild(createDiscoverCard(c.groupCode, c.groupData)));

            if (mainList.length > DISCOVER_MAIN_COUNT) {
                const refreshBtn = document.createElement("button");
                refreshBtn.className = "discover-refresh-recommendations-btn";
                refreshBtn.innerHTML = `<i class="fa-solid fa-rotate"></i> Farklı Gruplar Göster`;
                refreshBtn.addEventListener("click", () => {
                    discoverMainOffset = (discoverMainOffset + DISCOVER_MAIN_COUNT) % mainList.length;
                    renderDiscoverGroups();
                });
                discoverContainer.appendChild(refreshBtn);
            }
        }

        // Kullanıcı giriş yaptıktan sonra hem kendi gruplarını hem global açık grupları yükler
        const checkUserInterval = setInterval(() => {
            if (typeof currentUser !== "undefined" && currentUser !== null) {
                window.loadMyGroups();
                loadGlobalDiscoverGroupsSupabase();
                clearInterval(checkUserInterval);
            }
        }, 1000);
