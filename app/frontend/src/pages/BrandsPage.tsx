import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@metagptx/web-sdk';
import axios from 'axios';
import SidebarLayout from '@/components/Sidebar';
import { type BrandProfile } from '@/lib/briefTypes';
import {
  Eye, Plus, Search, LayoutGrid, List, Loader2, Building2,
  Sparkles, Check, FileText, Link2, Trash2, X, Upload,
} from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const mgxClient = createClient();

const INDUSTRIES = [
  'Technology', 'Healthcare', 'Finance', 'Retail', 'Food & Beverage',
  'Fashion', 'Real Estate', 'Education', 'Entertainment', 'Travel',
  'Beauty & Wellness', 'Sports', 'Automotive', 'Cycling', 'Non-profit', 'Other',
];

type ExtendedProfile = BrandProfile & { created_at?: string };

type FormState = Omit<BrandProfile, 'id' | 'user_id'>;

const EMPTY_FORM: FormState = {
  brand_name: '',
  primary_color: '#7c3aed',
  secondary_color: '#06b6d4',
  accent_color: '#f59e0b',
  font_heading: '',
  font_body: '',
  tone_of_voice: '',
  logo_url: '',
  tagline: '',
  industry: '',
  guidelines_notes: '',
};

function formatDate(dateStr?: string) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return `Added ${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
  } catch {
    return '';
  }
}

// ─── PDF text extraction ───────────────────────────────────────────────────────
async function extractTextFromFile(file: File): Promise<string> {
  if (file.name.endsWith('.pdf') || file.type === 'application/pdf') {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).href;
    const buf = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: buf }).promise;
    const parts: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const tc = await page.getTextContent();
      parts.push(tc.items.map((item: any) => item.str || '').join(' '));
    }
    return parts.join('\n');
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string) || '');
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

// ─── Import Tab ────────────────────────────────────────────────────────────────
type ImportMode = 'file' | 'text' | 'figma';

function ImportTab({ onExtracted }: { onExtracted: (data: Partial<FormState>) => void }) {
  const [activeImport, setActiveImport] = useState<ImportMode>('file');
  const [guidelinesText, setGuidelinesText] = useState('');
  const [figmaUrl, setFigmaUrl] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [done, setDone] = useState(false);
  const [fileName, setFileName] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const FULL_DNA_PROMPT = `You are a senior brand strategist. Extract COMPLETE brand DNA from the provided brand guidelines.
