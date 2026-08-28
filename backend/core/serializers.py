from rest_framework import serializers
from core.models import (
    User, Tenant, TenantMembership, Shipment, SensorReading, AuditEntry, ROLE_PERMISSIONS
)

class TenantMembershipSerializer(serializers.ModelSerializer):
    tenantId = serializers.CharField(source='tenant.tenant_id')
    name = serializers.CharField(source='tenant.name')
    region = serializers.CharField(source='tenant.region')
    role = serializers.CharField()
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = TenantMembership
        fields = ['tenantId', 'name', 'region', 'role', 'permissions']

    def get_permissions(self, obj):
        return ROLE_PERMISSIONS.get(obj.role, [])


class UserAuthContextSerializer(serializers.Serializer):
    email = serializers.EmailField()
    userId = serializers.CharField(source='user_id')
    tenantId = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()
    permissions = serializers.SerializerMethodField()
    tenants = serializers.SerializerMethodField()

    def get_tenantId(self, obj):
        active_tenant = self.context.get('active_tenant_id')
        memberships = obj.memberships.all()
        if active_tenant and memberships.filter(tenant_id=active_tenant).exists():
            return active_tenant
        if memberships.exists():
            return memberships.first().tenant_id
        return None

    def get_role(self, obj):
        tenant_id = self.get_tenantId(obj)
        if tenant_id:
            m = obj.memberships.filter(tenant_id=tenant_id).first()
            if m:
                return m.role
        return None

    def get_permissions(self, obj):
        role = self.get_role(obj)
        return ROLE_PERMISSIONS.get(role, []) if role else []

    def get_tenants(self, obj):
        return TenantMembershipSerializer(obj.memberships.all(), many=True).data


class ShipmentSerializer(serializers.ModelSerializer):
    shipmentId = serializers.CharField(source='shipment_id')
    tenantId = serializers.CharField(source='tenant.tenant_id')
    trackingReference = serializers.CharField(source='tracking_reference')
    cargoType = serializers.CharField(source='cargo_type')
    complianceStatus = serializers.CharField(source='compliance_status')
    requiredTemperatureMin = serializers.FloatField(source='required_temperature_min')
    requiredTemperatureMax = serializers.FloatField(source='required_temperature_max')
    requiredHumidityMin = serializers.IntegerField(source='required_humidity_min')
    requiredHumidityMax = serializers.IntegerField(source='required_humidity_max')
    estimatedArrival = serializers.DateTimeField(source='estimated_arrival', allow_null=True)
    lastUpdated = serializers.DateTimeField(source='last_updated')
    lockedAt = serializers.DateTimeField(source='locked_at', allow_null=True)
    approvedBy = serializers.SerializerMethodField()

    class Meta:
        model = Shipment
        fields = [
            'shipmentId', 'tenantId', 'trackingReference', 'origin', 'destination',
            'carrier', 'cargoType', 'status', 'complianceStatus', 'warehouse',
            'requiredTemperatureMin', 'requiredTemperatureMax',
            'requiredHumidityMin', 'requiredHumidityMax',
            'estimatedArrival', 'lastUpdated', 'lockedAt', 'approvedBy'
        ]

    def get_approvedBy(self, obj):
        return obj.approved_by.user_id if obj.approved_by else None


class SensorReadingSerializer(serializers.ModelSerializer):
    eventId = serializers.CharField(source='event_id')
    shipmentId = serializers.CharField(source='shipment.shipment_id')
    batteryLevel = serializers.IntegerField(source='battery_level', allow_null=True, required=False)
    recordedAt = serializers.DateTimeField(source='recorded_at')

    class Meta:
        model = SensorReading
        fields = [
            'eventId', 'shipmentId', 'temperature', 'humidity',
            'vibration', 'batteryLevel', 'confidence', 'recordedAt'
        ]


class AuditEntrySerializer(serializers.ModelSerializer):
    auditId = serializers.CharField(source='audit_id')
    tenantId = serializers.CharField(source='tenant.tenant_id')
    entityId = serializers.CharField(source='entity_id')
    actorUserId = serializers.SerializerMethodField()

    class Meta:
        model = AuditEntry
        fields = [
            'auditId', 'tenantId', 'entity', 'entityId', 'field',
            'before', 'after', 'actorUserId', 'reason', 'timestamp'
        ]

    def get_actorUserId(self, obj):
        return obj.actor_user.user_id if obj.actor_user else None


class ComplianceReportSerializer(serializers.Serializer):
    shipmentId = serializers.CharField()
    complianceStatus = serializers.CharField()
    latestReading = SensorReadingSerializer(allow_null=True)
    sensorEventCount = serializers.IntegerField()
    hasTemperatureExcursion = serializers.BooleanField()
    hasHumidityExcursion = serializers.BooleanField()
    generatedAt = serializers.DateTimeField()
