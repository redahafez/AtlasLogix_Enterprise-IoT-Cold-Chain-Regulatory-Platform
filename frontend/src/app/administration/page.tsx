'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { AppShell } from '@/components/AppShell';
import { Search, UserPlus, Shield, Info, CheckCircle2, Lock, MoreHorizontal } from 'lucide-react';

export default function AdministrationPage() {
  const { user, activeTenantId, switchTenant } = useAuth();
  const [searchTenant, setSearchTenant] = useState('');

  const usersList = [
    { name: 'Sarah Hassan', email: 'sarah.hassan@atlaslogix.test', initials: 'SH', role: 'Compliance Auditor', access: 'Approve · audit · sensors', status: 'Active' },
    { name: 'Omar Adel', email: 'omar.adel@atlaslogix.test', initials: 'OA', role: 'Operations Manager', access: 'Shipments · audit · sensors', status: 'Active' },
    { name: 'Mona Ibrahim', email: 'mona.ibrahim@atlaslogix.test', initials: 'MI', role: 'Warehouse Supervisor', access: 'Shipments · sensors', status: 'Active' },
    { name: 'Youssef Nabil', email: 'youssef.nabil@atlaslogix.test', initials: 'YN', role: 'Viewer', access: 'Read-only records', status: 'Inactive' },
  ];

  return (
    <AppShell>
      <div className="space-y-8 animate-fade-in">
        
        {/* Header (06-administration.png) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-bold tracking-widest text-[#2563EB] uppercase block">
              TENANT ADMINISTRATION
            </span>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight mt-0.5">
              Access management
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Manage tenant availability, user roles, and access without leaving the compliance workspace.
            </p>
          </div>

          <button
            type="button"
            className="px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 self-start sm:self-auto"
          >
            <UserPlus className="w-4 h-4" /> Invite tenant user
          </button>
        </div>

        {/* 2 Column Section (06-administration.png) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: Tenants List (1/3 width) */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-[#102B62] p-5 rounded-[14px] border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Tenants</h3>
                <p className="text-xs text-slate-400">2 accessible organizations</p>
              </div>

              {/* Search Tenants Input */}
              <div className="relative">
                <input
                  type="text"
                  value={searchTenant}
                  onChange={(e) => setSearchTenant(e.target.value)}
                  placeholder="Search tenants"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              </div>

              {/* Tenant Cards */}
              <div className="space-y-2.5">
                {user?.tenants.map((t) => {
                  const isSelected = t.tenantId === activeTenantId;
                  return (
                    <div
                      key={t.tenantId}
                      onClick={() => switchTenant(t.tenantId)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer space-y-1.5 ${
                        isSelected
                          ? 'bg-blue-50/60 dark:bg-blue-950/40 border-blue-400 text-blue-900 dark:text-blue-100 shadow-sm'
                          : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs block">{t.name}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                          Active
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 block font-mono">
                        {t.tenantId} &bull; {t.region}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Yellow Data Isolation Info Card */}
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 space-y-1">
              <span className="text-xs font-bold text-amber-800 dark:text-amber-300 block">
                Data isolation is enforced
              </span>
              <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                Users only see records for tenants granted through their membership.
              </p>
            </div>
          </div>

          {/* Right Column: Tenant Users Table (2/3 width) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white dark:bg-[#102B62] p-6 rounded-[14px] border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-5">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Tenant users</h3>
                <p className="text-xs text-slate-400">Roles control approval, audit, and operational access.</p>
              </div>

              {/* Users Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="pb-3 pr-4">USER</th>
                      <th className="pb-3 px-4">ROLE</th>
                      <th className="pb-3 px-4">ACCESS</th>
                      <th className="pb-3 px-4">STATUS</th>
                      <th className="pb-3 pl-4 text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {usersList.map((u) => (
                      <tr key={u.email} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-3.5 pr-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#2563EB] text-white font-bold text-xs flex items-center justify-center">
                              {u.initials}
                            </div>
                            <div>
                              <span className="font-bold text-slate-900 dark:text-white block">{u.name}</span>
                              <span className="text-[11px] text-slate-400 block font-mono">{u.email}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-700 dark:text-slate-300">
                          {u.role}
                        </td>
                        <td className="py-3.5 px-4 text-[11px] text-slate-500 dark:text-slate-400">
                          {u.access}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            u.status === 'Active'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}>
                            {u.status}
                          </span>
                        </td>
                        <td className="py-3.5 pl-4 text-right">
                          <button type="button" className="p-1 rounded text-slate-400 hover:text-slate-600">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Blue Info Banner at Bottom */}
              <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 space-y-1">
                <span className="text-xs font-bold text-blue-800 dark:text-blue-300 block">
                  Permission-aware controls
                </span>
                <p className="text-[11px] text-blue-700 dark:text-blue-400 leading-relaxed">
                  Only tenant administrators can change roles or deactivate access. Every change appears in the audit log.
                </p>
              </div>

            </div>
          </div>

        </div>

      </div>
    </AppShell>
  );
}
