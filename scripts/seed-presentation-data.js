const fs = require("node:fs");
const path = require("node:path");

const STORE_PATH = path.join(__dirname, "..", "data", "store.json");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function iso(value) {
  return `${value}.000Z`;
}

function code(id, campaignId, codeValue, status, participantId = null, uploadedByUserId = 2, reservedAt = null, blockedAt = null) {
  return {
    id,
    campaignId,
    codeValue,
    status,
    uploadedByUserId,
    reservedByParticipantId: participantId,
    uploadedAt: iso("2026-04-20T12:00:00"),
    reservedAt,
    usedAt: null,
    blockedAt,
    deletedAt: null,
    deletedBatchId: null,
    usageCount: 1,
    offerText: "",
  };
}

function participant({
  id,
  campaignId,
  influencerId = null,
  status,
  assignedCodeId,
  joinedAt,
  submittedAt = null,
  completedAt = null,
  socialLink = "",
  feedback = "",
  imageName = "",
  imagePath = "",
  platform = "",
  canceledReason = "",
  source = "platform",
  offlineName = "",
  offlineMobile = "",
  offlineNotes = "",
  selectedBranchId = 1,
}) {
  return {
    id,
    campaignId,
    influencerId,
    status,
    assignedCodeId,
    selectedBranchId,
    selectedVisitDate: null,
    joinedAt,
    visitedAt: null,
    submittedAt,
    completedAt,
    socialLink,
    feedback,
    imageName,
    imagePath,
    platform,
    canceledReason,
    source,
    offlineName,
    offlineMobile,
    offlineNotes,
  };
}

function influencer({
  id,
  fullName,
  email,
  mobile,
  gender,
  cityId,
  city,
  categoryId,
  category,
  preferredLanguage,
  instagram,
  tiktok,
  snapchat,
  followers,
  preferredPlatform,
  tags,
  approvedByUserId,
  createdAt,
}) {
  return {
    id,
    role: "influencer",
    fullName,
    email,
    password: "pick123",
    status: "active",
    mobile,
    gender,
    dateOfBirth: "",
    cityId,
    categoryId,
    city,
    category,
    preferredLanguage,
    instagram,
    tiktok,
    snapchat,
    followers,
    preferredPlatform,
    tags,
    notes: [],
    avatarName: "",
    avatarPath: "",
    createdAt,
    lastLogin: "",
    approvedByUserId,
    passwordResetMode: "",
  };
}

