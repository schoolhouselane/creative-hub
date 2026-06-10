import { useState, useEffect } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { clientAuthApi, clientToken, ClientUser } from '@/lib/clientAuth';
import axios from 'axios';
import { NexusWizard, GenesisWizard, EvolutionWizard, VelocityWizard } from './ClientBriefWizards';
import {
  LayoutGrid, Film, Paintbrush2, Megaphone, Mail, Globe,
  LogOut, FileText, Plus, ArrowRight, Clock, ChevronRight,
  Loader2, CheckCircle2, ArrowLeft, CalendarDays, Tag, Banknote,
  AlertCircle, Users, Link as LinkIcon, Check,
} from 'lucide-react';

/* ─── Types ─── */

// Strategic briefs (multi-phase wizards)
const STRATEGIC_TYPES = [
  { id: 'the_nexus',     label: 'The Nexus',     codename: 'General Creative Brief', desc: 'Integrated campaigns, product launches, rebrands, always-on social', icon: Megaphone,   color: '#7c3aed' },
  { id: 'the_genesis',   label: 'The Genesis',   codename: 'Full Brand Design',      desc: 'New brand built from absolute scratch — strategy to identity',        icon: Paintbrush2, color: '#f59e0b' },
  { id: 'the_evolution', label: 'The Evolution', codename: 'Brand Refresh',          desc: 'Modernise an existing brand without a full rebrand',                  icon: Globe,       color: '#0ea5e9' },
  { id: 'the_engine',    label: 'The Engine',    codename: 'SME Lead-Gen Website',   desc: 'Website + CRM + automation pipeline for SMEs',                        icon: LayoutGrid,  color: '#10b981' },
  { id: 'the_velocity',  label: 'The Velocity',  codename: '30-Day Content Plan',    desc: 'Monthly social media content planning and activation',                icon: Film,        color: '#ef4444' },
] as const;

// Creative production briefs (quick-fill forms)
const PRODUCTION_TYPES = [
  { id: 'social_media',   label: 'Social Media',   desc: 'Posts, stories, reels, carousels',    icon: LayoutGrid,  color: '#7c3aed' },
  { id: 'video_content',  label: 'Video Content',  desc: 'Intros, ads, explainers, avatars',     icon: Film,        color: '#0ea5e9' },
  { id: 'brand_design',   label: 'Brand Design',   desc: 'Logos, brand assets, visual identity', icon: Paintbrush2, color: '#f59e0b' },
  { id: 'digital_ads',    label: 'Digital Ads',    desc: 'Banners, ads, email graphics',         icon: Megaphone,   color: '#ef4444' },
  { id: 'email_campaign', label: 'Email Campaign', desc: 'Email templates and visuals',          icon: Mail,        color: '#10b981' },
  { id: 'website_app',    label: 'Website / App',  desc: 'UI mockups, hero images, icons',       icon: Globe,       color: '#6366f1' },
] as const;

const BRIEF_TYPES = [...STRATEGIC_TYPES, ...PRODUCTION_TYPES] as const;

type StrategicId = typeof STRATEGIC_TYPES[number]['id'];
type ProductionId = typeof PRODUCTION_TYPES[number]['id'];
type BriefTypeId = StrategicId | ProductionId;

type FieldDef = { label: string; placeholder: string; key: string; type?: 'text' | 'date' | 'url'; span?: 2 };

const STRATEGIC_ROUTES: Record<StrategicId, string> = {
  the_nexus: '/client/briefs/new/nexus',
  the_genesis: '/client/briefs/new/genesis',
  the_evolution: '/client/briefs/new/evolution',
  the_engine: '/client/briefs/new/website',
  the_velocity: '/client/briefs/new/velocity',
};

// Quick-fill fields only for production types
const TYPE_FIELDS: Partial<Record<BriefTypeId, FieldDef[]>> = {
  social_media: [
    { label: 'Platform(s)', key: 'platform', placeholder: 'e.g. Instagram, TikTok, LinkedIn' },
    { label: 'Format', key: 'format', placeholder: 'e.g. Feed posts, Stories, Reels, Carousels' },
    { label: 'Number of Assets', key: 'quantity', placeholder: 'e.g. 10 posts, 5 Stories' },
    { label: 'Posting Frequency', key: 'frequency', placeholder: 'e.g. 3× per week, Daily during campaign' },
    { label: 'Content Theme / Direction', key: 'key_message', placeholder: 'What mood, message, or story?' },
    { label: 'Brand Assets Ready?', key: 'assets_ready', placeholder: 'e.g. Yes — logos, fonts, colours provided / No — need from you' },
  ],
  video_content: [
    { label: 'Video Type', key: 'video_type', placeholder: 'e.g. Brand explainer, Paid ad, Intro, Testimonial' },
    { label: 'Duration', key: 'duration', placeholder: 'e.g. 15s for ads, 90s for explainer' },
    { label: 'Platform / Destination', key: 'platform', placeholder: 'e.g. YouTube, Instagram Reels, Website homepage' },
    { label: 'Script / Brief Available?', key: 'script_notes', placeholder: 'Have a script? Talking points? Or need full copy?' },
    { label: 'Voiceover', key: 'voiceover', placeholder: 'e.g. Male/Female, Energetic, No VO — music only' },
    { label: 'Music / Sound Direction', key: 'music_direction', placeholder: 'e.g. Upbeat electronic, Cinematic, Client brand track' },
    { label: 'Raw Footage Available?', key: 'footage', placeholder: 'e.g. Yes — 3 product videos / No — create from scratch' },
    { label: 'Key Message', key: 'key_message', placeholder: 'What should viewers feel or do after watching?' },
  ],
  brand_design: [
    { label: 'Deliverables', key: 'deliverables', placeholder: 'e.g. Logo suite, Brand guidelines PDF, Icon set, Stationery' },
    { label: 'Style Direction', key: 'style_direction', placeholder: 'e.g. Modern & minimal, Bold & premium, Friendly & approachable' },
    { label: 'Colour Preferences', key: 'color_preferences', placeholder: 'Existing colours to keep? Colours to avoid?' },
    { label: 'Existing Brand Elements', key: 'existing_elements', placeholder: 'What already exists that must stay? (e.g. old logo, brand colours)' },
    { label: 'Where Will It Be Used?', key: 'usage', placeholder: 'e.g. Digital only, Print + digital, Signage, Packaging, Merchandise' },
    { label: 'Competitors / Inspiration', key: 'competitors', placeholder: 'Brand names or URLs you admire or want to stand apart from' },
  ],
  digital_ads: [
    { label: 'Ad Platform', key: 'platform', placeholder: 'e.g. Google Display, Meta (Facebook/Instagram), LinkedIn, TikTok' },
    { label: 'Ad Sizes / Dimensions', key: 'dimensions', placeholder: 'e.g. 1200×628, 300×250, 160×600 — or "all standard sizes"' },
    { label: 'Campaign Objective', key: 'campaign_objective', placeholder: 'e.g. Lead generation, Brand awareness, Retargeting, App installs' },
    { label: 'Primary CTA Text', key: 'key_message', placeholder: 'e.g. Get a Free Quote, Book a Demo, Shop Now' },
    { label: 'Landing Page URL', key: 'landing_page_url', type: 'url', placeholder: 'Where does the ad click go?' },
    { label: 'Number of Ad Variants', key: 'quantity', placeholder: 'e.g. 3 creative variants per size' },
  ],
  email_campaign: [
    { label: 'Email Type', key: 'email_type', placeholder: 'e.g. Newsletter, Promotional blast, Welcome series, Abandoned cart' },
    { label: 'Number of Emails', key: 'quantity', placeholder: 'e.g. 1 broadcast, 5-step drip sequence' },
    { label: 'Email Platform / ESP', key: 'platform', placeholder: 'e.g. Klaviyo, Mailchimp, HubSpot, ActiveCampaign' },
    { label: 'List Size (approx.)', key: 'list_size', placeholder: 'e.g. 2,500 subscribers' },
    { label: 'Primary CTA', key: 'key_message', placeholder: 'What action should readers take? e.g. Book a call, Buy now' },
    { label: 'Brand Tone', key: 'tone', placeholder: 'e.g. Professional, Conversational, Urgent, Friendly' },
  ],
  website_app: [
    { label: 'Project Scope', key: 'page_type', placeholder: 'e.g. Full website (8 pages), Single landing page, Redesign of existing site' },
    { label: 'Number of Pages / Sections', key: 'page_count', placeholder: 'e.g. 6 pages: Home, About, Services, Case Studies, Blog, Contact' },
    { label: 'Primary Goal of the Website', key: 'key_message', placeholder: 'e.g. Generate leads, Sell products, Build credibility, Book consultations' },
    { label: 'Platform / Tech Stack', key: 'platform', placeholder: 'e.g. WordPress, Webflow, Shopify, Next.js — or "open to recommendation"' },
    { label: 'Content Ready?', key: 'content_ready', placeholder: 'e.g. Copy & images provided / Need copywriting / Have images but no copy' },
    { label: 'Key Integrations Needed', key: 'integrations', placeholder: 'e.g. HubSpot CRM, Calendly booking, Stripe payments, Live chat, Email forms' },
    { label: 'SEO Requirements', key: 'seo', placeholder: 'e.g. SEO-optimised copy & structure needed / Basic meta tags only / Full SEO audit' },
    { label: 'Existing Website URL', key: 'existing_url', type: 'url', placeholder: 'Paste current site if this is a redesign (leave blank if new build)' },
    { label: 'Style & References', key: 'style_direction', placeholder: 'URLs of sites you love. Describe the feel: minimal, bold, editorial, corporate…' },
    { label: 'Device Focus', key: 'device_focus', placeholder: 'e.g. Mobile-first, Desktop, Fully responsive' },
  ],
};

