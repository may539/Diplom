const MODEL_VIEWER_ENVIRONMENT =
  "https://modelviewer.dev/shared-assets/environments/neutral.hdr";

function configureModelViewer(element) {
  if (!element) {
    return;
  }

  element.setAttribute("environment-image", MODEL_VIEWER_ENVIRONMENT);
  element.setAttribute("skybox-image", MODEL_VIEWER_ENVIRONMENT);
  element.setAttribute("exposure", "1.25");
  element.setAttribute("shadow-intensity", "1");
  element.setAttribute("tone-mapping", "commerce");
  element.setAttribute("environment-intensity", "1");
}

function bindModelViewerLighting(element) {
  if (!element || element.dataset.lightingBound === "1") {
    return;
  }

  element.dataset.lightingBound = "1";
  const apply = () => configureModelViewer(element);
  element.addEventListener("load", apply);
  element.addEventListener("poster-dismissed", apply);
  apply();
}

window.configureModelViewer = configureModelViewer;
window.bindModelViewerLighting = bindModelViewerLighting;
