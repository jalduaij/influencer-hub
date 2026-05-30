const http = require("node:http");
const fsSync = require("node:fs");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFile } = require("node:child_process");
const { buildUatStore, UAT_RESET_CONFIRM } = require("./scripts/uat-data-builder");

const ROOT = __dirname;
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, "data"));
const STORE_PATH = path.resolve(process.env.STORE_PATH || path.join(DATA_DIR, "store.json"));
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(ROOT, "uploads"));
const BACKUP_DIR = path.join(DATA_DIR, "backups");
const BUNDLED_DATA_DIR = path.join(ROOT, "data");
const BUNDLED_STORE_PATH = path.join(BUNDLED_DATA_DIR, "store.json");
const BUNDLED_UPLOAD_DIR = path.join(ROOT, "uploads");
const PORT = Number(process.env.PORT || 5050);
const APP_BASE_URL = normalizeBaseUrl(process.env.APP_BASE_URL || `http://localhost:${PORT}`);
const SESSION_COOKIE = "pick_sid";
const IS_SECURE_APP = APP_BASE_URL.startsWith("https://");
const SHOW_UAT_PANEL = (() => {
  const explicit = String(process.env.SHOW_UAT_PANEL || "").toLowerCase();
  if (explicit === "true") return true;
  if (explicit === "false") return false;
  try {
    const host = new URL(APP_BASE_URL).hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") return true;
    if (host.endsWith(".onrender.com") && /(stage|staging)/.test(host)) return true;
  } catch (_) {
    // Fall through to the safe production default.
  }
  return false;
})();
const SECRET_DIR = path.join(DATA_DIR, ".secrets");
const ADDRESS_REFERENCE_PATH = path.join(ROOT, "seeds", "address-reference.json");
const TERMS_DEFAULT_PATH = path.join(ROOT, "seeds", "terms-default.json");
let ADDRESS_REFERENCE = {
  countries: [],
  kuwait: { governorates: [], areas: [] },
  saudiArabia: { regions: [], cities: [], districts: [] },
};
let TERMS_DEFAULT = null;
try {
  ADDRESS_REFERENCE = JSON.parse(fsSync.readFileSync(ADDRESS_REFERENCE_PATH, "utf8"));
  console.log(
    `[address] loaded ${ADDRESS_REFERENCE_PATH}: ${ADDRESS_REFERENCE.countries?.length || 0} countries, ${ADDRESS_REFERENCE.kuwait?.areas?.length || 0} KW areas, ${ADDRESS_REFERENCE.saudiArabia?.cities?.length || 0} SA cities`
  );
} catch (error) {
  console.error(
    `[address] FAILED to load ${ADDRESS_REFERENCE_PATH}: ${error.message}. Country dropdowns will be empty. This is a deployment misconfiguration.`
  );
}
try {
  TERMS_DEFAULT = JSON.parse(fsSync.readFileSync(TERMS_DEFAULT_PATH, "utf8"));
  console.log(`[terms] loaded default T&C seed v${Number(TERMS_DEFAULT?.version) || 0}`);
} catch (error) {
  console.error(`[terms] FAILED to load ${TERMS_DEFAULT_PATH}: ${error.message}`);
}
const ADDRESS_LOOKUPS = (() => {
  const map = (rows) => Object.fromEntries((rows || []).map((row) => [row.id, row]));
  return {
    countries: new Set((ADDRESS_REFERENCE.countries || []).map((country) => country.code)),
    governorates: map(ADDRESS_REFERENCE.kuwait?.governorates),
    areas: map(ADDRESS_REFERENCE.kuwait?.areas),
    regions: map(ADDRESS_REFERENCE.saudiArabia?.regions),
    cities: map(ADDRESS_REFERENCE.saudiArabia?.cities),
    districts: map(ADDRESS_REFERENCE.saudiArabia?.districts),
  };
})();
const RESET_LINKS_LOG_PATH = path.join(DATA_DIR, "reset-links.log");
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;
const ALLOWED_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"]);
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const CASHIER_VISIT_FLOW_ENABLED = false;
const rateLimitBuckets = new Map();
const CSRF_EXEMPT_PATHS = new Set([
  "/api/visits/confirm",
  "/api/branch/verify/lookup",
  "/api/branch/verify/reveal",
  "/api/branch/verify/redeem",
]);
const QR_HMAC_SECRET = process.env.QR_HMAC_SECRET || generatePersistentSecret("qr-hmac");
const CAMPAIGN_PASSWORD_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const VERIFICATION_REF_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const sessions = new Map();
let storeWriteChain = Promise.resolve();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".heif": "image/heif",
};

function execFileAsync(command, args) {
  return new Promise((resolve, reject) => {
    execFile(command, args, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function normalizeBaseUrl(value) {
  const normalized = String(value || "").trim().replace(/\/+$/, "");
  if (!normalized) return "";
  return normalized;
}

function generatePersistentSecret(name) {
  const file = path.join(SECRET_DIR, `${name}.txt`);
  try {
    if (fsSync.existsSync(file)) {
      const existing = fsSync.readFileSync(file, "utf8").trim();
      if (existing) return existing;
    }
    fsSync.mkdirSync(SECRET_DIR, { recursive: true });
    const secret = crypto.randomBytes(32).toString("hex");
    fsSync.writeFileSync(file, secret, "utf8");
    return secret;
  } catch (error) {
    return crypto.randomBytes(32).toString("hex");
  }
}

function getRequestBaseUrl(req) {
  const forwardedProto = String(req?.headers?.["x-forwarded-proto"] || "")
    .split(",")[0]
    .trim();
  const forwardedHost = String(req?.headers?.["x-forwarded-host"] || req?.headers?.host || "")
    .split(",")[0]
    .trim();
  if (forwardedHost) {
    const protocol = forwardedProto || (IS_SECURE_APP ? "https" : "http");
    return normalizeBaseUrl(`${protocol}://${forwardedHost}`);
  }
  return APP_BASE_URL;
}

function signedVerificationUrl(participant, baseUrl) {
  if (!participant?.id) return "";
  const payload = `p=${participant.id}`;
  const sig = verificationSignatureForParticipantId(participant.id);
  return `${normalizeBaseUrl(baseUrl || APP_BASE_URL)}/branch/verify?${payload}&sig=${sig}`;
}

function verificationSignatureForParticipantId(participantId) {
  return crypto.createHmac("sha256", QR_HMAC_SECRET).update(`p=${participantId}`).digest("hex").slice(0, 16);
}

function generateCampaignPassword() {
  let out = "";
  for (let index = 0; index < 6; index += 1) {
    out += CAMPAIGN_PASSWORD_CHARS[crypto.randomInt(0, CAMPAIGN_PASSWORD_CHARS.length)];
  }
  return `PICK-${out}`;
}

function ensureCampaignVerificationPassword(campaign) {
  if (!text(campaign?.verificationPassword)) {
    campaign.verificationPassword = generateCampaignPassword();
    return true;
  }
  const normalized = text(campaign.verificationPassword).toUpperCase();
  if (normalized !== campaign.verificationPassword) {
    campaign.verificationPassword = normalized;
    return true;
  }
  return false;
}

function generateVerificationRef(store, excludeParticipantId = null, length = 4) {
  const existing = new Set(
    store.participants
      .filter((participant) => Number(participant.id) !== Number(excludeParticipantId))
      .map((participant) => text(participant.verificationRef).toUpperCase())
      .filter(Boolean)
  );
  for (let attempt = 0; attempt < 50; attempt += 1) {
    let ref = "";
    for (let index = 0; index < length; index += 1) {
      ref += VERIFICATION_REF_CHARS[crypto.randomInt(0, VERIFICATION_REF_CHARS.length)];
    }
    if (!existing.has(ref)) return ref;
  }
  return generateVerificationRef(store, excludeParticipantId, length + 1);
}

function ensureParticipantVerificationRef(store, participant) {
  const normalized = text(participant?.verificationRef).toUpperCase();
  const valid = /^[A-Z0-9]{4,5}$/.test(normalized);
  const duplicate = store.participants.some(
    (item) => Number(item.id) !== Number(participant.id) && text(item.verificationRef).toUpperCase() === normalized
  );
  if (!valid || duplicate) {
    participant.verificationRef = generateVerificationRef(store, participant.id);
    return true;
  }
  if (participant.verificationRef !== normalized) {
    participant.verificationRef = normalized;
    return true;
  }
  return false;
}

function safeFileNameSegment(value) {
  return text(path.parse(value).name)
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "upload";
}

function httpError(statusCode, message) {
  return Object.assign(new Error(message), { statusCode });
}

function normalizeMimeType(value) {
  return String(value || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
}

function detectImageType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return "";
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpeg";
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "png";
  }
  if (
    buffer.slice(0, 4).toString("ascii") === "RIFF" &&
    buffer.slice(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }
  if (buffer.slice(4, 8).toString("ascii") === "ftyp") {
    return "heic";
  }
  return "";
}

function validateUploadedImage(file) {
  if (!file?.filename || !Buffer.isBuffer(file.content)) {
    return { ok: false, error: "Image file is required." };
  }
  if (file.content.length > 5 * 1024 * 1024) {
    return { ok: false, error: "Image must be 5MB or smaller." };
  }
  const extension = path.extname(file.filename).toLowerCase();
  if (!ALLOWED_IMAGE_EXTENSIONS.has(extension)) {
    return { ok: false, error: "Only JPG, PNG, WebP, and HEIC images are allowed." };
  }
  const mimeType = normalizeMimeType(file.contentType);
  if (mimeType && !ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
    return { ok: false, error: "Uploaded file type is not allowed." };
  }
  if (!detectImageType(file.content)) {
    return { ok: false, error: "Uploaded file is not a valid image." };
  }
  return { ok: true };
}

function scryptAsync(password, salt, keylen, options) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keylen, options, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(derivedKey);
    });
  });
}

async function hashPassword(plaintext) {
  const salt = crypto.randomBytes(16);
  const derivedKey = await scryptAsync(plaintext, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return `scrypt$${SCRYPT_N}$${salt.toString("hex")}$${derivedKey.toString("hex")}`;
}

async function verifyPassword(plaintext, stored) {
  const storedValue = String(stored || "");
  if (!storedValue.startsWith("scrypt$")) {
    return {
      ok: storedValue === String(plaintext || ""),
      needsRehash: storedValue === String(plaintext || ""),
    };
  }
  const parts = storedValue.split("$");
  if (parts.length !== 4) return { ok: false, needsRehash: false };
  const [, nValue, saltHex, hashHex] = parts;
  const salt = Buffer.from(saltHex, "hex");
  const expectedHash = Buffer.from(hashHex, "hex");
  const derivedKey = await scryptAsync(String(plaintext || ""), salt, expectedHash.length, {
    N: Number(nValue) || SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  if (derivedKey.length !== expectedHash.length) {
    return { ok: false, needsRehash: false };
  }
  return {
    ok: crypto.timingSafeEqual(derivedKey, expectedHash),
    needsRehash: false,
  };
}

async function persistUploadedImage(file) {
  const validation = validateUploadedImage(file);
  if (!validation.ok) {
    throw httpError(422, validation.error);
  }
  const stamp = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const originalExt = path.extname(file.filename).toLowerCase();
  const baseName = safeFileNameSegment(file.filename);

  if ([".heic", ".heif"].includes(originalExt)) {
    const sourceName = `${stamp}-${baseName}${originalExt}`;
    const sourcePath = path.join(UPLOAD_DIR, sourceName);
    const convertedName = `${stamp}-${baseName}.jpg`;
    const convertedPath = path.join(UPLOAD_DIR, convertedName);
    await fs.writeFile(sourcePath, file.content);
    try {
      await execFileAsync("/usr/bin/sips", ["-s", "format", "jpeg", sourcePath, "--out", convertedPath]);
      await fs.rm(sourcePath, { force: true });
      return {
        storedName: convertedName,
        displayName: `${baseName}.jpg`,
      };
    } catch (error) {
      await fs.rm(sourcePath, { force: true });
      throw httpError(422, "HEIC images could not be converted. Please upload JPG, PNG, or WebP.");
    }
  }

  const normalizedExt = originalExt || "";
  const storedName = `${stamp}-${baseName}${normalizedExt}`;
  await fs.writeFile(path.join(UPLOAD_DIR, storedName), file.content);
  return {
    storedName,
    displayName: path.basename(file.filename),
  };
}

async function ensureRuntimeFiles() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.mkdir(BACKUP_DIR, { recursive: true });
}

function runSerializedStoreTask(task) {
  const run = storeWriteChain.then(task, task);
  storeWriteChain = run.catch(() => {});
  return run;
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch (error) {
    return false;
  }
}

async function seedRuntimeFilesIfMissing() {
  if (STORE_PATH !== BUNDLED_STORE_PATH && !(await pathExists(STORE_PATH)) && (await pathExists(BUNDLED_STORE_PATH))) {
    await fs.copyFile(BUNDLED_STORE_PATH, STORE_PATH);
  }

  if (UPLOAD_DIR === BUNDLED_UPLOAD_DIR || !(await pathExists(BUNDLED_UPLOAD_DIR))) return;
  await copyBundledUploadsIfMissing(BUNDLED_UPLOAD_DIR, UPLOAD_DIR);
}

async function copyBundledUploadsIfMissing(sourceDir, targetDir) {
  const bundledEntries = await fs.readdir(sourceDir, { withFileTypes: true });
  for (const entry of bundledEntries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      await fs.mkdir(targetPath, { recursive: true });
      await copyBundledUploadsIfMissing(sourcePath, targetPath);
      continue;
    }
    if (!entry.isFile()) continue;
    if (await pathExists(targetPath)) continue;
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.copyFile(sourcePath, targetPath);
  }
}

function resolveUploadRequestPath(pathname) {
  const relativePath = decodeURIComponent(pathname.replace(/^\/uploads\//, ""));
  const normalizedPath = path.normalize(relativePath).replace(/^(\.\.(?:[\\/]|$))+/, "");
  const targetPath = path.resolve(UPLOAD_DIR, normalizedPath);
  if (targetPath === UPLOAD_DIR || targetPath.startsWith(`${UPLOAD_DIR}${path.sep}`)) {
    return targetPath;
  }
  return null;
}

function sanitizeUser(user, options = {}) {
  const { password, address, city, cityId, categoryId, category, ...safeUser } = user;
  if (options.includeAddress && address) {
    safeUser.address = address;
  }
  return safeUser;
}

function hashTermsContent(textEnValue, textArValue) {
  const combined = `${String(textEnValue || "")}\n---\n${String(textArValue || "")}`;
  return `sha256:${crypto.createHash("sha256").update(combined, "utf8").digest("hex")}`;
}

function serializeTermsAndConditions(store) {
  const terms = store?.termsAndConditions || { version: 0, textEn: "", textAr: "", updatedAt: "", updatedByUserId: null };
  return {
    version: Math.max(0, Number(terms.version) || 0),
    textEn: String(terms.textEn || ""),
    textAr: String(terms.textAr || ""),
    updatedAt: String(terms.updatedAt || ""),
    updatedByUserId: terms.updatedByUserId ?? null,
    contentHash: hashTermsContent(terms.textEn, terms.textAr),
  };
}

function currentTermsSnapshot(store) {
  const terms = serializeTermsAndConditions(store);
  return {
    version: terms.version,
    contentHash: terms.contentHash,
  };
}

function maxIdOrZero(items) {
  return (items || []).reduce((max, item) => Math.max(max, Number(item?.id) || 0), 0);
}

function nextId(items) {
  return maxIdOrZero(items) + 1;
}

function normalizeCode(value) {
  return String(value || "").trim().toUpperCase();
}

function text(value) {
  return String(value ?? "").trim();
}

function validateAddress(input) {
  if (input === null || input === undefined) return { ok: true, value: null };
  if (typeof input !== "object" || Array.isArray(input)) return { ok: false, error: "invalid_payload" };

  const country = String(input.country || "").toUpperCase();
  if (!ADDRESS_LOOKUPS.countries.has(country)) {
    return { ok: false, error: "invalid_country" };
  }

  const trim = (value) => String(value || "").trim().slice(0, 200);
  const out = {
    country,
    governorateId: "",
    regionId: "",
    cityId: "",
    cityOther: "",
    areaId: "",
    districtId: "",
    districtOther: "",
    block: trim(input.block),
    street: trim(input.street),
    buildingNumber: trim(input.buildingNumber),
    floor: trim(input.floor),
    apartmentNumber: trim(input.apartmentNumber),
    paciNumber: trim(input.paciNumber),
    postalCode: trim(input.postalCode),
    additionalNumber: trim(input.additionalNumber),
    landmark: trim(input.landmark),
    updatedAt: new Date().toISOString(),
  };

  if (country === "KW") {
    if (input.governorateId) {
      if (!ADDRESS_LOOKUPS.governorates[input.governorateId]) return { ok: false, error: "invalid_governorate" };
      out.governorateId = input.governorateId;
    }
    if (input.areaId) {
      const area = ADDRESS_LOOKUPS.areas[input.areaId];
      if (!area) return { ok: false, error: "invalid_area" };
      if (out.governorateId && area.governorateId !== out.governorateId) {
        return { ok: false, error: "area_governorate_mismatch" };
      }
      out.areaId = input.areaId;
    }
    if (out.paciNumber && !/^\d{8}$/.test(out.paciNumber)) {
      return { ok: false, error: "invalid_paci" };
    }
    out.regionId = "";
    out.cityId = "";
    out.cityOther = "";
    out.districtId = "";
    out.districtOther = "";
    out.postalCode = "";
    out.additionalNumber = "";
  }

  if (country === "SA") {
    if (input.regionId) {
      if (!ADDRESS_LOOKUPS.regions[input.regionId]) return { ok: false, error: "invalid_region" };
      out.regionId = input.regionId;
    }
    if (input.cityId) {
      const city = ADDRESS_LOOKUPS.cities[input.cityId];
      if (!city) return { ok: false, error: "invalid_city" };
      if (out.regionId && city.regionId !== out.regionId) {
        return { ok: false, error: "city_region_mismatch" };
      }
      out.cityId = input.cityId;
    } else if (input.cityOther) {
      out.cityOther = trim(input.cityOther);
    }
    if (input.districtId) {
      const district = ADDRESS_LOOKUPS.districts[input.districtId];
      if (!district) return { ok: false, error: "invalid_district" };
      if (out.cityId && district.cityId !== out.cityId) {
        return { ok: false, error: "district_city_mismatch" };
      }
      out.districtId = input.districtId;
    } else if (input.districtOther) {
      out.districtOther = trim(input.districtOther);
    }
    if (out.postalCode && !/^\d{5}$/.test(out.postalCode)) {
      return { ok: false, error: "invalid_postal" };
    }
    if (out.additionalNumber && !/^\d{4}$/.test(out.additionalNumber)) {
      return { ok: false, error: "invalid_additional" };
    }
    out.governorateId = "";
    out.areaId = "";
    out.block = "";
    out.paciNumber = "";
  }

  return { ok: true, value: out };
}

function validateResidential(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "residential_required" };
  }
  const country = String(input.country || "").toUpperCase();
  if (!ADDRESS_LOOKUPS.countries.has(country)) return { ok: false, error: "invalid_country" };

  const out = {
    country,
    governorateId: "",
    regionId: "",
    areaId: "",
    cityId: "",
  };

  if (country === "KW") {
    if (!input.governorateId || !ADDRESS_LOOKUPS.governorates[input.governorateId]) {
      return { ok: false, error: "invalid_governorate" };
    }
    out.governorateId = String(input.governorateId);
    if (!input.areaId) return { ok: false, error: "area_required" };
    const area = ADDRESS_LOOKUPS.areas[input.areaId];
    if (!area) return { ok: false, error: "invalid_area" };
    if (area.governorateId !== out.governorateId) {
      return { ok: false, error: "area_governorate_mismatch" };
    }
    out.areaId = String(input.areaId);
    return { ok: true, value: out };
  }

  if (!input.regionId || !ADDRESS_LOOKUPS.regions[input.regionId]) {
    return { ok: false, error: "invalid_region" };
  }
  out.regionId = String(input.regionId);
  if (!input.cityId) return { ok: false, error: "city_required" };
  const city = ADDRESS_LOOKUPS.cities[input.cityId];
  if (!city) return { ok: false, error: "invalid_city" };
  if (city.regionId !== out.regionId) {
    return { ok: false, error: "city_region_mismatch" };
  }
  out.cityId = String(input.cityId);
  return { ok: true, value: out };
}

function residentialFromBody(body) {
  if (body?.residential && typeof body.residential === "object") {
    return body.residential;
  }
  const country = text(body?.residentialCountry).toUpperCase();
  const tier2Id = text(body?.residentialTier2Id);
  const tier3Id = text(body?.residentialTier3Id);
  if (!country && !tier2Id && !tier3Id) return null;
  if (country === "KW") {
    return {
      country,
      governorateId: tier2Id,
      areaId: tier3Id,
    };
  }
  return {
    country,
    regionId: tier2Id,
    cityId: tier3Id,
  };
}

function residentialTier2Id(residential) {
  return String(residential?.governorateId || residential?.regionId || "");
}

function residentialTier3Id(residential) {
  return String(residential?.areaId || residential?.cityId || "");
}

function residentialLeafNameEn(residential) {
  if (!residential?.country) return "";
  if (residential.country === "KW") {
    return ADDRESS_LOOKUPS.areas[residential.areaId]?.nameEn || "";
  }
  return ADDRESS_LOOKUPS.cities[residential.cityId]?.nameEn || "";
}

function localizedText(en, ar) {
  return { en: text(en), ar: text(ar) };
}

function makeNotification(id, tone, titleEn, titleAr, bodyEn, bodyAr) {
  return {
    id,
    tone,
    title: localizedText(titleEn, titleAr),
    body: localizedText(bodyEn, bodyAr),
  };
}

function parseList(value) {
  if (Array.isArray(value)) return value.map((item) => text(item)).filter(Boolean);
  if (typeof value !== "string") return [];
  const raw = value.trim();
  if (!raw) return [];
  if (raw.startsWith("[") && raw.endsWith("]")) {
    try {
      return JSON.parse(raw).map((item) => text(item)).filter(Boolean);
    } catch (error) {
      return raw.split(",").map((item) => text(item)).filter(Boolean);
    }
  }
  return raw.split(",").map((item) => text(item)).filter(Boolean);
}

function normalizeTag(value) {
  return text(value).toLowerCase();
}

function normalizeSocialHandle(value) {
  const raw = text(value).toLowerCase();
  if (!raw) return "";
  let normalized = raw.replace(/^https?:\/\//, "");
  normalized = normalized.replace(/^www\./, "");
  normalized = normalized.replace(/^instagram\.com\//, "");
  normalized = normalized.replace(/^tiktok\.com\//, "");
  normalized = normalized.replace(/^snapchat\.com\/add\//, "");
  normalized = normalized.split(/[/?#]/)[0] || "";
  return normalized.replace(/^@+/, "");
}

function kuwaitMobileLocal(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 11 && digits.startsWith("965")) return digits.slice(3);
  if (digits.length === 8) return digits;
  return digits;
}

function normalizeKuwaitMobile(value) {
  const local = kuwaitMobileLocal(value);
  if (!local) return "";
  return /^\d{8}$/.test(local) ? `+965${local}` : "";
}

function validKuwaitMobile(value) {
  const local = kuwaitMobileLocal(value);
  return !local || /^\d{8}$/.test(local);
}

function passwordStrengthError(value) {
  const password = String(value || "");
  if (!password) return "Password is required.";
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    return "Password must include uppercase, lowercase, and a number.";
  }
  return "";
}

function normalizeGender(value) {
  const normalized = text(value).toLowerCase();
  if (["male", "ذكر"].includes(normalized)) return "male";
  if (["female", "أنثى"].includes(normalized)) return "female";
  return "";
}

function parseTags(value) {
  const parsed = parseList(value)
    .map((item) => normalizeTag(item))
    .filter(Boolean);
  return [...new Set(parsed)];
}

function invalidTags(tags) {
  return tags.filter((tag) => !/^[a-z0-9-]+$/.test(tag));
}

function parseNumberList(value) {
  return parseList(value)
    .map((item) => Number(item))
    .filter(Boolean);
}

function parseStringList(value) {
  return [...new Set(parseList(value).map((item) => text(item)).filter(Boolean))];
}

function randomToken() {
  return crypto.randomBytes(24).toString("hex");
}

function randomSixDigitPin() {
  return String(crypto.randomInt(100000, 1000000));
}

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function toDateString(value) {
  return value ? String(value).slice(0, 10) : "";
}

function sameDay(left, right) {
  return toDateString(left) && toDateString(left) === toDateString(right);
}

function canVisitCampaignBranch(campaign, branchId) {
  if (!campaign) return false;
  if (campaign.branchMode === "all") return true;
  return (campaign.branchIds || []).includes(Number(branchId));
}

function syncParticipantPrimaryImage(participant) {
  const firstImage = participant.images?.[0] || null;
  participant.imageName = firstImage?.name || "";
  participant.imagePath = firstImage?.path || "";
}

function totalFollowers(influencer) {
  const followers = influencer?.followers || {};
  return (Number(followers.instagram) || 0) + (Number(followers.tiktok) || 0) + (Number(followers.snapchat) || 0);
}

function platformNameForId(store, platformId) {
  const platform = platformById(store, platformId);
  return text(platform?.nameEn).toLowerCase();
}

function influencerMatchesTargetPlatforms(store, influencer, targetPlatformIds) {
  if (!targetPlatformIds?.length) return true;
  const preferred = text(influencer.preferredPlatform).toLowerCase();
  const followers = influencer.followers || {};
  return targetPlatformIds.some((platformId) => {
    const name = platformNameForId(store, platformId);
    if (!name) return false;
    if (preferred === name) return true;
    if (name === "instagram") return (Number(followers.instagram) || 0) > 0;
    if (name === "tiktok") return (Number(followers.tiktok) || 0) > 0;
    if (name === "snapchat") return (Number(followers.snapchat) || 0) > 0;
    return false;
  });
}

function releaseAssignedCode(store, participant) {
  const code = assignedCodeForParticipant(store, participant);
  if (!code) return null;
  code.status = "available";
  code.reservedByParticipantId = null;
  code.reservedAt = null;
  code.usedAt = null;
  code.blockedAt = null;
  return code;
}

function participantCanSubmitOnServer(participant) {
  if (!participant) return { ok: false, reason: "Participation not found." };
  if (participant.status === "confirmed" || participant.status === "visited") {
    return { ok: true, editingExisting: false };
  }
  if (participant.status === "submitted") {
    const submittedAt = participant.submittedAt ? new Date(participant.submittedAt).getTime() : 0;
    if (submittedAt && Date.now() - submittedAt <= 24 * 60 * 60 * 1000) {
      return { ok: true, editingExisting: true };
    }
    return { ok: false, reason: "Submitted proof is view-only and can no longer be edited." };
  }
  if (participant.status === "completed") {
    return { ok: false, reason: "Submitted proof is view-only and can no longer be edited." };
  }
  return { ok: false, reason: "This campaign is not ready for proof submission." };
}

function clientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();
  return forwarded || req.socket.remoteAddress || "unknown";
}

function checkRateLimit(key, limit, windowMs) {
  const now = Date.now();
  const bucket = (rateLimitBuckets.get(key) || []).filter((timestamp) => now - timestamp < windowMs);
  if (bucket.length >= limit) {
    const oldestRelevant = bucket[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - (now - oldestRelevant)) / 1000));
    rateLimitBuckets.set(key, bucket);
    return { ok: false, retryAfterSeconds };
  }
  bucket.push(now);
  rateLimitBuckets.set(key, bucket);
  return { ok: true };
}

function pruneLoginAttempts(store) {
  store.loginAttempts ||= [];
  const cutoff = Date.now() - 15 * 60 * 1000 * 4;
  store.loginAttempts = store.loginAttempts.filter((attempt) => new Date(attempt.at).getTime() >= cutoff);
}

function recordLoginAttempt(store, email, success) {
  pruneLoginAttempts(store);
  store.loginAttempts.push({
    at: new Date().toISOString(),
    email: text(email).toLowerCase(),
    success: Boolean(success),
  });
}

function isLockedOut(store, email) {
  const normalizedEmail = text(email).toLowerCase();
  const windowMs = 15 * 60 * 1000;
  const now = Date.now();
  const attempts = (store.loginAttempts || [])
    .filter(
      (attempt) =>
        attempt.email === normalizedEmail &&
        now - new Date(attempt.at).getTime() <= windowMs
    )
    .sort((left, right) => new Date(left.at).getTime() - new Date(right.at).getTime());
  const recent = attempts.slice(-5);
  if (recent.length < 5 || recent.some((attempt) => attempt.success)) return null;
  const firstFailureAt = new Date(recent[0].at).getTime();
  const remainingMs = firstFailureAt + windowMs - now;
  return remainingMs > 0 ? Math.max(1, Math.ceil(remainingMs / 1000)) : null;
}

function checkSameOrigin(req) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return true;
  const origin = text(req.headers.origin);
  const referer = text(req.headers.referer);
  if (origin) return origin === APP_BASE_URL;
  if (referer) {
    try {
      return new URL(referer).origin === APP_BASE_URL;
    } catch (error) {
      return false;
    }
  }
  return false;
}

function actorSnapshot(actor) {
  if (!actor) {
    return {
      actorId: null,
      actorRole: null,
      actorName: "System",
    };
  }
  return {
    actorId: actor.id ?? null,
    actorRole: actor.role ?? null,
    actorName: actor.fullName || actor.email || "Unknown",
  };
}

function appendAuditEvent(store, actor, action, targetType, targetId, meta = {}) {
  store.auditEvents ||= [];
  store.nextIds ||= {};
  store.nextIds.auditEvent ||= nextId(store.auditEvents);
  store.auditEvents.push({
    id: store.nextIds.auditEvent++,
    at: new Date().toISOString(),
    ...actorSnapshot(actor),
    action,
    targetType,
    targetId: targetId ?? null,
    meta,
  });
  if (store.auditEvents.length > 5000) {
    store.auditEvents.splice(0, store.auditEvents.length - 5000);
  }
}

function backupFileName(at = new Date()) {
  const parts = [
    at.getFullYear(),
    String(at.getMonth() + 1).padStart(2, "0"),
    String(at.getDate()).padStart(2, "0"),
  ];
  const time = [
    String(at.getHours()).padStart(2, "0"),
    String(at.getMinutes()).padStart(2, "0"),
    String(at.getSeconds()).padStart(2, "0"),
  ].join("-");
  return `store-${parts.join("-")}_${time}.json`;
}

async function writeJsonAtomic(targetPath, content) {
  const tempPath = `${targetPath}.tmp`;
  const handle = await fs.open(tempPath, "w");
  try {
    await handle.writeFile(content, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await fs.rename(tempPath, targetPath);
}

async function writeBackupSnapshot(content) {
  const backupPath = path.join(BACKUP_DIR, backupFileName());
  await writeJsonAtomic(backupPath, content);
  const entries = (await fs.readdir(BACKUP_DIR))
    .filter((entry) => entry.startsWith("store-") && entry.endsWith(".json"))
    .sort();
  const overflow = entries.slice(0, Math.max(0, entries.length - 20));
  await Promise.all(overflow.map((entry) => fs.rm(path.join(BACKUP_DIR, entry), { force: true })));
}

function createSession(userId) {
  const id = randomToken();
  sessions.set(id, { userId, createdAt: Date.now() });
  return id;
}

function destroySession(sessionId) {
  if (sessionId) sessions.delete(sessionId);
}

function parseCookies(req) {
  const raw = req.headers.cookie || "";
  return raw.split(";").reduce((accumulator, part) => {
    const [key, ...valueParts] = part.trim().split("=");
    if (!key) return accumulator;
    accumulator[key] = decodeURIComponent(valueParts.join("="));
    return accumulator;
  }, {});
}

function sessionCookieHeader(value, options = {}) {
  const parts = [`${SESSION_COOKIE}=${value}`, "HttpOnly", "Path=/", "SameSite=Lax"];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  if (IS_SECURE_APP) parts.push("Secure");
  return parts.join("; ");
}

function applySecurityHeaders(res) {
  if (!res.hasHeader("X-Content-Type-Options")) res.setHeader("X-Content-Type-Options", "nosniff");
  if (!res.hasHeader("X-Frame-Options")) res.setHeader("X-Frame-Options", "DENY");
  if (!res.hasHeader("Referrer-Policy")) res.setHeader("Referrer-Policy", "same-origin");
  if (!res.hasHeader("Permissions-Policy")) {
    res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  }
}

function getSessionUser(req, store) {
  const sessionId = parseCookies(req)[SESSION_COOKIE];
  const session = sessions.get(sessionId);
  if (!session) return null;
  return store.users.find((user) => user.id === session.userId) || null;
}

function sendJson(res, statusCode, payload, headers = {}) {
  applySecurityHeaders(res);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    ...headers,
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, body, headers = {}) {
  applySecurityHeaders(res);
  res.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    ...headers,
  });
  res.end(body);
}

function sendCsv(res, fileName, body, headers = {}) {
  applySecurityHeaders(res);
  res.writeHead(200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${fileName}"`,
    ...headers,
  });
  res.end(body);
}

