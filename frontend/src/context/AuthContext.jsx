import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../services/auth';

const AuthContext = createContext(null);

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
}

function persistSession(data) {
  if (data.access) localStorage.setItem('access_token', data.access);
  if (data.refresh) localStorage.setItem('refresh_token', data.refresh);
  if (data.user) localStorage.setItem('user', JSON.stringify(data.user));
}

function clearSession() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser);
  const [loading, setLoading] = useState(Boolean(localStorage.getItem('access_token')));

  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      if (!localStorage.getItem('access_token')) {
        setLoading(false);
        return;
      }
      try {
        const data = await authApi.me();
        if (!cancelled) {
          setUser(data);
          localStorage.setItem('user', JSON.stringify(data));
        }
      } catch {
        if (!cancelled) {
          clearSession();
          setUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleLogout = () => setUser(null);
    window.addEventListener('auth:logout', handleLogout);
    return () => window.removeEventListener('auth:logout', handleLogout);
  }, []);

  const finishAuth = useCallback((data) => {
    persistSession(data);
    setUser(data.user);
    return data.user;
  }, []);

  const login = useCallback(
    async (email, password) => {
      const data = await authApi.login(email, password);
      return finishAuth(data);
    },
    [finishAuth]
  );

  const register = useCallback(
    async (payload) => {
      const data = await authApi.register(payload);
      return finishAuth(data);
    },
    [finishAuth]
  );

  const registerVendor = useCallback(
    async (payload) => {
      const data = await authApi.vendorRegister(payload);
      return finishAuth(data);
    },
    [finishAuth]
  );

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (payload) => {
    const data = await authApi.updateProfile(payload);
    setUser(data.user);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data.user;
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user && localStorage.getItem('access_token')),
      isAdmin: Boolean(user?.is_superuser || user?.user_role === '2'),
      isVendor: user?.user_role === '3',
      isCustomer: user?.user_role === '1',
      login,
      register,
      registerVendor,
      logout,
      updateProfile,
    }),
    [user, loading, login, register, registerVendor, logout, updateProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
