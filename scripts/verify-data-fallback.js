const fs = require("fs");
const path = require("path");
const vm = require("vm");

const rootDir = path.join(__dirname, "..");
const jsonData = JSON.parse(fs.readFileSync(path.join(rootDir, "data", "equipment.json"), "utf8"));
const fallbackSource = fs.readFileSync(path.join(rootDir, "data", "equipment-data.js"), "utf8");
const sandbox = { window: {} };

vm.runInNewContext(fallbackSource, sandbox, { filename: "equipment-data.js" });

if (JSON.stringify(sandbox.window.EQUIPMENT_DATA) !== JSON.stringify(jsonData)) {
  throw new Error("data/equipment-data.js is out of sync with data/equipment.json");
}

console.log("equipment fallback data is in sync");