/* ─── Sidebar ─── */

function ClientSidebar({ user, onLogout }: { user: ClientUser | null; onLogout: () => void }) {
  return (
    <aside className="flex w-[220px] shrink-0 flex-col bg-[#1e1e20] text-white">
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white/10">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 8h12M8 2l6 6-6 6" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <p className="text-xs font-semibold leading-none">Schoolhouse Lane</p>
          <p className="mt-0.5 text-[10px] text-white/40">Client Portal</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-4">
        <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-white/30">Workspace</p>
        {[
          { to: '/client', label: 'Dashboard', icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4"/><rect x="8" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4"/><rect x="1" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4"/><rect x="8" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4"/></svg> },
          { to: '/client/briefs', label: 'All Briefs', icon: <FileText className="h-4 w-4" /> },
          { to: '/client/briefs/new', label: 'New Brief', icon: <Plus className="h-4 w-4" /> },
        ].map(({ to, label, icon }) => (
          <Link key={to} to={to}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/80 hover:bg-white/10">
            {icon}{label}
          </Link>
        ))}
      </nav>

      <div className="border-t border-white/10 px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-white">{user?.company_name || user?.email}</p>
            <p className="truncate text-[10px] text-white/40">{user?.email}</p>
          </div>
          <button
            onClick={onLogout}
            title="Sign out"
            className="ml-2 shrink-0 rounded-md p-1.5 text-white/40 hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

/* ─── Brief card in list ─── */

function BriefCard({ brief }: { brief: any }) {
  const navigate = useNavigate();
  const type = BRIEF_TYPES.find((t) => t.id === brief.brief_type);
  const Icon = type?.icon || FileText;

  const statusColors: Record<string, string> = {
    new: '#f59e0b',
    in_progress: '#3b82f6',
    review: '#8b5cf6',
    done: '#10b981',
  };
  const statusLabel: Record<string, string> = {
    new: 'New',
    in_progress: 'In Progress',
    review: 'In Review',
    done: 'Done',
  };

  return (
    <button
      onClick={() => navigate(`/client/briefs/${brief.id}`)}
      className="group flex w-full items-center gap-4 rounded-2xl border border-[#e2e2e2] bg-white p-5 text-left transition-all hover:border-[#d0d0d0] hover:shadow-sm"
    >
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${type?.color || '#7c3aed'}15` }}
      >
        <Icon className="h-5 w-5" style={{ color: type?.color || '#7c3aed' }} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-[#1e1e20]">{brief.title}</p>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-[#8c8c8c]">
          <span>{type?.label || brief.brief_type}</span>
          {brief.created_at && (
            <>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(brief.created_at).toLocaleDateString()}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <span
          className="rounded-full px-2.5 py-1 text-xs font-medium"
          style={{
            backgroundColor: `${statusColors[brief.status] || '#8c8c8c'}15`,
            color: statusColors[brief.status] || '#8c8c8c',
          }}
        >
          {statusLabel[brief.status] || brief.status}
        </span>
        <ChevronRight className="h-4 w-4 text-[#c4c4c4] transition-transform group-hover:translate-x-0.5 group-hover:text-[#8c8c8c]" />
      </div>
    </button>
  );
}

/* ─── Briefs list view ─── */

function BriefsList({ user }: { user: ClientUser }) {
  const navigate = useNavigate();
  const [briefs, setBriefs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get(`/api/v1/entities/briefs`, {
          headers: { Authorization: `Bearer ${clientToken.get()}` },
          params: { sort: '-created_at', limit: 50 },
        });
        setBriefs(res.data?.items || []);
      } catch {
        setBriefs([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#8c8c8c]" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1e1e20]">Your Briefs</h1>
          <p className="mt-1 text-sm text-[#8c8c8c]">
            {briefs.length === 0
              ? 'No briefs yet — create your first one'
              : `${briefs.length} brief${briefs.length !== 1 ? 's' : ''} submitted`}
          </p>
        </div>
        <button
          onClick={() => navigate('/client/briefs/new')}
          className="flex items-center gap-2 rounded-xl bg-[#1e1e20] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          New Brief
        </button>
      </div>

      {briefs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#e2e2e2] py-20">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f5f3ef]">
            <FileText className="h-7 w-7 text-[#8c8c8c]" />
          </div>
          <h3 className="mb-1 font-semibold text-[#1e1e20]">No briefs yet</h3>
          <p className="mb-6 text-sm text-[#8c8c8c]">Submit a brief and our team will get started</p>
          <button
            onClick={() => navigate('/client/briefs/new')}
            className="flex items-center gap-2 rounded-xl bg-[#1e1e20] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Create Brief
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {briefs.map((b) => <BriefCard key={b.id} brief={b} />)}
        </div>
      )}
    </div>
  );
}

/* ─── New brief form ─── */

function NewBriefForm({ user }: { user: ClientUser }) {
  const navigate = useNavigate();
  const [selectedType, setSelectedType] = useState<BriefTypeId | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const set = (key: string, value: string) => setForm((p) => ({ ...p, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedType) return;
    setSubmitting(true);
    try {
      const typeLabel = BRIEF_TYPES.find((t) => t.id === selectedType)?.label || '';
      await axios.post(
        `/api/v1/entities/briefs`,
        {
          brief_type: selectedType,
          title: form.title || `${typeLabel} Brief`,
          status: 'new',
          brand_name: user.company_name || '',
          project_description: form.description || '',
          target_audience: form.target_audience || '',
          key_message: form.key_message || '',
          additional_notes: form.additional_notes || '',
          priority: 'medium',
          form_data: JSON.stringify(form),
        },
        { headers: { Authorization: `Bearer ${clientToken.get()}` } }
      );
      setDone(true);
      setTimeout(() => navigate('/client/briefs'), 2200);
    } catch {
      alert('Failed to submit brief. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-[#1e1e20]">Brief submitted!</h2>
        <p className="text-sm text-[#8c8c8c]">Our team will review it shortly.</p>
      </div>
    );
  }

  const typeFields = selectedType ? (TYPE_FIELDS[selectedType] || []) : [];

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <button
        onClick={() => navigate('/client/briefs')}
        className="mb-6 flex items-center gap-1.5 text-sm text-[#8c8c8c] hover:text-[#1e1e20]"
      >
        ← Back to Briefs
      </button>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#1e1e20]">Create New Brief</h1>
        <p className="mt-1 text-sm text-[#8c8c8c]">Start a new creative request by selecting a brief type.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Strategic briefs */}
        <div>
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-[#1e1e20]">Strategic Briefs</h2>
            <p className="text-xs text-[#8c8c8c]">Multi-phase guided forms — strategy to execution</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {STRATEGIC_TYPES.map((t) => {
              const Icon = t.icon;
              return (
                <button key={t.id} type="button"
                  onClick={() => navigate(STRATEGIC_ROUTES[t.id as StrategicId])}
                  className="flex items-center gap-3 rounded-2xl border-2 border-[#e2e2e2] bg-white p-4 text-left transition-all hover:border-[#1e1e20] hover:shadow-sm">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#e2e2e2] bg-[#f9f9f8]"
                    style={{ backgroundColor: `${t.color}15`, borderColor: `${t.color}30` }}>
                    <Icon className="h-5 w-5" style={{ color: t.color }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-[#1e1e20]">{t.label}</p>
                    <p className="text-[10px] font-medium text-[#8c8c8c]">{t.codename}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-[#c4c4c4]" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Creative production briefs */}
        <div>
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-[#1e1e20]">Creative Production</h2>
            <p className="text-xs text-[#8c8c8c]">Quick briefs for asset creation</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PRODUCTION_TYPES.map((t) => {
              const Icon = t.icon;
              const active = selectedType === t.id;
              return (
                <button key={t.id} type="button" onClick={() => setSelectedType(t.id)}
                  className={`flex items-center gap-3 rounded-2xl border-2 bg-white p-4 text-left transition-all ${
                    active ? 'border-[#1e1e20] shadow-sm' : 'border-[#e2e2e2] hover:border-[#c4c4c4]'
                  }`}>
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                    active ? 'border-[#1e1e20] bg-[#1e1e20]' : 'border-[#e2e2e2] bg-[#f9f9f8]'
                  }`}>
                    <Icon className={`h-5 w-5 ${active ? 'text-white' : 'text-[#8c8c8c]'}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#1e1e20]">{t.label}</p>
                    <p className="truncate text-xs text-[#8c8c8c]">{t.desc}</p>
                  </div>
                  {active && <Check className="h-4 w-4 shrink-0 text-[#1e1e20]" strokeWidth={3} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Dynamic type-specific fields */}
        {selectedType && (
          <div className="rounded-2xl border border-[#e2e2e2] bg-white p-6">
            <h2 className="mb-5 text-sm font-semibold uppercase tracking-wider text-[#8c8c8c]">
              {BRIEF_TYPES.find((t) => t.id === selectedType)?.label} Details
            </h2>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {typeFields.map((f) => (
                <div key={f.key} className={f.span === 2 ? 'sm:col-span-2' : ''}>
                  <label className="mb-1.5 block text-sm font-medium text-[#1e1e20]">{f.label}</label>
                  <input
                    type={f.type || 'text'}
                    value={form[f.key] || ''}
                    onChange={(e) => set(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    className="w-full rounded-lg border border-[#e2e2e2] bg-[#f9f9f8] px-4 py-2.5 text-sm text-[#1e1e20] placeholder:text-[#c4c4c4] focus:border-[#1e1e20] focus:outline-none transition-colors"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Common fields — shown once type is selected */}
        {selectedType && (
          <div className="rounded-2xl border border-[#e2e2e2] bg-white p-6">
            <h2 className="mb-5 text-sm font-semibold uppercase tracking-wider text-[#8c8c8c]">
              Brief Details
            </h2>
            <div className="space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#1e1e20]">
                  Project Title <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  type="text"
                  value={form.title || ''}
                  onChange={(e) => set('title', e.target.value)}
                  placeholder={`e.g. ${user.company_name || 'Brand'} ${BRIEF_TYPES.find((t) => t.id === selectedType)?.label}`}
                  className="w-full rounded-lg border border-[#e2e2e2] bg-[#f9f9f8] px-4 py-2.5 text-sm text-[#1e1e20] placeholder:text-[#c4c4c4] focus:border-[#1e1e20] focus:outline-none transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#1e1e20]">
                    Deadline <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="date"
                    value={form.deadline || ''}
                    onChange={(e) => set('deadline', e.target.value)}
                    className={`w-full rounded-lg border px-4 py-2.5 text-sm text-[#1e1e20] focus:border-[#1e1e20] focus:outline-none transition-colors ${
                      !form.deadline ? 'border-red-200 bg-red-50' : 'border-[#e2e2e2] bg-[#f9f9f8]'
                    }`}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#1e1e20]">Target Audience</label>
                  <input
                    type="text"
                    value={form.target_audience || ''}
                    onChange={(e) => set('target_audience', e.target.value)}
                    placeholder="Who is this for? e.g. UK SME owners aged 35–55"
                    className="w-full rounded-lg border border-[#e2e2e2] bg-[#f9f9f8] px-4 py-2.5 text-sm text-[#1e1e20] placeholder:text-[#c4c4c4] focus:border-[#1e1e20] focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#1e1e20]">Budget Range</label>
                  <input
                    type="text"
                    value={form.budget || ''}
                    onChange={(e) => set('budget', e.target.value)}
                    placeholder="e.g. £500–£1,000 / Not sure yet"
                    className="w-full rounded-lg border border-[#e2e2e2] bg-[#f9f9f8] px-4 py-2.5 text-sm text-[#1e1e20] placeholder:text-[#c4c4c4] focus:border-[#1e1e20] focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#1e1e20]">Priority</label>
                  <div className="flex gap-2">
                    {[
                      { value: 'standard', label: 'Standard', color: '#8c8c8c' },
                      { value: 'high', label: 'Urgent', color: '#f59e0b' },
                      { value: 'rush', label: 'Rush', color: '#ef4444' },
                    ].map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => set('priority', p.value)}
                        className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                          form.priority === p.value
                            ? 'border-[#1e1e20] bg-[#1e1e20] text-white'
                            : 'border-[#e2e2e2] bg-[#f9f9f8] text-[#595959] hover:border-[#c4c4c4]'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#1e1e20]">Reference Links</label>
                <input
                  type="text"
                  value={form.reference_links || ''}
                  onChange={(e) => set('reference_links', e.target.value)}
                  placeholder="Paste URLs of inspiration, competitor sites, or brand assets (comma-separated)"
                  className="w-full rounded-lg border border-[#e2e2e2] bg-[#f9f9f8] px-4 py-2.5 text-sm text-[#1e1e20] placeholder:text-[#c4c4c4] focus:border-[#1e1e20] focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#1e1e20]">Additional Notes</label>
                <textarea
                  rows={4}
                  value={form.additional_notes || ''}
                  onChange={(e) => set('additional_notes', e.target.value)}
                  placeholder="Anything else we should know? Must-haves, must-avoids, constraints, access to brand materials…"
                  className="w-full resize-none rounded-lg border border-[#e2e2e2] bg-[#f9f9f8] px-4 py-2.5 text-sm text-[#1e1e20] placeholder:text-[#c4c4c4] focus:border-[#1e1e20] focus:outline-none transition-colors"
                />
              </div>
            </div>
          </div>
        )}

        {selectedType && (
          <div className="flex items-center justify-end gap-4">
            <button
              type="button"
              onClick={() => navigate('/client/briefs')}
              className="rounded-xl border border-[#e2e2e2] bg-white px-5 py-2.5 text-sm font-medium text-[#595959] hover:bg-[#f5f3ef]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !form.title || !form.deadline}
              className="flex items-center gap-2 rounded-xl bg-[#1e1e20] px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {submitting ? 'Submitting…' : 'Submit Brief'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

/* ─── Brief detail view ─── */

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  new:         { label: 'New',         bg: 'bg-amber-50',  text: 'text-amber-600' },
  in_progress: { label: 'In Progress', bg: 'bg-blue-50',   text: 'text-blue-600'  },
  review:      { label: 'In Review',   bg: 'bg-violet-50', text: 'text-violet-600'},
  done:        { label: 'Done',        bg: 'bg-green-50',  text: 'text-green-600' },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  standard: { label: 'Standard', color: '#8c8c8c' },
  medium:   { label: 'Standard', color: '#8c8c8c' },
  high:     { label: 'Urgent',   color: '#f59e0b' },
  rush:     { label: 'Rush',     color: '#ef4444' },
  low:      { label: 'Low',      color: '#10b981' },
};

function Field({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wider text-[#8c8c8c]">{label}</p>
      <p className="text-sm text-[#1e1e20]">{value}</p>
    </div>
  );
}

function BriefDetailView({ user }: { user: ClientUser }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [brief, setBrief] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    axios
      .get(`/api/v1/entities/briefs/${id}`, {
        headers: { Authorization: `Bearer ${clientToken.get()}` },
      })
      .then((r) => setBrief(r.data))
      .catch((e) => {
        if (e.response?.status === 404) setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#8c8c8c]" />
      </div>
    );
  }

  if (notFound || !brief) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8">
        <AlertCircle className="h-10 w-10 text-[#c4c4c4]" />
        <p className="font-semibold text-[#1e1e20]">Brief not found</p>
        <button onClick={() => navigate('/client/briefs')} className="text-sm text-[#8c8c8c] underline">
          Back to Briefs
        </button>
      </div>
    );
  }

  const type = BRIEF_TYPES.find((t) => t.id === brief.brief_type);
  const Icon = type?.icon || FileText;
  const status = STATUS_CONFIG[brief.status] || { label: brief.status, bg: 'bg-gray-50', text: 'text-gray-600' };
  const priority = PRIORITY_CONFIG[brief.priority] || PRIORITY_CONFIG.standard;

  // Parse the rich form_data that was saved
  let extra: Record<string, string> = {};
  try { extra = JSON.parse(brief.form_data || '{}'); } catch { /* */ }

  // Fields to skip (already shown as top-level)
  const skipKeys = new Set(['title', 'deadline', 'target_audience', 'additional_notes', 'budget', 'priority', 'reference_links']);

  // Stringify any non-primitive values so React can render them
  const serializeValue = (v: any): string => {
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) return v.join(', ');
    if (typeof v === 'object' && v !== null) {
      return Object.entries(v)
        .filter(([, val]) => val)
        .map(([key]) => key.replace(/_/g, ' '))
        .join(', ');
    }
    return String(v);
  };

  const extraEntries = Object.entries(extra)
    .filter(([k, v]) => !skipKeys.has(k) && v !== null && v !== undefined && v !== '' && v !== false)
    .map(([k, v]) => [k, serializeValue(v)] as [string, string])
    .filter(([, v]) => v.length > 0);

  return (
    <div className="flex-1 overflow-y-auto p-8">
      {/* Back */}
      <button
        onClick={() => navigate('/client/briefs')}
        className="mb-6 flex items-center gap-1.5 text-sm text-[#8c8c8c] hover:text-[#1e1e20]"
      >
        <ArrowLeft className="h-4 w-4" />
        All Briefs
      </button>

      {/* Header card */}
      <div className="mb-6 rounded-2xl border border-[#e2e2e2] bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${type?.color || '#7c3aed'}15` }}
            >
              <Icon className="h-6 w-6" style={{ color: type?.color || '#7c3aed' }} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#1e1e20]">{brief.title}</h1>
              <p className="mt-0.5 text-sm text-[#8c8c8c]">{type?.label || brief.brief_type}</p>
            </div>
          </div>

          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${status.bg} ${status.text}`}>
            {status.label}
          </span>
        </div>

        {/* Meta row */}
        <div className="mt-5 flex flex-wrap gap-5 border-t border-[#f0f0f0] pt-5 text-sm text-[#595959]">
          {brief.created_at && (
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 text-[#8c8c8c]" />
              Submitted {new Date(brief.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          )}
          {extra.deadline && (
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-[#8c8c8c]" />
              Due {new Date(extra.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          )}
          {brief.priority && (
            <span className="flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5 text-[#8c8c8c]" />
              <span style={{ color: priority.color }} className="font-medium">{priority.label}</span>
            </span>
          )}
          {extra.budget && (
            <span className="flex items-center gap-1.5">
              <Banknote className="h-3.5 w-3.5 text-[#8c8c8c]" />
              {extra.budget}
            </span>
          )}
          {brief.target_audience && (
            <span className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-[#8c8c8c]" />
              {brief.target_audience}
            </span>
          )}
        </div>
      </div>

      {/* Type-specific fields */}
      {extraEntries.length > 0 && (
        <div className="mb-4 rounded-2xl border border-[#e2e2e2] bg-white p-6">
          <h2 className="mb-5 text-xs font-semibold uppercase tracking-wider text-[#8c8c8c]">
            {type?.label} Details
          </h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {extraEntries.map(([k, v]) => (
              <Field
                key={k}
                label={k.replace(/_/g, ' ')}
                value={v}
              />
            ))}
          </div>
        </div>
      )}

      {/* Reference links */}
      {extra.reference_links && (
        <div className="mb-4 rounded-2xl border border-[#e2e2e2] bg-white p-6">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#8c8c8c]">Reference Links</h2>
          <div className="flex flex-wrap gap-2">
            {extra.reference_links.split(',').map((url) => url.trim()).filter(Boolean).map((url) => (
              <a
                key={url}
                href={url.startsWith('http') ? url : `https://${url}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-[#e2e2e2] px-3 py-1.5 text-xs text-[#595959] hover:border-[#1e1e20] hover:text-[#1e1e20]"
              >
                <LinkIcon className="h-3 w-3" />
                {url.replace(/^https?:\/\//, '').split('/')[0]}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Additional notes */}
      {brief.additional_notes && (
        <div className="rounded-2xl border border-[#e2e2e2] bg-white p-6">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#8c8c8c]">Additional Notes</h2>
          <p className="whitespace-pre-wrap text-sm text-[#1e1e20]">{brief.additional_notes}</p>
        </div>
      )}

      {/* Status info banner */}
      {brief.status === 'new' && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-amber-50 px-5 py-4">
          <Clock className="h-4 w-4 shrink-0 text-amber-500" />
          <p className="text-sm text-amber-700">
            Your brief has been received. Our team will review it shortly and update the status.
          </p>
        </div>
      )}
      {brief.status === 'in_progress' && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-blue-50 px-5 py-4">
          <Loader2 className="h-4 w-4 shrink-0 text-blue-500" />
          <p className="text-sm text-blue-700">
            Our team is working on your brief. We'll be in touch if we have any questions.
          </p>
        </div>
      )}
      {brief.status === 'review' && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-violet-50 px-5 py-4">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-violet-500" />
          <p className="text-sm text-violet-700">
            Your assets are ready for review. Expect a message from our team soon.
          </p>
        </div>
      )}
      {brief.status === 'done' && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-green-50 px-5 py-4">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
          <p className="text-sm text-green-700">
            This brief is complete. Thank you for working with us!
          </p>
        </div>
      )}
    </div>
  );
}

