#!/usr/bin/env node

const path = require("node:path");
const fs = require("node:fs/promises");

const { buildEmptyProductionStore } = require("../server.js");

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, "data"));
const STORE_PATH = path.resolve(process.env.STORE_PATH || path.join(DATA_DIR, "store.json"));

function maxIdOrZero(rows) {
  return (rows || []).reduce((max, row) => Math.max(max, Number(row?.id) || 0), 0);
}

function parseArgs(argv) {
  const parsed = {
    keepAdminEmail: "jalduaij@kdigtc.com",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--keep-admin-email") {
      parsed.keepAdminEmail = String(argv[index + 1] || parsed.keepAdminEmail).toLowerCase();
      index += 1;
    }
  }
  return parsed;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  let current;
  try {
    current = JSON.parse(await fs.readFile(STORE_PATH, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") {
      console.error(`Store not found at ${STORE_PATH}. Boot the server once so it bootstraps, then re-run.`);
      process.exit(1);
    }
    throw error;
  }

  const adminsToKeep = (current.users || []).filter(
    (user) => String(user.email || "").toLowerCase() === options.keepAdminEmail
  );
  if (!adminsToKeep.length) {
    console.error(`No user with email '${options.keepAdminEmail}' found in the store. Aborting to avoid lockout.`);
    process.exit(1);
  }

  for (const admin of adminsToKeep) {
    delete admin.city;
    delete admin.cityId;
    admin.residential = null;
  }

  const fresh = buildEmptyProductionStore();
  fresh.users = adminsToKeep;
  fresh.nextIds ||= {};
  const idTables = [
    ["user", fresh.users],
    ["campaign", fresh.campaigns],
    ["code", fresh.campaignCodes],
    ["participant", fresh.participants],
    ["campaignDecline", fresh.campaignDeclines],
    ["branch", fresh.branches],
    ["city", fresh.cities],
    ["category", fresh.categories],
    ["platform", fresh.platforms],
    ["tag", fresh.tags],
    ["passwordReset", fresh.passwordResets],
    ["auditEvent", fresh.auditEvents],
    ["journalEntry", fresh.journalEntries],
  ];
  for (const [key, rows] of idTables) {
    fresh.nextIds[key] = maxIdOrZero(rows) + 1;
  }

  const tempPath = `${STORE_PATH}.tmp-${process.pid}`;
  await fs.writeFile(tempPath, `${JSON.stringify(fresh, null, 2)}\n`, "utf8");
  await fs.rename(tempPath, STORE_PATH);

  console.log(`Wiped. Kept ${adminsToKeep.length} admin(s): ${adminsToKeep.map((user) => user.email).join(", ")}.`);
  console.log("Restart the service so it reloads the store cache:");
  console.log("  In Render dashboard -> service -> Manual Deploy -> Restart service");
  console.log("Then log in and fill in your residential fields on the profile screen.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
