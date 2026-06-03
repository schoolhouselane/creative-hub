"""
Brand Guidelines Service
Extracts structured brand DNA from uploaded PDF files using Gemini,
and manages per-brand folder structure on disk.
"""
import asyncio
import base64
import io
import json
import logging
import os
import re
from pathlib import Path
from typing import Optional

import fitz  # PyMuPDF

logger = logging.getLogger(__name__)

UPLOADS_ROOT = Path(__file__).parent.parent / "uploads" / "brands"

EXTRACTION_PROMPT = """You are a senior brand strategist reading a brand guidelines document.
Extract EVERY piece of brand information and return a single valid JSON object.

Required fields (use null for any field not found — never omit a field):
{
  "brand_name": "exact brand name",
  "tagline": "official tagline or slogan",
  "mission": "brand mission statement",
  "vision": "brand vision",
  "brand_story": "2-3 sentence brand origin and identity story",
  "brand_products": "what the brand makes or sells — be specific e.g. 'premium electric bicycles (e-bikes)'",
  "brand_values": ["core value 1", "core value 2", "core value 3"],
  "brand_personality": ["adjective1", "adjective2", "adjective3"],
  "tone_of_voice": "full description of how the brand communicates",
  "writing_style": "specific writing rules and vocabulary guidance",
  "target_audience": "primary audience demographics and psychographics",
  "industry": "industry or sector",
  "usp": "unique selling proposition",
  "primary_color": "#hex",
  "secondary_color": "#hex",
  "accent_color": "#hex",
  "color_palette": ["#hex1", "#hex2", "#hex3", "#hex4", "#hex5"],
  "font_heading": "heading font name",
  "font_body": "body font name",
  "typography_notes": "size, weight, hierarchy rules",
  "visual_style": "overall visual and design direction in 2-3 sentences",
  "photography_style": "comprehensive photography direction — mood, lighting, subjects, colour grade, camera settings",
  "photography_prompts": [
    "VERBATIM copy any ready-to-use image generation prompts found in the document — these are gold",
    "Include all technical camera/lighting/colour-grade instructions as separate array items"
  ],
  "logo_usage": "logo colour rules, when to use which version, what is forbidden",
  "logo_placement": "where to position the logo on imagery — e.g. bottom-right with 1x clear space padding",
  "social_content_rules": "composition, layout, and logo placement rules for social media posts",
  "do_say": ["approved phrases or approaches"],
  "dont_say": ["forbidden phrases or approaches"],
  "design_rules": {
    "layout_principles": "grid, white space, hierarchy rules",
    "dos": ["do 1", "do 2"],
    "donts": ["dont 1", "dont 2"]
  },
  "content_pillars": ["pillar1", "pillar2"],
  "social_tone": "specific tone for social media",
  "competitors": ["competitor1"],
  "extra_notes": "any remaining important brand context not captured above"
}

CRITICAL INSTRUCTIONS:
- Copy photography prompts VERBATIM if they appear in the document — do not paraphrase them
- For logo_placement, extract the exact rule (e.g. "bottom-centre or bottom-left with 1x clear space")
- For brand_products, be specific about what the brand actually makes/sells
- Return ONLY the JSON object. No explanation, no markdown, no code fences.

BRAND GUIDELINES TEXT:
"""


