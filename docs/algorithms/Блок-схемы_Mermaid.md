# Блок-схемы (Mermaid) — Приложения А–Е

Откройте https://mermaid.live , вставьте код одной схемы, экспортируйте PNG/SVG в отчёт.

---

## Приложение А — Дерево специальностей

```mermaid
flowchart TD
    A([Начало]) --> B[GET /api/specialties/tree]
    B --> C{Ответ OK?}
    C -->|Нет| D[Сообщение об ошибке]
    D --> Z([Конец])
    C -->|Да| E[Получить nodes и tree]
    E --> F{tree пуст?}
    F -->|Да| G[Показать сетку карточек]
    G --> Z
    F -->|Нет| H[Для каждого корневого узла]
    H --> I[Создать LI и кнопку data-specialty]
    I --> J{Есть children?}
    J -->|Да| K[Рекурсия: вложенный UL]
    K --> L[Добавить в specialty-tree]
    J -->|Нет| L
    L --> M{Ещё узлы?}
    M -->|Да| H
    M -->|Нет| N[Показать дерево]
    N --> Z
```

---

## Приложение Б — Каталог экспонатов

```mermaid
flowchart TD
    A([Начало]) --> B[Клик по узлу дерева]
    B --> C[Прочитать specialtyId]
    C --> D{Специальность доступна?}
    D -->|Нет| Z([Конец])
    D -->|Да| E[GET /api/equipment?specialtyId=...]
    E --> F{Ответ OK?}
    F -->|Нет| G[Ошибка в списке]
    G --> Z
    F -->|Да| H[Очистить equipment-list]
    H --> I{Список пуст?}
    I -->|Да| J[Текст «нет объектов»]
    J --> Z
    I -->|Нет| K[Создать кнопки карточек]
    K --> L[Взять первый объект]
    L --> M[Установить src в model-viewer]
    M --> N[Заполнить панель описания]
    N --> O[Прокрутка к разделу 3D]
    O --> Z
```

---

## Приложение В — Добавление экспоната и QR

```mermaid
flowchart TD
    A([Начало]) --> B[POST /api/admin/equipment]
    B --> C{Авторизация OK?}
    C -->|Нет| D[401]
    D --> Z([Конец])
    C -->|Да| E{Поля и GLB/URL заполнены?}
    E -->|Нет| F[400]
    F --> Z
    E -->|Да| G[BEGIN транзакция]
    G --> H{Загружен файл .glb?}
    H -->|Да| I[Сохранить файл]
    I --> J[Вычислить size и SHA-256 hash]
    H -->|Нет| K[model = URL из формы]
    J --> L[INSERT INTO equipment]
    K --> L
    L --> M[COMMIT]
    M --> N[Сформировать URL view.html?id=...]
    N --> O[Сгенерировать QR qrcode]
    O --> P[Вернуть id, url, QR]
    P --> Z
```

---

## Приложение Г — Редактирование экспоната

```mermaid
flowchart TD
    A([Начало]) --> B[Кнопка «Изменить»]
    B --> C[Подставить данные в форму]
    C --> D[PUT /api/admin/equipment/id]
    D --> E{Запись найдена?}
    E -->|Нет| F[404]
    F --> Z([Конец])
    E -->|Да| G[BEGIN]
    G --> H{Новый файл glb?}
    H -->|Да| I[Удалить старый GLB с диска]
    I --> J[Сохранить новый + hash/size]
    H -->|Нет| K[model без изменений или URL]
    J --> L[UPDATE equipment]
    K --> L
    L --> M[COMMIT]
    M --> N[Обновить QR]
    N --> Z
```

---

## Приложение Д — Логирование сканирования QR

```mermaid
flowchart TD
    A([Начало]) --> B[GET /catalog/id или view.html?scan=1]
    B --> C{id корректен?}
    C -->|Нет| D[400]
    D --> Z([Конец])
    C -->|Да| E{Есть в equipment?}
    E -->|Нет| F[404]
    F --> Z
    E -->|Да| G[INSERT INTO scan_logs]
    G --> H[Запись в scan.log]
    H --> I{Маршрут /catalog?}
    I -->|Да| J[Redirect view.html]
    I -->|Нет| K[Отдать view.html]
    J --> L[Загрузка 3D на клиенте]
    K --> L
    L --> Z
```

---

## Приложение Е — Каскадное удаление

```mermaid
flowchart TD
    A([Начало]) --> B[DELETE /api/admin/equipment/id]
    B --> C{Авторизация OK?}
    C -->|Нет| D[401]
    D --> Z([Конец])
    C -->|Да| E{Запись найдена?}
    E -->|Нет| F[404]
    F --> Z
    E -->|Да| G[DELETE FROM equipment]
    G --> H[CASCADE: удаление scan_logs]
    H --> I{model в /models/?}
    I -->|Да| J[unlink файла GLB]
    I -->|Нет| K[Ответ deleted:true]
    J --> K
    K --> Z
```
