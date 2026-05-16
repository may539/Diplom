const express = require("express");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const fs = require("fs");
const fsp = require("fs/promises");
const helmet = require("helmet");
const os = require("os");
const path = require("path");
const QRCode = require("qrcode");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const port = Number(process.env.PORT || 8080);
const host = process.env.HOST || "0.0.0.0";
const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
const rootDir = __dirname;
const dataJsonPath = path.join(rootDir, "data", "equipment.json");
const dbPath = path.join(rootDir, "data", "equipment.sqlite");
const scanLogPath = path.join(rootDir, "logs", "scan.log");
const db = new sqlite3.Database(dbPath);
const equipmentIdPattern = /^[a-zA-Z0-9-]+$/;
const sevenDaysInSeconds = 7 * 24 * 60 * 60;
const modelStaticOptions = {
  index: false,
  maxAge: "7d",
  immutable: true,
  setHeaders(res) {
    res.setHeader("Cache-Control", `public, max-age=${sevenDaysInSeconds}, immutable`);
  },
};

app.set("trust proxy", 1);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://unpkg.com", "https://ajax.googleapis.com", "https://cdn.jsdelivr.net"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https:"],
        modelSrc: ["'self'", "https:", "data:", "blob:"],
        workerSrc: ["'self'", "blob:"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
        "upgrade-insecure-requests": null,
      },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Слишком много запросов. Повторите попытку позже." },
  }),
);
app.use(compression());
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
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

function normalizeArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item) => typeof item === "string" && item.trim().length > 0).map((item) => item.trim());
}

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function normalizeEquipmentRow(row) {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    short: row.short,
    description: row.description,
    features: parseJsonArray(row.features_json),
    model: row.model,
    environment: row.environment,
    variant: row.variant,
    hotspots: parseJsonArray(row.hotspots_json),
    specialtyId: row.specialty_id,
    specialtyCode: row.specialty_code,
    specialtyTitle: row.specialty_title,
  };
}

function isValidEquipmentId(value) {
  return typeof value === "string" && equipmentIdPattern.test(value);
}

function validateEquipmentIdParam(req, res, next) {
  if (!isValidEquipmentId(req.params.equipmentId)) {
    res.status(400).json({ error: "Invalid equipment id" });
    return;
  }

  next();
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
    const normalized = normalizeEquipmentRow(row);
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
  const row = await get(
    `SELECT
       e.id,
       e.specialty_id,
       e.title,
       e.type,
       e.short,
       e.description,
       e.features_json,
       e.model,
       e.environment,
       e.variant,
       e.hotspots_json,
       s.code AS specialty_code,
       s.title AS specialty_title
     FROM equipment e
     INNER JOIN specialties s ON s.id = e.specialty_id
     WHERE e.id = ?`,
    [equipmentId],
  );

  return row ? normalizeEquipmentRow(row) : null;
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

app.get("/api/equipment/:equipmentId", validateEquipmentIdParam, async (req, res, next) => {
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

app.get("/api/qr/:equipmentId", validateEquipmentIdParam, async (req, res, next) => {
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

app.get("/api/admin/specialties", async (_req, res, next) => {
  try {
    const rows = await all("SELECT id, code, title FROM specialties ORDER BY sort_order ASC, code ASC");
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/equipment", async (req, res, next) => {
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
      hotspots = [],
    } = req.body || {};

    if (!specialtyId || !title || !type || !short || !description || !model) {
      res.status(400).json({ error: "Заполните все обязательные поля модели." });
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

    await run(
      `INSERT INTO equipment
        (id, specialty_id, title, type, short, description, features_json, model, environment, variant, hotspots_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        equipmentId,
        specialtyId,
        title.trim(),
        type.trim(),
        short.trim(),
        description.trim(),
        JSON.stringify(normalizeArray(features)),
        model.trim(),
        String(environment || "neutral").trim(),
        String(variant || "sensor").trim(),
        JSON.stringify(Array.isArray(hotspots) ? hotspots : []),
      ],
    );

    res.status(201).json({
      id: equipmentId,
      title: title.trim(),
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
app.use("/models", express.static(path.join(rootDir, "public", "models"), modelStaticOptions));
app.use("/models", express.static(path.join(rootDir, "models"), modelStaticOptions));
app.use(express.static(rootDir, { index: false }));

app.get("/", async (req, res, next) => {
  try {
    const equipmentId = req.query.id;
    if (equipmentId && !isValidEquipmentId(String(equipmentId))) {
      res.status(400).send("Invalid equipment id");
      return;
    }

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

app.get("/equipment/:equipmentId", validateEquipmentIdParam, async (req, res, next) => {
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
