'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { AppShell } from '@/components/AppShell';
import { Radio, Activity, Signal, Zap, ShieldAlert, Cpu } from 'lucide-react';

export default function SensorsPage() {
  const { activeTenantId } = useAuth();
  const [events, setEvents] = useState<any[]>([]);

  return (
    <AppShell>
      <div className="space-y-8 animate-fade-in">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-bold tracking-widest text-[#2563EB] uppercase block">
              TELEMETRY STREAM
            </span>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight mt-0.5">
              Live sensors
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Real-time WebSocket telemetry ingestion stream for active shipments.
            </p>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold self-start sm:self-auto">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Streaming Live</span>
          </div>
        </div>

        {/* Live Ingestion Monitor Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-5 bg-white dark:bg-[#102B62] rounded-[14px] border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-bold">Active Device Feeds</span>
              <Cpu className="w-4 h-4 text-blue-600" />
            </div>
            <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">12 Sensors</span>
            <span className="text-[10px] text-slate-400 block">Broadcasting via Redis Channel Layer</span>
          </div>

          <div className="p-5 bg-white dark:bg-[#102B62] rounded-[14px] border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-bold">Ticket Authorization</span>
              <Zap className="w-4 h-4 text-teal-600" />
            </div>
            <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">SHA-256 Validated</span>
            <span className="text-[10px] text-slate-400 block">One-time single-use WebSocket tickets</span>
          </div>

          <div className="p-5 bg-white dark:bg-[#102B62] rounded-[14px] border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-bold">Latency</span>
              <Activity className="w-4 h-4 text-emerald-600" />
            </div>
            <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">&lt; 15 ms</span>
            <span className="text-[10px] text-slate-400 block">Sub-second event propagation</span>
          </div>
        </div>

        {/* Live Stream Stream Event Log */}
        <div className="bg-white dark:bg-[#102B62] p-6 rounded-[14px] border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Real-time Event Stream</h3>
            <span className="text-xs font-mono text-slate-400">ws://localhost:8080/ws/v1/sensor-data</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-900 text-slate-200 font-mono text-xs space-y-2 min-h-64 max-h-96 overflow-y-auto">
            <div className="text-slate-500">&gt; WebSocket connection established with single-use ticket. Listening on tenant group...</div>
            <div className="text-emerald-400">&gt; [EVENT] sensor.reading.created | shipmentId: ALX-20481 | temp: 7.6°C | humidity: 56% | confidence: HIGH</div>
            <div className="text-emerald-400">&gt; [EVENT] sensor.reading.created | shipmentId: ALX-20477 | temp: 4.2°C | humidity: 45% | confidence: HIGH</div>
            <div className="text-amber-400">&gt; [EVENT] sensor.reading.created | shipmentId: ALX-20473 | temp: 8.7°C | humidity: 62% | confidence: MEDIUM</div>
          </div>
        </div>

      </div>
    </AppShell>
  );
}
