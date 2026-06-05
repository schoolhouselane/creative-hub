import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { createClient } from '@metagptx/web-sdk';
import axios from 'axios';
import SidebarLayout from '@/components/Sidebar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Smartphone, Play, Paintbrush, Megaphone, Mail, Monitor,
  ChevronDown, LayoutGrid, List, Send, Loader2, ArrowLeft, ArrowRight,
  MessageSquare, Download, Bookmark, Sparkles, Trash2, ImagePlus, X, Copy, Check, Pencil,
  ThumbsUp, ThumbsDown,
} from 'lucide-react';
import { toast } from 'sonner';
import Markdown from 'markdown-to-jsx';
import ImageEditorModal from '@/components/ImageEditorModal';
import { type BrandProfile } from '@/lib/briefTypes';

const mgxClient = createClient();

// ─── Feedback types ─────────────────────────────────────────────────────────────

interface FeedbackItem {
  id: string;
  image_url: string;
  prompt: string;
  ai_tool: string;
  type: 'approved' | 'rejected';
  reason?: string;
  timestamp: string;
  brand_id: number;
}

async function compressImageForFeedback(url: string): Promise<string> {
  if (!url.startsWith('data:')) return url; // already a CDN URL, use as-is
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 600 / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.80));
    };
    img.onerror = () => resolve(url);
    img.src = url;
  });
}

function getErrorMessage(err: unknown): string {
  if (err && typeof err === 'object') {
    // Axios error — extract backend detail first
    const axiosDetail =
      (err as { response?: { data?: { detail?: unknown } } }).response?.data?.detail;
    if (typeof axiosDetail === 'string' && axiosDetail.trim()) {
      // Strip internal stack traces / raw Python exceptions the user doesn't need
      const clean = axiosDetail.split('\n')[0].trim();
      return friendlyMessage(clean);
    }
  }
  const raw = err instanceof Error ? err.message : String(err);
  return friendlyMessage(raw);
}

function friendlyMessage(raw: string): string {
  const r = raw.toLowerCase();
  if (r.includes('503') || r.includes('overloaded') || r.includes('quota') || r.includes('rate limit'))
    return 'The AI is busy right now — please try again in a moment.';
  if (r.includes('500') || r.includes('internal server'))
    return 'Something went wrong on our end. Please try again.';
  if (r.includes('network') || r.includes('econnrefused') || r.includes('fetch'))
    return 'Connection error — check your internet and try again.';
  if (r.includes('balance') || r.includes('exhausted') || r.includes('billing'))
    return 'Image generation is temporarily unavailable. Please try again later.';
  if (r.includes('no image') || r.includes('returned no image'))
    return 'No image was generated — try rephrasing your prompt.';
  if (r.includes('too large') || r.includes('413'))
    return 'The uploaded file is too large. Please use a smaller image.';
  if (r.includes('pdf'))
    return 'Could not read the PDF. Make sure it contains text, not just images.';
  // If the message is already short and readable, use it; otherwise show a generic message
  if (raw.length < 120 && !raw.includes('Traceback') && !raw.includes('Exception'))
    return raw;
  return 'Something went wrong — please try again.';
}

// ─── Constants ─────────────────────────────────────────────────────────────────

interface ContentType {
  id: string;
  icon: React.ElementType;
  title: string;
  sub: string;
}

const CONTENT_TYPES: ContentType[] = [
  { id: 'social', icon: Smartphone, title: 'Social Media', sub: 'Posts, stories, reels, carousels' },
  { id: 'video', icon: Play, title: 'Video Content', sub: 'Intros, ads, explainers, avatars' },
  { id: 'brand', icon: Paintbrush, title: 'Brand Design', sub: 'Logos, brand assets, visual identity' },
  { id: 'ads', icon: Megaphone, title: 'Digital Ads', sub: 'Banners, ads, email graphics' },
  { id: 'email', icon: Mail, title: 'Email Campaign', sub: 'Email templates and visuals' },
  { id: 'web', icon: Monitor, title: 'Website / App', sub: 'UI mockups, hero images, icons' },
];

const AI_OPTIONS = ['Gemini Pro', 'Flux Pro', 'Grok Image', 'Claude AI', 'DALL-E 3', 'Midjourney', 'HeyGen'];

const AI_MODELS: Record<string, string> = {
  'Claude AI': 'gemini-3.5-flash',
  'Flux Pro': 'flux-pro',
  'Midjourney': 'midjourney',
  'DALL-E 3': 'openai/dall-e-3',
  'Gemini Pro': 'gemini-3.5-flash',
  'HeyGen': 'heygen',
  'Grok Image': 'xai/grok-imagine-image',
};

// Which AI tools use Flux (fal.ai) for image generation
const FLUX_AIS = new Set(['Flux Pro']);
const GROK_AIS = new Set(['Grok Image']);

const IMAGE_VIDEO_AIS = new Set(['Flux Pro', 'Midjourney', 'DALL-E 3', 'HeyGen']);

const SUGGESTIONS: Record<string, string[]> = {
  social: [
    'Write 5 Instagram captions for our new product launch',
    'Create a LinkedIn post about our brand values',
    'Draft a Twitter thread about industry trends',
  ],
  video: [
    'Write a 30-second video script for a brand awareness ad',
    'Create a storyboard outline for a product explainer video',
  ],
  brand: [
    'Describe our brand visual identity in detail',
    'Write brand guidelines for logo usage',
  ],
  ads: [
    'Write 3 variations of a Facebook ad headline',
    'Create Google ad copy for our main service',
  ],
  email: [
    'Write a welcome email for new subscribers',
    'Draft a promotional email for our seasonal campaign',
  ],
  web: [
    'Write hero section copy for our homepage',
    'Create a product description for our main offering',
  ],
};

// ─── Prompt enrichment ──────────────────────────────────────────────────────────

const CONTENT_FORMAT_HINTS: Record<string, string> = {
  social: 'Format: square or portrait social media post (1:1 or 4:5). Brand logo placed bottom-right corner with consistent padding — legible but never dominant. Large bold headline, supporting subtitle. Brand colours throughout. Clean professional layout. No generic stock-photo feel.',
  ads:    'Format: digital advertisement banner. Strong headline, CTA text, brand colours. Logo bottom-left with clear space. High visual impact. Never generic.',
  brand:  'Format: brand marketing asset. Logo prominently placed with full clear-space compliance. Brand colours and typography applied throughout. Visual identity must be immediately recognisable.',
  email:  'Format: email marketing graphic. Headline text, brand colours, clean modern layout. Logo top-left or bottom-left. Suitable for email headers.',
  web:    'Format: website hero image or banner. Large headline, brand colours, striking full-width composition. Logo top-left or embedded in nav area.',
  video:  'Format: video thumbnail or still frame. Bold text title, brand colours, high-contrast compelling visual. Logo bottom-right.',
};

function buildBrandBrief(brand: BrandProfile): string {
  let dna: Record<string, unknown> = {};
  try { dna = JSON.parse((brand as Record<string, unknown>).brand_dna as string ?? '{}'); } catch { /* no dna */ }

  const lines: string[] = [];
  if (brand.brand_name) lines.push(`Brand name: ${brand.brand_name}`);
  if (brand.industry)   lines.push(`Industry: ${brand.industry}`);

  // Serialize every DNA field into the brief
  const label: Record<string, string> = {
    tagline: 'Tagline',
    mission: 'Mission',
    vision: 'Vision',
    usp: 'Unique selling proposition',
    brand_values: 'Brand values',
    brand_personality: 'Brand personality',
    target_audience: 'Target audience',
    tone_of_voice: 'Tone of voice',
    primary_color: 'Primary color',
    secondary_color: 'Secondary color',
    accent_color: 'Accent color',
    color_palette: 'Color palette',
    font_heading: 'Headline font',
    font_body: 'Body font',
    typography: 'Typography',
    visual_style: 'Visual style',
    photography_style: 'Photography style',
    logo_description: 'Logo',
    logo_usage: 'Logo usage rules',
    do_not: 'Brand don\'ts',
    imagery_style: 'Imagery style',
    graphic_elements: 'Graphic elements',
  };

  for (const [key, lbl] of Object.entries(label)) {
    const val = dna[key] ?? (brand as Record<string, unknown>)[key];
    if (!val) continue;
    if (Array.isArray(val) && val.length) lines.push(`${lbl}: ${val.join(', ')}`);
    else if (typeof val === 'string' && val.trim()) lines.push(`${lbl}: ${val.trim()}`);
  }

  // Include any remaining string/array fields not already covered
  for (const [k, v] of Object.entries(dna)) {
    if (Object.keys(label).includes(k)) continue;
    if (Array.isArray(v) && v.length) lines.push(`${k}: ${v.join(', ')}`);
    else if (typeof v === 'string' && v.trim()) lines.push(`${k}: ${v.trim()}`);
  }

  return lines.join('\n');
}

