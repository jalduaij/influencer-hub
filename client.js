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
      residentialCountry: "",
      residentialTier2Id: "",
      residentialTier3Id: "",
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
  publicData: {
    cities: [],
    categories: [],
    platforms: [],
    tags: [],
    showUatPanel: false,
    addressReference: {
      countries: [],
      kuwait: { governorates: [], areas: [] },
      saudiArabia: { regions: [], cities: [], districts: [] },
    },
  },
  flash: null,
  currentPage: null,
  navStack: [],
  navStackMaxSize: 50,
  mobileNavOpen: false,
  selectedCampaignId: null,
  selectedBranchId: null,
  selectedInfluencerId: null,
  selectedManagerId: null,
  selectedJournalEntryId: null,
  influencerProfileReturnPage: null,
  campaignCodesByCampaign: {},
  manualReserveCodeId: null,
  authMode: "login",
  signupDraft: null,
  signupAddressExpanded: false,
  generatedLink: "",
  resetToken: new URLSearchParams(window.location.search).get("resetToken") || "",
  pendingCampaignDeeplink: null,
  justNavigatedToCampaigns: false,
  targetActiveParticipantId: null,
  reportTab: "campaigns",
  reportSorts: defaultReportSorts(),
  influencerFilters: {
    query: "",
    residentialCountry: "",
    residentialTier2Id: "",
    residentialTier3Id: "",
    categoryId: "",
    status: "",
    tag: "",
  },
  reportFilters: defaultReportFilters(),
  campaignSearch: "",
  apiInflightCount: 0,
  passwordEditorUserId: null,
  rejectingCampaignId: null,
  codeCardParticipantId: null,
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
  shippingAddressEditorOpen: false,
  shippingAddressDraft: null,
  shippingAddressPickerOpen: "",
  shippingAddressPickerQueries: {},
  adminAddressCards: {},
};

const app = document.getElementById("app");
let pendingNavScrollY = null;
let codeCardLogoDataUrlPromise = null;

const QR_CODE_CARD = Object.freeze({
  version: 5,
  size: 37,
  dataCodewords: 108,
  ecCodewords: 26,
  maxBytes: 106,
  alignmentCenters: [6, 30],
  formatInfo: 0x77c4,
});

initialize();

