const express = require("express");
const fs = require("fs");
const fsp = require("fs/promises");
const os = require("os");
const path = require("path");
const QRCode = require("qrcode");
const sqlite3 = require("sqlite3").verbose();
const multer = require("multer");

const app = express();
const port = Number(process.env.PORT || 8080);
const host = process.env.HOST || "0.0.0.0";
const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
const rootDir = __dirname;
const dataJsonPath = path.join(rootDir, "data", "equipment.json");
const dbPath = path.join(rootDir, "data", "equipment.sqlite");
const scanLogPath = path.join(rootDir, "logs", "scan.log");
const uploadsDir = path.join(rootDir, "models", "uploads");
const db = new sqlite3.Database(dbPath);

fs.mkdirSync(uploadsDir, { recursive: true });

const modelUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const safeBase = String(file.originalname || "model")
        .toLowerCase()
        .replace(/[^a-z0-9.-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "model";
      const stamp = Date.now().toString(36);
      const ext = path.extname(safeBase) || ".glb";
      const stem = path.basename(safeBase, ext) || "model";
      cb(null, `${stem}-${stamp}${ext}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (ext === ".glb" || ext === ".gltf") {
      cb(null, true);
      return;
    }
    cb(new Error("Можно загружать только файлы .glb или .gltf."));
  },
});

app.set("trust proxy", true);
app.use(express.json({ limit: "1mb" }));

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

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(row || null);
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

function readJsonSeed() {
  return JSON.parse(fs.readFileSync(dataJsonPath, "utf8"));
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

function normalizeArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item) => typeof item === "string" && item.trim().length > 0).map((item) => item.trim());
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
      hotspots_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (specialty_id) REFERENCES specialties(id) ON DELETE CASCADE
    )
  `);

  const tableInfo = await all("PRAGMA table_info(equipment)");
  const hasHotspotsColumn = tableInfo.some((column) => column.name === "hotspots_json");
  if (!hasHotspotsColumn) {
    await run("ALTER TABLE equipment ADD COLUMN hotspots_json TEXT NOT NULL DEFAULT '[]'");
  }

  await run(`
    CREATE TABLE IF NOT EXISTS help_articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const helpCountRow = await get("SELECT COUNT(*) AS count FROM help_articles");
  if ((helpCountRow?.count || 0) === 0) {
    const seedArticles = [
      {
        slug: "qr-mode",
        title: "Что такое QR-режим?",
        body:
          "После сканирования QR-кода со стенда страница открывается с параметром ?equipment=<id>. " +
          "В этом режиме лендинг скрывается, а 3D-модель занимает весь экран — удобно для мобильного.",
        sort_order: 1,
      },
      {
        slug: "add-model",
        title: "Как добавить новую 3D-модель?",
        body:
          "Откройте меню (кнопка с тремя полосками) → «Загрузить модель». Введите мастер-пароль, " +
          "выберите специальность и заполните карточку. Можно указать ссылку на GLB или загрузить файл с диска. " +
          "После сохранения сразу появится QR-код для печати.",
        sort_order: 2,
      },
      {
        slug: "supported-formats",
        title: "Поддерживаемые форматы",
        body:
          "Используются модели формата GLB (рекомендуется) или GLTF. Размер файла — до 50 МБ. " +
          "Для лучшей совместимости с мобильными браузерами держите модель в пределах 5–10 МБ.",
        sort_order: 3,
      },
      {
        slug: "admin-access",
        title: "Доступ к админ-панели",
        body:
          "Пароль по умолчанию: admin123. На production задайте переменную окружения ADMIN_PASSWORD " +
          "при запуске сервера, например: ADMIN_PASSWORD=\"strong-pass\" npm start.",
        sort_order: 4,
      },
      {
        slug: "deploy-vm",
        title: "Развёртывание на Linux-VM",
        body:
          "Установите Node.js 18+, выполните npm install, затем npm start. Для постоянной работы " +
          "используйте systemd-юнит (см. README) или pm2. Сервер слушает порт 8080 (можно изменить через PORT).",
        sort_order: 5,
      },
    ];

    for (const article of seedArticles) {
      await run(
        "INSERT INTO help_articles (slug, title, body, sort_order) VALUES (?, ?, ?, ?)",
        [article.slug, article.title, article.body, article.sort_order],
      );
    }
  }

  const seedSpecialties = readJsonSeed();
  const seedEquipment = seedSpecialties.flatMap((specialty) => specialty.equipment || []);
  for (const equipment of seedEquipment) {
    await run(
      `UPDATE equipment
       SET hotspots_json = ?
       WHERE id = ?
         AND (hotspots_json IS NULL OR hotspots_json = '[]' OR hotspots_json = 'null')`,
      [JSON.stringify(Array.isArray(equipment.hotspots) ? equipment.hotspots : []), equipment.id],
    );
  }

  const countRow = await get("SELECT COUNT(*) AS count FROM specialties");
  if ((countRow?.count || 0) > 0) {
    return;
  }

  for (const [index, specialty] of seedSpecialties.entries()) {
    await run(
      "INSERT INTO specialties (id, code, title, description, sort_order) VALUES (?, ?, ?, ?, ?)",
      [specialty.id, specialty.code, specialty.title, specialty.description, index],
    );

    for (const equipment of specialty.equipment || []) {
      await run(
        `INSERT INTO equipment
          (id, specialty_id, title, type, short, description, features_json, model, environment, variant, hotspots_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          equipment.id,
          specialty.id,
          equipment.title,
          equipment.type,
          equipment.short,
          equipment.description,
          JSON.stringify(normalizeArray(equipment.features)),
          equipment.model,
          equipment.environment || "neutral",
          equipment.variant || "sensor",
          JSON.stringify(Array.isArray(equipment.hotspots) ? equipment.hotspots : []),
        ],
      );
    }
  }
}

