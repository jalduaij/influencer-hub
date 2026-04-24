CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('admin', 'campaign_manager', 'influencer')),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  mobile TEXT,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'rejected', 'suspended')),
  preferred_language TEXT NOT NULL DEFAULT 'en' CHECK (preferred_language IN ('en', 'ar')),
  invited_by_user_id INTEGER,
  approved_by_user_id INTEGER,
  approved_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invited_by_user_id) REFERENCES users(id),
  FOREIGN KEY (approved_by_user_id) REFERENCES users(id)
);

CREATE TABLE influencer_profiles (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE,
  gender TEXT,
  nationality TEXT,
  city TEXT,
  category TEXT,
  bio TEXT,
  instagram_handle TEXT,
  tiktok_handle TEXT,
  snapchat_handle TEXT,
  instagram_followers INTEGER,
  tiktok_followers INTEGER,
  snapchat_followers INTEGER,
  engagement_notes TEXT,
  profile_image_path TEXT,
  admin_notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE branches (
  id INTEGER PRIMARY KEY,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  address_en TEXT,
  address_ar TEXT,
  city TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE campaigns (
  id INTEGER PRIMARY KEY,
  title_en TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  description_en TEXT NOT NULL,
  description_ar TEXT NOT NULL,
  campaign_type TEXT NOT NULL CHECK (campaign_type IN ('shop_visit', 'product_trial')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'active', 'closed', 'archived')),
  created_by_user_id INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  visit_deadline DATE,
  submission_deadline DATE,
  require_branch_selection BOOLEAN NOT NULL DEFAULT FALSE,
  require_visit_date BOOLEAN NOT NULL DEFAULT FALSE,
  cover_image_path TEXT,
  terms_en TEXT,
  terms_ar TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

CREATE TABLE campaign_branches (
  id INTEGER PRIMARY KEY,
  campaign_id INTEGER NOT NULL,
  branch_id INTEGER NOT NULL,
  daily_limit INTEGER,
  notes_en TEXT,
  notes_ar TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (campaign_id, branch_id),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
  FOREIGN KEY (branch_id) REFERENCES branches(id)
);

CREATE TABLE campaign_targeting_rules (
  id INTEGER PRIMARY KEY,
  campaign_id INTEGER NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('all', 'category', 'city', 'gender', 'platform', 'follower_range', 'tag')),
  rule_operator TEXT NOT NULL DEFAULT 'equals',
  rule_value TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);

CREATE TABLE campaign_codes (
  id INTEGER PRIMARY KEY,
  campaign_id INTEGER NOT NULL,
  code_value TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'used', 'void')),
  uploaded_by_user_id INTEGER,
  reserved_by_participant_id INTEGER UNIQUE,
  uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reserved_at TIMESTAMP,
  used_at TIMESTAMP,
  UNIQUE (campaign_id, code_value),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
  FOREIGN KEY (uploaded_by_user_id) REFERENCES users(id),
  FOREIGN KEY (reserved_by_participant_id) REFERENCES campaign_participants(id)
);

CREATE TABLE campaign_participants (
  id INTEGER PRIMARY KEY,
  campaign_id INTEGER NOT NULL,
  influencer_user_id INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('eligible', 'interested', 'confirmed', 'visited', 'submitted', 'completed', 'canceled')),
  assigned_campaign_code_id INTEGER UNIQUE,
  selected_branch_id INTEGER,
  selected_visit_date DATE,
  joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  visited_at TIMESTAMP,
  submitted_at TIMESTAMP,
  completed_at TIMESTAMP,
  UNIQUE (campaign_id, influencer_user_id),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
  FOREIGN KEY (influencer_user_id) REFERENCES users(id),
  FOREIGN KEY (selected_branch_id) REFERENCES branches(id),
  FOREIGN KEY (assigned_campaign_code_id) REFERENCES campaign_codes(id)
);

CREATE TABLE visit_validations (
  id INTEGER PRIMARY KEY,
  campaign_participant_id INTEGER NOT NULL UNIQUE,
  branch_id INTEGER NOT NULL,
  campaign_code_id INTEGER NOT NULL UNIQUE,
  validated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_participant_id) REFERENCES campaign_participants(id),
  FOREIGN KEY (branch_id) REFERENCES branches(id),
  FOREIGN KEY (campaign_code_id) REFERENCES campaign_codes(id)
);

CREATE TABLE submissions (
  id INTEGER PRIMARY KEY,
  campaign_participant_id INTEGER NOT NULL UNIQUE,
  social_link TEXT NOT NULL,
  feedback_text TEXT NOT NULL,
  submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_participant_id) REFERENCES campaign_participants(id)
);

CREATE TABLE submission_attachments (
  id INTEGER PRIMARY KEY,
  submission_id INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (submission_id) REFERENCES submissions(id)
);

CREATE TABLE notifications (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('new_campaign', 'reminder', 'approval', 'system')),
  channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp_text', 'in_app')),
  title_en TEXT,
  title_ar TEXT,
  body_en TEXT,
  body_ar TEXT,
  sent_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_dates ON campaigns(start_date, end_date);
CREATE INDEX idx_campaign_codes_campaign ON campaign_codes(campaign_id);
CREATE INDEX idx_campaign_codes_value ON campaign_codes(code_value);
CREATE INDEX idx_campaign_participants_campaign ON campaign_participants(campaign_id);
CREATE INDEX idx_campaign_participants_influencer ON campaign_participants(influencer_user_id);
