const equipmentForm = document.querySelector("#equipment-form");
const specialtySelect = document.querySelector("#specialty-select");
const statusText = document.querySelector("#form-status");
const equipmentIdInput = document.querySelector("#equipment-id");
const formSubmitButton = document.querySelector("#form-submit");
const cancelEditButton = document.querySelector("#cancel-edit");
const catalogList = document.querySelector("#equipment-catalog-list");
const qrModal = document.querySelector("#qr-modal");
const qrCanvas = document.querySelector("#qr-canvas");
const qrCaption = document.querySelector("#qr-caption");
const qrModalTitle = document.querySelector("#qr-modal-title");
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

function setFormDisabled(isDisabled) {
  equipmentForm.querySelectorAll("input, textarea, select, button").forEach((control) => {
    control.disabled = isDisabled;
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function openModal(title) {
  if (title) {
    qrModalTitle.textContent = title;
  }
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

function isEditing() {
  return Boolean(equipmentIdInput.value.trim());
}

function setEditMode(item) {
  equipmentIdInput.value = item.id;
  specialtySelect.value = item.specialtyId;
  equipmentForm.querySelector('[name="title"]').value = item.title;
  equipmentForm.querySelector('[name="type"]').value = item.type;
  equipmentForm.querySelector('[name="short"]').value = item.short;
  equipmentForm.querySelector('[name="description"]').value = item.description;
  equipmentForm.querySelector('[name="features"]').value = (item.features || []).join("\n");
  equipmentForm.querySelector('[name="model"]').value = item.model.startsWith("/models/") ? "" : item.model;
  equipmentForm.querySelector('[name="variant"]').value = item.variant || "sensor";
  equipmentForm.querySelector('[name="environment"]').value = item.environment || "neutral";
  formSubmitButton.textContent = "Сохранить изменения";
  cancelEditButton.hidden = false;
  document.querySelector("#admin-form-title").textContent = `Редактирование: ${item.title}`;
  setStatus(`Редактируется объект «${item.title}». Загрузите новый .glb при необходимости.`);
  window.location.hash = "admin-form";
}

function clearEditMode() {
  equipmentIdInput.value = "";
  formSubmitButton.textContent = "Внести в паспорт и создать QR-код";
  cancelEditButton.hidden = true;
  document.querySelector("#admin-form-title").textContent = "Регистрация оборудования в паспорте кабинета";
  equipmentForm.reset();
}

async function loadSpecialties() {
  specialtySelect.innerHTML = "<option>Загрузка...</option>";
  try {
    const response = await fetch("/api/admin/specialties", { headers: authHeaders() });
    if (response.status === 401) {
      setAdminToken("");
      specialtySelect.innerHTML = "";
      setFormDisabled(true);
      setStatus("Сессия истекла. Вернитесь на главную страницу и откройте «Загрузить модель» заново.", true);
      showToast("Ошибка авторизации", "error");
      return;
    }

    if (!response.ok) {
      throw new Error("Не удалось получить список аудиторий.");
    }

    const specialties = await response.json();
    specialtySelect.innerHTML = specialties
      .map((item) => {
        const label = `${item.code} — ${item.title}`;
        return `<option value="${item.id}">${escapeHtml(label)}</option>`;
      })
      .join("");
    setFormDisabled(false);
  } catch (error) {
    specialtySelect.innerHTML = "";
    setFormDisabled(true);
    setStatus("Ошибка загрузки списка аудиторий. Проверьте, что сервер запущен.", true);
  }
}

async function loadCatalog() {
  if (!catalogList) {
    return;
  }

  catalogList.innerHTML = '<p class="admin-catalog__loading">Загрузка каталога…</p>';

  try {
    const response = await fetch("/api/admin/equipment", { headers: authHeaders() });
    if (response.status === 401) {
      catalogList.innerHTML = '<p class="admin-catalog__error">Требуется авторизация.</p>';
      return;
    }

    if (!response.ok) {
      throw new Error("Не удалось загрузить каталог.");
    }

    const items = await response.json();
    if (!items.length) {
      catalogList.innerHTML = '<p class="admin-catalog__empty">В базе пока нет объектов.</p>';
      return;
    }

    catalogList.innerHTML = items
      .map(
        (item) => `
          <article class="admin-catalog__item" data-id="${escapeHtml(item.id)}">
            <div class="admin-catalog__meta">
              <strong>${escapeHtml(item.title)}</strong>
              <span>${escapeHtml(`${item.specialtyCode || ""} · ${item.type || ""}`)}</span>
              <span class="admin-catalog__id">${escapeHtml(item.id)}</span>
            </div>
            <div class="admin-catalog__actions">
              <button class="button button--ghost" type="button" data-print-qr="${escapeHtml(item.id)}">
                Печать QR
              </button>
              ${
                String(item.model || "").startsWith("/models/")
                  ? `<button class="button button--ghost" type="button" data-normalize-glb="${escapeHtml(item.id)}">Исправить текстуры</button>`
                  : ""
              }
              <button class="button button--ghost" type="button" data-edit-equipment="${escapeHtml(item.id)}">
                Изменить
              </button>
              <button class="button button--ghost admin-catalog__delete" type="button" data-delete-equipment="${escapeHtml(item.id)}">
                Удалить
              </button>
            </div>
          </article>
        `,
      )
      .join("");

    catalogList._items = items;
  } catch (error) {
    catalogList.innerHTML = '<p class="admin-catalog__error">Ошибка загрузки списка.</p>';
  }
}

async function showQrForEquipment(item) {
  const response = await fetch(`/api/qr/${encodeURIComponent(item.id)}`, { headers: authHeaders() });
  const payload = response.ok ? await response.json() : { url: "", title: item.title };

  drawQrCode(payload.url || "");
  qrCaption.textContent = `${item.title} — отсканируйте QR для полноэкранного просмотра на телефоне.`;
  openModal(`QR: ${item.title}`);
}

function parseFeatures(value) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

async function normalizeEquipmentGlb(id) {
  const response = await fetch(`/api/admin/equipment/${encodeURIComponent(id)}/normalize-glb`, {
    method: "POST",
    headers: authHeaders(),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail = data.error || data.message || `Ошибка сервера (${response.status})`;
    showToast(detail, "error");
    return;
  }

  sessionStorage.setItem("catalogNeedsReload", "1");

  if (data.glbNormalized) {
    showToast(
      (data.message || "GLB обновлён.") + " На главной нажмите Ctrl+F5 (жёсткое обновление).",
      "success",
    );
    return;
  }

  if (data.reason === "no-textures-in-glb") {
    showToast(data.message || "В GLB нет текстур — нужен другой файл.", "error");
    return;
  }

  showToast(
    data.message || "Конвертация не изменила файл. Попробуйте перезагрузить GLB из Blender (metal/rough, встроенные текстуры).",
    "error",
  );
}

async function deleteEquipment(id) {
  const item = (catalogList._items || []).find((entry) => entry.id === id);
  const label = item ? item.title : id;
  if (!window.confirm(`Удалить объект «${label}» из базы?`)) {
    return;
  }

  const response = await fetch(`/api/admin/equipment/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: authHeaders(),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    showToast(data.error || "Не удалось удалить.", "error");
    return;
  }

  if (isEditing() && equipmentIdInput.value === id) {
    clearEditMode();
  }

  showToast("Объект удалён", "success");
  sessionStorage.setItem("catalogNeedsReload", "1");
  await loadCatalog();
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
  const editId = equipmentIdInput.value.trim();

  if (!editId && !hasFile && !modelUrl) {
    setStatus("Укажите URL модели или выберите файл .glb.", true);
    return;
  }

  const formData = new FormData(equipmentForm);
  formData.set("features", parseFeatures(String(formData.get("features") || "")).join("\n"));
  formData.delete("equipmentId");

  if (!hasFile) {
    formData.delete("glb");
  }

  const url = editId ? `/api/admin/equipment/${encodeURIComponent(editId)}` : "/api/admin/equipment";
  const method = editId ? "PUT" : "POST";

  setStatus(editId ? "Сохраняем изменения…" : "Сохраняем модель…");

  try {
    const response = await fetch(url, {
      method,
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
      throw new Error(data.error || "Ошибка сохранения модели.");
    }

    if (hasFile) {
      showToast("Файл загружен", "success");
    }
    if (data.glbNormalized) {
      showToast("GLB конвертирован в metal/rough — текстуры должны отображаться", "success");
    }
    showToast(editId ? "Изменения сохранены" : "Данные сохранены", "success");

    const qrResponse = await fetch(`/api/qr/${encodeURIComponent(data.id)}`, { headers: authHeaders() });
    const qrPayload = qrResponse.ok ? await qrResponse.json() : data;

    drawQrCode(qrPayload.url || data.url);
    qrCaption.textContent = `${data.title} — отсканируйте QR для полноэкранного просмотра на телефоне.`;
    openModal(editId ? `QR: ${data.title}` : "Новая модель добавлена");

    setStatus(editId ? "Изменения сохранены. QR обновлён." : "Модель добавлена. QR-код готов к печати.");
    sessionStorage.setItem("catalogNeedsReload", "1");
    clearEditMode();
    equipmentForm.reset();
    await loadCatalog();
  } catch (error) {
    setStatus(error.message, true);
  }
});

cancelEditButton.addEventListener("click", () => {
  clearEditMode();
  setStatus("");
});

catalogList?.addEventListener("click", async (event) => {
  const printButton = event.target.closest("[data-print-qr]");
  const normalizeButton = event.target.closest("[data-normalize-glb]");
  const editButton = event.target.closest("[data-edit-equipment]");
  const deleteButton = event.target.closest("[data-delete-equipment]");
  const items = catalogList._items || [];

  if (normalizeButton) {
    await normalizeEquipmentGlb(normalizeButton.dataset.normalizeGlb);
    return;
  }

  if (printButton) {
    const item = items.find((entry) => entry.id === printButton.dataset.printQr);
    if (item) {
      await showQrForEquipment(item);
    }
    return;
  }

  if (editButton) {
    const item = items.find((entry) => entry.id === editButton.dataset.editEquipment);
    if (item) {
      setEditMode(item);
    }
    return;
  }

  if (deleteButton) {
    await deleteEquipment(deleteButton.dataset.deleteEquipment);
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

function printQrSheet() {
  document.body.classList.add("is-printing-qr");
  window.print();
}

window.addEventListener("afterprint", () => {
  document.body.classList.remove("is-printing-qr");
});

printQrButton.addEventListener("click", printQrSheet);

async function initAdmin() {
  if (!getAdminToken()) {
    specialtySelect.innerHTML = "";
    setFormDisabled(true);
    if (catalogList) {
      catalogList.innerHTML = '<p class="admin-catalog__error">Войдите через «Загрузить модель» на главной странице.</p>';
    }
    setStatus("Откройте админ-панель через кнопку «Загрузить модель» на главной странице и введите пароль.", true);
    return;
  }

  await loadSpecialties();
  await loadCatalog();
}

initAdmin();
