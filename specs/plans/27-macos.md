# T27 — macOS: interface.ts + system.ts + networkStats по платформе

**Зависит от:** T04  
**Блокирует:** —  
**Справочники:** specs/design.md#8-macos-platform-support

---

## Что делаем

Добавляем macOS-ветки во все чекеры, которые используют Linux-специфичные команды. OS detection: `process.platform === 'darwin'`.

## Файлы

- Изменить: `backend/src/checkers/interface.ts`
- Изменить: `backend/src/checkers/system.ts`
- Изменить тесты: `backend/src/checkers/interface.test.ts`, `backend/src/checkers/system.test.ts`

## TDD-шаги

### Шаг 1: interface.ts — macOS-парсеры

Добавить функции парсинга `ifconfig` вывода:

```typescript
// Тест: parseIfconfigOutput — извлекает интерфейс, IPv4, IPv6, статус
// Тест: parseNetstatRoute — extracting gateway из netstat -rn
// Тест: parseNetstatInterface — rx/tx bytes из netstat -I en0 -b
// Тест: parseIpconfigGetpacket — connection type из ipconfig getpacket en0
```

- [ ] Написать тесты с mock-выводом команд — FAIL
- [ ] Реализовать парсеры
- [ ] `bun test backend/src/checkers/interface.test.ts` — PASS

### Шаг 2: checkInterface — выбор платформы

```typescript
async function checkInterface(): Promise<InterfaceCheckResult> {
  if (process.platform === 'darwin') {
    return checkInterfaceMacos();
  }
  return checkInterfaceLinux();
}
```

- [ ] Написать тест: на darwin вызывается macOS-ветка (mock process.platform)
- [ ] Реализовать
- [ ] `bun test` — PASS

### Шаг 3: system.ts — macOS DHCP + NTP

DHCP:
```typescript
// Linux: читает /var/lib/dhclient/*.leases
// macOS: парсит вывод `ipconfig getpacket en0`
```

NTP:
```typescript
// Linux: ntpq -pn
// macOS: sntp -t 1 pool.ntp.org
```

- [ ] Написать тесты с mock-выводами — FAIL
- [ ] Реализовать
- [ ] `bun test backend/src/checkers/system.test.ts` — PASS

### Шаг 4: networkStats — macOS

```typescript
// Linux: /proc/net/dev
// macOS: netstat -I en0 -b (парсинг колонок)
```

- [ ] Написать тест для macOS-парсера — FAIL
- [ ] Реализовать
- [ ] `bun test` — PASS

## Мануальная проверка (для пользователя)

- [ ] `bun test` — все тесты зелёные
- [ ] `bun run typecheck` — 0 ошибок
- [ ] Запустить `bun run backend/src/index.ts` локально на macOS → `http://localhost:3000/api/status`: поля `interface` и `ntp` не `null`
