# Home Network Monitor — Design Spec

**Date:** 2026-04-09  
**Status:** Approved

---

## 1. Purpose & Use Case

Диагностический инструмент для домашней сети. Запускается в Docker-контейнере на домашнем сервере. Пользователь открывает браузер когда хочет:
- убедиться что всё в порядке
- понять что именно сломалось и на каком этапе пути пакета

**Не** является ambient-монитором, не требует постоянного просмотра. Нет уведомлений. Один пользователь.

---

## 2. Architecture (без изменений)

```
backend/    — Bun + Hono + Drizzle ORM + SQLite
frontend/   — Svelte 5 + Vite
Docker      — single container, network_mode: host, cap_add: NET_RAW
```

Бекенд: чекеры пишут в SQLite, REST API + WebSocket раздаёт данные.  
Фронтенд: один SPA, читает `/api/status` и подписывается на WebSocket.  
Диагностические правила вычисляются **на клиенте** по текущему статусу — никакого отдельного API не нужно.

---

## 3. UI Layout

### 3.1 Страница целиком

```
┌─────────────────────────────────────────────────────┐
│ HEADER: "📡 Network Monitor"   [обновлено 8с] [Live] │
├─────────────────────────────────────────────────────┤
│ PATH CHAIN: 🖥→📡→🌐→🌍→🔍→🌏→🔐  (цветные узлы)   │
├─────────────────────────────────────────────────────┤
│ DIAGNOSTIC BANNERS (только если сработали правила)  │
├─────────────────────────────────────────────────────┤
│ LAYER 1: Device / Interface     [8/8 ✓]             │
│ LAYER 2: Gateway / Local        [6/6 ✓]             │
│ LAYER 3: ISP / WAN              [2 ошибки]          │
│ LAYER 4: Internet L3            [3 ошибки]          │
│ LAYER 5: DNS                    [1 ошибка]          │
│ LAYER 6: HTTP / Application     [3 ошибки]          │
│ LAYER 7: Security / Advanced    [7/7 ✓]             │
└─────────────────────────────────────────────────────┘
```

Все 7 слоёв **всегда развёрнуты** (вариант B1). Прокрутка страницы — норма.

### 3.2 Path Chain

Горизонтальная цепочка узлов вверху страницы. Каждый узел показывает:
- **зелёный** — все чеки слоя прошли
- **красный** — есть упавшие чеки, в скобках количество: `🌐 ISP (2)`
- **жёлтый** — предупреждения

Узлы кликабельны — скролл к нужному слою на странице.

**Свежесть данных:** если последний результат чека старше `2 × interval` — чек отображается серым `?` вместо ✓/✗. Узел слоя становится серым если все его чеки устарели.

### 3.3 Check Row

Каждый чек — строка с тремя колонками:

```
[●] Название чека               значение/статус
    Краткое описание что проверяется
    [если FAIL] → инструкция что делать (красный блок)
```

#### Система статусов (5 вариантов)

| Статус | Смысл | Визуал |
|---|---|---|
| `ok` | Данные есть, всё в норме | Зелёный ✓ |
| `warn` | Деградация или нужна настройка | Жёлтый ! |
| `fail` | Сломано, требует действий | Красный ✗ |
| `unknown` | Данных ещё нет (интервал не истёк) | Серый – |
| `stale` | Данные устарели (чекер завис) | Серый – |

Статус `info` удалён. Бывшие `info`-чеки переведены: `iface_speed`, `wan_type`, `isp_dns` → `ok`; `iface_ipv6_ll`, `iface_arp` → `ok`/`warn`.

#### Поведение по состоянию

- `ok` / `warn` / `fail` → показывается значение
- `fail` → красный блок с пошаговым fix-текстом (i18n-ключи через `$t()`)
- `warn` с `configHint` → жёлтый блок "Configuration needed:" с шагами настройки
- `unknown` + `configHint` → жёлтый блок "Configuration needed:" с шагами
- `unknown` без `configHint` → серый курсивный текст "Data available in ~{n} min" (n = staleAfterMs / 3 / 60000)
- `stale` → серый текст "Data stale — {n} min ago"

