const ENVIRONMENT_URLS = [
  "/environments/neutral.hdr",
  "https://modelviewer.dev/shared-assets/environments/neutral.hdr",
];

function resolveEnvironmentUrl() {
  if (typeof window !== "undefined" && window.location?.origin) {
    return new URL(ENVIRONMENT_URLS[0], window.location.origin).href;
  }
  return ENVIRONMENT_URLS[1];
}

function configureModelViewer(element) {
  if (!element) {
    return;
  }

  element.setAttribute("crossorigin", "anonymous");
  element.setAttribute("environment-image", resolveEnvironmentUrl());
  element.removeAttribute("skybox-image");
  element.setAttribute("exposure", "1");
  element.setAttribute("shadow-intensity", "1");
  element.setAttribute("tone-mapping", "aces");
  element.setAttribute("environment-intensity", "1.2");
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
        material.metalness = 0.85;
      }
      if ("roughness" in material && material.roughness < 0.05) {
        material.roughness = 0.35;
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
    // updateComplete may reject before first model load
  }

  fixModelMaterials(element);

  if (typeof element.jumpCameraToGoal === "function") {
    element.jumpCameraToGoal();
  }
}

function bindModelViewerLighting(element) {
  if (!element || element.dataset.lightingBound === "1") {
    return;
  }

  element.dataset.lightingBound = "1";
  configureModelViewer(element);

  element.addEventListener("load", () => {
    applyLighting(element);
  });

  element.addEventListener("poster-dismissed", () => {
    applyLighting(element);
  });

  element.addEventListener("error", () => {
    const fallback = ENVIRONMENT_URLS[1];
    if (element.getAttribute("environment-image") !== fallback) {
      element.setAttribute("environment-image", fallback);
    }
  });

  if (element.loaded || element.model) {
    applyLighting(element);
  }
}

window.configureModelViewer = configureModelViewer;
window.bindModelViewerLighting = bindModelViewerLighting;
