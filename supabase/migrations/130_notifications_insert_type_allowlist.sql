-- ### 130_notifications_insert_type_allowlist.sql
-- =====================================================================
-- 032_notifications_cross_user_insert.sql, 029'un kısıtlamasını
-- ("user_id = auth.uid()") geri açmıştı çünkü çapraz-kullanıcı
-- bildirimlerini (buddy/plan daveti, kudos vb.) kırıyordu. O zamandan
-- beri politika "auth.uid() is not null" — yani HERHANGİ bir giriş
-- yapmış kullanıcı, BAŞKA HERHANGİ bir kullanıcıya, HERHANGİ bir type/
-- payload içerikli bildirim satırı ekleyebiliyordu (spam/sosyal
-- mühendislik riski).
--
-- notifications tablosunda gönderen (from_id) kolonu YOK — sadece
-- user_id (alıcı) + type + payload jsonb var. Bu yüzden "gönderenle
-- alıcı arasında gerçek bir ilişki var mı" diye tam doğrulama şu an
-- mümkün değil (her type'ın payload şeması farklı, güvenilir şekilde
-- genelleştirilemez).
--
-- Bunun yerine: kod tabanındaki TÜM `.from('notifications').insert(...)`
-- çağrıları taranıp gerçekten kullanılan type değerleri çıkarıldı (bkz.
-- planning-collab-wait.js, planning-lesson-plan-invites.js,
-- planning-lesson-plan-assign.js, planning.js, social-activity-feed.js,
-- social-buddy-habits.js, social-group-details.js,
-- social-institution-my-groups.js, social-group-discover.js,
-- social-institution-panel.js, social.js). INSERT artık sadece bu
-- bilinen/belgelenmiş type'larla sınırlı — rastgele type/payload ile
-- bildirim enjekte edilemez. Yeni bir çapraz-kullanıcı bildirim türü
-- eklenirse bu listeye eklenmesi gerekir.
-- =====================================================================

drop policy if exists "notifications_insert" on public.notifications;

create policy "notifications_insert"
  on public.notifications
  for insert
  with check (
    auth.uid() is not null
    and (
      user_id = auth.uid()
      or type in (
        'collab_plan_invite',
        'lesson_plan_revision_requested',
        'lesson_plan_rejected',
        'lesson_plan_new',
        'lesson_plan_accepted',
        'collab_goal_deleted',
        'kudos',
        'buddy_habit_deleted',
        'buddy_session_ended',
        'classroom_weekly_digest',
        'group_invite',
        'group_slot_open',
        'group_announcement',
        'assignment_new',
        'assignment_reminder',
        'mention'
      )
    )
  );
