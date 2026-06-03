import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@metagptx/web-sdk';
import axios from 'axios';
import SidebarLayout from '@/components/Sidebar';
import {
  ChevronLeft,
  ChevronRight,
  CloudDownload,
  Sparkles,
  Plus,
  X,
  Check,
} from 'lucide-react';

const mgxClient = createClient();

// ─── Types ──────────────────────────────────────────────────────────────────

interface WizardState {
  brand_name: string;
  tagline: string;
  website: string;
  industry: string;
  mission: string;
  vision: string;
  brand_values: string[];
  tone_formality: number;
  tone_mood: number;
  tone_energy: number;
  tone_distance: number;
  tone_description: string;
  positioning_statement: string;
  competitive_differentiators: string[];
  dos: string[];
  donts: string[];
  preferred_words: string[];
  forbidden_words: string[];
  brand_colors: string[];
  style_keywords: string[];
  visual_notes: string;
}

const INITIAL_STATE: WizardState = {
  brand_name: '',
  tagline: '',
  website: '',
  industry: '',
  mission: '',
  vision: '',
  brand_values: [],
  tone_formality: 50,
  tone_mood: 50,
  tone_energy: 50,
  tone_distance: 50,
  tone_description: '',
  positioning_statement: '',
  competitive_differentiators: [],
  dos: [],
  donts: [],
  preferred_words: [],
  forbidden_words: [],
  brand_colors: [],
  style_keywords: [],
  visual_notes: '',
};

// Steps: index 0 = Upload, 1–8 = form steps
const STEP_PROGRESS = [0, 10, 20, 30, 40, 50, 60, 80, 99];

// ─── Sub-components ──────────────────────────────────────────────────────────

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  addLabel?: string;
}

function TagInput({ tags, onChange, placeholder = 'Type and press Enter or click Add', addLabel = 'Add More' }: TagInputProps) {
  const [inputVal, setInputVal] = useState('');

  const addTag = () => {
    const trimmed = inputVal.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInputVal('');
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 bg-white rounded-[10px] border border-[#e2e2e2] px-4 py-3 text-[14px] outline-none placeholder:text-[#b0b0b0]"
        />
        <button
          type="button"
          onClick={addTag}
          className="flex items-center gap-2 bg-[#1e1e20] text-white rounded-[10px] px-4 py-2.5 text-[13px] font-medium hover:bg-[#383839] transition-colors shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          {addLabel}
        </button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1.5 bg-white border border-[#e2e2e2] rounded-full px-3 py-1.5 text-[13px] text-[#1e1e20]"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="text-[#908f8e] hover:text-[#1e1e20] transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

interface AIImproveButtonProps {
  text: string;
  onImprove: (improved: string) => void;
}

function AIImproveButton({ text, onImprove }: AIImproveButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleImprove = async () => {
    if (!text.trim() || loading) return;
    setLoading(true);
    try {
      const res = await axios.post('/api/v1/aihub/gentxt', {
        model: 'gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content:
              'You are a brand copywriter. Improve the following text to be more compelling, concise, and on-brand. Return ONLY the improved text, with no preamble or explanation.',
          },
          { role: 'user', content: text },
        ],
      });
      const improved: string =
        res.data?.content ||
        res.data?.text ||
        res.data?.choices?.[0]?.message?.content ||
        '';
      if (improved) onImprove(improved.trim());
    } catch {
      // silently fail — keep original text
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleImprove}
      disabled={loading || !text.trim()}
      className="flex items-center gap-1.5 border border-[#e2e2e2] rounded-[8px] px-3 py-1.5 text-[12px] font-medium text-[#1e1e20] hover:bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {loading ? (
        <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      ) : (
        <Sparkles className="h-3.5 w-3.5" />
      )}
      AI Improve
    </button>
  );
}

interface SliderFieldProps {
  label: string;
  leftLabel: string;
  rightLabel: string;
  value: number;
  onChange: (v: number) => void;
}

