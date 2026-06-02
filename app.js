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
const kiosk = {
  stage: document.querySelector("#kiosk-stage"),
  viewer: document.querySelector("#kiosk-model-viewer"),
  type: document.querySelector("#kiosk-type"),
  title: document.querySelector("#kiosk-title"),
  description: document.querySelector("#kiosk-description"),
  back: document.querySelector("#kiosk-back"),
  info: document.querySelector("#kiosk-info"),
};
const menuRoot = document.querySelector("#menu-root");
const menuToggle = document.querySelector("#menu-toggle");
const menuDropdown = document.querySelector("#menu-dropdown");
const allModals = document.querySelectorAll(".modal");
const adminModal = document.querySelector("#admin-modal");
const adminGateForm = document.querySelector("#admin-gate-form");
const adminGatePassword = document.querySelector("#admin-gate-password");
const adminGateStatus = document.querySelector("#admin-gate-status");
const adminGateStep = document.querySelector("#admin-gate");
const adminFormStep = document.querySelector("#admin-form-step");
const adminResultStep = document.querySelector("#admin-result");
const adminResultTitle = document.querySelector("#admin-result-title");
const adminQrCanvas = document.querySelector("#admin-qr-canvas");
const adminQrCaption = document.querySelector("#admin-qr-caption");
const adminQrLink = document.querySelector("#admin-qr-link");
const adminPrintQr = document.querySelector("#admin-print-qr");
const adminAddAnother = document.querySelector("#admin-add-another");
const equipmentForm = document.querySelector("#equipment-form");
const specialtySelect = document.querySelector("#specialty-select");
const formStatus = document.querySelector("#form-status");
const faqList = document.querySelector("#faq-list");
const isFileMode = window.location.protocol === "file:";

let adminUnlockedPassword = "";
let faqLoaded = false;

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
  return `${origin}/?equipment=${encodeURIComponent(equipmentId)}`;
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

function isKioskRequested() {
  const params = new URLSearchParams(window.location.search);
  return Boolean(params.get("equipment") || params.get("id"));
}

function applyKioskEquipment(equipment) {
  if (!kiosk.stage || !equipment) return;
  kiosk.type.textContent = equipment.type || "";
  kiosk.title.textContent = equipment.title || "";
  kiosk.description.textContent = equipment.description || "";
  if (equipment.model) {
    if (kiosk.viewer.getAttribute("src") !== equipment.model) {
      kiosk.viewer.setAttribute("src", equipment.model);
    }
    kiosk.viewer.setAttribute("alt", `Интерактивная 3D-модель: ${equipment.title}`);
  }
}

function enterKioskMode() {
  if (!kiosk.stage) return;
  document.body.classList.add("kiosk-mode");
  kiosk.stage.setAttribute("aria-hidden", "false");
  kiosk.stage.classList.add("is-active");
  const { equipment } = findEquipment(activeEquipmentId);
  applyKioskEquipment(equipment);
}

function exitKioskMode() {
  if (!kiosk.stage) return;
  document.body.classList.remove("kiosk-mode", "kiosk-mode--info");
  kiosk.stage.setAttribute("aria-hidden", "true");
  kiosk.stage.classList.remove("is-active");
  history.replaceState(null, "", "/");
  scheduleSyncFromLocation();
}

if (kiosk.back) {
  kiosk.back.addEventListener("click", exitKioskMode);
}
if (kiosk.info) {
  kiosk.info.addEventListener("click", () => {
    const isOn = document.body.classList.toggle("kiosk-mode--info");
    kiosk.info.setAttribute("aria-pressed", String(isOn));
  });
}

function closeMenuDropdown() {
  if (!menuToggle || !menuDropdown) return;
  menuToggle.setAttribute("aria-expanded", "false");
  menuDropdown.hidden = true;
  menuRoot && menuRoot.classList.remove("is-open");
}

