const fs = require("node:fs/promises");
const path = require("node:path");
const { NodeIO } = require("@gltf-transform/core");
const { ALL_EXTENSIONS } = require("@gltf-transform/extensions");
const { dedup, metalRough, prune } = require("@gltf-transform/functions");

function inspectGlb(document) {
  const root = document.getRoot();
  let materialCount = 0;
  let texturedMaterials = 0;
  let specGlossMaterials = 0;
  let unlitMaterials = 0;
  const extensions = new Set();

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

  for (const ext of root.listExtensionsUsed()) {
    extensions.add(ext);
  }

  return {
    materialCount,
    texturedMaterials,
    specGlossMaterials,
    unlitMaterials,
    extensions: [...extensions].sort(),
  };
}

/**
 * Repairs GLB for model-viewer: spec/gloss → metal/rough, dedup, prune.
 * Returns diagnostics so the UI can explain when the mesh stays white.
 */
async function normalizeGlbInPlace(filePath) {
  const absolutePath = path.resolve(filePath);
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const document = await io.read(absolutePath);
  const before = inspectGlb(document);

  await document.transform(dedup(), prune());

  if (before.specGlossMaterials > 0) {
    await document.transform(metalRough({ keepSpecular: false }));
  }

  const after = inspectGlb(document);
  const tempPath = `${absolutePath}.tmp.glb`;
  await io.write(tempPath, document);
  await fs.rename(tempPath, absolutePath);

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
      ? "Материалы перекодированы, но в GLB нет рабочих текстур. Экспортируйте заново с встроенными картинками (Apply Modifiers, + текстуры)."
      : "В файле нет текстур. Нужен GLB с встроенными картинками, не только белая геометрия.";
  }

  return {
    converted,
    reason,
    message,
    before,
    after,
  };
}

module.exports = { normalizeGlbInPlace, inspectGlb };
