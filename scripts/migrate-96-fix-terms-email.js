#!/usr/bin/env node
// Spec 96: replace the old contact email in the live T&C document with the
// correct one, recompute its content hash, and bump the version.
//
// Usage in Render Shell:
//   node scripts/migrate-96-fix-terms-email.js
//
// Idempotent: if the old email isn't found, exits with "No change needed."

const path = require("node:path");
const fs = require("node:fs/promises");
const crypto = require("node:crypto");

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, "data"));
const STORE_PATH = path.resolve(process.env.STORE_PATH || path.join(DATA_DIR, "store.json"));

const OLD_EMAIL = "club@pick.com.kw";
const NEW_EMAIL = "info@kdigtc.com";

function hashTermsContent(textEn, textAr) {
  const combined = String(textEn || "") + "\n---\n" + String(textAr || "");
  return "sha256:" + crypto.createHash("sha256").update(combined, "utf8").digest("hex");
}

async function main() {
  let store;
  try {
    store = JSON.parse(await fs.readFile(STORE_PATH, "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") {
      console.error(`Store not found at ${STORE_PATH}. Nothing to migrate.`);
      process.exit(1);
    }
    throw err;
  }

  if (!store.termsAndConditions) {
    console.log("No termsAndConditions document in store. Nothing to migrate.");
    return;
  }

  const terms = store.termsAndConditions;
  const textEnNew = String(terms.textEn || "").split(OLD_EMAIL).join(NEW_EMAIL);
  const textArNew = String(terms.textAr || "").split(OLD_EMAIL).join(NEW_EMAIL);

  if (textEnNew === terms.textEn && textArNew === terms.textAr) {
    console.log("Old email not found in current T&C. No change needed.");
    return;
  }

  const oldVersion = Number(terms.version) || 0;
  terms.textEn = textEnNew;
  terms.textAr = textArNew;
  terms.version = oldVersion + 1;
  terms.updatedAt = new Date().toISOString();

  const tmp = `${STORE_PATH}.tmp-${process.pid}`;
  await fs.writeFile(tmp, JSON.stringify(store, null, 2));
  await fs.rename(tmp, STORE_PATH);

  console.log(
    `Updated T&C contact email from ${OLD_EMAIL} to ${NEW_EMAIL}. Version ${oldVersion} -> ${terms.version}.`
  );
  console.log(`New hash: ${hashTermsContent(terms.textEn, terms.textAr)}`);
  console.log("Restart the service so it reloads the store cache:");
  console.log("  Render dashboard -> service -> Manual Deploy -> Restart service");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
