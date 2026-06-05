import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@metagptx/web-sdk';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Sparkles, X, Send, Loader2, Building2, Download, Bookmark,
  ChevronDown, Image as ImageIcon,
} from 'lucide-react';
import { type BrandProfile } from '@/lib/briefTypes';

const mgxClient = createClient();

// ─── Types ─────────────────────────────────────────────────────────────────────

interface FloatingMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  images?: string[];
  imagePrompts?: string[];
  generating?: boolean;
  savedImages?: Set<number>;
  productRefUsed?: string; // name of product reference injected during generation
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function genId(): string {
  return Date.now().toString() + Math.random().toString(36).slice(2);
}

function buildLocalBrandContext(brand: BrandProfile): string {
  let dna: Record<string, unknown> = {};
  try { dna = JSON.parse((brand as Record<string, unknown>).brand_dna as string ?? '{}'); } catch { /* no dna */ }
  const lines: string[] = [`Brand: ${brand.brand_name}`];
  if (brand.industry)         lines.push(`Industry: ${brand.industry}`);
  if (brand.tagline)          lines.push(`Tagline: ${brand.tagline}`);
  if (brand.primary_color)    lines.push(`Primary color: ${brand.primary_color}`);
  if (brand.secondary_color)  lines.push(`Secondary color: ${brand.secondary_color}`);
  if (brand.tone_of_voice)    lines.push(`Tone: ${brand.tone_of_voice}`);
  for (const [k, v] of Object.entries(dna)) {
    if (typeof v === 'string' && v) lines.push(`${k}: ${v}`);
    else if (Array.isArray(v) && v.length) lines.push(`${k}: ${(v as string[]).join(', ')}`);
  }
  return lines.join('\n');
}

function buildSystemPrompt(brand: BrandProfile): string {
  let dna: Record<string, unknown> = {};
  try { dna = JSON.parse((brand as Record<string, unknown>).brand_dna as string ?? '{}'); } catch { /* no dna */ }

  const s = (key: string): string | null => {
    const v = dna[key] ?? (brand as Record<string, unknown>)[key];
    return typeof v === 'string' && v.trim() ? v.trim() : null;
  };
  const a = (key: string): string[] => Array.isArray(dna[key]) ? (dna[key] as string[]) : [];

  const dnaLines: string[] = [];
  if (s('tagline'))               dnaLines.push(`Tagline: "${s('tagline')}"`);
  if (brand.industry)             dnaLines.push(`Industry: ${brand.industry}`);
  const story = s('brand_story') || s('mission');
  if (story)                      dnaLines.push(`Brand story: ${story}`);
  const products = s('brand_products') || s('usp');
  if (products)                   dnaLines.push(`Products/USP: ${products}`);
  const personality = a('brand_personality');
  if (personality.length)         dnaLines.push(`Personality: ${personality.join(', ')}`);
  const values = a('brand_values');
  if (values.length)              dnaLines.push(`Values: ${values.join(', ')}`);
  if (s('target_audience'))       dnaLines.push(`Target audience: ${s('target_audience')}`);
  const tone = s('tone_of_voice') ?? brand.tone_of_voice;
  if (tone)                       dnaLines.push(`Tone: ${tone}`);
  if (brand.primary_color)        dnaLines.push(`Primary colour: ${brand.primary_color}`);
  if (brand.secondary_color)      dnaLines.push(`Secondary colour: ${brand.secondary_color}`);
  if (brand.accent_color)         dnaLines.push(`Accent colour: ${brand.accent_color}`);
  const fh = brand.font_heading || s('font_heading');
  const fb = brand.font_body    || s('font_body');
  if (fh) dnaLines.push(`Heading font: ${fh}`);
  if (fb) dnaLines.push(`Body font: ${fb}`);
  if (s('visual_style'))          dnaLines.push(`Visual style: ${s('visual_style')}`);
  if (s('photography_style'))     dnaLines.push(`Photography: ${s('photography_style')}`);
  if (s('logo_usage'))            dnaLines.push(`Logo rules: ${s('logo_usage')}`);
  const dos   = a('do_say');
  const donts = a('dont_say');
  if (dos.length)   dnaLines.push(`Brand DOs: ${dos.slice(0, 4).join(' | ')}`);
  if (donts.length) dnaLines.push(`Brand DON'Ts: ${donts.slice(0, 4).join(' | ')}`);
  const notes = brand.guidelines_notes || s('extra_notes');
  if (notes && notes.trim().length > 20) dnaLines.push(`\nAdditional guidelines:\n${notes.slice(0, 1200)}`);

  return [
    `You are a brand-aware creative AI for ${brand.brand_name}.`,
    ``,
    `=== ${brand.brand_name.toUpperCase()} BRAND DNA ===`,
    ...dnaLines,
    `=== END BRAND DNA ===`,
    ``,
    `CRITICAL RULE: When the user asks you to CREATE or GENERATE any images, visuals, social media posts, banners, or other visual content — you MUST include image prompts at the END of your response using this exact format:`,
    ``,
    `[IMAGE_PROMPTS]`,
    `<detailed prompt 1 for AI image generation — include brand colors, visual style, mood, composition>|||<prompt 2>|||<prompt 3>`,
    `[/IMAGE_PROMPTS]`,
    ``,
    `Rules for image prompts:`,
    `- Each must be a complete, detailed AI image generation prompt`,
    `- Include brand hex colors (e.g. "deep brown #502C12 as dominant color")`,
    `- Include visual style, mood, lighting, composition`,
    `- Be specific and production-ready`,
    `- Number of prompts = number the user requested (default 3 if unspecified, max 6)`,
    ``,
    `For everything else (questions, advice, copywriting), respond normally in markdown.`,
  ].join('\n');
}

