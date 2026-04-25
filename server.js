const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFile } = require("node:child_process");

const ROOT = __dirname;
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, "data"));
const STORE_PATH = path.resolve(process.env.STORE_PATH || path.join(DATA_DIR, "store.json"));
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(ROOT, "uploads"));
const BUNDLED_DATA_DIR = path.join(ROOT, "data");
const BUNDLED_STORE_PATH = path.join(BUNDLED_DATA_DIR, "store.json");
const BUNDLED_UPLOAD_DIR = path.join(ROOT, "uploads");
const PORT = Number(process.env.PORT || 4173);
const APP_BASE_URL = normalizeBaseUrl(process.env.APP_BASE_URL || `http://localhost:${PORT}`);
const SESSION_COOKIE = "pick_sid";
const IS_SECURE_APP = APP_BASE_URL.startsWith("https://");

const sessions = new Map();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
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

function safeFileNameSegment(value) {
  return text(path.parse(value).name)
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "upload";
}

async function persistUploadedImage(file) {
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
      throw new Error("HEIC banners could not be converted. Please upload JPG, PNG, or WebP.");
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

  const bundledEntries = await fs.readdir(BUNDLED_UPLOAD_DIR, { withFileTypes: true });
  for (const entry of bundledEntries) {
    if (!entry.isFile()) continue;
    const sourcePath = path.join(BUNDLED_UPLOAD_DIR, entry.name);
    const targetPath = path.join(UPLOAD_DIR, entry.name);
    if (await pathExists(targetPath)) continue;
    await fs.copyFile(sourcePath, targetPath);
  }
}

function sanitizeUser(user) {
  const { password, ...safeUser } = user;
  return safeUser;
}

function nextId(items) {
  return items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
}

function normalizeCode(value) {
  return String(value || "").trim().toUpperCase();
}

function text(value) {
  return String(value ?? "").trim();
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

function randomToken() {
  return crypto.randomBytes(24).toString("hex");
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

function getSessionUser(req, store) {
  const sessionId = parseCookies(req)[SESSION_COOKIE];
  const session = sessions.get(sessionId);
  if (!session) return null;
  return store.users.find((user) => user.id === session.userId) || null;
}

function sendJson(res, statusCode, payload, headers = {}) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    ...headers,
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, body, headers = {}) {
  res.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    ...headers,
  });
  res.end(body);
}

async function serveFile(res, filePath) {
  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
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
      fields[name] = bodyBlock.toString();
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
  store.passwordResets ||= [];
  store.cities ||= [];
  store.categories ||= [];
  store.platforms ||= [];
  store.tags ||= [];

  for (const user of store.users) {
    if (user.city) ensureChoiceByName(store.cities, user.city);
    if (user.category) ensureChoiceByName(store.categories, user.category);
  }
  for (const branch of store.branches) {
    if (branch.city) branch.cityId ||= ensureChoiceByName(store.cities, branch.city);
  }

  store.nextIds ||= {};
  store.nextIds.user ||= nextId(store.users);
  store.nextIds.campaign ||= nextId(store.campaigns);
  store.nextIds.code ||= nextId(store.campaignCodes);
  store.nextIds.participant ||= nextId(store.participants);
  store.nextIds.branch ||= nextId(store.branches);
  store.nextIds.city ||= nextId(store.cities);
  store.nextIds.category ||= nextId(store.categories);
  store.nextIds.platform ||= nextId(store.platforms);
  store.nextIds.tag ||= nextId(store.tags);
  store.nextIds.passwordReset ||= nextId(store.passwordResets);

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
    branch.status ||= "active";
  }

  for (const user of store.users) {
    user.mobile = normalizeKuwaitMobile(user.mobile) || "";
    user.gender = normalizeGender(user.gender) || "";
    user.dateOfBirth ||= "";
    user.cityId ||= ensureChoiceByName(store.cities, user.city || "");
    user.categoryId ||= ensureChoiceByName(store.categories, user.category || "");
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
    campaign.targetCityIds ||= [];
    campaign.targetCategoryIds ||= [];
    const normalizedTargetTags = parseTags(campaign.targetTags);
    if (JSON.stringify(normalizedTargetTags) !== JSON.stringify(campaign.targetTags || [])) changed.value = true;
    campaign.targetTags = normalizedTargetTags;
    campaign.offerDescription = text(campaign.offerDescription ?? campaign.offerText);
    campaign.offerUsageCount = Math.max(1, Number(campaign.offerUsageCount ?? campaign.usageCount) || 1);
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
    campaign.status ||= "draft";
    if (["active", "published"].includes(campaign.status)) {
      campaign.status = "live";
      changed.value = true;
    }
    if (["closed", "archived"].includes(campaign.status)) {
      campaign.status = "completed";
      changed.value = true;
    }
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
    if (participant.status === "visited") {
      participant.status = "confirmed";
      changed.value = true;
    }
    participant.joinedAt ||= new Date().toISOString();
    participant.visitedAt ||= null;
    participant.submittedAt ||= null;
    participant.completedAt ||= null;
    participant.selectedBranchId ||= null;
    participant.selectedVisitDate ||= null;
    participant.socialLink ||= "";
    participant.feedback ||= "";
    participant.imageName ||= "";
    participant.imagePath ||= "";
    participant.platform ||= "";
    participant.canceledReason ||= "";
    participant.source ||= participant.influencerId ? "platform" : "offline";
    participant.offlineName ||= "";
    participant.offlineMobile ||= "";
    participant.offlineNotes ||= "";
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

async function readStore() {
  const raw = JSON.parse(await fs.readFile(STORE_PATH, "utf8"));
  const normalized = normalizeStore(raw);
  if (normalized.changed) {
    await fs.writeFile(STORE_PATH, JSON.stringify(normalized.store, null, 2));
  }
  return normalized.store;
}

async function writeStore(store) {
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2));
}

