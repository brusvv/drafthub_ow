# Draft Hub — гайд по аудиту кода

Этот документ описывает **как проводить** аудит — какие команды запускать,
на что смотреть, что считать нормой, а что проблемой.  
Не разовый отчёт, а повторяемый процесс.

---

## Подготовка

```bash
# Распаковать и перейти в корень репозитория
cd drafthub_ow-main

# Убедиться что сборка проходит — это базовая проверка работоспособности
bash build.sh
# Ожидаемый вывод: ✓ Собрано: dist/index.html (XXXX строк)
# Если строк резко меньше/больше предыдущего — что-то изменилось

# Общая статистика файлов
find src/js -name '*.js' | xargs wc -l | sort -rn | head -20
find src/css -name '*.css' | xargs wc -l | sort -rn
```

---

## 1. Мёртвый код

**Что искать:** файлы которые есть в `src/` но не попадают в сборку.

```bash
# Все JS-файлы в src/
find src/js -name '*.js' | sed 's|src/||' | sort > /tmp/all_js.txt

# Все JS-файлы в build.sh
grep -o 'js/[^ ]*\.js' build.sh | sort > /tmp/build_js.txt

# Разница — файлы которые НЕ в сборке
diff /tmp/all_js.txt /tmp/build_js.txt | grep '^<' | sed 's/< //'
```

**Норма:** пусто. Любой файл в `src/js/` должен быть в `build.sh`.

**Что делать с находками:**
- Если файл — старая версия нового файла (например `sheets-load.js` vs `db-load.js`) → удалить
- Если файл содержит функции которые нигде не вызываются → проверить grep и удалить
- Если файл нужен но не в сборке → добавить в `build.sh` в правильное место

**Текущий статус (24.06.2025):**
```
js/data/sheets-load.js   — дублирует db-load.js, удалить
js/data/sheets-sync.js   — дублирует db-sync.js, удалить
js/write/write-hero.js   — дублирует db-write.js, удалить
js/write/write-map.js    — дублирует db-write.js, удалить
js/write/write-player.js — дублирует db-write.js, удалить
js/picker/picker-maps.js — функционал в modal-hero-strength.js, удалить
```

---

## 2. Дублирующиеся функции

**Что искать:** одно имя функции объявлено в двух разных файлах.

```bash
# Все объявления функций — имена с дублями
grep -rh 'function [a-zA-Z_][a-zA-Z0-9_]*(' src/js/ | \
  grep -v '^\s*//' | \
  sed 's/.*function //' | sed 's/(.*//' | \
  sort | uniq -d

# Для каждого дубля — найти в каких файлах
FUNCNAME="saveHero"  # подставить имя
grep -rln "function ${FUNCNAME}\b" src/js/
```

**Норма:** каждая функция в одном файле. Исключение — намеренные
`window.confirmPicker` цепочки (см. раздел 4).

**Текущий статус:** дубли `saveHero/Map/Player`, `deleteHero/Map/Player`,
`loadHeroes/Maps/Players/Tiers/AllData` — все из-за мёртвых файлов в `write/` и `sheets-*`.
Исчезнут после удаления мёртвого кода.

---

## 3. SQL — порядок миграций и дубли функций

**Важно:** SQL-файлы применяются последовательно. Если функция
переопределяется в нескольких файлах — это нормально (патчи),
но нужно понимать какая версия финальная.

```bash
# Функции объявленные в нескольких SQL-файлах
python3 - << 'EOF'
import re, os, collections

all_fns = collections.defaultdict(list)
for fname in sorted(os.listdir('supabase')):
    if not fname.endswith('.sql'): continue
    text = open(f'supabase/{fname}').read()
    for m in re.finditer(r'CREATE OR REPLACE FUNCTION (?:public\.)?(\w+)\s*\(', text):
        all_fns[m.group(1)].append(fname)

for fn, files in sorted(all_fns.items()):
    if len(files) > 1:
        print(f"  {fn}: {' → '.join(files)}")
EOF
```

**Норма:** функция в нескольких файлах — окей если это патч (более поздний файл
исправляет более ранний). Не окей если одна и та же версия без изменений.

**Текущий статус:**
```
create_tier_set       : 002 → 004 → 005   (004 и 005 — патчи, финальная в 005)
get_team_members      : 002 → 004          (004 — патч с SET search_path)
rename_team           : 002 → 004          (004 — патч)
role_sort_order       : 002 → 004          (004 — патч)
set_default_tier_set  : 002 → 004 → 005   (финальная в 005)
view_shared_tier      : 004 → 005          (финальная в 005)
```

---

## 4. SQL — SECURITY DEFINER без SET search_path

**Это уязвимость.** `SECURITY DEFINER` функция выполняется с правами владельца,
и если `search_path` не зафиксирован — атакующий может создать свою схему
с тем же именем таблицы и подменить данные.

