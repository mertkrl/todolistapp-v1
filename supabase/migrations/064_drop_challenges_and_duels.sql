-- "Meydan okuma" (focus_challenges) ve "düello" (duels) özellikleri kaldırıldı.
-- Sosyal bölümde artık tek odaklanma modeli var: 1'e 1 "birlikte odaklanma"
-- odaları (cw_rooms) — ücretsiz planda 1'e 1, ücretli planda daha kalabalık
-- gruplar (ayrı bir migration'da ele alınacak). Bu tablolar/fonksiyon artık
-- kullanılmıyor; FK bağımlı tablolar önce silinir.

drop table if exists public.focus_challenge_invites cascade;
drop table if exists public.focus_challenge_participants cascade;
drop table if exists public.focus_challenges cascade;
drop table if exists public.duels cascade;

drop function if exists public.finalize_duel(uuid);
