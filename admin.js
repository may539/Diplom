const loginForm = document.querySelector("#admin-login-form");
const equipmentForm = document.querySelector("#equipment-form");
const specialtySelect = document.querySelector("#specialty-select");
const statusText = document.querySelector("#form-status");
const qrModal = document.querySelector("#qr-modal");
const qrCanvas = document.querySelector("#qr-canvas");
const qrCaption = document.querySelector("#qr-caption");
const qrDirectLink = document.querySelector("#qr-direct-link");
const printQrButton = document.querySelector("#print-qr");
const toastRegion = document.querySelector("#admin-toast-region");

const ADMIN_TOKEN_KEY = "adminToken";

function getAdminToken() {
  return sessionStorage.getItem(ADMIN_TOKEN_KEY) || "";
}

function setAdminToken(token) {
  if (token) {
    sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
  } else {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  }
}

function showToast(message, variant = "info") {
  const toast = document.createElement("div");
  toast.className = `admin-toast admin-toast--${variant}`;
  toast.setAttribute("role", "status");
  toast.textContent = message;
  toastRegion.appendChild(toast);
  window.setTimeout(() => {
    toast.classList.add("admin-toast--out");
    window.setTimeout(() => toast.remove(), 320);
  }, 4200);
}

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

function authHeaders() {
  const token = getAdminToken();
  const headers = { Accept: "application/json" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function loadSpecialties() {
  specialtySelect.innerHTML = "<option>Загрузка...</option>";
  try {
    const response = await fetch("/api/admin/specialties", { headers: authHeaders() });
    if (response.status === 401) {
      setAdminToken("");
      specialtySelect.innerHTML = "";
      setStatus("Войдите с паролем администратора.", true);
      showToast("Ошибка авторизации", "error");
      return;
    }

    if (!response.ok) {
      throw new Error("Не удалось получить специальности.");
    }

    const specialties = await response.json();
    specialtySelect.innerHTML = specialties
      .map((item) => `<option value="${item.id}">${item.code} — ${item.title}</option>`)
      .join("");
    setStatus("");
  } catch (error) {
    specialtySelect.innerHTML = "";
    setStatus("Ошибка загрузки специальностей. Проверьте, что сервер запущен.", true);
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  const password = String(formData.get("loginPassword") || "");

  try {
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ password }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      showToast("Ошибка авторизации", "error");
      setStatus(data.error || "Неверный пароль.", true);
      return;
    }

    setAdminToken(data.token);
    setStatus("");
    await loadSpecialties();
    showToast("Вход выполнен", "success");
  } catch {
    showToast("Ошибка авторизации", "error");
  }
});

function parseFeatures(value) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

equipmentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const token = getAdminToken();
  if (!token) {
    showToast("Ошибка авторизации", "error");
    return;
  }

  const fileInput = equipmentForm.querySelector('input[name="glb"]');
  const modelInput = equipmentForm.querySelector('input[name="model"]');
  const modelUrl = String(modelInput.value || "").trim();
  const hasFile = fileInput && fileInput.files && fileInput.files.length > 0;

  if (!hasFile && !modelUrl) {
    setStatus("Укажите URL модели или выберите файл .glb.", true);
    return;
  }

  const formData = new FormData(equipmentForm);
  formData.set("features", parseFeatures(String(formData.get("features") || "")).join("\n"));

  if (!hasFile) {
    formData.delete("glb");
  }

  setStatus("Сохраняем модель...");

  try {
    const response = await fetch("/api/admin/equipment", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      setAdminToken("");
      showToast("Ошибка авторизации", "error");
      setStatus(data.error || "Сессия истекла. Войдите снова.", true);
      return;
    }

    if (!response.ok) {
      throw new Error(data.error || "Ошибка добавления модели.");
    }

    if (hasFile) {
      showToast("Файл загружен", "success");
    }
    showToast("Данные сохранены", "success");

    drawQrCode(data.url);
    qrCaption.textContent = `${data.title} — QR-код для распечатки и размещения на учебном оборудовании.`;
    qrDirectLink.href = data.url;
    qrDirectLink.textContent = data.url;
    openModal();
    setStatus("Модель добавлена. QR-код готов к печати.");
    equipmentForm.reset();
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

if (getAdminToken()) {
  loadSpecialties();
} else {
  specialtySelect.innerHTML = "";
  setStatus("Сначала войдите с паролем администратора.", true);
}
