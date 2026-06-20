-- ════════════════════════════════════════════════════════════
-- 006_grants.sql
-- GRANT базовых привилегий ролям authenticated/anon на все таблицы.
-- RLS-политики (002, 004, 005) продолжают контролировать ЧТО именно
-- видно/доступно — этот файл лишь открывает САМ доступ к таблице,
-- без которого Postgres блокирует запрос ещё до проверки RLS.
-- ════════════════════════════════════════════════════════════

-- Все таблицы в public-схеме, к которым обращается фронтенд через _sb.from(...)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams              TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_roles         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_invites       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.heroes             TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maps               TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hero_map_strength  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hero_synergy       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.players            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tier_data          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.global_tier_data   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tier_share_links   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sheets_tokens      TO authenticated;

-- Анонимная роль (anon) — нужна для просмотра публичных share-ссылок
-- (/tier/TOKEN) БЕЗ авторизации. RLS всё равно ограничит видимость
-- только публичными записями (is_public=true).
GRANT SELECT ON public.tier_share_links TO anon;
GRANT SELECT ON public.tier_data        TO anon;

-- RPC-функции тоже должны быть исполняемы соответствующими ролями
GRANT EXECUTE ON FUNCTION public.accept_invite(text)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.view_shared_tier(text)  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_default_roles(uuid) TO authenticated;

-- Сиквенсы (если используются для генерации ID помимо gen_random_uuid) —
-- обычно не нужны, так как все PK через uuid, но добавим на всякий случай
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
