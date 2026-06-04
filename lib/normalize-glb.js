const fs = require("node:fs/promises");
const path = require("node:path");
const { NodeIO } = require("@gltf-transform/core");
const { ALL_EXTENSIONS } = require("@gltf-transform/extensions");
const { dedup, metalRough, prune } = require("@gltf-transform/functions");

function extensionNames(document) {
  const names = new Set();
  for (const ext of document.getRoot().listExtensionsUsed()) {
    if (ext && ext.extensionName) {
      names.add(ext.extensionName);
    }
  }
  return [...names].sort();
}

function inspectGlb(document) {
  const root = document.getRoot();
  let materialCount = 0;
  let texturedMaterials = 0;
  let specGlossMaterials = 0;
  let unlitMaterials = 0;

  for (const material of root.listMaterials()) {
    materialCount += 1;
    if (material.getBaseColorTexture()) {
      texturedMaterials += 1;
    }
    if (material.getExtension("KHR_materials_pbrSpecularGlossiness")) {
      specGlossMaterials += 1;
    }
    if (material.getExtension("KHR_materials_unlit")) {
      unlitMaterials += 1;
    }
  }

  return {
    materialCount,
    texturedMaterials,
    specGlossMaterials,
    unlitMaterials,
    extensions: extensionNames(document),
  };
}

/**
 * Repairs GLB for model-viewer: spec/gloss → metal/rough, dedup, prune.
 */
async function normalizeGlbInPlace(filePath) {
  const absolutePath = path.resolve(filePath);
  const backupPath = `${absolutePath}.bak`;
  const tempPath = `${absolutePath}.tmp.glb`;

  try {
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
    const document = await io.read(absolutePath);
    const before = inspectGlb(document);

    await document.transform(dedup(), prune());

    if (before.specGlossMaterials > 0) {
      try {
        await document.transform(metalRough({ keepSpecular: false }));
      } catch (error) {
        return {
          converted: false,
          reason: "metalrough-failed",
          message: `Не удалось перекодировать материалы: ${error.message}`,
          before,
          after: inspectGlb(document),
        };
      }
    }

    const after = inspectGlb(document);

    await fs.copyFile(absolutePath, backupPath);
    try {
      await io.write(tempPath, document);
      await fs.rename(tempPath, absolutePath);
      await fs.unlink(backupPath).catch(() => {});
    } catch (writeError) {
      await fs.copyFile(backupPath, absolutePath).catch(() => {});
      await fs.unlink(tempPath).catch(() => {});
      throw writeError;
    }

    const converted = before.specGlossMaterials > 0;
    let reason = "no-changes";
    let message = "Формат уже metal/rough, конвертация spec/gloss не требовалась.";

    if (converted) {
      reason = "spec-gloss-to-metalrough";
      message = "Материалы spec/gloss перекодированы. Обновите главную с Ctrl+F5.";
    }

    if (after.texturedMaterials === 0) {
      reason = "no-textures-in-glb";
      message = converted
        ? "Материалы перекодированы, но в GLB нет рабочих текстур. Экспортируйте заново с встроенными картинками."
        : "В файле нет текстур. Нужен GLB с встроенными картинками, не только белая геометрия.";
    }

    return {
      converted,
      reason,
      message,
      before,
      after,
    };
  } catch (error) {
    await fs.unlink(tempPath).catch(() => {});
    return {
      converted: false,
      reason: "error",
      message: error.message || "Не удалось прочитать или записать GLB.",
      before: null,
      after: null,
    };
  }
}

module.exports = { normalizeGlbInPlace, inspectGlb };