function serializeBranch(store, branch) {
  const city = cityById(store, branch.cityId);
  return {
    ...branch,
    cityNameEn: city?.nameEn || "",
    cityNameAr: city?.nameAr || "",
  };
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

function serializeParticipant(store, participant) {
  const campaign = campaignById(store, participant.campaignId);
  const influencer = userById(store, participant.influencerId);
  const assignedCode = assignedCodeForParticipant(store, participant);
  return {
    ...participant,
    campaignTitleEn: campaign?.titleEn || "",
    campaignTitleAr: campaign?.titleAr || "",
    influencerName: influencer?.fullName || participant.offlineName || "",
    influencerEmail: influencer?.email || "",
    influencerCityId: influencer?.cityId || null,
    influencerCategoryId: influencer?.categoryId || null,
    assignedCodeValue: assignedCode?.codeValue || "",
    assignedCodeUsageCount: campaign?.offerUsageCount || assignedCode?.usageCount || 1,
    assignedCodeOfferText: campaign?.offerDescription || assignedCode?.offerText || "",
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

function serializeCampaign(store, campaign) {
  const createdBy = userById(store, campaign.createdBy);
  const updatedBy = userById(store, campaign.updatedBy);
  return {
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
}

function influencerSummary(store, influencer) {
  const participations = store.participants.filter((participant) => participant.influencerId === influencer.id);
  const joined = participations.filter((participant) => participant.status !== "canceled").length;
  const visited = participations.filter((participant) =>
    ["confirmed", "visited", "submitted", "completed"].includes(participant.status)
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
    cityId: influencer.cityId,
    categoryId: influencer.categoryId,
    cityNameEn: cityById(store, influencer.cityId)?.nameEn || "",
    categoryNameEn: categoryById(store, influencer.categoryId)?.nameEn || "",
    tags: influencer.tags || [],
    joined,
    visited,
    submitted,
    pendingProof: activePendingProof,
    completionRate: joined ? Math.round((submitted / joined) * 100) : 0,
    lastActivityDate,
  };
}

function reportBundleForCampaigns(store, campaigns) {
  const campaignRows = campaigns.map((campaign) => {
    const participants = store.participants.filter((participant) => participant.campaignId === campaign.id);
    const codeStats = codeStatsForCampaign(store, campaign.id);
    const joined = participants.filter((participant) => participant.status !== "canceled").length;
    const visited = participants.filter((participant) =>
      ["confirmed", "visited", "submitted", "completed"].includes(participant.status)
    ).length;
    const submitted = participants.filter((participant) =>
      ["submitted", "completed"].includes(participant.status)
    ).length;
    const canceled = participants.filter((participant) => participant.status === "canceled").length;

    return {
      campaignId: campaign.id,
      titleEn: campaign.titleEn,
      titleAr: campaign.titleAr,
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
  if (campaign.targetCityIds.length && !campaign.targetCityIds.includes(influencer.cityId)) return false;
  if (campaign.targetCategoryIds.length && !campaign.targetCategoryIds.includes(influencer.categoryId)) return false;
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

  return store.campaigns.filter((campaign) => {
    if (!campaignMatchesInfluencer(store, campaign, user)) return false;
    if (joinedActiveIds.has(campaign.id)) return false;
    if (codeStatsForCampaign(store, campaign.id).available <= 0) return false;
    return true;
  });
}

function generateNotifications(store, user) {
  const notifications = [];
  const now = new Date();

  if (["admin", "campaign_manager"].includes(user.role)) {
    const pendingApprovals = store.users.filter((item) => item.role === "influencer" && item.status === "pending").length;
    if (pendingApprovals) {
      notifications.push({
        id: `pending-${pendingApprovals}`,
        tone: "warning",
        title: "Pending influencer approvals",
        body: `${pendingApprovals} influencer sign-up request${pendingApprovals === 1 ? "" : "s"} need review.`,
      });
    }

    const pendingProof = store.participants.filter(
      (participant) => participant.source !== "offline" && ["confirmed", "visited"].includes(participant.status)
    ).length;
    if (pendingProof) {
      notifications.push({
        id: `proof-${pendingProof}`,
        tone: "info",
        title: "Pending proof submissions",
        body: `${pendingProof} platform influencer${pendingProof === 1 ? "" : "s"} still need${pendingProof === 1 ? "s" : ""} proof submission across live campaigns.`,
      });
    }
  }

  if (user.role === "influencer") {
    const pendingProof = store.participants.filter(
      (participant) => participant.influencerId === user.id && ["confirmed", "visited"].includes(participant.status)
    );
    if (pendingProof.length) {
      notifications.push({
        id: `my-proof-${pendingProof.length}`,
        tone: "warning",
        title: "Visit proof pending",
        body: `${pendingProof.length} campaign${pendingProof.length === 1 ? "" : "s"} still need proof submission.`,
      });
    }

    const canceled = store.participants.filter(
      (participant) => participant.influencerId === user.id && participant.status === "canceled"
    );
    if (canceled.length) {
      notifications.push({
        id: `my-canceled-${canceled.length}`,
        tone: "error",
        title: "Canceled campaign assignments",
        body: `${canceled.length} joined campaign${canceled.length === 1 ? " was" : "s were"} canceled.`,
      });
    }
  }

  const upcomingDeadlines = activeManagerScopeCampaigns(store, user).filter((campaign) => {
    if (!campaign.visitDeadline) return false;
    const days = (new Date(campaign.visitDeadline).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return days >= 0 && days <= 3 && ["live"].includes(campaign.status);
  });

  if (upcomingDeadlines.length) {
    notifications.push({
      id: `deadline-${upcomingDeadlines.length}`,
      tone: "info",
      title: "Upcoming visit deadlines",
      body: `${upcomingDeadlines.length} campaign${upcomingDeadlines.length === 1 ? "" : "s"} have visit deadlines within 3 days.`,
    });
  }

  return notifications;
}

function buildBootstrap(store, user) {
  const campaigns = store.campaigns.map((campaign) => serializeCampaign(store, campaign));
  const reports = reportBundleForCampaigns(store, store.campaigns);
  const common = {
    currentUser: sanitizeUser(user),
    cities: store.cities,
    categories: store.categories,
    platforms: store.platforms,
    tags: store.tags,
    branches: store.branches.map((branch) => serializeBranch(store, branch)),
    campaigns,
    notifications: generateNotifications(store, user),
  };

  if (["admin", "campaign_manager"].includes(user.role)) {
    return {
      ...common,
      users: store.users.map(sanitizeUser),
      participants: store.participants.map((participant) => serializeParticipant(store, participant)),
      reports,
    };
  }

  const myParticipants = store.participants
    .filter((participant) => participant.influencerId === user.id)
    .map((participant) => serializeParticipant(store, participant));

  return {
    ...common,
    eligibleCampaignIds: eligibleCampaignsFor(store, user).map((campaign) => campaign.id),
    participants: myParticipants,
    reports: {
      summary: influencerSummary(store, user),
      campaigns: myParticipants,
      influencers: [],
      submissions: myParticipants.filter((participant) => participant.socialLink || participant.feedback),
      codes: myParticipants.map((participant) => ({
        campaignTitleEn: campaignById(store, participant.campaignId)?.titleEn || "",
        codeValue: participant.assignedCodeValue,
        usageCount: campaignById(store, participant.campaignId)?.offerUsageCount || participant.assignedCodeUsageCount,
        offerText: campaignById(store, participant.campaignId)?.offerDescription || participant.assignedCodeOfferText,
        status: participant.status,
      })),
    },
  };
}

function publicMetadata(store) {
  return {
    cities: store.cities.filter((city) => city.status === "active"),
    categories: store.categories.filter((category) => category.status === "active"),
    platforms: store.platforms.filter((platform) => platform.status === "active"),
    tags: store.tags.filter((tag) => tag.status === "active"),
  };
}

function campaignPayload(body, existingCampaign = null) {
  const normalizedStatus = ["active", "published"].includes(body.status)
    ? "live"
    : ["closed", "archived"].includes(body.status)
      ? "completed"
      : body.status;
  const targetTags = parseTags(body.targetTags ?? existingCampaign?.targetTags);
  return {
    titleEn: text(body.titleEn ?? existingCampaign?.titleEn),
    titleAr: text(body.titleAr ?? existingCampaign?.titleAr),
    descriptionEn: text(body.descriptionEn ?? existingCampaign?.descriptionEn),
    descriptionAr: text(body.descriptionAr ?? existingCampaign?.descriptionAr),
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
    targetCityIds: parseNumberList(body.targetCityIds),
    targetCategoryIds: parseNumberList(body.targetCategoryIds),
    targetTags,
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
  const user = store.users.find((item) => item.email.toLowerCase() === email);

  if (!user || user.password !== password) {
    return sendJson(res, 401, { error: "Invalid email or password." });
  }
  if (user.status !== "active") {
    return sendJson(res, 403, { error: "This account is not active yet." });
  }

  user.lastLogin = new Date().toISOString();
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
  if (!email || !text(body.password) || !text(body.fullName)) {
    return sendJson(res, 422, { error: "Full name, email, and password are required." });
  }
  const signupPasswordError = passwordStrengthError(body.password);
  if (signupPasswordError) {
    return sendJson(res, 422, { error: signupPasswordError });
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
  if (!Number(body.cityId)) {
    return sendJson(res, 422, { error: "City is required." });
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
    password: text(body.password),
    status: "pending",
    mobile: normalizeKuwaitMobile(body.mobile),
    gender: signupGender,
    dateOfBirth: text(body.dateOfBirth),
    cityId: Number(body.cityId) || null,
    categoryId: Number(body.categoryId) || null,
    city: cityById(store, body.cityId)?.nameEn || "",
    category: categoryById(store, body.categoryId)?.nameEn || "",
    preferredLanguage: text(body.preferredLanguage || "en"),
    instagram: text(body.instagram),
    tiktok: text(body.tiktok),
    snapchat: text(body.snapchat),
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
  };

  store.users.push(user);
  await writeStore(store);
  return sendJson(res, 201, { ok: true });
}

async function handleForgotPassword(req, res, store) {
  const body = jsonOrForm(await readBody(req), req);
  const email = text(body.email).toLowerCase();
  const user = store.users.find((item) => item.email.toLowerCase() === email);
  if (!user) return sendJson(res, 404, { error: "No account found for this email." });
  const reset = rememberPasswordReset(store, user.id, null);
  await writeStore(store);
  return sendJson(res, 200, { ok: true, resetLink: reset.resetLink });
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

  user.password = password;
  record.usedAt = new Date().toISOString();
  await writeStore(store);
  return sendJson(res, 200, { ok: true });
}

async function handleBootstrap(req, res, store, user) {
  return sendJson(res, 200, buildBootstrap(store, user));
}

async function handleUserStatus(req, res, store, actor, userId) {
  if (!requireRole(actor, ["admin", "campaign_manager"])) return sendJson(res, 403, { error: "Forbidden" });
  const body = jsonOrForm(await readBody(req), req);
  const user = userById(store, userId);
  if (!user || user.role !== "influencer") return sendJson(res, 404, { error: "Influencer not found." });
  if (!["active", "pending", "rejected", "suspended"].includes(body.status)) {
    return sendJson(res, 422, { error: "Invalid status." });
  }
  user.status = body.status;
  user.approvedByUserId = body.status === "active" ? actor.id : user.approvedByUserId;
  await writeStore(store);
  return sendJson(res, 200, { ok: true });
}

async function handleAdminUpdateInfluencer(req, res, store, actor, userId) {
  if (!requireRole(actor, ["admin", "campaign_manager"])) return sendJson(res, 403, { error: "Forbidden" });
  const body = jsonOrForm(await readBody(req), req);
  const user = userById(store, userId);
  if (!user || user.role !== "influencer") return sendJson(res, 404, { error: "Influencer not found." });

  const tags = parseTags(body.tags);
  if (invalidTags(tags).length) {
    return sendJson(res, 422, { error: "Tags must be comma-separated, lowercase, and use only letters, numbers, or hyphens." });
  }
  if (unknownTags(store, tags).length) {
    return sendJson(res, 422, { error: "Choose influencer tags from the admin tag library." });
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
  user.password = text(body.password);
  user.passwordResetMode = "manual";
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
  await writeStore(store);
  return sendJson(res, 200, { ok: true, resetLink: reset.resetLink });
}

async function handleProfileUpdate(req, res, store, actor) {
  const rawBody = await readBody(req);
  const contentType = req.headers["content-type"] || "";
  const parsed = contentType.includes("multipart/form-data")
    ? parseMultipart(rawBody, contentType)
    : { fields: jsonOrForm(rawBody, req), files: {} };
  const body = parsed.fields;
  const user = userById(store, actor.id);
  if (!user) return sendJson(res, 404, { error: "User not found." });
  if (body.fullName !== undefined && !text(body.fullName)) {
    return sendJson(res, 422, { error: "Full name is required." });
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
    if (!normalizedGender) {
      return sendJson(res, 422, { error: "Gender is required and must be male or female." });
    }
    user.gender = normalizedGender;
  }
  if (body.mobile !== undefined) {
    if (!validKuwaitMobile(body.mobile)) {
      return sendJson(res, 422, { error: "Mobile number must be 8 digits in Kuwait format." });
    }
    user.mobile = normalizeKuwaitMobile(body.mobile);
  }

  if (body.cityId !== undefined) {
    user.cityId = Number(body.cityId) || null;
    user.city = cityById(store, user.cityId)?.nameEn || "";
  }
  if (body.categoryId !== undefined) {
    user.categoryId = Number(body.categoryId) || null;
    user.category = categoryById(store, user.categoryId)?.nameEn || "";
  }

  if (actor.role === "influencer") {
    if (!text(user.mobile)) return sendJson(res, 422, { error: "Mobile number is required." });
    if (!user.cityId) return sendJson(res, 422, { error: "City is required." });
    if (!text(user.instagram)) return sendJson(res, 422, { error: "Instagram is required." });
  }

  if (body.instagramFollowers !== undefined) user.followers.instagram = Number(body.instagramFollowers) || 0;
  if (body.tiktokFollowers !== undefined) user.followers.tiktok = Number(body.tiktokFollowers) || 0;
  if (body.snapchatFollowers !== undefined) user.followers.snapchat = Number(body.snapchatFollowers) || 0;

  const avatar = parsed.files.avatar;
  if (avatar && avatar.filename) {
    const persisted = await persistUploadedImage(avatar);
    user.avatarName = persisted.displayName;
    user.avatarPath = `/uploads/${persisted.storedName}`;
  }

  await writeStore(store);
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

  store.users.push({
    id: store.nextIds.user++,
    role: "campaign_manager",
    fullName: text(body.fullName),
    email,
    password: text(body.password),
    status: "active",
    cityId: Number(body.cityId) || null,
    city: cityById(store, body.cityId)?.nameEn || "",
    categoryId: null,
    category: "",
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
  user.cityId = Number(body.cityId) || null;
  user.city = cityById(store, user.cityId)?.nameEn || "";
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
  store.campaigns.unshift(campaign);
  await writeStore(store);
  return sendJson(res, 201, { ok: true, campaign: serializeCampaign(store, campaign) });
}

async function handleUpdateCampaign(req, res, store, actor, campaignId) {
  if (!requireRole(actor, ["admin", "campaign_manager"])) return sendJson(res, 403, { error: "Forbidden" });
  const campaign = campaignById(store, campaignId);
  if (!campaign) return sendJson(res, 404, { error: "Campaign not found." });

  const body = jsonOrForm(await readBody(req), req);
  const previousStatus = campaign.status;
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

  if (previousStatus !== "deactivated" && campaign.status === "deactivated") {
    const participants = store.participants.filter(
      (participant) => participant.campaignId === campaign.id && participant.status !== "canceled"
    );
    for (const participant of participants) cancelParticipant(store, participant, "Campaign deactivated", "blocked");
  }

  await writeStore(store);
  return sendJson(res, 200, { ok: true, campaign: serializeCampaign(store, campaign) });
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
    return sendJson(res, 409, { error: "This campaign is not available for this influencer." });
  }

  const availableCode = store.campaignCodes.find((code) => code.campaignId === campaign.id && code.status === "available");
  if (!availableCode) return sendJson(res, 409, { error: "No codes are available for this campaign." });

  const now = new Date().toISOString();
  const participant = {
    id: store.nextIds.participant++,
    campaignId: campaign.id,
    influencerId: actor.id,
    status: "confirmed",
    assignedCodeId: availableCode.id,
    selectedBranchId: null,
    selectedVisitDate: null,
    joinedAt: now,
    visitedAt: null,
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
  await writeStore(store);
  return sendJson(res, 200, { ok: true });
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
  if (!offlineName) return sendJson(res, 422, { error: "Offline influencer name is required." });

  const now = new Date().toISOString();
  const participant = {
    id: store.nextIds.participant++,
    campaignId: campaign.id,
    influencerId: null,
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
  await writeStore(store);
  return sendJson(res, 200, { ok: true, participant: serializeParticipant(store, participant) });
}

async function handleRemoveParticipant(req, res, store, actor, participantId) {
  if (!requireRole(actor, ["admin", "campaign_manager"])) return sendJson(res, 403, { error: "Forbidden" });
  const participant = participantById(store, participantId);
  if (!participant) return sendJson(res, 404, { error: "Participation not found." });
  cancelParticipant(store, participant, "Removed by campaign team", "blocked");
  await writeStore(store);
  return sendJson(res, 200, { ok: true });
}

async function handleSubmission(req, res, store, actor, participantId) {
  if (!requireRole(actor, ["influencer"])) return sendJson(res, 403, { error: "Forbidden" });
  const participant = store.participants.find(
    (item) => item.id === Number(participantId) && item.influencerId === actor.id
  );
  if (!participant) return sendJson(res, 404, { error: "Participation not found." });
  if (participant.status !== "confirmed") {
    if (["submitted", "completed"].includes(participant.status)) {
      return sendJson(res, 409, { error: "Submitted proof is view-only and can no longer be edited." });
    }
    return sendJson(res, 409, { error: "This campaign is not ready for proof submission." });
  }

  const body = await readBody(req);
  const parsed = parseMultipart(body, req.headers["content-type"] || "");
  const socialLink = text(parsed.fields.socialLink);
  if (!socialLink) return sendJson(res, 422, { error: "Social media link is required." });

  participant.socialLink = socialLink;
  participant.feedback = text(parsed.fields.feedback);
  participant.platform = text(parsed.fields.platform);
  participant.status = "submitted";
  participant.submittedAt = new Date().toISOString();

  const image = parsed.files.image;
  if (image && image.filename) {
    const storedName = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}-${image.filename}`;
    await fs.writeFile(path.join(UPLOAD_DIR, storedName), image.content);
    participant.imageName = image.filename;
    participant.imagePath = `/uploads/${storedName}`;
  }

  await writeStore(store);
  return sendJson(res, 200, { ok: true });
}

async function requestHandler(req, res) {
  await ensureRuntimeFiles();
  await seedRuntimeFilesIfMissing();
  const store = await readStore();
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  if (req.method === "GET" && (pathname === "/health" || pathname === "/api/health")) {
    return sendJson(res, 200, {
      ok: true,
      uptimeSeconds: Math.round(process.uptime()),
      appBaseUrl: APP_BASE_URL,
      storageMode: "file",
    });
  }

  if (req.method === "GET" && pathname === "/api/session") return handleSession(req, res, store);
  if (req.method === "GET" && pathname === "/api/public-metadata") return sendJson(res, 200, publicMetadata(store));
  if (req.method === "POST" && pathname === "/api/login") return handleLogin(req, res, store);
  if (req.method === "POST" && pathname === "/api/logout") return handleLogout(req, res);
  if (req.method === "POST" && pathname === "/api/signup") return handleSignup(req, res, store);
  if (req.method === "POST" && pathname === "/api/password/forgot") return handleForgotPassword(req, res, store);
  if (req.method === "POST" && pathname === "/api/password/reset") return handleResetPassword(req, res, store);

  const actor = getSessionUser(req, store);
  if (req.method === "GET" && pathname === "/api/bootstrap") {
    if (!actor) return sendJson(res, 401, { error: "Unauthorized" });
    return handleBootstrap(req, res, store, actor);
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
  if (req.method === "POST" && pathname === "/api/campaigns") {
    if (!actor) return sendJson(res, 401, { error: "Unauthorized" });
    return handleCreateCampaign(req, res, store, actor);
  }
  const campaignUpdateMatch = routeMatch(pathname, /^\/api\/campaigns\/(\d+)\/update$/);
  if (req.method === "POST" && campaignUpdateMatch) {
    if (!actor) return sendJson(res, 401, { error: "Unauthorized" });
    return handleUpdateCampaign(req, res, store, actor, campaignUpdateMatch[0]);
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
  const participantRemoveMatch = routeMatch(pathname, /^\/api\/participants\/(\d+)\/remove$/);
  if (req.method === "POST" && participantRemoveMatch) {
    if (!actor) return sendJson(res, 401, { error: "Unauthorized" });
    return handleRemoveParticipant(req, res, store, actor, participantRemoveMatch[0]);
  }
  const submissionMatch = routeMatch(pathname, /^\/api\/participants\/(\d+)\/submission$/);
  if (req.method === "POST" && submissionMatch) {
    if (!actor) return sendJson(res, 401, { error: "Unauthorized" });
    return handleSubmission(req, res, store, actor, submissionMatch[0]);
  }

  if (req.method === "GET" && (pathname === "/" || pathname === "/index.html")) {
    return serveFile(res, path.join(ROOT, "index.html"));
  }
  if (req.method === "GET" && pathname === "/styles.css") return serveFile(res, path.join(ROOT, "styles.css"));
  if (req.method === "GET" && pathname === "/client.js") return serveFile(res, path.join(ROOT, "client.js"));
  if (req.method === "GET" && pathname.startsWith("/uploads/")) {
    return serveFile(res, path.join(UPLOAD_DIR, decodeURIComponent(path.basename(pathname))));
  }

  return sendText(res, 404, "Not found");
}

const server = http.createServer((req, res) => {
  requestHandler(req, res).catch((error) => {
    console.error(error);
    sendJson(res, 500, { error: "Internal server error" });
  });
});

server.listen(PORT, () => {
  console.log(`PICK Influence Hub running on ${APP_BASE_URL}`);
});
