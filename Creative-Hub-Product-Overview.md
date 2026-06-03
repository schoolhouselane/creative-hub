# SHL Creative Hub — Product Overview

**Prepared by:** Shalale / SHL Team  
**Date:** May 2026  
**Status:** Live (v1) · Phase 2 in planning

---

## What Is Creative Hub?

Creative Hub is SHL's internal platform for managing creative work end-to-end.

It replaces scattered emails, Slack threads, and shared folders with one centralised workspace where the team receives client briefs, generates assets using AI tools, and delivers work — all in one place.

> **Live now at:** https://frontend-nine-pearl-97.vercel.app

---

## What's Already Built & Live

### 1. Dashboard
The home screen. Shows total briefs, active brands, AI tools connected, and recent activity at a glance. Quick links to start new work.

### 2. Brand Management
Store every client's brand profile in one place — logo, colours, typography, tone of voice. When generating assets, the platform automatically pulls in the right brand context so every output stays on-brand without manual setup.

### 3. Prompt Hub (AI Asset Generation)
The main creative engine. Team selects a brand, picks an asset category (social media, video, email, etc.), chooses an AI tool, and writes a prompt. The brand guidelines are injected automatically. Supports:
- **Claude / Gemini** — copy and text
- **GPT Image / Midjourney / Freepik** — images and visuals
- **HeyGen / Higgsfield** — video and avatar content
- **ElevenLabs** — voiceovers and audio

### 4. AI Workspace (Chat)
Direct chat interface with any connected AI tool, with the client's brand context loaded. Used for back-and-forth creative iteration — refining copy, generating variations, adjusting tone.

### 5. Asset Gallery
All generated assets saved in one gallery. Browse, filter by brand or type, download, and share.

### 6. Template Library
Pre-built prompt templates for common brief types — social media packs, ad campaigns, email sequences, video scripts. One click to start.

### 7. Client Briefs
Full brief management system. Create briefs, assign types (Social Media, Video, Brand Design, Email, etc.), set priority and status, track from intake to delivery.

### 8. Settings
View and test all connected AI tools. See which are active, test connections, and manage platform configuration.

---

## What We're Building Next

### Feature 1 — Brief Document Upload

**The problem today:**  
When a client like DataDirect sends us a brief, it arrives as a PDF or Word doc in our email. Someone has to manually copy details into the Hub.

**What we're building:**  
A simple upload screen in the Hub. Drag and drop the brief document (PDF, Word, or image). It gets stored and attached to the brief record — no re-typing, no lost files, everything in one place.

**How it works:**

```
Client emails brief PDF
        ↓
SHL team opens Creative Hub → Upload Brief
        ↓
Drag & drop the file
        ↓
File is stored securely in cloud storage
        ↓
Brief record created with document attached
        ↓
Team can view, download, and reference the original brief at any time
```

**What the team sees:**  
Upload zone on the New Brief page. After upload, the original document is visible alongside the brief details. Any team member working on that brief can open the original at any time.

---

### Feature 2 — Client Portal

**The problem today:**  
Clients have no visibility into their projects unless we manually send them updates. This creates back-and-forth emails ("any update?"), slows us down, and looks unprofessional.

**What we're building:**  
A separate login for each client. DataDirect gets their own account. They log in and see only their work — their briefs, where each one is in production, what percentage is complete, and when assets are ready to download.

**How it works:**

```
SHL sends client a login link (email + password)
        ↓
Client visits Creative Hub → Client Login
        ↓
They see their personalised dashboard:
  - All their active briefs
  - Status of each (In Production / In Review / Completed)
  - Completion percentage with stage tracker
  - Notes from the team ("Copy review underway — feedback needed")
        ↓
When work is complete → client clicks Download
        ↓
They get their files directly — no email attachments
```

**What the client sees:**

| Brief | Status | Progress | Action |
|-------|--------|----------|--------|
| HubSpot Integration Campaign | In Progress | 65% | View Details |
| Brand Refresh — Summer 2026 | In Review | 88% | Leave Feedback |
| Q1 Campaign Report Assets | Completed | 100% | Download All |

**Key points:**
- Clients only ever see their own work — complete data separation
- SHL team controls what stage and % is shown
- Client can leave feedback directly on briefs in review
- No client ever sees another client's data

---

## How the Two Features Connect

```
                    SHL TEAM VIEW                    CLIENT VIEW
                    
Client emails       →   Upload Brief doc         →   Brief appears in client portal
brief PDF               to Creative Hub              immediately

Team starts work    →   Status: In Production    →   Client sees 40% progress

Team shares draft   →   Status: In Review        →   Client notified, can leave feedback

Work approved       →   Upload final assets      →   Client sees 100% + Download button

Client downloads    ←   Job complete             ←   Assets downloaded directly
```

---

## Tech Stack (Simple Version)

| Layer | Technology | Why |
|-------|-----------|-----|
| Website (frontend) | React + TypeScript | Fast, modern, already built |
| Server (backend) | Python + FastAPI | Already built, handles all data |
| Database | PostgreSQL | Stores all briefs, brands, users |
| AI tools | metagptx SDK | Connects Claude, Gemini, GPT Image, etc. |
| File storage | Supabase Storage | Stores uploaded brief documents and assets |
| Agency login | metagptx Auth | Already in place |
| Client login | Custom (email + password) | New — separate from agency access |
| Hosting (frontend) | Vercel | Instant deploys, free tier |
| Hosting (backend) | AWS Lambda | Scales automatically, low cost |

---

## Build Plan

### Phase 1 — Brief Document Upload
**Time estimate: 2 days**

- [ ] Add file upload to the New Brief screen
- [ ] Connect cloud storage (Supabase)
- [ ] Attach uploaded document to brief record
- [ ] Show document preview/download in Brief Detail

**Result:** Team can receive a PDF brief from a client and store it directly in the Hub.

---

### Phase 2 — Completion Tracking
**Time estimate: 1 day**

- [ ] Add completion percentage to each brief
- [ ] Allow team to update stage (Briefing → In Production → In Review → Delivered)
- [ ] Show progress bar in brief list

**Result:** Everyone on the team can see where every brief is at a glance.

---

### Phase 3 — Client Portal
**Time estimate: 4–5 days**

- [ ] Build client login system (email + password)
- [ ] Build client dashboard (briefs + progress view)
- [ ] Build asset download page
- [ ] Enable feedback/comments from client
- [ ] Test full data separation (client A cannot see client B's work)

**Result:** Clients have their own professional portal. No more "any update?" emails.

---

## Summary

| | Now | After Phase 1 | After Phase 3 |
|--|-----|--------------|--------------|
| Brief intake | Manual entry | Upload PDF directly | Client submits directly |
| Client updates | Manual emails | Same | Client portal with live progress |
| Asset delivery | Email attachments | Same | Client downloads from portal |
| Brand consistency | Auto-injected in prompts | Same | Same |
| AI generation | 8 tools connected | Same | Same |

The platform is already saving the team time on asset generation and brand consistency. The next two phases close the loop on client communication and brief intake — the two biggest remaining friction points in the workflow.
