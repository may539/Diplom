const specialties = [
  {
    id: "oib",
    code: "ОИБ",
    title: "Обеспечение информационной безопасности",
    description: "Датчики, камеры, контроллеры доступа и устройства мониторинга.",
    equipment: [
      {
        id: "security-sensor",
        title: "Многофункциональный датчик",
        type: "ОИБ · датчики",
        short: "Контроль движения, температуры и состояния помещения.",
        description:
          "Учебный макет показывает принцип работы датчика охраны: корпус, зона контроля и подключение к системе мониторинга.",
        features: [
          "изучение состава охранного датчика",
          "разбор типовых сценариев тревоги",
          "подготовка QR-ссылки для лабораторного стенда",
        ],
        model: "https://modelviewer.dev/shared-assets/models/Astronaut.glb",
        environment: "neutral",
        variant: "sensor",
      },
      {
        id: "ip-camera",
        title: "IP-камера наблюдения",
        type: "ОИБ · видеонаблюдение",
        short: "Камера для изучения углов обзора и размещения на объекте.",
        description:
          "Карточка демонстрирует оборудование видеонаблюдения и может использоваться для объяснения зон покрытия.",
        features: [
          "интерактивный осмотр корпуса",
          "привязка к учебному помещению",
          "быстрый доступ по QR-коду",
        ],
        model: "https://modelviewer.dev/shared-assets/models/RobotExpressive.glb",
        environment: "neutral",
        variant: "camera",
      },
      {
        id: "access-terminal",
        title: "Терминал контроля доступа",
        type: "ОИБ · СКУД",
        short: "Считыватель карт и панель идентификации.",
        description:
          "Модель помогает показать элементы терминала и объяснить логику допуска пользователей в защищенные зоны.",
        features: [
          "демонстрация интерфейса считывателя",
          "связь с контроллером доступа",
          "использование в практической работе",
        ],
        model: "https://modelviewer.dev/shared-assets/models/NeilArmstrong.glb",
        environment: "neutral",
        variant: "terminal",
      },
    ],
  },
  {
    id: "pd",
    code: "ПД",
    title: "Правоохранительная деятельность",
    description: "Тренажеры, учебные образцы оружия и средства защиты.",
    equipment: [
      {
        id: "training-rifle",
        title: "Учебный макет ружья",
        type: "ПД · учебное оружие",
        short: "Безопасный тренажер для изучения устройства и правил обращения.",
        description:
          "Карточка предназначена для безопасной демонстрации элементов учебного макета без использования реального оружия.",
        features: [
          "изучение основных частей макета",
          "визуальная инструкция перед практикой",
          "QR-код на учебном шкафу или стенде",
        ],
        model: "https://modelviewer.dev/shared-assets/models/RobotExpressive.glb",
        environment: "neutral",
        variant: "rifle",
      },
      {
        id: "body-armor",
        title: "Средства индивидуальной защиты",
        type: "ПД · экипировка",
        short: "Шлем, бронежилет и элементы защитного комплекта.",
        description:
          "3D-просмотр подходит для демонстрации комплектации, назначения элементов и правильного размещения.",
        features: [
          "обзор защитных элементов",
          "сценарии использования на занятиях",
          "быстрый доступ с мобильного устройства",
        ],
        model: "https://modelviewer.dev/shared-assets/models/Astronaut.glb",
        environment: "neutral",
        variant: "armor",
      },
      {
        id: "forensic-kit",
        title: "Криминалистический набор",
        type: "ПД · лаборатория",
        short: "Комплект инструментов для учебных следственных действий.",
        description:
          "Интерактивная карточка помогает объяснить назначение инструментов набора и порядок подготовки рабочего места.",
        features: [
          "визуальный список компонентов",
          "подготовка к лабораторной работе",
          "ссылка на методические материалы",
        ],
        model: "https://modelviewer.dev/shared-assets/models/NeilArmstrong.glb",
        environment: "neutral",
        variant: "kit",
      },
    ],
  },
  {
    id: "zem",
    code: "ЗЕМ",
    title: "Земельно-имущественные отношения",
    description: "3D-рельеф, кадастровые участки и учебные геодезические объекты.",
    equipment: [
      {
        id: "terrain-relief",
        title: "3D визуализация рельефа",
        type: "ЗЕМ · рельеф",
        short: "Учебная поверхность для анализа высот и уклонов.",
        description:
          "Модель рельефа используется для объяснения перепадов высот, профилей местности и проектных ограничений.",
        features: [
          "вращение цифровой модели местности",
          "изучение уклонов и высотных отметок",
          "QR-ссылка для полевой практики",
        ],
        model: "https://modelviewer.dev/shared-assets/models/Houseplant.glb",
        environment: "landscape",
        variant: "terrain",
      },
      {
        id: "survey-point",
        title: "Геодезический пункт",
        type: "ЗЕМ · геодезия",
        short: "Точка опорной сети и учебный знак на местности.",
        description:
          "Карточка показывает назначение геодезического пункта и связь объекта с измерениями на территории.",
        features: [
          "объяснение опорной точки",
          "привязка к карте или плану",
          "открытие модели по QR-коду",
        ],
        model: "https://modelviewer.dev/shared-assets/models/NeilArmstrong.glb",
        environment: "landscape",
        variant: "point",
      },
      {
        id: "cadastre-parcel",
        title: "Кадастровый участок",
        type: "ЗЕМ · кадастр",
        short: "Учебный объект для разбора границ и характеристик участка.",
        description:
          "Сцена помогает связать 3D-представление участка с кадастровой информацией и учебными заданиями.",
        features: [
          "просмотр формы участка",
          "подготовка к анализу границ",
          "ссылка на цифровой паспорт объекта",
        ],
        model: "https://modelviewer.dev/shared-assets/models/Astronaut.glb",
        environment: "landscape",
        variant: "parcel",
      },
    ],
  },
];

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
const qrModal = document.querySelector("#qr-modal");
const qrCanvas = document.querySelector("#qr-canvas");
const qrCaption = document.querySelector("#qr-caption");
const qrDirectLink = document.querySelector("#qr-direct-link");
const qrButtons = document.querySelectorAll("#qr-open, #qr-open-secondary");

