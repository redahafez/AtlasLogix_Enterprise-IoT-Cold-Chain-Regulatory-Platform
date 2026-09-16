'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { api } from '@/lib/api';
import { Shipment, PaginatedShipments } from '@/lib/types';
import { AppShell } from '@/components/AppShell';
import { StatusBadge } from '@/components/StatusBadge';
import { ArrowRight, Package, Truck, CheckCircle2, AlertTriangle, RefreshCw, Shield, Users, Lock } from 'lucide-react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

export default function OverviewPage() {
  const router = useRouter();
  const { user, activeTenantId, loading: authLoading } = useAuth();
  const [shipmentsData, setShipmentsData] = useState<PaginatedShipments | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (activeTenantId) {
      setLoading(true);
      api.getShipments(activeTenantId, { page_size: 20 })
        .then(data => setShipmentsData(data))
        .catch(() => setShipmentsData(null))
        .finally(() => setLoading(false));
    }
  }, [authLoading, user, activeTenantId, router]);

  if (authLoading || loading) {
    return (
      <AppShell>
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-100 space-y-3">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500">Loading operations overview...</p>
        </div>
      </AppShell>
    );
  }

  const results = shipmentsData?.results || [];
  const totalCount = shipmentsData?.count || results.length;
  const inTransitCount = results.filter(s => s.status === 'IN_TRANSIT').length;
  const approvedCount = results.filter(s => s.complianceStatus === 'APPROVED').length;
  const needsAttentionCount = results.filter(s => s.complianceStatus === 'PENDING' || s.complianceStatus === 'REJECTED').length;

  const chartData = {
    labels: ['Approved', 'Other'],
    datasets: [
      {
        data: [approvedCount, Math.max(0, totalCount - approvedCount)],
        backgroundColor: ['#168A68', '#FFE8D1'],
        borderWidth: 0,
      },
    ],
  };

  return (
    <AppShell>
      <div className="space-y-8 animate-fade-in">
        
        {/* Page Header (02-dashboard.png) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-bold tracking-widest text-[#2563EB] uppercase">
              OPERATIONS OVERVIEW
            </span>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight mt-0.5">
              Compliance command center
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Monitor active shipments and prioritize records requiring review.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => {
                if (activeTenantId) {
                  setLoading(true);
                  api.getShipments(activeTenantId, { page_size: 20 })
                    .then(data => setShipmentsData(data))
                    .catch(() => setShipmentsData(null))
                    .finally(() => setLoading(false));
                }
              }}
              disabled={loading}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5"
              title="Refresh overview metrics"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-500' : ''}`} />
            </button>

            <Link
              href="/shipments"
              className="px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2"
            >
              Review shipments <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* 4 Top Metric Cards (02-dashboard.png) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          
          {/* Card 1: Total Shipments */}
          <div className="p-5 bg-white dark:bg-[#102B62] rounded-[14px] border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400 font-bold flex items-center justify-center text-sm shrink-0">
              S
            </div>
            <div>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">Total shipments</span>
              <span className="text-2xl font-bold text-slate-900 dark:text-white font-mono">{totalCount}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Across selected tenant</span>
            </div>
          </div>

          {/* Card 2: In Transit */}
          <div className="p-5 bg-white dark:bg-[#102B62] rounded-[14px] border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 dark:bg-teal-950 dark:text-teal-400 font-bold flex items-center justify-center text-sm shrink-0">
              T
            </div>
            <div>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">In transit</span>
              <span className="text-2xl font-bold text-slate-900 dark:text-white font-mono">{inTransitCount}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Currently moving</span>
            </div>
          </div>

          {/* Card 3: Approved */}
          <div className="p-5 bg-white dark:bg-[#102B62] rounded-[14px] border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 font-bold flex items-center justify-center text-sm shrink-0">
              A
            </div>
            <div>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">Approved</span>
              <span className="text-2xl font-bold text-slate-900 dark:text-white font-mono">{approvedCount}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Compliance locked</span>
            </div>
          </div>

          {/* Card 4: Needs Attention */}
          <div className="p-5 bg-white dark:bg-[#102B62] rounded-[14px] border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400 font-bold flex items-center justify-center text-sm shrink-0">
              !
            </div>
            <div>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">Needs attention</span>
              <span className="text-2xl font-bold text-slate-900 dark:text-white font-mono">{needsAttentionCount}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Pending or rejected</span>
            </div>
          </div>

        </div>

        {/* 2 Column Split View (02-dashboard.png) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column (Recently updated - 2/3 width) */}
          <div className="lg:col-span-2 bg-white dark:bg-[#102B62] p-6 rounded-[14px] border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Recently updated</h3>
                <p className="text-xs text-slate-400">Latest operational records</p>
              </div>
              <Link href="/shipments" className="text-xs font-bold text-[#2563EB] hover:underline">
                View all
              </Link>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {results.slice(0, 5).map((s) => (
                <div
                  key={s.shipmentId}
                  onClick={() => router.push(`/shipments?shipmentId=${s.shipmentId}`)}
                  className="py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 px-2 rounded-xl transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-slate-800 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                      <Package className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-mono font-bold text-xs text-slate-900 dark:text-white block">{s.shipmentId}</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">{s.origin} &rarr; {s.destination}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <StatusBadge type="compliance" value={s.complianceStatus} />
                    <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
                      {new Date(s.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column (Compliance distribution Donut Chart - 1/3 width) */}
          <div className="bg-white dark:bg-[#102B62] p-6 rounded-[14px] border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Compliance distribution</h3>
              <p className="text-xs text-slate-400">Current status mix</p>
            </div>

            <div className="relative w-48 h-48 mx-auto my-4 flex items-center justify-center">
              <Doughnut
                data={chartData}
                options={{
                  cutout: '75%',
                  plugins: { legend: { display: false } },
                }}
              />
              <div className="absolute text-center">
                <span className="text-3xl font-bold font-mono text-slate-900 dark:text-white block">{totalCount}</span>
                <span className="text-[10px] font-semibold text-slate-400 uppercase">Total</span>
              </div>
            </div>

            <div className="flex items-center justify-around pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#168A68]" />
                <span className="text-slate-600 dark:text-slate-300">Approved</span>
                <span className="font-bold">{approvedCount}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#FFE8D1]" />
                <span className="text-slate-600 dark:text-slate-300">Other</span>
                <span className="font-bold">{totalCount - approvedCount}</span>
              </div>
            </div>
          </div>

        </div>

        {/* Access Governance & Team Provisioning Quick Access Banner */}
        <div className="p-6 bg-gradient-to-r from-blue-900/90 to-indigo-950/90 text-white rounded-[16px] border border-blue-800/60 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-blue-500/20 text-blue-300 border border-blue-400/30 shrink-0">
              <Shield className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="text-base font-bold text-white">Access Governance & User Provisioning</h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Live RBAC
                </span>
              </div>
              <p className="text-xs text-blue-200/80 max-w-xl leading-relaxed">
                Manage operational staff, assign role permissions, reset user credentials, and enforce data isolation across your active tenant organization.
              </p>
            </div>
          </div>

          <Link
            href="/administration"
            className="px-5 py-2.5 rounded-xl bg-white text-[#0f172a] hover:bg-blue-50 font-bold text-xs shadow-md transition-all flex items-center gap-2 shrink-0 self-start md:self-auto"
          >
            <Users className="w-4 h-4 text-blue-600" /> Manage team access
          </Link>
        </div>

      </div>
    </AppShell>
  );
}

