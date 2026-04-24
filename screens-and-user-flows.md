# Influencer Management System - Screens And User Flows

## Experience Structure

The application has three role-based experiences:

- Admin
- Campaign Manager
- Influencer

The web app should also support:

- Arabic and English
- mobile-responsive screens
- clean internal navigation

## Global Screens

### 1. Login

Purpose:

- authenticate existing users
- allow language switching

Main elements:

- email
- password
- remember me
- forgot password
- language toggle

### 2. Influencer Registration

Purpose:

- allow new influencers to sign up

Main elements:

- full name
- email
- mobile
- password
- city
- gender
- category
- social handles
- follower counts
- preferred language
- submit button

Outcome:

- account created in pending approval state

### 3. Forgot Password

Purpose:

- request password reset

## Admin Screens

### 1. Admin Dashboard

Shows:

- total influencers
- pending approvals
- active campaigns
- joined influencers
- completed submissions
- quick links to approvals and campaigns

### 2. Influencer Management

Shows:

- influencer list
- filters by status, city, category
- profile summary
- approval actions
- suspend or reject actions
- invite influencer button

### 3. Influencer Detail

Shows:

- complete profile
- social handles
- follower counts
- account status
- admin notes
- campaign history

### 4. Invite Influencer

Purpose:

- create influencer invitation from admin side

### 5. Campaign List

Shows:

- drafts
- published campaigns
- active campaigns
- closed campaigns
- campaign performance snapshot
- uploaded code count and remaining code count

### 6. Campaign Detail

Shows:

- campaign info
- targeting rules
- uploaded code inventory summary
- participating influencers
- visit and submission progress
- notification text block for WhatsApp sharing

### 7. Reports

Shows:

- campaign metrics
- participation rates
- submission completion trends

## Campaign Manager Screens

### 1. Campaign Manager Dashboard

Shows:

- campaigns created by manager
- active campaign cards
- influencer participation summary
- upcoming deadlines

### 2. Create Campaign

Sections:

- basic information
- campaign type
- Arabic and English titles and descriptions
- start and end dates
- visit deadline
- submission deadline
- branch setup
- targeting rules
- code upload after creation
- publish action

### 3. Edit Campaign

Purpose:

- update draft or active campaign settings based on permissions

### 4. Campaign Participation View

Shows:

- eligible count
- joined influencers
- visited influencers
- submitted influencers
- uploaded and remaining code counts
- export-ready table

### 5. Code Upload

Purpose:

- allow Campaign Manager to upload campaign codes as a CSV file

Main elements:

- campaign selector
- CSV file upload
- uploaded count
- used count
- remaining count

### 6. Notification Text Generator

Purpose:

- generate a WhatsApp-friendly campaign announcement
- include campaign summary and campaign link

## Influencer Screens

### 1. Influencer Dashboard

Shows:

- profile completion reminder
- available campaigns
- joined campaigns
- pending actions
- upcoming deadlines

### 2. Profile Management

Fields:

- personal info
- city
- category
- language
- social platform usernames
- follower counts
- optional image

### 3. Available Campaigns

Shows:

- all eligible campaigns
- filters by type, deadline, branch city
- campaign cards with key details

### 4. Campaign Detail

Shows:

- campaign type
- description
- branches
- deadlines
- instructions
- eligibility confirmation
- join or confirm interest button

### 5. My Campaigns

Shows:

- joined campaigns
- current status
- assigned private code
- required next action

### 6. Visit Confirmation

Purpose:

- show the influencer's assigned private code and let them confirm the visit after using it in branch

Fields:

- campaign reference
- branch selection if required
- assigned code display
- visit date

### 7. Submission Screen

Purpose:

- submit campaign proof after visit

Fields:

- social media link
- feedback text
- optional image upload

## Primary User Flows

### Flow 1: Influencer Self-Registration

1. Influencer opens registration page.
2. Completes profile and account details.
3. Submits registration.
4. System creates pending account.
5. Admin reviews and approves.
6. Influencer can log in after approval.

### Flow 2: Admin Invites Influencer

1. Admin opens invite influencer screen.
2. Enters basic influencer details.
3. Sends invitation or creates account.
4. Influencer completes remaining profile data.
5. Account becomes active or pending based on admin choice.

### Flow 3: Campaign Creation And Publishing

1. Campaign Manager opens create campaign.
2. Selects type: shop visit or product trial.
3. Adds bilingual titles and descriptions.
4. Sets branches, deadlines, and targeting.
5. Saves draft or publishes the campaign shell.
6. Uploads the campaign code CSV file.
7. Eligible influencers can now see it once codes exist.

### Flow 4: Influencer Discovers And Joins Campaign

1. Influencer logs in.
2. Opens available campaigns.
3. Reviews campaign details.
4. Confirms interest.
5. System automatically creates a participant record.
6. System reserves one campaign code and assigns it to that influencer only.
7. Campaign appears under my campaigns with the assigned code.

### Flow 5: In-Store Visit Validation

1. Influencer visits branch.
2. Influencer presents the assigned code to cashier.
3. Cashier completes free-of-charge POS transaction.
4. The assigned code is used once in POS.
5. Influencer returns to the web app and confirms the visit.
6. System marks the assigned code as used and updates status to visited.

### Flow 6: Proof And Feedback Submission

1. Influencer opens joined campaign.
2. Clicks submit proof.
3. Enters social media link.
4. Writes feedback.
5. Optionally uploads image.
6. System marks record as submitted or completed.

### Flow 7: Campaign Monitoring

1. Admin or Campaign Manager opens dashboard.
2. Selects a campaign.
3. Reviews joined, visited, and submitted influencer counts.
4. Opens participant details if needed.
5. Exports or reviews report.

## Navigation Model

### Admin Navigation

- Dashboard
- Influencers
- Campaigns
- Reports
- Settings

### Campaign Manager Navigation

- Dashboard
- Campaigns
- Reports

### Influencer Navigation

- Dashboard
- Available Campaigns
- My Campaigns
- Profile

## MVP Screen Priority

Build first:

1. Login
2. Influencer registration
3. Admin dashboard
4. Influencer approval list
5. Campaign list
6. Create campaign
7. Campaign code CSV upload
8. Available campaigns
9. Campaign detail
10. My campaigns
11. Visit confirmation
12. Social link and feedback submission

Build second:

1. Reports
2. Invite influencer
3. Notification text generator
4. Richer profile and filtering tools
