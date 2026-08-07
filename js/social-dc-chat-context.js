// ============================================================
// FOCUSAI SOCIAL-DC-CHAT-CONTEXT.JS
// social.js'ten çıkarılmış: _dcGetChatContext — DC sohbet ekranının
// "şu an neye bakıyoruz" anlık durumunu tek nesnede döndürür. Kullandığı
// tüm state (currentUser, dcCurrentConversation/GroupScope/MsgPath/
// OtherProfile/Role) artık gerçek store'larda yaşadığı için (state/*.js)
// gerçek import ile erişiyor, hiçbir DOM/window bağımlılığı yok.
// ============================================================
import { getCurrentUser } from '../state/current-user-store.js';
import { getDcCurrentGroupScope } from '../state/dc-current-group-scope-store.js';
import { getDcCurrentMsgPath } from '../state/dc-chat-view-store.js';
import {
    getDcCurrentConversation,
    getDcCurrentOtherProfile,
    getDcCurrentRole
} from '../state/dc-message-render-store.js';

export function _dcGetChatContext() {
    return {
        currentUser: getCurrentUser(),
        dmConversation: getDcCurrentConversation(),
        groupScope: getDcCurrentGroupScope(),
        msgPath: getDcCurrentMsgPath(),
        otherProfile: getDcCurrentOtherProfile(),
        role: getDcCurrentRole()
    };
}

window._dcGetChatContext = _dcGetChatContext;
