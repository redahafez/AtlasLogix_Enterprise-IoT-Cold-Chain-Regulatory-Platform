'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { Lock, Mail, AlertCircle, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';

const SEED_USERS = [
  { role: 'Compliance Auditor', email: 'auditor.reda-hafez@atlaslogix.test', pass: '4wLJerbLyBGBGZG8t8IIjA' },
  { role: 'Tenant Admin', email: 'admin.reda-hafez@atlaslogix.test', pass: '7P1OhjscS32sQjYWFCra2w' },
  { role: 'Operations Manager', email: 'operations.reda-hafez@atlaslogix.test', pass: 'eaeGnGIcL8Y7JvaxOHAylw' },
  { role: 'Warehouse Supervisor', email: 'warehouse.reda-hafez@atlaslogix.test', pass: 'X3mJ_Ii5pWcdMNEiLma9ow' },
  { role: 'Viewer', email: 'viewer.reda-hafez@atlaslogix.test', pass: 'DTp6ZNQR7o4_j9l7201uGA' },
];

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState(SEED_USERS[0].email);
  const [password, setPassword] = useState(SEED_USERS[0].pass);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      await login(email, password);
      router.push('/shipments');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSelect = (u: typeof SEED_USERS[0]) => {
    setEmail(u.email);
    setPassword(u.pass);
    setErrorMsg(null);
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#F8FAFC]">
      
      {/* Left Column - Dark Hero Banner (01-login.png) */}
      <div className="lg:w-1/2 bg-[#081B42] text-white p-8 sm:p-12 lg:p-16 flex flex-col justify-between relative overflow-hidden">
        
        {/* Top Brand Header */}
        <div className="z-10">
          <BrandLogo variant="light" size="lg" />
        </div>

        {/* Center Hero Text */}
        <div className="my-16 lg:my-auto space-y-6 max-w-lg z-10">
          <span className="text-[11px] font-bold tracking-widest text-[#14B8A6] uppercase">
            COMPLIANCE OPERATIONS
          </span>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-white leading-tight">
            Confidence at every checkpoint.
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed font-normal">
            Review shipment conditions, investigate sensor excursions, and protect the integrity of regulated logistics records.
          </p>

          {/* Stats Badges Row */}
          <div className="grid grid-cols-3 gap-6 pt-6 border-t border-slate-800">
            <div>
              <span className="text-lg font-bold text-white block">24/7</span>
              <span className="text-[11px] text-slate-400">monitoring</span>
            </div>
            <div>
              <span className="text-lg font-bold text-white block">100%</span>
              <span className="text-[11px] text-slate-400">traceability</span>
            </div>
            <div>
              <span className="text-lg font-bold text-white block">Role</span>
              <span className="text-[11px] text-slate-400">protected</span>
            </div>
          </div>
        </div>

        {/* Bottom Disclaimer Footer */}
        <p className="text-[10px] text-slate-500 z-10">
          Fictional platform &bull; Synthetic assessment data
        </p>

        {/* Subtle Background Glow */}
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Right Column - Login Form Box (01-login.png) */}
      <div className="lg:w-1/2 p-6 sm:p-12 flex items-center justify-center bg-[#F8FAFC]">
        <div className="w-full max-w-md bg-white p-8 sm:p-10 rounded-[22px] shadow-xl border border-slate-100 space-y-6">
          
          {/* Card Header */}
          <div className="space-y-4">
            <BrandLogo variant="regular" size="lg" align="left" />
            <div>
              <span className="text-[10px] font-bold tracking-widest text-[#0F766E] uppercase block">
                SECURE ACCESS
              </span>
              <h3 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">Welcome back</h3>
              <p className="text-xs text-slate-600 mt-1">Use your assigned account to continue.</p>
            </div>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Email Field */}
            <div className="space-y-1">
              <label htmlFor="email-input" className="block text-xs font-semibold text-slate-700">Email address</label>
              <input
                id="email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@atlaslogix.test"
                required
                className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
              />
            </div>

            {/* Password Field */}
            <div className="space-y-1">
              <label htmlFor="password-input" className="block text-xs font-semibold text-slate-700">Password</label>
              <input
                id="password-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full py-3 px-4 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign in'}
            </button>
          </form>

          {/* Quick Select Seed Accounts */}
          <div className="pt-4 border-t border-slate-100 space-y-2">
            <span className="block text-[10px] font-bold tracking-wider uppercase text-slate-600 text-center">
              Quick-Select Assessment Seed Role
            </span>
            <div className="grid grid-cols-1 gap-1.5">
              {SEED_USERS.map((u) => (
                <button
                  key={u.role}
                  type="button"
                  onClick={() => handleQuickSelect(u)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between border transition-all ${
                    email === u.email
                      ? 'bg-blue-50 border-blue-200 text-blue-800 font-semibold'
                      : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span>{u.role}</span>
                  {email === u.email && <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-600 text-center pt-1">
              Access is restricted to authorized assessment users.
            </p>
          </div>

        </div>
      </div>

    </div>
  );
}
