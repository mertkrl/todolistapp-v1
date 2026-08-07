import { getFriends } from './social-friends-notifications.js';
import { getCurrentUser } from '../state/current-user-store.js';

// social-institution-my-groups.js'ten çıkarıldı: grup davet mini modalı
// (arkadaş daveti / kurumsal davetli-girişli sınıflar için kullanıcı adıyla
// davet) — kendi kapsamında tamamen izole, dosyanın geri kalanındaki
// _myGroupsChannelSupabase/renderMyInstitutionModal state'ine dokunmuyor.

// Gruba arkadaş davet etmek için açılan mini modal: grup kodu + arkadaş listesi.
// classroom tipi gruplarda (davetli-girişli) öğretmen için farklı bir akış açılır:
// kullanıcı adıyla arayıp doğrudan institution_invites daveti gönderir.
window.openGroupInviteModal = (code, data) => openGroupInviteModal(code, data); // Faz 5: social-group-details.js'ten çağrılabilmesi için (hoisting ile güvenli)
export async function openGroupInviteModal(code, data) {
    const modal = document.getElementById("group-invite-modal");
    const codeEl = document.getElementById("group-invite-modal-code");
    const codeRowEl = document.getElementById("group-invite-modal-code-row");
    const listEl = document.getElementById("group-invite-modal-list");
    if (!modal || !codeEl || !listEl) return;

    if (data.classroomType === 'classroom' && getCurrentUser().institutionRole === 'teacher') {
        modal.classList.remove("hidden");
        codeRowEl?.classList.add('hidden');
        listEl.innerHTML = `
            <p class="u-color-var-text-muted_font-size-12px_margin-0010px">Bu sınıf davetli-girişlidir: öğrenciler yalnızca gönderdiğin daveti kabul ederek katılabilir.</p>
            <div class="cp-asg-form u-flex-direction-column_align-items-stretch_gap-8px" >
                <input id="gim-inst-username" class="gsc-form-input u-width-100pct" placeholder="Öğrencinin kullanıcı adını girin" maxlength="40" >
                <button id="gim-inst-send" class="control-btn secondary u-align-self-flex-end_padding-5px12px_font-size-11p5px" ><i class="fa-solid fa-paper-plane"></i> Gönder</button>
            </div>
            <div id="gim-inst-status" class="cp-hint"></div>`;

        const statusEl = listEl.querySelector('#gim-inst-status');
        listEl.querySelector('#gim-inst-send')?.addEventListener('click', async () => {
            const uInput = listEl.querySelector('#gim-inst-username');
            const username = (uInput?.value || '').trim().replace(/^@/, '');
            if (!username) { window.dcShowToast('Bir kullanıcı adı yaz.'); return; }
            statusEl.textContent = 'Aranıyor…';
            try {
                const { data: target, error: sErr } = await window.FocusSupabase
                    .from('profiles').select('id, username, display_name').ilike('username', username).maybeSingle();
                if (sErr) throw sErr;
                if (!target) { statusEl.textContent = 'Bu kullanıcı adıyla kimse bulunamadı.'; return; }
                // Zaten sınıfın üyesiyse davet göndermeye gerek yok — göndersek de kabul
                // ettiğinde "Sınıfa katıldın!" gibi yanlış bir mesaj çıkardı (2026-07-13).
                const { data: existingMember } = await window.FocusSupabase
                    .from('group_members').select('user_id')
                    .eq('group_id', data._supaId).eq('user_id', target.id).maybeSingle();
                if (existingMember) { statusEl.textContent = `@${target.username} zaten bu sınıfın öğrencisi.`; return; }
                const { error: iErr } = await window.FocusSupabase.from('institution_invites').insert({
                    group_id: data._supaId,
                    invited_by: getCurrentUser().id,
                    invited_user_id: target.id
                });
                if (iErr) {
                    if (iErr.code === '23505') { statusEl.textContent = `@${target.username} kullanıcısına zaten bekleyen bir davet var.`; }
                    else { statusEl.textContent = 'Davet gönderilemedi: ' + iErr.message; }
                    return;
                }
                statusEl.textContent = `@${target.username} kullanıcısına davet gönderildi.`;
                uInput.value = '';
            } catch (e) {
                statusEl.textContent = 'Davet gönderilemedi: ' + e.message;
            }
        });
        return;
    }

    codeEl.textContent = code;
    modal.classList.remove("hidden");
    listEl.innerHTML = `<p class="u-color-var-text-muted_font-size-12px_margin-8px0"><i class="fa-solid fa-spinner fa-spin"></i> Arkadaşlar yükleniyor...</p>`;

    const friends = getFriends();
    if (friends.length === 0) {
        listEl.innerHTML = `<p class="u-color-var-text-muted_font-size-12px_margin-8px0_text-align">Henüz bir arkadaşın yok.</p>`;
        return;
    }

    let memberSet = new Set();
    let profileMap = {}; // username -> {displayName, avatarColor, customAvatar}

    if (data._supaId && window.FocusSupabase && getCurrentUser().id) {
        const { data: memberRows } = await window.FocusSupabase
            .from('group_members')
            .select('profiles(username)')
            .eq('group_id', data._supaId);
        memberSet = new Set((memberRows || []).map(r => r.profiles?.username).filter(Boolean));

        const { data: profiles } = await window.FocusSupabase
            .from('profiles')
            .select('username, display_name, avatar_color, custom_avatar, avatar_initials')
            .in('username', friends);
        (profiles || []).forEach(p => {
            profileMap[p.username] = { displayName: p.display_name, avatarColor: p.avatar_color, customAvatar: p.custom_avatar, avatarInitials: p.avatar_initials || null };
        });
    }

    listEl.innerHTML = friends.map(username => {
        const p = profileMap[username] || {};
        const displayName = p.displayName || username;
        const uData = { username, displayName, avatarColor: p.avatarColor, customAvatar: p.customAvatar };
        const isMember = memberSet.has(username);
        return `
        <div class="group-invite-row" data-username="${window._escapeHtml(username)}">
            ${window.avatarImgHtml(uData, 28)}
            <div class="gir-name">${window._escapeHtml(displayName)}</div>
            ${isMember
                ? `<span class="si-muted-xs"><i class="fa-solid fa-check"></i> Üye</span>`
                : `<button class="control-btn primary group-invite-send-btn u-font-size-11px_padding-5px10px" data-username="${window._escapeHtml(username)}" data-name="${window._escapeHtml(displayName)}">
                    <i class="fa-solid fa-paper-plane"></i> Davet Et
                </button>`}
        </div>`;
    }).join("");

    listEl.querySelectorAll(".group-invite-send-btn").forEach(btn => {
        btn.onclick = async () => {
            const targetUsername = btn.dataset.username;
            btn.disabled = true;
            try {
                if (data._supaId && window.FocusSupabase && getCurrentUser().id) {
                    const { data: targetProfile } = await window.FocusSupabase
                        .from('profiles').select('id').eq('username', targetUsername).maybeSingle();
                    if (targetProfile) {
                        await window.FocusSupabase.from('notifications').insert({
                            user_id: targetProfile.id,
                            type: 'group_invite',
                            payload: {
                                groupCode: code, groupName: data.name,
                                fromUser: getCurrentUser().username,
                                fromName: getCurrentUser().displayName || getCurrentUser().username,
                                fromColor: getCurrentUser().avatarColor || '6c5ce7',
                                fromCustomAvatar: getCurrentUser().customAvatar || null
                            }
                        });
                    }
                }
                btn.innerHTML = '<i class="fa-solid fa-check"></i> Gönderildi';
                window.dcShowToast(`@${targetUsername} kullanıcısına davet gönderildi.`);
            } catch (e) {
                btn.disabled = false;
                window.dcShowToast('Davet gönderilemedi: ' + e.message);
            }
        };
    });
}