```bash
# Найти все SECURITY DEFINER функции без SET search_path
python3 - << 'EOF'
import re, os

for fname in sorted(os.listdir('supabase')):
    if not fname.endswith('.sql'): continue
    text = open(f'supabase/{fname}').read()
    for m in re.finditer(
        r'(CREATE OR REPLACE FUNCTION (?:public\.)?(\S+)\(.*?)(?=CREATE OR REPLACE FUNCTION|\Z)',
        text, re.DOTALL
    ):
        body, name = m.group(1), m.group(2)
        if 'SECURITY DEFINER' in body and 'SET search_path' not in body:
            print(f'  ⚠ {fname}: {name}')
EOF
```

**Норма:** каждая `SECURITY DEFINER` функция должна иметь `SET search_path = public`.

**Шаблон исправления:**
```sql
-- было
CREATE OR REPLACE FUNCTION my_fn(p_id uuid)
RETURNS bool LANGUAGE sql SECURITY DEFINER STABLE AS $$
  ...
$$;

-- стало
CREATE OR REPLACE FUNCTION my_fn(p_id uuid)
RETURNS bool LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  ...
$$;
```

**Текущий статус (24.06.2025):** ~15 функций в `002_functions_and_rls.sql`
без `SET search_path`. Supabase Dashboard предупреждает об этом в разделе
Database → Functions (жёлтый треугольник).

---

## 5. RLS — проверка политик

```bash
# Все таблицы с включённым RLS — в SQL Editor:
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

# Политики для конкретной таблицы
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE tablename = 'user_roles'  -- подставить имя
ORDER BY cmd;

# Таблицы С RLS но БЕЗ политик (полная блокировка — никто не читает)
SELECT t.tablename
FROM pg_tables t
LEFT JOIN pg_policies p ON p.tablename = t.tablename
WHERE t.schemaname = 'public'
  AND t.rowsecurity = true
  AND p.policyname IS NULL;
```

**На что смотреть:**
- Таблица с RLS но без политик — это баг, никто не может читать данные
- Политики на `user_roles` которые читают `user_roles` внутри `USING` → рекурсия (42P17)
- `WITH CHECK (true)` — слишком широкая политика, проверить намеренно ли
- Политика `USING (auth.uid() IS NOT NULL)` без `TO authenticated` — применяется к anon тоже

**Проверка рекурсии:**
```sql
-- Если была ошибка 42P17 — проверить что функции используют SECURITY DEFINER
SELECT proname, prosecdef
FROM pg_proc
WHERE proname IN ('can_see_team_members', 'has_permission', 'my_team_role');
-- prosecdef должно быть true у всех
```

---

## 6. Паттерн confirmPicker — цепочка переопределений

**Текущая архитектура:** `window.confirmPicker` перезаписывается в 4 файлах,
каждый сохраняет предыдущую версию и вызывает её в `else`.

```bash
# Найти все переопределения
grep -rn 'window.confirmPicker\s*=' src/js/
```

**Порядок в build.sh имеет значение** — файлы должны идти именно так:
```
picker-core.js          → базовая реализация
modal-hero.js           → добавляет 'synergy'
picker-comp.js          → добавляет 'comp_slot'
render-bans-core.js     → добавляет 'banHeroes', 'tournMapPool'
render-draft-comp.js    → добавляет 'draftOur', 'draft_*'
```

**Проверка:** если добавляется новый режим пикера (`pickerMode = 'newMode'`),
убедиться что файл с его обработчиком загружается **после** всех предыдущих.

**Долгосрочное решение** (рефакторинг, не срочно):
```js
// picker-core.js
const _pickerHandlers = {};
function registerPickerHandler(mode, fn) {
  _pickerHandlers[mode] = fn;
}
function confirmPicker() {
  const handler = _pickerHandlers[pickerMode];
  if (handler) handler();
  else _defaultConfirm();
}
```

---

## 7. Inline styles в JS

**Что искать:** `style="..."` внутри template literals в JS-файлах.
Это не баг, но затрудняет переопределение стилей и тему.

```bash
# Количество строк с inline style по файлам
for f in src/js/render/*.js src/js/draft/*.js; do
  count=$(grep -c 'style="' "$f" 2>/dev/null || echo 0)
  [ "$count" -gt 5 ] && echo "$count  $f"
done

# Самые частые паттерны — кандидаты на вынос в CSS
grep -roh 'style="[^"]*"' src/js/ | \
  sed 's/style="//;s/"//' | \
  grep -oP '[\w-]+:[\s\w#%().,var-]+' | \
  sort | uniq -c | sort -rn | head -20
```

**Норма:** inline style допустим для **динамических значений** (цвет из переменной,
ширина из данных). Не допустим для статичных паттернов вроде
`display:flex;align-items:center;gap:8px` — это должен быть CSS-класс.

**Топ кандидатов на вынос:**
```js
// Эти паттерны встречаются 10+ раз — сделать CSS-классы
"display:flex;align-items:center;gap:8px"    → .flex-row
"font-family:var(--mono);font-size:9px;..."  → .mono-label
"display:flex;flex-direction:column;gap:6px" → .flex-col
```

---

## 8. CSS — медиазапросы

**Принцип:** все `@media` должны быть в `responsive.css`. Исключение —
если брейкпоинт специфичен для одного компонента и нигде больше не нужен.

