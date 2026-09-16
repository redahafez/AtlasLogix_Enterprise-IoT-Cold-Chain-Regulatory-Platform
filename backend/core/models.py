from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.utils import timezone

class UserManager(BaseUserManager):
    def create_user(self, email, password=None, user_id=None, **extra_fields):
        if not email:
            raise ValueError('The Email field must be set')
        email = self.normalize_email(email)
        user_id = user_id or f"user-{email.split('@')[0]}"
        user = self.model(email=email, user_id=user_id, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, user_id=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(email, password, user_id=user_id or 'admin', **extra_fields)


class Tenant(models.Model):
    tenant_id = models.CharField(max_length=64, primary_key=True)
    name = models.CharField(max_length=255)
    region = models.CharField(max_length=64)
    created_at = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return f"{self.name} ({self.tenant_id})"


class User(AbstractBaseUser, PermissionsMixin):
    user_id = models.CharField(max_length=64, primary_key=True)
    email = models.EmailField(unique=True)
    username = models.CharField(max_length=150, blank=True, default='')
    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    date_joined = models.DateTimeField(default=timezone.now)

    groups = models.ManyToManyField(
        'auth.Group',
        related_name='core_user_set',
        blank=True,
        help_text='The groups this user belongs to.',
        related_query_name='core_user',
    )
    user_permissions = models.ManyToManyField(
        'auth.Permission',
        related_name='core_user_permissions_set',
        blank=True,
        help_text='Specific permissions for this user.',
        related_query_name='core_user',
    )

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    def __str__(self):
        return f"{self.email} ({self.user_id})"


class Role(models.TextChoices):
    TENANT_ADMIN = 'TENANT_ADMIN', 'Tenant Administrator'
    COMPLIANCE_AUDITOR = 'COMPLIANCE_AUDITOR', 'Compliance Auditor'
    OPERATIONS_MANAGER = 'OPERATIONS_MANAGER', 'Operations Manager'
    WAREHOUSE_SUPERVISOR = 'WAREHOUSE_SUPERVISOR', 'Warehouse Supervisor'
    VIEWER = 'VIEWER', 'Viewer'


ROLE_PERMISSIONS = {
    Role.TENANT_ADMIN: ["shipments:read", "sensor-data:read", "compliance:read", "audit-logs:read", "sensor-stream:read", "users:read", "users:write", "users:delete"],
    Role.COMPLIANCE_AUDITOR: ["shipments:read", "sensor-data:read", "compliance:read", "compliance:approve", "audit-logs:read", "sensor-stream:read"],
    Role.OPERATIONS_MANAGER: ["shipments:read", "sensor-data:read", "compliance:read", "audit-logs:read", "sensor-stream:read"],
    Role.WAREHOUSE_SUPERVISOR: ["shipments:read", "sensor-data:read", "compliance:read", "sensor-stream:read"],
    Role.VIEWER: ["shipments:read", "sensor-data:read", "compliance:read", "audit-logs:read"],
}


class TenantMembership(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='memberships')
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='memberships')
    role = models.CharField(max_length=32, choices=Role.choices)

    class Meta:
        unique_together = ('user', 'tenant')

    @property
    def permissions(self):
        return ROLE_PERMISSIONS.get(self.role, [])

    def __str__(self):
        return f"{self.user.email} -> {self.tenant.tenant_id} ({self.role})"


class Device(models.Model):
    device_id = models.CharField(max_length=64, primary_key=True)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='devices')
    device_key = models.CharField(max_length=128, unique=True, db_index=True)

    def __str__(self):
        return f"{self.device_id} ({self.tenant.tenant_id})"


class ShipmentStatus(models.TextChoices):
    IN_TRANSIT = 'IN_TRANSIT', 'In Transit'
    AT_WAREHOUSE = 'AT_WAREHOUSE', 'At Warehouse'
    DELIVERED = 'DELIVERED', 'Delivered'
    DELAYED = 'DELAYED', 'Delayed'


class ComplianceStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending'
    APPROVED = 'APPROVED', 'Approved'
    REJECTED = 'REJECTED', 'Rejected'


class Shipment(models.Model):
    shipment_id = models.CharField(max_length=64, primary_key=True)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='shipments', db_index=True)
    tracking_reference = models.CharField(max_length=64)
    origin = models.CharField(max_length=255)
    destination = models.CharField(max_length=255)
    carrier = models.CharField(max_length=255)
    cargo_type = models.CharField(max_length=255)
    status = models.CharField(max_length=32, choices=ShipmentStatus.choices)
    compliance_status = models.CharField(max_length=32, choices=ComplianceStatus.choices, default=ComplianceStatus.PENDING)
    warehouse = models.CharField(max_length=255)
    required_temperature_min = models.FloatField()
    required_temperature_max = models.FloatField()
    required_humidity_min = models.IntegerField()
    required_humidity_max = models.IntegerField()
    estimated_arrival = models.DateTimeField(null=True, blank=True)
    last_updated = models.DateTimeField(db_index=True)
    locked_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_shipments')

    class Meta:
        ordering = ['-last_updated']

    def __str__(self):
        return f"{self.shipment_id} - {self.status} ({self.tenant.tenant_id})"


class ConfidenceLevel(models.TextChoices):
    HIGH = 'HIGH', 'High'
    MEDIUM = 'MEDIUM', 'Medium'
    LOW = 'LOW', 'Low'


class SensorReading(models.Model):
    event_id = models.CharField(max_length=64, primary_key=True)
    shipment = models.ForeignKey(Shipment, on_delete=models.CASCADE, related_name='sensor_readings', db_index=True)
    temperature = models.FloatField()
    humidity = models.IntegerField()
    vibration = models.FloatField(null=True, blank=True)
    battery_level = models.IntegerField(null=True, blank=True)
    confidence = models.CharField(max_length=16, choices=ConfidenceLevel.choices)
    recorded_at = models.DateTimeField(db_index=True)
    payload_hash = models.CharField(max_length=64, blank=True, default='')

    class Meta:
        ordering = ['recorded_at']

    def __str__(self):
        return f"{self.event_id} ({self.shipment_id}): {self.temperature}°C, {self.humidity}%"


class AuditEntry(models.Model):
    audit_id = models.CharField(max_length=64, primary_key=True)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='audit_entries', db_index=True)
    entity = models.CharField(max_length=32, default='shipment')
    entity_id = models.CharField(max_length=64, db_index=True)
    field = models.CharField(max_length=64)
    before = models.TextField(null=True, blank=True)
    after = models.TextField(null=True, blank=True)
    actor_user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='audit_actions')
    reason = models.TextField(null=True, blank=True)
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.audit_id}: {self.entity} {self.entity_id} {self.field} by {self.actor_user_id}"


class StreamTicket(models.Model):
    ticket_hash = models.CharField(max_length=64, primary_key=True)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    expires_at = models.DateTimeField(db_index=True)
    consumed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    def is_valid(self):
        return self.consumed_at is None and self.expires_at > timezone.now()

    def __str__(self):
        return f"Ticket for {self.user.email} on {self.tenant.tenant_id}"