def _brand_slug(brand_name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", brand_name.lower()).strip("-")
    return slug or "brand"


def get_brand_folder(brand_id: int, brand_name: str) -> Path:
    folder = UPLOADS_ROOT / f"{brand_id}-{_brand_slug(brand_name)}"
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages = []
    for page in doc:
        text = page.get_text("text")
        if text.strip():
            pages.append(text)
    doc.close()
    return "\n\n".join(pages)


def extract_logo_from_pdf(pdf_bytes: bytes, max_pages: int = 4) -> Optional[str]:
    """
    Extract the most likely logo image from a PDF and return it as a base64 data URI.

    Strategy: scan the first few pages, collect all embedded raster images that pass
    size/ratio filters, then pick the largest from the earliest page (cover logos are
    almost always the dominant image on page 1).

    Returns None if no suitable image is found.
    """
    try:
        from PIL import Image as PILImage

        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        candidates: list[tuple[int, int, bytes]] = []  # (page_num, area, png_bytes)

        for page_num in range(min(max_pages, len(doc))):
            page = doc[page_num]
            for img_info in page.get_images(full=True):
                xref = img_info[0]
                try:
                    raw = doc.extract_image(xref)
                    img_bytes = raw["image"]

                    img = PILImage.open(io.BytesIO(img_bytes))
                    w, h = img.size

                    # Skip tiny decorative elements and huge full-page backgrounds
                    if w < 80 or h < 80:
                        continue
                    if w > 2500 or h > 2500:
                        continue

                    # Skip extremely wide or tall banners (not logos)
                    ratio = max(w, h) / min(w, h)
                    if ratio > 12:
                        continue

                    # Convert to PNG
                    buf = io.BytesIO()
                    img.convert("RGBA").save(buf, format="PNG")
                    candidates.append((page_num, w * h, buf.getvalue()))
                except Exception:
                    continue

        doc.close()

        if not candidates:
            return None

        # Prefer the largest image from the earliest page
        candidates.sort(key=lambda x: (x[0], -x[1]))
        best_png = candidates[0][2]

        b64 = base64.b64encode(best_png).decode()
        return f"data:image/png;base64,{b64}"

    except Exception as e:
        logger.warning(f"Logo extraction from PDF failed: {e}")
        return None


def _truncate_for_context(text: str, max_chars: int = 120_000) -> str:
    """Gemini 2.5 Flash has a 1M token context but we cap at ~90k words to stay fast."""
    if len(text) <= max_chars:
        return text
    logger.warning(f"PDF text truncated from {len(text)} to {max_chars} chars")
    return text[:max_chars] + "\n\n[Document truncated — content continues beyond this point]"


async def extract_brand_dna(pdf_text: str, ai_service) -> dict:
    """Send PDF text to Gemini and get structured brand DNA back. Retries 3× on 503."""
    truncated = _truncate_for_context(pdf_text)
    prompt = EXTRACTION_PROMPT + truncated

    from schemas.aihub import GenTxtRequest, ChatMessage
    req = GenTxtRequest(
        messages=[ChatMessage(role="user", content=prompt)],
        model="gemini-3.5-flash",
        max_tokens=8192,
    )

    last_err: Exception = RuntimeError("Brand DNA extraction failed")
    for attempt in range(3):
        try:
            result = await ai_service.gentxt(req)
            raw = result.content.strip()

            # Strip markdown code fences if Gemini wraps output
            if raw.startswith("```"):
                raw = re.sub(r"^```[a-z]*\n?", "", raw)
                raw = re.sub(r"\n?```$", "", raw)

            dna = json.loads(raw)
            return dna
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse brand DNA JSON: {e}\nRaw: {raw[:500]}")
            return {"raw_extraction": raw, "parse_error": str(e)}
        except Exception as e:
            last_err = e
            err_str = str(e)
            if "503" in err_str or "overloaded" in err_str.lower() or "quota" in err_str.lower():
                if attempt < 2:
                    wait = 4 * (attempt + 1)
                    logger.warning(f"Gemini 503 on attempt {attempt+1}, retrying in {wait}s")
                    await asyncio.sleep(wait)
                    continue
            logger.error(f"Brand DNA extraction failed: {e}")
            raise
    raise last_err


def save_pdf_to_brand_folder(pdf_bytes: bytes, brand_id: int, brand_name: str) -> Path:
    folder = get_brand_folder(brand_id, brand_name)
    pdf_path = folder / "brand_guidelines.pdf"
    pdf_path.write_bytes(pdf_bytes)
    logger.info(f"Saved PDF to {pdf_path}")
    return pdf_path


def save_dna_json(dna: dict, brand_id: int, brand_name: str) -> Path:
    folder = get_brand_folder(brand_id, brand_name)
    json_path = folder / "brand_dna.json"
    json_path.write_text(json.dumps(dna, indent=2, ensure_ascii=False))
    logger.info(f"Saved brand DNA to {json_path}")
    return json_path


def list_brand_files(brand_id: int, brand_name: str) -> list[dict]:
    folder = get_brand_folder(brand_id, brand_name)
    if not folder.exists():
        return []
    files = []
    for f in sorted(folder.rglob("*")):
        if f.is_file():
            files.append({
                "name": f.name,
                "relative_path": str(f.relative_to(folder)),
                "size_kb": round(f.stat().st_size / 1024, 1),
            })
    return files
