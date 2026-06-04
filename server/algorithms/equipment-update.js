const path = require("path");
const fsp = require("fs/promises");
const { computeFileMetadata } = require("./file-metadata");
const { withTransaction } = require("./equipment-create");

/**
 * Алгоритм модуля 4: обновление карточки экспоната (Приложение Г).
 */

async function removeUploadedModelFile(modelsPublicDir, modelUrl) {
  if (!modelUrl || !modelUrl.startsWith("/models/")) {
    return;
  }
  const filePath = path.join(modelsPublicDir, path.basename(modelUrl));
  await fsp.unlink(filePath).catch(() => {});
}

async function updateEquipmentRecord({
  run,
  get,
  modelsPublicDir,
  equipmentId,
  body,
  newModelPathOnDisk,
  newModelPublicPath,
}) {
  return withTransaction(run, async () => {
    const existing = await get(
      `SELECT id, model FROM equipment WHERE id = ?`,
      [equipmentId],
    );
    if (!existing) {
      throw new Error("NOT_FOUND");
    }

    let model = newModelPublicPath || body.model || existing.model;
    let modelFileSize = body.modelFileSize ?? null;
    let modelFileHash = body.modelFileHash ?? null;

    if (newModelPathOnDisk && newModelPublicPath) {
      const meta = await computeFileMetadata(newModelPathOnDisk);
      modelFileSize = meta.modelFileSize;
      modelFileHash = meta.modelFileHash;
      model = newModelPublicPath;
      await removeUploadedModelFile(modelsPublicDir, existing.model);
    }

    const sortOrder = Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0;

    await run(
      `UPDATE equipment
       SET specialty_id = ?,
           title = ?,
           type = ?,
           short = ?,
           description = ?,
           features_json = ?,
           model = ?,
           environment = ?,
           variant = ?,
           hotspots_json = ?,
           sort_order = ?,
           model_file_size = ?,
           model_file_hash = ?
       WHERE id = ?`,
      [
        body.specialtyId,
        body.title,
        body.type,
        body.short,
        body.description,
        JSON.stringify(body.features || []),
        model,
        body.environment,
        body.variant,
        JSON.stringify(body.hotspots || []),
        sortOrder,
        modelFileSize,
        modelFileHash,
        equipmentId,
      ],
    );

    return {
      id: equipmentId,
      title: body.title,
      model,
      modelFileSize,
      modelFileHash,
    };
  });
}

module.exports = {
  updateEquipmentRecord,
  removeUploadedModelFile,
};