#### Кнопка "Run now"

Для медленных чеков (speedtest, traceroute, mtu, cgnat, publicip): если статус `unknown` или `stale` — кнопка "▶ Run now".  
Клик → `POST /api/run/:runType`. Кнопка переходит в "running..." (disabled). WebSocket обновляет статус → кнопка пропадает.  
409 Conflict если чекер уже запущен → кнопка показывает "already running".

#### CheckDefinition — новые поля

```typescript
import type { TranslationKey } from './i18n/ru.ts';

interface CheckDefinition {
  // ...existing fields...
  noDataHint?: TranslationKey;    // серый italic: почему нет данных
  configHint?: TranslationKey[];  // жёлтый блок: шаги настройки (массив ключей)
  runnable?: boolean;             // показывать кнопку "Run now"
  runType?: 'speedtest' | 'traceroute' | 'mtu' | 'cgnat' | 'publicip';
}
```

Чеки с редким интервалом (speedtest — 1h, SSL — 24h) показывают последнее значение с временной меткой.

### 3.4 Layer Card

Каждый слой — карточка:
- Левый бордер: зелёный (all ok) / красный (есть ошибки) / жёлтый (warning)
- Заголовок: иконка + название + бейдж `8/8 ✓` или `2 ошибки`
- Каскадные ошибки (следствие, не причина) помечаются плашкой: `⚠ Каскадные ошибки из-за проблемы в слое ISP`

### 3.5 Diagnostic Banners

Появляются между Path Chain и слоями. Каждый баннер:
- Иконка `🔴` / `🟡` / `🔵` по severity
- Жирный заголовок (что случилось)
- Текст объяснения
- Нумерованные шаги «что делать»

Несколько баннеров могут быть активны одновременно. Сортируются по severity (critical сверху).

---

## 4. Check Inventory (53 чека)

### Слой 1 — Device / Interface (8 чеков)

| # | ID | Чек | Метод | OK если |
|---|----|----|-------|---------|
| 1 | `iface_up` | Интерфейс активен | `ip link show` | статус UP |
| 2 | `iface_ipv4` | IPv4 адрес назначен | `ip addr` | есть адрес в 10/172/192 |
| 3 | `iface_gateway` | Default gateway задан | `ip route` | есть `default via ...` |
| 4 | `iface_dhcp` | DHCP lease активен | `/proc` или `ip` | тип DHCP/PPPoE, не истёк |
| 5 | `iface_errors` | Нет ошибок интерфейса | `/proc/net/dev` | rx_errors + tx_errors = 0 |
| 6 | `iface_drops` | Нет дропов пакетов | `/proc/net/dev` | rx_dropped + tx_dropped = 0 |
| 7 | `iface_ipv6_ll` | IPv6 link-local адрес | `ip addr` | есть fe80::/10 |
| 8 | `iface_arp` | ARP запись шлюза (пассивная) | `arp -n` | MAC шлюза есть в таблице |

> **Примечание к #8:** используем пассивный `arp -n` вместо `arping`. `arping` требует явной установки в Dockerfile (`apk add iputils`) и CAP_NET_RAW. Пассивная проверка ARP-таблицы достаточна для диагностики.

### Слой 2 — Gateway / Local Network (6 чеков)

| # | ID | Чек | Метод | OK если |
|---|----|----|-------|---------|
| 9 | `gw_ping` | Ping шлюза — доступность | ICMP ping | RTT < 5ms |
| 10 | `gw_ping_loss` | Ping шлюза — стабильность | история ping | loss < 1% за 15 мин |
| 11 | `gw_dns` | DNS роутера отвечает | `dig @gateway` | ответ < 100ms |
| 12 | `gw_mtu` | MTU в локальной сети | `ping -M do -s 1472` | нет фрагментации |
| 13 | `gw_jitter` | Jitter до шлюза | σ RTT за 15 мин | < 5ms |
| 14 | `iface_speed` | Скорость интерфейса | `/proc/net/dev` delta | информационный чек |

