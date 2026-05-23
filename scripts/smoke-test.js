const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const SERVER_PATH = path.join(ROOT, "server.js");
const SOURCE_STORE = path.join(ROOT, "data", "store.json");
const SOURCE_UPLOADS = path.join(ROOT, "uploads");

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch (error) {
    return false;
  }
}

async function copyDir(sourceDir, targetDir) {
  await fs.mkdir(targetDir, { recursive: true });
  if (!(await pathExists(sourceDir))) return;
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      await copyDir(sourcePath, targetPath);
      continue;
    }
    await fs.copyFile(sourcePath, targetPath);
  }
}

async function waitForHealth(baseUrl, timeoutMs = 12000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch (error) {
      // keep polling
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Smoke test server did not become healthy in time.");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function tinyPngBuffer() {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9l9QAAAABJRU5ErkJggg==",
    "base64"
  );
}

function isoDateDaysFromNow(offset) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

async function runNodeScript(scriptPath, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd: ROOT,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

async function run() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "pick-smoke-"));
  const uatSeedPath = path.join(tempRoot, "uat-store.json");
  const uatSeedRun = await runNodeScript(path.join(ROOT, "scripts", "seed-uat-data.js"), ["--out", uatSeedPath]);
  assert(uatSeedRun.code === 0, `UAT seed script should exit cleanly, got ${uatSeedRun.code}. ${uatSeedRun.stderr}`);
  const seededUatStore = JSON.parse(await fs.readFile(uatSeedPath, "utf8"));
  assert(seededUatStore.users.length === 23, `UAT seed should produce 23 users, got ${seededUatStore.users.length}.`);
  assert(seededUatStore.campaigns.length === 13, `UAT seed should produce 13 campaigns, got ${seededUatStore.campaigns.length}.`);

  const dataDir = path.join(tempRoot, "data");
  const uploadsDir = path.join(tempRoot, "uploads");
  const storePath = path.join(dataDir, "store.json");
  const port = "5051";
  const baseUrl = `http://127.0.0.1:${port}`;

  await fs.mkdir(dataDir, { recursive: true });
  await fs.mkdir(uploadsDir, { recursive: true });
  await fs.copyFile(SOURCE_STORE, storePath);
  await copyDir(SOURCE_UPLOADS, uploadsDir);

  const child = spawn(process.execPath, [SERVER_PATH], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: port,
      APP_BASE_URL: baseUrl,
      DATA_DIR: dataDir,
      STORE_PATH: storePath,
      UPLOAD_DIR: uploadsDir,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  try {
    await waitForHealth(baseUrl);

    const health = await fetch(`${baseUrl}/health`).then((response) => response.json());
    assert(health.ok, "Health endpoint did not return ok.");
    assert(stdout.includes("PICK Social Club running on"), "Server startup log should use the PICK Social Club brand.");

    const login = await fetch(`${baseUrl}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: baseUrl },
      body: JSON.stringify({ email: "sara@pick.internal", password: "pick123" }),
    });
    assert(login.ok, `Admin login failed with status ${login.status}.`);

    const cookie = login.headers.get("set-cookie");
    assert(cookie, "Admin login did not return a session cookie.");

    const refreshedStore = JSON.parse(await fs.readFile(storePath, "utf8"));
    const sara = refreshedStore.users.find((user) => user.email === "sara@pick.internal");
    assert(sara?.password?.startsWith("scrypt$"), "Successful login should rehash legacy plaintext passwords.");

    const wrongPassword = await fetch(`${baseUrl}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: baseUrl },
      body: JSON.stringify({ email: "sara@pick.internal", password: "wrong-password" }),
    });
    assert(wrongPassword.status === 401, `Wrong password should return 401, got ${wrongPassword.status}.`);

    const crossOrigin = await fetch(`${baseUrl}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://evil.example.com" },
      body: JSON.stringify({ email: "sara@pick.internal", password: "pick123" }),
    });
    assert(crossOrigin.status === 403, `Cross-origin login should return 403, got ${crossOrigin.status}.`);

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const failedLogin = await fetch(`${baseUrl}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: baseUrl },
        body: JSON.stringify({ email: "sara@pick.internal", password: `wrong-${attempt}` }),
      });
      assert(failedLogin.status === 401, `Failed login ${attempt + 1} should return 401, got ${failedLogin.status}.`);
    }

    const lockedLogin = await fetch(`${baseUrl}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: baseUrl },
      body: JSON.stringify({ email: "sara@pick.internal", password: "wrong-final" }),
    });
    assert(lockedLogin.status === 429, `Locked login should return 429, got ${lockedLogin.status}.`);
    const lockedPayload = await lockedLogin.json();
    assert(/locked/i.test(String(lockedPayload.error || "")), "Locked login response should mention the account is locked.");

    const bootstrap = await fetch(`${baseUrl}/api/bootstrap`, {
      headers: { Cookie: cookie.split(";")[0] },
    });
    assert(bootstrap.ok, `Bootstrap failed with status ${bootstrap.status}.`);

    const payload = await bootstrap.json();
    assert(payload.currentUser && payload.currentUser.email === "sara@pick.internal", "Bootstrap returned the wrong current user.");
    assert(Array.isArray(payload.auditEvents), "Admin bootstrap should include audit events.");
    const instagramPlatformId = payload.platforms.find((platform) => platform.nameEn === "Instagram")?.id;
    assert(instagramPlatformId, "Expected Instagram platform metadata.");
    const smokeTag = payload.tags.find((tag) => tag.status === "active")?.value;
    assert(smokeTag, "Expected at least one active admin-controlled tag for smoke coverage.");

    const adminProfileUpdate = await fetch(`${baseUrl}/api/profile/update`, {
      method: "POST",
      headers: {
        Cookie: cookie.split(";")[0],
        Origin: baseUrl,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fullName: "Sara Admin",
        mobile: "",
        gender: "",
      }),
    });
    assert(adminProfileUpdate.ok, `Non-influencer profile update should allow blank mobile/gender, got ${adminProfileUpdate.status}.`);

    const freshCampaignPayload = {
      titleEn: "Smoke Hermetic Campaign",
      titleAr: "حملة اختبار الدخان",
      descriptionEn: "Smoke campaign for targeting and lifecycle coverage.",
      descriptionAr: "حملة اختبار للدورة والاستهداف.",
      captionGuide: "Use #PICKKuwait and tag @pick.kuwait",
      whatsappMessage: "Custom body for smoke",
      type: "shop_visit",
      status: "live",
      audience: "Smoke",
      audienceAr: "اختبار",
      offerDescription: "One complimentary cold brew.",
      offerUsageCount: 1,
      startDate: isoDateDaysFromNow(1),
      endDate: isoDateDaysFromNow(7),
      visitDeadline: isoDateDaysFromNow(8),
      submissionDeadline: isoDateDaysFromNow(9),
      branchMode: "selected",
      branchIds: [1],
      targetCityIds: [2],
      targetCategoryIds: [3],
      targetTags: [],
      targetGender: "female",
      minFollowers: 1000,
      targetPlatformIds: [instagramPlatformId],
      participantCap: 1,
    };
    const createCampaign = await fetch(`${baseUrl}/api/campaigns`, {
      method: "POST",
      headers: {
        Cookie: cookie.split(";")[0],
        Origin: baseUrl,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(freshCampaignPayload),
    });
    assert(createCampaign.ok, `Campaign creation failed with status ${createCampaign.status}.`);
    const createdCampaignPayload = await createCampaign.json();
    const freshCampaignId = createdCampaignPayload.campaign.id;
    assert(createdCampaignPayload.campaign.captionGuide === "Use #PICKKuwait and tag @pick.kuwait", "Created campaign should return its caption guide.");
    assert(createdCampaignPayload.campaign.whatsappMessage === "Custom body for smoke", "Created campaign should return its whatsappMessage.");
    const clientSource = await fs.readFile(path.join(ROOT, "client.js"), "utf8");
    const campaignDeepLinkSource = clientSource.match(/function campaignDeepLink\(campaignId, baseUrl = window\.location\.origin\) \{[\s\S]*?\n\}/)?.[0];
    const defaultCampaignShareBodySource = clientSource.match(/function defaultCampaignShareBody\(campaign\) \{[\s\S]*?\n\}/)?.[0];
    const generateCampaignShareTextSource = clientSource.match(/function generateCampaignShareText\(campaign, options = \{\}\) \{[\s\S]*?\n\}/)?.[0];
    const renderMemberCampaignsPageSource = clientSource.match(/function renderMemberCampaignsPage\(\) \{[\s\S]*?\n\}/)?.[0];
    const renderInfluencerPagesSource = clientSource.match(/function renderInfluencerPages\(\) \{[\s\S]*?\n\}/)?.[0];
    const renderDeskRailSource = clientSource.match(/function renderDeskRail\(participants\) \{[\s\S]*?\n\}/)?.[0];
    const renderInfluencerDashboardSource = clientSource.match(/function renderInfluencerDashboard\(\) \{[\s\S]*?\n\}/)?.[0];
    const renderMemberCardSummarySource = clientSource.match(/function renderMemberCardSummary\(participant, campaign, options = \{\}\) \{[\s\S]*?\n\}/)?.[0];
    const renderSubmissionFormSource = clientSource.match(/function renderSubmissionForm\(participant, campaign, options = \{\}\) \{[\s\S]*?\n\}/)?.[0];
    const renderMyCampaignCardsSource = clientSource.match(/function renderMyCampaignCards\(participants, compactOnly, proofOnly = false\) \{[\s\S]*?\n\}/)?.[0];
    assert(
      campaignDeepLinkSource &&
        defaultCampaignShareBodySource &&
        generateCampaignShareTextSource &&
        renderMemberCampaignsPageSource &&
        renderInfluencerPagesSource &&
        renderDeskRailSource &&
        renderInfluencerDashboardSource &&
        renderMemberCardSummarySource &&
        renderSubmissionFormSource &&
        renderMyCampaignCardsSource,
      "Expected campaign share helpers plus member campaigns/dashboard/card render helpers to exist in client.js."
    );
    const shareSandbox = {
      state: {
        locale: "en",
        data: {
          branches: [{ id: 1, nameEn: "Smoke Branch", nameAr: "فرع الدخان" }],
        },
      },
      window: { location: { origin: baseUrl } },
      branchDisplayName: (branch) => branch?.nameEn || branch?.nameAr || "-",
      l: (en) => en,
      formatDate: (value) => value || "",
    };
    vm.createContext(shareSandbox);
    vm.runInContext(`${campaignDeepLinkSource}\n${defaultCampaignShareBodySource}\n${generateCampaignShareTextSource}`, shareSandbox);
    const shareText = shareSandbox.generateCampaignShareText({
      id: freshCampaignId,
      titleEn: "Smoke Hermetic Campaign",
      titleAr: "حملة اختبار الدخان",
      offerDescription: "One complimentary cold brew.",
      whatsappMessage: "Custom body for smoke",
      branchMode: "selected",
      branchIds: [1],
      visitDeadline: freshCampaignPayload.visitDeadline,
      submissionDeadline: freshCampaignPayload.submissionDeadline,
    }, { recipientName: "Laila Q8 Bites" });
    assert(String(shareText).startsWith("Hi Laila 💜"), "Generated share text should personalize the greeting for direct sends.");
    assert(String(shareText).includes("Custom body for smoke"), "Generated share text should use the campaign whatsappMessage when present.");
    assert(
      String(shareText).includes(`Open: ${baseUrl}/?campaign=${freshCampaignId}`),
      "Generated share text should include the campaign deep link."
    );

    const campaignsPageSandbox = {
      state: {
        currentPage: "campaigns",
        data: {
          participants: [
            { id: 1, status: "confirmed", joinedAt: "2026-05-11T10:00:00.000Z" },
            { id: 2, status: "completed", submittedAt: "2026-05-10T10:00:00.000Z" },
            { id: 3, status: "offline_reserved", joinedAt: "2026-05-09T10:00:00.000Z" },
          ],
        },
      },
      l: (en) => en,
      pageHeader: (title, subtitle) => `<header><h1>${title}</h1><p>${subtitle}</p></header>`,
      eligibleCampaigns: () => [{ id: 99 }],
      participantCanSubmit: (participant) => ["confirmed", "visited"].includes(participant.status),
      renderAvailableCampaignCards: (rows) => `<div class="available-count">${rows.length}</div>`,
      renderMyCampaignCards: (rows) => `<div class="member-count">${rows.length}</div>`,
      renderInfluencerCampaignPreviewPage: () => "preview",
      renderProfilePage: () => "profile",
      renderInfluencerDashboard: () => "dashboard",
    };
    vm.createContext(campaignsPageSandbox);
    vm.runInContext(`${renderMemberCampaignsPageSource}\n${renderInfluencerPagesSource}`, campaignsPageSandbox);
    const mergedCampaignsHtml = campaignsPageSandbox.renderMemberCampaignsPage();
    assert(/Open campaigns/.test(String(mergedCampaignsHtml)), "Merged member campaigns page should render the Open campaigns section when eligible campaigns exist.");
    assert(/Active/.test(String(mergedCampaignsHtml)), "Merged member campaigns page should render the Active section when actionable participations exist.");
    assert(/History/.test(String(mergedCampaignsHtml)), "Merged member campaigns page should render the History section when historical participations exist.");
    campaignsPageSandbox.state.currentPage = "availableCampaigns";
    assert(campaignsPageSandbox.renderInfluencerPages() === mergedCampaignsHtml, "Legacy availableCampaigns route should redirect to the merged campaigns page.");
    campaignsPageSandbox.state.currentPage = "myCampaigns";
    assert(campaignsPageSandbox.renderInfluencerPages() === mergedCampaignsHtml, "Legacy myCampaigns route should redirect to the merged campaigns page.");

    const emptyCampaignsSandbox = {
      state: { data: { participants: [] } },
      l: (en) => en,
      pageHeader: (title) => `<header>${title}</header>`,
      eligibleCampaigns: () => [],
      participantCanSubmit: () => false,
      renderAvailableCampaignCards: () => "",
      renderMyCampaignCards: () => "",
    };
    vm.createContext(emptyCampaignsSandbox);
    vm.runInContext(renderMemberCampaignsPageSource, emptyCampaignsSandbox);
    const emptyCampaignsHtml = emptyCampaignsSandbox.renderMemberCampaignsPage();
    assert(/No campaigns yet\. Check back later/.test(String(emptyCampaignsHtml)), "Merged member campaigns page should show the single empty fallback when there are no open, active, or historical campaigns.");

    const dashboardSandbox = {
      state: {
        locale: "en",
        currentUser: { fullName: "Laila Q8 Bites" },
        data: {
          participants: [{ id: 1, campaignId: 201, status: "confirmed" }],
          previewCampaigns: [{ id: 301, titleEn: "Soon", descriptionEn: "Preview", startDate: "2026-05-30" }],
          journalEntries: [{ id: 401, titleEn: "Featured story", bodyEn: "Published journal body for the featured dashboard card.", publishedAt: "2026-05-20T09:00:00.000Z", createdAt: "2026-05-20T09:00:00.000Z" }],
          campaigns: [{ id: 201, titleEn: "Cold Brew Shop Visit" }],
          notifications: [{ title: { en: "New code assigned" }, body: { en: "Your code is ready." } }],
        },
      },
      l: (en) => en,
      escapeHtml: (value) => String(value ?? ""),
      participantCanSubmit: (participant) => ["confirmed", "visited"].includes(participant.status),
      eligibleCampaigns: () => [{ id: 501, titleEn: "Open campaign" }],
      currentCampaigns: () => [{ id: 201, titleEn: "Cold Brew Shop Visit" }],
      findCampaignForParticipant: (participant) => ({ id: participant.campaignId, titleEn: "Cold Brew Shop Visit" }),
      campaignTitle: (campaign) => campaign?.titleEn || "",
      journalTitle: (entry) => entry?.titleEn || "",
      journalBody: (entry) => entry?.bodyEn || "",
      renderCampaignBanner: () => "<div class='banner'></div>",
      campaignDescription: (campaign) => campaign?.descriptionEn || "",
      formatDate: (value) => value || "",
      formatDateTime: (value) => value || "",
      renderAvailableCampaignCards: (rows) => `<div class="available-count">${rows.length}</div>`,
      renderNotificationsBell: () => '<div class="notification-bell"></div>',
      memberIssueNumber: () => "21",
      sectionHeader: () => "",
    };
    vm.createContext(dashboardSandbox);
    vm.runInContext(`${renderDeskRailSource}\n${renderInfluencerDashboardSource}`, dashboardSandbox);
    const populatedDashboardHtml = dashboardSandbox.renderInfluencerDashboard();
    assert(/class="cover"/.test(String(populatedDashboardHtml)), "Member dashboard should render the featured journal cover when a published entry exists.");
    assert(/class="desk-block"/.test(String(populatedDashboardHtml)), "Member dashboard should render the desk block when the member has actionable participations.");
    assert(/class="desk-tile"/.test(String(populatedDashboardHtml)), "Member dashboard should render one desk tile per actionable participation.");

    const quietDashboardSandbox = {
      state: {
        locale: "en",
        currentUser: { fullName: "Quiet Member" },
        data: {
          participants: [],
          previewCampaigns: [],
          journalEntries: [],
          campaigns: [],
          notifications: [],
        },
      },
      l: (en) => en,
      escapeHtml: (value) => String(value ?? ""),
      participantCanSubmit: () => false,
      eligibleCampaigns: () => [],
      currentCampaigns: () => [],
      findCampaignForParticipant: () => null,
      campaignTitle: (campaign) => campaign?.titleEn || "",
      journalTitle: (entry) => entry?.titleEn || "",
      journalBody: (entry) => entry?.bodyEn || "",
      renderCampaignBanner: () => "",
      campaignDescription: () => "",
      formatDate: (value) => value || "",
      formatDateTime: (value) => value || "",
      renderAvailableCampaignCards: () => "",
      renderNotificationsBell: () => '<div class="notification-bell"></div>',
      memberIssueNumber: () => "21",
      sectionHeader: () => "",
    };
    vm.createContext(quietDashboardSandbox);
    vm.runInContext(`${renderDeskRailSource}\n${renderInfluencerDashboardSource}`, quietDashboardSandbox);
    const quietDashboardHtml = quietDashboardSandbox.renderInfluencerDashboard();
    assert(/member-feed__empty/.test(String(quietDashboardHtml)), "Member dashboard should render the feed empty state when there is no journal, preview, eligibility, or actionable campaign.");
    assert(!/class="desk-block"/.test(String(quietDashboardHtml)), "Member dashboard should not render the desk block when there is nothing actionable.");

    const campaignCardsSandbox = {
      state: { locale: "en", data: {}, targetActiveParticipantId: null },
      l: (en) => en,
      escapeHtml: (value) => String(value ?? ""),
      participantCanSubmit: (participant) => ["confirmed", "visited"].includes(participant.status),
      participantPriority: (participant) => (participant.status === "confirmed" ? 0 : 1),
      currentCampaigns: () => [
        {
          id: 201,
          titleEn: "Cold Brew Shop Visit",
          descriptionEn: "Cold brew details",
          visitDeadline: "2026-05-28",
          submissionDeadline: "2026-05-30",
          captionGuide: "Guide",
          offerDescription: "Free cold brew",
        },
        {
          id: 202,
          titleEn: "Ladies Beauty Day",
          descriptionEn: "Beauty details",
          visitDeadline: "2026-05-29",
          submissionDeadline: "2026-05-31",
          captionGuide: "",
          offerDescription: "Beauty set",
        },
      ],
      campaignTitle: (campaign) => campaign?.titleEn || "",
      campaignDescription: (campaign) => campaign?.descriptionEn || "",
      renderParticipantImages: () => "",
      renderPlatformSelect: () => "<select></select>",
      renderCampaignBanner: () => "<div class='banner'></div>",
      renderCodeDetails: () => "<div class='code-details'></div>",
      participantStatusLabelShort: (status) => (status === "confirmed" ? "Ready" : status),
      statusTone: () => "warning",
      formatDate: (value) => value || "",
    };
    vm.createContext(campaignCardsSandbox);
    vm.runInContext(`${renderMemberCardSummarySource}\n${renderSubmissionFormSource}\n${renderMyCampaignCardsSource}`, campaignCardsSandbox);
    const campaignCardsHtml = campaignCardsSandbox.renderMyCampaignCards(
      [
        { id: 11, campaignId: 201, status: "confirmed", joinedAt: "2026-05-11T10:00:00.000Z", assignedCodeValue: "CBS-001", socialLink: "", feedback: "", platform: "", images: [] },
        { id: 12, campaignId: 202, status: "confirmed", joinedAt: "2026-05-10T10:00:00.000Z", assignedCodeValue: "LBD-002", socialLink: "", feedback: "", platform: "", images: [] },
      ],
      false,
      false
    );
    assert(/campaign-accordion--actionable/.test(String(campaignCardsHtml)), "Member campaigns cards should mark actionable rows with the actionable accordion class.");
    assert(/<details class="timeline-card campaign-accordion campaign-accordion--actionable" open>/.test(String(campaignCardsHtml)), "The first actionable member campaigns card should render open by default.");
    campaignCardsSandbox.state.targetActiveParticipantId = 12;
    const targetedCampaignCardsHtml = campaignCardsSandbox.renderMyCampaignCards(
      [
        { id: 11, campaignId: 201, status: "confirmed", joinedAt: "2026-05-11T10:00:00.000Z", assignedCodeValue: "CBS-001", socialLink: "", feedback: "", platform: "", images: [] },
        { id: 12, campaignId: 202, status: "confirmed", joinedAt: "2026-05-10T10:00:00.000Z", assignedCodeValue: "LBD-002", socialLink: "", feedback: "", platform: "", images: [] },
      ],
      false,
      false
    );
    assert(/Cold Brew Shop Visit[\s\S]*?<details class="timeline-card campaign-accordion campaign-accordion--actionable" open>[\s\S]*?Ladies Beauty Day/.test(String(targetedCampaignCardsHtml)), "Targeted participant navigation should open the requested actionable card instead of always opening the first one.");

    const adminBootstrapAfterCampaign = await fetch(`${baseUrl}/api/bootstrap`, {
      headers: { Cookie: cookie.split(";")[0] },
    }).then((response) => response.json());
    const adminCampaign = adminBootstrapAfterCampaign.campaigns.find((campaign) => campaign.id === freshCampaignId);
    assert(adminCampaign?.captionGuide === "Use #PICKKuwait and tag @pick.kuwait", "Admin bootstrap should round-trip campaign captionGuide.");
    assert(adminCampaign?.whatsappMessage === "Custom body for smoke", "Admin bootstrap should round-trip campaign whatsappMessage.");

    const contentStamp = Date.now();
    const publishedJournalTitle = `Smoke Journal ${contentStamp}`;
    const draftJournalTitle = `Smoke Draft Journal ${contentStamp}`;
    const publishedJournalForm = new FormData();
    publishedJournalForm.append("titleEn", publishedJournalTitle);
    publishedJournalForm.append("titleAr", `يوميات الدخان ${contentStamp}`);
    publishedJournalForm.append("bodyEn", "Published smoke journal entry for dashboard coverage.");
    publishedJournalForm.append("bodyAr", "منشور يوميات منشور لاختبار لوحة العضو.");
    publishedJournalForm.append("externalLink", "https://instagram.com/p/smoke-journal");
    publishedJournalForm.append("publish", "1");
    const createPublishedJournal = await fetch(`${baseUrl}/api/journal`, {
      method: "POST",
      headers: {
        Cookie: cookie.split(";")[0],
        Origin: baseUrl,
      },
      body: publishedJournalForm,
    });
    assert(createPublishedJournal.ok, `Published journal creation failed with status ${createPublishedJournal.status}.`);
    const createdPublishedJournal = await createPublishedJournal.json();
    assert(createdPublishedJournal.entry?.status === "published", "Published journal entry should return status published.");

    const draftJournalForm = new FormData();
    draftJournalForm.append("titleEn", draftJournalTitle);
    draftJournalForm.append("titleAr", `مسودة يوميات ${contentStamp}`);
    draftJournalForm.append("bodyEn", "Draft smoke journal entry.");
    draftJournalForm.append("bodyAr", "مسودة لا يجب أن يراها العضو.");
    const createDraftJournal = await fetch(`${baseUrl}/api/journal`, {
      method: "POST",
      headers: {
        Cookie: cookie.split(";")[0],
        Origin: baseUrl,
      },
      body: draftJournalForm,
    });
    assert(createDraftJournal.ok, `Draft journal creation failed with status ${createDraftJournal.status}.`);

    const adminBootstrapAfterJournal = await fetch(`${baseUrl}/api/bootstrap`, {
      headers: { Cookie: cookie.split(";")[0] },
    }).then((response) => response.json());
    const adminJournalEntry = (adminBootstrapAfterJournal.journalEntries || []).find((entry) => entry.id === createdPublishedJournal.entry.id);
    assert(adminJournalEntry?.status === "published", "Admin bootstrap should include the published journal entry.");

    const previewCampaignPayload = {
      ...freshCampaignPayload,
      titleEn: "Smoke Coming Soon Campaign",
      titleAr: "حملة قريباً للدخان",
      descriptionEn: "Draft preview campaign that should tease members without opening eligibility.",
      descriptionAr: "حملة مسودة للمعاينة فقط بدون فتح الأهلية.",
      status: "draft",
      previewMode: true,
      startDate: isoDateDaysFromNow(14),
      endDate: isoDateDaysFromNow(18),
      visitDeadline: isoDateDaysFromNow(19),
      submissionDeadline: isoDateDaysFromNow(20),
    };
    const createPreviewCampaign = await fetch(`${baseUrl}/api/campaigns`, {
      method: "POST",
      headers: {
        Cookie: cookie.split(";")[0],
        Origin: baseUrl,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(previewCampaignPayload),
    });
    assert(createPreviewCampaign.ok, `Preview campaign creation failed with status ${createPreviewCampaign.status}.`);
    const previewCampaignId = (await createPreviewCampaign.json()).campaign.id;

    const csvForm = new FormData();
    csvForm.append("codesFile", new Blob(["code\nSMOKE-001\nSMOKE-002\n"], { type: "text/csv" }), "smoke-codes.csv");
    const uploadCodes = await fetch(`${baseUrl}/api/campaigns/${freshCampaignId}/codes/upload`, {
      method: "POST",
      headers: {
        Cookie: cookie.split(";")[0],
        Origin: baseUrl,
      },
      body: csvForm,
    });
    assert(uploadCodes.ok, `Code upload failed with status ${uploadCodes.status}.`);

    const staleCampaignPayload = {
      ...freshCampaignPayload,
      titleEn: "Smoke Closed Visit Campaign",
      titleAr: "حملة زيارة مغلقة للدخان",
      startDate: isoDateDaysFromNow(-7),
      endDate: isoDateDaysFromNow(-2),
      visitDeadline: isoDateDaysFromNow(-1),
      submissionDeadline: isoDateDaysFromNow(1),
      participantCap: 0,
    };
    const createStaleCampaign = await fetch(`${baseUrl}/api/campaigns`, {
      method: "POST",
      headers: {
        Cookie: cookie.split(";")[0],
        Origin: baseUrl,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(staleCampaignPayload),
    });
    assert(createStaleCampaign.ok, `Stale campaign creation failed with status ${createStaleCampaign.status}.`);
    const staleCampaignId = (await createStaleCampaign.json()).campaign.id;
    const staleCodesForm = new FormData();
    staleCodesForm.append("codesFile", new Blob(["code\nSTALE-001\n"], { type: "text/csv" }), "stale-codes.csv");
    const staleCodesUpload = await fetch(`${baseUrl}/api/campaigns/${staleCampaignId}/codes/upload`, {
      method: "POST",
      headers: {
        Cookie: cookie.split(";")[0],
        Origin: baseUrl,
      },
      body: staleCodesForm,
    });
    assert(staleCodesUpload.ok, `Stale campaign code upload failed with status ${staleCodesUpload.status}.`);

    const form = new FormData();
    form.append("avatar", new Blob([Buffer.alloc(1024, "A")], { type: "image/jpeg" }), "fake.jpg");
    const badImageUpload = await fetch(`${baseUrl}/api/profile/update`, {
      method: "POST",
      headers: {
        Cookie: cookie.split(";")[0],
        Origin: baseUrl,
      },
      body: form,
    });
    assert(badImageUpload.status === 422, `Invalid image upload should return 422, got ${badImageUpload.status}.`);
    const uploadPayload = await badImageUpload.json();
    assert(/image/i.test(String(uploadPayload.error || "")), "Invalid image upload should explain the image is not valid.");

    const smokeStamp = Date.now();
    const freshUsers = [
      {
        key: "femaleA",
        fullName: "Smoke Female A",
        email: `smoke-${smokeStamp}-a@example.com`,
        gender: "female",
        instagramFollowers: 2200,
      },
      {
        key: "maleB",
        fullName: "Smoke Male B",
        email: `smoke-${smokeStamp}-b@example.com`,
        gender: "male",
        instagramFollowers: 2200,
      },
      {
        key: "femaleC",
        fullName: "Smoke Female C",
        email: `smoke-${smokeStamp}-c@example.com`,
        gender: "female",
        instagramFollowers: 2600,
      },
    ];

    for (const user of freshUsers) {
      const signup = await fetch(`${baseUrl}/api/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: baseUrl },
        body: JSON.stringify({
          fullName: user.fullName,
          email: user.email,
          password: "PickSmoke1",
          cityId: 2,
          categoryId: 3,
          gender: user.gender,
          mobile: `90000${String(freshUsers.indexOf(user) + 10).padStart(3, "0")}`,
          instagram: `@${user.key}`,
          tiktok: "",
          snapchat: "",
          instagramFollowers: user.instagramFollowers,
          preferredPlatform: "Instagram",
        }),
      });
      assert(signup.ok, `Signup failed for ${user.email} with status ${signup.status}.`);
    }

    const storeAfterSignup = JSON.parse(await fs.readFile(storePath, "utf8"));
    for (const user of freshUsers) {
      user.id = storeAfterSignup.users.find((row) => row.email === user.email)?.id;
      assert(user.id, `Could not locate signed up user ${user.email} in the store.`);
      const approve = await fetch(`${baseUrl}/api/users/${user.id}/status`, {
        method: "POST",
        headers: {
          Cookie: cookie.split(";")[0],
          Origin: baseUrl,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "active" }),
      });
      assert(approve.ok, `Approving ${user.email} failed with status ${approve.status}.`);
    }

    const adminTagUpdate = await fetch(`${baseUrl}/api/users/${freshUsers[0].id}/admin-update`, {
      method: "POST",
      headers: {
        Cookie: cookie.split(";")[0],
        Origin: baseUrl,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ tags: [smokeTag], notes: "Smoke tag assignment" }),
    });
    assert(adminTagUpdate.ok, `Admin tag update failed with status ${adminTagUpdate.status}.`);
    const adminBootstrapAfterTag = await fetch(`${baseUrl}/api/bootstrap`, {
      headers: { Cookie: cookie.split(";")[0] },
    }).then((response) => response.json());
    const taggedUser = adminBootstrapAfterTag.users.find((row) => row.id === freshUsers[0].id);
    assert(taggedUser?.tags?.includes(smokeTag), "Admin tag update should persist the tag array on the influencer.");

    const influencerLogin = await fetch(`${baseUrl}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: baseUrl },
      body: JSON.stringify({ email: freshUsers[0].email, password: "PickSmoke1" }),
    });
    assert(influencerLogin.ok, `Influencer login failed with status ${influencerLogin.status}.`);
    const influencerCookie = influencerLogin.headers.get("set-cookie");
    assert(influencerCookie, "Influencer login did not return a session cookie.");

    const influencerBootstrap = await fetch(`${baseUrl}/api/bootstrap`, {
      headers: { Cookie: influencerCookie.split(";")[0] },
    }).then((response) => response.json());
    assert(influencerBootstrap.currentUser?.role === "influencer", "Underlying role identifier should remain 'influencer'.");
    assert(
      influencerBootstrap.eligibleCampaignIds?.includes(freshCampaignId),
      "Expected the fresh female influencer to be eligible for the fresh campaign."
    );
    const influencerCampaign = influencerBootstrap.campaigns.find((campaign) => campaign.id === freshCampaignId);
    assert(influencerCampaign?.captionGuide === "Use #PICKKuwait and tag @pick.kuwait", "Influencer bootstrap should include campaign captionGuide.");
    assert(
      (influencerBootstrap.previewCampaigns || []).some((campaign) => campaign.id === previewCampaignId),
      "Member bootstrap should include draft preview campaigns marked as Coming Soon."
    );
    assert(
      !(influencerBootstrap.eligibleCampaignIds || []).includes(previewCampaignId),
      "Preview-only draft campaigns should not appear in eligibleCampaignIds."
    );
    assert(
      (influencerBootstrap.journalEntries || []).some((entry) => entry.id === createdPublishedJournal.entry.id),
      "Member bootstrap should include published journal entries."
    );
    assert(
      !(influencerBootstrap.journalEntries || []).some((entry) => entry.titleEn === draftJournalTitle || entry.titleAr === `مسودة يوميات ${contentStamp}`),
      "Member bootstrap should not expose draft journal entries."
    );
    assert(
      (influencerBootstrap.journalEntries || []).every((entry) => entry.status === "published"),
      "Member bootstrap should only expose published journal entries."
    );

    const nasserLogin = await fetch(`${baseUrl}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: baseUrl },
      body: JSON.stringify({ email: "nasser@pick.internal", password: "pick123" }),
    });
    assert(nasserLogin.ok, `Campaign manager login failed with status ${nasserLogin.status}.`);
    const nasserCookie = nasserLogin.headers.get("set-cookie");
    assert(nasserCookie, "Campaign manager login did not return a session cookie.");
    const forbiddenJournalUpdate = await fetch(`${baseUrl}/api/journal/${createdPublishedJournal.entry.id}/update`, {
      method: "POST",
      headers: {
        Cookie: nasserCookie.split(";")[0],
        Origin: baseUrl,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        titleEn: `${publishedJournalTitle} Edited`,
        titleAr: `يوميات الدخان ${contentStamp}`,
        bodyEn: "Should not be allowed.",
        bodyAr: "يجب ألا يسمح بهذا.",
      }),
    });
    assert(forbiddenJournalUpdate.status === 403, `Campaign manager should receive 403 when editing another author's journal entry, got ${forbiddenJournalUpdate.status}.`);

    const maleLogin = await fetch(`${baseUrl}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: baseUrl },
      body: JSON.stringify({ email: freshUsers[1].email, password: "PickSmoke1" }),
    });
    assert(maleLogin.ok, `Male influencer login failed with status ${maleLogin.status}.`);
    const maleCookie = maleLogin.headers.get("set-cookie");
    const maleBootstrap = await fetch(`${baseUrl}/api/bootstrap`, {
      headers: { Cookie: maleCookie.split(";")[0] },
    }).then((response) => response.json());
    assert(
      !maleBootstrap.eligibleCampaignIds?.includes(freshCampaignId),
      "Male influencer should not be eligible for a female-only campaign."
    );

    const staleUser = {
      fullName: `Smoke Closed Visit ${smokeStamp}`,
      email: `smoke-${smokeStamp}-closed@example.com`,
      password: "PickSmoke1",
      cityId: 2,
      categoryId: 3,
      gender: "female",
      mobile: "91111222",
      instagram: "@smokeclosedvisit",
      tiktok: "",
      snapchat: "",
      instagramFollowers: 1800,
      preferredPlatform: "Instagram",
    };
    const staleSignup = await fetch(`${baseUrl}/api/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: baseUrl },
      body: JSON.stringify(staleUser),
    });
    assert(staleSignup.ok, `Signup failed for stale-join smoke user with status ${staleSignup.status}.`);
    const storeAfterStaleSignup = JSON.parse(await fs.readFile(storePath, "utf8"));
    staleUser.id = storeAfterStaleSignup.users.find((row) => row.email === staleUser.email)?.id;
    assert(staleUser.id, "Could not locate stale-join smoke user in the store.");
    const approveStaleUser = await fetch(`${baseUrl}/api/users/${staleUser.id}/status`, {
      method: "POST",
      headers: {
        Cookie: cookie.split(";")[0],
        Origin: baseUrl,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "active" }),
    });
    assert(approveStaleUser.ok, `Approving stale-join smoke user failed with status ${approveStaleUser.status}.`);
    const staleUserLogin = await fetch(`${baseUrl}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: baseUrl },
      body: JSON.stringify({ email: staleUser.email, password: staleUser.password }),
    });
    assert(staleUserLogin.ok, `Login failed for stale-join smoke user with status ${staleUserLogin.status}.`);
    const staleUserCookie = staleUserLogin.headers.get("set-cookie");
    assert(staleUserCookie, "Stale-join smoke user login did not return a session cookie.");
    const staleUserBootstrap = await fetch(`${baseUrl}/api/bootstrap`, {
      headers: { Cookie: staleUserCookie.split(";")[0] },
    }).then((response) => response.json());
    assert(
      !staleUserBootstrap.eligibleCampaignIds?.includes(staleCampaignId),
      "Campaign with a past visit deadline should not appear in eligibleCampaignIds."
    );
    const staleJoin = await fetch(`${baseUrl}/api/campaigns/${staleCampaignId}/join`, {
      method: "POST",
      headers: { Cookie: staleUserCookie.split(";")[0], Origin: baseUrl },
      body: JSON.stringify({}),
    });
    assert(staleJoin.status === 409, `Join on a campaign with a past visit deadline should return 409, got ${staleJoin.status}.`);
    const staleJoinPayload = await staleJoin.json();
    assert(
      /visit deadline|closed/i.test(String(staleJoinPayload.error || "")),
      "Join rejection for a past visit deadline should mention that joins are closed."
    );

    const joinOne = await fetch(`${baseUrl}/api/campaigns/${freshCampaignId}/join`, {
      method: "POST",
      headers: { Cookie: influencerCookie.split(";")[0], Origin: baseUrl },
      body: JSON.stringify({}),
    });
    assert(joinOne.ok, `Influencer join failed with status ${joinOne.status}.`);
    const joinOnePayload = await joinOne.json();
    assert(joinOnePayload.ok === true, "Successful join should return ok=true.");
    assert(Number.isInteger(joinOnePayload.participantId) && joinOnePayload.participantId > 0, "Successful join should return the new participantId.");

    const afterJoinOne = await fetch(`${baseUrl}/api/bootstrap`, {
      headers: { Cookie: influencerCookie.split(";")[0] },
    }).then((response) => response.json());
    const firstParticipant = afterJoinOne.participants.find((participant) => participant.campaignId === freshCampaignId && participant.status === "confirmed");
    assert(firstParticipant, "Expected a confirmed participant after joining.");
    assert(firstParticipant.id === joinOnePayload.participantId, "Join response participantId should match the confirmed participant row.");
    assert(firstParticipant.assignedCodeId, "Expected the first join to reserve a code.");

    const femaleTwoLogin = await fetch(`${baseUrl}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: baseUrl },
      body: JSON.stringify({ email: freshUsers[2].email, password: "PickSmoke1" }),
    });
    assert(femaleTwoLogin.ok, `Second female influencer login failed with status ${femaleTwoLogin.status}.`);
    const femaleTwoCookie = femaleTwoLogin.headers.get("set-cookie");
    const cappedJoin = await fetch(`${baseUrl}/api/campaigns/${freshCampaignId}/join`, {
      method: "POST",
      headers: { Cookie: femaleTwoCookie.split(";")[0], Origin: baseUrl },
      body: JSON.stringify({}),
    });
    assert(cappedJoin.status === 409, `Participant cap should reject second eligible join with 409, got ${cappedJoin.status}.`);

    const selfCancel = await fetch(`${baseUrl}/api/participants/${firstParticipant.id}/cancel`, {
      method: "POST",
      headers: { Cookie: influencerCookie.split(";")[0], Origin: baseUrl },
      body: JSON.stringify({}),
    });
    assert(selfCancel.ok, `Self-cancel failed with status ${selfCancel.status}.`);

    const afterCancelStore = JSON.parse(await fs.readFile(storePath, "utf8"));
    const releasedCode = afterCancelStore.campaignCodes.find((code) => code.id === firstParticipant.assignedCodeId);
    const canceledParticipant = afterCancelStore.participants.find((participant) => participant.id === firstParticipant.id);
    assert(releasedCode?.status === "available", "Self-cancel should release the reserved code back to available.");
    assert(canceledParticipant?.status === "canceled", "Self-cancel should mark the participant as canceled.");

    const joinTwo = await fetch(`${baseUrl}/api/campaigns/${freshCampaignId}/join`, {
      method: "POST",
      headers: { Cookie: influencerCookie.split(";")[0], Origin: baseUrl },
      body: JSON.stringify({}),
    });
    assert(joinTwo.ok, `Second join failed with status ${joinTwo.status}.`);
    const joinTwoPayload = await joinTwo.json();
    assert(joinTwoPayload.ok === true, "Rejoin should return ok=true.");
    assert(Number.isInteger(joinTwoPayload.participantId) && joinTwoPayload.participantId > 0, "Rejoin should return the new participantId.");

    const afterJoinTwo = await fetch(`${baseUrl}/api/bootstrap`, {
      headers: { Cookie: influencerCookie.split(";")[0] },
    }).then((response) => response.json());
    const activeParticipant = afterJoinTwo.participants.find((participant) => participant.campaignId === freshCampaignId && participant.status === "confirmed");
    assert(activeParticipant, "Expected a new confirmed participant after rejoining.");
    assert(activeParticipant.id === joinTwoPayload.participantId, "Rejoin participantId should match the new confirmed participant.");
    assert(activeParticipant.campaignTitleEn, "Expected the participation row to include a campaign title for clickable campaign links.");
    const proofNotification = (afterJoinTwo.notifications || []).find((item) => item.id === "my-proof-1");
    assert(proofNotification?.title?.en && proofNotification?.title?.ar, "Notifications should expose bilingual titles.");
    assert(proofNotification?.body?.en && proofNotification?.body?.ar, "Notifications should expose bilingual bodies.");

    const branchPage = await fetch(`${baseUrl}/branch`);
    assert(branchPage.status === 404, `Mothballed branch page should return 404, got ${branchPage.status}.`);

    const visitConfirm = await fetch(`${baseUrl}/api/visits/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "SMOKE-001", pin: "100001" }),
    });
    assert(visitConfirm.status === 404, `Mothballed visit confirm should return 404, got ${visitConfirm.status}.`);

    const duplicateCampaign = await fetch(`${baseUrl}/api/campaigns/${freshCampaignId}/duplicate`, {
      method: "POST",
      headers: {
        Cookie: cookie.split(";")[0],
        Origin: baseUrl,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    assert(duplicateCampaign.status === 201, `Campaign duplicate should return 201, got ${duplicateCampaign.status}.`);
    const duplicatePayload = await duplicateCampaign.json();
    assert(duplicatePayload.campaign.status === "draft", "Duplicated campaign should be created as draft.");
    assert(!duplicatePayload.campaign.startDate, "Duplicated campaign should clear start date.");
    assert(!duplicatePayload.campaign.endDate, "Duplicated campaign should clear end date.");
    assert(!duplicatePayload.campaign.visitDeadline, "Duplicated campaign should clear visit deadline.");
    assert(!duplicatePayload.campaign.submissionDeadline, "Duplicated campaign should clear submission deadline.");

    const proofForm = new FormData();
    proofForm.append("socialLink", "https://instagram.com/p/smoke-proof");
    proofForm.append("feedback", "Smoke proof with two images.");
    proofForm.append("platform", "Instagram");
    proofForm.append("image1", new Blob([tinyPngBuffer()], { type: "image/png" }), "proof-1.png");
    proofForm.append("image2", new Blob([tinyPngBuffer()], { type: "image/png" }), "proof-2.png");
    const proofSubmit = await fetch(`${baseUrl}/api/participants/${activeParticipant.id}/submission`, {
      method: "POST",
      headers: {
        Cookie: influencerCookie.split(";")[0],
        Origin: baseUrl,
      },
      body: proofForm,
    });
    assert(proofSubmit.ok, `Proof submission failed with status ${proofSubmit.status}.`);

    const finalStore = JSON.parse(await fs.readFile(storePath, "utf8"));
    const submittedParticipant = finalStore.participants.find((participant) => participant.id === activeParticipant.id);
    assert(submittedParticipant?.status === "submitted", "Participant should be submitted after proof upload.");
    assert((submittedParticipant?.images || []).length === 2, "Proof submission should persist two images.");
    assert(submittedParticipant?.imagePath === submittedParticipant?.images?.[0]?.path, "Legacy primary image path should match the first image.");
    assert(submittedParticipant?.imageName === submittedParticipant?.images?.[0]?.name, "Legacy primary image name should match the first image.");

    const exportResponse = await fetch(`${baseUrl}/api/reports/export.csv?tab=campaigns`, {
      headers: { Cookie: cookie.split(";")[0] },
    });
    assert(exportResponse.ok, `Campaign CSV export failed with status ${exportResponse.status}.`);
    assert(
      String(exportResponse.headers.get("content-type") || "").includes("text/csv"),
      "Campaign CSV export should return text/csv."
    );
    const exportBody = await exportResponse.text();
    assert(
      exportBody.includes("Campaign ID,Campaign title (EN),Campaign title (AR),Caption guide,WhatsApp message,Status"),
      "Campaign CSV export should include the expected header columns."
    );

    const scopedSubmissionsExport = await fetch(`${baseUrl}/api/reports/export.csv?tab=submissions&campaignId=${freshCampaignId}`, {
      headers: { Cookie: cookie.split(";")[0] },
    });
    assert(scopedSubmissionsExport.ok, `Scoped submissions CSV export failed with status ${scopedSubmissionsExport.status}.`);
    assert(
      String(scopedSubmissionsExport.headers.get("content-type") || "").includes("text/csv"),
      "Scoped submissions CSV export should return text/csv."
    );
    assert(
      String(scopedSubmissionsExport.headers.get("content-disposition") || "").includes(`pick-submissions-campaign-${freshCampaignId}.csv`),
      "Scoped submissions CSV export should include the campaign-specific filename."
    );
    const scopedSubmissionsBody = await scopedSubmissionsExport.text();
    assert(
      scopedSubmissionsBody.includes("Smoke Hermetic Campaign"),
      "Scoped submissions CSV export should include the smoke campaign rows."
    );

    const allSubmissionsExport = await fetch(`${baseUrl}/api/reports/export.csv?tab=submissions`, {
      headers: { Cookie: cookie.split(";")[0] },
    });
    assert(allSubmissionsExport.ok, `All submissions CSV export failed with status ${allSubmissionsExport.status}.`);
    const allSubmissionsBody = await allSubmissionsExport.text();
    assert(
      allSubmissionsBody.includes("Participant ID,Campaign title (EN),Campaign title (AR),Influencer,Status,Platform,Social link,Feedback,Has image,Submitted at"),
      "All submissions CSV export should keep the report-wide submissions header."
    );
    assert(
      allSubmissionsBody.includes("Smoke Hermetic Campaign"),
      "All submissions CSV export should still include the smoke campaign rows without a campaign filter."
    );

    const finalBootstrap = await fetch(`${baseUrl}/api/bootstrap`, {
      headers: { Cookie: cookie.split(";")[0] },
    }).then((response) => response.json());
    assert(
      (finalBootstrap.auditEvents || []).some((event) => event.action === "participant.submission" && Number(event.targetId) === activeParticipant.id),
      "Admin bootstrap should include the participant submission audit event."
    );

    console.log("Smoke test passed.");
    process.exitCode = 0;
  } finally {
    child.kill("SIGTERM");
    await new Promise((resolve) => child.once("exit", resolve));
    if (process.exitCode && stderr) {
      console.error(stderr.trim());
    }
  }
}

run().catch((error) => {
  console.error(`Smoke test failed: ${error.message}`);
  process.exitCode = 1;
});
