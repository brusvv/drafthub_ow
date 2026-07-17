#!/usr/bin/env python3
"""Проверяет дубли простых CSS-селекторов с учётом порядка ``build.sh``.

По умолчанию читает ``CSS_FILES`` из build.sh и поэтому проверяет CSS в том
же порядке, в котором браузер получает его в dist/index.html. Если селектор
буквально одинаковый, его specificity также одинакова; при равной важности
побеждает последнее объявление в build order. Скрипт выводит победителя для
каждого повторно объявленного свойства и помечает свойства, которые нельзя
надёжно сопоставить статически (например, shorthand vs. longhand).

Вложенные @media-блоки по умолчанию исключены: повтор селектора на другом
брейкпоинте обычно намеренный и не конкурирует с базовым правилом. Передайте
``--include-media``, чтобы включить их в отчёт (контекст media пока выводится
как часть позиции, а не вычисляется браузерно).

Использование:
  python3 scripts/css_dupe_check.py
  python3 scripts/css_dupe_check.py --build-order
  python3 scripts/css_dupe_check.py src/css/features/tiers.css
  python3 scripts/css_dupe_check.py --include-media src/css/**/*.css
"""
import argparse
import glob
import re
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path


# Простой селектор: .class, #id, .class:pseudo. Комбинированные селекторы
# намеренно не анализируем: сравнение их cascade требует полноценного CSS DOM.
SIMPLE_SELECTOR = re.compile(r'^[.#][\w-]+(?::[\w-]+(?:\([^)]*\))?)?$')
RULE_RE = re.compile(r'([^{}]+)\{([^{}]*)\}')
CSS_FILES_RE = re.compile(r'CSS_FILES=\((.*?)\)', re.S)
CSS_PATH_RE = re.compile(r'^\s*(css/[\w./-]+\.css)\s*$', re.M)


@dataclass(frozen=True)
class Occurrence:
    path: str
    line: int
    declarations: dict[str, tuple[str, bool]]


def parse_declarations(body: str) -> dict[str, tuple[str, bool]]:
    """Возвращает property -> (value, important) для простых деклараций."""
    out = {}
    for declaration in body.split(';'):
        declaration = declaration.strip()
        if not declaration or ':' not in declaration:
            continue
        prop, _, value = declaration.partition(':')
        value = value.strip()
        important = bool(re.search(r'\s*!important\s*$', value, re.I))
        value = re.sub(r'\s*!important\s*$', '', value, flags=re.I).strip()
        out[prop.strip().lower()] = (value, important)
    return out


def shorthand_covers(prop: str) -> set[str]:
    """Longhand-свойства, сбрасываемые распространёнными shorthand."""
    table = {
        'padding': {'padding-top', 'padding-right', 'padding-bottom', 'padding-left'},
        'margin': {'margin-top', 'margin-right', 'margin-bottom', 'margin-left'},
        'border': {'border-width', 'border-style', 'border-color'},
        'background': {'background-color', 'background-image', 'background-position'},
        'font': {'font-size', 'font-weight', 'font-family', 'line-height'},
    }
    return table.get(prop, set())


def strip_media_blocks(text: str) -> str:
    """Удаляет @media-блоки, сохраняя переводы строк для точных номеров."""
    out = []
    index = 0
    while index < len(text):
        if text[index:index + 6] == '@media':
            start = text.find('{', index)
            if start == -1:
                break
            depth, cursor = 1, start + 1
            while depth and cursor < len(text):
                if text[cursor] == '{':
                    depth += 1
                elif text[cursor] == '}':
                    depth -= 1
                cursor += 1
            out.append('\n' * text[index:cursor].count('\n'))
            index = cursor
        else:
            out.append(text[index])
            index += 1
    return ''.join(out)


def strip_at_rule_preludes(text: str) -> str:
    """Сохраняет вложенные правила, но убирает заголовки @media/@supports.

    Это позволяет простому RULE_RE увидеть `.selector { ... }` внутри
    вложенного блока. Условие media не вычисляется: отчёт лишь указывает на
    возможный дубль, поэтому режим opt-in.
    """
    return re.sub(
        r'@(media|supports|container|layer)\b[^{}]*\{',
        lambda match: '\n' * match.group().count('\n') + '{',
        text,
        flags=re.I,
    )


def build_order(build_path: Path) -> list[str]:
    """Извлекает CSS_FILES из build.sh вместо дублирования списка в Python."""
    match = CSS_FILES_RE.search(build_path.read_text(encoding='utf-8'))
    if not match:
        raise ValueError(f'Не найден CSS_FILES в {build_path}')
    paths = CSS_PATH_RE.findall(match.group(1))
    if not paths:
        raise ValueError(f'CSS_FILES в {build_path} не содержит CSS-файлов')
    return [str(Path('src') / path) for path in paths]


