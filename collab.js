/* ════════════════════════════════════════════════════════════
   FocusAI — Kolaborasyon Modülü  (Faz 4 + 5)
   Presence · Broadcast · Invite · Comments · Approvals ·
   Activity Log · Contribution Chart · @mention
   ════════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    // ── Helpers ──────────────────────────────────────────────────
    // Tek kaynak: script.js'teki window.escapeHtml. collab.js önce bu dosya
    // yüklendikten sonra çalıştığı için normalde her zaman mevcuttur; olası bir
    // yükleme sırası değişikliğine karşı aynı mantığı yerel fallback olarak tutuyoruz.
    function esc(s) {
        if (typeof window.escapeHtml === 'function') return window.escapeHtml(s);
        return String(s)
            .replace(/&/g,'&amp;').replace(/</g,'&lt;')
            .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    }
    function shortId(len = 8) {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let id = '';
        for (let i = 0; i < len; i++) id += chars[Math.floor(Math.random() * chars.length)];
        return id;
    }
    function genId() { return 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2,6); }
    function timeAgo(ts) {
        const diff = (Date.now() - new Date(ts).getTime()) / 1000;
        if (diff < 60)  return 'az önce';
        if (diff < 3600) return Math.floor(diff/60) + 'dk önce';
        if (diff < 86400) return Math.floor(diff/3600) + 'sa önce';
        return Math.floor(diff/86400) + 'g önce';
    }
    function parseMentions(text) {
        return text.replace(/@(\w+)/g, '<span class="pg-mention">@$1</span>');
    }
    function toast(msg, color) {
        let el = document.getElementById('pg-toast');
        if (!el) { el = document.createElement('div'); el.id = 'pg-toast'; el.className = 'pg-toast'; document.body.appendChild(el); }
        el.textContent = msg;
        el.style.borderColor = color || '';
        el.classList.add('show');
        clearTimeout(el._t);
        el._t = setTimeout(() => { el.classList.remove('show'); el.style.borderColor=''; }, 3000);
    }

    // ── Auth helper ───────────────────────────────────────────────
    async function getAuthUser() {
        try { if (!window.FocusSupabase) return null; const { data } = await window.FocusSupabase.auth.getUser(); return data?.user||null; }
        catch (_) { return null; }
    }
    function getUserDisplayName(u) {
        if (!u) return 'Anonim';
        return u.user_metadata?.display_name || u.user_metadata?.username || u.email?.split('@')[0] || 'Kullanıcı';
    }
    function stringToColor(s) {
        const c = ['#7c6eff','#ef476f','#06d6a0','#ffd166','#ff9f43','#a78bfa','#60a5fa','#f97316'];
        let h = 0; for (let i=0;i<s.length;i++) h=s.charCodeAt(i)+((h<<5)-h);
        return c[Math.abs(h)%c.length];
    }

    // ── Local Storage helpers ─────────────────────────────────────
    function lsGet(key, def) { try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? def; } catch(_){ return def; } }
    function lsSet(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

    // ════════════════════════════════════════════════════════════
    // PlanningCollab — Ana Nesne
    // ════════════════════════════════════════════════════════════
    const PlanningCollab = {
        channel:     null,
        roomId:      null,
        goalId:      null,
        myRole:      null,
        authUser:    null,
        onlineUsers: {},
        _peerState:  {},   // {userId: {cursorDay, typingDay, typingTimer, name, color}}
        _typingTimers: {}, // timeout handles for clearing peer typing state
        _handlers: { onMilestoneChange:null, onProgressChange:null, onPresenceChange:null, onNewComment:null, onApproval:null, onStartPlanning:null, onTaskChange:null, onWizState:null },

        // ── Handlers ─────────────────────────────
        setHandlers(h) { Object.assign(this._handlers, h); },

        // ── Peer state helpers (Öneri 1 — Live Presence) ──────────
        getPeerState() { return this._peerState; },

        _setPeerCursor(userId, name, color, dateStr) {
            if (!this._peerState[userId]) this._peerState[userId] = {};
            this._peerState[userId].cursorDay = dateStr;
            this._peerState[userId].name  = name;
            this._peerState[userId].color = color;
            this._handlers.onPresenceChange?.(this.onlineUsers);
        },

        _setPeerTyping(userId, name, color, dateStr) {
            if (!this._peerState[userId]) this._peerState[userId] = {};
            this._peerState[userId].typingDay = dateStr;
            this._peerState[userId].name  = name;
            this._peerState[userId].color = color;
            clearTimeout(this._typingTimers[userId]);
            this._typingTimers[userId] = setTimeout(() => {
                if (this._peerState[userId]) this._peerState[userId].typingDay = null;
                this._handlers.onPresenceChange?.(this.onlineUsers);
            }, 3000);
            this._handlers.onPresenceChange?.(this.onlineUsers);
        },

        // ── Approval required setting ───────────────────────────
        _approvalKey(roomId) { return 'collab_approval_req_' + (roomId || this.roomId); },
        isApprovalRequired() { return !!lsGet(this._approvalKey(), false); },
        setApprovalRequired(val, roomId) {
            lsSet(this._approvalKey(roomId || this.roomId), !!val);
            // Broadcast so other user sees the change
            this.broadcast('approval_setting', { approval_required: !!val });
        },

        isActive() { return !!this.roomId; },

        // ── Me helper ────────────────────────────
        _me() {
            const u = this.authUser;
            const id   = u?.id || 'local_' + (lsGet('pg_local_uid',null) || (() => { const x=shortId(6); lsSet('pg_local_uid',x); return x; })());
            const name = getUserDisplayName(u);
            return { id, name, color: stringToColor(id), initials: name.slice(0,2).toUpperCase() };
        },

        // ── Local rooms storage ───────────────────
        _getRooms() { return lsGet('collab_rooms_local', {}); },
        _saveRooms(r) { lsSet('collab_rooms_local', r); },

        // ══ Oda yönetimi ═════════════════════════

        async enableCollab(goalId, goalTitle) {
            this.authUser = await getAuthUser();
            const me       = this._me();
            const roomId   = 'room_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);
            const invCode  = shortId(8);

            if (window.FocusSupabase && this.authUser) {
                try {
                    const { error: re } = await window.FocusSupabase.from('collab_rooms').insert({ id:roomId, goal_id:goalId, owner_id:this.authUser.id, invite_code:invCode, name:goalTitle });
                    if (re) {
                        // goal_id -> planning_goals(id) FK'si var; hedef henüz sunucuya
                        // yazılmadıysa bu insert sessizce başarısız olur ve davet kodu
                        // hiçbir zaman gerçek bir odaya bağlanmaz. Çağıran taraf hedefi
                        // enableCollab'dan önce senkron biçimde kaydetmelidir.
                        console.warn('[Collab] collab_rooms insert:', re.message);
                    }
                    const { error: me2 } = await window.FocusSupabase.from('collab_room_members').insert({ room_id:roomId, user_id:this.authUser.id, role:'owner', owner_id:this.authUser.id });
                    if (me2) console.warn('[Collab] collab_room_members insert:', me2.message);
                } catch(e) { console.warn('[Collab] enableCollab error:', e); }
            }

            const rooms = this._getRooms();
            rooms[roomId] = { id:roomId, goal_id:goalId, invite_code:invCode, owner_id:me.id, name:goalTitle,
                members:[ { user_id:me.id, name:me.name, color:me.color, role:'owner' } ] };
            this._saveRooms(rooms);
            this._logActivity(roomId, me, 'create', goalTitle);
            return { roomId, inviteCode:invCode };
        },

        async joinByCode(code) {
            this.authUser = await getAuthUser();
            const me = this._me();
            const upperCode = code.trim().toUpperCase();

            if (window.FocusSupabase) {
                try {
                    const { data:room, error:re } = await window.FocusSupabase.from('collab_rooms').select('*').eq('invite_code',upperCode).maybeSingle();
                    if (re) console.warn('[Collab] collab_rooms lookup:', re.message);
                    if (room) {
                        if (this.authUser) {
                            const { error:me2 } = await window.FocusSupabase.from('collab_room_members')
                                .upsert({ room_id:room.id, user_id:this.authUser.id, role:'editor', owner_id:room.owner_id }, { onConflict:'room_id,user_id' });
                            if (me2) console.warn('[Collab] collab_room_members upsert:', me2.message);
                        }
                        return { roomId:room.id, goalId:room.goal_id, role:'editor' };
                    }
                } catch(e) { console.warn('[Collab] joinByCode error:', e); }
            }

            const rooms = this._getRooms();
            const room  = Object.values(rooms).find(r=>r.invite_code===upperCode);
            if (!room) return null;
            if (!room.members.find(m=>m.user_id===me.id))
                room.members.push({ user_id:me.id, name:me.name, color:me.color, role:'editor' });
            this._saveRooms(rooms);
            this._logActivity(room.id, me, 'join', room.name);
            return { roomId:room.id, goalId:room.goal_id, role:'editor' };
        },

        async disableCollab(goalId, roomId) {
            this.leaveRoom();
            if (window.FocusSupabase && this.authUser)
                try { await window.FocusSupabase.from('collab_rooms').delete().eq('id',roomId); } catch (_) { console.warn('[FocusAI] sessiz hata:', _); }
            const rooms = this._getRooms(); delete rooms[roomId]; this._saveRooms(rooms);
        },

        // ══ Realtime kanal ═══════════════════════

        async joinRoom(roomId, goalId, myRole) {
            this.leaveRoom();
            this.roomId = roomId; this.goalId = goalId; this.myRole = myRole||'viewer';
            this.authUser = await getAuthUser();

            if (!window.FocusSupabase) { this._renderPresence(); return; }

            const me = this._me();
            this.channel = window.FocusSupabase.channel('planning-room-'+roomId, { config:{ presence:{ key:me.id } } });

            this.channel.on('presence', { event:'sync' }, () => {
                const state = this.channel.presenceState();
                this.onlineUsers = {};
                Object.entries(state).forEach(([k,arr]) => { const info = Array.isArray(arr)?arr[0]:arr; if(info) this.onlineUsers[k]=info; });
                this._renderPresence();
                this._handlers.onPresenceChange?.(this.onlineUsers);
            });

            const self = this;
            const bcast = (event, fn) => this.channel.on('broadcast', { event }, ({ payload }) => { if(payload.sender===me.id) return; fn(payload); });

            bcast('ms_toggle',      p => { self._handlers.onMilestoneChange?.('toggle',    p); self._notifyMention(p); });
            bcast('ms_add',         p => { self._handlers.onMilestoneChange?.('add',       p); self._addActivity(p.roomId,p.actLog); });
            bcast('ms_delete',      p => { self._handlers.onMilestoneChange?.('delete',    p); self._addActivity(p.roomId,p.actLog); });
            bcast('ms_batch_set',   p => { self._handlers.onMilestoneChange?.('batch_set', p); });
            bcast('ms_update',      p => { self._handlers.onMilestoneChange?.('update',    p); });
            bcast('goal_progress',  p => { self._handlers.onProgressChange?.(p); });
            bcast('comment_add',    p => { self._receiveComment(p); });
            bcast('approval',       p => { self._receiveApproval(p); });
            bcast('activity',       p => { self._addActivity(roomId, p.entry); self._refreshActivityLog(); });
            bcast('start_planning', p => { self._handlers.onStartPlanning?.(p); });
            bcast('task_add',       p => { self._handlers.onTaskChange?.('add',    p); self._addActivity(roomId, self._makeEntry({id:p.sender,name:p.user_name||'?',color:p.user_color||'#888'}, 'task_add', p.task?.text)); self._refreshActivityLog(); });
            bcast('task_delete',    p => { self._handlers.onTaskChange?.('delete', p); self._addActivity(roomId, self._makeEntry({id:p.sender,name:p.user_name||'?',color:p.user_color||'#888'}, 'task_delete', p.taskText)); self._refreshActivityLog(); });
            bcast('task_toggle',    p => { self._handlers.onTaskChange?.('toggle', p); });
            bcast('wiz_state',      p => { self._handlers.onWizState?.(p); });
            bcast('sync_tasks',     p => { self._handlers.onTaskChange?.('sync', p); });
            bcast('cursor_day',     p => { self._setPeerCursor(p.sender, p.user_name||'?', p.user_color||'#888', p.dateStr); self._handlers.onPresenceChange?.(self.onlineUsers); });
            bcast('typing',         p => { self._setPeerTyping(p.sender, p.user_name||'?', p.user_color||'#888', p.dateStr); self._handlers.onPresenceChange?.(self.onlineUsers); });
            bcast('task_pending',   p => { self._handlers.onTaskChange?.('pending', p); });
            bcast('task_approve',   p => { self._handlers.onTaskChange?.('approve', p); });
            bcast('task_reject',    p => { self._handlers.onTaskChange?.('reject',  p); });
            bcast('approval_setting', p => { if (p.approval_required !== undefined) lsSet(self._approvalKey(), !!p.approval_required); });

            this.channel.subscribe(async status => {
                if (status === 'SUBSCRIBED')
                    await this.channel.track({ id:me.id, name:me.name, color:me.color, initials:me.initials, role:myRole||'viewer', joined_at:Date.now() });
            });
        },

        leaveRoom() {
            if (this.channel && window.FocusSupabase) {
                this.channel.untrack?.();
                window.FocusSupabase.removeChannel(this.channel).catch(()=>{});
            }
            this.channel=null; this.roomId=null; this.goalId=null; this.myRole=null; this.onlineUsers={};
            this._renderPresence();
        },

        broadcast(event, data) {
            if (!this.channel||!window.FocusSupabase) return;
            this.channel.send({ type:'broadcast', event, payload:{ ...data, sender:this._me().id } });
        },

        async getMembers(roomId) {
            if (window.FocusSupabase) {
                try {
                    const { data: members } = await window.FocusSupabase
                        .from('collab_room_members')
                        .select('user_id, role, joined_at')
                        .eq('room_id', roomId);
                    if (members && members.length) {
                        // Profil bilgilerini paralel çek
                        const ids = members.map(m => m.user_id);
                        const { data: profiles } = await window.FocusSupabase
                            .from('profiles')
                            .select('id, username, display_name, avatar_color')
                            .in('id', ids);
                        const pMap = {};
                        (profiles || []).forEach(p => { pMap[p.id] = p; });
                        return members.map(m => {
                            const p = pMap[m.user_id] || {};
                            return {
                                user_id:  m.user_id,
                                role:     m.role,
                                joined_at: m.joined_at,
                                name:     p.display_name || p.username || m.user_id,
                                username: p.username || '',
                                color:    p.avatar_color ? (p.avatar_color.startsWith('#') ? p.avatar_color : '#' + p.avatar_color) : '#7c6eff',
                            };
                        });
                    }
                } catch (_) { console.warn('[FocusAI] sessiz hata:', _); }
            }
            return (this._getRooms()[roomId]?.members)||[];
        },

        // ══ YORUM SİSTEMİ ════════════════════════

        _commentsKey(msId)  { return 'collab_comments_' + msId; },
        _approvalsKey(msId) { return 'collab_approvals_' + msId; },

        getComments(msId)  { return lsGet(this._commentsKey(msId),  []); },
        getApprovals(msId) { return lsGet(this._approvalsKey(msId), {}); },

        addComment(msId, text, goalTitle) {
            if (!text.trim()) return;
            const me = this._me();
            const comment = { id:genId(), author_id:me.id, author_name:me.name,
                author_color:me.color, text:text.trim(), created_at:new Date().toISOString() };
            const list = this.getComments(msId);
            list.push(comment);
            lsSet(this._commentsKey(msId), list);

            // F1.3 — Supabase'e persiste et
            if (window.FocusSupabase && this.authUser) {
                window.FocusSupabase.from('collab_comments').upsert({
                    id: comment.id,
                    room_id: this.roomId || '',
                    ms_id: msId,
                    author_id: this.authUser.id,
                    author_name: comment.author_name,
                    author_color: comment.author_color,
                    text: comment.text,
                    created_at: comment.created_at,
                }).then(() => {}).catch(() => {});
            }

            // Activity log
            const entry = this._makeEntry(me, 'comment', text.length > 30 ? text.slice(0,28)+'…' : text);
            this._addActivity(this.roomId, entry);

            // Broadcast
            this.broadcast('comment_add', { msId, comment, roomId:this.roomId });
            this.broadcast('activity', { entry });

            // @mention bildirimi (kendi UI toast)
            const mentions = [...text.matchAll(/@(\w+)/g)].map(m=>m[1]);
            if (mentions.length) toast('📣 @' + mentions.join(', @') + ' etiketlendi', '#7c6eff');

            return comment;
        },

        // F1.3 — Supabase'den yorumları yükle, localStorage ile birleştir
        async loadCommentsFromServer(msId) {
            if (!window.FocusSupabase) return;
            try {
                const { data } = await window.FocusSupabase
                    .from('collab_comments')
                    .select('*')
                    .eq('ms_id', msId)
                    .order('created_at', { ascending: true });
                if (!data || !data.length) return;
                const local = this.getComments(msId);
                const merged = [...local];
                data.forEach(row => {
                    if (!merged.find(c => c.id === row.id)) {
                        merged.push({ id:row.id, author_id:row.author_id, author_name:row.author_name,
                            author_color:row.author_color, text:row.text, created_at:row.created_at });
                    }
                });
                merged.sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
                lsSet(this._commentsKey(msId), merged);
            } catch (_) { console.warn('[FocusAI] sessiz hata:', _); }
        },

        _receiveComment(payload) {
            const list = this.getComments(payload.msId);
            if (!list.find(c=>c.id===payload.comment.id)) {
                list.push(payload.comment);
                lsSet(this._commentsKey(payload.msId), list);
            }
            this._handlers.onNewComment?.(payload.msId, payload.comment);
            // Refresh açık yorum panel'i
            const el = document.getElementById('pg-comments-' + payload.msId);
            if (el) this._renderCommentThread(payload.msId, el);
            toast('💬 ' + payload.comment.author_name + ': ' + payload.comment.text.slice(0,40), '#a78bfa');
        },

        _notifyMention(payload) {
            if (!payload.text) return;
            const me = this._me();
            const mentions = [...(payload.text||'').matchAll(/@(\w+)/g)].map(m=>m[1].toLowerCase());
            if (mentions.includes(me.name.toLowerCase())) {
                toast('📣 ' + payload.author_name + ' seni etiketledi!', '#7c6eff');
                // 4.3 — Push bildirim
                if (typeof window._notifyLocal === 'function')
                    window._notifyLocal('📣 Etiketlendin!',
                        `${payload.author_name}: "${(payload.text||'').slice(0,60)}"`, 'pg-mention');
            }
        },

        // ══ ONAY SİSTEMİ ═════════════════════════

        toggleApproval(msId, msTitle) {
            const me       = this._me();
            const approvals = this.getApprovals(msId);
            if (approvals[me.id]?.approved) {
                delete approvals[me.id];
            } else {
                approvals[me.id] = { approved:true, user_name:me.name, user_color:me.color, ts:Date.now() };
            }
            lsSet(this._approvalsKey(msId), approvals);

            // Broadcast
            this.broadcast('approval', { msId, userId:me.id, approved:!!approvals[me.id], user_name:me.name, user_color:me.color });

            // Activity
            const entry = this._makeEntry(me, approvals[me.id] ? 'approved' : 'unapproved', msTitle);
            this._addActivity(this.roomId, entry);
            this.broadcast('activity', { entry });

            // UI güncelle
            this._refreshApprovalBadge(msId);
            this._refreshActivityLog();

            const approvedCount = Object.keys(approvals).length;
            const rooms = this._getRooms();
            const threshold = rooms[this.roomId]?.approval_threshold || 'majority';
            // this.onlineUsers son 'presence sync' olayında yakalanmış bir önbellek —
            // birkaç yüz ms'ye kadar eskimiş olabilir ve katılımcılar arasında farklı
            // eşik sonuçlarına (biri "ulaşıldı" derken diğeri dermez) yol açabiliyordu.
            // channel.presenceState() Supabase SDK'sının o an elindeki en güncel
            // senkron durumu döndürür — karar anında bunu kullanmak sapmayı azaltır.
            const freshPresence = this.channel?.presenceState?.();
            const memberCount = (freshPresence ? Object.keys(freshPresence).length : Object.keys(this.onlineUsers).length) || 1;
            const reached = threshold === '0' ? false
                : threshold === 'majority' ? approvedCount > memberCount / 2
                : approvedCount >= parseInt(threshold);
            if (reached) {
                toast('✅ Onay eşiğine ulaşıldı! Milestone tamamlanıyor...', '#4ade80');
                if (typeof window.setPlanningMilestoneDone === 'function')
                    window.setPlanningMilestoneDone(this.goalId, msId, true);
            }
        },

        _receiveApproval(p) {
            const approvals = this.getApprovals(p.msId);
            if (p.approved) approvals[p.userId] = { approved:true, user_name:p.user_name, user_color:p.user_color, ts:Date.now() };
            else delete approvals[p.userId];
            lsSet(this._approvalsKey(p.msId), approvals);
            this._refreshApprovalBadge(p.msId);
            this._handlers.onApproval?.(p.msId, approvals);
        },

        _refreshApprovalBadge(msId) {
            const badge = document.getElementById('pg-approval-' + msId);
            if (!badge) return;
            const approvals = this.getApprovals(msId);
            const list      = Object.values(approvals);
            badge.innerHTML = list.map(a =>
                `<span class="pg-approval-avatar" style="background:${a.user_color};" title="${esc(a.user_name)} onayladı">${esc(a.user_name.slice(0,2).toUpperCase())}</span>`
            ).join('') + (list.length ? `<span class="pg-approval-count">${list.length} onay</span>` : '<span class="pg-approval-empty">Henüz onay yok</span>');
        },

        // ══ AKTİVİTE LOGU ════════════════════════

        _actKey(roomId) { return 'collab_activity_' + (roomId||this.roomId); },

        _makeEntry(me, action, target) {
            const labels = { create:'oluşturdu',join:'katıldı',comment:'yorum yaptı',approved:'onayladı',unapproved:'onayı geri aldı',ms_add:'milestone ekledi',ms_toggle:'milestone tamamladı',ms_delete:'milestone sildi',goal_progress:'ilerleme güncelledi',task_add:'görev ekledi',task_delete:'görevi sildi',task_toggle:'görevi tamamladı',task_pending:'görev önerdi' };
            return { id:genId(), user_id:me.id, user_name:me.name, user_color:me.color,
                action, action_label:labels[action]||action, target, created_at:new Date().toISOString() };
        },

        _logActivity(roomId, me, action, target) {
            const entry = this._makeEntry(me, action, target);
            this._addActivity(roomId, entry);
        },

        _addActivity(roomId, entry) {
            if (!roomId||!entry) return;
            const log = lsGet(this._actKey(roomId), []);
            log.unshift(entry);
            if (log.length > 50) log.splice(50);
            lsSet(this._actKey(roomId), log);
        },

        getActivity(roomId) { return lsGet(this._actKey(roomId||this.roomId), []); },

        _refreshActivityLog() {
            const logEl = document.getElementById('pg-activity-log');
            const tabEl = document.getElementById('pg-ctab-activity');
            const isVisible = tabEl && tabEl.style.display !== 'none';
            if (isVisible && logEl) {
                this._renderActivityLog(logEl);
            } else {
                // Tab görünür değil — badge ekle
                const tabBtn = document.querySelector('.pg-collab-tab[data-ctab="activity"]');
                if (tabBtn && !tabBtn.querySelector('.pg-tab-badge')) {
                    const badge = document.createElement('span');
                    badge.className = 'pg-tab-badge';
                    badge.textContent = '•';
                    tabBtn.appendChild(badge);
                }
            }
        },

        _renderActivityLog(el) {
            const log = this.getActivity(this.roomId);
            if (!log.length) { el.innerHTML = '<p class="pg-activity-empty">Henüz aktivite yok.</p>'; return; }
            const actionIcons = { create:'🆕', join:'👋', comment:'💬', approved:'✅', unapproved:'↩️',
                ms_add:'🚩', ms_toggle:'✓', ms_delete:'🗑️', goal_progress:'📊',
                task_add:'📌', task_delete:'🗑️', task_toggle:'✓', task_pending:'⏳' };
            el.innerHTML = `<div class="pg-activity-timeline">` + log.slice(0,20).map(e =>
                `<div class="pg-activity-item">
                    <div class="pg-activity-line"></div>
                    <div class="pg-activity-dot" style="background:${e.user_color||'#888'};">
                        <span>${actionIcons[e.action]||'·'}</span>
                    </div>
                    <div class="pg-activity-body">
                        <div class="pg-activity-row">
                            <span class="pg-activity-name" style="color:${e.user_color||'#aaa'};">${esc(e.user_name)}</span>
                            <span class="pg-activity-action">${esc(e.action_label)}</span>
                            ${e.target?`<span class="pg-activity-target">"${esc(e.target)}"</span>`:''}
                        </div>
                        <span class="pg-activity-time">${timeAgo(e.created_at)}</span>
                    </div>
                </div>`
            ).join('') + `</div>`;
            // Yeni aktivite badge'ini sıfırla
            const badge = document.querySelector('.pg-collab-tab[data-ctab="activity"] .pg-tab-badge');
            if (badge) badge.remove();
        },

        // ══ KATKI GRAFİĞİ ════════════════════════

        _renderContribChart(el, roomId) {
            const log = this.getActivity(roomId||this.roomId);
            const counts = {};
            log.forEach(e => {
                if (!e.user_name) return;
                if (!counts[e.user_name]) counts[e.user_name] = { name:e.user_name, color:e.user_color||'#888', count:0 };
                counts[e.user_name].count++;
            });
            const users = Object.values(counts).sort((a,b)=>b.count-a.count).slice(0,8);
            if (!users.length) { el.innerHTML='<p class="pg-activity-empty">Henüz veri yok.</p>'; return; }
            const max = users[0].count || 1;
            const W = el.offsetWidth || 320, BAR_H = 22, GAP = 8, LEFT = 80;
            const SVG_H = users.length * (BAR_H + GAP) + 10;
            const svgBars = users.map((u,i) => {
                const y   = i * (BAR_H + GAP) + 4;
                const bw  = Math.max(4, ((u.count/max) * (W - LEFT - 40)));
                const initials = u.name.slice(0,2).toUpperCase();
                return `
                <text x="${LEFT-6}" y="${y+BAR_H/2+4}" text-anchor="end" font-size="11" fill="rgba(255,255,255,0.6)" font-family="Inter,sans-serif">${esc(u.name.length>10?u.name.slice(0,9)+'…':u.name)}</text>
                <rect x="${LEFT}" y="${y}" width="${bw}" height="${BAR_H}" rx="5" fill="${u.color}44" stroke="${u.color}" stroke-width="1"/>
                <rect x="${LEFT}" y="${y}" width="${Math.min(bw,bw*0.4)}" height="${BAR_H}" rx="5" fill="${u.color}"/>
                <text x="${LEFT+bw+6}" y="${y+BAR_H/2+4}" font-size="11" font-weight="700" fill="${u.color}" font-family="Inter,sans-serif">${u.count}</text>`;
            }).join('');
            el.innerHTML = `<svg width="${W}" height="${SVG_H}" viewBox="0 0 ${W} ${SVG_H}" xmlns="http://www.w3.org/2000/svg">${svgBars}</svg>`;
        },

        // ══ COMMENT THREAD RENDER ═════════════════

        async _renderCommentThread(msId, container) {
            // F1.3 — Server yorumlarını yükle, sonra render et
            await this.loadCommentsFromServer(msId);
            const comments  = this.getComments(msId);
            const approvals = this.getApprovals(msId);
            const me        = this._me();
            const myApproval = approvals[me.id];

            container.innerHTML = `
            <div class="pg-comment-thread" id="pg-thread-${msId}">

                <!-- Approval bar -->
                <div class="pg-approval-bar">
                    <span class="pg-approval-label"><i class="ti ti-thumb-up"></i> Onaylar</span>
                    <div class="pg-approval-badges" id="pg-approval-${msId}"></div>
                    <button class="pg-approval-btn${myApproval?' approved':''}" data-approve="${msId}">
                        ${myApproval?'<i class="ti ti-thumb-up-filled"></i> Onayladın':'<i class="ti ti-thumb-up"></i> Onayla'}
                    </button>
                </div>

                <!-- Comments list -->
                <div class="pg-comment-list" id="pg-comments-${msId}">
                    ${comments.length===0
                        ? '<p class="pg-comment-empty">Henüz yorum yok. İlk yorumu yap!</p>'
                        : comments.map(c=>`
                        <div class="pg-comment">
                            <div class="pg-comment-avatar" style="background:${c.author_color||'#888'};">${esc((c.author_name||'?').slice(0,2).toUpperCase())}</div>
                            <div class="pg-comment-body">
                                <div class="pg-comment-meta">
                                    <span class="pg-comment-author">${esc(c.author_name)}</span>
                                    <span class="pg-comment-time">${timeAgo(c.created_at)}</span>
                                </div>
                                <div class="pg-comment-text">${parseMentions(esc(c.text))}</div>
                            </div>
                        </div>`).join('')}
                </div>

                <!-- Add comment form -->
                <div class="pg-comment-form">
                    <div class="pg-comment-input-wrap">
                        <textarea class="pg-comment-input premium-input" id="pg-comment-inp-${msId}"
                            placeholder="Yorum yaz... (@isim ile etiketle)" rows="2"></textarea>
                        <button class="pg-comment-send-btn" data-send="${msId}">
                            <i class="ti ti-send"></i>
                        </button>
                    </div>
                    <div class="pg-mention-hint">Üyeleri etiketlemek için @isim kullan</div>
                </div>
            </div>`;

            // Approval badge render
            this._refreshApprovalBadge(msId);

            // Approval button
            container.querySelector(`[data-approve="${msId}"]`)?.addEventListener('click', () => {
                const g    = window.PlanningCollab.goalId;
                const goals = JSON.parse(localStorage.getItem('planning_goals')||'[]');
                const goal  = goals.find(x=>x.id===g);
                const ms    = (goal?.milestones||[]).find(m=>m.id===msId);
                this.toggleApproval(msId, ms?.title||msId);
                // Butonu güncelle
                const btn = container.querySelector(`[data-approve="${msId}"]`);
                const myAp = this.getApprovals(msId)[this._me().id];
                if (btn) { btn.innerHTML = myAp ? '<i class="ti ti-thumb-up-filled"></i> Onayladın' : '<i class="ti ti-thumb-up"></i> Onayla'; btn.classList.toggle('approved', !!myAp); }
            });

            // Send comment
            const sendComment = () => {
                const inp = document.getElementById(`pg-comment-inp-${msId}`);
                if (!inp) return;
                const g    = window.PlanningCollab.goalId;
                const goals = JSON.parse(localStorage.getItem('planning_goals')||'[]');
                const goal  = goals.find(x=>x.id===g);
                this.addComment(msId, inp.value, goal?.title||'');
                inp.value = '';
                // Refresh list
                const listEl = document.getElementById('pg-comments-' + msId);
                if (listEl) {
                    const comments = this.getComments(msId);
                    listEl.innerHTML = comments.map(c=>`
                    <div class="pg-comment">
                        <div class="pg-comment-avatar" style="background:${c.author_color||'#888'};">${esc((c.author_name||'?').slice(0,2).toUpperCase())}</div>
                        <div class="pg-comment-body">
                            <div class="pg-comment-meta">
                                <span class="pg-comment-author">${esc(c.author_name)}</span>
                                <span class="pg-comment-time">${timeAgo(c.created_at)}</span>
                            </div>
                            <div class="pg-comment-text">${parseMentions(esc(c.text))}</div>
                        </div>
                    </div>`).join('');
                }
                this._refreshActivityLog();
            };

            container.querySelector(`[data-send="${msId}"]`)?.addEventListener('click', sendComment);
            container.querySelector(`#pg-comment-inp-${msId}`)?.addEventListener('keydown', e => {
                if (e.key==='Enter' && (e.ctrlKey||e.metaKey)) { e.preventDefault(); sendComment(); }
            });
        },

        // ══ PRESENCE BAR ═════════════════════════

        _renderPresence() {
            const users = Object.values(this.onlineUsers);
            const html = !users.length ? '' :
                users.slice(0,8).map(u =>
                    `<div class="pg-presence-avatar" style="background:${u.color||'#888'};"
                        data-tip="${esc((u.name||'?'))} · ${esc(u.role||'üye')}">
                        ${esc((u.initials||u.name||'?').slice(0,2).toUpperCase())}
                        <span class="pg-presence-dot"></span>
                    </div>`
                ).join('') + (users.length>8?`<span class="pg-presence-more">+${users.length-8}</span>`:'');

            const bar = document.getElementById('pg-presence-bar');
            if (bar) bar.innerHTML = html;

            // PlanView presence bar
            const pvBar = document.getElementById('pg-pv-presence-bar');
            if (pvBar) pvBar.innerHTML = html;
            // 3.2 — Header collab butonunu çevrimiçi sayısıyla güncelle
            const headerLabel = document.getElementById('pg-header-collab-label');
            if (headerLabel) {
                const onlineCount = Object.keys(this.onlineUsers).length;
                headerLabel.innerHTML = this.roomId && onlineCount > 0
                    ? `<span class="pg-collab-online-dot"></span> ${onlineCount} Çevrimiçi`
                    : 'Ortak Planla';
            }
        },

        // ══ COLLAB SECTION RENDER ═════════════════

        async renderCollabSection(goal) {
            const el = document.getElementById('pg-collab-body');
            if (!el) return;

            // Event listener sızıntısını önle: eski handler'ı kaldır, yeni bağla
            if (el._collabClickHandler) el.removeEventListener('click', el._collabClickHandler);
            el._collabClickHandler = null;
            const self = this;

            if (!goal.collab_room_id) {
                el.innerHTML = `
                <p class="pg-collab-desc">Bu hedefi arkadaşlarınla birlikte planlayın. Davet kodu üretilir, gerçek zamanlı düzenleme ve yorum sistemi aktif olur.</p>
                <button data-collab-action="enable" class="pg-act-btn" style="width:100%;justify-content:center;">
                    <i class="ti ti-users-plus"></i> Ortak Planlamayı Aç
                </button>`;
                el._collabClickHandler = e => {
                    if (e.target.closest('[data-collab-action="enable"]')) self._handleEnableCollab(goal);
                };
                el.addEventListener('click', el._collabClickHandler);
                return;
            }

            const rooms   = this._getRooms();
            const roomInfo = rooms[goal.collab_room_id] || {};
            const invCode  = goal.invite_code || roomInfo.invite_code || '—';
            const members  = await this.getMembers(goal.collab_room_id);
            const isOwner  = (this.myRole||goal.my_role) === 'owner';

            el.innerHTML = `
            <!-- Invite box — redesigned -->
            <div class="pg-collab-invite-box">
                <div class="pg-collab-invite-header">
                    <span class="pg-collab-invite-label"><i class="ti ti-link"></i> Davet Kodu</span>
                    <span class="pg-collab-invite-hint">Arkadaşlarını bu kodla davet et</span>
                </div>
                <div class="pg-collab-invite-row">
                    <span class="pg-collab-code">${esc(invCode)}</span>
                    <button id="pg-copy-invite-btn" class="pg-collab-copy-btn" title="Davet linkini kopyala">
                        <i class="ti ti-copy"></i> Kopyala
                    </button>
                </div>
            </div>

            <!-- Tabs -->
            <div class="pg-collab-tabs">
                <button class="pg-collab-tab active" data-ctab="members"><i class="ti ti-users"></i> Üyeler</button>
                <button class="pg-collab-tab" data-ctab="activity"><i class="ti ti-activity"></i> Aktivite</button>
                <button class="pg-collab-tab" data-ctab="chart"><i class="ti ti-chart-bar"></i> Katkı</button>
            </div>
            <div id="pg-collab-tab-content">
                <!-- Üyeler tab (default) -->
                <div id="pg-ctab-members" class="pg-ctab active">
                    ${members.length
                        ? members.map(m=>{
                            const roleLabel={'owner':'👑 Sahip','editor':'✏️ Editör','viewer':'👁️ İzleyici'}[m.role]||m.role;
                            const name = m.name||m.user_id?.slice(0,8)||'—';
                            const online = !!Object.values(this.onlineUsers).find(u=>u.id===m.user_id||u.name===name);
                            const isMe = m.user_id === this._me().id;
                            const canChangeRole = isOwner && !isMe && m.role !== 'owner';
                            return `<div class="pg-collab-member">
                                <div class="pg-collab-avatar" style="background:${stringToColor(m.user_id||name)};">${esc(name.slice(0,2).toUpperCase())}</div>
                                <span class="pg-collab-member-name">${esc(name)}${online?'<span class="pg-online-dot"></span>':''}${isMe?'<span style="font-size:10px;color:var(--t2);margin-left:4px;">(sen)</span>':''}</span>
                                ${canChangeRole
                                    ? `<select class="pg-role-select" data-member-id="${esc(m.user_id||'')}" data-room-id="${esc(goal.collab_room_id)}">
                                        <option value="editor" ${m.role==='editor'?'selected':''}>✏️ Editör</option>
                                        <option value="viewer" ${m.role==='viewer'?'selected':''}>👁️ İzleyici</option>
                                       </select>`
                                    : `<span class="pg-collab-role">${roleLabel}</span>`}
                            </div>`;
                        }).join('')
                        : '<p style="font-size:12px;color:var(--t2);text-align:center;padding:8px 0;">Henüz üye yok.</p>'}
                </div>
                <div id="pg-ctab-activity" class="pg-ctab" style="display:none;">
                    <div id="pg-activity-log"></div>
                </div>
                <div id="pg-ctab-chart" class="pg-ctab" style="display:none;">
                    <div id="pg-contrib-chart"></div>
                </div>
            </div>

            ${isOwner ? `
            <!-- 3.3 Onay eşiği ayarı -->
            <div class="pg-collab-threshold-row">
                <label class="pg-collab-threshold-label"><i class="ti ti-thumb-up"></i> Milestone otomatik tamamlanma eşiği</label>
                <div style="display:flex;align-items:center;gap:8px;">
                    <select id="pg-approval-threshold" class="pg-collab-threshold-select">
                        <option value="0">Kapalı (Manuel)</option>
                        <option value="1">1 Onay</option>
                        <option value="2">2 Onay</option>
                        <option value="3">3 Onay</option>
                        <option value="majority" ${(roomInfo.approval_threshold||'majority')==='majority'?'selected':''}>Çoğunluk (Varsayılan)</option>
                    </select>
                    <button id="pg-save-threshold-btn" class="pg-ms-btn task-btn" style="height:30px;padding:0 10px;white-space:nowrap;">Kaydet</button>
                </div>
            </div>
            <!-- Görev Onayı ayarı (Öneri 2) -->
            <div class="pg-collab-threshold-row" style="margin-top:8px;">
                <label class="pg-collab-threshold-label" style="flex:1;"><i class="ti ti-shield-check"></i> Katılımcı görevleri onay gerektirsin</label>
                <label class="pg-collab-toggle-label">
                    <input type="checkbox" id="pg-task-approval-toggle" ${this.isApprovalRequired() ? 'checked' : ''}>
                    <span class="pg-collab-toggle-track"></span>
                </label>
            </div>` : `
            <!-- Katılımcıya approval durumunu göster -->
            <div class="pg-collab-threshold-row" style="margin-top:8px;opacity:.7;">
                <label class="pg-collab-threshold-label"><i class="ti ti-${this.isApprovalRequired() ? 'shield-check' : 'shield-off'}"></i>
                    Görev onayı: <strong>${this.isApprovalRequired() ? 'Açık — önerileriniz onay bekler' : 'Kapalı — direkt ekleyebilirsiniz'}</strong>
                </label>
            </div>`}

            ${isOwner
                ? `<button id="pg-disable-collab-btn" class="pg-collab-danger-btn" style="margin-top:10px;"><i class="ti ti-users-minus"></i> Ortak Planlamayı Kapat</button>`
                : `<button id="pg-leave-room-btn" class="pg-collab-warn-btn" style="margin-top:10px;"><i class="ti ti-door-exit"></i> Odadan Ayrıl</button>`}`;

            // Threshold select mevcut değerini ata
            const thresholdSel = document.getElementById('pg-approval-threshold');
            if (thresholdSel) thresholdSel.value = roomInfo.approval_threshold || 'majority';

            // Tek delegated handler — sızıntı yok
            el._collabClickHandler = e => {
                const tab     = e.target.closest('.pg-collab-tab');
                const copy    = e.target.closest('#pg-copy-invite-btn');
                const saveThr = e.target.closest('#pg-save-threshold-btn');
                const disable = e.target.closest('#pg-disable-collab-btn');
                const leave   = e.target.closest('#pg-leave-room-btn');

                if (tab) {
                    el.querySelectorAll('.pg-collab-tab').forEach(b=>b.classList.remove('active'));
                    el.querySelectorAll('.pg-ctab').forEach(c=>c.style.display='none');
                    tab.classList.add('active');
                    const tabEl = document.getElementById('pg-ctab-' + tab.dataset.ctab);
                    if (tabEl) tabEl.style.display='';
                    if (tab.dataset.ctab==='activity') { const logEl=document.getElementById('pg-activity-log'); if(logEl) self._renderActivityLog(logEl); }
                    if (tab.dataset.ctab==='chart')    { const chartEl=document.getElementById('pg-contrib-chart'); if(chartEl) setTimeout(()=>self._renderContribChart(chartEl,goal.collab_room_id),50); }
                }
                if (copy) {
                    const url = window.location.href.split('?')[0] + '?invite=' + invCode;
                    navigator.clipboard?.writeText(url).then(() => {
                        toast('Davet linki kopyalandı! 🔗', '#06d6a0');
                        const btn = el.querySelector('#pg-copy-invite-btn');
                        if (btn) {
                            btn.innerHTML = '<i class="ti ti-check"></i> Kopyalandı!';
                            btn.classList.add('pg-collab-copy-done');
                            setTimeout(() => { btn.innerHTML = '<i class="ti ti-copy"></i> Kopyala'; btn.classList.remove('pg-collab-copy-done'); }, 2000);
                        }
                    }).catch(() => toast('Kod: ' + invCode));
                }
                if (saveThr) {
                    const sel = document.getElementById('pg-approval-threshold');
                    const val = sel?.value || 'majority';
                    const rms = self._getRooms();
                    if (rms[goal.collab_room_id]) { rms[goal.collab_room_id].approval_threshold = val; self._saveRooms(rms); }
                    if (window.FocusSupabase && self.authUser) {
                        window.FocusSupabase.from('collab_rooms').update({ approval_threshold: val }).eq('id', goal.collab_room_id).then(()=>{}).catch(()=>{});
                    }
                    toast('Onay eşiği kaydedildi ✓', '#06d6a0');
                }
                if (disable) {
                    const doDisable = () => self._handleDisableCollab(goal);
                    if (window.dcShowConfirm) {
                        window.dcShowConfirm({
                            title: 'Ortak planlamayı kapat?',
                            message: 'Bu hedef artık kimseyle paylaşılmayacak. Tüm üyeler odadan çıkarılır.',
                            confirmText: 'Kapat', danger: true, onConfirm: doDisable,
                        });
                    } else doDisable();
                }
                if (leave) {
                    const doLeave = () => self._handleLeaveRoom(goal);
                    if (window.dcShowConfirm) {
                        window.dcShowConfirm({
                            title: 'Odadan ayrıl?',
                            message: 'Bu ortak plandan ayrılacaksın. Tekrar katılmak için davet koduna ihtiyacın olacak.',
                            confirmText: 'Ayrıl', danger: true, onConfirm: doLeave,
                        });
                    } else doLeave();
                }
            };
            el.addEventListener('click', el._collabClickHandler);

            // Görev onayı toggle (Öneri 2)
            const approvalToggle = document.getElementById('pg-task-approval-toggle');
            if (approvalToggle) {
                approvalToggle.addEventListener('change', () => {
                    self.setApprovalRequired(approvalToggle.checked, goal.collab_room_id);
                    toast(approvalToggle.checked ? 'Görev onayı açıldı 🔒' : 'Görev onayı kapatıldı 🔓', '#06d6a0');
                });
            }

            // Rol değiştirme — change event (delegation)
            el._collabChangeHandler = e => {
                const sel = e.target.closest('.pg-role-select');
                if (!sel) return;
                const memberId = sel.dataset.memberId;
                const newRole  = sel.value;
                const roomId   = sel.dataset.roomId;
                const rms = self._getRooms();
                if (rms[roomId]) {
                    const m = rms[roomId].members?.find(x=>x.user_id===memberId);
                    if (m) { m.role = newRole; self._saveRooms(rms); }
                }
                if (window.FocusSupabase && self.authUser) {
                    window.FocusSupabase.from('collab_room_members')
                        .update({ role: newRole }).eq('room_id', roomId).eq('user_id', memberId)
                        .then(()=>{}).catch(()=>{});
                }
                toast(`Rol güncellendi: ${newRole === 'editor' ? '✏️ Editör' : '👁️ İzleyici'}`, '#06d6a0');
            };
            if (el._prevChangeHandler) el.removeEventListener('change', el._prevChangeHandler);
            el._prevChangeHandler = el._collabChangeHandler;
            el.addEventListener('change', el._collabChangeHandler);
        },

        // ══ Collab enable/disable ═════════════════

        async _handleEnableCollab(goal) {
            const btn = document.getElementById('pg-enable-collab-btn');
            if (btn) { btn.disabled=true; btn.innerHTML='<i class="ti ti-loader" style="animation:spin .8s linear infinite;display:inline-block;"></i> Oluşturuluyor...'; }
            const { roomId, inviteCode } = await this.enableCollab(goal.id, goal.title);
            window._updateGoalCollabState?.(goal.id, { collab_room_id:roomId, invite_code:inviteCode, is_collaborative:true });
            await this.joinRoom(roomId, goal.id, 'owner');
            await this.renderCollabSection({ ...goal, collab_room_id:roomId, invite_code:inviteCode, my_role:'owner' });
            toast('Ortak planlama açıldı! 🤝', '#06d6a0');
        },

        async _handleDisableCollab(goal) {
            await this.disableCollab(goal.id, goal.collab_room_id);
            window._updateGoalCollabState?.(goal.id, { collab_room_id:null, invite_code:null, is_collaborative:false });
            await this.renderCollabSection({ ...goal, collab_room_id:null });
            toast('Ortak planlama kapatıldı');
        },

        async _handleLeaveRoom(goal) {
            if (window.FocusSupabase && this.authUser)
                try { await window.FocusSupabase.from('collab_room_members').delete().eq('room_id',goal.collab_room_id).eq('user_id',this.authUser.id); } catch (_) { console.warn('[FocusAI] sessiz hata:', _); }
            const rooms = this._getRooms();
            if (rooms[goal.collab_room_id]) {
                rooms[goal.collab_room_id].members = rooms[goal.collab_room_id].members.filter(m=>m.user_id!==this._me().id);
                this._saveRooms(rooms);
            }
            this.leaveRoom();
            window._updateGoalCollabState?.(goal.id, { collab_room_id:null, invite_code:null, is_collaborative:false, my_role:null });
            await this.renderCollabSection({ ...goal, collab_room_id:null });
            toast('Odadan ayrıldınız');
        },

        // ══ URL invite ════════════════════════════

        async handleUrlInvite() {
            const code = new URLSearchParams(window.location.search).get('invite');
            if (!code) return;
            window.history.replaceState({}, '', window.location.href.split('?')[0]);
            await this._processInviteCode(code);
        },

        async _processInviteCode(code) {
            const result = await this.joinByCode(code);
            if (!result) { toast('Geçersiz veya süresi dolmuş davet kodu ❌','#f87171'); return; }
            window._applyInviteJoin?.(result);
            toast('Odaya başarıyla katıldınız! 🎉','#06d6a0');
        },

        openInviteModal() {
            const modal = document.getElementById('pg-invite-modal');
            if (!modal) return;
            document.getElementById('pg-invite-code-input').value='';
            document.getElementById('pg-invite-error').style.display='none';
            modal.classList.remove('hidden');
            setTimeout(()=>document.getElementById('pg-invite-code-input')?.focus(),120);
        },

        closeInviteModal() { document.getElementById('pg-invite-modal')?.classList.add('hidden'); },
    };

    // ── Planning.js milestone render hook ────────────────────────
    // planning.js bu fonksiyonu milestone item'ı oluşturduktan sonra çağırır
    window.PlanningCollabMsExtras = function(msId, msTitle) {
        if (!window.PlanningCollab?.isActive()) return '';
        const comments  = window.PlanningCollab.getComments(msId);
        const approvals = window.PlanningCollab.getApprovals(msId);
        const approvalCount = Object.keys(approvals).length;
        return `
        <div class="pg-ms-collab-row">
            <button class="pg-ms-comment-toggle" data-ms-comment="${msId}">
                <i class="ti ti-message-circle"></i> ${comments.length} yorum
            </button>
            <span class="pg-ms-approval-mini" id="pg-approval-mini-${msId}">
                <i class="ti ti-thumb-up"></i> ${approvalCount}
            </span>
        </div>
        <div class="pg-ms-comment-section hidden" id="pg-ms-cthread-${msId}"></div>`;
    };

    window.PlanningCollabBindMsExtras = function(el) {
        if (!window.PlanningCollab?.isActive()) return;
        el.querySelectorAll('[data-ms-comment]').forEach(btn => {
            btn.addEventListener('click', () => {
                const msId   = btn.dataset.msComment;
                const sect   = document.getElementById('pg-ms-cthread-' + msId);
                if (!sect) return;
                const hidden = sect.classList.contains('hidden');
                sect.classList.toggle('hidden');
                if (hidden) {
                    window.PlanningCollab._renderCommentThread(msId, sect).then(() => {
                        setTimeout(() => {
                            sect.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                            // Yorum input'una focus
                            const inp = document.getElementById('pg-comment-inp-' + msId);
                            if (inp) inp.focus();
                        }, 80);
                    });
                }
                btn.innerHTML = `<i class="ti ti-message-circle"></i> ${window.PlanningCollab.getComments(msId).length} yorum`;
            });
        });
    };

    // ── Init ─────────────────────────────────────────────────────
    function init() {
        document.getElementById('pg-join-invite-btn')?.addEventListener('click', () => PlanningCollab.openInviteModal());
        document.getElementById('pg-invite-modal-close')?.addEventListener('click', () => PlanningCollab.closeInviteModal());
        document.getElementById('pg-invite-cancel-btn')?.addEventListener('click',  () => PlanningCollab.closeInviteModal());
        document.getElementById('pg-invite-modal')?.addEventListener('click', e => { if (e.target.id==='pg-invite-modal') PlanningCollab.closeInviteModal(); });

        document.getElementById('pg-invite-join-btn')?.addEventListener('click', async () => {
            const inp  = document.getElementById('pg-invite-code-input');
            const err  = document.getElementById('pg-invite-error');
            const code = (inp?.value||'').trim().toUpperCase();
            if (!code || code.length<6) { if(err){err.textContent='Geçerli bir davet kodu gir.';err.style.display='block';} return; }
            const btn = document.getElementById('pg-invite-join-btn');
            if (btn) { btn.disabled=true; btn.innerHTML='<i class="ti ti-loader"></i> Katılıyor...'; }
            await PlanningCollab._processInviteCode(code);
            if (btn) { btn.disabled=false; btn.innerHTML='<i class="ti ti-door-enter"></i> Katıl'; }
            PlanningCollab.closeInviteModal();
        });

        document.getElementById('pg-invite-code-input')?.addEventListener('keydown', e => { if(e.key==='Enter') document.getElementById('pg-invite-join-btn')?.click(); });
        document.addEventListener('keydown', e => { const m=document.getElementById('pg-invite-modal'); if(e.key==='Escape'&&m&&!m.classList.contains('hidden')) PlanningCollab.closeInviteModal(); });

        setTimeout(() => PlanningCollab.handleUrlInvite(), 600);
    }

    if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    window.PlanningCollab = PlanningCollab;
})();
