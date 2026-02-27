# Home Network Monitor

Инструмент мониторинга домашней сети. Работает в Docker-контейнере на домашнем сервере, предоставляет веб-дашборд с real-time обновлениями.

## Архитектура

Один Docker-контейнер (multi-stage build). Backend раздаёт и API, и статику фронтенда.

```
backend/    — Bun + Hono + Drizzle ORM + SQLite
frontend/   — Svelte 5 + Vite + Chart.js
data/       — Docker volume, здесь лежит monitor.db
```

## Backend (`backend/src/`)

| Файл | Назначение |
|---|---|
| `index.ts` | Точка входа. Hono app + `Bun.serve()` с WebSocket. Раздаёт статику из `public/` |
| `config.ts` | Все настройки: ping-таргеты, DNS-серверы, HTTP-цели, интервалы чекеров. Читает env vars |
| `scheduler.ts` | Запускает все чекеры по своим интервалам через `setInterval`. Детектирует gateway и ISP-хоп при старте. Бродкастит результаты в WebSocket |
| `db/schema.ts` | Drizzle-схемы всех 9 таблиц |
| `db/client.ts` | Инициализация SQLite (через `bun:sqlite`) + Drizzle instance + DDL-миграция при старте |
| `routes/api.ts` | Все REST-эндпоинты (см. ниже) |
| `types.d.ts` | Ручные типы для `speedtest-net` (нет @types) |

### Чекеры (`backend/src/checkers/`)

Каждый чекер пишет результаты в БД и возвращает данные для WebSocket-бродкаста.

| Файл | Что делает | Интервал |
|---|---|---|
| `ping.ts` | ping через CLI, парсит RTT, детектирует gateway | 30s |
| `dns.ts` | `dig` к нескольким DNS-серверам | 60s |
| `http.ts` | fetch к HTTP-целям | 60s |
| `traceroute.ts` | `traceroute`, сравнивает с предыдущим (routing_changed) | 10min |
| `speedtest.ts` | npm пакет `speedtest-net` | 1hr |
| `publicip.ts` | fetch к ipify.org, детектирует смену IP | 5min |
| `misc.ts` | CGNAT, MTU (ping с DF-бит), IPv6, DHCP/PPPoE, `/proc/net/dev`, SSL-сертификаты | разные |
| `utils.ts` | `spawn()` — обёртка над `Bun.spawn` с таймаутом |

### API эндпоинты

```
GET /api/status              — последний результат каждого чекера (для дашборда)
GET /api/history/ping        — история пингов, query: minutes, target
GET /api/history/ping/stats  — агрегат: loss%, avg/p95 RTT, jitter по окнам 5/15/60min
GET /api/history/dns         — история DNS, query: minutes
GET /api/history/http        — история HTTP, query: minutes
GET /api/speedtest           — история speedtest, query: limit
GET /api/traceroute          — последние N traceroute снимков
GET /api/events              — значимые события (смена IP, routing change, SSL warning)
GET /api/network-stats       — история interface stats, query: minutes
GET /api/ssl                 — последние SSL-проверки
WS  /ws                      — push новых результатов. Формат: {event, data, timestamp}
GET /*                       — статика Svelte (SPA fallback)
```

## Frontend (`frontend/src/`)

| Файл/папка | Назначение |
|---|---|
| `App.svelte` | Главный дашборд. Загружает данные через `api.*`, подписывается на WS, раскладывает по секциям |
| `lib/api.ts` | Типизированные fetch-обёртки для всех эндпоинтов |
| `lib/ws.ts` | WebSocket-клиент с авто-реконнектом. `onWsEvent(event, fn)` для подписки. `wsConnected` Svelte-стор |
| `lib/types.ts` | TypeScript-интерфейсы для всех данных API |
| `components/StatusCard.svelte` | Карточка с цветным индикатором (ok/error/timeout/warning) |
| `components/LatencyChart.svelte` | Chart.js линейный граф RTT по таргетам |
| `components/PacketLossWidget.svelte` | Таблица loss%/jitter по окнам 5/15/60min |
| `components/SpeedtestWidget.svelte` | Последний тест + исторический Chart.js |
| `components/TracerouteWidget.svelte` | Таблица хопов, подсвечивает routing change |
| `components/NetworkHealthWidget.svelte` | Публичный IP, CGNAT, MTU, IPv6, SSL, interface stats |
| `components/EventsLog.svelte` | Хронологический лог событий |

Vite-proxy в dev-режиме: `/api` и `/ws` → `localhost:3000`.
Сборка пишет в `../backend/public/` (т.е. `backend/public/`).

## База данных (SQLite)

Таблицы: `ping_results`, `dns_results`, `http_results`, `traceroute_results`, `speedtest_results`, `public_ip_events`, `network_stats`, `ssl_checks`, `misc_checks`.

Все `timestamp` — Unix milliseconds. `misc_checks.value` и `traceroute_results.hops` — JSON-строки.

## Docker

```bash
docker-compose up --build -d   # сборка и запуск
docker-compose logs -f         # логи
```

`docker-compose.yml` использует `network_mode: host` (нужно для корректного детекта gateway и traceroute) и `cap_add: NET_RAW` (ICMP ping).

## Конфигурация

Через env vars (или `.env` файл рядом с `docker-compose.yml`):

| Переменная | Описание |
|---|---|
| `PORT` | Порт сервера (default: 3000) |
| `DB_PATH` | Путь к SQLite (default: `/app/data/monitor.db`) |
| `SSL_HOSTS` | Comma-separated хосты для проверки SSL сертификатов |
| `IPERF3_SERVER` | IP iperf3-сервера для throughput-теста (опционально) |

## Важные детали

- **npm registry**: в системе может быть корпоративный registry в `~/.npmrc`. В `backend/.npmrc` и `frontend/.npmrc` явно прописан `registry.npmjs.org`.
- **speedtest-net**: версия `^2.2.0` (выше недоступно на npm). Ручные типы в `backend/src/types.d.ts`.
- **macOS vs Linux**: `/proc/net/dev` нет на macOS → `networkStats` пустой при локальном запуске. В Docker-контейнере на Linux работает.
- **Bun**: установлен в `~/.bun/bin/bun`. В shell может не быть в PATH до `source ~/.zshrc`.
