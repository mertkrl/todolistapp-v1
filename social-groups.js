import { _resolveProfileById } from './social-dc-profile-resolve.js';
import { setupGroupRecentConversationsSupabase } from './social-dm-notifications.js';

import { showGroupWelcomeModal } from './social-group-discover.js';
import { getCurrentUser } from './state/current-user-store.js';
import { generateGroupCode } from './social-misc-pure-utils.js';
import { formatCooldownRemaining } from './social-groups-pure-utils.js';
// ─── GERÇEK ZAMANLI GRUPLAR (GROUPS SYSTEM) ────────────────────────
// social.js dosyasından çıkarıldı (Faz 6): limit/cooldown hesaplama,
// grup oluşturma ve koda göre gruba katılma mantığı.
//
// Dış bağımlılıklar:
// - getCurrentUser() / window.FocusSupabase / window._resolveProfileById /
//   window.dcShowToast / window.showGroupWelcomeModal → zaten global
// - generateGroupCode → social.js'te kalıyor, zaten window.* değil ama
//   bu dosyada da bare çağrılabiliyor çünkü script sırası social.js'ten
//   SONRA (aynı global scope'ta fonksiyon tanımı, hoisting geçerli değil
//   modüller arası — bu yüzden generateGroupCode köprüsü eklendi)
// - syncSidebarGroupList / setupGroupRecentConversationsSupabase →
//   window.* köprüsü (social.js'te zaten export ediliyorlardı)
// - getMyRoomCapacity → social.js'teki Ortak Odaklanma kodu (satır ~4568)
//   window.getMyRoomCapacity() üzerinden bu dosyadaki fonksiyonu çağırıyor
// - createGroupSupabase → social.js'teki grup oluşturma modalı
//   window.createGroupSupabase() üzerinden bu dosyadaki fonksiyonu çağırıyor
    // Ücretsiz sunucu kotalarını korumak için grup sınırları
    const GROUP_LIMITS = {
        // Plan bazlı limitler getMyGroupLimits()'te — buradaki üye sayısı yalnızca
        // max_members kolonu boş olan eski gruplar için geriye dönük varsayılandır.
        MAX_MEMBERS_PER_GROUP: 15,
        REJOIN_COOLDOWN_MS: 24 * 60 * 60 * 1000, // Bir gruptan ayrıldıktan sonra aynı gruba tekrar katılabilmek için beklenmesi gereken süre (24 saat)
        CREATE_COOLDOWN_MS: 10 * 60 * 1000 // Art arda grup oluşturma/silme döngüsünü önlemek için iki grup kurma arasındaki minimum süre (10 dakika)
    };
    window.GROUP_LIMITS = GROUP_LIMITS; // Faz 5: social-group-discover.js için (Kurum Paneli/Keşfet çıkarması)

    // Freemium modeli (2026-07-02): grup kurma herkese açık, plan kapasiteyi belirler.
    // Üye kapasitesi kurulma anında grubun max_members kolonuna yazılır (044) —
    // katılan kişi değil, KURAN kişinin planı grubu belirler.
    function getMyGroupLimits() {
        const inst = !!getCurrentUser() && ['student', 'teacher'].includes(getCurrentUser().institutionRole);
        const premium = inst || getCurrentUser()?.plan === 'premium';
        return {
            maxCreated: inst ? 10 : premium ? 5 : 1,
            maxJoined:  premium ? 10 : 5,
            maxMembers: inst ? 100 : premium ? 30 : 10,
            planLabel:  inst ? 'kurumsal' : premium ? 'premium' : 'ücretsiz'
        };
    }

    // "Birlikte Odaklanma" oda kapasitesi — ücretsizde 1'e 1 (2 kişi), ücretli
    // planlarda daha kalabalık gruplar (gruplardaki maxMembers ile aynı üst
    // sınır). Oda oluşturulurken bu değer cw_rooms.max_participants'a
    // snapshot'lanır; sonradan plan değişse de oda kapasitesi sabit kalır.
    window.getMyRoomCapacity = getMyRoomCapacity; // social.js'teki Ortak Odaklanma kodu için
    function getMyRoomCapacity() {
        const inst = !!getCurrentUser() && ['student', 'teacher'].includes(getCurrentUser().institutionRole);
        const premium = inst || getCurrentUser()?.plan === 'premium';
        return inst ? 100 : premium ? 30 : 2;
    }

    // Kullanıcının üye olduğu grup sayısını döner
    function getUserJoinedGroupsCount() {
        if (window.FocusSupabase && getCurrentUser()?.id) {
            return window.FocusSupabase.from('group_members')
                .select('*', { count: 'exact', head: true }).eq('user_id', getCurrentUser().id)
                .then(({ count }) => count || 0).catch(() => 0);
        }
        return Promise.resolve(0);
    }

    // Kullanıcı bir gruptan ayrıldığında ayrılma anını kaydeder
    async function recordGroupLeaveCooldown(groupCode) {
        if (!getCurrentUser()) return;
        if (window.FocusSupabase && getCurrentUser().id) {
            const groupId = await _resolveGroupIdByCode(groupCode);
            if (groupId) {
                await window.FocusSupabase.from('group_leave_log')
                    .upsert({ user_id: getCurrentUser().id, group_id: groupId, left_at: new Date().toISOString() },
                        { onConflict: 'user_id,group_id' }).catch(() => {});
            }
            return;
        }
    }
    window.recordGroupLeaveCooldown = recordGroupLeaveCooldown;

    // group_id önbelleği: kod → uuid
    const _groupIdByCode = {};
    async function _resolveGroupIdByCode(code) {
        if (!code || !window.FocusSupabase) return null;
        if (_groupIdByCode[code]) return _groupIdByCode[code];
        const { data } = await window.FocusSupabase.from('groups').select('id').eq('code', code.toUpperCase()).maybeSingle();
        if (data?.id) _groupIdByCode[code] = data.id;
        return data?.id || null;
    }

    // Kullanıcının bir gruba tekrar katılabilmesi için kalan süreyi (ms) döner — 0 ise bekleme yok
    async function getGroupRejoinCooldownRemaining(groupCode) {
        if (!getCurrentUser()) return 0;
        if (window.FocusSupabase && getCurrentUser().id) {
            const groupId = await _resolveGroupIdByCode(groupCode);
            if (!groupId) return 0;
            const { data } = await window.FocusSupabase.from('group_leave_log').select('left_at')
                .eq('user_id', getCurrentUser().id).eq('group_id', groupId).maybeSingle();
            if (!data?.left_at) return 0;
            const remaining = GROUP_LIMITS.REJOIN_COOLDOWN_MS - (Date.now() - new Date(data.left_at).getTime());
            return remaining > 0 ? remaining : 0;
        }
        return 0;
    }

    // Grup oluşturma cooldown — localStorage'da tutulur (sunucu taraflı değil)
    function recordGroupCreateCooldown() {
        if (!getCurrentUser()) return Promise.resolve();
        localStorage.setItem(`focusai_group_create_cooldown_${getCurrentUser().username}`, String(Date.now()));
        return Promise.resolve();
    }

    function getGroupCreateCooldownRemaining() {
        if (!getCurrentUser()) return Promise.resolve(0);
        const stored = parseInt(localStorage.getItem(`focusai_group_create_cooldown_${getCurrentUser().username}`) || '0');
        if (!stored) return Promise.resolve(0);
        const remaining = GROUP_LIMITS.CREATE_COOLDOWN_MS - (Date.now() - stored);
        return Promise.resolve(remaining > 0 ? remaining : 0);
    }

    // Bir grubun üye limitine ulaşıp ulaşmadığını kontrol eder
    // (kapasite grubun max_members kolonundan gelir — kuranın planı belirler)
    window.isGroupFull = (groupData) => isGroupFull(groupData); // Faz 6: social-group-discover.js için
    function isGroupFull(groupData) {
        const memberCount = groupData.members ? Object.keys(groupData.members).length : 0;
        return memberCount >= (groupData.maxMembers || GROUP_LIMITS.MAX_MEMBERS_PER_GROUP);
    }

    // ──────────────────────────────────────────────────────
    // SUPABASE: GRUPLAR (M2b-2 Bölüm 1)
    // ──────────────────────────────────────────────────────

    // Supabase `groups` satırı + `group_members` satırlarını eski (Firebase)
    // groupData şekline çevirir — showGroupDetails/loadMyGroups/computeActiveNowCount/
    // isGroupFull/groupAvatarHtml bu şekli bekler ve değişmeden çalışır.
    async function _normalizeSupabaseGroup(groupRow, memberRows) {
        const members = {};
        for (const mr of (memberRows || [])) {
            const profile = mr.profiles || await _resolveProfileById(mr.user_id);
            if (!profile) continue;
            members[profile.username] = {
                userId: mr.user_id,
                displayName: profile.display_name || profile.username,
                avatarColor: profile.avatar_color || '6c5ce7',
                customAvatar: profile.custom_avatar || null, avatarInitials: profile.avatar_initials || null,
                joinedAt: mr.joined_at ? new Date(mr.joined_at).getTime() : Date.now(),
                role: mr.role || undefined,
                classSectionId: mr.class_section_id || null
            };
        }

        let createdByUsername = getCurrentUser()?.username;
        if (groupRow.created_by !== getCurrentUser()?.id) {
            const creatorProfile = await _resolveProfileById(groupRow.created_by);
            createdByUsername = creatorProfile ? creatorProfile.username : groupRow.created_by;
        }

        return {
            _supaId: groupRow.id,
            code: groupRow.code,
            name: groupRow.name,
            description: groupRow.description || '',
            weeklyGoal: groupRow.weekly_goal,
            privacy: groupRow.privacy,
            category: groupRow.category,
            classroomType: groupRow.classroom_type || 'general',
            institutionName: groupRow.institution_name || null,
            institutionId: groupRow.institution_id || null,
            gradeLevel: groupRow.grade_level || null,
            maxMembers: groupRow.max_members || null,
            requireApproval: groupRow.require_approval,
            createdBy: createdByUsername,
            createdAt: groupRow.created_at ? new Date(groupRow.created_at).getTime() : Date.now(),
            announcement: groupRow.announcement || null,
            builtinRoleOverrides: groupRow.builtin_role_overrides || null,
            members
        };
    }
    // Farklı (kardeş) IIFE kapsamındaki sidebar grup ağacı kodu (loadUserGroupsForDc)
    // için global erişim.
    window._normalizeSupabaseGroup = _normalizeSupabaseGroup;

    // Yeni grup oluşturur: limit/cooldown kontrolleri + `groups`/`group_members` insert.
    // Hata durumunda mesajıyla birlikte throw eder (çağıran alert ile gösterir).
    window.createGroupSupabase = createGroupSupabase; // social.js'teki grup oluşturma modalı için
    async function createGroupSupabase(gName, gDesc, gGoal, gPrivacy, gCategory, gClassroomType = 'general', gInstitution = null, gGrade = null) {
        // Oturum senkron kontrolü: RLS "created_by = auth.uid()" kontrolüne dayanıyor.
        // getCurrentUser().id ile gerçek oturumun kimliği farklıysa (örn. sekme uzun süre açık
        // kalıp token yenilenmiş, ya da hesap değiştirilmiş ama getCurrentUser() eski kalmış),
        // insert cryptic bir "row-level security" hatasıyla sessizce başarısız olur —
        // burada erkenden yakalayıp anlaşılır bir hata veriyoruz.
        const { data: authData, error: authErr } = await window.FocusSupabase.auth.getUser();
        if (authErr || !authData?.user) {
            throw new Error('Oturumun sona ermiş görünüyor. Lütfen sayfayı yenileyip tekrar giriş yap.');
        }
        if (authData.user.id !== getCurrentUser().id) {
            throw new Error('Oturum bilgisi güncel değil (hesap uyuşmazlığı). Lütfen sayfayı yenile ve tekrar dene.');
        }

        const { count, error: countErr } = await window.FocusSupabase
            .from('groups')
            .select('id', { count: 'exact', head: true })
            .eq('created_by', getCurrentUser().id);
        if (countErr) throw countErr;
        const limits = getMyGroupLimits();
        if ((count || 0) >= limits.maxCreated) {
            throw new Error(limits.maxCreated === 1
                ? 'Ücretsiz planda 1 grup kurabilirsin. Daha fazla grup (ve grup sohbeti) için Premium\'a geç ya da mevcut grubunu sil.'
                : `En fazla ${limits.maxCreated} grup kurabilirsiniz. Yeni bir grup kurmak için önce mevcut gruplarınızdan birini silin.`);
        }

        const { data: profRow } = await window.FocusSupabase
            .from('profiles').select('last_group_created_at').eq('id', getCurrentUser().id).maybeSingle();
        if (profRow && profRow.last_group_created_at) {
            const remaining = GROUP_LIMITS.CREATE_COOLDOWN_MS - (Date.now() - new Date(profRow.last_group_created_at).getTime());
            if (remaining > 0) {
                throw new Error(`Yeni bir grup kurmak için ${formatCooldownRemaining(remaining)} beklemelisiniz.`);
            }
        }

        // Sınıf (classroom) tipi gruplar yalnızca öğretmen tarafından, tekil bir
        // `institutions` kaydına bağlı olarak açılabilir — okul/dershane kaydı
        // budur (aynı öğretmen aynı isimle ikinci kurum açamaz, find-or-create).
        let institutionId = null;
        if (gClassroomType === 'classroom') {
            if (getCurrentUser().institutionRole !== 'teacher') {
                throw new Error('Sınıf grubu yalnızca öğretmen rolündeki hesaplarla oluşturulabilir.');
            }
            if (!gInstitution) {
                throw new Error('Sınıf grubu için bir kurum/okul adı gerekli.');
            }
            const { data: existingInst } = await window.FocusSupabase
                .from('institutions').select('id').eq('owner_id', getCurrentUser().id).eq('name', gInstitution).maybeSingle();
            if (existingInst) {
                institutionId = existingInst.id;
            } else {
                const { data: newInst, error: instErr } = await window.FocusSupabase
                    .from('institutions').insert({ owner_id: getCurrentUser().id, name: gInstitution }).select('id').single();
                if (instErr) throw instErr;
                institutionId = newInst.id;
            }
        }

        let groupRow = null;
        for (let attempt = 0; attempt < 5; attempt++) {
            const code = generateGroupCode();
            const { data, error } = await window.FocusSupabase
                .from('groups')
                .insert({
                    code,
                    name: gName,
                    description: gDesc,
                    weekly_goal: gGoal,
                    privacy: gPrivacy,
                    category: gCategory,
                    classroom_type: gClassroomType || 'general',
                    institution_name: gInstitution || null,
                    institution_id: institutionId,
                    grade_level: gGrade || null,
                    max_members: limits.maxMembers, // kuranın planı grubun kapasitesini belirler
                    created_by: getCurrentUser().id
                })
                .select()
                .single();
            if (!error) { groupRow = data; break; }
            if (error.code !== '23505') throw error;
        }
        if (!groupRow) throw new Error('Grup kodu üretilemedi, lütfen tekrar deneyin.');

        const { error: memberErr } = await window.FocusSupabase
            .from('group_members')
            .insert({ group_id: groupRow.id, user_id: getCurrentUser().id, role: 'admin' });
        if (memberErr) throw memberErr;

        // Sınıf/ders grubunda otomatik iki rol: "Öğretmen" (tam yetki) ve "Öğrenci" (yetkisiz).
        // Öğrenciler kabul ettikleri davetle otomatik "Öğrenci" rolüne atanır (bkz. 084 migration);
        // kurucu öğretmen zaten 'admin' olduğu için ayrıca "Öğretmen" rolüne atanmaz, ama ileride
        // ikinci bir öğretmen eklenirse bu rol admin'in atayabileceği hazır bir seçenek olarak durur.
        if (gClassroomType === 'classroom') {
            await window.FocusSupabase.from('group_custom_roles').insert([
                { group_id: groupRow.id, name: 'Öğretmen', color: '00b894', manage_rooms: true, kick_members: true, lock_rooms: true, assign_roles: true, priority: 200 },
                { group_id: groupRow.id, name: 'Öğrenci', color: '74b9ff', manage_rooms: false, kick_members: false, lock_rooms: false, assign_roles: false, priority: 50 }
            ]);
        }

        await window.FocusSupabase
            .from('profiles')
            .update({ last_group_created_at: new Date().toISOString() })
            .eq('id', getCurrentUser().id);

        const myProfile = await _resolveProfileById(getCurrentUser().id);
        const memberRows = [{
            user_id: getCurrentUser().id,
            role: 'admin',
            joined_at: groupRow.created_at,
            profiles: myProfile || {
                id: getCurrentUser().id,
                username: getCurrentUser().username,
                display_name: getCurrentUser().displayName,
                avatar_color: getCurrentUser().avatarColor,
                custom_avatar: getCurrentUser().customAvatar
            }
        }];

        return await _normalizeSupabaseGroup(groupRow, memberRows);
    }

    // Koda göre gruba katılma: limit/cooldown kontrolleri + `group_members`
    // (açık katılım) veya `group_pending_members` (onay gerekli) insert.
    // Hata durumunda mesajıyla birlikte throw eder. requireApproval=true ise
    // { pending: true, groupRow } döner, aksi halde { pending: false, groupRow }.
    window.joinGroupWithCodeSupabase = (code) => joinGroupWithCodeSupabase(code); // Faz 6: social-group-discover.js için
    async function joinGroupWithCodeSupabase(code) {
        const cleanCode = code.trim().toUpperCase();

        const { data: groupRow, error: gErr } = await window.FocusSupabase
            .from('groups').select('*').eq('code', cleanCode).maybeSingle();
        if (gErr || !groupRow) {
            throw new Error('Bu koda ait bir grup bulunamadı!');
        }

        const { data: existingMember } = await window.FocusSupabase
            .from('group_members').select('user_id')
            .eq('group_id', groupRow.id).eq('user_id', getCurrentUser().id).maybeSingle();
        if (existingMember) {
            throw new Error('Zaten bu grubun aktif bir üyesisiniz!');
        }

        const { data: leaveLog } = await window.FocusSupabase
            .from('group_leave_log').select('left_at')
            .eq('user_id', getCurrentUser().id).eq('group_id', groupRow.id).maybeSingle();
        const cooldownRemaining = leaveLog
            ? Math.max(0, GROUP_LIMITS.REJOIN_COOLDOWN_MS - (Date.now() - new Date(leaveLog.left_at).getTime()))
            : 0;

        if (groupRow.require_approval) {
            if (cooldownRemaining > 0) {
                throw new Error(`Bu gruba tekrar katılmak için ${formatCooldownRemaining(cooldownRemaining)} beklemelisiniz.`);
            }
            const { error: pendErr } = await window.FocusSupabase
                .from('group_pending_members')
                .insert({ group_id: groupRow.id, user_id: getCurrentUser().id });
            if (pendErr) throw pendErr;
            return { pending: true, groupRow };
        }

        // Üye kapasitesi grubun kendi kolonundan (kuranın planı belirledi)
        const memberCap = groupRow.max_members || GROUP_LIMITS.MAX_MEMBERS_PER_GROUP;
        const { count: memberCount } = await window.FocusSupabase
            .from('group_members').select('user_id', { count: 'exact', head: true })
            .eq('group_id', groupRow.id);
        if ((memberCount || 0) >= memberCap) {
            throw new Error(`Bu grup dolu (maks. ${memberCap} üye). Başka bir gruba katılmayı deneyin.`);
        }

        const myLimits = getMyGroupLimits();
        const { count: joinedCount } = await window.FocusSupabase
            .from('group_members').select('group_id', { count: 'exact', head: true })
            .eq('user_id', getCurrentUser().id);
        if ((joinedCount || 0) >= myLimits.maxJoined) {
            throw new Error(`${myLimits.planLabel === 'ücretsiz' ? 'Ücretsiz planda en' : 'En'} fazla ${myLimits.maxJoined} gruba üye olabilirsiniz. Yeni bir gruba katılmak için önce bir gruptan ayrılın.`);
        }

        if (cooldownRemaining > 0) {
            throw new Error(`Bu gruba tekrar katılmak için ${formatCooldownRemaining(cooldownRemaining)} beklemelisiniz.`);
        }

        const { error: insErr } = await window.FocusSupabase
            .from('group_members')
            .insert({ group_id: groupRow.id, user_id: getCurrentUser().id, role: null });
        if (insErr) throw insErr;

        return { pending: false, groupRow };
    }

    // Faz 2: Arena "+ Ekle" menüsü (IIFE dışı) kodla katılmayı buradan çağırır
    window.joinGroupWithCode = joinGroupWithCode;
    async function joinGroupWithCode(code) {
        if (!getCurrentUser()) return window.dcShowToast('Önce topluluğa giriş yapmalısınız.');

        if (window.FocusSupabase && getCurrentUser().id) {
            try {
                const result = await joinGroupWithCodeSupabase(code);
                if (result.pending) {
                    window.dcShowToast('Bu grup katılım onayı gerektiriyor. İsteğiniz yöneticilere iletildi, onaylandığında gruba katılacaksınız.');
                    return;
                }
                // Akış içerik kararı (2026-07-05): kaldırıldı.
                if (typeof window.syncSidebarGroupList === 'function') window.syncSidebarGroupList();
                if (typeof window.setupGroupRecentConversationsSupabase === 'function') setupGroupRecentConversationsSupabase();
                if (typeof showGroupWelcomeModal === 'function') {
                    showGroupWelcomeModal(result.groupRow._supaId || result.groupRow.code, result.groupRow);
                }
            } catch (e) {
                window.dcShowToast(e.message || 'Gruba katılırken hata oluştu.');
            }
            return;
        }
    }
