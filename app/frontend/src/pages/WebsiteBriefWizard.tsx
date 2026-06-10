import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createClient } from '@metagptx/web-sdk';
import SidebarLayout from '@/components/Sidebar';
import { toast } from 'sonner';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';

const mgxClient = createClient();

/* ─── Types ─── */
type Step = 1 | 2 | 3;
interface WizardData {
  // Step 1 – Conversion Blueprint
  business_name: string;
  contact_email: string;
  deadline: string;
  hero_hook: string;
  primary_goal: string;
  lead_capture: string[];           // chips
  pages: Record<string, boolean>;   // page toggles
  perf_vs_design: number;           // 0–100

  // Step 2 – Tech Stack
  crm_platform: string;
  crm_url: string;
  lead_trigger: string;
  email_tool: string;
  live_chat: string;
  current_platform: string;
  other_integrations: string;
  legal: Record<string, boolean>;
  geographic_markets: string;

  // Step 3 – Traffic & Social
  paid_platforms: string[];
  social_integrations: Record<string, boolean>;
  social_handles: string;
  google_reviews_url: string;
  touchpoint_queue: string[];
  launch_date: string;
  existing_domain: string;
  final_notes: string;
}

const INITIAL: WizardData = {
  business_name: '', contact_email: '', deadline: '', hero_hook: '', primary_goal: '',
  lead_capture: [], pages: {
    home_page: true, services: true, case_studies: true,
    landing_page: false, about_team: false, blog: false, contact: false,
  }, perf_vs_design: 50,
  crm_platform: '', crm_url: '', lead_trigger: '',
  email_tool: '', live_chat: '', current_platform: '', other_integrations: '',
  legal: { privacy: false, cookie: false, terms: false, gdpr: false },
  geographic_markets: '',
  paid_platforms: [], social_integrations: { static_icons: true, live_feed: false, social_proof: false, whatsapp: false },
  social_handles: '', google_reviews_url: '', touchpoint_queue: [],
  launch_date: '', existing_domain: '', final_notes: '',
};

const PAGES = [
  { key: 'home_page',    label: 'Home Page',                      sub: 'Hero, value prop, social proof, primary CTA' },
  { key: 'services',     label: 'Services / Features',            sub: 'Service breakdown, pricing tiers, comparisons' },
  { key: 'case_studies', label: 'Case Studies / Testimonials',    sub: 'Results-led stories, before/after metrics' },
  { key: 'landing_page', label: 'High-Converting Landing Page',   sub: 'Paid ads destination — no nav, single CTA' },
  { key: 'about_team',   label: 'About / Team',                   sub: 'Founder story, team profiles, trust signals' },
  { key: 'blog',         label: 'Blog / Resources',               sub: 'SEO content hub, lead magnets' },
  { key: 'contact',      label: 'Contact Page',                   sub: 'Location, hours, embedded form or calendar' },
];