> **Примечание к #14:** Информационный чек. Не отдельный чекер — производный от данных в `networkStats` (rx_bytes/tx_bytes дельта). `getStatus()` = `ok` если есть данные (rx_bytes delta > 0), `unknown` если Linux `/proc/net/dev` недоступен. Никогда `fail` — это показатель, не тест.

### Слой 3 — ISP / WAN (7 чеков)

| # | ID | Чек | Метод | OK если |
|---|----|----|-------|---------|
| 15 | `isp_hop` | ISP первый хоп доступен | traceroute hop 1 | RTT < 50ms, timestamp < 15 мин |
| 16 | `isp_hop_rtt` | ISP хоп — задержка | traceroute RTT | < 20ms |
| 17 | `wan_type` | Тип WAN подключения | DHCP/PPPoE детект | определён |
| 18 | `cgnat` | CGNAT — нет | публичный IP vs RFC1918 | не совпадает |
| 19 | `public_ip` | Публичный IPv4 | ipify.org | адрес получен |
| 20 | `route_stable` | Маршрут стабилен | traceroute diff | не изменился |
| 21 | `isp_dns` | DNS провайдера (опц.) | `dig @isp-dns` | если настроен |

### Слой 4 — Internet / L3 (7 чеков)

| # | ID | Чек | Метод | OK если |
|---|----|----|-------|---------|
| 22 | `ping_8888` | Ping 8.8.8.8 | ICMP | RTT < 50ms |
| 23 | `ping_1111` | Ping 1.1.1.1 | ICMP | RTT < 50ms |
| 24 | `ping_9999` | Ping 9.9.9.9 | ICMP | RTT < 100ms |
| 25 | `tcp_443` | TCP connect 443 → 1.1.1.1 | `Bun.connect()` с таймаутом 3s | соединение установлено |
| 26 | `pkt_loss` | Packet loss % (15 мин) | история ping | < 1% |
| 27 | `jitter` | Jitter (нестабильность) | σ RTT за 15 мин | < 10ms |
| 28 | `no_blackhole` | Traceroute — нет black hole | анализ hops JSON | нет 3+ подряд `* * *` |

> **Примечание к #25:** TCP connect реализуется через `Bun.connect({ hostname: '1.1.1.1', port: 443 })` с таймаутом 3с — не raw socket. Владелец: `ping.ts`. Отличает «нет маршрута» от «ICMP заблокирован»: если ping FAIL, но TCP OK — это ICMP firewall, не обрыв.

> **Примечание к #26, #27:** `/api/status` должен включать предвычисленные агрегаты loss% и jitter за 15 мин. Фронтенд не делает второй запрос к `/api/history/ping/stats`.

### Слой 5 — DNS (8 чеков)

| # | ID | Чек | Метод | OK если |
|---|----|----|-------|---------|
| 29 | `dns_gw` | DNS роутера — резолвит | `dig @gateway one.one.one.one` | A = 1.1.1.1 |
| 30 | `dns_8888` | DNS 8.8.8.8 | `dig @8.8.8.8 one.one.one.one` | A = 1.1.1.1 |
| 31 | `dns_1111` | DNS 1.1.1.1 | `dig @1.1.1.1 one.one.one.one` | A = 1.1.1.1 |
| 32 | `dns_latency` | DNS задержка | latency dig запроса | < 100ms |
| 33 | `dns_consistency` | DNS согласованность | сравнение результатов #29-31 | все вернули 1.1.1.1 |
| 34 | `nxdomain` | NXDOMAIN корректен | `dig @dns nxdomain-test-$(random).invalid` | статус NXDOMAIN |
| 35 | `dns_hijack` | DNS hijacking | `dig @gateway one.one.one.one` → сравнить с #30 | совпадает |
| 36 | `doh` | DNS over HTTPS | HTTPS к `cloudflare-dns.com/dns-query?name=one.one.one.one&type=A` | ответ 200, A = 1.1.1.1 |

> **Примечание к #33:** используем `one.one.one.one` — домен Cloudflare, который **гарантированно** возвращает `1.1.1.1` от любого резолвера. Избегаем GeoDNS-проблем с google.com и другими CDN-доменами.

