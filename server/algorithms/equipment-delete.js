const path = require("path");
const fsp = require("fs/promises");

/**
 * Алгоритм модуля 6: каскадное удаление экспоната (Приложение Е).
 * SCAN_LOGS удаляются по ON DELETE CASCADE; GLB — с диска.
 */

async function deleteEquipmentCascade({ run, get, modelsPublicDir, equipmentId }) {
  const existing = await get("SELECT id, model FROM equipment WHERE id = ?", [equipmentId]);
  if (!existing) {
    return null;
  }

  await run("DELETE FROM equipment WHERE id = ?", [equipmentId]);

  if (existing.model && existing.model.startsWith("/models/")) {
    const filePath = path.join(modelsPublicDir, path.basename(existing.model));
    await fsp.unlink(filePath).catch(() => {});
  }

  return { id: equipmentId, deleted: true };
}

module.exports = {
  deleteEquipmentCascade,
};
