const fs = require("node:fs/promises");
const path = require("node:path");
const { NodeIO } = require("@gltf-transform/core");
const { ALL_EXTENSIONS } = require("@gltf-transform/extensions");
const { metalRough } = require("@gltf-transform/functions");

function usesSpecularGlossiness(document) {
  const root = document.getRoot();
  for (const material of root.listMaterials()) {
    if (material.getExtension("KHR_materials_pbrSpecularGlossiness")) {
      return true;
    }
  }

  return false;
}

/**
 * Converts deprecated spec/gloss GLB materials to metal/rough so model-viewer
 * (three.js r15x+) can render textures instead of a flat white mesh.
 */
async function normalizeGlbInPlace(filePath) {
  const absolutePath = path.resolve(filePath);
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const document = await io.read(absolutePath);

  if (!usesSpecularGlossiness(document)) {
    return { converted: false, reason: "no-spec-gloss" };
  }

  await document.transform(metalRough({ keepSpecular: false }));
  const tempPath = `${absolutePath}.tmp.glb`;
  await io.write(tempPath, document);
  await fs.rename(tempPath, absolutePath);

  return { converted: true, reason: "spec-gloss-to-metalrough" };
}

module.exports = { normalizeGlbInPlace, usesSpecularGlossiness };