/* ─── Client Website Brief Wizard (3-step, uses client JWT) ─── */

const SITE_PAGES = [
  { key: 'home_page',    label: 'Home Page',                     sub: 'Hero, value prop, social proof, primary CTA' },
  { key: 'services',     label: 'Services / Features',           sub: 'Service breakdown, pricing tiers, comparisons' },
  { key: 'case_studies', label: 'Case Studies / Testimonials',   sub: 'Results-led stories, before/after metrics' },
  { key: 'landing_page', label: 'High-Converting Landing Page',  sub: 'Paid ads destination — no nav, single CTA' },
  { key: 'about_team',   label: 'About / Team',                  sub: 'Founder story, team profiles, trust signals' },
  { key: 'blog',         label: 'Blog / Resources',              sub: 'SEO content hub, lead magnets' },
  { key: 'contact',      label: 'Contact Page',                  sub: 'Location, hours, embedded form or calendar' },
];
const LEAD_CHIPS = ['High-Value Form', 'Quiz / Calculator', 'Calendar Booking'];
const CRM_LIST   = ['HubSpot', 'Salesforce', 'Pipedrive', 'ActiveCampaign', 'GoHighLevel', 'None / Not decided'];
const LEGAL_LIST = [
  { k: 'privacy', txt: 'Privacy Policy — legally vetted and up to date' },
  { k: 'cookie',  txt: 'Cookie Consent Banner — GDPR / ePrivacy compliant' },
  { k: 'terms',   txt: 'Terms of Service / Website Terms of Use' },
  { k: 'gdpr',    txt: 'GDPR-compliant form opt-in checkbox' },
];
const PAID_LIST = [
  { id: 'meta',      label: 'Meta Ads',         sub: 'Facebook + Instagram' },
  { id: 'google',    label: 'Google Ads / GA4', sub: 'Search, Display, YouTube' },
  { id: 'linkedin',  label: 'LinkedIn Ads',     sub: 'B2B targeting' },
  { id: 'tiktok',    label: 'TikTok Ads',       sub: 'Short-form video' },
  { id: 'pinterest', label: 'Pinterest Ads',    sub: 'Visual discovery' },
  { id: 'none',      label: 'No Paid Ads Yet',  sub: 'Organic / SEO only' },
];
const TP_LIST = ['Website / App UI', 'Instagram / Social Grid', 'Product Packaging',
  'B2B Pitch Decks', 'OOH / Outdoor', 'Email / CRM Templates', 'Video / TVC Endframes', 'Events / Trade Show'];

