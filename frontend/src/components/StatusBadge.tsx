'use client';

import React from 'react';
import { ShipmentStatus, ComplianceStatus } from '@/lib/types';
import { Truck, Warehouse, CheckCircle2, Clock, ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react';

interface StatusBadgeProps {
  type: 'status' | 'compliance';
  value: ShipmentStatus | ComplianceStatus | string;
}

export function StatusBadge({ type, value }: StatusBadgeProps) {
  if (type === 'status') {
    switch (value) {
      case 'IN_TRANSIT':
        return (
          <span className="badge badge-warning">
            <Truck className="w-3.5 h-3.5" /> In Transit
          </span>
        );
      case 'AT_WAREHOUSE':
        return (
          <span className="badge badge-neutral">
            <Warehouse className="w-3.5 h-3.5" /> At Warehouse
          </span>
        );
      case 'DELIVERED':
        return (
          <span className="badge badge-success">
            <CheckCircle2 className="w-3.5 h-3.5" /> Delivered
          </span>
        );
      case 'DELAYED':
        return (
          <span className="badge badge-negative">
            <Clock className="w-3.5 h-3.5" /> Delayed
          </span>
        );
      default:
        return <span className="badge badge-neutral">{value}</span>;
    }
  }

  // Compliance Status
  switch (value) {
    case 'APPROVED':
      return (
        <span className="badge badge-success">
          <ShieldCheck className="w-3.5 h-3.5" /> Approved
        </span>
      );
    case 'PENDING':
      return (
        <span className="badge badge-warning">
          <ShieldAlert className="w-3.5 h-3.5" /> Pending Review
        </span>
      );
    case 'REJECTED':
      return (
        <span className="badge badge-negative">
          <ShieldX className="w-3.5 h-3.5" /> Rejected
        </span>
      );
    default:
      return <span className="badge badge-neutral">{value}</span>;
  }
}
