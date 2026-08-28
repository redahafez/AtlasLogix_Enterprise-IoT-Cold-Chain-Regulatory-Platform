import json
from django.test import TestCase
from django.core.management import call_command
from rest_framework.test import APIClient
from rest_framework import status
from core.models import User, Shipment, Tenant, Device, SensorReading, ComplianceStatus, Role
from core.authentication import generate_jwt_token

class AtlasLogixAPITestCase(TestCase):
    def setUp(self):
        call_command('import_seed')
        self.client = APIClient()

        # Seed Users
        self.admin_user = User.objects.get(user_id='user-REDA-HAFEZ-admin')
        self.auditor_user = User.objects.get(user_id='user-REDA-HAFEZ-auditor')
        self.ops_user = User.objects.get(user_id='user-REDA-HAFEZ-operations')
        self.warehouse_user = User.objects.get(user_id='user-REDA-HAFEZ-warehouse')
        self.viewer_user = User.objects.get(user_id='user-REDA-HAFEZ-viewer')

        self.primary_tenant = Tenant.objects.get(tenant_id='TENANT-REDA-HAFEZ')
        self.mena_tenant = Tenant.objects.get(tenant_id='TENANT-REDA-HAFEZ-MENA')

    def get_auth_client(self, user, tenant_id='TENANT-REDA-HAFEZ'):
        client = APIClient()
        token = generate_jwt_token(user, tenant_id=tenant_id)
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        return client

    def test_health_endpoints(self):
        res = self.client.get('/health/live')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['status'], 'ok')

        res = self.client.get('/health/ready')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['status'], 'ok')

    def test_login_success_and_failure(self):
        # Valid login
        res = self.client.post('/api/v1/auth/login', {
            'email': 'admin.reda-hafez@atlaslogix.test',
            'password': '7P1OhjscS32sQjYWFCra2w'
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('token', res.data)
        self.assertEqual(res.data['email'], 'admin.reda-hafez@atlaslogix.test')

        # Invalid login
        res = self.client.post('/api/v1/auth/login', {
            'email': 'admin.reda-hafez@atlaslogix.test',
            'password': 'WrongPassword123'
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_cross_tenant_isolation_returns_404(self):
        # Auditor authenticated for TENANT-REDA-HAFEZ trying to access MENA shipment (MENA-30481)
        client = self.get_auth_client(self.auditor_user, tenant_id='TENANT-REDA-HAFEZ')

        # Detail fetch for alien shipment
        res = client.get('/api/v1/shipments/MENA-30481')
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(res.data['error'], 'NOT_FOUND')

        # Sensor data fetch for alien shipment
        res = client.get('/api/v1/shipments/MENA-30481/sensor-data')
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_shipment_no_sensor_readings(self):
        # ALX-20468 has no sensor readings
        client = self.get_auth_client(self.auditor_user)

        res = client.get('/api/v1/shipments/ALX-20468/sensor-data')
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)

        res = client.get('/api/v1/shipments/ALX-20468/sensor-data/history')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['data'], [])

    def test_compliance_approval_role_and_locking(self):
        # ALX-20481 is PENDING and unlocked
        # 1. Non-auditor (operations manager) attempts approval -> 403 Forbidden
        ops_client = self.get_auth_client(self.ops_user)
        res = ops_client.post('/api/v1/shipments/ALX-20481/compliance/approve', {
            'reason': 'Verified temperature excursion as acceptable.'
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        # 2. Auditor approves with valid reason -> 200 OK
        auditor_client = self.get_auth_client(self.auditor_user)
        res = auditor_client.post('/api/v1/shipments/ALX-20481/compliance/approve', {
            'reason': 'Excursion accepted after expert QA investigation.'
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['complianceStatus'], 'APPROVED')

        # 3. Repeated approval on locked shipment -> 409 Conflict
        res = auditor_client.post('/api/v1/shipments/ALX-20481/compliance/approve', {
            'reason': 'Attempting second approval.'
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(res.data['error'], 'CONFLICT')

    def test_telemetry_idempotency_and_conflict(self):
        device = Device.objects.get(device_id='device-REDA-HAFEZ-primary')
        event_id = 'evt-test-unique-1001'

        payload = {
            'eventId': event_id,
            'shipmentId': 'ALX-20481',
            'temperature': 5.5,
            'humidity': 45,
            'vibration': 0.05,
            'batteryLevel': 95,
            'confidence': 'HIGH',
            'recordedAt': '2026-07-12T15:00:00Z'
        }

        # 1. First acceptance -> 202 Accepted
        res = self.client.post(
            '/api/v1/telemetry/readings',
            data=payload,
            format='json',
            HTTP_X_DEVICE_KEY=device.device_key,
            HTTP_IDEMPOTENCY_KEY=event_id
        )
        self.assertEqual(res.status_code, status.HTTP_202_ACCEPTED)
        self.assertTrue(res.data['accepted'])
        self.assertFalse(res.data['replayed'])

        # 2. Replay identical payload -> 200 OK (replayed: true)
        res = self.client.post(
            '/api/v1/telemetry/readings',
            data=payload,
            format='json',
            HTTP_X_DEVICE_KEY=device.device_key,
            HTTP_IDEMPOTENCY_KEY=event_id
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data['accepted'])
        self.assertTrue(res.data['replayed'])

        # 3. Reuse event ID with conflicting payload -> 409 Conflict
        conflicting_payload = dict(payload)
        conflicting_payload['temperature'] = 19.9

        res = self.client.post(
            '/api/v1/telemetry/readings',
            data=conflicting_payload,
            format='json',
            HTTP_X_DEVICE_KEY=device.device_key,
            HTTP_IDEMPOTENCY_KEY=event_id
        )
        self.assertEqual(res.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(res.data['error'], 'EVENT_CONFLICT')

    def test_stream_ticket_issuance(self):
        client = self.get_auth_client(self.auditor_user)

        res = client.post('/api/v1/stream/tickets', {
            'tenantId': 'TENANT-REDA-HAFEZ'
        }, format='json')

        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertIn('ticket', res.data)
        self.assertIn('websocketUrl', res.data)
        self.assertTrue(res.data['ticket'].startswith('stk_'))
