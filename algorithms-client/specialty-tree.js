/**
 * Клиентский алгоритм модуля 1 (Приложение А):
 * рекурсивное построение дерева лабораторий из JSON API.
 */
(function initSpecialtyTreeAlgorithm(global) {
  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function buildSpecialtyTree(nodes) {
    const byParent = new Map();
    for (const node of nodes) {
      const parentKey = node.parentId == null || node.parentId === "" ? null : node.parentId;
      if (!byParent.has(parentKey)) {
        byParent.set(parentKey, []);
      }
      byParent.get(parentKey).push(node);
    }

    function walk(parentId) {
      const list = (byParent.get(parentId) || []).slice().sort((a, b) => {
        const d = (a.sortOrder || 0) - (b.sortOrder || 0);
        return d !== 0 ? d : String(a.code || a.id).localeCompare(String(b.code || b.id), "ru");
      });
      return list.map((node) => ({
        ...node,
        children: walk(node.id),
      }));
    }

    return walk(null);
  }

  async function fetchSpecialtyTree(apiUrl) {
    const response = await fetch(apiUrl || "/api/specialties/tree");
    if (!response.ok) {
      throw new Error("SPECIALTY_TREE_FETCH_FAILED");
    }
    const payload = await response.json();
    if (Array.isArray(payload.tree)) {
      return payload;
    }
    const nodes = payload.nodes || payload;
    return { nodes, tree: buildSpecialtyTree(nodes) };
  }

  function renderSpecialtyTreeHtml(tree, options) {
    const isAvailable = options?.isAvailable || (() => true);

    function renderLevel(nodes, depth) {
      if (!nodes.length) {
        return "";
      }
      return `<ul class="specialty-tree__level" data-depth="${depth}">${nodes
        .map((node) => {
          const available = isAvailable(node.id);
          const hasChildren = node.children && node.children.length > 0;
          const description = node.description ? `<span class="specialty-tree__passport">${escapeHtml(node.description)}</span>` : "";
          return `
            <li class="specialty-tree__item">
              <button
                type="button"
                class="specialty-tree__node${available ? "" : " is-disabled"}"
                data-specialty="${escapeHtml(node.id)}"
                ${available ? "" : 'disabled aria-disabled="true"'}
              >
                <span class="specialty-tree__code">${escapeHtml(node.code || node.id)}</span>
                <span class="specialty-tree__name">${escapeHtml(node.name || node.title || "")}</span>
                ${description}
              </button>
              ${hasChildren ? renderLevel(node.children, depth + 1) : ""}
            </li>
          `;
        })
        .join("")}</ul>`;
    }

  return renderLevel(tree, 0);
  }

  global.SpecialtyTreeAlgorithm = {
    buildSpecialtyTree,
    fetchSpecialtyTree,
    renderSpecialtyTreeHtml,
  };
})(window);
