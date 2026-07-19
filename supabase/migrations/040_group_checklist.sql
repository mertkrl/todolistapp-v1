-- ### 040_group_checklist.sql
-- Grup içi ortak checklist (paylaşılan yapılacaklar listesi)
-- Her grup için tek bir implicit checklist; tüm üyeler item ekleyip işaretleyebilir.

CREATE TABLE IF NOT EXISTS group_checklist_items (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id              uuid        NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  text                  text        NOT NULL CHECK (char_length(text) BETWEEN 1 AND 200),
  completed             boolean     NOT NULL DEFAULT false,
  completed_by_username text,
  completed_at          timestamptz,
  created_by            uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by_username   text        NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS group_checklist_items_group_id_idx ON group_checklist_items(group_id);

-- Row Level Security
ALTER TABLE group_checklist_items ENABLE ROW LEVEL SECURITY;

-- Üyeler okuyabilir
CREATE POLICY "group members read checklist"
  ON group_checklist_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = group_checklist_items.group_id
        AND group_members.user_id  = auth.uid()
    )
  );

-- Üyeler item ekleyebilir
CREATE POLICY "group members add checklist item"
  ON group_checklist_items FOR INSERT
  WITH CHECK (
    auth.uid() = created_by AND
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = group_checklist_items.group_id
        AND group_members.user_id  = auth.uid()
    )
  );

-- Üyeler tamamlandı işaretleyebilir / kaldırabilir
CREATE POLICY "group members update checklist item"
  ON group_checklist_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = group_checklist_items.group_id
        AND group_members.user_id  = auth.uid()
    )
  );

-- Oluşturan veya admin silebilir
CREATE POLICY "creator or admin delete checklist item"
  ON group_checklist_items FOR DELETE
  USING (
    auth.uid() = created_by OR
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = group_checklist_items.group_id
        AND group_members.user_id  = auth.uid()
        AND group_members.role     = 'admin'
    )
  );

-- Realtime güncellemeler için
ALTER PUBLICATION supabase_realtime ADD TABLE group_checklist_items;
