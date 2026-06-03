# SHL Creative Hub — Product Brief

**Prepared by:** SHL Team  
**Date:** May 2026  
**Based on:** Figma designs — SHL Website file  
**Live URL:** https://frontend-nine-pearl-97.vercel.app

---

## Overview

Creative Hub is SHL's all-in-one AI-powered platform for creative production. It combines brand management, AI asset generation, a chat workspace, an asset library, and client brief management into a single tool — replacing the fragmented mix of emails, shared drives, and separate AI tools the team currently uses.

The platform connects directly to Claude, Gemini, Midjourney, GPT Image, ElevenLabs, HeyGen, Freepik AI, and Figma via the metagptx SDK. Every tool is brand-aware — client guidelines are automatically injected into every prompt so output is always on-brand, without manual setup each time.

---

## Pages & Features

---

### 1. Dashboard

**Purpose:** The home screen. A live snapshot of everything happening across all clients and projects.

**What's on screen:**

- **Stats bar** — four KPI tiles: Assets Generated (with % growth), Active Brands, AI Tools Connected (all active), This Week's output. Numbers update in real time from the database.
- **Creative Prompt Hub banner** — hero section with a quick description and CTA to jump into Prompt Hub
- **Client Brands grid** — all active brand profiles shown as cards. Each card shows brand logo/avatar, name, industry tag, and total assets generated. Click to go to that brand's profile.
- **Recent Activity feed** — a live log of what's been generated across all brands. Shows asset type, tool used, brand name, and timestamp (e.g. "Generated 12 social media banners · TechVision · 2 min ago")
- **Quick Actions** — four shortcut cards: New Brief, Prompt Hub, Asset Gallery, Templates

**How it works:**
The dashboard queries the database on load and pulls brief counts, brand counts, and the last 5–10 activity items. Stats update each time the page is visited.

---

### 2. Brand Management

**Purpose:** Store and manage every client's brand identity in one place. This is the foundation that makes every AI output brand-consistent.

**What's on screen:**

- A grid of brand profile cards — one per client
- Each card shows: brand logo, name, industry, primary and secondary brand colours (shown as colour swatches), and total assets generated
- "Add Brand" button to create a new profile
- Clicking a brand opens its full profile

**What a brand profile contains:**
- Brand name and industry
- Primary and secondary colours (hex codes)
- Typography (font family and weights)
- Tone of voice (e.g. "Professional & Innovative", "Warm & Sustainable")
- Brand guidelines notes

**How it works:**
When a team member selects a brand in Prompt Hub or AI Workspace, all of this data is automatically loaded and injected into the AI prompt. The AI generates assets that match the brand's colours, fonts, and tone — without the team having to write it out every time.

**Current brands in the system:** TechVision, NanoBanana, Shelby, EcoLife, SportMax, UrbanStyle, FoodieHub, MindfulApp, Real Man's Wipes, Vivo Hotel, iTV

---

### 3. Prompt Hub

**Purpose:** The main asset creation screen. A guided 4-step workflow that takes the team from brand selection to a ready-to-generate AI prompt.

**Step 1 — Select Brand**
Brand tabs at the top of the screen. Click to select which client this asset is for. The selected brand's guidelines are loaded silently in the background.

**Step 2 — Choose Asset Category**
Five categories to choose from:
- **Brand Design** — logos, brand assets, visual identity
- **Digital Design** — banners, ads, email graphics
- **Social Content** — posts, stories, reels, carousels
- **Website / App** — UI mockups, hero images, icons
- **Video Content** — intros, ads, explainers, avatars

**Step 3 — Choose AI Tool**
Six tools shown with name, category, and one-line capability description:
- **NanoBanana** — 2K/4K visuals with precise prompt adherence (Image Generation)
- **Gemini** — text, image, and reasoning capabilities (Multimodal AI)
- **Midjourney** — artistic and creative image generation (Image Generation)
- **Freepik AI** — vectors, illustrations, and templates (Design Assets)
- **HeyGen** — AI avatar videos and presentations (Video Generation)
- **ElevenLabs** — natural voice generation and cloning (Voice AI)

**Step 4 — Compose Prompt**
A large text input with the brand context pre-loaded above it ("Brand context for TechVision will be auto-injected into your prompt"). The team writes what they want to create. A "Generate" button sends the prompt to the selected AI tool.