async function initialize() {
  bindGlobalEvents();
  const campaignParam = Number(new URLSearchParams(window.location.search).get("campaign"));
  if (campaignParam) {
    state.pendingCampaignDeeplink = campaignParam;
    window.history.replaceState({}, "", window.location.pathname);
  }
  state.publicData = await api("/api/public-metadata").catch(() => ({
    cities: [],
    categories: [],
    platforms: [],
    tags: [],
    showUatPanel: false,
    addressReference: {
      countries: [],
      kuwait: { governorates: [], areas: [] },
      saudiArabia: { regions: [], cities: [], districts: [] },
    },
  }));
  const session = await api("/api/session").catch(() => ({ authenticated: false }));
  if (session.authenticated) {
    state.currentUser = session.user;
    state.navStack = [];
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

const ADDRESS_OTHER_VALUE = "__OTHER__";
const SIGNUP_ADDRESS_GEO_FIELDS = Object.freeze([
  "country",
  "governorateId",
  "regionId",
  "cityId",
  "cityOther",
  "areaId",
  "districtId",
  "districtOther",
]);
const SIGNUP_ADDRESS_FIELDS = Object.freeze([
  "country",
  "governorateId",
  "regionId",
  "cityId",
  "cityOther",
  "areaId",
  "districtId",
  "districtOther",
  "block",
  "street",
  "buildingNumber",
  "floor",
  "apartmentNumber",
  "paciNumber",
  "postalCode",
  "additionalNumber",
  "landmark",
]);
const SIGNUP_FORM_FIELDS = Object.freeze([
  "fullName",
  "email",
  "password",
  "mobile",
  "gender",
  "residentialCountry",
  "residentialTier2Id",
  "residentialTier3Id",
  "categoryIds",
  "instagram",
  "instagramFollowers",
  "tiktok",
  "tiktokFollowers",
  "snapchat",
  "snapchatFollowers",
  "preferredPlatform",
  "termsAccepted",
]);
const EMPTY_ADDRESS_REFERENCE = Object.freeze({
  countries: [],
  kuwait: { governorates: [], areas: [] },
  saudiArabia: { regions: [], cities: [], districts: [] },
});

function addressReference() {
  return state.publicData?.addressReference || EMPTY_ADDRESS_REFERENCE;
}

function addressLocalizedName(row) {
  if (!row) return "";
  return state.locale === "ar" ? row.nameAr || row.nameEn || "" : row.nameEn || row.nameAr || "";
}

function addressCountryRow(code) {
  return (addressReference().countries || []).find((country) => country.code === String(code || "").toUpperCase()) || null;
}

function addressCountryName(code) {
  return addressLocalizedName(addressCountryRow(code)) || code || l("Not set", "غير محدد");
}

function addressCountryFlag(code) {
  if (String(code || "").toUpperCase() === "KW") return "🇰🇼";
  if (String(code || "").toUpperCase() === "SA") return "🇸🇦";
  return "📦";
}

function emptyResidential() {
  return {
    country: "",
    governorateId: "",
    regionId: "",
    areaId: "",
    cityId: "",
  };
}

function residentialTier2Label(country) {
  if (country === "KW") return l("Governorate", "المحافظة");
  if (country === "SA") return l("Region", "المنطقة");
  return l("Governorate / Region", "المحافظة / المنطقة");
}

function residentialTier3Label(country) {
  if (country === "KW") return l("City", "المدينة");
  if (country === "SA") return l("City", "المدينة");
  return l("City", "المدينة");
}

function normalizeResidential(value) {
  return {
    ...emptyResidential(),
    ...(value || {}),
  };
}

function residentialSelectionFromValue(value) {
  const residential = normalizeResidential(value);
  return {
    residentialCountry: residential.country || "",
    residentialTier2Id: residential.governorateId || residential.regionId || "",
    residentialTier3Id: residential.areaId || residential.cityId || "",
  };
}

function residentialFromSelection(selection) {
  const country = String(selection?.residentialCountry || "").toUpperCase();
  const tier2Id = String(selection?.residentialTier2Id || "");
  const tier3Id = String(selection?.residentialTier3Id || "");
  if (!country) return emptyResidential();
  if (country === "KW") {
    return {
      country,
      governorateId: tier2Id,
      regionId: "",
      areaId: tier3Id,
      cityId: "",
    };
  }
  return {
    country,
    governorateId: "",
    regionId: tier2Id,
    areaId: "",
    cityId: tier3Id,
  };
}

function residentialCountryValue(residential) {
  return String(residential?.country || "").toUpperCase();
}

function residentialTier2Id(residential) {
  return String(residential?.governorateId || residential?.regionId || "");
}

function residentialTier3Id(residential) {
  return String(residential?.areaId || residential?.cityId || "");
}

function residentialTier2Row(residential) {
  const country = residentialCountryValue(residential);
  if (country === "KW") return addressRowById(kuwaitGovernorates(), residential?.governorateId);
  if (country === "SA") return addressRowById(saudiRegions(), residential?.regionId);
  return null;
}

function residentialTier3Row(residential) {
  const country = residentialCountryValue(residential);
  if (country === "KW") return addressRowById(addressReference().kuwait?.areas || [], residential?.areaId);
  if (country === "SA") return addressRowById(addressReference().saudiArabia?.cities || [], residential?.cityId);
  return null;
}

function residentialTier2Name(residential) {
  return addressLocalizedName(residentialTier2Row(residential)) || l("Not set", "غير محدد");
}

function residentialTier3Name(residential) {
  return addressLocalizedName(residentialTier3Row(residential)) || l("Not set", "غير محدد");
}

function residentialSummary(residential, options = {}) {
  const value = normalizeResidential(residential);
  if (!value.country) return options.fallback || l("Not set", "غير محدد");
  const parts = [
    options.includeCountry === false ? "" : `${addressCountryFlag(value.country)} ${addressCountryName(value.country)}`,
    residentialTier2Name(value),
    residentialTier3Name(value),
  ].filter(Boolean);
  return parts.join(" · ");
}

function residentialMatchesFilters(residential, filters) {
  const country = residentialCountryValue(residential);
  const tier2 = residentialTier2Id(residential);
  const tier3 = residentialTier3Id(residential);
  if (filters.residentialCountry && filters.residentialCountry !== country) return false;
  if (filters.residentialTier2Id && filters.residentialTier2Id !== tier2) return false;
  if (filters.residentialTier3Id && filters.residentialTier3Id !== tier3) return false;
  return true;
}

function residentialTier2Options(country) {
  if (country === "KW") return kuwaitGovernorates();
  if (country === "SA") return saudiRegions();
  return [];
}

function residentialTier3Options(country, tier2Id) {
  if (!tier2Id) return [];
  if (country === "KW") return kuwaitAreas(tier2Id);
  if (country === "SA") return saudiCities(tier2Id);
  return [];
}

function emptyShippingAddressDraft() {
  return {
    country: "",
    governorateId: "",
    regionId: "",
    cityId: "",
    cityOther: "",
    areaId: "",
    districtId: "",
    districtOther: "",
    block: "",
    street: "",
    buildingNumber: "",
    floor: "",
    apartmentNumber: "",
    paciNumber: "",
    postalCode: "",
    additionalNumber: "",
    landmark: "",
    updatedAt: "",
  };
}

function emptySignupDraft() {
  return {
    fullName: "",
    email: "",
    password: "",
    mobile: "",
    gender: "",
    residentialCountry: "",
    residentialTier2Id: "",
    residentialTier3Id: "",
    categoryIds: [],
    instagram: "",
    instagramFollowers: "0",
    tiktok: "",
    tiktokFollowers: "0",
    snapchat: "",
    snapchatFollowers: "0",
    preferredPlatform: "",
    termsAccepted: false,
  };
}

function signupDraftValue() {
  return {
    ...emptySignupDraft(),
    ...(state.signupDraft || {}),
  };
}

function signupResidentialValue() {
  return residentialFromSelection(signupDraftValue());
}

function shippingAddressSeedFromResidential(residential) {
  const value = normalizeResidential(residential);
  if (!value.country) return null;
  return {
    country: value.country,
    governorateId: value.governorateId || "",
    regionId: value.regionId || "",
    cityId: value.cityId || "",
    areaId: value.areaId || "",
  };
}

function shippingAddressDraftFrom(address, seed = null) {
  const draft = {
    ...emptyShippingAddressDraft(),
    ...(shippingAddressSeedFromResidential(seed) || {}),
    ...(address || {}),
  };
  if (draft.country === "SA" && !draft.cityId && draft.cityOther) draft.cityId = ADDRESS_OTHER_VALUE;
  if (draft.country === "SA" && !draft.districtId && draft.districtOther) draft.districtId = ADDRESS_OTHER_VALUE;
  return draft;
}

function currentShippingAddress() {
  const user = editableProfileUser();
  if (!user) return null;
  if (isAdminMemberEditPage()) {
    return shippingAddressStateForUser(user).address || null;
  }
  return user.address || null;
}

function clearShippingAddressComposer() {
  state.shippingAddressDraft = null;
  state.shippingAddressPickerOpen = "";
  state.shippingAddressPickerQueries = {};
}

function openShippingAddressEditor(address = currentShippingAddress()) {
  const user = editableProfileUser();
  state.shippingAddressEditorOpen = true;
  state.shippingAddressDraft = shippingAddressDraftFrom(address, user?.residential || null);
  state.shippingAddressPickerOpen = "";
  state.shippingAddressPickerQueries = {};
}

function closeShippingAddressEditor() {
  state.shippingAddressEditorOpen = false;
  clearShippingAddressComposer();
}

function openSignupAddressSection() {
  state.signupAddressExpanded = true;
  state.shippingAddressDraft = shippingAddressDraftFrom(null, signupResidentialValue());
  state.shippingAddressPickerOpen = "";
  state.shippingAddressPickerQueries = {};
}

function closeSignupAddressSection({ clearDraft = true } = {}) {
  state.signupAddressExpanded = false;
  state.shippingAddressPickerOpen = "";
  state.shippingAddressPickerQueries = {};
  if (clearDraft) {
    state.shippingAddressDraft = null;
  }
}

function resetSignupAddressState() {
  state.signupAddressExpanded = false;
  clearShippingAddressComposer();
}

function shippingAddressDraftValue() {
  return state.shippingAddressDraft || shippingAddressDraftFrom(currentShippingAddress());
}

function isAddressOtherSelection(value) {
  return value === ADDRESS_OTHER_VALUE;
}

function normalizedShippingAddressPayload(draft) {
  if (!draft) return null;
  const payload = { ...draft };
  if (payload.cityId === ADDRESS_OTHER_VALUE) payload.cityId = "";
  if (payload.districtId === ADDRESS_OTHER_VALUE) payload.districtId = "";
  delete payload.updatedAt;
  return payload;
}

function shippingAddressHasSignupInput(draft) {
  return SIGNUP_ADDRESS_GEO_FIELDS.some((field) => String(draft?.[field] || "").trim());
}

function pickSignupAddressPayload() {
  if (!state.signupAddressExpanded) return null;
  const draft = normalizedShippingAddressPayload(shippingAddressDraftValue());
  return shippingAddressHasSignupInput(draft) ? draft : null;
}

function isShippingAddressFieldName(name) {
  return SIGNUP_ADDRESS_FIELDS.includes(name);
}

function isSignupFieldName(name) {
  return SIGNUP_FORM_FIELDS.includes(name);
}

function isResidentialFieldName(name) {
  return ["residentialCountry", "residentialTier2Id", "residentialTier3Id"].includes(name);
}

function syncSignupCategoryDraftFromForm(form) {
  if (!form) return;
  updateSignupDraft("categoryIds", selectedCategoryIdsFromForm(form));
}

function syncSignupResidentialDraftFromForm(form) {
  if (!form) return;
  updateSignupDraft("residentialCountry", form.residentialCountry?.value || "");
  updateSignupDraft("residentialTier2Id", form.residentialTier2Id?.value || "");
  updateSignupDraft("residentialTier3Id", form.residentialTier3Id?.value || "");
}

function updateSignupDraft(name, rawValue) {
  if (!isSignupFieldName(name)) return;
  const next = signupDraftValue();
  if (name === "categoryIds") {
    next[name] = normalizeCategoryIds(rawValue);
  } else if (name === "termsAccepted") {
    next[name] = rawValue === true;
  } else {
    const value = typeof rawValue === "string" ? rawValue : String(rawValue ?? "");
    next[name] = value;
  }
  if (name === "residentialCountry") {
    next.residentialTier2Id = "";
    next.residentialTier3Id = "";
  }
  if (name === "residentialTier2Id") {
    next.residentialTier3Id = "";
  }
  state.signupDraft = next;
}

function updateShippingAddressDraft(name, rawValue) {
  const draft = shippingAddressDraftValue();
  const value = typeof rawValue === "string" ? rawValue : String(rawValue ?? "");
  draft[name] = value;

  if (name === "country") {
    if (value === "KW") {
      draft.regionId = "";
      draft.cityId = "";
      draft.cityOther = "";
      draft.districtId = "";
      draft.districtOther = "";
      draft.postalCode = "";
      draft.additionalNumber = "";
    }
    if (value === "SA") {
      draft.governorateId = "";
      draft.areaId = "";
      draft.block = "";
      draft.paciNumber = "";
    }
    if (!value) {
      Object.assign(draft, emptyShippingAddressDraft());
    }
  }

  if (name === "governorateId") {
    draft.areaId = "";
  }
  if (name === "regionId") {
    draft.cityId = "";
    draft.cityOther = "";
    draft.districtId = "";
    draft.districtOther = "";
  }
  if (name === "cityId") {
    if (!isAddressOtherSelection(value)) draft.cityOther = "";
    draft.districtId = "";
    draft.districtOther = "";
  }
  if (name === "districtId" && !isAddressOtherSelection(value)) {
    draft.districtOther = "";
  }
  if (name === "paciNumber") draft.paciNumber = value.replace(/\D/g, "").slice(0, 8);
  if (name === "postalCode") draft.postalCode = value.replace(/\D/g, "").slice(0, 5);
  if (name === "additionalNumber") draft.additionalNumber = value.replace(/\D/g, "").slice(0, 4);

  state.shippingAddressDraft = draft;
}

function kuwaitGovernorates() {
  return addressReference().kuwait?.governorates || [];
}

function kuwaitAreas(governorateId) {
  return (addressReference().kuwait?.areas || []).filter((area) => area.governorateId === governorateId);
}

function saudiRegions() {
  return addressReference().saudiArabia?.regions || [];
}

function saudiCities(regionId) {
  return (addressReference().saudiArabia?.cities || []).filter((city) => city.regionId === regionId);
}

function saudiDistricts(cityId) {
  return (addressReference().saudiArabia?.districts || []).filter((district) => district.cityId === cityId);
}

function addressRowById(collection, id) {
  return (collection || []).find((row) => row.id === id) || null;
}

function addressSearchQuery(field) {
  return state.shippingAddressPickerQueries[field] || "";
}

function setAddressSearchQuery(field, query) {
  state.shippingAddressPickerQueries = {
    ...state.shippingAddressPickerQueries,
    [field]: query,
  };
}

function clearAddressSearchQuery(field) {
  if (!state.shippingAddressPickerQueries[field]) return;
  const next = { ...state.shippingAddressPickerQueries };
  delete next[field];
  state.shippingAddressPickerQueries = next;
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
  return l("Member", "عضو");
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
    return new Set(["dashboard", "influencers", "influencer-profile", "admin-edit-member", "campaigns", "campaign-edit", "campaign-view", "branches", "branch-edit", "master-data", "managers", "manager-edit", "journal", "reports", "profile"]);
  }
  if (role === "campaign_manager") {
    return new Set(["dashboard", "influencers", "influencer-profile", "admin-edit-member", "campaigns", "campaign-edit", "campaign-view", "journal", "reports", "profile"]);
  }
  return new Set(["dashboard", "campaigns", "campaign-preview", "profile"]);
}

function normalizePage(page) {
  if (!state.currentUser) return "dashboard";
  if (page === "approvals") return "influencers";
  if ((page === "availableCampaigns" || page === "myCampaigns") && state.currentUser.role === "influencer") return "campaigns";
  return validPagesForRole(state.currentUser.role).has(page) ? page : defaultPageForRole(state.currentUser.role);
}

const NAV_TRACKED_FIELDS = [
  "currentPage",
  "selectedCampaignId",
  "selectedInfluencerId",
  "selectedManagerId",
  "selectedBranchId",
  "selectedJournalEntryId",
  "targetActiveParticipantId",
  "influencerProfileReturnPage",
];

function captureNavSnapshot() {
  const snapshot = {
    params: {},
    scrollY: typeof window !== "undefined" ? window.scrollY : 0,
    title: state.currentUser ? currentDocumentTitle() : "PICK Social Club",
  };
  for (const field of NAV_TRACKED_FIELDS) {
    if (state[field] !== undefined) snapshot.params[field] = state[field];
  }
  return snapshot;
}

function cloneNavSnapshot(snapshot) {
  return {
    params: { ...(snapshot?.params || {}) },
    scrollY: snapshot?.scrollY ?? 0,
    title: snapshot?.title || "",
  };
}

function cloneNavStack(stack) {
  return Array.isArray(stack) ? stack.map((snapshot) => cloneNavSnapshot(snapshot)) : [];
}

function applyNavSnapshot(snapshot) {
  for (const field of NAV_TRACKED_FIELDS) {
    state[field] = snapshot?.params?.[field] ?? null;
  }
  pendingNavScrollY = snapshot?.scrollY ?? 0;
}

function sameNavDestination(page, extraParams = {}) {
  if (page !== state.currentPage) return false;
  return Object.keys(extraParams).every((key) => state[key] === extraParams[key]);
}

function isProfileEditingPage(page) {
  return page === "profile" || page === "admin-edit-member";
}

function currentHistoryUrl() {
  const path = `${window.location.pathname}${window.location.search}`;
  return state.currentPage ? `${path}#${state.currentPage}` : path;
}

function buildBrowserHistoryState() {
  return {
    __pickNav: true,
    page: state.currentPage,
    navStackLen: state.navStack.length,
    navStack: cloneNavStack(state.navStack),
    snapshot: captureNavSnapshot(),
  };
}

function syncCurrentHistoryEntry() {
  try {
    window.history.replaceState(buildBrowserHistoryState(), "", currentHistoryUrl());
  } catch (error) {
    // ignore
  }
}

function pushBrowserHistory() {
  try {
    window.history.pushState(buildBrowserHistoryState(), "", currentHistoryUrl());
  } catch (error) {
    // ignore
  }
}

function navigateTo(page, extraParams = {}) {
  if (!state.currentUser || sameNavDestination(page, extraParams)) return false;
  syncCurrentHistoryEntry();
  state.navStack.push(captureNavSnapshot());
  if (state.navStack.length > state.navStackMaxSize) {
    state.navStack.shift();
  }

  state.currentPage = page;
  if (page !== "campaign-preview") state.rejectingCampaignId = null;
  if (!isProfileEditingPage(page)) closeShippingAddressEditor();
  state.codeCardParticipantId = null;
  for (const key of Object.keys(extraParams)) {
    state[key] = extraParams[key];
  }

  pushBrowserHistory();
  render();
  return true;
}

function goBack() {
  if (state.navStack.length) {
    try {
      window.history.back();
      return;
    } catch (error) {
      // fall through to manual restore
    }
    const previous = state.navStack.pop();
    applyNavSnapshot(previous);
    if (state.currentPage !== "campaign-preview") state.rejectingCampaignId = null;
    if (!isProfileEditingPage(state.currentPage)) closeShippingAddressEditor();
    state.codeCardParticipantId = null;
    pushBrowserHistory();
    render();
    return;
  }

  const fallback = defaultPageForRole(state.currentUser?.role);
  if (fallback && fallback !== state.currentPage) {
    syncCurrentHistoryEntry();
    state.currentPage = fallback;
    state.rejectingCampaignId = null;
    closeShippingAddressEditor();
    state.codeCardParticipantId = null;
    pushBrowserHistory();
    render();
  }
}

function renderBackButton() {
  if (!state.navStack.length) return "";
  return `
    <button class="back-button" data-action="go-back" aria-label="${escapeHtml(l("Back", "رجوع"))}">
      <svg class="back-button__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M15 18l-6-6 6-6"/>
      </svg>
      <span>${l("Back", "رجوع")}</span>
    </button>
  `;
}

function handlePopState(event) {
  if (!(event.state && event.state.__pickNav)) return;
  state.navStack = cloneNavStack(event.state.navStack);
  applyNavSnapshot(event.state.snapshot);
  if (state.currentPage !== "campaign-preview") state.rejectingCampaignId = null;
  if (!isProfileEditingPage(state.currentPage)) closeShippingAddressEditor();
  state.codeCardParticipantId = null;
  render();
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
    { match: "residential_required", fields: ["residentialCountry", "residentialTier2Id", "residentialTier3Id"] },
    { match: "invalid_country", fields: ["residentialCountry"] },
    { match: "invalid_governorate", fields: ["residentialTier2Id"] },
    { match: "invalid_region", fields: ["residentialTier2Id"] },
    { match: "invalid_area", fields: ["residentialTier3Id"] },
    { match: "area_required", fields: ["residentialTier3Id"] },
    { match: "invalid_city", fields: ["residentialTier3Id"] },
    { match: "city_required", fields: ["residentialTier3Id"] },
    { match: "area_governorate_mismatch", fields: ["residentialTier2Id", "residentialTier3Id"] },
    { match: "city_region_mismatch", fields: ["residentialTier2Id", "residentialTier3Id"] },
    { match: "category_required", fields: ["categoryIds"] },
    { match: "invalid_category", fields: ["categoryIds"] },
    { match: "terms_acceptance_required", fields: ["termsAccepted"] },
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

function localDateString(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function normalizeCategoryIds(value) {
  const source = Array.isArray(value) ? value : value == null || value === "" ? [] : [value];
  return [...new Set(
    source
      .map((item) => Number(item))
      .filter((item) => item > 0)
  )];
}

function categoryNames(categoryIds) {
  return normalizeCategoryIds(categoryIds)
    .map((categoryId) => categoryName(categoryId))
    .filter((label) => label && label !== "-");
}

function categorySummary(categoryIds, options = {}) {
  const { compact = false } = options;
  const labels = categoryNames(categoryIds);
  if (!labels.length) return l("Not set", "غير محدد");
  if (!compact || labels.length <= 2) return labels.join(", ");
  return `${labels[0]} + ${labels.length - 1} ${l("more", "أخرى")}`;
}

function includesCategory(categoryIds, categoryId) {
  const wanted = Number(categoryId);
  if (!wanted) return false;
  return normalizeCategoryIds(categoryIds).includes(wanted);
}

function selectedCategoryIdsFromForm(form) {
  return normalizeCategoryIds(new FormData(form).getAll("categoryIds"));
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

function journalTitle(entry) {
  if (state.locale === "ar") return entry?.titleAr || entry?.titleEn || "";
  return entry?.titleEn || entry?.titleAr || "";
}

function journalBody(entry) {
  if (state.locale === "ar") return entry?.bodyAr || entry?.bodyEn || "";
  return entry?.bodyEn || entry?.bodyAr || "";
}

function journalStatusLabel(status) {
  if (status === "published") return l("Published", "منشور");
  if (status === "draft") return l("Draft", "مسودة");
  if (status === "deleted") return l("Deleted", "محذوف");
  return status || "-";
}

function journalStatusTone(status) {
  if (status === "published") return "success";
  if (status === "draft") return "warning";
  if (status === "deleted") return "danger";
  return "";
}

function canManageJournalEntryClient(entry) {
  return Boolean(
    state.currentUser?.role === "admin" ||
    (state.currentUser?.role === "campaign_manager" && Number(entry?.authorUserId) === Number(state.currentUser?.id))
  );
}

function currentCampaigns() {
  return state.data?.campaigns || [];
}

function renderDeskRail(participants) {
  if (!participants.length) return "";

  const tiles = participants
    .map((participant) => {
      const campaign = currentCampaigns().find((item) => item.id === participant.campaignId);
      if (!campaign) return "";
      return `
        <a class="desk-tile" data-action="open-active" data-participant-id="${participant.id}" href="#campaigns-active">
          <div class="desk-tile__head">
            <span class="desk-tile__title">${escapeHtml(campaignTitle(campaign))}</span>
          </div>
          <div class="desk-tile__code">
            <span class="desk-tile__code-label">${escapeHtml(l("Reserved", "محجوز"))}</span>
            <span class="desk-tile__code-value">${escapeHtml(l("Tap Save to show QR", "اضغط حفظ لإظهار QR"))}</span>
          </div>
          <div class="desk-tile__footer">
            <span class="desk-tile__deadline">
              ${l("BY", "قبل")} ${formatDate(campaign.submissionDeadline)}
            </span>
            <span class="desk-tile__actions">
              ${renderSaveCodeButton(participant, l("Save", "احفظ"), "desk-tile__save")}
              <span class="desk-tile__cta">${l("Submit", "أرسل")} ${state.locale === "ar" ? "←" : "→"}</span>
            </span>
          </div>
        </a>
      `;
    })
    .join("");

  return `
    <section class="block block--brand desk-block" id="dashboard-desk">
      <header class="desk-title">
        <span class="kicker">${escapeHtml(l("ON YOUR DESK", "في انتظارك"))}</span>
        <h2 class="desk-title__line">
          <span class="desk-title__count">${participants.length}</span>
          <span class="desk-title__label">${escapeHtml(
            participants.length === 1 ? l("reserved code", "كود محجوز") : l("reserved codes", "أكواد محجوزة")
          )}</span>
        </h2>
      </header>
      <hr class="rule rule--hair">
      <div class="desk-rail">
        ${tiles}
      </div>
    </section>
  `;
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
  const list = state.data?.participants || [];
  const id = Number(campaignId);
  const active = list
    .filter((participant) => participant.campaignId === id && participant.status !== "canceled")
    .sort((left, right) => {
      const leftTime = new Date(left.joinedAt || 0).getTime();
      const rightTime = new Date(right.joinedAt || 0).getTime();
      return rightTime - leftTime;
    });
  return active[0] || null;
}

function shouldShowConfirmInterest(participant, isEligible) {
  if (!isEligible) return false;
  if (!participant) return true;
  return participant.status === "canceled";
}

function campaignWasDeclined(campaignId) {
  return (state.data?.declinedCampaignIds || []).includes(Number(campaignId));
}

function findCampaignForParticipant(participant) {
  if (!participant) return null;
  return currentCampaigns().find((campaign) => campaign.id === Number(participant.campaignId)) || null;
}

function participantHasWallet(participant) {
  return Boolean(participant?.verificationUrl && participant?.verificationRef);
}

function renderSaveCodeButton(participant, label = l("Save my code", "احفظ كودي"), className = "save-code-btn") {
  if (!participantHasWallet(participant)) return "";
  return `
    <button class="${className}" data-action="open-code-card" data-participant-id="${participant.id}">
      ${escapeHtml(label)}
    </button>
  `;
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
  if (campaign.visitDeadline && localDateString(campaign.visitDeadline) < localDateString()) return false;
  if (influencer.status !== "active") return false;
  const residential = influencer.residential || {};
  if ((campaign.targetCountries || []).length && !(campaign.targetCountries || []).includes(residentialCountryValue(residential))) return false;
  if ((campaign.targetGovernorateIds || []).length && !(campaign.targetGovernorateIds || []).includes(residentialTier2Id(residential))) return false;
  if ((campaign.targetCityIds || []).length && !(campaign.targetCityIds || []).includes(residentialTier3Id(residential))) return false;
  if ((campaign.targetCategoryIds || []).length) {
    const hasOverlap = normalizeCategoryIds(influencer.categoryIds).some((id) => (campaign.targetCategoryIds || []).includes(id));
    if (!hasOverlap) return false;
  }
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

function renderNotificationsBell() {
  const items = notificationCards();
  return `
    <details class="notification-bell">
      <summary class="notification-bell__summary" aria-label="${escapeHtml(l("Open notifications", "فتح الإشعارات"))}">
        <span class="notification-bell__icon" aria-hidden="true">🔔</span>
        <span class="notification-bell__count">${items.length}</span>
      </summary>
      <div class="notification-bell__panel">
        <strong>${escapeHtml(l("Notifications", "الإشعارات"))}</strong>
        ${
          items.length
            ? items
                .slice(0, 4)
                .map(
                  (item) => `
                    <article class="notification-bell__item">
                      <span class="eyebrow">${escapeHtml(localizedCopy(item.title))}</span>
                      <p>${escapeHtml(localizedCopy(item.body))}</p>
                    </article>
                  `
                )
                .join("")
            : `<p class="compact">${escapeHtml(l("No notifications yet.", "لا توجد إشعارات بعد."))}</p>`
        }
      </div>
    </details>
  `;
}

function updateNotificationPanelPosition() {
  const bell = document.querySelector(".notification-bell");
  const panel = document.querySelector(".notification-bell__panel");
  if (!bell || !panel || !bell.open) return;
  const rect = bell.getBoundingClientRect();
  const isRtl = document.body.classList.contains("rtl");
  const topPx = Math.round(rect.bottom + 8);
  document.documentElement.style.setProperty("--notif-top", `${topPx}px`);
  if (isRtl) {
    const startPx = Math.round(rect.left);
    document.documentElement.style.setProperty("--notif-start", `${startPx}px`);
    document.documentElement.style.setProperty("--notif-end", "auto");
    return;
  }
  const endPx = Math.round(window.innerWidth - rect.right);
  document.documentElement.style.setProperty("--notif-end", `${endPx}px`);
  document.documentElement.style.setProperty("--notif-start", "auto");
}

function attachNotificationPanelTracking() {
  window.addEventListener("scroll", updateNotificationPanelPosition, { passive: true });
  window.addEventListener("resize", updateNotificationPanelPosition);
}

function setupNotificationToggleListener() {
  document.addEventListener(
    "toggle",
    (event) => {
      const target = event.target;
      if (!target?.classList?.contains("notification-bell") || !target.open) return;
      updateNotificationPanelPosition();
    },
    true
  );
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
    "participant.visit_confirmed": l("Confirmed branch visit", "أكد زيارة الفرع"),
    "participant.submission": l("Submitted proof", "أرسل الإثبات"),
    "branch.pin_rotated": l("Rotated branch PIN", "غيّر رمز الفرع"),
    residential_updated: l("Updated residential location", "حدّث مكان السكن"),
    categories_updated: l("Updated interested categories", "حدّث الفئات المهتمة"),
    campaign_targeting_reset: l("Reset campaign targeting", "أعاد ضبط استهداف الحملة"),
    address_updated: l("Updated shipping address", "حدّث عنوان الشحن"),
    address_rejected: l("Rejected shipping address at signup", "رفض عنوان الشحن أثناء التسجيل"),
    address_cleared: l("Cleared shipping address", "حذف عنوان الشحن"),
    address_viewed: l("Viewed shipping address", "عرض عنوان الشحن"),
    profile_updated_by_admin: l("Updated member profile", "حدّث ملف العضو"),
    terms_accepted: l("Accepted Terms & Conditions", "وافق على الشروط والأحكام"),
    terms_updated: l("Updated Terms & Conditions", "حدّث الشروط والأحكام"),
    "journal.created": l("Created journal entry", "أنشأ منشوراً"),
    "journal.updated": l("Updated journal entry", "حدّث منشوراً"),
    "journal.deleted": l("Deleted journal entry", "حذف منشوراً"),
    "journal.published": l("Published journal entry", "نشر منشوراً"),
    "journal.unpublished": l("Unpublished journal entry", "ألغى نشر منشور"),
    "admin.uat_data_seeded": l("Reset UAT data", "أعاد ضبط بيانات UAT"),
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
  if (event.targetType === "journalEntry") {
    const entry = (state.data?.journalEntries || []).find((item) => item.id === Number(event.targetId));
    return entry ? journalTitle(entry) : `${l("Journal entry", "منشور")} #${event.targetId}`;
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
    viewerRole: l("Viewer role", "دور العارض"),
    editedByRole: l("Edited by role", "تم التعديل بواسطة"),
    fieldsChanged: l("Fields", "الحقول"),
    version: l("Version", "الإصدار"),
    contentHash: l("Content hash", "بصمة المحتوى"),
    oldVersion: l("Old version", "الإصدار السابق"),
    newVersion: l("New version", "الإصدار الجديد"),
    oldHash: l("Old hash", "البصمة السابقة"),
    newHash: l("New hash", "البصمة الجديدة"),
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
        residential: influencer?.residential || null,
        categoryIds: influencer?.categoryIds || [],
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
        residential: influencer.residential || null,
        categoryIds: influencer.categoryIds || [],
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
  if (tab === "influencers") return l("Members", "الأعضاء");
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
    if (filters.query) entries.push({ label: l("Member", "العضو"), value: filters.query });
    if (filters.residentialCountry) entries.push({ label: l("Country", "الدولة"), value: addressCountryName(filters.residentialCountry) });
    if (filters.residentialTier2Id) entries.push({ label: residentialTier2Label(filters.residentialCountry), value: residentialTier2Name(residentialFromSelection(filters)) });
    if (filters.residentialTier3Id) entries.push({ label: residentialTier3Label(filters.residentialCountry), value: residentialTier3Name(residentialFromSelection(filters)) });
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
      if (influencer) entries.push({ label: l("Member", "العضو"), value: influencer.fullName });
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
  const previousRole = state.currentUser?.role || null;
  state.data = await api("/api/bootstrap");
  state.currentUser = state.data.currentUser;
  state.adminAddressCards = {};
  if (previousRole && previousRole !== state.currentUser?.role) {
    state.navStack = [];
  }
  if (
    state.selectedJournalEntryId &&
    !(state.data?.journalEntries || []).some((entry) => entry.id === Number(state.selectedJournalEntryId))
  ) {
    state.selectedJournalEntryId = null;
  }
  if (
    state.codeCardParticipantId &&
    !(state.data?.participants || []).some((participant) => participant.id === Number(state.codeCardParticipantId))
  ) {
    state.codeCardParticipantId = null;
  }
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

function applyMemberScope() {
  const isMember = (state.currentUser?.role || "") === "influencer";
  document.body.classList.toggle("member-scope", isMember);
}

function render(options = {}) {
  const focusSnapshot = options.preserveFocus ? captureFocusedField() : null;
  let deferHistorySync = false;
  document.body.classList.toggle("rtl", state.locale === "ar");
  applyMemberScope();
  if (!state.currentUser) {
    document.body.classList.toggle("nav-locked", false);
    document.body.classList.toggle("mobile-nav-locked", false);
    document.title = "PICK Social Club";
    app.innerHTML = renderAuth();
    syncFlashLayer();
    syncCurrentHistoryEntry();
    if (focusSnapshot) requestAnimationFrame(() => restoreFocusedField(focusSnapshot));
    return;
  }
  document.title = currentDocumentTitle();
  app.innerHTML = renderShell();
  document.body.classList.toggle("nav-locked", state.mobileNavOpen || Boolean(state.codeCardParticipantId));
  document.body.classList.toggle("mobile-nav-locked", state.mobileNavOpen);
  if (state.currentPage === "campaigns" && state.justNavigatedToCampaigns) {
    deferHistorySync = true;
    scrollToActiveCampaigns();
    focusFirstActionableSubmission();
    state.justNavigatedToCampaigns = false;
    state.targetActiveParticipantId = null;
    setTimeout(() => syncCurrentHistoryEntry(), 120);
  }
  if (pendingNavScrollY != null) {
    deferHistorySync = true;
    const nextScrollY = pendingNavScrollY;
    pendingNavScrollY = null;
    setTimeout(() => {
      window.scrollTo({ top: nextScrollY, behavior: "auto" });
      syncCurrentHistoryEntry();
    }, 30);
  }
  syncFlashLayer();
  setTimeout(renderPendingQrCodes, 20);
  setTimeout(() => {
    document.querySelectorAll("[data-residential-form]").forEach((container) => syncResidentialCascadeForm(container));
    document.querySelectorAll("[data-campaign-targeting-form]").forEach((form) => syncCampaignTargetingForm(form));
  }, 20);
  if (!deferHistorySync) syncCurrentHistoryEntry();
  if (focusSnapshot) requestAnimationFrame(() => restoreFocusedField(focusSnapshot));
}

function currentDocumentTitle() {
  const pageTitles = {
    dashboard:
      state.currentUser?.role === "influencer"
        ? l("PICK Social Club — Member Dashboard", "نادي بك — لوحة العضو")
        : l("PICK Social Club — Dashboard", "نادي بك — لوحة التحكم"),
    influencers: l("PICK Social Club — Members", "نادي بك — الأعضاء"),
    "influencer-profile": l("PICK Social Club — Member Profile", "نادي بك — ملف العضو"),
    "admin-edit-member": l("PICK Social Club — Edit Member", "نادي بك — تعديل العضو"),
    campaigns: l("PICK Social Club — Campaigns", "نادي بك — الحملات"),
    "campaign-edit": l("PICK Social Club — Edit Campaign", "نادي بك — تعديل الحملة"),
    "campaign-view": l("PICK Social Club — Campaign View", "نادي بك — عرض الحملة"),
    "campaign-preview": l("PICK Social Club — Campaign Preview", "نادي بك — معاينة الحملة"),
    branches: l("PICK Social Club — Branches", "نادي بك — الأفرع"),
    "branch-edit": l("PICK Social Club — Branch", "نادي بك — الفرع"),
    "master-data": l("PICK Social Club — Master Data", "نادي بك — البيانات الأساسية"),
    managers: l("PICK Social Club — Managers", "نادي بك — مديرو الحملات"),
    "manager-edit": l("PICK Social Club — Manager", "نادي بك — مدير الحملات"),
    journal: l("PICK Social Club — Journal", "نادي بك — اليوميات"),
    reports: l("PICK Social Club — Reports", "نادي بك — التقارير"),
    profile: l("PICK Social Club — Profile", "نادي بك — الملف الشخصي"),
  };
  return pageTitles[state.currentPage] || "PICK Social Club";
}

function renderAuth() {
  const resetMode = state.authMode === "reset" || state.resetToken;
  const showUatPanel = Boolean(state.publicData?.showUatPanel);
  return `
    <div class="background-orb orb-one"></div>
    <div class="background-orb orb-two"></div>
    <div id="global-loading-bar" data-global-loading-bar class="${state.apiInflightCount > 0 ? "is-active" : ""}"></div>
    <div class="flash-layer" data-flash-layer></div>
    <section class="login-shell${showUatPanel ? "" : " login-shell--solo"}">
      <article class="login-card">
        <p class="eyebrow">PICK Internal</p>
        <h1>${l("PICK Social Club", "نادي بك")}</h1>
        <p class="login-copy">${l("Sign in or join the club. Welcome back 💜", "سجّل دخولك أو انضم للنادي. أهلاً بعودتك 💜")}</p>
        <div class="row-wrap" style="margin-bottom: 18px;">
          <button class="${state.authMode === "login" ? "" : "secondary"}" data-action="set-auth-mode" data-mode="login">${l("Sign In", "تسجيل الدخول")}</button>
          <button class="${state.authMode === "signup" ? "" : "secondary"}" data-action="set-auth-mode" data-mode="signup">${l("Become a Member", "كن عضواً")}</button>
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
      ${showUatPanel ? `
      <article class="login-sidecard">
        <p class="eyebrow">${l("UAT demo accounts", "حسابات الاختبار")}</p>
        <h2>${l("PICK Social Club", "نادي بك")}</h2>
        <p class="brand-copy">${l("Use any account below to test. Passwords are case-sensitive.", "استخدم أي حساب أدناه للاختبار. كلمات المرور حساسة لحالة الأحرف.")}</p>
        <p class="eyebrow" style="margin-top: 18px;">${l("Team", "الفريق")} · ${l("password", "كلمة المرور")} pick123</p>
        <div class="stack">
          <div class="list-card">
            <strong>Sara — ${l("Admin", "مسؤول")}</strong>
            <p>sara@pick.internal</p>
          </div>
          <div class="list-card">
            <strong>Nasser — ${l("Campaign Manager", "مدير حملات")}</strong>
            <p>nasser@pick.internal</p>
          </div>
          <div class="list-card">
            <strong>Jassem — ${l("Campaign Manager", "مدير حملات")}</strong>
            <p>jalduaij@kdigtc.com</p>
          </div>
        </div>
        <p class="eyebrow" style="margin-top: 18px;">${l("Members", "الأعضاء")} · ${l("password", "كلمة المرور")} member123</p>
        <div class="stack">
          <div class="list-card">
            <strong>Laila — ${l("everything-state Member", "عضو بكل الحالات")}</strong>
            <p>laila@example.com</p>
          </div>
          <div class="list-card">
            <strong>Maha — ${l("23k followers, VIP", "23 ألف متابع، VIP")}</strong>
            <p>maha@example.com</p>
          </div>
          <div class="list-card">
            <strong>Dana — ${l("47k beauty / VIP", "47 ألف بيوتي / VIP")}</strong>
            <p>dana@example.com</p>
          </div>
          <div class="list-card">
            <strong>Abdullah — ${l("18k, fitness, male", "18 ألف، رياضة، ذكر")}</strong>
            <p>abdullah@example.com</p>
          </div>
          <div class="list-card">
            <strong>Bader — ${l("incomplete profile (0 followers)", "ملف ناقص (0 متابع)")}</strong>
            <p>bader@example.com</p>
          </div>
          <div class="list-card">
            <strong>Youssef — ${l("tagged family", "موسوم family")}</strong>
            <p>youssef@example.com</p>
          </div>
          <div class="list-card">
            <strong>Nada — ${l("pending approval", "بانتظار الاعتماد")}</strong>
            <p>nada@example.com</p>
          </div>
          <div class="list-card">
            <strong>Maryam — ${l("suspended", "موقوفة")}</strong>
            <p>maryam@example.com</p>
          </div>
        </div>
      </article>
      ` : ""}
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
  const draft = signupDraftValue();
  return `
    <form id="signupForm" class="form-grid two-col">
      <label class="field"><span>${l("Full name", "الاسم الكامل")} <em class="required-mark">*</em></span><input name="fullName" required value="${escapeHtml(draft.fullName || "")}" /></label>
      <label class="field"><span>${l("Email", "البريد الإلكتروني")} <em class="required-mark">*</em></span><input name="email" type="email" required value="${escapeHtml(draft.email || "")}" /></label>
      ${renderPasswordField("password", { required: true, autocomplete: "new-password", hint: passwordRequirementHint(), label: l("Password", "كلمة المرور"), value: draft.password || "", minLength: 8 })}
      <label class="field"><span>${l("Mobile", "الهاتف")} <em class="required-mark">*</em></span>${renderKuwaitMobileField("mobile", draft.mobile || "", true)}</label>
      <label class="field"><span>${l("Gender", "الجنس")} <em class="required-mark">*</em></span>${renderGenderSelect("gender", draft.gender || "", true)}</label>
      <div class="field field-span-full signup-residential-block">
        <span>${l("Where do you live?", "أين تسكن؟")} <em class="required-mark">*</em></span>
        <p class="compact">${escapeHtml(l("Choose your country, governorate or region, and city so PICK can match you to nearby campaigns.", "اختر دولتك ومحافظتك أو منطقتك ومدينتك حتى يتمكن PICK من مطابقتك مع الحملات القريبة."))}</p>
        <div class="form-grid two-col signup-residential-block__grid">
          ${renderResidentialCascadeFields({
            prefix: "residential",
            value: signupResidentialValue(),
            required: true,
          })}
        </div>
      </div>
      ${renderCategoryChecklist({
        selectedValues: draft.categoryIds || [],
        required: true,
        hint: l(
          "Pick at least one. Used to match you to campaigns.",
          "اختر فئة واحدة على الأقل. تُستخدم لمطابقتك بالحملات."
        ),
      })}
      <label class="field"><span>Instagram <em class="required-mark">*</em></span><input name="instagram" required value="${escapeHtml(draft.instagram || "")}" /></label>
      <label class="field"><span>Instagram followers</span><input name="instagramFollowers" type="number" min="0" value="${escapeHtml(draft.instagramFollowers || "0")}" /></label>
      <label class="field"><span>TikTok</span><input name="tiktok" value="${escapeHtml(draft.tiktok || "")}" /></label>
      <label class="field"><span>TikTok followers</span><input name="tiktokFollowers" type="number" min="0" value="${escapeHtml(draft.tiktokFollowers || "0")}" /></label>
      <label class="field"><span>Snapchat</span><input name="snapchat" value="${escapeHtml(draft.snapchat || "")}" /></label>
      <label class="field"><span>Snapchat followers</span><input name="snapchatFollowers" type="number" min="0" value="${escapeHtml(draft.snapchatFollowers || "0")}" /></label>
      <label class="field"><span>${l("Preferred platform", "المنصة المفضلة")}</span>${renderPlatformSelect("preferredPlatform", draft.preferredPlatform || "")}</label>
      <p class="compact field-span-full">${l("Follower counts help us match you with relevant campaigns. You can update them later in your profile.", "أعداد المتابعين تساعدنا على مطابقتك مع الحملات المناسبة. يمكنك تحديثها لاحقاً من ملفك الشخصي.")}</p>
      ${renderSignupAddressSection()}
      <div class="field checkbox-field field-span-full terms-consent-field">
        <label class="option-pill option-pill--terms">
          <input type="checkbox" name="termsAccepted" required ${draft.termsAccepted ? "checked" : ""} />
          <span>${l(
            `I have read and agree to the <a href="/terms" target="_blank" rel="noopener">Terms & Conditions</a>.`,
            `لقد قرأت <a href="/terms" target="_blank" rel="noopener">الشروط والأحكام</a> وأوافق عليها.`
          )}</span>
        </label>
      </div>
      <button type="submit" style="grid-column: 1 / -1;">${l("Send my request", "إرسال طلبي")}</button>
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
      ["influencers", l("Members", "الأعضاء")],
      ["campaigns", l("Campaigns", "الحملات")],
      ["branches", l("Branches", "الأفرع")],
      ["master-data", l("Master Data", "البيانات الأساسية")],
      ["managers", l("Managers", "مديرو الحملات")],
      ["journal", l("Journal", "اليوميات")],
      ["reports", l("Reports", "التقارير")],
      ["profile", l("Profile", "الملف الشخصي")],
    ];
  }
  if (role === "campaign_manager") {
    return [
      ["dashboard", l("Dashboard", "لوحة التحكم")],
      ["influencers", l("Members", "الأعضاء")],
      ["campaigns", l("Campaigns", "الحملات")],
      ["journal", l("Journal", "اليوميات")],
      ["reports", l("Reports", "التقارير")],
      ["profile", l("Profile", "الملف الشخصي")],
    ];
  }
  return [
    ["dashboard", l("Dashboard", "لوحة التحكم")],
    ["campaigns", l("Campaigns", "الحملات")],
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
    journal: "book-open",
    reports: "bar-chart-3",
    profile: "user-circle",
  },
  campaign_manager: {
    dashboard: "layout-dashboard",
    influencers: "users",
    campaigns: "megaphone",
    journal: "book-open",
    reports: "bar-chart-3",
    profile: "user-circle",
  },
  influencer: {
    dashboard: "home",
    campaigns: "megaphone",
    profile: "user-circle",
  },
};

function renderShell() {
  const isMember = state.currentUser?.role === "influencer";
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
          ${
            isMember
              ? `<img class="mobile-brand__logo" src="/uploads/branding/picksocialclub.png" alt="PICK Social Club" width="454" height="97" />`
              : `<strong>${l("PICK Social Club", "نادي بك")}</strong>`
          }
        </div>
        <div class="mobile-spacer"></div>
      </header>
      <aside class="sidebar">
        <div class="brand-block">
          ${
            isMember
              ? `<img class="brand-block__logo" src="/uploads/branding/picksocialclub.png" alt="PICK Social Club" width="454" height="97" />`
              : `
                <p class="eyebrow">PICK Internal</p>
                <h1>${l("PICK Social Club", "نادي بك")}</h1>
                <p class="brand-copy">${l("Run the club from here — campaigns, members, codes, deadlines.", "أدر النادي من هنا — الحملات والأعضاء والأكواد والمواعيد.")}</p>
              `
          }
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
        <div class="back-bar">${renderBackButton()}</div>
        ${renderPage()}
      </main>
    </div>
    ${renderCodeCard()}
  `;
}

function renderCodeCard() {
  if (!state.codeCardParticipantId) return "";
  const participant = (state.data?.participants || []).find((item) => item.id === Number(state.codeCardParticipantId));
  if (!participant || !participantHasWallet(participant)) return "";
  const campaign = findCampaignForParticipant(participant);
  if (!campaign) return "";
  const offerCopy = campaign.offerDescription ? `<p class="code-card__offer">${escapeHtml(campaign.offerDescription)}</p>` : "";
  return `
    <div class="code-card-overlay" data-action="close-code-card-backdrop">
      <article class="code-card" role="dialog" aria-modal="true" aria-label="${escapeHtml(l("Your reserved code", "كودك المحجوز"))}">
        <button class="code-card__close" data-action="close-code-card" aria-label="${escapeHtml(l("Close", "إغلاق"))}">×</button>
        <header class="code-card__header">
          <img class="code-card__logo" src="/uploads/branding/picksocialclub.png" alt="PICK Social Club" />
        </header>
        <div class="code-card__body">
          <p class="code-card__kicker">${escapeHtml(l("YOUR RESERVATION", "حجزك"))}</p>
          <h2 class="code-card__title">${escapeHtml(campaignTitle(campaign))}</h2>
          <div class="code-card__reserved">
            <p class="code-card__reserved-label">${escapeHtml(l("Reserved", "محجوز"))}</p>
            <p class="code-card__reserved-help">${escapeHtml(l("Show your QR or read the reference to a PICK team member.", "اعرض رمز الـQR أو اقرأ الرقم المرجعي لعضو فريق PICK."))}</p>
          </div>
          ${offerCopy}
          <dl class="code-card__meta">
            <div>
              <dt>${escapeHtml(l("Visit by", "آخر زيارة"))}</dt>
              <dd>${escapeHtml(formatDate(campaign.visitDeadline))}</dd>
            </div>
            <div>
              <dt>${escapeHtml(l("Submit by", "آخر تسليم"))}</dt>
              <dd>${escapeHtml(formatDate(campaign.submissionDeadline))}</dd>
            </div>
            <div>
              <dt>${escapeHtml(l("Branch", "الفرع"))}</dt>
              <dd>${escapeHtml(l("Any PICK branch", "أي فرع PICK"))}</dd>
            </div>
          </dl>
          <div class="code-card__qr" data-qr-target data-qr-url="${escapeHtml(participant.verificationUrl)}"></div>
          <div class="code-card__ref">
            <span class="code-card__ref-label">${escapeHtml(l("REF", "رقم"))}</span>
            <code>${escapeHtml(participant.verificationRef || "")}</code>
          </div>
          <p class="code-card__hint">${escapeHtml(l("Show this QR or read the reference at the branch when you redeem your offer.", "اعرض هذا الرمز أو اقرأ الرقم المرجعي عند الفرع لاستلام عرضك."))}</p>
        </div>
        <footer class="code-card__footer">
          <button class="code-card__share" data-action="share-code-card" data-participant-id="${participant.id}">
            ${escapeHtml(l("Share / Save to Photos", "مشاركة / حفظ في الصور"))}
          </button>
        </footer>
      </article>
    </div>
  `;
}

function renderPendingQrCodes() {
  document.querySelectorAll("[data-qr-target]:not([data-qr-rendered])").forEach((target) => {
    const url = target.dataset.qrUrl;
    if (!url) return;
    const matrix = createQrMatrix(url);
    if (!matrix) {
      target.setAttribute("data-qr-rendered", "true");
      target.textContent = l("QR unavailable", "رمز QR غير متاح");
      return;
    }
    target.setAttribute("data-qr-rendered", "true");
    target.innerHTML = buildQrSvgMarkup(matrix, 180);
  });
}

function qrFieldMultiply(a, b) {
  if (!a || !b) return 0;
  const cache = qrFieldMultiply.cache ||= (() => {
    const exp = new Array(512).fill(0);
    const log = new Array(256).fill(0);
    let value = 1;
    for (let index = 0; index < 255; index += 1) {
      exp[index] = value;
      log[value] = index;
      value <<= 1;
      if (value & 0x100) value ^= 0x11d;
    }
    for (let index = 255; index < 512; index += 1) {
      exp[index] = exp[index - 255];
    }
    return { exp, log };
  })();
  return cache.exp[cache.log[a] + cache.log[b]];
}

function qrGeneratorPolynomial(degree) {
  const cache = qrGeneratorPolynomial.cache ||= new Map();
  if (cache.has(degree)) return cache.get(degree).slice();
  const exp = qrFieldMultiply.cache?.exp || (() => {
    qrFieldMultiply(1, 1);
    return qrFieldMultiply.cache.exp;
  })();
  let polynomial = [1];
  for (let step = 0; step < degree; step += 1) {
    const next = new Array(polynomial.length + 1).fill(0);
    for (let index = 0; index < polynomial.length; index += 1) {
      next[index] ^= polynomial[index];
      next[index + 1] ^= qrFieldMultiply(polynomial[index], exp[step]);
    }
    polynomial = next;
  }
  cache.set(degree, polynomial.slice());
  return polynomial;
}

function qrErrorCodewords(dataCodewords, degree) {
  const generator = qrGeneratorPolynomial(degree);
  const errorCodewords = new Array(degree).fill(0);
  for (const value of dataCodewords) {
    const factor = value ^ errorCodewords[0];
    for (let index = 0; index < degree - 1; index += 1) {
      errorCodewords[index] = errorCodewords[index + 1];
    }
    errorCodewords[degree - 1] = 0;
    for (let index = 0; index < degree; index += 1) {
      errorCodewords[index] ^= qrFieldMultiply(generator[index + 1], factor);
    }
  }
  return errorCodewords;
}

function pushBits(target, value, length) {
  for (let bit = length - 1; bit >= 0; bit -= 1) {
    target.push((value >> bit) & 1);
  }
}

function createQrDataCodewords(textValue) {
  const bytes = Array.from(new TextEncoder().encode(String(textValue || "")));
  if (bytes.length > QR_CODE_CARD.maxBytes) return null;
  const bits = [];
  pushBits(bits, 0x4, 4);
  pushBits(bits, bytes.length, 8);
  bytes.forEach((value) => pushBits(bits, value, 8));
  const capacity = QR_CODE_CARD.dataCodewords * 8;
  const terminator = Math.min(4, Math.max(0, capacity - bits.length));
  for (let index = 0; index < terminator; index += 1) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);
  const codewords = [];
  for (let index = 0; index < bits.length; index += 8) {
    let value = 0;
    for (let offset = 0; offset < 8; offset += 1) {
      value = (value << 1) | bits[index + offset];
    }
    codewords.push(value);
  }
  for (let padIndex = 0; codewords.length < QR_CODE_CARD.dataCodewords; padIndex += 1) {
    codewords.push(padIndex % 2 === 0 ? 0xec : 0x11);
  }
  return codewords;
}

function createQrMatrix(textValue) {
  const dataCodewords = createQrDataCodewords(textValue);
  if (!dataCodewords) return null;

  const size = QR_CODE_CARD.size;
  const modules = Array.from({ length: size }, () => Array(size).fill(false));
  const reserved = Array.from({ length: size }, () => Array(size).fill(false));
  const allCodewords = dataCodewords.concat(qrErrorCodewords(dataCodewords, QR_CODE_CARD.ecCodewords));

  function setFunctionModule(row, col, dark) {
    if (row < 0 || col < 0 || row >= size || col >= size) return;
    modules[row][col] = Boolean(dark);
    reserved[row][col] = true;
  }

  function setupFinderPattern(row, col) {
    for (let r = -1; r <= 7; r += 1) {
      for (let c = -1; c <= 7; c += 1) {
        const targetRow = row + r;
        const targetCol = col + c;
        if (targetRow < 0 || targetCol < 0 || targetRow >= size || targetCol >= size) continue;
        const dark =
          (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
          (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        setFunctionModule(targetRow, targetCol, dark);
      }
    }
  }

  function setupAlignmentPattern(centerRow, centerCol) {
    if (reserved[centerRow][centerCol]) return;
    for (let r = -2; r <= 2; r += 1) {
      for (let c = -2; c <= 2; c += 1) {
        setFunctionModule(
          centerRow + r,
          centerCol + c,
          r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0)
        );
      }
    }
  }

  function reserveFormatInfo() {
    for (let index = 0; index < 9; index += 1) {
      if (index !== 6) {
        setFunctionModule(8, index, false);
        setFunctionModule(index, 8, false);
      }
    }
    for (let index = 0; index < 8; index += 1) {
      setFunctionModule(8, size - 1 - index, false);
      setFunctionModule(size - 1 - index, 8, false);
    }
    setFunctionModule(size - 8, 8, true);
  }

  setupFinderPattern(0, 0);
  setupFinderPattern(size - 7, 0);
  setupFinderPattern(0, size - 7);

  for (let index = 8; index < size - 8; index += 1) {
    if (!reserved[index][6]) setFunctionModule(index, 6, index % 2 === 0);
    if (!reserved[6][index]) setFunctionModule(6, index, index % 2 === 0);
  }

  QR_CODE_CARD.alignmentCenters.forEach((row) => {
    QR_CODE_CARD.alignmentCenters.forEach((col) => {
      setupAlignmentPattern(row, col);
    });
  });

  reserveFormatInfo();

  let bitIndex = 7;
  let codewordIndex = 0;
  let row = size - 1;
  let rowStep = -1;

  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col -= 1;
    while (true) {
      for (let colOffset = 0; colOffset < 2; colOffset += 1) {
        const currentCol = col - colOffset;
        if (reserved[row][currentCol]) continue;
        const codeword = allCodewords[codewordIndex] ?? 0;
        const dataBit = ((codeword >>> bitIndex) & 1) === 1;
        const masked = (row + currentCol) % 2 === 0 ? !dataBit : dataBit;
        modules[row][currentCol] = masked;
        bitIndex -= 1;
        if (bitIndex < 0) {
          codewordIndex += 1;
          bitIndex = 7;
        }
      }
      row += rowStep;
      if (row < 0 || row >= size) {
        row -= rowStep;
        rowStep = -rowStep;
        break;
      }
    }
  }

  for (let index = 0; index < 15; index += 1) {
    const dark = ((QR_CODE_CARD.formatInfo >>> index) & 1) === 1;
    if (index < 6) {
      modules[index][8] = dark;
    } else if (index < 8) {
      modules[index + 1][8] = dark;
    } else {
      modules[size - 15 + index][8] = dark;
    }

    if (index < 8) {
      modules[8][size - index - 1] = dark;
    } else if (index < 9) {
      modules[8][7] = dark;
    } else {
      modules[8][15 - index - 1] = dark;
    }
  }

  modules[size - 8][8] = true;
  return modules;
}

function buildQrSvgModules(matrix) {
  let rects = "";
  for (let row = 0; row < matrix.length; row += 1) {
    for (let col = 0; col < matrix[row].length; col += 1) {
      if (!matrix[row][col]) continue;
      rects += `<rect x="${col}" y="${row}" width="1" height="1"></rect>`;
    }
  }
  return rects;
}

function buildQrSvgMarkup(matrix, pixelSize = 180) {
  if (!matrix?.length) return "";
  const size = matrix.length;
  return `
    <svg viewBox="0 0 ${size} ${size}" width="${pixelSize}" height="${pixelSize}" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
      <rect width="${size}" height="${size}" fill="#ffffff"></rect>
      <g fill="#1f1620">${buildQrSvgModules(matrix)}</g>
    </svg>
  `;
}

function wrapSvgText(value, maxCharsPerLine) {
  const textValue = String(value || "").trim();
  if (!textValue) return [];
  const words = textValue.split(/\s+/);
  const lines = [];
  let current = "";
  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharsPerLine || !current) {
      current = candidate;
      return;
    }
    lines.push(current);
    current = word;
  });
  if (current) lines.push(current);
  return lines;
}

function svgTextLines(lines, x, y, lineHeight, className) {
  if (!lines.length) return "";
  return `
    <text x="${x}" y="${y}" class="${className}" text-anchor="middle">
      ${lines.map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${escapeHtml(line)}</tspan>`).join("")}
    </text>
  `;
}

async function readBlobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Could not read file."));
    reader.readAsDataURL(blob);
  });
}

async function getCodeCardLogoDataUrl() {
  if (!codeCardLogoDataUrlPromise) {
    codeCardLogoDataUrlPromise = fetch("/uploads/branding/picksocialclub.png", { credentials: "same-origin" })
      .then((response) => {
        if (!response.ok) throw new Error("Could not load code card logo.");
        return response.blob();
      })
      .then(readBlobAsDataUrl)
      .catch(() => "");
  }
  return codeCardLogoDataUrlPromise;
}

async function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not render code card."));
    image.src = src;
  });
}

