const translations = {
  en: {
    language: "Language",
    account: "Account",
    workspace: "Workspace",
    appSubtitle:
      "Run bilingual micro-influencer campaigns with CSV code pools, visit validation, and post tracking.",
    heroEyebrow: "Campaign operating system",
    admin: "Admin",
    campaign_manager: "Campaign Manager",
    influencer: "Influencer",
    dashboard: "Dashboard",
    approvals: "Approvals",
    campaigns: "Campaigns",
    reports: "Reports",
    profile: "Profile",
    availableCampaigns: "Available Campaigns",
    myCampaigns: "My Campaigns",
    visitCode: "Visit Code",
    assignedCode: "Assigned Code",
    submissions: "Submissions",
    pending: "Pending",
    active: "Active",
    visited: "Visited",
    submitted: "Submitted",
    completed: "Completed",
    publish: "Publish",
    createCampaign: "Create Campaign",
    joinCampaign: "Confirm Interest",
    approve: "Approve",
    reject: "Reject",
    validateVisit: "Confirm Visit",
    submitProof: "Submit Proof",
    optional: "Optional",
    roleContext: "Current experience",
  },
  ar: {
    language: "اللغة",
    account: "الحساب",
    workspace: "مساحة العمل",
    appSubtitle:
      "إدارة حملات المؤثرين الصغار مع رفع أكواد CSV وتوثيق الزيارة وتتبع النشر بعد التجربة.",
    heroEyebrow: "نظام تشغيل الحملات",
    admin: "مدير النظام",
    campaign_manager: "مدير الحملات",
    influencer: "مؤثر",
    dashboard: "لوحة التحكم",
    approvals: "الموافقات",
    campaigns: "الحملات",
    reports: "التقارير",
    profile: "الملف الشخصي",
    availableCampaigns: "الحملات المتاحة",
    myCampaigns: "حملاتي",
    visitCode: "رمز الزيارة",
    assignedCode: "الكود المخصص",
    submissions: "المنشورات",
    pending: "قيد الانتظار",
    active: "نشط",
    visited: "تمت الزيارة",
    submitted: "تم الإرسال",
    completed: "مكتمل",
    publish: "نشر",
    createCampaign: "إنشاء حملة",
    joinCampaign: "تأكيد الاهتمام",
    approve: "اعتماد",
    reject: "رفض",
    validateVisit: "تأكيد الزيارة",
    submitProof: "إرسال الإثبات",
    optional: "اختياري",
    roleContext: "وضع العرض الحالي",
  },
};

const seedState = {
  locale: "en",
  currentUserId: 1,
  users: [
    {
      id: 1,
      role: "admin",
      fullName: "Sara Al-Harbi",
      email: "sara@pick.internal",
      status: "active",
      city: "Kuwait City",
      category: "Leadership",
      language: "en",
    },
    {
      id: 2,
      role: "campaign_manager",
      fullName: "Nasser Al-Mutairi",
      email: "nasser@pick.internal",
      status: "active",
      city: "Kuwait City",
      category: "Food & Beverage",
      language: "ar",
    },
    {
      id: 3,
      role: "influencer",
      fullName: "Laila Q8 Bites",
      email: "laila@example.com",
      status: "active",
      city: "Hawally",
      category: "Foodie",
      language: "ar",
      instagram: "@lailaq8bites",
      tiktok: "@lailaq8",
      snapchat: "laila.snaps",
      followers: { instagram: 12600, tiktok: 9400, snapchat: 6100 },
    },
    {
      id: 4,
      role: "influencer",
      fullName: "Maha Lifestyle",
      email: "maha@example.com",
      status: "pending",
      city: "Salmiya",
      category: "Lifestyle",
      language: "en",
      instagram: "@mahalifestyle",
      tiktok: "@maha.life",
      snapchat: "maha.daily",
      followers: { instagram: 7800, tiktok: 11000, snapchat: 3200 },
    },
    {
      id: 5,
      role: "influencer",
      fullName: "Abdullah Reviews",
      email: "abdullah@example.com",
      status: "active",
      city: "Farwaniya",
      category: "Foodie",
      language: "en",
      instagram: "@abdullah.reviewz",
      tiktok: "@abdullah.reviewz",
      snapchat: "abd.snap",
      followers: { instagram: 15200, tiktok: 12500, snapchat: 7100 },
    },
  ],
  branches: [
    { id: 1, nameEn: "The Avenues", nameAr: "الأفنيوز", city: "Kuwait City" },
    { id: 2, nameEn: "Salmiya Flagship", nameAr: "السالمية", city: "Salmiya" },
    { id: 3, nameEn: "360 Mall", nameAr: "٣٦٠ مول", city: "Zahra" },
  ],
  campaigns: [
    {
      id: 101,
      titleEn: "Cold Brew Shop Visit",
      titleAr: "زيارة تجربة الكولد برو",
      descriptionEn:
        "Invite foodie micro-influencers to visit any participating PICK branch, experience the new cold brew range, and publish one feed post.",
      descriptionAr:
        "دعوة مؤثري الأطعمة لزيارة أي فرع مشارك من PICK وتجربة مشروبات الكولد برو الجديدة ونشر بوست واحد.",
      type: "shop_visit",
      status: "active",
      createdBy: 2,
      audience: "Foodie creators in Kuwait",
      audienceAr: "مؤثرو الأكل في الكويت",
      startDate: "2026-04-18",
      endDate: "2026-04-30",
      visitDeadline: "2026-04-27",
      submissionDeadline: "2026-04-30",
      branchIds: [1, 2, 3],
      targeting: ["Foodie", "Instagram or TikTok", "Kuwait-wide"],
      requireBranchSelection: false,
      requireVisitDate: false,
    },
    {
      id: 102,
      titleEn: "Protein Bites Trial",
      titleAr: "تجربة بروتين بايتس",
      descriptionEn:
        "A product-trial campaign for wellness and lifestyle creators to try the new snack range and share feedback.",
      descriptionAr:
        "حملة تجربة منتج لمؤثري نمط الحياة والصحة لتجربة الوجبات الخفيفة الجديدة ومشاركة الملاحظات.",
      type: "product_trial",
      status: "published",
      createdBy: 2,
      audience: "Lifestyle creators",
      audienceAr: "مؤثرو نمط الحياة",
      startDate: "2026-04-20",
      endDate: "2026-05-05",
      visitDeadline: "2026-05-02",
      submissionDeadline: "2026-05-05",
      branchIds: [2],
      targeting: ["Lifestyle", "Instagram", "Salmiya preferred"],
      requireBranchSelection: true,
      requireVisitDate: true,
    },
  ],
  campaignCodes: [
    { id: 5001, campaignId: 101, codeValue: "PICK-AV-4401", status: "used", reservedByParticipantId: 9001 },
    { id: 5002, campaignId: 101, codeValue: "PICK-SA-4402", status: "used", reservedByParticipantId: 9002 },
    { id: 5003, campaignId: 101, codeValue: "PICK-360-4403", status: "available", reservedByParticipantId: null },
    { id: 5004, campaignId: 101, codeValue: "PICK-AV-4404", status: "available", reservedByParticipantId: null },
    { id: 5005, campaignId: 101, codeValue: "PICK-SA-4405", status: "available", reservedByParticipantId: null },
    { id: 5006, campaignId: 102, codeValue: "PB-TRIAL-9001", status: "available", reservedByParticipantId: null },
    { id: 5007, campaignId: 102, codeValue: "PB-TRIAL-9002", status: "available", reservedByParticipantId: null },
    { id: 5008, campaignId: 102, codeValue: "PB-TRIAL-9003", status: "available", reservedByParticipantId: null },
  ],
  participants: [
    {
      id: 9001,
      campaignId: 101,
      influencerId: 3,
      status: "visited",
      assignedCodeId: 5001,
      selectedBranchId: 1,
      visitCode: "PICK-AV-4401",
      socialLink: "",
      feedback: "",
      imageName: "",
    },
    {
      id: 9002,
      campaignId: 101,
      influencerId: 5,
      status: "submitted",
      assignedCodeId: 5002,
      selectedBranchId: 2,
      visitCode: "PICK-SA-4402",
      socialLink: "https://instagram.com/p/example-review",
      feedback: "Loved the in-store flow. The pickup area was fast and the team explained the drink options clearly.",
      imageName: "cold-brew-counter.jpg",
    },
  ],
  nextCampaignId: 103,
  nextCodeId: 5009,
  nextParticipantId: 9003,
};

