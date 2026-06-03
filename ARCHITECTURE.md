# SHL Creative Hub — Project Architecture

**Version:** 1.0  
**Date:** May 2026  
**Stack:** React + Vite (frontend) · FastAPI + SQLAlchemy (backend) · metagptx SDK (AI/auth)

---

## 1. What This System Is

A private creative operations platform for SHL (Schoolhouse Lane) that:

- Receives full brief documents from clients (PDF, Word, image)
- Manages brief lifecycle from intake to delivery
- Gives clients their own portal to track progress and download assets
- Connects to AI tools (Claude, Gemini, GPT Image, ElevenLabs, HeyGen, etc.) for asset generation
- Manages brand profiles for all clients

There are **two types of users**:
| User Type | Who | What they see |
|-----------|-----|---------------|
| **Agency** | SHL team | Full app — all clients, all tools, all briefs |
| **Client** | e.g. DataDirect | Only their own briefs, status, and completed assets |

---

## 2. Current Stack

```
/app
├── frontend/          React 18 + Vite + TypeScript
│   ├── src/pages/     Dashboard, Brands, Workspace, Briefs, Settings
│   ├── src/components/Sidebar, BriefForm, BrandProfile
│   └── src/lib/       briefTypes.ts, AI tool configs
│
├── backend/           Python 3.12 + FastAPI
│   ├── routers/       briefs, brand_profiles, auth, storage, aihub
│   ├── models/        SQLAlchemy ORM (briefs, brand_profiles)
│   ├── services/      Business logic layer
│   ├── schemas/       Pydantic request/response models
│   └── core/          database.py, config
│
└── start_app_v2.sh    Starts both servers locally
```

**Frontend runs on:** `localhost:4000`  
**Backend runs on:** `localhost:8000`  
**Live frontend:** `https://frontend-nine-pearl-97.vercel.app`  
**Auth provider:** metagptx (`@metagptx/web-sdk`)

---

## 3. Database Schema (Current)

```sql
-- briefs table (exists)
briefs
  id                  INT PRIMARY KEY
  user_id             VARCHAR        -- metagptx user ID (agency staff)
  brief_type          VARCHAR        -- Social Media, Video, Brand Design, etc.
  title               VARCHAR
  status              VARCHAR        -- draft, in_progress, review, completed
  brand_name          VARCHAR
  project_description TEXT
  target_audience     VARCHAR
  tone_style          VARCHAR
  key_message         VARCHAR
  additional_notes    TEXT
  form_data           TEXT           -- JSON blob of extra fields
  ai_tool             VARCHAR
  generated_asset_url VARCHAR
  priority            VARCHAR
  created_at          TIMESTAMP
  updated_at          TIMESTAMP

-- brand_profiles table (exists)
brand_profiles
  id, user_id, name, industry, colors, fonts, ...
```

---

## 4. Planned Features

### 4.1 Brief Document Upload

**What it does:** Client sends SHL a PDF or Word brief. Agency staff upload it to the Hub. The file is stored and attached to a brief record.

**No AI parsing for now** — just raw document storage. The brief record holds a link to the file.

**Changes needed:**

```
Database — add 1 column to briefs table:
  brief_file_url    VARCHAR    -- URL to the uploaded document in storage

Backend — add 1 endpoint:
  POST /api/v1/briefs/upload
    accepts: multipart/form-data (file + brief_id or new brief metadata)
    saves file to: Supabase Storage / Cloudflare R2
    returns: { brief_id, file_url }

Frontend — add upload UI to NewBrief page:
  - Drag & drop zone (PDF, DOCX, PNG, JPG)
  - On upload: show file preview + "Save Brief" button
  - Stored file linked to the brief record
```

**File storage options (pick one):**
| Option | Cost | Setup |
|--------|------|-------|
| Supabase Storage | Free up to 1GB | Easy, already has Python SDK |
| Cloudflare R2 | $0.015/GB | S3-compatible, very cheap |
| AWS S3 | $0.023/GB | Standard, well-documented |

**Recommendation:** Supabase Storage — simplest to set up, free tier covers early usage, Python client already available.

---

### 4.2 Client Portal

**What it does:** Clients (e.g. DataDirect) get their own login. They see only their briefs — no other client's data. They can track progress and download completed assets.

**This requires a separate auth layer for clients.**

**Changes needed:**

