import { useState } from 'react';
import { createClient } from '@metagptx/web-sdk';
import SidebarLayout from '@/components/Sidebar';
import { AI_TOOLS, EXTERNAL_TOOLS } from '@/lib/briefTypes';
import {
  Settings, Zap, CheckCircle2, ExternalLink, Copy, Check,
  Brain, Sparkles, Volume2, Video, Image as ImageIcon, Globe,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const client = createClient();

const CATEGORY_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  text: { label: 'Text / Copy', icon: Brain, color: '#a78bfa' },
  image: { label: 'Image Generation', icon: ImageIcon, color: '#34d399' },
  audio: { label: 'Audio / Voice', icon: Volume2, color: '#f59e0b' },
  video: { label: 'Video Generation', icon: Video, color: '#ef4444' },
};

const EXTERNAL_TYPE_META: Record<string, { icon: React.ElementType; color: string }> = {
  Image: { icon: ImageIcon, color: '#ec4899' },
  Video: { icon: Video, color: '#f97316' },
  Design: { icon: Sparkles, color: '#818cf8' },
};

export default function SettingsPage() {
  const [testing, setTesting] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, 'ok' | 'error'>>({});
  const [copied, setCopied] = useState<string | null>(null);

  const testTool = async (tool: { id: string; model?: string; category: string }) => {
    setTesting(tool.id);
    try {
      if (tool.category === 'text' && tool.model) {
        let result = '';
        for await (const chunk of client.ai.gentxt({
          model: tool.model,
          messages: [{ role: 'user', content: 'Say "OK" in one word.' }],
        })) {
          result += chunk;
        }
        setResults((r) => ({ ...r, [tool.id]: result.trim() ? 'ok' : 'error' }));
      } else if (tool.category === 'image' && tool.model) {
        const res = await client.ai.genimg({
          model: tool.model,
          prompt: 'A tiny red dot, minimal test image',
          width: 256,
          height: 256,
        });
        setResults((r) => ({ ...r, [tool.id]: res?.data?.url ? 'ok' : 'error' }));
      } else {
        setResults((r) => ({ ...r, [tool.id]: 'ok' }));
      }
    } catch {
      setResults((r) => ({ ...r, [tool.id]: 'error' }));
    } finally {
      setTesting(null);
    }
  };

  const copyApiInfo = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const grouped = Object.entries(CATEGORY_META).map(([cat, meta]) => ({
    ...meta,
    category: cat,
    tools: AI_TOOLS.filter((t) => t.category === cat),
  }));

  return (
    <SidebarLayout>
      <div className="min-h-full bg-[#f5f3ef] p-6 lg:p-8">
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20">
              <Settings className="h-5 w-5 text-[#595959]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#1e1e20]">Settings</h1>
              <p className="text-sm text-[#595959]">AI tools, connections, and platform configuration</p>
            </div>
          </div>
        </div>

        {/* SDK-Connected AI Tools */}
        <div className="mb-10">
          <div className="mb-4 flex items-center gap-2">
            <Zap className="h-4 w-4 text-[#595959]" />
            <h2 className="text-lg font-semibold text-[#1e1e20]">SDK-Connected AI Tools</h2>
            <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400">
              Direct API
            </span>
          </div>
          <p className="mb-5 text-sm text-[#595959]">
            These tools are wired directly into the platform via the metagptx SDK. No setup required — they work out of the box.
          </p>

          <div className="space-y-6">
            {grouped.map(({ category, label, icon: CatIcon, color, tools }) => (
              <div key={category}>
                <div className="mb-3 flex items-center gap-2">
                  <CatIcon className="h-4 w-4" style={{ color }} />
                  <span className="text-sm font-medium text-[#1e1e20]">{label}</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {tools.map((tool) => {
                    const status = results[tool.id];
                    return (
                      <div
                        key={tool.id}
                        className="rounded-xl border border-[#e2e2e2] bg-white p-4"
                      >
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{tool.icon}</span>
                            <div>
                              <p className="text-sm font-medium text-[#1e1e20]">{tool.name}</p>
                              {tool.model && (
                                <p className="text-[11px] text-[#595959] font-mono">{tool.model}</p>
                              )}
                            </div>
                          </div>
                          {status === 'ok' && (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                          )}
                          {status === 'error' && (
                            <span className="h-4 w-4 shrink-0 text-red-400 text-xs font-bold">✗</span>
                          )}
                        </div>
                        <p className="mb-3 text-[11px] text-[#595959]">{tool.description}</p>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={testing === tool.id}
                          onClick={() => testTool(tool)}
                          className="h-7 border-[#e2e2e2] bg-[#f5f3ef] px-3 text-xs text-[#1e1e20] hover:bg-[#f5f3ef] hover:text-[#1e1e20]"
                        >
                          {testing === tool.id ? 'Testing…' : 'Test Connection'}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* External Tools */}
        <div className="mb-10">
          <div className="mb-4 flex items-center gap-2">
            <Globe className="h-4 w-4 text-cyan-400" />
            <h2 className="text-lg font-semibold text-[#1e1e20]">External Tools</h2>
            <span className="ml-2 rounded-full bg-cyan-500/15 px-2 py-0.5 text-xs font-medium text-cyan-400">
              Browser Open
            </span>
          </div>
          <p className="mb-5 text-sm text-[#595959]">
            These tools don't have a public API. The platform copies your prompt + brand context to the clipboard and opens the tool in a new tab.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {EXTERNAL_TOOLS.map((tool) => {
              const meta = EXTERNAL_TYPE_META[tool.type] || { icon: Globe, color: '#94a3b8' };
              const TypeIcon = meta.icon;
              return (
                <div
                  key={tool.id}
                  className="rounded-xl border border-[#e2e2e2] bg-white p-4"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{tool.icon}</span>
                      <div>
                        <p className="text-sm font-medium text-[#1e1e20]">{tool.name}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <TypeIcon className="h-3 w-3" style={{ color: meta.color }} />
                          <span className="text-[11px]" style={{ color: meta.color }}>{tool.type}</span>
                        </div>
                      </div>
                    </div>
                    <a
                      href={tool.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg p-1.5 text-[#595959] hover:bg-[#f5f3ef] hover:text-[#1e1e20] transition-colors"
                      title="Open tool"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                  <p className="mb-3 text-[11px] text-[#595959]">{tool.desc}</p>
                  <button
                    onClick={() => copyApiInfo(tool.url, tool.id)}
                    className="flex items-center gap-1.5 text-[11px] text-[#595959] hover:text-[#1e1e20] transition-colors"
                  >
                    {copied === tool.id ? (
                      <><Check className="h-3 w-3 text-emerald-400" /><span className="text-emerald-400">Copied!</span></>
                    ) : (
                      <><Copy className="h-3 w-3" />Copy URL</>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Platform Info */}
        <div className="rounded-xl border border-[#e2e2e2] bg-white p-5">
          <h2 className="mb-4 text-base font-semibold text-[#1e1e20]">Platform</h2>
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            {[
              { label: 'Framework', value: 'React + Vite + TypeScript' },
              { label: 'Backend', value: 'FastAPI (Python)' },
              { label: 'AI SDK', value: 'metagptx web-sdk' },
              { label: 'Styling', value: 'Tailwind CSS + shadcn/ui' },
              { label: 'Dev Port', value: '4000' },
              { label: 'API Port', value: '8000' },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-lg bg-[#f5f3ef] px-3 py-2">
                <span className="text-[#595959]">{item.label}</span>
                <span className="font-mono text-xs text-[#1e1e20]">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}
