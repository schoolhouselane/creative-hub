import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createClient } from '@metagptx/web-sdk';
import { Button } from '@/components/ui/button';
import { LogIn, LogOut, LayoutDashboard, Plus, Home, User } from 'lucide-react';

const client = createClient();

export default function Header() {
  const [user, setUser] = useState<any>(null);
  const location = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await client.auth.me();
        setUser(res?.data || null);
      } catch {
        setUser(null);
      }
    };
    checkAuth();
  }, []);

  const handleLogin = () => {
    client.auth.toLogin();
  };

  const handleLogout = async () => {
    await client.auth.logout();
    setUser(null);
    window.location.href = '/';
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-[#0a0a0f]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500">
            <span className="text-lg font-bold text-white">S</span>
          </div>
          <span className="text-lg font-bold text-white">SHL Creative</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <Link to="/">
            <Button
              variant="ghost"
              size="sm"
              className={`gap-2 text-sm ${isActive('/') ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            >
              <Home className="h-4 w-4" />
              Home
            </Button>
          </Link>
          <Link to="/dashboard">
            <Button
              variant="ghost"
              size="sm"
              className={`gap-2 text-sm ${isActive('/dashboard') ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Button>
          </Link>
          <Link to="/new-brief">
            <Button
              variant="ghost"
              size="sm"
              className={`gap-2 text-sm ${isActive('/new-brief') ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            >
              <Plus className="h-4 w-4" />
              New Brief
            </Button>
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-500">
                <User className="h-4 w-4 text-white" />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="gap-2 text-slate-400 hover:text-white hover:bg-white/5"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleLogin}
              size="sm"
              className="gap-2 bg-gradient-to-r from-violet-600 to-cyan-600 text-white hover:from-violet-500 hover:to-cyan-500"
            >
              <LogIn className="h-4 w-4" />
              Sign In
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}