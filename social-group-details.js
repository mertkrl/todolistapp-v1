// social-group-details.js
// social.js'ten çıkarıldı (Faz 5): Sınıf/Kurum Paneli (showGroupDetails) +
// resetActiveGroupPanel. Grup Odak Seansı Takvimi (GSC) alt-sistemi Faz I'de
// social-group-session-calendar.js'e ayrıca çıkarıldı (aşağıdaki import'lar
// üzerinden kullanılıyor) — resetActiveGroupPanel ise BU dosyanın kendi
// dinleyici referanslarına (groupMembersListenerRef vb.) da doğrudan eriştiği
// için burada bırakıldı, sadece GSC tarafındaki temizliği gscResetState()
// çağrısına devretti.
//
// Köprüler:
//  - currentActiveGroupCode: social.js'te tanımlı, window.__getCurrentActiveGroupCodeRef/
//    __setCurrentActiveGroupCodeRef getter/setter'ları ile paylaşılıyor.
//  - loadMyGroups/openGroupInviteModal: social.js'te tanımlı, window.* olarak çağrılıyor.
//  - _isSupabaseGroupAdmin: social.js'te zaten window'a atanmıştı.
//  - initGroupSessionCalendar/computeGroupAchievements/gscRenderCalendar/
//    getGscSessionsCache/getGscGroupKey/gscResetState: social-group-session-calendar.js'ten
//    gerçek ES import ile alınıyor.

