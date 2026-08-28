'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import { api } from '@/lib/api';
import {
  Shipment, SensorReading, ComplianceReport, AuditEntry
} from '@/lib/types';
import { AppShell } from '@/components/AppShell';
import { StatusBadge } from '@/components/StatusBadge';
import { SensorHistoryChart } from '@/components/SensorHistoryChart';
import { ComplianceApprovalModal } from '@/components/ComplianceApprovalModal';
import { useWebSocketStream, SensorEventPayload } from '@/lib/useWebSocketStream';
import {
  ArrowLeft, ShieldCheck, Thermometer, Droplets, Activity, Battery,
  Clock, MapPin, Truck, AlertTriangle, FileText, Lock, RefreshCw, UserCheck
} from 'lucide-react';

export default function ShipmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, activeTenantId, hasPermission, loading: authLoading } = useAuth();

  const shipmentId = params.id as string;

  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [latestReading, setLatestReading] = useState<SensorReading | null>(null);
  const [historyReadings, setHistoryReadings] = useState<SensorReading[]>([]);
  const [complianceReport, setComplianceReport] = useState<ComplianceReport | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);

  // Load all shipment detail data
  const loadData = useCallback(async () => {
    if (!shipmentId) return;

    setLoading(true);
    setErrorMsg(null);

    try {
      // 1. Shipment Detail
      const detail = await api.getShipmentDetail(shipmentId);
      setShipment(detail);

      // 2. Latest Sensor Reading
      const latest = await api.getLatestSensorData(shipmentId);
      setLatestReading(latest);

      // 3. Sensor History
      const historyRes = await api.getSensorHistory(shipmentId);
      setHistoryReadings(historyRes.data || []);

      // 4. Compliance Report
      const report = await api.getComplianceReport(shipmentId);
      setComplianceReport(report);

      // 5. Audit Logs (if permitted)
      try {
        const logsRes = await api.getAuditLogs('shipment', shipmentId);
        setAuditLogs(logsRes.data || []);
      } catch (e) {
        // Audit log read permission might be absent for warehouse supervisor
        setAuditLogs([]);
      }

    } catch (err: any) {
      if (err?.error === 'NOT_FOUND') {
        setErrorMsg('404 Not Found: Shipment does not exist or belongs to another tenant.');
      } else {
        setErrorMsg(err?.message || 'Failed to load shipment details.');
      }
    } finally {
      setLoading(false);
    }
  }, [shipmentId]);

  // Live sensor stream websocket handler
  const { connectionState } = useWebSocketStream(activeTenantId, useCallback((evt: SensorEventPayload) => {
    if (evt.shipmentId === shipmentId) {
      const newReading: SensorReading = {
        eventId: evt.eventId,
        shipmentId: evt.shipmentId,
        temperature: evt.payload.temperature,
        humidity: evt.payload.humidity,
        vibration: evt.payload.vibration,
        batteryLevel: evt.payload.batteryLevel,
        confidence: evt.payload.confidence,
        recordedAt: evt.recordedAt,
      };

      setLatestReading(newReading);
      setHistoryReadings(prev => {
        if (prev.some(r => r.eventId === newReading.eventId)) return prev;
        return [...prev, newReading];
      });

      // Update shipment last updated timestamp
      setShipment(prev => prev ? { ...prev, lastUpdated: evt.recordedAt } : prev);
    }
  }, [shipmentId]));

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    loadData();
  }, [authLoading, user, loadData, router]);

  if (authLoading || loading) {
    return (
      <AppShell socketStatus={connectionState}>
        <div className="p-12 text-center bg-[var(--color-bg-surface)] rounded-2xl border border-[var(--color-border-default)] space-y-3">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-[var(--color-text-secondary)]">Loading shipment {shipmentId} details...</p>
        </div>
      </AppShell>
    );
  }

  if (errorMsg || !shipment) {
    return (
      <AppShell socketStatus={connectionState}>
        <div className="p-12 text-center bg-[var(--color-bg-surface)] rounded-2xl border border-[var(--color-border-default)] space-y-4 max-w-lg mx-auto">
          <div className="p-3 bg-rose-500/10 text-rose-500 rounded-full w-fit mx-auto">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold">Access Error</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">{errorMsg || 'Shipment record unavailable.'}</p>
          <Link
            href="/shipments"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-500 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Return to Shipments List
          </Link>
        </div>
      </AppShell>
    );
  }

  const isAuditor = hasPermission('compliance:approve');
  const isApprovable = shipment.complianceStatus === 'PENDING' && !shipment.lockedAt;

  return (
    <AppShell socketStatus={connectionState}>
      <div className="space-y-6">

        {/* Back Link & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/shipments"
              className="p-2 rounded-xl bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-subtle)] transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Back to Shipments List"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)] font-mono">
                  {shipment.shipmentId}
                </h1>
                <StatusBadge type="status" value={shipment.status} />
                <StatusBadge type="compliance" value={shipment.complianceStatus} />
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                Tracking Ref: <span className="font-mono">{shipment.trackingReference}</span> &bull; Tenant: <span className="font-semibold">{shipment.tenantId}</span>
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              className="p-2 rounded-xl bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-subtle)] transition-colors"
              title="Refresh Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* Auditor Approval Action Button */}
            {isAuditor && (
              <button
                onClick={() => setIsApprovalModalOpen(true)}
                disabled={!isApprovable}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all ${
                  isApprovable
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white focus:ring-2 focus:ring-emerald-400'
                    : 'bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                {shipment.complianceStatus === 'APPROVED' ? 'Compliance Approved & Locked' :
                 shipment.complianceStatus === 'REJECTED' ? 'Compliance Rejected' :
                 'Approve Compliance'}
              </button>
            )}
          </div>
        </div>

        {/* Overview & Live Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Required Specs Card */}
          <div className="p-5 bg-[var(--color-bg-surface)] rounded-2xl border border-[var(--color-border-default)] shadow-sm space-y-2">
            <span className="text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider block">
              Required Specs
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400">
                {shipment.requiredTemperatureMin}°C to {shipment.requiredTemperatureMax}°C
              </span>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Humidity: {shipment.requiredHumidityMin}% - {shipment.requiredHumidityMax}% RH
            </p>
          </div>

          {/* Latest Temperature Reading */}
          <div className="p-5 bg-[var(--color-bg-surface)] rounded-2xl border border-[var(--color-border-default)] shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">
                Latest Temp
              </span>
              <Thermometer className="w-4 h-4 text-blue-500" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono">
                {latestReading ? `${latestReading.temperature}°C` : 'N/A'}
              </span>
              {latestReading && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  latestReading.temperature < shipment.requiredTemperatureMin || latestReading.temperature > shipment.requiredTemperatureMax
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {latestReading.temperature < shipment.requiredTemperatureMin || latestReading.temperature > shipment.requiredTemperatureMax ? 'Excursion' : 'Nominal'}
                </span>
              )}
            </div>
            <p className="text-[11px] text-[var(--color-text-secondary)] font-mono">
              {latestReading ? new Date(latestReading.recordedAt).toLocaleTimeString() : 'No readings'}
            </p>
          </div>

          {/* Latest Humidity Reading */}
          <div className="p-5 bg-[var(--color-bg-surface)] rounded-2xl border border-[var(--color-border-default)] shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">
                Latest Humidity
              </span>
              <Droplets className="w-4 h-4 text-teal-500" />
            </div>
            <span className="text-2xl font-bold font-mono">
              {latestReading ? `${latestReading.humidity}%` : 'N/A'}
            </span>
            <p className="text-[11px] text-[var(--color-text-secondary)]">
              Vibration: {latestReading?.vibration ? `${latestReading.vibration}g` : 'Nominal'}
            </p>
          </div>

          {/* Device Battery & Sensor Confidence */}
          <div className="p-5 bg-[var(--color-bg-surface)] rounded-2xl border border-[var(--color-border-default)] shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">
                Sensor Battery &amp; Confidence
              </span>
              <Battery className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold font-mono">
                {latestReading?.batteryLevel !== null && latestReading?.batteryLevel !== undefined ? `${latestReading.batteryLevel}%` : '100%'}
              </span>
              {latestReading && (
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  latestReading.confidence === 'HIGH' ? 'bg-emerald-100 text-emerald-800' :
                  latestReading.confidence === 'MEDIUM' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  {latestReading.confidence} CONFIDENCE
                </span>
              )}
            </div>
            <p className="text-[11px] text-[var(--color-text-secondary)]">
              Warehouse: <span className="font-semibold">{shipment.warehouse}</span>
            </p>
          </div>

        </div>

        {/* Cargo & Logistics Details Grid */}
        <div className="p-6 bg-[var(--color-bg-surface)] rounded-2xl border border-[var(--color-border-default)] shadow-sm space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
            Logistics &amp; Cargo Overview
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-[var(--color-text-secondary)] font-medium block">Cargo Description</span>
              <span className="font-bold text-sm text-[var(--color-text-primary)]">{shipment.cargoType}</span>
            </div>
            <div>
              <span className="text-[var(--color-text-secondary)] font-medium block">Logistics Carrier</span>
              <span className="font-semibold text-sm flex items-center gap-1">
                <Truck className="w-4 h-4 text-slate-400" /> {shipment.carrier}
              </span>
            </div>
            <div>
              <span className="text-[var(--color-text-secondary)] font-medium block">Origin Location</span>
              <span className="font-semibold text-sm flex items-center gap-1">
                <MapPin className="w-4 h-4 text-slate-400" /> {shipment.origin}
              </span>
            </div>
            <div>
              <span className="text-[var(--color-text-secondary)] font-medium block">Destination Warehouse</span>
              <span className="font-semibold text-sm flex items-center gap-1">
                <MapPin className="w-4 h-4 text-blue-500" /> {shipment.destination}
              </span>
            </div>
          </div>
        </div>

        {/* Historical Telemetry Chart Section */}
        <div className="p-6 bg-[var(--color-bg-surface)] rounded-2xl border border-[var(--color-border-default)] shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-secondary)] flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-500" /> Telemetry History &amp; Thresholds
            </h3>
            <span className="text-xs text-[var(--color-text-secondary)] font-mono">
              {historyReadings.length} Total Telemetry Events
            </span>
          </div>

          <SensorHistoryChart shipment={shipment} readings={historyReadings} />
        </div>

        {/* Compliance Evidence & Audit Timeline Split */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Computed Compliance Evidence */}
          <div className="p-6 bg-[var(--color-bg-surface)] rounded-2xl border border-[var(--color-border-default)] shadow-sm space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-secondary)] flex items-center gap-2">
              <FileText className="w-4 h-4 text-teal-500" /> Compliance Evidence Report
            </h3>

            {complianceReport && (
              <div className="space-y-3 text-xs">
                <div className="p-3.5 rounded-xl bg-[var(--color-bg-subtle)] border border-[var(--color-border-default)] space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Temperature Excursion:</span>
                    <span className={`font-bold px-2 py-0.5 rounded ${complianceReport.hasTemperatureExcursion ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>
                      {complianceReport.hasTemperatureExcursion ? 'DETECTED ⚠️' : 'NONE ✅'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Humidity Excursion:</span>
                    <span className={`font-bold px-2 py-0.5 rounded ${complianceReport.hasHumidityExcursion ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>
                      {complianceReport.hasHumidityExcursion ? 'DETECTED ⚠️' : 'NONE ✅'}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 text-[11px] space-y-1">
                  <span className="font-bold block">Compliance Invariant Rule:</span>
                  <p>
                    Sensor excursions and low confidence are authoritative evidence for human auditor judgment; they do not trigger automatic rejection or API approval rules.
                  </p>
                </div>

                {shipment.lockedAt && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 flex items-center gap-2">
                    <Lock className="w-4 h-4 shrink-0" />
                    <span>Decision Locked on {new Date(shipment.lockedAt).toLocaleString()} by {shipment.approvedBy || 'Auditor'}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Authoritative Audit Timeline */}
          <div className="p-6 bg-[var(--color-bg-surface)] rounded-2xl border border-[var(--color-border-default)] shadow-sm space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-secondary)] flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-500" /> Audit History Timeline
            </h3>

            {auditLogs.length === 0 ? (
              <p className="text-xs text-[var(--color-text-secondary)] py-4 text-center">No audit trail records found for this shipment.</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {auditLogs.map((log) => (
                  <div key={log.auditId} className="p-3 rounded-xl bg-[var(--color-bg-subtle)] border border-[var(--color-border-default)] text-xs space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-blue-600 dark:text-blue-400 font-mono">{log.field}</span>
                      <span className="text-[10px] text-[var(--color-text-secondary)] font-mono">{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="text-[11px]">
                      Changed from <code className="bg-slate-200 dark:bg-slate-800 px-1 rounded">{log.before || 'null'}</code> to <code className="bg-slate-200 dark:bg-slate-800 px-1 rounded">{log.after}</code>
                    </p>
                    {log.reason && (
                      <p className="text-[11px] italic text-[var(--color-text-secondary)] border-l-2 border-purple-400 pl-2 mt-1">
                        &quot;{log.reason}&quot;
                      </p>
                    )}
                    <span className="text-[10px] font-semibold text-slate-500 block text-right">
                      Actor: {log.actorUserId || 'System'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Auditor Approval Modal */}
      {shipment && (
        <ComplianceApprovalModal
          shipment={shipment}
          isOpen={isApprovalModalOpen}
          onClose={() => setIsApprovalModalOpen(false)}
          onSuccess={() => loadData()}
        />
      )}
    </AppShell>
  );
}
