# Draft Hub — гайд по аудиту кода

Этот документ описывает **как проводить** аудит — какие команды запускать,
на что смотреть, что считать нормой, а что проблемой.  
Не разовый отчёт, а повторяемый процесс. Обновляется по мере закрытия долгов.

---

## Подготовка

```bash
cd drafthub_ow-main

# Базовая проверка — сборка проходит
bash build.sh
# Ожидаемый вывод: ✓ Собрано: dist/index.html (XXXX строк)
# Резкое изменение строк (±200+) = что-то изменилось, проверить

# Статистика
find src/js -name '*.js' | xargs wc -l | sort -rn | head -20
find src/css -name '*.css' | xargs wc -l | sort -rn
```

---

## 1. Мёртвый код

```bash
find src/js -name '*.js' | sed 's|src/||' | sort > /tmp/all_js.txt
grep -o 'js/[^ ]*\.js' build.sh | sort > /tmp/build_js.txt
diff /tmp/all_js.txt /tmp/build_js.txt | grep '^<' | sed 's/< //'
```

**Норма:** пусто.  
**Текущий статус (26.06.2025):** ✅ Нет мёртвых файлов.

---

## 2. Дублирующиеся JS-функции

```bash
grep -rh 'function [a-zA-Z_][a-zA-Z0-9_]*(' src/js/ | \
  grep -v '^\s*//' | sed 's/.*function //;s/(.*//' | sort | uniq -d

# Для каждого дубля — найти файлы
FUNCNAME="saveHero"
grep -rln "function ${FUNCNAME}\b" src/js/
```

**Норма:** каждая функция в одном файле.  
**Текущий статус:** ✅ Дублей нет (мёртвые файлы удалены).  
**Исключение:** `window.confirmPicker` — намеренная цепочка, см. раздел 6.

---

## 3. SQL — инвентарь функций по файлам

```bash
R="."
for f in $R/supabase/*.sql; do
  echo "── $(basename $f) ──"
  grep -n "^CREATE OR REPLACE FUNCTION\|SECURITY DEFINER\|SET search_path" "$f" | \
    grep -v "^[0-9]*:--"
  echo ""
done
```

**Дополнительно — дубли функций между файлами:**
```bash
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
        print(f"  ДУБЛЬ {fn}: {' → '.join(files)}")
EOF
```

**Норма:** функция в нескольких файлах допустима ТОЛЬКО если второй файл — патч.  
⚠️ **Текущий статус (26.06.2025):** `003_rls.sql` и `004_rpc.sql` — **идентичные файлы** (md5 совпадает). Это баг bor при реструктуризации. 11 функций задублированы. Требует исправления — один из файлов должен содержать только политики (RLS), второй только RPC.

---

## 4. SQL — SECURITY DEFINER без SET search_path

```bash
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

**Норма:** каждая `SECURITY DEFINER` функция → `SET search_path = public`.  
**Текущий статус:** ✅ Все 31 функция имеют `SET search_path` (bor-1 завершён).

**Шаблон:**
```sql
CREATE OR REPLACE FUNCTION my_fn(p_id uuid)
RETURNS bool LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  ...
$$;
```

---

## 5. RLS — проверка политик (в Supabase SQL Editor)

```sql
-- Таблицы С RLS но БЕЗ политик (полная блокировка)
SELECT t.tablename
FROM pg_tables t
LEFT JOIN pg_policies p ON p.tablename = t.tablename
WHERE t.schemaname = 'public'
  AND t.rowsecurity = true
  AND p.policyname IS NULL;

-- Политики конкретной таблицы
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies WHERE tablename = 'user_roles' ORDER BY cmd;

