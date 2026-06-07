const express = require("express");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const fs = require("fs");
const fsp = require("fs/promises");
const helmet = require("helmet");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const multer = require("multer");
const QRCode = require("qrcode");
const sqlite3 = require("sqlite3").verbose();
const algorithms = require("./server/algorithms");
const { normalizeGlbInPlace } = require("./lib/normalize-glb");
const { equipmentModelUrl } = require("./lib/model-url");
const { computeFileMetadata } = require("./server/algorithms/file-metadata");

const app = express();
const port = Number(process.env.PORT || 8080);
const host = process.env.HOST || "0.0.0.0";
const rootDir = __dirname;
const modelsPublicDir = path.join(rootDir, "public", "models");
/** Bcrypt hash for default password "admin123". Prefer ADMIN_PASSWORD_HASH in production. */
const DEFAULT_ADMIN_PASSWORD_HASH = "$2b$10$/x0xBA8DU1ssl3WJePlLwuxS0.MEXRx/oLoNB3mT9cGYaZ5q.1JcO";
const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH || DEFAULT_ADMIN_PASSWORD_HASH;
const adminPasswordPlain = process.env.ADMIN_PASSWORD || "";
const ADMIN_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const adminSessions = new Map();
const dataJsonPath = path.join(rootDir, "data", "equipment.json");
const dbPath = path.join(rootDir, "data", "equipment.sqlite");
const scanLogPath = path.join(rootDir, "logs", "scan.log");
const db = new sqlite3.Database(dbPath);
const equipmentIdPattern = /^[a-zA-Z0-9-]+$/;
const legacySeedEquipmentIds = [
  "security-sensor",
  "access-terminal",
  "training-rifle",
  "body-armor",
  "terrain-relief",
  "survey-point",
  "cadastre-parcel",
];
const seedModelAliases = {
  "video-surveillance-complex": [
    "Комплекс видеонаблюдения",
    "видеонаблюдение",
    "video surveillance",
    "video-surveillance",
    "surveillance",
    "cctv",
  ],
  "ip-camera": ["IP-камера", "ip camera", "ip-camera", "ipcamera"],
  "forensic-kit": [
    "Криминалистический набор",
    "криминалистика",
    "forensic kit",
    "forensic",
    "criminalistic",
  ],
  "electroshock-device": ["Электрошокер", "electroshock", "shocker", "taser", "elektroshoker"],
  "electronic-tachymeter": [
    "Электронный тахеометр",
    "тахеометр",
    "tachymeter",
    "tacheometer",
    "total station",
    "total-station",
    "taheometr",
  ],
};
const sevenDaysInSeconds = 7 * 24 * 60 * 60;
const modelStaticOptions = {
  index: false,
  maxAge: "7d",
  setHeaders(res, filePath) {
    res.setHeader("Cache-Control", `public, max-age=${sevenDaysInSeconds}`);
    if (filePath.endsWith(".glb")) {
      res.setHeader("Content-Type", "model/gltf-binary");
    }
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
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        connectSrc: ["'self'", "https:", "blob:"],
        modelSrc: ["'self'", "https:", "data:", "blob:"],
        workerSrc: ["'self'", "blob:"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
        "upgrade-insecure-requests": null,
      },
    },
    crossOriginResourcePolicy: { policy: "same-site" },
  }),
);
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  next();
});
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
    name: row.title,
    title: row.title,
    type: row.type,
    short: row.short,
    description: row.description,
    features: parseJsonArray(row.features_json),
    model: equipmentModelUrl(row.model, row.model_file_hash),
    environment: row.environment,
    variant: row.variant,
    hotspots: parseJsonArray(row.hotspots_json),
    specialtyId: row.specialty_id,
    specialtyCode: row.specialty_code,
    specialtyTitle: row.specialty_title,
    sortOrder: row.sort_order ?? 0,
    modelFileSize: row.model_file_size ?? null,
    modelFileHash: row.model_file_hash ?? null,
  };
}

function placeholders(values) {
  return values.map(() => "?").join(", ");
}

function transliterateRu(value) {
  const map = {
    а: "a",
    б: "b",
    в: "v",
    г: "g",
    д: "d",
    е: "e",
    ё: "e",
    ж: "zh",
    з: "z",
    и: "i",
    й: "y",
    к: "k",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ф: "f",
    х: "h",
    ц: "ts",
    ч: "ch",
    ш: "sh",
    щ: "sch",
    ъ: "",
    ы: "y",
    ь: "",
    э: "e",
    ю: "yu",
    я: "ya",
  };

  return String(value)
    .toLowerCase()
    .split("")
    .map((char) => map[char] ?? char)
    .join("");
}