```bash
# Медиазапросы вне responsive.css
grep -rn '@media' src/css/ | grep -v 'responsive.css'
```

**Текущий статус:** 4 файла содержат `@media` вне `responsive.css`:
`modals.css`, `strength.css`, `tiers.css`, `bans.css`. Это приемлемо —
каждый для своего компонента. При рефакторинге CSS можно централизовать.

**Проверить также:** `responsive.css` должен быть **последним** в `build.sh`
(чтобы его правила перебивали компонентные стили).
```bash
grep -n 'css/' build.sh | tail -3
# responsive.css должен быть в конце списка CSS
```

---

## 9. JS — обращения к устаревшим таблицам

После миграции схемы (`team_members` → `user_roles`, `team_roles` → `roles`)
старые имена не должны встречаться в JS.

```bash
# Проверить обращения к старым таблицам
grep -rn "from('team_members')\|from('team_roles')\|\.from\(\"team_members\"\)" src/js/
```

**Норма:** пусто. Любое вхождение — баг который нужно исправить на `user_roles`/`roles`.

**Текущий статус:** одно упоминание `team_members` в `team.js` строка 145
через `rpc('get_team_members')` — это RPC вызов, не прямое обращение к таблице, ок.

---

## 10. Глобальные переменные vs store

```bash
# Переменные которые используются глобально но не через store
grep -rn '^let \|^var \|^const ' src/js/render/ src/js/draft/ | \
  grep -v 'function\|=>' | head -20

# Сравнить с тем что в store.js
grep 'INITIAL_STATE' src/js/core/store.js -A 80 | head -60
```

**Что искать:** `let heroSynergy = {}`, `let tierViewMode = 'team'` и подобные
в render-файлах — это состояние которое должно быть в store, иначе теряется
при hot-reload и сложно дебажить.

**Норма:** состояние приложения — в store. Локальные переменные функций — ок.

---

## 11. Быстрая проверка перед деплоем (чеклист)

```bash
# 1. Сборка проходит
bash build.sh

# 2. Нет мёртвых файлов
diff <(find src/js -name '*.js' | sed 's|src/||' | sort) \
     <(grep -o 'js/[^ ]*\.js' build.sh | sort)

# 3. Нет дублей функций (кроме известных confirmPicker)
grep -rh 'function [a-zA-Z_][a-zA-Z0-9_]*(' src/js/ | \
  grep -v '^\s*//' | sed 's/.*function //;s/(.*//' | \
  sort | uniq -d | grep -v '^_'  # _ префикс — приватные, норма

# 4. Нет обращений к старым таблицам
grep -rn "from('team_members')\|from('team_roles')" src/js/

# 5. dist не содержит буквальных ${переменных} (баг template literal)
grep -c '\${[a-z]' dist/index.html
# Ожидаемый результат: 0
```

---

## Структура папок — справочник

```
src/
  css/
    base/         — переменные, типографика, auth-экраны, responsive
    features/     — стили по фичам (maps, heroes, players, tiers, subroles)
    modals/       — стили модалок и пикеров
    draft/        — стили драфта и банов
    admin.css     — стили admin-панели
  html/
    main-app.html — основной layout приложения
    auth.html     — экраны логина
    modal-*.html  — HTML модалок
    picker.html   — HTML пикера
    map-str-picker.html
  js/
    auth/         — авторизация: Supabase client, сессия, команды, UI
    core/         — store (состояние), config (прокси + константы)
    data/         — загрузка (db-load), запись (db-write), синхронизация
    scoring/      — алгоритмы скоринга (без DOM, можно тестировать)
    picker/       — логика пикера героев
    modals/       — логика модалок (герой, карта)
    render/       — рендер вьюх
    draft/        — рендер драфта и банов
  
supabase/
  001_tables.sql             — все таблицы, первичная схема
  002_functions_and_rls.sql  — функции, триггеры, RLS политики
  003_superadmin.sql         — admin RPC (list_app_users, set_app_role)
  004_fixes.sql              — патч существующих БД (идемпотентный)
  005_personal_tiers.sql     — личные тир-листы, share-ссылки
  006_hero_counters.sql      — (посмотреть что внутри)

scripts/
  import-from-sheets.js      — разовый импорт данных из Google Sheets
  package.json
  .env.example
```

---

## Известные технические долги

| # | Описание | Приоритет | Риск правки |
|---|----------|-----------|-------------|
| 1 | 6 мёртвых файлов в src/js | Высокий | Нулевой |
| 2 | `confirmPicker` переопределяется 4 раза | Средний | Средний |
| 3 | ~15 SECURITY DEFINER без SET search_path | Высокий | Низкий |
| 4 | 435 строк inline style в JS | Низкий | Итеративный |
| 5 | `toast()` и `esc()` в render-nav.js вместо render-utils.js | Низкий | Низкий |
| 6 | Глобальные переменные вне store (tierViewMode, heroSynergy) | Средний | Средний |
| 7 | 004_fixes.sql дублирует 6 функций из 002 (нужна консолидация) | Средний | Низкий |
