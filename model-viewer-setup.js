/**
 * Освещение для <model-viewer>.
 * Используем встроенный пресет legacy — он стабильнее для учебных GLB, чем HDR.
 */

function useBuiltinLighting(element) {
  element.setAttribute("environment-image", "legacy");
  element.removeAttribute("skybox-image");
  element.setAttribute("exposure", "1");
  element.setAttribute("shadow-intensity", "1");
  element.setAttribute("tone-mapping", "aces");
  element.setAttribute("environment-intensity", "1");
}

function configureModelViewer(element) {
  if (!element) {
    return;
  }

  useBuiltinLighting(element);
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

function modelLooksUntextured(element) {
  const root = element.model || element.scene;
  if (!root || typeof root.traverse !== "function") {
    return false;
  }

  let meshCount = 0;
  let texturedMeshes = 0;

  root.traverse((node) => {
    if (!node.isMesh || !node.material) {
      return;
    }

    meshCount += 1;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    if (materials.some((material) => material?.map)) {
      texturedMeshes += 1;
    }
  });

  return meshCount > 0 && texturedMeshes === 0;
}

async function applyLighting(element) {
  configureModelViewer(element);

  try {
    await element.updateComplete;
  } catch {
    // первый кадр до загрузки модели
  }

  fixModelMaterials(element);
  requestAnimationFrame(() => fixModelMaterials(element));
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

async function setModelViewerSrc(element, modelUrl) {
  if (!element || !modelUrl) {
    return;
  }

  applyModelCrossOrigin(element, modelUrl);
  configureModelViewer(element);

  const previousSrc = element.getAttribute("src");
  if (previousSrc && previousSrc !== modelUrl) {
    element.removeAttribute("src");
    try {
      await element.updateComplete;
    } catch {
      // ignore between loads
    }
  }

  element.setAttribute("src", modelUrl);
}

window.configureModelViewer = configureModelViewer;
window.bindModelViewerLighting = bindModelViewerLighting;
window.applyModelCrossOrigin = applyModelCrossOrigin;
window.setModelViewerSrc = setModelViewerSrc;
window.modelLooksUntextured = modelLooksUntextured;
window.fixModelMaterials = fixModelMaterials;
