# AGENT_FILE_LOG.md
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
>
> «ОТСУТСТВУЕТ» от `check` не всегда значит «файла нет в репозитории» — сначала
> проверь путь в таблице ниже (напр. `.env.example` реально лежит в `scripts/`,
> не в корне; см. 16.07). Файл не гитигнорен, просто путь в логе раньше был
> указан неверно.

| Файл | Hash | Агент | Когда | Задача |
|------|------|-------|-------|--------|
| src/js/render/admin/render-admin-import.js | 49ba1729 | stg-blue | 2026-07-18T04:03 | SEC-3-partial (errors[]/e.message → escAttr; SEC-3 всё ещё НЕ закрыт) |
| AGENT_TASKS.md | a9634ba9 | stg-blue | 2026-07-18T04:04 | SEC-3-partial |
| src/js/data/sheets/sheets-import-ui.js | c0fb5f04 | stg-blue | 2026-07-18T03:48 | SEC-3-partial (r.unresolved esc→escAttr; SEC-3 НЕ закрыт — нужен render-utils.js) |
| AGENT_TASKS.md | 74638ec4 | stg-blue | 2026-07-18T03:49 | SEC-3-partial |
| scripts/js_dupe_check.py | 142c6485 | LEQ | 2026-07-18T01:46 | SEC-3+AUD-7-merge+js_dupe_check-fix |
| scripts/css_dupe_check.py | cbd0ad0a | LEQ | 2026-07-18T01:46 | SEC-3+AUD-7-merge+js_dupe_check-fix |
| AGENT_TASKS.md | 79714886 | LEQ | 2026-07-18T01:46 | SEC-3+AUD-7-merge+js_dupe_check-fix |
| src/js/render/admin/render-admin-ui.js | ea858a2c | NAT | 2026-07-17T21:33 | AUDIT-D6-reconstruct-tokens |
| src/js/auth/ui.js | 0dddf533 | stg-orange | 2026-07-17T21:33 | AUDIT-D6-reconstruct-tokens |
| src/css/modals/picker.css | 87a05e14 | LEQ | 2026-07-17T21:33 | AUDIT-D6-reconstruct-tokens |
| src/css/modals/modals.css | 8372705a | LEQ | 2026-07-17T21:33 | AUDIT-D6-reconstruct-tokens |
| src/css/features/tiers.css | 8ff94cfc | LEQ | 2026-07-17T21:33 | AUDIT-D6-reconstruct-tokens |
| src/css/features/players.css | 5fc94424 | LEQ | 2026-07-17T21:33 | AUDIT-D6-reconstruct-tokens |
| src/css/features/maps.css | de0b1f1b | LEQ | 2026-07-17T21:33 | AUDIT-D6-reconstruct-tokens |
| src/css/features/heroes.css | e29cea8d | LEQ | 2026-07-17T21:33 | AUDIT-D6-reconstruct-tokens |
| src/css/draft/draft-comp.css | 74f85563 | stg-blue | 2026-07-17T21:33 | AUDIT-D6-reconstruct-tokens |
| src/css/draft/bans.css | a7b00b1e | stg-orange | 2026-07-17T21:33 | AUDIT-D6-reconstruct-tokens |
| src/css/draft/ban-recommendations.css | 3f2ce298 | stg-orange | 2026-07-17T21:33 | AUDIT-D6-reconstruct-tokens |
| src/css/base/tokens.css | 0a8f156e | stg-orange | 2026-07-17T21:33 | AUDIT-D6-reconstruct-tokens |
| src/css/base/auth.css | 2fb54e2a | stg-blue | 2026-07-17T21:33 | AUDIT-D6-reconstruct-tokens |
| build.sh | 0c6ad659 | stg-blue | 2026-07-17T21:33 | AUDIT-D6-reconstruct-tokens |
| CHANGELOG.md | fd417913 | stg-orange | 2026-07-17T21:33 | AUDIT-D6-reconstruct-tokens |
| AGENT_FILE_LOG.md | 8525e3c0 | bor | 2026-07-17T10:23 | AUDIT-D3-picker-calibration |
| src/css/base/responsive.css | a2387723 | bor | 2026-07-17T10:02 | AUDIT-D3-round2-pickerfix |
| src/js/draft/render-bans-tournament-herobans.js | 7fcbfd5e | bor | 2026-07-16T11:14 | AUDIT-D3-chipgrid-consistency |
| src/js/draft/render-bans-competitive.js | 3f742840 | bor | 2026-07-16T11:14 | AUDIT-D3-chipgrid-consistency |
| src/js/render/tiers/render-tier-share-public.js | da342244 | stg-orange | 2026-07-16T10:20 | FILESPLIT-tiershare+base |
| src/js/render/tiers/render-tier-share-panel.js | fd36b27b | stg-orange | 2026-07-16T10:20 | FILESPLIT-tiershare+base |
| src/js/render/render-heroes.js | b9b619fd | stg-orange | 2026-07-16T10:20 | FILESPLIT-tiershare+base |
| src/js/modals/modal-map.js | 9828f667 | stg-orange | 2026-07-16T10:20 | FILESPLIT-tiershare+base |
| src/js/data/db/db-load.js | 9532f4ef | stg-orange | 2026-07-16T10:20 | FILESPLIT-tiershare+base |
| src/js/auth/session.js | 7571e0ce | stg-orange | 2026-07-16T10:20 | FILESPLIT-tiershare+base |
| src/css/base/base-utility.css | 8c7cd918 | stg-orange | 2026-07-16T10:20 | FILESPLIT-tiershare+base |
| src/css/base/base-reset.css | 0e1a3c6d | stg-orange | 2026-07-16T10:20 | FILESPLIT-tiershare+base |
| src/css/base/base-chrome.css | 43b82b0f | stg-orange | 2026-07-16T10:20 | FILESPLIT-tiershare+base |
| src/js/draft/render-bans-tournament-mapdraft.js | 830c940b | stg-blue | 2026-07-16T09:06 | AUDIT-D3-1440p-round3 |
| src/js/draft/render-bans-competitive-mappopup.js | aec0646e | stg-blue | 2026-07-16T09:06 | AUDIT-D3-1440p-round3 |
| src/css/draft/bans-tournament.css | c542f42a | stg-blue | 2026-07-16T09:06 | AUDIT-D3-1440p-round3 |
| src/js/draft/render-bans-tournament-draft.js | 6ec61263 | bor | 2026-07-16T01:58 | AUDIT-D3-hoverfocus+FILESPLIT-3 |
| src/js/picker/picker-comp.js | 6d4ff178 | stg-orange | 2026-07-15T23:33 | BUG-17-close+AUDIT-A3-more |
| src/js/draft/render-draft-comp.js | 99313560 | stg-orange | 2026-07-15T23:33 | BUG-17-close+AUDIT-A3-more |
| src/js/draft/render-bans-core.js | 8f3fcfc6 | stg-orange | 2026-07-15T23:33 | BUG-17-close+AUDIT-A3-more |
| src/html/modal-map.html | 3ff0a5f4 | stg-orange | 2026-07-15T23:33 | BUG-17-close+AUDIT-A3-more |
| src/js/core/config.js | ef4054ec | LEQ | 2026-07-15T16:44 | AUDIT-A5-final-close |
| src/js/render/tiers/render-tiers.js | b11efdbd | LEQ | 2026-07-15T06:31 | AUDIT-A5-migration+AUDIT-D5-close |
| src/js/data/db/db-load-tiers.js | 444d56d3 | LEQ | 2026-07-15T06:31 | AUDIT-A5-migration+AUDIT-D5-close |
| src/js/core/store.js | 1686f1fc | LEQ | 2026-07-15T06:31 | AUDIT-A5-migration+AUDIT-D5-close |
| src/js/picker/picker-counters.js | 096d0bd8 | NAT | 2026-07-15T05:58 | AUDIT-A5-review+shadow-bugfix |
| src/js/render/render-utils.js | 5211fa72 | NAT | 2026-07-15T05:52 | AUDIT-B2-fix+log-sync |
| src/js/modals/modal-hero-strength.js | 81c51b3b | stg-orange | 2026-07-15T05:52 | AUDIT-A3-partial (задача column была ошибочно AUDIT-B2, поправлено руками) |
| src/js/modals/modal-hero-chips.js | 0d50c314 | stg-orange | 2026-07-15T05:52 | AUDIT-A3-partial (задача column была ошибочно AUDIT-B2, поправлено руками) |
| scripts/.env.example | 5bf99e18 | stg-orange | 2026-07-15T05:52 | AUDIT-B2-fix+log-sync (путь в логе был указан неверно — root вместо scripts/, из-за этого агенты не находили файл и путали с .gitignore, см. CHANGELOG 16.07) |
| src/js/render/skeleton-loaders.js | 0839ac50 | NAT | 2026-07-15T01:51 | FILESPLIT-2+BUG-16 |
| src/js/render/notifications.js | fbd15d9a | NAT | 2026-07-15T01:51 | FILESPLIT-2+BUG-16 |
| src/js/render/modal-focus.js | a64e3631 | NAT | 2026-07-15T01:51 | FILESPLIT-2+BUG-16 |
