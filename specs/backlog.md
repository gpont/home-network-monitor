# Backlog

**Легенда:** `[ ]` не начато · `[~]` в процессе · `[x]` сделано

> **Агенту:** найди первый `[~]` таск (или первый `[ ]` в разблокированном батче).
> Прочитай ссылку на план — там TDD-шаги. Если ссылка содержит якорь (`#t01`) — перейди сразу к этому разделу.
> После завершения: поменяй статус на `[x]`, добавь одну строку что сделано.

---

## Batch 1 — Foundation (параллельно)
> Блокирует: T04

- [x] **T01** — MIT License + README · [plans/01-foundation.md](plans/01-foundation.md#t01) — LICENSE (MIT, Evgenii Guzhikhin) + README по specs/arch.md §9
- [x] **T02** — config.ts: env vars + парсинг · [plans/01-foundation.md](plans/01-foundation.md#t02) — parseTargets/parseDnsServers/parseHttpTargets, 4 теста зелёных
- [x] **T03** — DB schema + DDL-миграция · [plans/01-foundation.md](plans/01-foundation.md#t03) — 7 новых таблиц + hasBlackHole в traceroute_results

---

## T04 — DB cleanup job
> После: T03 · Блокирует: Batch 2

- [x] **T04** — Ежедневная очистка по retention policy · [plans/01-foundation.md](plans/01-foundation.md#t04) — runCleanup/scheduleCleanup, 16 таблиц, тест зелёный

---

## Batch 2 — Checkers + Infra (параллельно)
> После: T04 · Блокирует: T11

- [x] **T05** — interface.ts: ip link/addr/route, arp · [plans/05-interface.md](plans/05-interface.md) — parseIpLinkOutput/Addr/Route/Arp + checkInterface, 8 тестов
- [x] **T06** — system.ts: NTP + /etc/resolv.conf · [plans/06-system.md](plans/06-system.md) — parseResolvConf + NTP UDP, 3 теста
- [x] **T07** — ping.ts: TCP connect + jitter · [plans/07-ping.md](plans/07-ping.md) — checkTcpConnect + computePingStats, 2 теста
- [x] **T08** — dns.ts: consistency/NXDOMAIN/hijacking/DoH · [plans/08-dns.md](plans/08-dns.md) — checkDnsConsistency/Nxdomain/Hijacking + checkDnsExtras, 5 тестов
- [x] **T09** — http.ts: captive portal + redirect · [plans/09-http.md](plans/09-http.md) — parseCaptivePortalResponse/parseRedirectResponse + async checkers, 5 тестов
- [x] **T10** — misc.ts: SSL 30d threshold + black hole · [plans/10-misc.md](plans/10-misc.md) — detectBlackHole, SSL порог 30д, hasBlackHole в traceroute, 3 теста
- [x] **T21** — Dockerfile: multi-stage + Alpine packages · [plans/21-dockerfile.md](plans/21-dockerfile.md) — iproute2/iputils/bind-tools/traceroute + HEALTHCHECK
- [x] **T22** — docker-compose.yml · [plans/22-docker-compose.md](plans/22-docker-compose.md) — добавлен env_file (optional)

---

## T11-T12 — Scheduler + API (последовательно)
> После: T05-T10 · Блокирует: T13

- [x] **T11** — Подключить все чекеры в scheduler.ts · [plans/11-scheduler-api.md](plans/11-scheduler-api.md#t11) — checkInterface/System/TcpConnect/DnsExtras/CaptivePortal/HttpRedirect подключены
- [x] **T12** — Расширить /api/status (53 чека) · [plans/11-scheduler-api.md](plans/11-scheduler-api.md#t12) — buildApiRoutes(db), новые поля: interface/tcpConnect/dnsExtra/captivePortal/ntp/osResolver/pingStats

---

## T13 — Frontend types
> После: T12 · Блокирует: Batch 3

- [x] **T13** — lib/types.ts по форме /api/status · [plans/13-types-logic.md](plans/13-types-logic.md#t13) — 9 новых интерфейсов, CheckDefinition/DiagnosticRule/LayerDefinition, расширен StatusResponse

---

## Batch 3 — Frontend (параллельно после T13)

- [x] **T14** — lib/checks.ts: 53 определения · [plans/13-types-logic.md](plans/13-types-logic.md#t14) — 53 чека по 7 слоям, все 10 тестов зелёные
- [x] **T15** — lib/diagnostics.ts: 12 правил · [plans/13-types-logic.md](plans/13-types-logic.md#t15) — 12 правил (R1-R12), 3 critical/7 warning/2 info, все 8 тестов зелёные
- [x] **T16** — CheckRow.svelte · [plans/16-checkrow.md](plans/16-checkrow.md) — иконка статуса + name + description + fix-блок при fail
- [ ] **T17** — LayerCard.svelte · [plans/17-layercard.md](plans/17-layercard.md) *(после T16)*
- [x] **T18** — DiagBanner.svelte · [plans/18-diagbanner.md](plans/18-diagbanner.md) — severity icon + title + description + пронумерованные шаги
- [x] **T19** — PathChain.svelte · [plans/19-pathchain.md](plans/19-pathchain.md) — горизонтальная цепочка узлов, зелёный/красный/серый по статусу

---

## T20 — App.svelte
> После: T14, T15, T16, T17, T18, T19

- [ ] **T20** — App.svelte полный рерайт · [plans/20-app.md](plans/20-app.md)

---

## T23-T24 — CI/CD + Release
> T23 после T21 · T24 после T20 + T22 + T23

- [ ] **T23** — GitHub Actions CI/CD · [plans/23-cicd-release.md](plans/23-cicd-release.md#t23)
- [ ] **T24** — Интеграционный тест + первый релиз · [plans/23-cicd-release.md](plans/23-cicd-release.md#t24)