// ── Product reference auto-detection ────────────────────────────────────────────

interface ProductRef { name: string; url: string; }

function getProductRefs(brand: BrandProfile): ProductRef[] {
  try {
    const dna = JSON.parse((brand as any).brand_dna ?? '{}');
    return Array.isArray(dna.product_references) ? dna.product_references : [];
  } catch { return []; }
}

const PRODUCT_KEYWORDS = [
  'bike', 'bicycle', 'cycle', 'helmet', 'rider', 'kit', 'gear',
  'product', 'e-bike', 'ebike', 'handlebar', 'frame', 'wheel',
];

function detectProductRef(prompt: string, brand: BrandProfile): ProductRef | null {
  const refs = getProductRefs(brand);
  if (refs.length === 0) return null;
  const lower = prompt.toLowerCase();
  const hasProductKeyword = PRODUCT_KEYWORDS.some(k => lower.includes(k));
  if (!hasProductKeyword) return null;
  // Try to match a specific product by name first
  const named = refs.find(r => lower.includes(r.name.toLowerCase()));
  return named ?? refs[0]; // fallback to first product
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

async function generateImages(
  prompts: string[],
  brand: BrandProfile,
  onRefDetected?: (ref: ProductRef | null) => void,
): Promise<string[]> {
  const brandContext = buildLocalBrandContext(brand);
  const combinedPrompt = prompts.join(' ');

  // Prefer trained LoRA over img2img reference
  const lora = getLoraInfo(brand);
  if (lora) {
    onRefDetected?.(null); // LoRA used — no img2img reference needed
    const results = await Promise.all(
      prompts.map((p) => {
        // Prepend trigger word so LoRA activates
        const promptWithTrigger = lora.triggerWord ? `${lora.triggerWord} ${p}` : p;
        return axios.post('/api/v1/aihub/genimg-lora', {
          prompt: promptWithTrigger,
          lora_url: lora.loraUrl,
          size: 'square_hd',
        }, { timeout: 180000 })
          .then((r) => (r.data?.images?.[0] ?? '') as string)
          .catch(() => '' as string);
      })
    );
    return results.filter(Boolean);
  }

  // Fall back to img2img with product reference photo
  const productRef = detectProductRef(combinedPrompt, brand);
  onRefDetected?.(productRef);

  const results = await Promise.all(
    prompts.map((p) =>
      axios.post('/api/v1/aihub/genimg', {
        prompt: p,
        brand_context: brandContext,
        image: productRef?.url ?? undefined,
        model: 'gemini-3-pro-image',
        size: '1:1',
        quality: 'hd',
        n: 1,
      }, { timeout: 180000 })
        .then((r) => (r.data?.images?.[0] ?? '') as string)
        .catch(() => '' as string)
    )
  );
  return results.filter(Boolean);
}

async function saveImageToGallery(imageUrl: string, prompt: string, brand: BrandProfile): Promise<void> {
  await axios.post('/api/v1/entities/assets', {
    user_id: '1219947',
    brand_id: brand.id ?? null,
    brand_name: brand.brand_name,
    title: prompt.slice(0, 80),
    asset_type: 'image',
    content_type: 'social',
    ai_tool: 'Claude + Gemini',
    url: imageUrl,
    prompt,
  });
}

function parseImagePrompts(content: string): { cleanContent: string; prompts: string[] } {
  const match = /\[IMAGE_PROMPTS\]([\s\S]*?)\[\/IMAGE_PROMPTS\]/i.exec(content);
  if (!match) return { cleanContent: content, prompts: [] };
  const raw = match[1].trim();
  const prompts = raw.split('|||').map((p) => p.trim()).filter(Boolean);
  const cleanContent = content.replace(/\[IMAGE_PROMPTS\][\s\S]*?\[\/IMAGE_PROMPTS\]/gi, '').trim();
  return { cleanContent, prompts };
}

function welcomeMessage(brandName: string): FloatingMessage {
  return {
    id: genId(),
    role: 'assistant',
    content: `Hi! I'm Claude, your brand AI for **${brandName}**.\n\nI can help you:\n- Answer questions about your brand\n- Write copy, captions, and scripts\n- **Generate image batches** — just say "create 5 social media posts" and I'll generate them using your brand DNA\n\nWhat would you like to create?`,
  };
}

// ─── Image Card ─────────────────────────────────────────────────────────────────

function ImageCard({
  url,
  prompt,
  saved,
  onSave,
}: {
  url: string;
  prompt: string;
  saved: boolean;
  onSave: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="relative rounded-xl overflow-hidden bg-[#2d2d30] aspect-square"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <img src={url} alt={prompt} className="w-full h-full object-cover" />
      {hovered && (
        <div className="absolute inset-0 bg-black/50 flex items-end justify-center gap-2 p-2">
          <button
            onClick={async (e) => {
              e.stopPropagation();
              try {
                const res = await fetch(url);
                const blob = await res.blob();
                const blobUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = `shelby-${Date.now()}.jpg`;
                a.click();
                URL.revokeObjectURL(blobUrl);
              } catch {
                window.open(url, '_blank');
              }
            }}
            className="flex items-center gap-1.5 bg-white text-[#1e1e20] text-[12px] font-medium rounded-lg px-2.5 py-1.5 hover:bg-white/90 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </button>
          <button
            onClick={onSave}
            disabled={saved}
            className={`flex items-center gap-1.5 text-[12px] font-medium rounded-lg px-2.5 py-1.5 transition-colors ${
              saved
                ? 'bg-white/20 text-white cursor-default'
                : 'bg-white/10 text-white hover:bg-white/20 cursor-pointer'
            }`}
            title={saved ? 'Saved' : 'Save to gallery'}
          >
            <Bookmark className={`h-3.5 w-3.5 ${saved ? 'fill-white' : ''}`} />
            {saved ? 'Saved' : 'Save'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Message Bubble ─────────────────────────────────────────────────────────────

function MessageBubble({
  message,
  brand,
  onSaveImage,
}: {
  message: FloatingMessage;
  brand: BrandProfile | null;
  onSaveImage: (msgId: string, imgIndex: number, url: string, prompt: string) => void;
}) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="bg-[rgba(255,255,255,0.1)] text-white rounded-2xl px-4 py-2.5 text-[14px] self-end max-w-[85%] whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="self-start max-w-[90%] space-y-2">
        {/* Spinner while generating */}
        {message.generating && !message.content && !message.images && (
          <div className="bg-[#2d2d30] text-white/90 rounded-2xl px-4 py-2.5 text-[14px] flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-white/50" />
            <span className="text-white/50 text-[13px]">Thinking…</span>
          </div>
        )}

        {/* Text content */}
        {message.content && (
          <div className="bg-[#2d2d30] text-white/90 rounded-2xl px-4 py-2.5 text-[14px] whitespace-pre-wrap">
            {message.content}
          </div>
        )}

        {/* Image generation status */}
        {message.generating && message.content && !message.images && (
          <div className="bg-[#2d2d30] text-white/90 rounded-2xl px-4 py-2.5 text-[14px] flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-white/50" />
            <span className="text-white/50 text-[13px]">
              Generating {message.imagePrompts?.length ?? 0} image{(message.imagePrompts?.length ?? 0) !== 1 ? 's' : ''}…
            </span>
          </div>
        )}

        {/* Generation method badge */}
        {message.images && brand && getLoraInfo(brand) && (
          <div className="flex items-center gap-1.5 px-1">
            <div className="h-1.5 w-1.5 rounded-full bg-violet-400" />
            <span className="text-[11px] text-white/40">
              Generated with <span className="text-violet-400 font-medium">custom AI model</span> — brand-specific products
            </span>
          </div>
        )}
        {message.images && brand && !getLoraInfo(brand) && message.productRefUsed && (
          <div className="flex items-center gap-1.5 px-1">
            <div className="h-1.5 w-1.5 rounded-full bg-green-400" />
            <span className="text-[11px] text-white/40">
              Product reference used: <span className="text-white/60 font-medium">{message.productRefUsed}</span>
            </span>
          </div>
        )}
        {message.images && brand && !getLoraInfo(brand) && !message.productRefUsed && getProductRefs(brand).length === 0 && (
          <div className="flex items-center gap-1.5 px-1">
            <div className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
            <span className="text-[11px] text-white/40">
              Upload product photos + Train AI Model for brand-accurate images
            </span>
          </div>
        )}

        {/* Image grid */}
        {message.images && message.images.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {message.images.map((url, idx) => (
              <ImageCard
                key={idx}
                url={url}
                prompt={message.imagePrompts?.[idx] ?? ''}
                saved={message.savedImages?.has(idx) ?? false}
                onSave={() =>
                  brand &&
                  onSaveImage(message.id, idx, url, message.imagePrompts?.[idx] ?? '')
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Widget ────────────────────────────────────────────────────────────────

export default function FloatingClaudeChat() {
  const [open, setOpen] = useState(false);
  const [brands, setBrands] = useState<BrandProfile[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<BrandProfile | null>(null);
  const [messages, setMessages] = useState<FloatingMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load brands once on mount
  useEffect(() => {
    mgxClient.entities.brand_profiles
      .query({ query: {}, limit: 50 })
      .then((res) => {
        const items = (res?.data?.items as BrandProfile[]) ?? [];
        setBrands(items);
        if (items.length > 0) setSelectedBrand(items[0]);
      })
      .catch(() => setBrands([]));
  }, []);

  // Show welcome message when panel opens with a brand
  useEffect(() => {
    if (open && selectedBrand && messages.length === 0) {
      setMessages([welcomeMessage(selectedBrand.brand_name)]);
    }
  }, [open, selectedBrand]); // intentionally excludes messages to not re-trigger

  // Reset and show welcome when brand changes (only if chat is open and has prior messages)
  const handleBrandChange = (brandId: string) => {
    const brand = brands.find((b) => b.id === Number(brandId));
    if (!brand) return;
    setSelectedBrand(brand);
    setMessages([welcomeMessage(brand.brand_name)]);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const adjustTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 100)}px`;
  };

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending || !selectedBrand) return;

    const userMsg: FloatingMessage = {
      id: genId(),
      role: 'user',
      content: text,
    };

    const assistantId = genId();
    const assistantMsg: FloatingMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      generating: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setSending(true);

    // Build conversation history (exclude generating placeholders)
    const history = messages
      .filter((m) => !m.generating && m.content)
      .slice(-10)
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    const systemPrompt = buildSystemPrompt(selectedBrand);

    try {
      let accumulated = '';

      await mgxClient.ai.gentxt({
        messages: [
          { role: 'system', content: systemPrompt },
          ...history,
          { role: 'user', content: text },
        ],
        model: 'gemini-2.5-flash',
        stream: true,
        onChunk: (chunk: { content?: string }) => {
          accumulated += chunk.content ?? '';
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: accumulated } : m
            )
          );
        },
        onComplete: async () => {
          const { cleanContent, prompts } = parseImagePrompts(accumulated);

          if (prompts.length === 0) {
            // Plain text response — mark done
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: cleanContent, generating: false }
                  : m
              )
            );
            setSending(false);
            return;
          }

          // Has image prompts — update content, keep generating flag, store prompts
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: cleanContent, imagePrompts: prompts, generating: true }
                : m
            )
          );

          try {
            const brand = selectedBrand;
            let detectedRefName: string | undefined;
            const urls = await generateImages(prompts, brand, (ref) => {
              detectedRefName = ref?.name;
            });
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, images: urls, generating: false, productRefUsed: detectedRefName }
                  : m
              )
            );
          } catch {
            toast.error('Image generation failed — please try again.');
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, generating: false }
                  : m
              )
            );
          } finally {
            setSending(false);
          }
        },
        onError: () => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: 'Something went wrong — please try again.', generating: false }
                : m
            )
          );
          setSending(false);
        },
        timeout: 60000,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.';
      toast.error(msg);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: 'Something went wrong — please try again.', generating: false }
            : m
        )
      );
      setSending(false);
    }
  }, [input, sending, selectedBrand, messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSaveImage = async (
    msgId: string,
    imgIndex: number,
    url: string,
    prompt: string
  ) => {
    if (!selectedBrand) return;
    try {
      await saveImageToGallery(url, prompt, selectedBrand);
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== msgId) return m;
          const savedImages = new Set(m.savedImages ?? []);
          savedImages.add(imgIndex);
          return { ...m, savedImages };
        })
      );
      toast.success('Saved to gallery!');
    } catch {
      toast.error('Failed to save — please try again.');
    }
  };

  const handleOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <>
      {/* Floating button (hidden when panel open) */}
      {!open && (
        <button
          onClick={handleOpen}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-[#1e1e20] text-white rounded-full px-4 py-3 shadow-xl hover:bg-[#2d2d30] transition-all"
        >
          <Sparkles className="h-4 w-4" />
          <span className="text-[14px] font-medium">Claude</span>
        </button>
      )}

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/20 z-40"
          onClick={handleClose}
        />
      )}

      {/* Side panel */}
      {open && (
        <div className="fixed right-0 top-0 bottom-0 z-50 w-[420px] flex flex-col bg-[#1e1e20] shadow-2xl">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 flex-shrink-0">
            {/* Left: title */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Sparkles className="h-4 w-4 text-white/70" />
              <span className="text-[15px] font-semibold text-white">Claude</span>
            </div>

            {/* Center: brand selector */}
            <div className="flex-1 flex items-center justify-center">
              {brands.length > 0 ? (
                <div className="relative flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-white/40 flex-shrink-0" />
                  <select
                    value={selectedBrand?.id ?? ''}
                    onChange={(e) => handleBrandChange(e.target.value)}
                    className="bg-[rgba(255,255,255,0.08)] border border-white/10 rounded-lg pl-2 pr-6 py-1.5 text-white text-[13px] outline-none cursor-pointer appearance-none"
                    style={{ minWidth: 0, maxWidth: 160 }}
                  >
                    {brands.map((b) => (
                      <option
                        key={b.id}
                        value={b.id}
                        style={{ backgroundColor: '#1e1e20', color: '#fff' }}
                      >
                        {b.brand_name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="h-3 w-3 text-white/40 absolute right-1.5 pointer-events-none" />
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-white/40 text-[13px]">
                  <ImageIcon className="h-3.5 w-3.5" />
                  No brands
                </div>
              )}
            </div>

            {/* Right: close */}
            <button
              onClick={handleClose}
              className="flex-shrink-0 text-white/50 hover:text-white transition-colors p-1"
              title="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#1e1e20]">
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                brand={selectedBrand}
                onSaveImage={handleSaveImage}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="border-t border-white/10 p-3 flex gap-2 flex-shrink-0 bg-[#1e1e20]">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                adjustTextarea();
              }}
              onKeyDown={handleKeyDown}
              placeholder={selectedBrand ? `Ask about ${selectedBrand.brand_name}…` : 'Select a brand to start…'}
              disabled={!selectedBrand || sending}
              rows={1}
              className="flex-1 bg-[rgba(255,255,255,0.08)] border border-white/10 rounded-xl px-3 py-2 text-white text-[14px] resize-none min-h-[44px] max-h-[100px] outline-none placeholder:text-white/30 disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || !selectedBrand || sending}
              className="bg-white text-[#1e1e20] rounded-xl p-2 h-[44px] w-[44px] flex items-center justify-center disabled:opacity-40 hover:bg-white/90 transition-colors flex-shrink-0"
              title="Send"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
