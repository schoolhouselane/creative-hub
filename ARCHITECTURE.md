# Creative Room — System Architecture

**Version:** 3.0
**Updated:** June 2026
**Organisation:** Schoolhouse Lane
**Stack:** React + Vite · FastAPI · PostgreSQL · fal.ai · Gemini · Grok

---

## 1. What This System Is

Creative Room is Schoolhouse Lane's AI-powered creative operations platform. It combines brand management, multi-model AI image generation, a conversational creative assistant, LoRA model training per product, and a training feedback loop into one tool.

---

## 2. Directory Structure

```
/app
├── frontend/                     React 18 + Vite + TypeScript
│   ├── src/
│   │   ├── pages/
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── BrandsPage.tsx
│   │   │   ├── BrandDetailPage.tsx       ← multi-LoRA training UI, feedback
│   │   │   ├── BrandCreateWizard.tsx     ← 9-step Brand DNA wizard
│   │   │   ├── AIWorkspacePage.tsx       ← main AI chat workspace
│   │   │   ├── WorkspacePage.tsx         ← Prompt Hub
│   │   │   ├── PromptLibraryPage.tsx
│   │   │   ├── AssetGalleryPage.tsx
│   │   │   └── BriefsPage.tsx
│   │   ├── components/
│   │   │   ├── Sidebar.tsx               ← Schoolhouse Lane logo, dark theme
│   │   │   ├── FloatingClaudeChat.tsx    ← global Claude panel (all pages)
│   │   │   └── ImageEditorModal.tsx      ← canvas logo/text overlay editor
│   │   └── lib/
│   │       ├── briefTypes.ts
│   │       └── config.ts
│
├── backend/                      Python 3.12 + FastAPI
│   ├── routers/
│   │   ├── aihub.py              ← genimg, gentxt, genvideo, LoRA, Grok
│   │   ├── brand_profiles.py
│   │   ├── briefs.py
│   │   ├── prompts.py
│   │   ├── assets.py
│   │   └── auth.py
│   ├── services/
│   │   └── aihub.py              ← all AI logic + LoRA training pipeline
│   ├── models/                   SQLAlchemy ORM
│   └── core/
│       ├── database.py
│       └── config.py
│
└── start_app_v2.sh
```

**Frontend:** `localhost:4001`
**Backend:** `localhost:8000`
**Auth:** metagptx (`@metagptx/web-sdk`)

---

## 3. Image Generation Pipeline

```
User Prompt
    │
    ├── Flux Pro selected?
    │       ├── Brand has trained LoRA? → Flux LoRA (fal.ai)  ← most accurate
    │       └── No LoRA?               → Flux Pro (fal.ai)
    │
    ├── Grok Image selected?
    │       ├── Products pinned? → Gemini Vision describes each photo → inject as text
    │       └── Send enriched prompt to xai/grok-imagine-image (fal.ai)
    │
    └── Gemini Pro selected?
            ├── Products pinned? → inject as img2img reference images
            ├── Layout pinned?  → inject as layout template
            └── Brand context   → injected as system instruction
```

---

## 4. LoRA Training System

Each brand supports **multiple LoRA models** — one per product category (bike, jersey, helmet, etc.):

```
Brand DNA (brand_dna JSON)
└── product_categories: [
      {
        id, name, trigger,               // e.g. "SHELBYBIKE"
        images: [{name, url, caption}],  // base64 photos + per-image captions
        caption_template,                // shared base caption with hex colors
        lora_status, lora_url,           // fal.ai training output
        lora_progress, lora_request_id
      }
    ]
```

**Training flow:**
1. Upload photos + write caption template (exact colours, materials)
2. Add per-image captions for specific angles/details
3. Backend creates zip: `image_000.jpg` + `image_000.txt` (template + per-image combined)
4. Upload to `fal.media/files/upload`
5. Submit to `queue.fal.run/fal-ai/flux-lora-fast-training`
6. Poll every 15s → save `lora_url` to `brand_dna` when COMPLETED

**Iterative re-training feedback loop:**
- 👍 liked generated images → stored in `brand_dna.training_feedback`
- "Re-train with Feedback" → combines original photos + approved generations → new LoRA run
- Each cycle improves colour and product accuracy

---

## 5. Database Schema

```sql
brand_profiles
  id, user_id, brand_name, primary_color, secondary_color, accent_color,
  font_heading, font_body, tone_of_voice, logo_url, tagline, industry,
  guidelines_notes, brand_dna (TEXT/JSON), chat_history,
  created_at, updated_at

briefs
  id, user_id, brief_type, title, status, brand_name,
  project_description, target_audience, tone_style,
  ai_tool, generated_asset_url, priority, created_at

prompts
  id, user_id, title, tool, category, text, created_at, updated_at

assets
  id, user_id, brand_id, brand_name, title, asset_type, content_type,
  ai_tool, url, prompt, chat_history, created_at
```

---

## 6. API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/aihub/genimg` | Gemini image generation (img2img, product refs) |
| POST | `/api/v1/aihub/genimg-flux` | Flux Pro via fal.ai |
| POST | `/api/v1/aihub/genimg-lora` | Flux + trained brand LoRA |
| POST | `/api/v1/aihub/genimg-grok` | Grok Imagine + Gemini Vision bridge |
| POST | `/api/v1/aihub/gentxt` | Streaming text generation (SSE) |
| POST | `/api/v1/aihub/genvideo` | Video generation |
| POST | `/api/v1/aihub/train-lora` | Start LoRA training job on fal.ai |
| GET | `/api/v1/aihub/train-lora/{id}` | Poll training status + progress |
| POST | `/api/v1/aihub/extract-brand-dna` | Extract brand DNA from PDF/PNG |
| GET | `/api/config` | Runtime config for frontend |
| CRUD | `/api/v1/entities/{entity}` | brand_profiles, briefs, prompts, assets |

---

## 7. Environment Variables

```bash
# Database
DATABASE_URL=postgresql+asyncpg://...

# Text + Image AI (Gemini via OpenAI-compatible endpoint)
APP_AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
APP_AI_KEY=...

# Image AI — Flux Pro, Flux LoRA, Grok (fal.ai)
FAL_KEY=...

# Auth
SECRET_KEY=...
DEV_AUTH_BYPASS=true   # development only
```

---

## 8. North Star Architecture (Roadmap)

Target pipeline per the brand AI vision document:

```
User Prompt
    ↓
Prompt Enhancer      auto-selects LoRA triggers from prompt keywords
    ↓
Asset Retriever      loads correct LoRA URLs + logo SVG files
    ↓
Image Generation     Flux Kontext + separate brand LoRA per product SKU
    ↓
Logo Placement       Gemini Vision detects placement zones → PIL composites SVG
    ↓
Quality Pass         upscaling, colour grading
    ↓
Final Image          pixel-perfect branding, correct product colours
```

**Sprints remaining:** Multi-LoRA selector UI → SVG logo pipeline → Prompt intelligence → Flux Kontext upgrade → Quality pipeline