const inp = 'w-full rounded-xl border border-[#e2e2e2] bg-white px-4 py-2.5 text-sm text-[#1e1e20] placeholder:text-[#c4c4c4] focus:border-[#1e1e20] focus:outline-none transition-colors';

function WizardHeader({ step }: { step: 1 | 2 | 3 }) {
  const tabs = ['Conversion Blueprint', 'Tech Stack', 'Traffic & Social'];
  const titles = ['Conversion Blueprint', 'Tech Stack & Automation', 'Traffic & Social Fuel'];
  const subs = [
    'Before a single page is designed, we define how your site captures leads.',
    'Tell us your tools and where leads should go — no code required.',
    'Connect every traffic source so tracking fires correctly from day one.',
  ];
  return (
    <div className="rounded-2xl bg-[#1e1e20] p-6 mb-8">
      <div className="flex gap-0 mb-5">
        {tabs.map((t, i) => {
          const s = i + 1;
          const active = step === s; const done = step > s;
          return (
            <div key={t} className="flex-1 flex flex-col items-center gap-1.5">
              <div className={`h-0.5 w-full rounded-full ${done || active ? 'bg-[#f5c842]' : 'bg-white/20'}`} />
              <span className={`text-[11px] font-medium ${active ? 'text-[#f5c842]' : done ? 'text-white/50' : 'text-white/25'}`}>{t}</span>
            </div>
          );
        })}
      </div>
      <h2 className="text-lg font-bold text-white">{titles[step - 1]}</h2>
      <p className="mt-1 text-sm text-white/50">{subs[step - 1]}</p>
    </div>
  );
}

