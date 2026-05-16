const specialtyGrid = document.querySelector("#specialty-grid");
const equipmentList = document.querySelector("#equipment-list");
const activeSpecialtyLabel = document.querySelector("#active-specialty-label");
const equipmentCount = document.querySelector("#equipment-count");
const equipmentType = document.querySelector("#equipment-type");
const equipmentTitle = document.querySelector("#equipment-title");
const equipmentDescription = document.querySelector("#equipment-description");
const equipmentFeatures = document.querySelector("#equipment-features");
const modelLink = document.querySelector("#model-link");
const modelViewer = document.querySelector("#model-viewer");
const hotspotLayer = document.querySelector("#hotspot-layer");
const annotationPanel = document.querySelector("#annotation-panel");
const autoRotateToggle = document.querySelector("#wireframe-toggle");
const qrModal = document.querySelector("#qr-modal");
const qrImage = document.querySelector("#qr-image");
const qrCaption = document.querySelector("#qr-caption");
const qrDirectLink = document.querySelector("#qr-direct-link");
const qrButtons = document.querySelectorAll("#qr-open, #qr-open-secondary");
const isFileMode = window.location.protocol === "file:";

let specialties = [];
let activeSpecialtyId = "";
let activeEquipmentId = "";
let activeEquipment = null;
let activeHotspotIndex = 0;
let isAutoRotate = true;
let selectionRequestId = 0;

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
      specialtyCode: specialty.code,
      specialtyTitle: specialty.title,
    })),
  );
}

function firstCatalogItem() {
  const specialty = specialties[0];
  return {
    specialty,
    equipment: specialty?.equipment?.[0],
  };
}

function findSpecialty(id) {
  return specialties.find((specialty) => specialty.id === id) || specialties[0];
}

function findEquipmentCatalogMatch(id) {
  for (const specialty of specialties) {
    const equipment = specialty.equipment.find((item) => item.id === id);
    if (equipment) {
      return { specialty, equipment };
    }
  }

  return null;
}

function findEquipmentInCatalog(id) {
  const match = findEquipmentCatalogMatch(id);
  if (match) {
    return match;
  }

  return firstCatalogItem();
}

function equipmentPageUrl(equipmentId) {
  const origin =
    window.location.origin && window.location.origin !== "null" ? window.location.origin : "http://localhost:8080";
  const url = new URL("/", origin);
  url.searchParams.set("id", equipmentId);
  return url.toString();
}

function readEquipmentIdFromLocation() {
  const pathMatch = window.location.pathname.match(/^\/equipment\/([^/]+)$/);
  const hashParams = new URLSearchParams(window.location.hash.replace("#", ""));
  const searchParams = new URLSearchParams(window.location.search);

  if (searchParams.has("id")) {
    return searchParams.get("id");
  }

  if (pathMatch) {
    return decodeURIComponent(pathMatch[1]);
  }

  return searchParams.get("equipment") || hashParams.get("id") || hashParams.get("equipment");
}

function setEquipmentRoute(equipmentId, mode = "push") {
  if (isFileMode) {
    const nextHash = `id=${encodeURIComponent(equipmentId)}`;

    if (window.location.hash.replace("#", "") === nextHash) {
      return;
    }

    history[mode === "replace" ? "replaceState" : "pushState"](null, "", `#${nextHash}`);
    return;
  }

  const nextUrl = new URL(window.location.href);
  nextUrl.pathname = "/";
  nextUrl.searchParams.delete("equipment");
  nextUrl.searchParams.set("id", equipmentId);

  if (window.location.href === nextUrl.toString()) {
    return;
  }

  history[mode === "replace" ? "replaceState" : "pushState"](null, "", nextUrl);
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json();
}

async function fetchEquipment(equipmentId) {
  if (isFileMode) {
    return findEquipmentInCatalog(equipmentId).equipment;
  }

  return fetchJson(`/api/equipment/${encodeURIComponent(equipmentId)}`);
}

function normalizeEquipment(equipment) {
  return {
    ...equipment,
    features: Array.isArray(equipment.features) ? equipment.features : [],
    hotspots: Array.isArray(equipment.hotspots) ? equipment.hotspots : [],
  };
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
  const normalized = normalizeEquipment(equipment);

  activeEquipment = normalized;
  activeEquipmentId = normalized.id;
  activeSpecialtyId = normalized.specialtyId || activeSpecialtyId;

  modelViewer.setAttribute("src", normalized.model);
  modelViewer.setAttribute("alt", `Интерактивная 3D модель: ${normalized.title}`);
  modelViewer.toggleAttribute("auto-rotate", isAutoRotate);
  equipmentType.textContent = normalized.type;
  equipmentTitle.textContent = normalized.title;
  equipmentDescription.textContent = normalized.description;
  modelLink.href = normalized.model;
  equipmentFeatures.innerHTML = normalized.features.map((feature) => `<li>${escapeHtml(feature)}</li>`).join("");
  renderHotspots(normalized.hotspots);
}

