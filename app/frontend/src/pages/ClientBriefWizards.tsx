/**
 * Creative Hub — Client Brief Wizards
 * 5 strategic brief types from BRIEF-TYPES-AND-FIELDS spec (Darren McGrath, 5 June 2026)
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { clientToken } from '@/lib/clientAuth';
import { ArrowLeft, Loader2, Check } from 'lucide-react';

/* ── Shared helpers ─────────────────────────────────────────────── */

const inp = 'w-full rounded-xl border border-[#e2e2e2] bg-white px-4 py-2.5 text-sm text-[#1e1e20] placeholder:text-[#c4c4c4] focus:border-[#1e1e20] focus:outline-none transition-colors';
const textarea = `${inp} resize-none`;

function Label({ text, required }: { text: string; required?: boolean }) {
  return (
    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#8c8c8c]">
      {text}{required && <span className="ml-1 text-red-400">*</span>}
    </label>
  );
}

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#e2e2e2] bg-white p-6">
      <h3 className="mb-1 text-base font-bold text-[#1e1e20]">{title}</h3>
      {sub && <p className="mb-5 text-xs text-[#8c8c8c]">{sub}</p>}
      {!sub && <div className="mb-5" />}
      <div className="space-y-5">{children}</div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">{children}</div>;
}

