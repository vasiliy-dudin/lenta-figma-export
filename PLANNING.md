# PLANNING.md

## Переход на чистый апстрим (alexchantastic/figma-export)

**Goal:** Сделать `main` побайтовым зеркалом `alexchantastic/figma-export` с настоящей общей историей (для будущих `git merge upstream/main`), сохранив `.env`, `teams.md`, `.claude/` и pnpm как пакетный менеджер.
**Scope:** Включено — merge unrelated histories, откат всех кастомных функций (батчи, кастомный README/LICENSE, `.env.example`), пересборка `pnpm-lock.yaml`, проверка токена под v3 folders API, обновлённый cron. Исключено — любые собственные доработки логики экспортёра сверх апстрима; npm вместо pnpm.

### Tasks

- [ ] **1. Бэкап текущего состояния** — ветка `backup/my-fork` на текущем `main`, копия `.env` и `files.json` вне репозитория → проверка: `git log backup/my-fork --oneline` показывает все 7 коммитов, копии файлов лежат в бэкап-каталоге
- [ ] **2. Merge с деревом оригинала** — `git merge --allow-unrelated-histories --no-commit upstream/main`, дерево выставляется целиком по `upstream/main` (лишнее — `.env.example`, `package-lock.json` — удаляется явно), `teams.md` и `.claude/` возвращаются из бэкапа поверх смерженного дерева → проверка: `git diff HEAD upstream/main -- . ':!teams.md' ':!.claude' ':!package.json' ':!pnpm-lock.yaml'` пустой, и `git merge-base HEAD upstream/main` == `34a3afb`
- [ ] **3. Пересборка `pnpm-lock.yaml` под смёрженный `package.json`** — удалить `node_modules` и `package-lock.json`, оставить `package.json` от апстрима (npm-скрипты те же по именам), прогнать `pnpm install`, `pnpm exec playwright install chromium` → проверка: `pnpm exec playwright --version` показывает актуальную 1.6x, `pnpm exec eslint .` и `pnpm exec tsc --noEmit` без ошибок
- [ ] **4. Чистка `.env`** — убрать мёртвые `BATCH_INDEX` и `BATCH_SIZE`, сверить остальные ключи с README оригинала → проверка: `grep BATCH .env` пусто, `pnpm run dry-run` перечисляет тесты по текущему `files.json`
- [ ] **5. Проверка scope токена** — дёрнуть `https://api.figma.com/v2/teams/{id}/folders` текущим `FIGMA_ACCESS_TOKEN` → проверка: HTTP 200 со списком папок, либо зафиксировано, что нужен новый токен с `folders:read`
- [ ] **6. Перегенерация `files.json`** *(только если задача 5 прошла)* — `pnpm run get-team-files -- $(cat teams.md)` на v2 folders API → проверка: файлов не меньше текущих 2944, в манифесте есть вложенные папки, у записей проставлены `id` и `team_id`
- [ ] **7. Живой прогон загрузки** — `pnpm start -- -limit 3` с реальной сессией Figma → проверка: три `.fig` появились в `DOWNLOAD_PATH/{teamId}/{folder} ({id})/`, и в `files.json` у них выставилось `"downloaded": true`
- [ ] **8. Новый cron и актуализация `.claude/CLAUDE.md`** — понедельничная регенерация `files.json` плюс три `pnpm start -- -limit N`, из CLAUDE.md выкинуть батчи и `get-project-files`, описать `-limit`/`-force`/`-last-modified-*`, все примеры команд — через pnpm → проверка: каждая строка cron прогнана руками локально, понедельник качает с нуля, вторник добирает остаток
- [ ] **9. Push и контроль подтягиваемости** — запушить `main` и `backup/my-fork` в origin, вхолостую прогнать `git merge upstream/main` → проверка: merge отвечает `Already up to date`, на GitHub дерево совпадает с оригиналом кроме `teams.md`, `.claude/`, `package.json`/`pnpm-lock.yaml`