function ClientWebsiteWizard({ user }: { user: ClientUser }) {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);
  const [d, setD] = useState({
    business_name: user.company_name || '', contact_email: user.email,
    hero_hook: '', primary_goal: '',
    lead_capture: [] as string[],
    pages: { home_page: true, services: true, case_studies: true, landing_page: false, about_team: false, blog: false, contact: false } as Record<string, boolean>,
    perf_vs_design: 50,
    crm: '', crm_url: '', lead_trigger: '',
    email_tool: '', live_chat: '', current_platform: '', integrations: '',
    legal: { privacy: false, cookie: false, terms: false, gdpr: false } as Record<string, boolean>,
    geo: '',
    paid: [] as string[],
    social_handles: '', reviews_url: '',
    touchpoints: [] as string[],
    launch_date: '', domain: '', notes: '',
  });

  const set = (k: string, v: any) => setD(p => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await axios.post(`/api/v1/entities/briefs`, {
        brief_type: 'website_app',
        title: `${d.business_name || user.company_name || 'Website'} — Website Brief`,
        status: 'new',
        brand_name: d.business_name || user.company_name || '',
        project_description: d.primary_goal,
        target_audience: d.geo,
        key_message: d.hero_hook,
        additional_notes: d.notes,
        priority: 'high',
        form_data: JSON.stringify(d),
      }, { headers: { Authorization: `Bearer ${clientToken.get()}` } });
      navigate('/client/briefs');
    } catch {
      alert('Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <button onClick={() => step === 1 ? navigate('/client/briefs/new') : setStep((step - 1) as 1 | 2 | 3)}
        className="mb-6 flex items-center gap-2 text-sm text-[#8c8c8c] hover:text-[#1e1e20]">
        <ArrowLeft className="h-4 w-4" />
        {step === 1 ? 'Back' : `← Phase ${step - 1}`}
      </button>

      <WizardHeader step={step} />

      {/* ── Step 1 ── */}
      {step === 1 && (
        <div className="space-y-7">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#8c8c8c]">Business / Brand Name</label>
              <input className={inp} value={d.business_name} onChange={e => set('business_name', e.target.value)} placeholder="Your trading name" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#8c8c8c]">Contact Email</label>
              <input className={inp} type="email" value={d.contact_email} onChange={e => set('contact_email', e.target.value)} placeholder="you@business.com" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#8c8c8c]">
              Project Deadline <span className="text-red-400">*</span>
            </label>
            <input className={`${inp} ${!d.launch_date ? 'border-red-200 bg-red-50' : ''}`} type="date"
              value={d.launch_date} onChange={e => set('launch_date', e.target.value)} required />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#8c8c8c]">The Hero Hook — Why should a visitor hand over their details within 5 seconds?</label>
            <input className={inp} value={d.hero_hook} onChange={e => set('hero_hook', e.target.value)} placeholder="e.g. Get Your Free 15-Min Audit · Download the Industry Whitepaper · Calculate Your Savings Now" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#8c8c8c]">Primary Business Goal For This Website</label>
            <input className={inp} value={d.primary_goal} onChange={e => set('primary_goal', e.target.value)} placeholder="e.g. Generate 20+ qualified consultation bookings per week from SME owners…" />
          </div>

          {/* Lead capture chips */}
          <div>
            <label className="mb-3 block text-xs font-semibold uppercase tracking-wider text-[#8c8c8c]">Lead Capture Type — select all that apply</label>
            <div className="flex flex-wrap gap-3">
              {LEAD_CHIPS.map(lc => {
                const on = d.lead_capture.includes(lc);
                return (
                  <button key={lc} type="button" onClick={() => set('lead_capture', on ? d.lead_capture.filter((x: string) => x !== lc) : [...d.lead_capture, lc])}
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${on ? 'border-[#1e1e20] bg-[#1e1e20] text-white' : 'border-[#e2e2e2] bg-white text-[#595959] hover:border-[#c4c4c4]'}`}>
                    {lc}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Page toggles */}
          <div>
            <label className="mb-3 block text-xs font-semibold uppercase tracking-wider text-[#8c8c8c]">Lean Site Tree — toggle pages on/off</label>
            <div className="overflow-hidden rounded-2xl border border-[#e2e2e2] bg-white">
              {SITE_PAGES.map(({ key, label, sub }, idx) => {
                const on = !!d.pages[key];
                return (
                  <div key={key} className={`flex items-center gap-4 px-5 py-3.5 ${idx < SITE_PAGES.length - 1 ? 'border-b border-[#f0f0f0]' : ''}`}>
                    {idx > 0 && <span className="ml-2 text-xs text-[#c4c4c4]">└──</span>}
                    <button type="button" onClick={() => set('pages', { ...d.pages, [key]: !on })}
                      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${on ? 'bg-[#22c55e]' : 'bg-[#e2e2e2]'}`}>
                      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${on ? 'left-4' : 'left-0.5'}`} />
                    </button>
                    <div>
                      <p className="text-sm font-medium text-[#1e1e20]">{label}</p>
                      <p className="text-xs text-[#8c8c8c]">{sub}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Slider */}
          <div className="rounded-2xl border border-[#e2e2e2] bg-white p-5">
            <div className="flex justify-between mb-2 text-xs font-medium text-[#8c8c8c]">
              <span>Performance Optimised</span><span>Experience Rich</span>
            </div>
            <input type="range" min={0} max={100} value={d.perf_vs_design} onChange={e => set('perf_vs_design', +e.target.value)} className="w-full accent-[#1e1e20]" />
            <p className="mt-2 text-center text-xs text-[#8c8c8c]">
              {d.perf_vs_design < 30 ? 'Speed-first — lean, fast-loading, minimal animations'
                : d.perf_vs_design > 70 ? 'Experience-rich — immersive, animated, premium feel'
                : 'Balanced — clean UI with selective motion accents'}
            </p>
          </div>
        </div>
      )}

      {/* ── Step 2 ── */}
      {step === 2 && (
        <div className="space-y-7">
          {/* CRM */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#8c8c8c]">CRM / Where does the lead land?</label>
            <select value={d.crm} onChange={e => set('crm', e.target.value)}
              className="w-full rounded-xl border border-[#e2e2e2] bg-white px-4 py-2.5 text-sm text-[#1e1e20] focus:border-[#1e1e20] focus:outline-none mb-3">
              <option value="">Select your CRM…</option>
              {CRM_LIST.map(c => <option key={c}>{c}</option>)}
            </select>
            <input className={inp} placeholder="CRM workspace URL (e.g. https://app.hubspot.com/...)" value={d.crm_url} onChange={e => set('crm_url', e.target.value)} />
          </div>

          {/* Tech Stack */}
          <div>
            <label className="mb-3 block text-xs font-semibold uppercase tracking-wider text-[#8c8c8c]">Existing Tech Stack</label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <input className={inp} placeholder="Email tool (e.g. Klaviyo, Mailchimp)" value={d.email_tool} onChange={e => set('email_tool', e.target.value)} />
              <input className={inp} placeholder="Live chat / support tool" value={d.live_chat} onChange={e => set('live_chat', e.target.value)} />
              <input className={inp} placeholder="Current website platform" value={d.current_platform} onChange={e => set('current_platform', e.target.value)} />
            </div>
            <input className={`${inp} mt-3`} placeholder="Other integrations needed (CRM, booking, payments, custom API...)" value={d.integrations} onChange={e => set('integrations', e.target.value)} />
          </div>

          {/* Legal */}
          <div>
            <label className="mb-3 block text-xs font-semibold uppercase tracking-wider text-[#8c8c8c]">Legal & Compliance — tick what you have</label>
            <div className="overflow-hidden rounded-2xl border border-[#e2e2e2] bg-white">
              {LEGAL_LIST.map(({ k, txt }, idx) => {
                const on = !!d.legal[k];
                return (
                  <label key={k} className={`flex cursor-pointer items-center gap-4 px-5 py-3.5 hover:bg-[#f9f9f8] ${idx < LEGAL_LIST.length - 1 ? 'border-b border-[#f0f0f0]' : ''}`}>
                    <div onClick={() => set('legal', { ...d.legal, [k]: !on })}
                      className={`h-4 w-4 shrink-0 rounded border-2 flex items-center justify-center transition-colors ${on ? 'border-[#1e1e20] bg-[#1e1e20]' : 'border-[#c4c4c4]'}`}>
                      {on && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                    </div>
                    <span className="flex-1 text-sm text-[#1e1e20]">{txt}</span>
                    <span className="shrink-0 rounded bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-500">Required</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#8c8c8c]">Geographic markets this site will serve</label>
            <input className={inp} placeholder="e.g. Ireland + UK (GDPR), US West Coast (CCPA), EU-wide" value={d.geo} onChange={e => set('geo', e.target.value)} />
          </div>
        </div>
      )}

      {/* ── Step 3 ── */}
      {step === 3 && (
        <div className="space-y-7">
          {/* Paid platforms */}
          <div>
            <label className="mb-3 block text-xs font-semibold uppercase tracking-wider text-[#8c8c8c]">Pixel Tracking & Analytics — select active / planned platforms</label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {PAID_LIST.map(({ id, label, sub }) => {
                const on = d.paid.includes(id);
                return (
                  <button key={id} type="button" onClick={() => set('paid', on ? d.paid.filter((x: string) => x !== id) : [...d.paid, id])}
                    className={`rounded-2xl border-2 bg-white p-4 text-left transition-all ${on ? 'border-[#1e1e20] shadow-sm' : 'border-[#e2e2e2] hover:border-[#c4c4c4]'}`}>
                    <p className="text-sm font-semibold text-[#1e1e20]">{label}</p>
                    <p className="text-xs text-[#8c8c8c]">{sub}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Social handles + reviews */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#8c8c8c]">Active social handles</label>
              <input className={inp} placeholder="instagram.com/brand · linkedin.com/company/brand" value={d.social_handles} onChange={e => set('social_handles', e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#8c8c8c]">Google Reviews / Trustpilot URL</label>
              <input className={inp} type="url" placeholder="https://g.page/yourbusiness" value={d.reviews_url} onChange={e => set('reviews_url', e.target.value)} />
            </div>
          </div>

          {/* Touchpoint queue */}
          <div>
            <label className="mb-3 block text-xs font-semibold uppercase tracking-wider text-[#8c8c8c]">Touchpoint Priority — click to add in order</label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-[#e2e2e2] bg-white p-4">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#8c8c8c]">All Touchpoints</p>
                {TP_LIST.filter(tp => !d.touchpoints.includes(tp)).map(tp => (
                  <button key={tp} type="button" onClick={() => set('touchpoints', [...d.touchpoints, tp])}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#595959] hover:bg-[#f5f3ef]">
                    <span className="text-[#c4c4c4]">○</span> {tp}
                  </button>
                ))}
              </div>
              <div className="rounded-2xl border border-[#e2e2e2] bg-[#f9f9f8] p-4">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#8c8c8c]">Priority Queue</p>
                {d.touchpoints.length === 0
                  ? <p className="text-xs text-[#c4c4c4] italic">Add from the left →</p>
                  : d.touchpoints.map((tp: string, i: number) => (
                    <div key={tp} className="mb-2 flex items-center gap-2 rounded-lg border border-[#e2e2e2] bg-white px-3 py-2 text-sm">
                      <span className="text-xs font-bold text-[#8c8c8c] w-5">#{i + 1}</span>
                      <span className="flex-1 text-[#1e1e20]">{tp}</span>
                      <button type="button" onClick={() => set('touchpoints', d.touchpoints.filter((x: string) => x !== tp))} className="text-[#c4c4c4] hover:text-red-400 text-xs">✕</button>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Launch details */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#8c8c8c]">Target launch date</label>
              <input className={inp} type="date" value={d.launch_date} onChange={e => set('launch_date', e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#8c8c8c]">Existing domain / hosting provider</label>
              <input className={inp} placeholder="e.g. GoDaddy, Cloudflare, none yet" value={d.domain} onChange={e => set('domain', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#8c8c8c]">Anything else the build team needs to know</label>
            <textarea rows={4} className={`${inp} resize-none`}
              placeholder="Budget constraints, content readiness, competitor benchmarks, accessibility requirements…"
              value={d.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="mt-10 flex items-center justify-between border-t border-[#e2e2e2] pt-6">
        <button onClick={() => step > 1 && setStep((step - 1) as 1 | 2 | 3)}
          className={`rounded-xl border border-[#e2e2e2] bg-white px-6 py-2.5 text-sm font-medium text-[#595959] hover:bg-[#f5f3ef] ${step === 1 ? 'invisible' : ''}`}>
          ← Phase {step - 1}
        </button>
        {step < 3 ? (
          <button onClick={() => setStep((step + 1) as 1 | 2 | 3)}
            className="flex items-center gap-2 rounded-xl bg-[#1e1e20] px-7 py-2.5 text-sm font-semibold text-white hover:opacity-90">
            Next: {step === 1 ? 'Tech Stack' : 'Traffic & Social'} →
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={submitting || !d.launch_date}
            className="flex items-center gap-2 rounded-xl bg-[#1e1e20] px-7 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? 'Submitting…' : 'Deploy Brief →'}
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Client Dashboard ─── */

const STATUS_LABELS: Record<string, string> = {
  new: 'New', in_progress: 'In Progress', review: 'In Review', done: 'Done',
};
const STATUS_COLORS: Record<string, string> = {
  new: '#f59e0b', in_progress: '#3b82f6', review: '#8b5cf6', done: '#10b981',
};

function ClientDashboard({ user }: { user: ClientUser }) {
  const navigate = useNavigate();
  const [briefs, setBriefs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/api/v1/entities/briefs', {
      headers: { Authorization: `Bearer ${clientToken.get()}` },
      params: { sort: '-created_at', limit: 50 },
    }).then(r => setBriefs(r.data?.items || [])).catch(() => setBriefs([])).finally(() => setLoading(false));
  }, []);

  const stats = [
    { label: 'Total Briefs',  value: briefs.length, color: '#1e1e20', bg: '#f5f3ef' },
    { label: 'New',           value: briefs.filter(b => b.status === 'new').length, color: '#f59e0b', bg: '#fffbeb' },
    { label: 'In Progress',   value: briefs.filter(b => b.status === 'in_progress').length, color: '#3b82f6', bg: '#eff6ff' },
    { label: 'Completed',     value: briefs.filter(b => b.status === 'done').length, color: '#10b981', bg: '#f0fdf4' },
  ];

  const recent = briefs.slice(0, 4);

  const quickActions = [
    { id: 'the_nexus',     label: 'The Nexus',     desc: 'Campaigns & launches',    icon: Megaphone,   color: '#7c3aed', route: '/client/briefs/new/nexus' },
    { id: 'the_genesis',   label: 'The Genesis',   desc: 'New brand from scratch',  icon: Paintbrush2, color: '#f59e0b', route: '/client/briefs/new/genesis' },
    { id: 'the_evolution', label: 'The Evolution', desc: 'Brand refresh',            icon: Globe,       color: '#0ea5e9', route: '/client/briefs/new/evolution' },
    { id: 'the_engine',    label: 'The Engine',    desc: 'SME website + CRM',       icon: LayoutGrid,  color: '#10b981', route: '/client/briefs/new/website' },
    { id: 'the_velocity',  label: 'The Velocity',  desc: '30-day content plan',     icon: Film,        color: '#ef4444', route: '/client/briefs/new/velocity' },
    { id: 'custom',        label: 'Other Brief',   desc: 'Custom request',          icon: Mail,        color: '#8c8c8c', route: '/client/briefs/new' },
  ] as const;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="flex-1 overflow-y-auto bg-[#f5f3ef]">
      <div className="mx-auto max-w-5xl px-8 py-8">

        {/* Welcome */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#1e1e20]">
              {greeting}, {user.company_name || user.email.split('@')[0]} 👋
            </h1>
            <p className="mt-1 text-sm text-[#8c8c8c]">
              {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <button
            onClick={() => navigate('/client/briefs/new')}
            className="flex items-center gap-2 rounded-xl bg-[#1e1e20] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            New Brief
          </button>
        </div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map(s => (
            <div key={s.label} className="rounded-2xl border border-[#e2e2e2] bg-white p-5">
              <p className="mb-2 text-xs font-medium text-[#8c8c8c]">{s.label}</p>
              <p className="text-3xl font-bold" style={{ color: s.color }}>
                {loading ? '—' : s.value}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">

          {/* Recent Briefs — 3 cols */}
          <div className="lg:col-span-3">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#1e1e20]">Recent Briefs</h2>
              <button onClick={() => navigate('/client/briefs')}
                className="text-xs text-[#8c8c8c] hover:text-[#1e1e20]">View all →</button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center rounded-2xl border border-[#e2e2e2] bg-white py-12">
                <Loader2 className="h-5 w-5 animate-spin text-[#c4c4c4]" />
              </div>
            ) : recent.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#e2e2e2] py-12">
                <FileText className="mb-3 h-8 w-8 text-[#c4c4c4]" />
                <p className="text-sm font-medium text-[#1e1e20]">No briefs yet</p>
                <p className="mt-1 text-xs text-[#8c8c8c]">Create your first brief to get started</p>
                <button onClick={() => navigate('/client/briefs/new')}
                  className="mt-4 rounded-lg bg-[#1e1e20] px-4 py-2 text-xs font-semibold text-white hover:opacity-90">
                  Create Brief
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {recent.map(b => {
                  const type = BRIEF_TYPES.find(t => t.id === b.brief_type);
                  const Icon = type?.icon || FileText;
                  const status = b.status || 'new';
                  // Parse deadline from form_data
                  let deadline = '';
                  try {
                    const fd = JSON.parse(b.form_data || '{}');
                    deadline = fd.deadline || fd.launch_date || '';
                  } catch {}
                  return (
                    <button key={b.id} onClick={() => navigate(`/client/briefs/${b.id}`)}
                      className="group flex w-full items-center gap-4 rounded-2xl border border-[#e2e2e2] bg-white p-4 text-left hover:border-[#c4c4c4] hover:shadow-sm transition-all">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                        style={{ backgroundColor: `${type?.color || '#8c8c8c'}15` }}>
                        <Icon className="h-5 w-5" style={{ color: type?.color || '#8c8c8c' }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[#1e1e20]">{b.title}</p>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-[#8c8c8c]">
                          <span>{type?.label || b.brief_type}</span>
                          {deadline && <><span>·</span><span>Due {new Date(deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span></>}
                        </div>
                      </div>
                      <span className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold"
                        style={{ backgroundColor: `${STATUS_COLORS[status] || '#8c8c8c'}15`, color: STATUS_COLORS[status] || '#8c8c8c' }}>
                        {STATUS_LABELS[status] || status}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Actions — 2 cols */}
          <div className="lg:col-span-2">
            <h2 className="mb-4 text-sm font-semibold text-[#1e1e20]">Start a New Brief</h2>
            <div className="grid grid-cols-2 gap-2">
              {quickActions.map(({ id, label, desc, icon: Icon, color }) => (
                <button key={id}
                  onClick={() => navigate(route)}
                  className="flex flex-col items-start rounded-2xl border border-[#e2e2e2] bg-white p-4 text-left hover:border-[#c4c4c4] hover:shadow-sm transition-all">
                  <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${color}15` }}>
                    <Icon className="h-4 w-4" style={{ color }} />
                  </div>
                  <p className="text-xs font-semibold text-[#1e1e20] leading-tight">{label}</p>
                  <p className="mt-0.5 text-[10px] text-[#8c8c8c] leading-tight">{desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* How it works */}
        <div className="mt-6 rounded-2xl border border-[#e2e2e2] bg-white p-6">
          <h2 className="mb-5 text-sm font-semibold text-[#1e1e20]">How It Works</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            {[
              { step: '01', title: 'Submit a Brief',      desc: 'Tell us what you need — type, deadline, details.' },
              { step: '02', title: 'We Get to Work',      desc: 'Our creative team picks up and starts production.' },
              { step: '03', title: 'Review & Feedback',   desc: 'We share assets for your review and approval.' },
              { step: '04', title: 'Final Delivery',      desc: 'Approved assets delivered in all required formats.' },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1e1e20] text-[10px] font-bold text-white">
                  {step}
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#1e1e20]">{title}</p>
                  <p className="mt-0.5 text-[11px] text-[#8c8c8c] leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

/* ─── Shell with auth guard ─── */

type View = 'list' | 'new' | 'detail' | 'website' | 'dashboard' | 'nexus' | 'genesis' | 'evolution' | 'velocity';

export default function ClientPortal({ view = 'list' }: { view?: View }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<ClientUser | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    clientAuthApi.me().then((u) => {
      if (!u) navigate('/client-login');
      else setUser(u);
      setChecking(false);
    });
  }, []);

  const handleLogout = () => clientAuthApi.logout();

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f3ef]">
        <Loader2 className="h-6 w-6 animate-spin text-[#8c8c8c]" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f3ef]">
      <ClientSidebar user={user} onLogout={handleLogout} />
      {view === 'dashboard'  && <ClientDashboard user={user} />}
      {view === 'new'        && <NewBriefForm user={user} />}
      {view === 'nexus'      && <NexusWizard companyName={user.company_name || user.email} />}
      {view === 'genesis'    && <GenesisWizard companyName={user.company_name || user.email} />}
      {view === 'evolution'  && <EvolutionWizard companyName={user.company_name || user.email} />}
      {view === 'website'    && <ClientWebsiteWizard user={user} />}
      {view === 'velocity'   && <VelocityWizard companyName={user.company_name || user.email} />}
      {view === 'detail'     && <BriefDetailView user={user} />}
      {view === 'list'       && <BriefsList user={user} />}
    </div>
  );
}