**How it works:**
On Generate, the system combines the user's prompt + the selected brand's colours, typography, and tone, then sends the combined prompt to the chosen AI tool via the metagptx SDK. The result is returned and saved to the Asset Gallery.

---

### 4. AI Workspace

**Purpose:** A full chat interface for back-and-forth creative work with any AI tool. Used when a single prompt isn't enough — for iteration, variations, and refinement.

**What's on screen:**

- **Brand context bar** at the top — shows the active brand, colours, font, and tone. Always visible so the team knows which brand context is loaded.
- **AI Tool tabs** at the top — switch between NanoBanana, Gemini, Midjourney, HeyGen without leaving the conversation. Each tab is a separate chat thread.
- **Chat thread** — conversation-style UI. User messages on the right, AI responses on the left. Generated images appear inline inside the chat — no switching to another screen to see results.
- **Message input bar** — type a prompt, press send. Supports follow-up instructions like "make it darker", "add the product in the centre", "create a 9:16 version".

**Example workflow shown in the design:**
1. Team selects TechVision brand
2. Asks NanoBanana to create a social media banner for an AI product launch
3. AI generates the image — it appears in the chat
4. Team asks for a variation with more emphasis on the product
5. AI generates the variation — it appears below in the same thread
6. Final version saved to Asset Gallery

**How it works:**
Messages are sent via `client.ai.gentxt()` or `client.ai.genimg()` from the metagptx SDK. Brand context is prepended to every message automatically. Generated image URLs are stored and displayed inline.

---

### 5. Asset Gallery

**Purpose:** A library of every asset generated across all clients and all tools. Browse, filter, and download.

**What's on screen:**

- **Search bar** — search by asset name or tag
- **Filter tabs** — filter by tool (All, NanoBanana, Gemini, Midjourney, etc.) and by client brand
- **Asset grid** — 3-column grid of asset cards. Each card shows:
  - Thumbnail of the generated image/video
  - Asset name
  - Client brand badge (e.g. "TechVision")
  - AI tool badge (e.g. "NanoBanana")
  - Time generated (e.g. "2 hours ago")
  - Hover: download and menu options

**Assets shown in the design:**
TechVision AI Launch Banner, EcoLife Brand Board, Creative Tools Showcase, Marketing Grid Layout, Product Hero Image, Social Campaign Visual

**How it works:**
Assets are saved to the database when generated. The gallery queries all assets belonging to the logged-in user's workspace. Thumbnails are loaded from the URL returned by the AI tool. Download triggers a direct file download.

---

### 6. Templates

**Purpose:** Pre-built prompt templates for common creative tasks. Start from a template instead of writing a prompt from scratch.

**What's on screen:**

- **Search bar** — search templates by name or type
- **Category filter tabs** — All, Ads, Social Media, Design, Email, Video
- **Template cards** — each shows template name, category tag, a preview, and a "Use Template" button

**How it works:**
Selecting a template opens Prompt Hub with the template text pre-filled in the Compose Prompt box. The team selects their brand, tweaks the prompt if needed, and generates.

---

### 7. Client Briefs

**Purpose:** Manage all incoming creative requests from clients. Track each brief from intake to delivery.

**What's on screen:**

- **Stats row** — Total Briefs, In Progress, Completed, Draft counts
- **Filter tabs** — All, In Progress, Review, Completed, Draft
- **"+ New Brief" button**
- **Brief list** — each row shows: title, brand/client, brief type, status badge, priority badge, date

**Brief statuses:** Draft → In Progress → Review → Completed

**Brief types:** Social Media, Video Content, Brand Design, Digital Ads, Email Campaign, Website / App

**How it works:**
Briefs are stored in the database linked to the logged-in user. The list updates in real time. Clicking a brief opens the Brief Detail screen.

---

### 8. New Brief

**Purpose:** Create a new brief. Either upload a document from the client or fill out the form manually.

**Step 1 — Select Brief Type**
Six type cards with icon and description. Click to select. A visual selector makes it clear what kind of work is being requested.

**Step 2 — Brief Details**
Form fields: title, brand/client, description, target audience, tone, platform, dimensions, key message, notes, priority, assigned AI tool.

**Step 3 — Review & Submit**
Summary of all entered details before saving.

