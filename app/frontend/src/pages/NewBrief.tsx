import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@metagptx/web-sdk';
import SidebarLayout from '@/components/Sidebar';
import { toast } from 'sonner';
import {
  LayoutGrid, Film, Paintbrush2, Megaphone, Mail, Globe,
  CloudUpload, X, ChevronDown, ArrowLeft, Check, Loader2,
} from 'lucide-react';

const mgxClient = createClient();

/* ── Brief types matching Figma 1:3783 ─────────────────────────── */
const TYPES = [
  { id: 'social_media',    label: 'Social Media',    desc: 'Posts, stories, reels, carousels',    Icon: LayoutGrid  },
  { id: 'video_content',   label: 'Video Content',   desc: 'Intros, ads, explainers, avatars',     Icon: Film        },
  { id: 'brand_design',    label: 'Brand Design',    desc: 'Logos, brand assets, visual identity', Icon: Paintbrush2 },
  { id: 'digital_ads',     label: 'Digital Ads',     desc: 'Banners, ads, email graphics',         Icon: Megaphone   },
  { id: 'email_campaign',  label: 'Email Campaign',  desc: 'Email templates and visuals',          Icon: Mail        },
  { id: 'website_app',     label: 'Website / App',   desc: 'UI mockups, hero images, icons',       Icon: Globe       },
] as const;

type TypeId = typeof TYPES[number]['id'];

/* ── Assignees (static until team API exists) ───────────────────── */
const TEAM = ['Leona Bobi', 'Erblina Kryeziu', 'Marigona Culaj', 'Shalale', 'Darren McGrath'];