function compactModelName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function modelNameVariants(value) {
  return [...new Set([compactModelName(value), compactModelName(transliterateRu(value))].filter(Boolean))];
}

function localModelFilename(modelUrl) {
  const value = String(modelUrl || "").split("?")[0].trim();
  if (!value.startsWith("/models/")) {
    return "";
  }

  try {
    return decodeURIComponent(path.basename(value));
  } catch {
    return path.basename(value);
  }
}

function isGlbFilename(filename) {
  return String(filename || "").toLowerCase().endsWith(".glb");
}

async function listLocalGlbModels() {
  const dirs = [modelsPublicDir, path.join(rootDir, "models")];
  const files = [];

  for (const dir of dirs) {
    let entries = [];
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isFile() || !isGlbFilename(entry.name)) {
        continue;
      }

      const basename = path.basename(entry.name, path.extname(entry.name));
      files.push({
        filename: entry.name,
        publicPath: `/models/${entry.name}`,
        diskPath: path.join(dir, entry.name),
        variants: modelNameVariants(basename),
      });
    }
  }

  return files;
}

function findLocalModelFile(modelUrl, localModels) {
  const filename = localModelFilename(modelUrl);
  if (!filename) {
    return null;
  }

  return localModels.find((file) => file.filename.toLowerCase() === filename.toLowerCase()) || null;
}

function seedAliases(equipment) {
  const modelFilename = localModelFilename(equipment.model);
  const modelBasename = modelFilename ? path.basename(modelFilename, path.extname(modelFilename)) : "";
  return [
    equipment.title,
    equipment.id,
    modelBasename,
    ...(seedModelAliases[equipment.id] || []),
  ].flatMap(modelNameVariants);
}

function scoreLocalModel(file, aliases) {
  let score = 0;
  for (const fileVariant of file.variants) {
    for (const alias of aliases) {
      if (fileVariant === alias) {
        score = Math.max(score, 100 + alias.length);
      } else if (alias.length >= 4 && fileVariant.includes(alias)) {
        score = Math.max(score, 80 + alias.length);
      } else if (fileVariant.length >= 4 && alias.includes(fileVariant)) {
        score = Math.max(score, 60 + fileVariant.length);
      }
    }
  }
  return score;
}

function scoreTextAgainstAliases(value, aliases) {
  return scoreLocalModel({ variants: modelNameVariants(value) }, aliases);
}

async function modelMetadataFor(file) {
  if (!file) {
    return { modelFileSize: null, modelFileHash: null };
  }

  try {
    return await computeFileMetadata(file.diskPath);
  } catch {
    return { modelFileSize: null, modelFileHash: null };
  }
}