const LEAD_CAPTURE = ['High-Value Form', 'Quiz / Calculator', 'Calendar Booking'];
const CRM_OPTIONS  = ['HubSpot', 'Salesforce', 'Pipedrive', 'ActiveCampaign', 'GoHighLevel', 'None / Not decided'];
const TRIGGER_OPTIONS = [
  { value: 'email',    label: 'Automated intro email',     sub: 'Branded HTML, welcome fires within seconds' },
  { value: 'thankyou', label: 'Custom Thank You page',      sub: 'Redirect with video or next step offer' },
  { value: 'sms',      label: 'SMS alert to sales team',   sub: 'Not lead ping — instant human response' },
  { value: 'all',      label: 'Full stack — all three',    sub: 'Email + Thank You + SMS alert' },
];
const LEGAL_ITEMS = [
  { key: 'privacy', label: 'Privacy Policy — legally vetted and up to date' },
  { key: 'cookie',  label: 'Cookie Consent Banner — GDPR / ePrivacy compliant' },
  { key: 'terms',   label: 'Terms of Service / Website Terms of Use' },
  { key: 'gdpr',    label: 'GDPR-compliant form opt-in checkbox' },
];
const PAID_PLATFORMS = [
  { id: 'meta',      label: 'Meta Ads',        sub: 'Facebook + Instagram' },
  { id: 'google',    label: 'Google Ads / GA4', sub: 'Search, Display, YouTube' },
  { id: 'linkedin',  label: 'LinkedIn Ads',     sub: 'B2B targeting' },
  { id: 'tiktok',    label: 'TikTok Ads',       sub: 'Short-form video' },
  { id: 'pinterest', label: 'Pinterest Ads',    sub: 'Visual discovery' },
  { id: 'none',      label: 'No Paid Ads Yet',  sub: 'Organic / SEO only' },
];
const TOUCHPOINTS = [
  'Website / App UI', 'Instagram / Social Grid', 'Product Packaging',
  'B2B Pitch Decks', 'OOH / Outdoor', 'Email / CRM Templates',
  'Video / TVC Endframes', 'Events / Trade Show',
];
const SOCIAL_MATRIX = [
  { key: 'static_icons',   label: 'Static Social Icons',          desc: 'Header/footer links to social profiles. Lightweight.', complexity: 'Low' },
  { key: 'live_feed',      label: 'Live Instagram / TikTok Feed', desc: 'Pulls live posts directly onto the homepage. Auto-refreshes.', complexity: 'Medium' },
  { key: 'social_proof',   label: 'Social Proof Aggregator',      desc: 'Live Google Reviews or Trustpilot ratings in a testimonial widget.', complexity: 'Medium' },
  { key: 'whatsapp',       label: 'WhatsApp / Chat Widget',        desc: 'Floating button captures leads who don\'t fill forms.', complexity: 'Low' },
];

/* ─── Shared input/textarea class ─── */
const inp = 'w-full rounded-xl border border-[#e2e2e2] bg-white px-4 py-2.5 text-sm text-[#1e1e20] placeholder:text-[#c4c4c4] focus:border-[#1e1e20] focus:outline-none transition-colors';

/* ─── Section heading ─── */
function SectionHead({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-5">
      <h3 className="text-lg font-bold text-[#1e1e20]">{title}</h3>
      {sub && <p className="mt-0.5 text-sm text-[#8c8c8c]">{sub}</p>}
    </div>
  );
}

/* ─── Progress bar (Figma dark header with 3 tabs) ─── */
function ProgressHeader({ step }: { step: Step }) {
  const tabs = ['Conversion Blueprint', 'Tech Stack', 'Traffic & Social'];
  return (
    <div className="rounded-2xl bg-[#1e1e20] p-6 mb-8">
      {/* Tab strip */}
      <div className="flex gap-0 mb-6">
        {tabs.map((t, i) => {
          const s = (i + 1) as Step;
          const done = step > s;
          const active = step === s;
          return (
            <div key={t} className="flex-1 flex flex-col items-center gap-2">
              <div className={`h-0.5 w-full rounded-full transition-all ${done || active ? 'bg-[#f5c842]' : 'bg-white/20'}`} />
              <span className={`text-xs font-medium ${active ? 'text-[#f5c842]' : done ? 'text-white/60' : 'text-white/30'}`}>
                {t}
              </span>
            </div>
          );
        })}
      </div>
      {/* Current step info */}
      <div>
        <h2 className="text-xl font-bold text-white">
          {step === 1 && 'Conversion Blueprint'}
          {step === 2 && 'Tech Stack & Automation'}
          {step === 3 && 'Traffic & Social Fuel'}
        </h2>
        <p className="mt-1 text-sm text-white/50">
          {step === 1 && 'Before a single page is designed, we define how your site captures leads. Every field here shapes the entire technical architecture.'}
          {step === 2 && 'No code required. Tell us your tools and where leads should go — we map the entire pipeline architecture for your build team.'}
          {step === 3 && 'Connect every traffic source to your site so tracking fires correctly from day one. No pixel left behind.'}
        </p>
      </div>
    </div>
  );
}