-- Проверка рекурсии (ошибка 42P17)
SELECT proname, prosecdef FROM pg_proc
WHERE proname IN ('can_see_team_members', 'has_permission', 'my_team_role');
-- prosecdef должно быть true у всех
```

**На что смотреть:**
- Таблица с RLS без политик → баг, никто не читает
- `EXISTS(SELECT ... FROM user_roles)` внутри политики на `user_roles` → рекурсия 42P17
- `WITH CHECK (true)` без `TO authenticated` → anon тоже проходит

---

## 6. confirmPicker — цепочка переопределений

```bash
grep -rn 'window.confirmPicker\s*=' src/js/
```

**Текущий статус (26.06.2025):** 4 переопределения — LEQ-2 ещё не завершён.  
**После LEQ-2:** должно быть 0 переопределений, вместо них — `registerPickerHandler(mode, fn)`.

**Порядок в build.sh критичен** (пока не рефакторинг):
```
picker-core.js       → базовая реализация
modal-hero.js        → 'synergy'
picker-comp.js       → 'comp_slot'
render-bans-core.js  → 'banHeroes', 'tournMapPool'
render-draft-comp.js → 'draftOur', 'draft_*'
```

**Проверка 12 режимов пикера:**
```bash
grep -rn "pickerMode\s*=\s*'" src/js/ | grep -v '//' | sed "s/.*pickerMode = '//;s/'.*//" | sort -u
# Должны быть: preferred bans comp mapCounters playerMain playerPool
#              synergy comp_slot banHeroes tournMapPool draftOur draft_*
```

---

## 7. Inline styles в JS

```bash
# По файлам
for f in src/js/render/*.js src/js/draft/*.js; do
  count=$(grep -c 'style="' "$f" 2>/dev/null || echo 0)
  [ "$count" -gt 5 ] && printf "%3d  %s\n" "$count" "$f"
done

# Топ статичных паттернов — кандидаты на CSS-класс
grep -roh 'style="[^"]*"' src/js/render/ src/js/draft/ | \
  sed 's/style="//;s/"//' | sort | uniq -c | sort -rn | \
  awk '$1 > 1' | head -20
```

**Норма:** inline допустим только для динамических значений (`color:${rc[role]}`).  
**Текущий статус:** NAT-1/2 снизили с 435 до ~310. Топ оставшихся файлов:
```
37  render-tier-share.js   ← не тронут NAT
37  render-tiers.js        ← NAT-2 частично
37  render-bans-tournament-herobans.js
32  render-draft-comp.js
29  render-bans-competitive.js
```

---

## 8. CSS — медиазапросы

```bash
grep -rn '@media' src/css/ | grep -v 'responsive.css'
# Приемлемо если @media специфичен для одного компонента
# responsive.css должен быть последним в build.sh:
grep -n 'css/' build.sh | tail -3
```

---

## 9. JS — устаревшие таблицы (после миграции схемы)

```bash
grep -rn "from('team_members')\|from('team_roles')" src/js/
# Норма: пусто
```

**Текущий статус:** ✅ Нет обращений к старым таблицам.

---

## 10. Глобальные переменные вне store

```bash
grep -rn '^let \|^var ' src/js/render/ src/js/draft/ | \
  grep -v 'function\|=>' | grep -v '^\s*//'
```

**Текущий статус — остались вне store:**
```
render-bans-core.js:         let banMode          (сброс через resetBanMode())
render-draft-comp.js:        let draftState        (сброс через resetDraftState())
render-bans-tournament-draft: let tournMapPool/etc (сброс через resetTournamentDraft())
```
Эти переменные сбрасываются при `switchTeam` — приемлемо до полного переезда в store.

---

## 11. Протокол агентов — проверка версий файлов

```bash
# Перед началом задачи
python3 scripts/agent_log.py check

# После завершения
python3 scripts/agent_log.py update <агент> <задача> <файл1> [файл2 ...]
```

**Методология умного обновления MD-файлов (экономия токенов):**

Агенты НЕ пишут MD с нуля. Алгоритм:

1. **Прочитать только нужные секции** — не весь файл целиком
2. **Патчить точечно** через `str_replace` или `sed -i`:
   ```bash
   # Обновить только строку с конкретным файлом в AGENT_FILE_LOG.md
   python3 scripts/agent_log.py update <агент> <задача> <файл>
   # Скрипт сам обновит только нужную строку таблицы
   ```
3. **Для AGENT_TASKS_N.md** — никогда не переписывать весь файл. Только:
   - Изменить статус `⏳ не начато` → `✅ ЗАВЕРШЕНО` в нужной строке
   - Добавить хэши в таблицу выходных файлов
   - Дописать в конец раздела «Новая задача» если нужно
4. **Запрещено:** читать все 300+ строк AGENT_TASKS файла чтобы добавить 3 строки в конец

**Шаблон минимального обновления статуса агента:**
```bash
# Найти строку и заменить статус
sed -i 's/⏳ не начато/✅ ЗАВЕРШЕНО/' AGENT_TASKS_N.md

