import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createClient } from '@metagptx/web-sdk';
import SidebarLayout from '@/components/Sidebar';
import { type Brief, BRIEF_TYPES, STATUS_OPTIONS, PRIORITY_OPTIONS } from '@/lib/briefTypes';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Plus, Search, Loader2, Clock, Palette, Megaphone, Share2, Mail, FileText, Video, ArrowRight } from 'lucide-react';

const client = createClient();

const iconMap: Record<string, React.ElementType> = {
  Palette, Megaphone, Share2, Mail, FileText, Video,
};

export default function BriefsPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const init = async () => {
      try {
        const res = await client.auth.me();
        const userData = res?.data || null;
        setUser(userData);
        if (userData) {
          await fetchBriefs();
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const fetchBriefs = async () => {
    try {
      const res = await client.entities.briefs.query({ query: {}, sort: '-created_at', limit: 50 });
      setBriefs((res?.data?.items as Brief[]) || []);
    } catch {
      setBriefs([]);
    }
  };

  const filteredBriefs = briefs.filter((brief) => {
    if (filterType !== 'all' && brief.brief_type !== filterType) return false;
    if (filterStatus !== 'all' && brief.status !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        brief.title?.toLowerCase().includes(q) ||
        brief.brand_name?.toLowerCase().includes(q) ||
        brief.brief_type?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getStatusColor = (status: string) => STATUS_OPTIONS.find((s) => s.value === status)?.color || '#94a3b8';
  const getPriorityColor = (priority: string) => PRIORITY_OPTIONS.find((p) => p.value === priority)?.color || '#94a3b8';
  const getBriefTypeInfo = (typeId: string) => BRIEF_TYPES.find((t) => t.id === typeId);

  if (loading) {
    return (
      <SidebarLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#595959]" />
        </div>
      </SidebarLayout>
    );
  }

  if (!user) {
    return (
      <SidebarLayout>
        <div className="flex flex-col items-center justify-center px-4 pt-32">
          <h2 className="mb-4 text-2xl font-bold text-[#1e1e20]">Sign in to view your briefs</h2>
          <p className="mb-6 text-[#595959]">You need to be signed in to manage your briefs</p>
          <Button
            onClick={() => client.auth.toLogin()}
            className="gap-2 bg-gradient-to-r from-violet-600 to-cyan-600 text-[#1e1e20]"
          >
            Sign In
          </Button>
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout>
      <div className="min-h-full bg-[#f5f3ef] p-6 lg:p-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#1e1e20]">Client Briefs</h1>
            <p className="mt-1 text-sm text-[#595959]">
              {briefs.length} total brief{briefs.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Link to="/briefs/new">
            <Button className="gap-2 bg-[#1e1e20] text-white hover:bg-[#2e2e30]">
              <Plus className="h-4 w-4" />
              New Brief
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#595959]" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search briefs..."
              className="border-[#e2e2e2] bg-[#f5f3ef] pl-10 text-[#1e1e20] placeholder:text-[#595959] focus:border-violet-500"
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-full border-[#e2e2e2] bg-[#f5f3ef] text-[#1e1e20] sm:w-[180px]">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent className="border-[#e2e2e2] bg-white">
              <SelectItem value="all" className="text-[#1e1e20] hover:bg-[#f5f3ef] focus:bg-white/10">All Types</SelectItem>
              {BRIEF_TYPES.map((type) => (
                <SelectItem key={type.id} value={type.id} className="text-[#1e1e20] hover:bg-[#f5f3ef] focus:bg-white/10">
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full border-[#e2e2e2] bg-[#f5f3ef] text-[#1e1e20] sm:w-[180px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent className="border-[#e2e2e2] bg-white">
              <SelectItem value="all" className="text-[#1e1e20] hover:bg-[#f5f3ef] focus:bg-white/10">All Statuses</SelectItem>
              {STATUS_OPTIONS.map((status) => (
                <SelectItem key={status.value} value={status.value} className="text-[#1e1e20] hover:bg-[#f5f3ef] focus:bg-white/10">
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {STATUS_OPTIONS.map((status) => {
            const count = briefs.filter((b) => b.status === status.value).length;
            return (
              <div key={status.value} className="rounded-xl border border-[#e2e2e2] bg-white p-4">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: status.color }} />
                  <span className="text-xs text-[#595959]">{status.label}</span>
                </div>
                <p className="mt-2 text-2xl font-bold text-[#1e1e20]">{count}</p>
              </div>
            );
          })}
        </div>

        {/* Briefs List */}
        {filteredBriefs.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-[#e2e2e2] bg-white py-16">
            <Clock className="mb-4 h-12 w-12 text-[#8c8c8c]" />
            <h3 className="mb-2 text-lg font-semibold text-[#1e1e20]">No briefs found</h3>
            <p className="mb-6 text-sm text-[#595959]">
              {briefs.length === 0 ? 'Create your first brief to get started' : 'Try adjusting your filters'}
            </p>
            {briefs.length === 0 && (
              <Link to="/briefs/new">
                <Button className="gap-2 bg-gradient-to-r from-violet-600 to-cyan-600 text-[#1e1e20]">
                  <Plus className="h-4 w-4" />
                  Create Brief
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredBriefs.map((brief) => {
              const typeInfo = getBriefTypeInfo(brief.brief_type);
              const Icon = typeInfo ? iconMap[typeInfo.icon] || Palette : Palette;
              return (
                <button
                  key={brief.id}
                  onClick={() => navigate(`/briefs/${brief.id}`)}
                  className="group flex w-full items-center gap-4 rounded-xl border border-[#e2e2e2] bg-white p-4 text-left transition-all hover:border-[#e2e2e2] hover:bg-[#f5f3ef]"
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${typeInfo?.color || '#7c3aed'}15` }}
                  >
                    <Icon className="h-5 w-5" style={{ color: typeInfo?.color || '#7c3aed' }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-medium text-[#1e1e20]">{brief.title}</h3>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2">
                      <span className="text-xs text-[#595959]">{typeInfo?.label || brief.brief_type}</span>
                      {brief.brand_name && (
                        <>
                          <span className="text-[#8c8c8c]">·</span>
                          <span className="text-xs text-[#595959]">{brief.brand_name}</span>
                        </>
                      )}
                      {brief.created_at && (
                        <>
                          <span className="text-[#8c8c8c]">·</span>
                          <span className="text-xs text-[#595959]">
                            {new Date(brief.created_at).toLocaleDateString()}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {brief.priority && (
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{
                          backgroundColor: `${getPriorityColor(brief.priority)}15`,
                          color: getPriorityColor(brief.priority),
                        }}
                      >
                        {brief.priority}
                      </span>
                    )}
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{
                        backgroundColor: `${getStatusColor(brief.status)}15`,
                        color: getStatusColor(brief.status),
                      }}
                    >
                      {STATUS_OPTIONS.find((s) => s.value === brief.status)?.label || brief.status}
                    </span>
                    <ArrowRight className="h-4 w-4 text-[#8c8c8c] transition-transform group-hover:translate-x-1 group-hover:text-[#595959]" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}