# Home Network Monitor

Веб-дашборд для мониторинга домашней сети. Запускается в Docker на домашнем сервере.

**Что мониторит:**
- Ping до роутера, первого хопа провайдера, Google/Cloudflare/Quad9
- DNS-разрешение через локальный, 8.8.8.8 и 1.1.1.1
- HTTP-доступность google.com, cloudflare.com, github.com
- Latency, jitter, packet loss за окна 5/15/60 мин
- Traceroute до 8.8.8.8, детектирует смену маршрута
- Speedtest раз в час
- Публичный IP (IPv4/IPv6), смена IP как событие
- CGNAT, MTU-проблемы, IPv6-связность
- SSL-сертификаты указанных хостов
- RX/TX ошибки сетевых интерфейсов (`/proc/net/dev`)
- DHCP lease / PPPoE-сессия

## Запуск на сервере (Docker)

```bash
git clone <repo> home-network-monitor
cd home-network-monitor

# Опционально: настроить переменные
cp .env.example .env

docker-compose up --build -d
```

Открыть `http://<server-ip>:3000`.

### Переменные окружения (`.env`)

| Переменная | По умолчанию | Описание |
|---|---|---|
| `PORT` | `3000` | Порт |
| `DB_PATH` | `/app/data/monitor.db` | Путь к SQLite |
| `SSL_HOSTS` | `google.com,cloudflare.com,github.com` | Хосты для проверки SSL |
| `IPERF3_SERVER` | — | IP iperf3-сервера для тестов пропускной способности |

Данные хранятся в `./data/` — при перезапуске контейнера история не теряется.

## Разработка локально

### Требования
- [Bun](https://bun.sh) — `curl -fsSL https://bun.sh/install | bash`
- Node.js 20+

```bash
npm install          # установить все зависимости

npm run dev          # запустить backend + frontend одновременно
npm run dev:backend  # только backend  → http://localhost:3001
npm run dev:frontend # только frontend → http://localhost:5173

npm run build        # собрать фронтенд в backend/public/
npm run typecheck    # TypeScript проверка backend
```

Backend dev запускается на порту `3001`, frontend проксирует `/api` и `/ws` туда.

## Структура

```
backend/src/
  index.ts       — HTTP + WebSocket сервер (Hono)
  config.ts      — все таргеты и интервалы
  scheduler.ts   — запуск чекеров по расписанию
  db/            — Drizzle ORM + SQLite-схема
  checkers/      — ping, dns, http, traceroute, speedtest, publicip, misc
  routes/api.ts  — REST API

frontend/src/
  App.svelte     — дашборд
  lib/           — API-клиент, WebSocket-стор, типы
  components/    — карточки статуса, графики, виджеты
```
