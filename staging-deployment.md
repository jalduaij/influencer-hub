# PICK Social Club Stage Deployment Guide

This app is ready for a **stage deployment** with the current file-based store.

Important:

- This setup is good for **internal staging / user acceptance testing**
- It is **not yet the final production architecture**
- The next real production step is still:
  - PostgreSQL or Supabase for data
  - durable file storage for uploads
  - stronger authentication and password handling

## What Is Ready Now

- environment-based app URL via `APP_BASE_URL`
- stage-safe cookies for HTTPS
- health endpoint at `/health`
- starter `package.json`
- starter `render.yaml`

## Suggested Stage Setup

Use:

- app hosting: `Render`
- data for stage: the included file store (`data/store.json`)
- uploads for stage: the included `uploads` folder

This is enough to test the real workflows with your team.

## 1. Create Accounts

Create these first:

1. a [Render](https://render.com/) account
2. a Git repository for this project if you do not already have one

You do **not** need Supabase yet for stage if you want the quickest route.

## 2. Push This Project To Git

Put this project in a Git repository and push it to GitHub/GitLab.

The important files for staging are:

- [server.js](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/server.js)
- [client.js](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/client.js)
- [styles.css](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/styles.css)
- [index.html](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/index.html)
- [data/store.json](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/data/store.json)
- [uploads](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/uploads)
- [package.json](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/package.json)
- [render.yaml](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/render.yaml)

## 3. Create A Web Service On Render

In Render:

1. create a new `Web Service`
2. connect your Git repository
3. let Render detect the Node app
4. use:
   - build command: `npm install`
   - start command: `npm start`
5. set the health check path to `/health`

## 4. Add Environment Variables

In Render, set:

- `NODE_ENV=production`
- `APP_BASE_URL=https://your-stage-domain.onrender.com`

Optional if you later move storage paths:

- `DATA_DIR`
- `STORE_PATH`
- `UPLOAD_DIR`

Reference values are in [.env.example](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/.env.example).

## 5. First Deployment Check

After deployment:

1. open `/health`
2. open the main app URL
3. log in with a demo admin
4. test:
   - campaign creation
   - code upload
   - influencer join
   - proof submission
   - manager password reset link generation

## 6. Stage Limitations You Should Expect

With the current architecture:

- data is still file-based
- uploaded files are still local to the server
- passwords are still prototype-level
- sessions are still in memory

That means this stage is best for:

- internal testing
- workflow review
- UI and UX feedback
- limited real-user pilot

It is not yet the final production setup for long-term live use.

## 7. Best Next Step After Stage Is Stable

Move to:

1. PostgreSQL / Supabase for the main database
2. object storage for banners, avatars, and uploads
3. stronger authentication and reset flow
4. POS used-code reconciliation upload
