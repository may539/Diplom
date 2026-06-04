/**
 * Cache-bust URL for self-hosted GLB so browsers reload after normalize/reupload.
 */
function equipmentModelUrl(model, modelFileHash) {
  const value = String(model || "").trim();
  if (!value) {
    return value;
  }

  if (!modelFileHash || /^https?:\/\//i.test(value)) {
    return value;
  }

  const base = value.split("?")[0];
  const version = String(modelFileHash).slice(0, 16);
  return `${base}?v=${version}`;
}

module.exports = { equipmentModelUrl };
