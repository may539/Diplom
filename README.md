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
дистрибутив. Способ запуска — на ваш выбор: «голым» Node.js или в Docker.
Рекомендуем Docker — меньше ручной настройки и проще обновлять.

### Вариант A: напрямую через Node.js

```bash
sudo apt update
sudo apt install -y nodejs npm git
git clone <your-repo-url> /opt/diplom
cd /opt/diplom
npm install --omit=dev
ADMIN_PASSWORD="strong-password" PORT=8080 npm start
```

### Вариант B: Docker + docker compose (рекомендуется)

В репозитории уже лежат `Dockerfile`, `docker-compose.yml`, `.dockerignore`
и `.env.example`. Контейнер собирается на базе `node:20-bookworm-slim`,
запускается под непривилегированным пользователем `app` и использует
`tini` для корректной обработки сигналов.

#### 1. Поставьте Docker на VM (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg git
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/$(. /etc/os-release && echo "$ID")/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/$(. /etc/os-release && echo "$ID") \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# чтобы запускать docker без sudo
sudo usermod -aG docker $USER
newgrp docker
```

Проверьте: `docker --version` и `docker compose version`.

#### 2. Получите код и подготовьте `.env`

```bash
sudo mkdir -p /opt/diplom && sudo chown $USER:$USER /opt/diplom
git clone <your-repo-url> /opt/diplom
cd /opt/diplom

cp .env.example .env
# отредактируйте .env: смените ADMIN_PASSWORD, при необходимости
# поменяйте HOST_PORT (например, на 80, если хотите http://<ip>/ без порта)
nano .env
```

Файл `.env` (не попадает в git) задаёт переменные:

| Переменная        | По умолчанию | Описание                                              |
|-------------------|--------------|-------------------------------------------------------|
| `ADMIN_PASSWORD`  | `admin123`   | Пароль для модального окна «Загрузить модель»         |
| `HOST_PORT`       | `8080`       | На каком порту VM публиковать сайт                    |
| `PUBLIC_BASE_URL` | _(пусто)_    | Полный URL сайта, если перед контейнером nginx/CDN    |

Внутри контейнера сервер всегда слушает `8080`, наружу пробрасывается
`HOST_PORT:8080`.

#### 3. Запуск

```bash
cd /opt/diplom
docker compose up -d --build
```

Что произойдёт:

- образ `diplom-3d:latest` соберётся (multi-stage, ~150–200 МБ);
- контейнер `diplom-3d` поднимется в фоне с `restart: unless-stopped`;
- три каталога будут смонтированы как volumes на хост:
  - `./data` → SQLite-база (`equipment.sqlite`);
  - `./models/uploads` → загруженные через админку GLB-файлы;
  - `./logs` → журнал сканирований QR.
- встроенный healthcheck опрашивает `/api/specialties` каждые 30 секунд.

Откройте `http://<ip-виртуалки>:8080/` (или просто `http://<ip>/`,
если в `.env` указали `HOST_PORT=80`).

#### 4. Управление

```bash
docker compose ps              # статус и healthcheck
docker compose logs -f         # живой лог
docker compose restart         # перезапуск
docker compose down            # остановка (volumes сохраняются)
docker compose up -d --build   # обновить после git pull
```

#### 5. Обновление кода

```bash
cd /opt/diplom
git pull
docker compose up -d --build
```

База данных и загруженные файлы переживают пересборку, потому что
лежат в volumes на хосте.

#### 6. Бэкап

Достаточно сохранить три каталога:

```bash
tar -czf diplom-backup-$(date +%F).tar.gz data models/uploads logs
```

#### 7. (Опционально) HTTPS через nginx + certbot

Если хотите проброс через системный nginx с TLS (Let's Encrypt),
оставьте `HOST_PORT=8080`, чтобы наружу торчал nginx, а контейнер
был доступен только на `127.0.0.1:8080`. Используйте конфигурацию из
раздела «nginx как обратный прокси» ниже и в `.env` укажите
`PUBLIC_BASE_URL=https://college.example.ru`.

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
