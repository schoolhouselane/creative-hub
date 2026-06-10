import axios from 'axios';

const TOKEN_KEY = 'ch_client_token';

export const clientToken = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export interface ClientUser {
  id: string;
  email: string;
  company_name?: string;
  role: 'client';
}

// Use relative URLs — Vite proxy forwards /api → backend:8000
export const clientAuthApi = {
  async login(email: string, password: string): Promise<{ token: string; email: string; company_name?: string }> {
    const res = await axios.post('/api/v1/auth/client/login', { email, password });
    return res.data;
  },

  async me(): Promise<ClientUser | null> {
    if (!clientToken.get()) return null;
    try {
      const res = await axios.get('/api/v1/auth/client/me', {
        headers: { Authorization: `Bearer ${clientToken.get()}` },
      });
      return res.data;
    } catch {
      clientToken.clear();
      return null;
    }
  },

  logout() {
    clientToken.clear();
    window.location.href = '/auth.html';
  },
};
