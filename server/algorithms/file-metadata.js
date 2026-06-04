const crypto = require("crypto");
const fs = require("fs");
const fsp = require("fs/promises");

/**
 * Вычисление modelFileSize и modelFileHash для загруженного GLB (модуль 3).
 */
async function computeFileMetadata(filePath) {
  const buffer = await fsp.readFile(filePath);
  const modelFileSize = buffer.length;
  const modelFileHash = crypto.createHash("sha256").update(buffer).digest("hex");
  return { modelFileSize, modelFileHash };
}

function computeFileMetadataSync(filePath) {
  const buffer = fs.readFileSync(filePath);
  return {
    modelFileSize: buffer.length,
    modelFileHash: crypto.createHash("sha256").update(buffer).digest("hex"),
  };
}

module.exports = {
  computeFileMetadata,
  computeFileMetadataSync,
};