function buildEnrichedImagePrompt(userPrompt: string, brand: BrandProfile, contentType: string): string {
  let dna: Record<string, unknown> = {};
  try { dna = JSON.parse((brand as Record<string, unknown>).brand_dna as string ?? '{}'); } catch { /* no dna */ }

  const s = (key: string): string | null => {
    const v = dna[key] ?? (brand as Record<string, unknown>)[key];
    return typeof v === 'string' && v.trim() ? v.trim() : null;
  };
  const a = (key: string): string[] => Array.isArray(dna[key]) ? (dna[key] as string[]) : [];

  const sections: string[] = [];

  // ── User instruction (always first) ─────────────────────────────────────────
  sections.push(userPrompt);

  // ── Brand identity ───────────────────────────────────────────────────────────
  const id: string[] = [];
  if (brand.brand_name)     id.push(`Brand: ${brand.brand_name}`);
  if (s('tagline'))          id.push(`Tagline: "${s('tagline')}"`);
  if (s('industry'))         id.push(`Industry: ${s('industry')}`);
  const story = s('brand_story') || s('mission') || s('vision');
  if (story)                 id.push(`Brand story: ${story}`);
  const products = s('brand_products') || s('product') || s('usp');
  if (products)              id.push(`Products/USP: ${products}`);
  const personality = a('brand_personality');
  if (personality.length)    id.push(`Personality: ${personality.join(', ')}`);
  const values = a('brand_values');
  if (values.length)         id.push(`Values: ${values.join(', ')}`);
  if (s('target_audience'))  id.push(`Audience: ${s('target_audience')}`);
  const tone = s('tone_of_voice') || brand.tone_of_voice;
  if (tone)                  id.push(`Tone: ${tone}`);
  if (id.length > 1) sections.push('\n[BRAND IDENTITY]\n' + id.join('\n'));

  // ── Visual & photography direction ───────────────────────────────────────────
  const vis: string[] = [];
  if (s('visual_style'))       vis.push(`Visual style: ${s('visual_style')}`);
  if (s('photography_style'))  vis.push(`Photography style: ${s('photography_style')}`);
  // Pull verbatim photography prompts if the extraction captured them
  const photPrompts = a('photography_prompts');
  if (photPrompts.length) vis.push(`Reference prompts from brand guidelines:\n${photPrompts.slice(0, 2).join('\n---\n')}`);
  if (vis.length) sections.push('\n[VISUAL DIRECTION]\n' + vis.join('\n'));

  // ── Colour palette ───────────────────────────────────────────────────────────
  const cols: string[] = [];
  if (brand.primary_color)    cols.push(`Primary: ${brand.primary_color}`);
  if (brand.secondary_color)  cols.push(`Secondary: ${brand.secondary_color}`);
  if (brand.accent_color)     cols.push(`Accent: ${brand.accent_color}`);
  const palette = dna.color_palette;
  if (Array.isArray(palette) && palette.length) cols.push(`Full palette: ${(palette as string[]).join(', ')}`);
  if (cols.length) sections.push('\n[COLOUR PALETTE — apply these exact hex values]\n' + cols.join('\n'));

  // ── Typography ───────────────────────────────────────────────────────────────
  const typo: string[] = [];
  const fh = brand.font_heading || s('font_heading');
  const fb = brand.font_body    || s('font_body');
  if (fh) typo.push(`Heading font: ${fh}`);
  if (fb) typo.push(`Body font: ${fb}`);
  if (s('typography_notes')) typo.push(s('typography_notes')!);
  if (typo.length) sections.push('\n[TYPOGRAPHY]\n' + typo.join('\n'));

  // ── Clean background — text/logo added via the editor ───────────────────────
  sections.push('\n[CRITICAL — READ CAREFULLY]\nDo NOT render any text, headlines, captions, logos, watermarks, or graphic overlays inside the image. Generate a clean photographic or illustrative background scene only. Typography and logo are applied separately in post-production.');

  // ── Brand rules ──────────────────────────────────────────────────────────────
  const rules: string[] = [];
  const dos   = a('do_say').concat(Array.isArray((dna.design_rules as Record<string,unknown>)?.dos) ? (dna.design_rules as Record<string,unknown>).dos as string[] : []);
  const donts = a('dont_say').concat(Array.isArray((dna.design_rules as Record<string,unknown>)?.donts) ? (dna.design_rules as Record<string,unknown>).donts as string[] : []);
  if (dos.length)           rules.push(`DO: ${dos.slice(0, 5).join(' | ')}`);
  if (donts.length)         rules.push(`DO NOT: ${donts.slice(0, 5).join(' | ')}`);
  if (s('social_tone'))     rules.push(`Social tone: ${s('social_tone')}`);
  if (rules.length) sections.push('\n[BRAND RULES]\n' + rules.join('\n'));

  // ── Guidelines notes (richest context — sliced to avoid token waste) ─────────
  const notes = brand.guidelines_notes || s('extra_notes');
  if (notes && notes.trim().length > 20) {
    sections.push(`\n[ADDITIONAL BRAND CONTEXT]\n${notes.slice(0, 1800)}`);
  }

  // ── Format + quality ─────────────────────────────────────────────────────────
  const formatHint = CONTENT_FORMAT_HINTS[contentType] ?? CONTENT_FORMAT_HINTS.social;
  sections.push('\n[FORMAT REQUIREMENTS]\n' + formatHint);
  sections.push('QUALITY MANDATE: Photorealistic, ultra-high production quality. Strong composition, dramatic lighting, cinematic feel aligned with brand DNA above. No text. No logo. No overlays. Clean scene only — ' + brand.brand_name + ' brand aesthetic.');

  return sections.join('\n');
}

// ─── Types ──────────────────────────────────────────────────────────────────────

interface ChatState {
  brand: BrandProfile;
  type: string;
  typeLabel: string;
  ai: string;
  modelId: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;       // AI-generated image (assistant bubble)
  attachedImage?: string;  // User-uploaded image (user bubble, base64 data URI)
  saved?: boolean;         // Whether this image has been saved to gallery
}

type ExtendedProfile = BrandProfile & { created_at?: string };

// ─── Knowledge Base (localStorage, last 5 chats) ────────────────────────────────

const KB_KEY = 'shl_kb_chats';

interface SavedChat {
  id: string;
  brandName: string;
  typeLabel: string;
  ai: string;
  preview: string;       // first user message truncated
  imageCount: number;
  messages: Message[];
  chatState: ChatState;
  savedAt: string;
}

function kbLoad(): SavedChat[] {
  try { return JSON.parse(localStorage.getItem(KB_KEY) || '[]'); } catch { return []; }
}

