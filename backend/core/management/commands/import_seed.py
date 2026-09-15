import json
import os
import hashlib
from datetime import datetime
from pathlib import Path
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from core.models import (
    Tenant, User, TenantMembership, Device, Shipment, SensorReading, AuditEntry, ComplianceStatus
)

def parse_iso_datetime(dt_str):
    if not dt_str:
        return None
    return datetime.fromisoformat(dt_str.replace('Z', '+00:00'))

def compute_telemetry_hash(shipment_id, temperature, humidity, vibration, battery_level, confidence, recorded_at_str):
    payload_data = {
        'shipmentId': shipment_id,
        'temperature': float(temperature),
        'humidity': int(humidity),
        'vibration': float(vibration) if vibration is not None else None,
        'batteryLevel': int(battery_level) if battery_level is not None else None,
        'confidence': str(confidence),
        'recordedAt': recorded_at_str,
    }
    return hashlib.sha256(json.dumps(payload_data, sort_keys=True).encode()).hexdigest()


class Command(BaseCommand):
    help = 'Import seed data idempotently from JSON file'

    def add_arguments(self, parser):
        parser.add_argument(
            'json_file',
            nargs='?',
            type=str,
            default='',
            help='Path to seed JSON file'
        )

    def handle(self, *args, **options):
        file_path = options['json_file']
        
        if not file_path or not os.path.exists(file_path):
            candidates = [
                os.path.join(os.getcwd(), 'AtlasLogix_Fullstack_Seed_Data.json'),
                os.path.join(os.path.dirname(os.getcwd()), 'AtlasLogix_Fullstack_Seed_Data.json'),
                '/Applications/XAMPP/xamppfiles/htdocs/AtlasLogix/AtlasLogix_Senior_Fullstack_Assessment_REDA-HAFEZ/AtlasLogix_Senior_Fullstack_Assessment_REDA-HAFEZ/AtlasLogix_Fullstack_Seed_Data.json',
            ]
            for cand in candidates:
                if os.path.exists(cand):
                    file_path = cand
                    break

        if not file_path or not os.path.exists(file_path):
            self.stderr.write(self.style.ERROR(f"Seed file not found. Tried paths in container."))
            return

        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        self.stdout.write(f"Importing seed data for candidate: {data.get('generatedFor')} from {file_path}...")

        with transaction.atomic():
            # 1. Tenants
            for t in data.get('tenants', []):
                Tenant.objects.update_or_create(
                    tenant_id=t['tenantId'],
                    defaults={
                        'name': t['name'],
                        'region': t['region'],
                    }
                )

            # 2. Users
            for u in data.get('users', []):
                user, created = User.objects.get_or_create(
                    user_id=u['userId'],
                    defaults={
                        'email': u['email'],
                        'username': u['email'],
                    }
                )
                if created or 'initialPassword' in u:
                    user.set_password(u['initialPassword'])
                    user.email = u['email']
                    user.username = u['email']
                    user.save()

            # 3. Memberships
            for m in data.get('memberships', []):
                user = User.objects.get(user_id=m['userId'])
                tenant = Tenant.objects.get(tenant_id=m['tenantId'])
                TenantMembership.objects.update_or_create(
                    user=user,
                    tenant=tenant,
                    defaults={'role': m['role']}
                )

            # 4. Devices
            for d in data.get('devices', []):
                tenant = Tenant.objects.get(tenant_id=d['tenantId'])
                Device.objects.update_or_create(
                    device_id=d['deviceId'],
                    defaults={
                        'tenant': tenant,
                        'device_key': d['deviceKey'],
                    }
                )

            # 5. Shipments
            for s in data.get('shipments', []):
                tenant = Tenant.objects.get(tenant_id=s['tenantId'])
                approved_by_user = User.objects.filter(user_id=s['approvedBy']).first() if s.get('approvedBy') else None

                existing_shipment = Shipment.objects.filter(shipment_id=s['shipmentId']).first()
                if existing_shipment and (existing_shipment.compliance_status == ComplianceStatus.APPROVED or existing_shipment.locked_at is not None):
                    defaults = {
                        'tenant': tenant,
                        'tracking_reference': s['trackingReference'],
                        'origin': s['origin'],
                        'destination': s['destination'],
                        'carrier': s['carrier'],
                        'cargo_type': s['cargoType'],
                        'status': s['status'],
                        'warehouse': s['warehouse'],
                        'required_temperature_min': s['requiredTemperatureMin'],
                        'required_temperature_max': s['requiredTemperatureMax'],
                        'required_humidity_min': s['requiredHumidityMin'],
                        'required_humidity_max': s['requiredHumidityMax'],
                        'estimated_arrival': parse_iso_datetime(s.get('estimatedArrival')),
                    }
                else:
                    defaults = {
                        'tenant': tenant,
                        'tracking_reference': s['trackingReference'],
                        'origin': s['origin'],
                        'destination': s['destination'],
                        'carrier': s['carrier'],
                        'cargo_type': s['cargoType'],
                        'status': s['status'],
                        'compliance_status': s['complianceStatus'],
                        'warehouse': s['warehouse'],
                        'required_temperature_min': s['requiredTemperatureMin'],
                        'required_temperature_max': s['requiredTemperatureMax'],
                        'required_humidity_min': s['requiredHumidityMin'],
                        'required_humidity_max': s['requiredHumidityMax'],
                        'estimated_arrival': parse_iso_datetime(s.get('estimatedArrival')),
                        'last_updated': parse_iso_datetime(s['lastUpdated']),
                        'locked_at': parse_iso_datetime(s.get('lockedAt')),
                        'approved_by': approved_by_user,
                    }

                Shipment.objects.update_or_create(
                    shipment_id=s['shipmentId'],
                    defaults=defaults
                )

            # 6. Sensor Readings
            for sr in data.get('sensorReadings', []):
                shipment = Shipment.objects.get(shipment_id=sr['shipmentId'])
                recorded_at = parse_iso_datetime(sr['recordedAt'])
                payload_hash = compute_telemetry_hash(
                    shipment_id=sr['shipmentId'],
                    temperature=sr['temperature'],
                    humidity=sr['humidity'],
                    vibration=sr.get('vibration'),
                    battery_level=sr.get('batteryLevel'),
                    confidence=sr['confidence'],
                    recorded_at_str=recorded_at.isoformat()
                )

                SensorReading.objects.update_or_create(
                    event_id=sr['eventId'],
                    defaults={
                        'shipment': shipment,
                        'temperature': sr['temperature'],
                        'humidity': sr['humidity'],
                        'vibration': sr.get('vibration'),
                        'battery_level': sr.get('batteryLevel'),
                        'confidence': sr['confidence'],
                        'recorded_at': recorded_at,
                        'payload_hash': payload_hash,
                    }
                )


            # 7. Audit Entries
            for a in data.get('auditEntries', []):
                tenant = Tenant.objects.get(tenant_id=a['tenantId'])
                actor = User.objects.filter(user_id=a['actorUserId']).first() if a.get('actorUserId') else None

                AuditEntry.objects.update_or_create(
                    audit_id=a['auditId'],
                    defaults={
                        'tenant': tenant,
                        'entity': a['entity'],
                        'entity_id': a['entityId'],
                        'field': a['field'],
                        'before': a.get('before'),
                        'after': a.get('after'),
                        'actor_user': actor,
                        'reason': a.get('reason'),
                        'timestamp': parse_iso_datetime(a['timestamp']),
                    }
                )

        self.stdout.write(self.style.SUCCESS("Successfully imported seed data idempotently!"))
