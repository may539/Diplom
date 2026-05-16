# Диаграммы и формы по проекту

Проект: сайт интерактивной 3D-визуализации учебного оборудования.  
Назначение: каталог специальностей и учебного оборудования с 3D-просмотром, QR-доступом, SQLite-хранилищем и административной панелью.

Ниже приведены готовые диаграммы и модели для вставки в отчет. Для диаграмм используется Mermaid. Если в редакторе Mermaid нет отдельной нотации IDEF0, контекстная и декомпозиционная диаграммы IDEF0 оформлены через `flowchart` с сохранением логики ICOM: входы, управления, выходы, механизмы.

---

## 1. Диаграмма пакетов

**Рисунок 1 - Диаграмма пакетов программного изделия.**

```mermaid
flowchart TB
  subgraph Client["Пакет: Клиентская часть"]
    Index["index.html\nГлавная страница"]
    AppJs["app.js\nКаталог, 3D-просмотр, QR"]
    AdminHtml["admin.html\nАдмин-страница"]
    AdminJs["admin.js\nВход, добавление модели"]
    Styles["styles.css\nСтили интерфейса"]
    VendorQr["vendor/qrcode.js\nQR для админ-панели"]
  end

  subgraph Server["Пакет: Серверная часть"]
    ServerJs["server.js\nExpress API, SQLite, QR, загрузка файлов"]
    Middleware["Middleware\nhelmet, rate-limit, compression, multer"]
    Routes["API routes\n/api/specialties, /api/equipment, /api/admin"]
  end

  subgraph Data["Пакет: Данные"]
    Json["data/equipment.json\nИсходный каталог"]
    Fallback["data/equipment-data.js\nFallback для браузера"]
    Sqlite["data/equipment.sqlite\nSQLite база"]
    Logs["logs/scan.log\nЖурнал QR-переходов"]
  end

  subgraph Assets["Пакет: Ресурсы"]
    PublicModels["public/models\nЗагруженные GLB"]
    RemoteModels["Внешние GLB URL\nmodelviewer.dev или другие источники"]
  end

  subgraph Tests["Пакет: Проверки"]
    Verify["scripts/verify-data-fallback.js\nПроверка синхронизации данных"]
    NpmTest["npm test\nnode --check + verify-data-fallback"]
  end

  Client -->|fetch API| Server
  AppJs -->|fallback при ошибке API| Fallback
  ServerJs --> Sqlite
  ServerJs --> Json
  ServerJs --> Logs
  ServerJs --> PublicModels
  AppJs --> PublicModels
  AppJs --> RemoteModels
  AdminJs --> VendorQr
  Verify --> Json
  Verify --> Fallback
  NpmTest --> Verify
```

---

## 2. Диаграмма развертывания

**Рисунок 2 - Диаграмма развертывания веб-приложения.**

```mermaid
flowchart TB
  subgraph UserDevice["Устройство пользователя"]
    Browser["Браузер\nChrome / Edge / Firefox / мобильный браузер"]
    ModelViewer["Web Component <model-viewer>\nОтображение GLB"]
    QRClient["Библиотека QR в браузере\nqrcode.js / QRCode.toDataURL"]
  end

  subgraph CollegeServer["Сервер колледжа / Linux"]
    Node["Node.js Runtime"]
    Express["Express-приложение\nserver.js"]
    StaticFiles["Статические файлы\nindex.html, admin.html, app.js, admin.js, styles.css"]
    Api["REST API\n/api/*"]
    UploadDir["Каталог моделей\npublic/models"]
    LogFile["Файл журнала\nlogs/scan.log"]
  end

  subgraph Storage["Локальное хранилище сервера"]
    SQLite["SQLite\n data/equipment.sqlite"]
    SeedJson["Seed JSON\n data/equipment.json"]
    FallbackJs["Fallback JS\n data/equipment-data.js"]
  end

  subgraph Internet["Внешние источники"]
    CdnModelViewer["CDN model-viewer"]
    CdnQr["CDN qrcode"]
    RemoteGlb["Внешние GLB-модели"]
  end

  Browser -->|HTTP GET /| Express
  Browser -->|HTTP GET /admin.html| Express
  Browser -->|fetch /api/specialties| Api
  Browser -->|fetch /api/equipment/:id| Api
  Browser -->|multipart POST /api/admin/equipment| Api
  Browser -->|GET GLB| UploadDir
  Browser -->|GET GLB| RemoteGlb
  Browser --> CdnModelViewer
  Browser --> CdnQr
  Browser --> ModelViewer
  Browser --> QRClient

  Node --> Express
  Express --> StaticFiles
  Express --> Api
  Api --> SQLite
  Api --> UploadDir
  Api --> LogFile
  Express --> SeedJson
  StaticFiles --> FallbackJs
```