let state = loadState();

const dom = {
  languageSelect: document.getElementById("languageSelect"),
  userSelect: document.getElementById("userSelect"),
  navLinks: document.getElementById("navLinks"),
  pageTitle: document.getElementById("pageTitle"),
  activeContext: document.getElementById("activeContext"),
  heroTitle: document.getElementById("heroTitle"),
  heroCopy: document.getElementById("heroCopy"),
  heroMetrics: document.getElementById("heroMetrics"),
  metricsGrid: document.getElementById("metricsGrid"),
  primaryPanel: document.getElementById("primaryPanel"),
  secondaryPanel: document.getElementById("secondaryPanel"),
  tertiaryPanel: document.getElementById("tertiaryPanel"),
  metricTemplate: document.getElementById("metricCardTemplate"),
};

initialize();

function initialize() {
  renderSelects();
  bindGlobalEvents();
  render();
}

function loadState() {
  const raw = localStorage.getItem("pickInfluenceHubState");
  if (!raw) return structuredClone(seedState);
  try {
    return migrateState({ ...structuredClone(seedState), ...JSON.parse(raw) });
  } catch (error) {
    return structuredClone(seedState);
  }
}

function migrateState(inputState) {
  const nextState = structuredClone(inputState);

  nextState.campaignCodes = (nextState.campaignCodes || []).map((code) => ({
    ...code,
    reservedByParticipantId:
      code.reservedByParticipantId ?? code.usedByParticipantId ?? null,
    status:
      code.status === "used" || code.status === "reserved" || code.status === "void"
        ? code.status
        : "available",
  }));

  nextState.participants = (nextState.participants || []).map((participant) => {
    const assignedCode =
      nextState.campaignCodes.find((code) => code.id === participant.assignedCodeId) ||
      nextState.campaignCodes.find(
        (code) =>
          code.campaignId === participant.campaignId &&
          normalizeCode(code.codeValue) === normalizeCode(participant.visitCode)
      ) ||
      nextState.campaignCodes.find((code) => code.reservedByParticipantId === participant.id);

    return {
      ...participant,
      assignedCodeId: participant.assignedCodeId ?? assignedCode?.id ?? null,
      visitCode: participant.visitCode || assignedCode?.codeValue || "",
    };
  });

  return nextState;
}

function saveState() {
  localStorage.setItem("pickInfluenceHubState", JSON.stringify(state));
}

function t(key) {
  return translations[state.locale][key] || translations.en[key] || key;
}

function currentUser() {
  return state.users.find((user) => user.id === Number(state.currentUserId));
}

function currentRole() {
  return currentUser()?.role || "influencer";
}

function campaignById(campaignId) {
  return state.campaigns.find((campaign) => campaign.id === campaignId);
}

function participantsForCampaign(campaignId) {
  return state.participants.filter((participant) => participant.campaignId === campaignId);
}

function codesForCampaign(campaignId) {
  return state.campaignCodes.filter((code) => code.campaignId === campaignId);
}

function codeStatsForCampaign(campaignId) {
  const codes = codesForCampaign(campaignId);
  const joined = participantsForCampaign(campaignId).filter((participant) => participant.status !== "canceled").length;
  const reserved = codes.filter((code) => code.status === "reserved").length;
  const used = codes.filter((code) => code.status === "used").length;
  const available = codes.filter((code) => code.status === "available").length;
  return {
    total: codes.length,
    available,
    reserved,
    used,
    remaining: available,
    joined,
    openSlots: available,
  };
}

function normalizeCode(value) {
  return String(value || "").trim().toUpperCase();
}

