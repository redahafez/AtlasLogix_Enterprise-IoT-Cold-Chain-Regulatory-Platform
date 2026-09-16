from django.urls import path
from core.views import (
    HealthLiveView, HealthReadyView, LoginView, AuthMeView, TenantsListView,
    ShipmentListView, ShipmentDetailView, ShipmentLatestSensorView, ShipmentSensorHistoryView,
    ComplianceApproveView, ComplianceReportView, AuditLogsView, StreamTicketView,
    TelemetryIngestionView, TenantUsersListView, TenantUserDetailView, TenantUserResetPasswordView
)

urlpatterns = [
    # Health checks
    path('health/live', HealthLiveView.as_view(), name='health-live'),
    path('health/ready', HealthReadyView.as_view(), name='health-ready'),

    # Auth
    path('api/v1/auth/login', LoginView.as_view(), name='auth-login'),
    path('api/v1/auth/me', AuthMeView.as_view(), name='auth-me'),

    # Tenants
    path('api/v1/tenants', TenantsListView.as_view(), name='tenants-list'),
    path('api/v1/tenants/<str:tenantId>/shipments', ShipmentListView.as_view(), name='shipments-list'),

    # Shipments
    path('api/v1/shipments/<str:shipmentId>', ShipmentDetailView.as_view(), name='shipment-detail'),
    path('api/v1/shipments/<str:shipmentId>/sensor-data', ShipmentLatestSensorView.as_view(), name='shipment-latest-sensor'),
    path('api/v1/shipments/<str:shipmentId>/sensor-data/history', ShipmentSensorHistoryView.as_view(), name='shipment-sensor-history'),

    # Compliance
    path('api/v1/shipments/<str:shipmentId>/compliance/approve', ComplianceApproveView.as_view(), name='compliance-approve'),
    path('api/v1/shipments/<str:shipmentId>/compliance/report', ComplianceReportView.as_view(), name='compliance-report'),

    # Audit
    path('api/v1/audit-logs', AuditLogsView.as_view(), name='audit-logs'),

    # Stream Tickets
    path('api/v1/stream/tickets', StreamTicketView.as_view(), name='stream-tickets'),

    # Telemetry Ingestion
    path('api/v1/telemetry/readings', TelemetryIngestionView.as_view(), name='telemetry-readings'),

    # User Management
    path('api/v1/tenants/<str:tenantId>/users', TenantUsersListView.as_view(), name='tenant-users-list'),
    path('api/v1/tenants/<str:tenantId>/users/<str:userId>', TenantUserDetailView.as_view(), name='tenant-user-detail'),
    path('api/v1/tenants/<str:tenantId>/users/<str:userId>/reset-password', TenantUserResetPasswordView.as_view(), name='tenant-user-reset-password'),
]