> **Примечание к #34:** используем случайный поддомен `.invalid` TLD (зарезервирован RFC 2606, никогда не существует). Формат: `check-{timestamp}.invalid`.

### Слой 6 — HTTP / Application (7 чеков)

| # | ID | Чек | Метод | OK если |
|---|----|----|-------|---------|
| 37 | `http_google` | HTTP google.com | GET https://google.com | 200/301, < 2s |
| 38 | `http_cf` | HTTP cloudflare.com | GET https://cloudflare.com | 200, < 2s |
| 39 | `http_github` | HTTP github.com | GET https://github.com | 200, < 2s |
| 40 | `http_redirect` | HTTP redirect → HTTPS | GET http://google.com (без redirect) | Location: https:// |
| 41 | `http_ipv6` | IPv6 HTTP | GET https://ipv6.google.com | 200 (если IPv6 есть, иначе skip) |
| 42 | `speedtest` | Speedtest (последний) | speedtest-net | download/upload Mbps, показывается с временной меткой |
| 43 | `captive_portal` | Captive portal | GET http://detectportal.firefox.com/success.txt | тело = "success\n" |

> **Примечание к #41 (`http_ipv6`):** если `status.interface?.ipv6LinkLocal` равен `null` → `getStatus()` возвращает `'unknown'` (IPv6 не настроен, не является ошибкой). Аналогично #47.

> **Примечание к #40 и #43:** оба чека детектируют перехват трафика, но по-разному. #43 (captive portal) — ICMP/прозрачный перехват на уровне HTTP body. #40 — подмена redirect'а. Правило R10 срабатывает если #43 FAIL или #40 вернул не Location→https. Если оба FAIL одновременно — diagnosis: captive portal активен.

> **Примечание к #17 (`wan_type`):** канонический источник — `interface_checks.connectionType`. Существующий `misc_checks` с `type='dhcp'` устаревший — новый `interface.ts` чекер заменяет его. Чек #4 (`iface_dhcp`) также читает `connectionType` из `interface_checks`. `misc_checks` type=dhcp не используется для новых чеков.

### Слой 7 — Security / Advanced (10 чеков)

| # | ID | Чек | Метод | OK если |
|---|----|----|-------|---------|
| 44 | `ssl` | SSL сертификаты | TLS handshake per host | > **30 дней** до истечения |
| 45 | `tls_ver` | TLS версия | TLS negotiation | ≥ TLS 1.2 |
| 46 | `path_mtu` | MTU / Path MTU | ping -M do до интернета | нет фрагментации |
| 47 | `ipv6_global` | IPv6 глобальный | ping6 2606:4700:4700::1111 | RTT получен |
| 48 | `ntp` | NTP синхронизация | UDP NTP запрос к pool.ntp.org:123 (Bun UDP) | drift < 5s |
| 49 | `ip_stable` | Публичный IP — не менялся | история publicIpEvents | нет изменений за 24ч |
| 50 | `route_stable_sec` | Routing — не менялся | traceroute diff | нет изменений |
| 51 | `os_resolver` | OS resolver (/etc/resolv.conf) | чтение файла | содержит nameserver |
| 52 | `dns_leak` | DNS leak check | сравнить IP ответившего сервера с ожидаемым | DNS идёт через роутер или 8.8.8.8 |
| 53 | `iface_anomaly` | Аномалии интерфейса | /proc/net/dev delta по времени | нет резкого роста errors/drops |

> **Примечание к #44 (`ssl`):** существующий код использует порог 14 дней. Обновить до 30 дней в `misc.ts`.

> **Примечание к #45 (`tls_ver`):** TLS версия определяется во время SSL handshake в `misc.ts` и хранится в `ssl_checks.tls_version` (поле добавлено в схему). `getStatus()` читает `status.ssl[0]?.tlsVersion` (первый хост в списке). OK если `TLSv1.2` или `TLSv1.3`, warn если `TLSv1.1` или ниже, unknown если поле `null`.

