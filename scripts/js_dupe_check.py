#!/usr/bin/env python3
"""Проверяет дубли функций в src/js/ с учётом порядка build.sh.

Три независимых отчёта:

1. КОЛЛИЗИИ ИМЁН (критично). build.sh склеивает все файлы в ОДИН <script>
   без модулей/import — значит имя верхнеуровневой функции должно быть
   уникально по всему src/js/, а не только в пределах файла. Вторая
   функция с тем же именем молча перезатирает первую при загрузке (не
   исключение, не warning — типичный источник "почему мой код не
   вызывается" багов). Это ровно то, что до сих пор проверялось руками
   через `grep -rh 'function name(' | sort | uniq -d` перед каждой сдачей
   — здесь то же самое, но с указанием файлов и строк. Ловит и
   `function name(){}`, и `window.name = function(){}`/`window.name = ...`
   — второй паттерн раньше не проверялся вообще (см. AUD-7, 18.07): те же
   молчаливые коллизии, просто другой синтаксис объявления.

2. ПОХОЖИЕ ТЕЛА ФУНКЦИЙ (эвристика, не баг сам по себе). Структурно
   похожие функции под РАЗНЫМИ именами — кандидаты на вынос в общий
   хелпер вместо N копий с мелкими различиями. В отличие от отчёта 1 это
   не автоматически "чини" — solid EXACT-дубликаты (100% после
   нормализации) можно консолидировать почти всегда безопасно; NEAR-дубли
   (порог `--similarity`, по умолчанию 0.85) — только сигнал "посмотри
   глазами", часто окажется что различия осмысленные.

3. ИНВЕНТАРЬ СБОРКИ (критично). Файл может существовать в src/js/, но не
   быть подключён в JS_MODULES build.sh (весь код в нём мёртв в
   dist/index.html, хотя выглядит как рабочий) — и наоборот, путь в
   JS_MODULES может указывать на файл, которого больше нет. Оба случая
   молчаливы: сборка не падает ни в одном (bash просто не находит файл
   или просто не включает лишний), узнаётся только руками. См. AUD-7
   (18.07) — тот же класс "тихого расхождения", что и коллизии имён выше.

Как и css_dupe_check.py: простой regex + подсчёт скобок, не полноценный
JS-парсер. Ловит `function name(...) {...}` и `async function name(...) {...}`
верхнего уровня файла (глубина скобок 0 на месте объявления) — вложенные
функции (замыкания, IIFE-хелперы внутри другой функции) не в глобальном
scope при сборке, поэтому не участвуют в отчёте 1 (коллизия имён), но
включены в отчёт 2 (копипаст возможен на любом уровне вложенности).

Использование:
  python3 scripts/js_dupe_check.py                       # JS_MODULES из build.sh
  python3 scripts/js_dupe_check.py --similarity 0.9
  python3 scripts/js_dupe_check.py src/js/draft/*.js      # явный список
"""
import argparse
import difflib
import glob
import re
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path

FUNC_RE = re.compile(
    r'(?P<async>async\s+)?function\s+(?P<name>[A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{',
)
# window.name = ... — второй способ объявить то, что по факту становится
# глобальным именем при сборке в один script. Не пытаемся понять ЧТО справа
# от "=" (функция/значение/геттер через Object.defineProperty — тот
# используется отдельно, сюда не попадает по синтаксису) — само по себе имя
# в left-hand side уже достаточно, чтобы коллизия имела смысл: вторая
# window.X = ... тем же именем молча перетирает первую независимо от того,
# что справа.
WINDOW_ASSIGN_RE = re.compile(r'^\s*window\.([A-Za-z_$][\w$]*)\s*=(?!=)')
JS_FILES_RE = re.compile(r'JS_MODULES=\((.*?)^\)', re.S | re.M)
JS_PATH_RE = re.compile(r'^\s*(js/[\w./-]+\.js)\s*$', re.M)

