const fs = require("node:fs/promises");
const path = require("node:path");

const { buildUatStore } = require("./uat-data-builder");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_OUT = path.join(ROOT, "data", "store.json");

function parseArgs(argv) {
  let outPath = DEFAULT_OUT;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--out") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value for --out");
      }
      outPath = path.resolve(value);
      index += 1;
    }
  }
  return { outPath };
}

async function main() {
  const { outPath } = parseArgs(process.argv.slice(2));
  const sourcePath = path.join(ROOT, "data", "store.json");
  const sourceStore = JSON.parse(await fs.readFile(sourcePath, "utf8"));
  const { store, summary } = buildUatStore(sourceStore);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  console.log(
    `Seeded UAT data to ${outPath} (${summary.members} members, ${summary.campaigns} campaigns, ${summary.participations} participations, ${summary.previewCampaigns || 0} previews, ${summary.journalEntries || 0} journal entries).`
  );
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