async function serveFile(res, filePath) {
  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    applySecurityHeaders(res);
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    res.end(data);
  } catch (error) {
    sendText(res, 404, "Not found");
  }
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function parseJson(buffer) {
  return JSON.parse(buffer.toString("utf8"));
}

function parseUrlEncoded(buffer) {
  const params = new URLSearchParams(buffer.toString("utf8"));
  return Object.fromEntries(params.entries());
}

function parseMultipart(buffer, contentType) {
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) return { fields: {}, files: {} };
  const boundary = `--${boundaryMatch[1] || boundaryMatch[2]}`;
  const raw = buffer.toString("binary");
  const parts = raw.split(boundary).slice(1, -1);
  const fields = {};
  const files = {};

  for (const part of parts) {
    const cleaned = part.replace(/^\r\n/, "").replace(/\r\n$/, "");
    const separatorIndex = cleaned.indexOf("\r\n\r\n");
    if (separatorIndex === -1) continue;

    const headerBlock = cleaned.slice(0, separatorIndex);
    const bodyBlock = cleaned.slice(separatorIndex + 4).replace(/\r\n$/, "");
    const disposition = headerBlock.match(/name="([^"]+)"/i);
    if (!disposition) continue;
    const name = disposition[1];
    const fileNameMatch = headerBlock.match(/filename="([^"]*)"/i);
    const contentTypeMatch = headerBlock.match(/Content-Type:\s*([^\r\n]+)/i);

    if (fileNameMatch && fileNameMatch[1]) {
      files[name] = {
        filename: path.basename(fileNameMatch[1]),
        contentType: contentTypeMatch ? contentTypeMatch[1] : "application/octet-stream",
        content: Buffer.from(bodyBlock, "binary"),
      };
    } else {
      const value = bodyBlock.toString();
      if (fields[name] === undefined) {
        fields[name] = value;
      } else if (Array.isArray(fields[name])) {
        fields[name].push(value);
      } else {
        fields[name] = [fields[name], value];
      }
    }
  }

  return { fields, files };
}

function jsonOrForm(buffer, req) {
  const contentType = req.headers["content-type"] || "";
  if (contentType.includes("application/json")) return parseJson(buffer);
  if (contentType.includes("application/x-www-form-urlencoded")) return parseUrlEncoded(buffer);
  return {};
}

function routeMatch(pathname, expression) {
  const match = pathname.match(expression);
  return match ? match.slice(1) : null;
}

function cityById(store, cityId) {
  return store.cities.find((city) => city.id === Number(cityId)) || null;
}

function categoryById(store, categoryId) {
  return store.categories.find((category) => category.id === Number(categoryId)) || null;
}

function categoryNamesForIds(store, categoryIds) {
  return parseNumberList(categoryIds)
    .map((categoryId) => categoryById(store, categoryId)?.nameEn || "")
    .filter(Boolean);
}

function normalizeUserCategoryIds(user, store) {
  const rawIds = Array.isArray(user?.categoryIds)
    ? user.categoryIds
    : user?.categoryId
      ? [user.categoryId]
      : [];
  const knownIds = new Set((store.categories || []).map((category) => Number(category.id)));
  return [...new Set(
    rawIds
      .map((value) => Number(value))
      .filter((value) => value > 0 && knownIds.has(value))
  )];
}

function validateCategoryIds(input, store) {
  const requestedIds = parseNumberList(input);
  if (!requestedIds.length) {
    return { ok: false, error: "category_required" };
  }
  const validIds = new Set(
    (store.categories || [])
      .filter((category) => category.status === "active")
      .map((category) => Number(category.id))
  );
  const normalized = [];
  for (const id of requestedIds) {
    if (!validIds.has(id)) return { ok: false, error: "invalid_category" };
    if (!normalized.includes(id)) normalized.push(id);
  }
  return { ok: true, value: normalized };
}

function categoryIdsFromBody(body) {
  return parseList(body?.categoryIds);
}

function branchById(store, branchId) {
  return store.branches.find((branch) => branch.id === Number(branchId)) || null;
}

function platformById(store, platformId) {
  return store.platforms.find((platform) => platform.id === Number(platformId)) || null;
}

function tagById(store, tagId) {
  return store.tags.find((tag) => tag.id === Number(tagId)) || null;
}

function campaignById(store, campaignId) {
  return store.campaigns.find((campaign) => campaign.id === Number(campaignId)) || null;
}

function participantById(store, participantId) {
  return store.participants.find((participant) => participant.id === Number(participantId)) || null;
}

function userById(store, userId) {
  return store.users.find((user) => user.id === Number(userId)) || null;
}

function assignedCodeForParticipant(store, participant) {
  return store.campaignCodes.find((code) => code.id === participant.assignedCodeId) || null;
}

function requireRole(user, roles) {
  return user && roles.includes(user.role);
}

function canManageCampaign(user, campaign) {
  return Boolean(user && campaign && ["admin", "campaign_manager"].includes(user.role));
}

function ensureChoiceByName(collection, label) {
  const normalized = text(label);
  if (!normalized) return null;
  const existing = collection.find(
    (item) => item.nameEn.toLowerCase() === normalized.toLowerCase() || item.nameAr === normalized
  );
  if (existing) return existing.id;
  const created = {
    id: nextId(collection),
    nameEn: normalized,
    nameAr: normalized,
    status: "active",
    createdAt: new Date().toISOString(),
  };
  collection.push(created);
  return created.id;
}

function knownTagValues(store) {
  return new Set((store.tags || []).map((tag) => normalizeTag(tag.value)).filter(Boolean));
}

function unknownTags(store, tags) {
  const known = knownTagValues(store);
  return tags.filter((tag) => !known.has(normalizeTag(tag)));
}

