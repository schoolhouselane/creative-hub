import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { X, Download, Loader2, Plus, Trash2, Check, GripVertical, ChevronLeft } from 'lucide-react';
import axios from 'axios';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BrandForEditor {
  id?: number;
  brand_name: string;
  logo_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  font_heading?: string | null;
  tagline?: string | null;
  brand_dna?: string | null;
}

interface TextLayer {
  x: number; y: number;
  anchorX: number; anchorY: number;
  sizeFrac: number;
  weight: string;
  maxWidthFrac: number;
  align: 'left' | 'center' | 'right';
}

interface LogoLayer {
  x: number; y: number;
  anchorX: number; anchorY: number;
  sizeFrac: number;
}

export interface Template {
  id: string;
  name: string;
  overlay: string;
  headline: TextLayer;
  subtitle: TextLayer;
  url: TextLayer;
  logo: LogoLayer;
  custom?: boolean;
}

type ElementKey = 'headline' | 'subtitle' | 'url' | 'logo';

// ─── Built-in templates ──────────────────────────────────────────────────────

const BUILTIN_TEMPLATES: Template[] = [
  {
    id: 'urban-bold', name: 'Urban Bold',
    overlay: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, transparent 50%)',
    headline: { x: 0.06, y: 0.09, anchorX: 0, anchorY: 0, sizeFrac: 0.072, weight: '900', maxWidthFrac: 0.82, align: 'left' },
    subtitle: { x: 0.06, y: 0.22, anchorX: 0, anchorY: 0, sizeFrac: 0.028, weight: '400', maxWidthFrac: 0.70, align: 'left' },
    url:      { x: 0.06, y: 0.93, anchorX: 0, anchorY: 1,  sizeFrac: 0.020, weight: '400', maxWidthFrac: 0.50, align: 'left' },
    logo:     { x: 0.94, y: 0.91, anchorX: 1, anchorY: 1,  sizeFrac: 0.14 },
  },
  {
    id: 'clean-center', name: 'Clean Centre',
    overlay: 'linear-gradient(0deg, rgba(0,0,0,0.6) 0%, transparent 40%, transparent 60%, rgba(0,0,0,0.35) 100%)',
    headline: { x: 0.50, y: 0.46, anchorX: 0.5, anchorY: 1, sizeFrac: 0.065, weight: '800', maxWidthFrac: 0.82, align: 'center' },
    subtitle: { x: 0.50, y: 0.55, anchorX: 0.5, anchorY: 0, sizeFrac: 0.026, weight: '400', maxWidthFrac: 0.70, align: 'center' },
    url:      { x: 0.50, y: 0.94, anchorX: 0.5, anchorY: 1, sizeFrac: 0.020, weight: '400', maxWidthFrac: 0.50, align: 'center' },
    logo:     { x: 0.50, y: 0.08, anchorX: 0.5, anchorY: 0, sizeFrac: 0.14 },
  },
  {
    id: 'bottom-bar', name: 'Bottom Bar',
    overlay: 'linear-gradient(0deg, rgba(0,0,0,0.80) 0%, rgba(0,0,0,0.45) 30%, transparent 55%)',
    headline: { x: 0.06, y: 0.75, anchorX: 0, anchorY: 0, sizeFrac: 0.060, weight: '900', maxWidthFrac: 0.70, align: 'left' },
    subtitle: { x: 0.06, y: 0.88, anchorX: 0, anchorY: 0, sizeFrac: 0.025, weight: '400', maxWidthFrac: 0.60, align: 'left' },
    url:      { x: 0.06, y: 0.95, anchorX: 0, anchorY: 1,  sizeFrac: 0.018, weight: '400', maxWidthFrac: 0.45, align: 'left' },
    logo:     { x: 0.94, y: 0.88, anchorX: 1, anchorY: 0.5, sizeFrac: 0.13 },
  },
  {
    id: 'editorial', name: 'Editorial',
    overlay: 'linear-gradient(135deg, transparent 35%, rgba(0,0,0,0.65) 100%)',
    headline: { x: 0.94, y: 0.72, anchorX: 1, anchorY: 1, sizeFrac: 0.058, weight: '900', maxWidthFrac: 0.55, align: 'right' },
    subtitle: { x: 0.94, y: 0.75, anchorX: 1, anchorY: 0, sizeFrac: 0.026, weight: '400', maxWidthFrac: 0.50, align: 'right' },
    url:      { x: 0.94, y: 0.93, anchorX: 1, anchorY: 1, sizeFrac: 0.020, weight: '400', maxWidthFrac: 0.40, align: 'right' },
    logo:     { x: 0.06, y: 0.07, anchorX: 0, anchorY: 0, sizeFrac: 0.13 },
  },
  {
    id: 'split', name: 'Split',
    overlay: 'linear-gradient(90deg, rgba(0,0,0,0.70) 0%, rgba(0,0,0,0.10) 45%, transparent 60%)',
    headline: { x: 0.05, y: 0.30, anchorX: 0, anchorY: 0, sizeFrac: 0.065, weight: '900', maxWidthFrac: 0.48, align: 'left' },
    subtitle: { x: 0.05, y: 0.55, anchorX: 0, anchorY: 0, sizeFrac: 0.025, weight: '400', maxWidthFrac: 0.42, align: 'left' },
    url:      { x: 0.05, y: 0.90, anchorX: 0, anchorY: 0, sizeFrac: 0.020, weight: '400', maxWidthFrac: 0.35, align: 'left' },
    logo:     { x: 0.05, y: 0.10, anchorX: 0, anchorY: 0, sizeFrac: 0.14 },
  },
];

