function defaultReportFilters() {
  return {
    campaigns: {
      campaignId: "",
      status: "",
      managerId: "",
      dateFrom: "",
      dateTo: "",
    },
    influencers: {
      query: "",
      cityId: "",
      categoryId: "",
      status: "",
      tag: "",
      platform: "",
      dateFrom: "",
      dateTo: "",
    },
    submissions: {
      campaignId: "",
      influencerId: "",
      platform: "",
      dateFrom: "",
      dateTo: "",
    },
    codes: {
      query: "",
      campaignId: "",
      status: "",
      assignment: "",
      dateFrom: "",
      dateTo: "",
    },
  };
}

function defaultReportSorts() {
  return {
    influencers: {
      key: "joined",
      direction: "desc",
    },
    submissions: {
      key: "submittedAt",
      direction: "desc",
    },
  };
}

const state = {
  locale: loadLocale(),
  currentUser: null,
  data: null,
  publicData: { cities: [], categories: [], platforms: [], tags: [] },
  flash: null,
  currentPage: null,
  mobileNavOpen: false,
  selectedCampaignId: null,
  selectedBranchId: null,
  selectedInfluencerId: null,
  selectedManagerId: null,
  influencerProfileReturnPage: null,
  campaignCodesByCampaign: {},
  manualReserveCodeId: null,
  authMode: "login",
  generatedLink: "",
  resetToken: new URLSearchParams(window.location.search).get("resetToken") || "",
  pendingCampaignDeeplink: null,
  reportTab: "campaigns",
  reportSorts: defaultReportSorts(),
  influencerFilters: {
    query: "",
    cityId: "",
    categoryId: "",
    status: "",
    tag: "",
  },
  reportFilters: defaultReportFilters(),
  campaignSearch: "",
  apiInflightCount: 0,
  passwordEditorUserId: null,
  masterDataEditor: {
    type: "",
    id: null,
  },
  masterDataShowInactive: {
    city: false,
    category: false,
    platform: false,
    tag: false,
  },
};

const app = document.getElementById("app");

initialize();

async function initialize() {
  bindGlobalEvents();
  const campaignParam = Number(new URLSearchParams(window.location.search).get("campaign"));
  if (campaignParam) {
    state.pendingCampaignDeeplink = campaignParam;
    window.history.replaceState({}, "", window.location.pathname);
  }
  state.publicData = await api("/api/public-metadata").catch(() => ({ cities: [], categories: [], platforms: [], tags: [] }));
  const session = await api("/api/session").catch(() => ({ authenticated: false }));
  if (session.authenticated) {
    state.currentUser = session.user;
    state.currentPage = defaultPageForRole(session.user.role);
    await loadBootstrap();
    return;
  }
  if (state.resetToken) state.authMode = "reset";
  render();
}

function loadLocale() {
  try {
    return localStorage.getItem("pickLocale") || "en";
  } catch (error) {
    return "en";
  }
}

function saveLocale(locale) {
  state.locale = locale || "en";
  try {
    localStorage.setItem("pickLocale", state.locale);
  } catch (error) {
    // ignore
  }
}

function l(english, arabic) {
  return state.locale === "ar" ? arabic : english;
}

function localizedCopy(value) {
  if (value && typeof value === "object" && ("en" in value || "ar" in value)) {
    return state.locale === "ar" ? value.ar || value.en || "" : value.en || value.ar || "";
  }
  return String(value || "");
}