**Document upload (planned):**
On the New Brief screen, a drag-and-drop zone will allow the team to upload the original PDF or Word brief from the client. The file is stored and attached to the brief record so anyone working on the project can access the original at any time. No AI parsing — just plain storage and retrieval.

---

### 9. Brief Detail

**Purpose:** View a full brief and generate assets directly from it.

**What's on screen:**

- **Brief information** — client, status, all form fields
- **AI Generation panel** — prompt input pre-filled with brief context, select AI tool, generate button. Generated assets appear here and are saved to the gallery.
- **Brand Context sidebar** — shows the linked brand's colours, fonts, and tone
- **Timeline** — milestone tracker from brief creation to delivery

**How it works:**
The brief's description, tone, and key message are combined into a prompt. The team can edit before generating. Clicking Generate calls the selected AI tool and saves the result to the Asset Gallery.

---

### 10. Settings

**Purpose:** View all connected AI tools, test connections, and see platform information.

**What's on screen:**

- **SDK-Connected AI Tools** — grouped by category (Text, Image, Audio, Video). Each tool card shows name, model ID, description, and a "Test Connection" button. The test sends a minimal request to confirm the tool is working.
- **External Tools** — tools without a public API (Midjourney, Figma, Photoshop). These are opened in a new browser tab. The platform can copy the prompt and brand context to the clipboard before opening.
- **Platform info** — framework, backend, SDK, styling, dev port, API port

**Connected tools:**

| Category | Tools |
|----------|-------|
| Text / Copy | Claude Sonnet, Claude Opus, Claude Haiku, Gemini Pro |
| Image Generation | GPT Image, DALL-E 3 |
| Audio / Voice | ElevenLabs |
| Video | HeyGen, Higgsfield |
| External (browser) | Midjourney, Freepik AI, Figma, Photoshop |

---

## Sidebar Navigation

Present on every page. Contains:

- **Creative Hub logo** (top)
- **Main nav:** Dashboard, Brand Management, Prompt Hub, AI Workspace, Asset Gallery, Templates
- **Secondary nav:** Client Briefs, Settings
- **Connected Tools** — small coloured dots showing all active integrations (Claude, Gemini, GPT Image, ElevenLabs, Midjourney, HeyGen, Higgsfield, Freepik)
- **User auth** — shows logged-in user's email with logout, or a Sign In button if not logged in

---

## What's Not Yet Built (Planned)

### Brief Document Upload
Upload the original PDF/Word brief from a client and attach it to a brief record. Drag and drop. No AI parsing — just store and retrieve. Estimated: 2 days.

### Client Portal
A separate login for clients (e.g. DataDirect). They see only their own briefs, progress percentages, and completed assets. They can leave feedback on briefs in review and download final files. Estimated: 4–5 days.

See the Client Portal Hi-Fi designs in Figma: **"Client Portal — Hi-Fi"** page.

---

## Connected AI Tools Summary

| Tool | Type | How Connected |
|------|------|--------------|
| Claude Sonnet / Opus / Haiku | Text / reasoning | metagptx SDK — `client.ai.gentxt()` |
| Gemini Pro | Multimodal | metagptx SDK — `client.ai.gentxt()` |
| GPT Image / DALL-E 3 | Image generation | metagptx SDK — `client.ai.genimg()` |
| ElevenLabs | Audio / voice | metagptx SDK — `client.ai.genaudio()` |
| HeyGen / Higgsfield | Video | metagptx SDK — `client.ai.genvideo()` |
| Midjourney | Image (external) | Opens in browser tab |
| Freepik AI | Design assets (external) | Opens in browser tab |
| Figma | Design app | Opens in browser tab |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| AI / Auth SDK | metagptx (`@metagptx/web-sdk`) |
| Backend | Python 3.12 + FastAPI |
| Database | PostgreSQL + SQLAlchemy |
| File Storage | Supabase Storage (planned) |
| Hosting | Vercel (frontend) + AWS Lambda (backend) |

---

## Design System

- **Background:** `#0a0a0f` (deep dark), `#13131a` (card dark)
- **Primary:** `#7c3aed` (violet), `#06b6d4` (cyan)
- **Success:** `#10b981` (emerald)
- **Text:** `#f8fafc` (white), `#94a3b8` (muted slate)
- **Font:** Inter
- **Sidebar:** 260px fixed width with coloured status dots for connected tools
- **Cards:** Rounded corners (`rounded-xl`), white 10% border, dark background
