// social-friends-notifications-item-html.js
// social-friends-notifications.js'ten çıkarıldı (Faz H/O devamı): bildirim panelindeki
// tek bir bildirim öğesini HTML'e çeviren saf üretici fonksiyonlar ailesi + dispatch
// (buildNotificationItemHtml). Hepsi SADECE item (kind/info/key) parametresi alır,
// paylaşılan mutable state'e dokunmaz — window.avatarImgHtml/timeAgo/formatFocusMinutes/
// _escapeHtml global referanslar (bu projede window.* global'ler bare identifier olarak
// erişilebilir), TEACHER_NOTIF_ACCENT ana dosyadan import ediliyor.

import { TEACHER_NOTIF_ACCENT } from './social-friends-notifications.js';

    function buildFriendRequestNotifHtml(item) {
                const fromUser = item.fromUser;
                const info = item.info;
                return `
                <div class="glass-element si-row-sb">
                    <div class="si-row-g10-min0">
                        ${window.avatarImgHtml({ displayName: info.fromName, avatarColor: info.fromColor, username: fromUser }, 38)}
                        <div class="si-min0">
                            <div class="u-font-weight-600_color-hfff_font-size-14px_overflow-hidden_">${_escapeHtml(info.fromName || '')}</div>
                            <div class="si-muted-sm">@${_escapeHtml(fromUser)} · arkadaşlık isteği gönderdi</div>
                        </div>
                    </div>
                    <div class="u-display-flex_gap-6px_flex-shrink-0">
                        <button class="control-btn primary fr-accept-btn u-font-size-12px_padding-7px12px_background-h2ed573" data-from="${_escapeHtml(fromUser)}" data-name="${_escapeHtml(info.fromName || '')}" ><i class="fa-solid fa-check"></i></button>
                        <button class="control-btn secondary fr-decline-btn u-font-size-12px_padding-7px12px_color-hff4757_border-color-" data-from="${_escapeHtml(fromUser)}" ><i class="fa-solid fa-xmark"></i></button>
                    </div>
                </div>`;
    }

    function buildDmRequestNotifHtml(item) {
                const fromUser = item.fromUser;
                const info = item.info;
                return `
                <div class="glass-element u-display-flex_flex-direction-column_gap-10px_padding-12px14" >
                    <div class="si-row-g10-min0">
                        ${window.avatarImgHtml({ displayName: info.fromName, avatarColor: info.fromColor, customAvatar: info.fromCustomAvatar, username: fromUser }, 38)}
                        <div class="si-min0">
                            <div class="u-font-weight-600_color-hfff_font-size-14px_overflow-hidden_">${_escapeHtml(info.fromName || '')}</div>
                            <div class="si-muted-sm">@${_escapeHtml(fromUser)} · sana mesaj gönderdi</div>
                            ${info.lastText ? `<div class="u-font-size-12px_color-var-text-muted_margin-top-2px_overflo">"${_escapeHtml(info.lastText)}"</div>` : ''}
                        </div>
                    </div>
                    <div class="u-display-flex_gap-6px">
                        <button class="control-btn primary dm-req-add-btn u-flex-1_font-size-12px_padding-8px10px_background-h2ed573" data-from="${_escapeHtml(fromUser)}" data-name="${_escapeHtml(info.fromName || '')}" ><i class="fa-solid fa-user-plus"></i> Kişilere Ekle</button>
                        <button class="control-btn secondary dm-req-continue-btn u-flex-1_font-size-12px_padding-8px10px" data-from="${_escapeHtml(fromUser)}" data-name="${_escapeHtml(info.fromName || '')}" data-room-name="${_escapeHtml(info.fromName || fromUser)}" ><i class="fa-regular fa-comment-dots"></i> Konuşmaya Devam Et</button>
                    </div>
                </div>`;
    }

    function buildMentionNotifHtml(item) {
                const info = item.info;
                const isDm = !!info.conversationId;
                return `
                <div class="glass-element dc-mention-notif u-display-flex_align-items-center_justify-content-space-betw-6" data-dm="${isDm ? '1' : ''}" data-from="${_escapeHtml(info.fromUser || '')}" data-from-name="${_escapeHtml(info.fromName || '')}" data-group="${_escapeHtml(info.groupCode || '')}" data-scope-type="${_escapeHtml(info.scopeType || '')}" data-scope-id="${_escapeHtml(info.scopeId || '')}" data-room="${_escapeHtml(info.roomId || '')}" data-channel="${_escapeHtml(info.channelId || '')}" data-room-name="${_escapeHtml(info.roomName || info.roomId || '')}" data-id="${item.key}" >
                    <div class="si-row-g10-min0">
                        ${window.avatarImgHtml({ displayName: info.fromName, avatarColor: info.fromColor, username: info.fromUser }, 38)}
                        <div class="si-min0">
                            <div class="si-title">
                                <span class="u-font-weight-600">${_escapeHtml(info.fromName || '')}</span>
                                ${isDm
                                    ? `<span class="si-muted"> bir mesajda seni etiketledi</span>`
                                    : `<span class="si-muted"> seni etiketledi: </span><span class="si-muted">#${_escapeHtml(info.roomName || info.roomId || '')}</span>`}
                            </div>
                            <div class="u-font-size-11px_color-var-text-muted_margin-top-2px_overflo">${window.timeAgo(info.timestamp)}${info.text ? ' · "' + _escapeHtml(info.text) + '"' : ''}</div>
                        </div>
                    </div>
                    <button class="control-btn secondary notif-dismiss-btn" data-id="${item.key}" title="Bildirimi kaldır" class="si-action-btn" aria-label="Bildirimi kaldır"><i class="fa-solid fa-xmark"></i></button>
                </div>`;
    }

    function buildRoleChangeNotifHtml(item) {
                const info = item.info;
                const isPromote = info.direction === 'promote';
                const accent = isPromote ? '#ffd166' : '#ff7675';
                const icon = isPromote ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down';
                const verb = isPromote ? 'terfi ettirildi' : 'rolün değiştirildi';
                return `
                <div class="glass-element u-display-flex_align-items-center_justify-content-space-betw-7" data-dyn-bdc="${accent}">
                    <div class="si-row-g10-min0">
                        <div data-dyn-bg="${accent}22" class="u-width-38px_height-38px_border-radius-50pct_display-flex_al">
                            <i class="fa-solid ${icon} u-font-size-16px" data-dyn-color="${accent}"></i>
                        </div>
                        <div class="si-min0">
                            <div class="si-title">
                                <span class="si-muted">Yeni rolün: </span>
                                <span data-dyn-color="${accent}" class="u-font-weight-600">${_escapeHtml(info.roleLabel || '')}</span>
                                <span class="si-muted"> — ${verb}</span>
                            </div>
                            <div class="si-meta">${window.timeAgo(info.timestamp)}${info.fromName ? ' · ' + _escapeHtml(info.fromName) + ' tarafından' : ''}</div>
                        </div>
                    </div>
                    <button class="control-btn secondary notif-dismiss-btn" data-id="${item.key}" title="Bildirimi kaldır" class="si-action-btn" aria-label="Bildirimi kaldır"><i class="fa-solid fa-xmark"></i></button>
                </div>`;
    }

    function buildGroupSlotOpenNotifHtml(item) {
                const info = item.info;
                return `
                <div class="glass-element discover-saved-slot-notif u-display-flex_align-items-center_justify-content-space-betw-2" data-group="${_escapeHtml(info.groupCode || '')}" >
                    <div class="si-row-g10-min0">
                        <div class="u-width-38px_height-38px_border-radius-50pct_background-h2ed">
                            <i class="fa-solid fa-star u-color-h2ed573_font-size-16px" ></i>
                        </div>
                        <div class="si-min0">
                            <div class="si-title">
                                <span class="u-font-weight-600">${_escapeHtml(info.groupName || '')}</span>
                                <span class="si-muted"> grubunda yer açıldı!</span>
                            </div>
                            <div class="si-meta">${window.timeAgo(info.timestamp)} · Kaydettiğin bir grup</div>
                        </div>
                    </div>
                    <button class="control-btn secondary notif-dismiss-btn" data-id="${item.key}" title="Bildirimi kaldır" class="si-action-btn" aria-label="Bildirimi kaldır"><i class="fa-solid fa-xmark"></i></button>
                </div>`;
    }

    function buildGroupInviteNotifHtml(item) {
                const info = item.info;
                return `
                <div class="glass-element u-display-flex_flex-direction-column_gap-10px_padding-12px14" >
                    <div class="si-row-g10-min0">
                        ${window.avatarImgHtml({ displayName: info.fromName, avatarColor: info.fromColor, customAvatar: info.fromCustomAvatar, username: info.fromUser }, 38)}
                        <div class="si-min0">
                            <div class="si-title">
                                <span class="u-font-weight-600">${_escapeHtml(info.fromName || info.fromUser || '')}</span>
                                <span class="si-muted"> seni </span>
                                <span class="u-font-weight-600">${_escapeHtml(info.groupName || '')}</span>
                                <span class="si-muted"> grubuna davet etti</span>
                            </div>
                            <div class="si-meta">${window.timeAgo(info.timestamp)}</div>
                        </div>
                    </div>
                    <div class="u-display-flex_gap-6px">
                        <button class="control-btn primary group-invite-accept-btn u-flex-1_font-size-12px_padding-8px10px_background-h2ed573" data-id="${item.key}" data-code="${_escapeHtml(info.groupCode || '')}" ><i class="fa-solid fa-check"></i> Katıl</button>
                        <button class="control-btn secondary group-invite-decline-btn u-flex-1_font-size-12px_padding-8px10px_color-hff4757_border" data-id="${item.key}" ><i class="fa-solid fa-xmark"></i> Reddet</button>
                    </div>
                </div>`;
    }

    function buildInstitutionInviteNotifHtml(item) {
                const info = item.info;
                return `
                <div class="glass-element u-display-flex_flex-direction-column_gap-10px_padding-12px14-2" data-dyn-bdc="${TEACHER_NOTIF_ACCENT}">
                    <div class="si-row-g10-min0">
                        <div data-dyn-bg="${TEACHER_NOTIF_ACCENT}26" class="u-width-38px_height-38px_border-radius-50pct_display-flex_al">
                            <i class="fa-solid fa-building-columns u-font-size-16px" data-dyn-color="${TEACHER_NOTIF_ACCENT}"></i>
                        </div>
                        <div class="si-min0">
                            <div class="si-title">
                                <span class="u-font-weight-600">${_escapeHtml(info.fromName || '')}</span>
                                <span class="si-muted"> seni </span>
                                <span class="u-font-weight-600">${_escapeHtml(info.groupName || '')}</span>
                                <span class="si-muted"> sınıfına davet etti</span>
                            </div>
                            <div class="si-meta">${window.timeAgo(info.timestamp)}</div>
                        </div>
                    </div>
                    <div class="u-display-flex_gap-6px">
                        <button class="control-btn primary institution-invite-accept-btn u-flex-1_font-size-12px_padding-8px10px_background-h2ed573" data-id="${item.key}" data-invite-id="${info.inviteId || ''}" ><i class="fa-solid fa-check"></i> Kabul Et</button>
                        <button class="control-btn secondary institution-invite-decline-btn u-flex-1_font-size-12px_padding-8px10px_color-hff4757_border" data-id="${item.key}" data-invite-id="${info.inviteId || ''}" ><i class="fa-solid fa-xmark"></i> Reddet</button>
                    </div>
                </div>`;
    }

    function buildClassroomWeeklyDigestNotifHtml(item) {
                const info = item.info;
                return `
                <div class="glass-element discover-saved-slot-notif u-display-flex_align-items-center_justify-content-space-betw-3" data-group="${info.groupCode || ''}" data-dyn-bdc="${TEACHER_NOTIF_ACCENT}">
                    <div class="si-row-g10-min0">
                        <div data-dyn-bg="${TEACHER_NOTIF_ACCENT}26" class="u-width-38px_height-38px_border-radius-50pct_display-flex_al">
                            <i class="fa-solid fa-chart-line u-font-size-16px" data-dyn-color="${TEACHER_NOTIF_ACCENT}"></i>
                        </div>
                        <div class="si-min0">
                            <div class="si-title">
                                <span class="u-font-weight-600">${_escapeHtml(info.groupName || '')}</span>
                                <span class="si-muted">: bu hafta ${info.inactiveCount} kişi hiç odaklanmadı</span>
                            </div>
                            <div class="si-meta">${window.timeAgo(info.timestamp)} · haftalık özet</div>
                        </div>
                    </div>
                    <button class="control-btn secondary notif-dismiss-btn" data-id="${item.key}" title="Bildirimi kaldır" class="si-action-btn" aria-label="Bildirimi kaldır"><i class="fa-solid fa-xmark"></i></button>
                </div>`;
    }

    function buildFocusReminderNotifHtml(item) {
                const info = item.info;
                return `
                <div class="glass-element discover-saved-slot-notif u-display-flex_align-items-center_justify-content-space-betw-3" data-group="${info.groupCode || ''}" data-dyn-bdc="${TEACHER_NOTIF_ACCENT}">
                    <div class="si-row-g10-min0">
                        <div data-dyn-bg="${TEACHER_NOTIF_ACCENT}26" class="u-width-38px_height-38px_border-radius-50pct_display-flex_al">
                            <i class="fa-solid fa-bell u-font-size-16px" data-dyn-color="${TEACHER_NOTIF_ACCENT}"></i>
                        </div>
                        <div class="si-min0">
                            <div class="si-title">
                                <span class="u-font-weight-600">${_escapeHtml(info.fromName || '')}</span>
                                <span class="si-muted"> sana </span>
                                <span class="u-font-weight-600">${_escapeHtml(info.groupName || '')}</span>
                                <span class="si-muted"> için bir hatırlatma gönderdi</span>
                            </div>
                            <div class="si-meta">${window.timeAgo(info.timestamp)}</div>
                        </div>
                    </div>
                    <button class="control-btn secondary notif-dismiss-btn" data-id="${item.key}" title="Bildirimi kaldır" class="si-action-btn" aria-label="Bildirimi kaldır"><i class="fa-solid fa-xmark"></i></button>
                </div>`;
    }

    function buildAssignmentReminderNotifHtml(item) {
                const info = item.info;
                return `
                <div class="glass-element discover-saved-slot-notif u-display-flex_align-items-center_justify-content-space-betw-3" data-group="${info.groupCode || ''}" data-assignment-jump="1" data-dyn-bdc="${TEACHER_NOTIF_ACCENT}">
                    <div class="si-row-g10-min0">
                        <div data-dyn-bg="${TEACHER_NOTIF_ACCENT}26" class="u-width-38px_height-38px_border-radius-50pct_display-flex_al">
                            <i class="fa-solid fa-clipboard-list u-font-size-16px" data-dyn-color="${TEACHER_NOTIF_ACCENT}"></i>
                        </div>
                        <div class="si-min0">
                            <div class="si-title">
                                <span class="u-font-weight-600">${_escapeHtml(info.assignmentTitle || '')}</span>
                                <span class="si-muted"> ödevini henüz teslim etmedin</span>
                            </div>
                            <div class="si-meta">${_escapeHtml(info.groupName || '')} · ${window.timeAgo(info.timestamp)}</div>
                        </div>
                    </div>
                    <button class="control-btn secondary notif-dismiss-btn" data-id="${item.key}" title="Bildirimi kaldır" class="si-action-btn" aria-label="Bildirimi kaldır"><i class="fa-solid fa-xmark"></i></button>
                </div>`;
    }

    function buildAssignmentNewNotifHtml(item) {
                const info = item.info;
                return `
                <div class="glass-element discover-saved-slot-notif u-display-flex_align-items-center_justify-content-space-betw-3" data-group="${info.groupCode || ''}" data-assignment-jump="1" data-dyn-bdc="${TEACHER_NOTIF_ACCENT}">
                    <div class="si-row-g10-min0">
                        <div data-dyn-bg="${TEACHER_NOTIF_ACCENT}26" class="u-width-38px_height-38px_border-radius-50pct_display-flex_al">
                            <i class="fa-solid fa-clipboard-list u-font-size-16px" data-dyn-color="${TEACHER_NOTIF_ACCENT}"></i>
                        </div>
                        <div class="si-min0">
                            <div class="si-title">
                                <span class="u-font-weight-600">${_escapeHtml(info.fromName || '')}</span>
                                <span class="si-muted"> yeni bir ödev ekledi: </span>
                                <span class="u-font-weight-600">${_escapeHtml(info.assignmentTitle || '')}</span>
                            </div>
                            <div class="si-meta">${_escapeHtml(info.groupName || '')} · ${window.timeAgo(info.timestamp)}</div>
                        </div>
                    </div>
                    <button class="control-btn secondary notif-dismiss-btn" data-id="${item.key}" title="Bildirimi kaldır" class="si-action-btn" aria-label="Bildirimi kaldır"><i class="fa-solid fa-xmark"></i></button>
                </div>`;
    }

    function buildCollabPlanInviteNotifHtml(item) {
                const info = item.info;
                return `
                <div class="glass-element cp-plan-invite-notif u-display-flex_align-items-center_justify-content-space-betw-3" data-id="${item.key}" data-dyn-bdc="${TEACHER_NOTIF_ACCENT}">
                    <div class="si-row-g10-min0">
                        <div data-dyn-bg="${TEACHER_NOTIF_ACCENT}26" class="u-width-38px_height-38px_border-radius-50pct_display-flex_al">
                            <i class="fa-solid fa-book-open u-font-size-16px" data-dyn-color="${TEACHER_NOTIF_ACCENT}"></i>
                        </div>
                        <div class="si-min0">
                            <div class="si-title">
                                <span class="u-font-weight-600">${_escapeHtml(info.fromName || '')}</span>
                                <span class="si-muted"> sana bir ders planı atadı: </span>
                                <span class="u-font-weight-600">${_escapeHtml(info.goalTitle || '')}</span>
                            </div>
                            <div class="si-meta">${window.timeAgo(info.timestamp)}</div>
                        </div>
                    </div>
                    <button class="control-btn secondary notif-dismiss-btn" data-id="${item.key}" title="Bildirimi kaldır" class="si-action-btn" aria-label="Bildirimi kaldır"><i class="fa-solid fa-xmark"></i></button>
                </div>`;
    }

    function buildLessonPlanReminderNotifHtml(item) {
                const info = item.info;
                return `
                <div class="glass-element discover-saved-slot-notif u-display-flex_align-items-center_justify-content-space-betw-3" data-lesson-plan-jump="1" data-dyn-bdc="${TEACHER_NOTIF_ACCENT}">
                    <div class="si-row-g10-min0">
                        <div data-dyn-bg="${TEACHER_NOTIF_ACCENT}26" class="u-width-38px_height-38px_border-radius-50pct_display-flex_al">
                            <i class="fa-solid fa-bell u-font-size-16px" data-dyn-color="${TEACHER_NOTIF_ACCENT}"></i>
                        </div>
                        <div class="si-min0">
                            <div class="si-title">
                                <span class="u-font-weight-600">${_escapeHtml(info.fromName || '')}</span>
                                <span class="si-muted"> </span>
                                <span class="u-font-weight-600">${_escapeHtml(info.goalTitle || '')}</span>
                                <span class="si-muted"> ders planını hatırlatıyor</span>
                            </div>
                            <div class="si-meta">${window.timeAgo(info.timestamp)}</div>
                        </div>
                    </div>
                    <button class="control-btn secondary notif-dismiss-btn" data-id="${item.key}" title="Bildirimi kaldır" class="si-action-btn" aria-label="Bildirimi kaldır"><i class="fa-solid fa-xmark"></i></button>
                </div>`;
    }

    function buildLessonPlanNewNotifHtml(item) {
                const info = item.info;
                return `
                <div class="glass-element discover-saved-slot-notif u-display-flex_align-items-center_justify-content-space-betw-3" data-lesson-plan-jump="1" data-dyn-bdc="${TEACHER_NOTIF_ACCENT}">
                    <div class="si-row-g10-min0">
                        <div data-dyn-bg="${TEACHER_NOTIF_ACCENT}26" class="u-width-38px_height-38px_border-radius-50pct_display-flex_al">
                            <i class="fa-solid fa-graduation-cap u-font-size-16px" data-dyn-color="${TEACHER_NOTIF_ACCENT}"></i>
                        </div>
                        <div class="si-min0">
                            <div class="si-title">
                                ${info.resent
                                    ? `<span class="u-font-weight-600">${_escapeHtml(info.fromName || '')}</span><span class="si-muted"> planını düzenleyip tekrar gönderdi: </span><span class="u-font-weight-600">${_escapeHtml(info.goalTitle || '')}</span>`
                                    : `<span class="u-font-weight-600">${_escapeHtml(info.fromName || '')}</span><span class="si-muted"> sana bir ders planı atadı: </span><span class="u-font-weight-600">${_escapeHtml(info.goalTitle || '')}</span>`}
                            </div>
                            <div class="si-meta">Bekleyen planlama isteğiniz var · ${window.timeAgo(info.timestamp)}</div>
                        </div>
                    </div>
                    <button class="control-btn secondary notif-dismiss-btn" data-id="${item.key}" title="Bildirimi kaldır" class="si-action-btn" aria-label="Bildirimi kaldır"><i class="fa-solid fa-xmark"></i></button>
                </div>`;
    }

    function buildLessonPlanAcceptedNotifHtml(item) {
                const info = item.info;
                return `
                <div class="glass-element discover-saved-slot-notif u-display-flex_align-items-center_justify-content-space-betw-2" data-lesson-plan-jump="1" >
                    <div class="si-row-g10-min0">
                        <div class="u-width-38px_height-38px_border-radius-50pct_background-h2ed-2">
                            <i class="fa-solid fa-circle-check u-color-h2ed573_font-size-16px" ></i>
                        </div>
                        <div class="si-min0">
                            <div class="si-title"><span class="u-font-weight-600">${_escapeHtml(info.fromName || '')}</span><span class="si-muted"> gönderdiğin ders planını kabul etti.</span></div>
                            <div class="si-meta">${window.timeAgo(info.timestamp)}</div>
                        </div>
                    </div>
                    <button class="control-btn secondary notif-dismiss-btn" data-id="${item.key}" title="Bildirimi kaldır" class="si-action-btn" aria-label="Bildirimi kaldır"><i class="fa-solid fa-xmark"></i></button>
                </div>`;
    }

    function buildLessonPlanRevisionRequestedNotifHtml(item) {
                const info = item.info;
                return `
                <div class="glass-element discover-saved-slot-notif u-display-flex_align-items-center_justify-content-space-betw-8" data-lesson-plan-jump="1" >
                    <div class="si-row-g10-min0">
                        <div class="u-width-38px_height-38px_border-radius-50pct_background-hfec">
                            <i class="fa-solid fa-pen-to-square u-color-hfeca57_font-size-16px" ></i>
                        </div>
                        <div class="si-min0">
                            <div class="si-title"><span class="u-font-weight-600">${_escapeHtml(info.fromName || '')}</span><span class="si-muted"> ders planında revize istedi: </span>"${_escapeHtml(info.note || '')}"</div>
                            <div class="si-meta">${window.timeAgo(info.timestamp)}</div>
                        </div>
                    </div>
                    <button class="control-btn secondary notif-dismiss-btn" data-id="${item.key}" title="Bildirimi kaldır" class="si-action-btn" aria-label="Bildirimi kaldır"><i class="fa-solid fa-xmark"></i></button>
                </div>`;
    }

    function buildLessonPlanRejectedNotifHtml(item) {
                const info = item.info;
                return `
                <div class="glass-element discover-saved-slot-notif u-display-flex_align-items-center_justify-content-space-betw-9" data-lesson-plan-jump="1" >
                    <div class="si-row-g10-min0">
                        <div class="u-width-38px_height-38px_border-radius-50pct_background-hff6">
                            <i class="fa-solid fa-circle-xmark u-color-hff6b6b_font-size-16px" ></i>
                        </div>
                        <div class="si-min0">
                            <div class="si-title"><span class="u-font-weight-600">${_escapeHtml(info.fromName || '')}</span><span class="si-muted"> planı reddetti${info.note ? ': "' + _escapeHtml(info.note) + '"' : '.'}</span></div>
                            <div class="si-meta">7 gün içinde düzenleyip tekrar gönderebilirsin · ${window.timeAgo(info.timestamp)}</div>
                        </div>
                    </div>
                    <button class="control-btn secondary notif-dismiss-btn" data-id="${item.key}" title="Bildirimi kaldır" class="si-action-btn" aria-label="Bildirimi kaldır"><i class="fa-solid fa-xmark"></i></button>
                </div>`;
    }

    function buildKudosNotifHtml(item) {
                const info = item.info;
                return `
                <div class="glass-element si-row-sb">
                    <div class="si-row-g10-min0">
                        ${window.avatarImgHtml({ displayName: info.fromName, avatarColor: info.fromColor, username: info.fromUser }, 38)}
                        <div class="si-min0">
                            <div class="si-title">
                                <span class="u-font-weight-600">${_escapeHtml(info.fromName || '')}</span>
                                <span class="si-muted"> sana </span>
                                <span class="u-font-size-16px">👏</span>
                                <span class="si-muted"> alkış gönderdi</span>
                            </div>
                            <div class="si-meta">${window.timeAgo(info.timestamp)}</div>
                        </div>
                    </div>
                    <button class="control-btn secondary notif-dismiss-btn" data-id="${item.key}" title="Bildirimi kaldır" class="si-action-btn" aria-label="Bildirimi kaldır"><i class="fa-solid fa-xmark"></i></button>
                </div>`;
    }

    function buildGroupGoalReachedNotifHtml(item) {
                const info = item.info;
                return `
                <div class="glass-element si-row-sb">
                    <div class="si-row-g10-min0">
                        <div class="u-width-38px_height-38px_border-radius-50pct_background-rgba-2">
                            <i class="fa-solid fa-trophy u-color-hfeca57_font-size-16px" ></i>
                        </div>
                        <div class="si-min0">
                            <div class="si-title">
                                <span class="u-font-weight-600">${_escapeHtml(info.groupName || '')}</span>
                                <span class="si-muted"> haftalık hedefi tamamladı 🎉</span>
                            </div>
                            <div class="si-meta">${window.timeAgo(info.timestamp)}${info.totalMinutes ? ` · ${window.formatFocusMinutes(info.totalMinutes)}/${window.formatFocusMinutes(info.weeklyGoal)}` : ''}</div>
                        </div>
                    </div>
                    <button class="control-btn secondary notif-dismiss-btn" data-id="${item.key}" title="Bildirimi kaldır" class="si-action-btn" aria-label="Bildirimi kaldır"><i class="fa-solid fa-xmark"></i></button>
                </div>`;
    }

    function buildReactionNotifHtml(item) {

            // Tepki bildirimi
            const info = item.info;
            return `
                <div class="glass-element si-row-sb">
                    <div class="si-row-g10-min0">
                        ${window.avatarImgHtml({ displayName: info.fromName, avatarColor: info.fromColor, username: info.fromUser }, 38)}
                        <div class="si-min0">
                            <div class="si-title">
                                <span class="u-font-weight-600">${_escapeHtml(info.fromName || '')}</span>
                                <span class="si-muted"> aktivitene </span>
                                <span class="u-font-size-16px">${_escapeHtml(info.emoji || '')}</span>
                                <span class="si-muted"> tepkisi verdi</span>
                            </div>
                            <div class="si-meta">${window.timeAgo(info.timestamp)}${info.activityText ? ' · "' + _escapeHtml(info.activityText) + '"' : ''}</div>
                        </div>
                    </div>
                    <button class="control-btn secondary notif-dismiss-btn" data-id="${item.key}" title="Bildirimi kaldır" class="si-action-btn" aria-label="Bildirimi kaldır"><i class="fa-solid fa-xmark"></i></button>
                </div>`;
    }

    const NOTIF_TYPE_BUILDERS = {
        mention: buildMentionNotifHtml,
        role_change: buildRoleChangeNotifHtml,
        group_slot_open: buildGroupSlotOpenNotifHtml,
        group_invite: buildGroupInviteNotifHtml,
        institution_invite: buildInstitutionInviteNotifHtml,
        classroom_weekly_digest: buildClassroomWeeklyDigestNotifHtml,
        focus_reminder: buildFocusReminderNotifHtml,
        assignment_reminder: buildAssignmentReminderNotifHtml,
        assignment_new: buildAssignmentNewNotifHtml,
        collab_plan_invite: buildCollabPlanInviteNotifHtml,
        lesson_plan_reminder: buildLessonPlanReminderNotifHtml,
        lesson_plan_new: buildLessonPlanNewNotifHtml,
        lesson_plan_accepted: buildLessonPlanAcceptedNotifHtml,
        lesson_plan_revision_requested: buildLessonPlanRevisionRequestedNotifHtml,
        lesson_plan_rejected: buildLessonPlanRejectedNotifHtml,
        kudos: buildKudosNotifHtml,
        group_goal_reached: buildGroupGoalReachedNotifHtml,
    };

    // Bildirim tipine göre doğru HTML üretici fonksiyona yönlendirir. 'request'/'dmRequest'
    // kind'a göre, geri kalanı item.info.type'a göre dispatch edilir (bkz. NOTIF_TYPE_BUILDERS).
    export function buildNotificationItemHtml(item) {
        if (item.kind === 'request') return buildFriendRequestNotifHtml(item);
        if (item.kind === 'dmRequest') return buildDmRequestNotifHtml(item);
        const builder = NOTIF_TYPE_BUILDERS[item.info.type];
        if (builder) return builder(item);
        return buildReactionNotifHtml(item);
    }