function captureFocusedField() {
  const active = document.activeElement;
  if (!active || !app.contains(active)) return null;
  if (!["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName)) return null;
  return {
    id: active.id || "",
    name: active.name || "",
    formId: active.form?.id || "",
    selectionStart: typeof active.selectionStart === "number" ? active.selectionStart : null,
    selectionEnd: typeof active.selectionEnd === "number" ? active.selectionEnd : null,
  };
}

function restoreFocusedField(snapshot) {
  if (!snapshot) return;
  let selector = "";
  if (snapshot.id) {
    selector = `#${CSS.escape(snapshot.id)}`;
  } else if (snapshot.formId && snapshot.name) {
    selector = `#${CSS.escape(snapshot.formId)} [name="${CSS.escape(snapshot.name)}"]`;
  } else if (snapshot.name) {
    selector = `[name="${CSS.escape(snapshot.name)}"]`;
  }
  if (!selector) return;
  const nextField = app.querySelector(selector);
  if (!nextField) return;
  nextField.focus({ preventScroll: true });
  if (typeof nextField.setSelectionRange === "function" && snapshot.selectionStart !== null && snapshot.selectionEnd !== null) {
    nextField.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd);
  }
}

function roleLabel(role) {
  if (role === "admin") return l("Admin", "مدير النظام");
  if (role === "campaign_manager") return l("Campaign Manager", "مدير الحملات");
  return l("Influencer", "مؤثر");
}

function campaignStatusLabel(status) {
  if (status === "live") return l("Live", "مباشرة");
  if (status === "draft") return l("Draft", "مسودة");
  if (status === "completed") return l("Completed", "مكتملة");
  if (status === "deactivated") return l("Deactivated", "معطلة");
  return status || "-";
}

function campaignStatusTone(status) {
  if (status === "live") return "success";
  if (status === "draft") return "warning";
  if (["deactivated", "blocked"].includes(status)) return "danger";
  return "";
}

function codeStatusLabel(status) {
  if (status === "available") return l("Available", "متاح");
  if (status === "reserved") return l("Reserved", "محجوز");
  if (status === "blocked") return l("Blocked", "محظور");
  if (status === "used") return l("Used", "مستخدم");
  return status || "-";
}

function userInitials(user) {
  return String(user?.fullName || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "PI";
}

function renderUserAvatar(user, className = "") {
  const classes = `user-avatar ${className}`.trim();
  if (user?.avatarPath) {
    return `<img class="${classes}" src="${user.avatarPath}" alt="${escapeHtml(user.fullName || "Profile")}" />`;
  }
  return `<div class="${classes} user-avatar-fallback">${escapeHtml(userInitials(user))}</div>`;
}

function defaultPageForRole(role) {
  if (role === "admin") return "dashboard";
  if (role === "campaign_manager") return "dashboard";
  return "dashboard";
}

function validPagesForRole(role) {
  if (role === "admin") {
    return new Set(["dashboard", "influencers", "influencer-profile", "campaigns", "campaign-edit", "campaign-view", "branches", "branch-edit", "master-data", "managers", "manager-edit", "reports", "profile"]);
  }
  if (role === "campaign_manager") {
    return new Set(["dashboard", "influencers", "influencer-profile", "campaigns", "campaign-edit", "campaign-view", "reports", "profile"]);
  }
  return new Set(["dashboard", "availableCampaigns", "campaign-preview", "myCampaigns", "profile"]);
}

function normalizePage(page) {
  if (!state.currentUser) return "dashboard";
  if (page === "approvals") return "influencers";
  return validPagesForRole(state.currentUser.role).has(page) ? page : defaultPageForRole(state.currentUser.role);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function iconSvg(name, extraClass = "") {
  const iconName = name || "user-circle";
  const classes = ["icon", extraClass].filter(Boolean).join(" ");
  return `<svg class="${classes}" aria-hidden="true"><use href="/icons.svg#${iconName}"></use></svg>`;
}

function flash(message, tone = "info") {
  state.flash = { message, tone };
  syncFlashLayer();
  window.clearTimeout(flash._timeout);
  flash._timeout = window.setTimeout(() => {
    state.flash = null;
    syncFlashLayer();
  }, tone === "error" ? 9000 : 4000);
}

function fieldWrapper(field) {
  return field?.closest(".field");
}

function clearFieldError(field) {
  if (!field || !["INPUT", "TEXTAREA", "SELECT"].includes(field.tagName)) return;
  field.setCustomValidity("");
  const wrapper = fieldWrapper(field);
  if (!wrapper) return;
  wrapper.classList.remove("has-error");
  const note = wrapper.querySelector(".field-error");
  if (note) note.remove();
}

function clearFormErrors(form) {
  form?.querySelectorAll("input, textarea, select").forEach((field) => clearFieldError(field));
}

function setFieldError(form, name, message) {
  const field = form?.querySelector(`[name="${CSS.escape(name)}"]`);
  if (!field) return false;
  field.setCustomValidity(message);
  const wrapper = fieldWrapper(field);
  if (wrapper) {
    wrapper.classList.add("has-error");
    const existing = wrapper.querySelector(".field-error");
    if (existing) {
      existing.textContent = message;
    } else {
      wrapper.insertAdjacentHTML("beforeend", `<small class="field-error">${escapeHtml(message)}</small>`);
    }
  }
  return true;
}

function syncInvalidFields(form) {
  form?.querySelectorAll("input, textarea, select").forEach((field) => {
    const wrapper = fieldWrapper(field);
    if (!wrapper) return;
    if (field.validity.valid) {
      wrapper.classList.remove("has-error");
      const note = wrapper.querySelector(".field-error");
      if (note) note.remove();
      return;
    }
    wrapper.classList.add("has-error");
    const message = field.validationMessage;
    const existing = wrapper.querySelector(".field-error");
    if (existing) {
      existing.textContent = message;
    } else {
      wrapper.insertAdjacentHTML("beforeend", `<small class="field-error">${escapeHtml(message)}</small>`);
    }
  });
}

function reportFormValidity(form) {
  const valid = form.reportValidity();
  syncInvalidFields(form);
  return valid;
}

function applyApiErrorToForm(form, message) {
  if (!form || !message) return false;
  const mappings = [
    { match: "This email already exists.", fields: ["email"] },
    { match: "Invalid email or password.", fields: ["email", "password"] },
    { match: "No account found for this email.", fields: ["email"] },
    { match: "Reset link is invalid.", fields: ["password"] },
    { match: "Reset link has expired.", fields: ["password"] },
    { match: "Full name is required.", fields: ["fullName"] },
    { match: "Gender is required", fields: ["gender"] },
    { match: "Mobile number is required.", fields: ["mobile"] },
    { match: "Mobile number must be 8 digits", fields: ["mobile"] },
    { match: "City is required.", fields: ["cityId"] },
    { match: "Instagram is required.", fields: ["instagram"] },
    { match: "Password is required.", fields: ["password"] },
    { match: "New password is required.", fields: ["password"] },
    { match: "Password must be", fields: ["password"] },
  ];
  const matched = mappings.find((entry) => String(message).includes(entry.match));
  if (!matched) return false;
  matched.fields.forEach((name) => setFieldError(form, name, message));
  syncInvalidFields(form);
  return true;
}

function syncFlashLayer() {
  const layer = app.querySelector("[data-flash-layer]");
  if (!layer) return;
  layer.innerHTML = renderFlash();
}

function syncLoadingBar() {
  const bar = app.querySelector("[data-global-loading-bar]");
  if (!bar) return;
  bar.classList.toggle("is-active", state.apiInflightCount > 0);
}

function formatDate(value) {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat(state.locale === "ar" ? "ar-KW" : "en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(value));
  } catch (error) {
    return value;
  }
}

function formatDateTime(value) {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat(state.locale === "ar" ? "ar-KW" : "en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch (error) {
    return value;
  }
}

function kuwaitMobileLocal(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 11 && digits.startsWith("965")) return digits.slice(3);
  if (digits.length === 8) return digits;
  return digits;
}

function validateKuwaitMobile(value) {
  const local = kuwaitMobileLocal(value);
  return !local || /^\d{8}$/.test(local)
    ? null
    : l("Mobile number must be 8 digits after +965.", "يجب أن يكون رقم الهاتف 8 أرقام بعد +965.");
}

function validatePasswordStrength(value) {
  const password = String(value || "");
  if (!password) return l("Password is required.", "كلمة المرور مطلوبة.");
  if (password.length < 8) {
    return l("Password must be at least 8 characters.", "يجب أن تكون كلمة المرور 8 أحرف على الأقل.");
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    return l(
      "Password must include uppercase, lowercase, and a number.",
      "يجب أن تحتوي كلمة المرور على حرف كبير وحرف صغير ورقم."
    );
  }
  return null;
}

function passwordRequirementHint() {
  return l(
    "Use at least 8 characters with uppercase, lowercase, and a number.",
    "استخدم 8 أحرف على الأقل مع حرف كبير وحرف صغير ورقم."
  );
}

function renderKuwaitMobileField(name, value = "", required = false) {
  return `
    <div class="phone-input-row">
      <span class="phone-prefix">+965</span>
      <input name="${name}" data-kuwait-mobile inputmode="numeric" pattern="[0-9]{8}" maxlength="8" ${required ? "required" : ""} value="${escapeHtml(kuwaitMobileLocal(value))}" placeholder="XXXXXXXX" />
    </div>
  `;
}

function renderPasswordField(name, options = {}) {
  const {
    required = false,
    hint = "",
    autocomplete = "current-password",
    label = l("Password", "كلمة المرور"),
    value = "",
    minLength = null,
  } = options;
  return `
    <label class="field">
      <span>${label}${required ? ' <em class="required-mark">*</em>' : ""}</span>
      <div class="password-field">
        <input name="${name}" type="password" ${required ? "required" : ""} ${minLength ? `minlength="${minLength}"` : ""} autocomplete="${autocomplete}" value="${escapeHtml(value)}" />
        <button type="button" class="password-field__toggle" data-action="toggle-password-visibility">${l("Show", "إظهار")}</button>
      </div>
      ${hint ? `<small class="field-help">${escapeHtml(hint)}</small>` : ""}
    </label>
  `;
}

function lockFormButton(form) {
  const button = form?.querySelector("button[type='submit']");
  if (!button) return null;
  if (!button.dataset.originalLabel) button.dataset.originalLabel = button.textContent || "";
  button.disabled = true;
  button.textContent = l("Working…", "جارٍ التنفيذ…");
  return button;
}

function unlockFormButton(button) {
  if (!button) return;
  button.disabled = false;
  if (button.dataset.originalLabel) button.textContent = button.dataset.originalLabel;
}

function syncImagePreview(input) {
  if (!input || !input.matches("input[type='file'][accept*='image']")) return;
  let preview = input.parentElement?.querySelector(".image-preview");
  const file = input.files?.[0];
  if (!file) {
    if (preview) preview.remove();
    return;
  }
  if (!preview) {
    preview = document.createElement("img");
    preview.className = "image-preview";
    input.insertAdjacentElement("afterend", preview);
  }
  const reader = new FileReader();
  reader.onload = () => {
    preview.src = String(reader.result || "");
    preview.alt = file.name || "preview";
  };
  reader.readAsDataURL(file);
}

function renderGenderSelect(name, selectedValue = "", required = false) {
  const normalized = String(selectedValue || "").toLowerCase();
  return `
    <select name="${name}" ${required ? "required" : ""}>
      <option value="">${l("Select", "اختر")}</option>
      <option value="male" ${normalized === "male" ? "selected" : ""}>${l("Male", "ذكر")}</option>
      <option value="female" ${normalized === "female" ? "selected" : ""}>${l("Female", "أنثى")}</option>
    </select>
  `;
}

function genderLabel(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "male") return l("Male", "ذكر");
  if (normalized === "female") return l("Female", "أنثى");
  return l("Not set", "غير محدد");
}

function cityName(cityId) {
  const city = [...(state.data?.cities || []), ...(state.publicData?.cities || [])].find((item) => item.id === Number(cityId));
  return city ? (state.locale === "ar" ? city.nameAr : city.nameEn) : "-";
}

function categoryName(categoryId) {
  const category = [...(state.data?.categories || []), ...(state.publicData?.categories || [])].find((item) => item.id === Number(categoryId));
  return category ? (state.locale === "ar" ? category.nameAr : category.nameEn) : "-";
}

function branchName(branchId) {
  const branch = state.data?.branches?.find((item) => item.id === Number(branchId));
  return branch ? (state.locale === "ar" ? branch.nameAr : branch.nameEn) : "-";
}

function branchDisplayName(branch) {
  if (!branch) return "-";
  return (state.locale === "ar" ? branch.nameAr : branch.nameEn) || branch.nameEn || branch.nameAr || "-";
}

function campaignTitle(campaign) {
  if (state.locale === "ar") return campaign.titleAr || campaign.titleEn;
  return campaign.titleEn || campaign.titleAr;
}

function campaignDescription(campaign) {
  if (state.locale === "ar") return campaign.descriptionAr || campaign.descriptionEn;
  return campaign.descriptionEn || campaign.descriptionAr;
}

function campaignAudience(campaign) {
  if (state.locale === "ar") return campaign.audienceAr || campaign.audience;
  return campaign.audience || campaign.audienceAr;
}

function currentCampaigns() {
  return state.data?.campaigns || [];
}

function allInfluencers() {
  return (state.data?.users || []).filter((user) => user.role === "influencer");
}

function allManagers() {
  return (state.data?.users || []).filter((user) => user.role === "campaign_manager");
}

function selectedManager() {
  return allManagers().find((user) => user.id === Number(state.selectedManagerId)) || null;
}

function campaignParticipants(campaignId) {
  return (state.data?.participants || []).filter((participant) => participant.campaignId === Number(campaignId));
}

function myParticipantForCampaign(campaignId) {
  return (state.data?.participants || []).find((participant) => participant.campaignId === Number(campaignId)) || null;
}

function eligibleCampaigns() {
  const eligible = new Set(state.data?.eligibleCampaignIds || []);
  return currentCampaigns().filter((campaign) => eligible.has(campaign.id));
}

function pendingApprovals() {
  return allInfluencers().filter((user) => user.status === "pending");
}

function campaignMatchesInfluencer(campaign, influencer) {
  if (campaign.status !== "live") return false;
  if (influencer.status !== "active") return false;
  if ((campaign.targetCityIds || []).length && !(campaign.targetCityIds || []).includes(influencer.cityId)) return false;
  if ((campaign.targetCategoryIds || []).length && !(campaign.targetCategoryIds || []).includes(influencer.categoryId)) return false;
  if (campaign.targetGender && campaign.targetGender !== "any" && influencer.gender !== campaign.targetGender) return false;
  const totalFollowers =
    (Number(influencer.followers?.instagram) || 0) +
    (Number(influencer.followers?.tiktok) || 0) +
    (Number(influencer.followers?.snapchat) || 0);
  if ((Number(campaign.minFollowers) || 0) > 0 && totalFollowers < Number(campaign.minFollowers)) return false;
  if ((campaign.targetPlatformIds || []).length) {
    const preferred = String(influencer.preferredPlatform || "").toLowerCase();
    const platformMatched = (campaign.targetPlatformIds || []).some((platformId) => {
      const platform = (state.data?.platforms || []).find((item) => item.id === Number(platformId));
      const name = String(platform?.nameEn || "").toLowerCase();
      if (!name) return false;
      if (preferred === name) return true;
      if (name === "instagram") return (Number(influencer.followers?.instagram) || 0) > 0;
      if (name === "tiktok") return (Number(influencer.followers?.tiktok) || 0) > 0;
      if (name === "snapchat") return (Number(influencer.followers?.snapchat) || 0) > 0;
      return false;
    });
    if (!platformMatched) return false;
  }
  if ((campaign.targetTags || []).length) {
    const influencerTags = new Set((influencer.tags || []).map((tag) => String(tag).toLowerCase()));
    const matched = campaign.targetTags.some((tag) => influencerTags.has(String(tag).toLowerCase()));
    if (!matched) return false;
  }
  return true;
}

function eligibleInfluencerCount(campaign) {
  return allInfluencers().filter((influencer) => campaignMatchesInfluencer(campaign, influencer)).length;
}

function eligibleInfluencersForCampaign(campaign) {
  return (state.data?.users || [])
    .filter((user) => user.role === "influencer" && user.status === "active" && user.mobile)
    .filter((user) => campaignMatchesInfluencer(campaign, user))
    .filter(
      (user) =>
        !(state.data?.participants || []).some(
          (participant) =>
            participant.influencerId === user.id &&
            participant.campaignId === campaign.id &&
            participant.status !== "canceled"
        )
    )
    .sort((left, right) => left.fullName.localeCompare(right.fullName));
}

function notificationCards() {
  return state.data?.notifications || [];
}

function auditActionLabel(action) {
  const labels = {
    "auth.login": l("Signed in", "سجل الدخول"),
    "user.status_change": l("Changed user status", "غيّر حالة المستخدم"),
    "user.password_set": l("Set password", "عيّن كلمة المرور"),
    "user.password_reset": l("Reset password", "أعاد تعيين كلمة المرور"),
    "user.password_forgot_requested": l("Requested reset link", "طلب رابط إعادة التعيين"),
    "user.reset_link_generated": l("Generated reset link", "ولّد رابط إعادة التعيين"),
    "user.manager_created": l("Created manager", "أنشأ مديراً"),
    "campaign.codes_uploaded": l("Uploaded codes", "رفع الأكواد"),
    "campaign.codes_reset": l("Reset codes", "أعاد ضبط الأكواد"),
    "campaign.joined": l("Joined campaign", "انضم إلى الحملة"),
    "campaign.manual_reserve": l("Reserved offline code", "حجز كوداً أوفلاين"),
    "campaign.duplicated": l("Duplicated campaign", "نسخ الحملة"),
    "participant.removed": l("Removed participant", "أزال مشاركاً"),
    "participant.self_canceled": l("Canceled participation", "ألغى المشاركة"),
    "participant.submission": l("Submitted proof", "أرسل الإثبات"),
    "branch.pin_rotated": l("Rotated branch PIN", "غيّر رمز الفرع"),
  };
  return labels[action] || action || l("Unknown action", "إجراء غير معروف");
}

function auditActorLabel(event) {
  if (!event?.actorId) return l("System", "النظام");
  return `${event.actorName || l("Unknown", "غير معروف")} · ${roleLabel(event.actorRole)}`;
}

function auditTargetLabel(event) {
  if (!event) return l("Unknown target", "هدف غير معروف");
  if (event.targetType === "campaign") {
    const campaign = currentCampaigns().find((item) => item.id === Number(event.targetId));
    return campaign ? campaignTitle(campaign) : `${l("Campaign", "حملة")} #${event.targetId}`;
  }
  if (event.targetType === "branch") {
    const branch = (state.data?.branches || []).find((item) => item.id === Number(event.targetId));
    return branch ? branchDisplayName(branch) : `${l("Branch", "فرع")} #${event.targetId}`;
  }
  if (event.targetType === "user") {
    const user = (state.data?.users || []).find((item) => item.id === Number(event.targetId));
    return user?.fullName || user?.email || `${l("User", "مستخدم")} #${event.targetId}`;
  }
  if (event.targetType === "participant") {
    const participant = (state.data?.participants || []).find((item) => item.id === Number(event.targetId));
    if (!participant) return `${l("Participant", "مشارك")} #${event.targetId}`;
    const campaign = currentCampaigns().find((item) => item.id === Number(participant.campaignId));
    const name = participant.influencerName || participant.offlineName || `${l("Participant", "مشارك")} #${participant.id}`;
    return campaign ? `${name} · ${campaignTitle(campaign)}` : name;
  }
  return `${event.targetType || l("Target", "هدف")} #${event.targetId}`;
}

function renderAuditTarget(event) {
  if (!event) return escapeHtml(l("Unknown target", "هدف غير معروف"));
  if (event.targetType === "campaign") {
    const campaign = currentCampaigns().find((item) => item.id === Number(event.targetId));
    return renderCampaignTitleLink(campaign, { campaignId: event.targetId, fallback: `${l("Campaign", "حملة")} #${event.targetId}` });
  }
  return escapeHtml(auditTargetLabel(event));
}

function auditMetaValue(key, value) {
  if (value === null || value === undefined || value === "") return "";
  if (["from", "to", "status"].includes(key)) {
    if (["confirmed", "visited", "submitted", "completed", "canceled"].includes(String(value))) {
      return participantStatusLabel(String(value));
    }
    if (["live", "draft", "completed", "deactivated"].includes(String(value))) {
      return campaignStatusLabel(String(value));
    }
  }
  return String(value);
}

function auditMetaLabel(key) {
  const labels = {
    from: l("From", "من"),
    to: l("To", "إلى"),
    email: l("Email", "البريد"),
    added: l("Added", "تمت الإضافة"),
    deleted: l("Deleted", "تم الحذف"),
    participantId: l("Participant", "المشارك"),
    codeId: l("Code", "الكود"),
    offlineName: l("Offline name", "اسم أوفلاين"),
    canceledParticipants: l("Canceled", "الملغاة"),
    sourceCampaignId: l("Source", "المصدر"),
    campaignId: l("Campaign", "الحملة"),
  };
  return labels[key] || key;
}

function renderAuditMeta(event) {
  const entries = Object.entries(event?.meta || {}).filter(([, value]) => value !== null && value !== undefined && value !== "");
  if (!entries.length) return "";
  return `<div class="row-wrap" style="margin-top: 10px;">${entries
    .map(([key, value]) => `<span class="badge">${escapeHtml(`${auditMetaLabel(key)}: ${auditMetaValue(key, value)}`)}</span>`)
    .join("")}</div>`;
}

function renderRecentActivityPanel() {
  const events = (state.data?.auditEvents || []).slice(-25).reverse();
  return `
    <section class="panel">
      <h3>${l("Recent Activity", "النشاط الأخير")}</h3>
      <p class="panel-subtitle">${l("Recent operational actions across campaigns, users, branches, and submissions.", "آخر الإجراءات التشغيلية عبر الحملات والمستخدمين والأفرع والتسليمات.")}</p>
      ${
        events.length
          ? `<div class="stack">${events
              .map(
                (event) => `
                  <article class="list-card">
                    <div class="row">
                      <strong>${escapeHtml(auditActionLabel(event.action))}</strong>
                      <span class="badge">${escapeHtml(formatDateTime(event.at))}</span>
                    </div>
                    <p class="compact">${escapeHtml(auditActorLabel(event))}</p>
                    <p class="compact">${renderAuditTarget(event)}</p>
                    ${renderAuditMeta(event)}
                  </article>
                `
              )
              .join("")}</div>`
          : `<div class="empty-state">${l("No recent activity yet.", "لا يوجد نشاط حديث بعد.")}</div>`
      }
    </section>
  `;
}

function renderHeroStats(options = {}) {
  if (options.hideHeroStats) return "";
  if (options.showNotifications === true && notificationCards().length) {
    return notificationCards()
      .slice(0, 3)
      .map(
        (item) => `
          <article class="hero-stat">
            <span class="eyebrow">${escapeHtml(localizedCopy(item.title))}</span>
            <strong>${escapeHtml(localizedCopy(item.body))}</strong>
          </article>
        `
      )
      .join("");
  }

  if (Array.isArray(options.heroStats) && options.heroStats.length) {
    return options.heroStats
      .map(
        (item) => `
          <article class="hero-stat">
            <span class="eyebrow">${escapeHtml(item.label)}</span>
            <strong>${item.allowHtml ? item.value : escapeHtml(item.value)}</strong>
            ${item.note ? `<p class="hero-stat-note">${escapeHtml(item.note)}</p>` : ""}
          </article>
        `
      )
      .join("");
  }

  return `<article class="hero-stat"><span class="eyebrow">${l("Status", "الحالة")}</span><strong>${l("Everything is saved and live in this workspace.", "كل شيء محفوظ ومتاح داخل مساحة العمل هذه.")}</strong></article>`;
}

function reportSummary() {
  return state.data?.reports?.summary || {};
}

function dateValue(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function withinDateRange(value, from, to) {
  const current = dateValue(value);
  if (!from && !to) return true;
  if (!current) return false;
  const fromValue = dateValue(from);
  const toValue = dateValue(to);
  if (fromValue && current < fromValue) return false;
  if (toValue && current > toValue) return false;
  return true;
}

function rangesOverlap(start, end, from, to) {
  if (!from && !to) return true;
  const startValue = dateValue(start);
  const endValue = dateValue(end || start);
  const fromValue = dateValue(from);
  const toValue = dateValue(to);
  if (!startValue && !endValue) return false;
  const effectiveEnd = endValue || startValue;
  if (fromValue && effectiveEnd < fromValue) return false;
  if (toValue && startValue > toValue) return false;
  return true;
}

function buildReportsDashboardData() {
  const campaigns = currentCampaigns();
  const campaignById = new Map(campaigns.map((campaign) => [campaign.id, campaign]));
  const influencers = allInfluencers();
  const influencerById = new Map(influencers.map((user) => [user.id, user]));
  const codeRows = state.data?.reports?.codes || [];

  const participantRows = (state.data?.participants || [])
    .map((participant) => {
      const campaign = campaignById.get(participant.campaignId) || null;
      const influencer = participant.influencerId ? influencerById.get(participant.influencerId) || null : null;
      return {
        ...participant,
        campaign,
        influencer,
        influencerName: influencer?.fullName || participant.offlineName || "",
        cityId: influencer?.cityId || null,
        categoryId: influencer?.categoryId || null,
        tags: influencer?.tags || [],
      };
    });

  const submissions = participantRows.filter((participant) => participant.socialLink || participant.feedback);

  const campaignRows = campaigns.map((campaign) => {
    const campaignParticipants = participantRows.filter((participant) => participant.campaignId === campaign.id);
    const campaignCodes = codeRows.filter((code) => code.campaignId === campaign.id);
    const eligibleCount = eligibleInfluencerCount(campaign);
    const platformJoined = campaignParticipants.filter((participant) => participant.status !== "canceled" && participant.source !== "offline").length;
    const offlineReserved = campaignParticipants.filter((participant) => participant.status !== "canceled" && participant.source === "offline").length;
    const submitted = campaignParticipants.filter(
      (participant) => participant.source !== "offline" && ["submitted", "completed"].includes(participant.status)
    ).length;
    const pendingProof = Math.max(platformJoined - submitted, 0);
    const reservedCodes = campaignCodes.filter((code) => code.status === "reserved").length;
    const availableCodes = campaignCodes.filter((code) => code.status === "available").length;
    const blockedCodes = campaignCodes.filter((code) => code.status === "blocked").length;
    const totalCodes = campaignCodes.length;
    return {
      campaignId: campaign.id,
      campaign,
      title: campaignTitle(campaign),
      status: campaign.status,
      managerId: campaign.createdBy || null,
      managerName: managerName(campaign.createdBy),
      eligibleCount,
      platformJoined,
      offlineReserved,
      submitted,
      pendingProof,
      totalCodes,
      reservedCodes,
      availableCodes,
      blockedCodes,
      joinRate: safePercent(platformJoined, eligibleCount),
      codeInterestRate: safePercent(reservedCodes, totalCodes),
      postingRate: safePercent(submitted, platformJoined),
      visitDeadline: campaign.visitDeadline,
      submissionDeadline: campaign.submissionDeadline,
    };
  });

  const influencerRows = influencers
    .map((influencer) => {
      const rows = participantRows.filter((participant) => participant.influencerId === influencer.id);
      const joined = rows.filter((participant) => participant.status !== "canceled").length;
      const submitted = rows.filter((participant) => ["submitted", "completed"].includes(participant.status)).length;
      const pending = rows.filter((participant) => participant.source !== "offline" && participantNeedsProof(participant.status)).length;
      const lastActivityDate =
        rows
          .map((participant) => participant.submittedAt || participant.joinedAt)
          .filter(Boolean)
          .sort()
          .at(-1) || "";
      return {
        influencerId: influencer.id,
        fullName: influencer.fullName,
        cityId: influencer.cityId,
        categoryId: influencer.categoryId,
        status: influencer.status,
        tags: influencer.tags || [],
        preferredPlatform: influencer.preferredPlatform || "",
        signupDate: influencer.createdAt || "",
        joined,
        submitted,
        pending,
        canceled: rows.filter((participant) => participant.status === "canceled").length,
        completionRate: safePercent(submitted, joined),
        lastActivityDate,
      };
    });

  const platformBreakdown = Array.from(
    submissions.reduce((map, participant) => {
      const key = participant.platform || l("Not set", "غير محدد");
      map.set(key, (map.get(key) || 0) + 1);
      return map;
    }, new Map())
  )
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count);

  return {
    campaigns,
    campaignRows,
    participantRows,
    submissions,
    influencerRows,
    codeRows,
    platformBreakdown,
    summary: {
      campaignCount: campaigns.length,
      liveCampaigns: campaigns.filter((campaign) => campaign.status === "live").length,
      draftCampaigns: campaigns.filter((campaign) => campaign.status === "draft").length,
      completedCampaigns: campaigns.filter((campaign) => campaign.status === "completed").length,
      deactivatedCampaigns: campaigns.filter((campaign) => campaign.status === "deactivated").length,
      eligibleCount: campaignRows.reduce((sum, row) => sum + row.eligibleCount, 0),
      totalCodes: campaignRows.reduce((sum, row) => sum + row.totalCodes, 0),
      reservedCodes: campaignRows.reduce((sum, row) => sum + row.reservedCodes, 0),
      availableCodes: campaignRows.reduce((sum, row) => sum + row.availableCodes, 0),
      blockedCodes: campaignRows.reduce((sum, row) => sum + row.blockedCodes, 0),
      platformJoined: campaignRows.reduce((sum, row) => sum + row.platformJoined, 0),
      offlineReserved: campaignRows.reduce((sum, row) => sum + row.offlineReserved, 0),
      submitted: campaignRows.reduce((sum, row) => sum + row.submitted, 0),
      pendingProof: campaignRows.reduce((sum, row) => sum + row.pendingProof, 0),
    },
  };
}

function managerName(userId) {
  const manager = allManagers().find((item) => item.id === Number(userId));
  return manager?.fullName || l("Unknown", "غير معروف");
}

function reportTabLabel(tab) {
  if (tab === "campaigns") return l("Campaigns", "الحملات");
  if (tab === "influencers") return l("Influencers", "المؤثرون");
  if (tab === "submissions") return l("Submissions", "التسليمات");
  return l("Codes", "الأكواد");
}

function renderDashboardBars(items, valueKey, maxValue, toneClass = "dashboard-bar-fill", scaleMode = "max") {
  return items.length
    ? `<div class="stack">${items
        .map(
          (item) => {
            const rawValue = Number(item[valueKey] || 0);
            const width =
              scaleMode === "percent"
                ? Math.max(0, Math.min(100, rawValue))
                : maxValue
                  ? Math.max(6, Math.round((rawValue / maxValue) * 100))
                  : 0;
            return `
              <article class="chart-row">
                <div class="row">
                  <strong>${escapeHtml(item.label)}</strong>
                  <span class="badge">${escapeHtml(item.badge || "")}</span>
                </div>
                <div class="dashboard-bar-track">
                  <span class="${toneClass}" style="width: ${width}%"></span>
                </div>
                ${item.note ? `<p class="compact">${escapeHtml(item.note)}</p>` : ""}
              </article>
            `;
          }
        )
        .join("")}</div>`
    : `<div class="empty-state">${l("No rows match the current filters.", "لا توجد نتائج مطابقة للفلاتر الحالية.")}</div>`;
}

function renderCodePoolBars(rows) {
  return rows.length
    ? `<div class="stack">${rows
        .map((row) => {
          const total = row.totalCodes || 1;
          const availableWidth = Math.round(((row.availableCodes || 0) / total) * 100);
          const reservedWidth = Math.round(((row.reservedCodes || 0) / total) * 100);
          const blockedWidth = Math.max(0, 100 - availableWidth - reservedWidth);
          return `
            <article class="chart-row">
              <div class="row">
                <strong>${escapeHtml(row.title)}</strong>
                <span class="badge">${row.totalCodes} ${l("codes", "كود")}</span>
              </div>
              <div class="stacked-bar">
                <span class="stacked-bar-segment stacked-bar-segment--available" style="width: ${availableWidth}%"></span>
                <span class="stacked-bar-segment stacked-bar-segment--reserved" style="width: ${reservedWidth}%"></span>
                <span class="stacked-bar-segment stacked-bar-segment--blocked" style="width: ${blockedWidth}%"></span>
              </div>
              <p class="compact">${l("Available", "متاح")} ${row.availableCodes} · ${l("Reserved", "محجوز")} ${row.reservedCodes} · ${l("Blocked", "محظور")} ${row.blockedCodes}</p>
            </article>
          `;
        })
        .join("")}</div>`
    : `<div class="empty-state">${l("No code rows match the current filters.", "لا توجد أكواد مطابقة للفلاتر الحالية.")}</div>`;
}

function renderCodeInventoryList(rows) {
  return rows.length
    ? `<div class="stack">${rows
        .map(
          (row) => {
            const reserveRate = Number.isFinite(Number(row.reserveRate)) ? Number(row.reserveRate) : Number(row.codeInterestRate || 0);
            const totalCodes = Number(row.totalCodes || 0);
            const availableCodes = Number(row.availableCodes || 0);
            const reservedCodes = Number(row.reservedCodes || 0);
            const blockedCodes = Number(row.blockedCodes || 0);
            const demand =
              reserveRate >= 75
                ? { label: l("High demand", "طلب مرتفع"), tone: "success" }
                : reserveRate >= 45
                  ? { label: l("Medium demand", "طلب متوسط"), tone: "warning" }
                  : { label: l("Low demand", "طلب منخفض"), tone: "" };
            return `
              <article class="chart-row">
                <div class="row">
                  <strong>${escapeHtml(row.title)}</strong>
                  <span class="badge">${totalCodes} ${l("codes", "كود")}</span>
                </div>
                <div class="row-wrap">
                  <span class="badge ${demand.tone}">${escapeHtml(demand.label)}</span>
                  <span class="badge success">${l("Reserve rate", "معدل الحجز")} ${reserveRate}%</span>
                  <span class="badge">${l("Available", "متاح")} ${availableCodes}</span>
                  <span class="badge warning">${l("Reserved", "محجوز")} ${reservedCodes}</span>
                  <span class="badge danger">${l("Blocked", "محظور")} ${blockedCodes}</span>
                </div>
                <p class="compact">${l("Demand here means how much of this campaign's uploaded code pool has already been reserved.", "المقصود بالطلب هنا هو مقدار ما تم حجزه بالفعل من مخزون أكواد هذه الحملة.")}</p>
              </article>
            `;
          }
        )
        .join("")}</div>`
    : `<div class="empty-state">${l("No code rows match the current filters.", "لا توجد أكواد مطابقة للفلاتر الحالية.")}</div>`;
}

function campaignDemandMeta(row) {
  const reserveRate = Number.isFinite(Number(row.reserveRate)) ? Number(row.reserveRate) : Number(row.codeInterestRate || 0);
  if (reserveRate >= 75) return { label: l("High demand", "طلب مرتفع"), tone: "success", reserveRate };
  if (reserveRate >= 45) return { label: l("Medium demand", "طلب متوسط"), tone: "warning", reserveRate };
  return { label: l("Low demand", "طلب منخفض"), tone: "", reserveRate };
}

function campaignClosingMeta(row) {
  const activeDeadline = dateValue(row.submissionDeadline) || dateValue(row.visitDeadline);
  const diffDays = activeDeadline ? Math.ceil((activeDeadline - Date.now()) / 86400000) : null;
  if (diffDays === null) return { label: l("No deadline", "بلا موعد"), tone: "", diffDays };
  if (diffDays < 0) return { label: l("Past due", "متجاوز"), tone: "danger", diffDays };
  if (diffDays <= 14) return { label: l("Closing soon", "إغلاق قريب"), tone: "warning", diffDays };
  return { label: l("Later closing", "إغلاق لاحق"), tone: "success", diffDays };
}

function compareValues(left, right) {
  if (left == null && right == null) return 0;
  if (left == null) return -1;
  if (right == null) return 1;
  if (typeof left === "number" && typeof right === "number") return left - right;
  return String(left).localeCompare(String(right), state.locale === "ar" ? "ar" : "en", { sensitivity: "base" });
}

function renderDataTable(columns, rows, emptyMessage) {
  const options = arguments[3] || {};
  const sort = options.sort || null;
  const tableId = options.tableId || "";
  return rows.length
    ? `
        <div class="table-wrap">
          <table class="report-table">
            <thead>
              <tr>${columns
                .map((column) => {
                  if (!column.sortKey || !tableId) return `<th>${escapeHtml(column.label)}</th>`;
                  const active = sort?.key === column.sortKey;
                  const arrow = active ? (sort.direction === "asc" ? "↑" : "↓") : "↕";
                  return `
                    <th>
                      <button
                        type="button"
                        class="table-sort-button ${active ? "is-active" : ""}"
                        data-action="sort-report-table"
                        data-table="${escapeHtml(tableId)}"
                        data-sort-key="${escapeHtml(column.sortKey)}"
                      >
                        <span>${escapeHtml(column.label)}</span>
                        <span class="table-sort-arrow">${arrow}</span>
                      </button>
                    </th>
                  `;
                })
                .join("")}</tr>
            </thead>
            <tbody>
              ${rows
                .map(
                  (row) => `
                    <tr>
                      ${columns
                        .map((column) => `<td>${column.html ? column.render(row) : escapeHtml(column.render(row))}</td>`)
                        .join("")}
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>
        </div>
      `
    : `<div class="empty-state">${emptyMessage}</div>`;
}

function currentReportFilters() {
  return state.reportFilters[state.reportTab] || {};
}

function renderReportTabs() {
  const tabs = ["campaigns", "influencers", "submissions", "codes"];
  return `
    <div class="report-tab-row">
      ${tabs
        .map(
          (tab) => `
            <button
              type="button"
              class="report-tab ${state.reportTab === tab ? "is-active" : ""}"
              data-action="set-report-tab"
              data-tab="${tab}"
            >
              ${escapeHtml(reportTabLabel(tab))}
            </button>
          `
        )
        .join("")}
    </div>
  `;
}

function reportFilterEntries(tab, filters) {
  const entries = [];
  if (tab === "campaigns") {
    if (filters.campaignId) {
      const campaign = currentCampaigns().find((item) => item.id === Number(filters.campaignId));
      if (campaign) entries.push({ label: l("Campaign", "الحملة"), value: campaignTitle(campaign) });
    }
    if (filters.status) entries.push({ label: l("Status", "الحالة"), value: campaignStatusLabel(filters.status) });
    if (filters.managerId) entries.push({ label: l("Manager", "المدير"), value: managerName(filters.managerId) });
  }
  if (tab === "influencers") {
    if (filters.query) entries.push({ label: l("Influencer", "المؤثر"), value: filters.query });
    if (filters.cityId) entries.push({ label: l("City", "المدينة"), value: cityName(filters.cityId) });
    if (filters.categoryId) entries.push({ label: l("Category", "الفئة"), value: categoryName(filters.categoryId) });
    if (filters.status) entries.push({ label: l("Status", "الحالة"), value: filters.status });
    if (filters.tag) entries.push({ label: l("Tag", "العلامة"), value: filters.tag });
    if (filters.platform) entries.push({ label: l("Platform", "المنصة"), value: filters.platform });
  }
  if (tab === "submissions") {
    if (filters.campaignId) {
      const campaign = currentCampaigns().find((item) => item.id === Number(filters.campaignId));
      if (campaign) entries.push({ label: l("Campaign", "الحملة"), value: campaignTitle(campaign) });
    }
    if (filters.influencerId) {
      const influencer = allInfluencers().find((item) => item.id === Number(filters.influencerId));
      if (influencer) entries.push({ label: l("Influencer", "المؤثر"), value: influencer.fullName });
    }
    if (filters.platform) entries.push({ label: l("Platform", "المنصة"), value: filters.platform });
  }
  if (tab === "codes") {
    if (filters.query) entries.push({ label: l("Code", "الكود"), value: filters.query });
    if (filters.campaignId) {
      const campaign = currentCampaigns().find((item) => item.id === Number(filters.campaignId));
      if (campaign) entries.push({ label: l("Campaign", "الحملة"), value: campaignTitle(campaign) });
    }
    if (filters.status) entries.push({ label: l("Code status", "حالة الكود"), value: codeStatusLabel(filters.status) });
    if (filters.assignment) entries.push({ label: l("Assignment", "التخصيص"), value: filters.assignment });
  }
  if (filters.dateFrom || filters.dateTo) {
    entries.push({
      label: tab === "influencers" ? l("Signup date", "تاريخ التسجيل") : l("Date range", "النطاق الزمني"),
      value: `${filters.dateFrom ? formatDate(filters.dateFrom) : "…"} - ${filters.dateTo ? formatDate(filters.dateTo) : "…"}`,
    });
  }
  return entries;
}

function renderFilterChips(entries) {
  if (!entries.length) return "";
  return `
    <div class="filter-chip-row">
      ${entries
        .map(
          (entry) => `
            <span class="filter-chip">
              <strong>${escapeHtml(entry.label)}:</strong>
              <span>${escapeHtml(entry.value)}</span>
            </span>
          `
        )
        .join("")}
    </div>
  `;
}

function renderReportFunnel(summary) {
  const steps = [
    {
      label: l("Code pool", "مخزون الأكواد"),
      value: summary.totalCodes || 0,
      note: `${l("Available", "متاح")} ${summary.availableCodes || 0} · ${l("Blocked", "محظور")} ${summary.blockedCodes || 0}`,
      percent: summary.totalCodes ? 100 : 0,
      toneClass: "funnel-fill",
    },
    {
      label: l("Reserved codes", "الأكواد المحجوزة"),
      value: summary.reservedCodes || 0,
      note: `${safePercent(summary.reservedCodes, summary.totalCodes)}% ${l("of total pool", "من إجمالي المخزون")}`,
      percent: safePercent(summary.reservedCodes, summary.totalCodes),
      toneClass: "funnel-fill funnel-fill--warning",
    },
    {
      label: l("Platform joins", "انضمام المنصة"),
      value: summary.platformJoined || 0,
      note: `${l("Offline reserved", "حجز خارجي")} ${summary.offlineReserved || 0}`,
      percent: safePercent(summary.platformJoined, summary.reservedCodes),
      toneClass: "funnel-fill",
    },
    {
      label: l("Submitted links", "الروابط المرسلة"),
      value: summary.submitted || 0,
      note: `${safePercent(summary.submitted, summary.platformJoined)}% ${l("posting rate", "معدل النشر")}`,
      percent: safePercent(summary.submitted, summary.platformJoined),
      toneClass: "funnel-fill funnel-fill--success",
    },
  ];

  return `
    <div class="report-funnel">
      ${steps
        .map(
          (step) => `
            <article class="funnel-step">
              <div class="row">
                <div>
                  <span class="eyebrow">${escapeHtml(step.label)}</span>
                  <strong class="funnel-step-value">${escapeHtml(step.value)}</strong>
                </div>
                <span class="badge ${step.toneClass.includes("--success") ? "success" : step.toneClass.includes("--warning") ? "warning" : ""}">${step.percent}%</span>
              </div>
              <div class="funnel-track">
                <span class="${step.toneClass}" style="width: ${Math.max(step.percent || 0, step.value ? 8 : 0)}%"></span>
              </div>
              <p class="compact">${escapeHtml(step.note)}</p>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderDeadlineCards(rows) {
  if (!rows.length) {
    return `<div class="empty-state">${l("No campaigns in this filter need deadline attention right now.", "لا توجد حملات ضمن هذه الفلاتر تحتاج انتباهاً زمنياً حالياً.")}</div>`;
  }
  return `
    <div class="stack">
      ${rows
        .map(
          (row) => `
            <article class="note-card deadline-card">
              <div class="row">
                <strong>${escapeHtml(row.title)}</strong>
                <span class="badge ${row.tone}">${escapeHtml(row.label)}</span>
              </div>
              <p>${escapeHtml(row.note)}</p>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function syncReportFilters(form) {
  const next = { ...state.reportFilters };
  next[state.reportTab] = Object.fromEntries(new FormData(form).entries());
  state.reportFilters = next;
}

function normalizeTagInput(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .join(", ");
}

function validateTagInputAgainstLibrary(value, allowedTags = null) {
  const tags = String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const invalid = tags.filter((tag) => !/^[a-z0-9-]+$/.test(tag.toLowerCase()));
  if (invalid.length) {
    return l("Tags must be comma-separated, lowercase, and use only letters, numbers, or hyphens.", "يجب أن تكون العلامات مفصولة بفواصل وبأحرف صغيرة وتستخدم فقط الحروف أو الأرقام أو الشرطة.");
  }
  if (Array.isArray(allowedTags)) {
    const allowed = new Set(allowedTags.map((tag) => sanitizeTagToken(tag)).filter(Boolean));
    const unknown = tags.map((tag) => sanitizeTagToken(tag)).filter((tag) => !allowed.has(tag));
    if (unknown.length) {
      return l("Choose tags from the admin tag library only.", "اختر العلامات من مكتبة العلامات التي يديرها المسؤول فقط.");
    }
  }
  return null;
}

function tagArray(value) {
  return normalizeTagInput(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function sanitizeTagToken(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9-]/g, "");
}

function validateSingleTagToken(value) {
  const raw = String(value || "").trim();
  return /^[a-z0-9-]+$/.test(raw)
    ? null
    : l("Use one lowercase tag with letters, numbers, or hyphens only.", "استخدم علامة واحدة بأحرف صغيرة وتضم الحروف أو الأرقام أو الشرطة فقط.");
}

function availableTagValues(selectedTags = []) {
  const tagRows = state.data?.tags || state.publicData?.tags || [];
  const selected = Array.isArray(selectedTags) ? selectedTags.map((tag) => sanitizeTagToken(tag)).filter(Boolean) : tagArray(selectedTags);
  return [...new Set([
    ...tagRows.filter((tag) => tag.status === "active").map((tag) => sanitizeTagToken(tag.value)),
    ...selected,
  ].filter(Boolean))];
}

function validateCampaignTimeline(payload) {
  const { startDate, endDate, visitDeadline, submissionDeadline } = payload;
  if (!startDate || !endDate || !visitDeadline || !submissionDeadline) return null;
  if (startDate > endDate) {
    return l("Start date must be on or before end date.", "يجب أن يكون تاريخ البداية في نفس يوم تاريخ النهاية أو قبله.");
  }
  if (endDate > visitDeadline) {
    return l("Visit deadline must be the same as or later than the end date.", "يجب أن يكون آخر موعد للزيارة في نفس يوم تاريخ النهاية أو بعده.");
  }
  if (visitDeadline > submissionDeadline) {
    return l("Submission deadline must be the same as or later than the visit deadline.", "يجب أن يكون آخر موعد للتسليم في نفس يوم آخر موعد الزيارة أو بعده.");
  }
  return null;
}

function selectedCampaign() {
  const campaigns = currentCampaigns();
  if (!campaigns.length) return null;
  const found = campaigns.find((campaign) => campaign.id === Number(state.selectedCampaignId));
  if (found) return found;
  state.selectedCampaignId = campaigns[0].id;
  return campaigns[0];
}

function navSelected(pageKey) {
  if (pageKey === "campaigns" && ["campaigns", "campaign-edit", "campaign-view"].includes(state.currentPage)) return true;
  return state.currentPage === pageKey;
}

async function api(url, options = {}) {
  state.apiInflightCount += 1;
  syncLoadingBar();
  try {
    const response = await fetch(url, {
      credentials: "same-origin",
      headers:
        options.body instanceof FormData
          ? {}
          : { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Request failed.");
    return payload;
  } finally {
    state.apiInflightCount = Math.max(0, state.apiInflightCount - 1);
    syncLoadingBar();
  }
}

async function loadBootstrap() {
  state.data = await api("/api/bootstrap");
  state.currentUser = state.data.currentUser;
  state.currentPage = normalizePage(state.currentPage);
  if (state.pendingCampaignDeeplink) {
    const target = (state.data?.campaigns || []).find((campaign) => campaign.id === state.pendingCampaignDeeplink);
    state.pendingCampaignDeeplink = null;
    if (target) {
      state.selectedCampaignId = target.id;
      state.currentPage = state.currentUser?.role === "influencer" ? "campaign-preview" : "campaign-view";
    }
  }
  render();
}

function render(options = {}) {
  const focusSnapshot = options.preserveFocus ? captureFocusedField() : null;
  document.body.classList.toggle("rtl", state.locale === "ar");
  if (!state.currentUser) {
    document.body.classList.toggle("nav-locked", false);
    app.innerHTML = renderAuth();
    syncFlashLayer();
    if (focusSnapshot) requestAnimationFrame(() => restoreFocusedField(focusSnapshot));
    return;
  }
  app.innerHTML = renderShell();
  document.body.classList.toggle("nav-locked", state.mobileNavOpen);
  syncFlashLayer();
  if (focusSnapshot) requestAnimationFrame(() => restoreFocusedField(focusSnapshot));
}

function renderAuth() {
  const resetMode = state.authMode === "reset" || state.resetToken;
  return `
    <div class="background-orb orb-one"></div>
    <div class="background-orb orb-two"></div>
    <div id="global-loading-bar" data-global-loading-bar class="${state.apiInflightCount > 0 ? "is-active" : ""}"></div>
    <div class="flash-layer" data-flash-layer></div>
    <section class="login-shell">
      <article class="login-card">
        <p class="eyebrow">PICK Internal</p>
        <h1>${l("PICK Influence Hub", "منصة PICK لإدارة المؤثرين")}</h1>
        <p class="login-copy">${l("Sign in, request access, or reset your password.", "سجّل الدخول أو اطلب حساباً أو أعد تعيين كلمة المرور.")}</p>
        <div class="row-wrap" style="margin-bottom: 18px;">
          <button class="${state.authMode === "login" ? "" : "secondary"}" data-action="set-auth-mode" data-mode="login">${l("Sign In", "تسجيل الدخول")}</button>
          <button class="${state.authMode === "signup" ? "" : "secondary"}" data-action="set-auth-mode" data-mode="signup">${l("Sign Up", "تسجيل جديد")}</button>
          <button class="${state.authMode === "forgot" ? "" : "secondary"}" data-action="set-auth-mode" data-mode="forgot">${l("Forgot Password", "نسيت كلمة المرور")}</button>
        </div>
        <label class="field" style="margin-bottom: 16px;">
          <span>${l("Language", "اللغة")}</span>
          <select data-action="change-locale">
            <option value="en" ${state.locale === "en" ? "selected" : ""}>English</option>
            <option value="ar" ${state.locale === "ar" ? "selected" : ""}>العربية</option>
          </select>
        </label>
        ${resetMode ? renderResetPasswordForm() : state.authMode === "signup" ? renderSignupForm() : state.authMode === "forgot" ? renderForgotPasswordForm() : renderLoginForm()}
        ${state.generatedLink ? `<article class="note-card" style="margin-top: 18px;"><strong>${l("Generated link", "الرابط المولد")}</strong><p>${escapeHtml(state.generatedLink)}</p></article>` : ""}
      </article>
      <article class="login-sidecard">
        <p class="eyebrow">${l("Demo accounts", "حسابات تجريبية")}</p>
        <h2>PICK</h2>
        <p class="brand-copy">${l("Internal campaign operations with reserved POS code flows.", "تشغيل داخلي للحملات مع تدفق أكواد نقاط البيع المحجوزة.")}</p>
        <div class="stack">
          <div class="list-card"><strong>${roleLabel("admin")}</strong><p>sara@pick.internal</p><p class="compact">pick123</p></div>
          <div class="list-card"><strong>${roleLabel("campaign_manager")}</strong><p>nasser@pick.internal</p><p class="compact">pick123</p></div>
          <div class="list-card"><strong>${roleLabel("influencer")}</strong><p>laila@example.com</p><p class="compact">pick123</p></div>
        </div>
      </article>
    </section>
  `;
}

function renderLoginForm() {
  return `
    <form id="loginForm" class="form-grid">
      <label class="field"><span>${l("Email", "البريد الإلكتروني")}</span><input name="email" type="email" required /></label>
      ${renderPasswordField("password", { required: true, autocomplete: "current-password", hint: "", label: l("Password", "كلمة المرور") })}
      <button type="submit">${l("Sign In", "تسجيل الدخول")}</button>
    </form>
  `;
}

function renderSignupForm() {
  return `
    <form id="signupForm" class="form-grid two-col">
      <label class="field"><span>${l("Full name", "الاسم الكامل")} <em class="required-mark">*</em></span><input name="fullName" required /></label>
      <label class="field"><span>${l("Email", "البريد الإلكتروني")} <em class="required-mark">*</em></span><input name="email" type="email" required /></label>
      ${renderPasswordField("password", { required: true, autocomplete: "new-password", hint: passwordRequirementHint(), label: l("Password", "كلمة المرور"), minLength: 8 })}
      <label class="field"><span>${l("Mobile", "الهاتف")} <em class="required-mark">*</em></span>${renderKuwaitMobileField("mobile", "", true)}</label>
      <label class="field"><span>${l("Gender", "الجنس")} <em class="required-mark">*</em></span>${renderGenderSelect("gender", "", true)}</label>
      <label class="field"><span>${l("City", "المدينة")} <em class="required-mark">*</em></span>${renderCitySelect("cityId", "", false, true)}</label>
      <label class="field"><span>${l("Category", "الفئة")}</span>${renderCategorySelect("categoryId", "")}</label>
      <label class="field"><span>Instagram <em class="required-mark">*</em></span><input name="instagram" required /></label>
      <label class="field"><span>Instagram followers</span><input name="instagramFollowers" type="number" min="0" value="0" /></label>
      <label class="field"><span>TikTok</span><input name="tiktok" /></label>
      <label class="field"><span>TikTok followers</span><input name="tiktokFollowers" type="number" min="0" value="0" /></label>
      <label class="field"><span>Snapchat</span><input name="snapchat" /></label>
      <label class="field"><span>Snapchat followers</span><input name="snapchatFollowers" type="number" min="0" value="0" /></label>
      <label class="field"><span>${l("Preferred platform", "المنصة المفضلة")}</span>${renderPlatformSelect("preferredPlatform", "")}</label>
      <p class="compact field-span-full">${l("Follower counts help us match you with relevant campaigns. You can update them later in your profile.", "أعداد المتابعين تساعدنا على مطابقتك مع الحملات المناسبة. يمكنك تحديثها لاحقاً من ملفك الشخصي.")}</p>
      <button type="submit" style="grid-column: 1 / -1;">${l("Create influencer request", "إرسال طلب التسجيل")}</button>
    </form>
  `;
}

function renderForgotPasswordForm() {
  return `
    <form id="forgotPasswordForm" class="form-grid">
      <p class="compact">${l("Enter your email. If an account exists, an admin will share the reset link with you.", "أدخل بريدك الإلكتروني. إذا كان الحساب موجوداً، فسيشاركك المسؤول رابط إعادة التعيين.")}</p>
      <label class="field"><span>${l("Email", "البريد الإلكتروني")}</span><input name="email" type="email" required /></label>
      <button type="submit">${l("Send reset request", "إرسال طلب إعادة التعيين")}</button>
    </form>
  `;
}

function renderResetPasswordForm() {
  return `
    <form id="resetPasswordForm" class="form-grid">
      ${renderPasswordField("password", { required: true, autocomplete: "new-password", hint: passwordRequirementHint(), label: l("New password", "كلمة المرور الجديدة"), minLength: 8 })}
      <button type="submit">${l("Reset password", "إعادة تعيين كلمة المرور")}</button>
    </form>
  `;
}

function roleNav(role) {
  if (role === "admin") {
    return [
      ["dashboard", l("Dashboard", "لوحة التحكم")],
      ["influencers", l("Influencer Management", "إدارة المؤثرين")],
      ["campaigns", l("Campaigns", "الحملات")],
      ["branches", l("Branches", "الأفرع")],
      ["master-data", l("Master Data", "البيانات الأساسية")],
      ["managers", l("Managers", "مديرو الحملات")],
      ["reports", l("Reports", "التقارير")],
      ["profile", l("Profile", "الملف الشخصي")],
    ];
  }
  if (role === "campaign_manager") {
    return [
      ["dashboard", l("Dashboard", "لوحة التحكم")],
      ["influencers", l("Influencer Management", "إدارة المؤثرين")],
      ["campaigns", l("Campaigns", "الحملات")],
      ["reports", l("Reports", "التقارير")],
      ["profile", l("Profile", "الملف الشخصي")],
    ];
  }
  return [
    ["dashboard", l("Dashboard", "لوحة التحكم")],
    ["availableCampaigns", l("Available Campaigns", "الحملات المتاحة")],
    ["myCampaigns", l("My Campaigns", "حملاتي")],
    ["profile", l("Profile", "الملف الشخصي")],
  ];
}

const NAV_ICON = {
  admin: {
    dashboard: "layout-dashboard",
    influencers: "users",
    campaigns: "megaphone",
    branches: "store",
    "master-data": "sliders-horizontal",
    managers: "user-cog",
    reports: "bar-chart-3",
    profile: "user-circle",
  },
  campaign_manager: {
    dashboard: "layout-dashboard",
    influencers: "users",
    campaigns: "megaphone",
    reports: "bar-chart-3",
    profile: "user-circle",
  },
  influencer: {
    dashboard: "home",
    availableCampaigns: "sparkles",
    myCampaigns: "clipboard-check",
    profile: "user-circle",
  },
};

function renderShell() {
  return `
    <div class="background-orb orb-one"></div>
    <div class="background-orb orb-two"></div>
    <div id="global-loading-bar" data-global-loading-bar class="${state.apiInflightCount > 0 ? "is-active" : ""}"></div>
    <div class="flash-layer" data-flash-layer></div>
    <div class="app-shell ${state.mobileNavOpen ? "mobile-nav-open" : ""}">
      <header class="mobile-topbar">
        <button type="button" class="mobile-burger" data-action="toggle-mobile-nav" aria-label="${escapeHtml(l("Open menu", "فتح القائمة"))}">
          ${iconSvg("menu")}
        </button>
        <div class="mobile-brand">
          <strong>PICK Influence Hub</strong>
        </div>
        <div class="mobile-spacer"></div>
      </header>
      <aside class="sidebar">
        <div class="brand-block">
          <p class="eyebrow">PICK Internal</p>
          <h1>PICK Influence Hub</h1>
          <p class="brand-copy">${l("Internal influencer campaign operations for PICK.", "تشغيل داخلي لحملات المؤثرين في PICK.")}</p>
        </div>
        <div class="control-panel">
          <label class="field">
            <span>${l("Language", "اللغة")}</span>
            <select data-action="change-locale">
              <option value="en" ${state.locale === "en" ? "selected" : ""}>English</option>
              <option value="ar" ${state.locale === "ar" ? "selected" : ""}>العربية</option>
            </select>
          </label>
        </div>
        <nav class="sidebar-nav">
          ${roleNav(state.currentUser.role)
            .map(
              ([key, label]) => `
                <button class="nav-chip ${navSelected(key) ? "is-active" : ""}" data-nav="${key}">
                  ${iconSvg(NAV_ICON[state.currentUser.role]?.[key] || "user-circle")}
                  <span class="nav-chip__label">${label}</span>
                </button>
              `
            )
            .join("")}
        </nav>
        <div class="sidebar-footer">
          <div class="list-card">
            ${renderUserAvatar(state.currentUser, "user-avatar--sidebar")}
            <strong>${escapeHtml(state.currentUser.fullName)}</strong>
            <p>${roleLabel(state.currentUser.role)}</p>
            <p class="compact">${escapeHtml(state.currentUser.email)}</p>
          </div>
          <button class="secondary" data-action="logout">${l("Log out", "تسجيل الخروج")}</button>
        </div>
      </aside>
      <button type="button" class="mobile-nav-backdrop" data-action="close-mobile-nav" aria-label="${escapeHtml(l("Close menu", "إغلاق القائمة"))}"></button>
      <main class="main-stage">
        ${renderPage()}
      </main>
    </div>
  `;
}

function renderFlash() {
  return state.flash
    ? `
      <div class="flash-banner ${state.flash.tone}" role="status" aria-live="polite">
        <div class="flash-banner-copy">${escapeHtml(state.flash.message)}</div>
        <button type="button" class="flash-dismiss" data-action="dismiss-flash" aria-label="${escapeHtml(l("Dismiss message", "إغلاق الرسالة"))}">×</button>
      </div>
    `
    : "";
}

function pageHeader(title, copy, options = {}) {
  const heroMetricsClass = `hero-metrics${options.compactHeroStats ? " hero-metrics--compact" : ""}`;
  return `
    <header class="topbar">
      <div>
        <p class="eyebrow">${l("Workspace", "مساحة العمل")}</p>
        <h2>${title}</h2>
      </div>
      <div class="topbar-actions">
        ${renderUserAvatar(state.currentUser, "user-avatar--topbar")}
        <div class="status-pill">${roleLabel(state.currentUser.role)} · ${escapeHtml(state.currentUser.fullName)}</div>
        <button class="secondary" data-action="logout">${l("Log out", "تسجيل الخروج")}</button>
      </div>
    </header>
    <section class="hero-card">
      <div>
        <p class="eyebrow">PICK</p>
        <h3>${title}</h3>
        <p>${copy}</p>
      </div>
      <div class="${heroMetricsClass}">
        ${renderHeroStats(options)}
      </div>
    </section>
  `;
}

function renderCampaignBanner(campaign, variant = "card") {
  const classes = `campaign-banner ${variant}`.trim();
  if (campaign?.bannerPath) {
    return `<img class="${classes}" src="${campaign.bannerPath}" alt="${escapeHtml(campaignTitle(campaign))}" />`;
  }
  return `
    <div class="${classes} campaign-banner-fallback">
      <span>${escapeHtml(campaignTitle(campaign || { titleEn: "PICK", titleAr: "PICK" }))}</span>
      <small>${escapeHtml(campaignAudience(campaign || { audience: "PICK", audienceAr: "PICK" }))}</small>
    </div>
  `;
}

function statusTone(status) {
  if (["submitted", "completed", "live", "active"].includes(status)) return "success";
  if (["confirmed", "visited", "pending", "reserved", "offline_reserved"].includes(status)) return "warning";
  if (["canceled", "rejected", "suspended", "deactivated", "blocked", "deleted", "inactive"].includes(status)) return "danger";
  return "";
}

function statusCardTone(status) {
  if (["completed"].includes(status)) return "status-strip-success";
  if (["visited", "submitted", "offline_reserved"].includes(status)) return "status-strip-warning";
  if (["confirmed"].includes(status)) return "status-strip-warning";
  if (["canceled", "rejected", "suspended"].includes(status)) return "status-strip-danger";
  return "";
}

function participantNeedsProof(status) {
  return status === "visited";
}

function participantNeedsVisit(status) {
  return ["confirmed", "offline_reserved"].includes(status);
}

function participantCanSubmit(participant) {
  if (!participant) return false;
  if (participant.status === "visited") return true;
  if (participant.status === "submitted" && participant.submittedAt) {
    return Date.now() - new Date(participant.submittedAt).getTime() <= 24 * 60 * 60 * 1000;
  }
  return false;
}

function participantPriority(participant) {
  if (participantNeedsVisit(participant.status)) return 0;
  if (participantNeedsProof(participant.status)) return 1;
  if (["submitted", "completed"].includes(participant.status)) return 2;
  if (participant.status === "canceled") return 2;
  return 3;
}

function participantStatusLabel(status) {
  if (status === "offline_reserved") return l("Offline reservation", "حجز خارجي");
  if (status === "confirmed") return l("Awaiting branch visit", "بانتظار زيارة الفرع");
  if (status === "visited") return l("Pending proof submission", "بانتظار إرسال الإثبات");
  if (status === "submitted") return l("Proof submitted", "تم إرسال الإثبات");
  if (status === "completed") return l("Completed", "مكتمل");
  if (status === "canceled") return l("Campaign canceled", "تم إلغاء الحملة");
  return status;
}

function participantDisplayStatus(participant) {
  if (participant?.source === "offline") return l("Offline reservation", "حجز خارجي");
  return participantStatusLabel(participant?.status || "");
}

function participantDisplayTone(participant) {
  if (participant?.source === "offline") return "warning";
  return statusTone(participant?.status || "");
}

function renderStatusStrip(status) {
  return `<div class="status-strip ${statusCardTone(status)}">${escapeHtml(participantStatusLabel(status))}</div>`;
}

function renderCodeDetails(codeValue, usageCount, offerText, title = l("Assigned code", "الكود المخصص")) {
  if (!codeValue) return "";
  const normalizedUses = usageCount || 1;
  const offerSummary = offerText
    ? `${escapeHtml(offerText)}`
    : l("Campaign offer attached to this code.", "عرض الحملة مرتبط بهذا الكود.");
  return `
    <div class="code-offer-card" style="margin-top: 12px;">
      <div class="row">
        <strong>${escapeHtml(title)}</strong>
        <span class="code-offer-uses">${l("Uses", "عدد الاستخدام")}: ${escapeHtml(normalizedUses)}</span>
      </div>
      <div class="code-offer-value">${escapeHtml(codeValue)}</div>
      <div class="code-offer-summary">
        <span class="code-offer-label">${l("Included Offer", "العرض المتضمن")}</span>
        <p>${offerSummary}</p>
      </div>
    </div>
  `;
}

function renderParticipantImages(images) {
  const rows = (images || []).filter((image) => image?.path);
  if (!rows.length) return "";
  return rows
    .map(
      (image) =>
        `<a class="badge" href="${image.path}" target="_blank" rel="noreferrer">${escapeHtml(image.name || l("Open image", "عرض الصورة"))}</a>`
    )
    .join("");
}

function renderCampaignOffer(campaign, compact = false) {
  const description = campaign?.offerDescription || "";
  const usageCount = campaign?.offerUsageCount || 1;
  if (!description && usageCount === 1) return "";
  return compact
    ? `
        <article class="offer-highlight-card" style="margin-top: 12px;">
          <div class="row">
            <strong>${l("What you get", "ما الذي ستحصل عليه")}</strong>
            <span class="code-offer-uses">${l("Uses", "عدد الاستخدام")}: ${escapeHtml(usageCount)}</span>
          </div>
          ${description ? `<p>${escapeHtml(description)}</p>` : `<p>${l("Campaign offer attached to this code.", "عرض الحملة مرتبط بهذا الكود.")}</p>`}
        </article>
      `
    : `
        <article class="note-card" style="margin-top: 14px;">
          <strong>${l("Campaign Offer", "عرض الحملة")}</strong>
          <div class="row-wrap" style="margin-top: 8px;">
            <span class="badge">${l("Uses", "عدد الاستخدام")}: ${escapeHtml(usageCount)}</span>
          </div>
          ${description ? `<p>${escapeHtml(description)}</p>` : ""}
        </article>
      `;
}

function renderInfluencerProfileTrigger(userId, fullName) {
  if (!userId) return escapeHtml(fullName || "-");
  return `<button type="button" class="table-link-button" data-action="view-influencer" data-user-id="${userId}">${escapeHtml(fullName || "-")}</button>`;
}

function renderAdminTagCheckboxField(selectedTags = []) {
  const normalizedSelected = new Set((selectedTags || []).map((tag) => sanitizeTagToken(tag)).filter(Boolean));
  const tagRows = (state.data?.tags || [])
    .filter((tag) => tag.status === "active" || normalizedSelected.has(sanitizeTagToken(tag.value)));
  return `
    <div class="field checkbox-field field-span-full">
      <span>${l("Tags (admin-controlled)", "العلامات المعتمدة")}</span>
      <div class="row-wrap" style="margin-bottom: 6px;">
        <button type="button" class="secondary button-small" data-action="set-checkbox-group" data-checkbox-name="tags" data-checkbox-mode="all">${l("Select all", "تحديد الكل")}</button>
        <button type="button" class="secondary button-small" data-action="set-checkbox-group" data-checkbox-name="tags" data-checkbox-mode="clear">${l("Clear", "مسح")}</button>
      </div>
      <div class="option-grid">
        ${
          tagRows.length
            ? tagRows
                .map(
                  (tag) => `
                    <label class="option-pill">
                      <input type="checkbox" name="tags" value="${escapeHtml(tag.value)}" ${normalizedSelected.has(sanitizeTagToken(tag.value)) ? "checked" : ""} />
                      <span>${escapeHtml(tag.value)}</span>
                    </label>
                  `
                )
                .join("")
            : `<span class="compact">${escapeHtml(l("No admin tags yet. Add them from Master Data first.", "لا توجد علامات معتمدة بعد. أضفها أولاً من البيانات الأساسية."))}</span>`
        }
      </div>
      <small>${escapeHtml(l("Manage the tag library from Master Data.", "إدارة مكتبة العلامات من البيانات الأساسية."))}</small>
    </div>
  `;
}

function renderCampaignTitleLink(source, options = {}) {
  const campaignId = Number(options.campaignId ?? source?.campaignId ?? source?.id) || null;
  const label =
    options.label ??
    (state.locale === "ar"
      ? source?.titleAr || source?.campaignTitleAr || source?.titleEn || source?.campaignTitleEn
      : source?.titleEn || source?.campaignTitleEn || source?.titleAr || source?.campaignTitleAr) ??
    options.fallback ??
    "-";
  if (!campaignId) return escapeHtml(label);
  const action = state.currentUser?.role === "influencer" ? "preview-campaign" : "view-campaign";
  return `<button type="button" class="table-link-button" data-action="${action}" data-campaign-id="${campaignId}">${escapeHtml(label)}</button>`;
}

function selectedInfluencer() {
  return allInfluencers().find((user) => user.id === Number(state.selectedInfluencerId)) || null;
}

function selectedBranch() {
  return (state.data?.branches || []).find((branch) => branch.id === Number(state.selectedBranchId)) || null;
}

function influencerBackLabel(page) {
  if (page === "reports") return l("Back to reports", "العودة إلى التقارير");
  if (page === "campaign-view") return l("Back to campaign", "العودة إلى الحملة");
  if (page === "dashboard") return l("Back to dashboard", "العودة إلى لوحة التحكم");
  return l("Back to influencer management", "العودة إلى إدارة المؤثرين");
}

function metricGrid(items) {
  return `
    <section class="metrics-grid">
      ${items
        .map(
          (item) => `
            <article class="metric-card">
              <span class="metric-label">${item.label}</span>
              <strong class="metric-value">${item.value}</strong>
              <p class="metric-note">${item.note}</p>
            </article>
          `
        )
        .join("")}
    </section>
  `;
}

function safePercent(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function renderPage() {
  const role = state.currentUser.role;
  if (role === "admin") return renderAdminPages();
  if (role === "campaign_manager") return renderManagerPages();
  return renderInfluencerPages();
}

function renderAdminPages() {
  if (state.currentPage === "influencers") return renderInfluencersPage();
  if (state.currentPage === "influencer-profile") return renderInfluencerProfilePage();
  if (state.currentPage === "campaigns") return renderCampaignsPage();
  if (state.currentPage === "campaign-edit") return renderCampaignEditPage();
  if (state.currentPage === "campaign-view") return renderCampaignViewPage();
  if (state.currentPage === "branches") return renderBranchesPage();
  if (state.currentPage === "branch-edit") return renderBranchEditPage();
  if (state.currentPage === "master-data") return renderMasterDataPage();
  if (state.currentPage === "managers") return renderManagersPage();
  if (state.currentPage === "manager-edit") return renderManagerEditPage();
  if (state.currentPage === "reports") return renderReportsPage();
  if (state.currentPage === "profile") return renderProfilePage();
  return renderOperationsDashboard();
}

function renderManagerPages() {
  if (state.currentPage === "influencers") return renderInfluencersPage();
  if (state.currentPage === "influencer-profile") return renderInfluencerProfilePage();
  if (state.currentPage === "campaigns") return renderCampaignsPage();
  if (state.currentPage === "campaign-edit") return renderCampaignEditPage();
  if (state.currentPage === "campaign-view") return renderCampaignViewPage();
  if (state.currentPage === "reports") return renderReportsPage();
  if (state.currentPage === "profile") return renderProfilePage();
  return renderOperationsDashboard();
}

function renderInfluencerPages() {
  if (state.currentPage === "availableCampaigns") return renderAvailableCampaignsPage();
  if (state.currentPage === "campaign-preview") return renderInfluencerCampaignPreviewPage();
  if (state.currentPage === "myCampaigns") return renderMyCampaignsPage();
  if (state.currentPage === "profile") return renderProfilePage();
  return renderInfluencerDashboard();
}

function renderOperationsDashboard() {
  const summary = reportSummary();
  return `
    ${pageHeader(
      l("Operations Dashboard", "لوحة التشغيل"),
      l("Manage campaigns, influencers, codes, and deadlines from one place.", "إدارة الحملات والمؤثرين والأكواد والمواعيد من مكان واحد."),
      { showNotifications: true }
    )}
    ${metricGrid([
      { label: l("Campaigns", "الحملات"), value: summary.campaignCount || 0, note: l("Across the whole system", "في كامل النظام") },
      { label: l("Pending approvals", "طلبات معلقة"), value: pendingApprovals().length, note: l("Need review", "بانتظار المراجعة") },
      { label: l("Joined campaigns", "انضمامات"), value: summary.joinedCount || 0, note: l("Reserved-code participations", "مشاركات بأكواد محجوزة") },
      { label: l("Submitted links", "روابط مرسلة"), value: summary.submittedCount || 0, note: l("Visit proofs received", "إثباتات زيارة مستلمة") },
    ])}
    <section class="content-grid">
      <section class="panel panel-wide">
        <h3>${l("Campaign Health", "صحة الحملات")}</h3>
        ${renderCampaignHealthCards(currentCampaigns().slice(0, 4))}
      </section>
      <section class="panel">
        <h3>${l("Pending Proof", "إثباتات معلقة")}</h3>
        ${renderPendingProofList()}
      </section>
    </section>
    <section class="panel">
      <h3>${l("Influencer Snapshot", "ملخص المؤثرين")}</h3>
      ${renderInfluencerTable(allInfluencers().slice(0, 6), false)}
    </section>
    ${renderRecentActivityPanel()}
  `;
}

function filteredInfluencers() {
  const query = state.influencerFilters.query.toLowerCase();
  return allInfluencers().filter((user) => {
    if (state.influencerFilters.cityId && Number(state.influencerFilters.cityId) !== user.cityId) return false;
    if (state.influencerFilters.categoryId && Number(state.influencerFilters.categoryId) !== user.categoryId) return false;
    if (state.influencerFilters.status && state.influencerFilters.status !== user.status) return false;
    if (state.influencerFilters.tag && !(user.tags || []).includes(state.influencerFilters.tag)) return false;
    if (!query) return true;
    const haystack = `${user.fullName} ${user.email} ${user.mobile || ""} ${user.instagram || ""} ${user.tiktok || ""} ${user.snapchat || ""} ${(user.tags || []).join(" ")}`.toLowerCase();
    return haystack.includes(query);
  });
}

function renderInfluencersPage() {
  const pending = pendingApprovals();
  const rows = filteredInfluencers();
  const summaries = new Map((state.data?.reports?.influencers || []).map((item) => [item.influencerId, item]));
  const activeCount = allInfluencers().filter((user) => user.status === "active").length;
  const suspendedCount = allInfluencers().filter((user) => user.status === "suspended").length;
  const rejectedCount = allInfluencers().filter((user) => user.status === "rejected").length;
  const pendingProof = (state.data?.reports?.influencers || []).reduce((sum, item) => sum + (item.pending || 0), 0);
  return `
    ${pageHeader(
      l("Influencer Management", "إدارة المؤثرين"),
      l("Approve sign-ups, manage access, update internal tags and notes, and reset passwords from one operational page.", "اعتمد التسجيلات وأدر الوصول وحدّث العلامات والملاحظات الداخلية وأعد تعيين كلمات المرور من صفحة تشغيل واحدة."),
      { hideHeroStats: true }
    )}
    ${metricGrid([
      { label: l("Total influencers", "إجمالي المؤثرين"), value: allInfluencers().length, note: l("All influencer accounts in the platform.", "كل حسابات المؤثرين الموجودة في المنصة.") },
      { label: l("Pending approvals", "طلبات بانتظار الاعتماد"), value: pending.length, note: l("New sign-ups waiting for approval or rejection.", "طلبات تسجيل جديدة بانتظار الاعتماد أو الرفض.") },
      { label: l("Active accounts", "الحسابات النشطة"), value: activeCount, note: l("Influencers who can currently log in and join campaigns.", "مؤثرون يمكنهم الدخول والانضمام للحملات حالياً.") },
      { label: l("Pending proof", "إثباتات معلقة"), value: pendingProof, note: l("Platform joins still waiting for proof links.", "انضمامات المنصة التي ما زالت بانتظار روابط الإثبات.") },
    ])}
    ${state.generatedLink ? `<article class="note-card" style="margin-bottom: 18px;"><strong>${l("Generated reset link", "رابط إعادة التعيين المولد")}</strong><p>${escapeHtml(state.generatedLink)}</p></article>` : ""}
    <section class="panel">
      <div class="row report-toolbar-head">
        <div>
          <h3>${l("Filter influencers", "فلترة المؤثرين")}</h3>
          <p class="panel-subtitle">${l("Use these filters to find the right influencer record before taking action.", "استخدم هذه الفلاتر للوصول إلى سجل المؤثر الصحيح قبل تنفيذ أي إجراء.")}</p>
        </div>
        <div class="row-wrap">
          <span class="badge">${rows.length} ${escapeHtml(l("matching records", "سجل مطابق"))}</span>
          <span class="badge">${activeCount} ${escapeHtml(l("active", "نشط"))}</span>
          ${suspendedCount ? `<span class="badge">${suspendedCount} ${escapeHtml(l("suspended", "موقوف"))}</span>` : ""}
          ${rejectedCount ? `<span class="badge">${rejectedCount} ${escapeHtml(l("rejected", "مرفوض"))}</span>` : ""}
        </div>
      </div>
      <form class="form-grid two-col" id="influencerFilterForm">
        <label class="field"><span>${l("Search", "بحث")}</span><input name="query" value="${escapeHtml(state.influencerFilters.query)}" placeholder="${l("Name, email, tag", "الاسم أو البريد أو العلامة")}" /></label>
        <label class="field"><span>${l("Status", "الحالة")}</span>
          <select name="status">
            <option value="">${l("All", "الكل")}</option>
            <option value="active" ${state.influencerFilters.status === "active" ? "selected" : ""}>active</option>
            <option value="pending" ${state.influencerFilters.status === "pending" ? "selected" : ""}>pending</option>
            <option value="suspended" ${state.influencerFilters.status === "suspended" ? "selected" : ""}>suspended</option>
            <option value="rejected" ${state.influencerFilters.status === "rejected" ? "selected" : ""}>rejected</option>
          </select>
        </label>
        <label class="field"><span>${l("City", "المدينة")}</span>${renderCitySelect("cityId", state.influencerFilters.cityId, true)}</label>
        <label class="field"><span>${l("Category", "الفئة")}</span>${renderCategorySelect("categoryId", state.influencerFilters.categoryId, true)}</label>
        <label class="field"><span>${l("Tag", "العلامة")}</span>
          <select name="tag">
            <option value="">${l("All tags", "جميع العلامات")}</option>
            ${(state.data?.tags || [])
              .filter((tag) => tag.status === "active")
              .map((tag) => `<option value="${escapeHtml(tag.value)}" ${state.influencerFilters.tag === tag.value ? "selected" : ""}>${escapeHtml(tag.value)}</option>`)
              .join("")}
          </select>
        </label>
      </form>
    </section>
    <section class="panel">
      <div class="row report-toolbar-head">
        <div>
          <h3>${l("Pending approvals", "طلبات بانتظار الاعتماد")}</h3>
          <p class="panel-subtitle">${l("Approve or reject new influencer sign-ups before they can access the platform.", "اعتمد أو ارفض تسجيلات المؤثرين الجديدة قبل أن يتمكنوا من الوصول إلى المنصة.")}</p>
        </div>
        <span class="badge ${pending.length ? "warning" : "success"}">${pending.length} ${escapeHtml(l("pending", "معلق"))}</span>
      </div>
      <div class="stack">
        ${pending.length
          ? pending
              .map(
                (user) => `
                  <article class="participant-card">
                    <div class="row">
                      <div>
                        <strong>${renderInfluencerProfileTrigger(user.id, user.fullName)}</strong>
                        <p>${escapeHtml(cityName(user.cityId))} · ${escapeHtml(categoryName(user.categoryId))}</p>
                      </div>
                      <span class="badge ${statusTone(user.status)}">${escapeHtml(user.status)}</span>
                    </div>
                    <p class="compact">${escapeHtml(user.email)}</p>
                    <div class="row-wrap" style="margin-top: 12px;">
                      <button data-action="approve-user" data-user-id="${user.id}">${l("Approve", "اعتماد")}</button>
                      <button class="secondary" data-action="reject-user" data-user-id="${user.id}">${l("Reject", "رفض")}</button>
                    </div>
                  </article>
                `
              )
              .join("")
          : `<div class="empty-state">${l("No pending sign-ups right now.", "لا توجد طلبات تسجيل معلقة الآن.")}</div>`}
      </div>
    </section>
    <section class="panel">
      <div class="row report-toolbar-head">
        <div>
          <h3>${l("All influencers", "كل المؤثرين")}</h3>
          <p class="panel-subtitle">${l("Review each influencer record, update internal notes, and take direct account actions from the same page.", "راجع كل سجل مؤثر وحدّث الملاحظات الداخلية ونفّذ إجراءات الحساب مباشرة من الصفحة نفسها.")}</p>
        </div>
      </div>
      <div class="stack">
        ${rows.length
          ? rows
              .map((user) => {
                const summary = summaries.get(user.id) || {};
                return `
                  <article class="campaign-card">
                    <div class="row">
                      <div>
                        <strong>${renderInfluencerProfileTrigger(user.id, user.fullName)}</strong>
                        <p>${escapeHtml(cityName(user.cityId))} · ${escapeHtml(categoryName(user.categoryId))}</p>
                      </div>
                      <span class="badge ${statusTone(user.status)}">${escapeHtml(user.status)}</span>
                    </div>
                    <div class="row-wrap" style="margin-top: 10px;">
                      <span class="badge">${summary.joined || 0} ${l("joins", "انضمام")}</span>
                      <span class="badge">${summary.submitted || 0} ${l("proofs", "إثبات")}</span>
                      <span class="badge">${summary.pending || 0} ${l("pending", "معلق")}</span>
                      <span class="badge">${summary.completionRate || 0}% ${l("proof rate", "معدل الإثبات")}</span>
                    </div>
                    <p class="compact">${escapeHtml(user.email)}</p>
                    <p class="compact">${escapeHtml(l("Preferred platform", "المنصة المفضلة"))}: ${escapeHtml(user.preferredPlatform || l("Not set", "غير محدد"))}</p>
                    <form class="form-grid two-col admin-influencer-form" data-user-id="${user.id}" style="margin-top: 12px;">
                      ${renderAdminTagCheckboxField(user.tags || [])}
                      <label class="field"><span>${l("Notes", "الملاحظات")}</span><input name="notes" value="${escapeHtml((user.notes || []).join(", "))}" placeholder="${l("Internal notes", "ملاحظات داخلية")}" /></label>
                      <p class="compact" style="grid-column: 1 / -1;">${l("Choose approved tags from the list below. Add or deactivate tags from Master Data when needed.", "اختر العلامات المعتمدة من القائمة أدناه. أضف أو عطّل العلامات من البيانات الأساسية عند الحاجة.")}</p>
                      <div class="row-wrap" style="grid-column: 1 / -1;">
                        <button type="submit">${l("Save tags and notes", "حفظ العلامات والملاحظات")}</button>
                        <button type="button" class="secondary" data-action="set-user-status" data-status="${user.status === "active" ? "suspended" : "active"}" data-user-id="${user.id}">${user.status === "active" ? l("Deactivate", "إيقاف") : l("Reactivate", "إعادة تفعيل")}</button>
                        <button type="button" class="secondary" data-action="generate-reset-link" data-user-id="${user.id}">${l("Generate reset link", "توليد رابط إعادة تعيين")}</button>
                        <button type="button" class="secondary" data-action="toggle-password-editor" data-user-id="${user.id}">${state.passwordEditorUserId === user.id ? l("Close password", "إغلاق كلمة المرور") : l("Change password", "تغيير كلمة المرور")}</button>
                      </div>
                    </form>
                    ${state.passwordEditorUserId === user.id ? `<form class="inline-form manual-password-form" data-user-id="${user.id}" style="margin-top: 12px;">
                      ${renderPasswordField("password", { required: true, autocomplete: "new-password", hint: passwordRequirementHint(), label: l("Set manual password", "تعيين كلمة مرور يدوية"), minLength: 8 })}
                      <button type="submit">${l("Save password", "حفظ كلمة المرور")}</button>
                    </form>` : ""}
                  </article>
                `;
              })
              .join("")
          : `<div class="empty-state">${l("No influencers match the current filter.", "لا يوجد مؤثرون مطابقون للفلاتر الحالية.")}</div>`}
      </div>
    </section>
  `;
}

function renderCampaignHealthCards(campaigns) {
  return campaigns.length
    ? `<div class="stack">${campaigns
        .map(
          (campaign) => `
            <article class="campaign-card">
              <div class="row">
                <strong>${renderCampaignTitleLink(campaign)}</strong>
              </div>
              <p>${escapeHtml(campaignAudience(campaign))}</p>
              <div class="row-wrap" style="margin-top: 10px;">
                <span class="badge">${campaign.codeStats.total} ${l("codes", "كود")}</span>
                <span class="badge">${campaign.codeStats.available} ${l("available", "متاح")}</span>
                <span class="badge">${campaign.codeStats.reserved} ${l("reserved", "محجوز")}</span>
                ${campaign.codeStats.blocked ? `<span class="badge">${campaign.codeStats.blocked} ${l("blocked", "محظور")}</span>` : ""}
              </div>
            </article>
          `
        )
        .join("")}</div>`
    : `<div class="empty-state">${l("No campaigns yet.", "لا توجد حملات بعد.")}</div>`;
}

function renderPendingProofList() {
  const pending = (state.data?.participants || []).filter((participant) => participantNeedsProof(participant.status)).slice(0, 8);
  return pending.length
    ? `<div class="stack">${pending
        .map(
          (participant) => `
            <article class="list-card">
              <div class="row">
                <strong>${renderInfluencerProfileTrigger(participant.influencerId, participant.influencerName)}</strong>
                <span class="badge warning">${l("Proof pending", "الإثبات معلق")}</span>
              </div>
              <p>${renderCampaignTitleLink(participant)}</p>
            </article>
          `
        )
        .join("")}</div>`
    : `<div class="empty-state">${l("No pending proof submissions right now.", "لا توجد إثباتات معلقة حالياً.")}</div>`;
}

function renderInfluencerTable(influencers, includeActions = true) {
  return `
    <div class="stack">
      ${influencers
        .map(
          (user) => `
            <article class="list-card">
              <div class="row">
                <strong>${user.role === "influencer" ? renderInfluencerProfileTrigger(user.id, user.fullName) : escapeHtml(user.fullName)}</strong>
                <span class="badge ${statusTone(user.status)}">${escapeHtml(user.status)}</span>
              </div>
              <p>${escapeHtml(cityName(user.cityId))} · ${escapeHtml(categoryName(user.categoryId))}</p>
              ${includeActions ? `<p class="compact">${escapeHtml(user.email)}</p>` : ""}
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderCampaignsPage() {
  const allCampaigns = currentCampaigns();
  const searchQuery = state.campaignSearch.trim().toLowerCase();
  const campaigns = allCampaigns.filter((campaign) => {
    if (!searchQuery) return true;
    const haystack = `${campaign.titleEn || ""} ${campaign.titleAr || ""} ${campaign.audience || ""} ${campaign.audienceAr || ""} ${campaign.offerDescription || ""} ${campaign.descriptionEn || ""} ${campaign.descriptionAr || ""}`.toLowerCase();
    return haystack.includes(searchQuery);
  });
  const participants = state.data?.participants || [];
  const activeCount = campaigns.filter((campaign) => campaign.status === "live").length;
  const completedCount = campaigns.filter((campaign) => campaign.status === "completed").length;
  const draftCount = campaigns.filter((campaign) => campaign.status === "draft").length;
  const unpublishedCount = campaigns.filter((campaign) => campaign.status === "deactivated").length;
  const totalCodes = campaigns.reduce((sum, campaign) => sum + (campaign.codeStats.total || 0), 0);
  const confirmedInterest = participants.filter((participant) => participant.status !== "canceled").length;
  const codeInterestRate = safePercent(confirmedInterest, totalCodes);
  const submittedLinks = participants.filter((participant) => ["submitted", "completed"].includes(participant.status)).length;
  const submissionRate = safePercent(submittedLinks, confirmedInterest);
  const pendingProof = Math.max(confirmedInterest - submittedLinks, 0);
  return `
    ${pageHeader(
      l("Campaigns", "الحملات"),
      l("List, create, edit, publish, and manage code pools from dedicated campaign pages.", "استعرض الحملات وأنشئها وعدلها وانشرها وأدر أكوادها من صفحات مستقلة."),
      {
        heroStats: [
          { label: l("Live", "مباشرة"), value: String(activeCount) },
          { label: l("Draft", "مسودة"), value: String(draftCount) },
          { label: l("Completed", "مكتملة"), value: String(completedCount) },
          { label: l("Unpublished", "غير منشورة"), value: String(unpublishedCount) },
        ],
        compactHeroStats: true,
      }
    )}
    ${metricGrid([
      {
        label: l("Campaign overview", "نظرة عامة على الحملات"),
        value: campaigns.length,
        note: l(
          `Live ${activeCount} · Completed ${completedCount} · Draft ${draftCount} · Unpublished ${unpublishedCount}`,
          `مباشرة ${activeCount} · مكتملة ${completedCount} · مسودة ${draftCount} · غير منشورة ${unpublishedCount}`
        ),
      },
      {
        label: l("Code interest", "الاهتمام بالأكواد"),
        value: `${codeInterestRate}%`,
        note: l(
          `All codes ${totalCodes} · Reserved by influencers ${confirmedInterest}`,
          `كل الأكواد ${totalCodes} · أكواد محجوزة للمؤثرين ${confirmedInterest}`
        ),
      },
      {
        label: l("Proof submission", "إرسال الإثبات"),
        value: `${submissionRate}%`,
        note: l(
          `Reserved codes ${confirmedInterest} · Submitted links ${submittedLinks}`,
          `أكواد محجوزة ${confirmedInterest} · روابط مرسلة ${submittedLinks}`
        ),
      },
      {
        label: l("Pending proof", "إثباتات معلقة"),
        value: pendingProof,
        note: l(
          `Reserved codes ${confirmedInterest} · Still pending ${pendingProof}`,
          `أكواد محجوزة ${confirmedInterest} · ما زال معلقًا ${pendingProof}`
        ),
      },
    ])}
    <section class="content-grid">
      <section class="panel panel-wide">
        <h3>${l("Campaign List", "قائمة الحملات")}</h3>
        <div class="row report-toolbar-head" style="margin-bottom: 14px;">
          <label class="field" style="flex: 1;">
            <span>${l("Search campaigns", "البحث في الحملات")}</span>
            <input class="search-input" name="campaignSearch" value="${escapeHtml(state.campaignSearch)}" placeholder="${escapeHtml(l("Search title, audience, offer, description", "ابحث في العنوان أو الجمهور أو العرض أو الوصف"))}" />
          </label>
          <span class="badge">${campaigns.length} ${l("of", "من")} ${allCampaigns.length} ${escapeHtml(l("campaigns", "حملة"))}</span>
        </div>
        <div class="stack">
          ${campaigns.length
            ? campaigns
                .map(
                  (campaign) => `
                  <article class="campaign-card">
                      ${renderCampaignBanner(campaign, "thumb")}
                      <div class="row">
                        <div>
                          <strong>${renderCampaignTitleLink(campaign)}</strong>
                          <p>${escapeHtml(campaignAudience(campaign))}</p>
                        </div>
                      </div>
                      <div class="row-wrap" style="margin-top: 12px;">
                        <span class="badge">${campaign.codeStats.total} ${l("codes", "كود")}</span>
                        <span class="badge">${campaign.codeStats.available} ${l("available", "متاح")}</span>
                        <span class="badge">${campaign.codeStats.reserved} ${l("reserved", "محجوز")}</span>
                        ${campaign.codeStats.blocked ? `<span class="badge">${campaign.codeStats.blocked} ${l("blocked", "محظور")}</span>` : ""}
                      </div>
                      <div class="row-wrap" style="margin-top: 14px;">
                        <button class="secondary" data-action="view-campaign" data-campaign-id="${campaign.id}">${l("View Campaign", "عرض الحملة")}</button>
                        <button data-action="edit-campaign" data-campaign-id="${campaign.id}">${l("Edit Campaign", "تعديل الحملة")}</button>
                        <button class="secondary" data-action="duplicate-campaign" data-campaign-id="${campaign.id}">${l("Duplicate", "نسخ")}</button>
                      </div>
                    </article>
                  `
                )
                .join("")
            : `<div class="empty-state">${l("No campaigns yet.", "لا توجد حملات بعد.")}</div>`}
        </div>
      </section>
      <section class="panel">
        <h3>${l("Create Campaign", "إنشاء حملة")}</h3>
        ${renderCampaignForm(null)}
      </section>
    </section>
  `;
}

function renderCampaignForm(campaign) {
  const selectedBranchIds = new Set(campaign?.branchIds || []);
  const targetCityIds = new Set(campaign?.targetCityIds || []);
  const targetCategoryIds = new Set(campaign?.targetCategoryIds || []);
  const targetTags = new Set(campaign?.targetTags || []);
  const targetPlatformIds = new Set((campaign?.targetPlatformIds || []).map(Number));
  const tagOptions = (state.data?.tags || [])
    .filter((tag) => tag.status === "active" || targetTags.has(tag.value))
    .sort((left, right) => compareValues(left.value, right.value));
  const branchMode = campaign?.branchMode || "all";
  const isCreate = !campaign;
  return `
    <form class="campaign-form-stack" id="${campaign ? "editCampaignForm" : "createCampaignForm"}">
      ${campaign ? `<input type="hidden" name="campaignId" value="${campaign.id}" />` : ""}
      <section class="form-section">
        <div class="form-section-header">
          <h4>${l("Basic setup", "الإعداد الأساسي")}</h4>
          <p>${l("Name the campaign, choose its type, and set the main messaging managers and influencers will see.", "قم بتسمية الحملة وحدد نوعها واضبط الرسائل الأساسية التي سيشاهدها المديرون والمؤثرون.")}</p>
        </div>
        <div class="form-grid two-col">
          <label class="field"><span>Title (EN) <em class="required-mark">*</em></span><input name="titleEn" required value="${escapeHtml(campaign?.titleEn || "")}" /></label>
          <label class="field"><span>Title (AR) <em class="required-mark">*</em></span><input name="titleAr" required value="${escapeHtml(campaign?.titleAr || "")}" /></label>
          <label class="field"><span>${l("Type", "النوع")} <em class="required-mark">*</em></span>
            <select name="type">
              <option value="shop_visit" ${campaign?.type === "shop_visit" || !campaign ? "selected" : ""}>Shop Visit</option>
              <option value="product_trial" ${campaign?.type === "product_trial" ? "selected" : ""}>Product Trial</option>
            </select>
          </label>
          <label class="field"><span>${l("Status", "الحالة")} <em class="required-mark">*</em></span>
            <select name="status">
              ${["draft", "live", "deactivated", "completed"]
                .map((status) => `<option value="${status}" ${campaign?.status === status ? "selected" : !campaign && status === "draft" ? "selected" : ""}>${status}</option>`)
                .join("")}
            </select>
          </label>
          <label class="field"><span>Audience (EN)</span><input name="audience" value="${escapeHtml(campaign?.audience || "")}" /></label>
          <label class="field"><span>Audience (AR)</span><input name="audienceAr" value="${escapeHtml(campaign?.audienceAr || "")}" /></label>
          <label class="field field-span-full"><span>Description (EN) <em class="required-mark">*</em></span><textarea name="descriptionEn" required>${escapeHtml(campaign?.descriptionEn || "")}</textarea></label>
          <label class="field field-span-full"><span>Description (AR)</span><textarea name="descriptionAr">${escapeHtml(campaign?.descriptionAr || "")}</textarea></label>
          <label class="field field-span-full">
            <span>${l("Caption guide (optional)", "دليل التعليق (اختياري)")}</span>
            <textarea name="captionGuide" rows="4" placeholder="${l("Hashtags, mentions, tone, do's and don'ts. The influencer sees this when they're about to post.", "الهاشتاقات والمنشن والنبرة وما يجب وما لا يجب. يراها المؤثر عند نشر المحتوى.")}">${escapeHtml(campaign?.captionGuide || "")}</textarea>
          </label>
          <label class="field field-span-full">
            <span>${l("WhatsApp message body (optional)", "نص رسالة الواتساب (اختياري)")}</span>
            <textarea name="whatsappMessage" rows="6" placeholder="${l("Leave empty to use the auto-generated message based on campaign details. The greeting and the deep link are always added automatically.", "اتركها فارغة لاستخدام النص التلقائي. التحية والرابط يُضافان تلقائياً.")}">${escapeHtml(campaign?.whatsappMessage || "")}</textarea>
            <small style="color: var(--muted);">${l("Greeting and deep link are added automatically — write only the message body here.", "التحية والرابط يُضافان تلقائياً — اكتب نص الرسالة فقط هنا.")}</small>
          </label>
          ${isCreate
            ? `<label class="field field-span-full"><span>${l("Campaign banner", "بانر الحملة")}</span><input type="file" name="banner" accept="image/*" /></label>`
            : ""}
        </div>
      </section>
      <section class="form-section form-section--accent">
        <div class="form-section-header">
          <h4>${l("Offer details", "تفاصيل العرض")}</h4>
          <p>${l("Define clearly what the influencer gets when the assigned code is used in the campaign.", "حدد بوضوح ما الذي سيحصل عليه المؤثر عند استخدام الكود المخصص ضمن الحملة.")}</p>
        </div>
        <div class="form-grid two-col">
          <label class="field"><span>${l("Offer usage count", "عدد استخدام العرض")} <em class="required-mark">*</em></span><input name="offerUsageCount" type="number" min="1" required value="${escapeHtml(campaign?.offerUsageCount || 1)}" /></label>
          <label class="field field-span-full"><span>${l("Offer description", "وصف العرض")} <em class="required-mark">*</em></span><input name="offerDescription" required value="${escapeHtml(campaign?.offerDescription || "")}" placeholder="${l("One free cold brew", "مشروب كولد برو مجاني واحد")}" /></label>
        </div>
      </section>
      <section class="form-section">
        <div class="form-section-header">
          <h4>${l("Timing", "التوقيت")}</h4>
          <p>${l("Set the live window, visit expectation, and proof submission deadline in one place.", "حدد نافذة الحملة وتوقعات الزيارة وآخر موعد لتسليم الإثبات في مكان واحد.")}</p>
          <p>${l("Rule: Start date <= End date <= Visit deadline <= Submission deadline.", "القاعدة: تاريخ البداية <= تاريخ النهاية <= آخر موعد للزيارة <= آخر موعد للتسليم.")}</p>
        </div>
        <div class="form-grid two-col">
          <label class="field"><span>${l("Start date", "تاريخ البداية")} <em class="required-mark">*</em></span><input name="startDate" type="date" required value="${escapeHtml(campaign?.startDate || "")}" /></label>
          <label class="field"><span>${l("End date", "تاريخ النهاية")} <em class="required-mark">*</em></span><input name="endDate" type="date" required value="${escapeHtml(campaign?.endDate || "")}" /></label>
          <label class="field"><span>${l("Visit deadline", "آخر موعد للزيارة")} <em class="required-mark">*</em></span><input name="visitDeadline" type="date" required value="${escapeHtml(campaign?.visitDeadline || "")}" /></label>
          <label class="field"><span>${l("Submission deadline", "آخر موعد للتسليم")} <em class="required-mark">*</em></span><input name="submissionDeadline" type="date" required value="${escapeHtml(campaign?.submissionDeadline || "")}" /></label>
        </div>
      </section>
      <section class="form-section">
        <div class="form-section-header">
          <h4>${l("Targeting", "الاستهداف")}</h4>
          <p>${l("Use cities, categories, and internal tags to decide who should see this campaign.", "استخدم المدن والفئات والعلامات الداخلية لتحديد من يجب أن يشاهد هذه الحملة.")}</p>
        </div>
        <div class="form-grid">
          <div class="field checkbox-field field-span-full">
            <span>${l("Target cities (leave empty for all)", "المدن المستهدفة واتركها فارغة للجميع")}</span>
            <div class="row-wrap" style="margin-bottom: 10px;">
              <button type="button" class="secondary button-small" data-action="set-checkbox-group" data-checkbox-name="targetCityIds" data-checkbox-mode="all">${l("Select all", "تحديد الكل")}</button>
              <button type="button" class="secondary button-small" data-action="set-checkbox-group" data-checkbox-name="targetCityIds" data-checkbox-mode="clear">${l("Clear", "مسح")}</button>
            </div>
            <div class="option-grid">
              ${state.data.cities
                .filter((city) => city.status === "active")
                .map(
                  (city) => `
                    <label class="option-pill">
                      <input type="checkbox" name="targetCityIds" value="${city.id}" ${targetCityIds.has(city.id) ? "checked" : ""} />
                      <span>${escapeHtml(state.locale === "ar" ? city.nameAr : city.nameEn)}</span>
                    </label>
                  `
                )
                .join("")}
            </div>
          </div>
          <div class="field checkbox-field field-span-full">
            <span>${l("Target categories (leave empty for all)", "الفئات المستهدفة واتركها فارغة للجميع")}</span>
            <div class="row-wrap" style="margin-bottom: 10px;">
              <button type="button" class="secondary button-small" data-action="set-checkbox-group" data-checkbox-name="targetCategoryIds" data-checkbox-mode="all">${l("Select all", "تحديد الكل")}</button>
              <button type="button" class="secondary button-small" data-action="set-checkbox-group" data-checkbox-name="targetCategoryIds" data-checkbox-mode="clear">${l("Clear", "مسح")}</button>
            </div>
            <div class="option-grid">
              ${state.data.categories
                .filter((category) => category.status === "active")
                .map(
                  (category) => `
                    <label class="option-pill">
                      <input type="checkbox" name="targetCategoryIds" value="${category.id}" ${targetCategoryIds.has(category.id) ? "checked" : ""} />
                      <span>${escapeHtml(state.locale === "ar" ? category.nameAr : category.nameEn)}</span>
                    </label>
                  `
                )
                .join("")}
            </div>
          </div>
          <div class="field checkbox-field field-span-full">
            <span>${l("Target tags (leave empty for all)", "علامات الاستهداف واتركها فارغة للجميع")}</span>
            <div class="row-wrap" style="margin-bottom: 10px;">
              <button type="button" class="secondary button-small" data-action="set-checkbox-group" data-checkbox-name="targetTags" data-checkbox-mode="all">${l("Select all", "تحديد الكل")}</button>
              <button type="button" class="secondary button-small" data-action="set-checkbox-group" data-checkbox-name="targetTags" data-checkbox-mode="clear">${l("Clear", "مسح")}</button>
            </div>
            <div class="option-grid">
              ${tagOptions.length
                ? tagOptions.map((tag) => `
                    <label class="option-pill">
                      <input type="checkbox" name="targetTags" value="${escapeHtml(tag.value)}" ${targetTags.has(tag.value) ? "checked" : ""} />
                      <span>${escapeHtml(tag.value)}</span>
                    </label>
                  `).join("")
                : `<span class="compact">${escapeHtml(l("No admin tags yet. Add them from Master Data first.", "لا توجد علامات معتمدة بعد. أضفها أولاً من البيانات الأساسية."))}</span>`}
            </div>
          </div>
          <label class="field"><span>${l("Target gender", "الجنس المستهدف")}</span>
            <select name="targetGender">
              <option value="" ${!campaign?.targetGender ? "selected" : ""}>${l("All", "الكل")}</option>
              <option value="male" ${campaign?.targetGender === "male" ? "selected" : ""}>${l("Male", "ذكر")}</option>
              <option value="female" ${campaign?.targetGender === "female" ? "selected" : ""}>${l("Female", "أنثى")}</option>
            </select>
          </label>
          <label class="field"><span>${l("Minimum followers", "الحد الأدنى للمتابعين")}</span><input name="minFollowers" type="number" min="0" value="${escapeHtml(campaign?.minFollowers || 0)}" /></label>
          <label class="field"><span>${l("Participant cap", "حد المشاركين")}</span><input name="participantCap" type="number" min="0" value="${escapeHtml(campaign?.participantCap || 0)}" /></label>
          <div class="field checkbox-field field-span-full">
            <span>${l("Target platforms (leave empty for all)", "المنصات المستهدفة واتركها فارغة للجميع")}</span>
            <div class="row-wrap" style="margin-bottom: 10px;">
              <button type="button" class="secondary button-small" data-action="set-checkbox-group" data-checkbox-name="targetPlatformIds" data-checkbox-mode="all">${l("Select all", "تحديد الكل")}</button>
              <button type="button" class="secondary button-small" data-action="set-checkbox-group" data-checkbox-name="targetPlatformIds" data-checkbox-mode="clear">${l("Clear", "مسح")}</button>
            </div>
            <div class="option-grid">
              ${(state.data?.platforms || [])
                .filter((platform) => platform.status === "active")
                .map(
                  (platform) => `
                    <label class="option-pill">
                      <input type="checkbox" name="targetPlatformIds" value="${platform.id}" ${targetPlatformIds.has(platform.id) ? "checked" : ""} />
                      <span>${escapeHtml(state.locale === "ar" ? platform.nameAr : platform.nameEn)}</span>
                    </label>
                  `
                )
                .join("")}
            </div>
          </div>
          <p class="compact">${l("A matching influencer needs at least one of the selected tags.", "يكفي أن يطابق المؤثر علامة واحدة على الأقل من العلامات المحددة.")}</p>
        </div>
      </section>
      <section class="form-section">
        <div class="form-section-header">
          <h4>${l("Branches", "الأفرع")}</h4>
          <p>${l("Choose whether the campaign is valid in all branches or only in selected locations.", "اختر ما إذا كانت الحملة صالحة في جميع الأفرع أو في مواقع محددة فقط.")}</p>
        </div>
        <div class="form-grid">
          <div class="field field-span-full">
            <span>${l("Branch scope", "نطاق الأفرع")} <em class="required-mark">*</em></span>
            <div class="choice-row">
              <label class="choice-pill">
                <input type="radio" name="branchMode" value="all" ${branchMode === "all" ? "checked" : ""} />
                <span>${l("All branches", "كل الأفرع")}</span>
              </label>
              <label class="choice-pill">
                <input type="radio" name="branchMode" value="selected" ${branchMode === "selected" ? "checked" : ""} />
                <span>${l("Selected branches only", "أفرع محددة فقط")}</span>
              </label>
            </div>
          </div>
          <div class="field checkbox-field field-span-full" data-branch-selection ${branchMode === "selected" ? "" : "hidden"}>
            <span>${l("Branches", "الأفرع")}</span>
            <div class="option-grid">
              ${state.data.branches
                .filter((branch) => branch.status === "active")
                .map(
                  (branch) => `
                    <label class="option-pill">
                      <input type="checkbox" name="branchIds" value="${branch.id}" ${selectedBranchIds.has(branch.id) ? "checked" : ""} ${branchMode === "selected" ? "" : "disabled"} />
                      <span>${escapeHtml(state.locale === "ar" ? branch.nameAr : branch.nameEn)}</span>
                    </label>
                  `
                )
                .join("")}
            </div>
          </div>
        </div>
      </section>
      <div class="row-wrap">
        <button type="submit">${campaign ? l("Save changes", "حفظ التعديلات") : l("Create campaign", "إنشاء حملة")}</button>
      </div>
    </form>
  `;
}

function renderCampaignEditPage() {
  const campaign = selectedCampaign();
  if (!campaign) return renderEmptyCampaignPage(l("No campaign selected.", "لا توجد حملة محددة."));
  const campaignTypeLabel =
    campaign.type === "product_trial" ? l("Product trial", "تجربة منتج") : l("Shop visit", "زيارة متجر");
  const branchScopeLabel =
    campaign.branchMode === "selected" ? l("Selected branches", "أفرع محددة") : l("All branches", "كل الأفرع");
  return `
    ${pageHeader(
      l("Edit Campaign", "تعديل الحملة"),
      l("Use this page only for campaign edits and asset updates.", "استخدم هذه الصفحة فقط لتعديل الحملة وتحديث أصولها."),
      {
        heroStats: [
          {
            label: l("Campaign status", "حالة الحملة"),
            value: `<span class="hero-status-badge badge ${statusTone(campaign.status)}">${escapeHtml(campaign.status)}</span>`,
            allowHtml: true,
          },
          {
            label: l("Campaign type", "نوع الحملة"),
            value: campaignTypeLabel,
          },
          {
            label: l("Branch scope", "نطاق الأفرع"),
            value: branchScopeLabel,
          },
        ],
        compactHeroStats: true,
      }
    )}
    ${metricGrid([
      { label: l("Campaign", "الحملة"), value: campaignTitle(campaign), note: l("Currently editing", "قيد التعديل") },
      { label: l("Status", "الحالة"), value: campaign.status, note: l("Current state", "الوضع الحالي") },
      { label: l("Uploaded codes", "أكواد مرفوعة"), value: campaign.codeStats.total || 0, note: l("Campaign capacity", "سعة الحملة") },
      { label: l("Reserved codes", "أكواد محجوزة"), value: campaign.codeStats.reserved || 0, note: l("Already assigned", "تم تخصيصها") },
    ])}
    <section class="content-grid">
      <section class="panel panel-wide">
        <h3>${l("Campaign Editor", "محرر الحملة")}</h3>
        ${renderCampaignForm(campaign)}
      </section>
      <section class="panel">
        <h3>${l("Campaign Assets", "أصول الحملة")}</h3>
        ${renderCampaignBanner(campaign, "hero")}
        <form id="bannerForm" class="form-grid" style="margin-top: 14px;">
          <input type="hidden" name="campaignId" value="${campaign.id}" />
          <label class="field"><span>${l("Banner image", "صورة البانر")}</span><input type="file" name="banner" accept="image/*" required /></label>
          <button type="submit">${l("Upload banner", "رفع البانر")}</button>
        </form>
        <h4 style="margin-top: 18px;">${l("Codes", "الأكواد")}</h4>
        <form id="uploadCodesForm" class="form-grid">
          <input type="hidden" name="campaignId" value="${campaign.id}" />
          <label class="field"><span>CSV</span><input type="file" name="codesFile" accept=".csv,text/csv" required /></label>
          <p class="compact">${l("CSV should include the campaign codes. Offer details are controlled in the campaign form.", "يجب أن يتضمن ملف CSV أكواد الحملة فقط. تفاصيل العرض يتم التحكم بها من نموذج الحملة.")}</p>
          <pre class="compact">code,usage,offer\nPICK-001,1,Free coffee</pre>
          <div class="row-wrap"><button type="button" class="secondary button-small" data-action="download-sample-csv">${l("Download sample CSV", "تحميل نموذج CSV")}</button></div>
          <button type="submit">${l("Upload codes", "رفع الأكواد")}</button>
        </form>
        <form id="resetCodesForm" class="form-grid" style="margin-top: 10px;">
          <input type="hidden" name="campaignId" value="${campaign.id}" />
          <button type="submit" class="secondary">${l("Delete uploaded codes and cancel assignments", "حذف الأكواد المرفوعة وإلغاء التخصيصات")}</button>
        </form>
        <div class="row-wrap" style="margin-top: 16px;">
          <button class="secondary" data-action="back-to-campaigns">${l("Back to campaigns", "العودة إلى الحملات")}</button>
          <button data-action="view-campaign" data-campaign-id="${campaign.id}">${l("View campaign", "عرض الحملة")}</button>
        </div>
      </section>
    </section>
  `;
}

function renderCampaignViewPage() {
  const campaign = selectedCampaign();
  if (!campaign) return renderEmptyCampaignPage(l("No campaign selected.", "لا توجد حملة محددة."));
  const whatsappEligible = eligibleInfluencersForCampaign(campaign).slice(0, 50);
  const participants = campaignParticipants(campaign.id);
  const codes = state.campaignCodesByCampaign[campaign.id] || [];
  const activeParticipants = participants.filter((item) => item.status !== "canceled").length;
  const platformJoined = participants.filter((item) => item.status !== "canceled" && item.source !== "offline").length;
  const offlineReserved = participants.filter((item) => item.status !== "canceled" && item.source === "offline").length;
  const submittedParticipants = participants.filter((item) => ["submitted", "completed"].includes(item.status)).length;
  const platformSubmitted = participants.filter(
    (item) => item.source !== "offline" && ["submitted", "completed"].includes(item.status)
  ).length;
  const pendingProof = Math.max(activeParticipants - submittedParticipants, 0);
  const platformPendingProof = Math.max(platformJoined - platformSubmitted, 0);
  const eligibleCount = eligibleInfluencerCount(campaign);
  const eligibleJoinRate = safePercent(platformJoined, eligibleCount);
  const codeInterestRate = safePercent(campaign.codeStats.reserved || 0, campaign.codeStats.total || 0);
  const postingRate = safePercent(platformSubmitted, platformJoined);
  const pendingProofRate = safePercent(platformPendingProof, platformJoined);
  const campaignTypeLabel =
    campaign.type === "product_trial" ? l("Product trial", "تجربة منتج") : l("Shop visit", "زيارة متجر");
  const branchScopeLabel =
    campaign.branchMode === "selected" ? l("Selected branches", "أفرع محددة") : l("All branches", "كل الأفرع");
  return `
    ${pageHeader(
      l("View Campaign", "عرض الحملة"),
      l("Review banner, audience, code pool, participant assignments, and reminder copy.", "راجع البانر والاستهداف ومخزون الأكواد وتخصيصات المشاركين ونصوص التذكير."),
      {
        heroStats: [
          {
            label: l("Campaign status", "حالة الحملة"),
            value: `<span class="hero-status-badge badge ${statusTone(campaign.status)}">${escapeHtml(campaign.status)}</span>`,
            allowHtml: true,
          },
          {
            label: l("Campaign type", "نوع الحملة"),
            value: campaignTypeLabel,
          },
          {
            label: l("Branch scope", "نطاق الأفرع"),
            value: branchScopeLabel,
          },
        ],
        compactHeroStats: true,
      }
    )}
    ${metricGrid([
      {
        label: l("Join rate", "معدل الانضمام"),
        value: `${eligibleJoinRate}%`,
        note: l(
          `Eligible influencers ${eligibleCount} · Platform joined ${platformJoined} · Offline reserved ${offlineReserved}`,
          `المؤثرون المؤهلون ${eligibleCount} · انضموا عبر المنصة ${platformJoined} · حجز خارجي ${offlineReserved}`
        ),
      },
      {
        label: l("Code interest", "الاهتمام بالأكواد"),
        value: `${codeInterestRate}%`,
        note: l(
          `Total codes ${campaign.codeStats.total || 0} · Reserved ${campaign.codeStats.reserved || 0} · Available ${campaign.codeStats.available || 0}`,
          `إجمالي الأكواد ${campaign.codeStats.total || 0} · محجوز ${campaign.codeStats.reserved || 0} · متاح ${campaign.codeStats.available || 0}`
        ),
      },
      {
        label: l("Posting rate", "معدل النشر"),
        value: `${postingRate}%`,
        note: l(
          `Platform joined ${platformJoined} · Submitted links ${platformSubmitted} · Offline reserved ${offlineReserved}`,
          `انضموا عبر المنصة ${platformJoined} · الروابط المرسلة ${platformSubmitted} · حجز خارجي ${offlineReserved}`
        ),
      },
      {
        label: l("Pending proof", "إثباتات معلقة"),
        value: `${pendingProofRate}%`,
        note: l(
          `Platform pending ${platformPendingProof} · Offline reserved ${offlineReserved} · Canceled ${participants.filter((item) => item.status === "canceled").length}`,
          `معلق عبر المنصة ${platformPendingProof} · حجز خارجي ${offlineReserved} · ملغاة ${participants.filter((item) => item.status === "canceled").length}`
        ),
      },
    ])}
    <section class="content-grid">
      <section class="panel panel-wide">
        <h3>${escapeHtml(campaignTitle(campaign))}</h3>
        ${renderCampaignBanner(campaign, "hero")}
        <p class="panel-subtitle">${escapeHtml(campaignDescription(campaign))}</p>
        ${campaign.captionGuide ? `
          <article class="note-card" style="margin-top: 14px;">
            <strong>${l("Caption guide", "دليل التعليق")}</strong>
            <p style="white-space: pre-wrap; margin-top: 8px;">${escapeHtml(campaign.captionGuide)}</p>
          </article>
        ` : ""}
        <div class="row-wrap" style="margin-bottom: 16px;">
          <span class="badge ${statusTone(campaign.status)}">${escapeHtml(campaign.status)}</span>
          <span class="badge">${escapeHtml(campaignAudience(campaign))}</span>
          <span class="badge">${l("Visit deadline", "آخر موعد للزيارة")}: ${formatDate(campaign.visitDeadline)}</span>
          <span class="badge">${l("Submission deadline", "آخر موعد للتسليم")}: ${formatDate(campaign.submissionDeadline)}</span>
        </div>
        ${renderCampaignOffer(campaign)}
        <article class="note-card">
          <div class="row">
            <strong>${l("WhatsApp post text", "نص واتساب")}</strong>
            <button type="button" class="secondary button-small" data-action="copy-whatsapp-text" data-campaign-id="${campaign.id}">${l("Copy WhatsApp text", "نسخ نص واتساب")}</button>
          </div>
          <pre class="compact" style="white-space: pre-wrap; margin-top: 12px;">${escapeHtml(generateCampaignShareText(campaign))}</pre>
        </article>
        <article class="note-card" style="margin-top: 14px;">
          <div class="row report-toolbar-head">
            <div>
              <strong>${l("Send to specific influencers", "إرسال لمؤثرين محددين")}</strong>
              <p class="panel-subtitle">${l("Click an influencer to open WhatsApp with the share message and deep link pre-filled.", "اضغط على المؤثر لفتح واتساب مع رسالة المشاركة ورابط الانتقال.")}</p>
            </div>
          </div>
          <div class="row-wrap" style="gap: 8px;">
            ${
              whatsappEligible.length
                ? whatsappEligible
                    .map(
                      (user) => `
                        <a class="badge" target="_blank" rel="noreferrer"
                           href="${buildWhatsAppLink(user.mobile, generateCampaignShareText(campaign, { recipientName: user.fullName }))}">
                          ${escapeHtml(user.fullName)}
                        </a>
                      `
                    )
                    .join("")
                : `<span class="compact">${escapeHtml(l("No eligible influencers for this campaign right now.", "لا يوجد مؤثرون مؤهلون لهذه الحملة حالياً."))}</span>`
            }
          </div>
        </article>
        <article class="note-card" style="margin-top: 14px;">
          <strong>${l("Email-ready reminder", "نص بريد للتذكير")}</strong>
          <p>${escapeHtml(generateCampaignEmailText(campaign))}</p>
        </article>
        <div class="row-wrap" style="margin-top: 16px;">
          <button class="secondary" data-action="back-to-campaigns">${l("Back to campaigns", "العودة إلى الحملات")}</button>
          <button data-action="edit-campaign" data-campaign-id="${campaign.id}">${l("Edit campaign", "تعديل الحملة")}</button>
          <button class="secondary" data-action="duplicate-campaign" data-campaign-id="${campaign.id}">${l("Duplicate", "نسخ")}</button>
        </div>
      </section>
      <section class="panel">
        <h3>${l("Uploaded Codes", "الأكواد المرفوعة")}</h3>
        ${campaign.offerDescription || campaign.offerUsageCount
          ? `
            <div class="code-panel-offer">
              <strong>${l("Campaign offer", "عرض الحملة")}</strong>
              <p>${escapeHtml(campaign.offerDescription || l("Campaign-level offer attached to these codes.", "عرض على مستوى الحملة مرتبط بهذه الأكواد."))}</p>
              <span class="badge">${l("Uses", "عدد الاستخدام")}: ${escapeHtml(campaign.offerUsageCount || 1)}</span>
            </div>
          `
          : ""}
        <div class="code-stack code-mini-list">
          ${codes.length
            ? codes
                .slice(0, 40)
                .map(
                  (code) => `
                    <article class="code-mini-row">
                      <div class="row">
                        <strong class="code-mini-value">${escapeHtml(code.codeValue)}</strong>
                        <span class="badge ${statusTone(code.status)}">${escapeHtml(code.status)}</span>
                      </div>
                      <div class="row-wrap code-mini-meta">
                        <span>${l("Uses", "عدد الاستخدام")}: ${escapeHtml(code.usageCount || 1)}</span>
                        <span>·</span>
                        <span>${escapeHtml(code.reservedByInfluencerName || l("Unassigned", "غير مخصص"))}</span>
                      </div>
                      ${code.status === "available"
                        ? `
                          <div class="row-wrap">
                            <button class="secondary button-small" data-action="toggle-manual-reserve" data-code-id="${code.id}">
                              ${state.manualReserveCodeId === code.id ? l("Cancel", "إلغاء") : l("Reserve offline", "حجز خارجي")}
                            </button>
                          </div>
                          ${state.manualReserveCodeId === code.id
                            ? `
                              <form class="form-grid manual-reserve-form" data-code-id="${code.id}">
                                <label class="field"><span>${l("Influencer name", "اسم المؤثر")} <em class="required-mark">*</em></span><input name="offlineName" required /></label>
                                <label class="field"><span>${l("Mobile", "الهاتف")}</span><input name="offlineMobile" /></label>
                                <label class="field"><span>${l("Platform", "المنصة")}</span>${renderPlatformSelect("platform", "")}</label>
                                <label class="field"><span>${l("Notes", "ملاحظات")}</span><textarea name="offlineNotes"></textarea></label>
                                <button type="submit">${l("Reserve this code", "احجز هذا الكود")}</button>
                              </form>
                            `
                            : ""}
                        `
                        : ""}
                    </article>
                  `
                )
                .join("")
            : `<div class="empty-state">${l("No uploaded codes yet.", "لا توجد أكواد مرفوعة بعد.")}</div>`}
        </div>
      </section>
    </section>
    <section class="panel">
      <h3>${l("Participants", "المشاركون")}</h3>
      <div class="stack">
        ${participants.length
          ? participants
              .map(
                (participant) => `
                  <article class="participant-card">
                    <div class="row">
                      <div>
                        <strong>${participant.influencerId ? renderInfluencerProfileTrigger(participant.influencerId, participant.influencerName) : escapeHtml(participant.influencerName)}</strong>
                        <p>${
                          participant.source === "offline"
                            ? escapeHtml(l("Offline reservation", "حجز خارجي"))
                            : `${escapeHtml(cityName(participant.influencerCityId))} · ${escapeHtml(categoryName(participant.influencerCategoryId))}`
                        }</p>
                      </div>
                      <span class="badge ${participantDisplayTone(participant)}">${escapeHtml(participantDisplayStatus(participant))}</span>
                    </div>
                    <div class="row-wrap" style="margin-top: 10px;">
                      <span class="badge">${l("Code", "الكود")}: ${escapeHtml(participant.assignedCodeValue || "-")}</span>
                      <span class="badge">${l("Uses", "عدد الاستخدام")}: ${escapeHtml(participant.assignedCodeUsageCount || 1)}</span>
                      <span class="badge">${participant.source === "offline" ? l("Reserved", "محجوز") : l("Joined", "انضم")}: ${formatDate(participant.joinedAt)}</span>
                      ${participant.submittedAt ? `<span class="badge">${l("Submitted", "سلّم")}: ${formatDate(participant.submittedAt)}</span>` : ""}
                    </div>
                    ${participant.source === "offline"
                      ? `
                        <p class="compact">${escapeHtml(participant.offlineMobile || l("No mobile added.", "لم يتم إضافة هاتف."))}</p>
                        ${participant.platform ? `<p class="compact">${escapeHtml(participant.platform)}</p>` : ""}
                        ${participant.offlineNotes ? `<p>${escapeHtml(participant.offlineNotes)}</p>` : ""}
                      `
                      : ""}
                    ${participant.socialLink ? `<p><a href="${participant.socialLink}" target="_blank" rel="noreferrer">${escapeHtml(participant.socialLink)}</a></p>` : ""}
                    ${participant.feedback ? `<p>${escapeHtml(participant.feedback)}</p>` : ""}
                    <div class="row-wrap">${renderParticipantImages(participant.images || [])}</div>
                    ${participant.status !== "canceled" ? `<div class="row-wrap" style="margin-top: 12px;"><button class="secondary" data-action="remove-participant" data-participant-id="${participant.id}">${l("Remove influencer from campaign", "إزالة المؤثر من الحملة")}</button></div>` : ""}
                  </article>
                `
              )
              .join("")
          : `<div class="empty-state">${l("No participants yet.", "لا يوجد مشاركون بعد.")}</div>`}
      </div>
    </section>
  `;
}

function renderEmptyCampaignPage(message) {
  return `
    ${pageHeader(l("Campaigns", "الحملات"), message)}
    <section class="panel"><div class="empty-state">${message}</div></section>
  `;
}

function renderBranchForm(branch) {
  return `
    <form id="${branch ? "editBranchForm" : "createBranchForm"}" class="form-grid two-col" enctype="multipart/form-data">
      ${branch ? `<input type="hidden" name="branchId" value="${branch.id}" />` : ""}
      <label class="field"><span>Name (EN)</span><input name="nameEn" required value="${escapeHtml(branch?.nameEn || "")}" /></label>
      <label class="field"><span>Name (AR)</span><input name="nameAr" value="${escapeHtml(branch?.nameAr || "")}" /></label>
      <label class="field"><span>${l("City", "المدينة")}</span>${renderCitySelect("cityId", branch?.cityId || "")}</label>
      <label class="field"><span>${l("Status", "الحالة")}</span>
        <select name="status">
          <option value="active" ${!branch || branch.status === "active" ? "selected" : ""}>active</option>
          <option value="inactive" ${branch?.status === "inactive" ? "selected" : ""}>inactive</option>
        </select>
      </label>
      <label class="field"><span>Address (EN)</span><input name="addressEn" value="${escapeHtml(branch?.addressEn || "")}" /></label>
      <label class="field"><span>Address (AR)</span><input name="addressAr" value="${escapeHtml(branch?.addressAr || "")}" /></label>
      <label class="field"><span>${l("Daily visit cap", "الحد اليومي للزيارات")}</span><input name="maxVisitsPerDay" type="number" min="0" value="${escapeHtml(branch?.maxVisitsPerDay || 0)}" /></label>
      <div class="field">
        <span>${l("Cashier PIN", "رمز الكاشير")}</span>
        <div class="row-wrap">
          <span class="badge">${escapeHtml(branch?.pin || l("Auto-generated after save", "يُنشأ تلقائياً بعد الحفظ"))}</span>
          ${branch?.pin ? `<button type="button" class="secondary button-small" data-action="copy-branch-pin" data-pin="${escapeHtml(branch.pin)}">${l("Copy", "نسخ")}</button>` : ""}
          ${branch ? `<button type="button" class="secondary button-small" data-action="rotate-branch-pin" data-branch-id="${branch.id}">${l("Rotate PIN", "تدوير الرمز")}</button>` : ""}
        </div>
      </div>
      <label class="field field-span-full"><span>${l("Google Maps link", "رابط جوجل ماب")}</span><input name="mapLink" type="url" value="${escapeHtml(branch?.mapLink || "")}" /></label>
      <label class="field field-span-full"><span>${l("Branch image", "صورة الفرع")}</span><input name="image" type="file" accept="image/*" /></label>
      <button type="submit">${branch ? l("Save branch", "حفظ الفرع") : l("Create branch", "إنشاء الفرع")}</button>
    </form>
  `;
}

function renderBranchesPage() {
  const branches = (state.data?.branches || [])
    .slice()
    .sort((left, right) =>
      compareValues((state.locale === "ar" ? left.nameAr : left.nameEn) || left.nameEn || "", (state.locale === "ar" ? right.nameAr : right.nameEn) || right.nameEn || "")
    );
  return `
    ${pageHeader(l("Branches", "الأفرع"), l("Create branches, manage their city and address details, and keep the branch list tidy for campaign setup.", "أنشئ الأفرع وأدر تفاصيل المدينة والعنوان وحافظ على تنظيم قائمة الأفرع لاستخدامها في إعداد الحملات."), { hideHeroStats: true })}
    <section class="content-grid">
      <section class="panel">
        <div class="row report-toolbar-head">
          <div>
            <h3>${l("Add Branch", "إضافة فرع")}</h3>
            <p class="panel-subtitle">${l("Keep English and Arabic names and addresses aligned in one clean form. Cities can be managed from Master Data.", "حافظ على الأسماء والعناوين باللغتين ضمن نموذج مرتب واحد. يمكن إدارة المدن من البيانات الأساسية.")}</p>
          </div>
        </div>
        ${renderBranchForm(null)}
      </section>
      <section class="panel panel-wide">
        <div class="row report-toolbar-head">
          <div>
            <h3>${l("Existing Branches", "الأفرع الحالية")}</h3>
            <p class="panel-subtitle">${l("A clean branch list sorted by name. Click a branch name to open its edit view.", "قائمة فروع مرتبة حسب الاسم. اضغط اسم الفرع لفتح صفحة التعديل الخاصة به.")}</p>
          </div>
          <span class="badge">${branches.length} ${escapeHtml(l("branches", "فرع"))}</span>
        </div>
        ${renderDataTable(
          [
            {
              label: l("Image", "الصورة"),
              render: (row) =>
                row.imagePath
                  ? `<img class="campaign-banner thumb" src="${row.imagePath}" alt="${escapeHtml((state.locale === "ar" ? row.nameAr : row.nameEn) || row.nameEn)}" />`
                  : `<div class="campaign-banner thumb campaign-banner-fallback"><span>${escapeHtml((state.locale === "ar" ? row.nameAr : row.nameEn) || row.nameEn)}</span></div>`,
              html: true,
            },
            {
              label: l("Branch", "الفرع"),
              render: (row) => `<button type="button" class="table-link-button" data-action="edit-branch" data-branch-id="${row.id}">${escapeHtml((state.locale === "ar" ? row.nameAr : row.nameEn) || row.nameEn)}</button>`,
              html: true,
            },
            { label: l("City", "المدينة"), render: (row) => cityName(row.cityId) || "-" },
            { label: l("Address", "العنوان"), render: (row) => (state.locale === "ar" ? row.addressAr : row.addressEn) || row.addressEn || "-" },
            {
              label: l("Cashier PIN", "رمز الكاشير"),
              render: (row) =>
                row.pin
                  ? `<div class="row-wrap"><span class="badge">${escapeHtml(row.pin)}</span><button type="button" class="secondary button-small" data-action="copy-branch-pin" data-pin="${escapeHtml(row.pin)}">${l("Copy", "نسخ")}</button></div>`
                  : "-",
              html: true,
            },
            { label: l("Daily cap", "الحد اليومي"), render: (row) => Number(row.maxVisitsPerDay || 0) > 0 ? String(row.maxVisitsPerDay) : l("Unlimited", "غير محدود") },
            { label: l("Status", "الحالة"), render: (row) => `<span class="badge ${statusTone(row.status)}">${escapeHtml(row.status)}</span>`, html: true },
            { label: l("Map", "الخريطة"), render: (row) => row.mapLink ? `<a class="table-link-button" href="${escapeHtml(row.mapLink)}" target="_blank" rel="noreferrer">${escapeHtml(l("Open map", "فتح الخريطة"))}</a>` : "-", html: true },
          ],
          branches,
          l("No branches yet.", "لا توجد أفرع بعد.")
        )}
      </section>
    </section>
  `;
}

function renderBranchEditPage() {
  const branch = selectedBranch();
  if (!branch) return renderEmptyCampaignPage(l("No branch selected.", "لا يوجد فرع محدد."));
  return `
    ${pageHeader(
      l("Edit Branch", "تعديل الفرع"),
      l("Update branch naming, city, address, map, and image from one clean page.", "حدّث اسم الفرع والمدينة والعنوان والخريطة والصورة من صفحة مرتبة واحدة."),
      {
        heroStats: [
          { label: l("Branch status", "حالة الفرع"), value: `<span class="hero-status-badge badge ${statusTone(branch.status)}">${escapeHtml(branch.status)}</span>`, allowHtml: true },
          { label: l("City", "المدينة"), value: cityName(branch.cityId) || l("Not set", "غير محدد") },
          { label: l("Map link", "رابط الخريطة"), value: branch.mapLink ? l("Added", "مضاف") : l("Missing", "غير مضاف") },
        ],
        compactHeroStats: true,
      }
    )}
    <section class="content-grid">
      <section class="panel panel-wide">
        <h3>${escapeHtml((state.locale === "ar" ? branch.nameAr : branch.nameEn) || branch.nameEn)}</h3>
        ${renderBranchForm(branch)}
        <div class="row-wrap" style="margin-top: 16px;">
          <button class="secondary" data-action="back-to-branches">${l("Back to branches", "العودة إلى الأفرع")}</button>
          ${branch.mapLink ? `<a class="badge" href="${branch.mapLink}" target="_blank" rel="noreferrer">${l("Open map", "فتح الخريطة")}</a>` : ""}
        </div>
      </section>
      <section class="panel">
        <h3>${l("Branch Image", "صورة الفرع")}</h3>
        ${branch.imagePath ? `<img class="campaign-banner hero" src="${branch.imagePath}" alt="${escapeHtml(branch.nameEn)}" />` : `<div class="campaign-banner hero campaign-banner-fallback"><span>${escapeHtml((state.locale === "ar" ? branch.nameAr : branch.nameEn) || branch.nameEn)}</span><small>${escapeHtml(cityName(branch.cityId) || "")}</small></div>`}
      </section>
    </section>
  `;
}

function renderMasterDataPage() {
  const cities = (state.data?.cities || []).slice().sort((left, right) => compareValues((state.locale === "ar" ? left.nameAr : left.nameEn) || left.nameEn, (state.locale === "ar" ? right.nameAr : right.nameEn) || right.nameEn));
  const categories = (state.data?.categories || []).slice().sort((left, right) => compareValues((state.locale === "ar" ? left.nameAr : left.nameEn) || left.nameEn, (state.locale === "ar" ? right.nameAr : right.nameEn) || right.nameEn));
  const platforms = (state.data?.platforms || []).slice().sort((left, right) => compareValues((state.locale === "ar" ? left.nameAr : left.nameEn) || left.nameEn, (state.locale === "ar" ? right.nameAr : right.nameEn) || right.nameEn));
  const tags = (state.data?.tags || []).slice().sort((left, right) => compareValues(left.value, right.value));
  const visibleCities = state.masterDataShowInactive.city ? cities : cities.filter((row) => row.status === "active");
  const visibleCategories = state.masterDataShowInactive.category ? categories : categories.filter((row) => row.status === "active");
  const visiblePlatforms = state.masterDataShowInactive.platform ? platforms : platforms.filter((row) => row.status === "active");
  const visibleTags = state.masterDataShowInactive.tag ? tags : tags.filter((row) => row.status === "active");
  return `
    ${pageHeader(l("Master Data", "البيانات الأساسية"), l("Manage cities, categories, platforms, and controlled tags used across campaigns, profiles, and reporting.", "إدارة المدن والفئات والمنصات والعلامات المعتمدة المستخدمة عبر الحملات والملفات والتقارير."), { hideHeroStats: true })}
    <section class="panel">
      <div class="row report-toolbar-head">
        <div>
          <h3>${l("Cities", "المدن")}</h3>
          <p class="panel-subtitle">${l("Keep the city list compact and click a city row to open inline editing.", "حافظ على قائمة المدن بشكل مدمج واضغط على صف المدينة لفتح التعديل الداخلي.")}</p>
        </div>
        <div class="row-wrap">
          <span class="badge">${visibleCities.length} ${escapeHtml(l("visible", "ظاهر"))}</span>
          <button type="button" class="secondary" data-action="toggle-master-data-inactive" data-type="city">${state.masterDataShowInactive.city ? l("Hide inactive", "إخفاء غير النشط") : l("Show inactive", "إظهار غير النشط")}</button>
        </div>
      </div>
      <form id="createCityForm" class="form-grid two-col" style="margin-bottom: 16px;">
        <label class="field"><span>Name (EN)</span><input name="nameEn" required /></label>
        <label class="field"><span>Name (AR)</span><input name="nameAr" /></label>
        <button type="submit">${l("Add city", "إضافة مدينة")}</button>
      </form>
      ${renderDataTable(
        [
          {
            label: l("City", "المدينة"),
            render: (row) => `<button type="button" class="table-link-button" data-action="toggle-master-data-editor" data-type="city" data-id="${row.id}">${escapeHtml((state.locale === "ar" ? row.nameAr : row.nameEn) || row.nameEn)}</button>`,
            html: true,
          },
          { label: l("Arabic", "العربية"), render: (row) => row.nameAr || "-" },
          { label: l("Status", "الحالة"), render: (row) => `<span class="badge ${statusTone(row.status)}">${escapeHtml(row.status)}</span>`, html: true },
        ],
        visibleCities,
        l("No cities yet.", "لا توجد مدن بعد.")
      )}
      <div class="stack" style="margin-top: 14px;">
        ${cities
          .filter((row) => state.masterDataEditor.type === "city" && state.masterDataEditor.id === row.id)
          .map(
            (city) => `
              <form class="list-card update-city-form" data-city-id="${city.id}">
                <div class="form-grid two-col">
                  <label class="field"><span>Name (EN)</span><input name="nameEn" value="${escapeHtml(city.nameEn)}" /></label>
                  <label class="field"><span>Name (AR)</span><input name="nameAr" value="${escapeHtml(city.nameAr)}" /></label>
                  <label class="field"><span>${l("Status", "الحالة")}</span>
                    <select name="status">
                      <option value="active" ${city.status === "active" ? "selected" : ""}>active</option>
                      <option value="inactive" ${city.status === "inactive" ? "selected" : ""}>inactive</option>
                    </select>
                  </label>
                </div>
                <div class="row-wrap" style="margin-top: 12px;">
                  <button type="submit">${l("Save city", "حفظ المدينة")}</button>
                  <button type="button" class="secondary" data-action="delete-master-data" data-type="city" data-id="${city.id}">${l("Delete", "حذف")}</button>
                  <button type="button" class="secondary" data-action="toggle-master-data-editor" data-type="city" data-id="${city.id}">${l("Close", "إغلاق")}</button>
                </div>
              </form>
            `
          )
          .join("")}
      </div>
    </section>
    <section class="panel" style="margin-top: 18px;">
      <div class="row report-toolbar-head">
        <div>
          <h3>${l("Categories", "الفئات")}</h3>
          <p class="panel-subtitle">${l("Keep campaign categories tidy and edit them inline only when needed.", "حافظ على فئات الحملات بشكل مرتب وعدلها داخلياً فقط عند الحاجة.")}</p>
        </div>
        <div class="row-wrap">
          <span class="badge">${visibleCategories.length} ${escapeHtml(l("visible", "ظاهر"))}</span>
          <button type="button" class="secondary" data-action="toggle-master-data-inactive" data-type="category">${state.masterDataShowInactive.category ? l("Hide inactive", "إخفاء غير النشط") : l("Show inactive", "إظهار غير النشط")}</button>
        </div>
      </div>
      <form id="createCategoryForm" class="form-grid two-col" style="margin-bottom: 16px;">
        <label class="field"><span>Name (EN)</span><input name="nameEn" required /></label>
        <label class="field"><span>Name (AR)</span><input name="nameAr" /></label>
        <button type="submit">${l("Add category", "إضافة فئة")}</button>
      </form>
      ${renderDataTable(
        [
          {
            label: l("Category", "الفئة"),
            render: (row) => `<button type="button" class="table-link-button" data-action="toggle-master-data-editor" data-type="category" data-id="${row.id}">${escapeHtml((state.locale === "ar" ? row.nameAr : row.nameEn) || row.nameEn)}</button>`,
            html: true,
          },
          { label: l("Arabic", "العربية"), render: (row) => row.nameAr || "-" },
          { label: l("Status", "الحالة"), render: (row) => `<span class="badge ${statusTone(row.status)}">${escapeHtml(row.status)}</span>`, html: true },
        ],
        visibleCategories,
        l("No categories yet.", "لا توجد فئات بعد.")
      )}
      <div class="stack" style="margin-top: 14px;">
        ${categories
          .filter((row) => state.masterDataEditor.type === "category" && state.masterDataEditor.id === row.id)
          .map(
            (category) => `
              <form class="list-card update-category-form" data-category-id="${category.id}">
                <div class="form-grid two-col">
                  <label class="field"><span>Name (EN)</span><input name="nameEn" value="${escapeHtml(category.nameEn)}" /></label>
                  <label class="field"><span>Name (AR)</span><input name="nameAr" value="${escapeHtml(category.nameAr)}" /></label>
                  <label class="field"><span>${l("Status", "الحالة")}</span>
                    <select name="status">
                      <option value="active" ${category.status === "active" ? "selected" : ""}>active</option>
                      <option value="inactive" ${category.status === "inactive" ? "selected" : ""}>inactive</option>
                    </select>
                  </label>
                </div>
                <div class="row-wrap" style="margin-top: 12px;">
                  <button type="submit">${l("Save category", "حفظ الفئة")}</button>
                  <button type="button" class="secondary" data-action="delete-master-data" data-type="category" data-id="${category.id}">${l("Delete", "حذف")}</button>
                  <button type="button" class="secondary" data-action="toggle-master-data-editor" data-type="category" data-id="${category.id}">${l("Close", "إغلاق")}</button>
                </div>
              </form>
            `
          )
          .join("")}
      </div>
    </section>
    <section class="panel" style="margin-top: 18px;">
      <div class="row report-toolbar-head">
        <div>
          <h3>${l("Platforms", "المنصات")}</h3>
          <p class="panel-subtitle">${l("Use one simple table for platforms and open inline editing only when you need to change a row.", "استخدم جدولاً بسيطاً واحداً للمنصات وافتح التعديل الداخلي فقط عندما تحتاج إلى تعديل صف.")}</p>
        </div>
        <div class="row-wrap">
          <span class="badge">${visiblePlatforms.length} ${escapeHtml(l("visible", "ظاهر"))}</span>
          <button type="button" class="secondary" data-action="toggle-master-data-inactive" data-type="platform">${state.masterDataShowInactive.platform ? l("Hide inactive", "إخفاء غير النشط") : l("Show inactive", "إظهار غير النشط")}</button>
        </div>
      </div>
      <form id="createPlatformForm" class="form-grid two-col" style="margin-bottom: 16px;">
        <label class="field"><span>Name (EN)</span><input name="nameEn" required /></label>
        <label class="field"><span>Name (AR)</span><input name="nameAr" /></label>
        <button type="submit">${l("Add platform", "إضافة منصة")}</button>
      </form>
      ${renderDataTable(
        [
          {
            label: l("Platform", "المنصة"),
            render: (row) => `<button type="button" class="table-link-button" data-action="toggle-master-data-editor" data-type="platform" data-id="${row.id}">${escapeHtml((state.locale === "ar" ? row.nameAr : row.nameEn) || row.nameEn)}</button>`,
            html: true,
          },
          { label: l("Arabic", "العربية"), render: (row) => row.nameAr || "-" },
          { label: l("Status", "الحالة"), render: (row) => `<span class="badge ${statusTone(row.status)}">${escapeHtml(row.status)}</span>`, html: true },
        ],
        visiblePlatforms,
        l("No platforms yet.", "لا توجد منصات بعد.")
      )}
      <div class="stack" style="margin-top: 14px;">
        ${platforms
          .filter((row) => state.masterDataEditor.type === "platform" && state.masterDataEditor.id === row.id)
          .map(
            (platform) => `
              <form class="list-card update-platform-form" data-platform-id="${platform.id}">
                <div class="form-grid two-col">
                  <label class="field"><span>Name (EN)</span><input name="nameEn" value="${escapeHtml(platform.nameEn)}" /></label>
                  <label class="field"><span>Name (AR)</span><input name="nameAr" value="${escapeHtml(platform.nameAr)}" /></label>
                  <label class="field"><span>${l("Status", "الحالة")}</span>
                    <select name="status">
                      <option value="active" ${platform.status === "active" ? "selected" : ""}>active</option>
                      <option value="inactive" ${platform.status === "inactive" ? "selected" : ""}>inactive</option>
                    </select>
                  </label>
                </div>
                <div class="row-wrap" style="margin-top: 12px;">
                  <button type="submit">${l("Save platform", "حفظ المنصة")}</button>
                  <button type="button" class="secondary" data-action="delete-master-data" data-type="platform" data-id="${platform.id}">${l("Delete", "حذف")}</button>
                  <button type="button" class="secondary" data-action="toggle-master-data-editor" data-type="platform" data-id="${platform.id}">${l("Close", "إغلاق")}</button>
                </div>
              </form>
            `
          )
          .join("")}
      </div>
    </section>
    <section class="panel" style="margin-top: 18px;">
      <div class="row report-toolbar-head">
        <div>
          <h3>${l("Tags", "العلامات")}</h3>
          <p class="panel-subtitle">${l("Control the allowed tag library here so campaigns and influencer profiles only use approved tags.", "تحكم في مكتبة العلامات المسموح بها هنا حتى تستخدم الحملات وملفات المؤثرين العلامات المعتمدة فقط.")}</p>
        </div>
        <div class="row-wrap">
          <span class="badge">${visibleTags.length} ${escapeHtml(l("visible", "ظاهر"))}</span>
          <button type="button" class="secondary" data-action="toggle-master-data-inactive" data-type="tag">${state.masterDataShowInactive.tag ? l("Hide inactive", "إخفاء غير النشط") : l("Show inactive", "إظهار غير النشط")}</button>
        </div>
      </div>
      <form id="createTagForm" class="form-grid two-col" style="margin-bottom: 16px;">
        <label class="field">
          <span>${l("Tag value", "قيمة العلامة")}</span>
          <input name="value" required placeholder="vip" />
        </label>
        <div class="field">
          <span>${l("Rule", "القاعدة")}</span>
          <div class="list-card" style="padding: 12px 14px;">${escapeHtml(l("One lowercase word, numbers allowed, hyphens only when needed.", "كلمة واحدة بأحرف صغيرة، الأرقام مسموحة، والشرطات عند الحاجة فقط."))}</div>
        </div>
        <div class="row-wrap" style="grid-column: 1 / -1;">
          <button type="submit">${l("Add tag", "إضافة علامة")}</button>
        </div>
      </form>
      ${renderDataTable(
        [
          {
            label: l("Tag", "العلامة"),
            render: (row) => `<button type="button" class="table-link-button" data-action="toggle-master-data-editor" data-type="tag" data-id="${row.id}">${escapeHtml(row.value)}</button>`,
            html: true,
          },
          { label: l("Status", "الحالة"), render: (row) => `<span class="badge ${statusTone(row.status)}">${escapeHtml(row.status)}</span>`, html: true },
        ],
        visibleTags,
        l("No tags yet.", "لا توجد علامات بعد.")
      )}
      <div class="stack" style="margin-top: 14px;">
        ${tags
          .filter((row) => state.masterDataEditor.type === "tag" && state.masterDataEditor.id === row.id)
          .map(
            (tag) => `
              <form class="list-card update-tag-form" data-tag-id="${tag.id}">
                <div class="form-grid two-col">
                  <label class="field">
                    <span>${l("Tag value", "قيمة العلامة")}</span>
                    <input name="value" value="${escapeHtml(tag.value)}" />
                  </label>
                  <label class="field"><span>${l("Status", "الحالة")}</span>
                    <select name="status">
                      <option value="active" ${tag.status === "active" ? "selected" : ""}>active</option>
                      <option value="inactive" ${tag.status === "inactive" ? "selected" : ""}>inactive</option>
                    </select>
                  </label>
                  <div class="field field-span-full">
                    <small>${l("Keep tags lowercase and single-token, for example: vip or coffee-lovers.", "اجعل العلامات بأحرف صغيرة وكتوكن واحد، مثل: vip أو coffee-lovers.")}</small>
                  </div>
                </div>
                <div class="row-wrap" style="margin-top: 12px;">
                  <button type="submit">${l("Save tag", "حفظ العلامة")}</button>
                  <button type="button" class="secondary" data-action="delete-master-data" data-type="tag" data-id="${tag.id}">${l("Delete", "حذف")}</button>
                  <button type="button" class="secondary" data-action="toggle-master-data-editor" data-type="tag" data-id="${tag.id}">${l("Close", "إغلاق")}</button>
                </div>
              </form>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderManagersPage() {
  const managers = allManagers()
    .slice()
    .sort((left, right) => compareValues(left.fullName, right.fullName));
  return `
    ${pageHeader(l("Campaign Managers", "مديرو الحملات"), l("Create manager accounts directly, then open each manager record to update account details or reset access.", "أنشئ حسابات مديري الحملات مباشرة ثم افتح سجل كل مدير لتحديث البيانات أو إعادة ضبط الوصول."), { hideHeroStats: true })}
    <section class="panel">
      <h3>${l("Create Campaign Manager", "إنشاء مدير حملات")}</h3>
      <form id="createManagerForm" class="form-grid two-col">
        <label class="field"><span>${l("Full name", "الاسم الكامل")}</span><input name="fullName" required /></label>
        <label class="field"><span>${l("Email", "البريد الإلكتروني")}</span><input name="email" type="email" required /></label>
        ${renderPasswordField("password", { required: true, autocomplete: "new-password", hint: passwordRequirementHint(), label: l("Password", "كلمة المرور"), minLength: 8 })}
        <label class="field"><span>${l("Mobile", "الهاتف")}</span>${renderKuwaitMobileField("mobile")}</label>
        <div class="row-wrap field-span-full">
          <button type="submit">${l("Create manager", "إنشاء المدير")}</button>
        </div>
      </form>
    </section>
    <section class="panel panel-wide">
      <h3>${l("Existing Managers", "مديرو الحملات الحاليون")}</h3>
      <p class="panel-subtitle">${l("Click a manager name to open the full edit view with account actions.", "اضغط اسم المدير لفتح صفحة التعديل الكاملة مع إجراءات الحساب.")}</p>
      ${managers.length ? renderDataTable(
        [
          {
            label: l("Manager", "المدير"),
            render: (row) => `<button type="button" class="table-link-button" data-action="edit-manager" data-manager-id="${row.id}">${escapeHtml(row.fullName)}</button>`,
            html: true,
          },
          { label: l("Email", "البريد الإلكتروني"), render: (row) => row.email || "-" },
          { label: l("Status", "الحالة"), render: (row) => `<span class="badge ${statusTone(row.status)}">${escapeHtml(row.status)}</span>`, html: true },
          { label: l("Last login", "آخر دخول"), render: (row) => formatDateTime(row.lastLogin) },
        ],
        managers,
        l("No campaign managers yet.", "لا يوجد مديرو حملات بعد.")
      ) : `<div class="empty-state">${l("No campaign managers yet.", "لا يوجد مديرو حملات بعد.")}</div>`}
    </section>
  `;
}

function renderManagerEditPage() {
  const manager = selectedManager();
  if (!manager) {
    state.currentPage = "managers";
    return renderManagersPage();
  }
  return `
    ${pageHeader(manager.fullName, manager.email, {
      hideHeroStats: true,
      action: `<button type="button" class="secondary" data-action="back-to-managers">${l("Back to managers", "العودة إلى المديرين")}</button>`,
    })}
    <section class="hero-card">
      <div>
        <p class="eyebrow">${escapeHtml(l("Campaign manager profile", "ملف مدير الحملات"))}</p>
        <h3>${escapeHtml(manager.fullName)}</h3>
        <p>${escapeHtml(l("Update manager account details here and use the account actions on the side to control access quickly.", "حدّث بيانات حساب المدير هنا واستخدم إجراءات الحساب على الجانب للتحكم في الوصول بسرعة."))}</p>
      </div>
      <div class="hero-metrics hero-metrics--compact">
        ${[
          { label: l("Account status", "حالة الحساب"), value: `<span class="hero-status-badge badge ${statusTone(manager.status)}">${escapeHtml(manager.status)}</span>`, allowHtml: true },
          { label: l("Email", "البريد الإلكتروني"), value: escapeHtml(manager.email), note: escapeHtml(l("Primary login email for this manager account.", "البريد الإلكتروني الأساسي لتسجيل دخول هذا المدير.")) },
          { label: l("Last login", "آخر دخول"), value: escapeHtml(formatDateTime(manager.lastLogin)), note: escapeHtml(l("Most recent successful sign-in.", "آخر تسجيل دخول ناجح.")) },
        ].map((item) => `
          <div class="hero-stat">
            <span>${item.label}</span>
            <strong>${item.allowHtml ? item.value : item.value}</strong>
            ${item.note ? `<p class="hero-stat-note">${item.note}</p>` : ""}
          </div>
        `).join("")}
      </div>
    </section>
    <section class="content-grid">
      <section class="panel">
        <h3>${l("Manager details", "بيانات المدير")}</h3>
        <form id="editManagerForm" class="form-grid two-col" data-manager-id="${manager.id}">
          <label class="field"><span>${l("Full name", "الاسم الكامل")}</span><input name="fullName" required value="${escapeHtml(manager.fullName)}" /></label>
          <label class="field"><span>${l("Email", "البريد الإلكتروني")}</span><input name="email" type="email" required value="${escapeHtml(manager.email)}" /></label>
          <label class="field"><span>${l("Mobile", "الهاتف")}</span>${renderKuwaitMobileField("mobile", manager.mobile || "")}</label>
          <label class="field"><span>${l("Preferred language", "اللغة المفضلة")}</span>
            <select name="preferredLanguage">
              <option value="en" ${manager.preferredLanguage === "en" ? "selected" : ""}>English</option>
              <option value="ar" ${manager.preferredLanguage === "ar" ? "selected" : ""}>العربية</option>
            </select>
          </label>
          <label class="field"><span>${l("Status", "الحالة")}</span>
            <select name="status">
              <option value="active" ${manager.status === "active" ? "selected" : ""}>active</option>
              <option value="suspended" ${manager.status === "suspended" ? "selected" : ""}>suspended</option>
            </select>
          </label>
          <div class="row-wrap field-span-full">
            <button type="submit">${l("Save manager", "حفظ المدير")}</button>
          </div>
        </form>
      </section>
      <section class="panel">
        <h3>${l("Account actions", "إجراءات الحساب")}</h3>
        ${state.generatedLink ? `<article class="note-card" style="margin-bottom: 18px;"><strong>${l("Generated reset link", "رابط إعادة التعيين المولد")}</strong><p>${escapeHtml(state.generatedLink)}</p></article>` : ""}
        <div class="stack">
          <article class="list-card">
            <strong>${l("Reset link", "رابط إعادة التعيين")}</strong>
            <p>${l("Generate a reset link and send it manually to the manager.", "ولّد رابط إعادة تعيين وأرسله يدوياً إلى المدير.")}</p>
            <div class="row-wrap" style="margin-top: 12px;">
              <button type="button" class="secondary" data-action="generate-reset-link" data-user-id="${manager.id}">${l("Generate reset link", "توليد رابط إعادة التعيين")}</button>
            </div>
          </article>
          <article class="list-card">
            <strong>${l("Manual password", "كلمة مرور يدوية")}</strong>
            <p>${l("Set a new manual password only when you need to intervene directly.", "عيّن كلمة مرور جديدة يدوياً فقط عند الحاجة إلى تدخل مباشر.")}</p>
            <div class="row-wrap" style="margin-top: 12px;">
              <button type="button" class="secondary" data-action="toggle-password-editor" data-user-id="${manager.id}">${state.passwordEditorUserId === manager.id ? l("Close password editor", "إغلاق محرر كلمة المرور") : l("Change password", "تغيير كلمة المرور")}</button>
            </div>
            ${state.passwordEditorUserId === manager.id ? `
              <form class="form-grid manual-password-form" data-user-id="${manager.id}" style="margin-top: 12px;">
                ${renderPasswordField("password", { required: true, autocomplete: "new-password", hint: passwordRequirementHint(), label: l("New password", "كلمة المرور الجديدة"), minLength: 8 })}
                <div class="row-wrap">
                  <button type="submit">${l("Save password", "حفظ كلمة المرور")}</button>
                </div>
              </form>
            ` : ""}
          </article>
        </div>
      </section>
    </section>
  `;
}

function renderCampaignFilters(filters) {
  return `
    <section class="panel">
      <div class="row report-toolbar-head">
        <div>
          <h3>${l("Campaign Filters", "فلاتر الحملات")}</h3>
          <p class="panel-subtitle">${l("Use campaign-only filters to review campaign performance without mixing influencer or posting conditions.", "استخدم فلاتر الحملات فقط لمراجعة أداء الحملات دون خلط شروط المؤثرين أو النشر.")}</p>
        </div>
        <button type="button" class="secondary" data-action="clear-report-filters">${l("Clear filters", "مسح الفلاتر")}</button>
      </div>
      <form class="form-grid reports-filter-grid" id="reportFilterForm">
        <label class="field"><span>${l("Campaign", "الحملة")}</span>
          <select name="campaignId">
            <option value="">${l("All campaigns", "كل الحملات")}</option>
            ${currentCampaigns().map((campaign) => `<option value="${campaign.id}" ${Number(filters.campaignId) === campaign.id ? "selected" : ""}>${escapeHtml(campaignTitle(campaign))}</option>`).join("")}
          </select>
        </label>
        <label class="field"><span>${l("Status", "الحالة")}</span>
          <select name="status">
            <option value="">${l("All statuses", "كل الحالات")}</option>
            ${["live", "draft", "completed", "deactivated"].map((status) => `<option value="${status}" ${filters.status === status ? "selected" : ""}>${escapeHtml(campaignStatusLabel(status))}</option>`).join("")}
          </select>
        </label>
        <label class="field"><span>${l("Manager", "المدير")}</span>
          <select name="managerId">
            <option value="">${l("All managers", "كل المديرين")}</option>
            ${allManagers().map((manager) => `<option value="${manager.id}" ${Number(filters.managerId) === manager.id ? "selected" : ""}>${escapeHtml(manager.fullName)}</option>`).join("")}
          </select>
        </label>
        <label class="field"><span>${l("Date from", "من تاريخ")}</span><input type="date" name="dateFrom" value="${escapeHtml(filters.dateFrom || "")}" /></label>
        <label class="field"><span>${l("Date to", "إلى تاريخ")}</span><input type="date" name="dateTo" value="${escapeHtml(filters.dateTo || "")}" /></label>
      </form>
      ${renderFilterChips(reportFilterEntries("campaigns", filters))}
    </section>
  `;
}

function renderInfluencerFilters(filters) {
  return `
    <section class="panel">
      <div class="row report-toolbar-head">
        <div>
          <h3>${l("Influencer Filters", "فلاتر المؤثرين")}</h3>
          <p class="panel-subtitle">${l("Review influencer activity by profile and participation history only.", "راجع نشاط المؤثرين حسب الملف الشخصي وسجل المشاركة فقط.")}</p>
        </div>
        <button type="button" class="secondary" data-action="clear-report-filters">${l("Clear filters", "مسح الفلاتر")}</button>
      </div>
      <form class="form-grid reports-filter-grid" id="reportFilterForm">
        <label class="field"><span>${l("Influencer", "المؤثر")}</span><input name="query" value="${escapeHtml(filters.query || "")}" placeholder="${l("Search by name or email", "ابحث بالاسم أو البريد")}" /></label>
        <label class="field"><span>${l("City", "المدينة")}</span>${renderCitySelect("cityId", filters.cityId, true)}</label>
        <label class="field"><span>${l("Category", "الفئة")}</span>${renderCategorySelect("categoryId", filters.categoryId, true)}</label>
        <label class="field"><span>${l("Tag", "العلامة")}</span><input name="tag" value="${escapeHtml(filters.tag || "")}" placeholder="${l("Example: vip", "مثال: vip")}" /></label>
        <label class="field"><span>${l("Platform", "المنصة")}</span>${renderPlatformSelect("platform", filters.platform, true)}</label>
        <label class="field"><span>${l("Status", "الحالة")}</span>
          <select name="status">
            <option value="">${l("All statuses", "كل الحالات")}</option>
            <option value="active" ${filters.status === "active" ? "selected" : ""}>${l("Active", "نشط")}</option>
            <option value="pending" ${filters.status === "pending" ? "selected" : ""}>${l("Pending", "معلق")}</option>
            <option value="suspended" ${filters.status === "suspended" ? "selected" : ""}>${l("Suspended", "موقوف")}</option>
            <option value="rejected" ${filters.status === "rejected" ? "selected" : ""}>${l("Rejected", "مرفوض")}</option>
          </select>
        </label>
        <label class="field"><span>${l("Signup from", "التسجيل من")}</span><input type="date" name="dateFrom" value="${escapeHtml(filters.dateFrom || "")}" /></label>
        <label class="field"><span>${l("Signup to", "التسجيل إلى")}</span><input type="date" name="dateTo" value="${escapeHtml(filters.dateTo || "")}" /></label>
      </form>
      ${renderFilterChips(reportFilterEntries("influencers", filters))}
    </section>
  `;
}

function renderSubmissionFilters(filters) {
  return `
    <section class="panel">
      <div class="row report-toolbar-head">
        <div>
          <h3>${l("Submission Filters", "فلاتر التسليمات")}</h3>
          <p class="panel-subtitle">${l("Use posting-focused filters to review actual proof submissions and proof backlog.", "استخدم فلاتر النشر لمراجعة إثباتات التسليم الفعلية وقائمة الإثباتات المتأخرة.")}</p>
        </div>
        <button type="button" class="secondary" data-action="clear-report-filters">${l("Clear filters", "مسح الفلاتر")}</button>
      </div>
      <form class="form-grid reports-filter-grid" id="reportFilterForm">
        <label class="field"><span>${l("Campaign", "الحملة")}</span>
          <select name="campaignId">
            <option value="">${l("All campaigns", "كل الحملات")}</option>
            ${currentCampaigns().map((campaign) => `<option value="${campaign.id}" ${Number(filters.campaignId) === campaign.id ? "selected" : ""}>${escapeHtml(campaignTitle(campaign))}</option>`).join("")}
          </select>
        </label>
        <label class="field"><span>${l("Influencer", "المؤثر")}</span>
          <select name="influencerId">
            <option value="">${l("All influencers", "كل المؤثرين")}</option>
            ${allInfluencers().map((influencer) => `<option value="${influencer.id}" ${Number(filters.influencerId) === influencer.id ? "selected" : ""}>${escapeHtml(influencer.fullName)}</option>`).join("")}
          </select>
        </label>
        <label class="field"><span>${l("Platform", "المنصة")}</span>${renderPlatformSelect("platform", filters.platform, true)}</label>
        <label class="field"><span>${l("Date from", "من تاريخ")}</span><input type="date" name="dateFrom" value="${escapeHtml(filters.dateFrom || "")}" /></label>
        <label class="field"><span>${l("Date to", "إلى تاريخ")}</span><input type="date" name="dateTo" value="${escapeHtml(filters.dateTo || "")}" /></label>
      </form>
      ${renderFilterChips(reportFilterEntries("submissions", filters))}
    </section>
  `;
}

function renderCodeFilters(filters) {
  return `
    <section class="panel">
      <div class="row report-toolbar-head">
        <div>
          <h3>${l("Code Filters", "فلاتر الأكواد")}</h3>
          <p class="panel-subtitle">${l("Search the exact code pool and narrow the report by reservation and assignment state.", "ابحث داخل مجموعة الأكواد نفسها وضيّق التقرير حسب حالة الحجز والتخصيص.")}</p>
        </div>
        <button type="button" class="secondary" data-action="clear-report-filters">${l("Clear filters", "مسح الفلاتر")}</button>
      </div>
      <form class="form-grid reports-filter-grid" id="reportFilterForm">
        <label class="field"><span>${l("Code search", "البحث عن الكود")}</span><input type="search" name="query" placeholder="${escapeHtml(l("Search by code value", "ابحث بقيمة الكود"))}" value="${escapeHtml(filters.query || "")}" /></label>
        <label class="field"><span>${l("Campaign", "الحملة")}</span>
          <select name="campaignId">
            <option value="">${l("All campaigns", "كل الحملات")}</option>
            ${currentCampaigns().map((campaign) => `<option value="${campaign.id}" ${Number(filters.campaignId) === campaign.id ? "selected" : ""}>${escapeHtml(campaignTitle(campaign))}</option>`).join("")}
          </select>
        </label>
        <label class="field"><span>${l("Code status", "حالة الكود")}</span>
          <select name="status">
            <option value="">${l("All statuses", "كل الحالات")}</option>
            ${["available", "reserved", "blocked"].map((status) => `<option value="${status}" ${filters.status === status ? "selected" : ""}>${escapeHtml(codeStatusLabel(status))}</option>`).join("")}
          </select>
        </label>
        <label class="field"><span>${l("Assignment", "التخصيص")}</span>
          <select name="assignment">
            <option value="">${l("Any", "الكل")}</option>
            <option value="assigned" ${filters.assignment === "assigned" ? "selected" : ""}>${l("Assigned", "مخصص")}</option>
            <option value="unassigned" ${filters.assignment === "unassigned" ? "selected" : ""}>${l("Unassigned", "غير مخصص")}</option>
          </select>
        </label>
        <label class="field"><span>${l("Date from", "من تاريخ")}</span><input type="date" name="dateFrom" value="${escapeHtml(filters.dateFrom || "")}" /></label>
        <label class="field"><span>${l("Date to", "إلى تاريخ")}</span><input type="date" name="dateTo" value="${escapeHtml(filters.dateTo || "")}" /></label>
      </form>
      ${renderFilterChips(reportFilterEntries("codes", filters))}
    </section>
  `;
}

function renderCampaignReports(dashboard) {
  const filters = state.reportFilters.campaigns;
  const rows = dashboard.campaignRows.filter((row) => {
    if (filters.campaignId && Number(filters.campaignId) !== row.campaignId) return false;
    if (filters.status && filters.status !== row.status) return false;
    if (filters.managerId && Number(filters.managerId) !== row.managerId) return false;
    if (!rangesOverlap(row.campaign.startDate || row.campaign.createdAt, row.submissionDeadline || row.campaign.endDate, filters.dateFrom, filters.dateTo)) return false;
    return true;
  });
  const summary = {
    campaignCount: rows.length,
    liveCampaigns: rows.filter((row) => row.status === "live").length,
    draftCampaigns: rows.filter((row) => row.status === "draft").length,
    completedCampaigns: rows.filter((row) => row.status === "completed").length,
    deactivatedCampaigns: rows.filter((row) => row.status === "deactivated").length,
    totalCodes: rows.reduce((sum, row) => sum + row.totalCodes, 0),
    reservedCodes: rows.reduce((sum, row) => sum + row.reservedCodes, 0),
    platformJoined: rows.reduce((sum, row) => sum + row.platformJoined, 0),
    submitted: rows.reduce((sum, row) => sum + row.submitted, 0),
  };
  const campaignOverviewRows = rows
    .slice()
    .sort((a, b) => {
      const demandDiff = campaignDemandMeta(b).reserveRate - campaignDemandMeta(a).reserveRate;
      if (demandDiff) return demandDiff;
      return (campaignClosingMeta(a).diffDays ?? 9999) - (campaignClosingMeta(b).diffDays ?? 9999);
    });
  return {
    copy: l("Campaign reporting focused on campaign health, demand, and proof output.", "تقارير الحملات تركز على صحة الحملة والطلب ومخرجات الإثبات."),
    heroStats: [
      { label: l("Campaign total", "إجمالي الحملات"), value: String(summary.campaignCount), note: l("Number of campaigns included in this campaign report after filters.", "عدد الحملات المشمولة في تقرير الحملات بعد تطبيق الفلاتر.") },
      { label: l("Code interest", "اهتمام الأكواد"), value: `${safePercent(summary.reservedCodes, summary.totalCodes)}%`, note: l("Share of uploaded campaign codes that are already reserved.", "نسبة أكواد الحملة المرفوعة التي تم حجزها بالفعل.") },
      { label: l("Proof rate", "معدل الإثبات"), value: `${safePercent(summary.submitted, summary.platformJoined)}%`, note: l("Share of platform joins that already submitted a social link.", "نسبة المشاركين عبر المنصة الذين أرسلوا رابطاً اجتماعياً بالفعل.") },
    ],
    body: `
      ${renderCampaignFilters(filters)}
      <section class="panel">
        <h3>${l("Campaign report", "تقرير الحملات")}</h3>
        <p class="panel-subtitle">${l("One combined view of campaign demand, code availability, and closing urgency across all filtered campaigns.", "عرض موحد لطلب الحملات وتوفر الأكواد ومدى قرب الإغلاق عبر جميع الحملات المفلترة.")}</p>
        ${renderDataTable(
          [
            { label: l("Campaign", "الحملة"), render: (row) => renderCampaignTitleLink(row.campaign, { label: row.title, campaignId: row.campaignId }), html: true },
            { label: l("Status", "الحالة"), render: (row) => `<span class="badge ${campaignStatusTone(row.status)}">${escapeHtml(campaignStatusLabel(row.status))}</span>`, html: true },
            {
              label: l("Demand", "الطلب"),
              render: (row) => {
                const meta = campaignDemandMeta(row);
                return `<span class="badge ${meta.tone}">${escapeHtml(meta.label)}</span>`;
              },
              html: true,
            },
            {
              label: l("Close watch", "مراقبة الإغلاق"),
              render: (row) => {
                const meta = campaignClosingMeta(row);
                return `<span class="badge ${meta.tone}">${escapeHtml(meta.label)}</span>`;
              },
              html: true,
            },
            {
              label: l("Reserve rate", "معدل الحجز"),
              render: (row) => `
                <div class="table-metric-stack">
                  <strong>${campaignDemandMeta(row).reserveRate}%</strong>
                  <span class="table-metric-note">${l("Available", "متاح")} ${row.availableCodes} · ${l("Reserved", "محجوز")} ${row.reservedCodes} · ${l("Blocked", "محظور")} ${row.blockedCodes}</span>
                </div>
              `,
              html: true,
            },
            { label: l("Posting rate", "معدل النشر"), render: (row) => `${row.postingRate}%` },
            { label: l("Submission deadline", "آخر موعد للتسليم"), render: (row) => formatDate(row.submissionDeadline) },
          ],
          campaignOverviewRows,
          l("No campaigns match the current campaign filters.", "لا توجد حملات مطابقة لفلاتر الحملات الحالية.")
        )}
      </section>
    `,
  };
}

function renderInfluencerReports(dashboard) {
  const filters = state.reportFilters.influencers;
  const filteredRows = dashboard.influencerRows.filter((row) => {
    if (filters.query) {
      const query = filters.query.toLowerCase();
      const haystack = `${row.fullName} ${(row.tags || []).join(" ")}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    if (filters.cityId && Number(filters.cityId) !== row.cityId) return false;
    if (filters.categoryId && Number(filters.categoryId) !== row.categoryId) return false;
    if (filters.status && filters.status !== row.status) return false;
    if (filters.tag) {
      const wanted = String(filters.tag).toLowerCase().trim();
      if (!(row.tags || []).some((tag) => String(tag).toLowerCase().includes(wanted))) return false;
    }
    if (filters.platform && filters.platform !== row.preferredPlatform) return false;
    if (!withinDateRange(row.signupDate, filters.dateFrom, filters.dateTo)) return false;
    return true;
  });
  const sort = state.reportSorts.influencers || defaultReportSorts().influencers;
  const sortValueFor = (row, key) => {
    if (key === "fullName") return row.fullName;
    if (key === "status") return row.status;
    if (key === "city") return cityName(row.cityId);
    if (key === "category") return categoryName(row.categoryId);
    if (key === "platform") return row.preferredPlatform || "";
    if (key === "signupDate") return dateValue(row.signupDate) || 0;
    if (key === "joined") return row.joined;
    if (key === "submitted") return row.submitted;
    if (key === "pending") return row.pending;
    if (key === "proofRate") return row.completionRate;
    if (key === "lastActivity") return dateValue(row.lastActivityDate) || 0;
    return row[key];
  };
  const rows = filteredRows.slice().sort((left, right) => {
    const result = compareValues(sortValueFor(left, sort.key), sortValueFor(right, sort.key));
    return sort.direction === "asc" ? result : -result;
  });
  const totalJoins = rows.reduce((sum, row) => sum + row.joined, 0);
  const totalSubmitted = rows.reduce((sum, row) => sum + row.submitted, 0);
  const proofRate = safePercent(totalSubmitted, totalJoins);
  return {
    copy: l("Influencer reporting focused on participation quality, completion, and follow-up needs.", "تقارير المؤثرين تركز على جودة المشاركة والاكتمال واحتياجات المتابعة."),
    heroStats: [
      { label: l("Influencer total", "إجمالي المؤثرين"), value: String(rows.length), note: l("Number of influencers included in this influencer report after filters.", "عدد المؤثرين المشمولين في تقرير المؤثرين بعد تطبيق الفلاتر.") },
      { label: l("Campaign joins", "انضمام الحملات"), value: String(totalJoins), note: l("How many times the filtered influencers clicked interested and joined campaigns.", "عدد المرات التي ضغط فيها المؤثرون المفلترون على الاهتمام وانضموا إلى الحملات.") },
      { label: l("Proof rate", "معدل الإثبات"), value: `${proofRate}%`, note: l("Share of influencer joins that turned into submitted proof links.", "نسبة انضمامات المؤثرين التي تحولت إلى روابط إثبات مُرسلة.") },
    ],
    body: `
      ${renderInfluencerFilters(filters)}
      <section class="panel">
        <h3>${l("Influencer report", "تقرير المؤثرين")}</h3>
        <p class="panel-subtitle">${l("A table-first report showing influencer profile filters, campaign joins, proof submissions, pending proof, and a direct link back to the influencer management page.", "تقرير يعتمد على الجدول أولاً ويعرض فلاتر ملف المؤثر وانضمام الحملات وإثباتات النشر والإثباتات المعلقة ورابطاً مباشراً للعودة إلى صفحة إدارة المؤثرين.")}</p>
        <p class="compact"><strong>${rows.length}</strong> ${l("influencers in this filtered report.", "مؤثراً ضمن هذا التقرير بعد الفلترة.")}</p>
        ${renderDataTable(
          [
            {
              label: l("Influencer", "المؤثر"),
              render: (row) => `<button type="button" class="table-link-button" data-action="view-influencer" data-user-id="${row.influencerId}">${escapeHtml(row.fullName)}</button>`,
              html: true,
              sortKey: "fullName",
            },
            {
              label: l("Status", "الحالة"),
              render: (row) => `<span class="badge ${statusTone(row.status)}">${escapeHtml(row.status)}</span>`,
              html: true,
              sortKey: "status",
            },
            { label: l("City", "المدينة"), render: (row) => cityName(row.cityId), sortKey: "city" },
            { label: l("Category", "الفئة"), render: (row) => categoryName(row.categoryId), sortKey: "category" },
            { label: l("Tags", "العلامات"), render: (row) => (row.tags || []).join(", ") || "-" },
            { label: l("Platform", "المنصة"), render: (row) => row.preferredPlatform || "-", sortKey: "platform" },
            { label: l("Signup", "التسجيل"), render: (row) => formatDate(row.signupDate), sortKey: "signupDate" },
            { label: l("Joins", "الانضمام"), render: (row) => String(row.joined), sortKey: "joined" },
            {
              label: l("Proofs", "الإثباتات"),
              render: (row) => `<span class="badge success">${row.submitted}</span>`,
              html: true,
              sortKey: "submitted",
            },
            {
              label: l("Pending", "معلق"),
              render: (row) => `<span class="badge ${row.pending > 0 ? "warning" : "success"}">${row.pending}</span>`,
              html: true,
              sortKey: "pending",
            },
            {
              label: l("Proof rate", "معدل الإثبات"),
              render: (row) => {
                const tone = row.completionRate >= 70 ? "success" : row.completionRate >= 40 ? "warning" : "danger";
                return `<span class="badge ${tone}">${row.completionRate}%</span>`;
              },
              html: true,
              sortKey: "proofRate",
            },
            { label: l("Last activity", "آخر نشاط"), render: (row) => formatDate(row.lastActivityDate), sortKey: "lastActivity" },
          ],
          rows,
          l("No influencer rows match the current influencer filters.", "لا توجد بيانات مؤثرين مطابقة لفلاتر المؤثرين الحالية."),
          { tableId: "influencers", sort }
        )}
      </section>
    `,
  };
}

function renderSubmissionReports(dashboard) {
  const filters = state.reportFilters.submissions;
  const filteredRows = dashboard.submissions.filter((row) => {
    if (filters.campaignId && Number(filters.campaignId) !== row.campaignId) return false;
    if (filters.influencerId && Number(filters.influencerId) !== row.influencerId) return false;
    if (filters.platform && filters.platform !== (row.platform || "")) return false;
    if (!withinDateRange(row.submittedAt || row.joinedAt, filters.dateFrom, filters.dateTo)) return false;
    return true;
  });
  const sort = state.reportSorts.submissions || defaultReportSorts().submissions;
  const sortValueFor = (row, key) => {
    if (key === "campaign") return row.campaign ? campaignTitle(row.campaign) : "";
    if (key === "influencer") return row.influencerName || "";
    if (key === "platform") return row.platform || "";
    if (key === "submittedAt") return dateValue(row.submittedAt) || 0;
    return row[key];
  };
  const rows = filteredRows.slice().sort((left, right) => {
    const result = compareValues(sortValueFor(left, sort.key), sortValueFor(right, sort.key));
    return sort.direction === "asc" ? result : -result;
  });
  const pendingRows = dashboard.participantRows.filter((row) => {
    if (row.source === "offline" || !participantNeedsProof(row.status)) return false;
    if (filters.campaignId && Number(filters.campaignId) !== row.campaignId) return false;
    if (filters.influencerId && Number(filters.influencerId) !== row.influencerId) return false;
    if (filters.platform && filters.platform !== (row.platform || "")) return false;
    if (!withinDateRange(row.joinedAt, filters.dateFrom, filters.dateTo)) return false;
    return true;
  });
  const pendingQueueRows = pendingRows
    .slice()
    .sort((left, right) => {
      const leftDate = dateValue(left.joinedAt) || 0;
      const rightDate = dateValue(right.joinedAt) || 0;
      return rightDate - leftDate;
    });
  const platformBars = Array.from(
    rows.reduce((map, row) => {
      const key = row.platform || l("Not set", "غير محدد");
      map.set(key, (map.get(key) || 0) + 1);
      return map;
    }, new Map())
  )
    .map(([label, count]) => ({
      label,
      count,
      share: safePercent(count, rows.length),
      badge: String(count),
      note: l("Filtered submissions", "تسليمات مفلترة"),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
  const proofRate = safePercent(rows.length, rows.length + pendingRows.length);
  return {
    copy: l("Submission reporting focused on posted proof links and proof backlog.", "تقارير التسليمات تركز على روابط الإثبات المنشورة وقائمة الإثباتات المتأخرة."),
    heroStats: [
      { label: l("Submission total", "إجمالي التسليم"), value: String(rows.length), note: l("Number of proof submissions included in this submissions report after filters.", "عدد إثباتات التسليم المشمولة في تقرير التسليمات بعد تطبيق الفلاتر.") },
      { label: l("Pending proof", "إثباتات معلقة"), value: String(pendingRows.length), note: l("Platform participants who still owe a proof link in the current filter.", "مشاركو المنصة الذين ما زالوا مدينين برابط إثبات ضمن الفلاتر الحالية.") },
      { label: l("Proof rate", "معدل الإثبات"), value: `${proofRate}%`, note: l("Share of proof-ready rows that already became submissions.", "نسبة الصفوف الجاهزة للإثبات التي تحولت بالفعل إلى تسليمات.") },
    ],
    body: `
      ${renderSubmissionFilters(filters)}
      <section class="panel">
        <h3>${l("Platform mix", "مزيج المنصات")}</h3>
        <p class="panel-subtitle">${l("A ranked view of where the filtered proof submissions were posted, with both count and share.", "عرض مرتب يوضح أين تم نشر إثباتات التسليم المفلترة مع العدد والنسبة معاً.")}</p>
        ${renderDataTable(
          [
            { label: l("Rank", "الترتيب"), render: (row) => String(row.rank) },
            { label: l("Platform", "المنصة"), render: (row) => row.label },
            { label: l("Submissions", "التسليمات"), render: (row) => String(row.count) },
            { label: l("Share", "النسبة"), render: (row) => `${row.share}%` },
            {
              label: l("Mix", "المزيج"),
              render: (row) => `
                <div class="table-metric-stack">
                  <strong>${row.share}%</strong>
                  <span class="table-metric-note">${l("Platform rank", "ترتيب المنصة")} #${row.rank} · ${l("Filtered submissions", "تسليمات مفلترة")} ${row.count}</span>
                </div>
              `,
              html: true,
            },
          ],
          platformBars.map((row, index) => ({ ...row, rank: index + 1 })),
          l("No platform mix rows match the current submission filters.", "لا توجد صفوف لمزيج المنصات مطابقة لفلاتر التسليم الحالية.")
        )}
      </section>
      <section class="panel">
        <h3>${l("Pending proof queue", "قائمة الإثباتات المعلقة")}</h3>
        <p class="panel-subtitle">${l("This is the clean operational queue of platform influencers who joined a campaign but still have not submitted their proof link. Use the campaign filter above to narrow this queue to one campaign only.", "هذه هي القائمة التشغيلية الواضحة لمؤثري المنصة الذين انضموا إلى حملة لكنهم لم يرسلوا رابط الإثبات بعد. استخدم فلتر الحملة أعلاه لحصر هذه القائمة في حملة واحدة فقط.")}</p>
        ${renderDataTable(
          [
            { label: l("Campaign", "الحملة"), render: (row) => renderCampaignTitleLink(row.campaign || row), html: true },
            {
              label: l("Influencer", "المؤثر"),
              render: (row) =>
                row.influencerId
                  ? `<button type="button" class="table-link-button" data-action="view-influencer" data-user-id="${row.influencerId}">${escapeHtml(row.influencerName || "-")}</button>`
                  : escapeHtml(row.influencerName || "-"),
              html: true,
            },
            { label: l("Platform", "المنصة"), render: (row) => row.platform || l("Not set", "غير محدد") },
            { label: l("Joined", "انضم"), render: (row) => formatDate(row.joinedAt) },
            {
              label: l("Status", "الحالة"),
              render: () => `<span class="badge warning">${escapeHtml(l("Pending proof", "إثبات معلق"))}</span>`,
              html: true,
            },
          ],
          pendingQueueRows,
          l("No pending proof rows match the current submission filters.", "لا توجد صفوف إثبات معلقة مطابقة لفلاتر التسليم الحالية.")
        )}
      </section>
      <section class="panel">
        <h3>${l("Submission log", "سجل التسليمات")}</h3>
        <p class="panel-subtitle">${l("Review each submitted link with its campaign, influencer, platform, and submission date.", "راجع كل رابط تم تسليمه مع الحملة والمؤثر والمنصة وتاريخ التسليم.")}</p>
        ${renderDataTable(
          [
            { label: l("Campaign", "الحملة"), render: (row) => renderCampaignTitleLink(row.campaign || row), html: true, sortKey: "campaign" },
            {
              label: l("Influencer", "المؤثر"),
              render: (row) => (row.influencerId ? renderInfluencerProfileTrigger(row.influencerId, row.influencerName) : escapeHtml(row.influencerName)),
              html: true,
              sortKey: "influencer",
            },
            { label: l("Platform", "المنصة"), render: (row) => row.platform || l("Not set", "غير محدد"), sortKey: "platform" },
            { label: l("Submitted", "سلّم"), render: (row) => formatDate(row.submittedAt), sortKey: "submittedAt" },
            {
              label: l("Link", "الرابط"),
              render: (row) =>
                row.socialLink
                  ? `<a class="table-link-button" href="${escapeHtml(row.socialLink)}" target="_blank" rel="noreferrer">${escapeHtml(l("Open post", "فتح المنشور"))}</a>`
                  : "-",
              html: true,
            },
          ],
          rows,
          l("No submissions match the current submission filters.", "لا توجد تسليمات مطابقة لفلاتر التسليم الحالية."),
          { tableId: "submissions", sort }
        )}
      </section>
    `,
  };
}

function renderCodeReports(dashboard) {
  const filters = state.reportFilters.codes;
  const rows = dashboard.codeRows.filter((row) => {
    if (filters.query && !String(row.codeValue || "").toLowerCase().includes(filters.query.toLowerCase().trim())) return false;
    if (filters.campaignId && Number(filters.campaignId) !== row.campaignId) return false;
    if (filters.status && filters.status !== row.status) return false;
    if (filters.assignment === "assigned" && !row.assignedInfluencer) return false;
    if (filters.assignment === "unassigned" && row.assignedInfluencer) return false;
    if (!withinDateRange(row.reservedAt || row.createdAt, filters.dateFrom, filters.dateTo)) return false;
    return true;
  });
  const summary = {
    total: rows.length,
    available: rows.filter((row) => row.status === "available").length,
    reserved: rows.filter((row) => row.status === "reserved").length,
    onlineReserved: rows.filter((row) => row.status === "reserved" && row.reservationSource === "platform").length,
    offlineReserved: rows.filter((row) => row.status === "reserved" && row.reservationSource === "offline").length,
    blocked: rows.filter((row) => row.status === "blocked").length,
  };
  return {
    copy: l("Code reporting focused on inventory availability, reservation pressure, and assignment state.", "تقارير الأكواد تركز على توفر المخزون وضغط الحجز وحالة التخصيص."),
    heroStats: [
      { label: l("Code total", "إجمالي الأكواد"), value: String(summary.total), note: l("Number of uploaded codes included in this code report after filters.", "عدد الأكواد المرفوعة المشمولة في تقرير الأكواد بعد تطبيق الفلاتر.") },
      { label: l("Reserve rate", "معدل الحجز"), value: `${safePercent(summary.reserved, summary.total)}%`, note: l("Share of filtered codes that are currently reserved.", "نسبة الأكواد المفلترة المحجوزة حالياً.") },
      { label: l("Available codes", "الأكواد المتاحة"), value: String(summary.available), note: l("Codes still free for the next reservation or join.", "أكواد ما زالت حرة للحجز أو الانضمام التالي.") },
    ],
    body: `
      ${renderCodeFilters(filters)}
      <section class="panel">
        <h3>${l("Code status", "حالة الأكواد")}</h3>
        <p class="panel-subtitle">${l("A simple split of the current filtered code inventory by state.", "تقسيم بسيط لمخزون الأكواد المفلتر الحالي حسب الحالة.")}</p>
        ${metricGrid([
          {
            label: l("Available", "متاح"),
            value: String(summary.available),
            note: l("Codes still open for the next reservation or influencer join.", "أكواد ما زالت مفتوحة للحجز أو لانضمام مؤثر جديد."),
          },
          {
            label: l("Online reserved", "محجوز أونلاين"),
            value: String(summary.onlineReserved),
            note: l("Codes reserved by influencers who joined inside the platform.", "أكواد حجزها مؤثرون انضموا من داخل المنصة."),
          },
          {
            label: l("Offline reserved", "محجوز أوفلاين"),
            value: String(summary.offlineReserved),
            note: l("Codes manually reserved by campaign managers for offline influencers.", "أكواد حُجزت يدوياً من مدير الحملة لمؤثرين خارج المنصة."),
          },
          {
            label: l("Blocked", "محظور"),
            value: String(summary.blocked),
            note: l("Codes canceled or intentionally removed from reuse.", "أكواد أُلغيت أو تم استبعادها عمداً من إعادة الاستخدام."),
          },
        ])}
      </section>
      <section class="panel">
        <h3>${l("Code table", "جدول الأكواد")}</h3>
        <p class="panel-subtitle">${l("Review code value, campaign, current state, assignment, and reservation date.", "راجع قيمة الكود والحملة والحالة الحالية والتخصيص وتاريخ الحجز.")}</p>
        ${renderDataTable(
          [
            { label: l("Code", "الكود"), render: (row) => row.codeValue },
            {
              label: l("Campaign", "الحملة"),
              render: (row) => {
                const campaign = currentCampaigns().find((item) => item.id === row.campaignId);
                return renderCampaignTitleLink(campaign || row, { fallback: row.campaignTitleEn || row.campaignTitleAr || "-" });
              },
              html: true,
            },
            { label: l("Status", "الحالة"), render: (row) => `<span class="badge ${statusTone(row.status)}">${escapeHtml(codeStatusLabel(row.status))}</span>`, html: true },
            { label: l("Reservation source", "مصدر الحجز"), render: (row) => row.reservationSource === "offline" ? l("Offline", "أوفلاين") : row.reservationSource === "platform" ? l("Online", "أونلاين") : l("Not reserved", "غير محجوز") },
            { label: l("Assigned to", "مخصص إلى"), render: (row) => row.assignedInfluencer || l("Unassigned", "غير مخصص") },
            { label: l("Reserved at", "تاريخ الحجز"), render: (row) => formatDate(row.reservedAt) },
          ],
          rows,
          l("No code rows match the current code filters.", "لا توجد أكواد مطابقة لفلاتر الأكواد الحالية.")
        )}
      </section>
    `,
  };
}

function renderReportsPage() {
  const dashboard = buildReportsDashboardData();
  const sections = {
    campaigns: renderCampaignReports(dashboard),
    influencers: renderInfluencerReports(dashboard),
    submissions: renderSubmissionReports(dashboard),
    codes: renderCodeReports(dashboard),
  };
  const active = sections[state.reportTab] || sections.campaigns;
  return `
    ${pageHeader(l("Reports", "التقارير"), active.copy, { heroStats: active.heroStats, compactHeroStats: true })}
    ${renderReportTabs()}
    <section class="panel">
      <div class="row report-toolbar-head">
        <div>
          <h3>${l("Report actions", "إجراءات التقرير")}</h3>
          <p class="panel-subtitle">${l("Export the currently selected report tab as CSV.", "صدّر تبويب التقرير المحدد حالياً كملف CSV.")}</p>
        </div>
        <button type="button" data-action="export-report-csv">${l("Export CSV", "تصدير CSV")}</button>
      </div>
    </section>
    ${active.body}
  `;
}

function renderReportCards(rows) {
  return rows.length
    ? `<div class="stack">${rows
        .map(
          (row) => `
            <article class="list-card">
              <div class="row"><strong>${escapeHtml(row.title)}</strong></div>
              <div class="row-wrap" style="margin-top: 10px;">${row.badges.map((badge) => `<span class="badge">${escapeHtml(badge)}</span>`).join("")}</div>
              <p class="compact">${escapeHtml(row.note)}</p>
            </article>
          `
        )
        .join("")}</div>`
    : `<div class="empty-state">${l("No report rows yet.", "لا توجد بيانات تقرير بعد.")}</div>`;
}

function renderInfluencerDashboard() {
  const participants = state.data.participants || [];
  return `
    ${pageHeader(
      l("Influencer Dashboard", "لوحة المؤثر"),
      l("See eligible campaigns, your assigned codes, and proof tasks that still need action.", "شاهد الحملات المؤهلة لك وأكوادك المخصصة والمهام التي ما زالت تحتاج إجراء."),
      { showNotifications: true }
    )}
    ${metricGrid([
      { label: l("Eligible campaigns", "الحملات المؤهلة"), value: eligibleCampaigns().length, note: l("Available to join", "متاحة للانضمام") },
      { label: l("Joined campaigns", "الحملات المنضم لها"), value: participants.length, note: l("Your history", "سجلك") },
      { label: l("Pending proof", "إثباتات معلقة"), value: participants.filter((item) => participantNeedsProof(item.status)).length, note: l("Need social link", "تحتاج رابطاً") },
      { label: l("Submitted links", "روابط مرسلة"), value: participants.filter((item) => ["submitted", "completed"].includes(item.status)).length, note: l("Already delivered", "تم تسليمها") },
    ])}
    <section class="content-grid">
      <section class="panel panel-wide">
        <h3>${l("Pending Proof Submission", "إثباتات الزيارة المطلوب تسليمها")}</h3>
        ${renderMyCampaignCards(participants.filter((item) => participantNeedsProof(item.status)), false, true)}
      </section>
      <section class="panel">
        <h3>${l("Available Campaigns", "الحملات المتاحة")}</h3>
        ${renderAvailableCampaignCards(eligibleCampaigns().slice(0, 4))}
      </section>
    </section>
  `;
}

function renderAvailableCampaignsPage() {
  return `
    ${pageHeader(l("Available Campaigns", "الحملات المتاحة"), l("Every time you confirm interest, one private code is reserved for you immediately.", "كل مرة تؤكد اهتمامك، يتم حجز كود خاص لك فوراً."))}
    <section class="panel">
      <h3>${l("Eligible Campaigns", "الحملات المؤهلة")}</h3>
      ${renderAvailableCampaignCards(eligibleCampaigns())}
    </section>
  `;
}

function renderAvailableCampaignCards(campaigns) {
  return campaigns.length
    ? `<div class="stack">${campaigns
        .map(
          (campaign) => `
            <article class="campaign-card">
              ${renderCampaignBanner(campaign, "card")}
              <div class="offer-headline">
                <span class="offer-eyebrow">${escapeHtml(l("What you get", "ما الذي ستحصل عليه"))}</span>
                <strong class="offer-title">${escapeHtml(campaign.offerDescription || l("Campaign offer attached to this code.", "عرض الحملة مرتبط بهذا الكود."))}</strong>
                ${(campaign.offerUsageCount || 1) > 1 ? `<span class="offer-uses">${l("Uses", "عدد الاستخدام")}: ${escapeHtml(campaign.offerUsageCount)}</span>` : ""}
              </div>
              <div class="row">
                <strong>${renderCampaignTitleLink(campaign)}</strong>
                <span class="badge ${statusTone(campaign.status)}">${escapeHtml(campaign.status)}</span>
              </div>
              <p>${escapeHtml(campaignDescription(campaign))}</p>
              <div class="row-wrap" style="margin-top: 10px;">
                <span class="badge">${escapeHtml(campaignAudience(campaign))}</span>
                <span class="badge">${campaign.codeStats.available} ${l("codes available", "كود متاح")}</span>
                <span class="badge">${l("Visit deadline", "آخر موعد للزيارة")}: ${formatDate(campaign.visitDeadline)}</span>
              </div>
              <div class="row-wrap" style="margin-top: 12px;">
                <button class="secondary" data-action="preview-campaign" data-campaign-id="${campaign.id}">${l("View", "عرض")}</button>
                <button data-action="join-campaign" data-campaign-id="${campaign.id}">${l("Confirm interest", "تأكيد الاهتمام")}</button>
              </div>
            </article>
          `
        )
        .join("")}</div>`
    : `<div class="empty-state">${l("No eligible campaigns right now.", "لا توجد حملات مؤهلة الآن.")}</div>`;
}

function renderMyCampaignsPage() {
  return `
    ${pageHeader(l("My Campaigns", "حملاتي"), l("Track reserved codes and submit social links from one page.", "تابع الأكواد المحجوزة وأرسل روابط السوشيال من صفحة واحدة."))}
    <section class="panel">
      <h3>${l("Joined Campaigns", "الحملات المنضم لها")}</h3>
      ${renderMyCampaignCards(state.data.participants || [], false, false)}
    </section>
  `;
}

function renderMyCampaignCards(participants, compactOnly, proofOnly = false) {
  const sortedParticipants = [...participants].sort((left, right) => {
    const priorityDiff = participantPriority(left) - participantPriority(right);
    if (priorityDiff !== 0) return priorityDiff;
    const leftDate = new Date(left.submittedAt || left.joinedAt || 0).getTime();
    const rightDate = new Date(right.submittedAt || right.joinedAt || 0).getTime();
    return rightDate - leftDate;
  });

  return participants.length
    ? `<div class="stack">${sortedParticipants
        .map((participant) => {
          const campaign = currentCampaigns().find((item) => item.id === participant.campaignId);
          if (!campaign) return "";
          const headerBlock = `
            ${renderStatusStrip(participant.status)}
            ${renderCampaignBanner(campaign, "wide")}
            <div class="row">
              <strong>${renderCampaignTitleLink(campaign)}</strong>
              <span class="badge ${statusTone(participant.status)}">${escapeHtml(participantStatusLabel(participant.status))}</span>
            </div>
            <p>${escapeHtml(campaignDescription(campaign))}</p>
            ${renderCodeDetails(participant.assignedCodeValue, participant.assignedCodeUsageCount, participant.assignedCodeOfferText)}
            ${participant.canceledReason ? `<p class="compact">${l("Canceled reason", "سبب الإلغاء")}: ${escapeHtml(participant.canceledReason)}</p>` : ""}
            <div class="row-wrap" style="margin-top: 12px;">
              <span class="badge">${l("Visit deadline", "آخر موعد للزيارة")}: ${formatDate(campaign.visitDeadline)}</span>
              <span class="badge">${l("Submission deadline", "آخر موعد للتسليم")}: ${formatDate(campaign.submissionDeadline)}</span>
            </div>
          `;
          const accordionBodyBlock = `
            ${renderCampaignBanner(campaign, "wide")}
            <p>${escapeHtml(campaignDescription(campaign))}</p>
            ${renderCodeDetails(participant.assignedCodeValue, participant.assignedCodeUsageCount, participant.assignedCodeOfferText)}
            ${participant.canceledReason ? `<p class="compact">${l("Canceled reason", "سبب الإلغاء")}: ${escapeHtml(participant.canceledReason)}</p>` : ""}
            <div class="row-wrap" style="margin-top: 12px;">
              <span class="badge">${l("Visit deadline", "آخر موعد للزيارة")}: ${formatDate(campaign.visitDeadline)}</span>
              <span class="badge">${l("Submission deadline", "آخر موعد للتسليم")}: ${formatDate(campaign.submissionDeadline)}</span>
            </div>
          `;
          const actionBlock = `
            <div class="row-wrap" style="margin-top: 12px;">
              <button class="secondary" data-action="preview-campaign" data-campaign-id="${campaign.id}">${l("View campaign", "عرض الحملة")}</button>
            </div>
          `;
          const visitNote = participantNeedsVisit(participant.status) && !compactOnly ? `
            <article class="note-card" style="margin-top: 14px;">
              <strong>${l("Show your code at the branch", "اعرض الكود عند الفرع")}</strong>
              <p>${l("Your code is reserved. Visit an eligible branch and ask the cashier to confirm the visit using the branch PIN.", "تم حجز كودك. زر أحد الأفرع المؤهلة واطلب من الكاشير تأكيد الزيارة باستخدام رمز الفرع.")}</p>
              ${participant.source !== "offline" ? `<div class="row-wrap" style="margin-top: 12px;"><button class="secondary" data-action="cancel-participation" data-participant-id="${participant.id}">${l("Cancel participation", "إلغاء المشاركة")}</button></div>` : ""}
            </article>
          ` : "";
          const pendingForm = participantCanSubmit(participant) && !compactOnly ? `
            <form class="form-grid submission-form" data-participant-id="${participant.id}" style="margin-top: 14px;">
              ${campaign.captionGuide ? `
                <article class="note-card" style="margin: 12px 0; background: rgba(112, 47, 138, 0.04);">
                  <strong>${l("Posting guide from PICK", "دليل النشر من PICK")}</strong>
                  <p style="white-space: pre-wrap; margin-top: 8px;">${escapeHtml(campaign.captionGuide)}</p>
                </article>
              ` : ""}
              <label class="field"><span>${l("Social media link", "رابط السوشيال")}</span><input name="socialLink" type="url" required value="${escapeHtml(participant.socialLink || "")}" /></label>
              <label class="field"><span>${l("Feedback", "الملاحظات")}</span><textarea name="feedback">${escapeHtml(participant.feedback || "")}</textarea></label>
              <label class="field"><span>${l("Platform", "المنصة")}</span>${renderPlatformSelect("platform", participant.platform || "")}</label>
              <label class="field"><span>${l("Image 1", "الصورة 1")}</span><input name="image1" type="file" accept="image/*" /></label>
              <label class="field"><span>${l("Image 2", "الصورة 2")}</span><input name="image2" type="file" accept="image/*" /></label>
              <label class="field"><span>${l("Image 3", "الصورة 3")}</span><input name="image3" type="file" accept="image/*" /></label>
              <p class="compact field-span-full">${l("Up to 3 images total.", "حتى 3 صور كحد أقصى.")}</p>
              <div class="row-wrap field-span-full">${renderParticipantImages(participant.images || [])}</div>
              <button type="submit">${l("Submit proof", "إرسال الإثبات")}</button>
            </form>
          ` : "";
          const submittedBlock = ["submitted", "completed"].includes(participant.status) && !participantCanSubmit(participant) && !proofOnly ? `
            <article class="note-card" style="margin-top: 14px;">
              <strong>${l("Submitted Proof", "الإثبات المرسل")}</strong>
              <p>${participant.socialLink ? `<a href="${participant.socialLink}" target="_blank" rel="noreferrer">${escapeHtml(participant.socialLink)}</a>` : "-"}</p>
              <p>${escapeHtml(participant.feedback || l("No feedback added.", "لا توجد ملاحظات."))}</p>
              <p class="compact">${l("This submission is now view-only.", "هذا التسليم أصبح للعرض فقط.")}</p>
              <div class="row-wrap">${renderParticipantImages(participant.images || [])}</div>
            </article>
          ` : "";
          const contentBlock = `${actionBlock}${visitNote}${pendingForm}${submittedBlock}`;

          if (["submitted", "completed"].includes(participant.status) && !proofOnly) {
            return `
              <details class="timeline-card campaign-accordion">
                <summary class="campaign-accordion-summary">
                  <div class="campaign-accordion-summary__content">
                    ${renderStatusStrip(participant.status)}
                    <strong>${renderCampaignTitleLink(campaign)}</strong>
                  </div>
                  <span class="campaign-accordion-summary__hint">${l("Show details", "عرض التفاصيل")}</span>
                </summary>
                <div class="campaign-accordion-body">
                  ${accordionBodyBlock}
                  ${contentBlock}
                </div>
              </details>
            `;
          }

          return `
            <article class="timeline-card">
              ${headerBlock}
              ${contentBlock}
            </article>
          `;
        })
        .join("")}</div>`
    : `<div class="empty-state">${l("You have not joined any campaign yet.", "لم تنضم إلى أي حملة بعد.")}</div>`;
}

function renderInfluencerCampaignPreviewPage() {
  const campaign = selectedCampaign();
  if (!campaign) return renderEmptyCampaignPage(l("No campaign selected.", "لا توجد حملة محددة."));
  const participant = myParticipantForCampaign(campaign.id);
  const isEligible = new Set(state.data?.eligibleCampaignIds || []).has(campaign.id);
  return `
    ${pageHeader(l("Campaign Preview", "معاينة الحملة"), l("Review the campaign details before you confirm your interest.", "راجع تفاصيل الحملة قبل تأكيد اهتمامك."))}
    <section class="panel">
      ${renderCampaignBanner(campaign, "hero")}
      <h3>${escapeHtml(campaignTitle(campaign))}</h3>
      <p class="panel-subtitle">${escapeHtml(campaignDescription(campaign))}</p>
      <div class="row-wrap" style="margin-bottom: 16px;">
        <span class="badge ${statusTone(campaign.status)}">${escapeHtml(campaign.status)}</span>
        <span class="badge">${escapeHtml(campaignAudience(campaign))}</span>
        <span class="badge">${l("Visit deadline", "آخر موعد للزيارة")}: ${formatDate(campaign.visitDeadline)}</span>
        <span class="badge">${l("Submission deadline", "آخر موعد للتسليم")}: ${formatDate(campaign.submissionDeadline)}</span>
      </div>
      ${renderCampaignOffer(campaign)}
      ${campaign.captionGuide ? `
        <article class="note-card" style="margin: 14px 0;">
          <strong>${l("Caption guide", "دليل التعليق")}</strong>
          <p style="white-space: pre-wrap; margin-top: 8px;">${escapeHtml(campaign.captionGuide)}</p>
        </article>
      ` : ""}
      ${
        participant
          ? `
            <article class="note-card" style="margin-bottom: 16px;">
              <strong>${l("Your campaign status", "حالة حملتك")}</strong>
              <p>${l("You have already joined this campaign.", "لقد انضممت بالفعل إلى هذه الحملة.")}</p>
              <div class="row-wrap" style="margin-top: 10px;">
                <span class="badge ${statusTone(participant.status)}">${escapeHtml(participantStatusLabel(participant.status))}</span>
              </div>
              ${renderCodeDetails(participant.assignedCodeValue, participant.assignedCodeUsageCount, participant.assignedCodeOfferText)}
              ${["submitted", "completed"].includes(participant.status) ? `<p class="compact">${l("Your proof has already been submitted and is now view-only.", "تم إرسال الإثبات الخاص بك وهو الآن للعرض فقط.")}</p>` : ""}
              ${participantNeedsVisit(participant.status) ? `<p class="compact">${l("Visit an eligible branch and show your code to the cashier first.", "قم بزيارة فرع مؤهل واعرض كودك على الكاشير أولاً.")}</p>` : ""}
              ${participantNeedsProof(participant.status) ? `<p class="compact">${l("Your branch visit is confirmed. You can now submit your proof link.", "تم تأكيد زيارتك للفرع. يمكنك الآن إرسال رابط الإثبات.")}</p>` : ""}
              ${participant.status === "canceled" ? `<p class="compact">${l("This participation was canceled.", "تم إلغاء هذه المشاركة.")}</p>` : ""}
            </article>
          `
          : ""
      }
      ${
        participant && participantCanSubmit(participant)
          ? `
            <form class="form-grid submission-form" data-participant-id="${participant.id}" style="margin-bottom: 16px;">
              ${campaign.captionGuide ? `
                <article class="note-card" style="margin: 12px 0; background: rgba(112, 47, 138, 0.04);">
                  <strong>${l("Posting guide from PICK", "دليل النشر من PICK")}</strong>
                  <p style="white-space: pre-wrap; margin-top: 8px;">${escapeHtml(campaign.captionGuide)}</p>
                </article>
              ` : ""}
              <label class="field"><span>${l("Social media link", "رابط السوشيال")}</span><input name="socialLink" type="url" required value="${escapeHtml(participant.socialLink || "")}" /></label>
              <label class="field"><span>${l("Feedback", "الملاحظات")}</span><textarea name="feedback">${escapeHtml(participant.feedback || "")}</textarea></label>
              <label class="field"><span>${l("Platform", "المنصة")}</span>${renderPlatformSelect("platform", participant.platform || "")}</label>
              <label class="field"><span>${l("Image 1", "الصورة 1")}</span><input name="image1" type="file" accept="image/*" /></label>
              <label class="field"><span>${l("Image 2", "الصورة 2")}</span><input name="image2" type="file" accept="image/*" /></label>
              <label class="field"><span>${l("Image 3", "الصورة 3")}</span><input name="image3" type="file" accept="image/*" /></label>
              <p class="compact field-span-full">${l("Up to 3 images total.", "حتى 3 صور كحد أقصى.")}</p>
              <div class="row-wrap field-span-full">${renderParticipantImages(participant.images || [])}</div>
              <button type="submit">${l("Submit proof", "إرسال الإثبات")}</button>
            </form>
          `
          : ""
      }
      ${
        participant && participantNeedsVisit(participant.status)
          ? `
            <article class="note-card" style="margin-bottom: 16px;">
              <strong>${l("Show your code to the cashier", "اعرض كودك على الكاشير")}</strong>
              <p>${l("Your code is already reserved. Once the cashier confirms your visit at an eligible branch, proof submission will unlock here.", "تم حجز كودك بالفعل. بمجرد أن يؤكد الكاشير زيارتك في فرع مؤهل، سيفتح نموذج إرسال الإثبات هنا.")}</p>
              ${participant.source !== "offline" ? `<div class="row-wrap" style="margin-top: 12px;"><button class="secondary" data-action="cancel-participation" data-participant-id="${participant.id}">${l("Cancel participation", "إلغاء المشاركة")}</button></div>` : ""}
            </article>
          `
          : ""
      }
      ${
        participant && ["submitted", "completed"].includes(participant.status) && !participantCanSubmit(participant)
          ? `
            <article class="note-card" style="margin-bottom: 16px;">
              <strong>${l("Submitted Proof", "الإثبات المرسل")}</strong>
              <p>${participant.socialLink ? `<a href="${participant.socialLink}" target="_blank" rel="noreferrer">${escapeHtml(participant.socialLink)}</a>` : "-"}</p>
              <p>${escapeHtml(participant.feedback || l("No feedback added.", "لا توجد ملاحظات."))}</p>
              <p class="compact">${l("This submission is view-only.", "هذا التسليم للعرض فقط.")}</p>
              <div class="row-wrap">${renderParticipantImages(participant.images || [])}</div>
            </article>
          `
          : ""
      }
      <div class="row-wrap">
        <button class="secondary" data-nav="${participant ? "myCampaigns" : "availableCampaigns"}">${participant ? l("Back to my campaigns", "العودة إلى حملاتي") : l("Back to available campaigns", "العودة إلى الحملات المتاحة")}</button>
        ${
          participant
            ? `<button data-nav="myCampaigns">${l("Open my campaigns", "افتح حملاتي")}</button>`
            : isEligible
              ? `<button data-action="join-campaign" data-campaign-id="${campaign.id}">${l("Confirm interest", "تأكيد الاهتمام")}</button>`
              : `<span class="badge danger">${l("This campaign is not currently available to join.", "هذه الحملة غير متاحة حالياً للانضمام.")}</span>`
        }
      </div>
    </section>
  `;
}

function renderProfilePage() {
  const user = state.currentUser;
  const isInfluencer = user.role === "influencer";
  return `
    ${pageHeader(l("My Profile", "ملفي الشخصي"), l("Update your profile details, optional image, and social information. Changes apply immediately.", "حدّث تفاصيل ملفك وصورتك الاختيارية ومعلومات السوشيال. التعديلات تطبق فوراً."))}
    <section class="panel">
      <h3>${l("Profile Details", "تفاصيل الملف")}</h3>
      <p class="panel-subtitle">${isInfluencer
        ? l("Required fields are marked with *. For influencer profiles, full name, mobile, gender, city, and Instagram are required.", "الحقول المطلوبة مميزة بعلامة *. وبالنسبة لملفات المؤثرين فإن الاسم الكامل والهاتف والجنس والمدينة وإنستغرام مطلوبة.")
        : l("Required fields are marked with *. Everything else on this page is optional.", "الحقول المطلوبة مميزة بعلامة *. وكل ما عدا ذلك في هذه الصفحة اختياري.")}</p>
      <form id="profileForm" class="form-grid two-col" enctype="multipart/form-data">
        <div class="profile-image-panel" style="grid-column: 1 / -1;">
          ${renderUserAvatar(user, "user-avatar--profile")}
          <div class="profile-image-panel__copy">
            <strong>${l("Profile image", "صورة الملف")}</strong>
            <p class="compact">${l("Optional for all roles. Upload JPG, PNG, WebP, or HEIC.", "اختيارية لكل الأدوار. ارفع JPG أو PNG أو WebP أو HEIC.")}</p>
          </div>
        </div>
        <label class="field" style="grid-column: 1 / -1;"><span>${l("Upload image", "رفع الصورة")}</span><input name="avatar" type="file" accept="image/*" /></label>
        <label class="field"><span>${l("Full name", "الاسم الكامل")} <em class="required-mark">*</em></span><input name="fullName" required value="${escapeHtml(user.fullName || "")}" /></label>
        <label class="field"><span>${l("Mobile", "الهاتف")}${isInfluencer ? ' <em class="required-mark">*</em>' : ""}</span>${renderKuwaitMobileField("mobile", user.mobile || "", isInfluencer)}</label>
        <label class="field"><span>${l("Gender", "الجنس")}${isInfluencer ? ' <em class="required-mark">*</em>' : ""}</span>${renderGenderSelect("gender", user.gender || "", isInfluencer)}</label>
        <label class="field"><span>${l("Date of birth", "تاريخ الميلاد")}</span><input name="dateOfBirth" type="date" value="${escapeHtml(user.dateOfBirth || "")}" /></label>
        <label class="field"><span>${l("City", "المدينة")}${isInfluencer ? ' <em class="required-mark">*</em>' : ""}</span>${renderCitySelect("cityId", user.cityId, false, isInfluencer)}</label>
        <label class="field"><span>${l("Category", "الفئة")}</span>${renderCategorySelect("categoryId", user.categoryId)}</label>
        <label class="field"><span>Instagram${isInfluencer ? ' <em class="required-mark">*</em>' : ""}</span><input name="instagram" ${isInfluencer ? "required" : ""} value="${escapeHtml(user.instagram || "")}" /></label>
        <label class="field"><span>Instagram followers</span><input name="instagramFollowers" type="number" value="${escapeHtml(user.followers?.instagram || 0)}" /></label>
        <label class="field"><span>TikTok</span><input name="tiktok" value="${escapeHtml(user.tiktok || "")}" /></label>
        <label class="field"><span>TikTok followers</span><input name="tiktokFollowers" type="number" value="${escapeHtml(user.followers?.tiktok || 0)}" /></label>
        <label class="field"><span>Snapchat</span><input name="snapchat" value="${escapeHtml(user.snapchat || "")}" /></label>
        <label class="field"><span>Snapchat followers</span><input name="snapchatFollowers" type="number" value="${escapeHtml(user.followers?.snapchat || 0)}" /></label>
        <label class="field"><span>${l("Preferred platform", "المنصة المفضلة")}</span>${renderPlatformSelect("preferredPlatform", user.preferredPlatform || "")}</label>
        <button type="submit" style="grid-column: 1 / -1;">${l("Save profile", "حفظ الملف")}</button>
      </form>
    </section>
  `;
}

function renderInfluencerProfilePage() {
  const user = selectedInfluencer();
  if (!user) return renderEmptyCampaignPage(l("No influencer selected.", "لا يوجد مؤثر محدد."));
  const participants = (state.data?.participants || [])
    .filter((participant) => participant.influencerId === user.id)
    .slice()
    .sort((left, right) => (dateValue(right.submittedAt || right.joinedAt) || 0) - (dateValue(left.submittedAt || left.joinedAt) || 0));
  const submittedRows = participants.filter((participant) => ["submitted", "completed"].includes(participant.status));
  const pendingRows = participants.filter((participant) => participantNeedsProof(participant.status));
  const summary = (state.data?.reports?.influencers || []).find((item) => item.influencerId === user.id) || {
    joined: participants.filter((participant) => participant.status !== "canceled").length,
    submitted: submittedRows.length,
    pending: pendingRows.length,
    completionRate: safePercent(submittedRows.length, participants.filter((participant) => participant.status !== "canceled").length),
    lastActivityDate:
      participants
        .map((participant) => participant.submittedAt || participant.joinedAt)
        .filter(Boolean)
        .sort()
        .at(-1) || "",
  };
  return `
    ${pageHeader(
      l("Influencer Profile", "ملف المؤثر"),
      l("Review the full influencer profile, performance, and campaign history from one page.", "راجع الملف الكامل للمؤثر والأداء وسجل الحملات من صفحة واحدة."),
      {
        heroStats: [
          { label: l("Account status", "حالة الحساب"), value: `<span class="hero-status-badge badge ${statusTone(user.status)}">${escapeHtml(user.status)}</span>`, allowHtml: true },
          { label: l("City", "المدينة"), value: cityName(user.cityId) || l("Not set", "غير محدد") },
          { label: l("Category", "الفئة"), value: categoryName(user.categoryId) || l("Not set", "غير محدد") },
        ],
        compactHeroStats: true,
      }
    )}
    ${metricGrid([
      { label: l("Campaign joins", "انضمام الحملات"), value: String(summary.joined || 0), note: l("How many times this influencer joined a campaign.", "عدد المرات التي انضم فيها هذا المؤثر إلى حملة.") },
      { label: l("Submitted proofs", "الإثباتات المرسلة"), value: String(summary.submitted || 0), note: l("Proof links already submitted by this influencer.", "روابط الإثبات التي أرسلها هذا المؤثر بالفعل.") },
      { label: l("Pending proof", "إثباتات معلقة"), value: String(summary.pending || 0), note: l("Joined campaigns still waiting for this influencer's proof.", "الحملات المنضم إليها التي ما زالت بانتظار إثبات هذا المؤثر.") },
      { label: l("Proof rate", "معدل الإثبات"), value: `${summary.completionRate || 0}%`, note: l("Share of this influencer's joins that turned into proof submissions.", "نسبة انضمامات هذا المؤثر التي تحولت إلى إثباتات مرسلة.") },
    ])}
    ${state.generatedLink ? `<article class="note-card" style="margin-bottom: 18px;"><strong>${l("Generated reset link", "رابط إعادة التعيين المولد")}</strong><p>${escapeHtml(state.generatedLink)}</p></article>` : ""}
    <section class="content-grid">
      <section class="panel panel-wide">
        <div class="row" style="align-items: flex-start; gap: 18px;">
          <div>${renderUserAvatar(user, "user-avatar--profile")}</div>
          <div style="flex: 1;">
            <h3>${escapeHtml(user.fullName)}</h3>
            <p class="panel-subtitle">${escapeHtml(user.email)}</p>
            <div class="row-wrap" style="margin-top: 10px;">
              ${(user.tags || []).length ? (user.tags || []).map((tag) => `<span class="badge">${escapeHtml(tag)}</span>`).join("") : `<span class="badge">${escapeHtml(l("No tags yet", "لا توجد علامات بعد"))}</span>`}
            </div>
          </div>
        </div>
        <div class="form-grid two-col" style="margin-top: 18px;">
          <div class="field"><span>${l("Mobile", "الهاتف")}</span><strong>${escapeHtml(user.mobile || l("Not set", "غير محدد"))}</strong></div>
          <div class="field"><span>${l("Preferred platform", "المنصة المفضلة")}</span><strong>${escapeHtml(user.preferredPlatform || l("Not set", "غير محدد"))}</strong></div>
          <div class="field"><span>${l("Gender", "الجنس")}</span><strong>${escapeHtml(genderLabel(user.gender))}</strong></div>
          <div class="field"><span>${l("Date of birth", "تاريخ الميلاد")}</span><strong>${escapeHtml(formatDate(user.dateOfBirth))}</strong></div>
          <div class="field"><span>Instagram</span><strong>${escapeHtml(user.instagram || "-")}</strong><p class="compact">${escapeHtml(String(user.followers?.instagram || 0))} ${escapeHtml(l("followers", "متابع"))}</p></div>
          <div class="field"><span>TikTok</span><strong>${escapeHtml(user.tiktok || "-")}</strong><p class="compact">${escapeHtml(String(user.followers?.tiktok || 0))} ${escapeHtml(l("followers", "متابع"))}</p></div>
          <div class="field"><span>Snapchat</span><strong>${escapeHtml(user.snapchat || "-")}</strong><p class="compact">${escapeHtml(String(user.followers?.snapchat || 0))} ${escapeHtml(l("followers", "متابع"))}</p></div>
          <div class="field"><span>${l("Signup date", "تاريخ التسجيل")}</span><strong>${escapeHtml(formatDate(user.createdAt))}</strong><p class="compact">${escapeHtml(l("Last activity", "آخر نشاط"))}: ${escapeHtml(formatDate(summary.lastActivityDate))}</p></div>
        </div>
        <article class="note-card" style="margin-top: 16px;">
          <strong>${l("Internal notes", "الملاحظات الداخلية")}</strong>
          <p>${escapeHtml((user.notes || []).length ? (user.notes || []).join(", ") : l("No internal notes yet.", "لا توجد ملاحظات داخلية بعد."))}</p>
        </article>
      </section>
      <section class="panel">
        <h3>${l("Manager actions", "إجراءات الإدارة")}</h3>
        <form class="form-grid admin-influencer-form" data-user-id="${user.id}">
          ${renderAdminTagCheckboxField(user.tags || [])}
          <label class="field"><span>${l("Notes", "الملاحظات")}</span><input name="notes" value="${escapeHtml((user.notes || []).join(", "))}" placeholder="${l("Internal notes", "ملاحظات داخلية")}" /></label>
          <p class="compact">${l("Use tags and notes here to support targeting, follow-up, and internal quality review.", "استخدم العلامات والملاحظات هنا لدعم الاستهداف والمتابعة والمراجعة الداخلية للجودة.")}</p>
          <button type="submit">${l("Save tags and notes", "حفظ العلامات والملاحظات")}</button>
        </form>
        <div class="row-wrap" style="margin-top: 12px;">
          ${user.status === "pending"
            ? `
              <button data-action="approve-user" data-user-id="${user.id}">${l("Approve", "اعتماد")}</button>
              <button class="secondary" data-action="reject-user" data-user-id="${user.id}">${l("Reject", "رفض")}</button>
            `
            : `
              <button type="button" class="secondary" data-action="set-user-status" data-status="${user.status === "active" ? "suspended" : "active"}" data-user-id="${user.id}">${user.status === "active" ? l("Deactivate", "إيقاف") : l("Reactivate", "إعادة تفعيل")}</button>
            `}
          <button type="button" class="secondary" data-action="generate-reset-link" data-user-id="${user.id}">${l("Generate reset link", "توليد رابط إعادة تعيين")}</button>
          <button type="button" class="secondary" data-action="toggle-password-editor" data-user-id="${user.id}">${state.passwordEditorUserId === user.id ? l("Close password", "إغلاق كلمة المرور") : l("Change password", "تغيير كلمة المرور")}</button>
        </div>
        ${state.passwordEditorUserId === user.id ? `<form class="inline-form manual-password-form" data-user-id="${user.id}" style="margin-top: 12px;">
          ${renderPasswordField("password", { required: true, autocomplete: "new-password", hint: passwordRequirementHint(), label: l("Set manual password", "تعيين كلمة مرور يدوية"), minLength: 8 })}
          <button type="submit">${l("Save password", "حفظ كلمة المرور")}</button>
        </form>` : ""}
      </section>
    </section>
    <section class="panel">
      <h3>${l("Campaign history", "سجل الحملات")}</h3>
      <p class="panel-subtitle">${l("See every campaign this influencer joined, the assigned code, and the current proof state.", "اطلع على كل حملة انضم إليها هذا المؤثر والكود المخصص وحالة الإثبات الحالية.")}</p>
      ${renderDataTable(
        [
          { label: l("Campaign", "الحملة"), render: (row) => renderCampaignTitleLink(row), html: true },
          { label: l("Status", "الحالة"), render: (row) => `<span class="badge ${participantDisplayTone(row)}">${escapeHtml(participantDisplayStatus(row))}</span>`, html: true },
          { label: l("Code", "الكود"), render: (row) => row.assignedCodeValue || "-" },
          { label: l("Joined", "انضم"), render: (row) => formatDate(row.joinedAt) },
          { label: l("Submitted", "سلّم"), render: (row) => formatDate(row.submittedAt) },
        ],
        participants,
        l("No campaign history yet for this influencer.", "لا يوجد سجل حملات لهذا المؤثر بعد.")
      )}
    </section>
    <section class="panel">
      <h3>${l("Submitted posts", "المنشورات المرسلة")}</h3>
      <p class="panel-subtitle">${l("Review every submitted social link and feedback from this influencer.", "راجع كل رابط سوشيال وملاحظة تم إرسالها من هذا المؤثر.")}</p>
      ${renderDataTable(
        [
          { label: l("Campaign", "الحملة"), render: (row) => renderCampaignTitleLink(row), html: true },
          { label: l("Platform", "المنصة"), render: (row) => row.platform || l("Not set", "غير محدد") },
          { label: l("Submitted", "سلّم"), render: (row) => formatDate(row.submittedAt) },
          {
            label: l("Link", "الرابط"),
            render: (row) =>
              row.socialLink
                ? `<a class="table-link-button" href="${escapeHtml(row.socialLink)}" target="_blank" rel="noreferrer">${escapeHtml(l("Open post", "فتح المنشور"))}</a>`
                : "-",
            html: true,
          },
          { label: l("Feedback", "الملاحظات"), render: (row) => row.feedback || "-" },
        ],
        submittedRows,
        l("No submitted posts yet for this influencer.", "لا توجد منشورات مرسلة لهذا المؤثر بعد.")
      )}
    </section>
  `;
}

function renderCitySelect(name, selectedValue, includeAll = false, required = false) {
  const cities = state.data?.cities || state.publicData?.cities || [];
  const normalizedSelected = Number(selectedValue) || null;
  return `
    <select name="${name}" ${required ? "required" : ""}>
      ${includeAll ? `<option value="">${l("All", "الكل")}</option>` : `<option value="">${l("Select", "اختر")}</option>`}
      ${cities
        .filter((city) => city.status === "active" || Number(city.id) === normalizedSelected)
        .map(
          (city) => `
            <option value="${city.id}" ${normalizedSelected === city.id ? "selected" : ""}>${escapeHtml(state.locale === "ar" ? city.nameAr : city.nameEn)}</option>
          `
        )
        .join("")}
    </select>
  `;
}

function renderCategorySelect(name, selectedValue, includeAll = false) {
  const categories = state.data?.categories || state.publicData?.categories || [];
  const normalizedSelected = Number(selectedValue) || null;
  return `
    <select name="${name}">
      ${includeAll ? `<option value="">${l("All", "الكل")}</option>` : `<option value="">${l("Select", "اختر")}</option>`}
      ${categories
        .filter((category) => category.status === "active" || Number(category.id) === normalizedSelected)
        .map(
          (category) => `
            <option value="${category.id}" ${normalizedSelected === category.id ? "selected" : ""}>${escapeHtml(state.locale === "ar" ? category.nameAr : category.nameEn)}</option>
          `
        )
        .join("")}
    </select>
  `;
}

function renderPlatformSelect(name, selectedValue, includeAll = false) {
  const platforms = state.data?.platforms || state.publicData?.platforms || [];
  const normalizedSelected = String(selectedValue || "");
  const selectedExists = platforms.some((platform) => platform.nameEn === normalizedSelected);
  return `
    <select name="${name}">
      ${includeAll ? `<option value="">${l("All", "الكل")}</option>` : `<option value="">${l("Select", "اختر")}</option>`}
      ${normalizedSelected && !selectedExists ? `<option value="${escapeHtml(normalizedSelected)}" selected>${escapeHtml(normalizedSelected)}</option>` : ""}
      ${platforms
        .filter((platform) => platform.status === "active")
        .map(
          (platform) => `
            <option value="${escapeHtml(platform.nameEn)}" ${platform.nameEn === normalizedSelected ? "selected" : ""}>${escapeHtml(state.locale === "ar" ? platform.nameAr : platform.nameEn)}</option>
          `
        )
        .join("")}
    </select>
  `;
}

function campaignDeepLink(campaignId, baseUrl = window.location.origin) {
  const normalizedBaseUrl = String(baseUrl || "").replace(/\/$/, "");
  return `${normalizedBaseUrl}/?campaign=${campaignId}`;
}

function buildWhatsAppLink(mobileValue, message) {
  const digits = String(mobileValue || "").replace(/\D/g, "");
  const phone = digits.startsWith("965") ? digits : `965${digits}`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function defaultCampaignShareBody(campaign) {
  const titleEn = campaign.titleEn || "PICK";
  const titleAr = campaign.titleAr || campaign.titleEn || "PICK";
  const offer = campaign.offerDescription || "";
  const branchSummary =
    campaign.branchMode === "all"
      ? l("All branches", "جميع الأفرع")
      : ((campaign.branchIds || [])
          .map((branchId) => (state.data?.branches || []).find((branch) => branch.id === branchId))
          .map((branch) => branchDisplayName(branch))
          .filter(Boolean)
          .join(state.locale === "ar" ? "، " : ", ")) || "";
  const visitDate = formatDate(campaign.visitDeadline);
  const submitDate = formatDate(campaign.submissionDeadline);

  if (state.locale === "ar") {
    return [
      `حملة PICK: ${titleAr}`,
      offer ? `العرض: ${offer}` : "",
      `الأفرع: ${branchSummary}`,
      `الزيارة قبل: ${visitDate}`,
      `التسليم قبل: ${submitDate}`,
      "",
      "أكّد اهتمامك من تطبيق PICK Influence Hub لحجز كود خاص بك.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    `PICK Campaign: ${titleEn}`,
    offer ? `Offer: ${offer}` : "",
    `Branches: ${branchSummary}`,
    `Visit by: ${visitDate}`,
    `Submit by: ${submitDate}`,
    "",
    "Confirm interest in the PICK Influence Hub to reserve your private one-time code.",
  ]
    .filter(Boolean)
    .join("\n");
}

function generateCampaignShareText(campaign, options = {}) {
  const recipient = options.recipientName ? String(options.recipientName).trim().split(/\s+/)[0] : "";
  const heart = "\u{1F49C}";
  const greeting = state.locale === "ar" ? (recipient ? `مرحبا ${recipient} ${heart}` : `مرحبا ${heart}`) : recipient ? `Hi ${recipient} ${heart}` : `Hi ${heart}`;
  const body = campaign.whatsappMessage && campaign.whatsappMessage.trim() ? campaign.whatsappMessage.trim() : defaultCampaignShareBody(campaign);
  const linkLabel = state.locale === "ar" ? "افتح" : "Open";
  const deepLink = campaignDeepLink(campaign.id);
  return `${greeting}\n\n${body}\n\n${linkLabel}: ${deepLink}`;
}

function generateCampaignEmailText(campaign) {
  const title = campaign.titleEn || campaign.titleAr || "PICK";
  const titleAr = campaign.titleAr || campaign.titleEn || "PICK";
  return state.locale === "ar"
    ? `تذكير بالحملة ${titleAr}. لديك حتى ${formatDate(campaign.submissionDeadline)} لإرسال رابط النشر بعد الزيارة.`
    : `Reminder for ${title}. You have until ${formatDate(campaign.submissionDeadline)} to submit your social media link after the visit.`;
}

function bindGlobalEvents() {
  app.addEventListener("click", handleClick);
  app.addEventListener("submit", handleSubmit);
  app.addEventListener("change", handleChange);
  app.addEventListener("input", handleInput);
  app.addEventListener("keydown", handleKeyDown);
  app.addEventListener("focusout", handleFocusOut);
}

async function handleClick(event) {
  const target = event.target.closest("[data-action], [data-nav]");
  if (!target) return;

  if (target.dataset.nav) {
    state.mobileNavOpen = false;
    state.currentPage = normalizePage(target.dataset.nav);
    render();
    return;
  }

  const action = target.dataset.action;
  if (action === "toggle-mobile-nav") {
    state.mobileNavOpen = !state.mobileNavOpen;
    render();
    return;
  }

  if (action === "close-mobile-nav") {
    state.mobileNavOpen = false;
    render();
    return;
  }

  if (action === "set-auth-mode") {
    state.authMode = target.dataset.mode;
    if (state.authMode !== "reset") state.generatedLink = "";
    render();
    return;
  }

  if (action === "dismiss-flash") {
    state.flash = null;
    window.clearTimeout(flash._timeout);
    syncFlashLayer();
    return;
  }

  if (action === "toggle-password-visibility") {
    const field = target.closest(".password-field")?.querySelector("input");
    if (!field) return;
    const showing = field.type === "text";
    field.type = showing ? "password" : "text";
    target.textContent = showing ? l("Show", "إظهار") : l("Hide", "إخفاء");
    return;
  }

  if (action === "logout") {
    await api("/api/logout", { method: "POST", body: JSON.stringify({}) });
    state.currentUser = null;
    state.data = null;
    state.currentPage = null;
    state.generatedLink = "";
    state.authMode = "login";
    flash(l("Signed out.", "تم تسجيل الخروج."), "success");
    render();
    return;
  }

  if (action === "approve-user") {
    await mutateAndRefresh(`/api/users/${target.dataset.userId}/status`, { status: "active" }, l("Influencer approved.", "تم اعتماد المؤثر."));
    return;
  }

  if (action === "reject-user") {
    await mutateAndRefresh(`/api/users/${target.dataset.userId}/status`, { status: "rejected" }, l("Influencer rejected.", "تم رفض المؤثر."));
    return;
  }

  if (action === "set-user-status") {
    await mutateAndRefresh(`/api/users/${target.dataset.userId}/status`, { status: target.dataset.status }, l("Influencer status updated.", "تم تحديث حالة المؤثر."));
    return;
  }

  if (action === "toggle-password-editor") {
    const userId = Number(target.dataset.userId);
    state.passwordEditorUserId = state.passwordEditorUserId === userId ? null : userId;
    render();
    return;
  }

  if (action === "view-influencer") {
    state.selectedInfluencerId = Number(target.dataset.userId);
    state.influencerProfileReturnPage = state.currentPage;
    state.currentPage = "influencer-profile";
    render();
    return;
  }

  if (action === "back-from-influencer-profile") {
    state.currentPage = state.influencerProfileReturnPage || "influencers";
    render();
    return;
  }

  if (action === "edit-branch") {
    state.selectedBranchId = Number(target.dataset.branchId);
    state.currentPage = "branch-edit";
    render();
    return;
  }

  if (action === "rotate-branch-pin") {
    if (!window.confirm(l("Rotate the branch PIN now?", "هل تريد تدوير رمز الفرع الآن؟"))) return;
    await mutateAndRefresh(`/api/branches/${target.dataset.branchId}/rotate-pin`, {}, l("Branch PIN rotated.", "تم تدوير رمز الفرع."), { rethrow: true });
    return;
  }

  if (action === "copy-branch-pin") {
    try {
      await navigator.clipboard.writeText(target.dataset.pin || "");
      flash(l("Branch PIN copied.", "تم نسخ رمز الفرع."), "success");
    } catch (error) {
      flash(l("Could not copy the branch PIN.", "تعذر نسخ رمز الفرع."), "error");
    }
    return;
  }

  if (action === "edit-manager") {
    state.selectedManagerId = Number(target.dataset.managerId);
    state.currentPage = "manager-edit";
    render();
    return;
  }

  if (action === "back-to-branches") {
    state.selectedBranchId = null;
    state.currentPage = "branches";
    render();
    return;
  }

  if (action === "back-to-managers") {
    state.selectedManagerId = null;
    state.passwordEditorUserId = null;
    state.currentPage = "managers";
    render();
    return;
  }

  if (action === "toggle-master-data-editor") {
    const type = target.dataset.type || "";
    const id = Number(target.dataset.id) || null;
    const isSame = state.masterDataEditor.type === type && state.masterDataEditor.id === id;
    state.masterDataEditor = isSame ? { type: "", id: null } : { type, id };
    render();
    return;
  }

  if (action === "toggle-master-data-inactive") {
    const type = target.dataset.type || "";
    if (!["city", "category", "platform", "tag"].includes(type)) return;
    state.masterDataShowInactive = {
      ...state.masterDataShowInactive,
      [type]: !state.masterDataShowInactive[type],
    };
    render();
    return;
  }

  if (action === "delete-master-data") {
    const type = target.dataset.type || "";
    const id = Number(target.dataset.id);
    const config = {
      city: { url: `/api/cities/${id}/delete`, message: l("City deactivated for future use.", "تم تعطيل المدينة للاستخدامات المستقبلية.") },
      category: { url: `/api/categories/${id}/delete`, message: l("Category deactivated for future use.", "تم تعطيل الفئة للاستخدامات المستقبلية.") },
      platform: { url: `/api/platforms/${id}/delete`, message: l("Platform deactivated for future use.", "تم تعطيل المنصة للاستخدامات المستقبلية.") },
      tag: { url: `/api/tags/${id}/delete`, message: l("Tag deactivated for future use.", "تم تعطيل العلامة للاستخدامات المستقبلية.") },
    }[type];
    if (!config) return;
    if (!window.confirm(l("Deactivate this item for future use?", "هل تريد تعطيل هذا العنصر للاستخدامات المستقبلية؟"))) return;
    state.masterDataEditor = { type: "", id: null };
    await mutateAndRefresh(config.url, {}, config.message);
    return;
  }

  if (action === "generate-reset-link") {
    try {
      const payload = await api(`/api/users/${target.dataset.userId}/reset-link`, { method: "POST", body: JSON.stringify({}) });
      state.generatedLink = payload.resetLink;
      flash(l("Reset link generated.", "تم توليد رابط إعادة التعيين."), "success");
      render();
    } catch (error) {
      flash(error.message, "error");
    }
    return;
  }

  if (action === "edit-campaign") {
    state.selectedCampaignId = Number(target.dataset.campaignId);
    state.currentPage = "campaign-edit";
    render();
    return;
  }

  if (action === "preview-campaign") {
    state.selectedCampaignId = Number(target.dataset.campaignId);
    state.currentPage = "campaign-preview";
    render();
    return;
  }

  if (action === "view-campaign") {
    state.selectedCampaignId = Number(target.dataset.campaignId);
    state.manualReserveCodeId = null;
    try {
      const payload = await api(`/api/campaigns/${target.dataset.campaignId}/codes`);
      state.campaignCodesByCampaign[state.selectedCampaignId] = payload.codes;
      state.currentPage = "campaign-view";
      render();
    } catch (error) {
      flash(error.message, "error");
    }
    return;
  }

  if (action === "duplicate-campaign") {
    try {
      const payload = await api(`/api/campaigns/${target.dataset.campaignId}/duplicate`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      await loadBootstrap();
      state.selectedCampaignId = payload.campaign.id;
      state.currentPage = "campaign-edit";
      flash(l("Campaign duplicated as draft.", "تم نسخ الحملة كمسودة."), "success");
      render();
    } catch (error) {
      flash(error.message, "error");
    }
    return;
  }

  if (action === "back-to-campaigns") {
    state.manualReserveCodeId = null;
    state.currentPage = "campaigns";
    render();
    return;
  }

  if (action === "set-report-tab") {
    state.reportTab = target.dataset.tab || "campaigns";
    render();
    return;
  }

  if (action === "export-report-csv") {
    window.location.assign(`/api/reports/export.csv?tab=${encodeURIComponent(state.reportTab)}`);
    return;
  }

  if (action === "sort-report-table") {
    const table = target.dataset.table;
    const key = target.dataset.sortKey;
    if (table && key) {
      const current = state.reportSorts[table] || { key, direction: "desc" };
      state.reportSorts = {
        ...state.reportSorts,
        [table]: {
          key,
          direction: current.key === key && current.direction === "desc" ? "asc" : "desc",
        },
      };
      render();
    }
    return;
  }

  if (action === "clear-report-filters") {
    state.reportFilters = {
      ...state.reportFilters,
      [state.reportTab]: defaultReportFilters()[state.reportTab],
    };
    render();
    return;
  }

  if (action === "toggle-manual-reserve") {
    const codeId = Number(target.dataset.codeId);
    state.manualReserveCodeId = state.manualReserveCodeId === codeId ? null : codeId;
    render();
    return;
  }

  if (action === "set-checkbox-group") {
    const field = target.closest(".field");
    const name = target.dataset.checkboxName;
    const mode = target.dataset.checkboxMode;
    if (!field || !name) return;
    field.querySelectorAll(`input[name="${CSS.escape(name)}"]`).forEach((input) => {
      input.checked = mode === "all";
    });
    return;
  }

  if (action === "join-campaign") {
    const campaign = currentCampaigns().find((item) => item.id === Number(target.dataset.campaignId));
    if (campaign) {
      const confirmed = window.confirm(
        l(
          `Confirming interest will reserve a unique code for you.\nOffer: ${campaign.offerDescription || "-"}\nVisit deadline: ${formatDate(campaign.visitDeadline)}\nSubmission deadline: ${formatDate(campaign.submissionDeadline)}`,
          `تأكيد الاهتمام سيحجز لك كوداً فريداً.\nالعرض: ${campaign.offerDescription || "-"}\nآخر موعد للزيارة: ${formatDate(campaign.visitDeadline)}\nآخر موعد للتسليم: ${formatDate(campaign.submissionDeadline)}`
        )
      );
      if (!confirmed) return;
    }
    await mutateAndRefresh(`/api/campaigns/${target.dataset.campaignId}/join`, {}, l("Your private code has been reserved.", "تم حجز كودك الخاص."));
    return;
  }

  if (action === "copy-whatsapp-text") {
    const campaign = currentCampaigns().find((item) => item.id === Number(target.dataset.campaignId));
    if (!campaign) {
      flash(l("Campaign not found.", "الحملة غير موجودة."), "error");
      return;
    }
    try {
      await navigator.clipboard.writeText(generateCampaignShareText(campaign));
      flash(l("WhatsApp text copied.", "تم نسخ نص واتساب."), "success");
    } catch (error) {
      flash(l("Could not copy the WhatsApp text.", "تعذر نسخ نص واتساب."), "error");
    }
    return;
  }

  if (action === "cancel-participation") {
    if (!window.confirm(l("Cancel this participation and release the reserved code?", "هل تريد إلغاء هذه المشاركة وإعادة الكود المحجوز؟"))) return;
    await mutateAndRefresh(`/api/participants/${target.dataset.participantId}/cancel`, {}, l("Participation canceled and code released.", "تم إلغاء المشاركة وإعادة الكود."), { rethrow: true });
    return;
  }

  if (action === "remove-participant") {
    if (!window.confirm(l("Remove this influencer from the campaign?", "هل تريد إزالة هذا المؤثر من الحملة؟"))) return;
    await mutateAndRefresh(`/api/participants/${target.dataset.participantId}/remove`, {}, l("Influencer removed from campaign.", "تمت إزالة المؤثر من الحملة."));
    return;
  }

  if (action === "download-sample-csv") {
    const sample = "code,usage,offer\nPICK-001,1,Free coffee\n";
    const blob = new Blob([sample], { type: "text/csv;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = "sample-codes.csv";
    link.click();
    URL.revokeObjectURL(objectUrl);
    return;
  }
}

async function handleSubmit(event) {
  event.preventDefault();
  const form = event.target;
  clearFormErrors(form);
  if (!reportFormValidity(form)) return;
  const submitButton = lockFormButton(form);
  try {
    if (form.id === "loginForm") {
      const payload = formDataToObject(new FormData(form));
      await api("/api/login", { method: "POST", body: JSON.stringify(payload) });
      const session = await api("/api/session");
      state.currentUser = session.user;
      state.currentPage = defaultPageForRole(session.user.role);
      await loadBootstrap();
      flash(l("Signed in successfully.", "تم تسجيل الدخول بنجاح."), "success");
      return;
    }
    if (form.id === "signupForm") {
      const values = formDataToObject(new FormData(form));
      const passwordError = validatePasswordStrength(values.password);
      if (passwordError) {
        setFieldError(form, "password", passwordError);
        reportFormValidity(form);
        throw new Error(passwordError);
      }
      const mobileError = validateKuwaitMobile(values.mobile);
      if (mobileError) {
        setFieldError(form, "mobile", mobileError);
        reportFormValidity(form);
        throw new Error(mobileError);
      }
      await api("/api/signup", { method: "POST", body: JSON.stringify(values) });
      state.authMode = "login";
      flash(l("Your signup request was created and is waiting for approval.", "تم إنشاء طلب التسجيل وهو بانتظار الاعتماد."), "success");
      render();
      return;
    }
    if (form.id === "forgotPasswordForm") {
      const payload = await api("/api/password/forgot", { method: "POST", body: JSON.stringify(formDataToObject(new FormData(form))) });
      state.generatedLink = "";
      state.authMode = "login";
      flash(payload.message || l("If an account exists for this email, an admin will share the reset link with you.", "إذا كان الحساب موجوداً، فسيشاركك المسؤول رابط إعادة التعيين."), "success");
      render();
      return;
    }
    if (form.id === "resetPasswordForm") {
      const password = new FormData(form).get("password");
      const passwordError = validatePasswordStrength(password);
      if (passwordError) {
        setFieldError(form, "password", passwordError);
        reportFormValidity(form);
        throw new Error(passwordError);
      }
      await api("/api/password/reset", {
        method: "POST",
        body: JSON.stringify({ token: state.resetToken, password }),
      });
      state.resetToken = "";
      state.authMode = "login";
      window.history.replaceState({}, "", "/");
      flash(l("Password reset successfully. Please sign in.", "تمت إعادة تعيين كلمة المرور. يمكنك تسجيل الدخول الآن."), "success");
      render();
      return;
    }
    if (form.id === "createCampaignForm") {
      const payload = campaignFormPayload(form);
      const tagError = validateTagInputAgainstLibrary(payload.targetTags, availableTagValues());
      if (tagError) throw new Error(tagError);
      const timelineError = validateCampaignTimeline(payload);
      if (timelineError) {
        ["startDate", "endDate", "visitDeadline", "submissionDeadline"].forEach((name) => setFieldError(form, name, timelineError));
        reportFormValidity(form);
        throw new Error(timelineError);
      }
      const created = await api("/api/campaigns", { method: "POST", body: JSON.stringify(payload) });
      const bannerFile = form.querySelector("[name='banner']")?.files?.[0];
      if (bannerFile) {
        const bannerFormData = new FormData();
        bannerFormData.append("banner", bannerFile);
        await api(`/api/campaigns/${created.campaign.id}/banner`, { method: "POST", body: bannerFormData });
      }
      await loadBootstrap();
      flash(
        bannerFile
          ? l("Campaign created and banner uploaded.", "تم إنشاء الحملة ورفع البانر.")
          : l("Campaign created.", "تم إنشاء الحملة."),
        "success"
      );
      form.reset();
      return;
    }
    if (form.id === "editCampaignForm") {
      const campaignId = form.querySelector("[name='campaignId']").value;
      const payload = campaignFormPayload(form);
      const campaign = currentCampaigns().find((item) => item.id === Number(campaignId));
      const tagError = validateTagInputAgainstLibrary(payload.targetTags, availableTagValues(campaign?.targetTags || []));
      if (tagError) throw new Error(tagError);
      const timelineError = validateCampaignTimeline(payload);
      if (timelineError) {
        ["startDate", "endDate", "visitDeadline", "submissionDeadline"].forEach((name) => setFieldError(form, name, timelineError));
        reportFormValidity(form);
        throw new Error(timelineError);
      }
      await mutateAndRefresh(`/api/campaigns/${campaignId}/update`, payload, l("Campaign updated.", "تم تحديث الحملة."), { rethrow: true });
      return;
    }
    if (form.id === "bannerForm") {
      const formData = new FormData(form);
      const campaignId = formData.get("campaignId");
      await mutateAndRefresh(`/api/campaigns/${campaignId}/banner`, formData, l("Banner uploaded.", "تم رفع البانر."), { rethrow: true });
      return;
    }
    if (form.id === "uploadCodesForm") {
      const formData = new FormData(form);
      const campaignId = formData.get("campaignId");
      await mutateAndRefresh(`/api/campaigns/${campaignId}/codes/upload`, formData, l("Codes uploaded.", "تم رفع الأكواد."), { rethrow: true });
      return;
    }
    if (form.id === "resetCodesForm") {
      if (!window.confirm(l("Delete uploaded codes and cancel affected assignments?", "هل تريد حذف الأكواد المرفوعة وإلغاء التخصيصات المتأثرة؟"))) return;
      const campaignId = new FormData(form).get("campaignId");
      await mutateAndRefresh(`/api/campaigns/${campaignId}/codes/reset`, {}, l("Uploaded codes deleted and affected assignments canceled.", "تم حذف الأكواد وإلغاء التخصيصات المتأثرة."), { rethrow: true });
      return;
    }
    if (form.classList.contains("admin-influencer-form")) {
      const userId = form.dataset.userId;
      const formData = new FormData(form);
      const tags = formData.getAll("tags");
      const notes = formData.get("notes");
      await mutateAndRefresh(`/api/users/${userId}/admin-update`, { tags, notes }, l("Influencer updated.", "تم تحديث المؤثر."), { rethrow: true });
      return;
    }
    if (form.classList.contains("manual-password-form")) {
      const userId = form.dataset.userId;
      const values = formDataToObject(new FormData(form));
      const passwordError = validatePasswordStrength(values.password);
      if (passwordError) {
        setFieldError(form, "password", passwordError);
        reportFormValidity(form);
        throw new Error(passwordError);
      }
      state.passwordEditorUserId = null;
      await mutateAndRefresh(`/api/users/${userId}/set-password`, values, l("Password updated.", "تم تحديث كلمة المرور."), { rethrow: true });
      form.reset();
      return;
    }
    if (form.id === "profileForm") {
      const formData = new FormData(form);
      const mobileError = validateKuwaitMobile(formData.get("mobile"));
      if (mobileError) {
        setFieldError(form, "mobile", mobileError);
        reportFormValidity(form);
        throw new Error(mobileError);
      }
      if (state.currentUser.role === "influencer") {
        if (!formData.get("mobile")) {
          const message = l("Mobile number is required.", "رقم الهاتف مطلوب.");
          setFieldError(form, "mobile", message);
          reportFormValidity(form);
          throw new Error(message);
        }
        if (!formData.get("cityId")) {
          const message = l("City is required.", "المدينة مطلوبة.");
          setFieldError(form, "cityId", message);
          reportFormValidity(form);
          throw new Error(message);
        }
        if (!String(formData.get("instagram") || "").trim()) {
          const message = l("Instagram is required.", "حساب إنستغرام مطلوب.");
          setFieldError(form, "instagram", message);
          reportFormValidity(form);
          throw new Error(message);
        }
      }
      await mutateAndRefresh("/api/profile/update", formData, l("Profile updated.", "تم تحديث الملف."), { rethrow: true });
      return;
    }
    if (form.id === "createManagerForm") {
      const values = formDataToObject(new FormData(form));
      const passwordError = validatePasswordStrength(values.password);
      if (passwordError) {
        setFieldError(form, "password", passwordError);
        reportFormValidity(form);
        throw new Error(passwordError);
      }
      const mobileError = validateKuwaitMobile(values.mobile);
      if (mobileError) {
        setFieldError(form, "mobile", mobileError);
        reportFormValidity(form);
        throw new Error(mobileError);
      }
      await mutateAndRefresh("/api/managers", values, l("Campaign manager created.", "تم إنشاء مدير الحملات."), { rethrow: true });
      form.reset();
      return;
    }
    if (form.id === "editManagerForm") {
      const managerId = form.dataset.managerId;
      const values = formDataToObject(new FormData(form));
      const mobileError = validateKuwaitMobile(values.mobile);
      if (mobileError) {
        setFieldError(form, "mobile", mobileError);
        reportFormValidity(form);
        throw new Error(mobileError);
      }
      await mutateAndRefresh(`/api/managers/${managerId}/update`, values, l("Campaign manager updated.", "تم تحديث مدير الحملات."), { rethrow: true });
      return;
    }
    if (form.id === "createCityForm") {
      await mutateAndRefresh("/api/cities", formDataToObject(new FormData(form)), l("City added.", "تمت إضافة المدينة."), { rethrow: true });
      form.reset();
      return;
    }
    if (form.classList.contains("update-city-form")) {
      await mutateAndRefresh(`/api/cities/${form.dataset.cityId}/update`, formDataToObject(new FormData(form)), l("City updated.", "تم تحديث المدينة."), { rethrow: true });
      return;
    }
    if (form.id === "createCategoryForm") {
      await mutateAndRefresh("/api/categories", formDataToObject(new FormData(form)), l("Category added.", "تمت إضافة الفئة."), { rethrow: true });
      form.reset();
      return;
    }
    if (form.classList.contains("update-category-form")) {
      await mutateAndRefresh(`/api/categories/${form.dataset.categoryId}/update`, formDataToObject(new FormData(form)), l("Category updated.", "تم تحديث الفئة."), { rethrow: true });
      return;
    }
    if (form.id === "createPlatformForm") {
      await mutateAndRefresh("/api/platforms", formDataToObject(new FormData(form)), l("Platform added.", "تمت إضافة المنصة."), { rethrow: true });
      form.reset();
      return;
    }
    if (form.classList.contains("update-platform-form")) {
      await mutateAndRefresh(`/api/platforms/${form.dataset.platformId}/update`, formDataToObject(new FormData(form)), l("Platform updated.", "تم تحديث المنصة."), { rethrow: true });
      return;
    }
    if (form.id === "createTagForm") {
      const values = formDataToObject(new FormData(form));
      const tagError = validateSingleTagToken(values.value);
      if (tagError) throw new Error(tagError);
      values.value = sanitizeTagToken(values.value);
      await mutateAndRefresh("/api/tags", values, l("Tag added.", "تمت إضافة العلامة."), { rethrow: true });
      form.reset();
      return;
    }
    if (form.classList.contains("update-tag-form")) {
      const values = formDataToObject(new FormData(form));
      const tagError = validateSingleTagToken(values.value);
      if (tagError) throw new Error(tagError);
      values.value = sanitizeTagToken(values.value);
      await mutateAndRefresh(`/api/tags/${form.dataset.tagId}/update`, values, l("Tag updated.", "تم تحديث العلامة."), { rethrow: true });
      return;
    }
    if (form.id === "createBranchForm") {
      await mutateAndRefresh("/api/branches", new FormData(form), l("Branch created.", "تم إنشاء الفرع."), { rethrow: true });
      form.reset();
      return;
    }
    if (form.id === "editBranchForm") {
      const branchId = new FormData(form).get("branchId");
      await mutateAndRefresh(`/api/branches/${branchId}/update`, new FormData(form), l("Branch updated.", "تم تحديث الفرع."), { rethrow: true });
      return;
    }
    if (form.classList.contains("submission-form")) {
      const formData = new FormData(form);
      const participantId = form.dataset.participantId;
      await mutateAndRefresh(`/api/participants/${participantId}/submission`, formData, l("Proof submitted.", "تم إرسال الإثبات."), { rethrow: true });
      return;
    }
    if (form.classList.contains("manual-reserve-form")) {
      const codeId = form.dataset.codeId;
      state.manualReserveCodeId = null;
      await mutateAndRefresh(`/api/codes/${codeId}/manual-reserve`, formDataToObject(new FormData(form)), l("Offline reservation added.", "تمت إضافة الحجز الخارجي."), { rethrow: true });
      return;
    }
  } catch (error) {
    applyApiErrorToForm(form, error.message);
    syncInvalidFields(form);
    flash(error.message, "error");
  } finally {
    unlockFormButton(submitButton);
  }
}

function handleChange(event) {
  if (["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)) {
    clearFieldError(event.target);
  }
  if (event.target.matches("input[type='file'][accept*='image']")) {
    syncImagePreview(event.target);
  }
  if (event.target.matches("[data-action='change-locale']")) {
    saveLocale(event.target.value);
    render();
    return;
  }

  if (event.target.matches("[name='branchMode']")) {
    const selectionGroup = event.target.form?.querySelector("[data-branch-selection]");
    if (selectionGroup) {
      const shouldShow = event.target.value === "selected";
      selectionGroup.hidden = !shouldShow;
      selectionGroup.querySelectorAll("input[name='branchIds']").forEach((input) => {
        input.disabled = !shouldShow;
        if (!shouldShow) input.checked = false;
      });
    }
    return;
  }

  if (event.target.closest("#influencerFilterForm")) {
    const form = event.target.form;
    state.influencerFilters = {
      query: form.query.value,
      cityId: form.cityId.value,
      categoryId: form.categoryId.value,
      status: form.status.value,
      tag: form.tag.value,
    };
    render({ preserveFocus: true });
    return;
  }

  if (event.target.closest("#reportFilterForm")) {
    const form = event.target.form;
    syncReportFilters(form);
    render({ preserveFocus: true });
    return;
  }
}

function handleInput(event) {
  if (["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)) {
    clearFieldError(event.target);
  }
  if (event.target.matches("[data-kuwait-mobile]")) {
    event.target.value = kuwaitMobileLocal(event.target.value).slice(0, 8);
    return;
  }

  if (event.target.matches("[name='campaignSearch']")) {
    state.campaignSearch = event.target.value;
    render({ preserveFocus: true });
    return;
  }

  if (event.target.closest("#reportFilterForm")) {
    syncReportFilters(event.target.form);
    render({ preserveFocus: true });
    return;
  }

  if (event.target.closest("#influencerFilterForm")) {
    const form = event.target.form;
    state.influencerFilters = {
      query: form.query.value,
      cityId: form.cityId.value,
      categoryId: form.categoryId.value,
      status: form.status.value,
      tag: form.tag.value,
    };
    render({ preserveFocus: true });
    return;
  }
}

function handleKeyDown(event) {
  if (event.key === "Escape" && state.mobileNavOpen) {
    state.mobileNavOpen = false;
    render();
  }
}

function handleFocusOut(event) {
  void event;
}

function formDataToObject(formData) {
  const object = {};
  for (const [key, value] of formData.entries()) {
    if (object[key] !== undefined) {
      object[key] = Array.isArray(object[key]) ? [...object[key], value] : [object[key], value];
    } else {
      object[key] = value;
    }
  }
  return object;
}

function campaignFormPayload(form) {
  const formData = new FormData(form);
  const normalizedTargetTags = normalizeTagInput(formData.getAll("targetTags").join(", "));
  return {
    titleEn: formData.get("titleEn"),
    titleAr: formData.get("titleAr"),
    type: formData.get("type"),
    status: formData.get("status"),
    audience: formData.get("audience"),
    audienceAr: formData.get("audienceAr"),
    offerUsageCount: Number(formData.get("offerUsageCount")) || 1,
    offerDescription: formData.get("offerDescription"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    visitDeadline: formData.get("visitDeadline"),
    submissionDeadline: formData.get("submissionDeadline"),
    descriptionEn: formData.get("descriptionEn"),
    descriptionAr: formData.get("descriptionAr"),
    captionGuide: formData.get("captionGuide"),
    whatsappMessage: formData.get("whatsappMessage"),
    branchMode: formData.get("branchMode"),
    branchIds: formData.getAll("branchIds"),
    targetCityIds: formData.getAll("targetCityIds"),
    targetCategoryIds: formData.getAll("targetCategoryIds"),
    targetTags: normalizedTargetTags,
    targetGender: formData.get("targetGender"),
    minFollowers: Number(formData.get("minFollowers")) || 0,
    targetPlatformIds: formData.getAll("targetPlatformIds"),
    participantCap: Number(formData.get("participantCap")) || 0,
  };
}

async function mutateAndRefresh(url, payload, successMessage, options = {}) {
  try {
    await api(url, {
      method: "POST",
      body: payload instanceof FormData ? payload : JSON.stringify(payload),
    });
    await loadBootstrap();
    if (state.currentPage === "campaign-view" && state.selectedCampaignId) {
      const codePayload = await api(`/api/campaigns/${state.selectedCampaignId}/codes`).catch(() => null);
      if (codePayload) state.campaignCodesByCampaign[state.selectedCampaignId] = codePayload.codes;
    }
    flash(successMessage, "success");
  } catch (error) {
    if (options.rethrow) throw error;
    flash(error.message, "error");
  }
}