import {
    initGroupSessionCalendar,
    computeGroupAchievements as _computeGroupAchievements,
    getGscSessionsCache,
    getGscGroupKey,
    gscResetState,
    gscGetWeekDates,
    gscDateKey,
    gscRenderActivityFeed,
    gscRenderHistory,
    _applyGroupTheme,
    _openGroupThemePicker,
} from './social-group-session-calendar.js';
import { renderGroupTournament } from './social-gamification.js';
import { computeActiveNowCount } from './social-group-discover.js';
import { sendGroupKudos, _maybeCelebrateGroupGoal } from './social-activity-feed.js';
import { getGmMembersSupabaseChannel, setGmMembersSupabaseChannel } from './state/gm-members-channel-store.js';
import { getGmCustomRolesSupabaseChannel, setGmCustomRolesSupabaseChannel } from './state/gm-custom-roles-channel-store.js';
import { BUILTIN_ROLE_PERMS, getRolePriority, logGroupAuditSupabase, loadGroupCustomRolesMapSupabase, openGroupManagementModalSupabase } from './social-roles.js';
import { _pickNewOwner } from './social-misc-pure-utils.js';

       let groupMembersListenerRef = null; // Canlı dinleyiciyi temizlemek için hafıza referansı
       let _managePermsListenerRef = null; // "Grup Yönetimi" butonu görünürlüğü için canlı izin dinleyicisi
       let _groupOverviewPresenceHandler = null; // "Şu An Aktif" sayacını presence değişince güncelleyen dinleyici
       let _groupLeaderboardPresenceHandler = null; // Liderlik tablosu/çalışan üyeler panelini presence değişince güncelleyen dinleyici
       let _announcementListenerRef = null; // Sabitlenmiş duyuru için canlı dinleyici
       let _groupLeaderboardMode = 'weekly'; // 'weekly' (Pazartesi'de sıfırlanır) | 'alltime' — sıralama sekmesi
       let _groupLeaderboardLiveChannel = null; // profiles UPDATE'lerini dinleyip leaderboard'u canlı güncelleyen kanal
       let _groupLeaderboardLiveDebounce = null;

       // ── SAF YARDIMCI FONKSİYONLAR (showGroupDetails'in closure state'ini
       // okumaz/yazmaz, sadece kendi parametrelerine bağlı hesaplama/HTML üretimi) ──

       // Sıralama rozeti: ilk 3 için madalya emojisi, sonrası için "#N". Önceden
       // showGroupDetails içinde iki ayrı yerde (leaderboardData + yourRankCard)
       // birbirinden bağımsız aynı rankIcons dizisiyle tekrarlanıyordu.
       const _GD_RANK_ICONS = ['🥇', '🥈', '🥉'];
       function _gdRankLabel(idx) {
           return idx < 3 ? _GD_RANK_ICONS[idx] : `#${idx + 1}`;
       }

       // Sayfa yenileme restorasyonunda hangi grup-sekmesinin (gtab) en başta
       // aktif render edileceğini hesaplar. pendingGtab: window._pendingGroupPanelGtab
       // değeri; showOverviewTab/isInstitutionalGroup çağıran taraf tarafından
       // önceden hesaplanıp geçirilir.
       function _gdComputeRestoreTargetGtab(pendingGtab, showOverviewTab, isInstitutionalGroup) {
           if (pendingGtab === 'overview') return showOverviewTab ? 'overview' : null;
           if (pendingGtab === 'classroom') return isInstitutionalGroup ? 'classroom' : null; // kurumsal olmayan grupta bu sekme yok
           if (pendingGtab === 'leaderboard') return isInstitutionalGroup ? null : 'leaderboard'; // kurumsal grupta bu sekme yok
           if (pendingGtab === 'calendar' || pendingGtab === 'history') return pendingGtab;
           return null;
       }

       // Bir sekme butonunun/panelinin "active" CSS sınıfını alıp almayacağını
       // hesaplar: restoreTarget varsa ona göre, yoksa defaultTab'a göre karar verir.
       function _gdTabActiveClass(name, restoreTarget, defaultTab) {
           return (restoreTarget ? name === restoreTarget : name === defaultTab) ? ' active' : '';
       }

       // Üye listesini/sayısını/sıralamasını render eder — Firebase ve Supabase
       // dinleyicileri aynı `membersData` şeklini ({ username: {role, joinedAt, ...} })
       // üretip bu fonksiyonu çağırır. showGroupDetails'in eski iç (closure) fonksiyonuydu;
       // sadece `data`/`membersData`'yı OKUYUP DOM'a yazıyor, showGroupDetails'in 15+ paylaşılan
       // state değişkeninden HİÇBİRİNİ mutasyona uğratmıyor — bu yüzden `data`'yı açık parametre
       // olarak alan modül-seviyesi bir fonksiyona güvenle çıkarıldı (Faz H).
       // _renderGroupMembersPanel'den ayrılan: haftanın yıldızları rozet paneli.
       // Faz S devamı, dev fonksiyon refactoru.
       function _renderGroupWeeklyBadges(leaderboardData, data) {
           const badgesEl = document.getElementById('group-weekly-badges');
           if (badgesEl) {
               const badges = [];
               const addBadge = (icon, label, member, detail, color) => {
                   if (!member) return;
                   badges.push({ icon, label, name: member.uData.displayName || member.username, detail, color });
               };

               if (_groupLeaderboardMode === 'weekly' && leaderboardData.length >= 2) {
                   // 🏆 Haftanın Şampiyonu — en çok odaklanan
                   const champ = leaderboardData.filter(m => m.weeklyFocusMin > 0)[0];
                   addBadge('🏆', 'Haftanın Şampiyonu', champ, formatFocusMinutes(champ?.weeklyFocusMin || 0), 'var(--primary-color)');

                   // 🏅 En Tutarlı — en fazla aktif gün
                   const consistent = leaderboardData.filter(m => m.activeDays > 0).sort((a,b) => b.activeDays - a.activeDays || b.weeklyFocusMin - a.weeklyFocusMin)[0];
                   addBadge('🏅', 'En Tutarlı', consistent, `${consistent?.activeDays || 0} gün`, '#74b9ff');

                   // 📈 Yükselen Yıldız — geçen haftaya göre en çok artış
                   const rising = leaderboardData.filter(m => m.weeklyFocusMin > 0 && (m.weeklyFocusMin - m.prevWeekFocusMin) > 0)
                       .sort((a,b) => (b.weeklyFocusMin - b.prevWeekFocusMin) - (a.weeklyFocusMin - a.prevWeekFocusMin))[0];
                   addBadge('📈', 'Yükselen Yıldız', rising, rising ? `+${formatFocusMinutes(rising.weeklyFocusMin - rising.prevWeekFocusMin)}` : '', '#D4900E');

                   // 🤝 En Sadık Katılımcı — bu haftaki seanslara en yüksek check-in oranı
                   const _gscCache = getGscSessionsCache();
                   if (Object.keys(_gscCache).length > 0) {
                       const thisWeek = gscGetWeekDates ? gscGetWeekDates(0) : [];
                       const weekKeys = new Set(thisWeek.map(d => gscDateKey(d)));
                       const rsvpMap = {};
                       Object.values(_gscCache).forEach(s => {
                           if (!weekKeys.has(s.date)) return;
                           Object.entries(s.attendees || {}).forEach(([u, a]) => {
                               if (!rsvpMap[u]) rsvpMap[u] = { rsvp: 0, checkin: 0 };
                               rsvpMap[u].rsvp++;
                               if (a.checkedInAt) rsvpMap[u].checkin++;
                           });
                       });
                       let bestRate = -1, bestUser = null;
                       leaderboardData.forEach(m => {
                           const r = rsvpMap[m.username];
                           if (!r || r.rsvp < 2) return;
                           const rate = r.checkin / r.rsvp;
                           if (rate > bestRate) { bestRate = rate; bestUser = m; }
                       });
                       if (bestUser && bestRate >= 0.5) {
                           addBadge('🤝', 'En Sadık Katılımcı', bestUser, `%${Math.round(bestRate * 100)} katılım`, '#a29bfe');
                       }
                   }
               } else if (_groupLeaderboardMode === 'alltime') {
                   // Tüm Zamanlar modunda: tüm zamanların zirvesi
                   const atChamp = leaderboardData.filter(m => m.allTimeFocusMin > 0)[0];
                   addBadge('👑', 'Tüm Zamanların Lideri', atChamp, formatFocusMinutes(atChamp?.allTimeFocusMin || 0), 'var(--primary-color)');
                   // En fazla aktif gün (all-time consistent)
                   const atConsistent = leaderboardData.filter(m => m.activeDays > 0).sort((a,b) => b.activeDays - a.activeDays)[0];
                   addBadge('🔥', 'Düzenlilik Rekoru', atConsistent, `${atConsistent?.activeDays || 0} gün/hafta`, '#D4900E');
               }

               badgesEl.innerHTML = badges.length > 0 ? badges.map((b, i) => `
                   <div class="grp-badge-chip" data-badge-idx="${i}">
                       <span class="grp-badge-icon">${b.icon}</span>
                       <div>
                           <div class="grp-badge-label">${b.label}</div>
                           <div class="grp-badge-name">${_escapeHtml(b.name)}
                               <span class="grp-badge-detail"> ${b.detail}</span>
                           </div>
                       </div>
                   </div>`).join('')
                   : '';
               badgesEl.querySelectorAll('.grp-badge-chip').forEach(chip => {
                   const i = parseInt(chip.dataset.badgeIdx, 10);
                   const detailEl = chip.querySelector('.grp-badge-detail');
                   if (detailEl) detailEl.style.color = badges[i].color;
               });

               // Kişisel başarılar (gscSessionsCache'den türetilen kalıcı unvanlar)
               if (currentUser) {
                   const myAchievements = _computeGroupAchievements(currentUser.username, data._supaId || getGscGroupKey());
                   const achEl = document.getElementById('group-my-achievements');
                   if (achEl) {
                       achEl.innerHTML = myAchievements.length > 0
                           ? myAchievements.map(a => `<span class="grp-achievement-chip" title="${a.desc}">${a.icon} ${a.label}</span>`).join('')
                           : '';
                       achEl.style.display = myAchievements.length > 0 ? 'flex' : 'none';
                   }
               }
           }
       }

       // _renderGroupMembersPanel'den ayrılan: "Senin Konumun" kartı.
       // Faz S devamı, dev fonksiyon refactoru.
       function _renderGroupYourRankCard(leaderboardData, data) {
           const yourRankCard = document.getElementById('group-your-rank-card');
           if (yourRankCard) {
               const myIdx = leaderboardData.findIndex(m => m.username === currentUser.username);
               if (myIdx === -1 || leaderboardData.length === 0) {
                   yourRankCard.classList.add('hidden');
                   yourRankCard.innerHTML = '';
               } else if (leaderboardData.length < 3) {
                   // 1-2 kişilik gruplarda "X kişi içinde 1.'sin" anlamsız bir övünmeye dönüşüyor —
                   // bunun yerine grubu büyütmeye teşvik eden bir mesaj göster.
                   yourRankCard.classList.remove('hidden');
                   const me = leaderboardData[myIdx];
                   yourRankCard.innerHTML = `
                       <div class="gyr-rank"><i class="fa-solid fa-user-group"></i></div>
                       <div class="gyr-info">
                           <div class="gyr-title">Henüz az kişisiniz</div>
                           <div class="gyr-sub">Rekabeti daha eğlenceli hale getirmek için arkadaşlarını davet et.</div>
                       </div>
                       <div class="gyr-time">${formatFocusMinutes(me.focusMin)}</div>
                   `;
               } else {
                   yourRankCard.classList.remove('hidden');
                   const me = leaderboardData[myIdx];
                   const isFirst = myIdx === 0;
                   const ahead = isFirst ? null : leaderboardData[myIdx - 1];
                   const gapMin = ahead ? Math.max(ahead.focusMin - me.focusMin, 0) : 0;
                   const rankLabel = _gdRankLabel(myIdx);
                   const subText = isFirst
                       ? 'Zirvedesin! Yerini korumak için odaklanmaya devam et.'
                       : `Önündeki <b class="u-color-hfff">${_escapeHtml(ahead.uData.displayName || ahead.username)}</b>'ı geçmek için <b class="u-color-hfff">${formatFocusMinutes(gapMin)}</b> kaldı.`;
                   yourRankCard.innerHTML = `
                       <div class="gyr-rank">${rankLabel}</div>
                       <div class="gyr-info">
                           <div class="gyr-title">Senin Konumun: ${leaderboardData.length} kişi içinde ${myIdx + 1}.</div>
                           <div class="gyr-sub">${subText}</div>
                       </div>
                       <div class="gyr-time">${formatFocusMinutes(me.focusMin)}</div>
                   `;

                   // ── ARKADAN GELEN RAKİP UYARISI ──
                   // Pozitif/dostane tonda: seni geçmeye yaklaşan biri varsa, haftada bir kez uyar.
                   if (_groupLeaderboardMode === 'weekly') {
                       const behind = leaderboardData[myIdx + 1];
                       const RIVAL_THRESHOLD_MIN = 15;
                       if (behind && me.focusMin > 0) {
                           const behindGap = me.focusMin - behind.focusMin;
                           if (behindGap <= RIVAL_THRESHOLD_MIN) {
                               const warnKey = `focusai_rival_warn_${data._supaId}_${_currentWeekStartKey()}_${behind.username}`;
                               if (!localStorage.getItem(warnKey)) {
                                   localStorage.setItem(warnKey, '1');
                                   const behindName = behind.uData.displayName || behind.username;
                                   dcShowToast(`👀 ${behindName} sana yaklaşıyor — sadece ${formatFocusMinutes(Math.max(behindGap, 0))} arkanda, devam et!`);
                               }
                           }
                       }
                   }
               }
           }
       }

       // _renderGroupMembersPanel'den ayrılan: sıralama (leaderboard) listesi render'ı.
       // Faz S devamı, dev fonksiyon refactoru.
       function _renderGroupLeaderboardList(leaderboardData, data, membersData, isSupabaseGroup, supaCustomRoles) {
           const leaderboardEl = document.getElementById("group-leaderboard-list");
           const leaderboardEmpty = document.getElementById("group-leaderboard-empty");
           if (leaderboardEmpty) leaderboardEmpty.classList.toggle('hidden', leaderboardData.length > 0);
           if (leaderboardEl) {
               leaderboardEl.innerHTML = leaderboardData.map((m, idx) => {
                   const builtinRole = BUILTIN_ROLE_PERMS[m.role];
                   const customRole = isSupabaseGroup
                       ? (supaCustomRoles && supaCustomRoles[m.role])
                       : (data.customRoles && data.customRoles[m.role]);
                   const roleName = builtinRole ? builtinRole.name : (customRole ? customRole.name : 'Üye');
                   const roleColor = builtinRole ? builtinRole.color : (customRole ? (customRole.color || '6c5ce7') : '636e72');
                   const displayName = m.uData.displayName || m.username;
                   const rankLabel = _gdRankLabel(idx);

                   const isSelfRow = m.username === currentUser.username;

                   return `
                       <div class="group-leaderboard-row${idx < 3 ? ' top-rank' : ''} u-cursor-pointer" data-username="${_escapeHtml(m.username)}" >
                           <div class="glb-rank">${rankLabel}</div>
                           ${avatarImgHtml({ ...m.uData, displayName }, 34)}
                           <div class="glb-info">
                               <div class="glb-name">
                                   ${_escapeHtml(displayName)}
                                   ${m.uData.online ? '<span class="glb-online-dot" title="Çevrimiçi"></span>' : ''}
                               </div>
                               <div class="glb-role" data-role-color="${_escapeHtml(roleColor)}">${_escapeHtml(roleName)}</div>
                           </div>
                           ${isSelfRow ? '' : `<button class="group-kudos-btn u-flex-shrink-0_background-none_border-none_cursor-pointer_f" data-user-id="${m.uData.userId || ''}" data-username="${_escapeHtml(m.username)}" title="Alkış gönder" >👏</button>`}
                           <div class="glb-time">${formatFocusMinutes(m.focusMin)}</div>
                       </div>
                   `;
               }).join("");

               leaderboardEl.querySelectorAll(".glb-role").forEach(el => {
                   el.style.color = '#' + el.dataset.roleColor;
               });

               if (leaderboardData.length === 0) {
                   leaderboardEl.innerHTML = `<p class="u-color-var-text-muted_font-size-12px_text-align-center_marg">Henüz üye yok.</p>`;
               } else {
                   leaderboardEl.querySelectorAll(".group-leaderboard-row").forEach(row => {
                       row.addEventListener("click", () => {
                           const m = leaderboardData.find(x => x.username === row.dataset.username);
                           if (m && typeof openMiniProfile === 'function') {
                               openMiniProfile(m.username, m.uData, row, membersData[m.username] || null);
                           }
                       });
                   });
               }
           }
       }

       async function _renderGroupMembersPanel(data, membersData) {
           const studyMembersContainer = document.getElementById("group-study-members");
           const activeCountEl = document.getElementById("group-active-count");
           if (!studyMembersContainer) return;

           studyMembersContainer.innerHTML = "";
           if (!membersData) return;

           const usernames = Object.keys(membersData)
               .filter(u => !(typeof window.isBlockedEitherWay === 'function' && window.isBlockedEitherWay(u)));
           if (activeCountEl) activeCountEl.textContent = `${usernames.length} Üye`;

           let totalGroupFocusMinutes = 0;
           const leaderboardData = [];

           const isSupabaseGroup = !!data._supaId;
           if (isSupabaseGroup) window.registerPresenceWatchIds?.(usernames.map(u => membersData[u]?.userId).filter(Boolean));
           const presenceState = isSupabaseGroup && window.getCommunityPresenceState ? window.getCommunityPresenceState() : null;
           const supaCustomRoles = isSupabaseGroup ? await loadGroupCustomRolesMapSupabase(data._supaId) : null;

           for (let memberUsername of usernames) {
               const memberEntry = membersData[memberUsername] || {};
               let uData;

               const online = !!(presenceState && memberEntry.userId && presenceState[memberEntry.userId] && presenceState[memberEntry.userId].some(p => p.studying));
               uData = {
                   displayName: memberEntry.displayName || memberUsername,
                   avatarColor: memberEntry.avatarColor,
                   customAvatar: memberEntry.customAvatar,
                   xp: memberEntry.xp || 0,
                   userId: memberEntry.userId,
                   online
               };

               const allTimeFocusMin = Math.floor((uData.xp || 0) / 10);
               const weeklyFocusMin = Math.max(0, Math.floor(memberEntry.weeklyFocusMin || 0));
               const activeDays = Math.max(0, Math.floor(memberEntry.activeDays || 0));
               const prevWeekFocusMin = Math.max(0, Math.floor(memberEntry.prevWeekFocusMin || 0));
               totalGroupFocusMinutes += weeklyFocusMin;

               const role = (membersData[memberUsername] && membersData[memberUsername].role)
                   || (data.createdBy === memberUsername ? 'admin' : 'member');
               const focusMin = _groupLeaderboardMode === 'weekly' ? weeklyFocusMin : allTimeFocusMin;
               leaderboardData.push({ username: memberUsername, uData, focusMin, allTimeFocusMin, weeklyFocusMin, activeDays, prevWeekFocusMin, role });

               if (uData.online) {
                   const mBox = document.createElement("div");
                   mBox.className = "glass-element";
                   mBox.style.padding = "12px";
                   mBox.style.display = "flex";
                   mBox.style.alignItems = "center";
                   mBox.style.gap = "10px";
                   mBox.style.border = "1px solid #2ed573";
                   mBox.style.background = "rgba(46, 213, 115, 0.05)";
                   mBox.style.borderRadius = "8px";
                   const isSelf = memberUsername === currentUser.username;
                   mBox.innerHTML = `
                       ${avatarImgHtml({ ...uData, displayName: uData.displayName || memberUsername }, 30)}
                       <div class="u-flex-1_min-width-0_text-align-left">
                           <div class="u-font-weight-600_color-hfff_font-size-12px_overflow-hidden_">${_escapeHtml(uData.displayName || memberUsername)}</div>
                           <div class="u-font-size-10px_color-h2ed573"><i class="fa-solid fa-bolt"></i> Odaklanıyor</div>
                       </div>
                       ${isSelf ? '' : `<button class="group-kudos-btn u-flex-shrink-0_background-none_border-none_cursor-pointer_f-2" data-user-id="${uData.userId || ''}" data-username="${_escapeHtml(memberUsername)}" title="Alkış gönder" >👏</button>`}
                   `;
                   studyMembersContainer.appendChild(mBox);
               }
           }

           const weeklyGoal = data.weeklyGoal || 1000;
           const percent = Math.min(100, Math.floor((totalGroupFocusMinutes / weeklyGoal) * 100));

           const fillEl = document.getElementById('group-goal-fill');
           const percentText = document.getElementById('group-goal-percent');
           const goalText = document.getElementById('group-goal-text');

           if (fillEl) fillEl.style.strokeDashoffset = (238.76 * (1 - percent / 100)).toFixed(2);
           if (percentText) percentText.textContent = '%' + percent;
           if (goalText) goalText.textContent = `${formatFocusMinutes(totalGroupFocusMinutes)} / ${formatFocusMinutes(weeklyGoal)}`;

           // ── EKİP BAŞARISI: haftalık hedef tamamlanınca kutlama ──
           if (isSupabaseGroup && totalGroupFocusMinutes >= weeklyGoal && weeklyGoal > 0) {
               _maybeCelebrateGroupGoal(data._supaId, data.name, totalGroupFocusMinutes, weeklyGoal);
           }

           // Mini turnuva kartı — presence güncellemeleri sık tetiklenebildiği için
           // grup başına en fazla 20 sn'de bir tazelenir.
           if (isSupabaseGroup && data._supaId && typeof window.renderGroupTournament === 'function') {
               const now = Date.now();
               if (!window._gtLastFetch[data._supaId] || now - window._gtLastFetch[data._supaId] > 20000) {
                   window._gtLastFetch[data._supaId] = now;
                   renderGroupTournament(data._supaId);
               }
           }

           // Sıralamayı önceden hesapla (boş durum özetinde de kullanılacak)
           leaderboardData.sort((a, b) => b.focusMin - a.focusMin);

           // ── BU HAFTANIN YILDIZLARI — tek metrikli ("kim daha çok çalıştı") yarışı
           // çeşitlendiren rozetler: sadece toplam dakika değil, tutarlılık ve ilerleme de ödüllendirilsin.
           _renderGroupWeeklyBadges(leaderboardData, data);

           // ── SENİN KONUMUN — pozitif rekabet için kullanıcının sırasını öne çıkar ──
           _renderGroupYourRankCard(leaderboardData, data);

           if (studyMembersContainer.innerHTML === "") {
               const topMember = leaderboardData[0];
               if (totalGroupFocusMinutes === 0) {
                   // Tamamen boş grup: pasif bir "henüz kayıt yok" mesajı yerine
                   // doğrudan odaklanmaya başlatan bir CTA göster.
                   studyMembersContainer.innerHTML = `
                       <div class="u-grid-column-1-1_display-flex_align-items-center_justify-co">
                           <p class="u-color-var-text-muted_font-size-12px_margin-0_line-height-1">Bu grupta bu hafta henüz odaklanma kaydı yok.<br>Liderlik tablosuna girecek ilk kişi sen ol!</p>
                           <button id="group-empty-state-cta" class="control-btn primary u-font-size-12px_padding-9px16px_white-space-nowrap_flex-shr" >
                               <i class="fa-solid fa-bolt"></i> İlk Seansını Başlat
                           </button>
                       </div>`;
                   const ctaBtn = document.getElementById('group-empty-state-cta');
                   if (ctaBtn) {
                       ctaBtn.onclick = () => {
                           if (typeof window.switchTab === 'function') window.switchTab('zamanlayici');
                       };
                   }
               } else {
                   const summaryHtml = `Bu grup bu hafta <b class="u-color-hfff">${formatFocusMinutes(totalGroupFocusMinutes)}</b> odaklandı.<br>En çok odaklanan: <b class="u-color-hfff">${_escapeHtml(topMember.uData.displayName || topMember.username)}</b> (${formatFocusMinutes(topMember.focusMin)})`;
                   studyMembersContainer.innerHTML = `
                       <div class="u-grid-column-1-1_text-align-center_padding-14px10px">
                           <p class="u-color-var-text-muted_font-size-12px_margin-006px0">Şu an grupta aktif çalışan kimse yok.</p>
                           <p class="u-color-var-text-muted_font-size-12px_margin-0_line-height-1-2">${summaryHtml}</p>
                       </div>`;
               }
           }

           // Onboarding kartını: sıralama verisi yoksa göster, varsa gizle
           const onboardingCard = document.getElementById('group-overview-onboarding');
           if (onboardingCard) onboardingCard.classList.toggle('hidden', leaderboardData.length > 0);

           // ── SIRALAMA (Leaderboard) ──
           _renderGroupLeaderboardList(leaderboardData, data, membersData, isSupabaseGroup, supaCustomRoles);
       }

       // Grup detay panelinin (Genel Bakış/Sıralama/Takvim/Geçmiş/Sınıf) tüm
       // innerHTML iskeletini üreten SAF fonksiyon — hiçbir closure state'ini
       // (groupMembersListenerRef vb.) okumaz/mutasyona uğratmaz, sadece
       // parametrelerden HTML string üretir. showGroupDetails'ten Faz H'de
       // çıkarıldı (2026-07-27).
       function _renderGroupDetailsPanelHtml(code, data, _showOverviewTab, _gtabActiveCls) {
        return `
             <div class="u-border-bottom-1pxsolidrgba2552552550p05_padding-bottom-15p">
                 <div class="u-display-flex_justify-content-space-between_align-items-fle">
                     <div class="u-flex-1_min-width-0_display-flex_gap-14px_align-items-flex-">
                         ${window.groupAvatarHtml(code, data.name, 54)}
                         <div class="u-flex-1_min-width-0-2">
                             <h2 id="active-group-name" class="u-font-size-22px_margin-bottom-5px_color-hfff_margin-top-0">-</h2>
                             <p id="active-group-desc" class="u-color-var-text-muted_font-size-14px_margin-0010px0">-</p>
                         </div>
                     </div>
                     <div class="u-display-flex_gap-8px_flex-wrap-wrap_justify-content-flex-e">
                         <button id="group-theme-btn" class="control-btn secondary hidden u-padding-6px10px_font-size-12px" title="Grup teması" aria-label="Grup teması">
                             <i class="fa-solid fa-palette"></i>
                         </button>
                         <button id="group-manage-perms-btn" class="control-btn secondary hidden u-padding-6px12px_font-size-12px_white-space-nowrap" >
                             <i class="fa-solid fa-users-gear"></i> Grup Yönetimi
                         </button>
                         <button id="group-invite-friend-btn" class="control-btn secondary u-padding-6px12px_font-size-12px_white-space-nowrap" title="Arkadaşını gruba davet et">
                             <i class="fa-solid fa-user-plus"></i> Davet Et
                         </button>
                         <button id="group-leave-btn" class="control-btn secondary hidden u-padding-6px12px_font-size-12px_white-space-nowrap" >
                             <i class="fa-solid fa-door-open"></i> Ayrıl
                         </button>
                     </div>
                 </div>
             </div>

             <!-- SABİTLENMİŞ DUYURU -->
             <div id="group-announcement-banner" class="group-announcement-banner hidden">
                 <i class="fa-solid fa-thumbtack"></i>
                 <span id="group-announcement-text"></span>
                 <button id="group-announcement-edit-btn" class="icon-btn hidden" title="Duyuruyu düzenle" aria-label="Duyuruyu düzenle"><i class="fa-solid fa-pen"></i></button>
             </div>
             <div id="group-announcement-editor" class="group-announcement-editor hidden">
                 <textarea id="group-announcement-input" maxlength="200" placeholder="Grup için bir duyuru yaz (örn: Cuma akşamı ortak seans var!)"></textarea>
                 <div class="u-display-flex_gap-8px_justify-content-flex-end_margin-top-6">
                     <button id="group-announcement-cancel-btn" class="control-btn secondary u-font-size-11px_padding-5px10px" >Vazgeç</button>
                     <button id="group-announcement-save-btn" class="control-btn primary u-font-size-11px_padding-5px10px" >Kaydet</button>
                 </div>
             </div>

             <!-- SEKME ÇUBUĞU -->
             <div class="group-detail-tabs">
                 ${_showOverviewTab ? `
                 <button class="group-detail-tab-btn${_gtabActiveCls('overview')}" data-gtab="overview"><i class="fa-solid fa-chart-simple"></i> Genel Bakış</button>` : ''}
                 ${(data.classroomType === 'classroom' || data.classroomType === 'workplace') ? `
                 <button class="group-detail-tab-btn${_gtabActiveCls('classroom')}" data-gtab="classroom"><i class="fa-solid fa-graduation-cap"></i> ${data.classroomType === 'workplace' ? 'Ekip Paneli' : 'Sınıf Paneli'}</button>` : ''}
                 <button class="group-detail-tab-btn${_gtabActiveCls('calendar')}" data-gtab="calendar"><i class="fa-solid fa-calendar-week"></i> Takvim</button>
                 ${(data.classroomType === 'classroom' || data.classroomType === 'workplace') ? '' : `
                 <button class="group-detail-tab-btn${_gtabActiveCls('leaderboard')}" data-gtab="leaderboard"><i class="fa-solid fa-ranking-star"></i> Sıralama</button>`}
                 <button class="group-detail-tab-btn${_gtabActiveCls('history')}" data-gtab="history"><i class="fa-solid fa-clock-rotate-left"></i> Geçmiş</button>
             </div>

             <!-- GENEL BAKIŞ — kurumsal gruplarda öğrenciye hiç gösterilmiyor (2026-07-12,
                  kullanıcı geri bildirimi: içeriği sadece stat kartları + yönlendirme
                  butonundan ibaretti, doğrudan Sınıf Paneli'ne inmek daha sade). -->
             ${_showOverviewTab ? `
             <div id="group-gtab-overview" class="group-detail-tab-content${_gtabActiveCls('overview')}">
                 <!-- SENİN KONUMUN — kurumsal (sınıf/işyeri) gruplarda rekabet çerçevesi yerine
                      Sınıf/Ekip Paneli'ndeki performans özetleri kullanılır, bu kart gösterilmez. -->
                 ${(data.classroomType === 'classroom' || data.classroomType === 'workplace') ? '' : `
                 <div id="group-your-rank-card" class="group-your-rank-card hidden"></div>`}

                 <!-- Kurumsal (sınıf/işyeri) gruplarda "Genel Bakış" hem tanıtım/vitrin kartı hem
                      analitik özeti (KPI, risk, yoğunluk, kendi durumun) içerir —
                      window.renderInstitutionalOverviewIntro() + window.renderClassroomInsightsPanel() doldurur. -->
                 ${(data.classroomType === 'classroom' || data.classroomType === 'workplace') ? `
                 <div id="inst-group-intro"></div>` : ''}

                 ${(data.classroomType === 'classroom' || data.classroomType === 'workplace') ? '' : `
                 <!-- Haftalık hedef ring progress -->
                 <div class="u-display-grid_grid-template-columns-auto1fr_gap-16px_align-">
                     <!-- SVG ring -->
                     <div class="u-position-relative_width-90px_height-90px_flex-shrink-0">
                         <svg width="90" height="90" viewBox="0 0 90 90" class="u-transform-rotate-90deg">
                             <circle cx="45" cy="45" r="38" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="8"/>
                             <circle id="group-goal-fill" cx="45" cy="45" r="38" fill="none"
 stroke="var(--primary-color)" stroke-width="8"
 stroke-linecap="round"
 stroke-dasharray="238.76"
 stroke-dashoffset="238.76"
 / class="u-transition-stroke-dashoffset0p6sease">
                         </svg>
                         <div class="u-position-absolute_inset-0_display-flex_flex-direction-colu">
                             <span id="group-goal-percent" class="u-font-size-15px_font-weight-700_color-hfff_line-height-1">%0</span>
                             <span class="u-font-size-9px_color-var-text-muted_margin-top-2px">Hedef</span>
                         </div>
                     </div>
                     <div>
                         <div class="u-font-size-13px_font-weight-600_color-hfff_margin-bottom-4p"><i class="fa-solid fa-bullseye u-color-var-primary-color" ></i> Haftalık Topluluk Hedefi</div>
                         <div class="si-muted-sm">Grup Çalışma Süresi:</div>
                         <div id="group-goal-text" class="u-font-size-14px_font-weight-600_color-hfff_margin-top-2px">0 / 0 dk</div>
                     </div>
                 </div>`}

                 ${(data.classroomType === 'classroom' || data.classroomType === 'workplace') ? '' : `
                 <!-- MİNİ TURNUVA (premium özellik, 062) — grup içi kısa süreli yarışma.
                      renderGroupTournament() doldurur; grup Supabase grubu değilse boş kalır. -->
                 <div id="group-tournament-card" class="u-margin-top-14px"></div>`}

                 <!-- BU HAFTANIN YILDIZLARI -->
                 <div id="group-weekly-badges" class="u-display-flex_gap-8px_flex-wrap-wrap_margin-top-14px"></div>

                 <!-- Kişisel başarı unvanlarım -->
                 <div id="group-my-achievements" class="u-display-none_flex-wrap-wrap_gap-6px_margin-top-10px"></div>

                 ${(data.classroomType === 'classroom' || data.classroomType === 'workplace') ? '' : `
                 <!-- Canlı Çalışan Üyeler -->
                 <div class="glass-panel u-margin-top-14px_padding-14px_border-1pxsolidrgba2552552550" >
                     <h3 class="u-font-size-14px_margin-0010px_display-flex_align-items-cent">
                         <i class="fa-solid fa-circle u-color-h74b9ff_font-size-8px" ></i> Canlı Çalışan Üyeler
                     </h3>
                     <div id="group-study-members" class="u-display-grid_grid-template-columns-repeatauto-fillminmax13"></div>
                 </div>`}

                 <!-- Boş durum: grup yeni kurulduğunda yol gösterici -->
                 <div id="group-overview-onboarding" class="grp-onboarding-card hidden">
                     <i class="fa-solid fa-rocket u-font-size-28px_color-var-primary-color_margin-bottom-10px" ></i>
                     <p class="u-font-size-14px_font-weight-600_color-hfff_margin-006px">Grubun henüz başlıyor!</p>
                     <p class="u-font-size-12px_color-var-text-muted_margin-0014px_line-hei">İlk seansını Takvim sekmesinden planla, arkadaşlarını davet et ve birlikte odaklanmaya başlayın.</p>
                     <div class="u-display-flex_gap-8px_flex-wrap-wrap_justify-content-center">
                         <button class="control-btn secondary u-font-size-12px" data-action="onboarding-goto-calendar-tab" >
                             <i class="fa-solid fa-calendar-plus"></i> Seans Planla
                         </button>
                     </div>
                 </div>

                 ${(data.classroomType === 'classroom' || data.classroomType === 'workplace') ? '' : `
                 <!-- Son Aktivite -->
                 <div class="u-margin-top-16px">
                     <h3 class="u-font-size-13px_font-weight-600_color-rgba2552552550p6_text">
                         <i class="fa-solid fa-bolt u-color-var-primary-color_font-size-11px" ></i> Son Aktivite
                     </h3>
                     <div id="group-activity-feed" class="u-display-flex_flex-direction-column_gap-6px"></div>
                 </div>`}
             </div>` : ''}

             <!-- SIRALAMA -->
             <div id="group-gtab-leaderboard" class="group-detail-tab-content${_gtabActiveCls('leaderboard')}">
                 <div class="u-display-flex_align-items-center_justify-content-space-betw-10">
                     <h3 class="u-font-size-15px_margin-0_display-flex_align-items-center_ga">
                         <i class="fa-solid fa-ranking-star u-color-var-primary-color" ></i> Odaklanma Sıralaması
                     </h3>
                     <div id="group-leaderboard-mode-tabs" class="u-display-flex_gap-4px_background-rgba2552552550p04_border-r">
                         <button class="glb-mode-btn u-font-size-11px_padding-5px10px_border-radius-6px_border-no" data-mode="weekly" >Bu Hafta</button>
                         <button class="glb-mode-btn u-font-size-11px_padding-5px10px_border-radius-6px_border-no" data-mode="alltime" >Tüm Zamanlar</button>
                     </div>
                 </div>
                 <p id="group-leaderboard-mode-hint" class="u-font-size-11px_color-var-text-muted_margin-6px010px0"></p>
                 <div id="group-leaderboard-list" class="u-display-flex_flex-direction-column_gap-8px"></div>
                 <div id="group-leaderboard-empty" class="grp-onboarding-card hidden u-margin-top-8px" >
                     <i class="fa-solid fa-hourglass-start u-font-size-24px_color-var-primary-color_margin-bottom-8px" ></i>
                     <p class="u-font-size-13px_font-weight-600_color-hfff_margin-004px">Henüz sıralama yok</p>
                     <p class="u-font-size-12px_color-var-text-muted_margin-0">Üyeler odaklandıkça sıralama burada oluşur.</p>
                 </div>
             </div>

             <!-- TAKVİM -->
             <div id="group-gtab-calendar" class="group-detail-tab-content${_gtabActiveCls('calendar')}">
                 <div class="u-display-flex_align-items-center_justify-content-space-betw-11">
                     <h3 class="u-font-size-15px_margin-0_display-flex_align-items-center_ga-2">
                         <i class="fa-solid fa-calendar-week u-color-ha29bfe-2" ></i> Haftalık Seans Takvimi
                     </h3>
                 </div>

                 <!-- Hafta navigasyonu (Bugün en üstte, sağda; ok+etiket ortalanmış) -->
                 <div class="u-display-grid_grid-template-columns-1frauto1fr_align-items-">
                     <span></span>
                     <div class="u-display-flex_align-items-center_justify-content-center_gap-2">
                         <button id="gsc-prev-week" class="icon-btn u-color-var-text-muted_font-size-12px" title="Önceki hafta" aria-label="Önceki hafta"><i class="fa-solid fa-chevron-left"></i></button>
                         <span id="gsc-week-label" class="u-font-size-12px_color-var-text-muted_min-width-140px_text-a"></span>
                         <button id="gsc-next-week" class="icon-btn u-color-var-text-muted_font-size-12px" title="Sonraki hafta" aria-label="Sonraki hafta"><i class="fa-solid fa-chevron-right"></i></button>
                     </div>
                     <div class="u-display-flex_justify-content-flex-end">
                         <button id="gsc-today-btn" class="control-btn secondary u-font-size-11px_padding-5px10px" >Bugün</button>
                     </div>
                 </div>

                 <!-- 7 günlük takvim grid -->
                 <div class="gsc-week-grid" id="gsc-week-grid"></div>

                 <!-- Seçili günün seans listesi / ekleme paneli -->
                 <div class="gsc-day-detail" id="gsc-day-detail"></div>

                 <!-- İstatistikler -->
                 <div class="gsc-stats-row cols-4 u-margin-top-18px" >
                     <div class="gsc-stat-card">
                         <div class="gsc-stat-val" id="gsc-stat-planned">0</div>
                         <div class="gsc-stat-label">Bu hafta planlandı</div>
                     </div>
                     <div class="gsc-stat-card">
                         <div class="gsc-stat-val u-color-var-primary-color-2" id="gsc-stat-done" >0</div>
                         <div class="gsc-stat-label">Tamamlandı</div>
                     </div>
                     <div class="gsc-stat-card">
                         <div class="gsc-stat-val u-color-h74b9ff" id="gsc-stat-rsvp" >0</div>
                         <div class="gsc-stat-label">Katılımım var</div>
                     </div>
                     <div class="gsc-stat-card">
                         <div class="gsc-stat-val u-color-h74b9ff" id="gsc-stat-reliability" >–</div>
                         <div class="gsc-stat-label">Katılım Oranım</div>
                         <div id="gsc-stat-reliability-note" class="u-font-size-9px_color-rgba2552552550p3_margin-top-2px"></div>
                     </div>
                 </div>
             </div>

             <!-- GEÇMİŞ (tamamlanan seanslar) -->
             <div id="group-gtab-history" class="group-detail-tab-content${_gtabActiveCls('history')}">
                 <div id="group-history-list" class="u-display-flex_flex-direction-column_gap-8px"></div>
             </div>

             <!-- SINIF / EKİP PANELİ (Faz 3 — kurumsal; renderClassroomTab doldurur) -->
             <div id="group-gtab-classroom" class="group-detail-tab-content${_gtabActiveCls('classroom')}"></div>
        `;
       }

       // Aşama 1 (Faz H): showGroupDetails girişinde arka planda çalışan eski
       // grup dinleyicilerini kapatan blok. Modül-seviyesi state'e (groupMembersListenerRef
       // vb.) doğrudan erişiyor — showGroupDetails'in KENDİ closure'ına değil, dosyanın
       // üst seviyesindeki `let` değişkenlerine erişiyor, bu yüzden parametresiz taşınabildi.
       function _gdCleanupPreviousListeners() {
        if (groupMembersListenerRef) {
            groupMembersListenerRef.off();
            groupMembersListenerRef = null;
        }
        if (_managePermsListenerRef) {
            _managePermsListenerRef.off();
            _managePermsListenerRef = null;
        }
        if (_announcementListenerRef) {
            _announcementListenerRef.off();
            _announcementListenerRef = null;
        }
        if (window._announcementSupabaseChannel) {
            try { window.FocusSupabase.removeChannel(window._announcementSupabaseChannel); } catch (_) { console.warn('[FocusAI] sessiz hata:', _); }
            window._announcementSupabaseChannel = null;
        }
        if (_groupOverviewPresenceHandler) {
            window.removeEventListener('focusai:presence-changed', _groupOverviewPresenceHandler);
            _groupOverviewPresenceHandler = null;
        }
        if (_groupLeaderboardPresenceHandler) {
            window.removeEventListener('focusai:presence-changed', _groupLeaderboardPresenceHandler);
            _groupLeaderboardPresenceHandler = null;
        }
        if (_groupLeaderboardLiveChannel) {
            try { window.FocusSupabase.removeChannel(_groupLeaderboardLiveChannel); } catch (_) { console.warn('[FocusAI] sessiz hata:', _); }
            _groupLeaderboardLiveChannel = null;
        }
        clearTimeout(_groupLeaderboardLiveDebounce);
       }

       // Aşama 2 (Faz H): Supabase grup üyeleri canlı dinleyicisi + haftalık istatistik
       // yenileme + canlı liderlik tablosu kanalı. Sadece `data` parametresine ve modül-
       // seviyesi state'e (groupMembersListenerRef, _groupOverviewPresenceHandler,
       // _groupLeaderboardPresenceHandler, _groupLeaderboardLiveChannel/_groupLeaderboardLiveDebounce)
       // bağımlı — showGroupDetails'in diğer yerel değişkenlerine (activePanel, isOwner vb.)
       // hiç ihtiyaç duymuyor, bu yüzden ayrı fonksiyona TAŞINABİLDİ.
       async function _gdSetupMemberListeners(data) {
        if (window.FocusSupabase && currentUser?.id && data._supaId) {
            const refreshMembersSupabase = async () => {
                const { data: memberRows, error } = await window.FocusSupabase
                    .from('group_members')
                    .select('user_id, role, class_section_id, joined_at, profiles(id, username, display_name, avatar_color, custom_avatar, avatar_initials, xp, focus_min)')
                    .eq('group_id', data._supaId);

                if (error) console.error('[FocusAI] refreshMembersSupabase / group_members hata:', error);

                const membersData = {};
                for (const mr of (memberRows || [])) {
                    const profile = mr.profiles;
                    if (!profile) continue;
                    membersData[profile.username] = {
                        userId: mr.user_id,
                        displayName: profile.display_name || profile.username,
                        avatarColor: profile.avatar_color || '6c5ce7',
                        customAvatar: profile.custom_avatar || null, avatarInitials: profile.avatar_initials || null,
                        joinedAt: mr.joined_at ? new Date(mr.joined_at).getTime() : Date.now(),
                        role: mr.role || undefined,
                        // class_section_id sorgulanıp burada hiç atanmıyordu — bu fonksiyon
                        // grup paneli her açıldığında VE her group_members değişikliğinde
                        // (aşağıdaki postgres_changes aboneliği, aynı zamanda öğretmenin kendi
                        // şube atama UPDATE'i tarafından da tetikleniyor) data.members'ı BAŞTAN
                        // yazıyordu, _normalizeSupabaseGroup'un doğru okuduğu classSectionId'yi
                        // sessizce siliyordu — sonuç: sayfa yenilenince/panel açılınca öğrenci
                        // her zaman "Sınıfsız" görünüyordu (kullanıcı bildirimi, 2026-07-13).
                        classSectionId: mr.class_section_id || null,
                        xp: profile.xp || 0,
                        weeklyFocusMin: 0,
                        activeDays: 0,
                        prevWeekFocusMin: 0
                    };
                }

                // Bu haftaki (Pazartesi'den itibaren) odaklanma dakikaları + rozetler için
                // aktif gün sayısı + önceki hafta toplamı — güvenli RPC ile çekiliyor,
                // çünkü daily_stats kişiye özel RLS'li ve doğrudan sorgulanamıyor.
                try {
                    const { data: weeklyRows, error: weeklyErr } = await window.FocusSupabase
                        .rpc('group_weekly_member_stats', { p_group_id: data._supaId });
                    if (weeklyErr) {
                        console.warn('[FocusAI] group_weekly_member_stats RPC hatası:', weeklyErr.message);
                    } else {
                        const byUserId = {};
                        for (const u of Object.values(membersData)) byUserId[u.userId] = u;
                        for (const row of (weeklyRows || [])) {
                            const member = byUserId[row.user_id];
                            if (member) {
                                member.weeklyFocusMin = row.weekly_minutes || 0;
                                member.activeDays = row.active_days || 0;
                                member.prevWeekFocusMin = row.prev_week_minutes || 0;
                            }
                        }
                    }
                } catch (e) {
                    console.warn('[FocusAI] group_weekly_member_stats RPC çağrısı başarısız:', e.message);
                }

                data.members = membersData;
                await _renderGroupMembersPanel(data, membersData);
            };

            await refreshMembersSupabase();

            if (_groupOverviewPresenceHandler) _groupOverviewPresenceHandler();

            _groupLeaderboardPresenceHandler = () => _renderGroupMembersPanel(data, data.members);
            window.addEventListener('focusai:presence-changed', _groupLeaderboardPresenceHandler);

            const _gmChannel = window.FocusSupabase
                .channel(`group-members-${data._supaId}`)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members', filter: `group_id=eq.${data._supaId}` }, () => refreshMembersSupabase())
                .subscribe();

            groupMembersListenerRef = { off: () => window.FocusSupabase.removeChannel(_gmChannel) };

            // ── CANLI LİDERLİK TABLOSU ──
            // Bir üye odaklanırken window.syncXP() her ~1 dakikada bir profiles.xp/focus_min günceller.
            // Bu güncellemeyi dinleyip leaderboard'u (ve haftalık RPC'yi) debounce ile yeniden çekiyoruz,
            // böylece "Senin Konumun" ve sıralama sekme değiştirmeden/yenilemeden canlı kalıyor.
            _groupLeaderboardLiveChannel = window.FocusSupabase
                .channel(`group-leaderboard-live-${data._supaId}`)
                .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, payload => {
                    if (!data.members || !payload.new) return;
                    const isGroupMember = Object.values(data.members).some(m => m.userId === payload.new.id);
                    if (!isGroupMember) return;
                    clearTimeout(_groupLeaderboardLiveDebounce);
                    _groupLeaderboardLiveDebounce = setTimeout(() => refreshMembersSupabase(), 1500);
                })
                .subscribe();
        }
       }

       // Aşama 3 (Faz H devamı): Sıralama sekmesi ("Bu Hafta"/"Tüm Zamanlar") buton bağlama.
       // Sadece activePanel + data'ya ihtiyaç duyar, module-level _groupLeaderboardMode'a
       // serbestçe erişir (closure-hapsi değil).
       function _gdBindLeaderboardModeTabs(activePanel, data) {
           const _syncLeaderboardModeTabs = () => {
               activePanel.querySelectorAll(".glb-mode-btn").forEach(b => {
                   const active = b.dataset.mode === _groupLeaderboardMode;
                   b.style.background = active ? 'var(--primary-color)' : 'transparent';
                   b.style.color = active ? '#fff' : 'var(--text-muted)';
               });
               const hint = document.getElementById("group-leaderboard-mode-hint");
               if (hint) {
                   hint.textContent = _groupLeaderboardMode === 'weekly'
                       ? 'Her Pazartesi sıfırlanır — bu haftaki odaklanma süresine göre sıralanır.'
                       : 'Katılımdan bu yana toplam odaklanma süresine göre sıralanır.';
               }
           };
           _syncLeaderboardModeTabs();
           activePanel.querySelectorAll(".glb-mode-btn").forEach(btn => {
               btn.onclick = () => {
                   if (_groupLeaderboardMode === btn.dataset.mode) return;
                   _groupLeaderboardMode = btn.dataset.mode;
                   _syncLeaderboardModeTabs();
                   if (data.members) _renderGroupMembersPanel(data, data.members);
               };
           });
       }

       // Aşama 4: Kudos delegasyonu + arkadaş davet butonu bağlama.
       function _gdBindKudosAndInvite(activePanel, code, data) {
           // 👏 Kudos butonları (panel her render olduğunda yeniden eklendiği için delegasyonla dinleniyor)
           activePanel.addEventListener("click", e => {
               const kudosBtn = e.target.closest(".group-kudos-btn");
               if (!kudosBtn) return;
               e.stopPropagation();
               sendGroupKudos(kudosBtn.dataset.userId, kudosBtn.dataset.username, kudosBtn);
           });

           // Arkadaşını gruba davet et — ayrı mini modal üzerinden
           const inviteBtn = document.getElementById("group-invite-friend-btn");
           if (inviteBtn) {
               inviteBtn.onclick = () => window.openGroupInviteModal(code, data);
           }
       }

       // Aşama 5: Sabitlenmiş duyuru banner'ı + düzenleme + "Grup Yönetimi"/Tema butonları.
       // Sadece Supabase grupları için çalışır (data._supaId).
       function _gdBindAnnouncementPanel(activePanel, code, data) {
           const announcementBanner = document.getElementById("group-announcement-banner");
           const announcementText = document.getElementById("group-announcement-text");
           const announcementEditBtn = document.getElementById("group-announcement-edit-btn");
           const announcementEditor = document.getElementById("group-announcement-editor");
           const announcementInput = document.getElementById("group-announcement-input");
           const announcementSaveBtn = document.getElementById("group-announcement-save-btn");
           const announcementCancelBtn = document.getElementById("group-announcement-cancel-btn");

           if (!data._supaId) return;

           // M2b-4 Bölüm 1: Supabase grupları için duyuru banner'ı (groups.announcement jsonb)
           if (announcementBanner && announcementText) {
               const renderAnnouncement = (ann) => {
                   if (ann && ann.text) {
                       announcementText.textContent = ann.text;
                       announcementBanner.classList.remove("hidden");
                   } else {
                       announcementText.textContent = "";
                       announcementBanner.classList.add("hidden");
                   }
               };
               renderAnnouncement(data.announcement);

               if (window._announcementSupabaseChannel) {
                   try { window.FocusSupabase.removeChannel(window._announcementSupabaseChannel); } catch (_) { console.warn('[FocusAI] sessiz hata:', _); }
                   window._announcementSupabaseChannel = null;
               }
               window._announcementSupabaseChannel = window.FocusSupabase
                   .channel(`group-announcement-${data._supaId}`)
                   .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'groups', filter: `id=eq.${data._supaId}` }, payload => {
                       if (window.__getCurrentActiveGroupCodeRef() !== code) return;
                       data.announcement = payload.new.announcement || null;
                       renderAnnouncement(data.announcement);
                   })
                   .subscribe();
           }

           if (announcementEditBtn && announcementEditor && announcementInput) {
               announcementEditBtn.classList.toggle("hidden", !window._isSupabaseGroupAdmin(code));
               announcementEditBtn.onclick = () => {
                   announcementInput.value = announcementText ? announcementText.textContent : "";
                   announcementEditor.classList.remove("hidden");
                   announcementInput.focus();
               };
               if (announcementCancelBtn) {
                   announcementCancelBtn.onclick = () => {
                       announcementEditor.classList.add("hidden");
                   };
               }
               if (announcementSaveBtn) {
                   announcementSaveBtn.onclick = async () => {
                       const text = announcementInput.value.trim();
                       const announcement = text
                           ? { text, setBy: currentUser.id, setByName: currentUser.displayName || currentUser.username, timestamp: Date.now() }
                           : null;
                       const { error } = await window.FocusSupabase.from('groups').update({ announcement }).eq('id', data._supaId);
                       if (error) { window.dcShowToast('Duyuru kaydedilemedi: ' + error.message); return; }
                       data.announcement = announcement;
                       announcementEditor.classList.add("hidden");
                       logGroupAuditSupabase(data._supaId, 'announcement_update', text ? 'Duyuru güncellendi' : 'Duyuru kaldırıldı');
                       // "Duyuru Geçmişi" kartı için kalıcı kayıt (audit log admin-only olduğundan öğrenciye görünmez)
                       if (text) {
                           window.FocusSupabase.from('group_announcement_log').insert({
                               group_id: data._supaId, text,
                               author_id: currentUser.id, author_name: currentUser.displayName || currentUser.username,
                           }).then(({ error: galErr }) => { if (galErr) console.warn('[Duyuru Geçmişi] kayıt hatası', galErr.message); });
                       }
                       // Kurumsal panel: duyuru tüm üyelere bildirim olarak gider —
                       // öğrenci sohbete girmeden (girişi de yok) duyurudan haberdar olur.
                       if (text) {
                           const rows = Object.values(data.members || {})
                               .filter(m => m.userId && m.userId !== currentUser.id)
                               .map(m => ({
                                   user_id: m.userId, type: 'group_announcement',
                                   payload: {
                                       groupName: data.name, groupCode: code,
                                       text: text.slice(0, 140),
                                       fromName: currentUser.displayName || currentUser.username
                                   }
                               }));
                           if (rows.length) {
                               window.FocusSupabase.from('notifications').insert(rows)
                                   .then(({ error: nErr }) => { if (nErr) console.warn('[Duyuru] bildirim gönderilemedi', nErr.message); });
                           }
                       }
                   };
               }
           }

           // M2b-4 Bölüm 1: "Grup Yönetimi" butonu — Bölüm 2'ye kadar sadece admin
           const managePermsBtnSupa = document.getElementById("group-manage-perms-btn");
           if (managePermsBtnSupa) {
               const canManageSupa = window._isSupabaseGroupAdmin(code);
               managePermsBtnSupa.classList.toggle("hidden", !canManageSupa);
               managePermsBtnSupa.onclick = function() {
                   openGroupManagementModalSupabase(code, data._supaId, data);
               };
           }

           // Tema butonu — sadece admin; tercih localStorage'a kaydedilir
           const themeBtn = document.getElementById("group-theme-btn");
           if (themeBtn && window._isSupabaseGroupAdmin(code)) {
               themeBtn.classList.remove("hidden");
               _applyGroupTheme(data._supaId);
               themeBtn.onclick = () => _openGroupThemePicker(data._supaId, themeBtn);
           }
       }

       // Aşama 6: "Ayrıl" butonu görsel kurulumu + tıklama handler'ı (sahiplik devri
       // dahil). Sadece code/data/isOwner'a (showGroupDetails'in kendi parametre/lokalleri)
       // ihtiyaç duyar, module-level groupMembersListenerRef/_managePermsListenerRef'e
       // serbestçe erişir.
       function _gdBindLeaveButton(code, data, isOwner) {
           const leaveBtn = document.getElementById("group-leave-btn");
           if (!leaveBtn) return;

           leaveBtn.classList.remove("hidden");
           leaveBtn.style.display = "inline-block";
           leaveBtn.disabled = false;

           if (isOwner) {
               leaveBtn.innerHTML = '<i class="fa-solid fa-door-open"></i> Ayrıl';
               leaveBtn.style.background = "rgba(255, 255, 255, 0.05)";
               leaveBtn.style.color = "#ff4757";
               leaveBtn.style.borderColor = "rgba(255, 71, 87, 0.2)";
           } else {
               leaveBtn.innerHTML = '<i class="fa-solid fa-door-open"></i> Ayrıl';
               leaveBtn.style.background = "rgba(255, 255, 255, 0.05)";
               leaveBtn.style.color = "#ff4757";
               leaveBtn.style.borderColor = "rgba(255, 71, 87, 0.2)";
           }

           leaveBtn.onclick = async function() {
               // ── SUPABASE: gruptan ayrılma ──
               if (window.FocusSupabase && currentUser?.id && data._supaId) {
                   const groupId = data._supaId;

                   if (isOwner) {
                       const { data: allMembers } = await window.FocusSupabase
                           .from('group_members')
                           .select('user_id, role, class_section_id, joined_at, profiles(username, display_name)')
                           .eq('group_id', groupId);
                       const others = (allMembers || []).filter(m => m.user_id !== currentUser.id);

                       if (others.length === 0) {
                           const ok = await window.showFocusaiConfirm({
                               title: 'Grubu Sil',
                               desc: `<b>"${_escapeHtml(data.name)}"</b> grubunda başka üye kalmadı.<br>Gruptan ayrılmak bu grubu kalıcı olarak silecek.`,
                               type: 'danger',
                               icon: 'fa-trash-can',
                               confirmText: 'Evet, Sil',
                               cancelText: 'Vazgeç'
                           });
                           if (!ok) return;

                           leaveBtn.disabled = true;
                           if (groupMembersListenerRef) groupMembersListenerRef.off();
                           if (_managePermsListenerRef) _managePermsListenerRef.off();

                           await window.FocusSupabase.from('groups').delete().eq('id', groupId);
                           await window.FocusSupabase.from('group_leave_log')
                               .upsert({ user_id: currentUser.id, group_id: groupId, left_at: new Date().toISOString() });

                           resetActiveGroupPanel();
                           if (typeof window.__dcCloseChatIfGroup === 'function') window.__dcCloseChatIfGroup(code);
                           window.loadMyGroups();
                           if (typeof window.loadUserGroupsForDc === 'function') window.loadUserGroupsForDc();
                           return;
                       }

                       let newOwner = null;
                       const isInstitutional = data.classroomType === 'classroom' || data.classroomType === 'workplace';

                       if (isInstitutional) {
                           // Sınıf/ders ve iş yeri/ekip gruplarında sahip, devir edilecek kişiyi kendi seçer.
                           const chosenId = await _pickNewOwner(others, data.name);
                           if (!chosenId) return;
                           newOwner = others.find(m => m.user_id === chosenId);
                           if (!newOwner) return;
                       } else {
                           // Diğer gruplarda en yüksek hiyerarşi sıralı (priority) üye otomatik seçilir;
                           // eşitlik durumunda en eski katılan.
                           let bestPriority = -Infinity;
                           let bestJoinedAt = Infinity;
                           for (const m of others) {
                               const p = getRolePriority(m.role || 'member', {});
                               const joinedAt = m.joined_at ? new Date(m.joined_at).getTime() : Infinity;
                               if (p > bestPriority || (p === bestPriority && joinedAt < bestJoinedAt)) {
                                   bestPriority = p;
                                   bestJoinedAt = joinedAt;
                                   newOwner = m;
                               }
                           }

                           const newOwnerName = (newOwner.profiles && (newOwner.profiles.display_name || newOwner.profiles.username)) || '?';
                           const ok = await window.showFocusaiConfirm({
                               title: 'Gruptan Ayrıl',
                               desc: `<b>"${_escapeHtml(data.name)}"</b> grubunun sahibisiniz.<br>Ayrılırsan grup sahipliği <b>@${_escapeHtml(newOwnerName)}</b> kullanıcısına devredilecek.`,
                               type: 'danger',
                               icon: 'fa-door-open',
                               confirmText: 'Devret ve Ayrıl',
                               cancelText: 'Vazgeç'
                           });
                           if (!ok) return;
                       }

                       leaveBtn.disabled = true;
                       if (groupMembersListenerRef) groupMembersListenerRef.off();
                       if (_managePermsListenerRef) _managePermsListenerRef.off();

                       const { error: ownerUpdErr } = await window.FocusSupabase.from('group_members').update({ role: 'admin' }).eq('group_id', groupId).eq('user_id', newOwner.user_id);
                       if (ownerUpdErr) { window.dcShowToast('Sahiplik devri başarısız: ' + ownerUpdErr.message); leaveBtn.disabled = false; return; }
                       const { error: groupUpdErr } = await window.FocusSupabase.from('groups').update({ created_by: newOwner.user_id }).eq('id', groupId);
                       if (groupUpdErr) { window.dcShowToast('Sahiplik devri başarısız: ' + groupUpdErr.message); leaveBtn.disabled = false; return; }
                       const newOwnerUsername = newOwner.profiles && newOwner.profiles.username;
                       if (typeof logGroupAuditSupabase === 'function') {
                           logGroupAuditSupabase(groupId, 'ownership_transfer', `Sahiplik ${newOwnerUsername ? '@' + newOwnerUsername : 'başka bir üyeye'} kullanıcısına devredildi (önceki sahip ayrıldı)`);
                       }
                       const { error: leaveDelErr } = await window.FocusSupabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', currentUser.id);
                       if (leaveDelErr) { window.dcShowToast('Gruptan ayrılma başarısız: ' + leaveDelErr.message); leaveBtn.disabled = false; return; }
                       await window.FocusSupabase.from('group_leave_log')
                           .upsert({ user_id: currentUser.id, group_id: groupId, left_at: new Date().toISOString() });

                       resetActiveGroupPanel();
                       if (typeof window.__dcCloseChatIfGroup === 'function') window.__dcCloseChatIfGroup(code);
                       window.loadMyGroups();
                       if (typeof window.loadUserGroupsForDc === 'function') window.loadUserGroupsForDc();
                   } else {
                       const ok = await window.showFocusaiConfirm({
                           title: 'Gruptan Ayrıl',
                           desc: `<b>"${_escapeHtml(data.name)}"</b> grubundan ayrılmak istediğine emin misin?`,
                           type: 'danger',
                           icon: 'fa-door-open',
                           confirmText: 'Ayrıl',
                           cancelText: 'Vazgeç'
                       });
                       if (!ok) return;

                       leaveBtn.disabled = true;
                       if (groupMembersListenerRef) groupMembersListenerRef.off();
                       if (_managePermsListenerRef) _managePermsListenerRef.off();

                       const { error: leaveDelErr } = await window.FocusSupabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', currentUser.id);
                       if (leaveDelErr) { window.dcShowToast('Gruptan ayrılma başarısız: ' + leaveDelErr.message); leaveBtn.disabled = false; return; }
                       await window.FocusSupabase.from('group_leave_log')
                           .upsert({ user_id: currentUser.id, group_id: groupId, left_at: new Date().toISOString() });

                       resetActiveGroupPanel();
                       if (typeof window.__dcCloseChatIfGroup === 'function') window.__dcCloseChatIfGroup(code);
                       window.loadMyGroups();
                       if (typeof window.loadUserGroupsForDc === 'function') window.loadUserGroupsForDc();
                   }
                   return;
               }
           };
       }

       // Aşama 7: Panel sekme geçişleri (Genel Bakış/Sınıf Paneli/Takvim/Geçmiş) bağlama
       // + restore hedefine göre ilk sekmenin içerik-doldurma yan etkisini tetikleme.
       function _gdBindPanelTabs(code, data, activePanel, _isClassAdmin, _restoreTargetGtab, _defaultGtab) {
           // Sekme geçişleri — hangi sekmede olunduğu, sayfa yenilemesinde grup
           // paneline (ve o sekmeye) geri dönebilmek için de kaydedilir (bkz.
           // _dcPersistLastOpen / _dcRestoreLastOpenOnLoad, aksi halde yenileme
           // kullanıcıyı Genel Bakış/Sınıf Paneli/Takvim/Geçmiş'ten atıp grubun
           // #genel sohbetini açıyordu).
           const _persistGroupPanelTab = (gtab) => {
               if (typeof window._dcPersistLastOpen === 'function') window._dcPersistLastOpen({ fn: 'group-panel', code, gtab });
           };
           activePanel.querySelectorAll(".group-detail-tab-btn").forEach(btn => {
               btn.onclick = () => {
                   activePanel.querySelectorAll(".group-detail-tab-btn").forEach(b => b.classList.remove("active"));
                   activePanel.querySelectorAll(".group-detail-tab-content").forEach(c => c.classList.remove("active"));
                   btn.classList.add("active");
                   const target = activePanel.querySelector(`#group-gtab-${btn.dataset.gtab}`);
                   if (target) target.classList.add("active");
                   _persistGroupPanelTab(btn.dataset.gtab);
                   window._pendingGroupPanelGtab = null; // gerçek bir sekme tıklaması oldu, artık bekleyen bir restore hedefi yok
                   if (btn.dataset.gtab === 'history') {
                       gscRenderHistory();
                   }
                   if (btn.dataset.gtab === 'overview')  gscRenderActivityFeed();
                   if (btn.dataset.gtab === 'classroom') {
                       window.renderClassroomTabCached(data, _isClassAdmin);
                   }
               };
           });
           // Panel, yukarıda hesaplanan _restoreTargetGtab varsa doğrudan O sekmeyle
           // (Genel Bakış'a hiç uğramadan) render edildi — burada sadece o sekmenin
           // içerik doldurma yan etkisini (tıklama olmadığı için) manuel tetikliyoruz
           // ve durumu kaydediyoruz. Restore hedefi yoksa normal varsayılan "Genel
           // Bakış" ile açılır ve onun yan etkisi (gscRenderActivityFeed) çalışır.
           const _initialGtab = _restoreTargetGtab || _defaultGtab;
           _persistGroupPanelTab(_initialGtab);
           window._pendingGroupPanelGtab = null; // tüketildi
           if (_initialGtab === 'overview') gscRenderActivityFeed();
           if (_initialGtab === 'classroom') window.renderClassroomTabCached(data, _isClassAdmin);
           if (_initialGtab === 'history') {
               gscRenderHistory();
           }
       }

       async function showGroupDetails(code, data) {
        // Eğer arka planda çalışan eski bir grup dinleyicisi varsa önce onu KESİNLİKLE kapat
        _gdCleanupPreviousListeners();

        window.__setCurrentActiveGroupCodeRef(code);
        
        const groupOwner = data.createdBy || currentUser.username;
        const isOwner = groupOwner === currentUser.username;

        const activePanel = document.getElementById("active-group-panel");
        if (!activePanel) return;

        // Sayfa yenileme restorasyonu belirli bir sekmeye (ör. Sınıf Paneli)
        // dönmek istiyorsa, o sekmeyi EN BAŞTAN aktif render eder — "önce Genel
        // Bakış render olup sonra programatik tıklamayla Sınıf Paneli'ne geçme"
        // sırasında yaşanan görünür titremeyi (flash) tamamen ortadan kaldırır.
        const _isInstitutionalGroup = (data.classroomType === 'classroom' || data.classroomType === 'workplace');
        const _isClassAdmin = _isInstitutionalGroup && window._isInstitutionalAdmin(data, isOwner);
        // Öğrenci için kurumsal gruplarda "Genel Bakış" sekmesi kaldırıldı (2026-07-12,
        // kullanıcı geri bildirimi) — içeriği zaten sadece stat kartları + "Sınıf Paneline
        // Git" butonuna inmişti, öğrenci doğrudan Sınıf Paneli'ne (Performansım dahil) inebilir.
        const _showOverviewTab = !_isInstitutionalGroup || _isClassAdmin;
        const _restoreTargetGtab = _gdComputeRestoreTargetGtab(window._pendingGroupPanelGtab, _showOverviewTab, _isInstitutionalGroup);
        const _defaultGtab = _showOverviewTab ? 'overview' : 'classroom';
        const _gtabActiveCls = (name) => _gdTabActiveClass(name, _restoreTargetGtab, _defaultGtab);

        // Paneli temiz ve dinamik olarak sıfırdan kur (aşağıdaki innerHTML atamasıyla
        // #group-gtab-classroom dahil TÜM alt elemanlar yok edilip BOŞ olarak yeniden
        // oluşturuluyor). renderClassroomTabCached'in 45sn'lik TTL cache'i (_classroomTabCache,
        // gid'e göre) bu yıkımdan HABERSİZ — aynı gruba 45sn içinde tekrar girilirse cache
        // "zaten güncel" sanıp render'ı hiç çalıştırmıyor, yeni oluşan boş div hiç
        // doldurulmuyordu ("Sınıf Paneli hiç yüklenmiyor" — kullanıcı bildirimi, 2026-07-13).
        // Panel her sıfırdan kurulduğunda önbelleği de geçersiz kılıyoruz.
        if (data._supaId) window._classroomTabCache?.delete(data._supaId);
        activePanel.innerHTML = _renderGroupDetailsPanelHtml(code, data, _showOverviewTab, _gtabActiveCls);

        document.getElementById("active-group-name").textContent = data.name;
        document.getElementById("active-group-desc").textContent = data.description || '';

        if (_showOverviewTab) {
            window.renderInstitutionalOverviewIntro(data, _isClassAdmin);
        }

        // Supabase grupları: presence değiştikçe "Şu An Aktif" sayacını canlı güncelle
        if (data._supaId) {
            _groupOverviewPresenceHandler = () => {
                const statEl = document.getElementById("group-overview-active-now");
                if (statEl) statEl.textContent = computeActiveNowCount(data);
            };
            window.addEventListener('focusai:presence-changed', _groupOverviewPresenceHandler);
        }

        _gdBindPanelTabs(code, data, activePanel, _isClassAdmin, _restoreTargetGtab, _defaultGtab);

        _gdBindLeaderboardModeTabs(activePanel, data);
        _gdBindKudosAndInvite(activePanel, code, data);
        _gdBindAnnouncementPanel(activePanel, code, data);

        _gdBindLeaveButton(code, data, isOwner);


        // Yeni grubun veritabanı kanalını dinlemeye başla (Aşama 2, bkz. _gdSetupMemberListeners)
        await _gdSetupMemberListeners(data);

        // Seans takvimini başlat
        try { initGroupSessionCalendar(code, data._supaId || null, data.classroomType === 'classroom' || data.classroomType === 'workplace'); } catch(e) { console.warn('[GSC] Takvim başlatma hatası:', e); }
    }

       function resetActiveGroupPanel() {
           // Açık dinleyici varsa güvenle imha et
           if (groupMembersListenerRef) {
               groupMembersListenerRef.off();
               groupMembersListenerRef = null;
           }
           if (_managePermsListenerRef) {
               _managePermsListenerRef.off();
               _managePermsListenerRef = null;
           }
           if (_announcementListenerRef) {
               _announcementListenerRef.off();
               _announcementListenerRef = null;
           }
           if (window._announcementSupabaseChannel) {
               try { window.FocusSupabase.removeChannel(window._announcementSupabaseChannel); } catch (_) { console.warn('[FocusAI] sessiz hata:', _); }
               window._announcementSupabaseChannel = null;
           }
           if (getGmMembersSupabaseChannel()) {
               try { window.FocusSupabase.removeChannel(getGmMembersSupabaseChannel()); } catch (_) { console.warn('[FocusAI] sessiz hata:', _); }
               setGmMembersSupabaseChannel(null);
           }
           if (getGmCustomRolesSupabaseChannel()) {
               try { window.FocusSupabase.removeChannel(getGmCustomRolesSupabaseChannel()); } catch (_) { console.warn('[FocusAI] sessiz hata:', _); }
               setGmCustomRolesSupabaseChannel(null);
           }
           if (_groupLeaderboardLiveChannel) {
               try { window.FocusSupabase.removeChannel(_groupLeaderboardLiveChannel); } catch (_) { console.warn('[FocusAI] sessiz hata:', _); }
               _groupLeaderboardLiveChannel = null;
           }
           clearTimeout(_groupLeaderboardLiveDebounce);
           // Takvim dinleyicisini, hatırlatma zamanlayıcısını ve seans cache'ini
           // temizle (social-group-session-calendar.js'in kendi iç state'i).
           gscResetState();

           window.__setCurrentActiveGroupCodeRef(null);

           const activePanel = document.getElementById('active-group-panel');
           if (activePanel) {
               activePanel.innerHTML = `
                   <div class="u-text-align-center_padding-40px20px_color-var-text-muted">
                       <i class="fa-solid fa-people-group u-font-size-32px_margin-bottom-15px_color-var-primary-color_" ></i>
                       <p class="u-margin-0_font-size-14px">Henüz aktif bir grubunuz yok.</p>
                       <p class="u-margin-5px000_font-size-12px_opacity-0p7">Yandaki listeden bir gruba katılabilir veya yeni bir grup oluşturabilirsiniz.</p>
                   </div>
               `;
           }

           document.querySelectorAll(".my-group-card-item").forEach(c => c.classList.remove("active-hub-group"));
           window.loadMyGroups();
       }
       window.resetActiveGroupPanel = resetActiveGroupPanel;
       window.showGroupDetails = showGroupDetails;