const OVERLAY_PRESETS = [
  { label: 'Dark Top',    value: 'linear-gradient(180deg, rgba(0,0,0,0.6) 0%, transparent 55%)' },
  { label: 'Dark Bottom', value: 'linear-gradient(0deg, rgba(0,0,0,0.75) 0%, transparent 55%)' },
  { label: 'Dark Left',   value: 'linear-gradient(90deg, rgba(0,0,0,0.70) 0%, transparent 55%)' },
  { label: 'Diagonal',    value: 'linear-gradient(135deg, transparent 35%, rgba(0,0,0,0.65) 100%)' },
  { label: 'Vignette',    value: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.6) 100%)' },
  { label: 'None',        value: 'none' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      const img2 = new Image();
      img2.onload = () => resolve(img2);
      img2.onerror = reject;
      img2.src = src;
    };
    img.src = src;
  });
}

function parseGradientForCanvas(ctx: CanvasRenderingContext2D, css: string, w: number, h: number): CanvasGradient | null {
  if (!css || css === 'none') return null;
  const is0deg = css.includes('0deg');
  const is90deg = css.includes('90deg');
  const is135deg = css.includes('135deg');
  let grd: CanvasGradient;
  if (is90deg) grd = ctx.createLinearGradient(0, 0, w, 0);
  else if (is135deg) grd = ctx.createLinearGradient(0, 0, w, h);
  else if (is0deg) grd = ctx.createLinearGradient(0, h, 0, 0);
  else if (css.startsWith('radial')) grd = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, Math.max(w,h)*0.7);
  else grd = ctx.createLinearGradient(0, 0, 0, h);
  const stops = css.match(/rgba?\([^)]+\)\s+[\d.]+%/g) || [];
  stops.forEach((stop) => {
    const pct = stop.match(/([\d.]+)%$/);
    const col = stop.match(/rgba?\([^)]+\)/);
    if (pct && col) grd.addColorStop(parseFloat(pct[1]) / 100, col[0]);
  });
  return grd;
}

