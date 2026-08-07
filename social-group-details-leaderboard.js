// social-group-details-leaderboard.js
// social-group-details.js'ten çıkarıldı: liderlik tablosu/rozet render'ları +
// birkaç saf yardımcı fonksiyon. showGroupDetails'in closure state'ini
// okumaz/yazmaz — leaderboardMode gibi paylaşılan değerler parametre olarak
// açıkça geçiriliyor.

import { getGscSessionsCache, getGscGroupKey, gscGetWeekDates, gscDateKey, computeGroupAchievements as _computeGroupAchievements } from './social-group-session-calendar.js';
import { BUILTIN_ROLE_PERMS } from './social-roles.js';

// Sıralama rozeti: ilk 3 için madalya emojisi, sonrası için "#N". Önceden
// showGroupDetails içinde iki ayrı yerde (leaderboardData + yourRankCard)
// birbirinden bağımsız aynı rankIcons dizisiyle tekrarlanıyordu.
const _GD_RANK_ICONS = ['🥇', '🥈', '🥉'];
export function _gdRankLabel(idx) {
    return idx < 3 ? _GD_RANK_ICONS[idx] : `#${idx + 1}`;
}

// Sayfa yenileme restorasyonunda hangi grup-sekmesinin (gtab) en başta
// aktif render edileceğini hesaplar. pendingGtab: window._pendingGroupPanelGtab
// değeri; showOverviewTab/isInstitutionalGroup çağıran taraf tarafından
// önceden hesaplanıp geçirilir.
export function _gdComputeRestoreTargetGtab(pendingGtab, showOverviewTab, isInstitutionalGroup) {
    if (pendingGtab === 'overview') return showOverviewTab ? 'overview' : null;
    if (pendingGtab === 'classroom') return isInstitutionalGroup ? 'classroom' : null; // kurumsal olmayan grupta bu sekme yok
    if (pendingGtab === 'leaderboard') return isInstitutionalGroup ? null : 'leaderboard'; // kurumsal grupta bu sekme yok
    if (pendingGtab === 'calendar' || pendingGtab === 'history') return pendingGtab;
    return null;
}

// Bir sekme butonunun/panelinin "active" CSS sınıfını alıp almayacağını
// hesaplar: restoreTarget varsa ona göre, yoksa defaultTab'a göre karar verir.
export function _gdTabActiveClass(name, restoreTarget, defaultTab) {
    return (restoreTarget ? name === restoreTarget : name === defaultTab) ? ' active' : '';
}

// _renderGroupMembersPanel'den ayrılan: haftanın yıldızları rozet paneli.
// groupLeaderboardMode: showGroupDetails'in _groupLeaderboardMode state'i, çağıran taraf geçirir.
export function _renderGroupWeeklyBadges(leaderboardData, data, groupLeaderboardMode) {
    const badgesEl = document.getElementById('group-weekly-badges');
    if (badgesEl) {
        const badges = [];
        const addBadge = (icon, label, member, detail, color) => {
            if (!member) return;
            badges.push({ icon, label, name: member.uData.displayName || member.username, detail, color });
        };

        if (groupLeaderboardMode === 'weekly' && leaderboardData.length >= 2) {
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
        } else if (groupLeaderboardMode === 'alltime') {
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
// groupLeaderboardMode: showGroupDetails'in _groupLeaderboardMode state'i, çağıran taraf geçirir.
export function _renderGroupYourRankCard(leaderboardData, data, groupLeaderboardMode) {
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
            if (groupLeaderboardMode === 'weekly') {
                const behind = leaderboardData[myIdx + 1];
                const RIVAL_THRESHOLD_MIN = 15;
                if (behind && me.focusMin > 0) {
                    const behindGap = me.focusMin - behind.focusMin;
                    if (behindGap <= RIVAL_THRESHOLD_MIN) {
                        const warnKey = `focusai_rival_warn_${data._supaId}_${window._currentWeekStartKey()}_${behind.username}`;
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
export function _renderGroupLeaderboardList(leaderboardData, data, membersData, isSupabaseGroup, supaCustomRoles) {
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
