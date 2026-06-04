const MODEL_VIEWER_ENVIRONMENT =
  "https://modelviewer.dev/shared-assets/environments/neutral.hdr";

function configureModelViewer(element) {
  if (!element) {
    return;
  }

  element.setAttribute("environment-image", MODEL_VIEWER_ENVIRONMENT);
  element.setAttribute("skybox-image", MODEL_VIEWER_ENVIRONMENT);
  element.setAttribute("exposure", "1.15");
  element.setAttribute("shadow-intensity", "1");
  element.setAttribute("tone-mapping", "commerce");
}

window.configureModelViewer = configureModelViewer;
