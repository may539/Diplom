const params = new URLSearchParams(window.location.search);
const equipmentId = (params.get("id") || "").trim();
const isScanMode = params.get("scan") === "1";

if (isScanMode) {
  document.body.classList.add("view-page--scan");
}

const viewType = document.querySelector("#view-type");
const viewTitle = document.querySelector("#view-title");
const viewModel = document.querySelector("#view-model");
const viewError = document.querySelector("#view-error");

function showError(message) {
  document.body.classList.add("is-error");
  viewError.hidden = false;
  viewError.textContent = message;
  viewTitle.textContent = "Модель недоступна";
}

async function ensureModelViewerReady() {
  if (!viewModel || !window.customElements?.whenDefined) {
    return Boolean(viewModel);
  }

  try {
    await window.customElements.whenDefined("model-viewer");
    return true;
  } catch {
    return false;
  }
}

async function init() {
  if (!equipmentId) {
    showError("В адресе не указан идентификатор модели (?id=…).");
    return;
  }

  const ready = await ensureModelViewerReady();
  if (!ready) {
    showError("Не удалось инициализировать 3D-просмотр.");
    return;
  }

  if (typeof bindModelViewerLighting === "function") {
    bindModelViewerLighting(viewModel);
  } else {
    configureModelViewer(viewModel);
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
    viewModel.alt = equipment.title;
    if (typeof setModelViewerSrc === "function") {
      await setModelViewerSrc(viewModel, equipment.model);
    } else {
      if (typeof applyModelCrossOrigin === "function") {
        applyModelCrossOrigin(viewModel, equipment.model);
      }
      viewModel.src = equipment.model;
    }
  } catch (error) {
    showError("Не удалось загрузить модель. Проверьте подключение к серверу.");
  }
}

init();
