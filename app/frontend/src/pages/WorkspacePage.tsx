import { useState, useEffect, useRef } from 'react';
import { useLocation, useSearchParams, Link } from 'react-router-dom';
import { createClient } from '@metagptx/web-sdk';
import axios from 'axios';
import SidebarLayout from '@/components/Sidebar';
import { type Brief, type BrandProfile, type BrandDNA } from '@/lib/briefTypes';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  MessageSquare, Image as ImageIcon, FileStack,
  Sparkles, Send, Loader2, Building2, Download, RefreshCw,
  Copy, Check, ExternalLink, Plus,
} from 'lucide-react';
import { toast } from 'sonner';

const client = createClient();

// ─── Shared types ──────────────────────────────────────────────────────────────

const ASSET_CATEGORIES = [
  { id: 'brand', label: 'Brand Design', desc: 'Logos, brand assets, visual identity', icon: '🎨', type: 'image' },
  { id: 'digital', label: 'Digital Design', desc: 'Banners, ads, email graphics', icon: '🖥️', type: 'image' },
  { id: 'social', label: 'Social Content', desc: 'Posts, stories, reels, carousels', icon: '📱', type: 'image' },
  { id: 'web', label: 'Website / App', desc: 'UI mockups, hero images, icons', icon: '🌐', type: 'image' },
  { id: 'video', label: 'Video Content', desc: 'Intros, ads, explainers, avatars', icon: '🎬', type: 'video' },
  { id: 'copy', label: 'Copywriting', desc: 'Headlines, captions, scripts, ads copy', icon: '✍️', type: 'text' },
];

const AI_TOOLS_LIST = [
  // Image — SDK
  { id: 'gpt-image', name: 'GPT Image', type: 'Image', desc: 'Sharp, detailed image generation', model: 'gpt-image-2', category: 'image', icon: '🎨' },
  { id: 'gemini-image', name: 'Gemini Image', type: 'Image', desc: 'Precise text rendering in images', model: 'gemini-3-pro-image-preview', category: 'image', icon: '✨' },
  { id: 'nanobanana', name: 'NanoBanana', type: 'Image', desc: '2K/4K high-quality AI visuals', model: 'gpt-image-2', category: 'image', icon: '🍌' },
  // Image — Flux native (fal.ai) — best for brand assets
  { id: 'flux-pro', name: 'Flux 1.1 Pro', type: 'Image', desc: 'Best quality — photorealistic brand assets', model: 'flux-pro', category: 'image', icon: '⚡' },
  { id: 'flux-pro-ultra', name: 'Flux Ultra', type: 'Image', desc: 'Highest resolution brand imagery', model: 'flux-pro-ultra', category: 'image', icon: '🌟' },
  { id: 'flux-pulid', name: 'Flux PuLID', type: 'Image', desc: 'Consistent face/avatar across all generated images', model: 'flux-pulid', category: 'image', icon: '👤' },
  // Image — External (copy+open)
  { id: 'midjourney', name: 'Midjourney', type: 'Image', desc: 'Artistic, cinematic image generation', model: '', category: 'image', icon: '🎭', external: true, url: 'https://www.midjourney.com/imagine' },
  // Video — SDK
  { id: 'wan-video', name: 'Wan Video', type: 'Video', desc: 'Text-to-video up to 15 seconds', model: 'wan2.6-t2v', category: 'video', icon: '🎬' },
  { id: 'veo-video', name: 'Veo 3.1', type: 'Video', desc: 'Cinematic AI video generation', model: 'veo-3.1-generate-001', category: 'video', icon: '🎥' },
  // Video — External
  { id: 'higgsfield', name: 'Higgsfield', type: 'Video', desc: 'Cinematic video & motion effects', model: '', category: 'video', icon: '🎞️', external: true, url: 'https://higgsfield.ai' },
  { id: 'heygen', name: 'HeyGen', type: 'Video', desc: 'AI avatar videos and presentations', model: '', category: 'video', icon: '👤', external: true, url: 'https://app.heygen.com' },
  // Copy / Text — via OpenRouter
  { id: 'claude-sonnet', name: 'Claude Sonnet 3.7', type: 'Copy', desc: 'Anthropic — balanced intelligence & speed', model: 'anthropic/claude-sonnet-4-5', category: 'text', icon: '🤖' },
  { id: 'gpt-text', name: 'GPT-4o', type: 'Copy', desc: 'OpenAI — versatile copy and scripts', model: 'openai/gpt-4o', category: 'text', icon: '📝' },
  { id: 'deepseek', name: 'DeepSeek V3', type: 'Copy', desc: 'Cost-effective bulk text generation', model: 'gemini-2.5-flash', category: 'text', icon: '🔮' },
  { id: 'gemini-text', name: 'Gemini Flash 2.0', type: 'Copy', desc: 'Google — fast and affordable', model: 'google/gemini-flash-1.5', category: 'text', icon: '✨' },
  // Audio
  { id: 'elevenlabs', name: 'ElevenLabs', type: 'Voice', desc: 'AI voiceover in 70+ languages', model: 'eleven_v3', category: 'audio', icon: '🎙️' },
];

