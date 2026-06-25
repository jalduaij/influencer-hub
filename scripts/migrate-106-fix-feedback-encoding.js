#!/usr/bin/env node
// Spec 106 follow-up: recover UTF-8 participant feedback that was stored as
// mojibake by the multipart parser before the text-field decode fix landed.
//
// Usage in Render Shell:
//   node scripts/migrate-106-fix-feedback-encoding.js --dry-run
//   node scripts/migrate-106-fix-feedback-encoding.js

const path = require("node:path");
const fs = require("node:fs/promises");
const { TextDecoder } = require("node:util");

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, "data"));
const STORE_PATH = path.resolve(process.env.STORE_PATH || path.join(DATA_DIR, "store.json"));

const dryRun = process.argv.includes("--dry-run");
const utf8Decoder = new TextDecoder("utf-8", { fatal: true });

function hasHighCodepoints(value) {
  if (typeof value !== "string") return false;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0x80 && code <= 0xff) return true;
  }
  return false;
}

function tryReverseOnce(value) {
  const bytes = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) {
    bytes[index] = value.charCodeAt(index) & 0xff;
  }
  try {
    return utf8Decoder.decode(bytes);
  } catch (_) {
    return null;
  }
}

function recover(value) {
  if (typeof value !== "string" || !value) return value;
  if (!hasHighCodepoints(value)) return value;
  let current = value;
  for (let pass = 0; pass < 4; pass += 1) {
    const next = tryReverseOnce(current);
    if (next === null) return current;
    if (next === current) return current;
    if (!hasHighCodepoints(next)) return next;
    current = next;
  }
  return current;
}

async function main() {
  const store = JSON.parse(await fs.readFile(STORE_PATH, "utf8"));
  let fixed = 0;

  for (const participant of store.participants || []) {
    const before = participant.feedback;
    const after = recover(before);
    if (after !== before) {
      console.log(`participant id=${participant.id} (campaign ${participant.campaignId}):`);
      console.log(`  before: ${JSON.stringify(before).slice(0, 120)}`);
      console.log(`  after:  ${JSON.stringify(after).slice(0, 120)}`);
      if (!dryRun) participant.feedback = after;
      fixed += 1;
    }
  }

  // Add other known multipart text fields here if we confirm legacy mojibake
  // outside participant feedback.

  if (dryRun) {
    console.log(`\nDry run - would have fixed ${fixed} record(s). No changes written.`);
    return;
  }

  if (fixed === 0) {
    console.log("No records needed recovery.");
    return;
  }

  const tempPath = `${STORE_PATH}.tmp-${process.pid}`;
  await fs.writeFile(tempPath, JSON.stringify(store, null, 2));
  await fs.rename(tempPath, STORE_PATH);
  console.log(`\nFixed ${fixed} record(s). Restart the service.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