function formatDate(value) {
  return new Intl.DateTimeFormat(state.locale === "ar" ? "ar-KW" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function branchName(branchId) {
  const branch = state.branches.find((item) => item.id === branchId);
  if (!branch) return "Unknown branch";
  return state.locale === "ar" ? branch.nameAr : branch.nameEn;
}

function campaignTitle(campaign) {
  return state.locale === "ar" ? campaign.titleAr : campaign.titleEn;
}

function campaignDescription(campaign) {
  return state.locale === "ar" ? campaign.descriptionAr : campaign.descriptionEn;
}

function audienceLabel(campaign) {
  return state.locale === "ar" ? campaign.audienceAr : campaign.audience;
}

function renderSelects() {
  dom.languageSelect.innerHTML = `
    <option value="en">English</option>
    <option value="ar">العربية</option>
  `;

  dom.languageSelect.value = state.locale;
  renderUserSelect();
}

function renderUserSelect() {
  dom.userSelect.innerHTML = state.users
    .map(
      (user) =>
        `<option value="${user.id}">${user.fullName} · ${t(user.role)}${user.status !== "active" ? ` (${user.status})` : ""}</option>`
    )
    .join("");

  if (!state.users.some((user) => user.id === Number(state.currentUserId))) {
    state.currentUserId = state.users[0]?.id || null;
  }
  dom.userSelect.value = String(state.currentUserId);
}

function bindGlobalEvents() {
  dom.languageSelect.addEventListener("change", (event) => {
    state.locale = event.target.value;
    saveState();
    renderSelects();
    render();
  });

  dom.userSelect.addEventListener("change", (event) => {
    state.currentUserId = Number(event.target.value);
    saveState();
    renderSelects();
    render();
  });
}

function render() {
  document.body.classList.toggle("rtl", state.locale === "ar");
  applyTranslations();
  renderSidebarNav();

  const role = currentRole();
  if (role === "admin") renderAdminView();
  if (role === "campaign_manager") renderCampaignManagerView();
  if (role === "influencer") renderInfluencerView();

  attachActionHandlers();
}

function applyTranslations() {
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
}

function renderSidebarNav() {
  const navItemsByRole = {
    admin: [t("dashboard"), t("approvals"), t("campaigns"), t("reports")],
    campaign_manager: [t("dashboard"), t("campaigns"), t("reports")],
    influencer: [t("dashboard"), t("availableCampaigns"), t("myCampaigns"), t("profile")],
  };

  dom.navLinks.innerHTML = navItemsByRole[currentRole()]
    .map((item, index) => `<div class="nav-chip"><span>${item}</span><span>0${index + 1}</span></div>`)
    .join("");
}

function renderHero({ pageTitle, context, title, copy, stats, metrics, primary, secondary, tertiary }) {
  dom.pageTitle.textContent = pageTitle;
  dom.activeContext.textContent = `${t("roleContext")}: ${context}`;
  dom.heroTitle.textContent = title;
  dom.heroCopy.textContent = copy;

  dom.heroMetrics.innerHTML = stats
    .map(
      (stat) => `
      <div class="hero-stat">
        <span class="eyebrow">${stat.label}</span>
        <strong>${stat.value}</strong>
        <span class="footer-note">${stat.note}</span>
      </div>
    `
    )
    .join("");

  dom.metricsGrid.innerHTML = "";
  metrics.forEach((metric) => {
    const fragment = dom.metricTemplate.content.cloneNode(true);
    fragment.querySelector(".metric-label").textContent = metric.label;
    fragment.querySelector(".metric-value").textContent = metric.value;
    fragment.querySelector(".metric-note").textContent = metric.note;
    dom.metricsGrid.appendChild(fragment);
  });

  dom.primaryPanel.innerHTML = primary;
  dom.secondaryPanel.innerHTML = secondary;
  dom.tertiaryPanel.innerHTML = tertiary;
}

function renderAdminView() {
  const pendingInfluencers = state.users.filter(
    (user) => user.role === "influencer" && user.status === "pending"
  );
  const activeCampaigns = state.campaigns.filter((campaign) => ["published", "active"].includes(campaign.status));
  const participantCount = state.participants.length;
  const submittedCount = state.participants.filter((participant) =>
    ["submitted", "completed"].includes(participant.status)
  ).length;

  renderHero({
    pageTitle: t("dashboard"),
    context: `${t("admin")} · ${currentUser().fullName}`,
    title: state.locale === "ar" ? "مركز التحكم الكامل للحملات والمؤثرين" : "A control center for campaigns and influencer operations",
    copy:
      state.locale === "ar"
        ? "راجع طلبات التسجيل المعلقة، راقب الأداء العام، وأبقِ مديري الحملات والمؤثرين على مسار واضح من الانضمام حتى النشر."
        : "Review pending registrations, monitor campaign health, and keep managers and influencers moving cleanly from approval to post submission.",
    stats: [
      { label: state.locale === "ar" ? "طلبات اعتماد" : "Pending approvals", value: pendingInfluencers.length, note: state.locale === "ar" ? "بانتظار قرار الإدارة" : "Awaiting admin action" },
      { label: state.locale === "ar" ? "حملات نشطة" : "Live campaigns", value: activeCampaigns.length, note: state.locale === "ar" ? "منشورة أو جارية" : "Published or active now" },
      { label: state.locale === "ar" ? "منشورات مكتملة" : "Completed proofs", value: submittedCount, note: state.locale === "ar" ? "روابط وملاحظات مستلمة" : "Links and feedback collected" },
    ],
    metrics: [
      { label: state.locale === "ar" ? "إجمالي المؤثرين" : "Total influencers", value: state.users.filter((user) => user.role === "influencer").length, note: state.locale === "ar" ? "يشمل جميع الحالات" : "Across all statuses" },
      { label: state.locale === "ar" ? "مؤثرون نشطون" : "Active influencers", value: state.users.filter((user) => user.role === "influencer" && user.status === "active").length, note: state.locale === "ar" ? "جاهزون للحملات" : "Eligible for campaigns" },
      { label: state.locale === "ar" ? "مشاركات الحملة" : "Campaign participations", value: participantCount, note: state.locale === "ar" ? "سجلات الانضمام الحالية" : "Current join records" },
      { label: state.locale === "ar" ? "معدل الإكمال" : "Completion rate", value: `${participantCount ? Math.round((submittedCount / participantCount) * 100) : 0}%`, note: state.locale === "ar" ? "زيارات تم رفعها بالكامل" : "Visited tasks with proof submitted" },
    ],
    primary: adminApprovalsPanel(pendingInfluencers),
    secondary: adminCampaignHealthPanel(activeCampaigns),
    tertiary: adminInfluencerPanel(),
  });
}

function adminApprovalsPanel(pendingInfluencers) {
  return `
    <h3>${state.locale === "ar" ? "اعتماد المؤثرين" : "Influencer approvals"}</h3>
    <p class="panel-subtitle">${state.locale === "ar" ? "أي مؤثر يسجل ذاتياً يظهر هنا حتى تتم مراجعته وتفعيله." : "Any self-registered influencer appears here until an admin reviews and activates the account."}</p>
    <div class="stack">
      ${
        pendingInfluencers.length
          ? pendingInfluencers
              .map(
                (user) => `
            <article class="participant-card">
              <div class="row">
                <div>
                  <strong>${user.fullName}</strong>
                  <p>${user.city} · ${user.category}</p>
                </div>
                <span class="badge warning">${t("pending")}</span>
              </div>
              <p class="compact">${user.email}</p>
              <div class="row-wrap" style="margin-top: 14px;">
                <button data-action="approve-user" data-user-id="${user.id}">${t("approve")}</button>
                <button class="secondary" data-action="reject-user" data-user-id="${user.id}">${t("reject")}</button>
              </div>
            </article>
          `
              )
              .join("")
          : `<div class="empty-state">${state.locale === "ar" ? "لا توجد طلبات معلقة حالياً." : "No pending approvals right now."}</div>`
      }
    </div>
  `;
}

function adminCampaignHealthPanel(activeCampaigns) {
  return `
    <h3>${state.locale === "ar" ? "صحة الحملات" : "Campaign health"}</h3>
    <p class="panel-subtitle">${state.locale === "ar" ? "لقطة سريعة للحملات الجارية وما إذا كانت تتحرك من الاهتمام إلى الزيارة ثم النشر." : "A quick look at live campaigns and whether they are moving from interest to visit to proof submission."}</p>
    <div class="stack">
      ${activeCampaigns
        .map((campaign) => {
          const participants = participantsForCampaign(campaign.id);
          const visited = participants.filter((item) => ["visited", "submitted", "completed"].includes(item.status)).length;
          const submitted = participants.filter((item) => ["submitted", "completed"].includes(item.status)).length;
          const codeStats = codeStatsForCampaign(campaign.id);
          return `
            <article class="campaign-card">
              <div class="row">
                <strong>${campaignTitle(campaign)}</strong>
                <span class="badge ${campaign.status === "active" ? "success" : ""}">${campaign.status}</span>
              </div>
              <p>${audienceLabel(campaign)}</p>
              <div class="row-wrap" style="margin-top: 12px;">
                <span class="badge">${participants.length} ${state.locale === "ar" ? "منضمون" : "joined"}</span>
                <span class="badge">${visited} ${state.locale === "ar" ? "تمت زيارتهم" : "visited"}</span>
                <span class="badge">${submitted} ${state.locale === "ar" ? "رفعوا المحتوى" : "submitted"}</span>
                <span class="badge">${codeStats.total} ${state.locale === "ar" ? "كود مرفوع" : "codes uploaded"}</span>
              </div>
            </article>
          `;
        })
        .join("")}
      <article class="note-card">
        <strong>${state.locale === "ar" ? "ملاحظة تشغيلية" : "Operating note"}</strong>
        <p>${state.locale === "ar" ? "في النسخة الإنتاجية يمكن إضافة سجل تدقيق لكل اعتماد ونشر حملة وتعديل على المواعيد." : "In production, this module should include an audit log for every approval, campaign publish event, and deadline change."}</p>
      </article>
    </div>
  `;
}

function adminInfluencerPanel() {
  const influencers = state.users.filter((user) => user.role === "influencer");
  return `
    <h3>${state.locale === "ar" ? "قاعدة المؤثرين" : "Influencer base"}</h3>
    <p class="panel-subtitle">${state.locale === "ar" ? "ملخص سريع للحالة الحالية ونوعية المؤثرين المتاحين لكل حملة." : "A quick summary of account health and creator mix available to future campaigns."}</p>
    <div class="stack">
      ${influencers
        .map(
          (user) => `
        <article class="list-card">
          <div class="row">
            <strong>${user.fullName}</strong>
            <span class="badge ${user.status === "active" ? "success" : "warning"}">${user.status}</span>
          </div>
          <p>${user.category} · ${user.city}</p>
          <p class="compact">${user.instagram || "-"} · ${user.email}</p>
        </article>
      `
        )
        .join("")}
    </div>
  `;
}

function renderCampaignManagerView() {
  const campaigns = state.campaigns.filter((campaign) => campaign.createdBy === currentUser().id);
  const activeCampaigns = campaigns.filter((campaign) => ["published", "active"].includes(campaign.status));
  const totalUploadedCodes = campaigns.reduce((sum, campaign) => sum + codeStatsForCampaign(campaign.id).total, 0);

  renderHero({
    pageTitle: t("campaigns"),
    context: `${t("campaign_manager")} · ${currentUser().fullName}`,
    title: state.locale === "ar" ? "أنشئ الحملات وحرّكها بسرعة" : "Create, publish, and keep campaigns moving",
    copy:
      state.locale === "ar"
        ? "من هنا يمكن لمدير الحملات إعداد التجارب، تحديد الفئات المناسبة، ثم متابعة من انضم ومن زار ومن رفع الرابط."
        : "This is the working table for building campaign briefs, targeting the right creators, and tracking who joined, visited, and submitted proof.",
    stats: [
      { label: state.locale === "ar" ? "إجمالي الحملات" : "Total campaigns", value: campaigns.length, note: state.locale === "ar" ? "أنشئت بواسطة هذا المدير" : "Created by this manager" },
      { label: state.locale === "ar" ? "حملات حية" : "Live campaigns", value: activeCampaigns.length, note: state.locale === "ar" ? "منشورة أو جارية" : "Published or active" },
      { label: state.locale === "ar" ? "متوسط المشاركين" : "Average participation", value: averageParticipantsForCampaigns(campaigns), note: state.locale === "ar" ? "لكل حملة حالية" : "Per current campaign" },
    ],
    metrics: [
      { label: state.locale === "ar" ? "زيارات مؤكدة" : "Validated visits", value: state.participants.filter((item) => ["visited", "submitted", "completed"].includes(item.status)).length, note: state.locale === "ar" ? "بعد استخدام الكود المخصص" : "After the assigned code is used" },
      { label: state.locale === "ar" ? "رفع الروابط" : "Submitted links", value: state.participants.filter((item) => ["submitted", "completed"].includes(item.status)).length, note: state.locale === "ar" ? "مع ملاحظات أو صور" : "With feedback or images" },
      { label: state.locale === "ar" ? "أكواد مرفوعة" : "Uploaded codes", value: totalUploadedCodes, note: state.locale === "ar" ? "السعة الحقيقية للحملات" : "Real participation capacity" },
      { label: state.locale === "ar" ? "أقرب مهلة" : "Next deadline", value: activeCampaigns[0] ? formatDate(activeCampaigns[0].visitDeadline) : "-", note: state.locale === "ar" ? "من أول حملة متاحة" : "From the nearest active campaign" },
    ],
    primary: managerCreateCampaignPanel(),
    secondary: managerPortfolioPanel(campaigns),
    tertiary: managerOperationsPanel(campaigns),
  });
}

function averageParticipantsForCampaigns(campaigns) {
  if (!campaigns.length) return "0";
  const total = campaigns.reduce(
    (sum, campaign) => sum + state.participants.filter((item) => item.campaignId === campaign.id).length,
    0
  );
  return (total / campaigns.length).toFixed(1);
}

function managerCreateCampaignPanel() {
  return `
    <h3>${state.locale === "ar" ? "إنشاء حملة جديدة" : "Create a new campaign"}</h3>
    <p class="panel-subtitle">${state.locale === "ar" ? "أنشئ الحملة أولاً ثم ارفع ملف CSV الخاص بالأكواد ليصبح بإمكان المؤثرين الانضمام." : "Create the campaign first, then upload its CSV code file so influencers can start joining."}</p>
    <form class="form-grid two-col" id="createCampaignForm">
      <label class="field">
        <span>${state.locale === "ar" ? "العنوان بالإنجليزية" : "Title in English"}</span>
        <input name="titleEn" required placeholder="Summer product trial" />
      </label>
      <label class="field">
        <span>${state.locale === "ar" ? "العنوان بالعربية" : "Title in Arabic"}</span>
        <input name="titleAr" required placeholder="حملة تجربة الصيف" />
      </label>
      <label class="field">
        <span>${state.locale === "ar" ? "نوع الحملة" : "Campaign type"}</span>
        <select name="type">
          <option value="shop_visit">Shop Visit</option>
          <option value="product_trial">Product Trial</option>
        </select>
      </label>
      <label class="field">
        <span>${state.locale === "ar" ? "الجمهور المستهدف" : "Audience summary"}</span>
        <input name="audience" required placeholder="Foodie creators in Kuwait" />
      </label>
      <label class="field">
        <span>${state.locale === "ar" ? "البداية" : "Start date"}</span>
        <input name="startDate" type="date" required />
      </label>
      <label class="field">
        <span>${state.locale === "ar" ? "النهاية" : "End date"}</span>
        <input name="endDate" type="date" required />
      </label>
      <label class="field">
        <span>${state.locale === "ar" ? "آخر موعد للزيارة" : "Visit deadline"}</span>
        <input name="visitDeadline" type="date" required />
      </label>
      <label class="field">
        <span>${state.locale === "ar" ? "آخر موعد للتسليم" : "Submission deadline"}</span>
        <input name="submissionDeadline" type="date" required />
      </label>
      <label class="field">
        <span>${state.locale === "ar" ? "الوصف بالإنجليزية" : "Description in English"}</span>
        <textarea name="descriptionEn" required placeholder="Describe the in-store experience, what to order, and what should be posted."></textarea>
      </label>
      <label class="field">
        <span>${state.locale === "ar" ? "الوصف بالعربية" : "Description in Arabic"}</span>
        <textarea name="descriptionAr" required placeholder="اكتب وصف التجربة والمتطلبات الخاصة بالمحتوى."></textarea>
      </label>
      <label class="field">
        <span>${state.locale === "ar" ? "الحالة" : "Status"}</span>
        <select name="status">
          <option value="draft">Draft</option>
          <option value="published">${t("publish")}</option>
          <option value="active">${t("active")}</option>
        </select>
      </label>
      <div class="row-wrap" style="grid-column: 1 / -1;">
        <button type="submit">${t("createCampaign")}</button>
      </div>
    </form>
  `;
}

function managerPortfolioPanel(campaigns) {
  return `
    <h3>${state.locale === "ar" ? "محفظة الحملات" : "Campaign portfolio"}</h3>
    <p class="panel-subtitle">${state.locale === "ar" ? "حالة سريعة لكل حملة مع جمهورها واستجابة المؤثرين لها." : "A quick status readout for each campaign, including target audience and influencer activity."}</p>
    <div class="stack">
      ${campaigns
        .map((campaign) => {
          const participantCount = participantsForCampaign(campaign.id).length;
          const codeStats = codeStatsForCampaign(campaign.id);
          return `
            <article class="campaign-card">
              <div class="row">
                <strong>${campaignTitle(campaign)}</strong>
                <span class="badge ${campaign.status === "active" ? "success" : ""}">${campaign.status}</span>
              </div>
              <p>${campaignDescription(campaign)}</p>
              <div class="row-wrap" style="margin-top: 12px;">
                <span class="badge">${campaign.type.replace("_", " ")}</span>
                <span class="badge">${participantCount}/${codeStats.total || 0} ${state.locale === "ar" ? "مشارك" : "participants"}</span>
                <span class="badge">${codeStats.available} ${state.locale === "ar" ? "أكواد متاحة" : "codes available"}</span>
                <span class="badge">${codeStats.reserved} ${state.locale === "ar" ? "أكواد محجوزة" : "codes reserved"}</span>
                <span class="badge">${formatDate(campaign.visitDeadline)}</span>
              </div>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

function managerOperationsPanel(campaigns) {
  const featured = campaigns[0];
  const campaignOptions = campaigns
    .map((campaign) => `<option value="${campaign.id}">${campaignTitle(campaign)}</option>`)
    .join("");
  const shareText = featured
    ? state.locale === "ar"
      ? `حملة جديدة من PICK\n${featured.titleAr}\nالفئة المناسبة: ${featured.audienceAr}\nآخر موعد للزيارة: ${formatDate(featured.visitDeadline)}\nادخلوا على المنصة وفعّلوا اهتمامكم.`
      : `New PICK campaign\n${featured.titleEn}\nBest fit: ${featured.audience}\nVisit deadline: ${formatDate(featured.visitDeadline)}\nOpen the portal and confirm your interest.`
    : "";

  return `
    <h3>${state.locale === "ar" ? "الأكواد والإعلان" : "Codes and announcement"}</h3>
    <p class="panel-subtitle">${state.locale === "ar" ? "ارفع ملف CSV للأكواد، ثم انسخ النص الجاهز للإعلان عن الحملة." : "Upload the campaign CSV code file here, then copy the ready-made campaign announcement text."}</p>
    ${
      featured
        ? `
          <form class="inline-form" id="uploadCodesForm">
            <label class="field">
              <span>${state.locale === "ar" ? "الحملة" : "Campaign"}</span>
              <select name="campaignId">${campaignOptions}</select>
            </label>
            <label class="field">
              <span>${state.locale === "ar" ? "ملف الأكواد CSV" : "Codes CSV file"}</span>
              <input name="codesFile" type="file" accept=".csv,text/csv" required />
            </label>
            <button type="submit">${state.locale === "ar" ? "رفع الأكواد" : "Upload codes"}</button>
          </form>
          <div class="share-block">${shareText}</div>
          <p class="footer-note">${state.locale === "ar" ? "صيغة CSV المتوقعة: عمود واحد يحتوي على كود في كل سطر. يمكن تجاهل عنوان مثل code أو pos_code." : "Expected CSV shape: one code per row. A header such as code or pos_code will be ignored."}</p>
        `
        : `<div class="empty-state">${state.locale === "ar" ? "أنشئ حملة أولاً ليظهر النص هنا." : "Create a campaign first and the share text will appear here."}</div>`
    }
  `;
}

function renderInfluencerView() {
  const user = currentUser();
  const myParticipants = state.participants.filter((participant) => participant.influencerId === user.id);
  const availableCampaigns = getEligibleCampaigns(user.id);
  const nextTask = nextInfluencerTask(user.id);

  renderHero({
    pageTitle: t("availableCampaigns"),
    context: `${t("influencer")} · ${user.fullName}`,
    title: state.locale === "ar" ? "كل الحملات المؤهلة أمامك في مكان واحد" : "See every eligible campaign in one place",
    copy:
      state.locale === "ar"
        ? "تصفّح الحملات المتاحة لك، أكّد اهتمامك فوراً، ثم أتم الزيارة باستخدام أحد أكواد الحملة المرفوعة وارفع رابط المنشور مع الملاحظات."
        : "Browse every campaign you're eligible for, confirm your interest instantly, receive a private assigned code, use it at the branch, and then submit your live post with feedback.",
    stats: [
      { label: state.locale === "ar" ? "حملات متاحة" : "Eligible campaigns", value: availableCampaigns.length, note: state.locale === "ar" ? "بناءً على فئتك وملفك" : "Based on your category and profile" },
      { label: state.locale === "ar" ? "حملات منضم إليها" : "Joined campaigns", value: myParticipants.length, note: state.locale === "ar" ? "معروضة في صفحتك" : "Tracked in your workspace" },
      { label: state.locale === "ar" ? "الخطوة التالية" : "Next action", value: nextTask.label, note: nextTask.note },
    ],
    metrics: [
      { label: state.locale === "ar" ? "زيارات مؤكدة" : "Validated visits", value: myParticipants.filter((item) => ["visited", "submitted", "completed"].includes(item.status)).length, note: state.locale === "ar" ? "بعد استخدام الكود المخصص" : "After the assigned code is used" },
      { label: state.locale === "ar" ? "إثباتات مرسلة" : "Proof submitted", value: myParticipants.filter((item) => ["submitted", "completed"].includes(item.status)).length, note: state.locale === "ar" ? "روابط منشورات وملاحظات" : "Links with visit feedback" },
      { label: state.locale === "ar" ? "المدينة" : "City", value: user.city, note: state.locale === "ar" ? "للترشيح الجغرافي" : "Used for targeting" },
      { label: state.locale === "ar" ? "الفئة" : "Category", value: user.category, note: state.locale === "ar" ? "أساس أهلية الحملة" : "Main campaign filter" },
    ],
    primary: influencerAvailablePanel(user.id, availableCampaigns),
    secondary: influencerProfilePanel(user),
    tertiary: influencerMyCampaignsPanel(user.id, myParticipants),
  });
}

function getEligibleCampaigns(influencerId) {
  const influencer = state.users.find((user) => user.id === influencerId);
  const joinedCampaignIds = new Set(
    state.participants
      .filter((participant) => participant.influencerId === influencerId)
      .map((participant) => participant.campaignId)
  );

  return state.campaigns.filter((campaign) => {
    if (!["published", "active"].includes(campaign.status)) return false;
    if (joinedCampaignIds.has(campaign.id)) return false;
    if (codeStatsForCampaign(campaign.id).total === 0) return false;
    if (codeStatsForCampaign(campaign.id).openSlots <= 0) return false;
    const targetingText = `${campaign.audience} ${campaign.audienceAr} ${campaign.targeting.join(" ")}`.toLowerCase();
    return targetingText.includes(influencer.category.toLowerCase()) || targetingText.includes("all");
  });
}

function nextInfluencerTask(influencerId) {
  const participant = state.participants.find((item) => item.influencerId === influencerId && item.status === "visited");
  if (participant) {
    return {
      label: state.locale === "ar" ? "إرسال الرابط" : "Submit proof",
      note: state.locale === "ar" ? "الزيارة موثقة وينقص رابط المنشور" : "Visit already validated, post link still needed",
    };
  }
  const joined = state.participants.find((item) => item.influencerId === influencerId && item.status === "confirmed");
  if (joined) {
    return {
      label: state.locale === "ar" ? "استخدم كودك" : "Use your code",
      note: state.locale === "ar" ? "تم تخصيص كود لك حصرياً لهذه الحملة" : "A private campaign code has been assigned only to you",
    };
  }
  return {
    label: state.locale === "ar" ? "استكشف الحملات" : "Discover campaigns",
    note: state.locale === "ar" ? "يمكنك الانضمام مباشرة لأي حملة مؤهلة" : "You can join any eligible campaign immediately",
  };
}

function influencerAvailablePanel(userId, campaigns) {
  return `
    <h3>${t("availableCampaigns")}</h3>
    <p class="panel-subtitle">${state.locale === "ar" ? "الحملات التالية متاحة لك الآن بناءً على ملفك وفئتك." : "The following campaigns are currently available to you based on your profile and category."}</p>
    <div class="stack">
      ${
        campaigns.length
          ? campaigns
              .map(
                (campaign) => {
                  const stats = codeStatsForCampaign(campaign.id);
                  const canJoin = stats.openSlots > 0;
                  return `
            <article class="campaign-card">
              <div class="row">
                <strong>${campaignTitle(campaign)}</strong>
                <span class="badge ${campaign.status === "active" ? "success" : ""}">${campaign.status}</span>
              </div>
              <p>${campaignDescription(campaign)}</p>
              <div class="row-wrap" style="margin-top: 12px;">
                <span class="badge">${campaign.type.replace("_", " ")}</span>
                <span class="badge">${campaign.branchIds.map((id) => branchName(id)).join(" · ")}</span>
                <span class="badge">${formatDate(campaign.visitDeadline)}</span>
                <span class="badge">${stats.total} ${state.locale === "ar" ? "كود" : "codes"}</span>
                <span class="badge">${stats.available} ${state.locale === "ar" ? "متاح" : "available"}</span>
              </div>
              <div class="row-wrap" style="margin-top: 14px;">
                <button ${canJoin ? "" : "disabled"} data-action="join-campaign" data-campaign-id="${campaign.id}" data-user-id="${userId}">${t("joinCampaign")}</button>
              </div>
            </article>
          `;
                }
              )
              .join("")
          : `<div class="empty-state">${state.locale === "ar" ? "لا توجد حملات مؤهلة جديدة حالياً." : "No new eligible campaigns right now."}</div>`
      }
    </div>
  `;
}

function influencerProfilePanel(user) {
  return `
    <h3>${t("profile")}</h3>
    <p class="panel-subtitle">${state.locale === "ar" ? "ملف المؤثر كما يراه فريق الحملات عند الاستهداف." : "Your creator profile as campaign managers see it while targeting campaigns."}</p>
    <div class="stack">
      <article class="profile-card">
        <div class="row">
          <strong>${user.fullName}</strong>
          <span class="badge success">${user.status}</span>
        </div>
        <p>${user.category} · ${user.city}</p>
        <p class="compact">${user.email}</p>
      </article>
      <article class="profile-card">
        <strong>Instagram</strong>
        <p>${user.instagram || "-"}</p>
        <p class="compact">${user.followers?.instagram || 0} followers</p>
      </article>
      <article class="profile-card">
        <strong>TikTok</strong>
        <p>${user.tiktok || "-"}</p>
        <p class="compact">${user.followers?.tiktok || 0} followers</p>
      </article>
      <article class="profile-card">
        <strong>Snapchat</strong>
        <p>${user.snapchat || "-"}</p>
        <p class="compact">${user.followers?.snapchat || 0} followers</p>
      </article>
    </div>
  `;
}

function influencerMyCampaignsPanel(userId, participants) {
  const campaigns = participants
    .map((participant) => ({
      participant,
      campaign: state.campaigns.find((campaign) => campaign.id === participant.campaignId),
    }))
    .filter(Boolean);

  return `
    <h3>${t("myCampaigns")}</h3>
    <p class="panel-subtitle">${state.locale === "ar" ? "هنا تظهر الحملات التي انضممت لها وما هو المطلوب بعدها." : "This area tracks every campaign you joined and the next required action for each one."}</p>
    <div class="stack">
      ${
        campaigns.length
          ? campaigns
              .map(({ participant, campaign }) => {
                const showVisitForm = participant.status === "confirmed";
                const showSubmissionForm = participant.status === "visited";
                return `
                  <article class="timeline-card">
                    <div class="row">
                      <strong>${campaignTitle(campaign)}</strong>
                      <span class="badge ${["visited", "submitted", "completed"].includes(participant.status) ? "success" : ""}">${participant.status}</span>
                    </div>
                    <p>${campaignDescription(campaign)}</p>
                    <div class="timeline" style="margin-top: 14px;">
                      <div class="timeline-step">
                        <span class="timeline-dot"></span>
                        <div>
                          <strong>${state.locale === "ar" ? "الزيارة" : "Visit"}</strong>
                          <p>${participant.visitCode ? `${t("assignedCode")}: ${participant.visitCode}` : state.locale === "ar" ? "سيتم تخصيص كود لك عند الانضمام" : "A private code will be assigned when you join"}</p>
                        </div>
                      </div>
                      <div class="timeline-step">
                        <span class="timeline-dot"></span>
                        <div>
                          <strong>${state.locale === "ar" ? "النشر" : "Content proof"}</strong>
                          <p>${participant.socialLink || (state.locale === "ar" ? "لم يتم رفع الرابط بعد" : "Link not submitted yet")}</p>
                        </div>
                      </div>
                    </div>
                    ${
                      showVisitForm
                        ? `
                          <form class="inline-form" data-action="visit-form" data-participant-id="${participant.id}" style="margin-top: 16px;">
                            <div class="list-card">
                              <strong>${t("assignedCode")}</strong>
                              <p>${participant.visitCode}</p>
                              <p class="compact">${state.locale === "ar" ? "هذا الكود محجوز لك فقط. استخدمه عند الكاشير ثم أكد الزيارة هنا." : "This code is reserved only for you. Use it with the cashier, then confirm your visit here."}</p>
                            </div>
                            <button type="submit">${t("validateVisit")}</button>
                          </form>
                        `
                        : ""
                    }
                    ${
                      showSubmissionForm
                        ? `
                          <form class="inline-form" data-action="proof-form" data-participant-id="${participant.id}" style="margin-top: 16px;">
                            <label class="field">
                              <span>${state.locale === "ar" ? "رابط المنشور" : "Post link"}</span>
                              <input name="socialLink" type="url" required placeholder="https://instagram.com/..." />
                            </label>
                            <label class="field">
                              <span>${state.locale === "ar" ? "ملاحظات الزيارة" : "Visit feedback"}</span>
                              <textarea name="feedback" required placeholder="${state.locale === "ar" ? "شاركنا رأيك عن التجربة داخل الفرع." : "Share your honest feedback about the branch experience."}"></textarea>
                            </label>
                            <label class="field">
                              <span>${state.locale === "ar" ? "صورة إضافية" : "Optional image"} (${t("optional")})</span>
                              <input name="image" type="file" accept="image/*" />
                            </label>
                            <button type="submit">${t("submitProof")}</button>
                          </form>
                        `
                        : ""
                    }
                  </article>
                `;
              })
              .join("")
          : `<div class="empty-state">${state.locale === "ar" ? "لم تنضم إلى أي حملة بعد." : "You have not joined any campaign yet."}</div>`
      }
    </div>
  `;
}

function attachActionHandlers() {
  document.querySelectorAll("[data-action='approve-user']").forEach((button) => {
    button.addEventListener("click", () => updateUserStatus(Number(button.dataset.userId), "active"));
  });

  document.querySelectorAll("[data-action='reject-user']").forEach((button) => {
    button.addEventListener("click", () => updateUserStatus(Number(button.dataset.userId), "rejected"));
  });

  document.querySelectorAll("[data-action='join-campaign']").forEach((button) => {
    button.addEventListener("click", () => joinCampaign(Number(button.dataset.campaignId), Number(button.dataset.userId)));
  });

  const createCampaignForm = document.getElementById("createCampaignForm");
  if (createCampaignForm) {
    createCampaignForm.addEventListener("submit", (event) => {
      event.preventDefault();
      createCampaign(new FormData(createCampaignForm));
      createCampaignForm.reset();
    });
  }

  const uploadCodesForm = document.getElementById("uploadCodesForm");
  if (uploadCodesForm) {
    uploadCodesForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(uploadCodesForm);
      await uploadCampaignCodes(Number(formData.get("campaignId")), formData.get("codesFile"));
      uploadCodesForm.reset();
    });
  }

  document.querySelectorAll("form[data-action='visit-form']").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const participantId = Number(form.dataset.participantId);
      confirmVisit(participantId);
      form.reset();
    });
  });

  document.querySelectorAll("form[data-action='proof-form']").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const participantId = Number(form.dataset.participantId);
      const formData = new FormData(form);
      submitProof(
        participantId,
        formData.get("socialLink"),
        formData.get("feedback"),
        formData.get("image")?.name || ""
      );
      form.reset();
    });
  });
}

