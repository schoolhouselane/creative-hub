import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import SidebarLayout from '@/components/Sidebar';
import { Search, ChevronDown, LayoutGrid, List, Download, Trash2, Image as ImageIcon, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

interface Asset {
  id: number;
  user_id: string;
  brand_id: number | null;
  brand_name: string | null;
  title: string | null;
  asset_type: string;
  content_type: string | null;
  ai_tool: string | null;
  url: string | null;
  prompt: string | null;
  chat_history: string | null;
  created_at: string;
  updated_at: string;
}

interface Brand {
  id: number;
  name: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function AssetPreview({ asset }: { asset: Asset }) {
  if (asset.asset_type === 'text') {
    return (
      <div className="w-full h-[179px] rounded-t-[14px] bg-[#f5f3ef] flex items-start p-4 overflow-hidden">
        <p className="font-mono text-sm text-[#595959] line-clamp-6 break-all">
          {asset.prompt ? asset.prompt.slice(0, 200) : 'No preview available'}
        </p>
      </div>
    );
  }

  if (asset.url && (asset.url.startsWith('data:') || asset.url.startsWith('http'))) {
    return (
      <div className="w-full h-[179px] rounded-t-[14px] overflow-hidden">
        <img src={asset.url} alt={asset.title || 'Asset'} className="w-full h-full object-cover" />
      </div>
    );
  }

  const gradients: Record<string, string> = {
    image: 'from-violet-400 to-indigo-500',
    video: 'from-rose-400 to-pink-500',
    audio: 'from-amber-400 to-orange-500',
    text: 'from-emerald-400 to-teal-500',
  };
  const gradient = gradients[asset.asset_type] || 'from-slate-300 to-slate-400';

  return (
    <div className={`w-full h-[179px] rounded-t-[14px] bg-gradient-to-br ${gradient} flex items-center justify-center`}>
      <ImageIcon size={40} className="text-white opacity-60" />
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl overflow-hidden animate-pulse">
      <div className="w-full h-[179px] bg-gray-200" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="flex gap-2">
          <div className="h-5 bg-gray-200 rounded-full w-16" />
          <div className="h-5 bg-gray-200 rounded-full w-20" />
        </div>
        <div className="h-3 bg-gray-200 rounded w-24" />
        <div className="flex justify-end gap-2">
          <div className="h-8 bg-gray-200 rounded-lg w-24" />
          <div className="h-8 bg-gray-200 rounded-lg w-9" />
        </div>
      </div>
    </div>
  );
}

export default function AssetGalleryPage() {
  const navigate = useNavigate();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [brandOpen, setBrandOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);

  function handleContinue(asset: Asset) {
    if (!asset.chat_history) return;
    let messages: unknown;
    try { messages = JSON.parse(asset.chat_history); } catch { return; }
    const chatState = {
      brand: {
        id: asset.brand_id,
        brand_name: asset.brand_name ?? 'Brand',
      },
      type: asset.content_type ?? 'social',
      typeLabel: asset.content_type ?? 'Social Media',
      ai: asset.ai_tool ?? 'Gemini Pro',
      modelId: 'gemini-3.5-flash',
    };
    navigate('/chat', { state: { chatState, messages } });
  }

  useEffect(() => {
    async function fetchData() {
      try {
        const [assetRes, brandRes] = await Promise.all([
          axios.get('/api/v1/entities/assets', { params: { limit: 100 } }),
          axios.get('/api/v1/entities/brand_profiles/', { params: { limit: 50 } }),
        ]);
        setAssets(assetRes.data?.items || []);
        setBrands(brandRes.data?.items || []);
      } catch {
        toast.error('Failed to load assets');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  async function handleDelete(id: number) {
    try {
      await axios.delete(`/api/v1/entities/assets/${id}`);
      setAssets(prev => prev.filter(a => a.id !== id));
      toast.success('Asset deleted');
    } catch {
      toast.error('Failed to delete asset');
    }
  }

  const filtered = assets.filter(a => {
    const matchSearch =
      !search ||
      (a.title?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      (a.brand_name?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchBrand = brandFilter === 'all' || a.brand_name === brandFilter;
    const matchType = typeFilter === 'all' || a.asset_type === typeFilter;
    return matchSearch && matchBrand && matchType;
  });

  const assetTypes = ['image', 'video', 'text', 'audio'];

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-[#f5f3ef] px-8 py-10">
        <h1 className="font-bold text-[48px] leading-tight text-[#1e1e20]" style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700 }}>
          Asset Gallery
        </h1>
        <p className="text-[16px] text-[#595959] mt-2">
          Browse and manage all your AI-generated marketing assets.
        </p>

        {/* Filter bar */}
        <div className="flex items-center gap-3 mt-6 mb-6">
          {/* Search */}
          <div className="relative flex items-center">
            <Search size={14} className="absolute left-3 text-[#908f8e] pointer-events-none" />
            <input
              type="text"
              placeholder="Search assets..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-white rounded-full pl-9 pr-4 py-2 text-[14px] text-[#595959] font-light border border-[#e2e2e2] outline-none focus:ring-2 focus:ring-[#1e1e20]/10"
              style={{ width: '307px', height: '36px' }}
            />
          </div>

          {/* Brand filter */}
          <div className="relative">
            <button
              onClick={() => { setBrandOpen(o => !o); setTypeOpen(false); }}
              className="flex items-center gap-2 border border-[#e2e2e2] rounded-lg px-3 py-2 bg-white text-[14px] text-[#1e1e20] hover:bg-gray-50"
            >
              {brandFilter === 'all' ? 'All Brands' : brandFilter}
              <ChevronDown size={14} className="text-[#908f8e]" />
            </button>
            {brandOpen && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-[#e2e2e2] rounded-lg shadow-lg z-20 min-w-[160px]">
                <button
                  className="w-full text-left px-4 py-2 text-[14px] hover:bg-[#f5f3ef]"
                  onClick={() => { setBrandFilter('all'); setBrandOpen(false); }}
                >
                  All Brands
                </button>
                {brands.map(b => (
                  <button
                    key={b.id}
                    className="w-full text-left px-4 py-2 text-[14px] hover:bg-[#f5f3ef]"
                    onClick={() => { setBrandFilter(b.name); setBrandOpen(false); }}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Type filter */}
          <div className="relative">
            <button
              onClick={() => { setTypeOpen(o => !o); setBrandOpen(false); }}
              className="flex items-center gap-2 border border-[#e2e2e2] rounded-lg px-3 py-2 bg-white text-[14px] text-[#1e1e20] hover:bg-gray-50"
            >
              {typeFilter === 'all' ? 'All Types' : typeFilter.charAt(0).toUpperCase() + typeFilter.slice(1)}
              <ChevronDown size={14} className="text-[#908f8e]" />
            </button>
            {typeOpen && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-[#e2e2e2] rounded-lg shadow-lg z-20 min-w-[140px]">
                <button
                  className="w-full text-left px-4 py-2 text-[14px] hover:bg-[#f5f3ef]"
                  onClick={() => { setTypeFilter('all'); setTypeOpen(false); }}
                >
                  All Types
                </button>
                {assetTypes.map(t => (
                  <button
                    key={t}
                    className="w-full text-left px-4 py-2 text-[14px] hover:bg-[#f5f3ef]"
                    onClick={() => { setTypeFilter(t); setTypeOpen(false); }}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-1 ml-auto">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded ${viewMode === 'grid' ? 'bg-[#f5f3ef]' : 'hover:bg-white'}`}
            >
              <LayoutGrid size={18} className="text-[#1e1e20]" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded ${viewMode === 'list' ? 'bg-[#f5f3ef]' : 'hover:bg-white'}`}
            >
              <List size={18} className="text-[#1e1e20]" />
            </button>
          </div>
        </div>

        {/* Loading skeletons */}
        {loading && (
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 9 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="bg-white rounded-2xl p-12 flex flex-col items-center gap-4 max-w-md w-full shadow-sm">
              <ImageIcon size={48} className="text-[#e2e2e2]" />
              <h3 className="text-[18px] font-semibold text-[#1e1e20]">No assets yet</h3>
              <p className="text-[14px] text-[#595959] text-center">
                Generate your first asset from the AI Workspace or Prompt Hub
              </p>
              <div className="flex gap-3 mt-2">
                <Link
                  to="/workspace"
                  className="px-4 py-2 bg-[#1e1e20] text-white text-[14px] rounded-lg hover:bg-[#333]"
                >
                  AI Workspace
                </Link>
                <Link
                  to="/chat"
                  className="px-4 py-2 border border-[#e2e2e2] text-[#1e1e20] text-[14px] rounded-lg hover:bg-[#f5f3ef]"
                >
                  Prompt Hub
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Grid view */}
        {!loading && filtered.length > 0 && viewMode === 'grid' && (
          <div className="grid grid-cols-3 gap-4">
            {filtered.map(asset => (
              <div key={asset.id} className="bg-white rounded-xl overflow-hidden">
                <AssetPreview asset={asset} />
                <div className="p-4">
                  <h3 className="font-bold text-[16px] text-[#1e1e20] truncate mb-2">
                    {asset.title || 'Untitled Asset'}
                  </h3>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {asset.brand_name && (
                      <span className="bg-white border border-[#e2e2e2] text-[#595959] text-[12px] rounded-full px-2 py-0.5">
                        {asset.brand_name}
                      </span>
                    )}
                    {asset.ai_tool && (
                      <span className="bg-white border border-[#e2e2e2] text-[#595959] text-[12px] rounded-full px-2 py-0.5">
                        {asset.ai_tool}
                      </span>
                    )}
                    <span className="bg-white border border-[#e2e2e2] text-[#595959] text-[12px] rounded-full px-2 py-0.5 capitalize">
                      {asset.asset_type}
                    </span>
                  </div>
                  <p className="text-[13px] text-[#908f8e] mb-3">
                    Added {formatDate(asset.created_at)}
                  </p>
                  <div className="flex justify-end gap-2">
                    {asset.chat_history && (
                      <button
                        onClick={() => handleContinue(asset)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e1e20] text-white text-[13px] rounded-lg hover:bg-[#333]"
                      >
                        <MessageSquare size={13} />
                        Continue
                      </button>
                    )}
                    {asset.url && asset.asset_type !== 'text' && (
                      <a
                        href={asset.url}
                        download
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-[#e2e2e2] rounded-lg text-[13px] text-[#1e1e20] hover:bg-[#f5f3ef]"
                      >
                        <Download size={13} />
                        Download
                      </a>
                    )}
                    <button
                      onClick={() => handleDelete(asset.id)}
                      className="flex items-center justify-center w-9 h-9 border border-[#e2e2e2] rounded-lg text-[#595959] hover:bg-red-50 hover:border-red-200 hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* List view */}
        {!loading && filtered.length > 0 && viewMode === 'list' && (
          <div className="flex flex-col gap-2">
            {filtered.map(asset => (
              <div key={asset.id} className="bg-white rounded-xl flex items-center gap-4 p-4">
                <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                  {asset.url && asset.asset_type !== 'text' && (asset.url.startsWith('data:') || asset.url.startsWith('http')) ? (
                    <img src={asset.url} alt={asset.title || 'Asset'} className="w-full h-full object-cover" />
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center ${
                      asset.asset_type === 'image' ? 'bg-gradient-to-br from-violet-400 to-indigo-500' :
                      asset.asset_type === 'video' ? 'bg-gradient-to-br from-rose-400 to-pink-500' :
                      asset.asset_type === 'audio' ? 'bg-gradient-to-br from-amber-400 to-orange-500' :
                      'bg-gradient-to-br from-emerald-400 to-teal-500'
                    }`}>
                      <ImageIcon size={20} className="text-white opacity-60" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-[15px] text-[#1e1e20] truncate">
                    {asset.title || 'Untitled Asset'}
                  </h3>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {asset.brand_name && (
                      <span className="border border-[#e2e2e2] text-[#595959] text-[11px] rounded-full px-2 py-0.5">
                        {asset.brand_name}
                      </span>
                    )}
                    {asset.ai_tool && (
                      <span className="border border-[#e2e2e2] text-[#595959] text-[11px] rounded-full px-2 py-0.5">
                        {asset.ai_tool}
                      </span>
                    )}
                    <span className="border border-[#e2e2e2] text-[#595959] text-[11px] rounded-full px-2 py-0.5 capitalize">
                      {asset.asset_type}
                    </span>
                  </div>
                  <p className="text-[12px] text-[#908f8e] mt-1">Added {formatDate(asset.created_at)}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {asset.chat_history && (
                    <button
                      onClick={() => handleContinue(asset)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e1e20] text-white text-[13px] rounded-lg hover:bg-[#333]"
                    >
                      <MessageSquare size={13} />
                      Continue
                    </button>
                  )}
                  {asset.url && asset.asset_type !== 'text' && (
                    <a
                      href={asset.url}
                      download
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-[#e2e2e2] rounded-lg text-[13px] text-[#1e1e20] hover:bg-[#f5f3ef]"
                    >
                      <Download size={13} />
                      Download
                    </a>
                  )}
                  <button
                    onClick={() => handleDelete(asset.id)}
                    className="flex items-center justify-center w-9 h-9 border border-[#e2e2e2] rounded-lg text-[#595959] hover:bg-red-50 hover:border-red-200 hover:text-red-500"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}
