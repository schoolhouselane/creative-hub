import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { staffAuthApi, staffToken } from '@/lib/staffAuth';
import { clientAuthApi, clientToken } from '@/lib/clientAuth';

type Role = 'staff' | 'client';

export default function LoginPage() {
  const navigate = useNavigate();
  const [role, setRole]       = useState<Role>('staff');
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (role === 'staff') {
        const res = await staffAuthApi.login(email, password);
        staffToken.set(res.token);
        navigate('/');
      } else {
        const res = await clientAuthApi.login(email, password);
        clientToken.set(res.token);
        navigate('/client/briefs');
      }
    } catch {
      setError('Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#f5f3ef]">
      {/* Left panel */}
      <div className="hidden lg:flex w-[400px] shrink-0 flex-col justify-between bg-[#1e1e20] p-12">
        <img src="/logo.png" alt="Schoolhouse Lane" className="h-14 w-auto" />
        <div>
          <h1 className="text-3xl font-bold text-white leading-snug">Creative Hub</h1>
          <p className="mt-3 text-sm text-white/40 leading-relaxed">
            AI-powered creative production for brands that move fast.
          </p>
        </div>
        <p className="text-xs text-white/20">© {new Date().getFullYear()} Schoolhouse Lane</p>
      </div>

      {/* Right panel */}
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <img src="/logo.png" alt="Schoolhouse Lane" className="mb-10 h-10 w-auto lg:hidden" />

          <h2 className="mb-1 text-2xl font-bold text-[#1e1e20]">Sign in</h2>
          <p className="mb-8 text-sm text-[#8c8c8c]">Choose your account type to continue</p>

          {/* Role toggle */}
          <div className="mb-6 flex rounded-xl border border-[#e2e2e2] bg-white p-1">
            {(['staff', 'client'] as Role[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => { setRole(r); setError(''); }}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all capitalize ${
                  role === r
                    ? 'bg-[#1e1e20] text-white shadow-sm'
                    : 'text-[#8c8c8c] hover:text-[#1e1e20]'
                }`}
              >
                {r === 'staff' ? 'Staff' : 'Client'}
              </button>
            ))}
          </div>

          {/* Hint text */}
          <p className="mb-5 text-xs text-[#8c8c8c]">
            {role === 'staff'
              ? 'Sign in to manage brands, briefs and AI creative production.'
              : 'Sign in to submit and track your creative briefs.'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#1e1e20]">Email address</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={role === 'staff' ? 'you@schoolhouselane.co' : 'you@company.com'}
                className="w-full rounded-xl border border-[#e2e2e2] bg-white px-4 py-3 text-sm text-[#1e1e20] placeholder:text-[#c4c4c4] focus:border-[#1e1e20] focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#1e1e20]">Password</label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-[#e2e2e2] bg-white px-4 py-3 text-sm text-[#1e1e20] placeholder:text-[#c4c4c4] focus:border-[#1e1e20] focus:outline-none transition-colors"
              />
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-xl bg-[#1e1e20] py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
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