---

## 3. Контекстная диаграмма IDEF0

**Рисунок 3 - Контекстная диаграмма IDEF0 A-0 "Обеспечить 3D-визуализацию учебного оборудования".**

```mermaid
flowchart LR
  Inputs["Входы\n- Данные о специальностях\n- Данные об оборудовании\n- GLB-модели\n- Запрос пользователя\n- Данные формы администратора"]
  Controls["Управления\n- Требования учебного процесса\n- Правила доступа администратора\n- Ограничение формата .glb\n- Настройки безопасности\n- Структура каталога"]
  Mechanisms["Механизмы\n- Node.js\n- Express\n- SQLite\n- Браузер\n- model-viewer\n- QR-библиотека\n- Администратор"]
  Function["A-0\nОбеспечить 3D-визуализацию\nучебного оборудования"]
  Outputs["Выходы\n- Каталог специальностей\n- Карточка оборудования\n- 3D-модель с аннотациями\n- QR-код\n- Новая запись в БД\n- Журнал QR-переходов"]

  Inputs --> Function
  Controls --> Function
  Mechanisms --> Function
  Function --> Outputs
```

### Форма IDEF0 A-0

| Элемент IDEF0 | Содержание |
| --- | --- |
| Функция | Обеспечить 3D-визуализацию учебного оборудования |
| Входы | Данные о специальностях, данные об оборудовании, GLB-модели, запросы пользователей, данные форм администратора |
| Управления | Требования учебного процесса, правила авторизации, ограничения формата и размера файлов, структура каталога, настройки безопасности |
| Выходы | Каталог, карточка оборудования, 3D-просмотр, QR-код, новая запись оборудования, журнал переходов |
| Механизмы | Node.js, Express, SQLite, браузер, model-viewer, QR-библиотека, администратор |

---

## 4. Диаграмма декомпозиции IDEF0

**Рисунок 4 - Декомпозиция IDEF0 A0 "Работа сайта 3D-визуализации".**

```mermaid
flowchart TB
  I1["I1\nИсходные данные каталога"]
  I2["I2\nЗапрос пользователя"]
  I3["I3\nДанные новой модели"]
  C1["C1\nТребования к интерфейсу"]
  C2["C2\nПравила авторизации"]
  C3["C3\nОграничения безопасности"]
  M1["M1\nБраузер и JS"]
  M2["M2\nExpress API"]
  M3["M3\nSQLite и файловая система"]

  A1["A1\nЗагрузить каталог"]
  A2["A2\nОтобразить 3D-карточку"]
  A3["A3\nСформировать QR-доступ"]
  A4["A4\nАдминистрировать каталог"]
  A5["A5\nСохранить и защитить данные"]

  O1["O1\nСписок специальностей"]
  O2["O2\nКарточка и 3D-модель"]
  O3["O3\nQR-код и ссылка"]
  O4["O4\nОбновленная база данных"]
  O5["O5\nЖурнал событий"]

  I1 --> A1
  I2 --> A1
  I2 --> A2
  I2 --> A3
  I3 --> A4

  C1 --> A1
  C1 --> A2
  C1 --> A3
  C2 --> A4
  C3 --> A4
  C3 --> A5

  M1 --> A1
  M1 --> A2
  M1 --> A3
  M2 --> A1
  M2 --> A3
  M2 --> A4
  M3 --> A1
  M3 --> A4
  M3 --> A5

  A1 --> O1
  A1 --> A2
  A2 --> O2
  A2 --> A3
  A3 --> O3
  A3 --> A5
  A4 --> O4
  A4 --> A1
  A5 --> O5
```

