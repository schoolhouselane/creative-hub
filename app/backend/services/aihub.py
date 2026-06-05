"""
AI Hub service layer implementation.
Provides text, image, video, and audio generation, PDF analysis,
plus speech transcription capabilities.
"""

import asyncio
import base64
import io
import json
import logging
import os
import struct
import zipfile
from pathlib import Path
from typing import AsyncGenerator, Optional

import fitz
from core.config import settings
import httpx
from openai import AsyncOpenAI
from schemas.aihub import AnalyzePdfRequest, AnalyzePdfResponse
from schemas.aihub import (
    GenAudioRequest,
    GenAudioResponse,
    GenImgRequest,
    GenImgResponse,
    GenTxtRequest,
    GenTxtResponse,
    GenVideoRequest,
    GenVideoResponse,
    TranscribeAudioRequest,
    TranscribeAudioResponse,
)

try:
    import anthropic as _anthropic_sdk
    _ANTHROPIC_AVAILABLE = True
except ImportError:
    _ANTHROPIC_AVAILABLE = False

logger = logging.getLogger(__name__)

PDF_ANALYSIS_MODEL = "claude-sonnet-4.6"
PDF_SYSTEM_PROMPT = """You are a careful PDF analysis assistant.

Rules:
- Answer only from the attached PDF.
- If the PDF does not contain the requested information, say so clearly.
- Do not invent or infer unsupported facts.
- Mention page numbers for important facts whenever the PDF makes that possible.
- Match the user's instruction language.
"""
PDF_MODE_PROMPTS = {
    "qa": """Task type: Question answering.
Read the attached PDF and answer the user's question directly, clearly, and only with information supported by the document.""",
    "extract": """Task type: Structured extraction.
Read the attached PDF and extract the requested information as concise Markdown with clear headings and bullets when helpful.""",
}
PDF_MAX_PAGE_WINDOW = 80
PDF_MAX_TOTAL_BYTES = 15 * 1024 * 1024
PDF_MAX_TOTAL_PAGES = 80


class InvalidImageInputError(ValueError):
    """Raised when the provided image input cannot be parsed."""


class InvalidAudioInputError(ValueError):
    """Raised when the provided audio input cannot be parsed."""


class InvalidPdfInputError(ValueError):
    """Raised when the provided PDF input is invalid or unsupported."""


# Voice mapping: (model, gender) -> voice
VOICE_MAP: dict[tuple[str, str], str] = {
    # qwen3-tts-flash
    ("qwen3-tts-flash", "male"): "Ethan",
    ("qwen3-tts-flash", "female"): "Cherry",
    # gemini-2.5-pro-preview-tts
    ("gemini-2.5-pro-preview-tts", "male"): "Puck",
    ("gemini-2.5-pro-preview-tts", "female"): "Zephyr",
    # eleven
    ("eleven_v3", "male"): "echo",
    ("eleven_v3", "female"): "alloy",
    ("eleven_turbo_v2", "male"): "echo",
    ("eleven_turbo_v2", "female"): "alloy",
    # OpenAI gpt-4o-mini-tts
    ("gpt-4o-mini-tts", "male"): "echo",
    ("gpt-4o-mini-tts", "female"): "nova",
}
DEFAULT_VOICE = {"male": "Ethan", "female": "Cherry"}


_ANTHROPIC_TXT_MODEL = "claude-haiku-4-5-20251001"


def _demo_brand_extract(text: str) -> str:
    """Keyword-based brand extraction used when no AI API is configured."""
    import re

    def first_match(patterns, fallback=""):
        for p in patterns:
            m = re.search(p, text, re.IGNORECASE)
            if m:
                return m.group(1).strip()
        return fallback

    brand_name = first_match([
        r'(?:brand\s+name|company\s+name|organisation|organization|client)[:\s]+([A-Z][^\n]{2,40})',
        r'(?:^|\n)brand[:\s]+([A-Z][^\n]{2,40})',
        r'^([A-Z][A-Za-z0-9 &]{2,30})(?:\s*[-–|]|\s+brand)',
    ], "Demo Brand")

    hex_colors = re.findall(r'#[0-9A-Fa-f]{6}\b', text)
    colors = list(dict.fromkeys(hex_colors))

    fonts = re.findall(r'(?:font|typeface|typography)[:\s]+([A-Z][a-zA-Z ]{2,25})', text, re.IGNORECASE)

    tone_words = []
    for w in ['bold', 'professional', 'friendly', 'modern', 'clean', 'energetic', 'warm', 'innovative', 'trustworthy']:
        if w.lower() in text.lower():
            tone_words.append(w)

    result = {
        "brand_name": brand_name,
        "tagline": first_match([r'tagline[:\s]+([^\n]{5,80})', r'slogan[:\s]+([^\n]{5,80})']),
        "industry": first_match([r'industry[:\s]+([^\n]{3,40})', r'sector[:\s]+([^\n]{3,40})']),
        "primary_color": colors[0] if len(colors) > 0 else "#7c3aed",
        "secondary_color": colors[1] if len(colors) > 1 else "#06b6d4",
        "accent_color": colors[2] if len(colors) > 2 else "#f59e0b",
        "font_heading": fonts[0] if fonts else "",
        "font_body": fonts[1] if len(fonts) > 1 else "",
        "tone_of_voice": ", ".join(tone_words[:4]) + " brand voice" if tone_words else "Professional and approachable brand voice",
        "guidelines_notes": text[:500].replace("\n", " ").strip(),
    }
    import json as _json
    return _json.dumps(result)


# Map OpenRouter-style model IDs to Gemini-native names when using the Gemini endpoint.
# This lets the frontend keep meaningful tool labels while the backend routes correctly.
_GEMINI_MODEL_FALLBACK = "gemini-2.5-flash"
_OPENROUTER_TO_GEMINI: dict[str, str] = {
    "anthropic/claude-sonnet-4-5": "gemini-2.5-flash",
    "anthropic/claude-3-5-sonnet-20241022": "gemini-2.5-flash",
    "anthropic/claude-3-haiku": "gemini-2.0-flash",
    "openai/gpt-4o": "gemini-2.0-flash",
    "openai/gpt-4o-mini": "gemini-2.0-flash",
    "openai/gpt-4-turbo": "gemini-2.0-flash",
    "google/gemini-flash-1.5": "gemini-1.5-flash",
    "google/gemini-pro-1.5": "gemini-1.5-pro",
    "deepseek/deepseek-chat": "gemini-2.5-flash",
    "meta-llama/llama-3.1-8b-instruct": "gemini-2.0-flash",
}


