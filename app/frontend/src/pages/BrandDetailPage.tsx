import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createClient } from '@metagptx/web-sdk';
import axios from 'axios';
import SidebarLayout from '@/components/Sidebar';
import { type BrandProfile } from '@/lib/briefTypes';
import {
  ArrowLeft, Edit2, Save, X, Loader2, Check, AlertCircle,
  Type, Palette, MessageSquare, Image as ImageIcon,
  Upload, FileText, FolderOpen, CheckCircle2, Plus, Trash2, Package, LayoutGrid,
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

              {/* Product Library */}
              <ProductLibrary
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

// ─── Product Library ────────────────────────────────────────────────────────────

interface ProductRef {
  name: string;
  url: string;
}

async function compressToJpeg(dataUrl: string, maxWidth = 900): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.src = dataUrl;
  });
}

function ProductLibrary({
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
      return Array.isArray(dna.product_references) ? dna.product_references : [];
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
      dna.product_references = updated;
      const dnaStr = JSON.stringify(dna);
      await mgxClient.entities.brand_profiles.update({
        id: String(brand.id),
        data: { brand_dna: dnaStr },
      });
      setRefs(updated);
      onUpdated(dnaStr);
      toast.success('Product library updated');
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
        <Package className="h-4 w-4 text-violet-500" />
        <h2 className="text-sm font-semibold text-gray-700">Product Library</h2>
      </div>
      <p className="mb-5 text-xs text-gray-400">
        Upload photos of your specific products — bike, helmet, kit. AI will use these as visual references when generating images so it knows exactly what your products look like.
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

        {isAdmin && (
          <div className="flex flex-col gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Name (e.g. Bike, Helmet, Kit)"
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
              Add Product
            </button>
          </div>
        )}

        {refs.length === 0 && !isAdmin && (
          <p className="col-span-3 text-sm text-gray-400 py-4">No product references added yet.</p>
        )}
      </div>
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
