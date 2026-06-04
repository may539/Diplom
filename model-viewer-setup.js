/**
 * Освещение для <model-viewer>.
 * Файл neutral.hdr на сервере подгружается автоматически — скачивать его вручную не нужно.
 */
const LOCAL_HDR = "/environments/neutral.hdr";
const REMOTE_HDR = "https://modelviewer.dev/shared-assets/environments/neutral.hdr";

function resolveLocalHdrUrl() {
  if (typeof window === "undefined" || !window.location?.origin) {
    return REMOTE_HDR;
  }
  return new URL(LOCAL_HDR, window.location.origin).href;
}

function useBuiltinLighting(element) {
  element.setAttribute("environment-image", "legacy");
  element.removeAttribute("skybox-image");
  element.setAttribute("exposure", "1");
  element.setAttribute("shadow-intensity", "1");
  element.setAttribute("tone-mapping", "aces");
  element.setAttribute("environment-intensity", "1");
}

function useHdrLighting(element, hdrUrl) {
  element.setAttribute("environment-image", hdrUrl);
  element.removeAttribute("skybox-image");
  element.setAttribute("exposure", "1");
  element.setAttribute("shadow-intensity", "1");
  element.setAttribute("tone-mapping", "aces");
  element.setAttribute("environment-intensity", "1.1");
}

function configureModelViewer(element) {
  if (!element) {
    return;
  }

  useBuiltinLighting(element);

  const hdrUrl = resolveLocalHdrUrl();
  fetch(hdrUrl, { method: "HEAD" })
    .then((response) => {
      if (!response.ok) {
        return;
      }
      useHdrLighting(element, hdrUrl);
    })
    .catch(() => {
      /* Остаётся встроенное legacy-освещение */
    });
}

function fixModelMaterials(element) {
  const root = element.model || element.scene;
  if (!root || typeof root.traverse !== "function") {
    return;
  }

  root.traverse((node) => {
    if (!node.isMesh || !node.material) {
      return;
    }

    const materials = Array.isArray(node.material) ? node.material : [node.material];
    materials.forEach((material) => {
      ["map", "emissiveMap", "normalMap", "roughnessMap", "metalnessMap", "aoMap"].forEach((key) => {
        const texture = material[key];
        if (texture && "colorSpace" in texture) {
          texture.colorSpace = "srgb";
        }
      });

      if ("metalness" in material && material.metalness > 0.95) {
        material.metalness = 0.8;
      }
      if ("roughness" in material && material.roughness < 0.08) {
        material.roughness = 0.4;
      }

      if ("aoMap" in material && material.aoMapIntensity > 0.9) {
        material.aoMapIntensity = 0.6;
      }

      material.needsUpdate = true;
    });
  });
}

async function applyLighting(element) {
  configureModelViewer(element);

  try {
    await element.updateComplete;
  } catch {
    // первый кадр до загрузки модели
  }

  fixModelMaterials(element);
}

function bindModelViewerLighting(element) {
  if (!element) {
    return;
  }

  if (element.dataset.lightingBound !== "1") {
    element.dataset.lightingBound = "1";
    configureModelViewer(element);

    element.addEventListener("load", () => {
      applyLighting(element);
    });
  }
}

function applyModelCrossOrigin(element, modelUrl) {
  if (!element || !modelUrl) {
    return;
  }

  const isExternal = /^https?:\/\//i.test(String(modelUrl));
  if (isExternal) {
    element.setAttribute("crossorigin", "anonymous");
  } else {
    element.removeAttribute("crossorigin");
  }
}

window.configureModelViewer = configureModelViewer;
window.bindModelViewerLighting = bindModelViewerLighting;
window.applyModelCrossOrigin = applyModelCrossOrigin;
