const specialtyGrid = document.querySelector("#specialty-grid");
const equipmentList = document.querySelector("#equipment-list");
const activeSpecialtyLabel = document.querySelector("#active-specialty-label");
const equipmentCount = document.querySelector("#equipment-count");
const equipmentType = document.querySelector("#equipment-type");
const equipmentTitle = document.querySelector("#equipment-title");
const equipmentDescription = document.querySelector("#equipment-description");
const equipmentFeatures = document.querySelector("#equipment-features");
const modelLink = document.querySelector("#model-link");
const localViewer = document.querySelector("#local-viewer");
const localScene = document.querySelector("#local-scene");
const equipmentShape = document.querySelector("#equipment-shape");
const hotspotLayer = document.querySelector("#hotspot-layer");
const annotationPanel = document.querySelector("#annotation-panel");
const wireframeToggle = document.querySelector("#wireframe-toggle");
const zoomOutButton = document.querySelector("#zoom-out");
const zoomInButton = document.querySelector("#zoom-in");
const zoomResetButton = document.querySelector("#zoom-reset");
const qrModal = document.querySelector("#qr-modal");
const qrImage = document.querySelector("#qr-image");
const qrCaption = document.querySelector("#qr-caption");
const qrDirectLink = document.querySelector("#qr-direct-link");
const qrButtons = document.querySelectorAll("#qr-open, #qr-open-secondary");
const modelViewerEl = document.querySelector("#model-viewer");
const isFileMode = window.location.protocol === "file:";

let specialties = [];
let activeSpecialtyId = "";
let activeEquipmentId = "";
let activeHotspotIndex = 0;
let isWireframe = false;
let isDragging = false;
let lastPointer = { x: 0, y: 0 };
let rotation = { x: -22, y: 38 };
let zoom = 1;
const ZOOM_MIN = 0.7;
const ZOOM_MAX = 1.8;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function allEquipment() {
  return specialties.flatMap((specialty) =>
    specialty.equipment.map((equipment) => ({
      ...equipment,
      specialtyId: specialty.id,
    })),
  );
}

function findSpecialty(id) {
  return specialties.find((specialty) => specialty.id === id) || specialties[0];
}

function findEquipment(id) {
  for (const specialty of specialties) {
    const equipment = specialty.equipment.find((item) => item.id === id);
    if (equipment) {
      return { specialty, equipment };
    }
  }

  return {
    specialty: specialties[0],
    equipment: specialties[0].equipment[0],
  };
}

function equipmentPath(equipmentId) {
  return `/equipment/${encodeURIComponent(equipmentId)}`;
}

function readEquipmentIdFromLocation() {
  const pathMatch = window.location.pathname.match(/^\/equipment\/([^/]+)$/);
  const hashParams = new URLSearchParams(window.location.hash.replace("#", ""));
  const searchParams = new URLSearchParams(window.location.search);

  if (pathMatch) {
    return decodeURIComponent(pathMatch[1]);
  }

  return (
    searchParams.get("id") ||
    searchParams.get("equipment") ||
    hashParams.get("id") ||
    hashParams.get("equipment")
  );
}

function setEquipmentRoute(equipmentId, mode = "push") {
  if (isFileMode) {
    const nextHash = `equipment=${equipmentId}`;

    if (window.location.hash.replace("#", "") === nextHash) {
      return;
    }

    history[mode === "replace" ? "replaceState" : "pushState"](null, "", `#${nextHash}`);
    return;
  }

  const nextPath = equipmentPath(equipmentId);

  if (window.location.pathname === nextPath && !window.location.search && !window.location.hash) {
    return;
  }

  history[mode === "replace" ? "replaceState" : "pushState"](null, "", nextPath);
}

function setViewerTransform() {
  localScene.style.setProperty("--viewer-rx", `${rotation.x}deg`);
  localScene.style.setProperty("--viewer-ry", `${rotation.y}deg`);
  localScene.style.setProperty("--viewer-scale", zoom.toFixed(3));
}

function syncZoomControls() {
  if (!zoomResetButton) return;
  zoomResetButton.textContent = `${Math.round(zoom * 100)}%`;
  zoomOutButton.disabled = zoom <= ZOOM_MIN + 0.001;
  zoomInButton.disabled = zoom >= ZOOM_MAX - 0.001;
}

function setZoom(nextZoom) {
  zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, nextZoom));
  setViewerTransform();
  syncZoomControls();
}