function openMenuDropdown() {
  if (!menuToggle || !menuDropdown) return;
  menuToggle.setAttribute("aria-expanded", "true");
  menuDropdown.hidden = false;
  menuRoot && menuRoot.classList.add("is-open");
}

if (menuToggle && menuDropdown) {
  menuToggle.addEventListener("click", (event) => {
    event.stopPropagation();
    if (menuDropdown.hidden) {
      openMenuDropdown();
    } else {
      closeMenuDropdown();
    }
  });

  document.addEventListener("click", (event) => {
    if (!menuRoot) return;
    if (!menuRoot.contains(event.target)) {
      closeMenuDropdown();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMenuDropdown();
    }
  });
}

function openModal(modal) {
  if (!modal) return;
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeModal(modal) {
  if (!modal) return;
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function closeAllModals() {
  allModals.forEach((modal) => closeModal(modal));
}

allModals.forEach((modal) => {
  modal.addEventListener("click", (event) => {
    if (event.target.matches("[data-close-modal]")) {
      closeModal(modal);
    }
  });
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeAllModals();
  }
});

async function loadAdminSpecialties() {
  if (!specialtySelect || isFileMode) return;
  specialtySelect.innerHTML = "<option>Загрузка…</option>";
  try {
    const response = await fetch("/api/admin/specialties", {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error("Не удалось загрузить специальности.");
    const items = await response.json();
    specialtySelect.innerHTML = items
      .map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.code)} — ${escapeHtml(item.title)}</option>`)
      .join("");
  } catch (error) {
    specialtySelect.innerHTML = "";
    if (formStatus) {
      formStatus.textContent = "Не удалось получить список специальностей. Проверьте сервер.";
      formStatus.classList.add("is-error");
    }
  }
}

function showAdminStep(step) {
  [adminGateStep, adminFormStep, adminResultStep].forEach((node) => {
    if (!node) return;
    node.hidden = node.dataset.step !== step;
  });
}

function resetAdminModal() {
  adminUnlockedPassword = "";
  if (adminGatePassword) adminGatePassword.value = "";
  if (adminGateStatus) {
    adminGateStatus.textContent = "";
    adminGateStatus.classList.remove("is-error");
  }
  if (formStatus) {
    formStatus.textContent = "";
    formStatus.classList.remove("is-error");
  }
  if (equipmentForm) equipmentForm.reset();
  showAdminStep("gate");
}

async function attemptAdminUnlock(password) {
  if (!password) return false;
  if (isFileMode) return false;
  try {
    const response = await fetch("/api/admin/auth", {
      method: "POST",
      headers: { "x-admin-password": password },
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

if (adminGateForm) {
  adminGateForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const value = String(adminGatePassword.value || "").trim();
    if (!value) return;
    adminGateStatus.textContent = "Проверяем пароль…";
    adminGateStatus.classList.remove("is-error");
    const ok = await attemptAdminUnlock(value);
    if (!ok) {
      adminGateStatus.textContent = "Неверный пароль администратора.";
      adminGateStatus.classList.add("is-error");
      return;
    }
    adminUnlockedPassword = value;
    adminGateStatus.textContent = "";
    showAdminStep("form");
    await loadAdminSpecialties();
  });
}

function drawQrOnCanvas(text, canvas) {
  if (!canvas || typeof window.qrcode !== "function") return;
  if (window.qrcode.stringToBytesFuncs && window.qrcode.stringToBytesFuncs["UTF-8"]) {
    window.qrcode.stringToBytes = window.qrcode.stringToBytesFuncs["UTF-8"];
  }
  const qr = window.qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const moduleCount = qr.getModuleCount();
  const margin = 16;
  const size = canvas.width;
  const cellSize = Math.floor((size - margin * 2) / moduleCount);
  const qrSize = cellSize * moduleCount;
  const offset = Math.floor((size - qrSize) / 2);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#020617";
  for (let row = 0; row < moduleCount; row += 1) {
    for (let col = 0; col < moduleCount; col += 1) {
      if (qr.isDark(row, col)) {
        ctx.fillRect(offset + col * cellSize, offset + row * cellSize, cellSize, cellSize);
      }
    }
  }
}

if (equipmentForm) {
  equipmentForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!adminUnlockedPassword) {
      showAdminStep("gate");
      return;
    }
    formStatus.textContent = "Сохраняем модель…";
    formStatus.classList.remove("is-error");

    const formData = new FormData(equipmentForm);
    try {
      const response = await fetch("/api/admin/equipment", {
        method: "POST",
        headers: { "x-admin-password": adminUnlockedPassword },
        body: formData,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Ошибка сохранения модели.");
      }

      const shareUrl = buildEquipmentShareUrl(data.id);
      drawQrOnCanvas(shareUrl, adminQrCanvas);
      adminResultTitle.textContent = `${data.title} — модель добавлена`;
      adminQrCaption.textContent = "Распечатайте QR-код и разместите его на учебном оборудовании.";
      adminQrLink.href = shareUrl;
      adminQrLink.textContent = shareUrl;
      showAdminStep("result");

      try {
        await loadData();
        renderSpecialties();
        render();
      } catch (_error) {
        // catalog refresh is best-effort
      }
    } catch (error) {
      formStatus.textContent = error.message || "Не удалось сохранить модель.";
      formStatus.classList.add("is-error");
    }
  });
}

if (adminPrintQr) {
  adminPrintQr.addEventListener("click", () => {
    window.print();
  });
}

if (adminAddAnother) {
  adminAddAnother.addEventListener("click", () => {
    if (equipmentForm) equipmentForm.reset();
    formStatus.textContent = "";
    formStatus.classList.remove("is-error");
    showAdminStep("form");
  });
}

async function loadFaqArticles() {
  if (!faqList || faqLoaded || isFileMode) return;
  try {
    const response = await fetch("/api/help-articles");
    if (!response.ok) throw new Error("HTTP " + response.status);
    const items = await response.json();
    if (!Array.isArray(items) || items.length === 0) {
      faqList.innerHTML = '<p class="faq-list__loading">Статьи пока не добавлены.</p>';
      return;
    }
    faqList.innerHTML = items
      .map(
        (article) => `
          <details class="faq-item">
            <summary>${escapeHtml(article.title)}</summary>
            <p>${escapeHtml(article.body)}</p>
          </details>
        `,
      )
      .join("");
    faqLoaded = true;
  } catch (error) {
    faqList.innerHTML = '<p class="faq-list__loading">Не удалось загрузить статьи. Проверьте подключение к серверу.</p>';
  }
}

document.querySelectorAll("[data-open-modal]").forEach((trigger) => {
  trigger.addEventListener("click", async () => {
    const target = trigger.getAttribute("data-open-modal");
    closeMenuDropdown();
    closeAllModals();

    if (target === "admin") {
      resetAdminModal();
      openModal(adminModal);
    } else if (target === "faq") {
      openModal(document.querySelector("#faq-modal"));
      await loadFaqArticles();
    } else if (target === "about") {
      openModal(document.querySelector("#about-modal"));
    }
  });
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

    if (isKioskRequested()) {
      enterKioskMode();
    }

    const params = new URLSearchParams(window.location.search);
    const initialModal = params.get("openModal");
    if (initialModal === "admin") {
      resetAdminModal();
      openModal(adminModal);
    } else if (initialModal === "faq") {
      openModal(document.querySelector("#faq-modal"));
      await loadFaqArticles();
    } else if (initialModal === "about") {
      openModal(document.querySelector("#about-modal"));
    }
  } catch (error) {
    specialtyGrid.innerHTML = '<p class="error-state">Не удалось загрузить каталог оборудования.</p>';
    equipmentList.innerHTML = '<p class="error-state">Проверьте запуск Node.js сервера.</p>';
  }
}

init();
