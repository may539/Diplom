const specialtyGrid = document.querySelector("#specialty-grid");
const equipmentList = document.querySelector("#equipment-list");
const activeSpecialtyLabel = document.querySelector("#active-specialty-label");
const equipmentCount = document.querySelector("#equipment-count");
const equipmentType = document.querySelector("#equipment-type");
const equipmentTitle = document.querySelector("#equipment-title");
const equipmentDescription = document.querySelector("#equipment-description");
const roomPassportLabel = document.querySelector("#room-passport-label");
const roomPassportTitle = document.querySelector("#room-passport-title");
const roomPassportDescription = document.querySelector("#room-passport-description");
const roomPassportPhoto = document.querySelector("#room-passport-photo");
const roomPassportDocument = document.querySelector("#room-passport-document");
const equipmentFeatures = document.querySelector("#equipment-features");
const modelLink = document.querySelector("#model-link");
const printEquipmentQrButton = document.querySelector("#print-equipment-qr");
const localViewer = document.querySelector("#local-viewer");
const localScene = document.querySelector("#local-scene");
const equipmentModelViewerHost = document.querySelector("#equipment-model-viewer-host");
const equipmentShape = document.querySelector("#equipment-shape");
const hotspotLayer = document.querySelector("#hotspot-layer");
const annotationPanel = document.querySelector("#annotation-panel");
const wireframeToggle = document.querySelector("#wireframe-toggle");
const zoomOutButton = document.querySelector("#zoom-out");
const zoomInButton = document.querySelector("#zoom-in");
const zoomResetButton = document.querySelector("#zoom-reset");
const menuRoot = document.querySelector("#main-menu");
const menuToggle = document.querySelector("#menu-toggle");
const menuDropdown = document.querySelector("#menu-dropdown");
const allModals = document.querySelectorAll(".modal");
const faqList = document.querySelector("#faq-list");
const adminLoginModalForm = document.querySelector("#admin-login-modal-form");
const adminLoginModalPassword = document.querySelector("#admin-login-modal-password");
const adminLoginModalStatus = document.querySelector("#admin-login-modal-status");
const isFileMode = window.location.protocol === "file:";
const CATALOG_RELOAD_KEY = "catalogNeedsReload";

let specialties = [];
let activeSpecialtyId = "";
let activeEquipmentId = "";
let activeEquipmentDetail = null;
let equipmentDetailError = false;
let activeHotspotIndex = 0;
let activeHotspots = [];
let isAutoRotate = true;
let isDragging = false;
let lastPointer = { x: 0, y: 0 };
let rotation = { x: -22, y: 38 };
let zoom = 1;
let modelCameraRadius = 165;
let faqLoaded = false;
let equipmentModelViewer = null;
const ZOOM_MIN = 0.7;
const ZOOM_MAX = 1.8;
const MODEL_CAMERA_RADIUS_MIN = 70;
const MODEL_CAMERA_RADIUS_MAX = 320;
const MODEL_CAMERA_RADIUS_DEFAULT = 165;
const ADMIN_TOKEN_KEY = "adminToken";
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

function ensureEquipmentModelViewer() {
  if (!webglSupported || !equipmentModelViewerHost) {
    return null;
  }

  if (equipmentModelViewer) {
    return equipmentModelViewer;
  }

  const viewer = document.createElement("model-viewer");
  viewer.id = "equipment-model-viewer";
  viewer.className = "equipment-model-viewer";
  viewer.setAttribute("camera-controls", "");
  viewer.setAttribute("auto-rotate", "");
  viewer.setAttribute("auto-rotate-delay", "0");
  viewer.setAttribute("rotation-per-second", "30deg");
  viewer.setAttribute("touch-action", "pan-y");
  viewer.setAttribute("loading", "eager");
  viewer.setAttribute("reveal", "auto");
  viewer.setAttribute("camera-orbit", "auto auto 165%");
  viewer.setAttribute("min-camera-orbit", "auto auto 70%");
  viewer.setAttribute("max-camera-orbit", "auto auto 320%");
  viewer.setAttribute("field-of-view", "35deg");
  viewer.addEventListener("click", handleHotspotClick);

  equipmentModelViewerHost.append(viewer);
  equipmentModelViewer = viewer;
  return equipmentModelViewer;
}