function SliderField({ label, leftLabel, rightLabel, value, onChange }: SliderFieldProps) {
  return (
    <div className="space-y-2">
      <label className="text-[14px] font-semibold text-[#1e1e20]">{label}</label>
      <div className="flex items-center gap-3">
        <span className="text-[12px] text-[#595959] shrink-0 w-[70px] text-right">{leftLabel}</span>
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 accent-yellow-400 cursor-pointer"
        />
        <span className="text-[12px] text-[#595959] shrink-0 w-[70px]">{rightLabel}</span>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function BrandCreateWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Upload step state
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const progress = STEP_PROGRESS[step] ?? 0;

  // ── Helpers ────────────────────────────────────────────────────────────────

  const set = useCallback(<K extends keyof WizardState>(key: K, value: WizardState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  }, []);

  const goNext = () => setStep((s) => Math.min(s + 1, 8));
  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  // ── File Upload / Brand DNA Extraction ────────────────────────────────────

  const applyDNA = (dna: Record<string, unknown>) => {
    setState((prev) => {
      const next = { ...prev };
      if (typeof dna.brand_name === 'string') next.brand_name = dna.brand_name;
      if (typeof dna.tagline === 'string') next.tagline = dna.tagline;
      if (typeof dna.industry === 'string') next.industry = dna.industry;
      if (typeof dna.mission === 'string') next.mission = dna.mission;
      if (typeof dna.vision === 'string') next.vision = dna.vision;
      if (typeof dna.tone_of_voice === 'string') next.tone_description = dna.tone_of_voice;
      if (typeof dna.positioning_statement === 'string') next.positioning_statement = dna.positioning_statement;

      // brand_values / brand_personality → chip list
      const vals = dna.brand_values || dna.brand_personality;
      if (Array.isArray(vals)) next.brand_values = vals.map(String);

      // dos / donts
      if (Array.isArray(dna.dos)) next.dos = dna.dos.map(String);
      if (Array.isArray(dna.donts)) next.donts = dna.donts.map(String);

      // colors → brand_colors
      const colorArr: string[] = [];
      if (typeof dna.primary_color === 'string') colorArr.push(dna.primary_color);
      if (typeof dna.secondary_color === 'string') colorArr.push(dna.secondary_color);
      if (typeof dna.accent_color === 'string') colorArr.push(dna.accent_color);
      // nested colors object
      const colorsObj = dna.colors as Record<string, unknown> | undefined;
      if (colorsObj) {
        if (typeof colorsObj.primary === 'string') colorArr.push(colorsObj.primary);
        if (typeof colorsObj.secondary === 'string') colorArr.push(colorsObj.secondary);
        if (typeof colorsObj.accent === 'string') colorArr.push(colorsObj.accent);
      }
      if (colorArr.length) next.brand_colors = [...new Set(colorArr)];

      return next;
    });
  };

  const processFile = async (file: File) => {
    setUploading(true);
    setUploadedFile(file.name);
    try {
      if (file.type === 'application/pdf') {
        const formData = new FormData();
        formData.append('file', file);
        const res = await axios.post('/api/v1/aihub/extract-brand-dna', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        if (res.data?.dna) applyDNA(res.data.dna);
      } else {
        // PNG — convert to base64 and ask gentxt
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const res = await axios.post('/api/v1/aihub/gentxt', {
          model: 'gemini-2.5-flash',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: { type: 'base64', media_type: file.type, data: base64 },
                },
                {
                  type: 'text',
                  text: 'This is a brand asset image. Extract all brand DNA information you can see and return it as a JSON object with keys: brand_name, tagline, industry, mission, vision, brand_values (array), tone_of_voice, positioning_statement, dos (array), donts (array), primary_color, secondary_color, accent_color. Return ONLY valid JSON.',
                },
              ],
            },
          ],
        });
        const raw: string =
          res.data?.content ||
          res.data?.text ||
          res.data?.choices?.[0]?.message?.content ||
          '';
        // Strip markdown code fences if present
        const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
        try {
          const dna = JSON.parse(cleaned);
          applyDNA(dna);
        } catch {
          // JSON parse failed — just advance without pre-fill
        }
      }
      // Advance to step 1
      setStep(1);
    } catch {
      // Upload failed — still advance
      setStep(1);
    } finally {
      setUploading(false);
    }
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type === 'application/pdf' || file.type === 'image/png')) {
      processFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    try {
      const brandDna = JSON.stringify({
        brand_name: state.brand_name,
        tagline: state.tagline,
        industry: state.industry,
        mission: state.mission,
        vision: state.vision,
        brand_values: state.brand_values,
        tone: {
          formality: state.tone_formality,
          mood: state.tone_mood,
          energy: state.tone_energy,
          distance: state.tone_distance,
          description: state.tone_description,
        },
        positioning_statement: state.positioning_statement,
        competitive_differentiators: state.competitive_differentiators,
        dos: state.dos,
        donts: state.donts,
        preferred_words: state.preferred_words,
        forbidden_words: state.forbidden_words,
        brand_colors: state.brand_colors,
        style_keywords: state.style_keywords,
        visual_notes: state.visual_notes,
      });

      await mgxClient.entities.brand_profiles.create({
        data: {
          brand_name: state.brand_name,
          tagline: state.tagline,
          industry: state.industry,
          tone_of_voice: state.tone_description,
          guidelines_notes: state.visual_notes,
          brand_dna: brandDna,
        },
      });

      navigate('/brands');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save brand. Please try again.';
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  };

  // ── Render helpers ────────────────────────────────────────────────────────

  const inputCls =
    'w-full bg-white rounded-[10px] border border-[#e2e2e2] px-4 py-3 text-[14px] outline-none placeholder:text-[#b0b0b0] focus:border-[#1e1e20] transition-colors';
  const textareaCls =
    'w-full bg-white rounded-[12px] border border-[#e2e2e2] px-4 py-3 text-[14px] outline-none placeholder:text-[#b0b0b0] min-h-[130px] resize-none focus:border-[#1e1e20] transition-colors';
  const labelCls = 'text-[14px] font-semibold text-[#1e1e20] mb-2 block';

  // ── Step content ──────────────────────────────────────────────────────────

  const renderStep = () => {
    switch (step) {
      // ── Step 0: Upload ──────────────────────────────────────────────────
      case 0:
        return (
          <div>
            <h2 className="text-[22px] font-bold text-[#1e1e20]">Upload Brand Assets</h2>
            <p className="text-[14px] text-[#595959] mt-1 mb-8">
              Upload a brand PDF or PNG to automatically extract brand DNA and pre-fill the form.
            </p>

            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleFileDrop}
              onClick={() => !uploading && fileInputRef.current?.click()}
              className={`rounded-[20px] border-2 border-dashed bg-white cursor-pointer transition-colors flex flex-col items-center justify-center py-20 px-8 text-center ${
                dragOver ? 'border-[#1e1e20] bg-[#f5f3ef]' : 'border-[#e2e2e2]'
              } ${uploading ? 'cursor-not-allowed opacity-80' : 'hover:border-[#b0b0b0]'}`}
            >
              {uploading ? (
                <>
                  <svg
                    className="h-12 w-12 animate-spin text-[#1e1e20] mb-4"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  <p className="text-[15px] font-semibold text-[#1e1e20]">Processing {uploadedFile}…</p>
                  <p className="text-[13px] text-[#595959] mt-1">Extracting brand DNA, please wait</p>
                </>
              ) : (
                <>
                  <CloudDownload className="h-12 w-12 text-[#908f8e] mb-4" />
                  <p className="text-[15px] font-bold text-[#1e1e20]">
                    Choose a file or Drag and Drop it here
                  </p>
                  <p className="text-[13px] text-[#595959] mt-1">PDF or PNG</p>
                </>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,application/pdf,image/png"
              onChange={handleFileChange}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => setStep(1)}
              disabled={uploading}
              className="mt-6 text-[13px] text-[#595959] underline underline-offset-2 hover:text-[#1e1e20] transition-colors disabled:opacity-40"
            >
              Skip this step →
            </button>
          </div>
        );

      // ── Step 1: Basic Info ──────────────────────────────────────────────
      case 1:
        return (
          <div>
            <h2 className="text-[22px] font-bold text-[#1e1e20]">Basic Info</h2>
            <p className="text-[14px] text-[#595959] mt-1 mb-8">
              Tell us about the brand — the basics that define its identity.
            </p>

            <div className="space-y-5">
              <div>
                <label className={labelCls}>Brand Name</label>
                <input
                  type="text"
                  value={state.brand_name}
                  onChange={(e) => set('brand_name', e.target.value)}
                  placeholder="e.g. Shelby Cycles"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Tagline</label>
                <input
                  type="text"
                  value={state.tagline}
                  onChange={(e) => set('tagline', e.target.value)}
                  placeholder="e.g. Built to ride, made to last"
                  className={inputCls}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Website</label>
                  <input
                    type="text"
                    value={state.website}
                    onChange={(e) => set('website', e.target.value)}
                    placeholder="https://example.com"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Industry</label>
                  <input
                    type="text"
                    value={state.industry}
                    onChange={(e) => set('industry', e.target.value)}
                    placeholder="e.g. Cycling, Fashion, Tech"
                    className={inputCls}
                  />
                </div>
              </div>
            </div>
          </div>
        );

      // ── Step 2: Mission & Vision ────────────────────────────────────────
      case 2:
        return (
          <div>
            <h2 className="text-[22px] font-bold text-[#1e1e20]">Mission & Vision</h2>
            <p className="text-[14px] text-[#595959] mt-1 mb-8">
              Define the brand's purpose and long-term direction.
            </p>

            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={labelCls}>Mission</label>
                  <AIImproveButton
                    text={state.mission}
                    onImprove={(v) => set('mission', v)}
                  />
                </div>
                <textarea
                  value={state.mission}
                  onChange={(e) => set('mission', e.target.value)}
                  placeholder="What is the brand's core purpose? Why does it exist?"
                  className={textareaCls}
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={labelCls}>Vision</label>
                  <AIImproveButton
                    text={state.vision}
                    onImprove={(v) => set('vision', v)}
                  />
                </div>
                <textarea
                  value={state.vision}
                  onChange={(e) => set('vision', e.target.value)}
                  placeholder="Where does the brand aspire to be in 5–10 years?"
                  className={textareaCls}
                />
              </div>
            </div>
          </div>
        );

      // ── Step 3: Core Values ─────────────────────────────────────────────
      case 3:
        return (
          <div>
            <h2 className="text-[22px] font-bold text-[#1e1e20]">Core Values</h2>
            <p className="text-[14px] text-[#595959] mt-1 mb-8">
              Add the values that define the brand's character and culture.
            </p>
            <div>
              <label className={labelCls}>Brand Values</label>
              <TagInput
                tags={state.brand_values}
                onChange={(v) => set('brand_values', v)}
                placeholder="e.g. Authenticity, Innovation, Community…"
                addLabel="Add More"
              />
            </div>
          </div>
        );

      // ── Step 4: Tone of Voice ───────────────────────────────────────────
      case 4:
        return (
          <div>
            <h2 className="text-[22px] font-bold text-[#1e1e20]">Tone of Voice</h2>
            <p className="text-[14px] text-[#595959] mt-1 mb-8">
              Set the brand's personality on each dimension, then describe it in words.
            </p>

            <div className="space-y-6">
              <SliderField
                label="Formality"
                leftLabel="Casual"
                rightLabel="Formal"
                value={state.tone_formality}
                onChange={(v) => set('tone_formality', v)}
              />
              <SliderField
                label="Mood"
                leftLabel="Playful"
                rightLabel="Serious"
                value={state.tone_mood}
                onChange={(v) => set('tone_mood', v)}
              />
              <SliderField
                label="Energy"
                leftLabel="Calm"
                rightLabel="Enthusiastic"
                value={state.tone_energy}
                onChange={(v) => set('tone_energy', v)}
              />
              <SliderField
                label="Distance"
                leftLabel="Friendly"
                rightLabel="Authoritative"
                value={state.tone_distance}
                onChange={(v) => set('tone_distance', v)}
              />

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={labelCls}>Tone Description</label>
                  <AIImproveButton
                    text={state.tone_description}
                    onImprove={(v) => set('tone_description', v)}
                  />
                </div>
                <textarea
                  value={state.tone_description}
                  onChange={(e) => set('tone_description', e.target.value)}
                  placeholder="Describe the brand voice in your own words…"
                  className={textareaCls}
                />
              </div>
            </div>
          </div>
        );

      // ── Step 5: Positioning & Differentiators ───────────────────────────
      case 5:
        return (
          <div>
            <h2 className="text-[22px] font-bold text-[#1e1e20]">
              Brand Positioning & Differentiators
            </h2>
            <p className="text-[14px] text-[#595959] mt-1 mb-8">
              Articulate how the brand stands apart from competitors.
            </p>

            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={labelCls}>Positioning Statement</label>
                  <AIImproveButton
                    text={state.positioning_statement}
                    onImprove={(v) => set('positioning_statement', v)}
                  />
                </div>
                <textarea
                  value={state.positioning_statement}
                  onChange={(e) => set('positioning_statement', e.target.value)}
                  placeholder="For [target audience] who [need/want], [brand] is [category] that [benefit]. Unlike [competitors], [brand] [key differentiator]."
                  className={textareaCls}
                />
              </div>
              <div>
                <label className={labelCls}>Competitive Differentiators</label>
                <TagInput
                  tags={state.competitive_differentiators}
                  onChange={(v) => set('competitive_differentiators', v)}
                  placeholder="e.g. Handcrafted quality, 24/7 support…"
                  addLabel="Add More"
                />
              </div>
            </div>
          </div>
        );

      // ── Step 6: Do's & Don'ts ───────────────────────────────────────────
      case 6:
        return (
          <div>
            <h2 className="text-[22px] font-bold text-[#1e1e20]">Do's & Don'ts</h2>
            <p className="text-[14px] text-[#595959] mt-1 mb-8">
              Set clear guidelines for what the brand should always and never do.
            </p>

            <div className="space-y-8">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-[13px] font-medium text-green-600">
                    <Check className="h-3.5 w-3.5" /> Always Do
                  </span>
                </div>
                <TagInput
                  tags={state.dos}
                  onChange={(v) => set('dos', v)}
                  placeholder="e.g. Use inclusive language, highlight community…"
                  addLabel="Add More"
                />
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[13px] font-medium text-red-500">
                    <X className="h-3.5 w-3.5" /> Never Do
                  </span>
                </div>
                <TagInput
                  tags={state.donts}
                  onChange={(v) => set('donts', v)}
                  placeholder="e.g. Use aggressive sales language, mock competitors…"
                  addLabel="Add More"
                />
              </div>
            </div>
          </div>
        );

      // ── Step 7: Lexicon ─────────────────────────────────────────────────
      case 7:
        return (
          <div>
            <h2 className="text-[22px] font-bold text-[#1e1e20]">Lexicon</h2>
            <p className="text-[14px] text-[#595959] mt-1 mb-8">
              Define the words the brand loves and the ones it avoids.
            </p>

            <div className="space-y-8">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-[13px] font-medium text-green-600">
                    <Check className="h-3.5 w-3.5" /> Preferred Words
                  </span>
                </div>
                <TagInput
                  tags={state.preferred_words}
                  onChange={(v) => set('preferred_words', v)}
                  placeholder="e.g. craft, authentic, bold…"
                  addLabel="Add More"
                />
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[13px] font-medium text-red-500">
                    <X className="h-3.5 w-3.5" /> Forbidden Words
                  </span>
                </div>
                <TagInput
                  tags={state.forbidden_words}
                  onChange={(v) => set('forbidden_words', v)}
                  placeholder="e.g. cheap, discount, generic…"
                  addLabel="Add More"
                />
              </div>
            </div>
          </div>
        );

      // ── Step 8: Visual Style ────────────────────────────────────────────
      case 8:
        return (
          <div>
            <h2 className="text-[22px] font-bold text-[#1e1e20]">Visual Style</h2>
            <p className="text-[14px] text-[#595959] mt-1 mb-8">
              Define the visual language that brings the brand to life.
            </p>

            <div className="space-y-6">
              <div>
                <label className={labelCls}>Brand Colors</label>
                <TagInput
                  tags={state.brand_colors}
                  onChange={(v) => set('brand_colors', v)}
                  placeholder="e.g. #1e1e20, #f59e0b, Midnight Black…"
                  addLabel="Add More"
                />
              </div>
              <div>
                <label className={labelCls}>Style Keywords</label>
                <TagInput
                  tags={state.style_keywords}
                  onChange={(v) => set('style_keywords', v)}
                  placeholder="e.g. Minimal, Industrial, Warm, Bold…"
                  addLabel="Add More"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={labelCls}>Visual Notes</label>
                  <AIImproveButton
                    text={state.visual_notes}
                    onImprove={(v) => set('visual_notes', v)}
                  />
                </div>
                <textarea
                  value={state.visual_notes}
                  onChange={(e) => set('visual_notes', e.target.value)}
                  placeholder="Describe the overall visual direction — photography style, typography feel, layout preferences…"
                  className={textareaCls}
                />
              </div>

              {saveError && (
                <p className="text-[13px] text-red-500 bg-red-50 border border-red-200 rounded-[10px] px-4 py-3">
                  {saveError}
                </p>
              )}

              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !state.brand_name.trim()}
                className="w-full bg-[#1e1e20] text-white rounded-[10px] py-4 text-[15px] font-semibold hover:bg-[#383839] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Saving…
                  </>
                ) : (
                  'Save Brand DNA'
                )}
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // ── Layout ─────────────────────────────────────────────────────────────────

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-[#f5f3ef]">

        {/* Page Header */}
        <div className="px-10 pt-8 pb-2">
          <h1 className="text-[28px] font-bold text-[#1e1e20]">Create New Brand</h1>
          <p className="text-[14px] text-[#595959] mt-1">Start a new Brand DNA by filling the form.</p>
        </div>

        {/* Progress Bar */}
        <div className="px-10 pt-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 h-1 bg-[#e2e2e2] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#1e1e20] rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-[13px] text-[#1e1e20] font-medium shrink-0">{progress}%</span>
          </div>
        </div>

        {/* Form */}
        <div className="max-w-[650px] mx-auto pt-[60px] px-8 pb-16">
          {renderStep()}

          {/* Navigation — skip for step 0 (handled inline) and step 8 (save button) */}
          {step > 0 && step < 8 && (
            <div className="flex items-center justify-end gap-3 mt-10">
              <button
                type="button"
                onClick={goBack}
                className="w-[52px] h-[52px] rounded-full bg-white border border-[#e2e2e2] flex items-center justify-center cursor-pointer hover:bg-[#f5f3ef] transition-colors"
                aria-label="Back"
              >
                <ChevronLeft className="h-5 w-5 text-[#1e1e20]" />
              </button>
              <button
                type="button"
                onClick={goNext}
                className="w-[52px] h-[52px] rounded-full bg-[#1e1e20] flex items-center justify-center cursor-pointer hover:bg-[#383839] transition-colors"
                aria-label="Next"
              >
                <ChevronRight className="h-5 w-5 text-white" />
              </button>
            </div>
          )}

          {/* Step 8 back button */}
          {step === 8 && (
            <div className="flex items-center justify-start mt-6">
              <button
                type="button"
                onClick={goBack}
                className="w-[52px] h-[52px] rounded-full bg-white border border-[#e2e2e2] flex items-center justify-center cursor-pointer hover:bg-[#f5f3ef] transition-colors"
                aria-label="Back"
              >
                <ChevronLeft className="h-5 w-5 text-[#1e1e20]" />
              </button>
            </div>
          )}
        </div>

      </div>
    </SidebarLayout>
  );
}
