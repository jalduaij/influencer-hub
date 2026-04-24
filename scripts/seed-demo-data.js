const fs = require("node:fs");
const path = require("node:path");

const STORE_PATH = path.join(__dirname, "..", "data", "store.json");

const cityNameById = {
  1: "Kuwait City",
  2: "Hawally",
  3: "Salmiya",
  4: "Farwaniya",
  5: "Zahra",
};

const categoryNameById = {
  1: "Leadership",
  2: "Food & Beverage",
  3: "Foodie",
  4: "Lifestyle",
};

const platformCycle = ["Instagram", "TikTok", "Snapchat", "YouTube", "X"];

const feedbackSamples = [
  "The branch team handled the visit smoothly and the menu item was easy to explain in the post.",
  "Strong presentation and easy redemption flow. The campaign instructions were clear from the start.",
  "The product felt premium and the branch setup made content capture straightforward.",
  "Good overall experience. Timing at the branch worked well and the posting brief was easy to follow.",
  "Content capture was smooth and the offer felt valuable enough to mention naturally in the caption.",
  "The visit was quick, organized, and easy to convert into a social post with feedback.",
];

const offlineNames = [
  "Mariam",
  "Bader",
  "Salem",
  "Hessa",
  "Yousef",
  "Alya",
  "Faisal",
  "Noora",
  "Rashed",
  "Latifa",
  "Hamad",
  "Deema",
];

const generatedInfluencers = [
  ["Reem Coffee Notes", "reem.coffee", 2, 3, ["vip", "coffee-lovers"]],
  ["Fahad Food Diary", "fahad.food", 4, 3, ["vip"]],
  ["Sara Matcha Mood", "sara.matcha", 2, 3, ["coffee-lovers"]],
  ["Noura Bites Q8", "noura.bites", 4, 3, ["fewe"]],
  ["Yousef Cafe Radar", "yousef.radar", 2, 3, ["vip", "fewe"]],
  ["Dana Weekend Eats", "dana.eats", 4, 3, []],
  ["Abdulrahman Snack Map", "abdulrahman.snacks", 2, 3, ["vip"]],
  ["Rana Dessert Edit", "rana.dessert", 4, 3, ["fewe"]],
  ["Hamad Latte Log", "hamad.latte", 2, 3, ["coffee-lovers"]],
  ["Fatima Food Scene", "fatima.scene", 4, 3, ["vip"]],
  ["Meshari Brunch Lens", "meshari.brunch", 2, 3, []],
  ["Ascia Cravings", "ascia.cravings", 4, 3, ["fewe"]],
  ["Mubarak Taste Trail", "mubarak.trail", 2, 3, ["vip"]],
  ["Lulwa Kitchen Route", "lulwa.route", 4, 3, []],
  ["Hessa Lifestyle Edit", "hessa.life", 1, 4, ["vip"]],
  ["Dalal Daily Pick", "dalal.daily", 3, 4, ["fewe"]],
  ["Mona Weekend Looks", "mona.looks", 1, 4, []],
  ["Fajer Salmiya Stories", "fajer.stories", 3, 4, ["vip"]],
  ["Abeer City Mood", "abeer.city", 1, 4, []],
  ["Shahad Home And Out", "shahad.home", 3, 4, ["fewe"]],
  ["Dana Lifestyle Frame", "dana.frame", 1, 4, ["vip"]],
  ["Rawan Soft Weekend", "rawan.soft", 3, 4, []],
  ["Raghad Sunday Notes", "raghad.notes", 1, 4, []],
  ["Jawaher Pick Moments", "jawaher.pick", 3, 4, ["vip", "fewe"]],
  ["Bibi City Diary", "bibi.diary", 1, 4, []],
  ["Omar Quick Bites", "omar.quick", 1, 3, []],
  ["Lama Cafe Roundup", "lama.roundup", 5, 3, ["fewe"]],
  ["Nasser Food Radar", "nasser.radar", 1, 3, ["vip"]],
  ["Hind Brunch Notes", "hind.notes", 5, 3, []],
  ["Tareq Flavor Walk", "tareq.walk", 1, 3, ["fewe"]],
  ["Basma Soft Launches", "basma.launch", 5, 4, []],
  ["Rashed City Check", "rashed.check", 5, 4, []],
  ["Maha Mini Reviews", "maha.mini", 2, 3, ["vip"]],
  ["Latifa Brand Visits", "latifa.brand", 3, 4, ["vip"]],
  ["Shoug Simple Guide", "shoug.guide", 1, 4, ["fewe"]],
];

function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function pickPlatform(index) {
  return platformCycle[index % platformCycle.length];
}

