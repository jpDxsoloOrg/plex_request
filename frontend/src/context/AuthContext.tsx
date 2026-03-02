import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { auth as authApi } from '@/services/api';
import { AuthContext } from '@/context/auth-context';
import type { User } from '@/types';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    const token = localStorage.getItem('idToken');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const me = await authApi.me();
      setUser(me);
    } catch {
      localStorage.removeItem('idToken');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = async (email: string, password: string) => {
    const tokens = await authApi.login(email, password);
    localStorage.setItem('idToken', tokens.idToken);
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    await fetchUser();
  };

  const signup = async (email: string, password: string) => {
    await authApi.signup(email, password);
  };

  const confirm = async (email: string, code: string) => {
    await authApi.confirm(email, code);
  };

  const logout = () => {
    localStorage.removeItem('idToken');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
  };

  const isAdmin = user?.groups.includes('admins') ?? false;

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, login, signup, confirm, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