function renderSpecialties() {
  specialtyGrid.innerHTML = specialties
    .map(
      (specialty) => `
        <button class="specialty-card" type="button" data-specialty="${escapeHtml(specialty.id)}">
          <span class="specialty-card__code">${escapeHtml(specialty.code)}</span>
          <h3>${escapeHtml(specialty.title)}</h3>
          <p>${escapeHtml(specialty.description)}</p>
        </button>
      `,
    )
    .join("");
}

function renderEquipmentList(specialty) {
  activeSpecialtyLabel.textContent = specialty.code;
  equipmentCount.textContent = `${specialty.equipment.length} объекта`;

  equipmentList.innerHTML = specialty.equipment
    .map(
      (equipment) => `
        <button class="equipment-button" type="button" data-equipment="${escapeHtml(equipment.id)}">
          <strong>${escapeHtml(equipment.title)}</strong>
          <span>${escapeHtml(equipment.short)}</span>
        </button>
      `,
    )
    .join("");
}

function renderAnnotation(hotspots, index) {
  const hotspot = hotspots[index];

  activeHotspotIndex = index;
  annotationPanel.innerHTML = hotspot
    ? `<strong>${escapeHtml(hotspot.label)}</strong><span>${escapeHtml(hotspot.note)}</span>`
    : "<span>Для этой модели аннотации не добавлены.</span>";

  hotspotLayer.querySelectorAll("[data-hotspot-index]").forEach((button) => {
    button.classList.toggle("is-active", Number(button.dataset.hotspotIndex) === index);
  });
}

function renderHotspots(hotspots = []) {
  hotspotLayer.innerHTML = hotspots
    .map(
      (hotspot, index) => `
        <button
          class="hotspot"
          type="button"
          data-hotspot-index="${index}"
          style="--x: ${Number(hotspot.x)}%; --y: ${Number(hotspot.y)}%;"
          aria-label="${escapeHtml(hotspot.label)}"
        >
          <span class="hotspot__number">${index + 1}</span>
          <span class="hotspot__label">${escapeHtml(hotspot.label)}</span>
        </button>
      `,
    )
    .join("");

  renderAnnotation(hotspots, 0);
}

function applyModelViewerSource(equipment) {
  if (!modelViewerEl) {
    return;
  }

  const modelSrc = equipment && typeof equipment.model === "string" ? equipment.model : "";

  if (!modelSrc) {
    modelViewerEl.removeAttribute("src");
    modelViewerEl.hidden = true;
    localViewer.classList.remove("has-model");
    return;
  }

  if (modelViewerEl.getAttribute("src") !== modelSrc) {
    modelViewerEl.setAttribute("src", modelSrc);
  }
  modelViewerEl.setAttribute("alt", `Интерактивная 3D-модель: ${equipment.title}`);
  modelViewerEl.hidden = false;
  localViewer.classList.add("has-model");
}

function renderActiveEquipment(equipment) {
  localViewer.setAttribute("aria-label", `Интерактивный 3D макет: ${equipment.title}`);
  equipmentShape.dataset.variant = equipment.variant;
  equipmentType.textContent = equipment.type;
  equipmentTitle.textContent = equipment.title;
  equipmentDescription.textContent = equipment.description;
  modelLink.href = equipment.model;
  equipmentFeatures.innerHTML = equipment.features.map((feature) => `<li>${escapeHtml(feature)}</li>`).join("");
  renderHotspots(equipment.hotspots);
  applyModelViewerSource(equipment);
}

function syncActiveStates() {
  document.querySelectorAll("[data-specialty]").forEach((card) => {
    card.classList.toggle("is-active", card.dataset.specialty === activeSpecialtyId);
  });

  document.querySelectorAll("[data-equipment]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.equipment === activeEquipmentId);
  });
}

function syncWireframe() {
  localViewer.classList.toggle("is-wireframe", isWireframe);
  wireframeToggle.setAttribute("aria-pressed", String(isWireframe));
  wireframeToggle.classList.toggle("is-active", isWireframe);
}

function render() {
  const specialty = findSpecialty(activeSpecialtyId);
  const equipment = specialty.equipment.find((item) => item.id === activeEquipmentId) || specialty.equipment[0];

  activeSpecialtyId = specialty.id;
  activeEquipmentId = equipment.id;
  renderEquipmentList(specialty);
  renderActiveEquipment(equipment);
  syncActiveStates();
  syncWireframe();
}