> **Примечание к #47 (`ipv6_global`):** если IPv6 link-local недоступен (`iface_ipv6_ll` = fail/unknown) → возвращать `unknown`, не `fail`. Это означает «IPv6 не настроен», а не «IPv6 сломан». Аналогично чеку #41 (`http_ipv6`).

> **Примечание к #48 (`ntp`):** `timedatectl` не работает в Alpine Docker (нет systemd). Реализация через `Bun.udpSocket()` (доступен с Bun 1.1.x):
> 1. `const sock = Bun.udpSocket({ port: 0, connect: { hostname: 'pool.ntp.org', port: 123 } })`
> 2. Отправить 48-байтный NTP-пакет (LI=0, VN=4, Mode=3 — первый байт `0x23`, остальные нули)
> 3. Прочитать ответ, bytes 40-47 — transmit timestamp (seconds since 1900-01-01)
> 4. Конвертировать в Unix ms: `(ntpSec - 2208988800) * 1000`
> 5. `Math.abs(ntpMs - Date.now()) < 5000` → OK

> **Примечание к #50 (`route_stable_sec`) и #20 (`route_stable`):** оба чека используют **одни и те же данные** из `traceroute_results` (поле `routing_changed`). Разница — контекст отображения: #20 в Layer 3 сигнализирует об изменении маршрута к провайдеру, #50 в Layer 7 показывает это как потенциальную аномалию безопасности. В `lib/checks.ts` оба чека читают `status.traceroute?.routing_changed`.

> **Примечание к #51 (`os_resolver`):** `/etc/resolv.conf` внутри Docker-контейнера с `network_mode: host` отражает конфигурацию самого контейнера (может быть injected Docker'ом). Чек репортит **что фактически использует контейнер** и подтверждает что DNS-разрешение настроено (есть `nameserver` строка). Не валидирует «правильность» — это информационный чек.

> **Примечание к #52 (`dns_leak`):** Реализация без третьих сервисов. Делаем `dig one.one.one.one` с флагом `+stats` — в выводе будет `SERVER: x.x.x.x`. Сравниваем этот IP с ожидаемым резолвером (из `/etc/resolv.conf`). Если совпадает → нет утечки. Если DNS-запрос ушёл на другой сервер → предупреждение. Результат хранится в `dnsExtra.dnsLeak` в API response.

> **Примечание к #53 (`iface_anomaly`):** Производный чек — не отдельный чекер, не отдельная таблица. `getStatus()` в `lib/checks.ts` вычисляется из последних двух записей `networkStats`: если delta `rx_errors` или `tx_errors` за интервал резко выросла (> 100 ошибок за 30s) → warn. Данные уже есть в API response (`networkStats`), отдельного API-поля не нужно.

---

## 5. Diagnostic Rules (12 правил)

Правила вычисляются на фронтенде. Каждое правило — объект:

```ts
interface DiagnosticRule {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  condition: (s: StatusResponse) => boolean;
  title: string;
  description: string;
  steps: string[];
}
```

`condition` принимает `StatusResponse` — тот же тип, что возвращает `/api/status`. Правила читают напрямую поля `s.ping`, `s.cgnat`, `s.pingStats` и т.д.

Несколько правил могут сработать одновременно. Выводятся все, сортировка: critical → warning → info.

### Правила:

| # | Severity | Название | Ключевые условия |
|---|----------|----------|-----------------|
| R1 | critical | Полный обрыв — нет сети совсем | `gw_ping` FAIL + `ping_8888` FAIL + `dns_gw`/`dns_8888`/`dns_1111` все FAIL |
| R2 | critical | Роутер недоступен | `gw_ping` FAIL + `iface_arp` FAIL + `iface_up` OK |
| R3 | critical | Нет интернета — проблема у провайдера | `gw_ping` OK + `ping_8888` FAIL + `ping_1111` FAIL |
| R4 | warning | DNS не работает, но IP-связь есть | `ping_8888` OK + `tcp_443` OK + `dns_gw` FAIL + `dns_8888` FAIL + `dns_1111` FAIL |
| R5 | warning | DNS роутера сломан, внешние работают | `dns_gw` FAIL + `dns_8888` OK |
| R6 | warning | DNS hijacking — перехват запросов | `dns_hijack` FAIL или `nxdomain` FAIL |
| R7 | warning | Нестабильное соединение — потери пакетов | `max(pingStats.targets[*].lossPercent)` > 5% |
| R8 | warning | Проблема MTU — фрагментация | `gw_mtu` FAIL или `path_mtu` FAIL |
| R9 | info | CGNAT — ты за NAT провайдера | `cgnat` = detected |
| R10 | warning | HTTP заблокирован, IP-связь и DNS работают | `ping_8888` OK + `tcp_443` OK + `dns_8888` OK + `http_google` FAIL + `http_cf` FAIL |
| R11 | info | IPv6 не работает | `ipv6_global` FAIL + `ping_8888` OK |
| R12 | warning | Высокая задержка у провайдера | `gw_ping` RTT < 3ms + traceroute `hops[0].rttMs` > 50ms |