def occurrences_for_file(path: str, include_media: bool) -> list[tuple[str, Occurrence]]:
    text = Path(path).read_text(encoding='utf-8')
    text = re.sub(r'/\*.*?\*/', lambda match: '\n' * match.group().count('\n'), text, flags=re.S)
    if not include_media:
        text = strip_media_blocks(text)
    else:
        text = strip_at_rule_preludes(text)

    found = []
    for match in RULE_RE.finditer(text):
        selector = match.group(1).strip()
        if not SIMPLE_SELECTOR.fullmatch(selector):
            continue
        found.append((selector, Occurrence(
            path=path,
            line=text.count('\n', 0, match.start()) + 1,
            declarations=parse_declarations(match.group(2)),
        )))
    return found


def winner(declarations: list[tuple[Occurrence, str, bool]]) -> tuple[Occurrence, str, bool]:
    """Возвращает каскадного победителя; вход уже упорядочен по build order."""
    result = declarations[0]
    for candidate in declarations[1:]:
        # Для одного и того же селектора specificity одинакова. !important
        # важнее; при равенстве выигрывает более позднее правило.
        if candidate[2] or not result[2]:
            result = candidate
    return result


def report(paths: list[str], include_media: bool) -> int:
    occurrences = defaultdict(list)
    for path in paths:
        for selector, occurrence in occurrences_for_file(path, include_media):
            occurrences[selector].append(occurrence)

    duplicates = {selector: items for selector, items in occurrences.items() if len(items) > 1}
    if not duplicates:
        print('Дублей простых селекторов не найдено.')
        return 0

    conflicting = []   # хотя бы одно свойство реально расходится по значению — вероятный баг
    identical = []     # все совпадающие свойства совпадают по значению — безопасный copy-paste

    print(f'Найдено {len(duplicates)} продублированных простых селекторов.')
    print('Порядок файлов: ' + ' → '.join(paths) + '\n')
    for selector, items in duplicates.items():
        locations = ', '.join(f'{item.path}:{item.line}' for item in items)
        properties = {prop for item in items for prop in item.declarations}
        lines = []
        selector_has_conflict = False
        for prop in sorted(properties):
            declarations = [
                (item, value, important)
                for item in items
                if (declaration := item.declarations.get(prop))
                for value, important in [declaration]
            ]
            if len(declarations) == 1:
                continue
            distinct_values = {value for _, value, _ in declarations}
            winning_item, value, important = winner(declarations)
            overridden = [
                (item, val) for item, val, _ in declarations if item != winning_item
            ]
            suffix = ' !important' if important else ''
            if len(distinct_values) == 1:
                lines.append(f'  {prop}: одинаково везде = {value}{suffix} (лишний дубль, не баг)')
            else:
                selector_has_conflict = True
                overridden_desc = ', '.join(f'{item.path}:{item.line}={val}' for item, val in overridden)
                lines.append(f'  ⚠️ {prop}: РАСХОДИТСЯ — победитель {winning_item.path}:{winning_item.line}='
                              f'{value}{suffix}; перетирает {overridden_desc}')

        # Отдельно предупреждаем о shorthand-конфликтах, которые нельзя
        # корректно решить сравнением одного имени свойства.
        for earlier_index, earlier in enumerate(items[:-1]):
            later_props = {prop for item in items[earlier_index + 1:] for prop in item.declarations}
            for prop in earlier.declarations:
                covered_by = [short for short in later_props if prop in shorthand_covers(short)]
                if covered_by:
                    selector_has_conflict = True
                    lines.append(f'  ⚠️ {earlier.path}:{earlier.line} {prop} может быть сброшен shorthand: '
                                  f'{", ".join(sorted(covered_by))}')

        header = f'{"⚠️ " if selector_has_conflict else ""}{selector} ({len(items)} раз: {locations})'
        block = header + '\n' + '\n'.join(lines) + '\n'
        (conflicting if selector_has_conflict else identical).append(block)

    if conflicting:
        print(f'━━━ РАСХОДЯТСЯ ПО ЗНАЧЕНИЮ — вероятные баги ({len(conflicting)}) ━━━\n')
        for block in conflicting:
            print(block)
    if identical:
        print(f'━━━ Совпадающий copy-paste, не баг, но лишний источник правды ({len(identical)}) ━━━\n')
        for block in identical:
            print(block)
    return len(conflicting)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--build-order', action='store_true', help='явно использовать порядок CSS_FILES из build.sh')
    parser.add_argument('--include-media', action='store_true', help='не исключать @media-блоки')
    parser.add_argument('paths', nargs='*', help='CSS-файлы или glob-шаблоны в требуемом cascade-порядке')
    args = parser.parse_args()

    if args.paths:
        paths = [path for pattern in args.paths for path in sorted(glob.glob(pattern, recursive=True))]
        if not paths:
            parser.error('Переданные шаблоны не нашли CSS-файлов')
    else:
        paths = build_order(Path('build.sh'))

    missing = [path for path in paths if not Path(path).is_file()]
    if missing:
        parser.error('CSS-файлы не найдены: ' + ', '.join(missing))
    report(paths, args.include_media)


if __name__ == '__main__':
    main()
