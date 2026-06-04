# Алгоритмы (Приложения А–Е)

Код модулей вынесен в отдельные файлы для включения в пояснительную записку.

| Модуль | Приложение | Сервер | Клиент |
|--------|------------|--------|--------|
| Дерево специальностей | А | `server/algorithms/specialty-tree.js` | `algorithms-client/specialty-tree.js` |
| Каталог экспонатов | Б | `server/algorithms/equipment-catalog.js` | `algorithms-client/catalog-render.js` |
| Добавление + QR | В | `server/algorithms/equipment-create.js`, `file-metadata.js` | `admin.js` (форма) |
| Редактирование | Г | `server/algorithms/equipment-update.js` | `admin.js` |
| Логирование QR | Д | `server/algorithms/scan-log.js` | `view.js` |
| Каскадное удаление | Е | `server/algorithms/equipment-delete.js` | `admin.js` |

Миграции схемы: `server/algorithms/db-migrate.js` (таблица `scan_logs`, поля `parent_id`, `sort_order`, `model_file_hash`).

API:

- `GET /api/specialties/tree` — узлы и дерево;
- `GET /api/equipment?specialtyId=pd` — каталог по специальности;
- `GET /catalog/:id` — переход на полноэкранный просмотр с записью в `scan_logs`.
