#!/usr/bin/env node
// Spec 103 follow-up: scan the store for image/banner paths whose files no
// longer exist on the persistent disk, and clear those references so the UI
// renders a clean empty state instead of a broken image. Idempotent.
//
// Run AFTER deploying the spec 103 fix, AFTER restarting the service.
//
// Usage in Render Shell:
//   node scripts/migrate-103-clear-dead-image-refs.js
//   node scripts/migrate-103-clear-dead-image-refs.js --dry-run

const path = require("node:path");
const fs = require("node:fs/promises");

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, "data"));
const STORE_PATH = path.resolve(process.env.STORE_PATH || path.join(DATA_DIR, "store.json"));
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(DATA_DIR, "uploads"));

const dryRun = process.argv.includes("--dry-run");

function urlPathToDiskPath(urlPath) {
  if (!urlPath || !String(urlPath).startsWith("/uploads/")) return null;
  const filename = String(urlPath).slice("/uploads/".length);
  return path.join(UPLOAD_DIR, filename);
}

async function fileExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch (_) {
    return false;
  }
}

async function checkAndClear(record, pathField, nameField, label) {
  const value = String(record?.[pathField] || "");
  if (!value) return false;
  const diskPath = urlPathToDiskPath(value);
  if (!diskPath) return false;
  if (await fileExists(diskPath)) return false;
  console.log(`  ${label}: cleared dead ${pathField}=${value}`);
  if (!dryRun) {
    record[pathField] = "";
    if (nameField) record[nameField] = "";
  }
  return true;
}

async function main() {
  const store = JSON.parse(await fs.readFile(STORE_PATH, "utf8"));
  let cleared = 0;

  console.log("Scanning store for dead image references...");
  console.log(`Upload dir: ${UPLOAD_DIR}`);

  for (const campaign of store.campaigns || []) {
    if (await checkAndClear(campaign, "bannerPath", "bannerName", `campaign id=${campaign.id} "${campaign.titleEn || campaign.titleAr || ""}"`)) cleared++;
  }
  for (const user of store.users || []) {
    if (await checkAndClear(user, "avatarPath", "avatarName", `user id=${user.id} ${user.email || ""}`)) cleared++;
  }
  for (const branch of store.branches || []) {
    if (await checkAndClear(branch, "imagePath", "imageName", `branch id=${branch.id} "${branch.nameEn || branch.nameAr || ""}"`)) cleared++;
  }
  for (const entry of store.journalEntries || []) {
    if (await checkAndClear(entry, "coverPath", "coverName", `journal id=${entry.id}`)) cleared++;
    if (await checkAndClear(entry, "imagePath", "imageName", `journal id=${entry.id}`)) cleared++;
  }

  if (dryRun) {
    console.log(`Dry run - would have cleared ${cleared} dead image reference(s). No changes written.`);
    return;
  }

  if (cleared === 0) {
    console.log("No dead image references found.");
    return;
  }

  const tempPath = `${STORE_PATH}.tmp-${process.pid}`;
  await fs.writeFile(tempPath, JSON.stringify(store, null, 2));
  await fs.rename(tempPath, STORE_PATH);
  console.log(`Cleared ${cleared} dead image reference(s). Restart the service.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
