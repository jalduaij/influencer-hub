#!/usr/bin/env node

const path = require("node:path");
const fs = require("node:fs/promises");

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, "data"));
const STORE_PATH = path.resolve(process.env.STORE_PATH || path.join(DATA_DIR, "store.json"));

function maxIdOrZero(rows) {
  return (rows || []).reduce((max, row) => Math.max(max, Number(row?.id) || 0), 0);
}

function rewriteNumberArray(values, replacements) {
  const mapped = (Array.isArray(values) ? values : [])
    .map((value) => Number(replacements.get(Number(value)) ?? Number(value)))
    .filter((value) => value > 0);
  return [...new Set(mapped)];
}

function rewriteSingleNumber(value, replacements) {
  const numeric = Number(value);
  if (!numeric) return value;
  return Number(replacements.get(numeric) ?? numeric);
}

function dedupeTable(store, config, messages) {
  const rows = store[config.table] || [];
  const seen = new Set();
  const replacements = new Map();
  let nextId = maxIdOrZero(rows) + 1;
  let changed = false;

  for (const row of rows) {
    const originalId = Number(row?.id) || 0;
    if (originalId > 0 && !seen.has(originalId)) {
      seen.add(originalId);
      continue;
    }
    const reassignedId = nextId++;
    replacements.set(originalId, reassignedId);
    row.id = reassignedId;
    seen.add(reassignedId);
    changed = true;
    messages.push(`${config.table}: reassigned ${originalId || "(invalid)"} -> ${reassignedId}`);
  }

  if (!changed) return false;
  config.rewrite(store, replacements);
  return true;
}

async function main() {
  let store;
  try {
    store = JSON.parse(await fs.readFile(STORE_PATH, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") {
      console.error(`Store not found at ${STORE_PATH}.`);
      process.exit(1);
    }
    throw error;
  }

  const messages = [];
  let changed = false;
  const tables = [
    {
      table: "categories",
      rewrite(currentStore, replacements) {
        for (const user of currentStore.users || []) {
          if (Array.isArray(user.categoryIds)) {
            user.categoryIds = rewriteNumberArray(user.categoryIds, replacements);
          } else if (user.categoryId) {
            user.categoryId = rewriteSingleNumber(user.categoryId, replacements);
          }
        }
        for (const campaign of currentStore.campaigns || []) {
          campaign.targetCategoryIds = rewriteNumberArray(campaign.targetCategoryIds, replacements);
        }
      },
    },
    {
      table: "cities",
      rewrite(currentStore, replacements) {
        for (const branch of currentStore.branches || []) {
          if (branch.cityId != null) branch.cityId = rewriteSingleNumber(branch.cityId, replacements);
        }
        for (const user of currentStore.users || []) {
          if (user.cityId != null) user.cityId = rewriteSingleNumber(user.cityId, replacements);
        }
      },
    },
    {
      table: "platforms",
      rewrite(currentStore, replacements) {
        for (const campaign of currentStore.campaigns || []) {
          campaign.targetPlatformIds = rewriteNumberArray(campaign.targetPlatformIds, replacements);
        }
      },
    },
    {
      table: "tags",
      rewrite() {
        // Tag references use string values, not numeric tag ids.
      },
    },
  ];

  for (const config of tables) {
    changed = dedupeTable(store, config, messages) || changed;
  }

  store.nextIds ||= {};
  const idTables = [
    ["user", store.users],
    ["campaign", store.campaigns],
    ["code", store.campaignCodes],
    ["participant", store.participants],
    ["campaignDecline", store.campaignDeclines],
    ["branch", store.branches],
    ["city", store.cities],
    ["category", store.categories],
    ["platform", store.platforms],
    ["tag", store.tags],
    ["passwordReset", store.passwordResets],
    ["auditEvent", store.auditEvents],
    ["journalEntry", store.journalEntries],
  ];
  for (const [key, rows] of idTables) {
    store.nextIds[key] = maxIdOrZero(rows) + 1;
  }

  if (!changed) {
    console.log("No duplicates found.");
    return;
  }

  const tempPath = `${STORE_PATH}.tmp-${process.pid}`;
  await fs.writeFile(tempPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  await fs.rename(tempPath, STORE_PATH);

  for (const message of messages) {
    console.log(message);
  }
  console.log("Deduped duplicate or invalid ids and rewrote dependent references.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