### Форма декомпозиции IDEF0 A0

| Блок | Название | Входы | Управления | Выходы | Механизмы |
| --- | --- | --- | --- | --- | --- |
| A1 | Загрузить каталог | Исходные данные, запрос пользователя | Требования к интерфейсу | Список специальностей и оборудования | Браузер, Express, SQLite |
| A2 | Отобразить 3D-карточку | Выбранное оборудование | Требования к интерфейсу | Карточка, 3D-модель, аннотации | Браузер, app.js, model-viewer |
| A3 | Сформировать QR-доступ | Идентификатор оборудования | Правила формирования URL | QR-код, прямая ссылка | QR-библиотека, Express |
| A4 | Администрировать каталог | Данные новой модели, GLB-файл | Авторизация, ограничения файлов | Новая запись, сохраненный файл | admin.js, Express, multer, SQLite |
| A5 | Сохранить и защитить данные | События и записи каталога | Политики безопасности | Журнал, защищенное хранилище | helmet, rate-limit, SQLite, файловая система |

---

## 5. Диаграмма декомпозиции DFD

**Рисунок 5 - Декомпозиция DFD процесса "Обработать работу с оборудованием".**

```mermaid
flowchart TB
  User[Внешняя сущность\nПользователь]
  Admin[Внешняя сущность\nАдминистратор]

  P1((1.1\nПолучить каталог))
  P2((1.2\nВыбрать специальность))
  P3((1.3\nПолучить карточку оборудования))
  P4((1.4\nОтобразить 3D-модель))
  P5((1.5\nСформировать QR-код))
  P6((1.6\nЗаписать переход по QR))
  P7((1.7\nАвторизовать администратора))
  P8((1.8\nДобавить оборудование))

  D1[(D1\nspecialties)]
  D2[(D2\nequipment)]
  D3[(D3\npublic/models)]
  D4[(D4\nadminSessions)]
  D5[(D5\nlogs/scan.log)]
  D6[(D6\nequipment-data.js)]

  User -->|Запрос главной страницы| P1
  P1 -->|Чтение специальностей| D1
  P1 -->|Чтение оборудования| D2
  D1 -->|Список специальностей| P1
  D2 -->|Список оборудования| P1
  D6 -->|Fallback-каталог при ошибке API| P1
  P1 -->|Каталог| User

  User -->|Выбор специальности| P2
  P2 -->|Фильтр по specialty_id| D2
  P2 -->|Список оборудования специальности| User

  User -->|equipmentId| P3
  P3 -->|Запрос карточки| D2
  D2 -->|Описание, features, model, hotspots| P3
  P3 -->|Карточка| User

  P3 -->|URL или путь GLB| P4
  P4 -->|Запрос модели| D3
  D3 -->|GLB-файл| P4
  P4 -->|3D-просмотр и аннотации| User

  User -->|Запрос QR| P5
  P5 -->|URL с id и scan=1| User

  User -->|Переход по QR| P6
  P6 -->|Запись события| D5
  P6 -->|Открыть карточку| P3

  Admin -->|Пароль| P7
  P7 -->|Создать токен| D4
  P7 -->|Статус входа| Admin

  Admin -->|Данные формы и GLB| P8
  D4 -->|Проверка токена| P8
  P8 -->|Сохранить GLB| D3
  P8 -->|INSERT equipment| D2
  P8 -->|URL новой модели| Admin
  P8 -->|QR для печати| Admin
```

---

## 6. Диаграмма вариантов использования

**Рисунок 6 - Диаграмма вариантов использования сайта.**

