/**
 * Cache-bust URL for self-hosted GLB so browsers reload after normalize/reupload.
 */
function equipmentModelUrl(model, modelFileHash) {
  const value = String(model || "").trim();
  if (!value) {
    return value;
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  const base = value.split("?")[0];
  const encodedBase = encodeURI(base);
  if (!modelFileHash) {
    return encodedBase;
  }

  const version = String(modelFileHash).slice(0, 16);
  return `${encodedBase}?v=${version}`;
}

module.exports = { equipmentModelUrl };