const TEMPLATES: { id: number; title: string; desc: string; category: string; color: string; prompt: string }[] = [];

// ─── Parse brand DNA JSON safely ──────────────────────────────────────────────
function parseBrandDNA(brand: BrandProfile): BrandDNA | null {
  if (!brand.brand_dna) return null;
  try { return JSON.parse(brand.brand_dna); } catch { return null; }
}

// ─── Build rich brand context for text AI ─────────────────────────────────────
function buildBrandContext(brand: BrandProfile | null): string {
  if (!brand) return '';
  const dna = parseBrandDNA(brand);
  if (!dna) {
    const notes = brand.guidelines_notes?.replace(/^FIGMA_REF:.*$/m, '').trim();
    return [
      `Brand: ${brand.brand_name}`,
      brand.tagline && `Tagline: "${brand.tagline}"`,
      brand.industry && `Industry: ${brand.industry}`,
      brand.primary_color && `Primary Color: ${brand.primary_color}`,
      brand.secondary_color && `Secondary Color: ${brand.secondary_color}`,
      brand.accent_color && `Accent Color: ${brand.accent_color}`,
      brand.font_heading && `Heading Font: ${brand.font_heading}`,
      brand.font_body && `Body Font: ${brand.font_body}`,
      brand.tone_of_voice && `Tone: ${brand.tone_of_voice}`,
      notes && `Guidelines: ${notes}`,
    ].filter(Boolean).join('\n');
  }

  const img = dna.imagery_style;
  const dr = dna.design_rules;
  return [
    `BRAND: ${dna.brand_name || brand.brand_name}`,
    dna.tagline && `Tagline: "${dna.tagline}"`,
    dna.industry && `Industry: ${dna.industry}`,
    dna.brand_story && `Brand Story: ${dna.brand_story}`,
    dna.target_audience && `Target Audience: ${dna.target_audience}`,
    dna.brand_personality?.length && `Personality: ${dna.brand_personality.join(', ')}`,
    dna.brand_values?.length && `Values: ${dna.brand_values.join(', ')}`,
    dna.tone_of_voice && `Tone of Voice: ${dna.tone_of_voice}`,
    dna.writing_style && `Writing Style: ${dna.writing_style}`,
    '',
    'VISUAL IDENTITY:',
    (dna.colors?.primary || brand.primary_color) && `Primary Color: ${dna.colors?.primary || brand.primary_color}`,
    (dna.colors?.secondary || brand.secondary_color) && `Secondary Color: ${dna.colors?.secondary || brand.secondary_color}`,
    (dna.colors?.accent || brand.accent_color) && `Accent Color: ${dna.colors?.accent || brand.accent_color}`,
    dna.colors?.additional?.length && `Additional Colors: ${dna.colors.additional.join(', ')}`,
    (dna.typography?.heading_font || brand.font_heading) && `Heading Font: ${dna.typography?.heading_font || brand.font_heading}`,
    (dna.typography?.body_font || brand.font_body) && `Body Font: ${dna.typography?.body_font || brand.font_body}`,
    dna.typography?.type_rules && `Typography Rules: ${dna.typography.type_rules}`,
    dna.logo?.description && `Logo: ${dna.logo.description}`,
    dna.logo?.usage_rules && `Logo Usage: ${dna.logo.usage_rules}`,
    '',
    img && 'IMAGERY DIRECTION:',
    img?.photography_direction && `Photography Style: ${img.photography_direction}`,
    img?.subjects && `Image Subjects: ${img.subjects}`,
    img?.mood && `Mood: ${img.mood}`,
    img?.lighting && `Lighting: ${img.lighting}`,
    img?.composition && `Composition: ${img.composition}`,
    img?.color_treatment && `Color Treatment: ${img.color_treatment}`,
    img?.what_to_avoid && `Avoid in images: ${img.what_to_avoid}`,
    '',
    dr?.dos?.length && `Brand DOs: ${dr.dos.join(' | ')}`,
    dr?.donts?.length && `Brand DON'Ts: ${dr.donts.join(' | ')}`,
    dr?.layout_principles && `Layout: ${dr.layout_principles}`,
  ].filter((v) => v !== false && v !== null && v !== undefined && v !== '').join('\n');
}