Return ONLY valid JSON (no markdown, no explanation) with ALL fields you can find:
{
  "brand_name": "exact brand name",
  "tagline": "official tagline or slogan",
  "industry": "industry/sector",
  "brand_story": "1-2 sentences about brand mission and origin",
  "target_audience": "primary audience — demographics, psychographics, lifestyle",
  "brand_personality": ["adjective1", "adjective2", "adjective3", "adjective4"],
  "brand_values": ["core value 1", "core value 2", "core value 3"],
  "tone_of_voice": "how the brand communicates",
  "writing_style": "specific writing rules and vocabulary guidance",
  "colors": { "primary": "#hex", "secondary": "#hex", "accent": "#hex", "additional": [] },
  "typography": { "heading_font": "font name", "body_font": "font name", "accent_font": "", "type_rules": "" },
  "logo": { "description": "visual logo description", "usage_rules": "when/how to use", "clear_space": "" },
  "imagery_style": {
    "photography_direction": "photography style details",
    "subjects": "what appears in images",
    "mood": "emotional mood of images",
    "lighting": "lighting style",
    "composition": "composition rules",
    "color_treatment": "colour grading or post-processing",
    "what_to_avoid": "what must NOT appear"
  },
  "design_rules": {
    "layout_principles": "grid, white space, hierarchy",
    "dos": ["do 1", "do 2", "do 3"],
    "donts": ["dont 1", "dont 2", "dont 3"]
  },
  "primary_color": "#hex",
  "secondary_color": "#hex",
  "accent_color": "#hex",
  "font_heading": "font name",
  "font_body": "font name",
  "guidelines_notes": "any other important brand context"
}`;

  const runAiExtraction = async (text: string) => {
    if (!text.trim()) return;
    setExtracting(true);
    setDone(false);
    try {
      const res = await axios.post('/api/v1/aihub/gentxt', {
        messages: [
          { role: 'system', content: FULL_DNA_PROMPT },
          { role: 'user', content: `Extract complete brand DNA from this document:\n\n${text.slice(0, 40000)}` },
        ],
        model: 'gemini-2.5-flash',
        stream: false,
        max_tokens: 8192,
      });
      const content: string = res.data?.content || '';
      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
        const dna = JSON.parse(match[0]);
        onExtracted({ ...dna, brand_dna: JSON.stringify(dna) } as any);
        setDone(true);
        toast.success('Brand DNA extracted — review the form and save.');
      } else {
        toast.error('Could not parse AI response. Try again or use manual entry.');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || err?.message || 'Extraction failed');
    } finally {
      setExtracting(false);
    }
  };

  const handleFile = async (file: File) => {
    const allowed = ['.pdf', '.txt', '.md', '.doc', '.docx'];
    if (!allowed.some((ext) => file.name.toLowerCase().endsWith(ext))) {
      toast.error('Please upload a PDF, TXT, MD, or DOC file.');
      return;
    }
    setFileName(file.name);
    setExtracting(true);
    try {
      // PDFs: use backend (PyMuPDF) — browser pdfjs fails on design-heavy brandbooks
      if (file.name.toLowerCase().endsWith('.pdf')) {
        const form = new FormData();
        form.append('file', file);
        const res = await axios.post('/api/v1/aihub/extract-brand-dna', form, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 120_000,
        });
        const dna = res.data?.dna || {};
        if (!dna.brand_name) {
          toast.error('Could not detect a brand name in this document.');
          return;
        }
        onExtracted({ ...dna, brand_dna: JSON.stringify(dna) } as any);
        setDone(true);
        toast.success('Brand DNA extracted — review the form and save.');
        return;
      }
      // Non-PDF: read text locally then send to AI
      const text = await extractTextFromFile(file);
      if (!text.trim()) {
        toast.error('No readable text found in this file. Try pasting the text directly.');
        return;
      }
      setGuidelinesText(text);
      await runAiExtraction(text);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || err?.message || 'Could not read file');
    } finally {
      setExtracting(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const saveFigmaRef = () => {
    if (!figmaUrl.trim()) return;
    onExtracted({ guidelines_notes: `FIGMA_REF: ${figmaUrl}` });
    setDone(true);
    toast.success('Figma reference saved. Fill remaining brand fields manually.');
  };

  const TABS: { id: ImportMode; label: string; icon: React.ReactNode }[] = [
    { id: 'file', label: 'Upload File', icon: <Upload className="h-3.5 w-3.5" /> },
    { id: 'text', label: 'Paste Text', icon: <FileText className="h-3.5 w-3.5" /> },
    { id: 'figma', label: 'Figma URL', icon: <Link2 className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex rounded-lg bg-gray-100 p-1 gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveImport(tab.id); setDone(false); }}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-xs font-medium transition-all ${
              activeImport === tab.id ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── File Upload ── */}
      {activeImport === 'file' && (
        <>
          <p className="text-xs text-gray-500">
            Upload your brand guidelines document. AI will extract colours, fonts, tone of voice, and key rules automatically.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.md,.doc,.docx"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => !extracting && fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-all cursor-pointer ${
              dragging
                ? 'border-violet-400 bg-violet-50'
                : extracting
                ? 'border-violet-300 bg-violet-50/50'
                : 'border-gray-200 bg-gray-50 hover:border-violet-300 hover:bg-violet-50/30'
            }`}
          >
            {extracting ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
                <p className="text-sm font-medium text-violet-700">
                  {fileName ? `Reading ${fileName}…` : 'Extracting brand data…'}
                </p>
                <p className="text-xs text-gray-400">AI is analysing your brand guidelines</p>
              </>
            ) : done ? (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                  <Check className="h-6 w-6 text-emerald-600" />
                </div>
                <p className="text-sm font-medium text-emerald-700">{fileName} — Extracted</p>
                <p className="text-xs text-gray-400">Review the form fields and save the brand</p>
                <button
                  onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                  className="text-xs text-violet-600 hover:underline"
                >
                  Upload a different file
                </button>
              </>
            ) : (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-100">
                  <Upload className="h-6 w-6 text-violet-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    Drag and drop your brand guidelines
                  </p>
                  <p className="mt-0.5 text-xs text-gray-400">or click to browse</p>
                </div>
                <div className="flex gap-2">
                  {['PDF', 'TXT', 'DOCX', 'MD'].map((t) => (
                    <span key={t} className="rounded-full bg-white border border-gray-200 px-2.5 py-0.5 text-[10px] font-medium text-gray-500 shadow-sm">
                      {t}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* ── Paste Text ── */}
      {activeImport === 'text' && (
        <>
          <p className="text-xs text-gray-500">
            Paste the text content of your brand guidelines. AI will extract colours, fonts, tone, and key rules automatically.
          </p>
          <Textarea
            value={guidelinesText}
            onChange={(e) => setGuidelinesText(e.target.value)}
            placeholder="Paste your brand guidelines here — colours, fonts, tone of voice, photography style, dos and don'ts..."
            className="min-h-[160px] border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:border-violet-400"
          />
          <Button
            onClick={() => runAiExtraction(guidelinesText)}
            disabled={!guidelinesText.trim() || extracting}
            className="w-full gap-2 bg-gradient-to-r from-violet-600 to-violet-700 text-white hover:from-violet-500 hover:to-violet-600 disabled:opacity-50"
          >
            {extracting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Extracting with AI...</>
            ) : done ? (
              <><Check className="h-4 w-4" /> Extracted — review the form</>
            ) : (
              <><Sparkles className="h-4 w-4" /> Extract Brand Profile with AI</>
            )}
          </Button>
        </>
      )}

      {/* ── Figma URL ── */}
      {activeImport === 'figma' && (
        <>
          <p className="text-xs text-gray-500">
            Paste your Figma brand guidelines URL. It will be saved as a reference linked to this brand profile.
          </p>
          <div className="flex gap-2">
            <Input
              value={figmaUrl}
              onChange={(e) => setFigmaUrl(e.target.value)}
              placeholder="https://www.figma.com/design/..."
              className="border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400"
            />
            <Button
              onClick={saveFigmaRef}
              disabled={!figmaUrl.trim()}
              className="shrink-0 bg-gradient-to-r from-violet-600 to-violet-700 text-white"
            >
              Save
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Create Brand Modal ─────────────────────────────────────────────────────────
function CreateBrandModal({
  open,
  onClose,
  onSave,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: FormState) => void;
  saving: boolean;
}) {
  const [tab, setTab] = useState<'import' | 'manual'>('import');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) { setForm(EMPTY_FORM); setTab('import'); }
  }, [open]);

  const set = (field: keyof FormState, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => set('logo_url', ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Create New Brand</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="shrink-0 flex border-b border-gray-100 px-6">
          {(['import', 'manual'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`mr-6 border-b-2 py-3 text-sm font-medium transition-colors ${
                tab === t ? 'border-violet-600 text-violet-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'import' ? 'Import Guidelines' : 'Manual Entry'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {tab === 'import' && (
            <ImportTab onExtracted={(data) => { setForm((f) => ({ ...f, ...data })); setTab('manual'); }} />
          )}

          {tab === 'manual' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">Brand Name *</Label>
                <Input
                  value={form.brand_name}
                  onChange={(e) => set('brand_name', e.target.value)}
                  placeholder="e.g. Shelby Cycles"
                  className="border-gray-200 focus:border-violet-400"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">Industry</Label>
                <Select value={form.industry} onValueChange={(v) => set('industry', v)}>
                  <SelectTrigger className="border-gray-200">
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRIES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">Tagline</Label>
                <Input
                  value={form.tagline}
                  onChange={(e) => set('tagline', e.target.value)}
                  placeholder="Brand strapline or positioning statement"
                  className="border-gray-200 focus:border-violet-400"
                />
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700">Brand Colours</Label>
                <div className="mt-2 grid grid-cols-3 gap-3">
                  {(['primary_color', 'secondary_color', 'accent_color'] as const).map((key) => (
                    <div key={key} className="space-y-1">
                      <p className="text-xs text-gray-500 capitalize">{key.replace('_color', '').replace('_', ' ')}</p>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={form[key]}
                          onChange={(e) => set(key, e.target.value)}
                          className="h-8 w-8 cursor-pointer rounded-md border border-gray-200"
                        />
                        <input
                          type="text"
                          value={form[key]}
                          onChange={(e) => set(key, e.target.value)}
                          className="w-full rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 font-mono text-xs text-gray-700 focus:border-violet-400 focus:outline-none"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700">Heading Font</Label>
                  <Input
                    value={form.font_heading}
                    onChange={(e) => set('font_heading', e.target.value)}
                    placeholder="e.g. Inter Bold"
                    className="border-gray-200 focus:border-violet-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700">Body Font</Label>
                  <Input
                    value={form.font_body}
                    onChange={(e) => set('font_body', e.target.value)}
                    placeholder="e.g. Inter Regular"
                    className="border-gray-200 focus:border-violet-400"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">Tone of Voice</Label>
                <Textarea
                  value={form.tone_of_voice}
                  onChange={(e) => set('tone_of_voice', e.target.value)}
                  placeholder="e.g. Professional and innovative. Speaks directly to serious creatives with precision and clarity."
                  className="min-h-[80px] border-gray-200 focus:border-violet-400"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">Brand Guidelines & Notes</Label>
                <Textarea
                  value={form.guidelines_notes}
                  onChange={(e) => set('guidelines_notes', e.target.value)}
                  placeholder="Key brand rules, dos and don'ts, photography style, visual direction, Figma reference URL..."
                  className="min-h-[100px] border-gray-200 focus:border-violet-400"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">Logo</Label>
                <div className="flex items-center gap-3">
                  {form.logo_url && (
                    <div className="relative shrink-0">
                      <img
                        src={form.logo_url}
                        alt="Logo preview"
                        className="h-16 w-16 rounded-xl object-contain border border-gray-200 bg-gray-50"
                      />
                      <button
                        type="button"
                        onClick={() => set('logo_url', '')}
                        className="absolute -right-1.5 -top-1.5 rounded-full bg-red-500 p-0.5 text-white hover:bg-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-2.5 text-sm text-gray-600 hover:border-violet-400 hover:bg-violet-50/40 hover:text-violet-700 transition-colors"
                  >
                    <Upload className="h-4 w-4" />
                    {form.logo_url ? 'Change Logo' : 'Upload Logo'}
                  </button>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoFile}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <Button variant="ghost" onClick={onClose} className="text-gray-600 hover:bg-gray-100">
            Cancel
          </Button>
          <Button
            onClick={() => onSave(form)}
            disabled={!form.brand_name.trim() || saving}
            className="gap-2 bg-gradient-to-r from-violet-600 to-violet-700 text-white hover:from-violet-500 hover:to-violet-600 disabled:opacity-50"
          >
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : 'Create Brand'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Brand Card ─────────────────────────────────────────────────────────────────
function BrandCard({
  profile,
  isAdmin,
  onDelete,
  onView,
  onLogoUpdate,
}: {
  profile: ExtendedProfile;
  isAdmin: boolean;
  onDelete: (profile: ExtendedProfile) => void;
  onView: (profile: ExtendedProfile) => void;
  onLogoUpdate?: (id: number, logoUrl: string) => void;
}) {
  const logoInputRef = useRef<HTMLInputElement>(null);

  const initials = profile.brand_name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => onLogoUpdate?.(profile.id as number, ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="group relative flex flex-col rounded-2xl overflow-hidden border border-gray-100 bg-white shadow-sm transition-all hover:shadow-md hover:border-gray-200">
      {/* Input lives at card root — outside the clickable cover div so its
          programmatic .click() doesn't bubble into the navigation handler */}
      {onLogoUpdate && (
        <input
          ref={logoInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleLogoFile}
        />
      )}

      {/* Cover area */}
      <div
        className="relative h-[160px] flex items-center justify-center cursor-pointer"
        style={{
          background: `linear-gradient(135deg, ${profile.primary_color || '#7c3aed'} 0%, ${profile.secondary_color || '#06b6d4'} 60%, ${profile.accent_color || '#f59e0b'} 100%)`,
        }}
        onClick={() => onView(profile)}
      >
        {profile.logo_url ? (
          <img
            src={profile.logo_url}
            alt={profile.brand_name}
            className="max-h-[110px] max-w-[170px] object-contain drop-shadow-lg"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <span className="text-[42px] font-bold text-white/80 select-none">{initials}</span>
        )}

        {/* Eye button */}
        <button
          onClick={(e) => { e.stopPropagation(); onView(profile); }}
          className="absolute right-3 top-3 rounded-lg p-1.5 bg-black/20 text-white opacity-0 transition-all group-hover:opacity-100 hover:bg-black/40 backdrop-blur-sm"
          title="View brand"
        >
          <Eye className="h-4 w-4" />
        </button>

        {/* Logo upload overlay button */}
        {onLogoUpdate && (
          <button
            onClick={(e) => { e.stopPropagation(); logoInputRef.current?.click(); }}
            className="absolute bottom-2 right-2 flex items-center gap-1 rounded-lg bg-black/40 px-2 py-1 text-[11px] text-white opacity-0 transition-all group-hover:opacity-100 hover:bg-black/60 backdrop-blur-sm"
          >
            <Upload className="h-3 w-3" />
            {profile.logo_url ? 'Change' : 'Add Logo'}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-4">
        {/* Name */}
        <h3
          className="mb-1 cursor-pointer text-[17px] font-bold text-[#1e1e20] hover:text-violet-700 transition-colors leading-snug"
          onClick={() => onView(profile)}
        >
          {profile.brand_name}
        </h3>

        {/* Brand DNA label */}
        <p className="mb-auto text-xs text-[#908f8e]">
          {profile.industry ? `Brand DNA · ${profile.industry}` : 'Brand DNA'}
        </p>

        {/* Colour swatches */}
        <div className="mt-4 flex items-center gap-1.5">
          {[profile.primary_color, profile.secondary_color, profile.accent_color]
            .filter(Boolean)
            .map((color, i) => (
              <div
                key={i}
                className="h-4 w-4 rounded-full border border-white shadow-sm"
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
        </div>

        {/* Footer: date + admin delete */}
        <div className="mt-3 flex items-center justify-between border-t border-gray-50 pt-3">
          <span className="text-[11px] text-[#c5c4c3]">
            {formatDate((profile as any).created_at)}
          </span>
          {isAdmin && (
            <button
              onClick={() => onDelete(profile)}
              className="rounded-lg p-1 text-gray-300 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-50 hover:text-red-500"
              title="Delete brand"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Quick Upload Zone ─────────────────────────────────────────────────────────
type UploadStep = 'idle' | 'reading' | 'extracting' | 'saving' | 'done' | 'error';

function QuickUploadZone({ onCreated }: { onCreated: () => void }) {
  const [step, setStep] = useState<UploadStep>('idle');
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [extractedName, setExtractedName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    const allowed = ['.pdf', '.txt', '.md', '.docx', '.doc'];
    if (!allowed.some((ext) => file.name.toLowerCase().endsWith(ext))) {
      setErrorMsg('Please upload a PDF, DOCX, TXT or MD file.');
      setStep('error');
      return;
    }
    setFileName(file.name);
    setErrorMsg('');

    // Step 1: For PDFs — send raw file to backend (PyMuPDF is more reliable than pdfjs)
    //          For text-based files — read locally
    setStep('reading');

    // Step 2: AI extraction — full Brand DNA
    setStep('extracting');
    let dna: Record<string, any> = {};
    let pdfLogoUrl: string | null = null;

    if (file.name.toLowerCase().endsWith('.pdf')) {
      // PDF: backend handles text extraction + Gemini + logo image extraction in one call
      try {
        const form = new FormData();
        form.append('file', file);
        const res = await axios.post('/api/v1/aihub/extract-brand-dna', form, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 120_000,
        });
        dna = res.data?.dna || {};
        pdfLogoUrl = res.data?.logo_url || null;
      } catch (err: any) {
        const detail = err?.response?.data?.detail || err?.message || 'try again';
        setErrorMsg('AI extraction failed — ' + detail);
        setStep('error');
        return;
      }
    } else {
      // Text/DOCX: read locally then send text to Gemini
      let text = '';
      try {
        text = await extractTextFromFile(file);
      } catch (err: any) {
        setErrorMsg('Could not read file — ' + (err?.message || 'unknown error'));
        setStep('error');
        return;
      }
      if (!text.trim()) {
        setErrorMsg('No readable text found. Try a different file or paste the text manually.');
        setStep('error');
        return;
      }

      const DNA_PROMPT = `You are a senior brand strategist. Extract COMPLETE brand DNA.
Return ONLY valid JSON — no markdown, no explanation, no code fences.
Required fields: brand_name, tagline, industry, brand_story, target_audience,
brand_personality (array), brand_values (array), tone_of_voice, writing_style,
colors {primary, secondary, accent, additional[]}, typography {heading_font, body_font, accent_font, type_rules},
logo {description, usage_rules, clear_space}, imagery_style {photography_direction, subjects, mood, lighting, composition, color_treatment, what_to_avoid},
design_rules {layout_principles, dos[], donts[]},
primary_color, secondary_color, accent_color, font_heading, font_body, guidelines_notes.
Use empty string or [] for any field not found.`;

      try {
        const res = await axios.post('/api/v1/aihub/gentxt', {
          messages: [
            { role: 'system', content: DNA_PROMPT },
            { role: 'user', content: `Extract complete brand DNA from this document:\n\n${text.slice(0, 40000)}` },
          ],
          model: 'gemini-2.5-flash',
          stream: false,
          max_tokens: 8192,
        });
        const content: string = res.data?.content || '';
        const match = content.match(/\{[\s\S]*\}/);
        if (!match) {
          setErrorMsg('AI could not parse the document. Try uploading a PDF or paste the text via Create New Brand.');
          setStep('error');
          return;
        }
        try { dna = JSON.parse(match[0]); } catch {
          setErrorMsg('AI returned invalid data. Try again.');
          setStep('error');
          return;
        }
      } catch (err: any) {
        setErrorMsg('AI extraction failed — ' + (err?.response?.data?.detail || err?.message || 'try again'));
        setStep('error');
        return;
      }
    }

    if (!dna.brand_name) {
      setErrorMsg('Could not detect a brand name in this document.');
      setStep('error');
      return;
    }

    setExtractedName(dna.brand_name);

    // Step 3: save with full brand_dna JSON
    setStep('saving');
    const payload: FormState & { brand_dna?: string } = {
      brand_name: dna.brand_name || '',
      tagline: dna.tagline || '',
      industry: dna.industry || '',
      primary_color: dna.primary_color || dna.colors?.primary || '#7c3aed',
      secondary_color: dna.secondary_color || dna.colors?.secondary || '#06b6d4',
      accent_color: dna.accent_color || dna.colors?.accent || '#f59e0b',
      font_heading: dna.font_heading || dna.typography?.heading_font || '',
      font_body: dna.font_body || dna.typography?.body_font || '',
      tone_of_voice: dna.tone_of_voice || '',
      logo_url: pdfLogoUrl || '',
      guidelines_notes: dna.guidelines_notes || '',
      brand_dna: JSON.stringify(dna),
    };

    try {
      await mgxClient.entities.brand_profiles.create({ data: payload });
    } catch (err: any) {
      setErrorMsg('Saved extraction but failed to create brand — ' + (err?.message || 'try again'));
      setStep('error');
      return;
    }

    setStep('done');
    toast.success(`Brand "${dna.brand_name}" created from ${file.name}`);
    onCreated();
    setTimeout(() => setStep('idle'), 4000);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const busy = step === 'reading' || step === 'extracting' || step === 'saving';

  const STEP_LABEL: Record<UploadStep, string> = {
    idle: '',
    reading: `Reading ${fileName}…`,
    extracting: 'AI is extracting brand data…',
    saving: `Creating brand profile for "${extractedName}"…`,
    done: `"${extractedName}" added successfully`,
    error: errorMsg,
  };

  return (
    <div className="mb-6">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.txt,.md,.doc,.docx"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ''; }}
      />
      <div
        onDragOver={(e) => { e.preventDefault(); if (!busy) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !busy && fileInputRef.current?.click()}
        className={`relative flex items-center gap-5 rounded-2xl border-2 border-dashed px-6 py-5 transition-all ${
          busy
            ? 'cursor-default border-violet-300 bg-violet-50'
            : step === 'done'
            ? 'cursor-pointer border-emerald-300 bg-emerald-50'
            : step === 'error'
            ? 'cursor-pointer border-red-300 bg-red-50'
            : dragging
            ? 'cursor-copy border-violet-400 bg-violet-50'
            : 'cursor-pointer border-gray-200 bg-white hover:border-violet-300 hover:bg-violet-50/40'
        }`}
      >
        {/* Icon */}
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
          busy ? 'bg-violet-100' :
          step === 'done' ? 'bg-emerald-100' :
          step === 'error' ? 'bg-red-100' :
          'bg-violet-100'
        }`}>
          {busy ? (
            <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
          ) : step === 'done' ? (
            <Check className="h-6 w-6 text-emerald-600" />
          ) : step === 'error' ? (
            <X className="h-6 w-6 text-red-500" />
          ) : (
            <Upload className="h-6 w-6 text-violet-600" />
          )}
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          {step === 'idle' || dragging ? (
            <>
              <p className="font-semibold text-[#1e1e20]">
                {dragging ? 'Drop to upload brand guidelines' : 'Upload Brand Guidelines'}
              </p>
              <p className="mt-0.5 text-sm text-[#595959]">
                Drag and drop a PDF, DOCX, or TXT — AI will extract colours, fonts, tone and rules automatically
              </p>
            </>
          ) : (
            <>
              <p className={`font-semibold ${
                step === 'done' ? 'text-emerald-700' :
                step === 'error' ? 'text-red-600' :
                'text-violet-700'
              }`}>
                {STEP_LABEL[step]}
              </p>
              {busy && (
                <div className="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-violet-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 transition-all duration-500"
                    style={{ width: step === 'reading' ? '25%' : step === 'extracting' ? '65%' : '90%' }}
                  />
                </div>
              )}
              {(step === 'done' || step === 'error') && (
                <p className="mt-0.5 text-xs text-gray-400">
                  {step === 'done' ? 'Click to upload another' : 'Click to try again'}
                </p>
              )}
            </>
          )}
        </div>

        {/* Format badges */}
        {(step === 'idle' || dragging) && (
          <div className="hidden sm:flex shrink-0 gap-1.5">
            {['PDF', 'DOCX', 'TXT'].map((t) => (
              <span key={t} className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-[10px] font-medium text-gray-500">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function BrandsPage() {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<ExtendedProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ExtendedProfile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sort, setSort] = useState<'name' | 'date'>('date');

  useEffect(() => {
    const init = async () => {
      try {
        const res = await mgxClient.auth.me();
        setIsAdmin(res?.data?.role === 'admin');
      } catch {
        setIsAdmin(false);
      }
      await fetchProfiles();
    };
    init();
  }, []);

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      const res = await mgxClient.entities.brand_profiles.query({ query: {}, limit: 100 });
      setProfiles((res?.data?.items as ExtendedProfile[]) || []);
    } catch {
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (data: FormState) => {
    setSaving(true);
    try {
      await mgxClient.entities.brand_profiles.create({ data });
      toast.success('Brand created');
      setShowModal(false);
      await fetchProfiles();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create brand');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpdate = async (id: number, logoUrl: string) => {
    try {
      await mgxClient.entities.brand_profiles.update({ id: String(id), data: { logo_url: logoUrl } });
      setProfiles((prev) => prev.map((p) => p.id === id ? { ...p, logo_url: logoUrl } : p));
      toast.success('Logo updated');
    } catch {
      toast.error('Failed to update logo');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await mgxClient.entities.brand_profiles.delete({ id: String(deleteTarget.id) });
      toast.success('Brand deleted');
      setDeleteTarget(null);
      await fetchProfiles();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  const filtered = useMemo(() => {
    let list = profiles;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.brand_name.toLowerCase().includes(q) ||
          p.industry?.toLowerCase().includes(q) ||
          p.tagline?.toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => {
      if (sort === 'name') return a.brand_name.localeCompare(b.brand_name);
      const da = (a as any).created_at || '';
      const db = (b as any).created_at || '';
      return db.localeCompare(da);
    });
  }, [profiles, search, sort]);

  return (
    <SidebarLayout>
      <div className="min-h-full bg-[#f5f3ef] p-6 lg:p-8">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-[32px] font-bold text-[#1e1e20] leading-tight">Brand Management</h1>
            <p className="mt-1 text-[15px] text-[#595959]">
              Manage brand guidelines and assets for all your clients.
            </p>
          </div>
          {isAdmin && (
            <Button
              onClick={() => setShowModal(true)}
              className="mt-1 gap-2 bg-violet-600 text-white shadow-sm hover:bg-violet-700"
            >
              <Plus className="h-4 w-4" />
              Create New Brand
            </Button>
          )}
        </div>

        {/* Upload Zone — always visible */}
        <QuickUploadZone onCreated={fetchProfiles} />

        {/* Toolbar */}
        <div className="mb-6 flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search brands..."
              className="border-gray-200 bg-white pl-9 text-sm text-gray-900 placeholder:text-gray-400 focus:border-violet-400"
            />
          </div>

          <Select value={sort} onValueChange={(v) => setSort(v as any)}>
            <SelectTrigger className="w-36 border-gray-200 bg-white text-sm text-gray-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Last Added</SelectItem>
              <SelectItem value="name">Name A–Z</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex rounded-lg border border-gray-200 bg-white p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={`rounded-md p-1.5 transition-colors ${viewMode === 'grid' ? 'bg-gray-100 text-gray-700' : 'text-gray-400 hover:text-gray-600'}`}
              title="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`rounded-md p-1.5 transition-colors ${viewMode === 'list' ? 'bg-gray-100 text-gray-700' : 'text-gray-400 hover:text-gray-600'}`}
              title="List view"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
              <Building2 className="h-8 w-8 text-gray-300" />
            </div>
            <p className="text-lg font-semibold text-gray-700">
              {search ? 'No brands match your search' : 'No brands yet'}
            </p>
            <p className="mt-1 text-sm text-gray-400">
              {search ? 'Try a different search term.' : 'Create your first brand to get started.'}
            </p>
            {!search && isAdmin && (
              <Button
                onClick={() => setShowModal(true)}
                className="mt-4 gap-2 bg-violet-600 text-white hover:bg-violet-700"
              >
                <Plus className="h-4 w-4" /> Create New Brand
              </Button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((profile) => (
              <BrandCard
                key={profile.id}
                profile={profile}
                isAdmin={isAdmin}
                onView={(p) => navigate(`/brands/${p.id}`)}
                onDelete={(p) => setDeleteTarget(p)}
                onLogoUpdate={handleLogoUpdate}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((profile) => (
              <div
                key={profile.id}
                className="flex items-center gap-4 rounded-xl border border-gray-100 bg-white px-5 py-3.5 shadow-sm hover:shadow-md transition-all cursor-pointer"
                onClick={() => navigate(`/brands/${profile.id}`)}
              >
                {profile.logo_url ? (
                  <img src={profile.logo_url} alt="" className="h-9 w-9 rounded-lg object-cover shrink-0" />
                ) : (
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                    style={{
                      background: `linear-gradient(135deg, ${profile.primary_color || '#7c3aed'}, ${profile.secondary_color || '#06b6d4'})`,
                    }}
                  >
                    {profile.brand_name[0]?.toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#1e1e20] truncate">{profile.brand_name}</p>
                  <p className="text-xs text-[#908f8e]">{profile.industry || 'Brand DNA'}</p>
                </div>
                <div className="flex items-center gap-2">
                  {[profile.primary_color, profile.secondary_color, profile.accent_color]
                    .filter(Boolean)
                    .map((c, i) => (
                      <div key={i} className="h-3.5 w-3.5 rounded-full border border-white shadow-sm" style={{ backgroundColor: c }} />
                    ))}
                </div>
                <span className="shrink-0 text-xs text-gray-400 ml-4">
                  {formatDate((profile as any).created_at)}
                </span>
                {isAdmin && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(profile); }}
                    className="ml-2 rounded-lg p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      <CreateBrandModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleCreate}
        saving={saving}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.brand_name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the brand profile and all associated data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...</> : 'Delete Brand'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarLayout>
  );
}
