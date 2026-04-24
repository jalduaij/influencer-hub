# Influencer Management System - Product Specification

## Overview

This web application is an internal bilingual (Arabic/English) influencer management system for PICK. It allows admins and campaign managers to create and run micro-influencer campaigns, invite or approve influencers, upload campaign POS codes from CSV files, track campaign participation, confirm in-store visits using campaign-linked POS codes, and collect post-visit social media links and feedback.

The MVP focuses on two campaign types:

- Shop Visit
- Product Trial

## Business Goal

Enable PICK to manage micro-influencer campaigns in one system instead of using manual coordination across chat groups and spreadsheets.

The system should help PICK:

- onboard and manage influencers
- publish targeted campaigns
- let influencers join eligible campaigns
- confirm offline store visits with a campaign-linked POS code
- collect social media proof and visit feedback
- report campaign progress and outcomes

## User Roles

### Admin

- full access to the system
- approve influencer registrations
- invite influencers
- manage users and permissions
- view all campaigns and analytics
- optionally create campaigns

### Campaign Manager

- create and publish campaigns directly
- define campaign targeting and rules
- monitor participation and submissions
- view campaign analytics

### Influencer

- sign up and maintain profile
- view all eligible campaigns
- confirm interest in campaigns
- attend campaigns in branch
- submit social media link and feedback after visit

## Core Assumptions

- Influencers can self-register.
- Admin approval is required before an influencer becomes active.
- Admin can also invite influencers directly.
- Campaign managers can create and publish campaigns without a separate approval step.
- Joining a campaign is automatic once the influencer confirms interest.
- When an influencer confirms interest, one campaign code is immediately reserved and assigned to that influencer only.
- No branch-staff login is needed in MVP.
- Visit validation depends on campaign codes uploaded by Campaign Manager in CSV format.
- The uploaded CSV file is the only system link between POS-generated codes and the influencer platform.
- The number of uploaded codes defines campaign capacity.
- Reserved codes must not be visible or reusable by any other influencer.
- Post-submission approval is not required in MVP.
- Influencers see all campaigns they are eligible for.
- Profile fields are flexible and mostly optional, except fields required by an admin during campaign setup or approval.
- A campaign can include multiple branches.
- By default, an influencer may attend any eligible branch unless the campaign manager configures a branch choice or visit scheduling requirement.

## Supported Languages

- Arabic
- English

The system should support bilingual content for the interface and key campaign fields.

## Campaign Types

### 1. Shop Visit

The influencer visits a selected or eligible PICK branch, completes the in-store journey, receives one of the POS-generated codes prepared for that campaign, and later submits that code in the platform.

### 2. Product Trial

The influencer attends the branch to try a product or receive a product trial experience, then submits the required social media link and feedback.

## Main Workflow

### 1. Influencer Onboarding

- Influencer signs up using the portal.
- Influencer fills profile information.
- Admin reviews and approves the account.
- Approved influencer can log in and see eligible campaigns.

### 2. Campaign Creation

- Campaign Manager or Admin creates a campaign.
- Defines campaign type, dates, targeting, branches, deadlines, and submission rules.
- Campaign Manager uploads a CSV file containing the valid campaign codes.
- The uploaded code pool becomes the maximum campaign participation count.
- Publishes the campaign.
- Eligible influencers can view the campaign immediately.

### 3. Campaign Discovery and Interest Confirmation

- Influencer logs in.
- Sees all eligible campaigns.
- Opens campaign details.
- Confirms interest.
- System automatically enrolls the influencer in that campaign if an unused code is still available.
- System immediately assigns one unique campaign code to that influencer.

### 4. Campaign Code Pool and POS Validation

- Campaign Manager uploads a CSV file of campaign codes.
- Each row in the CSV represents one valid code for that campaign.
- Codes are stored under that campaign only.
- If a campaign has 200 uploaded codes, at most 200 influencers can participate.
- Once an influencer confirms interest, one code is reserved for that influencer and removed from the available pool.

- Influencer visits the branch for the campaign.
- Influencer presents the assigned campaign code to cashier.
- Cashier completes a free-of-charge POS flow.
- The assigned code is one-time-use and cannot be shared with another influencer.
- After the visit, the system can mark the participation as visited using the previously assigned code.

### 5. Post-Visit Submission

- Influencer opens the joined campaign.
- Submits the social media post link.
- Writes free-text feedback.
- Optionally uploads images.
- Submission is marked complete without further approval.

### 6. Monitoring and Reporting

- Admin and Campaign Manager track campaign participation.
- Dashboard shows campaign status, interested influencers, completed visits, and submitted posts.
- Reports summarize campaign outcomes and influencer activity.

## Campaign Configuration

Each campaign should support the following fields.

### Basic Information

- campaign title
- campaign description
- campaign type
- cover image
- campaign terms and instructions
- language-specific content in Arabic and English

### Scheduling

- campaign start date
- campaign end date
- visit deadline
- submission deadline

### Participation Rules

- campaign capacity derived from uploaded code count
- one code automatically reserved per confirmed influencer
- optional maximum visits per branch per day
- optional branch selection requirement
- optional preferred visit date selection

### Targeting