> **Примечание к R3:** правило срабатывает по ping FAIL на 8.8.8.8 и 1.1.1.1 без ожидания traceroute (интервал 10 мин). Traceroute используется как дополнительное подтверждение в тексте диагноза, но не как условие срабатывания.

> **Примечание к R7:** условие `max(pingStats.targets[*].lossPercent) > 5%` — берётся максимум по всем таргетам из `pingStats.targets`. В `lib/diagnostics.ts`: `Object.values(s.pingStats?.targets ?? {}).some(t => t.lossPercent > 5)`.

> **Примечание к R12:** условие использует raw RTT-значения из `ping` array и первого хопа traceroute, не бинарные статусы чеков. В `lib/diagnostics.ts` читать: `s.ping.find(p => isGateway(p.target))?.rttMs` и `s.traceroute?.hops[0]?.rttMs`. `isGateway(target)` — утилита в `lib/diagnostics.ts`: `(target: string) => target === status.interface?.gatewayIp`.

---

## 6. Extended `/api/status` Response

Текущий ответ расширяется новыми полями. Полная TypeScript-схема:

```ts
interface StatusResponse {
  // существующие поля
  ping: PingResult[];
  dns: DnsResult[];
  http: HttpResult[];
  traceroute: TracerouteResult | null;
  speedtest: SpeedtestResult | null;
  publicIp: PublicIpEvent | null;
  cgnat: MiscCheck | null;
  mtu: MiscCheck | null;
  ipv6: MiscCheck | null;
  dhcp: MiscCheck | null;
  ssl: SslCheck[];
  networkStats: NetworkStat[];

  // новые поля
  interface: InterfaceCheck | null;       // статус сетевого интерфейса
  gateway: GatewayCheck | null;           // ARP + jitter шлюза
  tcpConnect: TcpConnectResult | null;    // TCP 443 → 1.1.1.1
  dnsExtra: DnsExtraCheck | null;         // consistency, NXDOMAIN, hijacking, DoH
  captivePortal: CaptivePortalCheck | null;
  httpRedirect: HttpRedirectCheck | null;
  ntp: NtpCheck | null;
  osResolver: OsResolverCheck | null;
  pingStats: PingStatsCheck | null;       // pre-computed loss%, jitter за 15 мин
}

interface InterfaceCheck {
  interfaceName: string;
  status: 'up' | 'down' | 'unknown';
  ipv4: string | null;
  ipv6LinkLocal: string | null;
  gatewayIp: string | null;
  gatewayMac: string | null;  // из arp -n
  connectionType: 'dhcp' | 'pppoe' | 'static' | 'unknown';
  rxErrors: number;
  txErrors: number;
  rxDropped: number;
  txDropped: number;
  timestamp: number;
}

interface GatewayCheck {
  jitterMs: number | null;    // σ RTT за 15 мин
  timestamp: number;
}

interface TcpConnectResult {
  host: '1.1.1.1';
  port: 443;
  status: 'ok' | 'timeout' | 'error';
  latencyMs: number | null;
  timestamp: number;
}

interface DnsExtraCheck {
  consistency: 'ok' | 'mismatch' | 'unknown';  // все резолверы вернули 1.1.1.1
  nxdomain: 'ok' | 'fail';                      // несуществующий домен → NXDOMAIN
  hijacking: 'ok' | 'hijacked' | 'unknown';     // one.one.one.one → 1.1.1.1
  doh: 'ok' | 'fail' | 'unknown';               // DoH доступен
  dnsLeak: 'ok' | 'leak' | 'unknown';           // DNS-запрос идёт через ожидаемый сервер
  timestamp: number;
}

interface CaptivePortalCheck {
  status: 'clean' | 'detected' | 'error';
  timestamp: number;
}

interface HttpRedirectCheck {
  status: 'ok' | 'intercepted' | 'error';  // ok = Location→https://
  timestamp: number;
}

interface NtpCheck {
  status: 'ok' | 'fail';
  driftMs: number | null;
  timestamp: number;
}

interface OsResolverCheck {
  status: 'ok' | 'fail';  // ok = есть хотя бы один nameserver; fail = файл пустой или недоступен
  nameservers: string[];  // из /etc/resolv.conf
  timestamp: number;
}

interface PingStatsCheck {
  // per target, за 15 мин
  targets: {
    [target: string]: {
      lossPercent: number;
      jitterMs: number;
      avgRttMs: number | null;
    };
  };
  timestamp: number;
}
```

