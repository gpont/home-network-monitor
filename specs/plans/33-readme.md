# T33 — README: badges + hero screenshot + Contributing section

**Зависит от:** —  
**Блокирует:** —  
**Справочники:** docs/superpowers/specs/2026-04-10-readme-design.md

---

## Что делаем

Обновляем `README.md`: добавляем 7 badges, hero screenshot, секцию Contributing, меняем License на ссылку. Всё существующее содержимое остаётся.

## Файлы

- Изменить: `README.md`
- Добавить placeholder: `docs/screenshot.png` (пользователь предоставит файл)

## Структура README после изменений

```
# 📡 home-network-monitor

<1-2 строки описания>

<7 badges в один ряд>

![Dashboard screenshot](docs/screenshot.png)

## Features
(существующее)

## Requirements
(существующее)

## Quick Start
(существующее)

## Configuration
(существующее)

## Docker image
(существующее)

## Development
(существующее)

## Contributing (НОВОЕ)

## License
MIT — see [LICENSE](LICENSE)
```

## Шаги

### Шаг 1: badges

Добавить после заголовка и описания:

```markdown
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Build](https://github.com/gpont/home-network-monitor/actions/workflows/docker.yml/badge.svg)](https://github.com/gpont/home-network-monitor/actions/workflows/docker.yml)
[![Docker](https://img.shields.io/badge/Docker-ghcr.io-blue?logo=docker)](https://github.com/gpont/home-network-monitor/pkgs/container/home-network-monitor)
![self-hosted](https://img.shields.io/badge/self--hosted-%E2%9C%93-brightgreen)
![no cloud](https://img.shields.io/badge/no_cloud-%E2%9C%93-brightgreen)
![built with Bun](https://img.shields.io/badge/built_with-Bun-fbf0df?logo=bun)
![Svelte 5](https://img.shields.io/badge/Svelte-5-ff3e00?logo=svelte&logoColor=white)
```

### Шаг 2: hero screenshot

После badges:
```markdown
![Dashboard screenshot](docs/screenshot.png)
```

Если файла нет — добавить HTML-комментарий:
```markdown
<!-- TODO: add screenshot to docs/screenshot.png -->
```

### Шаг 3: Contributing секция (перед License)

```markdown
## Contributing

Contributions are welcome — bug reports, feature requests, and pull requests.
Open an issue to start a discussion.
```

### Шаг 4: обновить License

```markdown
## License

MIT — see [LICENSE](LICENSE)
```

## Мануальная проверка (для пользователя)

- [ ] Открыть `README.md` в браузере (GitHub preview или VS Code) → badges отображаются корректно
- [ ] Screenshot виден (или есть placeholder-комментарий)
- [ ] Секция Contributing присутствует
- [ ] License ссылается на файл LICENSE
