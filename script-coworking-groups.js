// Faz F: Ortak Odaklanma Odası (co-working) + Gruplar (mock) mini modülü — script.js'ten çıkarıldı.
// Bağımlılıklar: window.showPremiumModal, window.escapeHtml.
(function () {
    const coWorkingIdle = document.getElementById('co-working-idle');
    const coWorkingActive = document.getElementById('co-working-active');
    const cwMinutesDisplay = document.getElementById('cw-minutes');
    const cwSecondsDisplay = document.getElementById('cw-seconds');
    const cwFriendImg = document.getElementById('cw-friend-img');
    const cwFriendName = document.getElementById('cw-friend-name');
    const cwLeaveBtn = document.getElementById('cw-leave-btn');
    const cwPokeBtn = document.getElementById('cw-poke-btn');

    const inviteModal = document.getElementById('coworking-invite-modal');
    const inviteFriendName = document.getElementById('invite-friend-name');
    const acceptInviteBtn = document.getElementById('accept-invite-btn');
    const declineInviteBtn = document.getElementById('decline-invite-btn');

    let cwTimerInterval;
    let cwTimeLeft = 25 * 60;

    window.sendCoWorkingInvite = function(name, avatar) {
        window.showPremiumModal({
            title: 'Davet Gönderildi',
            message: `${name} adlı arkadaşına sanal odak odası daveti gönderildi. Yanıt bekleniyor...`,
            type: 'info'
        });

        setTimeout(() => {
            const premiumModal = document.getElementById('premium-modal');
            if (premiumModal) premiumModal.classList.add('hidden');
            startCoWorkingRoom(name, avatar);
            window.showPremiumModal({
                title: 'Davet Kabul Edildi!',
                message: `${name} davetini kabul etti. Ortak odaklanma seansı başlıyor!`,
                type: 'success'
            });
        }, 2500);
    };

    function simulateIncomingInvite() {
    }
    window.simulateIncomingInvite = simulateIncomingInvite;


    function startCoWorkingRoom(friendName, friendAvatar) {
        if(coWorkingIdle && coWorkingActive) {
            coWorkingIdle.classList.add('hidden');
            coWorkingActive.classList.remove('hidden');

            cwFriendName.textContent = friendName;
            cwFriendImg.src = friendAvatar;

            cwTimeLeft = 25 * 60;

            updateCwTimerDisplay();

            clearInterval(cwTimerInterval);
            cwTimerInterval = setInterval(() => {
                cwTimeLeft--;
                updateCwTimerDisplay();
                if(cwTimeLeft <= 0) {
                    clearInterval(cwTimerInterval);
                    window.showPremiumModal({
                        title: 'Ortak Seans Bitti!',
                        message: `Harika iş çıkardınız! ${friendName} ile ortak odaklanma seansını başarıyla tamamladınız. Sana +50 XP eklendi!`,
                        type: 'success'
                    });
                    leaveCoWorkingRoom();
                }
            }, 1000);
        }
    }

    function updateCwTimerDisplay() {
        if(!cwMinutesDisplay || !cwSecondsDisplay) return;
        const m = Math.floor(cwTimeLeft / 60);
        const s = cwTimeLeft % 60;
        cwMinutesDisplay.textContent = String(m).padStart(2, '0');
        cwSecondsDisplay.textContent = String(s).padStart(2, '0');
    }

    function leaveCoWorkingRoom() {
        clearInterval(cwTimerInterval);
        if(coWorkingActive && coWorkingIdle) {
            coWorkingActive.classList.add('hidden');
            coWorkingIdle.classList.remove('hidden');
        }
    }
    window.leaveCoWorkingRoom = leaveCoWorkingRoom;

    if(cwPokeBtn) {
        cwPokeBtn.addEventListener('click', () => {
            window.showPremiumModal({
                title: 'Motivasyon Gönderildi!',
                message: `Arkadaşını dürttün! Onun ekranında motivasyon gönderdiğine dair şık bir bildirim belirecek.`,
                type: 'success'
            });
        });
    }

    // TEK PANEL: sosyal sekme geçiş kodu kaldırıldı — tek panel dc-chat-area içinde yönetiliyor.

    const mockGroups = [
        {
            id: "g1",
            name: "YKS 2025 Sayısal",
            desc: "Derece isteyenler burada. Minimum günlük 4 saat odaklanma hedefi.",
            members: 145,
            weeklyGoalMax: 50000,
            weeklyGoalCurrent: 38500,
            leaderboard: [
                { name: "Ahmet Y.", score: 2100, isMe: false },
                { name: "Sen", score: 1850, isMe: true },
                { name: "Zeynep K.", score: 1720, isMe: false },
                { name: "Caner T.", score: 1500, isMe: false },
                { name: "Elif B.", score: 1240, isMe: false }
            ],
            activeMembers: [
                { name: "Ahmet", status: "Matematik Çözüyor", avatar: "A", color: "#e84393" },
                { name: "Zeynep", status: "Fizik Tekrarı", avatar: "Z", color: "#00b894" },
                { name: "Kerem", status: "Deneme Sınavı", avatar: "K", color: "#0984e3" },
                { name: "Sen", status: "Biyoloji Okuması", avatar: "S", color: "#6c5ce7", isMe: true }
            ]
        },
        {
            id: "g2",
            name: "Yazılım Bootcamp Cohort 3",
            desc: "Frontend ve Backend geliştiricileri. Birlikte kodluyoruz.",
            members: 42,
            weeklyGoalMax: 20000,
            weeklyGoalCurrent: 8400,
            leaderboard: [
                { name: "Oğuzhan", score: 1400, isMe: false },
                { name: "Merve", score: 1250, isMe: false },
                { name: "Sen", score: 900, isMe: true },
                { name: "Ali", score: 850, isMe: false }
            ],
            activeMembers: [
                { name: "Oğuzhan", status: "React Projesi", avatar: "O", color: "#fdcb6e" },
                { name: "Merve", status: "API Entegrasyonu", avatar: "M", color: "#d63031" }
            ]
        },
        {
            id: "g3",
            name: "Kitap Okuma Kulübü",
            desc: "Günde en az 30 sayfa. Zihni dinlendir.",
            members: 210,
            weeklyGoalMax: 10000,
            weeklyGoalCurrent: 9500,
            leaderboard: [
                { name: "Ayşe", score: 800, isMe: false },
                { name: "Fatma", score: 750, isMe: false },
                { name: "Sen", score: 300, isMe: true }
            ],
            activeMembers: [
                { name: "Ayşe", status: "Suç ve Ceza", avatar: "A", color: "#6c5ce7" }
            ]
        }
    ];

    function renderMyGroups() {
        const container = document.getElementById('my-groups-container');
        if(!container) return;

        container.innerHTML = '';

        mockGroups.forEach(group => {
            const card = document.createElement('div');
            card.className = 'group-card';
            card.onclick = () => loadGroupDetails(group.id);

            card.innerHTML = `
                <div class="group-card-header">
                    <div class="group-card-title"><i class="fa-solid fa-layer-group" style="color: var(--primary-color);"></i> ${window.escapeHtml(group.name)}</div>
                    <div class="group-card-badge">${group.members} Üye</div>
                </div>
                <p style="font-size: 13px; color: var(--text-muted); line-height: 1.4;">${window.escapeHtml(group.desc)}</p>
                <div class="group-card-stats">
                    <span><i class="fa-solid fa-fire" style="color: #ff9f43;"></i> Hedef: %${Math.round((group.weeklyGoalCurrent / group.weeklyGoalMax) * 100)}</span>
                    <span><i class="fa-solid fa-headset" style="color: #2ed573;"></i> ${group.activeMembers.length} Aktif</span>
                </div>
            `;
            container.appendChild(card);
        });
    }
    window.renderMyGroups = renderMyGroups;

    function loadGroupDetails(groupId) {
        const group = mockGroups.find(g => g.id === groupId);
        if(!group) return;

        const nameEl = document.getElementById('active-group-name');
        if (nameEl) nameEl.innerHTML = `${window.escapeHtml(group.name)} <i class="fa-solid fa-circle-check" style="color: #00b894; font-size: 16px;"></i>`;

        const descEl = document.getElementById('active-group-desc');
        if (descEl) descEl.textContent = group.desc;

        const goalPercent = Math.round((group.weeklyGoalCurrent / group.weeklyGoalMax) * 100);
        const gpEl = document.getElementById('group-goal-percent');
        if (gpEl) gpEl.textContent = `%${goalPercent}`;

        const gtEl = document.getElementById('group-goal-text');
        if (gtEl) gtEl.textContent = `${group.weeklyGoalCurrent.toLocaleString()} / ${group.weeklyGoalMax.toLocaleString()} dk`;

        setTimeout(() => {
            const gfEl = document.getElementById('group-goal-fill');
            if (gfEl) gfEl.style.width = `${goalPercent}%`;
        }, 100);

        const membersContainer = document.getElementById('group-study-members');
        const gacEl = document.getElementById('group-active-count');
        if (gacEl) gacEl.innerHTML = `<i class="fa-solid fa-circle" style="font-size: 8px;"></i> ${group.activeMembers.length} Aktif`;

        if (membersContainer) {
            membersContainer.innerHTML = '';
            group.activeMembers.forEach(member => {
                const memberDiv = document.createElement('div');
                memberDiv.className = 'study-member';
                const borderStyle = member.isMe ? `border: 2px solid var(--primary-color); box-shadow: 0 0 15px rgba(108, 92, 231, 0.4);` : `border: 2px solid #2ed573; box-shadow: 0 0 10px rgba(46, 213, 115, 0.2);`;

                memberDiv.innerHTML = `
                    <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=${member.color.replace('#','')}&color=fff" style="${borderStyle}">
                    <div class="study-member-info">
                        <span class="study-member-name">${window.escapeHtml(member.name)} ${member.isMe ? '(Sen)' : ''}</span>
                        <span class="study-member-status"><i class="fa-solid fa-bolt"></i> ${member.status}</span>
                    </div>
                `;
                membersContainer.appendChild(memberDiv);
            });
        }

        const leaderboardContainer = document.getElementById('group-leaderboard-list');
        if (leaderboardContainer) {
            leaderboardContainer.innerHTML = '';
            group.leaderboard.forEach((user, index) => {
                const li = document.createElement('li');
                li.style.display = 'flex';
                li.style.justifyContent = 'space-between';
                li.style.alignItems = 'center';
                li.style.padding = '12px 15px';
                li.style.background = user.isMe ? 'rgba(108, 92, 231, 0.15)' : 'rgba(0,0,0,0.2)';
                li.style.borderRadius = '12px';
                li.style.border = user.isMe ? '1px solid rgba(108, 92, 231, 0.3)' : '1px solid var(--glass-border)';

                let rankIcon = `<span style="color: var(--text-muted); font-weight: bold; width: 20px;">#${index + 1}</span>`;
                if (index === 0) rankIcon = `<i class="fa-solid fa-medal" style="color: #f1c40f; width: 20px; font-size: 18px;"></i>`;
                else if (index === 1) rankIcon = `<i class="fa-solid fa-medal" style="color: #bdc3c7; width: 20px; font-size: 18px;"></i>`;
                else if (index === 2) rankIcon = `<i class="fa-solid fa-medal" style="color: #cd7f32; width: 20px; font-size: 18px;"></i>`;

                li.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 15px;">
                        ${rankIcon}
                        <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random" style="width: 30px; height: 30px; border-radius: 50%;">
                        <span style="color: #fff; font-weight: ${user.isMe ? '600' : '500'};">${window.escapeHtml(user.name)}</span>
                    </div>
                    <div style="color: #2ed573; font-weight: 600; font-size: 14px;">${user.score} XP</div>
                `;
                leaderboardContainer.appendChild(li);
            });
        }
    }
    window.loadGroupDetails = loadGroupDetails;
})();