async function resolveSeedModel(equipment, existingRow, existingLocalRows, localModels) {
  const exactSeedFile = findLocalModelFile(equipment.model, localModels);
  if (exactSeedFile) {
    return {
      model: exactSeedFile.publicPath,
      ...(await modelMetadataFor(exactSeedFile)),
    };
  }

  const existingFile = findLocalModelFile(existingRow?.model, localModels);
  if (existingFile) {
    return {
      model: existingFile.publicPath,
      ...(await modelMetadataFor(existingFile)),
    };
  }

  const aliases = seedAliases(equipment);
  const matchedExistingRow = existingLocalRows
    .map((row) => ({
      row,
      file: findLocalModelFile(row.model, localModels),
      score: Math.max(scoreTextAgainstAliases(row.title, aliases), scoreTextAgainstAliases(row.id, aliases)),
    }))
    .filter((candidate) => candidate.file && candidate.score > 0)
    .sort((a, b) => b.score - a.score)[0];

  if (matchedExistingRow) {
    return {
      model: matchedExistingRow.file.publicPath,
      ...(await modelMetadataFor(matchedExistingRow.file)),
    };
  }

  const matchedFile = localModels
    .map((file) => ({ file, score: scoreLocalModel(file, aliases) }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.file;

  if (matchedFile) {
    return {
      model: matchedFile.publicPath,
      ...(await modelMetadataFor(matchedFile)),
    };
  }

  return {
    model: equipment.model,
    modelFileSize: null,
    modelFileHash: null,
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

  await algorithms.migrateSchema({ run, all });

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
        title: "Как работает QR-код?",
        body:
          "QR-код открывает эту же страницу с параметром id выбранного оборудования. " +
          "Ссылка строится от текущего адреса сайта, поэтому подходит для localhost, IP виртуальной машины и домена колледжа.",
        sort_order: 1,
      },
      {
        slug: "add-model",
        title: "Как добавить новую 3D-модель?",
        body:
          "Откройте админ-панель, войдите по паролю, выберите специальность и заполните карточку. " +
          "Можно указать ссылку на GLB или загрузить файл .glb на сервер.",
        sort_order: 2,
      },
      {
        slug: "supported-formats",
        title: "Поддерживаемые форматы",
        body:
          "Для просмотра используются GLB-модели. Чем меньше размер файла, тем быстрее модель откроется на мобильных устройствах.",
        sort_order: 3,
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
  const seedEquipmentIds = seedSpecialties.flatMap((specialty) =>
    (specialty.equipment || []).map((equipment) => equipment.id),
  );
  const obsoleteLegacyIds = legacySeedEquipmentIds.filter((id) => !seedEquipmentIds.includes(id));
  const localModels = await listLocalGlbModels();
  const existingEquipmentRows = seedEquipmentIds.length
    ? await all(
        `SELECT id, model FROM equipment WHERE id IN (${placeholders(seedEquipmentIds)})`,
        seedEquipmentIds,
      )
    : [];
  const existingEquipmentById = new Map(existingEquipmentRows.map((row) => [row.id, row]));
  const existingLocalModelRows = await all(
    "SELECT id, title, model FROM equipment WHERE model LIKE '/models/%'",
  );

  await run("BEGIN TRANSACTION");
  try {
    if (obsoleteLegacyIds.length) {
      await run(
        `DELETE FROM equipment WHERE id IN (${placeholders(obsoleteLegacyIds)})`,
        obsoleteLegacyIds,
      );
    }

    for (const [specialtyIndex, specialty] of seedSpecialties.entries()) {
      await run(
        `INSERT INTO specialties (id, code, title, description, sort_order, parent_id)
         VALUES (?, ?, ?, ?, ?, NULL)
         ON CONFLICT(id) DO UPDATE SET
           code = excluded.code,
           title = excluded.title,
           description = excluded.description,
           sort_order = excluded.sort_order,
           parent_id = NULL`,
        [specialty.id, specialty.code, specialty.title, specialty.description, specialtyIndex],
      );

      for (const [equipmentIndex, equipment] of (specialty.equipment || []).entries()) {
        const resolvedModel = await resolveSeedModel(
          equipment,
          existingEquipmentById.get(equipment.id),
          existingLocalModelRows,
          localModels,
        );
        await run(
          `INSERT INTO equipment
            (id, specialty_id, title, type, short, description, features_json, model,
             environment, variant, hotspots_json, sort_order, model_file_size, model_file_hash)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             specialty_id = excluded.specialty_id,
             title = excluded.title,
             type = excluded.type,
             short = excluded.short,
             description = excluded.description,
             features_json = excluded.features_json,
             model = excluded.model,
             environment = excluded.environment,
             variant = excluded.variant,
             hotspots_json = excluded.hotspots_json,
             sort_order = excluded.sort_order,
             model_file_size = excluded.model_file_size,
             model_file_hash = excluded.model_file_hash`,
          [
            equipment.id,
            specialty.id,
            equipment.title,
            equipment.type,
            equipment.short,
            equipment.description,
            JSON.stringify(normalizeArray(equipment.features)),
            resolvedModel.model,
            equipment.environment || "neutral",
            equipment.variant || "sensor",
            JSON.stringify(Array.isArray(equipment.hotspots) ? equipment.hotspots : []),
            equipmentIndex,
            resolvedModel.modelFileSize,
            resolvedModel.modelFileHash,
          ],
        );
      }
    }

    await run("COMMIT");
  } catch (error) {
    await run("ROLLBACK").catch(() => {});
    throw error;
  }
}

async function readSpecialties() {
  const specialties = await all(
    "SELECT id, code, title, description FROM specialties ORDER BY sort_order ASC, code ASC",
  );
  const equipmentRows = await all(
    `SELECT id, specialty_id, title, type, short, description, features_json, model, environment, variant, hotspots_json,
            sort_order,
            model_file_size, model_file_hash
     FROM equipment
     ORDER BY specialty_id ASC, sort_order ASC, title ASC`,
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
    name: specialty.title,
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
       e.sort_order,
       e.model_file_size,
       e.model_file_hash,
       s.code AS specialty_code,
       s.title AS specialty_title
     FROM equipment e
     INNER JOIN specialties s ON s.id = e.specialty_id
     WHERE e.id = ?`,
    [equipmentId],
  );

  return row ? normalizeEquipmentRow(row) : null;
}

function isDockerBridgeIp(ip) {
  return /^172\.(1[6-9]|2\d|3[01])\./.test(ip);
}

function getLanAddress() {
  const candidates = [];

  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === "IPv4" && !entry.internal) {
        candidates.push(entry.address);
      }
    }
  }

  const homeLan = candidates.find((ip) => /^192\.168\./.test(ip) || /^10\./.test(ip));
  if (homeLan) {
    return homeLan;
  }

  const nonDocker = candidates.find((ip) => !isDockerBridgeIp(ip));
  return nonDocker || candidates[0] || "127.0.0.1";
}

function isLoopbackHost(hostname) {
  return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname);
}

function resolvePublicBaseUrl(req) {
  if (process.env.PUBLIC_BASE_URL) {
    return process.env.PUBLIC_BASE_URL.replace(/\/$/, "");
  }

  const clientOrigin = String(req.get("x-public-origin") || "").trim();
  if (clientOrigin) {
    try {
      const parsed = new URL(clientOrigin);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return parsed.origin;
      }
    } catch (error) {
      // ignore invalid client origin
    }
  }

  const protocol = String(req.headers["x-forwarded-proto"] || req.protocol || "http").split(",")[0].trim();
  const requestHost = (req.get("x-forwarded-host") || req.get("host") || "").trim();

  if (requestHost) {
    const baseUrl = new URL(`${protocol}://${requestHost}`);
    if (isLoopbackHost(baseUrl.hostname)) {
      const lanIp = getLanAddress();
      if (!isLoopbackHost(lanIp) && !isDockerBridgeIp(lanIp)) {
        baseUrl.hostname = lanIp;
      }
    }
    return baseUrl.origin;
  }

  return `http://${getLanAddress()}:${port}`;
}

function equipmentUrl(req, equipmentId) {
  const url = new URL("/view.html", `${resolvePublicBaseUrl(req)}/`);
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

  try {
    await algorithms.insertScanLog(run, req, equipment);
  } catch (error) {
    console.error("scan_logs insert failed:", error);
  }

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

app.get("/api/specialties/tree", async (_req, res, next) => {
  try {
    res.json(await algorithms.getSpecialtyTree(all));
  } catch (error) {
    next(error);
  }
});

app.get("/api/equipment", async (req, res, next) => {
  try {
    const specialtyId = String(req.query.specialtyId || "").trim();
    if (specialtyId) {
      const items = await algorithms.listEquipmentBySpecialtyId(all, specialtyId, parseJsonArray);
      res.json(items);
      return;
    }
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

app.post("/api/admin/login", async (req, res, next) => {
  try {
    const password = String((req.body && req.body.password) || "");
    const ok =
      password.length > 0 &&
      (process.env.ADMIN_PASSWORD_HASH
        ? await bcrypt.compare(password, adminPasswordHash)
        : adminPasswordPlain
          ? password === adminPasswordPlain
          : await bcrypt.compare(password, adminPasswordHash));
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

function parseEquipmentFormBody(req) {
  const featuresRaw = req.body.features;
  const features =
    typeof featuresRaw === "string"
      ? normalizeArray(featuresRaw.split("\n"))
      : Array.isArray(featuresRaw)
        ? normalizeArray(featuresRaw)
        : [];

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

  return {
    specialtyId: String(req.body.specialtyId || "").trim(),
    title: String(req.body.title || "").trim(),
    type: String(req.body.type || "").trim(),
    short: String(req.body.short || "").trim(),
    description: String(req.body.description || "").trim(),
    features,
    environment: String(req.body.environment || "neutral").trim(),
    variant: String(req.body.variant || "sensor").trim(),
    hotspots,
    model: String(req.body.model || "").trim(),
  };
}

function adminUploadMiddleware(req, res, next) {
  upload.single("glb")(req, res, (err) => {
    if (err) {
      next(err);
      return;
    }
    next();
  });
}

async function resolveModelFilePath(modelUrl) {
  const value = String(modelUrl || "").trim();
  if (!value.startsWith("/models/")) {
    return null;
  }

  const filename = path.basename(value.split("?")[0]);
  if (!filename.toLowerCase().endsWith(".glb")) {
    return null;
  }

  const candidates = [
    path.join(modelsPublicDir, filename),
    path.join(rootDir, "models", filename),
  ];

  for (const candidate of candidates) {
    try {
      await fsp.access(candidate);
      return candidate;
    } catch {
      // try next path
    }
  }

  return null;
}

async function processUploadedGlb(file) {
  if (!file?.path) {
    return null;
  }

  try {
    return await normalizeGlbInPlace(file.path);
  } catch (error) {
    console.error("GLB normalize failed:", error);
    return { converted: false, reason: "error", message: error.message };
  }
}

app.get("/api/admin/equipment", async (req, res, next) => {
  if (!assertAdmin(req, res)) {
    return;
  }

  try {
    const rows = await all(
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
       ORDER BY s.sort_order ASC, s.code ASC, e.title ASC`,
    );
    res.json(rows.map((row) => normalizeEquipmentRow(row)));
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/equipment", adminUploadMiddleware, async (req, res, next) => {
  if (!assertAdmin(req, res)) {
    if (req.file) {
      await fsp.unlink(req.file.path).catch(() => {});
    }
    return;
  }

  try {
    const body = parseEquipmentFormBody(req);
    let model = body.model;
    let glbNormalize = null;
    if (req.file) {
      glbNormalize = await processUploadedGlb(req.file);
      model = `/models/${req.file.filename}`;
    }

    if (!body.specialtyId || !body.title || !body.type || !body.short || !body.description || !model) {
      if (req.file) {
        await fsp.unlink(req.file.path).catch(() => {});
      }
      res.status(400).json({ error: "Заполните все обязательные поля модели." });
      return;
    }

    const specialty = await get("SELECT id FROM specialties WHERE id = ?", [body.specialtyId]);
    if (!specialty) {
      if (req.file) {
        await fsp.unlink(req.file.path).catch(() => {});
      }
      res.status(400).json({ error: "Выбрана неизвестная специальность." });
      return;
    }

    const created = await algorithms.createEquipmentRecord({
      run,
      get,
      slugify,
      body,
      modelPathOnDisk: req.file ? req.file.path : null,
      modelPublicPath: model,
    });

    res.status(201).json({
      id: created.id,
      title: created.title,
      modelFileSize: created.modelFileSize,
      modelFileHash: created.modelFileHash,
      url: equipmentUrl(req, created.id),
      glbNormalized: Boolean(glbNormalize?.converted),
    });
  } catch (error) {
    if (req.file) {
      await fsp.unlink(req.file.path).catch(() => {});
    }
    if (error.message === "SPECIALTY_NOT_FOUND") {
      res.status(400).json({ error: "Выбрана неизвестная специальность." });
      return;
    }
    next(error);
  }
});

app.post(
  "/api/admin/equipment/:equipmentId/normalize-glb",
  validateEquipmentIdParam,
  async (req, res, next) => {
    if (!assertAdmin(req, res)) {
      return;
    }

    try {
      const existing = await findEquipment(req.params.equipmentId);
      if (!existing) {
        res.status(404).json({ error: "Модель не найдена." });
        return;
      }

      const modelBase = String(existing.model || "").split("?")[0];
      const filePath = await resolveModelFilePath(modelBase);
      if (!filePath) {
        res.status(400).json({ error: "Файл GLB не найден на сервере (public/models или models)." });
        return;
      }

      const glbNormalize = await normalizeGlbInPlace(filePath);

      if (glbNormalize.reason === "error" || glbNormalize.reason === "metalrough-failed") {
        res.status(422).json({
          error: glbNormalize.message || "Не удалось обработать GLB.",
          reason: glbNormalize.reason,
        });
        return;
      }

      const meta = await computeFileMetadata(filePath);

      try {
        await run(
          `UPDATE equipment SET model_file_size = ?, model_file_hash = ? WHERE id = ?`,
          [meta.modelFileSize, meta.modelFileHash, existing.id],
        );
      } catch (dbError) {
        await algorithms.migrateSchema({ run, all });
        await run(
          `UPDATE equipment SET model_file_size = ?, model_file_hash = ? WHERE id = ?`,
          [meta.modelFileSize, meta.modelFileHash, existing.id],
        );
      }

      res.json({
        id: existing.id,
        glbNormalized: Boolean(glbNormalize.converted),
        reason: glbNormalize.reason,
        message: glbNormalize.message,
        diagnostics: { before: glbNormalize.before, after: glbNormalize.after },
        model: equipmentModelUrl(modelBase, meta.modelFileHash),
        modelFileHash: meta.modelFileHash,
      });
    } catch (error) {
      console.error("normalize-glb:", req.params.equipmentId, error);
      res.status(500).json({
        error: error.message || "Internal server error",
      });
    }
  },
);

app.put("/api/admin/equipment/:equipmentId", validateEquipmentIdParam, adminUploadMiddleware, async (req, res, next) => {
  if (!assertAdmin(req, res)) {
    if (req.file) {
      await fsp.unlink(req.file.path).catch(() => {});
    }
    return;
  }

  try {
    const existing = await findEquipment(req.params.equipmentId);
    if (!existing) {
      if (req.file) {
        await fsp.unlink(req.file.path).catch(() => {});
      }
      res.status(404).json({ error: "Модель не найдена." });
      return;
    }

    const body = parseEquipmentFormBody(req);
    let model = body.model || existing.model;
    let glbNormalize = null;
    if (req.file) {
      glbNormalize = await processUploadedGlb(req.file);
      model = `/models/${req.file.filename}`;
    }

    if (!body.specialtyId || !body.title || !body.type || !body.short || !body.description || !model) {
      if (req.file) {
        await fsp.unlink(req.file.path).catch(() => {});
      }
      res.status(400).json({ error: "Заполните все обязательные поля модели." });
      return;
    }

    const specialty = await get("SELECT id FROM specialties WHERE id = ?", [body.specialtyId]);
    if (!specialty) {
      if (req.file) {
        await fsp.unlink(req.file.path).catch(() => {});
      }
      res.status(400).json({ error: "Выбрана неизвестная специальность." });
      return;
    }

    const updated = await algorithms.updateEquipmentRecord({
      run,
      get,
      modelsPublicDir,
      equipmentId: req.params.equipmentId,
      body: { ...body, model },
      newModelPathOnDisk: req.file ? req.file.path : null,
      newModelPublicPath: req.file ? model : null,
    });

    res.json({
      id: updated.id,
      title: updated.title,
      modelFileSize: updated.modelFileSize,
      modelFileHash: updated.modelFileHash,
      url: equipmentUrl(req, updated.id),
      glbNormalized: Boolean(glbNormalize?.converted),
    });
  } catch (error) {
    if (req.file) {
      await fsp.unlink(req.file.path).catch(() => {});
    }
    if (error.message === "NOT_FOUND") {
      res.status(404).json({ error: "Модель не найдена." });
      return;
    }
    next(error);
  }
});

app.delete("/api/admin/equipment/:equipmentId", validateEquipmentIdParam, async (req, res, next) => {
  if (!assertAdmin(req, res)) {
    return;
  }

  try {
    const existing = await findEquipment(req.params.equipmentId);
    if (!existing) {
      res.status(404).json({ error: "Модель не найдена." });
      return;
    }

    const deleted = await algorithms.deleteEquipmentCascade({
      run,
      get,
      modelsPublicDir,
      equipmentId: req.params.equipmentId,
    });

    res.json(deleted);
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

app.get("/catalog/:equipmentId", validateEquipmentIdParam, async (req, res, next) => {
  try {
    const equipment = await findEquipment(req.params.equipmentId);
    if (!equipment) {
      res.status(404).send("Equipment not found");
      return;
    }

    await appendScanLog(req, equipment);
    res.redirect(302, `/view.html?id=${encodeURIComponent(equipment.id)}&scan=1`);
  } catch (error) {
    next(error);
  }
});

app.get("/view.html", async (req, res, next) => {
  try {
    const equipmentId = String(req.query.id || "").trim();
    if (!equipmentId || !isValidEquipmentId(equipmentId)) {
      res.status(400).send("Invalid equipment id");
      return;
    }

    const equipment = await findEquipment(equipmentId);
    if (!equipment) {
      res.status(404).send("Equipment not found");
      return;
    }

    if (req.query.scan === "1") {
      await appendScanLog(req, equipment);
    }

    res.sendFile(path.join(rootDir, "view.html"));
  } catch (error) {
    next(error);
  }
});

app.use("/vendor", express.static(path.join(rootDir, "vendor"), { index: false }));
app.use(
  "/environments",
  express.static(path.join(rootDir, "public", "environments"), {
    index: false,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".hdr")) {
        res.setHeader("Content-Type", "image/vnd.radiance");
        res.setHeader("Content-Disposition", "inline");
        res.setHeader("Cache-Control", "public, max-age=604800, immutable");
      }
    },
  }),
);
app.use("/models", express.static(modelsPublicDir, modelStaticOptions));
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
        res.redirect(302, `/view.html?id=${encodeURIComponent(String(equipmentId))}&scan=1`);
        return;
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