function buildCodeCardShareSvg(participant, campaign, logoDataUrl) {
  const qrMatrix = createQrMatrix(participant.verificationUrl || "");
  const titleLines = wrapSvgText(campaignTitle(campaign), 22).slice(0, 3);
  const offerLines = wrapSvgText(campaign.offerDescription || "", 30).slice(0, 4);
  const qrSize = 41;
  const qrRects = qrMatrix ? buildQrSvgModules(qrMatrix) : "";
  const titleBlock = svgTextLines(titleLines, 540, 352, 38, "title");
  const offerBlock = offerLines.length ? svgTextLines(offerLines, 540, 760, 28, "offer") : "";
  const logoBlock = logoDataUrl
    ? `<image href="${escapeHtml(logoDataUrl)}" x="290" y="74" width="500" height="107"></image>`
    : `<text x="540" y="142" class="wordmark" text-anchor="middle">PICK SOCIAL CLUB</text>`;
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1800" viewBox="0 0 1080 1800">
      <style>
        .page { fill: #f3ecdc; }
        .header { fill: #4a1f5d; }
        .kicker { fill: #7f6d78; font: 700 28px 'Helvetica Neue', Arial, sans-serif; letter-spacing: 8px; }
        .title { fill: #1f1620; font: 700 58px Georgia, serif; }
        .reserved { fill: #4a1f5d; font: 700 62px Georgia, serif; }
        .reserved-help { fill: #5d4f59; font: 400 28px 'Helvetica Neue', Arial, sans-serif; }
        .offer { fill: #5d4f59; font: 400 32px 'Helvetica Neue', Arial, sans-serif; }
        .meta-box { fill: rgba(31, 22, 32, 0.05); }
        .meta-label { fill: #7f6d78; font: 700 20px 'Helvetica Neue', Arial, sans-serif; letter-spacing: 4px; }
        .meta-value { fill: #1f1620; font: 700 28px 'Helvetica Neue', Arial, sans-serif; }
        .hint { fill: #7f6d78; font: italic 400 26px Georgia, serif; }
        .ref-box { fill: rgba(31, 22, 32, 0.05); }
        .ref-label { fill: #7f6d78; font: 700 18px 'Helvetica Neue', Arial, sans-serif; letter-spacing: 4px; }
        .ref-value { fill: #1f1620; font: 700 40px 'Courier New', monospace; letter-spacing: 8px; }
        .wordmark { fill: #ffffff; font: 700 48px 'Helvetica Neue', Arial, sans-serif; letter-spacing: 3px; }
      </style>
      <rect class="page" width="1080" height="1800" rx="48" ry="48"></rect>
      <rect class="header" width="1080" height="236"></rect>
      ${logoBlock}
      <text x="540" y="286" class="kicker" text-anchor="middle">${escapeHtml(l("YOUR RESERVATION", "حجزك"))}</text>
      ${titleBlock}
      <text x="540" y="506" class="reserved" text-anchor="middle">${escapeHtml(l("Reserved", "محجوز"))}</text>
      <text x="540" y="556" class="reserved-help" text-anchor="middle">${escapeHtml(l("Show this QR or read the reference to a PICK team member.", "اعرض هذا الرمز أو اقرأ الرقم المرجعي لعضو فريق PICK."))}</text>
      ${offerBlock}
      <rect class="meta-box" x="120" y="760" width="840" height="220" rx="22" ry="22"></rect>
      <text x="180" y="820" class="meta-label">${escapeHtml(l("VISIT BY", "آخر زيارة"))}</text>
      <text x="900" y="820" class="meta-value" text-anchor="end">${escapeHtml(formatDate(campaign.visitDeadline))}</text>
      <text x="180" y="890" class="meta-label">${escapeHtml(l("SUBMIT BY", "آخر تسليم"))}</text>
      <text x="900" y="890" class="meta-value" text-anchor="end">${escapeHtml(formatDate(campaign.submissionDeadline))}</text>
      <text x="180" y="960" class="meta-label">${escapeHtml(l("BRANCH", "الفرع"))}</text>
      <text x="900" y="960" class="meta-value" text-anchor="end">${escapeHtml(l("Any PICK branch", "أي فرع PICK"))}</text>
      <rect x="305" y="1040" width="470" height="470" rx="24" ry="24" fill="#ffffff"></rect>
      ${
        qrMatrix
          ? `<g transform="translate(330 1065) scale(${420 / qrSize})"><rect width="${qrSize}" height="${qrSize}" fill="#ffffff"></rect><g fill="#1f1620">${qrRects}</g></g>`
          : `<text x="540" y="1280" class="meta-value" text-anchor="middle">${escapeHtml(l("QR unavailable", "رمز QR غير متاح"))}</text>`
      }
      <rect class="ref-box" x="350" y="1548" width="380" height="110" rx="18" ry="18"></rect>
      <text x="540" y="1592" class="ref-label" text-anchor="middle">${escapeHtml(l("REF", "رقم"))}</text>
      <text x="540" y="1646" class="ref-value" text-anchor="middle">${escapeHtml(participant.verificationRef || "")}</text>
      <text x="540" y="1730" class="hint" text-anchor="middle">${escapeHtml(l("Show this QR or read the reference at the branch when you redeem your offer.", "اعرض هذا الرمز أو اقرأ الرقم المرجعي عند الفرع لاستلام عرضك."))}</text>
    </svg>
  `;
}

async function buildCodeCardShareFile(participant, campaign) {
  const logoDataUrl = await getCodeCardLogoDataUrl();
  const svgMarkup = buildCodeCardShareSvg(participant, campaign, logoDataUrl);
  const svgBlob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
  const objectUrl = URL.createObjectURL(svgBlob);
  try {
    const image = await loadImageElement(objectUrl);
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1800;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not create image.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pngBlob = await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Could not export code card."));
      }, "image/png");
    });
    const fileStem = String(participant.verificationRef || participant.id)
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "pick-code";
    return new File([pngBlob], `pick-code-${fileStem}.png`, {
      type: "image/png",
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function downloadFile(file) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
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
  if (["confirmed", "visited", "submitted", "offline_reserved"].includes(status)) return "status-strip-warning";
  if (["canceled", "rejected", "suspended"].includes(status)) return "status-strip-danger";
  return "";
}

function participantNeedsProof(status) {
  return ["confirmed", "visited"].includes(status);
}

function participantNeedsVisit(status) {
  return ["confirmed", "offline_reserved"].includes(status);
}

function participantCanSubmit(participant) {
  if (!participant) return false;
  if (participant.status === "confirmed" || participant.status === "visited") return true;
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
  if (status === "confirmed") return l("Code reserved — ready to submit", "الكود محجوز — جاهز للإرسال");
  if (status === "visited") return l("Code reserved — ready to submit", "الكود محجوز — جاهز للإرسال");
  if (status === "submitted") return l("Proof submitted", "تم إرسال الإثبات");
  if (status === "completed") return l("Completed", "مكتمل");
  if (status === "canceled") return l("You canceled this", "ألغيتَ هذه المشاركة");
  return status;
}

function participantStatusLabelShort(status) {
  if (status === "confirmed") return l("Ready", "جاهز");
  if (status === "visited") return l("Ready", "جاهز");
  if (status === "submitted") return l("Submitted", "تم الإرسال");
  if (status === "completed") return l("Done", "مكتمل");
  if (status === "canceled") return l("Canceled", "ملغاة");
  if (status === "offline_reserved") return l("Offline", "خارجي");
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

function renderReservationDetails(participant, campaign) {
  if (!participantHasWallet(participant)) return "";
  return `
    <div class="campaign-reservation-card" style="margin-top: 12px;">
      <div class="row">
        <strong>${escapeHtml(l("Reserved", "محجوز"))}</strong>
        <span class="code-offer-uses">${escapeHtml(l("Uses", "عدد الاستخدام"))}: ${escapeHtml(participant.assignedCodeUsageCount || campaign?.offerUsageCount || 1)}</span>
      </div>
      <p>${escapeHtml(l("Show your QR or read the reference to a PICK team member at the branch.", "اعرض رمز الـQR أو اقرأ الرقم المرجعي لعضو فريق PICK عند الفرع."))}</p>
      ${renderSaveCodeButton(participant, l("Open your QR", "افتح رمز QR"), "save-code-btn save-code-btn--ink")}
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

function isAdminMemberEditPage() {
  return state.currentPage === "admin-edit-member" && ["admin", "campaign_manager"].includes(state.currentUser?.role || "");
}

function editableProfileUser() {
  return isAdminMemberEditPage() ? selectedInfluencer() : state.currentUser;
}

function shippingAddressStateForUser(user) {
  if (!user) return { loading: false, loaded: false, address: null, error: "" };
  if (isAdminMemberEditPage()) {
    return state.adminAddressCards[user.id] || { loading: false, loaded: false, address: null, error: "" };
  }
  return { loading: false, loaded: true, address: user.address || null, error: "" };
}

function exitAdminMemberEdit(userId, message) {
  closeShippingAddressEditor();
  const previous = state.navStack[state.navStack.length - 1];
  if (
    previous?.params?.currentPage === "influencer-profile" &&
    Number(previous?.params?.selectedInfluencerId) === Number(userId)
  ) {
    state.navStack.pop();
  }
  state.currentPage = "influencer-profile";
  state.selectedInfluencerId = Number(userId);
  render();
  flash(message, "success");
}

async function ensureAdminAddressLoaded(userId, options = {}) {
  const current = state.adminAddressCards[userId] || { expanded: false, loading: false, loaded: false, address: null, error: "" };
  if (current.loaded || current.loading) return current;
  state.adminAddressCards = {
    ...state.adminAddressCards,
    [userId]: {
      ...current,
      expanded: options.expanded ?? current.expanded,
      loading: true,
      error: "",
    },
  };
  render();
  try {
    const payload = await api(`/api/admin/users/${userId}/address`);
    state.adminAddressCards = {
      ...state.adminAddressCards,
      [userId]: {
        expanded: options.expanded ?? current.expanded,
        loading: false,
        loaded: true,
        address: payload.address || null,
        error: "",
      },
    };
  } catch (error) {
    state.adminAddressCards = {
      ...state.adminAddressCards,
      [userId]: {
        expanded: options.expanded ?? current.expanded,
        loading: false,
        loaded: false,
        address: null,
        error: error.message || l("Could not load the address.", "تعذر تحميل العنوان."),
      },
    };
  }
  render();
  return state.adminAddressCards[userId];
}

function selectedBranch() {
  return (state.data?.branches || []).find((branch) => branch.id === Number(state.selectedBranchId)) || null;
}

function influencerBackLabel(page) {
  if (page === "reports") return l("Back to reports", "العودة إلى التقارير");
  if (page === "campaign-view") return l("Back to campaign", "العودة إلى الحملة");
  if (page === "dashboard") return l("Back to dashboard", "العودة إلى لوحة التحكم");
  return l("Back to members", "العودة إلى الأعضاء");
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
  if (state.currentPage === "admin-edit-member") return renderAdminEditMemberPage();
  if (state.currentPage === "campaigns") return renderCampaignsPage();
  if (state.currentPage === "campaign-edit") return renderCampaignEditPage();
  if (state.currentPage === "campaign-view") return renderCampaignViewPage();
  if (state.currentPage === "branches") return renderBranchesPage();
  if (state.currentPage === "branch-edit") return renderBranchEditPage();
  if (state.currentPage === "master-data") return renderMasterDataPage();
  if (state.currentPage === "managers") return renderManagersPage();
  if (state.currentPage === "manager-edit") return renderManagerEditPage();
  if (state.currentPage === "journal") return renderJournalPage();
  if (state.currentPage === "reports") return renderReportsPage();
  if (state.currentPage === "profile") return renderProfilePage();
  return renderOperationsDashboard();
}

function renderManagerPages() {
  if (state.currentPage === "influencers") return renderInfluencersPage();
  if (state.currentPage === "influencer-profile") return renderInfluencerProfilePage();
  if (state.currentPage === "admin-edit-member") return renderAdminEditMemberPage();
  if (state.currentPage === "campaigns") return renderCampaignsPage();
  if (state.currentPage === "campaign-edit") return renderCampaignEditPage();
  if (state.currentPage === "campaign-view") return renderCampaignViewPage();
  if (state.currentPage === "journal") return renderJournalPage();
  if (state.currentPage === "reports") return renderReportsPage();
  if (state.currentPage === "profile") return renderProfilePage();
  return renderOperationsDashboard();
}

function renderJournalPage() {
  const journalEntries = [...(state.data?.journalEntries || [])].sort((left, right) =>
    String(right.publishedAt || right.createdAt || "").localeCompare(String(left.publishedAt || left.createdAt || ""))
  );
  const editing = journalEntries.find((entry) => entry.id === Number(state.selectedJournalEntryId)) || null;
  return `
    ${pageHeader(
      l("Journal", "اليوميات"),
      l("Share short updates, stories, and club voice with members from one place.", "شاركوا التحديثات القصيرة والقصص وصوت النادي مع الأعضاء من مكان واحد."),
      { showNotifications: true }
    )}
    <section class="content-grid">
      <section class="panel">
        <div class="row report-toolbar-head">
          <div>
            <h3>${editing ? l("Edit entry", "تعديل المنشور") : l("Create entry", "إنشاء منشور")}</h3>
            <p class="panel-subtitle">${l("Draft first or publish right away. Add an optional image or external link.", "احفظ كمسودة أولاً أو انشر مباشرة. أضف صورة أو رابطاً خارجياً بشكل اختياري.")}</p>
          </div>
          ${editing ? `<button type="button" class="secondary button-small" data-action="clear-journal-editor">${l("New entry", "منشور جديد")}</button>` : ""}
        </div>
        <form id="journalForm" class="form-grid" enctype="multipart/form-data">
          ${editing ? `<input type="hidden" name="entryId" value="${editing.id}" />` : ""}
          <label class="field"><span>Title (EN)</span><input name="titleEn" required value="${escapeHtml(editing?.titleEn || "")}" /></label>
          <label class="field"><span>Title (AR)</span><input name="titleAr" value="${escapeHtml(editing?.titleAr || "")}" /></label>
          <label class="field field-span-full"><span>Body (EN)</span><textarea name="bodyEn" rows="6" required>${escapeHtml(editing?.bodyEn || "")}</textarea></label>
          <label class="field field-span-full"><span>Body (AR)</span><textarea name="bodyAr" rows="6">${escapeHtml(editing?.bodyAr || "")}</textarea></label>
          <label class="field field-span-full"><span>${l("External link (optional, e.g. Instagram post)", "رابط خارجي (اختياري، مثل منشور إنستغرام)")}</span><input name="externalLink" type="url" value="${escapeHtml(editing?.externalLink || "")}" /></label>
          <label class="field field-span-full"><span>${l("Image (optional)", "صورة (اختياري)")}</span><input name="image" type="file" accept="image/*" /></label>
          ${editing?.imagePath ? `<img class="image-preview" src="${editing.imagePath}" alt="${escapeHtml(journalTitle(editing))}" />` : ""}
          <div class="row-wrap">
            <button type="submit">${l("Save as draft", "حفظ كمسودة")}</button>
            <button type="submit" name="publish" value="1">${l("Save and publish", "حفظ ونشر")}</button>
          </div>
        </form>
      </section>
      <section class="panel panel-wide">
        <h3>${l("All entries", "كل المنشورات")}</h3>
        ${renderDataTable(
          [
            { label: l("Title", "العنوان"), render: (entry) => journalTitle(entry) || "-" },
            { label: l("Author", "الكاتب"), render: (entry) => entry.authorName || entry.authorEmail || "-" },
            {
              label: l("Status", "الحالة"),
              render: (entry) => `<span class="badge ${journalStatusTone(entry.status)}">${escapeHtml(journalStatusLabel(entry.status))}</span>`,
              html: true,
            },
            { label: l("Created", "أُنشئ"), render: (entry) => formatDate(entry.createdAt) },
            {
              label: l("Actions", "الإجراءات"),
              render: (entry) => {
                if (!canManageJournalEntryClient(entry)) return "-";
                return `
                  <div class="row-wrap">
                    <button type="button" class="secondary button-small" data-action="edit-journal-entry" data-entry-id="${entry.id}">${escapeHtml(l("Edit", "تعديل"))}</button>
                    <button type="button" class="secondary button-small" data-action="toggle-journal-publish" data-entry-id="${entry.id}">${escapeHtml(entry.status === "published" ? l("Unpublish", "إلغاء النشر") : l("Publish", "نشر"))}</button>
                    <button type="button" class="secondary button-small" data-action="delete-journal-entry" data-entry-id="${entry.id}">${escapeHtml(l("Delete", "حذف"))}</button>
                  </div>
                `;
              },
              html: true,
            },
          ],
          journalEntries,
          l("No entries yet.", "لا توجد منشورات بعد.")
        )}
      </section>
    </section>
  `;
}

function renderInfluencerPages() {
  if (state.currentPage === "campaign-preview") return renderInfluencerCampaignPreviewPage();
  if (state.currentPage === "availableCampaigns" || state.currentPage === "myCampaigns") {
    state.currentPage = "campaigns";
  }
  if (state.currentPage === "campaigns") return renderMemberCampaignsPage();
  if (state.currentPage === "profile") return renderProfilePage();
  return renderInfluencerDashboard();
}

function renderOperationsDashboard() {
  const summary = reportSummary();
  return `
    ${pageHeader(
      l("Operations Dashboard", "لوحة التشغيل"),
      l("Run the club from here — campaigns, members, codes, deadlines.", "أدر النادي من هنا — الحملات والأعضاء والأكواد والمواعيد."),
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
      <h3>${l("Member Snapshot", "ملخص الأعضاء")}</h3>
      ${renderInfluencerTable(allInfluencers().slice(0, 6), false)}
    </section>
    ${renderRecentActivityPanel()}
  `;
}

function filteredInfluencers() {
  const query = state.influencerFilters.query.toLowerCase();
  return allInfluencers().filter((user) => {
    if (!residentialMatchesFilters(user.residential, state.influencerFilters)) return false;
    if (state.influencerFilters.categoryId && !includesCategory(user.categoryIds, state.influencerFilters.categoryId)) return false;
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
      l("Members", "الأعضاء"),
      l("Welcome new members, manage access, update club tags and notes, and help everyone stay connected.", "رحّب بالأعضاء الجدد وأدر الوصول وحدّث العلامات والملاحظات وساعد الجميع على البقاء على تواصل."),
      { hideHeroStats: true }
    )}
    ${metricGrid([
      { label: l("Total members", "إجمالي الأعضاء"), value: allInfluencers().length, note: l("All member accounts in the club.", "جميع حسابات الأعضاء في النادي.") },
      { label: l("Pending requests", "طلبات بانتظار الاعتماد"), value: pending.length, note: l("New member requests waiting for approval or rejection.", "طلبات أعضاء جديدة بانتظار الاعتماد أو الرفض.") },
      { label: l("Active accounts", "الحسابات النشطة"), value: activeCount, note: l("Members who can currently log in and join campaigns.", "أعضاء يمكنهم الدخول والانضمام للحملات حالياً.") },
      { label: l("Pending proof", "إثباتات معلقة"), value: pendingProof, note: l("Platform joins still waiting for proof links.", "انضمامات المنصة التي ما زالت بانتظار روابط الإثبات.") },
    ])}
    ${state.generatedLink ? `<article class="note-card" style="margin-bottom: 18px;"><strong>${l("Generated reset link", "رابط إعادة التعيين المولد")}</strong><p>${escapeHtml(state.generatedLink)}</p></article>` : ""}
    <section class="panel">
      <div class="row report-toolbar-head">
        <div>
          <h3>${l("Filter members", "فلترة الأعضاء")}</h3>
          <p class="panel-subtitle">${l("Use these filters to find the right member record before taking action.", "استخدم هذه الفلاتر للوصول إلى سجل العضو الصحيح قبل تنفيذ أي إجراء.")}</p>
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
        <div class="field field-span-full influencer-filter-residential">
          <span>${l("Residential location", "مكان السكن")}</span>
          <div class="form-grid two-col">
            ${renderResidentialCascadeFields({
              prefix: "residential",
              value: residentialFromSelection(state.influencerFilters),
              includeAll: true,
            })}
          </div>
        </div>
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
          <h3>${l("Pending member requests", "طلبات الأعضاء المعلقة")}</h3>
          <p class="panel-subtitle">${l("Review new member requests before they step into the club.", "راجع طلبات الأعضاء الجدد قبل دخولهم إلى النادي.")}</p>
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
                        <p>${escapeHtml(residentialSummary(user.residential, { includeCountry: false }))} · ${escapeHtml(categorySummary(user.categoryIds, { compact: true }))}</p>
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
          : `<div class="empty-state">${l("Nobody waiting at the door.", "لا أحد ينتظر.")}</div>`}
      </div>
    </section>
    <section class="panel">
      <div class="row report-toolbar-head">
        <div>
          <h3>${l("All Members", "جميع الأعضاء")}</h3>
          <p class="panel-subtitle">${l("Review each member record, update internal notes, and take direct account actions from the same page.", "راجع كل سجل عضو وحدّث الملاحظات الداخلية ونفّذ إجراءات الحساب مباشرة من الصفحة نفسها.")}</p>
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
                        <p>${escapeHtml(residentialSummary(user.residential, { includeCountry: false }))} · ${escapeHtml(categorySummary(user.categoryIds, { compact: true }))}</p>
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
          : `<div class="empty-state">${l("No members match the current filter.", "لا يوجد أعضاء مطابقون للفلاتر الحالية.")}</div>`}
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
    : `<div class="empty-state">${l("Quiet here for now. New campaigns will show up here.", "هادئ هنا حالياً. الحملات الجديدة ستظهر هنا.")}</div>`;
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
              <p>${escapeHtml(residentialSummary(user.residential, { includeCountry: false }))} · ${escapeHtml(categorySummary(user.categoryIds, { compact: true }))}</p>
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
            : `<div class="empty-state">${l("Quiet here for now. New campaigns will show up here.", "هادئ هنا حالياً. الحملات الجديدة ستظهر هنا.")}</div>`}
        </div>
      </section>
      <section class="panel">
        <h3>${l("Create Campaign", "إنشاء حملة")}</h3>
        ${renderCampaignForm(null)}
      </section>
    </section>
  `;
}

function campaignTargetTier2Rows() {
  return [
    ...kuwaitGovernorates().map((row) => ({ ...row, countryCode: "KW", parentId: "" })),
    ...saudiRegions().map((row) => ({ ...row, countryCode: "SA", parentId: "" })),
  ];
}

function campaignTargetTier3Rows() {
  return [
    ...(addressReference().kuwait?.areas || []).map((row) => ({ ...row, countryCode: "KW", parentId: row.governorateId })),
    ...(addressReference().saudiArabia?.cities || []).map((row) => ({ ...row, countryCode: "SA", parentId: row.regionId })),
  ];
}

function campaignTargetPreviewCount(payload) {
  const previewCampaign = {
    ...payload,
    status: "live",
    visitDeadline: payload.visitDeadline || localDateString(),
  };
  return allInfluencers().filter((influencer) => campaignMatchesInfluencer(previewCampaign, influencer)).length;
}

function renderCampaignForm(campaign) {
  const selectedBranchIds = new Set(campaign?.branchIds || []);
  const targetCountries = new Set(campaign?.targetCountries || []);
  const targetGovernorateIds = new Set(campaign?.targetGovernorateIds || []);
  const targetCityIds = new Set(campaign?.targetCityIds || []);
  const targetCategoryIds = new Set(campaign?.targetCategoryIds || []);
  const targetTags = new Set(campaign?.targetTags || []);
  const targetPlatformIds = new Set((campaign?.targetPlatformIds || []).map(Number));
  const tagOptions = (state.data?.tags || [])
    .filter((tag) => tag.status === "active" || targetTags.has(tag.value))
    .sort((left, right) => compareValues(left.value, right.value));
  const branchMode = campaign?.branchMode || "all";
  const isCreate = !campaign;
  const targetPreview = {
    status: campaign?.status || "draft",
    visitDeadline: campaign?.visitDeadline || "",
    targetCountries: [...targetCountries],
    targetGovernorateIds: [...targetGovernorateIds],
    targetCityIds: [...targetCityIds],
    targetCategoryIds: [...targetCategoryIds],
    targetGender: campaign?.targetGender || "",
    minFollowers: Number(campaign?.minFollowers) || 0,
    targetPlatformIds: [...targetPlatformIds],
    targetTags: [...targetTags],
  };
  const initialMatchCount = campaignTargetPreviewCount(targetPreview);
  const tier2Rows = campaignTargetTier2Rows();
  const tier3Rows = campaignTargetTier3Rows();
  const showTier2 = targetCountries.size > 0;
  const showTier3 = targetGovernorateIds.size > 0;
  return `
    <form class="campaign-form-stack" id="${campaign ? "editCampaignForm" : "createCampaignForm"}" data-campaign-targeting-form>
      ${campaign ? `<input type="hidden" name="campaignId" value="${campaign.id}" />` : ""}
      <section class="form-section">
        <div class="form-section-header">
          <h4>${l("Basic setup", "الإعداد الأساسي")}</h4>
          <p>${l("Name the campaign, choose its type, and set the main messaging managers and members will see.", "قم بتسمية الحملة وحدد نوعها واضبط الرسائل الأساسية التي سيشاهدها المديرون والأعضاء.")}</p>
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
          <label class="field field-span-full">
            <span>${l("Show as Coming Soon preview to members", "اعرض كمعاينة قريباً للأعضاء")}</span>
            <div class="row-wrap">
              <label class="choice-pill">
                <input type="checkbox" name="previewMode" value="1" ${campaign?.previewMode ? "checked" : ""} />
                <span>${l("Yes — show this draft as a teaser", "نعم — اعرضها كتشويق")}</span>
              </label>
            </div>
            <small>${l("Only applies while the campaign is in draft status. Becomes irrelevant once you set it to live.", "تنطبق فقط عندما تكون الحملة في وضع المسودة. تصبح غير ذات صلة عند نشرها.")}</small>
          </label>
          <label class="field"><span>Audience (EN)</span><input name="audience" value="${escapeHtml(campaign?.audience || "")}" /></label>
          <label class="field"><span>Audience (AR)</span><input name="audienceAr" value="${escapeHtml(campaign?.audienceAr || "")}" /></label>
          <label class="field field-span-full"><span>Description (EN) <em class="required-mark">*</em></span><textarea name="descriptionEn" required>${escapeHtml(campaign?.descriptionEn || "")}</textarea></label>
          <label class="field field-span-full"><span>Description (AR)</span><textarea name="descriptionAr">${escapeHtml(campaign?.descriptionAr || "")}</textarea></label>
          <label class="field field-span-full">
            <span>${l("Caption guide (optional)", "دليل التعليق (اختياري)")}</span>
            <textarea name="captionGuide" rows="4" placeholder="${l("Hashtags, mentions, tone, do's and don'ts. Members see this when they're about to post.", "الهاشتاقات والمنشن والنبرة وما يجب وما لا يجب. يراها العضو عند نشر المحتوى.")}">${escapeHtml(campaign?.captionGuide || "")}</textarea>
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
          <p>${l("Define clearly what the member gets when the assigned code is used in the campaign.", "حدد بوضوح ما الذي سيحصل عليه العضو عند استخدام الكود المخصص ضمن الحملة.")}</p>
        </div>
        <div class="form-grid two-col">
          <label class="field"><span>${l("Offer usage count", "عدد استخدام العرض")} <em class="required-mark">*</em></span><input name="offerUsageCount" type="number" min="1" required value="${escapeHtml(campaign?.offerUsageCount || 1)}" /></label>
          <label class="field field-span-full"><span>${l("Offer description", "وصف العرض")} <em class="required-mark">*</em></span><input name="offerDescription" required value="${escapeHtml(campaign?.offerDescription || "")}" placeholder="${l("One free cold brew", "مشروب كولد برو مجاني واحد")}" /></label>
        </div>
      </section>
      <section class="form-section">
        <div class="form-section-header">
          <h4>${l("Cashier verification", "تحقق الكاشير")}</h4>
          <p>${l("Branch staff type this password after scanning the QR or entering the member reference manually.", "يكتب فريق الفرع هذه الكلمة بعد مسح رمز QR أو إدخال الرقم المرجعي للعضو يدوياً.")}</p>
        </div>
        <div class="form-grid">
          <label class="field field-span-full">
            <span>${l("Verification password", "كلمة مرور التحقق")}</span>
            <div class="row-wrap" style="gap: 8px;">
              <input name="verificationPassword" value="${escapeHtml(campaign?.verificationPassword || "")}" placeholder="PICK-XQ7A92" style="font-family: 'Courier New', monospace; flex: 1;" />
              ${campaign
                ? `<button type="button" class="secondary" data-action="regenerate-verification-password" data-campaign-id="${campaign.id}">${l("Regenerate", "إعادة توليد")}</button>`
                : ""}
            </div>
            <small class="compact">${escapeHtml(l("Share this with the campaign team. Leave blank on create if you want PICK to generate one automatically.", "شاركها مع فريق الحملة. اتركها فارغة عند الإنشاء إذا أردت من PICK توليدها تلقائياً."))}</small>
          </label>
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
          <p>${l("Use residential location, categories, and internal tags to decide who should see this campaign.", "استخدم مكان السكن والفئات والعلامات الداخلية لتحديد من يجب أن يشاهد هذه الحملة.")}</p>
        </div>
        <div class="form-grid">
          ${campaign?.targetingNeedsReset ? `<div class="status-strip-warning field-span-full">${escapeHtml(l("Targeting was reset due to a system update. Please re-pick countries, governorates, and cities.", "تمت إعادة ضبط الاستهداف بسبب تحديث في النظام. يرجى إعادة اختيار الدول والمحافظات والمدن."))}</div>` : ""}
          <div class="field checkbox-field field-span-full">
            <span>${l("Target countries (leave empty for all)", "الدول المستهدفة واتركها فارغة للجميع")}</span>
            <div class="option-grid option-grid--compact">
              ${(addressReference().countries || []).map((country) => `
                <label class="option-pill option-pill--country">
                  <input type="checkbox" name="targetCountries" value="${country.code}" ${targetCountries.has(country.code) ? "checked" : ""} />
                  <span>${escapeHtml(`${addressCountryFlag(country.code)} ${addressLocalizedName(country)}`)}</span>
                </label>
              `).join("")}
            </div>
          </div>
          <div class="field checkbox-field field-span-full" data-target-tier2-section ${showTier2 ? "" : "hidden"}>
            <span>${l("Target governorates / regions (leave empty for all within chosen countries)", "المحافظات / المناطق المستهدفة واتركها فارغة للجميع داخل الدول المختارة")}</span>
            <div class="row-wrap" style="margin-bottom: 10px;">
              <button type="button" class="secondary button-small" data-action="set-checkbox-group" data-checkbox-name="targetGovernorateIds" data-checkbox-mode="clear">${l("Clear", "مسح")}</button>
            </div>
            <div class="option-grid">
              ${tier2Rows.map((row) => `
                <label class="option-pill" data-target-country="${row.countryCode}">
                  <input type="checkbox" name="targetGovernorateIds" value="${row.id}" ${targetGovernorateIds.has(row.id) ? "checked" : ""} />
                  <span>${escapeHtml(addressLocalizedName(row))}</span>
                </label>
              `).join("")}
            </div>
          </div>
          <div class="field checkbox-field field-span-full" data-target-tier3-section ${showTier3 ? "" : "hidden"}>
            <span>${l("Target cities (leave empty for all within chosen governorates / regions)", "المدن المستهدفة واتركها فارغة للجميع داخل المحافظات / المناطق المختارة")}</span>
            <div class="row-wrap" style="margin-bottom: 10px;">
              <button type="button" class="secondary button-small" data-action="set-checkbox-group" data-checkbox-name="targetCityIds" data-checkbox-mode="clear">${l("Clear", "مسح")}</button>
            </div>
            <div class="option-grid">
              ${tier3Rows.map((row) => `
                <label class="option-pill" data-target-country="${row.countryCode}" data-target-parent-id="${row.parentId}">
                  <input type="checkbox" name="targetCityIds" value="${row.id}" ${targetCityIds.has(row.id) ? "checked" : ""} />
                  <span>${escapeHtml(addressLocalizedName(row))}</span>
                </label>
              `).join("")}
            </div>
          </div>
          <p class="compact field-span-full campaign-targeting-preview" data-targeting-preview>
            ${escapeHtml(l("Matches", "يطابق"))} ${initialMatchCount} ${escapeHtml(initialMatchCount === 1 ? l("member.", "عضواً.") : l("members.", "أعضاء."))}
          </p>
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
          <p class="compact">${l("A matching member needs at least one of the selected tags.", "يكفي أن يطابق العضو علامة واحدة على الأقل من العلامات المحددة.")}</p>
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
  const submittedRowsBase = participants
    .filter((participant) => ["submitted", "completed"].includes(participant.status))
    .sort((left, right) => String(right.submittedAt || "").localeCompare(String(left.submittedAt || "")));
  const submissionsTableId = `campaign-${campaign.id}-submissions`;
  const submissionsSort = state.reportSorts[submissionsTableId] || { key: "submittedAt", direction: "desc" };
  const submissionsSortValueFor = (row, key) => {
    if (key === "influencer") return row.influencerName || "";
    if (key === "platform") return row.platform || "";
    if (key === "submittedAt") return dateValue(row.submittedAt) || 0;
    return row[key];
  };
  const submittedRows = submittedRowsBase.slice().sort((left, right) => {
    const result = compareValues(submissionsSortValueFor(left, submissionsSort.key), submissionsSortValueFor(right, submissionsSort.key));
    return submissionsSort.direction === "asc" ? result : -result;
  });
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
          `Eligible members ${eligibleCount} · Platform joined ${platformJoined} · Offline reserved ${offlineReserved}`,
          `الأعضاء المؤهلون ${eligibleCount} · انضموا عبر المنصة ${platformJoined} · حجز خارجي ${offlineReserved}`
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
        <article class="note-card" style="margin-bottom: 14px;">
          <strong>${escapeHtml(l("Verification password", "كلمة مرور التحقق"))}</strong>
          <p class="panel-subtitle">${escapeHtml(l("Cashiers type this after scanning the QR or entering the member reference.", "يكتب الكاشير هذه الكلمة بعد مسح رمز QR أو إدخال الرقم المرجعي للعضو."))}</p>
          <code style="font-family: 'Courier New', monospace; font-size: 16px;">${escapeHtml(campaign.verificationPassword || "")}</code>
        </article>
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
              <p class="panel-subtitle">${l("Click a member to open WhatsApp with the share message and deep link pre-filled.", "اضغط على العضو لفتح واتساب مع رسالة المشاركة ورابط الانتقال.")}</p>
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
      <div class="row report-toolbar-head">
        <div>
          <h3>${l("Submissions", "التسليمات")}</h3>
          <p class="panel-subtitle">${l("All members who submitted proof for this campaign.", "كل الأعضاء الذين سلّموا إثبات هذه الحملة.")}</p>
        </div>
        <div class="row-wrap">
          <span class="badge">${submittedRows.length} ${l("submitted", "تسليم")}</span>
          <button type="button" class="secondary" data-action="export-campaign-submissions" data-campaign-id="${campaign.id}">${l("Export CSV", "تصدير CSV")}</button>
        </div>
      </div>
      ${renderDataTable(
        [
          {
            label: l("Member", "العضو"),
            render: (row) => row.influencerId ? renderInfluencerProfileTrigger(row.influencerId, row.influencerName) : escapeHtml(row.influencerName || "-"),
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
          {
            label: l("Images", "الصور"),
            render: (row) =>
              Array.isArray(row.images) && row.images.length
                ? `<span class="badge">${row.images.length}</span>`
                : row.imagePath
                  ? `<span class="badge">1</span>`
                  : "-",
            html: true,
          },
          {
            label: l("Feedback", "الملاحظات"),
            render: (row) => {
              if (!row.feedback) return "-";
              const feedback = String(row.feedback);
              return escapeHtml(feedback.slice(0, 120) + (feedback.length > 120 ? "…" : ""));
            },
            html: true,
          },
        ],
        submittedRows,
        l("No submissions for this campaign yet.", "لا توجد تسليمات لهذه الحملة بعد."),
        { tableId: submissionsTableId, sort: submissionsSort }
      )}
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
                                <label class="field"><span>${l("Member name", "اسم العضو")} <em class="required-mark">*</em></span><input name="offlineName" required /></label>
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
                            : `${escapeHtml(residentialSummary(participant.influencerResidential, { includeCountry: false }))} · ${escapeHtml(categorySummary(participant.influencerCategoryIds, { compact: true }))}`
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
                    ${participant.socialLink ? `<div class="row-wrap" style="margin-top: 8px;"><a class="table-link-button" href="${escapeHtml(participant.socialLink)}" target="_blank" rel="noreferrer">${escapeHtml(l("Open post", "فتح المنشور"))}</a></div>` : ""}
                    ${participant.feedback ? `<p>${escapeHtml(participant.feedback)}</p>` : ""}
                    <div class="row-wrap">${renderParticipantImages(participant.images || [])}</div>
                    ${participant.status !== "canceled" ? `<div class="row-wrap" style="margin-top: 12px;"><button class="secondary" data-action="remove-participant" data-participant-id="${participant.id}">${l("Remove member from campaign", "إزالة العضو من الحملة")}</button></div>` : ""}
                  </article>
                `
              )
              .join("")
          : `<div class="empty-state">${l("No members joined yet.", "لم ينضم أي عضو بعد.")}</div>`}
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

function syncCampaignTargetingForm(form) {
  if (!form) return;
  const selectedCountries = new Set(
    Array.from(form.querySelectorAll('input[name="targetCountries"]:checked')).map((input) => String(input.value || ""))
  );
  const selectedTier2 = new Set(
    Array.from(form.querySelectorAll('input[name="targetGovernorateIds"]:checked')).map((input) => String(input.value || ""))
  );
  const tier2Section = form.querySelector("[data-target-tier2-section]");
  const tier3Section = form.querySelector("[data-target-tier3-section]");

  if (tier2Section) tier2Section.hidden = selectedCountries.size === 0;
  form.querySelectorAll("[data-target-tier2-section] .option-pill").forEach((pill) => {
    const country = pill.dataset.targetCountry || "";
    const input = pill.querySelector('input[name="targetGovernorateIds"]');
    const visible = !selectedCountries.size || selectedCountries.has(country);
    pill.hidden = !visible;
    if (!visible && input) input.checked = false;
  });

  const activeTier2 = new Set(
    Array.from(form.querySelectorAll('input[name="targetGovernorateIds"]:checked')).map((input) => String(input.value || ""))
  );
  if (tier3Section) tier3Section.hidden = activeTier2.size === 0;
  form.querySelectorAll("[data-target-tier3-section] .option-pill").forEach((pill) => {
    const country = pill.dataset.targetCountry || "";
    const parentId = pill.dataset.targetParentId || "";
    const input = pill.querySelector('input[name="targetCityIds"]');
    const visible = (!selectedCountries.size || selectedCountries.has(country)) && activeTier2.has(parentId);
    pill.hidden = !visible;
    if (!visible && input) input.checked = false;
  });

  const preview = form.querySelector("[data-targeting-preview]");
  if (preview) {
    const payload = campaignFormPayload(form);
    const count = campaignTargetPreviewCount({
      status: payload.status,
      visitDeadline: payload.visitDeadline,
      targetCountries: payload.targetCountries,
      targetGovernorateIds: payload.targetGovernorateIds,
      targetCityIds: payload.targetCityIds,
      targetCategoryIds: payload.targetCategoryIds,
      targetGender: payload.targetGender,
      minFollowers: payload.minFollowers,
      targetPlatformIds: payload.targetPlatformIds,
      targetTags: payload.targetTags,
    });
    preview.textContent = `${l("Matches", "يطابق")} ${count} ${count === 1 ? l("member.", "عضواً.") : l("members.", "أعضاء.")}`;
  }
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
      ${"" /* Cashier PIN and daily-cap controls are mothballed pending POS reconciliation. */}
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
  const terms = state.data?.termsAndConditions || null;
  const termsUpdatedBy = terms?.updatedByUserId
    ? (state.data?.users || []).find((user) => user.id === Number(terms.updatedByUserId))
    : null;
  return `
    ${pageHeader(l("Master Data", "البيانات الأساسية"), l("Manage branch cities, categories, platforms, and controlled tags used across the system.", "إدارة مدن الأفرع والفئات والمنصات والعلامات المعتمدة المستخدمة عبر النظام."), { hideHeroStats: true })}
    ${state.currentUser?.role === "admin" && terms ? `
      <section class="panel terms-editor-card">
        <div class="row report-toolbar-head">
          <div>
            <h3>${l("Terms & Conditions", "الشروط والأحكام")}</h3>
            <p class="panel-subtitle">
              ${escapeHtml(
                l(
                  `Version ${terms.version} · Last updated ${formatDateTime(terms.updatedAt) || "-"}`,
                  `الإصدار ${terms.version} · آخر تحديث ${formatDateTime(terms.updatedAt) || "-"}`
                )
              )}
              ${termsUpdatedBy ? ` · ${escapeHtml(l("By", "بواسطة"))}: ${escapeHtml(termsUpdatedBy.fullName || termsUpdatedBy.email || "")}` : ""}
            </p>
          </div>
        </div>
        <form id="termsForm" class="form-grid terms-editor-form">
          <label class="field">
            <span>${l("English", "الإنجليزية")}</span>
            <textarea name="textEn" rows="14" required>${escapeHtml(terms.textEn || "")}</textarea>
          </label>
          <label class="field">
            <span>${l("Arabic", "العربية")}</span>
            <textarea name="textAr" rows="14" required dir="auto">${escapeHtml(terms.textAr || "")}</textarea>
          </label>
          <p class="compact field-span-full">
            ${escapeHtml(
              l(
                "Members will see the new text on the public terms page and at future enrollments. Existing members are not re-prompted.",
                "سيشاهد الأعضاء النص الجديد في صفحة الشروط العامة وعند التسجيلات المستقبلية. لن تتم إعادة مطالبة الأعضاء الحاليين."
              )
            )}
          </p>
          <div class="row-wrap field-span-full">
            <button type="submit">${l("Save Terms & Conditions", "حفظ الشروط والأحكام")}</button>
          </div>
        </form>
      </section>
    ` : ""}
    <section class="panel">
      <div class="row report-toolbar-head">
        <div>
          <h3>${l("Cities", "المدن")}</h3>
          <p class="panel-subtitle">${l("This list applies only to branch locations. Member residential cities are managed through the address reference data.", "تنطبق هذه القائمة على مواقع الأفرع فقط. مدن سكن الأعضاء تُدار عبر بيانات مرجع العناوين.")}</p>
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
          <p class="panel-subtitle">${l("Control the allowed tag library here so campaigns and member profiles only use approved tags.", "تحكم في مكتبة العلامات المسموح بها هنا حتى تستخدم الحملات وملفات الأعضاء العلامات المعتمدة فقط.")}</p>
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
          <p class="panel-subtitle">${l("Use campaign-only filters to review campaign performance without mixing member or posting conditions.", "استخدم فلاتر الحملات فقط لمراجعة أداء الحملات دون خلط شروط الأعضاء أو النشر.")}</p>
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
          <h3>${l("Member Filters", "فلاتر الأعضاء")}</h3>
          <p class="panel-subtitle">${l("Review member activity by profile and participation history only.", "راجع نشاط الأعضاء حسب الملف الشخصي وسجل المشاركة فقط.")}</p>
        </div>
        <button type="button" class="secondary" data-action="clear-report-filters">${l("Clear filters", "مسح الفلاتر")}</button>
      </div>
      <form class="form-grid reports-filter-grid" id="reportFilterForm">
        <label class="field"><span>${l("Member", "العضو")}</span><input name="query" value="${escapeHtml(filters.query || "")}" placeholder="${l("Search by name or email", "ابحث بالاسم أو البريد")}" /></label>
        <div class="field field-span-full">
          <span>${l("Residential location", "مكان السكن")}</span>
          <div class="form-grid two-col">
            ${renderResidentialCascadeFields({
              prefix: "residential",
              value: residentialFromSelection(filters),
              includeAll: true,
            })}
          </div>
        </div>
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
        <label class="field"><span>${l("Member", "العضو")}</span>
          <select name="influencerId">
            <option value="">${l("All members", "كل الأعضاء")}</option>
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
    if (!residentialMatchesFilters(row.residential, filters)) return false;
    if (filters.categoryId && !includesCategory(row.categoryIds, filters.categoryId)) return false;
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
    if (key === "city") return residentialTier3Name(row.residential);
    if (key === "category") return categorySummary(row.categoryIds);
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
    copy: l("Member reporting focused on participation quality, completion, and follow-up needs.", "تقارير الأعضاء تركز على جودة المشاركة والاكتمال واحتياجات المتابعة."),
    heroStats: [
      { label: l("Member total", "إجمالي الأعضاء"), value: String(rows.length), note: l("Number of members included in this report after filters.", "عدد الأعضاء المشمولين في هذا التقرير بعد تطبيق الفلاتر.") },
      { label: l("Campaign joins", "انضمام الحملات"), value: String(totalJoins), note: l("How many times the filtered members clicked interested and joined campaigns.", "عدد المرات التي ضغط فيها الأعضاء المفلترون على الاهتمام وانضموا إلى الحملات.") },
      { label: l("Proof rate", "معدل الإثبات"), value: `${proofRate}%`, note: l("Share of member joins that turned into submitted proof links.", "نسبة انضمامات الأعضاء التي تحولت إلى روابط إثبات مُرسلة.") },
    ],
    body: `
      ${renderInfluencerFilters(filters)}
      <section class="panel">
        <h3>${l("Member report", "تقرير الأعضاء")}</h3>
        <p class="panel-subtitle">${l("A table-first report showing member profile filters, campaign joins, proof submissions, pending proof, and a direct link back to the members page.", "تقرير يعتمد على الجدول أولاً ويعرض فلاتر ملف العضو وانضمام الحملات وإثباتات النشر والإثباتات المعلقة ورابطاً مباشراً للعودة إلى صفحة الأعضاء.")}</p>
        <p class="compact"><strong>${rows.length}</strong> ${l("members in this filtered report.", "عضواً ضمن هذا التقرير بعد الفلترة.")}</p>
        ${renderDataTable(
          [
            {
              label: l("Member", "العضو"),
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
            { label: l("City", "المدينة"), render: (row) => residentialTier3Name(row.residential), sortKey: "city" },
            { label: l("Categories", "الفئات"), render: (row) => categorySummary(row.categoryIds, { compact: true }), sortKey: "category" },
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
          l("No member rows match the current member filters.", "لا توجد بيانات أعضاء مطابقة لفلاتر الأعضاء الحالية."),
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
        <p class="panel-subtitle">${l("This is the clean operational queue of members who joined a campaign but still have not submitted their proof link. Use the campaign filter above to narrow this queue to one campaign only.", "هذه هي القائمة التشغيلية الواضحة للأعضاء الذين انضموا إلى حملة لكنهم لم يرسلوا رابط الإثبات بعد. استخدم فلتر الحملة أعلاه لحصر هذه القائمة في حملة واحدة فقط.")}</p>
        ${renderDataTable(
          [
            { label: l("Campaign", "الحملة"), render: (row) => renderCampaignTitleLink(row.campaign || row), html: true },
            {
              label: l("Member", "العضو"),
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
        <p class="panel-subtitle">${l("Review each submitted link with its campaign, member, platform, and submission date.", "راجع كل رابط تم تسليمه مع الحملة والعضو والمنصة وتاريخ التسليم.")}</p>
        ${renderDataTable(
          [
            { label: l("Campaign", "الحملة"), render: (row) => renderCampaignTitleLink(row.campaign || row), html: true, sortKey: "campaign" },
            {
              label: l("Member", "العضو"),
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
            note: l("Codes still open for the next reservation or member join.", "أكواد ما زالت مفتوحة للحجز أو لانضمام عضو جديد."),
          },
          {
            label: l("Online reserved", "محجوز أونلاين"),
            value: String(summary.onlineReserved),
            note: l("Codes reserved by members who joined inside the platform.", "أكواد حجزها أعضاء انضموا من داخل المنصة."),
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
  const participants = state.data?.participants || [];
  const readyToSubmit = participants.filter((participant) => participantCanSubmit(participant));
  const eligible = eligibleCampaigns();
  const previewCampaigns = state.data?.previewCampaigns || [];
  const journalEntries = state.data?.journalEntries || [];
  const me = state.currentUser || {};
  const firstName = String(me.fullName || me.name || "").trim().split(/\s+/)[0] || l("there", "بكم");

  const greeting = `
    <header class="member-hero">
      <div class="member-hero__brand">
        <span class="member-hero__wordmark">PICK<em>Social Club</em></span>
      </div>
      <div class="member-hero__welcome">
        <h1 class="member-hero__title">${escapeHtml(l(`Hi ${firstName}.`, `أهلاً ${firstName}.`))}</h1>
        <p class="member-hero__subtitle">${escapeHtml(l("Issue", "العدد"))} ${escapeHtml(memberIssueNumber())} · ${escapeHtml(formatDate(new Date()))}</p>
      </div>
      ${renderNotificationsBell()}
    </header>
    <hr class="rule rule--thick">
  `;

  const footer = `
    <button class="pill-button" data-nav="campaigns">${escapeHtml(l("All my campaigns", "كل حملاتي"))}</button>
    <button class="pill-button" data-nav="profile">${escapeHtml(l("My profile", "ملفي الشخصي"))}</button>
  `;

  const empty = !readyToSubmit.length && !eligible.length && !previewCampaigns.length && !journalEntries.length
    ? `<div class="empty-state member-feed__empty">${escapeHtml(l("You're all set. We'll let you know when there's a campaign for you 💜", "أنت جاهز. سنخبرك حالما تظهر حملة تناسبك 💜"))}</div>`
    : "";

  return `
    <div class="member-feed">
      <section class="block block--hero">${greeting}</section>
      ${renderDeskRail(readyToSubmit)}
      ${previewCampaigns.length ? `
        <section class="block block--blush">
          ${sectionHeader(
            l("COMING SOON", "قريباً"),
            l("On the calendar", "في الأجندة"),
            l("Campaigns we're cooking up.", "حملات نحضّرها لكم.")
          )}
          <div class="coming-soon-rail">
            ${previewCampaigns.map((campaign) => `
              <article class="coming-soon-card">
                ${renderCampaignBanner(campaign, "thumb")}
                <div class="coming-soon-card__body">
                  <span class="badge">${escapeHtml(l("Coming soon", "قريباً"))}</span>
                  <strong>${escapeHtml(campaignTitle(campaign))}</strong>
                  ${campaign.startDate ? `<p class="compact">${escapeHtml(l("Opens around", "يفتح قرابة"))} ${escapeHtml(formatDate(campaign.startDate))}</p>` : ""}
                </div>
              </article>
            `).join("")}
          </div>
        </section>
      ` : ""}
      ${eligible.length ? `
        <section class="block block--sage">
          ${sectionHeader(
            l("OPEN CAMPAIGNS", "حملات مفتوحة"),
            l("Take your pick", "اختر ما يناسبك"),
            l("Confirm interest on any that fit.", "أكّد اهتمامك على ما يناسبك."),
            eligible.length > 3 ? `<button class="link-button" data-nav="campaigns">${escapeHtml(l("See all", "عرض الكل"))} ${state.locale === "ar" ? "←" : "→"}</button>` : ""
          )}
          ${renderAvailableCampaignCards(eligible.slice(0, 3))}
        </section>
      ` : ""}
      ${renderJournalBlock(journalEntries)}
      ${footer ? `<section class="block block--mauve member-feed__footer">${footer}</section>` : ""}
      ${empty}
    </div>
  `;
}

function memberIssueNumber() {
  const launch = new Date("2026-01-01");
  const weeks = Math.max(1, Math.floor((Date.now() - launch.getTime()) / (1000 * 60 * 60 * 24 * 7)));
  return String(weeks).padStart(2, "0");
}

function sectionHeader(eyebrow, headline, subtitle, ctaButton = "") {
  return `
    <header class="section-head">
      <span class="kicker">${escapeHtml(eyebrow)}</span>
      <div class="section-head__row">
        <h3>${escapeHtml(headline)}</h3>
        ${ctaButton}
      </div>
      ${subtitle ? `<p class="section-head__deck">${escapeHtml(subtitle)}</p>` : ""}
    </header>
    <hr class="rule rule--hair">
  `;
}

function renderJournalBlock(journalEntries) {
  if (!journalEntries?.length) return "";

  const sorted = [...journalEntries].sort((left, right) => {
    const leftTime = new Date(left.publishedAt || left.createdAt || 0).getTime();
    const rightTime = new Date(right.publishedAt || right.createdAt || 0).getTime();
    return rightTime - leftTime;
  });

  const featured = sorted[0];
  const rest = sorted.slice(1, 4);
  const featuredBody = journalBody(featured) || "";

  const featuredCover = `
    <details class="journal-feature journal-expandable">
      <summary class="cover journal-feature__summary">
        <div class="cover__image-wrap">
          ${
            featured.imagePath
              ? `<img class="cover__image" src="${escapeHtml(featured.imagePath)}" alt="${escapeHtml(journalTitle(featured))}" />`
              : `<div class="cover__image cover__image--placeholder"><span>📓</span></div>`
          }
        </div>
        <div class="cover__text">
          <span class="kicker">${escapeHtml(l(`FEATURE NO. ${String(featured.id).padStart(2, "0")}`, `مقال رقم ${String(featured.id).padStart(2, "0")}`))}</span>
          <h2 class="cover__headline display-text">${escapeHtml(journalTitle(featured))}</h2>
          <p class="byline">${escapeHtml(l("Published", "نشر"))} · ${escapeHtml(formatDate(featured.publishedAt || featured.createdAt))}</p>
          <span class="cover__cta journal-toggle">
            <span class="journal-toggle__closed">${escapeHtml(l("Read the story", "اقرأ القصة"))} ↓</span>
            <span class="journal-toggle__open">${escapeHtml(l("Close", "إغلاق"))} ↑</span>
          </span>
        </div>
      </summary>
      <div class="journal-expandable__body">
        <p>${escapeHtml(featuredBody)}</p>
        ${
          featured.externalLink
            ? `<p class="journal-expandable__source"><a href="${escapeHtml(featured.externalLink)}" target="_blank" rel="noreferrer">${escapeHtml(l("View original", "عرض الأصلي"))} ${state.locale === "ar" ? "←" : "→"}</a></p>`
            : ""
        }
      </div>
    </details>
  `;

  const restGrid = rest.length
    ? `
      <div class="journal-more">
        ${rest.map((entry) => {
          const body = journalBody(entry) || "";
          return `
            <details class="journal-more__card journal-expandable">
              <summary class="journal-more__summary">
                ${
                  entry.imagePath
                    ? `<img class="journal-more__thumb" src="${escapeHtml(entry.imagePath)}" alt="${escapeHtml(journalTitle(entry))}" />`
                    : `<div class="journal-more__thumb journal-more__thumb--placeholder">📓</div>`
                }
                <div class="journal-more__body">
                  <strong>${escapeHtml(journalTitle(entry))}</strong>
                  <p class="journal-more__date">${escapeHtml(formatDate(entry.publishedAt || entry.createdAt))}</p>
                  <span class="journal-more__cta journal-toggle">
                    <span class="journal-toggle__closed">${escapeHtml(l("Read more", "اقرأ المزيد"))} ↓</span>
                    <span class="journal-toggle__open">${escapeHtml(l("Close", "إغلاق"))} ↑</span>
                  </span>
                </div>
              </summary>
              <div class="journal-expandable__body">
                <p>${escapeHtml(body)}</p>
                ${
                  entry.externalLink
                    ? `<p class="journal-expandable__source"><a href="${escapeHtml(entry.externalLink)}" target="_blank" rel="noreferrer">${escapeHtml(l("View original", "عرض الأصلي"))} ${state.locale === "ar" ? "←" : "→"}</a></p>`
                    : ""
                }
              </div>
            </details>
          `;
        }).join("")}
      </div>
    `
    : "";

  return `
    <section class="block block--ivory journal-block">
      <header class="section-head">
        <span class="kicker">${escapeHtml(l("THE JOURNAL", "اليوميات"))}</span>
        <div class="section-head__row">
          <h3>${escapeHtml(l("Latest reads", "أحدث القراءات"))}</h3>
        </div>
        <p class="section-head__deck">${escapeHtml(l("Stories, tips, and behind-the-scenes from the Club.", "قصص ونصائح ولقطات من خلف الكواليس."))}</p>
      </header>
      <hr class="rule rule--hair">
      ${featuredCover}
      ${restGrid}
    </section>
  `;
}

function renderAvailableCampaignsPage() {
  return renderMemberCampaignsPage();
}

function renderAvailableCampaignCards(campaigns) {
  if (!campaigns.length) {
    return `<div class="empty-state">${l("No campaigns matching you right now — we'll be in touch when there's something for you 💜", "لا توجد حملات تناسبك حالياً — سنخبرك عند توفر شيء يناسبك 💜")}</div>`;
  }

  return `<div class="stack">${campaigns
    .map(
      (campaign) => `
        <a class="campaign-card" data-action="preview-campaign" data-campaign-id="${campaign.id}" href="#campaign/${campaign.id}">
          <div class="campaign-card__image-wrap">
            ${renderCampaignBanner(campaign, "card")}
          </div>
          <div class="campaign-card__body">
            <h3 class="campaign-card__title">${escapeHtml(campaignTitle(campaign))}</h3>
            <p class="campaign-card__deck">${escapeHtml(campaignDescription(campaign))}</p>
            <div class="campaign-card__offer">
              <span class="offer-eyebrow">${escapeHtml(l("WHAT YOU GET", "ما الذي ستحصل عليه"))}</span>
              <strong class="offer-title">${escapeHtml(campaign.offerDescription || l("Campaign offer attached to this code.", "عرض الحملة مرتبط بهذا الكود."))}</strong>
              ${(campaign.offerUsageCount || 1) > 1
                ? `<span class="offer-uses">${escapeHtml(l("Uses", "عدد الاستخدام"))}: ${escapeHtml(campaign.offerUsageCount)}</span>`
                : ""}
            </div>
            <p class="campaign-card__meta">
              <span><strong>${escapeHtml(campaign.codeStats?.available ?? 0)}</strong> ${escapeHtml(l("codes left", "كود متبقي"))}</span>
              <span class="campaign-card__meta-sep">·</span>
              <span>${escapeHtml(l("Visit by", "آخر زيارة"))} ${escapeHtml(formatDate(campaign.visitDeadline))}</span>
            </p>
            <span class="campaign-card__cta">${escapeHtml(l("Get this code", "احصل على الكود"))}</span>
          </div>
        </a>
      `
    )
    .join("")}</div>`;
}

function renderMyCampaignsPage() {
  return renderMemberCampaignsPage();
}

function renderMemberCampaignsPage() {
  const participants = state.data?.participants || [];
  const eligible = eligibleCampaigns();
  const activeRows = participants.filter((participant) => participantCanSubmit(participant));
  const historyRows = participants
    .filter((participant) => !participantCanSubmit(participant) && participant.status !== "offline_reserved")
    .sort((left, right) => {
      const leftTime = new Date(left.submittedAt || left.joinedAt || 0).getTime();
      const rightTime = new Date(right.submittedAt || right.joinedAt || 0).getTime();
      return rightTime - leftTime;
    });
  const metaInner = `
    ${activeRows.length ? `<span><strong>${activeRows.length}</strong> ${l("in play", "نشطة")}</span>` : ""}
    ${eligible.length ? `<span><strong>${eligible.length}</strong> ${l("open", "مفتوحة")}</span>` : ""}
    ${historyRows.length ? `<span><strong>${historyRows.length}</strong> ${l("done", "منتهية")}</span>` : ""}
  `.trim();
  const headerMeta = metaInner ? `<p class="campaigns-hero__meta">${metaInner}</p>` : "";
  const slimHeader = `
    <section class="block block--hero campaigns-hero">
      <div class="campaigns-hero__top">
        <span class="kicker">${l("THE LINEUP", "البرنامج")}</span>
        ${typeof renderNotificationsBell === "function" ? renderNotificationsBell() : ""}
      </div>
      <h1 class="campaigns-hero__title">${l("Campaigns", "الحملات")}</h1>
      ${headerMeta}
      <hr class="rule rule--thick">
    </section>
  `;
  const campaignsBody = `
    ${activeRows.length ? `
      <section class="block block--bone" id="campaigns-active">
        <div class="section-head">
          <span class="kicker">${l("IN PLAY", "في اللعب")}</span>
          <div class="section-head__row">
            <h3>${l("Active", "النشطة")}</h3>
            <span class="badge">${activeRows.length}</span>
          </div>
          <p class="section-head__deck">${l("Your reserved codes. Submit your proof when ready.", "أكوادك المحجوزة. أرسل إثباتك عند الجاهزية.")}</p>
        </div>
        <hr class="rule rule--hair">
        ${renderMyCampaignCards(activeRows, false, false)}
      </section>
    ` : ""}
    ${eligible.length ? `
      <section class="block block--sage" id="campaigns-open">
        <div class="section-head">
          <span class="kicker">${l("OPEN", "مفتوحة")}</span>
          <div class="section-head__row">
            <h3>${l("Open campaigns", "حملات مفتوحة")}</h3>
            <span class="badge">${eligible.length} ${l("available", "متاحة")}</span>
          </div>
          <p class="section-head__deck">${l("Campaigns you can join right now.", "حملات يمكنك الانضمام إليها الآن.")}</p>
        </div>
        <hr class="rule rule--hair">
        ${renderAvailableCampaignCards(eligible)}
      </section>
    ` : ""}
    ${historyRows.length ? `
      <section class="block block--ivory" id="campaigns-history">
        <div class="section-head">
          <span class="kicker">${l("ARCHIVE", "السجل")}</span>
          <div class="section-head__row">
            <h3>${l("History", "السجل")}</h3>
            <span class="badge">${historyRows.length}</span>
          </div>
          <p class="section-head__deck">${l("Submitted, completed, and canceled campaigns.", "الحملات المرسلة والمكتملة والملغاة.")}</p>
        </div>
        <hr class="rule rule--hair">
        ${renderMyCampaignCards(historyRows, false, false)}
      </section>
    ` : ""}
    ${(!eligible.length && !activeRows.length && !historyRows.length) ? `
      <section class="block block--ivory">
        <div class="empty-state">${l("No campaigns yet. Check back later 💜", "لا توجد حملات بعد. تابعنا قريباً 💜")}</div>
      </section>
    ` : ""}
  `;

  return `
    <div class="member-feed">
      ${slimHeader}
      ${campaignsBody}
    </div>
  `;
}

function renderMemberCardSummary(participant, campaign, options = {}) {
  const actionable = Boolean(options.isActionable);
  return `
    <summary class="campaign-accordion-summary dashboard-summary${actionable ? " dashboard-summary--actionable" : ""}">
      <div class="campaign-accordion-summary__content">
        <div class="dashboard-summary__row">
          <strong class="dashboard-summary__title">${escapeHtml(campaignTitle(campaign))}</strong>
          <span class="badge ${statusTone(participant.status)}">${escapeHtml(participantStatusLabelShort(participant.status))}</span>
        </div>
        <div class="dashboard-card-meta">
          ${participantHasWallet(participant) ? `
            <span class="dashboard-card-code">
              <span class="dashboard-card-code__label">${escapeHtml(l("Reserved", "محجوز"))}</span>
              <span class="dashboard-card-code__value">${escapeHtml(l("Open your QR below", "افتح رمز QR بالأسفل"))}</span>
            </span>
          ` : ""}
          <span class="badge">${l("Submit by", "التسليم قبل")}: ${formatDate(campaign.submissionDeadline)}</span>
        </div>
      </div>
      ${
        actionable
          ? `
            <span class="dashboard-summary__cta">
              ${escapeHtml(l("Submit proof", "إرسال الإثبات"))} <span aria-hidden="true">${state.locale === "ar" ? "←" : "→"}</span>
            </span>
          `
          : ""
      }
    </summary>
  `;
}

function renderSubmissionForm(participant, campaign, options = {}) {
  const extraClass = options.extraClass ? ` ${options.extraClass}` : "";
  const hasSavedImages = Array.isArray(participant.images) && participant.images.length > 0;
  const hasSavedNotes = Boolean(String(participant.feedback || "").trim() || String(participant.platform || "").trim());
  return `
    <form class="form-grid submission-form submission-form--simple${extraClass}" data-participant-id="${participant.id}">
      ${
        campaign.captionGuide
          ? `
            <article class="note-card submission-form__guide">
              <strong>${l("Posting guide from PICK", "دليل النشر من PICK")}</strong>
              <p style="white-space: pre-wrap; margin-top: 8px;">${escapeHtml(campaign.captionGuide)}</p>
            </article>
          `
          : ""
      }
      <label class="field submission-form__primary">
        <span>${l("Paste your post link", "ألصق رابط منشورك")}</span>
        <input name="socialLink" type="url" required placeholder="https://instagram.com/p/..." value="${escapeHtml(participant.socialLink || "")}" />
      </label>

      <details class="submission-form__optional" ${hasSavedImages ? "open" : ""}>
        <summary>${l("Add screenshots (optional)", "أضف لقطات شاشة (اختياري)")}</summary>
        <div class="submission-form__images">
          <label class="field"><span>${l("Image 1", "الصورة 1")}</span><input name="image1" type="file" accept="image/*" /></label>
          <label class="field"><span>${l("Image 2", "الصورة 2")}</span><input name="image2" type="file" accept="image/*" /></label>
          <label class="field"><span>${l("Image 3", "الصورة 3")}</span><input name="image3" type="file" accept="image/*" /></label>
          <p class="compact">${l("Up to 3 images total.", "حتى 3 صور كحد أقصى.")}</p>
          <div class="row-wrap">${renderParticipantImages(participant.images || [])}</div>
        </div>
      </details>

      <details class="submission-form__optional" ${hasSavedNotes ? "open" : ""}>
        <summary>${l("Add a note (optional)", "أضف ملاحظة (اختياري)")}</summary>
        <label class="field"><span>${l("Feedback or notes", "ملاحظات")}</span><textarea name="feedback">${escapeHtml(participant.feedback || "")}</textarea></label>
        <label class="field"><span>${l("Platform", "المنصة")}</span>${renderPlatformSelect("platform", participant.platform || "")}</label>
      </details>

      <div class="submission-form__actions">
        <button type="submit" class="submission-form__submit">${l("Submit proof", "إرسال الإثبات")}</button>
      </div>
    </form>
  `;
}

function focusFirstActionableSubmission() {
  window.setTimeout(() => {
    const openCard = document.querySelector("details.campaign-accordion[open].campaign-accordion--actionable");
    if (!openCard) return;
    const linkInput = openCard.querySelector('input[name="socialLink"]');
    if (!linkInput) return;
    linkInput.focus({ preventScroll: false });
    linkInput.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 60);
}

function scrollToActiveCampaigns() {
  window.setTimeout(() => {
    const active = document.getElementById("campaigns-active");
    if (!active) return;
    const top = active.getBoundingClientRect().top + window.scrollY - 12;
    window.scrollTo({ top, behavior: "smooth" });
  }, 80);
}

function renderMyCampaignCards(participants, compactOnly, proofOnly = false) {
  const sortedParticipants = [...participants].sort((left, right) => {
    const priorityDiff = participantPriority(left) - participantPriority(right);
    if (priorityDiff !== 0) return priorityDiff;
    const leftDate = new Date(left.submittedAt || left.joinedAt || 0).getTime();
    const rightDate = new Date(right.submittedAt || right.joinedAt || 0).getTime();
    return rightDate - leftDate;
  });
  const useAccordion = true;
  const firstActionableIndex = sortedParticipants.findIndex((participant) => participantCanSubmit(participant));
  const targetExists = Boolean(state.targetActiveParticipantId) && sortedParticipants.some((participant) => participant.id === state.targetActiveParticipantId);

  return participants.length
    ? `<div class="stack">${sortedParticipants
        .map((participant, index) => {
          const campaign = currentCampaigns().find((item) => item.id === participant.campaignId);
          if (!campaign) return "";
          const pendingForm = participantCanSubmit(participant) && !compactOnly ? renderSubmissionForm(participant, campaign) : "";
          const dashboardBodyBlock = `
            <p class="compact" style="margin-top: 10px;">
              ${l("Show your QR or read the reference at any PICK branch to redeem the offer. Then post and submit your proof below.", "اعرض رمز الـQR أو اقرأ الرقم المرجعي في أي فرع PICK لاستلام العرض، ثم انشر وأرسل إثباتك أدناه.")}
            </p>
            ${renderReservationDetails(participant, campaign)}
            ${pendingForm}
            ${participant.status === "confirmed" && participant.source !== "offline" ? `
              <div class="row-wrap" style="margin-top: 12px;">
                <button class="secondary" data-action="cancel-participation" data-participant-id="${participant.id}">${l("Cancel participation", "إلغاء المشاركة")}</button>
              </div>
            ` : ""}
          `;
          const submittedBlock = ["submitted", "completed"].includes(participant.status) && !participantCanSubmit(participant) && !proofOnly ? `
            <article class="note-card" style="margin-top: 14px;">
              <strong>${l("Submitted Proof", "الإثبات المرسل")}</strong>
              <p>${participant.socialLink ? `<a href="${participant.socialLink}" target="_blank" rel="noreferrer">${escapeHtml(participant.socialLink)}</a>` : "-"}</p>
              <p>${escapeHtml(participant.feedback || l("No feedback added.", "لا توجد ملاحظات."))}</p>
              <p class="compact">${l("This submission is now view-only.", "هذا التسليم أصبح للعرض فقط.")}</p>
              <div class="row-wrap">${renderParticipantImages(participant.images || [])}</div>
            </article>
          ` : "";
          const richMyCampaignsBody = `
            ${renderCampaignBanner(campaign, "wide")}
            <p>${escapeHtml(campaignDescription(campaign))}</p>
            ${renderReservationDetails(participant, campaign)}
            ${participant.canceledReason ? `<p class="compact">${l("Canceled reason", "سبب الإلغاء")}: ${escapeHtml(participant.canceledReason)}</p>` : ""}
            <div class="row-wrap" style="margin-top: 12px;">
              <span class="badge">${l("Visit deadline", "آخر موعد للزيارة")}: ${formatDate(campaign.visitDeadline)}</span>
              <span class="badge">${l("Submission deadline", "آخر موعد للتسليم")}: ${formatDate(campaign.submissionDeadline)}</span>
            </div>
            ${pendingForm}
            ${submittedBlock}
            ${participant.status === "confirmed" && participant.source !== "offline" ? `
              <div class="row-wrap" style="margin-top: 12px;">
                <button class="secondary" data-action="cancel-participation" data-participant-id="${participant.id}">${l("Cancel participation", "إلغاء المشاركة")}</button>
              </div>
            ` : ""}
          `;
          const accordionBody = proofOnly ? dashboardBodyBlock : richMyCampaignsBody;

          if (useAccordion) {
            const isActionable = participantCanSubmit(participant);
            const hasTarget = targetExists && participant.id === state.targetActiveParticipantId;
            const isFirstActionable = isActionable && index === firstActionableIndex && !targetExists;
            const openAttr = hasTarget || isFirstActionable ? " open" : "";
            const accentClass = isActionable ? " campaign-accordion--actionable" : "";
            return `
              <details class="timeline-card campaign-accordion${accentClass}"${openAttr}>
                ${renderMemberCardSummary(participant, campaign, { isActionable })}
                <div class="campaign-accordion-body">
                  ${accordionBody}
                </div>
              </details>
            `;
          }
        })
        .join("")}</div>`
    : `<div class="empty-state">${proofOnly ? l("No campaigns waiting on your proof right now. Nice work 💜", "لا توجد حملات تنتظر إثباتك حالياً. عمل رائع 💜") : l("You have not joined any campaign yet.", "لم تنضم إلى أي حملة بعد.")}</div>`;
}

function renderInfluencerCampaignPreviewPage() {
  const campaign = selectedCampaign();
  if (!campaign) {
    state.rejectingCampaignId = null;
    return renderEmptyCampaignPage(l("No campaign selected.", "لا توجد حملة محددة."));
  }
  if (state.rejectingCampaignId && state.rejectingCampaignId !== campaign.id) {
    state.rejectingCampaignId = null;
  }
  const participant = myParticipantForCampaign(campaign.id);
  const isEligible = new Set(state.data?.eligibleCampaignIds || []).has(campaign.id);
  const isActive = participant && participantCanSubmit(participant);
  const alreadyDeclined = campaignWasDeclined(campaign.id);
  const rejecting = state.rejectingCampaignId === campaign.id;
  const previousCanceled = (state.data?.participants || []).find(
    (row) => row.campaignId === campaign.id && row.status === "canceled"
  );

  const hero = `
    <section class="block block--hero campaign-preview-hero">
      <div class="campaign-preview-hero__top">
        <span class="kicker">${escapeHtml(l("CAMPAIGN", "حملة"))}</span>
      </div>
      <h1 class="campaign-preview-hero__title display-text">${escapeHtml(campaignTitle(campaign))}</h1>
      <p class="campaign-preview-hero__deck">${escapeHtml(campaignDescription(campaign))}</p>
      <div class="campaign-preview-hero__meta">
        <span class="badge">${escapeHtml(campaignAudience(campaign))}</span>
        <span class="badge">${escapeHtml(l("Visit by", "آخر زيارة"))} ${escapeHtml(formatDate(campaign.visitDeadline))}</span>
        <span class="badge">${escapeHtml(l("Submit by", "آخر تسليم"))} ${escapeHtml(formatDate(campaign.submissionDeadline))}</span>
      </div>
      <hr class="rule rule--thick">
    </section>
  `;

  const bannerBlock = `
    <section class="block block--ivory campaign-preview-visual">
      ${renderCampaignBanner(campaign, "hero")}
      <div class="campaign-preview-offer">
        <span class="offer-eyebrow">${escapeHtml(l("What you get", "ما الذي ستحصل عليه"))}</span>
        <strong class="offer-title">${escapeHtml(campaign.offerDescription || l("Campaign offer attached to this code.", "عرض الحملة مرتبط بهذا الكود."))}</strong>
        ${(campaign.offerUsageCount || 1) > 1
          ? `<span class="offer-uses">${escapeHtml(l("Uses", "عدد الاستخدام"))}: ${escapeHtml(campaign.offerUsageCount)}</span>`
          : ""}
      </div>
    </section>
  `;

  const captionGuideBlock = campaign.captionGuide
    ? `
      <section class="block block--ivory">
        <header class="section-head">
          <span class="kicker">${escapeHtml(l("POSTING GUIDE", "دليل النشر"))}</span>
          <div class="section-head__row">
            <h3>${escapeHtml(l("How to post", "كيف تنشر"))}</h3>
          </div>
        </header>
        <hr class="rule rule--hair">
        <p class="campaign-preview-guide">${escapeHtml(campaign.captionGuide)}</p>
      </section>
    `
    : "";

  let statusBlock = "";
  if (participant && participant.status !== "canceled") {
    const blockPaper = isActive ? "block--brand" : "block--bone";
    const reservationChip = `
      <div class="campaign-preview-status__code">
        <span class="campaign-preview-status__code-label">${escapeHtml(l("Reserved", "محجوز"))}</span>
        <span class="campaign-preview-status__code-value">${escapeHtml(l("Open your QR or read your reference at the branch.", "افتح رمز QR أو اقرأ الرقم المرجعي عند الفرع."))}</span>
      </div>
    `;

    let helper = "";
    if (isActive) {
      helper = l(
        "Your reservation is ready. Visit any PICK branch with your QR or reference, then submit your proof below.",
        "حجزك جاهز. زر أي فرع PICK باستخدام رمز QR أو الرقم المرجعي، ثم أرسل إثباتك أدناه."
      );
    } else if (["submitted", "completed"].includes(participant.status)) {
      helper = l("Your proof has been submitted.", "تم إرسال إثباتك.");
    }

    const cancelBtn = (participant.status === "confirmed" || participant.status === "visited") &&
      participant.source !== "offline" &&
      !participant.submittedAt
      ? `
        <div class="row-wrap" style="margin-top: 14px;">
          <button class="secondary" data-action="cancel-participation" data-participant-id="${participant.id}">
            ${escapeHtml(l("Cancel participation", "إلغاء المشاركة"))}
          </button>
        </div>
      `
      : "";

    statusBlock = `
      <section class="block ${blockPaper} campaign-preview-status">
        <header class="section-head">
          <span class="kicker">${escapeHtml(l("YOUR PARTICIPATION", "مشاركتك"))}</span>
          <div class="section-head__row">
            <h3>${escapeHtml(participantStatusLabel(participant.status))}</h3>
          </div>
        </header>
        <hr class="rule rule--hair">
        ${reservationChip}
        ${renderSaveCodeButton(participant)}
        ${helper ? `<p class="campaign-preview-status__helper">${escapeHtml(helper)}</p>` : ""}
        ${cancelBtn}
      </section>
    `;
  }

  const submissionBlock = participant && participantCanSubmit(participant)
    ? `
      <section class="block block--ivory campaign-preview-submission">
        <header class="section-head">
          <span class="kicker">${escapeHtml(l("SUBMIT PROOF", "إرسال الإثبات"))}</span>
          <div class="section-head__row">
            <h3>${escapeHtml(l("Your post link", "رابط منشورك"))}</h3>
          </div>
          <p class="section-head__deck">${escapeHtml(l("Paste your post link and tap Submit. Optional notes and screenshots below.", "ألصق رابط منشورك واضغط إرسال. الملاحظات واللقطات اختيارية أدناه."))}</p>
        </header>
        <hr class="rule rule--hair">
        ${renderSubmissionForm(participant, campaign, { extraClass: "submission-form--preview" })}
      </section>
    `
    : "";

  const submittedBlock = participant && ["submitted", "completed"].includes(participant.status) && !participantCanSubmit(participant)
    ? `
      <section class="block block--ivory">
        <header class="section-head">
          <span class="kicker">${escapeHtml(l("YOUR SUBMISSION", "تسليمك"))}</span>
          <div class="section-head__row">
            <h3>${escapeHtml(l("Submitted proof", "الإثبات المرسل"))}</h3>
          </div>
        </header>
        <hr class="rule rule--hair">
        <p class="campaign-preview-link">${
          participant.socialLink
            ? `<a href="${escapeHtml(participant.socialLink)}" target="_blank" rel="noreferrer">${escapeHtml(participant.socialLink)}</a>`
            : escapeHtml(l("No link recorded.", "لا يوجد رابط مسجل."))
        }</p>
        ${participant.feedback ? `<p>${escapeHtml(participant.feedback)}</p>` : ""}
        <p class="compact">${escapeHtml(l("This submission is view-only.", "هذا التسليم للعرض فقط."))}</p>
        <div class="row-wrap" style="margin-top: 12px;">${renderParticipantImages(participant.images || [])}</div>
      </section>
    `
    : "";

  const previousNote = previousCanceled && !participant
    ? `
      <section class="block block--ivory campaign-preview-note">
        <p class="compact">${escapeHtml(l("You canceled this campaign before. Confirming interest will reserve a new code.", "ألغيتَ هذه الحملة سابقاً. تأكيد الاهتمام سيحجز لك كوداً جديداً."))}</p>
      </section>
    `
    : "";

  const canConfirm = shouldShowConfirmInterest(participant, isEligible);
  const canDecline = !participant && !alreadyDeclined && isEligible;
  const termsNote = canConfirm
    ? `
      <p class="campaign-preview-footer__terms-note">
        ${l(
          `By joining, you agree to the <a href="/terms" target="_blank" rel="noopener">Terms & Conditions</a>.`,
          `بالانضمام، فإنك توافق على <a href="/terms" target="_blank" rel="noopener">الشروط والأحكام</a>.`
        )}
      </p>
    `
    : "";

  let primaryRow = "";
  let rejectPanel = "";
  if (canConfirm && canDecline) {
    primaryRow = `
      <p class="campaign-preview-footer__helper">
        ${escapeHtml(
          l(
            "Please pick one. Confirming or rejecting helps the team plan early.",
            "اختر أحدهما من فضلك. التأكيد أو الرفض يساعد الفريق على التخطيط مبكراً."
          )
        )}
      </p>
      <div class="campaign-preview-footer__choice-row">
        <button class="reject-trigger" data-action="reject-open" data-campaign-id="${campaign.id}" ${rejecting ? "disabled" : ""}>
          ${escapeHtml(l("Reject", "رفض"))}
        </button>
        <button class="campaign-preview-footer__confirm" data-action="join-campaign" data-campaign-id="${campaign.id}" ${rejecting ? "disabled" : ""}>
          ${escapeHtml(l("Confirm interest", "تأكيد الاهتمام"))}
        </button>
      </div>
    `;

    if (rejecting) {
      rejectPanel = `
        <div class="reject-confirm-panel" role="alertdialog" aria-live="polite">
          <p class="reject-confirm-panel__question">${escapeHtml(
            l(
              "Reject this campaign? You won't be invited to it again, and the team will know to plan without you.",
              "هل تريد رفض هذه الحملة؟ لن تتم دعوتك إليها مرة أخرى، وسيعلم الفريق أن يخطط بدونك."
            )
          )}</p>
          <div class="reject-confirm-panel__actions">
            <button class="secondary" data-action="reject-cancel">${escapeHtml(l("Cancel", "إلغاء"))}</button>
            <button class="reject-confirm" data-action="decline-campaign" data-campaign-id="${campaign.id}">
              ${escapeHtml(l("Yes, reject", "نعم، ارفض"))}
            </button>
          </div>
        </div>
      `;
    }
  } else if (canConfirm) {
    primaryRow = `
      <div class="campaign-preview-footer__choice-row campaign-preview-footer__choice-row--single">
        <button class="campaign-preview-footer__confirm" data-action="join-campaign" data-campaign-id="${campaign.id}">
          ${escapeHtml(l("Confirm interest", "تأكيد الاهتمام"))}
        </button>
      </div>
    `;
  } else if (!participant && !isEligible) {
    primaryRow = `<span class="badge">${escapeHtml(l("Not currently available to join.", "غير متاحة حالياً للانضمام."))}</span>`;
  }

  const footer = `
    <section class="block block--mauve campaign-preview-footer">
      ${primaryRow}
      ${termsNote}
      ${rejectPanel}
      <div class="campaign-preview-footer__back-row">
        <button class="secondary" data-nav="campaigns">${escapeHtml(l("Back to campaigns", "العودة إلى الحملات"))}</button>
      </div>
    </section>
  `;

  return `
    <div class="member-feed">
      ${hero}
      ${bannerBlock}
      ${captionGuideBlock}
      ${statusBlock}
      ${submissionBlock}
      ${submittedBlock}
      ${previousNote}
      ${footer}
    </div>
  `;
}

function addressFieldLabel(key) {
  const labels = {
    governorateId: l("Governorate", "المحافظة"),
    areaId: l("Area", "المنطقة"),
    regionId: l("Region", "المنطقة"),
    cityId: l("City", "المدينة"),
    districtId: l("District", "الحي"),
    block: l("Block", "القطعة"),
    street: l("Street", "الشارع"),
    buildingNumber: l("Building number", "رقم المبنى"),
    floor: l("Floor", "الدور"),
    apartmentNumber: l("Apartment / unit", "الشقة / الوحدة"),
    paciNumber: l("PACI number", "الرقم الآلي"),
    postalCode: l("Postal code", "الرمز البريدي"),
    additionalNumber: l("Additional number", "الرقم الإضافي"),
    landmark: l("Landmark", "علامة مميزة"),
  };
  return labels[key] || key;
}

function addressFieldLine(label, value) {
  if (!value) return "";
  return `${label}: ${value}`;
}

function localizedAddressValue(address, field) {
  if (!address) return "";
  if (field === "governorateId") return addressLocalizedName(addressRowById(kuwaitGovernorates(), address.governorateId));
  if (field === "areaId") return addressLocalizedName(addressRowById(addressReference().kuwait?.areas || [], address.areaId));
  if (field === "regionId") return addressLocalizedName(addressRowById(saudiRegions(), address.regionId));
  if (field === "cityId") return addressLocalizedName(addressRowById(addressReference().saudiArabia?.cities || [], address.cityId));
  if (field === "districtId") return addressLocalizedName(addressRowById(addressReference().saudiArabia?.districts || [], address.districtId));
  return address[field] || "";
}

function formattedAddressLines(address, options = {}) {
  if (!address?.country) return [];
  const lines = options.includeCountry === false ? [] : [`${addressCountryFlag(address.country)} ${addressCountryName(address.country)}`];
  if (address.country === "KW") {
    lines.push(addressFieldLine(addressFieldLabel("governorateId"), localizedAddressValue(address, "governorateId")));
    lines.push(addressFieldLine(addressFieldLabel("areaId"), localizedAddressValue(address, "areaId")));
    lines.push(addressFieldLine(addressFieldLabel("block"), address.block));
    lines.push(addressFieldLine(addressFieldLabel("street"), address.street));
    lines.push(addressFieldLine(addressFieldLabel("buildingNumber"), address.buildingNumber));
    lines.push(addressFieldLine(addressFieldLabel("floor"), address.floor));
    lines.push(addressFieldLine(addressFieldLabel("apartmentNumber"), address.apartmentNumber));
    lines.push(addressFieldLine(addressFieldLabel("paciNumber"), address.paciNumber));
    lines.push(addressFieldLine(addressFieldLabel("landmark"), address.landmark));
  } else if (address.country === "SA") {
    lines.push(addressFieldLine(addressFieldLabel("regionId"), localizedAddressValue(address, "regionId")));
    lines.push(addressFieldLine(addressFieldLabel("cityId"), address.cityOther || localizedAddressValue(address, "cityId")));
    lines.push(addressFieldLine(addressFieldLabel("districtId"), address.districtOther || localizedAddressValue(address, "districtId")));
    lines.push(addressFieldLine(addressFieldLabel("street"), address.street));
    lines.push(addressFieldLine(addressFieldLabel("buildingNumber"), address.buildingNumber));
    lines.push(addressFieldLine(addressFieldLabel("floor"), address.floor));
    lines.push(addressFieldLine(addressFieldLabel("apartmentNumber"), address.apartmentNumber));
    lines.push(addressFieldLine(addressFieldLabel("postalCode"), address.postalCode));
    lines.push(addressFieldLine(addressFieldLabel("additionalNumber"), address.additionalNumber));
    lines.push(addressFieldLine(addressFieldLabel("landmark"), address.landmark));
  }
  return lines.filter(Boolean);
}

function formattedAddressHtml(address, options = {}) {
  return formattedAddressLines(address, options).map((line) => escapeHtml(line)).join("<br />");
}

function formattedAddressText(address, userName = "") {
  return [userName, ...formattedAddressLines(address)].filter(Boolean).join("\n");
}

function addressApiErrorMessage(code) {
  const messages = {
    invalid_payload: l("Could not read the address details.", "تعذر قراءة بيانات العنوان."),
    invalid_country: l("Please choose Kuwait or Saudi Arabia.", "يرجى اختيار الكويت أو السعودية."),
    invalid_governorate: l("Choose a valid governorate.", "اختر محافظة صحيحة."),
    invalid_area: l("Choose a valid area.", "اختر منطقة صحيحة."),
    area_governorate_mismatch: l("That area does not belong to the selected governorate.", "هذه المنطقة لا تتبع المحافظة المختارة."),
    invalid_paci: l("PACI number must be exactly 8 digits.", "الرقم الآلي يجب أن يكون 8 أرقام."),
    invalid_region: l("Choose a valid region.", "اختر منطقة صحيحة."),
    invalid_city: l("Choose a valid city.", "اختر مدينة صحيحة."),
    city_region_mismatch: l("That city does not belong to the selected region.", "هذه المدينة لا تتبع المنطقة المختارة."),
    invalid_district: l("Choose a valid district.", "اختر حياً صحيحاً."),
    district_city_mismatch: l("That district does not belong to the selected city.", "هذا الحي لا يتبع المدينة المختارة."),
    invalid_postal: l("Postal code must be exactly 5 digits.", "الرمز البريدي يجب أن يكون 5 أرقام."),
    invalid_additional: l("Additional number must be exactly 4 digits.", "الرقم الإضافي يجب أن يكون 4 أرقام."),
  };
  return messages[code] || code || l("Address could not be saved.", "تعذر حفظ العنوان.");
}

function applyAddressApiErrors(form, code, message) {
  const mappings = {
    invalid_country: ["country"],
    invalid_governorate: ["governorateId"],
    invalid_area: ["areaId"],
    area_governorate_mismatch: ["governorateId", "areaId"],
    invalid_paci: ["paciNumber"],
    invalid_region: ["regionId"],
    invalid_city: ["cityId"],
    city_region_mismatch: ["regionId", "cityId"],
    invalid_district: ["districtId"],
    district_city_mismatch: ["cityId", "districtId"],
    invalid_postal: ["postalCode"],
    invalid_additional: ["additionalNumber"],
  };
  (mappings[code] || []).forEach((name) => setFieldError(form, name, message));
  syncInvalidFields(form);
}

function renderShippingAddressSearchSelect({ field, label, options, placeholder, disabled = false, otherLabel = "" }) {
  const draft = shippingAddressDraftValue();
  const open = state.shippingAddressPickerOpen === field && !disabled;
  const query = addressSearchQuery(field);
  const selectedValue = draft[field] || "";
  const selectedOption = addressRowById(options, selectedValue);
  const selectedLabel = isAddressOtherSelection(selectedValue)
    ? otherLabel
    : addressLocalizedName(selectedOption);
  const filtered = (options || []).filter((option) =>
    addressLocalizedName(option).toLowerCase().includes(query.toLowerCase())
  );
  const optionButtons = filtered
    .map(
      (option) => `
        <button
          type="button"
          class="search-select__option${selectedValue === option.id ? " is-selected" : ""}"
          data-action="select-shipping-address-option"
          data-field="${field}"
          data-value="${option.id}"
        >
          ${escapeHtml(addressLocalizedName(option))}
        </button>
      `
    )
    .join("");

  return `
    <label class="field field--search-select${disabled ? " is-disabled" : ""}" data-shipping-address-field="${field}">
      <span>${label}</span>
      <input type="hidden" name="${field}" value="${escapeHtml(isAddressOtherSelection(selectedValue) ? "" : selectedValue)}" />
      <button
        type="button"
        class="search-select__trigger"
        data-action="toggle-shipping-address-picker"
        data-field="${field}"
        ${disabled ? "disabled" : ""}
      >
        <span>${escapeHtml(selectedLabel || placeholder)}</span>
      </button>
      ${open ? `
        <div class="search-select__panel">
          <input
            id="shipping-address-query-${field}"
            type="search"
            class="search-select__input"
            data-shipping-address-query="${field}"
            placeholder="${escapeHtml(l("Type to filter", "اكتب للتصفية"))}"
            value="${escapeHtml(query)}"
            autocomplete="off"
          />
          <div class="search-select__options">
            ${optionButtons || `<p class="compact search-select__empty">${escapeHtml(l("No matches found.", "لا توجد نتائج مطابقة."))}</p>`}
            ${otherLabel ? `
              <button
                type="button"
                class="search-select__option${isAddressOtherSelection(selectedValue) ? " is-selected" : ""}"
                data-action="select-shipping-address-option"
                data-field="${field}"
                data-value="${ADDRESS_OTHER_VALUE}"
              >
                ${escapeHtml(otherLabel)}
              </button>
            ` : ""}
          </div>
        </div>
      ` : ""}
    </label>
  `;
}

function renderShippingAddressFields({ countryRequired = true } = {}) {
  const draft = shippingAddressDraftValue();
  const areaOptions = draft.governorateId ? kuwaitAreas(draft.governorateId) : [];
  const cityOptions = draft.regionId ? saudiCities(draft.regionId) : [];
  const districtOptions = draft.cityId && !isAddressOtherSelection(draft.cityId) ? saudiDistricts(draft.cityId) : [];

  return `
    <label class="field">
      <span>${l("Country", "الدولة")}</span>
      <select name="country" ${countryRequired ? "required" : ""}>
        <option value="">${escapeHtml(l("Select", "اختر"))}</option>
        ${(addressReference().countries || []).map((country) => `
          <option value="${country.code}" ${draft.country === country.code ? "selected" : ""}>${escapeHtml(addressLocalizedName(country))}</option>
        `).join("")}
      </select>
    </label>

    ${draft.country === "KW" ? `
      ${renderShippingAddressSearchSelect({
        field: "governorateId",
        label: l("Governorate", "المحافظة"),
        options: kuwaitGovernorates(),
        placeholder: l("Choose governorate", "اختر المحافظة"),
      })}
      ${renderShippingAddressSearchSelect({
        field: "areaId",
        label: l("Area", "المنطقة"),
        options: areaOptions,
        placeholder: draft.governorateId ? l("Choose area", "اختر المنطقة") : l("Pick governorate first", "اختر المحافظة أولاً"),
        disabled: !draft.governorateId,
      })}
      <label class="field"><span>${l("Block", "القطعة")}</span><input name="block" value="${escapeHtml(draft.block || "")}" /></label>
      <label class="field"><span>${l("Street", "الشارع")}</span><input name="street" value="${escapeHtml(draft.street || "")}" /></label>
      <label class="field"><span>${l("Building number", "رقم المبنى")}</span><input name="buildingNumber" value="${escapeHtml(draft.buildingNumber || "")}" /></label>
      <label class="field"><span>${l("Floor", "الدور")}</span><input name="floor" value="${escapeHtml(draft.floor || "")}" /></label>
      <label class="field"><span>${l("Apartment / unit", "الشقة / الوحدة")}</span><input name="apartmentNumber" value="${escapeHtml(draft.apartmentNumber || "")}" /></label>
      <label class="field"><span>${l("PACI number", "الرقم الآلي")}</span><input name="paciNumber" inputmode="numeric" maxlength="8" value="${escapeHtml(draft.paciNumber || "")}" /></label>
      <label class="field" style="grid-column: 1 / -1;"><span>${l("Landmark", "علامة مميزة")}</span><input name="landmark" value="${escapeHtml(draft.landmark || "")}" /></label>
    ` : ""}

    ${draft.country === "SA" ? `
      ${renderShippingAddressSearchSelect({
        field: "regionId",
        label: l("Region", "المنطقة"),
        options: saudiRegions(),
        placeholder: l("Choose region", "اختر المنطقة"),
      })}
      ${renderShippingAddressSearchSelect({
        field: "cityId",
        label: l("City", "المدينة"),
        options: cityOptions,
        placeholder: draft.regionId ? l("Choose city", "اختر المدينة") : l("Pick region first", "اختر المنطقة أولاً"),
        disabled: !draft.regionId,
        otherLabel: l("Other / not listed", "أخرى / غير مدرجة"),
      })}
      ${(draft.cityId === ADDRESS_OTHER_VALUE || (!draft.cityId && draft.cityOther)) ? `
        <label class="field"><span>${l("City (other)", "المدينة (أخرى)")}</span><input name="cityOther" value="${escapeHtml(draft.cityOther || "")}" /></label>
      ` : ""}
      ${renderShippingAddressSearchSelect({
        field: "districtId",
        label: l("District", "الحي"),
        options: districtOptions,
        placeholder: draft.cityId ? l("Choose district", "اختر الحي") : l("Pick city first", "اختر المدينة أولاً"),
        disabled: !draft.cityId,
        otherLabel: l("Other / not listed", "أخرى / غير مدرجة"),
      })}
      ${(draft.districtId === ADDRESS_OTHER_VALUE || (!draft.districtId && draft.districtOther)) ? `
        <label class="field"><span>${l("District (other)", "الحي (أخرى)")}</span><input name="districtOther" value="${escapeHtml(draft.districtOther || "")}" /></label>
      ` : ""}
      <label class="field"><span>${l("Street", "الشارع")}</span><input name="street" value="${escapeHtml(draft.street || "")}" /></label>
      <label class="field"><span>${l("Building number", "رقم المبنى")}</span><input name="buildingNumber" value="${escapeHtml(draft.buildingNumber || "")}" /></label>
      <label class="field"><span>${l("Floor", "الدور")}</span><input name="floor" value="${escapeHtml(draft.floor || "")}" /></label>
      <label class="field"><span>${l("Apartment / unit", "الشقة / الوحدة")}</span><input name="apartmentNumber" value="${escapeHtml(draft.apartmentNumber || "")}" /></label>
      <label class="field"><span>${l("Postal code", "الرمز البريدي")}</span><input name="postalCode" inputmode="numeric" maxlength="5" value="${escapeHtml(draft.postalCode || "")}" /></label>
      <label class="field"><span>${l("Additional number", "الرقم الإضافي")}</span><input name="additionalNumber" inputmode="numeric" maxlength="4" value="${escapeHtml(draft.additionalNumber || "")}" /></label>
      <label class="field" style="grid-column: 1 / -1;"><span>${l("Landmark", "علامة مميزة")}</span><input name="landmark" value="${escapeHtml(draft.landmark || "")}" /></label>
    ` : ""}
  `;
}

function renderShippingAddressEditor() {
  const hasSavedAddress = Boolean(currentShippingAddress());
  return `
    <form id="shippingAddressForm" class="form-grid two-col">
      ${renderShippingAddressFields({ countryRequired: true })}
      <div class="row-wrap shipping-address__actions" style="grid-column: 1 / -1;">
        <button type="submit">${l("Save address", "حفظ العنوان")}</button>
        <button type="button" class="secondary" data-action="cancel-shipping-address">${l("Cancel", "إلغاء")}</button>
        ${hasSavedAddress ? `<button type="button" class="link-button" data-action="clear-shipping-address">${l("Remove address", "حذف العنوان")}</button>` : ""}
      </div>
    </form>
  `;
}

function renderSignupAddressSection() {
  if (!state.signupAddressExpanded) {
    return `
      <div class="signup-address-signpost field-span-full">
        <div class="signup-address-signpost__copy">
          <strong>${escapeHtml(l("Shipping address (optional)", "عنوان الشحن (اختياري)"))}</strong>
          <span>${escapeHtml(l("Add it if you'd like to receive packages and gifts from PICK. You can also add it later from your profile.", "أضفه إذا كنت ترغب في استلام الطرود والهدايا من بِك. يمكنك إضافته لاحقاً من ملفك الشخصي."))}</span>
        </div>
        <button type="button" class="secondary button-small signup-address-signpost__toggle" data-action="open-signup-address">
          ${escapeHtml(l("+ Add address", "+ إضافة عنوان"))}
        </button>
      </div>
    `;
  }

  return `
    <section class="signup-address-panel field-span-full">
      <div class="row signup-address-panel__head">
        <div>
          <strong>${escapeHtml(l("Shipping address (optional)", "عنوان الشحن (اختياري)"))}</strong>
          <p class="compact">${escapeHtml(l("Add it if you'd like to receive packages and gifts from PICK. You can also add it later from your profile.", "أضفه إذا كنت ترغب في استلام الطرود والهدايا من بِك. يمكنك إضافته لاحقاً من ملفك الشخصي."))}</p>
        </div>
        <button type="button" class="link-button signup-address-panel__skip" data-action="skip-signup-address">${escapeHtml(l("Skip for now", "تخطّى"))}</button>
      </div>
      <div class="form-grid two-col signup-address-panel__fields">
        ${renderShippingAddressFields({ countryRequired: false })}
      </div>
    </section>
  `;
}

function renderShippingAddressSection(options = {}) {
  const user = options.user || editableProfileUser();
  const shippingState = shippingAddressStateForUser(user);
  const address = shippingState.address || null;
  const loading = Boolean(shippingState.loading && !shippingState.loaded);
  const errorMessage = shippingState.error || "";
  const editDisabled = loading ? "disabled" : "";
  if (!state.shippingAddressEditorOpen) {
    return `
      <section class="block block--bone shipping-address-block">
        <div class="row" style="justify-content: space-between; align-items: flex-start; gap: 12px;">
          <div>
            <p class="eyebrow">${escapeHtml(l("Shipping address", "عنوان الشحن"))}</p>
            <h3>${escapeHtml(l("Shipping address", "عنوان الشحن"))}</h3>
            <p class="panel-subtitle">${escapeHtml(
              address
                ? l("Saved for packages, gifts, and physical offers from PICK.", "محفوظ للشحنات والهدايا والعروض المادية من PICK.")
                : l("Add a shipping address to receive special packages and offers from PICK.", "أضف عنوان شحن لتصلك الهدايا والعروض الخاصة من PICK.")
            )}</p>
          </div>
          <button type="button" class="secondary" data-action="${address ? "edit-shipping-address" : "start-shipping-address"}" ${editDisabled}>
            ${escapeHtml(address ? l("Edit", "تعديل") : l("Add address", "إضافة عنوان"))}
          </button>
        </div>
        ${loading ? `<p class="compact">${escapeHtml(l("Loading saved address…", "جارٍ تحميل العنوان المحفوظ…"))}</p>` : ""}
        ${errorMessage ? `<p class="compact status-strip-danger">${escapeHtml(errorMessage)}</p>` : ""}
        ${address ? `
          <div class="address-summary">
            <p>${formattedAddressHtml(address)}</p>
            ${address.updatedAt ? `<p class="compact">${escapeHtml(l("Updated", "آخر تحديث"))}: ${escapeHtml(formatDate(address.updatedAt))}</p>` : ""}
          </div>
          <button type="button" class="link-button" data-action="clear-shipping-address">${escapeHtml(l("Remove address", "حذف العنوان"))}</button>
        ` : ""}
      </section>
    `;
  }

  return `
    <section class="block block--bone shipping-address-block">
      <p class="eyebrow">${escapeHtml(l("Shipping address", "عنوان الشحن"))}</p>
      <h3>${escapeHtml(l("Shipping address", "عنوان الشحن"))}</h3>
      <p class="panel-subtitle">${escapeHtml(l("Save a delivery address so PICK can send physical packages, gifts, and offers when needed.", "احفظ عنوان التوصيل حتى يتمكن PICK من إرسال الشحنات والهدايا والعروض المادية عند الحاجة."))}</p>
      ${renderShippingAddressEditor()}
    </section>
  `;
}

function renderAdminAddressCard(user) {
  const cardState = state.adminAddressCards[user.id] || { expanded: false, loading: false, loaded: false, address: null, error: "" };
  return `
    <article class="note-card profile-address-view">
      <div class="row" style="justify-content: space-between; align-items: center; gap: 12px;">
        <strong>${escapeHtml(l("Shipping address", "عنوان الشحن"))}</strong>
        <button
          type="button"
          class="secondary button-small"
          data-action="toggle-admin-address-card"
          data-user-id="${user.id}"
        >
          ${escapeHtml(cardState.expanded ? l("Hide", "إخفاء") : l("View", "عرض"))}
        </button>
      </div>
      ${cardState.expanded ? `
        <div class="profile-address-view__body">
          ${cardState.loading ? `<p class="compact">${escapeHtml(l("Loading address…", "جارٍ تحميل العنوان…"))}</p>` : ""}
          ${cardState.error ? `<p class="compact status-strip-danger">${escapeHtml(cardState.error)}</p>` : ""}
          ${cardState.loaded && !cardState.address ? `<p class="compact">${escapeHtml(l("Member has not added a shipping address.", "لم يضف العضو عنوان شحن بعد."))}</p>` : ""}
          ${cardState.address ? `
            <p class="profile-address-view__country">${escapeHtml(`${addressCountryFlag(cardState.address.country)} ${addressCountryName(cardState.address.country)}`)}</p>
            <p class="profile-address-view__copy">${formattedAddressHtml(cardState.address, { includeCountry: false })}</p>
            <div class="row-wrap" style="margin-top: 12px;">
              <button type="button" class="secondary button-small" data-action="copy-admin-address" data-user-id="${user.id}">${escapeHtml(l("Copy address", "نسخ العنوان"))}</button>
              ${cardState.address.updatedAt ? `<span class="compact">${escapeHtml(l("Updated", "آخر تحديث"))}: ${escapeHtml(formatDate(cardState.address.updatedAt))}</span>` : ""}
            </div>
          ` : ""}
        </div>
      ` : ""}
    </article>
  `;
}

function renderProfileEditorForm(user, options = {}) {
  const isInfluencer = user.role === "influencer";
  const formId = options.formId || "profileForm";
  const showReadonlyEmail = options.showReadonlyEmail === true;
  return `
    <form id="${formId}" class="form-grid two-col" enctype="multipart/form-data" data-user-id="${user.id}">
      <div class="profile-image-panel" style="grid-column: 1 / -1;">
        ${renderUserAvatar(user, "user-avatar--profile")}
        <div class="profile-image-panel__copy">
          <strong>${l("Profile image", "صورة الملف")}</strong>
          <p class="compact">${l("Optional for all roles. Upload JPG, PNG, WebP, or HEIC.", "اختيارية لكل الأدوار. ارفع JPG أو PNG أو WebP أو HEIC.")}</p>
        </div>
      </div>
      <label class="field" style="grid-column: 1 / -1;"><span>${l("Upload image", "رفع الصورة")}</span><input name="avatar" type="file" accept="image/*" /></label>
      <label class="field"><span>${l("Full name", "الاسم الكامل")} <em class="required-mark">*</em></span><input name="fullName" required value="${escapeHtml(user.fullName || "")}" /></label>
      ${showReadonlyEmail ? `
        <div class="field">
          <span>${escapeHtml(l("Email", "البريد الإلكتروني"))}</span>
          <strong>${escapeHtml(user.email || l("Not set", "غير محدد"))}</strong>
          <p class="compact">${escapeHtml(l("Email is managed in the dedicated account flow.", "يتم تعديل البريد من خلال مسار الحساب المخصص."))}</p>
        </div>
      ` : ""}
      <label class="field"><span>${l("Mobile", "الهاتف")}${isInfluencer ? ' <em class="required-mark">*</em>' : ""}</span>${renderKuwaitMobileField("mobile", user.mobile || "", isInfluencer)}</label>
      <label class="field"><span>${l("Gender", "الجنس")}${isInfluencer ? ' <em class="required-mark">*</em>' : ""}</span>${renderGenderSelect("gender", user.gender || "", isInfluencer)}</label>
      <label class="field"><span>${l("Date of birth", "تاريخ الميلاد")}</span><input name="dateOfBirth" type="date" value="${escapeHtml(user.dateOfBirth || "")}" /></label>
      <div class="field field-span-full profile-residential-block">
        <span>${l("Residential location", "مكان السكن")} <em class="required-mark">*</em></span>
        <p class="compact">${escapeHtml(l("This is used for campaign targeting and member filters.", "يُستخدم هذا لاستهداف الحملات وفلاتر الأعضاء."))}</p>
        <div class="form-grid two-col profile-residential-block__grid">
          ${renderResidentialCascadeFields({
            prefix: "residential",
            value: user.residential || emptyResidential(),
            required: true,
          })}
        </div>
      </div>
      ${renderCategoryChecklist({
        selectedValues: user.categoryIds || [],
        required: true,
        hint: l(
          "Pick at least one. Used to match you to campaigns.",
          "اختر فئة واحدة على الأقل. تُستخدم لمطابقتك بالحملات."
        ),
      })}
      <label class="field"><span>Instagram${isInfluencer ? ' <em class="required-mark">*</em>' : ""}</span><input name="instagram" ${isInfluencer ? "required" : ""} value="${escapeHtml(user.instagram || "")}" /></label>
      <label class="field"><span>Instagram followers</span><input name="instagramFollowers" type="number" value="${escapeHtml(user.followers?.instagram || 0)}" /></label>
      <label class="field"><span>TikTok</span><input name="tiktok" value="${escapeHtml(user.tiktok || "")}" /></label>
      <label class="field"><span>TikTok followers</span><input name="tiktokFollowers" type="number" value="${escapeHtml(user.followers?.tiktok || 0)}" /></label>
      <label class="field"><span>Snapchat</span><input name="snapchat" value="${escapeHtml(user.snapchat || "")}" /></label>
      <label class="field"><span>Snapchat followers</span><input name="snapchatFollowers" type="number" value="${escapeHtml(user.followers?.snapchat || 0)}" /></label>
      <label class="field"><span>${l("Preferred platform", "المنصة المفضلة")}</span>${renderPlatformSelect("preferredPlatform", user.preferredPlatform || "")}</label>
      <button type="submit" style="grid-column: 1 / -1;">${escapeHtml(options.submitLabel || l("Save profile", "حفظ الملف"))}</button>
    </form>
  `;
}

function renderProfilePage() {
  const user = state.currentUser;
  const isInfluencer = user.role === "influencer";
  const wrapperClass = isInfluencer ? "block block--ivory profile-block" : "panel";
  return `
    ${pageHeader(l("My Profile", "ملفي الشخصي"), l("Update your profile details, optional image, and social information. Changes apply immediately.", "حدّث تفاصيل ملفك وصورتك الاختيارية ومعلومات السوشيال. التعديلات تطبق فوراً."))}
    ${!user.residential?.country ? `<article class="status-strip-warning" style="margin-bottom: 18px;">${escapeHtml(l("Please complete your residential location before you continue using the club.", "يرجى إكمال مكان السكن قبل متابعة استخدام النادي."))}</article>` : ""}
    <section class="${wrapperClass}">
      <h3>${l("Profile Details", "تفاصيل الملف")}</h3>
      <p class="panel-subtitle">${isInfluencer
        ? l("Required fields are marked with *. For member profiles, full name, mobile, gender, residential location, interested categories, and Instagram are required.", "الحقول المطلوبة مميزة بعلامة *. وبالنسبة لملفات الأعضاء فإن الاسم الكامل والهاتف والجنس ومكان السكن والفئات المهتمة وإنستغرام مطلوبة.")
        : l("Required fields are marked with *. Everything else on this page is optional.", "الحقول المطلوبة مميزة بعلامة *. وكل ما عدا ذلك في هذه الصفحة اختياري.")}</p>
      ${renderProfileEditorForm(user)}
    </section>
    ${renderShippingAddressSection({ user })}
  `;
}

function renderAdminEditMemberPage() {
  const user = selectedInfluencer();
  if (!user) return renderEmptyCampaignPage(l("No member selected.", "لا يوجد عضو محدد."));
  return `
    ${pageHeader(
      l("Edit Member", "تعديل العضو"),
      l("Update this member's profile details, residential location, categories, and shipping address on their behalf.", "حدّث تفاصيل هذا العضو ومكان السكن والفئات وعنوان الشحن نيابةً عنه."),
      { hideHeroStats: true }
    )}
    <section class="panel">
      <h3>${escapeHtml(user.fullName)}</h3>
      <p class="panel-subtitle">${escapeHtml(user.email)}</p>
      <p class="compact">${escapeHtml(l("Email, password, and role are managed through dedicated admin actions.", "يتم إدارة البريد وكلمة المرور والدور من خلال إجراءات إدارة مخصصة."))}</p>
      ${renderProfileEditorForm(user, {
        formId: "adminProfileForm",
        submitLabel: l("Save member profile", "حفظ ملف العضو"),
        showReadonlyEmail: true,
      })}
    </section>
    <section class="panel">
      ${renderShippingAddressSection({ user })}
    </section>
  `;
}

function renderInfluencerProfilePage() {
  const user = selectedInfluencer();
  if (!user) return renderEmptyCampaignPage(l("No member selected.", "لا يوجد عضو محدد."));
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
      l("Member Profile", "ملف العضو"),
      l("Review the full member profile, performance, and campaign history from one page.", "راجع الملف الكامل للعضو والأداء وسجل الحملات من صفحة واحدة."),
      {
        heroStats: [
          { label: l("Account status", "حالة الحساب"), value: `<span class="hero-status-badge badge ${statusTone(user.status)}">${escapeHtml(user.status)}</span>`, allowHtml: true },
          { label: l("Residential city", "مدينة السكن"), value: residentialTier3Name(user.residential) || l("Not set", "غير محدد") },
          { label: l("Categories", "الفئات"), value: categorySummary(user.categoryIds) || l("Not set", "غير محدد") },
        ],
        compactHeroStats: true,
      }
    )}
    ${metricGrid([
      { label: l("Campaign joins", "انضمام الحملات"), value: String(summary.joined || 0), note: l("How many times this member joined a campaign.", "عدد المرات التي انضم فيها هذا العضو إلى حملة.") },
      { label: l("Submitted proofs", "الإثباتات المرسلة"), value: String(summary.submitted || 0), note: l("Proof links already submitted by this member.", "روابط الإثبات التي أرسلها هذا العضو بالفعل.") },
      { label: l("Pending proof", "إثباتات معلقة"), value: String(summary.pending || 0), note: l("Joined campaigns still waiting for this member's proof.", "الحملات المنضم إليها التي ما زالت بانتظار إثبات هذا العضو.") },
      { label: l("Proof rate", "معدل الإثبات"), value: `${summary.completionRate || 0}%`, note: l("Share of this member's joins that turned into proof submissions.", "نسبة انضمامات هذا العضو التي تحولت إلى إثباتات مرسلة.") },
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
          <div class="field" style="grid-column: 1 / -1;"><span>${l("Residential location", "مكان السكن")}</span><strong>${escapeHtml(residentialSummary(user.residential))}</strong></div>
          <div class="field" style="grid-column: 1 / -1;"><span>${l("Interested categories", "الفئات المهتمة")}</span><strong>${escapeHtml(categorySummary(user.categoryIds))}</strong></div>
          <div class="field"><span>Instagram</span><strong>${escapeHtml(user.instagram || "-")}</strong><p class="compact">${escapeHtml(String(user.followers?.instagram || 0))} ${escapeHtml(l("followers", "متابع"))}</p></div>
          <div class="field"><span>TikTok</span><strong>${escapeHtml(user.tiktok || "-")}</strong><p class="compact">${escapeHtml(String(user.followers?.tiktok || 0))} ${escapeHtml(l("followers", "متابع"))}</p></div>
          <div class="field"><span>Snapchat</span><strong>${escapeHtml(user.snapchat || "-")}</strong><p class="compact">${escapeHtml(String(user.followers?.snapchat || 0))} ${escapeHtml(l("followers", "متابع"))}</p></div>
          <div class="field"><span>${l("Signup date", "تاريخ التسجيل")}</span><strong>${escapeHtml(formatDate(user.createdAt))}</strong><p class="compact">${escapeHtml(l("Last activity", "آخر نشاط"))}: ${escapeHtml(formatDate(summary.lastActivityDate))}</p></div>
        </div>
        <article class="note-card" style="margin-top: 16px;">
          <strong>${l("Internal notes", "الملاحظات الداخلية")}</strong>
          <p>${escapeHtml((user.notes || []).length ? (user.notes || []).join(", ") : l("No internal notes yet.", "لا توجد ملاحظات داخلية بعد."))}</p>
        </article>
        ${renderAdminAddressCard(user)}
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
          <button type="button" class="secondary" data-action="edit-member" data-user-id="${user.id}">${l("Edit member", "تعديل العضو")}</button>
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
      <p class="panel-subtitle">${l("See every campaign this member joined, the assigned code, and the current proof state.", "اطلع على كل حملة انضم إليها هذا العضو والكود المخصص وحالة الإثبات الحالية.")}</p>
      ${renderDataTable(
        [
          { label: l("Campaign", "الحملة"), render: (row) => renderCampaignTitleLink(row), html: true },
          { label: l("Status", "الحالة"), render: (row) => `<span class="badge ${participantDisplayTone(row)}">${escapeHtml(participantDisplayStatus(row))}</span>`, html: true },
          { label: l("Code", "الكود"), render: (row) => row.assignedCodeValue || "-" },
          { label: l("Joined", "انضم"), render: (row) => formatDate(row.joinedAt) },
          { label: l("Submitted", "سلّم"), render: (row) => formatDate(row.submittedAt) },
        ],
        participants,
        l("No campaign history yet for this member.", "لا يوجد سجل حملات لهذا العضو بعد.")
      )}
    </section>
    <section class="panel">
      <h3>${l("Submitted posts", "المنشورات المرسلة")}</h3>
      <p class="panel-subtitle">${l("Review every submitted social link and feedback from this member.", "راجع كل رابط سوشيال وملاحظة تم إرسالها من هذا العضو.")}</p>
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
        l("No submitted posts yet for this member.", "لا توجد منشورات مرسلة لهذا العضو بعد.")
      )}
    </section>
  `;
}

function renderResidentialCascadeFields(options = {}) {
  const {
    prefix = "residential",
    value = emptyResidential(),
    required = false,
    includeAll = false,
  } = options;
  const selection = residentialSelectionFromValue(value);
  const country = selection.residentialCountry;
  const tier2Options = residentialTier2Options(country);
  const tier3Options = residentialTier3Options(country, selection.residentialTier2Id);
  const countryLabel = l("Country", "الدولة");
  const selectLabel = includeAll ? l("All", "الكل") : l("Select", "اختر");

  return `
    <div class="residential-cascade" data-residential-form data-residential-prefix="${prefix}" data-residential-include-all="${includeAll ? "1" : "0"}">
      <label class="field">
        <span>${countryLabel}${required ? ' <em class="required-mark">*</em>' : ""}</span>
        <select name="${prefix}Country" ${required ? "required" : ""}>
          <option value="">${escapeHtml(selectLabel)}</option>
          ${(addressReference().countries || []).map((countryRow) => `
            <option value="${countryRow.code}" ${selection.residentialCountry === countryRow.code ? "selected" : ""}>${escapeHtml(addressLocalizedName(countryRow))}</option>
          `).join("")}
        </select>
      </label>
      <label class="field">
        <span>${escapeHtml(residentialTier2Label(country))}${required ? ' <em class="required-mark">*</em>' : ""}</span>
        <select name="${prefix}Tier2Id" ${required ? "required" : ""} ${!country ? "disabled" : ""}>
          <option value="">${escapeHtml(includeAll ? l("All", "الكل") : !country ? l("Choose country first", "اختر الدولة أولاً") : l("Select", "اختر"))}</option>
          ${tier2Options.map((row) => `
            <option value="${row.id}" ${selection.residentialTier2Id === row.id ? "selected" : ""}>${escapeHtml(addressLocalizedName(row))}</option>
          `).join("")}
        </select>
      </label>
      <label class="field">
        <span>${escapeHtml(residentialTier3Label(country))}${required ? ' <em class="required-mark">*</em>' : ""}</span>
        <select name="${prefix}Tier3Id" ${required ? "required" : ""} ${!selection.residentialTier2Id ? "disabled" : ""}>
          <option value="">${escapeHtml(includeAll ? l("All", "الكل") : !selection.residentialTier2Id ? l("Choose previous level first", "اختر المستوى السابق أولاً") : l("Select", "اختر"))}</option>
          ${tier3Options.map((row) => `
            <option value="${row.id}" ${selection.residentialTier3Id === row.id ? "selected" : ""}>${escapeHtml(addressLocalizedName(row))}</option>
          `).join("")}
        </select>
      </label>
    </div>
  `;
}

function syncResidentialCascadeForm(container) {
  if (!container) return;
  const prefix = container.dataset.residentialPrefix || "residential";
  const includeAll = container.dataset.residentialIncludeAll === "1";
  const countrySelect = container.querySelector(`[name="${CSS.escape(prefix)}Country"]`);
  const tier2Select = container.querySelector(`[name="${CSS.escape(prefix)}Tier2Id"]`);
  const tier3Select = container.querySelector(`[name="${CSS.escape(prefix)}Tier3Id"]`);
  const tier2Label = tier2Select?.closest(".field")?.querySelector("span");
  const tier3Label = tier3Select?.closest(".field")?.querySelector("span");
  if (!countrySelect || !tier2Select || !tier3Select) return;

  const country = String(countrySelect.value || "").toUpperCase();
  const currentTier2 = String(tier2Select.value || "");
  const currentTier3 = String(tier3Select.value || "");
  const tier2Options = residentialTier2Options(country);
  const nextTier2Value = tier2Options.some((row) => row.id === currentTier2) ? currentTier2 : "";
  const tier3Options = residentialTier3Options(country, nextTier2Value);
  const nextTier3Value = tier3Options.some((row) => row.id === currentTier3) ? currentTier3 : "";

  if (tier2Label) {
    tier2Label.innerHTML = `${escapeHtml(residentialTier2Label(country))}${countrySelect.required ? ' <em class="required-mark">*</em>' : ""}`;
  }
  if (tier3Label) {
    tier3Label.innerHTML = `${escapeHtml(residentialTier3Label(country))}${countrySelect.required ? ' <em class="required-mark">*</em>' : ""}`;
  }

  tier2Select.disabled = !country;
  tier2Select.innerHTML = [
    `<option value="">${escapeHtml(includeAll ? l("All", "الكل") : !country ? l("Choose country first", "اختر الدولة أولاً") : l("Select", "اختر"))}</option>`,
    ...tier2Options.map((row) => `<option value="${row.id}" ${row.id === nextTier2Value ? "selected" : ""}>${escapeHtml(addressLocalizedName(row))}</option>`),
  ].join("");

  tier3Select.disabled = !nextTier2Value;
  tier3Select.innerHTML = [
    `<option value="">${escapeHtml(includeAll ? l("All", "الكل") : !nextTier2Value ? l("Choose previous level first", "اختر المستوى السابق أولاً") : l("Select", "اختر"))}</option>`,
    ...tier3Options.map((row) => `<option value="${row.id}" ${row.id === nextTier3Value ? "selected" : ""}>${escapeHtml(addressLocalizedName(row))}</option>`),
  ].join("");

  tier2Select.value = nextTier2Value;
  tier3Select.value = nextTier3Value;
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

function renderCategoryChecklist(options = {}) {
  const {
    name = "categoryIds",
    selectedValues = [],
    required = false,
    hint = "",
    fieldClass = "field checkbox-field field-span-full",
  } = options;
  const selectedIds = new Set(normalizeCategoryIds(selectedValues).map(String));
  const categories = (state.data?.categories || state.publicData?.categories || []).filter((category) => category.status === "active");
  return `
    <div class="${fieldClass}">
      <span>${l("Interested categories", "الفئات المهتمة")}${required ? ' <em class="required-mark">*</em>' : ""}</span>
      ${hint ? `<p class="compact">${escapeHtml(hint)}</p>` : ""}
      <div class="option-grid">
        ${categories.map((category) => `
          <label class="option-pill">
            <input type="checkbox" name="${name}" value="${category.id}" ${selectedIds.has(String(category.id)) ? "checked" : ""} />
            <span>${escapeHtml(state.locale === "ar" ? category.nameAr : category.nameEn)}</span>
          </label>
        `).join("")}
      </div>
    </div>
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
      `من نادي بك: ${titleAr}`,
      offer ? `العرض: ${offer}` : "",
      `الأفرع: ${branchSummary}`,
      `الزيارة قبل: ${visitDate}`,
      `التسليم قبل: ${submitDate}`,
      "",
      "أكّد اهتمامك من نادي بك لحجز كود خاص بك.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    `From PICK Social Club: ${titleEn}`,
    offer ? `Offer: ${offer}` : "",
    `Branches: ${branchSummary}`,
    `Visit by: ${visitDate}`,
    `Submit by: ${submitDate}`,
    "",
    "Confirm interest in PICK Social Club to reserve your private one-time code.",
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
  window.addEventListener("popstate", handlePopState);
  attachNotificationPanelTracking();
  setupNotificationToggleListener();
}

function toggleMobileNav(force) {
  const next = typeof force === "boolean" ? force : !state.mobileNavOpen;
  state.mobileNavOpen = next;
  document.body.classList.toggle("mobile-nav-locked", next);
  document.body.classList.toggle("nav-locked", next);
  render();
}

function handleOpenActive(participantId) {
  navigateTo("campaigns", {
    targetActiveParticipantId: Number(participantId) || null,
    justNavigatedToCampaigns: true,
  });
}

async function handleClick(event) {
  const target = event.target.closest("[data-action], [data-nav]");
  if (!target) return;

  if (target.dataset.nav) {
    event.preventDefault();
    document.body.classList.toggle("mobile-nav-locked", false);
    document.body.classList.toggle("nav-locked", false);
    state.mobileNavOpen = false;
    const nextPage = normalizePage(target.dataset.nav);
    const changed = navigateTo(nextPage, nextPage === "campaigns" && state.currentPage !== "campaigns"
      ? { justNavigatedToCampaigns: true }
      : {});
    if (!changed) render();
    return;
  }

  const action = target.dataset.action;
  if (action === "go-back") {
    event.preventDefault();
    goBack();
    return;
  }

  if (action === "toggle-mobile-nav") {
    toggleMobileNav();
    return;
  }

  if (action === "close-mobile-nav") {
    toggleMobileNav(false);
    return;
  }

  if (action === "open-active") {
    event.preventDefault();
    handleOpenActive(target.dataset.participantId);
    return;
  }

  if (action === "open-code-card") {
    event.preventDefault();
    event.stopPropagation();
    state.codeCardParticipantId = Number(target.dataset.participantId);
    render();
    return;
  }

  if (action === "open-signup-address") {
    event.preventDefault();
    openSignupAddressSection();
    render();
    return;
  }

  if (action === "skip-signup-address") {
    event.preventDefault();
    closeSignupAddressSection({ clearDraft: true });
    render();
    return;
  }

  if (action === "start-shipping-address" || action === "edit-shipping-address") {
    event.preventDefault();
    openShippingAddressEditor();
    render();
    return;
  }

  if (action === "cancel-shipping-address") {
    event.preventDefault();
    closeShippingAddressEditor();
    render();
    return;
  }

  if (action === "clear-shipping-address") {
    event.preventDefault();
    if (!window.confirm(l("Remove the saved shipping address?", "هل تريد حذف عنوان الشحن المحفوظ؟"))) return;
    try {
      const editingMember = isAdminMemberEditPage();
      const targetUser = editableProfileUser();
      const url = editingMember ? `/api/admin/users/${targetUser.id}/address` : "/api/me/address";
      await api(url, { method: "DELETE" });
      await loadBootstrap();
      closeShippingAddressEditor();
      if (editingMember && targetUser) {
        exitAdminMemberEdit(targetUser.id, l("Member shipping address removed.", "تم حذف عنوان شحن العضو."));
      } else {
        flash(l("Shipping address removed.", "تم حذف عنوان الشحن."), "success");
        render();
      }
    } catch (error) {
      flash(error.message, "error");
    }
    return;
  }

  if (action === "toggle-shipping-address-picker") {
    event.preventDefault();
    const field = target.dataset.field || "";
    const isOpen = state.shippingAddressPickerOpen === field;
    state.shippingAddressPickerOpen = isOpen ? "" : field;
    if (!isOpen) {
      setAddressSearchQuery(field, "");
    }
    render({ preserveFocus: true });
    if (!isOpen) {
      setTimeout(() => {
        document.getElementById(`shipping-address-query-${field}`)?.focus();
      }, 0);
    }
    return;
  }

  if (action === "select-shipping-address-option") {
    event.preventDefault();
    const field = target.dataset.field || "";
    updateShippingAddressDraft(field, target.dataset.value || "");
    state.shippingAddressPickerOpen = "";
    clearAddressSearchQuery(field);
    render();
    return;
  }

  if (action === "close-code-card" || action === "close-code-card-backdrop") {
    if (action === "close-code-card-backdrop" && event.target !== target) return;
    event.preventDefault();
    state.codeCardParticipantId = null;
    render();
    return;
  }

  if (action === "set-auth-mode") {
    state.authMode = target.dataset.mode;
    if (state.authMode !== "reset") state.generatedLink = "";
    state.signupDraft = null;
    resetSignupAddressState();
    render();
    return;
  }

  if (action === "dismiss-flash") {
    state.flash = null;
    window.clearTimeout(flash._timeout);
    syncFlashLayer();
    return;
  }

  if (action === "share-code-card") {
    event.preventDefault();
    const participantId = Number(target.dataset.participantId);
    const participant = (state.data?.participants || []).find((item) => item.id === participantId);
    const campaign = findCampaignForParticipant(participant);
    if (!participant || !campaign) return;

    const shareData = {
      title: `PICK Social Club — ${campaignTitle(campaign)}`,
      text: [
        `PICK reservation ref: ${participant.verificationRef || ""}`,
        `Campaign: ${campaignTitle(campaign)}`,
        `Visit by: ${formatDate(campaign.visitDeadline)}`,
        participant.verificationUrl,
      ].filter(Boolean).join("\n"),
    };

    try {
      const shareFile = await buildCodeCardShareFile(participant, campaign);
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [shareFile] }))) {
        await navigator.share({ ...shareData, files: [shareFile] });
      } else {
        downloadFile(shareFile);
        flash(l("Code card downloaded.", "تم تنزيل بطاقة الكود."), "success");
      }
    } catch (error) {
      if (error?.name !== "AbortError") {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(shareData.text).catch(() => {});
        }
        flash(error?.message || l("Could not share.", "تعذرت المشاركة."), "error");
      }
    }
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
    state.mobileNavOpen = false;
    document.body.classList.toggle("mobile-nav-locked", false);
    document.body.classList.toggle("nav-locked", false);
    closeShippingAddressEditor();
    state.currentUser = null;
    state.data = null;
    state.codeCardParticipantId = null;
    state.adminAddressCards = {};
    state.currentPage = null;
    state.navStack = [];
    state.generatedLink = "";
    state.signupDraft = null;
    resetSignupAddressState();
    state.authMode = "login";
    flash(l("Signed out.", "تم تسجيل الخروج."), "success");
    render();
    return;
  }

  if (action === "approve-user") {
    await mutateAndRefresh(`/api/users/${target.dataset.userId}/status`, { status: "active" }, l("Welcome them in 💜", "أهلاً به في النادي 💜"));
    return;
  }

  if (action === "reject-user") {
    await mutateAndRefresh(`/api/users/${target.dataset.userId}/status`, { status: "rejected" }, l("Member request rejected.", "تم رفض طلب العضوية."));
    return;
  }

  if (action === "set-user-status") {
    await mutateAndRefresh(`/api/users/${target.dataset.userId}/status`, { status: target.dataset.status }, l("Member status updated.", "تم تحديث حالة العضو."));
    return;
  }

  if (action === "toggle-password-editor") {
    const userId = Number(target.dataset.userId);
    state.passwordEditorUserId = state.passwordEditorUserId === userId ? null : userId;
    render();
    return;
  }

  if (action === "view-influencer") {
    navigateTo("influencer-profile", {
      selectedInfluencerId: Number(target.dataset.userId),
      influencerProfileReturnPage: state.currentPage,
    });
    return;
  }

  if (action === "edit-member") {
    event.preventDefault();
    const userId = Number(target.dataset.userId);
    const current = state.adminAddressCards[userId] || { expanded: false, loading: false, loaded: false, address: null, error: "" };
    navigateTo("admin-edit-member", { selectedInfluencerId: userId });
    if (!current.loaded && !current.loading) {
      ensureAdminAddressLoaded(userId);
    }
    return;
  }

  if (action === "back-from-influencer-profile") {
    navigateTo(state.influencerProfileReturnPage || "influencers");
    return;
  }

  if (action === "toggle-admin-address-card") {
    event.preventDefault();
    const userId = Number(target.dataset.userId);
    const current = state.adminAddressCards[userId] || { expanded: false, loading: false, loaded: false, address: null, error: "" };
    const expanded = !current.expanded;
    state.adminAddressCards = {
      ...state.adminAddressCards,
      [userId]: {
        ...current,
        expanded,
      },
    };
    render();
    if (!expanded || current.loaded || current.loading) return;
    await ensureAdminAddressLoaded(userId, { expanded: true });
    return;
  }

  if (action === "copy-admin-address") {
    event.preventDefault();
    const userId = Number(target.dataset.userId);
    const user = (state.data?.users || []).find((row) => row.id === userId);
    const address = state.adminAddressCards[userId]?.address;
    if (!address) return;
    try {
      await navigator.clipboard.writeText(formattedAddressText(address, user?.fullName || ""));
      flash(l("Address copied.", "تم نسخ العنوان."), "success");
    } catch (error) {
      flash(l("Could not copy the address.", "تعذر نسخ العنوان."), "error");
    }
    return;
  }

  if (action === "edit-branch") {
    navigateTo("branch-edit", { selectedBranchId: Number(target.dataset.branchId) });
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
    navigateTo("manager-edit", { selectedManagerId: Number(target.dataset.managerId) });
    return;
  }

  if (action === "back-to-branches") {
    navigateTo("branches", { selectedBranchId: null });
    return;
  }

  if (action === "back-to-managers") {
    state.passwordEditorUserId = null;
    navigateTo("managers", { selectedManagerId: null });
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
    navigateTo("campaign-edit", { selectedCampaignId: Number(target.dataset.campaignId) });
    return;
  }

  if (action === "edit-journal-entry") {
    navigateTo("journal", { selectedJournalEntryId: Number(target.dataset.entryId) });
    return;
  }

  if (action === "clear-journal-editor") {
    state.selectedJournalEntryId = null;
    render();
    return;
  }

  if (action === "toggle-journal-publish") {
    const entryId = Number(target.dataset.entryId);
    if (!entryId) return;
    await mutateAndRefresh(`/api/journal/${entryId}/publish`, {}, l("Journal entry updated.", "تم تحديث المنشور."));
    return;
  }

  if (action === "delete-journal-entry") {
    const entryId = Number(target.dataset.entryId);
    if (!entryId) return;
    if (!window.confirm(l("Delete this journal entry?", "هل تريد حذف هذا المنشور؟"))) return;
    if (state.selectedJournalEntryId === entryId) state.selectedJournalEntryId = null;
    await mutateAndRefresh(`/api/journal/${entryId}/delete`, {}, l("Journal entry deleted.", "تم حذف المنشور."));
    return;
  }

  if (action === "preview-campaign") {
    event.preventDefault();
    navigateTo("campaign-preview", { selectedCampaignId: Number(target.dataset.campaignId) });
    return;
  }

  if (action === "view-campaign") {
    const campaignId = Number(target.dataset.campaignId);
    try {
      const payload = await api(`/api/campaigns/${target.dataset.campaignId}/codes`);
      state.campaignCodesByCampaign[campaignId] = payload.codes;
      navigateTo("campaign-view", {
        selectedCampaignId: campaignId,
        manualReserveCodeId: null,
      });
    } catch (error) {
      flash(error.message, "error");
    }
    return;
  }

  if (action === "regenerate-verification-password") {
    const campaignId = Number(target.dataset.campaignId || state.selectedCampaignId);
    if (!campaignId) return;
    try {
      const payload = await api(`/api/campaigns/${campaignId}/regenerate-verification-password`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      await loadBootstrap();
      render();
      const input = document.querySelector('input[name="verificationPassword"]');
      if (input && payload?.verificationPassword) input.value = payload.verificationPassword;
      flash(l("New verification password generated.", "تم توليد كلمة تحقق جديدة."), "success");
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
      flash(l("Campaign duplicated as draft.", "تم نسخ الحملة كمسودة."), "success");
      navigateTo("campaign-edit", { selectedCampaignId: payload.campaign.id });
    } catch (error) {
      flash(error.message, "error");
    }
    return;
  }

  if (action === "back-to-campaigns") {
    navigateTo("campaigns", {
      manualReserveCodeId: null,
      justNavigatedToCampaigns: true,
    });
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

  if (action === "export-campaign-submissions") {
    const cid = target.dataset.campaignId;
    if (!cid) return;
    window.location.href = `/api/reports/export.csv?tab=submissions&campaignId=${encodeURIComponent(cid)}`;
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
      if (input.closest("[hidden]")) return;
      input.checked = mode === "all";
    });
    const campaignForm = target.closest("[data-campaign-targeting-form]");
    if (campaignForm) syncCampaignTargetingForm(campaignForm);
    return;
  }

  if (action === "join-campaign") {
    if (target.disabled) return;
    const campaignId = Number(target.dataset.campaignId);
    target.disabled = true;
    try {
      await api(`/api/campaigns/${campaignId}/join`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      await loadBootstrap();
      state.rejectingCampaignId = null;
      setTimeout(() => {
        const statusBlock = document.querySelector(".campaign-preview-status");
        if (statusBlock) {
          statusBlock.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);
      flash(l("Your code is reserved. See you at the branch 💜", "تم حجز كودك. نراك في الفرع 💜"), "success");
    } catch (error) {
      flash(error.message, "error");
    } finally {
      if (target.isConnected) target.disabled = false;
    }
    return;
  }

  if (action === "reject-open") {
    event.preventDefault();
    state.rejectingCampaignId = Number(target.dataset.campaignId);
    render();
    return;
  }

  if (action === "reject-cancel") {
    event.preventDefault();
    state.rejectingCampaignId = null;
    render();
    return;
  }

  if (action === "decline-campaign") {
    if (target.disabled) return;
    const campaignId = Number(target.dataset.campaignId);
    target.disabled = true;
    try {
      await api(`/api/campaigns/${campaignId}/decline`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      state.rejectingCampaignId = null;
      await loadBootstrap();
      navigateTo("campaigns");
      flash(
        l("Invitation rejected. The team will plan without you.", "تم رفض الدعوة. سيخطط الفريق بدونك."),
        "success"
      );
    } catch (error) {
      flash(error.message, "error");
    } finally {
      if (target.isConnected) target.disabled = false;
    }
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
    if (target.disabled) return;
    if (!window.confirm(l("Cancel this participation and release the reserved code?", "هل تريد إلغاء هذه المشاركة وإعادة الكود المحجوز؟"))) return;
    target.disabled = true;
    try {
      await mutateAndRefresh(`/api/participants/${target.dataset.participantId}/cancel`, {}, l("Participation canceled and code released.", "تم إلغاء المشاركة وإعادة الكود."), { rethrow: true });
    } finally {
      if (target.isConnected) target.disabled = false;
    }
    return;
  }

  if (action === "remove-participant") {
    if (!window.confirm(l("Remove this member from the campaign?", "هل تريد إزالة هذا العضو من الحملة؟"))) return;
    await mutateAndRefresh(`/api/participants/${target.dataset.participantId}/remove`, {}, l("Member removed from campaign.", "تمت إزالة العضو من الحملة."));
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
      state.signupDraft = null;
      resetSignupAddressState();
      state.navStack = [];
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
      const residential = residentialFromSelection(values);
      if (!residential.country) {
        const message = l("Please choose your country.", "يرجى اختيار دولتك.");
        setFieldError(form, "residentialCountry", message);
        reportFormValidity(form);
        throw new Error(message);
      }
      if (!residentialTier2Id(residential)) {
        const message = l("Please choose your governorate or region.", "يرجى اختيار المحافظة أو المنطقة.");
        setFieldError(form, "residentialTier2Id", message);
        reportFormValidity(form);
        throw new Error(message);
      }
      if (!residentialTier3Id(residential)) {
        const message = l("Please choose your city.", "يرجى اختيار مدينتك.");
        setFieldError(form, "residentialTier3Id", message);
        reportFormValidity(form);
        throw new Error(message);
      }
      const categoryIds = selectedCategoryIdsFromForm(form);
      if (!categoryIds.length) {
        const message = l("Please select at least one category.", "يُرجى اختيار فئة واحدة على الأقل.");
        setFieldError(form, "categoryIds", message);
        reportFormValidity(form);
        throw new Error(message);
      }
      if (!form.elements.termsAccepted?.checked) {
        const message = l("You must accept the Terms & Conditions to continue.", "يجب الموافقة على الشروط والأحكام للمتابعة.");
        setFieldError(form, "termsAccepted", message);
        reportFormValidity(form);
        throw new Error(message);
      }
      const signupAddress = pickSignupAddressPayload();
      const payload = {
        fullName: values.fullName,
        email: values.email,
        password: values.password,
        mobile: values.mobile,
        gender: values.gender,
        categoryIds,
        instagram: values.instagram,
        instagramFollowers: values.instagramFollowers,
        tiktok: values.tiktok,
        tiktokFollowers: values.tiktokFollowers,
        snapchat: values.snapchat,
        snapchatFollowers: values.snapchatFollowers,
        preferredPlatform: values.preferredPlatform,
        residential,
        termsAccepted: form.elements.termsAccepted?.checked === true,
        ...(signupAddress ? { address: signupAddress } : {}),
      };
      const response = await api("/api/signup", { method: "POST", body: JSON.stringify(payload) });
      state.signupDraft = null;
      resetSignupAddressState();
      state.authMode = "login";
      flash(
        response?.addressWarning
          ? l(
            "Your account was created, but we couldn't save your address. Please add it from your profile.",
            "تم إنشاء حسابك ولكن لم نتمكن من حفظ العنوان. يُرجى إضافته من ملفك الشخصي."
          )
          : l("We got your request. The team will review it and welcome you in soon.", "وصلنا طلبك. سنرحب بك قريباً بعد المراجعة."),
        response?.addressWarning ? "info" : "success"
      );
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
    if (form.id === "journalForm") {
      const formData = new FormData(form);
      if (event.submitter?.name) formData.set(event.submitter.name, event.submitter.value || "");
      const entryId = String(formData.get("entryId") || "");
      const url = entryId ? `/api/journal/${entryId}/update` : "/api/journal";
      await mutateAndRefresh(
        url,
        formData,
        event.submitter?.value === "1"
          ? l("Journal entry published.", "تم نشر المنشور.")
          : l("Journal draft saved.", "تم حفظ المسودة."),
        { rethrow: true }
      );
      state.selectedJournalEntryId = null;
      render();
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
      await mutateAndRefresh(`/api/users/${userId}/admin-update`, { tags, notes }, l("Member updated.", "تم تحديث العضو."), { rethrow: true });
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
    if (form.id === "shippingAddressForm") {
      const values = formDataToObject(new FormData(form));
      const payload = {
        ...normalizedShippingAddressPayload(shippingAddressDraftValue()),
        ...values,
      };
      if (!payload.country) {
        const message = l("Please choose a country.", "يرجى اختيار الدولة.");
        setFieldError(form, "country", message);
        reportFormValidity(form);
        throw new Error(message);
      }
      if (payload.country === "KW") {
        if (!payload.governorateId) {
          const message = l("Please choose a governorate.", "يرجى اختيار المحافظة.");
          setFieldError(form, "governorateId", message);
          reportFormValidity(form);
          throw new Error(message);
        }
        if (!payload.areaId) {
          const message = l("Please choose an area.", "يرجى اختيار المنطقة.");
          setFieldError(form, "areaId", message);
          reportFormValidity(form);
          throw new Error(message);
        }
      }
      if (payload.country === "SA") {
        if (!payload.regionId) {
          const message = l("Please choose a region.", "يرجى اختيار المنطقة.");
          setFieldError(form, "regionId", message);
          reportFormValidity(form);
          throw new Error(message);
        }
        if (!payload.cityId && !String(payload.cityOther || "").trim()) {
          const message = l("Please choose a city or enter the city name.", "يرجى اختيار المدينة أو كتابة اسمها.");
          setFieldError(form, "cityId", message);
          reportFormValidity(form);
          throw new Error(message);
        }
        if (!payload.districtId && !String(payload.districtOther || "").trim()) {
          const message = l("Please choose a district or enter the district name.", "يرجى اختيار الحي أو كتابة اسمه.");
          setFieldError(form, "districtId", message);
          reportFormValidity(form);
          throw new Error(message);
        }
      }
      try {
        const editingMember = isAdminMemberEditPage();
        const targetUser = editableProfileUser();
        const url = editingMember ? `/api/admin/users/${targetUser.id}/address` : "/api/me/address";
        await api(url, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        await loadBootstrap();
        closeShippingAddressEditor();
        if (editingMember && targetUser) {
          exitAdminMemberEdit(targetUser.id, l("Member profile updated.", "تم تحديث ملف العضو."));
        } else {
          flash(l("Shipping address saved.", "تم حفظ عنوان الشحن."), "success");
          render();
        }
        return;
      } catch (error) {
        const code = String(error.message || "");
        const message = addressApiErrorMessage(code);
        applyAddressApiErrors(form, code, message);
        throw new Error(message);
      }
    }
    if (form.id === "profileForm" || form.id === "adminProfileForm") {
      const formData = new FormData(form);
      const mobileError = validateKuwaitMobile(formData.get("mobile"));
      if (mobileError) {
        setFieldError(form, "mobile", mobileError);
        reportFormValidity(form);
        throw new Error(mobileError);
      }
      const residential = residentialFromSelection({
        residentialCountry: formData.get("residentialCountry"),
        residentialTier2Id: formData.get("residentialTier2Id"),
        residentialTier3Id: formData.get("residentialTier3Id"),
      });
      if (!residential.country) {
        const message = l("Please choose your country.", "يرجى اختيار دولتك.");
        setFieldError(form, "residentialCountry", message);
        reportFormValidity(form);
        throw new Error(message);
      }
      if (!residentialTier2Id(residential)) {
        const message = l("Please choose your governorate or region.", "يرجى اختيار المحافظة أو المنطقة.");
        setFieldError(form, "residentialTier2Id", message);
        reportFormValidity(form);
        throw new Error(message);
      }
      if (!residentialTier3Id(residential)) {
        const message = l("Please choose your city.", "يرجى اختيار مدينتك.");
        setFieldError(form, "residentialTier3Id", message);
        reportFormValidity(form);
        throw new Error(message);
      }
      const categoryIds = selectedCategoryIdsFromForm(form);
      if (!categoryIds.length) {
        const message = l("Please select at least one category.", "يُرجى اختيار فئة واحدة على الأقل.");
        setFieldError(form, "categoryIds", message);
        reportFormValidity(form);
        throw new Error(message);
      }
      const subjectUser = form.id === "adminProfileForm" ? selectedInfluencer() : state.currentUser;
      if (subjectUser?.role === "influencer") {
        if (!formData.get("mobile")) {
          const message = l("Mobile number is required.", "رقم الهاتف مطلوب.");
          setFieldError(form, "mobile", message);
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
      if (form.id === "adminProfileForm" && subjectUser) {
        try {
          await api(`/api/admin/users/${subjectUser.id}/profile`, {
            method: "PUT",
            body: formData,
          });
          await loadBootstrap();
          exitAdminMemberEdit(subjectUser.id, l("Member profile updated.", "تم تحديث ملف العضو."));
        } catch (error) {
          throw error;
        }
        return;
      }
      await mutateAndRefresh("/api/profile/update", formData, l("Saved 💜", "تم الحفظ 💜"), { rethrow: true });
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
    if (form.id === "termsForm") {
      const values = formDataToObject(new FormData(form));
      const payload = await api("/api/admin/terms", {
        method: "PUT",
        body: JSON.stringify(values),
      });
      await loadBootstrap();
      flash(
        l(
          `Terms & Conditions updated to version ${payload.version}. Members will see the new text on the public terms page and at future enrollments. Existing members are not re-prompted.`,
          `تم تحديث الشروط والأحكام إلى الإصدار ${payload.version}. سيشاهد الأعضاء النص الجديد في صفحة الشروط العامة وعند التسجيلات المستقبلية. لن تتم إعادة مطالبة الأعضاء الحاليين.`
        ),
        "success"
      );
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
  if (isResidentialFieldName(event.target.name || "")) {
    const residentialContainer = event.target.closest("[data-residential-form]");
    if (residentialContainer) syncResidentialCascadeForm(residentialContainer);
    if (event.target.closest("#signupForm")) {
      syncSignupResidentialDraftFromForm(event.target.form);
    }
  }
  if (event.target.closest("#signupForm") && event.target.name === "categoryIds") {
    syncSignupCategoryDraftFromForm(event.target.form);
  } else if (event.target.closest("#signupForm") && event.target.name === "termsAccepted") {
    updateSignupDraft(event.target.name, event.target.checked);
  } else if (event.target.closest("#signupForm") && event.target.name) {
    updateSignupDraft(event.target.name, event.target.value);
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

  if ((event.target.closest("#shippingAddressForm") || event.target.closest("#signupForm")) && isShippingAddressFieldName(event.target.name)) {
    if (event.target.name) {
      updateShippingAddressDraft(event.target.name, event.target.value);
    }
    if (event.target.name === "country") {
      state.shippingAddressPickerOpen = "";
      state.shippingAddressPickerQueries = {};
      render({ preserveFocus: true });
      return;
    }
  }

  if (event.target.closest("[data-campaign-targeting-form]")) {
    syncCampaignTargetingForm(event.target.form || event.target.closest("form"));
  }

  if (event.target.closest("#influencerFilterForm")) {
    const form = event.target.form;
    state.influencerFilters = {
      query: form.query.value,
      residentialCountry: form.residentialCountry.value,
      residentialTier2Id: form.residentialTier2Id.value,
      residentialTier3Id: form.residentialTier3Id.value,
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
    if (event.target.closest("#signupForm") && event.target.name) {
      updateSignupDraft(event.target.name, event.target.value);
    }
    return;
  }

  if (event.target.closest("#signupForm") && event.target.name) {
    if (event.target.name === "categoryIds") {
      syncSignupCategoryDraftFromForm(event.target.form);
    } else {
      updateSignupDraft(event.target.name, event.target.value);
    }
  }

  if (isResidentialFieldName(event.target.name || "")) {
    const residentialContainer = event.target.closest("[data-residential-form]");
    if (residentialContainer) syncResidentialCascadeForm(residentialContainer);
    if (event.target.closest("#signupForm")) {
      syncSignupResidentialDraftFromForm(event.target.form);
    }
  }

  if (event.target.matches("[name='campaignSearch']")) {
    state.campaignSearch = event.target.value;
    render({ preserveFocus: true });
    return;
  }

  if (event.target.closest("[data-campaign-targeting-form]")) {
    syncCampaignTargetingForm(event.target.form || event.target.closest("form"));
  }

  if (event.target.matches("[data-shipping-address-query]")) {
    setAddressSearchQuery(event.target.dataset.shippingAddressQuery || "", event.target.value);
    render({ preserveFocus: true });
    return;
  }

  if ((event.target.closest("#shippingAddressForm") || event.target.closest("#signupForm")) && isShippingAddressFieldName(event.target.name)) {
    updateShippingAddressDraft(event.target.name, event.target.value);
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
      residentialCountry: form.residentialCountry.value,
      residentialTier2Id: form.residentialTier2Id.value,
      residentialTier3Id: form.residentialTier3Id.value,
      categoryId: form.categoryId.value,
      status: form.status.value,
      tag: form.tag.value,
    };
    render({ preserveFocus: true });
    return;
  }
}

function handleKeyDown(event) {
  if (event.key === "Escape" && state.shippingAddressPickerOpen) {
    state.shippingAddressPickerOpen = "";
    render({ preserveFocus: true });
    return;
  }
  if (event.key === "Escape" && state.codeCardParticipantId) {
    state.codeCardParticipantId = null;
    render();
    return;
  }
  if (event.key === "Escape" && state.mobileNavOpen) {
    toggleMobileNav(false);
  }
}

function handleFocusOut(event) {
  if (!state.shippingAddressPickerOpen) return;
  const wrapper = event.target.closest(".field--search-select");
  if (!wrapper) return;
  const field = wrapper.dataset.shippingAddressField || "";
  if (!field) return;
  const relatedWrapper = event.relatedTarget?.closest?.(".field--search-select");
  if (relatedWrapper?.dataset.shippingAddressField === field) return;
  window.setTimeout(() => {
    if (state.shippingAddressPickerOpen !== field) return;
    const activeWrapper = document.activeElement?.closest?.(".field--search-select");
    if (activeWrapper?.dataset.shippingAddressField === field) return;
    state.shippingAddressPickerOpen = "";
    render({ preserveFocus: true });
  }, 40);
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
    previewMode: formData.get("previewMode") === "1",
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
    verificationPassword: formData.get("verificationPassword"),
    branchMode: formData.get("branchMode"),
    branchIds: formData.getAll("branchIds"),
    targetCountries: formData.getAll("targetCountries"),
    targetGovernorateIds: formData.getAll("targetGovernorateIds"),
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