async function readSpecialties() {
  const specialties = await all(
    "SELECT id, code, title, description FROM specialties ORDER BY sort_order ASC, code ASC",
  );
  const equipmentRows = await all(
    `SELECT id, specialty_id, title, type, short, description, features_json, model, environment, variant, hotspots_json
     FROM equipment
     ORDER BY created_at ASC, title ASC`,
  );

  const bySpecialty = new Map();
  for (const row of equipmentRows) {
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
      hotspots: JSON.parse(row.hotspots_json || "[]"),
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

async function allEquipment() {
  const specialties = await readSpecialties();
  return specialties.flatMap((specialty) =>
    specialty.equipment.map((equipment) => ({
      ...equipment,
      specialtyId: specialty.id,
      specialtyCode: specialty.code,
      specialtyTitle: specialty.title,
    })),
  );
}

async function findEquipment(equipmentId) {
  const equipment = await allEquipment();
  return equipment.find((item) => item.id === equipmentId) || null;
}

function getLanAddress() {
  const interfaces = os.networkInterfaces();

  for (const entries of Object.values(interfaces)) {
    for (const entry of entries || []) {
      if (entry.family === "IPv4" && !entry.internal) {
        return entry.address;
      }
    }
  }

  return "127.0.0.1";
}

function isLoopbackHost(hostname) {
  return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname);
}

function resolvePublicBaseUrl(req) {
  if (process.env.PUBLIC_BASE_URL) {
    return process.env.PUBLIC_BASE_URL.replace(/\/$/, "");
  }

  const protocol = String(req.headers["x-forwarded-proto"] || req.protocol || "http").split(",")[0];
  const requestHost = req.get("host") || `${getLanAddress()}:${port}`;
  const baseUrl = new URL(`${protocol}://${requestHost}`);

  if (isLoopbackHost(baseUrl.hostname)) {
    baseUrl.hostname = getLanAddress();
  }

  return baseUrl.toString().replace(/\/$/, "");
}

function equipmentUrl(req, equipmentId) {
  return `${resolvePublicBaseUrl(req)}/equipment/${encodeURIComponent(equipmentId)}?scan=1`;
}

async function appendScanLog(req, equipment) {
  const entry = {
    equipmentId: equipment.id,
    equipmentTitle: equipment.title,
    viewedAt: new Date().toISOString(),
    route: req.originalUrl,
    ip: req.ip,
    userAgent: req.get("user-agent") || "unknown",
  };

  await fsp.mkdir(path.dirname(scanLogPath), { recursive: true });
  await fsp.appendFile(scanLogPath, `${JSON.stringify(entry)}\n`, "utf8");
}

function sendIndex(res) {
  res.sendFile(path.join(rootDir, "index.html"));
}

function assertAdmin(req, res) {
  const password = req.header("x-admin-password");
  if (!password || password !== adminPassword) {
    res.status(401).json({ error: "Требуется пароль администратора." });
    return false;
  }
  return true;
}

app.get("/api/specialties", async (_req, res, next) => {
  try {
    res.json(await readSpecialties());
  } catch (error) {
    next(error);
  }
});

app.get("/api/equipment", async (_req, res, next) => {
  try {
    res.json(await allEquipment());
  } catch (error) {
    next(error);
  }
});

app.get("/api/equipment/:equipmentId", async (req, res, next) => {
  try {
    const equipment = await findEquipment(req.params.equipmentId);
    if (!equipment) {
      res.status(404).json({ error: "Equipment not found" });
      return;
    }
    res.json(equipment);
  } catch (error) {
    next(error);
  }
});

app.get("/api/qr/:equipmentId", async (req, res, next) => {
  try {
    const equipment = await findEquipment(req.params.equipmentId);
    if (!equipment) {
      res.status(404).json({ error: "Equipment not found" });
      return;
    }

    const url = equipmentUrl(req, equipment.id);
    const imageDataUrl = await QRCode.toDataURL(url, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 240,
    });

    res.json({
      equipmentId: equipment.id,
      title: equipment.title,
      url,
      imageDataUrl,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/help-articles", async (_req, res, next) => {
  try {
    const rows = await all(
      "SELECT id, slug, title, body, sort_order FROM help_articles ORDER BY sort_order ASC, id ASC",
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.get("/api/help-articles/:slug", async (req, res, next) => {
  try {
    const row = await get(
      "SELECT id, slug, title, body, sort_order FROM help_articles WHERE slug = ?",
      [req.params.slug],
    );
    if (!row) {
      res.status(404).json({ error: "Статья не найдена." });
      return;
    }
    res.json(row);
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/auth", (req, res) => {
  if (!assertAdmin(req, res)) {
    return;
  }
  res.json({ ok: true });
});

app.get("/api/admin/specialties", async (_req, res, next) => {
  try {
    const rows = await all("SELECT id, code, title FROM specialties ORDER BY sort_order ASC, code ASC");
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

function parseFeaturesPayload(value) {
  if (Array.isArray(value)) {
    return normalizeArray(value);
  }
  if (typeof value === "string" && value.trim().length > 0) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return normalizeArray(parsed);
      }
    } catch (_error) {
      // not JSON — fall through and treat as newline list
    }
    return value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }
  return [];
}

const adminEquipmentMiddleware = (req, res, next) => {
  const contentType = String(req.headers["content-type"] || "");
  if (contentType.startsWith("multipart/form-data")) {
    modelUpload.single("modelFile")(req, res, next);
    return;
  }
  next();
};

app.post("/api/admin/equipment", adminEquipmentMiddleware, async (req, res, next) => {
  if (!assertAdmin(req, res)) {
    return;
  }

  try {
    const body = req.body || {};
    const {
      specialtyId,
      title,
      type,
      short,
      description,
      features,
      model,
      environment = "neutral",
      variant = "sensor",
      hotspots,
    } = body;

    let resolvedModel = typeof model === "string" ? model.trim() : "";
    if (req.file) {
      resolvedModel = `/models/uploads/${req.file.filename}`;
    }

    if (!specialtyId || !title || !type || !short || !description || !resolvedModel) {
      res.status(400).json({
        error:
          "Заполните все обязательные поля модели и укажите ссылку на GLB или загрузите файл.",
      });
      return;
    }

    const specialty = await get("SELECT id FROM specialties WHERE id = ?", [specialtyId]);
    if (!specialty) {
      res.status(400).json({ error: "Выбрана неизвестная специальность." });
      return;
    }

    const baseId = slugify(title) || "equipment";
    let equipmentId = baseId;
    let suffix = 1;
    while (await get("SELECT id FROM equipment WHERE id = ?", [equipmentId])) {
      suffix += 1;
      equipmentId = `${baseId}-${suffix}`;
    }

    let parsedHotspots = [];
    if (Array.isArray(hotspots)) {
      parsedHotspots = hotspots;
    } else if (typeof hotspots === "string" && hotspots.trim().length > 0) {
      try {
        const value = JSON.parse(hotspots);
        if (Array.isArray(value)) {
          parsedHotspots = value;
        }
      } catch (_error) {
        parsedHotspots = [];
      }
    }

    await run(
      `INSERT INTO equipment
        (id, specialty_id, title, type, short, description, features_json, model, environment, variant, hotspots_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        equipmentId,
        specialtyId,
        String(title).trim(),
        String(type).trim(),
        String(short).trim(),
        String(description).trim(),
        JSON.stringify(parseFeaturesPayload(features)),
        resolvedModel,
        String(environment || "neutral").trim(),
        String(variant || "sensor").trim(),
        JSON.stringify(parsedHotspots),
      ],
    );

    res.status(201).json({
      id: equipmentId,
      title: String(title).trim(),
      model: resolvedModel,
      url: equipmentUrl(req, equipmentId),
    });
  } catch (error) {
    next(error);
  }
});

app.get(["/app.js", "/equipment/app.js"], (_req, res) => {
  res.sendFile(path.join(rootDir, "app.js"));
});

app.get(["/styles.css", "/equipment/styles.css"], (_req, res) => {
  res.sendFile(path.join(rootDir, "styles.css"));
});

app.get(["/data/equipment-data.js", "/equipment/data/equipment-data.js"], (_req, res) => {
  res.sendFile(path.join(rootDir, "data", "equipment-data.js"));
});

app.use("/vendor", express.static(path.join(rootDir, "vendor"), { index: false }));
app.use("/models", express.static(path.join(rootDir, "models"), { index: false }));
app.use(express.static(rootDir, { index: false }));

app.get("/", (_req, res) => {
  sendIndex(res);
});

app.get("/equipment/:equipmentId", async (req, res, next) => {
  try {
    const equipment = await findEquipment(req.params.equipmentId);
    if (!equipment) {
      res.status(404).send("Equipment not found");
      return;
    }

    if (req.query.scan === "1") {
      await appendScanLog(req, equipment);
    }

    sendIndex(res);
  } catch (error) {
    next(error);
  }
});

app.use((req, res) => {
  res.status(404).send("Not found");
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "Internal server error" });
});

initDb()
  .then(() => {
    app.listen(port, host, () => {
      const lanAddress = getLanAddress();
      console.log(`Server listening on http://${host}:${port}`);
      console.log(`LAN URL: http://${lanAddress}:${port}`);
      console.log(`SQLite database: ${dbPath}`);
    });
  })
  .catch((error) => {
    console.error("Startup error:", error);
    process.exitCode = 1;
  });
