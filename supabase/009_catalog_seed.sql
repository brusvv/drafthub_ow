-- ════════════════════════════════════════════════════════════
-- DraftHub OW — 009_catalog_seed.sql
-- MIGR-1, файл 3/3: seed hero_catalog + map_catalog.
-- Применять после 007_catalog_tables.sql и 008_catalog_rls.sql.
-- Идемпотентно (ON CONFLICT) — можно перекатывать при добавлении
-- новых героев/карт по сезону, не пересоздавая схему.
-- ════════════════════════════════════════════════════════════

-- ── hero_catalog: 52 героя ──
-- Роли/подклассы сверены (веб-поиск против Overwatch Fandom Wiki +
-- независимые игровые СМИ) по состоянию на текущий сезон, включая
-- героев, добавленных после среза общих знаний модели: Anran, Domina,
-- Emre, Jetpack Cat, Mizuki, Shion, Sierra, Vendetta — все подтверждены
-- как реально выпущенные играбельные герои, не утечки/слухи.
INSERT INTO hero_catalog (name, role, subrole) VALUES
  ('Ana',            'Support', 'Tactician'),
  ('Anran',          'Damage',  'Flanker'),
  ('Ashe',           'Damage',  'Sharpshooter'),
  ('Baptiste',       'Support', 'Tactician'),
  ('Bastion',        'Damage',  'Specialist'),
  ('Brigitte',       'Support', 'Survivor'),
  ('Cassidy',        'Damage',  'Sharpshooter'),
  ('D.Va',           'Tank',    'Initiator'),
  ('Domina',         'Tank',    'Stalwart'),
  ('Doomfist',       'Tank',    'Initiator'),
  ('Echo',           'Damage',  'Recon'),
  ('Emre',           'Damage',  'Specialist'),
  ('Freja',          'Damage',  'Recon'),
  ('Genji',          'Damage',  'Flanker'),
  ('Hanzo',          'Damage',  'Sharpshooter'),
  ('Hazard',         'Tank',    'Initiator'),
  ('Illari',         'Support', 'Survivor'),
  ('Jetpack Cat',    'Support', 'Tactician'),
  ('Junker Queen',   'Tank',    'Stalwart'),
  ('Junkrat',        'Damage',  'Specialist'),
  ('Juno',           'Support', 'Survivor'),
  ('Kiriko',         'Support', 'Medic'),
  ('Lifeweaver',     'Support', 'Medic'),
  ('Lucio',          'Support', 'Tactician'),
  ('Mauga',          'Tank',    'Bruiser'),
  ('Mei',            'Damage',  'Specialist'),
  ('Mercy',          'Support', 'Medic'),
  ('Mizuki',         'Support', 'Survivor'),
  ('Moira',          'Support', 'Medic'),
  ('Orisa',          'Tank',    'Bruiser'),
  ('Pharah',         'Damage',  'Recon'),
  ('Ramattra',       'Tank',    'Stalwart'),
  ('Reaper',         'Damage',  'Flanker'),
  ('Reinhardt',      'Tank',    'Stalwart'),
  ('Roadhog',        'Tank',    'Bruiser'),
  ('Shion',          'Damage',  'Flanker'),
  ('Sierra',         'Damage',  'Recon'),
  ('Sigma',          'Tank',    'Stalwart'),
  ('Sojourn',        'Damage',  'Sharpshooter'),
  ('Soldier: 76',    'Damage',  'Specialist'),
  ('Sombra',         'Damage',  'Recon'),
  ('Symmetra',       'Damage',  'Specialist'),
  ('Torbjörn',       'Damage',  'Specialist'),
  ('Tracer',         'Damage',  'Flanker'),
  ('Vendetta',       'Damage',  'Flanker'),
  ('Venture',        'Damage',  'Flanker'),
  ('Widowmaker',     'Damage',  'Sharpshooter'),
  ('Winston',        'Tank',    'Initiator'),
  ('Wrecking Ball',  'Tank',    'Initiator'),
  ('Wuyang',         'Support', 'Survivor'),
  ('Zarya',          'Tank',    'Bruiser'),
  ('Zenyatta',       'Support', 'Tactician')
ON CONFLICT (name) DO UPDATE SET
  role       = EXCLUDED.role,
  subrole    = EXCLUDED.subrole,
  updated_at = now();

-- ── map_catalog: 30 карт, актуальный список от пользователя ──
-- Все in_pool=true (текущая соревновательная ротация). Явно НЕТ карт
-- типа Clash (Throne of Anubis/Hanamura из старого config.js) — раз
-- пользователь их не включил в актуальный список, не восстанавливаю
-- по памяти; тип 'Clash' остаётся валидным значением CHECK на будущее,
-- но без данных сейчас. "Blizzard World" — исправлена опечатка
-- форматирования исходной таблицы (name/type были слиты в одну ячейку).
INSERT INTO map_catalog (name, type, in_pool) VALUES
  ('Aatlis',                 'Flashpoint', true),
  ('Antarctic Peninsula',    'Control',    true),
  ('Blizzard World',         'Hybrid',     true),
  ('Busan',                  'Control',    true),
  ('Circuit Royal',          'Escort',     true),
  ('Colosseo',               'Push',       true),
  ('Dorado',                 'Escort',     true),
  ('Eichenwalde',            'Hybrid',     true),
  ('Esperança',              'Push',       true),
  ('Havana',                 'Escort',     true),
  ('Hollywood',              'Hybrid',     true),
  ('Ilios',                  'Control',    true),
  ('Junkertown',             'Escort',     true),
  ('King''s Row',            'Hybrid',     true),
  ('Lijiang Tower',          'Control',    true),
  ('Midtown',                'Hybrid',     true),
  ('Neon Junction',          'Hybrid',     true),
  ('Nepal',                  'Control',    true),
  ('New Junk City',          'Flashpoint', true),
  ('New Queen Street',       'Push',       true),
  ('Numbani',                'Hybrid',     true),
  ('Oasis',                  'Control',    true),
  ('Paraíso',                'Hybrid',     true),
  ('Rialto',                 'Escort',     true),
  ('Route 66',               'Escort',     true),
  ('Runasapi',               'Push',       true),
  ('Samoa',                  'Control',    true),
  ('Shambali Monastery',     'Escort',     true),
  ('Suravasa',               'Flashpoint', true),
  ('Watchpoint: Gibraltar',  'Escort',     true)
ON CONFLICT (name) DO UPDATE SET
  type       = EXCLUDED.type,
  in_pool    = EXCLUDED.in_pool,
  updated_at = now();

NOTIFY pgrst, 'reload schema';