class AIHubService:
    """AI Hub service class that wraps AI SDK calls."""

    def __init__(self):
        self.client: Optional[AsyncOpenAI] = None
        self._anthropic_client = None

        try:
            base_url = settings.app_ai_base_url
            key = settings.app_ai_key
        except AttributeError:
            base_url = None
            key = None

        if base_url and key:
            self.client = AsyncOpenAI(
                api_key=key,
                base_url=base_url.rstrip("/"),
            )
        elif _ANTHROPIC_AVAILABLE and os.getenv("ANTHROPIC_API_KEY"):
            self._anthropic_client = _anthropic_sdk.AsyncAnthropic(
                api_key=os.getenv("ANTHROPIC_API_KEY")
            )

    def _normalize_model(self, model: str) -> str:
        """Map OpenRouter-style model names to the API-native names when using Gemini endpoint."""
        if not self.client:
            return model
        base_url = getattr(self.client, "base_url", None)
        if base_url and "generativelanguage" in str(base_url):
            mapped = _OPENROUTER_TO_GEMINI.get(model)
            if mapped:
                logger.debug(f"Model mapped: {model!r} → {mapped!r} (Gemini endpoint)")
                return mapped
            if "/" in model:
                logger.warning(f"Unknown OpenRouter model {model!r} on Gemini endpoint, falling back to {_GEMINI_MODEL_FALLBACK}")
                return _GEMINI_MODEL_FALLBACK
        return model

    def _require_ai_client(self) -> AsyncOpenAI:
        """Return the configured AI client or raise a configuration error."""
        if not self.client:
            raise ValueError("AI service not configured. Set APP_AI_BASE_URL and APP_AI_KEY.")
        return self.client

    def _has_anthropic(self) -> bool:
        return self._anthropic_client is not None

    async def _gentxt_anthropic(self, request: GenTxtRequest) -> str:
        """Generate text via Anthropic SDK."""
        client = self._anthropic_client
        system_parts = [m.content for m in request.messages if m.role == "system"]
        user_messages = [{"role": m.role, "content": m.content} for m in request.messages if m.role != "system"]
        system = "\n\n".join(str(p) for p in system_parts) if system_parts else None
        kwargs = dict(
            model=_ANTHROPIC_TXT_MODEL,
            messages=user_messages,
            max_tokens=request.max_tokens or 4096,
        )
        if system:
            kwargs["system"] = system
        response = await client.messages.create(**kwargs)
        return response.content[0].text if response.content else ""

    async def _gentxt_stream_anthropic(self, request: GenTxtRequest) -> AsyncGenerator[str, None]:
        """Stream text via Anthropic SDK."""
        client = self._anthropic_client
        system_parts = [m.content for m in request.messages if m.role == "system"]
        user_messages = [{"role": m.role, "content": m.content} for m in request.messages if m.role != "system"]
        system = "\n\n".join(str(p) for p in system_parts) if system_parts else None
        kwargs = dict(
            model=_ANTHROPIC_TXT_MODEL,
            messages=user_messages,
            max_tokens=request.max_tokens or 4096,
        )
        if system:
            kwargs["system"] = system
        async with client.messages.stream(**kwargs) as stream:
            async for text in stream.text_stream:
                yield text

    def _convert_message(self, msg) -> dict:
        """Convert message format and support multimodal content."""
        content = msg.content
        # If content is a list (multimodal), convert it to plain dicts
        if isinstance(content, list):
            content = [item.model_dump() if hasattr(item, "model_dump") else item for item in content]
        return {"role": msg.role, "content": content}

    def _is_unconfigured(self) -> bool:
        return self.client is None and not self._has_anthropic()

    def _demo_response(self, request: GenTxtRequest) -> str:
        """Return a demo AI response by extracting text from the last user message."""
        user_text = ""
        for msg in reversed(request.messages):
            if msg.role == "user":
                user_text = str(msg.content)
                break
        extract_marker = "Extract brand information from this document:"
        if extract_marker in user_text:
            doc_text = user_text.split(extract_marker, 1)[-1].strip()
            return _demo_brand_extract(doc_text)
        return '{"content": "AI provider not configured. Add ANTHROPIC_API_KEY to backend/.env to enable AI features."}'

    async def gentxt(self, request: GenTxtRequest) -> GenTxtResponse:
        """
        Generate Text API (non-streaming), supports text and image input.

        Args:
            request: Generate text request parameters.

        Returns:
            Txt2TxtResponse: generated text response.
        """
        try:
            if self._is_unconfigured():
                return GenTxtResponse(content=self._demo_response(request), model="demo")

            if self._has_anthropic():
                content = await self._gentxt_anthropic(request)
                return GenTxtResponse(content=content, model=_ANTHROPIC_TXT_MODEL)

            client = self._require_ai_client()
            messages = [self._convert_message(msg) for msg in request.messages]
            model = self._normalize_model(request.model)

            response = await client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=request.temperature,
                max_tokens=request.max_tokens,
                stream=False,
            )

            content = response.choices[0].message.content or ""
            usage = None
            if response.usage:
                usage = {
                    "prompt_tokens": response.usage.prompt_tokens,
                    "completion_tokens": response.usage.completion_tokens,
                    "total_tokens": response.usage.total_tokens,
                }

            return GenTxtResponse(
                content=content,
                model=request.model,
                usage=usage,
            )

        except Exception as e:
            logger.error(f"gentxt error: {e}")
            raise

    async def gentxt_stream(self, request: GenTxtRequest) -> AsyncGenerator[str, None]:
        """
        Generate Text API (streaming), supports text and image input.

        Args:
            request: Generate text request parameters.

        Yields:
            str: Generated text content chunk (plain text, not JSON).
        """
        try:
            if self._is_unconfigured():
                yield self._demo_response(request)
                return

            if self._has_anthropic():
                async for chunk in self._gentxt_stream_anthropic(request):
                    yield chunk
                return

            client = self._require_ai_client()
            messages = [self._convert_message(msg) for msg in request.messages]
            model = self._normalize_model(request.model)

            stream = await client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=request.temperature,
                max_tokens=request.max_tokens,
                stream=True,
            )

            async for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content

        except Exception as e:
            logger.error(f"gentxt_stream error: {e}")
            raise

    async def genimg_flux(self, prompt: str, size: str = "square_hd", model: str = "flux-pro") -> list[str]:
        """Generate images. Tries fal.ai Flux first; falls back to Gemini when fal.ai is unavailable."""
        fal_key = os.getenv("FAL_KEY", "")
        fal_available = bool(fal_key)

        if fal_available:
            size_map = {
                "1024x1024": "square_hd", "1024x1792": "portrait_4_3",
                "1792x1024": "landscape_4_3", "square": "square_hd",
                "portrait": "portrait_4_3", "landscape": "landscape_4_3",
                "square_hd": "square_hd",
            }
            fal_size = size_map.get(size, "square_hd")
            model_endpoints = {
                "flux-pro": "fal-ai/flux-pro/v1.1",
                "flux-pro-ultra": "fal-ai/flux-pro/v1.1-ultra",
                "flux-dev": "fal-ai/flux/dev",
                "flux-schnell": "fal-ai/flux/schnell",
            }
            endpoint = model_endpoints.get(model, "fal-ai/flux-pro/v1.1")
            payload = {
                "prompt": prompt,
                "image_size": fal_size,
                "num_images": 1,
                "output_format": "jpeg",
                "safety_tolerance": "2",
            }
            try:
                async with httpx.AsyncClient(timeout=120.0) as http:
                    resp = await http.post(
                        f"https://fal.run/{endpoint}",
                        headers={"Authorization": f"Key {fal_key}", "Content-Type": "application/json"},
                        json=payload,
                    )
                    if resp.status_code in (401, 402, 403):
                        logger.warning(f"fal.ai returned {resp.status_code} — falling back to Gemini image gen")
                        fal_available = False
                    else:
                        resp.raise_for_status()
                        data = resp.json()
                        images = [item["url"] for item in data.get("images", []) if item.get("url")]
                        if images:
                            return images
                        raise RuntimeError(f"Flux returned no images: {data}")
            except httpx.HTTPStatusError:
                fal_available = False
                logger.warning("fal.ai request failed — falling back to Gemini image gen")

        # Fallback: Gemini image generation (retry up to 3 times)
        logger.info(f"Generating image via Gemini (fal.ai {'balance exhausted' if fal_key else 'not configured'})")
        gemini_req = GenImgRequest(
            prompt=prompt,
            model="gemini-2.5-flash-image",
            size="1024x1024",
            quality="standard",
            n=1,
        )
        last_err: Exception = RuntimeError("Gemini image generation failed")
        for attempt in range(3):
            try:
                gemini_resp = await self.genimg(gemini_req)
                if gemini_resp.images:
                    return gemini_resp.images
            except Exception as e:
                last_err = e
                logger.warning(f"Gemini image gen attempt {attempt+1} failed: {e}")
            if attempt < 2:
                await asyncio.sleep(2)
        raise last_err

    async def genimg_flux_pulid(self, prompt: str, reference_image: str, size: str = "square_hd") -> list[str]:
        """Generate images with consistent face/character via fal.ai Flux PuLID."""
        api_key = os.getenv("FAL_KEY", "")
        if not api_key:
            raise ValueError("FAL_KEY not configured in backend .env — sign up free at fal.ai")

        size_map = {
            "1024x1024": "square_hd",
            "1024x1792": "portrait_4_3",
            "1792x1024": "landscape_4_3",
            "square": "square_hd",
            "portrait": "portrait_4_3",
            "landscape": "landscape_4_3",
            "square_hd": "square_hd",
        }
        fal_size = size_map.get(size, "square_hd")

        payload = {
            "prompt": prompt,
            "main_face_image": reference_image,
            "image_size": fal_size,
            "num_images": 1,
            "output_format": "jpeg",
        }

        async with httpx.AsyncClient(timeout=180.0) as http:
            resp = await http.post(
                "https://fal.run/fal-ai/flux-pulid",
                headers={
                    "Authorization": f"Key {api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()

        images: list[str] = []
        for item in data.get("images", []):
            url = item.get("url", "")
            if url:
                images.append(url)

        if not images:
            raise RuntimeError(f"Flux PuLID returned no images. Response: {data}")

        return images

    @staticmethod
    def _extract_image_ref(item: object) -> str:
        """
        Extract an image reference from an OpenAI-compatible genimg response item.

        Prefer `url` (to avoid huge response bodies); if url is not available, fall back to `b64_json`
        and wrap it as a base64 data URI.
        Compatible with both dict items and SDK object items.
        """
        if isinstance(item, dict):
            url = item.get("url")
            if url:
                return url
            b64_json = item.get("b64_json")
            if b64_json:
                return f"data:image/png;base64,{b64_json}"
        else:
            url = getattr(item, "url", None)
            if url:
                return url
            b64_json = getattr(item, "b64_json", None)
            if b64_json:
                return f"data:image/png;base64,{b64_json}"

        raise RuntimeError("Neither url nor b64_json found in genimg response item")

    @staticmethod
    def _parse_data_uri(data_uri: str) -> tuple[bytes, str]:
        """Parse a base64 data URI and return (bytes, content_type)."""
        if "," not in data_uri:
            raise InvalidImageInputError("Invalid data URI: missing ',' separator.")

        header, b64_data = data_uri.split(",", 1)
        content_type = "image/png"
        if header.startswith("data:"):
            meta = header[5:]
            # Typical header: "image/png;base64"
            if ";" in meta:
                maybe_type = meta.split(";", 1)[0].strip()
                if maybe_type:
                    content_type = maybe_type
            elif meta.strip():
                content_type = meta.strip()

        try:
            return base64.b64decode(b64_data), content_type
        except Exception as e:
            raise InvalidImageInputError("Invalid base64 data in data URI.") from e

    @staticmethod
    def _filename_from_content_type(content_type: str, name_prefix: str = "file", default_ext: str = "bin") -> str:
        """Best-effort filename for in-memory uploads."""
        ct = (content_type or "").lower()
        ext = {
            "image/png": "png",
            "image/jpeg": "jpg",
            "image/jpg": "jpg",
            "image/webp": "webp",
            "audio/mpeg": "mp3",
            "audio/mp3": "mp3",
            "audio/wav": "wav",
            "audio/x-wav": "wav",
            "audio/mp4": "m4a",
            "audio/x-m4a": "m4a",
            "audio/webm": "webm",
            "audio/ogg": "ogg",
            "audio/flac": "flac",
        }.get(ct, default_ext)
        return f"{name_prefix}.{ext}"

    @staticmethod
    def _get_source_name(source_ref: str, fallback: str = "input_file") -> str:
        """Get a readable display name from a URL/path/data URI."""
        ref = (source_ref or "").strip()
        if ref.startswith(("http://", "https://")):
            return ref.split("?")[0].rstrip("/").split("/")[-1] or fallback
        if ref.startswith("data:"):
            return fallback
        return Path(ref).name or fallback

    async def _image_str_to_upload_file(self, image: str, name_prefix: str = "image") -> io.BytesIO:
        """
        Convert image input (base64 data URI or HTTP URL) into an in-memory file object for uploads.

        The OpenAI `images.edit` endpoint expects multipart file uploads; we keep the API JSON-only
        by allowing clients to pass a base64 data URI or HTTP URL, and converting it here.
        """
        image = (image or "").strip()
        if not image:
            raise InvalidImageInputError("Input image is empty.")

        # Handle HTTP URL: download content
        if image.startswith(("http://", "https://")):
            import httpx

            try:
                async with httpx.AsyncClient(timeout=60.0, trust_env=True) as client:
                    resp = await client.get(image)
                    resp.raise_for_status()
                    image_bytes = resp.content

                # Extract filename from URL (fallback if missing)
                name = image.split("?")[0].rstrip("/").split("/")[-1] or f"{name_prefix}.png"
                upload = io.BytesIO(image_bytes)
                upload.name = name  # type: ignore[attr-defined]
                return upload
            except Exception as e:
                raise InvalidImageInputError(f"Failed to download image from URL: {e}") from e

        if not image.startswith("data:"):
            raise InvalidImageInputError(
                "Only base64 data URI or HTTP URL is supported. Example: `data:image/png;base64,...` or `https://...`."
            )

        image_bytes, content_type = self._parse_data_uri(image)

        upload = io.BytesIO(image_bytes)
        # openai SDK uses this name for multipart filename
        upload.name = self._filename_from_content_type(  # type: ignore[attr-defined]
            content_type,
            name_prefix=name_prefix,
            default_ext="png",
        )
        return upload

    async def _image_input_to_upload_files(self, image_input: str | list[str]) -> list[io.BytesIO]:
        """
        Convert image input (single data URI or list of data URIs) into uploadable file objects.

        Some OpenAI-compatible `images/edits` implementations support multiple input images.
        """
        images = [image_input] if isinstance(image_input, str) else image_input
        if not images:
            raise InvalidImageInputError("Input image list is empty.")

        upload_files: list[io.BytesIO] = []
        for idx, img in enumerate(images):
            if not isinstance(img, str):
                raise InvalidImageInputError("Each image must be a base64 data URI string.")
            upload_files.append(await self._image_str_to_upload_file(img, name_prefix=f"image_{idx + 1}"))
        return upload_files

    async def _audio_str_to_upload_file(self, audio: str, name_prefix: str = "audio") -> io.BytesIO:
        """
        Convert audio input (base64 data URI, HTTP URL, or absolute path) into an in-memory file object.

        This keeps the API JSON-only while still supporting OpenAI-compatible multipart upload semantics.
        """
        audio = (audio or "").strip()
        if not audio:
            raise InvalidAudioInputError("Input audio is empty.")

        if audio.startswith(("http://", "https://")):
            try:
                async with httpx.AsyncClient(timeout=120.0, trust_env=True) as client:
                    resp = await client.get(audio)
                    resp.raise_for_status()
                    audio_bytes = resp.content
                name = self._get_source_name(audio, fallback=f"{name_prefix}.mp3")
                upload = io.BytesIO(audio_bytes)
                upload.name = name  # type: ignore[attr-defined]
                return upload
            except Exception as e:
                raise InvalidAudioInputError(f"Failed to download audio from URL: {e}") from e

        if audio.startswith("data:"):
            audio_bytes, content_type = self._parse_data_uri(audio)
            upload = io.BytesIO(audio_bytes)
            upload.name = self._filename_from_content_type(  # type: ignore[attr-defined]
                content_type,
                name_prefix=name_prefix,
                default_ext="mp3",
            )
            return upload

        path = Path(audio).expanduser()
        if not path.is_absolute():
            raise InvalidAudioInputError(
                "Only absolute path, http(s) URL, or base64 data URI is supported for audio input."
            )
        if not path.exists() or not path.is_file():
            raise FileNotFoundError(f"Audio file not found: {str(path)}")

        upload = io.BytesIO(path.read_bytes())
        upload.name = path.name  # type: ignore[attr-defined]
        return upload

    @staticmethod
    def _extract_transcription_text(resp: object) -> Optional[str]:
        """Extract transcription text from SDK response."""
        if isinstance(resp, str) and resp.strip():
            return resp.strip()

        if isinstance(resp, dict):
            text = resp.get("text")
            if isinstance(text, str) and text.strip():
                return text.strip()
            content = resp.get("content")
        else:
            text = getattr(resp, "text", None)
            if isinstance(text, str) and text.strip():
                return text.strip()
            content = getattr(resp, "content", None)

        if isinstance(content, bytes):
            content = content.decode("utf-8", errors="ignore")

        if isinstance(content, dict):
            data = content
        elif isinstance(content, str) and content.strip():
            try:
                data = json.loads(content)
            except json.JSONDecodeError:
                return None
        else:
            return None

        text = data.get("text")
        if isinstance(text, str) and text.strip():
            return text.strip()
        return None

    @staticmethod
    def _pcm_to_wav(pcm: bytes, sample_rate: int = 24000, channels: int = 1, bits: int = 16) -> bytes:
        """Wrap raw PCM L16 bytes in a WAV container so browsers can play it."""
        data_size = len(pcm)
        header = struct.pack(
            "<4sI4s4sIHHIIHH4sI",
            b"RIFF", 36 + data_size, b"WAVE",
            b"fmt ", 16, 1, channels,
            sample_rate,
            sample_rate * channels * bits // 8,
            channels * bits // 8,
            bits,
            b"data", data_size,
        )
        return header + pcm

    @staticmethod
    def _parse_base64_data_uri(data_uri: str, *, error_cls: type[ValueError]) -> tuple[bytes, str]:
        """Parse a base64 data URI and return decoded bytes plus content type."""
        if "," not in data_uri:
            raise error_cls("Invalid data URI: missing ',' separator.")

        header, b64_data = data_uri.split(",", 1)
        content_type = "application/octet-stream"
        if header.startswith("data:"):
            meta = header[5:]
            if ";" in meta:
                maybe_type = meta.split(";", 1)[0].strip()
                if maybe_type:
                    content_type = maybe_type
            elif meta.strip():
                content_type = meta.strip()

        try:
            return base64.b64decode(b64_data), content_type
        except Exception as exc:
            raise error_cls("Invalid base64 data in data URI.") from exc

    @staticmethod
    def _extract_chat_text_content(content: object) -> str:
        """Extract text from OpenAI-compatible chat message content."""
        if isinstance(content, str):
            return content.strip()

        if isinstance(content, list):
            parts: list[str] = []
            for item in content:
                if isinstance(item, dict):
                    text = item.get("text")
                else:
                    text = getattr(item, "text", None)
                if isinstance(text, str) and text.strip():
                    parts.append(text.strip())
            return "\n".join(parts).strip()

        return ""

    @classmethod
    def _extract_completion_text(cls, response: object) -> str:
        """Extract the first completion text from a chat completion response."""
        choices = getattr(response, "choices", None)
        if not choices:
            return ""
        first_choice = choices[0]
        message = getattr(first_choice, "message", None)
        content = getattr(message, "content", None) if message else None
        return cls._extract_chat_text_content(content)

    @staticmethod
    def _build_pdf_user_prompt(instruction: str, mode: str) -> str:
        return f"""{PDF_MODE_PROMPTS[mode]}

User instruction:
{instruction.strip()}
"""

    @staticmethod
    def _build_pdf_success_message(page_start: int, page_end: int, total_pages: int) -> str:
        selected_range = f"page {page_start}" if page_start == page_end else f"pages {page_start}-{page_end}"
        total_label = "page" if total_pages == 1 else "pages"
        return f"PDF analyzed successfully using {selected_range} of {total_pages} total {total_label}."

    @staticmethod
    def _resolve_pdf_page_range(
        total_pages: int,
        page_start: int = 1,
        page_end: Optional[int] = None,
    ) -> tuple[int, int]:
        if total_pages <= 0:
            raise InvalidPdfInputError("PDF has no pages.")
        if page_start < 1:
            raise InvalidPdfInputError("page_start must be greater than or equal to 1.")
        if page_start > total_pages:
            raise InvalidPdfInputError(f"page_start {page_start} exceeds total PDF pages {total_pages}.")

        if page_end is None:
            page_end = min(total_pages, page_start + PDF_MAX_PAGE_WINDOW - 1)

        if page_end < page_start:
            raise InvalidPdfInputError("page_end must be greater than or equal to page_start.")
        if page_end > total_pages:
            raise InvalidPdfInputError(f"page_end {page_end} exceeds total PDF pages {total_pages}.")

        selected_pages = page_end - page_start + 1
        if selected_pages > PDF_MAX_PAGE_WINDOW:
            raise InvalidPdfInputError(
                f"Requested page range contains {selected_pages} pages. "
                f"The maximum supported range per request is {PDF_MAX_PAGE_WINDOW} pages."
            )

        return page_start, page_end

    @staticmethod
    def _validate_pdf_attachment_limits(pdf_bytes: bytes, page_count: int) -> None:
        if len(pdf_bytes) <= PDF_MAX_TOTAL_BYTES and page_count <= PDF_MAX_TOTAL_PAGES:
            return

        size_mb = len(pdf_bytes) / 1024 / 1024
        raise InvalidPdfInputError(
            "PDF exceeds native attachment limits: "
            f"{size_mb:.2f}MB and {page_count} pages "
            "(limits: 15MB total, 80 pages total)."
        )

    @classmethod
    def _prepare_pdf_attachment(
        cls,
        pdf_bytes: bytes,
        page_start: int = 1,
        page_end: Optional[int] = None,
    ) -> tuple[str, int, int, int]:
        try:
            source_doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        except Exception as exc:
            raise InvalidPdfInputError("Failed to read the provided PDF document.") from exc

        try:
            total_pages = source_doc.page_count
            start, end = cls._resolve_pdf_page_range(total_pages=total_pages, page_start=page_start, page_end=page_end)
            subset_doc = fitz.open()
            try:
                subset_doc.insert_pdf(source_doc, from_page=start - 1, to_page=end - 1)
                subset_bytes = subset_doc.tobytes(garbage=4, deflate=True)
            finally:
                subset_doc.close()
        finally:
            source_doc.close()

        cls._validate_pdf_attachment_limits(subset_bytes, end - start + 1)
        return base64.b64encode(subset_bytes).decode("utf-8"), start, end, total_pages

    async def _pdf_source_to_bytes(self, pdf: str) -> tuple[bytes, str]:
        """Resolve a PDF data URI into raw bytes and a readable file name."""
        pdf = (pdf or "").strip()
        if not pdf:
            raise InvalidPdfInputError("PDF input is empty.")

        if not pdf.startswith("data:"):
            raise InvalidPdfInputError(
                "Only base64 PDF data URI is supported for PDF input. Example: `data:application/pdf;base64,...`."
            )

        pdf_bytes, content_type = self._parse_base64_data_uri(pdf, error_cls=InvalidPdfInputError)
        if content_type.lower() != "application/pdf":
            raise InvalidPdfInputError("PDF data URI must use content type `application/pdf`.")

        return pdf_bytes, self._get_source_name(pdf, fallback="document.pdf")

    async def analyze_pdf(self, request: AnalyzePdfRequest) -> AnalyzePdfResponse:
        """Analyze a single PDF with native PDF input."""
        if not request.instruction or not request.instruction.strip():
            raise InvalidPdfInputError("instruction is required for PDF analysis.")

        client = self._require_ai_client()
        pdf_bytes, pdf_name = await self._pdf_source_to_bytes(request.pdf)
        pdf_b64, start, end, total_pages = self._prepare_pdf_attachment(
            pdf_bytes=pdf_bytes,
            page_start=request.page_start,
            page_end=request.page_end,
        )
        user_prompt = self._build_pdf_user_prompt(request.instruction, request.mode)
        response = await client.chat.completions.create(
            model=PDF_ANALYSIS_MODEL,
            messages=[
                {"role": "system", "content": PDF_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": user_prompt},
                        {
                            "type": "document",
                            "source": {
                                "type": "base64",
                                "media_type": "application/pdf",
                                "data": pdf_b64,
                            },
                            "citations": {"enabled": True},
                        },
                    ],
                },
            ],
            temperature=0.0,
            max_tokens=8192,
            stream=False,
        )
        result = self._extract_completion_text(response)
        if not result:
            raise RuntimeError("PDF analysis returned an empty result.")

        return AnalyzePdfResponse(
            status="success",
            result=result,
            message=self._build_pdf_success_message(start, end, total_pages),
            pdf_name=pdf_name,
            mode=request.mode,
            model=PDF_ANALYSIS_MODEL,
            page_start=start,
            page_end=end,
            total_pages=total_pages,
        )

    async def _genimg_imagen4(self, prompt: str, model: str = "imagen-4.0-ultra-generate-001", aspect_ratio: str = "1:1", n: int = 1) -> list[str]:
        """Generate images with Imagen 4 via the native predict endpoint."""
        api_key = os.getenv("APP_AI_KEY", "")
        if not api_key:
            raise ValueError("APP_AI_KEY not configured")

        size_to_aspect = {
            "1024x1024": "1:1", "1024x1792": "9:16", "1792x1024": "16:9",
            "1:1": "1:1", "9:16": "9:16", "16:9": "16:9", "4:3": "4:3", "3:4": "3:4",
        }
        aspect = size_to_aspect.get(aspect_ratio, "1:1")

        payload = {
            "instances": [{"prompt": prompt}],
            "parameters": {
                "sampleCount": min(n, 4),
                "aspectRatio": aspect,
                "safetyFilterLevel": "block_few",
                "personGeneration": "allow_adult",
            },
        }
        async with httpx.AsyncClient(timeout=120.0) as http:
            resp = await http.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{model}:predict?key={api_key}",
                json=payload,
            )
            if resp.status_code in (429, 503):
                raise RuntimeError(f"Imagen 4 overloaded (HTTP {resp.status_code}) — try again in a moment")
            resp.raise_for_status()
            data = resp.json()

        images = []
        for pred in data.get("predictions", []):
            b64 = pred.get("bytesBase64Encoded", "")
            mime = pred.get("mimeType", "image/png")
            if b64:
                images.append(f"data:{mime};base64,{b64}")
        if not images:
            raise RuntimeError(f"Imagen 4 returned no images: {data}")
        return images

    async def _genimg_gemini_chat(self, request) -> "GenImgResponse":
        """
        Conversational image generation using gemini-3-pro-image — the same model
        used by Gemini web. Passes the full conversation history including previous
        generated images so Gemini can iteratively refine across turns.
        """
        api_key = os.getenv("APP_AI_KEY", "")
        if not api_key:
            raise ValueError("APP_AI_KEY not configured")

        # Aspect ratio hint injected into prompt
        size_hint_map = {
            "1:1": "square 1:1 format",
            "9:16": "vertical portrait 9:16 format (Instagram stories, TikTok)",
            "16:9": "landscape 16:9 format",
            "4:3": "4:3 landscape format",
            "3:4": "3:4 portrait format",
            "1024x1024": "square 1:1 format",
            "1024x1792": "vertical portrait 9:16 format",
            "1792x1024": "landscape 16:9 format",
        }
        size_hint = size_hint_map.get(request.size, "square 1:1 format")

        contents: list[dict] = []

        def _data_uri_to_inline(uri: str) -> dict | None:
            """Convert a base64 data URI to Gemini inlineData part."""
            if not uri or not uri.startswith("data:"):
                return None
            try:
                mime_part = uri.split(";")[0][5:]
                b64_part = uri.split(",", 1)[1]
                return {"inlineData": {"mimeType": mime_part, "data": b64_part}}
            except Exception:
                return None

        # ── Build conversation history ──
        if request.messages:
            # Keep last 8 messages (4 turns) to stay within limits; strip attachedImage
            # from older user turns to reduce payload size.
            history = request.messages[-8:]
            for i, msg in enumerate(history):
                gemini_role = "user" if msg.role == "user" else "model"
                parts: list[dict] = []

                # Text content (skip error sentinels and loading text)
                text = (msg.content or "").strip()
                if text and not text.startswith("__error__") and text != "Generating image…":
                    parts.append({"text": text})

                # User-uploaded image (only for recent turns to limit payload)
                if gemini_role == "user" and msg.attached_image:
                    inline = _data_uri_to_inline(msg.attached_image)
                    if inline:
                        parts.append(inline)

                # AI-generated image in assistant turn — compress to thumbnail so the
                # payload stays small while giving Gemini enough visual context to refine.
                if gemini_role == "model" and msg.image_url:
                    thumb_uri = await asyncio.to_thread(
                        self._compress_image_for_history, msg.image_url
                    )
                    inline = _data_uri_to_inline(thumb_uri) if thumb_uri else None
                    if inline:
                        parts.append(inline)
                    elif not parts:
                        parts.append({"text": "I generated an image."})

                if parts:
                    # Ensure proper alternation — merge consecutive same-role messages
                    if contents and contents[-1]["role"] == gemini_role:
                        contents[-1]["parts"].extend(parts)
                    else:
                        contents.append({"role": gemini_role, "parts": parts})

        # ── Current user turn ──
        if request.image:
            # Reference image provided — match its exact format and dimensions
            size_instruction = (
                f"IMPORTANT: Generate the output in EXACTLY the same aspect ratio and dimensions as the "
                f"reference image I am attaching ({size_hint}). Do not crop or change the format."
            )
        else:
            size_instruction = f"Output in {size_hint}."

        current_parts: list[dict] = [{"text": f"{request.prompt}\n\n{size_instruction}"}]
        if request.image:
            img_ref = request.image if isinstance(request.image, str) else request.image[0]
            inline = _data_uri_to_inline(img_ref)
            if inline:
                current_parts.append(inline)

        # Product reference images — prepend an instruction text, then append images
        # so Gemini knows exactly what these images are for
        product_images = getattr(request, "product_images", None) or []
        if product_images:
            valid_prod_inlines = [_data_uri_to_inline(u) for u in product_images]
            valid_prod_inlines = [p for p in valid_prod_inlines if p]
            if valid_prod_inlines:
                current_parts.append({
                    "text": (
                        f"PRODUCT REFERENCES ({len(valid_prod_inlines)} image{'s' if len(valid_prod_inlines) > 1 else ''} attached below): "
                        "These are the ACTUAL brand products. You MUST reproduce these exact products in the output — "
                        "same bike frame geometry, same helmet design, same kit/suit colours and logos. "
                        "Do NOT use generic or invented products. Match the product appearance precisely."
                    )
                })
                current_parts.extend(valid_prod_inlines)

        if contents and contents[-1]["role"] == "user":
            contents[-1]["parts"].extend(current_parts)
        else:
            contents.append({"role": "user", "parts": current_parts})

        system_instruction = (
            "You are a world-class creative director and brand marketing AI. "
            "ALWAYS respond with a high-quality image — never respond with text only. "
            "Generate professional marketing materials: bold typography, correct brand colors, "
            "clean layout, print-ready quality. "
            "When a reference image is provided, ALWAYS match its EXACT aspect ratio and dimensions. "
            "When refining, look at the previous image and apply the user's changes while preserving the design."
        )
        if product_images:
            system_instruction += (
                "\n\nPRODUCT FIDELITY RULE: The user has pinned specific product reference images. "
                "These are the brand's REAL products. Every image you generate MUST feature these exact products — "
                "faithfully reproduce the bike frame, helmet design, kit colours and logos shown in the references. "
                "Never substitute with generic products."
            )
        if request.brand_context:
            system_instruction += (
                "\n\n=== BRAND GUIDELINES — treat these as absolute ground truth for every design decision ===\n"
                + request.brand_context +
                "\n=== END BRAND GUIDELINES ==="
            )

        payload = {
            "system_instruction": {"parts": [{"text": system_instruction}]},
            "contents": contents,
            "generationConfig": {"responseModalities": ["IMAGE", "TEXT"]},
        }

        async with httpx.AsyncClient(timeout=120.0) as http:
            resp = await http.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image:generateContent?key={api_key}",
                json=payload,
            )
            if resp.status_code in (429, 503):
                raise RuntimeError(f"Gemini overloaded (HTTP {resp.status_code}) — try again in a moment")
            resp.raise_for_status()
            data = resp.json()

        resp_parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
        images = []
        for part in resp_parts:
            if "inlineData" in part:
                b64 = part["inlineData"]["data"]
                mime = part["inlineData"].get("mimeType", "image/jpeg")
                images.append(f"data:{mime};base64,{b64}")

        if not images:
            finish = data.get("candidates", [{}])[0].get("finishReason", "")
            raise RuntimeError(f"gemini-3-pro-image returned no image (finishReason={finish})")

        # ── Logo composite: extract real logo from original reference and paste onto generated image ──
        if images and request.image:
            try:
                img_ref = request.image if isinstance(request.image, str) else request.image[0]
                ref_bytes, ref_mime = self._parse_data_uri(img_ref)
                ref_b64 = base64.b64encode(ref_bytes).decode()
                bounds = await self._find_logo_bounds(ref_b64, ref_mime, api_key)
                if bounds.get("found"):
                    gen_uri = images[0]
                    gen_mime = gen_uri.split(";")[0][5:] if gen_uri.startswith("data:") else "image/jpeg"
                    gen_b64 = gen_uri.split(",", 1)[1]
                    composited = await asyncio.to_thread(
                        self._composite_logo_from_reference,
                        gen_b64, gen_mime,
                        ref_b64, ref_mime,
                        bounds,
                    )
                    images = [composited] + images[1:]
                    logger.info(f"Logo composited from reference: bounds={bounds}")
                else:
                    logger.info("No logo detected in reference — skipping logo composite")
            except Exception as e:
                logger.warning(f"Logo composite failed ({e}) — returning image as-is")

        return GenImgResponse(images=images, model="gemini-3-pro-image")

    @staticmethod
    def _compress_image_for_history(image_ref: str, max_width: int = 320) -> str | None:
        """
        Shrink an image (base64 data URI or HTTP URL) to a small thumbnail for conversation history.
        Returns a compressed data URI (~20-40 KB) or None if the input can't be parsed.
        Handles HTTP URLs via urllib so it works inside asyncio.to_thread.
        """
        if not image_ref:
            return None
        try:
            import io as _io
            from PIL import Image

            if image_ref.startswith(("http://", "https://")):
                import urllib.request
                req = urllib.request.Request(
                    image_ref,
                    headers={"User-Agent": "CreativeRoom/1.0"},
                )
                with urllib.request.urlopen(req, timeout=30) as r:
                    img_bytes = r.read()
            elif image_ref.startswith("data:"):
                b64_part = image_ref.split(",", 1)[1]
                img_bytes = base64.b64decode(b64_part)
            else:
                return None

            img = Image.open(_io.BytesIO(img_bytes)).convert("RGB")
            w, h = img.size
            if w > max_width:
                img = img.resize((max_width, int(h * max_width / w)), Image.LANCZOS)
            buf = _io.BytesIO()
            img.save(buf, format="JPEG", quality=60)
            return f"data:image/jpeg;base64,{base64.b64encode(buf.getvalue()).decode()}"
        except Exception:
            return None

    async def _find_logo_bounds(self, img_b64: str, mime_type: str, api_key: str) -> dict:
        """
        Ask Gemini vision to locate the brand logo in the reference image.
        Returns {found, x1, y1, x2, y2} where coordinates are 0-100 percentages.
        """
        prompt = (
            "Find the brand logo (logotype, wordmark, or brand mark) in this image. "
            "Return ONLY valid JSON with these exact keys (no markdown, no explanation):\n"
            '{"found": true/false, "x1": <left% 0-100>, "y1": <top% 0-100>, "x2": <right% 0-100>, "y2": <bottom% 0-100>}\n\n'
            "Include a small padding margin around the logo. "
            'If no logo is visible return: {"found": false, "x1": 0, "y1": 0, "x2": 0, "y2": 0}'
        )
        payload = {
            "contents": [{"parts": [
                {"text": prompt},
                {"inlineData": {"mimeType": mime_type, "data": img_b64}},
            ]}],
            "generationConfig": {"temperature": 0.0, "maxOutputTokens": 128},
        }
        async with httpx.AsyncClient(timeout=20.0) as http:
            resp = await http.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key={api_key}",
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
        parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
        raw = next((p["text"] for p in parts if "text" in p), "{}")
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.split("```", 2)[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip().rstrip("`").strip()
        try:
            return json.loads(raw)
        except Exception:
            logger.warning(f"Logo bounds JSON parse failed: {raw[:200]}")
            return {"found": False}

    @staticmethod
    def _composite_logo_from_reference(
        generated_b64: str,
        generated_mime: str,
        reference_b64: str,
        reference_mime: str,
        bounds: dict,
    ) -> str:
        """
        Extract the logo region from the reference image and paste it at the same
        relative position on the generated image using Pillow.
        Returns a base64 data URI of the composited image.
        """
        import io as _io
        from PIL import Image

        ref_img = Image.open(_io.BytesIO(base64.b64decode(reference_b64))).convert("RGBA")
        ref_w, ref_h = ref_img.size

        gen_img = Image.open(_io.BytesIO(base64.b64decode(generated_b64))).convert("RGBA")
        gen_w, gen_h = gen_img.size

        # Convert percentage bounds to pixels in reference
        x1 = max(0, int(bounds["x1"] / 100 * ref_w))
        y1 = max(0, int(bounds["y1"] / 100 * ref_h))
        x2 = min(ref_w, max(x1 + 1, int(bounds["x2"] / 100 * ref_w)))
        y2 = min(ref_h, max(y1 + 1, int(bounds["y2"] / 100 * ref_h)))

        logo = ref_img.crop((x1, y1, x2, y2))

        # Scale to same relative size in generated image
        new_w = max(1, int((x2 - x1) / ref_w * gen_w))
        new_h = max(1, int((y2 - y1) / ref_h * gen_h))
        logo_scaled = logo.resize((new_w, new_h), Image.LANCZOS)

        # Paste at same relative position
        paste_x = int(bounds["x1"] / 100 * gen_w)
        paste_y = int(bounds["y1"] / 100 * gen_h)
        gen_img.paste(logo_scaled, (paste_x, paste_y), logo_scaled)

        buf = _io.BytesIO()
        gen_img.convert("RGB").save(buf, format="JPEG", quality=93)
        return f"data:image/jpeg;base64,{base64.b64encode(buf.getvalue()).decode()}"

    async def _extract_design_intent(self, prompt: str, api_key: str) -> dict:
        """
        Parse a natural-language image prompt and return structured design elements.
        Returns dict with: background_prompt, headline, subtext, cta, layout,
        text_color, add_overlay.
        """
        extraction_prompt = (
            "Parse this image generation prompt and respond with ONLY valid JSON (no markdown fences).\n\n"
            "JSON keys required:\n"
            "- background_prompt: rewrite the prompt for a VISUAL BACKGROUND ONLY "
            "(photographic/illustrative — no text, no words, no letters). Keep brand colors & mood.\n"
            "- headline: main marketing headline to overlay on the image (string, or empty string if none implied)\n"
            "- subtext: supporting line beneath the headline (string, or empty string)\n"
            "- cta: short call-to-action button text like 'Shop Now' (string, or empty string)\n"
            "- layout: one of: centered, top-center, bottom-center, top-left, bottom-left\n"
            "- text_color: '#FFFFFF' or '#000000' based on expected background brightness\n"
            "- add_overlay: true or false — add dark scrim for text readability\n\n"
            f"Prompt to parse:\n{prompt}"
        )
        payload = {
            "contents": [{"parts": [{"text": extraction_prompt}]}],
            "generationConfig": {"temperature": 0.1, "maxOutputTokens": 1024},
        }
        async with httpx.AsyncClient(timeout=20.0) as http:
            resp = await http.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key={api_key}",
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
        parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
        raw = next((p["text"] for p in parts if "text" in p), "{}")
        # Strip markdown fences if present
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.split("```", 2)[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip().rstrip("`").strip()
        try:
            return json.loads(raw)
        except Exception:
            logger.warning("Design intent JSON parse failed, raw response: %s", raw[:200])
            return {}

    @staticmethod
    def _find_font(size: int, bold: bool = True):
        """Load the best available font at the requested size."""
        from PIL import ImageFont
        home = os.path.expanduser("~")
        candidates = []
        if bold:
            candidates = [
                os.path.join(home, "Library/Fonts/Gilroy-ExtraBold.ttf"),
                os.path.join(home, "Library/Fonts/Gilroy-Bold.ttf"),
                "/System/Library/Fonts/HelveticaNeue.ttc",
                "/System/Library/Fonts/Helvetica.ttc",
                "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            ]
        else:
            candidates = [
                os.path.join(home, "Library/Fonts/Gilroy-Light.ttf"),
                os.path.join(home, "Library/Fonts/Gilroy-Bold.ttf"),
                "/System/Library/Fonts/HelveticaNeue.ttc",
                "/System/Library/Fonts/Helvetica.ttc",
                "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            ]
        for path in candidates:
            if os.path.exists(path):
                try:
                    return ImageFont.truetype(path, size)
                except Exception:
                    continue
        return ImageFont.load_default(size=size)

    @staticmethod
    def _wrap_text(draw, text: str, font, max_width: int) -> list[str]:
        """Word-wrap text to fit within max_width pixels."""
        words = text.split()
        lines: list[str] = []
        current = ""
        for word in words:
            test = (current + " " + word).strip()
            bb = draw.textbbox((0, 0), test, font=font)
            if bb[2] - bb[0] <= max_width:
                current = test
            else:
                if current:
                    lines.append(current)
                current = word
        if current:
            lines.append(current)
        return lines or [""]

    def _composite_design(
        self,
        image_b64: str,
        mime_type: str,
        headline: str,
        subtext: str,
        cta: str,
        layout: str,
        text_color: str,
        add_overlay: bool,
    ) -> str:
        """Overlay marketing text elements onto an image using Pillow. Returns data URI."""
        import io as _io
        from PIL import Image, ImageDraw

        img_bytes = base64.b64decode(image_b64)
        img = Image.open(_io.BytesIO(img_bytes)).convert("RGBA")
        W, H = img.size

        def parse_hex(h: str) -> tuple:
            h = h.lstrip("#")
            if len(h) == 3:
                h = "".join(c * 2 for c in h)
            try:
                return tuple(int(h[i: i + 2], 16) for i in (0, 2, 4))
            except Exception:
                return (255, 255, 255)

        tc_rgb = parse_hex(text_color)

        # ── Dark scrim overlay for text readability ──
        if add_overlay and (headline or subtext):
            overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
            od = ImageDraw.Draw(overlay)
            if layout in ("bottom-center", "bottom-left"):
                band_start = int(H * 0.55)
                for y in range(band_start, H):
                    a = int(180 * (y - band_start) / (H - band_start))
                    od.line([(0, y), (W, y)], fill=(0, 0, 0, a))
            elif layout in ("top-center", "top-left"):
                band_end = int(H * 0.45)
                for y in range(0, band_end):
                    a = int(160 * (1 - y / band_end))
                    od.line([(0, y), (W, y)], fill=(0, 0, 0, a))
            else:
                center_y = H // 2
                band_h = int(H * 0.38)
                for y in range(center_y - band_h, center_y + band_h):
                    dist = abs(y - center_y) / band_h
                    a = int(150 * (1 - dist))
                    od.line([(0, y), (W, y)], fill=(0, 0, 0, a))
            img = Image.alpha_composite(img, overlay)

        draw = ImageDraw.Draw(img)
        margin = int(W * 0.08)
        text_area_w = W - 2 * margin
        centered = "left" not in layout

        # Starting Y position
        if layout in ("top-center", "top-left"):
            y = int(H * 0.08)
        elif layout in ("bottom-center", "bottom-left"):
            y = int(H * 0.60)
        else:
            y = int(H * 0.33)

        def draw_text_line(text: str, font, x_center: bool, y_pos: int) -> int:
            """Draw a text line with drop shadow. Returns line height."""
            bb = draw.textbbox((0, 0), text, font=font)
            line_h = bb[3] - bb[1]
            x = (W // 2) if x_center else margin
            anchor = "ma" if x_center else "la"
            # Drop shadow
            draw.text((x + 2, y_pos + 2), text, font=font, fill=(0, 0, 0, 130), anchor=anchor)
            draw.text((x, y_pos), text, font=font, fill=tc_rgb + (255,), anchor=anchor)
            return line_h

        # ── Headline ──
        if headline:
            h_size = max(int(W * 0.075), 44)
            h_font = self._find_font(h_size, bold=True)
            h_lines = self._wrap_text(draw, headline.upper(), h_font, text_area_w)
            for line in h_lines:
                lh = draw_text_line(line, h_font, centered, y)
                y += lh + int(h_size * 0.12)
            y += int(h_size * 0.25)

        # ── Subtext ──
        if subtext:
            s_size = max(int(W * 0.036), 22)
            s_font = self._find_font(s_size, bold=False)
            s_lines = self._wrap_text(draw, subtext, s_font, text_area_w)
            for line in s_lines:
                lh = draw_text_line(line, s_font, centered, y)
                y += lh + int(s_size * 0.2)
            y += int(s_size * 0.5)

        # ── CTA button ──
        if cta:
            c_size = max(int(W * 0.032), 18)
            c_font = self._find_font(c_size, bold=True)
            bb = draw.textbbox((0, 0), cta, font=c_font)
            tw, th = bb[2] - bb[0], bb[3] - bb[1]
            pad_x, pad_y = int(W * 0.028), int(W * 0.014)
            btn_w, btn_h = tw + 2 * pad_x, th + 2 * pad_y
            btn_x = (W - btn_w) // 2 if centered else margin
            btn_img = Image.new("RGBA", img.size, (0, 0, 0, 0))
            bd = ImageDraw.Draw(btn_img)
            btn_fill = tc_rgb + (210,)
            bd.rounded_rectangle(
                [(btn_x, y), (btn_x + btn_w, y + btn_h)],
                radius=int(btn_h * 0.35),
                fill=btn_fill,
            )
            img = Image.alpha_composite(img, btn_img)
            draw = ImageDraw.Draw(img)
            btn_tc = (0, 0, 0) if sum(tc_rgb) > 380 else (255, 255, 255)
            draw.text((btn_x + pad_x, y + pad_y), cta, font=c_font, fill=btn_tc + (255,))

        # Output as JPEG
        result = img.convert("RGB")
        buf = _io.BytesIO()
        result.save(buf, format="JPEG", quality=93)
        b64 = base64.b64encode(buf.getvalue()).decode()
        return f"data:image/jpeg;base64,{b64}"

    async def genimg(self, request: GenImgRequest) -> GenImgResponse:
        """
        Generate Image API.
        Primary path: gemini-3-pro-image with full conversation history (same model as Gemini web).
        Fallback: Imagen 4 Ultra + Pillow text composite.
        """
        # Normalise size at entry — some downstream APIs require WxH, others accept ratio strings.
        # Always store the canonical ratio string in request.size; callers that need WxH convert locally.
        _wxh_to_ratio = {
            "1024x1024": "1:1", "1024x1792": "9:16", "1792x1024": "16:9",
            "1024x1365": "3:4", "1365x1024": "4:3",
        }
        if request.size in _wxh_to_ratio:
            request.size = _wxh_to_ratio[request.size]

        try:
            # ── Primary: conversational Gemini (gemini-3-pro-image) ──
            try:
                return await self._genimg_gemini_chat(request)
            except Exception as e:
                logger.warning(f"gemini-3-pro-image failed ({e}), falling back to Imagen 4 pipeline")

            # ── Fallback: img2img reference pipeline ──
            if request.image:
                return await self._genimg_with_reference(request)

            # ── Fallback: Imagen 4 Ultra + text overlay ──
            api_key = os.getenv("APP_AI_KEY", "")
            design: dict = {}
            if api_key:
                try:
                    design = await self._extract_design_intent(request.prompt, api_key)
                except Exception as e:
                    logger.warning(f"Design intent extraction failed ({e})")

            bg_prompt = design.get("background_prompt") or request.prompt
            if request.brand_context:
                bg_prompt += "\n\nBrand guidelines:\n" + request.brand_context
            images: list[str] = []
            model_used = "imagen-4.0-ultra-generate-001"
            try:
                images = await self._genimg_imagen4(
                    prompt=bg_prompt,
                    model=model_used,
                    aspect_ratio=request.size,
                    n=request.n,
                )
            except Exception as e:
                logger.warning(f"Imagen 4 Ultra also failed ({e}), trying gemini-2.5-flash-image")
                model_used = "gemini-2.5-flash-image"
                client = self._require_ai_client()
                # images.generate expects WxH — map aspect ratio strings
                _aspect_to_wxh = {
                    "1:1": "1024x1024", "9:16": "1024x1792", "16:9": "1792x1024",
                    "3:4": "1024x1365", "4:3": "1365x1024",
                }
                size_wxh = _aspect_to_wxh.get(request.size, request.size)
                response = await client.images.generate(
                    model=model_used,
                    prompt=bg_prompt,
                    size=size_wxh,
                    quality=request.quality,
                    n=request.n,
                )
                if not response.data:
                    raise RuntimeError("Image generation returned empty result")
                images = [self._extract_image_ref(item) for item in response.data]

            headline = design.get("headline", "")
            subtext = design.get("subtext", "")
            cta = design.get("cta", "")
            if images and (headline or subtext or cta):
                try:
                    img_data = images[0]
                    mime_part = img_data.split(";")[0][5:] if img_data.startswith("data:") else "image/png"
                    b64_part = img_data.split(",", 1)[1] if img_data.startswith("data:") else img_data
                    composited = await asyncio.to_thread(
                        self._composite_design, b64_part, mime_part,
                        headline, subtext, cta,
                        design.get("layout", "centered"),
                        design.get("text_color", "#FFFFFF"),
                        bool(design.get("add_overlay", True)),
                    )
                    images = [composited] + images[1:]
                except Exception as e:
                    logger.warning(f"Text composite failed: {e}")

            return GenImgResponse(images=images, model=model_used)

        except Exception as e:
            logger.error(f"genimg error: {e}")
            raise

    async def _analyze_reference_image(self, img_b64: str, mime_type: str, api_key: str) -> str:
        """
        Step 1 of img2img: vision pass to extract exact design spec from the reference.
        Returns a detailed text description of layout, typography, colors, logo position.
        """
        analysis_prompt = (
            "You are a senior art director analysing a brand design. "
            "Study this image and output a precise design specification covering:\n"
            "1. LAYOUT — composition, element positions, margins, grid structure\n"
            "2. TYPOGRAPHY — every text block: exact wording, font weight (bold/regular), "
            "   approximate size hierarchy (H1/H2/body), color, and position on the canvas\n"
            "3. COLORS — every color used as hex code or precise description\n"
            "4. LOGO — exact position (e.g. 'bottom-right corner'), size relative to canvas, "
            "   and visual description so it can be reproduced identically\n"
            "5. VISUAL ELEMENTS — photos, overlays, gradients, shapes, icons\n"
            "6. OVERALL STYLE — aesthetic, mood, brand feel\n\n"
            "Be extremely specific. This spec will be used to generate a new image with "
            "the same layout and design system but different content."
        )
        payload = {
            "contents": [{"parts": [
                {"text": analysis_prompt},
                {"inlineData": {"mimeType": mime_type, "data": img_b64}},
            ]}],
        }
        async with httpx.AsyncClient(timeout=30.0) as http:
            resp = await http.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key={api_key}",
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
        parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
        spec = next((p["text"] for p in parts if "text" in p), "")
        logger.info(f"Reference image design spec extracted ({len(spec)} chars)")
        return spec

    async def _genimg_with_reference(self, request: GenImgRequest) -> GenImgResponse:
        """
        Image-to-image via a two-step pipeline:
          1. Vision pass — gemini-3.5-flash reads the reference and outputs an exact design spec
          2. Generation pass — gemini-2.5-flash-image creates a new image from spec + user prompt
        This mirrors what Gemini web does internally and produces design composites with
        correct typography, logo placement, and brand colours.
        """
        api_key = os.getenv("APP_AI_KEY", "")
        if not api_key:
            raise ValueError("APP_AI_KEY not configured — add Google AI Studio key to backend/.env")

        # Resolve the reference image — accept single string or first item in a list
        image_ref = request.image
        if isinstance(image_ref, list):
            if not image_ref:
                raise InvalidImageInputError("image list is empty")
            image_ref = image_ref[0]

        # Parse the data URI or download from URL
        image_ref = (image_ref or "").strip()
        if image_ref.startswith(("http://", "https://")):
            async with httpx.AsyncClient(timeout=60.0) as http:
                r = await http.get(image_ref)
                r.raise_for_status()
                img_bytes = r.content
                ct = r.headers.get("content-type", "image/jpeg").split(";")[0].strip()
                mime_type = ct or "image/jpeg"
        elif image_ref.startswith("data:"):
            img_bytes, mime_type = self._parse_data_uri(image_ref)
        else:
            raise InvalidImageInputError("image must be a base64 data URI or HTTP URL")

        img_b64 = base64.b64encode(img_bytes).decode()

        # ── Step 1: vision pass — extract exact design spec from reference ──
        try:
            design_spec = await self._analyze_reference_image(img_b64, mime_type, api_key)
        except Exception as e:
            logger.warning(f"Reference image analysis failed, proceeding without spec: {e}")
            design_spec = ""

        # ── Step 2: build the Imagen 4 generation prompt from the spec ──
        base_user_prompt = request.prompt or "Create a new professional marketing image in the same visual style as the reference."

        if design_spec:
            generation_prompt = (
                f"{base_user_prompt}\n\n"
                f"=== DESIGN SPECIFICATION (extracted from reference image) ===\n"
                f"{design_spec}\n\n"
                f"=== CRITICAL RULES ===\n"
                f"- Reproduce the EXACT same layout structure described above\n"
                f"- Place the logo in the EXACT same position as specified\n"
                f"- Use the EXACT same typography hierarchy, positions, and colors\n"
                f"- Apply the EXACT same color palette\n"
                f"- Only change the scene/story/content — the design system stays identical\n"
                f"- Include ALL text elements clearly rendered inside the image\n"
                f"- High production quality, ready to publish immediately"
            )
        else:
            generation_prompt = base_user_prompt

        # Inject brand context so fallback pipeline applies brand DNA
        if request.brand_context:
            generation_prompt += (
                "\n\n=== BRAND GUIDELINES (these override all other style decisions) ===\n"
                + request.brand_context
                + "\n=== END BRAND GUIDELINES ==="
            )

        # ── Step 3: generate with Imagen 4 Ultra ──
        logger.info("Generating img2img output with Imagen 4 Ultra")
        try:
            images = await self._genimg_imagen4(
                prompt=generation_prompt,
                model="imagen-4.0-ultra-generate-001",
                aspect_ratio=request.size,
                n=1,
            )
            return GenImgResponse(images=images, model="imagen-4.0-ultra-generate-001")
        except Exception as e:
            logger.warning(f"Imagen 4 Ultra failed for img2img ({e}), falling back to gemini-2.5-flash-image")

        # Fallback: gemini-2.5-flash-image native API
        fallback_sys = "You are a senior creative director. Produce pixel-perfect marketing images with strong typography, correct logo placement, and brand colors. Render all text clearly inside the image."
        if request.brand_context:
            fallback_sys += (
                "\n\n=== BRAND GUIDELINES ===\n" + request.brand_context + "\n=== END BRAND GUIDELINES ==="
            )
        payload = {
            "system_instruction": {"parts": [{"text": fallback_sys}]},
            "contents": [{
                "parts": [
                    {"text": generation_prompt},
                    {"inlineData": {"mimeType": mime_type, "data": img_b64}},
                ]
            }],
            "generationConfig": {"responseModalities": ["IMAGE", "TEXT"]},
        }
        last_err: Exception = RuntimeError("Image generation failed")
        for attempt in range(3):
            try:
                async with httpx.AsyncClient(timeout=120.0) as http:
                    resp = await http.post(
                        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key={api_key}",
                        json=payload,
                    )
                    if resp.status_code in (429, 503):
                        if attempt < 2:
                            await asyncio.sleep(3 * (attempt + 1))
                            continue
                        raise RuntimeError(f"Overloaded (HTTP {resp.status_code})")
                    resp.raise_for_status()
                    data = resp.json()
                parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
                for part in parts:
                    if "inlineData" in part:
                        b64 = part["inlineData"]["data"]
                        mime = part["inlineData"].get("mimeType", "image/png")
                        return GenImgResponse(images=[f"data:{mime};base64,{b64}"], model="gemini-2.5-flash-image")
                raise RuntimeError("No image in Gemini response")
            except (InvalidImageInputError, ValueError):
                raise
            except Exception as e:
                last_err = e
                if attempt < 2:
                    await asyncio.sleep(3 * (attempt + 1))
        raise last_err

    @staticmethod
    def _safe_int(value: object, default: int) -> int:
        """Best-effort convert to int, fallback to default."""
        try:
            return int(value)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            return default

    @staticmethod
    def _extract_cdn_url(obj: object) -> Optional[str]:
        """
        Extract CDN URL from response object (supports multiple platform formats).
        Works for both video and audio responses.
        """
        # Try: obj.url
        url = getattr(obj, "url", None)
        if isinstance(url, str) and url.startswith(("http://", "https://")):
            return url

        # Try: obj.videos[0].url (video format)
        videos = getattr(obj, "videos", None)
        if videos and isinstance(videos, (list, tuple)) and len(videos) > 0:
            out_url = getattr(videos[0], "url", None)
            if isinstance(out_url, str) and out_url.startswith(("http://", "https://")):
                return out_url

        # Try: obj.video_url or obj.audio_url
        for attr in ("video_url", "audio_url"):
            attr_url = getattr(obj, attr, None)
            if isinstance(attr_url, str) and attr_url.startswith(("http://", "https://")):
                return attr_url

        # Try: obj.output.url
        output = getattr(obj, "output", None)
        if output:
            out_url = getattr(output, "url", None)
            if isinstance(out_url, str) and out_url.startswith(("http://", "https://")):
                return out_url

        # Try: obj.meta_data['url']
        meta_data = getattr(obj, "meta_data", None)
        if isinstance(meta_data, dict):
            meta_url = meta_data.get("url")
            if isinstance(meta_url, str) and meta_url.startswith(("http://", "https://")):
                return meta_url

        # Try parsing JSON body from HttpxBinaryResponseContent (proxy platform returns JSON instead of binary)
        try:
            data = json.loads(getattr(obj, "content", b""))
            logger.debug(f"Parsed response JSON body: {data}")
            for key in ("url", "video_url", "audio_url"):
                val = data.get(key)
                if isinstance(val, str) and val.startswith(("http://", "https://")):
                    return val
        except (json.JSONDecodeError, TypeError, AttributeError):
            pass

        return None

    async def genvideo(self, request: GenVideoRequest) -> GenVideoResponse:
        """
        Generate Video via fal.ai (wan-t2v / wan-i2v).
        Requires a funded FAL_KEY — top up at fal.ai/dashboard/billing.
        """
        fal_key = os.getenv("FAL_KEY", "")
        if not fal_key:
            raise ValueError("Video generation requires FAL_KEY — add it to backend/.env (get a key at fal.ai)")

        # fal.ai wan video endpoints
        model_endpoints = {
            "wan2.6-t2v": "fal-ai/wan/t2v/480p",
            "wan2.6-i2v": "fal-ai/wan/i2v/480p",
            "wan-t2v": "fal-ai/wan/t2v/480p",
            "wan-i2v": "fal-ai/wan/i2v/480p",
        }
        endpoint = model_endpoints.get(request.model, "fal-ai/wan/t2v/480p")

        payload: dict = {"prompt": request.prompt}
        if request.image:
            payload["image_url"] = request.image
        try:
            async with httpx.AsyncClient(timeout=300.0) as http:
                resp = await http.post(
                    f"https://fal.run/{endpoint}",
                    headers={"Authorization": f"Key {fal_key}", "Content-Type": "application/json"},
                    json=payload,
                )
                if resp.status_code in (401, 402, 403):
                    body = resp.text[:200]
                    raise ValueError(
                        f"fal.ai balance exhausted or key invalid (HTTP {resp.status_code}). "
                        f"Top up at fal.ai/dashboard/billing. Detail: {body}"
                    )
                resp.raise_for_status()
                data = resp.json()

            # fal.ai returns {video: {url: "..."}} or {video_url: "..."}
            video_url = (
                data.get("video", {}).get("url")
                or data.get("video_url")
                or next((v["url"] for v in data.get("videos", []) if v.get("url")), None)
            )
            if not video_url:
                raise RuntimeError(f"fal.ai returned no video URL. Response: {data}")

            duration = self._safe_int(request.seconds, default=4)
            logger.info(f"Video generated: {video_url}")
            return GenVideoResponse(url=video_url, model=request.model, duration=duration)

        except ValueError:
            raise
        except Exception as e:
            logger.error(f"genvideo error: {e}")
            raise

    @staticmethod
    def _get_voice(model: str, gender: str) -> str:
        """Get voice based on model and gender from mapping table."""
        voice = VOICE_MAP.get((model, gender))
        if voice:
            return voice
        return DEFAULT_VOICE.get(gender, "alloy")

    async def genaudio(self, request: GenAudioRequest) -> GenAudioResponse:
        """Generate Audio (TTS) via Gemini native TTS API → returns WAV data URI."""
        api_key = os.getenv("APP_AI_KEY", "")
        if not api_key:
            raise ValueError("APP_AI_KEY not configured — add Google AI Studio key to backend/.env")

        # Gemini voice mapping
        voice = {"female": "Zephyr", "male": "Puck"}.get(request.gender, "Zephyr")
        tts_model = "gemini-2.5-flash-preview-tts"

        logger.info(f"TTS started: model={tts_model}, gender={request.gender}, voice={voice}")

        payload = {
            "contents": [{"parts": [{"text": request.text}]}],
            "generationConfig": {
                "responseModalities": ["AUDIO"],
                "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}},
            },
        }
        try:
            async with httpx.AsyncClient(timeout=60.0) as http:
                resp = await http.post(
                    f"https://generativelanguage.googleapis.com/v1beta/models/{tts_model}:generateContent?key={api_key}",
                    json=payload,
                )
                resp.raise_for_status()
                data = resp.json()

            parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
            audio_b64, mime = None, "audio/L16;codec=pcm;rate=24000"
            for part in parts:
                if "inlineData" in part:
                    audio_b64 = part["inlineData"]["data"]
                    mime = part["inlineData"].get("mimeType", mime)
                    break

            if not audio_b64:
                raise RuntimeError("Gemini TTS returned no audio data")

            # Extract sample rate from mime type (e.g. "audio/L16;codec=pcm;rate=24000")
            sample_rate = 24000
            for segment in mime.split(";"):
                if segment.strip().startswith("rate="):
                    try:
                        sample_rate = int(segment.strip()[5:])
                    except ValueError:
                        pass

            pcm_bytes = base64.b64decode(audio_b64)
            wav_bytes = self._pcm_to_wav(pcm_bytes, sample_rate=sample_rate)
            audio_url = f"data:audio/wav;base64,{base64.b64encode(wav_bytes).decode()}"

            logger.info(f"TTS complete: {len(wav_bytes)} bytes WAV")
            return GenAudioResponse(url=audio_url, model=tts_model, gender=request.gender, voice=voice)

        except Exception as e:
            logger.error(f"genaudio error: {e}")
            raise

    async def transcribe(self, request: TranscribeAudioRequest) -> TranscribeAudioResponse:
        """Transcribe audio to text via Gemini native multimodal API."""
        api_key = os.getenv("APP_AI_KEY", "")
        if not api_key:
            raise ValueError("APP_AI_KEY not configured — add Google AI Studio key to backend/.env")

        source_name = self._get_source_name(request.audio, fallback="audio")
        logger.info(f"Transcription started: source={source_name}")

        try:
            audio_ref = (request.audio or "").strip()
            if audio_ref.startswith(("http://", "https://")):
                async with httpx.AsyncClient(timeout=120.0, follow_redirects=True) as http:
                    r = await http.get(audio_ref, headers={"User-Agent": "Mozilla/5.0 (compatible; CreativeRoom/1.0)"})
                    r.raise_for_status()
                    audio_bytes = r.content
                    ct = r.headers.get("content-type", "audio/mpeg").split(";")[0].strip()
                    mime_type = ct or "audio/mpeg"
            elif audio_ref.startswith("data:"):
                audio_bytes, ct = self._parse_data_uri(audio_ref)
                mime_type = ct.split(";")[0].strip() or "audio/mpeg"
            else:
                path = Path(audio_ref).expanduser()
                audio_bytes = path.read_bytes()
                ext = path.suffix.lower().lstrip(".")
                mime_type = {"mp3": "audio/mpeg", "wav": "audio/wav", "ogg": "audio/ogg",
                             "flac": "audio/flac", "m4a": "audio/mp4"}.get(ext, "audio/mpeg")

            payload = {
                "contents": [{
                    "parts": [
                        {"text": "Transcribe this audio to text. Return only the transcribed text with no additional commentary."},
                        {"inlineData": {"mimeType": mime_type, "data": base64.b64encode(audio_bytes).decode()}},
                    ]
                }]
            }

            for attempt in range(3):
                try:
                    async with httpx.AsyncClient(timeout=120.0) as http:
                        resp = await http.post(
                            f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}",
                            json=payload,
                        )
                        if resp.status_code in (429, 503):
                            if attempt < 2:
                                await asyncio.sleep(3 * (attempt + 1))
                                continue
                            raise ValueError(
                                f"Gemini audio transcription unavailable (HTTP {resp.status_code}) — "
                                "this is a free-tier quota limit. Retry in a moment or upgrade your Google AI Studio plan."
                            )
                        resp.raise_for_status()
                        data = resp.json()
                    break
                except httpx.HTTPStatusError as e:
                    if attempt < 2 and e.response.status_code in (429, 503):
                        await asyncio.sleep(3 * (attempt + 1))
                        continue
                    raise ValueError(
                        f"Gemini audio API unavailable (HTTP {e.response.status_code}). Retry in a moment."
                    ) from e

            parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
            text = next((p["text"].strip() for p in parts if "text" in p), "")
            if not text:
                raise RuntimeError("Gemini returned no transcription text")

            logger.info(f"Transcribed: {source_name}")
            return TranscribeAudioResponse(text=text, model="gemini-2.5-flash", source_name=source_name)

        except (ValueError, InvalidAudioInputError):
            raise
        except Exception as e:
            logger.error(f"transcribe error: {e}")
            raise

    @staticmethod
    def _to_inline(uri: str) -> dict | None:
        """Convert a base64 data URI to a Gemini inlineData part."""
        if not uri or not uri.startswith("data:"):
            return None
        try:
            mime_part = uri.split(";")[0][5:]
            b64_part = uri.split(",", 1)[1]
            return {"inlineData": {"mimeType": mime_part, "data": b64_part}}
        except Exception:
            return None

    async def _describe_product_via_vision(self, image_b64: str, api_key: str) -> str:
        """Use Gemini Vision to produce a precise text description of a product image.
        This description is then injected into Grok's text prompt as a reference.
        """
        inline = self._to_inline(image_b64)
        if not inline:
            return ""
        payload = {
            "contents": [{
                "parts": [
                    {
                        "text": (
                            "Describe this product in precise detail for use as a reference in AI image generation. "
                            "Focus on: exact shape and geometry, colors (include hex codes if visible), "
                            "logos and text/branding exactly as they appear, materials and textures, "
                            "distinctive design features. Be very specific and technical. "
                            "Output as ONE descriptive paragraph only — no introduction, no bullet points."
                        )
                    },
                    inline,
                ]
            }]
        }
        try:
            async with httpx.AsyncClient(timeout=20.0) as http:
                resp = await http.post(
                    f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}",
                    json=payload,
                )
                resp.raise_for_status()
                data = resp.json()
                parts = (data.get("candidates") or [{}])[0].get("content", {}).get("parts", [])
                return " ".join(p.get("text", "") for p in parts if "text" in p).strip()
        except Exception as e:
            logger.warning(f"Vision description failed: {e}")
            return ""

    async def genimg_grok(self, prompt: str, size: str = "square_hd", brand_context: str | None = None, product_images: list[str] | None = None) -> tuple[list[str], list[str]]:
        """Generate images via xAI Grok Imagine on fal.ai."""
        fal_key = os.getenv("FAL_KEY", "")
        if not fal_key:
            raise ValueError("FAL_KEY not configured in .env")

        # Grok accepts basic size hints
        size_map = {
            "1:1": "1024x1024", "square_hd": "1024x1024",
            "9:16": "768x1344", "16:9": "1344x768",
            "4:3": "1024x768", "3:4": "768x1024",
        }
        img_size = size_map.get(size, "1024x1024")

        # ── Vision Bridge: describe each product image via Gemini before sending to Grok ──
        descriptions: list[str] = []
        if product_images:
            gemini_key = os.getenv("APP_AI_KEY", "")
            if gemini_key:
                tasks = [
                    self._describe_product_via_vision(img, gemini_key)
                    for img in product_images[:4]  # max 4 products
                ]
                raw_descriptions = await asyncio.gather(*tasks)
                descriptions = [d for d in raw_descriptions if d]
                logger.info(f"Vision bridge: described {len(descriptions)} products for Grok")

        # Build final prompt with all context injected as text
        parts = [prompt]
        if descriptions:
            product_block = "\n".join(f"Product {i+1}: {d}" for i, d in enumerate(descriptions))
            parts.append(
                f"\n[EXACT PRODUCT REFERENCES — reproduce these faithfully in the image]\n{product_block}"
            )
        if brand_context:
            parts.append(f"\n[Brand context — apply to every visual decision]\n{brand_context}")
        full_prompt = "\n".join(parts)
        # Grok has a prompt length limit — truncate to 4000 chars to stay safe
        if len(full_prompt) > 4000:
            full_prompt = full_prompt[:4000]
        logger.info(f"Grok prompt length: {len(full_prompt)} chars")

        async with httpx.AsyncClient(timeout=120.0) as http:
            resp = await http.post(
                "https://fal.run/xai/grok-imagine-image",
                headers={"Authorization": f"Key {fal_key}", "Content-Type": "application/json"},
                json={"prompt": full_prompt},  # minimal payload — only prompt is required
            )
            if not resp.is_success:
                logger.error(f"Grok 422 body: {resp.text[:500]}")
            resp.raise_for_status()
            data = resp.json()
            images = [item["url"] for item in data.get("images", []) if item.get("url")]
            if not images:
                raise RuntimeError(f"Grok returned no images: {data}")
            return images, descriptions

    # ── LoRA Fine-tuning ──────────────────────────────────────────────────────────

    async def train_lora(self, images_base64: list[str], trigger_word: str, captions: list[str] | None = None) -> str:
        """Upload product images to fal.ai and start a LoRA training job.
        Returns the fal.ai request_id for polling.
        If captions are provided, a matching .txt file is written alongside each image.
        """
        fal_key = os.getenv("FAL_KEY", "")
        if not fal_key:
            raise ValueError("FAL_KEY not configured in .env")

        # Build an in-memory zip of all product images (and optional caption txt files)
        zip_buf = io.BytesIO()
        with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for idx, img in enumerate(images_base64):
                try:
                    raw_b64 = img.split(",", 1)[1] if "," in img else img
                    img_bytes = base64.b64decode(raw_b64)
                    ext = "jpg"
                    if img.startswith("data:image/png"):
                        ext = "png"
                    stem = f"image_{idx:03d}"
                    zf.writestr(f"{stem}.{ext}", img_bytes)
                    # Write companion caption file if provided
                    if captions and idx < len(captions) and captions[idx]:
                        zf.writestr(f"{stem}.txt", captions[idx].encode("utf-8"))
                except Exception as e:
                    logger.warning(f"Skipping image {idx}: {e}")
        zip_buf.seek(0)

        # Upload the zip to fal.ai storage (correct domain: fal.media)
        async with httpx.AsyncClient(timeout=120.0) as http:
            upload_resp = await http.post(
                "https://fal.media/files/upload",
                headers={
                    "Authorization": f"Key {fal_key}",
                    "Content-Type": "application/zip",
                },
                content=zip_buf.getvalue(),
            )
            upload_resp.raise_for_status()
            resp_json = upload_resp.json()
            # fal.ai returns { "access_url": "https://fal.media/..." }
            storage_url = resp_json.get("access_url") or resp_json.get("url") or ""
            if not storage_url:
                raise RuntimeError(f"fal.ai upload returned no URL: {resp_json}")
            logger.info(f"LoRA training images uploaded: {storage_url}")

        # Submit training job to the queue (returns immediately with request_id)
        async with httpx.AsyncClient(timeout=30.0) as http:
            train_resp = await http.post(
                "https://queue.fal.run/fal-ai/flux-lora-fast-training",
                headers={
                    "Authorization": f"Key {fal_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "images_data_url": storage_url,
                    "trigger_word": trigger_word,
                    "steps": 1000,
                    "is_style": False,
                    "create_masks": True,
                },
            )
            train_resp.raise_for_status()
            request_id = train_resp.json()["request_id"]
            logger.info(f"LoRA training job submitted: {request_id}")
            return request_id

    async def get_lora_status(self, request_id: str) -> dict:
        """Poll fal.ai for LoRA training status.
        Returns dict with keys: status, progress, lora_url (when done), error.
        """
        fal_key = os.getenv("FAL_KEY", "")
        if not fal_key:
            raise ValueError("FAL_KEY not configured in .env")

        async with httpx.AsyncClient(timeout=30.0) as http:
            status_resp = await http.get(
                f"https://queue.fal.run/fal-ai/flux-lora-fast-training/requests/{request_id}/status",
                headers={"Authorization": f"Key {fal_key}"},
            )
            status_resp.raise_for_status()
            data = status_resp.json()
            fal_status = data.get("status", "IN_QUEUE")

            if fal_status == "COMPLETED":
                result_resp = await http.get(
                    f"https://queue.fal.run/fal-ai/flux-lora-fast-training/requests/{request_id}",
                    headers={"Authorization": f"Key {fal_key}"},
                )
                result_resp.raise_for_status()
                result = result_resp.json()
                lora_url = (result.get("diffusers_lora_file") or {}).get("url", "")
                logger.info(f"LoRA training completed: {lora_url}")
                return {"status": "COMPLETED", "lora_url": lora_url, "progress": 100}

            if fal_status == "FAILED":
                err = str(data.get("error", "Training failed"))
                logger.error(f"LoRA training failed: {err}")
                return {"status": "FAILED", "lora_url": None, "progress": 0, "error": err}

            # Extract progress from logs if available
            logs = data.get("logs") or []
            progress = 0
            for log in reversed(logs):
                msg = (log.get("message") or "").lower()
                if "%" in msg:
                    try:
                        progress = int(msg.split("%")[0].split()[-1])
                        break
                    except Exception:
                        pass

            return {"status": fal_status, "lora_url": None, "progress": progress}

    async def genimg_flux_lora(self, prompt: str, lora_url: str, size: str = "square_hd") -> list[str]:
        """Generate images using a brand-specific trained LoRA on fal.ai Flux."""
        fal_key = os.getenv("FAL_KEY", "")
        if not fal_key:
            raise ValueError("FAL_KEY not configured in .env")

        size_map = {
            "1:1": "square_hd", "square_hd": "square_hd",
            "9:16": "portrait_4_3", "16:9": "landscape_4_3",
            "4:3": "landscape_4_3", "3:4": "portrait_4_3",
        }
        fal_size = size_map.get(size, "square_hd")

        async with httpx.AsyncClient(timeout=180.0) as http:
            resp = await http.post(
                "https://fal.run/fal-ai/flux-lora",
                headers={
                    "Authorization": f"Key {fal_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "prompt": prompt,
                    "negative_prompt": "black frame, dark frame, carbon black, glossy black, dark bike, wrong color",
                    "loras": [{"path": lora_url, "scale": 1.0}],
                    "image_size": fal_size,
                    "num_images": 1,
                    "output_format": "jpeg",
                    "safety_tolerance": "2",
                },
            )
            resp.raise_for_status()
            data = resp.json()
            images = [item["url"] for item in data.get("images", []) if item.get("url")]
            if not images:
                raise RuntimeError(f"Flux LoRA returned no images: {data}")
            return images
