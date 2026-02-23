# Mini Games Collection

Набор мини-игр на чистом `HTML/CSS/JavaScript` с рендером через `Canvas 2D`.

## Что внутри
- Единая оболочка: `index.html` + `style.css`.
- Менеджер игр и hash-роутинг: `core/game_manager.js`.
- Общие утилиты:
  - `core/storage.js` (`localStorage` c namespace `minigames:<game>:<suffix>`)
  - `core/canvas_utils.js` (DPR-aware resize)
- Игры:
  - `tetris`
  - `arkanoid`
  - `asteroids`
  - `galaxy`
  - `pacman`
  - `sokoban`
  - `xonix`

## Запуск
Проект работает без сборки и без зависимостей.

1. Откройте `index.html` в браузере.
2. Выберите игру в меню слева.
3. Прямой запуск по hash: `index.html#tetris`, `index.html#sokoban` и т.д.

Отладочные страницы:
- `test_tetris.html`
- `test_arkanoid.html`

## Управление
У каждой игры есть свой `games/<gameName>/GAME_SPEC.md` с полными правилами и клавишами.

## Структура
```text
.
├─ index.html
├─ style.css
├─ main.js
├─ SPEC.md
├─ AGENTS.md
├─ core/
│  ├─ game_manager.js
│  ├─ storage.js
│  └─ canvas_utils.js
└─ games/
   ├─ tetris/
   ├─ arkanoid/
   ├─ asteroids/
   ├─ galaxy/
   ├─ pacman/
   ├─ sokoban/
   └─ xonix/
```

## Добавление новой игры
1. Создать папку `games/<gameName>/`.
2. Реализовать класс игры с методами:
   - `getName()`
   - `getTitle()`
   - `run(canvas)`
   - `stop()`
3. Создать `games/<gameName>/GAME_SPEC.md`.
4. Подключить `games/<gameName>/<gameName>.js` в `index.html` перед `main.js`.
5. Зарегистрировать игру в `main.js`.
6. Использовать отдельный `localStorage`-ключ через `storageKey(gameName, suffix)`.

## Документация
- `SPEC.md` — общая архитектура и контракты.
- `games/<gameName>/GAME_SPEC.md` — правила и детали конкретной игры.