function showCssFallback() {
  if (equipmentModelViewer) {
    equipmentModelViewer.hidden = true;
    equipmentModelViewer.removeAttribute("src");
  }
  if (equipmentModelViewerHost) {
    equipmentModelViewerHost.hidden = true;
  }
  if (localScene) {
    localScene.hidden = false;
  }
}

function showModelViewer() {
  if (equipmentModelViewerHost) {
    equipmentModelViewerHost.hidden = false;
  }
  if (equipmentModelViewer) {
    equipmentModelViewer.hidden = false;
  }
  if (localScene) {
    localScene.hidden = true;
  }
}

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
  return specialties.find((specialty) => specialty.id === id) || getDefaultSpecialty();
}

function getDefaultSpecialty() {
  return specialties[0];
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

  const fallbackSpecialty = getDefaultSpecialty();
  return {
    specialty: fallbackSpecialty,
    equipment: fallbackSpecialty?.equipment?.[0],
  };
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
  if (glbMode) {
    zoomResetButton.textContent = `${Math.round((MODEL_CAMERA_RADIUS_DEFAULT / modelCameraRadius) * 100)}%`;
    zoomOutButton.disabled = modelCameraRadius >= MODEL_CAMERA_RADIUS_MAX - 0.001;
    zoomInButton.disabled = modelCameraRadius <= MODEL_CAMERA_RADIUS_MIN + 0.001;
    return;
  }

  zoomResetButton.textContent = `${Math.round(zoom * 100)}%`;
  zoomOutButton.disabled = zoom <= ZOOM_MIN + 0.001;
  zoomInButton.disabled = zoom >= ZOOM_MAX - 0.001;
}

function setZoom(nextZoom) {
  zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, nextZoom));
  setViewerTransform();
  syncZoomControls();
}

function setModelCameraRadius(nextRadius) {
  modelCameraRadius = Math.max(MODEL_CAMERA_RADIUS_MIN, Math.min(MODEL_CAMERA_RADIUS_MAX, nextRadius));
  equipmentModelViewer?.setAttribute("camera-orbit", `auto auto ${modelCameraRadius.toFixed(1)}%`);
  syncZoomControls();
}

function renderSpecialties() {
  if (!specialtyGrid) {
    return;
  }

  specialtyGrid.hidden = false;
  specialtyGrid.innerHTML = specialties
    .map(
      (specialty) => `
        <button class="specialty-card" type="button" data-specialty="${escapeHtml(specialty.id)}">
          <span class="specialty-card__code">${escapeHtml(specialty.code)}</span>
          <h3>${escapeHtml(specialty.name || specialty.title)}</h3>
          <p>${escapeHtml(specialty.description)}</p>
        </button>
      `,
    )
    .join("");
}

async function selectSpecialtyAndLoadCatalog(specialtyId) {
  activeSpecialtyId = specialtyId;
  const specialty = findSpecialty(specialtyId);

  activeEquipmentId = specialty.equipment[0]?.id || "";
  activeEquipmentDetail = null;
  equipmentDetailError = false;
  if (activeEquipmentId) {
    setEquipmentRoute(activeEquipmentId);
    await refreshActiveEquipmentFromApi();
  }
  render();
}

