# Influencer Management System - Technical Architecture

## Architecture Goal

Design a secure internal web application for PICK that supports:

- bilingual user interfaces in Arabic and English
- role-based access for Admin, Campaign Manager, and Influencer
- campaign targeting and enrollment
- offline branch validation using campaign-scoped POS codes uploaded from CSV
- post-visit proof submission and feedback
- reporting and internal analytics

This document describes the recommended production architecture, even if the first local prototype is implemented as a lightweight static app.

## Recommended Production Stack

### Frontend

- React with Next.js App Router
- TypeScript
- Tailwind CSS or a component system with bilingual and RTL support
- i18n library for Arabic and English localization

### Backend

- Next.js server actions and route handlers, or a separate Node.js API service
- TypeScript
- REST or RPC-style endpoints for dashboard and campaign operations

### Database

- PostgreSQL

### Storage

- Local or cloud object storage for optional influencer image uploads

### Authentication

- Email and password authentication
- Session-based auth with secure HTTP-only cookies
- Role-based authorization middleware

### Deployment

- Internal cloud hosting or managed platform
- Managed PostgreSQL
- Daily backups

## High-Level System Components

### 1. Web Client

Used by all roles:

- Admin dashboard
- Campaign Manager dashboard
- Influencer portal

Responsibilities:

- login and language selection
- profile management
- campaign browsing and enrollment
- assigned code display and visit confirmation
- proof submission
- dashboard views and analytics

### 2. Application Server

Handles:

- authentication
- authorization
- business rules
- campaign eligibility
- status transitions
- notification generation
- reporting queries

### 3. Database Layer

Stores:

- user accounts
- influencer profiles
- campaigns
- branches
- targeting rules
- campaign code inventories
- campaign participation records
- visit validations
- content submissions
- notification history

### 4. Notification Service

Supports MVP notification delivery and manual distribution aids:

- email notifications
- WhatsApp-ready campaign text generation for manual posting

### 5. Media Upload Service

Handles:

- optional image attachments
- secure file naming
- metadata storage

## Recommended Module Breakdown

### Auth Module

- login
- logout
- password reset
- session management
- role checks

### User Management Module

- influencer sign-up
- admin invite flow
- influencer approval
- account status changes

### Campaign Module

- campaign creation
- campaign editing
- campaign publish and close actions
- campaign targeting rules
- branch assignment
- campaign deadlines
- campaign code CSV upload
- campaign code inventory management

### Participation Module

- eligible campaign listing
- interest confirmation
- campaign participation records
- branch choice or visit date selection when required
- participation blocking when no campaign codes remain
- automatic code reservation at join time

### Visit Validation Module

- display of assigned campaign code to influencer
- single-use enforcement per uploaded code
- validation timestamps
- visited status updates

### Submission Module

- social link submission
- feedback capture
- optional image upload
- completion state updates

### Reporting Module

- campaign overview metrics
- influencer participation progress
- submission summaries
- export-friendly tables

## Role Permissions

### Admin

- manage all users
- approve or reject influencers
- invite influencers
- create and manage campaigns
- access all dashboards and reports
- update system-wide settings

### Campaign Manager

- create and publish campaigns
- configure targeting and upload campaign codes
- view campaign participation
- view reports
- cannot manage admin accounts

### Influencer

- manage own profile
- browse eligible campaigns
- join campaigns
- receive assigned campaign code
- submit social link and feedback

## Core Business Rules

### Influencer Activation

- self-registered influencers remain inactive until approved by Admin
- invited influencers can be created directly in pending or active state

### Campaign Eligibility

- campaigns may target all influencers or filtered groups
- eligibility is derived from campaign rules and influencer profile data
- influencers only see campaigns they are eligible for

### Enrollment

- joining is automatic after influencer confirms interest
- campaign capacity equals the number of uploaded codes for that campaign
- if all uploaded campaign codes are reserved or used, joining must be blocked
- when joining succeeds, one available code is immediately reserved for that influencer

### Visit Validation

- a valid visit requires a code that was already reserved for that influencer from the uploaded campaign CSV
- uploaded campaign codes are the only allowed bridge between POS and the influencer platform
- a code should only be used once
- reserved code assignment prevents sharing conflicts between influencers
- visit completion marks the already-assigned code as used

### Submission

- submission can only happen after visit validation
- social media link is required in MVP
- feedback text is required
- image upload is optional
- no manual approval is required in MVP

## Suggested API Surface

### Auth

- `POST /api/auth/login`
- `POST /api/auth/register`
- `POST /api/auth/logout`
- `POST /api/auth/forgot-password`

### Users

- `GET /api/users`
- `GET /api/users/:id`
- `PATCH /api/users/:id`
- `POST /api/influencers/invite`
- `POST /api/influencers/:id/approve`
- `POST /api/influencers/:id/reject`

### Campaigns

- `GET /api/campaigns`
- `POST /api/campaigns`
- `GET /api/campaigns/:id`
- `PATCH /api/campaigns/:id`
- `POST /api/campaigns/:id/codes/upload`
- `GET /api/campaigns/:id/codes`
- `POST /api/campaigns/:id/publish`
- `POST /api/campaigns/:id/close`

### Participation

- `GET /api/my/campaigns`
- `GET /api/my/campaigns/eligible`
- `POST /api/campaigns/:id/join`
- `PATCH /api/participants/:id/selection`

### Visit Validation

- `POST /api/participants/:id/mark-visited`

### Submission

- `POST /api/participants/:id/submissions`
- `POST /api/submissions/:id/attachments`

### Reporting

- `GET /api/dashboard/summary`
- `GET /api/reports/campaigns`
- `GET /api/reports/influencers`

## State Transition Model

### Campaign

`Draft -> Published -> Active -> Closed -> Archived`

### Participation

`Eligible -> Interested -> Confirmed -> Visited -> Submitted -> Completed`

In MVP, `Interested` and `Confirmed` may be collapsed into one automatic join event if preferred by product design.

## Data Integrity Rules

- email must be unique per user
- each uploaded campaign code must be unique within its campaign
- each reserved or used campaign code can be linked to only one participant
- each influencer can join a campaign once
- campaign submission must be tied to an existing participant
- branch assignment must belong to the selected campaign
- campaign deadlines must be chronologically valid
- campaigns should not be open for participation until a code CSV has been uploaded

## Localization Requirements

- interface labels in Arabic and English
- support RTL layout when Arabic is active
- campaign title and description stored in both languages
- notification templates available in both languages

## Security Requirements

- password hashing with a modern algorithm
- secure cookies
- CSRF protection for session actions
- role-based route protection
- audit logging for approvals, campaign publishing, and edits
- file upload validation for size and type

## Suggested Non-Functional Targets

- responsive on mobile and desktop
- page load optimized for internal staff and influencer mobile usage
- clear audit trail for campaign and account actions
- daily database backups in production

## MVP Prototype Strategy

Because the current local environment does not include a package manager, the first build in this workspace should be a dependency-free prototype with:

- static HTML, CSS, and JavaScript
- seeded in-memory or local mock data
- account-based role switching stand-in
- campaign creation and tracking UI
- CSV upload and code-pool validation UI
- basic state transitions for influencer participation

This lets the product flow be validated before moving to a production stack.
