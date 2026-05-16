const express = require("express");
const fs = require("fs");
const fsp = require("fs/promises");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const multer = require("multer");
const QRCode = require("qrcode");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const port = Number(process.env.PORT || 8080);
const host = process.env.HOST || "0.0.0.0";
const rootDir = __dirname;
const modelsPublicDir = path.join(rootDir, "public", "models");
/** Bcrypt hash for default password "admin123". Override with ADMIN_PASSWORD_HASH. */
const DEFAULT_ADMIN_PASSWORD_HASH = "$2b$10$/x0xBA8DU1ssl3WJePlLwuxS0.MEXRx/oLoNB3mT9cGYaZ5q.1JcO";
const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH || DEFAULT_ADMIN_PASSWORD_HASH;
const ADMIN_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const adminSessions = new Map();
const dataJsonPath = path.join(rootDir, "data", "equipment.json");
const dbPath = path.join(rootDir, "data", "equipment.sqlite");
const scanLogPath = path.join(rootDir, "logs", "scan.log");
const db = new sqlite3.Database(dbPath);

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

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, modelsPublicDir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase() || ".glb";
      const safeExt = ext === ".glb" ? ext : ".glb";
      const baseName = path.basename(file.originalname || "model", path.extname(file.originalname || ""));
      const base = slugify(baseName) || "model";
      cb(null, `${base}-${Date.now()}${safeExt}`);
    },
  }),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = String(file.originalname || "").toLowerCase();
    if (!name.endsWith(".glb")) {
      cb(new Error("Только файлы .glb."));
      return;
    }
    cb(null, true);
  },
});

function normalizeArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item) => typeof item === "string" && item.trim().length > 0).map((item) => item.trim());
}

async function initDb() {
  await fsp.mkdir(modelsPublicDir, { recursive: true });
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
  const base = resolvePublicBaseUrl(req);
  const url = new URL(base.endsWith("/") ? base : `${base}/`);
  url.searchParams.set("id", equipmentId);
  url.searchParams.set("scan", "1");
  return url.href;
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

function cleanupExpiredAdminSessions() {
  const now = Date.now();
  for (const [token, expiresAt] of adminSessions.entries()) {
    if (expiresAt <= now) {
      adminSessions.delete(token);
    }
  }
}

function assertAdmin(req, res) {
  cleanupExpiredAdminSessions();
  const authHeader = req.get("authorization") || "";
  const bearerMatch = authHeader.match(/^Bearer\s+(\S+)$/i);
  const token = bearerMatch ? bearerMatch[1] : req.get("x-admin-token");
  if (!token || !adminSessions.has(token)) {
    res.status(401).json({ error: "Требуется авторизация администратора." });
    return false;
  }
  const expiresAt = adminSessions.get(token);
  if (expiresAt <= Date.now()) {
    adminSessions.delete(token);
    res.status(401).json({ error: "Сессия истекла. Войдите снова." });
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

app.get("/api/equipment/:id", async (req, res, next) => {
  try {
    const equipment = await findEquipment(req.params.id);
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

app.post("/api/admin/login", async (req, res, next) => {
  try {
    const password = String((req.body && req.body.password) || "");
    const ok = password.length > 0 && (await bcrypt.compare(password, adminPasswordHash));
    if (!ok) {
      res.status(401).json({ error: "Неверный пароль." });
      return;
    }

    const token = crypto.randomBytes(32).toString("hex");
    adminSessions.set(token, Date.now() + ADMIN_SESSION_TTL_MS);
    res.json({
      token,
      expiresIn: Math.floor(ADMIN_SESSION_TTL_MS / 1000),
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/specialties", async (req, res, next) => {
  if (!assertAdmin(req, res)) {
    return;
  }

  try {
    const rows = await all("SELECT id, code, title FROM specialties ORDER BY sort_order ASC, code ASC");
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/equipment", (req, res, next) => {
  upload.single("glb")(req, res, (err) => {
    if (err) {
      next(err);
      return;
    }
    next();
  });
}, async (req, res, next) => {
  if (!assertAdmin(req, res)) {
    if (req.file) {
      await fsp.unlink(req.file.path).catch(() => {});
    }
    return;
  }

  try {
    const specialtyId = String(req.body.specialtyId || "").trim();
    const title = String(req.body.title || "").trim();
    const type = String(req.body.type || "").trim();
    const short = String(req.body.short || "").trim();
    const description = String(req.body.description || "").trim();
    const featuresRaw = req.body.features;
    const features =
      typeof featuresRaw === "string"
        ? normalizeArray(featuresRaw.split("\n"))
        : Array.isArray(featuresRaw)
          ? normalizeArray(featuresRaw)
          : [];
    const environment = String(req.body.environment || "neutral").trim();
    const variant = String(req.body.variant || "sensor").trim();

    let hotspots = [];
    if (req.body.hotspots) {
      try {
        const parsed = JSON.parse(String(req.body.hotspots));
        if (Array.isArray(parsed)) {
          hotspots = parsed;
        }
      } catch {
        hotspots = [];
      }
    }

    let model = String(req.body.model || "").trim();
    if (req.file) {
      model = `/models/${req.file.filename}`;
    }

    if (!specialtyId || !title || !type || !short || !description || !model) {
      if (req.file) {
        await fsp.unlink(req.file.path).catch(() => {});
      }
      res.status(400).json({ error: "Заполните все обязательные поля модели." });
      return;
    }

    const specialty = await get("SELECT id FROM specialties WHERE id = ?", [specialtyId]);
    if (!specialty) {
      if (req.file) {
        await fsp.unlink(req.file.path).catch(() => {});
      }
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

    await run(
      `INSERT INTO equipment
        (id, specialty_id, title, type, short, description, features_json, model, environment, variant, hotspots_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        equipmentId,
        specialtyId,
        title,
        type,
        short,
        description,
        JSON.stringify(features),
        model,
        environment,
        variant,
        JSON.stringify(hotspots),
      ],
    );

    res.status(201).json({
      id: equipmentId,
      title,
      url: equipmentUrl(req, equipmentId),
    });
  } catch (error) {
    if (req.file) {
      await fsp.unlink(req.file.path).catch(() => {});
    }
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
app.use("/models", express.static(modelsPublicDir, { index: false }));
app.use("/models", express.static(path.join(rootDir, "models"), { index: false }));
app.use(express.static(rootDir, { index: false }));

app.get("/", async (req, res, next) => {
  try {
    const equipmentId = req.query.id;
    if (equipmentId && req.query.scan === "1") {
      const equipment = await findEquipment(String(equipmentId));
      if (equipment) {
        await appendScanLog(req, equipment);
      }
    }
    sendIndex(res);
  } catch (error) {
    next(error);
  }
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
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({ error: "Файл слишком большой." });
      return;
    }
    res.status(400).json({ error: error.message || "Ошибка загрузки файла." });
    return;
  }
  if (error && error.message === "Только файлы .glb.") {
    res.status(400).json({ error: error.message });
    return;
  }
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