function normalizeStore(store) {
  const changed = { value: false };

  store.users ||= [];
  store.campaigns ||= [];
  store.branches ||= [];
  store.campaignCodes ||= [];
  store.participants ||= [];
  store.campaignDeclines ||= [];
  store.passwordResets ||= [];
  store.auditEvents ||= [];
  store.loginAttempts ||= [];
  store.journalEntries ||= [];
  store.cities ||= [];
  store.categories ||= [];
  store.platforms ||= [];
  store.tags ||= [];
  if (!store.termsAndConditions && TERMS_DEFAULT) {
    store.termsAndConditions = { ...TERMS_DEFAULT };
    changed.value = true;
  }
  if (store.termsAndConditions) {
    const normalizedTerms = {
      version: Math.max(1, Number(store.termsAndConditions.version) || Number(TERMS_DEFAULT?.version) || 1),
      textEn: String(store.termsAndConditions.textEn || ""),
      textAr: String(store.termsAndConditions.textAr || ""),
      updatedAt: String(store.termsAndConditions.updatedAt || TERMS_DEFAULT?.updatedAt || new Date().toISOString()),
      updatedByUserId: store.termsAndConditions.updatedByUserId ?? null,
    };
    if (JSON.stringify(store.termsAndConditions) !== JSON.stringify(normalizedTerms)) {
      store.termsAndConditions = normalizedTerms;
      changed.value = true;
    }
  }

  for (const user of store.users) {
    if (user.category) ensureChoiceByName(store.categories, user.category);
  }
  for (const branch of store.branches) {
    if (branch.city) branch.cityId ||= ensureChoiceByName(store.cities, branch.city);
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
  let nextIdsChanged = false;
  for (const [key, rows] of idTables) {
    const expected = maxIdOrZero(rows) + 1;
    if (Number(store.nextIds[key] || 0) < expected) {
      store.nextIds[key] = expected;
      nextIdsChanged = true;
    }
  }
  if (nextIdsChanged) changed.value = true;

  for (const city of store.cities) {
    if (!city.nameEn) {
      city.nameEn = text(city.name || "");
      changed.value = true;
    }
    if (!city.nameAr) {
      city.nameAr = city.nameEn;
      changed.value = true;
    }
    city.status ||= "active";
  }

  for (const category of store.categories) {
    if (!category.nameEn) {
      category.nameEn = text(category.name || "");
      changed.value = true;
    }
    if (!category.nameAr) {
      category.nameAr = category.nameEn;
      changed.value = true;
    }
    category.status ||= "active";
  }

  if (!store.platforms.length) {
    const defaults = [
      ["Instagram", "إنستغرام"],
      ["TikTok", "تيك توك"],
      ["Snapchat", "سناب شات"],
      ["YouTube", "يوتيوب"],
      ["X", "إكس"],
    ];
    for (const [nameEn, nameAr] of defaults) {
      store.platforms.push({
        id: store.nextIds.platform++,
        nameEn,
        nameAr,
        status: "active",
        createdAt: new Date().toISOString(),
      });
    }
    changed.value = true;
  }

  for (const platform of store.platforms) {
    if (!platform.nameEn) {
      platform.nameEn = text(platform.name || "");
      changed.value = true;
    }
    if (!platform.nameAr) {
      platform.nameAr = platform.nameEn;
      changed.value = true;
    }
    platform.status ||= "active";
  }

  for (const tag of store.tags) {
    const normalizedValue = normalizeTag(tag.value || tag.name || "");
    if (tag.value !== normalizedValue) {
      tag.value = normalizedValue;
      changed.value = true;
    }
    if (!tag.createdAt) {
      tag.createdAt = new Date().toISOString();
      changed.value = true;
    }
    tag.status ||= "active";
  }

  for (const branch of store.branches) {
    branch.nameEn ||= branch.name || "";
    branch.nameAr ||= branch.nameEn;
    branch.cityId ||= ensureChoiceByName(store.cities, branch.city || "");
    branch.areaEn ||= "";
    branch.areaAr ||= branch.areaEn;
    branch.addressEn ||= "";
    branch.addressAr ||= branch.addressEn;
    branch.mapLink ||= "";
    branch.imageName ||= "";
    branch.imagePath ||= "";
    branch.pin ||= randomSixDigitPin();
    branch.pinUpdatedAt ||= branch.createdAt || new Date().toISOString();
    branch.maxVisitsPerDay = Math.max(0, Number(branch.maxVisitsPerDay) || 0);
    branch.status ||= "active";
  }

  for (const user of store.users) {
    user.mobile = normalizeKuwaitMobile(user.mobile) || "";
    user.gender = normalizeGender(user.gender) || "";
    user.dateOfBirth ||= "";
    const normalizedCategoryIds = normalizeUserCategoryIds(user, store);
    if (JSON.stringify(user.categoryIds || []) !== JSON.stringify(normalizedCategoryIds)) {
      user.categoryIds = normalizedCategoryIds;
      changed.value = true;
    } else if (!Array.isArray(user.categoryIds)) {
      user.categoryIds = normalizedCategoryIds;
      changed.value = true;
    }
    if ("categoryId" in user) {
      delete user.categoryId;
      changed.value = true;
    }
    if ("category" in user) {
      delete user.category;
      changed.value = true;
    }
    const normalizedResidential = user.residential ? validateResidential(user.residential) : { ok: true, value: null };
    if (normalizedResidential.ok) {
      if (JSON.stringify(user.residential || null) !== JSON.stringify(normalizedResidential.value || null)) {
        user.residential = normalizedResidential.value || null;
        changed.value = true;
      }
    } else if (user.residential) {
      user.residential = null;
      changed.value = true;
    } else if (user.residential === undefined) {
      user.residential = null;
      changed.value = true;
    }
    if ("cityId" in user) {
      delete user.cityId;
      changed.value = true;
    }
    if ("city" in user) {
      delete user.city;
      changed.value = true;
    }
    user.instagram ||= "";
    user.tiktok ||= "";
    user.snapchat ||= "";
    user.followers ||= { instagram: 0, tiktok: 0, snapchat: 0 };
    user.preferredPlatform ||= "";
    const normalizedTags = parseTags(user.tags);
    if (JSON.stringify(normalizedTags) !== JSON.stringify(user.tags || [])) changed.value = true;
    user.tags = normalizedTags;
    user.notes ||= [];
    user.avatarName ||= "";
    user.avatarPath ||= "";
    user.createdAt ||= new Date().toISOString();
    user.lastLogin ||= "";
    user.approvedByUserId ||= null;
    user.passwordResetMode ||= "";
  }

  for (const campaign of store.campaigns) {
    campaign.branchIds ||= store.branches.map((branch) => branch.id);
    campaign.branchMode ||= campaign.branchIds.length ? "selected" : "all";
    campaign.targetCountries = parseStringList(campaign.targetCountries);
    campaign.targetGovernorateIds = parseStringList(campaign.targetGovernorateIds);
    campaign.targetCityIds = parseStringList(campaign.targetCityIds);
    campaign.targetCategoryIds ||= [];
    const normalizedTargetTags = parseTags(campaign.targetTags);
    if (JSON.stringify(normalizedTargetTags) !== JSON.stringify(campaign.targetTags || [])) changed.value = true;
    campaign.targetTags = normalizedTargetTags;
    campaign.offerDescription = text(campaign.offerDescription ?? campaign.offerText);
    campaign.offerUsageCount = Math.max(1, Number(campaign.offerUsageCount ?? campaign.usageCount) || 1);
    campaign.captionGuide ||= "";
    campaign.whatsappMessage ||= "";
    campaign.previewMode = Boolean(campaign.previewMode === true || campaign.previewMode === "1" || campaign.previewMode === 1);
    campaign.targetGender = text(campaign.targetGender || "");
    campaign.minFollowers = Math.max(0, Number(campaign.minFollowers) || 0);
    campaign.targetPlatformIds = parseNumberList(campaign.targetPlatformIds);
    campaign.participantCap = Math.max(0, Number(campaign.participantCap) || 0);
    const hasLegacyResidentialTargeting =
      !Array.isArray(campaign.targetCountries) ||
      !Array.isArray(campaign.targetGovernorateIds) ||
      campaign.targetCountries.some((code) => !ADDRESS_LOOKUPS.countries.has(code)) ||
      campaign.targetGovernorateIds.some((id) => !ADDRESS_LOOKUPS.governorates[id] && !ADDRESS_LOOKUPS.regions[id]) ||
      campaign.targetCityIds.some((id) => !ADDRESS_LOOKUPS.areas[id] && !ADDRESS_LOOKUPS.cities[id]);
    if (hasLegacyResidentialTargeting) {
      const previousTargeting = {
        targetCountries: [...(campaign.targetCountries || [])],
        targetGovernorateIds: [...(campaign.targetGovernorateIds || [])],
        targetCityIds: [...(campaign.targetCityIds || [])],
      };
      campaign.targetCountries = [];
      campaign.targetGovernorateIds = [];
      campaign.targetCityIds = [];
      if (!campaign.targetingNeedsReset) {
        appendAuditEvent(store, null, "campaign_targeting_reset", "campaign", campaign.id, previousTargeting);
      }
      campaign.targetingNeedsReset = true;
      changed.value = true;
    } else if (campaign.targetingNeedsReset == null) {
      campaign.targetingNeedsReset = false;
      changed.value = true;
    }
    if ((!campaign.targetCategoryIds.length || !campaign.targetCityIds.length) && Array.isArray(campaign.targeting)) {
      for (const token of campaign.targeting) {
        const categoryId = store.categories.find(
          (category) => category.nameEn.toLowerCase() === text(token).toLowerCase()
        )?.id;
        if (categoryId && !campaign.targetCategoryIds.includes(categoryId)) campaign.targetCategoryIds.push(categoryId);
      }
    }
    campaign.bannerName ||= "";
    campaign.bannerPath ||= "";
    campaign.createdAt ||= new Date().toISOString();
    campaign.updatedAt ||= campaign.createdAt;
    campaign.updatedBy ||= campaign.createdBy;
    campaign.autoClosedAt ||= null;
    campaign.status ||= "draft";
    if (ensureCampaignVerificationPassword(campaign)) {
      changed.value = true;
    }
    if (["active", "published"].includes(campaign.status)) {
      campaign.status = "live";
      changed.value = true;
    }
    if (["closed", "archived"].includes(campaign.status)) {
      campaign.status = "completed";
      changed.value = true;
    }
  }

  for (const entry of store.journalEntries) {
    entry.titleEn ||= "";
    entry.titleAr ||= entry.titleEn;
    entry.bodyEn ||= "";
    entry.bodyAr ||= entry.bodyEn;
    entry.imageName ||= "";
    entry.imagePath ||= "";
    entry.externalLink ||= "";
    entry.status ||= "draft";
    entry.authorUserId ||= null;
    entry.createdAt ||= new Date().toISOString();
    entry.updatedAt ||= entry.createdAt;
    entry.publishedAt ||= null;
  }

  const discoveredTags = new Set();
  for (const user of store.users) {
    for (const tag of user.tags) discoveredTags.add(tag);
  }
  for (const campaign of store.campaigns) {
    for (const tag of campaign.targetTags) discoveredTags.add(tag);
  }
  for (const value of discoveredTags) {
    if (!value || invalidTags([value]).length) continue;
    if (store.tags.some((tag) => normalizeTag(tag.value) === value)) continue;
    store.tags.push({
      id: store.nextIds.tag++,
      value,
      status: "active",
      createdAt: new Date().toISOString(),
    });
    changed.value = true;
  }

  for (const participant of store.participants) {
    participant.status ||= "confirmed";
    participant.joinedAt ||= new Date().toISOString();
    participant.visitedAt ||= null;
    participant.visitedBranchId ||= null;
    participant.visitedConfirmedByPin ||= false;
    participant.visitedConfirmedByCashier ||= false;
    participant.cashierVerifiedAt ||= null;
    participant.submittedAt ||= null;
    participant.completedAt ||= null;
    participant.selectedBranchId ||= null;
    participant.selectedVisitDate ||= null;
    participant.socialLink ||= "";
    participant.feedback ||= "";
    participant.images ||= [];
    if (!participant.images.length && participant.imagePath) {
      participant.images = [{ name: participant.imageName || "Image", path: participant.imagePath }];
      changed.value = true;
    }
    participant.imageName ||= "";
    participant.imagePath ||= "";
    syncParticipantPrimaryImage(participant);
    participant.platform ||= "";
    participant.canceledReason ||= "";
    participant.source ||= participant.influencerId ? "platform" : "offline";
    participant.offlineName ||= "";
    participant.offlineMobile ||= "";
    participant.offlineNotes ||= "";
    if (ensureParticipantVerificationRef(store, participant)) {
      changed.value = true;
    }
  }

  for (const code of store.campaignCodes) {
    code.status ||= "available";
    code.usageCount = Math.max(1, Number(code.usageCount) || 1);
    code.offerText ||= "";
    code.uploadedAt ||= new Date().toISOString();
    code.reservedAt ||= null;
    code.usedAt ||= null;
    code.blockedAt ||= null;
    code.deletedAt ||= null;
    code.deletedBatchId ||= null;
    code.reservedByParticipantId ??= null;
  }

  for (const campaign of store.campaigns) {
    const sampleCode = store.campaignCodes.find(
      (code) => code.campaignId === campaign.id && (text(code.offerText) || Math.max(1, Number(code.usageCount) || 1) !== 1)
    );
    if (!campaign.offerDescription && sampleCode?.offerText) {
      campaign.offerDescription = text(sampleCode.offerText);
      changed.value = true;
    }
    if ((campaign.offerUsageCount === 1 || !campaign.offerUsageCount) && sampleCode?.usageCount) {
      const normalizedUsage = Math.max(1, Number(sampleCode.usageCount) || 1);
      if (normalizedUsage !== campaign.offerUsageCount) {
        campaign.offerUsageCount = normalizedUsage;
        changed.value = true;
      }
    }
  }

  return { store, changed: changed.value };
}

function applyLifecycleSweep(store) {
  let changed = false;
  const today = todayDateString();

  for (const campaign of store.campaigns) {
    if (campaign.status === "live" && campaign.submissionDeadline && toDateString(campaign.submissionDeadline) < today) {
      campaign.status = "completed";
      campaign.autoClosedAt = new Date().toISOString();
      appendAuditEvent(store, null, "campaign.auto_closed", "campaign", campaign.id, {
        submissionDeadline: campaign.submissionDeadline,
      });
      changed = true;
    }
  }

  for (const participant of store.participants) {
    const campaign = campaignById(store, participant.campaignId);
    if (!campaign) continue;

    if (participant.status === "confirmed" && campaign.visitDeadline && toDateString(campaign.visitDeadline) < today) {
      releaseAssignedCode(store, participant);
      participant.status = "canceled";
      participant.canceledReason = "Visit deadline passed without confirmation";
      participant.assignedCodeId = null;
      appendAuditEvent(store, null, "participant.auto_canceled", "participant", participant.id, {
        reason: participant.canceledReason,
        campaignId: participant.campaignId,
      });
      changed = true;
      continue;
    }

    if (participant.status === "submitted" && campaign.submissionDeadline && toDateString(campaign.submissionDeadline) < today) {
      participant.status = "completed";
      participant.completedAt ||= new Date().toISOString();
      appendAuditEvent(store, null, "participant.auto_completed", "participant", participant.id, {
        campaignId: participant.campaignId,
      });
      changed = true;
    }
  }

  return changed;
}

function buildInitialStore() {
  return normalizeStore({
    termsAndConditions: TERMS_DEFAULT ? { ...TERMS_DEFAULT } : null,
  }).store;
}

function buildEmptyProductionStore() {
  return normalizeStore({
    termsAndConditions: TERMS_DEFAULT ? { ...TERMS_DEFAULT } : null,
  }).store;
}

async function readStore() {
  let raw;
  try {
    raw = JSON.parse(await fs.readFile(STORE_PATH, "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    const emptyStore = buildEmptyProductionStore();
    await writeStore(emptyStore, { skipBackup: true });
    return emptyStore;
  }
  const normalized = normalizeStore(raw);
  const swept = applyLifecycleSweep(normalized.store);
  if (normalized.changed || swept) {
    await writeStore(normalized.store, { skipBackup: true });
  }
  return normalized.store;
}

async function writeStore(store, options = {}) {
  const content = JSON.stringify(store, null, 2);
  await writeJsonAtomic(STORE_PATH, content);
  if (!options.skipBackup) {
    await writeBackupSnapshot(content);
  }
}

function serializeBranch(store, branch, options = {}) {
  const city = cityById(store, branch.cityId);
  const serialized = {
    ...branch,
    cityNameEn: city?.nameEn || "",
    cityNameAr: city?.nameAr || "",
  };
  if (!options.includePin) {
    delete serialized.pin;
    delete serialized.pinUpdatedAt;
  }
  return serialized;
}

function serializeCampaignCode(store, code) {
  const campaign = campaignById(store, code.campaignId);
  const participant = code.reservedByParticipantId ? participantById(store, code.reservedByParticipantId) : null;
  const influencer = participant ? userById(store, participant.influencerId) : null;
  return {
    id: code.id,
    campaignId: code.campaignId,
    codeValue: code.codeValue,
    usageCount: campaign?.offerUsageCount || code.usageCount,
    offerText: campaign?.offerDescription || code.offerText,
    status: code.status,
    reservedByParticipantId: code.reservedByParticipantId,
    reservedByInfluencerName: influencer?.fullName || participant?.offlineName || "",
    reservationSource: participant?.source || "",
    reservedByMobile: participant?.offlineMobile || "",
    reservedByPlatform: participant?.platform || "",
    reservedByNotes: participant?.offlineNotes || "",
    reservedAt: code.reservedAt,
    usedAt: code.usedAt,
    blockedAt: code.blockedAt || null,
    deletedAt: code.deletedAt || null,
  };
}

function serializeParticipant(store, participant, options = {}) {
  const campaign = campaignById(store, participant.campaignId);
  const influencer = userById(store, participant.influencerId);
  const assignedCode = assignedCodeForParticipant(store, participant);
  const verificationUrl = assignedCode ? signedVerificationUrl(participant, options.baseUrl) : "";
  const includeAssignedCodeValue = options.includeAssignedCodeValue !== false;
  return {
    ...participant,
    campaignTitleEn: campaign?.titleEn || "",
    campaignTitleAr: campaign?.titleAr || "",
    influencerName: influencer?.fullName || participant.offlineName || "",
    influencerEmail: influencer?.email || "",
    influencerResidential: influencer?.residential || null,
    influencerCategoryIds: influencer?.categoryIds || [],
    assignedCodeValue: includeAssignedCodeValue ? assignedCode?.codeValue || "" : "",
    assignedCodeUsageCount: campaign?.offerUsageCount || assignedCode?.usageCount || 1,
    assignedCodeOfferText: campaign?.offerDescription || assignedCode?.offerText || "",
    verificationRef: participant.verificationRef || "",
    verificationUrl,
  };
}

function codeStatsForCampaign(store, campaignId) {
  const codes = store.campaignCodes.filter((code) => code.campaignId === Number(campaignId));
  const byStatus = {
    total: codes.length,
    available: 0,
    reserved: 0,
    used: 0,
    blocked: 0,
    deleted: 0,
  };
  for (const code of codes) {
    if (code.status in byStatus) byStatus[code.status] += 1;
  }
  return byStatus;
}

function serializeCampaign(store, campaign, options = {}) {
  const createdBy = userById(store, campaign.createdBy);
  const updatedBy = userById(store, campaign.updatedBy);
  const serialized = {
    ...campaign,
    codeStats: codeStatsForCampaign(store, campaign.id),
    createdByName: createdBy?.fullName || "",
    updatedByName: updatedBy?.fullName || "",
    branchNamesEn:
      campaign.branchMode === "all"
        ? ["All branches"]
        : campaign.branchIds.map((branchId) => branchById(store, branchId)?.nameEn || "").filter(Boolean),
    branchNamesAr:
      campaign.branchMode === "all"
        ? ["جميع الأفرع"]
        : campaign.branchIds.map((branchId) => branchById(store, branchId)?.nameAr || "").filter(Boolean),
  };
  if (!options.includeVerificationPassword) delete serialized.verificationPassword;
  return serialized;
}

function serializePreviewCampaign(campaign) {
  return {
    id: campaign.id,
    titleEn: campaign.titleEn,
    titleAr: campaign.titleAr,
    descriptionEn: campaign.descriptionEn,
    descriptionAr: campaign.descriptionAr,
    bannerName: campaign.bannerName || "",
    bannerPath: campaign.bannerPath || "",
    offerDescription: campaign.offerDescription || "",
    startDate: campaign.startDate || "",
    type: campaign.type || "shop_visit",
    status: campaign.status || "draft",
    previewMode: Boolean(campaign.previewMode),
  };
}

function serializeJournalEntry(store, entry) {
  const author = userById(store, entry.authorUserId);
  return {
    ...entry,
    authorName: author?.fullName || "",
    authorEmail: author?.email || "",
  };
}

function canManageJournalEntry(actor, entry) {
  return Boolean(actor?.role === "admin" || (actor?.role === "campaign_manager" && entry?.authorUserId === actor.id));
}

function visibleJournalEntriesFor(store, actor) {
  const sortedEntries = [...(store.journalEntries || [])].sort((left, right) =>
    String(right.publishedAt || right.createdAt || "").localeCompare(String(left.publishedAt || left.createdAt || ""))
  );
  if (!actor) return [];
  if (actor.role === "admin") return sortedEntries.filter((entry) => entry.status !== "deleted");
  if (actor.role === "campaign_manager") {
    return sortedEntries.filter(
      (entry) => entry.status !== "deleted" && (entry.status === "published" || entry.authorUserId === actor.id)
    );
  }
  return sortedEntries.filter((entry) => entry.status === "published");
}

function influencerSummary(store, influencer) {
  const participations = store.participants.filter((participant) => participant.influencerId === influencer.id);
  const joined = participations.filter((participant) => participant.status !== "canceled").length;
  const visited = participations.filter((participant) =>
    ["visited", "submitted", "completed"].includes(participant.status)
  ).length;
  const submitted = participations.filter((participant) =>
    ["submitted", "completed"].includes(participant.status)
  ).length;
  const activePendingProof = participations.filter((participant) =>
    ["confirmed", "visited"].includes(participant.status)
  ).length;
  const lastActivityDate = participations
    .map((participant) => participant.submittedAt || participant.visitedAt || participant.joinedAt)
    .filter(Boolean)
    .sort()
    .at(-1) || "";

  return {
    influencerId: influencer.id,
    fullName: influencer.fullName,
    residential: influencer.residential || null,
    categoryIds: influencer.categoryIds || [],
    residentialNameEn: residentialLeafNameEn(influencer.residential),
    categoryNamesEn: categoryNamesForIds(store, influencer.categoryIds).join(", "),
    tags: influencer.tags || [],
    joined,
    visited,
    submitted,
    pendingProof: activePendingProof,
    completionRate: joined ? Math.round((submitted / joined) * 100) : 0,
    lastActivityDate,
  };
}

function csvEscape(value) {
  const normalized = String(value ?? "");
  if (!/[",\r\n]/.test(normalized)) return normalized;
  return `"${normalized.replace(/"/g, '""')}"`;
}

function buildCsv(headers, rows) {
  const lines = [headers.map(csvEscape).join(",")];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(","));
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

function reportBundleForCampaigns(store, campaigns) {
  const campaignRows = campaigns.map((campaign) => {
    const participants = store.participants.filter((participant) => participant.campaignId === campaign.id);
    const codeStats = codeStatsForCampaign(store, campaign.id);
    const joined = participants.filter((participant) => participant.status !== "canceled").length;
    const visited = participants.filter((participant) =>
      ["visited", "submitted", "completed"].includes(participant.status)
    ).length;
    const submitted = participants.filter((participant) =>
      ["submitted", "completed"].includes(participant.status)
    ).length;
    const canceled = participants.filter((participant) => participant.status === "canceled").length;

    return {
      campaignId: campaign.id,
      titleEn: campaign.titleEn,
      titleAr: campaign.titleAr,
      captionGuide: campaign.captionGuide || "",
      whatsappMessage: campaign.whatsappMessage || "",
      status: campaign.status,
      joined,
      visited,
      submitted,
      canceled,
      totalCodes: codeStats.total,
      availableCodes: codeStats.available,
      reservedCodes: codeStats.reserved,
      usedCodes: codeStats.used,
      blockedCodes: codeStats.blocked,
      deletedCodes: codeStats.deleted,
      visitRate: joined ? Math.round((visited / joined) * 100) : 0,
      submissionRate: joined ? Math.round((submitted / joined) * 100) : 0,
      completionRate: joined ? Math.round((submitted / joined) * 100) : 0,
      visitDeadline: campaign.visitDeadline,
      submissionDeadline: campaign.submissionDeadline,
    };
  });

  const influencerRows = store.users
    .filter((user) => user.role === "influencer")
    .map((user) => influencerSummary(store, user));

  const visibleCampaignIds = new Set(campaigns.map((campaign) => campaign.id));
  const submissionRows = store.participants
    .filter((participant) => visibleCampaignIds.has(participant.campaignId) && (participant.socialLink || participant.feedback))
    .map((participant) => {
      const campaign = campaignById(store, participant.campaignId);
      const influencer = userById(store, participant.influencerId);
      return {
        participantId: participant.id,
        campaignId: participant.campaignId,
        campaignTitleEn: campaign?.titleEn || "",
        campaignTitleAr: campaign?.titleAr || "",
        influencerName: influencer?.fullName || "",
        status: participant.status,
        platform: participant.platform || "",
        socialLink: participant.socialLink,
        feedback: participant.feedback,
        hasImage: Boolean(participant.imagePath),
        submittedAt: participant.submittedAt,
      };
    });

  const codeRows = store.campaignCodes
    .filter((code) => visibleCampaignIds.has(code.campaignId))
    .map((code) => {
      const serialized = serializeCampaignCode(store, code);
      return {
        campaignId: code.campaignId,
        campaignTitleEn: campaignById(store, code.campaignId)?.titleEn || "",
        codeValue: code.codeValue,
        usageCount: campaignById(store, code.campaignId)?.offerUsageCount || code.usageCount,
        offerText: campaignById(store, code.campaignId)?.offerDescription || code.offerText,
        status: code.status,
        reservedAt: code.reservedAt,
        usedAt: code.usedAt,
        blockedAt: code.blockedAt || "",
        deletedAt: code.deletedAt || "",
        assignedInfluencer: serialized.reservedByInfluencerName,
        reservationSource: serialized.reservationSource,
        reservedByPlatform: serialized.reservedByPlatform,
      };
    });

  return {
    summary: {
      campaignCount: campaignRows.length,
      joinedCount: campaignRows.reduce((sum, row) => sum + row.joined, 0),
      visitedCount: campaignRows.reduce((sum, row) => sum + row.visited, 0),
      submittedCount: campaignRows.reduce((sum, row) => sum + row.submitted, 0),
      totalCodes: campaignRows.reduce((sum, row) => sum + row.totalCodes, 0),
      availableCodes: campaignRows.reduce((sum, row) => sum + row.availableCodes, 0),
      reservedCodes: campaignRows.reduce((sum, row) => sum + row.reservedCodes, 0),
      usedCodes: campaignRows.reduce((sum, row) => sum + row.usedCodes, 0),
      blockedCodes: campaignRows.reduce((sum, row) => sum + row.blockedCodes, 0),
      deletedCodes: campaignRows.reduce((sum, row) => sum + row.deletedCodes, 0),
    },
    campaigns: campaignRows,
    influencers: influencerRows,
    submissions: submissionRows,
    codes: codeRows,
  };
}

function exportRowsForTab(store, tab, options = {}) {
  const reports = reportBundleForCampaigns(store, store.campaigns);

  if (tab === "campaigns") {
    return buildCsv(
      [
        "Campaign ID",
        "Campaign title (EN)",
        "Campaign title (AR)",
        "Caption guide",
        "WhatsApp message",
        "Status",
        "Joined",
        "Visited",
        "Submitted",
        "Canceled",
        "Total codes",
        "Available codes",
        "Reserved codes",
        "Used codes",
        "Blocked codes",
        "Visit deadline",
        "Submission deadline",
      ],
      reports.campaigns.map((row) => [
        row.campaignId,
        row.titleEn,
        row.titleAr,
        row.captionGuide,
        row.whatsappMessage,
        row.status,
        row.joined,
        row.visited,
        row.submitted,
        row.canceled,
        row.totalCodes,
        row.availableCodes,
        row.reservedCodes,
        row.usedCodes,
        row.blockedCodes,
        row.visitDeadline,
        row.submissionDeadline,
      ])
    );
  }

  if (tab === "influencers") {
    return buildCsv(
      [
        "Influencer ID",
        "Full name",
        "Email",
        "Mobile",
        "Status",
        "City",
        "Category",
        "Tags",
        "Joined",
        "Visited",
        "Submitted",
        "Pending proof",
        "Completion rate",
        "Last activity",
      ],
      reports.influencers.map((row) => {
        const user = userById(store, row.influencerId);
        return [
          row.influencerId,
          row.fullName,
          user?.email || "",
          user?.mobile || "",
          user?.status || "",
          row.residentialNameEn,
          row.categoryNamesEn,
          (row.tags || []).join(", "),
          row.joined,
          row.visited,
          row.submitted,
          row.pendingProof,
          row.completionRate,
          row.lastActivityDate,
        ];
      })
    );
  }

  if (tab === "submissions") {
    const filterCampaignId = Number(options.campaignId) || null;
    const rows = filterCampaignId
      ? reports.submissions.filter((row) => row.campaignId === filterCampaignId)
      : reports.submissions;
    return buildCsv(
      [
        "Participant ID",
        "Campaign title (EN)",
        "Campaign title (AR)",
        "Influencer",
        "Status",
        "Platform",
        "Social link",
        "Feedback",
        "Has image",
        "Submitted at",
      ],
      rows.map((row) => [
        row.participantId,
        row.campaignTitleEn,
        row.campaignTitleAr,
        row.influencerName,
        row.status,
        row.platform || "",
        row.socialLink || "",
        row.feedback || "",
        row.hasImage ? "Yes" : "No",
        row.submittedAt || "",
      ])
    );
  }

  if (tab === "codes") {
    return buildCsv(
      [
        "Campaign ID",
        "Campaign title (EN)",
        "Code",
        "Status",
        "Reservation source",
        "Assigned influencer",
        "Usage count",
        "Offer text",
        "Reserved at",
        "Used at",
        "Blocked at",
      ],
      reports.codes.map((row) => [
        row.campaignId,
        row.campaignTitleEn,
        row.codeValue,
        row.status,
        row.reservationSource || "",
        row.assignedInfluencer || "",
        row.usageCount,
        row.offerText || "",
        row.reservedAt || "",
        row.usedAt || "",
        row.blockedAt || "",
      ])
    );
  }

  return "";
}

function activeManagerScopeCampaigns(store, user) {
  if (!user) return [];
  if (["admin", "campaign_manager"].includes(user.role)) return store.campaigns;
  const participantCampaignIds = new Set(
    store.participants.filter((participant) => participant.influencerId === user.id).map((participant) => participant.campaignId)
  );
  return store.campaigns.filter((campaign) => participantCampaignIds.has(campaign.id));
}

function campaignMatchesInfluencer(store, campaign, influencer) {
  if (!["live"].includes(campaign.status)) return false;
  if (campaign.visitDeadline) {
    const today = todayDateString();
    if (toDateString(campaign.visitDeadline) < today) return false;
  }
  const residential = influencer.residential || {};
  if (campaign.targetCountries?.length && !campaign.targetCountries.includes(residential.country)) return false;
  if (campaign.targetGovernorateIds?.length) {
    const memberTier2 = residentialTier2Id(residential);
    if (!campaign.targetGovernorateIds.includes(memberTier2)) return false;
  }
  if (campaign.targetCityIds?.length) {
    const memberTier3 = residentialTier3Id(residential);
    if (!campaign.targetCityIds.includes(memberTier3)) return false;
  }
  if (campaign.targetCategoryIds?.length) {
    const memberCategoryIds = influencer.categoryIds || [];
    const hasOverlap = memberCategoryIds.some((id) => campaign.targetCategoryIds.includes(Number(id)));
    if (!hasOverlap) return false;
  }
  if (campaign.targetGender && campaign.targetGender !== "any" && influencer.gender !== campaign.targetGender) return false;
  if (campaign.minFollowers > 0 && totalFollowers(influencer) < campaign.minFollowers) return false;
  if (!influencerMatchesTargetPlatforms(store, influencer, campaign.targetPlatformIds || [])) return false;
  if (campaign.targetTags.length) {
    const influencerTags = new Set((influencer.tags || []).map((tag) => tag.toLowerCase()));
    const matched = campaign.targetTags.some((tag) => influencerTags.has(tag.toLowerCase()));
    if (!matched) return false;
  }
  return true;
}

function eligibleCampaignsFor(store, user) {
  const joinedActiveIds = new Set(
    store.participants
      .filter((participant) => participant.influencerId === user.id && participant.status !== "canceled")
      .map((participant) => participant.campaignId)
  );
  const declinedIds = new Set(
    store.campaignDeclines
      .filter((decline) => decline.influencerId === user.id)
      .map((decline) => decline.campaignId)
  );

  return store.campaigns.filter((campaign) => {
    if (!campaignMatchesInfluencer(store, campaign, user)) return false;
    if (joinedActiveIds.has(campaign.id)) return false;
    if (declinedIds.has(campaign.id)) return false;
    if (codeStatsForCampaign(store, campaign.id).available <= 0) return false;
    if (campaign.participantCap > 0) {
      const activeParticipants = store.participants.filter(
        (participant) => participant.campaignId === campaign.id && participant.status !== "canceled"
      ).length;
      if (activeParticipants >= campaign.participantCap) return false;
    }
    return true;
  });
}

function generateNotifications(store, user) {
  const notifications = [];
  const now = new Date();

  if (["admin", "campaign_manager"].includes(user.role)) {
    const pendingApprovals = store.users.filter((item) => item.role === "influencer" && item.status === "pending").length;
    if (pendingApprovals) {
      notifications.push(
        makeNotification(
          `pending-${pendingApprovals}`,
          "warning",
          "Pending member requests",
          "طلبات الأعضاء المعلقة",
          `${pendingApprovals} member request${pendingApprovals === 1 ? "" : "s"} need review.`,
          `${pendingApprovals} طلب عضوية بحاجة إلى مراجعة.`
        )
      );
    }

    const pendingProof = store.participants.filter(
      (participant) => participant.source !== "offline" && ["confirmed", "visited"].includes(participant.status)
    ).length;
    if (pendingProof) {
      notifications.push(
        makeNotification(
          `proof-${pendingProof}`,
          "info",
          "Pending proof submissions",
          "إثباتات تسليم معلقة",
          `${pendingProof} member${pendingProof === 1 ? "" : "s"} reserved code${pendingProof === 1 ? "" : "s"} but ${pendingProof === 1 ? "has" : "have"} not submitted proof yet.`,
          `${pendingProof} عضو لديه كود محجوز لكنه لم يرسل الإثبات بعد.`
        )
      );
    }
  }

  if (user.role === "influencer") {
    const pendingProof = store.participants.filter(
      (participant) => participant.influencerId === user.id && ["confirmed", "visited"].includes(participant.status)
    );
    if (pendingProof.length) {
      notifications.push(
        makeNotification(
          `my-proof-${pendingProof.length}`,
          "warning",
          "Submit your proof",
          "أرسل إثباتك",
          `${pendingProof.length} campaign${pendingProof.length === 1 ? "" : "s"} still need proof submission.`,
          `${pendingProof.length} حملة ما زالت بحاجة إلى إرسال الإثبات.`
        )
      );
    }

    if (totalFollowers(user) === 0) {
      notifications.push(
        makeNotification(
          "followers-zero",
          "info",
          "Add your follower counts",
          "أضف أعداد متابعيك",
          "Follower counts help us match you with campaigns that require minimum reach.",
          "أعداد المتابعين تساعدنا على مطابقتك مع الحملات التي تتطلب حداً أدنى من الوصول."
        )
      );
    }

    const canceled = store.participants.filter(
      (participant) => participant.influencerId === user.id && participant.status === "canceled"
    );
    if (canceled.length) {
      notifications.push(
        makeNotification(
          `my-canceled-${canceled.length}`,
          "error",
          "Canceled campaign assignments",
          "تخصيصات حملات ملغاة",
          `${canceled.length} joined campaign${canceled.length === 1 ? " was" : "s were"} canceled.`,
          `تم إلغاء ${canceled.length} من الحملات التي انضممت إليها.`
        )
      );
    }
  }

  const upcomingDeadlines = activeManagerScopeCampaigns(store, user).filter((campaign) => {
    if (!campaign.visitDeadline) return false;
    const days = (new Date(campaign.visitDeadline).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return days >= 0 && days <= 3 && ["live"].includes(campaign.status);
  });

  if (upcomingDeadlines.length) {
    notifications.push(
      makeNotification(
        `deadline-${upcomingDeadlines.length}`,
        "info",
        "Upcoming visit deadlines",
        "مواعيد زيارة قريبة",
        `${upcomingDeadlines.length} campaign${upcomingDeadlines.length === 1 ? "" : "s"} have visit deadlines within 3 days.`,
        `${upcomingDeadlines.length} حملة لديها موعد زيارة خلال 3 أيام.`
      )
    );
  }

  return notifications;
}

function buildBootstrap(store, user, options = {}) {
  const includeVerificationPassword = ["admin", "campaign_manager"].includes(user.role);
  const serializeParticipantForRequest = (participant) =>
    serializeParticipant(store, participant, {
      baseUrl: options.baseUrl,
      includeAssignedCodeValue: user.role !== "influencer",
    });
  const campaigns = store.campaigns.map((campaign) =>
    serializeCampaign(store, campaign, { includeVerificationPassword })
  );
  const reports = reportBundleForCampaigns(store, store.campaigns);
  const includeBranchPin = ["admin", "campaign_manager"].includes(user.role);
  const journalEntries = visibleJournalEntriesFor(store, user).map((entry) => serializeJournalEntry(store, entry));
  const common = {
    currentUser: sanitizeUser(user, { includeAddress: true }),
    cities: store.cities,
    categories: store.categories,
    platforms: store.platforms,
    tags: store.tags,
    termsAndConditions: serializeTermsAndConditions(store),
    branches: store.branches.map((branch) => serializeBranch(store, branch, { includePin: includeBranchPin })),
    campaigns,
    notifications: generateNotifications(store, user),
  };

  if (["admin", "campaign_manager"].includes(user.role)) {
    return {
      ...common,
      users: store.users.map(sanitizeUser),
      participants: store.participants.map((participant) => serializeParticipantForRequest(participant)),
      reports,
      journalEntries,
      auditEvents: store.auditEvents.slice(-200),
    };
  }

  const myParticipants = store.participants
    .filter((participant) => participant.influencerId === user.id)
    .map((participant) => serializeParticipantForRequest(participant));

  return {
    ...common,
    eligibleCampaignIds: eligibleCampaignsFor(store, user).map((campaign) => campaign.id),
    declinedCampaignIds: store.campaignDeclines
      .filter((decline) => decline.influencerId === user.id)
      .map((decline) => decline.campaignId),
    previewCampaigns: store.campaigns
      .filter((campaign) => campaign.status === "draft" && campaign.previewMode === true)
      .sort((left, right) => String(left.startDate || left.createdAt || "").localeCompare(String(right.startDate || right.createdAt || "")))
      .slice(0, 6)
      .map((campaign) => serializePreviewCampaign(campaign)),
    participants: myParticipants,
    journalEntries: journalEntries.slice(0, 3),
    reports: {
      summary: influencerSummary(store, user),
      campaigns: myParticipants,
      influencers: [],
      submissions: myParticipants.filter((participant) => participant.socialLink || participant.feedback),
      codes: myParticipants.map((participant) => ({
        campaignTitleEn: campaignById(store, participant.campaignId)?.titleEn || "",
        codeValue: "",
        verificationRef: participant.verificationRef || "",
        usageCount: campaignById(store, participant.campaignId)?.offerUsageCount || participant.assignedCodeUsageCount,
        offerText: campaignById(store, participant.campaignId)?.offerDescription || participant.assignedCodeOfferText,
        status: participant.status,
      })),
    },
    auditEvents: [],
  };
}

function handleExportReportCsv(req, res, store, actor, searchParams) {
  if (!requireRole(actor, ["admin", "campaign_manager"])) return sendJson(res, 403, { error: "Forbidden" });
  const tab = text(searchParams.get("tab")).toLowerCase();
  if (!["campaigns", "influencers", "submissions", "codes"].includes(tab)) {
    return sendJson(res, 422, { error: "A valid report tab is required." });
  }
  const campaignId = Number(searchParams.get("campaignId")) || null;
  const body = exportRowsForTab(store, tab, { campaignId });
  const fileName =
    tab === "submissions" && campaignId
      ? `pick-submissions-campaign-${campaignId}.csv`
      : `pick-${tab}-report.csv`;
  return sendCsv(res, fileName, body);
}

function publicMetadata(store) {
  return {
    cities: store.cities.filter((city) => city.status === "active"),
    categories: store.categories.filter((category) => category.status === "active"),
    platforms: store.platforms.filter((platform) => platform.status === "active"),
    tags: store.tags.filter((tag) => tag.status === "active"),
    addressReference: ADDRESS_REFERENCE,
    showUatPanel: SHOW_UAT_PANEL,
  };
}

function handleGetTerms(req, res, store) {
  return sendJson(res, 200, serializeTermsAndConditions(store));
}

async function handleUpdateTerms(req, res, store, actor) {
  if (!requireRole(actor, ["admin"])) return sendJson(res, 403, { error: "Forbidden" });
  const body = jsonOrForm(await readBody(req), req);
  const textEnValue = String(body.textEn || "").trim();
  const textArValue = String(body.textAr || "").trim();
  if (!textEnValue || !textArValue) {
    return sendJson(res, 422, { error: "Both English and Arabic terms are required." });
  }
  const previous = serializeTermsAndConditions(store);
  const nextVersion = Math.max(1, Number(previous.version) || 0) + 1;
  store.termsAndConditions = {
    version: nextVersion,
    textEn: textEnValue,
    textAr: textArValue,
    updatedAt: new Date().toISOString(),
    updatedByUserId: actor.id,
  };
  const next = serializeTermsAndConditions(store);
  appendAuditEvent(store, actor, "terms_updated", "user", actor.id, {
    oldVersion: previous.version,
    newVersion: next.version,
    oldHash: previous.contentHash,
    newHash: next.contentHash,
  });
  await writeStore(store);
  return sendJson(res, 200, next);
}

function campaignPayload(body, existingCampaign = null) {
  const normalizedStatus = ["active", "published"].includes(body.status)
    ? "live"
    : ["closed", "archived"].includes(body.status)
      ? "completed"
      : body.status;
  const targetTags = parseTags(body.targetTags ?? existingCampaign?.targetTags);
  const hasPreviewMode = body.previewMode !== undefined;
  return {
    titleEn: text(body.titleEn ?? existingCampaign?.titleEn),
    titleAr: text(body.titleAr ?? existingCampaign?.titleAr),
    descriptionEn: text(body.descriptionEn ?? existingCampaign?.descriptionEn),
    descriptionAr: text(body.descriptionAr ?? existingCampaign?.descriptionAr),
    captionGuide: text(body.captionGuide ?? existingCampaign?.captionGuide),
    whatsappMessage: text(body.whatsappMessage ?? existingCampaign?.whatsappMessage),
    previewMode: hasPreviewMode
      ? Boolean(body.previewMode === "1" || body.previewMode === true)
      : Boolean(existingCampaign?.previewMode),
    type: body.type === "product_trial" ? "product_trial" : "shop_visit",
    status: ["draft", "live", "deactivated", "completed"].includes(normalizedStatus)
      ? normalizedStatus
      : existingCampaign?.status || "draft",
    audience: text(body.audience ?? existingCampaign?.audience),
    audienceAr: text(body.audienceAr ?? existingCampaign?.audienceAr ?? body.audience),
    offerDescription: text(body.offerDescription ?? existingCampaign?.offerDescription),
    offerUsageCount: Math.max(1, Number(body.offerUsageCount ?? existingCampaign?.offerUsageCount) || 1),
    startDate: text(body.startDate ?? existingCampaign?.startDate),
    endDate: text(body.endDate ?? existingCampaign?.endDate),
    visitDeadline: text(body.visitDeadline ?? existingCampaign?.visitDeadline),
    submissionDeadline: text(body.submissionDeadline ?? existingCampaign?.submissionDeadline),
    branchMode: body.branchMode === "selected" ? "selected" : "all",
    branchIds: body.branchMode === "selected" ? parseNumberList(body.branchIds) : [],
    targetCountries: parseStringList(body.targetCountries),
    targetGovernorateIds: parseStringList(body.targetGovernorateIds),
    targetCityIds: parseStringList(body.targetCityIds),
    targetCategoryIds: parseNumberList(body.targetCategoryIds),
    targetTags,
    targetGender: text(body.targetGender ?? existingCampaign?.targetGender),
    minFollowers: Math.max(0, Number(body.minFollowers ?? existingCampaign?.minFollowers) || 0),
    targetPlatformIds: parseNumberList(body.targetPlatformIds ?? existingCampaign?.targetPlatformIds),
    participantCap: Math.max(0, Number(body.participantCap ?? existingCampaign?.participantCap) || 0),
    verificationPassword: text(body.verificationPassword ?? existingCampaign?.verificationPassword).toUpperCase(),
    targetingNeedsReset: false,
  };
}

function validateCampaignTimeline(payload) {
  const { startDate, endDate, visitDeadline, submissionDeadline } = payload;
  if (!startDate || !endDate || !visitDeadline || !submissionDeadline) return null;
  if (startDate > endDate) return "Start date must be on or before end date.";
  if (endDate > visitDeadline) return "Visit deadline must be the same as or later than the end date.";
  if (visitDeadline > submissionDeadline) return "Submission deadline must be the same as or later than the visit deadline.";
  return null;
}

function parseCsvRow(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (character === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }
    current += character;
  }

  values.push(current);
  return values.map((value) => text(value));
}

function normalizeHeader(value) {
  return text(value).toLowerCase().replace(/[\s_-]+/g, "");
}

function extractCodesFromCsv(textValue) {
  const lines = textValue.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return [];

  const rows = lines.map(parseCsvRow).filter((row) => row.some(Boolean));
  if (!rows.length) return [];

  const codeHeaders = new Set(["code", "poscode", "campaigncode"]);
  const usageHeaders = new Set(["usage", "usages", "usagecount", "numberofusage", "count", "quantity"]);
  const offerHeaders = new Set(["offer", "offertext", "offering", "product", "description", "amount"]);

  const headerRow = rows[0].map(normalizeHeader);
  const codeIndex = headerRow.findIndex((header) => codeHeaders.has(header));
  const usageIndex = headerRow.findIndex((header) => usageHeaders.has(header));
  const offerIndex = headerRow.findIndex((header) => offerHeaders.has(header));
  const hasHeader = codeIndex !== -1 || usageIndex !== -1 || offerIndex !== -1;
  const dataRows = hasHeader ? rows.slice(1) : rows;

  const seen = new Set();
  const codes = [];

  for (const row of dataRows) {
    const rawCode = hasHeader ? row[codeIndex] : row[0];
    const codeValue = normalizeCode(rawCode);
    if (!codeValue || seen.has(codeValue)) continue;

    const rawUsage = hasHeader ? row[usageIndex] : row[1];
    const usageCount = Math.max(1, Number(rawUsage) || 1);
    const rawOffer = hasHeader ? row[offerIndex] : row[2];
    const offerText = text(rawOffer);

    seen.add(codeValue);
    codes.push({ codeValue, usageCount, offerText });
  }

  return codes;
}

function cancelParticipant(store, participant, reason, codeStatus = "blocked") {
  participant.status = "canceled";
  participant.canceledReason = reason;
  const code = assignedCodeForParticipant(store, participant);
  if (code && codeStatus === "available") {
    releaseAssignedCode(store, participant);
  }
  if (code && codeStatus === "blocked") {
    code.status = "blocked";
    code.blockedAt = new Date().toISOString();
  }
  if (code && codeStatus === "deleted") {
    code.status = "deleted";
    code.deletedAt = new Date().toISOString();
  }
}

function rememberPasswordReset(store, userId, createdByUserId) {
  const token = randomToken();
  const record = {
    id: store.nextIds.passwordReset++,
    userId,
    token,
    createdByUserId,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
    usedAt: null,
  };
  store.passwordResets.unshift(record);
  return {
    token,
    resetLink: `${APP_BASE_URL}/?resetToken=${token}`,
  };
}

async function handleSession(req, res, store) {
  const user = getSessionUser(req, store);
  if (!user) return sendJson(res, 200, { authenticated: false });
  return sendJson(res, 200, { authenticated: true, user: sanitizeUser(user) });
}

async function handleLogin(req, res, store) {
  const body = jsonOrForm(await readBody(req), req);
  const email = text(body.email).toLowerCase();
  const password = text(body.password);
  const ip = clientIp(req);
  const ipLimit = checkRateLimit(`login:ip:${ip}`, 20, 60 * 1000);
  if (!ipLimit.ok) {
    return sendJson(res, 429, {
      error: `Too many login attempts from this device. Try again in ${ipLimit.retryAfterSeconds} second(s).`,
    });
  }
  const emailLimit = checkRateLimit(`login:email:${email}`, 10, 60 * 1000);
  if (!emailLimit.ok) {
    return sendJson(res, 429, {
      error: `Too many login attempts for this account. Try again in ${emailLimit.retryAfterSeconds} second(s).`,
    });
  }
  const lockedSeconds = isLockedOut(store, email);
  if (lockedSeconds !== null) {
    const remainingMinutes = Math.max(1, Math.ceil(lockedSeconds / 60));
    return sendJson(res, 429, {
      error: `This account is temporarily locked. Try again in ${remainingMinutes} minute(s).`,
    });
  }
  const user = store.users.find((item) => item.email.toLowerCase() === email);
  const verification = user ? await verifyPassword(password, user.password) : { ok: false, needsRehash: false };

  if (!user || !verification.ok) {
    recordLoginAttempt(store, email, false);
    await writeStore(store);
    return sendJson(res, 401, { error: "Invalid email or password." });
  }
  if (user.status !== "active") {
    recordLoginAttempt(store, email, false);
    await writeStore(store);
    return sendJson(res, 403, { error: "This account is not active yet." });
  }

  if (verification.needsRehash) {
    user.password = await hashPassword(password);
  }
  user.lastLogin = new Date().toISOString();
  recordLoginAttempt(store, email, true);
  appendAuditEvent(store, user, "auth.login", "user", user.id);
  await writeStore(store);
  const sessionId = createSession(user.id);
  return sendJson(
    res,
    200,
    { ok: true, user: sanitizeUser(user) },
    { "Set-Cookie": sessionCookieHeader(sessionId) }
  );
}

async function handleLogout(req, res) {
  destroySession(parseCookies(req)[SESSION_COOKIE]);
  return sendJson(
    res,
    200,
    { ok: true },
    { "Set-Cookie": sessionCookieHeader("", { maxAge: 0 }) }
  );
}

async function handleSignup(req, res, store) {
  const body = jsonOrForm(await readBody(req), req);
  const email = text(body.email).toLowerCase();
  const residentialResult = validateResidential(residentialFromBody(body));
  if (!residentialResult.ok) return sendJson(res, 422, { error: residentialResult.error });
  const categoryResult = validateCategoryIds(categoryIdsFromBody(body), store);
  if (!categoryResult.ok) return sendJson(res, 422, { error: categoryResult.error });
  if (body.termsAccepted !== true) {
    return sendJson(res, 422, { error: "terms_acceptance_required" });
  }
  if (!email || !text(body.password) || !text(body.fullName)) {
    return sendJson(res, 422, { error: "Full name, email, and password are required." });
  }
  const signupPasswordError = passwordStrengthError(body.password);
  if (signupPasswordError) {
    return sendJson(res, 422, { error: signupPasswordError });
  }
  const signupRateLimit = checkRateLimit(`signup:ip:${clientIp(req)}`, 5, 10 * 60 * 1000);
  if (!signupRateLimit.ok) {
    return sendJson(res, 429, {
      error: `Too many signup attempts. Try again in ${signupRateLimit.retryAfterSeconds} second(s).`,
    });
  }
  const signupGender = normalizeGender(body.gender);
  if (!signupGender) {
    return sendJson(res, 422, { error: "Gender is required and must be male or female." });
  }
  if (!text(body.mobile)) {
    return sendJson(res, 422, { error: "Mobile number is required." });
  }
  if (!validKuwaitMobile(body.mobile)) {
    return sendJson(res, 422, { error: "Mobile number must be 8 digits in Kuwait format." });
  }
  if (!text(body.instagram)) {
    return sendJson(res, 422, { error: "Instagram is required." });
  }
  if (store.users.some((user) => user.email.toLowerCase() === email)) {
    return sendJson(res, 409, { error: "This email already exists." });
  }

  const user = {
    id: store.nextIds.user++,
    role: "influencer",
    fullName: text(body.fullName),
    email,
    password: await hashPassword(text(body.password)),
    status: "pending",
    mobile: normalizeKuwaitMobile(body.mobile),
    gender: signupGender,
    dateOfBirth: text(body.dateOfBirth),
    residential: residentialResult.value,
    categoryIds: categoryResult.value,
    preferredLanguage: text(body.preferredLanguage || "en"),
    instagram: normalizeSocialHandle(body.instagram),
    tiktok: normalizeSocialHandle(body.tiktok),
    snapchat: normalizeSocialHandle(body.snapchat),
    followers: {
      instagram: Number(body.instagramFollowers) || 0,
      tiktok: Number(body.tiktokFollowers) || 0,
      snapchat: Number(body.snapchatFollowers) || 0,
    },
    preferredPlatform: text(body.preferredPlatform),
    tags: [],
    notes: [],
    avatarName: "",
    avatarPath: "",
    createdAt: new Date().toISOString(),
    lastLogin: "",
    approvedByUserId: null,
    termsAcceptance: null,
  };

  store.users.push(user);
  const termsSnapshot = currentTermsSnapshot(store);
  user.termsAcceptance = {
    acceptedAt: new Date().toISOString(),
    acceptedVersion: termsSnapshot.version,
    contentHash: termsSnapshot.contentHash,
  };
  appendAuditEvent(store, user, "residential_updated", "user", user.id, {
    country: user.residential?.country || "",
    source: "signup",
  });
  appendAuditEvent(store, user, "categories_updated", "user", user.id, {
    categoryIds: user.categoryIds,
    source: "signup",
  });
  appendAuditEvent(store, user, "terms_accepted", "user", user.id, {
    version: termsSnapshot.version,
    contentHash: termsSnapshot.contentHash,
  });
  let signupAddressWarning = null;
  if (body.address !== undefined && body.address !== null) {
    const result = validateAddress(body.address);
    if (result.ok && result.value) {
      user.address = result.value;
      appendAuditEvent(store, user, "address_updated", "user", user.id, {
        country: result.value.country,
        source: "signup",
      });
    } else if (!result.ok) {
      signupAddressWarning = result.error || "invalid_address";
      appendAuditEvent(store, user, "address_rejected", "user", user.id, {
        reason: signupAddressWarning,
        source: "signup",
      });
    }
  }
  await writeStore(store);
  return sendJson(res, 200, {
    ok: true,
    user: sanitizeUser(user),
    ...(signupAddressWarning ? { addressWarning: signupAddressWarning } : {}),
  });
}

async function handleForgotPassword(req, res, store) {
  const body = jsonOrForm(await readBody(req), req);
  const email = text(body.email).toLowerCase();
  const forgotRateLimit = checkRateLimit(`forgot:ip:${clientIp(req)}`, 5, 10 * 60 * 1000);
  if (!forgotRateLimit.ok) {
    return sendJson(res, 429, {
      error: `Too many reset requests. Try again in ${forgotRateLimit.retryAfterSeconds} second(s).`,
    });
  }
  const user = store.users.find((item) => item.email.toLowerCase() === email);
  if (user) {
    const reset = rememberPasswordReset(store, user.id, null);
    appendAuditEvent(store, user, "user.password_forgot_requested", "user", user.id);
    const resetLine = `${new Date().toISOString()}\t${user.email}\t${reset.resetLink}\n`;
    await fs.appendFile(RESET_LINKS_LOG_PATH, resetLine, "utf8");
    console.log(`Password reset link for ${user.email}: ${reset.resetLink}`);
    await writeStore(store);
  }
  return sendJson(res, 200, {
    ok: true,
    message: "If an account exists for this email, a reset link has been generated. Contact your admin to retrieve it.",
  });
}

async function handleResetPassword(req, res, store) {
  const body = jsonOrForm(await readBody(req), req);
  const token = text(body.token);
  const password = text(body.password);
  const record = store.passwordResets.find((item) => item.token === token && !item.usedAt);
  if (!record) return sendJson(res, 404, { error: "Reset link is invalid." });
  if (new Date(record.expiresAt) < new Date()) return sendJson(res, 410, { error: "Reset link has expired." });
  if (!password) return sendJson(res, 422, { error: "New password is required." });
  const resetPasswordError = passwordStrengthError(password);
  if (resetPasswordError) return sendJson(res, 422, { error: resetPasswordError });

  const user = userById(store, record.userId);
  if (!user) return sendJson(res, 404, { error: "User not found." });

  user.password = await hashPassword(password);
  record.usedAt = new Date().toISOString();
  appendAuditEvent(store, user, "user.password_reset", "user", user.id);
  await writeStore(store);
  return sendJson(res, 200, { ok: true });
}

async function handleBootstrap(req, res, store, user) {
  return sendJson(res, 200, buildBootstrap(store, user, { baseUrl: getRequestBaseUrl(req) }));
}

async function handleUserStatus(req, res, store, actor, userId) {
  if (!requireRole(actor, ["admin", "campaign_manager"])) return sendJson(res, 403, { error: "Forbidden" });
  const body = jsonOrForm(await readBody(req), req);
  const user = userById(store, userId);
  if (!user || user.role !== "influencer") return sendJson(res, 404, { error: "Member not found." });
  if (!["active", "pending", "rejected", "suspended"].includes(body.status)) {
    return sendJson(res, 422, { error: "Invalid status." });
  }
  const previousStatus = user.status;
  user.status = body.status;
  user.approvedByUserId = body.status === "active" ? actor.id : user.approvedByUserId;
  appendAuditEvent(store, actor, "user.status_change", "user", user.id, {
    from: previousStatus,
    to: user.status,
  });
  await writeStore(store);
  return sendJson(res, 200, { ok: true });
}

async function handleAdminUpdateInfluencer(req, res, store, actor, userId) {
  if (!requireRole(actor, ["admin", "campaign_manager"])) return sendJson(res, 403, { error: "Forbidden" });
  const body = jsonOrForm(await readBody(req), req);
  const user = userById(store, userId);
  if (!user || user.role !== "influencer") return sendJson(res, 404, { error: "Member not found." });

  const tags = parseTags(body.tags);
  if (invalidTags(tags).length) {
    return sendJson(res, 422, { error: "Tags must be comma-separated, lowercase, and use only letters, numbers, or hyphens." });
  }
  if (unknownTags(store, tags).length) {
    return sendJson(res, 422, { error: "Choose member tags from the admin tag library." });
  }
  user.tags = tags;
  user.notes = parseList(body.notes);
  await writeStore(store);
  return sendJson(res, 200, { ok: true });
}

async function handleSetUserPassword(req, res, store, actor, userId) {
  if (!requireRole(actor, ["admin", "campaign_manager"])) return sendJson(res, 403, { error: "Forbidden" });
  const body = jsonOrForm(await readBody(req), req);
  const user = userById(store, userId);
  if (!user) return sendJson(res, 404, { error: "User not found." });
  if (actor.role === "campaign_manager" && user.role !== "influencer") return sendJson(res, 403, { error: "Forbidden" });
  if (actor.role === "admin" && !["influencer", "campaign_manager"].includes(user.role)) return sendJson(res, 403, { error: "Forbidden" });
  if (!text(body.password)) return sendJson(res, 422, { error: "Password is required." });
  const setPasswordError = passwordStrengthError(body.password);
  if (setPasswordError) return sendJson(res, 422, { error: setPasswordError });
  user.password = await hashPassword(text(body.password));
  user.passwordResetMode = "manual";
  appendAuditEvent(store, actor, "user.password_set", "user", user.id);
  await writeStore(store);
  return sendJson(res, 200, { ok: true });
}

async function handleGenerateResetLink(req, res, store, actor, userId) {
  if (!requireRole(actor, ["admin", "campaign_manager"])) return sendJson(res, 403, { error: "Forbidden" });
  const user = userById(store, userId);
  if (!user) return sendJson(res, 404, { error: "User not found." });
  if (actor.role === "campaign_manager" && user.role !== "influencer") return sendJson(res, 403, { error: "Forbidden" });
  if (actor.role === "admin" && !["influencer", "campaign_manager"].includes(user.role)) return sendJson(res, 403, { error: "Forbidden" });
  const reset = rememberPasswordReset(store, user.id, actor.id);
  appendAuditEvent(store, actor, "user.reset_link_generated", "user", user.id);
  await writeStore(store);
  return sendJson(res, 200, { ok: true, resetLink: reset.resetLink });
}

function profileBodyHasResidential(body) {
  return body?.residential !== undefined || body?.residentialCountry !== undefined || body?.residentialTier2Id !== undefined || body?.residentialTier3Id !== undefined;
}

function profileResidentialInput(body) {
  if (body?.residential && typeof body.residential === "object") return body.residential;
  return residentialFromBody(body);
}

async function applyUserProfileUpdates(store, user, body, files, options = {}) {
  const actor = options.actor || user;
  const auditSource = options.auditSource || "profile";
  const shouldAuditFieldChanges = options.auditFieldChanges !== false;
  if (body.fullName !== undefined && !text(body.fullName)) {
    return { ok: false, status: 422, error: "Full name is required." };
  }

  const editable = [
    "fullName",
    "gender",
    "dateOfBirth",
    "instagram",
    "tiktok",
    "snapchat",
    "preferredPlatform",
    "preferredLanguage",
  ];
  for (const key of editable) {
    if (body[key] !== undefined) user[key] = text(body[key]);
  }
  if (body.gender !== undefined) {
    const normalizedGender = normalizeGender(body.gender);
    if (!normalizedGender && (user.role === "influencer" || text(body.gender))) {
      return { ok: false, status: 422, error: "Gender is required and must be male or female." };
    }
    user.gender = normalizedGender;
  }
  if (body.mobile !== undefined) {
    if (text(body.mobile) && !validKuwaitMobile(body.mobile)) {
      return { ok: false, status: 422, error: "Mobile number must be 8 digits in Kuwait format." };
    }
    user.mobile = normalizeKuwaitMobile(body.mobile);
  }

  if (body.categoryIds !== undefined) {
    const categoryResult = validateCategoryIds(categoryIdsFromBody(body), store);
    if (!categoryResult.ok) return { ok: false, status: 422, error: categoryResult.error };
    user.categoryIds = categoryResult.value;
    if (shouldAuditFieldChanges) {
      appendAuditEvent(store, actor, "categories_updated", "user", user.id, {
        categoryIds: user.categoryIds,
        source: auditSource,
      });
    }
  } else if (!(user.categoryIds || []).length) {
    return { ok: false, status: 422, error: "category_required" };
  }

  if (profileBodyHasResidential(body)) {
    const residentialResult = validateResidential(profileResidentialInput(body));
    if (!residentialResult.ok) return { ok: false, status: 422, error: residentialResult.error };
    user.residential = residentialResult.value;
    if (shouldAuditFieldChanges) {
      appendAuditEvent(store, actor, "residential_updated", "user", user.id, {
        country: user.residential?.country || "",
        source: auditSource,
      });
    }
  } else if (!user.residential) {
    return { ok: false, status: 422, error: "residential_required" };
  }

  if (user.role === "influencer") {
    if (!text(user.mobile)) return { ok: false, status: 422, error: "Mobile number is required." };
    if (!(user.categoryIds || []).length) return { ok: false, status: 422, error: "category_required" };
    if (!user.residential) return { ok: false, status: 422, error: "residential_required" };
    if (!text(user.instagram)) return { ok: false, status: 422, error: "Instagram is required." };
  }

  user.followers ||= { instagram: 0, tiktok: 0, snapchat: 0 };
  if (body.instagramFollowers !== undefined) user.followers.instagram = Number(body.instagramFollowers) || 0;
  if (body.tiktokFollowers !== undefined) user.followers.tiktok = Number(body.tiktokFollowers) || 0;
  if (body.snapchatFollowers !== undefined) user.followers.snapchat = Number(body.snapchatFollowers) || 0;
  if (body.instagram !== undefined) user.instagram = normalizeSocialHandle(body.instagram);
  if (body.tiktok !== undefined) user.tiktok = normalizeSocialHandle(body.tiktok);
  if (body.snapchat !== undefined) user.snapchat = normalizeSocialHandle(body.snapchat);

  const avatar = files?.avatar;
  if (avatar && avatar.filename) {
    const persisted = await persistUploadedImage(avatar);
    user.avatarName = persisted.displayName;
    user.avatarPath = `/uploads/${persisted.storedName}`;
  }

  return { ok: true };
}

async function handleProfileUpdate(req, res, store, actor) {
  const parsed = await parseMultipartOrForm(req);
  const body = parsed.fields;
  const user = userById(store, actor.id);
  if (!user) return sendJson(res, 404, { error: "User not found." });
  const updated = await applyUserProfileUpdates(store, user, body, parsed.files, {
    actor: user,
    auditSource: "profile",
  });
  if (!updated.ok) return sendJson(res, updated.status || 422, { error: updated.error });
  await writeStore(store);
  return sendJson(res, 200, { ok: true });
}

async function handleGetMyAddress(req, res, store, actor) {
  if (!actor) return sendJson(res, 401, { error: "Unauthorized" });
  const user = userById(store, actor.id);
  if (!user) return sendJson(res, 404, { error: "User not found." });
  return sendJson(res, 200, { address: user.address || null });
}

async function handleUpdateMyAddress(req, res, store, actor) {
  if (!actor) return sendJson(res, 401, { error: "Unauthorized" });
  const result = validateAddress(jsonOrForm(await readBody(req), req));
  if (!result.ok) return sendJson(res, 400, { error: result.error });
  const user = userById(store, actor.id);
  if (!user) return sendJson(res, 404, { error: "User not found." });

  if (!result.value) {
    delete user.address;
    appendAuditEvent(store, user, "address_cleared", "user", user.id);
    await writeStore(store);
    return sendJson(res, 200, { address: null });
  }

  user.address = result.value;
  appendAuditEvent(store, user, "address_updated", "user", user.id, {
    country: result.value.country || "",
  });
  await writeStore(store);
  return sendJson(res, 200, { address: user.address });
}

async function handleClearMyAddress(req, res, store, actor) {
  if (!actor) return sendJson(res, 401, { error: "Unauthorized" });
  const user = userById(store, actor.id);
  if (!user) return sendJson(res, 404, { error: "User not found." });
  if (user.address) {
    delete user.address;
    appendAuditEvent(store, user, "address_cleared", "user", user.id);
    await writeStore(store);
  }
  return sendJson(res, 200, { ok: true });
}

async function handleAdminGetUserAddress(req, res, store, actor, userIdParam) {
  if (!actor) return sendJson(res, 401, { error: "Unauthorized" });
  const target = userById(store, Number(userIdParam));
  const access = ensureAdminCanEditMember(actor, target);
  if (!access.ok) return sendJson(res, access.status, { error: access.error });
  appendAuditEvent(store, actor, "address_viewed", "user", target.id, { viewerRole: actor.role });
  await writeStore(store);
  return sendJson(res, 200, { address: target.address || null });
}

function ensureAdminCanEditMember(actor, target) {
  if (!actor || !requireRole(actor, ["admin", "campaign_manager"])) {
    return { ok: false, status: 403, error: "forbidden" };
  }
  if (!target) return { ok: false, status: 404, error: "not_found" };
  if (actor.role === "campaign_manager" && target.role === "admin") {
    return { ok: false, status: 403, error: "cannot_edit_admin" };
  }
  if (target.role !== "influencer") {
    return { ok: false, status: 403, error: "forbidden" };
  }
  return { ok: true };
}

async function handleAdminUpdateUserProfile(req, res, store, actor, userIdParam) {
  if (!actor) return sendJson(res, 401, { error: "Unauthorized" });
  const target = userById(store, Number(userIdParam));
  const access = ensureAdminCanEditMember(actor, target);
  if (!access.ok) return sendJson(res, access.status, { error: access.error });

  const parsed = await parseMultipartOrForm(req);
  const body = parsed.fields;
  const updated = await applyUserProfileUpdates(store, target, body, parsed.files, {
    actor,
    auditSource: "admin",
  });
  if (!updated.ok) return sendJson(res, updated.status || 422, { error: updated.error });

  const fieldsChanged = [...new Set([
    ...Object.keys(body || {}).filter((key) => key !== "avatar"),
    ...(parsed.files?.avatar?.filename ? ["avatar"] : []),
  ])];
  appendAuditEvent(store, actor, "profile_updated_by_admin", "user", target.id, {
    fieldsChanged,
  });
  await writeStore(store);
  return sendJson(res, 200, { user: sanitizeUser(target, { includeAddress: true }) });
}

async function handleAdminUpdateUserAddress(req, res, store, actor, userIdParam) {
  if (!actor) return sendJson(res, 401, { error: "Unauthorized" });
  const target = userById(store, Number(userIdParam));
  const access = ensureAdminCanEditMember(actor, target);
  if (!access.ok) return sendJson(res, access.status, { error: access.error });

  const result = validateAddress(jsonOrForm(await readBody(req), req));
  if (!result.ok) return sendJson(res, 422, { error: result.error });
  target.address = result.value;
  appendAuditEvent(store, actor, "address_updated", "user", target.id, {
    country: result.value?.country || "",
    editedByRole: actor.role,
  });
  await writeStore(store);
  return sendJson(res, 200, { address: target.address || null });
}

async function handleAdminClearUserAddress(req, res, store, actor, userIdParam) {
  if (!actor) return sendJson(res, 401, { error: "Unauthorized" });
  const target = userById(store, Number(userIdParam));
  const access = ensureAdminCanEditMember(actor, target);
  if (!access.ok) return sendJson(res, access.status, { error: access.error });
  if (target.address) {
    delete target.address;
    appendAuditEvent(store, actor, "address_cleared", "user", target.id, {
      editedByRole: actor.role,
    });
    await writeStore(store);
  }
  return sendJson(res, 200, { ok: true });
}

async function handleCreateManager(req, res, store, actor) {
  if (!requireRole(actor, ["admin"])) return sendJson(res, 403, { error: "Forbidden" });
  const body = jsonOrForm(await readBody(req), req);
  const email = text(body.email).toLowerCase();
  if (!text(body.fullName) || !email || !text(body.password)) {
    return sendJson(res, 422, { error: "Full name, email, and password are required." });
  }
  const managerPasswordError = passwordStrengthError(body.password);
  if (managerPasswordError) {
    return sendJson(res, 422, { error: managerPasswordError });
  }
  if (!validKuwaitMobile(body.mobile)) {
    return sendJson(res, 422, { error: "Mobile number must be 8 digits in Kuwait format." });
  }
  if (store.users.some((user) => user.email.toLowerCase() === email)) {
    return sendJson(res, 409, { error: "This email already exists." });
  }

  const newManagerId = store.nextIds.user++;
  store.users.push({
    id: newManagerId,
    role: "campaign_manager",
    fullName: text(body.fullName),
    email,
    password: await hashPassword(text(body.password)),
    status: "active",
    residential: null,
    categoryIds: [],
    preferredLanguage: text(body.preferredLanguage || "en"),
    mobile: normalizeKuwaitMobile(body.mobile),
    gender: "",
    dateOfBirth: "",
    instagram: "",
    tiktok: "",
    snapchat: "",
    followers: { instagram: 0, tiktok: 0, snapchat: 0 },
    preferredPlatform: "",
    tags: [],
    notes: [],
    avatarName: "",
    avatarPath: "",
    createdAt: new Date().toISOString(),
    lastLogin: "",
    approvedByUserId: actor.id,
  });

  appendAuditEvent(store, actor, "user.manager_created", "user", newManagerId, { email });
  await writeStore(store);
  return sendJson(res, 201, { ok: true });
}

async function handleUpdateManager(req, res, store, actor, userId) {
  if (!requireRole(actor, ["admin"])) return sendJson(res, 403, { error: "Forbidden" });
  const body = jsonOrForm(await readBody(req), req);
  const user = userById(store, userId);
  if (!user || user.role !== "campaign_manager") return sendJson(res, 404, { error: "Campaign manager not found." });
  const email = text(body.email || user.email).toLowerCase();
  if (!text(body.fullName || user.fullName) || !email) {
    return sendJson(res, 422, { error: "Full name and email are required." });
  }
  if (store.users.some((item) => item.id !== user.id && item.email.toLowerCase() === email)) {
    return sendJson(res, 409, { error: "This email already exists." });
  }
  if (!validKuwaitMobile(body.mobile ?? user.mobile)) {
    return sendJson(res, 422, { error: "Mobile number must be 8 digits in Kuwait format." });
  }
  user.fullName = text(body.fullName || user.fullName);
  user.email = email;
  user.mobile = normalizeKuwaitMobile(body.mobile ?? user.mobile);
  user.preferredLanguage = text(body.preferredLanguage || user.preferredLanguage || "en");
  user.status = body.status === "suspended" ? "suspended" : "active";
  await writeStore(store);
  return sendJson(res, 200, { ok: true });
}

async function handleCreateCity(req, res, store, actor) {
  if (!requireRole(actor, ["admin"])) return sendJson(res, 403, { error: "Forbidden" });
  const body = jsonOrForm(await readBody(req), req);
  if (!text(body.nameEn)) return sendJson(res, 422, { error: "City English name is required." });
  store.cities.push({
    id: store.nextIds.city++,
    nameEn: text(body.nameEn),
    nameAr: text(body.nameAr || body.nameEn),
    status: body.status === "inactive" ? "inactive" : "active",
    createdAt: new Date().toISOString(),
  });
  await writeStore(store);
  return sendJson(res, 201, { ok: true });
}

async function handleUpdateCity(req, res, store, actor, cityId) {
  if (!requireRole(actor, ["admin"])) return sendJson(res, 403, { error: "Forbidden" });
  const city = cityById(store, cityId);
  if (!city) return sendJson(res, 404, { error: "City not found." });
  const body = jsonOrForm(await readBody(req), req);
  city.nameEn = text(body.nameEn || city.nameEn);
  city.nameAr = text(body.nameAr || city.nameAr);
  city.status = body.status === "inactive" ? "inactive" : "active";
  await writeStore(store);
  return sendJson(res, 200, { ok: true });
}

async function handleDeleteCity(req, res, store, actor, cityId) {
  if (!requireRole(actor, ["admin"])) return sendJson(res, 403, { error: "Forbidden" });
  const city = cityById(store, cityId);
  if (!city) return sendJson(res, 404, { error: "City not found." });
  city.status = "inactive";
  await writeStore(store);
  return sendJson(res, 200, { ok: true });
}

async function handleCreateCategory(req, res, store, actor) {
  if (!requireRole(actor, ["admin"])) return sendJson(res, 403, { error: "Forbidden" });
  const body = jsonOrForm(await readBody(req), req);
  if (!text(body.nameEn)) return sendJson(res, 422, { error: "Category English name is required." });
  store.categories.push({
    id: store.nextIds.category++,
    nameEn: text(body.nameEn),
    nameAr: text(body.nameAr || body.nameEn),
    status: body.status === "inactive" ? "inactive" : "active",
    createdAt: new Date().toISOString(),
  });
  await writeStore(store);
  return sendJson(res, 201, { ok: true });
}

async function handleUpdateCategory(req, res, store, actor, categoryId) {
  if (!requireRole(actor, ["admin"])) return sendJson(res, 403, { error: "Forbidden" });
  const category = categoryById(store, categoryId);
  if (!category) return sendJson(res, 404, { error: "Category not found." });
  const body = jsonOrForm(await readBody(req), req);
  category.nameEn = text(body.nameEn || category.nameEn);
  category.nameAr = text(body.nameAr || category.nameAr);
  category.status = body.status === "inactive" ? "inactive" : "active";
  await writeStore(store);
  return sendJson(res, 200, { ok: true });
}

async function handleDeleteCategory(req, res, store, actor, categoryId) {
  if (!requireRole(actor, ["admin"])) return sendJson(res, 403, { error: "Forbidden" });
  const category = categoryById(store, categoryId);
  if (!category) return sendJson(res, 404, { error: "Category not found." });
  category.status = "inactive";
  await writeStore(store);
  return sendJson(res, 200, { ok: true });
}

async function handleCreatePlatform(req, res, store, actor) {
  if (!requireRole(actor, ["admin"])) return sendJson(res, 403, { error: "Forbidden" });
  const body = jsonOrForm(await readBody(req), req);
  if (!text(body.nameEn)) return sendJson(res, 422, { error: "Platform English name is required." });
  store.platforms.push({
    id: store.nextIds.platform++,
    nameEn: text(body.nameEn),
    nameAr: text(body.nameAr || body.nameEn),
    status: body.status === "inactive" ? "inactive" : "active",
    createdAt: new Date().toISOString(),
  });
  await writeStore(store);
  return sendJson(res, 201, { ok: true });
}

async function handleUpdatePlatform(req, res, store, actor, platformId) {
  if (!requireRole(actor, ["admin"])) return sendJson(res, 403, { error: "Forbidden" });
  const platform = platformById(store, platformId);
  if (!platform) return sendJson(res, 404, { error: "Platform not found." });
  const body = jsonOrForm(await readBody(req), req);
  platform.nameEn = text(body.nameEn || platform.nameEn);
  platform.nameAr = text(body.nameAr || platform.nameAr);
  platform.status = body.status === "inactive" ? "inactive" : "active";
  await writeStore(store);
  return sendJson(res, 200, { ok: true });
}

async function handleDeletePlatform(req, res, store, actor, platformId) {
  if (!requireRole(actor, ["admin"])) return sendJson(res, 403, { error: "Forbidden" });
  const platform = platformById(store, platformId);
  if (!platform) return sendJson(res, 404, { error: "Platform not found." });
  platform.status = "inactive";
  await writeStore(store);
  return sendJson(res, 200, { ok: true });
}

async function handleCreateTag(req, res, store, actor) {
  if (!requireRole(actor, ["admin"])) return sendJson(res, 403, { error: "Forbidden" });
  const body = jsonOrForm(await readBody(req), req);
  const value = normalizeTag(body.value);
  if (!value) return sendJson(res, 422, { error: "Tag value is required." });
  if (invalidTags([value]).length) {
    return sendJson(res, 422, { error: "Tags must use only lowercase letters, numbers, or hyphens." });
  }
  if (store.tags.some((tag) => normalizeTag(tag.value) === value)) {
    return sendJson(res, 409, { error: "This tag already exists." });
  }
  store.tags.push({
    id: store.nextIds.tag++,
    value,
    status: body.status === "inactive" ? "inactive" : "active",
    createdAt: new Date().toISOString(),
  });
  await writeStore(store);
  return sendJson(res, 201, { ok: true });
}

async function handleUpdateTag(req, res, store, actor, tagId) {
  if (!requireRole(actor, ["admin"])) return sendJson(res, 403, { error: "Forbidden" });
  const tag = tagById(store, tagId);
  if (!tag) return sendJson(res, 404, { error: "Tag not found." });
  const body = jsonOrForm(await readBody(req), req);
  const previousValue = normalizeTag(tag.value);
  const value = normalizeTag(body.value || tag.value);
  if (!value) return sendJson(res, 422, { error: "Tag value is required." });
  if (invalidTags([value]).length) {
    return sendJson(res, 422, { error: "Tags must use only lowercase letters, numbers, or hyphens." });
  }
  if (store.tags.some((row) => row.id !== tag.id && normalizeTag(row.value) === value)) {
    return sendJson(res, 409, { error: "This tag already exists." });
  }
  if (previousValue && previousValue !== value) {
    for (const user of store.users) {
      if (user.tags?.includes(previousValue)) {
        user.tags = user.tags.map((item) => (item === previousValue ? value : item));
      }
    }
    for (const campaign of store.campaigns) {
      if (campaign.targetTags?.includes(previousValue)) {
        campaign.targetTags = campaign.targetTags.map((item) => (item === previousValue ? value : item));
      }
    }
  }
  tag.value = value;
  tag.status = body.status === "inactive" ? "inactive" : "active";
  await writeStore(store);
  return sendJson(res, 200, { ok: true });
}

async function handleDeleteTag(req, res, store, actor, tagId) {
  if (!requireRole(actor, ["admin"])) return sendJson(res, 403, { error: "Forbidden" });
  const tag = tagById(store, tagId);
  if (!tag) return sendJson(res, 404, { error: "Tag not found." });
  tag.status = "inactive";
  await writeStore(store);
  return sendJson(res, 200, { ok: true });
}

async function handleCreateBranch(req, res, store, actor) {
  if (!requireRole(actor, ["admin"])) return sendJson(res, 403, { error: "Forbidden" });
  const rawBody = await readBody(req);
  const contentType = req.headers["content-type"] || "";
  const parsed = contentType.includes("multipart/form-data")
    ? parseMultipart(rawBody, contentType)
    : { fields: jsonOrForm(rawBody, req), files: {} };
  const body = parsed.fields;
  if (!text(body.nameEn) || !Number(body.cityId)) {
    return sendJson(res, 422, { error: "Branch name and city are required." });
  }
  const branch = {
    id: store.nextIds.branch++,
    nameEn: text(body.nameEn),
    nameAr: text(body.nameAr || body.nameEn),
    cityId: Number(body.cityId),
    addressEn: text(body.addressEn),
    addressAr: text(body.addressAr || body.addressEn),
    mapLink: text(body.mapLink),
    imageName: "",
    imagePath: "",
    pin: randomSixDigitPin(),
    pinUpdatedAt: new Date().toISOString(),
    maxVisitsPerDay: Math.max(0, Number(body.maxVisitsPerDay) || 0),
    status: body.status === "inactive" ? "inactive" : "active",
    createdAt: new Date().toISOString(),
  };
  const image = parsed.files.image;
  if (image && image.filename) {
    const persisted = await persistUploadedImage(image);
    branch.imageName = persisted.displayName;
    branch.imagePath = `/uploads/${persisted.storedName}`;
  }
  store.branches.push(branch);
  await writeStore(store);
  return sendJson(res, 201, { ok: true });
}

async function handleUpdateBranch(req, res, store, actor, branchId) {
  if (!requireRole(actor, ["admin"])) return sendJson(res, 403, { error: "Forbidden" });
  const branch = branchById(store, branchId);
  if (!branch) return sendJson(res, 404, { error: "Branch not found." });
  const rawBody = await readBody(req);
  const contentType = req.headers["content-type"] || "";
  const parsed = contentType.includes("multipart/form-data")
    ? parseMultipart(rawBody, contentType)
    : { fields: jsonOrForm(rawBody, req), files: {} };
  const body = parsed.fields;
  branch.nameEn = text(body.nameEn || branch.nameEn);
  branch.nameAr = text(body.nameAr || branch.nameAr);
  branch.cityId = Number(body.cityId) || branch.cityId;
  branch.addressEn = text(body.addressEn ?? branch.addressEn);
  branch.addressAr = text(body.addressAr ?? branch.addressAr);
  branch.mapLink = text(body.mapLink ?? branch.mapLink);
  branch.maxVisitsPerDay = Math.max(0, Number(body.maxVisitsPerDay ?? branch.maxVisitsPerDay) || 0);
  branch.status = body.status === "inactive" ? "inactive" : "active";
  const image = parsed.files.image;
  if (image && image.filename) {
    const persisted = await persistUploadedImage(image);
    branch.imageName = persisted.displayName;
    branch.imagePath = `/uploads/${persisted.storedName}`;
  }
  await writeStore(store);
  return sendJson(res, 200, { ok: true });
}

async function handleRotateBranchPin(req, res, store, actor, branchId) {
  if (!requireRole(actor, ["admin"])) return sendJson(res, 403, { error: "Forbidden" });
  const branch = branchById(store, branchId);
  if (!branch) return sendJson(res, 404, { error: "Branch not found." });
  branch.pin = randomSixDigitPin();
  branch.pinUpdatedAt = new Date().toISOString();
  appendAuditEvent(store, actor, "branch.pin_rotated", "branch", branch.id);
  await writeStore(store);
  return sendJson(res, 200, { ok: true, branch: serializeBranch(store, branch, { includePin: true }) });
}

async function parseMultipartOrForm(req) {
  const rawBody = await readBody(req);
  const contentType = req.headers["content-type"] || "";
  return contentType.includes("multipart/form-data")
    ? parseMultipart(rawBody, contentType)
    : { fields: jsonOrForm(rawBody, req), files: {} };
}

async function handleJournalIndex(req, res, store, actor) {
  if (!actor) return sendJson(res, 401, { error: "Unauthorized" });
  return sendJson(res, 200, {
    entries: visibleJournalEntriesFor(store, actor).map((entry) => serializeJournalEntry(store, entry)),
  });
}

async function handleCreateJournalEntry(req, res, store, actor) {
  if (!requireRole(actor, ["admin", "campaign_manager"])) return sendJson(res, 403, { error: "Forbidden" });
  const parsed = await parseMultipartOrForm(req);
  const body = parsed.fields;
  const shouldPublish = body.publish === "1" || body.publish === true;
  const now = new Date().toISOString();
  const entry = {
    id: store.nextIds.journalEntry++,
    titleEn: text(body.titleEn),
    titleAr: text(body.titleAr || body.titleEn),
    bodyEn: text(body.bodyEn),
    bodyAr: text(body.bodyAr || body.bodyEn),
    imageName: "",
    imagePath: "",
    externalLink: text(body.externalLink),
    status: shouldPublish ? "published" : "draft",
    authorUserId: actor.id,
    createdAt: now,
    updatedAt: now,
    publishedAt: shouldPublish ? now : null,
  };
  if (!entry.titleEn || !entry.bodyEn) {
    return sendJson(res, 422, { error: "English title and body are required." });
  }
  const image = parsed.files.image;
  if (image?.filename) {
    const persisted = await persistUploadedImage(image);
    entry.imageName = persisted.displayName;
    entry.imagePath = `/uploads/${persisted.storedName}`;
  }
  store.journalEntries.unshift(entry);
  appendAuditEvent(store, actor, "journal.created", "journalEntry", entry.id);
  if (shouldPublish) appendAuditEvent(store, actor, "journal.published", "journalEntry", entry.id);
  await writeStore(store);
  return sendJson(res, 201, { ok: true, entry: serializeJournalEntry(store, entry) });
}

async function handleUpdateJournalEntry(req, res, store, actor, entryId) {
  if (!requireRole(actor, ["admin", "campaign_manager"])) return sendJson(res, 403, { error: "Forbidden" });
  const entry = store.journalEntries.find((item) => item.id === Number(entryId));
  if (!entry || entry.status === "deleted") return sendJson(res, 404, { error: "Journal entry not found." });
  if (!canManageJournalEntry(actor, entry)) return sendJson(res, 403, { error: "Forbidden" });
  const parsed = await parseMultipartOrForm(req);
  const body = parsed.fields;
  const shouldPublish = body.publish === "1" || body.publish === true;
  const wasPublished = entry.status === "published";
  entry.titleEn = text(body.titleEn || entry.titleEn);
  entry.titleAr = text(body.titleAr || entry.titleAr || entry.titleEn);
  entry.bodyEn = text(body.bodyEn || entry.bodyEn);
  entry.bodyAr = text(body.bodyAr || entry.bodyAr || entry.bodyEn);
  entry.externalLink = text(body.externalLink ?? entry.externalLink);
  entry.updatedAt = new Date().toISOString();
  entry.status = shouldPublish ? "published" : "draft";
  if (entry.status === "published" && !entry.publishedAt) entry.publishedAt = entry.updatedAt;
  if (!entry.titleEn || !entry.bodyEn) {
    return sendJson(res, 422, { error: "English title and body are required." });
  }
  const image = parsed.files.image;
  if (image?.filename) {
    const persisted = await persistUploadedImage(image);
    entry.imageName = persisted.displayName;
    entry.imagePath = `/uploads/${persisted.storedName}`;
  }
  appendAuditEvent(store, actor, "journal.updated", "journalEntry", entry.id);
  if (!wasPublished && entry.status === "published") appendAuditEvent(store, actor, "journal.published", "journalEntry", entry.id);
  if (wasPublished && entry.status !== "published") appendAuditEvent(store, actor, "journal.unpublished", "journalEntry", entry.id);
  await writeStore(store);
  return sendJson(res, 200, { ok: true, entry: serializeJournalEntry(store, entry) });
}

async function handleDeleteJournalEntry(req, res, store, actor, entryId) {
  if (!requireRole(actor, ["admin", "campaign_manager"])) return sendJson(res, 403, { error: "Forbidden" });
  const entry = store.journalEntries.find((item) => item.id === Number(entryId));
  if (!entry || entry.status === "deleted") return sendJson(res, 404, { error: "Journal entry not found." });
  if (!canManageJournalEntry(actor, entry)) return sendJson(res, 403, { error: "Forbidden" });
  entry.status = "deleted";
  entry.updatedAt = new Date().toISOString();
  appendAuditEvent(store, actor, "journal.deleted", "journalEntry", entry.id);
  await writeStore(store);
  return sendJson(res, 200, { ok: true });
}

async function handleTogglePublishJournalEntry(req, res, store, actor, entryId) {
  if (!requireRole(actor, ["admin", "campaign_manager"])) return sendJson(res, 403, { error: "Forbidden" });
  const entry = store.journalEntries.find((item) => item.id === Number(entryId));
  if (!entry || entry.status === "deleted") return sendJson(res, 404, { error: "Journal entry not found." });
  if (!canManageJournalEntry(actor, entry)) return sendJson(res, 403, { error: "Forbidden" });
  entry.updatedAt = new Date().toISOString();
  if (entry.status === "published") {
    entry.status = "draft";
    appendAuditEvent(store, actor, "journal.unpublished", "journalEntry", entry.id);
  } else {
    entry.status = "published";
    if (!entry.publishedAt) entry.publishedAt = entry.updatedAt;
    appendAuditEvent(store, actor, "journal.published", "journalEntry", entry.id);
  }
  await writeStore(store);
  return sendJson(res, 200, { ok: true, entry: serializeJournalEntry(store, entry) });
}

async function handleCreateCampaign(req, res, store, actor) {
  if (!requireRole(actor, ["admin", "campaign_manager"])) return sendJson(res, 403, { error: "Forbidden" });
  const body = jsonOrForm(await readBody(req), req);
  const payload = campaignPayload(body);
  if (!payload.titleEn || !payload.descriptionEn || !payload.offerDescription || !payload.startDate || !payload.endDate || !payload.visitDeadline || !payload.submissionDeadline) {
    return sendJson(res, 422, { error: "Please complete all required campaign fields." });
  }
  if (invalidTags(payload.targetTags).length) {
    return sendJson(res, 422, { error: "Target tags must be comma-separated, lowercase, and use only letters, numbers, or hyphens." });
  }
  if (unknownTags(store, payload.targetTags).length) {
    return sendJson(res, 422, { error: "Choose campaign target tags from the admin tag library." });
  }
  const timelineError = validateCampaignTimeline(payload);
  if (timelineError) return sendJson(res, 422, { error: timelineError });

  const campaign = {
    id: store.nextIds.campaign++,
    createdBy: actor.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: actor.id,
    bannerName: "",
    bannerPath: "",
    ...payload,
  };
  campaign.verificationPassword ||= generateCampaignPassword();
  store.campaigns.unshift(campaign);
  await writeStore(store);
  return sendJson(res, 201, {
    ok: true,
    campaign: serializeCampaign(store, campaign, { includeVerificationPassword: true }),
  });
}

async function handleUpdateCampaign(req, res, store, actor, campaignId) {
  if (!requireRole(actor, ["admin", "campaign_manager"])) return sendJson(res, 403, { error: "Forbidden" });
  const campaign = campaignById(store, campaignId);
  if (!campaign) return sendJson(res, 404, { error: "Campaign not found." });

  const body = jsonOrForm(await readBody(req), req);
  const previousStatus = campaign.status;
  const previousVerificationPassword = campaign.verificationPassword || "";
  const payload = campaignPayload(body, campaign);
  if (!payload.titleEn || !payload.descriptionEn || !payload.offerDescription || !payload.startDate || !payload.endDate || !payload.visitDeadline || !payload.submissionDeadline) {
    return sendJson(res, 422, { error: "Please complete all required campaign fields." });
  }
  if (invalidTags(payload.targetTags).length) {
    return sendJson(res, 422, { error: "Target tags must be comma-separated, lowercase, and use only letters, numbers, or hyphens." });
  }
  if (unknownTags(store, payload.targetTags).length) {
    return sendJson(res, 422, { error: "Choose campaign target tags from the admin tag library." });
  }
  const timelineError = validateCampaignTimeline(payload);
  if (timelineError) return sendJson(res, 422, { error: timelineError });

  Object.assign(campaign, payload, {
    updatedAt: new Date().toISOString(),
    updatedBy: actor.id,
  });
  campaign.verificationPassword ||= previousVerificationPassword || generateCampaignPassword();

  if (campaign.verificationPassword !== previousVerificationPassword) {
    appendAuditEvent(store, actor, "campaign.verification_password_changed", "campaign", campaign.id, {
      regenerated: false,
    });
  }

  if (previousStatus !== "deactivated" && campaign.status === "deactivated") {
    const participants = store.participants.filter(
      (participant) => participant.campaignId === campaign.id && participant.status !== "canceled"
    );
    for (const participant of participants) cancelParticipant(store, participant, "Campaign deactivated", "blocked");
  }

  await writeStore(store);
  return sendJson(res, 200, {
    ok: true,
    campaign: serializeCampaign(store, campaign, { includeVerificationPassword: true }),
  });
}

async function handleRegenerateVerificationPassword(req, res, store, actor, campaignId) {
  if (!requireRole(actor, ["admin", "campaign_manager"])) return sendJson(res, 403, { error: "Forbidden" });
  const campaign = campaignById(store, campaignId);
  if (!campaign) return sendJson(res, 404, { error: "Campaign not found." });
  if (!canManageCampaign(actor, campaign)) return sendJson(res, 403, { error: "Forbidden" });
  campaign.verificationPassword = generateCampaignPassword();
  campaign.updatedAt = new Date().toISOString();
  campaign.updatedBy = actor.id;
  appendAuditEvent(store, actor, "campaign.verification_password_changed", "campaign", campaign.id, {
    regenerated: true,
  });
  await writeStore(store);
  return sendJson(res, 200, {
    ok: true,
    verificationPassword: campaign.verificationPassword,
  });
}

async function handleDuplicateCampaign(req, res, store, actor, campaignId) {
  if (!requireRole(actor, ["admin", "campaign_manager"])) return sendJson(res, 403, { error: "Forbidden" });
  const campaign = campaignById(store, campaignId);
  if (!campaign) return sendJson(res, 404, { error: "Campaign not found." });
  const now = new Date().toISOString();
  const duplicated = {
    ...campaign,
    id: store.nextIds.campaign++,
    titleEn: campaign.titleEn ? `${campaign.titleEn} (copy)` : "Copy",
    titleAr: campaign.titleAr ? `${campaign.titleAr} (نسخة)` : "نسخة",
    status: "draft",
    startDate: "",
    endDate: "",
    visitDeadline: "",
    submissionDeadline: "",
    bannerName: "",
    bannerPath: "",
    verificationPassword: generateCampaignPassword(),
    autoClosedAt: null,
    createdAt: now,
    updatedAt: now,
    createdBy: actor.id,
    updatedBy: actor.id,
  };
  store.campaigns.unshift(duplicated);
  appendAuditEvent(store, actor, "campaign.duplicated", "campaign", duplicated.id, {
    sourceCampaignId: campaign.id,
  });
  await writeStore(store);
  return sendJson(res, 201, {
    ok: true,
    campaign: serializeCampaign(store, duplicated, { includeVerificationPassword: true }),
  });
}

async function handleUploadBanner(req, res, store, actor, campaignId) {
  if (!requireRole(actor, ["admin", "campaign_manager"])) return sendJson(res, 403, { error: "Forbidden" });
  const campaign = campaignById(store, campaignId);
  if (!campaign) return sendJson(res, 404, { error: "Campaign not found." });
  const body = await readBody(req);
  const parsed = parseMultipart(body, req.headers["content-type"] || "");
  const file = parsed.files.banner;
  if (!file) return sendJson(res, 422, { error: "Banner image is required." });

  const persisted = await persistUploadedImage(file);
  campaign.bannerName = persisted.displayName;
  campaign.bannerPath = `/uploads/${persisted.storedName}`;
  campaign.updatedAt = new Date().toISOString();
  campaign.updatedBy = actor.id;
  await writeStore(store);
  return sendJson(res, 200, { ok: true, bannerPath: campaign.bannerPath });
}

async function handleUploadCodes(req, res, store, actor, campaignId) {
  if (!requireRole(actor, ["admin", "campaign_manager"])) return sendJson(res, 403, { error: "Forbidden" });
  const campaign = campaignById(store, campaignId);
  if (!campaign) return sendJson(res, 404, { error: "Campaign not found." });

  const body = await readBody(req);
  const parsed = parseMultipart(body, req.headers["content-type"] || "");
  const file = parsed.files.codesFile;
  if (!file) return sendJson(res, 422, { error: "CSV file is required." });

  const existing = new Set(
    store.campaignCodes.filter((code) => code.campaignId === campaign.id).map((code) => normalizeCode(code.codeValue))
  );
  const codes = extractCodesFromCsv(file.content.toString("utf8")).filter((code) => !existing.has(code.codeValue));
  if (!codes.length) return sendJson(res, 422, { error: "No new valid codes found in the CSV file." });

  const uploadedAt = new Date().toISOString();
  for (const codeEntry of codes) {
    store.campaignCodes.push({
      id: store.nextIds.code++,
      campaignId: campaign.id,
      codeValue: codeEntry.codeValue,
      usageCount: campaign.offerUsageCount || 1,
      offerText: campaign.offerDescription || "",
      status: "available",
      uploadedByUserId: actor.id,
      uploadedAt,
      reservedByParticipantId: null,
      reservedAt: null,
      usedAt: null,
      blockedAt: null,
      deletedAt: null,
      deletedBatchId: null,
    });
  }

  appendAuditEvent(store, actor, "campaign.codes_uploaded", "campaign", campaign.id, {
    added: codes.length,
  });
  await writeStore(store);
  return sendJson(res, 200, { ok: true, uploaded: codes.length });
}

async function handleResetCodes(req, res, store, actor, campaignId) {
  if (!requireRole(actor, ["admin", "campaign_manager"])) return sendJson(res, 403, { error: "Forbidden" });
  const campaign = campaignById(store, campaignId);
  if (!campaign) return sendJson(res, 404, { error: "Campaign not found." });

  const batchId = randomToken();
  const codes = store.campaignCodes.filter((code) => code.campaignId === campaign.id && code.status !== "deleted");
  const linkedParticipants = new Set();

  for (const code of codes) {
    code.status = "deleted";
    code.deletedAt = new Date().toISOString();
    code.deletedBatchId = batchId;
    if (code.reservedByParticipantId) linkedParticipants.add(code.reservedByParticipantId);
  }

  for (const participantId of linkedParticipants) {
    const participant = participantById(store, participantId);
    if (participant) {
      participant.status = "canceled";
      participant.canceledReason = "Code batch deleted";
      participant.assignedCodeId = null;
    }
  }

  appendAuditEvent(store, actor, "campaign.codes_reset", "campaign", campaign.id, {
    deleted: codes.length,
    batchId,
    canceledParticipants: linkedParticipants.size,
  });
  await writeStore(store);
  return sendJson(res, 200, { ok: true, deleted: codes.length });
}

async function handleCampaignCodes(req, res, store, actor, campaignId) {
  const campaign = campaignById(store, campaignId);
  if (!campaign) return sendJson(res, 404, { error: "Campaign not found." });
  if (!canManageCampaign(actor, campaign)) return sendJson(res, 403, { error: "Forbidden" });
  const codes = store.campaignCodes
    .filter((code) => code.campaignId === campaign.id)
    .map((code) => serializeCampaignCode(store, code));
  return sendJson(res, 200, { campaignId: campaign.id, codes });
}

async function handleJoinCampaign(req, res, store, actor, campaignId) {
  if (!requireRole(actor, ["influencer"])) return sendJson(res, 403, { error: "Forbidden" });
  if (actor.status !== "active") return sendJson(res, 403, { error: "Account is not active." });

  const campaign = campaignById(store, campaignId);
  if (!campaign) return sendJson(res, 404, { error: "Campaign not found." });
  const eligibleIds = new Set(eligibleCampaignsFor(store, actor).map((item) => item.id));
  if (!eligibleIds.has(campaign.id)) {
    if (campaign.visitDeadline && toDateString(campaign.visitDeadline) < todayDateString()) {
      return sendJson(res, 409, {
        error: "Visit deadline has already passed for this campaign. New joins are closed.",
      });
    }
    return sendJson(res, 409, { error: "This campaign is not available for this member." });
  }
  const activeParticipants = store.participants.filter(
    (participant) => participant.campaignId === campaign.id && participant.status !== "canceled"
  ).length;
  if (campaign.participantCap > 0 && activeParticipants >= campaign.participantCap) {
    return sendJson(res, 409, { error: "This campaign has reached its participant cap." });
  }

  const availableCode = store.campaignCodes.find((code) => code.campaignId === campaign.id && code.status === "available");
  if (!availableCode) return sendJson(res, 409, { error: "No codes are available for this campaign." });

  const now = new Date().toISOString();
  const participant = {
    id: store.nextIds.participant++,
    campaignId: campaign.id,
    influencerId: actor.id,
    verificationRef: generateVerificationRef(store),
    status: "confirmed",
    assignedCodeId: availableCode.id,
    selectedBranchId: null,
    selectedVisitDate: null,
    joinedAt: now,
    visitedAt: null,
    visitedConfirmedByPin: false,
    visitedConfirmedByCashier: false,
    cashierVerifiedAt: null,
    submittedAt: null,
    completedAt: null,
    socialLink: "",
    feedback: "",
    imageName: "",
    imagePath: "",
    platform: "",
    canceledReason: "",
  };

  availableCode.status = "reserved";
  availableCode.reservedByParticipantId = participant.id;
  availableCode.reservedAt = now;

  store.participants.push(participant);
  appendAuditEvent(store, actor, "campaign.joined", "campaign", campaign.id, {
    participantId: participant.id,
    codeId: availableCode.id,
  });
  await writeStore(store);
  return sendJson(res, 200, { ok: true, participantId: participant.id });
}

async function handleDeclineCampaign(req, res, store, actor, campaignId) {
  if (!requireRole(actor, ["influencer"])) return sendJson(res, 403, { error: "Forbidden" });
  if (actor.status !== "active") return sendJson(res, 403, { error: "Account is not active." });

  const campaign = campaignById(store, campaignId);
  if (!campaign) return sendJson(res, 404, { error: "Campaign not found." });

  const existingDecline = store.campaignDeclines.find(
    (decline) => decline.campaignId === campaign.id && decline.influencerId === actor.id
  );
  if (existingDecline) {
    return sendJson(res, 409, { error: "You already declined this campaign." });
  }

  const activeParticipation = store.participants.find(
    (participant) =>
      participant.campaignId === campaign.id &&
      participant.influencerId === actor.id &&
      participant.status !== "canceled"
  );
  if (activeParticipation) {
    return sendJson(res, 409, { error: "Cancel your participation first, then decline." });
  }

  const eligibleIds = new Set(eligibleCampaignsFor(store, actor).map((item) => item.id));
  if (!eligibleIds.has(campaign.id)) {
    return sendJson(res, 409, { error: "This campaign is not available for this member." });
  }

  const decline = {
    id: store.nextIds.campaignDecline++,
    campaignId: campaign.id,
    influencerId: actor.id,
    declinedAt: new Date().toISOString(),
  };
  store.campaignDeclines.push(decline);
  appendAuditEvent(store, actor, "campaign.declined", "campaign", campaign.id, {
    declineId: decline.id,
  });
  await writeStore(store);
  return sendJson(res, 200, { ok: true, declineId: decline.id });
}

async function handleManualReserveCode(req, res, store, actor, codeId) {
  if (!requireRole(actor, ["admin", "campaign_manager"])) return sendJson(res, 403, { error: "Forbidden" });
  const code = store.campaignCodes.find((item) => item.id === Number(codeId));
  if (!code) return sendJson(res, 404, { error: "Code not found." });
  const campaign = campaignById(store, code.campaignId);
  if (!campaign) return sendJson(res, 404, { error: "Campaign not found." });
  if (!canManageCampaign(actor, campaign)) return sendJson(res, 403, { error: "Forbidden" });
  if (code.status !== "available") return sendJson(res, 409, { error: "Only available codes can be reserved manually." });

  const body = jsonOrForm(await readBody(req), req);
  const offlineName = text(body.offlineName);
  if (!offlineName) return sendJson(res, 422, { error: "Offline member name is required." });

  const now = new Date().toISOString();
  const participant = {
    id: store.nextIds.participant++,
    campaignId: campaign.id,
    influencerId: null,
    verificationRef: generateVerificationRef(store),
    source: "offline",
    offlineName,
    offlineMobile: text(body.offlineMobile),
    offlineNotes: text(body.offlineNotes),
    status: "offline_reserved",
    assignedCodeId: code.id,
    selectedBranchId: null,
    selectedVisitDate: null,
    joinedAt: now,
    visitedAt: null,
    visitedConfirmedByPin: false,
    visitedConfirmedByCashier: false,
    cashierVerifiedAt: null,
    submittedAt: null,
    completedAt: null,
    socialLink: "",
    feedback: "",
    imageName: "",
    imagePath: "",
    platform: text(body.platform),
    canceledReason: "",
  };

  code.status = "reserved";
  code.reservedByParticipantId = participant.id;
  code.reservedAt = now;

  store.participants.push(participant);
  appendAuditEvent(store, actor, "campaign.manual_reserve", "campaign", campaign.id, {
    participantId: participant.id,
    codeId: code.id,
    offlineName,
  });
  await writeStore(store);
  return sendJson(res, 200, { ok: true, participant: serializeParticipant(store, participant) });
}

async function handleVerifyLookup(req, res, store) {
  const ip = clientIp(req);
  const ipLimit = checkRateLimit(`verify-lookup:${ip}`, 10, 60 * 1000);
  if (!ipLimit.ok) return sendJson(res, 429, { error: "Too many attempts. Please wait." });

  const body = jsonOrForm(await readBody(req), req);
  const ref = text(body.ref).toUpperCase();
  if (!ref || !/^[A-Z0-9]{4,5}$/.test(ref)) {
    return sendJson(res, 422, { error: "Reference must be 4-5 letters/numbers." });
  }

  const participant = store.participants.find((item) => text(item.verificationRef).toUpperCase() === ref);
  if (!participant) {
    appendAuditEvent(store, null, "participant.verification_lookup_failed", "participant", null, { ref, ip });
    await writeStore(store);
    return sendJson(res, 404, { error: "No reservation found for that reference." });
  }
  if (participant.status === "canceled") {
    return sendJson(res, 409, { error: "This reservation was canceled." });
  }
  if (!assignedCodeForParticipant(store, participant)) {
    return sendJson(res, 404, { error: "Code not found." });
  }

  return sendJson(res, 200, {
    p: String(participant.id),
    sig: verificationSignatureForParticipantId(participant.id),
  });
}

async function handleVerifyReveal(req, res, store) {
  const body = jsonOrForm(await readBody(req), req);
  const participantId = Number(body.p);
  const sig = text(body.sig);
  const password = text(body.password);
  const ip = clientIp(req);

  const limit = checkRateLimit(`verify-reveal:${ip}:${participantId}`, 5, 15 * 60 * 1000);
  if (!limit.ok) {
    return sendJson(res, 429, { error: "Too many wrong passwords. Try again in a few minutes." });
  }
  if (!participantId || !sig || !password) {
    return sendJson(res, 422, { error: "Missing fields." });
  }

  const participant = participantById(store, participantId);
  if (!participant) return sendJson(res, 404, { error: "Reservation not found." });

  const expectedSig = verificationSignatureForParticipantId(participantId);
  if (sig !== expectedSig) {
    appendAuditEvent(store, null, "participant.verification_signature_invalid", "participant", participantId, { ip });
    await writeStore(store);
    return sendJson(res, 403, { error: "Invalid verification link." });
  }

  const campaign = campaignById(store, participant.campaignId);
  if (!campaign) return sendJson(res, 404, { error: "Campaign not found." });
  if (text(password).toUpperCase() !== text(campaign.verificationPassword).toUpperCase()) {
    appendAuditEvent(store, null, "participant.verification_password_wrong", "participant", participantId, { ip });
    await writeStore(store);
    return sendJson(res, 403, { error: "Wrong password." });
  }
  if (participant.status === "canceled") {
    return sendJson(res, 409, { error: "This reservation was canceled." });
  }

  const code = assignedCodeForParticipant(store, participant);
  if (!code) return sendJson(res, 404, { error: "Code not found." });
  const member = userById(store, participant.influencerId);

  appendAuditEvent(store, null, "participant.verification_revealed", "participant", participantId, { ip });
  await writeStore(store);

  return sendJson(res, 200, {
    code: code.codeValue,
    offer: campaign.offerDescription,
    campaignTitle: campaign.titleEn,
    memberName: member?.fullName || participant.offlineName || "(unknown)",
    status: participant.status,
    alreadyVisited: Boolean(participant.visitedAt),
    visitedAt: participant.visitedAt,
  });
}

async function handleVerifyRedeem(req, res, store) {
  const body = jsonOrForm(await readBody(req), req);
  const participantId = Number(body.p);
  const sig = text(body.sig);
  const password = text(body.password);
  const branchId = body.branchId ? Number(body.branchId) : null;
  const ip = clientIp(req);

  const limit = checkRateLimit(`verify-redeem:${ip}:${participantId}`, 3, 60 * 1000);
  if (!limit.ok) {
    return sendJson(res, 429, { error: "Too many attempts. Please wait." });
  }
  if (!participantId || !sig || !password) {
    return sendJson(res, 422, { error: "Missing fields." });
  }

  const participant = participantById(store, participantId);
  if (!participant) return sendJson(res, 404, { error: "Reservation not found." });
  if (sig !== verificationSignatureForParticipantId(participantId)) {
    return sendJson(res, 403, { error: "Invalid verification link." });
  }

  const campaign = campaignById(store, participant.campaignId);
  if (!campaign) return sendJson(res, 404, { error: "Campaign not found." });
  if (text(password).toUpperCase() !== text(campaign.verificationPassword).toUpperCase()) {
    return sendJson(res, 403, { error: "Wrong password." });
  }
  if (participant.status === "canceled") {
    return sendJson(res, 409, { error: "This reservation was canceled." });
  }

  const now = new Date().toISOString();
  participant.visitedAt ||= now;
  if (branchId) participant.visitedBranchId = branchId;
  participant.visitedConfirmedByCashier = true;
  participant.cashierVerifiedAt = now;

  appendAuditEvent(store, null, "participant.visited_by_cashier", "participant", participantId, {
    branchId,
    ip,
    campaignId: participant.campaignId,
  });
  await writeStore(store);
  return sendJson(res, 200, { ok: true });
}

async function handleRemoveParticipant(req, res, store, actor, participantId) {
  if (!requireRole(actor, ["admin", "campaign_manager"])) return sendJson(res, 403, { error: "Forbidden" });
  const participant = participantById(store, participantId);
  if (!participant) return sendJson(res, 404, { error: "Participation not found." });
  cancelParticipant(store, participant, "Removed by campaign team", "blocked");
  appendAuditEvent(store, actor, "participant.removed", "participant", participant.id);
  await writeStore(store);
  return sendJson(res, 200, { ok: true });
}

async function handleSelfCancelParticipant(req, res, store, actor, participantId) {
  if (!requireRole(actor, ["influencer"])) return sendJson(res, 403, { error: "Forbidden" });
  const participant = store.participants.find(
    (item) => item.id === Number(participantId) && item.influencerId === actor.id
  );
  if (!participant) return sendJson(res, 404, { error: "Participation not found." });
  if (participant.status !== "confirmed") {
    return sendJson(res, 409, { error: "Only reserved campaign visits can be canceled by the member." });
  }
  cancelParticipant(store, participant, "Canceled by influencer", "available");
  participant.assignedCodeId = null;
  appendAuditEvent(store, actor, "participant.self_canceled", "participant", participant.id, {
    campaignId: participant.campaignId,
  });
  await writeStore(store);
  return sendJson(res, 200, { ok: true });
}

async function handleVisitConfirm(req, res, store) {
  const visitRateLimit = checkRateLimit(`visit-confirm:ip:${clientIp(req)}`, 30, 60 * 1000);
  if (!visitRateLimit.ok) {
    return sendJson(res, 429, {
      error: `Too many visit confirmations. Try again in ${visitRateLimit.retryAfterSeconds} second(s).`,
    });
  }

  const body = jsonOrForm(await readBody(req), req);
  const codeValue = normalizeCode(body.code);
  const pin = text(body.pin);
  if (!codeValue || !pin) {
    return sendJson(res, 422, { error: "Code and branch PIN are required." });
  }

  const branch = store.branches.find((item) => item.status === "active" && item.pin === pin);
  if (!branch) {
    return sendJson(res, 401, { error: "Branch PIN is invalid." });
  }

  const code = store.campaignCodes.find((item) => normalizeCode(item.codeValue) === codeValue);
  if (!code) {
    return sendJson(res, 404, { error: "Code not found." });
  }
  if (code.status === "used") {
    return sendJson(res, 409, { error: "This code has already been used." });
  }
  if (code.status !== "reserved" || !code.reservedByParticipantId) {
    return sendJson(res, 409, { error: "This code is not currently reserved for a visit confirmation." });
  }

  const participant = participantById(store, code.reservedByParticipantId);
  if (!participant) {
    return sendJson(res, 409, { error: "The reservation linked to this code could not be found." });
  }
  if (!["confirmed", "offline_reserved"].includes(participant.status)) {
    return sendJson(res, 409, { error: "This participant is not in a confirmable state." });
  }

  const campaign = campaignById(store, code.campaignId);
  if (!campaign) {
    return sendJson(res, 404, { error: "Campaign not found." });
  }
  if (!canVisitCampaignBranch(campaign, branch.id)) {
    return sendJson(res, 409, { error: "This branch is not part of the campaign scope." });
  }

  if (branch.maxVisitsPerDay > 0) {
    const visitsToday = store.participants.filter(
      (item) => item.visitedBranchId === branch.id && item.visitedAt && sameDay(item.visitedAt, new Date().toISOString())
    ).length;
    if (visitsToday >= branch.maxVisitsPerDay) {
      return sendJson(res, 409, { error: "This branch has reached its daily visit confirmation limit." });
    }
  }

  const now = new Date().toISOString();
  code.status = "used";
  code.usedAt = now;
  participant.status = "visited";
  participant.visitedAt = now;
  participant.visitedBranchId = branch.id;
  participant.visitedConfirmedByPin = true;
  appendAuditEvent(store, null, "participant.visit_confirmed", "participant", participant.id, {
    campaignId: participant.campaignId,
    branchId: branch.id,
    codeId: code.id,
  });
  await writeStore(store);

  const influencer = participant.influencerId ? userById(store, participant.influencerId) : null;
  return sendJson(res, 200, {
    ok: true,
    receipt: {
      campaignId: campaign.id,
      campaignTitleEn: campaign.titleEn,
      campaignTitleAr: campaign.titleAr,
      offerDescription: campaign.offerDescription || code.offerText || "",
      branchNameEn: branch.nameEn,
      branchNameAr: branch.nameAr,
      influencerName: influencer?.fullName || participant.offlineName || "",
      codeValue: code.codeValue,
      confirmedAt: now,
    },
  });
}

async function handleSubmission(req, res, store, actor, participantId) {
  if (!requireRole(actor, ["influencer"])) return sendJson(res, 403, { error: "Forbidden" });
  const participant = store.participants.find(
    (item) => item.id === Number(participantId) && item.influencerId === actor.id
  );
  if (!participant) return sendJson(res, 404, { error: "Participation not found." });
  const submitState = participantCanSubmitOnServer(participant);
  if (!submitState.ok) {
    return sendJson(res, 409, { error: submitState.reason });
  }

  const body = await readBody(req);
  const parsed = parseMultipart(body, req.headers["content-type"] || "");
  const socialLink = text(parsed.fields.socialLink);
  if (!socialLink) return sendJson(res, 422, { error: "Social media link is required." });

  participant.socialLink = socialLink;
  participant.feedback = text(parsed.fields.feedback);
  participant.platform = text(parsed.fields.platform);
  participant.status = "submitted";
  participant.submittedAt = submitState.editingExisting
    ? participant.submittedAt || new Date().toISOString()
    : new Date().toISOString();
  participant.images ||= [];

  const imageFields = ["image1", "image2", "image3", "image"];
  for (const fieldName of imageFields) {
    const image = parsed.files[fieldName];
    if (!image?.filename) continue;
    try {
      const persisted = await persistUploadedImage(image);
      participant.images.push({
        name: persisted.displayName,
        path: `/uploads/${persisted.storedName}`,
      });
    } catch (error) {
      if (error.statusCode === 422) {
        return sendJson(res, 422, { error: error.message });
      }
      throw error;
    }
  }
  participant.images = participant.images.slice(0, 3);
  syncParticipantPrimaryImage(participant);

  appendAuditEvent(store, actor, "participant.submission", "participant", participant.id, {
    campaignId: participant.campaignId,
  });
  await writeStore(store);
  return sendJson(res, 200, { ok: true });
}

async function handleResetUatData(req, res, store, actor) {
  if (!requireRole(actor, ["admin"])) return sendJson(res, 403, { error: "Forbidden" });
  const body = jsonOrForm(await readBody(req), req);
  if (text(body.confirm) !== UAT_RESET_CONFIRM) {
    return sendJson(res, 400, { error: "Exact confirmation text is required before resetting UAT data." });
  }
  const { store: nextStore, summary } = buildUatStore(store);
  appendAuditEvent(nextStore, actor, "admin.uat_data_seeded", "user", actor.id, {
    members: summary.members,
    campaigns: summary.campaigns,
    participations: summary.participations,
  });
  await writeStore(nextStore);
  return sendJson(res, 200, { ok: true, ...summary });
}

async function requestHandler(req, res) {
  applySecurityHeaders(res);
  await ensureRuntimeFiles();
  await seedRuntimeFilesIfMissing();
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  if (pathname.startsWith("/api/") && !CSRF_EXEMPT_PATHS.has(pathname) && !checkSameOrigin(req)) {
    return sendJson(res, 403, { error: "Cross-site request blocked." });
  }
  const store = await readStore();

  if (req.method === "GET" && (pathname === "/health" || pathname === "/api/health")) {
    return sendJson(res, 200, {
      ok: true,
      uptimeSeconds: Math.round(process.uptime()),
      appBaseUrl: APP_BASE_URL,
      storageMode: "file",
    });
  }

  if (req.method === "GET" && pathname === "/branch/verify") {
    return serveFile(res, path.join(ROOT, "verify.html"));
  }
  if (req.method === "GET" && pathname === "/terms") {
    return serveFile(res, path.join(ROOT, "terms.html"));
  }

  if (req.method === "GET" && pathname === "/api/session") return handleSession(req, res, store);
  if (req.method === "GET" && pathname === "/api/public-metadata") return sendJson(res, 200, publicMetadata(store));
  if (req.method === "GET" && pathname === "/api/terms") return handleGetTerms(req, res, store);
  if (req.method === "POST" && pathname === "/api/branch/verify/lookup") return handleVerifyLookup(req, res, store);
  if (req.method === "POST" && pathname === "/api/branch/verify/reveal") return handleVerifyReveal(req, res, store);
  if (req.method === "POST" && pathname === "/api/branch/verify/redeem") return handleVerifyRedeem(req, res, store);
  if (req.method === "POST" && pathname === "/api/login") return handleLogin(req, res, store);
  if (req.method === "POST" && pathname === "/api/logout") return handleLogout(req, res);
  if (req.method === "POST" && pathname === "/api/signup") return handleSignup(req, res, store);
  if (req.method === "POST" && pathname === "/api/password/forgot") return handleForgotPassword(req, res, store);
  if (req.method === "POST" && pathname === "/api/password/reset") return handleResetPassword(req, res, store);
  if (CASHIER_VISIT_FLOW_ENABLED) {
    if (req.method === "POST" && pathname === "/api/visits/confirm") return handleVisitConfirm(req, res, store);
  }

  const actor = getSessionUser(req, store);
  const adminUserProfileMatch = routeMatch(pathname, /^\/api\/admin\/users\/(\d+)\/profile$/);
  const adminUserAddressMatch = routeMatch(pathname, /^\/api\/admin\/users\/(\d+)\/address$/);
  if (req.method === "GET" && pathname === "/api/bootstrap") {
    if (!actor) return sendJson(res, 401, { error: "Unauthorized" });
    return handleBootstrap(req, res, store, actor);
  }
  if (req.method === "GET" && pathname === "/api/me/address") {
    return handleGetMyAddress(req, res, store, actor);
  }
  if (req.method === "PUT" && pathname === "/api/me/address") {
    return handleUpdateMyAddress(req, res, store, actor);
  }
  if (req.method === "DELETE" && pathname === "/api/me/address") {
    return handleClearMyAddress(req, res, store, actor);
  }
  if (req.method === "PUT" && pathname === "/api/admin/terms") {
    return handleUpdateTerms(req, res, store, actor);
  }
  if (req.method === "PUT" && adminUserProfileMatch) {
    return handleAdminUpdateUserProfile(req, res, store, actor, adminUserProfileMatch[0]);
  }
  if (adminUserAddressMatch) {
    if (req.method === "GET") return handleAdminGetUserAddress(req, res, store, actor, adminUserAddressMatch[0]);
    if (req.method === "PUT") return handleAdminUpdateUserAddress(req, res, store, actor, adminUserAddressMatch[0]);
    if (req.method === "DELETE") return handleAdminClearUserAddress(req, res, store, actor, adminUserAddressMatch[0]);
  }
  if (req.method === "GET" && pathname === "/api/reports/export.csv") {
    if (!actor) return sendJson(res, 401, { error: "Unauthorized" });
    return handleExportReportCsv(req, res, store, actor, url.searchParams);
  }
  if (req.method === "POST" && pathname === "/api/profile/update") {
    if (!actor) return sendJson(res, 401, { error: "Unauthorized" });
    return handleProfileUpdate(req, res, store, actor);
  }
  if (req.method === "POST" && pathname === "/api/managers") {
    if (!actor) return sendJson(res, 401, { error: "Unauthorized" });
    return handleCreateManager(req, res, store, actor);
  }
  const managerUpdateMatch = routeMatch(pathname, /^\/api\/managers\/(\d+)\/update$/);
  if (req.method === "POST" && managerUpdateMatch) {
    if (!actor) return sendJson(res, 401, { error: "Unauthorized" });
    return handleUpdateManager(req, res, store, actor, managerUpdateMatch[0]);
  }
  if (req.method === "POST" && pathname === "/api/cities") {
    if (!actor) return sendJson(res, 401, { error: "Unauthorized" });
    return handleCreateCity(req, res, store, actor);
  }
  const cityMatch = routeMatch(pathname, /^\/api\/cities\/(\d+)\/update$/);
  if (req.method === "POST" && cityMatch) {
    if (!actor) return sendJson(res, 401, { error: "Unauthorized" });
    return handleUpdateCity(req, res, store, actor, cityMatch[0]);
  }
  const cityDeleteMatch = routeMatch(pathname, /^\/api\/cities\/(\d+)\/delete$/);
  if (req.method === "POST" && cityDeleteMatch) {
    if (!actor) return sendJson(res, 401, { error: "Unauthorized" });
    return handleDeleteCity(req, res, store, actor, cityDeleteMatch[0]);
  }
  if (req.method === "POST" && pathname === "/api/categories") {
    if (!actor) return sendJson(res, 401, { error: "Unauthorized" });
    return handleCreateCategory(req, res, store, actor);
  }
  const categoryMatch = routeMatch(pathname, /^\/api\/categories\/(\d+)\/update$/);
  if (req.method === "POST" && categoryMatch) {
    if (!actor) return sendJson(res, 401, { error: "Unauthorized" });
    return handleUpdateCategory(req, res, store, actor, categoryMatch[0]);
  }
  const categoryDeleteMatch = routeMatch(pathname, /^\/api\/categories\/(\d+)\/delete$/);
  if (req.method === "POST" && categoryDeleteMatch) {
    if (!actor) return sendJson(res, 401, { error: "Unauthorized" });
    return handleDeleteCategory(req, res, store, actor, categoryDeleteMatch[0]);
  }
  if (req.method === "POST" && pathname === "/api/platforms") {
    if (!actor) return sendJson(res, 401, { error: "Unauthorized" });
    return handleCreatePlatform(req, res, store, actor);
  }
  const platformMatch = routeMatch(pathname, /^\/api\/platforms\/(\d+)\/update$/);
  if (req.method === "POST" && platformMatch) {
    if (!actor) return sendJson(res, 401, { error: "Unauthorized" });
    return handleUpdatePlatform(req, res, store, actor, platformMatch[0]);
  }
  const platformDeleteMatch = routeMatch(pathname, /^\/api\/platforms\/(\d+)\/delete$/);
  if (req.method === "POST" && platformDeleteMatch) {
    if (!actor) return sendJson(res, 401, { error: "Unauthorized" });
    return handleDeletePlatform(req, res, store, actor, platformDeleteMatch[0]);
  }
  if (req.method === "POST" && pathname === "/api/tags") {
    if (!actor) return sendJson(res, 401, { error: "Unauthorized" });
    return handleCreateTag(req, res, store, actor);
  }
  const tagMatch = routeMatch(pathname, /^\/api\/tags\/(\d+)\/update$/);
  if (req.method === "POST" && tagMatch) {
    if (!actor) return sendJson(res, 401, { error: "Unauthorized" });
    return handleUpdateTag(req, res, store, actor, tagMatch[0]);
  }
  const tagDeleteMatch = routeMatch(pathname, /^\/api\/tags\/(\d+)\/delete$/);
  if (req.method === "POST" && tagDeleteMatch) {
    if (!actor) return sendJson(res, 401, { error: "Unauthorized" });
    return handleDeleteTag(req, res, store, actor, tagDeleteMatch[0]);
  }
  if (req.method === "POST" && pathname === "/api/branches") {
    if (!actor) return sendJson(res, 401, { error: "Unauthorized" });
    return handleCreateBranch(req, res, store, actor);
  }
  const branchMatch = routeMatch(pathname, /^\/api\/branches\/(\d+)\/update$/);
  if (req.method === "POST" && branchMatch) {
    if (!actor) return sendJson(res, 401, { error: "Unauthorized" });
    return handleUpdateBranch(req, res, store, actor, branchMatch[0]);
  }
  if (CASHIER_VISIT_FLOW_ENABLED) {
    const branchRotatePinMatch = routeMatch(pathname, /^\/api\/branches\/(\d+)\/rotate-pin$/);
    if (req.method === "POST" && branchRotatePinMatch) {
      if (!actor) return sendJson(res, 401, { error: "Unauthorized" });
      return handleRotateBranchPin(req, res, store, actor, branchRotatePinMatch[0]);
    }
  }
  const userStatusMatch = routeMatch(pathname, /^\/api\/users\/(\d+)\/status$/);
  if (req.method === "POST" && userStatusMatch) {
    if (!actor) return sendJson(res, 401, { error: "Unauthorized" });
    return handleUserStatus(req, res, store, actor, userStatusMatch[0]);
  }
  const adminUserUpdateMatch = routeMatch(pathname, /^\/api\/users\/(\d+)\/admin-update$/);
  if (req.method === "POST" && adminUserUpdateMatch) {
    if (!actor) return sendJson(res, 401, { error: "Unauthorized" });
    return handleAdminUpdateInfluencer(req, res, store, actor, adminUserUpdateMatch[0]);
  }
  const userSetPasswordMatch = routeMatch(pathname, /^\/api\/users\/(\d+)\/set-password$/);
  if (req.method === "POST" && userSetPasswordMatch) {
    if (!actor) return sendJson(res, 401, { error: "Unauthorized" });
    return handleSetUserPassword(req, res, store, actor, userSetPasswordMatch[0]);
  }
  const userResetLinkMatch = routeMatch(pathname, /^\/api\/users\/(\d+)\/reset-link$/);
  if (req.method === "POST" && userResetLinkMatch) {
    if (!actor) return sendJson(res, 401, { error: "Unauthorized" });
    return handleGenerateResetLink(req, res, store, actor, userResetLinkMatch[0]);
  }
  if (req.method === "GET" && pathname === "/api/journal") {
    return handleJournalIndex(req, res, store, actor);
  }
  if (req.method === "POST" && pathname === "/api/journal") {
    if (!actor) return sendJson(res, 401, { error: "Unauthorized" });
    return handleCreateJournalEntry(req, res, store, actor);
  }
  const journalUpdateMatch = routeMatch(pathname, /^\/api\/journal\/(\d+)\/update$/);
  if (req.method === "POST" && journalUpdateMatch) {
    if (!actor) return sendJson(res, 401, { error: "Unauthorized" });
    return handleUpdateJournalEntry(req, res, store, actor, journalUpdateMatch[0]);
  }
  const journalDeleteMatch = routeMatch(pathname, /^\/api\/journal\/(\d+)\/delete$/);
  if (req.method === "POST" && journalDeleteMatch) {
    if (!actor) return sendJson(res, 401, { error: "Unauthorized" });
    return handleDeleteJournalEntry(req, res, store, actor, journalDeleteMatch[0]);
  }
  const journalPublishMatch = routeMatch(pathname, /^\/api\/journal\/(\d+)\/publish$/);
  if (req.method === "POST" && journalPublishMatch) {
    if (!actor) return sendJson(res, 401, { error: "Unauthorized" });
    return handleTogglePublishJournalEntry(req, res, store, actor, journalPublishMatch[0]);
  }
  if (req.method === "POST" && pathname === "/api/admin/reset-uat-data") {
    if (!actor) return sendJson(res, 401, { error: "Unauthorized" });
    return handleResetUatData(req, res, store, actor);
  }
  if (req.method === "POST" && pathname === "/api/campaigns") {
    if (!actor) return sendJson(res, 401, { error: "Unauthorized" });
    return handleCreateCampaign(req, res, store, actor);
  }
  const campaignUpdateMatch = routeMatch(pathname, /^\/api\/campaigns\/(\d+)\/update$/);
  if (req.method === "POST" && campaignUpdateMatch) {
    if (!actor) return sendJson(res, 401, { error: "Unauthorized" });
    return handleUpdateCampaign(req, res, store, actor, campaignUpdateMatch[0]);
  }
  const campaignVerificationPasswordMatch = routeMatch(pathname, /^\/api\/campaigns\/(\d+)\/regenerate-verification-password$/);
  if (req.method === "POST" && campaignVerificationPasswordMatch) {
    if (!actor) return sendJson(res, 401, { error: "Unauthorized" });
    return handleRegenerateVerificationPassword(req, res, store, actor, campaignVerificationPasswordMatch[0]);
  }
  const campaignDuplicateMatch = routeMatch(pathname, /^\/api\/campaigns\/(\d+)\/duplicate$/);
  if (req.method === "POST" && campaignDuplicateMatch) {
    if (!actor) return sendJson(res, 401, { error: "Unauthorized" });
    return handleDuplicateCampaign(req, res, store, actor, campaignDuplicateMatch[0]);
  }
  const campaignBannerMatch = routeMatch(pathname, /^\/api\/campaigns\/(\d+)\/banner$/);
  if (req.method === "POST" && campaignBannerMatch) {
    if (!actor) return sendJson(res, 401, { error: "Unauthorized" });
    return handleUploadBanner(req, res, store, actor, campaignBannerMatch[0]);
  }
  const campaignCodesUploadMatch = routeMatch(pathname, /^\/api\/campaigns\/(\d+)\/codes\/upload$/);
  if (req.method === "POST" && campaignCodesUploadMatch) {
    if (!actor) return sendJson(res, 401, { error: "Unauthorized" });
    return handleUploadCodes(req, res, store, actor, campaignCodesUploadMatch[0]);
  }
  const campaignCodesResetMatch = routeMatch(pathname, /^\/api\/campaigns\/(\d+)\/codes\/reset$/);
  if (req.method === "POST" && campaignCodesResetMatch) {
    if (!actor) return sendJson(res, 401, { error: "Unauthorized" });
    return handleResetCodes(req, res, store, actor, campaignCodesResetMatch[0]);
  }
  const campaignCodesMatch = routeMatch(pathname, /^\/api\/campaigns\/(\d+)\/codes$/);
  if (req.method === "GET" && campaignCodesMatch) {
    if (!actor) return sendJson(res, 401, { error: "Unauthorized" });
    return handleCampaignCodes(req, res, store, actor, campaignCodesMatch[0]);
  }
  const manualReserveCodeMatch = routeMatch(pathname, /^\/api\/codes\/(\d+)\/manual-reserve$/);
  if (req.method === "POST" && manualReserveCodeMatch) {
    if (!actor) return sendJson(res, 401, { error: "Unauthorized" });
    return handleManualReserveCode(req, res, store, actor, manualReserveCodeMatch[0]);
  }
  const joinMatch = routeMatch(pathname, /^\/api\/campaigns\/(\d+)\/join$/);
  if (req.method === "POST" && joinMatch) {
    if (!actor) return sendJson(res, 401, { error: "Unauthorized" });
    return handleJoinCampaign(req, res, store, actor, joinMatch[0]);
  }
  const declineMatch = routeMatch(pathname, /^\/api\/campaigns\/(\d+)\/decline$/);
  if (req.method === "POST" && declineMatch) {
    if (!actor) return sendJson(res, 401, { error: "Unauthorized" });
    return handleDeclineCampaign(req, res, store, actor, declineMatch[0]);
  }
  const participantRemoveMatch = routeMatch(pathname, /^\/api\/participants\/(\d+)\/remove$/);
  if (req.method === "POST" && participantRemoveMatch) {
    if (!actor) return sendJson(res, 401, { error: "Unauthorized" });
    return handleRemoveParticipant(req, res, store, actor, participantRemoveMatch[0]);
  }
  const participantCancelMatch = routeMatch(pathname, /^\/api\/participants\/(\d+)\/cancel$/);
  if (req.method === "POST" && participantCancelMatch) {
    if (!actor) return sendJson(res, 401, { error: "Unauthorized" });
    return handleSelfCancelParticipant(req, res, store, actor, participantCancelMatch[0]);
  }
  const submissionMatch = routeMatch(pathname, /^\/api\/participants\/(\d+)\/submission$/);
  if (req.method === "POST" && submissionMatch) {
    if (!actor) return sendJson(res, 401, { error: "Unauthorized" });
    return handleSubmission(req, res, store, actor, submissionMatch[0]);
  }

  if (req.method === "GET" && (pathname === "/" || pathname === "/index.html")) {
    return serveFile(res, path.join(ROOT, "index.html"));
  }
  if (CASHIER_VISIT_FLOW_ENABLED) {
    if (req.method === "GET" && pathname === "/branch") return serveFile(res, path.join(ROOT, "branch.html"));
  }
  if (req.method === "GET" && pathname === "/styles.css") return serveFile(res, path.join(ROOT, "styles.css"));
  if (req.method === "GET" && pathname === "/client.js") return serveFile(res, path.join(ROOT, "client.js"));
  if (req.method === "GET" && pathname === "/icons.svg") return serveFile(res, path.join(ROOT, "icons.svg"));
  if (req.method === "GET" && pathname.startsWith("/uploads/")) {
    const uploadPath = resolveUploadRequestPath(pathname);
    if (!uploadPath) return sendText(res, 404, "Not found");
    return serveFile(res, uploadPath);
  }

  return sendText(res, 404, "Not found");
}

function isSerializedApiRequest(req) {
  try {
    const parsed = new URL(req.url, `http://${req.headers.host}`);
    return parsed.pathname.startsWith("/api/");
  } catch (error) {
    return false;
  }
}

const server = http.createServer((req, res) => {
  const run = isSerializedApiRequest(req)
    ? runSerializedStoreTask(() => requestHandler(req, res))
    : requestHandler(req, res);
  run.catch((error) => {
    console.error(error);
    if (error?.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
      sendJson(res, error.statusCode, { error: error.message });
      return;
    }
    sendJson(res, 500, { error: "Internal server error" });
  });
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`PICK Social Club running on ${APP_BASE_URL}`);
  });
}

module.exports = {
  APP_BASE_URL,
  DATA_DIR,
  ROOT,
  STORE_PATH,
  buildEmptyProductionStore,
  buildInitialStore,
  ensureRuntimeFiles,
  hashPassword,
  passwordStrengthError,
  readStore,
  seedRuntimeFilesIfMissing,
  writeStore,
};
