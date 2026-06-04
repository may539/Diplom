/**
 * Алгоритм модуля 1: динамическое построение дерева специальностей (Приложение А).
 * SQL: SELECT id, title AS name, parent_id AS parentId, sort_order AS sortOrder ...
 */

async function fetchSpecialtyNodes(all) {
  return all(
    `SELECT
       id,
       code,
       title AS name,
       description,
       parent_id AS parentId,
       sort_order AS sortOrder
     FROM specialties
     ORDER BY sort_order ASC, code ASC`,
  );
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

  const sortNodes = (list) =>
    list.sort((a, b) => {
      const orderDiff = (a.sortOrder || 0) - (b.sortOrder || 0);
      if (orderDiff !== 0) {
        return orderDiff;
      }
      return String(a.code || a.id).localeCompare(String(b.code || b.id), "ru");
    });

  function attachChildren(parentId) {
    const level = sortNodes([...(byParent.get(parentId) || [])]);
    return level.map((node) => ({
      ...node,
      children: attachChildren(node.id),
    }));
  }

  return attachChildren(null);
}

async function getSpecialtyTree(all) {
  const nodes = await fetchSpecialtyNodes(all);
  return {
    nodes,
    tree: buildSpecialtyTree(nodes),
  };
}

module.exports = {
  fetchSpecialtyNodes,
  buildSpecialtyTree,
  getSpecialtyTree,
};