# Строковые/числовые литералы и однострочные комментарии нормализуются перед
# сравнением тел — иначе "тот же алгоритм, другое сообщение toast()" не
# считался бы похожим, хотя структурно это одна и та же функция.
LINE_COMMENT_RE = re.compile(r'//[^\n]*')
BLOCK_COMMENT_RE = re.compile(r'/\*.*?\*/', re.S)
WS_RE = re.compile(r'\s+')


@dataclass
class FuncDecl:
    name: str
    path: str
    line: int
    top_level: bool
    raw_body: str
    norm_body: str = field(default='', repr=False)


def build_order(build_path: Path) -> list[str]:
    match = JS_FILES_RE.search(build_path.read_text(encoding='utf-8'))
    if not match:
        raise ValueError(
            f'Не найден JS_MODULES в {build_path} — передай файлы явно аргументами '
            f'(имя переменной массива в build.sh могло измениться).'
        )
    paths = JS_PATH_RE.findall(match.group(1))
    if not paths:
        raise ValueError(f'JS_MODULES в {build_path} не содержит .js-путей')
    return [str(Path('src') / path) for path in paths]


def find_matching_brace(text: str, open_idx: int) -> int:
    """open_idx указывает на '{' — возвращает индекс закрывающей ей '}'."""
    depth = 0
    i = open_idx
    in_str = None
    while i < len(text):
        ch = text[i]
        if in_str:
            if ch == '\\':
                i += 2
                continue
            if ch == in_str:
                in_str = None
        elif ch in ('"', "'", '`'):
            in_str = ch
        elif ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                return i
        i += 1
    return -1  # несбалансировано — файл с синтаксической ошибкой либо regex промахнулся


def normalize_body(body: str) -> str:
    # НЕ трогаем строковые/числовые литералы: в этом проекте типичная функция
    # — render-хелпер, возвращающий один большой template literal с HTML —
    # это и есть содержательное тело. Схлопывание строк в один токен (как
    # изначально планировалось) даёт ложные срабатывания: три совершенно
    # разные формы (login/register/no-teams) превращались в "одинаковый"
    # `return STR;`. Только комментарии и пробелы — тело сравнивается
    # практически as-is, difflib.ratio() сам находит частичное совпадение
    # без необходимости в токенизации.
    body = BLOCK_COMMENT_RE.sub(' ', body)
    body = LINE_COMMENT_RE.sub(' ', body)
    body = WS_RE.sub(' ', body).strip()
    return body


def extract_functions(path: str) -> list[FuncDecl]:
    text = Path(path).read_text(encoding='utf-8')
    # Убираем комментарии заранее, чтобы closing-brace внутри
    # закомментированного примера кода не путал find_matching_brace.
    stripped = BLOCK_COMMENT_RE.sub(lambda m: '\n' * m.group().count('\n'), text)
    stripped = LINE_COMMENT_RE.sub('', stripped)

    out = []
    depth = 0
    in_str = None
    i = 0
    pending = list(FUNC_RE.finditer(stripped))
    pending_idx = 0
    while i < len(stripped):
        if pending_idx < len(pending) and pending[pending_idx].start() == i:
            m = pending[pending_idx]
            pending_idx += 1
            open_brace = m.end() - 1
            close_brace = find_matching_brace(stripped, open_brace)
            if close_brace != -1:
                line_no = stripped.count('\n', 0, m.start()) + 1
                raw_body = stripped[open_brace + 1:close_brace]
                out.append(FuncDecl(
                    name=m.group('name'), path=path, line=line_no,
                    top_level=(depth == 0), raw_body=raw_body,
                    norm_body=normalize_body(raw_body),
                ))
        ch = stripped[i]
        if in_str:
            if ch == '\\':
                i += 2
                continue
            if ch == in_str:
                in_str = None
        elif ch in ('"', "'", '`'):
            in_str = ch
        elif ch == '{':
            depth += 1
        elif ch == '}':
            depth = max(0, depth - 1)
        i += 1
    return out


