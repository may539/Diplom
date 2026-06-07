/**
 * Миграции схемы SQLite под алгоритмы из пояснительной записки (Приложения А–Е).
 */

async function columnExists(all, table, column) {
  const info = await all(`PRAGMA table_info(${table})`);
  return info.some((row) => row.name === column);
}

async function migrateSchema({ run, all }) {
  if (!(await columnExists(all, "specialties", "parent_id"))) {
    await run("ALTER TABLE specialties ADD COLUMN parent_id TEXT REFERENCES specialties(id)");
  }

  if (!(await columnExists(all, "specialties", "classroom_photo"))) {
    await run("ALTER TABLE specialties ADD COLUMN classroom_photo TEXT");
  }

  if (!(await columnExists(all, "specialties", "classroom_passport"))) {
    await run("ALTER TABLE specialties ADD COLUMN classroom_passport TEXT");
  }

  if (!(await columnExists(all, "equipment", "sort_order"))) {
    await run("ALTER TABLE equipment ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0");
  }

  if (!(await columnExists(all, "equipment", "model_file_size"))) {
    await run("ALTER TABLE equipment ADD COLUMN model_file_size INTEGER");
  }

  if (!(await columnExists(all, "equipment", "model_file_hash"))) {
    await run("ALTER TABLE equipment ADD COLUMN model_file_hash TEXT");
  }

  await run(`
    CREATE TABLE IF NOT EXISTS scan_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipment_id TEXT NOT NULL,
      viewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ip TEXT,
      user_agent TEXT,
      route TEXT,
      FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE
    )
  `);

  await run("CREATE INDEX IF NOT EXISTS idx_scan_logs_equipment ON scan_logs(equipment_id)");
  await run("CREATE INDEX IF NOT EXISTS idx_equipment_specialty_sort ON equipment(specialty_id, sort_order)");
}

module.exports = { migrateSchema };
