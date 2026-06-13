#!/usr/bin/env python3
"""Обновляет @hash строку в JS/CSS файлах.

Логика:
  - Считает MD5 содержимого файла (без строки @hash)
  - Если хэш совпадает с существующим — файл не трогает (нет лишних git diff)
  - Если хэш изменился — записывает новый с текущим datetime (YYYY-MM-DDThh:mm)

Использование: python3 update_hash.py src/js/core/store.js [...]
Формат метки: // @hash 813a6069 2026-06-13T15:30
"""
import sys, hashlib, re
from datetime import datetime

# Поддерживаем оба формата: со временем и без (для обратной совместимости)
HASH_RE = re.compile(r'^// @hash [0-9a-f]{8} \S+\n', re.M)
CSS_RE  = re.compile(r'^/\* @hash [0-9a-f]{8} \S+ \*/\n', re.M)

def update(path: str) -> bool:
    """Возвращает True если файл был обновлён."""
    with open(path, 'r', encoding='utf-8') as f:
        raw = f.read()

    is_css = path.endswith('.css')
    pattern = CSS_RE if is_css else HASH_RE

    # Извлекаем существующий хэш (если есть)
    m = pattern.search(raw)
    existing_hash = m.group().split()[2] if m else None

    # Убираем строку @hash перед вычислением
    content = HASH_RE.sub('', raw)
    content = CSS_RE.sub('', content)

    # MD5 чистого содержимого (8 символов)
    new_hash = hashlib.md5(content.encode('utf-8')).hexdigest()[:8]

    # Содержимое не изменилось — файл не трогаем
    if new_hash == existing_hash:
        return False

    # Содержимое изменилось — пишем новую метку с datetime
    now = datetime.now().strftime('%Y-%m-%dT%H:%M')
    header = f'/* @hash {new_hash} {now} */\n' if is_css else f'// @hash {new_hash} {now}\n'

    with open(path, 'w', encoding='utf-8') as f:
        f.write(header + content)

    action = 'new' if existing_hash is None else f'{existing_hash} →'
    print(f'  hashed  {path}: {action} {new_hash}  ({now})')
    return True


def main():
    paths = sys.argv[1:]
    if not paths:
        print('Usage: update_hash.py <file> [...]', file=sys.stderr)
        sys.exit(1)

    updated = 0
    errors  = 0
    for p in paths:
        try:
            if update(p):
                updated += 1
        except Exception as e:
            print(f'  ERROR   {p}: {e}', file=sys.stderr)
            errors += 1

    skipped = len(paths) - updated - errors
    print(f'  result  {updated} updated, {skipped} unchanged, {errors} errors')
    if errors:
        sys.exit(1)  # Ненулевой код → build.sh увидит ошибку

if __name__ == '__main__':
    main()
