const path = require("node:path");

const PROTECTED_EMAILS = ["sara@pick.internal", "nasser@pick.internal", "jalduaij@kdigtc.com"];
const UAT_RESET_CONFIRM = "yes-overwrite-staging";

const CITY_DEFS = [
  { id: 1, nameEn: "Kuwait City", nameAr: "مدينة الكويت" },
  { id: 2, nameEn: "Hawalli", nameAr: "حولي" },
  { id: 3, nameEn: "Salmiya", nameAr: "السالمية" },
  { id: 4, nameEn: "Jahra", nameAr: "الجهراء" },
  { id: 5, nameEn: "Mubarak Al-Kabeer", nameAr: "مبارك الكبير" },
  { id: 6, nameEn: "Farwaniya", nameAr: "الفروانية" },
];

const CATEGORY_DEFS = [
  { id: 1, nameEn: "Food", nameAr: "المأكولات" },
  { id: 2, nameEn: "Lifestyle", nameAr: "أسلوب الحياة" },
  { id: 3, nameEn: "Fashion", nameAr: "الأزياء" },
  { id: 4, nameEn: "Travel", nameAr: "السفر" },
  { id: 5, nameEn: "Beauty", nameAr: "الجمال" },
  { id: 6, nameEn: "Fitness", nameAr: "اللياقة" },
];

const PLATFORM_DEFS = [
  { id: 1, nameEn: "Instagram", nameAr: "إنستغرام" },
  { id: 2, nameEn: "TikTok", nameAr: "تيك توك" },
  { id: 3, nameEn: "Snapchat", nameAr: "سناب شات" },
  { id: 4, nameEn: "YouTube", nameAr: "يوتيوب" },
  { id: 5, nameEn: "X", nameAr: "إكس" },
];

const TAG_DEFS = [
  { id: 1, value: "vip" },
  { id: 2, value: "coffee-lovers" },
  { id: 3, value: "foodie" },
  { id: 4, value: "micro" },
  { id: 5, value: "macro" },
  { id: 6, value: "beauty" },
  { id: 7, value: "fitness" },
  { id: 8, value: "family" },
];

const BRANCH_DEFS = [
  {
    id: 1,
    nameEn: "PICK The Avenues",
    nameAr: "بك الأفنيوز",
    cityId: 1,
    city: "Kuwait City",
    pin: "100001",
    maxVisitsPerDay: 0,
  },
  {
    id: 2,
    nameEn: "PICK 360 Mall",
    nameAr: "بك 360 مول",
    cityId: 3,
    city: "Salmiya",
    pin: "100002",
    maxVisitsPerDay: 10,
  },
  {
    id: 3,
    nameEn: "PICK Al Kout",
    nameAr: "بك الكوت",
    cityId: 5,
    city: "Mubarak Al-Kabeer",
    pin: "100003",
    maxVisitsPerDay: 5,
  },
];

