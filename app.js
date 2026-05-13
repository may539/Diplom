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
const qrModal = document.querySelector("#qr-modal");
const qrImage = document.querySelector("#qr-image");
const qrCaption = document.querySelector("#qr-caption");
const qrDirectLink = document.querySelector("#qr-direct-link");
const qrButtons = document.querySelectorAll("#qr-open, #qr-open-secondary");
const isFileMode = window.location.protocol === "file:";

let specialties = [];
let activeSpecialtyId = "";
let activeEquipmentId = "";
let activeHotspotIndex = 0;
let isWireframe = false;
let isDragging = false;
let lastPointer = { x: 0, y: 0 };
let rotation = { x: -22, y: 38 };

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

  const nextPath = equipmentPath(equipmentId);

  if (window.location.pathname === nextPath && !window.location.search && !window.location.hash) {
    return;
  }

  history[mode === "replace" ? "replaceState" : "pushState"](null, "", nextPath);
}

function setViewerRotation() {
  localScene.style.setProperty("--viewer-rx", `${rotation.x}deg`);
  localScene.style.setProperty("--viewer-ry", `${rotation.y}deg`);
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

function renderActiveEquipment(equipment) {
  localViewer.setAttribute("aria-label", `Интерактивный 3D макет: ${equipment.title}`);
  equipmentShape.dataset.variant = equipment.variant;
  equipmentType.textContent = equipment.type;
  equipmentTitle.textContent = equipment.title;
  equipmentDescription.textContent = equipment.description;
  modelLink.href = equipment.model;
  equipmentFeatures.innerHTML = equipment.features.map((feature) => `<li>${escapeHtml(feature)}</li>`).join("");
  renderHotspots(equipment.hotspots);
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

async function openQrModal() {
  const { equipment } = findEquipment(activeEquipmentId);

  qrCaption.textContent = "Генерация QR-кода на сервере...";
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

  try {
    const response = await fetch(`/api/qr/${encodeURIComponent(equipment.id)}`);

    if (!response.ok) {
      throw new Error("QR API request failed");
    }

    const qr = await response.json();
    qrImage.src = qr.imageDataUrl;
    qrCaption.textContent = `${qr.title}: отсканируйте код, чтобы открыть эту 3D-модель.`;
    qrDirectLink.href = qr.url;
    qrDirectLink.textContent = qr.url;
  } catch (error) {
    qrCaption.textContent = "Не удалось получить QR-код с сервера.";
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
  if (event.target.closest("[data-hotspot-index]")) {
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
  setViewerRotation();
});

localViewer.addEventListener("pointerup", (event) => {
  isDragging = false;
  localViewer.releasePointerCapture(event.pointerId);
});

async function init() {
  try {
    setViewerRotation();
    await loadData();
    initFromLocation();
    renderSpecialties();
    render();
    applyInitialViewOptions();
  } catch (error) {
    specialtyGrid.innerHTML = '<p class="error-state">Не удалось загрузить каталог оборудования.</p>';
    equipmentList.innerHTML = '<p class="error-state">Проверьте запуск Node.js сервера.</p>';
  }
}

init();
