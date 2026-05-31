#!/usr/bin/env node

const path = require("node:path");
const fs = require("node:fs/promises");

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, "data"));
const STORE_PATH = path.resolve(process.env.STORE_PATH || path.join(DATA_DIR, "store.json"));

const KW_MAP = {
  "Kuwait City": { governorateId: "kw-asimah", areaId: "kw-asimah-kuwait-city" },
  Hawalli: { governorateId: "kw-hawalli", areaId: "kw-hawalli-hawalli" },
  Salmiya: { governorateId: "kw-hawalli", areaId: "kw-hawalli-salmiya" },
  Jahra: { governorateId: "kw-jahra", areaId: "kw-jahra-jahra" },
  "Mubarak Al-Kabeer": { governorateId: "kw-mubarak", areaId: "kw-mubarak-mubarak" },
  Farwaniya: { governorateId: "kw-farwaniya", areaId: "kw-farwaniya-farwaniya" },
};

async function main() {
  let store;
  try {
    store = JSON.parse(await fs.readFile(STORE_PATH, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") {
      console.error(`Store not found at ${STORE_PATH}. Nothing to migrate.`);
      process.exit(1);
    }
    throw error;
  }

  const oldCitiesById = new Map((store.cities || []).map((city) => [Number(city.id), city]));
  let migratedCount = 0;
  let unmappedCount = 0;
  const unmappedDetails = [];

  for (const branch of store.branches || []) {
    if (String(branch.country || "").toUpperCase()) {
      delete branch.city;
      if (typeof branch.cityId === "number") delete branch.cityId;
      continue;
    }

    const oldCity = oldCitiesById.get(Number(branch.cityId));
    const cityName = String(oldCity?.nameEn || branch.city || "");
    const mapping = KW_MAP[cityName];

    if (mapping) {
      branch.country = "KW";
      branch.governorateId = mapping.governorateId;
      branch.regionId = "";
      branch.areaId = mapping.areaId;
      branch.cityId = "";
      migratedCount += 1;
    } else {
      branch.country = "KW";
      branch.governorateId = "";
      branch.regionId = "";
      branch.areaId = "";
      branch.cityId = "";
      unmappedCount += 1;
      unmappedDetails.push({
        id: branch.id,
        name: branch.nameEn || branch.nameAr || "",
        oldCityName: cityName,
      });
    }

    delete branch.city;
  }

  store.cities = [];
  store.nextIds ||= {};
  store.nextIds.city = 1;

  const tempPath = `${STORE_PATH}.tmp-${process.pid}`;
  await fs.writeFile(tempPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  await fs.rename(tempPath, STORE_PATH);

  console.log(`Migrated ${migratedCount} branch(es) to addressReference.`);
  if (unmappedCount > 0) {
    console.log(`${unmappedCount} branch(es) could not be auto-mapped - admins must edit them:`);
    for (const item of unmappedDetails) {
      console.log(`  - id=${item.id} "${item.name}" (old city: "${item.oldCityName}")`);
    }
  }
  console.log("Legacy store.cities array has been cleared.");
  console.log("Restart the service: Render dashboard -> service -> Manual Deploy -> Restart service.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