async function exportToCanvas(
  imageUrl: string, template: Template, brand: BrandForEditor,
  headline: string, subtitle: string, urlText: string, textColor: string,
): Promise<string> {
  const bg = await loadImage(imageUrl);
  const W = bg.naturalWidth || 1080;
  const H = bg.naturalHeight || 1080;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bg, 0, 0, W, H);
  const grd = parseGradientForCanvas(ctx, template.overlay, W, H);
  if (grd) { ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H); }

  const drawText = (layer: TextLayer, text: string) => {
    if (!text) return;
    const fontSize = Math.round(H * layer.sizeFrac);
    ctx.font = `${layer.weight} ${fontSize}px "${brand.font_heading || 'Arial Black'}", Arial, sans-serif`;
    ctx.fillStyle = textColor;
    ctx.textAlign = layer.align;
    const maxW = W * layer.maxWidthFrac;
    const words = text.split(' ');
    const lines: string[] = [];
    let cur = '';
    for (const word of words) {
      const test = cur ? `${cur} ${word}` : word;
      if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = word; }
      else cur = test;
    }
    if (cur) lines.push(cur);
    const lineH = fontSize * 1.2;
    const totalH = lines.length * lineH;
    let startY = H * layer.y;
    if (layer.anchorY === 1) startY -= totalH;
    else if (layer.anchorY === 0.5) startY -= totalH / 2;
    lines.forEach((line, i) => ctx.fillText(line, W * layer.x, startY + i * lineH + fontSize));
  };

  drawText(template.headline, headline);
  drawText(template.subtitle, subtitle);
  drawText(template.url, urlText);

  if (brand.logo_url) {
    try {
      const logo = await loadImage(brand.logo_url);
      const logoW = Math.round(W * template.logo.sizeFrac);
      const logoH = Math.round((logo.naturalHeight / logo.naturalWidth) * logoW);
      ctx.drawImage(logo, W * template.logo.x - logoW * template.logo.anchorX, H * template.logo.y - logoH * template.logo.anchorY, logoW, logoH);
    } catch { /* skip */ }
  }
  return canvas.toDataURL('image/png');
}

// ─── Template thumbnail ───────────────────────────────────────────────────────

