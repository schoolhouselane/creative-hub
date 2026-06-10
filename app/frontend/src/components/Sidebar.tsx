import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createClient } from '@metagptx/web-sdk';
import { staffAuthApi, staffToken } from '@/lib/staffAuth';
import {
  LayoutDashboard, Building2, BookMarked, MessageSquare, Image,
  FileText, LogOut, User, Menu, X,
} from 'lucide-react';
import FloatingClaudeChat from '@/components/FloatingClaudeChat';

const client = createClient();

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/brands', label: 'Brand Management', icon: Building2 },
  { path: '/prompts', label: 'Prompt Library', icon: BookMarked },
  { path: '/chat', label: 'AI Workspace', icon: MessageSquare },
  { path: '/gallery', label: 'Asset Gallery', icon: Image },
  { path: '/briefs', label: 'Client Briefs', icon: FileText },
];

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [user, setUser] = useState<any>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    // Try our staff JWT first; fall back to MGX SDK (dev bypass / platform auth)
    if (staffToken.get()) {
      staffAuthApi.me()
        .then((u) => {
          if (u) { setUser(u); return; }
          // Token invalid — fall back to SDK
          return client.auth.me().then((res) => setUser(res?.data || null));
        })
        .catch(() => setUser(null));
    } else {
      client.auth.me()
        .then((res) => setUser(res?.data || null))
        .catch(() => setUser(null));
    }
  }, []);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/' || location.pathname === '/dashboard';
    return location.pathname.startsWith(path);
  };

  const handleLogout = () => {
    staffToken.clear();
    client.auth.logout().catch(() => {});
    setUser(null);
    window.location.href = '/auth.html';
  };

  const sidebarContent = (
    <div className="flex h-full flex-col bg-[#1e1e20] px-[47px] pb-[52px] pt-[52px]">

      {/* Logo */}
      <div className="mb-[100px]">
        <img
          src="/logo.png"
          alt="School House Lane"
          className="h-[68px] w-auto"
        />
      </div>

      {/* Nav */}
      <div className="flex-1 min-h-0">
        <p className="mb-[18px] text-[20px] font-bold text-white">Workspace</p>
        <div className="flex flex-col gap-[15px]">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 rounded-full px-3 transition-all ${
                  active
                    ? 'h-[51px] border border-[rgba(255,255,255,0.16)] bg-[rgba(255,255,255,0.11)]'
                    : 'py-[10px] bg-[#383839] hover:bg-[#48484a]'
                }`}
              >
                <item.icon className="h-5 w-5 shrink-0 text-white" />
                <span className={`text-[14px] text-white ${active ? 'font-bold' : 'font-light'}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* User */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-[45px] w-[45px] shrink-0 items-center justify-center rounded-[22px] bg-[#e39092]">
            <User className="h-[26px] w-[26px] text-white" />
          </div>
          <span className="text-[20px] font-bold text-white truncate max-w-[130px]">
            {user?.name || user?.email?.split('@')[0] || 'User'}
          </span>
        </div>
        {user && (
          <button
            onClick={handleLogout}
            className="text-white/50 hover:text-white transition-colors"
            title="Logout"
          >
            <LogOut className="h-5 w-5" />
          </button>
        )}
      </div>

    </div>
  );

  return (
    <div className="flex h-screen bg-[#1e1e20]">
      {/* Desktop Sidebar */}
      <aside className="hidden w-[373px] shrink-0 lg:block">
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[373px] transition-transform duration-300 lg:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile Header */}
        <div className="flex h-14 items-center gap-3 border-b border-white/10 bg-[#1e1e20] px-4 lg:hidden">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="rounded-lg p-1.5 text-white/50 hover:bg-white/5 hover:text-white"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <span className="font-bold text-white">Schoolhouse Creative Room</span>
        </div>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      <FloatingClaudeChat />
    </div>
  );
}
