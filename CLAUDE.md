# Home Network Monitor

Диагностический инструмент для домашней сети. Один Docker-контейнер на домашнем сервере. Открываешь браузер когда что-то не так — видишь весь путь пакета по слоям, 53 чека, диагностику проблемы и инструкцию что делать.

Проект публичный open-source. Лицензия MIT. Image: `ghcr.io/gpont/home-network-monitor`.

Спецификации: `specs/design.md` (UI + чеки + правила), `specs/arch.md` (архитектура + схема БД).

---

## Архитектура

Один Docker-контейнер (multi-stage build). Backend раздаёт API и статику фронтенда.

```
backend/    — Bun + Hono + Drizzle ORM + SQLite
frontend/   — Svelte 5 + Vite (без Chart.js — графики убраны)
data/       — Docker volume, здесь лежит monitor.db
specs/      — спецификации проекта
```

---

## Backend (`backend/src/`)

| Файл | Назначение |
|---|---|
| `index.ts` | Точка входа. Hono app + `Bun.serve()` с WebSocket. Раздаёт статику из `public/` |
| `config.ts` | Все настройки: ping-таргеты, DNS-серверы, HTTP-цели, интервалы. Читает env vars с дефолтами |
| `scheduler.ts` | Запускает все чекеры по интервалам. Детектирует gateway/ISP-хоп при старте. WebSocket broadcast |
| `db/schema.ts` | Drizzle-схемы всех таблиц (9 существующих + 6 новых) |
| `db/client.ts` | Инициализация SQLite + Drizzle + DDL-миграция при старте |
| `db/cleanup.ts` | Ежедневная очистка старых данных (cron-like setInterval) |
| `routes/api.ts` | Все REST-эндпоинты |
| `types.d.ts` | Ручные типы для `speedtest-net` |

### Чекеры (`backend/src/checkers/`)

| Файл | Что делает | Интервал |
|---|---|---|
| `ping.ts` | ICMP ping + TCP connect тест (1.1.1.1:443), парсит RTT, loss%, jitter | 30s |
| `dns.ts` | dig к резолверам + consistency/NXDOMAIN/hijacking/DoH чеки | 60s / 5min |
| `http.ts` | fetch к HTTP-целям + captive portal + redirect check | 60s |
| `traceroute.ts` | traceroute, сравнивает с предыдущим, детектирует black hole | 10min |
| `speedtest.ts` | speedtest-net | 1hr |
| `publicip.ts` | ipify.org, детектирует смену IP | 5min |
| `misc.ts` | CGNAT, MTU, IPv6, DHCP/PPPoE, SSL (порог 30 дней) | разные |
| `interface.ts` | ip link/addr/route, arp -n — статус сетевого интерфейса | 30s |
| `system.ts` | NTP (UDP к pool.ntp.org), /etc/resolv.conf | 5min |
| `utils.ts` | spawn() — обёртка Bun.spawn с таймаутом |

### API эндпоинты

```
GET /api/status   — все 53 чека текущего состояния (расширенный ответ, см. specs/arch.md)
WS  /ws           — push новых результатов: {event, data, timestamp}
GET /*            — статика Svelte (SPA fallback)
```

История-эндпоинты убраны из дашборда (только текущее состояние), но остаются для отладки:
```
GET /api/history/ping, /api/history/dns, /api/history/http
GET /api/speedtest, /api/traceroute, /api/events, /api/network-stats, /api/ssl
```

---

## Frontend (`frontend/src/`)

| Файл/папка | Назначение |
|---|---|
| `App.svelte` | Главный дашборд: PathChain + DiagBanners + LayerCards |
| `lib/api.ts` | Типизированные fetch-обёртки |
| `lib/ws.ts` | WebSocket-клиент с авто-реконнектом |
| `lib/types.ts` | TypeScript-интерфейсы для всех данных API |
| `lib/checks.ts` | Определения всех 53 чеков: id, layer, name, description, getStatus(), getValue(), getFix() |
| `lib/diagnostics.ts` | Движок правил: evaluate(status) → DiagnosticResult[] |
| `components/PathChain.svelte` | Цепочка узлов пути пакета, цвет по статусу слоя |
| `components/DiagBanner.svelte` | Один диагностический баннер (severity + title + steps) |
| `components/LayerCard.svelte` | Карточка слоя: заголовок + список чеков + cascade warning |
| `components/CheckRow.svelte` | Строка чека: иконка + название + описание + fix-блок при FAIL |

Vite-proxy в dev: `/api` и `/ws` → `localhost:3000`.
Сборка → `../backend/public/`.

---

## База данных (SQLite)

Все `timestamp` — Unix milliseconds.

**Существующие таблицы:** `ping_results`, `dns_results`, `http_results`, `traceroute_results`, `speedtest_results`, `public_ip_events`, `network_stats`, `ssl_checks`, `misc_checks`.

**Новые таблицы:** `interface_checks`, `tcp_connect_results`, `dns_extra_checks`, `captive_portal_checks`, `http_redirect_checks`, `ntp_checks`.

Полная схема с колонками: `specs/arch.md`.

### Data Retention (очистка раз в сутки)

| Таблица | Хранить |
|---|---|
| ping_results, dns_results, http_results, captive_portal_checks, http_redirect_checks | 48 часов |
| traceroute_results, misc_checks, interface_checks, tcp_connect_results, dns_extra_checks, ntp_checks | 30 дней |
| speedtest_results, public_ip_events, ssl_checks, network_stats | 90 дней |

---

## Docker и CI/CD

