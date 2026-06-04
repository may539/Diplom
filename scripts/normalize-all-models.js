#!/usr/bin/env node
const fs = require("node:fs/promises");
const path = require("node:path");
const { normalizeGlbInPlace } = require("../lib/normalize-glb");

const modelsDir = path.join(__dirname, "..", "public", "models");

async function main() {
  let entries;
  try {
    entries = await fs.readdir(modelsDir);
  } catch (error) {
    console.error("Не найдена папка public/models:", error.message);
    process.exit(1);
  }

  const files = entries.filter((name) => name.toLowerCase().endsWith(".glb"));
  if (!files.length) {
    console.log("GLB-файлы не найдены.");
    return;
  }

  for (const name of files) {
    const filePath = path.join(modelsDir, name);
    try {
      const result = await normalizeGlbInPlace(filePath);
      console.log(`${name}: ${result.converted ? "converted" : result.reason}`);
    } catch (error) {
      console.error(`${name}: error — ${error.message}`);
    }
  }
}

main();
