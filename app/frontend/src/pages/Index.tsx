import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createClient } from '@metagptx/web-sdk';
import SidebarLayout from '@/components/Sidebar';
import { BRIEF_TYPES, STATUS_OPTIONS } from '@/lib/briefTypes';
import {
  Sparkles, Zap, Shield, TrendingUp, FileText, Image as ImageIcon,
  Video, Palette, ArrowRight, Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const client = createClient();

export default function Index() {
  const [briefCount, setBriefCount] = useState<number | null>(null);
  const [brandCount, setBrandCount] = useState<number | null>(null);
  const [recentBriefs, setRecentBriefs] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [briefsRes, brandsRes] = await Promise.all([
          client.entities.briefs.query({ query: {}, sort: '-created_at', limit: 100 }),
          client.entities.brand_profiles.query({ query: {}, limit: 50 }),
        ]);
        const briefs = briefsRes?.data?.items || [];
        setBriefCount(briefs.length);
        setRecentBriefs(briefs.slice(0, 5));
        setBrandCount((brandsRes?.data?.items || []).length);
      } catch {
        setBriefCount(0);
        setBrandCount(0);
      }
    };
    fetchData();
  }, []);

  const stats = [
    { label: 'Total Briefs', value: briefCount ?? '—', icon: FileText, color: '#7c3aed' },
    { label: 'AI Tools', value: '10', icon: Sparkles, color: '#06b6d4' },
    { label: 'Brief Types', value: BRIEF_TYPES.length, icon: Palette, color: '#ec4899' },
    { label: 'Brands', value: brandCount ?? '—', icon: TrendingUp, color: '#10b981' },
  ];

  const quickActions = [
    { label: 'New Brief', desc: 'Create a client request', path: '/briefs/new', icon: Plus, color: '#7c3aed' },
    { label: 'Prompt Hub', desc: 'AI-powered asset creation', path: '/workspace', icon: Sparkles, color: '#06b6d4' },
    { label: 'Asset Gallery', desc: 'Browse generated assets', path: '/gallery', icon: ImageIcon, color: '#ec4899' },
    { label: 'Templates', desc: 'Start from a template', path: '/templates', icon: FileText, color: '#f59e0b' },
  ];

  return (
    <SidebarLayout>
      <div className="p-6 lg:p-8">
        {/* Welcome Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="mt-1 text-slate-400">Welcome to SHL Creative Hub — your AI-powered design command center.</p>
        </div>

        {/* Stats Grid */}
        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-[#e2e2e2] bg-white p-5 transition-all hover:border-[#e2e2e2]"
            >
              <div className="mb-3 flex items-center gap-2">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${stat.color}15` }}
                >
                  <stat.icon className="h-4 w-4" style={{ color: stat.color }} />
                </div>
              </div>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-xs text-slate-400">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="mb-4 text-lg font-semibold text-white">Quick Actions</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {quickActions.map((action) => (
              <Link
                key={action.path}
                to={action.path}
                className="group flex items-center gap-4 rounded-xl border border-[#e2e2e2] bg-white p-4 transition-all hover:border-[#e2e2e2] hover:-translate-y-0.5"
              >
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${action.color}15` }}
                >
                  <action.icon className="h-5 w-5" style={{ color: action.color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-white">{action.label}</p>
                  <p className="text-xs text-slate-400">{action.desc}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-600 transition-transform group-hover:translate-x-1 group-hover:text-slate-400" />
              </Link>
            ))}
          </div>
        </div>

        {/* Create with AI + Brief Types */}
        <div className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Brief Types</h2>
            <Link to="/briefs/new" className="text-sm text-violet-400 hover:text-violet-300">
              View all →
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {BRIEF_TYPES.map((type) => (
              <Link
                key={type.id}
                to={`/briefs/new?type=${type.id}`}
                className="group overflow-hidden rounded-xl border border-[#e2e2e2] bg-white transition-all hover:border-[#e2e2e2] hover:-translate-y-0.5"
              >
                <div className="relative h-32 overflow-hidden">
                  <img
                    src={type.image}
                    alt={type.label}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#13131a] via-[#13131a]/50 to-transparent" />
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-white">{type.label}</h3>
                  <p className="mt-1 text-xs text-slate-400">{type.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Briefs */}
        {recentBriefs.length > 0 && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Recent Briefs</h2>
              <Link to="/briefs" className="text-sm text-violet-400 hover:text-violet-300">
                View all →
              </Link>
            </div>
            <div className="space-y-2">
              {recentBriefs.map((brief: any) => {
                const statusInfo = STATUS_OPTIONS.find((s) => s.value === brief.status);
                return (
                  <Link
                    key={brief.id}
                    to={`/briefs/${brief.id}`}
                    className="flex items-center justify-between rounded-xl border border-[#e2e2e2] bg-white p-4 transition-all hover:border-[#e2e2e2]"
                  >
                    <div>
                      <p className="font-medium text-white">{brief.title}</p>
                      <p className="text-xs text-slate-400">
                        {brief.brief_type} · {brief.brand_name}
                      </p>
                    </div>
                    <span
                      className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                      style={{
                        backgroundColor: `${statusInfo?.color || '#94a3b8'}15`,
                        color: statusInfo?.color || '#94a3b8',
                      }}
                    >
                      {statusInfo?.label || brief.status}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Features */}
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            { icon: Zap, title: 'AI-Powered Generation', desc: 'Generate assets using cutting-edge AI models directly from your brief specifications.', color: '#f59e0b' },
            { icon: Shield, title: 'Brand Consistency', desc: 'Auto-populate brand guidelines to ensure every asset aligns with your brand identity.', color: '#10b981' },
            { icon: Sparkles, title: 'Smart Workflows', desc: 'Track requests, manage revisions, and streamline your creative production pipeline.', color: '#7c3aed' },
          ].map((feature, i) => (
            <div
              key={i}
              className="rounded-xl border border-[#e2e2e2] bg-white p-5 transition-all hover:border-[#e2e2e2]"
            >
              <div
                className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${feature.color}15` }}
              >
                <feature.icon className="h-5 w-5" style={{ color: feature.color }} />
              </div>
              <h3 className="mb-1 font-semibold text-white">{feature.title}</h3>
              <p className="text-xs leading-relaxed text-slate-400">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </SidebarLayout>
  );
}