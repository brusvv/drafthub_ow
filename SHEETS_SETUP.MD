# Структура Google Sheets для Draft Hub

Создай одну Google Таблицу с **5 листами**.
Названия вкладок — точно как указано.

---

## Лист 1 — Heroes

Название вкладки: `Heroes`

Первая строка — заголовки (скопируй как есть):
```
name	role	subrole	priority	banned	notes
```

Данные (актуальный рейтинговый пул 2026):

| name | role | subrole | priority | banned | notes |
|---|---|---|---|---|---|
| D.Va | Tank | Initiator | 5 | FALSE | |
| Doomfist | Tank | Initiator | 5 | FALSE | |
| Hazard | Tank | Initiator | 5 | FALSE | |
| Winston | Tank | Initiator | 5 | FALSE | |
| Wrecking Ball | Tank | Initiator | 5 | FALSE | |
| Orisa | Tank | Bruiser | 5 | FALSE | |
| Mauga | Tank | Bruiser | 5 | FALSE | |
| Roadhog | Tank | Bruiser | 5 | FALSE | |
| Zarya | Tank | Bruiser | 5 | FALSE | |
| Domina | Tank | Stalwart | 5 | FALSE | |
| Junker Queen | Tank | Stalwart | 5 | FALSE | |
| Ramattra | Tank | Stalwart | 5 | FALSE | |
| Reinhardt | Tank | Stalwart | 5 | FALSE | |
| Sigma | Tank | Stalwart | 5 | FALSE | |
| Bastion | Damage | Specialist | 5 | FALSE | |
| Emre | Damage | Specialist | 5 | FALSE | |
| Junkrat | Damage | Specialist | 5 | FALSE | |
| Mei | Damage | Specialist | 5 | FALSE | |
| Soldier: 76 | Damage | Specialist | 5 | FALSE | |
| Symmetra | Damage | Specialist | 5 | FALSE | |
| Torbjörn | Damage | Specialist | 5 | FALSE | |
| Ashe | Damage | Sharpshooter | 5 | FALSE | |
| Cassidy | Damage | Sharpshooter | 5 | FALSE | |
| Hanzo | Damage | Sharpshooter | 5 | FALSE | |
| Widowmaker | Damage | Sharpshooter | 5 | FALSE | |
| Sojourn | Damage | Sharpshooter | 5 | FALSE | |
| Anran | Damage | Flanker | 5 | FALSE | |
| Genji | Damage | Flanker | 5 | FALSE | |
| Reaper | Damage | Flanker | 5 | FALSE | |
| Tracer | Damage | Flanker | 5 | FALSE | |
| Vendetta | Damage | Flanker | 5 | FALSE | |
| Venture | Damage | Flanker | 5 | FALSE | |
| Echo | Damage | Recon | 5 | FALSE | |
| Freja | Damage | Recon | 5 | FALSE | |
| Pharah | Damage | Recon | 5 | FALSE | |
| Sierra | Damage | Recon | 5 | FALSE | |
| Sombra | Damage | Recon | 5 | FALSE | |
| Ana | Support | Tactician | 5 | FALSE | |
| Baptiste | Support | Tactician | 5 | FALSE | |
| Jetpack Cat | Support | Tactician | 5 | FALSE | |
| Lucio | Support | Tactician | 5 | FALSE | |
| Zenyatta | Support | Tactician | 5 | FALSE | |
| Kiriko | Support | Medic | 5 | FALSE | |
| Lifeweaver | Support | Medic | 5 | FALSE | |
| Mercy | Support | Medic | 5 | FALSE | |
| Moira | Support | Medic | 5 | FALSE | |
| Brigitte | Support | Survivor | 5 | FALSE | |
| Illari | Support | Survivor | 5 | FALSE | |
| Juno | Support | Survivor | 5 | FALSE | |
| Mizuki | Support | Survivor | 5 | FALSE | |
| Wuyang | Support | Survivor | 5 | FALSE | |

Всего 51 герой. Заполни `priority` (1–10) и `banned` (TRUE/FALSE) по ситуации.

---

## Лист 2 — Maps

Название вкладки: `Maps`

Первая строка — заголовки:
```
name	type	tier	priority	atk	def	notes
```

Данные (актуальный пул 2026, 26 карт):

| name | type | tier | priority | atk | def | notes |
|---|---|---|---|---|---|---|
| Blizzard World | Hybrid | B | 1 | 3 | 3 | |
| King's Row | Hybrid | S | 2 | 5 | 5 | |
| Midtown | Hybrid | B | 3 | 3 | 3 | |
| Numbani | Hybrid | A | 4 | 4 | 3 | |
| Paraíso | Hybrid | B | 5 | 3 | 3 | |
| Eichenwalde | Hybrid | A | 6 | 4 | 4 | |
| Hollywood | Hybrid | B | 7 | 3 | 3 | |
| Dorado | Escort | B | 8 | 3 | 3 | |
| Havana | Escort | B | 9 | 3 | 4 | |
| Junkertown | Escort | A | 10 | 4 | 3 | |
| Circuit Royal | Escort | S | 11 | 3 | 5 | |
| Rialto | Escort | B | 12 | 3 | 3 | |
| Shambali Monastery | Escort | A | 13 | 4 | 4 | |
| Watchpoint: Gibraltar | Escort | B | 14 | 3 | 3 | |
| Route 66 | Escort | C | 15 | 2 | 3 | |
| Antarctic Peninsula | Control | A | 16 | 4 | 4 | |
| Ilios | Control | S | 17 | 4 | 4 | |
| Lijiang Tower | Control | S | 18 | 4 | 4 | |
| Nepal | Control | A | 19 | 4 | 4 | |
| Oasis | Control | B | 20 | 3 | 3 | |
| Runasapi | Push | B | 21 | 3 | 3 | |
| New Queen Street | Push | A | 22 | 4 | 3 | |
| Esperança | Push | B | 23 | 3 | 3 | |
| Colosseo | Push | A | 24 | 4 | 3 | |
| Suravasa | Flashpoint | A | 25 | 5 | 4 | |
| New Junk City | Flashpoint | C | 26 | 2 | 3 | |

Заполни `tier`, `atk`, `def`, `notes` по своей оценке.

---

## Лист 3 — MapPreferred

Название вкладки: `MapPreferred`

Заголовки:
```
map	hero
```

Изначально пустой (кроме заголовка). Заполняется через UI приложения.

---

## Лист 4 — MapBans

Название вкладки: `MapBans`

Заголовки:
```
map	hero
```

Изначально пустой. Заполняется через UI.

---

## Лист 5 — Compositions

Название вкладки: `Compositions`

Заголовки:
```
map	hero	role
```

Изначально пустой. Заполняется через UI.

---

## Настройка доступа

1. **Файл → Настройки доступа**
2. Добавь каждого члена команды по email с ролью **Редактор**
3. Для просмотра без входа (read-only для всех): выбери "Все в интернете" → Читатель

## Получение Sheet ID

URL таблицы:
```
https://docs.google.com/spreadsheets/d/ВОТ_ЭТО/edit
```
Скопируй часть между `/d/` и `/edit`.