// ─── Build Freepik-optimised image prompt ─────────────────────────────────────
function buildFreepikPrompt(userPrompt: string, brand: BrandProfile | null): string {
  if (!brand) return userPrompt;
  const dna = parseBrandDNA(brand);
  const img = dna?.imagery_style;
  const lines = [userPrompt.trim()];

  lines.push('');
  lines.push(`Brand: ${brand.brand_name}${brand.tagline ? ` — "${brand.tagline}"` : ''}`);

  if (dna?.brand_personality?.length) lines.push(`Brand personality: ${dna.brand_personality.join(', ')}`);
  if (dna?.tone_of_voice) lines.push(`Brand mood: ${dna.tone_of_voice}`);

  const pc = dna?.colors?.primary || brand.primary_color;
  const sc = dna?.colors?.secondary || brand.secondary_color;
  const ac = dna?.colors?.accent || brand.accent_color;
  const colorParts = [pc && `primary ${pc}`, sc && `secondary ${sc}`, ac && `accent ${ac}`].filter(Boolean);
  if (colorParts.length) lines.push(`Color palette: ${colorParts.join(', ')}`);

  if (img?.photography_direction) lines.push(`Photography style: ${img.photography_direction}`);
  if (img?.mood) lines.push(`Visual mood: ${img.mood}`);
  if (img?.lighting) lines.push(`Lighting: ${img.lighting}`);
  if (img?.subjects) lines.push(`Include: ${img.subjects}`);
  if (img?.color_treatment) lines.push(`Color treatment: ${img.color_treatment}`);
  if (img?.composition) lines.push(`Composition: ${img.composition}`);
  if (img?.what_to_avoid) lines.push(`AVOID: ${img.what_to_avoid}`);

  const donts = dna?.design_rules?.donts;
  if (donts?.length) lines.push(`Do not include: ${donts.join(', ')}`);

  lines.push('High quality, professional, on-brand.');
  return lines.filter(Boolean).join('\n');
}

