import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createClient } from '@metagptx/web-sdk';
import SidebarLayout from '@/components/Sidebar';
import {
  type Brief, type BrandProfile,
  BRIEF_TYPES, STATUS_OPTIONS, PRIORITY_OPTIONS, AI_TOOLS, getAIToolsForBriefType,
} from '@/lib/briefTypes';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  ArrowLeft, Loader2, Sparkles, Download, CheckCircle2,
  Palette, Megaphone, Share2, Mail, FileText, Video,
  Building2, RefreshCw, MessageSquare, Send, Type, ExternalLink,
} from 'lucide-react';

const client = createClient();

const iconMap: Record<string, React.ElementType> = {
  Palette, Megaphone, Share2, Mail, FileText, Video,
};

// Build a rich brand-aware prompt for text generation
function buildTextPrompt(brief: Brief, brand: BrandProfile | null): string {
  let formFields: Record<string, string> = {};
  try { formFields = JSON.parse(brief.form_data || '{}'); } catch { /* empty */ }

  const parts = [
    `=== CLIENT BRIEF ===`,
    `Type: ${brief.brief_type}`,
    `Title: ${brief.title}`,
    brief.brand_name && `Brand: ${brief.brand_name}`,
    brief.project_description && `Project: ${brief.project_description}`,
    brief.target_audience && `Target Audience: ${brief.target_audience}`,
    brief.tone_style && `Tone/Style: ${brief.tone_style}`,
    brief.key_message && `Key Message: ${brief.key_message}`,
    brief.dimensions && `Dimensions/Format: ${brief.dimensions}`,
    brief.platform && `Platform: ${brief.platform}`,
  ].filter(Boolean);

  Object.entries(formFields).forEach(([k, v]) => {
    if (v && !['title', 'brand_name', 'project_description', 'priority', 'additional_notes', 'target_audience', 'tone_style', 'key_message', 'dimensions', 'platform'].includes(k)) {
      parts.push(`${k.replace(/_/g, ' ')}: ${v}`);
    }
  });
  if (brief.additional_notes) parts.push(`Additional Notes: ${brief.additional_notes}`);

  if (brand) {
    parts.push('');
    parts.push(`=== BRAND GUIDELINES: ${brand.brand_name.toUpperCase()} ===`);
    if (brand.tagline) parts.push(`Tagline: "${brand.tagline}"`);
    if (brand.industry) parts.push(`Industry: ${brand.industry}`);
    if (brand.tone_of_voice) parts.push(`Brand Voice: ${brand.tone_of_voice}`);
    if (brand.primary_color) parts.push(`Primary Color: ${brand.primary_color}`);
    if (brand.secondary_color) parts.push(`Secondary Color: ${brand.secondary_color}`);
    if (brand.accent_color) parts.push(`Accent Color: ${brand.accent_color}`);
    if (brand.font_heading) parts.push(`Heading Font: ${brand.font_heading}`);
    if (brand.font_body) parts.push(`Body Font: ${brand.font_body}`);
    const notes = brand.guidelines_notes?.replace(/^FIGMA_REF:.*$/m, '').trim();
    if (notes) parts.push(`Brand Rules:\n${notes}`);
  }

  return parts.join('\n');
}

// Build a visual-first prompt for image/video AI
function buildVisualPrompt(brief: Brief, brand: BrandProfile | null): string {
  let formFields: Record<string, string> = {};
  try { formFields = JSON.parse(brief.form_data || '{}'); } catch { /* empty */ }

  const styleClues = [
    brief.tone_style || formFields.style_direction || 'modern and professional',
    brand?.tone_of_voice,
  ].filter(Boolean).join(', ');

  const colorClues = brand
    ? `Color palette: ${[brand.primary_color, brand.secondary_color, brand.accent_color].filter(Boolean).join(', ')}`
    : '';

  const brandClues = brand
    ? [
        `Brand: ${brand.brand_name}`,
        brand.tagline && `"${brand.tagline}"`,
        brand.industry && `Industry: ${brand.industry}`,
        colorClues,
        brand.guidelines_notes?.replace(/^FIGMA_REF:.*$/m, '').trim(),
      ].filter(Boolean).join('. ')
    : brief.brand_name || '';

  const parts = [
    `Professional ${brief.brief_type} asset: ${brief.title}.`,
    brief.project_description && `Context: ${brief.project_description}`,
    `Visual style: ${styleClues}.`,
    brief.platform && `For: ${brief.platform}.`,
    brief.dimensions && `Format/Dimensions: ${brief.dimensions}.`,
    formFields.cta_text && `CTA text: "${formFields.cta_text}".`,
    formFields.ad_format && `Format type: ${formFields.ad_format}.`,
    brandClues && `Brand context: ${brandClues}.`,
    'High quality, marketing-ready, brand-consistent, professional photography lighting.',
  ].filter(Boolean);

  return parts.join(' ');
}

