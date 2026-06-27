#!/usr/bin/env python3
"""
Находит дубли простых селекторов (.class / #id / .class:pseudo) в CSS-файлах
и показывает, какие свойства первого определения перетёрты вторым (мёртвые)
и какие — НЕТ (т.е. требуют ручной проверки cascade/box-model вручную, как
height vs min-height — разные свойства не "перетирают" друг друга по имени,
но могут друг друга нейтрализовать через спецификацию CSS).

Не претендует на полный CSS-парсер (не понимает @media-вложенность,
комбинированные селекторы вида ".a .b", всё что сложнее "однажды .class{...}").
Этого достаточно чтобы найти буквальные повторы простых селекторов — именно
такой паттерн уже поймал 3 реальных бага в tiers.css.

Использование:
  python3 scripts/css_dupe_check.py src/css/**/*.css
  python3 scripts/css_dupe_check.py src/css/features/tiers.css
"""
import sys, re, glob
from collections import defaultdict

# Простой селектор: .class, #id, .class:pseudo, [attr] — без пробелов/комбинаторов
SIMPLE_SELECTOR = re.compile(r'^[.#][\w-]+(:[\w-]+)?$')
RULE_RE = re.compile(r'([^{}]+)\{([^{}]*)\}')


def parse_declarations(body: str) -> dict:
    out = {}
    for decl in body.split(';'):
        decl = decl.strip()
        if not decl or ':' not in decl:
            continue
        prop, _, val = decl.partition(':')
        out[prop.strip()] = val.strip()
    return out


def shorthand_covers(prop: str) -> set:
    """Какие longhand-свойства сбрасывает шорткат (минимальный список, расширять по мере находок)."""
    table = {
        'padding': {'padding-top', 'padding-right', 'padding-bottom', 'padding-left'},
        'margin':  {'margin-top', 'margin-right', 'margin-bottom', 'margin-left'},
        'border':  {'border-width', 'border-style', 'border-color'},
        'background': {'background-color', 'background-image', 'background-position'},
        'font':    {'font-size', 'font-weight', 'font-family', 'line-height'},
    }
    return table.get(prop, set())


def strip_media_blocks(text: str) -> str:
    """Вырезает @media {...} блоки целиком, считая вложенность скобок
    (а не regex без учёта nesting). Без этого каждый брейкпоинт в
    responsive.css/bans.css/modals.css/strength.css ложно считается
    дублем — это НЕ баг, это и есть смысл media-query."""
    out = []
    i = 0
    while i < len(text):
        if text[i:i+6] == '@media':
            depth = 0
            j = text.index('{', i)
            depth = 1
            k = j + 1
            while depth > 0 and k < len(text):
                if text[k] == '{':
                    depth += 1
                elif text[k] == '}':
                    depth -= 1
                k += 1
            i = k  # пропускаем весь @media-блок целиком
        else:
            out.append(text[i])
            i += 1
    return ''.join(out)


def check_file(path: str):
    text = open(path, encoding='utf-8').read()
    # убираем комментарии чтобы не путать парсер
    text = re.sub(r'/\*.*?\*/', '', text, flags=re.S)
    text = strip_media_blocks(text)

    occurrences = defaultdict(list)  # selector -> [(line_no, decls)]
    pos = 0
    for m in RULE_RE.finditer(text):
        selector = m.group(1).strip()
        if not SIMPLE_SELECTOR.match(selector):
            continue
        line_no = text.count('\n', 0, m.start()) + 1
        occurrences[selector].append((line_no, parse_declarations(m.group(2))))

    dupes = {sel: occ for sel, occ in occurrences.items() if len(occ) > 1}
    if not dupes:
        print(f'{path}: дублей простых селекторов не найдено')
        return

    print(f'{path}: найдено {len(dupes)} продублированных селекторов\n')
    for sel, occ in dupes.items():
        print(f'  {sel}  ({len(occ)} раз: строки {", ".join(str(l) for l,_ in occ)})')
        # Сравниваем первое определение со ВСЕМИ последующими вместе (cascade накопительно)
        first_line, first_decls = occ[0]
        later_props = {}
        later_shorthand_props = set()
        for _, decls in occ[1:]:
            later_props.update(decls)
            for prop in decls:
                later_shorthand_props |= shorthand_covers(prop)

        for prop, val in first_decls.items():
            if prop in later_props:
                status = 'ПЕРЕТЁРТО (тот же property)' if later_props[prop] != val else 'избыточно (то же значение)'
            elif prop in later_shorthand_props:
                status = 'ПЕРЕТЁРТО (шорткатом)'
            else:
                status = '⚠️  НЕ перетёрто по имени — проверить вручную (height/min-height и т.п.)'
            print(f'      строка {first_line}: {prop}:{val}  →  {status}')
        print()


def main():
    paths = []
    for arg in sys.argv[1:]:
        paths.extend(glob.glob(arg, recursive=True))
    if not paths:
        print(__doc__)
        sys.exit(1)
    for p in paths:
        check_file(p)


if __name__ == '__main__':
    main()