let activeSpecialtyId = specialties[0].id;
let activeEquipmentId = specialties[0].equipment[0].id;

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

function equipmentUrl(equipmentId) {
  const baseUrl = `${window.location.origin}${window.location.pathname}`;
  return `${baseUrl}#equipment=${equipmentId}`;
}

function setHash(equipmentId) {
  const nextHash = `equipment=${equipmentId}`;
  if (window.location.hash.replace("#", "") !== nextHash) {
    history.pushState(null, "", `#${nextHash}`);
  }
}

function renderSpecialties() {
  specialtyGrid.innerHTML = specialties
    .map(
      (specialty) => `
        <button class="specialty-card" type="button" data-specialty="${specialty.id}">
          <span class="specialty-card__code">${specialty.code}</span>
          <h3>${specialty.title}</h3>
          <p>${specialty.description}</p>
        </button>
      `,
    )
    .join("");

  specialtyGrid.addEventListener("click", (event) => {
    const card = event.target.closest("[data-specialty]");
    if (!card) return;

    const specialty = findSpecialty(card.dataset.specialty);
    activeSpecialtyId = specialty.id;
    activeEquipmentId = specialty.equipment[0].id;
    setHash(activeEquipmentId);
    render();
    document.querySelector("#viewer").scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function renderEquipmentList(specialty) {
  activeSpecialtyLabel.textContent = specialty.code;
  equipmentCount.textContent = `${specialty.equipment.length} объекта`;

  equipmentList.innerHTML = specialty.equipment
    .map(
      (equipment) => `
        <button class="equipment-button" type="button" data-equipment="${equipment.id}">
          <strong>${equipment.title}</strong>
          <span>${equipment.short}</span>
        </button>
      `,
    )
    .join("");
}

function renderActiveEquipment(equipment) {
  localViewer.setAttribute("aria-label", `Интерактивный 3D макет: ${equipment.title}`);
  equipmentShape.dataset.variant = equipment.variant;
  equipmentType.textContent = equipment.type;
  equipmentTitle.textContent = equipment.title;
  equipmentDescription.textContent = equipment.description;
  modelLink.href = equipment.model;

  equipmentFeatures.innerHTML = equipment.features.map((feature) => `<li>${feature}</li>`).join("");
}

function syncActiveStates() {
  document.querySelectorAll("[data-specialty]").forEach((card) => {
    card.classList.toggle("is-active", card.dataset.specialty === activeSpecialtyId);
  });

  document.querySelectorAll("[data-equipment]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.equipment === activeEquipmentId);
  });
}

function render() {
  const specialty = findSpecialty(activeSpecialtyId);
  const equipment = specialty.equipment.find((item) => item.id === activeEquipmentId) || specialty.equipment[0];

  activeSpecialtyId = specialty.id;
  activeEquipmentId = equipment.id;
  renderEquipmentList(specialty);
  renderActiveEquipment(equipment);
  syncActiveStates();
}

function openQrModal() {
  const { equipment } = findEquipment(activeEquipmentId);
  const url = equipmentUrl(equipment.id);

  drawQrCode(url);
  qrCaption.textContent = `${equipment.title}: отсканируйте код, чтобы открыть эту 3D-модель.`;
  qrDirectLink.href = url;
  qrDirectLink.textContent = url;
  qrModal.classList.add("is-open");
  qrModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function drawQrCode(text) {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();

  const context = qrCanvas.getContext("2d");
  const moduleCount = qr.getModuleCount();
  const margin = 12;
  const size = qrCanvas.width;
  const cellSize = Math.floor((size - margin * 2) / moduleCount);
  const qrSize = cellSize * moduleCount;
  const offset = Math.floor((size - qrSize) / 2);

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, size, size);
  context.fillStyle = "#020617";

  for (let row = 0; row < moduleCount; row += 1) {
    for (let col = 0; col < moduleCount; col += 1) {
      if (qr.isDark(row, col)) {
        context.fillRect(offset + col * cellSize, offset + row * cellSize, cellSize, cellSize);
      }
    }
  }
}

function closeQrModal() {
  qrModal.classList.remove("is-open");
  qrModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function initFromHash() {
  const hashParams = new URLSearchParams(window.location.hash.replace("#", ""));
  const searchParams = new URLSearchParams(window.location.search);
  const equipmentId = hashParams.get("equipment") || searchParams.get("equipment");
  if (!equipmentId) {
    activeSpecialtyId = specialties[0].id;
    activeEquipmentId = specialties[0].equipment[0].id;
    return;
  }

  const { specialty, equipment } = findEquipment(equipmentId);
  activeSpecialtyId = specialty.id;
  activeEquipmentId = equipment.id;
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

equipmentList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-equipment]");
  if (!button) return;

  const { specialty, equipment } = findEquipment(button.dataset.equipment);
  activeSpecialtyId = specialty.id;
  activeEquipmentId = equipment.id;
  setHash(equipment.id);
  render();
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

window.addEventListener("hashchange", () => {
  initFromHash();
  render();
});

let isDragging = false;
let lastPointer = { x: 0, y: 0 };
let rotation = { x: -22, y: 38 };

function setViewerRotation() {
  localScene.style.setProperty("--viewer-rx", `${rotation.x}deg`);
  localScene.style.setProperty("--viewer-ry", `${rotation.y}deg`);
}

localViewer.addEventListener("pointerdown", (event) => {
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

setViewerRotation();
initFromHash();
renderSpecialties();
render();
applyInitialViewOptions();
