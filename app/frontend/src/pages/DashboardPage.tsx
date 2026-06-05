import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@metagptx/web-sdk';
import SidebarLayout from '@/components/Sidebar';
import { Plus, Search, ChevronDown, LayoutGrid, List, ArrowUpRight } from 'lucide-react';
import { type BrandProfile } from '@/lib/briefTypes';

const mgxClient = createClient();

type ExtendedProfile = BrandProfile & { created_at?: string };

function formatDate(dateStr?: string) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return `Added ${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
  } catch {
    return '';
  }
}

const ACTIVITY_ITEMS = [
  { text: 'Generated 12 social media banners', brand: 'Shelby', time: '2 min ago', color: '#06b6d4' },
  { text: 'Created brand video intro', brand: 'Shelby', time: '15 min ago', color: '#06b6d4' },
  { text: 'Designed product showcase images', brand: 'Shelby', time: '1 hour ago', color: '#06b6d4' },
];

const QUICK_ACTIONS = [
  { label: 'New Brief', path: '/briefs/new' },
  { label: 'New Prompt', path: '/prompts' },
  { label: 'Asset Gallery', path: '/gallery' },
  { label: 'New Brand', path: '/brands/new' },
];

export default function DashboardPage() {
  const navigate = useNavigate();
  const [brands, setBrands] = useState<ExtendedProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    const fetchBrands = async () => {
      setLoading(true);
      try {
        const res = await mgxClient.entities.brand_profiles.query({ query: {}, limit: 50 });
        setBrands((res?.data?.items as ExtendedProfile[]) || []);
      } catch {
        setBrands([]);
      } finally {
        setLoading(false);
      }
    };
    fetchBrands();
  }, []);

  const displayedBrands = brands.slice(0, 4);

  return (
    <SidebarLayout>
      <div className="flex min-h-screen flex-col">
      {/* ── Dark header ─────────────────────────────────────────── */}
      <div className="bg-[#1e1e20] px-4 sm:px-6 lg:px-10 pb-6 lg:pb-8 pt-6 lg:pt-10">

        {/* Title */}
        <div className="mb-6">
          <h1 className="text-[32px] sm:text-[40px] lg:text-[48px] font-bold leading-tight text-white">Dashboard</h1>
          <p className="mt-1 text-[16px] text-white">Welcome back! Here's your creative overview.</p>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-6 top-1/2 h-5 w-5 -translate-y-1/2 text-white" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Projects..."
            className="h-[67px] w-full rounded-full border border-[rgba(255,255,255,0.16)] bg-[rgba(255,255,255,0.11)] pl-16 pr-6 text-[14px] font-light text-white placeholder:text-white/50 outline-none"
          />
        </div>

        {/* Stats + Quick Actions */}
        <div className="flex flex-col sm:flex-row gap-5">

          {/* Stats 2×2 */}
          <div className="shrink-0 rounded-[30px] bg-[rgba(245,243,239,0.2)] p-5">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Assets Generated', value: '2,847' },
                { label: 'AI Tools Connected', value: '6' },
                { label: 'Active Brands', value: loading ? '–' : String(brands.length) },
                { label: 'This Week', value: '342' },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="flex h-[53px] items-center justify-between gap-8 rounded-full border border-[rgba(255,255,255,0.16)] bg-[rgba(255,255,255,0.11)] px-5"
                >
                  <span className="text-[14px] text-white whitespace-nowrap">{stat.label}</span>
                  <span className="text-[24px] font-bold text-white">{stat.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex-1 rounded-[30px] bg-[rgba(245,243,239,0.2)] p-5">
            <p className="mb-4 text-[20px] font-bold text-white">Quick Actions</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  onClick={() => navigate(action.path)}
                  className="flex flex-1 h-[52px] items-center justify-between gap-2 rounded-[12px] border border-[rgba(255,255,255,0.16)] bg-[rgba(255,255,255,0.11)] px-3 text-[16px] font-medium text-white transition-all hover:bg-[rgba(255,255,255,0.18)]"
                >
                  {action.label}
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-white/60" />
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ── Light content area ──────────────────────────────────── */}
      <div className="flex-1 bg-[#f5f3ef] px-4 sm:px-6 lg:px-10 py-6 lg:py-8">
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-8">

          {/* Client Brands */}
          <div className="flex-1 min-w-0">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-[32px] font-bold text-[#1e1e20]">Client Brands</h2>
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-[14px] text-[#1e1e20] shadow-sm hover:shadow-md transition-shadow">
                  Last Viewed
                  <ChevronDown className="h-4 w-4" />
                </button>
                <div className="flex rounded-lg border border-[#e2e2e2] bg-white p-0.5 shadow-sm">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`rounded-md p-1.5 transition-colors ${viewMode === 'grid' ? 'bg-[#f5f3ef] text-[#1e1e20]' : 'text-[#908f8e] hover:text-[#1e1e20]'}`}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`rounded-md p-1.5 transition-colors ${viewMode === 'list' ? 'bg-[#f5f3ef] text-[#1e1e20]' : 'text-[#908f8e] hover:text-[#1e1e20]'}`}
                  >
                    <List className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-[260px] animate-pulse rounded-[13px] bg-white/60" />
                ))}
              </div>
            ) : displayedBrands.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-[13px] bg-[#ede9e3] py-20 text-center">
                <p className="text-[18px] font-bold text-[#1e1e20]">No brands yet</p>
                <p className="mt-1 text-[13px] text-[#908f8e]">Create your first brand to get started.</p>
                <button
                  onClick={() => navigate('/brands')}
                  className="mt-4 flex items-center gap-2 rounded-full bg-[#1e1e20] px-5 py-2.5 text-[14px] text-white hover:bg-[#383839] transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  New Brand
                </button>
              </div>
            ) : (
              <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 gap-4' : 'flex flex-col gap-3'}>
                {displayedBrands.map((brand) => {
                  const initials = brand.brand_name
                    .split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
                  return (
                    <div
                      key={brand.id}
                      onClick={() => navigate(`/brands/${brand.id}`)}
                      className="cursor-pointer overflow-hidden rounded-[13px] bg-[#ede9e3] shadow-sm transition-all hover:shadow-md hover:scale-[1.01]"
                    >
                      <div
                        className="h-[200px] flex items-center justify-center"
                        style={{
                          background: `linear-gradient(135deg, ${brand.primary_color || '#7c3aed'} 0%, ${brand.secondary_color || '#06b6d4'} 60%, ${brand.accent_color || '#f59e0b'} 100%)`,
                        }}
                      >
                        {brand.logo_url ? (
                          <img
                            src={brand.logo_url}
                            alt={brand.brand_name}
                            className="max-h-[120px] max-w-[180px] object-contain drop-shadow-lg"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <span className="text-[48px] font-bold text-white/80 select-none">{initials}</span>
                        )}
                      </div>
                      <div className="px-4 pb-4 pt-3">
                        <p className="text-[20px] font-bold text-[#1e1e20] leading-tight">{brand.brand_name}</p>
                        <p className="mt-0.5 text-[13px] text-[#908f8e]">{formatDate(brand.created_at)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div className="w-full lg:w-[391px] shrink-0 rounded-[30px] bg-[#ede9e3] p-4 sm:p-6 lg:p-8">
            <h3 className="mb-6 text-[18px] font-bold text-[#1e1e20]">Recent Activity</h3>
            <div className="relative pl-5">
              <div className="absolute left-0 top-2 bottom-2 w-[2px] bg-[#e2e2e2] rounded-full" />
              <div className="space-y-5">
                {ACTIVITY_ITEMS.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div
                      className="absolute -left-[3px] mt-1.5 h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <p className="text-[14px] leading-snug text-[#383839]">
                      {item.text} ·{' '}
                      <span className="font-semibold text-[#1e1e20]">{item.brand}</span>
                      {' '}·{' '}
                      <span className="text-[#908f8e]">{item.time}</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
      </div>
    </SidebarLayout>
  );
}