function updateUserStatus(userId, status) {
  const user = state.users.find((item) => item.id === userId);
  if (!user) return;
  user.status = status;
  saveState();
  render();
}

function joinCampaign(campaignId, userId) {
  const alreadyJoined = state.participants.some(
    (participant) => participant.campaignId === campaignId && participant.influencerId === userId
  );
  if (alreadyJoined) return;

  const campaign = campaignById(campaignId);
  const codeStats = codeStatsForCampaign(campaignId);
  if (!campaign || codeStats.total === 0 || codeStats.openSlots <= 0) {
    window.alert(
      state.locale === "ar"
        ? "لا يمكن الانضمام قبل رفع أكواد الحملة أو عند اكتمال السعة."
        : "You cannot join until campaign codes are uploaded and slots are still available."
    );
    return;
  }

  const assignedCode = codesForCampaign(campaignId).find((code) => code.status === "available");
  if (!assignedCode) {
    window.alert(
      state.locale === "ar"
        ? "لا يوجد كود متاح حالياً لهذه الحملة."
        : "There is no available code left for this campaign."
    );
    return;
  }

  const participantId = state.nextParticipantId++;

  state.participants.push({
    id: participantId,
    campaignId,
    influencerId: userId,
    status: "confirmed",
    assignedCodeId: assignedCode.id,
    selectedBranchId: campaign.branchIds[0],
    visitCode: assignedCode.codeValue,
    socialLink: "",
    feedback: "",
    imageName: "",
  });
  assignedCode.status = "reserved";
  assignedCode.reservedByParticipantId = participantId;
  saveState();
  render();
}