### 6.2 Manual Trigger API

```
POST /api/run/:type
```

Где `:type` = `speedtest` | `traceroute` | `mtu` | `cgnat` | `publicip`

- Запускает соответствующий чекер немедленно вне расписания
- Сохраняет результат в БД
- Возвращает `{ ok: true }`
- Если чекер уже выполняется → `409 Conflict` `{ error: 'already running' }`
- Фронтенд получает обновление через существующий WebSocket

---

## 7. i18n Architecture

Два языка: Russian (RU, default для ru-*) и English (EN, fallback для всех остальных).  
Переключатель языка (🇷🇺 RU | 🇬🇧 EN) в header. Выбор сохраняется в `localStorage`.

### Файлы

```
frontend/src/lib/i18n/
  index.ts          — locale store (writable), t() derived store, detectLocale()
  ru.ts             — источник правды, экспортирует TranslationKey
  en.ts             — Record<TranslationKey, string> (compile error если ключ пропущен)

frontend/src/components/
  LangSwitcher.svelte — кнопки-флаги в header
```

### Принцип типобезопасности

```typescript
// ru.ts — источник правды
const ru = { 'ui.live': 'Live', ... } as const;
export type TranslationKey = keyof typeof ru;
export default ru as Record<TranslationKey, string>;

// en.ts — все ключи обязательны (TypeScript ошибка если пропущено)
import type { TranslationKey } from './ru.ts';
const en: Record<TranslationKey, string> = { 'ui.live': 'Live', ... };
export default en;
```

Fallback-цепочка: текущий locale → RU → raw key.

### Соглашение по именам ключей

| Namespace | Паттерн | Пример |
|---|---|---|
| UI strings | `ui.<name>` | `ui.live`, `ui.run_now`, `ui.data_in` |
| Layer names | `layer.<id>.name` | `layer.1.name` |
| Check name | `check.<id>.name` | `check.iface_up.name` |
| Check description | `check.<id>.desc` | `check.iface_up.desc` |
| Check fix step | `check.<id>.fix.<n>` | `check.iface_up.fix.0` |
| Check noData hint | `check.<id>.noData` | `check.gw_ping.noData` |
| Check config step | `check.<id>.config.<n>` | `check.gw_ping.config.0` |
| Diagnostic title | `diag.<id>.title` | `diag.R1.title` |
| Diagnostic description | `diag.<id>.desc` | `diag.R1.desc` |
| Diagnostic step | `diag.<id>.step.<n>` | `diag.R1.step.0` |

Примерно ~500 ключей на локаль. Ключи **никогда не удаляются**, только помечаются как deprecated — RU fallback всегда работает.

### Новые UI-ключи

