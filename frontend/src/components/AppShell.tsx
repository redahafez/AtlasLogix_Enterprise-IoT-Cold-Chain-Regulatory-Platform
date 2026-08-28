'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import {
  LayoutDashboard, Package, Radio, Shield, LogOut, ChevronDown,
  Menu, X, Sun, Moon
} from 'lucide-react';

import { BrandLogo } from '@/components/BrandLogo';

interface AppShellProps {
  children: React.ReactNode;
  socketStatus?: string;
}

export function AppShell({ children, socketStatus = 'connected' }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, activeTenantId, switchTenant, logout } = useAuth();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close mobile drawer when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
  };

  const navItems = [
    { label: 'Overview', href: '/overview', icon: LayoutDashboard },
    { label: 'Shipments', href: '/shipments', icon: Package },
    { label: 'Live sensors', href: '/sensors', icon: Radio },
    { label: 'Administration', href: '/administration', icon: Shield },
  ];

  const getInitials = (nameOrEmail: string) => {
    if (!nameOrEmail) return 'AL';
    const parts = nameOrEmail.split('@')[0].split('.');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return nameOrEmail.slice(0, 2).toUpperCase();
  };

  const activeTenantObj = user?.tenants.find(t => t.tenantId === activeTenantId);

  return (
    <div className="min-h-screen flex bg-[#F8FAFC] dark:bg-[#081B42] text-slate-900 dark:text-white relative">
      
      {/* Desktop Left Sidebar (Dark Navy #081B42) */}
      <aside className="w-64 bg-[#081B42] border-r border-slate-800 flex-col justify-between p-6 shrink-0 hidden md:flex min-h-screen sticky top-0 z-30">
        <div className="space-y-8">
          
          {/* Logo Section */}
          <Link href="/overview" className="block group">
            <BrandLogo variant="light" size="md" className="group-hover:opacity-90 transition-opacity" />
          </Link>

          {/* Navigation Links */}
          <nav className="space-y-1.5" role="navigation" aria-label="Main Desktop Navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href === '/shipments' && pathname.startsWith('/shipments'));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-[#2563EB] text-white shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Help & Documentation Card */}
        <div className="space-y-4 pt-6 border-t border-slate-800/80">
          <div className="p-4 rounded-xl bg-[#102B62]/60 border border-slate-700/50 space-y-1">
            <span className="text-xs font-bold text-white block">Need help?</span>
            <p className="text-[11px] text-slate-400">Review API documentation</p>
          </div>

          {/* Logout & Theme Button */}
          <div className="flex items-center justify-between text-xs text-slate-400 pt-2">
            <button
              type="button"
              onClick={() => logout()}
              className="flex items-center gap-2 hover:text-rose-400 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" /> Sign out
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className="p-1.5 rounded-lg hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
              title="Toggle Light/Dark Theme"
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-400" />}
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer Overlay Backdrop */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 md:hidden animate-fade-in"
          aria-hidden="true"
        />
      )}

      {/* Mobile Drawer Sidebar */}
      <aside
        className={`fixed top-0 left-0 bottom-0 w-72 bg-[#081B42] text-white z-50 flex flex-col justify-between p-6 shadow-2xl transition-transform duration-300 ease-in-out md:hidden ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="space-y-8">
          
          {/* Mobile Header: Logo & Close Button */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <BrandLogo variant="light" size="md" />
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="Close Mobile Navigation"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5" role="navigation" aria-label="Main Mobile Navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href === '/shipments' && pathname.startsWith('/shipments'));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-[#2563EB] text-white shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Help & Logout Card */}
        <div className="space-y-4 pt-6 border-t border-slate-800/80">
          <div className="p-4 rounded-xl bg-[#102B62]/60 border border-slate-700/50 space-y-1">
            <span className="text-xs font-bold text-white block">Need help?</span>
            <p className="text-[11px] text-slate-400">Review API documentation</p>
          </div>

          {/* Logout & Theme Button */}
          <div className="flex items-center justify-between text-xs text-slate-400 pt-2">
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                logout();
              }}
              className="flex items-center gap-2 hover:text-rose-400 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" /> Sign out
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className="p-1.5 rounded-lg hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
              title="Toggle Light/Dark Theme"
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-400" />}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Header Bar */}
        <header className="h-16 bg-white dark:bg-[#081B42] border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20 shadow-sm">
          
          {/* Left: Mobile Hamburger Toggle + Tenant Selector */}
          <div className="flex items-center gap-3">
            {/* Hamburger Toggle Button (Mobile Only) */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Toggle Mobile Navigation Drawer"
            >
              <Menu className="w-5 h-5" />
            </button>

            <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase hidden sm:inline">TENANT</span>
            <div className="relative">
              <select
                value={activeTenantId || ''}
                onChange={(e) => switchTenant(e.target.value)}
                className="pl-3 pr-8 py-1.5 text-xs font-bold rounded-lg bg-slate-50 dark:bg-[#102B62] text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 appearance-none cursor-pointer focus:ring-2 focus:ring-blue-500 focus:outline-none max-w-[180px] sm:max-w-none truncate"
                aria-label="Active Tenant Selection"
              >
                {user?.tenants.map((t) => (
                  <option key={t.tenantId} value={t.tenantId}>
                    {t.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>

            {activeTenantObj && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 uppercase hidden md:inline">
                {activeTenantObj.region}
              </span>
            )}
          </div>

          {/* Right: Socket Connection Pill & User Profile */}
          <div className="flex items-center gap-3 sm:gap-4">
            
            {/* Live Socket Status Pill */}
            <div className="flex items-center gap-2 px-2.5 sm:px-3 py-1 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <span className={`w-2 h-2 rounded-full ${
                socketStatus === 'connected' ? 'bg-emerald-500 animate-pulse' :
                socketStatus === 'connecting' ? 'bg-amber-500 animate-spin' : 'bg-rose-500'
              }`} />
              <span className="text-slate-600 dark:text-slate-300 text-[10px] sm:text-[11px]">
                {socketStatus === 'connected' ? 'Live Stream' : socketStatus}
              </span>
            </div>

            {/* User Profile Avatar */}
            {user && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#2563EB] text-white flex items-center justify-center text-xs font-bold shadow shrink-0">
                  {getInitials(user.email)}
                </div>
                <div className="hidden sm:block text-left">
                  <span className="block text-xs font-bold text-slate-900 dark:text-white leading-tight">
                    {user.email.split('@')[0].replace('.', ' ').toUpperCase()}
                  </span>
                  <span className="block text-[10px] text-slate-500 dark:text-slate-400 capitalize">
                    {user.role.replace('_', ' ').toLowerCase()}
                  </span>
                </div>
              </div>
            )}
          </div>

        </header>

        {/* Page Body Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>

      </div>

    </div>
  );
}