```mermaid
flowchart LR
  Student([Студент])
  Teacher([Преподаватель])
  Admin([Администратор])

  subgraph System["Система: 3D-визуализация учебного оборудования"]
    UC1["Выбрать специальность"]
    UC2["Просмотреть список оборудования"]
    UC3["Открыть карточку оборудования"]
    UC4["Просмотреть 3D-модель"]
    UC5["Изменить масштаб и автопрокрутку"]
    UC6["Изучить аннотации"]
    UC7["Сгенерировать QR-код"]
    UC8["Открыть модель по QR-ссылке"]
    UC9["Войти в админ-панель"]
    UC10["Добавить оборудование"]
    UC11["Загрузить GLB-файл"]
    UC12["Распечатать QR-код"]
  end

  Student --> UC1
  Student --> UC2
  Student --> UC3
  Student --> UC4
  Student --> UC5
  Student --> UC6
  Student --> UC8

  Teacher --> UC1
  Teacher --> UC3
  Teacher --> UC4
  Teacher --> UC7
  Teacher --> UC12

  Admin --> UC9
  Admin --> UC10
  Admin --> UC11
  Admin --> UC12

  UC1 --> UC2
  UC2 --> UC3
  UC3 --> UC4
  UC4 --> UC5
  UC4 --> UC6
  UC3 --> UC7
  UC7 --> UC8
  UC9 --> UC10
  UC10 --> UC11
  UC10 --> UC12
```

---

## 7. Диаграмма деятельности

**Рисунок 7 - Диаграмма деятельности основного пользовательского сценария.**

```mermaid
flowchart TD
  Start([Начало])
  OpenSite[Открыть сайт]
  LoadData[Загрузить каталог через /api/specialties]
  ApiOk{API доступен?}
  UseApi[Использовать данные API]
  UseFallback[Использовать fallback equipment-data.js]
  ShowSpecialties[Показать специальности]
  SelectSpecialty[Выбрать специальность]
  ShowEquipment[Показать оборудование специальности]
  SelectEquipment[Выбрать оборудование]
  LoadDetail[Запросить /api/equipment/:id]
  DetailOk{Карточка найдена?}
  ShowNotFound[Показать сообщение: объект не найден]
  RenderCard[Показать описание и особенности]
  LoadModel[Загрузить GLB-модель]
  RenderHotspots[Показать аннотации]
  UserAction{Действие пользователя}
  RotateZoom[Вращать или масштабировать модель]
  ToggleAuto[Включить/выключить автопрокрутку]
  OpenQr[Открыть QR-код]
  MakeQr[Сформировать ссылку и QR]
  End([Конец])

  Start --> OpenSite --> LoadData --> ApiOk
  ApiOk -- Да --> UseApi --> ShowSpecialties
  ApiOk -- Нет --> UseFallback --> ShowSpecialties
  ShowSpecialties --> SelectSpecialty --> ShowEquipment --> SelectEquipment --> LoadDetail --> DetailOk
  DetailOk -- Нет --> ShowNotFound --> End
  DetailOk -- Да --> RenderCard --> LoadModel --> RenderHotspots --> UserAction
  UserAction -- Просмотр --> RotateZoom --> UserAction
  UserAction -- Автопрокрутка --> ToggleAuto --> UserAction
  UserAction -- QR --> OpenQr --> MakeQr --> End
```

---

## 8. ER-диаграмма

**Рисунок 8 - ER-диаграмма предметной области и хранилища.**

```mermaid
erDiagram
  SPECIALTY ||--o{ EQUIPMENT : contains
  EQUIPMENT ||--o{ HOTSPOT : has
  EQUIPMENT ||--o{ FEATURE : includes
  EQUIPMENT ||--o{ SCAN_LOG_ENTRY : creates
  ADMIN_SESSION ||--o{ EQUIPMENT : allows_create

  SPECIALTY {
    text id PK
    text code
    text title
    text description
    integer sort_order
  }

  EQUIPMENT {
    text id PK
    text specialty_id FK
    text title
    text type
    text short
    text description
    text features_json
    text model
    text environment
    text variant
    text hotspots_json
    text created_at
  }

  HOTSPOT {
    text label
    text note
    number x
    number y
    text position
    text normal
  }

  FEATURE {
    text value
  }

  ADMIN_SESSION {
    text token PK
    integer expires_at
  }

  SCAN_LOG_ENTRY {
    text equipmentId
    text equipmentTitle
    datetime viewedAt
    text route
    text ip
    text userAgent
  }
```

