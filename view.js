const params = new URLSearchParams(window.location.search);
const equipmentId = (params.get("id") || "").trim();
const viewType = document.querySelector("#view-type");
const viewTitle = document.querySelector("#view-title");
const viewModelHost = document.querySelector("#view-model-host");
const viewFallback = document.querySelector("#view-fallback");
const viewError = document.querySelector("#view-error");
let viewModel = null;
const webglSupported = supportsWebGL();

function supportsWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext("webgl2") ||
          canvas.getContext("webgl") ||
          canvas.getContext("experimental-webgl")),
    );
  } catch {
    return false;
  }
}

function createViewModel() {
  if (!webglSupported || !viewModelHost) {
    return null;
  }

  if (viewModel) {
    return viewModel;
  }

  const viewer = document.createElement("model-viewer");
  viewer.id = "view-model";
  viewer.setAttribute("camera-controls", "");
  viewer.setAttribute("touch-action", "pan-y");
  viewer.setAttribute("auto-rotate", "");
  viewer.setAttribute("rotation-per-second", "12deg");
  viewer.setAttribute("alt", "");
  viewModelHost.append(viewer);
  viewModel = viewer;
  return viewModel;
}

function showError(message) {
  document.body.classList.add("is-error");
  viewError.hidden = false;
  viewError.textContent = message;
  viewTitle.textContent = "Модель недоступна";
}

function showWebGLFallback(equipment) {
  if (equipment) {
    viewType.textContent = equipment.type || "";
    viewTitle.textContent = equipment.title;
  }
  if (viewFallback) {
    viewFallback.hidden = false;
  }
  viewError.hidden = false;
  viewError.textContent = "WebGL выключен или заблокирован браузером, поэтому GLB-модель не может быть показана.";
}

async function init() {
  if (!equipmentId) {
    showError("В адресе не указан идентификатор модели (?id=…).");
    return;
  }

  try {
    const response = await fetch(`/api/equipment/${encodeURIComponent(equipmentId)}`, { cache: "no-store" });
    if (!response.ok) {
      showError("Объект не найден в каталоге.");
      return;
    }

    const equipment = await response.json();
    viewType.textContent = equipment.type || "";
    viewTitle.textContent = equipment.title;

    const viewer = createViewModel();
    if (!viewer) {
      showWebGLFallback(equipment);
      return;
    }

    if (typeof bindModelViewerLighting === "function") {
      bindModelViewerLighting(viewer);
    } else {
      configureModelViewer(viewer);
    }

    viewer.alt = equipment.title;
    if (typeof setModelViewerSrc === "function") {
      await setModelViewerSrc(viewer, equipment.model);
    } else {
      if (typeof applyModelCrossOrigin === "function") {
        applyModelCrossOrigin(viewer, equipment.model);
      }
      viewer.src = equipment.model;
    }
  } catch (error) {
    showError("Не удалось загрузить модель. Проверьте подключение к серверу.");
  }
}

init();