/* ─── Step 1: Conversion Blueprint ─── */
function Step1({ data, set }: { data: WizardData; set: (k: keyof WizardData, v: any) => void }) {
  const togglePage = (key: string) => set('pages', { ...data.pages, [key]: !data.pages[key] });
  const toggleLead = (v: string) => set('lead_capture', data.lead_capture.includes(v)
    ? data.lead_capture.filter(x => x !== v)
    : [...data.lead_capture, v]);

  return (
    <div className="space-y-8">
      {/* Business & The Hook */}
      <div>
        <SectionHead title="Your Business & The Hook" sub="" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#8c8c8c]">Business / Brand Name</label>
            <input className={inp} placeholder="Your trading name" value={data.business_name}
              onChange={e => set('business_name', e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#8c8c8c]">Contact Email</label>
            <input className={inp} type="email" placeholder="you@business.com" value={data.contact_email}
              onChange={e => set('contact_email', e.target.value)} />
          </div>
        </div>
        <div className="mt-4">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#8c8c8c]">
            Project Deadline <span className="text-red-400">*</span>
          </label>
          <input className={`${inp} ${!data.deadline ? 'border-red-200 bg-red-50' : ''}`} type="date"
            value={data.deadline} onChange={e => set('deadline', e.target.value)} required />
        </div>
        <div className="mt-4">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#8c8c8c]">
            The Hero Hook — Why should a visitor hand over their contact details within 5 seconds of landing?
          </label>
          <input className={inp} placeholder="e.g. Get Your Free 15-Min Audit · Download the Industry Whitepaper · Calculate Your Savings Now"
            value={data.hero_hook} onChange={e => set('hero_hook', e.target.value)} />
        </div>
        <div className="mt-4">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#8c8c8c]">Primary Business Goal For This Website</label>
          <input className={inp} placeholder="e.g. Generate 20+ qualified consultation bookings per week from SME owners across…"
            value={data.primary_goal} onChange={e => set('primary_goal', e.target.value)} />
        </div>
      </div>

      {/* Lead capture types */}
      <div>
        <SectionHead
          title="Select all that apply — each one unlocks its own configuration panel below."
          sub="Select one dominant and one supporting archetype. These become the psychological pillars of the brand personality."
        />
        <div className="flex flex-wrap gap-3">
          {LEAD_CAPTURE.map(lc => {
            const on = data.lead_capture.includes(lc);
            return (
              <button key={lc} onClick={() => toggleLead(lc)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                  on ? 'border-[#1e1e20] bg-[#1e1e20] text-white' : 'border-[#e2e2e2] bg-white text-[#595959] hover:border-[#c4c4c4]'
                }`}>
                {lc}
              </button>
            );
          })}
        </div>
      </div>

      {/* Page toggle tree */}
      <div>
        <SectionHead
          title="Lean Site Tree — Toggle Your Pages"
          sub="Pre-configured for high-converting SME websites. Toggle pages on or off. Green = active."
        />
        <div className="overflow-hidden rounded-2xl border border-[#e2e2e2] bg-white">
          {PAGES.map(({ key, label, sub }, idx) => {
            const on = !!data.pages[key];
            const isChild = idx > 0;
            return (
              <div key={key}
                className={`flex items-center gap-4 px-5 py-4 ${idx < PAGES.length - 1 ? 'border-b border-[#f0f0f0]' : ''}`}>
                {isChild && <span className="ml-2 text-xs text-[#c4c4c4]">└──</span>}
                {/* Toggle */}
                <button onClick={() => togglePage(key)}
                  className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${on ? 'bg-[#22c55e]' : 'bg-[#e2e2e2]'}`}>
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${on ? 'left-4' : 'left-0.5'}`} />
                </button>
                <div className="flex-1">
                  <p className="text-sm font-medium text-[#1e1e20]">{label}</p>
                  <p className="text-xs text-[#8c8c8c]">{sub}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Performance vs Design slider */}
      <div>
        <SectionHead title="Performance vs. Design Flair" sub="This slider directly affects hosting requirements and mobile conversion rates. Choose wisely." />
        <div className="rounded-2xl border border-[#e2e2e2] bg-white p-5">
          <div className="flex items-center justify-between mb-3 text-xs font-medium text-[#8c8c8c]">
            <span>Performance Optimised</span>
            <span>Experience Rich</span>
          </div>
          <input type="range" min={0} max={100} value={data.perf_vs_design}
            onChange={e => set('perf_vs_design', Number(e.target.value))}
            className="w-full accent-[#1e1e20]" />
          <p className="mt-2 text-center text-xs text-[#8c8c8c]">
            {data.perf_vs_design < 30 ? 'Speed-first — lean, fast-loading, minimal animations'
              : data.perf_vs_design > 70 ? 'Experience-rich — immersive, animated, premium feel'
              : 'Balanced — clean UI with selective motion accents'}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Step 2: Tech Stack ─── */
function Step2({ data, set }: { data: WizardData; set: (k: keyof WizardData, v: any) => void }) {
  const toggleLegal = (key: string) => set('legal', { ...data.legal, [key]: !data.legal[key] });

  return (
    <div className="space-y-8">
      {/* Lead Pipeline Builder */}
      <div>
        <SectionHead title="The Lead Pipeline Builder" sub="Define what happens to a lead the moment they submit. Every second of delay costs conversion." />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Step 1 – Capture */}
          <div className="rounded-2xl border border-[#e2e2e2] bg-white p-5">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[#f5c842]">● Step 01 — Capture</p>
            <p className="mb-2 text-sm font-bold text-[#1e1e20]">Web Form / Booking</p>
            <p className="text-xs text-[#8c8c8c]">Your Phase 1 capture mechanisms feed automatically into this entry point.</p>
          </div>
          {/* Step 2 – Database/CRM */}
          <div className="rounded-2xl border border-[#e2e2e2] bg-white p-5">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[#f5c842]">● Step 02 — Database</p>
            <p className="mb-3 text-sm font-bold text-[#1e1e20]">Where does the lead land?</p>
            <select value={data.crm_platform} onChange={e => set('crm_platform', e.target.value)}
              className="w-full rounded-lg border border-[#e2e2e2] bg-white px-3 py-2 text-sm text-[#1e1e20] focus:border-[#1e1e20] focus:outline-none mb-3">
              <option value="">Select your CRM…</option>
              {CRM_OPTIONS.map(c => <option key={c}>{c}</option>)}
            </select>
            <input className="w-full rounded-lg border border-[#e2e2e2] bg-[#f9f9f8] px-3 py-2 text-xs placeholder:text-[#c4c4c4] focus:border-[#1e1e20] focus:outline-none"
              placeholder="CRM workspace URL" value={data.crm_url} onChange={e => set('crm_url', e.target.value)} />
          </div>
          {/* Step 3 – Trigger */}
          <div className="rounded-2xl border border-[#e2e2e2] bg-white p-5">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[#f5c842]">● Step 03 — Trigger</p>
            <p className="mb-3 text-sm font-bold text-[#1e1e20]">What fires immediately?</p>
            <div className="space-y-2">
              {TRIGGER_OPTIONS.map(t => (
                <label key={t.value} className="flex cursor-pointer items-start gap-3">
                  <div className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center ${
                    data.lead_trigger === t.value ? 'border-[#1e1e20] bg-[#1e1e20]' : 'border-[#c4c4c4]'
                  }`}
                    onClick={() => set('lead_trigger', t.value)}>
                    {data.lead_trigger === t.value && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-[#1e1e20]">{t.label}</p>
                    <p className="text-xs text-[#8c8c8c]">{t.sub}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Existing Tech Stack */}
      <div>
        <SectionHead title="Existing Tech Stack" sub="List any tools we need to integrate or work around to prevent conflicts and duplicate data." />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#8c8c8c]">Email marketing tool</label>
            <input className={inp} placeholder="e.g. Mailchimp, Klaviyo, none" value={data.email_tool}
              onChange={e => set('email_tool', e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#8c8c8c]">Live chat / support</label>
            <input className={inp} placeholder="e.g. Intercom, Zendesk, none" value={data.live_chat}
              onChange={e => set('live_chat', e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#8c8c8c]">Current website platform</label>
            <input className={inp} placeholder="e.g. WordPress, Wix" value={data.current_platform}
              onChange={e => set('current_platform', e.target.value)} />
          </div>
        </div>
        <div className="mt-4">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#8c8c8c]">Other integrations the site must support</label>
          <input className={inp} placeholder="e.g. Acuity scheduling type, Shopify checkout, Trustpilot widget, custom API endpoints"
            value={data.other_integrations} onChange={e => set('other_integrations', e.target.value)} />
        </div>
      </div>

      {/* Legal & Compliance */}
      <div>
        <SectionHead title="Legal & Compliance"
          sub="Lead-gen sites in 2026 require strict GDPR / CCPA compliance. Tick what you have. We provision anything missing." />
        <div className="overflow-hidden rounded-2xl border border-[#e2e2e2] bg-white">
          {LEGAL_ITEMS.map(({ key, label }, idx) => {
            const checked = !!data.legal[key];
            return (
              <label key={key} className={`flex cursor-pointer items-center gap-4 px-5 py-4 hover:bg-[#f9f9f8] ${
                idx < LEGAL_ITEMS.length - 1 ? 'border-b border-[#f0f0f0]' : ''}`}>
                <div
                  onClick={() => toggleLegal(key)}
                  className={`h-4 w-4 shrink-0 rounded border-2 flex items-center justify-center transition-colors ${
                    checked ? 'border-[#1e1e20] bg-[#1e1e20]' : 'border-[#c4c4c4]'
                  }`}>
                  {checked && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                </div>
                <span className="flex-1 text-sm text-[#1e1e20]">{label}</span>
                <span className="shrink-0 rounded bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-500">Required</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Geographic markets */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#8c8c8c]">Geographic markets this site will serve</label>
        <input className={inp} placeholder="e.g. Ireland + UK (GDPR), US West Coast (CCPA), EU-wide"
          value={data.geographic_markets} onChange={e => set('geographic_markets', e.target.value)} />
      </div>
    </div>
  );
}

/* ─── Step 3: Traffic & Social ─── */
function Step3({ data, set }: { data: WizardData; set: (k: keyof WizardData, v: any) => void }) {
  const togglePaid = (id: string) => set('paid_platforms', data.paid_platforms.includes(id)
    ? data.paid_platforms.filter(x => x !== id)
    : [...data.paid_platforms, id]);
  const toggleSocial = (key: string) => set('social_integrations', { ...data.social_integrations, [key]: !data.social_integrations[key] });
  const addTouchpoint = (tp: string) => {
    if (!data.touchpoint_queue.includes(tp))
      set('touchpoint_queue', [...data.touchpoint_queue, tp]);
  };
  const removeTouchpoint = (tp: string) => set('touchpoint_queue', data.touchpoint_queue.filter(x => x !== tp));

  return (
    <div className="space-y-8">
      {/* Pixel Tracking */}
      <div>
        <SectionHead title="Pixel Tracking & Analytics"
          sub="Select your active or planned ad platforms. Each one reveals its tracking ID field — we install and verify every pixel on launch." />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {PAID_PLATFORMS.map(({ id, label, sub }) => {
            const on = data.paid_platforms.includes(id);
            return (
              <button key={id} onClick={() => togglePaid(id)}
                className={`rounded-2xl border-2 bg-white p-4 text-left transition-all ${
                  on ? 'border-[#1e1e20] shadow-sm' : 'border-[#e2e2e2] hover:border-[#c4c4c4]'
                }`}>
                <p className="text-sm font-semibold text-[#1e1e20]">{label}</p>
                <p className="text-xs text-[#8c8c8c]">{sub}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Social Integration Matrix */}
      <div>
        <SectionHead title="Social Content Integration Matrix"
          sub="How deeply should your social channels be embedded in the live website?" />
        <div className="overflow-hidden rounded-2xl border border-[#e2e2e2] bg-white">
          <div className="grid grid-cols-[1fr_auto_auto] border-b border-[#f0f0f0] px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[#8c8c8c]">
            <span>Integration Level</span>
            <span className="mr-8">Complexity</span>
            <span>Enable</span>
          </div>
          {SOCIAL_MATRIX.map(({ key, label, desc, complexity }, idx) => {
            const on = !!data.social_integrations[key];
            const cColor = complexity === 'Low' ? 'text-green-600' : 'text-amber-500';
            return (
              <div key={key} className={`grid grid-cols-[1fr_auto_auto] items-center px-5 py-4 ${
                idx < SOCIAL_MATRIX.length - 1 ? 'border-b border-[#f0f0f0]' : ''}`}>
                <div>
                  <p className="text-sm font-medium text-[#1e1e20]">{label}</p>
                  <p className="text-xs text-[#8c8c8c]">{desc}</p>
                </div>
                <span className={`mr-8 text-xs font-medium ${cColor}`}>{complexity}</span>
                <button onClick={() => toggleSocial(key)}
                  className={`h-5 w-9 rounded-full transition-colors ${on ? 'bg-[#22c55e]' : 'bg-[#e2e2e2]'}`}>
                  <span className={`block h-4 w-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Social handles + Google Reviews */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#8c8c8c]">Active social handles to connect</label>
          <input className={inp} placeholder="instagram.com/brand · tiktok.com/@brand · linkedin.com/company/brand"
            value={data.social_handles} onChange={e => set('social_handles', e.target.value)} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#8c8c8c]">Google Reviews / Trustpilot URL</label>
          <input className={inp} type="url" placeholder="https://g.page/yourbusiness"
            value={data.google_reviews_url} onChange={e => set('google_reviews_url', e.target.value)} />
        </div>
      </div>

      {/* Touchpoint Priority Queue */}
      <div>
        <SectionHead title="Touchpoint Priority Queue"
          sub="Click touchpoints to add them in priority order. The build team designs the refresh for channel #1 first." />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Available */}
          <div className="rounded-2xl border border-[#e2e2e2] bg-white p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[#8c8c8c]">All Touchpoints</p>
            <div className="space-y-2">
              {TOUCHPOINTS.filter(tp => !data.touchpoint_queue.includes(tp)).map(tp => (
                <button key={tp} onClick={() => addTouchpoint(tp)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-[#595959] hover:bg-[#f5f3ef]">
                  <span className="text-[#c4c4c4]">○</span> {tp}
                </button>
              ))}
            </div>
          </div>
          {/* Queue */}
          <div className="rounded-2xl border border-[#e2e2e2] bg-[#f9f9f8] p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[#8c8c8c]">Priority Queue</p>
            {data.touchpoint_queue.length === 0
              ? <p className="text-xs text-[#c4c4c4] italic">Add touchpoints from the left →</p>
              : data.touchpoint_queue.map((tp, i) => (
                <div key={tp} className="flex items-center gap-3 rounded-lg bg-white border border-[#e2e2e2] px-3 py-2 mb-2 text-sm text-[#1e1e20]">
                  <span className="text-xs font-bold text-[#8c8c8c] w-4">#{i + 1}</span>
                  <span className="flex-1">{tp}</span>
                  <button onClick={() => removeTouchpoint(tp)} className="text-[#c4c4c4] hover:text-red-400 text-xs">✕</button>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Launch Details */}
      <div>
        <SectionHead title="Launch Details" sub="" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#8c8c8c]">Target launch date</label>
            <input className={inp} type="date" value={data.launch_date}
              onChange={e => set('launch_date', e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#8c8c8c]">Existing domain / hosting provider</label>
            <input className={inp} placeholder="e.g. GoDaddy, Cloudflare, none yet"
              value={data.existing_domain} onChange={e => set('existing_domain', e.target.value)} />
          </div>
        </div>
        <div className="mt-4">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#8c8c8c]">Anything else the build team needs to know</label>
          <textarea rows={4} className={`${inp} resize-none`}
            placeholder="Budget constraints, content readiness (do you have copy + photography?), competitor benchmarks, accessibility requirements…"
            value={data.final_notes} onChange={e => set('final_notes', e.target.value)} />
        </div>
      </div>
    </div>
  );
}

/* ─── Main Wizard ─── */
export default function WebsiteBriefWizard() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const brandFromUrl = params.get('brand') || '';

  const [step, setStep] = useState<Step>(1);
  const [data, setData] = useState<WizardData>({ ...INITIAL, business_name: brandFromUrl });
  const [submitting, setSubmitting] = useState(false);

  const setField = (key: keyof WizardData, value: any) =>
    setData(prev => ({ ...prev, [key]: value }));

  const handleDeploy = async () => {
    setSubmitting(true);
    try {
      const res = await mgxClient.entities.briefs.create({
        data: {
          brief_type: 'website_app',
          title: `${data.business_name || brandFromUrl || 'Website'} — Website Brief`,
          status: 'new',
          brand_name: data.business_name || brandFromUrl,
          project_description: data.primary_goal,
          target_audience: data.geographic_markets,
          key_message: data.hero_hook,
          additional_notes: data.final_notes,
          priority: 'high',
          form_data: JSON.stringify(data),
        },
      });
      toast.success('Website brief deployed!');
      const id = (res?.data as any)?.id;
      navigate(id ? `/briefs/${id}` : '/briefs');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit brief');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SidebarLayout>
      <div className="min-h-full bg-[#f5f3ef]">
        <div className="mx-auto max-w-4xl px-8 py-8">

          {/* Back */}
          <button onClick={() => step === 1 ? navigate('/briefs/new') : setStep((step - 1) as Step)}
            className="mb-6 flex items-center gap-2 text-sm text-[#595959] hover:text-[#1e1e20]">
            <ArrowLeft className="h-4 w-4" />
            {step === 1 ? 'Back to Create Brief' : `← Phase ${step - 1}`}
          </button>

          {/* Progress header */}
          <ProgressHeader step={step} />

          {/* Step content */}
          {step === 1 && <Step1 data={data} set={setField} />}
          {step === 2 && <Step2 data={data} set={setField} />}
          {step === 3 && <Step3 data={data} set={setField} />}

          {/* Navigation footer */}
          <div className="mt-10 flex items-center justify-between border-t border-[#e2e2e2] pt-6">
            <button
              onClick={() => step > 1 && setStep((step - 1) as Step)}
              className={`rounded-xl border border-[#e2e2e2] bg-white px-6 py-2.5 text-sm font-medium text-[#595959] hover:bg-[#f5f3ef] ${step === 1 ? 'invisible' : ''}`}>
              ← Phase {step - 1}
            </button>

            {step < 3 ? (
              <button onClick={() => setStep((step + 1) as Step)}
                className="flex items-center gap-2 rounded-xl bg-[#1e1e20] px-7 py-2.5 text-sm font-semibold text-white hover:opacity-90">
                Next: {step === 1 ? 'Tech Stack' : 'Traffic & Social'} →
              </button>
            ) : (
              <button onClick={handleDeploy} disabled={submitting}
                className="flex items-center gap-2 rounded-xl bg-[#1e1e20] px-7 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {submitting ? 'Deploying…' : 'Deploy Brief →'}
              </button>
            )}
          </div>

        </div>
      </div>
    </SidebarLayout>
  );
}