---

## 9. Логическая модель данных

**Рисунок 9 - Логическая модель данных.**

```mermaid
flowchart TB
  Specialty["SPECIALTIES\nPK id: TEXT\ncode: TEXT\ntitle: TEXT\ndescription: TEXT\nsort_order: INTEGER"]
  Equipment["EQUIPMENT\nPK id: TEXT\nFK specialty_id: TEXT\ntitle: TEXT\ntype: TEXT\nshort: TEXT\ndescription: TEXT\nfeatures_json: TEXT\nmodel: TEXT\nenvironment: TEXT\nvariant: TEXT\nhotspots_json: TEXT\ncreated_at: TEXT"]
  Features["FEATURES_JSON\nJSON array of string\nПример: ['изучение состава', 'QR-ссылка']"]
  Hotspots["HOTSPOTS_JSON\nJSON array of object\nlabel, note, x, y, position, normal"]
  AdminSessions["ADMIN_SESSIONS\nMap в памяти сервера\ntoken -> expiresAt"]
  ScanLog["SCAN_LOG\nJSON lines file\nequipmentId, title, viewedAt, route, ip, userAgent"]
  Models["MODEL_FILES\npublic/models/*.glb\nили внешний URL"]

  Specialty -->|1:N specialty_id| Equipment
  Equipment -->|stores array| Features
  Equipment -->|stores array| Hotspots
  Equipment -->|model path/url| Models
  Equipment -->|scan events| ScanLog
  AdminSessions -->|authorizes insert| Equipment
```

### Табличная форма логической модели

| Объект | Хранилище | Ключ | Связи |
| --- | --- | --- | --- |
| Специальность | `specialties` | `id` | Одна специальность содержит много объектов оборудования |
| Оборудование | `equipment` | `id` | Каждая запись относится к одной специальности |
| Особенности | `features_json` | Не выделен в отдельную таблицу | JSON-массив внутри `equipment` |
| Аннотации | `hotspots_json` | Не выделен в отдельную таблицу | JSON-массив внутри `equipment` |
| Админ-сессия | `adminSessions` в памяти | `token` | Разрешает административные запросы |
| Журнал сканирования | `logs/scan.log` | Время события + equipmentId | Связан с оборудованием по `equipmentId` |
| GLB-модель | `public/models` или внешний URL | Имя файла/URL | Используется записью `equipment.model` |

---

## 10. Диаграмма потоков данных

**Рисунок 10 - Диаграмма потоков данных верхнего уровня.**

```mermaid
flowchart LR
  Student[Студент / преподаватель]
  Admin[Администратор]

  P1((P1\nПубличный каталог))
  P2((P2\n3D-просмотр))
  P3((P3\nQR-доступ))
  P4((P4\nАдминистрирование))

  D1[(D1\nSQLite equipment.sqlite)]
  D2[(D2\nGLB-модели)]
  D3[(D3\nFallback equipment-data.js)]
  D4[(D4\nЖурнал scan.log)]

  Student -->|Открыть сайт| P1
  P1 -->|Запрос каталога| D1
  D1 -->|Специальности и оборудование| P1
  D3 -->|Резервные данные| P1
  P1 -->|Список и выбранный id| Student

  Student -->|Выбрать оборудование| P2
  P2 -->|Данные карточки| D1
  P2 -->|Файл модели / URL| D2
  D1 -->|Описание и hotspots| P2
  D2 -->|GLB| P2
  P2 -->|3D-модель и аннотации| Student

  Student -->|Показать QR| P3
  P3 -->|URL карточки| Student
  Student -->|Переход scan=1| P3
  P3 -->|Событие просмотра| D4

  Admin -->|Пароль, форма, файл| P4
  P4 -->|Чтение специальностей| D1
  P4 -->|Новая запись| D1
  P4 -->|Сохранение .glb| D2
  P4 -->|Статус и QR для печати| Admin
```

