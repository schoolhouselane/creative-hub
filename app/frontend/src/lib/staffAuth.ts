import axios from 'axios';

const TOKEN_KEY = 'ch_staff_token';

export const staffToken = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export interface StaffUser {
  id: string;
  email: string;
  name?: string;
  role: 'staff' | 'admin';
}

// Use relative URLs — Vite proxy forwards /api → backend:8000
export const staffAuthApi = {
  async login(email: string, password: string) {
    const res = await axios.post('/api/v1/auth/staff/login', { email, password });
    return res.data as { token: string; email: string; name?: string; role: string };
  },

  async me(): Promise<StaffUser | null> {
    if (!staffToken.get()) return null;
    try {
      const res = await axios.get('/api/v1/auth/staff/me', {
        headers: { Authorization: `Bearer ${staffToken.get()}` },
      });
      return res.data as StaffUser;
    } catch {
      staffToken.clear();
      return null;
    }
  },

  logout() {
    staffToken.clear();
    window.location.href = '/auth.html';
  },
};