function initFromLocation() {
  const equipmentId = readEquipmentIdFromLocation();

  if (!equipmentId) {
    activeSpecialtyId = specialties[0].id;
    activeEquipmentId = specialties[0].equipment[0].id;
    return;
  }

  const { specialty, equipment } = findEquipment(equipmentId);
  activeSpecialtyId = specialty.id;
  activeEquipmentId = equipment.id;
}

async function fetchEquipmentFromApi(equipmentId) {
  if (!equipmentId || isFileMode) {
    return null;
  }

  try {
    const response = await fetch(`/api/equipment/${encodeURIComponent(equipmentId)}`);

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    return null;
  }
}

function mergeRemoteEquipment(remote) {
  if (!remote || !remote.id) {
    return;
  }

  const target = findEquipment(remote.id).equipment;
  if (!target || target.id !== remote.id) {
    return;
  }

  const fields = ["title", "type", "short", "description", "model", "environment", "variant"];
  for (const field of fields) {
    if (typeof remote[field] === "string" && remote[field]) {
      target[field] = remote[field];
    }
  }
  if (Array.isArray(remote.features)) {
    target.features = remote.features;
  }
  if (Array.isArray(remote.hotspots)) {
    target.hotspots = remote.hotspots;
  }
}

function buildEquipmentShareUrl(equipmentId) {
  const origin = window.location.origin && window.location.origin !== "null"
    ? window.location.origin
    : `${window.location.protocol}//${window.location.host}`;
  return `${origin}/?id=${encodeURIComponent(equipmentId)}`;
}

function generateQrDataUrl(text) {
  if (typeof window.qrcode !== "function") {
    return null;
  }

  try {
    if (window.qrcode.stringToBytesFuncs && window.qrcode.stringToBytesFuncs["UTF-8"]) {
      window.qrcode.stringToBytes = window.qrcode.stringToBytesFuncs["UTF-8"];
    }
    const qr = window.qrcode(0, "M");
    qr.addData(text);
    qr.make();
    return qr.createDataURL(6, 4);
  } catch (error) {
    return null;
  }
}

async function openQrModal() {
  const { equipment } = findEquipment(activeEquipmentId);
  const shareUrl = buildEquipmentShareUrl(equipment.id);

  qrCaption.textContent = "Генерация QR-кода…";
  qrImage.hidden = false;
  qrImage.removeAttribute("src");
  qrDirectLink.href = shareUrl;
  qrDirectLink.textContent = shareUrl;
  qrModal.classList.add("is-open");
  qrModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");

  if (isFileMode) {
    qrImage.hidden = true;
    qrCaption.textContent =
      "Для корректного QR-кода запустите сервер командой npm start и откройте сайт по сетевому адресу.";
    qrDirectLink.href = "http://localhost:8080";
    qrDirectLink.textContent = "Открыть серверную версию";
    return;
  }

  const localQr = generateQrDataUrl(shareUrl);
  if (localQr) {
    qrImage.src = localQr;
    qrCaption.textContent = `${equipment.title}: отсканируйте код, чтобы открыть эту 3D-модель.`;
    return;
  }

  try {
    const response = await fetch(`/api/qr/${encodeURIComponent(equipment.id)}`);

    if (!response.ok) {
      throw new Error("QR API request failed");
    }

    const qr = await response.json();
    qrImage.src = qr.imageDataUrl;
    qrCaption.textContent = `${qr.title}: отсканируйте код, чтобы открыть эту 3D-модель.`;
    qrDirectLink.href = shareUrl;
    qrDirectLink.textContent = shareUrl;
  } catch (error) {
    qrCaption.textContent = "Не удалось сгенерировать QR-код.";
  }
}