```bash
docker-compose up --build -d   # сборка и запуск
docker-compose logs -f         # логи
```

`docker-compose.yml`: `network_mode: host` (gateway detection, traceroute), `cap_add: NET_RAW` (ICMP ping), `restart: unless-stopped`.

**Alpine packages** (нужны в Dockerfile): `iproute2` (ip link/addr/route), `iputils` (ping -M do), `bind-tools` (dig), `traceroute`.

**GitHub Actions** (`.github/workflows/docker.yml`):
- Trigger: push в `main` → image `ghcr.io/gpont/home-network-monitor:latest`
- Trigger: tag `v*` → image `:vX.Y.Z` + обновляет `:latest`
- Registry: GitHub Container Registry (ghcr.io), auth через `GITHUB_TOKEN`
- Platform: `linux/amd64`
- Steps: checkout → setup Bun → build frontend → docker build → docker push

---

## Конфигурация

Через env vars (`.env` файл рядом с `docker-compose.yml`):

| Переменная | Default | Описание |
|---|---|---|
| `PORT` | `3000` | Порт сервера |
| `DB_PATH` | `/app/data/monitor.db` | Путь к SQLite |
| `PING_TARGETS` | `8.8.8.8:Google DNS,1.1.1.1:Cloudflare,9.9.9.9:Quad9` | Comma-separated `ip:label` |
| `HTTP_TARGETS` | `https://google.com,https://cloudflare.com,https://github.com` | Comma-separated URLs |
| `DNS_SERVERS` | `8.8.8.8:Google,1.1.1.1:Cloudflare` | Comma-separated `ip:label` |
| `SSL_HOSTS` | `google.com,cloudflare.com,github.com` | Comma-separated хосты |
| `IPERF3_SERVER` | — | IP iperf3-сервера (опционально) |

Gateway и ISP-хоп определяются автоматически при старте.

---

## Воркфлоу разработки

### Принцип: TDD

**Тесты пишутся ДО кода реализации.** Порядок для каждого компонента:
1. Написать тест в `*.test.ts`
2. Убедиться что тест падает (red)
3. Написать реализацию
4. Убедиться что тест проходит (green)
5. Рефактор при необходимости

### Тест-раннер

```bash
bun test                        # все тесты
bun test backend/src/checkers   # тесты чекеров
bun test --watch                # watch mode
```

Тестовые файлы: `**/*.test.ts` рядом с исходниками.

### Что тестировать

| Модуль | Что покрывать тестами |
|---|---|
| `lib/diagnostics.ts` | Каждое правило: условия срабатывания и несрабатывания |
| `lib/checks.ts` | `getStatus()` и `getValue()` для каждого чека |
| `checkers/*.ts` | Парсинг вывода CLI-команд (mock spawn), обработка ошибок |
| `routes/api.ts` | Каждый эндпоинт с in-memory SQLite (не мокать БД) |
| `db/cleanup.ts` | Что старые записи удаляются, новые остаются |

Svelte-компоненты не тестируем (слишком brittle для этого проекта).

### Автоматические проверки после каждого изменения

После любого изменения кода Claude **обязан выполнить**:

```bash
bun test              # все тесты должны пройти
bun run typecheck     # TypeScript — 0 ошибок
```

После изменений фронтенда:
```bash
cd frontend && bun run build    # сборка должна пройти без ошибок
```

Если что-то падает — **не переходить к следующему шагу**, исправить сначала.

### Checkpoint'ы — что показывать пользователю

После завершения каждого логического блока (чекер, компонент, секция) Claude должен:

1. **Показать результат тестов** — вывод `bun test`
2. **Попросить открыть браузер** (если изменился UI):
   > "Открой `http://localhost:3000` (или запусти dev-сервер `cd frontend && bun run dev`). Посмотри как выглядит [конкретный компонент]. Всё ок?"
3. **Попросить проверить данные** (если новый чекер):
   > "Открой `http://localhost:3000/api/status` в браузере. Видишь поле `[название]`? Данные выглядят правильно?"
4. **Дождаться подтверждения** перед переходом к следующему шагу

### Docker-проверка

После изменений Dockerfile или docker-compose.yml:
> "Запусти `docker-compose up --build -d && docker-compose logs -f`. Контейнер стартует без ошибок? API доступен на `http://localhost:3000/api/status`?"

### Code Review checkpoint

После завершения крупного раздела (например, «все новые чекеры» или «полный рефактор фронтенда») — попросить пользователя сделать ревью кода:
> "Я завершил [раздел]. Предлагаю пройтись по изменениям: [список файлов]. Есть замечания по коду или логике?"

---

## Важные детали

- **npm registry**: в системе может быть корпоративный registry. В `.npmrc` в корне явно прописан `registry.npmjs.org`.
- **speedtest-net**: только версия `^2.2.0` доступна на npm. Ручные типы в `backend/src/types.d.ts`.
- **macOS vs Linux**: `/proc/net/dev`, `ip link`, `arp` — нет на macOS. Чекеры `interface.ts`, `system.ts` вернут `null`/`unknown` при локальном запуске вне Docker. В контейнере на Linux работает.
- **Bun**: `~/.bun/bin/bun`. Может не быть в PATH до `source ~/.zshrc`.
- **network_mode: host**: порт-маппинг в docker-compose не работает — контейнер использует сеть хоста напрямую. Сервер доступен на `http://host-ip:3000`.
- **Timestamps**: Unix milliseconds везде. В браузере `new Date(ts)` показывает в local timezone пользователя — это ожидаемое поведение.