# Добавить хэши в таблицу (дописать после нужного агента)
# Читать только свою секцию:
sed -n '/^## 🔧 Агент LEQ/,/^## /p' AGENT_TASKS_N.md | head -20
```

---

## 12. Чеклист перед деплоем

```bash
# 1. Сборка
bash build.sh

# 2. Нет мёртвых файлов
diff <(find src/js -name '*.js' | sed 's|src/||' | sort) \
     <(grep -o 'js/[^ ]*\.js' build.sh | sort)

# 3. Нет дублей функций
grep -rh 'function [a-zA-Z_][a-zA-Z0-9_]*(' src/js/ | \
  grep -v '^\s*//' | sed 's/.*function //;s/(.*//' | sort | uniq -d

# 4. Нет устаревших таблиц
grep -rn "from('team_members')\|from('team_roles')" src/js/

# 5. dist без буквальных ${переменных}
grep -c '\${[a-z]' dist/index.html
# Норма: 0

# 6. Версии файлов актуальны
python3 scripts/agent_log.py check

# 7. SQL — нет идентичных файлов
md5sum supabase/*.sql | awk '{print $1}' | sort | uniq -d
# Норма: пусто
```

---

## Структура папок — справочник

```
src/
  css/
    base/         — переменные, типографика, auth-экраны, responsive, nav-count
    features/     — maps, heroes, players, tiers, subroles
    modals/       — модалки, пикеры, toast (top-right после stg-blue)
    draft/        — драфт, баны
    admin.css
  html/
    main-app.html — layout, nav с span.nav-count
    auth.html
    modal-*.html
    picker.html, map-str-picker.html
  js/
    auth/         — session (switchTeam + _resetTeamSpecificState), team, ui
    core/         — store, config
    data/         — db-load (updateNavCounts), db-write, db-sync
    scoring/      — скоринг (без DOM, тестируемо)
    picker/       — picker-core (registerPickerHandler после LEQ), picker-comp
    modals/       — modal-hero, modal-hero-chips, modal-hero-strength, modal-map
    render/       — render-utils, render-nav, render-maps, render-heroes,
                    render-tiers, render-tier-share, render-players, render-roster,
                    render-admin-ui, render-admin-import
    draft/        — render-bans-core, render-bans-competitive,
                    render-bans-tournament-draft, render-bans-tournament-herobans,
                    render-draft-comp

supabase/
  001_tables.sql       — DDL только
  002_functions.sql    — 31 функция, все SECURITY DEFINER + SET search_path
  003_rls.sql          — ⚠️ ИДЕНТИЧЕН 004, баг bor — нужно разделить
  004_rpc.sql          — ⚠️ ИДЕНТИЧЕН 003, баг bor — нужно разделить
  006_hero_counters.sql — hero_counters (global/personal), применять после 004

scripts/
  agent_log.py         — протокол версий агентов (положить в scripts/)
  import-from-sheets.js
  package.json, .env.example
```

---

## Технические долги — актуальный статус

| # | Описание | Приоритет | Статус |
|---|----------|-----------|--------|
| 1 | Мёртвые файлы | Высокий | ✅ Закрыт |
| 2 | `confirmPicker` цепочка → dispatch | Средний | ⏳ LEQ-2 |
| 3 | SECURITY DEFINER без search_path | Высокий | ✅ Закрыт (bor-1) |
| 4 | Inline styles в JS (~310 осталось) | Низкий | ⏳ NAT-3/4 + render-tier-share.js |
| 5 | `toast()`/`esc()` в render-nav | Низкий | ✅ Закрыт (stg-blue A1) |
| 6 | Глобальные переменные вне store | Средний | ⏳ Частично (reset есть, store нет) |
| 7 | SQL 003==004 идентичны | **Критично** | ❌ Новый баг (bor) |
| 8 | render-tier-share.js — 37 inline styles | Низкий | ❌ Не тронут |
| 9 | agent_log.py не в scripts/ репо | Средний | ❌ Добавить в репо |
