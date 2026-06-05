# Creative Room — Product Overview

**Schoolhouse Lane**
**June 2026**
**Status:** Live (v3) · Sprint 4 in planning
**Repository:** github.com/schoolhouselane/creative-hub

---

## What Is Creative Room?

Creative Room is Schoolhouse Lane's AI-powered platform for producing brand-accurate creative assets at scale.

It connects directly to Gemini, Flux, Grok, and ElevenLabs. Every tool is brand-aware — brand colours, typography, visual style, and trained product models are automatically applied to every generation. No manual prompt engineering required.

---

## What's Built & Live

### Dashboard
Live overview of all active brands and recent AI generations. Stats: assets generated, active brands, tools connected, weekly output. Quick actions to start new work.

### Brand Management
Every client brand stored in one place. Each brand profile contains:
- Name, industry, tagline
- Exact hex colours (primary, secondary, accent)
- Typography (heading + body fonts)
- Tone of voice and personality descriptors
- Target audience
- Visual style guide
- Brand Do's & Don'ts
- Lexicon (preferred and forbidden words)
- Product Library (actual product photos for AI reference)
- Trained AI models (LoRA per product)
- Layout reference templates

**9-step Brand DNA Wizard** — guided creation flow. Upload a PDF or brand guidelines image and the AI extracts the DNA automatically. User reviews and refines across 9 steps.

### Product Training (LoRA per Product)
The most important feature for brand accuracy. Instead of describing a product in text, the system trains a custom AI model on actual product photos.

**How it works:**
1. Create a product category (e.g. "Shelby Urban Bike" with trigger `SHELBYBIKE`)
2. Upload 15–30 clean photos of the product
3. Write a caption template: exact colours, materials, component names
4. Train on fal.ai (20–30 min)
5. Every future generation using `SHELBYBIKE` shows the actual product

Each brand supports multiple separate LoRAs — one per product variant. This prevents the model from confusing different products.

**Feedback loop:** 👍 on good results → collected → "Re-train with Feedback" → model improves with each cycle.

### AI Workspace
Three image engines, each for a different task:

**Flux Pro + LoRA** — when the exact product appearance matters. Uses the trained custom model. Best for product hero shots, lifestyle with specific gear.

**Gemini Pro** — when iterating on a specific image. Pin a reference photo (product, layout template) and Gemini generates with it as a visual base. Supports multi-turn conversation, AI Edit mode (describe a change → image updates).

**Grok Image** — photorealistic lifestyle scenes. Product photos are described via Gemini Vision and injected as detailed text context. Best for editorial and cinematic scenes.

**AI Edit mode:** Click AI Edit on any generated image → type the change → Gemini edits that specific image while preserving everything else.

**Like / Dislike:** On every image. 👍 images go into the brand's training pool for future LoRA re-training.

### Floating Claude Panel
Available on every page. Bottom-right button opens a brand-aware chat panel that stays on-screen without navigating away.

- Select a brand → Claude loads full brand DNA as context
- Ask brand questions, write copy, generate prompts
- **Batch image generation:** Type "Create 5 social media posts for Shelby" → Claude writes 5 optimised prompts → fires parallel image generation → shows grid of 5 images. Save any to gallery.

### Prompt Library
Reusable prompt templates with categories. Persisted to database. Copy any prompt in one click.

### Asset Gallery
All generated images with filter by brand, type, and tool. Continue button resumes the exact chat session an asset was created in.

### Client Briefs
Brief management from intake to delivery. Types: Social Media, Video, Brand Design, Digital Ads, Email, Web/App.

---

## Sprint Roadmap

| Sprint | Goal | Status |
|--------|------|--------|
| 1 | Product Reference Library | ✅ Done |
| 2 | LoRA Training Pipeline | ✅ Done |
| 3 | Multi-LoRA + Feedback System | ✅ Done |
| 4 | SVG Logo Asset Manager | 🔜 Next |
| 5 | Auto Logo Placement Pipeline | 🔜 |
| 6 | Prompt Intelligence (auto LoRA selection) | 🔜 |
| 7 | Flux Kontext upgrade | 🔜 |
| 8 | Quality Pipeline (upscaling, colour grade) | 🔜 |

---

## Definition of Done (Brand Image Quality)

A generated image is considered correct when:
- ✅ Correct product model is recognisable
- ✅ Correct colour matches the actual product
- ✅ Logo on product is pixel-perfect (via SVG overlay)
- ✅ Brand colour palette applied throughout
- ✅ Commercial photography quality

Until all 5 are true, the pipeline is not complete. Each sprint moves toward this.
