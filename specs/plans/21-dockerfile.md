# T21 — Dockerfile

**Зависит от:** — (независим, можно начать с самого начала)
**Блокирует:** T23
**Справочники:** [specs/arch.md](../arch.md) §7 Dockerfile Structure

---

## Что делаем
Multi-stage Docker build: сборка фронтенда → сборка бэкенда → финальный образ на oven/bun:1-alpine.
Добавить Alpine packages: iproute2, iputils, bind-tools, traceroute.

## Файлы
- Modify: `Dockerfile`

- [ ] Add Alpine packages to the runtime stage:
```dockerfile
RUN apk add --no-cache \
    iproute2 \
    iputils \
    bind-tools \
    traceroute
```
- [ ] Add HEALTHCHECK:
```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -qO- http://localhost:${PORT:-3000}/api/status > /dev/null || exit 1
```
- [ ] Verify existing multi-stage build still works: `docker build -t test-build .`
- [ ] Commit:
```bash
git add Dockerfile
git commit -m "chore: add network tools to Docker image and healthcheck"
```

---

## Мануальная проверка
- [ ] `docker build -t home-network-monitor .` — сборка без ошибок
- [ ] `docker run --rm --network host --cap-add NET_RAW home-network-monitor` — запуск без ошибок
- [ ] `curl http://localhost:3000/api/status` — ответ 200
