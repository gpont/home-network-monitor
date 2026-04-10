# T22 — docker-compose.yml

**Зависит от:** — (независим)
**Блокирует:** T24
**Справочники:** [specs/arch.md](../arch.md) §7 Dockerfile Structure

---

## Что делаем
Обновить docker-compose.yml: network_mode: host, cap_add: NET_RAW, restart: unless-stopped,
volume для /app/data, env_file: .env.

## Файлы
- Modify: `docker-compose.yml`

- [ ] Add `restart: unless-stopped`
- [ ] Verify: `docker-compose up --build -d && sleep 5 && curl http://localhost:3000/api/status`
- [ ] **USER CHECKPOINT:** Run `docker-compose up --build -d`. Wait ~30s. Open `http://localhost:3000`. Does the dashboard show all 7 layers? Do checks have data? Any errors in `docker-compose logs`?
- [ ] Commit:
```bash
git add docker-compose.yml
git commit -m "chore: add restart policy to docker-compose"
```

---

## Мануальная проверка
- [ ] `docker-compose up --build -d` — запуск без ошибок
- [ ] `docker-compose logs -f` — нет ERROR в логах
- [ ] `curl http://localhost:3000/api/status` — ответ 200
- [ ] После `docker-compose down && docker-compose up -d` — данные в volume сохранились
