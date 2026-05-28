const {
  STORE_PATH,
  ensureRuntimeFiles,
  hashPassword,
  passwordStrengthError,
  readStore,
  writeStore,
} = require("../server");

function text(value) {
  return String(value ?? "").trim();
}

function usage() {
  return [
    "Usage:",
    '  node scripts/bootstrap-admin.js --full-name "Your Name" --email admin@example.com --password "StrongPass1"',
    "",
    "Optional:",
    "  --language en|ar",
    "",
    "Environment variable alternatives:",
    "  BOOTSTRAP_ADMIN_FULL_NAME",
    "  BOOTSTRAP_ADMIN_EMAIL",
    "  BOOTSTRAP_ADMIN_PASSWORD",
    "  BOOTSTRAP_ADMIN_LANGUAGE",
  ].join("\n");
}

function parseArgs(argv) {
  const parsed = {
    fullName: "",
    email: "",
    password: "",
    language: "",
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--help" || token === "-h") {
      parsed.help = true;
      continue;
    }
    if (token === "--full-name") {
      parsed.fullName = argv[index + 1] || "";
      index += 1;
      continue;
    }
    if (token === "--email") {
      parsed.email = argv[index + 1] || "";
      index += 1;
      continue;
    }
    if (token === "--password") {
      parsed.password = argv[index + 1] || "";
      index += 1;
      continue;
    }
    if (token === "--language") {
      parsed.language = argv[index + 1] || parsed.language;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${token}\n\n${usage()}`);
  }

  return parsed;
}

function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }

  const fullName = text(options.fullName || process.env.BOOTSTRAP_ADMIN_FULL_NAME);
  const email = text(options.email || process.env.BOOTSTRAP_ADMIN_EMAIL).toLowerCase();
  const password = String(options.password || process.env.BOOTSTRAP_ADMIN_PASSWORD || "");
  const preferredLanguage = text(options.language || process.env.BOOTSTRAP_ADMIN_LANGUAGE || "en").toLowerCase() === "ar" ? "ar" : "en";

  if (!fullName || !email || !password) {
    throw new Error(`Full name, email, and password are required.\n\n${usage()}`);
  }
  if (!looksLikeEmail(email)) {
    throw new Error("Email must be in a valid format.");
  }
  const passwordError = passwordStrengthError(password);
  if (passwordError) {
    throw new Error(passwordError);
  }

  await ensureRuntimeFiles();
  const store = await readStore();

  const existingUser = store.users.find((user) => text(user.email).toLowerCase() === email);
  if (existingUser) {
    if (existingUser.role === "admin") {
      console.log(`Admin ${email} already exists in ${STORE_PATH}; no changes.`);
      return;
    }
    throw new Error(`A user with email ${email} already exists (role: ${existingUser.role}).`);
  }
  const existingAdmin = store.users.find((user) => user.role === "admin");
  if (existingAdmin) {
    throw new Error(
      `Bootstrap refused because an admin already exists (${existingAdmin.email}). Use the app to manage admins from here.`
    );
  }

  const now = new Date().toISOString();
  const admin = {
    id: store.nextIds.user++,
    role: "admin",
    fullName,
    email,
    password: await hashPassword(password),
    status: "active",
    cityId: null,
    city: "",
    categoryId: null,
    category: "",
    preferredLanguage,
    mobile: "",
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
    createdAt: now,
    lastLogin: "",
    approvedByUserId: null,
    passwordResetMode: "",
  };

  store.users.push(admin);
  await writeStore(store);

  console.log(`Created admin ${email} in ${STORE_PATH}.`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