function Chips({ options, selected, onToggle, max }: {
  options: string[]; selected: string[]; onToggle: (v: string) => void; max?: number;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => {
        const on = selected.includes(o);
        const atMax = !!max && selected.length >= max && !on;
        return (
          <button key={o} type="button" disabled={atMax}
            onClick={() => onToggle(o)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
              on ? 'border-[#1e1e20] bg-[#1e1e20] text-white'
                : atMax ? 'cursor-not-allowed border-[#e2e2e2] bg-[#f9f9f8] text-[#c4c4c4]'
                : 'border-[#e2e2e2] bg-white text-[#595959] hover:border-[#c4c4c4]'
            }`}>
            {on && <Check className="mr-1 inline h-3 w-3" strokeWidth={3} />}
            {o}
          </button>
        );
      })}
    </div>
  );
}

function Slider({ label, left, right, value, onChange }: {
  label: string; left: string; right: string; value: number; onChange: (v: number) => void;
}) {
  return (
    <div>
      <Label text={label} />
      <div className="flex items-center gap-3">
        <span className="w-32 text-right text-xs text-[#8c8c8c]">{left}</span>
        <input type="range" min={1} max={7} value={value} onChange={e => onChange(+e.target.value)}
          className="flex-1 accent-[#1e1e20]" />
        <span className="w-32 text-xs text-[#8c8c8c]">{right}</span>
      </div>
      <p className="mt-1 text-center text-xs text-[#8c8c8c]">{value}/7</p>
    </div>
  );
}

function PhaseHeader({ step, totalSteps, phases, title, sub }: {
  step: number; totalSteps: number; phases: string[]; title: string; sub: string;
}) {
  return (
    <div className="rounded-2xl bg-[#1e1e20] p-6 mb-6">
      <div className="flex gap-0 mb-5">
        {phases.map((p, i) => {
          const s = i + 1;
          const active = step === s; const done = step > s;
          return (
            <div key={p} className="flex-1 flex flex-col items-center gap-1.5">
              <div className={`h-0.5 w-full rounded-full ${done || active ? 'bg-[#f5c842]' : 'bg-white/20'}`} />
              <span className={`text-[10px] font-medium text-center leading-tight ${active ? 'text-[#f5c842]' : done ? 'text-white/50' : 'text-white/25'}`}>
                {p}
              </span>
            </div>
          );
        })}
      </div>
      <h2 className="text-lg font-bold text-white">{title}</h2>
      <p className="mt-1 text-sm text-white/50">{sub}</p>
    </div>
  );
}

async function submitBrief(type: string, title: string, company: string, data: any, navigate: any) {
  await axios.post('/api/v1/entities/briefs', {
    brief_type: type,
    title: title || `${company} — ${type.replace(/_/g, ' ')} Brief`,
    status: 'new',
    brand_name: company,
    priority: 'high',
    form_data: JSON.stringify(data),
  }, { headers: { Authorization: `Bearer ${clientToken.get()}` } });
  navigate('/client/briefs');
}

function WizardShell({ children, onBack }: { children: React.ReactNode; onBack: () => void }) {
  return (
    <div className="flex-1 overflow-y-auto bg-[#f5f3ef]">
      <div className="mx-auto max-w-3xl px-6 py-6">
        <button onClick={onBack} className="mb-5 flex items-center gap-2 text-sm text-[#8c8c8c] hover:text-[#1e1e20]">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        {children}
      </div>
    </div>
  );
}

function NavFooter({ step, totalSteps, onPrev, onNext, onSubmit, submitting, canSubmit }: {
  step: number; totalSteps: number; onPrev: () => void; onNext: () => void;
  onSubmit: () => void; submitting: boolean; canSubmit: boolean;
}) {
  return (
    <div className="mt-6 flex items-center justify-between border-t border-[#e2e2e2] pt-5">
      <button onClick={onPrev} className={`rounded-xl border border-[#e2e2e2] bg-white px-6 py-2.5 text-sm font-medium text-[#595959] hover:bg-[#f5f3ef] ${step === 1 ? 'invisible' : ''}`}>
        ← Phase {step - 1}
      </button>
      {step < totalSteps ? (
        <button onClick={onNext} className="flex items-center gap-2 rounded-xl bg-[#1e1e20] px-7 py-2.5 text-sm font-semibold text-white hover:opacity-90">
          Next: Phase {step + 1} →
        </button>
      ) : (
        <button onClick={onSubmit} disabled={submitting || !canSubmit}
          className="flex items-center gap-2 rounded-xl bg-[#1e1e20] px-7 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitting ? 'Submitting…' : 'Submit Brief →'}
        </button>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   BRIEF 1 — THE NEXUS: General Creative Brief
══════════════════════════════════════════════════════════════════ */

const NEXUS_PHASES = ['North Star', 'Audience & Market', 'Creative Canvas', 'Parameters'];
const PROJECT_TYPES = ['Brand Activation', 'Integrated Campaign', 'Product Launch', 'Rebrand', 'Always-On Social'];
const PERSONA_TAGS = ['Decision Maker', 'Early Adopter', 'Value Seeker', 'Brand Loyalist', 'Social Trendsetter', 'Budget Conscious', 'Research-Led', 'Mobile-First', 'B2B Buyer', 'Consumer'];
const CHANNELS = ['Video / TVC', 'Digital Display & Performance', 'OOH / DOOH', 'Influencer & Creator', 'Audio / Podcast', 'Social Media Organic', 'Email & CRM', 'Events & Experiential'];
const BUDGET_TIERS = [
  { value: 'tier1', label: 'Tier 1 — Maximised Impact', desc: 'High production, broad media buy' },
  { value: 'tier2', label: 'Tier 2 — Targeted & Scaled', desc: 'Precision targeting, proven creative' },
  { value: 'tier3', label: 'Tier 3 — Agile & Lean', desc: 'Fast turnaround, social-first' },
];

export function NexusWizard({ companyName }: { companyName: string }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [d, setD] = useState({
    project_name: '', elevator_pitch: '', project_types: [] as string[], business_problem: '', commercial_goal: '',
    personas: [] as string[], current_mindset: '', desired_mindset: '', competitors: '', cultural_anchor: '',
    smim: '', human_insight: '', voice_conservative: 4, voice_witty: 4, voice_rebel: 4,
    mandatories: '', red_flags: '',
    channels: [] as string[], budget_tier: '', kickoff_date: '', first_presentation: '', final_delivery: '',
  });
  const set = (k: string, v: any) => setD(p => ({ ...p, [k]: v }));
  const toggle = (k: string, v: string, max?: number) => {
    const arr = (d as any)[k] as string[];
    if (arr.includes(v)) set(k, arr.filter((x: string) => x !== v));
    else if (!max || arr.length < max) set(k, [...arr, v]);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try { await submitBrief('the_nexus', d.project_name, companyName, d, navigate); }
    catch { alert('Failed to submit. Please try again.'); setSubmitting(false); }
  };

  return (
    <WizardShell onBack={() => navigate('/client/briefs/new')}>
      <PhaseHeader step={step} totalSteps={4} phases={NEXUS_PHASES}
        title={NEXUS_PHASES[step - 1]}
        sub={['Define the project\'s core purpose and strategic objective.',
              'Understand your audience and the market landscape.',
              'Define the creative direction and brand voice.',
              'Set channels, budget tier, and key milestones.'][step - 1]} />

      {step === 1 && <div className="space-y-5">
        <Section title="The Project" sub="Define what this is and why it matters.">
          <div><Label text="Project Name" required /><input className={inp} placeholder="Make it memorable" value={d.project_name} onChange={e => set('project_name', e.target.value)} /></div>
          <div>
            <Label text="Elevator Pitch (140 chars max)" />
            <input className={inp} maxLength={140} placeholder="One sentence that captures the entire project" value={d.elevator_pitch} onChange={e => set('elevator_pitch', e.target.value)} />
            <p className="mt-1 text-right text-xs text-[#c4c4c4]">{d.elevator_pitch.length}/140</p>
          </div>
          <div><Label text="Project Type" /><Chips options={PROJECT_TYPES} selected={d.project_types} onToggle={v => toggle('project_types', v)} /></div>
          <div><Label text="Core Business Problem" /><textarea className={textarea} rows={3} placeholder="Is it an awareness, consideration, or retention problem?" value={d.business_problem} onChange={e => set('business_problem', e.target.value)} /></div>
          <div><Label text="Commercial Goal" /><input className={inp} placeholder="e.g. +15% sign-ups, reposition from value to premium" value={d.commercial_goal} onChange={e => set('commercial_goal', e.target.value)} /></div>
        </Section>
      </div>}

      {step === 2 && <div className="space-y-5">
        <Section title="Audience Intelligence" sub="Who are we talking to, and what do we need to change?">
          <div><Label text="Audience Personas" /><Chips options={PERSONA_TAGS} selected={d.personas} onToggle={v => toggle('personas', v)} /></div>
          <Row>
            <div><Label text="Current Mindset" /><textarea className={textarea} rows={3} placeholder="What the audience thinks or feels right now" value={d.current_mindset} onChange={e => set('current_mindset', e.target.value)} /></div>
            <div><Label text="Desired Mindset" /><textarea className={textarea} rows={3} placeholder="What we want them to think or feel after the campaign" value={d.desired_mindset} onChange={e => set('desired_mindset', e.target.value)} /></div>
          </Row>
          <div><Label text="Competitor Landscape" /><textarea className={textarea} rows={3} placeholder="Who is winning this audience's attention and how?" value={d.competitors} onChange={e => set('competitors', e.target.value)} /></div>
          <div><Label text="Cultural Anchor" /><input className={inp} placeholder="Trend, meme, or societal shift we can leverage" value={d.cultural_anchor} onChange={e => set('cultural_anchor', e.target.value)} /></div>
        </Section>
      </div>}

      {step === 3 && <div className="space-y-5">
        <Section title="Creative Compass" sub="The strategic and tonal direction for all creative output.">
          <div>
            <Label text="Single Most Important Message (SMIM)" required />
            <input className={inp} maxLength={200} placeholder="One thing — if they remember only this, the campaign succeeded" value={d.smim} onChange={e => set('smim', e.target.value)} />
            {d.smim.split(' ').filter(Boolean).length > 25 && <p className="mt-1 text-xs text-amber-500">⚠ Over 25 words — try to sharpen this down</p>}
          </div>
          <div><Label text="Human Insight" /><textarea className={textarea} rows={3} placeholder="The unspoken consumer truth that unlocks the message" value={d.human_insight} onChange={e => set('human_insight', e.target.value)} /></div>
          <Slider label="Brand Voice: Conservative ↔ Provocative" left="Conservative" right="Provocative" value={d.voice_conservative} onChange={v => set('voice_conservative', v)} />
          <Slider label="Brand Voice: Witty ↔ Authoritative" left="Witty" right="Authoritative" value={d.voice_witty} onChange={v => set('voice_witty', v)} />
          <Slider label="Brand Voice: Rebel ↔ Trusted" left="Rebel" right="Trusted" value={d.voice_rebel} onChange={v => set('voice_rebel', v)} />
          <Row>
            <div><Label text="Mandatories (must-includes)" /><textarea className={textarea} rows={3} placeholder="Logos, legal disclaimers, product names, regulatory copy…" value={d.mandatories} onChange={e => set('mandatories', e.target.value)} /></div>
            <div><Label text="Red Flags (must-avoids)" /><textarea className={textarea} rows={3} placeholder="Terms, visuals, associations, competitor names…" value={d.red_flags} onChange={e => set('red_flags', e.target.value)} /></div>
          </Row>
        </Section>
      </div>}

      {step === 4 && <div className="space-y-5">
        <Section title="Channels & Timeline" sub="Where it runs and when it needs to land.">
          <div><Label text="Primary Channels" /><Chips options={CHANNELS} selected={d.channels} onToggle={v => toggle('channels', v)} /></div>
          <div>
            <Label text="Budget Tier" />
            <div className="space-y-2">
              {BUDGET_TIERS.map(t => (
                <button key={t.value} type="button" onClick={() => set('budget_tier', t.value)}
                  className={`flex w-full items-start gap-3 rounded-xl border-2 p-4 text-left transition-all ${d.budget_tier === t.value ? 'border-[#1e1e20] bg-white shadow-sm' : 'border-[#e2e2e2] bg-white hover:border-[#c4c4c4]'}`}>
                  <div className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 ${d.budget_tier === t.value ? 'border-[#1e1e20] bg-[#1e1e20]' : 'border-[#c4c4c4]'}`} />
                  <div><p className="text-sm font-semibold text-[#1e1e20]">{t.label}</p><p className="text-xs text-[#8c8c8c]">{t.desc}</p></div>
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div><Label text="Kickoff / Chemistry Date" /><input className={inp} type="date" value={d.kickoff_date} onChange={e => set('kickoff_date', e.target.value)} /></div>
            <div><Label text="First Creative Presentation" /><input className={inp} type="date" value={d.first_presentation} onChange={e => set('first_presentation', e.target.value)} /></div>
            <div><Label text="Final Asset Delivery" required /><input className={`${inp} ${!d.final_delivery ? 'border-red-200 bg-red-50' : ''}`} type="date" value={d.final_delivery} onChange={e => set('final_delivery', e.target.value)} /></div>
          </div>
        </Section>
      </div>}

      <NavFooter step={step} totalSteps={4} onPrev={() => setStep(s => (s - 1) as any)} onNext={() => setStep(s => (s + 1) as any)}
        onSubmit={handleSubmit} submitting={submitting} canSubmit={!!d.project_name && !!d.final_delivery} />
    </WizardShell>
  );
}

/* ══════════════════════════════════════════════════════════════════
   BRIEF 2 — THE GENESIS: Full Brand Design
══════════════════════════════════════════════════════════════════ */

const GENESIS_PHASES = ['Brand DNA', 'Market Positioning', 'Sensory Canvas', 'Architecture'];
const ARCHETYPES = ['Rebel', 'Creator', 'Sage', 'Caregiver', 'Hero', 'Jester', 'Lover', 'Explorer', 'Ruler', 'Magician', 'Innocent', 'Everyman'];
const NAMING_STATUS = [
  { v: 'final', l: 'Final vetted name', s: 'We have a name, ready to go' },
  { v: 'shortlist', l: 'Shortlist of names', s: 'We have 2–3 options, need a decision' },
  { v: 'create', l: 'Need agency to name it', s: 'Start from scratch, full naming process' },
];
const AESTHETICS = [
  { key: 'minimalist', label: 'Minimalist / Organic', desc: 'Clean, natural, breathing room' },
  { key: 'neon', label: 'Neo-Neon / Cyberpunk', desc: 'Electric, digital, high energy' },
  { key: 'brutalist', label: 'Brutalist / Bold', desc: 'Raw, unapologetic, impactful' },
  { key: 'heritage', label: 'Classic Heritage / Editorial', desc: 'Timeless, credible, refined' },
];
const DELIVERABLE_GROUPS = {
  'Visual Identity': ['Primary & Secondary Logos', 'Colour Palette', 'Typography Suite', 'Custom Iconography', 'Brand Mascot / Character'],
  'Digital': ['UI/UX Design System (Figma)', 'Motion Guidelines', 'Social Media Launch Kit'],
  'Physical': ['Product Packaging', 'Corporate Stationery & Swag', 'Retail / Spatial Guidelines'],
  'Verbal': ['Brand Manifesto', 'Tagline & Slogan Matrix', 'Verbal Style Guide'],
};

export function GenesisWizard({ companyName }: { companyName: string }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [d, setD] = useState({
    brand_name: '', problem_solves: '', ten_year_ambition: '', dominant_archetype: '', supporting_archetype: '',
    we_are: [] as string[], we_are_not: [] as string[],
    sector: '', target_position: '', visual_cliches: '', competitor1: '', competitor2: '', competitor3: '',
    naming_status: '', final_name: '', shortlist_names: '', naming_style: '',
    aesthetics: {} as Record<string, number>, aesthetics_notes: {} as Record<string, string>,
    brand_structure: '', deliverables: [] as string[], deadline: '',
  });
  const set = (k: string, v: any) => setD(p => ({ ...p, [k]: v }));
  const toggleDel = (v: string) => setD(p => ({ ...p, deliverables: p.deliverables.includes(v) ? p.deliverables.filter(x => x !== v) : [...p.deliverables, v] }));
  const WE_ARE_OPTIONS = ['Bold', 'Empathetic', 'Disruptive', 'Trustworthy', 'Playful', 'Authoritative', 'Innovative', 'Sustainable', 'Premium', 'Accessible', 'Urgent', 'Timeless'];

  const handleSubmit = async () => {
    setSubmitting(true);
    try { await submitBrief('the_genesis', d.brand_name || `${companyName} New Brand`, companyName, d, navigate); }
    catch { alert('Failed to submit.'); setSubmitting(false); }
  };

  return (
    <WizardShell onBack={() => navigate('/client/briefs/new')}>
      <PhaseHeader step={step} totalSteps={4} phases={GENESIS_PHASES}
        title={GENESIS_PHASES[step - 1]}
        sub={['Establish the psychological and strategic foundations of the new brand.',
              'Map the competitive landscape and find your white space.',
              'Define the visual and sensory direction.',
              'Decide the brand structure and deliverables scope.'][step - 1]} />

      {step === 1 && <div className="space-y-5">
        <Section title="Strategic Foundation">
          <div><Label text="Brand / Project Name" required /><input className={inp} placeholder="What will this brand be called?" value={d.brand_name} onChange={e => set('brand_name', e.target.value)} /></div>
          <div><Label text="The Problem It Solves" /><textarea className={textarea} rows={3} placeholder="Why does this brand need to exist? What void does it fill?" value={d.problem_solves} onChange={e => set('problem_solves', e.target.value)} /></div>
          <div><Label text="The 10-Year Ambition" /><textarea className={textarea} rows={3} placeholder="If this brand achieves everything it sets out to do, how will it change its industry?" value={d.ten_year_ambition} onChange={e => set('ten_year_ambition', e.target.value)} /></div>
        </Section>
        <Section title="Brand Archetypes" sub="Select one dominant and one supporting. These become the psychological pillars of the brand personality.">
          <div>
            <Label text="Dominant Archetype" required />
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {ARCHETYPES.map(a => (
                <button key={a} type="button" onClick={() => set('dominant_archetype', a)}
                  className={`rounded-xl border-2 py-2.5 text-sm font-medium transition-all ${d.dominant_archetype === a ? 'border-[#1e1e20] bg-[#1e1e20] text-white' : 'border-[#e2e2e2] bg-white text-[#595959] hover:border-[#c4c4c4]'}`}>
                  {a}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label text="Supporting Archetype" />
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {ARCHETYPES.filter(a => a !== d.dominant_archetype).map(a => (
                <button key={a} type="button" onClick={() => set('supporting_archetype', d.supporting_archetype === a ? '' : a)}
                  className={`rounded-xl border-2 py-2.5 text-sm font-medium transition-all ${d.supporting_archetype === a ? 'border-[#8b5cf6] bg-[#8b5cf6] text-white' : 'border-[#e2e2e2] bg-white text-[#595959] hover:border-[#c4c4c4]'}`}>
                  {a}
                </button>
              ))}
            </div>
          </div>
        </Section>
        <Section title="Brand Personality" sub="Drag adjectives into the columns — or select them here.">
          <div>
            <Label text="We Are…" />
            <Chips options={WE_ARE_OPTIONS} selected={d.we_are} onToggle={v => setD(p => ({ ...p, we_are: p.we_are.includes(v) ? p.we_are.filter(x => x !== v) : [...p.we_are, v] }))} />
          </div>
          <div>
            <Label text="We Are NOT…" />
            <Chips options={WE_ARE_OPTIONS} selected={d.we_are_not} onToggle={v => setD(p => ({ ...p, we_are_not: p.we_are_not.includes(v) ? p.we_are_not.filter(x => x !== v) : [...p.we_are_not, v] }))} />
          </div>
        </Section>
      </div>}

      {step === 2 && <div className="space-y-5">
        <Section title="Competitive Landscape">
          <div><Label text="Industry Sector" /><input className={inp} placeholder="e.g. B2B Tech, Consumer FMCG, Professional Services, Fashion" value={d.sector} onChange={e => set('sector', e.target.value)} /></div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {['competitor1', 'competitor2', 'competitor3'].map((k, i) => (
              <div key={k}><Label text={`Competitor ${i + 1}`} /><input className={inp} placeholder="Brand name" value={(d as any)[k]} onChange={e => set(k, e.target.value)} /></div>
            ))}
          </div>
          <div><Label text="Where Should This Brand Sit in the Market?" /><textarea className={textarea} rows={3} placeholder="Describe your target positioning — e.g. 'Premium but approachable, disruptive to the corporate-heavy incumbents'" value={d.target_position} onChange={e => set('target_position', e.target.value)} /></div>
          <div><Label text="Visual Clichés to Avoid" /><textarea className={textarea} rows={2} placeholder="What are you terrified of repeating? e.g. 'dark blue & green like every finance brand'" value={d.visual_cliches} onChange={e => set('visual_cliches', e.target.value)} /></div>
        </Section>
      </div>}

      {step === 3 && <div className="space-y-5">
        <Section title="Naming">
          <div>
            <Label text="Naming Status" required />
            <div className="space-y-2">
              {NAMING_STATUS.map(n => (
                <button key={n.v} type="button" onClick={() => set('naming_status', n.v)}
                  className={`flex w-full items-center gap-3 rounded-xl border-2 p-4 text-left transition-all ${d.naming_status === n.v ? 'border-[#1e1e20] bg-white shadow-sm' : 'border-[#e2e2e2] bg-white'}`}>
                  <div className={`h-4 w-4 shrink-0 rounded-full border-2 ${d.naming_status === n.v ? 'border-[#1e1e20] bg-[#1e1e20]' : 'border-[#c4c4c4]'}`} />
                  <div><p className="text-sm font-semibold text-[#1e1e20]">{n.l}</p><p className="text-xs text-[#8c8c8c]">{n.s}</p></div>
                </button>
              ))}
            </div>
          </div>
          {d.naming_status === 'final' && <div><Label text="Final Name + Pronunciation" /><input className={inp} placeholder="e.g. Nuvora (noo-VOR-ah)" value={d.final_name} onChange={e => set('final_name', e.target.value)} /></div>}
          {d.naming_status === 'shortlist' && <div><Label text="Top 3 Name Options" /><textarea className={textarea} rows={3} placeholder="Name 1 — pros & cons&#10;Name 2 — pros & cons&#10;Name 3 — pros & cons" value={d.shortlist_names} onChange={e => set('shortlist_names', e.target.value)} /></div>}
          {d.naming_status === 'create' && <div><Label text="Linguistic Style Direction" /><input className={inp} placeholder="e.g. Neologism (made-up word), Descriptive, Metaphorical, Founder name" value={d.naming_style} onChange={e => set('naming_style', e.target.value)} /></div>}
        </Section>
        <Section title="Aesthetic Direction" sub="Rate how strongly each style resonates (1–5). Add a note if it conflicts or connects with your vision.">
          {AESTHETICS.map(({ key, label, desc }) => (
            <div key={key} className="rounded-xl border border-[#e2e2e2] p-4">
              <div className="mb-2 flex items-start justify-between">
                <div><p className="text-sm font-semibold text-[#1e1e20]">{label}</p><p className="text-xs text-[#8c8c8c]">{desc}</p></div>
                <div className="flex gap-1">
                  {[1,2,3,4,5].map(n => (
                    <button key={n} type="button" onClick={() => setD(p => ({ ...p, aesthetics: { ...p.aesthetics, [key]: n } }))}
                      className={`h-7 w-7 rounded-full text-xs font-bold transition-all ${(d.aesthetics[key] || 0) >= n ? 'bg-[#1e1e20] text-white' : 'bg-[#f0f0f0] text-[#8c8c8c] hover:bg-[#e2e2e2]'}`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <input className={`${inp} text-xs`} placeholder="What connects or clashes with your vision?" value={d.aesthetics_notes[key] || ''} onChange={e => setD(p => ({ ...p, aesthetics_notes: { ...p.aesthetics_notes, [key]: e.target.value } }))} />
            </div>
          ))}
        </Section>
      </div>}

      {step === 4 && <div className="space-y-5">
        <Section title="Brand Architecture">
          <div>
            <Label text="Brand Structure" />
            {['Single standalone brand / product', 'Master brand with sub-brands or sister companies'].map(s => (
              <button key={s} type="button" onClick={() => set('brand_structure', s)}
                className={`mb-2 flex w-full items-center gap-3 rounded-xl border-2 p-4 text-left transition-all ${d.brand_structure === s ? 'border-[#1e1e20] bg-white shadow-sm' : 'border-[#e2e2e2] bg-white'}`}>
                <div className={`h-4 w-4 shrink-0 rounded-full border-2 ${d.brand_structure === s ? 'border-[#1e1e20] bg-[#1e1e20]' : 'border-[#c4c4c4]'}`} />
                <span className="text-sm text-[#1e1e20]">{s}</span>
              </button>
            ))}
          </div>
        </Section>
        <Section title="Deliverables" sub="Select everything you need from this engagement.">
          {Object.entries(DELIVERABLE_GROUPS).map(([group, items]) => (
            <div key={group}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#8c8c8c]">{group}</p>
              <div className="space-y-1.5">
                {items.map(item => (
                  <label key={item} className="flex cursor-pointer items-center gap-3 rounded-lg border border-[#e2e2e2] px-4 py-2.5 hover:bg-[#f9f9f8]">
                    <div onClick={() => toggleDel(item)}
                      className={`h-4 w-4 shrink-0 rounded border-2 flex items-center justify-center transition-colors ${d.deliverables.includes(item) ? 'border-[#1e1e20] bg-[#1e1e20]' : 'border-[#c4c4c4]'}`}>
                      {d.deliverables.includes(item) && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                    </div>
                    <span className="text-sm text-[#1e1e20]">{item}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </Section>
        <div><Label text="Target Completion Date" required /><input className={`${inp} ${!d.deadline ? 'border-red-200 bg-red-50' : ''}`} type="date" value={d.deadline} onChange={e => set('deadline', e.target.value)} /></div>
      </div>}

      <NavFooter step={step} totalSteps={4} onPrev={() => setStep(s => (s - 1) as any)} onNext={() => setStep(s => (s + 1) as any)}
        onSubmit={handleSubmit} submitting={submitting} canSubmit={!!d.brand_name && !!d.deadline} />
    </WizardShell>
  );
}

/* ══════════════════════════════════════════════════════════════════
   BRIEF 3 — THE EVOLUTION: Brand Refresh
══════════════════════════════════════════════════════════════════ */

const EVOLUTION_PHASES = ['Asset Audit', 'Fatigue Diagnostics', 'Elasticity Mapping'];
const SACRED_COWS = ['Primary Logo', 'Core Brand Colour(s)', 'Brand Name / Monogram', 'Core Typography'];
const FATIGUE_SYMPTOMS = [
  'Inconsistency — brand executed differently across teams or touchpoints',
  'Digital Limitations — built for print, looks dated on screen',
  'Audience Drift — failing to connect with newer demographic',
  'Competitor Encroachment — nimbler brands making us look traditional',
];
const EVOLUTION_ELEMENTS = ['Secondary Colour Palette', 'Photography / Art Direction Style', 'Typography Hierarchy & Sub-fonts', 'Motion Graphics & Animation', 'Graphic Devices, Patterns & Textures'];
const EVOLUTION_OPTIONS = ['Keep Exactly As Is', 'Evolve & Modernise', 'Complete Revolution'];

export function EvolutionWizard({ companyName }: { companyName: string }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [d, setD] = useState({
    sacred_cows: [] as string[], existing_tagline: '', brand_age: '',
    symptoms: [] as string[],
    visual_current: 3, visual_target: 6,
    tone_current: 2, tone_target: 5,
    ecosystem_current: 2, ecosystem_target: 5,
    elasticity: {} as Record<string, string>,
    inspiration: '', reference_example: '', deadline: '',
  });
  const set = (k: string, v: any) => setD(p => ({ ...p, [k]: v }));
  const toggleSacred = (v: string) => setD(p => ({ ...p, sacred_cows: p.sacred_cows.includes(v) ? p.sacred_cows.filter(x => x !== v) : [...p.sacred_cows, v] }));
  const toggleSymptom = (v: string) => {
    const arr = d.symptoms;
    if (arr.includes(v)) setD(p => ({ ...p, symptoms: arr.filter(x => x !== v) }));
    else if (arr.length < 2) setD(p => ({ ...p, symptoms: [...arr, v] }));
  };

  const allRevolution = EVOLUTION_ELEMENTS.every(e => d.elasticity[e] === 'Complete Revolution');
  const handleSubmit = async () => {
    setSubmitting(true);
    try { await submitBrief('the_evolution', `${companyName} Brand Refresh`, companyName, d, navigate); }
    catch { alert('Failed to submit.'); setSubmitting(false); }
  };

  return (
    <WizardShell onBack={() => navigate('/client/briefs/new')}>
      <PhaseHeader step={step} totalSteps={3} phases={EVOLUTION_PHASES}
        title={EVOLUTION_PHASES[step - 1]}
        sub={['Audit existing brand assets and what cannot change.',
              'Diagnose where the brand feels fatigued.',
              'Define how far we can push each brand element.'][step - 1]} />

      {step === 1 && <div className="space-y-5">
        <Section title="Sacred Cows" sub="What absolutely cannot change — tick everything that is non-negotiable.">
          <div className="space-y-2">
            {SACRED_COWS.map(sc => (
              <label key={sc} className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#e2e2e2] bg-white px-4 py-3 hover:bg-[#f9f9f8]">
                <div onClick={() => toggleSacred(sc)} className={`h-4 w-4 shrink-0 rounded border-2 flex items-center justify-center transition-colors ${d.sacred_cows.includes(sc) ? 'border-[#1e1e20] bg-[#1e1e20]' : 'border-[#c4c4c4]'}`}>
                  {d.sacred_cows.includes(sc) && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                </div>
                <span className="text-sm font-medium text-[#1e1e20]">{sc} — cannot change</span>
              </label>
            ))}
          </div>
        </Section>
        <Section title="Current Brand Context">
          <Row>
            <div><Label text="Existing Tagline (if any)" /><input className={inp} placeholder="Your current tagline or strapline" value={d.existing_tagline} onChange={e => set('existing_tagline', e.target.value)} /></div>
            <div><Label text="Brand Age / Year Created" /><input className={inp} placeholder="e.g. 2015, roughly 10 years old" value={d.brand_age} onChange={e => set('brand_age', e.target.value)} /></div>
          </Row>
          <div><Label text="Please upload or describe current brand guidelines" /><textarea className={textarea} rows={3} placeholder="Describe your current brand, or paste a link to your brand guidelines / Google Drive folder" /></div>
        </Section>
      </div>}

      {step === 2 && <div className="space-y-5">
        <Section title="Primary Symptom" sub="Select the top 2 reasons you feel the brand needs refreshing.">
          <div className="space-y-2">
            {FATIGUE_SYMPTOMS.map(s => {
              const on = d.symptoms.includes(s);
              const atMax = d.symptoms.length >= 2 && !on;
              return (
                <button key={s} type="button" disabled={atMax} onClick={() => toggleSymptom(s)}
                  className={`flex w-full items-start gap-3 rounded-xl border-2 p-4 text-left transition-all ${on ? 'border-[#1e1e20] bg-white shadow-sm' : atMax ? 'cursor-not-allowed border-[#e2e2e2] bg-[#f9f9f8] opacity-50' : 'border-[#e2e2e2] bg-white hover:border-[#c4c4c4]'}`}>
                  <div className={`mt-0.5 h-4 w-4 shrink-0 rounded border-2 flex items-center justify-center ${on ? 'border-[#1e1e20] bg-[#1e1e20]' : 'border-[#c4c4c4]'}`}>
                    {on && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                  </div>
                  <span className="text-sm text-[#1e1e20]">{s}</span>
                </button>
              );
            })}
          </div>
        </Section>
        <Section title="Brand Gap Analysis" sub="Where are you now vs where you want to be? Move both markers on each scale.">
          {[
            { key_c: 'visual_current', key_t: 'visual_target', label: 'Visual Style', left: 'Flat / Static', right: 'Dynamic / Motion-First' },
            { key_c: 'tone_current', key_t: 'tone_target', label: 'Tone of Voice', left: 'Safe / Expected', right: 'Provocative / Bold' },
            { key_c: 'ecosystem_current', key_t: 'ecosystem_target', label: 'Brand Ecosystem', left: 'Corporate / Rigid', right: 'Lifestyle / Cultural' },
          ].map(({ key_c, key_t, label, left, right }) => (
            <div key={key_c}>
              <Label text={label} />
              <div className="rounded-xl border border-[#e2e2e2] bg-white p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <span className="w-20 text-right text-xs text-[#8c8c8c]">{left}</span>
                  <div className="flex-1 relative">
                    <input type="range" min={1} max={10} value={(d as any)[key_c]} onChange={e => set(key_c, +e.target.value)} className="w-full accent-[#8c8c8c]" />
                    <p className="text-center text-[10px] text-[#8c8c8c]">Current: {(d as any)[key_c]}/10</p>
                  </div>
                  <span className="w-20 text-xs text-[#8c8c8c]">{right}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-20 text-right text-xs text-[#8c8c8c]">{left}</span>
                  <div className="flex-1">
                    <input type="range" min={1} max={10} value={(d as any)[key_t]} onChange={e => set(key_t, +e.target.value)} className="w-full accent-[#1e1e20]" />
                    <p className="text-center text-[10px] text-[#1e1e20] font-medium">Target: {(d as any)[key_t]}/10</p>
                  </div>
                  <span className="w-20 text-xs text-[#8c8c8c]">{right}</span>
                </div>
              </div>
            </div>
          ))}
        </Section>
      </div>}

      {step === 3 && <div className="space-y-5">
        <Section title="Elasticity Mapping" sub="For each element, how far can we push the change?">
          <div className="overflow-hidden rounded-2xl border border-[#e2e2e2] bg-white">
            {EVOLUTION_ELEMENTS.map((el, idx) => (
              <div key={el} className={`p-4 ${idx < EVOLUTION_ELEMENTS.length - 1 ? 'border-b border-[#f0f0f0]' : ''}`}>
                <p className="mb-2 text-sm font-medium text-[#1e1e20]">{el}</p>
                <div className="flex gap-2">
                  {EVOLUTION_OPTIONS.map(opt => (
                    <button key={opt} type="button" onClick={() => setD(p => ({ ...p, elasticity: { ...p.elasticity, [el]: opt } }))}
                      className={`flex-1 rounded-lg border px-2 py-2 text-xs font-medium text-center transition-all ${d.elasticity[el] === opt
                        ? opt === 'Keep Exactly As Is' ? 'border-blue-300 bg-blue-50 text-blue-700'
                          : opt === 'Evolve & Modernise' ? 'border-amber-300 bg-amber-50 text-amber-700'
                          : 'border-red-300 bg-red-50 text-red-700'
                        : 'border-[#e2e2e2] bg-[#f9f9f8] text-[#8c8c8c] hover:border-[#c4c4c4]'}`}>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {allRevolution && <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-700">⚠ You've selected Complete Revolution for all elements. This may be a Full Rebrand rather than a Refresh — we'll discuss scope at kickoff.</div>}
        </Section>
        <Section title="Creative Direction">
          <div><Label text="Inspiration & References" /><textarea className={textarea} rows={3} placeholder="Describe the visual direction, or paste links to brands, campaigns, or imagery that represent the target refresh" value={d.inspiration} onChange={e => set('inspiration', e.target.value)} /></div>
          <div><Label text="Target Delivery Date" required /><input className={`${inp} ${!d.deadline ? 'border-red-200 bg-red-50' : ''}`} type="date" value={d.deadline} onChange={e => set('deadline', e.target.value)} /></div>
        </Section>
      </div>}

      <NavFooter step={step} totalSteps={3} onPrev={() => setStep(s => (s - 1) as any)} onNext={() => setStep(s => (s + 1) as any)}
        onSubmit={handleSubmit} submitting={submitting} canSubmit={!!d.deadline} />
    </WizardShell>
  );
}

/* ══════════════════════════════════════════════════════════════════
   BRIEF 5 — THE VELOCITY: 30-Day Content Plan
══════════════════════════════════════════════════════════════════ */

const VELOCITY_PHASES = ['Activation Pulse', 'Content Pillars', '30-Day Plan'];
const OBJECTIVES = [
  { v: 'awareness', l: 'Brand Awareness & Reach', d: 'Expand who knows you — top of funnel, mass reach' },
  { v: 'engagement', l: 'Community Engagement & Trust', d: 'Deepen relationships with existing audience' },
  { v: 'conversion', l: 'Product Conversion & Sales', d: 'Drive purchases, sign-ups, or direct revenue' },
];
const POST_FORMATS = ['Reel', 'Short Video', 'Carousel', 'Single Image', 'Text Post', 'Poll', 'Story', 'Live'];
const PLATFORMS = ['Instagram', 'TikTok', 'LinkedIn', 'Facebook', 'YouTube Shorts', 'X / Twitter', 'Pinterest'];

export function VelocityWizard({ companyName }: { companyName: string }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [d, setD] = useState({
    objective: '', anchor_moments: '', asset_capacity: 4,
    platforms: [] as string[],
    hero_pct: 15, hub_pct: 50, help_pct: 35,
    month_start: '', formats: [] as string[],
    hero_themes: '', hub_themes: '', help_themes: '', additional_notes: '',
  });
  const set = (k: string, v: any) => setD(p => ({ ...p, [k]: v }));
  const togglePlatform = (v: string) => setD(p => ({ ...p, platforms: p.platforms.includes(v) ? p.platforms.filter(x => x !== v) : [...p.platforms, v] }));
  const toggleFormat = (v: string) => setD(p => ({ ...p, formats: p.formats.includes(v) ? p.formats.filter(x => x !== v) : [...p.formats, v] }));

  const totalPct = d.hero_pct + d.hub_pct + d.help_pct;
  const handleSubmit = async () => {
    setSubmitting(true);
    try { await submitBrief('the_velocity', `${companyName} 30-Day Content Plan`, companyName, d, navigate); }
    catch { alert('Failed to submit.'); setSubmitting(false); }
  };

  return (
    <WizardShell onBack={() => navigate('/client/briefs/new')}>
      <PhaseHeader step={step} totalSteps={3} phases={VELOCITY_PHASES}
        title={VELOCITY_PHASES[step - 1]}
        sub={['Define your 30-day goal, anchor moments, and production capacity.',
              'Set your content mix across Hero, Hub, and Help pillars.',
              'Define formats, platforms, and key creative themes.'][step - 1]} />

      {step === 1 && <div className="space-y-5">
        <Section title="Primary 30-Day Objective" sub="This drives the entire content mix. Select one only.">
          <div className="space-y-2">
            {OBJECTIVES.map(o => (
              <button key={o.v} type="button" onClick={() => set('objective', o.v)}
                className={`flex w-full items-start gap-3 rounded-xl border-2 p-4 text-left transition-all ${d.objective === o.v ? 'border-[#1e1e20] bg-white shadow-sm' : 'border-[#e2e2e2] bg-white hover:border-[#c4c4c4]'}`}>
                <div className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 ${d.objective === o.v ? 'border-[#1e1e20] bg-[#1e1e20]' : 'border-[#c4c4c4]'}`} />
                <div><p className="text-sm font-semibold text-[#1e1e20]">{o.l}</p><p className="text-xs text-[#8c8c8c]">{o.d}</p></div>
              </button>
            ))}
          </div>
        </Section>
        <Section title="Month Planning">
          <div><Label text="Month Starts" required /><input className={`${inp} ${!d.month_start ? 'border-red-200 bg-red-50' : ''}`} type="date" value={d.month_start} onChange={e => set('month_start', e.target.value)} /></div>
          <div><Label text="Anchor Moments" /><textarea className={textarea} rows={4} placeholder="Pin key dates in the month:&#10;e.g. Product Launch — Day 8&#10;Live Webinar — Day 15&#10;End-of-month sale — Day 28" value={d.anchor_moments} onChange={e => set('anchor_moments', e.target.value)} /></div>
          <div>
            <Label text={`Creative Asset Capacity: ${d.asset_capacity} assets/week`} />
            <input type="range" min={2} max={8} step={2} value={d.asset_capacity} onChange={e => set('asset_capacity', +e.target.value)} className="w-full accent-[#1e1e20]" />
            <div className="flex justify-between text-xs text-[#c4c4c4]"><span>2/wk</span><span>4/wk</span><span>6/wk</span><span>8+/wk</span></div>
          </div>
        </Section>
      </div>}

      {step === 2 && <div className="space-y-5">
        <Section title="Content Pillar Mix" sub="Set the percentage split for the month. Minimum 40% Hub content recommended.">
          <div className="rounded-2xl border border-[#e2e2e2] bg-white overflow-hidden">
            {[
              { key: 'hero_pct', label: 'Hero Content', color: '#ef4444', desc: 'Major campaign moments, high-production video', min: 0, max: 60 },
              { key: 'hub_pct', label: 'Hub Content', color: '#3b82f6', desc: 'Consistent weekly series, behind-the-scenes', min: 30, max: 80 },
              { key: 'help_pct', label: 'Help / Community', color: '#10b981', desc: "Q&As, educational tips, community replies", min: 0, max: 60 },
            ].map(({ key, label, color, desc, min, max }, idx) => (
              <div key={key} className={`p-4 ${idx < 2 ? 'border-b border-[#f0f0f0]' : ''}`}>
                <div className="flex items-center justify-between mb-2">
                  <div><p className="text-sm font-semibold text-[#1e1e20]">{label}</p><p className="text-xs text-[#8c8c8c]">{desc}</p></div>
                  <span className="text-lg font-bold" style={{ color }}>{(d as any)[key]}%</span>
                </div>
                <input type="range" min={min} max={max} value={(d as any)[key]} style={{ accentColor: color }}
                  onChange={e => set(key, +e.target.value)} className="w-full" />
                {key === 'hub_pct' && (d as any)[key] < 40 && <p className="mt-1 text-xs text-amber-500">⚠ Below 40% Hub may penalise organic reach</p>}
              </div>
            ))}
          </div>
          <div className={`rounded-xl p-3 text-center text-sm font-semibold ${totalPct === 100 ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
            Total: {totalPct}% {totalPct === 100 ? '✓ Balanced' : `— adjust to reach 100%`}
          </div>
        </Section>
        <Section title="Platforms">
          <div><Label text="Active Platforms for this month" /><Chips options={PLATFORMS} selected={d.platforms} onToggle={togglePlatform} /></div>
        </Section>
      </div>}

      {step === 3 && <div className="space-y-5">
        <Section title="Content Themes & Formats">
          <div><Label text="Post Formats" /><Chips options={POST_FORMATS} selected={d.formats} onToggle={toggleFormat} /></div>
          <div><Label text="Hero Content Themes" /><textarea className={textarea} rows={2} placeholder="Major campaign concepts, hero video ideas, launch moments" value={d.hero_themes} onChange={e => set('hero_themes', e.target.value)} /></div>
          <div><Label text="Hub Content Themes" /><textarea className={textarea} rows={2} placeholder="Recurring series ideas, behind-the-scenes, team content" value={d.hub_themes} onChange={e => set('hub_themes', e.target.value)} /></div>
          <div><Label text="Help / Community Themes" /><textarea className={textarea} rows={2} placeholder="FAQ topics, tutorial ideas, customer questions to answer" value={d.help_themes} onChange={e => set('help_themes', e.target.value)} /></div>
          <div><Label text="Additional Notes" /><textarea className={textarea} rows={3} placeholder="Brand voice guidelines, any upcoming product news, restrictions, visual direction…" value={d.additional_notes} onChange={e => set('additional_notes', e.target.value)} /></div>
        </Section>
      </div>}

      <NavFooter step={step} totalSteps={3} onPrev={() => setStep(s => (s - 1) as any)} onNext={() => setStep(s => (s + 1) as any)}
        onSubmit={handleSubmit} submitting={submitting} canSubmit={!!d.objective && !!d.month_start} />
    </WizardShell>
  );
}
