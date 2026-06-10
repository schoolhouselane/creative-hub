import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clientAuthApi, clientToken } from '@/lib/clientAuth';

export default function ClientLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await clientAuthApi.login(email, password);
      clientToken.set(res.token);
      navigate('/client/briefs');
    } catch {
      setError('Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#f5f3ef]">
      {/* Left panel */}
      <div className="hidden w-[420px] shrink-0 flex-col justify-between bg-[#1e1e20] p-10 lg:flex">
        <div>
          <div className="mb-12">
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <rect width="36" height="36" rx="8" fill="#fff" fillOpacity=".12" />
              <path d="M10 18h16M18 10l8 8-8 8" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-white/40">
              Schoolhouse Lane
            </p>
          </div>
          <div className="mt-16">
            <h1 className="text-3xl font-bold leading-snug text-white">
              Creative Hub
              <br />
              Client Portal
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-white/50">
              Submit and track your creative briefs. Our team will pick them up and get to work.
            </p>
          </div>
        </div>
        <p className="text-xs text-white/20">© {new Date().getFullYear()} Schoolhouse Lane</p>
      </div>

      {/* Right panel */}
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1e1e20]">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M4 10h12M10 4l6 6-6 6" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-[#1e1e20]">Schoolhouse Lane</span>
          </div>

          <h2 className="mb-1 text-2xl font-bold text-[#1e1e20]">Welcome back</h2>
          <p className="mb-8 text-sm text-[#8c8c8c]">Sign in to your client account</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#1e1e20]">Email address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full rounded-lg border border-[#e2e2e2] bg-white px-4 py-3 text-sm text-[#1e1e20] placeholder:text-[#c4c4c4] focus:border-[#1e1e20] focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#1e1e20]">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-[#e2e2e2] bg-white px-4 py-3 text-sm text-[#1e1e20] placeholder:text-[#c4c4c4] focus:border-[#1e1e20] focus:outline-none transition-colors"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-lg bg-[#1e1e20] py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-[#8c8c8c]">
            Need access?{' '}
            <a href="mailto:hello@schoolhouselane.co" className="underline hover:text-[#1e1e20]">
              Contact Schoolhouse Lane
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