function kbSave(state: ChatState, msgs: Message[]): void {
  if (msgs.length === 0) return;
  try {
    const prev = kbLoad();
    const first = msgs.find(m => m.role === 'user')?.content ?? 'Chat session';
    // Strip all base64 blobs — keep only HTTP URLs to stay within localStorage limits
    const clean = msgs.map(({ attachedImage: _a, ...m }) => ({
      ...m,
      imageUrl: m.imageUrl?.startsWith('data:') ? undefined : m.imageUrl,
    }));
    const entry: SavedChat = {
      id: Date.now().toString(),
      brandName: state.brand.brand_name,
      typeLabel: state.typeLabel,
      ai: state.ai,
      preview: first.slice(0, 100),
      imageCount: msgs.filter(m => m.imageUrl).length,
      messages: clean,
      chatState: state,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(KB_KEY, JSON.stringify([entry, ...prev].slice(0, 5)));
  } catch {
    // localStorage quota exceeded — skip saving sidebar history
  }
}

function kbRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(dateStr?: string) {
  if (!dateStr) return '13.05.2026';
  try {
    const d = new Date(dateStr);
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
  } catch {
    return '13.05.2026';
  }
}

function getLoraInfo(brand: BrandProfile): { loraUrl: string; triggerWord: string } | null {
  try {
    const dna = JSON.parse((brand as any).brand_dna ?? '{}');
    if (dna.lora_status === 'COMPLETED' && dna.lora_url) {
      return { loraUrl: dna.lora_url as string, triggerWord: (dna.lora_trigger_word as string) || '' };
    }
  } catch { /**/ }
  return null;
}

function buildSystemPrompt(brand: BrandProfile, type: string, _ai: string): string {
  let dna: Record<string, unknown> | null = null;
  if (brand.brand_dna) {
    try { dna = JSON.parse(brand.brand_dna); } catch { dna = null; }
  }

  const s = (key: string): string | null => {
    if (!dna) return null;
    const v = dna[key];
    return typeof v === 'string' && v.trim() ? v.trim() : null;
  };
  const a = (key: string): string[] => dna && Array.isArray(dna[key]) ? (dna[key] as string[]) : [];

  const lines: string[] = [
    `You are a senior creative director and brand strategist for ${brand.brand_name}.`,
    `Your entire purpose is to produce ${type} content that is unmistakably ${brand.brand_name} — never generic, never off-brand.`,
    `You know this brand inside out. Every image prompt, caption, or creative decision must be rooted in the brand DNA below.`,
    ``,
    `=== ${brand.brand_name.toUpperCase()} BRAND DNA ===`,
  ];

  // Identity
  if (s('tagline'))       lines.push(`Tagline: "${s('tagline')}"`);
  if (s('industry'))      lines.push(`Industry: ${s('industry')}`);
  const story = s('brand_story') || s('mission');
  if (story)              lines.push(`Brand story: ${story}`);
  const products = s('brand_products') || s('product') || s('usp');
  if (products)           lines.push(`Products: ${products}`);
  const personality = a('brand_personality');
  if (personality.length) lines.push(`Personality: ${personality.join(', ')}`);
  const values = a('brand_values');
  if (values.length)      lines.push(`Values: ${values.join(', ')}`);
  const audience = s('target_audience');
  if (audience)           lines.push(`Target audience: ${audience}`);
  const tone = s('tone_of_voice') ?? brand.tone_of_voice;
  if (tone)               lines.push(`Tone of voice: ${tone}`);

  // Visual
  if (brand.primary_color)   lines.push(`Primary colour: ${brand.primary_color}`);
  if (brand.secondary_color) lines.push(`Secondary colour: ${brand.secondary_color}`);
  if (brand.accent_color)    lines.push(`Accent colour: ${brand.accent_color}`);
  const palette = dna?.color_palette;
  if (Array.isArray(palette) && palette.length) lines.push(`Full palette: ${(palette as string[]).join(', ')}`);
  const fh = brand.font_heading || s('font_heading');
  const fb = brand.font_body    || s('font_body');
  if (fh) lines.push(`Heading font: ${fh}`);
  if (fb) lines.push(`Body font: ${fb}`);
  if (s('visual_style'))       lines.push(`Visual style: ${s('visual_style')}`);
  if (s('photography_style'))  lines.push(`Photography: ${s('photography_style')}`);
  if (s('logo_usage'))         lines.push(`Logo rules: ${s('logo_usage')}`);
  if (s('logo_placement'))     lines.push(`Logo placement: ${s('logo_placement')}`);

  // Rules
  const dos   = a('do_say');
  const donts = a('dont_say');
  if (dos.length)   lines.push(`Brand DOs: ${dos.slice(0, 4).join(' | ')}`);
  if (donts.length) lines.push(`Brand DON'Ts: ${donts.slice(0, 4).join(' | ')}`);

  // Guidelines notes
  const notes = brand.guidelines_notes || s('extra_notes');
  if (notes && notes.trim().length > 20) lines.push(`\nAdditional guidelines:\n${notes.slice(0, 1200)}`);

  lines.push(`\n=== END BRAND DNA ===`);
  lines.push(`\nFor every image you help create: cyclists/bikes shown are always Shelby e-bikes unless stated otherwise. Logo placement bottom-right on social posts. Use the exact brand colours and photography style from the DNA above. Always produce production-ready, photorealistic, immediately publishable work.`);

  return lines.join('\n');
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function BrandRowSkeleton() {
  return (
    <div className="bg-white rounded-xl p-5 flex items-center gap-5 animate-pulse">
      <div className="w-[114px] h-[67px] rounded-lg bg-gray-100 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-gray-100 rounded w-40" />
        <div className="h-3 bg-gray-100 rounded w-24" />
      </div>
      <div className="h-9 w-32 bg-gray-100 rounded-lg" />
    </div>
  );
}

// ─── Open New Chat Modal ────────────────────────────────────────────────────────

function OpenChatModal({
  open,
  brand,
  onClose,
  onConfirm,
}: {
  open: boolean;
  brand: ExtendedProfile | null;
  onClose: () => void;
  onConfirm: (chatState: ChatState) => void;
}) {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedAi, setSelectedAi] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSelectedType(null);
      setSelectedAi(null);
    }
  }, [open]);

  const canConfirm = selectedType !== null && selectedAi !== null;

  const handleConfirm = () => {
    if (!brand || !selectedType || !selectedAi) return;
    const typeEntry = CONTENT_TYPES.find((t) => t.id === selectedType);
    onConfirm({
      brand,
      type: selectedType,
      typeLabel: typeEntry?.title ?? selectedType,
      ai: selectedAi,
      modelId: AI_MODELS[selectedAi] ?? selectedAi,
    });
  };

  if (!brand) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        className="max-w-4xl border-0 p-0 shadow-2xl"
        style={{ backgroundColor: '#1e1e20' }}
      >
        <div className="p-8">
          <DialogHeader className="mb-2">
            <DialogTitle className="font-light text-[18px] text-white">
              Open New Chat
            </DialogTitle>
          </DialogHeader>

          {/* Select Type */}
          <p className="font-bold text-[16px] text-white mb-3 mt-4">Select Type</p>
          <div className="grid grid-cols-2 gap-3">
            {CONTENT_TYPES.map((ct) => {
              const Icon = ct.icon;
              const active = selectedType === ct.id;
              return (
                <button
                  key={ct.id}
                  onClick={() => setSelectedType(ct.id)}
                  className={`flex items-center gap-4 p-5 rounded-[16px] cursor-pointer transition-all text-left ${
                    active
                      ? 'bg-[#383839] text-white'
                      : 'bg-white/5 border border-white/10 text-white hover:bg-white/10'
                  }`}
                >
                  <Icon className="h-5 w-5 flex-shrink-0 opacity-80" />
                  <div className="min-w-0">
                    <p className="font-semibold text-[14px] leading-tight">{ct.title}</p>
                    <p className="text-[12px] text-white/50 mt-0.5 leading-tight">{ct.sub}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Select AI */}
          <p className="font-bold text-[16px] text-white mb-3 mt-6">Select AI</p>
          <div className="grid grid-cols-2 gap-3">
            {AI_OPTIONS.map((ai) => {
              const active = selectedAi === ai;
              return (
                <button
                  key={ai}
                  onClick={() => setSelectedAi(ai)}
                  className={`flex items-center px-5 py-4 rounded-xl cursor-pointer transition-all text-left ${
                    active
                      ? 'bg-[#383839]'
                      : 'bg-white/5 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  <span className="font-bold text-[15px] text-white">{ai}</span>
                </button>
              );
            })}
          </div>

          {/* Confirm */}
          <div className="mt-8 flex justify-end">
            <button
              onClick={handleConfirm}
              disabled={!canConfirm}
              className={`bg-white text-[#1e1e20] font-bold text-[14px] px-6 py-3 rounded-full transition-opacity ${
                canConfirm ? 'opacity-100 cursor-pointer hover:opacity-90' : 'opacity-30 cursor-not-allowed'
              }`}
            >
              Create Chat
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Brand List View ────────────────────────────────────────────────────────────

function BrandListView({ onOpenChat }: { onOpenChat: (brand: ExtendedProfile) => void }) {
  const [brands, setBrands] = useState<ExtendedProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const res = await mgxClient.entities.brand_profiles.query({ query: {}, limit: 50 });
        setBrands((res?.data?.items as ExtendedProfile[]) || []);
      } catch {
        setBrands([]);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  return (
    <div className="min-h-full bg-[#f5f3ef] px-8 py-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-bold text-[48px] text-[#1e1e20] leading-tight">AI Workspace</h1>
          <p className="text-[16px] text-[#595959] mt-2">
            Chat directly with AI tools using brand-aware context.
          </p>
        </div>
        <div className="flex items-center gap-3 mt-2">
          <button className="border border-[#e2e2e2] rounded-lg px-3 py-2 flex items-center gap-2 text-[14px] font-medium text-[#1e1e20] bg-white hover:bg-gray-50 transition-colors">
            Last Added
            <ChevronDown className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1 border border-[#e2e2e2] rounded-lg p-1 bg-white">
            <button className="bg-[#f5f3ef] rounded p-1.5 text-[#1e1e20]">
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button className="rounded p-1.5 text-[#595959] hover:text-[#1e1e20] transition-colors">
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Brand List */}
      <div className="space-y-3 mt-6">
        {loading ? (
          <>
            <BrandRowSkeleton />
            <BrandRowSkeleton />
            <BrandRowSkeleton />
          </>
        ) : brands.length === 0 ? (
          <div className="bg-white rounded-xl p-10 text-center">
            <MessageSquare className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-[16px] font-semibold text-[#1e1e20]">No brand profiles yet</p>
            <p className="text-[14px] text-[#595959] mt-1">
              Add one in Brand Management to start chatting.
            </p>
          </div>
        ) : (
          brands.map((brand) => (
            <BrandRow key={brand.id} brand={brand} onOpenChat={onOpenChat} />
          ))
        )}
      </div>
    </div>
  );
}

function BrandRow({
  brand,
  onOpenChat,
}: {
  brand: ExtendedProfile;
  onOpenChat: (brand: ExtendedProfile) => void;
}) {
  const thumbnailBg = brand.primary_color && brand.secondary_color
    ? `linear-gradient(135deg, ${brand.primary_color}, ${brand.secondary_color})`
    : brand.primary_color
    ? brand.primary_color
    : 'linear-gradient(135deg, #7c3aed, #06b6d4)';

  return (
    <div className="bg-white rounded-xl p-5 flex items-center gap-5">
      <div
        className="w-[114px] h-[67px] rounded-lg flex-shrink-0 relative flex items-center justify-center overflow-hidden"
        style={{ background: thumbnailBg }}
      >
        {brand.logo_url && (
          <img
            src={brand.logo_url}
            alt={brand.brand_name}
            className="max-h-[48px] max-w-[96px] object-contain drop-shadow"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-[18px] text-[#1e1e20] leading-tight truncate">
          {brand.brand_name}
        </p>
        <div className="flex items-center gap-4 mt-1">
          <span className="text-[12px] text-[#595959]">Brand DNA</span>
          <span className="text-[12px] text-[#595959]">
            Added {formatDate(brand.created_at)}
          </span>
        </div>
      </div>
      <button
        onClick={() => onOpenChat(brand)}
        className="bg-[#1e1e20] text-white text-[14px] font-medium px-4 py-2 rounded-lg hover:bg-[#2d2d30] transition-colors flex-shrink-0"
      >
        Open New Chat
      </button>
    </div>
  );
}

// ─── Brand brief summary (shown at top of each chat) ───────────────────────────

function BrandBriefCard({ brand }: { brand: BrandProfile }) {
  let dna: Record<string, unknown> = {};
  try { dna = JSON.parse((brand as Record<string, unknown>).brand_dna as string ?? '{}'); } catch { /* no dna */ }

  const items: { label: string; value: string }[] = [];
  const push = (lbl: string, key: string) => {
    const v = dna[key] ?? (brand as Record<string, unknown>)[key];
    if (!v) return;
    const str = Array.isArray(v) ? v.join(', ') : String(v);
    if (str.trim()) items.push({ label: lbl, value: str.trim() });
  };

  push('Tone', 'tone_of_voice');
  push('Visual style', 'visual_style');
  push('Photography', 'photography_style');
  push('Personality', 'brand_personality');
  push('Primary color', 'primary_color');
  push('Secondary color', 'secondary_color');
  push('Headline font', 'font_heading');
  push('Target audience', 'target_audience');
  push('Tagline', 'tagline');

  if (!brand.brand_name && items.length === 0) return null;

  return (
    <div className="mx-auto max-w-2xl w-full mb-2">
      <div className="rounded-xl border border-[#e2e2e2] bg-[#fafaf9] px-5 py-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          <span className="text-[12px] font-semibold text-[#1e1e20]">
            {brand.brand_name} brand guidelines loaded
          </span>
          <span className="text-[11px] text-[#595959] ml-auto">auto-applied to every generation</span>
        </div>
        {items.length > 0 && (
          <div className="flex flex-wrap gap-x-5 gap-y-1.5">
            {items.map(({ label, value }) => (
              <div key={label} className="flex items-baseline gap-1.5">
                <span className="text-[11px] text-[#959595] shrink-0">{label}:</span>
                <span className="text-[11px] text-[#1e1e20] font-medium line-clamp-1 max-w-[180px]">{value}</span>
              </div>
            ))}
          </div>
        )}
        {items.length === 0 && (
          <p className="text-[12px] text-[#595959]">
            No detailed brand DNA found — add more info to the brand profile for better results.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Chat Interface ─────────────────────────────────────────────────────────────

function ChatView({
  chatState,
  onReset,
  initialMessages,
  onResumeChat,
}: {
  chatState: ChatState;
  onReset: () => void;
  initialMessages?: Message[];
  onResumeChat: (saved: SavedChat) => void;
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages ?? []);
  const [input, setInput] = useState('');
  const [generating, setGenerating] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, boolean>>({});
  const [enhancing, setEnhancing] = useState(false);
  const [enhancedPrompt, setEnhancedPrompt] = useState('');
  const [showEnhanced, setShowEnhanced] = useState(false);
  const [copiedEnhanced, setCopiedEnhanced] = useState(false);
  const [imageAttachment, setImageAttachment] = useState<string | null>(null);
  const [detectedAspectRatio, setDetectedAspectRatio] = useState<string>('1:1');
  // Pinned reference: the original uploaded template — re-sent every turn so Gemini
  // never drifts from the real brand asset (prevents logo/typography mutation).
  const [pinnedReference, setPinnedReference] = useState<string | null>(null);
  const [pinnedAspectRatio, setPinnedAspectRatio] = useState<string>('1:1');
  const [pinnedProducts, setPinnedProducts] = useState<{ name: string; url: string }[]>([]);
  const [layoutReference, setLayoutReference] = useState<string | null>(null);
  const [outputMode, setOutputMode] = useState<'image' | 'text'>('image');
  const [editingImageUrl, setEditingImageUrl] = useState<string | null>(null);
  const [aiEditingPrompt, setAiEditingPrompt] = useState<string>('');  // label shown when AI editing
  const [savedChats, setSavedChats] = useState<SavedChat[]>(() => kbLoad());
  const [kbOpen, setKbOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const systemPrompt = buildSystemPrompt(chatState.brand, chatState.typeLabel, chatState.ai);
  const suggestions = SUGGESTIONS[chatState.type] ?? [];
  const typeEntry = CONTENT_TYPES.find((t) => t.id === chatState.type);
  const TypeIcon = typeEntry?.icon ?? MessageSquare;

  // Load persistent chat history for this brand on mount
  useEffect(() => {
    if (!chatState.brand.id) return;
    // Skip loading persisted history when resuming from gallery — initialMessages already set
    if (initialMessages && initialMessages.length > 0) return;
    axios.get(`/api/v1/entities/brand_profiles/${chatState.brand.id}/chat`)
      .then((res) => {
        const loaded: Message[] = (res.data?.messages ?? []).map((m: Record<string, unknown>) => ({
          role: m.role as string,
          content: m.content as string,
          imageUrl: (m.image_url as string) ?? undefined,
          saved: (m.saved as boolean) ?? false,
        }));
        if (loaded.length > 0) setMessages(loaded);
      })
      .catch(() => {/* no history yet — start fresh */});
  }, [chatState.brand.id]);

  // Persist chat history to DB after every message exchange
  const persistHistory = useCallback((msgs: Message[]) => {
    if (!chatState.brand.id) return;
    axios.post(`/api/v1/entities/brand_profiles/${chatState.brand.id}/chat`, {
      messages: msgs.map((m) => ({
        role: m.role,
        content: m.content,
        image_url: m.imageUrl ?? null,
        saved: m.saved ?? false,
      })),
    }).catch(() => {/* silently fail — local state is still correct */});
  }, [chatState.brand.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const adjustTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const saveToGallery = async (imageUrl: string, prompt: string, msgIndex: number) => {
    try {
      // Strip attachedImage (large base64 blobs) from history before storing
      const sanitisedHistory = messages.map(({ attachedImage: _drop, ...m }) => m);
      await axios.post('/api/v1/entities/assets', {
        user_id: '1219947',
        brand_id: chatState.brand.id ?? null,
        brand_name: chatState.brand.brand_name,
        title: prompt.slice(0, 80),
        asset_type: 'image',
        content_type: chatState.type,
        ai_tool: chatState.ai,
        url: imageUrl,
        prompt,
        chat_history: JSON.stringify(sanitisedHistory),
      });
      // Mark the message as saved so the button flips to filled state
      setMessages((prev) =>
        prev.map((m, idx) => (idx === msgIndex ? { ...m, saved: true } : m))
      );
      toast.success('Saved to gallery!');
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleFeedback = async (msg: Message, _msgIdx: number, type: 'approved' | 'rejected') => {
    if (!msg.imageUrl || !chatState.brand.id) return;
    const key = `${msg.imageUrl}-${type === 'approved' ? 'like' : 'dislike'}`;
    setFeedbackGiven(prev => ({ ...prev, [key]: true }));

    // Compress the image for storage
    let storedUrl = msg.imageUrl;
    try { storedUrl = await compressImageForFeedback(msg.imageUrl); } catch { /**/ }

    const item: FeedbackItem = {
      id: Date.now().toString(),
      image_url: storedUrl,
      prompt: msg.content,
      ai_tool: chatState.ai,
      type,
      timestamp: new Date().toISOString(),
      brand_id: chatState.brand.id as number,
    };

    // Save to brand_dna.training_feedback
    try {
      const res = await axios.get(`/api/v1/entities/brand_profiles/${chatState.brand.id}`);
      let dna: Record<string, unknown> = {};
      try { dna = JSON.parse(res.data.brand_dna ?? '{}'); } catch { /**/ }
      const existing = Array.isArray(dna.training_feedback) ? dna.training_feedback as FeedbackItem[] : [];
      dna.training_feedback = [item, ...existing].slice(0, 200); // keep last 200
      await axios.put(`/api/v1/entities/brand_profiles/${chatState.brand.id}`, {
        brand_dna: JSON.stringify(dna),
      });
      toast.success(type === 'approved' ? '👍 Added to training data' : '👎 Feedback recorded');
    } catch {
      toast.error('Failed to save feedback');
    }
  };

  const handleEnhancePrompt = async () => {
    const text = input.trim();
    if (!text || enhancing) return;
    setEnhancing(true);
    setEnhancedPrompt('');
    setShowEnhanced(true);

    const brand = chatState.brand;
    let dna: Record<string, unknown> | null = null;
    if (brand.brand_dna) {
      try { dna = JSON.parse(brand.brand_dna); } catch { dna = null; }
    }

    const brandContext: string[] = [`Brand: ${brand.brand_name}`];
    if (brand.industry) brandContext.push(`Industry: ${brand.industry}`);
    if (brand.tone_of_voice) brandContext.push(`Tone of voice: ${brand.tone_of_voice}`);
    if (brand.primary_color) brandContext.push(`Primary colour: ${brand.primary_color}`);
    if (brand.secondary_color) brandContext.push(`Secondary colour: ${brand.secondary_color}`);

    if (dna) {
      const pick = (key: string) => {
        const val = dna![key];
        if (!val) return;
        if (Array.isArray(val)) brandContext.push(`${key}: ${val.join(', ')}`);
        else if (typeof val === 'string') brandContext.push(`${key}: ${val}`);
      };
      pick('brand_personality'); pick('brand_values'); pick('target_audience');
      pick('visual_style'); pick('photography_style'); pick('color_palette');
      pick('typography'); pick('tagline'); pick('mission'); pick('usp');
      for (const [k, v] of Object.entries(dna)) {
        if (brandContext.some((l) => l.startsWith(`${k}:`))) continue;
        if (typeof v === 'string' && v) brandContext.push(`${k}: ${v}`);
        else if (Array.isArray(v) && v.length) brandContext.push(`${k}: ${v.join(', ')}`);
      }
    }

    const systemMsg = [
      `You are an expert creative prompt engineer working for ${brand.brand_name}.`,
      ``,
      `BRAND GUIDELINES:`,
      ...brandContext.map((l) => `• ${l}`),
      ``,
      `TASK:`,
      `Rewrite the user's prompt so it is:`,
      `1. Deeply aligned with the brand guidelines above — tone, style, colours, audience`,
      `2. Specific and production-ready for ${chatState.ai}`,
      `3. Optimised for ${chatState.typeLabel} content`,
      ``,
      `Output ONLY the improved prompt. No explanation, no quotes, no preamble.`,
    ].join('\n');

    try {
      await mgxClient.ai.gentxt({
        messages: [
          { role: 'system', content: systemMsg },
          { role: 'user', content: text },
        ],
        model: 'gemini-3.5-flash',
        stream: true,
        onChunk: (chunk: { content?: string }) => {
          setEnhancedPrompt((prev) => prev + (chunk.content ?? ''));
        },
        onComplete: () => setEnhancing(false),
        onError: () => setEnhancing(false),
        timeout: 30000,
      });
    } catch {
      setEnhancing(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUri = ev.target?.result as string;
      setImageAttachment(dataUri);
      // Auto-detect aspect ratio so the output matches the reference
      const img = new Image();
      img.onload = () => {
        const ratio = img.naturalWidth / img.naturalHeight;
        let ar = '1:1';
        if (ratio > 1.6) ar = '16:9';
        else if (ratio > 1.2) ar = '4:3';
        else if (ratio < 0.65) ar = '9:16';
        else if (ratio < 0.85) ar = '3:4';
        setDetectedAspectRatio(ar);
      };
      img.src = dataUri;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if ((!text && !imageAttachment) || generating) return;

    const userMsg: Message = { role: 'user', content: text, attachedImage: imageAttachment ?? undefined };
    setMessages((prev) => [...prev, userMsg]);

    setInput('');
    setImageAttachment(null);
    setDetectedAspectRatio('1:1');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setGenerating(true);

    // ── Text / Chat mode ────────────────────────────────────────────────────
    if (outputMode === 'text') {
      const loadingMsg: Message = { role: 'assistant', content: '__streaming__' };
      setMessages((prev) => [...prev, loadingMsg]);
      try {
        const brandBrief = buildBrandBrief(chatState.brand);
        const sysMsg = [
          systemPrompt,
          brandBrief ? `\n\nBrand context:\n${brandBrief}` : '',
        ].join('');
        const history = messages
          .filter((m) => !m.content.startsWith('__error__') && m.content !== 'Generating image…' && m.content !== '__streaming__')
          .slice(-10)
          .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

        let accumulated = '';
        await mgxClient.ai.gentxt({
          messages: [
            { role: 'system', content: sysMsg },
            ...history,
            { role: 'user', content: text },
          ],
          model: 'gemini-3.5-flash',
          stream: true,
          onChunk: (chunk: { content?: string }) => {
            accumulated += chunk.content ?? '';
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = { role: 'assistant', content: accumulated };
              return updated;
            });
          },
          onComplete: () => {
            setGenerating(false);
            setMessages((prev) => { persistHistory(prev); return prev; });
          },
          onError: () => {
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = { role: 'assistant', content: '__error__Something went wrong — please try again.' };
              return updated;
            });
            setGenerating(false);
          },
          timeout: 60000,
        });
      } catch (err: unknown) {
        const msg = getErrorMessage(err);
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: `__error__${msg}` };
          return updated;
        });
        setGenerating(false);
      }
      return;
    }

    // ── Image generation mode ───────────────────────────────────────────────

    // Has the AI already produced at least one image in this chat? If so this is a revision turn.
    const isRevisionTurn = messages.some(
      (m) => m.role === 'assistant' && m.imageUrl && !m.content.startsWith('__error__'),
    );

    // If a new image is being uploaded, pin it as the template for this entire chat
    const newPin = imageAttachment;
    if (newPin) {
      setPinnedReference(newPin);
      setPinnedAspectRatio(detectedAspectRatio);
    }
    // On revision turns, send NO reference image so the backend doesn't attach the original
    // template to the current user turn (which overrides conversation history and makes Gemini
    // restart from the template instead of refining the last generated image).
    // AI Edit mode always pins the reference — even across revision turns
    const isAiEdit = Boolean(aiEditingPrompt) && Boolean(pinnedReference) && !newPin;
    const activeReference = isAiEdit ? pinnedReference : (isRevisionTurn ? null : (newPin ?? pinnedReference));
    const activeAspectRatio = newPin ? detectedAspectRatio : (pinnedAspectRatio || '1:1');

    const loadingMsg: Message = { role: 'assistant', content: 'Generating image…' };
    setMessages((prev) => [...prev, loadingMsg]);
    try {
      const basePrompt = text || 'Create a professional marketing image in the same style as the reference';

      const isFluxSelected = FLUX_AIS.has(chatState.ai);
      const isGrokSelected = GROK_AIS.has(chatState.ai);
      let enrichedPrompt: string;
      const isAiEditMode = Boolean(aiEditingPrompt) && Boolean(pinnedReference) && !newPin;

      if (isFluxSelected || isGrokSelected) {
        // Flux LoRA / Grok: NEVER inject brand colours — the LoRA already knows the product.
        // Brand DNA colour injection (primary_color: #502C12) overrides what the LoRA learned.
        enrichedPrompt = basePrompt;
      } else if (newPin) {
        enrichedPrompt = basePrompt;
      } else if (isAiEditMode) {
        // AI Edit mode: force Gemini into edit-only mode, never regenerate from scratch
        enrichedPrompt = (
          `EDIT THIS EXACT IMAGE — do NOT generate a new image from scratch.\n` +
          `The reference image is attached. Apply ONLY this specific change:\n\n` +
          `"${basePrompt}"\n\n` +
          `Keep EVERYTHING else absolutely identical: subject, pose, composition, ` +
          `background, lighting direction, clothing, bike, all details. ` +
          `Only modify exactly what was requested above. ` +
          `Output the same image with only that one change applied.`
        );
      } else if (isRevisionTurn) {
        enrichedPrompt = `${basePrompt}\n\nIMPORTANT: Apply this change to the LAST IMAGE you generated in this conversation. Do NOT start over from the original template — build on your most recent output and make only this specific change while keeping everything else identical.`;
      } else if (pinnedProducts.length > 0) {
        enrichedPrompt = buildEnrichedImagePrompt(basePrompt, chatState.brand, chatState.type);
      } else if (activeReference) {
        enrichedPrompt = basePrompt;
      } else {
        enrichedPrompt = buildEnrichedImagePrompt(basePrompt, chatState.brand, chatState.type);
      }

      // Build explicit image index so Gemini knows exactly what each attached image is
      const attachedImageLabels: string[] = [];
      pinnedProducts.forEach((p, i) => {
        attachedImageLabels.push(`Attached image ${i + 1}: This is the exact ${chatState.brand.brand_name} ${p.name}. Reproduce this specific product faithfully — match its shape, geometry, colours, and distinctive design details exactly.`);
      });
      if (layoutReference) {
        const layoutIdx = pinnedProducts.length + 1;
        attachedImageLabels.push(
          `Attached image ${layoutIdx} (LAYOUT REFERENCE): This image shows the exact layout template to follow. ` +
          `Copy its composition structure PRECISELY:\n` +
          `- Headline: ultra-bold condensed ALL-CAPS, top-left corner, same relative size and padding as shown\n` +
          `- Subtitle: lighter weight, smaller, directly below the headline, same position\n` +
          `- Brand logomark: bottom-right corner, same size and clear-space as shown\n` +
          `- Website URL: bottom-left corner, small text, same as shown\n` +
          `Do NOT copy the photo scene — generate a completely new scene. Copy ONLY the text/logo layout structure.`
        );
      }
      if (attachedImageLabels.length > 0) {
        enrichedPrompt += `\n\n=== ATTACHED IMAGE GUIDE ===\n${attachedImageLabels.join('\n\n')}`;
      }

      const brandBrief = buildBrandBrief(chatState.brand);

      const convHistory = messages
        .filter((m) => !m.content.startsWith('__error__') && m.content !== 'Generating image…' && m.content !== '__streaming__')
        .slice(-6)
        .map((m) => ({
          role: m.role,
          content: m.imageUrl ? '(generated image)' : m.content,
          image_url: m.imageUrl ?? null,
          attached_image: null,
        }));

      // Route to correct image engine — respects the user's AI selection
      const lora = getLoraInfo(chatState.brand);
      let imageUrl = '';

      if (isFluxSelected && lora) {
        // Flux Pro + trained LoRA = best product accuracy
        const promptWithTrigger = lora.triggerWord
          ? `${lora.triggerWord} ${enrichedPrompt}`
          : enrichedPrompt;
        const loraRes = await axios.post('/api/v1/aihub/genimg-lora', {
          prompt: promptWithTrigger,
          lora_url: lora.loraUrl,
          size: activeAspectRatio === '1:1' ? 'square_hd' : activeAspectRatio,
        }, { timeout: 180000 });
        imageUrl = loraRes.data?.images?.[0] ?? '';
      } else if (isFluxSelected) {
        // Flux Pro without LoRA
        const fluxRes = await axios.post('/api/v1/aihub/genimg-flux', {
          prompt: enrichedPrompt,
          size: activeAspectRatio === '1:1' ? 'square_hd' : activeAspectRatio,
          model: 'flux-pro',
        }, { timeout: 180000 });
        imageUrl = fluxRes.data?.images?.[0] ?? '';
      } else if (isGrokSelected) {
        // Grok Image — vision bridge: actual product images sent to Gemini Vision
        // for description, then those precise descriptions are injected into Grok's prompt
        const grokProductImages = [
          ...pinnedProducts.map(p => p.url),
          ...(layoutReference ? [layoutReference] : []),
        ];
        const grokRes = await axios.post('/api/v1/aihub/genimg-grok', {
          prompt: enrichedPrompt,
          size: activeAspectRatio === '1:1' ? 'square_hd' : activeAspectRatio,
          brand_context: brandBrief || undefined,
          product_images: grokProductImages.length > 0 ? grokProductImages : undefined,
        }, { timeout: 180000 });
        imageUrl = grokRes.data?.images?.[0] ?? '';
      } else {
        // Gemini — supports reference images and conversation history
        const res = await axios.post('/api/v1/aihub/genimg', {
          prompt: enrichedPrompt,
          image: activeReference ?? undefined,
          messages: convHistory,
          brand_context: brandBrief || undefined,
          product_images: (() => {
            const imgs = [
              ...pinnedProducts.map((p) => p.url),
              ...(layoutReference ? [layoutReference] : []),
            ];
            return imgs.length > 0 ? imgs : undefined;
          })(),
          model: 'gemini-3-pro-image',
          size: activeAspectRatio,
          quality: 'hd',
          n: 1,
        });
        imageUrl = res.data?.images?.[0] ?? res.data?.url ?? '';
      }
      if (!imageUrl) throw new Error('No image returned');
      // If Gemini returned a base64 data URI, upload it to get a stable HTTP URL
      // so the image persists across page reloads (base64 URIs are stripped from DB)
      if (imageUrl.startsWith('data:') && chatState.brand.id) {
        try {
          const uploadRes = await axios.post(
            `/api/v1/entities/brand_profiles/${chatState.brand.id}/save-image`,
            { data_uri: imageUrl },
          );
          if (uploadRes.data?.url) imageUrl = uploadRes.data.url;
        } catch {
          // Upload failed — keep the data URI so it at least shows in this session
        }
      }
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: text || basePrompt, imageUrl };
        persistHistory(updated);
        return updated;
      });
    } catch (err: unknown) {
      const msg = getErrorMessage(err);
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: `__error__${msg}` };
        return updated;
      });
    } finally {
      setGenerating(false);
    }
  }, [input, imageAttachment, generating, messages, chatState, systemPrompt, outputMode, persistHistory]);

  const handleNewChat = () => {
    if (messages.length > 0) {
      kbSave(chatState, messages);
      setSavedChats(kbLoad());
    }
    setMessages([]);
    setInput('');
    setImageAttachment(null);
    setPinnedReference(null);
    setPinnedAspectRatio('1:1');
    setPinnedProducts([]);
    setLayoutReference(null);
    setEnhancedPrompt('');
    setAiEditingPrompt('');
    setShowEnhanced(false);
    setOutputMode('image');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    // Clear persisted DB history so next session starts fresh
    if (chatState.brand.id) {
      axios.post(`/api/v1/entities/brand_profiles/${chatState.brand.id}/chat`, { messages: [] })
        .catch(() => {});
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestion = (s: string) => {
    setInput(s);
    textareaRef.current?.focus();
    setTimeout(adjustTextarea, 0);
  };

  return (
    <div className="flex h-[calc(100vh-64px)] gap-4 p-4 bg-[#f5f3ef]">
      {/* Left sidebar */}
      <div className="w-[280px] flex-shrink-0 bg-[#1e1e20] rounded-2xl p-6 flex flex-col overflow-hidden">
        <div className="mb-4">
          <p className="font-bold text-white text-[18px] leading-tight truncate">
            {chatState.brand.brand_name}
          </p>
          <span className="inline-flex items-center gap-1.5 mt-2 bg-white/10 text-white/70 text-[12px] px-2.5 py-1 rounded-full">
            <TypeIcon className="h-3 w-3" />
            {chatState.typeLabel}
          </span>
        </div>

        <div className="border-t border-white/10 pt-4 mb-4 space-y-3">
          <p className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">Brand DNA</p>

          {/* Colour swatches — all 3 */}
          {(chatState.brand.primary_color || chatState.brand.secondary_color || chatState.brand.accent_color) && (
            <div className="flex items-center gap-2">
              {[chatState.brand.primary_color, chatState.brand.secondary_color, chatState.brand.accent_color]
                .filter(Boolean)
                .map((c, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div
                      className="h-5 w-5 rounded-full border border-white/20 flex-shrink-0"
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                    <span className="text-[10px] text-white/40 font-mono">{c}</span>
                  </div>
                ))}
            </div>
          )}

          {/* DNA fields pulled from brand_dna JSON */}
          {(() => {
            let dna: Record<string, unknown> = {};
            try { dna = JSON.parse((chatState.brand as any).brand_dna ?? '{}'); } catch { /**/ }
            const s = (key: string): string | null => {
              const v = dna[key] ?? (chatState.brand as any)[key];
              return typeof v === 'string' && v.trim() ? v.trim() : null;
            };
            const a = (key: string): string[] => Array.isArray(dna[key]) ? (dna[key] as string[]) : [];

            const rows: { label: string; value: string }[] = [];
            if (chatState.brand.industry)          rows.push({ label: 'Industry', value: chatState.brand.industry });
            if (chatState.brand.tagline || s('tagline')) rows.push({ label: 'Tagline', value: (chatState.brand.tagline || s('tagline'))! });
            const personality = a('brand_personality');
            if (personality.length)                rows.push({ label: 'Personality', value: personality.slice(0, 3).join(', ') });
            const audience = s('target_audience');
            if (audience)                          rows.push({ label: 'Audience', value: audience });
            const fh = chatState.brand.font_heading || s('font_heading');
            if (fh)                                rows.push({ label: 'Heading font', value: fh });
            const fb = chatState.brand.font_body   || s('font_body');
            if (fb)                                rows.push({ label: 'Body font', value: fb });
            const vis = s('visual_style');
            if (vis)                               rows.push({ label: 'Visual style', value: vis });

            return rows.map(({ label, value }) => (
              <div key={label}>
                <p className="text-[10px] text-white/30 uppercase tracking-wider">{label}</p>
                <p className="text-[11px] text-white/70 leading-snug line-clamp-2">{value}</p>
              </div>
            ));
          })()}

          <div className="border-t border-white/10 pt-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <TypeIcon className="h-3.5 w-3.5 text-white/30 flex-shrink-0" />
              <span className="text-[11px] text-white/50">{chatState.typeLabel}</span>
            </div>
            <p className="text-[11px] text-white/50">{chatState.ai}</p>
          </div>
        </div>

        <div className="border-t border-white/10 pt-4 mb-4 flex items-center justify-between">
          <button
            onClick={() => {
              if (messages.length > 0) {
                kbSave(chatState, messages);
              }
              // Clear DB history so re-entering the same brand starts fresh
              if (chatState.brand.id) {
                axios.post(`/api/v1/entities/brand_profiles/${chatState.brand.id}/chat`, { messages: [] })
                  .catch(() => {});
              }
              onReset();
            }}
            className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Start over
          </button>
          <button
            onClick={handleNewChat}
            className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors"
          >
            New Chat
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {messages.length > 0 && (
          <div className="overflow-y-auto space-y-2 min-h-0 max-h-[160px]">
            <p className="text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-2">This Chat</p>
            {messages.map((m, i) => (
              <div
                key={i}
                className={`text-[12px] rounded-lg px-3 py-2 truncate ${
                  m.role === 'user'
                    ? 'bg-white/10 text-white/80'
                    : 'bg-white/5 text-white/50'
                }`}
              >
                {m.imageUrl ? '🖼 Image generated' : m.content.slice(0, 60)}{!m.imageUrl && m.content.length > 60 ? '…' : ''}
              </div>
            ))}
          </div>
        )}

        {/* ── History (current brand only) ── */}
        {(() => {
          const brandHistory = savedChats.filter(sc => sc.brandName === chatState.brand.brand_name);
          if (brandHistory.length === 0) return null;
          return (
            <div className="mt-4 border-t border-white/10 pt-4">
              <button
                onClick={() => setKbOpen(v => !v)}
                className="flex items-center justify-between w-full mb-2"
              >
                <p className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">
                  History ({brandHistory.length})
                </p>
                <span className="text-white/30 text-[10px]">{kbOpen ? '▲' : '▼'}</span>
              </button>
              {kbOpen && (
                <div className="space-y-2 overflow-y-auto max-h-[220px]">
                  {brandHistory.map((sc) => (
                    <div
                      key={sc.id}
                      className="rounded-xl bg-white/5 border border-white/10 px-3 py-2.5"
                    >
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <span className="text-[10px] text-white/30 shrink-0">{kbRelativeTime(sc.savedAt)}</span>
                      </div>
                      <p className="text-[10px] text-white/40 mb-1.5">{sc.typeLabel} · {sc.ai}{sc.imageCount > 0 ? ` · ${sc.imageCount} img` : ''}</p>
                      <p className="text-[11px] text-white/60 leading-snug line-clamp-2 mb-2">{sc.preview}</p>
                      <button
                        onClick={() => onResumeChat(sc)}
                        className="text-[11px] text-white/70 hover:text-white border border-white/20 hover:border-white/40 rounded-lg px-2.5 py-1 transition-colors w-full text-center"
                      >
                        Resume
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Right chat area */}
      <div className="flex-1 flex flex-col bg-white rounded-2xl overflow-hidden min-w-0">
        {/* Brand context bar */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-[#e2e2e2] flex-wrap">
          {chatState.brand.primary_color && (
            <div className="flex items-center gap-1.5">
              <div className="h-4 w-4 rounded-full border border-[#e2e2e2]" style={{ backgroundColor: chatState.brand.primary_color }} />
              {chatState.brand.secondary_color && (
                <div className="h-4 w-4 rounded-full border border-[#e2e2e2]" style={{ backgroundColor: chatState.brand.secondary_color }} />
              )}
            </div>
          )}
          <span className="text-[12px] font-semibold text-[#1e1e20]">{chatState.brand.brand_name}</span>
          <span className="h-4 w-px bg-[#e2e2e2]" />
          <span className="text-[11px] text-[#595959]">{chatState.typeLabel}</span>
          <span className="h-4 w-px bg-[#e2e2e2]" />
          <span className="bg-[#1e1e20] text-white text-[11px] font-medium px-2.5 py-0.5 rounded-full">
            {FLUX_AIS.has(chatState.ai) && getLoraInfo(chatState.brand)
              ? `${chatState.ai} + LoRA ✦`
              : chatState.ai}
          </span>
          {chatState.brand.tone_of_voice && (
            <>
              <span className="h-4 w-px bg-[#e2e2e2]" />
              <span className="text-[11px] text-[#595959]">Tone: {chatState.brand.tone_of_voice}</span>
            </>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Brand brief always visible at top */}
          <BrandBriefCard brand={chatState.brand} />

          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center px-8 pt-4">
              <div className="w-14 h-14 rounded-2xl bg-[#f5f3ef] flex items-center justify-center mb-4">
                <TypeIcon className="h-7 w-7 text-[#1e1e20]" />
              </div>
              <h2 className="font-bold text-[20px] text-[#1e1e20] mb-1">
                {chatState.brand.brand_name}
              </h2>
              <p className="text-[14px] text-[#595959] mb-6">
                {chatState.typeLabel} · {chatState.ai}
              </p>
              {suggestions.length > 0 && (
                <div className="flex flex-col gap-2 w-full max-w-md">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => handleSuggestion(s)}
                      className="text-left text-[13px] text-[#1e1e20] border border-[#e2e2e2] rounded-xl px-4 py-3 hover:bg-[#f5f3ef] transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {m.imageUrl ? (
                  <div className="w-[320px] rounded-xl overflow-hidden border border-[#e2e2e2] shadow-sm">
                    <div
                      className="relative cursor-zoom-in group/img"
                      onClick={() => setLightboxUrl(m.imageUrl!)}
                    >
                      <img
                        src={m.imageUrl}
                        alt="Generated"
                        className="w-full h-auto block"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 transition-colors flex items-center justify-center">
                        <span className="opacity-0 group-hover/img:opacity-100 transition-opacity bg-black/50 text-white text-[11px] font-medium px-2.5 py-1 rounded-full backdrop-blur-sm">
                          Click to expand
                        </span>
                      </div>
                    </div>
                    <div className="bg-white border-t border-[#e2e2e2] px-3 py-2">
                      {/* Prompt text */}
                      <p className="text-[11px] text-[#595959] line-clamp-2 mb-2">{m.content}</p>
                      {/* Action buttons — full width row */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        onClick={() => !m.saved && saveToGallery(m.imageUrl!, m.content, i)}
                        className={`flex items-center gap-1 text-[12px] font-medium rounded-lg px-2 py-1.5 transition-colors flex-shrink-0 ${
                          m.saved
                            ? 'bg-[#1e1e20] text-white border border-[#1e1e20] cursor-default'
                            : 'text-[#1e1e20] border border-[#e2e2e2] hover:bg-[#f5f3ef] cursor-pointer'
                        }`}
                      >
                        <Bookmark className={`h-3.5 w-3.5 ${m.saved ? 'fill-current' : ''}`} />
                        {m.saved ? 'Saved' : 'Save'}
                      </button>
                      <button
                        onClick={() => handleFeedback(m, i, 'approved')}
                        className={`flex items-center gap-1 text-[12px] font-medium rounded-lg px-2 py-1.5 transition-colors flex-shrink-0 ${
                          feedbackGiven[`${m.imageUrl}-like`]
                            ? 'bg-green-600 text-white border border-green-600'
                            : 'text-green-700 border border-green-200 hover:bg-green-50'
                        }`}
                        title="Good — add to training"
                      >
                        <ThumbsUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleFeedback(m, i, 'rejected')}
                        className={`flex items-center gap-1 text-[12px] font-medium rounded-lg px-2 py-1.5 transition-colors flex-shrink-0 ${
                          feedbackGiven[`${m.imageUrl}-dislike`]
                            ? 'bg-red-500 text-white border border-red-500'
                            : 'text-red-400 border border-red-200 hover:bg-red-50'
                        }`}
                        title="Bad — reject"
                      >
                        <ThumbsDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setPinnedReference(m.imageUrl!);
                          setPinnedAspectRatio('1:1');
                          setAiEditingPrompt(m.content.slice(0, 40));
                          setTimeout(() => { textareaRef.current?.focus(); }, 100);
                        }}
                        className="flex items-center gap-1 text-[12px] font-medium text-emerald-700 border border-emerald-200 bg-emerald-50 rounded-lg px-2 py-1.5 hover:bg-emerald-100 transition-colors flex-shrink-0"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        AI Edit
                      </button>
                      <button
                        onClick={() => setEditingImageUrl(m.imageUrl!)}
                        className="flex items-center gap-1 text-[12px] font-medium text-[#7c3aed] border border-[#ede9fe] bg-[#f5f3ff] rounded-lg px-2 py-1.5 hover:bg-[#ede9fe] transition-colors flex-shrink-0"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Overlay
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            const res = await fetch(m.imageUrl!);
                            const blob = await res.blob();
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `shelby-${Date.now()}.jpg`;
                            a.click();
                            URL.revokeObjectURL(url);
                          } catch {
                            window.open(m.imageUrl, '_blank');
                          }
                        }}
                        className="flex items-center gap-1 text-[12px] font-medium text-[#1e1e20] border border-[#e2e2e2] rounded-lg px-2.5 py-1.5 hover:bg-[#f5f3ef] transition-colors flex-shrink-0"
                        title="Download"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download
                      </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={`max-w-[75%] flex flex-col gap-2 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                    {m.attachedImage && (
                      <img
                        src={m.attachedImage}
                        alt="Uploaded"
                        className="rounded-xl h-auto block border border-[#e2e2e2]"
                        style={{ maxWidth: 280 }}
                      />
                    )}
                    {(m.content || m.role === 'assistant') && (
                      m.content.startsWith('__error__') ? (
                        <div className="rounded-xl p-4 bg-red-50 border border-red-200 flex items-start gap-3 max-w-sm">
                          <span className="text-red-500 text-lg leading-none mt-0.5">⚠</span>
                          <div>
                            <p className="text-[13px] font-medium text-red-700 mb-1">Generation failed</p>
                            <p className="text-[13px] text-red-600">{m.content.slice(9)}</p>
                          </div>
                        </div>
                      ) : m.role === 'user' ? (
                        <div className="rounded-xl px-4 py-3 text-[14px] leading-relaxed bg-[#1e1e20] text-white whitespace-pre-wrap">
                          {m.content}
                        </div>
                      ) : (
                        <div className="rounded-xl px-4 py-3 bg-white border border-[#e2e2e2] text-[#1e1e20]">
                          {m.content === '__streaming__' || !m.content ? (
                            <Loader2 className="h-4 w-4 animate-spin text-[#595959]" />
                          ) : (
                            <Markdown
                              options={{
                                overrides: {
                                  h1: { props: { className: 'text-[17px] font-bold mt-4 mb-2 first:mt-0' } },
                                  h2: { props: { className: 'text-[15px] font-bold mt-4 mb-1.5 first:mt-0' } },
                                  h3: { props: { className: 'text-[14px] font-semibold mt-3 mb-1 first:mt-0' } },
                                  p:  { props: { className: 'text-[14px] leading-relaxed mb-2 last:mb-0' } },
                                  ul: { props: { className: 'list-disc pl-5 mb-2 space-y-1 text-[14px]' } },
                                  ol: { props: { className: 'list-decimal pl-5 mb-2 space-y-1 text-[14px]' } },
                                  li: { props: { className: 'leading-relaxed' } },
                                  strong: { props: { className: 'font-semibold' } },
                                  em: { props: { className: 'italic' } },
                                  blockquote: { props: { className: 'border-l-2 border-[#e2e2e2] pl-3 text-[#595959] my-2 italic text-[14px]' } },
                                  hr: { props: { className: 'border-[#e2e2e2] my-3' } },
                                  code: { props: { className: 'bg-[#f5f5f5] rounded px-1 py-0.5 text-[13px] font-mono' } },
                                  pre: { props: { className: 'bg-[#f5f5f5] rounded-lg p-3 overflow-x-auto text-[13px] font-mono mb-2' } },
                                },
                              }}
                            >
                              {m.content}
                            </Markdown>
                          )}
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-[#e2e2e2] p-4">

          {/* ── Enhance Prompt panel ── */}
          {showEnhanced && (
            <div className="mb-4 rounded-2xl border border-[#e2e2e2] bg-[#fafaf9] overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#e2e2e2]">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#7c3aed]" />
                  <span className="text-[13px] font-semibold text-[#1e1e20]">Enhanced Prompt</span>
                  {enhancing && (
                    <span className="flex items-center gap-1 text-[11px] text-[#959595]">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Writing…
                    </span>
                  )}
                </div>
                <button
                  onClick={() => { setShowEnhanced(false); setEnhancedPrompt(''); }}
                  className="text-[#959595] hover:text-[#1e1e20] transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Original vs Enhanced */}
              <div className="grid grid-cols-2 divide-x divide-[#e2e2e2]">
                {/* Original */}
                <div className="px-4 py-3">
                  <p className="text-[10px] font-semibold text-[#959595] uppercase tracking-wider mb-2">Original</p>
                  <p className="text-[13px] text-[#595959] leading-relaxed whitespace-pre-wrap">{input}</p>
                </div>
                {/* Enhanced — editable + copyable */}
                <div className="px-4 py-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold text-[#7c3aed] uppercase tracking-wider">Enhanced</p>
                    {enhancedPrompt && !enhancing && (
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(enhancedPrompt);
                          setCopiedEnhanced(true);
                          setTimeout(() => setCopiedEnhanced(false), 2000);
                        }}
                        className="flex items-center gap-1 text-[11px] text-[#595959] hover:text-[#1e1e20] transition-colors"
                      >
                        {copiedEnhanced ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                        {copiedEnhanced ? 'Copied' : 'Copy'}
                      </button>
                    )}
                  </div>
                  {enhancing && !enhancedPrompt ? (
                    <p className="text-[13px] text-[#959595]">Generating…</p>
                  ) : (
                    <textarea
                      value={enhancedPrompt}
                      onChange={(e) => setEnhancedPrompt(e.target.value)}
                      className="w-full text-[13px] text-[#1e1e20] leading-relaxed bg-transparent resize-none outline-none min-h-[80px] max-h-[200px] overflow-y-auto"
                      placeholder="Enhanced prompt will appear here…"
                    />
                  )}
                </div>
              </div>

              {/* Actions */}
              {!enhancing && enhancedPrompt && (
                <div className="flex items-center gap-2 px-4 py-3 border-t border-[#e2e2e2] bg-white">
                  <button
                    onClick={() => {
                      setInput(enhancedPrompt);
                      setShowEnhanced(false);
                      setEnhancedPrompt('');
                      setTimeout(adjustTextarea, 0);
                      textareaRef.current?.focus();
                    }}
                    className="bg-[#1e1e20] text-white text-[13px] font-medium px-4 py-2 rounded-lg hover:bg-[#2d2d30] transition-colors"
                  >
                    Use This Prompt
                  </button>
                  <button
                    onClick={() => { setShowEnhanced(false); setEnhancedPrompt(''); }}
                    className="text-[13px] text-[#595959] hover:text-[#1e1e20] transition-colors px-3 py-2"
                  >
                    Keep Original
                  </button>
                  <button
                    onClick={handleEnhancePrompt}
                    className="ml-auto flex items-center gap-1.5 text-[12px] text-[#7c3aed] hover:text-[#6d28d9] transition-colors"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Regenerate
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Product + Layout reference chips — single row */}
          {(() => {
            // Products + Layout chips only for Gemini — Flux/Grok use LoRA, not reference images
            if (FLUX_AIS.has(chatState.ai) || GROK_AIS.has(chatState.ai)) return null;
            try {
              const dna = JSON.parse((chatState.brand as any).brand_dna ?? '{}');
              const productRefs: { name: string; url: string }[] = Array.isArray(dna.product_references) ? dna.product_references : [];
              const layoutRefs: { name: string; url: string }[] = Array.isArray(dna.layout_references) ? dna.layout_references : [];
              if (productRefs.length === 0 && layoutRefs.length === 0) return null;
              return (
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  {productRefs.length > 0 && (
                    <>
                      <span className="text-[11px] text-[#908f8e] shrink-0">Products:</span>
                      {productRefs.map((ref, i) => {
                        const isActive = pinnedProducts.some((p) => p.url === ref.url);
                        return (
                          <button
                            key={`p-${i}`}
                            onClick={() =>
                              setPinnedProducts((prev) =>
                                isActive ? prev.filter((p) => p.url !== ref.url) : [...prev, { name: ref.name, url: ref.url }]
                              )
                            }
                            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all ${
                              isActive
                                ? 'border-[#1e1e20] bg-[#1e1e20] text-white'
                                : 'border-[#e2e2e2] bg-white text-[#595959] hover:border-[#1e1e20] hover:text-[#1e1e20]'
                            }`}
                          >
                            <img src={ref.url} alt={ref.name} className="h-4 w-4 rounded-full object-cover shrink-0" />
                            {ref.name}
                            {isActive && <X className="h-3 w-3 ml-0.5" />}
                          </button>
                        );
                      })}
                    </>
                  )}

                  {layoutRefs.length > 0 && (
                    <>
                      {productRefs.length > 0 && <span className="h-4 w-px bg-[#e2e2e2] shrink-0" />}
                      <span className="text-[11px] text-[#908f8e] shrink-0">Layout:</span>
                      {layoutRefs.map((ref, i) => {
                        const isActive = layoutReference === ref.url;
                        return (
                          <button
                            key={`l-${i}`}
                            onClick={() => setLayoutReference(isActive ? null : ref.url)}
                            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all ${
                              isActive
                                ? 'border-violet-600 bg-violet-600 text-white'
                                : 'border-[#e2e2e2] bg-white text-[#595959] hover:border-violet-400 hover:text-violet-700'
                            }`}
                          >
                            <img src={ref.url} alt={ref.name} className="h-4 w-4 rounded object-cover shrink-0" />
                            {ref.name}
                            {isActive && <X className="h-3 w-3 ml-0.5" />}
                          </button>
                        );
                      })}
                    </>
                  )}
                </div>
              );
            } catch { return null; }
          })()}

          {/* Pinned reference indicator */}
          {pinnedReference && !imageAttachment && (
            <div className={`flex items-center gap-2 mb-3 px-1 py-2 rounded-xl ${aiEditingPrompt ? 'bg-emerald-50 border border-emerald-200' : ''}`}>
              <img
                src={pinnedReference}
                alt="Pinned"
                className="h-10 w-10 rounded-lg object-cover border border-[#e2e2e2] flex-shrink-0"
              />
              <span className="text-[11px] flex-1">
                {aiEditingPrompt ? (
                  <>
                    <span className="font-semibold text-emerald-800">AI Edit mode</span>
                    <span className="text-emerald-600"> — describe your changes below. Gemini will update the image.</span>
                    <span className="block text-[10px] text-emerald-500 mt-0.5">Based on: "{aiEditingPrompt}{aiEditingPrompt.length >= 40 ? '…' : ''}"</span>
                  </>
                ) : (
                  <>
                    <span className="font-medium text-[#1e1e20]">Template pinned</span>
                    <span className="text-[#595959]"> — original reference sent with every generation</span>
                  </>
                )}
              </span>
              <button
                onClick={() => { setPinnedReference(null); setPinnedAspectRatio('1:1'); setAiEditingPrompt(''); }}
                className="text-[11px] text-[#595959] hover:text-[#1e1e20] transition-colors flex-shrink-0"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Image attachment preview */}
          {imageAttachment && (
            <div className="relative inline-block mb-3">
              <img
                src={imageAttachment}
                alt="Attachment"
                className="h-20 w-20 rounded-xl object-cover border border-[#e2e2e2]"
              />
              <button
                onClick={() => setImageAttachment(null)}
                className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-[#1e1e20] text-white flex items-center justify-center hover:bg-[#595959] transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Output mode toggle */}
          <div className="flex items-center gap-1 mb-3">
            <button
              onClick={() => setOutputMode('image')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
                outputMode === 'image'
                  ? 'bg-[#1e1e20] text-white'
                  : 'bg-transparent text-[#595959] hover:text-[#1e1e20] hover:bg-[#f5f5f5]'
              }`}
            >
              <ImagePlus className="h-3.5 w-3.5" />
              Image
            </button>
            <button
              onClick={() => setOutputMode('text')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
                outputMode === 'text'
                  ? 'bg-[#1e1e20] text-white'
                  : 'bg-transparent text-[#595959] hover:text-[#1e1e20] hover:bg-[#f5f5f5]'
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Chat
            </button>
          </div>

          <div className="flex items-end gap-3">
            {/* Hidden file input */}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageSelect}
            />
            {/* Upload button — image mode only */}
            {outputMode === 'image' && (
              <button
                onClick={() => imageInputRef.current?.click()}
                disabled={generating}
                className="flex items-center justify-center border border-[#e2e2e2] rounded-xl h-[48px] w-[48px] flex-shrink-0 text-[#595959] hover:text-[#1e1e20] hover:border-[#1e1e20] transition-colors disabled:opacity-30"
                title="Attach an image"
              >
                <ImagePlus className="h-5 w-5" />
              </button>
            )}

            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => { setInput(e.target.value); adjustTextarea(); }}
              onKeyDown={handleKeyDown}
              placeholder={outputMode === 'image'
                ? `Describe the image you want to generate for ${chatState.brand.brand_name}…`
                : `Ask anything about ${chatState.brand.brand_name} — strategy, copy, ideas…`
              }
              rows={1}
              className="flex-1 border border-[#e2e2e2] rounded-xl px-4 py-3 text-[14px] resize-none focus:outline-none focus:border-[#1e1e20] min-h-[48px] max-h-[120px] leading-relaxed"
              style={{ overflow: 'auto' }}
            />
            <button
              onClick={handleEnhancePrompt}
              disabled={!input.trim() || enhancing || generating}
              className="flex items-center gap-1.5 border border-[#7c3aed] bg-[#f5f3ff] rounded-xl px-3 py-3 h-[48px] text-[13px] font-medium text-[#7c3aed] hover:bg-[#ede9fe] transition-colors disabled:opacity-30 flex-shrink-0 whitespace-nowrap"
              title="Enhance prompt with brand AI"
            >
              {enhancing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Enhance
            </button>
            <Button
              onClick={handleSend}
              disabled={(!input.trim() && !imageAttachment) || generating}
              className="bg-[#1e1e20] text-white rounded-xl p-3 h-[48px] w-[48px] flex-shrink-0 disabled:opacity-40"
            >
              {generating ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {editingImageUrl && (
        <ImageEditorModal
          imageUrl={editingImageUrl}
          brand={chatState.brand}
          onClose={() => setEditingImageUrl(null)}
        />
      )}

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute right-5 top-5 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
            onClick={() => setLightboxUrl(null)}
          >
            <X className="h-6 w-6" />
          </button>
          <img
            src={lightboxUrl}
            alt="Full size"
            className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function AIWorkspacePage() {
  const location = useLocation();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<ExtendedProfile | null>(null);
  const [chatState, setChatState] = useState<ChatState | null>(null);
  const [resumeMessages, setResumeMessages] = useState<Message[] | undefined>(undefined);
  const [chatKey, setChatKey] = useState(0);

  // Resume from gallery: AssetGalleryPage writes to sessionStorage, we read on mount
  useEffect(() => {
    const raw_json = sessionStorage.getItem('shl_resume_chat');
    if (!raw_json) return;
    sessionStorage.removeItem('shl_resume_chat'); // consume once

    let parsed: { chatState?: ChatState; messages?: Message[] } | null = null;
    try { parsed = JSON.parse(raw_json); } catch { return; }
    if (!parsed?.chatState || !parsed?.messages) return;

    const raw = parsed.chatState;
    const restoredMessages = parsed.messages;

    const typeEntry = CONTENT_TYPES.find((t) => t.id === raw.type);
    const resolvedTypeLabel = typeEntry?.title ?? raw.typeLabel ?? raw.type;

    const applyResume = (fullBrand: ExtendedProfile) => {
      setResumeMessages(restoredMessages);
      setChatState({ ...raw, brand: fullBrand, typeLabel: resolvedTypeLabel });
      setChatKey(k => k + 1);
    };

    const brandId = raw.brand?.id;
    if (brandId) {
      axios.get(`/api/v1/entities/brand_profiles/${brandId}`)
        .then((res) => applyResume((res.data as ExtendedProfile) || raw.brand as ExtendedProfile))
        .catch(() => applyResume(raw.brand as ExtendedProfile));
    } else {
      applyResume(raw.brand as ExtendedProfile);
    }
  }, []); // runs once on mount — sessionStorage is already set by gallery

  const handleOpenChat = (brand: ExtendedProfile) => {
    setSelectedBrand(brand);
    setModalOpen(true);
  };

  const handleConfirm = (state: ChatState) => {
    setModalOpen(false);
    setSelectedBrand(null);
    setResumeMessages(undefined);
    setChatState(state);
    setChatKey(k => k + 1); // always start a fresh chat on new selection
  };

  const handleReset = () => {
    setChatState(null);
    setResumeMessages(undefined);
  };

  const handleResumeChat = (saved: SavedChat) => {
    const typeEntry = CONTENT_TYPES.find(t => t.id === saved.chatState.type);
    const resolved = { ...saved.chatState, typeLabel: typeEntry?.title ?? saved.chatState.typeLabel };
    setResumeMessages(saved.messages as Message[]);
    setChatState(resolved);
    setChatKey(k => k + 1); // force ChatView remount so initialMessages is applied fresh
  };

  return (
    <SidebarLayout>
      {chatState ? (
        <ChatView
          key={chatKey}
          chatState={chatState}
          onReset={handleReset}
          initialMessages={resumeMessages}
          onResumeChat={handleResumeChat}
        />
      ) : (
        <BrandListView onOpenChat={handleOpenChat} />
      )}

      <OpenChatModal
        open={modalOpen}
        brand={selectedBrand}
        onClose={() => { setModalOpen(false); setSelectedBrand(null); }}
        onConfirm={handleConfirm}
      />
    </SidebarLayout>
  );
}