function confirmVisit(participantId) {
  const participant = state.participants.find((item) => item.id === participantId);
  if (!participant) return;
  const campaignCode = state.campaignCodes.find((item) => item.id === participant.assignedCodeId);
  if (!campaignCode) {
    window.alert(
      state.locale === "ar"
        ? "لا يوجد كود مخصص لهذه المشاركة."
        : "There is no assigned code for this campaign participation."
    );
    return;
  }
  if (campaignCode.reservedByParticipantId !== participantId) {
    window.alert(
      state.locale === "ar"
        ? "هذا الكود ليس مخصصاً لهذا المؤثر."
        : "This code is not assigned to this influencer."
    );
    return;
  }
  if (campaignCode.status === "used") {
    participant.status = "visited";
    saveState();
    render();
    return;
  }
  if (campaignCode.status !== "reserved") {
    window.alert(
      state.locale === "ar"
        ? "هذا الكود غير جاهز لتأكيد الزيارة."
        : "This code is not in a valid state for visit confirmation."
    );
    return;
  }
  campaignCode.status = "used";
  participant.visitCode = campaignCode.codeValue;
  participant.status = "visited";
  saveState();
  render();
}

function submitProof(participantId, socialLink, feedback, imageName) {
  const participant = state.participants.find((item) => item.id === participantId);
  if (!participant || !socialLink || !feedback) return;
  participant.socialLink = socialLink;
  participant.feedback = feedback;
  participant.imageName = imageName;
  participant.status = "submitted";
  saveState();
  render();
}