export default function NewBrief() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [user, setUser]           = useState<any>(null);
  const [brands, setBrands]       = useState<any[]>([]);
  const [selectedType, setType]   = useState<TypeId | null>(null);
  const [selectedBrand, setBrand] = useState<string | null>(null);
  const [uploadedFile, setFile]   = useState<File | null>(null);
  const [assignee, setAssignee]   = useState<string | null>(null);
  const [dropOpen, setDropOpen]   = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const res = await mgxClient.auth.me();
        setUser(res?.data || null);
        const bRes = await mgxClient.entities.brand_profiles.query({ query: {}, limit: 100 });
        setBrands((bRes?.data?.items as any[]) || []);
      } catch { /* not logged in */ }
    };
    init();
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  };

  const handleCreate = async () => {
    if (!user) { toast.error('Please sign in'); window.location.href = "/auth.html"; return; }
    if (!selectedType) { toast.error('Select a brief type'); return; }

    /* Website/App → open the 3-step wizard */
    if (selectedType === 'website_app') {
      const params = new URLSearchParams();
      if (selectedBrand) params.set('brand', selectedBrand);
      navigate(`/briefs/new/website?${params.toString()}`);
      return;
    }

    setSubmitting(true);
    try {
      const typeLabel = TYPES.find(t => t.id === selectedType)?.label || '';
      const res = await mgxClient.entities.briefs.create({
        data: {
          brief_type: selectedType,
          title: `${selectedBrand || ''} ${typeLabel} Brief`.trim(),
          status: 'new',
          brand_name: selectedBrand || '',
          priority: 'medium',
          additional_notes: assignee ? `Assigned to: ${assignee}` : '',
          form_data: JSON.stringify({ assignee, has_attachment: !!uploadedFile }),
        },
      });
      toast.success('Brief created!');
      const id = (res?.data as any)?.id;
      navigate(id ? `/briefs/${id}` : '/briefs');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create brief');
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Input class helpers ─── */
  const inputCls = 'w-full rounded-lg border border-[#e2e2e2] bg-white px-4 py-2.5 text-sm text-[#1e1e20] placeholder:text-[#c4c4c4] focus:border-[#1e1e20] focus:outline-none';

  return (
    <SidebarLayout>
      <div className="min-h-full bg-[#f5f3ef]">
        <div className="mx-auto max-w-5xl px-8 py-8">

          {/* Back */}
          <button
            onClick={() => navigate('/briefs')}
            className="mb-6 flex items-center gap-2 text-sm text-[#595959] hover:text-[#1e1e20]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </button>

          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-[#1e1e20]">Create New Brief</h1>
            <p className="mt-1 text-sm text-[#8c8c8c]">Start a new creative request by selecting a brief type.</p>
          </div>

          {/* ── Select Type ─────────────────────────────────────── */}
          <section className="mb-8">
            <h2 className="mb-4 text-sm font-semibold text-[#1e1e20]">Select Type</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {TYPES.map(({ id, label, desc, Icon }) => {
                const active = selectedType === id;
                return (
                  <button
                    key={id}
                    onClick={() => setType(id)}
                    className={`flex items-center gap-4 rounded-2xl border-2 bg-white p-4 text-left transition-all ${
                      active ? 'border-[#1e1e20] shadow-sm' : 'border-[#e2e2e2] hover:border-[#c4c4c4]'
                    }`}
                  >
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                      active ? 'border-[#1e1e20] bg-[#1e1e20]' : 'border-[#e2e2e2] bg-[#f9f9f8]'
                    }`}>
                      <Icon className={`h-5 w-5 ${active ? 'text-white' : 'text-[#8c8c8c]'}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#1e1e20]">{label}</p>
                      <p className="truncate text-xs text-[#8c8c8c]">{desc}</p>
                    </div>
                    {active && (
                      <div className="ml-auto shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-[#1e1e20]">
                        <Check className="h-3 w-3 text-white" strokeWidth={3} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* ── Select Brand ─────────────────────────────────────── */}
          {brands.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-4 text-sm font-semibold text-[#1e1e20]">Select Brand</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {brands.map((b) => {
                  const name = b.brand_name || b.name || 'Unnamed Brand';
                  const active = selectedBrand === name;
                  return (
                    <button
                      key={b.id}
                      onClick={() => setBrand(active ? null : name)}
                      className={`rounded-xl border-2 py-3 px-4 text-center text-sm font-medium transition-all ${
                        active
                          ? 'border-[#1e1e20] bg-white text-[#1e1e20] shadow-sm'
                          : 'border-[#e2e2e2] bg-white text-[#595959] hover:border-[#c4c4c4]'
                      }`}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── Add Info (file upload) ────────────────────────────── */}
          <section className="mb-8">
            <h2 className="mb-4 text-sm font-semibold text-[#1e1e20]">Add Info</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Drop zone */}
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#e2e2e2] bg-white py-10 transition-colors hover:border-[#c4c4c4]"
              >
                <CloudUpload className="h-8 w-8 text-[#c4c4c4]" />
                <p className="text-sm font-medium text-[#595959]">Choose a file or Drag and Drop it here</p>
                <p className="text-xs text-[#c4c4c4]">PDF or Google From Doc</p>
                <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </div>

              {/* Uploaded file preview */}
              {uploadedFile && (
                <div className="flex items-start gap-3 rounded-2xl border border-[#e2e2e2] bg-white p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f5f3ef]">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M9 1H4a1 1 0 00-1 1v12a1 1 0 001 1h8a1 1 0 001-1V6L9 1z" stroke="#8c8c8c" strokeWidth="1.2" strokeLinecap="round"/>
                      <path d="M9 1v5h5" stroke="#8c8c8c" strokeWidth="1.2" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#1e1e20]">{uploadedFile.name}</p>
                    <p className="text-xs text-[#8c8c8c]">{(uploadedFile.size / 1024).toFixed(0)} KB</p>
                  </div>
                  <button onClick={() => setFile(null)} className="shrink-0 text-[#c4c4c4] hover:text-[#1e1e20]">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* ── Assignees ─────────────────────────────────────────── */}
          <section className="mb-10">
            <h2 className="mb-4 text-sm font-semibold text-[#1e1e20]">Assignees task</h2>
            <div className="relative max-w-sm">
              <button
                onClick={() => setDropOpen(!dropOpen)}
                className="flex w-full items-center justify-between rounded-xl border border-[#e2e2e2] bg-white px-4 py-3 text-sm text-left"
              >
                <span className={assignee ? 'text-[#1e1e20]' : 'text-[#c4c4c4]'}>
                  {assignee || 'Assignees this task to someone…'}
                </span>
                <ChevronDown className={`h-4 w-4 text-[#8c8c8c] transition-transform ${dropOpen ? 'rotate-180' : ''}`} />
              </button>
              {dropOpen && (
                <div className="absolute z-20 mt-1 w-full rounded-xl border border-[#e2e2e2] bg-white py-1 shadow-lg">
                  {TEAM.map((name) => (
                    <button
                      key={name}
                      onClick={() => { setAssignee(name); setDropOpen(false); }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[#1e1e20] hover:bg-[#f5f3ef]"
                    >
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1e1e20] text-xs font-bold text-white">
                        {name[0]}
                      </div>
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* ── Create Brief button ─────────────────────────────────── */}
          <button
            onClick={handleCreate}
            disabled={submitting || !selectedType}
            className="flex items-center gap-2 rounded-xl bg-[#1e1e20] px-8 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {selectedType === 'website_app' ? 'Continue to Website Brief →' : 'Create Brief'}
          </button>

        </div>
      </div>
    </SidebarLayout>
  );
}
