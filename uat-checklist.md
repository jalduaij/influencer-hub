# PICK Social Club UAT Checklist

Use this checklist on the PICK Social Club stage environment:

- Stage URL: `https://pick-influence-hub-stage.onrender.com`
- Goal: validate the end-to-end member and campaign experience before wider pilot use

## Test Accounts

- Admin: `sara@pick.internal` / `pick123`
- Campaign Manager: `nasser@pick.internal` / `pick123`
- Campaign Manager 2: `jalduaij@kdigtc.com` / `123`
- Influencer 1: `laila@example.com` / `pick123`
- Influencer 2: `maha@example.com` / `pick123`
- Influencer 3: `abdullah@example.com` / `pick123`

## How To Use This Checklist

- Mark each item as:
  - `Pass`
  - `Fail`
  - `Needs discussion`
- Add notes for anything unclear, missing, or confusing

## 1. Admin UAT

### Login And Navigation

- Admin can log in successfully
- Admin sees all expected sidebar items
- Admin can log out successfully

### Branches

- Open `Branches`
- Create a new branch
- Edit an existing branch by clicking its name
- Confirm branch image upload works
- Confirm branch city selection works
- Confirm branch appears correctly in campaign setup

### Master Data

- Open `Master Data`
- Add a new city
- Add a new category
- Add a new platform
- Add a new tag
- Edit each type from the table row
- Deactivate one item and confirm it no longer appears in future selections
- Use `Show inactive` and confirm inactive items remain manageable

### Managers

- Open `Managers`
- Create a new campaign manager
- Click manager name to open edit page
- Generate reset link
- Change manager password manually
- Activate or deactivate manager if needed

### Members

- Open `Influencer Management`
- Confirm pending approvals appear clearly
- Approve the pending influencer
- Confirm approved influencer can log in
- Open an influencer profile by clicking the name
- Reset influencer password
- Activate or deactivate influencer

## 2. Campaign Manager UAT

### Campaigns Page

- Open `Campaigns`
- Review KPI header cards
- Confirm campaign list is clean and understandable
- Open `View Campaign`
- Open `Edit Campaign`

### Create Campaign

- Create a new campaign with:
  - title
  - description
  - offer description
  - usage count
  - dates
  - branch scope
  - city/category/tag targeting
  - optional banner
- Confirm required fields are clearly marked
- Confirm timeline validation works
- Confirm target tags can be selected from controlled list

### Edit Campaign

- Edit campaign details successfully
- Change targeting rules
- Change banner
- Confirm branch selection behavior is correct
- Confirm date rules save correctly

### Code Management

- Upload a valid CSV of codes
- Confirm uploaded code count updates correctly
- Confirm code list is visible in `View Campaign`
- Reserve one code offline
- Confirm offline reservation appears correctly in participants and code list
- Remove one participant and confirm code becomes blocked

### Campaign Status

- Change a campaign to `Draft`
- Change a campaign to `Live`
- Change a campaign to `Deactivated`
- Confirm status behavior makes sense from manager perspective

## 3. Member UAT

### Login And Profile

- Influencer can log in successfully
- Required profile fields are clear:
  - full name
  - mobile
  - gender
  - city
  - Instagram
- Kuwait mobile input works correctly with `+965`
- Gender dropdown allows only `Male` or `Female`

### Available Campaigns

- Only eligible campaigns appear
- Campaign card shows:
  - banner
  - title
  - description
  - deadlines
  - offer
- `View` opens campaign preview correctly

### Join Campaign

- Confirm interest on an eligible campaign
- Private code is assigned immediately
- Assigned code and offer are visible

### My Campaigns

- Pending proof campaigns appear clearly at the top
- Submitted campaigns are collapsed and readable
- Long submitted links do not break layout
- Submitted proof is view-only

### Submit Proof

- Submit proof with:
  - platform
  - social link
  - feedback
  - optional image
- Confirm successful submission updates status correctly

## 4. Reports UAT

### Campaigns Report

- KPI meanings are understandable
- Filters work correctly
- Campaign report table shows useful campaign health data
- Reserve rate and posting rate feel meaningful

### Influencers Report

- Filters work by city, category, tag, status, platform, and signup date
- Sorting works on supported columns
- Influencer name opens full influencer profile
- Table reflects joins, proof submissions, pending proof, and proof rate correctly

### Submissions Report

- Platform mix is understandable
- Submission log sorting works
- Social link is clickable
- Pending proof queue is clear
- Influencer names open profile for follow-up

### Codes Report

- Code search works by code value
- Code status distinguishes online vs offline reserved
- Table reflects code state clearly

## 5. Cross-Role Workflow UAT

- Admin creates or updates master data
- Campaign Manager creates campaign
- Campaign Manager uploads codes
- Influencer joins campaign
- Influencer submits proof
- Campaign Manager sees result in reports
- Admin reviews users and master data safely

## 6. Negative Tests

- Invalid mobile number is rejected
- Missing required influencer profile fields are rejected
- Invalid campaign dates are rejected
- Duplicate code upload is handled safely
- Inactive master data does not appear in future selections
- Unapproved influencer cannot log in

## 7. Review Questions

- Is each role seeing only what they need?
- Is anything confusing or too manual?
- Is any important operational action missing?
- Are reports helpful for decision-making?
- What would block a real pilot?

## Sign-Off

- Admin review complete: `_____`
- Campaign manager review complete: `_____`
- Influencer review complete: `_____`
- Reports review complete: `_____`
- Ready for next iteration: `Yes / No`

## Notes

- __________________________________________
- __________________________________________
- __________________________________________