function main() {
  const current = JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));

  const keepUserIds = new Set([1, 2, 7, 3, 4, 5, 42]);
  const keepCampaignIds = new Set([201, 202, 203, 204, 205]);

  const users = current.users.filter((user) => keepUserIds.has(user.id)).map((user) => clone(user));
  const campaigns = current.campaigns.filter((campaign) => keepCampaignIds.has(campaign.id)).map((campaign) => clone(campaign));

  const userById = new Map(users.map((user) => [user.id, user]));
  const campaignById = new Map(campaigns.map((campaign) => [campaign.id, campaign]));

  Object.assign(userById.get(1), {
    mobile: "",
    gender: "",
  });
  Object.assign(userById.get(2), {
    mobile: "",
    gender: "",
  });
  Object.assign(userById.get(7), {
    mobile: "+96599760626",
    gender: "",
  });
  Object.assign(userById.get(3), {
    mobile: "+96590000003",
    gender: "female",
    cityId: 2,
    city: "Hawally",
    categoryId: 3,
    category: "Foodie",
    instagram: "@pick",
    tags: ["fewe", "coffee-lovers"],
    preferredPlatform: "TikTok",
    status: "active",
  });
  Object.assign(userById.get(4), {
    mobile: "+96590000004",
    gender: "female",
    cityId: 3,
    city: "Salmiya",
    categoryId: 4,
    category: "Lifestyle",
    instagram: "@mahalifestyle",
    tags: ["vip-2"],
    preferredPlatform: "Snapchat",
    status: "active",
  });
  Object.assign(userById.get(5), {
    mobile: "+96590000005",
    gender: "male",
    cityId: 4,
    city: "Farwaniya",
    categoryId: 3,
    category: "Foodie",
    instagram: "@abdullahreviewz",
    tags: ["vip-2"],
    preferredPlatform: "YouTube",
    status: "active",
  });
  Object.assign(userById.get(42), {
    mobile: "+96590000042",
    gender: "female",
    cityId: 3,
    city: "Salmiya",
    categoryId: 4,
    category: "Lifestyle",
    instagram: "@latifa.brand",
    tags: ["vip-2"],
    status: "pending",
    approvedByUserId: null,
  });

  users.push(
    influencer({
      id: 43,
      fullName: "Nouf Coffee Diary",
      email: "nouf@example.com",
      mobile: "+96590000043",
      gender: "female",
      cityId: 2,
      city: "Hawally",
      categoryId: 3,
      category: "Foodie",
      preferredLanguage: "ar",
      instagram: "@noufcoffeediary",
      tiktok: "@noufcoffeediary",
      snapchat: "noufcoffee.snap",
      followers: { instagram: 3980, tiktok: 2610, snapchat: 1840 },
      preferredPlatform: "Instagram",
      tags: ["coffee-lovers"],
      approvedByUserId: 2,
      createdAt: iso("2026-04-24T10:30:00"),
    }),
    influencer({
      id: 44,
      fullName: "Faisal Food Trails",
      email: "faisal@example.com",
      mobile: "+96590000044",
      gender: "male",
      cityId: 4,
      city: "Farwaniya",
      categoryId: 3,
      category: "Foodie",
      preferredLanguage: "en",
      instagram: "@faisalfoodtrails",
      tiktok: "@faisalfoodtrails",
      snapchat: "faisalfood.snap",
      followers: { instagram: 5220, tiktok: 3490, snapchat: 2100 },
      preferredPlatform: "TikTok",
      tags: ["vip-2"],
      approvedByUserId: 7,
      createdAt: iso("2026-04-24T11:00:00"),
    }),
    influencer({
      id: 45,
      fullName: "Dana Social Bites",
      email: "dana@example.com",
      mobile: "+96590000045",
      gender: "female",
      cityId: 3,
      city: "Salmiya",
      categoryId: 4,
      category: "Lifestyle",
      preferredLanguage: "en",
      instagram: "@danasocialbites",
      tiktok: "@danasocialbites",
      snapchat: "danasocial.snap",
      followers: { instagram: 4670, tiktok: 2880, snapchat: 2340 },
      preferredPlatform: "Snapchat",
      tags: ["vip-2"],
      approvedByUserId: 2,
      createdAt: iso("2026-04-24T11:20:00"),
    })
  );

  Object.assign(campaignById.get(201), {
    status: "live",
    updatedAt: iso("2026-04-24T09:00:00"),
    updatedBy: 2,
  });
  Object.assign(campaignById.get(202), {
    status: "deactivated",
    updatedAt: iso("2026-04-24T09:00:00"),
    updatedBy: 2,
  });
  Object.assign(campaignById.get(203), {
    status: "live",
    updatedAt: iso("2026-04-24T09:00:00"),
    updatedBy: 7,
  });
  Object.assign(campaignById.get(204), {
    status: "completed",
    updatedAt: iso("2026-04-24T09:00:00"),
    updatedBy: 2,
  });
  Object.assign(campaignById.get(205), {
    status: "draft",
    updatedAt: iso("2026-04-24T09:00:00"),
    updatedBy: 2,
  });

  const codes = [
    code(6001, 201, "CB-2026-001", "reserved", 9001, 2, iso("2026-04-22T10:00:00")),
    code(6002, 201, "CB-2026-002", "reserved", 9002, 2, iso("2026-04-22T11:00:00")),
    code(6003, 201, "CB-2026-003", "reserved", 9003, 2, iso("2026-04-22T12:00:00")),
    code(6004, 201, "CB-2026-004", "available"),
    code(6005, 201, "CB-2026-005", "available"),

    code(6011, 203, "IC-2026-001", "reserved", 9011, 7, iso("2026-04-23T10:00:00")),
    code(6012, 203, "IC-2026-002", "reserved", 9012, 7, iso("2026-04-23T11:00:00")),
    code(6013, 203, "IC-2026-003", "available"),
    code(6014, 203, "IC-2026-004", "available"),
    code(6015, 203, "IC-2026-005", "available"),

    code(6021, 204, "LW-2026-001", "reserved", 9021, 2, iso("2026-04-21T10:00:00")),
    code(6022, 204, "LW-2026-002", "available"),
    code(6023, 204, "LW-2026-003", "available"),

    code(6031, 202, "SP-2026-001", "blocked", 9031, 2, iso("2026-04-21T09:30:00"), iso("2026-04-24T08:30:00")),
    code(6032, 202, "SP-2026-002", "blocked", null, 2, null, iso("2026-04-24T08:30:00")),
    code(6033, 202, "SP-2026-003", "available"),

    code(6041, 205, "DW-2026-001", "available"),
    code(6042, 205, "DW-2026-002", "available"),
    code(6043, 205, "DW-2026-003", "available"),
  ];

  for (const item of codes) {
    const campaign = campaignById.get(item.campaignId);
    item.usageCount = campaign.offerUsageCount || 1;
    item.offerText = campaign.offerDescription || "";
  }

  const participants = [
    participant({
      id: 9001,
      campaignId: 201,
      influencerId: 3,
      status: "submitted",
      assignedCodeId: 6001,
      joinedAt: iso("2026-04-22T10:00:00"),
      submittedAt: iso("2026-04-24T13:00:00"),
      socialLink: "https://www.tiktok.com/@lailaq8bites/video/7700000000009001",
      feedback: "Great branch experience and the code was easy to redeem. Content capture was simple.",
      platform: "TikTok",
      selectedBranchId: 1,
    }),
    participant({
      id: 9002,
      campaignId: 201,
      influencerId: 5,
      status: "confirmed",
      assignedCodeId: 6002,
      joinedAt: iso("2026-04-22T11:00:00"),
      platform: "",
      selectedBranchId: 2,
    }),
    participant({
      id: 9003,
      campaignId: 201,
      status: "offline_reserved",
      influencerId: null,
      assignedCodeId: 6003,
      joinedAt: iso("2026-04-22T12:00:00"),
      source: "offline",
      platform: "Instagram",
      offlineName: "Mariam Offline",
      offlineMobile: "+96595559003",
      offlineNotes: "Reserved manually by campaign manager for an offline creator.",
      selectedBranchId: 3,
    }),
    participant({
      id: 9011,
      campaignId: 203,
      influencerId: 4,
      status: "confirmed",
      assignedCodeId: 6011,
      joinedAt: iso("2026-04-23T10:00:00"),
      selectedBranchId: 1,
    }),
    participant({
      id: 9012,
      campaignId: 203,
      influencerId: 5,
      status: "submitted",
      assignedCodeId: 6012,
      joinedAt: iso("2026-04-23T11:00:00"),
      submittedAt: iso("2026-04-24T15:00:00"),
      socialLink: "https://www.youtube.com/watch?v=pickdemo9012",
      feedback: "The offer felt valuable and easy to include naturally in the post.",
      platform: "YouTube",
      selectedBranchId: 3,
    }),
    participant({
      id: 9021,
      campaignId: 204,
      influencerId: 4,
      status: "completed",
      assignedCodeId: 6021,
      joinedAt: iso("2026-04-21T10:00:00"),
      submittedAt: iso("2026-04-23T12:30:00"),
      completedAt: iso("2026-04-23T12:30:00"),
      socialLink: "https://www.instagram.com/p/PICKDEMO9021/",
      feedback: "Well-organized visit and easy to turn into a lifestyle post.",
      platform: "Instagram",
      selectedBranchId: 2,
    }),
    participant({
      id: 9031,
      campaignId: 202,
      influencerId: 3,
      status: "canceled",
      assignedCodeId: 6031,
      joinedAt: iso("2026-04-21T09:30:00"),
      canceledReason: "Campaign deactivated",
      selectedBranchId: 1,
    }),
  ];

  const nextIds = {
    campaign: 206,
    code: 6044,
    participant: 9032,
    user: 46,
    branch: current.nextIds.branch,
    city: current.nextIds.city,
    category: current.nextIds.category,
    passwordReset: 1,
    platform: current.nextIds.platform,
    tag: current.nextIds.tag,
    auditEvent: current.nextIds.auditEvent,
  };

  const cleanStore = {
    nextIds,
    users,
    campaigns,
    branches: clone(current.branches),
    campaignCodes: codes,
    participants,
    passwordResets: [],
    cities: clone(current.cities),
    categories: clone(current.categories),
    platforms: clone(current.platforms),
    tags: clone(current.tags),
  };

  fs.writeFileSync(STORE_PATH, JSON.stringify(cleanStore, null, 2));
  console.log(
    JSON.stringify(
      {
        ok: true,
        users: cleanStore.users.length,
        campaigns: cleanStore.campaigns.length,
        codes: cleanStore.campaignCodes.length,
        participants: cleanStore.participants.length,
      },
      null,
      2
    )
  );
}

main();
