# Diplom

Сайт для интерактивной 3D-визуализации учебного оборудования с SQL-хранилищем и админ-панелью.

## Что реализовано

- каталог специальностей и 3D-моделей;
- сохранение данных в SQLite (`data/equipment.sqlite`);
- основной сайт читает каталог через API `/api/specialties`;
- админ-панель `/admin.html` для загрузки GLB-моделей и добавления карточек;
- QR-код создается только в админ-панели после добавления модели.

## Запуск через Docker

Основной сценарий для сервера:

```bash
cp .env.example .env
docker compose up -d --build
```

После запуска сайт доступен по адресу:

```text
http://localhost:8080
```

Если нужно открыть сайт на другом порту, измените `HOST_PORT` в `.env`, например:

```env
HOST_PORT=80
```

### Постоянные данные Docker

`docker-compose.yml` использует именованные Docker volumes:

- `diplom-data` → `/app/data` — SQLite-база (`equipment.sqlite`) и исходный seed-файл;
- `diplom-models` → `/app/public/models` — загруженные `.glb` модели;
- `diplom-logs` → `/app/logs` — журнал сканирования QR.

Эти данные не удаляются при пересоздании контейнера командой `docker compose up -d --build`.
Если нужно полностью сбросить базу и загруженные модели, используйте:

```bash
docker compose down -v
```

### Переменные окружения

Настройки задаются в `.env`:

```env
HOST_PORT=8080
ADMIN_PASSWORD=admin123
PUBLIC_BASE_URL=
```

Для production обязательно замените `ADMIN_PASSWORD`. Более безопасный вариант —
использовать bcrypt-хэш:

```bash
node -e "const bcrypt=require('bcrypt'); bcrypt.hash('strong-password', 10).then(console.log)"
```

Затем укажите результат в `.env`:

```env
ADMIN_PASSWORD_HASH=$2b$10$...
```

Если задан `ADMIN_PASSWORD_HASH`, он имеет приоритет над `ADMIN_PASSWORD`.

Полезные команды:

```bash
docker compose logs -f
docker compose restart
docker compose down
```

### Ошибка `ERR_DLOPEN_FAILED` / GLIBC при старте

Так бывает, если в контейнер попали `node_modules`, собранные на другой ОС (Windows/macOS),
или образ не пересобран после обновления зависимостей.

```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

Не монтируйте папку `node_modules` с хоста в контейнер. В `.dockerignore` она уже исключена.

## Локальный запуск

```bash
npm install
npm start
```

Сервер поднимется на:

```text
http://localhost:8080
```

Страницы:

- каталог: `http://localhost:8080/`
- админка: `http://localhost:8080/admin.html`

## Админ-доступ

На главной странице откройте burger-меню и нажмите **Загрузить модель**.
После ввода пароля откроется админ-панель с формой загрузки модели.

По умолчанию пароль: `admin123`. Для production задайте `ADMIN_PASSWORD`
или `ADMIN_PASSWORD_HASH` в `.env`.