function syncActiveStates() {
  document.querySelectorAll("[data-specialty]").forEach((card) => {
    card.classList.toggle("is-active", card.dataset.specialty === activeSpecialtyId);
  });

  document.querySelectorAll("[data-equipment]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.equipment === activeEquipmentId);
  });
}

function syncAutoRotate() {
  modelViewer.toggleAttribute("auto-rotate", isAutoRotate);
  autoRotateToggle.setAttribute("aria-pressed", String(isAutoRotate));
  autoRotateToggle.classList.toggle("is-active", isAutoRotate);
}

function renderLoadingState() {
  equipmentTitle.textContent = "Загрузка оборудования...";
  equipmentDescription.textContent = "Получаем данные из SQLite через API.";
  equipmentFeatures.innerHTML = "";
  annotationPanel.innerHTML = "<span>Аннотации появятся после загрузки модели.</span>";
}

function renderErrorState() {
  equipmentTitle.textContent = "Не удалось загрузить оборудование";
  equipmentDescription.textContent = "Проверьте ID в адресной строке и работу Node.js сервера.";
  equipmentFeatures.innerHTML = "";
  annotationPanel.innerHTML = "<span>Данные модели недоступны.</span>";
}

async function selectEquipment(equipmentId, mode = "push", options = {}) {
  const requestId = (selectionRequestId += 1);
  const catalogMatch = findEquipmentCatalogMatch(equipmentId) || firstCatalogItem();
  const fallback = catalogMatch.equipment || firstCatalogItem().equipment;

  activeSpecialtyId = catalogMatch.specialty?.id || activeSpecialtyId;
  activeEquipmentId = fallback?.id || equipmentId;
  renderEquipmentList(catalogMatch.specialty || findSpecialty(activeSpecialtyId));
  syncActiveStates();
  renderLoadingState();

  try {
    const equipment = await fetchEquipment(equipmentId);

    if (requestId !== selectionRequestId) {
      return;
    }

    renderActiveEquipment(equipment);
    setEquipmentRoute(equipment.id, mode);
    syncActiveStates();
    syncAutoRotate();

    if (options.scrollToViewer) {
      document.querySelector("#viewer").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  } catch (error) {
    if (requestId !== selectionRequestId) {
      return;
    }

    renderErrorState();
  }
}

function createQrDataUrl(url) {
  if (typeof qrcode !== "function") {
    return "";
  }

  const qr = qrcode(0, "M");
  qr.addData(url);
  qr.make();
  return qr.createDataURL(8, 16);
}

function openQrModal() {
  const equipment = activeEquipment || findEquipmentInCatalog(activeEquipmentId).equipment;
  const url = equipmentPageUrl(equipment.id);

  qrCaption.textContent = `${equipment.title}: отсканируйте код, чтобы открыть эту 3D-модель.`;
  qrDirectLink.href = url;
  qrDirectLink.textContent = url;
  qrImage.hidden = false;
  qrImage.src = createQrDataUrl(url);
  qrModal.classList.add("is-open");
  qrModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
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
      specialties = await fetchJson("/api/specialties");
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
  const equipment = specialty.equipment[0];
  selectEquipment(equipment.id, "push", { scrollToViewer: true });
});

equipmentList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-equipment]");
  if (!button) return;

  selectEquipment(button.dataset.equipment);
});

hotspotLayer.addEventListener("click", (event) => {
  const hotspot = event.target.closest("[data-hotspot-index]");
  if (!hotspot || !activeEquipment) return;

  event.stopPropagation();
  renderAnnotation(activeEquipment.hotspots || [], Number(hotspot.dataset.hotspotIndex));
});

autoRotateToggle.addEventListener("click", () => {
  isAutoRotate = !isAutoRotate;
  syncAutoRotate();
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

function scheduleSyncFromLocation() {
  if (syncScheduled) {
    return;
  }

  syncScheduled = true;
  window.requestAnimationFrame(() => {
    syncScheduled = false;
    selectEquipment(readEquipmentIdFromLocation() || firstCatalogItem().equipment.id, "replace");
  });
}

window.addEventListener("hashchange", scheduleSyncFromLocation);
window.addEventListener("popstate", scheduleSyncFromLocation);

async function init() {
  try {
    await loadData();
    renderSpecialties();
    syncAutoRotate();
    await selectEquipment(readEquipmentIdFromLocation() || firstCatalogItem().equipment.id, "replace");
    applyInitialViewOptions();
  } catch (error) {
    specialtyGrid.innerHTML = '<p class="error-state">Не удалось загрузить каталог оборудования.</p>';
    equipmentList.innerHTML = '<p class="error-state">Проверьте запуск Node.js сервера.</p>';
    renderErrorState();
  }
}

init();