function TemplateThumbnail({ template, active, onClick, onDelete }: {
  template: Template; active: boolean; onClick: () => void; onDelete?: () => void;
}) {
  const W = 72; const H = 72;
  const hl = template.headline; const logo = template.logo;
  const hlW = W * hl.maxWidthFrac; const hlH = Math.max(4, H * hl.sizeFrac);
  const subW = W * template.subtitle.maxWidthFrac * 0.7; const subH = Math.max(2, H * template.subtitle.sizeFrac);
  const logoSz = W * logo.sizeFrac;
  const toX = (l: { x: number; anchorX: number }, w: number) => Math.max(0, Math.min(W - w, l.x * W - l.anchorX * w));
  const toY = (l: { y: number; anchorY: number }, h: number) => Math.max(0, Math.min(H - h, l.y * H - l.anchorY * h));

  return (
    <div className="relative group">
      <button onClick={onClick}
        className={`relative rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 ${active ? 'border-[#1e1e20] shadow-md' : 'border-[#e2e2e2] hover:border-[#595959]'}`}
        style={{ width: W, height: H }}>
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg,#d4d4d4,#888)' }} />
        <div className="absolute inset-0" style={{ background: template.overlay === 'none' ? undefined : template.overlay }} />
        <div className="absolute bg-white/90 rounded-sm" style={{ left: toX(hl, hlW), top: toY(hl, hlH), width: hlW, height: hlH }} />
        <div className="absolute bg-white/60 rounded-sm" style={{ left: toX(template.subtitle, subW), top: toY(template.subtitle, subH), width: subW, height: subH }} />
        <div className="absolute bg-white/90 rounded" style={{ left: toX(logo, logoSz), top: toY(logo, logoSz), width: logoSz, height: logoSz }} />
        <div className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[7px] text-center py-0.5 font-medium truncate px-1">{template.name}</div>
      </button>
      {onDelete && (
        <button onClick={onDelete}
          className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-red-500 text-white hidden group-hover:flex items-center justify-center z-10"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  );
}

// ─── Live preview (shared by editor + builder) ────────────────────────────────

function LivePreview({ imageUrl, template, brand, headline, subtitle, urlText, textColor, builderMode, selectedEl, onDrop }: {
  imageUrl: string; template: Template; brand: BrandForEditor;
  headline: string; subtitle: string; urlText: string; textColor: string;
  builderMode?: boolean; selectedEl?: ElementKey | null;
  onDrop?: (el: ElementKey, x: number, y: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const dragging = useRef<{ el: ElementKey; startX: number; startY: number; startFracX: number; startFracY: number } | null>(null);

  useLayoutEffect(() => {
    const el = containerRef.current; if (!el) return;
    const obs = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    obs.observe(el); return () => obs.disconnect();
  }, []);

  const elStyle = (layer: TextLayer): React.CSSProperties => ({
    position: 'absolute',
    left: `${layer.x * 100}%`, top: `${layer.y * 100}%`,
    transform: `translate(${-layer.anchorX * 100}%, ${-layer.anchorY * 100}%)`,
    fontSize: size.h * layer.sizeFrac,
    fontWeight: layer.weight,
    maxWidth: size.w * layer.maxWidthFrac,
    textAlign: layer.align,
    color: textColor,
    textShadow: '0 1px 3px rgba(0,0,0,0.4)',
    fontFamily: brand.font_heading ? `"${brand.font_heading}", Arial Black, Arial, sans-serif` : 'Arial Black, Arial, sans-serif',
    lineHeight: 1.15, letterSpacing: layer.weight === '900' ? '-0.02em' : 'normal',
    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
    cursor: builderMode ? 'grab' : 'default',
    userSelect: 'none',
  });

  const logoStyle = (layer: LogoLayer): React.CSSProperties => ({
    position: 'absolute',
    left: `${layer.x * 100}%`, top: `${layer.y * 100}%`,
    transform: `translate(${-layer.anchorX * 100}%, ${-layer.anchorY * 100}%)`,
    width: `${layer.sizeFrac * 100}%`, objectFit: 'contain',
    cursor: builderMode ? 'grab' : 'default',
    filter: textColor === '#ffffff' ? 'brightness(0) invert(1)' : 'none',
  });

  const highlight = (el: ElementKey) =>
    builderMode ? `2px solid ${selectedEl === el ? '#7c3aed' : 'rgba(124,58,237,0.3)'}` : 'none';

  const startDrag = (el: ElementKey, e: React.PointerEvent) => {
    if (!builderMode || !onDrop) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const layer = el === 'logo' ? template.logo : template[el];
    dragging.current = { el, startX: e.clientX, startY: e.clientY, startFracX: layer.x, startFracY: layer.y };
  };

  const moveDrag = (e: React.PointerEvent) => {
    if (!dragging.current || !onDrop || !size.w) return;
    const { el, startX, startY, startFracX, startFracY } = dragging.current;
    const dx = (e.clientX - startX) / size.w;
    const dy = (e.clientY - startY) / size.h;
    onDrop(el, Math.max(0, Math.min(1, startFracX + dx)), Math.max(0, Math.min(1, startFracY + dy)));
  };

  const endDrag = () => { dragging.current = null; };

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden rounded-xl select-none"
      onPointerMove={moveDrag} onPointerUp={endDrag}>
      <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0" style={{ background: template.overlay === 'none' ? undefined : template.overlay }} />
      {headline && (
        <div style={{ ...elStyle(template.headline), outline: highlight('headline') }}
          onPointerDown={(e) => startDrag('headline', e)}>
          {headline}
        </div>
      )}
      {subtitle && (
        <div style={{ ...elStyle(template.subtitle), outline: highlight('subtitle') }}
          onPointerDown={(e) => startDrag('subtitle', e)}>
          {subtitle}
        </div>
      )}
      {urlText && (
        <div style={{ ...elStyle(template.url), outline: highlight('url') }}
          onPointerDown={(e) => startDrag('url', e)}>
          {urlText}
        </div>
      )}
      {brand.logo_url && (
        <img src={brand.logo_url} alt="Logo" style={{ ...logoStyle(template.logo), outline: highlight('logo') }}
          onPointerDown={(e) => startDrag('logo', e)} />
      )}
    </div>
  );
}

// ─── Template Builder ─────────────────────────────────────────────────────────

function TemplateBuilder({ imageUrl, brand, onSave, onCancel, headline, subtitle, urlText, textColor }: {
  imageUrl: string; brand: BrandForEditor;
  onSave: (t: Template) => void; onCancel: () => void;
  headline: string; subtitle: string; urlText: string; textColor: string;
}) {
  const [name, setName] = useState('My Template');
  const [selectedEl, setSelectedEl] = useState<ElementKey>('headline');
  const [tmpl, setTmpl] = useState<Template>({
    ...BUILTIN_TEMPLATES[0],
    id: `custom-${Date.now()}`,
    name: 'My Template',
    custom: true,
  });

  const update = (path: string, value: number | string) => {
    setTmpl((prev) => {
      const next = JSON.parse(JSON.stringify(prev)) as Template;
      const parts = path.split('.');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let obj: any = next;
      for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]];
      obj[parts[parts.length - 1]] = value;
      return next;
    });
  };

  const handleDrop = (el: ElementKey, x: number, y: number) => {
    if (el === 'logo') { update('logo.x', x); update('logo.y', y); }
    else { update(`${el}.x`, x); update(`${el}.y`, y); }
  };

  const elLayer = selectedEl === 'logo' ? null : tmpl[selectedEl] as TextLayer;

  return (
    <div className="flex flex-1 min-h-0">
      {/* Left controls */}
      <div className="w-[280px] flex-shrink-0 border-r border-[#e2e2e2] flex flex-col overflow-y-auto">
        <div className="p-4 border-b border-[#e2e2e2]">
          <label className="block text-[11px] text-[#595959] mb-1.5">Template Name</label>
          <input value={name} onChange={(e) => { setName(e.target.value); update('name', e.target.value); }}
            className="w-full text-[13px] border border-[#e2e2e2] rounded-lg px-3 py-2 focus:outline-none focus:border-[#1e1e20]"
            placeholder="Template name…" />
        </div>

        {/* Element tabs */}
        <div className="p-4 border-b border-[#e2e2e2]">
          <p className="text-[11px] font-semibold text-[#595959] uppercase tracking-wider mb-2">Select Element to Move</p>
          <div className="grid grid-cols-2 gap-1.5">
            {(['headline', 'subtitle', 'url', 'logo'] as ElementKey[]).map((el) => (
              <button key={el} onClick={() => setSelectedEl(el)}
                className={`text-[12px] font-medium rounded-lg px-3 py-2 border transition-all capitalize ${selectedEl === el ? 'bg-[#7c3aed] text-white border-[#7c3aed]' : 'border-[#e2e2e2] text-[#595959] hover:border-[#595959]'}`}>
                {el}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-[#959595] mt-2">Drag the highlighted element in the preview to reposition it</p>
        </div>

        {/* Element controls */}
        {elLayer && (
          <div className="p-4 border-b border-[#e2e2e2] flex flex-col gap-3">
            <p className="text-[11px] font-semibold text-[#595959] uppercase tracking-wider">Element Settings</p>
            <div>
              <label className="block text-[11px] text-[#595959] mb-1">Size ({Math.round(elLayer.sizeFrac * 100)}% height)</label>
              <input type="range" min={1} max={15} step={0.5}
                value={Math.round(elLayer.sizeFrac * 100)}
                onChange={(e) => update(`${selectedEl}.sizeFrac`, parseFloat(e.target.value) / 100)}
                className="w-full accent-[#7c3aed]" />
            </div>
            <div>
              <label className="block text-[11px] text-[#595959] mb-1">Max Width ({Math.round(elLayer.maxWidthFrac * 100)}%)</label>
              <input type="range" min={20} max={95} step={5}
                value={Math.round(elLayer.maxWidthFrac * 100)}
                onChange={(e) => update(`${selectedEl}.maxWidthFrac`, parseFloat(e.target.value) / 100)}
                className="w-full accent-[#7c3aed]" />
            </div>
            <div>
              <label className="block text-[11px] text-[#595959] mb-1.5">Weight</label>
              <div className="flex gap-1.5">
                {[['400', 'Regular'], ['700', 'Bold'], ['900', 'Black']].map(([w, l]) => (
                  <button key={w} onClick={() => update(`${selectedEl}.weight`, w)}
                    className={`flex-1 text-[12px] rounded-lg border py-1.5 transition-all ${elLayer.weight === w ? 'bg-[#1e1e20] text-white border-[#1e1e20]' : 'border-[#e2e2e2] text-[#595959] hover:border-[#595959]'}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[11px] text-[#595959] mb-1.5">Alignment</label>
              <div className="flex gap-1.5">
                {[['left', 'Left'], ['center', 'Center'], ['right', 'Right']].map(([a, l]) => (
                  <button key={a} onClick={() => update(`${selectedEl}.align`, a)}
                    className={`flex-1 text-[12px] rounded-lg border py-1.5 transition-all ${elLayer.align === a ? 'bg-[#1e1e20] text-white border-[#1e1e20]' : 'border-[#e2e2e2] text-[#595959] hover:border-[#595959]'}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {selectedEl === 'logo' && (
          <div className="p-4 border-b border-[#e2e2e2]">
            <p className="text-[11px] font-semibold text-[#595959] uppercase tracking-wider mb-2">Logo Size</p>
            <label className="block text-[11px] text-[#595959] mb-1">Width ({Math.round(tmpl.logo.sizeFrac * 100)}% image)</label>
            <input type="range" min={5} max={30} step={1}
              value={Math.round(tmpl.logo.sizeFrac * 100)}
              onChange={(e) => update('logo.sizeFrac', parseFloat(e.target.value) / 100)}
              className="w-full accent-[#7c3aed]" />
          </div>
        )}

        {/* Overlay */}
        <div className="p-4">
          <p className="text-[11px] font-semibold text-[#595959] uppercase tracking-wider mb-2">Overlay</p>
          <div className="grid grid-cols-2 gap-1.5">
            {OVERLAY_PRESETS.map((p) => (
              <button key={p.label} onClick={() => update('overlay', p.value)}
                className={`text-[11px] rounded-lg border px-2 py-2 transition-all text-left ${tmpl.overlay === p.value ? 'border-[#7c3aed] bg-[#f5f3ff] text-[#7c3aed] font-medium' : 'border-[#e2e2e2] text-[#595959] hover:border-[#595959]'}`}>
                <div className="h-6 rounded mb-1" style={{ background: p.value === 'none' ? '#f5f5f5' : p.value }} />
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="flex-1 bg-[#f0f0f0] flex flex-col items-center justify-center p-6 gap-4 min-h-0">
        <div className="h-full" style={{ aspectRatio: '1 / 1', maxWidth: '100%', maxHeight: 'calc(100% - 56px)' }}>
          <LivePreview imageUrl={imageUrl} template={tmpl} brand={brand}
            headline={headline} subtitle={subtitle} urlText={urlText} textColor={textColor}
            builderMode selectedEl={selectedEl} onDrop={handleDrop} />
        </div>
        <button onClick={() => onSave({ ...tmpl, id: `custom-${Date.now()}`, name, custom: true })}
          className="flex items-center gap-2 bg-[#7c3aed] text-white text-[13px] font-medium rounded-xl px-6 py-2.5 hover:bg-[#6d28d9] transition-colors flex-shrink-0">
          <Check className="h-4 w-4" />
          Save Template
        </button>
      </div>
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export default function ImageEditorModal({ imageUrl, brand, onClose }: {
  imageUrl: string; brand: BrandForEditor; onClose: () => void;
}) {
  const [customTemplates, setCustomTemplates] = useState<Template[]>(() => {
    try {
      const dna = JSON.parse(brand.brand_dna || '{}');
      return Array.isArray(dna.custom_templates) ? dna.custom_templates : [];
    } catch { return []; }
  });

  const allTemplates = [...BUILTIN_TEMPLATES, ...customTemplates];
  const [template, setTemplate] = useState<Template>(allTemplates[0]);
  const [headline, setHeadline] = useState(brand.tagline || brand.brand_name || '');
  const [subtitle, setSubtitle] = useState('');
  const [urlText, setUrlText]   = useState('');
  const [textColor, setTextColor] = useState('#ffffff');
  const [exporting, setExporting] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const saveCustomTemplates = useCallback(async (templates: Template[]) => {
    if (!brand.id) return;
    setSaving(true);
    try {
      let dna: Record<string, unknown> = {};
      try { dna = JSON.parse(brand.brand_dna || '{}'); } catch { /* */ }
      dna.custom_templates = templates;
      await axios.put(`/api/v1/entities/brand_profiles/${brand.id}`, { brand_dna: JSON.stringify(dna) });
    } finally { setSaving(false); }
  }, [brand.id, brand.brand_dna]);

  const handleSaveTemplate = useCallback(async (t: Template) => {
    const updated = [...customTemplates, t];
    setCustomTemplates(updated);
    setTemplate(t);
    setBuilderOpen(false);
    await saveCustomTemplates(updated);
  }, [customTemplates, saveCustomTemplates]);

  const handleDeleteTemplate = useCallback(async (id: string) => {
    const updated = customTemplates.filter((t) => t.id !== id);
    setCustomTemplates(updated);
    if (template.id === id) setTemplate(allTemplates[0]);
    await saveCustomTemplates(updated);
  }, [customTemplates, template.id, allTemplates, saveCustomTemplates]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const dataUrl = await exportToCanvas(imageUrl, template, brand, headline, subtitle, urlText, textColor);
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${brand.brand_name || 'image'}-edited.png`;
      a.click();
    } finally { setExporting(false); }
  }, [imageUrl, template, brand, headline, subtitle, urlText, textColor]);

  const brandColor = brand.primary_color || '#502C12';

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ width: '92vw', maxWidth: 1100, height: '90vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#e2e2e2] flex-shrink-0">
          <div className="flex items-center gap-3">
            {builderOpen && (
              <button onClick={() => setBuilderOpen(false)} className="flex items-center gap-1 text-[13px] text-[#595959] hover:text-[#1e1e20] transition-colors">
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>
            )}
            <div>
              <p className="text-[15px] font-semibold text-[#1e1e20]">
                {builderOpen ? 'Template Builder' : 'Edit Image'}
              </p>
              <p className="text-[12px] text-[#595959]">
                {builderOpen ? 'Drag elements to position, adjust settings, save' : `${brand.brand_name} · pick template · edit text · export`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {saving && <span className="text-[12px] text-[#959595] flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Saving…</span>}
            {!builderOpen && (
              <button onClick={handleExport} disabled={exporting}
                className="flex items-center gap-2 bg-[#1e1e20] text-white text-[13px] font-medium rounded-xl px-4 py-2 hover:bg-[#3a3a3a] transition-colors disabled:opacity-50">
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Export PNG
              </button>
            )}
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#f5f5f5] transition-colors">
              <X className="h-5 w-5 text-[#595959]" />
            </button>
          </div>
        </div>

        {/* Builder mode */}
        {builderOpen ? (
          <TemplateBuilder imageUrl={imageUrl} brand={brand}
            headline={headline} subtitle={subtitle} urlText={urlText} textColor={textColor}
            onSave={handleSaveTemplate} onCancel={() => setBuilderOpen(false)} />
        ) : (
          <div className="flex flex-1 min-h-0">

            {/* Left panel */}
            <div className="w-[280px] flex-shrink-0 border-r border-[#e2e2e2] flex flex-col overflow-y-auto">

              {/* Templates */}
              <div className="p-4 border-b border-[#e2e2e2]">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] font-semibold text-[#595959] uppercase tracking-wider">Layout Template</p>
                  <button onClick={() => setBuilderOpen(true)}
                    className="flex items-center gap-1 text-[11px] font-medium text-[#7c3aed] hover:text-[#6d28d9] transition-colors">
                    <Plus className="h-3.5 w-3.5" />
                    New
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {allTemplates.map((t) => (
                    <TemplateThumbnail key={t.id} template={t} active={template.id === t.id}
                      onClick={() => setTemplate(t)}
                      onDelete={t.custom ? () => handleDeleteTemplate(t.id) : undefined} />
                  ))}
                </div>
              </div>

              {/* Text */}
              <div className="p-4 flex flex-col gap-3 border-b border-[#e2e2e2]">
                <p className="text-[11px] font-semibold text-[#595959] uppercase tracking-wider">Text</p>
                <div>
                  <label className="block text-[11px] text-[#595959] mb-1">Headline</label>
                  <textarea value={headline} onChange={(e) => setHeadline(e.target.value)} rows={2}
                    className="w-full text-[13px] border border-[#e2e2e2] rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-[#1e1e20] leading-snug"
                    placeholder="Main headline…" />
                </div>
                <div>
                  <label className="block text-[11px] text-[#595959] mb-1">Subtitle</label>
                  <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)}
                    className="w-full text-[13px] border border-[#e2e2e2] rounded-lg px-3 py-2 focus:outline-none focus:border-[#1e1e20]"
                    placeholder="Supporting line…" />
                </div>
                <div>
                  <label className="block text-[11px] text-[#595959] mb-1">URL / Tag</label>
                  <input value={urlText} onChange={(e) => setUrlText(e.target.value)}
                    className="w-full text-[13px] border border-[#e2e2e2] rounded-lg px-3 py-2 focus:outline-none focus:border-[#1e1e20]"
                    placeholder="shelbycycles.com" />
                </div>
              </div>

              {/* Colour */}
              <div className="p-4">
                <p className="text-[11px] font-semibold text-[#595959] uppercase tracking-wider mb-3">Text Colour</p>
                <div className="flex gap-2">
                  {[{ label: 'White', value: '#ffffff' }, { label: 'Black', value: '#1e1e20' }, { label: 'Brand', value: brandColor }].map(({ label, value }) => (
                    <button key={value} onClick={() => setTextColor(value)}
                      className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg border py-2 text-[12px] font-medium transition-all ${textColor === value ? 'border-[#1e1e20] bg-[#f5f5f5]' : 'border-[#e2e2e2] hover:border-[#595959]'}`}>
                      <span className="h-3.5 w-3.5 rounded-full border border-[#ccc] flex-shrink-0" style={{ background: value }} />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="flex-1 bg-[#f0f0f0] flex items-center justify-center p-6 min-h-0">
              <div className="h-full" style={{ aspectRatio: '1 / 1', maxWidth: '100%', maxHeight: '100%' }}>
                <LivePreview imageUrl={imageUrl} template={template} brand={brand}
                  headline={headline} subtitle={subtitle} urlText={urlText} textColor={textColor} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