```
Database — add 2 new tables:

  client_users
    id              INT PRIMARY KEY
    email           VARCHAR UNIQUE
    password_hash   VARCHAR
    brand_id        INT FK → brand_profiles.id
    created_at      TIMESTAMP

  brief_completion
    id              INT PRIMARY KEY
    brief_id        INT FK → briefs.id
    percentage      INT (0–100)
    stage           VARCHAR (briefing/production/review/delivered)
    notes           TEXT
    updated_at      TIMESTAMP

Backend — add new router: /api/v1/client/
  POST /client/auth/login         → returns JWT for client session
  GET  /client/briefs             → returns briefs WHERE brand = client's brand
  GET  /client/briefs/{id}        → single brief + completion %
  GET  /client/briefs/{id}/assets → signed download URLs for completed files

Frontend — add new route group: /client/*
  /client/login       → client login page (email + password)
  /client/dashboard   → brief cards with progress bars
  /client/briefs/{id} → brief detail: status, stage tracker, asset downloads
```

**Auth flow:**

```
Client visits → /client/login
  → POST /api/v1/client/auth/login
  → backend verifies email/password, returns JWT
  → JWT stored in localStorage
  → all /client/* API calls include Authorization: Bearer {JWT}
  → backend middleware checks JWT, attaches brand_id to request
  → all queries filtered by that brand_id automatically
```

**Completion % logic:**
Agency staff update the `brief_completion` table manually (or automatically when status changes). Client sees the current %. Stages map to approximate %:

| Stage | % |
|-------|---|
| Briefing | 10% |
| In Production | 40–70% |
| In Review | 85% |
| Delivered | 100% |

---

## 5. API Routes (Full Map)

```
/api/v1/
│
├── auth/                        (metagptx — agency auth)
│   ├── login, logout, me
│
├── entities/
│   ├── briefs/                  CRUD for briefs
│   │   ├── GET    /             list all (agency)
│   │   ├── POST   /             create brief
│   │   ├── GET    /{id}         single brief
│   │   ├── PUT    /{id}         update brief
│   │   ├── DELETE /{id}         delete brief
│   │   └── POST   /upload       NEW: upload brief document
│   │
│   └── brand_profiles/          CRUD for brands
│
├── client/                      NEW: client portal
│   ├── POST   /auth/login        client login
│   ├── GET    /briefs            client's own briefs
│   ├── GET    /briefs/{id}       brief detail + progress
│   └── GET    /briefs/{id}/assets  download links
│
├── aihub/                       AI generation
│   ├── POST   /generate/text
│   ├── POST   /generate/image
│   └── POST   /generate/video
│
└── storage/                     File management
    ├── POST   /upload
    └── GET    /files/{id}
```

---

## 6. Frontend Route Map

```
/ (agency)
├── /                  Dashboard — stats, recent briefs, quick actions
├── /brands            Brand Management — all client brand profiles
├── /workspace         Prompt Hub — AI asset generation
├── /chat              AI Workspace — chat with AI tools
├── /gallery           Asset Gallery — all generated assets
├── /templates         Template Library
├── /briefs            Client Briefs — list all briefs
├── /briefs/new        New Brief — upload doc or fill form
├── /briefs/:id        Brief Detail — full brief + AI generation
└── /settings          Settings — AI tools, platform config

/client (client portal — separate auth)
├── /client/login      Client login
├── /client/dashboard  My Briefs overview
└── /client/briefs/:id Brief progress + asset downloads
```

---

## 7. Build Order (Recommended)

**Phase 1 — Brief Upload (1–2 days)**
1. Add `brief_file_url` column to briefs table (Alembic migration)
2. Set up Supabase Storage bucket
3. Add `POST /api/v1/briefs/upload` endpoint
4. Update NewBrief page with drag & drop upload UI

**Phase 2 — Completion Tracking (1 day)**
1. Add `brief_completion` table
2. Add completion update to BriefDetail page (agency side)
3. Show progress bar on BriefsPage list

**Phase 3 — Client Portal (3–4 days)**
1. Add `client_users` table + JWT auth
2. Build `/api/v1/client/*` endpoints
3. Build `/client/*` frontend pages (login, dashboard, brief detail)
4. Test data isolation (client can only see their brand's briefs)

---

## 8. Security Notes

- Client JWT tokens expire after 7 days (refresh on activity)
- File uploads: validate MIME type server-side (not just extension)
- Client API routes: always filter by `brand_id` from JWT — never trust client-sent IDs
- File download URLs: use signed/expiring URLs (Supabase Storage supports this natively)
- Never expose agency users' data through client endpoints

---

## 9. Deployment

| Component | Platform | Notes |
|-----------|----------|-------|
| Frontend | Vercel | `vercel --prod` from `/app/frontend` |
| Backend | AWS Lambda (existing) | `lambda_handler.py` entry point |
| Database | PostgreSQL (existing) | managed via Alembic migrations |
| File Storage | Supabase Storage (planned) | free tier for now |
| Auth (agency) | metagptx | existing, no changes |
| Auth (client) | Custom JWT | new, built in-house |
