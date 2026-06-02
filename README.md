# Diplom

Сайт для интерактивной 3D-визуализации учебного оборудования с SQL-хранилищем,
админ-панелью, базой знаний (FAQ) и QR-доступом.

## Что реализовано

- каталог специальностей (ОИБ, ПД, ЗЕМ) и 3D-моделей в SQLite (`data/equipment.sqlite`);
- лендинг с минималистичным меню «бургер» в правом верхнем углу:
  «Загрузить модель», «База знаний (FAQ)», «О нас» — всё в модальных окнах без
  перезагрузки;
- встроенная админ-форма с проверкой мастер-пароля и поддержкой загрузки
  GLB/GLTF-файлов (Multer) либо ссылок на модели;
- автоматический «киоск-режим»: при заходе по ссылке `/?equipment=<id>`
  (например, по QR-коду со стенда) лендинг скрывается и `<model-viewer>`
  занимает 100% высоты и ширины экрана;
- база знаний хранится в таблице `help_articles` SQLite и подгружается через
  `GET /api/help-articles`;
- QR-код собирается на клиенте из `window.location.origin`, поэтому работает
  на `localhost`, IP виртуальной машины и на любом домене.

## Локальный запуск

```bash
npm install
npm start
```

Сервер поднимется на `http://localhost:8080` (порт можно сменить через
переменную окружения `PORT`). Хост по умолчанию `0.0.0.0`, чтобы сайт был
виден из локальной сети.

## Запуск тестов

```bash
npm test
```

Проверяет синтаксис всех серверных и фронтенд-скриптов и сверяет
`data/equipment-data.js` с `data/equipment.json`.

## Конфигурация через переменные окружения

| Переменная        | По умолчанию | Описание                                                |
|-------------------|--------------|---------------------------------------------------------|
| `PORT`            | `8080`       | Порт HTTP-сервера                                       |
| `HOST`            | `0.0.0.0`    | Адрес, на котором слушает Express                       |
| `ADMIN_PASSWORD`  | `admin123`   | Мастер-пароль для модального окна «Загрузить модель»    |
| `PUBLIC_BASE_URL` | _(авто)_     | Полный URL сайта (используется для серверного QR API)   |

## API

- `GET /api/specialties` — все специальности и оборудование.
- `GET /api/equipment` — плоский список оборудования.
- `GET /api/equipment/:id` — карточка одного объекта (динамическая загрузка).
- `GET /api/qr/:id` — серверный QR-код (PNG dataURL).
- `GET /api/help-articles` — статьи базы знаний (FAQ).
- `GET /api/help-articles/:slug` — конкретная статья.
- `POST /api/admin/auth` (заголовок `x-admin-password`) — проверка пароля.
- `POST /api/admin/equipment` (`x-admin-password`, `multipart/form-data`
  с полями `specialtyId`, `title`, …, `model` и/или `modelFile`) — добавление
  новой 3D-модели. Если приходит файл — он сохраняется в `models/uploads/`
  и доступен по `/models/uploads/<filename>`.

## Развёртывание на Linux-VM

Минимальные требования: Ubuntu 22.04+ / Debian 12+ / любой современный
дистрибутив с Node.js 18+.

```bash
sudo apt update
sudo apt install -y nodejs npm git
git clone <your-repo-url> /opt/diplom
cd /opt/diplom
npm install --omit=dev
ADMIN_PASSWORD="strong-password" PORT=8080 npm start
```

### Запуск как systemd-сервис

Создайте файл `/etc/systemd/system/diplom.service`:

```ini
[Unit]
Description=3D educational equipment visualization (Node.js)
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/diplom
Environment=NODE_ENV=production
Environment=PORT=8080
Environment=HOST=0.0.0.0
Environment=ADMIN_PASSWORD=replace-me
ExecStart=/usr/bin/node /opt/diplom/server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Активация и запуск:

```bash
sudo chown -R www-data:www-data /opt/diplom
sudo systemctl daemon-reload
sudo systemctl enable --now diplom
sudo systemctl status diplom
```

### nginx как обратный прокси (опционально)

```nginx
server {
    listen 80;
    server_name college.example.ru;

    client_max_body_size 60m;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Хранилище

- `data/equipment.sqlite` — основная база (создаётся автоматически из сидового
  `data/equipment.json` при первом старте).
- `models/uploads/` — загруженные через админ-форму GLB/GLTF-файлы.
- `logs/scan.log` — журнал сканирований QR-кодов.

При резервном копировании достаточно сохранить эти три каталога.
