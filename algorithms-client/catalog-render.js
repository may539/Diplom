/**
 * Клиентский алгоритм модуля 2 (Приложение Б):
 * загрузка каталога по specialtyId и отрисовка списка + 3D-плеера.
 */
(function initCatalogRenderAlgorithm(global) {
  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  async function fetchEquipmentBySpecialty(specialtyId) {
    const url = `/api/equipment?specialtyId=${encodeURIComponent(specialtyId)}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("EQUIPMENT_CATALOG_FETCH_FAILED");
    }
    return response.json();
  }

  function clearEquipmentListContainer(container) {
    if (container) {
      container.innerHTML = "";
    }
  }

  function renderEquipmentListHtml(items) {
    if (!items.length) {
      return '<p class="equipment-list__empty">Для этой специальности пока нет объектов.</p>';
    }
    return items
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

  /**
   * @param {object} ctx — колбэки от app.js (очистка, GLB, панель описания)
   */
  async function loadAndRenderCatalog(specialtyId, ctx) {
    clearEquipmentListContainer(ctx.equipmentListEl);
    const items = await fetchEquipmentBySpecialty(specialtyId);
    ctx.equipmentListEl.innerHTML = renderEquipmentListHtml(items);

    const first = items[0] || null;
    if (first && typeof ctx.applyEquipmentToViewer === "function") {
      await ctx.applyEquipmentToViewer(first);
      if (typeof ctx.setActiveEquipmentId === "function") {
        ctx.setActiveEquipmentId(first.id);
      }
    } else if (typeof ctx.showEmptyCatalog === "function") {
      ctx.showEmptyCatalog();
    }

    return items;
  }

  global.CatalogRenderAlgorithm = {
    fetchEquipmentBySpecialty,
    clearEquipmentListContainer,
    renderEquipmentListHtml,
    loadAndRenderCatalog,
  };
})(window);
