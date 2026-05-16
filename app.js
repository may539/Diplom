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
const equipmentModelViewer = document.querySelector("#equipment-model-viewer");
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
const isFileMode = window.location.protocol === "file:";

let specialties = [];
let activeSpecialtyId = "";
let activeEquipmentId = "";
let activeEquipmentDetail = null;
let equipmentDetailError = false;
let activeHotspotIndex = 0;
let activeHotspots = [];
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

function findEquipmentStrict(id) {
  for (const specialty of specialties) {
    const equipment = specialty.equipment.find((item) => item.id === id);
    if (equipment) {
      return { specialty, equipment };
    }
  }

  return null;
}

function findEquipment(id) {
  const found = findEquipmentStrict(id);
  if (found) {
    return found;
  }

  return {
    specialty: specialties[0],
    equipment: specialties[0].equipment[0],
  };
}

function buildEquipmentQrUrl(equipmentId) {
  const url = new URL("/", window.location.origin);
  url.searchParams.set("id", equipmentId);
  url.searchParams.set("scan", "1");
  return url.href;
}

function readEquipmentIdFromLocation() {
  const pathMatch = window.location.pathname.match(/^\/equipment\/([^/]+)$/);
  const hashParams = new URLSearchParams(window.location.hash.replace("#", ""));
  const searchParams = new URLSearchParams(window.location.search);

  if (pathMatch) {
    return decodeURIComponent(pathMatch[1]);
  }

  const idParam = searchParams.get("id");
  if (idParam) {
    return idParam;
  }

  return hashParams.get("equipment") || searchParams.get("equipment");
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

  const nextUrl = new URL("/", window.location.origin);
  nextUrl.searchParams.set("id", equipmentId);
  const next = `${nextUrl.pathname}${nextUrl.search}`;

  if (window.location.pathname + window.location.search === next) {
    return;
  }

  history[mode === "replace" ? "replaceState" : "pushState"](null, "", next);
}

function setViewerTransform() {
  localScene.style.setProperty("--viewer-rx", `${rotation.x}deg`);
  localScene.style.setProperty("--viewer-ry", `${rotation.y}deg`);
  localScene.style.setProperty("--viewer-scale", zoom.toFixed(3));
}

function syncZoomControls() {
  if (!zoomResetButton) return;
  const glbMode = Boolean(equipmentModelViewer?.src);
  zoomResetButton.textContent = `${Math.round(zoom * 100)}%`;
  zoomOutButton.disabled = glbMode || zoom <= ZOOM_MIN + 0.001;
  zoomInButton.disabled = glbMode || zoom >= ZOOM_MAX - 0.001;
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
  if (hotspot) {
    annotationPanel.innerHTML = `<strong>${escapeHtml(hotspot.label)}</strong><span>${escapeHtml(hotspot.note)}</span>`;
  } else if (hotspots.length) {
    annotationPanel.innerHTML = "<span>Нажмите на точку на 3D-модели, чтобы открыть пояснение к детали.</span>";
  } else {
    annotationPanel.innerHTML = "<span>Для этой модели аннотации не добавлены.</span>";
  }

  document.querySelectorAll("[data-hotspot-index]").forEach((button) => {
    button.classList.toggle("is-active", Number(button.dataset.hotspotIndex) === index);
    button.setAttribute("aria-expanded", String(Number(button.dataset.hotspotIndex) === index));
  });
}

function hotspotPosition(hotspot, index) {
  if (typeof hotspot.position === "string" && hotspot.position.trim()) {
    return hotspot.position.trim();
  }

  if (Array.isArray(hotspot.position) && hotspot.position.length >= 3) {
    return hotspot.position
      .slice(0, 3)
      .map((value) => `${Number(value) || 0}m`)
      .join(" ");
  }

  const x = Number.isFinite(Number(hotspot.x)) ? Number(hotspot.x) : 50;
  const y = Number.isFinite(Number(hotspot.y)) ? Number(hotspot.y) : 50;
  const modelX = ((x / 100) - 0.5) * 1.2;
  const modelY = (0.5 - y / 100) * 1.2;
  const modelZ = 0.18 + index * 0.03;

  return `${modelX.toFixed(3)}m ${modelY.toFixed(3)}m ${modelZ.toFixed(3)}m`;
}

function hotspotNormal(hotspot) {
  if (typeof hotspot.normal === "string" && hotspot.normal.trim()) {
    return hotspot.normal.trim();
  }

  if (Array.isArray(hotspot.normal) && hotspot.normal.length >= 3) {
    return hotspot.normal
      .slice(0, 3)
      .map((value) => `${Number(value) || 0}m`)
      .join(" ");
  }

  return "0m 0m 1m";
}