export default function BriefDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [brief, setBrief] = useState<Brief | null>(null);
  const [brandProfile, setBrandProfile] = useState<BrandProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const [selectedTool, setSelectedTool] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedText, setGeneratedText] = useState('');
  const [generatedImageUrl, setGeneratedImageUrl] = useState('');
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState('');
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState('');

  const [revisionNote, setRevisionNote] = useState('');
  const [revising, setRevising] = useState(false);

  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    const fetchAll = async () => {
      if (!id) return;
      try {
        const [briefRes, brandsRes] = await Promise.all([
          client.entities.briefs.get({ id }),
          client.entities.brand_profiles.query({ query: {}, limit: 50 }),
        ]);
        const briefData = (briefRes?.data as Brief) || null;
        setBrief(briefData);

        const profiles = (brandsRes?.data?.items as BrandProfile[]) || [];
        if (briefData?.brand_name) {
          const match = profiles.find(
            (p) => p.brand_name.toLowerCase() === briefData.brand_name.toLowerCase()
          );
          setBrandProfile(match || null);
        }
      } catch {
        toast.error('Failed to load brief');
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [id]);

  const hasResult = !!(generatedText || generatedImageUrl || generatedVideoUrl || generatedAudioUrl);

  const handleStatusChange = async (newStatus: string) => {
    if (!brief) return;
    setUpdatingStatus(true);
    try {
      await client.entities.briefs.update({ id: String(brief.id), data: { status: newStatus } });
      setBrief({ ...brief, status: newStatus });
      toast.success(`Status → ${STATUS_OPTIONS.find((s) => s.value === newStatus)?.label}`);
    } catch {
      toast.error('Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const runGeneration = async (tool: typeof AI_TOOLS[0], extraInstruction?: string) => {
    if (!brief) return;
    const prompt = buildTextPrompt(brief, brandProfile);
    const imagePrompt = buildVisualPrompt(brief, brandProfile);

    if (tool.category === 'text') {
      const systemPrompt = `You are a senior creative agency copywriter. Generate professional ${brief.brief_type} content based on the brief and brand guidelines below. Deliver production-ready copy that is on-brand, creative, and conversion-focused.`;
      const userMsg = extraInstruction
        ? `Previous output:\n${generatedText}\n\nRevision instruction: ${extraInstruction}\n\nBrief:\n${prompt}`
        : prompt;

      await client.ai.gentxt({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMsg },
        ],
        model: tool.model || 'gemini-2.5-flash',
        stream: true,
        onChunk: (chunk: any) => {
          setGeneratedText((prev) => prev + (chunk.content || ''));
        },
        onComplete: () => { toast.success('Content generated!'); },
        onError: (err: any) => { toast.error(err?.message || 'Generation failed'); },
        timeout: 60000,
      });
    } else if (tool.category === 'image') {
      const finalPrompt = extraInstruction
        ? `${imagePrompt} Revision: ${extraInstruction}`
        : imagePrompt;
      const res = await client.ai.genimg(
        { prompt: finalPrompt, model: tool.model || 'gpt-image-2', size: '1024x1024', quality: 'standard', n: 1 },
        { timeout: 600000 }
      );
      const url = res?.data?.images?.[0] || '';
      setGeneratedImageUrl(url);
      if (url) {
        await client.entities.briefs.update({
          id: String(brief.id),
          data: { generated_asset_url: url },
        });
      }
      toast.success('Image generated!');
    } else if (tool.category === 'video') {
      const videoPrompt = extraInstruction
        ? `${imagePrompt} ${extraInstruction}`
        : imagePrompt;
      const res = await client.ai.genvideo(
        { prompt: videoPrompt, model: tool.model || 'wan2.6-t2v' },
        { timeout: 600000 }
      );
      const url = res?.data?.url || '';
      setGeneratedVideoUrl(url);
      if (url) {
        await client.entities.briefs.update({
          id: String(brief.id),
          data: { generated_asset_url: url },
        });
      }
      toast.success('Video generated!');
    } else if (tool.category === 'audio') {
      let formFields: Record<string, string> = {};
      try { formFields = JSON.parse(brief.form_data || '{}'); } catch { /* empty */ }
      const text = formFields.script_concept || brief.project_description || brief.title;
      const gender = formFields.voiceover_needs?.toLowerCase().includes('male') ? 'male' : 'female';
      const res = await client.ai.genaudio(
        { text, model: tool.model || 'eleven_v3', gender: gender as 'male' | 'female' },
        { timeout: 600000 }
      );
      setGeneratedAudioUrl(res?.data?.url || '');
      toast.success('Audio generated!');
    }

    // Update brief status + last used tool
    await client.entities.briefs.update({
      id: String(brief.id),
      data: { ai_tool: tool.name, status: 'in_progress' },
    });
    setBrief((prev) => prev ? { ...prev, ai_tool: tool.name, status: 'in_progress' } : prev);
  };

  const handleGenerate = async () => {
    const tool = AI_TOOLS.find((t) => t.id === selectedTool);
    if (!tool || !brief) return;
    setGenerating(true);
    setGeneratedText('');
    setGeneratedImageUrl('');
    setGeneratedVideoUrl('');
    setGeneratedAudioUrl('');
    try {
      await runGeneration(tool);
    } catch (err: any) {
      toast.error(err?.data?.detail || err?.message || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleRevise = async () => {
    if (!revisionNote.trim()) return;
    const tool = AI_TOOLS.find((t) => t.id === selectedTool);
    if (!tool || !brief) return;
    setRevising(true);
    setGeneratedText('');
    setGeneratedImageUrl('');
    setGeneratedVideoUrl('');
    setGeneratedAudioUrl('');
    try {
      await runGeneration(tool, revisionNote);
      setRevisionNote('');
    } catch (err: any) {
      toast.error(err?.data?.detail || err?.message || 'Revision failed');
    } finally {
      setRevising(false);
    }
  };

  if (loading) {
    return (
      <SidebarLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#595959]" />
        </div>
      </SidebarLayout>
    );
  }

  if (!brief) {
    return (
      <SidebarLayout>
        <div className="flex flex-col items-center justify-center pt-32">
          <h2 className="mb-4 text-xl font-bold text-[#1e1e20]">Brief not found</h2>
          <Button onClick={() => navigate('/briefs')} variant="ghost" className="text-[#595959] hover:text-[#1e1e20]">
            Back to Briefs
          </Button>
        </div>
      </SidebarLayout>
    );
  }

  const typeInfo = BRIEF_TYPES.find((t) => t.id === brief.brief_type);
  const Icon = typeInfo ? iconMap[typeInfo.icon] || Palette : Palette;
  const availableTools = getAIToolsForBriefType(brief.brief_type);
  const statusColor = STATUS_OPTIONS.find((s) => s.value === brief.status)?.color || '#94a3b8';
  const priorityColor = PRIORITY_OPTIONS.find((p) => p.value === brief.priority)?.color || '#94a3b8';
  let formFields: Record<string, string> = {};
  try { formFields = JSON.parse(brief.form_data || '{}'); } catch { /* empty */ }

  return (
    <SidebarLayout>
      <div className="min-h-full bg-[#f5f3ef] p-6 lg:p-8">
        <Button
          variant="ghost"
          onClick={() => navigate('/briefs')}
          className="mb-6 gap-2 text-[#595959] hover:bg-[#f5f3ef] hover:text-[#1e1e20]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Briefs
        </Button>

        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          {/* ── Main content ── */}
          <div className="space-y-6">
            {/* Brief header */}
            <div className="rounded-xl border border-[#e2e2e2] bg-white p-6">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${typeInfo?.color || '#7c3aed'}15` }}
                  >
                    <Icon className="h-6 w-6" style={{ color: typeInfo?.color || '#7c3aed' }} />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-[#1e1e20]">{brief.title}</h1>
                    <p className="text-sm text-[#595959]">
                      {typeInfo?.label} · {brief.brand_name}
                      {brandProfile && (
                        <span className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-300">
                          <Building2 className="h-2.5 w-2.5" />
                          Brand guidelines loaded
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="rounded-full px-3 py-1 text-xs font-medium"
                    style={{ backgroundColor: `${priorityColor}15`, color: priorityColor }}
                  >
                    {brief.priority}
                  </span>
                  <span
                    className="rounded-full px-3 py-1 text-xs font-medium"
                    style={{ backgroundColor: `${statusColor}15`, color: statusColor }}
                  >
                    {STATUS_OPTIONS.find((s) => s.value === brief.status)?.label || brief.status}
                  </span>
                </div>
              </div>

              {brief.project_description && (
                <div className="mb-4">
                  <h3 className="mb-1 text-sm font-medium text-[#595959]">Project Description</h3>
                  <p className="text-sm leading-relaxed text-[#1e1e20]">{brief.project_description}</p>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                {brief.target_audience && (
                  <div>
                    <h3 className="mb-1 text-xs font-medium text-[#595959]">Target Audience</h3>
                    <p className="text-sm text-[#1e1e20]">{brief.target_audience}</p>
                  </div>
                )}
                {brief.tone_style && (
                  <div>
                    <h3 className="mb-1 text-xs font-medium text-[#595959]">Tone / Style</h3>
                    <p className="text-sm text-[#1e1e20]">{brief.tone_style}</p>
                  </div>
                )}
                {brief.platform && (
                  <div>
                    <h3 className="mb-1 text-xs font-medium text-[#595959]">Platform</h3>
                    <p className="text-sm text-[#1e1e20]">{brief.platform}</p>
                  </div>
                )}
                {brief.dimensions && (
                  <div>
                    <h3 className="mb-1 text-xs font-medium text-[#595959]">Dimensions</h3>
                    <p className="text-sm text-[#1e1e20]">{brief.dimensions}</p>
                  </div>
                )}
                {brief.key_message && (
                  <div className="sm:col-span-2">
                    <h3 className="mb-1 text-xs font-medium text-[#595959]">Key Message</h3>
                    <p className="text-sm text-[#1e1e20]">{brief.key_message}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Form data details */}
            {Object.keys(formFields).filter((k) =>
              formFields[k] &&
              !['title', 'brand_name', 'project_description', 'priority'].includes(k)
            ).length > 0 && (
              <div className="rounded-xl border border-[#e2e2e2] bg-white p-6">
                <h2 className="mb-4 text-lg font-semibold text-[#1e1e20]">Brief Details</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {Object.entries(formFields)
                    .filter(([k, v]) => v && !['title', 'brand_name', 'project_description', 'priority'].includes(k))
                    .map(([key, value]) => (
                      <div key={key} className="rounded-lg border border-[#e2e2e2] bg-[#f5f3ef] p-3">
                        <h4 className="mb-1 text-xs font-medium capitalize text-[#595959]">
                          {key.replace(/_/g, ' ')}
                        </h4>
                        <p className="text-sm text-[#1e1e20]">{value}</p>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Generated output */}
            {hasResult && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6">
                <div className="mb-4 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  <h2 className="text-lg font-semibold text-[#1e1e20]">Generated Asset</h2>
                  {brief.ai_tool && (
                    <span className="ml-auto text-xs text-[#595959]">via {brief.ai_tool}</span>
                  )}
                </div>

                {generatedText && (
                  <div className="rounded-lg border border-[#e2e2e2] bg-[#f5f3ef] p-4">
                    <pre className="whitespace-pre-wrap text-sm leading-relaxed text-[#1e1e20]">
                      {generatedText}
                    </pre>
                  </div>
                )}

                {generatedImageUrl && (
                  <div className="space-y-3">
                    <img
                      src={generatedImageUrl}
                      alt="Generated asset"
                      className="w-full rounded-lg border border-[#e2e2e2]"
                    />
                    <a href={generatedImageUrl} target="_blank" rel="noopener noreferrer">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 border-[#e2e2e2] text-[#1e1e20] hover:bg-[#f5f3ef]"
                      >
                        <Download className="h-4 w-4" />
                        Download Image
                      </Button>
                    </a>
                  </div>
                )}

                {generatedVideoUrl && (
                  <div className="space-y-3">
                    <video
                      src={generatedVideoUrl}
                      controls
                      className="w-full rounded-lg border border-[#e2e2e2]"
                    />
                    <a href={generatedVideoUrl} target="_blank" rel="noopener noreferrer">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 border-[#e2e2e2] text-[#1e1e20] hover:bg-[#f5f3ef]"
                      >
                        <Download className="h-4 w-4" />
                        Download Video
                      </Button>
                    </a>
                  </div>
                )}

                {generatedAudioUrl && (
                  <div className="space-y-3">
                    <audio src={generatedAudioUrl} controls className="w-full" />
                    <a href={generatedAudioUrl} target="_blank" rel="noopener noreferrer">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 border-[#e2e2e2] text-[#1e1e20] hover:bg-[#f5f3ef]"
                      >
                        <Download className="h-4 w-4" />
                        Download Audio
                      </Button>
                    </a>
                  </div>
                )}

                {/* Revision request */}
                <div className="mt-5 border-t border-[#e2e2e2] pt-5">
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#1e1e20]">
                    <MessageSquare className="h-4 w-4 text-[#595959]" />
                    Request a Revision
                  </h3>
                  <p className="mb-3 text-xs text-[#595959]">
                    Describe what you want to change and regenerate with the same AI tool.
                  </p>
                  <div className="flex gap-2">
                    <Textarea
                      value={revisionNote}
                      onChange={(e) => setRevisionNote(e.target.value)}
                      placeholder="e.g. Make it more energetic, change background to outdoor, use warmer tones..."
                      className="min-h-[80px] border-[#e2e2e2] bg-[#f5f3ef] text-[#1e1e20] placeholder:text-[#595959]"
                    />
                  </div>
                  <Button
                    onClick={handleRevise}
                    disabled={!revisionNote.trim() || revising || !selectedTool}
                    className="mt-3 gap-2 bg-[#1e1e20] text-white hover:bg-[#2e2e30] disabled:opacity-50"
                  >
                    {revising ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Revising...</>
                    ) : (
                      <><RefreshCw className="h-4 w-4" /> Regenerate with Revision</>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* ── Sidebar ── */}
          <aside className="space-y-5">
            {/* Brand context panel */}
            {brandProfile && (
              <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-5">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#1e1e20]">
                  <Building2 className="h-4 w-4 text-[#595959]" />
                  Brand Context
                  <span className="ml-auto rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] text-violet-300">
                    Auto-injected
                  </span>
                </h3>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-[#1e1e20]">{brandProfile.brand_name}</p>
                  {brandProfile.tagline && (
                    <p className="text-xs italic text-[#595959]">"{brandProfile.tagline}"</p>
                  )}
                  {/* Colors */}
                  <div className="flex gap-2 pt-1">
                    {[brandProfile.primary_color, brandProfile.secondary_color, brandProfile.accent_color]
                      .filter(Boolean)
                      .map((color, i) => (
                        <div
                          key={i}
                          className="h-5 w-5 rounded-full border border-[#e2e2e2]"
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                  </div>
                  {brandProfile.font_heading && (
                    <p className="flex items-center gap-1.5 text-xs text-[#595959]">
                      <Type className="h-3 w-3" />
                      {brandProfile.font_heading}
                      {brandProfile.font_body ? ` / ${brandProfile.font_body}` : ''}
                    </p>
                  )}
                  {brandProfile.tone_of_voice && (
                    <p className="text-xs leading-relaxed text-[#595959]">{brandProfile.tone_of_voice}</p>
                  )}
                  {/* Figma reference */}
                  {(() => {
                    const match = brandProfile.guidelines_notes?.match(/FIGMA_REF:\s*(https?:\/\/[^\s\n]+)/);
                    if (!match) return null;
                    return (
                      <a
                        href={match[1]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-xs text-[#595959] hover:text-violet-300"
                      >
                        <ExternalLink className="h-3 w-3" />
                        View Figma Guidelines
                      </a>
                    );
                  })()}
                </div>
              </div>
            )}

            {!brandProfile && brief.brand_name && (
              <div className="rounded-xl border border-[#e2e2e2] bg-white p-5">
                <p className="text-xs text-[#595959]">
                  No brand profile found for "{brief.brand_name}".{' '}
                  <a href="/brands" className="text-[#595959] hover:text-violet-300">
                    Add one →
                  </a>
                </p>
              </div>
            )}

            {/* Status */}
            <div className="rounded-xl border border-[#e2e2e2] bg-white p-5">
              <h3 className="mb-3 text-sm font-semibold text-[#1e1e20]">Status</h3>
              <Select
                value={brief.status}
                onValueChange={handleStatusChange}
                disabled={updatingStatus}
              >
                <SelectTrigger className="border-[#e2e2e2] bg-[#f5f3ef] text-[#1e1e20]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-[#e2e2e2] bg-white">
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem
                      key={s.value}
                      value={s.value}
                      className="text-[#1e1e20] hover:bg-[#f5f3ef] focus:bg-[#f5f3ef]"
                    >
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                        {s.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* AI generation */}
            <div className="rounded-xl border border-[#e2e2e2] bg-white p-5">
              <h3 className="mb-1 text-sm font-semibold text-[#1e1e20]">AI Generation</h3>
              <p className="mb-4 text-xs text-[#595959]">
                {brandProfile
                  ? `Brand guidelines for "${brandProfile.brand_name}" will be injected automatically.`
                  : 'Select an AI tool and generate your asset.'}
              </p>

              <div className="mb-4 space-y-2">
                {availableTools.map((tool) => (
                  <button
                    key={tool.id}
                    onClick={() => setSelectedTool(tool.id)}
                    className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                      selectedTool === tool.id
                        ? 'border-violet-500/50 bg-violet-500/10'
                        : 'border-[#e2e2e2] bg-[#f5f3ef] hover:border-[#e2e2e2]'
                    }`}
                  >
                    <span className="text-xl">{tool.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[#1e1e20]">{tool.name}</p>
                      <p className="truncate text-xs text-[#595959]">{tool.description}</p>
                    </div>
                  </button>
                ))}
              </div>

              <Button
                onClick={handleGenerate}
                disabled={!selectedTool || generating}
                className="w-full gap-2 bg-[#1e1e20] text-white hover:bg-[#2e2e30] disabled:opacity-50"
              >
                {generating ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
                ) : (
                  <><Sparkles className="h-4 w-4" /> Generate Asset</>
                )}
              </Button>
              {generating && (
                <p className="mt-2 text-center text-xs text-[#595959]">
                  This may take a moment…
                </p>
              )}
            </div>

            {/* Brief meta */}
            <div className="rounded-xl border border-[#e2e2e2] bg-white p-5">
              <h3 className="mb-3 text-sm font-semibold text-[#1e1e20]">Brief Info</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#595959]">Type</span>
                  <span className="text-[#1e1e20]">{typeInfo?.label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#595959]">Priority</span>
                  <span style={{ color: priorityColor }}>{brief.priority}</span>
                </div>
                {brief.ai_tool && (
                  <div className="flex justify-between">
                    <span className="text-[#595959]">Last AI Tool</span>
                    <span className="text-[#1e1e20]">{brief.ai_tool}</span>
                  </div>
                )}
                {brief.created_at && (
                  <div className="flex justify-between">
                    <span className="text-[#595959]">Created</span>
                    <span className="text-[#1e1e20]">
                      {new Date(brief.created_at).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </SidebarLayout>
  );
}