function createCampaign(formData) {
  const payload = Object.fromEntries(formData.entries());
  state.campaigns.unshift({
    id: state.nextCampaignId++,
    titleEn: payload.titleEn,
    titleAr: payload.titleAr,
    descriptionEn: payload.descriptionEn,
    descriptionAr: payload.descriptionAr,
    type: payload.type,
    status: payload.status,
    createdBy: currentUser().id,
    audience: payload.audience,
    audienceAr: payload.audience,
    startDate: payload.startDate,
    endDate: payload.endDate,
    visitDeadline: payload.visitDeadline,
    submissionDeadline: payload.submissionDeadline,
    branchIds: state.branches.map((branch) => branch.id),
    targeting: [payload.audience],
    requireBranchSelection: false,
    requireVisitDate: false,
  });
  saveState();
  render();
}

async function uploadCampaignCodes(campaignId, file) {
  const campaign = campaignById(campaignId);
  if (!campaign || !(file instanceof File)) return;

  const rawText = await file.text();
  const parsedCodes = rawText
    .split(/\r?\n/)
    .flatMap((line) => line.split(","))
    .map((value) => normalizeCode(value))
    .filter(Boolean)
    .filter((value) => !["CODE", "POS_CODE", "POS CODE", "CAMPAIGN_CODE", "CAMPAIGN CODE"].includes(value));

  const uniqueCodes = [...new Set(parsedCodes)];
  const existing = new Set(codesForCampaign(campaignId).map((code) => normalizeCode(code.codeValue)));
  const newCodes = uniqueCodes.filter((codeValue) => !existing.has(codeValue));

  if (!newCodes.length) {
    window.alert(
      state.locale === "ar"
        ? "لم يتم العثور على أكواد جديدة صالحة في ملف CSV."
        : "No new valid campaign codes were found in the CSV file."
    );
    return;
  }

  newCodes.forEach((codeValue) => {
    state.campaignCodes.push({
      id: state.nextCodeId++,
      campaignId,
      codeValue,
      status: "available",
      reservedByParticipantId: null,
    });
  });

  saveState();
  render();
  window.alert(
    state.locale === "ar"
      ? `تم رفع ${newCodes.length} كود جديد للحملة ${campaign.titleAr}.`
      : `${newCodes.length} new codes were uploaded for ${campaign.titleEn}.`
  );
}