def extract_window_assignments(path: str) -> list[tuple[str, str, int]]:
    """Возвращает (name, path, line) для верхнеуровневых window.X = ...

    Как и FUNC_RE выше — не полноценный парсер, только top-level (depth==0
    на строке присвоения), той же логикой отслеживания глубины скобок что
    и extract_functions(), но по строкам (сама конструкция однострочная в
    этом проекте — Object.defineProperties(window,{...}) блоки НЕ матчатся
    этим regex'ом намеренно, у них другой синтаксис, не `window.X =`).
    """
    text = Path(path).read_text(encoding='utf-8')
    stripped = BLOCK_COMMENT_RE.sub(lambda m: '\n' * m.group().count('\n'), text)
    stripped = LINE_COMMENT_RE.sub('', stripped)

    out = []
    depth = 0
    for line_no, line in enumerate(stripped.splitlines(), 1):
        match = WINDOW_ASSIGN_RE.match(line)
        if depth == 0 and match:
            out.append((match.group(1), path, line_no))
        depth += line.count('{') - line.count('}')
        depth = max(depth, 0)
    return out


def report_name_collisions(funcs: list[FuncDecl], window_assigns: list[tuple[str, str, int]]) -> int:
    by_name = defaultdict(list)
    for f in funcs:
        if f.top_level:
            by_name[f.name].append(('function', f.path, f.line))
    for name, path, line in window_assigns:
        by_name[name].append(('window.assign', path, line))

    collisions = {name: items for name, items in by_name.items() if len(items) > 1}
    if not collisions:
        print('✓ Коллизий имён верхнеуровневых функций/window-присвоений не найдено.\n')
        return 0
    print(f'⚠️  {len(collisions)} ИМЁН ОБЪЯВЛЕНЫ ПОВТОРНО (build order — последнее побеждает):\n')
    for name, items in collisions.items():
        # items уже в build order, т.к. funcs/window_assigns собирались по paths в этом порядке
        winner = items[-1]
        for kind, path, line in items[:-1]:
            print(f'  ⚠️  {name} [{kind}] {path}:{line} — МОЛЧА ПЕРЕЗАТЁРТА версией из '
                  f'[{winner[0]}] {winner[1]}:{winner[2]}')
    print()
    return len(collisions)


def report_similar_bodies(funcs: list[FuncDecl], threshold: float, min_lines: int) -> int:
    # Пропускаем тривиальные функции — шум (геттеры на 1 строку, пустые
    # заглушки) с высокой похожестью, но без реальной ценности для выноса.
    candidates = [f for f in funcs if f.raw_body.count('\n') + 1 >= min_lines]

    exact = defaultdict(list)
    for f in candidates:
        exact[f.norm_body].append(f)
    exact_dupes = {body: items for body, items in exact.items() if len(items) > 1}

    near_pairs = []
    if threshold < 1.0:
        seen_bodies = set(exact_dupes.keys())
        pool = [f for f in candidates if f.norm_body not in seen_bodies]
        for i in range(len(pool)):
            for j in range(i + 1, len(pool)):
                a, b = pool[i], pool[j]
                if a.name == b.name and a.path == b.path:
                    continue
                # Быстрый предфильтр по длине — избегаем дорогого SequenceMatcher
                # на заведомо непохожих по размеру функциях.
                la, lb = len(a.norm_body), len(b.norm_body)
                if la == 0 or lb == 0 or min(la, lb) / max(la, lb) < threshold:
                    continue
                ratio = difflib.SequenceMatcher(None, a.norm_body, b.norm_body).ratio()
                if ratio >= threshold:
                    near_pairs.append((ratio, a, b))
        near_pairs.sort(key=lambda x: -x[0])

    if not exact_dupes and not near_pairs:
        print('✓ Похожих тел функций (по заданному порогу) не найдено.\n')
        return 0

    if exact_dupes:
        print(f'━━━ ТОЧНЫЕ ДУБЛИ ТЕЛА (после нормализации строк/чисел/комментариев) — {len(exact_dupes)} ━━━\n')
        for body, items in exact_dupes.items():
            names = ', '.join(f'{it.name}() {it.path}:{it.line}' for it in items)
            print(f'  {names}')
        print()

    if near_pairs:
        print(f'━━━ ПОХОЖИЕ ТЕЛА (порог {threshold}) — {len(near_pairs)} пар, кандидаты на общий хелпер ━━━\n')
        for ratio, a, b in near_pairs:
            print(f'  {ratio:.0%}  {a.name}() {a.path}:{a.line}  ~  {b.name}() {b.path}:{b.line}')
        print()

    return len(exact_dupes)