| Ключ | RU | EN |
|---|---|---|
| `ui.run_now` | ▶ Запустить сейчас | ▶ Run now |
| `ui.running` | запускается... | running... |
| `ui.already_running` | уже запущен | already running |
| `ui.needs_config` | Настройка нужна: | Configuration needed: |
| `ui.data_in` | Данные появятся через ~{n} мин | Data available in ~{n} min |
| `ui.data_stale` | Данные устарели — {n} мин назад | Data stale — {n} min ago |

---

## 8. macOS Platform Support

Чекеры используют Linux-команды (`/proc/net/dev`, `ip link`, `arp`). На macOS эти команды недоступны.

**OS detection:** `process.platform === 'darwin'` → macOS-ветка, иначе Linux.

### interface.ts

| Данные | Linux | macOS |
|---|---|---|
| Список интерфейсов + статус | `ip link show` | `ifconfig -a` |
| IPv4 адрес | `ip addr show` | `ifconfig en0` (парсинг `inet`) |
| IPv6 link-local | `ip addr show` | `ifconfig en0` (парсинг `inet6 fe80`) |
| Default gateway | `ip route show default` | `netstat -rn \| grep default` |
| ARP шлюза (MAC) | `arp -n <ip>` | `arp -n <ip>` (работает на обоих) |
| Connection type | PID dhclient / PPPoE | `ipconfig getpacket en0` |
| rx/tx errors + drops | `/proc/net/dev` | `netstat -I en0 -b` |

### system.ts

| Данные | Linux | macOS |
|---|---|---|
| DHCP lease | `/var/lib/dhclient/*.leases` | `ipconfig getpacket en0` |
| resolv.conf | `/etc/resolv.conf` | `/etc/resolv.conf` (работает на обоих) |
| NTP | `ntpq -pn` | `sntp -t 1 pool.ntp.org` |

### networkStats

| Linux | macOS |
|---|---|
| `/proc/net/dev` | `netstat -I en0 -b` (парсинг колонок) |

> В Docker-контейнере на Linux все команды работают. macOS-ветки нужны для локальной разработки без Docker.

---

## 9. Check Frequencies

| Слой | Чек | Интервал |
|------|-----|----------|
| Device | interface, IP, ARP | 30s |
| Gateway | ping gateway, jitter | 30s |
| ISP | traceroute, ISP hop | 10 min |
| Internet | ping 8.8.8.8/1.1.1.1/9.9.9.9 | 30s |
| Internet | TCP connect | 30s |
| DNS | dig все резолверы | 60s |
| DNS | consistency, NXDOMAIN, hijacking, DoH | 5 min |
| HTTP | fetch всех URL, captive portal, redirect | 60s |
| Security | SSL | 24h |
| Security | NTP, resolv.conf | 5 min |
| Security | public IP | 5 min |

---

## 10. CI/CD

- Push в `main` → `ghcr.io/gpont/home-network-monitor:latest`
- Push тега `v*` → `:vX.Y.Z` + обновляет `:latest`
- Registry: GitHub Container Registry, auth через `GITHUB_TOKEN`
- Platform: `linux/amd64`
- Деталь pipeline: `specs/arch.md` раздел 6

---

## 11. Data Retention

Cleanup job в `db/cleanup.ts`, запускается раз в сутки:

| Данные | Хранить |
|--------|---------|
| ping, dns, http, captive portal, redirect | 48 часов |
| traceroute, misc, interface, tcp, dns extra, ntp | 30 дней |
| speedtest, public IP, ssl, network stats | 90 дней |

---

## 12. Configurable Targets (env vars)

```
PING_TARGETS=8.8.8.8:Google DNS,1.1.1.1:Cloudflare,9.9.9.9:Quad9
HTTP_TARGETS=https://google.com,https://cloudflare.com,https://github.com
DNS_SERVERS=8.8.8.8:Google,1.1.1.1:Cloudflare
```

Gateway и ISP-хоп определяются автоматически при старте и добавляются к PING_TARGETS и DNS_SERVERS.

---

## 13. Out of Scope

- Уведомления (Telegram, email, push)
- Мониторинг нескольких устройств
- Исторические графики (убираются)
- Аутентификация
- Конфигурационный UI (всё через env vars)
- Мобильное приложение (только браузер)