function renderEquipmentList(specialty) {
  if (!specialty) {
    activeSpecialtyLabel.textContent = "";
    equipmentCount.textContent = "0 объектов";
    equipmentList.innerHTML = '<p class="equipment-list__empty">Для этой аудитории пока нет оборудования.</p>';
    return;
  }

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
  } else if (
    equipmentModelViewer &&
    typeof modelLooksUntextured === "function" &&
    modelLooksUntextured(equipmentModelViewer)
  ) {
    annotationPanel.innerHTML =
      "<span>Модель без текстур (белый корпус). В админке нажмите «Исправить текстуры», затем на главной — Ctrl+F5. Если не помогло, загрузите GLB с встроенными картинками.</span>";
  } else if (equipmentDetailError) {
    annotationPanel.innerHTML =
      "<span>Не удалось обновить карточку с сервера. Показаны данные из каталога.</span>";
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

function renderRoomPassport(specialty) {
  if (!roomPassportTitle || !roomPassportDescription) {
    return;
  }

  if (!specialty) {
    if (roomPassportLabel) {
      roomPassportLabel.textContent = "ПАСПОРТ АУДИТОРИИ";
    }
    roomPassportTitle.textContent = "";
    roomPassportDescription.textContent = "";
    if (roomPassportPhoto) {
      roomPassportPhoto.hidden = true;
      roomPassportPhoto.removeAttribute("src");
    }
    if (roomPassportDocument) {
      roomPassportDocument.hidden = true;
      roomPassportDocument.href = "#";
    }
    return;
  }

  const title = specialty.name || specialty.title || specialty.code || "";
  if (roomPassportLabel) {
    roomPassportLabel.textContent = `ПАСПОРТ АУДИТОРИИ: ${title}`;
  }
  roomPassportTitle.textContent = title;
  roomPassportDescription.textContent = specialty.description || "";
  if (roomPassportPhoto) {
    if (specialty.classroomPhoto) {
      roomPassportPhoto.src = specialty.classroomPhoto;
      roomPassportPhoto.hidden = false;
    } else {
      roomPassportPhoto.hidden = true;
      roomPassportPhoto.removeAttribute("src");
    }
  }
  if (roomPassportDocument) {
    if (specialty.classroomPassport) {
      roomPassportDocument.href = specialty.classroomPassport;
      roomPassportDocument.hidden = false;
    } else {
      roomPassportDocument.hidden = true;
      roomPassportDocument.href = "#";
    }
  }
}

function renderActiveEquipment(equipment) {
  renderRoomPassport(findSpecialty(activeSpecialtyId));

  localViewer.setAttribute("aria-label", `Интерактивная 3D модель: ${equipment.title}`);
  equipmentShape.dataset.variant = equipment.variant || "sensor";
  equipmentType.textContent = equipment.type || "";
  equipmentTitle.textContent = equipment.title;
  equipmentDescription.textContent = equipment.description;
  modelLink.href = equipment.model;
  modelLink.textContent = "Открыть GLB-источник";
  equipmentFeatures.innerHTML = (equipment.features || []).map((feature) => `<li>${escapeHtml(feature)}</li>`).join("");

  const viewer = ensureEquipmentModelViewer();
  if (viewer) {
    showModelViewer();
    if (typeof bindModelViewerLighting === "function") {
      bindModelViewerLighting(viewer);
    }

    const applySrc = async () => {
      if (typeof setModelViewerSrc === "function") {
        await setModelViewerSrc(viewer, equipment.model);
      } else {
        if (typeof applyModelCrossOrigin === "function") {
          applyModelCrossOrigin(viewer, equipment.model);
        }
        if (typeof configureModelViewer === "function") {
          configureModelViewer(viewer);
        }
        viewer.setAttribute("src", equipment.model);
      }

      viewer.setAttribute("alt", equipment.title);
      viewer.toggleAttribute("auto-rotate", isAutoRotate);
      setModelCameraRadius(modelCameraRadius);
      renderAnnotation(equipment.hotspots || [], -1);
    };

    if (!viewer._textureHintBound) {
      viewer._textureHintBound = true;
      viewer.addEventListener("load", () => {
        if (typeof fixModelMaterials === "function") {
          fixModelMaterials(viewer);
        }
        renderAnnotation(activeHotspots, activeHotspotIndex);
      });
    }

    void applySrc();
  } else {
    showCssFallback();
  }

  renderHotspots(equipment.hotspots || []);
  if (!viewer) {
    annotationPanel.innerHTML =
      '<span>WebGL отключён или недоступен в этом браузере. GLB-модель не может отобразиться здесь; откройте страницу в браузере с включённым аппаратным ускорением/WebGL.</span>';
  }
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
  equipmentModelViewer?.toggleAttribute("auto-rotate", isAutoRotate);
  wireframeToggle.disabled = false;
  wireframeToggle.setAttribute("aria-pressed", String(isAutoRotate));
  wireframeToggle.classList.toggle("is-active", isAutoRotate);
  wireframeToggle.textContent = isAutoRotate ? "Автопрокрутка: вкл" : "Автопрокрутка: выкл";
}

function storeAdminToken(token) {
  if (token) {
    sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
  } else {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  }
}

function renderEquipmentNotFound() {
  renderRoomPassport(findSpecialty(activeSpecialtyId));
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
    equipmentModelViewer.hidden = true;
  }
  if (equipmentModelViewerHost) {
    equipmentModelViewerHost.hidden = true;
  }
  if (localScene) {
    localScene.hidden = true;
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
  const catalogEquipment = specialty?.equipment.find((item) => item.id === activeEquipmentId);

  let equipment =
    activeEquipmentDetail && activeEquipmentDetail.id === activeEquipmentId
      ? activeEquipmentDetail
      : catalogEquipment;

  if (!equipment && equipmentDetailError) {
    renderEquipmentList(specialty);
    renderEquipmentNotFound();
    syncActiveStates();
    syncAutoRotate();
    syncZoomControls();
    return;
  }

  if (!equipment) {
    equipment = specialty?.equipment[0];
    if (!equipment) {
      renderEquipmentList(specialty);
      renderEquipmentNotFound();
      syncActiveStates();
      syncAutoRotate();
      syncZoomControls();
      return;
    }
    activeEquipmentId = equipment.id;
    activeEquipmentDetail = null;
    equipmentDetailError = false;
  }

  renderEquipmentList(specialty);
  renderActiveEquipment(equipment);
  syncActiveStates();
  syncAutoRotate();
  syncZoomControls();
}

function initFromLocation() {
  const equipmentId = readEquipmentIdFromLocation();

  if (!equipmentId) {
    const specialty = getDefaultSpecialty();
    activeSpecialtyId = specialty?.id || "";
    activeEquipmentId = specialty?.equipment?.[0]?.id || "";
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

  const specialty = getDefaultSpecialty();
  activeSpecialtyId = specialty?.id || "";
  activeEquipmentId = equipmentId;
  activeEquipmentDetail = null;
  equipmentDetailError = false;
}

async function refreshActiveEquipmentFromApi() {
  const id = activeEquipmentId;
  equipmentDetailError = false;

  if (isFileMode) {
    activeEquipmentDetail = null;
    equipmentDetailError = true;
    return;
  }

  try {
    const response = await fetch(`/api/equipment/${encodeURIComponent(id)}`, { cache: "no-store" });

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
    if (data.specialtyId) {
      activeSpecialtyId = data.specialtyId;
    }
    equipmentDetailError = false;
  } catch {
    activeEquipmentDetail = null;
    equipmentDetailError = true;
  }
}

function isMenuOpen() {
  return Boolean(menuRoot?.classList.contains("is-open"));
}

function closeMenuDropdown() {
  if (!menuRoot || !menuToggle || !menuDropdown) return;
  menuRoot.classList.remove("is-open");
  menuToggle.setAttribute("aria-expanded", "false");
  menuDropdown.setAttribute("hidden", "");
}

function openMenuDropdown() {
  if (!menuRoot || !menuToggle || !menuDropdown) return;
  menuRoot.classList.add("is-open");
  menuToggle.setAttribute("aria-expanded", "true");
  menuDropdown.removeAttribute("hidden");
}

function toggleMenuDropdown() {
  if (isMenuOpen()) {
    closeMenuDropdown();
  } else {
    openMenuDropdown();
  }
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
  if (!document.querySelector(".modal.is-open")) {
    document.body.classList.remove("modal-open");
  }
}

function closeAllModals() {
  allModals.forEach((modal) => closeModal(modal));
}

async function loadFaqArticles() {
  if (!faqList || faqLoaded) return;

  if (isFileMode) {
    faqList.innerHTML = '<p class="faq-list__loading">FAQ доступен после запуска сервера через npm start.</p>';
    faqLoaded = true;
    return;
  }

  try {
    const response = await fetch("/api/help-articles", {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error("FAQ API request failed");
    }

    const articles = await response.json();
    if (!Array.isArray(articles) || articles.length === 0) {
      faqList.innerHTML = '<p class="faq-list__loading">Справочные статьи пока не добавлены.</p>';
      faqLoaded = true;
      return;
    }

    faqList.innerHTML = articles
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
    faqList.innerHTML =
      '<p class="faq-list__loading">Не удалось загрузить FAQ. Проверьте запуск Node.js сервера.</p>';
  }
}

async function submitAdminLogin(event) {
  event.preventDefault();

  if (!adminLoginModalPassword || !adminLoginModalStatus) return;
  const password = adminLoginModalPassword.value.trim();
  if (!password) return;

  adminLoginModalStatus.textContent = "Проверяем пароль...";
  adminLoginModalStatus.classList.remove("is-error");

  if (isFileMode) {
    adminLoginModalStatus.textContent = "Админ-панель доступна после запуска сервера через npm start.";
    adminLoginModalStatus.classList.add("is-error");
    return;
  }

  try {
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      adminLoginModalStatus.textContent = data.error || "Неверный пароль администратора.";
      adminLoginModalStatus.classList.add("is-error");
      return;
    }

    storeAdminToken(data.token);
    adminLoginModalStatus.textContent = "Вход выполнен. Открываем форму...";
    window.location.assign("/admin.html#admin-form");
  } catch (error) {
    adminLoginModalStatus.textContent = "Не удалось подключиться к серверу.";
    adminLoginModalStatus.classList.add("is-error");
  }
}

async function printActiveEquipmentQr() {
  if (!activeEquipmentId) {
    return;
  }

  try {
    const response = await fetch(`/api/qr/${encodeURIComponent(activeEquipmentId)}`, { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.imageDataUrl) {
      throw new Error(payload.error || "Не удалось сформировать QR-код.");
    }

    const printWindow = window.open("", "_blank", "width=420,height=620");
    if (!printWindow) {
      throw new Error("Браузер заблокировал окно печати. Разрешите всплывающие окна.");
    }

    printWindow.document.write(`
      <!doctype html>
      <html lang="ru">
        <head>
          <meta charset="utf-8" />
          <title>QR: ${escapeHtml(payload.title || activeEquipmentId)}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; text-align: center; color: #111827; }
            img { width: 280px; height: 280px; }
            p { overflow-wrap: anywhere; }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(payload.title || activeEquipmentId)}</h1>
          <img src="${payload.imageDataUrl}" alt="QR-код" />
          <p>${escapeHtml(payload.url || "")}</p>
          <script>window.onload = () => { window.print(); };</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  } catch (error) {
    annotationPanel.innerHTML = `<span>${escapeHtml(error.message)}</span>`;
  }
}

if (adminLoginModalForm) {
  adminLoginModalForm.addEventListener("submit", submitAdminLogin);
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

}

async function loadData() {
  const response = await fetch("/api/specialties", { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Specialties API request failed");
  }

  specialties = await response.json();

  if (!specialties.length || !allEquipment().length) {
    throw new Error("Equipment data is empty");
  }
}

specialtyGrid?.addEventListener("click", async (event) => {
  const card = event.target.closest("[data-specialty]");
  if (!card) return;
  await selectSpecialtyAndLoadCatalog(card.dataset.specialty);
  document.querySelector("#viewer")?.scrollIntoView({ behavior: "smooth", block: "start" });
});

equipmentList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-equipment]");
  if (!button) return;

  const { specialty, equipment } = findEquipment(button.dataset.equipment);
  if (!specialty || !equipment) return;
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
  isAutoRotate = !isAutoRotate;
  syncAutoRotate();
});

printEquipmentQrButton?.addEventListener("click", printActiveEquipmentQr);

if (menuToggle && menuDropdown && menuRoot) {
  menuToggle.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleMenuDropdown();
  });

  menuDropdown.addEventListener("click", (event) => {
    event.stopPropagation();
  });
}

document.querySelectorAll("[data-menu-close]").forEach((trigger) => {
  trigger.addEventListener("click", closeMenuDropdown);
});

document.querySelectorAll("[data-open-modal]").forEach((trigger) => {
  trigger.addEventListener("click", async () => {
    const modal = document.querySelector(`#${trigger.dataset.openModal}-modal`);
    closeMenuDropdown();
    closeAllModals();
    openModal(modal);

    if (trigger.dataset.openModal === "faq") {
      await loadFaqArticles();
    }
  });
});

allModals.forEach((modal) => {
  modal.addEventListener("click", (event) => {
    if (event.target.matches("[data-close-modal]")) {
      closeModal(modal);
    }
  });
});

document.addEventListener("click", (event) => {
  if (isMenuOpen() && !menuRoot.contains(event.target)) {
    closeMenuDropdown();
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeMenuDropdown();
    closeAllModals();
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
      event.preventDefault();
      setModelCameraRadius(modelCameraRadius + event.deltaY * 0.08);
      return;
    }

    event.preventDefault();
    setZoom(zoom - event.deltaY * 0.0015);
  },
  { passive: false },
);

zoomOutButton.addEventListener("click", () => {
  if (equipmentModelViewer?.src) {
    setModelCameraRadius(modelCameraRadius + 25);
    return;
  }

  setZoom(zoom - 0.12);
});

zoomInButton.addEventListener("click", () => {
  if (equipmentModelViewer?.src) {
    setModelCameraRadius(modelCameraRadius - 20);
    return;
  }

  setZoom(zoom + 0.12);
});

zoomResetButton.addEventListener("click", () => {
  if (equipmentModelViewer?.src) {
    setModelCameraRadius(MODEL_CAMERA_RADIUS_DEFAULT);
    return;
  }

  setZoom(1);
});

async function refreshCatalogView() {
  await loadData();
  initFromLocation();
  renderSpecialties();
  await refreshActiveEquipmentFromApi();
  render();
}

async function init() {
  try {
    setZoom(1);
    if (equipmentModelViewer) {
      if (typeof bindModelViewerLighting === "function") {
        bindModelViewerLighting(equipmentModelViewer);
      } else if (typeof configureModelViewer === "function") {
        configureModelViewer(equipmentModelViewer);
      }
    }
    await refreshCatalogView();
    applyInitialViewOptions();
  } catch (error) {
    specialtyGrid.innerHTML = '<p class="error-state">Не удалось загрузить каталог оборудования.</p>';
    equipmentList.innerHTML = '<p class="error-state">Проверьте запуск Node.js сервера.</p>';
  }
}

window.addEventListener("pageshow", async (event) => {
  if (isFileMode) {
    return;
  }

  const needsReload = sessionStorage.getItem(CATALOG_RELOAD_KEY) === "1" || event.persisted;
  if (!needsReload) {
    return;
  }

  sessionStorage.removeItem(CATALOG_RELOAD_KEY);

  try {
    await refreshCatalogView();
    applyInitialViewOptions();
  } catch (error) {
    console.error(error);
  }
});

init();
