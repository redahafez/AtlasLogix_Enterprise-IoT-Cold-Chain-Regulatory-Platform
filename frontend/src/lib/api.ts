import {
  AuthContext, TenantMembership, Shipment, SensorReading,
  ComplianceReport, AuditEntry, PaginatedShipments, APIError,
  TenantUser, CreateTenantUserData, UpdateTenantUserData
} from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

class APIClient {
  private token: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('atlaslogix_token');
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('atlaslogix_token', token);
      } else {
        localStorage.removeItem('atlaslogix_token');
      }
    }
  }

  getToken(): string | null {
    if (!this.token && typeof window !== 'undefined') {
      this.token = localStorage.getItem('atlaslogix_token');
    }
    return this.token;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    if (res.status === 204) {
      return null as T;
    }

    const data = await res.json().catch(() => ({ error: 'PARSE_ERROR', message: 'Failed to parse JSON response' }));

    if (!res.ok) {
      const error: APIError = {
        error: data.error || 'HTTP_ERROR',
        message: data.message || `HTTP ${res.status}: ${res.statusText}`,
        details: data.details,
      };
      throw error;
    }

    return data as T;
  }

  async login(email: string, password: string): Promise<AuthContext> {
    const res = await this.request<AuthContext>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (res.token) {
      this.setToken(res.token);
    }
    return res;
  }

  async getMe(): Promise<AuthContext> {
    return this.request<AuthContext>('/api/v1/auth/me');
  }

  async getTenants(): Promise<{ data: TenantMembership[] }> {
    return this.request<{ data: TenantMembership[] }>('/api/v1/tenants');
  }

  async getShipments(tenantId: string, params: Record<string, string | number> = {}): Promise<PaginatedShipments> {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        searchParams.append(k, String(v));
      }
    });
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return this.request<PaginatedShipments>(`/api/v1/tenants/${tenantId}/shipments${query}`);
  }

  async getShipmentDetail(shipmentId: string): Promise<Shipment> {
    return this.request<Shipment>(`/api/v1/shipments/${shipmentId}`);
  }

  async getLatestSensorData(shipmentId: string): Promise<SensorReading | null> {
    return this.request<SensorReading | null>(`/api/v1/shipments/${shipmentId}/sensor-data`);
  }

  async getSensorHistory(shipmentId: string, limit = 50): Promise<{ data: SensorReading[] }> {
    return this.request<{ data: SensorReading[] }>(`/api/v1/shipments/${shipmentId}/sensor-data/history?limit=${limit}`);
  }

  async approveCompliance(shipmentId: string, reason: string): Promise<Shipment> {
    return this.request<Shipment>(`/api/v1/shipments/${shipmentId}/compliance/approve`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async getComplianceReport(shipmentId: string): Promise<ComplianceReport> {
    return this.request<ComplianceReport>(`/api/v1/shipments/${shipmentId}/compliance/report`);
  }

  async getAuditLogs(entity: string, entityId: string): Promise<{ data: AuditEntry[] }> {
    return this.request<{ data: AuditEntry[] }>(`/api/v1/audit-logs?entity=${entity}&entityId=${entityId}`);
  }

  async createStreamTicket(tenantId: string): Promise<{ ticket: string; expiresAt: string; websocketUrl: string }> {
    return this.request<{ ticket: string; expiresAt: string; websocketUrl: string }>('/api/v1/stream/tickets', {
      method: 'POST',
      body: JSON.stringify({ tenantId }),
    });
  }

  async ingestTelemetry(
    payload: {
      eventId: string;
      shipmentId: string;
      temperature: number;
      humidity: number;
      vibration?: number | null;
      batteryLevel?: number | null;
      confidence: 'HIGH' | 'MEDIUM' | 'LOW';
      recordedAt: string;
    },
    deviceKey = 'atl_dev_lh-LVBJpRSznXuZKgqsT_dRyqeC1JVyh'
  ): Promise<{ eventId: string; accepted: boolean; replayed: boolean }> {
    return this.request<{ eventId: string; accepted: boolean; replayed: boolean }>('/api/v1/telemetry/readings', {
      method: 'POST',
      headers: {
        'X-Device-Key': deviceKey,
        'Idempotency-Key': payload.eventId,
      },
      body: JSON.stringify(payload),
    });
  }

  async getTenantUsers(
    tenantId: string,
    params: { search?: string; role?: string; status?: string } = {}
  ): Promise<{ data: TenantUser[]; count: number }> {
    const searchParams = new URLSearchParams();
    if (params.search) searchParams.append('search', params.search);
    if (params.role) searchParams.append('role', params.role);
    if (params.status) searchParams.append('status', params.status);
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return this.request<{ data: TenantUser[]; count: number }>(`/api/v1/tenants/${tenantId}/users${query}`);
  }

  async createTenantUser(
    tenantId: string,
    data: CreateTenantUserData
  ): Promise<{ data: TenantUser; message: string }> {
    return this.request<{ data: TenantUser; message: string }>(`/api/v1/tenants/${tenantId}/users`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTenantUser(
    tenantId: string,
    userId: string,
    data: UpdateTenantUserData
  ): Promise<{ data: TenantUser; message: string }> {
    return this.request<{ data: TenantUser; message: string }>(`/api/v1/tenants/${tenantId}/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async resetTenantUserPassword(
    tenantId: string,
    userId: string,
    password: string
  ): Promise<{ message: string; userId: string }> {
    return this.request<{ message: string; userId: string }>(`/api/v1/tenants/${tenantId}/users/${userId}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  }

  async deleteTenantUser(tenantId: string, userId: string): Promise<void> {
    return this.request<void>(`/api/v1/tenants/${tenantId}/users/${userId}`, {
      method: 'DELETE',
    });
  }
}

export const api = new APIClient();