const UPLOAD_FILES = [
  "1776700047345-01a95a5a-IMG_4522.jpg",
  "1776700091113-c8487582-PHOTO-2026-04-12-12-35-24 3.jpg",
  "1776707740702-7c22857c-PHOTO-2026-04-12-12-35-24 4.jpg",
  "1776708011643-59e6f104-PHOTO-2026-04-12-12-35-25-2.jpg",
  "1776715547291-a468a54f-IMG_5042.jpg",
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function text(value) {
  return String(value || "").trim();
}

function normalizeSocialHandle(value) {
  let normalized = String(value || "").trim().toLowerCase();
  normalized = normalized.replace(/^https?:\/\//, "");
  normalized = normalized.replace(/^www\./, "");
  normalized = normalized.replace(/^(instagram\.com|tiktok\.com|snapchat\.com|youtube\.com|x\.com|twitter\.com)\//, "");
  normalized = normalized.split(/[/?#]/)[0];
  normalized = normalized.replace(/^@+/, "");
  return normalized;
}

function makeClock(options = {}) {
  const anchor = options.now ? new Date(options.now) : new Date();
  anchor.setUTCHours(12, 0, 0, 0);

  function dateString(offsetDays) {
    const date = new Date(anchor);
    date.setUTCDate(date.getUTCDate() + offsetDays);
    return date.toISOString().slice(0, 10);
  }

  function timestamp(offsetDays, hour = 9, minute = 0) {
    const date = new Date(anchor);
    date.setUTCDate(date.getUTCDate() + offsetDays);
    date.setUTCHours(hour, minute, 0, 0);
    return date.toISOString();
  }

  return { dateString, timestamp, now: anchor.toISOString() };
}

function followerSet(instagram = 0, tiktok = 0, snapchat = 0) {
  return { instagram, tiktok, snapchat };
}

function memberHandle(fullName) {
  const firstName = text(fullName).split(/\s+/)[0] || "member";
  return normalizeSocialHandle(`${firstName}_pick`);
}

function memberRecord(definition, helpers) {
  const handle = memberHandle(definition.fullName);
  return {
    id: definition.id,
    role: "influencer",
    fullName: definition.fullName,
    email: definition.email,
    password: "member123",
    status: definition.status,
    mobile: definition.mobile,
    gender: definition.gender,
    dateOfBirth: definition.dateOfBirth || "",
    cityId: definition.cityId,
    categoryId: definition.categoryId,
    city: helpers.cityName(definition.cityId),
    category: helpers.categoryName(definition.categoryId),
    preferredLanguage: definition.preferredLanguage || "en",
    instagram: definition.instagram === "" ? "" : normalizeSocialHandle(definition.instagram || handle),
    tiktok: normalizeSocialHandle(definition.tiktok || ""),
    snapchat: normalizeSocialHandle(definition.snapchat || ""),
    followers: followerSet(
      definition.followers?.instagram || 0,
      definition.followers?.tiktok || 0,
      definition.followers?.snapchat || 0
    ),
    preferredPlatform: definition.preferredPlatform || "",
    tags: [...(definition.tags || [])],
    notes: [...(definition.notes || [])],
    avatarName: "",
    avatarPath: "",
    createdAt: definition.createdAt,
    lastLogin: definition.lastLogin || "",
    approvedByUserId: definition.approvedByUserId ?? null,
    passwordResetMode: "",
  };
}

function buildSeedMembers(clock, helpers) {
  const definitions = [
    {
      id: 3,
      fullName: "Laila Q8 Bites",
      email: "laila@example.com",
      status: "active",
      cityId: 1,
      categoryId: 1,
      gender: "female",
      followers: followerSet(15000, 2000, 1200),
      tags: ["vip", "coffee-lovers", "foodie"],
      preferredPlatform: "Instagram",
      createdAt: clock.timestamp(-52, 9, 5),
      lastLogin: clock.timestamp(-1, 8, 10),
      approvedByUserId: 1,
    },
    {
      id: 4,
      fullName: "Omar City Notes",
      email: "omar@example.com",
      status: "active",
      cityId: 1,
      categoryId: 2,
      gender: "male",
      followers: followerSet(8000, 0, 1500),
      tags: ["micro"],
      preferredPlatform: "Instagram",
      createdAt: clock.timestamp(-44, 10, 15),
      lastLogin: clock.timestamp(-3, 12, 5),
      approvedByUserId: 2,
    },
    {
      id: 5,
      fullName: "Dana Glow Diary",
      email: "dana@example.com",
      status: "active",
      cityId: 1,
      categoryId: 5,
      gender: "female",
      followers: followerSet(40000, 5000, 2500),
      tags: ["vip", "beauty"],
      preferredPlatform: "Instagram",
      createdAt: clock.timestamp(-39, 11, 30),
      lastLogin: clock.timestamp(-2, 16, 40),
      approvedByUserId: 1,
    },
    {
      id: 6,
      fullName: "Maha Lifestyle",
      email: "maha@example.com",
      status: "active",
      cityId: 2,
      categoryId: 3,
      gender: "female",
      followers: followerSet(22000, 1200, 0),
      tags: ["vip", "macro"],
      preferredPlatform: "Instagram",
      createdAt: clock.timestamp(-35, 14, 45),
      lastLogin: clock.timestamp(-1, 10, 50),
      approvedByUserId: 2,
    },
    {
      id: 8,
      fullName: "Youssef Travel Logs",
      email: "youssef@example.com",
      status: "active",
      cityId: 2,
      categoryId: 4,
      gender: "male",
      followers: followerSet(12000, 0, 0),
      tags: ["family"],
      preferredPlatform: "Instagram",
      createdAt: clock.timestamp(-32, 9, 20),
      lastLogin: clock.timestamp(-5, 11, 10),
      approvedByUserId: 1,
    },
    {
      id: 9,
      fullName: "Rawan Daily Coffee",
      email: "rawan@example.com",
      status: "active",
      cityId: 2,
      categoryId: 1,
      gender: "female",
      followers: followerSet(3000, 0, 700),
      tags: ["coffee-lovers", "micro"],
      preferredPlatform: "Instagram",
      createdAt: clock.timestamp(-28, 10, 0),
      lastLogin: clock.timestamp(-4, 13, 25),
      approvedByUserId: 2,
    },
    {
      id: 10,
      fullName: "Huda Beauty Edit",
      email: "huda@example.com",
      status: "active",
      cityId: 3,
      categoryId: 5,
      gender: "female",
      followers: followerSet(55000, 6000, 3000),
      tags: ["beauty"],
      preferredPlatform: "Instagram",
      createdAt: clock.timestamp(-24, 15, 0),
      lastLogin: clock.timestamp(-1, 17, 15),
      approvedByUserId: 1,
    },
    {
      id: 11,
      fullName: "Abdullah Reviews",
      email: "abdullah@example.com",
      status: "active",
      cityId: 3,
      categoryId: 6,
      gender: "male",
      followers: followerSet(12000, 4000, 2000),
      tags: ["fitness"],
      preferredPlatform: "TikTok",
      createdAt: clock.timestamp(-22, 11, 55),
      lastLogin: clock.timestamp(-2, 9, 30),
      approvedByUserId: 2,
    },
    {
      id: 12,
      fullName: "Abeer Family Table",
      email: "abeer@example.com",
      status: "active",
      cityId: 5,
      categoryId: 2,
      gender: "female",
      followers: followerSet(9000, 1500, 3000),
      tags: ["family", "coffee-lovers"],
      preferredPlatform: "Snapchat",
      createdAt: clock.timestamp(-18, 8, 35),
      lastLogin: clock.timestamp(-3, 15, 45),
      approvedByUserId: 1,
    },
    {
      id: 13,
      fullName: "Faisal Food Trails",
      email: "faisal@example.com",
      status: "active",
      cityId: 5,
      categoryId: 1,
      gender: "male",
      followers: followerSet(30000, 2000, 0),
      tags: ["foodie"],
      preferredPlatform: "Instagram",
      createdAt: clock.timestamp(-16, 12, 45),
      lastLogin: clock.timestamp(-4, 8, 20),
      approvedByUserId: 2,
    },
    {
      id: 14,
      fullName: "Nouf Quiet Notes",
      email: "nouf@example.com",
      status: "active",
      cityId: 4,
      categoryId: 2,
      gender: "female",
      followers: followerSet(6000, 0, 0),
      tags: [],
      preferredPlatform: "Instagram",
      createdAt: clock.timestamp(-13, 9, 40),
      lastLogin: clock.timestamp(-6, 14, 30),
      approvedByUserId: 1,
    },
    {
      id: 15,
      fullName: "Bader Street Fits",
      email: "bader@example.com",
      status: "active",
      cityId: 6,
      categoryId: 3,
      gender: "male",
      followers: followerSet(0, 0, 0),
      tags: [],
      preferredPlatform: "TikTok",
      createdAt: clock.timestamp(-11, 10, 10),
      lastLogin: clock.timestamp(-7, 10, 5),
      approvedByUserId: 2,
    },
    {
      id: 16,
      fullName: "Latifa City Escapes",
      email: "latifa@example.com",
      status: "active",
      cityId: 1,
      categoryId: 4,
      gender: "female",
      followers: followerSet(26000, 4500, 1800),
      tags: ["coffee-lovers", "foodie"],
      preferredPlatform: "Instagram",
      createdAt: clock.timestamp(-8, 16, 0),
      lastLogin: clock.timestamp(-2, 11, 55),
      approvedByUserId: 1,
    },
    {
      id: 17,
      fullName: "Maryam Glow Lab",
      email: "maryam@example.com",
      status: "suspended",
      cityId: 3,
      categoryId: 5,
      gender: "female",
      followers: followerSet(11000, 1000, 0),
      tags: ["beauty"],
      preferredPlatform: "Instagram",
      createdAt: clock.timestamp(-42, 13, 0),
      approvedByUserId: 1,
    },
    {
      id: 18,
      fullName: "Saad Fit Moves",
      email: "saad@example.com",
      status: "suspended",
      cityId: 2,
      categoryId: 6,
      gender: "male",
      followers: followerSet(7000, 0, 900),
      tags: ["fitness"],
      preferredPlatform: "Snapchat",
      createdAt: clock.timestamp(-27, 12, 20),
      approvedByUserId: 1,
    },
    {
      id: 19,
      fullName: "Reem Tastes",
      email: "reem@example.com",
      status: "rejected",
      cityId: 1,
      categoryId: 1,
      gender: "female",
      followers: followerSet(5000, 0, 0),
      tags: ["foodie"],
      preferredPlatform: "Instagram",
      createdAt: clock.timestamp(-6, 11, 0),
      approvedByUserId: 1,
    },
    {
      id: 20,
      fullName: "Nada New Bites",
      email: "nada@example.com",
      status: "pending",
      cityId: 1,
      categoryId: 1,
      gender: "female",
      followers: followerSet(5000, 0, 0),
      tags: [],
      preferredPlatform: "Instagram",
      createdAt: clock.timestamp(-3, 10, 20),
      approvedByUserId: null,
    },
    {
      id: 21,
      fullName: "Hamad Slow Life",
      email: "hamad@example.com",
      status: "pending",
      cityId: 2,
      categoryId: 2,
      gender: "male",
      followers: followerSet(0, 0, 0),
      tags: [],
      preferredPlatform: "TikTok",
      createdAt: clock.timestamp(-2, 15, 40),
      approvedByUserId: null,
    },
    {
      id: 22,
      fullName: "Sahar Runway Notes",
      email: "sahar@example.com",
      status: "pending",
      cityId: 4,
      categoryId: 3,
      gender: "female",
      followers: followerSet(25000, 8000, 0),
      tags: [],
      preferredPlatform: "Instagram",
      createdAt: clock.timestamp(-4, 13, 10),
      approvedByUserId: null,
    },
    {
      id: 23,
      fullName: "Meshari Active Days",
      email: "meshari@example.com",
      status: "pending",
      cityId: 6,
      categoryId: 6,
      gender: "male",
      followers: followerSet(0, 2000, 0),
      tags: [],
      preferredPlatform: "TikTok",
      createdAt: clock.timestamp(-1, 18, 5),
      approvedByUserId: null,
    },
  ];

  let mobileCounter = 1001;
  for (const definition of definitions) {
    definition.mobile = `5510${String(mobileCounter).padStart(4, "0")}`.slice(0, 8);
    mobileCounter += 1;
  }

  return definitions.map((definition) => memberRecord(definition, helpers));
}

function buildCampaigns(clock) {
  const createdBy = 2;
  const updatedBy = 2;
  return [
    {
      id: 201,
      titleEn: "Cold Brew Shop Visit",
      titleAr: "زيارة الكولد برو",
      descriptionEn: "A relaxed cold brew visit for members who love cafe moments and simple content.",
      descriptionAr: "زيارة كولد برو مريحة للأعضاء الذين يحبون لحظات المقاهي والمحتوى البسيط.",
      captionGuide: "Use #PICKColdBrew and mention @pickkw. Keep it casual, bright, and coffee-first.",
      whatsappMessage: "",
      type: "shop_visit",
      status: "live",
      audience: "Open to all members",
      audienceAr: "مفتوحة لجميع الأعضاء",
      offerDescription: "One complimentary cold brew and pastry pairing.",
      offerUsageCount: 1,
      startDate: clock.dateString(-1),
      endDate: clock.dateString(5),
      visitDeadline: clock.dateString(7),
      submissionDeadline: clock.dateString(14),
      branchMode: "all",
      branchIds: [],
      targetCityIds: [],
      targetCategoryIds: [],
      targetTags: [],
      targetGender: "",
      minFollowers: 0,
      targetPlatformIds: [],
      participantCap: 0,
      bannerName: "",
      bannerPath: "",
      createdBy,
      updatedBy,
      createdAt: clock.timestamp(-12, 10, 0),
      updatedAt: clock.timestamp(-2, 9, 15),
      autoClosedAt: null,
    },
    {
      id: 202,
      titleEn: "Ladies Beauty Day",
      titleAr: "يوم الجمال للسيدات",
      descriptionEn: "A beauty-led branch visit with soft content, tutorials, and gentle product moments.",
      descriptionAr: "زيارة تركز على الجمال مع محتوى ناعم وتجارب ومنتجات لطيفة.",
      captionGuide: "Mention the glow, the service, and one favorite item. Keep the tone warm and personal.",
      whatsappMessage: "We would love to invite you to our beauty day. Keep it soft, elegant, and mention your favorite detail from the visit.",
      type: "shop_visit",
      status: "live",
      audience: "Beauty members",
      audienceAr: "عضوات الجمال",
      offerDescription: "Beauty consultation with a complimentary product sampler.",
      offerUsageCount: 1,
      startDate: clock.dateString(0),
      endDate: clock.dateString(4),
      visitDeadline: clock.dateString(5),
      submissionDeadline: clock.dateString(12),
      branchMode: "all",
      branchIds: [],
      targetCityIds: [],
      targetCategoryIds: [5],
      targetTags: [],
      targetGender: "female",
      minFollowers: 0,
      targetPlatformIds: [],
      participantCap: 0,
      bannerName: "",
      bannerPath: "",
      createdBy,
      updatedBy,
      createdAt: clock.timestamp(-10, 9, 45),
      updatedAt: clock.timestamp(-1, 10, 5),
      autoClosedAt: null,
    },
    {
      id: 203,
      titleEn: "Macro Creators Tasting",
      titleAr: "تذوق صناع المحتوى الكبار",
      descriptionEn: "A tasting session for larger creators who can give the launch wider reach.",
      descriptionAr: "جلسة تذوق لصناع المحتوى الكبار لمنح الإطلاق انتشاراً أوسع.",
      captionGuide: "Lead with the experience, then show the tasting details and your favorite menu item.",
      whatsappMessage: "",
      type: "shop_visit",
      status: "live",
      audience: "Macro creators",
      audienceAr: "صناع المحتوى الكبار",
      offerDescription: "Guided tasting menu for macro creators.",
      offerUsageCount: 1,
      startDate: clock.dateString(2),
      endDate: clock.dateString(8),
      visitDeadline: clock.dateString(10),
      submissionDeadline: clock.dateString(17),
      branchMode: "all",
      branchIds: [],
      targetCityIds: [],
      targetCategoryIds: [],
      targetTags: [],
      targetGender: "",
      minFollowers: 20000,
      targetPlatformIds: [],
      participantCap: 5,
      bannerName: "",
      bannerPath: "",
      createdBy,
      updatedBy,
      createdAt: clock.timestamp(-9, 11, 10),
      updatedAt: clock.timestamp(-3, 14, 0),
      autoClosedAt: null,
    },
    {
      id: 204,
      titleEn: "Instagram Coffee Reels",
      titleAr: "ريلز القهوة على إنستغرام",
      descriptionEn: "A quick-stop campaign for members who like polished vertical coffee reels.",
      descriptionAr: "حملة سريعة للأعضاء الذين يحبون ريلز القهوة المصقولة على إنستغرام.",
      captionGuide: "Open with the first pour, keep the edit bright, and avoid over-explaining the product.",
      whatsappMessage: "",
      type: "shop_visit",
      status: "live",
      audience: "Instagram-first members",
      audienceAr: "الأعضاء النشطون على إنستغرام",
      offerDescription: "Coffee reel challenge with one featured drink.",
      offerUsageCount: 1,
      startDate: clock.dateString(1),
      endDate: clock.dateString(5),
      visitDeadline: clock.dateString(6),
      submissionDeadline: clock.dateString(13),
      branchMode: "all",
      branchIds: [],
      targetCityIds: [],
      targetCategoryIds: [],
      targetTags: [],
      targetGender: "",
      minFollowers: 0,
      targetPlatformIds: [1],
      participantCap: 0,
      bannerName: "",
      bannerPath: "",
      createdBy,
      updatedBy,
      createdAt: clock.timestamp(-7, 8, 55),
      updatedAt: clock.timestamp(-2, 12, 10),
      autoClosedAt: null,
    },
    {
      id: 205,
      titleEn: "Avenues Exclusive",
      titleAr: "عرض الأفنيوز الحصري",
      descriptionEn: "A small members-only branch moment at The Avenues with tight capacity and quick turnaround.",
      descriptionAr: "تجربة صغيرة للأعضاء في الأفنيوز بسعة محدودة وتسليم سريع.",
      captionGuide: "Keep it exclusive and branch-specific. Mention The Avenues clearly.",
      whatsappMessage: "",
      type: "shop_visit",
      status: "live",
      audience: "The Avenues branch members",
      audienceAr: "أعضاء فرع الأفنيوز",
      offerDescription: "Exclusive branch visit at The Avenues.",
      offerUsageCount: 1,
      startDate: clock.dateString(0),
      endDate: clock.dateString(3),
      visitDeadline: clock.dateString(4),
      submissionDeadline: clock.dateString(11),
      branchMode: "selected",
      branchIds: [1],
      targetCityIds: [],
      targetCategoryIds: [],
      targetTags: [],
      targetGender: "",
      minFollowers: 0,
      targetPlatformIds: [],
      participantCap: 3,
      bannerName: "",
      bannerPath: "",
      createdBy,
      updatedBy,
      createdAt: clock.timestamp(-6, 10, 20),
      updatedAt: clock.timestamp(-1, 9, 50),
      autoClosedAt: null,
    },
    {
      id: 206,
      titleEn: "Family Brunch",
      titleAr: "برانش العائلة",
      descriptionEn: "A family-friendly brunch invitation for members whose content naturally includes home and family moments.",
      descriptionAr: "دعوة برانش عائلية للأعضاء الذين يعكس محتواهم لحظات البيت والعائلة.",
      captionGuide: "Focus on warmth, togetherness, and one favorite family-friendly detail from the table.",
      whatsappMessage: "",
      type: "shop_visit",
      status: "live",
      audience: "Family moments",
      audienceAr: "لحظات عائلية",
      offerDescription: "Family brunch set for one household visit.",
      offerUsageCount: 1,
      startDate: clock.dateString(1),
      endDate: clock.dateString(6),
      visitDeadline: clock.dateString(8),
      submissionDeadline: clock.dateString(15),
      branchMode: "all",
      branchIds: [],
      targetCityIds: [],
      targetCategoryIds: [],
      targetTags: ["family"],
      targetGender: "",
      minFollowers: 0,
      targetPlatformIds: [],
      participantCap: 0,
      bannerName: "",
      bannerPath: "",
      createdBy,
      updatedBy,
      createdAt: clock.timestamp(-5, 9, 15),
      updatedAt: clock.timestamp(-1, 11, 0),
      autoClosedAt: null,
    },
    {
      id: 207,
      titleEn: "Founders Preview",
      titleAr: "معاينة المؤسسين",
      descriptionEn: "A draft-only preview campaign waiting for launch details.",
      descriptionAr: "حملة معاينة ما زالت بانتظار تفاصيل الإطلاق.",
      captionGuide: "",
      whatsappMessage: "",
      type: "shop_visit",
      status: "draft",
      audience: "Internal draft",
      audienceAr: "مسودة داخلية",
      offerDescription: "Preview tasting before launch.",
      offerUsageCount: 1,
      startDate: clock.dateString(18),
      endDate: clock.dateString(25),
      visitDeadline: clock.dateString(20),
      submissionDeadline: clock.dateString(30),
      branchMode: "all",
      branchIds: [],
      targetCityIds: [],
      targetCategoryIds: [],
      targetTags: [],
      targetGender: "",
      minFollowers: 0,
      targetPlatformIds: [],
      participantCap: 0,
      bannerName: "",
      bannerPath: "",
      createdBy,
      updatedBy,
      createdAt: clock.timestamp(-4, 10, 10),
      updatedAt: clock.timestamp(-4, 10, 10),
      autoClosedAt: null,
    },
    {
      id: 208,
      titleEn: "Spring Tasting",
      titleAr: "تذوق الربيع",
      descriptionEn: "A completed campaign kept for historical submission review.",
      descriptionAr: "حملة مكتملة محفوظة لمراجعة التسليمات التاريخية.",
      captionGuide: "Mention the spring drinks and tasting sequence in the story set.",
      whatsappMessage: "",
      type: "shop_visit",
      status: "completed",
      audience: "Historical archive",
      audienceAr: "أرشيف تاريخي",
      offerDescription: "Seasonal tasting flight.",
      offerUsageCount: 1,
      startDate: clock.dateString(-40),
      endDate: clock.dateString(-31),
      visitDeadline: clock.dateString(-30),
      submissionDeadline: clock.dateString(-15),
      branchMode: "all",
      branchIds: [],
      targetCityIds: [],
      targetCategoryIds: [],
      targetTags: [],
      targetGender: "",
      minFollowers: 0,
      targetPlatformIds: [],
      participantCap: 0,
      bannerName: "",
      bannerPath: "",
      createdBy,
      updatedBy,
      createdAt: clock.timestamp(-45, 9, 0),
      updatedAt: clock.timestamp(-15, 20, 0),
      autoClosedAt: clock.timestamp(-15, 20, 0),
    },
    {
      id: 209,
      titleEn: "Winter Cold Brew",
      titleAr: "كولد برو الشتاء",
      descriptionEn: "A paused campaign kept ready but hidden from members.",
      descriptionAr: "حملة متوقفة وجاهزة لكنها مخفية عن الأعضاء.",
      captionGuide: "",
      whatsappMessage: "",
      type: "shop_visit",
      status: "deactivated",
      audience: "Paused",
      audienceAr: "متوقفة",
      offerDescription: "Paused seasonal cold brew offer.",
      offerUsageCount: 1,
      startDate: clock.dateString(1),
      endDate: clock.dateString(9),
      visitDeadline: clock.dateString(10),
      submissionDeadline: clock.dateString(20),
      branchMode: "all",
      branchIds: [],
      targetCityIds: [],
      targetCategoryIds: [],
      targetTags: [],
      targetGender: "",
      minFollowers: 0,
      targetPlatformIds: [],
      participantCap: 0,
      bannerName: "",
      bannerPath: "",
      createdBy,
      updatedBy,
      createdAt: clock.timestamp(-3, 13, 30),
      updatedAt: clock.timestamp(-2, 8, 45),
      autoClosedAt: null,
    },
    {
      id: 210,
      titleEn: "Quick Tasting",
      titleAr: "تذوق سريع",
      descriptionEn: "A fast open tasting with no extra targeting and plenty of room for new joins.",
      descriptionAr: "تذوق سريع ومفتوح بلا استهداف إضافي وبمساحة واسعة للانضمام.",
      captionGuide: "",
      whatsappMessage: "",
      type: "shop_visit",
      status: "live",
      audience: "Quick open invite",
      audienceAr: "دعوة مفتوحة سريعة",
      offerDescription: "Quick tasting stop-in with one featured item.",
      offerUsageCount: 1,
      startDate: clock.dateString(0),
      endDate: clock.dateString(2),
      visitDeadline: clock.dateString(3),
      submissionDeadline: clock.dateString(10),
      branchMode: "all",
      branchIds: [],
      targetCityIds: [],
      targetCategoryIds: [],
      targetTags: [],
      targetGender: "",
      minFollowers: 0,
      targetPlatformIds: [],
      participantCap: 0,
      bannerName: "",
      bannerPath: "",
      createdBy,
      updatedBy,
      createdAt: clock.timestamp(-2, 11, 45),
      updatedAt: clock.timestamp(-1, 14, 40),
      autoClosedAt: null,
    },
  ];
}

function makeImageBundle(count) {
  return Array.from({ length: count }, (_, index) => {
    const file = UPLOAD_FILES[index % UPLOAD_FILES.length];
    return {
      name: path.basename(file),
      path: `/uploads/${file}`,
    };
  });
}

function imagePrimary(images) {
  if (!images.length) return { imageName: "", imagePath: "" };
  return {
    imageName: images[0].name,
    imagePath: images[0].path,
  };
}

function participationRecord(definition) {
  const images = definition.images || [];
  const primary = imagePrimary(images);
  return {
    id: definition.id,
    campaignId: definition.campaignId,
    influencerId: definition.influencerId ?? null,
    source: definition.source || (definition.influencerId ? "platform" : "offline"),
    offlineName: definition.offlineName || "",
    offlineMobile: definition.offlineMobile || "",
    offlineNotes: definition.offlineNotes || "",
    status: definition.status,
    assignedCodeId: definition.assignedCodeId || null,
    selectedBranchId: definition.selectedBranchId || null,
    selectedVisitDate: definition.selectedVisitDate || null,
    joinedAt: definition.joinedAt,
    visitedAt: definition.visitedAt || null,
    visitedBranchId: definition.visitedBranchId || null,
    visitedConfirmedByPin: Boolean(definition.visitedConfirmedByPin),
    submittedAt: definition.submittedAt || null,
    completedAt: definition.completedAt || null,
    socialLink: definition.socialLink || "",
    feedback: definition.feedback || "",
    images,
    imageName: primary.imageName,
    imagePath: primary.imagePath,
    platform: definition.platform || "",
    canceledReason: definition.canceledReason || "",
  };
}

function buildParticipations(clock) {
  const longFeedback =
    "The branch team was warm from the first minute, the drinks looked beautiful on camera, and the tasting flow made it easy to capture both the moment and the product story without rushing.";

  return [
    participationRecord({
      id: 9001,
      campaignId: 201,
      influencerId: 3,
      status: "visited",
      joinedAt: clock.timestamp(-2, 9, 0),
      visitedAt: clock.timestamp(-1, 13, 20),
      visitedBranchId: 1,
      visitedConfirmedByPin: true,
    }),
    participationRecord({
      id: 9002,
      campaignId: 201,
      influencerId: 11,
      status: "submitted",
      joinedAt: clock.timestamp(-6, 11, 0),
      visitedAt: clock.timestamp(-5, 14, 10),
      visitedBranchId: 2,
      visitedConfirmedByPin: true,
      submittedAt: clock.timestamp(-3, 9, 15),
      socialLink: "https://instagram.com/p/CXjK7n9",
      feedback: longFeedback,
      images: makeImageBundle(2),
      platform: "Instagram",
    }),
    participationRecord({
      id: 9003,
      campaignId: 201,
      influencerId: 4,
      status: "confirmed",
      joinedAt: clock.timestamp(-1, 10, 10),
    }),
    participationRecord({
      id: 9004,
      campaignId: 201,
      influencerId: 9,
      status: "confirmed",
      joinedAt: clock.timestamp(-1, 11, 0),
    }),
    participationRecord({
      id: 9005,
      campaignId: 201,
      status: "offline_reserved",
      source: "offline",
      offlineName: "Mona Walk-in",
      offlineMobile: "55105555",
      offlineNotes: "Reserved by branch manager for a walk-in creator.",
      joinedAt: clock.timestamp(-1, 12, 0),
      platform: "Instagram",
    }),
    participationRecord({
      id: 9006,
      campaignId: 201,
      influencerId: 13,
      status: "confirmed",
      joinedAt: clock.timestamp(-2, 16, 20),
    }),
    participationRecord({
      id: 9007,
      campaignId: 201,
      influencerId: 14,
      status: "confirmed",
      joinedAt: clock.timestamp(-3, 18, 10),
    }),
    participationRecord({
      id: 9008,
      campaignId: 202,
      influencerId: 6,
      status: "submitted",
      joinedAt: clock.timestamp(-2, 10, 30),
      visitedAt: clock.timestamp(-1, 16, 40),
      visitedBranchId: 2,
      visitedConfirmedByPin: true,
      submittedAt: clock.timestamp(0, 7, 30),
      socialLink: "https://tiktok.com/@maha_pick/video/7214491",
      feedback: "Loved the soft lighting and product styling. The team helped with quick details for the story sequence.",
      images: makeImageBundle(1),
      platform: "TikTok",
    }),
    participationRecord({
      id: 9009,
      campaignId: 202,
      influencerId: 5,
      status: "confirmed",
      joinedAt: clock.timestamp(-1, 9, 40),
    }),
    participationRecord({
      id: 9010,
      campaignId: 202,
      influencerId: 10,
      status: "confirmed",
      joinedAt: clock.timestamp(-1, 13, 15),
    }),
    participationRecord({
      id: 9011,
      campaignId: 202,
      status: "offline_reserved",
      source: "offline",
      offlineName: "Beauty Guest",
      offlineMobile: "55106666",
      offlineNotes: "Reserved for branch guest list.",
      joinedAt: clock.timestamp(-1, 14, 0),
      platform: "Instagram",
    }),
    participationRecord({
      id: 9012,
      campaignId: 203,
      influencerId: 5,
      status: "confirmed",
      joinedAt: clock.timestamp(-1, 10, 5),
    }),
    participationRecord({
      id: 9013,
      campaignId: 203,
      influencerId: 6,
      status: "confirmed",
      joinedAt: clock.timestamp(-1, 10, 35),
    }),
    participationRecord({
      id: 9014,
      campaignId: 203,
      influencerId: 10,
      status: "confirmed",
      joinedAt: clock.timestamp(-1, 11, 5),
    }),
    participationRecord({
      id: 9015,
      campaignId: 203,
      influencerId: 13,
      status: "confirmed",
      joinedAt: clock.timestamp(-1, 11, 35),
    }),
    participationRecord({
      id: 9016,
      campaignId: 203,
      influencerId: 16,
      status: "confirmed",
      joinedAt: clock.timestamp(-1, 12, 5),
    }),
    participationRecord({
      id: 9017,
      campaignId: 204,
      influencerId: 3,
      status: "submitted",
      joinedAt: clock.timestamp(-8, 10, 0),
      visitedAt: clock.timestamp(-7, 13, 5),
      visitedBranchId: 1,
      visitedConfirmedByPin: true,
      submittedAt: clock.timestamp(-4, 9, 5),
      socialLink: "https://instagram.com/p/CQ8PICK",
      feedback: "Short reel, first pour, then a clean branch pan.",
      images: [],
      platform: "Instagram",
    }),
    participationRecord({
      id: 9018,
      campaignId: 204,
      influencerId: 9,
      status: "confirmed",
      joinedAt: clock.timestamp(-1, 12, 25),
    }),
    participationRecord({
      id: 9019,
      campaignId: 205,
      influencerId: 3,
      status: "confirmed",
      joinedAt: clock.timestamp(-1, 10, 50),
      selectedBranchId: 1,
    }),
    participationRecord({
      id: 9020,
      campaignId: 205,
      influencerId: 14,
      status: "confirmed",
      joinedAt: clock.timestamp(-1, 11, 50),
      selectedBranchId: 1,
    }),
    participationRecord({
      id: 9021,
      campaignId: 205,
      influencerId: 11,
      status: "confirmed",
      joinedAt: clock.timestamp(-1, 12, 50),
      selectedBranchId: 1,
    }),
    participationRecord({
      id: 9022,
      campaignId: 206,
      influencerId: 12,
      status: "confirmed",
      joinedAt: clock.timestamp(-1, 14, 5),
    }),
    participationRecord({
      id: 9023,
      campaignId: 208,
      influencerId: 3,
      status: "canceled",
      joinedAt: clock.timestamp(-29, 10, 0),
      canceledReason: "Canceled by member after schedule change",
    }),
    participationRecord({
      id: 9024,
      campaignId: 208,
      influencerId: 12,
      status: "completed",
      joinedAt: clock.timestamp(-32, 10, 5),
      visitedAt: clock.timestamp(-31, 13, 20),
      visitedBranchId: 3,
      visitedConfirmedByPin: true,
      submittedAt: clock.timestamp(-28, 11, 0),
      completedAt: clock.timestamp(-15, 20, 0),
      socialLink: "https://snapchat.com/add/abeer_pick/featured",
      feedback: "Family brunch felt relaxed and generous. The table styling worked especially well for vertical stories.",
      images: makeImageBundle(3),
      platform: "Snapchat",
    }),
    participationRecord({
      id: 9025,
      campaignId: 208,
      influencerId: 13,
      status: "completed",
      joinedAt: clock.timestamp(-32, 10, 25),
      visitedAt: clock.timestamp(-31, 13, 40),
      visitedBranchId: 1,
      visitedConfirmedByPin: true,
      submittedAt: clock.timestamp(-27, 9, 0),
      completedAt: clock.timestamp(-15, 20, 0),
      socialLink: "https://instagram.com/p/CSPRING01",
      feedback: "Great vibes 💜",
      images: makeImageBundle(1),
      platform: "Instagram",
    }),
    participationRecord({
      id: 9026,
      campaignId: 208,
      influencerId: 6,
      status: "completed",
      joinedAt: clock.timestamp(-31, 9, 15),
      visitedAt: clock.timestamp(-30, 12, 30),
      visitedBranchId: 2,
      visitedConfirmedByPin: true,
      submittedAt: clock.timestamp(-27, 15, 0),
      completedAt: clock.timestamp(-15, 20, 0),
      socialLink: "https://tiktok.com/@maha_pick/video/7021831",
      feedback: "The tasting sequence was easy to explain and the visuals came together quickly.",
      images: [],
      platform: "TikTok",
    }),
    participationRecord({
      id: 9027,
      campaignId: 208,
      influencerId: 5,
      status: "completed",
      joinedAt: clock.timestamp(-31, 10, 0),
      visitedAt: clock.timestamp(-30, 13, 0),
      visitedBranchId: 1,
      visitedConfirmedByPin: true,
      submittedAt: clock.timestamp(-26, 10, 0),
      completedAt: clock.timestamp(-15, 20, 0),
      socialLink: "https://instagram.com/p/CSPRING02",
      feedback: "Loved how easy the branch flow was for stories.",
      images: makeImageBundle(2),
      platform: "Instagram",
    }),
    participationRecord({
      id: 9028,
      campaignId: 208,
      influencerId: 11,
      status: "completed",
      joinedAt: clock.timestamp(-31, 11, 0),
      visitedAt: clock.timestamp(-30, 14, 0),
      visitedBranchId: 3,
      visitedConfirmedByPin: true,
      submittedAt: clock.timestamp(-25, 12, 0),
      completedAt: clock.timestamp(-15, 20, 0),
      socialLink: "https://instagram.com/p/CSPRING03",
      feedback: "Menu callouts were clear and the tasting had a strong visual order.",
      images: makeImageBundle(1),
      platform: "Instagram",
    }),
    participationRecord({
      id: 9029,
      campaignId: 208,
      influencerId: 10,
      status: "completed",
      joinedAt: clock.timestamp(-30, 10, 20),
      visitedAt: clock.timestamp(-29, 14, 10),
      visitedBranchId: 2,
      visitedConfirmedByPin: true,
      submittedAt: clock.timestamp(-24, 10, 30),
      completedAt: clock.timestamp(-15, 20, 0),
      socialLink: "https://instagram.com/p/CSPRING04",
      feedback: longFeedback,
      images: makeImageBundle(3),
      platform: "Instagram",
    }),
    participationRecord({
      id: 9030,
      campaignId: 208,
      influencerId: 4,
      status: "completed",
      joinedAt: clock.timestamp(-30, 11, 0),
      visitedAt: clock.timestamp(-29, 15, 0),
      visitedBranchId: 1,
      visitedConfirmedByPin: true,
      submittedAt: clock.timestamp(-23, 9, 20),
      completedAt: clock.timestamp(-15, 20, 0),
      socialLink: "https://snapchat.com/add/omar_pick/spring",
      feedback: "Nice branch flow and quick service.",
      images: [],
      platform: "Snapchat",
    }),
    participationRecord({
      id: 9031,
      campaignId: 208,
      influencerId: 14,
      status: "completed",
      joinedAt: clock.timestamp(-30, 12, 0),
      visitedAt: clock.timestamp(-29, 16, 0),
      visitedBranchId: 3,
      visitedConfirmedByPin: true,
      submittedAt: clock.timestamp(-22, 12, 40),
      completedAt: clock.timestamp(-15, 20, 0),
      socialLink: "https://instagram.com/p/CSPRING05",
      feedback: "Simple stop, strong coffee visuals, easy to package in one post.",
      images: makeImageBundle(2),
      platform: "Instagram",
    }),
    participationRecord({
      id: 9032,
      campaignId: 208,
      influencerId: 15,
      status: "canceled",
      joinedAt: clock.timestamp(-29, 12, 30),
      canceledReason: "Canceled by member after visit date clash",
    }),
    participationRecord({
      id: 9033,
      campaignId: 208,
      influencerId: 9,
      status: "canceled",
      joinedAt: clock.timestamp(-29, 13, 30),
      canceledReason: "Removed by campaign team after duplicate booking",
    }),
    participationRecord({
      id: 9034,
      campaignId: 208,
      influencerId: 8,
      status: "canceled",
      joinedAt: clock.timestamp(-29, 14, 30),
      canceledReason: "Removed by campaign team after no-show",
    }),
  ];
}

function codeRecord(id, campaign, codeValue, status, uploadedAt) {
  return {
    id,
    campaignId: campaign.id,
    codeValue,
    usageCount: campaign.offerUsageCount || 1,
    offerText: campaign.offerDescription || "",
    status,
    uploadedAt,
    reservedAt: null,
    usedAt: null,
    blockedAt: null,
    deletedAt: null,
    deletedBatchId: null,
    reservedByParticipantId: null,
  };
}

function campaignCodeShort(code) {
  return code.padEnd(3, "X").slice(0, 3).toUpperCase();
}

function buildCampaignCodes(clock, campaigns, participants) {
  const participantsByCampaign = new Map();
  for (const participant of participants) {
    const list = participantsByCampaign.get(participant.campaignId) || [];
    list.push(participant);
    participantsByCampaign.set(participant.campaignId, list);
  }

  const codes = [];
  let nextCodeId = 5001;

  const campaignConfig = {
    201: { prefix: "CBS", total: 15, available: 8, blocked: 0, deleted: 0 },
    202: { prefix: "LBD", total: 15, available: 11, blocked: 0, deleted: 0 },
    203: { prefix: "MCT", total: 15, available: 10, blocked: 0, deleted: 0 },
    204: { prefix: "IGR", total: 15, available: 13, blocked: 0, deleted: 0 },
    205: { prefix: "AVE", total: 15, available: 12, blocked: 0, deleted: 0 },
    206: { prefix: "FBR", total: 15, available: 14, blocked: 0, deleted: 0 },
    208: { prefix: "SPR", total: 15, available: 0, blocked: 4, deleted: 3 },
    209: { prefix: "WCB", total: 15, available: 15, blocked: 0, deleted: 0 },
    210: { prefix: "QCK", total: 15, available: 15, blocked: 0, deleted: 0 },
  };

  for (const campaign of campaigns) {
    const config = campaignConfig[campaign.id];
    if (!config) continue;
    const uploadedAt = campaign.createdAt;
    const campaignParticipants = participantsByCampaign.get(campaign.id) || [];
    const codeParticipants = {
      reserved: campaignParticipants.filter((participant) => ["confirmed", "offline_reserved"].includes(participant.status)),
      used: campaignParticipants.filter((participant) => ["visited", "submitted", "completed"].includes(participant.status)),
      blocked: campaignParticipants.filter((participant) => participant.status === "canceled"),
    };

    let sequence = 1;
    const makeCodeValue = () => `${campaignCodeShort(config.prefix)}-${String(sequence++).padStart(3, "0")}`;

    for (const participant of codeParticipants.used) {
      const code = codeRecord(nextCodeId++, campaign, makeCodeValue(), "used", uploadedAt);
      code.reservedByParticipantId = participant.id;
      code.reservedAt = participant.joinedAt;
      code.usedAt = participant.visitedAt || participant.submittedAt || participant.completedAt || participant.joinedAt;
      participant.assignedCodeId = code.id;
      codes.push(code);
    }

    for (const participant of codeParticipants.reserved) {
      const code = codeRecord(nextCodeId++, campaign, makeCodeValue(), "reserved", uploadedAt);
      code.reservedByParticipantId = participant.id;
      code.reservedAt = participant.joinedAt;
      participant.assignedCodeId = code.id;
      codes.push(code);
    }

    for (let index = 0; index < config.blocked; index += 1) {
      const participant = codeParticipants.blocked[index] || null;
      const code = codeRecord(nextCodeId++, campaign, makeCodeValue(), "blocked", uploadedAt);
      code.blockedAt = clock.timestamp(-14, 18, index);
      if (participant) {
        code.reservedByParticipantId = participant.id;
        code.reservedAt = participant.joinedAt;
        participant.assignedCodeId = code.id;
      }
      codes.push(code);
    }

    for (let index = 0; index < config.deleted; index += 1) {
      const code = codeRecord(nextCodeId++, campaign, makeCodeValue(), "deleted", uploadedAt);
      code.deletedAt = clock.timestamp(-13, 20, index);
      code.deletedBatchId = `uat-seed-${campaign.id}`;
      codes.push(code);
    }

    const remaining = config.total - (codeParticipants.used.length + codeParticipants.reserved.length + config.blocked + config.deleted);
    for (let index = 0; index < remaining; index += 1) {
      codes.push(codeRecord(nextCodeId++, campaign, makeCodeValue(), "available", uploadedAt));
    }
  }

  return codes;
}

function participantCampaignMap(participants) {
  const map = new Map();
  for (const participant of participants) {
    map.set(participant.id, participant.campaignId);
  }
  return map;
}

function buildAuditEvents(clock, store, participants) {
  const events = [];
  let nextAuditId = 1;
  const campaignMap = new Map(store.campaigns.map((campaign) => [campaign.id, campaign]));
  const branchMap = new Map(store.branches.map((branch) => [branch.id, branch]));
  const userMap = new Map(store.users.map((user) => [user.id, user]));

  function actorSnapshot(actorId) {
    const actor = actorId ? userMap.get(actorId) : null;
    if (!actor) return { actorId: null, actorRole: null, actorName: "System" };
    return {
      actorId: actor.id,
      actorRole: actor.role,
      actorName: actor.fullName || actor.email || "Unknown",
    };
  }

  function push(at, actorId, action, targetType, targetId, meta = {}) {
    events.push({
      id: nextAuditId++,
      at,
      ...actorSnapshot(actorId),
      action,
      targetType,
      targetId,
      meta,
    });
  }

  push(clock.timestamp(-20, 8, 30), 1, "auth.login", "user", 1);
  push(clock.timestamp(-20, 8, 45), 2, "auth.login", "user", 2);
  push(clock.timestamp(-19, 10, 15), 1, "user.manager_created", "user", 7, { email: "jalduaij@kdigtc.com" });
  push(clock.timestamp(-18, 13, 0), 1, "user.status_change", "user", 17, { from: "active", to: "suspended" });
  push(clock.timestamp(-17, 15, 20), 1, "user.status_change", "user", 18, { from: "active", to: "suspended" });
  push(clock.timestamp(-10, 9, 0), 1, "branch.pin_rotated", "branch", 2);

  for (const campaign of store.campaigns.filter((item) => store.campaignCodes.some((code) => code.campaignId === item.id))) {
    const added = store.campaignCodes.filter((code) => code.campaignId === campaign.id && code.status !== "deleted").length;
    push(campaign.createdAt, 2, "campaign.codes_uploaded", "campaign", campaign.id, { added });
  }

  for (const participant of participants) {
    const actorId = participant.influencerId || 2;
    if (participant.status === "offline_reserved") {
      push(participant.joinedAt, 2, "campaign.manual_reserve", "campaign", participant.campaignId, {
        participantId: participant.id,
        offlineName: participant.offlineName,
      });
      continue;
    }
    if (participant.status === "canceled") {
      const action = participant.canceledReason.toLowerCase().includes("member")
        ? "participant.self_canceled"
        : "participant.removed";
      push(participant.joinedAt, actorId, action, "participant", participant.id, { campaignId: participant.campaignId });
      continue;
    }
    push(participant.joinedAt, actorId, "campaign.joined", "campaign", participant.campaignId, {
      participantId: participant.id,
      codeId: participant.assignedCodeId || null,
    });
    if (participant.visitedAt) {
      push(participant.visitedAt, null, "participant.visit_confirmed", "participant", participant.id, {
        campaignId: participant.campaignId,
        branchId: participant.visitedBranchId,
        codeId: participant.assignedCodeId || null,
      });
    }
    if (participant.submittedAt) {
      push(participant.submittedAt, actorId, "participant.submission", "participant", participant.id, {
        campaignId: participant.campaignId,
      });
    }
  }

  events.sort((left, right) => left.at.localeCompare(right.at));
  return events.slice(-80);
}

function buildBaseCollections(clock) {
  return {
    cities: CITY_DEFS.map((city) => ({
      ...city,
      status: "active",
      createdAt: clock.timestamp(-60, 8, city.id),
    })),
    categories: CATEGORY_DEFS.map((category) => ({
      ...category,
      status: "active",
      createdAt: clock.timestamp(-60, 9, category.id),
    })),
    platforms: PLATFORM_DEFS.map((platform) => ({
      ...platform,
      status: "active",
      createdAt: clock.timestamp(-60, 10, platform.id),
    })),
    tags: TAG_DEFS.map((tag, index) => ({
      id: tag.id,
      value: tag.value,
      status: "active",
      createdAt: clock.timestamp(-60, 11, index),
    })),
    branches: BRANCH_DEFS.map((branch, index) => ({
      ...branch,
      areaEn: "",
      areaAr: "",
      addressEn: "",
      addressAr: "",
      mapLink: "",
      status: "active",
      imageName: "",
      imagePath: "",
      pinUpdatedAt: clock.timestamp(-30 + index, 9, 0),
    })),
  };
}

function maxId(items) {
  return items.reduce((maximum, item) => Math.max(maximum, Number(item.id) || 0), 0);
}

function buildNextIds(store) {
  return {
    user: maxId(store.users) + 1,
    campaign: maxId(store.campaigns) + 1,
    code: maxId(store.campaignCodes) + 1,
    participant: maxId(store.participants) + 1,
    branch: maxId(store.branches) + 1,
    city: maxId(store.cities) + 1,
    category: maxId(store.categories) + 1,
    platform: maxId(store.platforms) + 1,
    tag: maxId(store.tags) + 1,
    passwordReset: 1,
    auditEvent: maxId(store.auditEvents) + 1,
  };
}

function buildUatStore(baseStore, options = {}) {
  const clock = makeClock(options);
  const sourceUsers = Array.isArray(baseStore?.users) ? baseStore.users : [];
  const protectedUsers = PROTECTED_EMAILS.map((email) => {
    const found = sourceUsers.find((user) => String(user.email || "").toLowerCase() === email);
    if (!found) {
      throw new Error(`Protected account missing from source store: ${email}`);
    }
    return clone(found);
  }).sort((left, right) => left.id - right.id);

  const collections = buildBaseCollections(clock);
  const helpers = {
    cityName(cityId) {
      return collections.cities.find((city) => city.id === cityId)?.nameEn || "";
    },
    categoryName(categoryId) {
      return collections.categories.find((category) => category.id === categoryId)?.nameEn || "";
    },
  };

  const seedMembers = buildSeedMembers(clock, helpers);
  const campaigns = buildCampaigns(clock);
  const participants = buildParticipations(clock);
  const campaignCodes = buildCampaignCodes(clock, campaigns, participants);

  const store = {
    users: [...protectedUsers, ...seedMembers].sort((left, right) => left.id - right.id),
    campaigns,
    branches: collections.branches,
    campaignCodes,
    participants,
    passwordResets: [],
    auditEvents: [],
    loginAttempts: [],
    cities: collections.cities,
    categories: collections.categories,
    platforms: collections.platforms,
    tags: collections.tags,
    nextIds: {},
  };

  store.auditEvents = buildAuditEvents(clock, store, participants);
  store.nextIds = buildNextIds(store);

  return {
    store,
    summary: {
      members: store.users.filter((user) => user.role === "influencer").length,
      campaigns: store.campaigns.length,
      participations: store.participants.length,
    },
  };
}

module.exports = {
  PROTECTED_EMAILS,
  UAT_RESET_CONFIRM,
  buildUatStore,
};