function renderModelViewerHotspots(hotspots = []) {
  if (!equipmentModelViewer) {
    return;
  }

  equipmentModelViewer.querySelectorAll("[data-hotspot-index]").forEach((hotspot) => hotspot.remove());
  equipmentModelViewer.insertAdjacentHTML(
    "beforeend",
    hotspots
      .map(
        (hotspot, index) => `
          <button
            class="hotspot hotspot--model"
            type="button"
            slot="hotspot-${index}"
            data-hotspot-index="${index}"
            data-position="${escapeHtml(hotspotPosition(hotspot, index))}"
            data-normal="${escapeHtml(hotspotNormal(hotspot))}"
            aria-label="${escapeHtml(hotspot.label)}"
            aria-expanded="false"
          >
            <span class="hotspot__number">${index + 1}</span>
            <span class="hotspot__popup" role="status">
              <strong>${escapeHtml(hotspot.label)}</strong>
              <span>${escapeHtml(hotspot.note)}</span>
            </span>
          </button>
        `,
      )
      .join(""),
  );
}

function renderHotspots(hotspots = []) {
  activeHotspots = hotspots;
  renderModelViewerHotspots(hotspots);

  if (equipmentModelViewer) {
    hotspotLayer.innerHTML = "";
    renderAnnotation(hotspots, -1);
    return;
  }

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
          <span class="hotspot__popup" role="status">
            <strong>${escapeHtml(hotspot.label)}</strong>
            <span>${escapeHtml(hotspot.note)}</span>
          </span>
        </button>
      `,
    )
    .join("");

  renderAnnotation(hotspots, -1);
}

function renderActiveEquipment(equipment) {
  localViewer.setAttribute("aria-label", `Интерактивная 3D модель: ${equipment.title}`);
  equipmentShape.dataset.variant = equipment.variant || "sensor";
  equipmentType.textContent = equipment.type;
  equipmentTitle.textContent = equipment.title;
  equipmentDescription.textContent = equipment.description;
  modelLink.href = equipment.model;
  modelLink.textContent = "Открыть GLB-источник";
  equipmentFeatures.innerHTML = (equipment.features || []).map((feature) => `<li>${escapeHtml(feature)}</li>`).join("");

  if (equipmentModelViewer) {
    equipmentModelViewer.setAttribute("src", equipment.model);
    equipmentModelViewer.setAttribute("alt", equipment.title);
  }

  renderHotspots(equipment.hotspots || []);
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
  const glbMode = Boolean(equipmentModelViewer?.src);
  wireframeToggle.disabled = glbMode;
  if (glbMode) {
    return;
  }

  localViewer.classList.toggle("is-wireframe", isWireframe);
  wireframeToggle.setAttribute("aria-pressed", String(isWireframe));
  wireframeToggle.classList.toggle("is-active", isWireframe);
}

function renderEquipmentNotFound() {
  equipmentType.textContent = "";
  equipmentTitle.textContent = "Объект не найден";
  equipmentDescription.textContent =
    "Проверьте параметр id в адресе страницы или выберите модель в каталоге слева.";
  equipmentFeatures.innerHTML = "";
  modelLink.href = "#";
  modelLink.textContent = "Открыть GLB-источник";
  annotationPanel.innerHTML = "<span>Нет данных для отображения.</span>";
  activeHotspots = [];
  hotspotLayer.innerHTML = "";

  if (equipmentModelViewer) {
    equipmentModelViewer.querySelectorAll("[data-hotspot-index]").forEach((hotspot) => hotspot.remove());
    equipmentModelViewer.removeAttribute("src");
    equipmentModelViewer.alt = "";
  }

  localViewer.setAttribute("aria-label", "3D модель недоступна");
  syncZoomControls();
}

function render() {
  const strict = findEquipmentStrict(activeEquipmentId);
  if (strict) {
    activeSpecialtyId = strict.specialty.id;
  }

  const specialty = findSpecialty(activeSpecialtyId);
  const catalogEquipment = specialty.equipment.find((item) => item.id === activeEquipmentId);

  let equipment =
    activeEquipmentDetail && activeEquipmentDetail.id === activeEquipmentId
      ? activeEquipmentDetail
      : catalogEquipment;

  if (!equipment && equipmentDetailError) {
    renderEquipmentList(specialty);
    renderEquipmentNotFound();
    syncActiveStates();
    syncWireframe();
    syncZoomControls();
    return;
  }

  if (!equipment) {
    equipment = specialty.equipment[0];
    activeEquipmentId = equipment.id;
    activeEquipmentDetail = null;
    equipmentDetailError = false;
  }

  renderEquipmentList(specialty);
  renderActiveEquipment(equipment);
  syncActiveStates();
  syncWireframe();
  syncZoomControls();
}

function initFromLocation() {
  const equipmentId = readEquipmentIdFromLocation();

  if (!equipmentId) {
    activeSpecialtyId = specialties[0].id;
    activeEquipmentId = specialties[0].equipment[0].id;
    activeEquipmentDetail = null;
    equipmentDetailError = false;
    return;
  }

  const found = findEquipmentStrict(equipmentId);
  if (found) {
    activeSpecialtyId = found.specialty.id;
    activeEquipmentId = found.equipment.id;
    activeEquipmentDetail = null;
    equipmentDetailError = false;
    return;
  }

  activeSpecialtyId = specialties[0].id;
  activeEquipmentId = equipmentId;
  activeEquipmentDetail = null;
  equipmentDetailError = false;
}

async function refreshActiveEquipmentFromApi() {
  const id = activeEquipmentId;
  equipmentDetailError = false;

  if (isFileMode) {
    const { equipment } = findEquipment(id);
    activeEquipmentDetail = { ...equipment };
    return;
  }

  try {
    const response = await fetch(`/api/equipment/${encodeURIComponent(id)}`);

    if (!response.ok) {
      activeEquipmentDetail = null;
      equipmentDetailError = true;
      return;
    }

    const data = await response.json();
    if (id !== activeEquipmentId) {
      return;
    }

    activeEquipmentDetail = data;
    equipmentDetailError = false;
  } catch {
    activeEquipmentDetail = null;
    equipmentDetailError = true;
  }
}

async function openQrModal() {
  const equipment =
    activeEquipmentDetail && activeEquipmentDetail.id === activeEquipmentId
      ? activeEquipmentDetail
      : findEquipment(activeEquipmentId).equipment;

  qrCaption.textContent = "Генерация QR-кода...";
  qrImage.hidden = false;
  qrImage.removeAttribute("src");
  qrDirectLink.removeAttribute("href");
  qrDirectLink.textContent = "";
  qrModal.classList.add("is-open");
  qrModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");

  if (isFileMode) {
    qrImage.hidden = true;
    qrCaption.textContent =
      "Для корректного QR-кода запустите сервер командой npm start и откройте http://localhost:8080.";
    qrDirectLink.href = "http://localhost:8080";
    qrDirectLink.textContent = "Открыть серверную версию";
    return;
  }

  const url = buildEquipmentQrUrl(equipment.id);
  const QRCodeGlobal = window.QRCode;

  if (!QRCodeGlobal || typeof QRCodeGlobal.toDataURL !== "function") {
    qrCaption.textContent = "Не удалось загрузить библиотеку QR-кода.";
    return;
  }

  try {
    const imageDataUrl = await QRCodeGlobal.toDataURL(url, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 240,
    });

    qrImage.src = imageDataUrl;
    qrCaption.textContent = `${equipment.title}: отсканируйте код, чтобы открыть эту 3D-модель.`;
    qrDirectLink.href = url;
    qrDirectLink.textContent = url;
  } catch (error) {
    qrCaption.textContent = "Не удалось сформировать QR-код.";
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

specialtyGrid.addEventListener("click", async (event) => {
  const card = event.target.closest("[data-specialty]");
  if (!card) return;

  const specialty = findSpecialty(card.dataset.specialty);
  activeSpecialtyId = specialty.id;
  activeEquipmentId = specialty.equipment[0].id;
  setEquipmentRoute(activeEquipmentId);
  await refreshActiveEquipmentFromApi();
  render();
  document.querySelector("#viewer").scrollIntoView({ behavior: "smooth", block: "start" });
});

equipmentList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-equipment]");
  if (!button) return;

  const { specialty, equipment } = findEquipment(button.dataset.equipment);
  activeSpecialtyId = specialty.id;
  activeEquipmentId = equipment.id;
  setEquipmentRoute(equipment.id);
  await refreshActiveEquipmentFromApi();
  render();
});

function handleHotspotClick(event) {
  const hotspot = event.target.closest("[data-hotspot-index]");
  if (!hotspot) return;

  event.stopPropagation();
  renderAnnotation(activeHotspots, Number(hotspot.dataset.hotspotIndex));
}

hotspotLayer.addEventListener("click", handleHotspotClick);
equipmentModelViewer?.addEventListener("click", handleHotspotClick);

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

async function syncFromLocation() {
  initFromLocation();

  if (window.location.hash.replace("#", "").startsWith("equipment=")) {
    setEquipmentRoute(activeEquipmentId, "replace");
  } else if (!isFileMode && /^\/equipment\/[^/]+\/?$/.test(window.location.pathname)) {
    setEquipmentRoute(activeEquipmentId, "replace");
  }

  await refreshActiveEquipmentFromApi();
  render();
}

function scheduleSyncFromLocation() {
  if (syncScheduled) {
    return;
  }

  syncScheduled = true;
  window.requestAnimationFrame(() => {
    syncScheduled = false;
    void syncFromLocation();
  });
}

window.addEventListener("hashchange", scheduleSyncFromLocation);
window.addEventListener("popstate", scheduleSyncFromLocation);

localViewer.addEventListener("pointerdown", (event) => {
  if (event.target.closest("model-viewer")) {
    return;
  }

  if (event.target.closest("[data-hotspot-index], [data-viewer-control]")) {
    return;
  }

  isDragging = true;
  lastPointer = { x: event.clientX, y: event.clientY };
  localViewer.setPointerCapture(event.pointerId);
});

localViewer.addEventListener("pointermove", (event) => {
  if (!isDragging) return;

  if (event.target.closest("model-viewer")) {
    return;
  }

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
    if (event.target.closest("model-viewer")) {
      return;
    }

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
    await refreshActiveEquipmentFromApi();
    render();
    applyInitialViewOptions();
  } catch (error) {
    specialtyGrid.innerHTML = '<p class="error-state">Не удалось загрузить каталог оборудования.</p>';
    equipmentList.innerHTML = '<p class="error-state">Проверьте запуск Node.js сервера.</p>';
  }
}

init();
