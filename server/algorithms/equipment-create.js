const { computeFileMetadata } = require("./file-metadata");

/**
 * Алгоритм модуля 3: добавление экспоната в транзакции + подготовка URL для QR (Приложение В).
 */

async function withTransaction(run, work) {
  await run("BEGIN IMMEDIATE");
  try {
    const result = await work();
    await run("COMMIT");
    return result;
  } catch (error) {
    await run("ROLLBACK");
    throw error;
  }
}

async function createEquipmentRecord({
  run,
  get,
  slugify,
  body,
  modelPathOnDisk,
  modelPublicPath,
}) {
  return withTransaction(run, async () => {
    const specialty = await get("SELECT id FROM specialties WHERE id = ?", [body.specialtyId]);
    if (!specialty) {
      throw new Error("SPECIALTY_NOT_FOUND");
    }

    let modelFileSize = null;
    let modelFileHash = null;
    if (modelPathOnDisk) {
      const meta = await computeFileMetadata(modelPathOnDisk);
      modelFileSize = meta.modelFileSize;
      modelFileHash = meta.modelFileHash;
    }

    const baseId = slugify(body.title) || "equipment";
    let equipmentId = baseId;
    let suffix = 1;
    while (await get("SELECT id FROM equipment WHERE id = ?", [equipmentId])) {
      suffix += 1;
      equipmentId = `${baseId}-${suffix}`;
    }

    const sortOrder = Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0;

    await run(
      `INSERT INTO equipment
        (id, specialty_id, title, type, short, description, features_json, model,
         environment, variant, hotspots_json, sort_order, model_file_size, model_file_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        equipmentId,
        body.specialtyId,
        body.title,
        body.type,
        body.short,
        body.description,
        JSON.stringify(body.features || []),
        modelPublicPath,
        body.environment,
        body.variant,
        JSON.stringify(body.hotspots || []),
        sortOrder,
        modelFileSize,
        modelFileHash,
      ],
    );

    return {
      id: equipmentId,
      title: body.title,
      model: modelPublicPath,
      modelFileSize,
      modelFileHash,
    };
  });
}

module.exports = {
  withTransaction,
  createEquipmentRecord,
};