def report_build_inventory(paths: list[str]) -> int:
    """Файлы в src/js/ отсутствующие в JS_MODULES (мёртвый код — не попадает
    в dist/index.html вообще) и пути в JS_MODULES без файла на диске
    (сборка молча пропускает — bash не падает на отсутствующем cat)."""
    source_files = sorted(str(p) for p in Path('src/js').rglob('*.js'))
    build_files = set(paths)
    missing_from_build = sorted(set(source_files) - build_files)
    missing_from_source = sorted(p for p in build_files if not Path(p).is_file())

    if not missing_from_build and not missing_from_source:
        print('✓ Инвентарь сборки в порядке — все src/js/*.js подключены, лишних путей нет.\n')
        return 0

    print('⚠️  Расхождение инвентаря сборки:\n')
    if missing_from_build:
        print('  Есть на диске, НЕТ в JS_MODULES (мёртвый код, не в dist/index.html):')
        for p in missing_from_build:
            print(f'    {p}')
    if missing_from_source:
        print('  Путь в JS_MODULES, файла на диске НЕТ (сборка молча пропускает):')
        for p in missing_from_source:
            print(f'    {p}')
    print()
    return len(missing_from_build) + len(missing_from_source)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--similarity', type=float, default=0.85,
                         help='порог похожести тел для отчёта 2, 0..1 (1.0 = только точные дубли, отключает fuzzy-сравнение)')
    parser.add_argument('--min-lines', type=int, default=4,
                         help='пропускать функции короче этого числа строк в отчёте 2 (шум от геттеров/заглушек)')
    parser.add_argument('--skip-inventory', action='store_true',
                         help='пропустить отчёт 3 (инвентарь сборки) — полезно при явном списке файлов аргументами')
    parser.add_argument('paths', nargs='*', help='JS-файлы или glob-шаблоны в build-order; по умолчанию — JS_MODULES из build.sh')
    args = parser.parse_args()

    explicit_paths = bool(args.paths)
    if explicit_paths:
        paths = [p for pattern in args.paths for p in sorted(glob.glob(pattern, recursive=True))]
        if not paths:
            parser.error('Переданные шаблоны не нашли JS-файлов')
    else:
        paths = build_order(Path('build.sh'))

    missing = [p for p in paths if not Path(p).is_file()]
    if missing and not explicit_paths:
        # Отчёт 3 сам объяснит что именно отсутствует — не падаем здесь
        pass
    elif missing:
        parser.error('JS-файлы не найдены: ' + ', '.join(missing))

    existing_paths = [p for p in paths if Path(p).is_file()]

    funcs = []
    window_assigns = []
    for p in existing_paths:
        funcs.extend(extract_functions(p))
        window_assigns.extend(extract_window_assignments(p))

    print(f'Просканировано файлов: {len(existing_paths)}, функций: {len(funcs)}, window-присвоений: {len(window_assigns)}\n')
    n1 = report_name_collisions(funcs, window_assigns)
    n2 = report_similar_bodies(funcs, args.similarity, args.min_lines)
    n3 = 0 if (explicit_paths or args.skip_inventory) else report_build_inventory(paths)
    raise SystemExit(1 if (n1 or n2 or n3) else 0)


if __name__ == '__main__':
    main()
