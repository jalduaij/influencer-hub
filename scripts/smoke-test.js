const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

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

async function run() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "pick-smoke-"));
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

  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  try {
    await waitForHealth(baseUrl);

    const health = await fetch(`${baseUrl}/health`).then((response) => response.json());
    assert(health.ok, "Health endpoint did not return ok.");

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
    assert(
      influencerBootstrap.eligibleCampaignIds?.includes(freshCampaignId),
      "Expected the fresh female influencer to be eligible for the fresh campaign."
    );

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

    const joinOne = await fetch(`${baseUrl}/api/campaigns/${freshCampaignId}/join`, {
      method: "POST",
      headers: { Cookie: influencerCookie.split(";")[0], Origin: baseUrl },
      body: JSON.stringify({}),
    });
    assert(joinOne.ok, `Influencer join failed with status ${joinOne.status}.`);

    const afterJoinOne = await fetch(`${baseUrl}/api/bootstrap`, {
      headers: { Cookie: influencerCookie.split(";")[0] },
    }).then((response) => response.json());
    const firstParticipant = afterJoinOne.participants.find((participant) => participant.campaignId === freshCampaignId && participant.status === "confirmed");
    assert(firstParticipant, "Expected a confirmed participant after joining.");
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

    const afterJoinTwo = await fetch(`${baseUrl}/api/bootstrap`, {
      headers: { Cookie: influencerCookie.split(";")[0] },
    }).then((response) => response.json());
    const activeParticipant = afterJoinTwo.participants.find((participant) => participant.campaignId === freshCampaignId && participant.status === "confirmed");
    assert(activeParticipant, "Expected a new confirmed participant after rejoining.");
    assert(activeParticipant.campaignTitleEn, "Expected the participation row to include a campaign title for clickable campaign links.");
    const visitNotification = (afterJoinTwo.notifications || []).find((item) => item.id === "my-visit-1");
    assert(visitNotification?.title?.en && visitNotification?.title?.ar, "Notifications should expose bilingual titles.");
    assert(visitNotification?.body?.en && visitNotification?.body?.ar, "Notifications should expose bilingual bodies.");
    const storeAfterRejoin = JSON.parse(await fs.readFile(storePath, "utf8"));
    const campaign = storeAfterRejoin.campaigns.find((item) => item.id === freshCampaignId);
    const branchId = campaign.branchMode === "all" ? storeAfterRejoin.branches[0].id : campaign.branchIds[0];
    const branch = storeAfterRejoin.branches.find((item) => item.id === branchId);
    assert(branch?.pin, "Expected a branch PIN for cashier confirmation.");
    const assignedCode = storeAfterRejoin.campaignCodes.find((code) => code.id === activeParticipant.assignedCodeId);
    assert(assignedCode?.codeValue, "Expected an assigned code for cashier confirmation.");

    const visitConfirm = await fetch(`${baseUrl}/api/visits/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: assignedCode.codeValue, pin: branch.pin }),
    });
    assert(visitConfirm.ok, `Visit confirm failed with status ${visitConfirm.status}.`);

    const visitPayload = await visitConfirm.json();
    assert(visitPayload.receipt?.codeValue === assignedCode.codeValue, "Visit receipt should echo the confirmed code.");

    const doubleUse = await fetch(`${baseUrl}/api/visits/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: assignedCode.codeValue, pin: branch.pin }),
    });
    assert(doubleUse.status === 409, `Second visit confirm should be rejected with 409, got ${doubleUse.status}.`);

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
    assert(exportBody.includes("Campaign ID,Campaign title (EN),Campaign title (AR),Status"), "Campaign CSV export should include the expected header columns.");

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
