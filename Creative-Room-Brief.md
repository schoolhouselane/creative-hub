# Creative Room — Product Brief

**Prepared by:** Schoolhouse Lane
**Updated:** June 2026
**Repository:** github.com/schoolhouselane/creative-hub

---

## What Is Creative Room?

Creative Room is Schoolhouse Lane's internal AI-powered platform for brand content production. It replaces scattered AI tools, emails, and shared drives with one workspace where the team manages brand identities, generates on-brand assets using multiple AI models, and iterates on results.

---

## Core Problem

Creating brand-accurate AI imagery requires:
- Knowing the exact brand colours, fonts, visual style
- Injecting that context into every AI prompt manually
- Using the right AI model for the right task
- Handling logo placement accurately (AI can't reproduce logos)

Creative Room automates all of this.

---

## Current Feature Set

### Brand Management
- Brand profile with full DNA: colours (hex), typography, tone of voice, personality, target audience
- **9-step Brand DNA Wizard** — guided creation from PDF/image upload → Basic Info → Mission/Vision → Core Values → Tone of Voice → Positioning → Do's & Don'ts → Lexicon → Visual Style
- Brand DNA extracted automatically from uploaded PDFs via Gemini Vision
- Brand guidelines stored and injected automatically into every generation

### AI Image Generation
Three engines, each for a different use case:

| Engine | Best for | Brand accuracy |
|--------|----------|---------------|
| **Flux Pro + LoRA** | Brand products (bikes, products, kit) | Highest — trained on actual photos |
| **Gemini Pro** | Scene editing, reference-based iteration | High — sees actual product photos |
| **Grok Image** | Photorealistic lifestyle scenes | Good — Gemini Vision describes products |

### LoRA Training (Per Product)
- Upload product photos (bike, helmet, jersey, etc.) per category
- Write caption template with exact hex colours and materials
- Add per-image captions for specific angles
- Train on fal.ai — creates a custom model that knows the exact product
- Iterative feedback loop: 👍 liked images fed back into next training run

### AI Workspace (Chat)
- Brand-aware chat interface for image generation
- Conversation history for multi-turn iteration
- AI Edit: click any generated image → describe a change → Gemini updates it
- Overlay editor: add real logo/text on top of generated image (canvas-based)
- Like/dislike on every image → feeds training data pool
- History: last 5 sessions per brand saved, resumable

### Floating Claude Panel
- Available on every page (bottom-right button)
- Brand selector → loads brand DNA as context
- Normal chat for questions, copy, captions
- Batch image generation: "Create 5 social media posts" → Claude generates prompts → fires parallel image API calls → shows grid of results
- Products chips send actual photos through Gemini Vision → descriptions injected into Grok prompt

### Prompt Library
- Save and manage reusable prompt templates
- Categories: Social Media, Video, Brand Design, Copywriting, Email, Photography
- Persisted to database

### Asset Gallery
- All generated images in one gallery
- Filter by brand, type, AI tool
- Continue: resume the exact chat session an image was created in
- Download (blob fetch for cross-origin CDN URLs)

### Client Briefs
- Brief lifecycle: intake → in progress → delivered
- Types: Social Media, Video, Brand Design, Digital Ads, Email, Web
- Linked to brand profiles

---

## Technical Stack

- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS
- **Backend:** Python 3.12, FastAPI, SQLAlchemy, PostgreSQL
- **Image AI:** Gemini (Google), Flux Pro (fal.ai), Flux LoRA (fal.ai), Grok (xAI via fal.ai)
- **Text AI:** Gemini (model routing normalises OpenRouter-style model names)
- **Auth:** metagptx SDK
- **Storage:** fal.media for AI outputs, local uploads for brand assets

---

## Brand AI Pipeline Vision (North Star)

```
User types one sentence
    ↓
Prompt intelligence selects correct product LoRA triggers
    ↓
Flux Kontext generates photorealistic product image
    ↓
Gemini Vision detects logo placement zones on jersey/bike/helmet
    ↓
SVG logo composited at pixel-perfect position and scale
    ↓
Final image: correct product, correct colours, correct logo — every time
```

This is the target. Each sprint moves toward it.
