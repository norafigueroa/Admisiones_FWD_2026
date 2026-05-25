import { createContext, useContext, useEffect, useState } from 'react';
import api, { setToken, getToken } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get('/auth/me')
      .then((res) => setUser(res.data.user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const { data } = await api.post('/auth/login', { email, password });
    setToken(data.token);
    setUser(data.user);
    return data;
  }

  async function changePassword(currentPassword, newPassword) {
    const { data } = await api.post('/auth/change-password', {
      currentPassword,
      newPassword,
    });
    setToken(data.token);
    setUser(data.user);
    return data;
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, login, logout, changePassword }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
