# CI/CD + Release (T23–T24)

---

## T23 — GitHub Actions CI/CD

**Зависит от:** T21 (Dockerfile)
**Блокирует:** T24
**Справочники:** [specs/arch.md](../arch.md) §6 CI/CD Pipeline

### Task 23: GitHub Actions CI/CD

**Files:**
- Create: `.github/workflows/docker.yml`

- [ ] Create the workflow file using the exact YAML from `specs/arch.md` section 6
- [ ] Verify YAML syntax: `cat .github/workflows/docker.yml | python3 -c "import sys,yaml; yaml.safe_load(sys.stdin)" && echo OK`
- [ ] Commit and push:
```bash
git add .github/workflows/docker.yml
git commit -m "ci: add GitHub Actions Docker build and push workflow"
git push origin main
```
- [ ] **USER CHECKPOINT:** Go to `https://github.com/gpont/home-network-monitor/actions`. Does the workflow appear? Did it trigger on the push? Check for any errors.

### Мануальная проверка
- [ ] Push в ветку → Actions запускается на GitHub
- [ ] Docker image собирается без ошибок в CI
- [ ] Image публикуется в ghcr.io/gpont/home-network-monitor:latest

---

## T24 — Final integration test + first release

**Зависит от:** T20, T22, T23
**Блокирует:** —
**Справочники:** [specs/arch.md](../arch.md) §6 Release Process

### Task 24: Final integration test + tag first release

- [ ] Run full test suite: `bun test` — all pass
- [ ] Build check: `cd frontend && bun run build` — 0 errors
- [ ] Docker build: `docker-compose up --build -d`
- [ ] Smoke test: `curl http://localhost:3000/api/status | jq 'keys'` — verify all expected keys
- [ ] **USER CHECKPOINT (final):** Open `http://localhost:3000` in browser. Walk through the dashboard:
  1. Is the path chain at the top with correct node colors?
  2. Are all 7 layers visible and expanded?
  3. Do any diagnostic banners appear (and are they accurate)?
  4. Pick one failing check — does it show the fix instructions?
  5. Check `docker-compose logs` — no errors or crashes?
- [ ] Tag first release:
```bash
git tag v1.0.0
git push origin v1.0.0
```
- [ ] **USER CHECKPOINT:** Go to GitHub Actions. Verify the `v1.0.0` tag triggered a build that pushed `ghcr.io/gpont/home-network-monitor:v1.0.0` and `:latest`.

### Мануальная проверка
- [ ] `docker-compose up -d` на реальном сервере — контейнер поднялся
- [ ] `http://server-ip:3000` — дашборд загружается
- [ ] Все 53 чека отображаются
- [ ] Нет критических ошибок в `docker-compose logs`
- [ ] Тег v0.1.0 на GitHub — образ `:v0.1.0` опубликован в ghcr.io
