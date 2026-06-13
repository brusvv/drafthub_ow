#!/usr/bin/env python3
"""Обновляет @hash строку в JS/CSS файлах.
Использование: python3 update_hash.py src/js/modals/modal-hero.js [...]
"""
import sys, hashlib, re
from datetime import date

HASH_RE = re.compile(r'^// @hash [0-9a-f]{8} \d{4}-\d{2}-\d{2}\n', re.M)
CSS_RE  = re.compile(r'^/\* @hash [0-9a-f]{8} \d{4}-\d{2}-\d{2} \*/\n', re.M)

def update(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    # Убираем старый хэш если есть
    content = HASH_RE.sub('', content)
    content = CSS_RE.sub('',  content)
    # Считаем хэш содержимого без первой строки хэша
    h = hashlib.md5(content.encode()).hexdigest()[:8]
    today = date.today().isoformat()
    if path.endswith('.css'):
        header = f'/* @hash {h} {today} */\n'
    else:
        header = f'// @hash {h} {today}\n'
    with open(path, 'w', encoding='utf-8') as f:
        f.write(header + content)
    print(f'{path}: @hash {h}')

for p in sys.argv[1:]:
    update(p)