---

## 11. Диаграмма классов

**Рисунок 11 - Диаграмма классов предметной области.**

```mermaid
classDiagram
  class Specialty {
    +string id
    +string code
    +string title
    +string description
    +number sortOrder
    +Equipment[] equipment
  }

  class Equipment {
    +string id
    +string specialtyId
    +string title
    +string type
    +string short
    +string description
    +string[] features
    +string model
    +string environment
    +string variant
    +Hotspot[] hotspots
    +string createdAt
  }

  class Hotspot {
    +string label
    +string note
    +number x
    +number y
    +string position
    +string normal
  }

  class AdminSession {
    +string token
    +number expiresAt
    +isExpired() boolean
  }

  class QrPayload {
    +string equipmentId
    +string title
    +string url
    +string imageDataUrl
  }

  class ScanLogEntry {
    +string equipmentId
    +string equipmentTitle
    +string viewedAt
    +string route
    +string ip
    +string userAgent
  }

  class EquipmentRepository {
    +readSpecialties() Specialty[]
    +allEquipment() Equipment[]
    +findEquipment(id) Equipment
    +insertEquipment(data) Equipment
  }

  class QrService {
    +equipmentUrl(request, equipmentId) string
    +generateQr(equipmentId) QrPayload
  }

  class AdminAuthService {
    +login(password) AdminSession
    +assertAdmin(token) boolean
    +cleanupExpiredSessions() void
  }

  Specialty "1" --> "0..*" Equipment
  Equipment "1" --> "0..*" Hotspot
  Equipment "1" --> "0..*" ScanLogEntry
  Equipment "1" --> "0..1" QrPayload
  EquipmentRepository --> Specialty
  EquipmentRepository --> Equipment
  QrService --> QrPayload
  QrService --> Equipment
  AdminAuthService --> AdminSession
  AdminSession --> EquipmentRepository : permits insert
```

---

## 12. Алгоритм решения задачи: основной сценарий - просмотр оборудования

**Рисунок 12 - Алгоритм просмотра оборудования.**

```mermaid
flowchart TD
  Start([Начало])
  Open[Пользователь открывает главную страницу]
  Init[Инициализация app.js]
  CheckMode{Страница открыта через file://?}
  FetchApi[Запросить /api/specialties]
  ApiSuccess{Ответ API успешен?}
  LoadFallback[Загрузить window.EQUIPMENT_DATA]
  SaveCatalog[Сохранить каталог в состоянии страницы]
  HasQuery{В URL есть id оборудования?}
  DefaultFirst[Выбрать первую специальность и первое оборудование]
  FindById[Найти оборудование по id]
  Found{Оборудование найдено?}
  NotFound[Показать состояние 'Объект не найден']
  RenderSpecialties[Отрисовать карточки специальностей]
  RenderList[Отрисовать список оборудования]
  FetchDetail[Запросить /api/equipment/:id]
  DetailOk{Детальная карточка получена?}
  UseCatalogData[Использовать данные из каталога]
  RenderCard[Отрисовать название, описание, особенности]
  LoadGlb[Передать model в <model-viewer>]
  RenderHotspots[Отрисовать hotspots и панель аннотаций]
  Controls[Включить масштаб, автопрокрутку и обработчики выбора]
  Result[Пользователь изучает 3D-модель]
  End([Конец])

  Start --> Open --> Init --> CheckMode
  CheckMode -- Да --> LoadFallback
  CheckMode -- Нет --> FetchApi --> ApiSuccess
  ApiSuccess -- Да --> SaveCatalog
  ApiSuccess -- Нет --> LoadFallback
  LoadFallback --> SaveCatalog
  SaveCatalog --> HasQuery
  HasQuery -- Нет --> DefaultFirst --> RenderSpecialties
  HasQuery -- Да --> FindById --> Found
  Found -- Нет --> NotFound --> End
  Found -- Да --> RenderSpecialties
  RenderSpecialties --> RenderList --> FetchDetail --> DetailOk
  DetailOk -- Нет --> UseCatalogData --> RenderCard
  DetailOk -- Да --> RenderCard
  RenderCard --> LoadGlb --> RenderHotspots --> Controls --> Result --> End
```