function followerPack(index) {
  return {
    instagram: 4200 + index * 310,
    tiktok: 2600 + index * 270,
    snapchat: 1800 + index * 150,
  };
}

function isoAt(date, hour) {
  return `${date}T${String(hour).padStart(2, "0")}:00:00.000Z`;
}

function daysAfter(date, amount) {
  const base = new Date(`${date}T00:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + amount);
  return base.toISOString().slice(0, 10);
}

function socialLink(platform, handle, index) {
  const clean = handle.replace(/^@/, "");
  if (platform === "TikTok") return `https://www.tiktok.com/@${clean}/video/770000000000${index}`;
  if (platform === "Snapchat") return `https://www.snapchat.com/add/${clean}`;
  if (platform === "YouTube") return `https://www.youtube.com/watch?v=pickdemo${index}`;
  if (platform === "X") return `https://x.com/${clean}/status/190000000000${index}`;
  return `https://www.instagram.com/p/PICKDEMO${index}/`;
}

function makeInfluencer(id, fullName, handleBase, cityId, categoryId, tags, index, status = "active", overrides = {}) {
  const platform = pickPlatform(index);
  const instagram = `@${handleBase}`;
  const tiktok = `@${handleBase}${index}`;
  const snapchat = `${handleBase}.snap`;
  return {
    id,
    role: "influencer",
    fullName,
    email: `${slug(handleBase)}@example.com`,
    password: "pick123",
    status,
    mobile: `9000${String(id).padStart(4, "0")}`,
    gender: "",
    dateOfBirth: "",
    cityId,
    categoryId,
    city: cityNameById[cityId] || "",
    category: categoryNameById[categoryId] || "",
    preferredLanguage: index % 2 === 0 ? "en" : "ar",
    instagram,
    tiktok,
    snapchat,
    followers: followerPack(index),
    preferredPlatform: platform,
    tags,
    notes: [],
    avatarName: "",
    avatarPath: "",
    createdAt: "2026-04-20T15:41:02.308Z",
    lastLogin: "",
    approvedByUserId: status === "active" ? 2 : null,
    passwordResetMode: "",
    ...overrides,
  };
}

function chooseBranch(campaign, cycle) {
  const allowed = campaign.branchMode === "all" || !campaign.branchIds.length ? [1, 2, 3] : campaign.branchIds;
  return allowed[cycle % allowed.length];
}

function createPlatformParticipant({ participantId, campaign, influencer, status, codeId, joinDate, submitOffsetDays, cycle }) {
  const submitted = status === "submitted" || status === "completed";
  const platform = submitted ? influencer.preferredPlatform || pickPlatform(cycle) : "";
  const submittedAt = submitted ? isoAt(daysAfter(joinDate, submitOffsetDays), 13 + (cycle % 5)) : null;
  return {
    id: participantId,
    campaignId: campaign.id,
    influencerId: influencer.id,
    status,
    assignedCodeId: codeId,
    selectedBranchId: chooseBranch(campaign, cycle),
    selectedVisitDate: null,
    joinedAt: isoAt(joinDate, 10 + (cycle % 6)),
    visitedAt: null,
    submittedAt,
    completedAt: status === "completed" ? submittedAt : null,
    socialLink: submitted ? socialLink(platform, influencer.instagram || influencer.tiktok || influencer.snapchat || slug(influencer.fullName), participantId) : "",
    feedback: submitted ? feedbackSamples[cycle % feedbackSamples.length] : "",
    imageName: "",
    imagePath: "",
    platform,
    canceledReason: status === "canceled" ? "Campaign canceled or code blocked" : "",
    source: "platform",
    offlineName: "",
    offlineMobile: "",
    offlineNotes: "",
  };
}

function createOfflineParticipant({ participantId, campaign, codeId, joinDate, cycle }) {
  const name = `${offlineNames[cycle % offlineNames.length]} Offline`;
  return {
    id: participantId,
    campaignId: campaign.id,
    influencerId: null,
    status: "offline_reserved",
    assignedCodeId: codeId,
    selectedBranchId: chooseBranch(campaign, cycle),
    selectedVisitDate: null,
    joinedAt: isoAt(joinDate, 15 + (cycle % 4)),
    visitedAt: null,
    submittedAt: null,
    completedAt: null,
    socialLink: "",
    feedback: "",
    imageName: "",
    imagePath: "",
    platform: pickPlatform(cycle),
    canceledReason: "",
    source: "offline",
    offlineName: name,
    offlineMobile: `9555${String(participantId).padStart(4, "0")}`,
    offlineNotes: "Reserved manually by campaign manager for offline creator.",
  };
}

function main() {
  const store = JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
  const campaigns = store.campaigns.map((campaign) => ({ ...campaign }));
  const nonInfluencers = store.users.filter((user) => user.role !== "influencer");
  const existing = new Map(store.users.filter((user) => user.role === "influencer").map((user) => [user.id, user]));

  const influencers = [];

  influencers.push(
    makeInfluencer(3, "Laila Q8 Bites", "lailaq8bites", 2, 3, ["fewe", "coffee-lovers"], 1, "active", {
      email: "laila@example.com",
      avatarName: existing.get(3)?.avatarName || "",
      avatarPath: existing.get(3)?.avatarPath || "",
    }),
    makeInfluencer(4, "Maha Lifestyle", "mahalifestyle", 3, 4, ["vip"], 2, "active", {
      email: "maha@example.com",
    }),
    makeInfluencer(5, "Abdullah Reviews", "abdullahreviewz", 4, 3, ["vip"], 3, "active", {
      email: "abdullah@example.com",
    }),
    makeInfluencer(6, "Nada Test", "nada.test", 1, 4, ["fewe"], 4, "active", {
      email: "nada-test@example.com",
    }),
    makeInfluencer(8, "Jassem Alduaij", "jalduaij", 2, 3, ["vip"], 5, "active", {
      email: "test@kdigtc.com",
      password: existing.get(8)?.password || "pick123",
      mobile: "99760626",
    })
  );

  let nextUserId = 9;
  generatedInfluencers.forEach(([fullName, handleBase, cityId, categoryId, tags], index) => {
    let status = "active";
    if (index === generatedInfluencers.length - 1) status = "pending";
    if (index === generatedInfluencers.length - 2) status = "pending";
    if (index === generatedInfluencers.length - 3) status = "suspended";
    if (index === generatedInfluencers.length - 4) status = "suspended";
    influencers.push(makeInfluencer(nextUserId, fullName, handleBase, cityId, categoryId, tags, index + 6, status));
    nextUserId += 1;
  });

  const activeInfluencers = influencers.filter((user) => user.status === "active");
  const foodieHawallyFarwaniya = activeInfluencers.filter((user) => user.categoryId === 3 && [2, 4].includes(user.cityId));
  const foodieKuwaitHawally = activeInfluencers.filter((user) => user.categoryId === 3 && [1, 2].includes(user.cityId));
  const vipInfluencers = activeInfluencers.filter((user) => user.tags.includes("vip"));
  const lifestyleCity = activeInfluencers.filter((user) => user.categoryId === 4 && [1, 3].includes(user.cityId));
  const feweInfluencers = activeInfluencers.filter((user) => user.tags.includes("fewe"));

  const campaignPools = {
    201: { prefix: "CB-2026", total: 30 },
    202: { prefix: "PASTRY-2026", total: 18 },
    203: { prefix: "ICED-2026", total: 28 },
    204: { prefix: "LIFE-2026", total: 24 },
    205: { prefix: "DISC-2026", total: 26 },
  };

  let nextCodeId = 6001;
  let nextParticipantId = 9001;
  const campaignCodes = [];
  const participants = [];
  const codesByCampaign = new Map();

  for (const campaign of campaigns) {
    const pool = campaignPools[campaign.id];
    const codes = [];
    for (let index = 1; index <= pool.total; index += 1) {
      codes.push({
        id: nextCodeId++,
        campaignId: campaign.id,
        codeValue: `${pool.prefix}-${String(index).padStart(3, "0")}`,
        status: "available",
        uploadedByUserId: 2,
        reservedByParticipantId: null,
        uploadedAt: isoAt(campaign.createdAt.slice(0, 10), 12),
        reservedAt: null,
        usedAt: null,
        blockedAt: null,
        deletedAt: null,
        deletedBatchId: null,
        usageCount: campaign.offerUsageCount,
        offerText: campaign.offerDescription,
      });
    }
    campaignCodes.push(...codes);
    codesByCampaign.set(campaign.id, codes);
  }

  function reserveCode(campaignId) {
    const code = codesByCampaign.get(campaignId).find((item) => item.status === "available");
    if (!code) throw new Error(`No available code for campaign ${campaignId}`);
    return code;
  }

  function addPlatformParticipant(campaign, influencer, status, joinDate, submitOffsetDays, cycle, canceledReason = "") {
    const code = reserveCode(campaign.id);
    const participant = createPlatformParticipant({
      participantId: nextParticipantId++,
      campaign,
      influencer,
      status,
      codeId: code.id,
      joinDate,
      submitOffsetDays,
      cycle,
    });
    participant.canceledReason = canceledReason;
    if (status === "canceled") {
      code.status = "blocked";
      code.blockedAt = participant.joinedAt;
    } else {
      code.status = "reserved";
    }
    code.reservedByParticipantId = participant.id;
    code.reservedAt = participant.joinedAt;
    participants.push(participant);
  }

  function addOfflineParticipant(campaign, joinDate, cycle) {
    const code = reserveCode(campaign.id);
    const participant = createOfflineParticipant({
      participantId: nextParticipantId++,
      campaign,
      codeId: code.id,
      joinDate,
      cycle,
    });
    code.status = "reserved";
    code.reservedByParticipantId = participant.id;
    code.reservedAt = participant.joinedAt;
    participants.push(participant);
  }

  const campaign201 = campaigns.find((item) => item.id === 201);
  foodieHawallyFarwaniya.slice(0, 14).forEach((influencer, index) => {
    const status = index < 7 ? (index % 2 === 0 ? "submitted" : "completed") : index < 12 ? "confirmed" : "canceled";
    addPlatformParticipant(campaign201, influencer, status, "2026-04-22", 2 + (index % 4), index, status === "canceled" ? "Code blocked after schedule change" : "");
  });
  for (let i = 0; i < 4; i += 1) addOfflineParticipant(campaign201, "2026-04-23", i);

  const campaign202 = campaigns.find((item) => item.id === 202);
  foodieKuwaitHawally.slice(0, 8).forEach((influencer, index) => {
    addPlatformParticipant(campaign202, influencer, "canceled", "2026-04-22", 0, index + 20, "Campaign deactivated");
  });

  const campaign203 = campaigns.find((item) => item.id === 203);
  vipInfluencers.slice(0, 16).forEach((influencer, index) => {
    const status = index < 9 ? (index % 3 === 0 ? "completed" : "submitted") : index < 14 ? "confirmed" : "canceled";
    addPlatformParticipant(campaign203, influencer, status, "2026-04-22", 2 + (index % 5), index + 40, status === "canceled" ? "Reservation removed by manager" : "");
  });
  for (let i = 0; i < 3; i += 1) addOfflineParticipant(campaign203, "2026-04-24", i + 10);

  const campaign204 = campaigns.find((item) => item.id === 204);
  lifestyleCity.slice(0, 11).forEach((influencer, index) => {
    const status = index < 6 ? (index % 2 === 0 ? "submitted" : "completed") : index < 10 ? "confirmed" : "canceled";
    addPlatformParticipant(campaign204, influencer, status, "2026-04-23", 1 + (index % 4), index + 60, status === "canceled" ? "Branch capacity changed" : "");
  });
  for (let i = 0; i < 2; i += 1) addOfflineParticipant(campaign204, "2026-04-24", i + 20);

  const campaign205 = campaigns.find((item) => item.id === 205);
  feweInfluencers.slice(0, 10).forEach((influencer, index) => {
    const status = index < 5 ? (index % 2 === 0 ? "submitted" : "completed") : index < 8 ? "confirmed" : "canceled";
    addPlatformParticipant(campaign205, influencer, status, "2026-04-24", 2 + (index % 3), index + 80, status === "canceled" ? "Creator dropped from shortlist" : "");
  });
  for (let i = 0; i < 4; i += 1) addOfflineParticipant(campaign205, "2026-04-25", i + 30);

  store.users = [...nonInfluencers, ...influencers];
  store.campaignCodes = campaignCodes;
  store.participants = participants;
  store.passwordResets = [];
  store.nextIds = {
    ...store.nextIds,
    user: nextUserId,
    code: nextCodeId,
    participant: nextParticipantId,
  };

  fs.writeFileSync(STORE_PATH, `${JSON.stringify(store, null, 2)}\n`);

  const activeCount = influencers.filter((user) => user.status === "active").length;
  const submittedCount = participants.filter((row) => ["submitted", "completed"].includes(row.status)).length;
  const confirmedCount = participants.filter((row) => row.status === "confirmed").length;
  const canceledCount = participants.filter((row) => row.status === "canceled").length;
  const offlineCount = participants.filter((row) => row.source === "offline").length;

  console.log(`Seeded ${influencers.length} influencers (${activeCount} active)`);
  console.log(`Seeded ${campaignCodes.length} codes across ${campaigns.length} campaigns`);
  console.log(`Seeded ${participants.length} participations`);
  console.log(`Submitted/completed: ${submittedCount}, pending proof: ${confirmedCount}, canceled: ${canceledCount}, offline reserved: ${offlineCount}`);
}

main();
