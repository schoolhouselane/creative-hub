import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createClient } from '@metagptx/web-sdk';
import axios from 'axios';
import SidebarLayout from '@/components/Sidebar';
import { type BrandProfile } from '@/lib/briefTypes';
import {
  ArrowLeft, Edit2, Save, X, Loader2, Check, AlertCircle,
  Type, Palette, MessageSquare, Image as ImageIcon,
  Upload, FileText, FolderOpen, CheckCircle2, Plus, Trash2, Package, LayoutGrid, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

const mgxClient = createClient();

// ─── Helpers ────────────────────────────────────────────────────────────────────

function parseDos(notes: string): string[] {
  const match = notes?.match(/DOS:\n([\s\S]*?)(?:\nDONTS:|$)/);
  if (!match) return [];
  return match[1].split('\n').map((l) => l.replace(/^[-•]\s*/, '').trim()).filter(Boolean);
}

function parseDonts(notes: string): string[] {
  const match = notes?.match(/DONTS:\n([\s\S]*?)(?:\nNOTES:|$)/);
  if (!match) return [];
  return match[1].split('\n').map((l) => l.replace(/^[-•]\s*/, '').trim()).filter(Boolean);
}

function parseNotes(notes: string): string {
  if (!notes) return '';
  return notes
    .replace(/FIGMA_REF:\s*https?:\/\/[^\n]*/g, '')
    .replace(/DOS:\n[\s\S]*?(?=\nDONTS:|$)/, '')
    .replace(/DONTS:\n[\s\S]*?(?=\nNOTES:|$)/, '')
    .replace(/^NOTES:\n?/, '')
    .trim();
}

function parseFigmaRef(notes: string): string | null {
  const match = notes?.match(/FIGMA_REF:\s*(https?:\/\/[^\s\n]+)/);
  return match ? match[1] : null;
}

// ─── Inline Edit Field ──────────────────────────────────────────────────────────
function EditableField({
  label,
  value,
  isAdmin,
  multiline = false,
  onSave,
}: {
  label: string;
  value: string;
  isAdmin: boolean;
  multiline?: boolean;
  onSave: (newValue: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setDraft(value); }, [value]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } catch {
      // error handled in parent
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</p>
        {multiline ? (
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="min-h-[80px] border-violet-300 bg-white text-sm text-gray-900 focus:border-[#1e1e20]"
            autoFocus
          />
        ) : (
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="border-violet-300 bg-white text-sm text-gray-900 focus:border-[#1e1e20]"
            autoFocus
          />
        )}
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="h-7 gap-1.5 bg-violet-600 px-3 text-xs text-[#1e1e20] hover:bg-violet-700"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            Save
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => { setEditing(false); setDraft(value); }}
            className="h-7 px-3 text-xs text-gray-500 hover:bg-gray-100"
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="group space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</p>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
          {value || <span className="italic text-gray-300">Not set</span>}
        </p>
        {isAdmin && (
          <button
            onClick={() => setEditing(true)}
            className="shrink-0 rounded p-1 text-gray-300 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-gray-100 hover:text-gray-600"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Dos / Don'ts Editable ───────────────────────────────────────────────────────
function BulletPanel({
  title,
  items,
  variant,
  isAdmin,
  onSave,
}: {
  title: string;
  items: string[];
  variant: 'do' | 'dont';
  isAdmin: boolean;
  onSave: (lines: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(items.join('\n'));
  const [saving, setSaving] = useState(false);

  useEffect(() => { setDraft(items.join('\n')); }, [items]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const isDo = variant === 'do';
  const iconColor = isDo ? 'text-emerald-500' : 'text-red-400';
  const bgColor = isDo ? 'bg-emerald-50' : 'bg-red-50';
  const icon = isDo ? '✓' : '✕';

  return (
    <div className={`rounded-2xl ${bgColor} p-5`}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        {isAdmin && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="rounded p-1 text-gray-300 hover:bg-white/60 hover:text-gray-600 transition-colors"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="One item per line"
            className="min-h-[120px] border-white/80 bg-white text-sm text-gray-900 focus:border-violet-400"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="h-7 gap-1.5 bg-violet-600 px-3 text-xs text-[#1e1e20] hover:bg-violet-700"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setEditing(false); setDraft(items.join('\n')); }}
              className="h-7 px-3 text-xs text-gray-500 hover:bg-white/60"
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : items.length > 0 ? (
        <ul className="space-y-2.5">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-gray-700">
              <span className={`mt-0.5 shrink-0 font-bold ${iconColor}`}>{icon}</span>
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm italic text-gray-400">
          {isAdmin ? 'Click edit to add items.' : 'No items added yet.'}
        </p>
      )}
    </div>
  );
}

// ─── Main Detail Page ───────────────────────────────────────────────────────────
export default function BrandDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<BrandProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<'dna' | 'assets' | 'guidelines'>('dna');
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const res = await mgxClient.auth.me();
        setIsAdmin(res?.data?.role === 'admin');
      } catch {
        setIsAdmin(false);
      }
      if (id) await fetchProfile(id);
    };
    init();
  }, [id]);

  const fetchProfile = async (profileId: string) => {
    setLoading(true);
    try {
      const res = await mgxClient.entities.brand_profiles.get({ id: profileId });
      if (res?.data) {
        setProfile(res.data as BrandProfile);
      } else {
        setNotFound(true);
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const updateField = async (field: keyof BrandProfile, value: string) => {
    if (!profile) return;
    try {
      await mgxClient.entities.brand_profiles.update({
        id: String(profile.id),
        data: { [field]: value },
      });
      setProfile((p) => p ? { ...p, [field]: value } : p);
      toast.success('Saved');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save');
      throw err;
    }
  };

  const serializeNotes = (
    figmaRef: string | null,
    dos: string,
    donts: string,
    notes: string,
  ) => {
    const parts: string[] = [];
    if (figmaRef) parts.push(`FIGMA_REF: ${figmaRef}`);
    if (dos.trim()) parts.push(`DOS:\n${dos.trim().split('\n').map((l) => `- ${l.trim()}`).join('\n')}`);
    if (donts.trim()) parts.push(`DONTS:\n${donts.trim().split('\n').map((l) => `- ${l.trim()}`).join('\n')}`);
    if (notes.trim()) parts.push(`NOTES:\n${notes.trim()}`);
    return parts.join('\n\n');
  };

  const updateDos = async (dosLines: string) => {
    if (!profile) return;
    const current = profile.guidelines_notes || '';
    const newNotes = serializeNotes(
      parseFigmaRef(current),
      dosLines,
      parseDonts(current).join('\n'),
      parseNotes(current),
    );
    await updateField('guidelines_notes', newNotes);
  };

  const updateDonts = async (dontsLines: string) => {
    if (!profile) return;
    const current = profile.guidelines_notes || '';
    const newNotes = serializeNotes(
      parseFigmaRef(current),
      parseDos(current).join('\n'),
      dontsLines,
      parseNotes(current),
    );
    await updateField('guidelines_notes', newNotes);
  };

  if (loading) {
    return (
      <SidebarLayout>
        <div className="flex min-h-full items-center justify-center bg-[#f5f3ef]">
          <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
        </div>
      </SidebarLayout>
    );
  }

  if (notFound || !profile) {
    return (
      <SidebarLayout>
        <div className="flex min-h-full flex-col items-center justify-center bg-[#f5f3ef] text-center">
          <AlertCircle className="mb-3 h-10 w-10 text-gray-300" />
          <p className="text-lg font-semibold text-gray-700">Brand not found</p>
          <p className="mt-1 text-sm text-gray-400">This brand profile may have been deleted.</p>
          <Button
            variant="ghost"
            onClick={() => navigate('/brands')}
            className="mt-4 text-violet-600 hover:bg-violet-50"
          >
            Back to Brand Management
          </Button>
        </div>
      </SidebarLayout>
    );
  }

  const dos = parseDos(profile.guidelines_notes || '');
  const donts = parseDonts(profile.guidelines_notes || '');
  const generalNotes = parseNotes(profile.guidelines_notes || '');
  const figmaRef = parseFigmaRef(profile.guidelines_notes || '');

  const gradientBg = `linear-gradient(135deg, ${profile.primary_color || '#7c3aed'}ee, ${profile.secondary_color || '#06b6d4'}ee)`;

  return (
    <SidebarLayout>
      <div className="min-h-full bg-[#f5f3ef]">
        {/* Back nav */}
        <div className="border-b border-gray-100 bg-white px-6 py-3">
          <button
            onClick={() => navigate('/brands')}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Brand Management
          </button>
        </div>

        {/* Page header */}
        <div className="border-b border-gray-100 bg-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-[#1e1e20]">Brand Management</h1>
              <p className="mt-0.5 text-sm text-[#595959]">
                Manage brand guidelines and assets for all your clients.
              </p>
            </div>
          </div>
        </div>

        {/* Banner with brand identity */}
        <div
          className="relative h-36 overflow-hidden"
          style={{ background: gradientBg }}
        >
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative flex h-full items-end px-6 pb-0">
            {/* Tabs overlapping banner bottom */}
            <div className="flex items-end gap-1">
              {(['dna', 'assets', 'guidelines'] as const).map((tab) => {
                const labels: Record<string, string> = { dna: profile.brand_name, assets: 'Assets', guidelines: 'Guidelines' };
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`relative rounded-t-xl px-5 py-2.5 text-sm font-semibold transition-all ${
                      isActive
                        ? 'bg-white text-[#1e1e20] shadow-sm'
                        : 'bg-white/20 text-[#1e1e20]/80 hover:bg-white/30'
                    }`}
                  >
                    {labels[tab]}
                    {isActive && (
                      <div className="absolute inset-x-0 bottom-0 h-0.5 bg-violet-600 rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Tab content */}
        {activeTab === 'dna' && (
          <div className="p-6 lg:p-8">
            {/* Admin notice */}
            {!isAdmin && (
              <div className="mb-6 flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                You have read-only access to Brand DNA. Contact your admin to make changes.
              </div>
            )}

            <div className="grid gap-5 lg:grid-cols-2">
              {/* Typography & Voice */}
              <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center gap-2">
                  <Type className="h-4 w-4 text-violet-500" />
                  <h2 className="text-sm font-semibold text-gray-700">Typography</h2>
                </div>
                <div className="space-y-5">
                  <EditableField
                    label="Heading Font"
                    value={profile.font_heading || ''}
                    isAdmin={isAdmin}
                    onSave={(v) => updateField('font_heading', v)}
                  />
                  <EditableField
                    label="Body Font"
                    value={profile.font_body || ''}
                    isAdmin={isAdmin}
                    onSave={(v) => updateField('font_body', v)}
                  />
                  <EditableField
                    label="Tagline"
                    value={profile.tagline || ''}
                    isAdmin={isAdmin}
                    onSave={(v) => updateField('tagline', v)}
                  />
                  <div className="border-t border-gray-50 pt-4">
                    <EditableField
                      label="Tone of Voice"
                      value={profile.tone_of_voice || ''}
                      isAdmin={isAdmin}
                      multiline
                      onSave={(v) => updateField('tone_of_voice', v)}
                    />
                  </div>
                </div>
              </div>

              {/* Brand Colours */}
              <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center gap-2">
                  <Palette className="h-4 w-4 text-violet-500" />
                  <h2 className="text-sm font-semibold text-gray-700">Brand Colours</h2>
                </div>
                <div className="space-y-4">
                  {(
                    [
                      { label: 'Primary Colour', field: 'primary_color' as keyof BrandProfile },
                      { label: 'Secondary Colour', field: 'secondary_color' as keyof BrandProfile },
                      { label: 'Accent Colour', field: 'accent_color' as keyof BrandProfile },
                    ] as const
                  ).map(({ label, field }) => {
                    const colorVal = (profile[field] as string) || '#cccccc';
                    return (
                      <div key={field} className="group flex items-center gap-3">
                        <div
                          className="h-10 w-10 shrink-0 rounded-xl border border-gray-100 shadow-sm"
                          style={{ backgroundColor: colorVal }}
                        />
                        <div className="flex-1">
                          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</p>
                          <p className="font-mono text-sm text-gray-700">{colorVal}</p>
                        </div>
                        {isAdmin && (
                          <label className="cursor-pointer rounded p-1.5 text-gray-300 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-gray-100 hover:text-gray-600">
                            <Edit2 className="h-3.5 w-3.5" />
                            <input
                              type="color"
                              value={colorVal}
                              onChange={(e) => updateField(field, e.target.value)}
                              className="sr-only"
                            />
                          </label>
                        )}
                      </div>
                    );
                  })}
                </div>

                {figmaRef && (
                  <div className="mt-5 border-t border-gray-50 pt-4">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-400">Figma Reference</p>
                    <a
                      href={figmaRef}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-sm text-violet-600 hover:underline"
                    >
                      <ImageIcon className="h-3.5 w-3.5" />
                      Open in Figma
                    </a>
                  </div>
                )}
              </div>

              {/* Dos */}
              <BulletPanel
                title="Brand Do's"
                items={dos}
                variant="do"
                isAdmin={isAdmin}
                onSave={updateDos}
              />

              {/* Don'ts */}
              <BulletPanel
                title="Brand Don'ts"
                items={donts}
                variant="dont"
                isAdmin={isAdmin}
                onSave={updateDonts}
              />

              {/* Product Training */}
              <ProductCategoryManager
                brand={profile}
                isAdmin={isAdmin}
                onUpdated={(dna) => setProfile((p) => p ? { ...p, brand_dna: dna } : p)}
              />

              {/* Layout References */}
              <LayoutReferenceLibrary
                brand={profile}
                isAdmin={isAdmin}
                onUpdated={(dna) => setProfile((p) => p ? { ...p, brand_dna: dna } : p)}
              />

              {/* General Guidelines */}
              {(generalNotes || isAdmin) && (
                <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm lg:col-span-2">
                  <div className="mb-5 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-violet-500" />
                    <h2 className="text-sm font-semibold text-gray-700">Additional Guidelines</h2>
                  </div>
                  <EditableField
                    label=""
                    value={generalNotes}
                    isAdmin={isAdmin}
                    multiline
                    onSave={async (v) => {
                      if (!profile) return;
                      const newNotes = serializeNotes(
                        parseFigmaRef(profile.guidelines_notes || ''),
                        dos.join('\n'),
                        donts.join('\n'),
                        v,
                      );
                      await updateField('guidelines_notes', newNotes);
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'assets' && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
              <ImageIcon className="h-8 w-8 text-gray-300" />
            </div>
            <p className="text-lg font-semibold text-gray-700">Assets</p>
            <p className="mt-1 text-sm text-gray-400">
              Assets generated for {profile.brand_name} will appear here.
            </p>
          </div>
        )}

        {activeTab === 'guidelines' && (
          <GuidelinesTab brand={profile} onDnaUpdated={(dna) => setProfile((p) => p ? { ...p, brand_dna: dna } : p)} />
        )}
      </div>
    </SidebarLayout>
  );
}

// ─── Product Category Manager ───────────────────────────────────────────────────

interface ProductRef {
  name: string;
  url: string;
}

// Returns the original data URL untouched — no resampling, no re-encoding
async function compressToJpeg(dataUrl: string): Promise<string> {
  return dataUrl;
}

type LoraStatus = 'none' | 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

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

interface ProductCategory {
  id: string;
  name: string;
  trigger: string;
  images: Array<{ name: string; url: string; caption?: string }>;
  lora_status: LoraStatus;
  lora_url: string;
  lora_request_id: string;
  lora_progress: number;
  caption_template?: string;
}

function parseDna(brand: BrandProfile): Record<string, unknown> {
  try { return JSON.parse((brand as any).brand_dna ?? '{}'); } catch { return {}; }
}

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function CategoryCard({
  category,
  isAdmin,
  onUpdate,
  onDelete,
  onPersistCategories,
  allCategories,
  approvedFeedback,
}: {
  category: ProductCategory;
  isAdmin: boolean;
  onUpdate: (updated: ProductCategory) => void;
  onDelete: () => void;
  onPersistCategories: (cats: ProductCategory[]) => Promise<void>;
  allCategories: ProductCategory[];
  approvedFeedback: FeedbackItem[];
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(category.name);
  const [editingTrigger, setEditingTrigger] = useState(false);
  const [triggerDraft, setTriggerDraft] = useState(category.trigger);
  const [editingCaptionIdx, setEditingCaptionIdx] = useState<number | null>(null);
  const [captionDraft, setCaptionDraft] = useState('');
  const [newPhotoName, setNewPhotoName] = useState('');
  const [saving, setSaving] = useState(false);
  const [training, setTraining] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingPhotoName = useRef('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if ((category.lora_status === 'IN_QUEUE' || category.lora_status === 'IN_PROGRESS') && category.lora_request_id) {
      startPolling(category.lora_request_id);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const updateCategoryInList = (patch: Partial<ProductCategory>): ProductCategory[] => {
    return allCategories.map((c) => c.id === category.id ? { ...c, ...patch } : c);
  };

  const startPolling = (reqId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await axios.get(`/api/v1/aihub/train-lora/${reqId}`);
        const { status, progress, lora_url, error } = res.data;
        const prog = progress ?? 0;
        if (status === 'COMPLETED' && lora_url) {
          clearInterval(pollRef.current!);
          const updated: ProductCategory = { ...category, lora_status: 'COMPLETED', lora_url, lora_request_id: reqId, lora_progress: 100 };
          onUpdate(updated);
          await onPersistCategories(allCategories.map((c) => c.id === category.id ? updated : c));
          toast.success(`"${category.name}" AI model trained!`);
        } else if (status === 'FAILED') {
          clearInterval(pollRef.current!);
          const updated: ProductCategory = { ...category, lora_status: 'FAILED', lora_request_id: reqId, lora_progress: 0 };
          onUpdate(updated);
          await onPersistCategories(allCategories.map((c) => c.id === category.id ? updated : c));
          toast.error(`Training failed for "${category.name}": ${error || 'Unknown error'}`);
        } else {
          const updated: ProductCategory = { ...category, lora_status: status as LoraStatus, lora_progress: prog };
          onUpdate(updated);
        }
      } catch { /* silent — keep polling */ }
    }, 15000);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setSaving(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const compressed = await compressToJpeg(ev.target?.result as string);
        const name = pendingPhotoName.current || file.name.replace(/\.[^.]+$/, '');
        const updatedCat: ProductCategory = { ...category, images: [...category.images, { name, url: compressed }] };
        const updatedList = allCategories.map((c) => c.id === category.id ? updatedCat : c);
        onUpdate(updatedCat);
        await onPersistCategories(updatedList);
        setNewPhotoName('');
        pendingPhotoName.current = '';
        toast.success('Photo added');
      } catch {
        toast.error('Failed to save photo');
      } finally {
        setSaving(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const saveImageCaption = async (idx: number, caption: string) => {
    const updatedImages = category.images.map((img, i) =>
      i === idx ? { ...img, caption: caption.trim() || undefined } : img
    );
    const updatedCat: ProductCategory = { ...category, images: updatedImages };
    const updatedList = allCategories.map((c) => c.id === category.id ? updatedCat : c);
    onUpdate(updatedCat);
    await onPersistCategories(updatedList);
    setEditingCaptionIdx(null);
  };

  const removePhoto = async (idx: number) => {
    const updatedCat: ProductCategory = { ...category, images: category.images.filter((_, i) => i !== idx) };
    const updatedList = allCategories.map((c) => c.id === category.id ? updatedCat : c);
    onUpdate(updatedCat);
    await onPersistCategories(updatedList);
    toast.success('Photo removed');
  };

  const saveName = async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === category.name) { setEditingName(false); return; }
    const updatedCat: ProductCategory = { ...category, name: trimmed };
    const updatedList = allCategories.map((c) => c.id === category.id ? updatedCat : c);
    onUpdate(updatedCat);
    await onPersistCategories(updatedList);
    setEditingName(false);
    toast.success('Category name saved');
  };

  const saveTrigger = async () => {
    const trimmed = triggerDraft.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!trimmed || trimmed === category.trigger) { setEditingTrigger(false); return; }
    const updatedCat: ProductCategory = { ...category, trigger: trimmed };
    const updatedList = allCategories.map((c) => c.id === category.id ? updatedCat : c);
    onUpdate(updatedCat);
    await onPersistCategories(updatedList);
    setEditingTrigger(false);
    toast.success('Trigger word saved');
  };

  const handleTrain = async () => {
    if (category.images.length < 3) { toast.error('Upload at least 3 photos first'); return; }
    const startedCat: ProductCategory = { ...category, lora_status: 'IN_QUEUE', lora_progress: 0 };
    onUpdate(startedCat);
    try {
      // Per-image caption if set, else fall back to template, else no caption
      // Combine: template (colors/brand) + per-image (angle/details) — never replace
      const builtCaptions = category.images.map(img => {
        const template = category.caption_template?.trim() ?? '';
        const specific = img.caption?.trim() ?? '';
        if (template && specific) return `${template}. ${specific}`;
        return template || specific;
      });
      const captions = builtCaptions.some(c => c) ? builtCaptions : undefined;
      const res = await axios.post('/api/v1/aihub/train-lora', {
        images: category.images.map((i) => i.url),
        trigger_word: category.trigger,
        ...(captions && captions.length > 0 ? { captions } : {}),
      });
      const reqId = res.data.request_id;
      const updatedCat: ProductCategory = { ...startedCat, lora_request_id: reqId };
      const updatedList = allCategories.map((c) => c.id === category.id ? updatedCat : c);
      onUpdate(updatedCat);
      await onPersistCategories(updatedList);
      startPolling(reqId);
      toast.success('Training started! This takes ~20–30 min. You can close this page.');
    } catch (err: any) {
      const resetCat: ProductCategory = { ...category, lora_status: 'none', lora_progress: 0 };
      onUpdate(resetCat);
      toast.error(err?.response?.data?.detail || 'Failed to start training');
    }
  };

  const handleRetrain = async () => {
    if (pollRef.current) clearInterval(pollRef.current);
    const resetCat: ProductCategory = { ...category, lora_status: 'none', lora_url: '', lora_request_id: '', lora_progress: 0 };
    const updatedList = allCategories.map((c) => c.id === category.id ? resetCat : c);
    onUpdate(resetCat);
    await onPersistCategories(updatedList);
  };

  const handleIterativeRetrain = async () => {
    if (approvedFeedback.length === 0) return;
    setTraining(true);
    const triggerWord = category.trigger;

    const allImages = [
      ...category.images.map(i => i.url),
      ...approvedFeedback.map(f => f.image_url),
    ];
    // Per-image captions for originals, template for feedback images
    const origCaptions = category.images.map(img => {
      const template = category.caption_template?.trim() ?? '';
      const specific = img.caption?.trim() ?? '';
      if (template && specific) return `${template}. ${specific}`;
      return template || specific;
    });
    const feedbackCaptions = approvedFeedback.map(() => category.caption_template || '');
    const allCaptions = [...origCaptions, ...feedbackCaptions];
    const captions = allCaptions.some(c => c) ? allCaptions : undefined;

    try {
      const res = await axios.post('/api/v1/aihub/train-lora', {
        images: allImages,
        trigger_word: triggerWord,
        ...(captions ? { captions } : {}),
      });
      const reqId = res.data.request_id;
      const updated: ProductCategory = {
        ...category,
        lora_status: 'IN_QUEUE',
        lora_request_id: reqId,
        lora_progress: 0,
        lora_url: '',
      };
      onUpdate(updated);
      await onPersistCategories(allCategories.map(c => c.id === category.id ? updated : c));
      startPolling(reqId);
      toast.success(`Re-training started with ${allImages.length} images (${category.images.length} original + ${approvedFeedback.length} feedback)`);
    } catch (err: any) {
      setTraining(false);
      toast.error(err?.response?.data?.detail || 'Re-training failed');
    }
  };

  const isTraining = category.lora_status === 'IN_QUEUE' || category.lora_status === 'IN_PROGRESS';
  const needMore = 3 - category.images.length;

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 mb-4">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      {/* Lightbox */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setPreviewUrl(null)}
        >
          <button
            onClick={() => setPreviewUrl(null)}
            className="absolute top-4 right-4 rounded-full bg-white/10 hover:bg-white/20 text-white p-2 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={previewUrl}
            alt="Product preview"
            className="max-h-[90vh] max-w-[90vw] rounded-2xl shadow-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Card header: name + trigger + delete */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5 min-w-0">
          {/* Category name */}
          {editingName ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={saveName}
                onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
                className="text-[14px] font-semibold text-gray-800 border-b border-violet-400 outline-none bg-transparent"
              />
            </div>
          ) : (
            <div className="flex items-center gap-1.5 group/name">
              <span className="text-[14px] font-semibold text-gray-800">{category.name}</span>
              {isAdmin && (
                <button
                  onClick={() => { setEditingName(true); setNameDraft(category.name); }}
                  className="opacity-0 group-hover/name:opacity-100 transition-opacity rounded p-0.5 text-gray-300 hover:text-gray-600"
                >
                  <Edit2 className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
          {/* Trigger word */}
          {editingTrigger ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={triggerDraft}
                onChange={(e) => setTriggerDraft(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                onBlur={saveTrigger}
                onKeyDown={(e) => { if (e.key === 'Enter') saveTrigger(); if (e.key === 'Escape') setEditingTrigger(false); }}
                className="font-mono text-[12px] font-semibold text-white bg-[#1e1e20] rounded px-2 py-0.5 border border-transparent outline-none w-32"
              />
            </div>
          ) : (
            <div className="flex items-center gap-1.5 group/trigger">
              <span className="font-mono text-[12px] font-semibold text-white bg-[#1e1e20] rounded px-2 py-0.5">
                {category.trigger}
              </span>
              {isAdmin && (
                <button
                  onClick={() => { setEditingTrigger(true); setTriggerDraft(category.trigger); }}
                  className="opacity-0 group-hover/trigger:opacity-100 transition-opacity rounded p-0.5 text-gray-300 hover:text-gray-600"
                >
                  <Edit2 className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
        </div>
        {isAdmin && (
          <button
            onClick={onDelete}
            className="shrink-0 rounded-lg p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors"
            title="Delete category"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Caption template field */}
      {isAdmin && (
        <div className="mb-3">
          <label className="block text-[12px] font-semibold text-gray-600 mb-1">Training Caption</label>
          <textarea
            defaultValue={category.caption_template ?? ''}
            placeholder="Describe the product for every image: color, materials, details. e.g. SHELBYBIKE road bicycle, matte cream beige frame #FBECB7, dark brown #502C12 SHELBY logo, black Shimano components, Pirelli tires"
            rows={3}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-[12px] text-gray-800 placeholder:text-gray-400 focus:border-violet-400 focus:outline-none resize-none"
            onBlur={async (e) => {
              const val = e.target.value;
              if (val === (category.caption_template ?? '')) return;
              const updatedCat: ProductCategory = { ...category, caption_template: val };
              const updatedList = allCategories.map((c) => c.id === category.id ? updatedCat : c);
              onUpdate(updatedCat);
              await onPersistCategories(updatedList);
            }}
          />
          <p className="text-[11px] text-gray-400 mt-1">
            This caption is bundled with every image when training. The AI reads it to learn exact colors and details.
          </p>
        </div>
      )}

      {/* Image grid */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {category.images.map((img, i) => (
          <div key={i} className="group relative rounded-xl overflow-hidden border border-gray-200 shadow-sm">
            <div
              className="relative cursor-zoom-in"
              onClick={() => setPreviewUrl(img.url)}
            >
              <img src={img.url} alt={img.name} className="h-[120px] w-full object-cover" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
                <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 text-white text-[11px] font-medium px-2.5 py-1 rounded-full backdrop-blur-sm">
                  Preview
                </span>
              </div>
            </div>
            <div className="bg-white px-2 py-1.5 flex items-center justify-between gap-1">
              <span className="flex-1 min-w-0 text-[12px] font-medium text-gray-700 truncate">{img.name}</span>
              {isAdmin && (
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={() => { setEditingCaptionIdx(i); setCaptionDraft(img.caption ?? category.caption_template ?? ''); }}
                    className={`rounded p-0.5 transition-colors ${img.caption ? 'text-violet-500 hover:bg-violet-50' : 'text-gray-300 hover:bg-gray-100 hover:text-gray-500'}`}
                    title={img.caption ? 'Edit caption' : 'Add caption'}
                  >
                    <MessageSquare className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => removePhoto(i)}
                    className="rounded p-0.5 text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
            {/* Per-image caption editor */}
            {editingCaptionIdx === i && (
              <div className="bg-violet-50 border-t border-violet-200 p-2">
                <textarea
                  value={captionDraft}
                  onChange={(e) => setCaptionDraft(e.target.value)}
                  placeholder="Describe this specific photo — angle, what's visible, crop..."
                  className="w-full text-[11px] text-gray-700 bg-white border border-violet-200 rounded-lg px-2 py-1.5 resize-none outline-none min-h-[60px]"
                  autoFocus
                />
                <div className="flex gap-1.5 mt-1.5">
                  <button onClick={() => saveImageCaption(i, captionDraft)} className="flex-1 bg-violet-600 text-white text-[11px] font-medium rounded-lg py-1 hover:bg-violet-700 transition-colors">Save</button>
                  <button onClick={() => setEditingCaptionIdx(null)} className="flex-1 text-[11px] text-gray-500 border border-gray-200 rounded-lg py-1 hover:bg-gray-50 transition-colors">Cancel</button>
                </div>
              </div>
            )}
          </div>
        ))}

        {isAdmin && (
          <button
            onClick={() => { pendingPhotoName.current = ''; fileInputRef.current?.click(); }}
            disabled={saving}
            className="flex items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-gray-200 bg-white h-[120px] text-[12px] text-gray-500 hover:border-violet-300 hover:bg-violet-50/40 hover:text-violet-700 transition-colors"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Add photo
          </button>
        )}

        {category.images.length === 0 && !isAdmin && (
          <p className="col-span-3 text-[12px] text-gray-400 py-3">No photos added yet.</p>
        )}
      </div>

      {/* Train / status section */}
      {isAdmin && (
        <>
        <div className={`rounded-lg p-3 border ${category.lora_status === 'COMPLETED' ? 'bg-green-50 border-green-200' : category.lora_status === 'FAILED' ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
          {category.lora_status === 'COMPLETED' ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500">
                  <Check className="h-3 w-3 text-white" />
                </span>
                <span className="text-[13px] font-semibold text-green-800">Trained</span>
              </div>
              <button onClick={handleRetrain} className="text-[12px] text-gray-500 hover:text-gray-700 underline">
                Re-train
              </button>
            </div>
          ) : isTraining ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-700">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-yellow-500" />
                  Training {category.lora_progress > 0 ? `${category.lora_progress}%` : '…'}
                </span>
                <span className="text-[12px] text-gray-400">
                  {category.lora_status === 'IN_QUEUE' ? 'Queued' : `${category.lora_progress}%`}
                </span>
              </div>
              <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-yellow-400 rounded-full transition-all"
                  style={{ width: `${category.lora_progress > 0 ? category.lora_progress : 5}%` }}
                />
              </div>
            </div>
          ) : category.lora_status === 'FAILED' ? (
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-red-700">Training failed</span>
              <button
                onClick={handleTrain}
                className="flex items-center gap-1.5 rounded-lg bg-red-600 text-white px-3 py-1.5 text-[12px] font-medium hover:bg-red-700 transition-colors"
              >
                <Sparkles className="h-3 w-3" /> Retry
              </button>
            </div>
          ) : category.images.length >= 3 ? (
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-gray-600">
                {category.images.length} photos ready
              </span>
              <button
                onClick={handleTrain}
                className="flex items-center gap-1.5 bg-[#1e1e20] text-white rounded-lg px-4 py-2 text-[13px] font-medium hover:bg-[#2d2d30] transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Train AI Model
              </button>
            </div>
          ) : (
            <p className="text-[12px] text-gray-400">
              Upload {needMore} more photo{needMore !== 1 ? 's' : ''} to enable training
            </p>
          )}
        </div>

        {/* Feedback Training section — only when COMPLETED and approved feedback exists */}
        {category.lora_status === 'COMPLETED' && approvedFeedback.length > 0 && (
          <div className="mt-3 rounded-xl bg-violet-50 border border-violet-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold text-violet-800">
                  Feedback Training Available
                </p>
                <p className="text-[12px] text-violet-600 mt-0.5">
                  {approvedFeedback.length} approved image{approvedFeedback.length !== 1 ? 's' : ''} collected — re-train to improve accuracy
                </p>
              </div>
              <button
                onClick={handleIterativeRetrain}
                disabled={training}
                className="flex items-center gap-2 bg-violet-600 text-white rounded-lg px-4 py-2 text-[13px] font-medium hover:bg-violet-700 disabled:opacity-40 transition-colors"
              >
                {training ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Re-train with Feedback
              </button>
            </div>
            {/* Thumbnail strip */}
            <div className="flex gap-1.5 mt-3 overflow-x-auto">
              {approvedFeedback.slice(0, 8).map((f, i) => (
                <img key={i} src={f.image_url} alt="approved" className="h-12 w-12 rounded-lg object-cover flex-shrink-0 border border-violet-200" />
              ))}
              {approvedFeedback.length > 8 && (
                <div className="h-12 w-12 rounded-lg bg-violet-200 flex items-center justify-center flex-shrink-0 text-[11px] font-semibold text-violet-700">
                  +{approvedFeedback.length - 8}
                </div>
              )}
            </div>
          </div>
        )}
        </>
      )}
    </div>
  );
}

function ProductCategoryManager({
  brand,
  isAdmin,
  onUpdated,
}: {
  brand: BrandProfile;
  isAdmin: boolean;
  onUpdated: (dna: string) => void;
}) {
  const dna0 = parseDna(brand);
  const [categories, setCategories] = useState<ProductCategory[]>(() => {
    const raw = dna0.product_categories;
    return Array.isArray(raw) ? (raw as ProductCategory[]) : [];
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatTrigger, setNewCatTrigger] = useState('');
  const [adding, setAdding] = useState(false);

  const allFeedback: FeedbackItem[] = (() => {
    try {
      const dna = parseDna(brand);
      return Array.isArray(dna.training_feedback) ? dna.training_feedback as FeedbackItem[] : [];
    } catch { return []; }
  })();
  const approvedFeedback = allFeedback.filter(f => f.type === 'approved');

  const persistCategories = async (updated: ProductCategory[]) => {
    const dna = parseDna(brand);
    dna.product_categories = updated;
    const dnaStr = JSON.stringify(dna);
    await mgxClient.entities.brand_profiles.update({ id: String(brand.id), data: { brand_dna: dnaStr } });
    onUpdated(dnaStr);
  };

  const handleCategoryUpdate = (updated: ProductCategory) => {
    setCategories((prev) => prev.map((c) => c.id === updated.id ? updated : c));
  };

  const handleDelete = async (id: string) => {
    const updated = categories.filter((c) => c.id !== id);
    setCategories(updated);
    await persistCategories(updated);
    toast.success('Category deleted');
  };

  const handleAddCategory = async () => {
    const name = newCatName.trim();
    const trigger = newCatTrigger.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!name) { toast.error('Enter a category name'); return; }
    if (!trigger) { toast.error('Enter a trigger word'); return; }
    setAdding(true);
    const newCat: ProductCategory = {
      id: generateId(),
      name,
      trigger,
      images: [],
      lora_status: 'none',
      lora_url: '',
      lora_request_id: '',
      lora_progress: 0,
    };
    const updated = [...categories, newCat];
    try {
      await persistCategories(updated);
      setCategories(updated);
      setNewCatName('');
      setNewCatTrigger('');
      setShowAddForm(false);
      toast.success('Category created');
    } catch {
      toast.error('Failed to create category');
    } finally {
      setAdding(false);
    }
  };

  const autoTrigger = (name: string): string => {
    const base = brand.brand_name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    const suffix = name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    return base + suffix;
  };

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm lg:col-span-2">
      {/* Header */}
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-violet-500" />
          <h2 className="text-sm font-semibold text-gray-700">Product Training</h2>
        </div>
        {isAdmin && (
          <button
            onClick={() => {
              setShowAddForm((v) => !v);
              setNewCatName('');
              setNewCatTrigger('');
            }}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-[13px] font-medium text-gray-700 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Category
          </button>
        )}
      </div>
      <p className="mb-5 text-xs text-gray-400">
        Train separate AI models per product. Each gets its own trigger word.
      </p>

      {/* Inline add form */}
      {showAddForm && isAdmin && (
        <div className="mb-4 rounded-xl border border-violet-200 bg-violet-50/40 p-4">
          <p className="mb-3 text-[13px] font-semibold text-gray-700">New Category</p>
          <div className="flex flex-col gap-2.5">
            <input
              type="text"
              value={newCatName}
              onChange={(e) => {
                setNewCatName(e.target.value);
                if (!newCatTrigger || newCatTrigger === autoTrigger(newCatName)) {
                  setNewCatTrigger(autoTrigger(e.target.value));
                }
              }}
              placeholder="Category name (e.g. Shelby Urban Bike)"
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-[13px] text-gray-800 placeholder:text-gray-400 focus:border-violet-400 focus:outline-none"
            />
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newCatTrigger}
                onChange={(e) => setNewCatTrigger(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="Trigger word (e.g. SHELBYBIKE)"
                className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 font-mono text-[13px] text-gray-800 placeholder:text-gray-400 focus:border-violet-400 focus:outline-none"
              />
              <span className="text-[11px] text-gray-400">auto-generated</span>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleAddCategory}
                disabled={adding}
                className="flex items-center gap-1.5 bg-[#1e1e20] text-white rounded-lg px-4 py-2 text-[13px] font-medium hover:bg-[#2d2d30] disabled:opacity-40 transition-colors"
              >
                {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Create
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="rounded-lg px-4 py-2 text-[13px] text-gray-500 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category cards */}
      {categories.length > 0 ? (
        categories.map((cat) => (
          <CategoryCard
            key={cat.id}
            category={cat}
            isAdmin={isAdmin}
            onUpdate={handleCategoryUpdate}
            onDelete={() => handleDelete(cat.id)}
            onPersistCategories={persistCategories}
            allCategories={categories}
            approvedFeedback={approvedFeedback}
          />
        ))
      ) : (
        !showAddForm && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
              <Package className="h-7 w-7 text-gray-300" />
            </div>
            <p className="text-[14px] font-semibold text-gray-700">No product categories yet</p>
            <p className="mt-1 text-[13px] text-gray-400 max-w-xs">
              Add your first category to start training brand-specific AI models.
            </p>
          </div>
        )
      )}
    </div>
  );
}

// ─── Layout Reference Library ────────────────────────────────────────────────────

function LayoutReferenceLibrary({
  brand,
  isAdmin,
  onUpdated,
}: {
  brand: BrandProfile;
  isAdmin: boolean;
  onUpdated: (dna: string) => void;
}) {
  const [refs, setRefs] = useState<ProductRef[]>(() => {
    try {
      const dna = JSON.parse((brand as any).brand_dna ?? '{}');
      return Array.isArray(dna.layout_references) ? dna.layout_references : [];
    } catch { return []; }
  });
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingName = useRef('');

  const persist = async (updated: ProductRef[]) => {
    setSaving(true);
    try {
      let dna: Record<string, unknown> = {};
      try { dna = JSON.parse((brand as any).brand_dna ?? '{}'); } catch { /**/ }
      dna.layout_references = updated;
      const dnaStr = JSON.stringify(dna);
      await mgxClient.entities.brand_profiles.update({
        id: String(brand.id),
        data: { brand_dna: dnaStr },
      });
      setRefs(updated);
      onUpdated(dnaStr);
      toast.success('Layout references updated');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const raw = ev.target?.result as string;
      const compressed = await compressToJpeg(raw);
      const name = pendingName.current || file.name.replace(/\.[^.]+$/, '');
      await persist([...refs, { name, url: compressed }]);
      setNewName('');
      pendingName.current = '';
    };
    reader.readAsDataURL(file);
  };

  const remove = (idx: number) => persist(refs.filter((_, i) => i !== idx));

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm lg:col-span-2">
      <div className="mb-1 flex items-center gap-2">
        <LayoutGrid className="h-4 w-4 text-violet-500" />
        <h2 className="text-sm font-semibold text-gray-700">Layout References</h2>
      </div>
      <p className="mb-5 text-xs text-gray-400">
        Upload example posts showing your preferred typography placement and logo position. The AI will use these as layout templates when generating new images.
      </p>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      <div className="grid grid-cols-3 gap-3">
        {refs.map((ref, i) => (
          <div key={i} className="group relative rounded-xl overflow-hidden border border-gray-100 shadow-sm">
            <img src={ref.url} alt={ref.name} className="h-[120px] w-full object-cover" />
            <div className="bg-white px-3 py-2 flex items-center justify-between">
              <span className="text-[13px] font-medium text-gray-700 truncate">{ref.name}</span>
              {isAdmin && (
                <button
                  onClick={() => remove(i)}
                  className="ml-2 shrink-0 rounded-lg p-1 text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}

        {isAdmin && refs.length < 5 && (
          <div className="flex flex-col gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Name (e.g. Portrait Ad, Square Post)"
              className="rounded-lg border border-gray-200 px-3 py-2 text-[13px] text-gray-700 placeholder:text-gray-400 focus:border-violet-400 focus:outline-none"
            />
            <button
              onClick={() => {
                pendingName.current = newName;
                fileInputRef.current?.click();
              }}
              disabled={saving}
              className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 h-[86px] text-[13px] text-gray-500 hover:border-violet-300 hover:bg-violet-50/40 hover:text-violet-700 transition-colors"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add Layout
            </button>
          </div>
        )}

        {refs.length === 0 && !isAdmin && (
          <p className="col-span-3 text-sm text-gray-400 py-4">No layout references added yet.</p>
        )}
      </div>
    </div>
  );
}

// ─── Guidelines Tab ─────────────────────────────────────────────────────────────

function GuidelinesTab({
  brand,
  onDnaUpdated,
}: {
  brand: BrandProfile;
  onDnaUpdated: (dna: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [files, setFiles] = useState<{ name: string; relative_path: string; size_kb: number }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    axios.get(`/api/v1/entities/brand_profiles/${brand.id}/files`)
      .then((r) => setFiles(r.data.files || []))
      .catch(() => {});
  }, [brand.id]);

  const handleUpload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Only PDF files are accepted');
      return;
    }
    setUploading(true);
    setResult(null);
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await axios.post(
        `/api/v1/entities/brand_profiles/${brand.id}/upload-guidelines`,
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      setResult(res.data);
      setFiles(res.data.files || []);
      onDnaUpdated(JSON.stringify(res.data.dna));
      toast.success('Brand guidelines extracted and saved!');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleUpload(f);
    e.target.value = '';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleUpload(f);
  };

  let dna: Record<string, any> | null = null;
  if (brand.brand_dna) {
    try { dna = JSON.parse(brand.brand_dna); } catch { dna = null; }
  }
  if (result?.dna) dna = result.dna;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => !uploading && fileRef.current?.click()}
        className={`relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer transition-all ${
          dragOver ? 'border-[#1e1e20] bg-white' : 'border-[#e2e2e2] bg-white hover:border-[#1e1e20] hover:bg-[#f5f3ef]'
        }`}
      >
        <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={onFileInput} />
        {uploading ? (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-[#595959]" />
            <p className="text-[15px] font-semibold text-[#1e1e20]">Reading PDF with Gemini…</p>
            <p className="text-[13px] text-[#595959]">Extracting brand DNA — this takes 15–30 seconds</p>
          </>
        ) : (
          <>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f5f3ef]">
              <Upload className="h-7 w-7 text-[#1e1e20]" />
            </div>
            <div>
              <p className="text-[15px] font-semibold text-[#1e1e20]">Upload Brand Guidelines PDF</p>
              <p className="text-[13px] text-[#595959] mt-1">Drag & drop or click — up to 50 pages, 50 MB</p>
            </div>
            <p className="text-[12px] text-[#8c8c8c]">
              Gemini will read the document and extract colours, fonts, tone, values, audience and more
            </p>
          </>
        )}
      </div>

      {/* Brand folder files */}
      {files.length > 0 && (
        <div className="rounded-2xl bg-white border border-[#e2e2e2] p-5">
          <div className="flex items-center gap-2 mb-4">
            <FolderOpen className="h-4 w-4 text-[#595959]" />
            <p className="text-[13px] font-semibold text-[#1e1e20] uppercase tracking-wider">Brand Folder</p>
          </div>
          <div className="space-y-2">
            {files.map((f) => (
              <div key={f.relative_path} className="flex items-center gap-3 rounded-lg bg-[#f5f3ef] px-3 py-2">
                <FileText className="h-4 w-4 text-[#595959] flex-shrink-0" />
                <span className="text-[13px] text-[#1e1e20] flex-1 truncate">{f.name}</span>
                <span className="text-[11px] text-[#8c8c8c]">{f.size_kb} KB</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Extracted DNA preview */}
      {dna && (
        <div className="rounded-2xl bg-white border border-[#e2e2e2] p-5">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <p className="text-[13px] font-semibold text-[#1e1e20] uppercase tracking-wider">Extracted Brand DNA</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(dna)
              .filter(([, v]) => v && (typeof v === 'string' ? v.trim() : (Array.isArray(v) ? v.length > 0 : true)))
              .map(([key, value]) => (
                <div key={key} className="rounded-lg bg-[#f5f3ef] px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8c8c8c] mb-1">
                    {key.replace(/_/g, ' ')}
                  </p>
                  <p className="text-[13px] text-[#1e1e20] leading-snug">
                    {Array.isArray(value) ? value.join(', ') : String(value)}
                  </p>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
