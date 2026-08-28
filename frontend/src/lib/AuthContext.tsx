'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthContext as AuthContextType, TenantMembership, Role } from './types';
import { api } from './api';

interface AuthContextValue {
  user: AuthContextType | null;
  activeTenant: TenantMembership | null;
  activeTenantId: string | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => void;
  switchTenant: (tenantId: string) => void;
  hasPermission: (permission: string) => boolean;
}

const AuthCtx = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthContextType | null>(null);
  const [activeTenantId, setActiveTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function initAuth() {
      const token = api.getToken();
      if (token) {
        try {
          const authData = await api.getMe();
          setUser(authData);
          const savedTenant = localStorage.getItem('atlaslogix_active_tenant');
          if (savedTenant && authData.tenants.some(t => t.tenantId === savedTenant)) {
            setActiveTenantId(savedTenant);
          } else if (authData.tenants.length > 0) {
            setActiveTenantId(authData.tenants[0].tenantId);
          }
        } catch (err) {
          api.setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    }
    initAuth();
  }, []);

  const login = async (email: string, pass: string) => {
    setLoading(true);
    try {
      const authData = await api.login(email, pass);
      setUser(authData);
      const firstTenant = authData.tenants[0]?.tenantId || authData.tenantId;
      setActiveTenantId(firstTenant);
      if (firstTenant) {
        localStorage.setItem('atlaslogix_active_tenant', firstTenant);
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    api.setToken(null);
    setUser(null);
    setActiveTenantId(null);
    localStorage.removeItem('atlaslogix_active_tenant');
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  };

  const switchTenant = (tenantId: string) => {
    if (user && user.tenants.some(t => t.tenantId === tenantId)) {
      setActiveTenantId(tenantId);
      localStorage.setItem('atlaslogix_active_tenant', tenantId);
    }
  };

  const activeTenant = user?.tenants.find(t => t.tenantId === activeTenantId) || null;

  const hasPermission = (permission: string): boolean => {
    if (!activeTenant) return false;
    return activeTenant.permissions.includes(permission);
  };

  return (
    <AuthCtx.Provider value={{
      user,
      activeTenant,
      activeTenantId,
      loading,
      login,
      logout,
      switchTenant,
      hasPermission
    }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
