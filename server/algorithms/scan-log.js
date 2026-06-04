/**
 * Алгоритм модуля 5: логирование сканирований QR (Приложение Д).
 */

async function insertScanLog(run, req, equipment) {
  const viewedAt = new Date().toISOString();
  const ip = req.ip || "unknown";
  const userAgent = req.get("user-agent") || "unknown";
  const route = req.originalUrl || req.url || "";

  await run(
    `INSERT INTO scan_logs (equipment_id, viewed_at, ip, user_agent, route)
     VALUES (?, ?, ?, ?, ?)`,
    [equipment.id, viewedAt, ip, userAgent, route],
  );

  return { equipmentId: equipment.id, viewedAt, ip, userAgent, route };
}

module.exports = {
  insertScanLog,
};
