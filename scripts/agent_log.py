#!/usr/bin/env python3
"""
Координация между параллельными агентами DraftHub OW.

Каждый агент работает в своей копии репозитория и присылает файлы
пользователю отдельно — git-веток/PR между агентами нет. Этот скрипт
даёт лёгкий способ проверить «эта копия файла у меня — точно последняя?»
без git, тем же MD5[:8]-хэшем что уже использует update_hash.py для
@hash в JS/CSS. Для HTML/SQL/MD считает идентично, просто не пишет
хэш в сам файл — туда этот хэш не принято вставлять.

Команды:
  hash   <file> [...]                — посчитать и вывести хэш(и), ничего не меняет
  check  [--log AGENT_FILE_LOG.md]   — сверить локальные файлы из лога с их хэшами
  update <agent> <task> <file> [...] [--log AGENT_FILE_LOG.md]
                                       — пересчитать хэши, обновить/добавить строки в лог

Воркфлоу для каждого агента:
  # Перед началом задачи — проверить что не работаешь со старой версией входных файлов:
  python3 scripts/agent_log.py check

  # После задачи, перед тем как отдать файлы пользователю — записать новые хэши:
  python3 scripts/agent_log.py update stg-blue A1 src/js/render/render-utils.js src/js/render/render-nav.js

Хэш для JS/CSS совпадает с тем что уже стоит в шапке файла (// @hash ... /
/* @hash ... */) — отдельно сверять не нужно, этот скрипт читает то же самое
содержимое (минус строка @hash) и тем же алгоритмом.
"""
import sys, hashlib, re, os
from datetime import datetime

HASH_LINE_JS  = re.compile(r'^// @hash [0-9a-f]{8} \S+\n', re.M)
HASH_LINE_CSS = re.compile(r'^/\* @hash [0-9a-f]{8} \S+ \*/\n', re.M)

DEFAULT_LOG = 'AGENT_FILE_LOG.md'

LOG_HEADER = """# AGENT_FILE_LOG.md
> Автоматически обновляется `scripts/agent_log.py update ...`.
> Колонку «Задача» можно поправить руками, остальные — перетрутся при следующем update.
>
> ПЕРЕД тем как взять файл как вход для своей задачи — сверь хэш:
>   python3 scripts/agent_log.py check
> Если локальный хэш не совпадает со строкой в таблице — у тебя не последняя
> версия: возьми актуальный файл у агента из колонки «Агент», не работай со своей копией.
>
> ПОСЛЕ того как закончил редактировать файл (перед тем как отдать пользователю) —
> запиши новый хэш:
>   python3 scripts/agent_log.py update <твой-агент> <ID-задачи> <файл1> [файл2 ...]

| Файл | Hash | Агент | Когда | Задача |
|------|------|-------|-------|--------|
"""

ROW_RE = re.compile(
    r'^\|\s*(?P<path>\S[^|]*?)\s*\|\s*(?P<hash>[0-9a-f]{8}|—)\s*\|\s*'
    r'(?P<agent>[^|]*?)\s*\|\s*(?P<when>[^|]*?)\s*\|\s*(?P<task>[^|]*?)\s*\|\s*$',
    re.M,
)


def file_hash(path: str) -> str:
    with open(path, 'r', encoding='utf-8') as f:
        raw = f.read()
    content = HASH_LINE_JS.sub('', raw)
    content = HASH_LINE_CSS.sub('', content)
    return hashlib.md5(content.encode('utf-8')).hexdigest()[:8]


def parse_log(log_path: str):
    """-> (dict path->{hash,agent,when,task}, текст-шапка до таблицы)"""
    if not os.path.exists(log_path):
        return {}, LOG_HEADER
    text = open(log_path, encoding='utf-8').read()
    rows = {}
    for m in ROW_RE.finditer(text):
        rows[m.group('path')] = {
            'hash': m.group('hash'), 'agent': m.group('agent'),
            'when': m.group('when'), 'task': m.group('task'),
        }
    idx = text.find('\n|------')
    header = text[:text.find('\n', idx) + 1] if idx != -1 else LOG_HEADER
    return rows, header


def write_log(log_path: str, rows: dict, header: str):
    lines = [header.rstrip('\n')]
    for path in sorted(rows):
        r = rows[path]
        lines.append(f"| {path} | {r['hash']} | {r['agent']} | {r['when']} | {r['task']} |")
    with open(log_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines) + '\n')


def cmd_hash(paths):
    for p in paths:
        try:
            print(f'{file_hash(p)}  {p}')
        except Exception as e:
            print(f'ERROR  {p}: {e}', file=sys.stderr)


def cmd_check(log_path):
    rows, _ = parse_log(log_path)
    if not rows:
        print(f'Лог пуст или не найден: {log_path}')
        return
    ok = mismatches = missing = 0
    for path, r in sorted(rows.items()):
        if not os.path.exists(path):
            print(f'  ОТСУТСТВУЕТ    {path}  (в логе: {r["hash"]}, {r["agent"]})')
            missing += 1
            continue
        actual = file_hash(path)
        if actual == r['hash']:
            ok += 1
        else:
            print(f'  НЕСОВПАДЕНИЕ   {path}')
            print(f'      в логе:    {r["hash"]}  ({r["agent"]}, {r["when"]}, задача {r["task"]})')
            print(f'      локально:  {actual}')
            mismatches += 1
    print(f'\n  итого: {ok} совпадают, {mismatches} не совпадают, {missing} отсутствуют локально')
    if mismatches:
        print('  → для несовпадений возьми актуальный файл у агента из колонки «Агент».')
    if not mismatches and not missing:
        print('  всё свежее, можно работать')


def cmd_update(agent, task, paths, log_path):
    rows, header = parse_log(log_path)
    now = datetime.now().strftime('%Y-%m-%dT%H:%M')
    for p in paths:
        try:
            h = file_hash(p)
        except Exception as e:
            print(f'ERROR  {p}: {e}', file=sys.stderr)
            continue
        old = rows.get(p, {}).get('hash')
        rows[p] = {'hash': h, 'agent': agent, 'when': now, 'task': task}
        if old == h:
            tag = 'unchanged'
        elif old:
            tag = f'{old} →'
        else:
            tag = 'new'
        print(f'  {tag} {h}  {p}')
    write_log(log_path, rows, header)
    print(f'\n  Лог обновлён: {log_path}')


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        sys.exit(1)

    cmd = args[0]
    if cmd == 'hash':
        cmd_hash(args[1:])
    elif cmd == 'check':
        log_path = DEFAULT_LOG
        if '--log' in args:
            log_path = args[args.index('--log') + 1]
        cmd_check(log_path)
    elif cmd == 'update':
        if len(args) < 4:
            print('Usage: agent_log.py update <agent> <task> <file> [...] [--log path]', file=sys.stderr)
            sys.exit(1)
        agent, task = args[1], args[2]
        rest = args[3:]
        log_path = DEFAULT_LOG
        if '--log' in rest:
            i = rest.index('--log')
            log_path = rest[i + 1]
            rest = rest[:i] + rest[i + 2:]
        cmd_update(agent, task, rest, log_path)
    else:
        print(__doc__)
        sys.exit(1)


if __name__ == '__main__':
    main()
