'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Shipment } from '@/lib/types';
import { api } from '@/lib/api';
import { ShieldCheck, AlertCircle, X, Loader2 } from 'lucide-react';

interface ComplianceApprovalModalProps {
  shipment: Shipment;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedShipment: Shipment) => void;
}

export function ComplianceApprovalModal({
  shipment,
  isOpen,
  onClose,
  onSuccess,
}: ComplianceApprovalModalProps) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setErrorMsg(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 10) {
      setErrorMsg('Reason must be at least 10 characters long.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const updated = await api.approveCompliance(shipment.shipmentId, reason.trim());
      onSuccess(updated);
      onClose();
    } catch (err: any) {
      if (err?.error === 'CONFLICT') {
        setErrorMsg('Conflict (409): Shipment is already approved, rejected, or locked.');
      } else if (err?.error === 'FORBIDDEN') {
        setErrorMsg('Permission Denied (403): You lack compliance:approve permissions.');
      } else {
        setErrorMsg(err?.message || 'Failed to submit compliance approval.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-lg bg-[var(--color-bg-surface)] rounded-2xl border border-[var(--color-border-default)] shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 bg-[var(--dark-start)] text-white border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 id="modal-title" className="text-lg font-bold">Approve Compliance</h3>
              <p className="text-xs text-slate-400">Shipment {shipment.shipmentId}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Close Dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content & Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Summary Box */}
          <div className="p-4 rounded-xl bg-[var(--color-bg-subtle)] border border-[var(--color-border-default)] space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-[var(--color-text-secondary)] font-medium">Cargo Type:</span>
              <span className="font-semibold">{shipment.cargoType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--color-text-secondary)] font-medium">Route:</span>
              <span className="font-semibold">{shipment.origin} &rarr; {shipment.destination}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--color-text-secondary)] font-medium">Required Temp Range:</span>
              <span className="font-semibold">{shipment.requiredTemperatureMin}°C to {shipment.requiredTemperatureMax}°C</span>
            </div>
          </div>

          {/* Error Alert */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Reason Input */}
          <div className="space-y-2">
            <label htmlFor="approval-reason" className="block text-xs font-bold text-[var(--color-text-primary)]">
              Auditor Decision Rationale <span className="text-rose-500">*</span>
            </label>
            <textarea
              id="approval-reason"
              ref={inputRef}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="State the evidence and rationale for approving this shipment (minimum 10 characters)..."
              rows={4}
              required
              minLength={10}
              maxLength={1000}
              className="w-full p-3 text-xs rounded-xl bg-[var(--color-bg-canvas)] border border-[var(--color-border-default)] focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <p className="text-[11px] text-[var(--color-text-secondary)] text-right font-mono">
              {reason.length}/1000 chars (min 10)
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-[var(--color-border-default)]">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || reason.trim().length < 10}
              className="flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Confirm Approval
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
