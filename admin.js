const form = document.querySelector("#equipment-form");
const specialtySelect = document.querySelector("#specialty-select");
const statusText = document.querySelector("#form-status");
const qrModal = document.querySelector("#qr-modal");
const qrCanvas = document.querySelector("#qr-canvas");
const qrCaption = document.querySelector("#qr-caption");
const qrDirectLink = document.querySelector("#qr-direct-link");
const printQrButton = document.querySelector("#print-qr");

function setStatus(text, isError = false) {
  statusText.textContent = text;
  statusText.classList.toggle("is-error", isError);
}

function openModal() {
  qrModal.classList.add("is-open");
  qrModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeModal() {
  qrModal.classList.remove("is-open");
  qrModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function drawQrCode(text) {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();

  const context = qrCanvas.getContext("2d");
  const moduleCount = qr.getModuleCount();
  const margin = 16;
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

async function loadSpecialties() {
  specialtySelect.innerHTML = "<option>Загрузка...</option>";
  try {
    const response = await fetch("/api/admin/specialties", { headers: { Accept: "application/json" } });
    if (!response.ok) {
      throw new Error("Не удалось получить специальности.");
    }

    const specialties = await response.json();
    specialtySelect.innerHTML = specialties
      .map((item) => `<option value="${item.id}">${item.code} — ${item.title}</option>`)
      .join("");
  } catch (error) {
    specialtySelect.innerHTML = "";
    setStatus("Ошибка загрузки специальностей. Проверьте, что сервер запущен.", true);
  }
}

function parseFeatures(value) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const password = String(formData.get("password") || "");

  const payload = {
    specialtyId: String(formData.get("specialtyId") || ""),
    title: String(formData.get("title") || ""),
    type: String(formData.get("type") || ""),
    short: String(formData.get("short") || ""),
    description: String(formData.get("description") || ""),
    features: parseFeatures(String(formData.get("features") || "")),
    model: String(formData.get("model") || ""),
    variant: String(formData.get("variant") || "sensor"),
    environment: String(formData.get("environment") || "neutral"),
  };

  setStatus("Сохраняем модель...");

  try {
    const response = await fetch("/api/admin/equipment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-password": password,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Ошибка добавления модели.");
    }

    drawQrCode(data.url);
    qrCaption.textContent = `${data.title} — QR-код для распечатки и размещения на учебном оборудовании.`;
    qrDirectLink.href = data.url;
    qrDirectLink.textContent = data.url;
    openModal();
    setStatus("Модель добавлена. QR-код готов к печати.");
    form.reset();
  } catch (error) {
    setStatus(error.message, true);
  }
});

qrModal.addEventListener("click", (event) => {
  if (event.target.matches("[data-close-modal]")) {
    closeModal();
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeModal();
  }
});

printQrButton.addEventListener("click", () => {
  window.print();
});

loadSpecialties();
