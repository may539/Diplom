const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const seedData = require("./seed-data");

const PORT = Number(process.env.PORT || 8080);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

const app = express();
app.use(express.json({ limit: "1mb" }));

const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "equipment.sqlite");
const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) {
        reject(error);
        return;
      }
      resolve(this);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(rows);
    });
  });
}

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

async function initDb() {
  await run("PRAGMA foreign_keys = ON");
  await run(`
    CREATE TABLE IF NOT EXISTS specialties (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS equipment (
      id TEXT PRIMARY KEY,
      specialty_id TEXT NOT NULL,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      short TEXT NOT NULL,
      description TEXT NOT NULL,
      features_json TEXT NOT NULL,
      model TEXT NOT NULL,
      environment TEXT NOT NULL DEFAULT 'neutral',
      variant TEXT NOT NULL DEFAULT 'sensor',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (specialty_id) REFERENCES specialties(id) ON DELETE CASCADE
    )
  `);

  const specialtyRows = await all("SELECT id FROM specialties LIMIT 1");
  if (specialtyRows.length > 0) {
    return;
  }

  for (const [index, specialty] of seedData.entries()) {
    await run(
      "INSERT INTO specialties (id, code, title, description, sort_order) VALUES (?, ?, ?, ?, ?)",
      [specialty.id, specialty.code, specialty.title, specialty.description, index],
    );
    for (const equipment of specialty.equipment) {
      await run(
        `INSERT INTO equipment
          (id, specialty_id, title, type, short, description, features_json, model, environment, variant)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          equipment.id,
          specialty.id,
          equipment.title,
          equipment.type,
          equipment.short,
          equipment.description,
          JSON.stringify(equipment.features || []),
          equipment.model,
          equipment.environment || "neutral",
          equipment.variant || "sensor",
        ],
      );
    }
  }
}

async function getSpecialtiesPayload() {
  const specialties = await all(
    "SELECT id, code, title, description FROM specialties ORDER BY sort_order ASC, code ASC",
  );
  const equipment = await all(
    `SELECT id, specialty_id, title, type, short, description, features_json, model, environment, variant
     FROM equipment
     ORDER BY created_at ASC, title ASC`,
  );

  const bySpecialty = new Map();
  for (const row of equipment) {
    const normalized = {
      id: row.id,
      title: row.title,
      type: row.type,
      short: row.short,
      description: row.description,
      features: JSON.parse(row.features_json || "[]"),
      model: row.model,
      environment: row.environment,
      variant: row.variant,
    };
    if (!bySpecialty.has(row.specialty_id)) {
      bySpecialty.set(row.specialty_id, []);
    }
    bySpecialty.get(row.specialty_id).push(normalized);
  }

  return specialties.map((specialty) => ({
    ...specialty,
    equipment: bySpecialty.get(specialty.id) || [],
  }));
}

function assertAdmin(req, res) {
  const password = req.header("x-admin-password");
  if (!password || password !== ADMIN_PASSWORD) {
    res.status(401).json({
      error: "Требуется пароль администратора.",
    });
    return false;
  }
  return true;
}

app.get("/api/specialties", async (_req, res) => {
  try {
    const data = await getSpecialtiesPayload();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Не удалось загрузить каталог." });
  }
});

app.get("/api/admin/specialties", async (_req, res) => {
  try {
    const data = await all("SELECT id, code, title FROM specialties ORDER BY sort_order ASC, code ASC");
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Не удалось загрузить специальности." });
  }
});

app.post("/api/admin/equipment", async (req, res) => {
  if (!assertAdmin(req, res)) {
    return;
  }

  try {
    const {
      specialtyId,
      title,
      type,
      short,
      description,
      features = [],
      model,
      environment = "neutral",
      variant = "sensor",
    } = req.body || {};

    if (!specialtyId || !title || !type || !short || !description || !model) {
      res.status(400).json({ error: "Заполните все обязательные поля модели." });
      return;
    }

    const specialty = await all("SELECT id FROM specialties WHERE id = ?", [specialtyId]);
    if (specialty.length === 0) {
      res.status(400).json({ error: "Выбрана неизвестная специальность." });
      return;
    }

    const baseId = slugify(title) || "equipment";
    let equipmentId = baseId;
    let suffix = 1;
    while (true) {
      const existing = await all("SELECT id FROM equipment WHERE id = ?", [equipmentId]);
      if (existing.length === 0) {
        break;
      }
      suffix += 1;
      equipmentId = `${baseId}-${suffix}`;
    }

    const featureList = Array.isArray(features)
      ? features.filter((item) => typeof item === "string" && item.trim().length > 0).map((item) => item.trim())
      : [];

    await run(
      `INSERT INTO equipment
        (id, specialty_id, title, type, short, description, features_json, model, environment, variant)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        equipmentId,
        specialtyId,
        title.trim(),
        type.trim(),
        short.trim(),
        description.trim(),
        JSON.stringify(featureList),
        model.trim(),
        String(environment || "neutral").trim(),
        String(variant || "sensor").trim(),
      ],
    );

    const modelUrl = `${req.protocol}://${req.get("host")}/#equipment=${equipmentId}`;
    res.status(201).json({
      id: equipmentId,
      url: modelUrl,
      title: title.trim(),
    });
  } catch (error) {
    res.status(500).json({ error: "Не удалось сохранить модель." });
  }
});

app.use(express.static(__dirname));

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server started on http://localhost:${PORT}`);
      console.log(`SQLite database: ${dbPath}`);
    });
  })
  .catch((error) => {
    console.error("Startup error:", error);
    process.exitCode = 1;
  });
