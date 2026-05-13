const express = require("express");
const fs = require("fs");
const fsp = require("fs/promises");
const os = require("os");
const path = require("path");
const QRCode = require("qrcode");

const app = express();
const port = Number(process.env.PORT || 8080);
const host = process.env.HOST || "0.0.0.0";
const rootDir = __dirname;
const dataPath = path.join(rootDir, "data", "equipment.json");
const scanLogPath = path.join(rootDir, "logs", "scan.log");

function readSpecialties() {
  return JSON.parse(fs.readFileSync(dataPath, "utf8"));
}

function allEquipment() {
  return readSpecialties().flatMap((specialty) =>
    specialty.equipment.map((equipment) => ({
      ...equipment,
      specialtyId: specialty.id,
      specialtyCode: specialty.code,
      specialtyTitle: specialty.title,
    })),
  );
}

function findEquipment(equipmentId) {
  return allEquipment().find((equipment) => equipment.id === equipmentId);
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

app.set("trust proxy", true);

app.get("/api/specialties", (req, res) => {
  res.json(readSpecialties());
});

app.get("/api/equipment", (req, res) => {
  res.json(allEquipment());
});

app.get("/api/equipment/:equipmentId", (req, res) => {
  const equipment = findEquipment(req.params.equipmentId);

  if (!equipment) {
    res.status(404).json({ error: "Equipment not found" });
    return;
  }

  res.json(equipment);
});

app.get("/api/qr/:equipmentId", async (req, res, next) => {
  try {
    const equipment = findEquipment(req.params.equipmentId);

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

app.get(["/app.js", "/equipment/app.js"], (req, res) => {
  res.sendFile(path.join(rootDir, "app.js"));
});

app.get(["/styles.css", "/equipment/styles.css"], (req, res) => {
  res.sendFile(path.join(rootDir, "styles.css"));
});

app.get(["/data/equipment-data.js", "/equipment/data/equipment-data.js"], (req, res) => {
  res.sendFile(path.join(rootDir, "data", "equipment-data.js"));
});

app.use("/vendor", express.static(path.join(rootDir, "vendor"), { index: false }));
app.use("/models", express.static(path.join(rootDir, "models"), { index: false }));

app.get("/", (req, res) => {
  sendIndex(res);
});

app.get("/equipment/:equipmentId", async (req, res, next) => {
  try {
    const equipment = findEquipment(req.params.equipmentId);

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

app.listen(port, host, () => {
  const lanAddress = getLanAddress();
  console.log(`Server listening on http://${host}:${port}`);
  console.log(`LAN URL: http://${lanAddress}:${port}`);
});