- all influencers or filtered influencers
- category
- city
- gender
- platform
- follower range
- engagement or profile tags
- custom eligibility rules

### Branch Scope

- one or more PICK branches
- optional branch-specific notes

### Submission Rules

- require social media link
- allow optional image upload
- require free-text feedback

### Campaign Code Upload

- Campaign Manager uploads a CSV file after creating the campaign
- each code belongs to one campaign only
- each code is assigned to one influencer only
- each code can be used once only
- uploaded code count defines total capacity
- system should show uploaded, available, reserved, and used code counts

## Influencer Profile

The influencer profile should support optional fields so the business can expand matching and reporting later.

Suggested fields:

- full name
- mobile number
- email
- gender
- nationality
- city
- preferred language
- category or niche
- Instagram username
- TikTok username
- Snapchat username
- follower count by platform
- engagement notes
- profile status
- admin notes

## Status Model

### Influencer Account Status

- Pending Approval
- Active
- Rejected
- Suspended

### Campaign Status

- Draft
- Published
- Active
- Closed
- Archived

### Influencer Campaign Participation Status

- Eligible
- Interested
- Confirmed
- Visited
- Submitted
- Completed
- Canceled

## Notifications

MVP notification options:

- email notification for new campaign
- email notification for reminders
- WhatsApp-ready share text generated by the system for manual posting in groups

Suggested notification events:

- new campaign available
- campaign reminder before deadline
- visit deadline reminder
- submission deadline reminder

## Admin and Campaign Manager Dashboard

Dashboard should show:

- active campaigns
- draft campaigns
- total influencers
- pending influencer approvals
- interested influencers
- confirmed participations
- completed visits
- submitted social links
- feedback collected
- campaign code counts

No branch-level analytics are required in MVP.

## Analytics and Reports

MVP reporting should include:

- number of campaigns
- number of eligible influencers per campaign
- number of interested influencers per campaign
- number of confirmed or visited influencers
- number of completed submissions
- uploaded code count
- used code count
- remaining code count
- campaign completion rate
- collected post links
- feedback summary

The MVP does not need:

- cost per campaign
- conversion tracking
- payment management

## Screens

### Public / Auth

- login
- influencer registration
- forgot password

### Admin / Campaign Manager

- dashboard
- influencer list
- influencer approval screen
- campaign list
- create campaign
- edit campaign
- upload campaign codes from CSV
- campaign details and participation tracking
- reports
- notification text generator for WhatsApp sharing

### Influencer

- dashboard
- profile management
- available campaigns list
- campaign details
- my joined campaigns
- submit visit code
- submit post link and feedback

## Suggested Database Entities

### users

- id
- role
- name
- email
- mobile
- password hash
- status
- preferred language
- created at

### influencer_profiles

- user id
- gender
- nationality
- city
- category
- instagram handle
- tiktok handle
- snapchat handle
- follower counts
- notes

### branches

- id
- name ar
- name en
- address
- status

### campaigns

- id
- title ar
- title en
- description ar
- description en
- type
- status
- created by
- start date
- end date
- visit deadline
- submission deadline
- require branch selection
- require visit date

### campaign_branches

- id
- campaign id
- branch id
- daily limit

### campaign_targeting_rules

- id
- campaign id
- rule type
- rule operator
- rule value

### campaign_participants

- id
- campaign id
- influencer id
- status
- interested at
- assigned campaign code id
- visited at
- submitted at
- selected branch id
- selected visit date

### campaign_codes

- id
- campaign id
- code value
- status
- uploaded at
- uploaded by
- reserved by participant id
- reserved at
- used at

### visit_validations

- id
- campaign participant id
- branch id
- campaign code id
- validated at

### submissions

- id
- campaign participant id
- social link
- feedback text
- submitted at

### submission_attachments

- id
- submission id
- file path
- file type

### notifications

- id
- user id
- type
- title
- body
- channel
- sent at

## MVP Scope

The MVP should include:

- influencer self-registration
- admin approval for influencer accounts
- admin invitation of influencers
- bilingual login and portal
- influencer profiles
- campaign creation and publishing by campaign managers and admins
- CSV upload of campaign codes by campaign managers
- campaign targeting
- eligible campaign listing for influencers
- automatic enrollment after confirming interest
- multi-branch campaign support
- campaign-scoped POS-code confirmation
- post link submission
- free-text feedback submission
- optional image upload
- basic dashboards and analytics
- email notifications or exportable WhatsApp campaign text

The MVP should exclude:

- branch user accounts
- payout or finance module
- post-submission approval workflow
- deep branch analytics
- conversion and ROI calculations
- social API integrations
- WhatsApp API integration if manual sharing is acceptable initially

## Open Product Choices for Later Phases

- automated WhatsApp integration
- QR code support
- influencer scoring and ranking
- blacklist or suspension rules
- repeat participation limits
- richer content proof such as multiple post links or story screenshots
- campaign templates
- branch-level reporting

## Recommended MVP Build Order

1. Authentication and role management
2. Influencer registration and approval
3. Campaign creation and targeting
4. Influencer campaign discovery and joining
5. Campaign code CSV upload and validation
6. Submission and feedback flow
7. Dashboards and reporting
8. Notifications and bilingual polish
