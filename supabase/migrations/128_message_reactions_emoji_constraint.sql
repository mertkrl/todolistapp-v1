-- ### 128_message_reactions_emoji_constraint.sql
-- ============================================================
-- Güvenlik sertleştirme: message_reactions.emoji sütununda hiçbir CHECK
-- kısıtı yoktu (016_group_message_pins_reactions.sql). Uygulama tarafında
-- emoji her zaman sabit bir picker listesinden (DC_EMOJI_GROUPS,
-- social.js) seçiliyor, ama RLS bu kolonun İÇERİĞİNİ doğrulamıyor —
-- sadece kullanıcının scope'a erişimini kontrol ediyor. Yani kimliği
-- doğrulanmış herhangi bir üye, Supabase REST/JS istemcisini UI'ı
-- atlayarak doğrudan çağırıp emoji alanına keyfi metin/HTML yazabilir;
-- bu değer daha sonra social.js'te `pill.innerHTML =
-- \`<span>${emoji}</span>...\`` ile ESCAPE EDİLMEDEN basılıyordu
-- (client tarafı ayrıca _escapeHtml() ile düzeltildi). Burada DB
-- tarafında da savunma amaçlı bir CHECK ekleniyor: makul bir uzunluk
-- sınırı + '<' '>' '&' gibi HTML'e özel karakterlerin engellenmesi.
-- ============================================================

alter table public.message_reactions
  add constraint message_reactions_emoji_chk
  check (
    char_length(emoji) between 1 and 16
    and emoji !~ '[<>&]'
  );