### Словесная форма алгоритма

1. Пользователь открывает главную страницу сайта.
2. Скрипт `app.js` проверяет режим запуска: серверный режим или открытие HTML-файла напрямую.
3. В серверном режиме выполняется запрос `/api/specialties`.
4. Если API недоступен, используются fallback-данные `window.EQUIPMENT_DATA`.
5. Система определяет активное оборудование: из URL-параметра `id`, маршрута `/equipment/:id` или выбирает первый объект каталога.
6. Отрисовываются карточки специальностей и список оборудования.
7. Для выбранного оборудования выполняется запрос `/api/equipment/:id`.
8. Если детальная карточка доступна, используются данные API; иначе берутся данные из уже загруженного каталога.
9. В интерфейс выводятся название, тип, описание и особенности оборудования.
10. В элемент `<model-viewer>` передается путь или URL GLB-модели.
11. На модель добавляются аннотации `hotspots`.
12. Пользователь вращает, масштабирует модель, включает или выключает автопрокрутку и изучает пояснения.

---

## 13. Инфологическая модель

**Рисунок 13 - Инфологическая модель предметной области.**

```mermaid
flowchart TB
  Specialty["Сущность: Специальность\n- Идентификатор\n- Код\n- Название\n- Описание\n- Порядок отображения"]
  Equipment["Сущность: Учебное оборудование\n- Идентификатор\n- Название\n- Тип\n- Краткое описание\n- Полное описание\n- Особенности\n- Ссылка на 3D-модель\n- Вариант отображения\n- Окружение"]
  Hotspot["Сущность: Аннотация модели\n- Название точки\n- Пояснение\n- Координаты\n- Нормаль поверхности"]
  Model["Сущность: 3D-модель\n- GLB-файл\n- Внешний URL\n- Локальный путь"]
  QrCode["Сущность: QR-доступ\n- URL карточки\n- Идентификатор оборудования\n- Признак scan=1"]
  Admin["Сущность: Администратор\n- Пароль\n- Токен сессии\n- Срок действия"]
  ScanEvent["Сущность: Событие просмотра\n- Оборудование\n- Дата\n- Маршрут\n- IP\n- User-Agent"]

  Specialty -->|содержит 0..N| Equipment
  Equipment -->|имеет 0..N| Hotspot
  Equipment -->|использует 1| Model
  Equipment -->|имеет 0..N| QrCode
  QrCode -->|создает 0..N| ScanEvent
  Admin -->|добавляет 0..N| Equipment
```

### Табличная форма инфологической модели

| Сущность | Назначение | Основные атрибуты | Связи |
| --- | --- | --- | --- |
| Специальность | Группирует оборудование по направлению обучения | id, code, title, description, sort_order | Содержит много объектов оборудования |
| Учебное оборудование | Описывает демонстрационный объект каталога | id, title, type, short, description, features, model | Относится к одной специальности, имеет аннотации и QR |
| Аннотация модели | Поясняет отдельный элемент 3D-модели | label, note, x, y, position, normal | Принадлежит одному объекту оборудования |
| 3D-модель | Визуальный ресурс для просмотра | URL или путь к `.glb` | Используется одним или несколькими объектами оборудования |
| QR-доступ | Быстрая ссылка на карточку оборудования | url, equipmentId, scan | Формируется для выбранного оборудования |
| Администратор | Пользователь с правом добавления данных | password hash, token, expiresAt | Создает записи оборудования |
| Событие просмотра | Запись о переходе по QR-ссылке | equipmentId, viewedAt, route, ip, userAgent | Связано с оборудованием |

