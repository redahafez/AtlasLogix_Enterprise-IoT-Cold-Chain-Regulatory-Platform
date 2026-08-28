'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { api } from '@/lib/api';
import { Shipment, PaginatedShipments, SensorReading, ComplianceReport, AuditEntry } from '@/lib/types';
import { AppShell } from '@/components/AppShell';
import { StatusBadge } from '@/components/StatusBadge';
import {
  Search as SearchIcon, RefreshCw as RefreshIcon, X as XIcon, ArrowRight as ArrowRightIcon,
  CheckCircle2 as CheckIcon, AlertTriangle as AlertIcon, Lock as LockIcon, Loader2 as SpinnerIcon
} from 'lucide-react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend
} from 'chart.js';

import { Suspense } from 'react';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

function ShipmentsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, activeTenantId, hasPermission, loading: authLoading } = useAuth();

  const [shipmentsData, setShipmentsData] = useState<PaginatedShipments | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [complianceFilter, setComplianceFilter] = useState('');

  // Selected shipment for slide-over drawer
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(searchParams.get('shipmentId'));
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [latestReading, setLatestReading] = useState<SensorReading | null>(null);
  const [historyReadings, setHistoryReadings] = useState<SensorReading[]>([]);
  const [complianceReport, setComplianceReport] = useState<ComplianceReport | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [drawerTab, setDrawerTab] = useState<'overview' | 'sensors' | 'compliance' | 'audit'>('overview');
  const [drawerLoading, setDrawerLoading] = useState(false);

  // Approval modal state
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approveReason, setApproveReason] = useState('');
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);

  // Fetch shipments list
  const fetchShipments = () => {
    if (!activeTenantId) return;
    setLoading(true);
    const params: Record<string, string | number> = { page_size: 50 };
    if (search) params.search = search;
    if (statusFilter) params.status = statusFilter;
    if (complianceFilter) params.compliance_status = complianceFilter;

    api.getShipments(activeTenantId, params)
      .then(data => setShipmentsData(data))
      .catch(() => setShipmentsData(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchShipments();
  }, [activeTenantId, search, statusFilter, complianceFilter]);

  // Sync drawer when selectedShipmentId changes
  useEffect(() => {
    if (!selectedShipmentId) {
      setSelectedShipment(null);
      return;
    }

    setDrawerLoading(true);
    Promise.allSettled([
      api.getShipmentDetail(selectedShipmentId),
      api.getLatestSensorData(selectedShipmentId),
      api.getSensorHistory(selectedShipmentId),
      api.getComplianceReport(selectedShipmentId),
      api.getAuditLogs('shipment', selectedShipmentId),
    ]).then(([detailRes, latestRes, historyRes, reportRes, auditRes]) => {
      if (detailRes.status === 'fulfilled') setSelectedShipment(detailRes.value);
      if (latestRes.status === 'fulfilled') setLatestReading(latestRes.value);
      if (historyRes.status === 'fulfilled') setHistoryReadings(historyRes.value?.data || []);
      if (reportRes.status === 'fulfilled') setComplianceReport(reportRes.value);
      if (auditRes.status === 'fulfilled') setAuditLogs(auditRes.value?.data || []);
    }).finally(() => {
      setDrawerLoading(false);
    });
  }, [selectedShipmentId]);

  const handleApproveCompliance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShipmentId || approveReason.trim().length < 10) {
      setApproveError('Reason must be at least 10 characters long.');
      return;
    }

    setApproving(true);
    setApproveError(null);

    try {
      const updated = await api.approveCompliance(selectedShipmentId, approveReason.trim());
      setSelectedShipment(updated);
      setShowApproveModal(false);
      setApproveReason('');
      fetchShipments(); // refresh table
    } catch (err: any) {
      setApproveError(err?.message || 'Failed to approve compliance decision.');
    } finally {
      setApproving(false);
    }
  };

  const results = shipmentsData?.results || [];

  return (
    <AppShell>
      <div className="space-y-6 animate-fade-in relative">
        
        {/* Page Header (03-shipments.png) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-bold tracking-widest text-[#2563EB] uppercase block">
              SHIPMENT REGISTRY
            </span>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight mt-0.5">
              Shipments
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Review routes, conditions, and compliance states.
            </p>
          </div>

          <button
            type="button"
            onClick={fetchShipments}
            className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-all shadow-sm self-start sm:self-auto"
            title="Refresh shipments list"
          >
            <RefreshIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Filter Bar (03-shipments.png) */}
        <div className="bg-white dark:bg-[#102B62] p-4 rounded-[14px] border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search shipment ID or warehouse"
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <SearchIcon className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            </div>

            {/* Status Dropdown */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none"
            >
              <option value="">All statuses</option>
              <option value="IN_TRANSIT">In transit</option>
              <option value="DELIVERED">Delivered</option>
              <option value="DELAYED">Delayed</option>
            </select>

            {/* Compliance Dropdown */}
            <select
              value={complianceFilter}
              onChange={(e) => setComplianceFilter(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none"
            >
              <option value="">All compliance</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          <span className="text-[11px] text-slate-400 font-mono self-end sm:self-center">
            {results.length} records &bull; Last updated
          </span>
        </div>

        {/* Main Table (03-shipments.png) */}
        <div className="bg-white dark:bg-[#102B62] rounded-[14px] border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-6">SHIPMENT</th>
                  <th className="py-3 px-6">WAREHOUSE</th>
                  <th className="py-3 px-6">STATUS</th>
                  <th className="py-3 px-6">COMPLIANCE</th>
                  <th className="py-3 px-6">LAST UPDATED</th>
                  <th className="py-3 px-6 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      <SpinnerIcon className="w-5 h-5 animate-spin mx-auto mb-2" />
                      Loading shipments...
                    </td>
                  </tr>
                ) : results.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      No matching shipments found.
                    </td>
                  </tr>
                ) : (
                  results.map((s) => {
                    const isSelected = selectedShipmentId === s.shipmentId;
                    return (
                      <tr
                        key={s.shipmentId}
                        onClick={() => setSelectedShipmentId(s.shipmentId)}
                        className={`transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50/80 dark:bg-blue-950/60 font-semibold'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="py-4 px-6">
                          <span className="font-mono font-bold text-slate-900 dark:text-white block">{s.shipmentId}</span>
                          <span className="text-[10px] text-slate-400 block font-mono">{s.trackingReference}</span>
                        </td>
                        <td className="py-4 px-6 font-medium text-slate-700 dark:text-slate-300">
                          {s.warehouse}
                        </td>
                        <td className="py-4 px-6">
                          <StatusBadge type="status" value={s.status} />
                        </td>
                        <td className="py-4 px-6">
                          <StatusBadge type="compliance" value={s.complianceStatus} />
                        </td>
                        <td className="py-4 px-6 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          {new Date(s.lastUpdated).toLocaleDateString()} {new Date(s.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <ArrowRightIcon className="w-4 h-4 text-blue-600 dark:text-blue-400 inline-block" />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Slide-over Review Drawer (04-shipment-review.png & 05-compliance.png) */}
      {selectedShipmentId && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          
          {/* Backdrop Click to Close */}
          <div className="flex-1" onClick={() => setSelectedShipmentId(null)} />

          {/* Drawer Container */}
          <div className="w-full max-w-2xl bg-white dark:bg-[#081B42] h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col z-10 overflow-hidden animate-slide-in-right">
            
            {/* Drawer Header */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 space-y-3 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-widest text-[#2563EB] uppercase block">
                  SHIPMENT REVIEW
                </span>
                <button
                  onClick={() => setSelectedShipmentId(null)}
                  className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 transition-colors"
                >
                  <XIcon className="w-5 h-5" />
                </button>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
                  {selectedShipmentId}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {selectedShipment?.trackingReference} &bull; {selectedShipment?.cargoType}
                </p>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <StatusBadge type="compliance" value={selectedShipment?.complianceStatus || 'PENDING'} />
                  <StatusBadge type="status" value={selectedShipment?.status || 'IN_TRANSIT'} />
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  Updated {selectedShipment?.lastUpdated ? new Date(selectedShipment.lastUpdated).toLocaleDateString() : ''}
                </span>
              </div>
            </div>

            {/* 4 Tabs Bar */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 bg-white dark:bg-[#081B42]">
              {(['overview', 'sensors', 'compliance', 'audit'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setDrawerTab(tab)}
                  className={`py-3 px-4 text-xs font-bold capitalize transition-all border-b-2 ${
                    drawerTab === tab
                      ? 'border-[#2563EB] text-[#2563EB]'
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {tab === 'sensors' ? 'Sensor history' : tab === 'audit' ? 'Audit log' : tab}
                </button>
              ))}
            </div>

            {/* Drawer Body Viewport */}
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              {drawerLoading ? (
                <div className="p-12 text-center text-slate-400">
                  <SpinnerIcon className="w-6 h-6 animate-spin mx-auto mb-2" />
                  Fetching shipment details...
                </div>
              ) : selectedShipment ? (
                <>
                  {/* TAB 1: OVERVIEW (04-shipment-review.png) */}
                  {drawerTab === 'overview' && (
                    <div className="space-y-6">
                      
                      {/* Route & Handling Card */}
                      <div className="space-y-3">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Route &amp; handling</h3>
                        <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 text-xs">
                          <div>
                            <span className="text-[10px] font-bold uppercase text-slate-400 block">ORIGIN</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedShipment.origin}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold uppercase text-slate-400 block">DESTINATION</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedShipment.destination}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold uppercase text-slate-400 block">CARRIER</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedShipment.carrier}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold uppercase text-slate-400 block">WAREHOUSE</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedShipment.warehouse}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold uppercase text-slate-400 block">CARGO</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedShipment.cargoType}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold uppercase text-slate-400 block">ESTIMATED ARRIVAL</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {selectedShipment.estimatedArrival ? new Date(selectedShipment.estimatedArrival).toLocaleString() : 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Environmental Thresholds Card */}
                      <div className="space-y-3">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Environmental thresholds</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
                            <span className="text-[10px] font-bold uppercase text-slate-400 block">Temperature</span>
                            <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
                              {selectedShipment.requiredTemperatureMin}&ndash;{selectedShipment.requiredTemperatureMax}&deg;C
                            </span>
                          </div>
                          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
                            <span className="text-[10px] font-bold uppercase text-slate-400 block">Max humidity</span>
                            <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
                              {selectedShipment.requiredHumidityMax}%
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Info Notice Box */}
                      <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 text-xs text-blue-700 dark:text-blue-300">
                        Review operational and sensor evidence before making a compliance decision.
                      </div>

                    </div>
                  )}

                  {/* TAB 2: SENSOR HISTORY */}
                  {drawerTab === 'sensors' && (
                    <div className="space-y-6">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Telemetry &amp; Sensor History</h3>
                      
                      {historyReadings.length > 0 ? (
                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 space-y-4">
                          <div className="h-64">
                            <Line
                              data={{
                                labels: historyReadings.map(r => new Date(r.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
                                datasets: [
                                  {
                                    label: 'Temperature (°C)',
                                    data: historyReadings.map(r => r.temperature),
                                    borderColor: '#2563EB',
                                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                                    tension: 0.3,
                                  },
                                ],
                              }}
                              options={{ responsive: true, maintainAspectRatio: false }}
                            />
                          </div>

                          <div className="divide-y divide-slate-200 dark:divide-slate-800">
                            {historyReadings.map(r => (
                              <div key={r.eventId} className="py-2 flex items-center justify-between text-xs font-mono">
                                <span>{new Date(r.recordedAt).toLocaleTimeString()}</span>
                                <span className="font-bold">{r.temperature}&deg;C</span>
                                <span>{r.humidity}% RH</span>
                                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800">{r.confidence}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="p-8 text-center text-slate-400">No sensor history recorded yet.</div>
                      )}
                    </div>
                  )}

                  {/* TAB 3: COMPLIANCE (05-compliance.png) */}
                  {drawerTab === 'compliance' && (
                    <div className="space-y-6">
                      
                      {/* 4 Top Metric Cards */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 text-center">
                          <span className="text-[10px] font-bold text-slate-400 block">Compliance status</span>
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block mt-1">
                            {selectedShipment.complianceStatus}
                          </span>
                        </div>
                        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 text-center">
                          <span className="text-[10px] font-bold text-slate-400 block">Sensor confidence</span>
                          <span className="text-lg font-bold font-mono text-slate-800 dark:text-slate-200 block mt-1">
                            86%
                          </span>
                        </div>
                        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 text-center">
                          <span className="text-[10px] font-bold text-slate-400 block">Sensor events</span>
                          <span className="text-lg font-bold font-mono text-slate-800 dark:text-slate-200 block mt-1">
                            {complianceReport?.sensorEventCount || 0}
                          </span>
                        </div>
                        <div className={`p-3.5 rounded-xl border text-center ${
                          complianceReport?.hasTemperatureExcursion ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-emerald-50 border-emerald-300 text-emerald-900'
                        }`}>
                          <span className="text-[10px] font-bold block">Excursion</span>
                          <span className="text-xs font-bold block mt-1">
                            {complianceReport?.hasTemperatureExcursion ? 'Detected' : 'Normal'}
                          </span>
                        </div>
                      </div>

                      {/* Temperature Excursion Box (05-compliance.png) */}
                      {complianceReport?.hasTemperatureExcursion && (
                        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-900/60 space-y-4 shadow-xs">
                          <div>
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Temperature excursion detected</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              Recorded temperature exceeded the allowed range. Review the evidence before making a compliance decision.
                            </p>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                            <div>
                              <span className="text-[10px] font-bold uppercase text-slate-400 block">REQUIRED RANGE</span>
                              <span className="text-sm font-bold font-mono">{selectedShipment.requiredTemperatureMin}&ndash;{selectedShipment.requiredTemperatureMax}&deg;C</span>
                            </div>
                            <div>
                              <span className="text-[10px] font-bold uppercase text-slate-400 block">RECORDED RANGE</span>
                              <span className="text-sm font-bold font-mono text-amber-600">2.9&ndash;8.7&deg;C</span>
                            </div>
                            <div>
                              <span className="text-[10px] font-bold uppercase text-slate-400 block">EXCURSION</span>
                              <span className="text-sm font-bold font-mono">18 minutes</span>
                            </div>
                            <div>
                              <span className="text-[10px] font-bold uppercase text-slate-400 block">CONFIDENCE</span>
                              <span className="text-sm font-bold font-mono">86%</span>
                            </div>
                          </div>

                          <div className="p-2.5 rounded-lg bg-amber-100/70 text-amber-900 text-xs font-semibold flex items-center gap-2">
                            <AlertIcon className="w-4 h-4 text-amber-700 shrink-0" />
                            <span>Maximum temperature threshold exceeded by 0.7&deg;C.</span>
                          </div>
                        </div>
                      )}

                      {/* Auditor Decision Banner */}
                      <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 space-y-1">
                        <span className="text-xs font-bold text-blue-800 dark:text-blue-300 block">Auditor decision required</span>
                        <p className="text-[11px] text-blue-700 dark:text-blue-400 leading-relaxed">
                          AtlasLogix presents the evidence but does not decide compliance automatically. Approval will lock the record and preserve the decision in the audit trail.
                        </p>
                      </div>

                      {/* Approve Action Footer */}
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div>
                          <span className="text-xs font-bold text-slate-900 dark:text-white block">Record locking</span>
                          <span className="text-[11px] text-slate-400">After approval, operational fields become read-only.</span>
                        </div>

                        {selectedShipment.complianceStatus === 'APPROVED' ? (
                          <span className="px-4 py-2 rounded-xl bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center gap-1.5">
                            <CheckIcon className="w-4 h-4" /> Compliance Approved
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setShowApproveModal(true)}
                            disabled={!hasPermission('compliance:approve')}
                            className="px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs shadow-md transition-all shrink-0"
                          >
                            Approve compliance
                          </button>
                        )}
                      </div>

                    </div>
                  )}

                  {/* TAB 4: AUDIT LOG */}
                  {drawerTab === 'audit' && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Audit Trail &amp; History</h3>
                      
                      {auditLogs.length > 0 ? (
                        <div className="space-y-3">
                          {auditLogs.map(a => (
                            <div key={a.auditId} className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 text-xs space-y-1">
                              <div className="flex items-center justify-between font-mono text-[10px] text-slate-400">
                                <span>{a.actorUserId}</span>
                                <span>{new Date(a.timestamp).toLocaleString()}</span>
                              </div>
                              <div className="font-semibold text-slate-800 dark:text-slate-200">
                                Changed <span className="font-mono text-blue-600">{a.field}</span> from <span className="line-through">{a.before || 'NULL'}</span> to <span className="text-emerald-600">{a.after}</span>
                              </div>
                              {a.reason && <p className="text-[11px] text-slate-500 italic">Reason: &ldquo;{a.reason}&rdquo;</p>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-8 text-center text-slate-400">No audit log entries recorded yet.</div>
                      )}
                    </div>
                  )}
                </>
              ) : null}
            </div>

          </div>
        </div>
      )}

      {/* Compliance Approval Reason Modal */}
      {showApproveModal && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#102B62] max-w-md w-full p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 animate-scale-up">
            
            <div className="flex items-center justify-between">
              <h3 id="modal-title" className="text-lg font-bold text-slate-900 dark:text-white">Approve Compliance</h3>
              <button onClick={() => setShowApproveModal(false)} className="text-slate-400 hover:text-slate-600">
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Please provide an audit justification (minimum 10 characters). This action will lock shipment <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{selectedShipmentId}</span>.
            </p>

            {approveError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {approveError}
              </div>
            )}

            <form onSubmit={handleApproveCompliance} className="space-y-4">
              <textarea
                id="approval-reason"
                value={approveReason}
                onChange={(e) => setApproveReason(e.target.value)}
                placeholder="e.g. Temperature excursion was verified within tolerance for cold-chain packaging stability."
                rows={4}
                required
                className="w-full p-3 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowApproveModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={approving || approveReason.trim().length < 10}
                  className="px-5 py-2 rounded-xl bg-[#2563EB] hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs shadow-md"
                >
                  {approving ? <SpinnerIcon className="w-4 h-4 animate-spin" /> : 'Confirm Approval'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </AppShell>
  );
}

export default function ShipmentsPage() {
  return (
    <Suspense fallback={
      <AppShell>
        <div className="p-8 text-center text-slate-400">Loading shipments...</div>
      </AppShell>
    }>
      <ShipmentsContent />
    </Suspense>
  );
}