function closeQrModal() {
  qrModal.classList.remove("is-open");
  qrModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function applyInitialViewOptions() {
  const searchParams = new URLSearchParams(window.location.search);
  const scrollToViewer = () => {
    const viewer = document.querySelector("#viewer");
    window.scrollTo({ top: viewer.offsetTop - 16, behavior: "auto" });
  };

  if (searchParams.get("focus") === "viewer") {
    document.body.classList.add("focus-viewer");
  }

  if (searchParams.get("view") === "viewer") {
    scrollToViewer();
    window.setTimeout(scrollToViewer, 250);
  }

  if (searchParams.get("qr") === "1") {
    openQrModal();
  }
}

async function loadData() {
  if (isFileMode && window.EQUIPMENT_DATA) {
    specialties = window.EQUIPMENT_DATA;
  } else {
    try {
      const response = await fetch("/api/specialties");

      if (!response.ok) {
        throw new Error("Specialties API request failed");
      }

      specialties = await response.json();
    } catch (error) {
      if (!window.EQUIPMENT_DATA) {
        throw error;
      }

      specialties = window.EQUIPMENT_DATA;
    }
  }

  if (!specialties.length || !allEquipment().length) {
    throw new Error("Equipment data is empty");
  }
}

specialtyGrid.addEventListener("click", (event) => {
  const card = event.target.closest("[data-specialty]");
  if (!card) return;

  const specialty = findSpecialty(card.dataset.specialty);
  activeSpecialtyId = specialty.id;
  activeEquipmentId = specialty.equipment[0].id;
  setEquipmentRoute(activeEquipmentId);
  render();
  document.querySelector("#viewer").scrollIntoView({ behavior: "smooth", block: "start" });
});

equipmentList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-equipment]");
  if (!button) return;

  const { specialty, equipment } = findEquipment(button.dataset.equipment);
  activeSpecialtyId = specialty.id;
  activeEquipmentId = equipment.id;
  setEquipmentRoute(equipment.id);
  render();
});

hotspotLayer.addEventListener("click", (event) => {
  const hotspot = event.target.closest("[data-hotspot-index]");
  if (!hotspot) return;

  event.stopPropagation();
  const { equipment } = findEquipment(activeEquipmentId);
  renderAnnotation(equipment.hotspots || [], Number(hotspot.dataset.hotspotIndex));
});

hotspotLayer.addEventListener("pointerdown", (event) => {
  if (event.target.closest("[data-hotspot-index]")) {
    event.stopPropagation();
  }
});

wireframeToggle.addEventListener("click", () => {
  isWireframe = !isWireframe;
  syncWireframe();
});

qrButtons.forEach((button) => button.addEventListener("click", openQrModal));

qrModal.addEventListener("click", (event) => {
  if (event.target.matches("[data-close-modal]")) {
    closeQrModal();
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeQrModal();
  }
});

let syncScheduled = false;

function syncFromLocation() {
  initFromLocation();

  if (window.location.hash.replace("#", "").startsWith("equipment=")) {
    setEquipmentRoute(activeEquipmentId, "replace");
  }

  render();
}

function scheduleSyncFromLocation() {
  if (syncScheduled) {
    return;
  }

  syncScheduled = true;
  window.requestAnimationFrame(() => {
    syncScheduled = false;
    syncFromLocation();
  });
}

window.addEventListener("hashchange", scheduleSyncFromLocation);
window.addEventListener("popstate", scheduleSyncFromLocation);

localViewer.addEventListener("pointerdown", (event) => {
  if (event.target.closest("[data-hotspot-index], [data-viewer-control]")) {
    return;
  }

  isDragging = true;
  lastPointer = { x: event.clientX, y: event.clientY };
  localViewer.setPointerCapture(event.pointerId);
});

localViewer.addEventListener("pointermove", (event) => {
  if (!isDragging) return;

  const deltaX = event.clientX - lastPointer.x;
  const deltaY = event.clientY - lastPointer.y;
  rotation = {
    x: Math.max(-70, Math.min(12, rotation.x - deltaY * 0.35)),
    y: rotation.y + deltaX * 0.45,
  };
  lastPointer = { x: event.clientX, y: event.clientY };
  setViewerTransform();
});

localViewer.addEventListener("pointerup", (event) => {
  isDragging = false;
  localViewer.releasePointerCapture(event.pointerId);
});

localViewer.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    setZoom(zoom - event.deltaY * 0.0015);
  },
  { passive: false },
);

zoomOutButton.addEventListener("click", () => {
  setZoom(zoom - 0.12);
});

zoomInButton.addEventListener("click", () => {
  setZoom(zoom + 0.12);
});

zoomResetButton.addEventListener("click", () => {
  setZoom(1);
});

async function init() {
  try {
    setZoom(1);
    await loadData();
    initFromLocation();
    renderSpecialties();
    render();
    applyInitialViewOptions();

    const requestedId = readEquipmentIdFromLocation();
    if (requestedId) {
      const remote = await fetchEquipmentFromApi(requestedId);
      if (remote) {
        mergeRemoteEquipment(remote);
        if (activeEquipmentId === remote.id) {
          render();
        }
      }
    }
  } catch (error) {
    specialtyGrid.innerHTML = '<p class="error-state">Не удалось загрузить каталог оборудования.</p>';
    equipmentList.innerHTML = '<p class="error-state">Проверьте запуск Node.js сервера.</p>';
  }
}

init();
