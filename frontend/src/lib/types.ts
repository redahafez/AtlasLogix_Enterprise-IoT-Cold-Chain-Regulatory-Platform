export type Role =
  | 'TENANT_ADMIN'
  | 'COMPLIANCE_AUDITOR'
  | 'OPERATIONS_MANAGER'
  | 'WAREHOUSE_SUPERVISOR'
  | 'VIEWER';

export type ShipmentStatus = 'IN_TRANSIT' | 'AT_WAREHOUSE' | 'DELIVERED' | 'DELAYED';

export type ComplianceStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface TenantMembership {
  tenantId: string;
  name: string;
  region: string;
  role: Role;
  permissions: string[];
}

export interface AuthContext {
  token?: string;
  email: string;
  userId: string;
  tenantId: string;
  role: Role;
  permissions: string[];
  tenants: TenantMembership[];
}

export interface Shipment {
  shipmentId: string;
  tenantId: string;
  trackingReference: string;
  origin: string;
  destination: string;
  carrier: string;
  cargoType: string;
  status: ShipmentStatus;
  complianceStatus: ComplianceStatus;
  warehouse: string;
  requiredTemperatureMin: number;
  requiredTemperatureMax: number;
  requiredHumidityMin: number;
  requiredHumidityMax: number;
  estimatedArrival: string | null;
  lastUpdated: string;
  lockedAt: string | null;
  approvedBy: string | null;
}

export interface SensorReading {
  eventId: string;
  shipmentId: string;
  temperature: number;
  humidity: number;
  vibration?: number | null;
  batteryLevel?: number | null;
  confidence: ConfidenceLevel;
  recordedAt: string;
}

export interface ComplianceReport {
  shipmentId: string;
  complianceStatus: ComplianceStatus;
  latestReading: SensorReading | null;
  sensorEventCount: number;
  hasTemperatureExcursion: boolean;
  hasHumidityExcursion: boolean;
  generatedAt: string;
}

export interface AuditEntry {
  auditId: string;
  tenantId: string;
  entity: string;
  entityId: string;
  field: string;
  before: string | null;
  after: string | null;
  actorUserId: string | null;
  reason: string | null;
  timestamp: string;
}

export interface PaginatedShipments {
  count: number;
  page: number;
  pageSize: number;
  results: Shipment[];
}

export interface APIError {
  error: string;
  message: string;
  details?: Record<string, any>;
}
