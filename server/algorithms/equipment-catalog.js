/**
 * Алгоритм модуля 2: выборка каталога экспонатов по specialtyId (Приложение Б).
 */

function normalizeEquipmentRow(row, parseJsonArray) {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    short: row.short,
    description: row.description,
    features: parseJsonArray(row.features_json),
    model: row.model,
    environment: row.environment,
    variant: row.variant,
    hotspots: parseJsonArray(row.hotspots_json),
    specialtyId: row.specialty_id,
    sortOrder: row.sort_order ?? 0,
    modelFileSize: row.model_file_size ?? null,
    modelFileHash: row.model_file_hash ?? null,
  };
}

async function listEquipmentBySpecialtyId(all, specialtyId, parseJsonArray) {
  const rows = await all(
    `SELECT
       id,
       specialty_id,
       title,
       type,
       short,
       description,
       features_json,
       model,
       environment,
       variant,
       hotspots_json,
       sort_order,
       model_file_size,
       model_file_hash
     FROM equipment
     WHERE specialty_id = ?
     ORDER BY sort_order ASC, title ASC`,
    [specialtyId],
  );

  return rows.map((row) => normalizeEquipmentRow(row, parseJsonArray));
}

module.exports = {
  listEquipmentBySpecialtyId,
  normalizeEquipmentRow,
};
