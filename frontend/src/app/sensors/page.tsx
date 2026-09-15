'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { AppShell } from '@/components/AppShell';
import { useWebSocketStream, SensorEventPayload } from '@/lib/useWebSocketStream';
import { api } from '@/lib/api';
import {
  Radio, Activity, Signal, Zap, AlertTriangle, ShieldCheck,
  Send, RotateCcw, Flame, Snowflake, BatteryCharging, CheckCircle2,
  Clock, Hash, ArrowUpRight
} from 'lucide-react';

interface LiveEventRecord extends SensorEventPayload {
  receivedLocalTime: string;
}

export default function SensorsPage() {
  const { activeTenantId } = useAuth();
  
  // Real-time events list
  const [liveEvents, setLiveEvents] = useState<LiveEventRecord[]>([]);
  const [lastEmittedEventId, setLastEmittedEventId] = useState<string | null>(null);
  const [lastEmittedPayload, setLastEmittedPayload] = useState<any>(null);
  
  // Simulator State
  const [selectedShipment, setSelectedShipment] = useState<string>('ALX-20481');
  const [temperature, setTemperature] = useState<number>(4.8);
  const [humidity, setHumidity] = useState<number>(46);
  const [batteryLevel, setBatteryLevel] = useState<number>(94);
  const [confidence, setConfidence] = useState<'HIGH' | 'MEDIUM' | 'LOW'>('HIGH');
  
  // UI Status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'replay' | 'error'; text: string } | null>(null);

  // Hook into WebSocket stream
  const handleIncomingSensorEvent = (event: SensorEventPayload) => {
    const record: LiveEventRecord = {
      ...event,
      receivedLocalTime: new Date().toLocaleTimeString(),
    };
    setLiveEvents(prev => [record, ...prev.slice(0, 49)]);
  };

  const { connectionState, latestEvent } = useWebSocketStream(activeTenantId, handleIncomingSensorEvent);

  // Send new telemetry reading
  const handleBroadcastTelemetry = async (isReplay = false) => {
    setIsSubmitting(true);
    setFeedbackMessage(null);

    try {
      const eventId = isReplay && lastEmittedEventId 
        ? lastEmittedEventId 
        : `evt-sim-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      
      const payload = isReplay && lastEmittedPayload ? {
        ...lastEmittedPayload,
      } : {
        eventId,
        shipmentId: selectedShipment,
        temperature: Number(temperature),
        humidity: Number(humidity),
        batteryLevel: Number(batteryLevel),
        confidence,
        recordedAt: new Date().toISOString(),
      };

      const res = await api.ingestTelemetry(payload);

      setLastEmittedEventId(eventId);
      setLastEmittedPayload(payload);

      if (res.replayed) {
        setFeedbackMessage({
          type: 'replay',
          text: `Idempotency Verified: Event ${eventId} replayed without duplicate persistence (200 OK).`
        });
      } else {
        setFeedbackMessage({
          type: 'success',
          text: `Event ${eventId} ingested and broadcasted through Redis layer (202 Accepted).`
        });
      }
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err?.message || 'Failed to broadcast telemetry'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Preset Handlers
  const applyPreset = (temp: number, hum: number, conf: 'HIGH' | 'MEDIUM' | 'LOW') => {
    setTemperature(temp);
    setHumidity(hum);
    setConfidence(conf);
  };

  return (
    <AppShell>
      <div className="space-y-8 animate-fade-in pb-12">
        
        {/* Header with Connection Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-bold tracking-widest text-[#2563EB] uppercase block">
              REAL-TIME TELEMETRY &amp; WEBSOCKETS
            </span>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight mt-0.5">
              Live sensors &amp; Simulator
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Broadcast, stream, and verify live cold-chain telemetry events via Redis Channel Layer and WebSockets.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold ${
              connectionState === 'live' 
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                : connectionState === 'connecting'
                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}>
              <span className={`w-2.5 h-2.5 rounded-full ${
                connectionState === 'live' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`} />
              <span className="capitalize">{connectionState === 'live' ? 'WebSocket Live' : connectionState}</span>
            </div>
          </div>
        </div>

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-5 bg-white dark:bg-[#102B62] rounded-[14px] border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-bold">Stream Events Captured</span>
              <Activity className="w-4 h-4 text-blue-600" />
            </div>
            <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
              {liveEvents.length} Events
            </span>
            <span className="text-[10px] text-slate-400 block">Deduplicated in-memory by eventId</span>
          </div>

          <div className="p-5 bg-white dark:bg-[#102B62] rounded-[14px] border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-bold">Latest Reading Status</span>
              <Zap className="w-4 h-4 text-teal-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
                {liveEvents[0] ? `${liveEvents[0].payload.temperature.toFixed(1)}°C` : 'Standby'}
              </span>
              {liveEvents[0] && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  liveEvents[0].payload.temperature > 8 
                    ? 'bg-rose-100 text-rose-700' 
                    : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {liveEvents[0].payload.temperature > 8 ? 'EXCURSION' : 'NORMAL'}
                </span>
              )}
            </div>
            <span className="text-[10px] text-slate-400 block">
              {liveEvents[0] ? `Shipment ${liveEvents[0].shipmentId}` : 'Awaiting incoming telemetry'}
            </span>
          </div>

          <div className="p-5 bg-white dark:bg-[#102B62] rounded-[14px] border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-bold">Transport Layer</span>
              <Radio className="w-4 h-4 text-emerald-600" />
            </div>
            <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">Redis Pub/Sub</span>
            <span className="text-[10px] text-slate-400 block">Channels 4 + Daphne ASGI Gateway</span>
          </div>
        </div>

        {/* Interactive Telemetry Dispatcher Panel */}
        <div className="bg-white dark:bg-[#102B62] rounded-[16px] border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/20">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Send className="w-4 h-4 text-blue-600" />
                Live Sensor Simulator (Hardware Device Emulation)
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Trigger synthetic sensor readings with device authentication headers to test real-time WebSocket delivery.
              </p>
            </div>
            <span className="text-[10px] font-mono bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-1 rounded-md font-semibold">
              X-Device-Key Protected
            </span>
          </div>

          <div className="p-6 space-y-6">
            
            {/* Quick Scenario Buttons */}
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                Quick Scenarios:
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => applyPreset(4.5, 45, 'HIGH')}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-colors"
                >
                  <Snowflake className="w-3.5 h-3.5 text-emerald-600" />
                  Normal Cold Chain (4.5°C)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset(12.5, 68, 'HIGH')}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100 transition-colors"
                >
                  <Flame className="w-3.5 h-3.5 text-rose-600" />
                  Thermal Excursion Alert (12.5°C)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset(19.2, 75, 'MEDIUM')}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 transition-colors"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  Critical Heat Spike (19.2°C)
                </button>
                <button
                  type="button"
                  onClick={() => { setBatteryLevel(14); setConfidence('LOW'); }}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <BatteryCharging className="w-3.5 h-3.5 text-slate-600" />
                  Low Battery Warning (14%)
                </button>
              </div>
            </div>

            {/* Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Target Shipment
                </label>
                <select
                  value={selectedShipment}
                  onChange={(e) => setSelectedShipment(e.target.value)}
                  className="w-full text-xs font-mono font-medium py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="ALX-20481">ALX-20481 (Pending Approval)</option>
                  <option value="ALX-20477">ALX-20477 (Approved &amp; Locked)</option>
                  <option value="ALX-20473">ALX-20473 (Rejected Audit)</option>
                  <option value="ALX-20468">ALX-20468 (No Sensor History)</option>
                  <option value="ALX-20459">ALX-20459 (Low Confidence)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Temperature (°C)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="w-full text-xs font-mono py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <span className="absolute right-3 top-2 text-xs font-bold text-slate-400">°C</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Humidity (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={humidity}
                    onChange={(e) => setHumidity(parseInt(e.target.value, 10))}
                    className="w-full text-xs font-mono py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <span className="absolute right-3 top-2 text-xs font-bold text-slate-400">%</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Battery Level
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={batteryLevel}
                    onChange={(e) => setBatteryLevel(parseInt(e.target.value, 10))}
                    className="w-full text-xs font-mono py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <span className="absolute right-3 top-2 text-xs font-bold text-slate-400">%</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Confidence
                </label>
                <select
                  value={confidence}
                  onChange={(e) => setConfidence(e.target.value as any)}
                  className="w-full text-xs font-bold py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="HIGH">HIGH (Full Sensor Integrity)</option>
                  <option value="MEDIUM">MEDIUM (Moderate Variance)</option>
                  <option value="LOW">LOW (Sensor Drift / Degradation)</option>
                </select>
              </div>
            </div>

            {/* Actions & Feedback */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleBroadcastTelemetry(false)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-blue-500/20 disabled:opacity-50 transition-all cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  {isSubmitting ? 'Broadcasting...' : 'Broadcast Telemetry Reading'}
                </button>

                {lastEmittedEventId && (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleBroadcastTelemetry(true)}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                    title="Resend previous event with identical Idempotency-Key to test 200 Replayed response"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Test Idempotent Retry (Replay)
                  </button>
                )}
              </div>

              {feedbackMessage && (
                <div className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 font-medium ${
                  feedbackMessage.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : feedbackMessage.type === 'replay'
                    ? 'bg-blue-50 text-blue-800 border border-blue-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}>
                  {feedbackMessage.type === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                  {feedbackMessage.type === 'replay' && <RotateCcw className="w-3.5 h-3.5 text-blue-600" />}
                  {feedbackMessage.type === 'error' && <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />}
                  <span>{feedbackMessage.text}</span>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Live Stream Table & Event Log */}
        <div className="bg-white dark:bg-[#102B62] rounded-[16px] border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-600" />
                Live Ingested Telemetry Feed
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Incoming readings streamed dynamically over WebSocket channel (<code className="font-mono text-[10px]">ws://localhost:8080/ws/v1/sensor-data</code>)
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400">
              Showing last {liveEvents.length} events
            </span>
          </div>

          {liveEvents.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800/60 flex items-center justify-center mx-auto text-slate-400">
                <Radio className="w-6 h-6 animate-pulse text-blue-500" />
              </div>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                WebSocket is connected and listening on the current tenant group.
              </p>
              <p className="text-[11px] text-slate-400">
                Use the simulator panel above or send a reading via API to see live events appear here in real time.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 dark:bg-slate-900/40 text-slate-500 text-[10px] uppercase font-bold tracking-wider border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-6">Event ID</th>
                    <th className="py-3 px-4">Shipment</th>
                    <th className="py-3 px-4">Temperature</th>
                    <th className="py-3 px-4">Humidity</th>
                    <th className="py-3 px-4">Battery</th>
                    <th className="py-3 px-4">Confidence</th>
                    <th className="py-3 px-6 text-right">Received</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                  {liveEvents.map((evt, idx) => (
                    <tr 
                      key={evt.eventId} 
                      className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors ${
                        idx === 0 ? 'bg-blue-50/20 dark:bg-blue-900/10' : ''
                      }`}
                    >
                      <td className="py-3 px-6 font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                        {idx === 0 && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />}
                        <span>{evt.eventId}</span>
                      </td>
                      <td className="py-3 px-4 text-blue-600 font-bold">
                        {evt.shipmentId}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                          evt.payload.temperature > 8 
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300' 
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                        }`}>
                          {evt.payload.temperature.toFixed(1)}°C
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                        {evt.payload.humidity}%
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                        {evt.payload.batteryLevel !== undefined ? `${evt.payload.batteryLevel}%` : 'N/A'}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[10px] font-bold text-slate-500">
                          {evt.payload.confidence}
                        </span>
                      </td>
                      <td className="py-3 px-6 text-right text-slate-400 text-[11px]">
                        {evt.receivedLocalTime}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </AppShell>
  );
}