// ─── Workspace / Prompt Hub ────────────────────────────────────────────────────
function PromptHubView() {
  const [searchParams] = useSearchParams();
  const [brands, setBrands] = useState<BrandProfile[]>([]);
  const [loadingBrands, setLoadingBrands] = useState(true);
  const [selectedBrand, setSelectedBrand] = useState<BrandProfile | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedTool, setSelectedTool] = useState('');
  const [prompt, setPrompt] = useState('');

  const [generating, setGenerating] = useState(false);
  const [resultImage, setResultImage] = useState('');
  const [resultText, setResultText] = useState('');
  const [resultVideo, setResultVideo] = useState('');
  const [copied, setCopied] = useState(false);
  const [referenceImage, setReferenceImage] = useState<string>('');
  const referenceInputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const handleReferenceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setReferenceImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    client.entities.brand_profiles
      .query({ query: {}, limit: 50 })
      .then((res) => {
        const items = (res?.data?.items as BrandProfile[]) || [];
        setBrands(items);
        // Pre-select brand from URL param, or default to first
        const urlBrand = searchParams.get('brand');
        const match = urlBrand ? items.find((b) => b.brand_name === decodeURIComponent(urlBrand)) : null;
        setSelectedBrand(match || items[0] || null);
      })
      .catch(() => setBrands([]))
      .finally(() => setLoadingBrands(false));
  }, []);

  // Pre-fill prompt from template URL param
  useEffect(() => {
    const templateId = searchParams.get('template');
    if (!templateId) return;
    const tmpl = TEMPLATES.find((t) => String(t.id) === templateId);
    if (!tmpl) return;
    const brandName = searchParams.get('brand') ? decodeURIComponent(searchParams.get('brand')!) : 'the brand';
    setPrompt(tmpl.prompt.replace('{brand}', brandName));
  }, []);

  const selectedToolInfo = AI_TOOLS_LIST.find((t) => t.id === selectedTool);
  const hasResult = !!(resultImage || resultText || resultVideo);

  const handleGenerate = async () => {
    if (!prompt.trim() || !selectedTool) return;
    const tool = AI_TOOLS_LIST.find((t) => t.id === selectedTool);
    if (!tool) return;

    // External tools — copy prompt and open
    if ((tool as any).external) {
      const fullPrompt = selectedBrand
        ? `${prompt}\n\nBrand Context:\n${buildBrandContext(selectedBrand)}`
        : prompt;
      await navigator.clipboard.writeText(fullPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Prompt copied! Opening tool…');
      window.open((tool as any).url, '_blank');
      return;
    }

    setGenerating(true);
    setResultImage('');
    setResultText('');
    setResultVideo('');

    const brandCtx = buildBrandContext(selectedBrand);
    const fullPrompt = brandCtx
      ? `${prompt}\n\nBrand Context:\n${brandCtx}`
      : prompt;

    const scrollToResult = () => {
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
    };

    try {
      if (tool.id === 'flux-pulid') {
        if (!referenceImage) {
          toast.error('Upload a reference photo first for avatar consistency');
          setGenerating(false);
          return;
        }
        const fluxPrompt = buildFreepikPrompt(prompt, selectedBrand);
        const res = await axios.post('/api/v1/aihub/genimg-pulid', {
          prompt: fluxPrompt,
          reference_image: referenceImage,
          size: 'square_hd',
        }, { timeout: 180000 });
        const url = res.data?.images?.[0] || '';
        if (!url) throw new Error('Image generation returned no result');
        setResultImage(url);
      } else if (tool.id === 'flux-pro' || tool.id === 'flux-pro-ultra') {
        const fluxPrompt = buildFreepikPrompt(prompt, selectedBrand);
        const res = await axios.post('/api/v1/aihub/genimg-flux', {
          prompt: fluxPrompt,
          size: 'square_hd',
          model: tool.model,
        }, { timeout: 120000 });
        const url = res.data?.images?.[0] || '';
        if (!url) throw new Error('Image generation returned no result');
        setResultImage(url);
      } else if (tool.category === 'image') {
        const res = await client.ai.genimg(
          { prompt: fullPrompt, model: tool.model || 'gpt-image-2', size: '1024x1024', quality: 'standard', n: 1 },
          { timeout: 600000 }
        );
        const url = res?.data?.images?.[0] || '';
        if (!url) throw new Error('Image generation returned no result');
        setResultImage(url);
      } else if (tool.category === 'text') {
        let accumulated = '';
        let scrolledOnce = false;
        await client.ai.gentxt({
          messages: [
            {
              role: 'system',
              content: 'You are a creative agency copywriter. Deliver production-ready creative copy based on the prompt and brand context provided.',
            },
            { role: 'user', content: fullPrompt },
          ],
          model: tool.model || 'gemini-2.5-flash',
          stream: true,
          onChunk: (chunk: any) => {
            accumulated += chunk.content || '';
            setResultText(accumulated);
            if (!scrolledOnce) { scrolledOnce = true; scrollToResult(); }
          },
          onComplete: () => {},
          onError: (err: any) => { toast.error(err?.message || 'Failed'); },
          timeout: 60000,
        });
        if (!accumulated) throw new Error('No text was generated');
      } else if (tool.category === 'video') {
        const res = await client.ai.genvideo(
          { prompt: fullPrompt, model: tool.model || 'wan2.6-t2v' },
          { timeout: 600000 }
        );
        const url = res?.data?.url || '';
        if (!url) throw new Error('Video generation returned no result');
        setResultVideo(url);
      }
      toast.success('Asset generated! Scroll down to view ↓');
      scrollToResult();
    } catch (err: any) {
      toast.error(err?.message || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyPrompt = async () => {
    const brandCtx = buildBrandContext(selectedBrand);
    const fullPrompt = brandCtx ? `${prompt}\n\nBrand Context:\n${brandCtx}` : prompt;
    await navigator.clipboard.writeText(fullPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Prompt copied to clipboard');
  };

  const useTemplate = (tmpl: typeof TEMPLATES[0]) => {
    const name = selectedBrand?.brand_name || 'the brand';
    setPrompt(tmpl.prompt.replace('{brand}', name));
  };

  return (
    <div className="min-h-full bg-[#f5f3ef] p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1e1e20]">Prompt Hub</h1>
        <p className="mt-1 text-sm text-[#595959]">
          Select brand, choose category and AI tool, then compose your prompt.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {/* Step 1 — Brand */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-500/20 text-xs font-bold text-violet-400">
                1
              </span>
              <h3 className="font-semibold text-[#1e1e20]">Select Brand</h3>
            </div>
            {loadingBrands ? (
              <div className="flex items-center gap-2 text-sm text-[#595959]">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading brands…
              </div>
            ) : brands.length === 0 ? (
              <div className="flex items-center gap-3 rounded-xl border border-dashed border-[#e2e2e2] bg-white p-4">
                <Building2 className="h-5 w-5 text-[#595959]" />
                <p className="text-sm text-[#595959]">
                  No brands yet.{' '}
                  <Link to="/brands" className="text-violet-400 hover:text-violet-300">
                    Add a brand profile →
                  </Link>
                </p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {brands.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setSelectedBrand(b)}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                      selectedBrand?.id === b.id
                        ? 'bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/50'
                        : 'bg-[#f5f3ef] text-[#595959] hover:bg-[#f5f3ef] hover:text-[#1e1e20]'
                    }`}
                  >
                    {[b.primary_color, b.secondary_color].filter(Boolean).map((c, i) => (
                      <span
                        key={i}
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                    {b.brand_name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Step 2 — Category */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-500/20 text-xs font-bold text-violet-400">
                2
              </span>
              <h3 className="font-semibold text-[#1e1e20]">Asset Category</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {ASSET_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-all ${
                    selectedCategory === cat.id
                      ? 'border-violet-500/50 bg-[#f0f0ff]'
                      : 'border-[#e2e2e2] bg-[#f5f3ef] hover:border-[#e2e2e2]'
                  }`}
                >
                  <span className="text-2xl">{cat.icon}</span>
                  <div>
                    <p className="font-medium text-[#1e1e20]">{cat.label}</p>
                    <p className="text-xs text-[#595959]">{cat.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Step 3 — AI Tool */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-500/20 text-xs font-bold text-violet-400">
                3
              </span>
              <h3 className="font-semibold text-[#1e1e20]">AI Tool</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {AI_TOOLS_LIST.map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => setSelectedTool(tool.id)}
                  className={`rounded-xl border p-4 text-left transition-all ${
                    selectedTool === tool.id
                      ? 'border-violet-500/50 bg-[#f0f0ff]'
                      : 'border-[#e2e2e2] bg-[#f5f3ef] hover:border-[#e2e2e2]'
                  }`}
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-lg">{tool.icon}</span>
                    <p className="font-medium text-[#1e1e20]">{tool.name}</p>
                    {(tool as any).external && (
                      <ExternalLink className="ml-auto h-3 w-3 text-[#595959]" />
                    )}
                  </div>
                  <p className="text-[11px] text-cyan-400">{tool.type}</p>
                  <p className="mt-1 text-xs text-[#595959]">{tool.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Step 4 — Compose */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-500/20 text-xs font-bold text-violet-400">
                4
              </span>
              <h3 className="font-semibold text-[#1e1e20]">Compose Prompt</h3>
            </div>
            <div className="rounded-xl border border-[#e2e2e2] bg-[#f5f3ef] p-4">
              {selectedBrand && (
                <div className="mb-3 flex items-center gap-2 rounded-lg bg-[#f0f0ff] px-3 py-2">
                  <Sparkles className="h-4 w-4 text-violet-400" />
                  <span className="text-xs text-violet-300">
                    Brand guidelines for{' '}
                    <strong>{selectedBrand.brand_name}</strong> will be auto-injected
                    {selectedToolInfo?.external ? ' (copied to clipboard)' : ''}.
                  </span>
                </div>
              )}
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe what you want to create… e.g. 'Create a social media banner for our summer campaign featuring the new product line, lifestyle feel, outdoor setting.'"
                className="mb-3 min-h-[120px] border-[#e2e2e2] bg-transparent text-[#1e1e20] placeholder:text-[#595959] focus:border-violet-500"
              />
              {/* PuLID reference photo upload — only visible when PuLID tool selected */}
              {selectedTool === 'flux-pulid' && (
                <div className="mb-3 rounded-lg border border-violet-500/30 bg-[#f5f3ef] p-3">
                  <p className="mb-2 text-xs font-medium text-violet-300">
                    Reference Photo — upload a face photo to keep the same person across all images
                  </p>
                  <div className="flex items-center gap-3">
                    <input
                      ref={referenceInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleReferenceUpload}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => referenceInputRef.current?.click()}
                      className="gap-2 border-violet-500/40 text-violet-300 hover:bg-[#f0f0ff]"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {referenceImage ? 'Change Photo' : 'Upload Photo'}
                    </Button>
                    {referenceImage && (
                      <div className="flex items-center gap-2">
                        <img src={referenceImage} alt="Reference" className="h-10 w-10 rounded-full object-cover border border-violet-500/40" />
                        <span className="text-xs text-violet-400">Reference set ✓</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-[#595959]">
                  Brand colors, typography and tone are automatically included.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyPrompt}
                    disabled={!prompt.trim()}
                    className="gap-1.5 text-xs text-[#595959] hover:text-[#1e1e20] hover:bg-[#f5f3ef]"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    Copy
                  </Button>
                  <Button
                    onClick={handleGenerate}
                    disabled={!prompt.trim() || !selectedTool || generating}
                    className="gap-2 bg-[#1e1e20] text-white hover:bg-[#2e2e30] disabled:opacity-50"
                  >
                    {generating ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
                    ) : selectedToolInfo?.external ? (
                      <><ExternalLink className="h-4 w-4" /> Copy & Open</>
                    ) : (
                      <><Send className="h-4 w-4" /> Generate</>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Result */}
          {hasResult && (
            <div ref={resultRef} className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6">
              <div className="mb-4 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-emerald-400" />
                <h2 className="text-lg font-semibold text-[#1e1e20]">Generated Asset</h2>
                {selectedBrand && (
                  <span className="ml-auto text-xs text-[#595959]">
                    {selectedBrand.brand_name}
                  </span>
                )}
              </div>

              {resultImage && (
                <div className="space-y-3">
                  <img
                    src={resultImage}
                    alt="Generated"
                    className="w-full rounded-lg border border-[#e2e2e2]"
                  />
                  <div className="flex gap-2">
                    <a href={resultImage} target="_blank" rel="noopener noreferrer">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 border-[#e2e2e2] text-[#1e1e20] hover:bg-[#f5f3ef]"
                      >
                        <Download className="h-4 w-4" /> Download
                      </Button>
                    </a>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setResultImage('');
                        handleGenerate();
                      }}
                      className="gap-2 border-[#e2e2e2] text-[#1e1e20] hover:bg-[#f5f3ef]"
                    >
                      <RefreshCw className="h-4 w-4" /> Regenerate
                    </Button>
                  </div>
                </div>
              )}

              {resultText && (
                <div className="rounded-lg border border-[#e2e2e2] bg-[#f5f3ef] p-4">
                  <pre className="whitespace-pre-wrap text-sm leading-relaxed text-[#1e1e20]">
                    {resultText}
                  </pre>
                </div>
              )}

              {resultVideo && (
                <div className="space-y-3">
                  <video src={resultVideo} controls className="w-full rounded-lg border border-[#e2e2e2]" />
                  <a href={resultVideo} target="_blank" rel="noopener noreferrer">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 border-[#e2e2e2] text-[#1e1e20] hover:bg-[#f5f3ef]"
                    >
                      <Download className="h-4 w-4" /> Download Video
                    </Button>
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar: brand context + templates */}
        <aside className="space-y-5">
          {/* Brand context preview */}
          {selectedBrand && (
            <div className="rounded-xl border border-violet-500/20 bg-[#f5f3ef] p-4">
              <h4 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-violet-300">
                <Building2 className="h-3 w-3" /> Brand Context
              </h4>
              <p className="mb-1 text-sm font-medium text-[#1e1e20]">{selectedBrand.brand_name}</p>
              {selectedBrand.tagline && (
                <p className="mb-2 text-xs italic text-[#595959]">"{selectedBrand.tagline}"</p>
              )}
              <div className="mb-2 flex gap-1.5">
                {[selectedBrand.primary_color, selectedBrand.secondary_color, selectedBrand.accent_color]
                  .filter(Boolean)
                  .map((c, i) => (
                    <div
                      key={i}
                      className="h-5 w-5 rounded-full border border-[#e2e2e2]"
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
              </div>
              {selectedBrand.tone_of_voice && (
                <p className="text-xs text-[#595959] line-clamp-3">{selectedBrand.tone_of_voice}</p>
              )}
            </div>
          )}

          {/* Quick templates */}
          <div className="rounded-xl border border-[#e2e2e2] bg-white p-4">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#595959]">
              Quick Templates
            </h4>
            <div className="space-y-2">
              {TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.id}
                  onClick={() => useTemplate(tmpl)}
                  className="group flex w-full items-center gap-3 rounded-lg border border-[#e2e2e2] bg-[#f5f3ef] p-3 text-left transition-all hover:border-[#e2e2e2] hover:bg-[#f5f3ef]"
                >
                  <div
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: tmpl.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-[#1e1e20]">{tmpl.title}</p>
                    <p className="truncate text-[10px] text-[#595959]">{tmpl.desc}</p>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                    style={{ backgroundColor: `${tmpl.color}15`, color: tmpl.color }}
                  >
                    {tmpl.category}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ─── AI Workspace / Chat ───────────────────────────────────────────────────────
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
  imageLoading?: boolean;
}

const IMAGE_MODELS = [
  { id: 'gpt-image-2', label: 'GPT Image' },
  { id: 'gemini-3-pro-image-preview', label: 'Gemini Image' },
];

function ChatView() {
  const [brands, setBrands] = useState<BrandProfile[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<BrandProfile | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
  const [imageMode, setImageMode] = useState(false);
  const [imageModel, setImageModel] = useState('gpt-image-2');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    client.entities.brand_profiles
      .query({ query: {}, limit: 50 })
      .then((res) => {
        const items = (res?.data?.items as BrandProfile[]) || [];
        setBrands(items);
        if (items.length > 0) setSelectedBrand(items[0]);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const userMsg = input.trim();
    setInput('');
    setSending(true);

    const brandCtx = buildBrandContext(selectedBrand);
    const systemPrompt = selectedBrand
      ? `You are an expert creative agency AI working with the ${selectedBrand.brand_name} brand. Use the following brand guidelines for all creative suggestions:\n\n${brandCtx}\n\nDeliver creative, on-brand output.`
      : 'You are an expert creative agency AI. Help design, write, and create marketing assets.';

    const history = messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    const fullPrompt = brandCtx ? `${userMsg}\n\nBrand Context:\n${brandCtx}` : userMsg;

    // Build initial messages list with text placeholder + optional image placeholder
    const newMsgs: ChatMessage[] = [
      ...messages,
      { role: 'user', content: userMsg },
      { role: 'assistant', content: '' },
      ...(imageMode ? [{ role: 'assistant' as const, content: '', imageLoading: true }] : []),
    ];
    setMessages(newMsgs);

    const textIdx = imageMode ? newMsgs.length - 2 : newMsgs.length - 1;
    const imageIdx = imageMode ? newMsgs.length - 1 : -1;

    // Text generation
    const textPromise = client.ai.gentxt({
      messages: [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: userMsg },
      ],
      model: selectedModel,
      stream: true,
      onChunk: (chunk: any) => {
        setMessages((prev) => {
          const updated = [...prev];
          updated[textIdx] = {
            role: 'assistant',
            content: (updated[textIdx]?.content || '') + (chunk.content || ''),
          };
          return updated;
        });
      },
      onComplete: () => {},
      onError: (err: any) => { toast.error(err?.message || 'Failed to get response'); },
      timeout: 120000,
    }).catch((err: any) => { toast.error(err?.message || 'Chat failed'); });

    // Image generation (parallel)
    const imagePromise = imageMode
      ? client.ai.genimg(
          { prompt: fullPrompt, model: imageModel, size: '1024x1024', quality: 'standard', n: 1 },
          { timeout: 600000 },
        )
          .then((res: any) => {
            const url = res?.data?.images?.[0] || '';
            setMessages((prev) => {
              const updated = [...prev];
              updated[imageIdx] = { role: 'assistant', content: '', imageUrl: url, imageLoading: false };
              return updated;
            });
          })
          .catch(() => {
            setMessages((prev) => {
              const updated = [...prev];
              updated[imageIdx] = { role: 'assistant', content: 'Image generation failed.', imageLoading: false };
              return updated;
            });
          })
      : Promise.resolve();

    await Promise.all([textPromise, imagePromise]);
    setSending(false);
  };

  const MODELS = [
    { id: 'gemini-2.5-flash', label: 'DeepSeek V3' },
    { id: 'openai/gpt-4o', label: 'GPT-4o' },
    { id: 'anthropic/claude-sonnet-4-5', label: 'Claude Sonnet' },
    { id: 'google/gemini-flash-1.5', label: 'Gemini Flash' },
  ];

  return (
    <div className="flex h-full flex-col p-6 lg:p-8">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1e1e20]">AI Workspace</h1>
          <p className="mt-1 text-sm text-[#595959]">Chat with AI — brand guidelines are always active.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Brand selector */}
          <div className="flex flex-wrap gap-1.5">
            {brands.map((b) => (
              <button
                key={b.id}
                onClick={() => setSelectedBrand(b)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                  selectedBrand?.id === b.id
                    ? 'bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/40'
                    : 'bg-[#f5f3ef] text-[#595959] hover:bg-[#f5f3ef] hover:text-[#1e1e20]'
                }`}
              >
                {b.brand_name}
              </button>
            ))}
          </div>
          {/* Text model */}
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="rounded-lg border border-[#e2e2e2] bg-[#f5f3ef] px-2 py-1 text-xs text-[#1e1e20]"
          >
            {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
          {/* Image mode toggle */}
          <button
            onClick={() => setImageMode((v) => !v)}
            title="Generate an image alongside every response"
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
              imageMode
                ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-300'
                : 'border-[#e2e2e2] bg-[#f5f3ef] text-[#595959] hover:border-[#e2e2e2] hover:text-[#1e1e20]'
            }`}
          >
            <ImageIcon className="h-3.5 w-3.5" />
            {imageMode ? 'Image On' : 'Image Off'}
          </button>
          {/* Image model selector (visible only when imageMode is on) */}
          {imageMode && (
            <select
              value={imageModel}
              onChange={(e) => setImageModel(e.target.value)}
              className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-300"
            >
              {IMAGE_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Brand context banner */}
      {selectedBrand && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-violet-500/20 bg-[#f0f0ff] px-3 py-2">
          <Sparkles className="h-4 w-4 text-violet-400" />
          <span className="text-xs text-violet-300">
            Working with <strong>{selectedBrand.brand_name}</strong> brand guidelines
          </span>
          {imageMode && (
            <span className="ml-auto flex items-center gap-1 text-xs text-cyan-400">
              <ImageIcon className="h-3 w-3" />
              Image generation active
            </span>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto rounded-xl border border-[#e2e2e2] bg-white p-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <MessageSquare className="mb-4 h-12 w-12 text-[#8c8c8c]" />
            <h3 className="mb-2 text-lg font-semibold text-[#1e1e20]">Start a conversation</h3>
            <p className="max-w-md text-sm text-[#595959]">
              Ask for creative concepts, copy, campaign ideas, or turn on{' '}
              <span className="text-cyan-400">Image mode</span> to generate visuals alongside every response.
              {selectedBrand && ` Brand context for ${selectedBrand.brand_name} is active.`}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {/* Image message */}
                {msg.role === 'assistant' && (msg.imageLoading || msg.imageUrl) ? (
                  <div className="max-w-[85%] space-y-2">
                    {msg.imageLoading ? (
                      <div className="flex items-center gap-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3">
                        <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                        <span className="text-xs text-cyan-300">Generating image…</span>
                      </div>
                    ) : msg.imageUrl ? (
                      <div className="rounded-xl border border-[#e2e2e2] overflow-hidden">
                        <img
                          src={msg.imageUrl}
                          alt="Generated"
                          className="w-full max-w-sm rounded-xl"
                        />
                        <div className="flex gap-2 bg-[#f5f3ef] p-2">
                          <a href={msg.imageUrl} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-[11px] text-[#595959] hover:text-[#1e1e20]">
                              <Download className="h-3 w-3" /> Download
                            </Button>
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-[#e2e2e2] bg-[#f5f3ef] px-4 py-3 text-xs text-red-400">
                        {msg.content}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Text message */
                  <div
                    className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-violet-500/20 text-violet-100'
                        : 'border border-[#e2e2e2] bg-[#f5f3ef] text-[#1e1e20]'
                    }`}
                  >
                    <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>
                    {msg.role === 'assistant' && !msg.content && !msg.imageUrl && !msg.imageLoading && (
                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
                    )}
                  </div>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="mt-4 flex gap-3">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
          }}
          placeholder={
            imageMode
              ? 'Describe what you want — AI will respond and generate an image… (Enter to send)'
              : 'Ask anything about your creative project… (Enter to send, Shift+Enter for new line)'
          }
          className="min-h-[48px] flex-1 resize-none border-[#e2e2e2] bg-[#f5f3ef] text-[#1e1e20] placeholder:text-[#595959]"
          rows={2}
        />
        <Button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="h-auto shrink-0 bg-gradient-to-r from-violet-600 to-cyan-600 px-4 text-[#1e1e20] hover:from-violet-500 hover:to-cyan-500 disabled:opacity-50"
        >
          {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        </Button>
      </div>
    </div>
  );
}

// ─── Asset Gallery ─────────────────────────────────────────────────────────────
function GalleryView() {
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.entities.briefs
      .query({ query: {}, sort: '-updated_at', limit: 100 })
      .then((res) => {
        const all = (res?.data?.items as Brief[]) || [];
        setBriefs(all.filter((b) => b.generated_asset_url));
      })
      .catch(() => setBriefs([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-full bg-[#f5f3ef] p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1e1e20]">Asset Gallery</h1>
          <p className="mt-1 text-sm text-[#595959]">All generated assets from your briefs.</p>
        </div>
        <Link to="/briefs/new">
          <Button className="gap-2 bg-gradient-to-r from-violet-600 to-cyan-600 text-[#1e1e20]">
            <Plus className="h-4 w-4" /> New Brief
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
        </div>
      ) : briefs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#e2e2e2] bg-white py-20">
          <ImageIcon className="mb-4 h-14 w-14 text-[#8c8c8c]" />
          <h3 className="mb-2 text-lg font-semibold text-[#1e1e20]">No assets yet</h3>
          <p className="mb-6 max-w-sm text-center text-sm text-[#595959]">
            Generated images and videos from your briefs will appear here. Create a brief and generate an asset to get started.
          </p>
          <Link to="/briefs/new">
            <Button className="gap-2 bg-gradient-to-r from-violet-600 to-cyan-600 text-[#1e1e20]">
              <Plus className="h-4 w-4" /> Create Brief
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {briefs.map((brief) => (
            <Link
              key={brief.id}
              to={`/briefs/${brief.id}`}
              className="group overflow-hidden rounded-xl border border-[#e2e2e2] bg-white transition-all hover:border-[#e2e2e2] hover:-translate-y-0.5"
            >
              <div className="relative h-44 overflow-hidden bg-gradient-to-br from-white/5 to-white/10">
                {brief.generated_asset_url.startsWith('http') && (
                  <img
                    src={brief.generated_asset_url}
                    alt={brief.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#13131a]/80 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="absolute bottom-2 right-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="rounded-full bg-[#f5f3ef] px-2 py-0.5 text-[10px] text-[#1e1e20] backdrop-blur-sm">
                    View Brief
                  </span>
                </div>
              </div>
              <div className="p-3">
                <p className="truncate text-sm font-medium text-[#1e1e20]">{brief.title}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="truncate text-xs text-[#595959]">{brief.brand_name}</span>
                  <span className="text-[#8c8c8c]">·</span>
                  <span className="text-xs text-[#595959]">{brief.brief_type}</span>
                  {brief.ai_tool && (
                    <>
                      <span className="text-[#8c8c8c]">·</span>
                      <span className="text-xs text-[#595959]">{brief.ai_tool}</span>
                    </>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Templates ────────────────────────────────────────────────────────────────
function TemplatesView() {
  const [brands, setBrands] = useState<BrandProfile[]>([]);
  const [selectedBrand, setSelectedBrand] = useState('');

  useEffect(() => {
    client.entities.brand_profiles
      .query({ query: {}, limit: 50 })
      .then((res) => {
        const items = (res?.data?.items as BrandProfile[]) || [];
        setBrands(items);
        if (items.length > 0) setSelectedBrand(items[0].brand_name);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-full bg-[#f5f3ef] p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1e1e20]">Templates</h1>
        <p className="mt-1 text-sm text-[#595959]">
          Pre-built prompt templates. Select a brand and click a template to use it in the Prompt Hub.
        </p>
      </div>

      {brands.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          <p className="flex items-center text-sm text-[#595959]">Apply to:</p>
          {brands.map((b) => (
            <button
              key={b.id}
              onClick={() => setSelectedBrand(b.brand_name)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                selectedBrand === b.brand_name
                  ? 'bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/40'
                  : 'bg-[#f5f3ef] text-[#595959] hover:bg-[#f5f3ef] hover:text-[#1e1e20]'
              }`}
            >
              {b.brand_name}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TEMPLATES.map((tmpl) => (
          <Link
            key={tmpl.id}
            to={`/workspace?template=${tmpl.id}&brand=${encodeURIComponent(selectedBrand)}`}
            className="group rounded-xl border border-[#e2e2e2] bg-white p-5 transition-all hover:border-[#e2e2e2] hover:-translate-y-0.5"
          >
            <div
              className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${tmpl.color}15` }}
            >
              <FileStack className="h-5 w-5" style={{ color: tmpl.color }} />
            </div>
            <h3 className="font-semibold text-[#1e1e20]">{tmpl.title}</h3>
            <p className="mt-1 text-xs text-[#595959]">{tmpl.desc}</p>
            <div className="mt-3 flex items-center justify-between">
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{ backgroundColor: `${tmpl.color}15`, color: tmpl.color }}
              >
                {tmpl.category}
              </span>
              <span className="text-xs text-violet-400 opacity-0 transition-opacity group-hover:opacity-100">
                Use template →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function WorkspacePage() {
  const location = useLocation();
  const path = location.pathname;

  if (path === '/workspace') return <SidebarLayout><PromptHubView /></SidebarLayout>;
  if (path === '/chat') return <SidebarLayout><ChatView /></SidebarLayout>;
  if (path === '/gallery') return <SidebarLayout><GalleryView /></SidebarLayout>;
  if (path === '/templates') return <SidebarLayout><TemplatesView /></SidebarLayout>;

  return null;
}
